// Layanan resolusi logo multi-aset (crypto, saham, indeks, komoditas, dan forex).
import { parseAdaptiveSymbol } from './market/symbolSearchService';
import { canonicalizeMacroIndexSymbol, isMacroIndexSymbol } from './macroIndexCatalog';
import {
  IDX_COMPANY_DOMAINS,
  LOCAL_COIN_ICON_PATHS,
  LOCAL_COMMODITY_ICON_PATHS,
  LOCAL_FLAG_ICON_PATHS,
  LOCAL_MACRO_INDEX_ICON_PATHS,
  LOCAL_STOCK_ICON_PATHS,
} from './symbolLogoManifest';
import { buildLogoCacheKey, getCachedLogoLookup } from './symbolLogoCache';

export type AssetLogoClass =
  | 'crypto'
  | 'stock'
  | 'market-index'
  | 'commodity'
  | 'forex'
  | 'macro-index';

export interface SymbolLogoContext {
  symbol?: string;
  provider?: string;
  assetClass?: AssetLogoClass;
}

export interface LogoResolution {
  primary: string;
  fallbacks: string[];
  isLocal: boolean;
  cdnFallback: string;
  baseAsset: string;
  assetClass: AssetLogoClass;
  cacheKey: string;
  needsContrastBacking: boolean;
  secondaryResolution?: LogoResolution;
}

export const LOCAL_COIN_SVGS = new Set(Object.keys(LOCAL_COIN_ICON_PATHS));
const CRYPTO_EXPLICIT_QUOTES = new Set(['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'USDE', 'BTC', 'ETH', 'BNB', 'SOL']);

const MACRO_MONOGRAM_LABELS: Record<string, string> = {
  TOTAL: 'TOT',
  TOTAL2: 'TOT2',
  TOTAL3: 'TOT3',
  OTHERS: 'OTHR',
  'BTC.D': 'BTC%',
  'ETH.D': 'ETH%',
  'USDT.D': 'USD%',
};

const COMMODITY_SYMBOL_MAP: Record<string, keyof typeof LOCAL_COMMODITY_ICON_PATHS> = {
  'GC=F': 'GOLD',
  GC: 'GOLD',
  XAUUSD: 'GOLD',
  XAU: 'GOLD',
  'SI=F': 'SILVER',
  SI: 'SILVER',
  XAGUSD: 'SILVER',
  XAG: 'SILVER',
  'CL=F': 'OIL',
  'BZ=F': 'OIL',
  CL: 'OIL',
  BZ: 'OIL',
  USOIL: 'OIL',
  UKOIL: 'OIL',
  'NG=F': 'NATGAS',
  NG: 'NATGAS',
  'HG=F': 'COPPER',
  HG: 'COPPER',
};

const MARKET_INDEX_FLAG_MAP: Record<string, string> = {
  '^JKSE': 'ID',
  JKSE: 'ID',
  IHSG: 'ID',
  '^GSPC': 'US',
  GSPC: 'US',
  SPX: 'US',
  '^IXIC': 'US',
  IXIC: 'US',
  '^NDX': 'US',
  NDX: 'US',
  '^DJI': 'US',
  DJI: 'US',
  DXY: 'US',
  'DX-Y.NYB': 'US',
  '^N225': 'JP',
  N225: 'JP',
  '^HSI': 'HK',
  HSI: 'HK',
  '^FTSE': 'GB',
  FTSE: 'GB',
  '^GDAXI': 'DE',
  '^FCHI': 'FR',
  '^STI': 'SG',
  '^KS11': 'KR',
  '^AXJO': 'AU',
  '^BSESN': 'IN',
  '^NSEI': 'IN',
};

const FIAT_FLAG_MAP: Record<string, string> = {
  USD: 'US',
  IDR: 'ID',
  EUR: 'EU',
  JPY: 'JP',
  GBP: 'GB',
  CNY: 'CN',
  HKD: 'HK',
  AUD: 'AU',
  CAD: 'CA',
  CHF: 'CH',
  SGD: 'SG',
  KRW: 'KR',
  INR: 'IN',
};

const STOCK_EXCHANGE_SUFFIX_RE = /\.(JK|NS|BO|L|TO|AX|HK|T|PA|DE|SI|KS)$/i;

function resolveFlagUrls(countryCode: string): { primary: string; fallback: string } {
  const upper = countryCode.toUpperCase();
  const lower = countryCode.toLowerCase();
  const cdn = `https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/${lower}.svg`;
  const local = LOCAL_FLAG_ICON_PATHS[upper];
  return {
    primary: local || cdn,
    fallback: local ? cdn : '',
  };
}

function isCryptoProvider(provider?: string): boolean {
  if (!provider) return false;
  const p = provider.toLowerCase();
  return p.includes('binance') || p.includes('indodax') || p.includes('bybit') || p.includes('okx');
}

function stripStockSuffix(raw: string): string {
  return raw.trim().toUpperCase().replace(STOCK_EXCHANGE_SUFFIX_RE, '');
}

export function extractCleanBaseAsset(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim().toUpperCase();
  if (STOCK_EXCHANGE_SUFFIX_RE.test(trimmed)) {
    return stripStockSuffix(trimmed);
  }
  const parsed = parseAdaptiveSymbol(trimmed);
  return parsed.baseAsset || trimmed;
}

export function classifySymbolForLogo(
  symbolOrBase: string,
  context?: SymbolLogoContext
): AssetLogoClass {
  if (context?.assetClass) return context.assetClass;

  const rawSymbol = (context?.symbol || symbolOrBase || '').trim().toUpperCase();
  const baseUpper = (symbolOrBase || '').trim().toUpperCase();
  const provider = context?.provider || '';

  if (
    provider === 'Macro Index' ||
    Boolean(canonicalizeMacroIndexSymbol(rawSymbol)) ||
    Boolean(canonicalizeMacroIndexSymbol(baseUpper)) ||
    isMacroIndexSymbol(rawSymbol) ||
    isMacroIndexSymbol(baseUpper)
  ) {
    return 'macro-index';
  }

  if (COMMODITY_SYMBOL_MAP[rawSymbol] || COMMODITY_SYMBOL_MAP[baseUpper]) {
    return 'commodity';
  }

  if (
    rawSymbol.startsWith('^') ||
    MARKET_INDEX_FLAG_MAP[rawSymbol] ||
    MARKET_INDEX_FLAG_MAP[baseUpper]
  ) {
    return 'market-index';
  }

  const parsed = parseAdaptiveSymbol(rawSymbol || baseUpper);
  if (
    FIAT_FLAG_MAP[parsed.baseAsset] &&
    FIAT_FLAG_MAP[parsed.quoteAsset] &&
    parsed.baseAsset !== parsed.quoteAsset
  ) {
    return 'forex';
  }

  if (STOCK_EXCHANGE_SUFFIX_RE.test(rawSymbol) || STOCK_EXCHANGE_SUFFIX_RE.test(baseUpper)) {
    return 'stock';
  }

  if (provider.toLowerCase().includes('yahoo')) {
    return 'stock';
  }

  // Pair kripto eksplisit (.P atau berkuotasi kripto/stablecoin) tidak boleh salah masuk ke saham meski ticker kembar
  if (parsed.isPerp || (parsed.isQuoteExplicit && CRYPTO_EXPLICIT_QUOTES.has(parsed.quoteAsset))) {
    return 'crypto';
  }

  if (!isCryptoProvider(provider)) {
    const cleanRaw = stripStockSuffix(rawSymbol);
    if (LOCAL_STOCK_ICON_PATHS[cleanRaw] || IDX_COMPANY_DOMAINS[cleanRaw]) {
      return 'stock';
    }
  }

  return 'crypto';
}

function buildCryptoCandidates(base: string): {
  localPath: string | null;
  cdnUrls: string[];
} {
  const upper = base.toUpperCase();
  const lower = base.toLowerCase();
  const localPath = LOCAL_COIN_ICON_PATHS[upper] ?? null;
  const cdnUrls = [
    `https://raw.githubusercontent.com/0xa3k5/web3icons/main/packages/core/src/svgs/tokens/background/${upper}.svg`,
    `https://raw.githubusercontent.com/0xa3k5/web3icons/main/packages/core/src/svgs/tokens/branded/${upper}.svg`,
    `https://cdn.jsdelivr.net/gh/davidepalazzo/ticker-logos@main/crypto_icons/${upper}.png`,
    `https://cdn.jsdelivr.net/gh/nvstly/icons@main/crypto_icons/${upper}.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${lower}.svg`,
  ];
  return { localPath, cdnUrls };
}

function buildStockCandidates(rawSymbol: string, base: string): {
  localPath: string | null;
  cdnUrls: string[];
  ticker: string;
} {
  const ticker = stripStockSuffix(rawSymbol || base);
  const localPath = LOCAL_STOCK_ICON_PATHS[ticker] ?? null;
  const isIdx = /\.JK$/i.test(rawSymbol) || Boolean(IDX_COMPANY_DOMAINS[ticker]);
  const cdnUrls: string[] = [];

  if (!isIdx) {
    cdnUrls.push(
      `https://cdn.jsdelivr.net/gh/davidepalazzo/ticker-logos@main/ticker_icons/${ticker}.png`,
      `https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/${ticker}.png`,
      `https://cdn.jsdelivr.net/gh/MrChartist/global-stock-logos@main/logos/${ticker}.svg`,
      `https://cdn.jsdelivr.net/gh/ShaadyEmad/ticker-logos@main/svg/${ticker.toLowerCase()}.svg`
    );
  } else if (IDX_COMPANY_DOMAINS[ticker]) {
    cdnUrls.push(`https://www.google.com/s2/favicons?domain=${IDX_COMPANY_DOMAINS[ticker]}&sz=128`);
  }

  return { localPath, cdnUrls, ticker };
}

function finalizeRemoteResolution(
  cacheKey: string,
  baseAsset: string,
  assetClass: AssetLogoClass,
  localPath: string | null,
  cdnUrls: string[],
  needsContrastBacking: boolean
): LogoResolution {
  if (localPath) {
    return {
      primary: localPath,
      fallbacks: cdnUrls,
      isLocal: true,
      cdnFallback: cdnUrls[0] ?? '',
      baseAsset,
      assetClass,
      cacheKey,
      needsContrastBacking,
    };
  }

  const cached = getCachedLogoLookup(cacheKey);
  if (cached.hit && cached.failed) {
    return {
      primary: '',
      fallbacks: [],
      isLocal: false,
      cdnFallback: '',
      baseAsset,
      assetClass,
      cacheKey,
      needsContrastBacking,
    };
  }

  if (cached.hit && cached.url) {
    const remaining = cdnUrls.filter((u) => u !== cached.url);
    return {
      primary: cached.url,
      fallbacks: remaining,
      isLocal: false,
      cdnFallback: remaining[0] ?? cached.url,
      baseAsset,
      assetClass,
      cacheKey,
      needsContrastBacking,
    };
  }

  const [primary = '', ...rest] = cdnUrls;
  return {
    primary,
    fallbacks: rest,
    isLocal: false,
    cdnFallback: primary,
    baseAsset,
    assetClass,
    cacheKey,
    needsContrastBacking,
  };
}

export function resolveCoinLogoUrl(
  symbolOrBase: string,
  context?: SymbolLogoContext
): LogoResolution {
  const rawInput = (context?.symbol || symbolOrBase || '').trim().toUpperCase();
  const assetClass = classifySymbolForLogo(symbolOrBase, context);

  if (assetClass === 'macro-index') {
    const macroCanonical =
      canonicalizeMacroIndexSymbol(rawInput) ||
      canonicalizeMacroIndexSymbol(symbolOrBase) ||
      rawInput;
    const localPath = LOCAL_MACRO_INDEX_ICON_PATHS[macroCanonical] ?? '';
    return {
      primary: localPath,
      fallbacks: [],
      isLocal: true,
      cdnFallback: '',
      baseAsset: macroCanonical,
      assetClass,
      cacheKey: buildLogoCacheKey(assetClass, macroCanonical),
      needsContrastBacking: false,
    };
  }

  if (assetClass === 'commodity') {
    const commodityKey =
      COMMODITY_SYMBOL_MAP[rawInput] ||
      COMMODITY_SYMBOL_MAP[(symbolOrBase || '').trim().toUpperCase()] ||
      'GOLD';
    const localPath = LOCAL_COMMODITY_ICON_PATHS[commodityKey] ?? '';
    return {
      primary: localPath,
      fallbacks: [],
      isLocal: Boolean(localPath),
      cdnFallback: '',
      baseAsset: extractCleanBaseAsset(symbolOrBase),
      assetClass,
      cacheKey: buildLogoCacheKey(assetClass, commodityKey),
      needsContrastBacking: false,
    };
  }

  if (assetClass === 'market-index') {
    const country =
      MARKET_INDEX_FLAG_MAP[rawInput] ||
      MARKET_INDEX_FLAG_MAP[(symbolOrBase || '').trim().toUpperCase()] ||
      'US';
    const flag = resolveFlagUrls(country);
    return {
      primary: flag.primary,
      fallbacks: flag.fallback ? [flag.fallback] : [],
      isLocal: Boolean(LOCAL_FLAG_ICON_PATHS[country]),
      cdnFallback: flag.fallback,
      baseAsset: extractCleanBaseAsset(symbolOrBase),
      assetClass,
      cacheKey: buildLogoCacheKey(assetClass, country),
      needsContrastBacking: false,
    };
  }

  if (assetClass === 'forex') {
    const parsed = parseAdaptiveSymbol(rawInput);
    const baseCountry = FIAT_FLAG_MAP[parsed.baseAsset] || 'US';
    const quoteCountry = FIAT_FLAG_MAP[parsed.quoteAsset] || 'US';
    const baseFlag = resolveFlagUrls(baseCountry);
    const quoteFlag = resolveFlagUrls(quoteCountry);
    const secondaryResolution: LogoResolution = {
      primary: quoteFlag.primary,
      fallbacks: quoteFlag.fallback ? [quoteFlag.fallback] : [],
      isLocal: Boolean(LOCAL_FLAG_ICON_PATHS[quoteCountry]),
      cdnFallback: quoteFlag.fallback,
      baseAsset: parsed.quoteAsset,
      assetClass,
      cacheKey: buildLogoCacheKey(assetClass, quoteCountry),
      needsContrastBacking: false,
    };
    return {
      primary: baseFlag.primary,
      fallbacks: baseFlag.fallback ? [baseFlag.fallback] : [],
      isLocal: Boolean(LOCAL_FLAG_ICON_PATHS[baseCountry]),
      cdnFallback: baseFlag.fallback,
      baseAsset: parsed.baseAsset,
      assetClass,
      cacheKey: buildLogoCacheKey(assetClass, `${parsed.baseAsset}${parsed.quoteAsset}`),
      needsContrastBacking: false,
      secondaryResolution,
    };
  }

  if (assetClass === 'stock') {
    const { localPath, cdnUrls, ticker } = buildStockCandidates(
      rawInput,
      extractCleanBaseAsset(symbolOrBase)
    );
    const cacheKey = buildLogoCacheKey(assetClass, ticker);
    return finalizeRemoteResolution(cacheKey, ticker, assetClass, localPath, cdnUrls, true);
  }

  const base = extractCleanBaseAsset(symbolOrBase);
  const { localPath, cdnUrls } = buildCryptoCandidates(base);
  const cacheKey = buildLogoCacheKey(assetClass, base);
  return finalizeRemoteResolution(cacheKey, base, assetClass, localPath, cdnUrls, false);
}

export const resolveAssetLogoUrl = resolveCoinLogoUrl;

export function resolveQuoteLogoUrl(
  quoteAsset: string,
  baseResolution: LogoResolution
): LogoResolution | null {
  if (baseResolution.assetClass === 'forex' && baseResolution.secondaryResolution) {
    return baseResolution.secondaryResolution;
  }
  return quoteAsset ? resolveCoinLogoUrl(quoteAsset) : null;
}

export function shouldShowDualAssetBadge(
  baseAsset: string,
  quoteAsset: string,
  baseResolution: LogoResolution,
  showDualBadge: boolean
): boolean {
  if (baseResolution.assetClass === 'forex' && baseResolution.secondaryResolution) return true;
  if (!quoteAsset) return false;
  const q = quoteAsset.toUpperCase();
  const b = baseAsset.toUpperCase();
  if (q === b || q === '%' || isMacroIndexSymbol(b)) return false;
  if (baseResolution.assetClass === 'market-index' || baseResolution.assetClass === 'commodity') {
    return false;
  }
  return showDualBadge || q !== 'USDT';
}

export function getMonogramInitials(base: string): string {
  if (!base) return '?';
  const upper = base.trim().toUpperCase();
  const macroCanonical = canonicalizeMacroIndexSymbol(upper);
  if (macroCanonical && MACRO_MONOGRAM_LABELS[macroCanonical]) {
    return MACRO_MONOGRAM_LABELS[macroCanonical];
  }
  const clean = upper.replace(/^\d+/, '').trim();
  if (!clean) return upper.slice(0, 3);
  return clean.slice(0, 4);
}

export function getMonogramColor(base: string): string {
  if (!base) return 'linear-gradient(135deg, hsl(210, 45%, 40%), hsl(220, 55%, 25%))';
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = base.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const nextHue = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 65%, 45%), hsl(${nextHue}, 75%, 28%))`;
}
