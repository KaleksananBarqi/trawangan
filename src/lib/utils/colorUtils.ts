/**
 * Utilitas manipulasi dan kalkulasi warna untuk kanvas grafik dan UI trawangan
 */

/**
 * Menggelapkan warna heksadesimal dengan rasio tertentu (default 15% / 0.15)
 * Digunakan untuk menghasilkan warna border candlestick yang kontras dan nyaman di mata
 */
export function deriveBorderColor(hex: string, darkenRatio = 0.15): string {
  if (!hex || typeof hex !== 'string') return '#000000';

  let cleanHex = hex.trim().replace(/^#/, '');

  // Tangani short hex 3-karakter (misal: #FFF -> #FFFFFF)
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (cleanHex.length !== 6) {
    return hex; // Kembalikan string asli jika format hex tidak valid
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return hex;
  }

  const multiplier = Math.max(0, 1 - darkenRatio);
  const darkR = Math.max(0, Math.min(255, Math.round(r * multiplier)));
  const darkG = Math.max(0, Math.min(255, Math.round(g * multiplier)));
  const darkB = Math.max(0, Math.min(255, Math.round(b * multiplier)));

  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();

  return `#${toHex(darkR)}${toHex(darkG)}${toHex(darkB)}`;
}
