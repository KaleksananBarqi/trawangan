/**
 * Layanan Pengurai Rencana Perdagangan Deterministik (Deterministic Plan Parser & Sanity Guard Service)
 * Mengurai tabel Markdown atau teks terstruktur secara 100% lokal (zero-LLM, zero-OCR)
 * Sesuai spesifikasi ADR-0014, GLOSSARY.md, dan Ticket #110.
 */

import { roundToTickSize } from './priceSnapService';

export type TradeBias = 'bullish' | 'bearish' | 'neutral';
export type ZonePolarity = 'bull' | 'bear' | 'neutral';

export interface PlanEntryLevel {
  id: 'e1' | 'e2' | string;
  label: string;
  style?: 'aggressive' | 'moderate' | string;
  price: number;
  weight?: number;
  riskAmount?: number;
  reason?: string;
}

export interface ParsedTarget {
  id: string; // e.g. "tp1", "tp2"
  label: string; // e.g. "TP1", "TP2"
  price: number;
  rMultiple?: number;
  distance?: number;
  reason?: string;
  rMultipleByEntry?: Record<string, number>;
}

export interface ContextZone {
  label: string;
  low: number;
  high: number;
  polarity?: ZonePolarity;
  kind?: 'FVG' | 'OB' | 'IDM' | 'Demand' | 'Supply' | 'Imbalance' | string;
  timeframe?: string;
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
  entries?: PlanEntryLevel[];
  stopLoss: number;
  targets: ParsedTarget[];
  riskAmount: number;
  riskPercent?: number;
  confluenceScore?: { score: number; max: number };
  reasons: Record<string, string>;
  contextZones: ContextZone[];
  rawText: string;
  validation: PlanValidationResult;
  conclusion?: PlanConclusion;
  definition?: string;
  symbol?: string;
  setupStatus?: string;
}

export interface ParseTradingPlanOptions {
  tickSize?: number;
}

/**
 * Menyimpulkan polaritas zona (bull / bear / neutral) berdasarkan kata kunci dalam label.
 */
export function inferZonePolarity(label: string): ZonePolarity {
  if (!label) return 'neutral';
  const l = label.toLowerCase();
  if (l.includes('idm') || l.includes('inducement')) {
    return 'neutral';
  }
  if (/\b(?:bull|bullish|demand)\b/i.test(l)) {
    return 'bull';
  }
  if (/\b(?:bear|bearish|supply)\b/i.test(l)) {
    return 'bear';
  }
  return 'neutral';
}

/**
 * Membersihkan tanda pemformatan Markdown (bold, italic, backtick code) dari narasi teks
 * dengan tetap mempertahankan tag epistemik ([FAKTA], [INFERENSI], [SPEKULASI]) dan angka harga.
 */
export function stripInlineMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(?<=^|[\s(])_([^_]+)_(?=$|[\s),.:;!?])/g, '$1')
    .replace(/(?<![a-zA-Z0-9])_|_(?![a-zA-Z0-9])/g, '')
    .replace(/\*\*/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
 * Memeriksa apakah rentang angka yang cocok merupakan pola tanggal kalender atau stempel waktu.
 */
function isDateOrTimestampPattern(
  num1Str: string,
  num2Str: string,
  beforeMatch: string,
  afterMatch: string,
  rawLabel: string,
  referencePrice?: number
): boolean {
  const num1 = parseFloat(num1Str.replace(/,/g, ''));
  const num2 = parseFloat(num2Str.replace(/,/g, ''));
  if (isNaN(num1) || isNaN(num2)) return false;

  // 1. Format tanggal ISO lengkap dengan tahun (misal "2024-10-30" atau "2026-11-01")
  if ((num1 >= 1900 && num1 <= 2100) || (num2 >= 1900 && num2 <= 2100)) {
    if (
      /^[-/]\d{1,2}\b/.test(afterMatch.trimStart()) ||
      /[-/]\d{1,2}\s*$/.test(beforeMatch.trimEnd())
    ) {
      return true;
    }
  }

  // 2. Diikuti pola format jam/menit (misal "10-30 06:00")
  if (/^\s*(?:[Tt]\s*)?\d{1,2}:\d{2}\b/.test(afterMatch)) {
    return true;
  }

  // 3. Didahului kata kunci penanggalan eksplisit (misal "OB tanggal 10-30", "pada 10-30", "Swing High 10-30")
  if (
    /(?:swing\s+(?:high|low)|candle|bar|pada\s+tanggal|tanggal|tgl|date|time|waktu|hl|ll|hh|lh)\s*[*_]*\s*$/i.test(
      beforeMatch
    )
  ) {
    return true;
  }

  // 4. Tanggal kalender dalam kurung (misal "(10-29)" atau "(10-30)")
  const isEnclosedDate =
    /[([]\s*$/.test(beforeMatch) &&
    /^\s*[)\]]/.test(afterMatch) &&
    !num1Str.includes('.') &&
    !num2Str.includes('.') &&
    num1 <= 31 &&
    num2 <= 31;
  if (isEnclosedDate) return true;

  // 5. Tanggal kalender bulan-hari tanpa desimal
  const isCalendarDayMonth =
    !num1Str.includes('.') &&
    !num2Str.includes('.') &&
    ((num1 >= 1 && num1 <= 12 && num2 >= 1 && num2 <= 31) ||
      (num1 >= 1 && num1 <= 31 && num2 >= 1 && num2 <= 12));

  if (isCalendarDayMonth) {
    // Jika tidak ada label zona institusional langsung
    if (!rawLabel) return true;

    // Jika ada referencePrice bernilai tinggi (misal BTC > 100) dan zona < 10% harga referensi
    if (typeof referencePrice === 'number' && referencePrice > 100) {
      const maxVal = Math.max(num1, num2);
      if (maxVal < referencePrice * 0.1) return true;
    }
  }

  return false;
}

/**
 * Mengekstrak area FVG atau zona rentang harga (misal "LTF FVG 81182.2 - 81236.7").
 */
function extractContextZones(
  text: string,
  tickSize?: number,
  referencePrice?: number
): ContextZone[] {
  const zones: ContextZone[] = [];
  if (!text) return zones;

  // 1. Normalisasikan pemformatan markdown (ganti _ di BULL_OB jadi spasi, bersihkan backticks dan asterisks)
  // Abaikan pemindaian zona konteks pada seksi Kesimpulan / Invalidasi (#6)
  const conclusionIdx = text.search(/\n\s*#{1,3}\s+(?:6\.|kesimpulan|conclusion)/i);
  const scopedText = conclusionIdx !== -1 ? text.substring(0, conclusionIdx) : text;

  const normalizedText = scopedText
    .replace(/(BULL|BEAR)_(OB|FVG)/gi, '$1 $2')
    .replace(/[`*]/g, '');

  // 2. Regex rentang angka: num1 - num2 (mendukung berbagai dash dan s/d / to)
  const rangeRegex = /([+-]?\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:-|–|—|\bs\/d\b|\bto\b)\s*([+-]?\d+(?:,\d{3})*(?:\.\d+)?)/gi;

  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(normalizedText)) !== null) {
    const fullMatch = match[0];
    const matchIdx = match.index;
    const num1Str = match[1];
    const num2Str = match[2];
    const afterMatch = normalizedText.substring(matchIdx + fullMatch.length, matchIdx + fullMatch.length + 30);
    const beforeMatch = normalizedText.substring(Math.max(0, matchIdx - 30), matchIdx);
    const surrounding = normalizedText.substring(Math.max(0, matchIdx - 20), matchIdx + fullMatch.length + 20);

    const num1 = parseFloat(num1Str.replace(/,/g, ''));
    const num2 = parseFloat(num2Str.replace(/,/g, ''));
    if (isNaN(num1) || isNaN(num2)) continue;

    // Abaikan kalkulasi rumus matematika seperti |78300 - 78900| atau R = |...|
    if (/R\s*=|\|\s*[+-]?\d+(?:\.\d+)?\s*[-–—]\s*[+-]?\d+(?:\.\d+)?\s*\|/.test(surrounding)) {
      continue;
    }

    // Abaikan jika bagian dari Dealing Range
    const contextBefore = normalizedText.substring(Math.max(0, matchIdx - 140), matchIdx);
    if (
      /(?:dealing\s+range|range\s+recent)\s*$/i.test(contextBefore.trimEnd()) ||
      /(?:dealing\s+range)/i.test(contextBefore.slice(-40))
    ) {
      continue;
    }

    // Cari POI Anchor di contextBefore (maksimal 140 karakter ke belakang)
    const anchorRegex = /(?:((?:[0-9]{1,3}\s*[mhdHDwW]|daily|weekly|macro|htf|mtf|ltf)\s+)?(?:unmitigated\s+|unfilled\s+)?((?:bullish|bearish|bull|bear)\s+)?(FVG|OB|Order\s*Block|IDM|Inducement|Demand|Supply|Imbalance)(?:\s+((?:[0-9]{1,3}\s*[mhdHDwW]|daily|weekly|macro|htf|mtf|ltf)))?)|(?:(IDM|Inducement))/gi;

    let lastAnchor: RegExpExecArray | null = null;
    let aMatch: RegExpExecArray | null;
    while ((aMatch = anchorRegex.exec(contextBefore)) !== null) {
      lastAnchor = aMatch;
    }

    // Jika tidak ada anchor di contextBefore, cek contextAfter (misal format "600.00 - 601.50 (15m Bullish FVG)")
    let isAnchorFromAfter = false;
    const contextAfter = normalizedText.substring(matchIdx + fullMatch.length, Math.min(normalizedText.length, matchIdx + fullMatch.length + 80));
    if (!lastAnchor) {
      const afterAnchorRegex = /^\s*[([]\s*(?:((?:[0-9]{1,3}\s*[mhdHDwW]|daily|weekly|macro|htf|mtf|ltf)\s+)?(?:unmitigated\s+|unfilled\s+)?((?:bullish|bearish|bull|bear)\s+)?(FVG|OB|Order\s*Block|IDM|Inducement|Demand|Supply|Imbalance))/i;
      const afterM = afterAnchorRegex.exec(contextAfter);
      if (afterM) {
        lastAnchor = afterM;
        isAnchorFromAfter = true;
      }
    }

    if (!lastAnchor) continue;

    // Abaikan format tanggal / timestamp kalender via validator mandiri
    if (
      isDateOrTimestampPattern(
        num1Str,
        num2Str,
        beforeMatch,
        afterMatch,
        lastAnchor ? lastAnchor[0] : '',
        referencePrice
      )
    ) {
      continue;
    }

    // Pastikan anchor tidak terkurung dalam kurung tutup sebelum rentang angka (misal "(sweep IDM) dan menyentuh area 2261.90-2268.19")
    if (!isAnchorFromAfter) {
      const textBetween = contextBefore.substring(lastAnchor.index + lastAnchor[0].length);
      if (textBetween.includes(')') && !textBetween.includes('(')) {
        continue;
      }
      // Jika di antara anchor dan angka ini sudah ada rentang harga terkurung lain (anchor sudah memiliki zona sendiri)
      if (/\(\s*\d+(?:,\d{3})*(?:\.\d+)?\s*[-–—]\s*\d+(?:,\d{3})*(?:\.\d+)?\s*\)/.test(textBetween)) {
        continue;
      }
      // Jika ada tanda titik kalimat baru mayor sebelum rentang tercapai
      if (/[.!?]\s+[A-Z]/.test(textBetween)) {
        continue;
      }
      // Jika teks perantara memuat narasi aksi pergerakan harga seperti "masuk ke zona/area", "turun ke", atau "menyentuh area"
      if (
        /(?:masuk\s+ke(?:\s+zona|\s+area)?|menyentuh(?:\s+area|\s+zona)?|turun\s+ke|naik\s+ke|kembali\s+(?:turun|naik)\s+ke|menjemput\s+(?:zona|area)|terkoreksi\s+(?:turun\s+)?ke)\s*$/i.test(
          textBetween.trimEnd()
        )
      ) {
        continue;
      }
      // Khusus IDM: jika di antara anchor IDM dan rentang harga sudah ada angka harga lain
      if (/IDM|INDUCEMENT/i.test(lastAnchor[0]) && /\d+(?:\.\d+)?/.test(textBetween)) {
        continue;
      }
    }

    // Ekstrak komponen anchor
    const tf = (lastAnchor[1] || lastAnchor[4] || '').trim();
    const polStr = (lastAnchor[2] || '').trim().toLowerCase();
    const kindStr = (lastAnchor[3] || lastAnchor[5] || '').trim().toUpperCase();

    let kind = 'Context Zone';
    if (/FVG|IMBALANCE/i.test(kindStr)) kind = 'FVG';
    else if (/OB|ORDER\s*BLOCK/i.test(kindStr)) kind = 'OB';
    else if (/IDM|INDUCEMENT/i.test(kindStr)) kind = 'IDM';
    else if (/DEMAND/i.test(kindStr)) kind = 'Demand';
    else if (/SUPPLY/i.test(kindStr)) kind = 'Supply';

    let polarity: ZonePolarity = 'neutral';
    if (kind === 'Demand') polarity = 'bull';
    else if (kind === 'Supply') polarity = 'bear';
    else if (kind === 'IDM') polarity = 'neutral';
    else if (/bull/i.test(polStr)) polarity = 'bull';
    else if (/bear/i.test(polStr)) polarity = 'bear';

    // Format label ringkas: <TF> <kind> <polarity>
    let label = '';
    if (kind === 'IDM') {
      label = 'IDM';
    } else if (kind === 'Demand' || kind === 'Supply') {
      label = tf ? `${tf} ${kind}` : `${kind} Zone`;
    } else {
      const polLabel = polarity === 'bull' ? 'Bull' : polarity === 'bear' ? 'Bear' : '';
      label = [tf, kind, polLabel].filter(Boolean).join(' ');
    }
    if (!label) label = 'Context Zone';

    let low = Math.min(num1, num2);
    let high = Math.max(num1, num2);

    if (typeof tickSize === 'number' && tickSize > 0) {
      low = roundToTickSize(low, tickSize);
      high = roundToTickSize(high, tickSize);
    }

    // Cek duplikasi persis
    const exists = zones.some((z) => Math.abs(z.low - low) < 1e-6 && Math.abs(z.high - high) < 1e-6);
    if (exists) continue;

    // Untuk IDM: buang IDM kedua jika overlap dengan IDM yang sudah tercatat
    if (kind === 'IDM') {
      const idmOverlap = zones.some((z) => z.kind === 'IDM' && low <= z.high && high >= z.low);
      if (idmOverlap) continue;
    }

    zones.push({
      label,
      low,
      high,
      polarity,
      kind,
      ...(tf ? { timeframe: tf } : {})
    });
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

  // 1. Ekstraksi Definisi (misal: *Definisi: ...* atau **Definisi & Kalkulasi R:**)
  const singleLineMatch = text.match(/(?:^|\n|\r)\s*(?:[-*]\s*)?(?:\*\*)?(?:Definisi|Definition)(?:\s+(?:&\s+Kalkulasi\s+R|Umum|Setup))?(?:\*\*)?[*_\s]*:[*_\s]*([^\n\r]+)/i);
  if (singleLineMatch && singleLineMatch[1].trim()) {
    definition = stripInlineMarkdown(singleLineMatch[1]);
  } else {
    const multiLineMatch = text.match(/(?:^|\n|\r)\s*(?:[-*]\s*)?(?:\*\*)?(?:Definisi|Definition)(?:\s+(?:&\s+Kalkulasi\s+R|Umum|Setup))?(?:\*\*)?[*_\s]*:[*_\s]*(?:\r?\n)+([\s\S]+?)(?=\r?\n\s*\||\r?\n\s*#{1,4}\s+|$)/i);
    if (multiLineMatch && multiLineMatch[1].trim()) {
      definition = stripInlineMarkdown(multiLineMatch[1]);
    }
  }

  // 2. Ekstraksi Kesimpulan / Confidence Level / Skenario Invalidasi
  let prob: string | undefined;
  let probNotes: string | undefined;
  let invalidation: string | undefined;

  // Pencocokan Probabilitas / Confidence Level
  const probMatch = text.match(/(?:(?:Confidence(?:\s+Level)?|Probabilitas(?:\s+Setup)?|Probability))\s*[:=]\s*\*?\*?([^\n\r]+)/i);
  if (probMatch) {
    const raw = probMatch[1].trim();
    const dashMatch = raw.match(/^(.*?)\s*(?:[—–]|\s+-\s+|\.\s+)\s*(.*)$/);
    if (dashMatch) {
      prob = stripInlineMarkdown(dashMatch[1]);
      probNotes = stripInlineMarkdown(dashMatch[2]);
    } else {
      prob = stripInlineMarkdown(raw);
    }
  }

  // Pencocokan Skenario Invalidasi
  const invMatch = text.match(/(?:Skenario\s+Invalidasi|Invalidation(?:\s+Scenario)?|Invalidasi[^\n\r:]*)\s*[:=]\s*\*?\*?([^\n\r]+)/i);
  if (invMatch) {
    invalidation = stripInlineMarkdown(invMatch[1]);
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
  targets: ParsedTarget[],
  entries?: PlanEntryLevel[]
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

  // Validasi level Dual-Entry jika ada
  if (Array.isArray(entries) && entries.length > 0) {
    for (const e of entries) {
      if (typeof e.price !== 'number' || isNaN(e.price) || e.price <= 0) {
        errors.push(`Level entry ${e.label || e.id} harga harus lebih besar dari 0.`);
      } else if (stopLoss > 0) {
        if (bias === 'bullish' && e.price <= stopLoss) {
          errors.push(`Level entry ${e.label || e.id} (${e.price}) harus di atas Stop Loss (${stopLoss}) untuk bias Bullish.`);
        } else if (bias === 'bearish' && e.price >= stopLoss) {
          errors.push(`Level entry ${e.label || e.id} (${e.price}) harus di bawah Stop Loss (${stopLoss}) untuk bias Bearish.`);
        }
      }
    }
    const e1 = entries.find((e) => e.id === 'e1');
    const e2 = entries.find((e) => e.id === 'e2');
    if (e1 && e2) {
      if (bias === 'bullish' && e1.price < e2.price) {
        warnings.push(`Entry 1 (${e1.price}) lebih rendah dari Entry 2 (${e2.price}) untuk setup pullback Bullish.`);
      } else if (bias === 'bearish' && e1.price > e2.price) {
        warnings.push(`Entry 1 (${e1.price}) lebih tinggi dari Entry 2 (${e2.price}) untuk setup pullback Bearish.`);
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
 * Memastikan baris tabel Markdown selalu ditutup dengan karakter pipa.
 */
function ensureTrailingPipe(row: string): string {
  return row.endsWith('|') ? row : `${row} |`;
}

/**
 * Menggabungkan baris tabel Markdown yang terpotong menjadi beberapa baris (multiline)
 * atau memiliki baris kosong di dalam sel sebelum pipa penutup.
 */
function normalizePlanLines(rawLines: string[]): string[] {
  const normalized: string[] = [];
  let currentTableRow: string | null = null;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    // 1. Baris kosong
    if (!trimmed) {
      if (currentTableRow !== null) {
        currentTableRow += ' ';
      }
      continue;
    }

    // 2. Baris yang hanya berisi karakter pipa penutup (misal "|" atau " |")
    if (/^\|+\s*$/.test(trimmed)) {
      if (currentTableRow !== null) {
        currentTableRow = ensureTrailingPipe(currentTableRow.trimEnd());
        normalized.push(currentTableRow);
        currentTableRow = null;
      }
      continue;
    }

    const isTableRowStart = trimmed.startsWith('|');

    if (isTableRowStart) {
      if (currentTableRow !== null) {
        normalized.push(ensureTrailingPipe(currentTableRow));
        currentTableRow = null;
      }

      if (trimmed.endsWith('|')) {
        normalized.push(trimmed);
      } else {
        currentTableRow = trimmed;
      }
    } else {
      if (currentTableRow !== null) {
        if (trimmed.endsWith('|')) {
          currentTableRow += ' ' + trimmed;
          normalized.push(currentTableRow);
          currentTableRow = null;
        } else if (
          /^#{1,3}\s+[A-Z0-9]/i.test(trimmed) ||
          /^(?:entry|sl|stop\s*loss|tp\d*|target\d*|bias)\s*:/i.test(trimmed)
        ) {
          normalized.push(ensureTrailingPipe(currentTableRow));
          currentTableRow = null;
          normalized.push(trimmed);
        } else {
          currentTableRow += ' ' + trimmed;
        }
      } else {
        normalized.push(trimmed);
      }
    }
  }

  if (currentTableRow !== null) {
    normalized.push(ensureTrailingPipe(currentTableRow));
  }

  return normalized;
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
  let rawEntry1: number | null = null;
  let rawEntry2: number | null = null;
  let entry1Label = 'Entry 1 (Aggressive)';
  let entry2Label = 'Entry 2 (Moderate)';
  let entry1Val = '';
  let entry2Val = '';
  let entry1Weight: number | undefined;
  let entry2Weight: number | undefined;
  let parsedRiskPercent: number | undefined;
  let parsedSymbol: string | undefined;
  let parsedSetupStatus: string | undefined;
  const reasons: Record<string, string> = {};

  interface TargetEntry {
    num: number;
    id: string;
    label: string;
    price?: number;
    rMultiple?: number;
    distance?: number;
    reason?: string;
    rMultipleByEntry?: Record<string, number>;
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

  const rawLines = (text || '').split(/\r?\n/);
  const lines = normalizePlanLines(rawLines);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let key = '';
    let val = '';

    // Cek apakah baris Markdown table
    if (trimmed.startsWith('|')) {
      const row = ensureTrailingPipe(trimmed);
      const parts = row
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

    // 1b. Pasangan / Koin / Simbol Instrumen (#123)
    if (
      cleanKey === 'symbol' ||
      cleanKey === 'simbol' ||
      cleanKey === 'pair' ||
      cleanKey === 'pasangan' ||
      cleanKey === 'koin' ||
      cleanKey === 'coin' ||
      cleanKey === 'instrument' ||
      cleanKey === 'instrumen' ||
      cleanKey === 'ticker'
    ) {
      const symMatch = cleanVal.match(/([A-Za-z0-9_\-\.]+)/);
      if (symMatch) {
        parsedSymbol = symMatch[1].replace('/', '').toUpperCase();
      }
      continue;
    }

    // 1c. Status Setup (misal "Status Setup", "Setup Status", "Status")
    if (
      cleanKey === 'status setup' ||
      cleanKey === 'setup status' ||
      cleanKey === 'status'
    ) {
      parsedSetupStatus = stripInlineMarkdown(cleanVal);
      continue;
    }

    // 1d. Jarak Risiko Persentase (misal "Jarak Risiko (1R)", "Risk %", "Risk Percentage")
    if (/^(?:jarak\s*risiko|risk\s*(?:percent|percentage|\(1r\))|1r\s*risk)\b/i.test(cleanKey)) {
      const pctMatch = cleanVal.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
      if (pctMatch) {
        parsedRiskPercent = parseFloat(pctMatch[1]);
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

      // Ekstraksi multi-acuan R-multiple (misal: "2.68R (Blended) / 1.92R (E1)")
      const rByEntry: Record<string, number> = {};
      const multiRRegex = /([+-]?\d+(?:\.\d+)?)\s*[rR]\s*\(\s*([A-Za-z0-9\s_-]+)\s*\)/g;
      let rM: RegExpExecArray | null;
      while ((rM = multiRRegex.exec(cleanVal)) !== null) {
        const rVal = parseFloat(rM[1]);
        const refName = rM[2].trim().toLowerCase();
        if (!isNaN(rVal)) {
          if (refName.includes('blend')) {
            rByEntry.blended = rVal;
          } else if (refName.includes('e1') || refName.includes('entry 1') || refName.includes('agg')) {
            rByEntry.e1 = rVal;
          } else if (refName.includes('e2') || refName.includes('entry 2') || refName.includes('mod')) {
            rByEntry.e2 = rVal;
          } else {
            rByEntry[refName] = rVal;
          }
        }
      }
      if (Object.keys(rByEntry).length > 0) {
        target.rMultipleByEntry = rByEntry;
      }
      continue;
    }

    // 5b. Dual-Entry Level: Entry 1 (Aggressive) / E1
    if (/^(?:entry\s*1|e1)\b/i.test(cleanKey)) {
      const p = extractFirstPrice(cleanVal);
      if (p !== null) {
        rawEntry1 = p;
        entry1Val = cleanVal;
        entry1Label = stripInlineMarkdown(key) || 'Entry 1 (Aggressive)';
        const wMatch = (cleanKey + ' ' + cleanVal).match(/(?:bobot|weight|alokasi|size|posisi|\()\s*(\d+(?:\.\d+)?)\s*%(?:\s*(?:size|posisi|bobot|alokasi|\)))?/i);
        if (wMatch && !cleanVal.toLowerCase().includes('mean threshold') && !cleanVal.toLowerCase().includes('consequent')) {
          entry1Weight = parseFloat(wMatch[1]) / 100;
        }
      }
      continue;
    }

    // 5c. Dual-Entry Level: Entry 2 (Moderate) / E2
    if (/^(?:entry\s*2|e2)\b/i.test(cleanKey)) {
      const p = extractFirstPrice(cleanVal);
      if (p !== null) {
        rawEntry2 = p;
        entry2Val = cleanVal;
        entry2Label = stripInlineMarkdown(key) || 'Entry 2 (Moderate)';
        const wMatch = (cleanKey + ' ' + cleanVal).match(/(?:bobot|weight|alokasi|size|posisi|\()\s*(\d+(?:\.\d+)?)\s*%(?:\s*(?:size|posisi|bobot|alokasi|\)))?/i);
        if (wMatch && !cleanVal.toLowerCase().includes('mean threshold') && !cleanVal.toLowerCase().includes('consequent')) {
          entry2Weight = parseFloat(wMatch[1]) / 100;
        }
      }
      continue;
    }

    // 6. Entry Price (Blended / Utama)
    if (
      cleanKey === 'entry' ||
      cleanKey === 'entry price' ||
      cleanKey === 'blended entry' ||
      cleanKey === 'open' ||
      cleanKey === 'open price' ||
      cleanKey === 'titik masuk' ||
      cleanKey === 'posisi'
    ) {
      const p = extractFirstPrice(cleanVal);
      if (p !== null) rawEntry = p;

      // Ekstraksi bobot dari formula Blended Entry, misal: `(0.4 × 1.584) + (0.6 × 1.576)`
      const formulaRegex = /([0-9.]+)\s*(?:×|\*)\s*([0-9.]+)/g;
      let fMatch: RegExpExecArray | null;
      const formulaPairs: Array<{ w: number; p: number }> = [];
      while ((fMatch = formulaRegex.exec(cleanVal)) !== null) {
        const w = parseFloat(fMatch[1]);
        const price = parseFloat(fMatch[2]);
        if (!isNaN(w) && !isNaN(price)) {
          formulaPairs.push({ w: w > 1 ? w / 100 : w, p: price });
        }
      }
      if (formulaPairs.length >= 2) {
        entry1Weight = formulaPairs[0].w;
        if (rawEntry1 === null) rawEntry1 = formulaPairs[0].p;
        entry2Weight = formulaPairs[1].w;
        if (rawEntry2 === null) rawEntry2 = formulaPairs[1].p;
      }
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

  // Bersihkan karakter Markdown inline pada narasi reasons
  for (const key of Object.keys(reasons)) {
    reasons[key] = stripInlineMarkdown(reasons[key]);
  }

  // Fallback status setup dari teks jika belum ada di tabel parameter
  if (!parsedSetupStatus) {
    const statusMatch = text.match(/(?:\*|_)?(?:Status\s+Setup|Setup\s+Status)\s*[:=]\s*\*?\*?([^\n\r]+)/i);
    if (statusMatch) {
      parsedSetupStatus = stripInlineMarkdown(statusMatch[1]);
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

  // Bentuk array level entry (Dual-Entry E1 & E2) jika terdeteksi
  const entries: PlanEntryLevel[] = [];
  if (rawEntry1 !== null) {
    let p1 = rawEntry1;
    if (typeof tickSize === 'number' && tickSize > 0) {
      p1 = roundToTickSize(p1, tickSize);
    }
    const w1 = entry1Weight ?? (rawEntry2 !== null ? 0.4 : 1.0);
    const r1 = stopLoss > 0 ? parseFloat(Math.abs(p1 - stopLoss).toFixed(8)) : undefined;
    entries.push({
      id: 'e1',
      label: entry1Label,
      style: 'aggressive',
      price: p1,
      weight: w1,
      ...(r1 !== undefined ? { riskAmount: r1 } : {})
    });
  }
  if (rawEntry2 !== null) {
    let p2 = rawEntry2;
    if (typeof tickSize === 'number' && tickSize > 0) {
      p2 = roundToTickSize(p2, tickSize);
    }
    const w2 = entry2Weight ?? (rawEntry1 !== null ? 0.6 : 1.0);
    const r2 = stopLoss > 0 ? parseFloat(Math.abs(p2 - stopLoss).toFixed(8)) : undefined;
    entries.push({
      id: 'e2',
      label: entry2Label,
      style: 'moderate',
      price: p2,
      weight: w2,
      ...(r2 !== undefined ? { riskAmount: r2 } : {})
    });
  }

  // Jika entry utama belum diisi tapi entries ada, hitung weighted blended entry
  if (entry <= 0 && entries.length > 0) {
    const totalW = entries.reduce((acc, e) => acc + (e.weight || 0), 0) || 1;
    entry = entries.reduce((acc, e) => acc + e.price * (e.weight || (1 / entries.length)), 0) / (totalW > 0 ? totalW : 1);
    if (typeof tickSize === 'number' && tickSize > 0) {
      entry = roundToTickSize(entry, tickSize);
    } else {
      entry = parseFloat(entry.toFixed(8));
    }
  }

  // Ekstraksi zona konteks dengan referensi harga untuk mencegah false context zone
  const contextZones = extractContextZones(text, tickSize, entry || stopLoss);

  // Hitung riskAmount acuan (dari Entry utama / Blended)
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

    // Susun rMultipleByEntry jika ada level entry tambahan
    let rMultipleByEntry = t.rMultipleByEntry;
    if (entries.length > 0) {
      const rByEntry: Record<string, number> = { ...(rMultipleByEntry || {}) };
      if (typeof rMultiple === 'number' && rByEntry.blended === undefined) {
        rByEntry.blended = rMultiple;
      }
      const e1 = entries.find((e) => e.id === 'e1');
      if (e1 && e1.riskAmount && e1.riskAmount > 0 && rByEntry.e1 === undefined) {
        rByEntry.e1 = parseFloat((Math.abs(price - e1.price) / e1.riskAmount).toFixed(2));
      }
      const e2 = entries.find((e) => e.id === 'e2');
      if (e2 && e2.riskAmount && e2.riskAmount > 0 && rByEntry.e2 === undefined) {
        rByEntry.e2 = parseFloat((Math.abs(price - e2.price) / e2.riskAmount).toFixed(2));
      }
      if (Object.keys(rByEntry).length > 0) {
        rMultipleByEntry = rByEntry;
      }
    }

    const rawReason = t.reason || reasons[t.id];
    const reason = rawReason ? stripInlineMarkdown(rawReason) : undefined;

    return {
      id: t.id,
      label: t.label,
      price,
      distance,
      ...(typeof rMultiple === 'number' ? { rMultiple } : {}),
      ...(rMultipleByEntry ? { rMultipleByEntry } : {}),
      ...(reason ? { reason } : {}),
    };
  });

  // Validasi Sanity Guard
  const validation = validatePlanSanity(bias, entry, stopLoss, targets, entries);

  // Ekstraksi Kesimpulan dan Definisi (#115)
  const { conclusion, definition } = extractConclusionAndDefinition(text);

  // Ekstraksi Skor Konfluensi (misal "Skor Konfluensi (4 / 5 Poin)")
  let parsedConfluenceScore: { score: number; max: number } | undefined;
  const confMatch = text.match(/(?:Skor\s+Konfluensi|Confluence\s+Score)[^:\n\r]*\(\s*(\d+)\s*\/\s*(\d+)\s*(?:poin|pts|points)?\s*\)/i);
  if (confMatch) {
    parsedConfluenceScore = {
      score: parseInt(confMatch[1], 10),
      max: parseInt(confMatch[2], 10),
    };
  }

  // Fallback deteksi simbol koin dari teks jika belum ada di tabel parameter
  if (!parsedSymbol) {
    const fallbackSym = extractFallbackSymbol(text);
    if (fallbackSym) {
      parsedSymbol = fallbackSym;
    }
  }

  return {
    bias,
    entry,
    ...(entries.length > 0 ? { entries } : {}),
    stopLoss,
    targets,
    riskAmount,
    ...(typeof parsedRiskPercent === 'number' ? { riskPercent: parsedRiskPercent } : {}),
    ...(parsedConfluenceScore ? { confluenceScore: parsedConfluenceScore } : {}),
    reasons,
    contextZones,
    rawText: text,
    validation,
    ...(conclusion ? { conclusion } : {}),
    ...(definition ? { definition } : {}),
    ...(parsedSymbol ? { symbol: parsedSymbol } : {}),
    ...(parsedSetupStatus ? { setupStatus: parsedSetupStatus } : {}),
  };
}

/**
 * Mengekstrak fallback simbol koin dari teks jika tidak tercantum secara eksplisit di tabel parameter.
 * Menggunakan pendekatan multi-tier berjenjang:
 * 1. Baris heading / judul setup (# ..., ## ..., Setup ..., Analisis ...)
 * 2. Baris narasi umum di luar tabel.
 *
 * Dilengkapi dengan filter konteks cerdas untuk mengabaikan penyebutan korelasi benchmark makro
 * (misal "Korelasi benchmark BTCUSDT", "Benchmark BTC", "relative to BTCUSDT", dll.)
 * agar rencana trading tidak tertukar ke instrumen pembanding.
 */
export function extractFallbackSymbol(text: string): string | undefined {
  if (!text || typeof text !== 'string') return undefined;

  // Pola pasangan dagang kripto umum (misal ETHUSDT, BTCUSDT.P, SOL/USDT, BTC-PERP)
  const candidateRegex = /\b([A-Z0-9]{2,10}(?:[\/-])?(?:USDT|BUSD|USDC|USD|BTC|IDR)(?:\.P)?)\b/gi;

  /**
   * Memeriksa apakah kemunculan kandidat simbol berada dalam konteks pembanding / benchmark korelasi.
   */
  const isBenchmarkContext = (line: string, rawCandidate: string): boolean => {
    const escaped = rawCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Simbol didahului kata kunci korelasi / benchmark / pembanding
    // Contoh: "Korelasi benchmark BTCUSDT", "Benchmark makro BTCUSDT", "Korelasi dengan BTCUSDT", "relative to BTCUSDT"
    const prefixBenchmarkPattern = new RegExp(
      `(?:korelasi(?:\\s+(?:benchmark|pasar|market|makro))?|benchmark(?:\\s+(?:aset|asset|koin|coin|pair|makro))?|correlation(?:\\s+(?:with|benchmark))?|correlated(?:\\s+with)?|vs\\.?|versus|relatif\\s+terhadap|relative\\s+to|dibandingkan(?:\\s+dengan)?|compared\\s+to|market\\s+leader)(?:\\s+\\w+){0,3}\\s*[:\\s-]*${escaped}\\b`,
      'i'
    );
    if (prefixBenchmarkPattern.test(line)) {
      return true;
    }

    // 2. Simbol diikuti kata kunci pembanding / benchmark
    // Contoh: "BTCUSDT sebagai benchmark", "BTCUSDT sebagai korelasi", "BTCUSDT as benchmark"
    const suffixBenchmarkPattern = new RegExp(
      `\\b${escaped}\\s+(?:sebagai|as|sebagai\\s+aset|sebagai\\s+pair)?\\s*(?:benchmark|korelasi|correlation|pembanding)\\b`,
      'i'
    );
    if (suffixBenchmarkPattern.test(line)) {
      return true;
    }

    return false;
  };

  const lines = text.split(/\r?\n/);

  // Tahap 1: Periksa baris judul/heading markdown (# ..., ## ..., dsb) atau label setup eksplisit
  for (const line of lines) {
    const trimmed = line.trim();
    const isHeadingOrTitle = /^(?:#{1,6}\s+|(?:\*{1,2}|_{1,2})?(?:setup|tesis|thesis|analisis|trading plan|plan)\s*[:\-])/i.test(trimmed);
    if (!isHeadingOrTitle) continue;

    candidateRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = candidateRegex.exec(trimmed)) !== null) {
      const rawCandidate = match[1];
      if (!isBenchmarkContext(trimmed, rawCandidate)) {
        return rawCandidate.replace(/[\/-]/g, '').toUpperCase();
      }
    }
  }

  // Tahap 2: Periksa baris-baris narasi teks biasa (lewati baris tabel markdown)
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) continue;

    candidateRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = candidateRegex.exec(trimmed)) !== null) {
      const rawCandidate = match[1];
      if (!isBenchmarkContext(trimmed, rawCandidate)) {
        return rawCandidate.replace(/[\/-]/g, '').toUpperCase();
      }
    }
  }

  return undefined;
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

