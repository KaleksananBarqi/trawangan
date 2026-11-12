import type { AlertCondition, AlertFrequency, PriceAlert } from '../types/market';
import {
  buildSymbolSuggestionList,
  isSameInstrument,
  resolveCanonicalInstrumentSymbol,
} from './instrumentIdentity';
import { formatMacroCompactValue, resolveMacroIndexDescriptor } from './macroIndexCatalog';
import { getAdaptiveTickSize, roundToTickSize } from './priceSnapService';

export interface AlertModalDraft {
  symbol: string;
  targetPrice: string;
  condition: AlertCondition;
  frequency: AlertFrequency;
  label: string;
}

export interface AlertModalSessionGuardParams {
  isOpen: boolean;
  wasOpen: boolean;
  initSignature: string;
  lastInitSignature: string | null;
}

export interface AlertModalSessionGuardResult {
  shouldInit: boolean;
  nextWasOpen: boolean;
  nextSignature: string | null;
}

/**
 * Mengurai string harga target manual dengan dukungan format desimal titik/koma,
 * pemisah ribuan, serta awalan simbol mata uang ($ / Rp). Mengembalikan `null` jika tidak valid.
 */
export function parseAlertPriceInput(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw !== 'string') return null;

  let cleaned = raw
    .trim()
    .replace(/^(?:(?:rp|idr|usdt?|usd)(?=[\s\d])|[\$€£₺])\s*/i, '')
    .replace(/\s*(?:(?<=[\s\d])(?:rp|idr|usdt?|usd)|[\$€£₺₿%])$/i, '')
    .replace(/\s+/g, '');
  if (!cleaned) return null;

  let multiplier = 1;
  const suffixMatch = cleaned.match(/^(.+?)([TBM])$/i);
  if (suffixMatch) {
    const unit = suffixMatch[2].toUpperCase();
    multiplier = unit === 'T' ? 1e12 : unit === 'B' ? 1e9 : 1e6;
    cleaned = suffixMatch[1];
  }

  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  if (dotCount > 0 && commaCount > 0) {
    // Format ribuan titik + koma desimal (mis. "1.450.000,50") vs format US ("65,432.10")
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (commaCount > 0) {
    if (commaCount > 1) {
      // Beberapa koma menandakan pemisah ribuan (mis. "1,250,000")
      cleaned = cleaned.replace(/,/g, '');
    } else if (/^[1-9]\d{0,2},\d{3}$/.test(cleaned)) {
      // Koma ribuan klasik seperti "2,500" atau "61,500"
      cleaned = cleaned.replace(',', '');
    } else {
      // Desimal koma tunggal (mis. "0,00045", "65432,5", "2,45")
      cleaned = cleaned.replace(',', '.');
    }
  } else if (dotCount > 1) {
    // Beberapa titik menandakan pemisah ribuan gaya Indonesia tanpa desimal (mis. "1.450.000")
    cleaned = cleaned.replace(/\./g, '');
  }

  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) {
    return null;
  }

  const parsed = Number(cleaned) * multiplier;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Mengkanonisasikan simbol target alert (mis. "eth/usdt", "eth", "binance:SOL/USDT.P")
 * dengan fallback ke simbol aktif apabila input dikosongkan.
 */
export function resolveAlertTargetSymbol(
  rawSymbol?: string | null,
  fallbackSymbol = 'BTCUSDT'
): string {
  const safeFallback = resolveCanonicalInstrumentSymbol(fallbackSymbol, 'BTCUSDT');
  const trimmed = typeof rawSymbol === 'string' ? rawSymbol.trim() : '';
  if (!trimmed) return safeFallback;
  return resolveCanonicalInstrumentSymbol(trimmed, safeFallback);
}

/**
 * Membentuk signature sesi pembukaan modal alert yang TIDAK bergantung pada `currentMarketPrice`
 * agar pembaruan ticker live tidak pernah memicu inisialisasi ulang input manual pengguna.
 */
export function buildAlertModalInitSignature(params: {
  initialSymbol?: string;
  initialPrice?: number;
  editingAlert?: PriceAlert | null;
}): string {
  if (params.editingAlert) {
    const a = params.editingAlert;
    return [
      'edit',
      a.id,
      a.symbol,
      String(a.targetPrice),
      a.condition || 'crossing',
      a.frequency || 'once',
      a.label || '',
    ].join('|');
  }
  return [
    'create',
    (params.initialSymbol || 'BTCUSDT').trim().toUpperCase(),
    params.initialPrice !== undefined && params.initialPrice > 0 ? String(params.initialPrice) : '',
  ].join('|');
}

/**
 * Menjaga agar efek pembukaan modal hanya mengisi form SEKALI saat modal dibuka
 * atau saat target alert yang disunting/dibuka benar-benar berganti.
 */
export function shouldInitializeAlertModalSession(
  params: AlertModalSessionGuardParams
): AlertModalSessionGuardResult {
  if (!params.isOpen) {
    return {
      shouldInit: false,
      nextWasOpen: false,
      nextSignature: null,
    };
  }

  if (!params.wasOpen || params.lastInitSignature !== params.initSignature) {
    return {
      shouldInit: true,
      nextWasOpen: true,
      nextSignature: params.initSignature,
    };
  }

  return {
    shouldInit: false,
    nextWasOpen: true,
    nextSignature: params.lastInitSignature,
  };
}

/**
 * Menyimpulkan kondisi pemicu cerdas dari posisi harga target dibanding harga pasar referensi.
 */
export function inferAlertConditionFromPrice(
  targetPrice: number,
  referenceMarketPrice: number
): AlertCondition {
  if (referenceMarketPrice > 0 && targetPrice > 0) {
    if (targetPrice > referenceMarketPrice) return 'crossing_up';
    if (targetPrice < referenceMarketPrice) return 'crossing_down';
  }
  return 'crossing';
}

function formatEditableAlertPrice(price: number, symbol: string): string {
  const macroDesc = resolveMacroIndexDescriptor(symbol);
  if (!macroDesc) return price.toString();
  if (macroDesc.quoteUnit === '%') {
    return price.toFixed(2).replace(/\.?0+$/, '') || price.toFixed(2);
  }
  const abs = Math.abs(price);
  if (abs >= 1e12) return `${(price / 1e12).toFixed(3).replace(/\.?0+$/, '')}T`;
  if (abs >= 1e9) return `${(price / 1e9).toFixed(3).replace(/\.?0+$/, '')}B`;
  if (abs >= 1e6) return `${(price / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
  return String(Math.round(price));
}

/**
 * Membentuk label default yang konsisten untuk sebuah Price Alert.
 */
export function buildAutoAlertLabel(symbol: string, rawPriceText: string | number): string {
  const cleanSym = (symbol || 'BTCUSDT').trim().toUpperCase();
  const macroDesc = resolveMacroIndexDescriptor(cleanSym);
  if (macroDesc) {
    const parsed = parseAlertPriceInput(rawPriceText);
    if (parsed !== null) {
      const compact = formatMacroCompactValue(parsed, macroDesc.quoteUnit);
      return `Target ${macroDesc.symbol} @ ${macroDesc.quoteUnit === 'USD' ? `$${compact}` : compact}`;
    }
  }
  const cleanPrice = typeof rawPriceText === 'number' ? String(rawPriceText) : rawPriceText.trim();
  return cleanPrice ? `Target ${cleanSym} @ ${cleanPrice}` : `Target ${cleanSym}`;
}

/**
 * Membangun draft nilai awal modal Alert ketika sesi baru dibuka.
 */
export function buildAlertModalInitialDraft(params: {
  initialSymbol?: string;
  initialPrice?: number;
  currentMarketPrice?: number;
  editingAlert?: PriceAlert | null;
}): AlertModalDraft {
  const { initialSymbol = 'BTCUSDT', initialPrice, currentMarketPrice = 0, editingAlert } = params;

  if (editingAlert) {
    const cleanSym = editingAlert.symbol.trim().toUpperCase();
    const targetPrice = formatEditableAlertPrice(editingAlert.targetPrice, cleanSym);
    return {
      symbol: cleanSym,
      targetPrice,
      condition: editingAlert.condition || 'crossing',
      frequency: editingAlert.frequency || 'once',
      label: editingAlert.label || buildAutoAlertLabel(cleanSym, targetPrice),
    };
  }

  const symbol = resolveAlertTargetSymbol(initialSymbol, 'BTCUSDT');
  const curP = currentMarketPrice > 0 ? currentMarketPrice : 0;

  let targetPrice = '';
  let condition: AlertCondition = 'crossing';

  if (initialPrice !== undefined && initialPrice > 0) {
    targetPrice = formatEditableAlertPrice(initialPrice, symbol);
    condition = inferAlertConditionFromPrice(initialPrice, curP);
  } else if (curP > 0) {
    targetPrice = formatEditableAlertPrice(curP, symbol);
    condition = 'crossing_up';
  }

  return {
    symbol,
    targetPrice,
    condition,
    frequency: 'once',
    label: buildAutoAlertLabel(symbol, targetPrice),
  };
}

/**
 * Mengisolasi harga pasar referensi berdasarkan simbol yang diketik pengguna pada form alert.
 * Apabila pengguna mengganti koin ke selain simbol chart aktif (mis. mengetik ETHUSDT saat chart BTCUSDT),
 * harga `chartMarketPrice` TIDAK pernah dibocorkan ke kalkulasi preset/jarak koin lain.
 */
export function resolveAlertReferenceMarketPrice(params: {
  typedSymbol: string;
  chartSymbol: string;
  chartMarketPrice: number;
  cachedTickerPrice?: number | null;
}): number {
  const chartSym = resolveAlertTargetSymbol(params.chartSymbol, 'BTCUSDT');
  const targetSym = resolveAlertTargetSymbol(params.typedSymbol, chartSym);

  if (isSameInstrument(targetSym, chartSym)) {
    if (params.chartMarketPrice > 0) return params.chartMarketPrice;
    return params.cachedTickerPrice && params.cachedTickerPrice > 0 ? params.cachedTickerPrice : 0;
  }

  return params.cachedTickerPrice && params.cachedTickerPrice > 0 ? params.cachedTickerPrice : 0;
}

/**
 * Menghitung selisih nominal dan persentase antara harga target manual dan harga referensi koin target.
 */
export function computeAlertPriceDiff(
  rawTargetPrice: string,
  referenceMarketPrice: number
): { diff: number; pct: number; isHigher: boolean } | null {
  const parsed = parseAlertPriceInput(rawTargetPrice);
  if (!parsed || !referenceMarketPrice || referenceMarketPrice <= 0) {
    return null;
  }
  const diff = parsed - referenceMarketPrice;
  const pct = (diff / referenceMarketPrice) * 100;
  return {
    diff,
    pct,
    isHigher: diff > 0,
  };
}

function getTickStepDecimals(step: number): number {
  const stepStr = step.toString();
  if (stepStr.includes('.')) {
    return Math.min(stepStr.split('.')[1].length, 8);
  }
  if (stepStr.includes('e-')) {
    return Math.min(parseInt(stepStr.split('e-')[1], 10) || 0, 8);
  }
  return 0;
}

/**
 * Menyelaraskan harga target alert (preset maupun submit) ke kelipatan tickSize valid
 * agar input modal, auto-label, dan penyimpanan di alertService konsisten (Tick-Aligned Price Guard).
 */
export function computeTickAlignedAlertPrice(
  rawPrice: number,
  isSameAsChart: boolean,
  chartTickSize?: number,
  symbol?: string
): { price: number; formattedText: string } {
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
    return { price: 0, formattedText: '' };
  }
  const effectiveTick =
    isSameAsChart && typeof chartTickSize === 'number' && chartTickSize > 0
      ? chartTickSize
      : getAdaptiveTickSize(rawPrice, undefined, symbol);
  const snapped = roundToTickSize(rawPrice, effectiveTick, symbol);
  const macroDesc = symbol ? resolveMacroIndexDescriptor(symbol) : null;
  if (macroDesc) {
    return { price: snapped, formattedText: formatEditableAlertPrice(snapped, symbol!) };
  }
  const decimals = getTickStepDecimals(effectiveTick);
  const fixed = decimals > 0 ? snapped.toFixed(decimals) : String(snapped);
  const trimmed = decimals > 0 ? fixed.replace(/\.?0+$/, '') || fixed : fixed;
  return { price: snapped, formattedText: trimmed };
}

/**
 * Menggabungkan daftar saran simbol terurut dan bebas duplikat untuk datalist form alert.
 */
export function mergeAlertSymbolSuggestions(
  activeSymbol: string,
  availableSymbols?: string[],
  currentSymbol?: string
): string[] {
  return buildSymbolSuggestionList([currentSymbol, activeSymbol], availableSymbols || []);
}
