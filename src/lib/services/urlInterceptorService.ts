/**
 * URL Interceptor Service - Deep Module untuk Penangkapan Tautan Charting Eksternal
 * Mengurai tautan TradingView, Binance, Bybit, DexScreener, dan skema native trawangan://
 * Menormalkan simbol dan menjalankan Multi-Provider Fallback Routing.
 */

export interface ParsedChartTarget {
  providerId?: string;
  symbol: string;
  timeframe?: string;
  rawUrl: string;
}

export interface NormalizedSymbol {
  base: string;
  quote: string;
  isPerpetual: boolean;
  cleanSymbol: string;
}

export interface FallbackResolutionResult {
  providerId: string;
  symbol: string;
  redirectedNotice?: string;
}

/**
 * Memetakan nama bursa eksternal ke internal provider ID Trawangan
 */
export function mapExchangeToProviderId(exchange: string): string {
  const norm = exchange.trim().toLowerCase();
  if (norm.includes('binance')) return 'binance';
  if (norm.includes('bybit')) return 'bybit';
  if (norm.includes('bitunix')) return 'bitunix';
  if (norm.includes('indodax')) return 'indodax';
  if (norm.includes('coinbase')) return 'coinbase';
  if (norm.includes('okx')) return 'okx';
  if (norm.includes('kucoin')) return 'kucoin';
  return norm;
}

/**
 * Mengurai tautan dari browser atau skema URI trawangan://
 */
export function parseExternalChartUrl(rawUrl: string): ParsedChartTarget | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    // 1. Skema native trawangan://
    if (trimmed.startsWith('trawangan://')) {
      // Bentuk 1: trawangan://open?url=...
      if (trimmed.includes('open?url=')) {
        const queryIdx = trimmed.indexOf('open?url=');
        const encodedUrl = trimmed.substring(queryIdx + 9);
        const decoded = decodeURIComponent(encodedUrl);
        return parseExternalChartUrl(decoded);
      }

      // Bentuk 2: trawangan://chart?symbol=BINANCE:BTCUSDT&timeframe=15m
      const urlObj = new URL(trimmed.replace('trawangan://', 'http://trawangan.local/'));
      const symbolParam = urlObj.searchParams.get('symbol');
      if (symbolParam) {
        let pId: string | undefined;
        let sym = symbolParam;
        if (symbolParam.includes(':')) {
          const [ex, s] = symbolParam.split(':');
          pId = mapExchangeToProviderId(ex);
          sym = s;
        }
        return {
          providerId: pId,
          symbol: sym,
          timeframe: urlObj.searchParams.get('timeframe') || undefined,
          rawUrl: trimmed,
        };
      }
    }

    // 2. Platform Web URL (TradingView, Binance, Bybit, DexScreener, dll)
    const urlObj = new URL(trimmed);
    const host = urlObj.hostname.toLowerCase();

    // 2.1 TradingView
    if (host.includes('tradingview.com')) {
      // Format chart query: ?symbol=BINANCE:ARIAUSDT.P
      const symbolParam = urlObj.searchParams.get('symbol');
      if (symbolParam) {
        let pId: string | undefined;
        let sym = symbolParam;
        if (symbolParam.includes(':')) {
          const [ex, s] = symbolParam.split(':');
          pId = mapExchangeToProviderId(ex);
          sym = s;
        }
        return {
          providerId: pId,
          symbol: sym,
          timeframe: urlObj.searchParams.get('interval') || undefined,
          rawUrl: trimmed,
        };
      }

      // Format path: /symbols/ETHUSDT/ atau /symbols/BINANCE-BTCUSDT/
      if (urlObj.pathname.includes('/symbols/')) {
        const segments = urlObj.pathname.split('/').filter(Boolean);
        const symIdx = segments.indexOf('symbols');
        if (symIdx !== -1 && segments[symIdx + 1]) {
          let rawSeg = segments[symIdx + 1];
          let pId: string | undefined;
          if (rawSeg.includes('-')) {
            const [ex, s] = rawSeg.split('-');
            pId = mapExchangeToProviderId(ex);
            rawSeg = s;
          }
          return {
            providerId: pId,
            symbol: rawSeg,
            rawUrl: trimmed,
          };
        }
      }
    }

    // 2.2 Binance Web
    if (host.includes('binance.com')) {
      // /en/trade/BTC_USDT atau /en/futures/BTCUSDT
      const segments = urlObj.pathname.split('/').filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      if (lastSeg) {
        const cleanSym = lastSeg.replace('_', '').toUpperCase();
        return {
          providerId: 'binance',
          symbol: cleanSym,
          rawUrl: trimmed,
        };
      }
    }

    // 2.3 Bybit Web
    if (host.includes('bybit.com')) {
      // /trade/usdt/BTCUSDT
      const segments = urlObj.pathname.split('/').filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      if (lastSeg) {
        return {
          providerId: 'bybit',
          symbol: lastSeg.toUpperCase(),
          rawUrl: trimmed,
        };
      }
    }

    // 2.4 DexScreener
    if (host.includes('dexscreener.com')) {
      // /solana/sol_usdc
      const segments = urlObj.pathname.split('/').filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      if (lastSeg) {
        const parts = lastSeg.split('_').map((p) => p.toUpperCase());
        return {
          providerId: 'binance', // default fallback for base token
          symbol: parts.join(''),
          rawUrl: trimmed,
        };
      }
    }
  } catch (_) {
    return null;
  }

  return null;
}

/**
 * Normalisasi Simbol & Pembersihan Sufiks Kontrak Derivatif
 */
export function normalizeSymbolAndContract(rawSymbol: string): NormalizedSymbol {
  if (!rawSymbol) return { base: '', quote: 'USDT', isPerpetual: false, cleanSymbol: '' };

  let clean = rawSymbol.trim().toUpperCase();
  let isPerpetual = false;

  // Cek sufiks derivatif .P (TradingView / Binance Perpetual)
  if (clean.endsWith('.P')) {
    isPerpetual = true;
    clean = clean.slice(0, -2);
  } else if (clean.endsWith('-PERP')) {
    isPerpetual = true;
    clean = clean.replace('-PERP', '');
  } else if (clean.endsWith('PERP')) {
    isPerpetual = true;
    clean = clean.replace('PERP', '');
  } else if (clean.endsWith('SWAP')) {
    isPerpetual = true;
    clean = clean.replace('SWAP', '');
  }

  // Bersihkan karakter pemisah (_ atau - atau /)
  clean = clean.replace(/[-_/]/g, '');

  // Infer base dan quote
  let quote = 'USDT';
  let base = clean;

  const quoteSuffixes = ['USDT', 'USDC', 'USD', 'BUSD', 'IDR', 'BTC', 'ETH', 'EUR', 'TRY'];
  for (const suf of quoteSuffixes) {
    if (clean.endsWith(suf) && clean.length > suf.length) {
      quote = suf;
      base = clean.slice(0, -suf.length);
      break;
    }
  }

  return {
    base,
    quote,
    isPerpetual,
    cleanSymbol: clean,
  };
}

/**
 * Menyelesaikan target chart dengan Multi-Provider Fallback Routing
 */
export async function resolveChartTargetWithFallback(
  target: ParsedChartTarget,
  searchEngine: { search: (query: string) => Promise<any[]> }
): Promise<FallbackResolutionResult> {
  const norm = normalizeSymbolAndContract(target.symbol);
  const preferredProvider = (target.providerId || 'binance').toLowerCase();

  // Cari kandidat simbol via search engine
  let candidates: any[] = [];
  try {
    candidates = await searchEngine.search(norm.cleanSymbol);
  } catch (_) {}

  // 1. Coba cari kecocokan persis pada preferred provider
  const directMatch = candidates.find(
    (c) =>
      c.providerId?.toLowerCase() === preferredProvider &&
      (c.symbol?.toUpperCase() === norm.cleanSymbol ||
        c.symbol?.toUpperCase().startsWith(norm.cleanSymbol) ||
        norm.cleanSymbol.startsWith(c.symbol?.toUpperCase()))
  );

  if (directMatch) {
    return {
      providerId: directMatch.providerId.toLowerCase(),
      symbol: directMatch.symbol,
    };
  }

  // 2. Jika bursa asal tidak memiliki pair tersebut, cari di provider cadangan terbaik
  if (candidates.length > 0) {
    // Prioritaskan provider aktif populer: bitunix, indodax, bybit
    const fallbackMatch =
      candidates.find((c) => c.providerId?.toLowerCase() === 'bitunix') ||
      candidates.find((c) => c.providerId?.toLowerCase() === 'indodax') ||
      candidates.find((c) => c.providerId?.toLowerCase() === 'bybit') ||
      candidates[0];

    if (fallbackMatch && fallbackMatch.providerId?.toLowerCase() !== preferredProvider) {
      return {
        providerId: fallbackMatch.providerId.toLowerCase(),
        symbol: fallbackMatch.symbol,
        redirectedNotice: `${preferredProvider.toUpperCase()}:${norm.cleanSymbol} dialihkan ke ${fallbackMatch.providerId.toUpperCase()}:${fallbackMatch.symbol}`,
      };
    }
  }

  // 3. Fallback terakhir jika tidak ditemukan: gunakan provider asal dan clean symbol
  return {
    providerId: preferredProvider,
    symbol: norm.cleanSymbol,
  };
}
