/**
 * tradePlanFormService — Deep Domain Module untuk Form Interaktif, Serializer Markdown,
 * Sinkronisasi 2-Arah Form <-> Teks <-> Riwayat, serta Finalisasi Commit Trade Plan.
 */

import type { SavedTradingPlanRecord } from '../types/market';
import { isSameSymbol } from './instrumentIdentity';
import { getAdaptiveTickSize, roundToTickSize } from './priceSnapService';
import {
  inferZonePolarity,
  normalizePlanSymbolToken,
  parseTradingPlan,
  resolveCanonicalPlanSymbol,
  validatePlanSanity,
  type ContextZone,
  type ParsedTarget,
  type ParsedTradingPlan,
  type PlanConclusion,
  type PlanEntryLevel,
  type TradeBias,
  type ZonePolarity
} from './planParserService';

export type TradePlanTabSubMode = 'form' | 'text' | 'history';

export interface TradePlanActivationRequest {
  subMode: TradePlanTabSubMode;
  planId: string | null;
  initialText: string;
  nonce: number;
}

export interface ApplyPlanFromTabOptions {
  autoCreateAlerts?: boolean;
  isFromHistory?: boolean;
  savedRecord?: SavedTradingPlanRecord;
  replaceExistingOnSymbol?: boolean;
}

export interface UpdatePlanFromTabOptions {
  autoCreateAlerts?: boolean;
}

/**
 * Representasi draf target di dalam Form Trade Plan.
 */
export interface PlanFormTargetDraft {
  id: string;
  label: string;
  price: string;
  reason: string;
}

/**
 * Representasi draf zona konteks (FVG/OB/IDM/Demand/Supply) di dalam Form Trade Plan.
 */
export interface PlanFormZoneDraft {
  id: string;
  label: string;
  polarity: ZonePolarity;
  low: string;
  high: string;
  kind?: string;
  timeframe?: string;
}

/**
 * Menyimpan label entri kustom hasil parsing Markdown selama sesi sunting Form
 * agar format label asli tidak hilang ketika draf diserialisasikan kembali ke Markdown.
 */
export interface PreservedEntryLabels {
  e1?: string;
  e2?: string;
}

/**
 * Representasi lengkap draf Form interaktif Trade Plan untuk sinkronisasi Form <-> ParsedTradingPlan <-> Markdown.
 */
export interface PlanFormDraft {
  bias: TradeBias;
  symbol: string;
  setupStatus: string;
  entryMode: 'single' | 'dual';
  entry: string;
  e1Price: string;
  e1WeightPct: string;
  e2Price: string;
  e2WeightPct: string;
  /** Label entri kustom bawaan hasil parsing agar round-trip tetap lossless */
  preservedEntryLabels?: PreservedEntryLabels;
  stopLoss: string;
  riskPercent: string;
  targets: PlanFormTargetDraft[];
  contextZones: PlanFormZoneDraft[];
  entryReason: string;
  stopLossReason: string;
  definition: string;
  confluenceScore: string;
  confluenceMax: string;
  probability: string;
  probabilityNotes: string;
  invalidationScenario: string;
}

export interface BuildPlanFromDraftOptions {
  tickSize?: number;
  roundPrices?: boolean;
}

export const SAMPLE_MARKDOWN_PLAN = `|**Parameter**|**Nilai**|
|---|---|
|Bias|Bearish|
|Symbol|BTCUSDT|
|Entry|81200.0 (Limit sell di dalam area FVG LTF 81182.2 - 81236.7)|
|Alasan Entry|Respek terhadap unfilled Bearish FVG LTF [FAKTA], likuiditas buy-side internal tersapu [INFERENSI]|
|Stop Loss|81400.0|
|Alasan SL|Di atas swing high 81380.0 dengan buffer 20 poin [FAKTA]|
|TP1|80355.4|
|R multiple TP1|4.22R (R = 200). Jarak TP1 = 844.6|
|Alasan TP1|Swing low terdekat 15m & penutupan imbalance lokal [INFERENSI]|
|TP2|79429.0|
|R multiple TP2|8.85R. Jarak TP2 = 1771.0|
|Alasan TP2|Draw on liquidity SSL utama harian [SPEKULASI]|`;

/**
 * Membuat contoh Markdown Trade Plan dengan simbol awal sesuai konteks chart
 * agar pengguna langsung melihat format baris `|Symbol|...|` dan bebas menggantinya.
 */
export function createSampleMarkdownPlan(symbol = 'BTCUSDT'): string {
  const cleanSym = resolveCanonicalPlanSymbol(symbol, 'BTCUSDT');
  return SAMPLE_MARKDOWN_PLAN.replace('|Symbol|BTCUSDT|', `|Symbol|${cleanSym}|`);
}

/**
 * Mengurai angka input pengguna secara toleran (mendukung koma desimal maupun pemisah ribuan).
 */
export function parseDraftNumber(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') {
    return isNaN(raw) ? 0 : raw;
  }
  if (!raw || typeof raw !== 'string') return 0;
  let cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return 0;

  // Jika hanya ada koma desimal (misal "81200,5") -> ubah ke titik; jika "81,200.5" -> hapus koma ribuan
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length !== 3) {
      cleaned = `${parts[0]}.${parts[1]}`;
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatNumericInput(val: number | undefined | null): string {
  if (typeof val !== 'number' || isNaN(val) || val <= 0) return '';
  return String(val);
}

function sanitizeTableCellText(raw: string): string {
  return raw.replace(/\|/g, '/').replace(/\r?\n+/g, ' ').trim();
}

/**
 * Sumber tunggal perhitungan persentase risiko (`|entry - stopLoss| / entry * 100`)
 * untuk Form, Lifecycle, dan pendeteksi override Risk % kustom.
 */
export function computeRiskPercent(entry: number, stopLoss: number): number | undefined {
  if (
    typeof entry !== 'number' ||
    typeof stopLoss !== 'number' ||
    isNaN(entry) ||
    isNaN(stopLoss) ||
    entry <= 0 ||
    stopLoss <= 0
  ) {
    return undefined;
  }
  const risk = Math.abs(entry - stopLoss);
  if (risk <= 0) return undefined;
  return parseFloat(((risk / entry) * 100).toFixed(2));
}

/**
 * Memeriksa apakah nilai `riskPercent` pada plan merupakan input kustom di luar rasio matematis Entry/SL.
 */
export function hasCustomRiskPercent(
  plan: Pick<ParsedTradingPlan, 'entry' | 'stopLoss' | 'riskPercent'>
): boolean {
  const computedPct = computeRiskPercent(plan.entry, plan.stopLoss);
  return Boolean(
    typeof plan.riskPercent === 'number' &&
      !isNaN(plan.riskPercent) &&
      plan.riskPercent > 0 &&
      computedPct !== undefined &&
      Math.abs(plan.riskPercent - computedPct) > 0.02
  );
}

/**
 * Menghasilkan sidik jari struktural untuk mendeteksi mutasi kanvas terhadap draf Form yang sedang dibuka.
 */
export function computePlanFingerprint(plan: ParsedTradingPlan): string {
  return JSON.stringify({
    bias: plan.bias,
    symbol: plan.symbol || '',
    entry: plan.entry,
    stopLoss: plan.stopLoss,
    entries: (plan.entries || []).map((e) => ({
      id: e.id,
      price: e.price,
      weight: e.weight,
      label: e.label
    })),
    targets: (plan.targets || []).map((t) => ({
      id: t.id,
      price: t.price,
      label: t.label,
      reason: t.reason
    })),
    contextZones: (plan.contextZones || []).map((z) => ({
      label: z.label,
      polarity: z.polarity,
      low: z.low,
      high: z.high
    })),
    setupStatus: plan.setupStatus || '',
    definition: plan.definition || '',
    reasons: plan.reasons || {},
    confluenceScore: plan.confluenceScore || null,
    conclusion: plan.conclusion || null
  });
}

/**
 * Membuat draf Form Trade Plan kosong yang siap diisi pengguna.
 */
export function createEmptyPlanFormDraft(defaultSymbol = ''): PlanFormDraft {
  return {
    bias: 'bullish',
    symbol: defaultSymbol ? defaultSymbol.trim().toUpperCase() : '',
    setupStatus: '',
    entryMode: 'single',
    entry: '',
    e1Price: '',
    e1WeightPct: '40',
    e2Price: '',
    e2WeightPct: '60',
    stopLoss: '',
    riskPercent: '',
    targets: [{ id: 'tp1', label: 'TP1', price: '', reason: '' }],
    contextZones: [],
    entryReason: '',
    stopLossReason: '',
    definition: '',
    confluenceScore: '',
    confluenceMax: '5',
    probability: '',
    probabilityNotes: '',
    invalidationScenario: ''
  };
}

/**
 * Mengonversi ParsedTradingPlan ke struktur PlanFormDraft untuk diisi ke form editor.
 */
export function planToFormDraft(
  plan: ParsedTradingPlan,
  fallbackSymbol = ''
): PlanFormDraft {
  const hasDualEntries = Array.isArray(plan.entries) && plan.entries.length >= 2;
  const e1 = plan.entries?.find((e) => e.id === 'e1') ?? plan.entries?.[0];
  const e2 = plan.entries?.find((e) => e.id === 'e2') ?? plan.entries?.[1];

  const targets: PlanFormTargetDraft[] =
    Array.isArray(plan.targets) && plan.targets.length > 0
      ? plan.targets.map((t, idx) => {
          const num = idx + 1;
          const id = t.id || `tp${num}`;
          return {
            id,
            label: t.label || `TP${num}`,
            price: formatNumericInput(t.price),
            reason: t.reason || plan.reasons?.[id] || ''
          };
        })
      : [{ id: 'tp1', label: 'TP1', price: '', reason: '' }];

  const contextZones: PlanFormZoneDraft[] = Array.isArray(plan.contextZones)
    ? plan.contextZones.map((z, idx) => ({
        id: `zone_${idx + 1}`,
        label: z.label || 'FVG Zone',
        polarity: z.polarity || inferZonePolarity(z.label),
        low: formatNumericInput(z.low),
        high: formatNumericInput(z.high),
        ...(z.kind ? { kind: z.kind } : {}),
        ...(z.timeframe ? { timeframe: z.timeframe } : {})
      }))
    : [];

  const preservedEntryLabels: PreservedEntryLabels | undefined =
    hasDualEntries && (e1?.label || e2?.label)
      ? {
          ...(e1?.label ? { e1: e1.label } : {}),
          ...(e2?.label ? { e2: e2.label } : {})
        }
      : undefined;

  const normalizedPlanSym = plan.symbol
    ? resolveCanonicalPlanSymbol(plan.symbol, fallbackSymbol || 'BTCUSDT')
    : '';
  const fallbackCleanSym = fallbackSymbol
    ? normalizePlanSymbolToken(fallbackSymbol) || fallbackSymbol.trim().toUpperCase()
    : '';

  return {
    bias: plan.bias && plan.bias !== 'neutral' ? plan.bias : 'bullish',
    symbol: normalizedPlanSym || fallbackCleanSym,
    setupStatus: plan.setupStatus || '',
    entryMode: hasDualEntries ? 'dual' : 'single',
    entry: formatNumericInput(plan.entry),
    e1Price: hasDualEntries ? formatNumericInput(e1?.price) : '',
    e1WeightPct:
      hasDualEntries && typeof e1?.weight === 'number'
        ? String(parseFloat((e1.weight * 100).toFixed(2)))
        : '40',
    e2Price: hasDualEntries ? formatNumericInput(e2?.price) : '',
    e2WeightPct:
      hasDualEntries && typeof e2?.weight === 'number'
        ? String(parseFloat((e2.weight * 100).toFixed(2)))
        : '60',
    ...(preservedEntryLabels ? { preservedEntryLabels } : {}),
    stopLoss: formatNumericInput(plan.stopLoss),
    riskPercent:
      typeof plan.riskPercent === 'number' && !isNaN(plan.riskPercent) && plan.riskPercent > 0
        ? String(plan.riskPercent)
        : '',
    targets,
    contextZones,
    entryReason: plan.reasons?.entry || '',
    stopLossReason: plan.reasons?.stopLoss || '',
    definition: plan.definition || '',
    confluenceScore:
      plan.confluenceScore && typeof plan.confluenceScore.score === 'number'
        ? String(plan.confluenceScore.score)
        : '',
    confluenceMax:
      plan.confluenceScore && typeof plan.confluenceScore.max === 'number'
        ? String(plan.confluenceScore.max)
        : '5',
    probability: plan.conclusion?.probability || '',
    probabilityNotes: plan.conclusion?.probabilityNotes || '',
    invalidationScenario: plan.conclusion?.invalidationScenario || ''
  };
}

/**
 * Menyerialisasikan struktur ParsedTradingPlan menjadi Markdown kanonikal yang dapat di-parse ulang
 * oleh `parseTradingPlan` tanpa kehilangan data (lossless round-trip).
 */
export function serializeTradingPlanToMarkdown(plan: Partial<ParsedTradingPlan>): string {
  const lines: string[] = ['| Parameter | Nilai |', '| --- | --- |'];

  const biasLabel =
    plan.bias === 'bearish'
      ? 'Bearish (Short)'
      : plan.bias === 'bullish'
        ? 'Bullish (Long)'
        : 'Neutral';
  lines.push(`| Bias | ${biasLabel} |`);

  if (plan.symbol && plan.symbol.trim()) {
    lines.push(`| Symbol | ${plan.symbol.trim().toUpperCase()} |`);
  }

  if (plan.setupStatus && plan.setupStatus.trim()) {
    lines.push(`| Status Setup | ${sanitizeTableCellText(plan.setupStatus)} |`);
  }

  const hasDualEntries = Array.isArray(plan.entries) && plan.entries.length >= 2;
  if (hasDualEntries && plan.entries) {
    const e1 = plan.entries[0];
    const e2 = plan.entries[1];
    const w1 = typeof e1.weight === 'number' && !isNaN(e1.weight) ? e1.weight : 0.4;
    const w2 = typeof e2.weight === 'number' && !isNaN(e2.weight) ? e2.weight : 0.6;
    const pct1 = parseFloat((w1 * 100).toFixed(2));
    const pct2 = parseFloat((w2 * 100).toFixed(2));

    const e1Key =
      e1.label && /^(?:entry\s*1|e1)\b/i.test(e1.label)
        ? sanitizeTableCellText(e1.label)
        : e1.label
          ? `Entry 1 (${sanitizeTableCellText(e1.label)})`
          : 'Entry 1 (Aggressive)';
    const e2Key =
      e2.label && /^(?:entry\s*2|e2)\b/i.test(e2.label)
        ? sanitizeTableCellText(e2.label)
        : e2.label
          ? `Entry 2 (${sanitizeTableCellText(e2.label)})`
          : 'Entry 2 (Moderate)';

    if (typeof e1.price === 'number' && e1.price > 0) {
      lines.push(`| ${e1Key} | ${e1.price} (${pct1}% Size) |`);
    }
    if (typeof e2.price === 'number' && e2.price > 0) {
      lines.push(`| ${e2Key} | ${e2.price} (${pct2}% Size) |`);
    }
    if (typeof plan.entry === 'number' && plan.entry > 0) {
      const fW1 = parseFloat(w1.toFixed(4));
      const fW2 = parseFloat(w2.toFixed(4));
      lines.push(`| Blended Entry | ${plan.entry} ((${fW1} × ${e1.price}) + (${fW2} × ${e2.price})) |`);
    }
  } else if (typeof plan.entry === 'number' && plan.entry > 0) {
    lines.push(`| Entry | ${plan.entry} |`);
  }

  if (plan.reasons?.entry?.trim()) {
    lines.push(`| Alasan Entry | ${sanitizeTableCellText(plan.reasons.entry)} |`);
  }

  if (typeof plan.stopLoss === 'number' && plan.stopLoss > 0) {
    lines.push(`| Stop Loss | ${plan.stopLoss} |`);
  }

  if (plan.reasons?.stopLoss?.trim()) {
    lines.push(`| Alasan SL | ${sanitizeTableCellText(plan.reasons.stopLoss)} |`);
  }

  if (typeof plan.riskPercent === 'number' && !isNaN(plan.riskPercent) && plan.riskPercent > 0) {
    const rAmt = typeof plan.riskAmount === 'number' && plan.riskAmount > 0 ? `${plan.riskAmount} ` : '';
    lines.push(`| Jarak Risiko (1R) | ${rAmt}(${plan.riskPercent}%) |`);
  }

  if (Array.isArray(plan.targets)) {
    plan.targets.forEach((tgt, idx) => {
      const num = idx + 1;
      if (typeof tgt.price === 'number' && tgt.price > 0) {
        lines.push(`| TP${num} | ${tgt.price} |`);
      }

      if (typeof tgt.rMultiple === 'number' && !isNaN(tgt.rMultiple)) {
        if (hasDualEntries && tgt.rMultipleByEntry) {
          const rParts = [`${tgt.rMultiple}R (Blended)`];
          if (typeof tgt.rMultipleByEntry.e1 === 'number') {
            rParts.push(`${tgt.rMultipleByEntry.e1}R (E1)`);
          }
          if (typeof tgt.rMultipleByEntry.e2 === 'number') {
            rParts.push(`${tgt.rMultipleByEntry.e2}R (E2)`);
          }
          lines.push(`| R multiple TP${num} | ${rParts.join(' / ')} |`);
        } else if (typeof tgt.distance === 'number' && tgt.distance > 0) {
          lines.push(`| R multiple TP${num} | ${tgt.rMultiple}R (Jarak: ${tgt.distance}) |`);
        } else {
          lines.push(`| R multiple TP${num} | ${tgt.rMultiple}R |`);
        }
      }

      const reasonVal = tgt.reason || plan.reasons?.[`tp${num}`];
      if (reasonVal && reasonVal.trim()) {
        lines.push(`| Alasan TP${num} | ${sanitizeTableCellText(reasonVal)} |`);
      }
    });
  }

  if (plan.definition && plan.definition.trim()) {
    lines.push('');
    lines.push(`**Definisi:** ${plan.definition.trim()}`);
  }

  // Zona Konteks wajib berada sebelum heading Kesimpulan agar dipindai extractContextZones
  const validZones = (plan.contextZones || []).filter(
    (z) => typeof z.low === 'number' && typeof z.high === 'number' && z.low > 0 && z.high > 0
  );
  if (validZones.length > 0) {
    lines.push('');
    lines.push('### Zona Konteks');
    for (const z of validZones) {
      const lo = Math.min(z.low, z.high);
      const hi = Math.max(z.low, z.high);
      const pol = z.polarity || inferZonePolarity(z.label);
      const rawLbl = (z.label || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      const polWord = pol === 'bull' ? 'Bullish ' : pol === 'bear' ? 'Bearish ' : '';
      const anchorLabel = rawLbl || `${polWord}${z.kind || 'FVG'}`;
      lines.push(`- ${anchorLabel}: ${lo} - ${hi}`);
    }
  }

  if (plan.confluenceScore) {
    lines.push('');
    lines.push(
      `- Skor Konfluensi (${plan.confluenceScore.score} / ${plan.confluenceScore.max} Poin)`
    );
  }

  const hasConclusion =
    plan.conclusion &&
    (plan.conclusion.probability?.trim() ||
      plan.conclusion.probabilityNotes?.trim() ||
      plan.conclusion.invalidationScenario?.trim());

  if (hasConclusion && plan.conclusion) {
    lines.push('');
    lines.push('### Kesimpulan');
    const prob = plan.conclusion.probability?.trim() || '';
    const notes = plan.conclusion.probabilityNotes?.trim() || '';
    if (prob && notes) {
      lines.push(`- **Probabilitas Setup:** ${prob} - ${notes}`);
    } else if (prob) {
      lines.push(`- **Probabilitas Setup:** ${prob}`);
    } else if (notes) {
      lines.push(`- **Catatan Probabilitas:** ${notes}`);
    }

    if (plan.conclusion.invalidationScenario?.trim()) {
      lines.push(`- **Skenario Invalidasi:** ${plan.conclusion.invalidationScenario.trim()}`);
    }
  }

  return lines.join('\n');
}

/**
 * Membangun objek ParsedTradingPlan lengkap beserta metrik R-multiple, validasi Sanity Guard,
 * dan `rawText` Markdown kanonikal dari struktur draf Form interaktif.
 */
export function buildParsedPlanFromFormDraft(
  draft: PlanFormDraft,
  options?: BuildPlanFromDraftOptions
): ParsedTradingPlan {
  const tickSize = options?.tickSize;
  const shouldRound = Boolean(options?.roundPrices && typeof tickSize === 'number' && tickSize > 0);
  const maybeRound = (val: number): number => {
    if (val <= 0 || isNaN(val)) return 0;
    return shouldRound ? roundToTickSize(val, tickSize) : val;
  };

  const bias: TradeBias = draft.bias || 'neutral';
  const isBearish = bias === 'bearish';
  const rawSym = draft.symbol?.trim() || '';
  const symbol = rawSym
    ? normalizePlanSymbolToken(rawSym) || rawSym.toUpperCase()
    : undefined;
  const setupStatus = draft.setupStatus?.trim() ? draft.setupStatus.trim() : undefined;
  const stopLoss = maybeRound(parseDraftNumber(draft.stopLoss));

  let entry = 0;
  let entries: PlanEntryLevel[] | undefined;

  if (draft.entryMode === 'dual') {
    const p1 = maybeRound(parseDraftNumber(draft.e1Price));
    const p2 = maybeRound(parseDraftNumber(draft.e2Price));
    const rawW1 = parseDraftNumber(draft.e1WeightPct);
    const rawW2 = parseDraftNumber(draft.e2WeightPct);
    const totalPct = rawW1 + rawW2;
    const w1 = totalPct > 0 ? parseFloat((rawW1 / totalPct).toFixed(4)) : 0.4;
    const w2 = totalPct > 0 ? parseFloat((rawW2 / totalPct).toFixed(4)) : 0.6;

    const r1 = p1 > 0 && stopLoss > 0 ? parseFloat(Math.abs(p1 - stopLoss).toFixed(8)) : undefined;
    const r2 = p2 > 0 && stopLoss > 0 ? parseFloat(Math.abs(p2 - stopLoss).toFixed(8)) : undefined;

    entries = [
      {
        id: 'e1',
        label: draft.preservedEntryLabels?.e1?.trim() || 'Entry 1 (Aggressive)',
        style: 'aggressive',
        price: p1,
        weight: w1,
        ...(r1 !== undefined ? { riskAmount: r1 } : {})
      },
      {
        id: 'e2',
        label: draft.preservedEntryLabels?.e2?.trim() || 'Entry 2 (Moderate)',
        style: 'moderate',
        price: p2,
        weight: w2,
        ...(r2 !== undefined ? { riskAmount: r2 } : {})
      }
    ];

    if (p1 > 0 && p2 > 0) {
      const rawBlended = p1 * w1 + p2 * w2;
      entry = shouldRound
        ? roundToTickSize(rawBlended, tickSize)
        : parseFloat(rawBlended.toFixed(8));
    } else if (p1 > 0 || p2 > 0) {
      entry = p1 > 0 ? p1 : p2;
    }
  } else {
    entry = maybeRound(parseDraftNumber(draft.entry));
  }

  let riskAmount = 0;
  if (entry > 0 && stopLoss > 0) {
    riskAmount = Math.abs(entry - stopLoss);
    riskAmount = shouldRound
      ? roundToTickSize(riskAmount, tickSize)
      : parseFloat(riskAmount.toFixed(8));
  }

  const parsedRiskPctInput = parseDraftNumber(draft.riskPercent);
  const riskPercent =
    parsedRiskPctInput > 0 ? parsedRiskPctInput : computeRiskPercent(entry, stopLoss);

  const reasons: Record<string, string> = {};
  if (draft.entryReason?.trim()) {
    reasons.entry = draft.entryReason.trim();
  }
  if (draft.stopLossReason?.trim()) {
    reasons.stopLoss = draft.stopLossReason.trim();
  }

  const targets: ParsedTarget[] = (draft.targets || []).map((t, idx) => {
    const num = idx + 1;
    const id = `tp${num}`;
    const label = t.label?.trim() || `TP${num}`;
    const price = maybeRound(parseDraftNumber(t.price));
    const distance =
      entry > 0 && price > 0 ? parseFloat(Math.abs(price - entry).toFixed(8)) : 0;

    let rMultiple: number | undefined;
    if (riskAmount > 0 && price > 0) {
      const signedR = isBearish ? (entry - price) / riskAmount : (price - entry) / riskAmount;
      rMultiple = parseFloat(signedR.toFixed(2));
    }

    let rMultipleByEntry: Record<string, number> | undefined;
    if (entries && entries.length > 0 && price > 0) {
      const rByEntry: Record<string, number> = {};
      if (typeof rMultiple === 'number') {
        rByEntry.blended = rMultiple;
      }
      for (const eLevel of entries) {
        if (eLevel.price > 0 && eLevel.riskAmount && eLevel.riskAmount > 0) {
          const levelSignedR = isBearish
            ? (eLevel.price - price) / eLevel.riskAmount
            : (price - eLevel.price) / eLevel.riskAmount;
          rByEntry[eLevel.id] = parseFloat(levelSignedR.toFixed(2));
        }
      }
      if (Object.keys(rByEntry).length > 0) {
        rMultipleByEntry = rByEntry;
      }
    }

    const reasonText = t.reason?.trim() || '';
    if (reasonText) {
      reasons[id] = reasonText;
    }

    return {
      id,
      label,
      price,
      distance,
      ...(typeof rMultiple === 'number' ? { rMultiple } : {}),
      ...(rMultipleByEntry ? { rMultipleByEntry } : {}),
      ...(reasonText ? { reason: reasonText } : {})
    };
  });

  const contextZones: ContextZone[] = (draft.contextZones || [])
    .map((z) => {
      const pLow = maybeRound(parseDraftNumber(z.low));
      const pHigh = maybeRound(parseDraftNumber(z.high));
      const low = pLow > 0 && pHigh > 0 ? Math.min(pLow, pHigh) : pLow;
      const high = pLow > 0 && pHigh > 0 ? Math.max(pLow, pHigh) : pHigh;
      const label = z.label?.trim() || 'FVG Zone';
      const polarity: ZonePolarity = z.polarity || inferZonePolarity(label);
      return {
        label,
        low,
        high,
        polarity,
        ...(z.kind ? { kind: z.kind } : {}),
        ...(z.timeframe ? { timeframe: z.timeframe } : {})
      };
    })
    .filter((z) => z.low > 0 && z.high > 0);

  const validation = validatePlanSanity(bias, entry, stopLoss, targets, entries);

  const rawScore = parseDraftNumber(draft.confluenceScore);
  const rawMax = parseDraftNumber(draft.confluenceMax);
  const confluenceScore =
    draft.confluenceScore.trim() !== '' && rawMax > 0
      ? { score: rawScore, max: rawMax }
      : undefined;

  const prob = draft.probability?.trim();
  const probNotes = draft.probabilityNotes?.trim();
  const inv = draft.invalidationScenario?.trim();
  const conclusion: PlanConclusion | undefined =
    prob || probNotes || inv
      ? {
          ...(prob ? { probability: prob } : {}),
          ...(probNotes ? { probabilityNotes: probNotes } : {}),
          ...(inv ? { invalidationScenario: inv } : {})
        }
      : undefined;

  const definition = draft.definition?.trim() || undefined;

  const planObj: ParsedTradingPlan = {
    bias,
    entry,
    ...(entries ? { entries } : {}),
    stopLoss,
    targets,
    riskAmount,
    ...(typeof riskPercent === 'number' && !isNaN(riskPercent) ? { riskPercent } : {}),
    ...(confluenceScore ? { confluenceScore } : {}),
    reasons,
    contextZones,
    rawText: '',
    validation,
    ...(conclusion ? { conclusion } : {}),
    ...(definition ? { definition } : {}),
    ...(symbol ? { symbol } : {}),
    ...(setupStatus ? { setupStatus } : {})
  };

  planObj.rawText = serializeTradingPlanToMarkdown(planObj);
  return planObj;
}

export interface SubModeTransitionInput {
  currentSubMode: TradePlanTabSubMode;
  nextSubMode: TradePlanTabSubMode;
  lastEditedSource: 'form' | 'text' | null;
  textBuffer: string;
  formPreviewPlan: ParsedTradingPlan;
  currentFormSymbol?: string;
  activeSymbol: string;
}

export interface SubModeTransitionResult {
  nextSubMode: TradePlanTabSubMode;
  nextTextBuffer?: string;
  nextFormDraft?: PlanFormDraft;
  nextHasCustomRiskPct?: boolean;
  shouldOpenContextZones?: boolean;
  shouldCloseContextZones?: boolean;
  shouldRefreshHistory: boolean;
  shouldFocusTextArea: boolean;
}

/**
 * Mengevaluasi transisi antar sub-mode (`form | text | history`) berdasarkan `lastEditedSource`
 * sehingga alur lintas-tab seperti `Form -> Riwayat -> Teks` maupun `Teks -> Riwayat -> Form`
 * tetap tersinkronisasi 2 arah secara deterministik.
 */
export function resolveSubModeTransition(input: SubModeTransitionInput): SubModeTransitionResult {
  const {
    currentSubMode,
    nextSubMode,
    lastEditedSource,
    textBuffer,
    formPreviewPlan,
    currentFormSymbol,
    activeSymbol
  } = input;

  if (nextSubMode === currentSubMode) {
    return {
      nextSubMode,
      shouldRefreshHistory: false,
      shouldFocusTextArea: false
    };
  }

  if (nextSubMode === 'text') {
    const rawCandidateSymbol = formPreviewPlan.symbol || currentFormSymbol;
    const resolvedFormSymbol = rawCandidateSymbol
      ? resolveCanonicalPlanSymbol(rawCandidateSymbol, activeSymbol || 'BTCUSDT')
      : undefined;

    const hasMeaningfulFormDraft = Boolean(
      formPreviewPlan.entry > 0 ||
        formPreviewPlan.stopLoss > 0 ||
        (formPreviewPlan.targets || []).some((t) => t.price > 0) ||
        (formPreviewPlan.contextZones || []).length > 0 ||
        formPreviewPlan.setupStatus?.trim() ||
        formPreviewPlan.definition?.trim() ||
        Object.values(formPreviewPlan.reasons || {}).some((r) => Boolean(r?.trim())) ||
        Boolean(
          resolvedFormSymbol &&
            activeSymbol &&
            !isSameSymbol(resolvedFormSymbol, activeSymbol)
        )
    );
    // Hindari menyuntikkan template berisi '| Symbol | BTCUSDT |' saat Form masih benar-benar kosong
    const needsSyncFromForm =
      hasMeaningfulFormDraft && (lastEditedSource === 'form' || !textBuffer.trim());
    const planForTextSync =
      resolvedFormSymbol && resolvedFormSymbol !== formPreviewPlan.symbol
        ? { ...formPreviewPlan, symbol: resolvedFormSymbol }
        : formPreviewPlan;

    return {
      nextSubMode: 'text',
      ...(needsSyncFromForm
        ? { nextTextBuffer: serializeTradingPlanToMarkdown(planForTextSync) }
        : {}),
      shouldRefreshHistory: false,
      shouldFocusTextArea: true
    };
  }

  if (nextSubMode === 'form') {
    if (lastEditedSource === 'text') {
      if (!textBuffer.trim()) {
        return {
          nextSubMode: 'form',
          nextFormDraft: createEmptyPlanFormDraft(currentFormSymbol || activeSymbol),
          nextHasCustomRiskPct: false,
          shouldCloseContextZones: true,
          shouldRefreshHistory: false,
          shouldFocusTextArea: false
        };
      }
      const parsed = parseTradingPlan(textBuffer);
      const resolvedTextSymbol = parsed.symbol
        ? resolveCanonicalPlanSymbol(parsed.symbol, currentFormSymbol || activeSymbol)
        : undefined;
      const parsedForForm = resolvedTextSymbol
        ? { ...parsed, symbol: resolvedTextSymbol }
        : parsed;
      const converted = planToFormDraft(parsedForForm, currentFormSymbol || activeSymbol);
      return {
        nextSubMode: 'form',
        nextFormDraft: converted,
        nextHasCustomRiskPct: hasCustomRiskPercent(parsedForForm),
        shouldOpenContextZones: converted.contextZones.length > 0,
        shouldRefreshHistory: false,
        shouldFocusTextArea: false
      };
    }

    return {
      nextSubMode: 'form',
      shouldRefreshHistory: false,
      shouldFocusTextArea: false
    };
  }

  return {
    nextSubMode: 'history',
    shouldRefreshHistory: true,
    shouldFocusTextArea: false
  };
}

/**
 * Menentukan tick size pembulatan akhir saat commit plan dari tab kanan.
 */
export function resolveCommitTickSize(
  planCandidate: ParsedTradingPlan,
  activeSymbol: string,
  chartTickSize?: number,
  currentPrice?: number | null
): number | undefined {
  const targetSym = resolveCanonicalPlanSymbol(planCandidate.symbol, activeSymbol);
  const sameSymbolAsChart = !targetSym || isSameSymbol(targetSym, activeSymbol);
  if (sameSymbolAsChart && typeof chartTickSize === 'number' && chartTickSize > 0) {
    return chartTickSize;
  }
  const refPrice = planCandidate.entry || planCandidate.stopLoss || currentPrice || 0;
  return refPrice > 0 ? getAdaptiveTickSize(refPrice) : undefined;
}

export interface FinalizeTabSubmissionInput {
  subMode: TradePlanTabSubMode;
  textBuffer: string;
  effectiveFormDraft: PlanFormDraft;
  previewPlan: ParsedTradingPlan;
  activeSymbol: string;
  chartTickSize?: number;
  currentPrice?: number | null;
}

export interface FinalizeTabSubmissionResult {
  plan: ParsedTradingPlan;
  tickSize: number | undefined;
}

/**
 * Membangun objek `ParsedTradingPlan` final sebelum diterapkan ke chart atau diperbarui in-place.
 * Menjamin pembulatan `tickSize`, normalisasi simbol, dan penulisan `rawText` Markdown kanonikal
 * baik untuk commit dari sub-mode Form maupun Teks.
 */
export function finalizePlanFromTabSubmission(
  input: FinalizeTabSubmissionInput
): FinalizeTabSubmissionResult {
  const commitTickSize = resolveCommitTickSize(
    input.previewPlan,
    input.activeSymbol,
    input.chartTickSize,
    input.currentPrice
  );

  let finalPlan: ParsedTradingPlan;
  if (input.subMode === 'text') {
    finalPlan = parseTradingPlan(input.textBuffer, { tickSize: commitTickSize });
  } else {
    finalPlan = buildParsedPlanFromFormDraft(input.effectiveFormDraft, {
      tickSize: commitTickSize,
      roundPrices: Boolean(commitTickSize && commitTickSize > 0)
    });
  }

  const rawRequestedSym =
    input.subMode === 'text'
      ? finalPlan.symbol
      : input.effectiveFormDraft.symbol || finalPlan.symbol;
  const normalizedSymbol = resolveCanonicalPlanSymbol(rawRequestedSym, input.activeSymbol || 'BTCUSDT');
  if (normalizedSymbol) {
    finalPlan = {
      ...finalPlan,
      symbol: normalizedSymbol
    };
  }

  // Pastikan rawText kanonikal hasil serializer selalu konsisten pasca tick-rounding & normalisasi simbol
  finalPlan = {
    ...finalPlan,
    rawText: serializeTradingPlanToMarkdown(finalPlan)
  };

  return {
    plan: finalPlan,
    tickSize: commitTickSize
  };
}

export interface ResolveTradePlanCommitActionInput {
  subMode: TradePlanTabSubMode;
  activeSymbol: string;
  draftFormSymbol?: string;
  textPreviewSymbol?: string;
  editingPlan?: { id: string; symbol?: string } | null;
  activePlans?: Array<{ id: string; symbol?: string }>;
  stackAsAdditional?: boolean;
}

export interface TradePlanCommitAction {
  mode: 'update' | 'apply';
  planId?: string;
  targetSymbol: string;
  isSymbolChangedWhileEditing: boolean;
  isDifferentFromActiveChart: boolean;
  replaceExistingOnSymbol: boolean;
}

/**
 * Menentukan target simbol kanonikal dan jalur eksekusi commit (`update` in-place vs `apply` baru):
 * bila pengguna mengubah simbol di Form/Teks saat sedang mengedit plan koin lain (mis. BTCUSDT -> ETHUSDT),
 * sesi edit otomatis dilepas ke jalur `apply` pada ETHUSDT agar plan BTCUSDT lama tetap utuh.
 */
export function resolveTradePlanCommitAction(
  input: ResolveTradePlanCommitActionInput
): TradePlanCommitAction {
  const editingBaseSymbol = input.editingPlan?.symbol || input.activeSymbol || 'BTCUSDT';
  const fallbackSymbol = input.editingPlan ? editingBaseSymbol : input.activeSymbol || 'BTCUSDT';
  const rawExplicitSym =
    input.subMode === 'text' ? input.textPreviewSymbol : input.draftFormSymbol;
  const cleanExplicitToken = rawExplicitSym ? normalizePlanSymbolToken(rawExplicitSym) : '';
  const targetSymbol = resolveCanonicalPlanSymbol(rawExplicitSym, fallbackSymbol);

  const isSymbolChangedWhileEditing = Boolean(
    input.editingPlan &&
      cleanExplicitToken &&
      !isSameSymbol(targetSymbol, editingBaseSymbol)
  );

  const isDifferentFromActiveChart = !isSameSymbol(targetSymbol, input.activeSymbol || 'BTCUSDT');

  const mode: 'update' | 'apply' =
    input.editingPlan && !isSymbolChangedWhileEditing ? 'update' : 'apply';

  const existingOnTargetCount = (input.activePlans || []).filter((p) =>
    isSameSymbol(p.symbol || input.activeSymbol, targetSymbol)
  ).length;

  const replaceExistingOnSymbol =
    mode === 'apply' &&
    !isSymbolChangedWhileEditing &&
    existingOnTargetCount > 0 &&
    !input.stackAsAdditional;

  return {
    mode,
    ...(mode === 'update' && input.editingPlan ? { planId: input.editingPlan.id } : {}),
    targetSymbol,
    isSymbolChangedWhileEditing,
    isDifferentFromActiveChart,
    replaceExistingOnSymbol
  };
}
