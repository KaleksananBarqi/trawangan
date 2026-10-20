/**
 * Layanan penambatan harga presisi (Tick-Aligned Price Guard) dan penambatan lilin (OHLC Magnet Snapping)
 * Sesuai spesifikasi ADR 0010 & GLOSSARY.md
 */

import type { Candle } from '../types/market';

export type CandlestickBar = Partial<Candle> & {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type OhlcPointType = 'high' | 'low' | 'open' | 'close';

export interface FindOhlcSnapParams {
  targetPrice: number;
  targetY: number;
  candles: CandlestickBar[];
  getPriceY: (price: number) => number | null;
  getTimeX?: (time: number) => number | null;
  tolerancePx?: number;
  isMagnetActive?: boolean;
  shiftKey?: boolean;
  tickSize?: number;
}

export interface OhlcSnapResult {
  snapped: boolean;
  price: number;
  snappedType: OhlcPointType | null;
  candleTime?: number;
  candleY?: number;
  distancePx?: number;
}

/**
 * Menghitung ukuran tick adaptif berdasarkan magnitudo nominal harga
 * jika tickSize resmi bursa tidak tersedia.
 */
export function getAdaptiveTickSize(price: number, explicitTickSize?: number): number {
  if (typeof explicitTickSize === 'number' && !isNaN(explicitTickSize) && explicitTickSize > 0) {
    return explicitTickSize;
  }

  const absPrice = Math.abs(price);
  if (absPrice >= 1000) {
    return 0.01;
  }
  if (absPrice >= 1) {
    return 0.0001;
  }
  if (absPrice >= 0.001) {
    return 0.000001;
  }
  return 0.00000001;
}

/**
 * Membulatkan harga sesuai kelipatan tickSize (Tick-Aligned Price Guard).
 * Mencegah floating-point noise dan angka desimal liar.
 */
export function roundToTickSize(rawPrice: number, explicitTickSize?: number): number {
  if (typeof rawPrice !== 'number' || isNaN(rawPrice)) {
    return 0;
  }
  if (rawPrice === 0) return 0;

  const step = getAdaptiveTickSize(rawPrice, explicitTickSize);
  if (step <= 0) return rawPrice;

  // Tentukan jumlah desimal dari step
  const stepStr = step.toString();
  let decimals = 0;
  if (stepStr.includes('.')) {
    decimals = stepStr.split('.')[1].length;
  } else if (stepStr.includes('e-')) {
    decimals = parseInt(stepStr.split('e-')[1], 10);
  }

  // Lakukan kuantisasi terhadap step
  const factor = 1 / step;
  const rounded = Math.round(rawPrice * factor) / factor;

  // Normalisasi presisi untuk menghilangkan artefak floating point IEEE-754
  return parseFloat(rounded.toFixed(Math.min(decimals + 2, 10)));
}

/**
 * Mencari titik lilin OHLC terdekat dalam radius toleransi piksel tertentu.
 * Menghormati prioritas High/Low di atas Open/Close serta pembalik Shift Inversion Guard.
 */
export function findNearestOhlcPoint(params: FindOhlcSnapParams): OhlcSnapResult {
  const {
    targetPrice,
    targetY,
    candles,
    getPriceY,
    tolerancePx = 15,
    isMagnetActive = false,
    shiftKey = false,
    tickSize,
  } = params;

  // Shift Inversion Guard: Jika shift ditekan, balik status magnet
  const effectiveMagnet = shiftKey ? !isMagnetActive : isMagnetActive;

  // Jika magnet tidak efektif, kembalikan harga yang telah disanitasi oleh Tick Guard
  if (!effectiveMagnet || !candles || candles.length === 0 || typeof getPriceY !== 'function') {
    return {
      snapped: false,
      price: roundToTickSize(targetPrice, tickSize),
      snappedType: null,
    };
  }

  interface Candidate {
    type: OhlcPointType;
    price: number;
    y: number;
    distance: number;
    priority: number; // 1 = High/Low, 2 = Open/Close
    candleTime: number;
  }

  const candidates: Candidate[] = [];

  for (const candle of candles) {
    if (!candle) continue;

    const points: Array<{ type: OhlcPointType; price: number; priority: number }> = [
      { type: 'high', price: candle.high, priority: 1 },
      { type: 'low', price: candle.low, priority: 1 },
      { type: 'open', price: candle.open, priority: 2 },
      { type: 'close', price: candle.close, priority: 2 },
    ];

    for (const pt of points) {
      if (typeof pt.price !== 'number' || isNaN(pt.price)) continue;
      const py = getPriceY(pt.price);
      if (py === null || isNaN(py)) continue;

      const dist = Math.abs(py - targetY);
      if (dist <= tolerancePx) {
        candidates.push({
          type: pt.type,
          price: pt.price,
          y: py,
          distance: dist,
          priority: pt.priority,
          candleTime: candle.time,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return {
      snapped: false,
      price: roundToTickSize(targetPrice, tickSize),
      snappedType: null,
    };
  }

  // Urutkan kandidat:
  // 1. Jarak Euclidean / selisih piksel Y terkecil
  // 2. Jika selisih jarak sangat kecil (<= 1.5px), utamakan prioritas High/Low (priority 1)
  candidates.sort((a, b) => {
    const diff = a.distance - b.distance;
    if (Math.abs(diff) <= 1.5) {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
    }
    return diff;
  });

  const best = candidates[0];

  return {
    snapped: true,
    price: roundToTickSize(best.price, tickSize),
    snappedType: best.type,
    candleTime: best.candleTime,
    candleY: best.y,
    distancePx: best.distance,
  };
}
