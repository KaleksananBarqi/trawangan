<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Activity,
    Code,
    Search,
    Bell,
    Flame,
    Settings,
    Maximize2,
    Layers,
    Sparkles,
    ChevronDown,
    Check
  } from '@lucide/svelte';
  import type {
    Timeframe,
    MultiChartSyncConfig,
    WorkspaceMode,
    SavedWorkspace,
    ProviderConfig
  } from '../types/market';
  import { updateService, type UpdateState } from '../services/updateService';
  import { marketFeed } from '../services/market';

  // Subkomponen modular header baru yang ringkas dan terpadu
  import WorkspaceLayoutMenu from './header/WorkspaceLayoutMenu.svelte';
  import ActionsMenu from './header/ActionsMenu.svelte';
  import TimeframeSelector from './header/TimeframeSelector.svelte';
  import SnapshotMenu from './header/SnapshotMenu.svelte';
  import SymbolLogo from './common/SymbolLogo.svelte';
  import { parseAdaptiveSymbol } from '../services/market/symbolSearchService';

  interface Props {
    activeSymbol: string;
    activeTimeframe: Timeframe;
    currentLayout: string;
    activeProviderId?: string;
    workspaceMode?: WorkspaceMode;
    syncConfig?: MultiChartSyncConfig;
    activeIndicators?: { title: string; source?: string; visible: boolean }[];
    isDrawingToolbarVisible?: boolean;
    isWatchlistOpen?: boolean;
    isReplayActive?: boolean;
    favoriteTimeframes?: Timeframe[];
    customTimeframes?: string[];
    onFavoriteTimeframesChange?: (tfs: Timeframe[]) => void;
    onCustomTimeframesChange?: (customs: string[]) => void;
    onSymbolChange?: (sym: string) => void;
    onTimeframeChange: (tf: Timeframe) => void;
    onLayoutChange: (layout: string) => void;
    onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
    onProviderChange?: (providerId: string) => void;
    activeWorkspace?: SavedWorkspace | null;
    isAutoSaveWorkspace?: boolean;
    onToggleAutoSaveWorkspace?: () => void;
    onSaveWorkspace?: (name: string, overwriteId?: string) => void;
    onLoadWorkspace?: (w: SavedWorkspace) => void;
    onNewWorkspace?: () => void;
    onToggleSyncCrosshair?: () => void;
    onToggleSyncViewport?: () => void;
    onToggleSyncSymbol?: () => void;
    onToggleSyncDrawings?: () => void;
    onToggleSyncIndicators?: () => void;
    onToggleDrawingToolbar?: () => void;
    onToggleWatchlist?: () => void;
    onToggleReplay?: () => void;
    onOpenIndicatorModal: () => void;
    onOpenImportPlan?: () => void;
    activePlansCount?: number;
    onOpenSettingsModal?: (tab?: 'general' | 'appearance' | 'chart' | 'feed' | 'system' | 'about' | 'help') => void;
    onRequestCreateAlert?: () => void;
    onOpenSymbolSearch?: () => void;
    onRequestQuickCopySnapshot?: () => void;
    onRequestQuickDownloadSnapshot?: () => void;
    onOpenSnapshotPreview?: () => void;
    snapshotScaleMultiplier?: import('../types/market').SnapshotScaleMultiplier;
    onSnapshotScaleMultiplierChange?: (scale: import('../types/market').SnapshotScaleMultiplier) => void;
    isSnapshotProcessing?: boolean;
    chartDimensions?: { width: number; height: number };
    // Props opsional lama agar backward-compatible
    ticker?: any;
    watchlistSymbols?: string[];
    quickSymbolsConfig?: any;
    onQuickSymbolsConfigChange?: any;
  }

  let {
    activeSymbol,
    activeTimeframe,
    currentLayout,
    activeProviderId = 'binance',
    workspaceMode = 'terminal',
    syncConfig = { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    activeIndicators = [],
    isDrawingToolbarVisible = true,
    isWatchlistOpen = true,
    isReplayActive = false,
    favoriteTimeframes = ['1m', '5m', '15m', '1h', '4h', '1D'],
    customTimeframes = [],
    onFavoriteTimeframesChange,
    onCustomTimeframesChange,
    onTimeframeChange,
    onLayoutChange,
    onWorkspaceModeChange,
    onProviderChange,
    activeWorkspace = null,
    isAutoSaveWorkspace = true,
    onToggleAutoSaveWorkspace,
    onSaveWorkspace,
    onLoadWorkspace,
    onNewWorkspace,
    onToggleSyncCrosshair,
    onToggleSyncViewport,
    onToggleSyncSymbol,
    onToggleSyncDrawings,
    onToggleSyncIndicators,
    onToggleDrawingToolbar,
    onToggleWatchlist,
    onToggleReplay,
    onOpenIndicatorModal,
    onOpenImportPlan,
    activePlansCount = 0,
    onOpenSettingsModal,
    onRequestCreateAlert,
    onOpenSymbolSearch,
    onRequestQuickCopySnapshot,
    onRequestQuickDownloadSnapshot,
    onOpenSnapshotPreview,
    snapshotScaleMultiplier,
    onSnapshotScaleMultiplierChange,
    isSnapshotProcessing = false,
    chartDimensions
  }: Props = $props();

  let updateState = $state<UpdateState>(updateService.getSnapshot());
  let unsubUpdate: (() => void) | null = null;
  let isProviderDropdownOpen = $state(false);
  let availableProviders = $state<ProviderConfig[]>([]);

  const activeParsedSymbol = $derived(parseAdaptiveSymbol(activeSymbol));

  onMount(() => {
    unsubUpdate = updateService.subscribe((s) => {
      updateState = s;
    });
  });

  onDestroy(() => {
    if (unsubUpdate) unsubUpdate();
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
</script>

<header class="header">
  <!-- Brand & Logo -->
  <div class="brand-section">
    <div class="brand-badge" title="trawangan · Professional Crypto Charting Terminal">
      <img src="/no background.svg" alt="trawangan logo" class="brand-logo-img" />
      <span class="brand-title">trawangan</span>
    </div>
    <span class="version-tag">terminal</span>
  </div>

  <div class="divider"></div>

  <!-- Workspace Mode Switcher (Dual Mode Switcher) -->
  <div class="mode-switcher">
    <button
      class="mode-btn {workspaceMode === 'terminal' ? 'active' : ''}"
      title="Mode Trading Terminal (Chart, Watchlist, Orderflow)"
      onclick={() => onWorkspaceModeChange?.('terminal')}
    >
      <Activity size={12} />
      <span>Terminal</span>
    </button>
    <button
      class="mode-btn {workspaceMode === 'pine' ? 'active' : ''}"
      title="Mode Pine Script v6 IDE & Backtester"
      onclick={() => onWorkspaceModeChange?.('pine')}
    >
      <Code size={12} />
      <span>Pine IDE</span>
    </button>
  </div>

  <div class="divider"></div>

  <!-- Simbol Aktif Minimalis & Quick Provider Switcher -->
  <div class="symbol-section">
    <button
      class="symbol-badge-btn"
      title="Klik atau tekan Ctrl+K untuk mencari simbol koin & pair"
      onclick={() => onOpenSymbolSearch?.()}
    >
      <SymbolLogo baseAsset={activeParsedSymbol.baseAsset} quoteAsset={activeParsedSymbol.quoteAsset} size="sm" />
      <span class="active-sym-title mono-nums">{activeSymbol}</span>
      <span class="kbd-hint mono-nums">Ctrl+K</span>
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

      {#if isProviderDropdownOpen}
        <!-- Backdrop klik luar -->
        <div
          class="provider-backdrop"
          onclick={() => (isProviderDropdownOpen = false)}
          role="presentation"
        ></div>
        <div
          class="provider-dropdown-menu obsidian-panel"
          onclick={(e) => e.stopPropagation()}
          role="menu"
        >
          <div class="provider-dropdown-header">
            <span>BURSA / DATA FEED</span>
          </div>
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

  <!-- Timeframe Selector & Favorit Bar -->
  <TimeframeSelector
    {activeTimeframe}
    {favoriteTimeframes}
    {customTimeframes}
    {onTimeframeChange}
    {onFavoriteTimeframesChange}
    {onCustomTimeframesChange}
  />

  <div class="spacer"></div>

  <!-- Multi-Chart Layout & Manajemen Workspace Terpadu -->
  <WorkspaceLayoutMenu
    {currentLayout}
    {onLayoutChange}
    {activeWorkspace}
    {isAutoSaveWorkspace}
    {onToggleAutoSaveWorkspace}
    {onSaveWorkspace}
    {onLoadWorkspace}
    {onNewWorkspace}
  />

  <div class="divider"></div>

  <!-- Actions Terpadu (Indikator, Replay, Draw, Sinkronisasi Multi-Chart) -->
  <ActionsMenu
    {activeIndicators}
    {isReplayActive}
    {isDrawingToolbarVisible}
    {currentLayout}
    {syncConfig}
    {onOpenIndicatorModal}
    {onRequestCreateAlert}
    {onToggleReplay}
    {onToggleDrawingToolbar}
    {onToggleSyncCrosshair}
    {onToggleSyncViewport}
    {onToggleSyncSymbol}
    {onToggleSyncDrawings}
    {onToggleSyncIndicators}
  />

  <div class="divider"></div>

  <!-- Quick Utility Actions (Kanan Header) -->
  <div class="actions-section">
    <!-- Tombol Langsung Indikator Modal -->
    <button
      class="action-btn indicator-header-btn {activeIndicators && activeIndicators.length > 0 ? 'has-active' : ''}"
      title="Buka Perpustakaan Indikator Teknikal (Pine Script v6)"
      onclick={onOpenIndicatorModal}
    >
      <Layers size={13} class={activeIndicators && activeIndicators.length > 0 ? 'text-brand' : 'text-cyan-accent'} />
      <span>Indikator</span>
      {#if activeIndicators && activeIndicators.length > 0}
        <span class="count-badge mono-nums">{activeIndicators.length}</span>
      {/if}
    </button>

    <!-- Tombol Input Trade Plan (Deterministic Ingestion) (#117) -->
    <button
      class="action-btn indicator-header-btn plan-header-btn {activePlansCount > 0 ? 'has-active' : ''}"
      title="Input & Import Trading Plan (Ctrl+Shift+P)"
      onclick={() => onOpenImportPlan?.()}
    >
      <Sparkles size={13} class={activePlansCount > 0 ? 'text-brand' : 'text-cyan-accent'} />
      <span>Trade Plan</span>
      {#if activePlansCount > 0}
        <span class="count-badge mono-nums">{activePlansCount}</span>
      {/if}
    </button>

    <!-- Snapshot Camera Action & Popover Menu (#125) -->
    <SnapshotMenu
      {onRequestQuickCopySnapshot}
      {onRequestQuickDownloadSnapshot}
      {onOpenSnapshotPreview}
      currentScaleMultiplier={snapshotScaleMultiplier}
      onScaleMultiplierChange={onSnapshotScaleMultiplierChange}
      isProcessing={isSnapshotProcessing}
      {chartDimensions}
    />


    <!-- Update Notification Pill (Muncul saat rilis baru tersedia) -->
    {#if updateState.status === 'available' && updateState.updateInfo}
      <button
        class="action-btn update-pill mono-nums"
        title="Versi baru {updateState.updateInfo.latestTag} tersedia! Klik untuk melihat rilis."
        onclick={() => onOpenSettingsModal?.('about')}
      >
        <Sparkles size={13} class="update-sparkle-icon" />
        <span>Update {updateState.updateInfo.latestTag}</span>
      </button>
    {/if}

    <!-- Settings & Help Modal -->
    <button
      class="action-btn"
      title="Buka Pengaturan & Panduan Bantuan"
      onclick={() => onOpenSettingsModal?.('general')}
    >
      <Settings size={13} />
      <span>Setting</span>
    </button>

    <!-- Fullscreen Toggle -->
    <button
      class="action-btn icon-only"
      title="Toggle Layar Penuh"
      onclick={toggleFullscreen}
    >
      <Maximize2 size={13} />
    </button>
  </div>
</header>

<style>
  .header {
    height: 40px;
    background-color: var(--bg-surface);
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 7px;
    border-bottom: 1px solid var(--border-hairline);
    z-index: 100;
  }

  .update-pill {
    background: rgba(255, 105, 180, 0.15) !important;
    border-color: rgba(255, 105, 180, 0.5) !important;
    color: var(--brand-primary) !important;
    font-weight: 700 !important;
    box-shadow: 0 0 10px rgba(255, 105, 180, 0.25);
    animation: headerPulse 2.5s infinite;
  }

  .update-pill:hover {
    background: rgba(255, 105, 180, 0.25) !important;
    border-color: var(--brand-primary) !important;
    transform: translateY(-1px);
    box-shadow: 0 0 15px rgba(255, 105, 180, 0.45);
  }

  :global(.update-sparkle-icon) {
    animation: sparkleSpin 3s linear infinite;
  }

  @keyframes headerPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.75; }
  }

  @keyframes sparkleSpin {
    0% { transform: rotate(0deg); }
    50% { transform: rotate(180deg) scale(1.15); }
    100% { transform: rotate(360deg); }
  }

  .brand-section {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }

  .brand-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    padding: 3px 6px;
    border-radius: var(--radius-xs);
  }

  .brand-logo-img {
    width: 15px;
    height: 15px;
    object-fit: contain;
    display: block;
    filter: drop-shadow(0 0 5px rgba(255, 105, 180, 0.4));
  }

  .brand-title {
    font-family: var(--font-brand);
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-main);
    text-transform: lowercase;
  }

  .version-tag {
    font-family: var(--font-mono);
    font-size: 8.5px;
    font-weight: 600;
    background-color: rgba(255, 105, 180, 0.12);
    color: var(--brand-primary);
    padding: 2px 4.5px;
    border-radius: var(--radius-xs);
    border: 1px solid rgba(255, 105, 180, 0.28);
    letter-spacing: 0.03em;
    text-transform: lowercase;
  }

  .divider {
    width: 1px;
    height: 16px;
    background-color: var(--border-hairline);
    flex-shrink: 0;
  }

  .mode-switcher {
    display: flex;
    align-items: center;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 2px;
    gap: 2px;
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    color: var(--text-main);
  }

  .mode-btn.active {
    background-color: var(--bg-surface);
    color: var(--brand-primary);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }

  .symbol-section {
    display: flex;
    align-items: center;
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

  .search-icon {
    color: var(--text-dim);
  }

  .active-sym-title {
    font-size: var(--font-size-md, 12px);
    font-weight: 700;
    color: var(--text-main);
    letter-spacing: 0.02em;
  }

  .provider-pill {
    font-size: var(--font-size-2xs, 8.5px);
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 2px;
    letter-spacing: 0.03em;
  }

  .symbol-section {
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative;
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

  .search-icon {
    color: var(--text-dim);
  }

  .provider-dropdown-container {
    position: relative;
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

  .kbd-hint {
    font-size: var(--font-size-xs, 9px);
    color: var(--text-dim);
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .spacer {
    flex: 1;
  }

  .actions-section {
    display: flex;
    align-items: center;
    gap: 4px;
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

  .action-btn.active {
    color: var(--brand-primary);
    border-color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.08);
  }

  .action-btn.icon-only {
    padding: 3px 6px;
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
    color: #000000;
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
