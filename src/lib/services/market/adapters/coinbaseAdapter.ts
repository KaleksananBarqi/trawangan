// Adapter Pasar Bursa Coinbase Exchange (Regulated US Spot)
import type { MarketProviderAdapter } from '../types';
import type { Candle, TickerInfo, MarketSearchResult } from '../../../types/market';
import { VERIFIED_CRYPTO_ASSETS, fetchTickersInChunks } from '../constants';
import { normalizeCoinbaseProductId } from '../../instrumentIdentity';
import { fromVelaTimeframe, toExchangeInterval } from '../../../utils/timeframeAdapter';
import { universalFetch } from '../../httpClient';

export { normalizeCoinbaseProductId };

const COINBASE_REST_BASE = 'https://api.exchange.coinbase.com';
const MAX_CANDLES_PER_REQ = 300;

const GRANULARITY_MAP: Record<string, number> = {
  '1m': 60,
  '3m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 900,
  '1h': 3600,
  '2h': 3600,
  '4h': 3600,
  '6h': 21600,
  '12h': 21600,
  '1d': 86400,
  '1w': 86400,
  '1M': 86400,
};

export class CoinbaseAdapter implements MarketProviderAdapter {
  id = 'coinbase';
  name = 'Coinbase Exchange Spot';
  private timeoutMs: number;

  constructor(options: { timeoutMs?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  async fetchTicker(symbol: string): Promise<TickerInfo> {
    const product = normalizeCoinbaseProductId(symbol);
    const reqHeaders = { Accept: 'application/json' };

    const [statsRes, tickerRes] = await Promise.allSettled([
      universalFetch(`${COINBASE_REST_BASE}/products/${product}/stats`, {
        headers: reqHeaders,
        timeoutMs: this.timeoutMs,
      }),
      universalFetch(`${COINBASE_REST_BASE}/products/${product}/ticker`, {
        headers: reqHeaders,
        timeoutMs: this.timeoutMs,
      }),
    ]);

    let statsData: any = null;
    let tickerData: any = null;
    let firstError: any = null;

    if (statsRes.status === 'fulfilled') {
      if (statsRes.value.ok) {
        statsData = await statsRes.value.json().catch(() => null);
      } else {
        firstError = firstError || new Error(`Coinbase Stats HTTP ${statsRes.value.status} ${statsRes.value.statusText}`);
      }
    } else {
      firstError = firstError || statsRes.reason;
    }

    if (tickerRes.status === 'fulfilled') {
      if (tickerRes.value.ok) {
        tickerData = await tickerRes.value.json().catch(() => null);
      } else {
        firstError = firstError || new Error(`Coinbase Ticker HTTP ${tickerRes.value.status} ${tickerRes.value.statusText}`);
      }
    } else {
      firstError = firstError || tickerRes.reason;
    }

    if (!statsData && !tickerData) {
      throw firstError || new Error(`Gagal mengambil ticker Coinbase untuk ${product}`);
    }

    const tickerPrice = parseFloat(tickerData?.price || '0');
    const statsLast = parseFloat(statsData?.last || '0');
    const price = Number.isFinite(tickerPrice) && tickerPrice > 0 ? tickerPrice : statsLast;

    const open = parseFloat(statsData?.open || '0');
    const high24h = parseFloat(statsData?.high || String(price)) || price;
    const low24h = parseFloat(statsData?.low || String(price)) || price;
    const volume24h = parseFloat(tickerData?.volume || statsData?.volume || '0') || 0;
    const change24h =
      open > 0 && price > 0 ? Number((((price - open) / open) * 100).toFixed(2)) : 0;

    return {
      symbol,
      name: symbol,
      price: Number.isFinite(price) ? price : 0,
      change24h,
      high24h,
      low24h,
      volume24h,
    };
  }

  async fetchBatchTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
    // Eksekusi paralel berbatas agar aman dari rate limit API Coinbase Exchange
    return fetchTickersInChunks(symbols, (sym) => this.fetchTicker(sym), 'CoinbaseAdapter');
  }

  async fetchCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const product = normalizeCoinbaseProductId(symbol);
    const exInterval = toExchangeInterval(fromVelaTimeframe(interval), 'coinbase');
    const granSec = GRANULARITY_MAP[exInterval] ?? 900;
    const granMs = granSec * 1000;
    const wantLimit = Math.max(limit, 1);

    const byTime = new Map<number, Candle>();
    let cursorEndMs = Date.now();
    const maxPages = Math.min(Math.ceil(wantLimit / MAX_CANDLES_PER_REQ), 4);

    for (let page = 0; page < maxPages && byTime.size < wantLimit; page++) {
      const remaining = wantLimit - byTime.size;
      const size = Math.min(remaining, MAX_CANDLES_PER_REQ);
      const startMs = cursorEndMs - size * granMs;

      const url = new URL(`${COINBASE_REST_BASE}/products/${product}/candles`);
      url.searchParams.set('granularity', String(granSec));
      url.searchParams.set('start', String(Math.floor(startMs / 1000)));
      url.searchParams.set('end', String(Math.floor(cursorEndMs / 1000)));

      const res = await universalFetch(url.toString(), {
        headers: { Accept: 'application/json' },
        timeoutMs: this.timeoutMs,
      });

      if (!res.ok) {
        throw new Error(`Coinbase Candles HTTP ${res.status} ${res.statusText}`);
      }

      const raw = await res.json();
      if (!Array.isArray(raw)) {
        throw new Error(`Payload candle Coinbase tidak valid untuk ${product}`);
      }

      if (raw.length === 0) break;

      let oldestMs = Infinity;
      for (const row of raw) {
        if (!Array.isArray(row) || row.length < 5) continue;
        // Format Coinbase Exchange: [timeSec, low, high, open, close, volume]
        const rawT = Number(row[0]);
        const time = rawT > 0 && rawT < 1e11 ? rawT * 1000 : rawT;
        const low = Number(row[1]);
        const high = Number(row[2]);
        const open = Number(row[3]);
        const close = Number(row[4]);
        const volume = Number(row[5] ?? 0) || 0;

        if (!Number.isFinite(time) || time <= 0 || !Number.isFinite(open) || !Number.isFinite(close)) {
          continue;
        }
        oldestMs = Math.min(oldestMs, time);
        byTime.set(time, { time, open, high, low, close, volume });
      }

      if (!Number.isFinite(oldestMs) || raw.length < size) break;
      cursorEndMs = oldestMs - 1;
    }

    const sorted = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
    return sorted.length > wantLimit ? sorted.slice(-wantLimit) : sorted;
  }

  async searchSymbols(
    query: string,
    filterType: 'all' | 'spot' | 'perp' = 'all'
  ): Promise<MarketSearchResult[]> {
    // Coinbase Exchange hanya melayani Spot
    if (filterType === 'perp') {
      return [];
    }

    const q = query.trim().toUpperCase();
    const results: MarketSearchResult[] = [];

    for (const asset of VERIFIED_CRYPTO_ASSETS) {
      const sym = `${asset.base}-USD`;
      const match =
        !q ||
        asset.base.includes(q) ||
        asset.name.toUpperCase().includes(q) ||
        sym.includes(q) ||
        `${asset.base}USD`.includes(q);

      if (match) {
        results.push({
          symbol: sym,
          baseAsset: asset.base,
          quoteAsset: 'USD',
          displayName: `${asset.name} / USD Spot`,
          type: 'spot',
          provider: 'Coinbase Spot',
        });
      }
    }

    if (q) {
      const normalized = normalizeCoinbaseProductId(q);
      const [base, quote = 'USD'] = normalized.split('-');
      if (base && !results.some((r) => r.symbol === normalized)) {
        results.unshift({
          symbol: normalized,
          baseAsset: base,
          quoteAsset: quote,
          displayName: `${base} / ${quote} Spot (Coinbase)`,
          type: 'spot',
          provider: 'Coinbase Spot',
        });
      }
    }

    return results.slice(0, 30);
  }
}
