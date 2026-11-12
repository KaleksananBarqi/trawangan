import type { Candle, TickerInfo } from '../types/market';
import {
  MACRO_INDEX_CATALOG,
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
  currentUsdcCapUsd?: number;
  source: 'live' | 'storage_cache' | 'fallback';
}

export interface StablecoinHistoryPoint {
  dayKey: number;
  totalUsd: number;
  usdtUsd: number;
  usdcUsd?: number;
}

export interface ComponentBarSeries {
  symbol: string;
  bars: OHLCV[];
}

export interface CompositeSynthesisInput {
  targetSymbol: CanonicalMacroSymbol;
  metadata: MacroMetadataSnapshot;
  stablecoinHistory: StablecoinHistoryPoint[];
  componentSeries: ComponentBarSeries[];
}

export const MACRO_DAY_MS = 86_400_000;

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

export function clampMacroValue(val: number, min: number, max: number): number {
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

export function toBinanceMacroInterval(canonicalTf: string): string {
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
  if (canonicalTf === '1M') return 30 * MACRO_DAY_MS;
  const sec = TIMEFRAME_SECONDS_MAP[canonicalTf.toLowerCase()];
  return sec ? sec * 1000 : MACRO_DAY_MS;
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
    return utcMidnight - weekdayFromMon * MACRO_DAY_MS;
  }
  const intervalMs = getTimeframeIntervalMs(canonicalTf);
  return Math.floor(timestampMs / intervalMs) * intervalMs;
}

export function resolveDefaultMacroHistoryLimit(canonicalTf: string, requested?: number): number {
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

export function resampleMacroByCalendar(candles: OHLCV[], canonicalTf: string): OHLCV[] {
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
      };
    } else {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
    }
  }
  if (current) result.push(current);
  return result;
}

export function findStablecoinPointForTimestamp(
  history: StablecoinHistoryPoint[],
  timestampMs: number,
  fallbackTotal: number,
  fallbackUsdt: number,
  fallbackUsdc = 0
): { totalUsd: number; usdtUsd: number; usdcUsd: number } {
  if (!history.length) {
    return { totalUsd: fallbackTotal, usdtUsd: fallbackUsdt, usdcUsd: fallbackUsdc };
  }
  const targetDay = Math.floor(timestampMs / MACRO_DAY_MS) * MACRO_DAY_MS;

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
      usdcUsd: point.usdcUsd && point.usdcUsd > 0 ? point.usdcUsd : fallbackUsdc,
    };
  }
  return {
    totalUsd: history[0].totalUsd || fallbackTotal,
    usdtUsd: history[0].usdtUsd || fallbackUsdt,
    usdcUsd: history[0].usdcUsd || fallbackUsdc,
  };
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
  return clampMacroValue(targetAltsAndLongTail / activeAltsCapNow, 0.85, 2.2);
}

interface CapSlice {
  btcCap: number;
  ethCap: number;
  calAltCap: number;
  top10AltAndMajorsCap: number;
  stableCap: number;
  usdtCap: number;
  top10StableCap: number;
}

/**
 * Rumus tunggal nilai seluruh 7 indeks makro pada satu titik waktu harga,
 * dipakai bersama oleh sintesis candle historis OHLC dan snapshot ticker 24 jam.
 */
export function computeMacroValuesFromCaps(slice: CapSlice): Record<CanonicalMacroSymbol, number> {
  const total = slice.btcCap + slice.ethCap + slice.calAltCap + slice.stableCap;
  if (total <= 0) {
    return {
      TOTAL: 0,
      TOTAL2: 0,
      TOTAL3: 0,
      OTHERS: 0,
      'BTC.D': 0,
      'ETH.D': 0,
      'USDT.D': 0,
    };
  }

  const top10Total = slice.top10AltAndMajorsCap + slice.top10StableCap;
  return {
    TOTAL: total,
    TOTAL2: Math.max(0, total - slice.btcCap),
    TOTAL3: Math.max(0, total - slice.btcCap - slice.ethCap),
    OTHERS: Math.max(0, total - top10Total),
    'BTC.D': clampMacroValue((slice.btcCap / total) * 100, 0.01, 100),
    'ETH.D': clampMacroValue((slice.ethCap / total) * 100, 0.01, 100),
    'USDT.D': clampMacroValue((slice.usdtCap / total) * 100, 0.01, 100),
  };
}

function resolveHistoricalTop10StableCap(
  stableCap: number,
  usdtCap: number,
  usdcCap: number,
  stableShareTop10Ratio: number
): number {
  if (usdtCap > 0 && usdcCap > 0) {
    return Math.min(stableCap, usdtCap + usdcCap);
  }
  return stableCap * stableShareTop10Ratio;
}

/**
 * Menghitung snapshot seluruh 7 simbol indeks makro dari peta harga spot terkini & referensi 24h.
 */
export function computeLiveMacroTickersFromSpotMaps(
  metadata: MacroMetadataSnapshot,
  spotNow: Map<string, number>,
  spotOpen24h: Map<string, number>
): Record<string, TickerInfo> {
  const activeSymbols = new Set(spotNow.keys());
  const altMultiplier = computeAltCalibrationMultiplier(metadata, activeSymbols, spotNow);

  const evalMap = (priceMap: Map<string, number>) => {
    let btcCap = 0;
    let ethCap = 0;
    let calAltCap = 0;
    let top10AltAndMajorsCap = 0;
    for (const c of metadata.constituents) {
      const p = priceMap.get(c.symbol);
      if (!p || p <= 0) continue;
      const cap = p * c.circulatingSupply;
      if (c.symbol === 'BTC') btcCap = cap;
      else if (c.symbol === 'ETH') ethCap = cap;
      else calAltCap += cap * altMultiplier;
      if (c.inTop10) top10AltAndMajorsCap += cap;
    }
    return computeMacroValuesFromCaps({
      btcCap,
      ethCap,
      calAltCap,
      top10AltAndMajorsCap,
      stableCap: metadata.currentTotalStablecoinCapUsd,
      usdtCap: metadata.currentUsdtCapUsd,
      top10StableCap: metadata.top10StablecoinCapUsd,
    });
  };

  const nowValues = evalMap(spotNow);
  const prevValues = evalMap(spotOpen24h);
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

  return result;
}

/**
 * Menyintesis array OHLC kanonikal indeks makro dari seri klines komponen dan riwayat stablecoin.
 * Membiarkan field `volume` kosong (`undefined`) sesuai kontrak OHLCV bagi indeks non-tradable.
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
      ? clampMacroValue(metadata.top10StablecoinCapUsd / metadata.currentTotalStablecoinCapUsd, 0, 1)
      : 0;

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

    const { totalUsd: stableCap, usdtUsd: usdtCap, usdcUsd: usdcCap } = findStablecoinPointForTimestamp(
      stablecoinHistory,
      t,
      metadata.currentTotalStablecoinCapUsd,
      metadata.currentUsdtCapUsd,
      metadata.currentUsdcCapUsd ?? 0
    );

    const calAltO = altO * altMultiplier;
    const calAltH = altH * altMultiplier;
    const calAltL = altL * altMultiplier;
    const calAltC = altC * altMultiplier;
    const top10Stable = resolveHistoricalTop10StableCap(
      stableCap,
      usdtCap,
      usdcCap,
      stableShareTop10Ratio
    );

    const valsO = computeMacroValuesFromCaps({
      btcCap: btcO,
      ethCap: ethO,
      calAltCap: calAltO,
      top10AltAndMajorsCap: top10VolO,
      stableCap,
      usdtCap,
      top10StableCap: top10Stable,
    });
    const valsC = computeMacroValuesFromCaps({
      btcCap: btcC,
      ethCap: ethC,
      calAltCap: calAltC,
      top10AltAndMajorsCap: top10VolC,
      stableCap,
      usdtCap,
      top10StableCap: top10Stable,
    });
    if (valsC.TOTAL <= 0) continue;

    let barO = valsO[targetSymbol];
    let barC = valsC[targetSymbol];
    let barH: number;
    let barL: number;

    if (targetSymbol === 'BTC.D' || targetSymbol === 'ETH.D') {
      const valsHigh = computeMacroValuesFromCaps({
        btcCap: targetSymbol === 'BTC.D' ? btcH : Math.min(btcO, btcC),
        ethCap: targetSymbol === 'ETH.D' ? ethH : Math.min(ethO, ethC),
        calAltCap: Math.min(calAltO, calAltC),
        top10AltAndMajorsCap: Math.min(top10VolO, top10VolC),
        stableCap,
        usdtCap,
        top10StableCap: top10Stable,
      });
      const valsLow = computeMacroValuesFromCaps({
        btcCap: targetSymbol === 'BTC.D' ? btcL : Math.max(btcO, btcC),
        ethCap: targetSymbol === 'ETH.D' ? ethL : Math.max(ethO, ethC),
        calAltCap: Math.max(calAltO, calAltC),
        top10AltAndMajorsCap: Math.max(top10VolO, top10VolC),
        stableCap,
        usdtCap,
        top10StableCap: top10Stable,
      });
      barH = Math.max(barO, barC, valsHigh[targetSymbol]);
      barL = Math.min(barO, barC, valsLow[targetSymbol]);
    } else if (targetSymbol === 'USDT.D') {
      // USDT.D memiliki pembilang konstan harian sehingga wick atas muncul saat total pasar terkoreksi intraday.
      const valsLowMarket = computeMacroValuesFromCaps({
        btcCap: btcL,
        ethCap: ethL,
        calAltCap: calAltL,
        top10AltAndMajorsCap: top10VolL,
        stableCap,
        usdtCap,
        top10StableCap: top10Stable,
      });
      const valsHighMarket = computeMacroValuesFromCaps({
        btcCap: btcH,
        ethCap: ethH,
        calAltCap: calAltH,
        top10AltAndMajorsCap: top10VolH,
        stableCap,
        usdtCap,
        top10StableCap: top10Stable,
      });
      barH = Math.max(barO, barC, valsLowMarket['USDT.D']);
      barL = Math.min(barO, barC, valsHighMarket['USDT.D']);
    } else {
      const valsHigh = computeMacroValuesFromCaps({
        btcCap: btcH,
        ethCap: ethH,
        calAltCap: calAltH,
        top10AltAndMajorsCap: top10VolH,
        stableCap,
        usdtCap,
        top10StableCap: top10Stable,
      });
      const valsLow = computeMacroValuesFromCaps({
        btcCap: btcL,
        ethCap: ethL,
        calAltCap: calAltL,
        top10AltAndMajorsCap: top10VolL,
        stableCap,
        usdtCap,
        top10StableCap: top10Stable,
      });
      barH = Math.max(barO, barC, valsHigh[targetSymbol]);
      barL = Math.min(barO, barC, valsLow[targetSymbol]);
    }

    result.push({
      time: t,
      open: barO,
      high: barH,
      low: barL,
      close: barC,
    });
  }

  return result;
}
