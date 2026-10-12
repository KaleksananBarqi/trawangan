<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Scissors, Bell, X } from '@lucide/svelte';
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
    clearDrawings,
    loadChartDefaultConfig,
    saveChartDefaultConfig,
    clearChartDefaultConfig
  } from '../services/persistence';
  import { getHistoricalCandles } from '../services/marketProvider';
  import { alertService } from '../services/alertService';
  import { replaySession, type ReplayDriver } from '../services/replay';
  import ChartContextMenu from './ChartContextMenu.svelte';
  import type {
    Timeframe,
    ActiveIndicatorInfo,
    DrawingToolType,
    SnapMode,
    MultiChartSyncConfig,
    Candle,
    StrategyPerformanceSummary,
    StrategyTradeRecord,
    PriceAlert,
    ThemePresetId
  } from '../types/market';
  import { THEME_PRESETS } from '../constants/themes';
  import { applyLayoutTimeframePolicy } from '../constants/defaults';
  import { toVelaTimeframe, fromVelaTimeframe } from '../utils/timeframeAdapter';


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
    defaultTimeframe?: Timeframe;
    layout: string;
    providerId?: string;
    syncConfig?: MultiChartSyncConfig;
    showWatermark?: boolean;
    onActiveIndicatorsChange?: (indicators: ActiveIndicatorInfo[]) => void;
    onActiveCellChange?: (cellInfo: { symbol: string; timeframe: Timeframe }) => void;
    onReplayStateChange?: (state: ReplayStateInfo) => void;
    onCutoffSelected?: (timestamp: number) => void;
    onCutoffCancelled?: () => void;
    onStrategyUpdate?: (summary: StrategyPerformanceSummary) => void;
    onRequestCreateAlert?: (symbol: string, price: number) => void;
    themePreset?: ThemePresetId;
    fontSize?: number;
  }

  let {
    symbol,
    timeframe,
    defaultTimeframe = '15m',
    layout,
    providerId = 'binance',
    themePreset = 'signature',
    fontSize = 12,
    syncConfig = { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    showWatermark = true,
    onActiveIndicatorsChange,
    onActiveCellChange,
    onReplayStateChange,
    onCutoffSelected,
    onCutoffCancelled,
    onStrategyUpdate,
    onRequestCreateAlert,
  }: Props = $props();

  let chartContainer: HTMLDivElement | null = $state(null);
  let workspace: VelaWorkspace | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let isMounted = false;
  let unsubAlerts: (() => void) | null = null;

  let chartSettingsObserver: MutationObserver | null = null;
  let activeChartDefaultConfig: any = null;
  let isApplyingLayout = false;
  let lastAppliedLayout = '';

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
   * Helper internal untuk mengambil seluruh cell yang aktif di workspace secara tangguh
   */
  function getAllWorkspaceCells(): any[] {
    if (!workspace) return [];
    try {
      if (typeof (workspace as any).cells === 'function') {
        const list = Array.from((workspace as any).cells());
        if (list.length > 0) return list;
      }
    } catch (_) {}
    try {
      const cellMap = (workspace as any).cellsById;
      if (cellMap && typeof cellMap.values === 'function') {
        const list = Array.from(cellMap.values());
        if (list.length > 0) return list;
      }
    } catch (_) {}
    return workspace.active ? [workspace.active] : [];
  }

  /**
   * Terapkan konfigurasi default chart ke seluruh cell atau cell tertentu
   */
  function applySavedChartDefaultConfig(targetCell?: any) {
    if (!activeChartDefaultConfig || !workspace) return;
    try {
      const cells = targetCell ? [targetCell] : getAllWorkspaceCells();
      for (const cell of cells) {
        const renderer = (cell as any)?.chart?.renderer;
        if (renderer && typeof renderer.applyConfig === 'function') {
          renderer.applyConfig(activeChartDefaultConfig);
          renderer.factoryConfig = activeChartDefaultConfig;
        }
      }
    } catch (err) {
      console.warn('Gagal menerapkan saved chart default config:', err);
    }
  }

  /**
   * Simpan konfigurasi chart aktif saat ini sebagai setelan default permanen
   */
  export async function saveCurrentChartSettingsAsDefault(buttonEl?: HTMLElement): Promise<boolean> {
    if (!workspace || !workspace.active) return false;
    try {
      const activeChart = workspace.active.chart as any;
      const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
      const currentConfig = renderer?.getConfig?.() || activeChart?.getConfig?.();

      if (!currentConfig) {
        console.warn('Gagal membaca getConfig() dari chart renderer aktif');
        return false;
      }

      // 1. Simpan ke state lokal memory
      activeChartDefaultConfig = currentConfig;

      // 2. Simpan ke SQLite & localStorage
      await saveChartDefaultConfig(currentConfig);

      // 3. Perbarui factoryConfig pada seluruh cell agar tombol "Reset defaults" selaras
      for (const cell of workspace.cells()) {
        const r = (cell as any)?.chart?.renderer;
        if (r) {
          r.factoryConfig = currentConfig;
        }
      }

      // 4. Terapkan konfigurasi ke seluruh cell aktif (multi-chart sync)
      for (const cell of workspace.cells()) {
        if (cell !== workspace.active) {
          (cell as any)?.chart?.renderer?.applyConfig?.(currentConfig);
        }
      }

      // 5. Animasi feedback visual pada tombol jika tersedia
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
      console.error('Error saat menyimpan chart settings as default:', err);
      return false;
    }
  }

  /**
   * Reset konfigurasi lilin & chart kembali ke setelan awal pabrik Vela
   */
  export async function resetChartSettingsToFactory(): Promise<void> {
    try {
      activeChartDefaultConfig = null;
      await clearChartDefaultConfig();
      if (workspace) {
        for (const cell of workspace.cells()) {
          const r = (cell as any)?.chart?.renderer;
          if (r && typeof r.factoryResetDocument === 'function') {
            const orig = r.factoryConfig;
            if (orig) {
              r.applyConfig(r.factoryResetDocument(orig));
            }
          }
        }
      }
    } catch (err) {
      console.warn('Gagal reset chart settings ke pabrik:', err);
    }
  }

  /**
   * Buka modal dialog pengaturan grafik Vela (Warna bar, lilin, canvas, skala, dll)
   * Memastikan dialog terbuka dan fokus pada tab yang sesuai (default: 'Symbol')
   */
  export function openChartSettings(section: string = 'Symbol'): void {
    if (!workspace) return;
    try {
      const activeCell = (workspace.active || Array.from(workspace.cells())[0]) as any;
      if (!activeCell) return;

      // Pastikan cell terdaftar aktif di workspace
      if (!workspace.active && typeof (workspace as any).setActive === 'function') {
        try {
          (workspace as any).setActive(activeCell);
        } catch (_) {}
      }

      const chart = activeCell.chart;
      const rendererControl = chart?.renderer;
      const nativeRenderer = rendererControl?.renderer || rendererControl;

      // Jika dialog pengaturan sudah terbuka, arahkan ke tab yang diminta tanpa menutupnya (mencegah toggle close)
      if (nativeRenderer?.settingsDialog && typeof nativeRenderer.settingsDialog.isOpen === 'function') {
        if (nativeRenderer.settingsDialog.isOpen()) {
          if (typeof nativeRenderer.settingsDialog.showSection === 'function') {
            nativeRenderer.settingsDialog.showSection(section);
          }
          return;
        }
      }

      // 1. Standar resmi Vela Workspace: rendererControl.openSettings(section)
      if (typeof rendererControl?.openSettings === 'function') {
        rendererControl.openSettings(section);
        return;
      }

      // 2. Direct call ke inner NativeChartRenderer
      if (typeof nativeRenderer?.openSettingsDialog === 'function') {
        nativeRenderer.openSettingsDialog(section);
        return;
      }

      // 3. Fallback jika rendererControl langsung memiliki openSettingsDialog
      if (typeof rendererControl?.openSettingsDialog === 'function') {
        rendererControl.openSettingsDialog(section);
        return;
      }

      // 4. Fallback chart level
      if (typeof chart?.openSettings === 'function') {
        chart.openSettings(section);
        return;
      }
    } catch (err) {
      console.warn('Gagal membuka pengaturan chart:', err);
    }
  }

  /**
   * Pasang observer untuk mendeteksi kemunculan modal Chart Settings Vela
   * dan menyisipkan tombol "Simpan sebagai default" di samping tombol "Reset defaults"
   */
  function initChartSettingsModalObserver() {
    if (typeof document === 'undefined') return;

    const checkAndInjectButton = () => {
      const dialogs = document.querySelectorAll('.vela-dialog--settings');
      if (!dialogs || dialogs.length === 0) return;

      for (const dialog of Array.from(dialogs)) {
        // Cari tombol "Reset defaults" di dalam footer dialog
        const buttons = Array.from(dialog.querySelectorAll('button'));
        const resetBtn = buttons.find((b) => b.textContent?.trim() === 'Reset defaults');
        if (!resetBtn || !resetBtn.parentElement) continue;

        const footer = resetBtn.parentElement;
        if (footer.querySelector('.trawangan-save-default-btn')) continue;

        // Buat tombol "Simpan sebagai default"
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'vela-sd-btn trawangan-save-default-btn';
        saveBtn.title = 'Simpan warna bar, lilin, dan konfigurasi grafik ini sebagai setelan default permanen';
        saveBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; flex-shrink: 0;">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span>Simpan sebagai default</span>
        `;

        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          saveCurrentChartSettingsAsDefault(saveBtn);
        });

        // Sisipkan tombol tepat setelah tombol "Reset defaults"
        footer.appendChild(saveBtn);
      }
    };

    chartSettingsObserver = new MutationObserver(() => {
      checkAndInjectButton();
    });

    chartSettingsObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Jalankan pengecekan langsung jika dialog sudah terbuka
    checkAndInjectButton();
  }

  /**
   * Muat dan pasang gambar yang tersimpan dari SQLite untuk chart aktif
   * Prioritaskan slot 'GLOBAL' agar key levels terlihat lintas seluruh timeframe (standar TradingView)
   */
  async function restoreDrawingsForCurrentChart() {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      const curSym = (workspace.active as any).symbol || symbol;
      const curTf = (workspace.active as any).timeframe || timeframe;
      // 1. Coba muat drawing global lintas timeframe
      let doc = await loadDrawings(curSym, 'GLOBAL');
      // 2. Fallback jika belum ada data global: muat drawing lama per timeframe spesifik
      if (!doc) {
        doc = await loadDrawings(curSym, curTf);
      }
      if (doc && activeChart?.drawings) {
        activeChart.drawings.fromJSON(doc);
      }
    } catch (err) {
      console.warn('Gagal me-restore drawings:', err);
    }
  }

  /**
   * Simpan dokumen gambar ke SQLite saat ada perubahan gambar
   * Selalu simpan ke slot 'GLOBAL' per simbol agar tersinkronisasi di seluruh timeframe
   */
  function handleDrawingMutated() {
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart;
      if (activeChart?.drawings) {
        const doc = activeChart.drawings.toJSON();
        const curSym = (workspace.active as any).symbol || symbol;
        saveDrawingsDebounced(curSym, 'GLOBAL', doc);
      }
    } catch (err) {
      console.warn('Gagal memproses auto-save drawing:', err);
    }
  }

  let isSelectingCutoff = $state(false);
  let lastHoveredBarTime = $state<number | null>(null);
  let lastHoveredPrice = $state<number | null>(null);
  let cutlineX = $state<number | null>(null);
  let cutlineY = $state<number | null>(null);
  let hoveredBarDateText = $state<string>('');

  // Context Menu State
  let isContextMenuOpen = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);
  let contextMenuPrice = $state<number | null>(null);
  let contextMenuTime = $state<number | null>(null);

  // Price Alert Visual Overlays
  let allAlerts = $state<PriceAlert[]>([]);
  let activeSymbolAlerts = $derived.by(() => {
    const clean = symbol.replace('.P', '').toUpperCase();
    return allAlerts.filter((a) => a.symbol.replace('.P', '').toUpperCase() === clean);
  });
  let alertYPositions = $state<Record<string, number | null>>({});
  let alertPositionInterval: any = null;

  function formatPrice(p: number | null): string {
    if (p === null || p === undefined || isNaN(p)) return '--';
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  }

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
   * Hitung harga tepat dari koordinat pixel Y mouse
   */
  function getPriceFromClientY(clientY: number): number | null {
    if (!chartContainer || !workspace || !workspace.active) return null;
    try {
      const rect = chartContainer.getBoundingClientRect();
      const localY = clientY - rect.top;
      const activeChart = workspace.active.chart as any;
      const coords = getChartCoords(activeChart);
      const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
      const pane = renderer?.paneNodeAtY ? renderer.paneNodeAtY(localY) : (renderer?.panes?.[0] || renderer?.pricePane);

      if (coords && typeof coords.yToPrice === 'function' && pane) {
        const scale = pane.scale || activeChart.scale;
        const bounds = pane.bounds || activeChart.bounds;
        if (scale && bounds) {
          const p = coords.yToPrice(localY, scale, bounds);
          if (typeof p === 'number' && !isNaN(p) && p > 0) {
            return p;
          }
        }
      }
    } catch (err) {
      console.warn('Gagal menghitung harga dari koordinat Y:', err);
    }
    return null;
  }

  /**
   * Hitung koordinat pixel Y untuk target harga tertentu pada grafik
   */
  function getAlertY(targetPrice: number): number | null {
    if (!chartContainer || !workspace || !workspace.active) return null;
    try {
      const activeChart = workspace.active.chart as any;
      const coords = getChartCoords(activeChart);
      const renderer = activeChart?.renderer?.renderer || activeChart?.renderer;
      const pane = renderer?.paneNodeAtY ? renderer.paneNodeAtY(50) : (renderer?.panes?.[0] || renderer?.pricePane);
      if (coords && typeof coords.priceToY === 'function' && pane) {
        const scale = pane.scale || activeChart.scale;
        const bounds = pane.bounds || activeChart.bounds;
        if (scale && bounds) {
          const y = coords.priceToY(targetPrice, scale, bounds);
          if (typeof y === 'number' && !isNaN(y)) {
            return y;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  /**
   * Perbarui posisi Y dari seluruh alert aktif untuk simbol ini
   */
  function updateAlertYPositions() {
    if (!workspace || !workspace.active || activeSymbolAlerts.length === 0) {
      alertYPositions = {};
      return;
    }
    const pos: Record<string, number | null> = {};
    for (const a of activeSymbolAlerts) {
      pos[a.id] = getAlertY(a.targetPrice);
    }
    alertYPositions = pos;
  }

  /**
   * Handler event klik kanan (context menu) pada canvas grafik
   * Menangkap event klik kanan baik dari container langsung maupun global window capture phase
   */
  function handleContainerContextMenu(e: MouseEvent) {
    if (isSelectingCutoff) return;
    if (!chartContainer) return;

    // Periksa apakah kursor berada di dalam area canvas grafik
    const rect = chartContainer.getBoundingClientRect();
    const isInside = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
    if (!isInside) return;

    // Cegah menu default browser atau menu internal Vela yang memblokir
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();

    // Hitung harga tepat dari koordinat Y klik mouse
    let detected = getPriceFromClientY(e.clientY) || lastHoveredPrice;
    if (!detected || detected <= 0) {
      const activeChart = workspace?.active?.chart as any;
      const innerRenderer = activeChart?.renderer?.renderer;
      const rawBars = activeChart?.rawBars || innerRenderer?.bars;
      if (Array.isArray(rawBars) && rawBars.length > 0) {
        detected = rawBars[rawBars.length - 1].close;
      }
    }

    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    contextMenuPrice = detected ?? null;
    contextMenuTime = lastHoveredBarTime ?? null;
    isContextMenuOpen = true;
  }

  function handleCreateAlertFromMenu(targetSym: string, targetPrice: number) {
    isContextMenuOpen = false;
    if (onRequestCreateAlert) {
      onRequestCreateAlert(targetSym, targetPrice);
    } else {
      alertService.addAlert({
        symbol: targetSym,
        targetPrice,
        condition: 'crossing',
        label: `Alert ${targetSym} @ ${formatPrice(targetPrice)}`
      });
    }
  }

  function handleDrawHorizontalLine(linePrice: number) {
    isContextMenuOpen = false;
    if (!workspace || !workspace.active) return;
    try {
      const activeChart = workspace.active.chart as any;
      if (activeChart?.drawings) {
        activeChart.drawings.create?.({
          type: 'hline',
          price: linePrice,
        });
        handleDrawingMutated();
      }
    } catch (e) {
      console.warn('handleDrawHorizontalLine error:', e);
    }
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
      replaySession.setCutoff(targetTime);
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
   * Mengirim snapshot status Bar Replay ke replaySession dan parent
   */
  function emitReplayState() {
    if (!workspace || !workspace.replay) return;
    try {
      const s = workspace.replay.state;
      const b = workspace.replay.bounds;
      const payload: ReplayStateInfo = {
        active: Boolean(s?.active),
        playing: Boolean(s?.playing),
        cursorTime: s?.cursorTime ?? null,
        remaining: s?.remaining ?? 0,
        bounds: b ?? null,
      };
      replaySession.notifyDriverState(payload);
      onReplayStateChange?.(payload);
    } catch (e) {
      console.warn('emitReplayState error:', e);
    }
  }

  // Driver Seam: Mengaitkan engine Vela Workspace dengan deep ReplaySession
  const chartReplayDriver: ReplayDriver = {
    getBounds: () => getReplayBounds(),
    start: async (targetTime: number) => startReplay(targetTime),
    play: (intervalMs: number) => {
      if (workspace?.replay) workspace.replay.play(intervalMs);
    },
    pause: () => {
      if (workspace?.replay) workspace.replay.pause();
    },
    step: () => {
      if (workspace?.replay) workspace.replay.step();
    },
    stop: () => {
      stopReplay();
    },
    getState: () => {
      if (!workspace?.replay) return null;
      const s = workspace.replay.state;
      return {
        active: Boolean(s?.active),
        playing: Boolean(s?.playing),
        cursorTime: s?.cursorTime ?? null,
        remaining: s?.remaining ?? 0,
      };
    },
    enableCutoffVisual: () => enableCutoffSelection(),
    cancelCutoffVisual: () => cancelCutoffSelection(),
  };

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
   * Pasang event listeners untuk mendeteksi perubahan parameter, visibilitas, dan status indikator
   */
  function attachIndicatorListeners(chart: any) {
    if (!chart || !chart.on) return;
    try {
      chart.on('indicator:inputs', () => {
        notifyActiveIndicators();
      });
      chart.on('indicator:props', () => {
        notifyActiveIndicators();
      });
      chart.on('indicator:visibility', () => {
        notifyActiveIndicators();
      });
      chart.on('indicator:removed', () => {
        notifyActiveIndicators();
      });
    } catch (e) {
      console.warn('Error saat attach indicator listeners:', e);
    }
  }

  /**
   * Pasang listeners interaksi gambar, indikator, dan klik seleksi replay
   */
  function attachCellListeners(cell: any) {
    if (!cell || !cell.chart) return;
    attachDrawingListeners(cell.chart);
    attachIndicatorListeners(cell.chart);
    try {
      const renderer = cell.chart.renderer;
      if (renderer) {
        // 1. Dengarkan perpindahan kursor crosshair pada renderer
        renderer.onCrosshairMove?.((ev: any) => {
          if (ev) {
            if (typeof ev.time === 'number') {
              lastHoveredBarTime = ev.time;
              hoveredBarDateText = formatBarTime(ev.time);
            }
            if (typeof ev.price === 'number' && ev.price > 0) {
              lastHoveredPrice = ev.price;
            }
            updateAlertYPositions();
          }
        });

        // 2. Dengarkan onClick bawaan renderer sebagai lapis redundan
        renderer.onClick?.((ev: { time: number | null; price: number | null }) => {
          if (isSelectingCutoff && ev?.time) {
            executeCutoff(ev.time);
          }
        });

        // Terapkan konfigurasi default chart jika pengguna telah menyimpannya
        if (activeChartDefaultConfig) {
          applySavedChartDefaultConfig(cell);
        }
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

  // Reaktif sinkronisasi tema workspace Vela saat preset atau ukuran font berganti
  $effect(() => {
    if (workspace && (themePreset || fontSize)) {
      const cfg = THEME_PRESETS[themePreset || 'signature'] || THEME_PRESETS.signature;
      const t = {
        background: cfg.chart.background,
        textColor: cfg.chart.textColor,
        gridColor: cfg.chart.gridColor,
        borderColor: cfg.chart.borderColor,
        upColor: activeChartDefaultConfig?.candles?.upColor || cfg.chart.upColor,
        downColor: activeChartDefaultConfig?.candles?.downColor || cfg.chart.downColor,
        fontSize: Math.max(9, Math.min(32, Math.round(fontSize))),
        fontFamily: "var(--font-sans, 'Plus Jakarta Sans', sans-serif)",
      };
      try {
        workspace.setTheme(t as any);
        if (activeChartDefaultConfig) {
          applySavedChartDefaultConfig();
        }
      } catch (err) {
        console.warn('Gagal memperbarui tema workspace Vela:', err);
      }
    }
  });


  onMount(() => {
    if (!chartContainer) return;
    ensurePineEngine();

    try {
      const velaSym = resolveVelaSymbol(symbol, providerId);

      const themeConfig = THEME_PRESETS[themePreset || 'signature'] || THEME_PRESETS.signature;
      const velaTheme = {
        background: themeConfig.chart.background,
        textColor: themeConfig.chart.textColor,
        gridColor: themeConfig.chart.gridColor,
        borderColor: themeConfig.chart.borderColor,
        upColor: themeConfig.chart.upColor,
        downColor: themeConfig.chart.downColor,
        fontSize: Math.max(9, Math.min(32, Math.round(fontSize))),
        fontFamily: "var(--font-sans, 'Plus Jakarta Sans', sans-serif)",
      };

      // Inisialisasi Vela Workspace dengan WebGL2 renderer dan multi-providers resmi
      workspace = new VelaWorkspace(chartContainer, {
        layout: layout as any,
        symbol: velaSym,
        timeframe: toVelaTimeframe(timeframe),
        drawingToolbar: false, // Gunakan toolbar kustom Trawangan agar tidak tumpang tindih
        topbar: { left: [], right: [] }, // Sembunyikan topbar bawaan Vela agar tidak tumpang tindih dengan header kustom
        live: true,
        theme: velaTheme as any,
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
          viewport: syncConfig.viewport ?? true,
          style: true,
          drawings: syncConfig.drawings,
          symbol: syncConfig.symbol,
        },
      });

      // Atur listener drawing & interaksi untuk seluruh cell di workspace
      for (const cell of workspace.cells()) {
        attachCellListeners(cell);
      }

      // Dengarkan pembuatan cell baru di workspace (saat berganti layout)
      (workspace as any).on?.('cell:created', ({ id }: { id: string }) => {
        const cell = workspace?.cell(id);
        if (cell) {
          attachCellListeners(cell);
        }
      });

      // Pasang listener status replay & kaitkan driver ke session
      attachReplayListeners();
      replaySession.bindDriver(chartReplayDriver);

      // Dengarkan eksekusi script / kalkulasi strategi dari seluruh cell di workspace
      let lastStrategyEmitAt = 0;
      const STRATEGY_EMIT_THROTTLE_MS = 1500;

      (workspace as any).on?.('script:run', async (run: any) => {
        if (!run) return;
        if (run.kind === 'strategy' || run.strategy) {
          const now = Date.now();
          // Throttling: Batasi pemrosesan serialisasi trade agar tidak membanjiri event loop saat streaming tick Binance
          if (!run.first && now - lastStrategyEmitAt < STRATEGY_EMIT_THROTTLE_MS) {
            return;
          }
          lastStrategyEmitAt = now;

          try {
            const strat = run.strategy;
            const rawTrades = typeof run.trades === 'function' ? await run.trades() : [];
            const initialCapital = Number(strat?.initialCapital) || 1000;
            const netProfit = Number(strat?.netPnl) || 0;
            const grossProfit = Number(strat?.grossProfit) || 0;
            const grossLoss = Number(strat?.grossLoss) || 0;
            const equity = Number(strat?.equity) || (initialCapital + netProfit);
            const netProfitPercent = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;
            const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 999 : 0);
            const wintrades = Number(strat?.wins) || 0;
            const losstrades = Number(strat?.losses) || 0;
            const eventrades = Number(strat?.even) || 0;
            const totalClosed = wintrades + losstrades + eventrades;
            const winRate = totalClosed > 0 ? parseFloat(((wintrades / totalClosed) * 100).toFixed(1)) : 0;
            const maxDrawdown = Number(strat?.maxDrawdown) || 0;
            const maxDrawdownPercent = initialCapital > 0 ? parseFloat(((maxDrawdown / initialCapital) * 100).toFixed(2)) : 0;
            const pos = Number(strat?.position) || 0;
            const avgP = Number(strat?.avgPrice) || 0;
            const openPnl = Number(strat?.openPnl) || 0;
            const openPnlPct = initialCapital > 0 ? parseFloat(((openPnl / initialCapital) * 100).toFixed(2)) : 0;

            const tradesList: StrategyTradeRecord[] = (rawTrades || []).map((t: any, idx: number) => ({
              id: String(t.id || `trade_${idx + 1}`),
              tradeNum: idx + 1,
              direction: t.side === 'short' ? 'short' : 'long',
              entryPrice: Number(t.entry?.price) || 0,
              entryTime: Number(t.entry?.time) || 0,
              entryComment: t.entry?.comment || t.entry?.id,
              exitPrice: t.exit?.price !== undefined ? Number(t.exit.price) : undefined,
              exitTime: t.exit?.time !== undefined ? Number(t.exit.time) : undefined,
              exitComment: t.exit?.comment || t.exit?.id,
              size: Number(t.qty) || 0,
              profit: t.pnl !== undefined ? parseFloat(Number(t.pnl).toFixed(2)) : undefined,
              profitPercent: t.pnl !== undefined && t.entry?.price ? parseFloat(((Number(t.pnl) / (Number(t.qty) * Number(t.entry.price))) * 100).toFixed(2)) : undefined,
              status: t.open ? 'open' : 'closed',
              maxDrawdown: t.maxDrawdown !== undefined ? parseFloat(Number(t.maxDrawdown).toFixed(2)) : undefined,
              maxRunup: t.maxRunup !== undefined ? parseFloat(Number(t.maxRunup).toFixed(2)) : undefined,
            }));

            const summary: StrategyPerformanceSummary = {
              strategyTitle: run.title || 'Pine Strategy',
              netProfit: parseFloat(netProfit.toFixed(2)),
              netProfitPercent: parseFloat(netProfitPercent.toFixed(2)),
              grossProfit: parseFloat(grossProfit.toFixed(2)),
              grossLoss: parseFloat(grossLoss.toFixed(2)),
              profitFactor,
              winRate,
              totalTrades: totalClosed,
              winningTrades: wintrades,
              losingTrades: losstrades,
              evenTrades: eventrades,
              maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
              maxDrawdownPercent,
              initialCapital,
              equity: parseFloat(equity.toFixed(2)),
              openTrades: (rawTrades || []).filter((t: any) => t.open).length,
              currentPosition: {
                size: pos,
                avgPrice: avgP,
                direction: pos > 0 ? 'long' : pos < 0 ? 'short' : 'flat',
                unrealizedPnl: openPnl,
                unrealizedPnlPercent: openPnlPct,
              },
              trades: tradesList,
            };

            onStrategyUpdate?.(summary);
          } catch (err) {
            console.warn('Gagal memproses script:run strategy telemetry:', err);
          }
        }
      });

      // Dengarkan pergantian cell aktif (multi-chart grid cell focus)
      (workspace as any).on?.('cell:active', (ev: any) => {
        if (isApplyingLayout) return;
        const cur = workspace?.active;
        if (cur && onActiveCellChange) {
          const rawSym = (cur as any).symbol || symbol;
          const cleanSym = rawSym.includes(':') ? rawSym.split(':')[1] : rawSym;
          const curTf = fromVelaTimeframe((cur as any).timeframe || timeframe);
          // Guard: HANYA panggil onActiveCellChange jika ada perbedaan nyata dengan props aktif
          if (cleanSym !== symbol || curTf !== timeframe) {
            onActiveCellChange({ symbol: cleanSym, timeframe: curTf });
          }
          attachCellListeners(cur);
        }
        if (syncConfig.indicators === false) {
          notifyActiveIndicators();
        }
      });

      isMounted = true;
      restoreDrawingsForCurrentChart();

      // Muat dan terapkan preferensi konfigurasi default chart yang tersimpan
      loadChartDefaultConfig().then((saved) => {
        if (saved) {
          activeChartDefaultConfig = saved;
          applySavedChartDefaultConfig();
        }
      });
      initChartSettingsModalObserver();
    } catch (err) {
      console.error('Error saat menginisialisasi Vela Workspace:', err);
    }

    // Pasang listeners interaksi container untuk mode seleksi cut-off replay dan context menu
    chartContainer.addEventListener('mousemove', handleContainerPointerMove);
    chartContainer.addEventListener('mouseleave', handleContainerMouseLeave);
    chartContainer.addEventListener('click', handleContainerClickCapture, true);
    chartContainer.addEventListener('pointerup', handleContainerClickCapture, true);
    chartContainer.addEventListener('contextmenu', handleContainerContextMenu, true);

    // Global Window Capture Phase: Menjamin 100% event klik kanan di area grafik tertangkap tanpa di-swallow oleh WebGL canvas
    window.addEventListener('contextmenu', handleContainerContextMenu, true);

    // Langganan pembaruan state price alert secara real-time
    unsubAlerts = alertService.subscribe((alerts) => {
      allAlerts = alerts;
      updateAlertYPositions();
    });

    alertPositionInterval = setInterval(updateAlertYPositions, 400);

    // Pantau perubahan ukuran chartContainer untuk memperbarui posisi price alert
    resizeObserver = new ResizeObserver(() => {
      updateAlertYPositions();
    });
    resizeObserver.observe(chartContainer);
  });

  onDestroy(() => {
    // 1. Hentikan timer interval alert
    if (alertPositionInterval) {
      clearInterval(alertPositionInterval);
      alertPositionInterval = null;
    }

    // 2. Bersihkan listeners pada container dan window
    if (chartContainer) {
      chartContainer.removeEventListener('mousemove', handleContainerPointerMove);
      chartContainer.removeEventListener('mouseleave', handleContainerMouseLeave);
      chartContainer.removeEventListener('click', handleContainerClickCapture, true);
      chartContainer.removeEventListener('pointerup', handleContainerClickCapture, true);
      chartContainer.removeEventListener('contextmenu', handleContainerContextMenu, true);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('contextmenu', handleContainerContextMenu, true);
    }

    // 3. Putuskan mutation observer dan resize observer
    if (chartSettingsObserver) {
      chartSettingsObserver.disconnect();
      chartSettingsObserver = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    // 4. Berhenti berlangganan price alerts service
    if (unsubAlerts) {
      unsubAlerts();
      unsubAlerts = null;
    }

    // 5. Destruksi Vela Workspace dan bebaskan alokasi WebGL Context
    if (workspace) {
      try {
        workspace.destroy();
      } catch (err) {
        console.warn('Peringatan saat destroy VelaWorkspace:', err);
      }
      workspace = null;
    }
    isMounted = false;
  });

  // Reaktif terhadap perubahan simbol atau provider aktif
  $effect(() => {
    if (isMounted && workspace && symbol) {
      try {
        const targetSym = resolveVelaSymbol(symbol, providerId);
        let hasChanged = false;
        if (syncConfig.symbol) {
          for (const cell of workspace.cells()) {
            if (cell.symbol !== targetSym) {
              cell.setSymbol(targetSym);
              hasChanged = true;
            }
          }
        } else if (workspace.active && workspace.active.symbol !== targetSym) {
          workspace.active.setSymbol(targetSym);
          hasChanged = true;
        }
        if (hasChanged) {
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
        const targetVelaTf = toVelaTimeframe(timeframe);
        let hasChanged = false;
        if (syncConfig.timeframe) {
          for (const cell of workspace.cells()) {
            if (cell.timeframe !== targetVelaTf) {
              cell.setTimeframe(targetVelaTf);
              hasChanged = true;
            }
          }
        } else if (workspace.active && workspace.active.timeframe !== targetVelaTf) {
          workspace.active.setTimeframe(targetVelaTf);
          hasChanged = true;
        }
        if (hasChanged) {
          restoreDrawingsForCurrentChart();
        }
      } catch (e) {
        console.warn('setTimeframe error:', e);
      }
    }
  });

  // Reaktif terhadap perubahan layout grid multi-chart
  $effect(() => {
    if (isMounted && workspace && layout && layout !== lastAppliedLayout) {
      lastAppliedLayout = layout;
      isApplyingLayout = true;
      try {
        // 1. Ambil snapshot indikator dari cell aktif sebelum setLayout
        const activeIndicatorsSnapshot = getActiveIndicators();

        workspace.setLayout(layout as any);

        // Selaraskan cell baru dan pasangkan listener interaksi
        const activeCell = workspace.active;
        const curRange = activeCell?.chart?.getVisibleRange();
        const targetSym = resolveVelaSymbol(symbol, providerId);

        for (const cell of workspace.cells()) {
          attachCellListeners(cell);
          if (cell !== activeCell) {
            // Jika sync symbol aktif, sesuaikan simbol cell baru
            if (syncConfig.symbol && cell.symbol !== targetSym) {
              cell.setSymbol(targetSym);
            }
            // Jika sync viewport aktif, selaraskan rentang waktu terlihat
            if (syncConfig.viewport && curRange) {
              cell.chart?.setVisibleRange(curRange);
            }
          }
        }

        // 2. Selaraskan timeframe cell baru berdasarkan kebijakan defaultTimeframe
        applyLayoutTimeframePolicy({
          activeCell,
          cells: Array.from(workspace.cells()),
          defaultTimeframe: defaultTimeframe || '15m',
          syncTimeframe: Boolean(syncConfig.timeframe),
        });

        // 3. Auto-clone indikator ke seluruh cell baru yang terbentuk
        if (layout === '1') {
          ensureSingleCellMatchesSnapshot(activeIndicatorsSnapshot);
        } else {
          cloneIndicatorsToCells(activeIndicatorsSnapshot);
        }

        // Tegaskan kembali konfigurasi sinkronisasi pada layout baru
        workspace.sync.set('crosshair', syncConfig.crosshair);
        workspace.sync.set('viewport', syncConfig.viewport ?? true);
        workspace.sync.set('drawings', syncConfig.drawings);
        workspace.sync.set('symbol', syncConfig.symbol);

        // Terapkan konfigurasi default chart ke seluruh cell pada layout baru
        if (activeChartDefaultConfig) {
          applySavedChartDefaultConfig();
        }
      } catch (e) {
        console.warn('setLayout error:', e);
      } finally {
        setTimeout(() => {
          isApplyingLayout = false;
        }, 60);
      }
    }
  });

  // Reaktif terhadap konfigurasi sync
  $effect(() => {
    if (isMounted && workspace && syncConfig) {
      try {
        workspace.sync.set('crosshair', syncConfig.crosshair);
        workspace.sync.set('viewport', syncConfig.viewport ?? true);
        workspace.sync.set('drawings', syncConfig.drawings);
        workspace.sync.set('symbol', syncConfig.symbol);

        // Jika sync symbol baru saja diaktifkan, samakan simbol seluruh cell
        if (syncConfig.symbol && symbol) {
          const targetSym = resolveVelaSymbol(symbol, providerId);
          for (const cell of workspace.cells()) {
            if (cell.symbol !== targetSym) {
              cell.setSymbol(targetSym);
            }
          }
        }

        // Jika sync viewport baru saja diaktifkan, samakan rentang terlihat
        if (syncConfig.viewport) {
          const curRange = workspace.active?.chart?.getVisibleRange();
          if (curRange) {
            for (const cell of workspace.cells()) {
              if (cell !== workspace.active) {
                cell.chart?.setVisibleRange(curRange);
              }
            }
          }
        }
      } catch (e) {
        console.warn('sync.set error:', e);
      }
    }
  });

  // Reaktif terhadap watermark (Bug 5)
  $effect(() => {
    if (isMounted && workspace) {
      try {
        const cells = getAllWorkspaceCells();
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

    // Ambil live indicators dari cell chart aktif jika tersedia
    const activeChart = workspace?.active?.chart;
    const nativeIndicators = (activeChart && typeof activeChart.indicators === 'function')
      ? activeChart.indicators()
      : [];
    const liveMap = new Map<string, any>();
    for (const ind of nativeIndicators) {
      if (ind && ind.id) liveMap.set(ind.id, ind);
    }

    for (const [id, item] of indicatorHandles.entries()) {
      const liveHandle = liveMap.get(id) || item.handle;
      let inputs: Record<string, any> | undefined = undefined;
      let props: Record<string, any> | undefined = undefined;

      try {
        if (liveHandle && typeof liveHandle.inputValues === 'function') {
          const vals = liveHandle.inputValues();
          if (vals && Object.keys(vals).length > 0) {
            inputs = vals;
          }
        }
      } catch (_) {}

      try {
        if (liveHandle && typeof liveHandle.propValues === 'function') {
          const pvals = liveHandle.propValues();
          if (pvals && Object.keys(pvals).length > 0) {
            props = pvals;
          }
        }
      } catch (_) {}

      // Fallback ke nilai yang tersimpan sebelumnya jika handle belum siap
      if (!inputs && item.inputs) inputs = item.inputs;
      if (!props && item.props) props = item.props;

      // Perbarui cache internal
      if (inputs) item.inputs = inputs;
      if (props) item.props = props;

      list.push({
        id,
        title: item.title || liveHandle?.title || 'Indicator',
        source: item.source || liveHandle?.source,
        visible: item.visible ?? liveHandle?.visible ?? true,
        inputs: inputs || item.inputs,
        props: props || item.props,
      });
    }
    return list;
  }

  function notifyActiveIndicators() {
    if (!onActiveIndicatorsChange) return;
    onActiveIndicatorsChange(getActiveIndicators());
  }

  /**
   * Mengkloning daftar indikator aktif ke seluruh cell workspace yang belum memilikinya
   * Menjamin saat berpindah dari 1 chart ke layout 2/4 grid, cell baru langsung memiliki indikator lengkap
   */
  function cloneIndicatorsToCells(snapshot: ActiveIndicatorInfo[]) {
    if (!workspace || !snapshot || snapshot.length === 0) return;
    try {
      const cells = getAllWorkspaceCells();
      for (const cell of cells) {
        const chart = cell?.chart || cell?.inner;
        if (!cell || !chart || typeof chart.indicators !== 'function') continue;

        const existingNative = Array.from(chart.indicators() || []);
        const existingTitles = new Set(existingNative.map((ind: any) => ind?.title).filter(Boolean));

        for (const ind of snapshot) {
          if (!ind.title || existingTitles.has(ind.title)) continue;
          const source = ind.source || getIndicatorSource(ind.id);
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

            // Catat handle baru ke indicatorHandles
            const tracked = indicatorHandles.get(ind.id);
            if (tracked) {
              if (!tracked.handles) tracked.handles = tracked.handle ? [tracked.handle] : [];
              if (!tracked.handles.includes(handle)) {
                tracked.handles.push(handle);
              }
            } else {
              indicatorHandles.set(handle.id || ind.id, {
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
      notifyActiveIndicators();
    } catch (err) {
      console.warn('Gagal clone indicators ke cells:', err);
    }
  }

  /**
   * Menjamin saat berpindah kembali ke layout 1 chart, cell tunggal memuat indikator cell aktif
   */
  function ensureSingleCellMatchesSnapshot(snapshot: ActiveIndicatorInfo[]) {
    if (!workspace) return;
    try {
      const activeCell = workspace.active || Array.from(workspace.cells())[0];
      const chart = (activeCell as any)?.chart;
      if (!chart || typeof chart.indicators !== 'function') return;

      const existingNative = Array.from(chart.indicators() || []);
      const snapshotTitles = new Set(snapshot.map((i) => i.title));

      // Hapus indikator yang tidak ada di snapshot cell aktif
      for (const h of existingNative as any[]) {
        if (h?.nativeType === 'volume') continue;
        if (h?.title && !snapshotTitles.has(h.title)) {
          try {
            if (typeof h?.remove === 'function') h.remove();
          } catch (_) {}
        }
      }

      // Pastikan seluruh indikator snapshot terpasang
      cloneIndicatorsToCells(snapshot);
    } catch (err) {
      console.warn('Gagal menyelaraskan single cell saat revert ke layout 1:', err);
    }
  }

  /**
   * Menyelaraskan seluruh cell agar mengikuti indikator dari cell yang sedang aktif/terfokus
   * Dipanggil saat toggle 'Sync Indicators' dinyalakan kembali
   */
  export function syncIndicatorsFromActiveCell(): void {
    if (!workspace || !workspace.active) return;
    try {
      const activeCell = workspace.active;
      const activeSnapshot = getActiveIndicators();

      const cells = getAllWorkspaceCells();
      for (const cell of cells) {
        if (cell === activeCell) continue;
        const chart = cell?.chart || cell?.inner;
        if (!cell || !chart || typeof chart.indicators !== 'function') continue;

        // Bersihkan seluruh indikator lama di follower cell (lewati volume native)
        const nativeList = Array.from(chart.indicators() || []);
        for (const h of nativeList as any[]) {
          if (h?.nativeType === 'volume') continue;
          try {
            if (typeof h?.remove === 'function') h.remove();
          } catch (_) {}
        }
      }

      // Bersihkan handles lama yang bukan dari cell aktif
      for (const [id, item] of indicatorHandles.entries()) {
        const activeChart = activeCell.chart;
        const activeNative = Array.from(activeChart?.indicators?.() || []);
        const stillInActive = activeNative.some((n: any) => n.title === item.title || n.id === id);
        if (!stillInActive) {
          indicatorHandles.delete(id);
        } else {
          item.handles = [item.handle];
        }
      }

      // Kloning ulang seluruh indikator cell aktif ke follower cell
      cloneIndicatorsToCells(activeSnapshot);
    } catch (err) {
      console.warn('Gagal rekonsiliasi indikator dari active cell:', err);
    }
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

  export async function addPineIndicator(
    source: string,
    customTitle?: string,
    savedInputs?: Record<string, any>,
    savedProps?: Record<string, any>
  ): Promise<boolean> {
    if (!workspace || !workspace.active) return false;

    try {
      const cleanTitle = (customTitle || 'Custom Indicator').trim();

      // 1. DEDUPLIKASI: Hapus instance lama dengan judul atau kode identik agar Web Worker tidak menumpuk
      for (const [existingId, item] of indicatorHandles.entries()) {
        if (item.title === cleanTitle || (item.source && item.source.trim() === source.trim())) {
          const list = item.handles || (item.handle ? [item.handle] : []);
          for (const h of list) {
            try {
              if (typeof h?.remove === 'function') h.remove();
            } catch (e) {
              console.warn('Gagal menghapus handle lama:', e);
            }
          }
          indicatorHandles.delete(existingId);
        }
      }

      // 2. Bersihkan juga secara native di cell target jika ada indicator dengan title yang sama
      const targetCells = (syncConfig.indicators !== false)
        ? getAllWorkspaceCells()
        : (workspace.active ? [workspace.active] : getAllWorkspaceCells());

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

      // 3. Tambahkan indikator ke cell target dengan opsi inputs & props
      const createdHandles: any[] = [];
      let firstHandle = null;

      for (const cell of targetCells as any[]) {
        if (!cell || !cell.chart) continue;
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

        const handle = cell.chart.addIndicator(source, addOptions);
        if (handle) {
          if (savedInputs && typeof handle.setInputs === 'function') {
            try {
              handle.setInputs(savedInputs);
            } catch (_) {}
          }
          if (savedProps && typeof handle.setProps === 'function') {
            try {
              handle.setProps(savedProps);
            } catch (_) {}
          }
          createdHandles.push(handle);
          if (!firstHandle) firstHandle = handle;
        }
      }

      if (firstHandle) {
        indicatorHandles.set(firstHandle.id, {
          id: firstHandle.id,
          handle: firstHandle,
          handles: createdHandles,
          title: cleanTitle,
          source,
          visible: firstHandle.visible ?? true,
          inputs: savedInputs,
          props: savedProps,
        });

        // Pastikan savedInputs teraplikasi kuat ke runtime engine setelah worker selesai prepare secara asinkron
        if (savedInputs && Object.keys(savedInputs).length > 0) {
          setTimeout(() => {
            for (const h of createdHandles) {
              try {
                if (typeof h?.setInputs === 'function') {
                  h.setInputs(savedInputs);
                }
              } catch (_) {}
            }
            notifyActiveIndicators();
          }, 250);
        }

        if (savedProps && Object.keys(savedProps).length > 0) {
          setTimeout(() => {
            for (const h of createdHandles) {
              try {
                if (typeof h?.setProps === 'function') {
                  h.setProps(savedProps);
                }
              } catch (_) {}
            }
            notifyActiveIndicators();
          }, 250);
        }

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

  export async function getActiveCandles(limit = 1000): Promise<Candle[]> {
    return getHistoricalCandles(symbol, timeframe, limit, providerId);
  }

  export function removeIndicator(id: string): void {
    const item = indicatorHandles.get(id);
    if (item) {
      if (syncConfig.indicators !== false) {
        // Hapus dari seluruh cell di workspace
        const list = item.handles || (item.handle ? [item.handle] : [item]);
        for (const h of list) {
          try {
            if (typeof h?.remove === 'function') {
              h.remove();
            }
          } catch (e) {
            console.warn('Gagal memanggil handle.remove:', e);
          }
        }
        indicatorHandles.delete(id);
      } else {
        // Hapus hanya dari cell aktif saat ini
        const activeChart = workspace?.active?.chart;
        if (activeChart && typeof activeChart.indicators === 'function') {
          const nativeList = Array.from(activeChart.indicators() || []);
          for (const n of nativeList as any[]) {
            if (n && (n.id === id || n.title === item.title)) {
              try { n.remove(); } catch (_) {}
            }
          }
        }
        if (item.handles) {
          item.handles = item.handles.filter((h: any) => h !== item.handle);
        }
        if (item.handle?.id === id) {
          indicatorHandles.delete(id);
        }
      }
      notifyActiveIndicators();
    }
  }

  export function clearAllIndicators(): void {
    // 1. Bersihkan seluruh handle di Map internal indicatorHandles
    for (const [id, item] of indicatorHandles.entries()) {
      const list = item.handles || (item.handle ? [item.handle] : [item]);
      for (const h of list) {
        try {
          if (typeof h?.remove === 'function') h.remove();
        } catch (_) {}
      }
    }
    indicatorHandles.clear();

    // 2. Bersihkan seluruh indikator di seluruh cell workspace secara menyeluruh
    if (workspace) {
      try {
        const targetCells = (syncConfig.indicators !== false)
          ? getAllWorkspaceCells()
          : (workspace.active ? [workspace.active] : getAllWorkspaceCells());

        for (const cell of targetCells as any[]) {
          // Bersihkan cell.instances jika ada agar tidak ter-rehydrate saat ganti simbol
          if (Array.isArray(cell?.instances)) {
            for (const it of [...cell.instances]) {
              try {
                if (typeof cell.dropInstance === 'function') {
                  cell.dropInstance(it);
                } else if (it?.handle && typeof it.handle.remove === 'function') {
                  it.handle.remove();
                }
              } catch (_) {}
            }
            cell.instances.length = 0;
          }

          // Bersihkan seluruh handle indikator di engine chart (lewati volume native bawaan)
          const chart = cell?.chart || cell?.inner;
          if (chart && typeof chart.indicators === 'function') {
            const list = Array.from(chart.indicators() || []);
            for (const h of list as any[]) {
              if (h?.nativeType === 'volume') continue;
              try {
                if (typeof h?.remove === 'function') h.remove();
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        console.warn('Error saat membersihkan cell indicators di workspace:', err);
      }
    }

    notifyActiveIndicators();
  }

  export function toggleIndicatorVisibility(id: string): void {
    const item = indicatorHandles.get(id);
    if (item) {
      const nextVisible = !(item.visible ?? item.handle?.visible ?? true);
      item.visible = nextVisible;
      if (syncConfig.indicators !== false) {
        // Terapkan ke semua cell
        const list = item.handles || (item.handle ? [item.handle] : [item]);
        for (const h of list) {
          try {
            if (typeof h?.setVisible === 'function') {
              h.setVisible(nextVisible);
            }
          } catch (e) {
            console.warn('Gagal memanggil handle.setVisible:', e);
          }
        }
      } else {
        // Terapkan hanya ke cell aktif
        try {
          if (item.handle && typeof item.handle.setVisible === 'function') {
            item.handle.setVisible(nextVisible);
          }
        } catch (_) {}
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

  export function getLastHoveredPrice(): number | null {
    return lastHoveredPrice;
  }

  onDestroy(() => {
    window.removeEventListener('contextmenu', handleContainerContextMenu, true);
    if (chartContainer) {
      try {
        chartContainer.removeEventListener('mousemove', handleContainerPointerMove);
        chartContainer.removeEventListener('mouseleave', handleContainerMouseLeave);
        chartContainer.removeEventListener('click', handleContainerClickCapture, true);
        chartContainer.removeEventListener('pointerup', handleContainerClickCapture, true);
        chartContainer.removeEventListener('contextmenu', handleContainerContextMenu, true);
      } catch (_) {}
    }
    if (alertPositionInterval) {
      clearInterval(alertPositionInterval);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (chartSettingsObserver) {
      chartSettingsObserver.disconnect();
      chartSettingsObserver = null;
    }
    try {
      replaySession.bindDriver(null);
      if (workspace && typeof (workspace as any).destroy === 'function') {
        (workspace as any).destroy();
      }
    } catch (e) {}

  });
</script>

<div 
  class="chart-wrapper {isSelectingCutoff ? 'selecting-cutoff' : ''}"
  oncontextmenu={handleContainerContextMenu}
>
  <div bind:this={chartContainer} class="vela-container"></div>

  <!-- Visual Price Alert Overlays -->
  {#each activeSymbolAlerts as a (a.id)}
    {@const yPos = alertYPositions[a.id]}
    {#if yPos !== null && yPos >= 0}
      <div
        class="chart-alert-line {a.triggered ? 'triggered' : ''} {a.active ? 'active' : 'paused'}"
        style="top: {yPos}px;"
      >
        <div class="alert-line-badge mono-nums">
          <Bell size={10} class="badge-bell" />
          <span class="badge-price">${formatPrice(a.targetPrice)}</span>
          {#if a.label}
            <span class="badge-lbl">{a.label}</span>
          {/if}
          <button
            type="button"
            class="badge-del-btn"
            title="Hapus Alert Ini"
            onclick={(e) => {
              e.stopPropagation();
              alertService.deleteAlert(a.id);
            }}
          >
            <X size={10} />
          </button>
        </div>
      </div>
    {/if}
  {/each}

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

  <!-- Floating Context Menu Klik Kanan Kursor -->
  <ChartContextMenu
    isOpen={isContextMenuOpen}
    x={contextMenuX}
    y={contextMenuY}
    {symbol}
    price={contextMenuPrice}
    time={contextMenuTime}
    onCreateAlert={handleCreateAlertFromMenu}
    onDrawHorizontalLine={handleDrawHorizontalLine}
    onResetChartScale={fitChart}
    onOpenSettings={() => openChartSettings()}
    onClose={() => (isContextMenuOpen = false)}
  />
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

  /* Garis Horizontal Visual Price Alert pada Grafik */
  .chart-alert-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: repeating-linear-gradient(
      to right,
      #f59e0b 0,
      #f59e0b 5px,
      transparent 5px,
      transparent 10px
    );
    pointer-events: none;
    z-index: 18;
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.35);
  }

  .chart-alert-line.triggered {
    background: repeating-linear-gradient(
      to right,
      var(--bear-color) 0,
      var(--bear-color) 5px,
      transparent 5px,
      transparent 10px
    );
    box-shadow: 0 0 8px var(--bear-glow);
  }

  .chart-alert-line.paused {
    opacity: 0.35;
    background: repeating-linear-gradient(
      to right,
      var(--text-dim) 0,
      var(--text-dim) 4px,
      transparent 4px,
      transparent 8px
    );
    box-shadow: none;
  }

  .alert-line-badge {
    position: absolute;
    right: 60px;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background-color: rgba(20, 16, 10, 0.94);
    backdrop-filter: blur(4px);
    border: 1px solid #f59e0b;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.75), 0 0 8px rgba(245, 158, 11, 0.25);
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    font-size: 9px;
    font-weight: 600;
    color: #fbbf24;
    pointer-events: auto;
    cursor: default;
    transition: all 0.12s ease;
  }

  .alert-line-badge:hover {
    background-color: rgba(28, 22, 12, 0.98);
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.85), 0 0 10px rgba(245, 158, 11, 0.4);
  }

  .chart-alert-line.triggered .alert-line-badge {
    background-color: rgba(30, 10, 15, 0.94);
    border-color: var(--bear-color);
    color: var(--bear-color);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.75), 0 0 8px var(--bear-glow);
  }

  .badge-bell {
    color: inherit;
    flex-shrink: 0;
  }

  .badge-price {
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .badge-lbl {
    color: var(--text-muted);
    font-size: 8.5px;
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    padding-left: 4px;
  }

  .badge-del-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 1px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 2px;
    transition: color 0.1s ease;
  }

  .badge-del-btn:hover {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.15);
  }

  /* Styling Tombol 'Simpan sebagai default' pada Modal Chart Settings Vela */
  :global(.trawangan-save-default-btn) {
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    background: rgba(255, 105, 180, 0.12) !important;
    border: 1px solid rgba(255, 105, 180, 0.4) !important;
    color: #ff69b4 !important;
    font-weight: 600 !important;
    font-size: 12px !important;
    padding: 0 12px !important;
    height: 30px !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
    user-select: none !important;
    margin-left: 6px !important;
  }

  :global(.trawangan-save-default-btn:hover) {
    background: rgba(255, 105, 180, 0.22) !important;
    border-color: rgba(255, 105, 180, 0.8) !important;
    color: #ffffff !important;
    box-shadow: 0 0 12px rgba(255, 105, 180, 0.35) !important;
  }

  :global(.trawangan-save-default-btn.saved) {
    background: rgba(16, 185, 129, 0.2) !important;
    border-color: rgba(16, 185, 129, 0.85) !important;
    color: #10b981 !important;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.4) !important;
  }
</style>

