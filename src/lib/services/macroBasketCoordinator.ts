import type { Candle, TickerInfo } from '../types/market';
import { universalFetch, type UniversalFetchOptions, type UniversalResponse } from './httpClient';
import {
  canonicalizeMacroIndexSymbol,
  FALLBACK_MACRO_CONSTITUENTS,
  FALLBACK_TOTAL_STABLECOIN_CAP_USD,
  FALLBACK_USDT_CAP_USD,
  isMacroStablecoin,
  isMacroWrappedOrDuplicate,
  MACRO_INDEX_CATALOG,
  resolveMacroIndexDescriptor,
  type CanonicalMacroSymbol,
} from './macroIndexCatalog';
import { isMonthlyTimeframe } from '../utils/timeframeAdapter';
import { resampleCandles, type OHLCV } from './yahooFinanceProvider';

export interface MacroBasketConstituent {
  symbol: string;
  coingeckoId: string;
  name: string;
  circulatingSupply: number;
  currentPriceUsd: number;
  currentMarketCapUsd: number;
  marketCapRank: number;
  inTop10: boolean;
}

export interface MacroMetadataSnapshot {
  fetchedAt: number;
  totalGlobalMarketCapUsd: number;
  constituents: MacroBasketConstituent[];
  top10StablecoinCapUsd: number;
  currentTotalStablecoinCapUsd: number;
  currentUsdtCapUsd: number;
  source: 'live' | 'storage_cache' | 'fallback';
}

export interface StablecoinHistoryPoint {
  dayKey: number;
  totalUsd: number;
  usdtUsd: number;
}

export interface ComponentBarSeries {
  symbol: string;
  bars: OHLCV[];
}

export type MacroFetchFn = (url: string, options?: UniversalFetchOptions) => Promise<UniversalResponse>;

export interface MacroCoordinatorOptions {
  fetchFn?: MacroFetchFn;
  nowFn?: () => number;
  loadSqliteCache?: (symbol: string, timeframe: string, limit: number) => Promise<Candle[]>;
  saveSqliteCache?: (symbol: string, timeframe: string, candles: Candle[]) => Promise<void>;
  disableLocalStorage?: boolean;
  metadataTtlMs?: number;
  stablecoinTtlMs?: number;
  tickerTtlMs?: number;
  requestTimeoutMs?: number;
  maxConcurrentKlines?: number;
}

const METADATA_STORAGE_KEY = 'trawangan_macro_metadata_v1';
const DAY_MS = 86_400_000;
const COINBASE_VALID_GRANULARITIES = [60, 300, 900, 3600, 21600, 86400];

const TIMEFRAME_SECONDS_MAP: Record<string, number> = {
  '1': 60,
  '1m': 60,
  '3': 180,
  '3m': 180,
  '5': 300,
  '5m': 300,
  '15': 900,
  '15m': 900,
  '30': 1800,
  '30m': 1800,
  '45': 2700,
  '45m': 2700,
  '60': 3600,
  '1h': 3600,
  'h': 3600,
  '120': 7200,
  '2h': 7200,
  '240': 14400,
  '4h': 14400,
  '360': 21600,
  '6h': 21600,
  '720': 43200,
  '12h': 43200,
  '1d': 86400,
  'd': 86400,
  '1w': 604800,
  'w': 604800,
};

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function normalizeMacroTimeframe(tf: string): string {
  if (!tf) return '1D';
  if (isMonthlyTimeframe(tf)) return '1M';
  const clean = tf.trim().toLowerCase();
  if (clean === '1d' || clean === 'd') return '1D';
  if (clean === '1w' || clean === 'w') return '1W';
  const sec = TIMEFRAME_SECONDS_MAP[clean];
  if (!sec) return '1D';
  if (sec < 3600) return `${sec / 60}m`;
  if (sec < 86400) return `${sec / 3600}h`;
  return '1D';
}

function toBinanceInterval(canonicalTf: string): string {
  switch (canonicalTf) {
    case '1D':
      return '1d';
    case '1W':
      return '1w';
    case '1M':
      return '1M';
    default:
      return canonicalTf;
  }
}

export function getTimeframeIntervalMs(canonicalTf: string): number {
  if (canonicalTf === '1M') return 30 * DAY_MS;
  const sec = TIMEFRAME_SECONDS_MAP[canonicalTf.toLowerCase()];
  return sec ? sec * 1000 : DAY_MS;
}

export function getBarBucketStartMs(timestampMs: number, canonicalTf: string): number {
  if (canonicalTf === '1M') {
    const d = new Date(timestampMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
  if (canonicalTf === '1W') {
    const d = new Date(timestampMs);
    const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const weekdayFromMon = (d.getUTCDay() + 6) % 7;
    return utcMidnight - weekdayFromMon * DAY_MS;
  }
  const intervalMs = getTimeframeIntervalMs(canonicalTf);
  return Math.floor(timestampMs / intervalMs) * intervalMs;
}

function resolveDefaultHistoryLimit(canonicalTf: string, requested?: number): number {
  if (requested && requested > 0) {
    return Math.min(1000, Math.max(20, requested));
  }
  switch (canonicalTf) {
    case '1m':
    case '3m':
    case '5m':
      return 360;
    case '15m':
    case '30m':
      return 500;
    case '1h':
    case '2h':
    case '4h':
      return 720;
    case '1D':
      return 365;
    case '1W':
      return 156;
    case '1M':
      return 60;
    default:
      return 365;
  }
}

function resampleByCalendar(candles: OHLCV[], canonicalTf: string): OHLCV[] {
  if (candles.length === 0) return [];
  if (canonicalTf !== '1W' && canonicalTf !== '1M') {
    const targetSec = Math.round(getTimeframeIntervalMs(canonicalTf) / 1000);
    return resampleCandles(candles, targetSec);
  }

  const result: OHLCV[] = [];
  let current: OHLCV | null = null;
  for (const bar of candles) {
    const bucket = getBarBucketStartMs(bar.time, canonicalTf);
    if (!current || current.time !== bucket) {
      if (current) result.push(current);
      current = {
        time: bucket,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume ?? 0,
      };
    } else {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.volume = (current.volume ?? 0) + (bar.volume ?? 0);
    }
  }
  if (current) result.push(current);
  return result;
}

function findStablecoinPointForTimestamp(
  history: StablecoinHistoryPoint[],
  timestampMs: number,
  fallbackTotal: number,
  fallbackUsdt: number
): { totalUsd: number; usdtUsd: number } {
  if (!history.length) {
    return { totalUsd: fallbackTotal, usdtUsd: fallbackUsdt };
  }
  const targetDay = Math.floor(timestampMs / DAY_MS) * DAY_MS;

  // Binary search titik historis terakhir <= targetDay agar perubahan supply stablecoin tertrack harian.
  let lo = 0;
  let hi = history.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (history[mid].dayKey <= targetDay) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best >= 0) {
    const point = history[best];
    return {
      totalUsd: point.totalUsd > 0 ? point.totalUsd : fallbackTotal,
      usdtUsd: point.usdtUsd > 0 ? point.usdtUsd : fallbackUsdt,
    };
  }
  return { totalUsd: history[0].totalUsd || fallbackTotal, usdtUsd: history[0].usdtUsd || fallbackUsdt };
}

export interface CompositeSynthesisInput {
  targetSymbol: CanonicalMacroSymbol;
  metadata: MacroMetadataSnapshot;
  stablecoinHistory: StablecoinHistoryPoint[];
  componentSeries: ComponentBarSeries[];
}

/**
 * Menghitung pengali long-tail altcoin terhadap konstituen yang benar-benar tersedia,
 * agar nilai basket pada titik terbaru konsisten dengan total market cap global CoinGecko.
 */
export function computeAltCalibrationMultiplier(
  metadata: MacroMetadataSnapshot,
  activeConstituentSymbols: ReadonlySet<string>,
  spotOverrides?: ReadonlyMap<string, number>
): number {
  const globalCap = metadata.totalGlobalMarketCapUsd;
  if (!Number.isFinite(globalCap) || globalCap <= 0) {
    return 1.0;
  }

  let btcCapNow = 0;
  let ethCapNow = 0;
  let activeAltsCapNow = 0;

  for (const c of metadata.constituents) {
    if (!activeConstituentSymbols.has(c.symbol)) continue;
    const price = spotOverrides?.get(c.symbol) ?? c.currentPriceUsd;
    const cap = price > 0 && c.circulatingSupply > 0 ? price * c.circulatingSupply : c.currentMarketCapUsd;
    if (c.symbol === 'BTC') {
      btcCapNow = cap;
    } else if (c.symbol === 'ETH') {
      ethCapNow = cap;
    } else {
      activeAltsCapNow += cap;
    }
  }

  if (activeAltsCapNow <= 0) {
    return 1.0;
  }

  const targetAltsAndLongTail = Math.max(
    activeAltsCapNow * 0.85,
    globalCap - btcCapNow - ethCapNow - metadata.currentTotalStablecoinCapUsd
  );
  return clamp(targetAltsAndLongTail / activeAltsCapNow, 0.85, 2.2);
}

/**
 * Menyintesis array OHLCV kanonikal indeks makro dari seri klines komponen dan riwayat stablecoin.
 */
export function buildCompositeMacroBars(input: CompositeSynthesisInput): Candle[] {
  const { targetSymbol, metadata, stablecoinHistory, componentSeries } = input;
  const constituentMap = new Map(metadata.constituents.map((c) => [c.symbol, c]));

  const validSeries = componentSeries.filter(
    (s) => s.bars.length > 0 && constituentMap.has(s.symbol)
  );
  if (validSeries.length === 0) {
    return [];
  }

  // Gabungkan grid waktu unik terurut menaik lintas konstituen agar bar komposit sinkron.
  const timestampSet = new Set<number>();
  for (const s of validSeries) {
    for (const bar of s.bars) {
      timestampSet.add(bar.time);
    }
  }
  const timestamps = Array.from(timestampSet).sort((a, b) => a - b);
  if (timestamps.length === 0) {
    return [];
  }

  const activeSymbols = new Set(validSeries.map((s) => s.symbol));
  const altMultiplier = computeAltCalibrationMultiplier(metadata, activeSymbols);

  const stableShareTop10Ratio =
    metadata.currentTotalStablecoinCapUsd > 0
      ? clamp(metadata.top10StablecoinCapUsd / metadata.currentTotalStablecoinCapUsd, 0, 1)
      : 0;

  // Indeks kursor per komponen agar kompleksitas O(N * K) tanpa map lookup per bar.
  const trackers = validSeries.map((s) => {
    const meta = constituentMap.get(s.symbol)!;
    const sortedBars = [...s.bars].sort((a, b) => a.time - b.time);
    return {
      symbol: s.symbol,
      supply: meta.circulatingSupply,
      inTop10: meta.inTop10,
      firstTime: sortedBars[0].time,
      bars: sortedBars,
      cursor: 0,
      lastKnownClose: 0,
    };
  });

  const result: Candle[] = [];

  for (const t of timestamps) {
    let btcO = 0, btcH = 0, btcL = 0, btcC = 0;
    let ethO = 0, ethH = 0, ethL = 0, ethC = 0;
    let altO = 0, altH = 0, altL = 0, altC = 0;
    let top10VolO = 0, top10VolH = 0, top10VolL = 0, top10VolC = 0;

    for (const tr of trackers) {
      // Jangan memasukkan koin sebelum candle historis pertamanya tersedia (anti-lookahead bias).
      if (t < tr.firstTime) continue;

      while (tr.cursor + 1 < tr.bars.length && tr.bars[tr.cursor + 1].time <= t) {
        tr.cursor++;
      }

      const currentBar = tr.bars[tr.cursor];
      let o: number, h: number, l: number, c: number;
      if (currentBar.time === t) {
        o = currentBar.open;
        h = currentBar.high;
        l = currentBar.low;
        c = currentBar.close;
        tr.lastKnownClose = c;
      } else {
        // Forward-fill hanya untuk celah singkat setelah listing awal agar kurva tidak turun palsu.
        const ref = tr.lastKnownClose || currentBar.close;
        o = ref;
        h = ref;
        l = ref;
        c = ref;
      }

      const capO = o * tr.supply;
      const capH = h * tr.supply;
      const capL = l * tr.supply;
      const capC = c * tr.supply;

      if (tr.symbol === 'BTC') {
        btcO = capO; btcH = capH; btcL = capL; btcC = capC;
      } else if (tr.symbol === 'ETH') {
        ethO = capO; ethH = capH; ethL = capL; ethC = capC;
      } else {
        altO += capO;
        altH += capH;
        altL += capL;
        altC += capC;
      }

      if (tr.inTop10) {
        top10VolO += capO;
        top10VolH += capH;
        top10VolL += capL;
        top10VolC += capC;
      }
    }

    const { totalUsd: stableCap, usdtUsd: usdtCap } = findStablecoinPointForTimestamp(
      stablecoinHistory,
      t,
      metadata.currentTotalStablecoinCapUsd,
      metadata.currentUsdtCapUsd
    );

    const calAltO = altO * altMultiplier;
    const calAltH = altH * altMultiplier;
    const calAltL = altL * altMultiplier;
    const calAltC = altC * altMultiplier;

    const totalO = btcO + ethO + calAltO + stableCap;
    const totalH = btcH + ethH + calAltH + stableCap;
    const totalL = btcL + ethL + calAltL + stableCap;
    const totalC = btcC + ethC + calAltC + stableCap;

    if (totalC <= 0) continue;

    let barO = 0;
    let barH = 0;
    let barL = 0;
    let barC = 0;

    if (targetSymbol === 'TOTAL') {
      barO = totalO;
      barC = totalC;
      barH = Math.max(barO, barC, totalH);
      barL = Math.min(barO, barC, totalL);
    } else if (targetSymbol === 'TOTAL2') {
      barO = Math.max(0, totalO - btcO);
      barC = Math.max(0, totalC - btcC);
      barH = Math.max(barO, barC, Math.max(0, totalH - btcH));
      barL = Math.min(barO, barC, Math.max(0, totalL - btcL));
    } else if (targetSymbol === 'TOTAL3') {
      barO = Math.max(0, totalO - btcO - ethO);
      barC = Math.max(0, totalC - btcC - ethC);
      barH = Math.max(barO, barC, Math.max(0, totalH - btcH - ethH));
      barL = Math.min(barO, barC, Math.max(0, totalL - btcL - ethL));
    } else if (targetSymbol === 'OTHERS') {
      const top10Stable = stableCap * stableShareTop10Ratio;
      barO = Math.max(0, totalO - top10VolO - top10Stable);
      barC = Math.max(0, totalC - top10VolC - top10Stable);
      barH = Math.max(barO, barC, Math.max(0, totalH - top10VolH - top10Stable));
      barL = Math.min(barO, barC, Math.max(0, totalL - top10VolL - top10Stable));
    } else if (targetSymbol === 'BTC.D' || targetSymbol === 'ETH.D') {
      const xO = targetSymbol === 'BTC.D' ? btcO : ethO;
      const xH = targetSymbol === 'BTC.D' ? btcH : ethH;
      const xL = targetSymbol === 'BTC.D' ? btcL : ethL;
      const xC = targetSymbol === 'BTC.D' ? btcC : ethC;

      const restO = Math.max(1, totalO - xO);
      const restC = Math.max(1, totalC - xC);
      const restMin = Math.max(1, Math.min(restO, restC));
      const restMax = Math.max(1, Math.max(restO, restC));

      barO = clamp((xO / totalO) * 100, 0.01, 100);
      barC = clamp((xC / totalC) * 100, 0.01, 100);
      const candHigh = clamp((xH / (xH + restMin)) * 100, 0.01, 100);
      const candLow = clamp((xL / (xL + restMax)) * 100, 0.01, 100);
      barH = Math.max(barO, barC, candHigh, candLow);
      barL = Math.min(barO, barC, candHigh, candLow);
    } else {
      // USDT.D: pembilang konstan harian sehingga wick atas terbentuk saat total pasar turun.
      const restO = Math.max(1, totalO - usdtCap);
      const restH = Math.max(1, totalH - usdtCap);
      const restL = Math.max(1, totalL - usdtCap);
      const restC = Math.max(1, totalC - usdtCap);

      barO = clamp((usdtCap / (usdtCap + restO)) * 100, 0.01, 100);
      barC = clamp((usdtCap / (usdtCap + restC)) * 100, 0.01, 100);
      const candHigh = clamp((usdtCap / (usdtCap + restL)) * 100, 0.01, 100);
      const candLow = clamp((usdtCap / (usdtCap + restH)) * 100, 0.01, 100);
      barH = Math.max(barO, barC, candHigh, candLow);
      barL = Math.min(barO, barC, candHigh, candLow);
    }

    result.push({
      time: t,
      open: barO,
      high: Math.max(barO, barC, barH),
      low: Math.min(barO, barC, barL),
      close: barC,
      volume: 0,
    });
  }

  return result;
}

/**
 * Mengoordinasikan metadata basket (CoinGecko + DefiLlama), klines komponen (Binance/Coinbase),
 * dan SQLite read-through cache khusus saat grafik indeks makro dibuka aktif.
 */
export class MacroBasketCoordinator {
  private fetchFn: MacroFetchFn;
  private nowFn: () => number;
  private loadSqliteCache?: (symbol: string, timeframe: string, limit: number) => Promise<Candle[]>;
  private saveSqliteCache?: (symbol: string, timeframe: string, candles: Candle[]) => Promise<void>;
  private disableLocalStorage: boolean;
  private metadataTtlMs: number;
  private stablecoinTtlMs: number;
  private tickerTtlMs: number;
  private requestTimeoutMs: number;
  private maxConcurrentKlines: number;

  private metadataCache: MacroMetadataSnapshot | null = null;
  private inflightMetadata: Promise<MacroMetadataSnapshot> | null = null;
  private stablecoinCache: { fetchedAt: number; points: StablecoinHistoryPoint[] } | null = null;
  private inflightStablecoin: Promise<StablecoinHistoryPoint[]> | null = null;
  private componentCache = new Map<string, { fetchedAt: number; series: ComponentBarSeries[] }>();
  private seriesCache = new Map<string, { updatedAt: number; bars: Candle[] }>();
  private tickerSnapshotCache: { fetchedAt: number; tickers: Record<string, TickerInfo> } | null = null;
  private inflightTickers: Promise<Record<string, TickerInfo>> | null = null;

  constructor(options: MacroCoordinatorOptions = {}) {
    this.fetchFn = options.fetchFn ?? universalFetch;
    this.nowFn = options.nowFn ?? (() => Date.now());
    this.loadSqliteCache = options.loadSqliteCache;
    this.saveSqliteCache = options.saveSqliteCache;
    this.disableLocalStorage = options.disableLocalStorage ?? false;
    this.metadataTtlMs = options.metadataTtlMs ?? 15 * 60 * 1000;
    this.stablecoinTtlMs = options.stablecoinTtlMs ?? 30 * 60 * 1000;
    this.tickerTtlMs = options.tickerTtlMs ?? 8000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 9000;
    this.maxConcurrentKlines = options.maxConcurrentKlines ?? 6;
  }

  private readMetadataFromStorage(): MacroMetadataSnapshot | null {
    if (this.disableLocalStorage || typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(METADATA_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as MacroMetadataSnapshot;
      if (parsed && Array.isArray(parsed.constituents) && parsed.constituents.length > 0) {
        return { ...parsed, source: 'storage_cache' };
      }
    } catch {
      // Abaikan localStorage yang rusak agar tidak menghambat pemuatan data.
    }
    return null;
  }

  private writeMetadataToStorage(snap: MacroMetadataSnapshot): void {
    if (this.disableLocalStorage || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(snap));
    } catch {
      // Abaikan quota error pada WebView.
    }
  }

  private buildFallbackMetadata(): MacroMetadataSnapshot {
    const constituents: MacroBasketConstituent[] = FALLBACK_MACRO_CONSTITUENTS.map((item) => ({
      symbol: item.symbol,
      coingeckoId: item.symbol.toLowerCase(),
      name: item.name,
      circulatingSupply: item.circulatingSupply,
      currentPriceUsd: 0,
      currentMarketCapUsd: 0,
      marketCapRank: item.rank,
      inTop10: item.rank <= 10,
    }));

    return {
      fetchedAt: this.nowFn(),
      totalGlobalMarketCapUsd: 0,
      constituents,
      top10StablecoinCapUsd: FALLBACK_USDT_CAP_USD + 55_000_000_000,
      currentTotalStablecoinCapUsd: FALLBACK_TOTAL_STABLECOIN_CAP_USD,
      currentUsdtCapUsd: FALLBACK_USDT_CAP_USD,
      source: 'fallback',
    };
  }

  public async getMetadataSnapshot(signal?: AbortSignal): Promise<MacroMetadataSnapshot> {
    const now = this.nowFn();
    if (this.metadataCache && now - this.metadataCache.fetchedAt < this.metadataTtlMs) {
      return this.metadataCache;
    }
    if (this.inflightMetadata) {
      return this.inflightMetadata;
    }

    this.inflightMetadata = (async () => {
      try {
        const [globalRes, marketsRes] = await Promise.all([
          this.fetchFn('https://api.coingecko.com/api/v3/global', {
            timeoutMs: this.requestTimeoutMs,
            signal,
          }).catch(() => null),
          this.fetchFn(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false',
            {
              timeoutMs: this.requestTimeoutMs,
              signal,
            }
          ).catch(() => null),
        ]);

        let totalGlobalCap = 0;
        if (globalRes?.ok) {
          try {
            const globalJson = await globalRes.json();
            totalGlobalCap = Number(globalJson?.data?.total_market_cap?.usd) || 0;
          } catch {
            totalGlobalCap = 0;
          }
        }

        if (marketsRes?.ok) {
          const rows = (await marketsRes.json()) as any[];
          if (Array.isArray(rows) && rows.length > 0) {
            const constituents: MacroBasketConstituent[] = [];
            let top10Counter = 0;
            let top10StableCap = 0;
            let totalStableCap = 0;
            let usdtCap = 0;

            for (const row of rows) {
              const rawSym = String(row?.symbol || '').trim().toUpperCase();
              if (!rawSym || isMacroWrappedOrDuplicate(rawSym)) continue;

              const mcap = Number(row?.market_cap) || 0;
              const price = Number(row?.current_price) || 0;
              const supply = Number(row?.circulating_supply) || (price > 0 && mcap > 0 ? mcap / price : 0);
              const rank = Number(row?.market_cap_rank) || top10Counter + 1;

              top10Counter++;
              const isInTop10 = top10Counter <= 10;

              if (isMacroStablecoin(rawSym)) {
                totalStableCap += mcap;
                if (rawSym === 'USDT') usdtCap = mcap;
                if (isInTop10) top10StableCap += mcap;
                continue;
              }

              if (supply <= 0 || price <= 0) continue;
              if (constituents.length >= 30) continue;

              constituents.push({
                symbol: rawSym,
                coingeckoId: String(row?.id || rawSym.toLowerCase()),
                name: String(row?.name || rawSym),
                circulatingSupply: supply,
                currentPriceUsd: price,
                currentMarketCapUsd: mcap,
                marketCapRank: rank,
                inTop10: isInTop10,
              });
            }

            if (constituents.length >= 5) {
              const snap: MacroMetadataSnapshot = {
                fetchedAt: this.nowFn(),
                totalGlobalMarketCapUsd: totalGlobalCap,
                constituents,
                top10StablecoinCapUsd: top10StableCap > 0 ? top10StableCap : usdtCap,
                currentTotalStablecoinCapUsd:
                  totalStableCap > 0 ? totalStableCap : FALLBACK_TOTAL_STABLECOIN_CAP_USD,
                currentUsdtCapUsd: usdtCap > 0 ? usdtCap : FALLBACK_USDT_CAP_USD,
                source: 'live',
              };
              this.metadataCache = snap;
              this.writeMetadataToStorage(snap);
              return snap;
            }
          }
        }
      } catch {
        // Lanjut ke cache lokal atau fallback statis.
      }

      const staleOrStored = this.metadataCache ?? this.readMetadataFromStorage();
      if (staleOrStored) {
        this.metadataCache = { ...staleOrStored, fetchedAt: this.nowFn() };
        return this.metadataCache;
      }

      const fallback = this.buildFallbackMetadata();
      this.metadataCache = fallback;
      return fallback;
    })();

    try {
      return await this.inflightMetadata;
    } finally {
      this.inflightMetadata = null;
    }
  }

  public async getStablecoinHistory(
    metadata: MacroMetadataSnapshot,
    signal?: AbortSignal
  ): Promise<StablecoinHistoryPoint[]> {
    const now = this.nowFn();
    if (this.stablecoinCache && now - this.stablecoinCache.fetchedAt < this.stablecoinTtlMs) {
      return this.stablecoinCache.points;
    }
    if (this.inflightStablecoin) {
      return this.inflightStablecoin;
    }

    this.inflightStablecoin = (async () => {
      try {
        const [allRes, usdtRes] = await Promise.all([
          this.fetchFn('https://stablecoins.llama.fi/stablecoincharts/all', {
            timeoutMs: this.requestTimeoutMs,
            signal,
          }).catch(() => null),
          this.fetchFn('https://stablecoins.llama.fi/stablecoin/1', {
            timeoutMs: this.requestTimeoutMs,
            signal,
          }).catch(() => null),
        ]);

        const usdtByDay = new Map<number, number>();
        if (usdtRes?.ok) {
          try {
            const usdtJson = await usdtRes.json();
            const tokens: any[] = Array.isArray(usdtJson?.tokens) ? usdtJson.tokens : [];
            for (const entry of tokens) {
              const rawTs = Number(entry?.date);
              const val = Number(entry?.circulating?.peggedUSD);
              if (Number.isFinite(rawTs) && Number.isFinite(val) && val > 0) {
                const tsMs = rawTs < 1e11 ? rawTs * 1000 : rawTs;
                const dayKey = Math.floor(tsMs / DAY_MS) * DAY_MS;
                usdtByDay.set(dayKey, val);
              }
            }
          } catch {
            // Gunakan rasio USDT dari metadata jika payload tidak sesuai.
          }
        }

        if (allRes?.ok) {
          const allRows = (await allRes.json()) as any[];
          if (Array.isArray(allRows) && allRows.length > 0) {
            const usdtShare =
              metadata.currentTotalStablecoinCapUsd > 0
                ? clamp(metadata.currentUsdtCapUsd / metadata.currentTotalStablecoinCapUsd, 0.4, 0.9)
                : 0.65;

            const points: StablecoinHistoryPoint[] = [];
            let lastUsdt = metadata.currentUsdtCapUsd;

            for (const row of allRows) {
              const rawTs = Number(row?.date);
              const totalVal = Number(row?.totalCirculatingUSD?.peggedUSD ?? row?.totalCirculating?.peggedUSD);
              if (!Number.isFinite(rawTs) || !Number.isFinite(totalVal) || totalVal <= 0) continue;
              const tsMs = rawTs < 1e11 ? rawTs * 1000 : rawTs;
              const dayKey = Math.floor(tsMs / DAY_MS) * DAY_MS;
              const exactUsdt = usdtByDay.get(dayKey);
              if (exactUsdt && exactUsdt > 0) {
                lastUsdt = exactUsdt;
              }
              points.push({
                dayKey,
                totalUsd: totalVal,
                usdtUsd: exactUsdt && exactUsdt > 0 ? exactUsdt : lastUsdt > 0 ? lastUsdt : totalVal * usdtShare,
              });
            }

            if (points.length > 0) {
              points.sort((a, b) => a.dayKey - b.dayKey);
              this.stablecoinCache = { fetchedAt: this.nowFn(), points };
              return points;
            }
          }
        }
      } catch {
        // Kembalikan titik datar dari metadata saat DefiLlama tidak dapat dijangkau.
      }

      const fallbackPoints: StablecoinHistoryPoint[] = [
        {
          dayKey: 0,
          totalUsd: metadata.currentTotalStablecoinCapUsd,
          usdtUsd: metadata.currentUsdtCapUsd,
        },
      ];
      this.stablecoinCache = { fetchedAt: this.nowFn(), points: fallbackPoints };
      return fallbackPoints;
    })();

    try {
      return await this.inflightStablecoin;
    } finally {
      this.inflightStablecoin = null;
    }
  }

  private async fetchSingleComponentKlines(
    symbol: string,
    canonicalTf: string,
    limit: number,
    signal?: AbortSignal
  ): Promise<OHLCV[]> {
    const binanceInterval = toBinanceInterval(canonicalTf);
    const binancePair = `${symbol.toUpperCase()}USDT`;
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=${encodeURIComponent(
      binanceInterval
    )}&limit=${limit}`;

    try {
      const res = await this.fetchFn(binanceUrl, { timeoutMs: this.requestTimeoutMs, signal });
      if (res.ok) {
        const rows = (await res.json()) as any[];
        if (Array.isArray(rows) && rows.length > 0) {
          return rows
            .map((k) => ({
              time: Number(k[0]),
              open: Number(k[1]),
              high: Number(k[2]),
              low: Number(k[3]),
              close: Number(k[4]),
              volume: Number(k[5]) || 0,
            }))
            .filter((b) => Number.isFinite(b.time) && Number.isFinite(b.close) && b.close > 0);
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }

    // Failover ke Coinbase Exchange jika Binance mengembalikan 400/451/error untuk simbol tertentu.
    const desiredSec = Math.round(getTimeframeIntervalMs(canonicalTf) / 1000);
    let cbGranularity = 86400;
    for (const candidate of COINBASE_VALID_GRANULARITIES) {
      if (candidate <= desiredSec) cbGranularity = candidate;
    }

    const cbUrl = `https://api.exchange.coinbase.com/products/${encodeURIComponent(
      `${symbol.toUpperCase()}-USD`
    )}/candles?granularity=${cbGranularity}`;

    try {
      const cbRes = await this.fetchFn(cbUrl, { timeoutMs: this.requestTimeoutMs, signal });
      if (!cbRes.ok) return [];
      const cbRows = (await cbRes.json()) as any[];
      if (!Array.isArray(cbRows) || cbRows.length === 0) return [];

      const ascending: OHLCV[] = [];
      for (const row of cbRows) {
        if (!Array.isArray(row) || row.length < 5) continue;
        const tsSec = Number(row[0]);
        const low = Number(row[1]);
        const high = Number(row[2]);
        const open = Number(row[3]);
        const close = Number(row[4]);
        const volume = Number(row[5] ?? 0);
        if (!Number.isFinite(tsSec) || !Number.isFinite(close) || close <= 0) continue;
        ascending.push({
          time: tsSec * 1000,
          open,
          high,
          low,
          close,
          volume,
        });
      }
      ascending.sort((a, b) => a.time - b.time);

      if (canonicalTf === '1W' || canonicalTf === '1M' || cbGranularity !== desiredSec) {
        return resampleByCalendar(ascending, canonicalTf).slice(-limit);
      }
      return ascending.slice(-limit);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return [];
    }
  }

  public async fetchAllComponentSeries(
    constituents: MacroBasketConstituent[],
    canonicalTf: string,
    limit: number,
    signal?: AbortSignal
  ): Promise<ComponentBarSeries[]> {
    const cacheKey = `${canonicalTf}:${limit}`;
    const cached = this.componentCache.get(cacheKey);
    const cacheTtl = getTimeframeIntervalMs(canonicalTf) >= DAY_MS ? 60_000 : 15_000;
    if (cached && this.nowFn() - cached.fetchedAt < cacheTtl) {
      return cached.series;
    }

    const queue = [...constituents];
    const results: ComponentBarSeries[] = [];
    const workerCount = Math.max(1, Math.min(this.maxConcurrentKlines, queue.length));

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
          if (signal?.aborted) return;
          const next = queue.shift();
          if (!next) return;
          const bars = await this.fetchSingleComponentKlines(next.symbol, canonicalTf, limit, signal);
          if (bars.length > 0) {
            results.push({ symbol: next.symbol, bars });
          }
        }
      })
    );

    if (results.length > 0) {
      this.componentCache.set(cacheKey, { fetchedAt: this.nowFn(), series: results });
    }
    return results;
  }

  private async tryReadSqlite(symbol: CanonicalMacroSymbol, tf: string, limit: number): Promise<Candle[]> {
    if (this.loadSqliteCache) {
      try {
        return await this.loadSqliteCache(`macro:${symbol}`, tf, limit);
      } catch {
        return [];
      }
    }
    if (!isTauriRuntime()) return [];
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<Candle[]>('load_cached_candles', {
        symbol: `macro:${symbol}`,
        timeframe: tf,
        limit,
      });
    } catch {
      return [];
    }
  }

  private async tryWriteSqlite(symbol: CanonicalMacroSymbol, tf: string, candles: Candle[]): Promise<void> {
    if (candles.length === 0) return;
    if (this.saveSqliteCache) {
      try {
        await this.saveSqliteCache(`macro:${symbol}`, tf, candles);
      } catch {
        // Kegagalan cache disk tidak boleh mematahkan rendering chart.
      }
      return;
    }
    if (!isTauriRuntime()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('store_cached_candles', {
        symbol: `macro:${symbol}`,
        timeframe: tf,
        candles,
      });
    } catch {
      // Abaikan error tulis SQLite latar belakang.
    }
  }

  /**
   * Mengambil seri OHLC sintetis untuk satu indeks makro, memanfaatkan memori dan SQLite cache
   * sebelum melakukan sinkronisasi jaringan komponen.
   */
  public async getMacroCandles(
    rawSymbol: string,
    timeframe: string,
    requestedLimit?: number,
    signal?: AbortSignal
  ): Promise<Candle[]> {
    const canonical = canonicalizeMacroIndexSymbol(rawSymbol);
    if (!canonical) return [];

    const canonicalTf = normalizeMacroTimeframe(timeframe);
    const limit = resolveDefaultHistoryLimit(canonicalTf, requestedLimit);
    const cacheKey = `${canonical}:${canonicalTf}`;

    const mem = this.seriesCache.get(cacheKey);
    if (mem && mem.bars.length > 0 && this.nowFn() - mem.updatedAt < 8000) {
      return mem.bars.slice(-limit);
    }

    const sqliteBars = mem ? [] : await this.tryReadSqlite(canonical, canonicalTf, limit);
    if (sqliteBars.length > 0 && this.nowFn() - (sqliteBars[sqliteBars.length - 1]?.time ?? 0) < 5 * 60_000) {
      this.seriesCache.set(cacheKey, { updatedAt: this.nowFn(), bars: sqliteBars });
      return sqliteBars;
    }

    try {
      const metadata = await this.getMetadataSnapshot(signal);
      const stablecoinHistory = await this.getStablecoinHistory(metadata, signal);
      const componentSeries = await this.fetchAllComponentSeries(
        metadata.constituents,
        canonicalTf,
        limit,
        signal
      );

      const synthesized = buildCompositeMacroBars({
        targetSymbol: canonical,
        metadata,
        stablecoinHistory,
        componentSeries,
      });

      if (synthesized.length > 0) {
        this.seriesCache.set(cacheKey, { updatedAt: this.nowFn(), bars: synthesized });
        void this.tryWriteSqlite(canonical, canonicalTf, synthesized);
        return synthesized.slice(-limit);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }

    return mem?.bars.slice(-limit) ?? sqliteBars;
  }

  /**
   * Mengambil satu snapshot ticker untuk seluruh 7 indeks makro dalam sekali batch ringan ke Binance/Coinbase.
   * Dipanggil eksklusif saat chart indeks makro dibuka aktif.
   */
  public async fetchLiveMacroTickers(signal?: AbortSignal): Promise<Record<string, TickerInfo>> {
    const now = this.nowFn();
    if (this.tickerSnapshotCache && now - this.tickerSnapshotCache.fetchedAt < this.tickerTtlMs) {
      return this.tickerSnapshotCache.tickers;
    }
    if (this.inflightTickers) {
      return this.inflightTickers;
    }

    this.inflightTickers = (async () => {
      const metadata = await this.getMetadataSnapshot(signal);
      const binancePairs = metadata.constituents.map((c) => `${c.symbol}USDT`);
      const spotNow = new Map<string, number>();
      const spotOpen24h = new Map<string, number>();

      if (binancePairs.length > 0) {
        const symbolsParam = encodeURIComponent(JSON.stringify(binancePairs));
        try {
          const res = await this.fetchFn(
            `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`,
            { timeoutMs: this.requestTimeoutMs, signal }
          );
          if (res.ok) {
            const rows = (await res.json()) as any[];
            if (Array.isArray(rows)) {
              for (const row of rows) {
                const pair = String(row?.symbol || '').toUpperCase();
                if (!pair.endsWith('USDT')) continue;
                const sym = pair.slice(0, -4);
                const lastPrice = Number(row?.lastPrice);
                const openPrice = Number(row?.openPrice) || lastPrice;
                if (Number.isFinite(lastPrice) && lastPrice > 0) {
                  spotNow.set(sym, lastPrice);
                  spotOpen24h.set(sym, openPrice > 0 ? openPrice : lastPrice);
                }
              }
            }
          }
        } catch {
          // Lanjut ke fallback metadata bila batch Binance bermasalah.
        }
      }

      // Isi koin tanpa data Binance memakai Coinbase atau harga terakhir di metadata agar rasio stabil.
      const missing = metadata.constituents.filter((c) => !spotNow.has(c.symbol));
      if (missing.length > 0 && missing.length <= 8) {
        await Promise.all(
          missing.map(async (c) => {
            try {
              const res = await this.fetchFn(
                `https://api.exchange.coinbase.com/products/${encodeURIComponent(`${c.symbol}-USD`)}/stats`,
                { timeoutMs: this.requestTimeoutMs, signal }
              );
              if (res.ok) {
                const stats = await res.json();
                const last = Number(stats?.last);
                const open = Number(stats?.open) || last;
                if (Number.isFinite(last) && last > 0) {
                  spotNow.set(c.symbol, last);
                  spotOpen24h.set(c.symbol, open > 0 ? open : last);
                  return;
                }
              }
            } catch {
              // Abaikan per koin dan fallback ke harga metadata.
            }
            if (c.currentPriceUsd > 0) {
              spotNow.set(c.symbol, c.currentPriceUsd);
              spotOpen24h.set(c.symbol, c.currentPriceUsd);
            }
          })
        );
      } else {
        for (const c of missing) {
          if (c.currentPriceUsd > 0) {
            spotNow.set(c.symbol, c.currentPriceUsd);
            spotOpen24h.set(c.symbol, c.currentPriceUsd);
          }
        }
      }

      const activeSymbols = new Set(spotNow.keys());
      const altMultiplier = computeAltCalibrationMultiplier(metadata, activeSymbols, spotNow);

      const computeSnapshotAt = (priceMap: Map<string, number>) => {
        let btc = 0;
        let eth = 0;
        let alts = 0;
        let top10Vol = 0;
        for (const c of metadata.constituents) {
          const p = priceMap.get(c.symbol);
          if (!p || p <= 0) continue;
          const cap = p * c.circulatingSupply;
          if (c.symbol === 'BTC') btc = cap;
          else if (c.symbol === 'ETH') eth = cap;
          else alts += cap * altMultiplier;
          if (c.inTop10) top10Vol += cap;
        }
        const stable = metadata.currentTotalStablecoinCapUsd;
        const usdt = metadata.currentUsdtCapUsd;
        const total = btc + eth + alts + stable;
        const top10Total = top10Vol + metadata.top10StablecoinCapUsd;

        const values: Record<CanonicalMacroSymbol, number> = {
          TOTAL: total,
          TOTAL2: Math.max(0, total - btc),
          TOTAL3: Math.max(0, total - btc - eth),
          OTHERS: Math.max(0, total - top10Total),
          'BTC.D': total > 0 ? clamp((btc / total) * 100, 0.01, 100) : 0,
          'ETH.D': total > 0 ? clamp((eth / total) * 100, 0.01, 100) : 0,
          'USDT.D': total > 0 ? clamp((usdt / total) * 100, 0.01, 100) : 0,
        };
        return values;
      };

      const nowValues = computeSnapshotAt(spotNow);
      const prevValues = computeSnapshotAt(spotOpen24h);
      const result: Record<string, TickerInfo> = {};

      for (const desc of MACRO_INDEX_CATALOG) {
        const price = nowValues[desc.symbol] ?? 0;
        const prev = prevValues[desc.symbol] ?? price;
        const change24h = prev > 0 ? ((price - prev) / prev) * 100 : 0;
        result[desc.symbol] = {
          symbol: desc.symbol,
          name: desc.displayName,
          price,
          change24h,
          high24h: Math.max(price, prev),
          low24h: Math.min(price, prev),
          volume24h: 0,
        };
      }

      if (spotNow.size > 0) {
        this.tickerSnapshotCache = { fetchedAt: this.nowFn(), tickers: result };
      }
      return result;
    })();

    try {
      return await this.inflightTickers;
    } finally {
      this.inflightTickers = null;
    }
  }

  /**
   * Menghasilkan atau memperbarui candle terbaru berdasarkan spot ticker terbaru untuk polling aktif.
   */
  public async getLatestLiveBar(
    rawSymbol: string,
    timeframe: string,
    signal?: AbortSignal
  ): Promise<Candle | null> {
    const desc = resolveMacroIndexDescriptor(rawSymbol);
    if (!desc) return null;

    const canonicalTf = normalizeMacroTimeframe(timeframe);
    const cacheKey = `${desc.symbol}:${canonicalTf}`;
    const tickers = await this.fetchLiveMacroTickers(signal);
    const livePrice = tickers[desc.symbol]?.price;
    if (!livePrice || !Number.isFinite(livePrice) || livePrice <= 0) {
      return null;
    }

    const bucketTime = getBarBucketStartMs(this.nowFn(), canonicalTf);
    const series = this.seriesCache.get(cacheKey);
    const lastBar = series?.bars[series.bars.length - 1];

    if (lastBar && lastBar.time === bucketTime) {
      const updated: Candle = {
        time: bucketTime,
        open: lastBar.open,
        high: Math.max(lastBar.high, livePrice),
        low: Math.min(lastBar.low, livePrice),
        close: livePrice,
        volume: 0,
      };
      if (series) {
        series.bars[series.bars.length - 1] = updated;
        series.updatedAt = this.nowFn();
      }
      return updated;
    }

    const openPrice = lastBar ? lastBar.close : livePrice;
    const newBar: Candle = {
      time: bucketTime,
      open: openPrice,
      high: Math.max(openPrice, livePrice),
      low: Math.min(openPrice, livePrice),
      close: livePrice,
      volume: 0,
    };
    if (series) {
      series.bars.push(newBar);
      series.updatedAt = this.nowFn();
    }
    return newBar;
  }

  public getCachedSeriesSnapshot(rawSymbol: string, timeframe: string): Candle[] {
    const canonical = canonicalizeMacroIndexSymbol(rawSymbol);
    if (!canonical) return [];
    const canonicalTf = normalizeMacroTimeframe(timeframe);
    return this.seriesCache.get(`${canonical}:${canonicalTf}`)?.bars ?? [];
  }
}

export const sharedMacroBasketCoordinator = new MacroBasketCoordinator();
