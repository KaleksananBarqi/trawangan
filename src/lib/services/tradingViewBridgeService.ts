import type { Candle } from '../types/market';
import { KNOWN_QUOTE_ASSETS } from './instrumentIdentity';

export interface TradingViewParsedTarget {
  exchangePrefix?: string;
  normalizedSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  isPerp: boolean;
  bypass: boolean;
  timeframe?: string;
  rawInput: string;
}

export interface ResolvedExternalSymbol {
  symbol: string;
  providerId: string;
  redirectedFrom?: string;
}

export interface BridgeMarketFeedLike {
  getCandles(symbol: string, interval: string, limit?: number): Promise<Candle[]>;
}

const TV_INTERVAL_MAP: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '45': '45m',
  '60': '1h',
  '120': '2h',
  '180': '3h',
  '240': '4h',
  '1H': '1h',
  '2H': '2h',
  '3H': '3h',
  '4H': '4h',
  D: '1d',
  '1D': '1d',
  W: '1w',
  '1W': '1w',
  M: '1M',
  '1M': '1M',
};

const DIRECT_EXCHANGE_PROVIDER_MAP: Record<string, string> = {
  BINANCE: 'binance',
  BITUNIX: 'bitunix',
  HYPERLIQUID: 'hyperliquid',
  COINBASE: 'coinbase',
  INDODAX: 'indodax',
  IDX: 'yahoo',
  NASDAQ: 'yahoo',
  NYSE: 'yahoo',
  YAHOO: 'yahoo',
};

export function mapTradingViewInterval(rawInterval?: string | null): string | undefined {
  if (!rawInterval) return undefined;
  const trimmed = rawInterval.trim();
  if (!trimmed) return undefined;
  return TV_INTERVAL_MAP[trimmed] ?? TV_INTERVAL_MAP[trimmed.toUpperCase()];
}

function splitBaseQuote(symbolWithoutPerp: string): { baseAsset: string; quoteAsset: string } {
  const delimMatch = symbolWithoutPerp.match(/^([A-Z0-9]+)[-_/]([A-Z0-9]+)$/);
  if (delimMatch) {
    return { baseAsset: delimMatch[1], quoteAsset: delimMatch[2] };
  }

  for (const quote of KNOWN_QUOTE_ASSETS) {
    if (symbolWithoutPerp.endsWith(quote) && symbolWithoutPerp.length > quote.length) {
      return {
        baseAsset: symbolWithoutPerp.slice(0, -quote.length),
        quoteAsset: quote,
      };
    }
  }

  return { baseAsset: symbolWithoutPerp, quoteAsset: 'USDT' };
}

function buildParsedTarget(
  rawSymbol: string,
  rawInput: string,
  bypass: boolean,
  timeframe?: string
): TradingViewParsedTarget | null {
  const cleaned = decodeURIComponent(rawSymbol).trim();
  if (!cleaned) return null;

  let exchangePrefix: string | undefined;
  let symbolPart = cleaned;

  const colonIdx = cleaned.indexOf(':');
  if (colonIdx >= 0) {
    const prefix = cleaned.slice(0, colonIdx).trim().toUpperCase();
    const rest = cleaned.slice(colonIdx + 1).trim();
    if (prefix) exchangePrefix = prefix;
    symbolPart = rest;
  }

  if (!symbolPart) return null;

  const upperSymbol = symbolPart.toUpperCase();
  const isPerp = upperSymbol.endsWith('.P') || upperSymbol.endsWith('-PERP');
  const normalizedSymbol = upperSymbol.endsWith('-PERP')
    ? `${upperSymbol.slice(0, -5)}.P`
    : upperSymbol;
  const coreSymbol = normalizedSymbol.endsWith('.P')
    ? normalizedSymbol.slice(0, -2)
    : normalizedSymbol;

  const { baseAsset, quoteAsset } = splitBaseQuote(coreSymbol);

  return {
    exchangePrefix,
    normalizedSymbol,
    baseAsset,
    quoteAsset,
    isPerp,
    bypass,
    timeframe,
    rawInput,
  };
}

/**
 * Mengurai URL TradingView (?symbol=..., /symbols/EXCHANGE-TICKER/) atau string simbol langsung.
 */
export function parseTradingViewUrl(
  rawInput: string,
  fallbackInterval?: string | null
): TradingViewParsedTarget | null {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const fallbackTimeframe = mapTradingViewInterval(fallbackInterval);

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const bypass =
        url.searchParams.get('notrawangan') === '1' || url.searchParams.get('web') === '1';
      const timeframe = mapTradingViewInterval(url.searchParams.get('interval')) ?? fallbackTimeframe;

      const querySymbol = url.searchParams.get('symbol');
      if (querySymbol) {
        return buildParsedTarget(querySymbol, trimmed, bypass, timeframe);
      }

      // Path TradingView memakai format /symbols/EXCHANGE-SYMBOL/
      const pathMatch = url.pathname.match(/\/symbols\/([^/]+)/i);
      if (pathMatch && pathMatch[1]) {
        const segment = decodeURIComponent(pathMatch[1]);
        const dashIdx = segment.indexOf('-');
        const symbolExpr =
          dashIdx > 0 ? `${segment.slice(0, dashIdx)}:${segment.slice(dashIdx + 1)}` : segment;
        return buildParsedTarget(symbolExpr, trimmed, bypass, timeframe);
      }

      return null;
    } catch {
      return null;
    }
  }

  return buildParsedTarget(trimmed, trimmed, false, fallbackTimeframe);
}

function formatNativeSymbol(providerId: string, parsed: TradingViewParsedTarget): string {
  if (providerId === 'yahoo') {
    if (parsed.exchangePrefix === 'IDX' && !parsed.normalizedSymbol.endsWith('.JK')) {
      return `${parsed.normalizedSymbol}.JK`;
    }
    return parsed.normalizedSymbol;
  }

  if (providerId === 'coinbase') {
    const quote = parsed.quoteAsset === 'USDT' ? 'USD' : parsed.quoteAsset;
    return `${parsed.baseAsset}-${quote}`;
  }

  if (providerId === 'indodax') {
    return `${parsed.baseAsset}IDR`;
  }

  return parsed.normalizedSymbol;
}

async function probeCandidate(
  marketFeed: BridgeMarketFeedLike,
  providerId: string,
  symbol: string
): Promise<boolean> {
  try {
    const candles = await marketFeed.getCandles(`${providerId}:${symbol}`, '15m', 5);
    return Array.isArray(candles) && candles.length > 0;
  } catch {
    return false;
  }
}

/**
 * Menguji ketersediaan instrumen secara dinamis ke API bursa asal tanpa daftar koin statis,
 * lalu menjalankan rantai fallback multi-bursa jika bursa asal tidak didukung atau kosong.
 */
export async function resolveExternalSymbolWithFallback(
  parsed: TradingViewParsedTarget,
  marketFeed: BridgeMarketFeedLike
): Promise<ResolvedExternalSymbol | null> {
  const attempted = new Set<string>();
  const nativeProvider = parsed.exchangePrefix
    ? DIRECT_EXCHANGE_PROVIDER_MAP[parsed.exchangePrefix]
    : undefined;

  if (nativeProvider) {
    const nativeSymbol = formatNativeSymbol(nativeProvider, parsed);
    const nativeKey = `${nativeProvider}:${nativeSymbol}`;
    attempted.add(nativeKey);

    if (await probeCandidate(marketFeed, nativeProvider, nativeSymbol)) {
      return {
        symbol: nativeSymbol,
        providerId: nativeProvider,
      };
    }

    // Instrumen saham/ekuitas Yahoo tidak perlu di-fallback ke bursa kripto
    if (nativeProvider === 'yahoo') {
      return null;
    }
  }

  const pairBase = `${parsed.baseAsset}${parsed.quoteAsset}`;
  const perpSymbol = `${pairBase}.P`;
  const spotSymbol = pairBase;
  const coinbaseSymbol = formatNativeSymbol('coinbase', parsed);
  const indodaxSymbol = formatNativeSymbol('indodax', parsed);

  const fallbackQueue: Array<{ providerId: string; symbol: string }> = parsed.isPerp
    ? [
        { providerId: 'binance', symbol: perpSymbol },
        { providerId: 'bitunix', symbol: perpSymbol },
        { providerId: 'hyperliquid', symbol: perpSymbol },
        { providerId: 'binance', symbol: spotSymbol },
        { providerId: 'coinbase', symbol: coinbaseSymbol },
        { providerId: 'indodax', symbol: indodaxSymbol },
      ]
    : [
        { providerId: 'binance', symbol: spotSymbol },
        { providerId: 'bitunix', symbol: perpSymbol },
        { providerId: 'coinbase', symbol: coinbaseSymbol },
        { providerId: 'indodax', symbol: indodaxSymbol },
        { providerId: 'hyperliquid', symbol: perpSymbol },
      ];

  for (const candidate of fallbackQueue) {
    const key = `${candidate.providerId}:${candidate.symbol}`;
    if (attempted.has(key)) continue;
    attempted.add(key);

    if (await probeCandidate(marketFeed, candidate.providerId, candidate.symbol)) {
      return {
        symbol: candidate.symbol,
        providerId: candidate.providerId,
        redirectedFrom: parsed.exchangePrefix,
      };
    }
  }

  return null;
}
