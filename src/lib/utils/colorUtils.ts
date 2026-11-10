/**
 * Utilitas manipulasi dan kalkulasi warna untuk kanvas grafik dan UI trawangan
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Parsing warna hex (#FFF, #FFFFFF), rgb(r, g, b), atau rgba(r, g, b, a) ke komponen RGB
 */
export function parseRgb(color: string): RgbColor | null {
  if (!color || typeof color !== 'string') return null;
  const s = color.trim().toLowerCase();

  if (s.startsWith('#')) {
    const raw = s.slice(1);
    if (raw.length === 3) {
      return {
        r: parseInt(raw[0] + raw[0], 16),
        g: parseInt(raw[1] + raw[1], 16),
        b: parseInt(raw[2] + raw[2], 16),
      };
    }
    if (raw.length === 6) {
      return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
      };
    }
  }

  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) {
    return {
      r: parseFloat(m[1]),
      g: parseFloat(m[2]),
      b: parseFloat(m[3]),
    };
  }

  return null;
}

/**
 * Menghitung tingkat kecerahan warna (Luminance) untuk menentukan apakah skema warna bertipe Gelap (true) atau Terang (false)
 * Menggunakan formula perceptually-weighted luminance ITU-R BT.709
 */
export function isDarkColor(color: string): boolean {
  const c = parseRgb(color);
  if (!c) return true;
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 128;
}

/**
 * Menghitung Relative Luminance standar W3C WCAG 2.1 (rentang 0.0 hingga 1.0)
 */
export function getRelativeLuminance(color: string): number {
  const c = parseRgb(color);
  if (!c) return 0;
  const linearize = (channel: number): number => {
    const srgb = Math.max(0, Math.min(255, channel)) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(c.r) + 0.7152 * linearize(c.g) + 0.0722 * linearize(c.b);
}

/**
 * Menghitung rasio kontras WCAG 2.1 antara dua warna (rentang 1.0 hingga 21.0)
 */
export function getContrastRatio(colorA: string, colorB: string): number {
  const lumA = getRelativeLuminance(colorA);
  const lumB = getRelativeLuminance(colorB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Memilih warna teks kontras terbaik (#FFFFFF vs #0A0A0A) pada latar permukaan tertentu
 * berdasarkan perbandingan rasio kontras WCAG 2.1 tertinggi.
 */
export function resolveContrastTextColor(
  surfaceColor: string,
  lightInk = '#FFFFFF',
  darkInk = '#0A0A0A'
): string {
  const lightRatio = getContrastRatio(lightInk, surfaceColor);
  const darkRatio = getContrastRatio(darkInk, surfaceColor);
  return lightRatio >= darkRatio ? lightInk : darkInk;
}

/**
 * Menghasilkan warna teks `--bull-text` yang terbaca aman (WCAG AA >= 4.5:1) di atas
 * `bgSurface` maupun `bgPanel` menggunakan strategi Hybrid Semantik:
 * - Pada tema terang dengan warna lilin bull cerah/pastel (`!isDarkColor`), gunakan hijau semantik `#166534`.
 * - Pada warna bull jenuh/gelap (terang maupun gelap), pertahankan hue aslinya jika rasio kontras >= 4.5,
 *   atau geser kecerahan secara bertahap hingga mencapai >= 4.8 terhadap kedua permukaan.
 */
export function resolveReadableBullText(
  bgSurface: string,
  bgPanel: string,
  bullHex: string,
  isDark: boolean
): string {
  const minSurfaceContrast = (candidate: string): number =>
    Math.min(getContrastRatio(candidate, bgSurface), getContrastRatio(candidate, bgPanel));

  if (!isDark && !isDarkColor(bullHex)) {
    const semanticGreen = '#166534';
    if (minSurfaceContrast(semanticGreen) >= 4.5) {
      return semanticGreen;
    }
  }

  if (minSurfaceContrast(bullHex) >= 4.5) {
    return bullHex;
  }

  const targetAnchor = isDark ? '#FFFFFF' : '#000000';
  for (let step = 1; step <= 45; step++) {
    const candidate = mixColors(bullHex, targetAnchor, step * 0.02);
    if (minSurfaceContrast(candidate) >= 4.8) {
      return candidate;
    }
  }

  return isDark ? '#86EFAC' : '#166534';
}

/**
 * Menambahkan atau mengganti nilai alpha channel pada warna
 */
export function withAlpha(color: string, alpha: number): string {
  const c = parseRgb(color);
  if (!c) return color;
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${clampedAlpha})`;
}

/**
 * Melakukan percampuran (blend/mix) linear dua warna
 */
export function mixColors(base: string, top: string, alpha: number): string {
  const b = parseRgb(base);
  const t = parseRgb(top);
  if (!b || !t) return base;
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const blend = (x: number, y: number) => Math.round(x + (y - x) * clampedAlpha);
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(blend(b.r, t.r))}${toHex(blend(b.g, t.g))}${toHex(blend(b.b, t.b))}`;
}

/**
 * Menggelapkan warna heksadesimal dengan rasio tertentu (default 15% / 0.15)
 * Digunakan untuk menghasilkan warna border candlestick yang kontras dan nyaman di mata
 */
export function deriveBorderColor(hex: string, darkenRatio = 0.15): string {
  const c = parseRgb(hex);
  if (!c) return hex;

  const multiplier = Math.max(0, 1 - darkenRatio);
  const darkR = Math.max(0, Math.min(255, Math.round(c.r * multiplier)));
  const darkG = Math.max(0, Math.min(255, Math.round(c.g * multiplier)));
  const darkB = Math.max(0, Math.min(255, Math.round(c.b * multiplier)));

  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(darkR)}${toHex(darkG)}${toHex(darkB)}`;
}

/**
 * Menurunkan warna permukaan kartu/panel (surface) secara harmonis dari warna latar dasar (background)
 * menggunakan Adaptive Luminance:
 * - Pada latar gelap: dicampur sedikit ke arah putih (#FFFFFF) sesuai elevationRatio
 * - Pada latar terang: diteduhkan sedikit ke arah hitam (#000000) agar kartu tampak terpisah lembut tanpa menabrak teks gelap
 */
export function deriveSurfaceColor(background: string, elevationRatio = 0.07): string {
  const dark = isDarkColor(background);
  if (dark) {
    return mixColors(background, '#FFFFFF', elevationRatio);
  }
  return mixColors(background, '#000000', elevationRatio * 0.75);
}

/**
 * Menjamin warna teks memiliki polaritas kontras yang terbaca terhadap warna latar belakang.
 * Jika latar gelap tetapi kandidat teks juga gelap (atau sebaliknya latar terang & teks terang),
 * otomatis mengembalikan warna teks kontras yang aman.
 */
export function ensureReadableTextColor(background: string, candidateText?: string): string {
  const bgIsDark = isDarkColor(background);
  const fallback = bgIsDark ? '#F7F7F7' : '#1A1A1A';
  if (!candidateText || typeof candidateText !== 'string') return fallback;
  const textIsDark = isDarkColor(candidateText);
  if (bgIsDark === textIsDark) {
    return fallback;
  }
  return candidateText;
}

/**
 * Membuat paket token CSS lengkap untuk runtime Vela (`--vela-*`) agar seluruh dialog,
 * menu, dan panel bawaan kit WebGL2 Vela tampil selaras 100% dengan tema aplikasi.
 */
export function generateVelaThemeTokens(
  background: string,
  textColor: string,
  borderColor: string,
  fontFamily = "'Plus Jakarta Sans', sans-serif"
): Record<string, string> {
  const dark = isDarkColor(background);
  const wash = (a: number) => (dark ? `rgba(255, 255, 255, ${a})` : withAlpha(textColor, a + 0.02));
  const elevated = mixColors(background, dark ? '#FFFFFF' : textColor, dark ? 0.03 : 0.05);

  return {
    '--vela-font': fontFamily,
    '--vela-bg': background,
    '--vela-fg': dark ? '#d1d4dc' : textColor,
    '--vela-fg-muted': dark ? '#868a96' : withAlpha(textColor, 0.62),
    '--vela-fg-faint': withAlpha(textColor, 0.35),
    '--vela-fg-bright': dark ? '#f0f3fa' : '#000000',
    '--vela-surface': background,
    '--vela-surface-elev': elevated,
    '--vela-surface-overlay': elevated,
    '--vela-surface-sunken': background,
    '--vela-border': borderColor,
    '--vela-border-strong': dark ? '#34353b' : withAlpha(textColor, 0.28),
    '--vela-border-soft': borderColor,
    '--vela-border-faint': withAlpha(textColor, 0.08),
    '--vela-hover': wash(0.06),
    '--vela-active': wash(0.1),
    '--vela-hover-strong': wash(0.16),
    '--vela-focus': withAlpha(textColor, 0.5),
    '--vela-focus-soft': withAlpha(textColor, 0.12),
    '--vela-separator-hover-band': withAlpha(textColor, 0.1),
    '--vela-separator-hover-line': withAlpha(textColor, 0.55),
    '--vela-scroll': withAlpha(textColor, 0.3),
    '--vela-selected-bg': dark ? '#f0f3fa' : textColor,
    '--vela-selected-fg': dark ? background : '#ffffff',
    '--vela-backdrop': dark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.38)',
    '--vela-shadow-dialog': dark ? '0 12px 32px rgba(0, 0, 0, 0.65)' : '0 12px 32px rgba(0, 0, 0, 0.16)',
  };
}
