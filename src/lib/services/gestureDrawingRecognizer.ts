/**
 * Core Gesture Recognizer & Heuristic Shape Classification Engine
 * Modul domain murni deterministik (latensi 0ms, 100% offline) untuk mengenali
 * gestur goresan bebas menjadi objek gambar teknikal presisi:
 * - Bentuk Linier: 'hline', 'vline', 'ray', 'trendline' (Tiket #104)
 * - Bentuk Geometris Kompleks: 'box', 'ellipse', 'arrow', 'fibretracement', 'path' (Tiket #105)
 *
 * Sesuai spesifikasi ADR-0013, Tiket #104 & Tiket #105
 */

export type LinearGestureTool = 'hline' | 'vline' | 'ray' | 'trendline';
export type ComplexGestureTool = 'box' | 'ellipse' | 'arrow' | 'fibretracement' | 'path';
export type GestureTool = LinearGestureTool | ComplexGestureTool | 'scribble';

export interface GesturePoint {
  x: number;
  y: number;
  time?: number;
}

export interface ScribbleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GestureCandidate {
  tool: GestureTool | string;
  confidence: number;
  label: string;
}

export interface GestureRecognitionResult {
  tool: GestureTool | null;
  confidence: number;
  candidates: GestureCandidate[];
  points: Array<{ x: number; y: number }>;
  scribbleBounds?: ScribbleBounds;
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

/**
 * Tipe target level ekor lilin untuk snapping koordinat Y (objek wick/candle atau nilai koordinat y langsung)
 */
export type CandleWickTarget = CandleWickItem | number;

export interface GestureRecognizerOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  rightMarginThreshold?: number; // Margin ambang batas tepi kanan (default: 50px)
  wickSnapRadius?: number; // Radius magnet ekor lilin dalam piksel (default: 20px)
  isNearRightEdge?: boolean;
  candles?: CandleWickTarget[];
  wicks?: CandleWickTarget[];
}

export interface WickSnapResult {
  snapped: boolean;
  y: number;
  originalY: number;
  distance: number;
}

export interface StrokeMetrics {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  diagonal: number;
  perimeter: number;
  boxArea: number;
  pathLength: number;
  displacement: number;
}

/**
 * Menghitung jarak titik p ke segmen garis ab
 */
function pointToSegmentDistance(p: GesturePoint, a: GesturePoint, b: GesturePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Algoritma Ramer-Douglas-Peucker (RDP) untuk simplifikasi kurva titik koordinat
 */
export function simplifyRDP(points: GesturePoint[], epsilon: number): GesturePoint[] {
  if (points.length <= 2) return [...points];
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegmentDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

/**
 * Menghitung sudut belokan (turn angle) pada titik tengah pCurr antara pPrev dan pNext dalam derajat [0°..180°].
 * 0° menandakan garis lurus searah, 90° belokan tegak lurus, 180° pembalikan arah penuh.
 */
export function calculateTurnAngle(pPrev: GesturePoint, pCurr: GesturePoint, pNext: GesturePoint): number {
  const v1x = pCurr.x - pPrev.x;
  const v1y = pCurr.y - pPrev.y;
  const v2x = pNext.x - pCurr.x;
  const v2y = pNext.y - pCurr.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);

  if (mag1 === 0 || mag2 === 0) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Menghitung luas poligon menggunakan algoritma Shoelace
 */
export function calculatePolygonArea(points: GesturePoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    sum += points[i].x * points[next].y - points[next].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Menghitung dimensi batas (bounding box) dan metriks kinematik goresan
 */
export function computeStrokeMetrics(stroke: GesturePoint[]): StrokeMetrics {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let pathLength = 0;

  for (let i = 0; i < stroke.length; i++) {
    const p = stroke[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      pathLength += Math.hypot(p.x - stroke[i - 1].x, p.y - stroke[i - 1].y);
    }
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const diagonal = Math.hypot(width, height);
  const perimeter = 2 * (width + height);
  const boxArea = width * height;
  const displacement = stroke.length >= 2
    ? Math.hypot(stroke[stroke.length - 1].x - stroke[0].x, stroke[stroke.length - 1].y - stroke[0].y)
    : 0;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    diagonal,
    perimeter,
    boxArea,
    pathLength,
    displacement
  };
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
 * Menghitung frekuensi pembalikan arah koordinat pada goresan
 * Digunakan untuk mendeteksi sapuan coretan zigzag rapat (scribble to erase)
 */
export function countCoordinateReversals(stroke: GesturePoint[]): {
  reversalsX: number;
  reversalsY: number;
  maxReversals: number;
} {
  if (stroke.length < 3) return { reversalsX: 0, reversalsY: 0, maxReversals: 0 };

  // Simplifikasi RDP ringan (epsilon 3px) untuk mengeliminasi jitter mikro mouse
  const simplified = simplifyRDP(stroke, 3);
  if (simplified.length < 3) return { reversalsX: 0, reversalsY: 0, maxReversals: 0 };

  let reversalsX = 0;
  let reversalsY = 0;

  let lastDx = 0;
  let lastDy = 0;

  for (let i = 1; i < simplified.length; i++) {
    const dx = simplified[i].x - simplified[i - 1].x;
    const dy = simplified[i].y - simplified[i - 1].y;

    if (Math.abs(dx) >= 3) {
      if (lastDx !== 0 && ((dx > 0 && lastDx < 0) || (dx < 0 && lastDx > 0))) {
        reversalsX++;
      }
      lastDx = dx;
    }

    if (Math.abs(dy) >= 3) {
      if (lastDy !== 0 && ((dy > 0 && lastDy < 0) || (dy < 0 && lastDy > 0))) {
        reversalsY++;
      }
      lastDy = dy;
    }
  }

  const maxReversals = Math.max(reversalsX, reversalsY);
  return { reversalsX, reversalsY, maxReversals };
}

/**
 * Menghitung jarak Euclidean linier antara dua titik
 */
function getEuclideanDistance(p1: GesturePoint, p2: GesturePoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

/**
 * Menambatkan koordinat Y ke level ekor lilin (candle wick High/Low) terdekat
 * dalam radius toleransi tertentu (default: 20px).
 */
export function snapToNearestCandleWick(
  targetY: number,
  candlesOrWicks: CandleWickTarget[],
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
 * Mengklasifikasikan urutan titik koordinat sapuan mouse menjadi objek drawing definitif
 * ('box' | 'ellipse' | 'arrow' | 'fibretracement' | 'path' | 'hline' | 'vline' | 'ray' | 'trendline').
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

  const metrics = computeStrokeMetrics(stroke);
  const start = stroke[0];
  const end = stroke[stroke.length - 1];

  // Abaikan goresan mikro/jitter di bawah 10 piksel
  if (metrics.displacement < 10 && metrics.pathLength < 10) {
    return {
      tool: null,
      confidence: 0,
      candidates: [],
      points: []
    };
  }

  if (stroke.length === 2 && metrics.displacement < 10) {
    return {
      tool: null,
      confidence: 0,
      candidates: [],
      points: []
    };
  }

  const wickList = options?.wicks || options?.candles || [];
  const wickRadius = options?.wickSnapRadius ?? 20;

  // ─────────────────────────────────────────────────────────────
  // 0. Deteksi Scribble to Erase (Pola Zigzag Bolak-balik Rapat)
  // Kriteria: pembalikan arah koordinat (> 3 reversal) dan
  // rasio panjang total jejak goresan terhadap diagonal bounding box (> 3.5)
  // ─────────────────────────────────────────────────────────────
  const { reversalsX, reversalsY, maxReversals } = countCoordinateReversals(stroke);
  const lengthToDiagRatio = metrics.diagonal > 0 ? metrics.pathLength / metrics.diagonal : 0;
  const isScribble =
    (maxReversals > 3 || (reversalsX + reversalsY) > 4) &&
    lengthToDiagRatio > 3.5 &&
    metrics.diagonal >= 10;

  if (isScribble) {
    const confidence = 0.95;
    const scribbleBounds: ScribbleBounds = {
      minX: metrics.minX,
      minY: metrics.minY,
      maxX: metrics.maxX,
      maxY: metrics.maxY
    };

    return {
      tool: 'scribble',
      confidence,
      candidates: [
        { tool: 'scribble', confidence, label: 'Scribble Erase' }
      ],
      points: [
        { x: metrics.minX, y: metrics.minY },
        { x: metrics.maxX, y: metrics.maxY }
      ],
      scribbleBounds
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 1. Goresan Tertutup (Closed Loop): Box vs Ellipse
  // Kriteria: jarak titik awal ke titik akhir < 25% dari diagonal atau keliling
  // ─────────────────────────────────────────────────────────────
  const isClosed =
    (metrics.displacement < 0.25 * metrics.diagonal || metrics.displacement < 0.25 * metrics.perimeter) &&
    metrics.width >= 15 &&
    metrics.height >= 15 &&
    metrics.pathLength >= 40;

  if (isClosed) {
    const epsilon = Math.max(6, metrics.diagonal * 0.06);
    const simplified = simplifyRDP(stroke, epsilon);

    // Hitung jumlah sudut siku-siku (~90° antara 55° s/d 130°)
    let rightAngleCount = 0;
    for (let i = 1; i < simplified.length - 1; i++) {
      const angle = calculateTurnAngle(simplified[i - 1], simplified[i], simplified[i + 1]);
      if (angle >= 55 && angle <= 130) {
        rightAngleCount++;
      }
    }

    if (simplified.length >= 3) {
      const pPrev = simplified[simplified.length - 2];
      const pCurr = simplified[0];
      const pNext = simplified[1];
      const closeAngle = calculateTurnAngle(pPrev, pCurr, pNext);
      if (closeAngle >= 55 && closeAngle <= 130) {
        rightAngleCount++;
      }
    }

    const polyArea = calculatePolygonArea(stroke);
    const areaRatio = metrics.boxArea > 0 ? polyArea / metrics.boxArea : 0;

    // Kriteria Box: 4 sudut tegas (~90°) ATAU rasio luas terhadap bounding box mendekati persegi panjang (>= 0.82)
    const isBox = rightAngleCount >= 3 || areaRatio >= 0.82;

    if (isBox) {
      const confidence = parseFloat(Math.min(0.95, 0.85 + (areaRatio >= 0.8 ? 0.10 : 0.05)).toFixed(2));
      const points = [
        { x: metrics.minX, y: metrics.minY },
        { x: metrics.maxX, y: metrics.maxY }
      ];
      const candidates: GestureCandidate[] = [
        { tool: 'box', confidence, label: 'Rectangle / Box' },
        { tool: 'ellipse', confidence: parseFloat((confidence * 0.75).toFixed(2)), label: 'Ellipse' }
      ];
      return {
        tool: 'box',
        confidence,
        candidates,
        points
      };
    } else {
      // Ellipse: kurva tertutup mulus tanpa sudut siku-siku tajam
      const confidence = 0.90;
      const points = [
        { x: metrics.minX, y: metrics.minY },
        { x: metrics.maxX, y: metrics.maxY }
      ];
      const candidates: GestureCandidate[] = [
        { tool: 'ellipse', confidence, label: 'Ellipse' },
        { tool: 'box', confidence: 0.70, label: 'Rectangle / Box' }
      ];
      return {
        tool: 'ellipse',
        confidence,
        candidates,
        points
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Arrow Recognition
  // Goresan berbatang lurus dengan kait panah di ujung akhir (terminal hook)
  // ─────────────────────────────────────────────────────────────
  const rdpArrow = simplifyRDP(stroke, Math.max(5, metrics.diagonal * 0.04));
  if (rdpArrow.length >= 3) {
    const tipCandidate = rdpArrow[rdpArrow.length - 2];
    const hookEnd = rdpArrow[rdpArrow.length - 1];
    const shaftLen = Math.hypot(tipCandidate.x - start.x, tipCandidate.y - start.y);
    const hookLen = Math.hypot(hookEnd.x - tipCandidate.x, hookEnd.y - tipCandidate.y);
    const turnAngleAtTip = calculateTurnAngle(start, tipCandidate, hookEnd);

    const isArrow =
      shaftLen >= 25 &&
      hookLen >= 6 &&
      hookLen <= 0.45 * shaftLen &&
      shaftLen / (shaftLen + hookLen) >= 0.55 &&
      turnAngleAtTip >= 70;

    if (isArrow) {
      const confidence = 0.90;
      const points = [
        { x: start.x, y: start.y },
        { x: tipCandidate.x, y: tipCandidate.y }
      ];
      const candidates: GestureCandidate[] = [
        { tool: 'arrow', confidence, label: 'Arrow' },
        { tool: 'trendline', confidence: 0.75, label: 'Trend Line' },
        { tool: 'ray', confidence: 0.60, label: 'Ray' }
      ];
      return {
        tool: 'arrow',
        confidence,
        candidates,
        points
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Fibonacci Retracement Recognition
  // Goresan 3 segmen ayunan (bentuk huruf Z atau N dari puncak ke lembah) dengan 2 titik belok utama.
  // Mendukung wick snapping pada level ekstrim.
  // ─────────────────────────────────────────────────────────────
  const rdpFib = simplifyRDP(stroke, Math.max(8, metrics.diagonal * 0.08));
  if (rdpFib.length === 4) {
    const p0 = rdpFib[0];
    const p1 = rdpFib[1];
    const p2 = rdpFib[2];
    const p3 = rdpFib[3];

    const turn1 = calculateTurnAngle(p0, p1, p2);
    const turn2 = calculateTurnAngle(p1, p2, p3);

    const len1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const len2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const len3 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
    const totalSegLen = len1 + len2 + len3;

    const dx1 = p1.x - p0.x;
    const dx2 = p2.x - p1.x;
    const dx3 = p3.x - p2.x;

    const dy1 = p1.y - p0.y;
    const dy2 = p2.y - p1.y;
    const dy3 = p3.y - p2.y;

    const isZReversal = (dx1 * dx2 < 0 && dx2 * dx3 < 0);
    const isNReversal = (dy1 * dy2 < 0 && dy2 * dy3 < 0);

    const isFib =
      turn1 >= 40 &&
      turn2 >= 40 &&
      len1 >= 0.15 * totalSegLen &&
      len2 >= 0.15 * totalSegLen &&
      len3 >= 0.15 * totalSegLen &&
      len3 >= 15 &&
      (isZReversal || isNReversal || (turn1 >= 50 && turn2 >= 50));

    if (isFib) {
      const allY = [p0.y, p1.y, p2.y, p3.y];
      const minY = Math.min(...allY);
      const maxY = Math.max(...allY);

      // Snap level ekstrim pada High wick dan Low wick lilin
      const snapHigh = snapToNearestCandleWick(minY, wickList, wickRadius);
      const finalMinY = snapHigh.snapped ? snapHigh.y : minY;

      const snapLow = snapToNearestCandleWick(maxY, wickList, wickRadius);
      const finalMaxY = snapLow.snapped ? snapLow.y : maxY;

      const isDownward = p0.y <= p3.y;
      const startY = isDownward ? finalMinY : finalMaxY;
      const endY = isDownward ? finalMaxY : finalMinY;

      const points = [
        { x: p0.x, y: startY },
        { x: p3.x, y: endY }
      ];

      const candidates: GestureCandidate[] = [
        { tool: 'fibretracement', confidence: 0.90, label: 'Fib Retracement' },
        { tool: 'path', confidence: 0.70, label: 'Path' },
        { tool: 'trendline', confidence: 0.50, label: 'Trend Line' }
      ];

      return {
        tool: 'fibretracement',
        confidence: 0.90,
        candidates,
        points
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Path / Polyline Recognition
  // Goresan poliline terbuka dengan banyak lekukan/sudut tajam (> 2 belokan)
  // yang tidak memenuhi kriteria panah atau fib.
  // ─────────────────────────────────────────────────────────────
  const rdpPath = simplifyRDP(stroke, Math.max(8, metrics.diagonal * 0.06));
  let sharpTurnsCount = 0;
  for (let i = 1; i < rdpPath.length - 1; i++) {
    const angle = calculateTurnAngle(rdpPath[i - 1], rdpPath[i], rdpPath[i + 1]);
    if (angle >= 35) {
      sharpTurnsCount++;
    }
  }

  if (sharpTurnsCount > 2) {
    const points = rdpPath.map((p) => ({ x: p.x, y: p.y }));
    const candidates: GestureCandidate[] = [
      { tool: 'path', confidence: 0.90, label: 'Path' },
      { tool: 'trendline', confidence: 0.60, label: 'Trend Line' }
    ];

    return {
      tool: 'path',
      confidence: 0.90,
      candidates,
      points
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Linear Strokes: Horizontal Line, Vertical Line, Ray, Trend Line
  // ─────────────────────────────────────────────────────────────
  const angle = calculateStrokeAngle(stroke);

  // 5a. Horizontal Line (Sudut kemiringan < 7° dari horizontal)
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

  // 5b. Vertical Line (Sudut kemiringan > 83° dari horizontal)
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

  // 5c. Ray (Diagonal ditarik ke kanan mendekati batas sumbu harga kanan)
  const dx = end.x - start.x;
  const marginThreshold = options?.rightMarginThreshold ?? 50;

  const isNearRight =
    Boolean(options?.isNearRightEdge) ||
    (typeof options?.canvasWidth === 'number' && end.x >= options.canvasWidth - marginThreshold);

  if (dx > 0 && isNearRight) {
    const confidence = 0.9;
    let startY = start.y;
    let endY = end.y;

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

  // 5d. Trend Line (Diagonal umum lainnya)
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
