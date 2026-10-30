import type { DrawingToolType, SnapMode } from '../types/market';
import {
  saveDrawingsDebounced,
  loadDrawings,
  clearDrawings,
  flushDrawings
} from './persistence';
import type { CommandDispatcher } from './commandDispatcher';
import { roundToTickSize } from './priceSnapService';
import {
  recognizeGesture,
  type GesturePoint,
  type GestureRecognitionResult,
  type GestureRecognizerOptions
} from './gestureDrawingRecognizer';

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
   * dan membuat objek gambar definitif pada drawing layer grafik.
   */
  finishGestureStroke(options?: GestureRecognizerOptions): GestureRecognitionResult | null {
    if (this.liveGestureStroke.length < 2) {
      this.liveGestureStroke = [];
      return null;
    }

    const stroke = [...this.liveGestureStroke];
    this.liveGestureStroke = [];

    const result = recognizeGesture(stroke, options);

    if (result.tool) {
      this.createDrawing({
        type: result.tool,
        points: result.points
      });

      // Jika stayMode false dan bukan transient hold, kembalikan ke kursor
      if (!this.stayMode && !this.isHoldingGestureKey) {
        this.setTool('cursor');
      }
    }

    return result;
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
    const activeChart = this.getActiveChart();
    if (!activeChart?.drawings) return;

    try {
      if (typeof activeChart.drawings.removeMany === 'function') {
        activeChart.drawings.removeMany([id]);
      } else if (typeof activeChart.drawings.remove === 'function') {
        activeChart.drawings.remove(id);
      }
      if (this.selectedDrawingId === id) {
        this.selectedDrawingId = null;
      }
      this.handleDrawingMutated();
    } catch (err) {
      console.warn(`Gagal menghapus drawing ${id}:`, err);
    }
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
    if (this.isRestoring) return; // Abaikan saat proses pembersihan / pemulihan berlangsung
    const activeChart = this.getActiveChart();
    if (activeChart?.drawings) {
      try {
        this.activeDrawings = [...(activeChart.drawings.all?.() || [])];

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
      this.notify();
    } catch (err) {
      console.warn('Gagal memulihkan drawings:', err);
    } finally {
      this.isRestoring = false;
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
