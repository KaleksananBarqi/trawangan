// Adapter Pasar Bursa Binance (Spot & USD-M Futures)
import type { MarketProviderAdapter } from '../types';
import type { Candle, TickerInfo, MarketSearchResult } from '../../../types/market';
import { normalizeTicker, VERIFIED_CRYPTO_ASSETS } from '../constants';
import { toExchangeInterval } from '../../../utils/timeframeAdapter';
import { parseAdaptiveSymbol } from '../symbolSearchService';
import { universalFetch } from '../../httpClient';

export class BinanceAdapter implements MarketProviderAdapter {
  id = 'binance';
  name = 'Binance Official Public';
  private timeoutMs: number;

  constructor(options: { timeoutMs?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  private isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  async fetchTicker(symbol: string): Promise<TickerInfo> {
    const normalized = normalizeTicker(symbol);
    const isPerp = normalized.endsWith('.P');
    const clean = normalized.replace(/\.P$/i, '');

    if (isPerp) {
      try {
        const res = await universalFetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${clean}`, {
          timeoutMs: this.timeoutMs,
        });
        if (res.ok) {
          const data = await res.json();
          return {
            symbol: `${clean}.P`,
            name: symbol,
            price: parseFloat(data.lastPrice),
            change24h: parseFloat(data.priceChangePercent),
            high24h: parseFloat(data.highPrice),
            low24h: parseFloat(data.lowPrice),
            volume24h: parseFloat(data.volume),
          };
        }
      } catch (err) {
        console.warn('[BinanceAdapter] Gagal fetch futures ticker:', err);
      }
    }

    try {
      const res = await universalFetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${clean}`, {
        timeoutMs: this.timeoutMs,
      });
      if (res.ok) {
        const data = await res.json();
        return {
          symbol: isPerp ? `${clean}.P` : clean,
          name: symbol,
          price: parseFloat(data.lastPrice),
          change24h: parseFloat(data.priceChangePercent),
          high24h: parseFloat(data.highPrice),
          low24h: parseFloat(data.lowPrice),
          volume24h: parseFloat(data.volume),
        };
      }
    } catch (err) {
      console.warn('[BinanceAdapter] Gagal fetch spot ticker:', err);
    }

    return {
      symbol: isPerp ? `${clean}.P` : clean,
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

    const spotSymbols: string[] = [];
    const perpSymbols: string[] = [];

    for (const s of symbols) {
      if (s.trim().toUpperCase().endsWith('.P')) {
        perpSymbols.push(s);
      } else {
        spotSymbols.push(s);
      }
    }

    let spotError: any = null;
    let perpError: any = null;

    // 1. Ambil Spot Tickers
    if (spotSymbols.length > 0) {
      const cleanSpots = spotSymbols.map((s) => normalizeTicker(s));
      try {
        const encoded = encodeURIComponent(JSON.stringify(cleanSpots));
        const res = await universalFetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encoded}`, {
          timeoutMs: this.timeoutMs,
        });
        if (!res.ok) {
          spotError = new Error(`Binance Spot Ticker HTTP ${res.status} ${res.statusText}`);
        } else {
          const data = await res.json();
          for (const item of data) {
            resultMap[item.symbol] = {
              symbol: item.symbol,
              name: item.symbol,
              price: parseFloat(item.lastPrice),
              change24h: parseFloat(item.priceChangePercent),
              high24h: parseFloat(item.highPrice),
              low24h: parseFloat(item.lowPrice),
              volume24h: parseFloat(item.volume),
            };
          }
        }
      } catch (err) {
        spotError = err;
        console.warn('[BinanceAdapter] Gagal fetch batch spot tickers:', err);
      }
    }

    // 2. Ambil Perpetuals Tickers
    if (perpSymbols.length > 0) {
      try {
        const fRes = await universalFetch('https://fapi.binance.com/fapi/v1/ticker/24hr', {
          timeoutMs: this.timeoutMs,
        });
        if (!fRes.ok) {
          perpError = new Error(`Binance Futures Ticker HTTP ${fRes.status} ${fRes.statusText}`);
        } else {
          const fData = await fRes.json();
          const fMap = new Map<string, any>();
          for (const item of fData) {
            fMap.set(item.symbol, {
              price: parseFloat(item.lastPrice),
              change24h: parseFloat(item.priceChangePercent),
              high24h: parseFloat(item.highPrice),
              low24h: parseFloat(item.lowPrice),
              volume24h: parseFloat(item.volume),
            });
          }

          for (const pSym of perpSymbols) {
            const bare = normalizeTicker(pSym).replace(/\.P$/i, '');
            const match = fMap.get(bare);
            if (match) {
              resultMap[pSym] = {
                symbol: pSym,
                name: pSym,
                ...match,
              };
            }
          }
        }
      } catch (fErr) {
        perpError = fErr;
        console.warn('[BinanceAdapter] Gagal fetch batch futures tickers:', fErr);
      }
    }

    // Lempar error bila seluruh kueri Binance gagal sehingga MarketFeedService Guard mencatat status terganggu
    if (Object.keys(resultMap).length === 0 && (spotError || perpError)) {
      throw perpError || spotError;
    }

    return resultMap;
  }

  async fetchCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const normalized = normalizeTicker(symbol);
    const isPerp = normalized.endsWith('.P');
    const cleanSymbol = normalized.replace(/\.P$/i, '');
    const exchangeInterval = toExchangeInterval(interval, 'binance');

    // Rust backend fetch_binance_klines hanya memanggil Spot (/api/v3/klines); kontrak .P langsung diarahkan ke fapi.binance.com
    if (this.isTauri() && !isPerp) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const data = await invoke<Candle[]>('fetch_candles', {
          symbol: cleanSymbol,
          interval: exchangeInterval,
          limit,
          providerId: 'binance',
        });
        if (data && data.length > 0) return data;
      } catch (err) {
        console.warn('[BinanceAdapter] Tauri fetch_candles gagal, fallback ke direct REST:', err);
      }
    }

    const baseUrl = isPerp
      ? 'https://fapi.binance.com/fapi/v1/klines'
      : 'https://api.binance.com/api/v3/klines';
    const res = await universalFetch(
      `${baseUrl}?symbol=${cleanSymbol}&interval=${exchangeInterval}&limit=${limit}`,
      { timeoutMs: this.timeoutMs }
    );
    if (!res.ok) {
      throw new Error(`Respon error dari Binance API: ${res.status} ${res.statusText}`);
    }
    const raw = await res.json();
    return raw.map((item: any[]) => ({
      time: Number(item[0]),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));
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
            provider: 'Binance Futures',
          });
        }
        if (filterType === 'all' || filterType === 'spot') {
          results.push({
            symbol: `${asset.base}USDT`,
            baseAsset: asset.base,
            quoteAsset: 'USDT',
            displayName: `${asset.name} Spot`,
            type: 'spot',
            provider: 'Binance Spot',
          });
        }
      }
    }

    if (q && !results.some((r) => r.symbol.startsWith(q))) {
      const parsed = parseAdaptiveSymbol(q);
      const isCryptoQuote = parsed.isQuoteExplicit && parsed.quoteAsset !== 'USDT' && parsed.quoteAsset !== 'USDC';
      if (isCryptoQuote) {
        // Venue Capability Guard: Pasangan kripto-ke-kripto (misal BTC, ETH quote) hanya tersedia di Spot, supresi sintesis Futures .P
        if (filterType === 'all' || filterType === 'spot') {
          results.unshift({
            symbol: `${parsed.baseAsset}${parsed.quoteAsset}`,
            baseAsset: parsed.baseAsset,
            quoteAsset: parsed.quoteAsset,
            displayName: `${parsed.baseAsset} / ${parsed.quoteAsset} Spot Pair`,
            type: 'spot',
            provider: 'Binance Spot',
          });
        }
      } else {
        const cleanBase = parsed.baseAsset || q.replace(/USDT$/i, '').replace(/\.P$/i, '');
        if (filterType === 'all' || filterType === 'perp') {
          results.unshift({
            symbol: `${cleanBase}USDT.P`,
            baseAsset: cleanBase,
            quoteAsset: 'USDT',
            displayName: `${cleanBase} Perpetual Contract`,
            type: 'perp',
            provider: 'Binance Futures',
          });
        }
        if (filterType === 'all' || filterType === 'spot') {
          results.unshift({
            symbol: `${cleanBase}USDT`,
            baseAsset: cleanBase,
            quoteAsset: 'USDT',
            displayName: `${cleanBase} Spot Pair`,
            type: 'spot',
            provider: 'Crypto Spot',
          });
        }
      }
    }

    return results.slice(0, 30);
  }
}
