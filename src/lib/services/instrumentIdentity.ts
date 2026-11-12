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

import {
  canonicalizeMacroIndexSymbol,
  isMacroIndexSymbol,
  resolveMacroIndexDescriptor,
} from './macroIndexCatalog';

export interface InstrumentIdentity {
  raw: string;
  providerId: string;
  symbol: string;
  canonicalSymbol: string;
  base: string;
  quote: string;
  contractType: 'spot' | 'perp' | 'futures';
}

export const KNOWN_QUOTE_ASSETS = [
  'USDT',
  'USDC',
  'FDUSD',
  'BUSD',
  'BTC',
  'ETH',
  'IDR',
  'USD',
  'EUR',
  'GBP',
  'BNB',
  'TRY',
] as const;

const COMMON_QUOTES = KNOWN_QUOTE_ASSETS;
const QUOTE_JOIN_PATTERN = KNOWN_QUOTE_ASSETS.join('|');
const DELIM_QUOTE_REGEX = new RegExp(`^([A-Za-z0-9]+)[-_](${QUOTE_JOIN_PATTERN})(\\.P)?$`, 'i');
const DEFAULT_EXACT_YAHOO_SYMBOLS = new Set(['QQQ', 'SPY']);

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
 * Menormalkan token simbol instrumen dari input tabel/teks/form (mendukung format slash `/`,
 * awalan bursa `:`, instrumen Yahoo `.JK`/`=F`/`^`, serta sufiks derivatif `.P`/`-PERP`).
 */
export function normalizeInstrumentToken(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const symMatch = trimmed.match(/([A-Za-z0-9_\-\.\/\:\=\^]+)/);
  if (!symMatch) return '';

  let token = symMatch[1].trim();
  if (!token) return '';

  // Hapus awalan nama bursa jika eksplisit (mis. "binance:ETH/USDT" -> "ETH/USDT")
  const colonIdx = token.indexOf(':');
  if (colonIdx >= 0) {
    const afterColon = token.slice(colonIdx + 1).trim();
    if (afterColon) {
      token = afterColon;
    }
  }

  // Satukan pasangan berpemisah slash (mis. "ETH/USDT" -> "ETHUSDT", "ETH/USDT.P" -> "ETHUSDT.P")
  token = token.replace(/\//g, '');

  // Gabungkan delimiter '-' atau '_' khusus pasangan kuotasi dikenal (bukan sufiks -PERP)
  const delimQuoteMatch = token.match(DELIM_QUOTE_REGEX);
  if (delimQuoteMatch) {
    token = `${delimQuoteMatch[1]}${delimQuoteMatch[2]}${delimQuoteMatch[3] || ''}`;
  }

  return token.toUpperCase();
}

/**
 * Mengkanonisasikan simbol target instrumen agar base pendek seperti "ETH" / "sol"
 * otomatis dilengkapi dengan quote instrumen aktif (default USDT), sambil mempertahankan
 * pasangan eksplisit, derivatif (.P / -PERP), dan instrumen Yahoo Finance (.JK, =F, ^, QQQ, SPY).
 */
export function resolveCanonicalInstrumentSymbol(
  rawSymbol?: string | null,
  fallbackSymbol = 'BTCUSDT',
  exactSymbols?: ReadonlySet<string>
): string {
  const cleanFallback = fallbackSymbol
    ? normalizeInstrumentToken(fallbackSymbol) || fallbackSymbol.trim().toUpperCase()
    : 'BTCUSDT';

  const token = rawSymbol ? normalizeInstrumentToken(rawSymbol) : '';
  if (!token) return cleanFallback;

  const macroCanonical = canonicalizeMacroIndexSymbol(token);
  if (macroCanonical) {
    return macroCanonical;
  }

  if (
    isYahooSymbol(token) ||
    DEFAULT_EXACT_YAHOO_SYMBOLS.has(token) ||
    exactSymbols?.has(token)
  ) {
    return token;
  }

  if (token.endsWith('.P') || token.endsWith('PERP')) {
    return token;
  }

  for (const q of KNOWN_QUOTE_ASSETS) {
    const minLen = q === 'BTC' || q === 'ETH' || q === 'BNB' ? q.length + 3 : q.length + 1;
    if (token.length >= minLen && token.endsWith(q)) {
      return token;
    }
  }

  // Untuk input base pendek saja (mis. "ETH" -> "ETHUSDT"), warisi quote dari instrumen referensi
  let targetQuote = 'USDT';
  if (
    cleanFallback &&
    !isYahooSymbol(cleanFallback) &&
    !isMacroIndexSymbol(cleanFallback) &&
    !DEFAULT_EXACT_YAHOO_SYMBOLS.has(cleanFallback) &&
    !exactSymbols?.has(cleanFallback)
  ) {
    const parsedFallback = parseInstrumentIdentity(cleanFallback);
    if (parsedFallback.quote && parsedFallback.base !== parsedFallback.canonicalSymbol) {
      targetQuote = parsedFallback.quote;
    }
  }

  return `${token}${targetQuote}`;
}

/**
 * Menyusun daftar saran simbol terurut, bebas duplikat, serta menyaring token header section (`#...`).
 */
export function buildSymbolSuggestionList(
  primaryCandidates: Array<string | null | undefined>,
  extraCandidates: ReadonlyArray<string | null | undefined> = []
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (raw?: string | null) => {
    if (!raw || typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const token = normalizeInstrumentToken(trimmed) || trimmed.toUpperCase();
    if (!token || token.startsWith('#') || seen.has(token)) return;
    seen.add(token);
    result.push(token);
  };

  for (const c of primaryCandidates) pushUnique(c);
  for (const c of extraCandidates) pushUnique(c);
  return result;
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

  // Pertahankan titik dominansi (.D) dan samakan seluruh alias makro ke bentuk kanonikal.
  const macroCanonical = canonicalizeMacroIndexSymbol(trimmed);
  if (macroCanonical) {
    return macroCanonical;
  }

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

  const macroDesc = resolveMacroIndexDescriptor(cleanSymbol);
  if (macroDesc) {
    return {
      raw,
      providerId: providerId === 'cryptocap' || providerId === 'index' ? 'macro' : 'macro',
      symbol: macroDesc.symbol,
      canonicalSymbol: macroDesc.symbol,
      base: macroDesc.symbol,
      quote: macroDesc.quoteUnit,
      contractType: 'spot',
    };
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

  const macroCanonical = canonicalizeMacroIndexSymbol(normalizedSymbol);
  if (macroCanonical) {
    provider = 'macro';
    normalizedSymbol = macroCanonical;
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
 * Menormalkan berbagai variasi simbol menuju ID produk resmi Coinbase Exchange (format BASE-QUOTE).
 * Menjaga pair eksplisit seperti 'ETH-BTC' / 'ETH/BTC' -> 'ETH-BTC',
 * serta menghindari duplikasi '-USD-USD' pada 'BTCUSD' maupun sufiks kontrak '.P'.
 */
export function normalizeCoinbaseProductId(symbol: string): string {
  if (!symbol) return 'BTC-USD';
  let product = symbol
    .trim()
    .replace(/^coinbase:/i, '')
    .trim()
    .replace(/\.P$/i, '')
    .replace(/-PERP$/i, '')
    .replace(/_PERP$/i, '')
    .replace(/PERP$/i, '')
    .replace(/[\/_]/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase();

  if (!product) return 'BTC-USD';

  if (product.endsWith('-USDT')) {
    return `${product.slice(0, -5)}-USD`;
  }

  if (product.includes('-')) {
    return product;
  }

  if (product.endsWith('USDT') && product.length > 4) {
    return `${product.slice(0, -4)}-USD`;
  }
  if (product.endsWith('USDC') && product.length > 4) {
    return `${product.slice(0, -4)}-USDC`;
  }
  if (product.endsWith('USD') && product.length > 3) {
    return `${product.slice(0, -3)}-USD`;
  }
  if (product.endsWith('BTC') && product.length > 3) {
    return `${product.slice(0, -3)}-BTC`;
  }
  if (product.endsWith('ETH') && product.length > 3) {
    return `${product.slice(0, -3)}-ETH`;
  }
  if (product.endsWith('EUR') && product.length > 3) {
    return `${product.slice(0, -3)}-EUR`;
  }

  return `${product}-USD`;
}

/**
 * Normalisasi format simbol pair ke format Vela sesuai bursa aktif
 */
export function resolveVelaSymbolKey(sym: string, pId: string): string {
  if (!sym) return 'binance:BTCUSDT';
  const raw = sym.trim();
  const colonIdx = raw.indexOf(':');
  const rawPrefix = colonIdx > 0 ? raw.slice(0, colonIdx).trim().toLowerCase() : '';
  const clean = colonIdx >= 0 ? raw.slice(colonIdx + 1).trim() : raw;
  const p = rawPrefix || (pId || 'binance').trim().toLowerCase();

  const macroCanonical = canonicalizeMacroIndexSymbol(clean);
  if (p === 'macro' || macroCanonical) {
    return `macro:${macroCanonical || clean.toUpperCase()}`;
  }

  if (p === 'yahoo' || isYahooSymbol(clean)) {
    return `yahoo:${clean.toUpperCase()}`;
  } else if (p === 'indodax' || clean.toUpperCase().endsWith('IDR')) {
    const pair = clean.replace(/[\s\/\-_]/g, '').toUpperCase();
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
      .replace(/[\s\/\-_]/g, '')
      .toUpperCase();
    return `hyperliquid:${coin || clean.toUpperCase()}`;
  } else if (p === 'coinbase') {
    return `coinbase:${normalizeCoinbaseProductId(clean)}`;
  } else if (p.startsWith('custom')) {
    return `${toVelaProviderId(p)}:${clean.toUpperCase()}`;
  }

  const resolvedVenue = p === 'bitunix' ? 'bitunix' : 'binance';
  const compact = clean.replace(/[\s\/\-_]/g, '').toUpperCase();
  const isPerp = compact.endsWith('.P');
  const bare = compact.replace(/\.P$/i, '');
  return `${resolvedVenue}:${isPerp ? `${bare}.P` : bare}`;
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
    if (hint.includes('macro') || hint === 'macro') return 'macro';
    return hint;
  }

  if (isMacroIndexSymbol(clean)) {
    return 'macro';
  } else if (isYahooSymbol(clean)) {
    return 'yahoo';
  } else if (clean.endsWith('IDR')) {
    return 'indodax';
  } else if (clean.endsWith('.P') && currentVenue === 'indodax') {
    return 'bitunix';
  } else if (clean.includes('USDT') && currentVenue === 'indodax') {
    return 'binance';
  } else if (currentVenue === 'macro') {
    // Hindari pasangan biasa mewarisi provider non-tradable macro setelah user berpindah simbol.
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
    const macroCanonical = canonicalizeMacroIndexSymbol(cleanSym);
    if (prefix === 'macro' || macroCanonical) {
      return {
        providerId: 'macro',
        symbol: macroCanonical || cleanSym,
      };
    }
    return {
      providerId: rawProvider || prefix,
      symbol: cleanSym,
    };
  }

  const macroCanonical = canonicalizeMacroIndexSymbol(rawSymbol);
  if (macroCanonical) {
    return {
      providerId: 'macro',
      symbol: macroCanonical,
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
