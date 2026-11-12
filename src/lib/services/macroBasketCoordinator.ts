import type { Candle, TickerInfo } from '../types/market';
import { universalFetch, type UniversalFetchOptions, type UniversalResponse } from './httpClient';
import {
  canonicalizeMacroIndexSymbol,
  FALLBACK_MACRO_CONSTITUENTS,
  FALLBACK_TOTAL_STABLECOIN_CAP_USD,
  FALLBACK_USDT_CAP_USD,
  isMacroStablecoin,
  isMacroWrappedOrDuplicate,
  resolveMacroIndexDescriptor,
  type CanonicalMacroSymbol,
} from './macroIndexCatalog';
import {
  buildCompositeMacroBars,
  clampMacroValue,
  computeLiveMacroTickersFromSpotMaps,
  getBarBucketStartMs,
  getTimeframeIntervalMs,
  MACRO_DAY_MS,
  normalizeMacroTimeframe,
  resampleMacroByCalendar,
  resolveDefaultMacroHistoryLimit,
  toBinanceMacroInterval,
  type ComponentBarSeries,
  type MacroBasketConstituent,
  type MacroMetadataSnapshot,
  type StablecoinHistoryPoint,
} from './macroBasketMath';
import type { OHLCV } from './yahooFinanceProvider';
import { isTauriEnvironment } from '../utils/tauriEnv';

export * from './macroBasketMath';

export type MacroFetchFn = (url: string, options?: UniversalFetchOptions) => Promise<UniversalResponse>;

export interface MacroFeedHealthObserver {
  isBinanceBlocked?: () => boolean;
  reportStreamState?: (
    sourceKey: string,
    providerId: string,
    state: 'connected' | 'stalled' | 'blocked',
    message?: string
  ) => void;
}

export interface MacroSeriesCacheMeta {
  fetchedAt: number;
  barCount: number;
  newestBarTime: number;
}

export interface MacroCandlesRequestOptions {
  onBackgroundRefresh?: (freshBars: Candle[]) => void;
}

export interface MacroCoordinatorOptions {
  fetchFn?: MacroFetchFn;
  nowFn?: () => number;
  loadSqliteCache?: (symbol: string, timeframe: string, limit: number) => Promise<Candle[]>;
  saveSqliteCache?: (symbol: string, timeframe: string, candles: Candle[]) => Promise<void>;
  disableLocalStorage?: boolean;
  metadataTtlMs?: number;
  stablecoinTtlMs?: number;
  tickerTtlMs?: number;
  seriesFreshTtlMs?: number;
  requestTimeoutMs?: number;
  maxConcurrentKlines?: number;
  feedHealth?: MacroFeedHealthObserver;
}

const METADATA_STORAGE_KEY = 'trawangan_macro_metadata_v1';
const CACHE_META_STORAGE_KEY = 'trawangan_macro_cache_meta_v1';
const COINBASE_VALID_GRANULARITIES = [60, 300, 900, 3600, 21600, 86400];
const COINBASE_MAX_BARS_PER_PAGE = 300;
const COINBASE_MAX_PAGES = 6;
const FALLBACK_USDC_CAP_USD = 55_000_000_000;
const BINANCE_DEGRADED_COOLDOWN_MS = 60_000;

function stripSyntheticVolume(candle: Candle): Candle {
  if (candle.volume === undefined) return candle;
  const { volume: _ignored, ...ohlc } = candle;
  return ohlc;
}

function parseLlamaTokenSeries(payload: unknown): Map<number, number> {
  const byDay = new Map<number, number>();
  const tokens = Array.isArray((payload as any)?.tokens) ? (payload as any).tokens : [];
  for (const entry of tokens) {
    const rawTs = Number(entry?.date);
    const val = Number(entry?.circulating?.peggedUSD);
    if (!Number.isFinite(rawTs) || !Number.isFinite(val) || val <= 0) continue;
    const tsMs = rawTs < 1e11 ? rawTs * 1000 : rawTs;
    const dayKey = Math.floor(tsMs / MACRO_DAY_MS) * MACRO_DAY_MS;
    byDay.set(dayKey, val);
  }
  return byDay;
}

function parseBinanceKlines(rows: unknown): OHLCV[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows
    .map((k: any) => ({
      time: Number(k?.[0]),
      open: Number(k?.[1]),
      high: Number(k?.[2]),
      low: Number(k?.[3]),
      close: Number(k?.[4]),
      volume: Number(k?.[5]) || 0,
    }))
    .filter((b) => Number.isFinite(b.time) && Number.isFinite(b.close) && b.close > 0);
}

function parseCoinbaseCandles(rows: unknown): OHLCV[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const parsed: OHLCV[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const tsSec = Number(row[0]);
    const low = Number(row[1]);
    const high = Number(row[2]);
    const open = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5] ?? 0);
    if (!Number.isFinite(tsSec) || !Number.isFinite(close) || close <= 0) continue;
    parsed.push({
      time: tsSec * 1000,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  parsed.sort((a, b) => a.time - b.time);
  return parsed;
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
  private seriesFreshTtlMs?: number;
  private requestTimeoutMs: number;
  private maxConcurrentKlines: number;
  private feedHealth?: MacroFeedHealthObserver;

  private metadataCache: MacroMetadataSnapshot | null = null;
  private stablecoinCache: { fetchedAt: number; points: StablecoinHistoryPoint[] } | null = null;
  private componentCache = new Map<string, { fetchedAt: number; series: ComponentBarSeries[] }>();
  private seriesCache = new Map<string, { updatedAt: number; bars: Candle[] }>();
  private seriesMetaCache = new Map<string, MacroSeriesCacheMeta>();
  private tickerSnapshotCache: { fetchedAt: number; tickers: Record<string, TickerInfo> } | null = null;
  private inflightSlots = new Map<string, Promise<unknown>>();
  private binanceDegradedUntil = 0;

  constructor(options: MacroCoordinatorOptions = {}) {
    this.fetchFn = options.fetchFn ?? universalFetch;
    this.nowFn = options.nowFn ?? (() => Date.now());
    this.loadSqliteCache = options.loadSqliteCache;
    this.saveSqliteCache = options.saveSqliteCache;
    this.disableLocalStorage = options.disableLocalStorage ?? false;
    this.metadataTtlMs = options.metadataTtlMs ?? 15 * 60 * 1000;
    this.stablecoinTtlMs = options.stablecoinTtlMs ?? 30 * 60 * 1000;
    this.tickerTtlMs = options.tickerTtlMs ?? 8000;
    this.seriesFreshTtlMs = options.seriesFreshTtlMs;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 9000;
    this.maxConcurrentKlines = options.maxConcurrentKlines ?? 6;
    this.feedHealth = options.feedHealth;
  }

  /**
   * Menyuntikkan observer Feed Connection Guard setelah inisialisasi MarketFeedService.
   */
  public setFeedHealthObserver(observer: MacroFeedHealthObserver): void {
    this.feedHealth = observer;
  }

  private shouldPreferCoinbase(): boolean {
    if (this.feedHealth?.isBinanceBlocked?.()) return true;
    return this.nowFn() < this.binanceDegradedUntil;
  }

  private markBinanceDegraded(isBlockedHttp = false): void {
    this.binanceDegradedUntil = this.nowFn() + BINANCE_DEGRADED_COOLDOWN_MS;
    this.feedHealth?.reportStreamState?.(
      'macro:binance-fallback',
      'binance',
      isBlockedHttp ? 'blocked' : 'stalled',
      'Binance gagal diakses dari feeder makro; beralih sementara ke Coinbase.'
    );
  }

  private markBinanceHealthy(): void {
    if (this.binanceDegradedUntil > 0 && this.nowFn() >= this.binanceDegradedUntil) {
      this.binanceDegradedUntil = 0;
    }
    this.feedHealth?.reportStreamState?.('macro:binance-fallback', 'binance', 'connected');
  }

  private async runCachedSingleflight<T>(
    slot: string,
    ttlMs: number,
    cached: { fetchedAt: number; value: T } | null,
    loader: () => Promise<T>
  ): Promise<T> {
    if (cached && this.nowFn() - cached.fetchedAt < ttlMs) {
      return cached.value;
    }
    const existing = this.inflightSlots.get(slot) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }
    const pending = loader().finally(() => {
      this.inflightSlots.delete(slot);
    });
    this.inflightSlots.set(slot, pending);
    return await pending;
  }

  private async runWithConcurrency<T>(
    items: readonly T[],
    workerFn: (item: T) => Promise<void>,
    signal?: AbortSignal
  ): Promise<void> {
    if (items.length === 0) return;
    const queue = [...items];
    const workerCount = Math.max(1, Math.min(this.maxConcurrentKlines, queue.length));
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
          if (signal?.aborted) return;
          const next = queue.shift();
          if (!next) return;
          await workerFn(next);
        }
      })
    );
  }

  private resolveSeriesFreshTtlMs(canonicalTf: string): number {
    if (this.seriesFreshTtlMs !== undefined) return this.seriesFreshTtlMs;
    return getTimeframeIntervalMs(canonicalTf) >= MACRO_DAY_MS ? 15 * 60_000 : 5 * 60_000;
  }

  private readSeriesCacheMeta(symbol: CanonicalMacroSymbol, tf: string): MacroSeriesCacheMeta | null {
    const key = `${symbol}:${tf}`;
    const inMem = this.seriesMetaCache.get(key);
    if (inMem) return inMem;
    if (this.disableLocalStorage || typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CACHE_META_STORAGE_KEY);
      if (!raw) return null;
      const map = JSON.parse(raw) as Record<string, MacroSeriesCacheMeta>;
      const entry = map?.[key];
      if (entry && Number.isFinite(entry.fetchedAt)) {
        this.seriesMetaCache.set(key, entry);
        return entry;
      }
    } catch {
      // Abaikan localStorage metadata yang rusak.
    }
    return null;
  }

  private writeSeriesCacheMeta(
    symbol: CanonicalMacroSymbol,
    tf: string,
    fetchedAt: number,
    candles: Candle[]
  ): void {
    const key = `${symbol}:${tf}`;
    const entry: MacroSeriesCacheMeta = {
      fetchedAt,
      barCount: candles.length,
      newestBarTime: candles[candles.length - 1]?.time ?? 0,
    };
    this.seriesMetaCache.set(key, entry);
    if (this.disableLocalStorage || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(CACHE_META_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, MacroSeriesCacheMeta>) : {};
      const next = parsed && typeof parsed === 'object' ? parsed : {};
      next[key] = entry;
      localStorage.setItem(CACHE_META_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Abaikan quota error pada WebView.
    }
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
      top10StablecoinCapUsd: FALLBACK_USDT_CAP_USD + FALLBACK_USDC_CAP_USD,
      currentTotalStablecoinCapUsd: FALLBACK_TOTAL_STABLECOIN_CAP_USD,
      currentUsdtCapUsd: FALLBACK_USDT_CAP_USD,
      currentUsdcCapUsd: FALLBACK_USDC_CAP_USD,
      source: 'fallback',
    };
  }

  public async getMetadataSnapshot(signal?: AbortSignal): Promise<MacroMetadataSnapshot> {
    return this.runCachedSingleflight(
      'metadata',
      this.metadataTtlMs,
      this.metadataCache ? { fetchedAt: this.metadataCache.fetchedAt, value: this.metadataCache } : null,
      async () => {
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
              let usdcCap = 0;

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
                  if (rawSym === 'USDC') usdcCap = mcap;
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
                const resolvedTotalStable =
                  totalStableCap > 0 ? totalStableCap : FALLBACK_TOTAL_STABLECOIN_CAP_USD;
                const resolvedUsdt = usdtCap > 0 ? usdtCap : FALLBACK_USDT_CAP_USD;
                const resolvedUsdc = usdcCap > 0 ? usdcCap : FALLBACK_USDC_CAP_USD;
                const snap: MacroMetadataSnapshot = {
                  fetchedAt: this.nowFn(),
                  totalGlobalMarketCapUsd: totalGlobalCap,
                  constituents,
                  top10StablecoinCapUsd:
                    top10StableCap > 0 ? top10StableCap : resolvedUsdt + resolvedUsdc,
                  currentTotalStablecoinCapUsd: resolvedTotalStable,
                  currentUsdtCapUsd: resolvedUsdt,
                  currentUsdcCapUsd: resolvedUsdc,
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
      }
    );
  }

  public async getStablecoinHistory(
    metadata: MacroMetadataSnapshot,
    signal?: AbortSignal
  ): Promise<StablecoinHistoryPoint[]> {
    return this.runCachedSingleflight(
      'stablecoin',
      this.stablecoinTtlMs,
      this.stablecoinCache
        ? { fetchedAt: this.stablecoinCache.fetchedAt, value: this.stablecoinCache.points }
        : null,
      async () => {
        try {
          const [allSettled, usdtSettled, usdcSettled] = await Promise.allSettled([
            this.fetchFn('https://stablecoins.llama.fi/stablecoincharts/all', {
              timeoutMs: this.requestTimeoutMs,
              signal,
            }),
            this.fetchFn('https://stablecoins.llama.fi/stablecoin/1', {
              timeoutMs: this.requestTimeoutMs,
              signal,
            }),
            this.fetchFn('https://stablecoins.llama.fi/stablecoin/2', {
              timeoutMs: this.requestTimeoutMs,
              signal,
            }),
          ]);

          const readLlamaMap = async (res: PromiseSettledResult<UniversalResponse>): Promise<Map<number, number>> => {
            if (res.status !== 'fulfilled' || !res.value?.ok) return new Map();
            try {
              return parseLlamaTokenSeries(await res.value.json());
            } catch {
              return new Map();
            }
          };

          const [usdtByDay, usdcByDay] = await Promise.all([
            readLlamaMap(usdtSettled),
            readLlamaMap(usdcSettled),
          ]);

          if (allSettled.status === 'fulfilled' && allSettled.value?.ok) {
            const allRows = (await allSettled.value.json()) as any[];
            if (Array.isArray(allRows) && allRows.length > 0) {
              const usdtShare =
                metadata.currentTotalStablecoinCapUsd > 0
                  ? clampMacroValue(
                      metadata.currentUsdtCapUsd / metadata.currentTotalStablecoinCapUsd,
                      0.4,
                      0.9
                    )
                  : 0.65;
              const currentUsdc = metadata.currentUsdcCapUsd ?? 0;
              const usdcShare =
                metadata.currentTotalStablecoinCapUsd > 0 && currentUsdc > 0
                  ? clampMacroValue(currentUsdc / metadata.currentTotalStablecoinCapUsd, 0.05, 0.5)
                  : 0.22;

              const points: StablecoinHistoryPoint[] = [];
              let lastUsdt = metadata.currentUsdtCapUsd;
              let lastUsdc = currentUsdc;

              for (const row of allRows) {
                const rawTs = Number(row?.date);
                const totalVal = Number(row?.totalCirculatingUSD?.peggedUSD ?? row?.totalCirculating?.peggedUSD);
                if (!Number.isFinite(rawTs) || !Number.isFinite(totalVal) || totalVal <= 0) continue;
                const tsMs = rawTs < 1e11 ? rawTs * 1000 : rawTs;
                const dayKey = Math.floor(tsMs / MACRO_DAY_MS) * MACRO_DAY_MS;
                const exactUsdt = usdtByDay.get(dayKey);
                if (exactUsdt && exactUsdt > 0) lastUsdt = exactUsdt;
                const exactUsdc = usdcByDay.get(dayKey);
                if (exactUsdc && exactUsdc > 0) lastUsdc = exactUsdc;

                points.push({
                  dayKey,
                  totalUsd: totalVal,
                  usdtUsd: exactUsdt && exactUsdt > 0 ? exactUsdt : lastUsdt > 0 ? lastUsdt : totalVal * usdtShare,
                  usdcUsd:
                    exactUsdc && exactUsdc > 0
                      ? exactUsdc
                      : lastUsdc > 0
                        ? lastUsdc
                        : usdcByDay.size > 0
                          ? totalVal * usdcShare
                          : undefined,
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
            usdcUsd: metadata.currentUsdcCapUsd,
          },
        ];
        this.stablecoinCache = { fetchedAt: this.nowFn(), points: fallbackPoints };
        return fallbackPoints;
      }
    );
  }

  private async fetchCoinbasePaginatedKlines(
    symbol: string,
    canonicalTf: string,
    limit: number,
    signal?: AbortSignal
  ): Promise<OHLCV[]> {
    const desiredSec = Math.round(getTimeframeIntervalMs(canonicalTf) / 1000);
    let cbGranularity = 86400;
    for (const candidate of COINBASE_VALID_GRANULARITIES) {
      if (candidate <= desiredSec) cbGranularity = candidate;
    }

    const scaleFactor =
      canonicalTf === '1W' || canonicalTf === '1M' || cbGranularity !== desiredSec
        ? Math.max(1, Math.round(desiredSec / cbGranularity))
        : 1;
    const targetRawBars = Math.min(COINBASE_MAX_BARS_PER_PAGE * COINBASE_MAX_PAGES, limit * scaleFactor);
    const maxPages = Math.min(
      COINBASE_MAX_PAGES,
      Math.max(1, Math.ceil(targetRawBars / COINBASE_MAX_BARS_PER_PAGE))
    );

    const baseUrl = `https://api.exchange.coinbase.com/products/${encodeURIComponent(
      `${symbol.toUpperCase()}-USD`
    )}/candles?granularity=${cbGranularity}`;
    const collectedByTime = new Map<number, OHLCV>();
    let cursorEndMs: number | null = null;
    const minWindowMs =
      canonicalTf === '1D' ? this.nowFn() - 365 * MACRO_DAY_MS : 0;

    try {
      for (let page = 0; page < maxPages; page++) {
        if (signal?.aborted) break;
        let url = baseUrl;
        if (page > 0 && cursorEndMs !== null) {
          const endIso = new Date(cursorEndMs).toISOString();
          const startIso = new Date(
            cursorEndMs - COINBASE_MAX_BARS_PER_PAGE * cbGranularity * 1000
          ).toISOString();
          url = `${baseUrl}&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
        }

        const cbRes = await this.fetchFn(url, { timeoutMs: this.requestTimeoutMs, signal });
        if (!cbRes.ok) break;
        const cbRows = (await cbRes.json()) as any[];
        if (!Array.isArray(cbRows) || cbRows.length === 0) break;

        const pageBars = parseCoinbaseCandles(cbRows);
        if (pageBars.length === 0) break;

        for (const bar of pageBars) {
          collectedByTime.set(bar.time, bar);
        }

        // Hentikan paginasi seketika bila endpoint tidak mengisi penuh 300 bar (ujung riwayat atau mock uji).
        if (cbRows.length < COINBASE_MAX_BARS_PER_PAGE) break;
        if (collectedByTime.size >= targetRawBars) break;

        const oldestTs = pageBars[0].time;
        if (minWindowMs > 0 && oldestTs <= minWindowMs) break;
        cursorEndMs = oldestTs - cbGranularity * 1000;
      }

      const ascending = Array.from(collectedByTime.values()).sort((a, b) => a.time - b.time);
      if (ascending.length === 0) return [];
      if (canonicalTf === '1W' || canonicalTf === '1M' || cbGranularity !== desiredSec) {
        return resampleMacroByCalendar(ascending, canonicalTf).slice(-limit);
      }
      return ascending.slice(-limit);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return [];
    }
  }

  private async fetchSingleComponentKlines(
    symbol: string,
    canonicalTf: string,
    limit: number,
    signal?: AbortSignal
  ): Promise<{ bars: OHLCV[]; source: 'binance' | 'coinbase' | 'none'; binanceHttp451: boolean }> {
    let binanceHttp451 = false;

    if (!this.shouldPreferCoinbase()) {
      const binanceInterval = toBinanceMacroInterval(canonicalTf);
      const binancePair = `${symbol.toUpperCase()}USDT`;
      const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=${encodeURIComponent(
        binanceInterval
      )}&limit=${limit}`;

      try {
        const res = await this.fetchFn(binanceUrl, { timeoutMs: this.requestTimeoutMs, signal });
        if (res.status === 451) {
          binanceHttp451 = true;
        }
        if (res.ok) {
          const parsed = parseBinanceKlines(await res.json());
          if (parsed.length > 0) {
            return { bars: parsed, source: 'binance', binanceHttp451: false };
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
      }
    }

    const cbBars = await this.fetchCoinbasePaginatedKlines(symbol, canonicalTf, limit, signal);
    return {
      bars: cbBars,
      source: cbBars.length > 0 ? 'coinbase' : 'none',
      binanceHttp451,
    };
  }

  public async fetchAllComponentSeries(
    constituents: MacroBasketConstituent[],
    canonicalTf: string,
    limit: number,
    signal?: AbortSignal
  ): Promise<ComponentBarSeries[]> {
    const cacheKey = `${canonicalTf}:${limit}`;
    const cached = this.componentCache.get(cacheKey);
    const cacheTtl = getTimeframeIntervalMs(canonicalTf) >= MACRO_DAY_MS ? 60_000 : 15_000;
    if (cached && this.nowFn() - cached.fetchedAt < cacheTtl) {
      return cached.series;
    }

    const results: ComponentBarSeries[] = [];
    let binanceOkCount = 0;
    let binanceFailCount = 0;
    let saw451 = false;

    await this.runWithConcurrency(
      constituents,
      async (next) => {
        const fetched = await this.fetchSingleComponentKlines(next.symbol, canonicalTf, limit, signal);
        if (fetched.source === 'binance') {
          binanceOkCount++;
        } else {
          binanceFailCount++;
          if (fetched.binanceHttp451) saw451 = true;
        }
        if (fetched.bars.length > 0) {
          results.push({ symbol: next.symbol, bars: fetched.bars });
        }
      },
      signal
    );

    if (binanceOkCount > 0) {
      this.markBinanceHealthy();
    } else if (binanceFailCount >= Math.min(3, constituents.length) && constituents.length > 0) {
      this.markBinanceDegraded(saw451);
    }

    if (results.length > 0) {
      this.componentCache.set(cacheKey, { fetchedAt: this.nowFn(), series: results });
    }
    return results;
  }

  private async tryReadSqlite(symbol: CanonicalMacroSymbol, tf: string, limit: number): Promise<Candle[]> {
    let loaded: Candle[] = [];
    if (this.loadSqliteCache) {
      try {
        loaded = await this.loadSqliteCache(`macro:${symbol}`, tf, limit);
      } catch {
        return [];
      }
    } else if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        loaded = await invoke<Candle[]>('load_cached_candles', {
          symbol: `macro:${symbol}`,
          timeframe: tf,
          limit,
        });
      } catch {
        return [];
      }
    }
    return loaded.map(stripSyntheticVolume);
  }

  private async tryWriteSqlite(symbol: CanonicalMacroSymbol, tf: string, candles: Candle[]): Promise<void> {
    if (candles.length === 0) return;
    this.writeSeriesCacheMeta(symbol, tf, this.nowFn(), candles);

    if (this.saveSqliteCache) {
      try {
        await this.saveSqliteCache(`macro:${symbol}`, tf, candles);
      } catch {
        // Kegagalan cache disk tidak boleh mematahkan rendering chart.
      }
      return;
    }
    if (!isTauriEnvironment()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Skema SQLite Rust menuntut kolom volume bertipe f64 NOT NULL, jadi dinormalkan ke 0 di batas IPC.
      const ipcCandles = candles.map((c) => ({ ...c, volume: c.volume ?? 0 }));
      await invoke('store_cached_candles', {
        symbol: `macro:${symbol}`,
        timeframe: tf,
        candles: ipcCandles,
      });
    } catch {
      // Abaikan error tulis SQLite latar belakang.
    }
  }

  private async synthesizeAndPersistSeries(
    canonical: CanonicalMacroSymbol,
    canonicalTf: string,
    limit: number,
    signal?: AbortSignal
  ): Promise<Candle[]> {
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
      this.seriesCache.set(`${canonical}:${canonicalTf}`, {
        updatedAt: this.nowFn(),
        bars: synthesized,
      });
      await this.tryWriteSqlite(canonical, canonicalTf, synthesized);
      this.feedHealth?.reportStreamState?.('macro:synthesis', 'macro', 'connected');
      return synthesized.slice(-limit);
    }

    this.feedHealth?.reportStreamState?.(
      'macro:synthesis',
      'macro',
      'stalled',
      'Sintesis basket makro belum memperoleh data komponen yang cukup.'
    );
    return [];
  }

  /**
   * Mengambil seri OHLC sintetis untuk satu indeks makro, memanfaatkan memori dan SQLite cache
   * berbasis timestamp fetch sebelum melakukan sinkronisasi jaringan komponen.
   */
  public async getMacroCandles(
    rawSymbol: string,
    timeframe: string,
    requestedLimit?: number,
    signal?: AbortSignal,
    options?: MacroCandlesRequestOptions
  ): Promise<Candle[]> {
    const canonical = canonicalizeMacroIndexSymbol(rawSymbol);
    if (!canonical) return [];

    const canonicalTf = normalizeMacroTimeframe(timeframe);
    const limit = resolveDefaultMacroHistoryLimit(canonicalTf, requestedLimit);
    const cacheKey = `${canonical}:${canonicalTf}`;

    const mem = this.seriesCache.get(cacheKey);
    if (mem && mem.bars.length > 0 && this.nowFn() - mem.updatedAt < 8000) {
      return mem.bars.slice(-limit);
    }

    const sqliteBars = await this.tryReadSqlite(canonical, canonicalTf, limit);
    const cachedBars = sqliteBars.length > 0 ? sqliteBars : (mem?.bars.slice(-limit) ?? []);
    if (cachedBars.length > 0) {
      const meta = this.readSeriesCacheMeta(canonical, canonicalTf);
      const isFresh = meta
        ? this.nowFn() - meta.fetchedAt < this.resolveSeriesFreshTtlMs(canonicalTf)
        : this.nowFn() - (cachedBars[cachedBars.length - 1]?.time ?? 0) < 5 * 60_000;

      if (isFresh) {
        this.seriesCache.set(cacheKey, { updatedAt: this.nowFn(), bars: cachedBars });
        return cachedBars;
      }

      if (options?.onBackgroundRefresh && !signal?.aborted) {
        void this.synthesizeAndPersistSeries(canonical, canonicalTf, limit, signal)
          .then((fresh) => {
            if (fresh.length > 0 && !signal?.aborted) {
              options.onBackgroundRefresh?.(fresh);
            }
          })
          .catch(() => {});
        return cachedBars;
      }
    }

    try {
      const synthesized = await this.synthesizeAndPersistSeries(canonical, canonicalTf, limit, signal);
      if (synthesized.length > 0) {
        return synthesized;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }

    return mem?.bars.slice(-limit) ?? sqliteBars;
  }

  /**
   * Mengambil satu snapshot ticker untuk seluruh 7 indeks makro dalam sekali batch ke Binance/Coinbase.
   * Dipanggil eksklusif saat chart indeks makro dibuka aktif.
   */
  public async fetchLiveMacroTickers(signal?: AbortSignal): Promise<Record<string, TickerInfo>> {
    return this.runCachedSingleflight(
      'tickers',
      this.tickerTtlMs,
      this.tickerSnapshotCache
        ? { fetchedAt: this.tickerSnapshotCache.fetchedAt, value: this.tickerSnapshotCache.tickers }
        : null,
      async () => {
        const metadata = await this.getMetadataSnapshot(signal);
        const binancePairs = metadata.constituents.map((c) => `${c.symbol}USDT`);
        const spotNow = new Map<string, number>();
        const spotOpen24h = new Map<string, number>();

        if (binancePairs.length > 0 && !this.shouldPreferCoinbase()) {
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
              if (spotNow.size > 0) {
                this.markBinanceHealthy();
              }
            } else {
              this.markBinanceDegraded(res.status === 451);
            }
          } catch {
            this.markBinanceDegraded(false);
          }
        }

        // Lengkapi seluruh koin yang belum punya harga Binance memakai Coinbase stats atau fallback metadata.
        const missing = metadata.constituents.filter((c) => !spotNow.has(c.symbol));
        if (missing.length > 0) {
          await this.runWithConcurrency(
            missing,
            async (c) => {
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
            },
            signal
          );
        }

        const result = computeLiveMacroTickersFromSpotMaps(metadata, spotNow, spotOpen24h);
        if (spotNow.size > 0) {
          this.tickerSnapshotCache = { fetchedAt: this.nowFn(), tickers: result };
        }
        return result;
      }
    );
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
