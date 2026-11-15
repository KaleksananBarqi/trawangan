/**
 * Koordinator Terpadu Runtime Pine Script (Ticket #219 / Spec #210)
 *
 * Menyatukan tiga subsistem Pine runtime di balik satu modul cell-aware:
 * 1. Telemetri strategi kuantitatif & marker eksekusi on-chart (PineStrategyTelemetryService)
 * 2. Jembatan alert/warning Pine dengan deduplikasi per-bar (PineAlertBridge)
 * 3. Resolusi & caching seri inter-simbol untuk `request.security()` (pineSeriesAdapter)
 *
 * Menggantikan 6 pasang hook siklus hidup terpisah di ChartSessionController
 * dengan satu pengikatan observer per sel (`attachCell` / `disposeCell`).
 */

import {
  PineStrategyTelemetryService,
  parseStrategyState,
  parseStrategyTrades,
  tradesToTradeExecutions,
  extractStrategyTelemetryPayload,
  telemetryToPerformanceSummary,
  type StrategyState,
  type StrategyFill,
  type StrategyTrade,
  type TradeExecution,
  type StrategyTelemetryPayload,
} from './pineStrategyTelemetry';
import {
  PineAlertBridge,
  type PineAlertPayload,
  type PineWarningPayload,
  type PineAlertRecord,
  type PineWarningRecord,
} from './pineAlertBridge';
import {
  createPineFetchSeriesAdapter,
  TrawanganPineWorkerEngine,
  parseSeriesTicker,
  normalizeSeriesTimeframe,
  applyRangeBounds,
  toOHLCVBar,
  type FetchSeriesHandler,
  type FetchSeriesRange,
  type OHLCVBar,
  type ParsedSeriesTicker,
  type PineFetchSeriesAdapterOptions,
  type PineWorkerEngineOptions,
} from './pineSeriesAdapter';
import type { alertService as AlertServiceType } from './alertService';

export type {
  StrategyState,
  StrategyFill,
  StrategyTrade,
  TradeExecution,
  StrategyTelemetryPayload,
  PineAlertPayload,
  PineWarningPayload,
  PineAlertRecord,
  PineWarningRecord,
  FetchSeriesHandler,
  FetchSeriesRange,
  OHLCVBar,
  ParsedSeriesTicker,
  PineFetchSeriesAdapterOptions,
  PineWorkerEngineOptions,
};

export {
  PineStrategyTelemetryService,
  parseStrategyState,
  parseStrategyTrades,
  tradesToTradeExecutions,
  extractStrategyTelemetryPayload,
  telemetryToPerformanceSummary,
  PineAlertBridge,
  createPineFetchSeriesAdapter,
  TrawanganPineWorkerEngine,
  parseSeriesTicker,
  normalizeSeriesTimeframe,
  applyRangeBounds,
  toOHLCVBar,
};

/** Konteks sel grafik yang diobservasi oleh PineRuntimeCoordinator */
export interface PineCellContext {
  cell: any;
  cellId: string;
  symbol: string;
  resolveSymbol?: () => string;
  cleanup: () => void;
}

/** Opsi konfigurasi untuk PineRuntimeCoordinator */
export interface PineRuntimeCoordinatorOptions {
  strategyTelemetry?: PineStrategyTelemetryService;
  alertBridge?: PineAlertBridge;
  alertService?: typeof AlertServiceType;
  desktopNotificationSender?: (opts: { title: string; body: string; icon?: string }) => Promise<boolean>;
  fetchSeries?: FetchSeriesHandler;
  fetchSeriesOptions?: PineFetchSeriesAdapterOptions;
  onTelemetry?: (payload: StrategyTelemetryPayload) => void;
  onAlert?: (alert: PineAlertRecord) => void;
  onWarning?: (warning: PineWarningRecord) => void;
  /** Ekstraktor simbol sel opsional (default membaca cell.symbol atau cell.market?.symbol) */
  resolveCellSymbol?: (cell: any) => string;
}

/** Opsi pengikatan satu sel grafik */
export interface AttachPineCellOptions {
  symbol?: string;
  resolveSymbol?: () => string;
  onIndicatorRemoved?: (indicatorId?: string) => void;
  onMarketChanged?: () => void;
}

/**
 * Mengekstrak simbol aktif dari objek sel Vela secara defensif.
 */
function defaultResolveCellSymbol(cell: any): string {
  if (!cell) return 'CHART';
  const raw =
    cell.symbol ??
    cell.market?.symbol ??
    cell.chart?.symbol ??
    cell.inner?.symbol ??
    'CHART';
  return String(raw || 'CHART').trim().toUpperCase();
}

/**
 * Membangun kunci deduplikasi alert berbasis sel, indikator, bar/waktu, dan pesan.
 */
function buildAlertDedupeKey(
  cellId: string,
  indicatorKey: string,
  payload: PineAlertPayload
): string | null {
  // Jika frekuensi eksplisit 'all', jangan deduplikasi per-bar kecuali ID eksplisit identik
  if (payload.freq === 'all') {
    return payload.id ? `${cellId}::${indicatorKey}::id:${payload.id}` : null;
  }

  const barMarker =
    typeof payload.barIndex === 'number'
      ? `bar:${payload.barIndex}`
      : typeof payload.time === 'number'
        ? `time:${payload.time}`
        : payload.id
          ? `id:${payload.id}`
          : null;

  if (!barMarker) return null;
  return `${cellId}::${indicatorKey}::${barMarker}::${payload.message || ''}`;
}

export class PineRuntimeCoordinator {
  public readonly telemetry: PineStrategyTelemetryService;
  public readonly alertBridge: PineAlertBridge;
  private readonly fetchSeriesHandler: FetchSeriesHandler;
  private readonly options: PineRuntimeCoordinatorOptions;

  private attachedCells = new Map<any, PineCellContext>();
  /** Set kunci alert yang sudah dipancarkan untuk mencegah duplikasi pada bar yang sama */
  private emittedAlertKeys = new Set<string>();
  /** Memetakan cellId -> daftar indicatorId yang pernah aktif di sel tersebut */
  private cellIndicatorIds = new Map<string, Set<string>>();

  constructor(options: PineRuntimeCoordinatorOptions = {}) {
    this.options = options;
    this.telemetry = options.strategyTelemetry ?? new PineStrategyTelemetryService();
    this.alertBridge =
      options.alertBridge ??
      new PineAlertBridge({
        alertService: options.alertService,
        desktopNotificationSender: options.desktopNotificationSender,
        onAlert: options.onAlert,
        onWarning: options.onWarning,
      });
    this.fetchSeriesHandler =
      options.fetchSeries ?? createPineFetchSeriesAdapter(options.fetchSeriesOptions);

    if (options.onTelemetry) {
      this.telemetry.subscribe(options.onTelemetry);
    }
    if (options.alertBridge && options.onAlert) {
      this.alertBridge.onAlert(options.onAlert);
    }
    if (options.alertBridge && options.onWarning) {
      this.alertBridge.onWarning(options.onWarning);
    }
  }

  /**
   * Mengembalikan adapter `fetchSeries` untuk resolusi `request.security()`.
   */
  public getFetchSeriesAdapter(): FetchSeriesHandler {
    return this.fetchSeriesHandler;
  }

  /**
   * Membuat instance worker engine Pine dengan injeksi `fetchSeries` terpadu.
   */
  public createWorkerEngine(opts?: Omit<PineWorkerEngineOptions, 'fetchSeries'>): TrawanganPineWorkerEngine {
    return new TrawanganPineWorkerEngine({
      ...opts,
      fetchSeries: this.fetchSeriesHandler,
    });
  }

  /**
   * Mengaitkan seluruh observer Pine runtime (alert, warning, script:run,
   * indicator:removed, market:changed) pada satu sel grafik dalam satu binding.
   */
  public attachCell(cell: any, attachOpts: AttachPineCellOptions = {}): () => void {
    if (!cell) return () => {};

    const chart = cell.chart || cell.inner || cell;
    if (!chart || typeof chart.on !== 'function') {
      return () => {};
    }

    const cellId = String(cell.id || 'default');
    const resolveSym = () => {
      if (attachOpts.resolveSymbol) return attachOpts.resolveSymbol();
      if (this.options.resolveCellSymbol) return this.options.resolveCellSymbol(cell);
      return attachOpts.symbol || defaultResolveCellSymbol(cell);
    };

    // Jika sel sudah terpasang, perbarui konteks simbol tanpa menggandakan listener
    const existing = this.attachedCells.get(cell);
    if (existing) {
      existing.symbol = resolveSym();
      existing.resolveSymbol = resolveSym;
      return existing.cleanup;
    }

    const unsubs: Array<() => void> = [];
    const registerChartEvent = (event: string, handler: (...args: any[]) => any) => {
      try {
        const ret = chart.on(event, handler);
        if (typeof ret === 'function') {
          unsubs.push(ret);
        } else if (typeof chart.off === 'function') {
          unsubs.push(() => {
            try {
              chart.off(event, handler);
            } catch (_) {}
          });
        }
      } catch (err) {
        console.warn(`[PineRuntimeCoordinator] Gagal memasang listener '${event}':`, err);
      }
    };

    registerChartEvent('alert', (payload: PineAlertPayload) => {
      const ctx = this.attachedCells.get(cell);
      this.dispatchAlert(payload, {
        symbol: ctx?.resolveSymbol?.() || ctx?.symbol || resolveSym(),
        cellId,
      });
    });

    registerChartEvent('warning', (payload: PineWarningPayload) => {
      const ctx = this.attachedCells.get(cell);
      this.dispatchWarning(payload, {
        symbol: ctx?.resolveSymbol?.() || ctx?.symbol || resolveSym(),
        cellId,
      });
    });

    registerChartEvent('script:run', async (run: any) => {
      const ctx = this.attachedCells.get(cell);
      await this.handleScriptRun(run, cell, ctx?.resolveSymbol?.() || ctx?.symbol || resolveSym());
    });

    registerChartEvent('indicator:removed', (ev: any) => {
      const removedId = ev?.id ? String(ev.id) : undefined;
      if (removedId) {
        this.handleIndicatorRemoved(removedId, [cell]);
      }
      attachOpts.onIndicatorRemoved?.(removedId);
    });

    registerChartEvent('market:changed', () => {
      this.handleMarketChanged(cell, resolveSym());
      attachOpts.onMarketChanged?.();
    });

    const cleanup = () => {
      for (const unsub of unsubs) {
        try {
          unsub();
        } catch (_) {}
      }
      unsubs.length = 0;
      this.attachedCells.delete(cell);
    };

    this.attachedCells.set(cell, {
      cell,
      cellId,
      symbol: resolveSym(),
      resolveSymbol: resolveSym,
      cleanup,
    });

    return cleanup;
  }

  /**
   * Melepas binding observer pada satu sel grafik.
   */
  public disposeCell(cell: any): void {
    const ctx = this.attachedCells.get(cell);
    if (ctx) {
      ctx.cleanup();
    }
  }

  /**
   * Memproses event `script:run` secara terpadu:
   * mengekstrak telemetri & marker strategi, serta meneruskan alert/warning terdeduplikasi.
   */
  public async handleScriptRun(
    run: any,
    targetCell?: any,
    symbolOverride?: string
  ): Promise<StrategyTelemetryPayload | null> {
    if (!run) return null;

    const cellId = String(targetCell?.id || run?.cell || 'default');
    const symbol =
      symbolOverride ||
      (targetCell ? (this.options.resolveCellSymbol ?? defaultResolveCellSymbol)(targetCell) : 'CHART');

    if (run.id) {
      this.trackCellIndicator(cellId, String(run.id));
    }

    let payload: StrategyTelemetryPayload | null = null;
    if (run.kind === 'strategy' || Boolean(run.strategy) || typeof run.trades === 'function') {
      payload = await this.telemetry.extractFromScriptRun(run, cellId);
      if (payload && targetCell) {
        this.telemetry.routeTradeMarkersToCell(targetCell, payload.indicatorId, payload.tradeExecutions);
      }
    }

    // Proses alert yang ikut dipancarkan dalam payload script:run (jika ada)
    if (Array.isArray(run.alerts)) {
      for (const alertItem of run.alerts) {
        this.dispatchAlert(
          {
            ...alertItem,
            indicatorId: alertItem.indicatorId ?? run.id,
            indicator: alertItem.indicator ?? run.title,
          },
          { symbol, cellId }
        );
      }
    }

    // Proses warning yang ikut dipancarkan dalam payload script:run (jika ada)
    if (Array.isArray(run.warnings)) {
      for (const warnItem of run.warnings) {
        this.dispatchWarning(
          {
            ...warnItem,
            indicatorId: warnItem.indicatorId ?? run.id,
            indicator: warnItem.indicator ?? run.title,
          },
          { symbol, cellId }
        );
      }
    }

    return payload;
  }

  /**
   * Mengekstrak dan merutekan marker strategi dari hasil `handle.context()`.
   */
  public syncStrategyFromContext(
    indicatorId: string,
    context: any,
    title?: string,
    targetCell?: any
  ): StrategyTelemetryPayload | null {
    const cellId = targetCell?.id ? String(targetCell.id) : undefined;
    if (cellId && indicatorId) {
      this.trackCellIndicator(cellId, indicatorId);
    }
    const payload = this.telemetry.extractFromContext(indicatorId, context, title, cellId);
    if (payload && targetCell) {
      this.telemetry.routeTradeMarkersToCell(targetCell, indicatorId, payload.tradeExecutions);
    }
    return payload;
  }

  /**
   * Memproses alert Pine Script dengan deduplikasi per-bar / per-ID.
   */
  public dispatchAlert(
    payload: PineAlertPayload,
    context: { symbol?: string; cellId?: string } = {}
  ): PineAlertRecord | null {
    if (!payload) return null;
    const cellId = context.cellId || 'default';
    const indicatorKey = payload.indicatorId || payload.title || payload.indicator || 'default';

    if (payload.indicatorId) {
      this.trackCellIndicator(cellId, payload.indicatorId);
    }

    const dedupeKey = buildAlertDedupeKey(cellId, indicatorKey, payload);
    if (dedupeKey) {
      if (this.emittedAlertKeys.has(dedupeKey)) {
        return null;
      }
      this.emittedAlertKeys.add(dedupeKey);
    }

    return this.alertBridge.handleAlert(payload, context);
  }

  /**
   * Memproses runtime warning Pine Script.
   */
  public dispatchWarning(
    payload: PineWarningPayload,
    context: { symbol?: string; cellId?: string } = {}
  ): PineWarningRecord {
    const cellId = context.cellId || 'default';
    if (payload.indicatorId) {
      this.trackCellIndicator(cellId, payload.indicatorId);
    }
    return this.alertBridge.handleWarning(payload, context);
  }

  /**
   * Membersihkan telemetri strategi, marker chart, riwayat alert/warning,
   * dan state deduplikasi untuk satu indikator dalam satu langkah.
   */
  public handleIndicatorRemoved(indicatorId: string, cells?: any[]): void {
    if (!indicatorId) return;

    this.telemetry.clearTelemetry(indicatorId);
    this.alertBridge.handleIndicatorRemoved(indicatorId);
    this.clearDedupeForIndicator(indicatorId);
    this.clearSceneTradeMarkers(indicatorId, cells);
  }

  /**
   * Memperbarui konteks simbol dan membersihkan state telemetri, marker,
   * serta deduplikasi alert milik sel saat instrumen pasar berubah.
   */
  public handleMarketChanged(cell: any, newSymbol?: string): void {
    if (!cell) return;
    const ctx = this.attachedCells.get(cell);
    const cellId = String(cell.id || ctx?.cellId || 'default');

    if (ctx) {
      ctx.symbol =
        newSymbol ||
        ctx.resolveSymbol?.() ||
        (this.options.resolveCellSymbol ?? defaultResolveCellSymbol)(cell);
    }

    // Bersihkan seluruh state telemetri strategi & marker yang berasosiasi dengan sel ini
    const trackedIds = this.cellIndicatorIds.get(cellId);
    if (trackedIds) {
      for (const indId of trackedIds) {
        this.telemetry.clearTelemetry(indId);
        this.clearSceneTradeMarkers(indId, [cell]);
      }
      trackedIds.clear();
    }

    // Bersihkan juga telemetri lain yang terikat ke cellId ini
    for (const item of this.telemetry.getAllTelemetry()) {
      if (item.cellId === cellId) {
        this.telemetry.clearTelemetry(item.indicatorId);
        this.clearSceneTradeMarkers(item.indicatorId, [cell]);
      }
    }

    // Bersihkan state deduplikasi untuk sel ini
    this.clearDedupeForCell(cellId);
  }

  /**
   * Membersihkan seluruh state runtime sementara (telemetri strategi, riwayat alert/warning,
   * kunci deduplikasi, dan marker eksekusi pada scene) tanpa melepas pengikatan sel aktif.
   */
  public clearAll(): void {
    this.telemetry.clearTelemetry();
    this.alertBridge.clearHistory();
    this.emittedAlertKeys.clear();
    this.cellIndicatorIds.clear();
    for (const ctx of this.attachedCells.values()) {
      const chart = ctx.cell?.chart || ctx.cell?.inner || ctx.cell;
      const scene = chart?.renderer?.scene || chart?.scene;
      if (scene?.indicators && typeof scene.indicators.values === 'function') {
        for (const model of scene.indicators.values()) {
          if (model && model.trades) {
            model.trades = [];
          }
        }
      }
    }
  }

  /**
   * Membersihkan seluruh state koordinator dan melepas semua sel yang terikat.
   */
  public dispose(): void {
    for (const ctx of [...this.attachedCells.values()]) {
      ctx.cleanup();
    }
    this.attachedCells.clear();
    this.emittedAlertKeys.clear();
    this.cellIndicatorIds.clear();
    this.telemetry.clearTelemetry();
  }

  private trackCellIndicator(cellId: string, indicatorId: string): void {
    let set = this.cellIndicatorIds.get(cellId);
    if (!set) {
      set = new Set<string>();
      this.cellIndicatorIds.set(cellId, set);
    }
    set.add(indicatorId);
  }

  private clearDedupeForIndicator(indicatorId: string): void {
    const token = `::${indicatorId}::`;
    for (const key of this.emittedAlertKeys) {
      if (key.includes(token)) {
        this.emittedAlertKeys.delete(key);
      }
    }
  }

  private clearDedupeForCell(cellId: string): void {
    const prefix = `${cellId}::`;
    for (const key of this.emittedAlertKeys) {
      if (key.startsWith(prefix)) {
        this.emittedAlertKeys.delete(key);
      }
    }
  }

  private clearSceneTradeMarkers(indicatorId: string, cells?: any[]): void {
    const targetCells = cells ?? Array.from(this.attachedCells.keys());
    for (const cell of targetCells) {
      const chart = cell?.chart || cell?.inner || cell;
      const scene = chart?.renderer?.scene || chart?.scene;
      if (scene?.indicators && typeof scene.indicators.get === 'function') {
        const model = scene.indicators.get(indicatorId);
        if (model && model.trades) {
          model.trades = [];
        }
      }
    }
  }
}

/** Instance singleton default untuk koordinator runtime Pine Script */
export const pineRuntimeCoordinator = new PineRuntimeCoordinator();
