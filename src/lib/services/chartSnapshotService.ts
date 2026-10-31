/**
 * Layanan Kompositor Tangkapan Layar Offline (Offline Branded Snapshot Engine)
 * Membangun komposit kanvas 2D lokal murni dengan Branded Snapshot Frame dan Attribution Bar.
 */

import { formatPriceLabel } from './priceScaleLabelService';
import type { SnapshotScaleMultiplier, UserProfileConfig, SecurityWatermarkConfig } from '../types/market';

export type { SnapshotScaleMultiplier, UserProfileConfig, SecurityWatermarkConfig } from '../types/market';
export type SnapshotScope = 'active' | 'all';
export type SnapshotMode = 'branded' | 'clean';

export interface SnapshotMetadata {
  symbol: string;
  timeframe: string;
  providerId: string;
  lastPrice?: number | null;
  timezone?: string;
  timestamp?: number | Date;
  layout?: string;
  scope?: SnapshotScope;
}

export interface SnapshotOptions {
  mode?: SnapshotMode;
  scale?: number;
  scaleMultiplier?: SnapshotScaleMultiplier;
  padding?: number;
  backgroundColor?: string;
  includePrice?: boolean;
  includeTimestamp?: boolean;
  includeBrandUrl?: boolean;
  logoImage?: any;
  avatarImage?: any;
  userProfile?: UserProfileConfig;
  watermark?: SecurityWatermarkConfig;
  metadata: SnapshotMetadata;
}

export interface CompositeDimensions {
  width: number;
  height: number;
  chartX: number;
  chartY: number;
  chartWidth: number;
  chartHeight: number;
  attributionY: number;
  attributionHeight: number;
}

/**
 * Cache memori lokal untuk citra logo resmi aplikasi
 */
let cachedLogoImage: any = null;

/**
 * Menyimpan referensi citra logo resmi aplikasi ke dalam cache memori.
 */
export function setCachedOfficialLogo(image: any): void {
  cachedLogoImage = image;
}

/**
 * Membersihkan citra logo resmi aplikasi dari cache memori.
 */
export function clearCachedOfficialLogo(): void {
  cachedLogoImage = null;
}

/**
 * Memuat citra logo resmi aplikasi (/static/logo.png) dengan mekanisme cache in-memory.
 * Menyediakan penanganan fallback yang elegan saat berjalan di lingkungan headless/non-browser.
 */
export async function loadOfficialLogo(src = '/static/logo.png'): Promise<any> {
  if (cachedLogoImage) {
    return cachedLogoImage;
  }
  if (typeof Image === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        cachedLogoImage = img;
        resolve(img);
      };
      img.onerror = () => {
        // Coba path alternatif /logo.png jika /static/logo.png tidak ditemukan pada root web server
        if (src === '/static/logo.png') {
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = 'anonymous';
          fallbackImg.onload = () => {
            cachedLogoImage = fallbackImg;
            resolve(fallbackImg);
          };
          fallbackImg.onerror = () => resolve(null);
          fallbackImg.src = '/logo.png';
        } else {
          resolve(null);
        }
      };
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Menggambar placeholder kotak logo resmi jika berkas gambar belum atau gagal dimuat.
 * Menghilangkan monogram manual 'tr' sesuai ADR-0015 & Tiket #125.
 */
function drawLogoFallbackBadge(
  ctx: any,
  x: number,
  y: number,
  size: number,
  scale: number
): void {
  const radius = Math.round(6 * scale);
  drawRoundedRect(ctx, x, y, size, size, radius);
  ctx.fillStyle = '#FF69B4';
  ctx.fill();
}

/**
 * Memuat citra avatar pengguna dari data URL (base64) secara asinkron (#126).
 */
export async function loadAvatarImage(dataUrl: string): Promise<any> {
  if (typeof Image === 'undefined' || !dataUrl) {
    return null;
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Menggambar badge avatar bulat dengan warna aksen brand (#FF69B4) dan inisial huruf pertama username (#126).
 */
function renderAvatarInitialBadge(
  ctx: any,
  centerX: number,
  centerY: number,
  radius: number,
  username: string,
  scale: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#FF69B4';
  ctx.fill();

  const initial = (username.trim().charAt(0) || 'T').toUpperCase();
  ctx.font = `bold ${Math.round(11 * scale)}px "Plus Jakarta Sans", -apple-system, sans-serif`;
  ctx.fillStyle = '#0F0F0F';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, centerX, centerY);
  ctx.restore();
}

/**
 * Menghitung skala efektif komposit tangkapan layar berdasarkan faktor multiplier dan DPR.
 * Rumus totalScale = dpr * scaleMultiplier (#125).
 */
export function resolveEffectiveScale(options: SnapshotOptions): number {
  if (options.scaleMultiplier != null) {
    const dpr = options.scale !== undefined && options.scale !== 2 ? options.scale : 1;
    return dpr * options.scaleMultiplier;
  }
  return options.scale ?? 2;
}

/**
 * Menghitung dimensi presisi untuk komposit snapshot kartu maupun ekspor clean
 */
export function calculateCompositeDimensions(
  sourceWidth: number,
  sourceHeight: number,
  options: SnapshotOptions
): CompositeDimensions {
  const mode = options.mode ?? 'branded';
  const scale = resolveEffectiveScale(options);
  const padding = options.padding ?? 24;

  if (mode === 'clean') {
    const w = Math.round(sourceWidth * scale);
    const h = Math.round(sourceHeight * scale);
    return {
      width: w,
      height: h,
      chartX: 0,
      chartY: 0,
      chartWidth: w,
      chartHeight: h,
      attributionY: 0,
      attributionHeight: 0,
    };
  }

  // Tinggi baris attribution bar unscaled (logical pixels)
  const attributionHeightLogical = 60;
  const totalLogicalWidth = sourceWidth + padding * 2;
  const totalLogicalHeight = sourceHeight + padding * 2 + attributionHeightLogical;

  return {
    width: Math.round(totalLogicalWidth * scale),
    height: Math.round(totalLogicalHeight * scale),
    chartX: Math.round(padding * scale),
    chartY: Math.round(padding * scale),
    chartWidth: Math.round(sourceWidth * scale),
    chartHeight: Math.round(sourceHeight * scale),
    attributionY: Math.round((padding + sourceHeight) * scale),
    attributionHeight: Math.round(attributionHeightLogical * scale),
  };
}

/**
 * Membuat nama file tangkapan layar terstruktur dan aman untuk filesystem
 * Format: trawangan-[symbol]-[timeframe]-[formattedDate].png
 */
export function generateSnapshotFilename(
  symbol: string,
  timeframe: string,
  timestamp?: number | Date
): string {
  const safeSymbol = (symbol || 'chart').replace(/[:/\\?*<>"| ]+/g, '-');
  const safeTf = (timeframe || 'tf').replace(/[:/\\?*<>"| ]+/g, '-');
  const d =
    timestamp instanceof Date
      ? timestamp
      : typeof timestamp === 'number'
        ? new Date(timestamp)
        : new Date();

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `trawangan-${safeSymbol}-${safeTf}-${yyyy}${mm}${dd}-${hh}${min}${ss}.png`;
}

/**
 * Format timestamp snapshot ke representasi tanggal dan jam lokal pengguna
 * Default menggunakan zona waktu Asia/Jakarta (WIB)
 */
export function formatSnapshotTimestamp(
  timestamp?: number | Date,
  timezone = 'Asia/Jakarta'
): string {
  const date =
    timestamp instanceof Date
      ? timestamp
      : typeof timestamp === 'number'
        ? new Date(timestamp)
        : new Date();

  // Inisialisasi formatter dengan bahasa Indonesia
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Hapus karakter koma jika ada pemisah antara tanggal dan jam
  const formattedDateStr = formatter.format(date).replace(',', '');

  // Tentukan akronim zona waktu lokal yang umum
  let tzLabel = 'WIB';
  if (timezone === 'Asia/Jakarta') {
    tzLabel = 'WIB';
  } else if (timezone === 'Asia/Makassar') {
    tzLabel = 'WITA';
  } else if (timezone === 'Asia/Jayapura') {
    tzLabel = 'WIT';
  } else if (timezone === 'UTC' || timezone === 'Etc/UTC') {
    tzLabel = 'UTC';
  } else {
    try {
      const shortTzFormatter = new Intl.DateTimeFormat('id-ID', {
        timeZone: timezone,
        timeZoneName: 'short',
      });
      const parts = shortTzFormatter.formatToParts(date);
      const tzPart = parts.find((p) => p.type === 'timeZoneName');
      tzLabel = tzPart ? tzPart.value : timezone;
    } catch {
      tzLabel = timezone;
    }
  }

  return `${formattedDateStr} ${tzLabel}`;
}

/**
 * Memformat harga pasar terkini dengan pemisah ribuan dan penyesuaian desimal
 * Mendelegasikan logika format harga ke priceScaleLabelService
 */
export function formatSnapshotPrice(price: number | null | undefined, quote?: string): string {
  if (price == null || typeof price !== 'number' || isNaN(price)) {
    return '-';
  }
  return formatPriceLabel(price, quote);
}

/**
 * Helper internal untuk menggambar rounded rectangle pada context kanvas 2D
 */
function drawRoundedRect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export interface FallbackCanvas {
  width: number;
  height: number;
  getContext: (contextId: string) => CanvasRenderingContext2D;
  toDataURL: (type?: string) => string;
  toBlob: (cb: (blob: Blob | null) => void, type?: string) => void;
}

/**
 * Helper internal untuk membuat fallback canvas sederhana di lingkungan non-browser
 */
function createFallbackCanvas(width: number, height: number): FallbackCanvas {
  return {
    width,
    height,
    getContext: () => ({
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      arcTo: () => {},
      roundRect: () => {},
      rect: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      drawImage: () => {},
      measureText: (text: string) => ({ width: text.length * 8 }),
    } as unknown as CanvasRenderingContext2D),
    toDataURL: (type = 'image/png') => `data:${type};base64,mockFallbackData`,
    toBlob: (cb: (blob: Blob | null) => void, type = 'image/png') => {
      try {
        cb(new Blob(['mockFallbackData'], { type }));
      } catch {
        cb(null);
      }
    },
  };
}

/**
 * Menyelesaikan teks yang akan ditampilkan pada tanda air keamanan kanvas (#127).
 * Memprioritaskan teks kustom pengguna, dan beralih ke nama/handle profil trader
 * atau fallback default sistem jika tidak diisi.
 */
export function resolveSecurityWatermarkText(
  watermark?: SecurityWatermarkConfig | null,
  profile?: UserProfileConfig | null
): string {
  const customText = watermark?.text?.trim();
  if (customText) {
    return customText;
  }
  const username = profile?.username?.trim();
  const handle = profile?.handle?.trim();
  if (username && handle) {
    const formattedHandle = handle.startsWith('@') ? handle : `@${handle}`;
    return `${username} (${formattedHandle})`;
  }
  if (username) {
    return username;
  }
  if (handle) {
    return handle.startsWith('@') ? handle : `@${handle}`;
  }
  return 'TRAWANGAN';
}

/**
 * Merender tanda air keamanan semi-transparan diagonal pada kanvas grafik (#127)
 * Memosisikan teks di tengah area grafik dengan sudut rotasi diagonal -30° s.d. -35°
 * serta opasitas yang dikontrol oleh pengaturan pengguna.
 */
function drawSecurityWatermark(
  ctx: any,
  dim: CompositeDimensions,
  watermark?: SecurityWatermarkConfig,
  profile?: UserProfileConfig,
  scale = 1
): void {
  if (!watermark || !watermark.enabled) {
    return;
  }

  const text = resolveSecurityWatermarkText(watermark, profile);
  if (!text) {
    return;
  }

  // Sanitasi dan batasi nilai opasitas ke rentang 0.05 s.d. 0.30
  let opacity = typeof watermark.opacity === 'number' && !Number.isNaN(watermark.opacity)
    ? watermark.opacity
    : 0.10;
  if (opacity < 0.05) opacity = 0.05;
  if (opacity > 0.30) opacity = 0.30;

  const centerX = dim.chartX + dim.chartWidth / 2;
  const centerY = dim.chartY + dim.chartHeight / 2;

  // Ukuran font proporsional terhadap dimensi grafik dan skala komposit
  const baseFontSize = Math.max(22 * scale, Math.min(dim.chartWidth * 0.05, 54 * scale));
  const fontSize = Math.round(baseFontSize);

  // Sudut diagonal -32° (-0.5585 radian)
  const ROTATION_ANGLE = -32 * (Math.PI / 180);

  ctx.save();
  // Kliping ke batas area grafik agar tanda air tidak meluber ke Attribution Bar atau batas luar
  ctx.beginPath();
  ctx.rect(dim.chartX, dim.chartY, dim.chartWidth, dim.chartHeight);
  ctx.clip();

  ctx.translate(centerX, centerY);
  ctx.rotate(ROTATION_ANGLE);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = opacity;

  // Render teks utama dengan font tebal
  ctx.font = `800 ${fontSize}px "JetBrains Mono", "Plus Jakarta Sans", monospace, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, 0, 0);

  // Garis tepi tipis agar tanda air tetap kontras pada ragam tema dan latar belakang
  ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.strokeText(text, 0, 0);

  ctx.restore();
}

/**
 * Merender grafik sumber ke dalam kanvas komposit dengan bingkai kartu dan Attribution Bar
 */
export function compositeSnapshot(
  sourceCanvasOrImage: any,
  options: SnapshotOptions,
  targetCanvas?: any
): any {
  const sourceWidth = Number(sourceCanvasOrImage?.width) || 1280;
  const sourceHeight = Number(sourceCanvasOrImage?.height) || 720;
  const scale = resolveEffectiveScale(options);
  const mode = options.mode ?? 'branded';

  const dim = calculateCompositeDimensions(sourceWidth, sourceHeight, options);

  // Inisialisasi target canvas
  let canvas = targetCanvas;
  if (!canvas) {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      canvas = document.createElement('canvas');
    } else {
      canvas = createFallbackCanvas(dim.width, dim.height);
    }
  }

  canvas.width = dim.width;
  canvas.height = dim.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Jika mode clean, render murni raster grafik tanpa bingkai luar
  if (mode === 'clean') {
    ctx.drawImage(sourceCanvasOrImage, 0, 0, dim.width, dim.height);
    drawSecurityWatermark(ctx, dim, options.watermark, options.userProfile, scale);
    return canvas;
  }

  // --- 1. Container Background & Outer Border ---
  ctx.save();
  drawRoundedRect(ctx, 0, 0, dim.width, dim.height, 12 * scale);
  ctx.fillStyle = options.backgroundColor || '#0F0F0F';
  ctx.fill();

  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();
  ctx.restore();

  // --- 2. Chart Rendering dengan Rounded Corners & Inner Border ---
  ctx.save();
  drawRoundedRect(ctx, dim.chartX, dim.chartY, dim.chartWidth, dim.chartHeight, 8 * scale);
  ctx.clip();
  ctx.drawImage(sourceCanvasOrImage, dim.chartX, dim.chartY, dim.chartWidth, dim.chartHeight);
  ctx.restore();

  // 2b. Tanda Air Keamanan Anti-Pencurian (#127)
  drawSecurityWatermark(ctx, dim, options.watermark, options.userProfile, scale);

  // Garis batas redup di sekeliling area chart
  ctx.save();
  drawRoundedRect(ctx, dim.chartX, dim.chartY, dim.chartWidth, dim.chartHeight, 8 * scale);
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();
  ctx.restore();

  // --- 3. Attribution Bar di Bagian Bawah ---
  const centerY = dim.attributionY + dim.attributionHeight / 2;
  const paddingX = dim.chartX;

  // SISI KIRI: Logo Resmi Citra, Brand 'trawangan', & Badge Instrumen
  ctx.save();
  ctx.textBaseline = 'middle';

  // 3a. Rendering Logo Citra Resmi (/static/logo.png) menggantikan monogram manual 'tr' (#125)
  const logoSize = Math.round(24 * scale);
  const logoX = paddingX;
  const logoY = Math.round(centerY - logoSize / 2);

  const logoImg = options.logoImage || cachedLogoImage;
  if (logoImg) {
    try {
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
      drawLogoFallbackBadge(ctx, logoX, logoY, logoSize, scale);
    }
  } else {
    drawLogoFallbackBadge(ctx, logoX, logoY, logoSize, scale);
    if (typeof Image !== 'undefined' && !cachedLogoImage) {
      loadOfficialLogo().catch(() => {});
    }
  }

  // 3b. Identitas Brand / Personal Attribution (#126)
  let currentX = logoX + logoSize + Math.round(10 * scale);
  const profile = options.userProfile;
  const username = profile?.username?.trim() || '';
  const hasUsername = username.length > 0;

  if (hasUsername) {
    // 3b-1. Avatar Pengguna (Citra Bulat dengan Kliping Lingkaran atau Lingkaran Aksen Inisial Huruf Pertama)
    const avatarSize = Math.round(22 * scale);
    const avatarRadius = avatarSize / 2;
    const avatarCenterX = currentX + avatarRadius;
    const avatarCenterY = centerY;

    const avatarImg = options.avatarImage;
    if (avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      try {
        ctx.drawImage(
          avatarImg,
          currentX,
          Math.round(centerY - avatarRadius),
          avatarSize,
          avatarSize
        );
      } catch {
        renderAvatarInitialBadge(ctx, avatarCenterX, avatarCenterY, avatarRadius, username, scale);
      }
      ctx.restore();
    } else {
      renderAvatarInitialBadge(ctx, avatarCenterX, avatarCenterY, avatarRadius, username, scale);
    }

    currentX += avatarSize + Math.round(8 * scale);

    // 3b-2. Teks Nama Pengguna (Username)
    ctx.font = `bold ${Math.round(14 * scale)}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(username, currentX, centerY);

    const usernameWidth = ctx.measureText ? ctx.measureText(username).width : username.length * 8 * scale;
    currentX += usernameWidth;

    // 3b-3. Social Handle (@handle) jika terisi
    const rawHandle = profile?.handle?.trim() || '';
    if (rawHandle) {
      const formattedHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
      currentX += Math.round(6 * scale);
      ctx.font = `400 ${Math.round(12 * scale)}px "JetBrains Mono", monospace, sans-serif`;
      ctx.fillStyle = '#9E9E9E';
      ctx.textAlign = 'left';
      ctx.fillText(formattedHandle, currentX, centerY);

      const handleWidth = ctx.measureText ? ctx.measureText(formattedHandle).width : formattedHandle.length * 7 * scale;
      currentX += handleWidth;
    }

    // 3c. Pemisah Titik Redup
    currentX += Math.round(12 * scale);
    ctx.font = `${Math.round(12 * scale)}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillText('·', currentX, centerY);
    currentX += Math.round(12 * scale);
  } else {
    // 3b-alt. Teks Brand 'trawangan' Bawaan
    ctx.font = `bold ${Math.round(15 * scale)}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText('trawangan', currentX, centerY);

    const brandWidth = ctx.measureText ? ctx.measureText('trawangan').width : 70 * scale;
    currentX += brandWidth + Math.round(12 * scale);

    // 3c. Pemisah Titik Redup
    ctx.font = `${Math.round(12 * scale)}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillText('·', currentX, centerY);
    currentX += Math.round(12 * scale);
  }

  // 3d. Badge Instrumen ([SYMBOL] · [TF] · [PROVIDER] atau MULTI-CHART GRID · [LAYOUT] · [PROVIDER])
  const meta = options.metadata;
  let instrumentText: string;
  if (meta.scope === 'all' || meta.symbol.toUpperCase() === 'MULTI-CHART GRID') {
    const layoutLabel = meta.layout
      ? (meta.layout === '2v' ? '2-SPLIT VERTICAL' : meta.layout === '2h' ? '2-SPLIT HORIZONTAL' : meta.layout === '4' ? '4-GRID' : `LAYOUT ${meta.layout.toUpperCase()}`)
      : (meta.timeframe || 'GRID');
    instrumentText = `MULTI-CHART GRID · ${layoutLabel} · ${meta.providerId.toUpperCase()}`;
  } else {
    instrumentText = `${meta.symbol.toUpperCase()} · ${meta.timeframe} · ${meta.providerId.toUpperCase()}`;
  }
  ctx.font = `500 ${Math.round(12 * scale)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = '#B0B0B0';
  ctx.fillText(instrumentText, currentX, centerY);

  ctx.restore();

  // SISI KANAN: Harga Terakhir, Waktu Lokal, & URL Website
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  let rightX = dim.chartX + dim.chartWidth;

  // 3e. URL Terminal Website
  if (options.includeBrandUrl !== false) {
    const brandUrl = 'kaleksananbarqi.github.io/trawangan';
    ctx.font = `400 ${Math.round(11 * scale)}px "JetBrains Mono", monospace, sans-serif`;
    ctx.fillStyle = '#6E6E6E';
    ctx.fillText(brandUrl, rightX, centerY);

    const urlWidth = ctx.measureText ? ctx.measureText(brandUrl).width : 160 * scale;
    rightX -= urlWidth + Math.round(16 * scale);
  }

  // 3f. Waktu Lokal Pengguna
  if (options.includeTimestamp !== false) {
    const timestampText = formatSnapshotTimestamp(meta.timestamp, meta.timezone);
    ctx.font = `400 ${Math.round(12 * scale)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#9E9E9E';
    ctx.fillText(timestampText, rightX, centerY);

    const timeWidth = ctx.measureText ? ctx.measureText(timestampText).width : 120 * scale;
    rightX -= timeWidth + Math.round(16 * scale);
  }

  // 3g. Harga Terakhir (Last Market Price)
  // Jangan tampilkan harga pada multi-chart scope karena harga single chart ambigu untuk layout multi-grid
  const isMultiScope = meta.scope === 'all' || meta.symbol.toUpperCase() === 'MULTI-CHART GRID';
  if (options.includePrice !== false && meta.lastPrice != null && !isMultiScope) {
    const formattedPrice = formatSnapshotPrice(meta.lastPrice);
    ctx.font = `bold ${Math.round(14 * scale)}px "JetBrains Mono", monospace, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(formattedPrice, rightX, centerY);
  }

  ctx.restore();

  return canvas;
}

/**
 * Menghasilkan kanvas komposit snapshot siap pakai
 */
export async function captureSnapshot(
  sourceCanvasOrImage: any,
  options: SnapshotOptions,
  targetCanvas?: any
): Promise<any> {
  if (!options.logoImage && !cachedLogoImage && typeof Image !== 'undefined') {
    try {
      await loadOfficialLogo();
    } catch {
      // Abaikan jika pemuatan citra gagal, fallback badge akan digunakan
    }
  }
  if (options.userProfile?.avatarDataUrl && !options.avatarImage && typeof Image !== 'undefined') {
    try {
      options.avatarImage = await loadAvatarImage(options.userProfile.avatarDataUrl);
    } catch {
      // Abaikan jika pemuatan citra avatar gagal, fallback inisial akan digunakan
    }
  }
  return compositeSnapshot(sourceCanvasOrImage, options, targetCanvas);
}

/**
 * Mengambil representasi base64 data URL (PNG) dari snapshot
 */
export async function getSnapshotDataUrl(
  sourceCanvasOrImage: any,
  options: SnapshotOptions,
  targetCanvas?: any
): Promise<string> {
  const canvas = await captureSnapshot(sourceCanvasOrImage, options, targetCanvas);
  if (typeof canvas.toDataURL === 'function') {
    return canvas.toDataURL('image/png');
  }
  return '';
}

/**
 * Mengambil representasi Blob (image/png) dari snapshot
 */
export async function getSnapshotBlob(
  sourceCanvasOrImage: any,
  options: SnapshotOptions,
  targetCanvas?: any
): Promise<Blob> {
  const canvas = await captureSnapshot(sourceCanvasOrImage, options, targetCanvas);

  if (typeof canvas.toBlob === 'function') {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Gagal mengonversi kanvas snapshot menjadi Blob'));
        }
      }, 'image/png');
    });
  }

  // Fallback melalui Data URL jika toBlob tidak tersedia
  if (typeof canvas.toDataURL === 'function') {
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1] || '';
    if (typeof Buffer !== 'undefined') {
      const buffer = Buffer.from(base64Data, 'base64');
      return new Blob([buffer], { type: 'image/png' });
    }
    const binStr = atob(base64Data);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = binStr.charCodeAt(i);
    }
    return new Blob([arr], { type: 'image/png' });
  }

  throw new Error('Lingkungan tidak mendukung pembuatan Blob kanvas');
}

/**
 * Menyalin gambar snapshot langsung ke clipboard sistem (Clipboard-First)
 */
export async function copySnapshotToClipboard(
  canvasOrBlob: any,
  clipboardApi?: any
): Promise<{ success: boolean; error?: string; fallbackUrl?: string }> {
  let fallbackUrl: string | undefined;

  try {
    if (canvasOrBlob && typeof canvasOrBlob.toDataURL === 'function') {
      fallbackUrl = canvasOrBlob.toDataURL('image/png');
    }

    let blob: Blob;
    if (canvasOrBlob instanceof Blob) {
      blob = canvasOrBlob;
    } else if (canvasOrBlob && typeof canvasOrBlob.toBlob === 'function') {
      blob = await new Promise<Blob>((resolve, reject) => {
        canvasOrBlob.toBlob((b: Blob | null) => {
          if (b) resolve(b);
          else reject(new Error('Gagal menghasilkan Blob dari kanvas'));
        }, 'image/png');
      });
    } else {
      throw new Error('Objek sumber bukan kanvas atau Blob yang valid');
    }

    const activeClipboard =
      clipboardApi ||
      (typeof navigator !== 'undefined' && 'clipboard' in navigator
        ? navigator.clipboard
        : undefined);

    const hasClipboardItem = typeof ClipboardItem !== 'undefined';

    if (activeClipboard && typeof activeClipboard.write === 'function' && hasClipboardItem) {
      const item = new ClipboardItem({ 'image/png': blob });
      await activeClipboard.write([item]);
      return { success: true };
    }

    throw new Error('Clipboard API tidak didukung atau izin tidak diberikan');
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Gagal menyalin gambar ke clipboard',
      fallbackUrl,
    };
  }
}

export interface SaveSnapshotResult {
  success: boolean;
  filePath?: string;
  error?: string;
  isFallback?: boolean;
}

/**
 * Memeriksa apakah aplikasi berjalan di dalam runtime desktop Tauri
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Membuka dialog pemilih folder native sistem operasi melalui Tauri IPC.
 * Mengembalikan path direktori yang dipilih pengguna, atau null jika dibatalkan atau bukan di lingkungan desktop Tauri.
 */
export async function pickSnapshotDirectory(): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const selectedDir = await invoke<string | null>('pick_snapshot_directory');
      return selectedDir ?? null;
    } catch (err) {
      console.warn('[Snapshot] Gagal membuka dialog pemilih direktori native:', err);
      return null;
    }
  }
  return null;
}

/**
 * Menghasilkan data URL gambar mini (thumbnail) beresolusi rendah (maksimal lebar/tinggi 200px)
 * dari kanvas sumber untuk pratinjau toast, guna menghindari pemblokiran thread utama UI
 * akibat encoding sinkron toDataURL pada kanvas komposit beresolusi penuh (2x HiDPI).
 */
export function createSnapshotThumbnail(
  sourceCanvas: HTMLCanvasElement,
  maxDimension = 200
): string | undefined {
  if (!sourceCanvas || typeof sourceCanvas.width !== 'number' || typeof sourceCanvas.height !== 'number') {
    return undefined;
  }

  const { width, height } = sourceCanvas;
  if (width <= 0 || height <= 0) return undefined;

  let thumbWidth = width;
  let thumbHeight = height;

  if (width > height) {
    if (width > maxDimension) {
      thumbWidth = maxDimension;
      thumbHeight = Math.max(1, Math.round((height / width) * maxDimension));
    }
  } else {
    if (height > maxDimension) {
      thumbHeight = maxDimension;
      thumbWidth = Math.max(1, Math.round((width / height) * maxDimension));
    }
  }

  let canvas: HTMLCanvasElement | FallbackCanvas;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
  } else {
    canvas = createFallbackCanvas(thumbWidth, thumbHeight);
  }

  canvas.width = thumbWidth;
  canvas.height = thumbHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.drawImage(sourceCanvas as CanvasImageSource, 0, 0, thumbWidth, thumbHeight);
  return canvas.toDataURL('image/png');
}

/**
 * Memicu pengunduhan berkas gambar snapshot pada browser / WebView
 */
export function downloadSnapshot(
  canvasOrDataUrl: HTMLCanvasElement | string | { toDataURL: (type?: string) => string },
  filename: string
): string {
  let dataUrl = '';
  if (typeof canvasOrDataUrl === 'string') {
    dataUrl = canvasOrDataUrl;
  } else if (canvasOrDataUrl && typeof canvasOrDataUrl.toDataURL === 'function') {
    dataUrl = canvasOrDataUrl.toDataURL('image/png');
  }

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return dataUrl;
}

/**
 * Menyimpan berkas gambar snapshot ke filesystem lokal (Tauri desktop)
 * dengan direktori kustom atau bawaan, serta fallback ke pengunduhan browser standar.
 */
export async function saveSnapshotToFile(
  canvasOrDataUrl: HTMLCanvasElement | string,
  filename: string,
  customDirectory?: string
): Promise<SaveSnapshotResult> {
  // Jika berjalan di lingkungan desktop Tauri, gunakan Tauri IPC native untuk menyimpan ke folder tujuan
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      let bytes: Uint8Array | null = null;
      let base64Data: string | null = null;

      // Konversi kanvas secara asinkron via toBlob() -> arrayBuffer() -> Uint8Array
      // Menghilangkan blocking toDataURL pada UI thread dan mengirim payload biner mentah ke Tauri
      if (typeof canvasOrDataUrl !== 'string' && typeof canvasOrDataUrl.toBlob === 'function') {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvasOrDataUrl.toBlob(resolve, 'image/png');
        });
        if (blob) {
          const buffer = await blob.arrayBuffer();
          bytes = new Uint8Array(buffer);
        }
      }

      // Fallback base64 jika toBlob tidak tersedia atau input awal adalah data URL string
      if (!bytes) {
        if (typeof canvasOrDataUrl === 'string') {
          base64Data = canvasOrDataUrl;
        } else if (canvasOrDataUrl && typeof canvasOrDataUrl.toDataURL === 'function') {
          base64Data = canvasOrDataUrl.toDataURL('image/png');
        }
      }

      const savedPath = await invoke<string>('save_snapshot_file', {
        directory: customDirectory && customDirectory.trim().length > 0 ? customDirectory.trim() : null,
        filename,
        bytes,
        base64Data,
      });
      return { success: true, filePath: savedPath, isFallback: false };
    } catch (err) {
      console.warn('[Snapshot] Gagal menyimpan via Tauri command, beralih ke download browser:', err);
    }
  }

  // Fallback ke unduhan browser standar (laporkan lokasi Downloads/ secara jujur dengan isFallback: true)
  downloadSnapshot(canvasOrDataUrl, filename);
  return {
    success: true,
    filePath: `Downloads/${filename}`,
    isFallback: true,
  };
}

/**
 * Membuka direktori penyimpanan snapshot di File Manager bawaan sistem operasi
 */
export async function openSnapshotFolder(customDirectory?: string): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_snapshot_folder', {
        directory: customDirectory && customDirectory.trim().length > 0 ? customDirectory.trim() : null,
      });
    } catch (err) {
      console.warn('[Snapshot] Gagal membuka folder penyimpanan:', err);
    }
  }
}

/**
 * Mengambil path folder unduhan bawaan sistem
 */
export async function getDefaultSnapshotDirectory(): Promise<string> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const dir = await invoke<string>('get_default_snapshot_directory');
      if (dir) return dir;
    } catch (err) {
      console.warn('[Snapshot] Gagal mengambil folder default:', err);
    }
  }
  return 'Downloads';
}
