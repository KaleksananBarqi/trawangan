// Layanan Resolusi Visual Identitas Aset Koin (Hybrid Asset Logo Engine)

/**
 * Daftar koin yang dibundle secara lokal di `static/icons/coins/` untuk kapabilitas offline-first sub-1ms.
 */
export const LOCAL_COIN_SVGS = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'SUI', 'LINK',
  'PEPE', 'SHIB', 'NEAR', 'APT', 'DOT', 'RENDER', 'TAO', 'FET', 'INJ', 'ARB',
  'OP', 'MATIC', 'POL', 'LTC', 'BCH', 'KAS', 'SEI', 'TIA', 'WIF', 'BONK',
  'FLOKI', 'ENA', 'PENDLE', 'AAVE', 'UNI', 'TON', 'TRX', 'ATOM', 'FTM', 'ALGO',
  'USDT', 'USDC', 'IDR'
]);

export interface LogoResolution {
  primary: string;
  isLocal: boolean;
  cdnFallback: string;
  baseAsset: string;
}

/**
 * Membersihkan ticker simbol ke base asset kanonikal.
 * Contoh: "ETHBTC" -> "ETH" jika dipanggil untuk logo koin utama, atau "SOLUSDT.P" -> "SOL".
 */
export function extractCleanBaseAsset(raw: string): string {
  if (!raw) return '';
  const clean = raw.trim().toUpperCase().replace(/[\/\-_]/g, '');
  if (clean.endsWith('.P')) return clean.slice(0, -2).replace(/(USDT|USDC|IDR|BTC)$/, '');
  for (const q of ['USDT', 'USDC', 'IDR', 'BTC']) {
    if (clean.endsWith(q) && clean.length > q.length) {
      return clean.slice(0, -q.length);
    }
  }
  return clean;
}

/**
 * Mengembalikan URL logo koin berdasarkan strategi multi-tier:
 * 1. Bundle lokal (jika terdaftar di LOCAL_COIN_SVGS)
 * 2. CDN publik cryptocurrency-icons / coincap
 */
export function resolveCoinLogoUrl(symbolOrBase: string): LogoResolution {
  const base = extractCleanBaseAsset(symbolOrBase);
  const lower = base.toLowerCase();
  const cdnFallback = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${lower}.svg`;

  if (LOCAL_COIN_SVGS.has(base)) {
    return {
      primary: `/icons/coins/${lower}.svg`,
      isLocal: true,
      cdnFallback,
      baseAsset: base,
    };
  }

  return {
    primary: cdnFallback,
    isLocal: false,
    cdnFallback,
    baseAsset: base,
  };
}

/**
 * Menghasilkan inisial teks bersih untuk Monogram Avatar (maksimal 4 karakter).
 * Menangani prefix kuantitatif seperti '1000SATS' -> 'SATS'.
 */
export function getMonogramInitials(base: string): string {
  if (!base) return '?';
  const clean = base.replace(/^\d+/, '').trim().toUpperCase();
  if (!clean) return base.slice(0, 3).toUpperCase();
  return clean.slice(0, 4);
}

/**
 * Menghasilkan warna latar belakang HSL deterministik berbasis hash ticker string.
 * Menjamin koin yang sama selalu menghasilkan rona warna yang persis sama.
 */
export function getMonogramColor(base: string): string {
  if (!base) return 'hsl(210, 40%, 35%)';
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = base.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 40%)`;
}
