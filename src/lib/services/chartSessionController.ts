// Deep ChartSessionController Module
// Mengenkapsulasi orkestrasi sesi grafik, siklus hidup WebGL2 Vela Workspace,
// routing simbol multi-provider, sinkronisasi tema/timezone, manajemen indikator,
// persistent price line guard, dan pembersihan memori.

import { VelaWorkspace } from '@luxalgo/vela/workspace';
import { BinanceProvider } from '@luxalgo/vela/providers/binance';
import { HyperliquidProvider } from '@luxalgo/vela/providers/hyperliquid';
import { CoinbaseProvider } from '@luxalgo/vela/providers/coinbase';
import { BitunixProvider } from './bitunixProvider';
import { IndodaxProvider } from './indodaxProvider';
import { YahooFinanceProvider } from './yahooFinanceProvider';
import { MacroIndexProvider } from './macroIndexProvider';
import { CustomFeedProvider } from './customProvider';
import { isMacroIndexSymbol } from './macroIndexCatalog';
import { resolveMacroAxisMode, syncCellMacroVelaAxis } from './macroVelaAxisAdapter';
import { marketFeed } from './market';
import {
  StreamGuardCoordinator,
  wrapProviderWithStreamGuard,
  type StreamHealthSink,
} from './streamHealthGuard';
import { registerDefaultEngine, getNativeIndicator, SecondClock, type WallClock } from '@luxalgo/vela';

// Singleton central terminal WallClock agar seluruh cell multi-chart berdetak sinkron pada batas detik
let sharedTerminalWallClock: WallClock | null = null;
function getSharedTerminalWallClock(): WallClock {
  if (!sharedTerminalWallClock) {
    sharedTerminalWallClock = new SecondClock();
  }
  return sharedTerminalWallClock;
}
import {
  PineRuntimeCoordinator,
  pineRuntimeCoordinator,
  PineStrategyTelemetryService,
  PineAlertBridge,
  type FetchSeriesHandler,
  type StrategyTelemetryPayload,
  type TradeExecution,
} from './pineRuntimeCoordinator';
import { IndicatorRegistry } from './indicatorRegistry';
import { ChartStudyManager } from './chartStudyManager';
import { normalizeVpvrInputs } from './vpvrProfile';
import { chartDrawingController } from './chartDrawingController';
import {
  TimelineMarksController,
  timelineMarksController
} from './timelineMarksController';
import { pineAlertBridge } from './pineAlertBridge';
import {
  type Timeframe,
  type MultiChartSyncConfig,
  type ThemePresetId,
  type ActiveIndicatorInfo,
  type SavedWorkspace,
  type CustomChartBackgroundConfig,
  type CustomThemePalette,
  type GridMode,
  type ProviderConfig,
  type PaneLayoutEntry,
  type NativeIndicatorSnapshot,
  type CellSnapshot,
  type SavedWorkspaceIndicator,
  type VisibleRangeSnapshot,
  type WorkspaceTrackSizes,
  type PriceStyle,
  isValidPriceStyle,
  VALID_PRICE_STYLES,
} from '../types/market';
import { WORKSPACE_SCHEMA_VERSION, computePaneSignature } from './persistence/workspaceSchema';
import {
  buildWorkspaceSnapshotPayload,
  restoreCellThroughPipeline,
  restoreWorkspaceChartAndPlans,
} from './workspaceLifecycle';
import { THEME_PRESETS, resolveEffectiveVolumeColors, resolveEffectiveThemeColors, resolveThemeConfig } from '../constants/themes';
import { isVolumeIndicator } from '../data/indicatorPresets';
import type { UnifiedIndicatorDescriptor } from './indicatorCatalogService';
import { toVelaTimeframe, fromVelaTimeframe } from '../utils/timeframeAdapter';
import { applyLayoutTimeframePolicy } from '../constants/defaults';
import { storage } from './persistence';
import type { IPersistenceService } from './persistence/types';
import {
  cloneRendererConfigValue,
  sanitizeRendererConfigForApply,
  sanitizeRendererConfigForPersistence,
  type ActiveThemeCandleColors,
} from './persistence/rendererConfigSanitizer';
import { deriveBorderColor, generateVelaThemeTokens, isDarkColor, withAlpha } from '../utils/colorUtils';
import {
  marketSessionService,
  type MarketSession,
  isSessionSupported,
  SESSION_PRE,
  SESSION_POST,
} from './marketSessionService';
import {
  type VisibleRangePreset,
  type RangePresetConfig,
  VISIBLE_RANGE_PRESETS,
  isValidRangePreset,
  getRangePresetConfig,
  calculateRangePresetSpan,
  getNextRangePreset,
} from './rangePresetService';
export type { VisibleRangePreset, RangePresetConfig };
export type RangePresetId = VisibleRangePreset;
export {
  VISIBLE_RANGE_PRESETS,
  VISIBLE_RANGE_PRESETS as RANGE_PRESETS,
  isValidRangePreset,
  getRangePresetConfig,
  calculateRangePresetSpan,
  getNextRangePreset,
};

export interface ChartSessionOptions {
  symbol: string;
  timeframe: Timeframe;
  defaultTimeframe?: Timeframe;
  layout?: string;
  providerId?: string;
  themePreset?: ThemePresetId | string;
  fontSize?: number;
  timezone?: string;
  session?: MarketSession;
  customPalette?: CustomThemePalette;
  customBullColor?: string;
  customBearColor?: string;
  customChartBackground?: CustomChartBackgroundConfig;
  showCurrentPriceLine?: boolean;
  priceScaleCountdown?: boolean;
  showPriceScaleCountdown?: boolean;
  wallClock?: any;
  showVolume?: boolean;
  gridMode?: GridMode;
  syncConfig?: MultiChartSyncConfig;
  onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe; providerId?: string }) => void;
  onPriceStyleChange?: (style: PriceStyle | string) => void;
  onRangePresetChange?: (preset: VisibleRangePreset | null) => void;
  onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
  onStrategyTelemetry?: (payload: StrategyTelemetryPayload) => void;
  pineRuntimeCoordinator?: PineRuntimeCoordinator;
  strategyTelemetry?: PineStrategyTelemetryService;
  pineAlertBridge?: PineAlertBridge;
  onVelaThemeSelect?: (mode: 'dark' | 'light') => void;
  onPersistableStateChange?: (reason: string) => void;
  viewportPersistDebounceMs?: number;
  // Factory & Stream Guard opsional untuk dependency injection / headless unit testing
  workspaceFactory?: (container: HTMLElement, config: any) => any;
  feedHealthSink?: StreamHealthSink;
  persistence?: IPersistenceService;
  providerFactories?: Partial<Record<string, () => any>>;
  streamWatchdogMs?: number;
  streamStaleMs?: number;
}

export interface ChartSessionSnapshot {
  isAttached: boolean;
  symbol: string;
  timeframe: Timeframe;
  providerId: string;
  layout: string;
  timezone: string;
  themePreset: ThemePresetId | string;
  fontSize: number;
  session?: MarketSession;
  sessionAvailable?: boolean;
  customPalette?: CustomThemePalette;
  customBullColor?: string;
  customBearColor?: string;
  showCurrentPriceLine: boolean;
  priceScaleCountdown: boolean;
  showVolume: boolean;
  gridMode: GridMode;
  priceStyle: PriceStyle | string;
  activeCell: { symbol: string; timeframe: Timeframe } | null;
  activeIndicators: ActiveIndicatorInfo[];
  syncConfig: MultiChartSyncConfig;
  activeRangePreset: VisibleRangePreset | null;
}

type SessionSubscriber = (snapshot: ChartSessionSnapshot) => void;

let staticEngineRegistered = false;

/**
 * Daftarkan worker engine PineTS satu kali secara global dengan adapter fetchSeries
 */
export function ensurePineEngine(): void {
  if (!staticEngineRegistered) {
    try {
      registerDefaultEngine('pine', () => pineRuntimeCoordinator.createWorkerEngine());
      staticEngineRegistered = true;
    } catch (_) {
      // Abaikan jika sudah terdaftar
    }
  }
}

import {
  resolveVelaSymbol,
  resolveVelaSymbolKey,
  getCellMarketIdentity,
  isSameInstrument,
  normalizeSymbolForMatching,
  toVelaProviderId,
} from './instrumentIdentity';
export {
  resolveVelaSymbol,
  resolveVelaSymbolKey,
  getCellMarketIdentity,
};

/**
 * Helper untuk mendapatkan instans Coords dari Vela Chart Renderer
 */
function getChartCoords(chart: any): any {
  if (!chart) return null;
  return chart.renderer?.renderer?.coords || chart.renderer?.coords || chart.coords || null;
}

/**
 * Helper untuk mengekstrak instans renderer native dari sebuah cell Vela
 */
function resolveNativeRenderer(cell: any): any {
  const chart = cell?.chart || cell?.inner;
  const renderer = chart?.renderer;
  return renderer?.renderer || renderer || null;
}

/**
 * Membuat konfigurasi warna shading sesi WebGL2 Vela.
 * Catatan: SessionShadeStyle pada @luxalgo/vela hanya mendukung premarketColor,
 * postmarketColor, dan extendedColor (tidak mendukung properti offColor/closedColor).
 */
function buildSessionShadeConfig() {
  return {
    premarketColor: withAlpha(SESSION_PRE, 0.08),
    postmarketColor: withAlpha(SESSION_POST, 0.08),
    extendedColor: withAlpha(SESSION_POST, 0.08),
  };
}

/**
 * Validasi batas kesetaraan bursa untuk sinkronisasi drawing antar cell
 * Wajib berbagi simbol yang sama DAN bursa (providerId) yang sama persis
 */
export function isDrawingSyncEligible(sourceCell: any, targetCell: any): boolean {
  if (!sourceCell || !targetCell) return false;
  if (sourceCell === targetCell) return true;

  const src = getCellMarketIdentity(sourceCell);
  const tgt = getCellMarketIdentity(targetCell);

  if (!src.symbol || !tgt.symbol) return false;
  return src.providerId === tgt.providerId && src.symbol === tgt.symbol;
}

import { attachPriceScaleInputGuard } from './chartPriceScaleInputGuard';
export { attachPriceScaleInputGuard };

/**
 * Memasang boundary guard pada workspace untuk mencegah kebocoran drawing
 * antar cell yang memiliki bursa (providerId) atau pair berbeda.
 */
export function attachDrawingSyncBoundaryGuard(workspace: any): void {
  if (!workspace || workspace.__drawingSyncBoundaryAttached) return;

  const originalPropagateDrawing = typeof workspace.propagateDrawing === 'function'
    ? workspace.propagateDrawing.bind(workspace)
    : null;
  const originalPropagateDraft = typeof workspace.propagateDraft === 'function'
    ? workspace.propagateDraft.bind(workspace)
    : null;
  const originalPropagateDrawingEdit = typeof workspace.propagateDrawingEdit === 'function'
    ? workspace.propagateDrawingEdit.bind(workspace)
    : null;
  const originalPropagateDrawingRemoval = typeof workspace.propagateDrawingRemoval === 'function'
    ? workspace.propagateDrawingRemoval.bind(workspace)
    : null;

  function findCell(id: string): any {
    if (workspace.cellsById && typeof workspace.cellsById.get === 'function') {
      const c = workspace.cellsById.get(id);
      if (c) return c;
    }
    const cells = typeof workspace.cells === 'function' ? workspace.cells() : [];
    return cells.find((c: any) => c.id === id) || null;
  }

  function getAllCellIds(): string[] {
    if (workspace.cellsById && typeof workspace.cellsById.keys === 'function') {
      return [...workspace.cellsById.keys()];
    }
    const cells = typeof workspace.cells === 'function' ? workspace.cells() : [];
    return cells.map((c: any) => c.id);
  }

  if (originalPropagateDrawing) {
    workspace.propagateDrawing = function (originId: string, drawingId: string) {
      if (this.drawingSyncBusy || this.destroyed) return;
      const setting = this.syncOpts?.drawings ?? this.sync?.state?.()?.drawings ?? true;
      if (!setting) return;

      const originCell = findCell(originId);
      const doc = originCell?.chart?.drawings?.all?.()?.find((d: any) => d.id === drawingId);
      if (!doc) return;

      this.drawingSyncBusy = true;
      try {
        const group = new Map([[originId, drawingId]]);
        for (const id of getAllCellIds()) {
          if (id === originId) continue;
          const targetCell = findCell(id);
          if (!targetCell) continue;

          // BOUNDARY GUARD: Lewati jika bursa atau simbol tidak sama persis
          if (!isDrawingSyncEligible(originCell, targetCell)) {
            continue;
          }

          const copy = targetCell.chart?.drawings?.add?.(doc.type, {
            paneId: doc.paneId,
            anchors: doc.anchors,
            style: doc.style,
            text: doc.text,
            props: doc.props
          });
          if (copy && copy.id) group.set(id, copy.id);
        }

        if (group.size > 1 && this.drawingLinks) {
          for (const [cellId, dId] of group) {
            this.drawingLinks.set(`${cellId}\0${dId}`, group);
          }
        }
      } finally {
        this.drawingSyncBusy = false;
      }
    };
  }

  if (originalPropagateDraft) {
    workspace.propagateDraft = function (originId: string, doc: any) {
      if (this.destroyed) return;
      const setting = this.syncOpts?.drawings ?? this.sync?.state?.()?.drawings ?? true;
      if (!setting) return;

      const originCell = findCell(originId);
      for (const id of getAllCellIds()) {
        if (id === originId) continue;
        const targetCell = findCell(id);
        if (!targetCell) continue;

        // BOUNDARY GUARD
        if (!isDrawingSyncEligible(originCell, targetCell)) {
          continue;
        }

        targetCell.chart?.drawings?.setExternalGhost?.(doc);
      }
    };
  }

  if (originalPropagateDrawingEdit) {
    workspace.propagateDrawingEdit = function (originId: string, drawingId: string) {
      if (this.drawingSyncBusy || this.destroyed) return;
      const setting = this.syncOpts?.drawings ?? this.sync?.state?.()?.drawings ?? true;
      if (!setting) return;

      const originCell = findCell(originId);
      const group = this.drawingLinks?.get(`${originId}\0${drawingId}`);
      if (!group) return;

      const doc = originCell?.chart?.drawings?.all?.()?.find((d: any) => d.id === drawingId);
      if (!doc) return;

      this.drawingSyncBusy = true;
      try {
        for (const id of getAllCellIds()) {
          if (id === originId) continue;
          const targetCell = findCell(id);
          if (!targetCell) continue;

          // BOUNDARY GUARD
          if (!isDrawingSyncEligible(originCell, targetCell)) {
            continue;
          }

          const peerId = group.get(id);
          if (peerId == null) continue;
          targetCell.chart?.drawings?.update?.(peerId, {
            anchors: doc.anchors,
            style: doc.style,
            text: doc.text,
            props: doc.props
          });
        }
      } finally {
        this.drawingSyncBusy = false;
      }
    };
  }

  if (originalPropagateDrawingRemoval) {
    workspace.propagateDrawingRemoval = function (originId: string, drawingId: string) {
      if (this.destroyed) return;
      const key = `${originId}\0${drawingId}`;
      const group = this.drawingLinks?.get(key);
      if (!group) return;

      this.drawingLinks?.delete(key);
      group.delete(originId);
      if (this.drawingSyncBusy) return;

      const setting = this.syncOpts?.drawings ?? this.sync?.state?.()?.drawings ?? true;
      if (!setting) return;

      const originCell = findCell(originId);
      this.drawingSyncBusy = true;
      try {
        for (const id of getAllCellIds()) {
          if (id === originId) continue;
          const targetCell = findCell(id);
          if (!targetCell) continue;

          // BOUNDARY GUARD
          if (!isDrawingSyncEligible(originCell, targetCell)) {
            continue;
          }

          const peerId = group.get(id);
          if (peerId != null) {
            targetCell.chart?.drawings?.remove?.(peerId);
          }
        }
      } finally {
        this.drawingSyncBusy = false;
      }
    };
  }

  workspace.__drawingSyncBoundaryAttached = true;
}

/**
 * Deep Module: ChartSessionController
 * Mengelola seluruh orkestrasi kanvas WebGL2 dan state sesi grafik
 */
export class ChartSessionController {
  private workspace: any = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private subscribers = new Set<SessionSubscriber>();
  private isAttached = false;
  private indicatorRegistry = new IndicatorRegistry();
  public readonly studyManager: ChartStudyManager = new ChartStudyManager(this.indicatorRegistry, {
    getThemeContext: () => ({
      themePreset: this.themePreset,
      customPalette: this.customPalette,
      customCandleColors: this.customCandleColors,
    }),
    withSuppressedPersistEvents: (fn) => this.withSuppressedPersistEvents(fn),
    scheduleTimeout: (fn, ms) => this.scheduleManagedTimeout(fn, ms),
    onStudyRemoved: (id) => {
      this.pineRuntime.handleIndicatorRemoved(id, this.getAllCells());
    },
    onStudiesChanged: () => this.notifyActiveIndicators(),
    onPersistableChange: (reason) => this.emitPersistableChange(reason),
    onPineStrategyMounted: (cell, handle, cleanTitle) => {
      if (typeof handle?.context === 'function') {
        void handle.context().then((ctx: any) => {
          if (ctx) {
            this.pineRuntime.syncStrategyFromContext(handle.id, ctx, cleanTitle, cell);
          }
        }).catch((err: unknown) => {
          console.warn('[ChartSessionController] Gagal mengambil context strategi Pine:', err);
        });
      }
    },
    enableTradeVisibility: (cell) => this.enableChartTradeVisibility(cell),
  });

  private symbol: string;
  private timeframe: Timeframe;
  private defaultTimeframe: Timeframe;
  private layout: string;
  private providerId: string;
  private themePreset: ThemePresetId | string;
  private fontSize: number;
  private timezone: string;
  private showCurrentPriceLine: boolean;
  private priceScaleCountdown: boolean;
  private wallClock: any = null;
  private priceScaleCountdownByCell = new WeakMap<any, boolean>();
  private showVolume: boolean;
  private syncConfig: MultiChartSyncConfig;
  private onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe; providerId?: string }) => void;
  private onPriceStyleChange?: (style: PriceStyle | string) => void;
  private onRangePresetChange?: (preset: VisibleRangePreset | null) => void;
  private activeRangePreset: VisibleRangePreset | null = null;
  private activeRangePresetSpan: { from: number; to: number } | null = null;
  private isApplyingRangePreset = false;
  private onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
  private onStrategyTelemetryHandler?: (payload: StrategyTelemetryPayload) => void;
  public readonly pineRuntime: PineRuntimeCoordinator;

  public get strategyTelemetry(): PineStrategyTelemetryService {
    return this.pineRuntime.telemetry;
  }

  public get pineAlertBridge(): PineAlertBridge {
    return this.pineRuntime.alertBridge;
  }
  private workspaceFactory?: (container: HTMLElement, config: any) => any;
  private activeCellInfo: { symbol: string; timeframe: Timeframe } | null = null;
  private activeChartDefaultConfig: any = null;
  private userChartDefaultConfig: any = null;
  private workspaceRendererConfigByCell = new WeakMap<any, any>();
  private lastAppliedThemeColors: ActiveThemeCandleColors | null = null;
  private chartDefaultHydrationEpoch = 0;
  private pendingVisibleRangeUnsubs = new WeakMap<any, () => void>();
  private pendingVisibleRangeEpoch = new WeakMap<any, number>();
  private pendingTargetVisibleRangeByCell = new WeakMap<any, VisibleRangeSnapshot>();
  private visibleRangeCleanupSet = new Set<() => void>();
  private isApplyingLayout = false;
  private customPalette: CustomThemePalette | null = null;
  private customCandleColors: { bullColor?: string; bearColor?: string } | null = null;
  private customChartBackground?: CustomChartBackgroundConfig;
  private onVelaThemeSelect?: (mode: 'dark' | 'light') => void;
  private onPersistableStateChange?: (reason: string) => void;
  private viewportPersistDebounceMs = 800;
  private viewportPersistTimer: any = null;
  private configChangedUnsubs: Array<() => void> = [];
  private suppressPersistEventsDepth = 0;
  private isRestoringWorkspace = false;
  private suppressAutoDrawingRestoreKey: string | null = null;
  private desiredPaneWeightsByCell = new WeakMap<any, Map<string, number>>();
  private lastCapturedPaneLayoutByCell = new WeakMap<any, string>();
  private userTouchedPaneLayoutByCell = new WeakSet<any>();
  private volumeHiddenByCell = new WeakMap<any, boolean>();
  private preMacroVolumeShowByCell = new WeakMap<any, boolean>();
  private managedTimers = new Set<ReturnType<typeof setTimeout>>();
  private pendingWaitCleanups = new Set<() => void>();
  private workspaceEventUnsubs: Array<() => void> = [];
  private isDestroyed = false;
  private gridMode: GridMode = 'normal';
  private feedHealthSink: StreamHealthSink;
  private persistence: IPersistenceService;
  private hasCustomPersistence = false;
  private streamCoordinator: StreamGuardCoordinator;
  private providerFactories?: Partial<Record<string, () => any>>;
  private streamWatchdogMs?: number;
  private streamStaleMs?: number;
  private onlineListener: (() => void) | null = null;
  private registeredCustomSignatures = new Map<string, string>();
  private customHydrationEpoch = 0;
  private timelineMarksController: TimelineMarksController = timelineMarksController;
  private session: MarketSession = 'regular';

  public getTimelineMarksController(): TimelineMarksController {
    return this.timelineMarksController;
  }

  public getFetchSeriesAdapter(): FetchSeriesHandler {
    return this.pineRuntime.getFetchSeriesAdapter();
  }

  constructor(options: Partial<ChartSessionOptions> = {}) {
    this.symbol = options.symbol || 'BTCUSDT';
    this.timeframe = options.timeframe || '15m';
    this.defaultTimeframe = options.defaultTimeframe || '15m';
    this.layout = options.layout || '1';
    this.providerId = options.providerId || 'binance';
    this.themePreset = options.themePreset || 'signature';
    this.fontSize = options.fontSize || 12;
    this.timezone = options.timezone || 'Asia/Jakarta';
    this.session = options.session || 'regular';
    this.showCurrentPriceLine = options.showCurrentPriceLine ?? true;
    this.priceScaleCountdown = options.priceScaleCountdown ?? options.showPriceScaleCountdown ?? false;
    this.wallClock = options.wallClock ?? getSharedTerminalWallClock();
    this.showVolume = options.showVolume ?? true;
    this.gridMode = options.gridMode || 'normal';
    this.customChartBackground = options.customChartBackground;
    this.customPalette = options.customPalette || null;
    this.onVelaThemeSelect = options.onVelaThemeSelect;
    this.onPersistableStateChange = options.onPersistableStateChange;
    this.viewportPersistDebounceMs = options.viewportPersistDebounceMs ?? 800;
    if (options.customBullColor || options.customBearColor) {
      this.customCandleColors = {
        bullColor: options.customBullColor,
        bearColor: options.customBearColor,
      };
    }
    this.syncConfig = options.syncConfig || {
      crosshair: true,
      viewport: true,
      symbol: false,
      drawings: true,
      indicators: true
    };
    this.onActiveCellChange = options.onActiveCellChange;
    this.onPriceStyleChange = options.onPriceStyleChange;
    this.onRangePresetChange = options.onRangePresetChange;
    this.onActiveIndicatorsChange = options.onActiveIndicatorsChange;
    this.onStrategyTelemetryHandler = options.onStrategyTelemetry;
    this.pineRuntime =
      options.pineRuntimeCoordinator ??
      new PineRuntimeCoordinator({
        strategyTelemetry: options.strategyTelemetry,
        alertBridge: options.pineAlertBridge ?? pineAlertBridge,
        onTelemetry: (payload) => this.onStrategyTelemetryHandler?.(payload),
      });
    this.workspaceFactory = options.workspaceFactory;
    this.hasCustomPersistence = Boolean(options.persistence);
    this.persistence = options.persistence ?? storage;
    this.feedHealthSink = options.feedHealthSink ?? marketFeed;
    this.streamCoordinator = new StreamGuardCoordinator(this.feedHealthSink);
    this.providerFactories = options.providerFactories;
    this.streamWatchdogMs = options.streamWatchdogMs;
    this.streamStaleMs = options.streamStaleMs;

    marketSessionService.updateContext(this.symbol, this.providerId);
    marketSessionService.setSession(this.session);
  }

  /**
   * Mengambil snapshot kondisi sesi saat ini
   */
  public getSnapshot(): ChartSessionSnapshot {
    return {
      isAttached: this.isAttached,
      symbol: this.symbol,
      timeframe: this.timeframe,
      providerId: this.providerId,
      layout: this.layout,
      timezone: this.timezone,
      themePreset: this.themePreset,
      fontSize: this.fontSize,
      session: this.session,
      sessionAvailable: this.isSessionAvailable(),
      customPalette: this.customPalette || undefined,
      customBullColor: this.customCandleColors?.bullColor,
      customBearColor: this.customCandleColors?.bearColor,
      showCurrentPriceLine: this.showCurrentPriceLine,
      priceScaleCountdown: this.isPriceScaleCountdownEnabled(),
      showVolume: this.showVolume,
      gridMode: this.gridMode,
      priceStyle: this.getPriceStyle(),
      activeCell: this.activeCellInfo
        ? { ...this.activeCellInfo }
        : { symbol: this.symbol, timeframe: this.timeframe },
      activeIndicators: this.getActiveIndicators(),
      syncConfig: { ...this.syncConfig },
      activeRangePreset: this.activeRangePreset
    };
  }

  /**
   * Mengambil sesi pasar aktif saat ini ('regular' vs 'extended')
   */
  public getSession(): MarketSession {
    return this.session;
  }

  /**
   * Memeriksa apakah simbol atau bursa aktif mendukung sesi perdagangan (RTH/ETH)
   */
  public isSessionAvailable(): boolean {
    if (this.workspace?.active) {
      if (typeof this.workspace.active.sessionAvailable === 'boolean') {
        return this.workspace.active.sessionAvailable;
      }
    }
    return isSessionSupported(this.symbol, this.providerId);
  }

  /**
   * Menerapkan konfigurasi warna shading sesi translucent dan membersihkan sessionZones
   * secara otomatis pada pasar continuous 24/7 (seperti kripto).
   */
  private applySessionRendererState(cell: any): void {
    const renderer = resolveNativeRenderer(cell);
    if (!renderer) return;

    this.withSuppressedPersistEvents(() => {
      if (typeof renderer.applyConfig === 'function') {
        renderer.applyConfig({
          sessions: buildSessionShadeConfig(),
        });
      }

      if (!this.isSessionAvailable() && typeof renderer.set === 'function') {
        renderer.set('sessionZones', null);
      }
    });
  }

  /**
   * Mengubah mode sesi pasar (regular vs extended) dan menyinkronkan ke seluruh sel Vela WebGL2
   */
  public setSession(session: MarketSession): void {
    if (this.session === session) return;
    this.session = session;
    marketSessionService.setSession(session);

    if (this.workspace) {
      try {
        const yahooProv =
          typeof this.workspace.feed?.providerInstance === 'function'
            ? this.workspace.feed.providerInstance('yahoo')
            : null;
        if (yahooProv && typeof yahooProv.setSession === 'function') {
          yahooProv.setSession(session);
        }

        for (const cell of this.getAllCells()) {
          if (typeof cell.setSession === 'function') {
            cell.setSession(session);
          } else if (typeof cell.setMarket === 'function') {
            cell.setMarket({ session });
          }
          this.applySessionRendererState(cell);
        }
      } catch (err) {
        console.warn('[ChartSessionController] setSession error:', err);
      }
    }

    this.notify();
    this.emitPersistableChange('session');
  }

  /**
   * Membalik status sesi pasar antara 'regular' dan 'extended'
   */
  public toggleSession(): MarketSession {
    const next: MarketSession = this.session === 'regular' ? 'extended' : 'regular';
    this.setSession(next);
    return next;
  }

  public setGridMode(mode?: GridMode): void {
    const nextMode = mode || 'normal';
    if (this.gridMode === nextMode) return;
    this.gridMode = nextMode;
    this.setTheme(this.themePreset);
  }

  public getGridMode(): GridMode {
    return this.gridMode;
  }

  /**
   * Menghitung warna efektif garis grid WebGL berdasarkan mode grid dan kontras teks
   */
  public resolveEffectiveGridColor(textColor: string, isDark: boolean = true): string {
    if (this.gridMode === 'hidden') {
      return 'rgba(0, 0, 0, 0)';
    }
    if (this.gridMode === 'dimmed') {
      return withAlpha(textColor, 0.02);
    }
    return isDark ? withAlpha(textColor, 0.06) : withAlpha(textColor, 0.08);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const sub of this.subscribers) {
      try {
        sub(snapshot);
      } catch (err) {
        console.error('[ChartSessionController] Error in subscriber:', err);
      }
    }
  }

  /**
   * Berlangganan perubahan state sesi grafik
   */
  public subscribe(fn: SessionSubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.subscribers.delete(fn);
    };
  }

  /**
   * Mengumpulkan konfigurasi custom-* provider secara sinkron dari PersistenceService dan sink aktif
   */
  private getKnownCustomConfigs(): ProviderConfig[] {
    const byId = new Map<string, ProviderConfig>();

    const collect = (list: any) => {
      if (!Array.isArray(list)) return;
      for (const p of list) {
        if (p?.id && String(p.id).toLowerCase().startsWith('custom') && p.rest_url?.trim()) {
          if (!byId.has(p.id)) byId.set(p.id, p);
        }
      }
    };

    collect(this.persistence.getProvidersSync());

    const sinkAny = this.feedHealthSink as any;
    if (
      typeof sinkAny?.getKnownProviderConfigsSync === 'function' &&
      !(this.hasCustomPersistence && sinkAny === marketFeed)
    ) {
      collect(sinkAny.getKnownProviderConfigsSync());
    }

    return Array.from(byId.values());
  }

  private getCustomConfigSignature(cfg: ProviderConfig): string {
    return `${cfg.name || ''}|${cfg.rest_url || ''}|${cfg.ws_url || ''}`;
  }

  private registerCustomConfigIntoVela(cfg: ProviderConfig): boolean {
    const velaFeed = this.workspace?.feed;
    if (!velaFeed || typeof velaFeed.registerProvider !== 'function') return false;
    const velaKey = toVelaProviderId(cfg.id);
    const nextSig = this.getCustomConfigSignature(cfg);
    const existingInstance =
      typeof velaFeed.providerInstance === 'function' ? velaFeed.providerInstance(velaKey) : undefined;
    const prevSig = this.registeredCustomSignatures.get(velaKey);

    if (existingInstance && prevSig === nextSig) {
      return false;
    }

    if (existingInstance) {
      try {
        existingInstance.destroy?.();
      } catch (_) {}
      if (typeof velaFeed.unregisterProvider === 'function') {
        velaFeed.unregisterProvider(velaKey);
      }
    }

    const wrapped = wrapProviderWithStreamGuard(
      new CustomFeedProvider({
        providerId: cfg.id,
        name: cfg.name,
        restUrl: cfg.rest_url,
        wsUrl: cfg.ws_url,
        healthSink: this.feedHealthSink,
      }),
      cfg.id,
      this.streamCoordinator,
      {
        healthSink: this.feedHealthSink,
        watchdogCheckMs: this.streamWatchdogMs,
        staleStreamMs: this.streamStaleMs,
      }
    );
    velaFeed.registerProvider(velaKey, wrapped);
    this.registeredCustomSignatures.set(velaKey, nextSig);
    return Boolean(existingInstance);
  }

  private ensureVelaProviderRegistered(targetProviderId?: string): { registered: boolean; replaced: boolean } {
    const rawId = (targetProviderId || this.providerId || 'binance').trim().toLowerCase();
    if (!rawId.startsWith('custom')) return { registered: true, replaced: false };

    const velaFeed = this.workspace?.feed;
    if (!velaFeed || typeof velaFeed.registerProvider !== 'function') {
      return { registered: false, replaced: false };
    }
    const velaKey = toVelaProviderId(rawId);

    const customCfg = this.getKnownCustomConfigs().find(
      (c) => c.id.toLowerCase() === rawId || toVelaProviderId(c.id) === velaKey
    );
    if (customCfg) {
      const replaced = this.registerCustomConfigIntoVela(customCfg);
      return { registered: true, replaced };
    }

    if (typeof velaFeed.providerInstance === 'function' && velaFeed.providerInstance(velaKey)) {
      return { registered: true, replaced: false };
    }

    const customFactory = this.providerFactories?.[rawId] || this.providerFactories?.[velaKey];
    if (typeof customFactory === 'function') {
      const wrapped = wrapProviderWithStreamGuard(customFactory(), rawId, this.streamCoordinator, {
        healthSink: this.feedHealthSink,
        watchdogCheckMs: this.streamWatchdogMs,
        staleStreamMs: this.streamStaleMs,
      });
      velaFeed.registerProvider(velaKey, wrapped);
      return { registered: true, replaced: false };
    }

    return { registered: false, replaced: false };
  }

  private async hydrateAndRegisterCustomProviders(): Promise<void> {
    const epoch = ++this.customHydrationEpoch;
    const byId = new Map<string, ProviderConfig>();

    const mergeList = (list: any) => {
      if (!Array.isArray(list)) return;
      for (const cfg of list) {
        if (cfg?.id && String(cfg.id).toLowerCase().startsWith('custom') && cfg.rest_url?.trim()) {
          byId.set(cfg.id, cfg);
        }
      }
    };

    try {
      const res = await this.persistence.loadProviders();
      if (epoch !== this.customHydrationEpoch) return;
      mergeList(res);
    } catch (_) {}

    const sinkAny = this.feedHealthSink as any;
    if (
      typeof sinkAny?.getSavedProviders === 'function' &&
      !(this.hasCustomPersistence && sinkAny === marketFeed)
    ) {
      try {
        const res = await sinkAny.getSavedProviders();
        if (epoch !== this.customHydrationEpoch) return;
        mergeList(res);
      } catch (_) {}
    }

    if (epoch !== this.customHydrationEpoch) return;

    // Utamakan state sinkron terkini bila terjadi penyimpanan config saat await berlangsung
    mergeList(this.getKnownCustomConfigs());

    for (const cfg of byId.values()) {
      this.registerCustomConfigIntoVela(cfg);
    }
  }

  /**
   * Mengaitkan elemen container kanvas WebGL2 dan menginisialisasi workspace
   */
  public attach(container: HTMLElement | null, options: Partial<ChartSessionOptions> = {}): () => void {
    if (!container) return () => {};

    if (options.symbol) this.symbol = options.symbol;
    if (options.timeframe) this.timeframe = options.timeframe;
    if (options.layout) this.layout = options.layout;
    if (options.providerId) this.providerId = options.providerId;
    if (options.timezone) this.timezone = options.timezone;
    if (options.session) this.session = options.session;
    if (options.themePreset) this.themePreset = options.themePreset;
    if (options.fontSize) this.fontSize = options.fontSize;
    if (options.syncConfig) this.syncConfig = options.syncConfig;
    if (options.showVolume !== undefined) this.showVolume = options.showVolume;
    if (options.customPalette !== undefined) this.customPalette = options.customPalette;
    if (options.onVelaThemeSelect) this.onVelaThemeSelect = options.onVelaThemeSelect;
    if (options.customChartBackground !== undefined) this.customChartBackground = options.customChartBackground;
    if (options.onPersistableStateChange) this.onPersistableStateChange = options.onPersistableStateChange;
    if (options.viewportPersistDebounceMs !== undefined) this.viewportPersistDebounceMs = options.viewportPersistDebounceMs;
    if (options.workspaceFactory) this.workspaceFactory = options.workspaceFactory;

    this.container = container;
    this.isDestroyed = false;
    marketSessionService.updateContext(this.symbol, this.providerId);
    marketSessionService.setSession(this.session);
    this.clearWorkspaceEventUnsubs();
    this.applyBackground();
    ensurePineEngine();

    const isCustomBg = this.customChartBackground?.mode === 'solid' || this.customChartBackground?.mode === 'gradient';
    const themeConfig = resolveThemeConfig(this.themePreset);
    const { textColor: themeTextColor, isDark: themeIsDark } = resolveEffectiveThemeColors(this.themePreset, this.customPalette);
    const effectiveGridInit = this.resolveEffectiveGridColor(themeTextColor, themeIsDark);
    const velaTheme = {
      background: isCustomBg ? 'transparent' : themeConfig.chart.background,
      textColor: themeConfig.chart.textColor,
      gridColor: effectiveGridInit,
      borderColor: themeConfig.chart.borderColor,
      upColor: themeConfig.chart.upColor,
      downColor: themeConfig.chart.downColor,
      fontSize: Math.max(9, Math.min(32, Math.round(this.fontSize))),
      fontFamily: "var(--font-sans, 'Plus Jakarta Sans', sans-serif)",
    };

    const velaSym = resolveVelaSymbol(this.symbol, this.providerId);
    const knownCustomConfigs = this.getKnownCustomConfigs();
    const rawProviderFactories: Record<string, () => any> = {
      binance: () => new BinanceProvider(),
      indodax: () => new IndodaxProvider({ healthSink: this.feedHealthSink }),
      hyperliquid: () => new HyperliquidProvider(),
      coinbase: () => new CoinbaseProvider(),
      bitunix: () => new BitunixProvider({ healthSink: this.feedHealthSink }),
      yahoo: () => new YahooFinanceProvider({ healthSink: this.feedHealthSink, session: this.session }),
      macro: () => new MacroIndexProvider({ healthSink: this.feedHealthSink }),
    };

    this.registeredCustomSignatures.clear();
    // Daftarkan provider custom-* menggunakan kunci Vela aman ([A-Za-z0-9_.]+ -> custom_*)
    for (const cfg of knownCustomConfigs) {
      const velaKey = toVelaProviderId(cfg.id);
      this.registeredCustomSignatures.set(velaKey, this.getCustomConfigSignature(cfg));
      rawProviderFactories[velaKey] = () =>
        new CustomFeedProvider({
          providerId: cfg.id,
          name: cfg.name,
          restUrl: cfg.rest_url,
          wsUrl: cfg.ws_url,
          healthSink: this.feedHealthSink,
        });
    }

    if (this.providerFactories) {
      for (const [id, factory] of Object.entries(this.providerFactories)) {
        if (typeof factory !== 'function') continue;
        const velaKey = toVelaProviderId(id);
        rawProviderFactories[velaKey] = factory;
        if (velaKey !== id) {
          rawProviderFactories[id] = factory;
        }
      }
    }

    const guardedProviders: Record<string, () => any> = {};
    for (const [key, factory] of Object.entries(rawProviderFactories)) {
      if (typeof factory !== 'function') continue;
      const matchedCustom = knownCustomConfigs.find((c) => toVelaProviderId(c.id) === key);
      const guardProviderId = matchedCustom ? matchedCustom.id : key;
      guardedProviders[key] = () =>
        wrapProviderWithStreamGuard(factory(), guardProviderId, this.streamCoordinator, {
          healthSink: this.feedHealthSink,
          watchdogCheckMs: this.streamWatchdogMs,
          staleStreamMs: this.streamStaleMs,
        });
    }

    const workspaceConfig = {
      layout: this.layout as any,
      symbol: velaSym,
      timeframe: toVelaTimeframe(this.timeframe),
      drawingToolbar: false,
      bottombar: false,
      topbar: { left: [], right: [] },
      live: true,
      currentPriceLine: this.showCurrentPriceLine,
      volume: this.showVolume,
      theme: velaTheme,
      timezone: this.timezone,
      session: this.session,
      providers: guardedProviders,
      engines: {
        pine: () => this.pineRuntime.createWorkerEngine(),
      },
      maxWebglCells: 8,
      sync: {
        crosshair: this.syncConfig.crosshair,
        viewport: this.syncConfig.viewport ?? true,
        style: true,
        drawings: this.syncConfig.drawings,
        symbol: this.syncConfig.symbol,
      },
    };

    try {
      if (this.workspaceFactory) {
        this.workspace = this.workspaceFactory(container, workspaceConfig);
      } else {
        this.workspace = new VelaWorkspace(container, workspaceConfig as any);
      }
      this.attachDrawingSyncBoundaryGuard(this.workspace);
      this.isAttached = true;
      for (const cfg of knownCustomConfigs) {
        this.registerCustomConfigIntoVela(cfg);
      }
      void this.hydrateAndRegisterCustomProviders();
    } catch (err) {
      console.warn('[ChartSessionController] Gagal inisialisasi VelaWorkspace:', err);
      this.workspace = null;
      this.isAttached = false;
      return () => {};
    }

    // Pasang listener & price line guard ke seluruh cell awal
    this.lastAppliedThemeColors = this.resolveActiveThemeCandleColors();
    for (const cell of this.getAllCells()) {
      this.attachCellListeners(cell);
    }

    // Inisialisasi TimelineMarksController pada workspace dan sinkronkan penanda pasar aktif
    this.timelineMarksController.attach(this.workspace);
    this.timelineMarksController.syncForMarket(this.symbol, this.providerId);

    // Muat & terapkan konfigurasi chart default tersimpan milik pengguna (sinkron dari cache PersistenceService + hidrasi asinkron adapter)
    const attachEpoch = ++this.chartDefaultHydrationEpoch;
    this.applyUserChartDefaultConfig(this.persistence.getChartDefaultConfigSync());
    void this.hydrateChartDefaultConfig(attachEpoch);

    // Dengarkan pembuatan cell baru saat berganti layout grid
    if (this.workspace && typeof this.workspace.on === 'function') {
      try {
        const wsRef = this.workspace;
        let cellCreatedHandler: ((p: { id: string }) => void) | null = null;
        const uCreated = this.workspace.on('cell:created', (cellCreatedHandler = ({ id }: { id: string }) => {
          const cell = this.workspace?.cell?.(id);
          if (cell) {
            this.attachCellListeners(cell);
            if (!this.isRestoringWorkspace && (this.userChartDefaultConfig || this.activeChartDefaultConfig)) {
              const baseCfg = this.mergeRendererConfigs(this.userChartDefaultConfig, this.activeChartDefaultConfig);
              if (baseCfg) {
                this.applyEffectiveRendererConfig(cell, baseCfg);
              }
            }
            if (this.timezone) {
              this.setTimezone(this.timezone);
            }
          }
          this.applyBackground();
        }));
        this.workspaceEventUnsubs.push(
          typeof uCreated === 'function'
            ? uCreated
            : () => {
                if (cellCreatedHandler) wsRef.off?.('cell:created', cellCreatedHandler);
              }
        );

        let cellActiveHandler: (() => void) | null = null;
        const uActive = this.workspace.on('cell:active', (cellActiveHandler = () => {
          if (this.isApplyingLayout) return;
          const cur = this.workspace?.active;
          if (cur) {
            const { providerId: rawProv, symbol: rawSym } = getCellMarketIdentity(cur);
            const cleanSym = rawSym || this.symbol;
            const curTf = (fromVelaTimeframe(cur.timeframe || this.timeframe) as Timeframe);
            const prevProv = this.providerId;
            this.activeCellInfo = { symbol: cleanSym, timeframe: curTf };
            if (!this.isRestoringWorkspace && rawProv) {
              this.providerId = rawProv;
            }
            if (
              this.onActiveCellChange &&
              (cleanSym !== this.symbol || curTf !== this.timeframe || this.providerId !== prevProv)
            ) {
              this.onActiveCellChange({
                symbol: cleanSym,
                timeframe: curTf,
                providerId: this.providerId,
              });
            }
            this.onPriceStyleChange?.(this.getPriceStyle(cur));
            this.attachCellListeners(cur);
            this.emitPersistableChange('activeCell');
          }
          if (this.syncConfig.indicators === false) {
            this.notifyActiveIndicators();
          }
        }));
        this.workspaceEventUnsubs.push(
          typeof uActive === 'function'
            ? uActive
            : () => {
                if (cellActiveHandler) wsRef.off?.('cell:active', cellActiveHandler);
              }
        );

        let stateChangedHandler: (() => void) | null = null;
        const uState = this.workspace.on('state:changed', (stateChangedHandler = () => {
          this.emitPersistableChange('trackSizes');
        }));
        this.workspaceEventUnsubs.push(
          typeof uState === 'function'
            ? uState
            : () => {
                if (stateChangedHandler) wsRef.off?.('state:changed', stateChangedHandler);
              }
        );

        let scriptRunHandler: ((run: any) => void) | null = null;
        const uScriptRun = this.workspace.on('script:run', (scriptRunHandler = async (run: any) => {
          const cellId = run?.cell || this.workspace?.active?.id;
          const targetCell = (cellId && this.workspace?.cell?.(cellId)) || this.workspace?.active;
          await this.pineRuntime.handleScriptRun(run, targetCell);
        }));
        this.workspaceEventUnsubs.push(
          typeof uScriptRun === 'function'
            ? uScriptRun
            : () => {
                if (scriptRunHandler) wsRef.off?.('script:run', scriptRunHandler);
              }
        );
      } catch (_) {}
    }

    // Pasang ResizeObserver agar kanvas adaptif terhadap perubahan ukuran window
    if (typeof ResizeObserver !== 'undefined') {
      try {
        this.resizeObserver = new ResizeObserver(() => {
          this.workspace?.resize?.();
        });
        this.resizeObserver.observe(container);
      } catch (_) {}
    }

    // Otomatis sambung ulang stream WebSocket & tambal celah candle ketika koneksi OS pulih (online)
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      if (this.onlineListener) {
        try {
          window.removeEventListener('online', this.onlineListener);
        } catch (_) {}
      }
      this.onlineListener = () => {
        if (this.feedHealthSink === marketFeed) {
          marketFeed.resetConnectionError();
          void marketFeed.pollTick().catch(() => {});
        }
        void this.reconnectLiveFeed();
      };
      window.addEventListener('online', this.onlineListener);
    }

    this.notify();

    // Selaraskan warna volume saat data bar pertama kali tiba dan diaktifkan secara asinkron
    this.scheduleManagedTimeout(() => {
      this.syncNativeVolumeColors();
    }, 200);
    this.scheduleManagedTimeout(() => {
      this.syncNativeVolumeColors();
    }, 800);

    return () => {
      this.destroy();
    };
  }

  /**
   * Menandai awal proses pemulihan workspace agar perubahan terprogram tidak memicu auto-save rekursif.
   */
  public beginWorkspaceRestore(): void {
    this.isRestoringWorkspace = true;
    this.suppressAutoDrawingRestoreKey = null;
    this.workspaceRendererConfigByCell = new WeakMap();
    this.pendingTargetVisibleRangeByCell = new WeakMap();
    this.userTouchedPaneLayoutByCell = new WeakSet<any>();
    this.clearPendingVisibleRangeListeners();
    this.clearPendingWaiters();
    if (this.viewportPersistTimer) {
      clearTimeout(this.viewportPersistTimer);
      this.viewportPersistTimer = null;
    }
  }

  private scheduleManagedTimeout(fn: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const handle = setTimeout(() => {
      this.managedTimers.delete(handle);
      if (this.isDestroyed) return;
      fn();
    }, delayMs);
    this.managedTimers.add(handle);
    return handle;
  }

  private clearManagedTimers(): void {
    for (const timer of this.managedTimers) {
      clearTimeout(timer);
    }
    this.managedTimers.clear();
  }

  private clearPendingWaiters(): void {
    for (const cleanup of Array.from(this.pendingWaitCleanups)) {
      try { cleanup(); } catch (_) {}
    }
    this.pendingWaitCleanups.clear();
  }

  private clearWorkspaceEventUnsubs(): void {
    for (const unsub of this.workspaceEventUnsubs) {
      try { unsub(); } catch (_) {}
    }
    this.workspaceEventUnsubs = [];
  }

  private waitForChartCondition(
    chart: any,
    events: string[],
    isReady: () => boolean,
    timeoutMs: number
  ): Promise<void> {
    if (this.isDestroyed || isReady() || typeof chart?.on !== 'function') {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let settled = false;
      const unsubs: Array<() => void> = [];
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (settled) return;
        settled = true;
        this.pendingWaitCleanups.delete(cleanup);
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        for (const u of unsubs) {
          try { u?.(); } catch (_) {}
        }
        resolve();
      };

      const check = () => {
        if (this.isDestroyed || isReady()) {
          cleanup();
        }
      };

      this.pendingWaitCleanups.add(cleanup);

      for (const ev of events) {
        try {
          const ret = chart.on(ev, check);
          const unsub = typeof ret === 'function' ? ret : () => chart.off?.(ev, check);
          unsubs.push(unsub);
        } catch (_) {}
      }

      check();
      if (!settled) {
        timer = setTimeout(cleanup, timeoutMs);
      }
    });
  }

  private clearPendingVisibleRangeListeners(): void {
    for (const unsub of this.visibleRangeCleanupSet) {
      try { unsub(); } catch (_) {}
    }
    this.visibleRangeCleanupSet.clear();
    this.pendingVisibleRangeUnsubs = new WeakMap();
  }

  private mergeRendererConfigs(base: any, override: any): any {
    if (!base || typeof base !== 'object') {
      return cloneRendererConfigValue(override);
    }
    if (!override || typeof override !== 'object') {
      return cloneRendererConfigValue(base);
    }
    const merged: Record<string, any> = cloneRendererConfigValue(base);
    for (const [key, val] of Object.entries(override)) {
      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        merged[key] !== null &&
        typeof merged[key] === 'object' &&
        !Array.isArray(merged[key])
      ) {
        merged[key] = this.mergeRendererConfigs(merged[key], val);
      } else {
        merged[key] = cloneRendererConfigValue(val);
      }
    }
    return merged;
  }

  private applyEffectiveRendererConfig(cell: any, config: any): void {
    if (!cell || !config || typeof config !== 'object') return;
    const chart = cell?.chart || cell?.inner;
    const r = chart?.renderer?.renderer || chart?.renderer;
    this.withSuppressedPersistEvents(() => {
      try {
        if (typeof r?.applyConfig === 'function') {
          r.applyConfig(config);
        } else if (typeof chart?.renderer?.applyConfig === 'function') {
          chart.renderer.applyConfig(config);
        }
      } catch (_) {}
    });
  }

  private applyUserChartDefaultConfig(rawConfig: any): any | null {
    const parsedDefault = sanitizeRendererConfigForApply(rawConfig);
    if (!parsedDefault || Object.keys(parsedDefault).length === 0) {
      return null;
    }
    this.userChartDefaultConfig = parsedDefault;
    this.activeChartDefaultConfig = this.mergeRendererConfigs(this.activeChartDefaultConfig, parsedDefault);
    for (const cell of this.getAllCells()) {
      const wsOverride = this.workspaceRendererConfigByCell.get(cell);
      const effective = wsOverride ? this.mergeRendererConfigs(parsedDefault, wsOverride) : parsedDefault;
      this.applyEffectiveRendererConfig(cell, effective);
      this.syncGlobalVisualChromeToCells(cell);
    }
    return parsedDefault;
  }

  /**
   * Memuat konfigurasi chart default tersimpan dari PersistenceService dan menerapkannya ke sel
   * dengan tetap menghormati override spesifik per workspace/sel (K3: Workspace > Default User > Pabrik).
   */
  public async hydrateChartDefaultConfig(expectedEpoch?: number): Promise<any | null> {
    const epoch = expectedEpoch ?? this.chartDefaultHydrationEpoch;
    try {
      const rawLoaded = await this.persistence.loadChartDefaultConfig();
      if (epoch !== this.chartDefaultHydrationEpoch || !this.workspace) {
        return null;
      }
      return this.applyUserChartDefaultConfig(rawLoaded);
    } catch (err) {
      console.warn('[ChartSessionController] Gagal memuat chart default config:', err);
      return null;
    }
  }

  /**
   * Menerapkan rendererConfig milik workspace pada sel target di atas base chartDefaultConfig (K3).
   */
  public applyRendererConfig(config: any, cell?: any): void {
    const targetCell = this.resolveTargetCell(cell);
    if (!targetCell || !config || typeof config !== 'object') return;
    const sanitized = sanitizeRendererConfigForApply(config);
    if (sanitized) {
      this.workspaceRendererConfigByCell.set(targetCell, sanitized);
      const effective = this.userChartDefaultConfig
        ? this.mergeRendererConfigs(this.userChartDefaultConfig, sanitized)
        : sanitized;
      this.applyEffectiveRendererConfig(targetCell, effective);
    }
    this.syncGlobalVisualChromeToCells(targetCell);
  }

  /**
   * Mengambil snapshot posisi scroll historis (visibleRange) beserta penanda apakah chart berada di ujung live (K2).
   */
  public getVisibleRangeSnapshot(cell?: any): VisibleRangeSnapshot | null {
    const targetCell = this.resolveTargetCell(cell);
    const chart = targetCell?.chart || targetCell?.inner;
    if (!chart) return null;

    const native = chart?.renderer?.renderer || chart?.renderer;
    const rawVr =
      typeof chart.getVisibleRange === 'function'
        ? chart.getVisibleRange()
        : typeof native?.getVisibleRange === 'function'
          ? native.getVisibleRange()
          : null;

    if (!rawVr || typeof rawVr.from !== 'number' || typeof rawVr.to !== 'number' || !Number.isFinite(rawVr.from) || !Number.isFinite(rawVr.to)) {
      const pending = targetCell ? this.pendingTargetVisibleRangeByCell.get(targetCell) : undefined;
      return pending ? { ...pending } : null;
    }

    let bars: any[] | undefined;
    const rawBars =
      chart?.orchestrator?.rawBars ??
      chart?.orchestrator?.bars ??
      native?.bars ??
      chart?.bars ??
      (typeof chart?.getBars === 'function' ? chart.getBars() : undefined);
    if (Array.isArray(rawBars) && rawBars.length > 0) {
      bars = rawBars;
    }

    let atLiveEdge = true;
    if (bars && bars.length >= 2) {
      const lastBar = bars[bars.length - 1];
      const prevBar = bars[bars.length - 2];
      if (typeof lastBar?.time === 'number' && typeof prevBar?.time === 'number') {
        const oneBarMs = Math.max(0, lastBar.time - prevBar.time);
        atLiveEdge = rawVr.to >= lastBar.time - oneBarMs;
      }
    } else if (bars && bars.length === 1 && typeof bars[0]?.time === 'number') {
      atLiveEdge = rawVr.to >= bars[0].time;
    } else if (native?.coords && typeof native.coords.barCount === 'number' && native.coords.barCount > 0) {
      if (typeof native.coords.visibleLogicalRange === 'function') {
        const lvr = native.coords.visibleLogicalRange();
        atLiveEdge = lvr.to >= native.coords.barCount - 2;
      } else if (typeof native.coords.getViewport === 'function') {
        const vp = native.coords.getViewport();
        if (typeof vp?.rightOffset === 'number') {
          atLiveEdge = vp.rightOffset >= -1;
        }
      }
    } else if (typeof rawVr.atLiveEdge === 'boolean') {
      atLiveEdge = rawVr.atLiveEdge;
    }

    return {
      from: rawVr.from,
      to: rawVr.to,
      atLiveEdge,
    };
  }

  /**
   * Memulihkan posisi scroll historis sesuai keputusan K2:
   * hanya dipulihkan bila `atLiveEdge === false`, menunggu event `history:complete` jika bar masih dimuat.
   */
  public applyVisibleRange(vr?: VisibleRangeSnapshot | null, cell?: any): boolean {
    const targetCell = this.resolveTargetCell(cell);
    if (!targetCell) return false;

    const prevUnsub = this.pendingVisibleRangeUnsubs.get(targetCell);
    if (prevUnsub) {
      try { prevUnsub(); } catch (_) {}
      this.visibleRangeCleanupSet.delete(prevUnsub);
      this.pendingVisibleRangeUnsubs.delete(targetCell);
    }
    this.pendingTargetVisibleRangeByCell.delete(targetCell);
    const epoch = (this.pendingVisibleRangeEpoch.get(targetCell) ?? 0) + 1;
    this.pendingVisibleRangeEpoch.set(targetCell, epoch);

    if (
      !vr ||
      typeof vr.from !== 'number' ||
      typeof vr.to !== 'number' ||
      !Number.isFinite(vr.from) ||
      !Number.isFinite(vr.to) ||
      vr.atLiveEdge !== false
    ) {
      return false;
    }

    const chart = targetCell?.chart || targetCell?.inner;
    if (!chart || typeof chart.setVisibleRange !== 'function') return false;

    const savedTarget: VisibleRangeSnapshot = { from: vr.from, to: vr.to, atLiveEdge: false };
    this.pendingTargetVisibleRangeByCell.set(targetCell, savedTarget);

    let cleanupFn: (() => void) | null = null;
    const applyNow = () => {
      if (this.pendingVisibleRangeEpoch.get(targetCell) !== epoch) return;
      if (cleanupFn) {
        try { cleanupFn(); } catch (_) {}
        this.visibleRangeCleanupSet.delete(cleanupFn);
        this.pendingVisibleRangeUnsubs.delete(targetCell);
        cleanupFn = null;
      }
      this.pendingTargetVisibleRangeByCell.delete(targetCell);
      this.withSuppressedPersistEvents(() => {
        try {
          chart.setVisibleRange({ from: vr.from, to: vr.to });
        } catch (_) {}
      });
    };

    const historyDone = chart?.orchestrator
      ? Boolean(chart.orchestrator.historyCompleted && !chart.orchestrator.switchingMarket)
      : Boolean(chart?.historyCompleted === true);

    if (historyDone || typeof chart.on !== 'function') {
      applyNow();
      return true;
    }

    const unsub = chart.on('history:complete', applyNow);
    const resolvedCleanup: () => void =
      typeof unsub === 'function' ? unsub : () => chart.off?.('history:complete', applyNow);
    cleanupFn = resolvedCleanup;
    this.pendingVisibleRangeUnsubs.set(targetCell, resolvedCleanup);
    this.visibleRangeCleanupSet.add(resolvedCleanup);
    return true;
  }

  /**
   * Mengakhiri mode pemulihan workspace dan mengaktifkan kembali emisi sinyal dirty.
   */
  public endWorkspaceRestore(): void {
    this.isRestoringWorkspace = false;
  }

  /**
   * Mengembalikan status apakah proses pemulihan workspace sedang berlangsung.
   */
  public isRestoring(): boolean {
    return this.isRestoringWorkspace;
  }

  private withSuppressedPersistEvents<T>(fn: () => T): T {
    this.suppressPersistEventsDepth++;
    try {
      return fn();
    } finally {
      this.suppressPersistEventsDepth = Math.max(0, this.suppressPersistEventsDepth - 1);
    }
  }

  private emitPersistableChange(reason: string): void {
    if (this.isRestoringWorkspace || this.suppressPersistEventsDepth > 0) return;
    if (this.onPersistableStateChange) {
      try {
        this.onPersistableStateChange(reason);
      } catch (err) {
        console.warn('[ChartSessionController] onPersistableStateChange error:', err);
      }
    }
  }

  private scheduleViewportPersistChange(): void {
    if (this.isRestoringWorkspace || this.suppressPersistEventsDepth > 0) return;
    if (this.viewportPersistTimer) {
      clearTimeout(this.viewportPersistTimer);
    }
    this.viewportPersistTimer = setTimeout(() => {
      this.viewportPersistTimer = null;
      this.emitPersistableChange('viewport');
    }, this.viewportPersistDebounceMs);
  }

  private resolveTargetCell(cell?: any): any {
    return cell || this.workspace?.active || this.getAllCells()[0] || null;
  }

  /**
   * Memasang guard pada native.ensurePane agar pemanggilan internal Vela tanpa heightWeight
   * tidak menimpa bobot pane tersimpan milik user.
   */
  private installEnsurePaneGuard(cell: any): void {
    if (!cell) return;
    const chart = cell.chart || cell.inner;
    const native = chart?.renderer?.renderer || chart?.renderer;
    if (!native || typeof native.ensurePane !== 'function' || native.__trawanganEnsurePaneGuard) {
      return;
    }

    const self = this;
    const originalEnsurePane = native.ensurePane.bind(native);
    native.ensurePane = function (pane: { id: string; kind: string; order: number; heightWeight?: number }) {
      let effectivePane = pane;
      if (pane && pane.heightWeight === undefined && !self.userTouchedPaneLayoutByCell.has(cell)) {
        const desiredMap = self.desiredPaneWeightsByCell.get(cell);
        let sig = pane.kind === 'price' || pane.id === 'price' ? 'price' : '';
        if (!sig && chart?.panes && typeof chart.panes.list === 'function') {
          try {
            const listed = (chart.panes.list() || []).find((p: any) => p.id === pane.id);
            if (listed) sig = computePaneSignature(listed);
          } catch (_) {}
        }
        const existingScenePane = native.scene?.panes?.get?.(pane.id);
        const desiredWeight = sig && desiredMap ? desiredMap.get(sig) : undefined;
        const preservedWeight =
          desiredWeight !== undefined && desiredWeight > 0
            ? desiredWeight
            : (typeof existingScenePane?.heightWeight === 'number' && existingScenePane.heightWeight > 0
                ? existingScenePane.heightWeight
                : undefined);

        if (preservedWeight !== undefined) {
          effectivePane = { ...pane, heightWeight: preservedWeight };
        }
      }
      return originalEnsurePane(effectivePane);
    };
    native.__trawanganEnsurePaneGuard = true;
  }

  /**
   * Mengaitkan listener peristiwa pada sel spesifik dan mengaktifkan price line guard
   */
  public attachCellListeners(cell: any): void {
    if (!cell) return;
    this.installEnsurePaneGuard(cell);
    this.interceptApplyConfig(cell);
    this.enforceCurrentPriceLine(cell);
    if (!this.priceScaleCountdownByCell.has(cell)) {
      this.priceScaleCountdownByCell.set(cell, this.priceScaleCountdown);
    }
    this.enforcePriceScaleCountdown(cell);
    this.syncNativeVolumeColors(cell);
    this.syncCellMacroState(cell);
    attachPriceScaleInputGuard(cell);

    const chart = cell.chart || cell.inner;
    if (chart) {
      this.timelineMarksController.attachSingleCellOrChart(chart);
      this.pineRuntime.attachCell(cell, {
        resolveSymbol: () => getCellMarketIdentity(cell).symbol || this.symbol,
      });
    }
    // Otoritas Tunggal Tema Trawangan: Sembunyikan 'canvas.theme' dari dialog Vela
    if (chart && typeof chart.setSettingsVisibility === 'function') {
      try {
        chart.setSettingsVisibility({
          hidden: ['canvas.theme']
        });
      } catch (_) {}
    }

    // Terapkan konfigurasi garis grid langsung ke cell WebGL
    if (chart && typeof chart.applyConfig === 'function') {
      try {
        const { textColor: txt, isDark: dark } = resolveEffectiveThemeColors(this.themePreset, this.customPalette);
        const gridCol = this.resolveEffectiveGridColor(txt, dark);
        this.withSuppressedPersistEvents(() => {
          chart.applyConfig({
            grid: {
              vertLines: { visible: this.gridMode !== 'hidden', color: gridCol },
              horzLines: { visible: this.gridMode !== 'hidden', color: gridCol }
            },
            sessions: buildSessionShadeConfig(),
          });
        });
      } catch (_) {}
    }

    if (!this.lastCapturedPaneLayoutByCell.has(cell)) {
      const initLayout = this.getPaneLayout(cell);
      if (initLayout.length > 0) {
        this.lastCapturedPaneLayoutByCell.set(cell, JSON.stringify(initLayout));
      }
    }

    if (chart && typeof chart.on === 'function' && !chart.__trawanganChartEventsAttached) {
      try {
        chart.on('market:changed', () => {
          this.enforceCurrentPriceLine(cell);
          this.syncNativeVolumeColors(cell, false);
          this.syncCellMacroState(cell);
          const { symbol: cellSym, providerId: cellProv } = getCellMarketIdentity(cell);
          this.timelineMarksController.syncForMarket(cellSym || this.symbol, cellProv || this.providerId);
        });
        chart.on('indicator:added', () => {
          this.syncNativeVolumeColors(cell, false);
          this.syncCellMacroState(cell);
        });
        chart.on('history:complete', () => {
          this.syncNativeVolumeColors(cell, false);
          this.syncCellMacroState(cell);
          const { symbol: cellSym, providerId: cellProv } = getCellMarketIdentity(cell);
          this.timelineMarksController.syncForMarket(cellSym || this.symbol, cellProv || this.providerId);
        });
        chart.on('indicator:removed', (ev: any) => {
          this.handleIndicatorRemoved(ev?.id);
          this.emitPersistableChange('indicator:removed');
        });
        chart.on('priceStyle:change', () => {
          this.emitPersistableChange('priceStyle');
        });
        chart.on('indicator:visibility', () => {
          this.notifyActiveIndicators();
          this.emitPersistableChange('indicator:visibility');
        });
        chart.on('indicator:moved', () => {
          this.capturePaneLayoutIfChanged(cell, { silent: true });
          this.emitPersistableChange('indicator:moved');
        });
        chart.on('indicator:inputs', () => {
          this.notifyActiveIndicators();
          this.emitPersistableChange('indicator:inputs');
        });
        chart.on('pane:changed', () => {
          this.capturePaneLayoutIfChanged(cell, { silent: true });
          this.emitPersistableChange('pane:changed');
        });
        chart.on('viewport:changed', () => {
          this.checkRangePresetViewportDrift(cell);
          this.scheduleViewportPersistChange();
        });
        chart.__trawanganChartEventsAttached = true;
      } catch (_) {}
    }

    // Dengarkan perubahan konfigurasi internal Vela renderer (candle/series/scale dialog settings)
    const rendererCandidates = [chart?.renderer, chart?.renderer?.renderer].filter(
      (r, idx, arr) => r && typeof r.onConfigChanged === 'function' && arr.indexOf(r) === idx
    );
    for (const r of rendererCandidates) {
      if (!r.__trawanganConfigChangedAttached) {
        try {
          const unsub = r.onConfigChanged(() => {
            this.emitPersistableChange('rendererConfig');
          });
          if (typeof unsub === 'function') {
            this.configChangedUnsubs.push(unsub);
          }
          r.__trawanganConfigChangedAttached = true;
        } catch (_) {}
      }
    }
  }

  /**
   * Menyelaraskan input warna (upColor, downColor, maColor) pada indikator volume ke warna tema aktif
   * dengan tetap mempertahankan tinggi kustom (heightPct) milik pengguna.
   * @param cell Sel spesifik opsional untuk sinkronisasi lokal
   * @param syncPineIndicators Apakah indikator Pine Script ikut disinkronkan (default: true saat pergantian tema)
   */
  public syncNativeVolumeColors(cell?: any, syncPineIndicators: boolean = true): void {
    const cells = cell ? [cell] : this.getAllCells();
    this.studyManager.syncVolumeColors(cells, undefined, syncPineIndicators);
  }

  // ─── Persistent Price Line Guard Engine ───

  /**
   * Menegakkan garis harga live terkini secara defensif ke seluruh sel aktif
   */
  public enforceCurrentPriceLine(targetCell?: any): void {
    const cells = targetCell ? [targetCell] : this.getAllCells();
    const show = this.showCurrentPriceLine !== false;
    for (const cell of cells) {
      const renderer = cell?.chart?.renderer;
      const native = renderer?.renderer || renderer;
      if (native?.scene) {
        native.scene.showPriceLine = show;
      }
      if (typeof native?.set === 'function') {
        native.set('currentPriceLine', show);
      }
      if (native?.scheduler?.invalidate) {
        native.scheduler.invalidate(4);
      }
    }
  }

  /**
   * Memasang interceptor pada applyConfig native renderer agar patch parsial tidak menimpa showPriceLine
   */
  public interceptApplyConfig(cell: any): void {
    const renderer = cell?.chart?.renderer;
    const native = renderer?.renderer || renderer;
    if (!native || typeof native.applyConfig !== 'function') return;
    if (native.__priceLineInterceptorAttached) return;

    const self = this;
    const originalApplyConfig = native.applyConfig.bind(native);
    native.applyConfig = function (patch: any) {
      if (patch) {
        if (!patch.priceScale) {
          patch.priceScale = {};
        }
        if (patch.priceScale.currentPriceLine === undefined) {
          patch.priceScale.currentPriceLine = self.showCurrentPriceLine !== false;
        }
        if (patch.priceScale.countdown === undefined) {
          patch.priceScale.countdown = self.isPriceScaleCountdownEnabled(cell);
        }
      }
      const res = originalApplyConfig(patch);
      if (this.scene) {
        this.scene.showPriceLine = self.showCurrentPriceLine !== false;
        this.scene.showCountdown = self.isPriceScaleCountdownEnabled(cell);
      }
      return res;
    };
    native.__priceLineInterceptorAttached = true;
  }

  /**
   * Menyetel status visibilitas garis harga live
   */
  public setShowCurrentPriceLine(show: boolean): void {
    this.showCurrentPriceLine = show;
    this.enforceCurrentPriceLine();
    this.notify();
  }

  /**
   * Menerapkan instance wall-clock ke renderer native atau wrapper chart pada satu cell
   */
  private applyWallClockToCell(cell: any, clock: any): void {
    const chart = cell?.chart || cell?.inner;
    const renderer = chart?.renderer;
    const native = resolveNativeRenderer(cell);
    if (typeof native?.setWallClock === 'function') {
      native.setWallClock(clock);
    } else if (typeof renderer?.setWallClock === 'function') {
      renderer.setWallClock(clock);
    } else if (typeof chart?.setWallClock === 'function') {
      chart.setWallClock(clock);
    }
  }

  /**
   * Menyelaraskan state countdown dan wall-clock pada renderer native satu cell
   */
  private syncCountdownRenderer(cell: any, enabled: boolean): void {
    const native = resolveNativeRenderer(cell);
    if (!native) return;

    if (this.wallClock) {
      this.applyWallClockToCell(cell, this.wallClock);
    }
    if (typeof native.applyConfig === 'function') {
      native.applyConfig({ priceScale: { countdown: enabled } });
    }
    if (typeof native.set === 'function') {
      native.set('countdown', enabled);
    }
    if (native.scene) {
      native.scene.showCountdown = enabled;
    }
    if (typeof native.syncCountdownTimer === 'function') {
      native.syncCountdownTimer();
    }
    if (native.scheduler?.invalidate) {
      native.scheduler.invalidate(4);
    }
  }

  /**
   * Menegakkan status countdown pada cell target atau semua cell aktif
   */
  public enforcePriceScaleCountdown(cell?: any): void {
    const cells = cell ? [cell] : this.getAllCells();
    this.withSuppressedPersistEvents(() => {
      for (const c of cells) {
        const enabled = this.isPriceScaleCountdownEnabled(c);
        this.syncCountdownRenderer(c, enabled);
      }
    });
  }

  /**
   * Memeriksa apakah tampilan hitung mundur penutupan lilin (countdown to bar close) aktif
   * pada sumbu skala harga (price scale).
   */
  public isPriceScaleCountdownEnabled(cell?: any): boolean {
    try {
      const targetCell = this.resolveTargetCell(cell);
      if (targetCell && this.priceScaleCountdownByCell.has(targetCell)) {
        return Boolean(this.priceScaleCountdownByCell.get(targetCell));
      }
      const native = resolveNativeRenderer(targetCell);
      if (typeof native?.scene?.showCountdown === 'boolean') {
        return native.scene.showCountdown;
      }
      const cfgCountdown = native?.getConfig?.()?.priceScale?.countdown;
      if (typeof cfgCountdown === 'boolean') {
        return cfgCountdown;
      }
    } catch (err) {
      console.warn('[ChartSessionController] Gagal membaca status countdown:', err);
    }
    return this.priceScaleCountdown;
  }

  /**
   * Menyetel status hitung mundur (countdown to bar close) pada skala harga.
   * Mendukung pembaruan multi-cell dan sinkronisasi otomatis.
   */
  public setPriceScaleCountdown(enabled: boolean, cell?: any): void {
    const boolVal = Boolean(enabled);
    try {
      this.priceScaleCountdown = boolVal;
      const targetCells = cell ? [this.resolveTargetCell(cell)] : this.getAllCells();

      let anyChanged = false;
      for (const targetCell of targetCells) {
        if (!targetCell) continue;
        const current = this.isPriceScaleCountdownEnabled(targetCell);
        this.priceScaleCountdownByCell.set(targetCell, boolVal);
        if (current !== boolVal) {
          anyChanged = true;
        }
        this.withSuppressedPersistEvents(() => {
          this.syncCountdownRenderer(targetCell, boolVal);
        });
      }

      if (anyChanged) {
        this.emitPersistableChange('priceScaleCountdown');
        this.notify();
      }
    } catch (err) {
      console.warn('[ChartSessionController] Gagal menyetel status countdown:', err);
    }
  }

  /**
   * Menghubungkan wall-clock pulse sentral ke renderer chart pada semua cell
   * agar hitung mundur detik tersinkronisasi presisi dan tidak drift.
   */
  public setWallClock(clock: any): void {
    this.wallClock = clock;
    const cells = this.getAllCells();
    for (const cell of cells) {
      this.applyWallClockToCell(cell, clock);
    }
  }

  private syncCellVolumeHiddenState(cell: any, hidden: boolean): void {
    if (!cell) return;
    this.volumeHiddenByCell.set(cell, hidden);
    const typedCell = cell as { volumeHidden?: boolean; chart?: { volumeHidden?: boolean }; inner?: { volumeHidden?: boolean } };
    typedCell.volumeHidden = hidden;
    const chart = typedCell.chart || typedCell.inner;
    if (chart) {
      chart.volumeHidden = hidden;
    }
  }

  /**
   * Menyinkronkan formatter sumbu harga dan visibilitas volume native pada sel indeks makro
   * tanpa mengubah preferensi atau perilaku simbol reguler.
   */
  public syncCellMacroState(cell: any): void {
    if (!cell) return;
    const { providerId, symbol } = getCellMarketIdentity(cell);
    const isMacro = providerId === 'macro' || isMacroIndexSymbol(symbol);
    const mode = isMacro ? resolveMacroAxisMode(symbol) : null;

    syncCellMacroVelaAxis(cell, mode);

    if (mode !== null) {
      if (!this.preMacroVolumeShowByCell.has(cell)) {
        const currentlyHidden =
          this.volumeHiddenByCell.get(cell) ?? Boolean((cell as { volumeHidden?: boolean }).volumeHidden);
        this.preMacroVolumeShowByCell.set(cell, !currentlyHidden && this.showVolume !== false);
      }
      this.applyCellVolumeVisibility(cell, false);
    } else if (this.preMacroVolumeShowByCell.has(cell)) {
      const restoreShow = this.preMacroVolumeShowByCell.get(cell) ?? this.showVolume !== false;
      this.preMacroVolumeShowByCell.delete(cell);
      this.applyCellVolumeVisibility(cell, restoreShow);
    }
  }

  /**
   * Menerapkan status visibilitas volume pasar native WebGL2 pada satu sel tertentu
   */
  public applyCellVolumeVisibility(cell: any, show: boolean): void {
    if (!cell) return;
    const { providerId, symbol } = getCellMarketIdentity(cell);
    const isMacro = providerId === 'macro' || isMacroIndexSymbol(symbol);
    const effectiveShow = isMacro ? false : show;

    this.syncCellVolumeHiddenState(cell, !effectiveShow);
    const chart = cell.chart || cell.inner;
    if (chart) {
      if (typeof chart.indicators === 'function') {
        for (const ind of Array.from(chart.indicators() || []) as any[]) {
          if (ind?.nativeType === 'volume' || ind?.title === 'Volume') {
            try {
              if (typeof ind.setVisible === 'function') ind.setVisible(effectiveShow);
            } catch (_) {}
          }
        }
      }
      try {
        const nativeRenderer = chart.renderer?.renderer || chart.renderer;
        if (typeof nativeRenderer?.set === 'function') {
          nativeRenderer.set('volumeHidden', !effectiveShow);
        }
        if (typeof chart.renderer?.invalidate === 'function') {
          chart.renderer.invalidate(4);
        }
      } catch (_) {}
    }
  }

  /**
   * Menyetel status visibilitas volume pasar native WebGL2.
   * Jika targetCell diberikan dan syncConfig.indicators nonaktif, hanya ubah sel tersebut.
   * Jika syncConfig.indicators aktif (atau layout single '1'), selaraskan ke seluruh sel.
   */
  public setShowVolume(show: boolean, targetCell?: any): void {
    this.showVolume = show;
    const isSyncEnabled = Boolean(this.syncConfig.indicators !== false || this.layout === '1');

    if (!isSyncEnabled && targetCell) {
      this.applyCellVolumeVisibility(targetCell, show);
    } else {
      for (const cell of this.getAllCells()) {
        this.applyCellVolumeVisibility(cell, show);
      }
    }
    this.notify();
  }

  // ─── Indicator Lifecycle & Zombie Guard Engine ───

  /**
   * Menambahkan indikator Pine Script v6 ke seluruh sel aktif dengan deduplikasi bersih
   */
  public async addPineIndicator(
    source: string,
    customTitle?: string,
    savedInputs?: Record<string, any>,
    savedProps?: Record<string, any>
  ): Promise<boolean> {
    if (!this.workspace) return false;
    try {
      const cleanTitle = (customTitle || 'Custom Indicator').trim();
      const targetCells = (this.syncConfig.indicators !== false)
        ? this.getAllCells()
        : (this.workspace.active ? [this.workspace.active] : this.getAllCells());

      const res = await this.studyManager.addStudyToCells(
        targetCells,
        {
          language: 'pine',
          title: cleanTitle,
          source,
          inputs: savedInputs,
          props: savedProps,
        },
        { deduplicate: true }
      );
      return res.ok;
    } catch (err) {
      console.error('[ChartSessionController] addPineIndicator error:', err);
      return false;
    }
  }

  /**
   * Mengaktifkan visibilitas trade markers pada konfigurasi chart atau renderer
   */
  private enableChartTradeVisibility(chartOrCell: any): void {
    if (!chartOrCell) return;
    const chart = chartOrCell.chart || chartOrCell.inner || chartOrCell;
    const renderer = chart?.renderer;

    if (typeof chart?.applyConfig === 'function') {
      try {
        chart.applyConfig({ trades: { visible: true, labels: true, qty: true } });
      } catch (err) {
        console.warn('[ChartSessionController] Gagal mengaktifkan visibilitas trades pada chart:', err);
      }
    } else if (typeof renderer?.applyConfig === 'function') {
      try {
        renderer.applyConfig({ trades: { visible: true, labels: true, qty: true } });
      } catch (err) {
        console.warn('[ChartSessionController] Gagal mengaktifkan visibilitas trades pada renderer:', err);
      }
    }
  }

  /**
   * Menambahkan kemampuan reaktif handle native Vela (handle.update & handle.descriptor)
   */
  private enrichNativeHandle(handle: any, type: string): void {
    if (!handle) return;
    if (typeof handle.update !== 'function') {
      handle.update = (newInputs: Record<string, any>) => {
        if (typeof handle.setInputs === 'function') {
          handle.setInputs(newInputs);
        }
      };
    }
    try {
      const descriptor = getNativeIndicator(type);
      if (descriptor) {
        handle.descriptor = descriptor;
        if (!(descriptor as any).inputs && typeof descriptor.inputsSchema === 'function') {
          try {
            (descriptor as any).inputs = descriptor.inputsSchema();
          } catch (err) {
            console.warn(`[ChartSessionController] Gagal mengekstrak inputsSchema untuk tipe "${type}":`, err);
          }
        }
      }
    } catch (err) {
      console.warn(`[ChartSessionController] Gagal memperkaya native handle untuk tipe "${type}":`, err);
    }
  }

  /**
   * Menambahkan indikator native Vela ke seluruh sel aktif dengan sinkronisasi bersih
   */
  public async addNativeIndicator(
    type: string,
    options?: any,
    customTitle?: string
  ): Promise<boolean> {
    if (!this.workspace) return false;

    try {
      const cleanType = (type || '').trim().replace(/^native:/, '');
      const cleanTitle = (customTitle || cleanType).trim();
      const targetCells = (this.syncConfig.indicators !== false)
        ? this.getAllCells()
        : (this.workspace.active ? [this.workspace.active] : this.getAllCells());

      const res = await this.studyManager.addStudyToCells(
        targetCells,
        {
          language: 'native',
          nativeType: cleanType,
          title: cleanTitle,
          source: cleanType,
          inputs: options?.inputs,
          props: options?.props,
        },
        { deduplicate: false }
      );
      return res.ok;
    } catch (err) {
      console.error('[ChartSessionController] addNativeIndicator error:', err);
      return false;
    }
  }

  /**
   * Menambahkan indikator native Vela ke satu sel tertentu
   */
  public async addNativeIndicatorToCell(
    cell: any,
    type: string,
    options?: any,
    customTitle?: string
  ): Promise<boolean> {
    const chart = cell?.chart || cell?.inner;
    if (!cell || !chart || typeof chart.addNativeIndicator !== 'function') return false;

    try {
      const cleanType = (type || '').trim().replace(/^native:/, '');
      const cleanTitle = (customTitle || cleanType).trim();
      const handle = await this.studyManager.addStudy(
        cell,
        {
          language: 'native',
          nativeType: cleanType,
          title: cleanTitle,
          source: cleanType,
          inputs: options?.inputs,
          props: options?.props,
        },
        { deduplicate: false, register: true }
      );
      return Boolean(handle);
    } catch (err) {
      console.error('[ChartSessionController] addNativeIndicatorToCell error:', err);
      return false;
    }
  }

  /**
   * Menambahkan indikator secara polimorfik (baik native study maupun Pine script)
   */
  public async addIndicator(
    descriptor: UnifiedIndicatorDescriptor | { kind: 'native' | 'pine'; [key: string]: any },
    options?: any
  ): Promise<boolean> {
    if (!descriptor) return false;
    if (descriptor.kind === 'native') {
      const type = descriptor.nativeType || descriptor.id.replace(/^native:/, '');
      return this.addNativeIndicator(type, options, descriptor.title);
    } else {
      const source = descriptor.sourceCode || '';
      return this.addPineIndicator(source, descriptor.title, options?.inputs, options?.props);
    }
  }

  /**
   * Menambahkan indikator secara polimorfik ke satu sel tertentu
   */
  public async addIndicatorToCell(
    descriptor: UnifiedIndicatorDescriptor | { kind: 'native' | 'pine'; [key: string]: any },
    cell?: any,
    options?: any
  ): Promise<boolean> {
    if (!descriptor) return false;
    const targetCell = this.resolveTargetCell(cell);
    if (!targetCell) return false;

    if (descriptor.kind === 'native') {
      const type = descriptor.nativeType || descriptor.id.replace(/^native:/, '');
      return this.addNativeIndicatorToCell(targetCell, type, options, descriptor.title);
    } else {
      const source = descriptor.sourceCode || '';
      return this.addPineIndicatorToCell(
        targetCell,
        source,
        descriptor.title,
        options?.inputs,
        options?.props,
        descriptor.visible ?? true
      );
    }
  }

  /**
   * Menghapus indikator secara tuntas di seluruh sel (mencegah zombie indicator)
   */
  public removeIndicator(id: string): void {
    this.studyManager.removeStudy(id, this.getAllCells(), this.syncConfig.indicators !== false);
  }

  /**
   * Membersihkan seluruh indikator aktif di workspace
   */
  public clearAllIndicators(): void {
    this.pineRuntime.telemetry.clearTelemetry();
    this.pineRuntime.alertBridge.clearHistory();
    this.desiredPaneWeightsByCell = new WeakMap();
    this.lastCapturedPaneLayoutByCell = new WeakMap();
    this.userTouchedPaneLayoutByCell = new WeakSet<any>();
    this.indicatorRegistry.clearAll(() => this.getAllCells());
    this.notifyActiveIndicators();
  }

  /**
   * Mengubah status visibilitas indikator
   */
  public toggleIndicatorVisibility(id: string): void {
    this.studyManager.toggleStudyVisibility(id, this.syncConfig.indicators !== false);
  }

  /**
   * Memperbarui input parameter indikator
   */
  public updateIndicatorInputs(id: string, inputs: Record<string, any>): boolean {
    return this.studyManager.updateStudyInputs(id, inputs);
  }

  /**
   * Mengambil skema input untuk indikator tertentu
   */
  public getIndicatorInputSchema(idOrType: string): any[] {
    return this.studyManager.getInputSchema(idOrType);
  }

  /**
   * Mengambil input tersimpan atau live untuk indikator tertentu
   */
  public getIndicatorInputs(idOrType: string): Record<string, any> {
    return this.studyManager.getInputs(idOrType);
  }

  /**
   * Membuka dialog pengaturan indikator (programmatic twin dari ikon gear legend)
   */
  public openIndicatorSettings(id: string, cell?: any): boolean {
    const targetCell = this.resolveTargetCell(cell);
    const chart = targetCell?.chart || targetCell?.inner;
    if (chart && typeof chart.openIndicatorSettings === 'function') {
      try {
        chart.openIndicatorSettings(id);
        return true;
      } catch (err) {
        console.warn(`[ChartSessionController] openIndicatorSettings(${id}) error:`, err);
      }
    }
    return false;
  }

  /**
   * Mengekstrak daftar indikator Pine/custom yang benar-benar terpasang pada satu cell spesifik tanpa melakukan pruning registry global.
   */
  private extractCellIndicators(cell: any, includeNative: boolean = false): ActiveIndicatorInfo[] {
    const chart = cell?.chart || cell?.inner;
    if (!chart || typeof chart.indicators !== 'function') {
      return [];
    }

    const result: ActiveIndicatorInfo[] = [];
    for (const ind of Array.from(chart.indicators() || []) as any[]) {
      if (!ind) continue;
      if (!includeNative && ind.nativeType) continue;
      if (includeNative && ind.nativeType === 'volume' && !this.indicatorRegistry.findEntry(ind.id || ind.title)) continue;
      const matched = this.indicatorRegistry.findEntry(ind.id || ind.title);
      const reg = matched?.entry;

      let liveInputs: Record<string, any> | undefined;
      try {
        if (typeof ind.inputValues === 'function') {
          const vals = ind.inputValues();
          if (vals && Object.keys(vals).length > 0) liveInputs = vals;
        } else if (ind.inputs && typeof ind.inputs === 'object' && Object.keys(ind.inputs).length > 0) {
          liveInputs = { ...ind.inputs };
        }
      } catch (err) {
        console.warn(`[ChartSessionController] Gagal membaca liveInputs indikator ${ind.id || ind.title}:`, err);
      }

      let liveProps: Record<string, any> | undefined;
      try {
        if (typeof ind.propValues === 'function') {
          const pvals = ind.propValues();
          if (pvals && Object.keys(pvals).length > 0) liveProps = pvals;
        } else if (ind.props && typeof ind.props === 'object' && Object.keys(ind.props).length > 0) {
          liveProps = { ...ind.props };
        }
      } catch (err) {
        console.warn(`[ChartSessionController] Gagal membaca liveProps indikator ${ind.id || ind.title}:`, err);
      }

      const mergedInputs =
        liveInputs || reg?.inputs ? { ...(reg?.inputs || {}), ...(liveInputs || {}) } : undefined;
      const mergedProps =
        liveProps || reg?.props ? { ...(reg?.props || {}), ...(liveProps || {}) } : undefined;

      result.push({
        id: ind.id || reg?.id || ind.title || 'indicator',
        title: ind.title || reg?.title || 'Indicator',
        source: ind.source || reg?.source,
        visible: ind.visible !== undefined ? Boolean(ind.visible) : (reg?.visible ?? true),
        ...(mergedInputs && Object.keys(mergedInputs).length > 0 ? { inputs: mergedInputs } : {}),
        ...(mergedProps && Object.keys(mergedProps).length > 0 ? { props: mergedProps } : {}),
      });
    }
    return result;
  }

  /**
   * Mengambil snapshot indikator non-native milik satu sel tertentu untuk persistensi multi-chart.
   */
  public getCellIndicators(cell?: any): SavedWorkspaceIndicator[] {
    const targetCell = this.resolveTargetCell(cell);
    return this.extractCellIndicators(targetCell, false).map((i) => ({
      title: i.title,
      source: i.source,
      visible: i.visible,
      ...(i.inputs ? { inputs: i.inputs } : {}),
      ...(i.props ? { props: i.props } : {}),
    }));
  }

  /**
   * Menambahkan indikator Pine Script khusus ke satu sel target (digunakan saat restorasi per-sel ketika syncConfig.indicators nonaktif).
   */
  public async addPineIndicatorToCell(
    cell: any,
    source: string,
    customTitle?: string,
    savedInputs?: Record<string, any>,
    savedProps?: Record<string, any>,
    visible: boolean = true
  ): Promise<boolean> {
    const chart = cell?.chart || cell?.inner;
    if (!cell || !chart || typeof chart.addIndicator !== 'function') return false;

    try {
      const cleanTitle = (customTitle || 'Custom Indicator').trim();
      const handle = await this.studyManager.addStudy(
        cell,
        {
          language: 'pine',
          title: cleanTitle,
          source,
          inputs: savedInputs,
          props: savedProps,
          visible,
        },
        { deduplicate: true, register: true }
      );
      return Boolean(handle);
    } catch (err) {
      console.error('[ChartSessionController] addPineIndicatorToCell error:', err);
      return false;
    }
  }

  /**
   * Mengambil daftar indikator aktif di chart
   */
  public getActiveIndicators(): ActiveIndicatorInfo[] {
    if (this.syncConfig.indicators === false && this.workspace?.active) {
      return this.extractCellIndicators(this.workspace.active, true);
    }
    return this.indicatorRegistry.getActiveIndicators(
      this.workspace?.active?.chart,
      () => this.getAllCells()
    );
  }

  /**
   * Mengambil kode sumber Pine Script dari indikator terdaftar
   */
  public getIndicatorSource(id: string): string | undefined {
    return this.indicatorRegistry.getSource(id);
  }

  /**
   * Menangani event penghapusan dari engine Vela native
   */
  public handleIndicatorRemoved(removedId?: string): void {
    if (removedId) {
      this.pineRuntime.handleIndicatorRemoved(removedId, this.getAllCells());
    }
    this.indicatorRegistry.handleRemovedEvent(
      removedId,
      this.syncConfig.indicators !== false,
      () => this.getAllCells()
    );
    this.notifyActiveIndicators();
  }

  private notifyActiveIndicators(): void {
    const active = this.getActiveIndicators();
    if (this.onActiveIndicatorsChange) {
      try {
        this.onActiveIndicatorsChange(active);
      } catch (e) {
        console.error('[ChartSessionController] onActiveIndicatorsChange error:', e);
      }
    }
    this.notify();
  }

  // ─── Navigation, Simbol & Timeframe ───

  /**
   * Mengubah simbol atau bursa aktif secara reaktif
   */
  public async setSymbol(symbol: string, timeframe?: Timeframe, providerId?: string): Promise<void> {
    if (!symbol) return;
    this.symbol = symbol;
    if (providerId) this.providerId = providerId;
    marketSessionService.updateContext(this.symbol, this.providerId);
    marketSessionService.setSessionAvailable(this.isSessionAvailable());
    this.resetActiveRangePreset();

    if (this.workspace) {
      try {
        this.customHydrationEpoch++;
        let regStatus = this.ensureVelaProviderRegistered(this.providerId);
        if (!regStatus.registered) {
          await this.hydrateAndRegisterCustomProviders();
          regStatus = this.ensureVelaProviderRegistered(this.providerId);
        }
        const targetSym = resolveVelaSymbol(this.symbol, this.providerId);
        if (this.syncConfig.symbol) {
          for (const cell of this.getAllCells()) {
            if ((regStatus.replaced || cell.symbol !== targetSym) && typeof cell.setSymbol === 'function') {
              cell.setSymbol(targetSym);
            }
            this.syncCellMacroState(cell);
            this.applySessionRendererState(cell);
          }
        } else if (
          this.workspace.active &&
          (regStatus.replaced || this.workspace.active.symbol !== targetSym) &&
          typeof this.workspace.active.setSymbol === 'function'
        ) {
          this.workspace.active.setSymbol(targetSym);
          this.syncCellMacroState(this.workspace.active);
          this.applySessionRendererState(this.workspace.active);
        } else if (this.workspace.active) {
          this.syncCellMacroState(this.workspace.active);
          this.applySessionRendererState(this.workspace.active);
        }

        // Pulihkan gambar spesifik untuk simbol dan provider target secara terisolasi (kecuali saat restorasi atau baru diganti oleh activeCell)
        const currentIdentityKey = `${(this.providerId || 'binance').toLowerCase()}:${this.symbol.toUpperCase()}`;
        if (!this.isRestoringWorkspace) {
          if (this.suppressAutoDrawingRestoreKey === currentIdentityKey) {
            this.suppressAutoDrawingRestoreKey = null;
          } else {
            this.suppressAutoDrawingRestoreKey = null;
            chartDrawingController.restoreDrawings(this.symbol, this.timeframe, this.providerId).catch(() => {});
          }
        }

        // Segarkan penanda waktu timeline marks untuk simbol dan provider baru
        this.timelineMarksController.syncForMarket(this.symbol, this.providerId);
      } catch (err) {
        console.warn('[ChartSessionController] setSymbol error:', err);
      }
    }

    if (timeframe) {
      this.setTimeframe(timeframe);
    } else {
      this.notify();
    }
  }

  /**
   * Mengubah timeframe aktif
   */
  public setTimeframe(timeframe: Timeframe): void {
    if (!timeframe) return;
    this.timeframe = timeframe;
    this.resetActiveRangePreset();

    if (this.workspace) {
      try {
        const velaTf = toVelaTimeframe(timeframe);
        if (this.syncConfig.timeframe) {
          for (const cell of this.getAllCells()) {
            if (cell.timeframe !== velaTf && typeof cell.setTimeframe === 'function') {
              cell.setTimeframe(velaTf);
            }
          }
        } else if (this.workspace.active && typeof this.workspace.active.setTimeframe === 'function') {
          this.workspace.active.setTimeframe(velaTf);
        }
      } catch (err) {
        console.warn('[ChartSessionController] setTimeframe error:', err);
      }
    }

    this.notify();
  }

  /**
   * Mengubah preferensi zona waktu (misal: 'Asia/Jakarta' UTC+7)
   */
  public setTimezone(timezone: string): void {
    if (!timezone) return;
    this.timezone = timezone;

    if (this.workspace) {
      try {
        for (const cell of this.getAllCells()) {
          const renderer = cell?.chart?.renderer;
          const native = renderer?.renderer || renderer;
          if (typeof native?.set === 'function') {
            native.set('timezone', timezone);
          }
          if (native?.coords) {
            native.coords.timezone = timezone;
          }
          native?.scheduler?.invalidate?.(4);
        }
      } catch (err) {
        console.warn('[ChartSessionController] setTimezone error:', err);
      }
    }

    this.notify();
  }

  private resolveActiveThemeVisualState() {
    const cfg = resolveThemeConfig(this.themePreset);
    const isCustomPaletteActive = Boolean(this.customPalette && this.customPalette.enabled !== false);
    const cp = this.customPalette;

    const effectiveUp = isCustomPaletteActive && cp?.candles?.bullBody
      ? cp.candles.bullBody
      : this.customCandleColors?.bullColor || cfg.chart.upColor;

    const effectiveDown = isCustomPaletteActive && cp?.candles?.bearBody
      ? cp.candles.bearBody
      : this.customCandleColors?.bearColor || cfg.chart.downColor;

    const effectiveWickUp = isCustomPaletteActive && cp?.candles?.bullWick
      ? cp.candles.bullWick
      : this.customCandleColors?.bullColor || cfg.chart.wickUpColor || cfg.chart.upColor;

    const effectiveWickDown = isCustomPaletteActive && cp?.candles?.bearWick
      ? cp.candles.bearWick
      : this.customCandleColors?.bearColor || cfg.chart.wickDownColor || cfg.chart.downColor;

    const effectiveBorderUp = isCustomPaletteActive && cp?.candles?.bullBorder
      ? cp.candles.bullBorder
      : this.customCandleColors?.bullColor
        ? deriveBorderColor(this.customCandleColors.bullColor, 0.15)
        : cfg.chart.borderUpColor || cfg.chart.upColor;

    const effectiveBorderDown = isCustomPaletteActive && cp?.candles?.bearBorder
      ? cp.candles.bearBorder
      : this.customCandleColors?.bearColor
        ? deriveBorderColor(this.customCandleColors.bearColor, 0.15)
        : cfg.chart.borderDownColor || cfg.chart.downColor;

    const candleColors: ActiveThemeCandleColors = {
      upColor: effectiveUp,
      downColor: effectiveDown,
      borderUpColor: effectiveBorderUp,
      borderDownColor: effectiveBorderDown,
      wickUpColor: effectiveWickUp,
      wickDownColor: effectiveWickDown,
    };

    const { background: effectiveBg, textColor: effectiveText, isDark: dark } = resolveEffectiveThemeColors(this.themePreset, this.customPalette);
    const effectiveGrid = this.resolveEffectiveGridColor(effectiveText, dark);
    const effectiveBorder = dark ? withAlpha(effectiveText, 0.14) : withAlpha(effectiveText, 0.18);
    const effectiveCrosshair = dark ? withAlpha(effectiveText, 0.45) : withAlpha(effectiveText, 0.55);
    const isCustomBg = this.customChartBackground?.mode === 'solid' || this.customChartBackground?.mode === 'gradient';

    const globalRendererPatch = {
      layout: {
        background: isCustomBg ? 'transparent' : effectiveBg,
        textColor: effectiveText,
        borderColor: effectiveBorder,
      },
      grid: {
        vertLines: { visible: this.gridMode !== 'hidden', color: effectiveGrid },
        horzLines: { visible: this.gridMode !== 'hidden', color: effectiveGrid },
      },
      crosshair: {
        color: effectiveCrosshair,
        labelBackground: effectiveText,
      },
      panes: {
        separatorColor: effectiveBorder,
      },
      priceScale: {
        borderColor: effectiveBorder,
        currentPriceLine: this.showCurrentPriceLine !== false,
        countdown: this.isPriceScaleCountdownEnabled(),
      },
      timeScale: {
        timezone: this.timezone,
      },
    };

    return {
      candleColors,
      effectiveBg,
      effectiveText,
      effectiveGrid,
      effectiveBorder,
      effectiveCrosshair,
      isCustomBg,
      themeObj: {
        background: isCustomBg ? 'transparent' : effectiveBg,
        surfaceBackground: effectiveBg,
        textColor: effectiveText,
        gridColor: effectiveGrid,
        borderColor: effectiveBorder,
        crosshair: effectiveCrosshair,
        crosshairColor: effectiveCrosshair,
        upColor: effectiveUp,
        downColor: effectiveDown,
        fontSize: Math.max(9, Math.min(32, Math.round(this.fontSize))),
        fontFamily: "var(--font-sans, 'Plus Jakarta Sans', sans-serif)",
      },
      globalRendererPatch,
    };
  }

  private resolveActiveThemeCandleColors(): ActiveThemeCandleColors {
    return this.resolveActiveThemeVisualState().candleColors;
  }

  /**
   * Menyinkronkan domain visual global (tema background/teks, gridMode, timezone, currentPriceLine)
   * tanpa menimpa override gaya candle/margin spesifik sel (K3).
   */
  public syncGlobalVisualChromeToCells(targetCell?: any): void {
    if (!this.workspace) return;
    const visual = this.resolveActiveThemeVisualState();
    const cells = targetCell ? [targetCell] : this.getAllCells();
    this.withSuppressedPersistEvents(() => {
      for (const cell of cells) {
        const chart = cell?.chart || cell?.inner;
        const r = chart?.renderer?.renderer || chart?.renderer;
        if (r) {
          if (typeof r.applyConfig === 'function') {
            try { r.applyConfig(cloneRendererConfigValue(visual.globalRendererPatch)); } catch (_) {}
          }
          if (r.scene) {
            r.scene.background = visual.isCustomBg ? 'transparent' : visual.effectiveBg;
            r.scene.textColor = visual.effectiveText;
            r.scene.borderColor = visual.effectiveBorder;
            r.scene.gridColor = visual.effectiveGrid;
          }
          if (typeof r.set === 'function') {
            try { r.set('timezone', this.timezone); } catch (_) {}
          }
          if (r.coords) {
            r.coords.timezone = this.timezone;
          }
          r.scheduler?.invalidate?.(7);
        }
        this.enforceCurrentPriceLine(cell);
      }
    });
    this.applyBackground();
  }

  /**
   * Menyelaraskan tema visual kanvas WebGL2 dan warna candlestick (bawaan tema maupun kustom)
   */
  public setTheme(
    preset: ThemePresetId | string,
    fontSize?: number,
    customCandleColors?: { bullColor?: string; bearColor?: string },
    customBackground?: CustomChartBackgroundConfig,
    customPalette?: CustomThemePalette | null
  ): void {
    this.themePreset = preset;
    if (fontSize) this.fontSize = fontSize;
    if (customCandleColors !== undefined) {
      this.customCandleColors = customCandleColors;
    }
    this.customPalette = customPalette !== undefined ? customPalette : null;
    if (customBackground !== undefined) {
      this.customChartBackground = customBackground;
    }
    this.applyBackground();

    if (this.workspace) {
      const visual = this.resolveActiveThemeVisualState();
      this.lastAppliedThemeColors = visual.candleColors;

      // Bangun patch konfigurasi warna candles dan bars untuk WebGL2 Renderer (tanpa menimpa flag visibilitas lokal body/border/wick)
      const candleConfig = {
        candles: {
          upColor: visual.candleColors.upColor,
          downColor: visual.candleColors.downColor,
          borderUpColor: visual.candleColors.borderUpColor,
          borderDownColor: visual.candleColors.borderDownColor,
          wickUpColor: visual.candleColors.wickUpColor,
          wickDownColor: visual.candleColors.wickDownColor,
        },
        bars: {
          upColor: visual.candleColors.upColor,
          downColor: visual.candleColors.downColor,
        },
        grid: visual.globalRendererPatch.grid,
      };

      // Terapkan ke seluruh sel grafik aktif tanpa memicu dirty event tema global ke workspace
      this.withSuppressedPersistEvents(() => {
        try {
          if (typeof this.workspace.setTheme === 'function') {
            this.workspace.setTheme(visual.themeObj);
          }
        } catch (err) {
          console.warn('[ChartSessionController] setTheme error:', err);
        }

        try {
          for (const cell of this.getAllCells()) {
            const chart = cell?.chart || cell?.inner;
            if (chart && typeof chart.setTheme === 'function') {
              try { chart.setTheme(visual.themeObj); } catch (_) {}
            }
            if (chart && typeof chart.setSurfaceBackground === 'function') {
              try { chart.setSurfaceBackground(visual.effectiveBg); } catch (_) {}
            }
            const r = chart?.renderer?.renderer || chart?.renderer;
            if (r) {
              if (typeof r.setTheme === 'function') {
                try { r.setTheme(visual.themeObj); } catch (_) {}
              }
              if (typeof r.applyConfig === 'function') {
                r.applyConfig({
                  ...candleConfig,
                  layout: visual.globalRendererPatch.layout,
                  crosshair: {
                    color: visual.effectiveCrosshair,
                  },
                });
              }
              if (r.scene) {
                r.scene.background = visual.isCustomBg ? 'transparent' : visual.effectiveBg;
                r.scene.textColor = visual.effectiveText;
                r.scene.borderColor = visual.effectiveBorder;
                r.scene.gridColor = visual.effectiveGrid;
              }
              r.scheduler?.invalidate?.(7);
            }
          }
          this.syncNativeVolumeColors();
        } catch (err) {
          console.warn('[ChartSessionController] applyConfig candleStyle error:', err);
        }
      });

      // Perbarui activeChartDefaultConfig agar layout multi-chart berikutnya mewarisi konfigurasi lilin ini
      if (this.activeChartDefaultConfig) {
        this.activeChartDefaultConfig = {
          ...this.activeChartDefaultConfig,
          ...candleConfig,
        };
      } else {
        this.activeChartDefaultConfig = candleConfig;
      }
    }

    // Pastikan latar belakang dan transparansi wrapper internal Vela tetap terjaga setelah workspace.setTheme selesai
    this.applyBackground();

    this.notify();
  }

  /**
   * Menerapkan latar belakang kanvas kustom ke elemen container/wrapper grafik (#128)
   */
  public applyBackground(): void {
    if (!this.container) return;
    const cfg = resolveThemeConfig(this.themePreset);
    const custom = this.customChartBackground;
    const isCustom = custom?.mode === 'solid' || custom?.mode === 'gradient';

    let backgroundValue = cfg.chart.background;
    if (custom?.mode === 'gradient') {
      const top = custom.gradientTop || '#0F0F0F';
      const bottom = custom.gradientBottom || '#181A20';
      backgroundValue = `linear-gradient(180deg, ${top}, ${bottom})`;
    } else if (custom?.mode === 'solid') {
      backgroundValue = custom.solidColor || '#0F0F0F';
    } else {
      backgroundValue = cfg.chart.background;
    }

    // Hitung warna latar belakang, teks, dan mode gelap efektif untuk grafik
    const {
      background: chartBg,
      textColor: chartText,
      isDark: chartIsDark
    } = resolveEffectiveThemeColors(
      this.themePreset,
      this.customPalette
    );
    const effectiveChartBg = isCustom
      ? (custom?.mode === 'solid' ? (custom.solidColor || '#0F0F0F') : '#0F0F0F')
      : chartBg;

    // Setel latar belakang dan isolasi penuh seluruh 26 token CSS Vela lokal (--vela-*) pada container grafik
    if (this.container.style) {
      this.container.style.background = backgroundValue;
      if (typeof this.container.style.setProperty === 'function') {
        const velaTokens = generateVelaThemeTokens(
          effectiveChartBg,
          chartText,
          chartIsDark ? withAlpha(chartText, 0.14) : withAlpha(chartText, 0.18)
        );
        for (const [tokenKey, tokenVal] of Object.entries(velaTokens)) {
          this.container.style.setProperty(tokenKey, tokenVal);
        }
      }
    }

    // Paksa seluruh elemen wrapper internal Vela menjadi transparan agar tidak menutupi kanvas WebGL2
    const forceTransparent = (el: Element) => {
      if (typeof (el as any)?.style?.setProperty === 'function') {
        (el as HTMLElement).style.setProperty('background', 'transparent', 'important');
      } else if ((el as HTMLElement)?.style) {
        (el as HTMLElement).style.background = 'transparent';
      }
    };

    try {
      if (typeof this.container.querySelectorAll === 'function') {
        const internalWrappers = this.container.querySelectorAll(
          '.vela-container, .vela-container > div, [data-vela-wrapper], .vela-plot'
        );
        internalWrappers.forEach(forceTransparent);
      }
      if (this.container.children) {
        for (const child of Array.from(this.container.children)) {
          forceTransparent(child);
        }
      }
    } catch (_) {}
  }

  /**
   * Mengatur konfigurasi latar belakang kustom kanvas grafik secara dinamis (#128)
   */
  public setCustomChartBackground(bg?: CustomChartBackgroundConfig): void {
    this.customChartBackground = bg;
    this.applyBackground();
    if (this.workspace) {
      this.setTheme(this.themePreset, this.fontSize, this.customCandleColors ?? undefined, bg);
    }
    this.notify();
  }

  /**
   * Mengubah tata letak grid multi-chart (1, 2, 2h, 4)
   * Mengkloning indikator ke cell baru atau menyelaraskan single cell saat kembali ke 1 chart
   */
  public setLayout(layout: string): void {
    if (!layout) return;
    this.layout = layout;

    if (this.workspace && typeof this.workspace.setLayout === 'function') {
      this.isApplyingLayout = true;
      try {
        const restoring = this.isRestoringWorkspace;
        const activeSnapshot = restoring ? [] : this.getActiveIndicators();
        this.workspace.setLayout(layout as any);

        const activeCell = this.workspace.active;
        const curRange = restoring ? null : activeCell?.chart?.getVisibleRange?.();
        const targetSym = resolveVelaSymbol(this.symbol, this.providerId);

        for (const cell of this.getAllCells()) {
          this.attachCellListeners(cell);
          if (!restoring && cell !== activeCell) {
            if (this.syncConfig.symbol && cell.symbol !== targetSym && typeof cell.setSymbol === 'function') {
              cell.setSymbol(targetSym);
            }
            if (this.syncConfig.viewport && curRange && typeof cell.chart?.setVisibleRange === 'function') {
              cell.chart.setVisibleRange(curRange);
            }
          }
        }

        if (!restoring) {
          applyLayoutTimeframePolicy({
            activeCell,
            cells: this.getAllCells(),
            defaultTimeframe: this.defaultTimeframe || '15m',
            syncTimeframe: Boolean(this.syncConfig.timeframe),
          });

          if (layout === '1') {
            this.ensureSingleCellMatchesSnapshot(activeSnapshot);
          } else {
            this.cloneIndicatorsToCells(activeSnapshot);
          }
        }

        if (this.workspace.sync && typeof this.workspace.sync.set === 'function') {
          this.workspace.sync.set('crosshair', Boolean(this.syncConfig.crosshair));
          this.workspace.sync.set('viewport', Boolean(this.syncConfig.viewport ?? true));
          this.workspace.sync.set('drawings', Boolean(this.syncConfig.drawings));
          this.workspace.sync.set('symbol', Boolean(this.syncConfig.symbol));
          this.workspace.sync.set('style', Boolean(this.syncConfig.style));
        }

        for (const cell of this.getAllCells()) {
          this.enforceCurrentPriceLine(cell);
        }

        if (!restoring && this.activeChartDefaultConfig) {
          for (const cell of this.getAllCells()) {
            const r = cell?.chart?.renderer?.renderer || cell?.chart?.renderer;
            if (r && typeof r.applyConfig === 'function') {
              r.applyConfig(this.activeChartDefaultConfig);
            }
          }
        }
      } catch (err) {
        console.warn('[ChartSessionController] setLayout error:', err);
      } finally {
        if (this.isRestoringWorkspace) {
          this.isApplyingLayout = false;
        } else {
          this.scheduleManagedTimeout(() => {
            this.isApplyingLayout = false;
          }, 60);
        }
      }
    }

    this.notify();
  }

  /**
   * Mengatur dan menyelaraskan konfigurasi multi-chart synchronization
   */
  public syncLayout(config: Partial<MultiChartSyncConfig>): void {
    this.syncConfig = { ...this.syncConfig, ...config };

    if (this.workspace?.sync && typeof this.workspace.sync.set === 'function') {
      try {
        this.workspace.sync.set('crosshair', Boolean(this.syncConfig.crosshair));
        this.workspace.sync.set('viewport', Boolean(this.syncConfig.viewport ?? true));
        this.workspace.sync.set('drawings', Boolean(this.syncConfig.drawings));
        this.workspace.sync.set('symbol', Boolean(this.syncConfig.symbol));
        this.workspace.sync.set('style', Boolean(this.syncConfig.style));

        const activeCell = this.workspace.active;

        if (this.syncConfig.symbol && this.symbol) {
          const targetSym = resolveVelaSymbol(this.symbol, this.providerId);
          for (const cell of this.getAllCells()) {
            if (cell !== activeCell && cell.symbol !== targetSym && typeof cell.setSymbol === 'function') {
              cell.setSymbol(targetSym);
            }
          }
        }

        if (this.syncConfig.style) {
          const activeStyle = this.getPriceStyle(activeCell);
          for (const cell of this.getAllCells()) {
            if (cell !== activeCell && this.getPriceStyle(cell) !== activeStyle) {
              this.setPriceStyle(activeStyle, cell);
            }
          }
        }

        if (this.syncConfig.viewport) {
          const curRange = activeCell?.chart?.getVisibleRange?.();
          if (curRange) {
            for (const cell of this.getAllCells()) {
              if (cell !== activeCell && typeof cell.chart?.setVisibleRange === 'function') {
                cell.chart.setVisibleRange(curRange);
              }
            }
          }
        }

        if (this.syncConfig.indicators) {
          this.syncIndicatorsFromActiveCell();
        }
      } catch (err) {
        console.warn('[ChartSessionController] syncLayout error:', err);
      }
    }

    this.notify();
  }

  /**
   * Memasang boundary guard pada workspace untuk mencegah kebocoran gambar antar bursa
   */
  public attachDrawingSyncBoundaryGuard(ws?: any): void {
    attachDrawingSyncBoundaryGuard(ws || this.workspace);
  }

  /**
   * Memeriksa apakah dua cell memenuhi batas kesetaraan bursa untuk sinkronisasi drawing
   */
  public isDrawingSyncEligible(sourceCell: any, targetCell: any): boolean {
    return isDrawingSyncEligible(sourceCell, targetCell);
  }

  /**
   * Mengkloning daftar indikator aktif (Pine maupun Native seperti VPVR) ke seluruh cell workspace yang belum memilikinya
   */
  public cloneIndicatorsToCells(snapshot: ActiveIndicatorInfo[]): void {
    if (!this.workspace || !snapshot || snapshot.length === 0) return;
    try {
      this.studyManager.cloneStudiesToCells(snapshot, this.getAllCells());
    } catch (err) {
      console.warn('[ChartSessionController] Gagal clone indicators ke cells:', err);
    }
  }

  /**
   * Menjamin saat berpindah kembali ke layout 1 chart, cell tunggal memuat indikator cell aktif
   */
  public ensureSingleCellMatchesSnapshot(snapshot: ActiveIndicatorInfo[]): void {
    if (!this.workspace) return;
    try {
      const activeCell = this.workspace.active || this.getAllCells()[0];
      const chart = activeCell?.chart || activeCell?.inner;
      if (!chart || typeof chart.indicators !== 'function') return;

      const existingNative = Array.from(chart.indicators() || []);
      const snapshotTitles = new Set(snapshot.map((i) => i.title));

      for (const h of existingNative as any[]) {
        if (h?.nativeType === 'volume') continue;
        if (h?.title && !snapshotTitles.has(h.title)) {
          try {
            if (typeof h?.remove === 'function') h.remove();
          } catch (_) {}
        }
      }

      this.cloneIndicatorsToCells(snapshot);
    } catch (err) {
      console.warn('[ChartSessionController] Gagal revert ke layout 1:', err);
    }
  }

  /**
   * Menyelaraskan seluruh cell agar mengikuti indikator dari cell aktif
   */
  public syncIndicatorsFromActiveCell(): void {
    if (!this.workspace || !this.workspace.active) return;
    try {
      const activeCell = this.workspace.active;
      const activeSnapshot = this.getActiveIndicators();

      const cells = this.getAllCells();
      for (const cell of cells) {
        if (cell === activeCell) continue;
        const chart = cell?.chart || cell?.inner;
        if (!cell || !chart || typeof chart.indicators !== 'function') continue;

        const currentIndicators = Array.from(chart.indicators() || []);
        for (const ind of currentIndicators as any[]) {
          if (ind?.nativeType === 'volume') continue;
          try {
            if (typeof ind?.remove === 'function') ind.remove();
          } catch (_) {}
        }
      }

      this.cloneIndicatorsToCells(activeSnapshot);

      // Selaraskan juga status volume native dari activeCell ke follower cells
      const activeVolumeHidden =
        this.volumeHiddenByCell.get(activeCell) ??
        Boolean((activeCell as { volumeHidden?: boolean }).volumeHidden);
      for (const cell of cells) {
        if (cell === activeCell) continue;
        this.applyCellVolumeVisibility(cell, !activeVolumeHidden);
      }
    } catch (err) {
      console.warn('[ChartSessionController] Gagal rekonsiliasi indikator dari active cell:', err);
    }
  }

  /**
   * Membaca daftar indikator native Vela (misal volume, vpvr) lengkap dengan input, visibilitas, dan penempatan pane.
   */
  public getNativeIndicators(cell?: any): NativeIndicatorSnapshot[] {
    try {
      const targetCell = this.resolveTargetCell(cell);
      const chart = targetCell?.chart || targetCell?.inner;

      if (!chart || typeof chart.indicators !== 'function') {
        const regEntries = this.indicatorRegistry.getNativeEntries();
        return regEntries.map((reg) => ({
          type: reg.source || reg.title,
          ...(reg.inputs ? { inputs: reg.inputs } : {}),
          visible: reg.visible ?? true,
          placement: 'overlay' as const,
        }));
      }

      const placementById = new Map<string, 'overlay' | 'own-pane'>();
      if (chart.panes && typeof chart.panes.list === 'function') {
        try {
          for (const p of chart.panes.list() || []) {
            const isOverlay = p?.kind === 'price' || p?.id === 'price';
            for (const item of p?.indicators || []) {
              if (item?.id) {
                placementById.set(item.id, isOverlay ? 'overlay' : 'own-pane');
              }
            }
          }
        } catch (_) {}
      }

      const list: NativeIndicatorSnapshot[] = [];
      for (const ind of Array.from(chart.indicators() || []) as any[]) {
        if (typeof ind?.nativeType !== 'string' || !ind.nativeType) continue;
        let inputs: Record<string, unknown> | undefined;
        if (typeof ind.inputValues === 'function') {
          try {
            const raw = ind.inputValues();
            if (raw && typeof raw === 'object') {
              inputs = { ...raw };
            }
          } catch (_) {}
        }
        const regEntry = this.indicatorRegistry.findEntry(ind.id)?.entry;
        const mergedInputs = {
          ...(regEntry?.inputs || {}),
          ...(inputs || {}),
        };

        const visible = ind.visible !== undefined ? Boolean(ind.visible) : true;
        const placement: 'overlay' | 'own-pane' =
          placementById.get(ind.id) ??
          ((ind as any).paneId && (ind as any).paneId !== 'price' ? 'own-pane' : 'overlay');

        list.push({
          type: ind.nativeType,
          ...(Object.keys(mergedInputs).length > 0 ? { inputs: mergedInputs } : {}),
          visible,
          placement,
        });
      }

      if (list.length === 0) {
        const regEntries = this.indicatorRegistry.getNativeEntries();
        for (const reg of regEntries) {
          list.push({
            type: reg.source || reg.title,
            ...(reg.inputs ? { inputs: reg.inputs } : {}),
            visible: reg.visible ?? true,
            placement: 'overlay',
          });
        }
      }

      return list;
    } catch (err) {
      console.warn('[ChartSessionController] Gagal membaca nativeIndicators:', err);
      return [];
    }
  }

  /**
   * Memulihkan konfigurasi indikator native Vela (inputs seperti heightPct, visibility, dan placement overlay/own-pane).
   */
  public async applyNativeIndicators(entries: NativeIndicatorSnapshot[], cell?: any): Promise<void> {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const targetCell = this.resolveTargetCell(cell);
    const chart = targetCell?.chart || targetCell?.inner;
    if (!chart) return;

    const findNativeHandle = (type: string): any => {
      if (typeof chart.indicators !== 'function') return null;
      return Array.from(chart.indicators() || []).find((ind: any) => ind?.nativeType === type) || null;
    };

    const isHandleInPaneList = (handleId: string): boolean => {
      if (!chart.panes || typeof chart.panes.list !== 'function') return true;
      try {
        for (const p of chart.panes.list() || []) {
          if ((p?.indicators || []).some((it: any) => it?.id === handleId)) {
            return true;
          }
        }
      } catch (_) {}
      return false;
    };

    const getHandlePlacement = (handle: any): 'overlay' | 'own-pane' => {
      if (chart.panes && typeof chart.panes.list === 'function') {
        try {
          for (const p of chart.panes.list() || []) {
            if ((p?.indicators || []).some((it: any) => it?.id === handle?.id)) {
              return p?.kind === 'price' || p?.id === 'price' ? 'overlay' : 'own-pane';
            }
          }
        } catch (_) {}
      }
      return (handle as any)?.paneId && (handle as any).paneId !== 'price' ? 'own-pane' : 'overlay';
    };

    let hasVolumeEntry = false;
    for (const entry of entries) {
      if (!entry?.type) continue;
      const cleanType = (entry.type || '').trim().replace(/^native:/, '');
      if (cleanType === 'volume') {
        hasVolumeEntry = true;
        const { upColor: effectiveUp, downColor: effectiveDown } =
          resolveEffectiveVolumeColors(this.themePreset, this.customPalette || undefined, this.customCandleColors || undefined);
        const currentInputs = (entry.inputs || {}) as Record<string, any>;
        const upStr = typeof currentInputs.upColor === 'string' ? currentInputs.upColor.toLowerCase() : '';
        const downStr = typeof currentInputs.downColor === 'string' ? currentInputs.downColor.toLowerCase() : '';
        const isVelaDefaultUp = !upStr || upStr === '#26a69a';
        const isVelaDefaultDown = !downStr || downStr === '#ef5350';
        entry.inputs = {
          ...currentInputs,
          upColor: isVelaDefaultUp ? effectiveUp : currentInputs.upColor,
          downColor: isVelaDefaultDown ? effectiveDown : currentInputs.downColor,
        };
      }

      let handle = findNativeHandle(entry.type);
      if (!handle && typeof chart.addNativeIndicator === 'function') {
        try {
          handle = chart.addNativeIndicator(entry.type, entry.inputs ? { inputs: entry.inputs } : {});
        } catch (err) {
          console.warn(`[ChartSessionController] Gagal memanggil chart.addNativeIndicator("${entry.type}"):`, err);
        }
      }

      if (handle) {
        this.enrichNativeHandle(handle, entry.type);
      }

      // Tunggu model siap di panes.list apabila indikator baru saja dimount secara asinkron
      const needsModelWait =
        !handle || (entry.placement === 'own-pane' && handle?.id && !isHandleInPaneList(handle.id));
      if (needsModelWait && typeof chart.on === 'function') {
        await this.waitForChartCondition(
          chart,
          ['indicator:added', 'pane:changed'],
          () => {
            handle = findNativeHandle(entry.type) || handle;
            if (handle) this.enrichNativeHandle(handle, entry.type);
            return Boolean(
              handle &&
                (!entry.placement || entry.placement !== 'own-pane' || !handle.id || isHandleInPaneList(handle.id))
            );
          },
          2000
        );
        if (this.isDestroyed) return;
      }

      if (!handle) continue;

      this.withSuppressedPersistEvents(() => {
        if (entry.inputs) {
          if (typeof handle.update === 'function') {
            try {
              handle.update(entry.inputs);
            } catch (err) {
              console.warn(`[ChartSessionController] Gagal memanggil handle.update("${entry.type}"):`, err);
            }
          } else if (typeof handle.setInputs === 'function') {
            try {
              handle.setInputs(entry.inputs);
            } catch (err) {
              console.warn(`[ChartSessionController] applyNativeIndicators setInputs(${entry.type}) error:`, err);
            }
          }

          if (handle.id) {
            this.indicatorRegistry.updateInputs(handle.id, entry.inputs as Record<string, any>);
          }

          if (cleanType === 'volume') {
            const renderer = chart.renderer?.renderer || chart.renderer;
            if (renderer) {
              const up = (entry.inputs as any).upColor;
              const down = (entry.inputs as any).downColor;
              const heightPct = (entry.inputs as any).heightPct;
              const frac = typeof heightPct === 'number' ? Math.min(0.5, Math.max(0.05, heightPct / 100)) : 0.15;
              if (typeof renderer.setNativeData === 'function') {
                renderer.setNativeData('volume', {
                  upColor: up,
                  downColor: down,
                  heightFrac: frac,
                });
              } else if (renderer.scene?.volumeLayer) {
                if (up) renderer.scene.volumeLayer.upColor = up;
                if (down) renderer.scene.volumeLayer.downColor = down;
                renderer.scheduler?.invalidate?.(3);
              }
            }
          }
        }

        if (entry.visible !== undefined && typeof handle.setVisible === 'function') {
          try {
            handle.setVisible(Boolean(entry.visible));
            if (entry.type === 'volume') {
              this.syncCellVolumeHiddenState(targetCell, !entry.visible);
            }
          } catch (_) {}
        }

        if (entry.placement && typeof chart.panes?.moveIndicator === 'function' && handle.id) {
          const currentPlacement = getHandlePlacement(handle);
          if (currentPlacement !== entry.placement) {
            try {
              chart.panes.moveIndicator(
                handle.id,
                entry.placement === 'own-pane' ? { newPane: true } : 'price'
              );
            } catch (err) {
              console.warn(`[ChartSessionController] applyNativeIndicators moveIndicator(${entry.type}) error:`, err);
            }
          }
        }
      });
    }
  }

  /**
   * Mengambil konfigurasi tata letak pane berbasis identitas/signature pane (stabil meski urutan pane berubah).
   */
  public getPaneLayout(cell?: any): PaneLayoutEntry[] {
    const targetCell = this.resolveTargetCell(cell);
    return this.studyManager.getPaneLayout(targetCell);
  }

  /**
   * Memulihkan tata letak pane (heightWeight & collapsed) berbasis signature secara event-driven
   * menunggu sub-pane worker Pine/native terbentuk hingga batas waktu timeoutMs.
   */
  public async applyPaneLayout(
    entries: PaneLayoutEntry[],
    options: { timeoutMs?: number } = {},
    cell?: any
  ): Promise<boolean> {
    if (!Array.isArray(entries) || entries.length === 0) return false;
    const targetCell = this.resolveTargetCell(cell);
    if (!targetCell) return false;

    const chart = targetCell.chart || targetCell.inner;
    const native = chart?.renderer?.renderer || chart?.renderer;
    if (!native?.scene) return false;

    this.installEnsurePaneGuard(targetCell);
    this.userTouchedPaneLayoutByCell.delete(targetCell);

    let desiredMap = this.desiredPaneWeightsByCell.get(targetCell);
    if (!desiredMap) {
      desiredMap = new Map<string, number>();
      this.desiredPaneWeightsByCell.set(targetCell, desiredMap);
    }
    for (const entry of entries) {
      if (entry?.signature && typeof entry.weight === 'number' && entry.weight > 0) {
        desiredMap.set(entry.signature, entry.weight);
      }
    }

    const targetStudySigs = entries
      .map((e) => e?.signature)
      .filter((s): s is string => Boolean(s) && s !== 'price' && !s.startsWith('study:'));

    const getListedPanesWithSig = (): Array<{ id: string; kind: string; signature: string; scenePane: any }> => {
      const listed = typeof chart?.panes?.list === 'function' ? chart.panes.list() || [] : null;
      const ordered = typeof native.scene?.orderedPanes === 'function' ? native.scene.orderedPanes() : [];
      if (listed && listed.length > 0) {
        return listed.map((p: any, idx: number) => ({
          id: p.id,
          kind: p.kind,
          signature: computePaneSignature(p),
          scenePane:
            native.scene?.panes?.get?.(p.id) ||
            ordered.find((sp: any) => sp?.id === p.id) ||
            ordered[idx] ||
            null,
        }));
      }
      return ordered.map((sp: any, idx: number) => ({
        id: sp.id,
        kind: sp.kind,
        signature: sp.kind === 'price' || sp.id === 'price' ? 'price' : `study:${idx}`,
        scenePane: sp,
      }));
    };

    const allTargetsReady = (): boolean => {
      if (targetStudySigs.length === 0) return true;
      const current = getListedPanesWithSig();
      const availCounts = new Map<string, number>();
      for (const p of current) {
        availCounts.set(p.signature, (availCounts.get(p.signature) || 0) + 1);
      }
      const neededCounts = new Map<string, number>();
      for (const sig of targetStudySigs) {
        neededCounts.set(sig, (neededCounts.get(sig) || 0) + 1);
      }
      for (const [sig, count] of neededCounts.entries()) {
        if ((availCounts.get(sig) || 0) < count) return false;
      }
      return true;
    };

    if (!allTargetsReady() && typeof chart?.on === 'function') {
      await this.waitForChartCondition(
        chart,
        ['indicator:added', 'pane:changed'],
        allTargetsReady,
        options.timeoutMs ?? 3000
      );
      if (this.isDestroyed) return false;
    }

    const currentPanes = getListedPanesWithSig();
    const matchedIds = new Set<string>();
    let appliedAny = false;

    const applyToPane = (paneInfo: { id: string; scenePane: any }, entry: PaneLayoutEntry) => {
      if (paneInfo.scenePane && typeof entry.weight === 'number' && entry.weight > 0) {
        paneInfo.scenePane.heightWeight = entry.weight;
        appliedAny = true;
      }
      if (entry.collapsed !== undefined && typeof chart?.panes?.collapse === 'function') {
        try {
          this.withSuppressedPersistEvents(() => {
            chart.panes.collapse(paneInfo.id, Boolean(entry.collapsed));
          });
        } catch (_) {}
      } else if (entry.collapsed !== undefined && paneInfo.scenePane) {
        paneInfo.scenePane.collapsed = Boolean(entry.collapsed);
      }
    };

    const unmatchedEntries: Array<{ entry: PaneLayoutEntry; idx: number }> = [];
    entries.forEach((entry, idx) => {
      if (!entry) return;
      const found = currentPanes.find(
        (p) => !matchedIds.has(p.id) && p.signature === entry.signature
      );
      if (found) {
        matchedIds.add(found.id);
        applyToPane(found, entry);
      } else {
        unmatchedEntries.push({ entry, idx });
      }
    });

    // Fallback berbasis index hanya untuk signature v1 legacy ('study:<n>')
    for (const { entry, idx } of unmatchedEntries) {
      if (entry.signature.startsWith('study:')) {
        const byIdx = currentPanes[idx];
        if (byIdx && !matchedIds.has(byIdx.id) && byIdx.signature !== 'price') {
          matchedIds.add(byIdx.id);
          applyToPane(byIdx, entry);
        }
      }
    }

    if (appliedAny) {
      if (typeof native.layoutPanes === 'function') {
        native.layoutPanes();
      }
      if (native.scheduler?.invalidate) {
        native.scheduler.invalidate(4);
      }
      const baseline = this.getPaneLayout(targetCell);
      this.lastCapturedPaneLayoutByCell.set(targetCell, JSON.stringify(baseline));
    }

    return appliedAny;
  }

  /**
   * Mendeteksi perubahan layout pane setelah interaksi drag/double-click separator,
   * menyinkronkan peta desired weights guard, dan memancarkan sinyal dirty.
   */
  public capturePaneLayoutIfChanged(cell?: any, options?: { silent?: boolean }): boolean {
    const targetCell = this.resolveTargetCell(cell);
    if (!targetCell) return false;

    const current = this.getPaneLayout(targetCell);
    if (current.length === 0) return false;

    const serialized = JSON.stringify(current);
    const prev = this.lastCapturedPaneLayoutByCell.get(targetCell);

    let desiredMap = this.desiredPaneWeightsByCell.get(targetCell);
    if (!desiredMap) {
      desiredMap = new Map<string, number>();
      this.desiredPaneWeightsByCell.set(targetCell, desiredMap);
    }
    for (const entry of current) {
      if (entry.signature && entry.weight > 0) {
        desiredMap.set(entry.signature, entry.weight);
      }
    }

    if (prev === undefined) {
      this.lastCapturedPaneLayoutByCell.set(targetCell, serialized);
      return false;
    }

    if (prev === serialized) {
      return false;
    }

    this.lastCapturedPaneLayoutByCell.set(targetCell, serialized);
    if (!options?.silent && !this.isRestoringWorkspace) {
      this.userTouchedPaneLayoutByCell.add(targetCell);
      this.emitPersistableChange('paneLayout');
    }
    return true;
  }

  /**
   * Mengambil bobot tinggi (heightWeight) dari seluruh pane pada sel target atau sel aktif.
   */
  public getPaneWeights(cell?: any): number[] {
    try {
      const targetCell = this.resolveTargetCell(cell);
      const chart = targetCell?.chart || targetCell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      if (native?.scene?.orderedPanes) {
        const panes = native.scene.orderedPanes();
        return panes.map((p: any) =>
          typeof p.heightWeight === 'number' ? p.heightWeight : p.kind === 'price' ? 3 : 1
        );
      }
    } catch (err) {
      console.warn('[ChartSessionController] Gagal membaca paneWeights:', err);
    }
    return [];
  }

  /**
   * Menerapkan bobot tinggi tersimpan ke sub-pane pada sel target atau sel aktif.
   */
  public applyPaneWeights(weights: number[], cell?: any): boolean {
    if (!weights || weights.length === 0) return false;
    try {
      const targetCell = this.resolveTargetCell(cell);
      const chart = targetCell?.chart || targetCell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      if (native?.scene?.orderedPanes) {
        const panes = native.scene.orderedPanes();
        panes.forEach((p: any, i: number) => {
          if (weights[i] !== undefined && weights[i] > 0) {
            p.heightWeight = weights[i];
          }
        });
        if (typeof native.layoutPanes === 'function') {
          native.layoutPanes();
        }
        if (native.scheduler?.invalidate) {
          native.scheduler.invalidate(4);
        }
        return true;
      }
    } catch (err) {
      console.warn('[ChartSessionController] Gagal menerapkan paneWeights:', err);
    }
    return false;
  }

  /**
   * Membaca status mode skala sumbu harga kanan pada sel target atau sel aktif.
   */
  public getPriceScaleState(cell?: any): any {
    try {
      const targetCell = this.resolveTargetCell(cell);
      const chart = targetCell?.chart || targetCell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      const pricePane =
        native?.scene?.panes?.get?.('price') ||
        native?.scene?.orderedPanes?.().find((p: any) => p.kind === 'price');
      const cfg = native?.getConfig?.();
      return {
        mode: (cfg?.priceScale?.log || cfg?.priceScale?.mode === 'log') ? 'log' : (cfg?.priceScale?.mode || 'price'),
        log: Boolean(cfg?.priceScale?.log),
        invert: Boolean(cfg?.priceScale?.invert),
        auto: pricePane ? pricePane.manualScale == null : true,
        manualScale: pricePane?.manualScale ? { ...pricePane.manualScale } : null,
      };
    } catch (err) {
      console.warn('[ChartSessionController] Gagal membaca priceScaleState:', err);
    }
    return null;
  }

  private isPriceScaleStateEqual(prev: any, next: any): boolean {
    if (!prev || !next || typeof prev !== 'object' || typeof next !== 'object') return false;
    const prevLog = Boolean(prev.log);
    const prevMode = prevLog || prev.mode === 'log' ? 'log' : (prev.mode || 'price');
    const prevInvert = Boolean(prev.invert);
    const prevAuto = prev.auto !== undefined ? Boolean(prev.auto) : prev.manualScale == null;

    const hasLogOrMode = next.log !== undefined || next.mode !== undefined;
    const targetLog = hasLogOrMode ? (next.mode === 'log' || next.log === true) : prevLog;
    const targetMode = hasLogOrMode
      ? (targetLog ? 'log' : (next.mode || 'price'))
      : prevMode;
    const targetInvert = next.invert !== undefined ? Boolean(next.invert) : prevInvert;
    const targetAuto = next.auto !== undefined ? Boolean(next.auto) : prevAuto;

    if (
      prevMode !== targetMode ||
      prevLog !== targetLog ||
      prevInvert !== targetInvert ||
      prevAuto !== targetAuto
    ) {
      return false;
    }

    if (targetAuto) {
      return prev.manualScale == null;
    }

    if (next.manualScale === undefined) {
      return true;
    }
    if (prev.manualScale === next.manualScale) return true;
    if (!prev.manualScale || !next.manualScale || typeof prev.manualScale !== 'object' || typeof next.manualScale !== 'object') {
      return false;
    }
    const keysA = Object.keys(prev.manualScale);
    const keysB = Object.keys(next.manualScale);
    return keysA.length === keysB.length && keysA.every((k) => prev.manualScale[k] === next.manualScale[k]);
  }

  /**
   * Menerapkan status skala harga tersimpan ke sumbu kanan grafik pada sel target atau sel aktif.
   */
  public applyPriceScaleState(state: any, cell?: any): boolean {
    if (!state) return false;
    try {
      const targetCell = this.resolveTargetCell(cell);
      const chart = targetCell?.chart || targetCell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      if (!native) return false;

      const currentState = this.getPriceScaleState(targetCell);
      if (currentState && this.isPriceScaleStateEqual(currentState, state)) {
        return true;
      }

      this.withSuppressedPersistEvents(() => {
        if (state.log !== undefined || state.mode !== undefined || state.invert !== undefined) {
          const patch: any = { priceScale: {} };
          if (state.mode === 'log' || state.log === true) {
            patch.priceScale.log = true;
            patch.priceScale.mode = 'price';
          } else if (state.mode) {
            patch.priceScale.mode = state.mode;
            patch.priceScale.log = false;
          }
          if (state.invert !== undefined) {
            patch.priceScale.invert = state.invert;
          }
          patch.priceScale.currentPriceLine = this.showCurrentPriceLine !== false;
          patch.priceScale.countdown = this.isPriceScaleCountdownEnabled(targetCell);

          native.applyConfig?.(patch);
          if (native.scene) {
            native.scene.showPriceLine = this.showCurrentPriceLine !== false;
            native.scene.showCountdown = this.isPriceScaleCountdownEnabled(targetCell);
          }
        }

        const pricePane =
          native.scene?.panes?.get?.('price') ||
          native.scene?.orderedPanes?.().find((p: any) => p.kind === 'price');
        if (pricePane) {
          if (state.auto === false && state.manualScale) {
            if (typeof native.setManualScale === 'function') {
              native.setManualScale(pricePane, state.manualScale);
            } else {
              pricePane.manualScale = { ...state.manualScale };
              pricePane.scale = { ...state.manualScale };
            }
          } else if (state.auto === true) {
            pricePane.manualScale = null;
          }
          if (native.scheduler?.invalidate) {
            native.scheduler.invalidate(4);
          }
        }
      });
      this.emitPersistableChange('priceScale');
      return true;
    } catch (err) {
      console.warn('[ChartSessionController] Gagal menerapkan priceScaleState:', err);
    }
    return false;
  }

  /**
   * Mengambil gaya visual lilin pada sel target atau sel aktif.
   * Fallback otomatis ke 'candles' jika input atau nilai tersimpan tidak valid.
   */
  public getPriceStyle(cell?: any): PriceStyle | string {
    try {
      const targetCell = this.resolveTargetCell(cell) as any;
      const chart = targetCell?.chart || targetCell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      const raw = native?.getConfig?.()?.series?.style || targetCell?.priceStyle;
      if (isValidPriceStyle(raw)) {
        return raw;
      }
      return 'candles';
    } catch (err) {
      console.warn('[ChartSessionController] Gagal membaca priceStyle:', err);
    }
    return 'candles';
  }

  /**
   * Menyetel gaya visual lilin pada sel target atau sel aktif.
   * Mendukung propagasi multi-cell otomatis jika syncConfig.style aktif.
   * Fallback otomatis ke 'candles' jika style yang diberikan tidak valid.
   */
  public setPriceStyle(style: string, cell?: any): void {
    const validStyle: PriceStyle = isValidPriceStyle(style) ? style : 'candles';
    try {
      const isSyncActive = Boolean(this.syncConfig.style);
      const isTargetActiveOrUnspecified = !cell || cell === this.workspace?.active;
      const targetCells = (isSyncActive && isTargetActiveOrUnspecified)
        ? this.getAllCells()
        : [this.resolveTargetCell(cell)];

      let anyChanged = false;
      for (const targetCell of targetCells) {
        if (!targetCell) continue;
        const currentStyle = this.getPriceStyle(targetCell);
        if (currentStyle === validStyle) {
          continue;
        }
        anyChanged = true;
        const chart = targetCell?.chart || targetCell?.inner;
        const native = chart?.renderer?.renderer || chart?.renderer;
        this.withSuppressedPersistEvents(() => {
          if (native?.applyConfig) {
            native.applyConfig({ series: { style: validStyle } });
          }
          if (typeof targetCell?.setPriceStyle === 'function') {
            targetCell.setPriceStyle(validStyle);
          } else {
            targetCell.priceStyle = validStyle;
          }
        });
      }

      if (anyChanged) {
        this.emitPersistableChange('priceStyle');
        this.notify();
      }
      this.onPriceStyleChange?.(validStyle);
    } catch (err) {
      console.warn('[ChartSessionController] Gagal menyetel priceStyle:', err);
    }
  }

  /**
   * Mengganti gaya lilin ke gaya berikutnya secara berurutan:
   * candles -> heikinashi -> bars -> line -> area -> baseline -> candles.
   */
  public cyclePriceStyle(cell?: any): PriceStyle {
    const current = this.getPriceStyle(cell);
    const styles = VALID_PRICE_STYLES;
    const currentIndex = styles.indexOf(current as PriceStyle);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % styles.length : 0;
    const nextStyle = styles[nextIndex];
    this.setPriceStyle(nextStyle, cell);
    return nextStyle;
  }

  /**
   * Mengatur preset rentang waktu terlihat (Visible Range Preset) secara single-pass.
   * Mendukung '1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'.
   * Secara otomatis memetakan ke resolusi timeframe candle optimal, menghitung bar budget,
   * dan membingkai viewport tanpa kedipan (visual snapping).
   */
  public async setVisibleRangePreset(preset: VisibleRangePreset, cell?: any): Promise<boolean> {
    if (!isValidRangePreset(preset)) {
      return false;
    }

    const targetCell = this.resolveTargetCell(cell);
    if (!targetCell) {
      return false;
    }

    const chart = targetCell.chart || targetCell.inner;
    if (!chart) {
      return false;
    }

    const config = getRangePresetConfig(preset);
    const targetTf = config.timeframe;
    const targetVelaTf = config.velaTimeframe;
    const requiredBars = config.bars;
    const prevTimeframe = this.timeframe;
    const prevPreset = this.activeRangePreset;
    const prevSpan = this.activeRangePresetSpan;

    // Hitung span awal tanpa clamping ke bar timeframe lama agar setMarket memuat kedalaman penuh
    const initialSpan = calculateRangePresetSpan(preset);
    this.isApplyingRangePreset = true;
    this.activeRangePreset = preset;
    this.activeRangePresetSpan = initialSpan;
    this.timeframe = targetTf;
    this.activeCellInfo = { symbol: this.symbol, timeframe: targetTf };

    try {
      this.withSuppressedPersistEvents(() => {
        if (typeof targetCell.setTimeframe === 'function' && targetCell.timeframe !== targetVelaTf) {
          targetCell.setTimeframe(targetVelaTf);
        }
      });

      // Panggil setMarket dengan timeframe, bars, dan visibleRange secara single-pass
      if (typeof chart.setMarket === 'function') {
        await chart.setMarket({
          timeframe: targetVelaTf,
          bars: Math.max(requiredBars, targetCell?.state?.bars ?? 500),
          visibleRange: initialSpan,
        });
      } else if (typeof targetCell.applyRange === 'function') {
        targetCell.applyRange({
          id: preset,
          tf: targetVelaTf,
          preset,
          bars: requiredBars,
        });
      }

      // Setelah setMarket selesai, ambil bar terbaru untuk framing final yang akurat (termasuk preset 'ALL')
      const updatedBars =
        chart?.orchestrator?.rawBars ??
        chart?.orchestrator?.bars ??
        chart?.bars ??
        chart?.rawBars ??
        (typeof chart?.getBars === 'function' ? chart.getBars() : undefined);
      const finalSpan = calculateRangePresetSpan(preset, updatedBars);
      this.activeRangePresetSpan = finalSpan;

      // Pastikan framing diterapkan pada renderer jika belum sinkron
      if (typeof chart.setVisibleRange === 'function') {
        chart.setVisibleRange(finalSpan);
      } else if (typeof chart.setVisibleRangePreset === 'function') {
        chart.setVisibleRangePreset(preset);
      }

      if (prevTimeframe !== targetTf) {
        this.onActiveCellChange?.({
          symbol: this.symbol,
          timeframe: targetTf,
          providerId: this.providerId,
        });
      }

      this.onRangePresetChange?.(preset);
      this.emitPersistableChange('visibleRangePreset');
      this.notify();
      return true;
    } catch (err) {
      this.activeRangePreset = prevPreset;
      this.activeRangePresetSpan = prevSpan;
      this.timeframe = prevTimeframe;
      this.activeCellInfo = { symbol: this.symbol, timeframe: prevTimeframe };
      console.warn('[ChartSessionController] Gagal menyetel visible range preset:', err);
      return false;
    } finally {
      this.isApplyingRangePreset = false;
    }
  }

  /**
   * Alias seam terpadu untuk menerapkan Visible Range Preset pada sesi chart aktif.
   */
  public async applyRangePreset(presetId: VisibleRangePreset, cell?: any): Promise<boolean> {
    return this.setVisibleRangePreset(presetId, cell);
  }

  /**
   * Mereset state preset rentang aktif saat pengguna mengganti simbol/timeframe secara manual
   */
  private resetActiveRangePreset(): void {
    if (this.activeRangePreset !== null || this.activeRangePresetSpan !== null) {
      this.activeRangePreset = null;
      this.activeRangePresetSpan = null;
      this.onRangePresetChange?.(null);
    }
  }

  /**
   * Mengambil preset rentang waktu yang sedang aktif
   */
  public getActiveRangePreset(cell?: any): VisibleRangePreset | null {
    return this.activeRangePreset;
  }

  /**
   * Merotasi preset rentang waktu ke pilihan berikutnya atau sebelumnya secara siklik
   */
  public async cycleRangePreset(
    direction: 'next' | 'prev' = 'next',
    cell?: any
  ): Promise<VisibleRangePreset | null> {
    const current = this.activeRangePreset;
    const next = getNextRangePreset(current, direction);
    const success = await this.setVisibleRangePreset(next, cell);
    return success ? next : null;
  }

  /**
   * Mengevaluasi perubahan rentang waktu terlihat (pan/zoom manual) terhadap horizon preset aktif.
   * Mengembalikan true jika viewport menyimpang di luar toleransi sehingga activeRangePreset di-reset ke null.
   */
  public handleVisibleTimeRangeChange(
    rangeOrCell?: { from: number; to: number } | any,
    cell?: any
  ): boolean {
    if (this.isApplyingRangePreset) return false;
    if (!this.activeRangePreset || !this.activeRangePresetSpan) return false;

    const hasExplicitRange =
      rangeOrCell &&
      typeof rangeOrCell === 'object' &&
      typeof rangeOrCell.from === 'number' &&
      typeof rangeOrCell.to === 'number';
    const vr = hasExplicitRange
      ? (rangeOrCell as { from: number; to: number })
      : this.getVisibleRangeSnapshot(cell ?? rangeOrCell);
    if (!vr || typeof vr.from !== 'number' || typeof vr.to !== 'number') return false;

    const currentSpan = Math.abs(vr.to - vr.from);
    const targetSpan = Math.abs(this.activeRangePresetSpan.to - this.activeRangePresetSpan.from);
    if (targetSpan <= 0) return false;

    const ratio = currentSpan / targetSpan;
    const timeDrift = Math.abs(vr.to - this.activeRangePresetSpan.to);

    // Jika rasio lebar span mengecil < 0.65x atau membesar > 1.35x,
    // atau pergeseran tepi waktu kanan > 35% dari rentang target,
    // maka pengguna telah melakukan panning/zooming manual di luar cakupan preset.
    if (ratio < 0.65 || ratio > 1.35 || timeDrift > targetSpan * 0.35) {
      this.activeRangePreset = null;
      this.activeRangePresetSpan = null;
      this.onRangePresetChange?.(null);
      this.notify();
      return true;
    }

    return false;
  }

  /**
   * Mengecek apakah posisi viewport pengguna telah menyimpang jauh dari rentang preset yang dibingkai
   */
  private checkRangePresetViewportDrift(cell: any): void {
    this.handleVisibleTimeRangeChange(undefined, cell);
  }

  /**
   * Mengambil kerapatan zoom horizontal terakhir (barSpacing) pada sel target atau sel aktif.
   */
  public getBarSpacing(cell?: any): number {
    try {
      const targetCell = this.resolveTargetCell(cell) as any;
      const chart = targetCell?.chart || targetCell?.inner;
      const coords = getChartCoords(chart);
      return coords?.getViewport?.()?.barSpacing ?? 8;
    } catch (_) {}
    return 8;
  }

  /**
   * Menyetel kerapatan zoom horizontal (barSpacing) pada sel target atau sel aktif.
   */
  public setBarSpacing(spacing: number, cell?: any): void {
    if (!spacing || spacing <= 0) return;
    try {
      const targetCell = this.resolveTargetCell(cell) as any;
      const chart = targetCell?.chart || targetCell?.inner;
      const coords = getChartCoords(chart);
      const native = chart?.renderer?.renderer || chart?.renderer;
      if (coords && typeof coords.setViewport === 'function') {
        const vp = coords.getViewport();
        coords.setViewport({ ...vp, barSpacing: spacing });
        native?.scheduler?.invalidate?.(4);
        this.emitPersistableChange('viewport');
      }
    } catch (_) {}
  }

  private toVelaIntervalString(tf?: string): string {
    if (!tf) return '15';
    const raw = tf.trim();
    if (raw === '1D' || raw === '1d' || raw === 'D') return 'D';
    if (raw === '1W' || raw === '1w' || raw === 'W') return 'W';
    if (raw === '1M' || raw === '1mo' || raw === 'M') return 'M';
    if (/^\d+$/.test(raw)) return raw;
    const minMatch = raw.match(/^(\d+)m$/i);
    if (minMatch) return minMatch[1];
    const hourMatch = raw.match(/^(\d+)h$/i);
    if (hourMatch) return String(parseInt(hourMatch[1], 10) * 60);
    return toVelaTimeframe(raw);
  }

  /**
   * Membaca proporsi lebar/tinggi kolom & baris grid multi-chart pada layout aktif.
   */
  public getTrackSizes(): WorkspaceTrackSizes | undefined {
    if (!this.workspace) return undefined;
    try {
      let entry: WorkspaceTrackSizes | undefined;
      if (typeof this.workspace.getState === 'function') {
        const st = this.workspace.getState();
        entry = st?.trackSizes?.[this.layout] ?? st?.trackSizes?.[st?.layout];
      }
      if (!entry && this.workspace.trackSizes && typeof this.workspace.trackSizes.get === 'function') {
        entry = this.workspace.trackSizes.get(this.layout);
      }
      if (!entry || typeof entry !== 'object') return undefined;
      const cols = Array.isArray(entry.cols) && entry.cols.length > 0 ? [...entry.cols] : undefined;
      const rows = Array.isArray(entry.rows) && entry.rows.length > 0 ? [...entry.rows] : undefined;
      if (!cols && !rows) return undefined;
      return {
        ...(cols ? { cols } : {}),
        ...(rows ? { rows } : {}),
      };
    } catch (_) {
      return undefined;
    }
  }

  /**
   * Mengambil indeks sel yang sedang aktif/terfokus di grid multi-chart.
   */
  public getActiveCellIndex(): number {
    const cells = this.getAllCells();
    if (cells.length === 0) return 0;
    const active = this.workspace?.active;
    if (!active) return 0;
    let idx = cells.indexOf(active);
    if (idx < 0 && active?.id) {
      idx = cells.findIndex((c: any) => c?.id === active.id);
    }
    return idx >= 0 ? idx : 0;
  }

  /**
   * Mengambil snapshot state lengkap untuk masing-masing sel di layout aktif (Hybrid: membuang drawings/indicators mentah Vela per K1).
   */
  public getCellsSnapshot(): CellSnapshot[] {
    const cells = this.getAllCells();
    if (cells.length === 0) return [];

    let rawState: any = null;
    try {
      if (typeof this.workspace?.getState === 'function') {
        rawState = this.workspace.getState();
      }
    } catch (_) {}

    const rawCharts = Array.isArray(rawState?.charts) ? rawState.charts : [];

    return cells.map((cell, idx) => {
      const rawChart =
        rawCharts.find((rc: any) => rc?.id && cell?.id && rc.id === cell.id) || rawCharts[idx] || null;
      const { providerId, symbol } = getCellMarketIdentity(cell);
      const tf = fromVelaTimeframe(cell?.timeframe || rawChart?.timeframe || this.timeframe);

      const chart = cell?.chart || cell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      const rawRendererConfig =
        rawChart?.rendererConfig ??
        native?.getConfig?.() ??
        chart?.renderer?.getConfig?.();

      const rendererConfig = sanitizeRendererConfigForPersistence(
        rawRendererConfig,
        this.lastAppliedThemeColors ?? this.resolveActiveThemeCandleColors()
      );

      const session = rawChart?.session ?? cell?.state?.session;
      const bars = rawChart?.bars ?? cell?.state?.bars;
      const visibleRange = this.getVisibleRangeSnapshot(cell);

      return {
        symbol: symbol || this.symbol,
        timeframe: tf,
        providerId: providerId || this.providerId,
        priceStyle: this.getPriceStyle(cell),
        priceScaleCountdown: this.isPriceScaleCountdownEnabled(cell),
        barSpacing: this.getBarSpacing(cell),
        priceScaleState: this.getPriceScaleState(cell),
        paneLayout: this.getPaneLayout(cell),
        nativeIndicators: this.getNativeIndicators(cell),
        ...(this.syncConfig.indicators === false ? { indicators: this.getCellIndicators(cell) } : {}),
        ...(visibleRange ? { visibleRange } : {}),
        ...(rendererConfig !== undefined ? { rendererConfig } : {}),
        ...(session ? { session } : {}),
        ...(typeof bars === 'number' && Number.isFinite(bars) ? { bars } : {}),
      };
    });
  }

  /**
   * Memulihkan state per-sel multi-chart secara hybrid: memakai applyState parsial Vela tanpa drawings/indicators,
   * lalu memulihkan indikator Pine, nativeIndicators, paneLayout, priceScaleState, dan barSpacing per sel.
   */
  public async applyCellsSnapshot(
    cellsSnap: CellSnapshot[],
    options?: {
      trackSizes?: WorkspaceTrackSizes;
      activeCellIndex?: number;
      layout?: string;
      sharedIndicators?: SavedWorkspaceIndicator[];
    }
  ): Promise<void> {
    if (!this.workspace || !Array.isArray(cellsSnap) || cellsSnap.length === 0) return;

    const wasRestoring = this.isRestoringWorkspace;
    this.isRestoringWorkspace = true;
    try {
      const liveCells = this.getAllCells();
      if (liveCells.length === 0) return;

      const targetLayout = options?.layout || this.layout || '1';
      const activeIdx =
        typeof options?.activeCellIndex === 'number' &&
        options.activeCellIndex >= 0 &&
        options.activeCellIndex < liveCells.length
          ? options.activeCellIndex
          : 0;
      const targetActiveCell = liveCells[activeIdx] || liveCells[0];
      const activeCellId = targetActiveCell?.id || `c${activeIdx + 1}`;
      const pairCount = Math.min(cellsSnap.length, liveCells.length);

      // 1. Panggil Vela workspace.applyState() parsial TANPA field drawings & indicators (Keputusan K1)
      if (typeof this.workspace.applyState === 'function') {
        const chartsDoc: any[] = [];
        for (let i = 0; i < pairCount; i++) {
          const snap = cellsSnap[i];
          const liveCell = liveCells[i];
          const prov = snap.providerId || this.providerId || 'binance';
          this.ensureVelaProviderRegistered(prov);
          const velaSym = resolveVelaSymbol(snap.symbol || this.symbol, prov);
          const velaTf = this.toVelaIntervalString(snap.timeframe || this.timeframe);
          const sanitizedSnapConfig = sanitizeRendererConfigForApply(snap.rendererConfig);
          const effectiveRendererConfig = sanitizedSnapConfig
            ? (this.userChartDefaultConfig
                ? this.mergeRendererConfigs(this.userChartDefaultConfig, sanitizedSnapConfig)
                : sanitizedSnapConfig)
            : undefined;
          if (liveCell && sanitizedSnapConfig) {
            this.workspaceRendererConfigByCell.set(liveCell, sanitizedSnapConfig);
          }
          chartsDoc.push({
            id: liveCell?.id || `c${i + 1}`,
            symbol: velaSym,
            provider: toVelaProviderId(prov),
            timeframe: velaTf,
            ...(snap.priceStyle ? { priceStyle: snap.priceStyle } : {}),
            ...(effectiveRendererConfig && typeof effectiveRendererConfig === 'object'
              ? { rendererConfig: effectiveRendererConfig }
              : {}),
            ...(snap.session === 'regular' || snap.session === 'extended' ? { session: snap.session } : {}),
            ...(typeof snap.bars === 'number' && snap.bars > 0 ? { bars: snap.bars } : {}),
          });
        }

        const applyDoc: any = {
          version: 1,
          layout: targetLayout,
          activeCellId,
          sync: {
            crosshair: Boolean(this.syncConfig.crosshair),
            viewport: Boolean(this.syncConfig.viewport ?? true),
            drawings: Boolean(this.syncConfig.drawings),
            symbol: Boolean(this.syncConfig.symbol),
            timeframe: Boolean(this.syncConfig.timeframe),
            style: Boolean(this.syncConfig.style),
          },
          charts: chartsDoc,
          ...(options?.trackSizes && (options.trackSizes.cols || options.trackSizes.rows)
            ? { trackSizes: { [targetLayout]: options.trackSizes } }
            : {}),
        };

        this.workspace.applyState(applyDoc);
      }

      // 2. Selaraskan dan pulihkan properti per-sel pada live cells melalui pipeline 5-langkah terpadu
      const updatedCells = this.getAllCells();
      const applyCount = Math.min(cellsSnap.length, updatedCells.length);
      for (let i = 0; i < applyCount; i++) {
        const snap = cellsSnap[i];
        const cell = updatedCells[i];
        if (!cell) continue;

        const chart = cell?.chart || cell?.inner;
        const targetIndicators =
          this.syncConfig.indicators === false
            ? Array.isArray(snap.indicators)
              ? snap.indicators
              : undefined
            : Array.isArray(snap.indicators)
              ? snap.indicators
              : options?.sharedIndicators;

        await restoreCellThroughPipeline(
          snap,
          {
            applyMarketIdentity: (cellSnap) => {
              this.attachCellListeners(cell);
              const prov = cellSnap.providerId || this.providerId || 'binance';
              const targetSym = resolveVelaSymbol(cellSnap.symbol || this.symbol, prov);
              const targetTf = this.toVelaIntervalString(cellSnap.timeframe || this.timeframe);

              if (cell.symbol !== targetSym && typeof cell.setSymbol === 'function') {
                cell.setSymbol(targetSym);
              }
              if (cell.timeframe !== targetTf && typeof cell.setTimeframe === 'function') {
                cell.setTimeframe(targetTf);
              }
              this.syncCellMacroState(cell);
            },
            applyRendererConfig: (sanitizedConfig) => {
              this.applyRendererConfig(sanitizedConfig, cell);
            },
            setPriceStyle: (style) => this.setPriceStyle(style, cell),
            setPriceScaleCountdown: (enabled) => this.setPriceScaleCountdown(enabled, cell),
            clearNonVolumeIndicators: () => {
              if (chart && typeof chart.indicators === 'function') {
                for (const existingInd of Array.from(chart.indicators() || []) as any[]) {
                  if (existingInd?.nativeType === 'volume') continue;
                  try {
                    if (typeof existingInd?.remove === 'function') existingInd.remove();
                  } catch (_) {}
                }
              }
            },
            addPineIndicator: async (ind) => {
              if (!ind?.title) return;
              await this.addPineIndicatorToCell(
                cell,
                ind.source || 'plot(close)',
                ind.title,
                ind.inputs,
                ind.props,
                ind.visible !== false
              );
            },
            applyNativeIndicators: (entries) => this.applyNativeIndicators(entries, cell),
            applyPaneLayout: (entries, opts) => this.applyPaneLayout(entries, opts, cell),
            withSuppressedPersistEvents: (fn) => this.withSuppressedPersistEvents(fn),
            applyPriceScaleState: (state) => this.applyPriceScaleState(state, cell),
            setBarSpacing: (spacing) => this.setBarSpacing(spacing, cell),
            applyVisibleRange: (vr) => this.applyVisibleRange(vr, cell),
            finalizeCellVisuals: () => {
              this.enforceCurrentPriceLine(cell);
              this.syncGlobalVisualChromeToCells(cell);
            },
          },
          {
            indicators: targetIndicators,
          }
        );
      }

      // 3. Pastikan active cell terfokus tepat sesuai activeCellIndex dan UI shell tersinkron
      const finalCells = this.getAllCells();
      const finalActiveCell = finalCells[activeIdx] || finalCells[0];
      if (finalActiveCell) {
        if (
          this.workspace.active !== finalActiveCell &&
          typeof this.workspace.setActiveCell === 'function' &&
          finalActiveCell.id
        ) {
          this.workspace.setActiveCell(finalActiveCell.id);
        }
        const { providerId: actProv, symbol: actSym } = getCellMarketIdentity(finalActiveCell);
        const actTf = fromVelaTimeframe(
          finalActiveCell.timeframe || cellsSnap[activeIdx]?.timeframe || this.timeframe
        ) as Timeframe;

        if (actSym && (actSym !== this.symbol || actProv !== this.providerId)) {
          this.suppressAutoDrawingRestoreKey = `${(actProv || 'binance').toLowerCase()}:${actSym.toUpperCase()}`;
          this.scheduleManagedTimeout(() => {
            if (this.suppressAutoDrawingRestoreKey === `${(actProv || 'binance').toLowerCase()}:${actSym.toUpperCase()}`) {
              this.suppressAutoDrawingRestoreKey = null;
            }
          }, 300);
        }

        this.symbol = actSym || this.symbol;
        this.timeframe = actTf;
        this.providerId = actProv || this.providerId;
        this.activeCellInfo = { symbol: this.symbol, timeframe: this.timeframe };

        if (this.onActiveCellChange && (this.symbol !== '' || this.timeframe !== '')) {
          this.onActiveCellChange({
            symbol: this.symbol,
            timeframe: this.timeframe,
            providerId: this.providerId,
          });
        }
      }

      this.notifyActiveIndicators();
      this.onPriceStyleChange?.(this.getPriceStyle());
      this.timelineMarksController.syncForMarket(this.symbol, this.providerId);
      this.notify();
    } finally {
      this.isRestoringWorkspace = wasRestoring;
    }
  }

  /**
   * Mengambil snapshot kondisi workspace lengkap untuk disimpan ke persistence SQLite (Single Source of Truth)
   */
  public saveWorkspaceState(name: string = 'Workspace'): Omit<SavedWorkspace, 'id' | 'timestamp'> & { id?: string } {
    return buildWorkspaceSnapshotPayload({
      name,
      symbol: this.symbol,
      timeframe: this.timeframe,
      layout: this.layout,
      providerId: this.providerId,
      showVolume: this.showVolume,
      syncConfig: this.syncConfig,
      chart: this,
      plan: chartDrawingController,
    });
  }

  /**
   * Memulihkan kondisi workspace lengkap secara atomik melalui helper pipeline terpusat
   */
  public async loadWorkspaceState(snapshot: SavedWorkspace): Promise<void> {
    if (!snapshot) return;

    this.beginWorkspaceRestore();
    try {
      this.clearAllIndicators();

      if (snapshot.showVolume !== undefined) {
        this.setShowVolume(snapshot.showVolume);
      }

      if (snapshot.providerId && snapshot.providerId !== this.providerId) {
        this.providerId = snapshot.providerId;
      }

      if (snapshot.symbol || snapshot.timeframe) {
        await this.setSymbol(
          snapshot.symbol || this.symbol,
          (snapshot.timeframe as Timeframe) || this.timeframe,
          snapshot.providerId || this.providerId
        );
      }

      if (snapshot.layout) {
        this.setLayout(snapshot.layout);
      }

      if (snapshot.syncConfig) {
        this.syncLayout(snapshot.syncConfig);
      }

      await restoreWorkspaceChartAndPlans({
        workspace: snapshot,
        chart: this,
        plan: chartDrawingController,
        restoreCellDrawings: false,
        resetPlansWhenEmpty: false,
      });

      this.notify();
    } finally {
      this.endWorkspaceRestore();
    }
  }

  /**
   * Menyimpan konfigurasi visual chart saat ini sebagai setelan default permanen (terisolasi dari kunci global K3)
   */
  public async saveCurrentSettingsAsDefault(): Promise<boolean> {
    if (!this.workspace || !this.workspace.active) return false;
    try {
      const activeChart = this.workspace.active.chart as any;
      const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
      const currentConfig = renderer?.getConfig?.() || activeChart?.getConfig?.();

      if (!currentConfig) {
        console.warn('[ChartSessionController] Gagal membaca getConfig() dari chart renderer aktif');
        return false;
      }

      const sanitizedConfig =
        sanitizeRendererConfigForPersistence(
          currentConfig,
          this.lastAppliedThemeColors ?? this.resolveActiveThemeCandleColors()
        ) ?? {};

      this.chartDefaultHydrationEpoch++;
      this.userChartDefaultConfig = sanitizedConfig;
      this.activeChartDefaultConfig = sanitizedConfig;
      await this.persistence.saveChartDefaultConfig(sanitizedConfig);

      for (const cell of this.getAllCells()) {
        const chart = cell?.chart || cell?.inner;
        const r = chart?.renderer?.renderer || chart?.renderer;
        if (r) {
          r.factoryConfig = cloneRendererConfigValue(sanitizedConfig);
        }
        if (chart?.renderer && chart.renderer !== r) {
          chart.renderer.factoryConfig = cloneRendererConfigValue(sanitizedConfig);
        }
      }

      this.withSuppressedPersistEvents(() => {
        for (const cell of this.getAllCells()) {
          if (cell !== this.workspace.active) {
            const chart = cell?.chart || cell?.inner;
            const r = chart?.renderer?.renderer || chart?.renderer;
            r?.applyConfig?.(cloneRendererConfigValue(sanitizedConfig));
          }
        }
      });

      return true;
    } catch (err) {
      console.error('[ChartSessionController] Error saat menyimpan chart settings as default:', err);
      return false;
    }
  }

  /**
   * Reset konfigurasi lilin & chart kembali ke setelan awal pabrik Vela
   * dan menyelaraskan ulang dengan Theme Preset yang sedang aktif
   */
  public async resetSettingsToFactory(): Promise<void> {
    try {
      this.chartDefaultHydrationEpoch++;
      this.userChartDefaultConfig = null;
      this.activeChartDefaultConfig = null;
      this.workspaceRendererConfigByCell = new WeakMap();
      await this.persistence.clearChartDefaultConfig();
      if (this.workspace) {
        for (const cell of this.getAllCells()) {
          const chart = cell?.chart || cell?.inner;
          const r = chart?.renderer?.renderer || chart?.renderer;
          if (r && typeof r.factoryResetDocument === 'function') {
            const orig = r.factoryConfig;
            if (orig) {
              r.applyConfig(r.factoryResetDocument(orig));
            }
          }
        }
      }
      // Pulihkan lilin & elemen kanvas ke Theme Preset aktif yang sedang dipilih pengguna
      this.customChartBackground = { mode: 'theme' };
      this.setTheme(this.themePreset, this.fontSize, this.customCandleColors || undefined);
    } catch (err) {
      console.warn('[ChartSessionController] Gagal reset chart settings ke pabrik:', err);
    }
  }

  /**
   * Helper internal untuk mengambil seluruh cells aktif dari workspace
   */
  public getAllCells(): any[] {
    if (!this.workspace) return [];
    try {
      if (typeof this.workspace.cells === 'function') {
        const list = Array.from(this.workspace.cells());
        if (list.length > 0) return list;
      }
    } catch (_) {}
    try {
      const cellMap = this.workspace.cellsById;
      if (cellMap && typeof cellMap.values === 'function') {
        const list = Array.from(cellMap.values());
        if (list.length > 0) return list;
      }
    } catch (_) {}
    return this.workspace.active ? [this.workspace.active] : [];
  }

  /**
   * Reset skala & sesuaikan viewport grafik (Auto Fit) pada sel aktif.
   * Target cell aktif di workspace (active cell || cells[0]).
   * Memanggil cell.resetView(), dengan fallback ke renderer.resetView(),
   * chart.fitContent(), atau chart.resetView().
   */
  public fitChart(): void {
    const cell = this.workspace?.active || this.getAllCells()[0];
    if (!cell) return;

    if (typeof cell.resetView === 'function') {
      cell.resetView();
      return;
    }

    const chart = cell.chart || cell.inner || cell;
    const renderer = chart?.renderer?.renderer || chart?.renderer;

    if (typeof renderer?.resetView === 'function') {
      renderer.resetView();
    } else if (typeof chart?.fitContent === 'function') {
      chart.fitContent();
    } else if (typeof chart?.resetView === 'function') {
      chart.resetView();
    }
  }

  /**
   * Mengambil instans workspace internal
   */
  public getWorkspace(): any {
    return this.workspace;
  }

  /**
   * Mengambil elemen HTMLCanvasElement dari sel aktif atau seluruh sel grid
   * Menangani penjahitan (stitching) komposit multi-chart layout jika scope === 'all'
   */
  public getScreenshotCanvas(scope: 'active' | 'all' = 'active'): HTMLCanvasElement | null {
    const ws = this.workspace;
    const cells = this.getAllCells();

    if (scope === 'all' && this.layout !== '1') {
      // 1. Coba ambil tangkapan seluruh workspace langsung dari Vela workspace jika didukung
      if (ws && typeof ws.screenshotCanvas === 'function') {
        const fullCanvas = ws.screenshotCanvas();
        if (fullCanvas) return fullCanvas;
      }

      // 2. Jika ada beberapa sel dan masing-masing sel memiliki canvas/screenshotCanvas
      if (cells.length > 1 && typeof document !== 'undefined') {
        const cellCanvases: { canvas: HTMLCanvasElement; rect?: DOMRect }[] = [];
        for (const cell of cells) {
          let c: HTMLCanvasElement | null = null;
          if (typeof cell.screenshotCanvas === 'function') {
            c = cell.screenshotCanvas();
          } else if (cell.chart?.renderer && typeof cell.chart.renderer.screenshotCanvas === 'function') {
            c = cell.chart.renderer.screenshotCanvas();
          } else if (cell.element) {
            c = cell.element.querySelector('canvas');
          }
          if (c) {
            const rect = cell.element?.getBoundingClientRect?.();
            cellCanvases.push({ canvas: c, rect });
          }
        }

        // Jika berhasil mendapatkan canvas dari tiap sel dengan koordinat DOM
        if (cellCanvases.length === cells.length && cellCanvases.every((item) => item.rect)) {
          const minLeft = Math.min(...cellCanvases.map((item) => item.rect!.left));
          const minTop = Math.min(...cellCanvases.map((item) => item.rect!.top));
          const maxRight = Math.max(...cellCanvases.map((item) => item.rect!.right));
          const maxBottom = Math.max(...cellCanvases.map((item) => item.rect!.bottom));

          const totalWidth = Math.round(maxRight - minLeft);
          const totalHeight = Math.round(maxBottom - minTop);

          if (totalWidth > 0 && totalHeight > 0) {
            const compositeCanvas = document.createElement('canvas');
            const scaleRatio = cellCanvases[0].canvas.width / (cellCanvases[0].rect!.width || 1);
            compositeCanvas.width = Math.round(totalWidth * scaleRatio);
            compositeCanvas.height = Math.round(totalHeight * scaleRatio);
            const ctx = compositeCanvas.getContext('2d');
            if (ctx) {
              for (const item of cellCanvases) {
                const dx = Math.round((item.rect!.left - minLeft) * scaleRatio);
                const dy = Math.round((item.rect!.top - minTop) * scaleRatio);
                const dw = Math.round(item.rect!.width * scaleRatio);
                const dh = Math.round(item.rect!.height * scaleRatio);
                ctx.drawImage(item.canvas, dx, dy, dw, dh);
              }
              return compositeCanvas;
            }
          }
        }
      }
    }

    // Default atau scope === 'active': Ambil canvas dari active cell atau cell pertama
    const activeCell = ws?.active || cells[0] || ws?.cells?.[0];
    if (activeCell && typeof activeCell.screenshotCanvas === 'function') {
      const c = activeCell.screenshotCanvas();
      if (c) return c;
    }
    if (activeCell?.chart?.renderer && typeof activeCell.chart.renderer.screenshotCanvas === 'function') {
      const c = activeCell.chart.renderer.screenshotCanvas();
      if (c) return c;
    }
    if (activeCell?.element) {
      const c = activeCell.element.querySelector('canvas');
      if (c) return c as HTMLCanvasElement;
    }
    if (this.container) {
      const c = this.container.querySelector('canvas');
      if (c) return c as HTMLCanvasElement;
    }
    return null;
  }

  /**
   * Menambal celah candle historis pada satu cell melalui batas interface orchestrator Vela
   */
  private async healCellGap(cell: any): Promise<void> {
    const chart = cell?.chart || cell?.inner;
    const orchestrator = chart?.orchestrator;
    if (!orchestrator || orchestrator.replayQueue) return;

    try {
      if (!orchestrator.live && typeof orchestrator.startLive === 'function') {
        orchestrator.startLive();
      }
      if (typeof orchestrator.healGap === 'function' && orchestrator.canHeal?.()) {
        const bars = orchestrator.bars;
        const lastBar = Array.isArray(bars) && bars.length > 0 ? bars[bars.length - 1] : null;
        if (lastBar?.time) {
          orchestrator.lastHealAt = 0;
          await orchestrator.healGap(lastBar.time);
        }
      }
    } catch (err) {
      console.warn('[ChartSessionController] Gagal healGap saat reconnectLiveFeed:', err);
    }
  }

  /**
   * Memaksa penyambungan ulang seluruh live stream aktif dan menambal celah candle pada setiap cell
   */
  public async reconnectLiveFeed(): Promise<void> {
    await this.streamCoordinator.reconnectAll();

    for (const cell of this.getAllCells()) {
      await this.healCellGap(cell);
    }
  }

  /**
   * Mengambil rekam telemetri performa strategi Pine Script aktif
   */
  public getStrategyTelemetry(indicatorId?: string): StrategyTelemetryPayload | null {
    return this.strategyTelemetry.getTelemetry(indicatorId);
  }

  /**
   * Mengambil seluruh rekam telemetri strategi aktif di workspace
   */
  public getAllStrategyTelemetry(): StrategyTelemetryPayload[] {
    return this.strategyTelemetry.getAllTelemetry();
  }

  /**
   * Mengambil daftar marker eksekusi order (on-chart TradeExecution[])
   */
  public getStrategyTradeExecutions(indicatorId?: string): TradeExecution[] {
    return this.strategyTelemetry.getTradeExecutions(indicatorId);
  }

  /**
   * Menghapus data telemetri strategi secara bersih
   */
  public clearStrategyTelemetry(indicatorId?: string): void {
    this.strategyTelemetry.clearTelemetry(indicatorId);
  }

  /**
   * Mendaftarkan pendengar pembaruan telemetri strategi
   */
  public onStrategyTelemetry(handler: (payload: StrategyTelemetryPayload) => void): () => void {
    return this.strategyTelemetry.subscribe(handler);
  }

  /**
   * Mengalirkan marker eksekusi transaksi ke renderer chart tertentu
   */
  public routeStrategyTradeMarkers(
    cellOrChart: any,
    indicatorId: string,
    executions: TradeExecution[]
  ): boolean {
    return this.strategyTelemetry.routeTradeMarkersToCell(cellOrChart, indicatorId, executions);
  }

  /**
   * Menghancurkan sesi, melepaskan observer, timer, listener, dan membebaskan alokasi WebGL Context
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.chartDefaultHydrationEpoch++;
    this.clearManagedTimers();
    this.clearPendingVisibleRangeListeners();
    this.clearPendingWaiters();
    this.clearWorkspaceEventUnsubs();
    if (this.viewportPersistTimer) {
      clearTimeout(this.viewportPersistTimer);
      this.viewportPersistTimer = null;
    }

    for (const unsub of this.configChangedUnsubs) {
      try { unsub(); } catch (_) {}
    }
    this.configChangedUnsubs = [];

    if (this.onlineListener && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      try {
        window.removeEventListener('online', this.onlineListener);
      } catch (_) {}
      this.onlineListener = null;
    }

    this.streamCoordinator.clear();
    this.registeredCustomSignatures.clear();
    this.timelineMarksController.detach();
    this.pineRuntime.dispose();

    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch (_) {}
      this.resizeObserver = null;
    }

    if (this.workspace) {
      try {
        if (typeof this.workspace.destroy === 'function') {
          this.workspace.destroy();
        }
      } catch (err) {
        console.warn('[ChartSessionController] Peringatan saat destroy VelaWorkspace:', err);
      }
      this.workspace = null;
    }

    this.container = null;
    this.isAttached = false;
    this.notify();
  }
}

export {
  createPineFetchSeriesAdapter,
  TrawanganPineWorkerEngine,
  type FetchSeriesHandler,
  type FetchSeriesRange,
  type OHLCVBar,
} from './pineSeriesAdapter';

export {
  PineStrategyTelemetryService,
  pineStrategyTelemetry,
  parseStrategyState,
  parseStrategyTrades,
  tradesToTradeExecutions,
  type StrategyState,
  type StrategyFill,
  type StrategyTrade,
  type TradeExecution,
  type StrategyTelemetryPayload,
} from './pineStrategyTelemetry';
