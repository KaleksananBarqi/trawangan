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
  cardGeometries?: Record<string, { x: number; y: number; width: number; height: number; isWideMode?: boolean }>;
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
 * Helper untuk memecah teks menjadi baris-baris alami berdasarkan lebar maksimum kanvas (Text Wrapping)
 */
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  // Bersihkan tag HTML atau simbol markdown tebal/miring jika ada
  const clean = text.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/_/g, '').trim();
  if (!clean) return [];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
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
  return lines;
}

/**
 * Menggambar titik pegangan seret (Grip Dots) pada header kartu
 */
function drawGripDots(ctx: CanvasRenderingContext2D, x: number, y: number, scaleX: number, scaleY: number): void {
  ctx.save();
  ctx.fillStyle = '#64748b';
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
 * Merender Floating Thesis Card di kanvas snapshot dengan fidelitas visual penuh
 */
export function drawThesisCardOnCanvas(
  ctx: CanvasRenderingContext2D,
  plan: ParsedTradingPlan & { id: string },
  scaleX: number,
  scaleY: number,
  formatPrice: (price: number | null) => string,
  posX: number = 16,
  posY: number = 56,
  cardWidth: number = 340,
  cardHeight?: number,
  isWideMode: boolean = false
): void {
  const scaledX = Math.round(posX * scaleX);
  const scaledY = Math.round(posY * scaleY);
  const scaledW = Math.round(cardWidth * scaleX);
  const isBearish = plan.bias === 'bearish';
  const biasBadgeColor = isBearish ? '#ff69b4' : '#00ff88';

  ctx.save();

  const padX = Math.round(12 * scaleX);
  const contentLeft = scaledX + padX;
  const contentW = scaledW - padX * 2;
  const headerH = Math.round(28 * scaleY);

  // Pengaturan font pengukuran untuk text wrapping
  const bodyFontSize = Math.max(9, Math.round(9 * scaleY));
  const subFontSize = Math.max(8, Math.round(8.5 * scaleY));
  const bodyLineHeight = Math.round(13 * scaleY);

  ctx.font = `${bodyFontSize}px sans-serif`;

  // Pre-wrap teks narasi
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

  // Hitung tinggi konten total yang dibutuhkan
  let requiredContentH = Math.round(16 * scaleY); // Top padding

  if (plan.definition) {
    const defLines = wrapCanvasText(ctx, plan.definition, contentW - Math.round(14 * scaleX));
    requiredContentH += (defLines.length * bodyLineHeight + Math.round(12 * scaleY));
  }

  // Seksi Entry
  requiredContentH += Math.round(18 * scaleY); // Judul seksi
  if (plan.contextZones && plan.contextZones.length > 0) {
    requiredContentH += Math.round(20 * scaleY); // Zone pills
  }
  if (entryReasonLines.length > 0) {
    requiredContentH += (entryReasonLines.length * bodyLineHeight + Math.round(8 * scaleY));
  }

  // Seksi Stop Loss & Skenario Batal
  requiredContentH += Math.round(22 * scaleY); // Judul seksi SL
  if (slReasonLines.length > 0) {
    requiredContentH += (slReasonLines.length * bodyLineHeight + Math.round(6 * scaleY));
  }
  if (invScenarioLines.length > 0) {
    requiredContentH += (invScenarioLines.length * bodyLineHeight + Math.round(22 * scaleY)); // Kotak skenario batal
  }

  // Seksi Target Likuiditas
  if (Array.isArray(plan.targets) && plan.targets.length > 0) {
    requiredContentH += Math.round(20 * scaleY); // Judul seksi TP
    for (let i = 0; i < plan.targets.length; i++) {
      requiredContentH += Math.round(20 * scaleY); // Baris TP header
      const tLines = targetReasonLinesMap[i];
      if (tLines && tLines.length > 0) {
        requiredContentH += (tLines.length * bodyLineHeight + Math.round(6 * scaleY));
      }
    }
  }

  // Seksi Risiko & Probabilitas
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

  // 1. Background Obsidian Glassmorphism
  drawRoundedRect(ctx, scaledX, scaledY, scaledW, finalCardH, 10 * scaleX);
  ctx.fillStyle = 'rgba(13, 20, 36, 0.94)';
  ctx.fill();

  ctx.strokeStyle = isBearish ? 'rgba(255, 105, 180, 0.45)' : 'rgba(0, 255, 136, 0.45)';
  ctx.lineWidth = Math.max(1, Math.round(1.5 * scaleX));
  ctx.stroke();

  // 2. Header Banner
  drawRoundedRect(ctx, scaledX, scaledY, scaledW, headerH, { tl: 10 * scaleX, tr: 10 * scaleX, br: 0, bl: 0 });
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();

  // Grip dots di pojok kiri header
  drawGripDots(ctx, scaledX + Math.round(10 * scaleX), scaledY + headerH / 2, scaleX, scaleY);

  // Bias Badge di Header
  let cursorX = scaledX + Math.round(24 * scaleX);
  const headerCenterY = scaledY + headerH / 2;
  const biasLabel = isBearish ? 'BEARISH' : 'BULLISH';

  ctx.font = `bold ${Math.round(9 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.textBaseline = 'middle';
  const biasTextW = ctx.measureText ? ctx.measureText(biasLabel).width : biasLabel.length * 6 * scaleX;
  const biasPad = Math.round(8 * scaleX);

  drawRoundedRect(ctx, cursorX, headerCenterY - Math.round(8 * scaleY), biasTextW + biasPad, Math.round(16 * scaleY), 3 * scaleX);
  ctx.fillStyle = isBearish ? 'rgba(255, 105, 180, 0.2)' : 'rgba(0, 255, 136, 0.2)';
  ctx.fill();
  ctx.strokeStyle = biasBadgeColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = biasBadgeColor;
  ctx.textAlign = 'left';
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
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(probText, cursorX + biasPad / 2, headerCenterY);
  }

  // 3. Body Content
  let currentY = scaledY + headerH + Math.round(12 * scaleY);

  // Definition Banner jika ada
  if (plan.definition) {
    const defLines = wrapCanvasText(ctx, plan.definition, contentW - Math.round(14 * scaleX));
    const defBoxH = defLines.length * bodyLineHeight + Math.round(8 * scaleY);
    drawRoundedRect(ctx, contentLeft, currentY, contentW, defBoxH, { tl: 0, bl: 0, tr: 4 * scaleX, br: 4 * scaleX });
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();

    // Border aksen kiri biru
    ctx.beginPath();
    ctx.moveTo(contentLeft, currentY);
    ctx.lineTo(contentLeft, currentY + defBoxH);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.round(2 * scaleX);
    ctx.stroke();

    ctx.font = `italic ${subFontSize}px sans-serif`;
    ctx.fillStyle = '#94a3b8';
    let defLineY = currentY + Math.round(8 * scaleY);
    for (const dLine of defLines) {
      ctx.fillText(dLine, contentLeft + Math.round(8 * scaleX), defLineY);
      defLineY += bodyLineHeight;
    }
    currentY += defBoxH + Math.round(10 * scaleY);
  }

  // Seksi 1: KATALIS ENTRY
  ctx.font = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = '#64748b';
  ctx.fillText('⚡ KATALIS ENTRY', contentLeft, currentY);

  ctx.fillStyle = biasBadgeColor;
  ctx.textAlign = 'right';
  ctx.fillText(`${formatPrice(plan.entry)}`, contentLeft + contentW, currentY);
  ctx.textAlign = 'left';
  currentY += Math.round(14 * scaleY);

  // Context Zone Pills (FVG)
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

      drawRoundedRect(ctx, pillX, currentY - pillH / 2, pillW, pillH, 3 * scaleX);
      ctx.fillStyle = isBearish ? 'rgba(255, 105, 180, 0.12)' : 'rgba(0, 255, 136, 0.12)';
      ctx.fill();
      ctx.strokeStyle = isBearish ? 'rgba(255, 105, 180, 0.3)' : 'rgba(0, 255, 136, 0.3)';
      ctx.stroke();

      ctx.fillStyle = isBearish ? '#ff69b4' : '#00ff88';
      ctx.fillText(zoneStr, pillX + Math.round(5 * scaleX), currentY);
      pillX += pillW + Math.round(5 * scaleX);
    }
    currentY += Math.round(12 * scaleY);
  }

  // Teks Alasan Entry
  if (entryReasonLines.length > 0) {
    ctx.font = `${bodyFontSize}px sans-serif`;
    ctx.fillStyle = '#cbd5e1';
    for (const line of entryReasonLines) {
      ctx.fillText(line, contentLeft, currentY);
      currentY += bodyLineHeight;
    }
    currentY += Math.round(4 * scaleY);
  }

  // Pembatas halus
  ctx.beginPath();
  ctx.moveTo(contentLeft, currentY);
  ctx.lineTo(contentLeft + contentW, currentY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();
  currentY += Math.round(10 * scaleY);

  // Seksi 2: INVALIDASI & STOP LOSS
  ctx.font = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  ctx.fillStyle = '#64748b';
  ctx.fillText('🛡️ INVALIDASI & STOP LOSS', contentLeft, currentY);

  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'right';
  ctx.fillText(`${formatPrice(plan.stopLoss)}`, contentLeft + contentW, currentY);
  ctx.textAlign = 'left';
  currentY += Math.round(14 * scaleY);

  // Teks Alasan Stop Loss
  if (slReasonLines.length > 0) {
    ctx.font = `${bodyFontSize}px sans-serif`;
    ctx.fillStyle = '#cbd5e1';
    for (const line of slReasonLines) {
      ctx.fillText(line, contentLeft, currentY);
      currentY += bodyLineHeight;
    }
    currentY += Math.round(4 * scaleY);
  }

  // Kotak Skenario Batal jika ada
  if (invScenarioLines.length > 0) {
    const invBoxH = invScenarioLines.length * bodyLineHeight + Math.round(18 * scaleY);
    drawRoundedRect(ctx, contentLeft, currentY, contentW, invBoxH, 6 * scaleX);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fill();

    // Garis putus-putus pembatalan
    ctx.save();
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([3 * scaleX, 2 * scaleX]);
    }
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.stroke();
    ctx.restore();

    // Badge SKENARIO BATAL
    ctx.font = `bold ${Math.round(7.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    const invBadgeW = (ctx.measureText ? ctx.measureText('SKENARIO BATAL').width : 70 * scaleX) + Math.round(8 * scaleX);
    drawRoundedRect(ctx, contentLeft + Math.round(6 * scaleX), currentY + Math.round(4 * scaleY), invBadgeW, Math.round(12 * scaleY), 2 * scaleX);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillText('SKENARIO BATAL', contentLeft + Math.round(10 * scaleX), currentY + Math.round(10 * scaleY));

    // Isi Skenario Batal
    ctx.font = `${subFontSize}px sans-serif`;
    ctx.fillStyle = '#fca5a5';
    let invLineY = currentY + Math.round(20 * scaleY);
    for (const line of invScenarioLines) {
      ctx.fillText(line, contentLeft + Math.round(6 * scaleX), invLineY);
      invLineY += bodyLineHeight;
    }
    currentY += invBoxH + Math.round(8 * scaleY);
  }

  // Pembatas halus
  ctx.beginPath();
  ctx.moveTo(contentLeft, currentY);
  ctx.lineTo(contentLeft + contentW, currentY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();
  currentY += Math.round(10 * scaleY);

  // Seksi 3: TARGET LIKUIDITAS
  if (Array.isArray(plan.targets) && plan.targets.length > 0) {
    ctx.font = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    ctx.fillStyle = '#64748b';
    ctx.fillText(`🎯 TARGET LIKUIDITAS (${plan.targets.length})`, contentLeft, currentY);
    currentY += Math.round(14 * scaleY);

    for (let i = 0; i < plan.targets.length; i++) {
      const tgt = plan.targets[i];
      const rLines = targetReasonLinesMap[i] || [];
      const itemH = Math.round(20 * scaleY) + (rLines.length > 0 ? rLines.length * bodyLineHeight + Math.round(6 * scaleY) : 0);

      drawRoundedRect(ctx, contentLeft, currentY, contentW, itemH, 5 * scaleX);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.stroke();

      const itemCenterY = currentY + Math.round(10 * scaleY);

      // TP Badge
      const tpLabel = `TP${i + 1}:`;
      ctx.font = `bold ${Math.round(8.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      const tpW = (ctx.measureText ? ctx.measureText(tpLabel).width : 22 * scaleX) + Math.round(6 * scaleX);
      drawRoundedRect(ctx, contentLeft + Math.round(5 * scaleX), itemCenterY - Math.round(6 * scaleY), tpW, Math.round(13 * scaleY), 2 * scaleX);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fill();
      ctx.fillStyle = '#10b981';
      ctx.fillText(tpLabel, contentLeft + Math.round(8 * scaleX), itemCenterY);

      // TP Price
      ctx.fillStyle = '#f1f5f9';
      ctx.font = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      const priceStr = `${formatPrice(tgt.price)}`;
      ctx.fillText(priceStr, contentLeft + Math.round(14 * scaleX) + tpW, itemCenterY);

      // R-Multiple Badge jika ada
      if (typeof tgt.rMultiple === 'number' && !isNaN(tgt.rMultiple)) {
        const rStr = `+${tgt.rMultiple.toFixed(2)}R`;
        ctx.font = `bold ${Math.round(8 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
        const rW = (ctx.measureText ? ctx.measureText(rStr).width : 34 * scaleX) + Math.round(6 * scaleX);
        const rX = contentLeft + contentW - rW - Math.round(5 * scaleX);
        drawRoundedRect(ctx, rX, itemCenterY - Math.round(6 * scaleY), rW, Math.round(13 * scaleY), 2 * scaleX);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(rStr, rX + Math.round(3 * scaleX), itemCenterY);
      }

      // Alasan Target di dalam kartu item
      if (rLines.length > 0) {
        let rLineY = currentY + Math.round(20 * scaleY);
        ctx.font = `${subFontSize}px sans-serif`;
        ctx.fillStyle = '#94a3b8';
        for (const line of rLines) {
          ctx.fillText(line, contentLeft + Math.round(6 * scaleX), rLineY);
          rLineY += bodyLineHeight;
        }
      }

      currentY += itemH + Math.round(5 * scaleY);
    }
  }

  // Seksi 4: Ringkasan Risiko & Probabilitas (jika ada)
  if (plan.riskAmount || probNotesLines.length > 0) {
    if (plan.riskAmount) {
      ctx.font = `500 ${Math.round(8.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Unit Risiko (R): ${formatPrice(plan.riskAmount)}`, contentLeft, currentY);
      currentY += Math.round(12 * scaleY);
    }

    if (probNotesLines.length > 0) {
      ctx.font = `${subFontSize}px sans-serif`;
      ctx.fillStyle = '#94a3b8';
      for (const line of probNotesLines) {
        ctx.fillText(line, contentLeft, currentY);
        currentY += bodyLineHeight;
      }
    }
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
        isWideMode
      );
    }
  }

  return finalCanvas;
}
