// Adapter Pasar Bursa Indodax (Spot IDR & USDT)
import type { MarketProviderAdapter } from '../types';
import type { Candle, TickerInfo, MarketSearchResult } from '../../../types/market';
import { IndodaxProvider } from '../../indodaxProvider';
import { universalFetch } from '../../httpClient';

interface IndodaxPairInfo {
  id: string;
  symbol: string;
  base_currency: string;
  traded_currency: string;
  description: string;
  ticker_id: string;
}

export class IndodaxAdapter implements MarketProviderAdapter {
  id = 'indodax';
  name = 'Indodax Official Spot';

  private provider = new IndodaxProvider();
  private pairsCache: IndodaxPairInfo[] | null = null;
  private pairsCacheTime = 0;

  /**
   * Mengubah format simbol Trawangan (BTCIDR, BTC/IDR, btc_idr) ke key map Indodax (btc_idr)
   */
  private toTickerKey(sym: string): string {
    const clean = sym.replace(/^indodax:/i, '').replace(/[\/\-_]/g, '').toLowerCase();
    if (clean.endsWith('idr')) {
      const base = clean.slice(0, -3);
      return `${base}_idr`;
    }
    if (clean.endsWith('usdt')) {
      const base = clean.slice(0, -4);
      return `${base}_usdt`;
    }
    return `${clean}_idr`;
  }

  /**
   * Parse data ticker mentah dari map ticker_all Indodax
   */
  parseTickerFromMap(symbol: string, tickersMap: Record<string, any>): TickerInfo | null {
    if (!tickersMap) return null;
    const key = this.toTickerKey(symbol);
    const data = tickersMap[key];
    if (!data) return null;

    const last = parseFloat(data.last) || 0;
    const high = parseFloat(data.high) || 0;
    const low = parseFloat(data.low) || 0;
    const buy = parseFloat(data.buy) || 0;
    const vol = parseFloat(data.vol_idr || data.vol_usdt || data[Object.keys(data).find(k => k.startsWith('vol_')) || '']) || 0;

    // Estimasi persentase perubahan 24h jika tidak disediakan langsung oleh endpoint ticker_all
    let change24h = 0;
    if (buy > 0 && last > 0) {
      change24h = parseFloat((((last - buy) / buy) * 100).toFixed(2));
    }

    const cleanSymbol = symbol.replace(/^indodax:/i, '').replace(/[\/\-_]/g, '').toUpperCase();

    return {
      symbol: cleanSymbol,
      name: cleanSymbol,
      price: last,
      change24h,
      high24h: high,
      low24h: low,
      volume24h: vol,
    };
  }

  async fetchTicker(symbol: string): Promise<TickerInfo> {
    try {
      const res = await universalFetch('https://indodax.com/api/ticker_all');
      if (res.ok) {
        const json = await res.json();
        const parsed = this.parseTickerFromMap(symbol, json.tickers || json);
        if (parsed) return parsed;
      }
    } catch (err) {
      console.warn('[IndodaxAdapter] Gagal fetch ticker:', err);
    }

    const cleanSymbol = symbol.replace(/^indodax:/i, '').replace(/[\/\-_]/g, '').toUpperCase();
    return {
      symbol: cleanSymbol,
      name: cleanSymbol,
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

    try {
      const res = await universalFetch('https://indodax.com/api/ticker_all');
      if (res.ok) {
        const json = await res.json();
        const tickersMap = json.tickers || json;
        for (const s of symbols) {
          const parsed = this.parseTickerFromMap(s, tickersMap);
          if (parsed) {
            resultMap[s] = parsed;
          }
        }
      }
    } catch (err) {
      console.warn('[IndodaxAdapter] Gagal fetch batch tickers:', err);
    }

    return resultMap;
  }

  async fetchCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const bars = await this.provider.getBars(symbol, interval, { countBack: limit });
    return bars.map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume || 0,
    }));
  }

  private async fetchPairs(): Promise<IndodaxPairInfo[]> {
    const now = Date.now();
    if (this.pairsCache && now - this.pairsCacheTime < 300000) {
      return this.pairsCache;
    }
    try {
      const res = await universalFetch('https://indodax.com/api/pairs');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          this.pairsCache = json;
          this.pairsCacheTime = now;
          return json;
        }
      }
    } catch (err) {
      console.warn('[IndodaxAdapter] Gagal fetch pairs:', err);
    }
    return this.pairsCache || [];
  }

  async searchSymbols(
    query: string,
    filterType: 'all' | 'spot' | 'perp' = 'all'
  ): Promise<MarketSearchResult[]> {
    // Indodax hanya menyediakan pasar Spot
    if (filterType === 'perp') {
      return [];
    }

    const q = query.trim().toUpperCase().replace(/[\/\-_]/g, '');
    const pairs = await this.fetchPairs();
    const results: MarketSearchResult[] = [];

    for (const p of pairs) {
      const base = (p.traded_currency || '').toUpperCase();
      const quote = (p.base_currency || '').toUpperCase();
      const full = `${base}${quote}`;

      const match =
        !q ||
        base.includes(q) ||
        full.includes(q) ||
        (p.description || '').toUpperCase().includes(q);

      if (match) {
        results.push({
          symbol: full,
          baseAsset: base,
          quoteAsset: quote,
          displayName: `${p.description || `${base}/${quote}`} Spot`,
          type: 'spot',
          provider: 'Indodax Spot',
        });
      }
    }

    // Fallback jika API pairs tidak merespons
    if (results.length === 0 && q) {
      const cleanBase = q.replace(/IDR$/i, '').replace(/USDT$/i, '');
      results.push({
        symbol: `${cleanBase}IDR`,
        baseAsset: cleanBase,
        quoteAsset: 'IDR',
        displayName: `${cleanBase}/IDR Spot Pair`,
        type: 'spot',
        provider: 'Indodax Spot',
      });
    }

    return results.slice(0, 30);
  }
}
