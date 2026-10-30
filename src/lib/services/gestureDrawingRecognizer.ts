/**
 * Core Gesture Recognizer & Heuristic Shape Classification Engine
 * Modul domain murni deterministik (latensi 0ms, 100% offline) untuk mengenali
 * gestur goresan bebas menjadi objek gambar teknikal linear presisi.
 *
 * Sesuai spesifikasi ADR-0013 & Tiket #104
 */

export type LinearGestureTool = 'hline' | 'vline' | 'ray' | 'trendline';

export interface GesturePoint {
  x: number;
  y: number;
  time?: number;
}

export interface GestureCandidate {
  tool: LinearGestureTool | string;
  confidence: number;
  label: string;
}

export interface GestureRecognitionResult {
  tool: LinearGestureTool | null;
  confidence: number;
  candidates: GestureCandidate[];
  points: Array<{ x: number; y: number }>;
}

export interface CandleWickItem {
  highY?: number;
  lowY?: number;
  high?: number;
  low?: number;
  x?: number;
  highPrice?: number;
  lowPrice?: number;
}

export interface GestureRecognizerOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  rightMarginThreshold?: number; // Margin ambang batas tepi kanan (default: 50px)
  wickSnapRadius?: number; // Radius magnet ekor lilin dalam piksel (default: 20px)
  isNearRightEdge?: boolean;
  candles?: Array<CandleWickItem | { high: number; low: number } | number>;
  wicks?: Array<CandleWickItem | { high: number; low: number } | number>;
}

export interface WickSnapResult {
  snapped: boolean;
  y: number;
  originalY: number;
  distance: number;
}

/**
 * Menghitung sudut kemiringan (slope angle) sapuan garis dalam derajat terhadap sumbu horizontal [0°..90°].
 * 0° menandakan garis horizontal sempurna, 90° menandakan garis vertikal sempurna.
 */
export function calculateStrokeAngle(stroke: GesturePoint[]): number {
  if (!stroke || stroke.length < 2) return 0;

  const start = stroke[0];
  const end = stroke[stroke.length - 1];

  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  if (dx === 0 && dy === 0) return 0;
  if (dx === 0) return 90;
  if (dy === 0) return 0;

  const radians = Math.atan2(dy, dx);
  return (radians * 180) / Math.PI;
}

/**
 * Menghitung jarak Euclidean linier antara dua titik
 */
function getEuclideanDistance(p1: GesturePoint, p2: GesturePoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Menambatkan koordinat Y ke level ekor lilin (candle wick High/Low) terdekat
 * dalam radius toleransi tertentu (default: 20px).
 */
export function snapToNearestCandleWick(
  targetY: number,
  candlesOrWicks: Array<CandleWickItem | { high: number; low: number } | number>,
  radius = 20
): WickSnapResult {
  if (!candlesOrWicks || candlesOrWicks.length === 0) {
    return { snapped: false, y: targetY, originalY: targetY, distance: 0 };
  }

  const candidateLevels: number[] = [];

  for (const item of candlesOrWicks) {
    if (typeof item === 'number') {
      if (!isNaN(item)) candidateLevels.push(item);
    } else if (item && typeof item === 'object') {
      const anyItem = item as any;
      if (typeof anyItem.highY === 'number' && !isNaN(anyItem.highY)) {
        candidateLevels.push(anyItem.highY);
      }
      if (typeof anyItem.lowY === 'number' && !isNaN(anyItem.lowY)) {
        candidateLevels.push(anyItem.lowY);
      }
      if (typeof anyItem.high === 'number' && !isNaN(anyItem.high) && typeof anyItem.highY !== 'number') {
        candidateLevels.push(anyItem.high);
      }
      if (typeof anyItem.low === 'number' && !isNaN(anyItem.low) && typeof anyItem.lowY !== 'number') {
        candidateLevels.push(anyItem.low);
      }
    }
  }

  let nearestY = targetY;
  let minDiff = Infinity;
  let found = false;

  for (const level of candidateLevels) {
    const diff = Math.abs(level - targetY);
    if (diff <= radius && diff < minDiff) {
      minDiff = diff;
      nearestY = level;
      found = true;
    }
  }

  if (found) {
    return {
      snapped: true,
      y: nearestY,
      originalY: targetY,
      distance: minDiff
    };
  }

  return {
    snapped: false,
    y: targetY,
    originalY: targetY,
    distance: 0
  };
}

/**
 * Mengklasifikasikan urutan titik koordinat sapuan mouse menjadi objek drawing linier definitif
 * ('hline' | 'vline' | 'ray' | 'trendline').
 */
export function recognizeGesture(
  stroke: GesturePoint[],
  options?: GestureRecognizerOptions
): GestureRecognitionResult {
  if (!stroke || stroke.length < 2) {
    return {
      tool: null,
      confidence: 0,
      candidates: [],
      points: []
    };
  }

  const start = stroke[0];
  const end = stroke[stroke.length - 1];
  const totalDisplacement = getEuclideanDistance(start, end);

  // Abaikan goresan mikro/jitter di bawah 10 piksel
  if (totalDisplacement < 10) {
    return {
      tool: null,
      confidence: 0,
      candidates: [],
      points: []
    };
  }

  const angle = calculateStrokeAngle(stroke);
  const wickList = options?.wicks || options?.candles || [];
  const wickRadius = options?.wickSnapRadius ?? 20;

  // 1. Horizontal Line (Sudut kemiringan < 7° dari horizontal)
  if (angle < 7) {
    const confidence = parseFloat((0.85 + (1 - angle / 7) * 0.15).toFixed(2));
    const avgY = (start.y + end.y) / 2;
    const snap = snapToNearestCandleWick(avgY, wickList, wickRadius);
    const finalY = snap.snapped ? snap.y : avgY;

    const points = [
      { x: start.x, y: finalY },
      { x: end.x, y: finalY }
    ];

    const candidates: GestureCandidate[] = [
      { tool: 'hline', confidence, label: 'Horizontal Line' },
      { tool: 'ray', confidence: parseFloat((confidence * 0.75).toFixed(2)), label: 'Ray' },
      { tool: 'trendline', confidence: parseFloat((confidence * 0.6).toFixed(2)), label: 'Trend Line' }
    ];

    return {
      tool: 'hline',
      confidence,
      candidates,
      points
    };
  }

  // 2. Vertical Line (Sudut kemiringan > 83° dari horizontal)
  if (angle > 83) {
    const confidence = parseFloat((0.85 + ((angle - 83) / 7) * 0.15).toFixed(2));
    const avgX = (start.x + end.x) / 2;

    const points = [
      { x: avgX, y: start.y },
      { x: avgX, y: end.y }
    ];

    const candidates: GestureCandidate[] = [
      { tool: 'vline', confidence, label: 'Vertical Line' },
      { tool: 'trendline', confidence: parseFloat((confidence * 0.5).toFixed(2)), label: 'Trend Line' }
    ];

    return {
      tool: 'vline',
      confidence,
      candidates,
      points
    };
  }

  // 3 & 4: Garis Diagonal (Antara 7° dan 83°)
  const dx = end.x - start.x;
  const marginThreshold = options?.rightMarginThreshold ?? 50;

  const isNearRight =
    Boolean(options?.isNearRightEdge) ||
    (typeof options?.canvasWidth === 'number' && end.x >= options.canvasWidth - marginThreshold);

  // Jika ditarik ke kanan dan titik akhirnya mendekati sumbu harga kanan -> Ray
  if (dx > 0 && isNearRight) {
    const confidence = 0.9;
    let startY = start.y;
    let endY = end.y;

    // Cek snap wick pada titik awal jika dekat ekor lilin
    const snapStart = snapToNearestCandleWick(startY, wickList, wickRadius);
    if (snapStart.snapped) {
      startY = snapStart.y;
    }

    const points = [
      { x: start.x, y: startY },
      { x: end.x, y: endY }
    ];

    const candidates: GestureCandidate[] = [
      { tool: 'ray', confidence, label: 'Ray' },
      { tool: 'trendline', confidence: parseFloat((confidence * 0.85).toFixed(2)), label: 'Trend Line' },
      { tool: 'hline', confidence: parseFloat((confidence * 0.6).toFixed(2)), label: 'Horizontal Line' }
    ];

    return {
      tool: 'ray',
      confidence,
      candidates,
      points
    };
  }

  // Garis diagonal biasa -> Trend Line
  const confidence = 0.9;
  const points = [
    { x: start.x, y: start.y },
    { x: end.x, y: end.y }
  ];

  const candidates: GestureCandidate[] = [
    { tool: 'trendline', confidence, label: 'Trend Line' },
    { tool: 'ray', confidence: parseFloat((confidence * 0.8).toFixed(2)), label: 'Ray' },
    { tool: 'hline', confidence: parseFloat((confidence * 0.5).toFixed(2)), label: 'Horizontal Line' }
  ];

  return {
    tool: 'trendline',
    confidence,
    candidates,
    points
  };
}
