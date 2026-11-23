<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Layers, ChevronDown, Check, Star } from '@lucide/svelte';
  import type {
    Timeframe,
    MultiChartSyncConfig,
    SavedWorkspace,
    ProviderConfig,
    ColorModePreference,
    PriceStyle,
  } from '../types/market';
  import { updateService, type UpdateState } from '../services/updateService';
  import { marketFeed } from '../services/market';
  import { getNextColorMode } from '../constants/themes';
  import type { ChartTabItem } from '../services/chartTabsService';
  import {
    DerivativesTelemetryService,
    type DerivativesTelemetrySnapshot,
  } from '../services/market/derivativesTelemetryService';

  import TopTabBar from './header/TopTabBar.svelte';
  import DerivativesTelemetryStrip from './header/DerivativesTelemetryStrip.svelte';
  import WorkspaceLayoutMenu from './header/WorkspaceLayoutMenu.svelte';
  import ActionsMenu from './header/ActionsMenu.svelte';
  import TimeframeSelector from './header/TimeframeSelector.svelte';
  import PriceStylePicker from './header/PriceStylePicker.svelte';
  import SnapshotMenu from './header/SnapshotMenu.svelte';
  import SymbolLogo from './common/SymbolLogo.svelte';
  import { parseAdaptiveSymbol } from '../services/market/symbolSearchService';

  interface Props {
    activeSymbol: string;
    activeTimeframe: Timeframe;
    currentLayout: string;
    activeProviderId?: string;
    syncConfig?: MultiChartSyncConfig;
    activeIndicators?: { title: string; source?: string; visible: boolean }[];
    isDrawingToolbarVisible?: boolean;
    isReplayActive?: boolean;
    favoriteTimeframes?: Timeframe[];
    customTimeframes?: string[];
    onFavoriteTimeframesChange?: (tfs: Timeframe[]) => void;
    onCustomTimeframesChange?: (customs: string[]) => void;
    onTimeframeChange: (tf: Timeframe) => void;
    onLayoutChange: (layout: string) => void;
    onProviderChange?: (providerId: string) => void;
    activeWorkspace?: SavedWorkspace | null;
    isAutoSaveWorkspace?: boolean;
    onToggleAutoSaveWorkspace?: () => void;
    onSaveWorkspace?: (name: string, overwriteId?: string) => boolean | void | Promise<boolean | void>;
    onLoadWorkspace?: (w: SavedWorkspace) => void;
    onNewWorkspace?: () => void;
    onLog?: (msg: string, level?: 'info' | 'success' | 'warn' | 'error') => void;
    onToggleSyncCrosshair?: () => void;
    onToggleSyncViewport?: () => void;
    onToggleSyncSymbol?: () => void;
    onToggleSyncDrawings?: () => void;
    onToggleSyncIndicators?: () => void;
    onToggleSyncStyle?: () => void;
    onToggleDrawingToolbar?: () => void;
    onToggleReplay?: () => void;
    onOpenIndicatorModal: () => void;
    onOpenSettingsModal?: (
      tab?: 'general' | 'appearance' | 'chart' | 'feed' | 'system' | 'about' | 'help'
    ) => void;
    onOpenSymbolSearch?: () => void;
    onRequestQuickCopySnapshot?: () => void;
    onRequestQuickDownloadSnapshot?: () => void;
    onOpenSnapshotPreview?: () => void;
    snapshotScaleMultiplier?: import('../types/market').SnapshotScaleMultiplier;
    onSnapshotScaleMultiplierChange?: (
      scale: import('../types/market').SnapshotScaleMultiplier
    ) => void;
    isSnapshotProcessing?: boolean;
    chartDimensions?: { width: number; height: number };
    colorModePreference?: ColorModePreference;
    systemIsDark?: boolean;
    onCycleColorMode?: () => void;
    onColorModeChange?: (mode: ColorModePreference) => void;
    isWatchlisted?: boolean;
    onToggleActiveWatchlist?: () => void;
    activePriceStyle?: PriceStyle | string;
    onPriceStyleChange?: (style: PriceStyle) => void;
    hollowCandles?: boolean;
    onToggleHollowCandles?: () => void;
    // Props opsional baru untuk Quick Chart Tabs & Derivatives Telemetry (#227)
    chartTabs?: ChartTabItem[];
    activeChartTabId?: string;
    onSelectChartTab?: (tabId: string) => void;
    onAddChartTab?: () => void;
    onCloseChartTab?: (tabId: string) => void;
    onReorderChartTabs?: (fromIndex: number, toIndex: number) => void;
    telemetrySnapshot?: DerivativesTelemetrySnapshot | null;
    livePrice?: number | null;
    liveChange24h?: number | null;
  }

  let {
    activeSymbol,
    activeTimeframe,
    currentLayout,
    activeProviderId = 'binance',
    syncConfig = { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    activeIndicators = [],
    isDrawingToolbarVisible = true,
    isReplayActive = false,
    favoriteTimeframes = ['1m', '5m', '15m', '1h', '4h', '1D'],
    customTimeframes = [],
    onFavoriteTimeframesChange,
    onCustomTimeframesChange,
    onTimeframeChange,
    onLayoutChange,
    onProviderChange,
    activeWorkspace = null,
    isAutoSaveWorkspace = true,
    onToggleAutoSaveWorkspace,
    onSaveWorkspace,
    onLoadWorkspace,
    onNewWorkspace,
    onLog,
    onToggleSyncCrosshair,
    onToggleSyncViewport,
    onToggleSyncSymbol,
    onToggleSyncDrawings,
    onToggleSyncIndicators,
    onToggleSyncStyle,
    onToggleDrawingToolbar,
    onToggleReplay,
    onOpenIndicatorModal,
    onOpenSettingsModal,
    onOpenSymbolSearch,
    onRequestQuickCopySnapshot,
    onRequestQuickDownloadSnapshot,
    onOpenSnapshotPreview,
    snapshotScaleMultiplier,
    onSnapshotScaleMultiplierChange,
    isSnapshotProcessing = false,
    chartDimensions,
    colorModePreference = 'system',
    systemIsDark = true,
    onCycleColorMode,
    onColorModeChange,
    isWatchlisted = false,
    onToggleActiveWatchlist,
    activePriceStyle = 'candles',
    onPriceStyleChange,
    hollowCandles = false,
    onToggleHollowCandles,
    chartTabs,
    activeChartTabId,
    onSelectChartTab,
    onAddChartTab,
    onCloseChartTab,
    onReorderChartTabs,
    telemetrySnapshot,
    livePrice = null,
    liveChange24h = null,
  }: Props = $props();

  function handleCycleColorMode() {
    if (onCycleColorMode) {
      onCycleColorMode();
    } else if (onColorModeChange) {
      onColorModeChange(getNextColorMode(colorModePreference));
    }
  }

  const colorModeTooltip = $derived.by(() => {
    if (colorModePreference === 'dark') {
      return 'Mode Gelap (Klik untuk beralih ke Mode Terang)';
    }
    if (colorModePreference === 'light') {
      return 'Mode Terang (Klik untuk beralih ke Ikuti Sistem)';
    }
    return `Ikuti Sistem (${systemIsDark ? 'Gelap' : 'Terang'}) (Klik untuk beralih ke Mode Gelap)`;
  });

  let updateState = $state<UpdateState>(updateService.getSnapshot());
  let unsubUpdate: (() => void) | null = null;
  let isProviderDropdownOpen = $state(false);
  let availableProviders = $state<ProviderConfig[]>([]);

  const localTelemetryService = new DerivativesTelemetryService();
  let localTelemetrySnapshot = $state<DerivativesTelemetrySnapshot | null>(null);
  let unsubTelemetry: (() => void) | null = null;

  const activeParsedSymbol = $derived(parseAdaptiveSymbol(activeSymbol));

  const resolvedTabs = $derived.by<ChartTabItem[]>(() => {
    if (chartTabs && chartTabs.length > 0) return chartTabs;
    return [
      {
        id: 'active-fallback',
        symbol: activeSymbol,
        providerId: activeProviderId,
        timeframe: activeTimeframe,
      },
    ];
  });

  const resolvedActiveTabId = $derived(
    activeChartTabId && resolvedTabs.some((t) => t.id === activeChartTabId)
      ? activeChartTabId
      : resolvedTabs[0]?.id || 'active-fallback'
  );

  const resolvedTelemetry = $derived(
    telemetrySnapshot !== undefined ? telemetrySnapshot : localTelemetrySnapshot
  );

  $effect(() => {
    if (telemetrySnapshot !== undefined) {
      localTelemetryService.stopPolling();
      return;
    }
    localTelemetryService.startPolling(activeSymbol, activeProviderId);
  });

  onMount(() => {
    unsubUpdate = updateService.subscribe((s) => {
      updateState = s;
    });
    unsubTelemetry = localTelemetryService.subscribe((snap) => {
      localTelemetrySnapshot = snap;
    });
  });

  onDestroy(() => {
    if (unsubUpdate) unsubUpdate();
    if (unsubTelemetry) unsubTelemetry();
    localTelemetryService.stopPolling();
  });
</script>

<header class="header-shell">
  <TopTabBar
    tabs={resolvedTabs}
    activeTabId={resolvedActiveTabId}
    onSelectTab={onSelectChartTab}
    onAddTab={onAddChartTab ?? onOpenSymbolSearch}
    onCloseTab={onCloseChartTab}
    onReorderTabs={onReorderChartTabs}
    {onOpenSymbolSearch}
    {updateState}
    {colorModePreference}
    {colorModeTooltip}
    onCycleColorMode={handleCycleColorMode}
    {onOpenSettingsModal}
  />

  <div class="chart-sub-header">
    <!-- Simbol Aktif, Quick Watchlist & Provider Switcher -->
    <div class="symbol-section">
      <button
        type="button"
        class="symbol-badge-btn"
        title="Klik atau tekan Ctrl+K untuk mencari simbol koin & pair"
        onclick={() => onOpenSymbolSearch?.()}
      >
        <SymbolLogo
          baseAsset={activeParsedSymbol.baseAsset}
          quoteAsset={activeParsedSymbol.quoteAsset}
          symbol={activeSymbol}
          provider={activeProviderId}
          size="sm"
        />
        <span class="active-sym-title mono-nums">{activeSymbol}</span>
      </button>

      <button
        type="button"
        class="watchlist-star-btn {isWatchlisted ? 'active' : ''}"
        aria-pressed={isWatchlisted}
        aria-label={isWatchlisted
          ? `Hapus ${activeSymbol} dari Watchlist Aktif`
          : `Tambahkan ${activeSymbol} ke Watchlist Aktif`}
        title={isWatchlisted ? 'Hapus dari Watchlist Aktif' : 'Tambahkan ke Watchlist Aktif'}
        onclick={() => onToggleActiveWatchlist?.()}
      >
        <Star size={13} fill={isWatchlisted ? 'currentColor' : 'none'} />
      </button>

      <div class="provider-dropdown-container">
        <button
          type="button"
          class="provider-pill-btn {activeProviderId}"
          title="Ganti Bursa / Data Feed Aktif"
          onclick={(e) => {
            e.stopPropagation();
            isProviderDropdownOpen = !isProviderDropdownOpen;
            if (isProviderDropdownOpen) {
              marketFeed.getSavedProviders().then((res) => (availableProviders = res));
            }
          }}
        >
          <span>{activeProviderId.toUpperCase()}</span>
          <ChevronDown size={10} />
        </button>

        {#if activeProviderId === 'yahoo'}
          <span
            class="delayed-badge mono-nums"
            title="Data Yahoo Finance (Saham Indo IDX & US) mengalami jeda waktu ~15 menit sesuai regulasi bursa"
          >
            DELAYED 15M
          </span>
        {:else if activeProviderId === 'macro'}
          <span
            class="synthetic-badge mono-nums"
            title="Indeks makro dihitung lokal dari basket terkalibrasi (CoinGecko + DefiLlama + Binance/Coinbase) hanya saat grafik ini aktif"
          >
            SYNTHETIC (~1Y)
          </span>
        {/if}

        {#if isProviderDropdownOpen}
          <div
            class="provider-backdrop"
            onclick={() => (isProviderDropdownOpen = false)}
            role="presentation"
          ></div>
          <div
            class="provider-dropdown-menu obsidian-panel"
            role="menu"
            tabindex="-1"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => {
              if (e.key === 'Escape') isProviderDropdownOpen = false;
            }}
          >
            <div class="provider-dropdown-header">
              <span>BURSA / DATA FEED</span>
            </div>
            {#if activeProviderId === 'macro'}
              <div class="provider-macro-note">
                Indeks makro selalu dirutekan otomatis ke Synthetic Basket lokal saat grafik dibuka.
              </div>
            {/if}
            <div class="provider-list">
              {#each availableProviders as prov (prov.id)}
                <button
                  type="button"
                  class="provider-menu-item {activeProviderId === prov.id ? 'active' : ''}"
                  onclick={() => {
                    onProviderChange?.(prov.id);
                    isProviderDropdownOpen = false;
                  }}
                >
                  <div class="prov-name-col">
                    <span class="prov-name">{prov.name}</span>
                    <span class="prov-id mono-nums">{prov.id}</span>
                  </div>
                  {#if activeProviderId === prov.id}
                    <Check size={12} class="check-icon" />
                  {/if}
                </button>
              {/each}
            </div>
            <div class="provider-dropdown-footer">
              <button
                type="button"
                class="add-custom-feed-link"
                onclick={() => {
                  isProviderDropdownOpen = false;
                  onOpenSettingsModal?.('feed');
                }}
              >
                + Pengaturan Feed & Custom Node...
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="divider"></div>

    <TimeframeSelector
      {activeTimeframe}
      {favoriteTimeframes}
      {customTimeframes}
      {onTimeframeChange}
      {onFavoriteTimeframesChange}
      {onCustomTimeframesChange}
    />

    <div class="divider"></div>

    <PriceStylePicker
      {activePriceStyle}
      onPriceStyleChange={(style) => onPriceStyleChange?.(style)}
      {hollowCandles}
      {onToggleHollowCandles}
    />

    <div class="divider"></div>

    <DerivativesTelemetryStrip
      snapshot={resolvedTelemetry}
      {livePrice}
      {liveChange24h}
    />

    <div class="spacer"></div>

    <WorkspaceLayoutMenu
      {currentLayout}
      {onLayoutChange}
      {activeWorkspace}
      {isAutoSaveWorkspace}
      {onToggleAutoSaveWorkspace}
      {onSaveWorkspace}
      {onLoadWorkspace}
      {onNewWorkspace}
      {onLog}
    />

    <div class="divider"></div>

    <ActionsMenu
      {isReplayActive}
      {isDrawingToolbarVisible}
      {currentLayout}
      {syncConfig}
      {onToggleReplay}
      {onToggleDrawingToolbar}
      {onToggleSyncCrosshair}
      {onToggleSyncViewport}
      {onToggleSyncSymbol}
      {onToggleSyncDrawings}
      {onToggleSyncIndicators}
      {onToggleSyncStyle}
    />

    <div class="divider"></div>

    <div class="actions-section">
      <button
        type="button"
        class="action-btn indicator-header-btn {activeIndicators && activeIndicators.length > 0 ? 'has-active' : ''}"
        title="Buka Perpustakaan Indikator Teknikal (Pine Script v6)"
        onclick={onOpenIndicatorModal}
      >
        <Layers
          size={13}
          class={activeIndicators && activeIndicators.length > 0 ? 'text-brand' : 'text-cyan-accent'}
        />
        <span>Indikator</span>
        {#if activeIndicators && activeIndicators.length > 0}
          <span class="count-badge mono-nums">{activeIndicators.length}</span>
        {/if}
      </button>

      <SnapshotMenu
        {onRequestQuickCopySnapshot}
        {onRequestQuickDownloadSnapshot}
        {onOpenSnapshotPreview}
        currentScaleMultiplier={snapshotScaleMultiplier}
        onScaleMultiplierChange={onSnapshotScaleMultiplierChange}
        isProcessing={isSnapshotProcessing}
        {chartDimensions}
      />
    </div>
  </div>
</header>

<style>
  .header-shell {
    display: flex;
    flex-direction: column;
    background-color: var(--bg-surface);
    border-bottom: 1px solid var(--border-hairline);
    z-index: 100;
  }

  .chart-sub-header {
    height: 36px;
    background-color: var(--bg-surface);
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 7px;
  }

  .divider {
    width: 1px;
    height: 16px;
    background-color: var(--border-hairline);
    flex-shrink: 0;
  }

  .symbol-section {
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative;
    flex-shrink: 0;
  }

  .symbol-badge-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    height: 26px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .symbol-badge-btn:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .active-sym-title {
    font-size: var(--font-size-md, 12px);
    font-weight: 700;
    color: var(--text-main);
    letter-spacing: 0.02em;
  }

  .watchlist-star-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .watchlist-star-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .watchlist-star-btn.active {
    color: var(--status-warn);
    border-color: color-mix(in srgb, var(--status-warn) 40%, transparent);
    background-color: color-mix(in srgb, var(--status-warn) 12%, transparent);
  }

  .watchlist-star-btn.active:hover {
    background-color: color-mix(in srgb, var(--status-warn) 20%, transparent);
    border-color: color-mix(in srgb, var(--status-warn) 65%, transparent);
  }

  .provider-dropdown-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .provider-pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-xs, 9px);
    font-weight: 700;
    padding: 3px 6px;
    height: 26px;
    border-radius: var(--radius-xs);
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: all 0.15s ease;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
  }

  .provider-pill-btn.binance {
    background-color: rgba(243, 186, 47, 0.12);
    color: #f3ba2f;
    border-color: rgba(243, 186, 47, 0.3);
  }

  .delayed-badge {
    font-size: 8.5px;
    font-weight: 700;
    color: #f59e0b;
    background-color: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    padding: 2px 6px;
    border-radius: var(--radius-xs, 2px);
    letter-spacing: 0.04em;
    white-space: nowrap;
    align-self: center;
  }

  .provider-pill-btn.macro {
    background-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 12%, transparent);
    color: var(--brand-cyan, #38bdf8);
    border-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 32%, transparent);
  }

  .synthetic-badge {
    font-size: 8.5px;
    font-weight: 700;
    color: var(--brand-cyan, #38bdf8);
    background-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-cyan, #38bdf8) 32%, transparent);
    padding: 2px 6px;
    border-radius: var(--radius-xs, 2px);
    letter-spacing: 0.04em;
    white-space: nowrap;
    align-self: center;
  }

  .provider-macro-note {
    padding: 6px 10px;
    font-size: 10px;
    line-height: 1.35;
    color: var(--brand-cyan, #38bdf8);
    background-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 8%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--brand-cyan, #38bdf8) 18%, transparent);
  }

  .provider-pill-btn.bitunix {
    background-color: rgba(14, 165, 233, 0.12);
    color: #38bdf8;
    border-color: rgba(14, 165, 233, 0.3);
  }

  .provider-pill-btn.indodax {
    background-color: rgba(37, 99, 235, 0.15);
    color: #60a5fa;
    border-color: rgba(37, 99, 235, 0.35);
  }

  .provider-pill-btn:hover {
    filter: brightness(1.15);
  }

  .provider-backdrop {
    position: fixed;
    inset: 0;
    z-index: 199;
  }

  .provider-dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 240px;
    background-color: var(--bg-surface, #121820);
    border: 1px solid var(--border-medium, #2a3441);
    border-radius: var(--radius-xs, 4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    z-index: 200;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .provider-dropdown-header {
    padding: 6px 10px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-dim, #64748b);
    border-bottom: 1px solid var(--border-hairline, #1f2733);
    background-color: var(--bg-panel, #0f141c);
  }

  .provider-list {
    display: flex;
    flex-direction: column;
    max-height: 220px;
    overflow-y: auto;
  }

  .provider-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.12s ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .provider-menu-item:hover {
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.06));
  }

  .provider-menu-item.active {
    background-color: rgba(0, 240, 144, 0.08);
  }

  .prov-name-col {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .prov-name {
    font-size: var(--font-size-base, 11px);
    font-weight: 600;
    color: var(--text-main, #f1f5f9);
  }

  .prov-id {
    font-size: var(--font-size-xs, 9px);
    color: var(--text-dim, #64748b);
  }

  :global(.check-icon) {
    color: var(--brand-primary, #00f090);
  }

  .provider-dropdown-footer {
    padding: 6px 10px;
    border-top: 1px solid var(--border-hairline, #1f2733);
    background-color: var(--bg-panel, #0f141c);
  }

  .add-custom-feed-link {
    background: none;
    border: none;
    font-size: var(--font-size-sm, 10px);
    font-weight: 600;
    color: var(--brand-primary, #00f090);
    cursor: pointer;
    padding: 0;
    display: block;
    width: 100%;
    text-align: left;
  }

  .add-custom-feed-link:hover {
    text-decoration: underline;
  }

  .spacer {
    flex: 1;
    min-width: 8px;
  }

  .actions-section {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    height: 26px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: var(--font-size-base, 11px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .indicator-header-btn {
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.25);
  }

  .indicator-header-btn:hover {
    background-color: rgba(56, 189, 248, 0.12);
    color: #ffffff;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.2);
  }

  .indicator-header-btn.has-active {
    color: var(--brand-primary, #00f090);
    border-color: rgba(0, 240, 144, 0.35);
    background-color: rgba(0, 240, 144, 0.08);
  }

  .indicator-header-btn .count-badge {
    background: var(--brand-primary, #00f090);
    color: var(--on-brand-primary, #000000);
    font-size: 9px;
    font-weight: 700;
    padding: 0 4.5px;
    height: 14px;
    border-radius: 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    margin-left: 2px;
  }

  .text-brand {
    color: var(--brand-primary, #00f090);
  }

  .text-cyan-accent {
    color: #38bdf8;
  }
</style>
