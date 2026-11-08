/**
 * Deep Module: Themed Thesis Overlay Engine (`thesisOverlayEngine.ts`)
 *
 * Menyatukan tiga implementasi Themed Thesis Overlay yang sebelumnya terpisah:
 * 1. DOM HUD Interaktif (`FloatingThesisCard.svelte`)
 * 2. Canvas Snapshot Overlay (`drawThesisCardOnCanvas`)
 * 3. Canvas Snapshot Side-Panel (`renderDedicatedThesisSidePanel` & `calculateThesisPanelHeight`)
 *
 * Arsitektur Hibrida (Desain B + Desain C):
 * - Pass 0 (`buildThesisPresentationModel`): Menghasilkan View-Model terstruktur sebagai Single Source of Truth
 *   untuk komponen Svelte (bebas `@html` / XSS) dan renderer Canvas2D, menjamin paritas penuh untuk:
 *   lencana Bias, Probability, Setup Status, Confluence Score, pil Dual-Entry (E1/E2 + bobot %),
 *   pil Context Zone (Zone Polarity), pil Timeframe otomatis, sub-badge R-multiple E1 pada TP,
 *   riskPercent pada Unit Risiko (R), serta segmen lencana epistemik ([FAKTA], [INFERENSI], [SPEKULASI]).
 * - Pass 1 (`measureThesisOverlayLayout`): Menghitung pohon geometri kotak, pembungkusan pil multi-baris,
 *   dan pembungkusan teks campuran (teks + lencana epistemik) untuk mengunci `outerBox.h` secara deterministik (0px drift).
 * - Pass 2 (`drawMeasuredThesisLayout`): Merender `MeasuredThesisLayout` langsung ke `CanvasRenderingContext2D`
 *   tanpa menghitung ulang tinggi.
 */

import { THEME_PRESETS, type ThemeConfig } from '../constants/themes';
import { formatPlanPrice, inferZonePolarity, type ParsedTradingPlan } from './planParserService';
import { deriveSurfaceColor, ensureReadableTextColor, isDarkColor } from '../utils/colorUtils';

export type ThesisOverlayVariant = 'floating-card' | 'side-panel';
export type EpistemicKind = 'fakta' | 'inferensi' | 'spekulasi';
export type PolarityTone = 'bullish' | 'bearish' | 'neutral';

/**
 * Segmen teks narasi terstruktur untuk merender teks biasa dan lencana epistemik
 * baik di template Svelte (tanpa `@html`) maupun di Canvas2D.
 */
export type EpistemicTextSegment =
  | { type: 'text'; content: string }
  | {
      type: 'badge';
      kind: EpistemicKind;
      label: '[FAKTA]' | '[INFERENSI]' | '[SPEKULASI]';
      trailingPunct?: string;
    };

/**
 * Palet permukaan dan tipografi adaptif yang diturunkan dari Chart Canvas Theme aktif (ADR-0019).
 */
export interface ThesisSurfacePalette {
  surfaceBg: string;
  surfaceBorder: string;
  itemBg: string;
  textPrimary: string;
  textMuted: string;
  bullColor: string;
  bearColor: string;
  biasColor: string;
  brandCyan: string;
  dangerColor: string;
  warningColor: string;
  purpleColor: string;
  epistemic: Record<EpistemicKind, { text: string; bg: string; border: string }>;
}

export interface ThesisPillNode {
  id: string;
  kind: 'entry-level' | 'timeframe' | 'context-zone';
  label: string;
  valueText?: string;
  subText?: string;
  fullText: string;
  tone: 'aggressive' | 'moderate' | 'bullish' | 'bearish' | 'neutral' | 'cyan';
}

/**
 * PASS 0: Model Presentasi Terstruktur (Single Source of Truth untuk Svelte DOM & Canvas2D)
 */
export interface ThesisPresentationModel {
  variant: ThesisOverlayVariant;
  isBearish: boolean;
  palette: ThesisSurfacePalette;
  header: {
    biasLabel: 'BULLISH' | 'BEARISH';
    probabilityBadge?: { fullText: string; shortText: string };
    setupStatusBadge?: string;
    confluenceBadge?: { shortText: string; fullText: string; score: number; max: number };
    collapsedSubtitle: string;
    rightEntrySummary: { label: 'Entry'; formattedPrice: string };
  };
  definition?: string;
  entrySection: {
    title: 'BLENDED ENTRY' | 'KATALIS ENTRY';
    formattedPrimaryPrice: string;
    dualEntries: Array<{
      id: string;
      label: string;
      formattedPrice: string;
      weightText?: string;
      pillText: string;
      style: 'aggressive' | 'moderate' | 'neutral';
    }>;
    timeframePills: string[];
    contextZones: Array<{
      label: string;
      formattedRange: string;
      polarity: PolarityTone;
    }>;
    reasonSegments: EpistemicTextSegment[];
  };
  invalidationSection: {
    title: 'INVALIDASI & STOP LOSS';
    formattedStopLoss: string;
    rBadge: '-1.00R';
    reasonSegments: EpistemicTextSegment[];
    invalidationBox?: {
      badgeLabel: 'SKENARIO BATAL';
      segments: EpistemicTextSegment[];
    };
  };
  targetsSection: {
    title: string;
    count: number;
    items: Array<{
      badge: string;
      colonBadge: string;
      formattedPrice: string;
      rBadge?: {
        primaryText: string;
        e1SubText?: string;
        combinedText: string;
        isNegative: boolean;
      };
      reasonSegments: EpistemicTextSegment[];
    }>;
  };
  riskFooter?: {
    formattedRiskAmount?: string;
    riskPercentText?: string;
    combinedRiskValue?: string;
    probabilityNotesSegments: EpistemicTextSegment[];
  };
}

export interface BuildThesisModelOptions {
  variant?: ThesisOverlayVariant;
  themeConfig?: ThemeConfig;
  formatPrice?: (price: number | null | undefined) => string;
}

export interface ThesisCanvasLayoutOptions extends BuildThesisModelOptions {
  variant: ThesisOverlayVariant;
  /** Koordinat X dalam piksel kanvas jika coordsAreScaled=true, atau piksel logis jika false */
  x?: number;
  /** Koordinat Y dalam piksel kanvas jika coordsAreScaled=true, atau piksel logis jika false */
  y?: number;
  /** Lebar dalam piksel kanvas jika coordsAreScaled=true, atau piksel logis jika false */
  width?: number;
  /** Tinggi minimum kartu/panel */
  height?: number;
  scaleX?: number;
  scaleY?: number;
  /**
   * Jika true (seperti pada `renderDedicatedThesisSidePanel`), `x`, `y`, `width`, `height` sudah dalam satuan piksel kanvas yang diskalakan.
   * Jika false (seperti pada `drawThesisCardOnCanvas`), `x`, `y`, `width`, `height` akan dikalikan dengan `scaleX`/`scaleY`.
   */
  coordsAreScaled?: boolean;
  isWideMode?: boolean;
  measureCtx?: Pick<CanvasRenderingContext2D, 'font' | 'measureText'> | null;
}

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MeasuredInlineToken {
  kind: 'word' | 'badge' | 'punct';
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  epistemicKind?: EpistemicKind;
}

export interface MeasuredEpistemicBlock {
  lines: Array<{
    y: number;
    tokens: MeasuredInlineToken[];
  }>;
  height: number;
}

export interface MeasuredPillBox extends LayoutBox {
  text: string;
  color: string;
  font: string;
  textX: number;
  centerY: number;
}

/**
 * PASS 1 OUTPUT: Pohon Tata Letak Terukur (Measured Layout Tree)
 */
export interface MeasuredThesisLayout {
  variant: ThesisOverlayVariant;
  scaleX: number;
  scaleY: number;
  palette: ThesisSurfacePalette;
  model: ThesisPresentationModel;
  outerBox: LayoutBox;
  contentLeft: number;
  contentW: number;
  header: {
    box: LayoutBox;
    centerY: number;
    showGripDots: boolean;
    gripX: number;
    badges: Array<
      LayoutBox & {
        text: string;
        textColor: string;
        bgColor: string;
        borderColor: string;
        font: string;
        textX: number;
      }
    >;
    rightEntry?: {
      priceText: string;
      priceX: number;
      priceFont: string;
      labelText: string;
      labelX: number;
      labelFont: string;
      centerY: number;
    };
    dividerY?: number;
  };
  definitionBox?: LayoutBox & {
    lines: string[];
    lineHeight: number;
    font: string;
    textStartX: number;
    firstLineY: number;
  };
  entryBlock: {
    headerY: number;
    headerTitle: string;
    headerFont: string;
    rightPriceText?: string;
    rightPriceX?: number;
    entryPills: MeasuredPillBox[];
    zoneAndTfPills: MeasuredPillBox[];
    reasonBlock?: MeasuredEpistemicBlock;
    dividerY: number;
  };
  invalidationBlock: {
    headerY: number;
    headerTitle: string;
    headerFont: string;
    slBadgeBox: LayoutBox & { text: string; font: string; textX: number };
    slPriceText: string;
    slPriceX: number;
    slPriceFont: string;
    reasonBlock?: MeasuredEpistemicBlock;
    invalidationBox?: LayoutBox & {
      badgeBox: LayoutBox & { text: string; font: string; textX: number; textY: number };
      contentBlock: MeasuredEpistemicBlock;
    };
    dividerY: number;
  };
  targetsBlock?: {
    headerY: number;
    headerTitle: string;
    headerFont: string;
    items: Array<{
      box: LayoutBox;
      headerCenterY: number;
      tpBadgeBox: LayoutBox & { text: string; font: string; textX: number };
      priceText: string;
      priceX: number;
      priceFont: string;
      rBadgeBox?: LayoutBox & {
        text: string;
        font: string;
        textX: number;
        color: string;
        bgColor: string;
        borderColor?: string;
      };
      reasonBlock?: MeasuredEpistemicBlock;
    }>;
  };
  riskBlock?: {
    dividerY?: number;
    riskRowY?: number;
    riskLabelFont: string;
    riskLeftText: string;
    riskRightText?: string;
    riskRightFont?: string;
    riskRightX?: number;
    probNotesBlock?: MeasuredEpistemicBlock;
  };
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
    let r = 0,
      g = 0,
      b = 0;
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
 * Menggambar rounded rectangle pada context 2D secara adaptif
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D | any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | { tl?: number; tr?: number; br?: number; bl?: number }
): void {
  const radius =
    typeof r === 'number'
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
function drawGripDots(
  ctx: CanvasRenderingContext2D | any,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  color: string = '#64748b'
): void {
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
 * Memecah teks menjadi baris-baris alami berdasarkan lebar maksimum kanvas
 */
function wrapPlainLines(
  measureCtx: Pick<CanvasRenderingContext2D, 'font' | 'measureText'> | null | undefined,
  text: string,
  maxWidth: number,
  charFallbackWidth: number
): string[] {
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
      const testWidth =
        measureCtx && typeof measureCtx.measureText === 'function'
          ? measureCtx.measureText(testLine).width
          : testLine.length * charFallbackWidth;
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
 * 1. Memecah teks narasi menjadi segmen token epistemik ([FAKTA], [INFERENSI], [SPEKULASI])
 * yang aman dari XSS untuk komponen Svelte (tanpa `@html`) dan terstruktur untuk Canvas2D.
 */
export function tokenizeEpistemicText(text?: string | null): EpistemicTextSegment[] {
  if (!text) return [];
  const trimmed = text.replace(/<[^>]+>/g, '').trim();
  if (!trimmed) return [];

  // Tangkap tag [FAKTA], [INFERENSI], [SPEKULASI] (beserta tanda baca di belakangnya bila menempel)
  const regex = /(\[(?:FAKTA|INFERENSI|SPEKULASI)\])([.,;:!?)]*)/gi;
  const segments: EpistemicTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(trimmed)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: trimmed.slice(lastIndex, match.index)
      });
    }
    const rawTag = match[1].toUpperCase();
    const trailingPunct = match[2] || undefined;
    const kind: EpistemicKind = rawTag.includes('FAKTA')
      ? 'fakta'
      : rawTag.includes('INFERENSI')
        ? 'inferensi'
        : 'spekulasi';
    const label =
      kind === 'fakta' ? '[FAKTA]' : kind === 'inferensi' ? '[INFERENSI]' : '[SPEKULASI]';

    segments.push({
      type: 'badge',
      kind,
      label,
      trailingPunct
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < trimmed.length) {
    segments.push({
      type: 'text',
      content: trimmed.slice(lastIndex)
    });
  }

  return segments;
}

/**
 * 2. Menurunkan palet permukaan adaptif dari Chart Canvas Theme sesuai ADR-0019.
 * Mencegah tabrakan warna (putih di atas putih) ketika tema kustom memiliki foreground terang.
 */
export function deriveThesisSurfacePalette(
  themeConfig?: ThemeConfig,
  bias: 'bullish' | 'bearish' = 'bullish',
  variant: ThesisOverlayVariant = 'floating-card'
): ThesisSurfacePalette {
  const activeTheme = themeConfig || THEME_PRESETS.signature;
  const tokens = activeTheme.tokens;
  const chartTokens = activeTheme.chart;

  const chartBg = chartTokens.background || tokens.bgDarkest || '#0F0F0F';
  const isDarkChart = isDarkColor(chartBg);
  const candidateSurface = tokens.bgSecondary || tokens.bgContainer || '#161616';
  const safeSurface =
    isDarkColor(candidateSurface) === isDarkChart
      ? candidateSurface
      : deriveSurfaceColor(chartBg, 0.07);

  const surfaceOpacity = variant === 'side-panel' ? 0.96 : 0.94;
  const surfaceBg = colorToRgba(safeSurface, surfaceOpacity);
  const borderSubtle = tokens.borderSubtle || '#222222';
  const textPrimary = ensureReadableTextColor(
    safeSurface,
    tokens.textPrimary || tokens.textMain || '#F7F7F7'
  );
  const textMuted =
    tokens.textMuted && isDarkColor(tokens.textMuted) !== isDarkChart
      ? tokens.textMuted
      : colorToRgba(textPrimary, 0.68);

  const bullColor = tokens.bullColor || chartTokens.upColor || '#F7F7F7';
  const bearColor = tokens.bearColor || chartTokens.downColor || '#FF69B4';
  const biasColor = bias === 'bearish' ? bearColor : bullColor;
  const brandCyan = tokens.brandCyan || '#38BDF8';
  const itemBg = colorToRgba(tokens.bgDarkest || '#0F0F0F', variant === 'side-panel' ? 0.45 : 0.4);

  return {
    surfaceBg,
    surfaceBorder: borderSubtle,
    itemBg,
    textPrimary,
    textMuted,
    bullColor,
    bearColor,
    biasColor,
    brandCyan,
    dangerColor: '#ef4444',
    warningColor: '#facc15',
    purpleColor: '#c084fc',
    epistemic: {
      fakta: {
        text: '#38BDF8',
        bg: 'rgba(56, 189, 248, 0.16)',
        border: 'rgba(56, 189, 248, 0.35)'
      },
      inferensi: {
        text: '#FACC15',
        bg: 'rgba(250, 204, 21, 0.16)',
        border: 'rgba(250, 204, 21, 0.35)'
      },
      spekulasi: {
        text: '#FB923C',
        bg: 'rgba(251, 146, 60, 0.16)',
        border: 'rgba(251, 146, 60, 0.35)'
      }
    }
  };
}

/**
 * 3. PASS 0: Membangun View-Model terstruktur (`ThesisPresentationModel`) sebagai Single Source of Truth
 * baik untuk `FloatingThesisCard.svelte` maupun kedua varian Canvas2D (`floating-card` & `side-panel`).
 */
export function buildThesisPresentationModel(
  plan: ParsedTradingPlan,
  options?: BuildThesisModelOptions
): ThesisPresentationModel {
  const variant = options?.variant ?? 'floating-card';
  const isBearish = plan.bias === 'bearish';
  const bias = isBearish ? 'bearish' : 'bullish';
  const palette = deriveThesisSurfacePalette(options?.themeConfig, bias, variant);
  const fmt = (p: number | null | undefined): string => {
    if (options?.formatPrice) {
      return options.formatPrice(p ?? null);
    }
    return formatPlanPrice(p ?? undefined);
  };

  let probabilityBadge: { fullText: string; shortText: string } | undefined;
  if (plan.conclusion?.probability) {
    const rawProb = String(plan.conclusion.probability);
    const shortProbMatch = rawProb.match(
      /^(Sangat Tinggi(?:\s*\([A-Z0-9+-]+\))?|Tinggi|Medium-High|High|Medium|Low|A\+|A|B\+|B)/i
    );
    const shortText = shortProbMatch
      ? shortProbMatch[0]
      : rawProb.length > 22
        ? rawProb.substring(0, 20) + '…'
        : rawProb;
    probabilityBadge = {
      fullText: rawProb,
      shortText
    };
  }

  const setupStatusBadge = plan.setupStatus ? String(plan.setupStatus) : undefined;

  let confluenceBadge:
    | { shortText: string; fullText: string; score: number; max: number }
    | undefined;
  if (plan.confluenceScore) {
    const { score, max } = plan.confluenceScore;
    confluenceBadge = {
      shortText: `${score}/${max}`,
      fullText: `Skor ${score}/${max}`,
      score,
      max
    };
  }

  const collapsedSubtitle = plan.conclusion?.probability
    ? `(${plan.conclusion.probability})`
    : `${plan.targets?.length || 0} Target`;

  const dualEntries: ThesisPresentationModel['entrySection']['dualEntries'] = [];
  if (Array.isArray(plan.entries) && plan.entries.length > 0) {
    for (const e of plan.entries) {
      const formattedPrice = fmt(e.price);
      const weightText =
        typeof e.weight === 'number' ? `(${Math.round(e.weight * 100)}%)` : undefined;
      const pillText = `${e.label}: ${formattedPrice}${weightText ? ` ${weightText}` : ''}`;
      dualEntries.push({
        id: e.id,
        label: e.label,
        formattedPrice,
        weightText,
        pillText,
        style: e.style || 'neutral'
      });
    }
  }

  const tfMatches = Array.from(
    new Set(
      (plan.reasons?.entry || '').match(
        /\b(?:1m|3m|5m|15m|30m|45m|1h|2h|4h|1d|daily|weekly|m5|m15|h1|h4)\b/gi
      ) || []
    )
  ).map((tf) => `TF ${tf.toUpperCase()}`);

  const contextZones: ThesisPresentationModel['entrySection']['contextZones'] = [];
  if (Array.isArray(plan.contextZones) && plan.contextZones.length > 0) {
    for (const zone of plan.contextZones) {
      const pol = zone.polarity || inferZonePolarity(zone.label);
      const polarity: PolarityTone =
        pol === 'bull' ? 'bullish' : pol === 'bear' ? 'bearish' : 'neutral';
      const label = zone.label || 'FVG';
      const formattedRange = `${label}: ${fmt(zone.low)} - ${fmt(zone.high)}`;
      contextZones.push({
        label,
        formattedRange,
        polarity
      });
    }
  }

  const entryReasonSegments = tokenizeEpistemicText(plan.reasons?.entry);
  const slReasonSegments = tokenizeEpistemicText(plan.reasons?.stopLoss);

  const invalidationBox = plan.conclusion?.invalidationScenario
    ? {
        badgeLabel: 'SKENARIO BATAL' as const,
        segments: tokenizeEpistemicText(plan.conclusion.invalidationScenario)
      }
    : undefined;

  const targetItems: ThesisPresentationModel['targetsSection']['items'] = [];
  const rawTargets = Array.isArray(plan.targets) ? plan.targets : [];
  for (let i = 0; i < rawTargets.length; i++) {
    const tgt = rawTargets[i];
    const badge = `TP${i + 1}`;
    const colonBadge = `TP${i + 1}:`;
    const formattedPrice = fmt(tgt.price);
    const targetKey = `tp${i + 1}`;
    const rawReason = plan.reasons?.[targetKey] || tgt.reason;

    let rBadge: ThesisPresentationModel['targetsSection']['items'][number]['rBadge'];
    if (typeof tgt.rMultiple === 'number' && !isNaN(tgt.rMultiple)) {
      const isNegative = tgt.rMultiple < 0;
      const sign = tgt.rMultiple >= 0 ? '+' : '';
      const primaryText = `${sign}${tgt.rMultiple.toFixed(2)}R`;
      const e1Val = tgt.rMultipleByEntry?.e1;
      const e1SubText =
        typeof e1Val === 'number' && !isNaN(e1Val) ? `(${e1Val}R E1)` : undefined;
      const combinedText = e1SubText ? `${primaryText} ${e1SubText}` : primaryText;
      rBadge = {
        primaryText,
        e1SubText,
        combinedText,
        isNegative
      };
    }

    targetItems.push({
      badge,
      colonBadge,
      formattedPrice,
      rBadge,
      reasonSegments: tokenizeEpistemicText(rawReason)
    });
  }

  let riskFooter: ThesisPresentationModel['riskFooter'];
  const probNotesSegments = tokenizeEpistemicText(plan.conclusion?.probabilityNotes);
  if (plan.riskAmount || probNotesSegments.length > 0) {
    const formattedRiskAmount = plan.riskAmount ? fmt(plan.riskAmount) : undefined;
    const riskPercentText =
      typeof plan.riskPercent === 'number' && !isNaN(plan.riskPercent)
        ? `(${plan.riskPercent}%)`
        : undefined;
    const combinedRiskValue = formattedRiskAmount
      ? riskPercentText
        ? `${formattedRiskAmount} ${riskPercentText}`
        : formattedRiskAmount
      : undefined;

    riskFooter = {
      formattedRiskAmount,
      riskPercentText,
      combinedRiskValue,
      probabilityNotesSegments: probNotesSegments
    };
  }

  return {
    variant,
    isBearish,
    palette,
    header: {
      biasLabel: isBearish ? 'BEARISH' : 'BULLISH',
      probabilityBadge,
      setupStatusBadge,
      confluenceBadge,
      collapsedSubtitle,
      rightEntrySummary: {
        label: 'Entry',
        formattedPrice: fmt(plan.entry)
      }
    },
    definition: plan.definition || undefined,
    entrySection: {
      title: dualEntries.length > 0 ? 'BLENDED ENTRY' : 'KATALIS ENTRY',
      formattedPrimaryPrice: fmt(plan.entry),
      dualEntries,
      timeframePills: tfMatches,
      contextZones,
      reasonSegments: entryReasonSegments
    },
    invalidationSection: {
      title: 'INVALIDASI & STOP LOSS',
      formattedStopLoss: fmt(plan.stopLoss),
      rBadge: '-1.00R',
      reasonSegments: slReasonSegments,
      invalidationBox
    },
    targetsSection: {
      title: `TARGET LIKUIDITAS (${targetItems.length})`,
      count: targetItems.length,
      items: targetItems
    },
    riskFooter
  };
}

/**
 * Mengukur blok teks yang mengandung campuran kata biasa dan lencana epistemik ([FAKTA], [INFERENSI], [SPEKULASI])
 * pada lebar maksimum tertentu. Digunakan di Pass 1 sehingga tinggi teks dan posisi setiap token terkunci.
 */
function measureEpistemicBlock(
  measureCtx: Pick<CanvasRenderingContext2D, 'font' | 'measureText'> | null | undefined,
  text: string | undefined,
  startX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  scale: number
): MeasuredEpistemicBlock {
  if (!text) return { lines: [], height: 0 };
  const clean = text.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/_/g, '').trim();
  if (!clean) return { lines: [], height: 0 };

  const paragraphs = clean.split('\n');
  let currentY = startY;
  const initialY = startY;
  const lines: MeasuredEpistemicBlock['lines'] = [];

  const bodyFontSize = Math.max(9, Math.round(9 * scale));
  const badgeFontSize = Math.max(8, Math.round(7.5 * scale));
  const bodyFont = `400 ${bodyFontSize}px "Plus Jakarta Sans", sans-serif`;
  const badgeFont = `bold ${badgeFontSize}px "JetBrains Mono", monospace, sans-serif`;

  const measureW = (str: string, font: string, charFactor: number): number => {
    if (measureCtx && typeof measureCtx.measureText === 'function') {
      measureCtx.font = font;
      return measureCtx.measureText(str).width;
    }
    return str.length * charFactor * scale;
  };

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    const words = trimmedPara.split(/\s+/);
    let currentX = startX;
    let currentLineTokens: MeasuredInlineToken[] = [];

    for (const word of words) {
      const isFakta = /\[?FAKTA\]?/i.test(word);
      const isInferensi = /\[?INFERENSI\]?/i.test(word);
      const isSpekulasi = /\[?SPEKULASI\]?/i.test(word);

      if (isFakta || isInferensi || isSpekulasi) {
        const epistemicKind: EpistemicKind = isFakta
          ? 'fakta'
          : isInferensi
            ? 'inferensi'
            : 'spekulasi';
        const badgeText = isFakta ? '[FAKTA]' : isInferensi ? '[INFERENSI]' : '[SPEKULASI]';
        const badgeTextW = measureW(badgeText, badgeFont, 6);
        const badgeW = badgeTextW + Math.round(8 * scale);
        const badgeH = Math.round(14 * scale);

        if (currentX + badgeW > startX + maxWidth && currentX > startX) {
          lines.push({ y: currentY, tokens: currentLineTokens });
          currentLineTokens = [];
          currentX = startX;
          currentY += lineHeight;
        }

        currentLineTokens.push({
          kind: 'badge',
          text: badgeText,
          x: currentX,
          y: currentY,
          w: badgeW,
          h: badgeH,
          epistemicKind
        });

        currentX += badgeW + Math.round(5 * scale);

        const trailingPunct = word.replace(/^[[(]?(?:FAKTA|INFERENSI|SPEKULASI)[\])]?/i, '');
        if (trailingPunct) {
          const punctW = measureW(trailingPunct, bodyFont, 5);
          currentLineTokens.push({
            kind: 'punct',
            text: trailingPunct,
            x: currentX,
            y: currentY,
            w: punctW,
            h: lineHeight
          });
          currentX += punctW + Math.round(4 * scale);
        }
      } else {
        const wordW = measureW(word, bodyFont, 5.5);
        if (currentX + wordW > startX + maxWidth && currentX > startX) {
          lines.push({ y: currentY, tokens: currentLineTokens });
          currentLineTokens = [];
          currentX = startX;
          currentY += lineHeight;
        }

        currentLineTokens.push({
          kind: 'word',
          text: word,
          x: currentX,
          y: currentY,
          w: wordW,
          h: lineHeight
        });

        currentX += wordW + Math.round(4 * scale);
      }
    }

    if (currentLineTokens.length > 0) {
      lines.push({ y: currentY, tokens: currentLineTokens });
    }
    currentY += lineHeight;
  }

  return {
    lines,
    height: currentY - initialY
  };
}

/**
 * 4. PASS 1 (MEASURE): Menghitung seluruh geometri kotak, pembungkusan baris pil (Dual-Entry E1/E2, TF, FVG),
 * serta pembungkusan baris teks epistemik TANPA menggambar ke kanvas.
 * Menghasilkan `outerBox.h` yang 100% akurat (0px height drift).
 */
export function measureThesisOverlayLayout(
  plan: ParsedTradingPlan | null | undefined,
  options?: ThesisCanvasLayoutOptions
): MeasuredThesisLayout {
  const variant = options?.variant ?? 'floating-card';
  const scaleX = options?.scaleX ?? 1;
  const scaleY = options?.scaleY ?? scaleX;
  const coordsAreScaled = options?.coordsAreScaled ?? variant === 'side-panel';

  const rawX = options?.x ?? (variant === 'side-panel' ? 0 : 16);
  const rawY = options?.y ?? (variant === 'side-panel' ? 0 : 56);
  const rawW = options?.width ?? (variant === 'side-panel' ? 380 : 340);
  const rawMinH = options?.height;

  const boxX = coordsAreScaled ? Math.round(rawX) : Math.round(rawX * scaleX);
  const boxY = coordsAreScaled ? Math.round(rawY) : Math.round(rawY * scaleY);
  const boxW = coordsAreScaled ? Math.round(rawW) : Math.round(rawW * scaleX);
  const minBoxH =
    typeof rawMinH === 'number'
      ? coordsAreScaled
        ? Math.round(rawMinH)
        : Math.round(rawMinH * scaleY)
      : undefined;

  const emptyPlan: ParsedTradingPlan = plan || {
    bias: 'bullish',
    entry: 0,
    stopLoss: 0,
    targets: [],
    reasons: {},
    rawText: '',
    validation: { valid: false, errors: [] }
  };

  const model = buildThesisPresentationModel(emptyPlan, {
    variant,
    themeConfig: options?.themeConfig,
    formatPrice: options?.formatPrice
  });
  const palette = model.palette;
  const measureCtx = options?.measureCtx;

  const measureTextW = (str: string, font: string, fallbackCharPx: number): number => {
    if (measureCtx && typeof measureCtx.measureText === 'function') {
      measureCtx.font = font;
      return measureCtx.measureText(str).width;
    }
    return str.length * fallbackCharPx;
  };

  if (!plan) {
    return {
      variant,
      scaleX,
      scaleY,
      palette,
      model,
      outerBox: { x: boxX, y: boxY, w: boxW, h: 0 },
      contentLeft: boxX,
      contentW: boxW,
      header: {
        box: { x: boxX, y: boxY, w: boxW, h: 0 },
        centerY: boxY,
        showGripDots: false,
        gripX: boxX,
        badges: []
      },
      entryBlock: {
        headerY: boxY,
        headerTitle: '',
        headerFont: '',
        entryPills: [],
        zoneAndTfPills: [],
        dividerY: boxY
      },
      invalidationBlock: {
        headerY: boxY,
        headerTitle: '',
        headerFont: '',
        slBadgeBox: { x: boxX, y: boxY, w: 0, h: 0, text: '', font: '', textX: boxX },
        slPriceText: '',
        slPriceX: boxX,
        slPriceFont: '',
        dividerY: boxY
      }
    };
  }

  const isSidePanel = variant === 'side-panel';
  const padX = Math.round((isSidePanel ? 14 : 12) * scaleX);
  const padY = Math.round((isSidePanel ? 14 : 0) * scaleY);
  const contentLeft = boxX + padX;
  const contentW = Math.max(120, boxW - padX * 2);

  // --- HEADER ---
  const headerH = Math.round((isSidePanel ? 30 : 28) * scaleY);
  const headerTopY = isSidePanel ? boxY + padY : boxY;
  const headerCenterY = headerTopY + headerH / 2;

  const headerBadges: MeasuredThesisLayout['header']['badges'] = [];
  let cursorX = isSidePanel ? contentLeft : boxX + Math.round(24 * scaleX);
  const badgeH = Math.round((isSidePanel ? 20 : 16) * scaleY);
  const badgePad = Math.round((isSidePanel ? 12 : 8) * scaleX);
  const biasFont = `bold ${Math.round((isSidePanel ? 10 : 9) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;

  const biasTextW = measureTextW(
    model.header.biasLabel,
    biasFont,
    (isSidePanel ? 7 : 6) * scaleX
  );
  const biasW = biasTextW + badgePad;
  headerBadges.push({
    x: cursorX,
    y: headerCenterY - badgeH / 2,
    w: biasW,
    h: badgeH,
    text: model.header.biasLabel,
    textColor: palette.biasColor,
    bgColor: colorToRgba(palette.biasColor, isSidePanel ? 0.18 : 0.2),
    borderColor: palette.biasColor,
    font: biasFont,
    textX: cursorX + badgePad / 2
  });
  cursorX += biasW + Math.round(8 * scaleX);

  // Di side-panel, hitung ruang kanan untuk "Entry <harga>" agar badge tengah tidak menabrak
  let rightEntry: MeasuredThesisLayout['header']['rightEntry'];
  let maxHeaderBadgeRight = boxX + boxW - padX;
  if (isSidePanel) {
    const entryPriceStr = model.header.rightEntrySummary.formattedPrice;
    const priceFont = `bold ${Math.round(11 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    const rawPriceW = measureTextW(entryPriceStr, priceFont, 7.2 * scaleX);
    const entryPriceW = Math.max(rawPriceW, entryPriceStr.length * Math.round(7.2 * scaleX));
    const labelFont = `500 ${Math.round(9 * scaleY)}px "Plus Jakarta Sans", sans-serif`;
    const gapBetween = Math.round(8 * scaleX);
    const rightMargin = Math.round(2 * scaleX);
    const rightEdgeX = contentLeft + contentW - rightMargin;
    const labelRightX = rightEdgeX - entryPriceW - gapBetween;

    rightEntry = {
      priceText: entryPriceStr,
      priceX: rightEdgeX,
      priceFont,
      labelText: 'Entry',
      labelX: labelRightX,
      labelFont,
      centerY: headerCenterY
    };
    const labelW = measureTextW('Entry', labelFont, 5.5 * scaleX);
    maxHeaderBadgeRight = labelRightX - labelW - Math.round(6 * scaleX);
  }

  let badgeRowCenterY = headerCenterY;
  let badgeRowCount = 1;

  const pushHeaderBadge = (
    text: string,
    font: string,
    pad: number,
    charFactor: number,
    textColor: string,
    bgColor: string,
    borderColor: string,
    allowRightHalfOnWrap: boolean
  ) => {
    const textW = measureTextW(text, font, charFactor * scaleX);
    const w = textW + pad;
    const rowLimitRight =
      badgeRowCount === 1 ? maxHeaderBadgeRight : boxX + boxW - padX;

    if (cursorX + w > rowLimitRight && cursorX > contentLeft) {
      badgeRowCount += 1;
      badgeRowCenterY += badgeH + Math.round(4 * scaleY);
      cursorX = isSidePanel ? contentLeft : boxX + Math.round(24 * scaleX);
    }

    if (!isSidePanel || allowRightHalfOnWrap || cursorX + w <= rowLimitRight) {
      headerBadges.push({
        x: cursorX,
        y: badgeRowCenterY - badgeH / 2,
        w,
        h: badgeH,
        text,
        textColor,
        bgColor,
        borderColor,
        font,
        textX: cursorX + pad / 2
      });
      cursorX += w + Math.round(6 * scaleX);
    }
  };

  if (model.header.probabilityBadge) {
    const probText = isSidePanel
      ? model.header.probabilityBadge.shortText
      : model.header.probabilityBadge.fullText;
    const probFont = isSidePanel
      ? `600 ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`
      : biasFont;
    const probPad = isSidePanel ? Math.round(10 * scaleX) : badgePad;
    pushHeaderBadge(
      probText,
      probFont,
      probPad,
      6,
      palette.brandCyan,
      colorToRgba(palette.brandCyan, isSidePanel ? 0.16 : 0.18),
      colorToRgba(palette.brandCyan, isSidePanel ? 0.35 : 0.4),
      false
    );
  }

  if (model.header.setupStatusBadge) {
    const statusText = model.header.setupStatusBadge;
    const statusFont = `bold ${Math.round(8.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    const statusPad = Math.round(8 * scaleX);
    pushHeaderBadge(
      statusText,
      statusFont,
      statusPad,
      5.8,
      palette.warningColor,
      'rgba(250, 204, 21, 0.16)',
      'rgba(250, 204, 21, 0.4)',
      true
    );
  }

  if (model.header.confluenceBadge) {
    const confText = isSidePanel
      ? model.header.confluenceBadge.shortText
      : model.header.confluenceBadge.fullText;
    const confFont = `bold ${Math.round(8.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    const confPad = Math.round(8 * scaleX);
    pushHeaderBadge(
      confText,
      confFont,
      confPad,
      5.8,
      palette.purpleColor,
      'rgba(168, 85, 247, 0.16)',
      'rgba(168, 85, 247, 0.4)',
      true
    );
  }

  const effectiveHeaderH =
    headerH + (badgeRowCount - 1) * (badgeH + Math.round(4 * scaleY));
  let currentY = isSidePanel
    ? headerTopY + effectiveHeaderH + Math.round(8 * scaleY)
    : boxY + effectiveHeaderH + Math.round(12 * scaleY);

  let headerDividerY: number | undefined;
  if (isSidePanel) {
    headerDividerY = currentY;
    currentY += Math.round(10 * scaleY);
  }

  const bodyLineHeight = Math.round((isSidePanel ? 15 : 13) * scaleY);
  const subFontSize = Math.max(8, Math.round((isSidePanel ? 9 : 8.5) * scaleY));

  // --- DEFINITION BANNER ---
  let definitionBox: MeasuredThesisLayout['definitionBox'];
  if (model.definition) {
    const defFont = `italic ${subFontSize}px "Plus Jakarta Sans", sans-serif`;
    if (measureCtx) measureCtx.font = defFont;
    const defLines = wrapPlainLines(
      measureCtx,
      model.definition,
      contentW - Math.round((isSidePanel ? 16 : 14) * scaleX),
      5.5 * scaleX
    );
    const defLineH = isSidePanel ? Math.round(14 * scaleY) : bodyLineHeight;
    const defBoxH = defLines.length * defLineH + Math.round((isSidePanel ? 12 : 8) * scaleY);

    definitionBox = {
      x: contentLeft,
      y: currentY,
      w: contentW,
      h: defBoxH,
      lines: defLines,
      lineHeight: defLineH,
      font: defFont,
      textStartX: contentLeft + Math.round(8 * scaleX),
      firstLineY: currentY + Math.round((isSidePanel ? 10 : 8) * scaleY)
    };
    currentY += defBoxH + Math.round(10 * scaleY);
  }

  // --- SEKSI 1: KATALIS ENTRY / BLENDED ENTRY ---
  const sectionFontSize = Math.round((isSidePanel ? 10 : 9.5) * scaleY);
  const sectionHeaderFont = `bold ${sectionFontSize}px "JetBrains Mono", monospace, sans-serif`;
  const entryHeaderTitle = `⚡ ${model.entrySection.title}`;
  const entryHeaderY = currentY;

  const entryRightPriceText = !isSidePanel ? model.entrySection.formattedPrimaryPrice : undefined;
  const entryRightPriceX = !isSidePanel ? contentLeft + contentW : undefined;
  currentY += Math.round(14 * scaleY);

  // 1a. Dual-Entry Pills (E1 / E2 + bobot %) — kini dirender baik di floating-card maupun side-panel!
  const entryPills: MeasuredPillBox[] = [];
  if (model.entrySection.dualEntries.length > 0) {
    let ePillX = contentLeft;
    const pillFont = `600 ${Math.round((isSidePanel ? 8.5 : 8) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    const pillH = Math.round((isSidePanel ? 15 : 14) * scaleY);

    for (const e of model.entrySection.dualEntries) {
      const textW = measureTextW(e.pillText, pillFont, 6 * scaleX);
      const pillW = textW + Math.round(10 * scaleX);

      if (ePillX + pillW > contentLeft + contentW && ePillX > contentLeft) {
        ePillX = contentLeft;
        currentY += pillH + Math.round(4 * scaleY);
      }

      const eColor = e.style === 'aggressive' ? '#fbbf24' : '#38bdf8';
      entryPills.push({
        x: ePillX,
        y: currentY - pillH / 2,
        w: pillW,
        h: pillH,
        text: e.pillText,
        color: eColor,
        font: pillFont,
        textX: ePillX + Math.round(5 * scaleX),
        centerY: currentY
      });
      ePillX += pillW + Math.round(5 * scaleX);
    }
    currentY += Math.round((isSidePanel ? 13 : 12) * scaleY);
  }

  // 1b. Timeframe Pills (pada side-panel) & Context Zone Pills (FVG/OB dengan Zone Polarity)
  const zoneAndTfPills: MeasuredPillBox[] = [];
  const combinedZoneList: Array<{ text: string; color: string; font: string }> = [];

  if (isSidePanel && model.entrySection.timeframePills.length > 0) {
    const tfFont = `600 ${Math.round(8.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    for (const tfText of model.entrySection.timeframePills) {
      combinedZoneList.push({
        text: tfText,
        color: palette.brandCyan,
        font: tfFont
      });
    }
  }

  if (model.entrySection.contextZones.length > 0) {
    const zFont = `${isSidePanel ? '600' : '500'} ${Math.round((isSidePanel ? 8.5 : 8) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    for (const z of model.entrySection.contextZones) {
      const zColor =
        z.polarity === 'bullish'
          ? palette.bullColor
          : z.polarity === 'bearish'
            ? palette.bearColor
            : '#94a3b8';
      combinedZoneList.push({
        text: z.formattedRange,
        color: zColor,
        font: zFont
      });
    }
  }

  if (combinedZoneList.length > 0) {
    let pillX = contentLeft;
    const pillH = Math.round((isSidePanel ? 16 : 14) * scaleY);
    for (const item of combinedZoneList) {
      const textW = measureTextW(item.text, item.font, 6 * scaleX);
      const pillW = textW + Math.round(10 * scaleX);
      if (pillX + pillW > contentLeft + contentW && pillX > contentLeft) {
        pillX = contentLeft;
        currentY += pillH + Math.round(4 * scaleY);
      }
      zoneAndTfPills.push({
        x: pillX,
        y: currentY - pillH / 2,
        w: pillW,
        h: pillH,
        text: item.text,
        color: item.color,
        font: item.font,
        textX: pillX + Math.round(5 * scaleX),
        centerY: currentY
      });
      pillX += pillW + Math.round((isSidePanel ? 6 : 5) * scaleX);
    }
    currentY += Math.round((isSidePanel ? 14 : 12) * scaleY);
  }

  // 1c. Alasan Entry dengan Lencana Epistemik ([FAKTA], [INFERENSI], [SPEKULASI])
  let entryReasonBlock: MeasuredEpistemicBlock | undefined;
  if (plan.reasons?.entry) {
    entryReasonBlock = measureEpistemicBlock(
      measureCtx,
      plan.reasons.entry,
      contentLeft,
      currentY + Math.round(4 * scaleY),
      contentW,
      bodyLineHeight,
      scaleY
    );
    currentY += entryReasonBlock.height + Math.round(6 * scaleY);
  }

  const entryDividerY = currentY;
  currentY += Math.round(10 * scaleY);

  // --- SEKSI 2: INVALIDASI & STOP LOSS ---
  const invHeaderY = currentY;
  const invHeaderTitle = `🛡️ ${model.invalidationSection.title}`;
  const slRStr = model.invalidationSection.rBadge;
  const slBadgeFont = `bold ${Math.round((isSidePanel ? 8.5 : 8) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  const slRW =
    measureTextW(slRStr, slBadgeFont, 5.8 * scaleX) + Math.round((isSidePanel ? 8 : 6) * scaleX);
  const slRX = contentLeft + contentW - slRW;
  const slBadgeH = Math.round((isSidePanel ? 15 : 13) * scaleY);

  const slBadgeBox = {
    x: slRX,
    y: invHeaderY - Math.round((isSidePanel ? 7 : 6) * scaleY),
    w: slRW,
    h: slBadgeH,
    text: slRStr,
    font: slBadgeFont,
    textX: slRX + Math.round((isSidePanel ? 4 : 3) * scaleX)
  };

  const slPriceFont = `bold ${Math.round((isSidePanel ? 10.5 : 9.5) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
  const slPriceX = slRX - Math.round(6 * scaleX);

  currentY += Math.round(14 * scaleY);

  let slReasonBlock: MeasuredEpistemicBlock | undefined;
  if (plan.reasons?.stopLoss) {
    slReasonBlock = measureEpistemicBlock(
      measureCtx,
      plan.reasons.stopLoss,
      contentLeft,
      currentY + Math.round(4 * scaleY),
      contentW,
      bodyLineHeight,
      scaleY
    );
    currentY += slReasonBlock.height + Math.round(6 * scaleY);
  }

  let invalidationBoxLayout: MeasuredThesisLayout['invalidationBlock']['invalidationBox'];
  if (plan.conclusion?.invalidationScenario) {
    const invText = plan.conclusion.invalidationScenario;
    const invLineH = Math.round((isSidePanel ? 14 : 13) * scaleY);
    const innerPadX = Math.round((isSidePanel ? 8 : 6) * scaleX);
    const contentBlock = measureEpistemicBlock(
      measureCtx,
      invText,
      contentLeft + innerPadX,
      currentY + Math.round((isSidePanel ? 25 : 21) * scaleY),
      contentW - innerPadX * 2,
      invLineH,
      scaleY
    );
    const invBoxH = contentBlock.height + Math.round((isSidePanel ? 24 : 20) * scaleY);

    const invBadgeFont = `bold ${Math.round((isSidePanel ? 8 : 7.5) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    const invBadgeW =
      measureTextW('SKENARIO BATAL', invBadgeFont, 5.5 * scaleX) + Math.round(8 * scaleX);
    const invBadgeH = Math.round((isSidePanel ? 13 : 12) * scaleY);

    invalidationBoxLayout = {
      x: contentLeft,
      y: currentY,
      w: contentW,
      h: invBoxH,
      badgeBox: {
        x: contentLeft + Math.round(6 * scaleX),
        y: currentY + Math.round((isSidePanel ? 5 : 4) * scaleY),
        w: invBadgeW,
        h: invBadgeH,
        text: 'SKENARIO BATAL',
        font: invBadgeFont,
        textX: contentLeft + Math.round(10 * scaleX),
        textY: currentY + Math.round((isSidePanel ? 11.5 : 10) * scaleY)
      },
      contentBlock
    };

    currentY += invBoxH + Math.round(8 * scaleY);
  }

  const invDividerY = currentY;
  currentY += Math.round(10 * scaleY);

  // --- SEKSI 3: TARGET LIKUIDITAS ---
  let targetsBlock: MeasuredThesisLayout['targetsBlock'];
  if (model.targetsSection.items.length > 0) {
    const targetsHeaderY = currentY;
    const targetsHeaderTitle = `🎯 ${model.targetsSection.title}`;
    currentY += Math.round(14 * scaleY);

    const measuredItems: NonNullable<MeasuredThesisLayout['targetsBlock']>['items'] = [];
    const rawTargets = Array.isArray(plan.targets) ? plan.targets : [];

    for (let i = 0; i < model.targetsSection.items.length; i++) {
      const itemVm = model.targetsSection.items[i];
      const rawTgt = rawTargets[i];
      const targetKey = `tp${i + 1}`;
      const rawReason = plan.reasons?.[targetKey] || rawTgt?.reason;

      const headerRowH = Math.round((isSidePanel ? 24 : 20) * scaleY);
      const itemHeaderY = currentY + Math.round((isSidePanel ? 12 : 10) * scaleY);
      const reasonLineH = Math.round((isSidePanel ? 14 : 13) * scaleY);
      const innerPadX = Math.round((isSidePanel ? 8 : 6) * scaleX);

      let reasonBlock: MeasuredEpistemicBlock | undefined;
      if (rawReason) {
        reasonBlock = measureEpistemicBlock(
          measureCtx,
          rawReason,
          contentLeft + innerPadX,
          currentY + headerRowH + Math.round(2 * scaleY),
          contentW - innerPadX * 2,
          reasonLineH,
          scaleY
        );
      }

      const itemH =
        headerRowH + (reasonBlock && reasonBlock.height > 0 ? reasonBlock.height + Math.round(6 * scaleY) : 0);

      const tpBadgeText = isSidePanel ? itemVm.badge : itemVm.colonBadge;
      const tpBadgeFont = `bold ${Math.round((isSidePanel ? 9 : 8.5) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      const tpW =
        measureTextW(tpBadgeText, tpBadgeFont, 6 * scaleX) + Math.round((isSidePanel ? 8 : 6) * scaleX);
      const tpH = Math.round((isSidePanel ? 14 : 13) * scaleY);

      const tpBadgeBox = {
        x: contentLeft + Math.round((isSidePanel ? 6 : 5) * scaleX),
        y: itemHeaderY - Math.round(tpH / 2),
        w: tpW,
        h: tpH,
        text: tpBadgeText,
        font: tpBadgeFont,
        textX: contentLeft + Math.round((isSidePanel ? 10 : 8) * scaleX)
      };

      const priceFont = `bold ${Math.round((isSidePanel ? 10 : 9.5) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
      const priceX = contentLeft + tpW + Math.round((isSidePanel ? 12 : 14) * scaleX);

      let rBadgeBox: NonNullable<MeasuredThesisLayout['targetsBlock']>['items'][number]['rBadgeBox'];
      if (itemVm.rBadge) {
        const rStr = itemVm.rBadge.combinedText;
        const rColor = itemVm.rBadge.isNegative ? palette.dangerColor : palette.brandCyan;
        const rFont = `bold ${Math.round((isSidePanel ? 8.5 : 8) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
        const rPad = Math.round((isSidePanel ? 8 : 6) * scaleX);
        const rW = measureTextW(rStr, rFont, 5.8 * scaleX) + rPad;
        const rH = Math.round((isSidePanel ? 14 : 13) * scaleY);
        const rX = contentLeft + contentW - rW - Math.round((isSidePanel ? 6 : 5) * scaleX);

        rBadgeBox = {
          x: rX,
          y: itemHeaderY - Math.round(rH / 2),
          w: rW,
          h: rH,
          text: rStr,
          font: rFont,
          textX: rX + Math.round(rPad / 2),
          color: rColor,
          bgColor: colorToRgba(rColor, isSidePanel ? 0.15 : 0.12),
          borderColor: isSidePanel ? colorToRgba(rColor, 0.35) : undefined
        };
      }

      measuredItems.push({
        box: { x: contentLeft, y: currentY, w: contentW, h: itemH },
        headerCenterY: itemHeaderY,
        tpBadgeBox,
        priceText: itemVm.formattedPrice,
        priceX,
        priceFont,
        rBadgeBox,
        reasonBlock
      });

      currentY += itemH + Math.round((isSidePanel ? 6 : 5) * scaleY);
    }

    targetsBlock = {
      headerY: targetsHeaderY,
      headerTitle: targetsHeaderTitle,
      headerFont: sectionHeaderFont,
      items: measuredItems
    };
  }

  // --- SEKSI 4: UNIT RISIKO (R) & CATATAN PROBABILITAS ---
  let riskBlock: MeasuredThesisLayout['riskBlock'];
  if (model.riskFooter) {
    let riskDividerY: number | undefined;
    if (isSidePanel) {
      riskDividerY = currentY;
      currentY += Math.round(10 * scaleY);
    }

    const riskLabelFont = `500 ${Math.round((isSidePanel ? 9 : 8.5) * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
    let riskRowY: number | undefined;
    let riskLeftText = '';
    let riskRightText: string | undefined;
    let riskRightFont: string | undefined;
    let riskRightX: number | undefined;

    if (model.riskFooter.combinedRiskValue) {
      riskRowY = currentY;
      if (isSidePanel) {
        riskLeftText = 'Unit Risiko (R):';
        riskRightText = model.riskFooter.combinedRiskValue;
        riskRightFont = `bold ${Math.round(9.5 * scaleY)}px "JetBrains Mono", monospace, sans-serif`;
        riskRightX = contentLeft + contentW;
        currentY += Math.round(14 * scaleY);
      } else {
        riskLeftText = `Unit Risiko (R): ${model.riskFooter.combinedRiskValue}`;
        currentY += Math.round(12 * scaleY);
      }
    }

    let probNotesBlock: MeasuredEpistemicBlock | undefined;
    if (plan.conclusion?.probabilityNotes) {
      const probLineH = Math.round((isSidePanel ? 14 : 13) * scaleY);
      probNotesBlock = measureEpistemicBlock(
        measureCtx,
        plan.conclusion.probabilityNotes,
        contentLeft,
        currentY + Math.round(4 * scaleY),
        contentW,
        probLineH,
        scaleY
      );
      currentY += probNotesBlock.height + Math.round(4 * scaleY);
    }

    riskBlock = {
      dividerY: riskDividerY,
      riskRowY,
      riskLabelFont,
      riskLeftText,
      riskRightText,
      riskRightFont,
      riskRightX,
      probNotesBlock
    };
  }

  const bottomPad = Math.round((isSidePanel ? 14 : 10) * scaleY);
  const calculatedH = currentY - boxY + bottomPad;
  const finalBoxH =
    typeof minBoxH === 'number' && minBoxH > calculatedH ? minBoxH : calculatedH;

  return {
    variant,
    scaleX,
    scaleY,
    palette,
    model,
    outerBox: { x: boxX, y: boxY, w: boxW, h: finalBoxH },
    contentLeft,
    contentW,
    header: {
      box: { x: boxX, y: headerTopY, w: boxW, h: effectiveHeaderH },
      centerY: headerCenterY,
      showGripDots: !isSidePanel,
      gripX: boxX + Math.round(10 * scaleX),
      badges: headerBadges,
      rightEntry,
      dividerY: headerDividerY
    },
    definitionBox,
    entryBlock: {
      headerY: entryHeaderY,
      headerTitle: entryHeaderTitle,
      headerFont: sectionHeaderFont,
      rightPriceText: entryRightPriceText,
      rightPriceX: entryRightPriceX,
      entryPills,
      zoneAndTfPills,
      reasonBlock: entryReasonBlock,
      dividerY: entryDividerY
    },
    invalidationBlock: {
      headerY: invHeaderY,
      headerTitle: invHeaderTitle,
      headerFont: sectionHeaderFont,
      slBadgeBox,
      slPriceText: model.invalidationSection.formattedStopLoss,
      slPriceX,
      slPriceFont,
      reasonBlock: slReasonBlock,
      invalidationBox: invalidationBoxLayout,
      dividerY: invDividerY
    },
    targetsBlock,
    riskBlock
  };
}

/**
 * Menggambar blok teks epistemik yang sudah diukur pada Pass 1
 */
function drawMeasuredEpistemicBlock(
  ctx: CanvasRenderingContext2D | any,
  block: MeasuredEpistemicBlock,
  scale: number,
  textColor: string,
  palette: ThesisSurfacePalette
): void {
  const bodyFontSize = Math.max(9, Math.round(9 * scale));
  const badgeFontSize = Math.max(8, Math.round(7.5 * scale));
  const bodyFont = `400 ${bodyFontSize}px "Plus Jakarta Sans", sans-serif`;
  const badgeFont = `bold ${badgeFontSize}px "JetBrains Mono", monospace, sans-serif`;

  for (const line of block.lines) {
    for (const token of line.tokens) {
      if (token.kind === 'badge' && token.epistemicKind) {
        const epStyle = palette.epistemic[token.epistemicKind];
        ctx.save();
        drawRoundedRect(ctx, token.x, token.y - token.h / 2, token.w, token.h, 2 * scale);
        ctx.fillStyle = epStyle.bg;
        ctx.fill();
        ctx.strokeStyle = epStyle.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = badgeFont;
        ctx.fillStyle = epStyle.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.text, token.x + Math.round(4 * scale), token.y);
        ctx.restore();
      } else {
        ctx.save();
        ctx.font = bodyFont;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.text, token.x, token.y);
        ctx.restore();
      }
    }
  }
}

/**
 * 5. PASS 2 (DRAW): Menggambar `MeasuredThesisLayout` langsung ke Canvas2D
 * menggunakan koordinat dan tinggi yang sudah dikunci pada Pass 1.
 */
export function drawMeasuredThesisLayout(
  ctx: CanvasRenderingContext2D | any,
  layout: MeasuredThesisLayout
): void {
  if (!ctx || layout.outerBox.h <= 0) return;

  const {
    variant,
    scaleX,
    scaleY,
    palette,
    outerBox,
    contentLeft,
    contentW,
    header,
    definitionBox,
    entryBlock,
    invalidationBlock,
    targetsBlock,
    riskBlock
  } = layout;
  const isSidePanel = variant === 'side-panel';

  ctx.save();

  // 1. Background Container & Border
  const outerRadius = (isSidePanel ? 8 : 10) * scaleX;
  drawRoundedRect(ctx, outerBox.x, outerBox.y, outerBox.w, outerBox.h, outerRadius);
  ctx.fillStyle = palette.surfaceBg;
  ctx.fill();

  ctx.strokeStyle = isSidePanel
    ? colorToRgba(palette.surfaceBorder, 0.8)
    : palette.surfaceBorder;
  ctx.lineWidth = Math.max(1, Math.round((isSidePanel ? 1 : 1.5) * scaleX));
  ctx.stroke();

  // 2. Header Banner & Grip Dots (khusus floating-card)
  if (!isSidePanel) {
    drawRoundedRect(ctx, header.box.x, header.box.y, header.box.w, header.box.h, {
      tl: outerRadius,
      tr: outerRadius,
      br: 0,
      bl: 0
    });
    ctx.fillStyle = colorToRgba(palette.surfaceBorder, 0.2);
    ctx.fill();
  }

  if (header.showGripDots) {
    drawGripDots(ctx, header.gripX, header.centerY, scaleX, scaleY, palette.textMuted);
  }

  // 2a. Header Badges (Bias, Probability, Setup Status, Confluence Score)
  ctx.textBaseline = 'middle';
  for (const b of header.badges) {
    drawRoundedRect(ctx, b.x, b.y, b.w, b.h, (isSidePanel ? 4 : 3) * scaleX);
    ctx.fillStyle = b.bgColor;
    ctx.fill();
    ctx.strokeStyle = b.borderColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = b.font;
    ctx.fillStyle = b.textColor;
    ctx.textAlign = 'left';
    ctx.fillText(b.text, b.textX, b.y + b.h / 2);
  }

  // 2b. Right Entry Summary pada Header (khusus side-panel)
  if (header.rightEntry) {
    ctx.textAlign = 'right';
    ctx.font = header.rightEntry.priceFont;
    ctx.fillStyle = palette.biasColor;
    ctx.fillText(header.rightEntry.priceText, header.rightEntry.priceX, header.rightEntry.centerY);

    ctx.font = header.rightEntry.labelFont;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(header.rightEntry.labelText, header.rightEntry.labelX, header.rightEntry.centerY);
    ctx.textAlign = 'left';
  }

  if (typeof header.dividerY === 'number') {
    ctx.beginPath();
    ctx.moveTo(contentLeft, header.dividerY);
    ctx.lineTo(contentLeft + contentW, header.dividerY);
    ctx.strokeStyle = colorToRgba(palette.surfaceBorder, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 3. Definition Banner
  if (definitionBox) {
    drawRoundedRect(
      ctx,
      definitionBox.x,
      definitionBox.y,
      definitionBox.w,
      definitionBox.h,
      isSidePanel ? 4 * scaleX : { tl: 0, bl: 0, tr: 4 * scaleX, br: 4 * scaleX }
    );
    ctx.fillStyle = colorToRgba(palette.surfaceBorder, 0.25);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(definitionBox.x, definitionBox.y);
    ctx.lineTo(definitionBox.x, definitionBox.y + definitionBox.h);
    ctx.strokeStyle = palette.brandCyan;
    ctx.lineWidth = Math.round(2 * scaleX);
    ctx.stroke();

    ctx.font = definitionBox.font;
    ctx.fillStyle = palette.textMuted;
    ctx.textAlign = 'left';
    let defLineY = definitionBox.firstLineY;
    for (const dLine of definitionBox.lines) {
      ctx.fillText(dLine, definitionBox.textStartX, defLineY);
      defLineY += definitionBox.lineHeight;
    }
  }

  // 4. Seksi KATALIS ENTRY / BLENDED ENTRY
  ctx.font = entryBlock.headerFont;
  ctx.fillStyle = palette.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText(entryBlock.headerTitle, contentLeft, entryBlock.headerY);

  if (entryBlock.rightPriceText && typeof entryBlock.rightPriceX === 'number') {
    ctx.fillStyle = palette.biasColor;
    ctx.textAlign = 'right';
    ctx.fillText(entryBlock.rightPriceText, entryBlock.rightPriceX, entryBlock.headerY);
    ctx.textAlign = 'left';
  }

  // 4a. Dual-Entry Pills (E1 / E2)
  for (const pill of entryBlock.entryPills) {
    ctx.font = pill.font;
    drawRoundedRect(ctx, pill.x, pill.y, pill.w, pill.h, 3 * scaleX);
    ctx.fillStyle = colorToRgba(pill.color, 0.12);
    ctx.fill();
    ctx.strokeStyle = colorToRgba(pill.color, 0.3);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = pill.color;
    ctx.textAlign = 'left';
    ctx.fillText(pill.text, pill.textX, pill.centerY);
  }

  // 4b. Timeframe & Context Zone Pills
  for (const pill of entryBlock.zoneAndTfPills) {
    ctx.font = pill.font;
    drawRoundedRect(ctx, pill.x, pill.y, pill.w, pill.h, 3 * scaleX);
    ctx.fillStyle = colorToRgba(pill.color, 0.12);
    ctx.fill();
    ctx.strokeStyle = colorToRgba(pill.color, 0.3);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = pill.color;
    ctx.textAlign = 'left';
    ctx.fillText(pill.text, pill.textX, pill.centerY);
  }

  // 4c. Alasan Entry (Epistemic Text)
  if (entryBlock.reasonBlock) {
    drawMeasuredEpistemicBlock(ctx, entryBlock.reasonBlock, scaleY, palette.textPrimary, palette);
  }

  ctx.beginPath();
  ctx.moveTo(contentLeft, entryBlock.dividerY);
  ctx.lineTo(contentLeft + contentW, entryBlock.dividerY);
  ctx.strokeStyle = colorToRgba(palette.surfaceBorder, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();

  // 5. Seksi INVALIDASI & STOP LOSS
  ctx.font = invalidationBlock.headerFont;
  ctx.fillStyle = palette.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText(invalidationBlock.headerTitle, contentLeft, invalidationBlock.headerY);

  const slB = invalidationBlock.slBadgeBox;
  drawRoundedRect(ctx, slB.x, slB.y, slB.w, slB.h, 2 * scaleX);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
  ctx.fill();
  if (isSidePanel) {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.font = slB.font;
  ctx.fillStyle = palette.dangerColor;
  ctx.textAlign = 'left';
  ctx.fillText(slB.text, slB.textX, invalidationBlock.headerY);

  ctx.font = invalidationBlock.slPriceFont;
  ctx.fillStyle = palette.dangerColor;
  ctx.textAlign = 'right';
  ctx.fillText(
    invalidationBlock.slPriceText,
    invalidationBlock.slPriceX,
    invalidationBlock.headerY
  );
  ctx.textAlign = 'left';

  if (invalidationBlock.reasonBlock) {
    drawMeasuredEpistemicBlock(
      ctx,
      invalidationBlock.reasonBlock,
      scaleY,
      palette.textPrimary,
      palette
    );
  }

  if (invalidationBlock.invalidationBox) {
    const invBox = invalidationBlock.invalidationBox;
    drawRoundedRect(
      ctx,
      invBox.x,
      invBox.y,
      invBox.w,
      invBox.h,
      (isSidePanel ? 4 : 6) * scaleX
    );
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fill();

    ctx.save();
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([3 * scaleX, 2 * scaleX]);
    }
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.stroke();
    ctx.restore();

    const bBox = invBox.badgeBox;
    drawRoundedRect(ctx, bBox.x, bBox.y, bBox.w, bBox.h, 2 * scaleX);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fill();
    ctx.font = bBox.font;
    ctx.fillStyle = palette.dangerColor;
    ctx.textAlign = 'left';
    ctx.fillText(bBox.text, bBox.textX, bBox.textY);

    drawMeasuredEpistemicBlock(ctx, invBox.contentBlock, scaleY, '#fca5a5', palette);
  }

  ctx.beginPath();
  ctx.moveTo(contentLeft, invalidationBlock.dividerY);
  ctx.lineTo(contentLeft + contentW, invalidationBlock.dividerY);
  ctx.strokeStyle = colorToRgba(palette.surfaceBorder, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();

  // 6. Seksi TARGET LIKUIDITAS
  if (targetsBlock) {
    ctx.font = targetsBlock.headerFont;
    ctx.fillStyle = palette.textMuted;
    ctx.textAlign = 'left';
    ctx.fillText(targetsBlock.headerTitle, contentLeft, targetsBlock.headerY);

    for (const item of targetsBlock.items) {
      drawRoundedRect(
        ctx,
        item.box.x,
        item.box.y,
        item.box.w,
        item.box.h,
        (isSidePanel ? 4 : 5) * scaleX
      );
      ctx.fillStyle = palette.itemBg;
      ctx.fill();
      ctx.strokeStyle = colorToRgba(palette.surfaceBorder, 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();

      drawRoundedRect(
        ctx,
        item.tpBadgeBox.x,
        item.tpBadgeBox.y,
        item.tpBadgeBox.w,
        item.tpBadgeBox.h,
        2 * scaleX
      );
      ctx.fillStyle = colorToRgba(palette.bullColor, 0.15);
      ctx.fill();
      ctx.font = item.tpBadgeBox.font;
      ctx.fillStyle = palette.bullColor;
      ctx.textAlign = 'left';
      ctx.fillText(item.tpBadgeBox.text, item.tpBadgeBox.textX, item.headerCenterY);

      ctx.font = item.priceFont;
      ctx.fillStyle = palette.textPrimary;
      ctx.fillText(item.priceText, item.priceX, item.headerCenterY);

      if (item.rBadgeBox) {
        const rb = item.rBadgeBox;
        drawRoundedRect(ctx, rb.x, rb.y, rb.w, rb.h, 2 * scaleX);
        ctx.fillStyle = rb.bgColor;
        ctx.fill();
        if (rb.borderColor) {
          ctx.strokeStyle = rb.borderColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.font = rb.font;
        ctx.fillStyle = rb.color;
        ctx.textAlign = 'left';
        ctx.fillText(rb.text, rb.textX, item.headerCenterY);
      }

      if (item.reasonBlock) {
        drawMeasuredEpistemicBlock(ctx, item.reasonBlock, scaleY, palette.textMuted, palette);
      }
    }
  }

  // 7. Seksi UNIT RISIKO (R) & CATATAN PROBABILITAS
  if (riskBlock) {
    if (typeof riskBlock.dividerY === 'number') {
      ctx.beginPath();
      ctx.moveTo(contentLeft, riskBlock.dividerY);
      ctx.lineTo(contentLeft + contentW, riskBlock.dividerY);
      ctx.strokeStyle = colorToRgba(palette.surfaceBorder, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (typeof riskBlock.riskRowY === 'number' && riskBlock.riskLeftText) {
      ctx.font = riskBlock.riskLabelFont;
      ctx.fillStyle = palette.textMuted;
      ctx.textAlign = 'left';
      ctx.fillText(riskBlock.riskLeftText, contentLeft, riskBlock.riskRowY);

      if (riskBlock.riskRightText && typeof riskBlock.riskRightX === 'number') {
        ctx.font = riskBlock.riskRightFont || riskBlock.riskLabelFont;
        ctx.fillStyle = palette.textPrimary;
        ctx.textAlign = 'right';
        ctx.fillText(riskBlock.riskRightText, riskBlock.riskRightX, riskBlock.riskRowY);
        ctx.textAlign = 'left';
      }
    }

    if (riskBlock.probNotesBlock) {
      drawMeasuredEpistemicBlock(
        ctx,
        riskBlock.probNotesBlock,
        scaleY,
        isSidePanel ? palette.textMuted : palette.textPrimary,
        palette
      );
    }
  }

  ctx.restore();
}

/**
 * 6. Helper satu langkah (Measure + Draw) untuk merender Themed Thesis Overlay ke Canvas2D.
 */
export function renderThesisOverlayOnCanvas(
  ctx: CanvasRenderingContext2D | any,
  plan: ParsedTradingPlan,
  options: ThesisCanvasLayoutOptions
): MeasuredThesisLayout {
  const layout = measureThesisOverlayLayout(plan, {
    ...options,
    measureCtx: options.measureCtx !== undefined ? options.measureCtx : ctx
  });
  drawMeasuredThesisLayout(ctx, layout);
  return layout;
}
