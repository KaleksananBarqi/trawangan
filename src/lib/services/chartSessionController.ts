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
import { CustomFeedProvider } from './customProvider';
import { marketFeed } from './market';
import {
  StreamGuardCoordinator,
  wrapProviderWithStreamGuard,
  type StreamHealthSink,
} from './streamHealthGuard';
import { registerDefaultEngine } from '@luxalgo/vela';
import { PineWorkerEngine } from '@luxalgo/vela-pinets';
import { IndicatorRegistry } from './indicatorRegistry';
import { chartDrawingController } from './chartDrawingController';
import type {
  Timeframe,
  MultiChartSyncConfig,
  ThemePresetId,
  ActiveIndicatorInfo,
  SavedWorkspace,
  CustomChartBackgroundConfig,
  CustomThemePalette,
  GridMode,
  ProviderConfig
} from '../types/market';
import { THEME_PRESETS, resolveEffectiveVolumeColors, resolveEffectiveThemeColors, resolveThemeConfig } from '../constants/themes';
import { isVolumeIndicator } from '../data/indicatorPresets';
import { toVelaTimeframe, fromVelaTimeframe } from '../utils/timeframeAdapter';
import { applyLayoutTimeframePolicy } from '../constants/defaults';
import {
  saveChartDefaultConfig,
  clearChartDefaultConfig
} from './persistence';
import { deriveBorderColor, generateVelaThemeTokens, isDarkColor, withAlpha } from '../utils/colorUtils';

export interface ChartSessionOptions {
  symbol: string;
  timeframe: Timeframe;
  defaultTimeframe?: Timeframe;
  layout?: string;
  providerId?: string;
  themePreset?: ThemePresetId | string;
  fontSize?: number;
  timezone?: string;
  customPalette?: CustomThemePalette;
  customBullColor?: string;
  customBearColor?: string;
  customChartBackground?: CustomChartBackgroundConfig;
  showCurrentPriceLine?: boolean;
  showVolume?: boolean;
  gridMode?: GridMode;
  syncConfig?: MultiChartSyncConfig;
  onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe }) => void;
  onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
  onVelaThemeSelect?: (mode: 'dark' | 'light') => void;
  // Factory & Stream Guard opsional untuk dependency injection / headless unit testing
  workspaceFactory?: (container: HTMLElement, config: any) => any;
  feedHealthSink?: StreamHealthSink;
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
  customPalette?: CustomThemePalette;
  customBullColor?: string;
  customBearColor?: string;
  showCurrentPriceLine: boolean;
  showVolume: boolean;
  gridMode: GridMode;
  activeCell: { symbol: string; timeframe: Timeframe } | null;
  activeIndicators: ActiveIndicatorInfo[];
  syncConfig: MultiChartSyncConfig;
}

type SessionSubscriber = (snapshot: ChartSessionSnapshot) => void;

let staticEngineRegistered = false;

/**
 * Daftarkan worker engine PineTS satu kali secara global
 */
export function ensurePineEngine(): void {
  if (!staticEngineRegistered) {
    try {
      registerDefaultEngine('pine', () => new PineWorkerEngine());
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

  private symbol: string;
  private timeframe: Timeframe;
  private defaultTimeframe: Timeframe;
  private layout: string;
  private providerId: string;
  private themePreset: ThemePresetId | string;
  private fontSize: number;
  private timezone: string;
  private showCurrentPriceLine: boolean;
  private showVolume: boolean;
  private syncConfig: MultiChartSyncConfig;
  private onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe }) => void;
  private onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
  private workspaceFactory?: (container: HTMLElement, config: any) => any;
  private activeCellInfo: { symbol: string; timeframe: Timeframe } | null = null;
  private activeChartDefaultConfig: any = null;
  private isApplyingLayout = false;
  private customPalette: CustomThemePalette | null = null;
  private customCandleColors: { bullColor?: string; bearColor?: string } | null = null;
  private customChartBackground?: CustomChartBackgroundConfig;
  private onVelaThemeSelect?: (mode: 'dark' | 'light') => void;
  private gridMode: GridMode = 'normal';
  private feedHealthSink: StreamHealthSink;
  private streamCoordinator: StreamGuardCoordinator;
  private providerFactories?: Partial<Record<string, () => any>>;
  private streamWatchdogMs?: number;
  private streamStaleMs?: number;
  private onlineListener: (() => void) | null = null;

  constructor(options: Partial<ChartSessionOptions> = {}) {
    this.symbol = options.symbol || 'BTCUSDT';
    this.timeframe = options.timeframe || '15m';
    this.defaultTimeframe = options.defaultTimeframe || '15m';
    this.layout = options.layout || '1';
    this.providerId = options.providerId || 'binance';
    this.themePreset = options.themePreset || 'signature';
    this.fontSize = options.fontSize || 12;
    this.timezone = options.timezone || 'Asia/Jakarta';
    this.showCurrentPriceLine = options.showCurrentPriceLine ?? true;
    this.showVolume = options.showVolume ?? true;
    this.gridMode = options.gridMode || 'normal';
    this.customChartBackground = options.customChartBackground;
    this.customPalette = options.customPalette || null;
    this.onVelaThemeSelect = options.onVelaThemeSelect;
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
    this.onActiveIndicatorsChange = options.onActiveIndicatorsChange;
    this.workspaceFactory = options.workspaceFactory;
    this.feedHealthSink = options.feedHealthSink ?? marketFeed;
    this.streamCoordinator = new StreamGuardCoordinator(this.feedHealthSink);
    this.providerFactories = options.providerFactories;
    this.streamWatchdogMs = options.streamWatchdogMs;
    this.streamStaleMs = options.streamStaleMs;
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
      customPalette: this.customPalette || undefined,
      customBullColor: this.customCandleColors?.bullColor,
      customBearColor: this.customCandleColors?.bearColor,
      showCurrentPriceLine: this.showCurrentPriceLine,
      showVolume: this.showVolume,
      gridMode: this.gridMode,
      activeCell: this.activeCellInfo
        ? { ...this.activeCellInfo }
        : { symbol: this.symbol, timeframe: this.timeframe },
      activeIndicators: this.getActiveIndicators(),
      syncConfig: { ...this.syncConfig }
    };
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
   * Mengumpulkan konfigurasi custom-* provider secara sinkron dari sink aktif, singleton marketFeed, dan localStorage
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

    const sinkAny = this.feedHealthSink as any;
    if (typeof sinkAny?.getKnownProviderConfigsSync === 'function') {
      collect(sinkAny.getKnownProviderConfigsSync());
    }
    collect(marketFeed.getKnownProviderConfigsSync());

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('trawangan_providers');
        if (raw) collect(JSON.parse(raw));
      } catch (_) {}
    }

    return Array.from(byId.values());
  }

  private registerCustomConfigIntoVela(cfg: ProviderConfig): void {
    const velaFeed = this.workspace?.feed;
    if (!velaFeed || typeof velaFeed.registerProvider !== 'function') return;
    const velaKey = toVelaProviderId(cfg.id);
    if (typeof velaFeed.providerInstance === 'function' && velaFeed.providerInstance(velaKey)) {
      return;
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
  }

  private ensureVelaProviderRegistered(targetProviderId?: string): boolean {
    const rawId = (targetProviderId || this.providerId || 'binance').trim().toLowerCase();
    if (!rawId.startsWith('custom')) return true;

    const velaFeed = this.workspace?.feed;
    if (!velaFeed || typeof velaFeed.registerProvider !== 'function') return false;
    const velaKey = toVelaProviderId(rawId);
    if (typeof velaFeed.providerInstance === 'function' && velaFeed.providerInstance(velaKey)) {
      return true;
    }

    const customCfg = this.getKnownCustomConfigs().find(
      (c) => c.id.toLowerCase() === rawId || toVelaProviderId(c.id) === velaKey
    );
    if (customCfg) {
      this.registerCustomConfigIntoVela(customCfg);
      return true;
    }

    const customFactory = this.providerFactories?.[rawId] || this.providerFactories?.[velaKey];
    if (typeof customFactory === 'function') {
      const wrapped = wrapProviderWithStreamGuard(customFactory(), rawId, this.streamCoordinator, {
        healthSink: this.feedHealthSink,
        watchdogCheckMs: this.streamWatchdogMs,
        staleStreamMs: this.streamStaleMs,
      });
      velaFeed.registerProvider(velaKey, wrapped);
      return true;
    }

    return false;
  }

  private async hydrateAndRegisterCustomProviders(): Promise<void> {
    const lists: ProviderConfig[][] = [];
    const sinkAny = this.feedHealthSink as any;
    if (typeof sinkAny?.getSavedProviders === 'function') {
      try {
        const res = await sinkAny.getSavedProviders();
        if (Array.isArray(res)) lists.push(res);
      } catch (_) {}
    }
    try {
      const res = await marketFeed.getSavedProviders();
      if (Array.isArray(res)) lists.push(res);
    } catch (_) {}

    for (const list of lists) {
      for (const cfg of list) {
        if (cfg?.id && cfg.id.toLowerCase().startsWith('custom') && cfg.rest_url?.trim()) {
          this.registerCustomConfigIntoVela(cfg);
        }
      }
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
    if (options.themePreset) this.themePreset = options.themePreset;
    if (options.fontSize) this.fontSize = options.fontSize;
    if (options.syncConfig) this.syncConfig = options.syncConfig;
    if (options.showVolume !== undefined) this.showVolume = options.showVolume;
    if (options.customPalette !== undefined) this.customPalette = options.customPalette;
    if (options.onVelaThemeSelect) this.onVelaThemeSelect = options.onVelaThemeSelect;
    if (options.customChartBackground !== undefined) this.customChartBackground = options.customChartBackground;
    if (options.workspaceFactory) this.workspaceFactory = options.workspaceFactory;

    this.container = container;
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
      yahoo: () => new YahooFinanceProvider({ healthSink: this.feedHealthSink }),
    };

    // Daftarkan provider custom-* menggunakan kunci Vela aman ([A-Za-z0-9_.]+ -> custom_*)
    for (const cfg of knownCustomConfigs) {
      const velaKey = toVelaProviderId(cfg.id);
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
      topbar: { left: [], right: [] },
      live: true,
      currentPriceLine: this.showCurrentPriceLine,
      volume: this.showVolume,
      theme: velaTheme,
      timezone: this.timezone,
      providers: guardedProviders,
      engines: {
        pine: () => new PineWorkerEngine(),
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
      if (this.providerId.toLowerCase().startsWith('custom')) {
        void this.hydrateAndRegisterCustomProviders();
      }
    } catch (err) {
      console.warn('[ChartSessionController] Gagal inisialisasi VelaWorkspace:', err);
      this.workspace = null;
      this.isAttached = false;
      return () => {};
    }

    // Pasang listener & price line guard ke seluruh cell awal
    for (const cell of this.getAllCells()) {
      this.attachCellListeners(cell);
    }

    // Dengarkan pembuatan cell baru saat berganti layout grid
    if (this.workspace && typeof this.workspace.on === 'function') {
      try {
        this.workspace.on('cell:created', ({ id }: { id: string }) => {
          const cell = this.workspace?.cell?.(id);
          if (cell) {
            this.attachCellListeners(cell);
            if (this.timezone) {
              this.setTimezone(this.timezone);
            }
          }
          this.applyBackground();
        });

        this.workspace.on('cell:active', () => {
          if (this.isApplyingLayout) return;
          const cur = this.workspace?.active;
          if (cur && this.onActiveCellChange) {
            const rawSym = cur.symbol || this.symbol;
            const cleanSym = rawSym.includes(':') ? rawSym.split(':')[1] : rawSym;
            const curTf = (fromVelaTimeframe(cur.timeframe || this.timeframe) as Timeframe);
            this.activeCellInfo = { symbol: cleanSym, timeframe: curTf };
            if (cleanSym !== this.symbol || curTf !== this.timeframe) {
              this.onActiveCellChange({ symbol: cleanSym, timeframe: curTf });
            }
            this.attachCellListeners(cur);
          }
          if (this.syncConfig.indicators === false) {
            this.notifyActiveIndicators();
          }
        });
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
    setTimeout(() => {
      this.syncNativeVolumeColors();
    }, 200);
    setTimeout(() => {
      this.syncNativeVolumeColors();
    }, 800);

    return () => {
      this.destroy();
    };
  }

  /**
   * Mengaitkan listener peristiwa pada sel spesifik dan mengaktifkan price line guard
   */
  public attachCellListeners(cell: any): void {
    if (!cell) return;
    this.interceptApplyConfig(cell);
    this.enforceCurrentPriceLine(cell);
    this.syncNativeVolumeColors(cell);
    attachPriceScaleInputGuard(cell);

    const chart = cell.chart || cell.inner;
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
        chart.applyConfig({
          grid: {
            vertLines: { visible: this.gridMode !== 'hidden', color: gridCol },
            horzLines: { visible: this.gridMode !== 'hidden', color: gridCol }
          }
        });
      } catch (_) {}
    }

    if (chart && typeof chart.on === 'function') {
      try {
        chart.on('market:changed', () => {
          this.enforceCurrentPriceLine(cell);
          this.syncNativeVolumeColors(cell, false);
        });
        chart.on('indicator:added', () => {
          this.syncNativeVolumeColors(cell, false);
        });
        chart.on('history:complete', () => {
          this.syncNativeVolumeColors(cell, false);
        });
        chart.on('indicator:removed', (ev: any) => {
          this.handleIndicatorRemoved(ev?.id);
        });
      } catch (_) {}
    }
  }

  /**
   * Menyelaraskan input warna (upColor, downColor, maColor) pada indikator volume ke warna tema aktif
   * @param cell Sel spesifik opsional untuk sinkronisasi lokal
   * @param syncPineIndicators Apakah indikator Pine Script ikut disinkronkan (default: true saat pergantian tema)
   */
  public syncNativeVolumeColors(cell?: any, syncPineIndicators: boolean = true): void {
    const { upColor: effectiveUp, downColor: effectiveDown, maColor: effectiveMA } =
      resolveEffectiveVolumeColors(this.themePreset, this.customPalette || undefined, this.customCandleColors || undefined);
    const cells = cell ? [cell] : this.getAllCells();

    for (const c of cells) {
      const chart = c?.chart || c?.inner;
      if (chart) {
        if (typeof chart.indicators === 'function') {
          for (const ind of Array.from(chart.indicators() || []) as any[]) {
            const isNativeVol = ind?.nativeType === 'volume';
            const isPineVol = isVolumeIndicator(ind?.title);

            if (isNativeVol || (syncPineIndicators && isPineVol)) {
              if (typeof ind.setInputs === 'function') {
                try {
                  ind.setInputs({
                    upColor: effectiveUp,
                    downColor: effectiveDown,
                    maColor: effectiveMA,
                  });
                } catch (err) {
                  console.warn('[ChartSessionController] syncVolumeColors setInputs error:', err);
                }
              }
            }
          }
        }
        const renderer = chart.renderer?.renderer || chart.renderer;
        if (renderer) {
          if (typeof renderer.setNativeData === 'function') {
            renderer.setNativeData('volume', {
              upColor: effectiveUp,
              downColor: effectiveDown,
              heightFrac: 0.15,
            });
          } else if (renderer.scene?.volumeLayer) {
            renderer.scene.volumeLayer.upColor = effectiveUp;
            renderer.scene.volumeLayer.downColor = effectiveDown;
            renderer.scheduler?.invalidate?.(3);
          }
        }
      }
    }

    // Selaraskan juga entri tersimpan di indicatorRegistry saat pergantian tema global
    if (syncPineIndicators && this.indicatorRegistry) {
      for (const item of this.indicatorRegistry.getActiveIndicators()) {
        if (isVolumeIndicator(item.title)) {
          this.indicatorRegistry.updateInputs(item.id, {
            upColor: effectiveUp,
            downColor: effectiveDown,
            maColor: effectiveMA,
          });
        }
      }
    }
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
      }
      const res = originalApplyConfig(patch);
      if (this.scene) {
        this.scene.showPriceLine = self.showCurrentPriceLine !== false;
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
   * Menerapkan status visibilitas volume pasar native WebGL2 pada satu sel tertentu
   */
  public applyCellVolumeVisibility(cell: any, show: boolean): void {
    if (!cell) return;
    cell.volumeHidden = !show;
    const chart = cell.chart || cell.inner;
    if (chart) {
      chart.volumeHidden = !show;
      if (typeof chart.indicators === 'function') {
        for (const ind of Array.from(chart.indicators() || []) as any[]) {
          if (ind?.nativeType === 'volume' || ind?.title === 'Volume') {
            try {
              if (typeof ind.setVisible === 'function') ind.setVisible(show);
            } catch (_) {}
          }
        }
      }
      try {
        const nativeRenderer = chart.renderer?.renderer || chart.renderer;
        if (typeof nativeRenderer?.set === 'function') {
          nativeRenderer.set('volumeHidden', !show);
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

      // 1. DEDUPLIKASI: Hapus instance lama dengan judul atau source identik agar worker tidak menumpuk
      for (const entry of this.getActiveIndicators()) {
        if (entry.title === cleanTitle || (entry.source && entry.source.trim() === source.trim())) {
          this.removeIndicator(entry.id);
        }
      }

      // 2. Bersihkan juga secara native di cell target jika ada indikator dengan title yang sama
      const targetCells = (this.syncConfig.indicators !== false)
        ? this.getAllCells()
        : (this.workspace.active ? [this.workspace.active] : this.getAllCells());

      for (const cell of targetCells as any[]) {
        const chart = cell?.chart || cell?.inner;
        if (!cell || !chart || typeof chart.indicators !== 'function') continue;
        try {
          const nativeList = chart.indicators();
          for (const ind of nativeList) {
            if (ind && (ind.title === cleanTitle || ind.title === customTitle)) {
              if (typeof ind.remove === 'function') ind.remove();
            }
          }
        } catch (_) {}
      }

      // 3. Tambahkan indikator ke cell target
      const isVolumeScript = isVolumeIndicator(cleanTitle);
      let effectiveInputs = savedInputs ? { ...savedInputs } : undefined;
      if (isVolumeScript) {
        const { upColor: effectiveUp, downColor: effectiveDown, maColor: effectiveMA } =
          resolveEffectiveVolumeColors(this.themePreset, this.customPalette || undefined, this.customCandleColors || undefined);

        effectiveInputs = {
          upColor: effectiveUp,
          downColor: effectiveDown,
          maColor: effectiveMA,
          ...(effectiveInputs || {}),
        };
      }

      const createdHandles: any[] = [];
      let firstHandle: any = null;

      for (const cell of targetCells as any[]) {
        const chart = cell?.chart || cell?.inner;
        if (!chart || typeof chart.addIndicator !== 'function') continue;
        const isOverlay = source.includes('overlay=true') || source.includes('overlay = true');
        const addOptions: any = {
          language: 'pine',
          title: cleanTitle,
          ...(isOverlay ? { overlay: true, pane: 'price' } : {}),
        };
        if (effectiveInputs && Object.keys(effectiveInputs).length > 0) {
          addOptions.inputs = effectiveInputs;
        }
        if (savedProps && Object.keys(savedProps).length > 0) {
          addOptions.props = savedProps;
        }

        const handle = chart.addIndicator(source, addOptions);
        if (handle) {
          if (effectiveInputs && typeof handle.setInputs === 'function') {
            try { handle.setInputs(effectiveInputs); } catch (_) {}
          }
          if (savedProps && typeof handle.setProps === 'function') {
            try { handle.setProps(savedProps); } catch (_) {}
          }
          createdHandles.push(handle);
          if (!firstHandle) firstHandle = handle;
        }
      }

      if (firstHandle) {
        this.indicatorRegistry.register({
          id: firstHandle.id,
          handle: firstHandle,
          handles: createdHandles,
          title: cleanTitle,
          source,
          visible: firstHandle.visible ?? true,
          inputs: effectiveInputs,
          props: savedProps,
        });

        if (effectiveInputs && Object.keys(effectiveInputs).length > 0) {
          setTimeout(() => {
            for (const h of createdHandles) {
              try {
                if (typeof h?.setInputs === 'function') {
                  h.setInputs(effectiveInputs);
                }
              } catch (_) {}
            }
            this.notifyActiveIndicators();
          }, 350);
        }

        this.notifyActiveIndicators();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[ChartSessionController] addPineIndicator error:', err);
      return false;
    }
  }

  /**
   * Menghapus indikator secara tuntas di seluruh sel (mencegah zombie indicator)
   */
  public removeIndicator(id: string): void {
    this.indicatorRegistry.removeIndicator(
      id,
      this.syncConfig.indicators !== false,
      () => this.getAllCells()
    );
    this.notifyActiveIndicators();
  }

  /**
   * Membersihkan seluruh indikator aktif di workspace
   */
  public clearAllIndicators(): void {
    this.indicatorRegistry.clearAll(() => this.getAllCells());
    this.notifyActiveIndicators();
  }

  /**
   * Mengubah status visibilitas indikator
   */
  public toggleIndicatorVisibility(id: string): void {
    this.indicatorRegistry.toggleVisibility(id, this.syncConfig.indicators !== false);
    this.notifyActiveIndicators();
  }

  /**
   * Memperbarui input parameter indikator
   */
  public updateIndicatorInputs(id: string, inputs: Record<string, any>): void {
    this.indicatorRegistry.updateInputs(id, inputs);
    this.notifyActiveIndicators();
  }

  /**
   * Mengambil daftar indikator aktif di chart
   */
  public getActiveIndicators(): ActiveIndicatorInfo[] {
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

    if (this.workspace) {
      try {
        if (!this.ensureVelaProviderRegistered(this.providerId)) {
          await this.hydrateAndRegisterCustomProviders();
          this.ensureVelaProviderRegistered(this.providerId);
        }
        const targetSym = resolveVelaSymbol(this.symbol, this.providerId);
        if (this.syncConfig.symbol) {
          for (const cell of this.getAllCells()) {
            if (cell.symbol !== targetSym && typeof cell.setSymbol === 'function') {
              cell.setSymbol(targetSym);
            }
          }
        } else if (this.workspace.active && this.workspace.active.symbol !== targetSym && typeof this.workspace.active.setSymbol === 'function') {
          this.workspace.active.setSymbol(targetSym);
        }

        // Pulihkan gambar spesifik untuk simbol dan provider target secara terisolasi
        chartDrawingController.restoreDrawings(this.symbol, this.timeframe, this.providerId).catch(() => {});
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
      const cfg = resolveThemeConfig(preset);
      const isCustomPaletteActive = Boolean(this.customPalette && this.customPalette.enabled !== false);
      const cp = this.customPalette;

      // 6 Atribut Lilin Individual (Bull & Bear: Body, Wick, Border)
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

      // 3 Atribut Warna Umum & Turunan Adaptif Luminance
      const { background: effectiveBg, textColor: effectiveText, isDark: dark } = resolveEffectiveThemeColors(preset, this.customPalette);

      const effectiveGrid = this.resolveEffectiveGridColor(effectiveText, dark);

      const effectiveBorder = dark
        ? withAlpha(effectiveText, 0.14)
        : withAlpha(effectiveText, 0.18);

      const effectiveCrosshair = dark
        ? withAlpha(effectiveText, 0.45)
        : withAlpha(effectiveText, 0.55);

      const isCustomBg = this.customChartBackground?.mode === 'solid' || this.customChartBackground?.mode === 'gradient';
      const themeObj = {
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
      };

      try {
        if (typeof this.workspace.setTheme === 'function') {
          this.workspace.setTheme(themeObj);
        }
      } catch (err) {
        console.warn('[ChartSessionController] setTheme error:', err);
      }

      // Bangun patch konfigurasi candles dan bars untuk WebGL2 Renderer
      const candleConfig = {
        candles: {
          upColor: effectiveUp,
          downColor: effectiveDown,
          borderUpColor: effectiveBorderUp,
          borderDownColor: effectiveBorderDown,
          wickUpColor: effectiveWickUp,
          wickDownColor: effectiveWickDown,
          bodyVisible: true,
          borderVisible: true,
          wickVisible: true,
        },
        bars: {
          upColor: effectiveUp,
          downColor: effectiveDown,
        },
        grid: {
          vertLines: { visible: this.gridMode !== 'hidden', color: effectiveGrid },
          horzLines: { visible: this.gridMode !== 'hidden', color: effectiveGrid }
        }
      };

      // Terapkan ke seluruh sel grafik aktif
      try {
        for (const cell of this.getAllCells()) {
          const chart = cell?.chart || cell?.inner;
          if (chart && typeof chart.setTheme === 'function') {
            try { chart.setTheme(themeObj); } catch (_) {}
          }
          if (chart && typeof chart.setSurfaceBackground === 'function') {
            try { chart.setSurfaceBackground(effectiveBg); } catch (_) {}
          }
          const r = chart?.renderer?.renderer || chart?.renderer;
          if (r) {
            if (typeof r.setTheme === 'function') {
              try { r.setTheme(themeObj); } catch (_) {}
            }
            if (typeof r.applyConfig === 'function') {
              r.applyConfig({
                ...candleConfig,
                layout: {
                  background: isCustomBg ? 'transparent' : effectiveBg,
                  textColor: effectiveText,
                  borderColor: effectiveBorder,
                },
                crosshair: {
                  color: effectiveCrosshair,
                }
              });
            }
            if (r.scene) {
              r.scene.background = isCustomBg ? 'transparent' : effectiveBg;
              r.scene.textColor = effectiveText;
              r.scene.borderColor = effectiveBorder;
              r.scene.gridColor = effectiveGrid;
            }
            r.scheduler?.invalidate?.(7);
          }
        }
        this.syncNativeVolumeColors();
      } catch (err) {
        console.warn('[ChartSessionController] applyConfig candleStyle error:', err);
      }

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
        const activeSnapshot = this.getActiveIndicators();
        this.workspace.setLayout(layout as any);

        const activeCell = this.workspace.active;
        const curRange = activeCell?.chart?.getVisibleRange?.();
        const targetSym = resolveVelaSymbol(this.symbol, this.providerId);

        for (const cell of this.getAllCells()) {
          this.attachCellListeners(cell);
          if (cell !== activeCell) {
            if (this.syncConfig.symbol && cell.symbol !== targetSym && typeof cell.setSymbol === 'function') {
              cell.setSymbol(targetSym);
            }
            if (this.syncConfig.viewport && curRange && typeof cell.chart?.setVisibleRange === 'function') {
              cell.chart.setVisibleRange(curRange);
            }
          }
        }

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

        if (this.workspace.sync && typeof this.workspace.sync.set === 'function') {
          this.workspace.sync.set('crosshair', Boolean(this.syncConfig.crosshair));
          this.workspace.sync.set('viewport', Boolean(this.syncConfig.viewport ?? true));
          this.workspace.sync.set('drawings', Boolean(this.syncConfig.drawings));
          this.workspace.sync.set('symbol', Boolean(this.syncConfig.symbol));
        }

        for (const cell of this.getAllCells()) {
          this.enforceCurrentPriceLine(cell);
        }

        if (this.activeChartDefaultConfig) {
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
        setTimeout(() => {
          this.isApplyingLayout = false;
        }, 60);
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

        const activeCell = this.workspace.active;

        if (this.syncConfig.symbol && this.symbol) {
          const targetSym = resolveVelaSymbol(this.symbol, this.providerId);
          for (const cell of this.getAllCells()) {
            if (cell !== activeCell && cell.symbol !== targetSym && typeof cell.setSymbol === 'function') {
              cell.setSymbol(targetSym);
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
   * Mengkloning daftar indikator aktif ke seluruh cell workspace yang belum memilikinya
   */
  public cloneIndicatorsToCells(snapshot: ActiveIndicatorInfo[]): void {
    if (!this.workspace || !snapshot || snapshot.length === 0) return;
    try {
      const cells = this.getAllCells();
      for (const cell of cells) {
        const chart = cell?.chart || cell?.inner;
        if (!cell || !chart || typeof chart.indicators !== 'function') continue;

        const existingNative = Array.from(chart.indicators() || []);
        const existingTitles = new Set(existingNative.map((ind: any) => ind?.title).filter(Boolean));

        for (const ind of snapshot) {
          if (!ind.title || existingTitles.has(ind.title)) continue;
          const source = ind.source || 'plot(close)';
          if (!source) continue;

          const addOptions: any = {
            language: 'pine',
            title: ind.title,
          };
          if (ind.inputs && Object.keys(ind.inputs).length > 0) {
            addOptions.inputs = ind.inputs;
          }
          if (ind.props && Object.keys(ind.props).length > 0) {
            addOptions.props = ind.props;
          }

          const handle = chart.addIndicator(source, addOptions);
          if (handle) {
            if (ind.visible === false && typeof handle.setVisible === 'function') {
              try { handle.setVisible(false); } catch (_) {}
            }
            if (ind.inputs && typeof handle.setInputs === 'function') {
              try { handle.setInputs(ind.inputs); } catch (_) {}
            }
            if (ind.props && typeof handle.setProps === 'function') {
              try { handle.setProps(ind.props); } catch (_) {}
            }

            const matched = this.indicatorRegistry.findEntry(ind.id);
            if (matched) {
              const entry = matched.entry;
              if (!entry.handles) entry.handles = entry.handle ? [entry.handle] : [];
              if (!entry.handles.includes(handle)) {
                entry.handles.push(handle);
              }
            } else {
              this.indicatorRegistry.register({
                id: handle.id || ind.id,
                handle,
                handles: [handle],
                title: ind.title,
                source,
                visible: ind.visible ?? true,
                inputs: ind.inputs,
                props: ind.props,
              });
            }
          }
        }
      }
      this.notifyActiveIndicators();
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
      const activeVolumeHidden = Boolean((activeCell as any).volumeHidden);
      for (const cell of cells) {
        if (cell === activeCell) continue;
        this.applyCellVolumeVisibility(cell, !activeVolumeHidden);
      }
    } catch (err) {
      console.warn('[ChartSessionController] Gagal rekonsiliasi indikator dari active cell:', err);
    }
  }

  /**
   * Mengambil bobot tinggi (heightWeight) dari seluruh pane aktif
   */
  public getPaneWeights(): number[] {
    try {
      const activeCell = this.workspace?.active || this.getAllCells()[0];
      const chart = activeCell?.chart || activeCell?.inner;
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
   * Menerapkan bobot tinggi tersimpan ke sub-pane
   */
  public applyPaneWeights(weights: number[]): boolean {
    if (!weights || weights.length === 0) return false;
    try {
      const activeCell = this.workspace?.active || this.getAllCells()[0];
      const chart = activeCell?.chart || activeCell?.inner;
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
   * Membaca status mode skala sumbu harga kanan
   */
  public getPriceScaleState(): any {
    try {
      const activeCell = this.workspace?.active || this.getAllCells()[0];
      const chart = activeCell?.chart || activeCell?.inner;
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

  /**
   * Menerapkan status skala harga tersimpan ke sumbu kanan grafik
   */
  public applyPriceScaleState(state: any): boolean {
    if (!state) return false;
    try {
      const activeCell = this.workspace?.active || this.getAllCells()[0];
      const chart = activeCell?.chart || activeCell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      if (!native) return false;

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

        native.applyConfig?.(patch);
        if (native.scene) {
          native.scene.showPriceLine = this.showCurrentPriceLine !== false;
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
      return true;
    } catch (err) {
      console.warn('[ChartSessionController] Gagal menerapkan priceScaleState:', err);
    }
    return false;
  }

  /**
   * Mengambil gaya visual lilin aktif
   */
  public getPriceStyle(): string {
    try {
      const activeCell = (this.workspace?.active || this.getAllCells()[0]) as any;
      const chart = activeCell?.chart || activeCell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      return native?.getConfig?.()?.series?.style || activeCell?.priceStyle || 'candles';
    } catch (_) {}
    return 'candles';
  }

  /**
   * Menyetel gaya visual lilin
   */
  public setPriceStyle(style: string): void {
    if (!style) return;
    try {
      const activeCell = (this.workspace?.active || this.getAllCells()[0]) as any;
      const chart = activeCell?.chart || activeCell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      if (native?.applyConfig) {
        native.applyConfig({ series: { style } });
      }
      if (typeof activeCell?.setPriceStyle === 'function') {
        activeCell.setPriceStyle(style);
      }
    } catch (_) {}
  }

  /**
   * Mengambil kerapatan zoom horizontal terakhir (barSpacing)
   */
  public getBarSpacing(): number {
    try {
      const activeCell = (this.workspace?.active || this.getAllCells()[0]) as any;
      const chart = activeCell?.chart || activeCell?.inner;
      const coords = getChartCoords(chart);
      return coords?.getViewport?.()?.barSpacing ?? 8;
    } catch (_) {}
    return 8;
  }

  /**
   * Menyetel kerapatan zoom horizontal (barSpacing)
   */
  public setBarSpacing(spacing: number): void {
    if (!spacing || spacing <= 0) return;
    try {
      const activeCell = (this.workspace?.active || this.getAllCells()[0]) as any;
      const chart = activeCell?.chart || activeCell?.inner;
      const coords = getChartCoords(chart);
      const native = chart?.renderer?.renderer || chart?.renderer;
      if (coords && typeof coords.setViewport === 'function') {
        const vp = coords.getViewport();
        coords.setViewport({ ...vp, barSpacing: spacing });
        native?.scheduler?.invalidate?.(4);
      }
    } catch (_) {}
  }

  /**
   * Mengambil snapshot kondisi workspace lengkap untuk disimpan ke persistence SQLite
   */
  public saveWorkspaceState(name: string = 'Workspace'): Omit<SavedWorkspace, 'id' | 'timestamp'> & { id?: string } {
    const indicatorsData = this.getActiveIndicators().map((i: ActiveIndicatorInfo) => ({
      title: i.title,
      source: i.source,
      visible: i.visible,
      inputs: i.inputs,
      props: i.props,
    }));

    return {
      name,
      symbol: this.symbol,
      timeframe: this.timeframe,
      layout: this.layout,
      providerId: this.providerId,
      indicators: indicatorsData,
      paneWeights: this.getPaneWeights(),
      priceScaleState: this.getPriceScaleState(),
      priceStyle: this.getPriceStyle(),
      barSpacing: this.getBarSpacing(),
      showVolume: this.showVolume,
      syncConfig: { ...this.syncConfig },
      activePlans: chartDrawingController.getActivePlans(),
      showThesisCards: chartDrawingController.isThesisCardsVisible(),
    };
  }

  /**
   * Memulihkan kondisi workspace lengkap secara atomik
   */
  public async loadWorkspaceState(snapshot: SavedWorkspace): Promise<void> {
    if (!snapshot) return;

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

    if (snapshot.paneWeights && snapshot.paneWeights.length > 0) {
      this.applyPaneWeights(snapshot.paneWeights);
    }

    if (snapshot.priceScaleState) {
      this.applyPriceScaleState(snapshot.priceScaleState);
    }

    if (snapshot.priceStyle) {
      this.setPriceStyle(snapshot.priceStyle);
    }

    if (snapshot.barSpacing) {
      this.setBarSpacing(snapshot.barSpacing);
    }

    if (Array.isArray(snapshot.indicators)) {
      for (const ind of snapshot.indicators) {
        if (!ind?.title) continue;
        await this.addPineIndicator(
          ind.source || 'plot(close)',
          ind.title,
          ind.inputs,
          ind.props
        );
        if (ind.visible === false) {
          this.toggleIndicatorVisibility(ind.title);
        }
      }
    }

    if (Array.isArray(snapshot.activePlans) && snapshot.activePlans.length > 0) {
      chartDrawingController.restorePlans(snapshot.activePlans, snapshot.showThesisCards ?? true);
    }

    this.notify();
  }

  /**
   * Menyimpan konfigurasi visual chart saat ini sebagai setelan default permanen
   */
  public async saveCurrentSettingsAsDefault(buttonEl?: HTMLElement): Promise<boolean> {
    if (!this.workspace || !this.workspace.active) return false;
    try {
      const activeChart = this.workspace.active.chart as any;
      const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
      const currentConfig = renderer?.getConfig?.() || activeChart?.getConfig?.();

      if (!currentConfig) {
        console.warn('[ChartSessionController] Gagal membaca getConfig() dari chart renderer aktif');
        return false;
      }

      this.activeChartDefaultConfig = currentConfig;
      await saveChartDefaultConfig(currentConfig);

      for (const cell of this.getAllCells()) {
        const chart = cell?.chart || cell?.inner;
        const r = chart?.renderer?.renderer || chart?.renderer;
        if (r) {
          r.factoryConfig = currentConfig;
        }
        if (chart?.renderer && chart.renderer !== r) {
          chart.renderer.factoryConfig = currentConfig;
        }
      }

      for (const cell of this.getAllCells()) {
        if (cell !== this.workspace.active) {
          const chart = cell?.chart || cell?.inner;
          const r = chart?.renderer?.renderer || chart?.renderer;
          r?.applyConfig?.(currentConfig);
        }
      }

      if (buttonEl) {
        buttonEl.classList.add('saved');
        const prevContent = buttonEl.innerHTML;
        buttonEl.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; flex-shrink: 0;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>✓ Tersimpan sebagai Default!</span>
        `;
        setTimeout(() => {
          buttonEl.classList.remove('saved');
          buttonEl.innerHTML = prevContent;
        }, 2500);
      }

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
      this.activeChartDefaultConfig = null;
      await clearChartDefaultConfig();
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
   * Memaksa penyambungan ulang seluruh live stream aktif dan menambal celah candle pada setiap cell
   */
  public async reconnectLiveFeed(): Promise<void> {
    await this.streamCoordinator.reconnectAll();

    for (const cell of this.getAllCells()) {
      const chart = cell?.chart || cell?.inner;
      const orchestrator = chart?.orchestrator;
      if (!orchestrator || orchestrator.replayQueue) continue;

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
  }

  /**
   * Menghancurkan sesi, melepaskan observer, dan membebaskan alokasi WebGL Context
   */
  public destroy(): void {
    if (this.onlineListener && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      try {
        window.removeEventListener('online', this.onlineListener);
      } catch (_) {}
      this.onlineListener = null;
    }

    this.streamCoordinator.clear();

    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch (_) {}
      this.resizeObserver = null;
    }

    if (this.workspace) {
      try {
        this.workspace.destroy();
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
