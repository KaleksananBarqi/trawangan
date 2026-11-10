/**
 * Yahoo Finance Market Data Provider untuk Vela WebGL2 Engine
 * Mendukung pembacaan candle historis kline, live polling, dan resampling 2H & 4H
 */

import { isMonthlyTimeframe } from '../utils/timeframeAdapter';
import { universalFetch } from './httpClient';
import { isYahooSymbol } from './instrumentIdentity';
import {
  createPollingSubscription,
  type ManagedStreamHandle,
  type StreamHealthSink,
} from './streamHealthGuard';

export interface YahooFinanceProviderOptions {
  healthSink?: StreamHealthSink;
  pollIntervalMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SymbolInfo {
  ticker: string;
  name?: string;
  tickerid?: string;
  description?: string;
  type?: string;
  session?: string;
  exchange?: string;
  listed_exchange?: string;
  timezone?: string;
  minmov?: number;
  pricescale?: number;
  has_intraday?: boolean;
  supported_resolutions?: string[];
  volume_precision?: number;
  [key: string]: unknown;
}

/**
 * Resample array candle interval 1h menjadi interval target yang lebih besar (misal: 2h atau 4h)
 */
export function resampleCandles(candles: OHLCV[], targetIntervalSeconds: number): OHLCV[] {
  if (!candles || candles.length === 0) return [];
  if (targetIntervalSeconds <= 3600) return candles;

  const targetIntervalMs = targetIntervalSeconds * 1000;
  const result: OHLCV[] = [];
  let currentBucket: OHLCV | null = null;
  let bucketStartTime = 0;

  for (const c of candles) {
    // Alokasikan waktu candle ke awal bucket dalam milidetik
    const bucketTime = Math.floor(c.time / targetIntervalMs) * targetIntervalMs;

    if (!currentBucket || bucketStartTime !== bucketTime) {
      if (currentBucket) {
        result.push(currentBucket);
      }
      bucketStartTime = bucketTime;
      currentBucket = {
        time: bucketTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
      };
    } else {
      currentBucket.high = Math.max(currentBucket.high, c.high);
      currentBucket.low = Math.min(currentBucket.low, c.low);
      currentBucket.close = c.close;
      currentBucket.volume = (currentBucket.volume ?? 0) + (c.volume ?? 0);
    }
  }

  if (currentBucket) {
    result.push(currentBucket);
  }

  return result;
}

export class YahooFinanceProvider {
  private activeSubscriptions = new Map<string, ManagedStreamHandle>();
  private options: YahooFinanceProviderOptions;

  constructor(options: YahooFinanceProviderOptions = {}) {
    this.options = options;
  }

  public setHealthSink(sink?: StreamHealthSink): void {
    this.options.healthSink = sink;
  }

  info() {
    return {
      name: 'yahoo',
      displayName: 'Yahoo Finance',
      description: 'Yahoo Finance Global Multi-Asset Feed (IDX, Metals USD, US Equities)',
      capabilities: {
        enumerate: true,
        stream: true,
        symbolInfo: true,
      },
    };
  }

  /**
   * Konversi timeframe Vela ke parameter interval Yahoo Finance dan flag resampling
   */
  public mapTimeframe(tf: string): { interval: string; resampleTargetSec?: number } {
    if (isMonthlyTimeframe(tf)) {
      return { interval: '1mo' };
    }
    const clean = tf.toLowerCase();
    switch (clean) {
      case '1':
      case '1m':
        return { interval: '1m' };
      case '2':
      case '2m':
        return { interval: '2m' };
      case '5':
      case '5m':
        return { interval: '5m' };
      case '15':
      case '15m':
        return { interval: '15m' };
      case '30':
      case '30m':
        return { interval: '30m' };
      case '60':
      case '1h':
      case 'h':
        return { interval: '1h' };
      case '120':
      case '2h':
        return { interval: '1h', resampleTargetSec: 7200 };
      case '240':
      case '4h':
        return { interval: '1h', resampleTargetSec: 14400 };
      case '1d':
      case 'd':
        return { interval: '1d' };
      case '1w':
      case 'w':
        return { interval: '1wk' };
      default:
        if (clean.endsWith('m')) return { interval: clean };
        if (clean.endsWith('h')) {
          const hours = parseInt(clean, 10);
          if (hours === 1) return { interval: '1h' };
          return { interval: '1h', resampleTargetSec: hours * 3600 };
        }
        if (clean.endsWith('d')) return { interval: '1d' };
        if (clean.endsWith('w')) return { interval: '1wk' };
        return { interval: '1d' };
    }
  }

  /**
   * Menentukan parameter range Yahoo Finance berdasarkan interval dan batasan bursa
   */
  private determineRange(interval: string, countBack = 300): string {
    switch (interval) {
      case '1m':
        return '7d';
      case '2m':
      case '5m':
      case '15m':
      case '30m':
        return '60d';
      case '1h':
        return '730d';
      case '1d':
        return countBack > 1000 ? '10y' : '5y';
      case '1wk':
      case '1mo':
        return 'max';
      default:
        return '1y';
    }
  }

  /**
   * Normalisasi ticker untuk query Yahoo Finance
   */
  public cleanYahooTicker(ticker: string): string {
    const raw = ticker.replace(/^yahoo:/i, '').trim();
    return raw;
  }

  /**
   * Mengambil candle historis Yahoo Finance secara ketat (melempar error bila gagal jaringan/HTTP)
   */
  public async fetchBarsStrict(ticker: string, timeframe: string, range: any = {}): Promise<OHLCV[]> {
    const symbol = this.cleanYahooTicker(ticker);
    const { interval, resampleTargetSec } = this.mapTimeframe(timeframe);
    const countBack = range?.countBack || range?.limit || 300;
    const rangeParam = this.determineRange(interval, countBack);

    const encodedSymbol = encodeURIComponent(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=${interval}&range=${rangeParam}`;
    const timeoutMs = this.options.timeoutMs ?? 8000;

    const res = await universalFetch(url, { timeoutMs });
    if (!res.ok) {
      throw new Error(`Yahoo HTTP Error: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    const chartResult = json?.chart?.result?.[0];
    if (!chartResult) {
      return [];
    }

    const timestamps = chartResult.timestamp || [];
    const quote = chartResult.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const bars: OHLCV[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const rawTime = timestamps[i];
      const open = opens[i];
      const high = highs[i];
      const low = lows[i];
      const close = closes[i];
      const volume = volumes[i] ?? 0;

      // Validasi lilin valid (bukan null akibat jeda bursa)
      if (
        rawTime !== null &&
        rawTime !== undefined &&
        open !== null &&
        high !== null &&
        low !== null &&
        close !== null &&
        !isNaN(open) &&
        !isNaN(close)
      ) {
        // Yahoo timestamp dalam detik; Vela WebGL2 engine membutuhkan milidetik (ms)
        const timeMs = Number(rawTime) < 1e11 ? Number(rawTime) * 1000 : Number(rawTime);

        bars.push({
          time: timeMs,
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume),
        });
      }
    }

    // Terapkan resampling jika diperlukan (2H, 4H)
    if (resampleTargetSec && resampleTargetSec > 3600) {
      return resampleCandles(bars, resampleTargetSec);
    }

    return bars;
  }

  /**
   * Mengambil candle historis dari Yahoo Finance REST API (fail-soft untuk kompatibilitas Vela)
   */
  async getBars(ticker: string, timeframe: string, range: any): Promise<OHLCV[]> {
    const symbol = this.cleanYahooTicker(ticker);
    try {
      return await this.fetchBarsStrict(ticker, timeframe, range);
    } catch (err: any) {
      console.warn(`[YahooFinanceProvider] getBars error for ${symbol}:`, err?.message || err);
      return [];
    }
  }

  public reconnectAll(): void {
    for (const handle of this.activeSubscriptions.values()) {
      handle.reconnect();
    }
  }

  /**
   * Polling berkala untuk live feed update lilin aktif dengan anti-overlap guard, backoff, dan health reporting
   */
  subscribe(ticker: string, timeframe: string, onBar: (b: OHLCV) => void): () => void {
    const symbol = this.cleanYahooTicker(ticker);
    const subKey = `yahoo:${symbol}:${timeframe}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;

    return createPollingSubscription<OHLCV>({
      sourceKey: subKey,
      providerId: 'yahoo',
      pollIntervalMs: this.options.pollIntervalMs ?? 12000, // Polling 12 detik aman dari rate limiting
      maxBackoffMs: this.options.maxBackoffMs ?? 60000,
      healthSink: this.options.healthSink,
      fetchLatest: async () => {
        const bars = await this.fetchBarsStrict(ticker, timeframe, { countBack: 2 });
        return bars.length > 0 ? bars[bars.length - 1] : null;
      },
      onBar,
      onRegister: (handle) => {
        this.activeSubscriptions.set(subKey, handle);
        return () => {
          this.activeSubscriptions.delete(subKey);
        };
      },
    });
  }

  async getSymbolInfo(ticker: string): Promise<SymbolInfo> {
    const clean = this.cleanYahooTicker(ticker);
    const isIdr = clean.toUpperCase().endsWith('.JK');
    const isGoldOrMetal = clean.includes('=F');

    return {
      ticker: clean,
      name: clean,
      tickerid: `yahoo:${clean}`,
      description: clean,
      type: isIdr ? 'stock' : isGoldOrMetal ? 'commodity' : 'index',
      session: '24x7',
      timezone: isIdr ? 'Asia/Jakarta' : 'America/New_York',
      minmov: 1,
      pricescale: isIdr ? 1 : isGoldOrMetal ? 100 : 100,
      has_intraday: true,
      supported_resolutions: ['1', '5', '15', '30', '60', '120', '240', '1D', '1W', '1M'],
      volume_precision: 0,
    };
  }
}
