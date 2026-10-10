<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Scissors } from '@lucide/svelte';
  import { VelaWorkspace } from '@luxalgo/vela/workspace';
  import { BinanceProvider } from '@luxalgo/vela/providers/binance';
  import { HyperliquidProvider } from '@luxalgo/vela/providers/hyperliquid';
  import { CoinbaseProvider } from '@luxalgo/vela/providers/coinbase';
  import { BitunixProvider } from '../services/bitunixProvider';
  import { registerDefaultEngine } from '@luxalgo/vela';
  import { PineWorkerEngine } from '@luxalgo/vela-pinets';
  import {
    saveDrawingsDebounced,
    loadDrawings,
    clearDrawings
  } from '../services/drawingStorage';
  import type {
    Timeframe,
    ActiveIndicatorInfo,
    DrawingToolType,
    SnapMode,
    MultiChartSyncConfig
  } from '../types/market';

  export interface ReplayStateInfo {
    active: boolean;
    playing: boolean;
    cursorTime: number | null;
    remaining: number;
    bounds: { first: number; last: number } | null;
  }

  interface Props {
    symbol: string;
    timeframe: Timeframe;
    layout: string;
    providerId?: string;
    syncConfig?: MultiChartSyncConfig;
    showWatermark?: boolean;
    onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
    onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe }) => void;
    onReplayStateChange?: (state: ReplayStateInfo) => void;
    onCutoffSelected?: (timestamp: number) => void;
    onCutoffCancelled?: () => void;
  }

  let {
    symbol,
    timeframe,
    layout,
    providerId = 'binance',
    syncConfig = { crosshair: true, symbol: false, drawings: true },
    showWatermark = true,
    onActiveIndicatorsChange,
    onActiveCellChange,
    onReplayStateChange,
    onCutoffSelected,
    onCutoffCancelled,
  }: Props = $props();

  let chartContainer: HTMLDivElement | null = $state(null);
  let workspace: VelaWorkspace | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let isMounted = false;

  // Koleksi handle indikator aktif
  const indicatorHandles = new Map<string, any>();

  // Daftarkan PineTS worker engine satu kali secara global
  let staticEngineRegistered = false;
  function ensurePineEngine() {
    if (!staticEngineRegistered) {
      try {
        registerDefaultEngine('pine', () => new PineWorkerEngine());
        staticEngineRegistered = true;
      } catch (err) {
        console.warn('PineWorkerEngine info:', err);
      }
    }
  }

  /**
   * Muat dan pasang gambar yang tersimpan dari SQLite untuk chart aktif
   */
  async function restoreDrawingsForCurrentChart() {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      const curSym = (workspace.active as any).symbol || symbol;
      const curTf = (workspace.active as any).timeframe || timeframe;
      const doc = await loadDrawings(curSym, curTf);
      if (doc && activeChart?.drawings) {
        activeChart.drawings.fromJSON(doc);
      }
    } catch (err) {
      console.warn('Gagal me-restore drawings:', err);
    }
  }

  /**
   * Simpan dokumen gambar ke SQLite saat ada perubahan gambar
   */
  function handleDrawingMutated() {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        const doc = activeChart.drawings.toJSON();
        const curSym = (workspace.active as any).symbol || symbol;
        const curTf = (workspace.active as any).timeframe || timeframe;
        saveDrawingsDebounced(curSym, curTf, doc);
      }
    } catch (err) {
      console.warn('Gagal memproses auto-save drawing:', err);
    }
  }

  let isSelectingCutoff = $state(false);
  let lastHoveredBarTime = $state<number | null>(null);
  let cutlineX = $state<number | null>(null);
  let cutlineY = $state<number | null>(null);
  let hoveredBarDateText = $state<string>('');

  /**
   * Format timestamp ke format teks Indonesia yang rapi
   */
  function formatBarTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Helper untuk mendapatkan instans Coords dari Vela Chart Renderer
   */
  function getChartCoords(chart: any): any {
    if (!chart) return null;
    return chart.renderer?.renderer?.coords || chart.renderer?.coords || chart.coords || null;
  }

  /**
   * Hitung waktu lilin (timestamp) langsung dari koordinat pixel X mouse secara matematis
   */
  function getTimeFromClientX(clientX: number): number | null {
    if (!chartContainer || !workspace) return null;
    try {
      const activeChart = workspace.active?.chart as any;
      const coords = getChartCoords(activeChart);
      if (coords && typeof coords.xToLogical === 'function') {
        const rect = chartContainer.getBoundingClientRect();
        const localX = clientX - rect.left;
        const logical = Math.round(coords.xToLogical(localX));
        
        if (typeof coords.logicalToTime === 'function') {
          const time = coords.logicalToTime(logical);
          if (typeof time === 'number' && !isNaN(time) && time > 0) {
            return time;
          }
        }
        
        const innerRenderer = activeChart?.renderer?.renderer;
        if (Array.isArray(innerRenderer?.bars) && logical >= 0 && logical < innerRenderer.bars.length) {
          return innerRenderer.bars[logical]?.time ?? null;
        }
      }
    } catch (err) {
      console.warn('Gagal menghitung waktu lilin dari koordinat kursor:', err);
    }
    return null;
  }

  /**
   * Eksekusi pemotongan lilin (Cutoff Replay) dengan validasi batas aman
   */
  async function executeCutoff(rawTime: number) {
    if (!isSelectingCutoff) return;

    let targetTime = Math.floor(rawTime);

    // Validasi agar titik potong tidak melebihi atau sama dengan lilin terakhir,
    // karena engine Vela memerlukan minimal 1 lilin di depan untuk dimainkan.
    try {
      const bounds = getReplayBounds();
      const activeChart = workspace?.active?.chart as any;
      const innerRenderer = activeChart?.renderer?.renderer;
      const rawBars = activeChart?.rawBars || innerRenderer?.bars || (workspace as any)?.active?.rawBars;
      
      if (Array.isArray(rawBars) && rawBars.length >= 2) {
        const lastBar = rawBars[rawBars.length - 1];
        const prevBar = rawBars[rawBars.length - 2];
        if (targetTime >= lastBar.time) {
          targetTime = prevBar.time;
        }
      } else if (bounds && bounds.last && targetTime >= bounds.last) {
        targetTime = bounds.last - 60000;
      }
    } catch (_) {}

    // Selesaikan mode seleksi dan bersihkan garis panduan
    isSelectingCutoff = false;
    cutlineX = null;
    cutlineY = null;

    const success = await startReplay(targetTime);
    if (success) {
      onCutoffSelected?.(targetTime);
    }
  }

  /**
   * Handler pergerakan mouse pada container grafik saat mode potong lilin aktif
   */
  function handleContainerPointerMove(e: MouseEvent) {
    if (!isSelectingCutoff || !chartContainer) return;
    const rect = chartContainer.getBoundingClientRect();
    cutlineX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    cutlineY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const timeAtMouse = getTimeFromClientX(e.clientX) || lastHoveredBarTime;
    if (timeAtMouse) {
      lastHoveredBarTime = timeAtMouse;
      hoveredBarDateText = formatBarTime(timeAtMouse);
    }
  }

  /**
   * Bersihkan garis panduan saat kursor meninggalkan grafik
   */
  function handleContainerMouseLeave() {
    if (isSelectingCutoff) {
      cutlineX = null;
      cutlineY = null;
    }
  }

  /**
   * Tangkap klik mouse pada container grafik (Capture Phase) secara langsung
   */
  function handleContainerClickCapture(e: MouseEvent) {
    if (!isSelectingCutoff) return;

    // Abaikan jika klik terjadi pada tombol batal di banner petunjuk
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest('.cutoff-overlay-hint')) return;

    // Hentikan propagasi agar tidak memicu gesture panning atau seleksi drawing
    e.preventDefault();
    e.stopPropagation();

    // Prioritas 1: Waktu lilin langsung dari koordinat X mouse tempat klik terjadi
    let targetTime = getTimeFromClientX(e.clientX);
    // Prioritas 2: Waktu lilin dari event crosshair terakhir
    if (!targetTime) {
      targetTime = lastHoveredBarTime;
    }
    // Prioritas 3: Fallback ke batas bounds
    if (!targetTime) {
      const bounds = getReplayBounds();
      if (bounds?.last) {
        targetTime = bounds.last;
      }
    }

    if (targetTime) {
      executeCutoff(targetTime);
    }
  }

  /**
   * Mengirim snapshot status Bar Replay ke parent
   */
  function emitReplayState() {
    if (!workspace || !workspace.replay || !onReplayStateChange) return;
    try {
      const s = workspace.replay.state;
      const b = workspace.replay.bounds;
      onReplayStateChange({
        active: Boolean(s?.active),
        playing: Boolean(s?.playing),
        cursorTime: s?.cursorTime ?? null,
        remaining: s?.remaining ?? 0,
        bounds: b ?? null,
      });
    } catch (e) {
      console.warn('emitReplayState error:', e);
    }
  }

  /**
   * Pasang listener event replay pada workspace
   */
  function attachReplayListeners() {
    if (!workspace || !workspace.replay) return;
    try {
      workspace.replay.on('replay:start', emitReplayState);
      workspace.replay.on('replay:step', emitReplayState);
      workspace.replay.on('replay:play', emitReplayState);
      workspace.replay.on('replay:pause', emitReplayState);
      workspace.replay.on('replay:end', emitReplayState);
    } catch (e) {
      console.warn('attachReplayListeners error:', e);
    }
  }

  /**
   * Pasang event listeners untuk mendeteksi perubahan gambar
   */
  function attachDrawingListeners(chart: any) {
    if (!chart || !chart.on) return;
    try {
      chart.on('drawing:created', handleDrawingMutated);
      chart.on('drawing:updated', handleDrawingMutated);
      chart.on('drawing:removed', handleDrawingMutated);
    } catch (e) {
      console.warn('Error saat attach drawing listeners:', e);
    }
  }

  /**
   * Pasang listeners interaksi gambar dan klik seleksi replay
   */
  function attachCellListeners(cell: any) {
    if (!cell || !cell.chart) return;
    attachDrawingListeners(cell.chart);
    try {
      const renderer = cell.chart.renderer;
      if (renderer) {
        // 1. Dengarkan perpindahan kursor crosshair pada renderer
        renderer.onCrosshairMove?.((ev: any) => {
          if (ev && typeof ev.time === 'number') {
            lastHoveredBarTime = ev.time;
            hoveredBarDateText = formatBarTime(ev.time);
          }
        });

        // 2. Dengarkan onClick bawaan renderer sebagai lapis redundan
        renderer.onClick?.((ev: { time: number | null; price: number | null }) => {
          if (isSelectingCutoff && ev?.time) {
            executeCutoff(ev.time);
          }
        });
      }
    } catch (e) {
      console.warn('attachCellListeners error:', e);
    }
  }

  /**
   * Format simbol agar sesuai dengan konvensi penamaan bursa masing-masing di Vela
   */
  function resolveVelaSymbol(sym: string, pId: string): string {
    const clean = sym.includes(':') ? sym.split(':')[1] : sym;
    if (pId === 'hyperliquid') {
      const coin = clean.replace(/USDT$/, '').replace(/\.P$/, '');
      return `hyperliquid:${coin}`;
    } else if (pId === 'coinbase') {
      const base = clean.replace(/USDT$/, '').replace(/\.P$/, '');
      return `coinbase:${base}-USD`;
    } else if (pId === 'bitunix') {
      return `bitunix:${clean}`;
    }
    // Default Binance
    return `binance:${clean}`;
  }

  onMount(() => {
    if (!chartContainer) return;
    ensurePineEngine();

    try {
      const velaSym = resolveVelaSymbol(symbol, providerId);

      // Inisialisasi Vela Workspace dengan WebGL2 renderer dan multi-providers resmi
      workspace = new VelaWorkspace(chartContainer, {
        layout: layout as any,
        symbol: velaSym,
        timeframe: timeframe,
        drawingToolbar: false, // Gunakan toolbar kustom Trawangan agar tidak tumpang tindih
        topbar: { left: [], right: [] }, // Sembunyikan topbar bawaan Vela agar tidak tumpang tindih dengan header kustom
        live: true,
        theme: 'dark',
        providers: {
          binance: () => new BinanceProvider(),
          hyperliquid: () => new HyperliquidProvider(),
          coinbase: () => new CoinbaseProvider(),
          bitunix: () => new BitunixProvider(),
        },
        engines: {
          pine: () => new PineWorkerEngine(),
        },
        maxWebglCells: 8,
        sync: {
          crosshair: syncConfig.crosshair,
          style: true,
          drawings: syncConfig.drawings,
        },
      });

      // Atur listener drawing & interaksi untuk cell aktif awal
      const activeCell = workspace.active;
      if (activeCell) {
        attachCellListeners(activeCell);
      }

      // Pasang listener status replay
      attachReplayListeners();

      // Dengarkan pergantian cell aktif (multi-chart grid cell focus)
      (workspace as any).on?.('cell:active', (ev: any) => {
        const cur = workspace?.active;
        if (cur && onActiveCellChange) {
          const rawSym = (cur as any).symbol || symbol;
          const cleanSym = rawSym.includes(':') ? rawSym.split(':')[1] : rawSym;
          const curTf = (cur as any).timeframe || timeframe;
          onActiveCellChange({ symbol: cleanSym, timeframe: curTf });
          attachCellListeners(cur);
        }
      });

      isMounted = true;
      restoreDrawingsForCurrentChart();
    } catch (err) {
      console.error('Error saat menginisialisasi Vela Workspace:', err);
    }

    // Pasang listeners interaksi container untuk mode seleksi cut-off replay
    chartContainer.addEventListener('mousemove', handleContainerPointerMove);
    chartContainer.addEventListener('mouseleave', handleContainerMouseLeave);
    chartContainer.addEventListener('click', handleContainerClickCapture, true);
    chartContainer.addEventListener('pointerup', handleContainerClickCapture, true);

    // Pantau perubahan ukuran jendela agar chart responsif
    resizeObserver = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'));
    });
    resizeObserver.observe(chartContainer);
  });

  // Reaktif terhadap perubahan simbol atau provider aktif
  $effect(() => {
    if (isMounted && workspace && symbol) {
      try {
        if (workspace.active) {
          const targetSym = resolveVelaSymbol(symbol, providerId);
          workspace.active.setSymbol(targetSym);
          restoreDrawingsForCurrentChart();
        }
      } catch (e) {
        console.warn('setSymbol error:', e);
      }
    }
  });

  // Reaktif terhadap perubahan timeframe
  $effect(() => {
    if (isMounted && workspace && timeframe) {
      try {
        if (workspace.active) {
          workspace.active.setTimeframe(timeframe);
          restoreDrawingsForCurrentChart();
        }
      } catch (e) {
        console.warn('setTimeframe error:', e);
      }
    }
  });

  // Reaktif terhadap perubahan layout grid multi-chart
  $effect(() => {
    if (isMounted && workspace && layout) {
      try {
        workspace.setLayout(layout as any);
      } catch (e) {
        console.warn('setLayout error:', e);
      }
    }
  });

  // Reaktif terhadap konfigurasi sync
  $effect(() => {
    if (isMounted && workspace && syncConfig) {
      try {
        workspace.sync.set('crosshair', syncConfig.crosshair);
        workspace.sync.set('drawings', syncConfig.drawings);
      } catch (e) {
        console.warn('sync.set error:', e);
      }
    }
  });

  // Reaktif terhadap watermark (Bug 5)
  $effect(() => {
    if (isMounted && workspace) {
      try {
        const cellMap = (workspace as any).cellsById;
        const cells = cellMap ? Array.from(cellMap.values()) : [workspace.active];
        for (const cell of cells as any[]) {
          if (cell && typeof cell.setWatermarkVisible === 'function') {
            cell.setWatermarkVisible(showWatermark);
          }
        }
      } catch (e) {
        console.warn('setWatermarkVisible error:', e);
      }
    }
  });

  export function getActiveIndicators(): ActiveIndicatorInfo[] {
    const list: ActiveIndicatorInfo[] = [];
    for (const [id, item] of indicatorHandles.entries()) {
      list.push({
        id,
        title: item.title || item.handle?.title || 'Indicator',
        source: item.source || item.handle?.source,
        visible: item.visible ?? item.handle?.visible ?? true,
      });
    }
    return list;
  }

  function notifyActiveIndicators() {
    if (!onActiveIndicatorsChange) return;
    onActiveIndicatorsChange(getActiveIndicators());
  }

  // ─── Drawing Suite Public Methods ───

  export function setDrawingTool(tool: DrawingToolType | null): void {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        if (tool === 'measure') {
          activeChart.drawings.setMode('measure');
        } else if (tool === 'cursor' || tool === null) {
          activeChart.drawings.setMode(null);
          activeChart.drawings.setTool(null);
        } else {
          activeChart.drawings.setMode(null);
          activeChart.drawings.setTool(tool as any);
        }
      }
    } catch (e) {
      console.warn('setDrawingTool error:', e);
    }
  }

  export function setSnapMode(mode: SnapMode): void {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        activeChart.drawings.setSnapMode(mode);
      }
    } catch (e) {
      console.warn('setSnapMode error:', e);
    }
  }

  export function setStayMode(stay: boolean): void {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        activeChart.drawings.setStayMode(stay);
      }
    } catch (e) {
      console.warn('setStayMode error:', e);
    }
  }

  export function undoDrawing(): void {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        activeChart.drawings.undo();
        handleDrawingMutated();
      }
    } catch (e) {
      console.warn('undo error:', e);
    }
  }

  export function redoDrawing(): void {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        activeChart.drawings.redo();
        handleDrawingMutated();
      }
    } catch (e) {
      console.warn('redo error:', e);
    }
  }

  export async function clearAllDrawings(): Promise<void> {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        const all = activeChart.drawings.all();
        if (all.length > 0) {
          activeChart.drawings.removeMany(all.map((d: any) => d.id));
        }
      }
      const curSym = (workspace.active as any).symbol || symbol;
      const curTf = (workspace.active as any).timeframe || timeframe;
      await clearDrawings(curSym, curTf);
    } catch (e) {
      console.warn('clearAllDrawings error:', e);
    }
  }

  export function lockAllDrawings(lock: boolean): void {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        const all = activeChart.drawings.all();
        for (const d of all) {
          activeChart.drawings.lock(d.id, lock);
        }
        handleDrawingMutated();
      }
    } catch (e) {
      console.warn('lockAllDrawings error:', e);
    }
  }

  export function hideAllDrawings(hide: boolean): void {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        const all = activeChart.drawings.all();
        for (const d of all) {
          activeChart.drawings.show(d.id, !hide);
        }
        handleDrawingMutated();
      }
    } catch (e) {
      console.warn('hideAllDrawings error:', e);
    }
  }

  // ─── Indicator Public Methods ───

  export async function addPineIndicator(source: string, customTitle?: string): Promise<boolean> {
    if (!workspace || !workspace.active) return false;

    try {
      const cellMap = (workspace as any).cellsById;
      const cells = cellMap ? Array.from(cellMap.values()) : [workspace.active];
      let firstHandle = null;

      for (const cell of cells as any[]) {
        if (!cell || !cell.chart) continue;
        const handle = cell.chart.addIndicator(source, {
          language: 'pine',
          title: customTitle,
        });
        if (!firstHandle && handle) firstHandle = handle;
      }

      if (firstHandle) {
        indicatorHandles.set(firstHandle.id, {
          handle: firstHandle,
          title: customTitle || firstHandle.title || 'Custom Indicator',
          source,
          visible: firstHandle.visible ?? true,
        });
        notifyActiveIndicators();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Gagal menambahkan indikator ke chart:', err);
      throw err;
    }
  }

  // Alias agar pemanggilan via applyPineScript tetap kompatibel
  export const applyPineScript = addPineIndicator;

  export function removeIndicator(id: string): void {
    const item = indicatorHandles.get(id);
    if (item) {
      const handle = item.handle || item;
      try {
        if (typeof handle.remove === 'function') {
          handle.remove();
        }
      } catch (e) {
        console.warn('Gagal memanggil handle.remove:', e);
      }
      indicatorHandles.delete(id);
      notifyActiveIndicators();
    }
  }

  export function toggleIndicatorVisibility(id: string): void {
    const item = indicatorHandles.get(id);
    if (item) {
      const handle = item.handle || item;
      const nextVisible = !(item.visible ?? handle.visible ?? true);
      item.visible = nextVisible;
      try {
        if (typeof handle.setVisible === 'function') {
          handle.setVisible(nextVisible);
        }
      } catch (e) {
        console.warn('Gagal memanggil handle.setVisible:', e);
      }
      notifyActiveIndicators();
    }
  }

  export function getIndicatorSource(id: string): string | undefined {
    const item = indicatorHandles.get(id);
    return item ? (item.source || item.handle?.source) : undefined;
  }

  // ─── Bar Replay Public Methods ───

  export function enableCutoffSelection(): void {
    isSelectingCutoff = true;
    cutlineX = null;
    cutlineY = null;
  }

  export function cancelCutoffSelection(): void {
    isSelectingCutoff = false;
    cutlineX = null;
    cutlineY = null;
    onCutoffCancelled?.();
  }

  export function isCutoffSelectionActive(): boolean {
    return isSelectingCutoff;
  }

  export function getReplayBounds(): { first: number; last: number } | null {
    return workspace?.replay?.bounds ?? null;
  }

  export function getReplayState(): any {
    return workspace?.replay?.state ?? null;
  }

  export async function startReplay(fromTimestamp?: number): Promise<boolean> {
    if (!workspace || !workspace.replay) return false;
    try {
      let targetTime = fromTimestamp;
      if (!targetTime) {
        const bounds = workspace.replay.bounds;
        if (bounds && bounds.first && bounds.last) {
          const span = bounds.last - bounds.first;
          targetTime = Math.max(bounds.first, bounds.last - Math.min(span * 0.25, 100 * 60 * 1000));
        } else {
          targetTime = Date.now() - 3 * 3600 * 1000;
        }
      }
      await workspace.replay.start({ from: targetTime });
      emitReplayState();
      return true;
    } catch (err) {
      console.warn('Gagal memulai Bar Replay:', err);
      return false;
    }
  }

  export function playReplay(speed = 1): void {
    if (!workspace || !workspace.replay) return;
    const intervalMs = Math.round(1000 / Math.max(0.2, speed));
    workspace.replay.play(intervalMs);
  }

  export function pauseReplay(): void {
    if (!workspace || !workspace.replay) return;
    workspace.replay.pause();
  }

  export function stepReplay(): void {
    if (!workspace || !workspace.replay) return;
    workspace.replay.step();
  }

  export function stopReplay(): void {
    if (!workspace || !workspace.replay) return;
    try {
      isSelectingCutoff = false;
      cutlineX = null;
      cutlineY = null;
      workspace.replay.stop();
      emitReplayState();
    } catch (e) {
      console.warn('stopReplay error:', e);
    }
  }

  export function isReplaying(): boolean {
    return Boolean(workspace?.replay?.state?.active);
  }

  export function fitChart(): void {
    if (!workspace || !workspace.active) return;
    try {
      const c = workspace.active.chart as any;
      if (typeof c.fit === 'function') c.fit();
      else if (typeof c.resetScale === 'function') c.resetScale();
    } catch (_) {}
  }

  onDestroy(() => {
    if (chartContainer) {
      try {
        chartContainer.removeEventListener('mousemove', handleContainerPointerMove);
        chartContainer.removeEventListener('mouseleave', handleContainerMouseLeave);
        chartContainer.removeEventListener('click', handleContainerClickCapture, true);
        chartContainer.removeEventListener('pointerup', handleContainerClickCapture, true);
      } catch (_) {}
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    try {
      if (workspace && typeof (workspace as any).destroy === 'function') {
        (workspace as any).destroy();
      }
    } catch (e) {}
  });
</script>

<div class="chart-wrapper {isSelectingCutoff ? 'selecting-cutoff' : ''}">
  <div bind:this={chartContainer} class="vela-container"></div>

  {#if isSelectingCutoff}
    <!-- Panduan Garis Vertikal Pemotong Lilin (Vertical Cutline Guide) -->
    {#if cutlineX !== null}
      <div 
        class="vertical-cutline" 
        style="left: {cutlineX}px;"
      >
        <div 
          class="cutline-scissors-badge obsidian-card mono-nums" 
          style="top: {Math.max(48, Math.min((cutlineY ?? 80) - 28, 420))}px;"
        >
          <Scissors size={12} class="badge-cut-icon" />
          <span>{hoveredBarDateText || 'Klik lilin untuk potong'}</span>
        </div>
      </div>
    {/if}

    <div class="cutoff-overlay-hint">
      <div class="hint-pill obsidian-card">
        <Scissors size={13} class="hint-icon" />
        <span class="hint-text mono-nums">KLIK LILIN DI GRAFIK UNTUK MEMULAI REPLAY DARI TITIK TERSEBUT</span>
        <button type="button" class="cancel-hint-btn" onclick={cancelCutoffSelection}>
          Batal (Esc)
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .chart-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background-color: var(--bg-darkest);
  }

  .chart-wrapper.selecting-cutoff :global(canvas) {
    cursor: crosshair !important;
  }

  .vela-container {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  /* Garis panduan vertikal pemotong lilin presisi */
  .vertical-cutline {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: repeating-linear-gradient(
      to bottom,
      var(--bear-color) 0,
      var(--bear-color) 4px,
      transparent 4px,
      transparent 8px
    );
    pointer-events: none;
    z-index: 25;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
  }

  .cutline-scissors-badge {
    position: absolute;
    left: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: rgba(16, 19, 26, 0.95);
    border: 1px solid var(--bear-color);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.7), 0 0 8px var(--bear-glow);
    padding: 3px 8px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-main);
    white-space: nowrap;
    pointer-events: none;
    animation: fadeIn 0.15s ease-out;
  }

  .badge-cut-icon {
    color: var(--bear-color);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .cutoff-overlay-hint {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    pointer-events: none;
    animation: fadeInDown 0.2s ease-out;
  }

  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translate(-50%, -8px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  .hint-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: rgba(16, 19, 26, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid var(--bear-color);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.65), 0 0 10px var(--bear-glow);
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    pointer-events: auto;
  }

  .hint-icon {
    color: var(--bear-color);
  }

  .hint-text {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
    letter-spacing: 0.02em;
  }

  .cancel-hint-btn {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    padding: 2px 8px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .cancel-hint-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }
</style>
