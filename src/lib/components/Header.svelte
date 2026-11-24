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
    AppLanguage,
  } from '../types/market';
  import { t, tr } from '../i18n';
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
      tab?: 'general' | 'appearance' | 'chart' | 'feed' | 'broker' | 'system' | 'about' | 'help'
    ) => void;
    language?: AppLanguage;
    onLanguageChange?: (lang: AppLanguage) => void;
    onOpenStartupTutorial?: () => void;
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
    language = 'jv',
    onLanguageChange,
    onOpenStartupTutorial,
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
      return $tr('Mode Peteng (Klik gawe pindah nang Mode Padhang)', 'Mode Gelap (Klik untuk beralih ke Mode Terang)', 'Dark Mode (Click for Light Mode)');
    }
    if (colorModePreference === 'light') {
      return $tr('Mode Padhang (Klik gawe Manut Sistem)', 'Mode Terang (Klik untuk beralih ke Ikuti Sistem)', 'Light Mode (Click for System)');
    }
    return $tr(
      `Manut Sistem (${systemIsDark ? 'Peteng' : 'Padhang'}) (Klik gawe Mode Peteng)`,
      `Ikuti Sistem (${systemIsDark ? 'Gelap' : 'Terang'}) (Klik untuk beralih ke Mode Gelap)`,
      `System (${systemIsDark ? 'Dark' : 'Light'}) (Click for Dark Mode)`
    );
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
    {language}
    {onLanguageChange}
    {onOpenStartupTutorial}
  />

  <div class="chart-sub-header">
    <!-- Simbol Aktif, Quick Watchlist & Provider Switcher -->
    <div class="symbol-section">
      <button
        type="button"
        class="symbol-badge-btn"
        title={$tr('Klik utawa pencet Ctrl+K gawe golek koin & pair', 'Klik atau tekan Ctrl+K untuk mencari simbol koin & pair', 'Click or press Ctrl+K to search symbols & pairs')}
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
          ? $tr(`Busek ${activeSymbol} teko Watchlist Aktif`, `Hapus ${activeSymbol} dari Watchlist Aktif`, `Remove ${activeSymbol} from Active Watchlist`)
          : $tr(`Lebokno ${activeSymbol} nang Watchlist Aktif`, `Tambahkan ${activeSymbol} ke Watchlist Aktif`, `Add ${activeSymbol} to Active Watchlist`)}
        title={isWatchlisted
          ? $tr('Busek teko Watchlist Aktif', 'Hapus dari Watchlist Aktif', 'Remove from Active Watchlist')
          : $tr('Lebokno nang Watchlist Aktif', 'Tambahkan ke Watchlist Aktif', 'Add to Active Watchlist')}
        onclick={() => onToggleActiveWatchlist?.()}
      >
        <Star size={13} fill={isWatchlisted ? 'currentColor' : 'none'} />
      </button>

      <div class="provider-dropdown-container">
        <button
          type="button"
          class="provider-pill-btn {activeProviderId}"
          title={$t('header.providerSwitch')}
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
              <span>{$tr('BURSA / SUMBER DATA', 'BURSA / DATA FEED', 'EXCHANGE / DATA FEED')}</span>
            </div>
            {#if activeProviderId === 'macro'}
              <div class="provider-macro-note">
                {$tr('Indeks makro mesthi diarahno otomatis nang Synthetic Basket lokal pas chart dibukak.', 'Indeks makro selalu dirutekan otomatis ke Synthetic Basket lokal saat grafik dibuka.', 'Macro indices automatically route to the local Synthetic Basket when opened.')}
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
                {$tr('+ Setelan Feed & Custom Node...', '+ Pengaturan Feed & Custom Node...', '+ Feed Settings & Custom Node...')}
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
        title={$tr('Bukak Katalog Indikator Teknikal (Pine Script v6)', 'Buka Perpustakaan Indikator Teknikal (Pine Script v6)', 'Open Technical Indicator Library (Pine Script v6)')}
        onclick={onOpenIndicatorModal}
      >
        <Layers
          size={13}
          class={activeIndicators && activeIndicators.length > 0 ? 'text-brand' : 'text-cyan-accent'}
        />
        <span>{$t('header.indicators')}</span>
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
    background-color: var(--bg-container);
    border: none;
    z-index: 100;
  }

  .chart-sub-header {
    height: 36px;
    background-color: var(--bg-container);
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 7px;
  }

  .divider {
    width: 1px;
    height: 14px;
    background-color: var(--border-subtle);
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
    padding: 3px 9px;
    height: 26px;
    background-color: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-sm, 5px);
    cursor: pointer;
    transition: background-color 0.14s ease;
  }

  .symbol-badge-btn:hover {
    background-color: var(--bg-hover);
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
    background-color: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-sm, 5px);
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  .watchlist-star-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .watchlist-star-btn.active {
    color: var(--status-warn);
    background-color: color-mix(in srgb, var(--status-warn) 14%, transparent);
  }

  .watchlist-star-btn.active:hover {
    background-color: color-mix(in srgb, var(--status-warn) 22%, transparent);
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
    padding: 3px 7px;
    height: 26px;
    border-radius: var(--radius-sm, 5px);
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: background-color 0.14s ease, color 0.14s ease;
    background-color: var(--bg-elevated);
    border: none;
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
    color: var(--brand-primary);
  }

  .provider-dropdown-footer {
    padding: 6px 10px;
    border-top: 1px solid var(--border-subtle);
    background-color: var(--bg-panel);
  }

  .add-custom-feed-link {
    background: none;
    border: none;
    font-size: var(--font-size-sm, 10px);
    font-weight: 600;
    color: var(--brand-primary);
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
    padding: 3px 9px;
    height: 26px;
    background-color: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-sm, 5px);
    color: var(--text-muted);
    font-size: var(--font-size-base, 11px);
    cursor: pointer;
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  .action-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .indicator-header-btn {
    color: var(--brand-cyan);
  }

  .indicator-header-btn:hover {
    background-color: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    color: var(--text-main);
  }

  .indicator-header-btn.has-active {
    color: var(--brand-primary);
    background-color: color-mix(in srgb, var(--brand-primary) 12%, transparent);
  }

  .indicator-header-btn .count-badge {
    background: var(--brand-primary);
    color: var(--on-brand-primary);
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
    color: var(--brand-primary);
  }

  .text-cyan-accent {
    color: var(--brand-cyan);
  }
</style>
