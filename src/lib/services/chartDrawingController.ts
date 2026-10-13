import type { DrawingToolType, SnapMode } from '../types/market';
import {
  saveDrawingsDebounced,
  loadDrawings,
  clearDrawings
} from './persistence';
import type { CommandDispatcher } from './commandDispatcher';

export interface DrawingState {
  activeTool: DrawingToolType | null;
  snapMode: SnapMode;
  stayMode: boolean;
  isLocked: boolean;
  isHidden: boolean;
  activeDrawings: any[];
  canUndo: boolean;
  canRedo: boolean;
}

type Subscriber = (state: DrawingState) => void;

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
  private canUndo = true;
  private canRedo = true;

  private workspace: any = null;
  private getSymbol: () => string = () => 'BTCUSDT';
  private getTimeframe: () => string = () => '15m';

  private subscribers = new Set<Subscriber>();

  /**
   * Mengaitkan instance workspace Vela dan getter simbol/timeframe aktif
   */
  attachWorkspace(
    workspace: any,
    getSymbol: () => string,
    getTimeframe: () => string
  ): () => void {
    this.workspace = workspace;
    this.getSymbol = getSymbol;
    this.getTimeframe = getTimeframe;

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

  /**
   * Pasang listener event mutasi drawing dari engine Vela
   */
  attachChartListeners(chart: any): () => void {
    if (!chart || typeof chart.on !== 'function') return () => {};

    const onMutated = () => this.handleDrawingMutated();
    const onDraft = () => this.handleDrawingDraft();

    try {
      chart.on('drawing:created', onMutated);
      chart.on('drawing:edited', onMutated);
      chart.on('drawing:draft', onDraft);
      chart.on('drawing:removed', onMutated);
      chart.on('drawing:settings', onMutated);
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
      canUndo: this.canUndo,
      canRedo: this.canRedo
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

    const isEnteringHandpull = tool === 'handpull';
    const isExitingHandpull = prevTool === 'handpull' && tool !== 'handpull';

    // Kelola isolasi input drawing pada seluruh sel saat mode handpull aktif
    if (isEnteringHandpull || isExitingHandpull) {
      for (const cell of this.getAllCells()) {
        try {
          const renderer = cell?.chart?.renderer;
          const native = renderer?.renderer || renderer;
          if (native?.input) {
            if (isEnteringHandpull) {
              if (native.__origDrawingsInteractive === undefined) {
                native.__origDrawingsInteractive = native.input.drawings ?? true;
              }
              native.input.drawings = false; // Matikan claim seleksi objek gambar
            } else if (isExitingHandpull) {
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
          activeChart.drawings.setMode('measure');
        } else if (tool === 'eraser') {
          activeChart.drawings.setMode('eraser');
        } else if (tool === 'handpull' || tool === 'cursor' || tool === null) {
          activeChart.drawings.setMode(null);
          activeChart.drawings.setTool(null);
        } else {
          activeChart.drawings.setMode(null);
          activeChart.drawings.setTool(tool);
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
   */
  undo(): void {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        activeChart.drawings.undo();
        this.handleDrawingMutated();
      } catch (e) {
        console.warn('ChartDrawingController undo error:', e);
      }
    }
  }

  /**
   * Ulangi aksi gambar (Redo)
   */
  redo(): void {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        activeChart.drawings.redo();
        this.handleDrawingMutated();
      } catch (e) {
        console.warn('ChartDrawingController redo error:', e);
      }
    }
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
    this.notify();
  }

  /**
   * Buat objek gambar programatik langsung pada chart (misal horizontal line dari menu konteks)
   */
  createDrawing(spec: { type: string; price?: number; [key: string]: any }): void {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        activeChart.drawings.create?.(spec);
        this.handleDrawingMutated();
      } catch (e) {
        console.warn('ChartDrawingController createDrawing error:', e);
      }
    }
  }

  /**
   * Tangani event mutasi gambar (created, edited, removed, settings)
   */
  handleDrawingMutated(): void {
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        this.activeDrawings = [...(activeChart.drawings.all?.() || [])];
        const doc = activeChart.drawings.toJSON?.();
        if (doc) {
          const curSym = (this.workspace?.active as any)?.symbol || this.getSymbol();
          saveDrawingsDebounced(curSym, 'GLOBAL', doc);
        }
      } catch (err) {
        console.warn('Gagal memproses auto-save drawing:', err);
      }
    }
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
   * Muat dan pasang gambar yang tersimpan dari SQLite / Storage
   */
  async restoreDrawings(targetSymbol?: string, targetTimeframe?: string): Promise<void> {
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings) return;

    const sym = targetSymbol || (this.workspace?.active as any)?.symbol || this.getSymbol();
    const tf = targetTimeframe || (this.workspace?.active as any)?.timeframe || this.getTimeframe();

    try {
      // 1. Coba slot GLOBAL
      let doc = await loadDrawings(sym, 'GLOBAL');
      // 2. Fallback per timeframe
      if (!doc) {
        doc = await loadDrawings(sym, tf);
      }
      if (doc && activeChart.drawings) {
        activeChart.drawings.fromJSON(doc);
        this.activeDrawings = activeChart.drawings.all?.() || [];
        this.notify();
      }
    } catch (err) {
      console.warn('Gagal memulihkan drawings:', err);
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
