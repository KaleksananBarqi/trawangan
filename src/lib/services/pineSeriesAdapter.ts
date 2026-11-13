/**
 * Adapter Inter-Symbol Resolution untuk Mesin Skrip Pine (Ticket #197)
 *
 * Mengizinkan fungsi Pine Script seperti `request.security(symbol, timeframe, ...)`
 * menyelesaikan simbol eksternal lintas bursa kripto, saham Yahoo Finance, dan indeks makro.
 * Menyediakan caching multi-tier (Memory -> SQLite -> Network Provider) untuk meminimalkan
 * latensi dan mematuhi batasan rate limit.
 */

import { PineWorkerEngine, type PineWorkerOptions } from '@luxalgo/vela-pinets';
import type { Candle } from '../types/market';
import { resolveSymbolProvider, marketFeed } from './market';
import { fromVelaTimeframe, parseQuickTimeframeInput, toExchangeInterval } from '../utils/timeframeAdapter';
import { isTauriEnvironment } from '../utils/tauriEnv';
import { canonicalizeMacroIndexSymbol } from './macroIndexCatalog';

/** Rentang query bar yang diminta oleh Vela */
export interface FetchSeriesRange {
  from?: number;
  to?: number;
  limit?: number;
}

/** Tipe bar gabungan yang mendukung pengaksesan berbasis tuple indeks dan properti objek */
export interface OHLCVBar extends Array<number> {
  0: number; // time
  1: number; // open
  2: number; // high
  3: number; // low
  4: number; // close
  5: number; // volume
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Signature fungsi resolusi deret waktu inter-simbol */
export type FetchSeriesHandler = (
  symbol: string,
  timeframe: string,
  range?: FetchSeriesRange
) => Promise<OHLCVBar[]>;

/** Hasil penguraian ticker Pine */
export interface ParsedSeriesTicker {
  providerId: string;
  cleanSymbol: string;
  rawSymbol: string;
  modifier?: string;
}

/** Konfigurasi opsi pembuat adapter deret Pine */
export interface PineFetchSeriesAdapterOptions {
  sqliteLoader?: (symbol: string, timeframe: string, limit?: number) => Promise<Candle[]>;
  sqliteSaver?: (symbol: string, timeframe: string, candles: Candle[]) => Promise<void>;
  networkFetcher?: (symbol: string, interval: string, limit?: number) => Promise<Candle[]>;
  inMemoryCache?: Map<string, { fetchedAt: number; bars: OHLCVBar[] }>;
  cacheTtlMs?: number;
  defaultProvider?: string;
}

/** Opsi konstruktor mesin worker Pine dengan adapter deret inter-simbol */
export interface PineWorkerEngineOptions extends PineWorkerOptions {
  fetchSeries?: FetchSeriesHandler;
}

/**
 * Mengubah objek lilin pasar (atau array angka) menjadi OHLCVBar dual-interface
 */
export function toOHLCVBar(
  item: Candle | [number, number, number, number, number, number]
): OHLCVBar {
  let t = 0;
  let o = 0;
  let h = 0;
  let l = 0;
  let c = 0;
  let v = 0;

  if (Array.isArray(item)) {
    t = Number(item[0]) || 0;
    o = Number(item[1]) || 0;
    h = Number(item[2]) || 0;
    l = Number(item[3]) || 0;
    c = Number(item[4]) || 0;
    v = Number(item[5]) || 0;
  } else if (item && typeof item === 'object') {
    t = Number(item.time) || 0;
    o = Number(item.open) || 0;
    h = Number(item.high) || 0;
    l = Number(item.low) || 0;
    c = Number(item.close) || 0;
    v = Number(item.volume) || 0;
  }

  const tuple: any = [t, o, h, l, c, v];
  tuple.time = t;
  tuple.open = o;
  tuple.high = h;
  tuple.low = l;
  tuple.close = c;
  tuple.volume = v;

  return tuple as OHLCVBar;
}

/**
 * Mengurai ticker string yang dikirimkan oleh Pine Script
 * Mendukung format:
 * - Prefix bursa: `BINANCE:BTCUSDT`, `YAHOO:^GSPC`, `MACRO:TOTAL`, `INDODAX:BTCIDR`, `BITUNIX:BTCUSDT.P`
 * - Bare ticker: `BTCUSDT`, `^GSPC`, `BBCA.JK`, `TOTAL`, `BTC.D`, `ETHIDR`
 * - Modifier extended: `BINANCE:ETHUSDT;heikinashi`
 */
export function parseSeriesTicker(
  rawSymbol: string,
  defaultProvider = 'binance'
): ParsedSeriesTicker {
  if (!rawSymbol) {
    return { providerId: defaultProvider.toLowerCase(), cleanSymbol: '', rawSymbol: '' };
  }

  let clean = rawSymbol.trim();
  let modifier: string | undefined;

  // Tangani modifier tipe lilin bila disertakan oleh Vela (misal ";heikinashi")
  if (clean.includes(';')) {
    const parts = clean.split(';');
    clean = parts[0].trim();
    modifier = parts[1]?.trim().toLowerCase();
  }

  // Gunakan engine pemecah provider standar Trawangan
  const { providerId, cleanSymbol } = resolveSymbolProvider(clean, defaultProvider);

  // Periksa apakah simbol makro memerlukan kanonikalisasi
  const macroCanon = canonicalizeMacroIndexSymbol(cleanSymbol);
  const effectiveClean = macroCanon || cleanSymbol;
  const effectiveProvider = macroCanon ? 'macro' : providerId;

  return {
    providerId: effectiveProvider,
    cleanSymbol: effectiveClean,
    rawSymbol: clean,
    ...(modifier ? { modifier } : {}),
  };
}

/**
 * Menormalisasi representasi timeframe dari Pine Script ke format interval standar Trawangan
 */
export function normalizeSeriesTimeframe(timeframe: string): string {
  if (!timeframe || !timeframe.trim()) {
    return '15m';
  }

  const trimmed = timeframe.trim();

  // Konversi angka menit mentah Vela / PineTS (misal "1", "15", "60", "240")
  const fromVela = fromVelaTimeframe(trimmed);
  if (fromVela && fromVela !== trimmed) {
    return fromVela;
  }

  return parseQuickTimeframeInput(trimmed);
}

/**
 * Menyaring deret lilin berdasarkan batas range (from, to, limit) secara kronologis ascending
 */
export function applyRangeBounds(
  bars: OHLCVBar[],
  range?: FetchSeriesRange
): OHLCVBar[] {
  if (!bars || bars.length === 0) return [];

  let result = bars;

  if (range) {
    if (typeof range.from === 'number') {
      const fromTime = range.from;
      result = result.filter((b) => b.time >= fromTime);
    }

    if (typeof range.to === 'number') {
      const toTime = range.to;
      result = result.filter((b) => b.time <= toTime);
    }

    if (typeof range.limit === 'number' && range.limit > 0 && result.length > range.limit) {
      result = result.slice(-range.limit);
    }
  }

  return result;
}

/**
 * Pemuat lilin dari SQLite lokal bawaan Tauri
 */
async function defaultTauriSqliteLoader(
  symbol: string,
  timeframe: string,
  limit = 500
): Promise<Candle[]> {
  if (!isTauriEnvironment()) return [];
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<Candle[]>('load_cached_candles', {
      symbol,
      timeframe,
      limit,
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

/**
 * Penyimpan lilin ke SQLite lokal bawaan Tauri
 */
async function defaultTauriSqliteSaver(
  symbol: string,
  timeframe: string,
  candles: Candle[]
): Promise<void> {
  if (!isTauriEnvironment() || !candles || candles.length === 0) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('store_cached_candles', {
      symbol,
      timeframe,
      candles,
    });
  } catch {
    // Abaikan kegagalan cache persistensi sekunder
  }
}

/**
 * Pengambil lilin langsung dari jaringan melalui marketFeed Trawangan
 */
async function defaultMarketNetworkFetcher(
  symbol: string,
  interval: string,
  limit = 500
): Promise<Candle[]> {
  try {
    const candles = await marketFeed.getCandles(symbol, interval, limit);
    return Array.isArray(candles) ? candles : [];
  } catch (err) {
    console.warn(`[PineSeriesAdapter] Gagal mengambil lilin dari feed pasar untuk ${symbol}:`, err);
    return [];
  }
}

/**
 * Membangun adapter fungsi `fetchSeries` bertipe kuat untuk PineWorkerEngine
 */
export function createPineFetchSeriesAdapter(
  options: PineFetchSeriesAdapterOptions = {}
): FetchSeriesHandler {
  const {
    sqliteLoader = defaultTauriSqliteLoader,
    sqliteSaver = defaultTauriSqliteSaver,
    networkFetcher = defaultMarketNetworkFetcher,
    inMemoryCache = new Map<string, { fetchedAt: number; bars: OHLCVBar[] }>(),
    cacheTtlMs = 60_000,
    defaultProvider = 'binance',
  } = options;

  return async function fetchSeries(
    rawSymbol: string,
    rawTimeframe: string,
    range?: FetchSeriesRange
  ): Promise<OHLCVBar[]> {
    const parsed = parseSeriesTicker(rawSymbol, defaultProvider);
    if (!parsed.cleanSymbol) return [];

    const tf = normalizeSeriesTimeframe(rawTimeframe);
    const exchangeInterval = toExchangeInterval(tf);
    const cacheKey = `${parsed.providerId}:${parsed.cleanSymbol}:${tf}`;
    const requiredLimit = Math.max(100, Math.min(1000, range?.limit ?? 500));

    // ─── 1. Cek In-Memory Cache (Tier 1) ───
    const memHit = inMemoryCache.get(cacheKey);
    const now = Date.now();
    if (memHit && now - memHit.fetchedAt < cacheTtlMs && memHit.bars.length > 0) {
      return applyRangeBounds(memHit.bars, range);
    }

    // ─── 2. Cek SQLite Kline Cache (Tier 2) ───
    let loadedFromSqlite: Candle[] = [];
    const providerSymbolKey = `${parsed.providerId}:${parsed.cleanSymbol}`;
    try {
      // Coba cari dengan format canonical `${providerId}:${cleanSymbol}` terlebih dahulu
      loadedFromSqlite = await sqliteLoader(providerSymbolKey, tf, requiredLimit);
      if (!loadedFromSqlite || loadedFromSqlite.length === 0) {
        // Fallback coba cari bare cleanSymbol bila disimpan tanpa prefix
        loadedFromSqlite = await sqliteLoader(parsed.cleanSymbol, tf, requiredLimit);
      }
    } catch {
      loadedFromSqlite = [];
    }

    if (loadedFromSqlite && loadedFromSqlite.length > 0) {
      const bars = loadedFromSqlite.map(toOHLCVBar);
      inMemoryCache.set(cacheKey, { fetchedAt: now, bars });
      return applyRangeBounds(bars, range);
    }

    // ─── 3. Fallback Jaringan Market Feed / Universal Fetch (Tier 3) ───
    const lookupSymbol = `${parsed.providerId}:${parsed.cleanSymbol}`;
    let fetchedCandles: Candle[] = [];
    try {
      fetchedCandles = await networkFetcher(lookupSymbol, exchangeInterval, requiredLimit);
    } catch (err) {
      console.warn(`[PineSeriesAdapter] Network fetcher gagal untuk ${lookupSymbol}:`, err);
      fetchedCandles = [];
    }

    if (fetchedCandles && fetchedCandles.length > 0) {
      const bars = fetchedCandles.map(toOHLCVBar);

      // Simpan ke SQLite cache untuk query berikutnya
      void sqliteSaver(providerSymbolKey, tf, fetchedCandles).catch(() => {});
      if (parsed.cleanSymbol !== providerSymbolKey) {
        void sqliteSaver(parsed.cleanSymbol, tf, fetchedCandles).catch(() => {});
      }

      // Simpan ke memory cache
      inMemoryCache.set(cacheKey, { fetchedAt: now, bars });

      return applyRangeBounds(bars, range);
    }

    return [];
  };
}

/**
 * Mesin Worker Pine yang di-hardening untuk Trawangan dengan injeksi fetchSeries inter-simbol
 */
export class TrawanganPineWorkerEngine extends PineWorkerEngine {
  private readonly customFetchSeries?: FetchSeriesHandler;

  constructor(opts?: PineWorkerEngineOptions) {
    super(opts);
    this.customFetchSeries = opts?.fetchSeries;

    // Pasang interceptor pada handler internal serveFetch untuk menangani request.security
    if (this.customFetchSeries) {
      const origServeFetch = (this as any).serveFetch?.bind(this);
      (this as any).serveFetch = async (
        reqId: number,
        symbol: string,
        timeframe: string,
        range?: any
      ): Promise<void> => {
        try {
          const bars = await this.customFetchSeries!(symbol, timeframe, range);
          (this as any).post?.({ kind: 'fetchSeriesResult', reqId, bars });
        } catch (err: any) {
          if (origServeFetch) {
            return origServeFetch(reqId, symbol, timeframe, range);
          }
          (this as any).post?.({
            kind: 'fetchSeriesResult',
            reqId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      };
    }
  }

  /**
   * Menyisipkan fetchSeries adapter ke setiap sesi eksekusi skrip
   */
  override execute(req: any, handlers: any) {
    if (this.customFetchSeries && (!req.fetchSeries || typeof req.fetchSeries !== 'function')) {
      req.fetchSeries = this.customFetchSeries;
    }
    return super.execute(req, handlers);
  }
}
