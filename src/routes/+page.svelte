<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from '../lib/components/Header.svelte';
  import Chart from '../lib/components/Chart.svelte';
  import DrawingToolbar from '../lib/components/DrawingToolbar.svelte';
  import WatchlistPanel from '../lib/components/WatchlistPanel.svelte';
  import ReplayBar from '../lib/components/ReplayBar.svelte';
  import ReplayDatePickerModal from '../lib/components/ReplayDatePickerModal.svelte';
  import PineEditor from '../lib/components/PineEditor.svelte';
  import StatusBar from '../lib/components/StatusBar.svelte';
  import SettingsModal from '../lib/components/SettingsModal.svelte';
  import IndicatorModal from '../lib/components/IndicatorModal.svelte';
  import SymbolSearchModal from '../lib/components/SymbolSearchModal.svelte';
  import CreateAlertModal from '../lib/components/CreateAlertModal.svelte';
  import AlertNotificationToast from '../lib/components/AlertNotificationToast.svelte';
  import { alertService } from '../lib/services/alertService';
  import { ensureNotificationPermission } from '../lib/services/systemNotificationService';
  import { marketFeed } from '../lib/services/market';
  import { telemetryService } from '../lib/services/telemetryService';
  import { replaySession, type ReplaySnapshot } from '../lib/services/replay';
  import type {
    TickerInfo,
    Timeframe,
    ActiveIndicatorInfo,
    DrawingToolType,
    SnapMode,
    MultiChartSyncConfig,
    WorkspaceMode,
    AppSettings,
    QuickSymbolsConfig,
    StrategyPerformanceSummary,
    PriceAlert,
    SavedWorkspace
  } from '../lib/types/market';
  import {
    loadWatchlist,
    saveWatchlist,
    loadQuickSymbolsConfig,
    saveQuickSymbolsConfig,
    saveWorkspace,
    DEFAULT_QUICK_SYMBOLS_CONFIG
  } from '../lib/services/persistence';
  import {
    THEME_PRESETS,
    UI_FONT_OPTIONS,
    MONO_FONT_OPTIONS,
    DENSITY_OPTIONS
  } from '../lib/constants/themes';

  import { Terminal, X, TrendingUp, Sparkles, Layers } from '@lucide/svelte';

  // ─── Core Market & Navigation State ───
  let activeSymbol = $state('BTCUSDT');
  let activeTimeframe = $state<Timeframe>('1m');
  let currentLayout = $state('1');
  let ticker = $state<TickerInfo | null>(null);
  let activeProviderId = $state('binance');

  // Dual Workspace Mode: 'terminal' vs 'pine'
  let workspaceMode = $state<WorkspaceMode>('terminal');
  let activeWorkspace = $state<SavedWorkspace | null>(null);
  let isAutoSaveWorkspace = $state<boolean>(true);
  let isPageMounted = false;
  let isLoadingWorkspace = false;

  // Multi-Chart Sync State
  let syncConfig = $state<MultiChartSyncConfig>({
    crosshair: true,
    viewport: true,
    symbol: false,
    drawings: true,
  });

  // Settings & Preferences State
  let appSettings = $state<AppSettings>({
    timezone: 'Asia/Jakarta',
    soundEnabled: true,
    systemNotificationEnabled: true,
    showWatermark: true,
    showGrid: true,
    showReplayBar: false,
    theme: 'signature',
    themePreset: 'signature',
    fontFamilyUi: 'Plus Jakarta Sans',
    fontFamilyMono: 'JetBrains Mono',
    uiDensity: 'regular',
    fontSize: 12,
    defaultTimeframe: '15m',
    favoriteTimeframes: ['1m', '5m', '15m', '1h', '4h', '1D'],
    customTimeframes: [],
  });

  // Reaktif Sinkronisasi Tema & Tipografi ke Elemen Root DOM
  $effect(() => {
    if (typeof document !== 'undefined') {
      const preset = appSettings.themePreset || 'signature';
      document.documentElement.setAttribute('data-theme', preset);

      const uiOpt = UI_FONT_OPTIONS.find((f) => f.id === appSettings.fontFamilyUi);
      const monoOpt = MONO_FONT_OPTIONS.find((f) => f.id === appSettings.fontFamilyMono);
      
      const currentFontSize = appSettings.fontSize ?? (appSettings.uiDensity === 'compact' ? 11 : appSettings.uiDensity === 'comfortable' ? 13.5 : 12);
      const fontScale = currentFontSize / 12;

      document.documentElement.style.setProperty('--font-ui', uiOpt ? uiOpt.css : "'Plus Jakarta Sans', sans-serif");
      document.documentElement.style.setProperty('--font-code', monoOpt ? monoOpt.css : "'JetBrains Mono', monospace");
      document.documentElement.style.setProperty('--base-font-size', `${currentFontSize}px`);
      document.documentElement.style.setProperty('--font-scale', `${fontScale}`);
    }
  });


  // Panels & Modals Visibility State
  let isSettingsModalOpen = $state(false);
  let isIndicatorModalOpen = $state(false);
  let isSymbolSearchOpen = $state(false);
  let settingsInitialTab = $state<'general' | 'appearance' | 'chart' | 'feed' | 'system' | 'about' | 'help'>('general');
  let isDrawingToolbarVisible = $state(true);
  let isWatchlistOpen = $state(true);
  let isConsoleDrawerOpen = $state(false);

  // Price Alerts Modals & Toast State
  let isCreateAlertModalOpen = $state(false);
  let createAlertSymbol = $state('BTCUSDT');
  let createAlertTargetPrice = $state<number | undefined>(undefined);
  let triggeredAlertsToasts = $state<PriceAlert[]>([]);

  function handleRequestCreateAlert(sym?: string, price?: number) {
    createAlertSymbol = sym || activeSymbol;
    createAlertTargetPrice = price;
    isCreateAlertModalOpen = true;
  }

  function handleDismissAlertToast(id: string) {
    triggeredAlertsToasts = triggeredAlertsToasts.filter((a) => a.id !== id);
  }

  // Deep Replay Session Reactive State
  let replaySnapshot = $state<ReplaySnapshot>(replaySession.getSnapshot());
  let isReplayDatePickerOpen = $state(false);

  // Drawing Tools State
  let activeDrawingTool = $state<DrawingToolType | null>('cursor');
  let snapMode = $state<SnapMode>('off');
  let stayMode = $state(false);
  let isDrawingsLocked = $state(false);
  let isDrawingsHidden = $state(false);

  // Pine Editor Content State
  let editorInitialCode = $state('');
  let editorInitialTitle = $state('Trawangan_Alpha_v6.pine');

  // Active Indicators State (bersih tanpa dummy)
  let activeIndicators = $state<ActiveIndicatorInfo[]>([]);

  // Active Strategy Performance State
  let activeStrategySummary = $state<StrategyPerformanceSummary | null>(null);

  function handleStrategyUpdate(summary: StrategyPerformanceSummary) {
    activeStrategySummary = summary;
  }

  // Watchlist & Quick Symbols State
  let watchlistSymbols = $state<string[]>([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
  ]);
  let quickSymbolsConfig = $state<QuickSymbolsConfig>(DEFAULT_QUICK_SYMBOLS_CONFIG);

  function handleNavigateWatchlist(direction: number) {
    const list = watchlistSymbols.length > 0 ? watchlistSymbols : [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
      'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
    ];
    const idx = list.indexOf(activeSymbol);
    if (idx === -1) {
      handleSymbolChange(list[0]);
    } else {
      let nextIdx = (idx + direction) % list.length;
      if (nextIdx < 0) nextIdx += list.length;
      handleSymbolChange(list[nextIdx]);
    }
  }

  let chartComponent: any = $state(null);
  let pineEditorComponent: any = $state(null);
  let unsubTicker: (() => void) | null = null;
  let pinePanelWidth = $state(480);
  let isResizingPinePanel = false;

  // Terminal Diagnostics Logs
  let systemLogs = $state<{ time: string; msg: string; level: 'info' | 'success' | 'warn' }[]>([
    { time: '16:00:01', msg: 'Trawangan Native Core initialized via Tauri v2.', level: 'info' },
    { time: '16:00:02', msg: 'SQLite embedded database connected (rusqlite 0.32).', level: 'info' },
    { time: '16:00:03', msg: 'Binance WebSocket stream active (wss://stream.binance.com).', level: 'success' },
    { time: '16:00:05', msg: 'LuxAlgo Vela WebGL2 context ready. Target: 120 FPS.', level: 'success' },
  ]);

  let unsubAlertTrigger: (() => void) | null = null;
  let unsubReplay: (() => void) | null = null;

  $effect(() => {
    if (activeSymbol) {
      if (unsubTicker) unsubTicker();
      unsubTicker = marketFeed.subscribeActiveTicker(activeSymbol, (newTicker) => {
        ticker = newTicker;
      });
    }
  });

  onMount(() => {
    unsubReplay = replaySession.subscribe((snap) => {
      replaySnapshot = snap;
    });

    // Muat preferensi aplikasi tersimpan dari localStorage
    try {
      const savedSettings = localStorage.getItem('trawangan_app_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        appSettings = { ...appSettings, ...parsed };
        if (appSettings.defaultTimeframe) {
          activeTimeframe = appSettings.defaultTimeframe;
        }
      }

      const savedPineWidth = localStorage.getItem('trawangan_pine_panel_width');
      if (savedPineWidth) {
        const parsed = parseInt(savedPineWidth, 10);
        if (!isNaN(parsed) && parsed >= 340 && parsed <= 900) {
          pinePanelWidth = parsed;
        }
      }

      const savedAutoSave = localStorage.getItem('trawangan_autosave_workspace');
      if (savedAutoSave !== null) {
        isAutoSaveWorkspace = savedAutoSave === 'true';
      }
      isPageMounted = true;
    } catch (e) {
      console.warn('Gagal memuat pengaturan tersimpan:', e);
    }

    // Sinkronisasi preferensi audio notifikasi & notifikasi sistem Windows
    alertService.setSoundEnabled(appSettings.soundEnabled);
    alertService.setSystemNotificationEnabled(appSettings.systemNotificationEnabled !== false);

    // Verifikasi izin notifikasi native Windows desktop
    ensureNotificationPermission().then((granted) => {
      if (granted) {
        addSystemLog('Notifikasi native Windows Action Center aktif.', 'info');
      }
    });

    // Dengarkan event saat Price Alert terpicu secara real-time
    unsubAlertTrigger = alertService.onTrigger((alert, actualPrice) => {
      triggeredAlertsToasts = [alert, ...triggeredAlertsToasts.slice(0, 3)];
      addSystemLog(`🔔 Price Alert Terpicu: ${alert.symbol} di $${actualPrice}`, 'warn');
      setTimeout(() => {
        handleDismissAlertToast(alert.id);
      }, 12000);
    });

    marketFeed.getActiveProviderId().then((pId) => {
      if (pId) {
        activeProviderId = pId;
        telemetryService.setActiveProvider(pId);
      }
    });

    loadWatchlist().then((list) => {
      if (list && list.length > 0) watchlistSymbols = list;
    });

    loadQuickSymbolsConfig().then((cfg) => {
      if (cfg) quickSymbolsConfig = cfg;
    });

    // Global keyboard shortcuts (TradingView Standard Suite)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan shortcut jika sedang fokus mengetik di input, textarea, contenteditable, atau CodeMirror
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('.cm-editor'))
      );

      // Toggle Console Logs: Ctrl + ` or Cmd + ` (selalu aktif)
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault();
        isConsoleDrawerOpen = !isConsoleDrawerOpen;
        return;
      }

      // Quick Symbol Search Modal: Ctrl + K or Cmd + K (selalu aktif)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        isSymbolSearchOpen = true;
        return;
      }

      // Quick Help & Shortcuts Modal: F1 (selalu aktif) atau ? (saat tidak sedang di input)
      if (e.key === 'F1' || (!isInput && e.key === '?')) {
        e.preventDefault();
        settingsInitialTab = 'help';
        isSettingsModalOpen = true;
        return;
      }

      if (isInput) return;

      // Watchlist Navigation: Space (koin berikutnya), Shift + Space (koin sebelumnya)
      if (e.code === 'Space') {
        e.preventDefault();
        handleNavigateWatchlist(e.shiftKey ? -1 : 1);
        return;
      }

      // Drawing Tool Shortcuts (Alt + T, Alt + H, Alt + F, Alt + M, Alt + Z)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 't') {
          e.preventDefault();
          handleSelectTool('trendline');
          addSystemLog('Shortcut: Tool Trendline dipilih (Alt+T)', 'info');
          return;
        }
        if (k === 'h') {
          e.preventDefault();
          handleSelectTool('hline');
          addSystemLog('Shortcut: Tool Horizontal Line dipilih (Alt+H)', 'info');
          return;
        }
        if (k === 'f') {
          e.preventDefault();
          handleSelectTool('fibretracement');
          addSystemLog('Shortcut: Tool Fibonacci Retracement dipilih (Alt+F)', 'info');
          return;
        }
        if (k === 'm') {
          e.preventDefault();
          handleSelectTool('measure');
          addSystemLog('Shortcut: Tool Penggaris/Measure dipilih (Alt+M)', 'info');
          return;
        }
        if (k === 'z') {
          e.preventDefault();
          if (chartComponent?.fitChart) chartComponent.fitChart();
          addSystemLog('Shortcut: Reset skala/fit grafik (Alt+Z)', 'info');
          return;
        }
        if (k === 'a') {
          e.preventDefault();
          const cursorPrice = chartComponent?.getLastHoveredPrice?.() || ticker?.price;
          handleRequestCreateAlert(activeSymbol, cursorPrice);
          addSystemLog(`Shortcut: Buat Price Alert untuk ${activeSymbol} (Alt+A)`, 'info');
          return;
        }
      }

      // Toggle Bar Replay: Shift + R
      if (e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleToggleReplay();
        return;
      }

      // Replay Keyboard Controls (Space untuk play/pause, ArrowRight untuk step)
      if (replaySnapshot.active && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.code === 'Space') {
          e.preventDefault();
          replaySession.togglePlay();
          return;
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          replaySession.step();
          return;
        }
      }

      // Quick Timeframe Shortcuts & Esc
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') { handleTimeframeChange('1m'); return; }
        if (e.key === '5') { handleTimeframeChange('5m'); return; }
        if (e.key === '0') { handleTimeframeChange('15m'); return; }
        if (e.key.toLowerCase() === 'f') {
          if (chartComponent?.fitChart) chartComponent.fitChart();
          return;
        }
        if (e.key === 'Escape') {
          if (replaySnapshot.isSelectingBar) {
            replaySession.cancelBarSelection();
            addSystemLog('Mode pemilihan bar dibatalkan.', 'info');
            return;
          }
          handleSelectTool('cursor');
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          handleUndo();
          return;
        }
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (!e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else {
          e.preventDefault();
          handleRedo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  onDestroy(() => {
    if (unsubTicker) unsubTicker();
    if (unsubAlertTrigger) unsubAlertTrigger();
    if (unsubReplay) unsubReplay();
  });

  function handleSymbolChange(newSym: string) {
    activeSymbol = newSym;
    addSystemLog(`Simbol berganti ke ${newSym}`, 'info');
  }

  function handleTimeframeChange(newTf: Timeframe) {
    activeTimeframe = newTf;
    addSystemLog(`Timeframe aktif: ${newTf}`, 'info');
  }

  function handleLayoutChange(newLayout: string) {
    currentLayout = newLayout;
    addSystemLog(`Tata letak chart: ${newLayout}`, 'info');
  }

  function handleActiveCellChange(cellInfo: { symbol: string; timeframe: Timeframe }) {
    if (cellInfo.symbol && cellInfo.symbol !== activeSymbol) {
      activeSymbol = cellInfo.symbol;
    }
    if (cellInfo.timeframe && cellInfo.timeframe !== activeTimeframe) {
      activeTimeframe = cellInfo.timeframe;
    }
  }

  function handleToggleSyncCrosshair() {
    syncConfig.crosshair = !syncConfig.crosshair;
    addSystemLog(`Sinkronisasi kursor crosshair: ${syncConfig.crosshair ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function handleToggleSyncViewport() {
    syncConfig.viewport = !syncConfig.viewport;
    addSystemLog(`Sinkronisasi gerakan viewport: ${syncConfig.viewport ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function handleToggleSyncSymbol() {
    syncConfig.symbol = !syncConfig.symbol;
    addSystemLog(`Sinkronisasi simbol market: ${syncConfig.symbol ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function handleToggleSyncDrawings() {
    syncConfig.drawings = !syncConfig.drawings;
    addSystemLog(`Sinkronisasi objek gambar: ${syncConfig.drawings ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function handleWorkspaceModeChange(mode: WorkspaceMode) {
    workspaceMode = mode;
    addSystemLog(`Workspace beralih ke mode: ${mode === 'terminal' ? 'Trading Terminal' : 'Pine Script IDE'}`, 'info');
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 40);
  }

  function handleStartResizePinePanel(e: PointerEvent) {
    isResizingPinePanel = true;
    const startX = e.clientX;
    const startWidth = pinePanelWidth;

    function onPointerMove(ev: PointerEvent) {
      if (!isResizingPinePanel) return;
      const deltaX = startX - ev.clientX;
      const maxWidth = Math.min(850, window.innerWidth * 0.65);
      const nextWidth = Math.max(340, Math.min(maxWidth, startWidth + deltaX));
      pinePanelWidth = nextWidth;
    }

    function onPointerUp() {
      isResizingPinePanel = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      try {
        localStorage.setItem('trawangan_pine_panel_width', String(pinePanelWidth));
      } catch (_) {}
      window.dispatchEvent(new Event('resize'));
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function handleUpdateSettings(newSettings: Partial<AppSettings>) {
    appSettings = { ...appSettings, ...newSettings };
    if (newSettings.soundEnabled !== undefined) {
      alertService.setSoundEnabled(newSettings.soundEnabled);
    }
    if (newSettings.systemNotificationEnabled !== undefined) {
      alertService.setSystemNotificationEnabled(newSettings.systemNotificationEnabled);
    }
    try {
      localStorage.setItem('trawangan_app_settings', JSON.stringify(appSettings));
    } catch (e) {
      console.warn('Gagal menyimpan pengaturan aplikasi ke localStorage:', e);
    }
    addSystemLog(`Pengaturan aplikasi diperbarui.`, 'info');
  }

  function handleWatchlistChange(newSymbols: string[]) {
    watchlistSymbols = newSymbols;
  }

  async function handleToggleWatchlistSymbolFromSearch(sym: string) {
    let next: string[];
    if (watchlistSymbols.includes(sym)) {
      next = watchlistSymbols.filter((s) => s !== sym);
    } else {
      next = [...watchlistSymbols, sym];
    }
    handleWatchlistChange(next);
    await saveWatchlist(next);
  }

  function handleQuickSymbolsConfigChange(newConfig: QuickSymbolsConfig) {
    quickSymbolsConfig = newConfig;
    saveQuickSymbolsConfig(newConfig);
  }

  function handleProviderChange(newProviderId: string) {
    activeProviderId = newProviderId;
    marketFeed.setActiveProvider(newProviderId);
    telemetryService.setActiveProvider(newProviderId);
    addSystemLog(`Data provider beralih ke: ${newProviderId.toUpperCase()}`, 'success');
  }

  async function handleSaveWorkspace(name: string, overwriteId?: string) {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);

    // Ambil data indikator teranyar langsung dari chartComponent untuk memastikan inputValues modal tersimpan
    const freshIndicators = chartComponent?.getActiveIndicators?.() || activeIndicators;
    const indicatorsData = freshIndicators.map((i: ActiveIndicatorInfo) => ({
      title: i.title,
      source: i.source,
      visible: i.visible,
      inputs: i.inputs,
      props: i.props,
    }));

    const targetId = overwriteId || (activeWorkspace?.name.trim().toLowerCase() === name.trim().toLowerCase() ? activeWorkspace.id : undefined);

    const saved = await saveWorkspace({
      id: targetId,
      name,
      symbol: activeSymbol,
      timeframe: activeTimeframe,
      layout: currentLayout,
      indicators: indicatorsData,
    });
    activeWorkspace = saved;
    addSystemLog(`Workspace "${name}" disimpan`, 'success');
  }

  function handleNewWorkspace() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    activeWorkspace = null;
    addSystemLog('Workspace aktif dilepas. Siap menyetel tata letak atau indikator untuk workspace baru.', 'info');
  }

  async function handleLoadWorkspace(w: SavedWorkspace) {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    isLoadingWorkspace = true;
    try {
      activeWorkspace = w;

      // 1. FRESH CLEAN SLATE TAHAP 1: Reset activeIndicators state Svelte & bersihkan chart lama
      activeIndicators = [];
      if (chartComponent && typeof chartComponent.clearAllIndicators === 'function') {
        chartComponent.clearAllIndicators();
      }

      // 2. Terapkan konfigurasi simbol, timeframe, dan layout baru
      handleSymbolChange(w.symbol);
      handleTimeframeChange(w.timeframe as Timeframe);
      handleLayoutChange(w.layout);

      // Tunggu layout grid dan WebGL render settle secara penuh
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 3. FRESH CLEAN SLATE TAHAP 2 (Double-Barrier): Pastikan chart BENAR-BENAR bersih sebelum memuat indikator workspace baru
      if (chartComponent && typeof chartComponent.clearAllIndicators === 'function') {
        chartComponent.clearAllIndicators();
      }
      activeIndicators = [];

      // 4. Muat indikator dari workspace secara deterministik dengan inputs & props lengkap
      if (w.indicators && w.indicators.length > 0 && chartComponent) {
        for (const ind of w.indicators) {
          if (ind.source) {
            try {
              await chartComponent.addPineIndicator(ind.source, ind.title, ind.inputs, ind.props);
              if (ind.visible === false) {
                const active = chartComponent.getActiveIndicators();
                const target = active.find((a: any) => a.title === ind.title);
                if (target && target.visible) {
                  chartComponent.toggleIndicatorVisibility(target.id);
                }
              }
            } catch (e) {
              console.warn(`Gagal memuat indikator ${ind.title}:`, e);
            }
          }
        }
      }

      // 5. Sinkronkan state indikator akhir ke Svelte UI
      syncActiveIndicators();

      const indCount = w.indicators?.length || 0;
      const indTitles = w.indicators && w.indicators.length > 0
        ? w.indicators.map((i: any) => i.title).join(', ')
        : 'tanpa indikator';
      addSystemLog(`Workspace "${w.name}" dimuat (${indCount} indikator: ${indTitles})`, 'success');
    } finally {
      setTimeout(() => {
        isLoadingWorkspace = false;
      }, 600);
    }
  }

  function handleToggleAutoSaveWorkspace() {
    isAutoSaveWorkspace = !isAutoSaveWorkspace;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('trawangan_autosave_workspace', isAutoSaveWorkspace.toString());
    }
    addSystemLog(`Auto-save workspace: ${isAutoSaveWorkspace ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  let autoSaveTimer: any = null;
  function triggerWorkspaceAutoSave() {
    // KUNCI PENTING: Hanya jalankan auto-save jika ada activeWorkspace yang sedang dimuat!
    // Jika activeWorkspace === null (sedang membuat workspace baru/lepas), jangan auto-save untuk mencegah tabrakan/overwrite!
    if (!isAutoSaveWorkspace || !isPageMounted || isLoadingWorkspace || !chartComponent || !activeWorkspace) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      if (!isAutoSaveWorkspace || isLoadingWorkspace || !activeWorkspace) return;
      const targetName = activeWorkspace.name;
      const targetId = activeWorkspace.id;
      const freshIndicators = chartComponent?.getActiveIndicators?.() || activeIndicators;
      const indicatorsData = freshIndicators.map((i: ActiveIndicatorInfo) => ({
        title: i.title,
        source: i.source,
        visible: i.visible,
        inputs: i.inputs,
        props: i.props,
      }));

      try {
        const saved = await saveWorkspace({
          id: targetId,
          name: targetName,
          symbol: activeSymbol,
          timeframe: activeTimeframe,
          layout: currentLayout,
          indicators: indicatorsData,
        });
        activeWorkspace = saved;
        addSystemLog(`Auto-save: "${targetName}" tersimpan otomatis`, 'info');
      } catch (err) {
        console.warn('Auto-save workspace gagal:', err);
      }
    }, 1500);
  }

  // Pantau perubahan parameter untuk auto-save workspace ber-debounce
  $effect(() => {
    const _s = activeSymbol;
    const _t = activeTimeframe;
    const _l = currentLayout;
    const _i = activeIndicators;
    if (isPageMounted && !isLoadingWorkspace) {
      triggerWorkspaceAutoSave();
    }
  });

  // ─── Drawing Tools Handlers ───
  function handleSelectTool(tool: DrawingToolType | null) {
    activeDrawingTool = tool;
    if (chartComponent) {
      chartComponent.setDrawingTool(tool);
    }
  }

  function handleToggleSnap() {
    const next: Record<SnapMode, SnapMode> = { off: 'weak', weak: 'strong', strong: 'off' };
    snapMode = next[snapMode];
    if (chartComponent) {
      chartComponent.setSnapMode(snapMode);
    }
  }

  function handleToggleStay() {
    stayMode = !stayMode;
    if (chartComponent) {
      chartComponent.setStayMode(stayMode);
    }
  }

  function handleToggleLock() {
    isDrawingsLocked = !isDrawingsLocked;
    if (chartComponent) {
      chartComponent.setDrawingsLocked(isDrawingsLocked);
    }
  }

  function handleToggleHide() {
    isDrawingsHidden = !isDrawingsHidden;
    if (chartComponent) {
      chartComponent.setDrawingsHidden(isDrawingsHidden);
    }
  }

  function handleUndo() {
    if (chartComponent) chartComponent.undoDrawing();
  }

  function handleRedo() {
    if (chartComponent) chartComponent.redoDrawing();
  }

  function handleClear() {
    if (chartComponent && confirm('Hapus semua objek gambar pada grafik saat ini?')) {
      chartComponent.clearAllDrawings();
      addSystemLog('Seluruh objek gambar dibersihkan.', 'warn');
    }
  }

  // ─── Bar Replay Handlers (Didelegasikan ke Modul Deep replaySession) ───
  function handleToggleReplay() {
    if (replaySnapshot.active) {
      replaySession.close();
      addSystemLog('Bar Replay dinonaktifkan. Kembali ke streaming live.', 'info');
    } else {
      replaySession.open();
      addSystemLog('Bar Replay aktif. Klik candle pada grafik atau pilih tanggal untuk mulai.', 'info');
    }
  }

  function handleSelectDate(timestamp: number) {
    replaySession.setCutoff(timestamp);
    const formatted = new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    addSystemLog(`Bar Replay melompat ke tanggal: ${formatted}.`, 'success');
  }

  // ─── Indicators & Pine Script Handlers ───
  async function handleAddIndicator(code: string, title: string): Promise<boolean> {
    if (chartComponent) {
      const ok = await chartComponent.addPineIndicator(code, title);
      if (ok) {
        syncActiveIndicators();
        addSystemLog(`Indikator "${title}" berhasil diterapkan ke grafik.`, 'success');
      }
      return ok;
    }
    return false;
  }

  function syncActiveIndicators() {
    if (chartComponent && typeof chartComponent.getActiveIndicators === 'function') {
      activeIndicators = chartComponent.getActiveIndicators();
    }
  }

  function handleRemoveIndicator(id: string) {
    if (chartComponent && typeof chartComponent.removeIndicator === 'function') {
      chartComponent.removeIndicator(id);
    }
    activeIndicators = activeIndicators.filter(i => i.id !== id);
    syncActiveIndicators();
    addSystemLog(`Indikator dihapus: ${id}`, 'info');
  }

  function handleToggleIndicatorVisibility(id: string) {
    if (chartComponent && typeof chartComponent.toggleIndicatorVisibility === 'function') {
      chartComponent.toggleIndicatorVisibility(id);
    }
    syncActiveIndicators();
  }

  function handleOpenInEditor(code: string, title: string, id?: string) {
    editorInitialCode = code;
    editorInitialTitle = title;
    workspaceMode = 'pine';
    setTimeout(() => {
      pineEditorComponent?.loadScript(code, title, id);
      window.dispatchEvent(new Event('resize'));
    }, 40);
    addSystemLog(`Membuka "${title}" di Pine Script IDE.`, 'info');
  }

  function addSystemLog(msg: string, level: 'info' | 'success' | 'warn') {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    systemLogs = [...systemLogs.slice(-60), { time, msg, level }];
  }
</script>

<div class="app-layout">
  <!-- Top Master Navigation & Titlebar -->
  <Header
    {activeSymbol}
    {activeTimeframe}
    {ticker}
    {currentLayout}
    {activeProviderId}
    {workspaceMode}
    {syncConfig}
    {activeIndicators}
    {isDrawingToolbarVisible}
    {isWatchlistOpen}
    isReplayActive={replaySnapshot.active}
    {watchlistSymbols}
    {quickSymbolsConfig}
    onQuickSymbolsConfigChange={handleQuickSymbolsConfigChange}
    onSymbolChange={handleSymbolChange}
    onTimeframeChange={handleTimeframeChange}
    onLayoutChange={handleLayoutChange}
    onWorkspaceModeChange={handleWorkspaceModeChange}
    {activeWorkspace}
    {isAutoSaveWorkspace}
    onToggleAutoSaveWorkspace={handleToggleAutoSaveWorkspace}
    onSaveWorkspace={handleSaveWorkspace}
    onLoadWorkspace={handleLoadWorkspace}
    onNewWorkspace={handleNewWorkspace}
    onToggleSyncCrosshair={handleToggleSyncCrosshair}
    onToggleSyncViewport={handleToggleSyncViewport}
    onToggleSyncSymbol={handleToggleSyncSymbol}
    onToggleSyncDrawings={handleToggleSyncDrawings}
    onToggleDrawingToolbar={() => (isDrawingToolbarVisible = !isDrawingToolbarVisible)}
    onToggleWatchlist={() => (isWatchlistOpen = !isWatchlistOpen)}
    onToggleReplay={handleToggleReplay}
    onOpenIndicatorModal={() => (isIndicatorModalOpen = true)}
    onOpenSettingsModal={() => {
      settingsInitialTab = 'general';
      isSettingsModalOpen = true;
    }}
    onOpenSymbolSearch={() => (isSymbolSearchOpen = true)}
    favoriteTimeframes={appSettings.favoriteTimeframes}
    customTimeframes={appSettings.customTimeframes}
    onFavoriteTimeframesChange={(tfs) => handleUpdateSettings({ favoriteTimeframes: tfs })}
    onCustomTimeframesChange={(customs) => handleUpdateSettings({ customTimeframes: customs })}
    onRequestCreateAlert={() => handleRequestCreateAlert(activeSymbol, chartComponent?.getLastHoveredPrice?.() || ticker?.price)}
  />

  <!-- Main Viewport Area -->
  <main class="main-workspace {workspaceMode}">
    <!-- Optional Bar Replay Controller (Only visible when active) -->
    {#if replaySnapshot.active}
      <ReplayBar
        onOpenDatePicker={() => (isReplayDatePickerOpen = true)}
        onClose={() => {
          replaySession.close();
          addSystemLog('Bar Replay ditutup. Kembali ke data pasar live.', 'info');
        }}
      />
    {/if}

    <!-- WORKSPACE UNIFIED VIEWPORT (TradingView Side-by-Side: Chart | Resizer | Pine IDE or Watchlist) -->
    <div class="workspace-viewport mode-{workspaceMode}">
      <!-- Left: Chart Canvas Area (Fluid 100% minus right panel) -->
      <div class="chart-canvas-area">
        <!-- Dynamic Floating Signal Badge (Tampil hanya saat mode Pine IDE dan ada strategi) -->
        {#if workspaceMode === 'pine' && activeStrategySummary}
          <div class="floating-strategy-badge obsidian-panel mono-nums">
            <div class="badge-item">
              <span class="badge-pip {activeStrategySummary.currentPosition.direction === 'long' ? 'badge-pip-bull' : activeStrategySummary.currentPosition.direction === 'short' ? 'badge-pip-bear' : ''}"></span>
              <span class="badge-bold">
                POSITION: {activeStrategySummary.currentPosition.direction.toUpperCase()}
                {#if activeStrategySummary.currentPosition.direction !== 'flat'}
                  ({activeStrategySummary.currentPosition.size} {activeSymbol.replace('USDT', '')})
                {/if}
              </span>
            </div>
            <div class="badge-divider"></div>
            <div class="badge-item">
              <span class="badge-label">NET PnL:</span>
              <span class="{activeStrategySummary.netProfit >= 0 ? 'badge-val-bull' : 'badge-val-bear'}">
                {activeStrategySummary.netProfit >= 0 ? '+' : ''}${activeStrategySummary.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                ({activeStrategySummary.netProfitPercent >= 0 ? '+' : ''}{activeStrategySummary.netProfitPercent}%)
              </span>
            </div>
            <div class="badge-divider"></div>
            <div class="badge-item">
              <span class="badge-label">WIN RATE:</span>
              <span class="badge-val">{activeStrategySummary.winRate}%</span>
            </div>
          </div>
        {/if}

        <!-- WebGL2 Vela Chart Core (PERSISTENT SINGLETON INSTANCE) -->
        <Chart
          bind:this={chartComponent}
          symbol={activeSymbol}
          timeframe={activeTimeframe}
          layout={currentLayout}
          providerId={activeProviderId}
          themePreset={appSettings.themePreset || 'signature'}
          fontSize={appSettings.fontSize || 12}
          {syncConfig}
          showWatermark={appSettings.showWatermark}
          onActiveIndicatorsChange={(list) => (activeIndicators = list)}
          onActiveCellChange={handleActiveCellChange}
          onStrategyUpdate={handleStrategyUpdate}
          onRequestCreateAlert={handleRequestCreateAlert}
        />

        <!-- Left Utility Ribbon (Drawing Tools - Hanya aktif saat mode terminal) -->
        {#if isDrawingToolbarVisible && workspaceMode === 'terminal'}
          <DrawingToolbar
            activeTool={activeDrawingTool}
            {snapMode}
            {stayMode}
            isLocked={isDrawingsLocked}
            isHidden={isDrawingsHidden}
            onSelectTool={handleSelectTool}
            onToggleSnap={handleToggleSnap}
            onToggleStay={handleToggleStay}
            onToggleLock={handleToggleLock}
            onToggleHide={handleToggleHide}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
          />
        {/if}
      </div>

      <!-- Right Column: Mutually Exclusive (Pine Editor vs Watchlist) -->
      {#if workspaceMode === 'pine'}
        <!-- Draggable Resizer Splitter -->
        <div
          class="side-panel-resizer"
          title="Tarik untuk mengatur lebar Pine IDE"
          onpointerdown={handleStartResizePinePanel}
        >
          <div class="resizer-grip"></div>
        </div>

        <div class="side-panel-container" style="width: {pinePanelWidth}px">
          <PineEditor
            bind:this={pineEditorComponent}
            isOpen={true}
            initialCode={editorInitialCode}
            initialTitle={editorInitialTitle}
            activeSymbol={activeSymbol}
            activeTimeframe={activeTimeframe}
            providerId={activeProviderId}
            onClose={() => handleWorkspaceModeChange('terminal')}
            onAddToChart={handleAddIndicator}
            onStrategyUpdate={handleStrategyUpdate}
          />
        </div>
      {:else if isWatchlistOpen}
        <WatchlistPanel
          isOpen={isWatchlistOpen}
          {activeSymbol}
          {activeProviderId}
          {watchlistSymbols}
          {activeIndicators}
          onSelectSymbol={handleSymbolChange}
          onWatchlistChange={handleWatchlistChange}
          onToggleCollapse={() => (isWatchlistOpen = !isWatchlistOpen)}
          onToggleIndicatorVisibility={handleToggleIndicatorVisibility}
          onRemoveIndicator={handleRemoveIndicator}
          onRequestCreateAlert={() => handleRequestCreateAlert(activeSymbol)}
          onOpenSymbolSearch={() => (isSymbolSearchOpen = true)}
        />
      {/if}
    </div>
  </main>

  <!-- Interactive Terminal Console Drawer (Collapsible [Ctrl+`]) -->
  {#if isConsoleDrawerOpen}
    <div class="console-drawer obsidian-panel">
      <div class="drawer-header">
        <div class="drawer-title mono-nums">
          <Terminal size={13} class="text-bull" />
          <span>TERMINAL DIAGNOSTICS & RUNTIME LOGS</span>
          <span class="log-badge mono-nums">{systemLogs.length} Events</span>
        </div>
        <button
          class="btn-close-drawer"
          title="Tutup Console Drawer"
          onclick={() => (isConsoleDrawerOpen = false)}
        >
          <X size={14} />
        </button>
      </div>

      <div class="drawer-content mono-nums">
        {#each systemLogs as item}
          <div class="log-row {item.level}">
            <span class="log-ts">[{item.time}]</span>
            <span class="log-text">{item.msg}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Bottom System Status Bar (Fixed 26px) -->
  <StatusBar
    isConsoleOpen={isConsoleDrawerOpen}
    onToggleConsole={() => (isConsoleDrawerOpen = !isConsoleDrawerOpen)}
  />

  <!-- Preferences & Settings Modal (Clean Screen Policy) -->
  <SettingsModal
    isOpen={isSettingsModalOpen}
    settings={appSettings}
    {activeProviderId}
    initialTab={settingsInitialTab}
    onClose={() => (isSettingsModalOpen = false)}
    onUpdateSettings={handleUpdateSettings}
    onProviderChange={handleProviderChange}
    onOpenChartSettings={(sec) => chartComponent?.openChartSettings(sec)}
    onResetChartFactory={() => chartComponent?.resetChartSettingsToFactory()}
  />

  <!-- Symbol Search Modal (Global via Header / Ctrl+K / Watchlist) -->
  <SymbolSearchModal
    isOpen={isSymbolSearchOpen}
    activeSymbol={activeSymbol}
    {activeProviderId}
    {watchlistSymbols}
    onSelectSymbol={handleSymbolChange}
    onToggleWatchlistSymbol={handleToggleWatchlistSymbolFromSearch}
    onClose={() => (isSymbolSearchOpen = false)}
  />


  <!-- Indicator Library Modal -->
  <IndicatorModal
    isOpen={isIndicatorModalOpen}
    onClose={() => (isIndicatorModalOpen = false)}
    onSelectIndicator={handleAddIndicator}
    onOpenInEditor={handleOpenInEditor}
  />

  <!-- Replay Jump to Date Modal -->
  <ReplayDatePickerModal
    isOpen={isReplayDatePickerOpen}
    bounds={replaySnapshot.bounds}
    currentBarTime={replaySnapshot.cursorTime}
    onSelectDate={handleSelectDate}
    onClose={() => (isReplayDatePickerOpen = false)}
  />

  <!-- Create Price Alert Modal -->
  <CreateAlertModal
    isOpen={isCreateAlertModalOpen}
    initialSymbol={createAlertSymbol}
    initialPrice={createAlertTargetPrice}
    currentMarketPrice={ticker?.price || 0}
    onClose={() => (isCreateAlertModalOpen = false)}
    onCreated={(newAlert) => {
      addSystemLog(`Price Alert dibuat: ${newAlert.symbol} @ $${newAlert.targetPrice}`, 'success');
    }}
  />

  <!-- Alert Triggered Floating Toasts -->
  <AlertNotificationToast
    alerts={triggeredAlertsToasts}
    onSelectSymbol={handleSymbolChange}
    onDismiss={handleDismissAlertToast}
  />
</div>

<style>
  .app-layout {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-darkest);
    color: var(--text-main);
    overflow: hidden;
    position: relative;
    font-family: var(--font-sans);
  }

  .main-workspace {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  /* WORKSPACE UNIFIED VIEWPORT STYLING */
  .workspace-viewport {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .workspace-viewport {
    display: flex;
    flex-direction: row;
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .chart-canvas-area {
    flex: 1;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Draggable Splitter Handle between Chart and Pine IDE */
  .side-panel-resizer {
    width: 5px;
    height: 100%;
    background-color: var(--bg-container, #0E121A);
    border-left: 1px solid var(--border-hairline, #1E293B);
    border-right: 1px solid var(--border-hairline, #1E293B);
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    z-index: 25;
    transition: background-color 0.15s ease;
  }

  .side-panel-resizer:hover,
  .side-panel-resizer:active {
    background-color: var(--bull-color, #00F090);
  }

  .resizer-grip {
    width: 1px;
    height: 24px;
    background-color: var(--border-bright, #334155);
  }

  .side-panel-container {
    height: 100%;
    min-height: 0;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 20;
  }

  /* Console Drawer [Ctrl+`] */
  .console-drawer {
    position: absolute;
    bottom: 26px;
    left: 0;
    right: 0;
    height: 170px;
    background-color: var(--bg-panel);
    border-top: 1px solid var(--border-hairline);
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.65);
    z-index: 45;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.15s ease-out;
  }

  .drawer-header {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    background-color: var(--bg-container);
    border-bottom: 1px solid var(--border-hairline);
    flex-shrink: 0;
  }

  .drawer-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-main);
  }

  .log-badge {
    font-size: 9px;
    color: var(--text-dim);
    background-color: var(--bg-base);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .btn-close-drawer {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-xs);
    display: flex;
  }

  .btn-close-drawer:hover {
    color: var(--text-main);
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
  }

  .log-row {
    display: flex;
    gap: 8px;
    line-height: 1.4;
  }

  .log-ts {
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .log-row.info .log-text {
    color: var(--text-muted);
  }

  .log-row.success .log-text {
    color: var(--bull-color);
  }

  .log-row.warn .log-text {
    color: #f59e0b;
  }

  .text-bull {
    color: var(--bull-color);
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
</style>
