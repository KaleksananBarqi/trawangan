// Adapter Pasar Bursa Hyperliquid DEX (Perpetuals & Spot)
import type { MarketProviderAdapter } from '../types';
import type { Candle, TickerInfo, MarketSearchResult } from '../../../types/market';
import { VERIFIED_CRYPTO_ASSETS } from '../constants';
import { fromVelaTimeframe, toExchangeInterval } from '../../../utils/timeframeAdapter';
import { universalFetch } from '../../httpClient';

const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';

const INTERVAL_MS_MAP: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000,
};

/**
 * Menormalkan simbol menuju nama coin / pair spot resmi Hyperliquid
 * (contoh: 'BTCUSDT' -> 'BTC', 'PURR/USDC' -> 'PURR/USDC')
 */
export function normalizeHyperliquidCoin(symbol: string): string {
  if (!symbol) return 'BTC';
  const raw = symbol.trim().replace(/^hyperliquid:/i, '').trim();
  if (!raw) return 'BTC';

  // Pasangan spot Hyperliquid menggunakan format ber-slash seperti PURR/USDC
  if (raw.includes('/')) {
    return raw
      .split('/')
      .map((seg) => seg.trim().toUpperCase())
      .join('/');
  }

  const stripped = raw
    .replace(/\.P$/i, '')
    .replace(/-PERP$/i, '')
    .replace(/_PERP$/i, '')
    .replace(/PERP$/i, '')
    .replace(/(USDT|USDC|USD)$/i, '')
    .replace(/[\-_]/g, '')
    .toUpperCase();

  return stripped || raw.toUpperCase();
}

function mapHyperliquidInterval(interval: string): string {
  const std = toExchangeInterval(fromVelaTimeframe(interval), 'hyperliquid');
  if (INTERVAL_MS_MAP[std]) return std;
  if (std === '45m' || std === '6h') return '1h';
  return '15m';
}

export class HyperliquidAdapter implements MarketProviderAdapter {
  id = 'hyperliquid';
  name = 'Hyperliquid DEX Perpetuals';
  private timeoutMs: number;

  constructor(options: { timeoutMs?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  async fetchTicker(symbol: string): Promise<TickerInfo> {
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
    const coinMap = new Map<string, Omit<TickerInfo, 'symbol' | 'name'>>();

    const normalizedTargets = symbols.map((raw) => ({
      raw,
      coin: normalizeHyperliquidCoin(raw),
    }));

    const hasPerp = normalizedTargets.some((t) => !t.coin.includes('/'));
    const hasSpot = normalizedTargets.some((t) => t.coin.includes('/'));

    let perpError: any = null;
    let spotError: any = null;

    // 1. Ambil konteks aset Perpetuals
    if (hasPerp) {
      try {
        const res = await universalFetch(HYPERLIQUID_INFO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
          timeoutMs: this.timeoutMs,
        });
        if (!res.ok) {
          throw new Error(`Hyperliquid Perp HTTP ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        const meta = Array.isArray(json) ? json[0] : null;
        const ctxs = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];

        for (let i = 0; i < ctxs.length; i++) {
          const ctx = ctxs[i];
          const coinName = String(ctx?.coin || meta?.universe?.[i]?.name || '').toUpperCase();
          if (!coinName || !ctx) continue;

          const price = parseFloat(ctx.markPx || ctx.midPx || ctx.oraclePx || '0');
          const prevDay = parseFloat(ctx.prevDayPx || '0');
          const change24h =
            prevDay > 0 && price > 0 ? Number((((price - prevDay) / prevDay) * 100).toFixed(2)) : 0;
          const volume24h = parseFloat(ctx.dayNtlVlm || ctx.dayBaseVlm || '0') || 0;

          if (Number.isFinite(price) && price > 0) {
            coinMap.set(coinName, {
              price,
              change24h,
              high24h: price,
              low24h: price,
              volume24h,
            });
          }
        }
      } catch (err) {
        perpError = err;
        console.warn('[HyperliquidAdapter] Gagal fetch perp tickers:', err);
      }
    }

    // 2. Ambil konteks aset Spot jika ada pasangan ber-slash (misal PURR/USDC)
    if (hasSpot) {
      try {
        const res = await universalFetch(HYPERLIQUID_INFO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'spotMetaAndAssetCtxs' }),
          timeoutMs: this.timeoutMs,
        });
        if (!res.ok) {
          throw new Error(`Hyperliquid Spot HTTP ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        const spotMeta = Array.isArray(json) ? json[0] : null;
        const spotCtxs = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
        const tokens = Array.isArray(spotMeta?.tokens) ? spotMeta.tokens : [];

        for (let i = 0; i < spotCtxs.length; i++) {
          const ctx = spotCtxs[i];
          const univ = spotMeta?.universe?.[i];
          if (!ctx) continue;

          const price = parseFloat(ctx.markPx || ctx.midPx || ctx.oraclePx || '0');
          const prevDay = parseFloat(ctx.prevDayPx || '0');
          const change24h =
            prevDay > 0 && price > 0 ? Number((((price - prevDay) / prevDay) * 100).toFixed(2)) : 0;
          const volume24h = parseFloat(ctx.dayNtlVlm || ctx.dayBaseVlm || '0') || 0;

          if (!Number.isFinite(price) || price <= 0) continue;

          const tickerPayload = {
            price,
            change24h,
            high24h: price,
            low24h: price,
            volume24h,
          };

          const candidateKeys = new Set<string>();
          if (ctx.coin) candidateKeys.add(String(ctx.coin).toUpperCase());
          if (univ?.name) candidateKeys.add(String(univ.name).toUpperCase());
          if (Array.isArray(univ?.tokens) && univ.tokens.length >= 2) {
            const baseTok = tokens[univ.tokens[0]]?.name;
            const quoteTok = tokens[univ.tokens[1]]?.name;
            if (baseTok && quoteTok) {
              candidateKeys.add(`${String(baseTok).toUpperCase()}/${String(quoteTok).toUpperCase()}`);
            }
          }

          for (const key of candidateKeys) {
            coinMap.set(key, tickerPayload);
          }
        }
      } catch (err) {
        spotError = err;
        console.warn('[HyperliquidAdapter] Gagal fetch spot tickers:', err);
      }
    }

    for (const target of normalizedTargets) {
      const matched = coinMap.get(target.coin);
      if (matched) {
        resultMap[target.raw] = {
          symbol: target.raw,
          name: target.raw,
          ...matched,
        };
      }
    }

    // Lempar exception bila seluruh kueri gagal agar Feed Connection Guard mendeteksi gangguan jaringan
    if (Object.keys(resultMap).length === 0 && (perpError || spotError)) {
      throw perpError || spotError;
    }

    return resultMap;
  }

  async fetchCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const coin = normalizeHyperliquidCoin(symbol);
    const hlInterval = mapHyperliquidInterval(interval);
    const intervalMs = INTERVAL_MS_MAP[hlInterval] ?? 900_000;
    const endTime = Date.now();
    const startTime = endTime - (Math.max(limit, 1) + 2) * intervalMs;

    const res = await universalFetch(HYPERLIQUID_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: {
          coin,
          interval: hlInterval,
          startTime: Math.floor(startTime),
          endTime: Math.floor(endTime),
        },
      }),
      timeoutMs: this.timeoutMs,
    });

    if (!res.ok) {
      throw new Error(`Hyperliquid Candles HTTP ${res.status} ${res.statusText}`);
    }

    const raw = await res.json();
    if (!Array.isArray(raw)) {
      throw new Error(`Payload candleSnapshot Hyperliquid tidak valid untuk ${coin}`);
    }

    const byTime = new Map<number, Candle>();
    for (const k of raw) {
      const rawT = Number(k?.t ?? k?.T ?? 0);
      const time = rawT > 0 && rawT < 1e11 ? rawT * 1000 : rawT;
      const open = parseFloat(k?.o);
      const high = parseFloat(k?.h);
      const low = parseFloat(k?.l);
      const close = parseFloat(k?.c);
      const volume = parseFloat(k?.v ?? '0') || 0;

      if (!Number.isFinite(time) || time <= 0 || !Number.isFinite(open) || !Number.isFinite(close)) {
        continue;
      }

      byTime.set(time, {
        time,
        open,
        high: Number.isFinite(high) ? high : Math.max(open, close),
        low: Number.isFinite(low) ? low : Math.min(open, close),
        close,
        volume,
      });
    }

    const sorted = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
    return sorted.length > limit ? sorted.slice(-limit) : sorted;
  }

  async searchSymbols(
    query: string,
    filterType: 'all' | 'spot' | 'perp' = 'all'
  ): Promise<MarketSearchResult[]> {
    const q = query.trim().toUpperCase();
    const results: MarketSearchResult[] = [];

    // Jika query mengandung '/' atau kuotasi USDC, sediakan hasil Spot Hyperliquid
    if (q.includes('/') && (filterType === 'all' || filterType === 'spot')) {
      const [base = q, quote = 'USDC'] = q.split('/').map((s) => s.trim());
      if (base) {
        results.push({
          symbol: `${base}/${quote || 'USDC'}`,
          baseAsset: base,
          quoteAsset: quote || 'USDC',
          displayName: `${base} / ${quote || 'USDC'} Spot (Hyperliquid)`,
          type: 'spot',
          provider: 'Hyperliquid DEX',
        });
      }
    }

    if (filterType === 'all' || filterType === 'perp') {
      for (const asset of VERIFIED_CRYPTO_ASSETS) {
        const match =
          !q ||
          asset.base.includes(q) ||
          asset.name.toUpperCase().includes(q) ||
          `${asset.base}USDT`.includes(q);
        if (match) {
          results.push({
            symbol: asset.base,
            baseAsset: asset.base,
            quoteAsset: 'USD',
            displayName: `${asset.name} Perpetual (Hyperliquid)`,
            type: 'perp',
            provider: 'Hyperliquid DEX',
          });
        }
      }

      const cleanCoin = normalizeHyperliquidCoin(q);
      if (cleanCoin && !cleanCoin.includes('/') && !results.some((r) => r.baseAsset === cleanCoin)) {
        results.unshift({
          symbol: cleanCoin,
          baseAsset: cleanCoin,
          quoteAsset: 'USD',
          displayName: `${cleanCoin} Perpetual (Hyperliquid)`,
          type: 'perp',
          provider: 'Hyperliquid DEX',
        });
      }
    }

    return results.slice(0, 30);
  }
}
