// Adapter Mock / In-Memory untuk Pengujian Otomatis dan Lingkungan Offline
import type { MarketProviderAdapter } from '../types';
import type { Candle, TickerInfo, MarketSearchResult } from '../../../types/market';
import { normalizeTicker } from '../constants';

export class MockMarketAdapter implements MarketProviderAdapter {
  id = 'mock';
  name = 'Mock Simulation Provider';

  private mockPrices = new Map<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number }>();

  constructor() {
    this.setMockPrice('BTCUSDT', 68500, 2.5, 69200, 67800, 1500000000);
    this.setMockPrice('ETHUSDT', 3500, -1.2, 3580, 3420, 800000000);
    this.setMockPrice('SOLUSDT', 180, 5.4, 185, 172, 450000000);
  }

  public setMockPrice(
    symbol: string,
    price: number,
    change24h = 0,
    high24h = price * 1.02,
    low24h = price * 0.98,
    volume24h = 1000000
  ) {
    const clean = normalizeTicker(symbol);
    this.mockPrices.set(clean, { price, change24h, high24h, low24h, volume24h });
  }

  async fetchTicker(symbol: string): Promise<TickerInfo> {
    const clean = normalizeTicker(symbol);
    const data = this.mockPrices.get(clean) || {
      price: 100,
      change24h: 0,
      high24h: 102,
      low24h: 98,
      volume24h: 10000,
    };

    return {
      symbol,
      name: symbol,
      ...data,
    };
  }

  async fetchBatchTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
    const result: Record<string, TickerInfo> = {};
    for (const sym of symbols) {
      result[sym] = await this.fetchTicker(sym);
    }
    return result;
  }

  async fetchCandles(symbol: string, interval: string, limit = 100): Promise<Candle[]> {
    const clean = normalizeTicker(symbol);
    const basePrice = (this.mockPrices.get(clean)?.price) || 100;
    const now = Date.now();
    const intervalMs = 60 * 1000;

    const candles: Candle[] = [];
    for (let i = limit - 1; i >= 0; i--) {
      const time = now - i * intervalMs;
      const open = basePrice + Math.sin(i) * 5;
      const close = open + (i % 2 === 0 ? 1 : -1) * 2;
      const high = Math.max(open, close) + 1.5;
      const low = Math.min(open, close) - 1.5;
      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume: 100 + i * 5,
      });
    }
    return candles;
  }

  async searchSymbols(
    query: string,
    _filterType: 'all' | 'spot' | 'perp' = 'all'
  ): Promise<MarketSearchResult[]> {
    const q = query.toUpperCase();
    const results: MarketSearchResult[] = [
      {
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        displayName: 'Bitcoin Spot',
        type: 'spot',
        provider: 'Mock Provider',
      },
      {
        symbol: 'BTCUSDT.P',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        displayName: 'Bitcoin Perpetual',
        type: 'perp',
        provider: 'Mock Provider',
      },
    ];
    return results.filter((s) => !q || s.symbol.includes(q));
  }
}
