// Adapter Pasar untuk Custom Node / Proxy Endpoint yang didaftarkan pengguna
import type { MarketProviderAdapter } from '../types';
import type { Candle, TickerInfo, MarketSearchResult, ProviderConfig } from '../../../types/market';
import { VERIFIED_CRYPTO_ASSETS } from '../constants';
import { CustomFeedProvider } from '../../customProvider';
import { universalFetch } from '../../httpClient';

export class CustomFeedAdapter implements MarketProviderAdapter {
  id: string;
  name: string;
  private config: ProviderConfig;
  private provider: CustomFeedProvider;
  private timeoutMs: number;

  constructor(config: ProviderConfig, options: { timeoutMs?: number } = {}) {
    this.config = { ...config };
    this.id = config.id;
    this.name = config.name || 'Custom Feed';
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.provider = new CustomFeedProvider({
      providerId: config.id,
      name: config.name,
      restUrl: config.rest_url,
      wsUrl: config.ws_url,
      timeoutMs: this.timeoutMs,
    });
  }

  public updateConfig(config: ProviderConfig): void {
    this.config = { ...config };
    this.name = config.name || this.name;
    this.provider = new CustomFeedProvider({
      providerId: config.id,
      name: config.name,
      restUrl: config.rest_url,
      wsUrl: config.ws_url,
      timeoutMs: this.timeoutMs,
    });
  }

  async fetchTicker(symbol: string): Promise<TickerInfo> {
    const cleanSym = this.provider.normalizeSymbol(symbol);
    const baseUrl = (this.config.rest_url || '').trim();

    // 1. Jika endpoint dasar berupa root URL (tanpa query string), coba endpoint /ticker opsional terlebih dahulu
    if (baseUrl && !baseUrl.includes('?')) {
      try {
        const tickerUrl = `${baseUrl.replace(/\/+$/, '')}/ticker?symbol=${encodeURIComponent(cleanSym)}`;
        const res = await universalFetch(tickerUrl, { timeoutMs: Math.min(this.timeoutMs, 4000) });
        if (res.ok) {
          const data = await res.json();
          const px = parseFloat(
            data?.price ?? data?.lastPrice ?? data?.close ?? data?.last ?? '0'
          );
          if (Number.isFinite(px) && px > 0) {
            return {
              symbol,
              name: symbol,
              price: px,
              change24h: parseFloat(data?.change24h ?? data?.priceChangePercent ?? '0') || 0,
              high24h: parseFloat(data?.high24h ?? data?.high ?? String(px)) || px,
              low24h: parseFloat(data?.low24h ?? data?.low ?? String(px)) || px,
              volume24h: parseFloat(data?.volume24h ?? data?.volume ?? '0') || 0,
            };
          }
        }
      } catch (_) {
        // Endpoint /ticker bersifat opsional; lanjutkan ke fallback /klines
      }
    }

    // 2. Fallback kanonikal: turunkan harga & ringkasan dari candle /klines terbaru
    const candles = await this.fetchCandles(cleanSym, '15m', 24);
    if (candles.length > 0) {
      const latest = candles[candles.length - 1];
      const first = candles[0];
      const change24h =
        first.open > 0 ? Number((((latest.close - first.open) / first.open) * 100).toFixed(2)) : 0;
      const high24h = Math.max(...candles.map((c) => c.high));
      const low24h = Math.min(...candles.map((c) => c.low));
      const volume24h = candles.reduce((sum, c) => sum + (c.volume || 0), 0);

      return {
        symbol,
        name: symbol,
        price: latest.close,
        change24h,
        high24h,
        low24h,
        volume24h,
      };
    }

    return {
      symbol,
      name: symbol,
      price: 0,
      change24h: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
    };
  }

  async fetchBatchTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
    if (!symbols || symbols.length === 0) return {};
    const resultMap: Record<string, TickerInfo> = {};
    let lastError: any = null;

    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const chunk = symbols.slice(i, i + batchSize);
      const settled = await Promise.allSettled(chunk.map((s) => this.fetchTicker(s)));
      for (let j = 0; j < settled.length; j++) {
        const res = settled[j];
        const sym = chunk[j];
        if (res.status === 'fulfilled') {
          if (res.value.price > 0) {
            resultMap[sym] = res.value;
          }
        } else {
          lastError = res.reason;
          console.warn(`[CustomFeedAdapter:${this.id}] Gagal fetch ticker ${sym}:`, res.reason);
        }
      }
    }

    if (Object.keys(resultMap).length === 0 && lastError) {
      throw lastError;
    }

    return resultMap;
  }

  async fetchCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const bars = await this.provider.fetchBarsStrict(symbol, interval, {
      limit,
      countBack: limit,
    });
    return bars.map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume ?? 0,
    }));
  }

  async searchSymbols(
    query: string,
    filterType: 'all' | 'spot' | 'perp' = 'all'
  ): Promise<MarketSearchResult[]> {
    const q = query.trim().toUpperCase();
    const results: MarketSearchResult[] = [];

    for (const asset of VERIFIED_CRYPTO_ASSETS) {
      const sym = `${asset.base}USDT`;
      const match =
        !q ||
        asset.base.includes(q) ||
        asset.name.toUpperCase().includes(q) ||
        sym.includes(q);
      if (match && (filterType === 'all' || filterType === 'spot')) {
        results.push({
          symbol: sym,
          baseAsset: asset.base,
          quoteAsset: 'USDT',
          displayName: `${asset.name} (${this.name})`,
          type: 'spot',
          provider: this.name,
        });
      }
    }

    if (q && !results.some((r) => r.symbol.startsWith(q))) {
      const clean = q.replace(/\.P$/i, '');
      results.unshift({
        symbol: clean,
        baseAsset: clean.replace(/(USDT|USDC|USD)$/i, '') || clean,
        quoteAsset: clean.endsWith('USDC') ? 'USDC' : 'USDT',
        displayName: `${clean} (${this.name})`,
        type: q.endsWith('.P') ? 'perp' : 'spot',
        provider: this.name,
      });
    }

    return results.slice(0, 30);
  }
}
