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
  ActiveIndicatorInfo
} from '../types/market';
import { THEME_PRESETS } from '../constants/themes';
import { toVelaTimeframe } from '../utils/timeframeAdapter';

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
      activeIndicators: this.getActiveIndicators()
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
    if (timeframe) this.timeframe = timeframe;
    if (providerId) this.providerId = providerId;

    if (this.workspace) {
      try {
        const targetSym = resolveVelaSymbol(this.symbol, this.providerId);
        if (this.syncConfig.symbol) {
          for (const cell of this.getAllCells()) {
            if (cell.symbol !== targetSym) {
              cell.setSymbol(targetSym);
            }
          }
        } else if (this.workspace.active && this.workspace.active.symbol !== targetSym) {
          this.workspace.active.setSymbol(targetSym);
        }
      } catch (err) {
        console.warn('[ChartSessionController] setSymbol error:', err);
      }
    }

    this.notify();
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
        if (this.workspace.active) {
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
   * Menyelaraskan tema visual kanvas WebGL2
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
    }

    this.notify();
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
