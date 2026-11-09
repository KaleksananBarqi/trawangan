// Adapter Pasar Bursa Yahoo Finance (Saham Indo IDX, Logam Mulia USD, Indeks AS)
import type { MarketProviderAdapter } from '../types';
import type { Candle, TickerInfo, MarketSearchResult } from '../../../types/market';
import { YahooFinanceProvider } from '../../yahooFinanceProvider';
import { universalFetch } from '../../httpClient';

export class YahooFinanceAdapter implements MarketProviderAdapter {
  id = 'yahoo';
  name = 'Yahoo Finance (Delayed 15m)';
  private provider = new YahooFinanceProvider();

  async fetchTicker(symbol: string): Promise<TickerInfo> {
    const clean = this.provider.cleanYahooTicker(symbol);
    const encoded = encodeURIComponent(clean);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=2d`;

    try {
      const res = await universalFetch(url);
      if (res.ok) {
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice ?? 0;
          const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
          const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

          return {
            symbol: clean,
            name: meta.shortName || meta.longName || clean,
            price,
            change24h,
            high24h: meta.regularMarketDayHigh ?? price,
            low24h: meta.regularMarketDayLow ?? price,
            volume24h: meta.regularMarketVolume ?? 0,
          };
        }
      }
    } catch (err) {
      console.warn(`[YahooFinanceAdapter] fetchTicker failed for ${clean}:`, err);
    }

    return {
      symbol: clean,
      name: clean,
      price: 0,
      change24h: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
    };
  }

  async fetchBatchTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
    if (!symbols || symbols.length === 0) return {};
    const results: Record<string, TickerInfo> = {};

    // Eksekusi paralel berbatas untuk menghindari rate limiting
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const chunk = symbols.slice(i, i + batchSize);
      await Promise.all(
        chunk.map(async (s) => {
          results[s] = await this.fetchTicker(s);
        })
      );
    }

    return results;
  }

  async fetchCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const bars = await this.provider.getBars(symbol, interval, { countBack: limit });
    return bars.map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume ?? 0,
    }));
  }

  async searchSymbols(query: string, filterType?: 'all' | 'spot' | 'perp'): Promise<MarketSearchResult[]> {
    if (!query || query.trim().length === 0) return [];
    const q = query.trim();
    const encoded = encodeURIComponent(q);
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encoded}&quotesCount=10&newsCount=0`;

    try {
      const res = await universalFetch(url);
      if (res.ok) {
        const json = await res.json();
        const quotes = json?.quotes || [];
        const results: MarketSearchResult[] = [];

        for (const item of quotes) {
          const sym = item.symbol;
          if (!sym) continue;

          const isIdr = sym.endsWith('.JK');
          const isGold = sym === 'GC=F' || sym === 'SI=F';
          const quoteAsset = isIdr ? 'IDR' : 'USD';
          const baseAsset = sym.replace(/\.JK$|=F$|^\^/g, '');

          results.push({
            symbol: sym,
            displayName: item.shortname || item.longname || sym,
            baseAsset,
            quoteAsset,
            provider: 'Yahoo Finance',
            type: 'spot',
          });
        }
        return results;
      }
    } catch (err) {
      console.warn(`[YahooFinanceAdapter] searchSymbols failed for ${query}:`, err);
    }

    return [];
  }
}
