import type { DrawingToolType, SnapMode } from '../types/market';
import {
  saveDrawingsDebounced,
  loadDrawings,
  clearDrawings,
  flushDrawings
} from './persistence';
import type { CommandDispatcher } from './commandDispatcher';
import { roundToTickSize } from './priceSnapService';
import type { ParsedTradingPlan } from './planParserService';
import {
  recognizeGesture,
  type GesturePoint,
  type GestureRecognitionResult,
  type GestureRecognizerOptions,
  type ScribbleBounds,
  type GestureCandidate
} from './gestureDrawingRecognizer';

export interface GestureCreationState {
  drawingId: string | null;
  candidates: GestureCandidate[];
  candidateIndex: number;
  points: Array<{ x: number; y: number }>;
  expiresAt: number;
}

export interface DrawingState {
  activeTool: DrawingToolType | null;
  snapMode: SnapMode;
  stayMode: boolean;
  isLocked: boolean;
  isHidden: boolean;
  activeDrawings: any[];
  canUndo: boolean;
  canRedo: boolean;
  selectedDrawingId: string | null;
  lastGestureCreation: GestureCreationState | null;
  activePlans: Array<ParsedTradingPlan & { id: string }>;
  showThesisCards: boolean;
}

type Subscriber = (state: DrawingState) => void;

/**
 * Menghasilkan kunci persistensi gabungan bursa dan simbol yang ternormalisasi (misal: 'binance:BTCUSDT')
 */
export function resolveDrawingKey(providerId: string | undefined, symbol: string): string {
  if (!symbol) return 'binance:BTCUSDT';
  const clean = symbol.trim();
  if (clean.includes(':')) {
    const parts = clean.split(':');
    const p = parts[0].trim().toLowerCase() || 'binance';
    const s = parts[1].trim().toUpperCase();
    return `${p}:${s}`;
  }
  const p = (providerId || 'binance').trim().toLowerCase();
  return `${p}:${clean.toUpperCase()}`;
}

/**
 * Membandingkan dua simbol instrumen perdagangan dengan normalisasi nama dan toleransi sufiks kontrak (.P / PERP)
 */
export function isSameSymbol(symA?: string, symB?: string): boolean {
  if (!symA || !symB) return false;
  const cleanA = symA.replace(/^[^:]+:/, '').trim().toUpperCase();
  const cleanB = symB.replace(/^[^:]+:/, '').trim().toUpperCase();
  if (cleanA === cleanB) return true;
  const strip = (s: string) => s.replace(/\.P$|-PERP$|PERP$/i, '').replace(/[-_/]/g, '');
  return strip(cleanA) === strip(cleanB);
}

/**
 * Memeriksa apakah dua kotak pembatas AABB (Axis-Aligned Bounding Box) beririsan/tumpang tindih
 */
export function isAABBOverlap(a: ScribbleBounds, b: ScribbleBounds): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/**
 * Mengekstrak koordinat batas AABB dari berbagai format objek gambar Vela
 */
export function extractDrawingBounds(drawing: any): ScribbleBounds | null {
  if (!drawing) return null;

  // 1. Jika drawing memiliki properti bounds
  if (drawing.bounds) {
    const b = drawing.bounds;
    const minX = b.minX ?? b.left ?? b.x ?? 0;
    const maxX = b.maxX ?? b.right ?? (minX + (b.width ?? 0));
    const minY = b.minY ?? b.top ?? b.y ?? 0;
    const maxY = b.maxY ?? b.bottom ?? (minY + (b.height ?? 0));
    return { minX, maxX, minY, maxY };
  }

  // 2. Jika drawing memiliki points (Array<{ x: number, y: number }>)
  if (Array.isArray(drawing.points) && drawing.points.length > 0) {
    const xs = drawing.points.map((p: any) => p.x);
    const ys = drawing.points.map((p: any) => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }

  // 3. Jika drawing memiliki anchors (Array<{ x?: number, y?: number, price?: number, time?: number }>)
  if (Array.isArray(drawing.anchors) && drawing.anchors.length > 0) {
    const validAnchors = drawing.anchors.filter((a: any) => typeof a.x === 'number' && typeof a.y === 'number');
    if (validAnchors.length > 0) {
      const xs = validAnchors.map((a: any) => a.x);
      const ys = validAnchors.map((a: any) => a.y);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      };
    }
  }

  // 4. Jika drawing memiliki koordinat x1, y1, x2, y2
  if (typeof drawing.x1 === 'number' && typeof drawing.y1 === 'number') {
    const x2 = typeof drawing.x2 === 'number' ? drawing.x2 : drawing.x1;
    const y2 = typeof drawing.y2 === 'number' ? drawing.y2 : drawing.y1;
    return {
      minX: Math.min(drawing.x1, x2),
      maxX: Math.max(drawing.x1, x2),
      minY: Math.min(drawing.y1, y2),
      maxY: Math.max(drawing.y1, y2)
    };
  }

  // 5. Jika drawing memiliki koordinat x, y (dan width/height opsional)
  if (typeof drawing.x === 'number' && typeof drawing.y === 'number') {
    const w = drawing.width ?? 0;
    const h = drawing.height ?? 0;
    return {
      minX: drawing.x,
      maxX: drawing.x + w,
      minY: drawing.y,
      maxY: drawing.y + h
    };
  }

  return null;
}

/**
 * Memeriksa apakah suatu objek gambar beririsan dengan area goresan scribble
 */
export function checkDrawingIntersectsBounds(drawing: any, bounds: ScribbleBounds): boolean {
  const drawingBounds = extractDrawingBounds(drawing);
  if (!drawingBounds) return false;
  return isAABBOverlap(drawingBounds, bounds);
}

export type DrawingUndoAction =
  | { action: 'erase'; drawings: any[] }
  | {
      action: 'create_multi_position';
      drawings: any[];
      drawingIds: string[];
      plan?: ParsedTradingPlan & { id: string };
    };

/**
 * Konversi representasi string timeframe menjadi interval durasi dalam milidetik (ms).
 * Fallback default adalah 3,600,000 ms (1 jam).
 */
export function parseTimeframeToMs(tf?: string): number {
  if (!tf) return 3600000;
  const trimmed = tf.trim();

  // 1. Bulan (Kapital M atau 1M atau 1mo)
  if (trimmed === '1M' || trimmed === 'M' || trimmed.toLowerCase() === '1mo' || trimmed.toLowerCase() === 'month') {
    return 30 * 24 * 3600 * 1000;
  }

  const lower = trimmed.toLowerCase();

  // 2. Minggu
  if (lower === 'w' || lower === '1w' || lower.endsWith('w')) {
    const num = parseInt(lower, 10) || 1;
    return num * 7 * 24 * 3600 * 1000;
  }

  // 3. Hari
  if (lower === 'd' || lower === '1d' || lower.endsWith('d')) {
    const num = parseInt(lower, 10) || 1;
    return num * 24 * 3600 * 1000;
  }

  // 4. Jam
  if (lower.endsWith('h')) {
    const num = parseInt(lower, 10) || 1;
    return num * 3600 * 1000;
  }

  // 5. Menit
  if (lower.endsWith('m')) {
    const num = parseInt(lower, 10) || 1;
    return num * 60 * 1000;
  }

  // 6. Angka polos (Vela minute interval: '1', '15', '60', '240')
  if (/^\d+$/.test(lower)) {
    const num = parseInt(lower, 10);
    return num > 0 ? num * 60 * 1000 : 3600000;
  }

  return 3600000;
}

/**
 * Mengambil waktu lilin terakhir dan estimasi interval waktu candle (deltaT) dari chart aktif.
 */
export function resolveCandleMetrics(
  activeChart: any,
  defaultTimeframe?: string
): { latestCandleTime: number; deltaT: number } {
  let candles: any[] | null = null;
  if (activeChart) {
    if (typeof activeChart.data === 'function') {
      try {
        const d = activeChart.data();
        if (Array.isArray(d)) candles = d;
      } catch (_) {}
    } else if (Array.isArray(activeChart.data)) {
      candles = activeChart.data;
    } else if (Array.isArray(activeChart.candles)) {
      candles = activeChart.candles;
    } else if (typeof activeChart.getCandles === 'function') {
      try {
        const d = activeChart.getCandles();
        if (Array.isArray(d)) candles = d;
      } catch (_) {}
    } else if (activeChart.series && typeof activeChart.series.data === 'function') {
      try {
        const d = activeChart.series.data();
        if (Array.isArray(d)) candles = d;
      } catch (_) {}
    }
  }

  const getCandleTimestamp = (c: any): number | null => {
    if (!c) return null;
    if (typeof c.time === 'number') return c.time;
    if (typeof c.t === 'number') return c.t;
    if (typeof c.timestamp === 'number') return c.timestamp;
    if (Array.isArray(c) && typeof c[0] === 'number') return c[0];
    return null;
  };

  let latestCandleTime = 0;
  let deltaT = 0;

  if (candles && candles.length > 0) {
    const last = candles[candles.length - 1];
    const t = getCandleTimestamp(last);
    if (t !== null && t > 0) {
      latestCandleTime = t;
    }

    if (candles.length >= 2) {
      const prev = candles[candles.length - 2];
      const prevT = getCandleTimestamp(prev);
      if (t !== null && prevT !== null && t > prevT) {
        deltaT = t - prevT;
      }
    }
  }

  if (deltaT <= 0) {
    deltaT = parseTimeframeToMs(defaultTimeframe);
  }

  if (latestCandleTime <= 0) {
    latestCandleTime = Date.now();
  }

  return { latestCandleTime, deltaT };
}

/**
 * ChartDrawingController - Deep Module untuk Operasi Gambar Terminal Trawangan
 * Mengenkapsulasi manajemen alat gambar, mode snap/stay, undo/redo, adaptasi canvas Vela,
 * dan debounced persistence ke SQLite/localStorage dalam satu antarmuka yang ramping.
 */
export class ChartDrawingController {
  private activeTool: DrawingToolType | null = null;
  private snapMode: SnapMode = 'off';
  private stayMode = false;
  private isLocked = false;
  private isHidden = false;
  private activeDrawings: any[] = [];
  private selectedDrawingId: string | null = null;
  private canUndo = true;
  private canRedo = true;
  private isRestoring = false;
  private persistedSnapMode: SnapMode | null = null;

  private undoHistory: DrawingUndoAction[] = [];
  private redoHistory: DrawingUndoAction[] = [];
  private lastGestureCreation: GestureCreationState | null = null;
  private gestureHudTimeout: any = null;

  private activePlans = new Map<string, ParsedTradingPlan & { id: string }>();
  private planDrawingIds = new Map<string, Set<string>>();
  private drawingMetadata = new Map<string, any>();
  private drawingPlanMap = new Map<string, string>();
  private showThesisCards = true;

  private workspace: any = null;
  private getSymbol: () => string = () => 'BTCUSDT';
  private getTimeframe: () => string = () => '15m';
  private getProviderId: () => string = () => 'binance';

  private subscribers = new Set<Subscriber>();

  /**
   * Mengaitkan instance workspace Vela dan getter simbol/timeframe/provider aktif
   */
  attachWorkspace(
    workspace: any,
    getSymbol: () => string,
    getTimeframe: () => string,
    getProviderId?: () => string
  ): () => void {
    this.workspace = workspace;
    this.getSymbol = getSymbol;
    this.getTimeframe = getTimeframe;
    if (getProviderId) {
      this.getProviderId = getProviderId;
    }

    // Pasang listener pada chart aktif jika tersedia
    const activeChart = this.getActiveChart();
    if (activeChart) {
      this.attachChartListeners(activeChart);
    }

    return () => {
      if (this.workspace === workspace) {
        this.workspace = null;
      }
    };
  }

  /**
   * Helper internal untuk mengambil seluruh cells dari workspace
   */
  private getAllCells(): any[] {
    if (!this.workspace) return [];
    if (typeof this.workspace.cells === 'function') {
      try {
        return this.workspace.cells() || [];
      } catch (_) {}
    }
    return this.workspace.active ? [this.workspace.active] : [];
  }

  /**
   * Helper internal untuk mengambil instans active chart dari workspace
   */
  private getActiveChart(): any {
    return this.workspace?.active?.chart ?? null;
  }

  private previousToolBeforeSpace: DrawingToolType | null = null;

  /**
   * Beralih antara mode Hand-Pull dan Kursor (Shortcut H)
   */
  toggleHandpull(): void {
    if (this.activeTool === 'handpull') {
      this.setTool('cursor');
    } else {
      this.setTool('handpull');
    }
  }

  /**
   * Mengaktifkan mode Hand-Pull sementara saat Spacebar ditahan,
   * dan mengembalikan ke tool sebelumnya saat Spacebar dilepas.
   */
  setSpaceTemporaryHandpull(active: boolean): void {
    if (active) {
      if (this.activeTool !== 'handpull' && this.previousToolBeforeSpace === null) {
        this.previousToolBeforeSpace = this.activeTool ?? 'cursor';
        this.setTool('handpull');
      }
    } else {
      if (this.previousToolBeforeSpace !== null) {
        const restoreTool = this.previousToolBeforeSpace;
        this.previousToolBeforeSpace = null;
        this.setTool(restoreTool);
      }
    }
  }

  /**
   * Memeriksa apakah mode Hand-Pull sedang aktif
   */
  isHandpullMode(): boolean {
    return this.activeTool === 'handpull';
  }

  /**
   * Beralih antara mode Penghapus (Eraser) dan Kursor
   */
  toggleEraser(): void {
    if (this.activeTool === 'eraser') {
      this.setTool('cursor');
    } else {
      this.setTool('eraser');
    }
  }

  /**
   * Memeriksa apakah mode Penghapus sedang aktif
   */
  isEraserMode(): boolean {
    return this.activeTool === 'eraser';
  }

  private previousToolBeforeGesture: DrawingToolType | null = null;
  private isHoldingGestureKey = false;
  private liveGestureStroke: GesturePoint[] = [];

  /**
   * Beralih antara Gesture Draw Mode dan Kursor (Shortcut Shift+D)
   */
  toggleGestureMode(): void {
    if (this.activeTool === 'gesture') {
      this.setTool('cursor');
    } else {
      this.setTool('gesture');
    }
  }

  /**
   * Mengaktifkan mode Gesture sementara saat tombol pemicu (~ / Backquote atau Shift+D) ditahan,
   * dan mengembalikan ke tool sebelumnya saat tombol dilepas.
   */
  setTransientGestureHold(active: boolean): void {
    if (active) {
      if (!this.isHoldingGestureKey) {
        this.isHoldingGestureKey = true;
        if (this.activeTool !== 'gesture' && this.previousToolBeforeGesture === null) {
          this.previousToolBeforeGesture = this.activeTool ?? 'cursor';
          this.setTool('gesture');
        }
      }
    } else {
      if (this.isHoldingGestureKey) {
        this.isHoldingGestureKey = false;
        if (this.previousToolBeforeGesture !== null) {
          const restoreTool = this.previousToolBeforeGesture;
          this.previousToolBeforeGesture = null;
          this.setTool(restoreTool);
        }
      }
    }
  }

  /**
   * Memeriksa apakah mode Gambar Gestur sedang aktif (baik via toggle maupun transient hold)
   */
  isGestureMode(): boolean {
    return this.activeTool === 'gesture' || this.isHoldingGestureKey;
  }

  /**
   * Memeriksa apakah mode Gesture sedang aktif secara sticky (bukan transient hold)
   */
  get isGestureModeActive(): boolean {
    return this.activeTool === 'gesture' && !this.isHoldingGestureKey;
  }

  /**
   * Memeriksa apakah tombol pemicu gestur sedang ditahan
   */
  isHoldingGesture(): boolean {
    return this.isHoldingGestureKey;
  }

  /**
   * Memulai sapuan gestur baru pada koordinat awal (x, y)
   */
  startGestureStroke(x: number, y: number): void {
    this.liveGestureStroke = [{ x, y, time: Date.now() }];
  }

  /**
   * Menambahkan koordinat titik ke buffer sapuan gestur aktif
   */
  addGesturePoint(x: number, y: number): void {
    if (this.liveGestureStroke.length === 0) {
      this.startGestureStroke(x, y);
      return;
    }
    this.liveGestureStroke.push({ x, y, time: Date.now() });
  }

  /**
   * Mendapatkan deretan titik sapuan gestur yang sedang berlangsung
   */
  getLiveGestureStroke(): GesturePoint[] {
    return [...this.liveGestureStroke];
  }

  /**
   * Menyelesaikan sapuan gestur, menjalankan recognizer deterministik,
   * dan membuat objek gambar definitif pada drawing layer grafik atau menghapus via scribble.
   */
  finishGestureStroke(options?: GestureRecognizerOptions): GestureRecognitionResult | null {
    if (this.liveGestureStroke.length < 2) {
      this.liveGestureStroke = [];
      return null;
    }

    const stroke = [...this.liveGestureStroke];
    this.liveGestureStroke = [];

    const result = recognizeGesture(stroke, options);

    // 1. Tangani Penghapusan Scribble to Erase
    if (result.tool === 'scribble') {
      if (result.scribbleBounds) {
        this.eraseDrawingsInBounds(result.scribbleBounds);
      }
      // Jika mode transient hold aktif, kembalikan kursor ke tool sebelumnya
      if (this.isHoldingGestureKey) {
        const restoreTool = this.previousToolBeforeGesture ?? 'cursor';
        this.previousToolBeforeGesture = null;
        this.isHoldingGestureKey = false;
        this.setTool(restoreTool);
      }
      return result;
    }

    // 2. Pembuatan Objek Gambar Definitif
    if (result.tool) {
      const created = this.createDrawing({
        type: result.tool,
        points: result.points
      });

      const drawingId = created?.id || (this.activeDrawings.length > 0 ? this.activeDrawings[this.activeDrawings.length - 1]?.id : null);

      // Simpan referensi lastGestureCreation untuk Floating HUD & Tab cycling
      if (result.candidates && result.candidates.length > 0) {
        this.setLastGestureCreation({
          drawingId,
          candidates: result.candidates,
          candidateIndex: 0,
          points: result.points,
          expiresAt: Date.now() + 2500
        });
      }

      // Kembali ke mode mouse biasa ('cursor') agar pengguna langsung dapat mengatur gambar tersebut
      // (drag, resize titik handle/ujung garis, dsb) layaknya alur OpenMarket
      this.isHoldingGestureKey = false;
      this.previousToolBeforeGesture = null;
      this.setTool('cursor');

      // Seleksi objek gambar yang baru saja dibuat agar handle pengatur (titik ujung) langsung aktif
      if (drawingId) {
        this.selectDrawing(drawingId);
      }
    }

    return result;
  }

  /**
   * Helper privat untuk menghapus daftar drawing berdasarkan ID dari engine grafik Vela
   */
  private removeDrawingsFromChart(ids: string[]): void {
    if (!ids || ids.length === 0) return;
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings) return;

    try {
      if (typeof activeChart.drawings.removeMany === 'function') {
        activeChart.drawings.removeMany(ids);
      } else if (typeof activeChart.drawings.remove === 'function') {
        for (const id of ids) {
          activeChart.drawings.remove(id);
        }
      } else if (typeof activeChart.drawings.all === 'function') {
        const currentAll = activeChart.drawings.all();
        if (Array.isArray(currentAll)) {
          const remaining = currentAll.filter((d: any) => !ids.includes(d?.id));
          currentAll.length = 0;
          currentAll.push(...remaining);
        }
      }
    } catch (err) {
      console.warn('Gagal menghapus drawings dari chart engine:', err);
    }
  }

  /**
   * Menghapus seluruh drawing yang beririsan dengan scribbleBounds dan merekamnya ke undo stack
   */
  eraseDrawingsInBounds(bounds: ScribbleBounds): string[] {
    const activeChart = this.getActiveChart();
    const allDrawings = activeChart?.drawings?.all?.() || this.activeDrawings;
    if (!allDrawings || allDrawings.length === 0) return [];

    const toDelete = allDrawings.filter((d: any) => checkDrawingIntersectsBounds(d, bounds));
    if (toDelete.length === 0) return [];

    const idsToDelete = toDelete.map((d: any) => d.id).filter(Boolean);
    if (idsToDelete.length === 0) return [];

    // Catat ke internal undo stack sebelum dihapus
    this.undoHistory.push({
      action: 'erase',
      drawings: toDelete.map((d: any) => ({ ...d }))
    });
    this.redoHistory = [];

    // Hapus via helper privat removeDrawingsFromChart
    this.removeDrawingsFromChart(idsToDelete);

    if (this.selectedDrawingId && idsToDelete.includes(this.selectedDrawingId)) {
      this.selectedDrawingId = null;
    }

    this.handleDrawingMutated();
    return idsToDelete;
  }

  /**
   * Mengambil referensi gestur yang baru dibuat jika masih aktif (belum expired)
   */
  getLastGestureCreation(): GestureCreationState | null {
    if (this.lastGestureCreation && Date.now() > this.lastGestureCreation.expiresAt) {
      this.lastGestureCreation = null;
    }
    return this.lastGestureCreation;
  }

  /**
   * Memeriksa apakah Floating Gesture HUD sedang aktif
   */
  isGestureHUDActive(): boolean {
    return this.getLastGestureCreation() !== null;
  }

  /**
   * Mengatur state referensi gestur terakhir dan mengelola timer auto-dismiss 2.5 detik
   */
  setLastGestureCreation(creation: GestureCreationState | null): void {
    if (this.gestureHudTimeout) {
      clearTimeout(this.gestureHudTimeout);
      this.gestureHudTimeout = null;
    }

    this.lastGestureCreation = creation;

    if (creation) {
      const delay = Math.max(0, creation.expiresAt - Date.now());
      this.gestureHudTimeout = setTimeout(() => {
        if (this.lastGestureCreation && Date.now() >= this.lastGestureCreation.expiresAt) {
          this.lastGestureCreation = null;
          this.notify();
        }
      }, delay);
    }

    this.notify();
  }

  /**
   * Menutup Floating Gesture HUD tanpa menghapus drawing
   */
  dismissGestureHUD(): void {
    if (this.gestureHudTimeout) {
      clearTimeout(this.gestureHudTimeout);
      this.gestureHudTimeout = null;
    }
    if (this.lastGestureCreation) {
      this.lastGestureCreation = null;
      this.notify();
    }
  }

  /**
   * Beralih ke kandidat bentuk berikutnya saat tombol Tab ditekan ketika HUD aktif
   */
  cycleGestureCandidate(): boolean {
    const current = this.getLastGestureCreation();
    if (!current) return false;

    const { candidates, candidateIndex, drawingId, points } = current;
    if (!candidates || candidates.length <= 1) return false;

    const nextIndex = (candidateIndex + 1) % candidates.length;
    const nextCandidate = candidates[nextIndex];

    // Hapus drawing sebelumnya
    if (drawingId) {
      this.deleteDrawing(drawingId);
    }

    // Buat drawing baru dengan tipe alat dari kandidat berikutnya
    const created = this.createDrawing({
      type: nextCandidate.tool,
      points
    });

    const newDrawingId = created?.id || (this.activeDrawings.length > 0 ? this.activeDrawings[this.activeDrawings.length - 1]?.id : null);

    this.setLastGestureCreation({
      drawingId: newDrawingId,
      candidates,
      candidateIndex: nextIndex,
      points,
      expiresAt: Date.now() + 2500
    });

    // Pastikan kursor tetap pada mode mouse seleksi biasa ('cursor')
    this.setTool('cursor');

    // Seleksi drawing baru yang digantikan agar handle pengatur langsung aktif
    if (newDrawingId) {
      this.selectDrawing(newDrawingId);
    }

    return true;
  }

  /**
   * Membatalkan pembuatan gambar dan menutup HUD saat tombol Esc ditekan ketika HUD aktif
   */
  cancelGestureCreation(): boolean {
    const current = this.getLastGestureCreation();
    if (!current) return false;

    const { drawingId } = current;
    if (drawingId) {
      this.deleteDrawing(drawingId);
    }

    this.dismissGestureHUD();
    this.selectDrawing(null);
    this.setTool('cursor');
    return true;
  }

  /**
   * Membatalkan sapuan gestur aktif tanpa membuat objek gambar
   */
  cancelGestureStroke(): void {
    this.liveGestureStroke = [];
  }

  /**
   * Pasang listener event mutasi drawing dari engine Vela
   */
  attachChartListeners(chart: any): () => void {
    if (!chart || typeof chart.on !== 'function') return () => {};

    const onMutated = () => this.handleDrawingMutated();
    const onDraft = () => this.handleDrawingDraft();
    const onSelect = (d: any) => this.handleDrawingSelected(d?.id || (typeof d === 'string' ? d : null));
    const onDeselect = () => this.handleDrawingSelected(null);

    try {
      chart.on('drawing:created', onMutated);
      chart.on('drawing:edited', onMutated);
      chart.on('drawing:draft', onDraft);
      chart.on('drawing:removed', onMutated);
      chart.on('drawing:settings', onMutated);
      chart.on('drawing:select', onSelect);
      chart.on('drawing:deselect', onDeselect);
    } catch (err) {
      console.warn('Gagal memasang drawing listeners ke chart:', err);
    }

    return () => {
      if (typeof chart.off === 'function') {
        try {
          chart.off('drawing:created', onMutated);
          chart.off('drawing:edited', onMutated);
          chart.off('drawing:draft', onDraft);
          chart.off('drawing:removed', onMutated);
          chart.off('drawing:settings', onMutated);
          chart.off('drawing:select', onSelect);
          chart.off('drawing:deselect', onDeselect);
        } catch (_) {}
      }
    };
  }

  /**
   * Dapatkan snapshot state terkini
   */
  getSnapshot(): DrawingState {
    return {
      activeTool: this.activeTool,
      snapMode: this.snapMode,
      stayMode: this.stayMode,
      isLocked: this.isLocked,
      isHidden: this.isHidden,
      activeDrawings: [...this.activeDrawings],
      selectedDrawingId: this.selectedDrawingId,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      lastGestureCreation: this.getLastGestureCreation(),
      activePlans: this.getActivePlans(),
      showThesisCards: this.showThesisCards
    };
  }

  /**
   * Berlangganan perubahan state controller
   */
  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify() {
    const snapshot = this.getSnapshot();
    for (const fn of this.subscribers) {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('Error pada subscriber DrawingController:', err);
      }
    }
  }

  /**
   * Atur alat gambar aktif
   */
  setTool(tool: DrawingToolType | null): void {
    const prevTool = this.activeTool;
    this.activeTool = tool;

    const isEnteringSuppression = tool === 'handpull' || tool === 'gesture';
    const isExitingSuppression =
      (prevTool === 'handpull' || prevTool === 'gesture') &&
      tool !== 'handpull' &&
      tool !== 'gesture';

    // Kelola isolasi input drawing pada seluruh sel saat mode handpull atau gesture aktif
    if (isEnteringSuppression || isExitingSuppression) {
      for (const cell of this.getAllCells()) {
        try {
          const renderer = cell?.chart?.renderer;
          const native = renderer?.renderer || renderer;
          if (native?.input) {
            if (isEnteringSuppression) {
              if (native.__origDrawingsInteractive === undefined) {
                native.__origDrawingsInteractive = native.input.drawings ?? true;
              }
              native.input.drawings = false; // Matikan claim seleksi objek gambar
            } else if (isExitingSuppression) {
              native.input.drawings = native.__origDrawingsInteractive ?? true;
              delete native.__origDrawingsInteractive;
            }
          }
        } catch (_) {}
      }
    }

    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        if (tool === 'measure') {
          activeChart.drawings.setMode?.('measure');
        } else if (tool === 'eraser') {
          activeChart.drawings.setMode?.('eraser');
        } else if (tool === 'handpull' || tool === 'cursor' || tool === 'gesture' || tool === null) {
          activeChart.drawings.setMode?.(null);
          activeChart.drawings.setTool?.(null);
        } else {
          activeChart.drawings.setMode?.(null);
          activeChart.drawings.setTool?.(tool);
        }
      } catch (e) {
        console.warn('ChartDrawingController setTool error:', e);
      }
    }
    this.notify();
  }

  /**
   * Siklus snap mode: off -> weak -> strong -> off
   */
  cycleSnapMode(): SnapMode {
    const nextMap: Record<SnapMode, SnapMode> = {
      off: 'weak',
      weak: 'strong',
      strong: 'off'
    };
    const nextMode = nextMap[this.snapMode] || 'off';
    this.setSnapMode(nextMode);
    return nextMode;
  }

  /**
   * Atur mode snap magnet
   */
  setSnapMode(mode: SnapMode): void {
    this.snapMode = mode;
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        activeChart.drawings.setSnapMode(mode);
      } catch (e) {
        console.warn('ChartDrawingController setSnapMode error:', e);
      }
    }
    this.notify();
  }

  /**
   * Atur mode snap sementara (misal saat tombol Shift ditahan)
   */
  setTemporarySnapMode(tempMode: SnapMode): void {
    if (this.persistedSnapMode === null) {
      this.persistedSnapMode = this.snapMode;
    }
    this.snapMode = tempMode;
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        activeChart.drawings.setSnapMode(tempMode);
      } catch (e) {
        console.warn('ChartDrawingController setTemporarySnapMode error:', e);
      }
    }
    this.notify();
  }

  /**
   * Pulihkan mode snap awal setelah tombol modifier dilepas
   */
  restoreOriginalSnapMode(): void {
    if (this.persistedSnapMode !== null) {
      const original = this.persistedSnapMode;
      this.persistedSnapMode = null;
      this.setSnapMode(original);
    }
  }

  /**
   * Toggle stay mode (tetap pada alat gambar setelah menggambar)
   */
  toggleStayMode(): boolean {
    this.setStayMode(!this.stayMode);
    return this.stayMode;
  }

  /**
   * Atur stay mode
   */
  setStayMode(stay: boolean): void {
    this.stayMode = stay;
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        activeChart.drawings.setStayMode(stay);
      } catch (e) {
        console.warn('ChartDrawingController setStayMode error:', e);
      }
    }
    this.notify();
  }

  /**
   * Toggle kunci seluruh objek gambar
   */
  toggleLock(): boolean {
    this.setLock(!this.isLocked);
    return this.isLocked;
  }

  /**
   * Kunci atau buka kunci seluruh objek gambar
   */
  setLock(locked: boolean): void {
    this.isLocked = locked;
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        const all = activeChart.drawings.all?.() || [];
        for (const d of all) {
          activeChart.drawings.lock?.(d.id, locked);
        }
        this.handleDrawingMutated();
      } catch (e) {
        console.warn('ChartDrawingController setLock error:', e);
      }
    }
    this.notify();
  }

  /**
   * Toggle sembunyikan seluruh objek gambar
   */
  toggleHide(): boolean {
    this.setHide(!this.isHidden);
    return this.isHidden;
  }

  /**
   * Sembunyikan atau tampilkan seluruh objek gambar
   */
  setHide(hidden: boolean): void {
    this.isHidden = hidden;
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        const all = activeChart.drawings.all?.() || [];
        for (const d of all) {
          activeChart.drawings.show?.(d.id, !hidden);
        }
        this.handleDrawingMutated();
      } catch (e) {
        console.warn('ChartDrawingController setHide error:', e);
      }
    }
    this.notify();
  }

  /**
   * Batalkan aksi gambar terakhir (Undo)
   * Mendukung pemulihan drawing yang terhapus karena scribble serta pembatalan grup multi-target
   */
  undo(): void {
    const activeChart = this.getActiveChart();
    let handledInternal = false;

    if (this.undoHistory.length > 0) {
      const lastAction = this.undoHistory.pop()!;
      this.redoHistory.push(lastAction);

      if (lastAction.action === 'erase') {
        // Pulihkan drawing yang terhapus
        for (const d of lastAction.drawings) {
          if (activeChart?.drawings) {
            if (typeof activeChart.drawings.create === 'function') {
              activeChart.drawings.create(d);
            } else if (typeof activeChart.drawings.add === 'function') {
              activeChart.drawings.add(d.type || 'trendline', d);
            } else if (typeof activeChart.drawings.all === 'function') {
              const currentAll = activeChart.drawings.all();
              if (Array.isArray(currentAll) && !currentAll.some((x: any) => x.id === d.id)) {
                currentAll.push(d);
              }
            }
          }
        }
        handledInternal = true;
      } else if (lastAction.action === 'create_multi_position') {
        const ids = lastAction.drawingIds || lastAction.drawings.map((d: any) => d.id).filter(Boolean);
        this.removeDrawingsFromChart(ids);
        if (lastAction.plan) {
          this.activePlans.delete(lastAction.plan.id);
          this.planDrawingIds.delete(lastAction.plan.id);
        }
        if (this.selectedDrawingId && ids.includes(this.selectedDrawingId)) {
          this.selectedDrawingId = null;
        }
        handledInternal = true;
      }
    }

    const isBatchCreate = this.redoHistory[this.redoHistory.length - 1]?.action === 'create_multi_position';
    if (!isBatchCreate && activeChart?.drawings) {
      try {
        if (typeof activeChart.drawings.undo === 'function') {
          activeChart.drawings.undo();
        }
      } catch (e) {
        console.warn('ChartDrawingController undo error:', e);
      }
    }

    this.handleDrawingMutated();
  }

  /**
   * Ulangi aksi gambar (Redo)
   */
  redo(): void {
    const activeChart = this.getActiveChart();
    let handledInternal = false;

    if (this.redoHistory.length > 0) {
      const lastAction = this.redoHistory.pop()!;
      this.undoHistory.push(lastAction);

      if (lastAction.action === 'erase') {
        const ids = lastAction.drawings.map((d) => d.id).filter(Boolean);
        this.removeDrawingsFromChart(ids);
        handledInternal = true;
      } else if (lastAction.action === 'create_multi_position') {
        for (const d of lastAction.drawings) {
          if (activeChart?.drawings) {
            if (typeof activeChart.drawings.create === 'function') {
              activeChart.drawings.create(d);
            } else if (typeof activeChart.drawings.add === 'function') {
              activeChart.drawings.add(d.type || 'position', d);
            } else if (typeof activeChart.drawings.all === 'function') {
              const currentAll = activeChart.drawings.all();
              if (Array.isArray(currentAll) && !currentAll.some((x: any) => x.id === d.id)) {
                currentAll.push(d);
              }
            }
          }
        }
        if (lastAction.plan) {
          this.activePlans.set(lastAction.plan.id, lastAction.plan);
          const ids = lastAction.drawingIds || lastAction.drawings.map((d: any) => d.id).filter(Boolean);
          this.planDrawingIds.set(lastAction.plan.id, new Set(ids));
        }
        handledInternal = true;
      }
    }

    const isBatchCreate = this.undoHistory[this.undoHistory.length - 1]?.action === 'create_multi_position';
    if (!isBatchCreate && activeChart?.drawings) {
      try {
        if (typeof activeChart.drawings.redo === 'function') {
          activeChart.drawings.redo();
        }
      } catch (e) {
        console.warn('ChartDrawingController redo error:', e);
      }
    }

    this.handleDrawingMutated();
  }

  /**
   * Hapus seluruh objek gambar pada chart saat ini dan persisten ke database
   */
  async clearAll(): Promise<void> {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        const all = activeChart.drawings.all?.() || [];
        if (all.length > 0) {
          activeChart.drawings.removeMany(all.map((d: any) => d.id));
        }
      } catch (e) {
        console.warn('ChartDrawingController clearAll removeMany error:', e);
      }
    }

    const curSym = (this.workspace?.active as any)?.symbol || this.getSymbol();
    const curTf = (this.workspace?.active as any)?.timeframe || this.getTimeframe();
    await clearDrawings(curSym, curTf);
    await clearDrawings(curSym, 'GLOBAL');

    this.activeDrawings = [];
    this.selectedDrawingId = null;
    this.activePlans.clear();
    this.planDrawingIds.clear();
    this.drawingMetadata.clear();
    this.drawingPlanMap.clear();
    this.notify();
  }

  /**
   * Menangani event seleksi gambar dari kanvas
   */
  handleDrawingSelected(id: string | null): void {
    if (this.selectedDrawingId !== id) {
      this.selectedDrawingId = id;
      this.notify();
    }
  }

  /**
   * Menyeleksi atau membatalkan seleksi objek gambar secara programatik
   */
  selectDrawing(id: string | null): void {
    this.selectedDrawingId = id;
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        if (id) {
          activeChart.drawings.select?.(id);
        } else {
          activeChart.drawings.deselect?.();
        }
      } catch (err) {
        console.warn('Gagal menyeleksi objek gambar:', err);
      }
    }
    this.notify();
  }

  /**
   * Mengambil ID objek gambar yang sedang terseleksi
   */
  getSelectedDrawingId(): string | null {
    return this.selectedDrawingId;
  }

  /**
   * Toggle visibilitas objek gambar individual berdasarkan ID
   */
  toggleDrawingVisibility(id: string): void {
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings) return;

    try {
      const all = activeChart.drawings.all?.() || [];
      const target = all.find((d: any) => d.id === id);
      const isVisible = target ? target.visible !== false : true;
      activeChart.drawings.show?.(id, !isVisible);
      this.handleDrawingMutated();
    } catch (err) {
      console.warn(`Gagal toggle visibilitas drawing ${id}:`, err);
    }
  }

  /**
   * Toggle kunci objek gambar individual berdasarkan ID
   */
  toggleDrawingLock(id: string): void {
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings) return;

    try {
      const all = activeChart.drawings.all?.() || [];
      const target = all.find((d: any) => d.id === id);
      const isLocked = target ? target.locked === true : false;
      activeChart.drawings.lock?.(id, !isLocked);
      this.handleDrawingMutated();
    } catch (err) {
      console.warn(`Gagal toggle lock drawing ${id}:`, err);
    }
  }

  /**
   * Hapus objek gambar individual berdasarkan ID
   */
  deleteDrawing(id: string): void {
    this.removeDrawingsFromChart([id]);
    if (this.selectedDrawingId === id) {
      this.selectedDrawingId = null;
    }
    this.handleDrawingMutated();
  }

  /**
   * Aksi Massal: Sembunyikan atau tampilkan seluruh gambar
   */
  bulkHideDrawings(hidden: boolean): void {
    this.setHide(hidden);
  }

  /**
   * Aksi Massal: Kunci atau buka kunci seluruh gambar
   */
  bulkLockDrawings(locked: boolean): void {
    this.setLock(locked);
  }

  /**
   * Aksi Massal: Hapus seluruh gambar
   */
  async bulkDeleteDrawings(): Promise<void> {
    await this.clearAll();
  }

  /**
   * Buat objek gambar programatik langsung pada chart (misal horizontal line dari menu konteks atau gesture)
   */
  createDrawing(spec: { type: string; price?: number; [key: string]: any }): any {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        let created: any = null;
        const drawingInit: any = { ...spec };

        // Resolusi anchors data-space ({ time, price }) dari koordinat piksel points jika belum tersedia
        if (spec.points && Array.isArray(spec.points) && !drawingInit.anchors) {
          const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
          const proj = typeof renderer?.drawingProjector === 'function'
            ? renderer.drawingProjector()
            : typeof activeChart?.getProjector === 'function'
              ? activeChart.getProjector()
              : null;

          if (proj && typeof proj.pxToPoint === 'function') {
            const paneId = drawingInit.paneId || 'price';
            drawingInit.anchors = spec.points.map((pt: any) => proj.pxToPoint(pt.x, pt.y, paneId));
          }
        } else if (spec.price !== undefined && !drawingInit.anchors) {
          drawingInit.anchors = [{ time: Date.now(), price: spec.price }];
        }

        if (typeof activeChart.drawings.create === 'function') {
          created = activeChart.drawings.create(drawingInit);
        } else if (typeof activeChart.drawings.add === 'function') {
          created = activeChart.drawings.add(drawingInit.type, drawingInit);
        }
        this.handleDrawingMutated();
        const id = created?.id || spec.id || (this.activeDrawings.length > 0 ? this.activeDrawings[this.activeDrawings.length - 1]?.id : null);
        return { ...drawingInit, ...(created && typeof created === 'object' ? created : {}), id };
      } catch (e) {
        console.warn('ChartDrawingController createDrawing error:', e);
      }
    }
    return null;
  }

  /**
   * Membuat rangkaian objek gambar posisi bertingkat (Staged Multi-Target Position)
   * Berdasarkan rencana perdagangan yang telah diurai (ParsedTradingPlan).
   * Menghasilkan visualisasi kotak risiko/imbalan per target stage dengan transaksi undo atomik.
   */
  createMultiTargetPosition(
    plan: ParsedTradingPlan & { id?: string },
    options?: {
      planId?: string;
      anchorTime?: number;
      barSpanPerTarget?: number;
      paneId?: string;
      drawContextZones?: boolean;
    }
  ): { drawingIds: string[]; drawings: any[] } | null {
    if (!plan) return null;
    if (plan.validation && !plan.validation.valid) return null;
    if (!plan.entry || !plan.stopLoss || !plan.targets || plan.targets.length === 0) {
      return null;
    }

    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings) {
      return null;
    }

    const currentTf = typeof this.getTimeframe === 'function' ? this.getTimeframe() : '15m';
    const metrics = resolveCandleMetrics(activeChart, currentTf);

    const deltaT = metrics.deltaT > 0 ? metrics.deltaT : 3600000;
    const t0 = options?.anchorTime || metrics.latestCandleTime || Date.now();
    const span = options?.barSpanPerTarget && options.barSpanPerTarget > 0 ? options.barSpanPerTarget : 25;
    const paneId = options?.paneId || 'price';

    const planId = options?.planId || plan.id || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdDrawings: any[] = [];
    const createdDrawingIds: string[] = [];

    // 1. Gambar kotak posisi bertingkat (Staged Position Boxes)
    for (let i = 0; i < plan.targets.length; i++) {
      const target = plan.targets[i];
      if (typeof target.price !== 'number' || isNaN(target.price)) continue;

      const startTime = t0 + i * span * deltaT;
      const endTime = startTime + span * deltaT;

      const rMultipleFormatted =
        typeof target.rMultiple === 'number' && !isNaN(target.rMultiple)
          ? `${target.label || `TP${i + 1}`} (${target.rMultiple.toFixed(2)}R)`
          : target.label || `TP${i + 1}`;

      const stageDrawingSpec: any = {
        type: 'position',
        paneId,
        showPrices: true,
        showTargetLabel: true,
        showStopLabel: true,
        targetLabel: rMultipleFormatted,
        anchors: [
          { time: startTime, price: plan.entry },
          { time: endTime, price: plan.stopLoss },
          { time: endTime, price: target.price }
        ],
        metadata: {
          planId,
          stageIndex: i + 1,
          targetLabel: target.label || `TP${i + 1}`,
          rMultiple: target.rMultiple,
          bias: plan.bias,
          reasons: plan.reasons,
          contextZones: plan.contextZones,
          rawPlanText: plan.rawText
        }
      };

      const created = this.createDrawing(stageDrawingSpec);
      if (created) {
        const id = created.id || stageDrawingSpec.id;
        const drawingRecord = {
          ...stageDrawingSpec,
          ...created,
          id
        };
        createdDrawings.push(drawingRecord);
        if (id) {
          createdDrawingIds.push(id);
          this.drawingMetadata.set(id, stageDrawingSpec.metadata);
          this.drawingPlanMap.set(id, planId);
        }
      }
    }

    // 2. Gambar kotak zona FVG / Context Zone semi-transparan otomatis (#115)
    if (options?.drawContextZones !== false && Array.isArray(plan.contextZones) && plan.contextZones.length > 0) {
      const isBearish = plan.bias === 'bearish';
      const lastEndTime = t0 + plan.targets.length * span * deltaT;

      for (const zone of plan.contextZones) {
        if (typeof zone.low !== 'number' || typeof zone.high !== 'number' || isNaN(zone.low) || isNaN(zone.high)) {
          continue;
        }

        const boxSpec: any = {
          type: 'box',
          paneId,
          anchors: [
            { time: t0, price: zone.high },
            { time: lastEndTime, price: zone.low }
          ],
          style: {
            fillColor: isBearish ? 'rgba(255, 105, 180, 0.12)' : 'rgba(0, 255, 136, 0.12)',
            lineColor: isBearish ? 'rgba(255, 105, 180, 0.45)' : 'rgba(0, 255, 136, 0.45)',
            lineWidth: 1
          },
          text: {
            value: zone.label || 'FVG Zone',
            color: isBearish ? '#FF69B4' : '#00FF88'
          },
          metadata: {
            planId,
            role: 'context_zone',
            zoneLabel: zone.label,
            low: zone.low,
            high: zone.high
          }
        };

        const createdBox = this.createDrawing(boxSpec);
        if (createdBox) {
          const boxId = createdBox.id || boxSpec.id;
          const boxRecord = { ...boxSpec, ...createdBox, id: boxId };
          createdDrawings.push(boxRecord);
          if (boxId) {
          createdDrawingIds.push(boxId);
          this.drawingMetadata.set(boxId, boxSpec.metadata);
          this.drawingPlanMap.set(boxId, planId);
        }
        }
      }
    }

    if (createdDrawings.length === 0) {
      return null;
    }

    // Simpan ke activePlans registry untuk konsumsi FloatingThesisCard
    const curSym = typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT';
    const targetSymbol = plan.symbol || curSym;
    const planRecord = { ...plan, id: planId, symbol: targetSymbol };
    this.activePlans.set(planId, planRecord);
    this.planDrawingIds.set(planId, new Set(createdDrawingIds));

    // Catat seluruh ID drawing yang dibuat ke undoHistory sebagai aksi atomik tunggal
    this.undoHistory.push({
      action: 'create_multi_position',
      drawings: createdDrawings,
      drawingIds: createdDrawingIds,
      plan: planRecord
    });
    this.redoHistory = [];

    this.notify();

    return {
      drawingIds: createdDrawingIds,
      drawings: createdDrawings
    };
  }

  /**
   * Dapatkan seluruh rencana perdagangan aktif di kanvas yang terfilter sesuai koin/simbol aktif
   */
  getActivePlans(symbolFilter?: string): Array<ParsedTradingPlan & { id: string; symbol?: string }> {
    const all = Array.from(this.activePlans.values());
    const filter =
      symbolFilter !== undefined
        ? symbolFilter
        : typeof this.getSymbol === 'function'
          ? this.getSymbol()
          : undefined;

    if (!filter || filter === '*' || filter.toUpperCase() === 'ALL') {
      return all;
    }
    return all.filter((p) => !p.symbol || isSameSymbol(p.symbol, filter));
  }

  /**
   * Dapatkan seluruh rencana perdagangan tanpa filter simbol (untuk persistensi sesi menyeluruh)
   */
  getAllActivePlans(): Array<ParsedTradingPlan & { id: string; symbol?: string }> {
    return Array.from(this.activePlans.values());
  }

  /**
   * Status visibilitas Thesis Cards
   */
  isThesisCardsVisible(): boolean {
    return this.showThesisCards;
  }

  /**
   * Atur visibilitas Thesis Cards
   */
  setThesisCardsVisible(visible: boolean): void {
    this.showThesisCards = visible;
    this.notify();
  }

  /**
   * Toggle visibilitas Thesis Cards
   */
  toggleThesisCardsVisible(): boolean {
    this.showThesisCards = !this.showThesisCards;
    this.notify();
    return this.showThesisCards;
  }

  /**
   * Hapus rencana perdagangan tertentu beserta seluruh drawing terkait
   */
  removePlan(planId: string): void {
    const drawingIdSet = this.planDrawingIds.get(planId) || new Set<string>();
    const toDelete = this.activeDrawings.filter((d) => d.metadata?.planId === planId || drawingIdSet.has(d.id));
    const idsToDelete = toDelete.map((d) => d.id).filter(Boolean);

    this.activePlans.delete(planId);
    this.planDrawingIds.delete(planId);
    for (const id of idsToDelete) {
      this.drawingMetadata.delete(id);
      this.drawingPlanMap.delete(id);
    }

    if (idsToDelete.length > 0) {
      this.removeDrawingsFromChart(idsToDelete);
    }
    this.notify();
  }

  /**
   * Bersihkan seluruh rencana perdagangan aktif beserta gambarnya dari kanvas
   */
  clearAllPlans(): void {
    const planIds = Array.from(this.activePlans.keys());
    for (const pid of planIds) {
      this.removePlan(pid);
    }
    this.activePlans.clear();
    this.planDrawingIds.clear();
    this.drawingMetadata.clear();
    this.drawingPlanMap.clear();
    this.notify();
  }

  /**
   * Pulihkan koleksi rencana perdagangan aktif ke kanvas (Workspace Persistence)
   */
  restorePlans(plans: Array<ParsedTradingPlan & { id: string; symbol?: string }>, showCards: boolean = true): void {
    if (!Array.isArray(plans) || plans.length === 0) return;
    this.showThesisCards = showCards;
    const curSym = typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT';
    for (const plan of plans) {
      if (!this.activePlans.has(plan.id)) {
        this.createMultiTargetPosition(
          {
            ...plan,
            symbol: plan.symbol || curSym
          },
          {
            planId: plan.id,
            drawContextZones: true
          }
        );
      }
    }
    this.notify();
  }

  /**
   * Tangani event mutasi gambar (created, edited, removed, settings)
   */
  handleDrawingMutated(): void {
    if (this.isRestoring) return; // Abaikan saat proses pembersihan / pemulihan berlangsung
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        this.activeDrawings = [...(activeChart.drawings.all?.() || [])];

        // Tempelkan kembali metadata ke activeDrawings jika tersedia di drawingMetadata
        for (const d of this.activeDrawings) {
          if (d && d.id) {
            if (this.drawingMetadata.has(d.id) && !d.metadata) {
              d.metadata = this.drawingMetadata.get(d.id);
            }
            if (this.drawingPlanMap.has(d.id) && (!d.metadata || !d.metadata.planId)) {
              d.metadata = { ...(d.metadata || {}), planId: this.drawingPlanMap.get(d.id) };
            }
          }
        }

        // Tick-Aligned Price Guard: Sanitasi anchors harga pada setiap gambar
        for (const d of this.activeDrawings) {
          if (Array.isArray(d.anchors)) {
            for (const a of d.anchors) {
              if (typeof a.price === 'number') {
                a.price = roundToTickSize(a.price);
              }
            }
          }
        }

        // Sinkronisasi activePlans dengan activeDrawings:
        // Himpun seluruh drawing ID yang saat ini masih ada di kanvas (baik visible maupun hidden)
        const curSym = typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT';
        const existingDrawingIds = new Set(this.activeDrawings.map((d: any) => d.id).filter(Boolean));

        // Rencana hanya dihapus jika SEMUA drawing yang terkait dengannya sudah tidak ada di kanvas
        // DAN hanya jika plan tersebut diasosiasikan dengan koin aktif saat ini
        for (const [pid, drawingIdSet] of Array.from(this.planDrawingIds.entries())) {
          const plan = this.activePlans.get(pid);
          if (plan && plan.symbol && !isSameSymbol(plan.symbol, curSym)) {
            continue; // Lindungi rencana milik koin lain agar tidak terhapus saat beralih koin
          }
          if (drawingIdSet && drawingIdSet.size > 0) {
            const hasAnyDrawing = Array.from(drawingIdSet).some((did) => existingDrawingIds.has(did));
            if (!hasAnyDrawing) {
              this.activePlans.delete(pid);
              this.planDrawingIds.delete(pid);
            }
          }
        }

        // Bersihkan plan lama yang tidak memiliki entri di planDrawingIds dan tidak ada di activeDrawings
        const activePlanIds = new Set(this.activeDrawings.map((d: any) => d.metadata?.planId).filter(Boolean));
        for (const [pid, plan] of Array.from(this.activePlans.entries())) {
          if (plan && plan.symbol && !isSameSymbol(plan.symbol, curSym)) {
            continue; // Lindungi rencana milik koin lain
          }
          if (!this.planDrawingIds.has(pid) && !activePlanIds.has(pid)) {
            this.activePlans.delete(pid);
          }
        }

        const doc = activeChart.drawings.toJSON?.();
        if (doc) {
          const curSym = typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT';
          const curProv = typeof this.getProviderId === 'function' ? this.getProviderId() : 'binance';
          const key = resolveDrawingKey(curProv, curSym);
          saveDrawingsDebounced(key, 'GLOBAL', doc);
        }
      } catch (err) {
        console.warn('Gagal memproses auto-save drawing:', err);
      }
    }
    this.notify();
  }

  /**
   * Mengosongkan seluruh visual gambar pada layer kanvas aktif (Clean Slate)
   */
  clearCanvasVisuals(): void {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      const prevRestoring = this.isRestoring;
      this.isRestoring = true;
      try {
        // Utamakan fromJSON({ version: 1, drawings: [] }) untuk clean slate internal store Vela tanpa memicu event removal
        if (typeof activeChart.drawings.fromJSON === 'function') {
          activeChart.drawings.fromJSON({ version: 1, drawings: [] });
        } else if (typeof activeChart.drawings.clear === 'function') {
          activeChart.drawings.clear();
        } else if (typeof activeChart.drawings.removeMany === 'function') {
          const existing = activeChart.drawings.all?.() || [];
          if (existing.length > 0) {
            activeChart.drawings.removeMany(existing.map((d: any) => d.id));
          }
        }
      } catch (err) {
        console.warn('Gagal mengosongkan gambar visual kanvas:', err);
      } finally {
        this.isRestoring = prevRestoring;
      }
    }
    this.activeDrawings = [];
    this.notify();
  }

  /**
   * Tangani event drawing:draft saat drag interaktif berlangsung
   */
  handleDrawingDraft(): void {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        this.activeDrawings = [...(activeChart.drawings.all?.() || [])];
      } catch (_) {}
    }
    this.notify();
  }

  /**
   * Muat dan pasang gambar yang tersimpan dari SQLite / Storage sesuai bursa dan simbol aktif
   */
  async restoreDrawings(
    targetSymbol?: string,
    targetTimeframe?: string,
    targetProvider?: string
  ): Promise<void> {
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings) return;

    // 1. Flush gambar in-flight yang sedang aktif sebelum beralih konteks
    try {
      const curSym = typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT';
      const curProv = typeof this.getProviderId === 'function' ? this.getProviderId() : 'binance';
      const curKey = resolveDrawingKey(curProv, curSym);
      await flushDrawings(curKey, 'GLOBAL');
    } catch (_) {}

    this.isRestoring = true;
    try {
      // 2. Bersihkan kanvas aktif terlebih dahulu (clean slate) agar gambar bursa lama tidak bocor
      this.clearCanvasVisuals();

      const sym = targetSymbol || (this.workspace?.active as any)?.symbol || this.getSymbol();
      const tf = targetTimeframe || (this.workspace?.active as any)?.timeframe || this.getTimeframe();
      const prov = targetProvider || this.getProviderId();
      const key = resolveDrawingKey(prov, sym);

      // 3. Coba slot GLOBAL untuk bursa aktif
      let doc = await loadDrawings(key, 'GLOBAL');
      // 4. Fallback per timeframe bursa aktif
      if (!doc) {
        doc = await loadDrawings(key, tf);
      }

      // 5. Legacy Fallback: jika bursa adalah binance dan belum ada record bursa, cek key lama tanpa prefix bursa
      if (!doc && prov.toLowerCase() === 'binance') {
        const legacySym = sym.includes(':') ? sym.split(':')[1] : sym;
        doc = await loadDrawings(legacySym, 'GLOBAL');
        if (!doc) {
          doc = await loadDrawings(legacySym, tf);
        }
      }

      if (doc && activeChart.drawings) {
        activeChart.drawings.fromJSON(doc);
        this.activeDrawings = activeChart.drawings.all?.() || [];
      }
    } catch (err) {
      console.warn('Gagal memulihkan drawings:', err);
    } finally {
      this.isRestoring = false;
      this.notify();
    }
  }

  /**
   * Mengintegrasikan shortcut drawing dari CommandDispatcher
   */
  bindToDispatcher(dispatcher: CommandDispatcher): () => void {
    const unbinders: Array<() => void> = [];

    // Trendline
    unbinders.push(
      dispatcher.bindHandler('draw-trendline', () => {
        this.setTool(this.activeTool === 'trendline' ? null : 'trendline');
      })
    );

    // Gesture Draw Mode (Shift+D)
    unbinders.push(
      dispatcher.bindHandler('toggle-gesture-mode', () => {
        this.toggleGestureMode();
      })
    );

    // Hand-Pull Pan Mode (H)
    unbinders.push(
      dispatcher.bindHandler('draw-handpull', () => {
        this.toggleHandpull();
      })
    );

    // Horizontal Line (Alt+H)
    unbinders.push(
      dispatcher.bindHandler('draw-hline', () => {
        this.setTool(this.activeTool === 'hline' ? null : 'hline');
      })
    );

    // Vertical Line (Alt+V)
    unbinders.push(
      dispatcher.bindHandler('draw-vline', () => {
        this.setTool(this.activeTool === 'vline' ? null : 'vline');
      })
    );

    // Position Tool / Long-Short (Alt+R)
    unbinders.push(
      dispatcher.bindHandler('draw-position', () => {
        this.setTool(this.activeTool === 'position' ? null : 'position');
      })
    );

    // Fibonacci Retracement (Alt+F)
    unbinders.push(
      dispatcher.bindHandler('draw-fibonacci', () => {
        this.setTool(this.activeTool === 'fibretracement' ? null : 'fibretracement');
      })
    );

    // Measure / Penggaris (Alt+M)
    unbinders.push(
      dispatcher.bindHandler('draw-measure', () => {
        this.setTool(this.activeTool === 'measure' ? null : 'measure');
      })
    );

    // Box / Rectangle (Alt+B)
    unbinders.push(
      dispatcher.bindHandler('draw-box', () => {
        this.setTool(this.activeTool === 'box' ? null : 'box');
      })
    );

    // Undo (Ctrl+Z)
    unbinders.push(
      dispatcher.bindHandler('draw-undo', () => {
        this.undo();
      })
    );

    // Redo (Ctrl+Y)
    unbinders.push(
      dispatcher.bindHandler('draw-redo', () => {
        this.redo();
      })
    );

    // Cancel / Esc
    unbinders.push(
      dispatcher.bindHandler('cancel-action', () => {
        if (this.isGestureHUDActive()) {
          this.cancelGestureCreation();
          return;
        }
        if (this.activeTool !== null) {
          this.setTool(null);
        }
      })
    );

    return () => {
      for (const u of unbinders) u();
    };
  }
}

/**
 * Singleton instance dari ChartDrawingController
 */
export const chartDrawingController = new ChartDrawingController();
