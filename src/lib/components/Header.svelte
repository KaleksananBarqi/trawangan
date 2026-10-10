<script lang="ts">
  import {
    Activity,
    Code,
    Search,
    TrendingUp,
    TrendingDown,
    Zap,
    History,
    PenTool,
    Layers,
    Bell,
    Flame,
    Settings,
    Maximize2
  } from '@lucide/svelte';
  import type {
    TickerInfo,
    Timeframe,
    MultiChartSyncConfig,
    WorkspaceMode,
    QuickSymbolsConfig,
    SavedWorkspace
  } from '../types/market';

  // Subkomponen modular yang telah didecouple
  import WorkspaceMenu from './header/WorkspaceMenu.svelte';
  import LayoutGridSelector from './header/LayoutGridSelector.svelte';
  import QuickSymbolsDropdown from './header/QuickSymbolsDropdown.svelte';
  import TimeframeSelector from './header/TimeframeSelector.svelte';

  interface Props {
    activeSymbol: string;
    activeTimeframe: Timeframe;
    ticker: TickerInfo | null;
    currentLayout: string;
    activeProviderId?: string;
    workspaceMode?: WorkspaceMode;
    syncConfig?: MultiChartSyncConfig;
    activeIndicators?: { title: string; source?: string; visible: boolean }[];
    isDrawingToolbarVisible?: boolean;
    isWatchlistOpen?: boolean;
    isReplayActive?: boolean;
    watchlistSymbols?: string[];
    quickSymbolsConfig?: QuickSymbolsConfig;
    favoriteTimeframes?: Timeframe[];
    customTimeframes?: string[];
    onFavoriteTimeframesChange?: (tfs: Timeframe[]) => void;
    onCustomTimeframesChange?: (customs: string[]) => void;
    onQuickSymbolsConfigChange?: (config: QuickSymbolsConfig) => void;
    onSymbolChange: (sym: string) => void;
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
    onToggleDrawingToolbar?: () => void;
    onToggleWatchlist?: () => void;
    onToggleReplay?: () => void;
    onOpenIndicatorModal: () => void;
    onOpenSettingsModal?: () => void;
    onRequestCreateAlert?: () => void;
  }

  let {
    activeSymbol,
    activeTimeframe,
    ticker,
    currentLayout,
    activeProviderId = 'binance',
    workspaceMode = 'terminal',
    syncConfig = { crosshair: true, viewport: true, symbol: false, drawings: true },
    activeIndicators = [],
    isDrawingToolbarVisible = true,
    isWatchlistOpen = true,
    isReplayActive = false,
    watchlistSymbols = [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
      'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
    ],
    quickSymbolsConfig = {
      mode: 'watchlist',
      customSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'],
      maxDisplayCount: 5
    },
    favoriteTimeframes = ['1m', '5m', '15m', '1h', '4h', '1D'],
    customTimeframes = [],
    onFavoriteTimeframesChange,
    onCustomTimeframesChange,
    onQuickSymbolsConfigChange,
    onSymbolChange,
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
    onToggleDrawingToolbar,
    onToggleWatchlist,
    onToggleReplay,
    onOpenIndicatorModal,
    onOpenSettingsModal,
    onRequestCreateAlert
  }: Props = $props();

  let activeIndicatorCount = $derived(activeIndicators.length);

  // Symbol Search Input Modal State
  let showSymbolPicker = $state(false);
  let customSymbolInput = $state('');

  function handleCustomSymbolSubmit(e: Event) {
    e.preventDefault();
    if (customSymbolInput.trim()) {
      onSymbolChange(customSymbolInput.trim().toUpperCase());
      showSymbolPicker = false;
      customSymbolInput = '';
    }
  }

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
      <Activity size={13} />
      <span>Terminal</span>
    </button>
    <button
      class="mode-btn {workspaceMode === 'pine' ? 'active' : ''}"
      title="Mode Pine Script v6 IDE & Backtester"
      onclick={() => onWorkspaceModeChange?.('pine')}
    >
      <Code size={13} />
      <span>Pine IDE</span>
    </button>
  </div>

  <div class="divider"></div>

  <!-- Symbol Switcher (Quick Symbols Bar + Custom Search) -->
  <div class="symbol-section">
    <QuickSymbolsDropdown
      {activeSymbol}
      {watchlistSymbols}
      {quickSymbolsConfig}
      {isWatchlistOpen}
      {onSymbolChange}
      {onQuickSymbolsConfigChange}
      {onToggleWatchlist}
    />

    <button
      class="custom-symbol-btn"
      title="Cari atau masukkan simbol kustom ({activeProviderId.toUpperCase()})"
      onclick={() => {
        showSymbolPicker = !showSymbolPicker;
      }}
    >
      <Search size={12} class="search-icon" />
      <span class="provider-feed-badge {activeProviderId === 'bitunix' ? 'bitunix' : 'binance'}">
        {activeProviderId.toUpperCase()}
      </span>
      <span class="active-sym-label">{activeSymbol}</span>
      <span class="dropdown-arrow">▾</span>
    </button>

    {#if showSymbolPicker}
      <div class="symbol-dropdown obsidian-panel">
        <form onsubmit={handleCustomSymbolSubmit}>
          <input
            type="text"
            placeholder="Ketik simbol (e.g. BTCUSDT)..."
            bind:value={customSymbolInput}
            class="symbol-input mono-nums"
          />
        </form>
      </div>
    {/if}
  </div>

  <div class="divider"></div>

  <!-- Live Ticker Stats -->
  {#if ticker && ticker.price > 0}
    <div class="ticker-stats mono-nums">
      <div class="price-box">
        <span class="price-value {ticker.change24h >= 0 ? 'bull' : 'bear'}">
          ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span class="change-badge {ticker.change24h >= 0 ? 'bg-bull' : 'bg-bear'}">
          {#if ticker.change24h >= 0}
            <TrendingUp size={11} />
          {:else}
            <TrendingDown size={11} />
          {/if}
          {ticker.change24h >= 0 ? '+' : ''}{ticker.change24h.toFixed(2)}%
        </span>
      </div>

      <div class="hl-stats">
        <span class="stat-item"><small>H:</small> ${ticker.high24h.toLocaleString()}</span>
        <span class="stat-item"><small>L:</small> ${ticker.low24h.toLocaleString()}</span>
      </div>
    </div>
  {/if}

  <div class="spacer"></div>

  <!-- Timeframe Selector & Favorit Bar -->
  <TimeframeSelector
    {activeTimeframe}
    {favoriteTimeframes}
    {customTimeframes}
    {onTimeframeChange}
    {onFavoriteTimeframesChange}
    {onCustomTimeframesChange}
  />

  <div class="divider"></div>

  <!-- Multi-Chart Layouts & Workspace -->
  <div class="workspace-layout-group">
    <WorkspaceMenu
      {activeWorkspace}
      {isAutoSaveWorkspace}
      {onToggleAutoSaveWorkspace}
      {onSaveWorkspace}
      {onLoadWorkspace}
      {onNewWorkspace}
    />
    <div class="divider-vertical"></div>
    <LayoutGridSelector
      {currentLayout}
      {syncConfig}
      {onLayoutChange}
      {onToggleSyncCrosshair}
      {onToggleSyncViewport}
      {onToggleSyncSymbol}
      {onToggleSyncDrawings}
    />
  </div>

  <div class="divider"></div>

  <!-- Action Controls -->
  <div class="actions-section">
    <!-- Replay Controller Toggle -->
    <button
      class="action-btn {isReplayActive ? 'active' : ''}"
      title="Toggle Bar Replay Mode"
      onclick={onToggleReplay}
    >
      <History size={13} />
      <span>Replay</span>
    </button>

    <!-- Toggle Drawing Tools -->
    <button
      class="action-btn {isDrawingToolbarVisible ? 'active' : ''}"
      title="Tampilkan / Sembunyikan Toolbar Alat Gambar"
      onclick={onToggleDrawingToolbar}
    >
      <PenTool size={13} />
      <span>Draw</span>
    </button>

    <!-- Indicators Modal -->
    <button
      class="action-btn {activeIndicatorCount > 0 ? 'active' : ''}"
      title="Buka library indikator teknikal"
      onclick={onOpenIndicatorModal}
    >
      <Layers size={13} />
      <span>Indikator</span>
      {#if activeIndicatorCount > 0}
        <span class="count-badge">{activeIndicatorCount}</span>
      {/if}
    </button>

    <!-- Create Alert Button (Quick Header Action) -->
    <button
      class="action-btn alert-header-btn"
      title="Buat Price Alert Baru (Alt+A)"
      onclick={onRequestCreateAlert}
    >
      <Bell size={13} class="text-cyan-accent" />
      <span>Alert</span>
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

    <!-- Settings & Telemetry Modal -->
    <button
      class="action-btn"
      title="Buka Pengaturan, Data Feed & Telemetri Sistem"
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
    gap: 8px;
    border-bottom: 1px solid var(--border-hairline);
    z-index: 100;
  }

  .alert-header-btn {
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.25) !important;
  }

  .alert-header-btn:hover {
    background-color: rgba(56, 189, 248, 0.15) !important;
    color: #ffffff !important;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
  }

  .text-cyan-accent {
    color: #38bdf8;
  }

  .brand-section {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .brand-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    padding: 3px 7px;
    border-radius: var(--radius-xs);
  }

  .brand-logo-img {
    width: 16px;
    height: 16px;
    object-fit: contain;
    display: block;
    filter: drop-shadow(0 0 6px rgba(255, 105, 180, 0.4));
  }

  .brand-title {
    font-family: var(--font-brand);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-main);
    text-transform: lowercase;
  }

  .version-tag {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    background-color: rgba(255, 105, 180, 0.12);
    color: var(--brand-primary);
    padding: 2px 5px;
    border-radius: var(--radius-xs);
    border: 1px solid rgba(255, 105, 180, 0.28);
    letter-spacing: 0.04em;
    text-transform: lowercase;
  }


  .divider {
    width: 1px;
    height: 18px;
    background-color: var(--border-hairline);
    flex-shrink: 0;
  }

  .divider-vertical {
    width: 1px;
    height: 14px;
    background-color: var(--border-hairline);
    margin: 0 2px;
    flex-shrink: 0;
  }

  /* Mode Switcher */
  .mode-switcher {
    display: flex;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 1px;
    gap: 1px;
    flex-shrink: 0;
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .mode-btn.active {
    color: var(--brand-primary);
    background-color: var(--bg-surface);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  /* Symbols */
  .symbol-section {
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative;
    flex-shrink: 0;
  }

  .custom-symbol-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    cursor: pointer;
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 600;
  }

  .custom-symbol-btn:hover {
    background-color: var(--bg-hover);
  }

  .provider-feed-badge {
    font-size: 8px;
    font-weight: 800;
    padding: 1px 3px;
    border-radius: 2px;
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .provider-feed-badge.bitunix {
    background-color: rgba(6, 182, 212, 0.2);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.35);
  }

  .provider-feed-badge.binance {
    background-color: rgba(245, 158, 11, 0.18);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  :global(.search-icon) {
    color: var(--text-dim);
  }

  .dropdown-arrow {
    font-size: 8px;
    color: var(--text-dim);
  }

  .symbol-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 4px;
    z-index: 200;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.5);
  }

  .symbol-input {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    padding: 5px 8px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    width: 170px;
    outline: none;
  }

  .symbol-input:focus {
    border-color: var(--border-focus);
  }

  /* Ticker Stats */
  .ticker-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .price-box {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .price-value {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .price-value.bull {
    color: var(--bull-color);
  }

  .price-value.bear {
    color: var(--bear-color);
  }

  .change-badge {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-weight: 600;
  }

  .change-badge.bg-bull {
    background-color: rgba(0, 240, 144, 0.12);
    color: var(--bull-color);
  }

  .change-badge.bg-bear {
    background-color: rgba(255, 59, 105, 0.12);
    color: var(--bear-color);
  }

  .hl-stats {
    display: flex;
    gap: 6px;
    font-size: 10px;
    color: var(--text-dim);
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .spacer {
    flex: 1;
  }

  /* Workspace & Layout Group */
  .workspace-layout-group {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  /* Actions */
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
    padding: 4px 7px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .action-btn.active {
    color: var(--brand-primary);
    border-color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.08);
  }

  .action-btn.icon-only {
    padding: 5px;
  }

  .count-badge {
    background-color: var(--brand-primary);
    color: var(--bg-darkest);
    font-size: 9px;
    font-weight: 700;
    padding: 0 4px;
    border-radius: var(--radius-xs);
  }
</style>
