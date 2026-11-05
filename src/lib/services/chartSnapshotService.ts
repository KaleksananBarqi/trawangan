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
import { formatPlanPrice, inferZonePolarity, type ParsedTradingPlan } from './planParserService';
import { deriveSurfaceColor, ensureReadableTextColor, isDarkColor } from '../utils/colorUtils';

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
 * Mengonversi warna format hex (#RGB, #RRGGBB) atau rgb/rgba ke string rgba(r, g, b, a)
 */
function colorToRgba(color: string, alpha: number): string {
  if (!color) return `rgba(23, 23, 23, ${alpha})`;
  if (color.startsWith('rgba(')) {
    return color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3, ${alpha})`);
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  if (color.startsWith('#')) {
    const hex = color.replace('#', '').trim();
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/**
 * Helper internal untuk memecah teks menjadi baris-baris alami berdasarkan lebar maksimum kanvas (Text Wrapping)
 */
function wrapCanvasText(ctx: CanvasRenderingContext2D | any, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const clean = text.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/_/g, '').trim();
  if (!clean) return [];

  const paragraphs = clean.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    const words = trimmedPara.split(/\s+/);
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText ? ctx.measureText(testLine).width : testLine.length * 7;
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  return lines;
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
 * Menggambar titik pegangan seret (Grip Dots) pada header kartu mengambang
 */
function drawGripDots(ctx: CanvasRenderingContext2D | any, x: number, y: number, scaleX: number, scaleY: number, color: string = '#64748b'): void {
  ctx.save();
  ctx.fillStyle = color;
  const dotR = Math.max(1, 1.2 * scaleX);
  const stepX = Math.round(4 * scaleX);
  const stepY = Math.round(4 * scaleY);

  for (let col = 0; col < 2; col++) {
    for (let row = -1; row <= 1; row++) {
      ctx.beginPath();
      if (typeof ctx.arc === 'function') {
        ctx.arc(x + col * stepX, y + row * stepY, dotR, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  ctx.restore();
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
 * dan mengadopsi token tema aktif.
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
  const scaledX = Math.round(posX * scaleX);
  const scaledY = Math.round(posY * scaleY);
  const scaledW = Math.round(cardWidth * scaleX);

  const activeTheme = themeConfig || THEME_PRESETS.signature;
  const tokens = activeTheme.tokens;
  const chartTokens = activeTheme.chart;

  const chartBg = chartTokens.background || tokens.bgDarkest || '#0F0F0F';
  const isDarkChart = isDarkColor(chartBg);
  const candidateSurface = tokens.bgSecondary || tokens.bgContainer || '#161616';
  const safeSurface = isDarkColor(candidateSurface) === isDarkChart
    ? candidateSurface
    : deriveSurfaceColor(chartBg, 0.07);
  const cardBgColor = colorToRgba(safeSurface, 0.94);
  const borderSubtle = tokens.borderSubtle || '#222222';
  const textPrimary = ensureReadableTextColor(safeSurface, tokens.textPrimary || tokens.textMain || '#F7F7F7');
  const textMuted = tokens.textMuted && isDarkColor(tokens.textMuted) !== isDarkChart
    ? tokens.textMuted
    : colorToRgba(textPrimary, 0.68);

  const isBearish = plan.bias === 'bearish';
  const bullColor = tokens.bullColor || chartTokens.upColor || '#F7F7F7';
  const bearColor = tokens.bearColor || chartTokens.downColor || '#FF69B4';
  const biasBadgeColor = isBearish ? bearColor : bullColor;
  const brandCyan = tokens.brandCyan || '#38bdf8';

  ctx.save();

  const padX = Math.round(12 * scaleX);
  const contentLeft = scaledX + padX;
  const contentW = scaledW - padX * 2;
  const headerH = Math.round(28 * scaleY);

  const bodyFontSize = Math.max(9, Math.round(9 * scaleY));
  const subFontSize = Math.max(8, Math.round(8.5 * scaleY));
  const bodyLineHeight = Math.round(13 * scaleY);

  ctx.font = `${bodyFontSize}px sans-serif`;

  const entryReasonLines = plan.reasons?.entry ? wrapCanvasText(ctx, plan.reasons.entry, contentW) : [];
  const slReasonLines = plan.reasons?.stopLoss ? wrapCanvasText(ctx, plan.reasons.stopLoss, contentW) : [];
  const invScenarioLines = plan.conclusion?.invalidationScenario ? wrapCanvasText(ctx, plan.conclusion.invalidationScenario, contentW - Math.round(16 * scaleX)) : [];
  const probNotesLines = plan.conclusion?.probabilityNotes ? wrapCanvasText(ctx, plan.conclusion.probabilityNotes, contentW) : [];

  const targetReasonLinesMap: Record<number, string[]> = {};
  if (Array.isArray(plan.targets)) {
    for (let i = 0; i < plan.targets.length; i++) {
      const reason = plan.reasons?.[`tp${i + 1}`] || plan.targets[i].reason;
      if (reason) {
        targetReasonLinesMap[i] = wrapCanvasText(ctx, reason, contentW - Math.round(16 * scaleX));
      }
    }
  }

  let requiredContentH = Math.round(16 * scaleY);

  if (plan.definition) {
    const defLines = wrapCanvasText(ctx, plan.definition, contentW - Math.round(14 * scaleX));
    requiredContentH += (defLines.length * bodyLineHeight + Math.round(12 * scaleY));
  }

  requiredContentH += Math.round(18 * scaleY);
  if (plan.contextZones && plan.contextZones.length > 0) {
    requiredContentH += Math.round(20 * scaleY);
  }
  if (entryReasonLines.length > 0) {
    requiredContentH += (entryReasonLines.length * bodyLineHeight + Math.round(8 * scaleY));
  }

  requiredContentH += Math.round(22 * scaleY);
  if (slReasonLines.length > 0) {
    requiredContentH += (slReasonLines.length * bodyLineHeight + Math.round(6 * scaleY));
  }
  if (invScenarioLines.length > 0) {
    requiredContentH += (invScenarioLines.length * bodyLineHeight + Math.round(22 * scaleY));
  }

  if (Array.isArray(plan.targets) && plan.targets.length > 0) {
    requiredContentH += Math.round(20 * scaleY);
    for (let i = 0; i < plan.targets.length; i++) {
      requiredContentH += Math.round(20 * scaleY);
      const tLines = targetReasonLinesMap[i];
      if (tLines && tLines.length > 0) {
        requiredContentH += (tLines.length * bodyLineHeight + Math.round(6 * scaleY));
      }
    }
  }

  if (plan.riskAmount || probNotesLines.length > 0) {
    requiredContentH += Math.round(16 * scaleY);
    if (probNotesLines.length > 0) {
      requiredContentH += (probNotesLines.length * bodyLineHeight + Math.round(6 * scaleY));
    }
  }

  const calculatedTotalH = headerH + requiredContentH + Math.round(14 * scaleY);
  const finalCardH = typeof cardHeight === 'number' && cardHeight * scaleY > calculatedTotalH
    ? Math.round(cardHeight * scaleY)
    : calculatedTotalH;

  // 1. Background Glassmorphism
  drawRoundedRect(ctx, scaledX, scaledY, scaledW, finalCardH, 10 * scaleX);
  ctx.fillStyle = cardBgColor;
  ctx.fill();

  ctx.strokeStyle = borderSubtle;
  ctx.lineWidth = Math.max(1, Math.round(1.5 * scaleX));
  ctx.stroke();

  // 2. Header Banner
  drawRoundedRect(ctx, scaledX, scaledY, scaledW, headerH, { tl: 10 * scaleX, tr: 10 * scaleX, br: 0, bl: 0 });
  ctx.fillStyle = colorToRgba(borderSubtle, 0.2);
  ctx.fill();

  drawGripDots(ctx, scaledX + Math.round(10 * scaleX), scaledY + headerH / 2, scaleX, scaleY, textMuted);

  let cursorX = scaledX + Math.round(24 * scaleX);
  const headerCenterY = scaledY + headerH / 2;
  const biasLabel = isBearish ? 'BEARISH' : 'BULLISH';

  ctx.font = `bold ${Math.round(9 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.textBaseline = 'middle';
  const biasTextW = ctx.measureText ? ctx.measureText(biasLabel).width : biasLabel.length * 6 * scaleX;
  const biasPad = Math.round(8 * scaleX);

  drawRoundedRect(ctx, cursorX, headerCenterY - Math.round(8 * scaleY), biasTextW + biasPad, Math.round(16 * scaleY), 3 * scaleX);
  ctx.fillStyle = colorToRgba(biasBadgeColor, 0.2);
  ctx.fill();
  ctx.strokeStyle = biasBadgeColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = biasBadgeColor;
  ctx.textAlign = 'left';
  ctx.fillText(biasLabel, cursorX + biasPad / 2, headerCenterY);
  cursorX += biasTextW + biasPad + Math.round(8 * scaleX);

  if (plan.conclusion?.probability) {
    const probText = String(plan.conclusion.probability);
    const probTextW = ctx.measureText ? ctx.measureText(probText).width : probText.length * 6 * scaleX;
    drawRoundedRect(ctx, cursorX, headerCenterY - Math.round(8 * scaleY), probTextW + biasPad, Math.round(16 * scaleY), 3 * scaleX);
    ctx.fillStyle = colorToRgba(brandCyan, 0.18);
    ctx.fill();
    ctx.strokeStyle = colorToRgba(brandCyan, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = brandCyan;
    ctx.fillText(probText, cursorX + biasPad / 2, headerCenterY);
    cursorX += probTextW + biasPad + Math.round(8 * scaleX);
  }

  if (plan.setupStatus) {
    const statusText = String(plan.setupStatus);
    const statusTextW = ctx.measureText ? ctx.measureText(statusText).width : statusText.length * 6 * scaleX;
    drawRoundedRect(ctx, cursorX, headerCenterY - Math.round(8 * scaleY), statusTextW + biasPad, Math.round(16 * scaleY), 3 * scaleX);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.fillText(statusText, cursorX + biasPad / 2, headerCenterY);
    cursorX += statusTextW + biasPad + Math.round(8 * scaleX);
  }

  if (plan.confluenceScore) {
    const confText = `Skor ${plan.confluenceScore.score}/${plan.confluenceScore.max}`;
    const confTextW = ctx.measureText ? ctx.measureText(confText).width : confText.length * 6 * scaleX;
    drawRoundedRect(ctx, cursorX, headerCenterY - Math.round(8 * scaleY), confTextW + biasPad, Math.round(16 * scaleY), 3 * scaleX);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#c084fc';
    ctx.fillText(confText, cursorX + biasPad / 2, headerCenterY);
  }

  // 3. Body Content
  let currentY = scaledY + headerH + Math.round(12 * scaleY);

  if (plan.definition) {
    const defLines = wrapCanvasText(ctx, plan.definition, contentW - Math.round(14 * scaleX));
    const defBoxH = defLines.length * bodyLineHeight + Math.round(8 * scaleY);
    drawRoundedRect(ctx, contentLeft, currentY, contentW, defBoxH, { tl: 0, bl: 0, tr: 4 * scaleX, br: 4 * scaleX });
    ctx.fillStyle = colorToRgba(borderSubtle, 0.25);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(contentLeft, currentY);
    ctx.lineTo(contentLeft, currentY + defBoxH);
    ctx.strokeStyle = brandCyan;
    ctx.lineWidth = Math.round(2 * scaleX);
    ctx.stroke();

    ctx.font = `italic ${subFontSize}px sans-serif`;
    ctx.fillStyle = textMuted;
    let defLineY = currentY + Math.round(8 * scaleY);
    for (const dLine of defLines) {
      ctx.fillText(dLine, contentLeft + Math.round(8 * scaleX), defLineY);
      defLineY += bodyLineHeight;
    }
    currentY += defBoxH + Math.round(10 * scaleY);
  }

  // Seksi 1: KATALIS ENTRY
  ctx.font = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = textMuted;
  const entryHeader = plan.entries && plan.entries.length > 0 ? '⚡ BLENDED ENTRY' : '⚡ KATALIS ENTRY';
  ctx.fillText(entryHeader, contentLeft, currentY);

  ctx.fillStyle = biasBadgeColor;
  ctx.textAlign = 'right';
  ctx.fillText(`${formatPrice(plan.entry)}`, contentLeft + contentW, currentY);
  ctx.textAlign = 'left';
  currentY += Math.round(14 * scaleY);

  if (plan.entries && plan.entries.length > 0) {
    let ePillX = contentLeft;
    for (const e of plan.entries) {
      const wStr = typeof e.weight === 'number' ? ` (${Math.round(e.weight * 100)}%)` : '';
      const eStr = `${e.label}: ${formatPrice(e.price)}${wStr}`;
      ctx.font = `600 ${Math.round(8 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      const pillW = (ctx.measureText ? ctx.measureText(eStr).width : eStr.length * 6 * scaleX) + Math.round(10 * scaleX);
      const pillH = Math.round(14 * scaleY);

      if (ePillX + pillW > contentLeft + contentW) {
        ePillX = contentLeft;
        currentY += pillH + Math.round(4 * scaleY);
      }

      const eColor = e.style === 'aggressive' ? '#fbbf24' : '#38bdf8';
      drawRoundedRect(ctx, ePillX, currentY - pillH / 2, pillW, pillH, 3 * scaleX);
      ctx.fillStyle = colorToRgba(eColor, 0.12);
      ctx.fill();
      ctx.strokeStyle = colorToRgba(eColor, 0.3);
      ctx.stroke();

      ctx.fillStyle = eColor;
      ctx.fillText(eStr, ePillX + Math.round(5 * scaleX), currentY);
      ePillX += pillW + Math.round(5 * scaleX);
    }
    currentY += Math.round(12 * scaleY);
  }

  if (plan.contextZones && plan.contextZones.length > 0) {
    let pillX = contentLeft;
    for (const zone of plan.contextZones) {
      const zoneStr = `${zone.label || 'FVG'}: ${formatPrice(zone.low)} - ${formatPrice(zone.high)}`;
      ctx.font = `500 ${Math.round(8 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      const pillW = (ctx.measureText ? ctx.measureText(zoneStr).width : zoneStr.length * 6 * scaleX) + Math.round(10 * scaleX);
      const pillH = Math.round(14 * scaleY);

      if (pillX + pillW > contentLeft + contentW) {
        pillX = contentLeft;
        currentY += pillH + Math.round(4 * scaleY);
      }

      const pol = zone.polarity || inferZonePolarity(zone.label);
      const zoneColor = pol === 'bull' ? bullColor : pol === 'bear' ? bearColor : '#94a3b8';

      drawRoundedRect(ctx, pillX, currentY - pillH / 2, pillW, pillH, 3 * scaleX);
      ctx.fillStyle = colorToRgba(zoneColor, 0.12);
      ctx.fill();
      ctx.strokeStyle = colorToRgba(zoneColor, 0.3);
      ctx.stroke();

      ctx.fillStyle = zoneColor;
      ctx.fillText(zoneStr, pillX + Math.round(5 * scaleX), currentY);
      pillX += pillW + Math.round(5 * scaleX);
    }
    currentY += Math.round(12 * scaleY);
  }

  if (entryReasonLines.length > 0) {
    ctx.font = `${bodyFontSize}px sans-serif`;
    ctx.fillStyle = textPrimary;
    for (const line of entryReasonLines) {
      ctx.fillText(line, contentLeft, currentY);
      currentY += bodyLineHeight;
    }
    currentY += Math.round(4 * scaleY);
  }

  ctx.beginPath();
  ctx.moveTo(contentLeft, currentY);
  ctx.lineTo(contentLeft + contentW, currentY);
  ctx.strokeStyle = colorToRgba(borderSubtle, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  currentY += Math.round(10 * scaleY);

  // Seksi 2: INVALIDASI & STOP LOSS
  ctx.font = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = textMuted;
  ctx.fillText('🛡️ INVALIDASI & STOP LOSS', contentLeft, currentY);

  const slRStr = '-1.00R';
  ctx.font = `bold ${Math.round(8 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  const slRW = (ctx.measureText ? ctx.measureText(slRStr).width : 34 * scaleX) + Math.round(6 * scaleX);
  const slRX = contentLeft + contentW - slRW;
  drawRoundedRect(ctx, slRX, currentY - Math.round(6 * scaleY), slRW, Math.round(13 * scaleY), 2 * scaleX);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'left';
  ctx.fillText(slRStr, slRX + Math.round(3 * scaleX), currentY);

  ctx.font = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'right';
  ctx.fillText(`${formatPrice(plan.stopLoss)}`, slRX - Math.round(6 * scaleX), currentY);
  ctx.textAlign = 'left';
  currentY += Math.round(14 * scaleY);

  if (slReasonLines.length > 0) {
    ctx.font = `${bodyFontSize}px sans-serif`;
    ctx.fillStyle = textPrimary;
    for (const line of slReasonLines) {
      ctx.fillText(line, contentLeft, currentY);
      currentY += bodyLineHeight;
    }
    currentY += Math.round(4 * scaleY);
  }

  if (invScenarioLines.length > 0) {
    const invBoxH = invScenarioLines.length * bodyLineHeight + Math.round(18 * scaleY);
    drawRoundedRect(ctx, contentLeft, currentY, contentW, invBoxH, 6 * scaleX);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fill();

    ctx.save();
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([3 * scaleX, 2 * scaleX]);
    }
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.stroke();
    ctx.restore();

    ctx.font = `bold ${Math.round(7.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    const invBadgeW = (ctx.measureText ? ctx.measureText('SKENARIO BATAL').width : 70 * scaleX) + Math.round(8 * scaleX);
    drawRoundedRect(ctx, contentLeft + Math.round(6 * scaleX), currentY + Math.round(4 * scaleY), invBadgeW, Math.round(12 * scaleY), 2 * scaleX);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillText('SKENARIO BATAL', contentLeft + Math.round(10 * scaleX), currentY + Math.round(10 * scaleY));

    ctx.font = `${subFontSize}px sans-serif`;
    ctx.fillStyle = '#fca5a5';
    let invLineY = currentY + Math.round(20 * scaleY);
    for (const line of invScenarioLines) {
      ctx.fillText(line, contentLeft + Math.round(6 * scaleX), invLineY);
      invLineY += bodyLineHeight;
    }
    currentY += invBoxH + Math.round(8 * scaleY);
  }

  ctx.beginPath();
  ctx.moveTo(contentLeft, currentY);
  ctx.lineTo(contentLeft + contentW, currentY);
  ctx.strokeStyle = colorToRgba(borderSubtle, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  currentY += Math.round(10 * scaleY);

  // Seksi 3: TARGET LIKUIDITAS
  if (Array.isArray(plan.targets) && plan.targets.length > 0) {
    ctx.font = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    ctx.fillStyle = textMuted;
    ctx.fillText(`🎯 TARGET LIKUIDITAS (${plan.targets.length})`, contentLeft, currentY);
    currentY += Math.round(14 * scaleY);

    for (let i = 0; i < plan.targets.length; i++) {
      const tgt = plan.targets[i];
      const rLines = targetReasonLinesMap[i] || [];
      const itemH = Math.round(20 * scaleY) + (rLines.length > 0 ? rLines.length * bodyLineHeight + Math.round(6 * scaleY) : 0);

      drawRoundedRect(ctx, contentLeft, currentY, contentW, itemH, 5 * scaleX);
      ctx.fillStyle = colorToRgba(tokens.bgDarkest || '#0F0F0F', 0.4);
      ctx.fill();
      ctx.strokeStyle = colorToRgba(borderSubtle, 0.4);
      ctx.stroke();

      const itemCenterY = currentY + Math.round(10 * scaleY);

      const tpLabel = `TP${i + 1}:`;
      ctx.font = `bold ${Math.round(8.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      const tpW = (ctx.measureText ? ctx.measureText(tpLabel).width : 22 * scaleX) + Math.round(6 * scaleX);
      drawRoundedRect(ctx, contentLeft + Math.round(5 * scaleX), itemCenterY - Math.round(6 * scaleY), tpW, Math.round(13 * scaleY), 2 * scaleX);
      ctx.fillStyle = colorToRgba(bullColor, 0.15);
      ctx.fill();
      ctx.fillStyle = bullColor;
      ctx.fillText(tpLabel, contentLeft + Math.round(8 * scaleX), itemCenterY);

      ctx.fillStyle = textPrimary;
      ctx.font = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      const priceStr = `${formatPrice(tgt.price)}`;
      ctx.fillText(priceStr, contentLeft + Math.round(14 * scaleX) + tpW, itemCenterY);

      if (typeof tgt.rMultiple === 'number' && !isNaN(tgt.rMultiple)) {
        const sign = tgt.rMultiple >= 0 ? '+' : '';
        const rStr = `${sign}${tgt.rMultiple.toFixed(2)}R`;
        const isNegative = tgt.rMultiple < 0;
        const badgeColor = isNegative ? '#ef4444' : brandCyan;
        ctx.font = `bold ${Math.round(8 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
        const rW = (ctx.measureText ? ctx.measureText(rStr).width : 34 * scaleX) + Math.round(6 * scaleX);
        const rX = contentLeft + contentW - rW - Math.round(5 * scaleX);
        drawRoundedRect(ctx, rX, itemCenterY - Math.round(6 * scaleY), rW, Math.round(13 * scaleY), 2 * scaleX);
        ctx.fillStyle = colorToRgba(badgeColor, 0.12);
        ctx.fill();
        ctx.fillStyle = badgeColor;
        ctx.fillText(rStr, rX + Math.round(3 * scaleX), itemCenterY);
      }

      if (rLines.length > 0) {
        let rLineY = currentY + Math.round(20 * scaleY);
        ctx.font = `${subFontSize}px sans-serif`;
        ctx.fillStyle = textMuted;
        for (const line of rLines) {
          ctx.fillText(line, contentLeft + Math.round(6 * scaleX), rLineY);
          rLineY += bodyLineHeight;
        }
      }

      currentY += itemH + Math.round(5 * scaleY);
    }
  }

  // Seksi 4: Ringkasan Risiko & Probabilitas
  if (plan.riskAmount || probNotesLines.length > 0) {
    if (plan.riskAmount) {
      ctx.font = `500 ${Math.round(8.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      ctx.fillStyle = textMuted;
      ctx.fillText(`Unit Risiko (R): ${formatPrice(plan.riskAmount)}`, contentLeft, currentY);
      currentY += Math.round(12 * scaleY);
    }

    if (probNotesLines.length > 0) {
      ctx.font = `${subFontSize}px sans-serif`;
      ctx.fillStyle = textPrimary;
      for (const line of probNotesLines) {
        ctx.fillText(line, contentLeft, currentY);
        currentY += bodyLineHeight;
      }
    }
  }

  ctx.restore();
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
 * Memperkirakan jumlah baris teks terbungkus berdasarkan batas karakter per baris
 */
function estimateWrappedLineCount(text: string | undefined, charsPerLine = 44): number {
  if (!text) return 0;
  const clean = text.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/_/g, '').trim();
  if (!clean) return 0;

  const paragraphs = clean.split('\n');
  let totalLines = 0;
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    totalLines += Math.max(1, Math.ceil(trimmed.length / charsPerLine));
  }
  return totalLines;
}

/**
 * Menghitung perkiraan tinggi logis yang dibutuhkan oleh panel samping narasi tesis (Side Panel).
 * Memastikan teks narasi panjang (alasan entry, invalidasi, target, probabilitas) tidak terpotong (#132, #133).
 */
export function calculateThesisPanelHeight(
  plan: ParsedTradingPlan | null | undefined,
  panelWidth: number = SNAPSHOT_SIDE_PANEL_WIDTH
): number {
  if (!plan) return 0;

  // Margin dan padding wadah kartu luar (atas & bawah)
  let height = 36;

  // Header kartu: Lencana bias, harga entry, ikon/grip
  height += 56;

  // Lebar konten efektif di dalam padding kartu (~348px untuk panel 380px)
  const contentWidth = Math.max(200, panelWidth - 32);
  const charsPerLine = Math.floor(contentWidth / 8);

  // Definisi / Narasi Pengantar
  if (plan.definition) {
    const lines = estimateWrappedLineCount(plan.definition, charsPerLine);
    height += lines * 18 + 14;
  }

  // Seksi Katalis & Alasan Entry
  height += 28;
  if (plan.entries && plan.entries.length > 0) {
    height += 24;
  }
  if (plan.contextZones && plan.contextZones.length > 0) {
    height += 24;
  }
  if (plan.reasons?.entry) {
    const lines = estimateWrappedLineCount(plan.reasons.entry, charsPerLine);
    height += lines * 18 + 10;
  }

  // Seksi Batas Invalidasi & Stop Loss
  height += 32;
  if (plan.reasons?.stopLoss) {
    const lines = estimateWrappedLineCount(plan.reasons.stopLoss, charsPerLine);
    height += lines * 18 + 8;
  }
  if (plan.conclusion?.invalidationScenario) {
    // Kotak skenario pembatalan berbingkai memiliki padding internal ekstra
    const lines = estimateWrappedLineCount(plan.conclusion.invalidationScenario, charsPerLine - 4);
    height += lines * 18 + 26;
  }

  // Seksi Target Likuiditas Bertingkat
  if (Array.isArray(plan.targets) && plan.targets.length > 0) {
    height += 28;
    for (let i = 0; i < plan.targets.length; i++) {
      height += 26;
      const targetReason = plan.reasons?.[`tp${i + 1}`] || plan.targets[i]?.reason;
      if (targetReason) {
        const lines = estimateWrappedLineCount(targetReason, charsPerLine - 4);
        height += lines * 18 + 8;
      }
    }
  }

  // Seksi Unit Risiko & Catatan Probabilitas
  if (plan.riskAmount || plan.conclusion?.probabilityNotes) {
    height += 24;
    if (plan.conclusion?.probabilityNotes) {
      const lines = estimateWrappedLineCount(plan.conclusion.probabilityNotes, charsPerLine);
      height += lines * 18 + 8;
    }
  }

  return Math.ceil(height);
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
 * Helper untuk memecah teks dan merender kata atau badge epistemik ([FAKTA], [INFERENSI], [SPEKULASI])
 * secara inline pada kanvas 2D dengan wrap otomatis.
 */
function renderEpistemicText(
  ctx: any,
  text: string | undefined,
  startX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  scale: number,
  textTokens: { textPrimary: string; textMuted: string; brandCyan: string }
): number {
  if (!text) return 0;
  const clean = text.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/_/g, '').trim();
  if (!clean) return 0;

  const paragraphs = clean.split('\n');
  let currentX = startX;
  let currentY = startY;
  const initialY = startY;

  const bodyFontSize = Math.max(9, Math.round(9 * scale));
  const badgeFontSize = Math.max(8, Math.round(7.5 * scale));

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    const words = trimmedPara.split(/\s+/);

    for (const word of words) {
      const isFakta = /\[?FAKTA\]?/i.test(word);
      const isInferensi = /\[?INFERENSI\]?/i.test(word);
      const isSpekulasi = /\[?SPEKULASI\]?/i.test(word);

      if (isFakta || isInferensi || isSpekulasi) {
        const badgeText = isFakta ? '[FAKTA]' : isInferensi ? '[INFERENSI]' : '[SPEKULASI]';
        const badgeColor = isFakta ? '#38BDF8' : isInferensi ? '#FACC15' : '#FB923C';
        const badgeBg = isFakta ? 'rgba(56, 189, 248, 0.16)' : isInferensi ? 'rgba(250, 204, 21, 0.16)' : 'rgba(251, 146, 60, 0.16)';
        const badgeBorder = isFakta ? 'rgba(56, 189, 248, 0.35)' : isInferensi ? 'rgba(250, 204, 21, 0.35)' : 'rgba(251, 146, 60, 0.35)';

        ctx.font = `bold ${badgeFontSize}px "JetBrains Mono", monospace, sans-serif`;
        const badgeTextW = ctx.measureText ? ctx.measureText(badgeText).width : badgeText.length * 6 * scale;
        const badgeW = badgeTextW + Math.round(8 * scale);
        const badgeH = Math.round(14 * scale);

        // Jika melebihi batas lebar baris, pindah ke baris berikutnya
        if (currentX + badgeW > startX + maxWidth && currentX > startX) {
          currentX = startX;
          currentY += lineHeight;
        }

        ctx.save();
        drawRoundedRect(ctx, currentX, currentY - badgeH / 2, badgeW, badgeH, 2 * scale);
        ctx.fillStyle = badgeBg;
        ctx.fill();
        ctx.strokeStyle = badgeBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = badgeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, currentX + Math.round(4 * scale), currentY);
        ctx.restore();

        currentX += badgeW + Math.round(5 * scale);

        // Jika word memiliki tanda baca trailing (misal [FAKTA]. atau [INFERENSI],)
        const trailingPunct = word.replace(/^[[(]?(?:FAKTA|INFERENSI|SPEKULASI)[\])]?/i, '');
        if (trailingPunct) {
          ctx.save();
          ctx.font = `400 ${bodyFontSize}px "Plus Jakarta Sans", sans-serif`;
          ctx.fillStyle = textTokens.textPrimary;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(trailingPunct, currentX, currentY);
          const punctW = ctx.measureText ? ctx.measureText(trailingPunct).width : trailingPunct.length * 5 * scale;
          currentX += punctW + Math.round(4 * scale);
          ctx.restore();
        }
      } else {
        ctx.font = `400 ${bodyFontSize}px "Plus Jakarta Sans", sans-serif`;
        const wordW = ctx.measureText ? ctx.measureText(word).width : word.length * 5.5 * scale;

        if (currentX + wordW > startX + maxWidth && currentX > startX) {
          currentX = startX;
          currentY += lineHeight;
        }

        ctx.save();
        ctx.fillStyle = textTokens.textPrimary;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(word, currentX, currentY);
        ctx.restore();

        currentX += wordW + Math.round(4 * scale);
      }
    }

    currentX = startX;
    currentY += lineHeight;
  }

  return (currentY - initialY);
}

/**
 * Merender panel samping rencana trading (Dedicated Thesis Side Panel) ke dalam kanvas 2D (#132, #134).
 * Menghasilkan panel terstruktur dengan standar grafis editorial finansial modern:
 * - Header: Bias badge (Bullish/Bearish), Confidence level, dan harga Entry.
 * - Katalis Entry: Multi-timeframe pills, zona konteks FVG, dan teks narasi terformat [FAKTA]/[INFERENSI]/[SPEKULASI].
 * - Invalidasi & Stop Loss: SL price dengan lencana -1.00R dan kotak skenario pembatalan.
 * - Target Likuiditas: Daftar jenjang target dengan harga, alasan, dan lencana +R.
 * - Unit Risiko (R) dan Catatan Probabilitas.
 * - Penataan gaya reaktif mengikuti token tema aktif.
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
  const activeTheme = themeConfig || THEME_PRESETS.signature;
  const tokens = activeTheme.tokens;
  const chartTokens = activeTheme.chart;

  // Latar belakang dan border panel diturunkan langsung dari warna latar Chart Canvas Theme aktif (ADR-0019)
  const chartBg = chartTokens.background || tokens.bgDarkest || '#0F0F0F';
  const isDarkChart = isDarkColor(chartBg);
  const candidateSurface = tokens.bgSecondary || tokens.bgContainer || '#161616';
  const safeSurface = isDarkColor(candidateSurface) === isDarkChart
    ? candidateSurface
    : deriveSurfaceColor(chartBg, 0.07);
  const panelBgColor = colorToRgba(safeSurface, 0.96);
  const borderSubtle = tokens.borderSubtle || '#222222';
  const textPrimary = ensureReadableTextColor(safeSurface, tokens.textPrimary || tokens.textMain || '#F7F7F7');
  const textMuted = tokens.textMuted && isDarkColor(tokens.textMuted) !== isDarkChart
    ? tokens.textMuted
    : colorToRgba(textPrimary, 0.68);

  const isBearish = plan.bias === 'bearish';
  const bullColor = tokens.bullColor || chartTokens.upColor || '#F7F7F7';
  const bearColor = tokens.bearColor || chartTokens.downColor || '#FF69B4';
  const biasColor = isBearish ? bearColor : bullColor;
  const brandCyan = tokens.brandCyan || '#38BDF8';

  ctx.save();

  // 1. Panel Container Background & Subtle Border
  drawRoundedRect(ctx, x, y, width, height, 8 * scale);
  ctx.fillStyle = panelBgColor;
  ctx.fill();

  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.strokeStyle = colorToRgba(borderSubtle, 0.8);
  ctx.stroke();

  const padX = Math.round(14 * scale);
  const padY = Math.round(14 * scale);
  const contentX = x + padX;
  const contentW = width - padX * 2;
  let currentY = y + padY;

  // 2. Header: Bias Badge, Confidence Level, dan Harga Entry
  const headerH = Math.round(30 * scale);
  const headerCenterY = currentY + headerH / 2;

  // 2a. Bias Badge (BULLISH / BEARISH)
  const biasLabel = isBearish ? 'BEARISH' : 'BULLISH';
  ctx.font = `bold ${Math.round(10 * scale)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.textBaseline = 'middle';
  const biasTextW = ctx.measureText ? ctx.measureText(biasLabel).width : biasLabel.length * 7 * scale;
  const biasW = biasTextW + Math.round(12 * scale);
  drawRoundedRect(ctx, contentX, headerCenterY - Math.round(10 * scale), biasW, Math.round(20 * scale), 4 * scale);
  ctx.fillStyle = colorToRgba(biasColor, 0.18);
  ctx.fill();
  ctx.strokeStyle = biasColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = biasColor;
  ctx.textAlign = 'left';
  ctx.fillText(biasLabel, contentX + Math.round(6 * scale), headerCenterY);

  let cursorX = contentX + biasW + Math.round(8 * scale);

  // 2b. Confidence Level (Probabilitas Setup)
  if (plan.conclusion?.probability) {
    const rawProb = String(plan.conclusion.probability);
    const shortProbMatch = rawProb.match(/^(Sangat Tinggi(?:\s*\([A-Z0-9+-]+\))?|Tinggi|High|Medium|Low|A\+|A|B\+|B)/i);
    const probText = shortProbMatch ? shortProbMatch[0] : (rawProb.length > 22 ? rawProb.substring(0, 20) + '…' : rawProb);
    ctx.font = `600 ${Math.round(9.5 * scale)}px "JetBrains Mono", monospace, sans-serif`;
    const probTextW = ctx.measureText ? ctx.measureText(probText).width : probText.length * 6 * scale;
    const probW = probTextW + Math.round(10 * scale);

    drawRoundedRect(ctx, cursorX, headerCenterY - Math.round(10 * scale), probW, Math.round(20 * scale), 4 * scale);
    ctx.fillStyle = colorToRgba(brandCyan, 0.16);
    ctx.fill();
    ctx.strokeStyle = colorToRgba(brandCyan, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = brandCyan;
    ctx.fillText(probText, cursorX + Math.round(5 * scale), headerCenterY);
    cursorX += probW + Math.round(8 * scale);
  }

  // 2c. Entry Price di Header (Rata Kanan)
  const entryPriceStr = `${formatPlanPrice(plan.entry)}`;
  const priceFont = `bold ${Math.round(11 * scale)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.font = priceFont;
  const rawPriceW = ctx.measureText ? ctx.measureText(entryPriceStr).width : 0;
  const entryPriceW = Math.max(rawPriceW, entryPriceStr.length * Math.round(7.2 * scale));

  const labelFont = `500 ${Math.round(9 * scale)}px "Plus Jakarta Sans", sans-serif`;
  const gapBetween = Math.round(8 * scale);
  const rightMargin = Math.round(2 * scale);
  const rightEdgeX = contentX + contentW - rightMargin;

  // Render Angka Harga Entry (Rata Kanan di rightEdgeX)
  ctx.textAlign = 'right';
  ctx.font = priceFont;
  ctx.fillStyle = biasColor;
  ctx.fillText(entryPriceStr, rightEdgeX, headerCenterY);

  // Render Label 'Entry' di sebelah kiri harga entry dengan jarak aman
  ctx.font = labelFont;
  ctx.fillStyle = textMuted;
  ctx.fillText('Entry', rightEdgeX - entryPriceW - gapBetween, headerCenterY);
  ctx.textAlign = 'left';

  currentY += headerH + Math.round(8 * scale);

  // Garis Pemisah Halus Header
  ctx.beginPath();
  ctx.moveTo(contentX, currentY);
  ctx.lineTo(contentX + contentW, currentY);
  ctx.strokeStyle = colorToRgba(borderSubtle, 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
  currentY += Math.round(10 * scale);

  // 3. Definition Banner jika ada
  if (plan.definition) {
    const defLines = wrapCanvasText(ctx, plan.definition, contentW - Math.round(16 * scale));
    const defLineH = Math.round(14 * scale);
    const defBoxH = defLines.length * defLineH + Math.round(12 * scale);

    drawRoundedRect(ctx, contentX, currentY, contentW, defBoxH, 4 * scale);
    ctx.fillStyle = colorToRgba(borderSubtle, 0.25);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(contentX, currentY);
    ctx.lineTo(contentX, currentY + defBoxH);
    ctx.strokeStyle = brandCyan;
    ctx.lineWidth = Math.round(2 * scale);
    ctx.stroke();

    ctx.font = `italic ${Math.round(9 * scale)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = textMuted;
    let defLineY = currentY + Math.round(10 * scale);
    for (const dLine of defLines) {
      ctx.fillText(dLine, contentX + Math.round(8 * scale), defLineY);
      defLineY += defLineH;
    }
    currentY += defBoxH + Math.round(10 * scale);
  }

  // 4. Seksi KATALIS ENTRY
  ctx.font = `bold ${Math.round(10 * scale)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = textMuted;
  ctx.fillText('⚡ KATALIS ENTRY', contentX, currentY);
  currentY += Math.round(14 * scale);

  // 4a. Multi-Timeframe Pills & Context Zone Pills
  const tfMatches = Array.from(
    new Set((plan.reasons?.entry || '').match(/\b(?:1m|3m|5m|15m|30m|45m|1h|2h|4h|1d|daily|weekly|m5|m15|h1|h4)\b/gi) || [])
  );
  const pills: Array<{ text: string; isZone?: boolean; zoneColor?: string }> = [];
  if (tfMatches.length > 0) {
    for (const tf of tfMatches) {
      pills.push({ text: `TF ${tf.toUpperCase()}` });
    }
  }
  if (plan.contextZones && plan.contextZones.length > 0) {
    for (const zone of plan.contextZones) {
      const pol = zone.polarity || inferZonePolarity(zone.label);
      const zoneColor = pol === 'bull' ? bullColor : pol === 'bear' ? bearColor : '#94a3b8';
      pills.push({
        text: `${zone.label || 'FVG'}: ${formatPlanPrice(zone.low)} - ${formatPlanPrice(zone.high)}`,
        isZone: true,
        zoneColor
      });
    }
  }

  if (pills.length > 0) {
    let pillX = contentX;
    for (const pill of pills) {
      ctx.font = `600 ${Math.round(8.5 * scale)}px "JetBrains Mono", monospace, sans-serif`;
      const pillTextW = ctx.measureText ? ctx.measureText(pill.text).width : pill.text.length * 6 * scale;
      const pillW = pillTextW + Math.round(10 * scale);
      const pillH = Math.round(16 * scale);

      if (pillX + pillW > contentX + contentW) {
        pillX = contentX;
        currentY += pillH + Math.round(4 * scale);
      }

      const activePillColor = pill.isZone ? (pill.zoneColor || biasColor) : brandCyan;
      drawRoundedRect(ctx, pillX, currentY - pillH / 2, pillW, pillH, 3 * scale);
      ctx.fillStyle = colorToRgba(activePillColor, 0.12);
      ctx.fill();
      ctx.strokeStyle = colorToRgba(activePillColor, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = activePillColor;
      ctx.fillText(pill.text, pillX + Math.round(5 * scale), currentY);
      pillX += pillW + Math.round(6 * scale);
    }
    currentY += Math.round(14 * scale);
  }

  // 4b. Formatted Fact / Inference / Speculation Text untuk Entry
  if (plan.reasons?.entry) {
    const entryH = renderEpistemicText(
      ctx,
      plan.reasons.entry,
      contentX,
      currentY + Math.round(6 * scale),
      contentW,
      Math.round(15 * scale),
      scale,
      { textPrimary, textMuted, brandCyan }
    );
    currentY += entryH + Math.round(6 * scale);
  }

  // Garis Pemisah Seksi
  ctx.beginPath();
  ctx.moveTo(contentX, currentY);
  ctx.lineTo(contentX + contentW, currentY);
  ctx.strokeStyle = colorToRgba(borderSubtle, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  currentY += Math.round(10 * scale);

  // 5. Seksi INVALIDASI & STOP LOSS
  ctx.font = `bold ${Math.round(10 * scale)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = textMuted;
  ctx.fillText('🛡️ INVALIDASI & STOP LOSS', contentX, currentY);

  // 5a. Lencana -1.00R di sisi kanan
  const slRStr = '-1.00R';
  ctx.font = `bold ${Math.round(8.5 * scale)}px "JetBrains Mono", monospace, sans-serif`;
  const slRW = (ctx.measureText ? ctx.measureText(slRStr).width : 34 * scale) + Math.round(8 * scale);
  const slRX = contentX + contentW - slRW;
  drawRoundedRect(ctx, slRX, currentY - Math.round(7 * scale), slRW, Math.round(15 * scale), 2 * scale);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'left';
  ctx.fillText(slRStr, slRX + Math.round(4 * scale), currentY);

  // 5b. Harga SL di sebelah kiri lencana R
  ctx.font = `bold ${Math.round(10.5 * scale)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'right';
  ctx.fillText(`${formatPlanPrice(plan.stopLoss)}`, slRX - Math.round(6 * scale), currentY);
  ctx.textAlign = 'left';
  currentY += Math.round(14 * scale);

  // 5c. Alasan Stop Loss
  if (plan.reasons?.stopLoss) {
    const slH = renderEpistemicText(
      ctx,
      plan.reasons.stopLoss,
      contentX,
      currentY + Math.round(6 * scale),
      contentW,
      Math.round(15 * scale),
      scale,
      { textPrimary, textMuted, brandCyan }
    );
    currentY += slH + Math.round(6 * scale);
  }

  // 5d. Kotak Skenario Pembatalan (Invalidation Scenario)
  if (plan.conclusion?.invalidationScenario) {
    const invScenarioText = plan.conclusion.invalidationScenario;
    const lines = wrapCanvasText(ctx, invScenarioText, contentW - Math.round(20 * scale));
    const lineHeight = Math.round(14 * scale);
    const invBoxH = lines.length * lineHeight + Math.round(24 * scale);

    drawRoundedRect(ctx, contentX, currentY, contentW, invBoxH, 4 * scale);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fill();

    ctx.save();
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([3 * scale, 2 * scale]);
    }
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.stroke();
    ctx.restore();

    // Badge SKENARIO BATAL
    ctx.font = `bold ${Math.round(8 * scale)}px "JetBrains Mono", monospace, sans-serif`;
    const invBadgeW = (ctx.measureText ? ctx.measureText('SKENARIO BATAL').width : 70 * scale) + Math.round(8 * scale);
    drawRoundedRect(ctx, contentX + Math.round(6 * scale), currentY + Math.round(5 * scale), invBadgeW, Math.round(13 * scale), 2 * scale);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillText('SKENARIO BATAL', contentX + Math.round(10 * scale), currentY + Math.round(11 * scale));

    // Isi Teks Skenario
    renderEpistemicText(
      ctx,
      invScenarioText,
      contentX + Math.round(8 * scale),
      currentY + Math.round(25 * scale),
      contentW - Math.round(16 * scale),
      lineHeight,
      scale,
      { textPrimary: '#fca5a5', textMuted: '#f87171', brandCyan }
    );

    currentY += invBoxH + Math.round(8 * scale);
  }

  // Garis Pemisah Seksi
  ctx.beginPath();
  ctx.moveTo(contentX, currentY);
  ctx.lineTo(contentX + contentW, currentY);
  ctx.strokeStyle = colorToRgba(borderSubtle, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  currentY += Math.round(10 * scale);

  // 6. Seksi TARGET LIKUIDITAS
  if (Array.isArray(plan.targets) && plan.targets.length > 0) {
    ctx.font = `bold ${Math.round(10 * scale)}px "JetBrains Mono", monospace, sans-serif`;
    ctx.fillStyle = textMuted;
    ctx.fillText(`🎯 TARGET LIKUIDITAS (${plan.targets.length})`, contentX, currentY);
    currentY += Math.round(14 * scale);

    for (let i = 0; i < plan.targets.length; i++) {
      const tgt = plan.targets[i];
      const targetKey = `tp${i + 1}`;
      const reason = plan.reasons?.[targetKey] || tgt.reason;

      const reasonLines = reason ? wrapCanvasText(ctx, reason, contentW - Math.round(16 * scale)) : [];
      const reasonLineH = Math.round(14 * scale);
      const itemH = Math.round(24 * scale) + (reasonLines.length > 0 ? reasonLines.length * reasonLineH + Math.round(8 * scale) : 0);

      drawRoundedRect(ctx, contentX, currentY, contentW, itemH, 4 * scale);
      ctx.fillStyle = colorToRgba(tokens.bgDarkest || '#0F0F0F', 0.45);
      ctx.fill();
      ctx.strokeStyle = colorToRgba(borderSubtle, 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();

      const itemHeaderY = currentY + Math.round(12 * scale);

      // TP Label Badge (e.g. TP1)
      const tpLabel = `TP${i + 1}`;
      ctx.font = `bold ${Math.round(9 * scale)}px "JetBrains Mono", monospace, sans-serif`;
      const tpW = (ctx.measureText ? ctx.measureText(tpLabel).width : 22 * scale) + Math.round(8 * scale);
      drawRoundedRect(ctx, contentX + Math.round(6 * scale), itemHeaderY - Math.round(7 * scale), tpW, Math.round(14 * scale), 2 * scale);
      ctx.fillStyle = colorToRgba(bullColor, 0.15);
      ctx.fill();
      ctx.fillStyle = bullColor;
      ctx.fillText(tpLabel, contentX + Math.round(10 * scale), itemHeaderY);

      // Target Price
      ctx.font = `bold ${Math.round(10 * scale)}px "JetBrains Mono", monospace, sans-serif`;
      ctx.fillStyle = textPrimary;
      const targetPriceStr = `${formatPlanPrice(tgt.price)}`;
      ctx.fillText(targetPriceStr, contentX + tpW + Math.round(12 * scale), itemHeaderY);

      // R-Multiple Badge (+R)
      if (typeof tgt.rMultiple === 'number' && !isNaN(tgt.rMultiple)) {
        const sign = tgt.rMultiple >= 0 ? '+' : '';
        const rStr = `${sign}${tgt.rMultiple.toFixed(2)}R`;
        const isNegative = tgt.rMultiple < 0;
        const rColor = isNegative ? '#ef4444' : brandCyan;

        ctx.font = `bold ${Math.round(8.5 * scale)}px "JetBrains Mono", monospace, sans-serif`;
        const rW = (ctx.measureText ? ctx.measureText(rStr).width : 34 * scale) + Math.round(8 * scale);
        const rX = contentX + contentW - rW - Math.round(6 * scale);

        drawRoundedRect(ctx, rX, itemHeaderY - Math.round(7 * scale), rW, Math.round(14 * scale), 2 * scale);
        ctx.fillStyle = colorToRgba(rColor, 0.15);
        ctx.fill();
        ctx.strokeStyle = colorToRgba(rColor, 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = rColor;
        ctx.fillText(rStr, rX + Math.round(4 * scale), itemHeaderY);
      }

      // Reason Text di dalam kartu target
      if (reason) {
        renderEpistemicText(
          ctx,
          reason,
          contentX + Math.round(8 * scale),
          itemHeaderY + Math.round(14 * scale),
          contentW - Math.round(16 * scale),
          reasonLineH,
          scale,
          { textPrimary: textMuted, textMuted, brandCyan }
        );
      }

      currentY += itemH + Math.round(6 * scale);
    }
  }

  // 7. Seksi Unit Risiko (R) & Catatan Probabilitas
  if (plan.riskAmount || plan.conclusion?.probabilityNotes) {
    ctx.beginPath();
    ctx.moveTo(contentX, currentY);
    ctx.lineTo(contentX + contentW, currentY);
    ctx.strokeStyle = colorToRgba(borderSubtle, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    currentY += Math.round(10 * scale);

    if (plan.riskAmount) {
      ctx.font = `500 ${Math.round(9 * scale)}px "JetBrains Mono", monospace, sans-serif`;
      ctx.fillStyle = textMuted;
      ctx.fillText('Unit Risiko (R):', contentX, currentY);

      ctx.font = `bold ${Math.round(9.5 * scale)}px "JetBrains Mono", monospace, sans-serif`;
      ctx.fillStyle = textPrimary;
      ctx.textAlign = 'right';
      ctx.fillText(`${formatPlanPrice(plan.riskAmount)}`, contentX + contentW, currentY);
      ctx.textAlign = 'left';
      currentY += Math.round(14 * scale);
    }

    if (plan.conclusion?.probabilityNotes) {
      const probNotesLineH = Math.round(14 * scale);
      renderEpistemicText(
        ctx,
        plan.conclusion.probabilityNotes,
        contentX,
        currentY + Math.round(6 * scale),
        contentW,
        probNotesLineH,
        scale,
        { textPrimary: textMuted, textMuted, brandCyan }
      );
    }
  }

  ctx.restore();
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

  // Latar bingkai terang (seperti tema Red Folder News #EDEDE9 atau custom light background)
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
