<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { isSectionToken } from '../services/watchlistUtils';
  import TradePlanTab from './TradePlanTab.svelte';
  import WatchlistTab from './right-dock/WatchlistTab.svelte';
  import AlertsTab from './right-dock/AlertsTab.svelte';
  import LayersTab from './right-dock/LayersTab.svelte';
  import { watchlistRegistry } from '../services/watchlistRegistryService';
  import {
    adjustPanelWidthByKeyboard,
    startEdgeResizeSession,
    type EdgeResizeSession
  } from '../services/panelResizeHelper';
  import { storage } from '../services/persistence';
  import { readClampedPanelWidth } from '../services/persistence/uiPreferencesHelper';
  import type { RightDockTab } from '../services/workspaceShellService';
  import type { ParsedTradingPlan } from '../services/planParserService';
  import type {
    ApplyPlanFromTabOptions,
    TradePlanActivationRequest,
    TradePlanTabSubMode,
    UpdatePlanFromTabOptions
  } from '../services/tradePlanFormService';
  import type { ActiveTradingPlan } from '../services/tradingPlanLifecycle';
  import type { PriceAlert, WatchlistRecord } from '../types/market';

  interface Props {
    isOpen: boolean;
    activeTab?: RightDockTab;
    activeSymbol: string;
    activeProviderId?: string;
    watchlistSymbols?: string[];
    activeIndicators?: { id: string; title: string; visible: boolean; source?: string; inputs?: any }[];
    activeDrawings?: any[];
    selectedDrawingId?: string | null;
    showVolume?: boolean;
    onToggleVolumeVisibility?: () => void;
    onSelectSymbol: (symbol: string, providerId?: string) => void;
    onToggleIndicatorVisibility?: (id: string) => void;
    onRemoveIndicator?: (id: string) => void;
    onConfigureIndicator?: (id: string) => void;
    onOpenIndicatorInPine?: (id: string, source?: string) => void;
    onToggleDrawingVisibility?: (id: string) => void;
    onToggleDrawingLock?: (id: string) => void;
    onRemoveDrawing?: (id: string) => void;
    onSelectDrawing?: (id: string | null) => void;
    onBulkHideDrawings?: (hidden: boolean) => void;
    onBulkLockDrawings?: (locked: boolean) => void;
    onBulkDeleteDrawings?: () => void;
    onWatchlistChange?: (symbols: string[]) => void;
    onRequestCreateAlert?: () => void;
    onRequestEditAlert?: (alert: PriceAlert) => void;
    activePlans?: ActiveTradingPlan[];
    showThesisCards?: boolean;
    onToggleThesisCards?: () => void;
    onRemovePlan?: (id: string) => void;
    currentPrice?: number | null;
    tickSize?: number;
    planActivationRequest?: TradePlanActivationRequest | null;
    onConsumePlanActivation?: (nonce: number) => void;
    onApplyPlan?: (plan: ParsedTradingPlan, options?: ApplyPlanFromTabOptions) => Promise<any> | any;
    onUpdatePlan?: (planId: string, plan: ParsedTradingPlan, options?: UpdatePlanFromTabOptions) => Promise<any> | any;
    onEditPlan?: (planId: string) => void;
    onOpenPlanTab?: (subMode?: TradePlanTabSubMode) => void;
    onLog?: (msg: string, level?: 'info' | 'success' | 'warn') => void;
  }

  let {
    isOpen,
    activeTab: propActiveTab,
    activeSymbol,
    activeProviderId = 'binance',
    watchlistSymbols: propSymbols,
    activeIndicators = [],
    activeDrawings = [],
    selectedDrawingId = null,
    showVolume = true,
    onToggleVolumeVisibility,
    onSelectSymbol,
    onToggleIndicatorVisibility,
    onRemoveIndicator,
    onConfigureIndicator,
    onOpenIndicatorInPine,
    onToggleDrawingVisibility,
    onToggleDrawingLock,
    onRemoveDrawing,
    onSelectDrawing,
    onBulkHideDrawings,
    onBulkLockDrawings,
    onBulkDeleteDrawings,
    onWatchlistChange,
    onRequestCreateAlert,
    onRequestEditAlert,
    activePlans = [],
    showThesisCards = true,
    onToggleThesisCards,
    onRemovePlan,
    currentPrice = null,
    tickSize,
    planActivationRequest = null,
    onConsumePlanActivation,
    onApplyPlan,
    onUpdatePlan,
    onEditPlan,
    onOpenPlanTab,
    onLog,
  }: Props = $props();

  const PREF_KEY_STANDARD_WIDTH = 'right_panel_width' as const;
  const PREF_KEY_PLAN_WIDTH = 'right_plan_width' as const;
  const STANDARD_BOUNDS = { min: 270, max: 620 };
  const PLAN_BOUNDS = { min: 310, max: 680 };

  const activeTab = $derived<RightDockTab>(propActiveTab ?? 'watchlist');
  const activeBounds = $derived(activeTab === 'plan' ? PLAN_BOUNDS : STANDARD_BOUNDS);

  let standardPanelWidth = $state(300);
  let planPanelWidth = $state(360);
  let isResizingPanel = $state(false);
  const effectivePanelWidth = $derived(activeTab === 'plan' ? planPanelWidth : standardPanelWidth);

  let lastTrackedWidthForResize: number | null = null;
  let resizeDispatchTimer: ReturnType<typeof setTimeout> | null = null;
  let activeResizeSession: EdgeResizeSession | null = null;

  let registryWatchlists = $state<WatchlistRecord[]>([]);
  let registryActiveId = $state<string>('default');
  let unsubRegistry: (() => void) | null = null;
  let symbols = $state<string[]>([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
  ]);
  let lastSyncedHash = '';
  const availableSymbolList = $derived(symbols.filter((s) => Boolean(s && !isSectionToken(s))));

  const activeWatchlist = $derived.by<WatchlistRecord>(() => {
    const found = registryWatchlists.find((w) => w.id === registryActiveId);
    if (found) return found;
    return {
      id: registryActiveId,
      name: 'Daftar Utama',
      items: symbols,
      isPreset: false,
    };
  });

  function persistPanelWidth(isPlan: boolean, width: number) {
    void storage
      .setUiPreference(isPlan ? PREF_KEY_PLAN_WIDTH : PREF_KEY_STANDARD_WIDTH, width)
      .catch(() => {});
  }

  function hydratePanelWidths() {
    const savedStd = readClampedPanelWidth(PREF_KEY_STANDARD_WIDTH, STANDARD_BOUNDS.min, STANDARD_BOUNDS.max, storage);
    if (savedStd !== null) {
      standardPanelWidth = savedStd;
    }
    const savedPlan = readClampedPanelWidth(PREF_KEY_PLAN_WIDTH, PLAN_BOUNDS.min, PLAN_BOUNDS.max, storage);
    if (savedPlan !== null) {
      planPanelWidth = savedPlan;
    }
  }

  $effect(() => {
    const open = isOpen;
    const width = effectivePanelWidth;
    if (!open || isResizingPanel) {
      if (!open) lastTrackedWidthForResize = null;
      return;
    }
    if (lastTrackedWidthForResize !== null && lastTrackedWidthForResize !== width) {
      if (resizeDispatchTimer !== null) clearTimeout(resizeDispatchTimer);
      resizeDispatchTimer = setTimeout(() => {
        resizeDispatchTimer = null;
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('resize'));
      }, 40);
    }
    lastTrackedWidthForResize = width;

    return () => {
      if (resizeDispatchTimer !== null) {
        clearTimeout(resizeDispatchTimer);
        resizeDispatchTimer = null;
      }
    };
  });

  function handleStartResizePanel(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    activeResizeSession?.cancel();
    const isPlan = activeTab === 'plan';
    const bounds = isPlan ? PLAN_BOUNDS : STANDARD_BOUNDS;
    const preferenceKey = isPlan ? PREF_KEY_PLAN_WIDTH : PREF_KEY_STANDARD_WIDTH;
    isResizingPanel = true;

    activeResizeSession = startEdgeResizeSession({
      startClientX: e.clientX,
      startWidth: effectivePanelWidth,
      minWidth: bounds.min,
      maxCap: bounds.max,
      viewportMaxRatio: 0.58,
      edge: 'left-edge',
      preferenceKey,
      onResize: (nextWidth) => {
        if (isPlan) {
          planPanelWidth = nextWidth;
        } else {
          standardPanelWidth = nextWidth;
        }
      },
      onEnd: (finalWidth) => {
        isResizingPanel = false;
        activeResizeSession = null;
        lastTrackedWidthForResize = finalWidth;
      }
    });
  }

  function handleResizerKeyDown(e: KeyboardEvent) {
    const isPlan = activeTab === 'plan';
    const bounds = isPlan ? PLAN_BOUNDS : STANDARD_BOUNDS;

    const nextWidth = adjustPanelWidthByKeyboard(
      e.key,
      e.shiftKey,
      effectivePanelWidth,
      bounds.min,
      bounds.max,
      'left-edge',
      0.58
    );

    if (nextWidth === null) return;
    e.preventDefault();

    if (isPlan) {
      planPanelWidth = nextWidth;
    } else {
      standardPanelWidth = nextWidth;
    }
    persistPanelWidth(isPlan, nextWidth);
    lastTrackedWidthForResize = nextWidth;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('resize'));
    }
  }

  $effect(() => {
    if (propSymbols) {
      const h = JSON.stringify(propSymbols);
      if (h !== lastSyncedHash) {
        lastSyncedHash = h;
        symbols = [...propSymbols];
      }
    }
  });

  async function applyWatchlistUpdate(newSymbols: string[]) {
    symbols = [...newSymbols];
    lastSyncedHash = JSON.stringify(newSymbols);
    if (JSON.stringify(newSymbols) !== JSON.stringify(propSymbols)) {
      onWatchlistChange?.(newSymbols);
    }
    await watchlistRegistry.updateActiveItems(newSymbols);
  }

  let isPanelMounted = true;

  onMount(() => {
    isPanelMounted = true;
    if (storage.isBootstrapped()) {
      hydratePanelWidths();
    } else {
      void storage
        .bootstrap()
        .then(() => {
          if (isPanelMounted && !isResizingPanel) {
            hydratePanelWidths();
          }
        })
        .catch(() => {});
    }

    unsubRegistry = watchlistRegistry.subscribe(({ watchlists: list, activeId }) => {
      registryWatchlists = list;
      registryActiveId = activeId;
      const current = list.find((w) => w.id === activeId);
      if (current) {
        symbols = [...current.items];
        lastSyncedHash = JSON.stringify(symbols);
        if (JSON.stringify(symbols) !== JSON.stringify(propSymbols)) {
          onWatchlistChange?.(symbols);
        }
      }
    });

    watchlistRegistry.load().catch((err) => {
      console.warn('Gagal memuat awal multi-watchlist:', err);
    });
  });

  onDestroy(() => {
    isPanelMounted = false;
    activeResizeSession?.cancel();
    activeResizeSession = null;
    if (resizeDispatchTimer !== null) {
      clearTimeout(resizeDispatchTimer);
      resizeDispatchTimer = null;
    }
    if (unsubRegistry) {
      unsubRegistry();
      unsubRegistry = null;
    }
  });
</script>

<!-- Right Drawer Panel: Watchlist, Alerts, Layers & Trade Plan -->
{#if isOpen}
  <div
    class="right-panel-resizer {isResizingPanel ? 'resizing' : ''}"
    title="Tarik atau gunakan tombol Panah Kiri/Kanan untuk mengubah lebar panel"
    role="slider"
    aria-orientation="vertical"
    aria-label="Ubah lebar panel kanan"
    aria-valuemin={activeBounds.min}
    aria-valuemax={activeBounds.max}
    aria-valuenow={effectivePanelWidth}
    tabindex="0"
    onpointerdown={handleStartResizePanel}
    onkeydown={handleResizerKeyDown}
  >
    <div class="resizer-grip"></div>
  </div>

  <aside class="right-panel obsidian-panel" style="width: {effectivePanelWidth}px;">
    {#if activeTab === 'watchlist'}
      <WatchlistTab
        {symbols}
        {activeSymbol}
        {activeProviderId}
        {registryWatchlists}
        {activeWatchlist}
        {onSelectSymbol}
        onUpdateWatchlist={applyWatchlistUpdate}
      />
    {:else if activeTab === 'alerts'}
      <AlertsTab
        {activeSymbol}
        availableSymbols={availableSymbolList}
        {onSelectSymbol}
        {onRequestCreateAlert}
        {onRequestEditAlert}
      />
    {:else if activeTab === 'objects'}
      <LayersTab
        {activeSymbol}
        {activeIndicators}
        {activeDrawings}
        {selectedDrawingId}
        {showVolume}
        {activePlans}
        {showThesisCards}
        {onToggleVolumeVisibility}
        {onToggleIndicatorVisibility}
        {onRemoveIndicator}
        {onConfigureIndicator}
        {onOpenIndicatorInPine}
        {onToggleDrawingVisibility}
        {onToggleDrawingLock}
        {onRemoveDrawing}
        {onSelectDrawing}
        {onBulkHideDrawings}
        {onBulkLockDrawings}
        {onBulkDeleteDrawings}
        {onToggleThesisCards}
        {onRemovePlan}
        {onEditPlan}
        {onOpenPlanTab}
      />
    {/if}

    <!-- Trade Plan tetap ter-mount agar draft form dan teks tidak hilang saat pindah tab -->
    <div class="plan-tab-host" class:hidden={activeTab !== 'plan'}>
      <TradePlanTab
        isActive={isOpen && activeTab === 'plan'}
        {activeSymbol}
        availableSymbols={availableSymbolList}
        {currentPrice}
        {tickSize}
        {activePlans}
        activationRequest={planActivationRequest}
        onConsumeActivation={onConsumePlanActivation}
        onApplyPlan={(plan, options) => onApplyPlan?.(plan, options)}
        onUpdatePlan={(planId, plan, options) => onUpdatePlan?.(planId, plan, options)}
        {onRemovePlan}
        {onLog}
      />
    </div>
  </aside>
{/if}

<style>
  .right-panel-resizer {
    width: 4px;
    height: 100%;
    background-color: transparent;
    border-left: 1px solid var(--border-hairline);
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    z-index: 32;
    transition: background-color 0.14s ease, border-color 0.14s ease;
  }

  .right-panel-resizer:hover,
  .right-panel-resizer.resizing,
  .right-panel-resizer:focus-visible {
    background-color: color-mix(in srgb, var(--brand-cyan) 26%, transparent);
    border-left-color: color-mix(in srgb, var(--brand-cyan) 65%, transparent);
    outline: none;
  }

  .right-panel-resizer .resizer-grip {
    width: 1px;
    height: 26px;
    background-color: var(--border-bright);
    border-radius: 1px;
  }

  .right-panel-resizer:hover .resizer-grip,
  .right-panel-resizer.resizing .resizer-grip,
  .right-panel-resizer:focus-visible .resizer-grip {
    background-color: var(--brand-cyan);
  }

  .right-panel {
    width: 300px;
    height: 100%;
    background-color: var(--bg-surface);
    border-left: 1px solid var(--border-hairline);
    display: flex;
    flex-direction: column;
    z-index: 30;
    flex-shrink: 0;
    overflow: hidden;
  }

  .plan-tab-host {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .plan-tab-host.hidden {
    display: none;
  }
</style>
