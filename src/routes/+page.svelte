<script lang="ts">
  import { onMount, onDestroy, untrack, tick } from 'svelte';
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
  import TimeframeQuickBar from '../lib/components/TimeframeQuickBar.svelte';
  import CreateAlertModal from '../lib/components/CreateAlertModal.svelte';
  import AlertNotificationToast from '../lib/components/AlertNotificationToast.svelte';
  import SnapshotToast, { type SnapshotToastData } from '../lib/components/SnapshotToast.svelte';
  import SnapshotPreviewModal from '../lib/components/SnapshotPreviewModal.svelte';
  import RightDockRail from '../lib/components/RightDockRail.svelte';
  import ShortcutCheatsheetModal from '../lib/components/ShortcutCheatsheetModal.svelte';
  import DrawByHoldingModal from '../lib/components/DrawByHoldingModal.svelte';
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
  import { ensureNotificationPermission } from '../lib/services/systemNotificationService';
  import { marketFeed } from '../lib/services/market';
  import { telemetryService } from '../lib/services/telemetryService';
  import { replaySession, type ReplaySnapshot } from '../lib/services/replay';
  import { commandDispatcher } from '../lib/services/commandDispatcher';
  import { chartDrawingController, isSameSymbol } from '../lib/services/chartDrawingController';
  import { routeVenueForSymbol } from '../lib/services/instrumentIdentity';
  import {
    executeWorkspaceLoadPipeline,
    WorkspaceAutoSaveCoordinator,
    buildWorkspaceSnapshotPayload,
    executeExitFlush,
    handleWindowCloseRequest,
    resolvePendingWorkspaceOverride,
    clearPendingWorkspaceBackup,
  } from '../lib/services/workspaceLifecycle';
  import { parseWatchlistEntry, formatWatchlistEntry, insertSymbolIntoSection, isSectionToken } from '../lib/services/watchlistUtils';
  import { watchlistRegistry } from '../lib/services/watchlistRegistryService';
  import {
    parseExternalChartUrl,
    resolveChartTargetWithFallback,
    normalizeSymbolAndContract,
    type ParsedChartTarget
  } from '../lib/services/urlInterceptorService';
  import { ClipboardWatcherService } from '../lib/services/clipboardWatcherService';
  import { Link2 } from '@lucide/svelte';
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
    loadWorkspaces,
    cloneWorkspaceDrawings,
    getLastActiveWorkspaceId,
    setLastActiveWorkspaceId,
    computeWorkspaceFingerprint,
    DEFAULT_QUICK_SYMBOLS_CONFIG,
    flushDrawings
  } from '../lib/services/persistence';
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

  import { Terminal, X, TrendingUp, Sparkles, Layers } from '@lucide/svelte';
  import { updateService } from '../lib/services/updateService';

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
  let planActivationRequest = $state<TradePlanActivationRequest | null>(null);
  let nextPlanActivationNonce = 0;
  let settingsInitialTab = $state<'general' | 'appearance' | 'chart' | 'feed' | 'system' | 'about' | 'help'>('general');
  let isConsoleDrawerOpen = $state(false);

  // Docked Structural Shell Reactive States (Unified WorkspaceShell Deep Module)
  let shellState = $state<WorkspaceShellState>(workspaceShellService.getSnapshot());
  let allAlerts = $state<PriceAlert[]>(alertService.getAlerts());
  let unsubShell: (() => void) | null = null;
  let unsubAlertsList: (() => void) | null = null;
  let unsubWatchlistRegistry: (() => void) | null = null;
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
  let isReplayDatePickerOpen = $state(false);

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

  // Deep Link & Clipboard Sentry State
  let detectedChartLink = $state<{ target: ParsedChartTarget; rawUrl: string } | null>(null);
  let clipboardWatcher: ClipboardWatcherService | null = null;

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

  let chartComponent: any = $state(null);
  let pineEditorComponent: any = $state(null);
  let unsubTicker: (() => void) | null = null;
  let pinePanelWidth = $state(480);
  let activePineResizeSession: EdgeResizeSession | null = null;

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

    unsubReplay = replaySession.subscribe((snap) => {
      replaySnapshot = snap;
    });

    unsubShell = workspaceShellService.subscribe((s) => {
      shellState = s;
      scheduleResizeDispatch(40);
    });

    unsubAlertsList = alertService.subscribe((list) => {
      allAlerts = list;
    });

    // Muat preferensi aplikasi tersimpan dari localStorage
    try {
      const savedSettings = localStorage.getItem('trawangan_app_settings');
      let parsed = null;
      if (savedSettings) {
        try {
          parsed = JSON.parse(savedSettings);
        } catch (_) {}
      }
      appSettings = resolveAppSettings(parsed);
      if (appSettings.defaultTimeframe) {
        activeTimeframe = appSettings.defaultTimeframe;
      }
      if (appSettings.syncConfig) {
        syncConfig = { ...appSettings.syncConfig };
      }
      if (appSettings.autoSaveWorkspace !== undefined) {
        isAutoSaveWorkspace = appSettings.autoSaveWorkspace;
      } else {
        const savedAutoSave = localStorage.getItem('trawangan_autosave_workspace');
        if (savedAutoSave !== null) {
          isAutoSaveWorkspace = savedAutoSave === 'true';
        }
      }

      const savedPineWidth = localStorage.getItem('trawangan_pine_panel_width');
      if (savedPineWidth) {
        const parsedWidth = parseInt(savedPineWidth, 10);
        if (!isNaN(parsedWidth) && parsedWidth >= 340 && parsedWidth <= 900) {
          pinePanelWidth = parsedWidth;
        }
      }

      isPageMounted = true;

      // Auto-load workspace terakhir saat startup jika preferensi aktif (disertai recovery pending backup bila ada)
      if (appSettings.autoLoadLastWorkspace !== false) {
        const lastWorkspaceId = getLastActiveWorkspaceId();
        if (lastWorkspaceId) {
          loadWorkspaces().then(async (list) => {
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

    // Pengecekan pembaruan otomatis di latar belakang (silent check)
    schedulePageTimeout(() => {
      if (!isPageActive) return;
      updateService.checkForUpdates(true);
    }, 3000);

    // Auto-Flush gambar dan simpan pending backup + workspace sebelum aplikasi ditutup (beforeunload & Tauri onCloseRequested)
    const runExitFlush = () =>
      executeExitFlush({
        flushDrawings: () => flushDrawings(),
        buildSnapshot: () => {
          if (!isAutoSaveWorkspace || !activeWorkspace || !chartComponent) return null;
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

    // Dengarkan event saat Price Alert terpicu secara real-time
    unsubAlertTrigger = alertService.onTrigger((alert, actualPrice) => {
      triggeredAlertsToasts = [alert, ...triggeredAlertsToasts.slice(0, 3)];
      addSystemLog(`🔔 Price Alert Terpicu: ${alert.symbol} di $${actualPrice}`, 'warn');
      schedulePageTimeout(() => {
        if (!isPageActive) return;
        handleDismissAlertToast(alert.id);
      }, 12000);
    });

    marketFeed.getActiveProviderId().then((pId) => {
      if (pId) {
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

    loadQuickSymbolsConfig().then((cfg) => {
      if (cfg) quickSymbolsConfig = cfg;
    });

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
        if (chartComponent?.fitChart) chartComponent.fitChart();
        addSystemLog('Shortcut: Reset skala/fit grafik (Alt+Z)', 'info');
      }),
      commandDispatcher.bindHandler('fit-chart-f', () => {
        if (chartComponent?.fitChart) chartComponent.fitChart();
        addSystemLog('Shortcut: Fit grafik ke viewport (F)', 'info');
      }),
      commandDispatcher.bindHandler('create-alert-cursor', () => {
        const cursorPrice = chartComponent?.getLastHoveredPrice?.() || ticker?.price;
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
          replaySession.step();
        }
      }),
      commandDispatcher.bindHandler('replay-step-backward', () => {
        if (replaySnapshot.active) {
          replaySession.stepBack();
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
        if (workspaceMode === 'pine') {
          handleWorkspaceModeChange('terminal');
        }
        workspaceShellService.toggleRightDockTab('objects');
        addSystemLog('Shortcut: Beralih panel Object Tree & Indikator (Alt+O)', 'info');
      }),
      commandDispatcher.bindHandler('invert-price-scale', () => {
        if (chartComponent?.getPriceScaleState && chartComponent?.applyPriceScaleState) {
          const cur = chartComponent.getPriceScaleState();
          const nextInvert = !cur?.invert;
          chartComponent.applyPriceScaleState({ ...cur, invert: nextInvert });
          addSystemLog(`Invert skala harga: ${nextInvert ? 'AKTIF' : 'NONAKTIF'} (Alt+I)`, 'info');
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

    // Deep Link & Clipboard Watcher Sentry
    clipboardWatcher = new ClipboardWatcherService({
      enabled: appSettings.clipboardWatcherEnabled !== false,
      onDetected: (target, rawUrl) => {
        if (appSettings.clipboardAutoOpen) {
          handleOpenDetectedChartLink(target);
        } else {
          detectedChartLink = { target, rawUrl };
        }
      }
    });
    const detachClipboardFocus = clipboardWatcher.attachFocusListener();

    let unlistenDeepLink: (() => void) | null = null;
    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        if (!isPageActive) return;
        listen<string>('deep-link-received', (event) => {
          if (event.payload) {
            const target = parseExternalChartUrl(event.payload);
            if (target) {
              if (appSettings.clipboardAutoOpen) {
                handleOpenDetectedChartLink(target);
              } else {
                detectedChartLink = { target, rawUrl: event.payload };
              }
            }
          }
        })
          .then((unsub) => {
            if (!isPageActive) {
              unsub();
              return;
            }
            unlistenDeepLink = unsub;
          })
          .catch(() => {});
      })
      .catch(() => {});

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
      clearPageManagedTimers();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (unlistenCloseRequested) unlistenCloseRequested();
      workspaceCoordinator.cancel();
      if (detachMediaQuery) detachMediaQuery();
      unbindGlobalListener();
      unsubTypeToSearch();
      unsubTypeTimeframe();
      unsubDrawingState();
      detachClipboardFocus();
      if (unlistenDeepLink) unlistenDeepLink();
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
  });

  async function handleSymbolChange(newSym: string, providerHint?: string) {
    const targetProvider = routeVenueForSymbol(newSym, activeProviderId, providerHint);

    if (targetProvider !== activeProviderId) {
      await handleProviderChange(targetProvider);
    }

    if (activeSymbol && activeSymbol !== newSym) {
      try {
        await flushDrawings();
      } catch (_) {}
    }
    activeSymbol = newSym;
    addSystemLog(`Simbol berganti ke ${newSym} (${targetProvider.toUpperCase()})`, 'info');
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

  function persistAppSettings() {
    try {
      localStorage.setItem('trawangan_app_settings', JSON.stringify(appSettings));
    } catch (e) {
      console.warn('Gagal menyimpan preferensi aplikasi ke localStorage:', e);
    }
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
    if (syncConfig.indicators && chartComponent && typeof chartComponent.syncIndicatorsFromActiveCell === 'function') {
      chartComponent.syncIndicatorsFromActiveCell();
    }
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
      storageKey: 'trawangan_pine_panel_width',
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
    try {
      localStorage.setItem('trawangan_pine_panel_width', String(nextWidth));
    } catch (_) {}
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
      try {
        localStorage.setItem('trawangan_autosave_workspace', String(isAutoSaveWorkspace));
      } catch (_) {}
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
    if (newSettings.clipboardWatcherEnabled !== undefined && clipboardWatcher) {
      clipboardWatcher.setEnabled(newSettings.clipboardWatcherEnabled);
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

  async function handleToggleWatchlistSymbolFromSearch(rawInput: string) {
    let entry = rawInput;
    if (!entry.includes(':')) {
      entry = formatWatchlistEntry(rawInput, activeProviderId);
    }
    const target = parseWatchlistEntry(entry);
    const exists = watchlistSymbols.some((s) => {
      if (s === entry) return true;
      const p = parseWatchlistEntry(s);
      return p.symbol === target.symbol && p.providerId === target.providerId;
    });

    let next: string[];
    if (exists) {
      next = watchlistSymbols.filter((s) => {
        if (s === entry) return false;
        const p = parseWatchlistEntry(s);
        return !(p.symbol === target.symbol && p.providerId === target.providerId);
      });
    } else {
      next = insertSymbolIntoSection(watchlistSymbols, entry, null);
    }
    handleWatchlistChange(next);
    await watchlistRegistry.updateActiveItems(next);
  }

  function handleQuickSymbolsConfigChange(newConfig: QuickSymbolsConfig) {
    quickSymbolsConfig = newConfig;
    saveQuickSymbolsConfig(newConfig);
  }

  async function handleProviderChange(newProviderId: string) {
    try {
      await flushDrawings();
    } catch (_) {}
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
      chart: chartComponent,
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
        setLastActiveWorkspaceId(saved.id);
        if (!isClosingApp) {
          clearPendingWorkspaceBackup(saved.id);
        }
      }
      return saved;
    },
    onError: (err) => {
      console.warn('Auto-save workspace gagal:', err);
    },
  });

  async function handleSaveWorkspace(name: string, overwriteId?: string) {
    workspaceCoordinator.cancel();
    const prevWsId = activeWorkspace?.id || 'default_workspace';
    try { await flushDrawings(); } catch (_) {}

    const targetId =
      overwriteId ||
      (activeWorkspace?.name.trim().toLowerCase() === name.trim().toLowerCase()
        ? activeWorkspace.id
        : undefined);

    const payload = buildCurrentWorkspacePayload(name, targetId);
    const saved = await saveWorkspace(payload as any);

    // Klon seluruh drawing dari workspace sumber (misal default_workspace) SEBELUM activeWorkspace berubah
    if (saved?.id && prevWsId !== saved.id) {
      try {
        await cloneWorkspaceDrawings(prevWsId, saved.id);
      } catch (err) {
        console.warn('[SaveWorkspace] Gagal menyalin drawings saat Save As:', err);
      }
    }

    activeWorkspace = saved;
    if (saved?.id) {
      setLastActiveWorkspaceId(saved.id);
      clearPendingWorkspaceBackup(saved.id);
    }
    workspaceCoordinator.setSavedFingerprint(
      computeWorkspaceFingerprint({ ...payload, id: saved?.id || payload.id })
    );
    addSystemLog(`Workspace "${name}" disimpan`, 'success');
  }

  async function handleNewWorkspace() {
    workspaceCoordinator.cancel();
    workspaceCoordinator.setSavedFingerprint('');
    try { await flushDrawings(); } catch (_) {}
    activeWorkspace = null;
    setLastActiveWorkspaceId(null);
    chartDrawingController.setWorkspaceId('default_workspace');
    chartDrawingController.clearCanvasVisuals();
    chartDrawingController.clearAllPlans();
    addSystemLog('Workspace aktif dilepas. Siap menyetel tata letak atau indikator untuk workspace baru.', 'info');
  }

  async function handleLoadWorkspace(w: SavedWorkspace) {
    workspaceCoordinator.cancel();
    try { await flushDrawings(); } catch (_) {}
    isLoadingWorkspace = true;
    try {
      activeWorkspace = w;
      if (w && w.id) {
        setLastActiveWorkspaceId(w.id);
        clearPendingWorkspaceBackup(w.id);
      }

      // Jalankan pipeline restorasi workspace melalui deep workspaceLifecycle engine
      const res = await executeWorkspaceLoadPipeline({
        workspace: w,
        chart: chartComponent,
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
      addSystemLog(`Gagal memuat workspace: ${e instanceof Error ? e.message : String(e)}`, 'warn');
    } finally {
      isLoadingWorkspace = false;
    }
  }

  function handleToggleAutoSaveWorkspace() {
    isAutoSaveWorkspace = !isAutoSaveWorkspace;
    appSettings.autoSaveWorkspace = isAutoSaveWorkspace;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('trawangan_autosave_workspace', isAutoSaveWorkspace.toString());
      } catch (_) {}
    }
    persistAppSettings();
    addSystemLog(`Auto-save workspace: ${isAutoSaveWorkspace ? 'AKTIF' : 'NONAKTIF'}`, 'info');
  }

  function triggerWorkspaceAutoSave() {
    // KUNCI PENTING: Hanya jalankan auto-save jika ada activeWorkspace yang sedang dimuat!
    // Jika activeWorkspace === null (sedang membuat workspace baru/lepas), jangan auto-save untuk mencegah tabrakan/overwrite!
    if (!isAutoSaveWorkspace || !isPageMounted || isLoadingWorkspace || !chartComponent || !activeWorkspace) return;
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
    if (chartComponent && typeof chartComponent.clearAllIndicators === 'function') {
      chartComponent.clearAllIndicators();
    }
    activeIndicators = [];
    addSystemLog('Seluruh indikator teknikal di grafik dibersihkan.', 'info');
  }

  async function handleClearAll() {
    await chartDrawingController.clearAll();
    if (chartComponent && typeof chartComponent.clearAllIndicators === 'function') {
      chartComponent.clearAllIndicators();
    }
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

  async function handleOpenDetectedChartLink(target: ParsedChartTarget) {
    detectedChartLink = null;
    let finalProvider = target.providerId || activeProviderId || 'binance';
    let finalSymbol = target.symbol;

    try {
      const searchEngine = typeof marketFeed.getSearchEngine === 'function' ? marketFeed.getSearchEngine() : null;
      if (searchEngine) {
        const resolved = await resolveChartTargetWithFallback(target, searchEngine);
        finalProvider = resolved.providerId;
        finalSymbol = resolved.symbol;
        if (resolved.redirectedNotice) {
          addSystemLog(`[Deep Link] ${resolved.redirectedNotice}`, 'warn');
        }
      } else {
        const norm = normalizeSymbolAndContract(target.symbol);
        finalSymbol = norm.cleanSymbol;
      }
    } catch (_) {
      const norm = normalizeSymbolAndContract(target.symbol);
      finalSymbol = norm.cleanSymbol;
    }

    addSystemLog(`[Deep Link] Mengarahkan ke ${finalProvider.toUpperCase()}:${finalSymbol}`, 'info');
    handleSymbolChange(finalSymbol, finalProvider);
  }

  function addSystemLog(msg: string, level: 'info' | 'success' | 'warn') {
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
      const canvas = chartComponent?.getChartScreenshotCanvas?.(scope, thesisLayout);
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
      const canvas = chartComponent?.getChartScreenshotCanvas?.(scope, thesisLayout);
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
    {watchlistSymbols}
    {quickSymbolsConfig}
    onQuickSymbolsConfigChange={handleQuickSymbolsConfigChange}
    onTimeframeChange={handleTimeframeChange}
    onLayoutChange={handleLayoutChange}
    onProviderChange={handleProviderChange}
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
    onToggleSyncIndicators={handleToggleSyncIndicators}
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

    <!-- WORKSPACE UNIFIED VIEWPORT (Docked Structural Shell: Left Rail | Chart Canvas | Drawer Panel | Right Dock Rail) -->
    <div class="workspace-viewport mode-{workspaceMode}">
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
          onToggleThesisCards={() => chartDrawingController.toggleThesisCardsVisible()}
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
          bind:this={chartComponent}
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
          {syncConfig}
          showWatermark={appSettings.showWatermark}
          showCurrentPriceLine={appSettings.showCurrentPriceLine ?? true}
          showVolume={appSettings.showVolume ?? true}
          showIndicatorPriceLabels={appSettings.showIndicatorPriceLabels ?? true}
          showDrawingPriceLabels={appSettings.showDrawingPriceLabels ?? true}
          securityWatermark={appSettings.securityWatermark}
          userProfile={appSettings.userProfile}
          onActiveIndicatorsChange={(list) => (activeIndicators = list)}
          onActiveCellChange={handleActiveCellChange}
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
          onPersistableStateChange={() => (chartDirtyTick += 1)}
        />
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
          {watchlistSymbols}
          {activeIndicators}
          {activeDrawings}
          {selectedDrawingId}
          showVolume={appSettings.showVolume ?? true}
          onToggleVolumeVisibility={handleToggleVolumeVisibility}
          onSelectSymbol={handleSymbolChange}
          onWatchlistChange={handleWatchlistChange}
          onToggleIndicatorVisibility={handleToggleIndicatorVisibility}
          onRemoveIndicator={handleRemoveIndicator}
          onConfigureIndicator={() => (isIndicatorModalOpen = true)}
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
          tickSize={ticker?.price ? getAdaptiveTickSize(ticker.price) : undefined}
          {planActivationRequest}
          onConsumePlanActivation={handleConsumePlanActivation}
          onApplyPlan={handleApplyPlanFromTab}
          onUpdatePlan={handleUpdatePlanFromTab}
          onEditPlan={(planId) => openRightPlanTab({ subMode: 'form', planId })}
          onOpenPlanTab={(subMode = 'form') => openRightPlanTab({ subMode })}
          onLog={(msg, level) => addSystemLog(msg, level || 'info')}
          onRequestCreateAlert={() => handleRequestCreateAlert(activeSymbol)}
          onRequestEditAlert={(alert) => handleRequestCreateAlert(alert.symbol, alert.targetPrice, alert)}
          onOpenSymbolSearch={() => {
            symbolSearchInitialQuery = '';
            symbolSearchTriggerSource = 'explicit';
            isSymbolSearchOpen = true;
          }}
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
    onSelectTimezone={(tz) => handleUpdateSettings({ timezone: tz })}
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
    onClose={() => (isSettingsModalOpen = false)}
    onUpdateSettings={handleUpdateSettings}
    onProviderChange={handleProviderChange}
    onOpenChartSettings={(sec?: string) => chartComponent?.openChartSettings(sec)}
    onSaveChartAsDefault={() => chartComponent?.saveCurrentChartSettingsAsDefault() ?? false}
    onResetChartFactory={() => chartComponent?.resetChartSettingsToFactory()}
    onOpenGestureGuide={() => (isDrawByHoldingModalOpen = true)}
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
      if (chartComponent && typeof chartComponent.setTimeframe === 'function') {
        chartComponent.setTimeframe(newTf as Timeframe);
      }
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

  <!-- Create & Edit Price Alert Modal -->
  <CreateAlertModal
    isOpen={isCreateAlertModalOpen}
    chartSymbol={activeSymbol}
    chartTickSize={ticker?.price ? getAdaptiveTickSize(ticker.price) : undefined}
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
      const priceStr = formatPriceWithQuoteSymbol(
        newAlert.targetPrice,
        parseAdaptiveSymbol(newAlert.symbol || activeSymbol).quoteAsset
      );
      addSystemLog(`Price Alert dibuat: ${newAlert.symbol} @ ${priceStr}`, 'success');
    }}
    onUpdated={(upAlert: any) => {
      const priceStr = formatPriceWithQuoteSymbol(
        upAlert.targetPrice,
        parseAdaptiveSymbol(upAlert.symbol || activeSymbol).quoteAsset
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
    getScreenshotCanvas={(scope, thesisLayout) => chartComponent?.getChartScreenshotCanvas?.(scope, thesisLayout) || null}
    onUpdateSettings={handleUpdateSettings}
    onClose={() => { isSnapshotPreviewOpen = false; }}
    onLog={(msg, type) => addSystemLog(msg, type || 'info')}
  />

  <!-- Smart Clipboard Sentry / Deep Link Toast -->
  {#if detectedChartLink}
    <div class="clipboard-sentry-toast obsidian-card" role="alert">
      <div class="toast-header">
        <div class="toast-title-row">
          <Link2 size={14} class="text-brand" />
          <span class="toast-title">Tautan Chart Terdeteksi</span>
        </div>
        <button
          type="button"
          class="toast-close-btn"
          title="Tutup"
          onclick={() => (detectedChartLink = null)}
        >
          <X size={12} />
        </button>
      </div>

      <div class="toast-body">
        <div class="toast-symbol mono-nums">
          <span class="venue-pill {detectedChartLink.target.providerId?.toLowerCase() || 'binance'}">
            {(detectedChartLink.target.providerId || 'binance').toUpperCase()}
          </span>
          <span class="symbol-text">{detectedChartLink.target.symbol}</span>
        </div>
        <span class="toast-raw-url" title={detectedChartLink.rawUrl}>
          {detectedChartLink.rawUrl.slice(0, 48)}...
        </span>
      </div>

      <div class="toast-actions">
        <button
          type="button"
          class="toast-btn dismiss"
          onclick={() => (detectedChartLink = null)}
        >
          Abaikan
        </button>
        <button
          type="button"
          class="toast-btn open"
          onclick={() => {
            if (detectedChartLink) handleOpenDetectedChartLink(detectedChartLink.target);
          }}
        >
          Buka di Trawangan
        </button>
      </div>
    </div>
  {/if}

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

  .text-bull {
    color: var(--bull-color);
  }

  /* Smart Clipboard Sentry / Deep Link Toast */
  .clipboard-sentry-toast {
    position: fixed;
    right: 48px;
    bottom: 34px;
    z-index: 100;
    width: 310px;
    background-color: var(--bg-panel, #131722);
    border: 1px solid var(--border-bright, #2a2e39);
    border-left: 3px solid #2962ff;
    border-radius: var(--radius-sm, 6px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.75);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: slideInToast 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toast-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .toast-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .toast-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    letter-spacing: 0.3px;
  }

  .toast-close-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast-close-btn:hover {
    color: var(--text-main);
    background: rgba(255, 255, 255, 0.05);
  }

  .toast-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .toast-symbol {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
  }

  .venue-pill {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    background-color: var(--bg-base);
    color: var(--text-dim);
    border: 1px solid var(--border-hairline);
  }

  .venue-pill.binance {
    color: #f0b90b;
    border-color: rgba(240, 185, 11, 0.3);
    background: rgba(240, 185, 11, 0.1);
  }

  .venue-pill.bitunix {
    color: #00f090;
    border-color: rgba(0, 240, 144, 0.3);
    background: rgba(0, 240, 144, 0.1);
  }

  .venue-pill.indodax {
    color: #00b4d8;
    border-color: rgba(0, 180, 216, 0.3);
    background: rgba(0, 180, 216, 0.1);
  }

  .venue-pill.bybit {
    color: #f7a600;
    border-color: rgba(247, 166, 0, 0.3);
    background: rgba(247, 166, 0, 0.1);
  }

  .symbol-text {
    color: var(--text-main);
  }

  .toast-raw-url {
    font-size: 10px;
    color: var(--text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
  }

  .toast-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 2px;
  }

  .toast-btn {
    font-size: 11px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }

  .toast-btn.dismiss {
    background: transparent;
    color: var(--text-dim);
    border-color: var(--border-hairline);
  }

  .toast-btn.dismiss:hover {
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .toast-btn.open {
    background: #2962ff;
    color: #ffffff;
  }

  .toast-btn.open:hover {
    background: #1e53e5;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes slideInToast {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
