<script lang="ts">
  import { onMount, onDestroy, untrack, tick } from 'svelte';
  import Header from '../lib/components/Header.svelte';
  import Chart, { type ChartViewHandle } from '../lib/components/Chart.svelte';
  import type { ChartSessionController } from '../lib/services/chartSessionController';
  import DrawingToolbar from '../lib/components/DrawingToolbar.svelte';
  import WatchlistPanel from '../lib/components/WatchlistPanel.svelte';
  import ReplayBar from '../lib/components/ReplayBar.svelte';
  import PineEditor from '../lib/components/PineEditor.svelte';
  import StatusBar from '../lib/components/StatusBar.svelte';
  import SettingsModal from '../lib/components/SettingsModal.svelte';
  import IndicatorModal from '../lib/components/IndicatorModal.svelte';
  import IndicatorSettingsModal from '../lib/components/IndicatorSettingsModal.svelte';
  import SymbolSearchModal from '../lib/components/SymbolSearchModal.svelte';
  import TimeframeQuickBar from '../lib/components/TimeframeQuickBar.svelte';
  import CreateAlertModal from '../lib/components/CreateAlertModal.svelte';
  import AlertNotificationToast from '../lib/components/AlertNotificationToast.svelte';
  import SnapshotToast, { type SnapshotToastData } from '../lib/components/SnapshotToast.svelte';
  import SnapshotPreviewModal from '../lib/components/SnapshotPreviewModal.svelte';
  import RightDockRail from '../lib/components/RightDockRail.svelte';
  import ShortcutCheatsheetModal from '../lib/components/ShortcutCheatsheetModal.svelte';
  import DrawByHoldingModal from '../lib/components/DrawByHoldingModal.svelte';
  import StartupTutorialModal from '../lib/components/StartupTutorialModal.svelte';
  import { setAppLanguage } from '../lib/i18n';
  import type {
    TradePlanActivationRequest,
    ApplyPlanFromTabOptions,
    UpdatePlanFromTabOptions
  } from '../lib/services/tradePlanFormService';
  import {
    adjustPanelWidthByKeyboard,
    startEdgeResizeSession,
    type EdgeResizeSession
  } from '../lib/services/panelResizeHelper';
  import type { ParsedTradingPlan } from '../lib/services/planParserService';
  import { getAdaptiveTickSize } from '../lib/services/priceSnapService';
  import { formatPriceWithQuoteSymbol } from '../lib/services/priceScaleLabelService';
  import type { MarketSession } from '../lib/services/marketSessionService';
  import { parseAdaptiveSymbol } from '../lib/services/market/symbolSearchService';
  import {
    compositeSnapshot,
    captureSnapshot,
    copySnapshotToClipboard,
    downloadSnapshot,
    saveSnapshotToFile,
    generateSnapshotFilename,
    createSnapshotThumbnail,
    type SnapshotMetadata,
    type SnapshotOptions
  } from '../lib/services/chartSnapshotService';
  import { alertService } from '../lib/services/alertService';
  import { workspaceShellService, type WorkspaceShellState } from '../lib/services/workspaceShellService';
  import { hydrateDrawingToolsFromPersistence } from '../lib/services/drawingToolsService';
  import {
    ensureNotificationPermission,
    extractNotificationChannelsConfig,
  } from '../lib/services/systemNotificationService';
  import { marketFeed } from '../lib/services/market';
  import { telemetryService } from '../lib/services/telemetryService';
  import { replaySession, type ReplaySnapshot } from '../lib/services/replay';
  import { commandDispatcher } from '../lib/services/commandDispatcher';
  import { chartDrawingController, isSameSymbol } from '../lib/services/chartDrawingController';
  import { routeVenueForSymbol } from '../lib/services/instrumentIdentity';
  import { canonicalizeMacroIndexSymbol } from '../lib/services/macroIndexCatalog';
  import {
    executeWorkspaceLoadPipeline,
    WorkspaceAutoSaveCoordinator,
    buildWorkspaceSnapshotPayload,
    executeExitFlush,
    handleWindowCloseRequest,
    resolvePendingWorkspaceOverride,
    clearPendingWorkspaceBackup,
  } from '../lib/services/workspaceLifecycle';
  import { isSectionToken, isSymbolInWatchlist, toggleSymbolInWatchlist } from '../lib/services/watchlistUtils';
  import { watchlistRegistry } from '../lib/services/watchlistRegistryService';
  import type {
    TickerInfo,
    Timeframe,
    ActiveIndicatorInfo,
    DrawingToolType,
    SnapMode,
    MultiChartSyncConfig,
    WorkspaceMode,
    AppSettings,
    ColorModePreference,
    ThemePresetId,
    StrategyPerformanceSummary,
    PriceAlert,
    SavedWorkspace
  } from '../lib/types/market';
  import {
    storage,
    saveWorkspace,
    loadWorkspaces,
    cloneWorkspaceDrawings,
    getLastActiveWorkspaceId,
    setLastActiveWorkspaceId,
    computeWorkspaceFingerprint,
    flushDrawings
  } from '../lib/services/persistence';
  import {
    readClampedPanelWidth,
    readMarketSessionsFooterHidden
  } from '../lib/services/persistence/uiPreferencesHelper';
  import { chartTabsService, type ChartTabItem } from '../lib/services/chartTabsService';
  import { macroEventsService } from '../lib/services/macroEventsService';
  import { timelineMarksController } from '../lib/services/timelineMarksController';
  import {
    parseTradingViewUrl,
    resolveExternalSymbolWithFallback
  } from '../lib/services/tradingViewBridgeService';
  import {
    THEME_PRESETS,
    UI_FONT_OPTIONS,
    MONO_FONT_OPTIONS,
    DENSITY_OPTIONS,
    resolveEffectiveThemeColors,
    resolveEffectiveThemePreset,
    resolveEffectiveChartThemePreset,
    resolveThemeConfig,
    generateChartThesisThemeTokens,
    isBuiltInTheme,
    registerUserThemes,
    getNextColorMode
  } from '../lib/constants/themes';
  import {
    resolveThemeState,
    transitionThemeState,
    assembleThemeCssBundle,
    applyThemeCssBundle
  } from '../lib/services/themeEngine';
  import {
    DEFAULT_APP_SETTINGS,
    DEFAULT_SYNC_CONFIG,
    resolveAppSettings
  } from '../lib/constants/defaults';
  import {
    generateVelaThemeTokens,
    isDarkColor,
    withAlpha,
    deriveSurfaceColor
  } from '../lib/utils/colorUtils';
  import { getNextFavoriteTimeframe } from '../lib/utils/timeframeAdapter';

  import { Terminal, X, TrendingUp, Sparkles, Layers } from '@lucide/svelte';
  import { updateService } from '../lib/services/updateService';

  // ─── Core Market & Navigation State ───
  let activeSymbol = $state('BTCUSDT');
  let activeTimeframe = $state<Timeframe>('1m');
  let currentLayout = $state('1');
  let ticker = $state<TickerInfo | null>(null);
  let activeProviderId = $state('binance');
  let activePriceStyle = $state<string>('candles');

  // Dual Workspace Mode: 'terminal' vs 'pine'
  let workspaceMode = $state<WorkspaceMode>('terminal');
  let activeWorkspace = $state<SavedWorkspace | null>(null);
  let isAutoSaveWorkspace = $state<boolean>(true);
  let isPageMounted = $state(false);
  let isPersistenceBootstrapped = $state(false);
  let isLoadingWorkspace = false;
  let isClosingApp = false;
  let chartDirtyTick = $state(0);

  // Multi-Chart Sync State
  let syncConfig = $state<MultiChartSyncConfig>({ ...DEFAULT_SYNC_CONFIG });

  // Settings & Preferences State
  let appSettings = $state<AppSettings>({ ...DEFAULT_APP_SETTINGS });

  // System Theme Bridge State (#148)
  let systemIsDark = $state(true);

  // Tema preset efektif yang mengharmonisasikan preferensi pengguna dengan tema OS sistem
  const effectiveThemePreset = $derived(
    resolveEffectiveThemePreset(
      appSettings.colorModePreference ?? 'system',
      systemIsDark,
      appSettings.themePreset ?? 'signature',
      appSettings.activeDarkPreset ?? 'signature',
      appSettings.activeLightPreset ?? 'red_folder'
    )
  );

  // Tema kanvas grafik efektif (dapat didecouple dari tema aplikasi) (#149, ADR-0019)
  const effectiveChartThemePreset = $derived(
    resolveEffectiveChartThemePreset(
      appSettings.syncChartWithAppTheme ?? true,
      effectiveThemePreset,
      appSettings.chartThemePreset ?? 'signature',
      appSettings.colorModePreference ?? 'system',
      systemIsDark,
      appSettings.activeDarkChartPreset,
      appSettings.activeLightChartPreset
    )
  );

  // Daftarkan preset pengguna ke runtime tema secara reaktif (#149)
  $effect(() => {
    registerUserThemes(appSettings.savedUserThemes || []);
  });

  // Sinkronisasi bahasa reaktif (default 'jv' Jawa Ngoko Arekan)
  $effect(() => {
    setAppLanguage(appSettings.language ?? 'jv');
  });

  // Jika fitur Broker Execution Bridge dimatikan saat tab 'order' sedang terbuka, kembalikan ke 'watchlist'
  $effect(() => {
    if (!appSettings.executionBridgeEnabled && shellState.activeRightDockTab === 'order') {
      workspaceShellService.openRightDockTab('watchlist');
    }
  });

  function handleCycleColorMode() {
    const patch = transitionThemeState(appSettings, { type: 'CYCLE_COLOR_MODE' }, { systemIsDark });
    handleUpdateSettings(patch);
  }

  // Reaktif Sinkronisasi Tema, Token Vela, & Tipografi ke Elemen Root DOM via Deep Theme Engine
  $effect(() => {
    if (typeof document !== 'undefined') {
      const bundle = assembleThemeCssBundle(appSettings, { systemIsDark });
      applyThemeCssBundle(document, bundle);
    }
  });


  // Panels & Modals Visibility State
  let isSettingsModalOpen = $state(false);
  let isIndicatorModalOpen = $state(false);
  let isSymbolSearchOpen = $state(false);
  let symbolSearchInitialQuery = $state('');
  let symbolSearchTriggerSource = $state<'keystroke' | 'explicit'>('explicit');
  let isTimeframeQuickBarOpen = $state(false);
  let timeframeQuickBarInitialInput = $state('');
  let isShortcutCheatsheetOpen = $state(false);
  let isDrawByHoldingModalOpen = $state(false);
  let isStartupTutorialOpen = $state(false);
  let planActivationRequest = $state<TradePlanActivationRequest | null>(null);
  let nextPlanActivationNonce = 0;
  let settingsInitialTab = $state<'general' | 'appearance' | 'chart' | 'feed' | 'broker' | 'system' | 'about' | 'help'>('general');
  let isConsoleDrawerOpen = $state(false);

  // Docked Structural Shell Reactive States (Unified WorkspaceShell Deep Module)
  let shellState = $state<WorkspaceShellState>(workspaceShellService.getSnapshot());
  let chartSessionState = $state<{ session: MarketSession; sessionAvailable: boolean }>({
    session: 'regular',
    sessionAvailable: false,
  });
  let allAlerts = $state<PriceAlert[]>(alertService.getAlerts());
  let chartTabs = $state<ChartTabItem[]>(chartTabsService.getTabs());
  let activeChartTabId = $state<string>(chartTabsService.getActiveTab()?.id || '');
  let marketSessionsFooterHidden = $state<boolean>(false);
  let unsubShell: (() => void) | null = null;
  let unsubAlertsList: (() => void) | null = null;
  let unsubWatchlistRegistry: (() => void) | null = null;
  let unsubChartTabs: (() => void) | null = null;
  let detachMacroTimeline: (() => void) | null = null;
  let unlistenTvBridge: (() => void) | null = null;
  let stopPeriodicUpdateChecks: (() => void) | null = null;
  const pageManagedTimers = new Set<ReturnType<typeof setTimeout>>();
  let resizeDispatchTimer: ReturnType<typeof setTimeout> | null = null;
  let isPageDestroyed = false;

  function schedulePageTimeout(fn: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      pageManagedTimers.delete(timer);
      if (isPageDestroyed) return;
      fn();
    }, delayMs);
    pageManagedTimers.add(timer);
    return timer;
  }

  function scheduleResizeDispatch(delayMs = 40) {
    if (resizeDispatchTimer) {
      clearTimeout(resizeDispatchTimer);
      pageManagedTimers.delete(resizeDispatchTimer);
    }
    resizeDispatchTimer = schedulePageTimeout(() => {
      resizeDispatchTimer = null;
      window.dispatchEvent(new Event('resize'));
    }, delayMs);
  }

  function clearPageManagedTimers() {
    if (resizeDispatchTimer) {
      clearTimeout(resizeDispatchTimer);
      resizeDispatchTimer = null;
    }
    for (const timer of pageManagedTimers) {
      clearTimeout(timer);
    }
    pageManagedTimers.clear();
  }

  // Price Alerts Modals & Toast State
  let isCreateAlertModalOpen = $state(false);
  let createAlertSymbol = $state('BTCUSDT');
  let createAlertTargetPrice = $state<number | undefined>(undefined);
  let editingAlert = $state<PriceAlert | null>(null);
  let triggeredAlertsToasts = $state<PriceAlert[]>([]);

  // Snapshot State (#94, #125)
  let snapshotToast = $state<SnapshotToastData | null>(null);
  let isSnapshotPreviewOpen = $state(false);
  let isSnapshotProcessing = $state(false);

  function handleRequestCreateAlert(sym?: string, price?: number, alertToEdit?: PriceAlert | null) {
    editingAlert = alertToEdit || null;
    createAlertSymbol = alertToEdit ? alertToEdit.symbol : (sym || activeSymbol);
    createAlertTargetPrice = alertToEdit ? alertToEdit.targetPrice : price;
    isCreateAlertModalOpen = true;
  }

  function handleDismissAlertToast(id: string) {
    triggeredAlertsToasts = triggeredAlertsToasts.filter((a) => a.id !== id);
  }

  function openRightPlanTab(opts?: {
    subMode?: TradePlanActivationRequest['subMode'];
    planId?: string | null;
    initialText?: string;
  }) {
    const wasPine = workspaceMode === 'pine';
    if (wasPine) {
      handleWorkspaceModeChange('terminal');
    }
    nextPlanActivationNonce += 1;
    planActivationRequest = {
      subMode: opts?.subMode ?? 'form',
      planId: opts?.planId ?? null,
      initialText: opts?.initialText ?? '',
      nonce: nextPlanActivationNonce
    };
    workspaceShellService.openRightDockTab('plan');
    if (wasPine) {
      scheduleResizeDispatch(40);
    }
  }

  function handleConsumePlanActivation(nonce: number) {
    if (planActivationRequest?.nonce === nonce) {
      planActivationRequest = null;
    }
  }

  async function handleApplyPlanFromTab(
    plan: ParsedTradingPlan,
    options?: ApplyPlanFromTabOptions
  ) {
    const targetSym = plan.symbol || activeSymbol;
    const planWithSymbol = {
      ...plan,
      symbol: targetSym
    };
    const autoCreateAlerts = options?.autoCreateAlerts ?? !options?.isFromHistory;
    const result = await chartDrawingController.applyTradingPlan(planWithSymbol, {
      autoCreateAlerts,
      skipVaultSave: Boolean(options?.isFromHistory),
      replaceExistingOnSymbol: Boolean(options?.replaceExistingOnSymbol)
    });
    if (result) {
      const dualEntryCount =
        Array.isArray(plan.entries) && plan.entries.length > 1 ? plan.entries.length : 0;
      const alertInfo = autoCreateAlerts
        ? ` + ${2 + dualEntryCount + (plan.targets?.length || 0)} Price Alert otomatis`
        : '';
      addSystemLog(
        `Trading Plan ${plan.bias.toUpperCase()} (${planWithSymbol.symbol}) diterapkan ke chart${alertInfo}`,
        'success'
      );
    }
    return result;
  }

  async function handleUpdatePlanFromTab(
    planId: string,
    plan: ParsedTradingPlan,
    options?: UpdatePlanFromTabOptions
  ) {
    const targetSym = plan.symbol || activeSymbol;
    const planWithSymbol = {
      ...plan,
      symbol: targetSym
    };
    const result = await chartDrawingController.updateTradingPlan(planId, planWithSymbol, {
      autoCreateAlerts: options?.autoCreateAlerts
    });
    if (result) {
      addSystemLog(
        `Trading Plan ${plan.bias.toUpperCase()} (${planWithSymbol.symbol}) diperbarui di chart`,
        'success'
      );
    }
    return result;
  }

  // Deep Replay Session Reactive State
  let replaySnapshot = $state<ReplaySnapshot>(replaySession.getSnapshot());

  // Drawing Tools State
  let activeDrawingTool = $state<DrawingToolType | null>('cursor');
  let snapMode = $state<SnapMode>('off');
  let stayMode = $state(false);
  let isDrawingsLocked = $state(false);
  let isDrawingsHidden = $state(false);
  let activeDrawings = $state<any[]>([]);
  let selectedDrawingId = $state<string | null>(null);
  let currentActivePlans = $state<any[]>([]);
  let hasActivePlans = $state(false);
  let showThesisCards = $state(true);
  let currentThesisCardGeometries = $state<Record<string, any>>({});

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

  // Watchlist State
  let watchlistSymbols = $state<string[]>([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
  ]);
  const isActiveSymbolWatchlisted = $derived(
    isSymbolInWatchlist(watchlistSymbols, activeSymbol, activeProviderId)
  );

  function handleNavigateWatchlist(direction: number) {
    const rawList = watchlistSymbols.length > 0 ? watchlistSymbols : [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
      'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
    ];
    const list = rawList.filter((item) => !isSectionToken(item));
    if (list.length === 0) return;
    const idx = list.indexOf(activeSymbol);
    if (idx === -1) {
      handleSymbolChange(list[0]);
    } else {
      let nextIdx = (idx + direction) % list.length;
      if (nextIdx < 0) nextIdx += list.length;
      handleSymbolChange(list[nextIdx]);
    }
  }

  let sessionController: ChartSessionController | null = $state(null);
  let chartView: ChartViewHandle | null = $state(null);
  let pineEditorComponent: any = $state(null);
  let unsubTicker: (() => void) | null = null;
  let pinePanelWidth = $state(480);
  let activePineResizeSession: EdgeResizeSession | null = null;

  // Terminal Diagnostics Logs
  let systemLogs = $state<{ time: string; msg: string; level: 'info' | 'success' | 'warn' | 'error' }[]>([
    { time: '16:00:01', msg: 'Trawangan Native Core initialized via Tauri v2.', level: 'info' },
    { time: '16:00:02', msg: 'SQLite embedded database connected (rusqlite 0.32).', level: 'info' },
    { time: '16:00:03', msg: 'Binance WebSocket stream active (wss://stream.binance.com).', level: 'success' },
    { time: '16:00:05', msg: 'LuxAlgo Vela WebGL2 context ready. Target: 120 FPS.', level: 'success' },
  ]);

  let unsubAlertTrigger: (() => void) | null = null;
  let unsubReplay: (() => void) | null = null;

  $effect(() => {
    if (!isPersistenceBootstrapped) return;
    const sym = activeSymbol;
    if (sym) {
      if (unsubTicker) unsubTicker();
      unsubTicker = untrack(() => {
        return marketFeed.subscribeActiveTicker(sym, (newTicker) => {
          ticker = newTicker;
        });
      });
      return () => {
        if (unsubTicker) {
          unsubTicker();
          unsubTicker = null;
        }
      };
    }
  });

  onMount(() => {
    let isPageActive = true;
    const unsubPersistenceError = storage.onError((evt) => {
      addSystemLog(evt.message, 'error');
    });

    // Jalankan bootstrap persistence paling awal sebelum inisialisasi shell, feed pasar, atau workspace
    const runStartupHydration = async () => {
      try {
        await storage.bootstrap();
      } catch (err) {
        console.warn('[Startup] Gagal menjalankan bootstrap persistence:', err);
        addSystemLog(
          `Gagal inisialisasi basis data lokal: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      }
      if (!isPageActive) return;

      unsubReplay = replaySession.subscribe((snap) => {
        replaySnapshot = snap;
      });

      unsubShell = workspaceShellService.subscribe((s) => {
        shellState = s;
        scheduleResizeDispatch(40);
      });
      workspaceShellService.reloadFromPersistence();
      hydrateDrawingToolsFromPersistence();

      unsubAlertsList = alertService.subscribe((list) => {
        allAlerts = list;
      });

      // Muat preferensi aplikasi tersimpan dari cache sinkron PersistenceService pasca-bootstrap
      try {
        const savedSettings = storage.getSettingsSync();
        appSettings = resolveAppSettings(savedSettings);
        if (appSettings.defaultTimeframe) {
          activeTimeframe = appSettings.defaultTimeframe;
        }
        if (appSettings.syncConfig) {
          syncConfig = { ...appSettings.syncConfig };
        }
        if (appSettings.autoSaveWorkspace !== undefined) {
          isAutoSaveWorkspace = appSettings.autoSaveWorkspace;
        }

        const savedPineWidth = readClampedPanelWidth('pine_panel_width', 340, 900, storage);
        if (savedPineWidth !== null) {
          pinePanelWidth = savedPineWidth;
        }

        const activeBootProvider = storage.getProvidersSync().find((p) => p.is_active);
        if (activeBootProvider?.id && activeBootProvider.id.toLowerCase() !== 'macro') {
          activeProviderId = activeBootProvider.id;
          marketFeed.setActiveProviderContext(activeBootProvider.id);
          telemetryService.setActiveProvider(activeBootProvider.id);
        }

        marketSessionsFooterHidden = readMarketSessionsFooterHidden(storage);
      } catch (e) {
        console.warn('Gagal memuat pengaturan tersimpan:', e);
      }

      // Bootstrap Quick Chart Tabs dan sinkronkan ke tab aktif tersimpan
      unsubChartTabs = chartTabsService.subscribe((tabState) => {
        chartTabs = tabState.tabs;
        activeChartTabId = tabState.activeTabId;
      });
      const bootTabsState = await chartTabsService.bootstrap({
        symbol: activeSymbol,
        providerId: activeProviderId,
        timeframe: activeTimeframe,
      });
      if (!isPageActive) return;
      const bootActiveTab = bootTabsState.tabs.find((t) => t.id === bootTabsState.activeTabId);
      if (bootActiveTab) {
        activeSymbol = bootActiveTab.symbol;
        activeProviderId = bootActiveTab.providerId;
        activeTimeframe = bootActiveTab.timeframe;
        marketFeed.setActiveProviderContext(bootActiveTab.providerId);
        telemetryService.setActiveProvider(bootActiveTab.providerId);
      }

      timelineMarksController.hydrateFromPersistence();
      detachMacroTimeline = macroEventsService.attachTimelineController(timelineMarksController);
      void macroEventsService.refresh();

      isPersistenceBootstrapped = true;
      isPageMounted = true;

      if (!appSettings.hasCompletedOnboarding) {
        isStartupTutorialOpen = true;
      }

      // Auto-load workspace terakhir saat startup jika preferensi aktif (disertai recovery pending backup bila ada)
      if (appSettings.autoLoadLastWorkspace !== false) {
        const lastWorkspaceId = getLastActiveWorkspaceId();
        if (lastWorkspaceId) {
          loadWorkspaces().then(async (list) => {
            if (!isPageActive) return;
            const target = list.find((w) => w.id === lastWorkspaceId);
            if (target) {
              const { workspace: recoveredWs, usedPending } = resolvePendingWorkspaceOverride(target, lastWorkspaceId);
              if (usedPending) {
                try {
                  await saveWorkspace(recoveredWs as any);
                } catch (_) {}
              }
              // Beri jeda singkat agar WebGL container mount sempurna sebelum inject layout & indikator
              schedulePageTimeout(() => {
                if (!isPageActive) return;
                handleLoadWorkspace(recoveredWs).catch((err) => {
                  console.warn('[Startup] Gagal auto-load workspace terakhir:', err);
                });
              }, 400);
            }
          }).catch((err) => {
            console.warn('[Startup] Gagal auto-load workspace terakhir:', err);
          });
        }
      }

      // Sinkronisasi preferensi audio notifikasi, desktop sistem, serta kanal eksternal (Telegram & Discord)
      alertService.setSoundEnabled(appSettings.soundEnabled);
      alertService.setSystemNotificationEnabled(appSettings.systemNotificationEnabled !== false);
      alertService.setNotificationChannelsConfig(extractNotificationChannelsConfig(appSettings));

      // Verifikasi izin notifikasi native desktop sistem
      ensureNotificationPermission().then((granted) => {
        if (granted && isPageActive) {
          addSystemLog('Notifikasi desktop sistem aktif.', 'info');
        }
      });

      // Pengecekan pembaruan otomatis saat startup dan berkala tiap 6 jam (silent check)
      schedulePageTimeout(() => {
        if (!isPageActive) return;
        updateService.checkForUpdates(true);
      }, 3000);
      stopPeriodicUpdateChecks = updateService.startPeriodicChecks();

      // Dengarkan event saat Price Alert / Pine Script Alert terpicu secara real-time
      unsubAlertTrigger = alertService.onTrigger((alert, actualPrice) => {
        triggeredAlertsToasts = [alert, ...triggeredAlertsToasts.slice(0, 3)];
        if (alert.planRole === 'pine_alert') {
          addSystemLog(`🔔 Pine Alert Terpicu: ${alert.symbol} — ${alert.label || 'Script Alert'}`, 'warn');
        } else {
          const triggerPriceStr = formatPriceWithQuoteSymbol(
            actualPrice,
            parseAdaptiveSymbol(alert.symbol).quoteAsset,
            alert.symbol
          );
          addSystemLog(`🔔 Price Alert Terpicu: ${alert.symbol} di ${triggerPriceStr}`, 'warn');
        }
        schedulePageTimeout(() => {
          if (!isPageActive) return;
          handleDismissAlertToast(alert.id);
        }, 12000);
      });

      marketFeed.getActiveProviderId().then((pId) => {
        if (pId && isPageActive) {
          activeProviderId = pId;
          telemetryService.setActiveProvider(pId);
        }
      });

      unsubWatchlistRegistry = watchlistRegistry.subscribe(({ watchlists, activeId }) => {
        const current = watchlists.find((w) => w.id === activeId);
        if (current) {
          watchlistSymbols = [...current.items];
        }
      });
      watchlistRegistry.load().catch((err) => {
        console.warn('[Page] Gagal memuat multi-watchlist:', err);
      });
    };

    void runStartupHydration();

    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        if (!isPageActive) return null;
        return listen<{ url?: string; symbol?: string | null; timeframe?: string | null }>(
          'tradingview-bridge-open',
          (event) => {
            if (!isPageActive) return;
            void handleTradingViewBridgeOpen(event.payload);
          }
        );
      })
      .then((unsub) => {
        if (!unsub) return;
        if (!isPageActive) {
          unsub();
          return;
        }
        unlistenTvBridge = unsub;
      })
      .catch(() => {});

    // Auto-Flush gambar dan simpan pending backup + workspace sebelum aplikasi ditutup (beforeunload & Tauri onCloseRequested)
    const runExitFlush = () =>
      executeExitFlush({
        flushDrawings: () => flushDrawings(),
        buildSnapshot: () => {
          if (!isAutoSaveWorkspace || !activeWorkspace || !sessionController) return null;
          return buildCurrentWorkspacePayload(activeWorkspace.name, activeWorkspace.id);
        },
        coordinator: isAutoSaveWorkspace ? workspaceCoordinator : null,
      });

    const handleBeforeUnload = () => {
      isClosingApp = true;
      void runExitFlush();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    let unlistenCloseRequested: (() => void) | null = null;
    const closeRequestState = { isClosing: false };
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        if (!isPageActive) return;
        const appWindow = getCurrentWindow();
        appWindow
          .onCloseRequested(async (event) => {
            await handleWindowCloseRequest({
              event,
              appWindow,
              flush: runExitFlush,
              timeoutMs: 1500,
              state: closeRequestState,
              onBeforeFlush: () => {
                isClosingApp = true;
              },
            });
          })
          .then((unsub) => {
            if (!isPageActive) {
              unsub();
              return;
            }
            unlistenCloseRequested = unsub;
          })
          .catch(() => {});
      })
      .catch(() => {});

    const openTerminalRightDockTab = (tab: 'objects' | 'alerts' | 'datawindow' | 'events', logMsg: string) => {
      if (workspaceMode === 'pine') {
        handleWorkspaceModeChange('terminal');
      }
      workspaceShellService.toggleRightDockTab(tab);
      addSystemLog(logMsg, 'info');
    };

    const cycleFavoriteTimeframe = (direction: 1 | -1) => {
      // Gunakan urutan durasi yang sama dengan bilah atas agar pintasan keyboard tidak melompat acak
      const targetTf = getNextFavoriteTimeframe(
        appSettings.favoriteTimeframes,
        activeTimeframe,
        direction
      );
      if (targetTf) {
        handleTimeframeChange(targetTf);
      }
    };

    // ─── Daftarkan Binding Perintah Terminal ke Deep CommandDispatcher ───
    const commandUnbinds: (() => void)[] = [
      commandDispatcher.bindHandler('toggle-console', () => {
        isConsoleDrawerOpen = !isConsoleDrawerOpen;
      }),
      commandDispatcher.bindHandler('search-symbol', () => {
        symbolSearchInitialQuery = '';
        symbolSearchTriggerSource = 'explicit';
        isSymbolSearchOpen = true;
      }),
      commandDispatcher.bindHandler('help-cheatsheet-f1', () => {
        isShortcutCheatsheetOpen = true;
      }),
      commandDispatcher.bindHandler('help-cheatsheet-question', () => {
        isShortcutCheatsheetOpen = true;
      }),
      commandDispatcher.bindHandler('open-settings', () => {
        settingsInitialTab = 'general';
        isSettingsModalOpen = true;
      }),
      commandDispatcher.bindHandler('open-indicators', () => {
        isIndicatorModalOpen = true;
      }),
      commandDispatcher.bindHandler('open-indicators-ctrl-i', () => {
        isIndicatorModalOpen = true;
      }),
      commandDispatcher.bindHandler('fullscreen-toggle', () => {
        if (typeof document !== 'undefined') {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      }),
      commandDispatcher.bindHandler('nav-watchlist-space', (e) => {
        handleNavigateWatchlist(e.shiftKey ? -1 : 1);
      }),
      commandDispatcher.bindHandler('toggle-watchlist', () => {
        workspaceShellService.toggleRightDockTab('watchlist');
        addSystemLog(`Shortcut: Panel Watchlist ${shellState.isRightDockOpen ? 'ditutup' : 'dibuka'} (Alt+W)`, 'info');
      }),
      commandDispatcher.bindHandler('toggle-pine-editor', () => {
        handleWorkspaceModeChange(workspaceMode === 'pine' ? 'terminal' : 'pine');
        addSystemLog(`Shortcut: Beralih ke mode ${workspaceMode === 'pine' ? 'Terminal' : 'Pine IDE'} (Alt+E)`, 'info');
      }),
      commandDispatcher.bindHandler('toggle-left-toolbar', () => {
        workspaceShellService.toggleLeftRail();
        addSystemLog(`Shortcut: Bilah gambar ${shellState.isLeftRailCollapsed ? 'disembunyikan' : 'ditampilkan'} (Alt+T)`, 'info');
      }),
      commandDispatcher.bindHandler('toggle-gesture-mode', () => {
        chartDrawingController.toggleGestureMode();
        addSystemLog(`Shortcut: Gesture Draw Mode ${chartDrawingController.isGestureMode() ? 'diaktifkan' : 'dinonaktifkan'} (Shift+D)`, 'info');
      }),
      commandDispatcher.bindHandler('draw-hline', () => {
        handleSelectTool('hline');
        addSystemLog('Shortcut: Tool Horizontal Line dipilih (Alt+H)', 'info');
      }),
      commandDispatcher.bindHandler('draw-fibonacci', () => {
        handleSelectTool('fibretracement');
        addSystemLog('Shortcut: Tool Fibonacci Retracement dipilih (Alt+F)', 'info');
      }),
      commandDispatcher.bindHandler('draw-measure', () => {
        handleSelectTool('measure');
        addSystemLog('Shortcut: Tool Penggaris/Measure dipilih (Alt+M)', 'info');
      }),
      commandDispatcher.bindHandler('draw-position', () => {
        handleSelectTool('position');
        addSystemLog('Shortcut: Tool Posisi Long/Short Risk/Reward dipilih (Alt+R)', 'info');
      }),
      commandDispatcher.bindHandler('open-import-plan', () => {
        openRightPlanTab({ subMode: 'form' });
        addSystemLog('Shortcut: Buka tab Trade Plan di panel kanan (Ctrl+Shift+P)', 'info');
      }),
      commandDispatcher.bindHandler('fit-chart-z', () => {
        sessionController?.fitChart();
        addSystemLog('Shortcut: Reset skala/fit grafik (Alt+Z)', 'info');
      }),
      commandDispatcher.bindHandler('fit-chart-f', () => {
        sessionController?.fitChart();
        addSystemLog('Shortcut: Fit grafik ke viewport (F)', 'info');
      }),
      commandDispatcher.bindHandler('create-alert-cursor', () => {
        const cursorPrice = chartView?.getLastHoveredPrice() ?? ticker?.price;
        handleRequestCreateAlert(activeSymbol, cursorPrice);
        addSystemLog(`Shortcut: Buat Price Alert untuk ${activeSymbol} (Alt+A)`, 'info');
      }),
      commandDispatcher.bindHandler('next-symbol', () => {
        handleNavigateWatchlist(1);
      }),
      commandDispatcher.bindHandler('prev-symbol', () => {
        handleNavigateWatchlist(-1);
      }),
      commandDispatcher.bindHandler('replay-toggle', () => {
        handleToggleReplay();
      }),
      commandDispatcher.bindHandler('replay-play-pause', () => {
        if (replaySnapshot.active) {
          replaySession.togglePlay();
        }
      }),
      commandDispatcher.bindHandler('replay-step-forward', () => {
        if (replaySnapshot.active) {
          replaySession.step(1);
        }
      }),
      commandDispatcher.bindHandler('replay-step-backward', () => {
        if (replaySnapshot.active) {
          replaySession.stepBack(1);
        }
      }),
      commandDispatcher.bindHandler('replay-fast-forward', () => {
        if (replaySnapshot.active) {
          replaySession.step(10);
        }
      }),
      commandDispatcher.bindHandler('replay-fast-backward', () => {
        if (replaySnapshot.active) {
          replaySession.stepBack(10);
        }
      }),
      commandDispatcher.bindHandler('cancel-action', () => {
        if (replaySnapshot.isSelectingBar) {
          replaySession.cancelBarSelection();
          addSystemLog('Mode pemilihan bar dibatalkan.', 'info');
          return;
        }
        handleSelectTool('cursor');
      }),
      commandDispatcher.bindHandler('draw-delete', () => {
        const deletedIds = chartDrawingController.deleteSelectedDrawing();
        if (deletedIds.length > 0) {
          addSystemLog(`Objek gambar dihapus: ${deletedIds.join(', ')}`, 'info');
        }
      }),
      commandDispatcher.bindHandler('copy-selected-drawing', () => {
        if (chartDrawingController.copySelectedDrawing()) {
          addSystemLog('Shortcut: Objek gambar disalin ke clipboard (Ctrl+C)', 'info');
        }
      }),
      commandDispatcher.bindHandler('paste-drawing', () => {
        const newId = chartDrawingController.pasteDrawing();
        if (newId) {
          addSystemLog(`Shortcut: Objek gambar ditempel (${newId}) (Ctrl+V)`, 'info');
        }
      }),
      commandDispatcher.bindHandler('duplicate-selected-drawing', () => {
        const newId = chartDrawingController.duplicateSelectedDrawing();
        if (newId) {
          addSystemLog(`Shortcut: Duplikasi objek gambar (${newId}) (Ctrl+D)`, 'info');
        }
      }),
      commandDispatcher.bindHandler('toggle-hide-drawings', () => {
        const hidden = chartDrawingController.toggleHide();
        addSystemLog(`Visibilitas objek gambar: ${hidden ? 'DISEMBUNYIKAN' : 'DITAMPILKAN'}`, 'info');
      }),
      commandDispatcher.bindHandler('toggle-lock-drawings', () => {
        const locked = chartDrawingController.toggleLock();
        addSystemLog(`Kunci objek gambar: ${locked ? 'TERKUNCI' : 'TERBUKA'}`, 'info');
      }),
      commandDispatcher.bindHandler('clear-all-drawings', () => {
        chartDrawingController.clearAll().then(() => {
          addSystemLog(`Seluruh objek gambar pada ${activeSymbol} dibersihkan`, 'info');
        });
      }),
      commandDispatcher.bindHandler('toggle-objects-tree', () => {
        openTerminalRightDockTab('objects', 'Shortcut: Beralih panel Object Tree & Indikator (Alt+O)');
      }),
      commandDispatcher.bindHandler('toggle-alerts-dock', () => {
        openTerminalRightDockTab('alerts', 'Shortcut: Beralih panel Price Alerts (Alt+Shift+A)');
      }),
      commandDispatcher.bindHandler('toggle-datawindow-dock', () => {
        openTerminalRightDockTab('datawindow', 'Shortcut: Beralih panel Data Window Inspector (Alt+D)');
      }),
      commandDispatcher.bindHandler('toggle-events-dock', () => {
        openTerminalRightDockTab('events', 'Shortcut: Beralih panel Events & Kalender Makro (Alt+C)');
      }),
      commandDispatcher.bindHandler('toggle-right-dock-hider', () => {
        workspaceShellService.toggleRightDockHider();
      }),
      commandDispatcher.bindHandler('new-chart-tab', () => {
        handleAddChartTab();
      }),
      commandDispatcher.bindHandler('close-chart-tab', () => {
        if (activeChartTabId) {
          void handleCloseChartTab(activeChartTabId);
        }
      }),
      commandDispatcher.bindHandler('next-chart-tab', () => {
        const next = chartTabsService.cycleTab(1);
        if (next) void handleSelectChartTab(next.id);
      }),
      commandDispatcher.bindHandler('prev-chart-tab', () => {
        const prev = chartTabsService.cycleTab(-1);
        if (prev) void handleSelectChartTab(prev.id);
      }),
      ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) =>
        commandDispatcher.bindHandler(`jump-chart-tab-${n}`, () => {
          const target = chartTabsService.focusTabByIndex(n);
          if (target) void handleSelectChartTab(target.id);
        })
      ),
      commandDispatcher.bindHandler('prev-chart-cell', () => {
        sessionController?.focusCellByOffset(-1);
      }),
      commandDispatcher.bindHandler('next-chart-cell', () => {
        sessionController?.focusCellByOffset(1);
      }),
      commandDispatcher.bindHandler('scroll-to-realtime', () => {
        sessionController?.scrollToRealtime();
      }),
      commandDispatcher.bindHandler('toggle-alert-lines', () => {
        const nextVal = !(appSettings.showAlertLines ?? true);
        handleUpdateSettings({ showAlertLines: nextVal });
        addSystemLog(
          `Garis Price Alert di grafik: ${nextVal ? 'TAMPIL' : 'TERSEMBUNYI'} (Alt+Shift+H)`,
          'info'
        );
      }),
      commandDispatcher.bindHandler('prev-favorite-timeframe', () => {
        cycleFavoriteTimeframe(-1);
      }),
      commandDispatcher.bindHandler('next-favorite-timeframe', () => {
        cycleFavoriteTimeframe(1);
      }),
      commandDispatcher.bindHandler('invert-price-scale', () => {
        if (sessionController) {
          const cur = sessionController.getPriceScaleState();
          const nextInvert = !cur?.invert;
          sessionController.applyPriceScaleState({ ...cur, invert: nextInvert });
          addSystemLog(`Invert skala harga: ${nextInvert ? 'AKTIF' : 'NONAKTIF'} (Alt+I)`, 'info');
        }
      }),
      commandDispatcher.bindHandler('cycle-price-style', () => {
        if (sessionController) {
          const nextStyle = sessionController.cyclePriceStyle();
          activePriceStyle = nextStyle;
          addSystemLog(`Siklus gaya lilin grafik: ${nextStyle.toUpperCase()} (Alt+Y)`, 'info');
        }
      }),
      commandDispatcher.bindHandler('cycle-range-preset', () => {
        if (sessionController) {
          void sessionController.cycleRangePreset('next').then((nextPreset: string | null) => {
            if (nextPreset) {
              addSystemLog(`Siklus rentang waktu grafik: ${nextPreset} (Alt+R)`, 'info');
            }
          });
        }
      }),
      commandDispatcher.bindHandler('draw-undo', () => {
        handleUndo();
      }),
      commandDispatcher.bindHandler('draw-redo', () => {
        handleRedo();
      }),
      commandDispatcher.bindHandler('quick-snapshot-copy', (e) => {
        e.preventDefault();
        handleQuickCopySnapshot();
      }),
    ];

    const unsubDrawingState = chartDrawingController.subscribe((state) => {
      if (activeDrawingTool !== state.activeTool) activeDrawingTool = state.activeTool;
      if (snapMode !== state.snapMode) snapMode = state.snapMode;
      if (stayMode !== state.stayMode) stayMode = state.stayMode;
      if (isDrawingsLocked !== state.isLocked) isDrawingsLocked = state.isLocked;
      if (isDrawingsHidden !== state.isHidden) isDrawingsHidden = state.isHidden;
      activeDrawings = state.activeDrawings;
      if (selectedDrawingId !== state.selectedDrawingId) selectedDrawingId = state.selectedDrawingId;
      if (currentActivePlans !== state.activePlans) {
        currentActivePlans = state.activePlans || [];
        hasActivePlans = Boolean(state.activePlans && state.activePlans.length > 0);
      }
      const nextShowCards = state.showThesisCards ?? true;
      if (showThesisCards !== nextShowCards) showThesisCards = nextShowCards;
      if (currentThesisCardGeometries !== state.thesisCardGeometries) {
        currentThesisCardGeometries = state.thesisCardGeometries || {};
      }
    });

    chartDrawingController.setSymbolReadyHandler(async (targetSym) => {
      if (targetSym && targetSym !== activeSymbol) {
        await handleSymbolChange(targetSym);
        await tick();
      }
    });

    const unbindGlobalListener = commandDispatcher.attachGlobalListener(window);
    const unsubTypeToSearch = commandDispatcher.onTypeToSearch((char) => {
      symbolSearchInitialQuery = char;
      symbolSearchTriggerSource = 'keystroke';
      isSymbolSearchOpen = true;
    });
    const unsubTypeTimeframe = commandDispatcher.onTypeTimeframe((digit) => {
      timeframeQuickBarInitialInput = digit;
      isTimeframeQuickBarOpen = true;
    });

    // System Theme Bridge: Dengarkan preferensi prefers-color-scheme OS secara reaktif (#148)
    let detachMediaQuery: (() => void) | undefined;
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      systemIsDark = mql.matches;
      const mqlListener = (e: MediaQueryListEvent) => {
        systemIsDark = e.matches;
      };
      mql.addEventListener('change', mqlListener);
      detachMediaQuery = () => mql.removeEventListener('change', mqlListener);
    }

    return () => {
      isPageActive = false;
      unsubPersistenceError();
      clearPageManagedTimers();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (unlistenCloseRequested) unlistenCloseRequested();
      workspaceCoordinator.cancel();
      if (detachMediaQuery) detachMediaQuery();
      unbindGlobalListener();
      unsubTypeToSearch();
      unsubTypeTimeframe();
      unsubDrawingState();
      commandUnbinds.forEach((u) => u());
    };
  });

  onDestroy(() => {
    isPageDestroyed = true;
    clearPageManagedTimers();
    activePineResizeSession?.cancel();
    activePineResizeSession = null;
    if (unsubTicker) unsubTicker();
    if (unsubAlertTrigger) unsubAlertTrigger();
    if (unsubReplay) unsubReplay();
    if (unsubShell) unsubShell();
    if (unsubAlertsList) unsubAlertsList();
    if (unsubWatchlistRegistry) unsubWatchlistRegistry();
    if (unsubChartTabs) unsubChartTabs();
    if (detachMacroTimeline) detachMacroTimeline();
    if (unlistenTvBridge) unlistenTvBridge();
    if (stopPeriodicUpdateChecks) stopPeriodicUpdateChecks();
  });

  $effect(() => {
    if (!isPersistenceBootstrapped) return;
    chartTabsService.syncActiveTab({
      symbol: activeSymbol,
      providerId: activeProviderId,
      timeframe: activeTimeframe,
    });
  });

  async function handleTradingViewBridgeOpen(payload?: {
    url?: string;
    symbol?: string | null;
    timeframe?: string | null;
  }) {
    const rawInput = payload?.url || payload?.symbol;
    if (!rawInput) return;

    const parsed = parseTradingViewUrl(rawInput, payload?.timeframe ?? null);
    if (!parsed) {
      addSystemLog(`TradingView Bridge: gagal mengurai target "${rawInput}".`, 'warn');
      return;
    }

    const resolved = await resolveExternalSymbolWithFallback(parsed, marketFeed);
    if (!resolved) {
      addSystemLog(
        `TradingView Bridge: instrumen ${parsed.normalizedSymbol} tidak tersedia di bursa terhubung.`,
        'warn'
      );
      snapshotToast = {
        visible: true,
        type: 'error',
        message: `Simbol ${parsed.normalizedSymbol} tidak tersedia di provider aktif.`,
        timestamp: Date.now(),
      };
      return;
    }

    const nextTimeframe = (parsed.timeframe as Timeframe | undefined) || activeTimeframe;
    chartTabsService.openOrFocusTab({
      symbol: resolved.symbol,
      providerId: resolved.providerId,
      timeframe: nextTimeframe,
    });

    await handleSymbolChange(resolved.symbol, resolved.providerId);
    if (parsed.timeframe && parsed.timeframe !== activeTimeframe) {
      handleTimeframeChange(parsed.timeframe as Timeframe);
    }

    if (resolved.redirectedFrom) {
      const notice = `${resolved.redirectedFrom} tidak tersedia; dialihkan ke ${resolved.providerId.toUpperCase()} (${resolved.symbol}).`;
      addSystemLog(`TradingView Bridge: ${notice}`, 'info');
      snapshotToast = {
        visible: true,
        type: 'saved',
        message: notice,
        timestamp: Date.now(),
      };
    } else {
      addSystemLog(
        `TradingView Bridge membuka ${resolved.symbol} (${resolved.providerId.toUpperCase()})`,
        'success'
      );
    }
  }

  async function handleSelectChartTab(tabId: string) {
    const focused = chartTabsService.focusTab(tabId);
    if (!focused) return;
    await handleSymbolChange(focused.symbol, focused.providerId);
    if (focused.timeframe !== activeTimeframe) {
      handleTimeframeChange(focused.timeframe);
    }
  }

  function handleAddChartTab() {
    chartTabsService.addNewTab({
      symbol: activeSymbol,
      providerId: activeProviderId,
      timeframe: activeTimeframe,
    });
    symbolSearchInitialQuery = '';
    symbolSearchTriggerSource = 'explicit';
    isSymbolSearchOpen = true;
  }

  async function handleCloseChartTab(tabId: string) {
    const prevActiveId = activeChartTabId;
    const closed = chartTabsService.closeTab(tabId);
    if (!closed) return;
    if (prevActiveId === tabId) {
      const nextActive = chartTabsService.getActiveTab();
      if (nextActive) {
        await handleSymbolChange(nextActive.symbol, nextActive.providerId);
        if (nextActive.timeframe !== activeTimeframe) {
          handleTimeframeChange(nextActive.timeframe);
        }
      }
    }
  }

  async function flushDrawingsWithLog(context: string): Promise<void> {
    try {
      await flushDrawings();
    } catch (err) {
      addSystemLog(
        `Gagal menguras gambar ${context}: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
  }

  async function switchCellProviderContext(nextProviderId: string) {
    if (!nextProviderId || nextProviderId === activeProviderId) return;
    await flushDrawingsWithLog('sebelum beralih provider sel');
    activeProviderId = nextProviderId;
    marketFeed.setActiveProviderContext(nextProviderId);
    telemetryService.setActiveProvider(nextProviderId);
  }

  async function handleSymbolChange(newSym: string, providerHint?: string) {
    const targetProvider = routeVenueForSymbol(newSym, activeProviderId, providerHint);
    const nextSym =
      targetProvider === 'macro'
        ? (canonicalizeMacroIndexSymbol(newSym) || newSym)
        : newSym.replace(/^[A-Za-z0-9_-]+:/, '');

    if (targetProvider !== activeProviderId) {
      if (targetProvider === 'macro') {
        await switchCellProviderContext('macro');
      } else {
        await handleProviderChange(targetProvider);
      }
    }

    if (activeSymbol && activeSymbol !== nextSym) {
      await flushDrawingsWithLog('sebelum ganti simbol');
    }
    activeSymbol = nextSym;
    addSystemLog(`Simbol berganti ke ${nextSym} (${targetProvider.toUpperCase()})`, 'info');
  }

  function handleTimeframeChange(newTf: Timeframe) {
    activeTimeframe = newTf;
    addSystemLog(`Timeframe aktif: ${newTf}`, 'info');
  }

  function handleLayoutChange(newLayout: string) {
    currentLayout = newLayout;
    addSystemLog(`Tata letak chart: ${newLayout}`, 'info');
  }

  function handleActiveCellChange(cellInfo: { symbol: string; timeframe: Timeframe; providerId?: string }) {
    if (cellInfo.symbol && cellInfo.symbol !== activeSymbol) {
      activeSymbol = cellInfo.symbol;
    }
    if (cellInfo.timeframe && cellInfo.timeframe !== activeTimeframe) {
      activeTimeframe = cellInfo.timeframe;
    }
    if (cellInfo.providerId && cellInfo.providerId !== activeProviderId) {
      activeProviderId = cellInfo.providerId;
      marketFeed.setActiveProviderContext(cellInfo.providerId);
      telemetryService.setActiveProvider(cellInfo.providerId);
    }
  }

  function persistAppSettings() {
    void storage.saveSettings(appSettings).catch((e) => {
      console.warn('Gagal menyimpan preferensi aplikasi ke PersistenceService:', e);
    });
  }

  function handleToggleSyncCrosshair() {
    syncConfig.crosshair = !syncConfig.crosshair;
    appSettings.syncConfig = { ...syncConfig };
    persistAppSettings();
    addSystemLog(`Sinkronisasi kursor crosshair: ${syncConfig.crosshair ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function handleToggleSyncViewport() {
    syncConfig.viewport = !syncConfig.viewport;
    appSettings.syncConfig = { ...syncConfig };
    persistAppSettings();
    addSystemLog(`Sinkronisasi gerakan viewport: ${syncConfig.viewport ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function handleToggleSyncSymbol() {
    syncConfig.symbol = !syncConfig.symbol;
    appSettings.syncConfig = { ...syncConfig };
    persistAppSettings();
    addSystemLog(`Sinkronisasi simbol market: ${syncConfig.symbol ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function handleToggleSyncDrawings() {
    syncConfig.drawings = !syncConfig.drawings;
    appSettings.syncConfig = { ...syncConfig };
    persistAppSettings();
    addSystemLog(`Sinkronisasi objek gambar: ${syncConfig.drawings ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function handleToggleSyncIndicators() {
    syncConfig.indicators = !syncConfig.indicators;
    appSettings.syncConfig = { ...syncConfig };
    persistAppSettings();
    addSystemLog(`Sinkronisasi indikator multi-chart: ${syncConfig.indicators ? 'AKTIF' : 'NONAKTIF'}`, 'info');
    if (syncConfig.indicators && sessionController) {
      sessionController.syncIndicatorsFromActiveCell();
    }
  }

  function handleToggleSyncStyle() {
    syncConfig.style = !syncConfig.style;
    appSettings.syncConfig = { ...syncConfig };
    persistAppSettings();
    addSystemLog(`Sinkronisasi gaya lilin multi-chart: ${syncConfig.style ? 'AKTIF' : 'NONAKTIF'}`, 'info');
    if (syncConfig.style && sessionController) {
      sessionController.syncLayout({ style: syncConfig.style });
    }
  }

  function handlePriceStyleChange(newStyle: string) {
    activePriceStyle = newStyle;
    sessionController?.setPriceStyle(newStyle);
    addSystemLog(`Gaya tampilan harga diubah ke: ${newStyle}`, 'info');
  }


  function handleWorkspaceModeChange(mode: WorkspaceMode) {
    workspaceMode = mode;
    addSystemLog(`Workspace beralih ke mode: ${mode === 'terminal' ? 'Trading Terminal' : 'Pine Script IDE'}`, 'info');
    scheduleResizeDispatch(40);
  }

  function handleStartResizePinePanel(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    activePineResizeSession?.cancel();
    activePineResizeSession = startEdgeResizeSession({
      startClientX: e.clientX,
      startWidth: pinePanelWidth,
      minWidth: 340,
      maxCap: 850,
      viewportMaxRatio: 0.65,
      edge: 'left-edge',
      preferenceKey: 'pine_panel_width',
      onResize: (nextWidth) => {
        pinePanelWidth = nextWidth;
      },
      onEnd: () => {
        activePineResizeSession = null;
      }
    });
  }

  function handlePineResizerKeyDown(e: KeyboardEvent) {
    const nextWidth = adjustPanelWidthByKeyboard(
      e.key,
      e.shiftKey,
      pinePanelWidth,
      340,
      850,
      'left-edge',
      0.65
    );
    if (nextWidth === null) return;
    e.preventDefault();
    pinePanelWidth = nextWidth;
    void storage.setUiPreference('pine_panel_width', nextWidth).catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('resize'));
    }
  }

  function handleUpdateSettings(newSettings: Partial<AppSettings>) {
    const nextSettings: AppSettings = { ...appSettings, ...newSettings };
    if ('customPalette' in newSettings && !newSettings.customPalette) {
      nextSettings.customPalette = undefined;
    }
    appSettings = nextSettings;
    if (newSettings.syncConfig !== undefined) {
      syncConfig = { ...newSettings.syncConfig };
    }
    if (newSettings.autoSaveWorkspace !== undefined) {
      isAutoSaveWorkspace = newSettings.autoSaveWorkspace;
    }
    if (newSettings.defaultTimeframe !== undefined) {
      activeTimeframe = newSettings.defaultTimeframe;
    }
    if (newSettings.soundEnabled !== undefined) {
      alertService.setSoundEnabled(newSettings.soundEnabled);
    }
    if (newSettings.systemNotificationEnabled !== undefined) {
      alertService.setSystemNotificationEnabled(newSettings.systemNotificationEnabled);
    }
    if (
      newSettings.systemNotificationEnabled !== undefined ||
      newSettings.telegramNotificationEnabled !== undefined ||
      newSettings.telegramBotToken !== undefined ||
      newSettings.telegramChatId !== undefined ||
      newSettings.discordNotificationEnabled !== undefined ||
      newSettings.discordWebhookUrl !== undefined
    ) {
      alertService.setNotificationChannelsConfig(extractNotificationChannelsConfig(nextSettings));
    }
    persistAppSettings();
    addSystemLog(`Pengaturan aplikasi diperbarui.`, 'info');
  }

  function handleVelaThemeSelect(_mode: 'dark' | 'light') {
    // Otoritas Tunggal Tema Trawangan: Preferensi pengguna di Trawangan adalah nomor satu.
    // Event internal Vela tidak diizinkan lagi menimpa mode warna atau mereset customPalette.
  }

  function handleToggleVolumeVisibility() {
    const next = !(appSettings.showVolume ?? true);
    handleUpdateSettings({ showVolume: next });
  }

  function handleWatchlistChange(newSymbols: string[]) {
    watchlistSymbols = newSymbols;
  }

  // Helper terpadu untuk menyimpan toggle watchlist aktif dan mencatat log tanpa mengubah status dock kanan (#166)
  async function commitWatchlistToggle(symbol: string, providerId?: string) {
    const res = toggleSymbolInWatchlist(watchlistSymbols, symbol, providerId);
    if (!res.entry) return;
    handleWatchlistChange(res.items);
    await watchlistRegistry.updateActiveItems(res.items);
    addSystemLog(
      res.added
        ? `Simbol ${res.entry} ditambahkan ke watchlist aktif.`
        : `Simbol ${res.entry} dihapus dari watchlist aktif.`,
      res.added ? 'success' : 'info'
    );
  }

  // Toggle cepat simbol & bursa aktif dari tombol Bintang Header tanpa mengubah status buka/tutup dock kanan (#166)
  async function handleToggleActiveWatchlist() {
    await commitWatchlistToggle(activeSymbol, activeProviderId);
  }

  async function handleToggleWatchlistSymbolFromSearch(rawInput: string) {
    const providerHint = rawInput.includes(':') ? undefined : activeProviderId;
    await commitWatchlistToggle(rawInput, providerHint);
  }

  async function handleProviderChange(newProviderId: string) {
    await flushDrawingsWithLog('sebelum beralih provider');
    activeProviderId = newProviderId;
    marketFeed.setActiveProvider(newProviderId);
    telemetryService.setActiveProvider(newProviderId);
    addSystemLog(`Data provider beralih ke: ${newProviderId.toUpperCase()}`, 'success');
  }

  function buildCurrentWorkspacePayload(name: string, id?: string) {
    return buildWorkspaceSnapshotPayload({
      id,
      name,
      symbol: activeSymbol,
      timeframe: activeTimeframe,
      layout: currentLayout,
      providerId: activeProviderId,
      showVolume: appSettings.showVolume ?? true,
      syncConfig: { ...syncConfig },
      chart: sessionController,
      plan: chartDrawingController,
      fallbackIndicators: activeIndicators,
      activeRightDockPanel: shellState.isRightDockOpen ? shellState.activeRightDockTab : null,
    });
  }

  const workspaceCoordinator = new WorkspaceAutoSaveCoordinator({
    debounceMs: 1500,
    onSave: async (input) => {
      if (!isAutoSaveWorkspace || isLoadingWorkspace || !activeWorkspace) return;
      const saved = await saveWorkspace(input as any);
      activeWorkspace = saved;
      if (saved?.id) {
        await setLastActiveWorkspaceId(saved.id);
        if (!isClosingApp) {
          clearPendingWorkspaceBackup(saved.id);
        }
      }
      return saved;
    },
    onError: (err) => {
      console.warn('Auto-save workspace gagal:', err);
      addSystemLog(
        `Auto-save workspace gagal: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    },
  });

  async function handleSaveWorkspace(name: string, overwriteId?: string): Promise<boolean> {
    workspaceCoordinator.cancel();
    const prevWsId = activeWorkspace?.id || 'default_workspace';
    await flushDrawingsWithLog(`sebelum menyimpan workspace "${name}"`);

    const targetId =
      overwriteId ||
      (activeWorkspace?.name.trim().toLowerCase() === name.trim().toLowerCase()
        ? activeWorkspace.id
        : undefined);

    try {
      const payload = buildCurrentWorkspacePayload(name, targetId);
      const saved = await saveWorkspace(payload as any);

      // Klon seluruh drawing dari workspace sumber (misal default_workspace) SEBELUM activeWorkspace berubah
      if (saved?.id && prevWsId !== saved.id) {
        try {
          await cloneWorkspaceDrawings(prevWsId, saved.id);
        } catch (err) {
          console.warn('[SaveWorkspace] Gagal menyalin drawings saat Save As:', err);
          addSystemLog(
            `Workspace "${name}" tersimpan, tetapi gagal menyalin gambar: ${err instanceof Error ? err.message : String(err)}`,
            'warn'
          );
        }
      }

      activeWorkspace = saved;
      if (saved?.id) {
        await setLastActiveWorkspaceId(saved.id);
        clearPendingWorkspaceBackup(saved.id);
      }
      workspaceCoordinator.setSavedFingerprint(
        computeWorkspaceFingerprint({ ...payload, id: saved?.id || payload.id })
      );
      addSystemLog(`Workspace "${name}" disimpan`, 'success');
      return true;
    } catch (err) {
      console.warn('[SaveWorkspace] Gagal menyimpan workspace:', err);
      addSystemLog(
        `Gagal menyimpan workspace "${name}": ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
      return false;
    }
  }

  async function handleNewWorkspace() {
    workspaceCoordinator.cancel();
    workspaceCoordinator.setSavedFingerprint('');
    await flushDrawingsWithLog('sebelum membuat workspace baru');
    activeWorkspace = null;
    try {
      await setLastActiveWorkspaceId(null);
    } catch (err) {
      addSystemLog(
        `Gagal membersihkan referensi workspace aktif terakhir: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
    chartDrawingController.setWorkspaceId('default_workspace');
    chartDrawingController.clearCanvasVisuals();
    chartDrawingController.clearAllPlans();
    activePriceStyle = 'candles';
    addSystemLog('Workspace aktif dilepas. Siap menyetel tata letak atau indikator untuk workspace baru.', 'info');
  }

  async function handleLoadWorkspace(w: SavedWorkspace) {
    workspaceCoordinator.cancel();
    await flushDrawingsWithLog(`sebelum memuat workspace "${w.name}"`);
    isLoadingWorkspace = true;
    try {
      activeWorkspace = w;
      if (w?.priceStyle) {
        activePriceStyle = w.priceStyle;
      }
      if (w && w.id) {
        await setLastActiveWorkspaceId(w.id);
        clearPendingWorkspaceBackup(w.id);
      }

      if (!sessionController) {
        addSystemLog('ChartSessionController belum siap untuk memuat workspace.', 'warn');
        return;
      }

      // Jalankan pipeline restorasi workspace melalui deep workspaceLifecycle engine
      const res = await executeWorkspaceLoadPipeline({
        workspace: w,
        chart: sessionController,
        plan: chartDrawingController,
        shell: workspaceShellService,
        activeProviderId,
        onProviderChange: async (pId) => {
          if (w.providerId) await handleProviderChange(pId || w.providerId);
        },
        onSymbolChange: async (sym) => {
          await handleSymbolChange(sym || w.symbol, w.providerId);
        },
        onTimeframeChange: (tf) => handleTimeframeChange(tf),
        onLayoutChange: (l) => handleLayoutChange(l),
        onSyncConfigChange: (cfg) => { syncConfig = { ...DEFAULT_SYNC_CONFIG, ...cfg }; },
        onShowVolumeChange: (vol) => handleUpdateSettings({ showVolume: vol }),
        onSyncIndicators: () => syncActiveIndicators(),
        onLog: (msg, lvl) => addSystemLog(msg, (lvl as any) || 'info'),
      });

      workspaceCoordinator.setSavedFingerprint(res.fingerprint);
    } catch (e) {
      console.warn('Gagal memuat workspace:', e);
      addSystemLog(`Gagal memuat workspace: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      isLoadingWorkspace = false;
    }
  }

  function handleToggleAutoSaveWorkspace() {
    isAutoSaveWorkspace = !isAutoSaveWorkspace;
    appSettings.autoSaveWorkspace = isAutoSaveWorkspace;
    persistAppSettings();
    addSystemLog(`Auto-save workspace: ${isAutoSaveWorkspace ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function triggerWorkspaceAutoSave() {
    // KUNCI PENTING: Hanya jalankan auto-save jika ada activeWorkspace yang sedang dimuat!
    // Jika activeWorkspace === null (sedang membuat workspace baru/lepas), jangan auto-save untuk mencegah tabrakan/overwrite!
    if (!isAutoSaveWorkspace || !isPageMounted || isLoadingWorkspace || !sessionController || !activeWorkspace) return;
    const wsName = activeWorkspace.name;
    const wsId = activeWorkspace.id;
    // Tunda pembangunan payload lengkap + fingerprint sampai debounce flush dieksekusi
    workspaceCoordinator.triggerDeferred(() => buildCurrentWorkspacePayload(wsName, wsId));
  }

  // Pantau perubahan parameter UI & sinyal chartDirtyTick untuk auto-save workspace ber-debounce
  $effect(() => {
    void [
      activeSymbol,
      activeTimeframe,
      currentLayout,
      activeIndicators,
      syncConfig,
      currentActivePlans,
      showThesisCards,
      activeProviderId,
      shellState.isRightDockOpen,
      shellState.activeRightDockTab,
      appSettings.showVolume,
      snapMode,
      stayMode,
      currentThesisCardGeometries,
      chartDirtyTick,
    ];
    if (isPageMounted && !isLoadingWorkspace) {
      triggerWorkspaceAutoSave();
    }
  });

  // ─── Drawing Tools Handlers (Didelegasikan ke Deep chartDrawingController) ───
  function handleSelectTool(tool: DrawingToolType | null) {
    chartDrawingController.setTool(tool);
  }

  function handleToggleSnap() {
    chartDrawingController.cycleSnapMode();
  }

  function handleToggleStay() {
    chartDrawingController.toggleStayMode();
  }

  function handleToggleLock() {
    chartDrawingController.toggleLock();
  }

  function handleToggleHide() {
    chartDrawingController.toggleHide();
  }

  function handleUndo() {
    chartDrawingController.undo();
  }

  function handleRedo() {
    chartDrawingController.redo();
  }

  async function handleClearDrawings() {
    await chartDrawingController.clearAll();
    addSystemLog('Seluruh objek gambar di grafik dibersihkan.', 'info');
  }

  function handleClearIndicators() {
    sessionController?.clearAllIndicators();
    activeIndicators = [];
    addSystemLog('Seluruh indikator teknikal di grafik dibersihkan.', 'info');
  }

  async function handleClearAll() {
    await chartDrawingController.clearAll();
    sessionController?.clearAllIndicators();
    activeIndicators = [];
    addSystemLog('Seluruh objek gambar dan indikator di grafik dibersihkan.', 'warn');
  }

  function handleClear() {
    handleClearDrawings();
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

  // ─── Indicators & Pine Script Handlers ───
  async function handleAddIndicator(code: string, title: string): Promise<boolean> {
    if (sessionController) {
      const ok = await sessionController.addPineIndicator(code, title);
      if (ok) {
        syncActiveIndicators();
        addSystemLog(`Indikator "${title}" berhasil diterapkan ke grafik.`, 'success');
      }
      return ok;
    }
    return false;
  }

  async function handleAddNativeIndicator(type: string, title?: string): Promise<boolean> {
    if (sessionController) {
      const ok = await sessionController.addNativeIndicator(type, undefined, title);
      if (ok) {
        syncActiveIndicators();
        addSystemLog(`Indikator native "${title || type}" berhasil diterapkan ke grafik.`, 'success');
      }
      return ok;
    }
    return false;
  }

  async function handleApplyIndicator(descriptor: any): Promise<boolean> {
    if (sessionController) {
      const ok = await sessionController.addIndicator(descriptor);
      if (ok) {
        syncActiveIndicators();
        addSystemLog(`Indikator "${descriptor?.title || 'Indicator'}" berhasil diterapkan ke grafik.`, 'success');
      }
      return ok;
    }
    return false;
  }

  function syncActiveIndicators() {
    if (sessionController) {
      activeIndicators = sessionController.getActiveIndicators();
    }
  }

  function handleRemoveIndicator(id: string) {
    sessionController?.removeIndicator(id);
    activeIndicators = activeIndicators.filter(i => i.id !== id);
    syncActiveIndicators();
    addSystemLog(`Indikator dihapus: ${id}`, 'info');
  }

  function handleToggleIndicatorVisibility(id: string) {
    sessionController?.toggleIndicatorVisibility(id);
    syncActiveIndicators();
  }

  function handleOpenInEditor(code: string, title: string, id?: string) {
    editorInitialCode = code;
    editorInitialTitle = title;
    workspaceMode = 'pine';
    schedulePageTimeout(() => {
      pineEditorComponent?.loadScript(code, title, id);
      window.dispatchEvent(new Event('resize'));
    }, 40);
    addSystemLog(`Membuka "${title}" di Pine Script IDE.`, 'info');
  }

  function handleOpenIndicatorInPine(id: string, source?: string) {
    const found = activeIndicators.find((i) => i.id === id);
    const code = source || found?.source || '// Kode indikator tidak tersedia';
    const title = found?.title || 'Indicator.pine';
    handleOpenInEditor(code, title, id);
  }

  // Dynamic Typed Settings Modal State
  let isIndicatorSettingsOpen = $state(false);
  let configuringIndicator = $state<{
    id: string;
    title: string;
    nativeType?: string;
    schema?: any[];
    inputs?: Record<string, any>;
  } | null>(null);

  function handleConfigureIndicator(id: string) {
    if (!id) return;
    const found = activeIndicators.find((i) => i.id === id);
    const title = found?.title || id;
    const nativeType = id.startsWith('native:') ? id.replace(/^native:/, '') : (found?.source || id);

    let schema: any[] = [];
    let currentInputs: Record<string, any> = {};

    if (sessionController) {
      schema = sessionController.getIndicatorInputSchema(id);
      currentInputs = sessionController.getIndicatorInputs(id);
    }

    configuringIndicator = {
      id,
      title,
      nativeType,
      schema,
      inputs: { ...(found?.inputs || {}), ...currentInputs },
    };
    isIndicatorSettingsOpen = true;
  }

  function addSystemLog(msg: string, level: 'info' | 'success' | 'warn' | 'error') {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    systemLogs = [...systemLogs.slice(-60), { time, msg, level }];
  }

  // ─── Layanan Tangkapan Layar Grafik (Offline Branded Snapshot) (#94) ───
  function getActiveSnapshotMetadata(scope: 'active' | 'all' = 'active'): SnapshotMetadata {
    if (scope === 'all') {
      const layoutLabel = currentLayout === '2v' ? '2-SPLIT VERTICAL'
        : currentLayout === '2h' ? '2-SPLIT HORIZONTAL'
        : currentLayout === '4' ? '4-GRID'
        : `LAYOUT ${currentLayout.toUpperCase()}`;

      return {
        symbol: 'MULTI-CHART GRID',
        timeframe: layoutLabel,
        providerId: activeProviderId || 'binance',
        lastPrice: null,
        timezone: appSettings.timezone || 'Asia/Jakarta',
        timestamp: Date.now(),
        layout: currentLayout,
        scope: 'all',
      };
    }

    return {
      symbol: activeSymbol,
      timeframe: activeTimeframe,
      providerId: activeProviderId || 'binance',
      lastPrice: ticker?.price ?? null,
      timezone: appSettings.timezone || 'Asia/Jakarta',
      timestamp: Date.now(),
      layout: currentLayout,
      scope: 'active',
    };
  }

  /**
   * Merangkum opsi snapshot lengkap untuk aksi cepat (quick copy & quick download) (#124, #125, #126, #127, #128)
   */
  function getQuickSnapshotOptions(scope: 'active' | 'all' = 'active'): SnapshotOptions {
    const activeTheme = resolveThemeConfig(effectiveChartThemePreset, appSettings.savedUserThemes);
    const backgroundColor = activeTheme?.chart?.background || activeTheme?.tokens?.bgDarkest || '#0F0F0F';
    const metadata = getActiveSnapshotMetadata(scope);
    const scaleMultiplier = appSettings.snapshotScaleMultiplier ?? 2;
    const thesisLayout = appSettings.snapshotThesisLayout ?? 'side-panel';
    const activePlans = showThesisCards ? (currentActivePlans || []) : [];
    const activePlan = activePlans.length > 0 ? activePlans[0] : null;

    return {
      mode: (appSettings.snapshotIncludeFrame ?? true) ? 'branded' : 'clean',
      scaleMultiplier,
      backgroundColor,
      customBackground: appSettings.customChartBackground,
      includePrice: appSettings.snapshotIncludePrice ?? true,
      includeTimestamp: appSettings.snapshotIncludeTimestamp ?? true,
      metadata,
      userProfile: appSettings.userProfile,
      watermark: appSettings.securityWatermark,
      thesisLayout,
      activePlans,
      tradingPlan: activePlan,
      themeConfig: activeTheme,
    };
  }

  async function handleQuickCopySnapshot() {
    isSnapshotProcessing = true;
    try {
      const scope = appSettings.snapshotScope ?? 'active';
      const thesisLayout = appSettings.snapshotThesisLayout ?? 'side-panel';
      const canvas = chartView?.getChartScreenshotCanvas(scope, thesisLayout);
      if (!canvas) {
        snapshotToast = {
          visible: true,
          type: 'error',
          message: 'Kanvas grafik belum siap atau tidak ditemukan.',
          timestamp: Date.now(),
        };
        return;
      }

      const options = getQuickSnapshotOptions(scope);
      const composite = await captureSnapshot(canvas, options);
      const scaleMultiplier = options.scaleMultiplier ?? 2;

      const copyResult = await copySnapshotToClipboard(composite);
      const thumbUrl = createSnapshotThumbnail(composite);

      if (copyResult.success) {
        snapshotToast = {
          visible: true,
          type: 'copied',
          message: `Snapshot disalin ke clipboard! (PNG, ${scaleMultiplier}x)`,
          thumbnailUrl: thumbUrl,
          timestamp: Date.now(),
        };
        addSystemLog(`Snapshot ${options.metadata.symbol} disalin ke clipboard (PNG ${scaleMultiplier}x)`, 'success');
      } else {
        // Fallback jika Clipboard API diblokir oleh browser/OS: simpan ke berkas
        const filename = generateSnapshotFilename(options.metadata.symbol, options.metadata.timeframe, options.metadata.timestamp);
        const saveRes = await saveSnapshotToFile(composite, filename, appSettings.snapshotDirectory);
        notifySnapshotSaved(saveRes, filename, thumbUrl, true);
      }
    } catch (err: any) {
      console.error('[Snapshot] Gagal menyalin snapshot:', err);
      snapshotToast = {
        visible: true,
        type: 'error',
        message: err?.message || 'Gagal memproses snapshot grafik.',
        timestamp: Date.now(),
      };
    } finally {
      isSnapshotProcessing = false;
    }
  }

  function notifySnapshotSaved(
    saveRes: { isFallback?: boolean; filePath?: string },
    filename: string,
    thumbUrl?: string,
    isClipboardFallback = false
  ) {
    const isFallback = !!saveRes.isFallback;
    const target = saveRes.filePath || (isFallback ? `Downloads/${filename}` : filename);
    const toastMessage = isClipboardFallback
      ? 'Clipboard tidak diizinkan. Gambar otomatis disimpan ke berkas!'
      : (isFallback ? `Snapshot diunduh ke ${target}` : `Snapshot tersimpan di ${target}`);

    snapshotToast = {
      visible: true,
      type: 'saved',
      message: toastMessage,
      thumbnailUrl: thumbUrl,
      timestamp: Date.now(),
    };

    const logMessage = isClipboardFallback
      ? (isFallback
          ? `Clipboard diblokir. Snapshot dialihkan ke unduhan browser: ${target}`
          : `Clipboard diblokir. Snapshot disimpan di ${target}`)
      : (isFallback
          ? `Snapshot grafik dialihkan ke unduhan browser: ${target}`
          : `Snapshot grafik berhasil disimpan di: ${target}`);

    addSystemLog(logMessage, isClipboardFallback ? 'info' : 'success');
  }

  async function handleQuickDownloadSnapshot() {
    isSnapshotProcessing = true;
    try {
      const scope = appSettings.snapshotScope ?? 'active';
      const thesisLayout = appSettings.snapshotThesisLayout ?? 'side-panel';
      const canvas = chartView?.getChartScreenshotCanvas(scope, thesisLayout);
      if (!canvas) {
        snapshotToast = {
          visible: true,
          type: 'error',
          message: 'Kanvas grafik belum siap atau tidak ditemukan.',
          timestamp: Date.now(),
        };
        return;
      }

      const options = getQuickSnapshotOptions(scope);
      const composite = await captureSnapshot(canvas, options);

      const filename = generateSnapshotFilename(options.metadata.symbol, options.metadata.timeframe, options.metadata.timestamp);
      const saveRes = await saveSnapshotToFile(composite, filename, appSettings.snapshotDirectory);
      const thumbUrl = createSnapshotThumbnail(composite);
      notifySnapshotSaved(saveRes, filename, thumbUrl, false);
    } catch (err: any) {
      console.error('[Snapshot] Gagal mengunduh snapshot:', err);
      snapshotToast = {
        visible: true,
        type: 'error',
        message: err?.message || 'Gagal mengunduh snapshot grafik.',
        timestamp: Date.now(),
      };
    } finally {
      isSnapshotProcessing = false;
    }
  }

  function handleOpenSnapshotPreview() {
    isSnapshotPreviewOpen = true;
    addSystemLog('Membuka dialog pratinjau snapshot...', 'info');
  }
</script>

<div class="app-layout">
  <!-- Top Master Navigation & Titlebar -->
  <Header
    {activeSymbol}
    {activeTimeframe}
    {currentLayout}
    {activeProviderId}
    {syncConfig}
    {activeIndicators}
    isDrawingToolbarVisible={!shellState.isLeftRailCollapsed}
    isReplayActive={replaySnapshot.active}
    isWatchlisted={isActiveSymbolWatchlisted}
    onToggleActiveWatchlist={handleToggleActiveWatchlist}
    onTimeframeChange={handleTimeframeChange}
    onLayoutChange={handleLayoutChange}
    onProviderChange={handleProviderChange}
    {activeWorkspace}
    {isAutoSaveWorkspace}
    onToggleAutoSaveWorkspace={handleToggleAutoSaveWorkspace}
    onSaveWorkspace={handleSaveWorkspace}
    onLoadWorkspace={handleLoadWorkspace}
    onNewWorkspace={handleNewWorkspace}
    onLog={(msg, level) => addSystemLog(msg, level || 'info')}
    onToggleSyncCrosshair={handleToggleSyncCrosshair}
    onToggleSyncViewport={handleToggleSyncViewport}
    onToggleSyncSymbol={handleToggleSyncSymbol}
    onToggleSyncDrawings={handleToggleSyncDrawings}
    onToggleSyncIndicators={handleToggleSyncIndicators}
    onToggleSyncStyle={handleToggleSyncStyle}
    onToggleDrawingToolbar={() => workspaceShellService.toggleLeftRail()}
    onToggleReplay={handleToggleReplay}
    onOpenIndicatorModal={() => (isIndicatorModalOpen = true)}
    onOpenSettingsModal={(tab = 'general') => {
      settingsInitialTab = tab as any;
      isSettingsModalOpen = true;
    }}
    onOpenSymbolSearch={() => {
      symbolSearchInitialQuery = '';
      symbolSearchTriggerSource = 'explicit';
      isSymbolSearchOpen = true;
    }}
    favoriteTimeframes={appSettings.favoriteTimeframes}
    customTimeframes={appSettings.customTimeframes}
    onFavoriteTimeframesChange={(tfs) => handleUpdateSettings({ favoriteTimeframes: tfs })}
    onCustomTimeframesChange={(customs) => handleUpdateSettings({ customTimeframes: customs })}
    onRequestQuickCopySnapshot={handleQuickCopySnapshot}
    onRequestQuickDownloadSnapshot={handleQuickDownloadSnapshot}
    onOpenSnapshotPreview={handleOpenSnapshotPreview}
    snapshotScaleMultiplier={appSettings.snapshotScaleMultiplier ?? 2}
    onSnapshotScaleMultiplierChange={(multiplier) => handleUpdateSettings({ snapshotScaleMultiplier: multiplier })}
    {isSnapshotProcessing}
    colorModePreference={appSettings.colorModePreference ?? 'system'}
    {systemIsDark}
    onCycleColorMode={handleCycleColorMode}
    {activePriceStyle}
    onPriceStyleChange={handlePriceStyleChange}
    hollowCandles={appSettings.hollowCandles ?? false}
    onToggleHollowCandles={() => handleUpdateSettings({ hollowCandles: !appSettings.hollowCandles })}
    {chartTabs}
    {activeChartTabId}
    onSelectChartTab={handleSelectChartTab}
    onAddChartTab={handleAddChartTab}
    onCloseChartTab={handleCloseChartTab}
    onReorderChartTabs={(fromIdx, toIdx) => chartTabsService.reorderTabs(fromIdx, toIdx)}
    livePrice={ticker?.price ?? null}
    liveChange24h={ticker?.change24h ?? null}
    language={appSettings.language ?? 'jv'}
    onLanguageChange={(lang) => handleUpdateSettings({ language: lang })}
    onOpenStartupTutorial={() => (isStartupTutorialOpen = true)}
  />

  <!-- Main Viewport Area -->
  <main class="main-workspace {workspaceMode}">
    <!-- WORKSPACE UNIFIED VIEWPORT (Docked Structural Shell: Left Rail | Chart Canvas | Drawer Panel | Right Dock Rail) -->
    <div class="workspace-viewport mode-{workspaceMode}">
      {#if isPersistenceBootstrapped}
        <!-- 1. DOCKED LEFT RAIL: Drawing Toolbar (Lebar 44px struktural, zero overlap lilin) -->
      {#if workspaceMode === 'terminal'}
        <DrawingToolbar
          isCollapsed={shellState.isLeftRailCollapsed}
          onToggleCollapse={() => workspaceShellService.toggleLeftRail()}
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
          onClearDrawings={handleClearDrawings}
          onClearIndicators={handleClearIndicators}
          onClearAll={handleClearAll}
          onOpenGestureGuide={() => (isDrawByHoldingModalOpen = true)}
          {hasActivePlans}
          {showThesisCards}
          onToggleThesisCards={() => openRightPlanTab({ subMode: 'preview' })}
        />
      {/if}

      <!-- 2. FLUID CENTER: Chart Canvas Area (Mulai tepat di sebelah kanan toolbar kiri) -->
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
          bind:this={chartView}
          bind:sessionController={sessionController}
          symbol={activeSymbol}
          timeframe={activeTimeframe}
          defaultTimeframe={appSettings.defaultTimeframe || '15m'}
          layout={currentLayout}
          providerId={activeProviderId}
          workspaceId={activeWorkspace?.id || 'default_workspace'}
          gridMode={appSettings.gridMode || 'normal'}
          themePreset={effectiveChartThemePreset as any}
          customPalette={appSettings.syncChartWithAppTheme !== false ? appSettings.customPalette : undefined}
          customBullColor={appSettings.customBullColor}
          customBearColor={appSettings.customBearColor}
          customChartBackground={appSettings.customChartBackground}
          fontSize={appSettings.fontSize || 12}
          timezone={appSettings.timezone || 'Asia/Jakarta'}
          marketSession={appSettings.marketSession ?? 'regular'}
          {syncConfig}
          showWatermark={appSettings.showWatermark}
          showCurrentPriceLine={appSettings.showCurrentPriceLine ?? true}
          showPriceScaleCountdown={appSettings.showPriceScaleCountdown ?? false}
          showVolume={appSettings.showVolume ?? true}
          showIndicatorPriceLabels={appSettings.showIndicatorPriceLabels ?? true}
          showDrawingPriceLabels={appSettings.showDrawingPriceLabels ?? true}
          hollowCandles={appSettings.hollowCandles ?? false}
          mainPaneObjectsOpacity={appSettings.mainPaneObjectsOpacity ?? 1}
          showAlertLines={appSettings.showAlertLines ?? true}
          securityWatermark={appSettings.securityWatermark}
          userProfile={appSettings.userProfile}
          onActiveIndicatorsChange={(list) => (activeIndicators = list)}
          onActiveCellChange={handleActiveCellChange}
          onPriceStyleChange={(style) => (activePriceStyle = style)}
          onStrategyUpdate={handleStrategyUpdate}
          onRequestCreateAlert={handleRequestCreateAlert}
          onRequestEditAlert={(alert) => handleRequestCreateAlert(alert.symbol, alert.targetPrice, alert)}
          onOpenTradePlanPaste={(text) =>
            openRightPlanTab({
              subMode: text ? 'text' : 'form',
              initialText: text || ''
            })
          }
          onEditPlan={(planId) => openRightPlanTab({ subMode: 'form', planId })}
          onVelaThemeSelect={handleVelaThemeSelect}
          onSessionStateChange={(st) => {
            chartSessionState = st;
          }}
          onPersistableStateChange={() => (chartDirtyTick += 1)}
        />

        {#if replaySnapshot.active}
          <ReplayBar
            onClose={() => {
              replaySession.close();
              addSystemLog('Bar Replay ditutup. Kembali ke data pasar live.', 'info');
            }}
          />
        {/if}
      </div>

      <!-- 3. RIGHT DRAWER COLUMN: Side-by-side Pine Editor atau Drawer Watchlist -->
      {#if workspaceMode === 'pine'}
        <!-- Draggable Resizer Splitter -->
        <div
          class="side-panel-resizer"
          title="Tarik atau gunakan tombol Panah Kiri/Kanan untuk mengubah lebar Pine IDE"
          role="slider"
          aria-orientation="vertical"
          aria-label="Ubah lebar panel Pine IDE"
          aria-valuemin={340}
          aria-valuemax={850}
          aria-valuenow={pinePanelWidth}
          tabindex="0"
          onpointerdown={handleStartResizePinePanel}
          onkeydown={handlePineResizerKeyDown}
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
            themePreset={(effectiveThemePreset as ThemePresetId) || 'signature'}
            customPalette={appSettings.customPalette}
            onClose={() => handleWorkspaceModeChange('terminal')}
            onAddToChart={handleAddIndicator}
            onStrategyUpdate={handleStrategyUpdate}
          />
        </div>
      {:else if shellState.isRightDockOpen}
        <WatchlistPanel
          isOpen={shellState.isRightDockOpen}
          activeTab={shellState.activeRightDockTab || shellState.lastOpenedRightDockTab}
          {activeSymbol}
          {activeProviderId}
          timezone={appSettings.timezone}
          {watchlistSymbols}
          {activeIndicators}
          {activeDrawings}
          {selectedDrawingId}
          showVolume={appSettings.showVolume ?? true}
          onToggleVolumeVisibility={handleToggleVolumeVisibility}
          showAlertLines={appSettings.showAlertLines ?? true}
          onToggleAlertLines={() => handleUpdateSettings({ showAlertLines: appSettings.showAlertLines === false })}
          onSelectSymbol={handleSymbolChange}
          onWatchlistChange={handleWatchlistChange}
          onToggleIndicatorVisibility={handleToggleIndicatorVisibility}
          onRemoveIndicator={handleRemoveIndicator}
          onConfigureIndicator={handleConfigureIndicator}
          onOpenIndicatorInPine={handleOpenIndicatorInPine}
          onToggleDrawingVisibility={(id) => chartDrawingController.toggleDrawingVisibility(id)}
          onToggleDrawingLock={(id) => chartDrawingController.toggleDrawingLock(id)}
          onRemoveDrawing={(id) => chartDrawingController.deleteDrawing(id)}
          onSelectDrawing={(id) => chartDrawingController.selectDrawing(id)}
          onBulkHideDrawings={(hidden) => chartDrawingController.bulkHideDrawings(hidden)}
          onBulkLockDrawings={(locked) => chartDrawingController.bulkLockDrawings(locked)}
          onBulkDeleteDrawings={() => chartDrawingController.bulkDeleteDrawings()}
          activePlans={currentActivePlans}
          {showThesisCards}
          onToggleThesisCards={() => chartDrawingController.toggleThesisCardsVisible()}
          onRemovePlan={(id) => chartDrawingController.removePlan(id)}
          currentPrice={ticker?.price ?? null}
          tickSize={ticker?.price ? getAdaptiveTickSize(ticker.price, undefined, activeSymbol) : undefined}
          {planActivationRequest}
          onConsumePlanActivation={handleConsumePlanActivation}
          onApplyPlan={handleApplyPlanFromTab}
          onUpdatePlan={handleUpdatePlanFromTab}
          onEditPlan={(planId) => openRightPlanTab({ subMode: 'form', planId })}
          onOpenPlanTab={(subMode = 'preview') => openRightPlanTab({ subMode })}
          onFocusEventTimestamp={(ts) => chartView?.focusTimestamp?.(ts)}
          activeBrokerId={appSettings.activeBrokerId ?? 'binance'}
          onSelectBroker={(bId) => handleUpdateSettings({ activeBrokerId: bId })}
          onOpenBrokerSettings={() => {
            settingsInitialTab = 'broker';
            isSettingsModalOpen = true;
          }}
          onLog={(msg, level) => addSystemLog(msg, level || 'info')}
          onRequestCreateAlert={() => handleRequestCreateAlert(activeSymbol)}
          onRequestEditAlert={(alert) => handleRequestCreateAlert(alert.symbol, alert.targetPrice, alert)}
        />
      {/if}

      <!-- 4. PERMANENT RIGHT DOCK RAIL: Ikon Vertikal 38px selalu hadir di tepi kanan -->
      <RightDockRail
        isOpen={shellState.isRightDockOpen}
        activeTab={shellState.activeRightDockTab}
        {workspaceMode}
        activeAlertsCount={allAlerts.filter((a) => a.active && !a.triggered).length}
        activeIndicatorsCount={activeIndicators.length}
        activePlansCount={currentActivePlans.filter((p) => !p.symbol || isSameSymbol(p.symbol, activeSymbol)).length}
        showOrderTab={Boolean(appSettings.executionBridgeEnabled)}
        onToggleTab={(tab) => {
          if (workspaceMode === 'pine') {
            handleWorkspaceModeChange('terminal');
          }
          if (tab === 'plan') {
            planActivationRequest = null;
          }
          workspaceShellService.toggleRightDockTab(tab);
        }}
        onToggleHider={() => {
          if (workspaceMode === 'pine') {
            handleWorkspaceModeChange('terminal');
          } else {
            workspaceShellService.toggleRightDockHider();
          }
        }}
        onTogglePineMode={() => {
          handleWorkspaceModeChange(workspaceMode === 'pine' ? 'terminal' : 'pine');
        }}
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
    settings={appSettings}
    session={chartSessionState.session}
    sessionAvailable={chartSessionState.sessionAvailable}
    {marketSessionsFooterHidden}
    onHideMarketSessionsFooter={() => {
      marketSessionsFooterHidden = true;
    }}
    onOpenEventsTab={() => workspaceShellService.openRightDockTab('events')}
    onSelectTimezone={(tz) => handleUpdateSettings({ timezone: tz })}
    onToggleSession={() => {
      const next = sessionController?.toggleSession() ?? ((appSettings.marketSession ?? 'regular') === 'regular' ? 'extended' : 'regular');
      handleUpdateSettings({ marketSession: next });
    }}
    onToggleConsole={() => (isConsoleDrawerOpen = !isConsoleDrawerOpen)}
    onOpenAbout={() => {
      settingsInitialTab = 'about';
      isSettingsModalOpen = true;
    }}
  />

  <!-- Preferences & Settings Modal (Clean Screen Policy) -->
  <SettingsModal
    isOpen={isSettingsModalOpen}
    settings={appSettings}
    {activeProviderId}
    initialTab={settingsInitialTab}
    sessionState={chartSessionState}
    onSetSession={(mode) => {
      sessionController?.setSession(mode);
      handleUpdateSettings({ marketSession: mode });
    }}
    onClose={() => {
      isSettingsModalOpen = false;
      marketSessionsFooterHidden = readMarketSessionsFooterHidden(storage);
    }}
    onUpdateSettings={handleUpdateSettings}
    onProviderChange={handleProviderChange}
    onOpenChartSettings={(sec?: string) => chartView?.openChartSettings(sec)}
    onSaveChartAsDefault={() => sessionController?.saveCurrentSettingsAsDefault() ?? false}
    onResetChartFactory={() => sessionController?.resetSettingsToFactory()}
    onOpenGestureGuide={() => (isDrawByHoldingModalOpen = true)}
    onReplayTutorial={() => (isStartupTutorialOpen = true)}
  />

  <!-- Symbol Search Modal (Global via Header / Ctrl+K / Watchlist) -->
  <SymbolSearchModal
    isOpen={isSymbolSearchOpen}
    activeSymbol={activeSymbol}
    {activeProviderId}
    {watchlistSymbols}
    initialQuery={symbolSearchInitialQuery}
    triggerSource={symbolSearchTriggerSource}
    onSelectSymbol={handleSymbolChange}
    onToggleWatchlistSymbol={handleToggleWatchlistSymbolFromSearch}
    onClose={() => {
      isSymbolSearchOpen = false;
      symbolSearchInitialQuery = '';
      symbolSearchTriggerSource = 'explicit';
    }}
  />

  <!-- Timeframe Quick Input Bar (Pill Melayang saat mengetik angka di kanvas) -->
  <TimeframeQuickBar
    isOpen={isTimeframeQuickBarOpen}
    initialInput={timeframeQuickBarInitialInput}
    currentTimeframe={activeTimeframe}
    onApply={(newTf) => {
      handleTimeframeChange(newTf as Timeframe);
      sessionController?.setTimeframe(newTf as Timeframe);
    }}
    onClose={() => {
      isTimeframeQuickBarOpen = false;
      timeframeQuickBarInitialInput = '';
    }}
  />


  <!-- Indicator Library Modal -->
  <IndicatorModal
    isOpen={isIndicatorModalOpen}
    onClose={() => (isIndicatorModalOpen = false)}
    onSelectIndicator={handleAddIndicator}
    onSelectNativeIndicator={handleAddNativeIndicator}
    onApplyIndicator={handleApplyIndicator}
    onOpenInEditor={handleOpenInEditor}
  />

  <!-- Dynamic Native & Pine Indicator Settings Dialog -->
  {#if isIndicatorSettingsOpen && configuringIndicator}
    <IndicatorSettingsModal
      isOpen={isIndicatorSettingsOpen}
      indicatorId={configuringIndicator.id}
      indicatorTitle={configuringIndicator.title}
      nativeType={configuringIndicator.nativeType}
      schema={configuringIndicator.schema}
      inputs={configuringIndicator.inputs}
      themePreset={effectiveChartThemePreset as any}
      customPalette={appSettings.syncChartWithAppTheme !== false ? appSettings.customPalette : undefined}
      customCandleColors={{ bullColor: appSettings.customBullColor, bearColor: appSettings.customBearColor }}
      onClose={() => {
        isIndicatorSettingsOpen = false;
        configuringIndicator = null;
      }}
      onChange={(draft) => {
        if (sessionController && configuringIndicator) {
          sessionController.updateIndicatorInputs(configuringIndicator.id, draft);
        }
      }}
      onRevert={(prev) => {
        if (sessionController && configuringIndicator) {
          sessionController.updateIndicatorInputs(configuringIndicator.id, prev);
        }
      }}
      onApply={(finalInputs) => {
        if (sessionController && configuringIndicator) {
          sessionController.updateIndicatorInputs(configuringIndicator.id, finalInputs);
        }
        addSystemLog(`Pengaturan parameter indikator "${configuringIndicator?.title}" diperbarui.`, 'info');
      }}
    />
  {/if}

  <!-- Create & Edit Price Alert Modal -->
  <CreateAlertModal
    isOpen={isCreateAlertModalOpen}
    chartSymbol={activeSymbol}
    chartTickSize={ticker?.price ? getAdaptiveTickSize(ticker.price, undefined, activeSymbol) : undefined}
    initialSymbol={createAlertSymbol}
    initialPrice={createAlertTargetPrice}
    editingAlert={editingAlert}
    currentMarketPrice={ticker?.price || 0}
    availableSymbols={watchlistSymbols}
    onClose={() => {
      isCreateAlertModalOpen = false;
      editingAlert = null;
    }}
    onCreated={(newAlert: any) => {
      const targetSym = newAlert.symbol || activeSymbol;
      const priceStr = formatPriceWithQuoteSymbol(
        newAlert.targetPrice,
        parseAdaptiveSymbol(targetSym).quoteAsset,
        targetSym
      );
      addSystemLog(`Price Alert dibuat: ${newAlert.symbol} @ ${priceStr}`, 'success');
    }}
    onUpdated={(upAlert: any) => {
      const targetSym = upAlert.symbol || activeSymbol;
      const priceStr = formatPriceWithQuoteSymbol(
        upAlert.targetPrice,
        parseAdaptiveSymbol(targetSym).quoteAsset,
        targetSym
      );
      addSystemLog(`Price Alert diperbarui: ${upAlert.symbol} @ ${priceStr}`, 'success');
    }}
  />

  <!-- Alert Triggered Floating Toasts -->
  <AlertNotificationToast
    alerts={triggeredAlertsToasts}
    onSelectSymbol={handleSymbolChange}
    onDismiss={handleDismissAlertToast}
  />

  <!-- Snapshot Quick Toast Feedback (#94) -->
  <SnapshotToast
    toast={snapshotToast}
    onDismiss={() => { snapshotToast = null; }}
    onQuickDownload={handleQuickDownloadSnapshot}
    onOpenPreview={handleOpenSnapshotPreview}
  />

  <!-- Interactive Snapshot Preview Modal (#95, #135) -->
  <SnapshotPreviewModal
    isOpen={isSnapshotPreviewOpen}
    {activeSymbol}
    {activeTimeframe}
    {activeProviderId}
    currentPrice={ticker?.price || null}
    {currentLayout}
    {appSettings}
    activePlans={currentActivePlans}
    {showThesisCards}
    getScreenshotCanvas={(scope, thesisLayout) => chartView?.getChartScreenshotCanvas(scope, thesisLayout) || null}
    onUpdateSettings={handleUpdateSettings}
    onClose={() => { isSnapshotPreviewOpen = false; }}
    onLog={(msg, type) => addSystemLog(msg, type || 'info')}
  />

  <!-- Kamus Glosarium Keyboard Shortcuts Modal (? / F1) -->
  <ShortcutCheatsheetModal
    isOpen={isShortcutCheatsheetOpen}
    onClose={() => (isShortcutCheatsheetOpen = false)}
    onOpenGestureGuide={() => (isDrawByHoldingModalOpen = true)}
  />

  <!-- Modal Panduan Visual Draw by Holding (Tiket #107) -->
  <DrawByHoldingModal
    isOpen={isDrawByHoldingModalOpen}
    onClose={() => (isDrawByHoldingModalOpen = false)}
  />

  <!-- Interactive First-Run Startup Spotlight Tour (ADR-0032) -->
  <StartupTutorialModal
    isOpen={isStartupTutorialOpen}
    settings={appSettings}
    onUpdateSettings={handleUpdateSettings}
    onComplete={() => (isStartupTutorialOpen = false)}
    onOpenBrokerSettings={() => {
      settingsInitialTab = 'broker';
      isSettingsModalOpen = true;
    }}
  />
</div>

<style>
  .app-layout {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px;
    background-color: var(--bg-shell, #08080A);
    color: var(--text-main);
    overflow: hidden;
    position: relative;
    font-family: var(--font-sans);
  }

  .main-workspace {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  /* WORKSPACE UNIFIED VIEWPORT STYLING */
  .workspace-viewport {
    display: flex;
    flex-direction: row;
    flex: 1;
    gap: 2px;
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
    width: 4px;
    height: 100%;
    background-color: var(--bg-shell, #08080A);
    border: none;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    z-index: 25;
    transition: background-color 0.15s ease;
  }

  .side-panel-resizer:hover,
  .side-panel-resizer:active,
  .side-panel-resizer:focus-visible {
    background-color: var(--brand-cyan);
    outline: none;
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

  .log-row.error .log-text {
    color: #ef4444;
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
