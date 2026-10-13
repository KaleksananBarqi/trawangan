// Adapter Pasar Bursa Bitunix Futures
import type { MarketProviderAdapter } from '../types';
import type { Candle, TickerInfo, MarketSearchResult } from '../../../types/market';
import { normalizeTicker, VERIFIED_CRYPTO_ASSETS } from '../constants';

export class BitunixAdapter implements MarketProviderAdapter {
  id = 'bitunix';
  name = 'Bitunix Futures (USDT-M)';

  async fetchTicker(symbol: string): Promise<TickerInfo> {
    const clean = normalizeTicker(symbol).replace(/\.P$/i, '').toUpperCase();
    try {
      const res = await fetch(`https://fapi.bitunix.com/api/v1/futures/market/ticker?symbol=${clean}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.code === 0 && json.data) {
          const d = json.data;
          const last = parseFloat(d.lastPrice || d.last || '0');
          const open = parseFloat(d.open || '0');
          const change = open > 0 ? ((last - open) / open) * 100 : 0;
          return {
            symbol,
            name: symbol,
            price: last,
            change24h: change,
            high24h: parseFloat(d.high || '0'),
            low24h: parseFloat(d.low || '0'),
            volume24h: parseFloat(d.baseVol || d.quoteVol || '0'),
          };
        }
      }
    } catch (err) {
      console.warn('[BitunixAdapter] Gagal fetch ticker, beralih ke batch:', err);
    }

    // Fallback ambil dari batch
    const batch = await this.fetchBatchTickers([symbol]);
    return (
      batch[symbol] || {
        symbol,
        name: symbol,
        price: 0,
        change24h: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
      }
    );
  }

  async fetchBatchTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
    if (!symbols || symbols.length === 0) return {};
    const resultMap: Record<string, TickerInfo> = {};

    try {
      const res = await fetch('https://fapi.bitunix.com/api/v1/futures/market/tickers');
      if (res.ok) {
        const json = await res.json();
        if (json && json.code === 0 && Array.isArray(json.data)) {
          const map = new Map<string, any>();
          for (const item of json.data) {
            const sym = item.symbol;
            const last = parseFloat(item.lastPrice || item.last || '0');
            const open = parseFloat(item.open || '0');
            const change = open > 0 ? ((last - open) / open) * 100 : 0;
            map.set(sym, {
              price: last,
              change24h: change,
              high24h: parseFloat(item.high || '0'),
              low24h: parseFloat(item.low || '0'),
              volume24h: parseFloat(item.baseVol || item.quoteVol || '0'),
            });
          }

          for (const s of symbols) {
            const bare = normalizeTicker(s).replace(/\.P$/i, '').toUpperCase();
            const found = map.get(bare);
            if (found) {
              resultMap[s] = {
                symbol: s,
                name: s,
                ...found,
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('[BitunixAdapter] Gagal fetch batch tickers:', err);
    }

    return resultMap;
  }

  async fetchCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const clean = normalizeTicker(symbol).replace(/\.P$/i, '').toUpperCase();
    const cleanTf = interval.toLowerCase();

    try {
      const res = await fetch(
        `https://fapi.bitunix.com/api/v1/futures/market/tradingview/history?symbol=${clean}&resolution=${cleanTf}&countback=${limit}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json && json.s === 'ok' && Array.isArray(json.t)) {
          const len = json.t.length;
          const candles: Candle[] = new Array(len);
          for (let i = 0; i < len; i++) {
            candles[i] = {
              time: json.t[i] * 1000,
              open: json.o[i],
              high: json.h[i],
              low: json.l[i],
              close: json.c[i],
              volume: json.v ? json.v[i] : 0,
            };
          }
          return candles;
        }
      }
    } catch (err) {
      console.warn('[BitunixAdapter] Gagal fetch candles:', err);
    }

    return [];
  }

  async searchSymbols(
    query: string,
    filterType: 'all' | 'spot' | 'perp' = 'all'
  ): Promise<MarketSearchResult[]> {
    const q = query.trim().toUpperCase();
    const results: MarketSearchResult[] = [];

    for (const asset of VERIFIED_CRYPTO_ASSETS) {
      const match =
        !q ||
        asset.base.includes(q) ||
        asset.name.toUpperCase().includes(q) ||
        `${asset.base}USDT`.includes(q);

      if (match) {
        if (filterType === 'all' || filterType === 'perp') {
          results.push({
            symbol: `${asset.base}USDT.P`,
            baseAsset: asset.base,
            quoteAsset: 'USDT',
            displayName: `${asset.name} Perpetual`,
            type: 'perp',
            provider: 'Bitunix Futures',
          });
        }
      }
    }

    return results.slice(0, 30);
  }
}
