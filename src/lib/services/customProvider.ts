/**
 * Custom Node / Proxy Market Data Provider untuk Vela WebGL2 Engine
 * Mendukung node REST kustom dengan format payload array-of-arrays [[t,o,h,l,c,v]] maupun object array,
 * koneksi WebSocket opsional ber-watchdog, dan fallback REST polling terlindungi Guard.
 */

import { fromVelaTimeframe, toExchangeInterval } from '../utils/timeframeAdapter';
import type { BarRange, OHLCV, SymbolDescriptor, SymbolInfo, WebSocketLike } from './bitunixProvider';
import { universalFetch } from './httpClient';
import { VERIFIED_CRYPTO_ASSETS } from './market/constants';
import {
  computeExponentialBackoffMs,
  createPollingSubscription,
  type ManagedStreamHandle,
  type StreamHealthSink,
} from './streamHealthGuard';

export interface CustomFeedProviderOptions {
  providerId: string;
  name?: string;
  restUrl: string;
  wsUrl?: string;
  healthSink?: StreamHealthSink;
  wsFactory?: (url: string) => WebSocketLike;
  pollIntervalMs?: number;
  maxBackoffMs?: number;
  staleMs?: number;
  baseBackoffMs?: number;
  timeoutMs?: number;
}

function unrefTimer(timer: any): void {
  if (typeof timer?.unref === 'function') {
    timer.unref();
  }
}

/**
 * Membentuk URL klines sesuai konvensi backend Rust `fetch_custom_klines`
 */
export function buildCustomKlinesUrl(
  restUrl: string,
  symbol: string,
  interval: string,
  limit = 300
): string {
  const cleanBase = restUrl.trim();
  const cleanSym = (symbol.includes(':') ? symbol.split(':').slice(1).join(':') : symbol)
    .trim()
    .toUpperCase();
  const stdInterval = toExchangeInterval(fromVelaTimeframe(interval), 'binance');
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 1000);

  if (cleanBase.includes('?')) {
    return `${cleanBase}&symbol=${encodeURIComponent(cleanSym)}&interval=${encodeURIComponent(stdInterval)}&limit=${safeLimit}`;
  }

  return `${cleanBase.replace(/\/+$/, '')}/klines?symbol=${encodeURIComponent(cleanSym)}&interval=${encodeURIComponent(stdInterval)}&limit=${safeLimit}`;
}

/**
 * Mengurai payload klines kustom dari format array-of-arrays [[t,o,h,l,c,v]],
 * array-of-objects [{time,open,...}], maupun objek ber pembungkus { data / candles / bars }.
 */
export function parseCustomCandlesPayload(raw: any): OHLCV[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.candles)
        ? raw.candles
        : Array.isArray(raw?.bars)
          ? raw.bars
          : null;

  if (!list) {
    throw new Error('Payload Custom REST endpoint tidak berbentuk array klines yang valid.');
  }

  const byTime = new Map<number, OHLCV>();

  for (const item of list) {
    let rawTime = NaN;
    let open = NaN;
    let high = NaN;
    let low = NaN;
    let close = NaN;
    let volume = 0;

    if (Array.isArray(item) && item.length >= 5) {
      rawTime = Number(item[0]);
      open = Number(item[1]);
      high = Number(item[2]);
      low = Number(item[3]);
      close = Number(item[4]);
      volume = item.length >= 6 ? Number(item[5] ?? 0) : 0;
    } else if (item && typeof item === 'object') {
      rawTime = Number(item.time ?? item.timestamp ?? item.t ?? item.openTime);
      open = Number(item.open ?? item.o);
      high = Number(item.high ?? item.h);
      low = Number(item.low ?? item.l);
      close = Number(item.close ?? item.c);
      volume = Number(item.volume ?? item.v ?? item.baseVol ?? 0);
    } else {
      continue;
    }

    if (!Number.isFinite(rawTime) || rawTime <= 0 || !Number.isFinite(open) || !Number.isFinite(close)) {
      continue;
    }

    const time = rawTime < 1e11 ? rawTime * 1000 : rawTime;
    const safeHigh = Number.isFinite(high) ? high : Math.max(open, close);
    const safeLow = Number.isFinite(low) ? low : Math.min(open, close);

    byTime.set(time, {
      time,
      open,
      high: safeHigh,
      low: safeLow,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
    });
  }

  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

export class CustomFeedProvider {
  private activeSubscriptions = new Map<string, ManagedStreamHandle>();
  private options: CustomFeedProviderOptions;

  constructor(options: CustomFeedProviderOptions) {
    this.options = options;
  }

  public setHealthSink(sink?: StreamHealthSink): void {
    this.options.healthSink = sink;
  }

  public getRestUrl(): string {
    return this.options.restUrl;
  }

  info() {
    return {
      name: this.options.providerId,
      displayName: this.options.name || 'Custom Feed',
      description: `Custom endpoint (${this.options.restUrl})`,
      capabilities: {
        enumerate: true,
        stream: true,
        symbolInfo: true,
      },
    };
  }

  normalizeSymbol(ticker: string): string {
    if (!ticker) return 'BTCUSDT';
    const trimmed = ticker.trim();
    if (trimmed.includes(':')) {
      return trimmed.split(':').slice(1).join(':').trim().toUpperCase();
    }
    return trimmed.toUpperCase();
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

  /**
   * Mengambil candle historis secara ketat (melempar error bila jaringan/HTTP atau payload gagal)
   */
  public async fetchBarsStrict(
    ticker: string,
    timeframe: string,
    range: BarRange = {}
  ): Promise<OHLCV[]> {
    if (!this.options.restUrl || !this.options.restUrl.trim()) {
      throw new Error(`REST URL untuk ${this.options.providerId} belum dikonfigurasi.`);
    }

    const symbol = this.normalizeSymbol(ticker);
    const limit = Math.min(Math.max(range?.countBack ?? range?.limit ?? 300, 1), 1000);
    const url = buildCustomKlinesUrl(this.options.restUrl, symbol, timeframe, limit);
    const timeoutMs = this.options.timeoutMs ?? 8000;

    const res = await universalFetch(url, { timeoutMs });
    if (!res.ok) {
      throw new Error(`Custom Feed HTTP Error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    let bars = parseCustomCandlesPayload(json);

    if (range?.from != null) {
      const fromMs = range.from > 0 && range.from < 1e11 ? range.from * 1000 : range.from;
      bars = bars.filter((b) => b.time >= fromMs);
    }
    if (range?.to != null) {
      const toMs = range.to > 0 && range.to < 1e11 ? range.to * 1000 : range.to;
      bars = bars.filter((b) => b.time <= toMs);
    }

    return bars.length > limit ? bars.slice(-limit) : bars;
  }

  /**
   * Fail-soft getter untuk kontrak DataProvider Vela
   */
  async getBars(ticker: string, timeframe: string, range: BarRange = {}): Promise<OHLCV[]> {
    try {
      return await this.fetchBarsStrict(ticker, timeframe, range);
    } catch (err) {
      console.warn(`[CustomFeedProvider:${this.options.providerId}] Gagal fetch kline ${ticker}:`, err);
      return [];
    }
  }

  async getSymbolInfo(ticker: string): Promise<SymbolInfo> {
    const symbol = this.normalizeSymbol(ticker);
    const ex = this.options.providerId.toUpperCase();

    return {
      tickerid: `${ex}:${symbol}`,
      name: symbol,
      ticker: symbol,
      description: `${symbol} (${this.options.name || 'Custom Feed'})`,
      type: 'crypto',
      session: '24x7',
      exchange: ex,
      listed_exchange: ex,
      timezone: 'Etc/UTC',
      minmov: 1,
      pricescale: symbol.includes('BTC') || symbol.includes('ETH') ? 100 : 10000,
      has_intraday: true,
      supported_resolutions: ['1', '3', '5', '15', '30', '60', '240', '1D', '1W'],
      volume_precision: 4,
    };
  }

  async listSymbols(): Promise<SymbolDescriptor[]> {
    return VERIFIED_CRYPTO_ASSETS.slice(0, 15).map((asset) => ({
      symbol: `${asset.base}USDT`,
      ticker: `${asset.base}USDT`,
      description: `${asset.name} (${this.options.name || 'Custom Feed'})`,
      type: 'crypto',
    }));
  }

  public reconnectAll(): void {
    for (const handle of this.activeSubscriptions.values()) {
      handle.reconnect();
    }
  }

  /**
   * Stream live via WebSocket kustom (bila wsUrl tersedia) atau fallback REST polling terlindungi Guard
   */
  subscribe(ticker: string, timeframe: string, onBar: (bar: OHLCV) => void): () => void {
    const symbol = this.normalizeSymbol(ticker);
    const interval = toExchangeInterval(fromVelaTimeframe(timeframe), 'binance');
    const sourceKey = `${this.options.providerId}:${symbol}:${interval}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    const hasWs = Boolean(this.options.wsUrl && this.options.wsUrl.trim()) &&
      Boolean(this.options.wsFactory || typeof WebSocket !== 'undefined');

    if (!hasWs) {
      return createPollingSubscription<OHLCV>({
        sourceKey,
        providerId: this.options.providerId,
        pollIntervalMs: this.options.pollIntervalMs ?? 4000,
        maxBackoffMs: this.options.maxBackoffMs ?? 30000,
        healthSink: this.options.healthSink,
        fetchLatest: async () => {
          const bars = await this.fetchBarsStrict(ticker, timeframe, { countBack: 2 });
          return bars.length > 0 ? bars[bars.length - 1] : null;
        },
        onBar,
        onRegister: (handle) => {
          this.activeSubscriptions.set(sourceKey, handle);
          return () => this.activeSubscriptions.delete(sourceKey);
        },
      });
    }

    const wsUrl = this.options.wsUrl!.trim();
    const staleMs = this.options.staleMs ?? 25000;
    const baseBackoffMs = this.options.baseBackoffMs ?? 1500;
    const maxBackoffMs = this.options.maxBackoffMs ?? 30000;
    const pollIntervalMs = this.options.pollIntervalMs ?? 4000;

    let closed = false;
    let ws: WebSocketLike | null = null;
    let reconnectAttempt = 0;
    let lastBarAt = Date.now();
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let fallbackUnsub: (() => void) | null = null;
    let fallbackHealthy = false;

    const clearTimers = () => {
      if (watchdogTimer !== null) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const stopFallback = () => {
      fallbackHealthy = false;
      if (fallbackUnsub) {
        fallbackUnsub();
        fallbackUnsub = null;
      }
    };

    const fallbackHealthSink: StreamHealthSink = {
      reportStreamState: (_k, provId, state, msg) => {
        if (closed) return;
        if (state === 'connected') {
          fallbackHealthy = true;
          this.options.healthSink?.reportStreamState(sourceKey, provId, 'connected');
        } else {
          fallbackHealthy = false;
          this.options.healthSink?.reportStreamState(sourceKey, provId, state, msg);
        }
      },
      clearStreamState: () => {
        fallbackHealthy = false;
      },
    };

    const startFallback = () => {
      if (closed || fallbackUnsub !== null) return;
      fallbackUnsub = createPollingSubscription<OHLCV>({
        sourceKey,
        providerId: this.options.providerId,
        pollIntervalMs,
        maxBackoffMs,
        healthSink: fallbackHealthSink,
        fetchLatest: async () => {
          const bars = await this.fetchBarsStrict(ticker, timeframe, { countBack: 2 });
          if (bars.length === 0) {
            throw new Error(`Fallback REST ${this.options.providerId} mengembalikan data kosong.`);
          }
          return bars[bars.length - 1];
        },
        onBar: (bar) => {
          if (!closed) onBar(bar);
        },
      });
    };

    const closeSocket = (sock: WebSocketLike | null) => {
      if (!sock) return;
      sock.onopen = null;
      sock.onmessage = null;
      sock.onclose = null;
      sock.onerror = null;
      try {
        sock.close();
      } catch (_) {}
    };

    const handleDisconnect = (reason: string) => {
      if (closed) return;
      if (watchdogTimer !== null) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      closeSocket(ws);
      ws = null;
      // Laporkan stalled/blocked jika fallback REST belum terverifikasi sehat agar UI tidak ping-pong saat WS retry
      if (!fallbackHealthy) {
        this.options.healthSink?.reportStreamState(
          sourceKey,
          this.options.providerId,
          reconnectAttempt >= 2 ? 'blocked' : 'stalled',
          reason
        );
      }
      startFallback();
      if (reconnectTimer === null) {
        const delayMs = computeExponentialBackoffMs(reconnectAttempt++, baseBackoffMs, maxBackoffMs);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!closed) openSocket();
        }, delayMs);
        unrefTimer(reconnectTimer);
      }
    };

    const openSocket = () => {
      if (closed) return;
      clearTimers();
      closeSocket(ws);
      const socket = this.createSocket(wsUrl);
      if (!socket) {
        startFallback();
        return;
      }
      ws = socket;
      lastBarAt = Date.now();

      socket.onopen = () => {
        if (closed || ws !== socket) return;
        lastBarAt = Date.now();
        try {
          socket.send(
            JSON.stringify({
              op: 'subscribe',
              type: 'subscribe',
              symbol,
              interval,
            })
          );
        } catch (_) {}
      };

      watchdogTimer = setInterval(() => {
        if (closed || ws !== socket) return;
        if (Date.now() - lastBarAt >= staleMs) {
          handleDisconnect(`Stream WS ${this.options.providerId} (${symbol}) diam membeku; menyambung ulang...`);
        }
      }, Math.max(100, Math.min(Math.floor(staleMs / 2), 3000)));
      unrefTimer(watchdogTimer);

      socket.onmessage = (ev: { data: any }) => {
        if (closed || ws !== socket) return;
        try {
          const parsed = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
          const candidate = parsed?.data ?? parsed?.candle ?? parsed;
          const bars = parseCustomCandlesPayload(Array.isArray(candidate) ? candidate : [candidate]);
          if (bars.length > 0) {
            lastBarAt = Date.now();
            reconnectAttempt = 0;
            fallbackHealthy = false;
            stopFallback();
            this.options.healthSink?.reportStreamState(sourceKey, this.options.providerId, 'connected');
            for (const b of bars) onBar(b);
          }
        } catch (_) {}
      };

      socket.onclose = () => {
        if (closed || ws !== socket) return;
        handleDisconnect(`Koneksi WS ${this.options.providerId} (${symbol}) terputus.`);
      };

      socket.onerror = () => {
        if (closed || ws !== socket) return;
        handleDisconnect(`Error WS ${this.options.providerId} (${symbol}).`);
      };
    };

    const handle: ManagedStreamHandle = {
      reconnect: () => {
        if (closed) return;
        reconnectAttempt = 0;
        stopFallback();
        clearTimers();
        closeSocket(ws);
        ws = null;
        openSocket();
      },
      stop: () => {
        closed = true;
        clearTimers();
        stopFallback();
        closeSocket(ws);
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
