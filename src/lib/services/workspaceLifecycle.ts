/**
 * Modul Koordinator Lifecycle Workspace dan Auto-Save Guard Engine
 * 
 * Modul ini menjadi fasad dalam arsitektur deep module untuk:
 * 1. Menjalankan pipeline pemuatan workspace secara terstruktur, deterministik, dan bebas race-condition.
 * 2. Mengenkapsulasi tahapan double-barrier clean-slate, navigasi bursa, restorasi indikator Pine,
 *    pemulihan skala harga, bobot pane, dan rekonstruksi rencana perdagangan (Multi-Target Trading Plans).
 * 3. Mengelola siklus auto-save workspace ber-debounce dengan dirty-checking berbasis Comprehensive Fingerprint.
 */

import type {
  CellSnapshot,
  SavedWorkspace,
  SavedWorkspaceIndicator,
  ActiveIndicatorInfo,
  PaneLayoutEntry,
  NativeIndicatorSnapshot,
  MultiChartSyncConfig,
  Timeframe,
  VisibleRangeSnapshot,
  SnapMode,
  WorkspaceTrackSizes,
} from '../types/market';
import type { SavedThesisCardGeometry } from './chartDrawingController';
import {
  WORKSPACE_SCHEMA_VERSION,
  normalizeWorkspace,
} from './persistence/workspaceSchema';
import { sanitizeRendererConfigForApply } from './persistence/rendererConfigSanitizer';
import {
  computeWorkspaceFingerprint,
} from './persistence/workspaceService';

export const PENDING_WORKSPACE_KEY_PREFIX = 'trawangan_workspace_pending_';

export interface PendingStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Snapshot deklaratif state sesi chart yang dipertukarkan antara WorkspaceLifecycle dan ChartSessionController.
 */
export interface WorkspaceChartSnapshot {
  symbol?: string;
  timeframe?: string;
  layout?: string;
  providerId?: string;
  showVolume?: boolean;
  syncConfig?: MultiChartSyncConfig;
  indicators: SavedWorkspaceIndicator[];
  paneWeights?: number[];
  paneLayout?: PaneLayoutEntry[];
  nativeIndicators?: NativeIndicatorSnapshot[];
  priceScaleState?: any;
  priceStyle?: string;
  priceScaleCountdown?: boolean;
  barSpacing?: number;
  visibleRange?: VisibleRangeSnapshot | null;
  rendererConfig?: Record<string, unknown>;
  cells?: CellSnapshot[];
  trackSizes?: WorkspaceTrackSizes;
  activeCellIndex?: number;
}

export interface ApplyWorkspaceChartSnapshotOptions {
  /** Lewati penyesuaian ulang viewport/visibleRange saat memulihkan snapshot */
  preserveViewport?: boolean;
  /** Callback sinkronisasi daftar indikator aktif ke shell UI */
  onSyncIndicators?: () => void;
  /** Bersihkan indikator lama sebelum menerapkan snapshot (default: true) */
  cleanSlate?: boolean;
}

export interface WorkspaceChartPort {
  /** Menangkap snapshot deklaratif kondisi chart aktif saat ini */
  captureWorkspaceSnapshot(): WorkspaceChartSnapshot;
  /** Menerapkan snapshot deklaratif ke sesi chart melalui pipeline 5-langkah ADR-0023 */
  applyWorkspaceSnapshot(
    snapshot: WorkspaceChartSnapshot,
    options?: ApplyWorkspaceChartSnapshotOptions
  ): Promise<void>;
}

export interface WorkspacePlanPort {
  setWorkspaceId(id: string): void;
  clearAllPlans(): void;
  resetInMemoryPlanState?(): void;
  clearCanvasVisuals?(): void;
  restorePlans(plans: any[], showThesisCards?: boolean): void;
  restoreAllCellDrawings?(targetWorkspace?: string): Promise<{ hasAuthoritativePlanMeta: boolean } | void>;
  getActivePlans(): any[];
  getAllActivePlans?(): any[];
  isThesisCardsVisible(): boolean;
  setThesisCardsVisible?(visible: boolean): void;
  getSnapshot?(): { snapMode?: SnapMode; stayMode?: boolean } | undefined;
  setSnapMode?(mode: SnapMode): void;
  setStayMode?(stay: boolean): void;
  getThesisCardGeometries?(): Record<string, SavedThesisCardGeometry>;
  restoreThesisCardGeometries?(geometries?: Record<string, SavedThesisCardGeometry> | null): void;
  flushDrawings?(): Promise<void>;
}

export interface WorkspaceShellPort {
  openRightDockTab(tab: string): void;
  closeRightDock(): void;
}

export interface WorkspaceLoadPipelineOptions {
  workspace: SavedWorkspace;
  chart: WorkspaceChartPort;
  plan: WorkspacePlanPort;
  shell?: WorkspaceShellPort;
  activeProviderId: string;
  onProviderChange: (providerId: string) => Promise<void>;
  onSymbolChange: (symbol: string) => Promise<void>;
  onTimeframeChange: (timeframe: any) => void;
  onLayoutChange: (layout: string) => void;
  onSyncConfigChange?: (config: any) => void;
  onShowVolumeChange?: (show: boolean) => void;
  onSyncIndicators: () => void;
  onLog?: (message: string, level?: 'info' | 'success' | 'warn' | 'error') => void;
}

export interface WorkspaceLoadResult {
  success: boolean;
  fingerprint: string;
  indicatorCount: number;
  indicatorTitles: string;
  error?: Error;
}

export interface RestoreWorkspaceChartAndPlansOptions {
  workspace: SavedWorkspace;
  chart: WorkspaceChartPort;
  plan?: Partial<WorkspacePlanPort> | null;
  onSyncIndicators?: () => void;
  restoreCellDrawings?: boolean;
  resetPlansWhenEmpty?: boolean;
  preserveViewport?: boolean;
  cleanSlate?: boolean;
}

export interface CellRestorationTarget {
  /** Langkah 1: Sinkronisasi identitas market/timeframe/sesi pada sel target */
  applyMarketIdentity?: (cellSnap: CellSnapshot) => void;
  /** Langkah 2: Terapkan rendererConfig yang sudah disanitasi, priceStyle, & countdown */
  applyRendererConfig?: (config: Record<string, unknown>) => void;
  setPriceStyle?: (style: string) => void;
  setPriceScaleCountdown?: (enabled: boolean) => void;
  /** Langkah 3: Bersihkan studi non-volume lalu mount studi Pine & Native */
  clearNonVolumeIndicators?: () => void;
  addPineIndicator?: (ind: SavedWorkspaceIndicator) => Promise<void>;
  applyNativeIndicators?: (entries: NativeIndicatorSnapshot[]) => Promise<void>;
  onSyncIndicators?: () => void;
  /** Langkah 4: Terapkan tata letak pane berbasis Pane Signature setelah studi selesai mount */
  applyPaneLayout?: (entries: PaneLayoutEntry[], options?: { timeoutMs?: number }) => Promise<boolean>;
  applyPaneWeights?: (weights: number[]) => void | boolean;
  /** Langkah 5: Pulihkan skala harga, barSpacing, & viewport logical range */
  withSuppressedPersistEvents?: (fn: () => void) => void;
  applyPriceScaleState?: (state: any) => void | boolean;
  setBarSpacing?: (spacing: number) => void;
  applyVisibleRange?: (vr: VisibleRangeSnapshot) => boolean;
  /** Sinkronisasi visual global setelah restorasi sel selesai */
  finalizeCellVisuals?: () => void;
}

export interface RestoreCellPipelineOptions {
  indicators?: SavedWorkspaceIndicator[];
  fallbackPaneWeights?: number[];
}

/**
 * Pipeline restorasi 5-langkah ADR-0023 terpadu (Single Source of Truth) untuk satu sel maupun single-chart:
 * 1. Market, timeframe & sesi
 * 2. Renderer config tersanitasi, priceStyle, & priceScaleCountdown
 * 3. Studi Pine & Native (+ Native Volume Overlay)
 * 4. Pane Signature layout matching (diterapkan hanya setelah seluruh studi selesai mount)
 * 5. Skala harga, barSpacing, & viewport logical range
 */
export async function restoreCellThroughPipeline(
  cellSnap: CellSnapshot,
  target: CellRestorationTarget,
  options?: RestoreCellPipelineOptions
): Promise<void> {
  // Langkah 1: Market, timeframe & sesi
  target.applyMarketIdentity?.(cellSnap);

  // Langkah 2: Renderer config tersanitasi, priceStyle & priceScaleCountdown
  if (cellSnap.rendererConfig && typeof cellSnap.rendererConfig === 'object') {
    const sanitizedConfig = sanitizeRendererConfigForApply(cellSnap.rendererConfig);
    if (sanitizedConfig && typeof target.applyRendererConfig === 'function') {
      target.applyRendererConfig(sanitizedConfig);
    }
  }
  if (cellSnap.priceStyle && typeof target.setPriceStyle === 'function') {
    target.setPriceStyle(cellSnap.priceStyle);
  }
  if (typeof cellSnap.priceScaleCountdown === 'boolean' && typeof target.setPriceScaleCountdown === 'function') {
    target.setPriceScaleCountdown(cellSnap.priceScaleCountdown);
  }

  // Langkah 3: Studi Pine & Native (+ Native Volume Overlay)
  const targetIndicators = Array.isArray(options?.indicators)
    ? options.indicators
    : Array.isArray(cellSnap.indicators)
      ? cellSnap.indicators
      : undefined;

  if (Array.isArray(targetIndicators) && targetIndicators.length > 0) {
    target.clearNonVolumeIndicators?.();
    for (const ind of targetIndicators) {
      if (ind?.source || ind?.title) {
        try {
          await target.addPineIndicator?.(ind);
        } catch (e) {
          console.warn(`[WorkspaceLifecycle] Gagal memuat indikator ${ind.title}:`, e);
        }
      }
    }
  } else if (Array.isArray(targetIndicators)) {
    target.clearNonVolumeIndicators?.();
  }

  if (Array.isArray(cellSnap.nativeIndicators) && cellSnap.nativeIndicators.length > 0) {
    try {
      await target.applyNativeIndicators?.(cellSnap.nativeIndicators);
    } catch (e) {
      console.warn('[WorkspaceLifecycle] Gagal memulihkan nativeIndicators:', e);
    }
  }

  target.onSyncIndicators?.();

  // Langkah 4: Pane Signature layout matching (hanya setelah semua studi Pine & Native selesai mount)
  if (Array.isArray(cellSnap.paneLayout) && cellSnap.paneLayout.length > 0 && typeof target.applyPaneLayout === 'function') {
    await target.applyPaneLayout(cellSnap.paneLayout, { timeoutMs: 3000 });
  } else if (
    Array.isArray(options?.fallbackPaneWeights) &&
    options.fallbackPaneWeights.length > 0 &&
    typeof target.applyPaneWeights === 'function'
  ) {
    target.applyPaneWeights(options.fallbackPaneWeights);
  }

  // Langkah 5: Skala harga, zoom spacing, & viewport logical range
  const applyViewportAndScales = () => {
    if (cellSnap.priceScaleState && typeof target.applyPriceScaleState === 'function') {
      target.applyPriceScaleState(cellSnap.priceScaleState);
    }
    if (typeof cellSnap.barSpacing === 'number' && cellSnap.barSpacing > 0 && typeof target.setBarSpacing === 'function') {
      target.setBarSpacing(cellSnap.barSpacing);
    }
    if (cellSnap.visibleRange && typeof target.applyVisibleRange === 'function') {
      target.applyVisibleRange(cellSnap.visibleRange);
    }
  };

  if (typeof target.withSuppressedPersistEvents === 'function') {
    target.withSuppressedPersistEvents(applyViewportAndScales);
  } else {
    applyViewportAndScales();
  }

  target.finalizeCellVisuals?.();
}

/**
 * Memetakan dokumen SavedWorkspace v2 yang sudah dinormalkan menjadi WorkspaceChartSnapshot deklaratif.
 */
export function toWorkspaceChartSnapshot(workspace: SavedWorkspace): WorkspaceChartSnapshot {
  const w = normalizeWorkspace(workspace);
  const rawRootConfig = (w as SavedWorkspace & { rendererConfig?: Record<string, unknown> }).rendererConfig;
  const sanitizedRootConfig =
    rawRootConfig && typeof rawRootConfig === 'object'
      ? sanitizeRendererConfigForApply(rawRootConfig)
      : undefined;

  const sanitizedCells = Array.isArray(w.cells)
    ? w.cells.map((cell) => {
        if (!cell.rendererConfig || typeof cell.rendererConfig !== 'object') {
          return cell;
        }
        const sanitizedCellConfig = sanitizeRendererConfigForApply(cell.rendererConfig);
        return {
          ...cell,
          ...(sanitizedCellConfig ? { rendererConfig: sanitizedCellConfig } : { rendererConfig: undefined }),
        };
      })
    : undefined;

  return {
    symbol: w.symbol,
    timeframe: String(w.timeframe),
    layout: w.layout,
    providerId: w.providerId,
    showVolume: w.showVolume,
    syncConfig: w.syncConfig,
    indicators: Array.isArray(w.indicators) ? w.indicators : [],
    ...(w.paneWeights ? { paneWeights: w.paneWeights } : {}),
    ...(w.paneLayout ? { paneLayout: w.paneLayout } : {}),
    ...(w.nativeIndicators ? { nativeIndicators: w.nativeIndicators } : {}),
    ...(w.priceScaleState !== undefined ? { priceScaleState: w.priceScaleState } : {}),
    ...(w.priceStyle ? { priceStyle: w.priceStyle } : {}),
    ...(typeof w.priceScaleCountdown === 'boolean' ? { priceScaleCountdown: w.priceScaleCountdown } : {}),
    ...(typeof w.barSpacing === 'number' ? { barSpacing: w.barSpacing } : {}),
    ...(w.visibleRange !== undefined ? { visibleRange: w.visibleRange } : {}),
    ...(sanitizedRootConfig ? { rendererConfig: sanitizedRootConfig } : {}),
    ...(sanitizedCells && sanitizedCells.length > 0 ? { cells: sanitizedCells } : {}),
    ...(w.trackSizes ? { trackSizes: w.trackSizes } : {}),
    ...(w.activeCellIndex !== undefined ? { activeCellIndex: w.activeCellIndex } : {}),
  };
}

/**
 * Helper inti bersama untuk memulihkan visual sel, indikator Pine/native, tata letak pane,
 * skala harga, rentang historis, serta rencana perdagangan & toolbar gambar (Single Source of Truth).
 */
export async function restoreWorkspaceChartAndPlans(
  options: RestoreWorkspaceChartAndPlansOptions
): Promise<void> {
  const {
    workspace: rawWorkspace,
    chart,
    plan,
    onSyncIndicators,
    restoreCellDrawings = true,
    resetPlansWhenEmpty = true,
    preserveViewport = false,
    cleanSlate = true,
  } = options;

  // Migrasikan snapshot v1 warisan secara transparan ke skema v2 sebelum diproses pipeline
  const w = normalizeWorkspace(rawWorkspace);
  const chartSnapshot = toWorkspaceChartSnapshot(w);

  await chart.applyWorkspaceSnapshot(chartSnapshot, {
    preserveViewport,
    onSyncIndicators,
    cleanSlate,
  });

  let hasRestoredCellDrawings = false;
  let hasAuthoritativePlanMeta = false;
  if (restoreCellDrawings && typeof plan?.restoreAllCellDrawings === 'function') {
    const cellRestoreResult = await plan.restoreAllCellDrawings(w.id);
    hasRestoredCellDrawings = true;
    hasAuthoritativePlanMeta = cellRestoreResult?.hasAuthoritativePlanMeta === true;
  }

  if (hasAuthoritativePlanMeta) {
    // Dokumen gambar (_trawangan_meta) adalah otoritas utama kanvas sehingga snapshot w.activePlans basi
    // tidak boleh membangkitkan ulang plan yang sudah dihapus pengguna.
    plan?.setThesisCardsVisible?.(w.showThesisCards ?? true);
  } else if (Array.isArray(w.activePlans) && w.activePlans.length > 0) {
    plan?.restorePlans?.(w.activePlans, w.showThesisCards ?? true);
  } else if (resetPlansWhenEmpty) {
    const existingPlanCount = (plan?.getAllActivePlans?.() ?? plan?.getActivePlans?.() ?? []).length;
    if (!hasRestoredCellDrawings || existingPlanCount === 0) {
      if (typeof plan?.resetInMemoryPlanState === 'function') {
        plan.resetInMemoryPlanState();
      } else if (!hasRestoredCellDrawings) {
        plan?.clearAllPlans?.();
      }
    }
  }

  if (w.thesisCardGeometry || resetPlansWhenEmpty) {
    plan?.restoreThesisCardGeometries?.(w.thesisCardGeometry || {});
  }
  if (w.drawingToolbar) {
    if (w.drawingToolbar.snapMode && typeof plan?.setSnapMode === 'function') {
      plan.setSnapMode(w.drawingToolbar.snapMode);
    }
    if (typeof w.drawingToolbar.stayMode === 'boolean' && typeof plan?.setStayMode === 'function') {
      plan.setStayMode(w.drawingToolbar.stayMode);
    }
  }
}

/**
 * Menjalankan pipeline pemuatan workspace terpadu secara atomik dan deterministik.
 */
export async function executeWorkspaceLoadPipeline(
  options: WorkspaceLoadPipelineOptions
): Promise<WorkspaceLoadResult> {
  const {
    workspace: w,
    chart,
    plan,
    shell,
    activeProviderId,
    onProviderChange,
    onSymbolChange,
    onTimeframeChange,
    onLayoutChange,
    onSyncConfigChange,
    onShowVolumeChange,
    onSyncIndicators,
    onLog,
  } = options;

  try {
    // 1. Inisialisasi identitas workspace pada modul gambar & flush
    if (w.id) {
      plan.setWorkspaceId(w.id);
    }
    if (typeof plan.flushDrawings === 'function') {
      try { await plan.flushDrawings(); } catch (_) {}
    }

    // 2. Terapkan konfigurasi provider, simbol, timeframe, dan layout
    if (w.providerId && w.providerId !== activeProviderId) {
      await onProviderChange(w.providerId);
    }
    await onSymbolChange(w.symbol);
    onTimeframeChange(w.timeframe);
    onLayoutChange(w.layout);

    if (w.syncConfig && typeof onSyncConfigChange === 'function') {
      onSyncConfigChange(w.syncConfig);
    }

    if (shell && w.activeRightDockPanel !== undefined) {
      if (w.activeRightDockPanel === null) {
        shell.closeRightDock();
      } else {
        shell.openRightDockTab(w.activeRightDockPanel);
      }
    }

    if (w.showVolume !== undefined && typeof onShowVolumeChange === 'function') {
      onShowVolumeChange(w.showVolume);
    }

    // Barrier jeda singkat agar render grid layout & WebGL stabil
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 3. Pulihkan konten grafik per sel, indikator, tata letak pane, viewport, plans, dan toolbar secara terpusat
    await restoreWorkspaceChartAndPlans({
      workspace: w,
      chart,
      plan,
      onSyncIndicators,
      restoreCellDrawings: true,
      resetPlansWhenEmpty: true,
      cleanSlate: true,
    });

    // 4. Hitung fingerprint komprehensif melalui Single Source of Truth `buildWorkspaceSnapshotPayload`
    const step9PlanPort: Partial<WorkspacePlanPort> = {
      getActivePlans: () => plan.getActivePlans(),
      ...(typeof plan.getAllActivePlans === 'function'
        ? { getAllActivePlans: () => plan.getAllActivePlans!() }
        : {}),
      isThesisCardsVisible: () => plan.isThesisCardsVisible(),
      getThesisCardGeometries: () =>
        typeof plan.getThesisCardGeometries === 'function'
          ? plan.getThesisCardGeometries()
          : (w.thesisCardGeometry || {}),
      getSnapshot: () =>
        typeof plan.getSnapshot === 'function'
          ? plan.getSnapshot()
          : (w.drawingToolbar
              ? {
                  snapMode: w.drawingToolbar.snapMode,
                  stayMode: w.drawingToolbar.stayMode,
                }
              : undefined),
    };

    const step9Snapshot = buildWorkspaceSnapshotPayload({
      id: w.id || w.name,
      name: w.name,
      symbol: w.symbol,
      timeframe: w.timeframe,
      layout: w.layout,
      providerId: w.providerId || activeProviderId,
      showVolume: w.showVolume,
      syncConfig: w.syncConfig,
      chart,
      plan: step9PlanPort,
      activeRightDockPanel: w.activeRightDockPanel,
    });
    const fingerprint = computeWorkspaceFingerprint(step9Snapshot);

    const indCount = w.indicators?.length || 0;
    const indTitles = w.indicators && w.indicators.length > 0
      ? w.indicators.map((i: any) => i.title).join(', ')
      : 'tanpa indikator';

    if (onLog) {
      onLog(`Workspace "${w.name}" dimuat (${indCount} indikator: ${indTitles})`, 'success');
    }

    return {
      success: true,
      fingerprint,
      indicatorCount: indCount,
      indicatorTitles: indTitles,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn('[WorkspaceLifecycle] Gagal memuat workspace:', error);
    if (onLog) {
      onLog(`Gagal memuat workspace: ${error.message}`, 'warn');
    }
    return {
      success: false,
      fingerprint: '',
      indicatorCount: 0,
      indicatorTitles: '',
      error,
    };
  }
}

export interface AutoSaveCoordinatorOptions {
  debounceMs?: number;
  onSave: (input: Partial<SavedWorkspace>) => Promise<SavedWorkspace | void>;
  onError?: (err: any) => void;
}

/**
 * Koordinator auto-save workspace yang aman, tahan debouncing, dan berbasis dirty-checking komprehensif.
 */
export class WorkspaceAutoSaveCoordinator {
  private timer: any = null;
  private isSaving = false;
  private lastSavedFingerprint = '';
  private pendingInput: Partial<SavedWorkspace> | null = null;
  private pendingBuilder: (() => Partial<SavedWorkspace> | null) | null = null;
  private activeSavePromise: Promise<SavedWorkspace | void> | null = null;
  private debounceMs: number;
  private onSave: (input: Partial<SavedWorkspace>) => Promise<SavedWorkspace | void>;
  private onError?: (err: any) => void;

  constructor(options: AutoSaveCoordinatorOptions) {
    this.debounceMs = options.debounceMs ?? 1500;
    this.onSave = options.onSave;
    this.onError = options.onError;
  }

  public getSavedFingerprint(): string {
    return this.lastSavedFingerprint;
  }

  public setSavedFingerprint(fp: string): void {
    this.lastSavedFingerprint = fp;
  }

  public cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingInput = null;
    this.pendingBuilder = null;
  }

  public isPending(): boolean {
    return this.timer !== null || this.isSaving;
  }

  /**
   * Memicu auto-save ter-debounce tanpa membangun payload berat & fingerprint di hot path.
   * Builder hanya dipanggil satu kali saat timer debounce jatuh tempo di `flushNow()`.
   */
  public triggerDeferred(builder: () => Partial<SavedWorkspace> | null): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingInput = null;
    this.pendingBuilder = builder;

    this.timer = setTimeout(() => {
      void this.flushNow();
    }, this.debounceMs);
  }

  /**
   * Memicu auto-save ter-debounce jika fingerprint input berbeda dengan fingerprint yang sudah tersimpan.
   */
  public trigger(input: Partial<SavedWorkspace>): string | null {
    const currentFingerprint = computeWorkspaceFingerprint(input);

    // KUNCI GUARD: Jika fingerprint nilai sama persis dengan yang sudah tersimpan, abaikan & bersihkan timer lama!
    if (this.lastSavedFingerprint && this.lastSavedFingerprint === currentFingerprint) {
      this.cancel();
      return null;
    }

    this.cancel();
    this.pendingInput = input;

    this.timer = setTimeout(() => {
      void this.flushNow();
    }, this.debounceMs);

    return currentFingerprint;
  }

  /**
   * Memaksa penulisan workspace tertunda secara langsung tanpa menunggu debounce (mis. saat exit atau Save manual).
   */
  public async flushNow(overrideInput?: Partial<SavedWorkspace>): Promise<boolean> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const deferredInput = this.pendingInput;
    const deferredBuilder = this.pendingBuilder;
    this.pendingInput = null;
    this.pendingBuilder = null;

    if (this.activeSavePromise) {
      try {
        await this.activeSavePromise;
      } catch (_) {}
    }

    let input = overrideInput ?? deferredInput;
    if (!input && deferredBuilder) {
      try {
        input = deferredBuilder();
      } catch (err) {
        console.warn('[WorkspaceAutoSaveCoordinator] Gagal membangun payload tertunda:', err);
        input = null;
      }
    }

    if (!input) {
      return false;
    }

    const currentFingerprint = computeWorkspaceFingerprint(input);
    if (this.lastSavedFingerprint && this.lastSavedFingerprint === currentFingerprint) {
      return false;
    }

    this.isSaving = true;
    const savePromise = this.onSave(input);
    this.activeSavePromise = savePromise;

    try {
      await savePromise;
      this.lastSavedFingerprint = currentFingerprint;
      return true;
    } catch (err) {
      if (this.onError) {
        this.onError(err);
      } else {
        console.warn('[WorkspaceAutoSaveCoordinator] Gagal menyimpan workspace:', err);
      }
      return false;
    } finally {
      this.isSaving = false;
      if (this.activeSavePromise === savePromise) {
        this.activeSavePromise = null;
      }
    }
  }
}

export interface BuildWorkspaceSnapshotOptions {
  id?: string;
  name: string;
  symbol: string;
  timeframe: Timeframe | string;
  layout: string;
  providerId?: string;
  showVolume?: boolean;
  syncConfig?: MultiChartSyncConfig;
  chart?: Partial<WorkspaceChartPort> | null;
  plan?: Partial<WorkspacePlanPort> | null;
  fallbackIndicators?: ActiveIndicatorInfo[];
  activeRightDockPanel?: string | null;
  timestamp?: number;
}

export type WorkspaceSnapshotPayload = Omit<SavedWorkspace, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: number;
};

/**
 * Membangun payload snapshot workspace terpadu v2 untuk auto-save maupun Save Workspace manual (Single Source of Truth).
 */
export function buildWorkspaceSnapshotPayload(
  options: BuildWorkspaceSnapshotOptions
): WorkspaceSnapshotPayload {
  const {
    id,
    name,
    symbol,
    timeframe,
    layout,
    providerId,
    showVolume,
    syncConfig,
    chart,
    plan,
    fallbackIndicators,
    activeRightDockPanel,
    timestamp,
  } = options;

  const chartSnap = typeof chart?.captureWorkspaceSnapshot === 'function' ? chart.captureWorkspaceSnapshot() : undefined;

  const rawIndicators = chartSnap?.indicators ?? fallbackIndicators ?? [];
  const indicators: SavedWorkspaceIndicator[] = Array.isArray(rawIndicators)
    ? rawIndicators.map((i: any) => ({
        title: i.title || 'Indicator',
        source: i.source || '',
        visible: i.visible !== false,
        inputs: i.inputs,
        props: i.props,
      }))
    : [];

  const activePlans =
    typeof plan?.getAllActivePlans === 'function'
      ? plan.getAllActivePlans()
      : typeof plan?.getActivePlans === 'function'
        ? plan.getActivePlans()
        : [];

  const cells = chartSnap?.cells;
  const trackSizes = chartSnap?.trackSizes;
  const activeCellIndex = chartSnap?.activeCellIndex;
  const visibleRange = chartSnap?.visibleRange;
  const rawThesisGeoms = typeof plan?.getThesisCardGeometries === 'function' ? plan.getThesisCardGeometries() : undefined;
  const thesisCardGeometry =
    rawThesisGeoms && Object.keys(rawThesisGeoms).length > 0 ? rawThesisGeoms : undefined;
  const planSnap = typeof plan?.getSnapshot === 'function' ? plan.getSnapshot() : undefined;
  const drawingToolbar = planSnap
    ? {
        snapMode: planSnap.snapMode ?? 'off',
        stayMode: Boolean(planSnap.stayMode),
      }
    : undefined;

  return {
    ...(id ? { id } : {}),
    name,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    symbol,
    timeframe: String(timeframe),
    layout,
    providerId,
    indicators,
    paneWeights: chartSnap?.paneWeights ?? [],
    paneLayout: chartSnap?.paneLayout ?? [],
    nativeIndicators: chartSnap?.nativeIndicators ?? [],
    priceScaleState: chartSnap?.priceScaleState ?? null,
    priceStyle: chartSnap?.priceStyle ?? 'candles',
    priceScaleCountdown: chartSnap?.priceScaleCountdown ?? false,
    barSpacing: chartSnap?.barSpacing ?? 8,
    ...(visibleRange !== undefined && visibleRange !== null ? { visibleRange } : {}),
    showVolume: showVolume ?? true,
    ...(activeRightDockPanel !== undefined ? { activeRightDockPanel } : {}),
    syncConfig: syncConfig ? { ...syncConfig } : undefined,
    ...(cells && cells.length > 0 ? { cells } : {}),
    ...(trackSizes ? { trackSizes } : {}),
    ...(activeCellIndex !== undefined && ((cells && cells.length > 1) || activeCellIndex > 0) ? { activeCellIndex } : {}),
    activePlans,
    showThesisCards: typeof plan?.isThesisCardsVisible === 'function' ? plan.isThesisCardsVisible() : true,
    ...(thesisCardGeometry ? { thesisCardGeometry } : {}),
    ...(drawingToolbar ? { drawingToolbar } : {}),
    ...(timestamp !== undefined ? { timestamp } : {}),
  };
}

function resolveDefaultPendingStorage(storage?: PendingStorageAdapter | null): PendingStorageAdapter | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Menulis salinan backup sinkron ke localStorage sebelum jendela/app tertutup untuk mencegah race IPC asinkron.
 */
export function writePendingWorkspaceBackup(
  snapshot: Partial<SavedWorkspace> & { id?: string; timestamp?: number },
  storage?: PendingStorageAdapter | null
): boolean {
  if (!snapshot?.id) return false;
  const store = resolveDefaultPendingStorage(storage);
  if (!store) return false;

  try {
    const payload = {
      ...snapshot,
      schemaVersion: snapshot.schemaVersion ?? WORKSPACE_SCHEMA_VERSION,
      timestamp: snapshot.timestamp ?? Date.now(),
    };
    store.setItem(`${PENDING_WORKSPACE_KEY_PREFIX}${snapshot.id}`, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('[WorkspaceLifecycle] Gagal menulis pending workspace backup:', err);
    return false;
  }
}

/**
 * Menghapus kunci pending backup dari localStorage jika sudah tersimpan permanen atau dipulihkan.
 */
export function clearPendingWorkspaceBackup(
  workspaceId?: string | null,
  storage?: PendingStorageAdapter | null
): void {
  if (!workspaceId) return;
  const store = resolveDefaultPendingStorage(storage);
  if (!store) return;

  try {
    store.removeItem(`${PENDING_WORKSPACE_KEY_PREFIX}${workspaceId}`);
  } catch (_) {}
}

/**
 * Memeriksa backup pending di localStorage saat startup dan menggunakannya bila timestamp lebih baru dari SQLite.
 * Selalu membersihkan kunci pending setelah evaluasi agar tidak terjadi stale override berulang.
 */
export function resolvePendingWorkspaceOverride(
  workspace: SavedWorkspace,
  workspaceId?: string | null,
  storage?: PendingStorageAdapter | null
): { workspace: SavedWorkspace; usedPending: boolean } {
  const targetId = workspaceId || workspace?.id;
  if (!targetId) {
    return { workspace, usedPending: false };
  }

  const store = resolveDefaultPendingStorage(storage);
  if (!store) {
    return { workspace, usedPending: false };
  }

  const key = `${PENDING_WORKSPACE_KEY_PREFIX}${targetId}`;
  let raw: string | null = null;
  try {
    raw = store.getItem(key);
  } catch (_) {
    return { workspace, usedPending: false };
  }

  if (!raw) {
    return { workspace, usedPending: false };
  }

  // Bersihkan kunci setelah dibaca baik dipakai maupun usang
  clearPendingWorkspaceBackup(targetId, store);

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { workspace, usedPending: false };
    }
    const pendingTs = Number(parsed.timestamp || 0);
    const sqliteTs = Number(workspace?.timestamp || 0);
    if (pendingTs > sqliteTs) {
      const normalized = normalizeWorkspace(parsed);
      return {
        workspace: {
          ...normalized,
          id: normalized.id || targetId,
          timestamp: pendingTs,
        },
        usedPending: true,
      };
    }
  } catch (err) {
    console.warn('[WorkspaceLifecycle] Gagal mem-parse pending workspace backup:', err);
  }

  return { workspace, usedPending: false };
}

export interface ExecuteExitFlushOptions {
  flushDrawings?: () => Promise<void> | void;
  buildSnapshot?: () => (WorkspaceSnapshotPayload & { id?: string; timestamp?: number }) | null;
  coordinator?: WorkspaceAutoSaveCoordinator | null;
  storage?: PendingStorageAdapter | null;
  skipPendingBackup?: boolean;
}

/**
 * Menjalankan flush darurat saat keluar aplikasi: menulis backup sinkron localStorage terlebih dahulu,
 * lalu mem-flush drawing dan menguras timer koordinator auto-save.
 */
export async function executeExitFlush(
  options: ExecuteExitFlushOptions
): Promise<{ pendingWritten: boolean; flushed: boolean }> {
  const { flushDrawings, buildSnapshot, coordinator, storage, skipPendingBackup } = options;

  let snapshot: (WorkspaceSnapshotPayload & { id?: string; timestamp?: number }) | null = null;
  try {
    snapshot = buildSnapshot ? buildSnapshot() : null;
  } catch (_) {}

  // Langkah 1 (SINKRON SEBELUM AWAIT): Amankan pending backup ke localStorage agar beforeunload tidak kehilangan data
  let pendingWritten = false;
  if (snapshot?.id && !skipPendingBackup) {
    const snapWithTs = {
      ...snapshot,
      timestamp: snapshot.timestamp ?? Date.now(),
    };
    snapshot = snapWithTs;
    pendingWritten = writePendingWorkspaceBackup(snapWithTs, storage);
  }

  // Langkah 2: Flush drawings yang masih tertunda di debounce
  if (typeof flushDrawings === 'function') {
    try {
      await flushDrawings();
    } catch (_) {}
  }

  // Langkah 3: Flush auto-save SQLite segera via koordinator
  let flushed = false;
  if (coordinator) {
    try {
      flushed = await coordinator.flushNow(snapshot ?? undefined);
    } catch (_) {}
  }

  return { pendingWritten, flushed };
}

export interface CloseRequestedEventLike {
  preventDefault(): void;
}

export interface WindowCloseHandleLike {
  destroy?: () => Promise<void>;
  close?: () => Promise<void>;
}

export interface HandleWindowCloseRequestOptions {
  event: CloseRequestedEventLike;
  appWindow: WindowCloseHandleLike;
  flush: () => Promise<unknown>;
  timeoutMs?: number;
  state: { isClosing: boolean };
  onBeforeFlush?: () => void;
}

/**
 * Mengoordinasikan event `closeRequested` Tauri secara deterministik:
 * menahan penutupan jendela dengan `event.preventDefault()` secara sinkron,
 * menjalankan flush (dibatasi timeout agar app tak macet), lalu menutup paksa via `destroy()`.
 */
export async function handleWindowCloseRequest(
  options: HandleWindowCloseRequestOptions
): Promise<void> {
  const { event, appWindow, flush, timeoutMs = 1500, state, onBeforeFlush } = options;

  // Langkah sinkron pertama sebelum await agar WebView/Tauri tidak menutup sebelum flush selesai
  event.preventDefault();

  if (state.isClosing) {
    return;
  }
  state.isClosing = true;
  onBeforeFlush?.();

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      Promise.resolve().then(() => flush()),
      new Promise<void>((resolve) => {
        timeoutHandle = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } catch (_) {
    // Tetap lanjutkan penutupan jendela meski flush gagal atau timeout
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
    if (typeof appWindow.destroy === 'function') {
      await appWindow.destroy().catch(() => {});
    } else if (typeof appWindow.close === 'function') {
      await appWindow.close().catch(() => {});
    }
  }
}
