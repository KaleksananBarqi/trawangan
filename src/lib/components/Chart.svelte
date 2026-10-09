<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { VelaWorkspace } from '@luxalgo/vela/workspace';
  import { BinanceProvider } from '@luxalgo/vela/providers/binance';
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

  interface Props {
    symbol: string;
    timeframe: Timeframe;
    layout: string;
    syncConfig?: MultiChartSyncConfig;
    showWatermark?: boolean;
    onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
    onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe }) => void;
  }

  let {
    symbol,
    timeframe,
    layout,
    syncConfig = { crosshair: true, symbol: false, drawings: true },
    showWatermark = true,
    onActiveIndicatorsChange,
    onActiveCellChange,
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

  onMount(() => {
    if (!chartContainer) return;
    ensurePineEngine();

    try {
      const velaSym = symbol.includes(':') ? symbol : `binance:${symbol}`;

      // Inisialisasi Vela Workspace dengan WebGL2 renderer dan provider resmi Binance
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

      // Atur listener drawing untuk cell aktif awal
      const activeCell = workspace.active;
      if (activeCell) {
        attachDrawingListeners(activeCell.chart);
      }

      // Dengarkan pergantian cell aktif (multi-chart grid cell focus)
      (workspace as any).on?.('cell:active', (ev: any) => {
        const cur = workspace?.active;
        if (cur && onActiveCellChange) {
          const rawSym = (cur as any).symbol || symbol;
          const cleanSym = rawSym.includes(':') ? rawSym.split(':')[1] : rawSym;
          const curTf = (cur as any).timeframe || timeframe;
          onActiveCellChange({ symbol: cleanSym, timeframe: curTf });
          attachDrawingListeners(cur.chart);
        }
      });

      isMounted = true;
      restoreDrawingsForCurrentChart();
    } catch (err) {
      console.error('Error saat menginisialisasi Vela Workspace:', err);
    }

    // Pantau perubahan ukuran jendela agar chart responsif
    resizeObserver = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'));
    });
    resizeObserver.observe(chartContainer);
  });

  // Reaktif terhadap perubahan simbol
  $effect(() => {
    if (isMounted && workspace && symbol) {
      try {
        if (workspace.active) {
          const targetSym = symbol.includes(':') ? symbol : `binance:${symbol}`;
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
      workspace.replay.stop();
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

<div class="chart-wrapper">
  <div bind:this={chartContainer} class="vela-container"></div>
</div>

<style>
  .chart-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background-color: var(--bg-darkest);
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
</style>
