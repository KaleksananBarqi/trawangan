export type MacroIndexKind = 'market_cap' | 'dominance';
export type MacroIndexUnit = 'USD' | '%';

export type CanonicalMacroSymbol =
  | 'TOTAL'
  | 'TOTAL2'
  | 'TOTAL3'
  | 'OTHERS'
  | 'BTC.D'
  | 'ETH.D'
  | 'USDT.D';

export interface MacroIndexDescriptor {
  symbol: CanonicalMacroSymbol;
  displayName: string;
  shortName: string;
  kind: MacroIndexKind;
  quoteUnit: MacroIndexUnit;
  description: string;
  aliases: readonly string[];
}

export interface FallbackMacroConstituent {
  symbol: string;
  name: string;
  circulatingSupply: number;
  rank: number;
}

export const MACRO_INDEX_CATALOG: readonly MacroIndexDescriptor[] = [
  {
    symbol: 'TOTAL',
    displayName: 'Total Crypto Market Cap',
    shortName: 'TOTAL',
    kind: 'market_cap',
    quoteUnit: 'USD',
    description: 'Kapitalisasi pasar total kripto (termasuk BTC, ETH, dan stablecoin).',
    aliases: ['TOTAL1', 'TOTALCAP', 'CRYPTOCAP', 'CRYPTOTOTALMARKETCAP'],
  },
  {
    symbol: 'TOTAL2',
    displayName: 'Crypto Market Cap Excl. BTC',
    shortName: 'TOTAL2',
    kind: 'market_cap',
    quoteUnit: 'USD',
    description: 'Kapitalisasi pasar total kripto di luar Bitcoin (termasuk ETH dan stablecoin).',
    aliases: ['TOTALEXBTC', 'ALTCAP'],
  },
  {
    symbol: 'TOTAL3',
    displayName: 'Crypto Market Cap Excl. BTC & ETH',
    shortName: 'TOTAL3',
    kind: 'market_cap',
    quoteUnit: 'USD',
    description: 'Kapitalisasi pasar altcoin di luar Bitcoin dan Ethereum (termasuk stablecoin).',
    aliases: ['TOTALEXBTCETH'],
  },
  {
    symbol: 'OTHERS',
    displayName: 'Crypto Market Cap Excl. Top 10',
    shortName: 'OTHERS',
    kind: 'market_cap',
    quoteUnit: 'USD',
    description: 'Kapitalisasi pasar kripto di luar 10 aset terbesar menurut CoinGecko.',
    aliases: ['OTHER', 'OTHERSCAP'],
  },
  {
    symbol: 'BTC.D',
    displayName: 'Bitcoin Dominance',
    shortName: 'BTC.D',
    kind: 'dominance',
    quoteUnit: '%',
    description: 'Pangsa kapitalisasi pasar Bitcoin terhadap TOTAL (%).',
    aliases: ['BTCD', 'BTCDOM'],
  },
  {
    symbol: 'ETH.D',
    displayName: 'Ethereum Dominance',
    shortName: 'ETH.D',
    kind: 'dominance',
    quoteUnit: '%',
    description: 'Pangsa kapitalisasi pasar Ethereum terhadap TOTAL (%).',
    aliases: ['ETHD', 'ETHDOM'],
  },
  {
    symbol: 'USDT.D',
    displayName: 'Tether Dominance',
    shortName: 'USDT.D',
    kind: 'dominance',
    quoteUnit: '%',
    description: 'Pangsa kapitalisasi pasar Tether (USDT) terhadap TOTAL (%).',
    aliases: ['USDTD', 'USDTDOM'],
  },
] as const;

// Aset wrapped, bridged, dan liquid-staked dikecualikan dari basket agar tidak menggandakan kapitalisasi koin induk.
export const MACRO_WRAPPED_EXCLUSIONS: ReadonlySet<string> = new Set([
  'WBTC',
  'WETH',
  'STETH',
  'WSTETH',
  'CBETH',
  'WBETH',
  'RETH',
  'BTCB',
  'CBBTC',
  'LBTC',
  'SOLVBTC',
  'BNSOL',
  'JITOSOL',
  'MSOL',
  'WEETH',
  'EZETH',
  'EETH',
  'METH',
  'RSETH',
  'FRXETH',
  'SFRXETH',
  'WSOL',
  'SAVAX',
  'SUSDS',
  'SUSDE',
  'SDAI',
]);

// Stablecoin utama diikutsertakan pada TOTAL/TOTAL2/TOTAL3 sesuai konvensi indeks TradingView.
export const MACRO_STABLECOINS: ReadonlySet<string> = new Set([
  'USDT',
  'USDC',
  'DAI',
  'FDUSD',
  'USDE',
  'USDS',
  'TUSD',
  'PYUSD',
  'BUSD',
  'FRAX',
  'LUSD',
  'USDP',
  'GUSD',
  'USD0',
  'RLUSD',
  'USD1',
]);

// Pasokan beredar cadangan bila CoinGecko terkena pembatasan laju (HTTP 429) saat cold start.
export const FALLBACK_MACRO_CONSTITUENTS: readonly FallbackMacroConstituent[] = [
  { symbol: 'BTC', name: 'Bitcoin', circulatingSupply: 19_850_000, rank: 1 },
  { symbol: 'ETH', name: 'Ethereum', circulatingSupply: 120_650_000, rank: 2 },
  { symbol: 'XRP', name: 'XRP', circulatingSupply: 58_300_000_000, rank: 4 },
  { symbol: 'BNB', name: 'BNB', circulatingSupply: 142_470_000, rank: 5 },
  { symbol: 'SOL', name: 'Solana', circulatingSupply: 516_000_000, rank: 6 },
  { symbol: 'DOGE', name: 'Dogecoin', circulatingSupply: 148_800_000_000, rank: 8 },
  { symbol: 'ADA', name: 'Cardano', circulatingSupply: 35_250_000_000, rank: 9 },
  { symbol: 'TRX', name: 'TRON', circulatingSupply: 86_000_000_000, rank: 10 },
  { symbol: 'AVAX', name: 'Avalanche', circulatingSupply: 415_000_000, rank: 13 },
  { symbol: 'LINK', name: 'Chainlink', circulatingSupply: 657_000_000, rank: 14 },
  { symbol: 'TON', name: 'Toncoin', circulatingSupply: 2_500_000_000, rank: 15 },
  { symbol: 'SHIB', name: 'Shiba Inu', circulatingSupply: 589_250_000_000_000, rank: 16 },
  { symbol: 'XLM', name: 'Stellar', circulatingSupply: 30_800_000_000, rank: 17 },
  { symbol: 'HBAR', name: 'Hedera', circulatingSupply: 42_200_000_000, rank: 18 },
  { symbol: 'SUI', name: 'Sui', circulatingSupply: 3_200_000_000, rank: 19 },
  { symbol: 'BCH', name: 'Bitcoin Cash', circulatingSupply: 19_850_000, rank: 20 },
  { symbol: 'DOT', name: 'Polkadot', circulatingSupply: 1_560_000_000, rank: 21 },
  { symbol: 'LTC', name: 'Litecoin', circulatingSupply: 75_650_000, rank: 22 },
  { symbol: 'UNI', name: 'Uniswap', circulatingSupply: 600_480_000, rank: 25 },
  { symbol: 'NEAR', name: 'NEAR Protocol', circulatingSupply: 1_200_000_000, rank: 26 },
  { symbol: 'APT', name: 'Aptos', circulatingSupply: 605_000_000, rank: 27 },
  { symbol: 'PEPE', name: 'Pepe', circulatingSupply: 420_690_000_000_000, rank: 28 },
  { symbol: 'AAVE', name: 'Aave', circulatingSupply: 15_090_000, rank: 29 },
  { symbol: 'ICP', name: 'Internet Computer', circulatingSupply: 482_000_000, rank: 30 },
  { symbol: 'ETC', name: 'Ethereum Classic', circulatingSupply: 151_500_000, rank: 32 },
  { symbol: 'RENDER', name: 'Render', circulatingSupply: 517_700_000, rank: 35 },
  { symbol: 'FET', name: 'ASI Alliance', circulatingSupply: 2_400_000_000, rank: 36 },
  { symbol: 'POL', name: 'Polygon', circulatingSupply: 10_400_000_000, rank: 37 },
  { symbol: 'ARB', name: 'Arbitrum', circulatingSupply: 4_600_000_000, rank: 40 },
  { symbol: 'ATOM', name: 'Cosmos', circulatingSupply: 390_900_000, rank: 42 },
];

export const FALLBACK_USDT_CAP_USD = 144_000_000_000;
export const FALLBACK_TOTAL_STABLECOIN_CAP_USD = 225_000_000_000;

const DESCRIPTOR_BY_CANONICAL = new Map<CanonicalMacroSymbol, MacroIndexDescriptor>(
  MACRO_INDEX_CATALOG.map((item) => [item.symbol, item])
);

const ALIAS_TO_CANONICAL = new Map<string, CanonicalMacroSymbol>();
for (const entry of MACRO_INDEX_CATALOG) {
  const canonicalUpper = entry.symbol.toUpperCase();
  ALIAS_TO_CANONICAL.set(canonicalUpper, entry.symbol);
  ALIAS_TO_CANONICAL.set(canonicalUpper.replace(/\./g, ''), entry.symbol);
  for (const alias of entry.aliases) {
    ALIAS_TO_CANONICAL.set(alias.toUpperCase(), entry.symbol);
    ALIAS_TO_CANONICAL.set(alias.toUpperCase().replace(/\./g, ''), entry.symbol);
  }
}

export const MACRO_PROVIDER_ALIASES: ReadonlySet<string> = new Set([
  'macro',
  'cryptocap',
  'index',
]);

export function isMacroProviderAlias(providerId?: string | null): boolean {
  if (!providerId || typeof providerId !== 'string') return false;
  return MACRO_PROVIDER_ALIASES.has(providerId.trim().toLowerCase());
}

/**
 * Mengembalikan true bila simbol membawa prefix provider eksplisit non-makro (mis. `custom:TOTAL`)
 * atau diberi petunjuk provider custom eksplisit, agar tidak dibajak ke `macro:<SYMBOL>`.
 */
export function hasExplicitNonMacroProvider(
  rawSymbol?: string | null,
  providerHint?: string | null
): boolean {
  if (typeof rawSymbol === 'string') {
    const trimmed = rawSymbol.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const prefix = trimmed.slice(0, colonIdx).trim().toLowerCase();
      if (prefix) {
        return !isMacroProviderAlias(prefix);
      }
    }
  }

  if (typeof providerHint === 'string') {
    const hintLower = providerHint.trim().toLowerCase();
    if (hintLower.startsWith('custom')) {
      return true;
    }
  }

  return false;
}

function extractMacroCandidateToken(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let token = raw.trim().toUpperCase();
  if (!token) return '';

  const colonIdx = token.indexOf(':');
  if (colonIdx >= 0) {
    const prefix = token.slice(0, colonIdx).trim().toLowerCase();
    if (!isMacroProviderAlias(prefix)) {
      return '';
    }
    token = token.slice(colonIdx + 1).trim();
  }

  return token.replace(/[\s\/\-_]/g, '');
}

export function canonicalizeMacroIndexSymbol(raw?: string | null): CanonicalMacroSymbol | null {
  const token = extractMacroCandidateToken(raw);
  if (!token) return null;
  return ALIAS_TO_CANONICAL.get(token) ?? null;
}

export function isMacroIndexSymbol(raw?: string | null): boolean {
  return canonicalizeMacroIndexSymbol(raw) !== null;
}

export function resolveMacroIndexDescriptor(raw?: string | null): MacroIndexDescriptor | null {
  const canonical = canonicalizeMacroIndexSymbol(raw);
  if (!canonical) return null;
  return DESCRIPTOR_BY_CANONICAL.get(canonical) ?? null;
}

export function isMacroDominanceSymbol(raw?: string | null): boolean {
  return resolveMacroIndexDescriptor(raw)?.kind === 'dominance';
}

export function isMacroWrappedOrDuplicate(symbol?: string | null): boolean {
  if (!symbol) return false;
  return MACRO_WRAPPED_EXCLUSIONS.has(symbol.trim().toUpperCase());
}

export function isMacroStablecoin(symbol?: string | null): boolean {
  if (!symbol) return false;
  return MACRO_STABLECOINS.has(symbol.trim().toUpperCase());
}

/**
 * Memformat nilai indeks makro secara ringkas agar selalu muat di lebar sumbu harga Vela 64px.
 * Bila `step` diberikan, presisi desimal menyesuaikan jarak antar-tick agar tidak duplikat saat zoom.
 */
export function formatMacroCompactValue(
  value: number,
  symbolOrUnit?: string | MacroIndexUnit | null,
  step?: number
): string {
  if (!Number.isFinite(value)) return '-';

  const unit =
    symbolOrUnit === '%' || symbolOrUnit === 'USD'
      ? symbolOrUnit
      : resolveMacroIndexDescriptor(symbolOrUnit)?.quoteUnit ?? 'USD';

  if (unit === '%') {
    const decimals = step !== undefined && step > 0 && step < 0.01 ? 3 : 2;
    return `${value.toFixed(decimals)}%`;
  }

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 1e12) {
    const decimals = step !== undefined && step > 0 && step < 1e10 ? 3 : 2;
    return `${sign}${(abs / 1e12).toFixed(decimals)}T`;
  }
  if (abs >= 1e9) {
    const scaled = abs / 1e9;
    const fine = step !== undefined && step > 0 && step < 1e8;
    const decimals = fine ? 3 : scaled >= 100 ? 1 : 2;
    return `${sign}${scaled.toFixed(decimals)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}${(abs / 1e6).toFixed(1)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}${(abs / 1e3).toFixed(1)}K`;
  }
  return `${sign}${abs.toFixed(2)}`;
}
