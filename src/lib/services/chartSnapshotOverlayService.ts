/**
 * Layanan Kompositor Overlay Tangkapan Layar (Snapshot Overlay Compositor Engine)
 * Menggabungkan Price Scale Badges (Entry, SL, TP) dan Floating Thesis Card
 * langsung ke kanvas 2D snapshot HiDPI agar hasil tangkapan layar identik dengan tampilan layar.
 */

import type { PriceScaleBadge } from './priceScaleLabelService';
import type { ParsedTradingPlan } from './planParserService';

export interface OverlayRenderContext {
  baseCanvas: HTMLCanvasElement;
  containerWidth: number;
  containerHeight: number;
  drawingPriceBadges: PriceScaleBadge[];
  showDrawingPriceLabels: boolean;
  activePlans: Array<ParsedTradingPlan & { id: string }>;
  showThesisCards: boolean;
  getPriceY: (price: number) => number | null;
  formatPrice: (price: number | null) => string;
}

/**
 * Helper untuk menggambar rounded rectangle pada context 2D
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | { tl?: number; tr?: number; br?: number; bl?: number }
): void {
  const r = typeof radius === 'number'
    ? { tl: radius, tr: radius, br: radius, bl: radius }
    : { tl: radius.tl || 0, tr: radius.tr || 0, br: radius.br || 0, bl: radius.bl || 0 };

  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + width - r.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr);
  ctx.lineTo(x + width, y + height - r.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
  ctx.lineTo(x + r.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}

/**
 * Merender Price Scale Badges di sumbu harga kanan kanvas snapshot
 */
export function drawPriceScaleBadgesOnCanvas(
  ctx: CanvasRenderingContext2D,
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
 * Merender Floating Thesis Card di kanvas snapshot
 */
export function drawThesisCardOnCanvas(
  ctx: CanvasRenderingContext2D,
  plan: ParsedTradingPlan & { id: string },
  scaleX: number,
  scaleY: number,
  formatPrice: (price: number | null) => string,
  posX: number = 16,
  posY: number = 56,
  cardWidth: number = 340
): void {
  const scaledX = Math.round(posX * scaleX);
  const scaledY = Math.round(posY * scaleY);
  const scaledW = Math.round(cardWidth * scaleX);
  const isBearish = plan.bias === 'bearish';

  ctx.save();

  // Hitung perkiraan tinggi kartu
  const baseLineHeight = Math.round(15 * scaleY);
  const targetsCount = Array.isArray(plan.targets) ? plan.targets.length : 0;
  const estimatedH = Math.round((140 + targetsCount * 28 + (plan.conclusion?.invalidationScenario ? 40 : 0)) * scaleY);

  // Background Obsidian Glassmorphism
  drawRoundedRect(ctx, scaledX, scaledY, scaledW, estimatedH, 8 * scaleX);
  ctx.fillStyle = 'rgba(13, 20, 36, 0.94)';
  ctx.fill();

  ctx.strokeStyle = isBearish ? 'rgba(255, 105, 180, 0.45)' : 'rgba(0, 255, 136, 0.45)';
  ctx.lineWidth = Math.max(1, Math.round(1.5 * scaleX));
  ctx.stroke();

  // Header Banner
  const headerH = Math.round(28 * scaleY);
  drawRoundedRect(ctx, scaledX, scaledY, scaledW, headerH, { tl: 8 * scaleX, tr: 8 * scaleX, br: 0, bl: 0 });
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();

  // Bias Badge di Header
  let cursorX = scaledX + Math.round(10 * scaleX);
  const headerCenterY = scaledY + headerH / 2;
  const biasLabel = isBearish ? 'BEARISH' : 'BULLISH';
  const biasBadgeColor = isBearish ? '#ff69b4' : '#00ff88';

  ctx.font = `bold ${Math.round(9 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  const biasTextW = ctx.measureText ? ctx.measureText(biasLabel).width : biasLabel.length * 6 * scaleX;
  const biasPad = Math.round(8 * scaleX);

  drawRoundedRect(ctx, cursorX, headerCenterY - Math.round(8 * scaleY), biasTextW + biasPad, Math.round(16 * scaleY), 3 * scaleX);
  ctx.fillStyle = isBearish ? 'rgba(255, 105, 180, 0.2)' : 'rgba(0, 255, 136, 0.2)';
  ctx.fill();
  ctx.strokeStyle = biasBadgeColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = biasBadgeColor;
  ctx.textBaseline = 'middle';
  ctx.fillText(biasLabel, cursorX + biasPad / 2, headerCenterY);
  cursorX += biasTextW + biasPad + Math.round(8 * scaleX);

  // Probabilitas Badge jika ada
  if (plan.conclusion?.probability) {
    const probText = String(plan.conclusion.probability);
    const probTextW = ctx.measureText ? ctx.measureText(probText).width : probText.length * 6 * scaleX;
    drawRoundedRect(ctx, cursorX, headerCenterY - Math.round(8 * scaleY), probTextW + biasPad, Math.round(16 * scaleY), 3 * scaleX);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(probText, cursorX + biasPad / 2, headerCenterY);
  }

  // Isi Tesis (Body)
  let currentY = scaledY + headerH + Math.round(14 * scaleY);
  const contentLeft = scaledX + Math.round(12 * scaleX);
  const maxContentW = scaledW - Math.round(24 * scaleX);

  // Baris Entry
  ctx.font = `bold ${Math.round(10 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = '#64748b';
  ctx.fillText('ENTRY:', contentLeft, currentY);
  ctx.fillStyle = biasBadgeColor;
  ctx.fillText(`${formatPrice(plan.entry)}`, contentLeft + Math.round(50 * scaleX), currentY);

  if (plan.contextZones && plan.contextZones.length > 0) {
    const fvgStr = `[FVG ${formatPrice(plan.contextZones[0].low)} - ${formatPrice(plan.contextZones[0].high)}]`;
    ctx.font = `500 ${Math.round(8.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(fvgStr, contentLeft + Math.round(135 * scaleX), currentY);
  }

  currentY += baseLineHeight;

  // Baris Stop Loss & Skenario
  ctx.font = `bold ${Math.round(10 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = '#64748b';
  ctx.fillText('STOP:', contentLeft, currentY);
  ctx.fillStyle = '#ef4444';
  ctx.fillText(`${formatPrice(plan.stopLoss)}`, contentLeft + Math.round(50 * scaleX), currentY);

  if (plan.riskAmount) {
    ctx.font = `500 ${Math.round(8.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`(R = ${formatPrice(plan.riskAmount)})`, contentLeft + Math.round(135 * scaleX), currentY);
  }

  currentY += baseLineHeight;

  // Baris Target Likuiditas
  if (Array.isArray(plan.targets)) {
    for (let i = 0; i < plan.targets.length; i++) {
      const tgt = plan.targets[i];
      ctx.font = `bold ${Math.round(10 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      ctx.fillStyle = '#10b981';
      ctx.fillText(`TP${i + 1}:`, contentLeft, currentY);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(`${formatPrice(tgt.price)}`, contentLeft + Math.round(50 * scaleX), currentY);

      if (tgt.rMultiple) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`(+${tgt.rMultiple.toFixed(2)}R)`, contentLeft + Math.round(135 * scaleX), currentY);
      }
      currentY += baseLineHeight;
    }
  }

  // Skenario Invalidasi
  if (plan.conclusion?.invalidationScenario) {
    currentY += Math.round(4 * scaleY);
    ctx.font = `italic ${Math.round(8.5 * scaleY)}px sans-serif`;
    ctx.fillStyle = '#fca5a5';
    const invText = `Batal jika: ${plan.conclusion.invalidationScenario.slice(0, 65)}...`;
    ctx.fillText(invText, contentLeft, currentY);
  }

  ctx.restore();
}

/**
 * Menghasilkan kanvas tangkapan layar yang memadukan grafik lilin dasar dengan seluruh overlay visual
 */
export function renderScreenshotCanvasWithOverlay(context: OverlayRenderContext): HTMLCanvasElement {
  const {
    baseCanvas,
    containerWidth,
    containerHeight,
    drawingPriceBadges,
    showDrawingPriceLabels,
    activePlans,
    showThesisCards,
    getPriceY,
    formatPrice
  } = context;

  if (typeof document === 'undefined') {
    return baseCanvas;
  }

  const finalCanvas = document.createElement('canvas');
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

  // 3. Gambar Floating Thesis Card jika aktif dan tidak tersembunyi
  if (showThesisCards && Array.isArray(activePlans) && activePlans.length > 0) {
    for (let i = 0; i < activePlans.length; i++) {
      const plan = activePlans[i];
      drawThesisCardOnCanvas(
        ctx,
        plan,
        scaleX,
        scaleY,
        formatPrice,
        16 + i * 24,
        56 + i * 24,
        340
      );
    }
  }

  return finalCanvas;
}
