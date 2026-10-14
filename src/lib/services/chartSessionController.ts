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
import { registerDefaultEngine } from '@luxalgo/vela';
import { PineWorkerEngine } from '@luxalgo/vela-pinets';
import { IndicatorRegistry } from './indicatorRegistry';
import type {
  Timeframe,
  MultiChartSyncConfig,
  ThemePresetId,
  ActiveIndicatorInfo,
  SavedWorkspace
} from '../types/market';
import { THEME_PRESETS } from '../constants/themes';
import { toVelaTimeframe, fromVelaTimeframe } from '../utils/timeframeAdapter';
import { applyLayoutTimeframePolicy } from '../constants/defaults';
import {
  saveChartDefaultConfig,
  clearChartDefaultConfig
} from './persistence';

export interface ChartSessionOptions {
  symbol: string;
  timeframe: Timeframe;
  defaultTimeframe?: Timeframe;
  layout?: string;
  providerId?: string;
  themePreset?: ThemePresetId;
  fontSize?: number;
  timezone?: string;
  showCurrentPriceLine?: boolean;
  syncConfig?: MultiChartSyncConfig;
  onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe }) => void;
  onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
  // Factory opsional untuk dependency injection / headless unit testing
  workspaceFactory?: (container: HTMLElement, config: any) => any;
}

export interface ChartSessionSnapshot {
  isAttached: boolean;
  symbol: string;
  timeframe: Timeframe;
  providerId: string;
  layout: string;
  timezone: string;
  themePreset: ThemePresetId;
  fontSize: number;
  showCurrentPriceLine: boolean;
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

/**
 * Normalisasi format simbol pair ke format Vela sesuai bursa aktif
 */
export function resolveVelaSymbol(sym: string, pId: string): string {
  if (!sym) return 'binance:BTCUSDT';
  const clean = sym.includes(':') ? sym.split(':')[1] : sym;
  const p = (pId || 'binance').toLowerCase();

  if (p === 'indodax' || clean.toUpperCase().endsWith('IDR')) {
    const pair = clean.replace(/[\/\-_]/g, '').toUpperCase();
    return `indodax:${pair}`;
  } else if (p === 'hyperliquid') {
    const coin = clean.replace(/USDT$/, '').replace(/\.P$/, '');
    return `hyperliquid:${coin}`;
  } else if (p === 'coinbase') {
    const base = clean.replace(/USDT$/, '').replace(/\.P$/, '');
    return `coinbase:${base}-USD`;
  } else if (p === 'bitunix') {
    return `bitunix:${clean}`;
  }
  return `binance:${clean}`;
}

/**
 * Helper untuk mendapatkan instans Coords dari Vela Chart Renderer
 */
function getChartCoords(chart: any): any {
  if (!chart) return null;
  return chart.renderer?.renderer?.coords || chart.renderer?.coords || chart.coords || null;
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
  private themePreset: ThemePresetId;
  private fontSize: number;
  private timezone: string;
  private showCurrentPriceLine: boolean;
  private syncConfig: MultiChartSyncConfig;
  private onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe }) => void;
  private onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
  private workspaceFactory?: (container: HTMLElement, config: any) => any;
  private activeCellInfo: { symbol: string; timeframe: Timeframe } | null = null;
  private activeChartDefaultConfig: any = null;
  private isApplyingLayout = false;

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
      showCurrentPriceLine: this.showCurrentPriceLine,
      activeCell: this.activeCellInfo
        ? { ...this.activeCellInfo }
        : { symbol: this.symbol, timeframe: this.timeframe },
      activeIndicators: this.getActiveIndicators(),
      syncConfig: { ...this.syncConfig }
    };
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

    this.container = container;
    ensurePineEngine();

    const themeConfig = THEME_PRESETS[this.themePreset] || THEME_PRESETS.signature;
    const velaTheme = {
      background: themeConfig.chart.background,
      textColor: themeConfig.chart.textColor,
      gridColor: themeConfig.chart.gridColor,
      borderColor: themeConfig.chart.borderColor,
      upColor: themeConfig.chart.upColor,
      downColor: themeConfig.chart.downColor,
      fontSize: Math.max(9, Math.min(32, Math.round(this.fontSize))),
      fontFamily: "var(--font-sans, 'Plus Jakarta Sans', sans-serif)",
    };

    const velaSym = resolveVelaSymbol(this.symbol, this.providerId);
    const workspaceConfig = {
      layout: this.layout as any,
      symbol: velaSym,
      timeframe: toVelaTimeframe(this.timeframe),
      drawingToolbar: false,
      topbar: { left: [], right: [] },
      live: true,
      currentPriceLine: this.showCurrentPriceLine,
      theme: velaTheme,
      timezone: this.timezone,
      providers: {
        binance: () => new BinanceProvider(),
        indodax: () => new IndodaxProvider(),
        hyperliquid: () => new HyperliquidProvider(),
        coinbase: () => new CoinbaseProvider(),
        bitunix: () => new BitunixProvider(),
      },
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
      this.isAttached = true;
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

    this.notify();

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

    const chart = cell.chart || cell.inner;
    if (chart && typeof chart.on === 'function') {
      try {
        chart.on('market:changed', () => {
          this.enforceCurrentPriceLine(cell);
        });
        chart.on('indicator:removed', (ev: any) => {
          this.handleIndicatorRemoved(ev?.id);
        });
      } catch (_) {}
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
      const createdHandles: any[] = [];
      let firstHandle: any = null;

      for (const cell of targetCells as any[]) {
        const chart = cell?.chart || cell?.inner;
        if (!chart || typeof chart.addIndicator !== 'function') continue;
        const addOptions: any = {
          language: 'pine',
          title: cleanTitle,
        };
        if (savedInputs && Object.keys(savedInputs).length > 0) {
          addOptions.inputs = savedInputs;
        }
        if (savedProps && Object.keys(savedProps).length > 0) {
          addOptions.props = savedProps;
        }

        const handle = chart.addIndicator(source, addOptions);
        if (handle) {
          if (savedInputs && typeof handle.setInputs === 'function') {
            try { handle.setInputs(savedInputs); } catch (_) {}
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
          inputs: savedInputs,
          props: savedProps,
        });

        if (savedInputs && Object.keys(savedInputs).length > 0) {
          setTimeout(() => {
            for (const h of createdHandles) {
              try {
                if (typeof h?.setInputs === 'function') {
                  h.setInputs(savedInputs);
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
   * Menyelaraskan tema visual kanvas WebGL2 dan warna candlestick
   */
  public setTheme(preset: ThemePresetId, fontSize?: number): void {
    this.themePreset = preset;
    if (fontSize) this.fontSize = fontSize;

    if (this.workspace) {
      const cfg = THEME_PRESETS[preset] || THEME_PRESETS.signature;
      const themeObj = {
        background: cfg.chart.background,
        textColor: cfg.chart.textColor,
        gridColor: cfg.chart.gridColor,
        borderColor: cfg.chart.borderColor,
        upColor: cfg.chart.upColor,
        downColor: cfg.chart.downColor,
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
          upColor: cfg.chart.upColor,
          downColor: cfg.chart.downColor,
          borderUpColor: cfg.chart.borderUpColor || cfg.chart.upColor,
          borderDownColor: cfg.chart.borderDownColor || cfg.chart.downColor,
          wickUpColor: cfg.chart.wickUpColor || cfg.chart.upColor,
          wickDownColor: cfg.chart.wickDownColor || cfg.chart.downColor,
          bodyVisible: true,
          borderVisible: true,
          wickVisible: true,
        },
        bars: {
          upColor: cfg.chart.upColor,
          downColor: cfg.chart.downColor,
        },
      };

      // Terapkan ke seluruh sel grafik aktif
      try {
        for (const cell of this.getAllCells()) {
          const chart = cell?.chart || cell?.inner;
          const r = chart?.renderer?.renderer || chart?.renderer;
          if (r && typeof r.applyConfig === 'function') {
            r.applyConfig(candleConfig);
          }
        }
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
      syncConfig: { ...this.syncConfig },
    };
  }

  /**
   * Memulihkan kondisi workspace lengkap secara atomik
   */
  public async loadWorkspaceState(snapshot: SavedWorkspace): Promise<void> {
    if (!snapshot) return;

    this.clearAllIndicators();

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
   * Mengambil instans workspace internal
   */
  public getWorkspace(): any {
    return this.workspace;
  }

  /**
   * Menghancurkan sesi, melepaskan observer, dan membebaskan alokasi WebGL Context
   */
  public destroy(): void {
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
