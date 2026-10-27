// Layanan Resolusi Visual Identitas Aset Koin (Hybrid Asset Logo Engine)
import { parseAdaptiveSymbol } from './market/symbolSearchService';

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
 * Membersihkan ticker simbol ke base asset kanonikal menggunakan Adaptive Quote Parser.
 */
export function extractCleanBaseAsset(raw: string): string {
  if (!raw) return '';
  const parsed = parseAdaptiveSymbol(raw);
  return parsed.baseAsset || raw.trim().toUpperCase();
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
 * Menghasilkan warna latar belakang gradien deterministik berbasis hash ticker string.
 * Menjamin koin yang sama selalu menghasilkan palet warna visual yang konsisten.
 */
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
