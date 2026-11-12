import type { DrawingToolType, SnapMode } from '../types/market';
import { storage } from './persistence';
import type { DrawingScope, IPersistenceService } from './persistence/types';
import type { CommandDispatcher } from './commandDispatcher';
import { roundToTickSize, getAdaptiveTickSize } from './priceSnapService';
import { type ParsedTradingPlan } from './planParserService';
import {
  TradingPlanLifecycle,
  CONTEXT_ZONE_STYLES,
  ENTRY_ZONE_STYLES,
  isSamePlanSymbol,
  type ApplyPlanOptions,
  type AppliedPlanResult,
  type SerializedPlanEnvelope,
  type UpdatePlanOptions
} from './tradingPlanLifecycle';

export { CONTEXT_ZONE_STYLES, ENTRY_ZONE_STYLES };
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
  paneId?: string;
  expiresAt: number;
}

export interface ChartDrawingItem {
  id?: string;
  type?: string;
  paneId?: string;
  anchors?: Array<{ time?: number; price?: number }>;
  style?: Record<string, unknown>;
  text?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SavedThesisCardGeometry {
  x: number;
  y: number;
  width: number;
  height?: number;
  isWideMode?: boolean;
  isMinimized?: boolean;
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
  thesisCardGeometries: Record<string, SavedThesisCardGeometry>;
}

type Subscriber = (state: DrawingState) => void;

export interface DrawingContextResolvers {
  getSymbol: () => string;
  getTimeframe: () => string;
  getProviderId?: () => string;
  getWorkspaceId?: () => string | null | undefined;
}

export type DrawingPersistencePort = Pick<
  IPersistenceService,
  'loadScopedDrawings' | 'saveScopedDrawingsDebounced' | 'flushScopedDrawings' | 'clearScopedDrawings'
>;

import {
  isSameSymbol,
  isSameInstrument,
  normalizeSymbolForMatching,
  getCellMarketIdentity,
} from './instrumentIdentity';
export {
  isSameSymbol,
  isSameInstrument,
  normalizeSymbolForMatching,
};

export interface RestoreDrawingsResult {
  hasAuthoritativePlanMeta: boolean;
}

/**
 * Memeriksa apakah payload `_trawangan_meta` merupakan envelope metadata plan yang valid dan otoritatif.
 */
function isValidPlanEnvelope(meta: unknown): meta is Partial<SerializedPlanEnvelope> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const candidate = meta as Partial<SerializedPlanEnvelope>;
  return (
    Array.isArray(candidate.activePlans) ||
    Array.isArray(candidate.planDrawingIds) ||
    (candidate.drawingMetadata !== null &&
      typeof candidate.drawingMetadata === 'object' &&
      !Array.isArray(candidate.drawingMetadata))
  );
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
export function extractDrawingBounds(drawing: any, proj?: any): ScribbleBounds | null {
  if (!drawing) return null;

  // 1. Jika drawing adalah objek Vela yang memiliki method bounds(proj)
  if (proj && typeof drawing.bounds === 'function') {
    try {
      const b = drawing.bounds(proj);
      if (b && typeof b.x === 'number' && typeof b.y === 'number') {
        return {
          minX: b.x,
          maxX: b.x + (b.w ?? 0),
          minY: b.y,
          maxY: b.y + (b.h ?? 0)
        };
      }
    } catch (_) {}
  }

  // 2. Jika drawing memiliki method pixels(proj)
  if (proj && typeof drawing.pixels === 'function') {
    try {
      const p = drawing.pixels(proj);
      if (Array.isArray(p) && p.length >= 4) {
        return {
          minX: Math.min(p[0], p[2]),
          maxX: Math.max(p[0], p[2]),
          minY: Math.min(p[1], p[3]),
          maxY: Math.max(p[1], p[3])
        };
      }
    } catch (_) {}
  }

  // 3. Jika drawing memiliki properti bounds
  if (drawing.bounds && typeof drawing.bounds === 'object') {
    const b = drawing.bounds;
    const minX = b.minX ?? b.left ?? b.x ?? 0;
    const maxX = b.maxX ?? b.right ?? (minX + (b.width ?? 0));
    const minY = b.minY ?? b.top ?? b.y ?? 0;
    const maxY = b.maxY ?? b.bottom ?? (minY + (b.height ?? 0));
    return { minX, maxX, minY, maxY };
  }

  // 4. Jika drawing memiliki anchors data-space [{ time, price }] dan ada projector
  if (
    proj &&
    Array.isArray(drawing.anchors) &&
    drawing.anchors.length > 0 &&
    typeof proj.xOf === 'function' &&
    typeof proj.yOf === 'function'
  ) {
    try {
      const paneId = drawing.paneId || 'price';
      const validPixelAnchors = drawing.anchors
        .map((a: any) => {
          if (typeof a?.time === 'number' && typeof a?.price === 'number') {
            const x = proj.xOf(a.time);
            const y = proj.yOf(a.price, paneId);
            if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
              return { x, y };
            }
          }
          return null;
        })
        .filter(Boolean) as Array<{ x: number; y: number }>;

      if (validPixelAnchors.length > 0) {
        const xs = validPixelAnchors.map((a) => a.x);
        const ys = validPixelAnchors.map((a) => a.y);
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys)
        };
      }
    } catch (_) {}
  }

  // 5. Jika drawing memiliki points (Array<{ x: number, y: number }>)
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

  // 6. Jika drawing memiliki anchors berpiksel (Array<{ x?: number, y?: number }>)
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

  // 7. Jika drawing memiliki koordinat x1, y1, x2, y2
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

  // 8. Jika drawing memiliki koordinat x, y (dan width/height opsional)
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
export function checkDrawingIntersectsBounds(drawing: any, bounds: ScribbleBounds, proj?: any): boolean {
  const drawingBounds = extractDrawingBounds(drawing, proj);
  if (!drawingBounds) return false;
  return isAABBOverlap(drawingBounds, bounds);
}

export type DrawingUndoAction =
  | { action: 'erase'; drawings: any[] }
  | { action: 'create'; drawings: any[] }
  | {
      action: 'create_multi_position';
      drawings: any[];
      drawingIds: string[];
      plan?: ParsedTradingPlan & { id: string; symbol?: string };
      autoCreateAlerts?: boolean;
    }
  | {
      action: 'update_multi_position';
      drawings: any[];
      drawingIds: string[];
      plan: ParsedTradingPlan & { id: string; symbol?: string };
      autoCreateAlerts: boolean;
      previousDrawings: any[];
      previousDrawingIds: string[];
      previousPlan: ParsedTradingPlan & { id: string; symbol?: string };
      previousAlertsEnabled: boolean;
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
  private thesisCardGeometries: Record<string, SavedThesisCardGeometry> = {};
  private planRevision = 0;
  private cachedSnapshotPlans: Array<ParsedTradingPlan & { id: string }> = [];
  private cachedSnapshotPlansRev = -1;
  private cachedSnapshotPlansSymbol = '';
  private cachedSnapshotGeometriesSrc: Record<string, SavedThesisCardGeometry> | null = null;
  private cachedSnapshotGeometriesOut: Record<string, SavedThesisCardGeometry> = {};

  private undoHistory: DrawingUndoAction[] = [];
  private redoHistory: DrawingUndoAction[] = [];
  private lastGestureCreation: GestureCreationState | null = null;
  private gestureHudTimeout: any = null;

  private workspace: any = null;
  private lastActiveCellIdentity: {
    cell: any;
    symbol: string;
    timeframe: string;
    providerId: string;
    workspaceId: string | null;
  } | null = null;
  private getSymbol: () => string = () => 'BTCUSDT';
  private getTimeframe: () => string = () => '15m';
  private getProviderId: () => string = () => 'binance';
  private currentWorkspaceId: string | null = null;
  private customWorkspaceIdGetter?: () => string | null | undefined;
  private symbolReadyHandler?: (symbol: string) => Promise<void>;
  private readonly persistence: DrawingPersistencePort;

  public readonly planLifecycle: TradingPlanLifecycle;

  constructor(persistence: DrawingPersistencePort = storage) {
    this.persistence = persistence;
    this.planLifecycle = new TradingPlanLifecycle({
      getContext: () => {
        const activeChart = this.getActiveChart();
        const currentTf = typeof this.getTimeframe === 'function' ? this.getTimeframe() : '15m';
        const metrics = resolveCandleMetrics(activeChart, currentTf);
        return {
          hasActiveCanvas: Boolean(activeChart?.drawings),
          symbol: typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT',
          providerId: typeof this.getProviderId === 'function' ? this.getProviderId() : 'binance',
          timeframe: currentTf,
          deltaT: metrics.deltaT,
          latestCandleTime: metrics.latestCandleTime
        };
      },
      ensureSymbolReady: async (symbol: string) => {
        if (this.symbolReadyHandler) {
          await this.symbolReadyHandler(symbol);
        }
      },
      getCanvasDrawings: () => {
        const activeChart = this.getActiveChart();
        return (activeChart?.drawings?.all?.() || this.activeDrawings || []) as ChartDrawingItem[];
      },
      createCanvasDrawing: (spec) => this.createDrawing(spec as any),
      removeCanvasDrawings: (ids) => {
        this.removeDrawingsFromChart(ids);
        const activeChart = this.getActiveChart();
        this.activeDrawings = ((activeChart?.drawings?.all?.() || this.activeDrawings || []) as ChartDrawingItem[]).filter(
          (d) => Boolean(d?.id) && !ids.includes(d.id as string)
        );
      },
      recordUndoAction: (tx) => {
        if (tx.action === 'update') {
          this.undoHistory.push({
            action: 'update_multi_position',
            drawings: tx.drawings,
            drawingIds: tx.drawingIds,
            plan: tx.plan,
            autoCreateAlerts: tx.autoCreateAlerts,
            previousDrawings: tx.previousDrawings,
            previousDrawingIds: tx.previousDrawingIds,
            previousPlan: tx.previousPlan,
            previousAlertsEnabled: tx.previousAlertsEnabled
          });
        } else {
          this.undoHistory.push({
            action: 'create_multi_position',
            drawings: tx.drawings,
            drawingIds: tx.drawingIds,
            plan: tx.plan,
            autoCreateAlerts: tx.autoCreateAlerts
          });
        }
        this.redoHistory = [];
      },
      onStateChanged: () => {
        this.planRevision++;
        this.persistDrawingDocument();
        this.notify();
      }
    });
  }

  public setSymbolReadyHandler(handler?: (symbol: string) => Promise<void>): void {
    this.symbolReadyHandler = handler;
  }

  public setWorkspaceId(id: string | null | undefined): void {
    this.currentWorkspaceId = id ? id.trim() : null;
  }

  public getWorkspaceId(): string | null {
    const fromGetter = this.customWorkspaceIdGetter ? this.customWorkspaceIdGetter() : null;
    const ws = fromGetter || this.currentWorkspaceId;
    return ws && ws.trim() ? ws.trim().toLowerCase() : null;
  }

  private subscribers = new Set<Subscriber>();
  private draftSubscribers = new Set<(activeDrawings: any[]) => void>();
  private draftRafId: number | null = null;
  private draftInteractionActive = false;

  /**
   * Mengaitkan instance workspace Vela dan getter simbol/timeframe/provider/workspace aktif
   */
  attachWorkspace(
    workspace: any,
    getSymbolOrResolvers: (() => string) | DrawingContextResolvers,
    getTimeframe?: () => string,
    getProviderId?: () => string,
    getWorkspaceId?: () => string | null | undefined
  ): () => void {
    this.workspace = workspace;
    if (typeof getSymbolOrResolvers === 'object' && getSymbolOrResolvers !== null) {
      const resolvers = getSymbolOrResolvers;
      this.getSymbol = resolvers.getSymbol;
      this.getTimeframe = resolvers.getTimeframe;
      if (resolvers.getProviderId) {
        this.getProviderId = resolvers.getProviderId;
      }
      if (resolvers.getWorkspaceId) {
        this.customWorkspaceIdGetter = resolvers.getWorkspaceId;
      }
    } else {
      this.getSymbol = getSymbolOrResolvers;
      if (getTimeframe) {
        this.getTimeframe = getTimeframe;
      }
      if (getProviderId) {
        this.getProviderId = getProviderId;
      }
      if (getWorkspaceId) {
        this.customWorkspaceIdGetter = getWorkspaceId;
      }
    }

    const chartCleanups = new Map<any, () => void>();
    const registerChartListeners = (chart: any) => {
      if (!chart || chartCleanups.has(chart)) return;
      const detach = this.attachChartListeners(chart);
      chartCleanups.set(chart, detach);
    };

    // Pasang listener pada seluruh cell yang ada dan sinkronkan snap/stay mode
    for (const cell of this.getAllCells()) {
      const chart = this.getChartForCell(cell);
      if (chart) {
        registerChartListeners(chart);
        try {
          chart.drawings?.setSnapMode?.(this.snapMode);
          chart.drawings?.setStayMode?.(this.stayMode);
        } catch (_) {}
      }
    }

    this.lastActiveCellIdentity = this.captureCellIdentity(this.workspace?.active);

    // Dengarkan pergantian cell aktif atau cell baru jika workspace mendukung event bus
    const wsUnsubs: Array<() => void> = [];
    if (workspace && typeof workspace.on === 'function') {
      try {
        const onCellCreated = ({ id }: { id: string }) => {
          const cell = workspace?.cell?.(id);
          const chart = this.getChartForCell(cell);
          if (chart) {
            registerChartListeners(chart);
            try {
              chart.drawings?.setSnapMode?.(this.snapMode);
              chart.drawings?.setStayMode?.(this.stayMode);
            } catch (_) {}
          }
        };
        const uCreated = workspace.on('cell:created', onCellCreated);
        wsUnsubs.push(typeof uCreated === 'function' ? uCreated : () => workspace.off?.('cell:created', onCellCreated));

        const onCellActive = () => {
          const currentActiveCell = this.workspace?.active;
          const prev = this.lastActiveCellIdentity;

          // Flush perubahan drawing yang tertunda pada sel sebelumnya dengan scope sel lama sebelum konteks aktif berpindah
          if (!this.isRestoring && prev?.cell && prev.cell !== currentActiveCell) {
            const livePrev = getCellMarketIdentity(prev.cell);
            const prevSym = livePrev.symbol || prev.symbol;
            const prevProv = livePrev.providerId || prev.providerId;
            const prevWs = this.getWorkspaceId() ?? prev.workspaceId;
            const prevChart = this.getChartForCell(prev.cell);
            if (prevChart?.drawings && typeof prevChart.drawings.toJSON === 'function') {
              try {
                const prevDoc = prevChart.drawings.toJSON();
                if (prevDoc) {
                  const prevScope: DrawingScope = {
                    workspaceId: prevWs,
                    providerId: prevProv,
                    symbol: prevSym,
                    timeframe: 'GLOBAL',
                  };
                  this.persistence.saveScopedDrawingsDebounced(prevScope, {
                    ...prevDoc,
                    _trawangan_meta: this.planLifecycle.toPersistedEnvelope()
                  });
                  void this.persistence.flushScopedDrawings(prevScope).catch(() => {});
                }
              } catch (_) {}
            }
          }

          const activeChart = this.getActiveChart();
          if (activeChart) {
            registerChartListeners(activeChart);
            try {
              activeChart.drawings?.setSnapMode?.(this.snapMode);
              activeChart.drawings?.setStayMode?.(this.stayMode);
            } catch (_) {}
            if (!this.isRestoring) {
              this.activeDrawings = [...(activeChart.drawings?.all?.() || [])];
              this.planLifecycle.reattachMetadataToDrawings(this.activeDrawings);
              this.notify();
            }
          }
          this.lastActiveCellIdentity = this.captureCellIdentity(currentActiveCell);
        };
        const uActive = workspace.on('cell:active', onCellActive);
        wsUnsubs.push(typeof uActive === 'function' ? uActive : () => workspace.off?.('cell:active', onCellActive));
      } catch (_) {}
    }

    return () => {
      this.cancelScheduledDraft();
      this.clearDraftInteractionState();
      for (const detachChart of chartCleanups.values()) {
        try {
          detachChart();
        } catch (_) {}
      }
      chartCleanups.clear();
      for (const unsub of wsUnsubs) {
        try {
          unsub();
        } catch (_) {}
      }
      if (this.workspace === workspace) {
        this.workspace = null;
      }
      this.lastActiveCellIdentity = null;
    };
  }

  /**
   * Helper internal untuk mengambil instance chart dari objek cell
   */
  private getChartForCell(cell: any): any {
    return cell?.chart || cell?.inner || null;
  }

  /**
   * Merekam identitas pasar milik satu cell untuk menjaga isolasi kunci flush saat cell:active berganti
   */
  private captureCellIdentity(cell: any) {
    if (!cell) return null;
    const { providerId, symbol } = getCellMarketIdentity(cell);
    return {
      cell,
      symbol: symbol || (typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT'),
      timeframe: cell?.timeframe || (typeof this.getTimeframe === 'function' ? this.getTimeframe() : '15m'),
      providerId: providerId || (typeof this.getProviderId === 'function' ? this.getProviderId() : 'binance'),
      workspaceId: this.getWorkspaceId()
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
    return this.getChartForCell(this.workspace?.active);
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

    // Deteksi sub-pane target berdasarkan titik goresan awal atau tengah
    const activeChart = this.getActiveChart();
    const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
    const proj = typeof renderer?.drawingProjector === 'function'
      ? renderer.drawingProjector()
      : typeof activeChart?.getProjector === 'function'
        ? activeChart.getProjector()
        : null;

    let targetPaneId: string | null = null;
    if (proj && typeof proj.paneIdAtY === 'function' && stroke.length > 0) {
      targetPaneId = proj.paneIdAtY(stroke[0].y);
      if (!targetPaneId && stroke.length > 1) {
        targetPaneId = proj.paneIdAtY(stroke[Math.floor(stroke.length / 2)].y);
      }
      if (!targetPaneId && stroke.length > 0) {
        targetPaneId = proj.paneIdAtY(stroke[stroke.length - 1].y);
      }
    }
    if (!targetPaneId && typeof renderer?.nearestPaneToY === 'function' && stroke.length > 0) {
      targetPaneId = renderer.nearestPaneToY(stroke[0].y)?.id ?? null;
    }
    if (!targetPaneId) {
      targetPaneId = 'price';
    }

    // Jika menggambar di sub-pane indikator (bukan 'price'), nonaktifkan candle wick snapping
    const isIndicatorPane = targetPaneId !== 'price';
    const effectiveOptions: GestureRecognizerOptions = {
      ...options,
      ...(isIndicatorPane ? { wicks: [], candles: [] } : {})
    };

    const result = recognizeGesture(stroke, effectiveOptions);

    // 1. Tangani Penghapusan Scribble to Erase
    if (result.tool === 'scribble') {
      if (result.scribbleBounds) {
        this.eraseDrawingsInBounds(result.scribbleBounds, targetPaneId);
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
        points: result.points,
        paneId: targetPaneId
      });

      const drawingId = created?.id || (this.activeDrawings.length > 0 ? this.activeDrawings[this.activeDrawings.length - 1]?.id : null);

      // Simpan referensi lastGestureCreation untuk Floating HUD & Tab cycling (melestarikan targetPaneId)
      if (result.candidates && result.candidates.length > 0) {
        this.setLastGestureCreation({
          drawingId,
          candidates: result.candidates,
          candidateIndex: 0,
          points: result.points,
          paneId: targetPaneId,
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
  eraseDrawingsInBounds(bounds: ScribbleBounds, targetPaneId?: string): string[] {
    const activeChart = this.getActiveChart();
    const allDrawings = activeChart?.drawings?.all?.() || this.activeDrawings;
    if (!allDrawings || allDrawings.length === 0) return [];

    const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
    const proj = typeof renderer?.drawingProjector === 'function'
      ? renderer.drawingProjector()
      : typeof activeChart?.getProjector === 'function'
        ? activeChart.getProjector()
        : null;

    const toDelete = allDrawings.filter((d: any) => {
      // Jika targetPaneId didefinisikan, jangan hapus drawing milik pane lain
      if (targetPaneId && d.paneId && d.paneId !== targetPaneId) {
        return false;
      }
      return checkDrawingIntersectsBounds(d, bounds, proj);
    });
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

    const { candidates, candidateIndex, drawingId, points, paneId } = current;
    if (!candidates || candidates.length <= 1) return false;

    const nextIndex = (candidateIndex + 1) % candidates.length;
    const nextCandidate = candidates[nextIndex];

    // Hapus drawing sebelumnya
    if (drawingId) {
      this.deleteDrawing(drawingId);
    }

    // Buat drawing baru dengan tipe alat dari kandidat berikutnya, mempertahankan target paneId
    const created = this.createDrawing({
      type: nextCandidate.tool,
      points,
      paneId
    });

    const newDrawingId = created?.id || (this.activeDrawings.length > 0 ? this.activeDrawings[this.activeDrawings.length - 1]?.id : null);

    this.setLastGestureCreation({
      drawingId: newDrawingId,
      candidates,
      candidateIndex: nextIndex,
      points,
      paneId,
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
   * Mengembalikan `true` apabila drag/pratinjau drawing (`drawing:draft`) sedang berlangsung
   * termasuk saat menggeser handle objek gambar pada mode tool `'cursor'`.
   */
  public isDraftInteractionActive(): boolean {
    return this.draftInteractionActive;
  }

  /**
   * Mereset status interaksi draft aktif (misalnya saat pointer dilepas tanpa mutasi).
   */
  public clearDraftInteractionState(): void {
    this.draftInteractionActive = false;
  }

  private cancelScheduledDraft(): void {
    if (this.draftRafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.draftRafId);
    }
    this.draftRafId = null;
  }

  private scheduleDraftNotification(): void {
    if (typeof requestAnimationFrame !== 'function') {
      this.handleDrawingDraft({ draftOnly: true });
      return;
    }
    if (this.draftRafId !== null) return;
    this.draftRafId = requestAnimationFrame(() => {
      this.draftRafId = null;
      this.handleDrawingDraft({ draftOnly: true });
    });
  }

  /**
   * Pasang listener event mutasi drawing dari engine Vela
   */
  attachChartListeners(chart: any): () => void {
    if (!chart || typeof chart.on !== 'function') return () => {};
    if (chart.__trawanganDrawingListenersAttached) return () => {};
    chart.__trawanganDrawingListenersAttached = true;

    const onMutated = () => {
      this.draftInteractionActive = false;
      this.cancelScheduledDraft();
      this.handleDrawingMutated();
    };
    const onDraft = () => {
      this.draftInteractionActive = true;
      this.scheduleDraftNotification();
    };
    const onSelected = (payload: any) => {
      const selectedId =
        payload?.id ??
        (Array.isArray(payload?.ids) && payload.ids.length > 0 ? payload.ids[0] : null) ??
        (typeof payload === 'string' ? payload : null);
      this.handleDrawingSelected(selectedId);
    };
    const onDeselect = () => this.handleDrawingSelected(null);

    try {
      chart.on('drawing:created', onMutated);
      chart.on('drawing:edited', onMutated);
      chart.on('drawing:draft', onDraft);
      chart.on('drawing:removed', onMutated);
      chart.on('drawing:settings', onMutated);
      chart.on('drawing:selected', onSelected);
      chart.on('drawing:select', onSelected);
      chart.on('drawing:deselect', onDeselect);
    } catch (err) {
      console.warn('Gagal memasang drawing listeners ke chart:', err);
    }

    return () => {
      this.draftInteractionActive = false;
      this.cancelScheduledDraft();
      chart.__trawanganDrawingListenersAttached = false;
      if (typeof chart.off === 'function') {
        try {
          chart.off('drawing:created', onMutated);
          chart.off('drawing:edited', onMutated);
          chart.off('drawing:draft', onDraft);
          chart.off('drawing:removed', onMutated);
          chart.off('drawing:settings', onMutated);
          chart.off('drawing:selected', onSelected);
          chart.off('drawing:select', onSelected);
          chart.off('drawing:deselect', onDeselect);
        } catch (_) {}
      }
    };
  }

  private getStableActivePlans(): Array<ParsedTradingPlan & { id: string }> {
    const curSymbol = typeof this.getSymbol === 'function' ? this.getSymbol() : '';
    const rawPlans = this.planLifecycle.getActivePlans();
    if (
      this.cachedSnapshotPlansRev === this.planRevision &&
      this.cachedSnapshotPlansSymbol === curSymbol &&
      this.cachedSnapshotPlans.length === rawPlans.length &&
      this.cachedSnapshotPlans.every((p, i) => p === rawPlans[i])
    ) {
      return this.cachedSnapshotPlans;
    }
    this.cachedSnapshotPlansRev = this.planRevision;
    this.cachedSnapshotPlansSymbol = curSymbol;
    this.cachedSnapshotPlans = rawPlans;
    return rawPlans;
  }

  private getStableThesisCardGeometries(): Record<string, SavedThesisCardGeometry> {
    if (this.cachedSnapshotGeometriesSrc === this.thesisCardGeometries) {
      return this.cachedSnapshotGeometriesOut;
    }
    this.cachedSnapshotGeometriesSrc = this.thesisCardGeometries;
    this.cachedSnapshotGeometriesOut = this.getThesisCardGeometries();
    return this.cachedSnapshotGeometriesOut;
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
      activePlans: this.getStableActivePlans(),
      showThesisCards: this.planLifecycle.isThesisCardsVisible(),
      thesisCardGeometries: this.getStableThesisCardGeometries()
    };
  }

  /**
   * Berlangganan khusus mutasi pratinjau `drawing:draft` berfrekuensi tinggi (maks. 1x per rAF)
   * tanpa memicu rebuild state workspace atau daftar plan penuh pada tiap pointermove.
   */
  subscribeDraft(fn: (activeDrawings: any[]) => void): () => void {
    this.draftSubscribers.add(fn);
    fn([...this.activeDrawings]);
    return () => {
      this.draftSubscribers.delete(fn);
    };
  }

  private notifyDraft(): void {
    if (this.draftSubscribers.size === 0) return;
    const drawings = [...this.activeDrawings];
    for (const fn of this.draftSubscribers) {
      try {
        fn(drawings);
      } catch (err) {
        console.error('Error pada draftSubscriber DrawingController:', err);
      }
    }
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

  private applyToAllCellDrawings(action: (drawings: any) => void, errorLabel: string): void {
    const cells = this.getAllCells();
    if (cells.length > 0) {
      for (const cell of cells) {
        const chart = this.getChartForCell(cell);
        if (chart?.drawings) {
          try {
            action(chart.drawings);
          } catch (e) {
            console.warn(`ChartDrawingController ${errorLabel} error:`, e);
          }
        }
      }
    } else {
      const activeChart = this.getActiveChart();
      if (activeChart?.drawings) {
        try {
          action(activeChart.drawings);
        } catch (e) {
          console.warn(`ChartDrawingController ${errorLabel} error:`, e);
        }
      }
    }
  }

  /**
   * Atur mode snap magnet
   */
  setSnapMode(mode: SnapMode): void {
    this.snapMode = mode;
    this.applyToAllCellDrawings((d) => d.setSnapMode(mode), 'setSnapMode');
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
    this.applyToAllCellDrawings((d) => d.setStayMode(stay), 'setStayMode');
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
   * Menambahkan aksi ke riwayat pembatalan (undo timeline)
   */
  pushUndoAction(action: DrawingUndoAction): void {
    this.undoHistory.push(action);
    this.redoHistory = [];
  }

  /**
   * Menyusun DrawingScope kanonikal dari sel aktif dan resolver konteks controller.
   */
  private resolveActiveDrawingScope(overrides?: {
    symbol?: string;
    timeframe?: string | null;
    providerId?: string | null;
    workspaceId?: string | null;
  }): DrawingScope {
    const activeCell = this.workspace?.active as any;
    const rawCellSym = typeof activeCell?.symbol === 'string' ? activeCell.symbol.trim() : '';
    const rawCellProv =
      typeof activeCell?.providerId === 'string'
        ? activeCell.providerId.trim()
        : typeof activeCell?.provider === 'string'
          ? activeCell.provider.trim()
          : '';
    const rawCellTf = typeof activeCell?.timeframe === 'string' ? activeCell.timeframe.trim() : '';
    const cellIdentity = rawCellSym ? getCellMarketIdentity(activeCell) : null;
    const hasExplicitCellProvider = Boolean(rawCellProv) || rawCellSym.includes(':');

    const symFromGetter = typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT';
    const provFromGetter = typeof this.getProviderId === 'function' ? this.getProviderId() : 'binance';
    const tfFromGetter = typeof this.getTimeframe === 'function' ? this.getTimeframe() : '15m';

    const symbol = overrides?.symbol || cellIdentity?.symbol || symFromGetter || 'BTCUSDT';
    const providerId =
      overrides?.providerId ||
      (hasExplicitCellProvider ? cellIdentity?.providerId : undefined) ||
      provFromGetter ||
      cellIdentity?.providerId ||
      'binance';
    const timeframe = overrides?.timeframe ?? (rawCellTf || tfFromGetter || '15m');
    const workspaceId = overrides?.workspaceId || this.getWorkspaceId();

    return {
      workspaceId,
      providerId,
      symbol,
      timeframe,
    };
  }

  /**
   * Helper privat untuk membungkus dokumen drawing + `_trawangan_meta` lalu menyimpannya secara persisten.
   */
  private flushDrawingDocumentToStorage(doc: any, envelope?: SerializedPlanEnvelope): void {
    if (!doc) return;
    const curSym = typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT';
    const curProv = typeof this.getProviderId === 'function' ? this.getProviderId() : 'binance';
    const curWs = this.getWorkspaceId();

    this.persistence.saveScopedDrawingsDebounced(
      {
        workspaceId: curWs,
        providerId: curProv,
        symbol: curSym,
        timeframe: 'GLOBAL',
      },
      {
        ...doc,
        _trawangan_meta: envelope ?? this.planLifecycle.toPersistedEnvelope()
      }
    );
  }

  /**
   * Helper privat untuk menyinkronkan dokumen drawing + _trawangan_meta ke penyimpanan persisten.
   */
  private persistDrawingDocument(): void {
    if (this.isRestoring) return;
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings || typeof activeChart.drawings.toJSON !== 'function') return;

    try {
      const doc = activeChart.drawings.toJSON();
      this.flushDrawingDocumentToStorage(doc);
    } catch (err) {
      console.warn('Gagal menyinkronkan dokumen drawing:', err);
    }
  }

  /**
   * Helper privat untuk memasang kembali daftar drawing ke chart saat undo/redo.
   */
  private restoreDrawingsToChart(
    drawings: any[],
    options: { fallbackType?: string; clone?: boolean } = {}
  ): void {
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings || !Array.isArray(drawings)) return;
    const { fallbackType = 'position', clone = true } = options;

    for (const rawDrawing of drawings) {
      let d = rawDrawing;
      if (clone) {
        try {
          d = structuredClone(rawDrawing);
        } catch {
          d = { ...rawDrawing };
        }
      }
      if (typeof activeChart.drawings.create === 'function') {
        activeChart.drawings.create(d);
      } else if (typeof activeChart.drawings.add === 'function') {
        activeChart.drawings.add(d.type || fallbackType, d);
      } else if (typeof activeChart.drawings.all === 'function') {
        const currentAll = activeChart.drawings.all();
        if (Array.isArray(currentAll) && !currentAll.some((x: any) => x.id === d.id)) {
          currentAll.push(d);
        }
      }
    }
  }

  /**
   * Batalkan aksi gambar terakhir (Undo)
   * Mendukung pemulihan drawing yang terhapus karena scribble, pembatalan pembuatan, serta pemulihan edit multi-target
   */
  undo(): void {
    const activeChart = this.getActiveChart();

    if (this.undoHistory.length > 0) {
      const lastAction = this.undoHistory.pop()!;
      this.redoHistory.push(lastAction);

      if (lastAction.action === 'erase') {
        // Pulihkan drawing yang terhapus
        this.restoreDrawingsToChart(lastAction.drawings, { fallbackType: 'trendline' });
      } else if (lastAction.action === 'create') {
        const ids = lastAction.drawings.map((d: any) => d.id).filter(Boolean);
        this.removeDrawingsFromChart(ids);
        if (this.selectedDrawingId && ids.includes(this.selectedDrawingId)) {
          this.selectedDrawingId = null;
        }
      } else if (lastAction.action === 'create_multi_position') {
        const ids = lastAction.drawingIds || lastAction.drawings.map((d: any) => d.id).filter(Boolean);
        const prevRestoring = this.isRestoring;
        this.isRestoring = true;
        try {
          this.removeDrawingsFromChart(ids);
          if (lastAction.plan) {
            this.planLifecycle.reconcileUndoTransition('undo', {
              action: 'create',
              plan: structuredClone(lastAction.plan),
              drawingIds: [...ids],
              drawings: structuredClone(lastAction.drawings),
              autoCreateAlerts: Boolean(lastAction.autoCreateAlerts)
            });
          }
          if (this.selectedDrawingId && ids.includes(this.selectedDrawingId)) {
            this.selectedDrawingId = null;
          }
        } finally {
          this.isRestoring = prevRestoring;
        }
      } else if (lastAction.action === 'update_multi_position') {
        const newIds = lastAction.drawingIds || [];
        const prevRestoring = this.isRestoring;
        this.isRestoring = true;
        try {
          this.removeDrawingsFromChart(newIds);
          this.restoreDrawingsToChart(lastAction.previousDrawings || []);
          this.planLifecycle.reconcileUndoTransition('undo', {
            action: 'update',
            plan: structuredClone(lastAction.plan),
            drawingIds: [...newIds],
            drawings: structuredClone(lastAction.drawings),
            autoCreateAlerts: Boolean(lastAction.autoCreateAlerts),
            previousPlan: structuredClone(lastAction.previousPlan),
            previousDrawingIds: [...(lastAction.previousDrawingIds || [])],
            previousDrawings: structuredClone(lastAction.previousDrawings || []),
            previousAlertsEnabled: Boolean(lastAction.previousAlertsEnabled)
          });
          if (this.selectedDrawingId && newIds.includes(this.selectedDrawingId)) {
            this.selectedDrawingId = null;
          }
        } finally {
          this.isRestoring = prevRestoring;
        }
      }
    }

    const undoneAction = this.redoHistory[this.redoHistory.length - 1]?.action;
    const isInternalAction =
      undoneAction === 'create_multi_position' ||
      undoneAction === 'update_multi_position' ||
      undoneAction === 'create';
    if (!isInternalAction && activeChart?.drawings) {
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

    if (this.redoHistory.length > 0) {
      const lastAction = this.redoHistory.pop()!;
      this.undoHistory.push(lastAction);

      if (lastAction.action === 'erase') {
        const ids = lastAction.drawings.map((d) => d.id).filter(Boolean);
        this.removeDrawingsFromChart(ids);
      } else if (lastAction.action === 'create') {
        this.restoreDrawingsToChart(lastAction.drawings, { fallbackType: 'trendline' });
      } else if (lastAction.action === 'create_multi_position') {
        const prevRestoring = this.isRestoring;
        this.isRestoring = true;
        try {
          this.restoreDrawingsToChart(lastAction.drawings);
          if (lastAction.plan) {
            const ids = lastAction.drawingIds || lastAction.drawings.map((d: any) => d.id).filter(Boolean);
            this.planLifecycle.reconcileUndoTransition('redo', {
              action: 'create',
              plan: structuredClone(lastAction.plan),
              drawingIds: [...ids],
              drawings: structuredClone(lastAction.drawings),
              autoCreateAlerts: Boolean(lastAction.autoCreateAlerts)
            });
          }
        } finally {
          this.isRestoring = prevRestoring;
        }
      } else if (lastAction.action === 'update_multi_position') {
        const prevIds = lastAction.previousDrawingIds || [];
        const prevRestoring = this.isRestoring;
        this.isRestoring = true;
        try {
          this.removeDrawingsFromChart(prevIds);
          this.restoreDrawingsToChart(lastAction.drawings);
          this.planLifecycle.reconcileUndoTransition('redo', {
            action: 'update',
            plan: structuredClone(lastAction.plan),
            drawingIds: [...(lastAction.drawingIds || [])],
            drawings: structuredClone(lastAction.drawings),
            autoCreateAlerts: Boolean(lastAction.autoCreateAlerts),
            previousPlan: structuredClone(lastAction.previousPlan),
            previousDrawingIds: [...prevIds],
            previousDrawings: structuredClone(lastAction.previousDrawings || []),
            previousAlertsEnabled: Boolean(lastAction.previousAlertsEnabled)
          });
          if (this.selectedDrawingId && prevIds.includes(this.selectedDrawingId)) {
            this.selectedDrawingId = null;
          }
        } finally {
          this.isRestoring = prevRestoring;
        }
      }
    }

    const redoneAction = this.undoHistory[this.undoHistory.length - 1]?.action;
    const isInternalAction =
      redoneAction === 'create_multi_position' ||
      redoneAction === 'update_multi_position' ||
      redoneAction === 'create';
    if (!isInternalAction && activeChart?.drawings) {
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

    await this.persistence.clearScopedDrawings(this.resolveActiveDrawingScope());

    this.planRevision++;
    this.planLifecycle.resetInMemoryState(true);

    this.activeDrawings = [];
    this.selectedDrawingId = null;
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
    if (this.selectedDrawingId) return this.selectedDrawingId;
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        const ctrl = (activeChart.drawings as any).ctrl || (activeChart.drawings as any);
        const ids = ctrl?.selectedIds;
        if (Array.isArray(ids) && ids.length > 0 && typeof ids[0] === 'string') {
          return ids[0];
        }
        if (ids instanceof Set && ids.size > 0) {
          return [...ids][0];
        }
      } catch (_) {}
    }
    return null;
  }

  /**
   * Mengambil seluruh ID objek gambar yang sedang terseleksi (multi-selection)
   */
  getSelectedDrawingIds(): string[] {
    const list: string[] = [];
    if (this.selectedDrawingId) list.push(this.selectedDrawingId);
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        const ctrl = (activeChart.drawings as any).ctrl || (activeChart.drawings as any);
        const ids = ctrl?.selectedIds;
        if (Array.isArray(ids)) {
          for (const id of ids) {
            if (id && typeof id === 'string' && !list.includes(id)) list.push(id);
          }
        } else if (ids instanceof Set) {
          for (const id of ids) {
            if (id && typeof id === 'string' && !list.includes(id)) list.push(id);
          }
        }
      } catch (_) {}
    }
    return list;
  }

  /**
   * Hapus seluruh objek gambar yang sedang dipilih (baik via Del/Backspace maupun programatik)
   */
  deleteSelectedDrawing(): string[] {
    const ids = this.getSelectedDrawingIds();
    if (ids.length === 0) return [];
    for (const id of ids) {
      this.deleteDrawing(id);
    }
    return ids;
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
    this.planLifecycle.unlinkDrawingIds([id]);
    this.handleDrawingMutated();
  }

  /**
   * Menangani event penghapusan drawing untuk membersihkan relasi plan dan memicu re-evaluasi plan
   */
  handleDrawingRemoved(ids: string[]): void {
    if (!Array.isArray(ids) || ids.length === 0) return;
    this.removeDrawingsFromChart(ids);
    for (const id of ids) {
      if (this.selectedDrawingId === id) {
        this.selectedDrawingId = null;
      }
    }
    this.planLifecycle.unlinkDrawingIds(ids);
    this.handleDrawingMutated();
  }

  /**
   * Duplikasi objek gambar yang sedang dipilih (Ctrl+D) dengan pergeseran spasial lembut
   */
  duplicateSelectedDrawing(): string | null {
    const selectedId = this.getSelectedDrawingId();
    if (!selectedId) return null;
    return this.duplicateDrawing(selectedId);
  }

  /**
   * Duplikasi objek gambar tertentu berdasarkan ID
   */
  duplicateDrawing(id: string): string | null {
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings) return null;

    const all = typeof activeChart.drawings.all === 'function'
      ? activeChart.drawings.all()
      : this.activeDrawings;
    const source = all.find((d: any) => d && d.id === id);
    if (!source) return null;

    // Hitung offset spasial harga dan waktu adaptif
    const firstPrice = source.anchors?.[0]?.price ?? 100;
    const tick = getAdaptiveTickSize(firstPrice, undefined, this.getSymbol());
    const priceOffset = tick * 5;
    const { deltaT } = resolveCandleMetrics(activeChart, this.getTimeframe());
    const timeOffset = deltaT > 0 ? deltaT : 60000;

    const clonedAnchors = Array.isArray(source.anchors)
      ? source.anchors.map((a: any) => ({
          ...a,
          time: typeof a.time === 'number' ? a.time + timeOffset : a.time,
          price: typeof a.price === 'number' ? a.price - priceOffset : a.price
        }))
      : [];

    const clonedPoints = Array.isArray(source.points)
      ? source.points.map((p: any) => ({
          ...p,
          x: typeof p.x === 'number' ? p.x + 20 : p.x,
          y: typeof p.y === 'number' ? p.y + 20 : p.y
        }))
      : undefined;

    const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const newId = `draw_${uuid}`;

    const clonedItem: any = {
      ...source,
      id: newId,
      anchors: clonedAnchors,
      ...(clonedPoints ? { points: clonedPoints } : {}),
      style: source.style ? JSON.parse(JSON.stringify(source.style)) : undefined,
      text: source.text ? JSON.parse(JSON.stringify(source.text)) : undefined,
      metadata: source.metadata ? { ...JSON.parse(JSON.stringify(source.metadata)), planId: undefined } : undefined,
    };
    if (typeof source.x1 === 'number') clonedItem.x1 = source.x1 + 20;
    if (typeof source.y1 === 'number') clonedItem.y1 = source.y1 + 20;
    if (typeof source.x2 === 'number') clonedItem.x2 = source.x2 + 20;
    if (typeof source.y2 === 'number') clonedItem.y2 = source.y2 + 20;
    if (typeof source.x === 'number') clonedItem.x = source.x + 20;
    if (typeof source.y === 'number') clonedItem.y = source.y + 20;

    let created: any = null;
    try {
      if (typeof activeChart.drawings.create === 'function') {
        created = activeChart.drawings.create(clonedItem);
      } else if (typeof activeChart.drawings.add === 'function') {
        created = activeChart.drawings.add(clonedItem.type || 'trendline', clonedItem);
      } else if (typeof activeChart.drawings.all === 'function') {
        const currentAll = activeChart.drawings.all();
        if (Array.isArray(currentAll)) {
          currentAll.push(clonedItem);
          created = clonedItem;
        }
      }
    } catch (e) {
      console.warn('Gagal menduplikasi drawing:', e);
      return null;
    }

    const finalId = created?.id || newId;

    // Tambahkan aksi ke undo timeline (pushUndoAction)
    this.pushUndoAction({
      action: 'create',
      drawings: [{ ...clonedItem, id: finalId }]
    });

    // Set ID gambar baru sebagai this.selectedDrawingId
    this.selectedDrawingId = finalId;
    this.selectDrawing(finalId);
    this.notify();
    this.handleDrawingMutated();
    return finalId;
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
  createDrawing(spec: { type: string; price?: number; paneId?: string; [key: string]: any }): any {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        let created: any = null;
        const drawingInit: any = { ...spec };

        const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
        const proj = typeof renderer?.drawingProjector === 'function'
          ? renderer.drawingProjector()
          : typeof activeChart?.getProjector === 'function'
            ? activeChart.getProjector()
            : null;

        // Auto-detect target paneId dari spec.paneId, atau dari koordinat titik spec.points
        let targetPaneId = drawingInit.paneId;
        if (!targetPaneId && proj && Array.isArray(spec.points) && spec.points.length > 0) {
          const firstPt = spec.points[0];
          if (typeof firstPt?.y === 'number' && typeof proj.paneIdAtY === 'function') {
            targetPaneId = proj.paneIdAtY(firstPt.y);
            // Jika berada di batas separator, coba titik tengah atau titik akhir
            if (!targetPaneId && spec.points.length > 1) {
              const midPt = spec.points[Math.floor(spec.points.length / 2)];
              if (typeof midPt?.y === 'number') {
                targetPaneId = proj.paneIdAtY(midPt.y);
              }
            }
            if (!targetPaneId && spec.points.length > 0) {
              const lastPt = spec.points[spec.points.length - 1];
              if (typeof lastPt?.y === 'number') {
                targetPaneId = proj.paneIdAtY(lastPt.y);
              }
            }
          }
          if (!targetPaneId && typeof renderer?.nearestPaneToY === 'function') {
            targetPaneId = renderer.nearestPaneToY(firstPt.y)?.id;
          }
        }
        if (!targetPaneId) {
          targetPaneId = 'price';
        }
        drawingInit.paneId = targetPaneId;

        // Resolusi anchors data-space ({ time, price }) dari koordinat piksel points jika belum tersedia
        if (spec.points && Array.isArray(spec.points) && !drawingInit.anchors) {
          if (proj && typeof proj.pxToPoint === 'function') {
            drawingInit.anchors = spec.points.map((pt: any) => proj.pxToPoint(pt.x, pt.y, targetPaneId));
          }
        } else if (spec.price !== undefined && !drawingInit.anchors) {
          drawingInit.anchors = [{ time: Date.now(), price: spec.price }];
        }

        // Kotak selain posisi long & short (tipe 'box') dibuat 100% transparan hanya dengan border dan teks di tengah
        if (drawingInit.type === 'box') {
          drawingInit.style = {
            lineWidth: 1,
            lineColor: drawingInit.style?.lineColor || 'rgba(56, 189, 248, 0.6)',
            ...(drawingInit.style || {}),
            fillColor: 'transparent'
          };
          if (drawingInit.text) {
            drawingInit.text.halign = 'center';
            drawingInit.text.valign = 'middle';
            drawingInit.text.align = 'center';
          }
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
   * Mendelegasikan proyeksi ke deep module TradingPlanLifecycle.
   */
  createMultiTargetPosition(
    plan: ParsedTradingPlan & { id?: string },
    options?: ApplyPlanOptions
  ): { planId: string; drawingIds: string[]; drawings: any[] } | null {
    const res = this.planLifecycle.projectPlan(plan, options);
    if (!res) return null;
    return {
      planId: res.planId,
      drawingIds: res.drawingIds,
      drawings: res.drawings
    };
  }

  /**
   * Menerapkan rencana perdagangan secara asinkron/deterministik (menunggu kesiapan simbol jika lintas koin)
   */
  async applyTradingPlan(
    plan: ParsedTradingPlan & { id?: string },
    options?: ApplyPlanOptions
  ): Promise<AppliedPlanResult | null> {
    return this.planLifecycle.applyPlan(plan, options);
  }

  /**
   * Memperbarui Trading Plan yang sedang aktif secara in-place pada simbol aktif.
   */
  async updateTradingPlan(
    planId: string,
    plan: ParsedTradingPlan & { id?: string },
    options?: UpdatePlanOptions
  ): Promise<AppliedPlanResult | null> {
    const res = this.planLifecycle.updatePlan(planId, plan, options);
    if (res) {
      this.handleDrawingMutated();
    }
    return res;
  }

  /**
   * Dapatkan seluruh rencana perdagangan aktif di kanvas yang terfilter sesuai koin/simbol aktif
   */
  getActivePlans(symbolFilter?: string): Array<ParsedTradingPlan & { id: string; symbol?: string }> {
    return this.planLifecycle.getActivePlans(symbolFilter);
  }

  /**
   * Dapatkan seluruh rencana perdagangan tanpa filter simbol (untuk persistensi sesi menyeluruh)
   */
  getAllActivePlans(): Array<ParsedTradingPlan & { id: string; symbol?: string }> {
    return this.planLifecycle.getAllActivePlans();
  }

  /**
   * Status visibilitas Thesis Cards
   */
  isThesisCardsVisible(): boolean {
    return this.planLifecycle.isThesisCardsVisible();
  }

  /**
   * Atur visibilitas Thesis Cards
   */
  setThesisCardsVisible(visible: boolean): void {
    this.planLifecycle.setThesisCardsVisible(visible);
  }

  /**
   * Toggle visibilitas Thesis Cards
   */
  toggleThesisCardsVisible(): boolean {
    return this.planLifecycle.toggleThesisCardsVisible();
  }

  /**
   * Hapus rencana perdagangan tertentu beserta seluruh drawing terkait
   */
  removePlan(planId: string): void {
    this.planRevision++;
    if (planId && this.thesisCardGeometries[planId]) {
      const next = { ...this.thesisCardGeometries };
      delete next[planId];
      this.thesisCardGeometries = next;
    }
    this.planLifecycle.removePlan(planId);
  }

  /**
   * Bersihkan seluruh rencana perdagangan aktif beserta gambarnya dari kanvas
   */
  clearAllPlans(): void {
    this.planRevision++;
    this.thesisCardGeometries = {};
    this.planLifecycle.clearAllPlans();
  }

  /**
   * Membaca salinan geometri seluruh kartu tesis (posisi, ukuran, wide/minimized)
   */
  getThesisCardGeometries(): Record<string, SavedThesisCardGeometry> {
    const out: Record<string, SavedThesisCardGeometry> = {};
    for (const [planId, geo] of Object.entries(this.thesisCardGeometries)) {
      if (geo && typeof geo === 'object') {
        out[planId] = { ...geo };
      }
    }
    return out;
  }

  private normalizeThesisCardGeometry(geo: SavedThesisCardGeometry): SavedThesisCardGeometry {
    return {
      x: typeof geo.x === 'number' && Number.isFinite(geo.x) ? geo.x : 16,
      y: typeof geo.y === 'number' && Number.isFinite(geo.y) ? geo.y : 56,
      width: typeof geo.width === 'number' && Number.isFinite(geo.width) ? geo.width : 340,
      ...(typeof geo.height === 'number' && Number.isFinite(geo.height) ? { height: geo.height } : {}),
      isWideMode: Boolean(geo.isWideMode),
      isMinimized: Boolean(geo.isMinimized),
    };
  }

  /**
   * Memperbarui geometri satu kartu tesis dengan equality guard agar tidak memicu dirty save berulang
   */
  setThesisCardGeometry(planId: string, geo: SavedThesisCardGeometry): boolean {
    if (!planId || !geo || typeof geo !== 'object') return false;
    const normalized = this.normalizeThesisCardGeometry(geo);

    const prev = this.thesisCardGeometries[planId];
    if (
      prev &&
      prev.x === normalized.x &&
      prev.y === normalized.y &&
      prev.width === normalized.width &&
      prev.height === normalized.height &&
      Boolean(prev.isWideMode) === Boolean(normalized.isWideMode) &&
      Boolean(prev.isMinimized) === Boolean(normalized.isMinimized)
    ) {
      return false;
    }

    this.thesisCardGeometries = {
      ...this.thesisCardGeometries,
      [planId]: normalized,
    };
    this.notify();
    return true;
  }

  /**
   * Memulihkan seluruh geometri kartu tesis dari snapshot workspace
   */
  restoreThesisCardGeometries(geometries?: Record<string, SavedThesisCardGeometry> | null): void {
    const next: Record<string, SavedThesisCardGeometry> = {};
    if (geometries && typeof geometries === 'object') {
      for (const [planId, geo] of Object.entries(geometries)) {
        if (!planId || !geo || typeof geo !== 'object') continue;
        next[planId] = this.normalizeThesisCardGeometry(geo);
      }
    }
    this.thesisCardGeometries = next;
    this.notify();
  }

  /**
   * Bersihkan state rencana perdagangan di memori tanpa menghapus objek gambar visual di kanvas
   */
  resetInMemoryPlanState(): void {
    this.planRevision++;
    this.planLifecycle.resetInMemoryState(false);
    this.notify();
  }

  /**
   * Pulihkan koleksi rencana perdagangan aktif ke kanvas (Workspace Persistence)
   */
  restorePlans(plans: Array<ParsedTradingPlan & { id: string; symbol?: string }>, showCards: boolean = true): void {
    this.planRevision++;
    this.planLifecycle.restorePlans(plans, showCards);
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

        // Tempelkan kembali metadata ke activeDrawings sebelum sanitasi
        this.planLifecycle.reattachMetadataToDrawings(this.activeDrawings);

        // Tick-Aligned Price Guard: Sanitasi anchors harga khusus gambar pada pane utama 'price'
        const activeSym = this.getSymbol();
        for (const d of this.activeDrawings) {
          if ((!d.paneId || d.paneId === 'price') && Array.isArray(d.anchors)) {
            for (const a of d.anchors) {
              if (typeof a.price === 'number') {
                a.price = roundToTickSize(a.price, undefined, activeSym);
              }
            }
          }
        }

        // Kotak selain posisi long & short (tipe 'box') dipastikan 100% transparan dengan border dan teks di tengah
        for (const d of this.activeDrawings) {
          if (d && d.type === 'box') {
            if (d.style && d.style.fillColor !== 'transparent' && d.style.fillColor !== 'rgba(0, 0, 0, 0)') {
              d.style.fillColor = 'transparent';
              const chartItem = typeof activeChart.drawings.get === 'function' ? activeChart.drawings.get(d.id) : null;
              if (chartItem && chartItem.style) {
                chartItem.style.fillColor = 'transparent';
              }
            }
            if (d.text) {
              d.text.halign = 'center';
              d.text.valign = 'middle';
              d.text.align = 'center';
              const chartItem = typeof activeChart.drawings.get === 'function' ? activeChart.drawings.get(d.id) : null;
              if (chartItem && chartItem.text) {
                chartItem.text.halign = 'center';
                chartItem.text.valign = 'middle';
                chartItem.text.align = 'center';
              }
            }
          }
        }

        // Rekonsiliasi siklus hidup Trading Plan (Bidirectional Sync, Dual-Entry Delta-Shift, Orphan Cleanup)
        const envelope = this.planLifecycle.reconcileCanvasMutation(this.activeDrawings);
        this.planRevision++;

        const doc = activeChart.drawings.toJSON?.();
        if (doc) {
          this.flushDrawingDocumentToStorage(doc, envelope);
        }
      } catch (err) {
        console.warn('Gagal memproses auto-save drawing:', err);
      }
    }
    this.notifyDraft();
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
   * Tangani event drawing:draft saat drag interaktif berlangsung.
   * Jika `draftOnly: true`, pembaruan hanya diteruskan ke `subscribeDraft` untuk badge harga ringan
   * tanpa memicu reaktivitas state workspace/plan penuh sampai mutasi selesai.
   */
  handleDrawingDraft(options?: { draftOnly?: boolean }): void {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        this.activeDrawings = [...(activeChart.drawings.all?.() || [])];
      } catch (_) {}
    }
    this.notifyDraft();
    if (!options?.draftOnly) {
      this.notify();
    }
  }

  /**
   * Muat dan pasang gambar yang tersimpan dari SQLite / Storage sesuai workspace, bursa, dan simbol aktif
   */
  async restoreDrawings(
    targetSymbol?: string,
    targetTimeframe?: string,
    targetProvider?: string,
    targetWorkspace?: string
  ): Promise<RestoreDrawingsResult> {
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings) return { hasAuthoritativePlanMeta: false };

    // 1. Flush gambar in-flight yang sedang aktif sebelum beralih konteks
    try {
      const curSym = typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT';
      const curProv = typeof this.getProviderId === 'function' ? this.getProviderId() : 'binance';
      const curWs = this.getWorkspaceId();
      await this.persistence.flushScopedDrawings({
        workspaceId: curWs,
        providerId: curProv,
        symbol: curSym,
        timeframe: 'GLOBAL',
      });
    } catch (_) {}

    let hasAuthoritativePlanMeta = false;
    this.isRestoring = true;
    try {
      // 2. Bersihkan kanvas aktif terlebih dahulu (clean slate) agar gambar bursa lama tidak bocor
      this.clearCanvasVisuals();
      this.planRevision++;
      this.planLifecycle.resetInMemoryState(false);

      const doc = await this.persistence.loadScopedDrawings(
        this.resolveActiveDrawingScope({
          symbol: targetSymbol,
          timeframe: targetTimeframe,
          providerId: targetProvider,
          workspaceId: targetWorkspace,
        })
      );

      if (doc) {
        // Pulihkan metadata dan activePlans jika tersimpan di payload _trawangan_meta
        if (isValidPlanEnvelope(doc._trawangan_meta)) {
          hasAuthoritativePlanMeta = true;
          this.planRevision++;
          this.planLifecycle.hydrateFromEnvelope(doc._trawangan_meta);
        }

        if (activeChart.drawings) {
          activeChart.drawings.fromJSON(doc);
          this.activeDrawings = (activeChart.drawings.all?.() || []) as ChartDrawingItem[];
          this.planLifecycle.reattachMetadataToDrawings(this.activeDrawings);
        }
      }
    } catch (err) {
      console.warn('Gagal memulihkan drawings:', err);
    } finally {
      this.isRestoring = false;
      this.notify();
    }
    return { hasAuthoritativePlanMeta };
  }

  /**
   * Memulihkan seluruh gambar dan metadata trading plan pada setiap sel secara terisolasi per pasangan bursa:simbol.
   */
  async restoreAllCellDrawings(targetWorkspace?: string): Promise<RestoreDrawingsResult> {
    const cells = this.getAllCells();
    if (cells.length === 0) {
      return await this.restoreDrawings(undefined, undefined, undefined, targetWorkspace);
    }

    try {
      const curSym = typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT';
      const curProv = typeof this.getProviderId === 'function' ? this.getProviderId() : 'binance';
      const curWs = targetWorkspace || this.getWorkspaceId();
      await this.persistence.flushScopedDrawings({
        workspaceId: curWs,
        providerId: curProv,
        symbol: curSym,
        timeframe: 'GLOBAL',
      });
    } catch (_) {}

    let hasAuthoritativePlanMeta = false;
    this.isRestoring = true;
    try {
      this.planRevision++;
      this.planLifecycle.resetInMemoryState(false);
      const ws = targetWorkspace || this.getWorkspaceId();

      for (const cell of cells) {
        const cellChart = this.getChartForCell(cell);
        if (!cellChart?.drawings) continue;

        if (typeof cellChart.drawings.fromJSON === 'function') {
          cellChart.drawings.fromJSON({ version: 1, drawings: [] });
        } else if (typeof cellChart.drawings.clear === 'function') {
          cellChart.drawings.clear();
        } else if (typeof cellChart.drawings.removeMany === 'function') {
          const existing = cellChart.drawings.all?.() || [];
          if (existing.length > 0) {
            cellChart.drawings.removeMany(existing.map((d: any) => d.id));
          }
        }

        const identity = getCellMarketIdentity(cell);
        const sym = identity.symbol || (typeof this.getSymbol === 'function' ? this.getSymbol() : 'BTCUSDT');
        const prov = identity.providerId || (typeof this.getProviderId === 'function' ? this.getProviderId() : 'binance');
        const tf = (typeof (cell as any)?.timeframe === 'string' && (cell as any).timeframe.trim())
          || (typeof this.getTimeframe === 'function' ? this.getTimeframe() : '15m');

        const doc = await this.persistence.loadScopedDrawings({
          workspaceId: ws,
          providerId: prov,
          symbol: sym,
          timeframe: tf,
        });

        if (doc) {
          if (isValidPlanEnvelope(doc._trawangan_meta)) {
            hasAuthoritativePlanMeta = true;
            this.planRevision++;
            this.planLifecycle.hydrateFromEnvelope(doc._trawangan_meta);
          }
          if (typeof cellChart.drawings.fromJSON === 'function') {
            cellChart.drawings.fromJSON(doc);
          }
        }
      }

      const activeChart = this.getActiveChart();
      this.activeDrawings = [...(activeChart?.drawings?.all?.() || [])] as ChartDrawingItem[];
      this.planLifecycle.reattachMetadataToDrawings(this.activeDrawings);
      this.lastActiveCellIdentity = this.captureCellIdentity(this.workspace?.active);
    } catch (err) {
      console.warn('Gagal memulihkan drawings multi-cell:', err);
    } finally {
      this.isRestoring = false;
      this.notify();
    }
    return { hasAuthoritativePlanMeta };
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

    // Duplikasi Objek Gambar (Ctrl+D)
    unbinders.push(
      dispatcher.bindHandler('duplicate-selected-drawing', () => {
        this.duplicateSelectedDrawing();
      })
    );

    // Toggle Sembunyikan Objek Gambar (Alt+K)
    unbinders.push(
      dispatcher.bindHandler('toggle-hide-drawings', () => {
        this.toggleHide();
      })
    );

    // Toggle Kunci Objek Gambar (Alt+L)
    unbinders.push(
      dispatcher.bindHandler('toggle-lock-drawings', () => {
        this.toggleLock();
      })
    );

    // Hapus Seluruh Objek Gambar (Ctrl+Del)
    unbinders.push(
      dispatcher.bindHandler('clear-all-drawings', () => {
        this.clearAll();
      })
    );

    // Hapus Objek Terseleksi (Del / Backspace)
    if (!dispatcher.hasHandler('draw-delete')) {
      unbinders.push(
        dispatcher.bindHandler('draw-delete', () => {
          const selectedId = this.getSelectedDrawingId();
          if (selectedId) {
            this.deleteDrawing(selectedId);
          }
        })
      );
    }

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
