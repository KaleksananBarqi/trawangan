<script lang="ts">
  import {
    Activity,
    Code,
    Search,
    Bell,
    Flame,
    Settings,
    Maximize2,
    Layers
  } from '@lucide/svelte';
  import type {
    Timeframe,
    MultiChartSyncConfig,
    WorkspaceMode,
    SavedWorkspace
  } from '../types/market';

  // Subkomponen modular header baru yang ringkas dan terpadu
  import WorkspaceLayoutMenu from './header/WorkspaceLayoutMenu.svelte';
  import ActionsMenu from './header/ActionsMenu.svelte';
  import TimeframeSelector from './header/TimeframeSelector.svelte';

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
    onOpenSettingsModal?: () => void;
    onRequestCreateAlert?: () => void;
    onOpenSymbolSearch?: () => void;
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
    onOpenSettingsModal,
    onRequestCreateAlert,
    onOpenSymbolSearch
  }: Props = $props();

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

  <!-- Simbol Aktif Minimalis (Klik / Ctrl+K untuk membuka modal cari pair) -->
  <div class="symbol-section">
    <button
      class="symbol-badge-btn"
      title="Klik atau tekan Ctrl+K untuk mencari simbol koin & pair ({activeProviderId.toUpperCase()})"
      onclick={() => onOpenSymbolSearch?.()}
    >
      <Search size={12} class="search-icon" />
      <span class="active-sym-title mono-nums">{activeSymbol}</span>
      <span class="provider-pill {activeProviderId === 'bitunix' ? 'bitunix' : 'binance'}">
        {activeProviderId.toUpperCase()}
      </span>
      <span class="kbd-hint mono-nums">Ctrl+K</span>
    </button>
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

    <!-- Toggle Watchlist Panel -->
    <button
      class="action-btn {isWatchlistOpen ? 'active' : ''}"
      title="Tampilkan / Sembunyikan Panel Kanan"
      onclick={onToggleWatchlist}
    >
      <Flame size={13} />
      <span>Panel</span>
    </button>

    <!-- Settings & Help Modal -->
    <button
      class="action-btn"
      title="Buka Pengaturan & Panduan Bantuan"
      onclick={onOpenSettingsModal}
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
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main);
    letter-spacing: 0.02em;
  }

  .provider-pill {
    font-size: 8.5px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 2px;
    letter-spacing: 0.03em;
  }

  .provider-pill.binance {
    background-color: rgba(243, 186, 47, 0.12);
    color: #f3ba2f;
    border: 1px solid rgba(243, 186, 47, 0.25);
  }

  .provider-pill.bitunix {
    background-color: rgba(14, 165, 233, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(14, 165, 233, 0.25);
  }

  .kbd-hint {
    font-size: 9px;
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
    font-size: 11px;
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
