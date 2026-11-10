/**
 * Bitunix Futures Market Data Provider untuk Vela WebGL2 Engine
 * Mendukung pembacaan candle historis kline (pagination + forming bar ticker),
 * live WebSocket streaming (wss://fapi.bitunix.com/public/), heartbeat ping/pong,
 * deteksi silent-stall watchdog, exponential backoff reconnect, dan fallback REST polling.
 */

import { isMonthlyTimeframe } from '../utils/timeframeAdapter';
import { universalFetch } from './httpClient';
import {
  computeExponentialBackoffMs,
  createPollingSubscription,
  type ManagedStreamHandle,
  type StreamHealthSink,
} from './streamHealthGuard';

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface BarRange {
  from?: number;
  to?: number;
  limit?: number;
  countBack?: number;
  session?: string;
}

export interface SymbolDescriptor {
  symbol: string;
  ticker: string;
  description?: string;
  type?: string;
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

export interface WebSocketLike {
  readyState?: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev?: any) => void) | null;
  onmessage: ((ev: { data: any }) => void) | null;
  onclose: ((ev?: any) => void) | null;
  onerror: ((err?: any) => void) | null;
}

export interface BitunixProviderOptions {
  wsFactory?: (url: string) => WebSocketLike;
  healthSink?: StreamHealthSink;
  wsUrl?: string;
  staleMs?: number;
  pingIntervalMs?: number;
  pongTimeoutMs?: number;
  pollFallbackMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
  now?: () => number;
}

const BITUNIX_WS_URL = 'wss://fapi.bitunix.com/public/';
const BITUNIX_MAX_KLINE_LIMIT = 200;
const BITUNIX_MAX_PAGES = 10;

const INTERVAL_MS_MAP: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '45m': 2_700_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000,
};

const WS_CHANNEL_MAP: Record<string, string | null> = {
  '1m': 'market_kline_1min',
  '3m': 'market_kline_3min',
  '5m': 'market_kline_5min',
  '15m': 'market_kline_15min',
  '30m': 'market_kline_30min',
  '45m': null, // Tidak memiliki stream kontinu resmi; gunakan polling REST + forming ticker
  '1h': 'market_kline_60min',
  '2h': 'market_kline_2h',
  '4h': 'market_kline_4h',
  '6h': 'market_kline_6h',
  '12h': 'market_kline_12h',
  '1d': 'market_kline_1day',
  '1w': 'market_kline_1week',
  '1M': 'market_kline_1month',
};

function unrefTimer(timer: any): void {
  if (typeof timer?.unref === 'function') {
    timer.unref();
  }
}

/**
 * Mengembalikan durasi interval Bitunix dalam milidetik
 */
export function getBitunixIntervalMs(interval: string): number {
  return INTERVAL_MS_MAP[interval] ?? 3_600_000;
}

/**
 * Menghitung waktu pembukaan (open timestamp ms) candle berjalan sesuai penyelarasan UTC Bitunix
 */
export function getBitunixBarOpenMs(timeMs: number, interval: string): number {
  if (interval === '1M') {
    const d = new Date(timeMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0);
  }
  if (interval === '1w') {
    const d = new Date(timeMs);
    const utcDay = d.getUTCDay(); // 0=Minggu, 1=Senin
    const diffToMonday = (utcDay + 6) % 7;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday, 0, 0, 0, 0);
  }
  const ms = getBitunixIntervalMs(interval);
  return Math.floor(timeMs / ms) * ms;
}

/**
 * Menormalkan ticker menjadi simbol futures Bitunix (contoh: 'ETH/USDT' atau 'eth-usdt.p' -> 'ETHUSDT')
 */
export function normalizeBitunixSymbol(ticker: string): string {
  const clean = ticker
    .trim()
    .replace(/^bitunix:/i, '')
    .replace(/\.P$/i, '')
    .replace(/[\/\-_]/g, '')
    .toUpperCase();
  return clean.endsWith('USDT') ? clean : `${clean}USDT`;
}

/**
 * Konversi timeframe Vela / standar ke parameter interval Bitunix REST API
 */
export function mapBitunixTimeframe(tf: string): string {
  if (isMonthlyTimeframe(tf)) {
    return '1M';
  }
  const clean = tf.toLowerCase();
  switch (clean) {
    case '1':
    case '1m':
      return '1m';
    case '3':
    case '3m':
      return '3m';
    case '5':
    case '5m':
      return '5m';
    case '15':
    case '15m':
      return '15m';
    case '30':
    case '30m':
      return '30m';
    case '45':
    case '45m':
      return '45m';
    case '60':
    case '1h':
    case 'h':
      return '1h';
    case '120':
    case '2h':
      return '2h';
    case '240':
    case '4h':
      return '4h';
    case '360':
    case '6h':
      return '6h';
    case '720':
    case '12h':
      return '12h';
    case '1d':
    case 'd':
      return '1d';
    case '1w':
    case 'w':
      return '1w';
    default:
      if (/^\d+[mhdw]$/.test(clean)) {
        return clean;
      }
      return '1h';
  }
}

export class BitunixProvider {
  private activeSubscriptions = new Map<string, ManagedStreamHandle>();
  private formingCache = new Map<string, OHLCV>();
  private options: BitunixProviderOptions;
  private now: () => number;

  constructor(options: BitunixProviderOptions = {}) {
    this.options = options;
    this.now = options.now ?? (() => Date.now());
  }

  public setHealthSink(sink?: StreamHealthSink): void {
    this.options.healthSink = sink;
  }

  info() {
    return {
      name: 'bitunix',
      displayName: 'Bitunix',
      description: 'Bitunix Futures (USDT-margined Perpetuals)',
      capabilities: {
        enumerate: true,
        stream: true,
        symbolInfo: true,
      },
    };
  }

  /**
   * Konversi timeframe Vela ke parameter interval Bitunix API
   */
  private mapTimeframe(tf: string): string {
    return mapBitunixTimeframe(tf);
  }

  private createSocket(url: string): WebSocketLike | null {
    if (this.options.wsFactory) {
      return this.options.wsFactory(url);
    }
    if (typeof WebSocket !== 'undefined') {
      return new WebSocket(url) as unknown as WebSocketLike;
    }
    return null;
  }

  private async fetchLivePrice(symbol: string): Promise<number | null> {
    const timeoutMs = Math.min(this.options.timeoutMs ?? 8000, 5000);
    try {
      const res = await universalFetch(
        `https://fapi.bitunix.com/api/v1/futures/market/tickers?symbols=${symbol}`,
        { timeoutMs }
      );
      if (!res.ok) return null;
      const json = await res.json();
      if (json && json.code === 0 && Array.isArray(json.data) && json.data.length > 0) {
        const matched = json.data.find((item: any) => item.symbol === symbol) || json.data[0];
        const px = parseFloat(matched.lastPrice || matched.markPrice || matched.last || '0');
        return Number.isFinite(px) && px > 0 ? px : null;
      }
    } catch (_) {}
    return null;
  }

  /**
   * Mensintesiskan atau memperbarui forming candle aktif bila /kline REST Bitunix baru menyertakan candle yang sudah tutup
   */
  private async attachFormingBarIfNeeded(
    symbol: string,
    interval: string,
    bars: OHLCV[],
    range?: BarRange
  ): Promise<OHLCV[]> {
    const nowMs = this.now();
    const currentOpenMs = getBitunixBarOpenMs(nowMs, interval);
    const includesTail = range?.to == null || range.to >= currentOpenMs;
    if (!includesTail) return bars;

    const lastBar = bars[bars.length - 1];
    if (lastBar && lastBar.time >= currentOpenMs) {
      this.formingCache.set(`${symbol}:${interval}`, lastBar);
      return bars;
    }

    const livePrice = await this.fetchLivePrice(symbol);
    if (livePrice === null) return bars;

    const cacheKey = `${symbol}:${interval}`;
    const cached = this.formingCache.get(cacheKey);
    let forming: OHLCV;

    if (cached && cached.time === currentOpenMs) {
      forming = {
        time: currentOpenMs,
        open: cached.open,
        high: Math.max(cached.high, livePrice),
        low: Math.min(cached.low, livePrice),
        close: livePrice,
        volume: cached.volume ?? 0,
      };
    } else {
      const open = lastBar ? lastBar.close : livePrice;
      forming = {
        time: currentOpenMs,
        open,
        high: Math.max(open, livePrice),
        low: Math.min(open, livePrice),
        close: livePrice,
        volume: 0,
      };
    }

    this.formingCache.set(cacheKey, forming);
    return [...bars, forming];
  }

  /**
   * Mengambil candle dari Bitunix REST API dengan pagination mundur (max 200 bar per halaman)
   */
  public async fetchBarsStrict(
    ticker: string,
    timeframe: string,
    range: BarRange = {}
  ): Promise<OHLCV[]> {
    const symbol = normalizeBitunixSymbol(ticker);
    const interval = this.mapTimeframe(timeframe);
    const wantLimit = Math.min(
      Math.max(range?.limit ?? range?.countBack ?? 300, 1),
      2000
    );
    const timeoutMs = this.options.timeoutMs ?? 8000;

    const byTime = new Map<number, OHLCV>();
    let cursorEndTime =
      range?.to != null && range.to > 0 ? Math.floor(range.to) : undefined;
    let lastError: any = null;

    for (let page = 0; page < BITUNIX_MAX_PAGES; page++) {
      const remaining = wantLimit - byTime.size;
      if (remaining <= 0) break;

      // Ambil minimal 5 saat countBack=2 agar cepat, dan maksimal 200 sesuai batas API Bitunix
      const pageLimit = Math.min(Math.max(remaining, 2), BITUNIX_MAX_KLINE_LIMIT);
      const url = new URL('https://fapi.bitunix.com/api/v1/futures/market/kline');
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('interval', interval);
      url.searchParams.set('limit', String(pageLimit));
      if (cursorEndTime != null) {
        url.searchParams.set('endTime', String(cursorEndTime));
      }

      try {
        const res = await universalFetch(url.toString(), { timeoutMs });
        if (!res.ok) {
          throw new Error(`Bitunix HTTP Error: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        if (!json || json.code !== 0 || !Array.isArray(json.data)) {
          throw new Error(`Bitunix API Error: ${json?.msg || json?.code || 'Invalid payload'}`);
        }

        const chunk: OHLCV[] = [];
        for (const item of json.data) {
          const time = typeof item.time === 'string' ? parseInt(item.time, 10) : Number(item.time);
          const open = parseFloat(item.open);
          const high = parseFloat(item.high);
          const low = parseFloat(item.low);
          const close = parseFloat(item.close);
          const volume = item.baseVol
            ? parseFloat(item.baseVol)
            : item.quoteVol
              ? parseFloat(item.quoteVol)
              : 0;

          if (!Number.isFinite(time) || !Number.isFinite(open) || !Number.isFinite(close)) {
            continue;
          }
          chunk.push({ time, open, high, low, close, volume });
          if (range?.from == null || time >= range.from) {
            byTime.set(time, { time, open, high, low, close, volume });
          }
        }

        if (chunk.length === 0) break;
        const oldestInChunk = chunk.reduce((min, b) => Math.min(min, b.time), Infinity);
        if (range?.from != null && oldestInChunk <= range.from) break;
        if (chunk.length < pageLimit) break;
        if (byTime.size >= wantLimit) break;

        cursorEndTime = oldestInChunk - 1;
      } catch (err) {
        lastError = err;
        break;
      }
    }

    if (byTime.size > 0) {
      let bars = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
      if (range?.from != null) {
        bars = bars.filter((b) => b.time >= range.from!);
      }
      if (range?.to != null) {
        bars = bars.filter((b) => b.time <= range.to!);
      }
      bars = await this.attachFormingBarIfNeeded(symbol, interval, bars, range);
      return bars.length > wantLimit ? bars.slice(-wantLimit) : bars;
    }

    // Jika Bitunix gagal di halaman pertama, coba fallback Binance Futures dengan timeout ketat agar tidak hang
    if (lastError) {
      console.warn('BitunixProvider getBars gagal, coba fallback Binance Futures:', lastError);
      try {
        const binanceLimit = Math.min(wantLimit, 500);
        const binanceUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${binanceLimit}`;
        const bRes = await universalFetch(binanceUrl, { timeoutMs: 5000 });
        if (bRes.ok) {
          const bData = await bRes.json();
          if (Array.isArray(bData)) {
            return bData.map((d: any[]) => ({
              time: Number(d[0]),
              open: parseFloat(d[1]),
              high: parseFloat(d[2]),
              low: parseFloat(d[3]),
              close: parseFloat(d[4]),
              volume: parseFloat(d[5]),
            }));
          }
        }
      } catch (fbErr) {
        console.error('Semua data feed futures gagal:', fbErr);
      }
      throw lastError;
    }

    // Kasus edge: histori kosong namun request meminta tail -> tetap coba bentuk forming bar dari ticker
    return this.attachFormingBarIfNeeded(symbol, interval, [], range);
  }

  /**
   * Mengambil candle historis dari Bitunix Futures REST API (fail-soft untuk kompatibilitas Vela)
   */
  async getBars(ticker: string, timeframe: string, range: any = {}): Promise<OHLCV[]> {
    try {
      return await this.fetchBarsStrict(ticker, timeframe, range);
    } catch (_) {
      return [];
    }
  }

  /**
   * Mengembalikan metadata simbol untuk legend dan status Vela
   */
  async getSymbolInfo(ticker: string): Promise<SymbolInfo> {
    const symbol = normalizeBitunixSymbol(ticker);

    return {
      tickerid: `BITUNIX:${symbol}`,
      name: symbol,
      ticker: symbol,
      description: `${symbol} Perpetual Contract (Bitunix)`,
      type: 'crypto',
      session: '24x7',
      exchange: 'BITUNIX',
      listed_exchange: 'BITUNIX',
      timezone: 'Etc/UTC',
      minmov: 1,
      pricescale: symbol.includes('BTC') || symbol.includes('ETH') ? 100 : 10000,
      has_intraday: true,
      supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W'],
      volume_precision: 3,
    };
  }

  /**
   * Katalog simbol Bitunix
   */
  async listSymbols(): Promise<SymbolDescriptor[]> {
    return [
      { symbol: 'BTCUSDT', ticker: 'BTCUSDT', description: 'Bitcoin / TetherUS Perp', type: 'crypto' },
      { symbol: 'ETHUSDT', ticker: 'ETHUSDT', description: 'Ethereum / TetherUS Perp', type: 'crypto' },
      { symbol: 'SOLUSDT', ticker: 'SOLUSDT', description: 'Solana / TetherUS Perp', type: 'crypto' },
      { symbol: 'BNBUSDT', ticker: 'BNBUSDT', description: 'BNB / TetherUS Perp', type: 'crypto' },
      { symbol: 'XRPUSDT', ticker: 'XRPUSDT', description: 'Ripple / TetherUS Perp', type: 'crypto' },
      { symbol: 'DOGEUSDT', ticker: 'DOGEUSDT', description: 'Dogecoin / TetherUS Perp', type: 'crypto' },
      { symbol: 'ADAUSDT', ticker: 'ADAUSDT', description: 'Cardano / TetherUS Perp', type: 'crypto' },
      { symbol: 'AVAXUSDT', ticker: 'AVAXUSDT', description: 'Avalanche / TetherUS Perp', type: 'crypto' },
      { symbol: 'SUIUSDT', ticker: 'SUIUSDT', description: 'Sui / TetherUS Perp', type: 'crypto' },
      { symbol: 'LINKUSDT', ticker: 'LINKUSDT', description: 'Chainlink / TetherUS Perp', type: 'crypto' },
    ];
  }

  /**
   * Memaksa penyambungan ulang seluruh live stream Bitunix yang sedang aktif
   */
  public reconnectAll(): void {
    for (const handle of this.activeSubscriptions.values()) {
      handle.reconnect();
    }
  }

  /**
   * Live streaming WebSocket Bitunix (market_kline_*) dengan heartbeat ping,
   * watchdog silent-stall, hybrid REST polling fallback, dan reconnect backoff eksponensial.
   */
  subscribe(ticker: string, timeframe: string, onBar: (bar: OHLCV) => void): () => void {
    const symbol = normalizeBitunixSymbol(ticker);
    const interval = this.mapTimeframe(timeframe);
    const wsChannel = WS_CHANNEL_MAP[interval];
    const sourceKey = `bitunix:${symbol}:${interval}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    const pollFallbackMs = this.options.pollFallbackMs ?? 4000;

    // Untuk interval yang belum memiliki stream push kontinu (seperti 45m), gunakan polling terlindung
    if (!wsChannel || (!this.options.wsFactory && typeof WebSocket === 'undefined')) {
      return createPollingSubscription<OHLCV>({
        sourceKey,
        providerId: 'bitunix',
        pollIntervalMs: pollFallbackMs,
        maxBackoffMs: this.options.maxBackoffMs ?? 15000,
        healthSink: this.options.healthSink,
        fetchLatest: async () => {
          const bars = await this.fetchBarsStrict(ticker, timeframe, { countBack: 3 });
          return bars.length > 0 ? bars[bars.length - 1] : null;
        },
        onBar,
        onRegister: (handle) => {
          this.activeSubscriptions.set(sourceKey, handle);
          return () => this.activeSubscriptions.delete(sourceKey);
        },
      });
    }

    const wsUrl = this.options.wsUrl ?? BITUNIX_WS_URL;
    const staleMs = this.options.staleMs ?? 25000;
    const pingIntervalMs = this.options.pingIntervalMs ?? 10000;
    const pongTimeoutMs = this.options.pongTimeoutMs ?? 5000;
    const baseBackoffMs = this.options.baseBackoffMs ?? 1000;
    const maxBackoffMs = this.options.maxBackoffMs ?? 15000;
    const intervalMs = getBitunixIntervalMs(interval);
    const formingKey = `${symbol}:${interval}`;

    let closed = false;
    let ws: WebSocketLike | null = null;
    let reconnectAttempt = 0;
    let pollErrorCount = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let fallbackPollTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackPollInFlight = false;
    let fallbackActive = false;

    let lastKlineAt = this.now();
    let lastFrameAt = this.now();
    let lastPingSentAt: number | null = null;

    const seed = this.formingCache.get(formingKey) ?? null;
    let currentBar: OHLCV | null = seed ? { ...seed } : null;
    let finalizedBucketTime: number | null = null;

    const clearSocketTimers = () => {
      if (pingTimer !== null) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      if (watchdogTimer !== null) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const stopFallbackPolling = () => {
      fallbackActive = false;
      if (fallbackPollTimer !== null) {
        clearTimeout(fallbackPollTimer);
        fallbackPollTimer = null;
      }
    };

    const syncTailFromRest = async (emitToGuardAsFailure = true) => {
      if (closed || fallbackPollInFlight) return;
      fallbackPollInFlight = true;
      try {
        const bars = await this.fetchBarsStrict(ticker, timeframe, { countBack: 4 });
        if (closed || bars.length === 0) return;

        pollErrorCount = 0;
        const latestBars = bars.slice(-2);
        for (const bar of latestBars) {
          if (!currentBar || bar.time >= currentBar.time) {
            currentBar = { ...bar };
            this.formingCache.set(formingKey, currentBar);
          }
          onBar(bar);
        }
      } catch (err: any) {
        if (!closed && emitToGuardAsFailure) {
          pollErrorCount++;
          const state = pollErrorCount >= 3 ? 'blocked' : 'stalled';
          this.options.healthSink?.reportStreamState(
            sourceKey,
            'bitunix',
            state,
            `Gagal menyinkronkan feed candle Bitunix ${symbol}: ${err?.message || 'Koneksi terputus'}`
          );
        }
      } finally {
        fallbackPollInFlight = false;
      }
    };

    const scheduleFallbackPoll = (delayMs: number) => {
      if (closed || !fallbackActive) return;
      if (fallbackPollTimer !== null) {
        clearTimeout(fallbackPollTimer);
        fallbackPollTimer = null;
      }
      fallbackPollTimer = setTimeout(() => {
        fallbackPollTimer = null;
        void (async () => {
          await syncTailFromRest(true);
          if (!closed && fallbackActive) {
            const backoff =
              pollErrorCount > 0
                ? computeExponentialBackoffMs(pollErrorCount - 1, Math.min(pollFallbackMs, 2000), maxBackoffMs)
                : pollFallbackMs;
            scheduleFallbackPoll(backoff);
          }
        })();
      }, delayMs);
      unrefTimer(fallbackPollTimer);
    };

    const startFallbackPolling = (immediate = false) => {
      if (closed) return;
      if (!fallbackActive) {
        fallbackActive = true;
        if (immediate) {
          void syncTailFromRest(true);
        }
        scheduleFallbackPoll(pollFallbackMs);
      } else if (immediate) {
        void syncTailFromRest(true);
      }
    };

    const detachSocketHandlers = (socket: WebSocketLike | null) => {
      if (!socket) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
    };

    const closeSocketSafely = (socket: WebSocketLike | null) => {
      if (!socket) return;
      detachSocketHandlers(socket);
      try {
        socket.close();
      } catch (_) {}
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer !== null) return;
      const delayMs = computeExponentialBackoffMs(reconnectAttempt, baseBackoffMs, maxBackoffMs);
      reconnectAttempt++;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!closed) {
          openSocket();
        }
      }, delayMs);
      unrefTimer(reconnectTimer);
    };

    const handleDisconnect = (reason: string) => {
      if (closed) return;
      clearSocketTimers();
      closeSocketSafely(ws);
      ws = null;
      this.options.healthSink?.reportStreamState(
        sourceKey,
        'bitunix',
        reconnectAttempt >= 2 ? 'blocked' : 'stalled',
        reason
      );
      startFallbackPolling(true);
      scheduleReconnect();
    };

    const processKlineMessage = (msg: any) => {
      if (!msg?.data || msg.ch !== wsChannel) return;
      const msgSymbol = String(msg.symbol || symbol).toUpperCase();
      if (msgSymbol !== symbol) return;

      const open = parseFloat(msg.data.o);
      const high = parseFloat(msg.data.h);
      const low = parseFloat(msg.data.l);
      const close = parseFloat(msg.data.c);
      const volume = msg.data.b !== undefined ? parseFloat(msg.data.b) : 0;

      if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return;
      }

      const nowMs = this.now();
      const msgTs = Number.isFinite(Number(msg.ts)) && Number(msg.ts) > 0 ? Number(msg.ts) : nowMs;
      const bucketStart = getBitunixBarOpenMs(msgTs, interval);

      lastKlineAt = nowMs;
      reconnectAttempt = 0;
      pollErrorCount = 0;
      stopFallbackPolling();
      this.options.healthSink?.reportStreamState(sourceKey, 'bitunix', 'connected');

      let targetBarTime = bucketStart;

      // Tangani pasangan pesan rollover Bitunix yang berbagi `ts` tepat di batas pergantian bar:
      // Pesan pertama membawa tick penutup bar lama (open sama, range high/low & volume >= bar lama),
      // sedangkan pesan kedua membawa pembukaan bar baru (volume ter-reset / open berbeda).
      if (currentBar && bucketStart > currentBar.time) {
        const withinRolloverWindow =
          msgTs - bucketStart <= 5000 &&
          bucketStart - currentBar.time <= Math.max(intervalMs * 1.1, 86_400_000);
        const sameOpen = Math.abs(open - currentBar.open) <= Math.max(1e-9, currentBar.open * 1e-8);
        const matchesHighLow = high >= currentBar.high - 1e-9 && low <= currentBar.low + 1e-9;
        const prevVol = currentBar.volume ?? 0;
        const matchesVolume =
          Number.isFinite(volume) &&
          volume >= prevVol - 1e-9 &&
          !(prevVol > 0 && volume === 0);

        if (
          withinRolloverWindow &&
          finalizedBucketTime !== currentBar.time &&
          sameOpen &&
          matchesHighLow &&
          matchesVolume &&
          !(prevVol === 0 && volume === 0 && Math.abs(open - currentBar.close) < 1e-9)
        ) {
          targetBarTime = currentBar.time;
          finalizedBucketTime = currentBar.time;
        }
      } else if (currentBar && bucketStart < currentBar.time) {
        // Abaikan frame usang di luar urutan
        return;
      }

      const emittedBar: OHLCV = {
        time: targetBarTime,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      };

      const prevTrackedTime = currentBar?.time;
      if (targetBarTime === bucketStart) {
        currentBar = emittedBar;
        this.formingCache.set(formingKey, emittedBar);
        // Jika baru melompati lebih dari 1 bar kosong, sinkronkan riwayat celah lewat REST
        if (prevTrackedTime !== undefined && bucketStart - prevTrackedTime > intervalMs * 1.5) {
          void syncTailFromRest(false);
        }
      } else if (currentBar && targetBarTime === currentBar.time) {
        currentBar = emittedBar;
      }

      onBar(emittedBar);
    };

    const openSocket = () => {
      if (closed) return;
      clearReconnectTimer();
      clearSocketTimers();
      closeSocketSafely(ws);

      const socket = this.createSocket(wsUrl);
      if (!socket) {
        startFallbackPolling(true);
        return;
      }
      ws = socket;
      const nowMs = this.now();
      lastFrameAt = nowMs;
      lastKlineAt = nowMs;
      lastPingSentAt = null;

      socket.onopen = () => {
        if (closed || ws !== socket) return;
        const openedAt = this.now();
        lastFrameAt = openedAt;
        lastKlineAt = openedAt;
        lastPingSentAt = null;

        try {
          socket.send(
            JSON.stringify({
              op: 'subscribe',
              args: [{ symbol, ch: wsChannel }],
            })
          );
        } catch (err: any) {
          handleDisconnect(`Gagal mengirim subscribe Bitunix WS: ${err?.message || err}`);
          return;
        }

        pingTimer = setInterval(() => {
          if (closed || ws !== socket) return;
          try {
            lastPingSentAt = this.now();
            socket.send(
              JSON.stringify({
                op: 'ping',
                ping: Math.floor(lastPingSentAt / 1000),
              })
            );
          } catch (_) {
            handleDisconnect('Gagal mengirim ping heartbeat Bitunix WS');
          }
        }, pingIntervalMs);
        unrefTimer(pingTimer);
      };

      const watchdogStepMs = Math.max(15, Math.min(Math.floor(staleMs / 2), 3000));
      watchdogTimer = setInterval(() => {
        if (closed || ws !== socket) return;
        const nowCheck = this.now();
        const sinceKline = nowCheck - lastKlineAt;
        const sincePing = lastPingSentAt !== null ? nowCheck - lastPingSentAt : 0;
        const pingTimedOut =
          lastPingSentAt !== null && sincePing >= pongTimeoutMs && lastFrameAt < lastPingSentAt;

        if (pingTimedOut || sinceKline >= staleMs) {
          handleDisconnect(
            `Stream Bitunix WS (${symbol} ${interval}) tidak menerima update selama ${sinceKline}ms; menyambung ulang...`
          );
        }
      }, watchdogStepMs);
      unrefTimer(watchdogTimer);

      socket.onmessage = (ev: { data: any }) => {
        if (closed || ws !== socket) return;
        lastFrameAt = this.now();
        lastPingSentAt = null;

        try {
          const raw = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '');
          if (!raw) return;
          const msg = JSON.parse(raw);
          if (msg?.op === 'ping' || msg?.pong !== undefined) {
            return;
          }
          if (msg?.ch === wsChannel && msg?.data) {
            processKlineMessage(msg);
          }
        } catch (_) {}
      };

      socket.onclose = () => {
        if (closed || ws !== socket) return;
        handleDisconnect(`Koneksi WebSocket Bitunix (${symbol}) terputus.`);
      };

      socket.onerror = () => {
        if (closed || ws !== socket) return;
        handleDisconnect(`Error koneksi WebSocket Bitunix (${symbol}).`);
      };
    };

    const handle: ManagedStreamHandle = {
      reconnect: () => {
        if (closed) return;
        reconnectAttempt = 0;
        pollErrorCount = 0;
        clearReconnectTimer();
        clearSocketTimers();
        closeSocketSafely(ws);
        ws = null;
        openSocket();
        void syncTailFromRest(false);
      },
      stop: () => {
        closed = true;
        clearReconnectTimer();
        clearSocketTimers();
        stopFallbackPolling();
        closeSocketSafely(ws);
        ws = null;
        this.options.healthSink?.clearStreamState?.(sourceKey);
        this.activeSubscriptions.delete(sourceKey);
      },
    };

    this.activeSubscriptions.set(sourceKey, handle);
    openSocket();

    return () => {
      handle.stop();
    };
  }
}
