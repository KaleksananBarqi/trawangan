<script lang="ts">
  import {
    Activity,
    SlidersHorizontal,
    LayoutGrid,
    Maximize2,
    TrendingUp,
    TrendingDown,
    Zap,
    Layers,
    Code,
    Crosshair,
    PenTool,
    Flame,
    Share2,
    History,
    Settings,
    Search,
    Save,
    FolderOpen,
    Plus,
    X,
    MoreVertical
  } from '@lucide/svelte';
  import type { TickerInfo, Timeframe, MultiChartSyncConfig, WorkspaceMode } from '../types/market';
  import { saveWorkspace, getWorkspaces, deleteWorkspace, type SavedWorkspace } from '../services/workspaceStorage';

  interface Props {
    activeSymbol: string;
    activeTimeframe: Timeframe;
    ticker: TickerInfo | null;
    currentLayout: string;
    workspaceMode?: WorkspaceMode;
    syncConfig?: MultiChartSyncConfig;
    activeIndicators?: { title: string; source?: string; visible: boolean }[];
    isDrawingToolbarVisible?: boolean;
    isWatchlistOpen?: boolean;
    isReplayActive?: boolean;
    onSymbolChange: (sym: string) => void;
    onTimeframeChange: (tf: Timeframe) => void;
    onLayoutChange: (layout: string) => void;
    onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
    onSaveWorkspace?: (name: string) => void;
    onLoadWorkspace?: (w: SavedWorkspace) => void;
    onToggleSyncCrosshair?: () => void;
    onToggleSyncDrawings?: () => void;
    onToggleDrawingToolbar?: () => void;
    onToggleWatchlist?: () => void;
    onToggleReplay?: () => void;
    onOpenProviderModal: () => void;
    onOpenIndicatorModal: () => void;
    onOpenSettingsModal?: () => void;
  }

  let {
    activeSymbol,
    activeTimeframe,
    ticker,
    currentLayout,
    workspaceMode = 'terminal',
    syncConfig = { crosshair: true, symbol: false, drawings: true },
    activeIndicators = [],
    isDrawingToolbarVisible = true,
    isWatchlistOpen = true,
    isReplayActive = false,
    onSymbolChange,
    onTimeframeChange,
    onLayoutChange,
    onWorkspaceModeChange,
    onSaveWorkspace,
    onLoadWorkspace,
    onToggleSyncCrosshair,
    onToggleSyncDrawings,
    onToggleDrawingToolbar,
    onToggleWatchlist,
    onToggleReplay,
    onOpenProviderModal,
    onOpenIndicatorModal,
    onOpenSettingsModal,
  }: Props = $props();

  let activeIndicatorCount = $derived(activeIndicators.length);

  const quickSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'];
  let timeframes = $state<Timeframe[]>(['1m', '5m', '15m', '1h', '4h', '1D']);
  const layouts = [
    { id: '1', label: '1 Chart' },
    { id: '2h', label: '2 Hori' },
    { id: '2v', label: '2 Vert' },
    { id: '4', label: '4 Grid' },
  ];

  let showSymbolPicker = $state(false);
  let customSymbolInput = $state('');
  
  // Workspace State
  let showWorkspaceMenu = $state(false);
  let savedWorkspaces = $state<SavedWorkspace[]>([]);
  let workspaceNameInput = $state('');

  // Timeframe Editor State
  let showTimeframeEditor = $state(false);
  let newTimeframeInput = $state('');

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

  function loadWorkspacesList() {
    savedWorkspaces = getWorkspaces();
  }

  function handleSaveWorkspace() {
    if (workspaceNameInput.trim() && onSaveWorkspace) {
      onSaveWorkspace(workspaceNameInput.trim());
      workspaceNameInput = '';
      setTimeout(loadWorkspacesList, 100); // Give time for parent to save
    }
  }

  function handleLoadWorkspace(w: SavedWorkspace) {
    if (onLoadWorkspace) {
      onLoadWorkspace(w);
    }
    showWorkspaceMenu = false;
  }
  
  function handleDeleteWorkspace(id: string) {
    deleteWorkspace(id);
    loadWorkspacesList();
  }

  function handleAddTimeframe(e: Event) {
    e.preventDefault();
    if (newTimeframeInput.trim()) {
      const tf = newTimeframeInput.trim() as Timeframe;
      if (!timeframes.includes(tf)) {
        timeframes = [...timeframes, tf];
      }
      newTimeframeInput = '';
    }
  }
</script>

<header class="header">
  <!-- Brand & Logo -->
  <div class="brand-section">
    <div class="brand-badge">
      <Zap size={15} class="brand-icon" />
      <span class="brand-title">TRAWANGAN</span>
    </div>
    <span class="version-tag">PRO</span>
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

  <!-- Symbol Switcher -->
  <div class="symbol-section">
    <div class="quick-symbols">
      {#each quickSymbols as sym}
        <button
          class="symbol-chip {activeSymbol === sym ? 'active' : ''}"
          onclick={() => onSymbolChange(sym)}
        >
          {sym.replace('USDT', '')}
        </button>
      {/each}
    </div>

    <button
      class="custom-symbol-btn"
      title="Cari atau masukkan simbol kustom"
      onclick={() => (showSymbolPicker = !showSymbolPicker)}
    >
      <Search size={12} class="search-icon" />
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

  <!-- Timeframes Bar -->
  <div class="timeframe-bar">
    {#each timeframes as tf}
      <button
        class="tf-btn mono-nums {activeTimeframe === tf ? 'active' : ''}"
        onclick={() => onTimeframeChange(tf)}
      >
        {tf}
      </button>
    {/each}
    <button class="tf-add-btn" title="Edit Timeframes" onclick={() => showTimeframeEditor = !showTimeframeEditor}>
      <Plus size={12} />
    </button>
    
    {#if showTimeframeEditor}
      <div class="tf-dropdown obsidian-panel">
        <div class="tf-dropdown-header">Manage Timeframes</div>
        <form class="tf-form" onsubmit={handleAddTimeframe}>
          <input type="text" placeholder="Add (e.g. 2h)" bind:value={newTimeframeInput} class="tf-input mono-nums" />
          <button type="submit" class="tf-submit-btn"><Plus size={12} /></button>
        </form>
        <div class="tf-list">
          {#each timeframes as tf}
            <div class="tf-list-item">
              <span class="mono-nums">{tf}</span>
              <button class="tf-remove-btn" onclick={() => timeframes = timeframes.filter(t => t !== tf)}><X size={12} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="divider"></div>

  <!-- Multi-Chart Layouts & Workspace -->
  <div class="layout-bar">
    <div class="workspace-btn-group">
      <button
        class="workspace-toggle-btn"
        title="Manage Workspaces"
        onclick={() => { showWorkspaceMenu = !showWorkspaceMenu; if(showWorkspaceMenu) loadWorkspacesList(); }}
      >
        <FolderOpen size={12} />
        <span>Workspaces</span>
      </button>
      
      {#if showWorkspaceMenu}
        <div class="workspace-dropdown obsidian-panel">
          <div class="workspace-save-form">
            <input type="text" placeholder="Save current as..." bind:value={workspaceNameInput} class="workspace-input" />
            <button onclick={handleSaveWorkspace} class="workspace-save-submit"><Save size={12} /></button>
          </div>
          <div class="workspace-list">
            {#if savedWorkspaces.length === 0}
              <div class="workspace-empty">No saved workspaces</div>
            {/if}
            {#each savedWorkspaces as w}
              <div class="workspace-item">
                <button class="workspace-load-btn" onclick={() => handleLoadWorkspace(w)}>
                  <Layers size={12} class="workspace-icon" />
                  <span class="workspace-name">{w.name}</span>
                </button>
                <button class="workspace-del-btn" onclick={() => handleDeleteWorkspace(w.id)}><X size={12} /></button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="divider-vertical"></div>

    {#each layouts as l}
      <button
        class="layout-btn {currentLayout === l.id ? 'active' : ''}"
        title="Ganti tata letak {l.label}"
        onclick={() => onLayoutChange(l.id)}
      >
        <LayoutGrid size={12} />
        <span class="mono-nums">{l.id}</span>
      </button>
    {/each}

    {#if currentLayout !== '1'}
      <div class="sync-group">
        <button
          class="sync-toggle-btn {syncConfig.crosshair ? 'active' : ''}"
          title="Sinkronisasi Kursor Crosshair ({syncConfig.crosshair ? 'ON' : 'OFF'})"
          onclick={onToggleSyncCrosshair}
        >
          <Crosshair size={12} />
        </button>
        <button
          class="sync-toggle-btn {syncConfig.drawings ? 'active' : ''}"
          title="Sinkronisasi Gambar Analisis ({syncConfig.drawings ? 'ON' : 'OFF'})"
          onclick={onToggleSyncDrawings}
        >
          <Share2 size={12} />
        </button>
      </div>
    {/if}
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

    <!-- Toggle Watchlist Panel -->
    <button
      class="action-btn {isWatchlistOpen ? 'active' : ''}"
      title="Tampilkan / Sembunyikan Panel Kanan"
      onclick={onToggleWatchlist}
    >
      <Flame size={13} />
      <span>Panel</span>
    </button>

    <!-- Provider Configuration -->
    <button
      class="action-btn"
      title="Pengaturan Data Provider"
      onclick={onOpenProviderModal}
    >
      <SlidersHorizontal size={13} />
      <span>Feed</span>
    </button>

    <!-- Settings & Telemetry Modal -->
    <button
      class="action-btn"
      title="Buka Pengaturan & Telemetri Sistem"
      onclick={onOpenSettingsModal}
    >
      <Settings size={13} />
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

  .brand-icon {
    color: var(--brand-primary);
  }

  .brand-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-main);
  }

  .version-tag {
    font-size: 9px;
    font-weight: 700;
    background-color: rgba(0, 240, 144, 0.12);
    color: var(--brand-primary);
    padding: 2px 4px;
    border-radius: var(--radius-xs);
    border: 1px solid rgba(0, 240, 144, 0.25);
  }

  .divider {
    width: 1px;
    height: 18px;
    background-color: var(--border-hairline);
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

  .quick-symbols {
    display: flex;
    gap: 2px;
  }

  .symbol-chip {
    padding: 3px 6px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 500;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .symbol-chip:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .symbol-chip.active {
    color: var(--brand-primary);
    background-color: var(--bg-panel);
    border-color: var(--border-hairline);
    font-weight: 700;
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

  .search-icon {
    color: var(--text-dim);
  }

  .dropdown-arrow {
    font-size: 8px;
    color: var(--text-dim);
  }

  .symbol-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
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

  .spacer {
    flex: 1;
  }

  /* Timeframes */
  .timeframe-bar {
    display: flex;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 1px;
    gap: 1px;
    flex-shrink: 0;
  }

  .tf-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 500;
    padding: 3px 6px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .tf-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .tf-btn.active {
    color: var(--brand-primary);
    background-color: var(--bg-panel);
    font-weight: 700;
  }

  .tf-add-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-xs);
  }

  .tf-add-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .tf-dropdown {
    position: absolute;
    top: 100%;
    margin-top: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 8px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
  }

  .tf-dropdown-header {
    font-size: 11px;
    color: var(--text-dim);
    font-weight: 600;
  }

  .tf-form {
    display: flex;
    gap: 4px;
  }

  .tf-input {
    flex: 1;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    padding: 4px 6px;
    border-radius: var(--radius-xs);
  }

  .tf-submit-btn {
    background-color: rgba(0, 240, 144, 0.1);
    color: var(--brand-primary);
    border: 1px solid var(--brand-primary);
    border-radius: var(--radius-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
  }

  .tf-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 150px;
    overflow-y: auto;
  }

  .tf-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 6px;
    font-size: 11px;
    border-radius: var(--radius-xs);
    color: var(--text-muted);
  }

  .tf-list-item:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .tf-remove-btn {
    background: transparent;
    border: none;
    color: var(--alert-color);
    cursor: pointer;
    opacity: 0.5;
    padding: 2px;
  }

  .tf-remove-btn:hover {
    opacity: 1;
  }

  /* Workspace */
  .workspace-btn-group {
    position: relative;
    display: flex;
  }

  .workspace-toggle-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
  }

  .workspace-toggle-btn:hover {
    color: var(--brand-cyan);
    background-color: rgba(56, 189, 248, 0.1);
    border-color: var(--brand-cyan);
  }

  .workspace-dropdown {
    position: absolute;
    top: 100%;
    margin-top: 4px;
    left: 0;
    width: 240px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 8px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
  }

  .workspace-save-form {
    display: flex;
    gap: 4px;
  }

  .workspace-input {
    flex: 1;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    padding: 4px 6px;
    border-radius: var(--radius-xs);
  }

  .workspace-save-submit {
    background-color: rgba(56, 189, 248, 0.1);
    color: var(--brand-cyan);
    border: 1px solid var(--brand-cyan);
    border-radius: var(--radius-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
  }

  .workspace-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    overflow-y: auto;
  }

  .workspace-empty {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    padding: 10px 0;
  }

  .workspace-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px;
    border-radius: var(--radius-xs);
  }

  .workspace-item:hover {
    background-color: var(--bg-hover);
  }

  .workspace-load-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    flex: 1;
    text-align: left;
  }

  .workspace-load-btn:hover {
    color: var(--text-main);
  }

  .workspace-del-btn {
    background: transparent;
    border: none;
    color: var(--alert-color);
    cursor: pointer;
    opacity: 0.5;
    padding: 2px;
  }

  .workspace-del-btn:hover {
    opacity: 1;
  }

  /* Layouts */
  .layout-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .layout-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 5px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
  }

  .layout-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .layout-btn.active {
    color: var(--brand-primary);
    border-color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.08);
  }

  .sync-group {
    display: flex;
    gap: 2px;
  }

  .sync-toggle-btn {
    padding: 3px 5px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    cursor: pointer;
  }

  .sync-toggle-btn.active {
    color: var(--brand-cyan);
    border-color: var(--brand-cyan);
    background-color: rgba(56, 189, 248, 0.1);
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
