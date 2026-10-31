/**
 * Layanan Pengurai Rencana Perdagangan Deterministik (Deterministic Plan Parser & Sanity Guard Service)
 * Mengurai tabel Markdown atau teks terstruktur secara 100% lokal (zero-LLM, zero-OCR)
 * Sesuai spesifikasi ADR-0014, GLOSSARY.md, dan Ticket #110.
 */

import { roundToTickSize } from './priceSnapService';

export type TradeBias = 'bullish' | 'bearish' | 'neutral';

export interface ParsedTarget {
  id: string; // e.g. "tp1", "tp2"
  label: string; // e.g. "TP1", "TP2"
  price: number;
  rMultiple?: number;
  distance?: number;
  reason?: string;
}

export interface ContextZone {
  label: string;
  low: number;
  high: number;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PlanConclusion {
  probability?: string;
  probabilityNotes?: string;
  invalidationScenario?: string;
}

export interface ParsedTradingPlan {
  bias: TradeBias;
  entry: number;
  stopLoss: number;
  targets: ParsedTarget[];
  riskAmount: number;
  reasons: Record<string, string>;
  contextZones: ContextZone[];
  rawText: string;
  validation: PlanValidationResult;
  conclusion?: PlanConclusion;
  definition?: string;
}

export interface ParseTradingPlanOptions {
  tickSize?: number;
}

/**
 * Format angka harga standar untuk trading plan tanpa hardcoded simbol fiat ($).
 * Mematuhi aturan Crypto-Denominated Precision (GLOSSARY.md).
 */
export function formatPlanPrice(val: number | undefined): string {
  if (typeof val !== 'number' || isNaN(val)) return '-';
  if (val >= 1000) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
  if (val >= 1) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return val.toString();
}

/**
 * Membersihkan angka dari pemisah ribuan dan mengekstrak float numerik pertama.
 */
function extractFirstPrice(rawVal: string): number | null {
  if (!rawVal || typeof rawVal !== 'string') return null;

  // Bersihkan koma pemisah ribuan: misal 81,200.5 -> 81200.5
  const normalized = rawVal.replace(/(\d+),(\d{3})/g, '$1$2');

  const match = normalized.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) return null;

  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
}

/**
 * Mengekstrak nilai R-multiple dari teks (misal "4.22R", "4.22 R", rasio "1:2.81", atau angka float).
 */
function extractRMultiple(rawVal: string): number | null {
  if (!rawVal) return null;

  // 1. Cek format rasio seperti "1 : 2.81", "1:2.81", atau "1 : 1.66" (ambil sisi reward)
  const ratioMatch = rawVal.match(/1\s*:\s*([+-]?\d+(?:\.\d+)?)/);
  if (ratioMatch) {
    const parsed = parseFloat(ratioMatch[1]);
    if (!isNaN(parsed)) return parsed;
  }

  // 2. Cari pola angka yang diikuti huruf R atau r (misal "4.22R", "4.22 R")
  const rMatch = rawVal.match(/([+-]?\d+(?:\.\d+)?)\s*[rR]\b/);
  if (rMatch) {
    const parsed = parseFloat(rMatch[1]);
    if (!isNaN(parsed)) return parsed;
  }

  return extractFirstPrice(rawVal);
}

/**
 * Mengekstrak jarak (distance) jika tercantum eksplisit dalam teks.
 */
function extractExplicitDistance(rawVal: string): number | null {
  if (!rawVal) return null;
  const distMatch = rawVal.match(/(?:jarak|distance)\s*(?:tp\d*)?\s*[:=]\s*([+-]?\d+(?:\.\d+)?)/i);
  if (distMatch) {
    const val = parseFloat(distMatch[1]);
    if (!isNaN(val)) return val;
  }
  return null;
}

/**
 * Mengekstrak area FVG atau zona rentang harga (misal "LTF FVG 81182.2 - 81236.7").
 */
function extractContextZones(text: string, tickSize?: number): ContextZone[] {
  const zones: ContextZone[] = [];
  if (!text) return zones;

  // Pola rentang harga: angka - angka
  // Memeriksa konteks apakah memuat kata kunci seperti FVG, OB, Imbalance, Zona, Area, dll.
  const regex = /(?:(?:di dalam|tunggu harga masuk|masuk|area|zona)?\s*([a-zA-Z0-9_\s]{0,35}?(?:FVG|OB|Order Block|Imbalance|Demand|Supply|Zone|Area|Rentang|Range)[a-zA-Z0-9_\s]{0,20}?)\s+)?([+-]?\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:-|–|—|s\/d|to)\s*([+-]?\d+(?:,\d{3})*(?:\.\d+)?)/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const rawLabel = match[1]?.trim() || '';
    const fullMatch = match[0];
    const matchIndex = match.index;
    const surrounding = text.substring(Math.max(0, matchIndex - 20), matchIndex + fullMatch.length + 20);

    // Abaikan kalkulasi rumus matematika seperti |78300 - 78900| atau R = |...|
    if (/R\s*=|\|\s*[+-]?\d+(?:\.\d+)?\s*[-–—]\s*[+-]?\d+(?:\.\d+)?\s*\|/.test(surrounding)) {
      continue;
    }

    // Jika tidak ada kata kunci struktural di label atau sekitar, abaikan
    if (!rawLabel && !/(?:fvg|ob|order block|imbalance|zona|area|demand|supply|range)/i.test(surrounding)) {
      continue;
    }

    const num1 = parseFloat(match[2].replace(/,/g, ''));
    const num2 = parseFloat(match[3].replace(/,/g, ''));

    if (isNaN(num1) || isNaN(num2)) continue;

    let low = Math.min(num1, num2);
    let high = Math.max(num1, num2);

    if (typeof tickSize === 'number' && tickSize > 0) {
      low = roundToTickSize(low, tickSize);
      high = roundToTickSize(high, tickSize);
    }

    // Bersihkan label
    let cleanLabel = rawLabel
      .replace(/^(?:di dalam|tunggu harga masuk|masuk|area|zona)\s+/i, '')
      .trim();
    if (!cleanLabel) cleanLabel = 'Context Zone';

    // Hindari duplikasi zona yang sama persis
    const exists = zones.some((z) => Math.abs(z.low - low) < 1e-6 && Math.abs(z.high - high) < 1e-6);
    if (!exists) {
      zones.push({ label: cleanLabel, low, high });
    }
  }

  return zones;
}

/**
 * Mengekstrak bagian Definisi dan Kesimpulan & Skenario Invalidasi (#115).
 */
function extractConclusionAndDefinition(text: string): {
  conclusion?: PlanConclusion;
  definition?: string;
} {
  let definition: string | undefined;
  let conclusion: PlanConclusion | undefined;

  // 1. Ekstraksi Definisi (misal: *Definisi: ...*)
  const defMatch = text.match(/(?:\*|_)?(?:Definisi|Definition)\s*:\s*([^\n\r]+)/i);
  if (defMatch) {
    definition = defMatch[1].replace(/[*_]/g, '').trim();
  }

  // 2. Ekstraksi Kesimpulan / Confidence Level / Skenario Invalidasi
  let prob: string | undefined;
  let probNotes: string | undefined;
  let invalidation: string | undefined;

  // Pencocokan Probabilitas Setup
  const probMatch = text.match(/(?:Probabilitas(?:\s+Setup)?|Probability)\s*:\s*\*?\*?([^\n\r]+)/i);
  if (probMatch) {
    const rawProb = probMatch[1].trim();
    const dotIndex = rawProb.indexOf('.');
    if (dotIndex !== -1 && dotIndex < 30) {
      prob = rawProb.substring(0, dotIndex).replace(/[*_]/g, '').trim();
      probNotes = rawProb.substring(dotIndex + 1).replace(/^[*_\s]+/, '').trim();
    } else {
      prob = rawProb.replace(/[*_]/g, '').trim();
    }
  }

  // Pencocokan Skenario Invalidasi
  const invMatch = text.match(/(?:Skenario\s+Invalidasi|Invalidation(?:\s+Scenario)?)\s*:\s*\*?\*?([^\n\r]+)/i);
  if (invMatch) {
    invalidation = invMatch[1].replace(/^[*_\s]+/, '').trim();
  }

  if (prob || invalidation || probNotes) {
    conclusion = {
      ...(prob ? { probability: prob } : {}),
      ...(probNotes ? { probabilityNotes: probNotes } : {}),
      ...(invalidation ? { invalidationScenario: invalidation } : {}),
    };
  }

  return { conclusion, definition };
}

/**
 * Memvalidasi konsistensi arah rencana perdagangan (Sanity Guard).
 */
export function validatePlanSanity(
  bias: TradeBias,
  entry: number,
  stopLoss: number,
  targets: ParsedTarget[]
): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validasi Entry
  if (!entry || isNaN(entry) || entry <= 0) {
    errors.push('Entry price must be greater than 0.');
  }

  // Validasi Stop Loss
  if (!stopLoss || isNaN(stopLoss) || stopLoss <= 0) {
    errors.push('Stop Loss price must be greater than 0.');
  }

  // Validasi Entry vs Stop Loss
  if (entry > 0 && stopLoss > 0 && entry === stopLoss) {
    errors.push('Entry and Stop Loss cannot be at the same price.');
  }

  // Validasi Target
  if (!targets || targets.length === 0) {
    errors.push('At least one target (TP) is required.');
  } else {
    for (const t of targets) {
      if (!t.price || isNaN(t.price) || t.price <= 0) {
        errors.push(`Target ${t.label || t.id} price must be greater than 0.`);
      }
    }
  }

  // Validasi Bias
  if (bias === 'neutral') {
    errors.push('Trading bias is neutral or undetermined; position direction cannot be verified.');
  } else if (bias === 'bearish') {
    if (entry > 0 && stopLoss > 0 && stopLoss <= entry) {
      errors.push('For Bearish/Short bias, Stop Loss must be above Entry price.');
    }

    if (entry > 0 && targets && targets.length > 0) {
      for (const t of targets) {
        if (t.price > 0 && t.price >= entry) {
          errors.push(
            `Target ${t.label || t.id} price (${t.price}) must be below Entry price (${entry}) for Bearish/Short bias.`
          );
        }
      }

      // Periksa urutan target (TP selanjutnya seharusnya semakin jauh ke bawah)
      for (let i = 1; i < targets.length; i++) {
        if (targets[i].price >= targets[i - 1].price) {
          warnings.push(
            `Target ${targets[i].label} price is higher than or equal to ${targets[i - 1].label} for Bearish bias.`
          );
        }
      }
    }
  } else if (bias === 'bullish') {
    if (entry > 0 && stopLoss > 0 && stopLoss >= entry) {
      errors.push('For Bullish/Long bias, Stop Loss must be below Entry price.');
    }

    if (entry > 0 && targets && targets.length > 0) {
      for (const t of targets) {
        if (t.price > 0 && t.price <= entry) {
          errors.push(
            `Target ${t.label || t.id} price (${t.price}) must be above Entry price (${entry}) for Bullish/Long bias.`
          );
        }
      }

      // Periksa urutan target (TP selanjutnya seharusnya semakin tinggi ke atas)
      for (let i = 1; i < targets.length; i++) {
        if (targets[i].price <= targets[i - 1].price) {
          warnings.push(
            `Target ${targets[i].label} price is lower than or equal to ${targets[i - 1].label} for Bullish bias.`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Mesin Parser Rencana Perdagangan Deterministik.
 * Mengurai string tabel Markdown atau format teks biasa menjadi struktur ParsedTradingPlan.
 */
export function parseTradingPlan(
  text: string,
  options?: ParseTradingPlanOptions
): ParsedTradingPlan {
  const tickSize = options?.tickSize;

  let bias: TradeBias = 'neutral';
  let rawEntry = 0;
  let rawStopLoss = 0;
  const reasons: Record<string, string> = {};

  interface TargetEntry {
    num: number;
    id: string;
    label: string;
    price?: number;
    rMultiple?: number;
    distance?: number;
    reason?: string;
  }
  const targetsMap = new Map<number, TargetEntry>();

  const getOrCreateTarget = (num: number): TargetEntry => {
    let t = targetsMap.get(num);
    if (!t) {
      t = {
        num,
        id: `tp${num}`,
        label: `TP${num}`,
      };
      targetsMap.set(num, t);
    }
    return t;
  };

  const lines = (text || '').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let key = '';
    let val = '';

    // Cek apakah baris Markdown table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const parts = trimmed
        .split('|')
        .map((p) => p.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

      if (parts.length >= 2) {
        key = parts[0];
        val = parts.slice(1).join(' | ');
      }
    } else if (trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      key = trimmed.substring(0, colonIndex).trim();
      val = trimmed.substring(colonIndex + 1).trim();
    }

    if (!key) continue;

    // Bersihkan karakter formatting markdown dari key
    const cleanKey = key.replace(/[*_#`]/g, '').trim().toLowerCase();
    const cleanVal = val.replace(/^[*_#`\s]+|[*_#`\s]+$/g, '').trim();

    // Abaikan header tabel umum
    if (cleanKey === 'parameter' || cleanKey === 'kolom' || /^[-:]+$/.test(cleanKey)) {
      continue;
    }

    // 1. Bias / Arah
    if (
      cleanKey === 'bias' ||
      cleanKey === 'arah' ||
      cleanKey === 'direction' ||
      cleanKey === 'tipe' ||
      cleanKey === 'type'
    ) {
      const lowerVal = cleanVal.toLowerCase();
      if (lowerVal.includes('bearish') || lowerVal.includes('short') || lowerVal.includes('jual')) {
        bias = 'bearish';
      } else if (lowerVal.includes('bullish') || lowerVal.includes('long') || lowerVal.includes('beli')) {
        bias = 'bullish';
      } else {
        bias = 'neutral';
      }
      continue;
    }

    // 2. Alasan Entry
    if (
      cleanKey === 'alasan entry' ||
      cleanKey === 'entry reason' ||
      cleanKey === 'tesis entry' ||
      cleanKey === 'thesis entry'
    ) {
      reasons.entry = cleanVal;
      continue;
    }

    // 3. Alasan Stop Loss
    if (
      cleanKey === 'alasan sl' ||
      cleanKey === 'alasan stop loss' ||
      cleanKey === 'sl reason' ||
      cleanKey === 'stop loss reason' ||
      cleanKey === 'stoploss reason'
    ) {
      reasons.stopLoss = cleanVal;
      continue;
    }

    // 4. Alasan TP
    const reasonTpMatch = cleanKey.match(/(?:alasan|reason)\s*(?:tp|take profit|target)\s*(\d*)/);
    if (reasonTpMatch) {
      const targetNum = parseInt(reasonTpMatch[1], 10) || 1;
      reasons[`tp${targetNum}`] = cleanVal;
      const target = getOrCreateTarget(targetNum);
      target.reason = cleanVal;
      continue;
    }

    // 5. R Multiple TP / RRR (mendukung R multiple TP1 maupun RRR aktual (TP1))
    if (/^(?:r\s*multiple|rmultiple|r-multiple|rrr|rr)\b/.test(cleanKey)) {
      const numMatch = cleanKey.match(/(?:tp|target|\b)(\d+)\b/);
      const targetNum = numMatch ? parseInt(numMatch[1], 10) : 1;
      const target = getOrCreateTarget(targetNum);
      const extractedR = extractRMultiple(cleanVal);
      if (extractedR !== null) {
        target.rMultiple = extractedR;
      }
      const extractedDist = extractExplicitDistance(cleanVal);
      if (extractedDist !== null) {
        target.distance = extractedDist;
      }
      continue;
    }

    // 6. Entry Price
    if (
      cleanKey === 'entry' ||
      cleanKey === 'entry price' ||
      cleanKey === 'open' ||
      cleanKey === 'open price' ||
      cleanKey === 'titik masuk' ||
      cleanKey === 'posisi'
    ) {
      const p = extractFirstPrice(cleanVal);
      if (p !== null) rawEntry = p;
      continue;
    }

    // 7. Stop Loss Price
    if (
      cleanKey === 'stop loss' ||
      cleanKey === 'stoploss' ||
      cleanKey === 'sl' ||
      cleanKey === 'stop' ||
      cleanKey === 'invalidation' ||
      cleanKey === 'pembatalan'
    ) {
      const p = extractFirstPrice(cleanVal);
      if (p !== null) rawStopLoss = p;
      continue;
    }

    // 8. Target Price (TP1, TP2, TP, Take Profit, Target)
    const targetMatch = cleanKey.match(/^(?:tp|take profit|target)\s*(\d*)$/);
    if (targetMatch) {
      const targetNum = parseInt(targetMatch[1], 10) || 1;
      const target = getOrCreateTarget(targetNum);
      const p = extractFirstPrice(cleanVal);
      if (p !== null) {
        target.price = p;
      }
      continue;
    }
  }

  // Jika bias belum ditentukan tapi di rawText ada kata kunci eksplisit
  if (bias === 'neutral') {
    const lowerAll = text.toLowerCase();
    if (/\bbearish\b|\bshort position\b/.test(lowerAll)) {
      bias = 'bearish';
    } else if (/\bbullish\b|\blong position\b/.test(lowerAll)) {
      bias = 'bullish';
    }
  }

  // Sanitasi harga dengan roundToTickSize jika opsi tickSize diberikan
  let entry = rawEntry;
  let stopLoss = rawStopLoss;
  if (typeof tickSize === 'number' && tickSize > 0) {
    if (entry > 0) entry = roundToTickSize(entry, tickSize);
    if (stopLoss > 0) stopLoss = roundToTickSize(stopLoss, tickSize);
  }

  // Ekstraksi zona konteks
  const contextZones = extractContextZones(text, tickSize);

  // Hitung riskAmount
  let riskAmount = 0;
  if (entry > 0 && stopLoss > 0) {
    riskAmount = Math.abs(entry - stopLoss);
    if (typeof tickSize === 'number' && tickSize > 0) {
      riskAmount = roundToTickSize(riskAmount, tickSize);
    } else {
      riskAmount = parseFloat(riskAmount.toFixed(8));
    }
  }

  // Siapkan dan proses target
  const sortedTargets = Array.from(targetsMap.values())
    .filter((t) => typeof t.price === 'number')
    .sort((a, b) => a.num - b.num);

  const targets: ParsedTarget[] = sortedTargets.map((t) => {
    let price = t.price!;
    if (typeof tickSize === 'number' && tickSize > 0) {
      price = roundToTickSize(price, tickSize);
    }

    // Hitung distance jika belum ada
    const distance =
      typeof t.distance === 'number'
        ? t.distance
        : entry > 0
        ? parseFloat(Math.abs(price - entry).toFixed(8))
        : 0;

    // Hitung rMultiple jika belum ada
    let rMultiple = t.rMultiple;
    if (typeof rMultiple !== 'number' && riskAmount > 0 && distance > 0) {
      rMultiple = parseFloat((distance / riskAmount).toFixed(2));
    }

    const reason = t.reason || reasons[t.id];

    return {
      id: t.id,
      label: t.label,
      price,
      distance,
      ...(typeof rMultiple === 'number' ? { rMultiple } : {}),
      ...(reason ? { reason } : {}),
    };
  });

  // Validasi Sanity Guard
  const validation = validatePlanSanity(bias, entry, stopLoss, targets);

  // Ekstraksi Kesimpulan dan Definisi (#115)
  const { conclusion, definition } = extractConclusionAndDefinition(text);

  return {
    bias,
    entry,
    stopLoss,
    targets,
    riskAmount,
    reasons,
    contextZones,
    rawText: text,
    validation,
    ...(conclusion ? { conclusion } : {}),
    ...(definition ? { definition } : {}),
  };
}

/**
 * Memeriksa secara heuristik apakah sebuah string teks kemungkinan besar adalah rencana trading
 * yang dapat diurai oleh parseTradingPlan (misal memuat kata kunci Bias, Entry, Stop Loss/SL, TP/Target).
 */
export function isTradingPlanText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 15) return false;

  // Harus memuat indikator Bias / Arah
  const hasBias = /\b(?:bias|direction|arah|posisi|long|short)\b/i.test(trimmed);

  // Harus memuat indikator Entry
  const hasEntry = /\b(?:entry|harga\s*masuk|in|open)\b/i.test(trimmed);

  // Harus memuat indikator Stop Loss (SL)
  const hasSL = /(?:\bstop\s*loss\b|\bsl\b|\brisk\b)/i.test(trimmed);

  // Harus memuat indikator Target / TP
  const hasTP = /(?:\btarget\b|\btp\d*\b|\btake\s*profit\b)/i.test(trimmed);

  return hasBias && hasEntry && hasSL && hasTP;
}

