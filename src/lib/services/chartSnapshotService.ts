/**
 * Layanan Kompositor Tangkapan Layar Offline (Offline Branded Snapshot Engine)
 * Membangun komposit kanvas 2D lokal murni dengan Branded Snapshot Frame dan Attribution Bar.
 */

import { formatPriceLabel, type PriceScaleBadge } from './priceScaleLabelService';
import { THEME_PRESETS, type ThemeConfig } from '../constants/themes';
import type {
  SnapshotScaleMultiplier,
  UserProfileConfig,
  CustomChartBackgroundConfig,
  SecurityWatermarkConfig,
  SnapshotThesisLayout
} from '../types/market';
import type { ParsedTradingPlan } from './planParserService';
import { isDarkColor } from '../utils/colorUtils';
import {
  measureThesisOverlayLayout,
  renderThesisOverlayOnCanvas
} from './thesisOverlayEngine';

export type { PriceScaleBadge };

export type {
  SnapshotScaleMultiplier,
  UserProfileConfig,
  CustomChartBackgroundConfig,
  SecurityWatermarkConfig,
  SnapshotThesisLayout
} from '../types/market';

/**
 * Lebar logis default dan jarak pemisah untuk panel samping rencana trading (#132, #133)
 */
export const SNAPSHOT_SIDE_PANEL_WIDTH = 380;
export const SNAPSHOT_SIDE_PANEL_GAP = 16;

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
  customBackground?: CustomChartBackgroundConfig;
  includePrice?: boolean;
  includeTimestamp?: boolean;
  includeBrandUrl?: boolean;
  logoImage?: any;
  avatarImage?: any;
  userProfile?: UserProfileConfig;
  watermark?: Partial<SecurityWatermarkConfig>;
  metadata: SnapshotMetadata;
  // Opsi Tata Letak & Data Rencana Trading (#132, #133, #134)
  thesisLayout?: SnapshotThesisLayout;
  /** Properti kanonikal untuk rencana trading aktif (#132, #133) */
  tradingPlan?: (ParsedTradingPlan & { id?: string }) | null;
  /** @deprecated Gunakan `tradingPlan` sebagai properti kanonikal */
  plan?: (ParsedTradingPlan & { id?: string }) | null;
  activePlans?: Array<ParsedTradingPlan & { id?: string }>;
  sidePanelWidth?: number;
  sidePanelGap?: number;
  themeConfig?: ThemeConfig;
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
  attributionWidth?: number;
  // Dimensi panel samping tesis (jika thesisLayout === 'side-panel' dan rencana aktif ada)
  panelX?: number;
  panelY?: number;
  panelWidth?: number;
  panelHeight?: number;
  panelGap?: number;
}

export interface OverlayRenderContext {
  baseCanvas: HTMLCanvasElement;
  targetCanvas?: HTMLCanvasElement;
  containerWidth: number;
  containerHeight: number;
  drawingPriceBadges: PriceScaleBadge[];
  showDrawingPriceLabels: boolean;
  activePlans: Array<ParsedTradingPlan & { id: string }>;
  showThesisCards: boolean;
  thesisLayout?: SnapshotThesisLayout;
  cardGeometries?: Record<string, { x: number; y: number; width: number; height: number; isWideMode?: boolean }>;
  getPriceY: (price: number) => number | null;
  formatPrice: (price: number | null) => string;
  themeConfig?: ThemeConfig;
}

/**
 * Helper internal untuk menggambar rounded rectangle pada context 2D secara adaptif
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D | any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | { tl?: number; tr?: number; br?: number; bl?: number }
): void {
  const radius = typeof r === 'number'
    ? { tl: r, tr: r, br: r, bl: r }
    : { tl: r.tl || 0, tr: r.tr || 0, br: r.br || 0, bl: r.bl || 0 };

  if (typeof ctx.roundRect === 'function' && typeof r === 'number') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }

  if (typeof ctx.arcTo === 'function') {
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + w - radius.tr, y);
    ctx.arcTo(x + w, y, x + w, y + radius.tr, radius.tr);
    ctx.lineTo(x + w, y + h - radius.br);
    ctx.arcTo(x + w, y + h, x + w - radius.br, y + h, radius.br);
    ctx.lineTo(x + radius.bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius.bl, radius.bl);
    // Sisi kiri naik ke titik awal kurva sudut kiri-atas
    ctx.lineTo(x, y + radius.tl);
    ctx.arcTo(x, y, x + radius.tl, y, radius.tl);
    ctx.closePath();
    return;
  }

  if (typeof ctx.quadraticCurveTo === 'function') {
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + w - radius.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius.tr);
    ctx.lineTo(x + w, y + h - radius.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h);
    ctx.lineTo(x + radius.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius.bl);
    // Sisi kiri naik ke titik awal kurva sudut kiri-atas
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    return;
  }

  if (typeof ctx.rect === 'function') {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.closePath();
  }
}

/**
 * Merender Price Scale Badges di sumbu harga kanan kanvas snapshot
 */
export function drawPriceScaleBadgesOnCanvas(
  ctx: CanvasRenderingContext2D | any,
  badges: PriceScaleBadge[],
  scaleX: number,
  scaleY: number,
  canvasWidth: number,
  getPriceY: (price: number) => number | null,
  formatPrice: (price: number | null) => string
): void {
  if (!badges || badges.length === 0) return;

  const fontSize = Math.max(10, Math.round(9 * scaleY));
  ctx.save();
  ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace, sans-serif`;
  ctx.textBaseline = 'middle';

  for (const badge of badges) {
    const yPos = getPriceY(badge.price);
    if (yPos === null || isNaN(yPos)) continue;

    const canvasY = Math.round(yPos * scaleY);
    const priceText = badge.label || formatPrice(badge.price);
    const fullText = badge.title ? `${badge.title} ${priceText}` : priceText;

    const textWidth = ctx.measureText ? ctx.measureText(fullText).width : fullText.length * 7 * scaleX;
    const badgeHeight = Math.round(18 * scaleY);
    const badgeWidth = Math.round(textWidth + 14 * scaleX);
    const badgeX = canvasWidth - badgeWidth;
    const badgeY = Math.round(canvasY - badgeHeight / 2);

    // Background Badge dengan sisi kiri melengkung
    ctx.save();
    ctx.fillStyle = badge.bgColor || badge.color || '#3b82f6';
    drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, { tl: 4 * scaleX, bl: 4 * scaleX, tr: 0, br: 0 });
    ctx.fill();

    // Border halus
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = Math.max(1, 1 * scaleX);
    ctx.stroke();

    // Teks putih kontras
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(fullText, badgeX + 6 * scaleX, canvasY);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Merender Floating Thesis Card di kanvas snapshot dengan fidelitas visual penuh
 * dan mengadopsi token tema aktif melalui deep module `thesisOverlayEngine`.
 */
export function drawThesisCardOnCanvas(
  ctx: CanvasRenderingContext2D | any,
  plan: ParsedTradingPlan & { id: string },
  scaleX: number,
  scaleY: number,
  formatPrice: (price: number | null) => string,
  posX: number = 16,
  posY: number = 56,
  cardWidth: number = 340,
  cardHeight?: number,
  isWideMode: boolean = false,
  themeConfig?: ThemeConfig
): void {
  renderThesisOverlayOnCanvas(ctx, plan, {
    variant: 'floating-card',
    x: posX,
    y: posY,
    width: cardWidth,
    height: cardHeight,
    scaleX,
    scaleY,
    coordsAreScaled: false,
    isWideMode,
    themeConfig,
    formatPrice: (p) => formatPrice(p ?? null),
    measureCtx: ctx
  });
}

/**
 * Alias penamaan drawThesisCardOnCanvas untuk konsistensi API snapshot overlay
 */
export const drawSnapshotThesisCard = drawThesisCardOnCanvas;

/**
 * Menghasilkan kanvas tangkapan layar yang memadukan grafik lilin dasar dengan seluruh overlay visual
 */
export function renderScreenshotCanvasWithOverlay(context: OverlayRenderContext): HTMLCanvasElement {
  const {
    baseCanvas,
    targetCanvas,
    containerWidth,
    containerHeight,
    drawingPriceBadges,
    showDrawingPriceLabels,
    activePlans,
    showThesisCards,
    thesisLayout = 'overlay',
    getPriceY,
    formatPrice
  } = context;

  let finalCanvas = targetCanvas;
  if (!finalCanvas) {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      finalCanvas = document.createElement('canvas');
    } else {
      return baseCanvas;
    }
  }

  finalCanvas.width = baseCanvas.width;
  finalCanvas.height = baseCanvas.height;

  const ctx = finalCanvas.getContext('2d');
  if (!ctx) return baseCanvas;

  // 1. Gambar grafik lilin asli
  ctx.drawImage(baseCanvas, 0, 0);

  const scaleX = finalCanvas.width / Math.max(1, containerWidth);
  const scaleY = finalCanvas.height / Math.max(1, containerHeight);

  // 2. Gambar Price Scale Badges di Sumbu Kanan
  if (showDrawingPriceLabels && Array.isArray(drawingPriceBadges) && drawingPriceBadges.length > 0) {
    drawPriceScaleBadgesOnCanvas(ctx, drawingPriceBadges, scaleX, scaleY, finalCanvas.width, getPriceY, formatPrice);
  }

  // 3. Gambar Floating Thesis Card jika aktif dan bukan tata letak side-panel atau hidden
  const shouldDrawThesisCard =
    thesisLayout !== 'side-panel' &&
    thesisLayout !== 'hidden' &&
    showThesisCards &&
    Array.isArray(activePlans) &&
    activePlans.length > 0;

  if (shouldDrawThesisCard) {
    for (let i = 0; i < activePlans.length; i++) {
      const plan = activePlans[i];
      const geo = context.cardGeometries?.[plan.id];
      const posX = geo?.x ?? (16 + i * 24);
      const posY = geo?.y ?? (56 + i * 24);
      const cardWidth = geo?.width ?? 340;
      const cardHeight = geo?.height;
      const isWideMode = geo?.isWideMode ?? (cardWidth >= 520);

      drawThesisCardOnCanvas(
        ctx,
        plan,
        scaleX,
        scaleY,
        formatPrice,
        posX,
        posY,
        cardWidth,
        cardHeight,
        isWideMode,
        context.themeConfig
      );
    }
  }

  return finalCanvas;
}

/**
 * Cache memori lokal untuk citra logo resmi aplikasi
 */
let cachedLogoImage: any = null;

/**
 * Cache memori lokal untuk citra avatar trader
 */
let cachedAvatarDataUrl: string | null = null;
let cachedAvatarImage: any = null;

/**
 * Menyimpan referensi citra avatar ke dalam cache memori.
 */
export function setCachedAvatar(dataUrl: string | null, image: any): void {
  cachedAvatarDataUrl = dataUrl;
  cachedAvatarImage = image;
}

/**
 * Membersihkan citra avatar dari cache memori.
 */
export function clearCachedAvatar(): void {
  cachedAvatarDataUrl = null;
  cachedAvatarImage = null;
}

/**
 * Mengambil citra avatar yang telah dimuat dari cache memori secara sinkron.
 */
export function getCachedAvatar(dataUrl?: string): any {
  if (!dataUrl) return null;
  if (dataUrl === cachedAvatarDataUrl && cachedAvatarImage) {
    return cachedAvatarImage;
  }
  return null;
}

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
 * Memuat citra avatar pengguna dari data URL (base64) secara asinkron dengan caching otomatis (#126).
 */
export async function loadAvatarImage(dataUrl: string): Promise<any> {
  if (typeof Image === 'undefined' || !dataUrl) {
    return null;
  }
  if (dataUrl === cachedAvatarDataUrl && cachedAvatarImage) {
    return cachedAvatarImage;
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        cachedAvatarDataUrl = dataUrl;
        cachedAvatarImage = img;
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Preload citra avatar ke memori cache untuk digunakan sinkron oleh compositeSnapshot.
 */
export async function preloadAvatarImage(dataUrl?: string): Promise<any> {
  if (!dataUrl) {
    clearCachedAvatar();
    return null;
  }
  return loadAvatarImage(dataUrl);
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
 * Menghitung tinggi logis yang dibutuhkan oleh panel samping narasi tesis (Side Panel)
 * menggunakan Pass 1 (`measureThesisOverlayLayout`) dari `thesisOverlayEngine` sehingga
 * dijamin 0px drift terhadap hasil gambar aktual (#132, #133).
 */
export function calculateThesisPanelHeight(
  plan: ParsedTradingPlan | null | undefined,
  panelWidth: number = SNAPSHOT_SIDE_PANEL_WIDTH
): number {
  if (!plan) return 0;
  const layout = measureThesisOverlayLayout(plan, {
    variant: 'side-panel',
    x: 0,
    y: 0,
    width: panelWidth,
    scaleX: 1,
    scaleY: 1,
    coordsAreScaled: true
  });
  return Math.ceil(layout.outerBox.h);
}

/**
 * Menghitung dimensi presisi untuk komposit snapshot kartu maupun ekspor clean.
 * Mendukung tata letak berdampingan (Side-by-Side) dengan panel samping mandiri 380px (#132, #133).
 */
export function calculateCompositeDimensions(
  sourceWidth: number,
  sourceHeight: number,
  options: SnapshotOptions
): CompositeDimensions {
  const mode = options.mode ?? 'branded';
  const scale = resolveEffectiveScale(options);
  const padding = options.padding ?? 24;

  // Evaluasi apakah tata letak side-panel aktif dan memiliki rencana trading aktif.
  // Sesuai kesepakatan Spec #132 / Q10, activePlans[0] berfungsi sebagai rencana trading aktif utama
  // (primary active trading plan) untuk panel samping jika terdapat beberapa rencana aktif.
  const isSidePanel = options.thesisLayout === 'side-panel';
  const activePlan =
    options.tradingPlan ??
    options.plan ??
    (Array.isArray(options.activePlans) && options.activePlans.length > 0 ? options.activePlans[0] : null);
  const hasActivePlan = Boolean(activePlan);

  if (isSidePanel && hasActivePlan) {
    const panelWidthLogical = options.sidePanelWidth ?? SNAPSHOT_SIDE_PANEL_WIDTH;
    const panelGapLogical = options.sidePanelGap ?? SNAPSHOT_SIDE_PANEL_GAP;
    const requiredPanelH = calculateThesisPanelHeight(activePlan, panelWidthLogical);
    const contentHeightLogical = Math.max(sourceHeight, requiredPanelH);

    const scaledPanelW = Math.round(panelWidthLogical * scale);
    const scaledPanelGap = Math.round(panelGapLogical * scale);
    const scaledChartW = Math.round(sourceWidth * scale);
    const scaledChartH = Math.round(sourceHeight * scale);
    const scaledPanelH = Math.round(contentHeightLogical * scale);

    if (mode === 'clean') {
      const totalLogicalWidth = sourceWidth + panelGapLogical + panelWidthLogical;
      const totalLogicalHeight = contentHeightLogical;

      return {
        width: Math.round(totalLogicalWidth * scale),
        height: Math.round(totalLogicalHeight * scale),
        chartX: 0,
        chartY: 0,
        chartWidth: scaledChartW,
        chartHeight: scaledChartH,
        panelX: Math.round((sourceWidth + panelGapLogical) * scale),
        panelY: 0,
        panelWidth: scaledPanelW,
        panelHeight: scaledPanelH,
        panelGap: scaledPanelGap,
        attributionY: 0,
        attributionHeight: 0,
        attributionWidth: 0,
      };
    }

    // Mode branded dengan bingkai luar dan attribution bar terpadu
    const attributionHeightLogical = 60;
    const totalLogicalWidth = sourceWidth + panelGapLogical + panelWidthLogical + padding * 2;
    const totalLogicalHeight = contentHeightLogical + padding * 2 + attributionHeightLogical;

    return {
      width: Math.round(totalLogicalWidth * scale),
      height: Math.round(totalLogicalHeight * scale),
      chartX: Math.round(padding * scale),
      chartY: Math.round(padding * scale),
      chartWidth: scaledChartW,
      chartHeight: scaledChartH,
      panelX: Math.round((padding + sourceWidth + panelGapLogical) * scale),
      panelY: Math.round(padding * scale),
      panelWidth: scaledPanelW,
      panelHeight: scaledPanelH,
      panelGap: scaledPanelGap,
      attributionY: Math.round((padding + contentHeightLogical) * scale),
      attributionHeight: Math.round(attributionHeightLogical * scale),
      attributionWidth: Math.round((totalLogicalWidth - padding * 2) * scale),
    };
  }

  // Fallback anggun ke dimensi standar grafik tunggal (single-chart)
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
      attributionWidth: w,
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
    attributionWidth: Math.round(sourceWidth * scale),
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
 * Merender panel samping rencana trading (Dedicated Thesis Side Panel) ke dalam kanvas 2D (#132, #134)
 * melalui deep module `thesisOverlayEngine` dengan paritas penuh (Dual-Entry E1/E2 + bobot %, Setup Status,
 * Confluence Score, lencana epistemik berwarna, sub-badge R-multiple E1, dan token tema adaptif ADR-0019).
 */
export function renderDedicatedThesisSidePanel(
  ctx: any,
  plan: ParsedTradingPlan & { id?: string },
  x: number,
  y: number,
  width: number,
  height: number,
  scale = 1,
  themeConfig?: ThemeConfig
): void {
  renderThesisOverlayOnCanvas(ctx, plan, {
    variant: 'side-panel',
    x,
    y,
    width,
    height,
    scaleX: scale,
    scaleY: scale,
    coordsAreScaled: true,
    themeConfig,
    measureCtx: ctx
  });
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
      strokeText: () => {},
      drawImage: () => {},
      measureText: (text: string) => ({ width: text.length * 8 }),
      translate: () => {},
      rotate: () => {},
      setLineDash: () => {},
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
  watermark?: Partial<SecurityWatermarkConfig> | null,
  profile?: UserProfileConfig | null
): string {
  const customText = watermark?.text?.trim();
  if (customText) {
    return customText;
  }
  const username = profile?.username?.trim();
  const handle = profile?.handle?.trim();
  const bio = profile?.bio?.trim();

  const parts: string[] = [];
  if (username) parts.push(username);
  if (handle) parts.push(handle.startsWith('@') ? handle : `@${handle}`);
  if (bio && parts.length === 0) parts.push(bio);

  if (parts.length > 0) {
    return parts.join(' · ');
  }
  return 'TRAWANGAN';
}

export interface WatermarkColors {
  fill: string;
  stroke: string;
}

export interface AttributionBarColors {
  textPrimary: string;
  textSecondary: string;
  textHandle: string;
  textBio: string;
  textUrl: string;
  textTimestamp: string;
  dotSeparator: string;
  outerBorder: string;
  chartBorder: string;
  isDark: boolean;
}

/**
 * Menyelesaikan warna teks tanda air keamanan (Security Watermark) secara adaptif
 * berdasarkan tingkat kecerahan (luminance) kanvas latar belakang (#147).
 * - Latar Gelap: teks putih cerah (rgba(255, 255, 255, 0.9)) dengan stroke bayangan gelap (rgba(0, 0, 0, 0.5))
 * - Latar Terang: teks kontras gelap (rgba(20, 20, 20, 0.85)) dengan stroke terang (rgba(255, 255, 255, 0.6))
 */
export function resolveWatermarkColors(backgroundHex?: string): WatermarkColors {
  const isDark = isDarkColor(backgroundHex || '#0F0F0F');
  if (isDark) {
    return {
      fill: 'rgba(255, 255, 255, 0.9)',
      stroke: 'rgba(0, 0, 0, 0.5)'
    };
  }
  return {
    fill: 'rgba(20, 20, 20, 0.85)',
    stroke: 'rgba(255, 255, 255, 0.6)'
  };
}

/**
 * Menyelesaikan warna elemen teks, label, dan garis pada Attribution Bar bawah
 * secara adaptif berdasarkan tingkat kecerahan latar belakang bingkai/chart (#144, #147).
 * - Latar Gelap: teks putih cerah dan abu-abu terang standar.
 * - Latar Terang: teks kontras gelap (mengadopsi token tema atau abu-abu/hitam pekat) agar tidak pudar di atas kanvas terang.
 */
export function resolveAttributionBarColors(
  frameBg?: string,
  themeConfig?: ThemeConfig
): AttributionBarColors {
  const isDark = isDarkColor(frameBg || '#0F0F0F');
  const tokens = themeConfig?.tokens;

  if (isDark) {
    return {
      textPrimary: '#FFFFFF',
      textSecondary: '#B0B0B0',
      textHandle: '#9E9E9E',
      textBio: '#7E8B9B',
      textUrl: '#6E6E6E',
      textTimestamp: '#9E9E9E',
      dotSeparator: 'rgba(255, 255, 255, 0.25)',
      outerBorder: 'rgba(255, 255, 255, 0.08)',
      chartBorder: 'rgba(255, 255, 255, 0.06)',
      isDark: true,
    };
  }

  // Latar bingkai terang (seperti tema Warta Abang #EAEAE5 atau custom light background)
  return {
    textPrimary: tokens?.textMain || '#1A1A1A',
    textSecondary: tokens?.textMuted || '#4A4A4A',
    textHandle: tokens?.textMuted || '#5A5A5A',
    textBio: tokens?.textMuted || '#6E6E6E',
    textUrl: tokens?.textMuted || '#757575',
    textTimestamp: tokens?.textMuted || '#5A5A5A',
    dotSeparator: 'rgba(0, 0, 0, 0.25)',
    outerBorder: tokens?.borderHairline || 'rgba(0, 0, 0, 0.12)',
    chartBorder: tokens?.borderSubtle || 'rgba(0, 0, 0, 0.08)',
    isDark: false,
  };
}

/**
 * Merender tanda air keamanan semi-transparan diagonal pada kanvas grafik (#127, #147)
 * Memosisikan teks di tengah area grafik dengan sudut rotasi diagonal -30° s.d. -35°
 * serta opasitas dan warna adaptif berdasarkan tingkat kecerahan latar belakang.
 */
export function drawSecurityWatermark(
  ctx: any,
  dim: CompositeDimensions,
  watermark?: Partial<SecurityWatermarkConfig>,
  profile?: UserProfileConfig,
  scale = 1,
  backgroundColor?: string
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

  // Selesaikan warna adaptif berdasarkan luminansi latar belakang (#147)
  const watermarkColors = resolveWatermarkColors(backgroundColor);

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

  // Render teks utama dengan font tebal dan warna adaptif
  ctx.font = `800 ${fontSize}px "JetBrains Mono", "Plus Jakarta Sans", monospace, sans-serif`;
  ctx.fillStyle = watermarkColors.fill;
  ctx.fillText(text, 0, 0);

  // Garis tepi tipis agar tanda air tetap kontras pada ragam tema dan latar belakang
  ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
  ctx.strokeStyle = watermarkColors.stroke;
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

  // Evaluasi side panel & active plan (#132, #133, #134).
  // Sesuai kesepakatan Spec #132 / Q10, activePlans[0] berfungsi sebagai rencana trading aktif utama
  // (primary active trading plan) untuk panel samping jika terdapat beberapa rencana aktif.
  const isSidePanel = options.thesisLayout === 'side-panel';
  const activePlan =
    options.tradingPlan ??
    options.plan ??
    (Array.isArray(options.activePlans) && options.activePlans.length > 0 ? options.activePlans[0] : null);
  const hasActivePlan = Boolean(activePlan);
  const isSidePanelActive = isSidePanel && hasActivePlan;

  const activeTheme = options.themeConfig || THEME_PRESETS.signature;
  const themeTokens = activeTheme.tokens;

  // Jika mode clean, render murni raster grafik dan panel tesis berdampingan tanpa bingkai luar atau attribution bar
  const customBg = options.customBackground;
  const isCustomSolid = customBg?.mode === 'solid' && Boolean(customBg.solidColor);
  const isCustomGradient =
    customBg?.mode === 'gradient' && Boolean(customBg.gradientTop || customBg.gradientBottom);

  const effectiveChartBg = isCustomSolid
    ? customBg!.solidColor!
    : isCustomGradient
      ? (customBg!.gradientTop || '#0F0F0F')
      : (options.backgroundColor || themeTokens.bgDarkest || '#0F0F0F');

  if (mode === 'clean') {
    if (isCustomSolid) {
      ctx.fillStyle = customBg!.solidColor!;
      ctx.fillRect(0, 0, dim.width, dim.height);
    } else if (isCustomGradient) {
      const grad = ctx.createLinearGradient(0, 0, 0, dim.height);
      grad.addColorStop(0, customBg!.gradientTop || '#0F0F0F');
      grad.addColorStop(1, customBg!.gradientBottom || '#181A20');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, dim.width, dim.height);
    } else if (isSidePanelActive) {
      ctx.fillStyle = options.backgroundColor || themeTokens.bgDarkest || '#0F0F0F';
      ctx.fillRect(0, 0, dim.width, dim.height);
    }

    // Chart digambar di (dim.chartX, dim.chartY, dim.chartWidth, dim.chartHeight)
    // Menjaga rasio 1:1 top-aligned tanpa distorsi vertikal
    ctx.drawImage(sourceCanvasOrImage, dim.chartX, dim.chartY, dim.chartWidth, dim.chartHeight);
    
    // Tanda air keamanan strictly bounded/clipped ke area kanvas grafik di sisi kiri
    drawSecurityWatermark(ctx, dim, options.watermark, options.userProfile, scale, effectiveChartBg);

    // Render panel samping tesis jika aktif berdampingan
    if (isSidePanelActive && activePlan && dim.panelX !== undefined && dim.panelWidth !== undefined) {
      renderDedicatedThesisSidePanel(
        ctx,
        activePlan,
        dim.panelX,
        dim.panelY ?? 0,
        dim.panelWidth,
        dim.panelHeight ?? dim.height,
        scale,
        options.themeConfig
      );
    }

    return canvas;
  }

  // --- 1. Container Background & Outer Border ---
  const frameBg = options.backgroundColor || themeTokens.bgDarkest || '#0F0F0F';
  const attrColors = resolveAttributionBarColors(frameBg, options.themeConfig);

  ctx.save();
  drawRoundedRect(ctx, 0, 0, dim.width, dim.height, 12 * scale);
  ctx.fillStyle = frameBg;
  ctx.fill();

  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.strokeStyle = attrColors.outerBorder;
  ctx.stroke();
  ctx.restore();

  // --- 2. Chart Rendering dengan Rounded Corners & Inner Border ---
  ctx.save();
  drawRoundedRect(ctx, dim.chartX, dim.chartY, dim.chartWidth, dim.chartHeight, 8 * scale);
  if (isCustomSolid) {
    ctx.fillStyle = customBg!.solidColor!;
  } else if (isCustomGradient) {
    const chartGrad = ctx.createLinearGradient(0, dim.chartY, 0, dim.chartY + dim.chartHeight);
    chartGrad.addColorStop(0, customBg!.gradientTop || '#0F0F0F');
    chartGrad.addColorStop(1, customBg!.gradientBottom || '#181A20');
    ctx.fillStyle = chartGrad;
  } else {
    ctx.fillStyle = frameBg;
  }
  ctx.fill();
  ctx.clip();

  // 2a. Gambar Candlestick & Grid Grafik terlebih dahulu
  ctx.drawImage(sourceCanvasOrImage, dim.chartX, dim.chartY, dim.chartWidth, dim.chartHeight);

  // 2b. Tanda Air Keamanan Anti-Pencurian semi-transparan DI ATAS grafik (#127)
  // Menjaga agar watermark profil tidak tertutup/terhapus oleh kanvas grafik Vela yang opaque
  drawSecurityWatermark(ctx, dim, options.watermark, options.userProfile, scale, effectiveChartBg);
  ctx.restore();

  // Garis batas redup di sekeliling area chart
  ctx.save();
  drawRoundedRect(ctx, dim.chartX, dim.chartY, dim.chartWidth, dim.chartHeight, 8 * scale);
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.strokeStyle = attrColors.chartBorder;
  ctx.stroke();
  ctx.restore();

  // --- 2c. Dedicated Thesis Side Panel (jika side-panel aktif) (#132, #134) ---
  if (isSidePanelActive && activePlan && dim.panelX !== undefined && dim.panelWidth !== undefined) {
    renderDedicatedThesisSidePanel(
      ctx,
      activePlan,
      dim.panelX,
      dim.panelY ?? dim.chartY,
      dim.panelWidth,
      dim.panelHeight ?? dim.chartHeight,
      scale,
      options.themeConfig
    );
  }

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
  const rawHandle = profile?.handle?.trim() || '';
  const bio = profile?.bio?.trim() || '';
  const avatarDataUrl = profile?.avatarDataUrl;
  const hasPersonalIdentity = Boolean(username || rawHandle || bio || avatarDataUrl);

  if (hasPersonalIdentity) {
    // 3b-1. Avatar Pengguna (Citra Bulat dengan Kliping Lingkaran atau Lingkaran Aksen Inisial Huruf Pertama)
    const avatarSize = Math.round(22 * scale);
    const avatarRadius = avatarSize / 2;
    const avatarCenterX = currentX + avatarRadius;
    const avatarCenterY = centerY;

    const avatarImg = options.avatarImage || getCachedAvatar(avatarDataUrl);
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
        renderAvatarInitialBadge(ctx, avatarCenterX, avatarCenterY, avatarRadius, username || rawHandle || 'T', scale);
      }
      ctx.restore();
    } else {
      renderAvatarInitialBadge(ctx, avatarCenterX, avatarCenterY, avatarRadius, username || rawHandle || 'T', scale);
      if (avatarDataUrl && typeof Image !== 'undefined') {
        preloadAvatarImage(avatarDataUrl).catch(() => {});
      }
    }

    currentX += avatarSize + Math.round(8 * scale);

    // 3b-2. Teks Nama Pengguna (Username)
    const displayName = username || (rawHandle ? (rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`) : 'Trader');
    ctx.font = `bold ${Math.round(14 * scale)}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    ctx.fillStyle = attrColors.textPrimary;
    ctx.textAlign = 'left';
    ctx.fillText(displayName, currentX, centerY);

    const usernameWidth = ctx.measureText ? ctx.measureText(displayName).width : displayName.length * 8 * scale;
    currentX += usernameWidth;

    // 3b-3. Social Handle (@handle) jika terisi
    if (username && rawHandle) {
      const formattedHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
      currentX += Math.round(6 * scale);
      ctx.font = `400 ${Math.round(12 * scale)}px "JetBrains Mono", monospace, sans-serif`;
      ctx.fillStyle = attrColors.textHandle;
      ctx.textAlign = 'left';
      ctx.fillText(formattedHandle, currentX, centerY);

      const handleWidth = ctx.measureText ? ctx.measureText(formattedHandle).width : formattedHandle.length * 7 * scale;
      currentX += handleWidth;
    }

    // 3b-4. Bio / Deskripsi Singkat jika terisi (#126)
    if (bio) {
      currentX += Math.round(8 * scale);
      ctx.font = `italic 400 ${Math.round(11 * scale)}px "Plus Jakarta Sans", -apple-system, sans-serif`;
      ctx.fillStyle = attrColors.textBio;
      ctx.textAlign = 'left';
      const bioText = `(${bio})`;
      ctx.fillText(bioText, currentX, centerY);
      const bioWidth = ctx.measureText ? ctx.measureText(bioText).width : bioText.length * 6 * scale;
      currentX += bioWidth;
    }

    // 3c. Pemisah Titik Redup
    currentX += Math.round(12 * scale);
    ctx.font = `${Math.round(12 * scale)}px sans-serif`;
    ctx.fillStyle = attrColors.dotSeparator;
    ctx.fillText('·', currentX, centerY);
    currentX += Math.round(12 * scale);
  } else {
    // 3b-alt. Teks Brand 'trawangan' Bawaan
    ctx.font = `bold ${Math.round(15 * scale)}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    ctx.fillStyle = attrColors.textPrimary;
    ctx.textAlign = 'left';
    ctx.fillText('trawangan', currentX, centerY);

    const brandWidth = ctx.measureText ? ctx.measureText('trawangan').width : 70 * scale;
    currentX += brandWidth + Math.round(12 * scale);

    // 3c. Pemisah Titik Redup
    ctx.font = `${Math.round(12 * scale)}px sans-serif`;
    ctx.fillStyle = attrColors.dotSeparator;
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
  ctx.fillStyle = attrColors.textSecondary;
  ctx.fillText(instrumentText, currentX, centerY);

  ctx.restore();

  // SISI KANAN: Harga Terakhir, Waktu Lokal, & URL Website
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  // Attribution bar membentang selebar total komposit (chart + side panel)
  let rightX = dim.panelX && dim.panelWidth ? dim.panelX + dim.panelWidth : dim.chartX + dim.chartWidth;

  // 3e. URL Terminal Website
  if (options.includeBrandUrl !== false) {
    const brandUrl = 'kaleksananbarqi.github.io/trawangan';
    ctx.font = `400 ${Math.round(11 * scale)}px "JetBrains Mono", monospace, sans-serif`;
    ctx.fillStyle = attrColors.textUrl;
    ctx.fillText(brandUrl, rightX, centerY);

    const urlWidth = ctx.measureText ? ctx.measureText(brandUrl).width : 160 * scale;
    rightX -= urlWidth + Math.round(16 * scale);
  }

  // 3f. Waktu Lokal Pengguna
  if (options.includeTimestamp !== false) {
    const timestampText = formatSnapshotTimestamp(meta.timestamp, meta.timezone);
    ctx.font = `400 ${Math.round(12 * scale)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = attrColors.textTimestamp;
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
    ctx.fillStyle = attrColors.textPrimary;
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
      options.logoImage = await loadOfficialLogo();
    } catch {
      // Abaikan jika pemuatan citra gagal, fallback badge akan digunakan
    }
  }
  if (options.userProfile?.avatarDataUrl && !options.avatarImage && typeof Image !== 'undefined') {
    try {
      options.avatarImage = await preloadAvatarImage(options.userProfile.avatarDataUrl);
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
