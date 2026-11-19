// Layanan Derivatives Telemetry Strip (24H Volume, Open Interest, Funding Rate & Countdown)
import { universalFetch, type UniversalFetchOptions, type UniversalResponse } from '../httpClient';
import { normalizeHyperliquidCoin } from './adapters/hyperliquidAdapter';

export interface DerivativesTelemetrySnapshot {
  symbol: string;
  providerId: string;
  isPerpetual: boolean;
  price: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
  openInterestUsd: number | null;
  fundingRate: number | null;
  nextFundingTimeMs: number | null;
  countdownText: string;
  showOpenInterest: boolean;
  showFunding: boolean;
  updatedAt: number;
  loading: boolean;
  error?: string | null;
}

export interface TelemetryFallbackTicker {
  price?: number | null;
  change24h?: number | null;
  volume24h?: number | null;
}

type FetchFn = (url: string, options?: UniversalFetchOptions) => Promise<UniversalResponse>;
type TelemetryListener = (snapshot: DerivativesTelemetrySnapshot) => void;

const NON_DERIVATIVE_PROVIDERS = new Set(['yahoo', 'macro', 'indodax', 'coinbase']);

function toFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(num) ? num : null;
}

function stripPerpSuffix(symbol: string): string {
  return symbol
    .trim()
    .replace(/^[a-z0-9_-]+:/i, '')
    .replace(/\.P$/i, '')
    .replace(/[-_]PERP$/i, '')
    .toUpperCase();
}

/**
 * Menentukan apakah instrumen termasuk kontrak Perpetual (.P / PERP) yang memiliki OI & Funding.
 */
export function isPerpetualInstrument(symbol: string, providerId = ''): boolean {
  const prov = providerId.trim().toLowerCase();
  if (NON_DERIVATIVE_PROVIDERS.has(prov)) return false;

  const clean = symbol.trim().toUpperCase();
  if (!clean || clean.includes('/')) return false;

  if (clean.endsWith('.P') || clean.endsWith('-PERP') || clean.endsWith('_PERP')) {
    return true;
  }
  return prov === 'bitunix' || prov === 'hyperliquid';
}

export function formatCompactUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatFundingRatePct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '--';
  const pct = rate * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(4)}%`;
}

export function formatFundingCountdown(
  nextFundingTimeMs: number | null | undefined,
  nowMs = Date.now()
): string {
  if (nextFundingTimeMs === null || nextFundingTimeMs === undefined || !Number.isFinite(nextFundingTimeMs)) {
    return '--:--:--';
  }
  const diffSec = Math.max(0, Math.floor((nextFundingTimeMs - nowMs) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

export function getNextHourlyFundingMs(nowMs = Date.now()): number {
  const hourMs = 3_600_000;
  return (Math.floor(nowMs / hourMs) + 1) * hourMs;
}

function createEmptySnapshot(
  symbol: string,
  providerId: string,
  nowMs: number,
  fallback?: TelemetryFallbackTicker
): DerivativesTelemetrySnapshot {
  const isPerp = isPerpetualInstrument(symbol, providerId);
  return {
    symbol,
    providerId: providerId.toLowerCase(),
    isPerpetual: isPerp,
    price: toFiniteNumber(fallback?.price),
    change24hPct: toFiniteNumber(fallback?.change24h),
    volume24hUsd: toFiniteNumber(fallback?.volume24h),
    openInterestUsd: null,
    fundingRate: null,
    nextFundingTimeMs: null,
    countdownText: '--:--:--',
    showOpenInterest: isPerp,
    showFunding: isPerp,
    updatedAt: nowMs,
    loading: false,
    error: null,
  };
}

export class DerivativesTelemetryService {
  private fetchFn: FetchFn;
  private nowFn: () => number;
  private timeoutMs: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<TelemetryListener>();
  private currentSnapshot: DerivativesTelemetrySnapshot;
  private activeRequestToken = 0;

  constructor(options: { fetchFn?: FetchFn; nowFn?: () => number; timeoutMs?: number } = {}) {
    this.fetchFn = options.fetchFn || universalFetch;
    this.nowFn = options.nowFn || (() => Date.now());
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.currentSnapshot = createEmptySnapshot('BTCUSDT', 'binance', this.nowFn());
  }

  public getSnapshot(): DerivativesTelemetrySnapshot {
    return { ...this.currentSnapshot };
  }

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async fetchSnapshot(
    symbol: string,
    providerId: string,
    fallback?: TelemetryFallbackTicker
  ): Promise<DerivativesTelemetrySnapshot> {
    const prov = providerId.trim().toLowerCase();
    const nowMs = this.nowFn();
    const base = createEmptySnapshot(symbol, prov, nowMs, fallback);

    try {
      if (base.isPerpetual) {
        if (prov === 'binance') {
          return await this.fetchBinanceFutures(symbol, base, nowMs);
        }
        if (prov === 'bitunix') {
          return await this.fetchBitunixFutures(symbol, base, nowMs);
        }
        if (prov === 'hyperliquid') {
          return await this.fetchHyperliquidFutures(symbol, base, nowMs);
        }
      } else if (prov === 'binance') {
        return await this.fetchBinanceSpot(symbol, base, nowMs);
      }
      return base;
    } catch (err: any) {
      return {
        ...base,
        error: err?.message || String(err),
      };
    }
  }

  public startPolling(
    symbol: string,
    providerId: string,
    options: { intervalMs?: number; fallback?: TelemetryFallbackTicker } = {}
  ): void {
    this.stopPolling();
    const intervalMs = options.intervalMs ?? 15_000;
    const token = ++this.activeRequestToken;

    this.currentSnapshot = {
      ...createEmptySnapshot(symbol, providerId, this.nowFn(), options.fallback),
      loading: true,
    };
    this.notify();

    const runFetch = async () => {
      const snap = await this.fetchSnapshot(symbol, providerId, options.fallback);
      if (token !== this.activeRequestToken) return;
      this.currentSnapshot = snap;
      this.notify();
    };

    void runFetch();
    this.pollTimer = setInterval(() => {
      void runFetch();
    }, intervalMs);

    // Perbarui countdown tiap 1 detik di sisi klien tanpa network call
    this.countdownTimer = setInterval(() => {
      if (!this.currentSnapshot.showFunding || !this.currentSnapshot.nextFundingTimeMs) return;
      const nextText = formatFundingCountdown(this.currentSnapshot.nextFundingTimeMs, this.nowFn());
      if (nextText !== this.currentSnapshot.countdownText) {
        this.currentSnapshot = {
          ...this.currentSnapshot,
          countdownText: nextText,
        };
        this.notify();
      }
    }, 1000);
  }

  public stopPolling(): void {
    this.activeRequestToken += 1;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private async fetchJson<T = any>(url: string, options?: UniversalFetchOptions): Promise<T | null> {
    try {
      const res = await this.fetchFn(url, { timeoutMs: this.timeoutMs, ...options });
      if (!res.ok) return null;
      return await res.json<T>();
    } catch {
      return null;
    }
  }

  private async fetchBinanceFutures(
    symbol: string,
    base: DerivativesTelemetrySnapshot,
    nowMs: number
  ): Promise<DerivativesTelemetrySnapshot> {
    const clean = stripPerpSuffix(symbol);
    const [premium, oi, ticker] = await Promise.all([
      this.fetchJson<any>(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(clean)}`),
      this.fetchJson<any>(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${encodeURIComponent(clean)}`),
      this.fetchJson<any>(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(clean)}`),
    ]);

    const markPrice = toFiniteNumber(premium?.markPrice);
    const lastPrice = toFiniteNumber(ticker?.lastPrice);
    const price = lastPrice ?? markPrice ?? base.price;
    const change24hPct = toFiniteNumber(ticker?.priceChangePercent) ?? base.change24hPct;
    const volume24hUsd = toFiniteNumber(ticker?.quoteVolume) ?? base.volume24hUsd;

    const oiQty = toFiniteNumber(oi?.openInterest);
    const oiRefPrice = markPrice ?? price;
    const openInterestUsd = oiQty !== null && oiRefPrice !== null ? oiQty * oiRefPrice : null;

    const fundingRate = toFiniteNumber(premium?.lastFundingRate);
    const nextFundingTimeMs = toFiniteNumber(premium?.nextFundingTime);

    return {
      ...base,
      price,
      change24hPct,
      volume24hUsd,
      openInterestUsd,
      fundingRate,
      nextFundingTimeMs,
      countdownText: formatFundingCountdown(nextFundingTimeMs, nowMs),
      updatedAt: nowMs,
      loading: false,
    };
  }

  private async fetchBinanceSpot(
    symbol: string,
    base: DerivativesTelemetrySnapshot,
    nowMs: number
  ): Promise<DerivativesTelemetrySnapshot> {
    const clean = stripPerpSuffix(symbol);
    const ticker = await this.fetchJson<any>(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(clean)}`
    );
    if (!ticker) return base;

    return {
      ...base,
      price: toFiniteNumber(ticker.lastPrice) ?? base.price,
      change24hPct: toFiniteNumber(ticker.priceChangePercent) ?? base.change24hPct,
      volume24hUsd: toFiniteNumber(ticker.quoteVolume) ?? base.volume24hUsd,
      updatedAt: nowMs,
      loading: false,
    };
  }

  private async fetchBitunixFutures(
    symbol: string,
    base: DerivativesTelemetrySnapshot,
    nowMs: number
  ): Promise<DerivativesTelemetrySnapshot> {
    const clean = stripPerpSuffix(symbol);
    const [tickersRes, fundingRes] = await Promise.all([
      this.fetchJson<any>(
        `https://fapi.bitunix.com/api/v1/futures/market/tickers?symbols=${encodeURIComponent(clean)}`
      ),
      this.fetchJson<any>(
        `https://fapi.bitunix.com/api/v1/futures/market/funding_rate?symbol=${encodeURIComponent(clean)}`
      ),
    ]);

    const tickerList = Array.isArray(tickersRes?.data) ? tickersRes.data : [];
    const tickerItem =
      tickerList.find((item: any) => String(item?.symbol || '').toUpperCase() === clean) ||
      tickerList[0] ||
      null;

    const lastPrice = toFiniteNumber(tickerItem?.lastPrice ?? tickerItem?.last) ?? base.price;
    const openPrice = toFiniteNumber(tickerItem?.open);
    const change24hPct =
      lastPrice !== null && openPrice !== null && openPrice > 0
        ? ((lastPrice - openPrice) / openPrice) * 100
        : base.change24hPct;
    const volume24hUsd =
      toFiniteNumber(tickerItem?.quoteVol ?? tickerItem?.quoteVolume ?? tickerItem?.baseVol) ??
      base.volume24hUsd;

    const fundingRaw = Array.isArray(fundingRes?.data) ? fundingRes.data[0] : fundingRes?.data;
    const fundingRate = toFiniteNumber(
      fundingRaw?.fundingRate ?? fundingRaw?.lastFundingRate ?? tickerItem?.fundingRate
    );
    const nextFundingTimeMs = toFiniteNumber(
      fundingRaw?.nextFundingTime ?? fundingRaw?.nextSettleTime ?? tickerItem?.nextFundingTime
    );

    const oiQty = toFiniteNumber(
      tickerItem?.openInterest ?? tickerItem?.positionAmount ?? fundingRaw?.openInterest
    );
    const openInterestUsd =
      oiQty !== null && lastPrice !== null ? oiQty * lastPrice : toFiniteNumber(tickerItem?.openInterestUsd);

    return {
      ...base,
      price: lastPrice,
      change24hPct,
      volume24hUsd,
      openInterestUsd,
      fundingRate,
      nextFundingTimeMs,
      countdownText: formatFundingCountdown(nextFundingTimeMs, nowMs),
      updatedAt: nowMs,
      loading: false,
    };
  }

  private async fetchHyperliquidFutures(
    symbol: string,
    base: DerivativesTelemetrySnapshot,
    nowMs: number
  ): Promise<DerivativesTelemetrySnapshot> {
    const coin = normalizeHyperliquidCoin(symbol);
    const json = await this.fetchJson<any>('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });

    const universe = Array.isArray(json?.[0]?.universe) ? json[0].universe : [];
    const ctxs = Array.isArray(json?.[1]) ? json[1] : [];
    const idx = universe.findIndex((u: any) => String(u?.name || '').toUpperCase() === coin);
    if (idx < 0 || !ctxs[idx]) return base;

    const ctx = ctxs[idx];
    const markPx = toFiniteNumber(ctx.markPx ?? ctx.midPx);
    const prevDayPx = toFiniteNumber(ctx.prevDayPx);
    const change24hPct =
      markPx !== null && prevDayPx !== null && prevDayPx > 0
        ? ((markPx - prevDayPx) / prevDayPx) * 100
        : base.change24hPct;
    const volume24hUsd = toFiniteNumber(ctx.dayNtlVlm) ?? base.volume24hUsd;
    const oiQty = toFiniteNumber(ctx.openInterest);
    const openInterestUsd = oiQty !== null && markPx !== null ? oiQty * markPx : null;
    const fundingRate = toFiniteNumber(ctx.funding);
    const nextFundingTimeMs = getNextHourlyFundingMs(nowMs);

    return {
      ...base,
      price: markPx ?? base.price,
      change24hPct,
      volume24hUsd,
      openInterestUsd,
      fundingRate,
      nextFundingTimeMs,
      countdownText: formatFundingCountdown(nextFundingTimeMs, nowMs),
      updatedAt: nowMs,
      loading: false,
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }
}

export const derivativesTelemetryService = new DerivativesTelemetryService();
