/**
 * Modul Identitas Instrumen, Normalisasi Simbol, dan Guard Kapabilitas Bursa
 * 
 * Modul ini menjadi Single Source of Truth (SSOT) untuk:
 * 1. Penguraian (parsing) dan identifikasi instrumen perdagangan (spot, perp, futures).
 * 2. Normalisasi string simbol untuk pencocokan multi-sumber (drawing, trading plan, alert, dan overlay harga).
 * 3. Resolusi kunci penyimpanan drawing kanonikal yang bebas inkonsistensi casing.
 * 4. Resolusi format simbol Vela sesuai bursa aktif (Indodax, Hyperliquid, Coinbase, Bitunix, Binance).
 * 5. Guard routing bursa otomatis berdasarkan karakteristik simbol dan provider hint.
 */

export interface InstrumentIdentity {
  raw: string;
  providerId: string;
  symbol: string;
  canonicalSymbol: string;
  base: string;
  quote: string;
  contractType: 'spot' | 'perp' | 'futures';
}

const COMMON_QUOTES = ['USDT', 'USDC', 'USD', 'IDR', 'BUSD', 'BTC', 'ETH', 'EUR', 'GBP', 'TRY'];

/**
 * Memeriksa apakah simbol merupakan instrumen bursa Yahoo Finance
 * (Saham Indonesia .JK, Indeks ^, atau Komoditas Berjangka =F)
 */
export function isYahooSymbol(symbol?: string | null): boolean {
  if (!symbol) return false;
  const clean = symbol.includes(':') ? symbol.split(':')[1].trim() : symbol.trim();
  const upper = clean.toUpperCase();
  return upper.endsWith('.JK') || upper.startsWith('^') || upper.endsWith('=F') || upper.includes('=F');
}

/**
 * Normalisasi string simbol perdagangan untuk pencocokan toleran bursa dan sufiks kontrak.
 * Menghilangkan awalan bursa ('binance:'), tanda baca ('-', '_', '/'),
 * serta sufiks kontrak derivatif ('.P', '-PERP', 'PERP').
 */
export function normalizeSymbolForMatching(symbol?: string | null): string {
  if (!symbol) return '';
  const trimmed = symbol.trim();
  if (!trimmed) return '';

  // 1. Hilangkan awalan bursa jika ada (misal: 'binance:BTCUSDT' -> 'BTCUSDT')
  const cleanPrefix = trimmed.includes(':') ? trimmed.split(':')[1].trim() : trimmed;
  const upper = cleanPrefix.toUpperCase();

  // 2. Hilangkan sufiks kontrak derivatif (.P, -PERP, PERP)
  const strippedSuffix = upper.replace(/\.P$|-PERP$|PERP$/i, '');

  // 3. Hilangkan seluruh tanda baca pemisah pair (misal: BTC/USDT, BTC-USDT, BTC_USDT)
  return strippedSuffix.replace(/[\/\-_]/g, '');
}

/**
 * Membandingkan dua simbol instrumen perdagangan dengan normalisasi nama dan toleransi sufiks kontrak (.P / PERP)
 */
export function isSameInstrument(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const normA = normalizeSymbolForMatching(a);
  const normB = normalizeSymbolForMatching(b);
  if (!normA || !normB) return false;
  return normA === normB;
}

/**
 * Alias kompatibilitas ke belakang untuk isSameInstrument
 */
export const isSameSymbol = isSameInstrument;

/**
 * Mengurai string simbol dan petunjuk bursa menjadi representasi InstrumentIdentity terstruktur
 */
export function parseInstrumentIdentity(rawSymbol: string, providerHint?: string): InstrumentIdentity {
  const raw = String(rawSymbol || '').trim();
  let providerId = (providerHint || 'binance').trim().toLowerCase();
  let cleanSymbol = raw;

  if (raw.includes(':')) {
    const parts = raw.split(':');
    if (parts[0].trim()) {
      providerId = parts[0].trim().toLowerCase();
    }
    cleanSymbol = parts.slice(1).join(':').trim();
  }

  const upper = cleanSymbol.toUpperCase();
  const canonical = normalizeSymbolForMatching(cleanSymbol);

  // Deteksi tipe kontrak
  let contractType: 'spot' | 'perp' | 'futures' = 'spot';
  if (upper.endsWith('.P') || upper.endsWith('-PERP') || upper.endsWith('PERP') || providerId === 'bitunix' || providerId === 'hyperliquid') {
    contractType = 'perp';
  }

  // Deteksi Base & Quote
  let quote = 'USDT';
  let base = canonical;

  for (const q of COMMON_QUOTES) {
    if (canonical.endsWith(q) && canonical.length > q.length) {
      quote = q;
      base = canonical.slice(0, -q.length);
      break;
    }
  }

  return {
    raw,
    providerId,
    symbol: cleanSymbol.toUpperCase(),
    canonicalSymbol: canonical,
    base,
    quote,
    contractType,
  };
}

/**
 * Menghasilkan kunci persistensi gabungan workspace, bursa, dan simbol yang ternormalisasi kanonikal
 * Format: [workspaceId:]providerId:SYMBOL (misal: 'default_workspace:binance:BTCUSDT' atau 'binance:BTCUSDT')
 */
export function resolveDrawingStorageKey(
  providerId: string | undefined,
  symbol: string,
  workspaceId?: string | null
): string {
  const clean = symbol ? symbol.trim() : 'BTCUSDT';
  let provider = (providerId || 'binance').trim().toLowerCase();
  let normalizedSymbol = clean.toUpperCase();

  if (clean.includes(':')) {
    const parts = clean.split(':');
    provider = parts[0].trim().toLowerCase() || 'binance';
    normalizedSymbol = parts.slice(1).join(':').trim().toUpperCase();
  }

  const baseKey = `${provider}:${normalizedSymbol}`;
  if (workspaceId && workspaceId.trim()) {
    return `${workspaceId.trim().toLowerCase()}:${baseKey}`;
  }
  return baseKey;
}

/**
 * Alias kompatibilitas ke belakang untuk resolveDrawingStorageKey
 */
export const resolveDrawingKey = resolveDrawingStorageKey;

/**
 * Mengonversi ID provider agar aman diparsing oleh regex ProviderRegistry Vela (`/^(?:([A-Za-z0-9_.]+):)?(.+)$/`)
 * karena karakter tanda hubung ('-') tidak dikenali sebagai prefix provider oleh Vela.
 */
export function toVelaProviderId(providerId: string): string {
  const clean = (providerId || 'binance').trim().toLowerCase();
  if (clean.startsWith('custom')) {
    return clean.replace(/-/g, '_');
  }
  return clean;
}

/**
 * Normalisasi format simbol pair ke format Vela sesuai bursa aktif
 */
export function resolveVelaSymbolKey(sym: string, pId: string): string {
  if (!sym) return 'binance:BTCUSDT';
  const raw = sym.trim();
  const colonIdx = raw.indexOf(':');
  const clean = colonIdx >= 0 ? raw.slice(colonIdx + 1).trim() : raw;
  const p = (pId || 'binance').trim().toLowerCase();

  if (p === 'yahoo' || isYahooSymbol(clean)) {
    return `yahoo:${clean.toUpperCase()}`;
  } else if (p === 'indodax' || clean.toUpperCase().endsWith('IDR')) {
    const pair = clean.replace(/[\/\-_]/g, '').toUpperCase();
    return `indodax:${pair}`;
  } else if (p === 'hyperliquid') {
    if (clean.includes('/')) {
      const spotPair = clean
        .split('/')
        .map((seg) => seg.trim().toUpperCase())
        .join('/');
      return `hyperliquid:${spotPair}`;
    }
    const coin = clean
      .replace(/\.P$/i, '')
      .replace(/-PERP$/i, '')
      .replace(/(USDT|USDC|USD)$/i, '')
      .replace(/[\/\-_]/g, '')
      .toUpperCase();
    return `hyperliquid:${coin || clean.toUpperCase()}`;
  } else if (p === 'coinbase') {
    let product = clean
      .replace(/\.P$/i, '')
      .replace(/-PERP$/i, '')
      .replace(/[\/_]/g, '-')
      .toUpperCase();

    if (product.endsWith('-USDT')) {
      product = `${product.slice(0, -5)}-USD`;
    } else if (!product.includes('-')) {
      if (product.endsWith('USDT') && product.length > 4) {
        product = `${product.slice(0, -4)}-USD`;
      } else if (product.endsWith('USDC') && product.length > 4) {
        product = `${product.slice(0, -4)}-USDC`;
      } else if (product.endsWith('USD') && product.length > 3) {
        product = `${product.slice(0, -3)}-USD`;
      } else if (product.endsWith('BTC') && product.length > 3) {
        product = `${product.slice(0, -3)}-BTC`;
      } else if (product.endsWith('ETH') && product.length > 3) {
        product = `${product.slice(0, -3)}-ETH`;
      } else if (product.endsWith('EUR') && product.length > 3) {
        product = `${product.slice(0, -3)}-EUR`;
      } else {
        product = `${product}-USD`;
      }
    }
    return `coinbase:${product}`;
  } else if (p === 'bitunix') {
    const isPerp = clean.toUpperCase().endsWith('.P');
    const bare = clean
      .replace(/\.P$/i, '')
      .replace(/[\/\-_]/g, '')
      .toUpperCase();
    return `bitunix:${isPerp ? `${bare}.P` : bare}`;
  } else if (p.startsWith('custom')) {
    return `${toVelaProviderId(p)}:${clean.toUpperCase()}`;
  }

  const isPerp = clean.toUpperCase().endsWith('.P');
  const bare = clean
    .replace(/\.P$/i, '')
    .replace(/[\/\-_]/g, '')
    .toUpperCase();
  return `binance:${isPerp ? `${bare}.P` : bare}`;
}

/**
 * Alias kompatibilitas ke belakang untuk resolveVelaSymbolKey
 */
export const resolveVelaSymbol = resolveVelaSymbolKey;

/**
 * Guard penentuan bursa (venue routing) berdasarkan nama simbol dan petunjuk bursa
 */
export function routeVenueForSymbol(
  symbol: string,
  currentVenue: string = 'binance',
  venueHint?: string
): string {
  const clean = symbol ? symbol.trim().toUpperCase() : '';
  const hint = venueHint ? venueHint.trim().toLowerCase() : '';

  if (hint) {
    if (hint.includes('indodax') || hint === 'indodax') return 'indodax';
    if (hint.includes('bitunix') || hint === 'bitunix') return 'bitunix';
    if (hint.includes('binance') || hint === 'binance') return 'binance';
    if (hint.includes('hyperliquid') || hint === 'hyperliquid') return 'hyperliquid';
    if (hint.includes('coinbase') || hint === 'coinbase') return 'coinbase';
    if (hint.includes('yahoo') || hint === 'yahoo') return 'yahoo';
    return hint;
  }

  if (isYahooSymbol(clean)) {
    return 'yahoo';
  } else if (clean.endsWith('IDR')) {
    return 'indodax';
  } else if (clean.endsWith('.P') && currentVenue === 'indodax') {
    return 'bitunix';
  } else if (clean.includes('USDT') && currentVenue === 'indodax') {
    return 'binance';
  }

  return currentVenue || 'binance';
}

/**
 * Ekstraksi providerId dan symbol dari cell atau chart secara kanonikal
 */
export function getCellMarketIdentity(cell: any): { providerId: string; symbol: string } {
  if (!cell) return { providerId: 'binance', symbol: '' };

  const rawSymbol = String(cell.symbol || cell.chart?.symbol || '').trim();
  const rawProvider = String(cell.providerId || cell.provider || '').trim().toLowerCase();

  if (rawSymbol.includes(':')) {
    const parts = rawSymbol.split(':');
    const prefix = parts[0].toLowerCase();
    const cleanSym = parts.slice(1).join(':').toUpperCase();
    return {
      providerId: rawProvider || prefix,
      symbol: cleanSym,
    };
  }

  let providerId = rawProvider;
  if (!providerId) {
    if (rawSymbol.toUpperCase().endsWith('IDR')) {
      providerId = 'indodax';
    } else {
      providerId = 'binance';
    }
  }

  return {
    providerId,
    symbol: rawSymbol.toUpperCase(),
  };
}
