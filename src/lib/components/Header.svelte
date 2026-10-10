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
    MoreVertical,
    Pin,
    Check,
    RotateCcw,
    Copy,
    Sparkles,
    Star,
    Clock,
    Trash2,
    Bell
  } from '@lucide/svelte';
  import type { TickerInfo, Timeframe, MultiChartSyncConfig, WorkspaceMode, QuickSymbolsConfig } from '../types/market';
  import { saveWorkspace, getWorkspaces, deleteWorkspace, type SavedWorkspace } from '../services/workspaceStorage';

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
    onSaveWorkspace?: (name: string) => void;
    onLoadWorkspace?: (w: SavedWorkspace) => void;
    onToggleSyncCrosshair?: () => void;
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
    syncConfig = { crosshair: true, symbol: false, drawings: true },
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
    onQuickSymbolsConfigChange,
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
    onOpenIndicatorModal,
    onOpenSettingsModal,
    onRequestCreateAlert,
    favoriteTimeframes = ['1m', '5m', '15m', '1h', '4h', '1D'],
    customTimeframes = [],
    onFavoriteTimeframesChange,
    onCustomTimeframesChange,
  }: Props = $props();

  let activeIndicatorCount = $derived(activeIndicators.length);

  // Quick Symbols Dynamic State
  let showQuickSymbolsMenu = $state(false);
  let newCustomSymbolInput = $state('');

  let activeQuickSymbols = $derived.by(() => {
    const mode = quickSymbolsConfig?.mode || 'watchlist';
    const limit = quickSymbolsConfig?.maxDisplayCount ?? 5;
    const baseList = mode === 'watchlist'
      ? (watchlistSymbols && watchlistSymbols.length > 0 ? watchlistSymbols : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'])
      : (quickSymbolsConfig?.customSymbols && quickSymbolsConfig.customSymbols.length > 0 ? quickSymbolsConfig.customSymbols : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT']);
    
    return limit === 0 ? baseList : baseList.slice(0, limit);
  });

  function setQuickMode(mode: 'watchlist' | 'custom') {
    const updated: QuickSymbolsConfig = {
      ...quickSymbolsConfig,
      mode
    };
    onQuickSymbolsConfigChange?.(updated);
  }

  function setQuickLimit(limit: number) {
    const updated: QuickSymbolsConfig = {
      ...quickSymbolsConfig,
      maxDisplayCount: limit
    };
    onQuickSymbolsConfigChange?.(updated);
  }

  function addCustomSymbol(sym: string) {
    const clean = sym.trim().toUpperCase();
    if (!clean) return;
    const formatted = clean.endsWith('USDT') ? clean : `${clean}USDT`;
    const current = quickSymbolsConfig.customSymbols || [];
    if (!current.includes(formatted)) {
      const updated: QuickSymbolsConfig = {
        ...quickSymbolsConfig,
        customSymbols: [...current, formatted]
      };
      onQuickSymbolsConfigChange?.(updated);
    }
    newCustomSymbolInput = '';
  }

  function removeCustomSymbol(sym: string) {
    const current = quickSymbolsConfig.customSymbols || [];
    const updated: QuickSymbolsConfig = {
      ...quickSymbolsConfig,
      customSymbols: current.filter(s => s !== sym)
    };
    onQuickSymbolsConfigChange?.(updated);
  }

  function togglePinWatchlistSymbol(sym: string) {
    const current = quickSymbolsConfig.customSymbols || [];
    if (current.includes(sym)) {
      removeCustomSymbol(sym);
    } else {
      addCustomSymbol(sym);
    }
  }

  function copyAllFromWatchlist() {
    if (!watchlistSymbols || watchlistSymbols.length === 0) return;
    const updated: QuickSymbolsConfig = {
      ...quickSymbolsConfig,
      customSymbols: [...watchlistSymbols]
    };
    onQuickSymbolsConfigChange?.(updated);
  }

  function resetQuickSymbolsDefault() {
    const updated: QuickSymbolsConfig = {
      mode: 'watchlist',
      customSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'],
      maxDisplayCount: 5
    };
    onQuickSymbolsConfigChange?.(updated);
  }

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

  // ─── Timeframe Configuration & State ───
  const STANDARD_TIMEFRAME_GROUPS = [
    {
      group: 'Menit',
      items: [
        { id: '1m', label: '1m', desc: '1 Menit' },
        { id: '3m', label: '3m', desc: '3 Menit' },
        { id: '5m', label: '5m', desc: '5 Menit' },
        { id: '15m', label: '15m', desc: '15 Menit' },
        { id: '30m', label: '30m', desc: '30 Menit' },
        { id: '45m', label: '45m', desc: '45 Menit' },
      ],
    },
    {
      group: 'Jam',
      items: [
        { id: '1h', label: '1h', desc: '1 Jam' },
        { id: '2h', label: '2h', desc: '2 Jam' },
        { id: '4h', label: '4h', desc: '4 Jam' },
        { id: '6h', label: '6h', desc: '6 Jam' },
        { id: '12h', label: '12h', desc: '12 Jam' },
      ],
    },
    {
      group: 'Hari & Pekan',
      items: [
        { id: '1D', label: '1D', desc: '1 Hari' },
        { id: '1W', label: '1W', desc: '1 Pekan' },
        { id: '1M', label: '1M', desc: '1 Bulan' },
      ],
    },
  ];

  let showTimeframeEditor = $state(false);
  let customTfNumber = $state<string | number>('');
  let customTfUnit = $state<'m' | 'h' | 'D'>('m');

  function toggleFavoriteTimeframe(tf: Timeframe) {
    if (favoriteTimeframes.includes(tf)) {
      if (favoriteTimeframes.length <= 1) return; // Sisakan minimal 1 favorit
      const updated = favoriteTimeframes.filter((t) => t !== tf);
      onFavoriteTimeframesChange?.(updated);
    } else {
      const updated = [...favoriteTimeframes, tf];
      onFavoriteTimeframesChange?.(updated);
    }
  }

  function handleAddCustomTimeframe(e?: Event) {
    e?.preventDefault();
    const num = parseInt(String(customTfNumber).trim(), 10);
    if (isNaN(num) || num <= 0) return;
    const newTf = `${num}${customTfUnit}`;

    if (!customTimeframes.includes(newTf)) {
      const updatedCustoms = [...customTimeframes, newTf];
      onCustomTimeframesChange?.(updatedCustoms);
    }
    if (!favoriteTimeframes.includes(newTf)) {
      const updatedFavs = [...favoriteTimeframes, newTf];
      onFavoriteTimeframesChange?.(updatedFavs);
    }
    customTfNumber = '';
    onTimeframeChange(newTf);
  }

  function handleRemoveCustomTimeframe(tf: string) {
    const updatedCustoms = customTimeframes.filter((t) => t !== tf);
    const updatedFavs = favoriteTimeframes.filter((t) => t !== tf);
    onCustomTimeframesChange?.(updatedCustoms);
    onFavoriteTimeframesChange?.(updatedFavs);
  }

  function handleResetDefaultTimeframes() {
    const def: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D'];
    onFavoriteTimeframesChange?.(def);
  }

  function handleGlobalClick(e: MouseEvent) {
    if (!showTimeframeEditor) return;
    const target = e.target as HTMLElement | null;
    if (target && !target.closest('.timeframe-section')) {
      showTimeframeEditor = false;
    }
  }

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && showTimeframeEditor) {
      showTimeframeEditor = false;
    }
  }

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
      setTimeout(loadWorkspacesList, 100);
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
</script>

<svelte:window onclick={handleGlobalClick} onkeydown={handleGlobalKeyDown} />

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
    <div class="quick-symbols" title="Bilah Koin Cepat">
      {#each activeQuickSymbols as sym}
        <button
          class="symbol-chip {activeSymbol === sym ? 'active' : ''}"
          title="{sym} • Klik untuk tampilkan chart"
          onclick={() => onSymbolChange(sym)}
        >
          {sym.replace('USDT', '')}
        </button>
      {/each}

      <!-- Tombol Atur Koin Cepat -->
      <button
        class="quick-config-btn {showQuickSymbolsMenu ? 'active' : ''}"
        title="Atur Koin Cepat ({quickSymbolsConfig?.mode === 'watchlist' ? 'Mode Watchlist' : 'Mode Kustom'})"
        onclick={() => {
          showQuickSymbolsMenu = !showQuickSymbolsMenu;
          showSymbolPicker = false;
        }}
      >
        <SlidersHorizontal size={11} class="config-icon" />
      </button>
    </div>

    <button
      class="custom-symbol-btn"
      title="Cari atau masukkan simbol kustom ({activeProviderId.toUpperCase()})"
      onclick={() => {
        showSymbolPicker = !showSymbolPicker;
        showQuickSymbolsMenu = false;
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

    <!-- Popover Kustomisasi Koin Cepat -->
    {#if showQuickSymbolsMenu}
      <div class="quick-config-dropdown obsidian-panel">
        <div class="quick-menu-header">
          <div class="header-left">
            <SlidersHorizontal size={12} class="brand-accent-icon" />
            <span class="menu-title">Koin Cepat Header</span>
          </div>
          <button
            class="icon-close-btn"
            title="Tutup"
            onclick={() => (showQuickSymbolsMenu = false)}
          >
            <X size={12} />
          </button>
        </div>

        <!-- Mode Switcher Tabs -->
        <div class="quick-mode-tabs">
          <button
            class="mode-tab {quickSymbolsConfig?.mode === 'watchlist' ? 'active' : ''}"
            onclick={() => setQuickMode('watchlist')}
          >
            <Zap size={11} />
            <span>Ikuti Watchlist</span>
          </button>
          <button
            class="mode-tab {quickSymbolsConfig?.mode === 'custom' ? 'active' : ''}"
            onclick={() => setQuickMode('custom')}
          >
            <Pin size={11} />
            <span>Pilihan Kustom</span>
          </button>
        </div>

        {#if quickSymbolsConfig?.mode === 'watchlist'}
          <div class="tab-pane">
            <p class="tab-description">
              Otomatis menampilkan koin dari daftar Watchlist aktif secara dinamis.
            </p>

            <div class="limit-selector-group">
              <span class="sub-label">Batas Tampilan:</span>
              <div class="pill-buttons">
                {#each [3, 5, 8, 0] as lim}
                  <button
                    class="pill-btn {quickSymbolsConfig?.maxDisplayCount === lim ? 'active' : ''}"
                    onclick={() => setQuickLimit(lim)}
                  >
                    {lim === 0 ? 'Semua' : lim}
                  </button>
                {/each}
              </div>
            </div>

            <div class="watchlist-preview-section">
              <span class="sub-label">Koin Watchlist ({watchlistSymbols.length}):</span>
              <div class="chips-flow mono-nums">
                {#each watchlistSymbols as sym}
                  <button
                    class="preview-chip {activeSymbol === sym ? 'active' : ''}"
                    title="Buka chart {sym}"
                    onclick={() => {
                      onSymbolChange(sym);
                      showQuickSymbolsMenu = false;
                    }}
                  >
                    {sym.replace('USDT', '')}
                  </button>
                {/each}
              </div>
            </div>

            <div class="quick-menu-actions">
              <button
                class="action-link-btn"
                onclick={() => {
                  if (!isWatchlistOpen) onToggleWatchlist?.();
                  showQuickSymbolsMenu = false;
                }}
              >
                Buka Panel Watchlist →
              </button>
            </div>
          </div>
        {:else}
          <div class="tab-pane">
            <p class="tab-description">
              Sematkan koin favorit pilihan Anda sendiri untuk navigasi kilat di header.
            </p>

            <div class="limit-selector-group">
              <span class="sub-label">Batas Tampilan:</span>
              <div class="pill-buttons">
                {#each [3, 5, 8, 0] as lim}
                  <button
                    class="pill-btn {quickSymbolsConfig?.maxDisplayCount === lim ? 'active' : ''}"
                    onclick={() => setQuickLimit(lim)}
                  >
                    {lim === 0 ? 'Semua' : lim}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Koin Disematkan -->
            <div class="pinned-section">
              <div class="section-row-header">
                <span class="sub-label">Disematkan ({(quickSymbolsConfig?.customSymbols || []).length}):</span>
              </div>
              <div class="chips-flow mono-nums">
                {#if (quickSymbolsConfig?.customSymbols || []).length === 0}
                  <div class="empty-hint">Belum ada koin disematkan. Pilih koin di bawah atau ketik manual.</div>
                {:else}
                  {#each (quickSymbolsConfig?.customSymbols || []) as sym}
                    <div class="pinned-chip {activeSymbol === sym ? 'active' : ''}">
                      <button
                        class="chip-sym-btn"
                        title="Buka chart {sym}"
                        onclick={() => {
                          onSymbolChange(sym);
                          showQuickSymbolsMenu = false;
                        }}
                      >
                        {sym.replace('USDT', '')}
                      </button>
                      <button
                        class="chip-remove-btn"
                        title="Lepas {sym}"
                        onclick={(e) => {
                          e.stopPropagation();
                          removeCustomSymbol(sym);
                        }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>

            <!-- Opsi Sematkan dari Watchlist -->
            {#if watchlistSymbols && watchlistSymbols.length > 0}
              <div class="watchlist-pick-section">
                <span class="sub-label">Pilih dari Watchlist:</span>
                <div class="chips-flow mono-nums">
                  {#each watchlistSymbols as sym}
                    {@const isPinned = (quickSymbolsConfig?.customSymbols || []).includes(sym)}
                    <button
                      class="toggle-chip {isPinned ? 'pinned' : ''}"
                      title="{isPinned ? 'Lepas' : 'Sematkan'} {sym}"
                      onclick={() => togglePinWatchlistSymbol(sym)}
                    >
                      {#if isPinned}
                        <Check size={9} class="chip-icon" />
                      {:else}
                        <Plus size={9} class="chip-icon" />
                      {/if}
                      <span>{sym.replace('USDT', '')}</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Form Tambah Simbol Manual -->
            <form
              class="add-custom-form"
              onsubmit={(e) => {
                e.preventDefault();
                addCustomSymbol(newCustomSymbolInput);
              }}
            >
              <input
                type="text"
                placeholder="Ketik koin baru (mis: PEPE)..."
                bind:value={newCustomSymbolInput}
                class="add-input mono-nums"
              />
              <button
                type="submit"
                class="add-submit-btn"
                disabled={!newCustomSymbolInput.trim()}
              >
                <Plus size={11} />
                <span>Sematkan</span>
              </button>
            </form>

            <!-- Aksi Bawah: Salin Watchlist & Reset -->
            <div class="custom-bottom-actions">
              <button
                type="button"
                class="utility-btn"
                title="Salin semua koin watchlist ke daftar kustom"
                onclick={copyAllFromWatchlist}
              >
                <Copy size={11} />
                <span>Salin Watchlist</span>
              </button>

              <button
                type="button"
                class="utility-btn"
                title="Kembalikan ke koin standar"
                onclick={resetQuickSymbolsDefault}
              >
                <RotateCcw size={11} />
                <span>Reset Default</span>
              </button>
            </div>
          </div>
        {/if}
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

  <!-- Timeframes Section & Favorit Bar -->
  <div class="timeframe-section">
    <div class="timeframe-bar">
      {#each favoriteTimeframes as tf}
        <button
          class="tf-btn mono-nums {activeTimeframe === tf ? 'active' : ''}"
          title="Ganti timeframe ke {tf}"
          onclick={() => onTimeframeChange(tf)}
        >
          {tf}
        </button>
      {/each}

      <!-- Smart Active Indicator jika timeframe aktif tidak ada di daftar favorit -->
      {#if !favoriteTimeframes.includes(activeTimeframe)}
        <button
          class="tf-btn mono-nums active temporary"
          title="Timeframe aktif saat ini ({activeTimeframe}) - Belum disematkan"
          onclick={() => onTimeframeChange(activeTimeframe)}
        >
          {activeTimeframe}
        </button>
      {/if}

      <!-- Tombol Plus / Kelola Timeframe -->
      <button
        class="tf-add-btn {showTimeframeEditor ? 'active' : ''}"
        title="Kelola Timeframe & Favorit Bilah Atas"
        onclick={(e) => {
          e.stopPropagation();
          showTimeframeEditor = !showTimeframeEditor;
          showSymbolPicker = false;
          showQuickSymbolsMenu = false;
          showWorkspaceMenu = false;
        }}
      >
        <Plus size={11} />
      </button>
    </div>

    <!-- Popover Dropdown Kelola Timeframe & Favorit (Obsidian Precision) -->
    {#if showTimeframeEditor}
      <div class="tf-dropdown obsidian-panel" onclick={(e) => e.stopPropagation()}>
        <!-- Header Popover -->
        <div class="tf-popover-header">
          <div class="header-left">
            <Clock size={12} class="brand-accent-icon" />
            <span class="popover-title">Timeframe & Favorit</span>
          </div>
          <div class="header-right">
            <span class="tf-count-badge">{favoriteTimeframes.length} Favorit</span>
            <button
              class="icon-close-btn"
              title="Tutup (Esc)"
              onclick={() => (showTimeframeEditor = false)}
            >
              <X size={12} />
            </button>
          </div>
        </div>

        <!-- Daftar Kategori Timeframe Standar -->
        <div class="tf-scroll-list">
          {#each STANDARD_TIMEFRAME_GROUPS as group}
            <div class="tf-group-block">
              <span class="tf-group-label">{group.group.toUpperCase()}</span>
              <div class="tf-group-items">
                {#each group.items as item}
                  {@const isStarred = favoriteTimeframes.includes(item.id)}
                  {@const isCurrent = activeTimeframe === item.id}
                  <div class="tf-row {isCurrent ? 'active-row' : ''}">
                    <button
                      class="tf-row-select"
                      title="Ganti ke {item.label} ({item.desc})"
                      onclick={() => {
                        onTimeframeChange(item.id);
                        showTimeframeEditor = false;
                      }}
                    >
                      <span class="tf-pill-id mono-nums {isCurrent ? 'current-tf' : ''}">
                        {item.label}
                      </span>
                      <span class="tf-row-desc">{item.desc}</span>
                    </button>
                    <button
                      class="tf-star-toggle {isStarred ? 'starred' : ''}"
                      title={isStarred ? 'Hapus dari bilah atas' : 'Sematkan ke bilah atas'}
                      onclick={() => toggleFavoriteTimeframe(item.id)}
                    >
                      <Star size={11} fill={isStarred ? '#f59e0b' : 'none'} color={isStarred ? '#f59e0b' : 'currentColor'} />
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/each}

          <!-- Kategori Kustom Jika Ada -->
          {#if customTimeframes && customTimeframes.length > 0}
            <div class="tf-group-block">
              <span class="tf-group-label">KUSTOM PENGGUNA</span>
              <div class="tf-group-items">
                {#each customTimeframes as ctf}
                  {@const isStarred = favoriteTimeframes.includes(ctf)}
                  {@const isCurrent = activeTimeframe === ctf}
                  <div class="tf-row {isCurrent ? 'active-row' : ''}">
                    <button
                      class="tf-row-select"
                      title="Ganti ke {ctf}"
                      onclick={() => {
                        onTimeframeChange(ctf);
                        showTimeframeEditor = false;
                      }}
                    >
                      <span class="tf-pill-id mono-nums {isCurrent ? 'current-tf' : ''}">
                        {ctf}
                      </span>
                      <span class="tf-row-desc">Interval Kustom</span>
                    </button>
                    <button
                      class="tf-star-toggle {isStarred ? 'starred' : ''}"
                      title={isStarred ? 'Hapus dari bilah atas' : 'Sematkan ke bilah atas'}
                      onclick={() => toggleFavoriteTimeframe(ctf)}
                    >
                      <Star size={11} fill={isStarred ? '#f59e0b' : 'none'} color={isStarred ? '#f59e0b' : 'currentColor'} />
                    </button>
                    <button
                      class="tf-del-btn"
                      title="Hapus timeframe kustom"
                      onclick={() => handleRemoveCustomTimeframe(ctf)}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Form Tambah Timeframe Kustom Baru -->
        <div class="tf-custom-builder">
          <span class="sub-label">Buat Timeframe Baru:</span>
          <form class="custom-builder-form" onsubmit={handleAddCustomTimeframe}>
            <input
              type="number"
              min="1"
              max="1000"
              placeholder="Nilai..."
              bind:value={customTfNumber}
              class="custom-num-input mono-nums"
            />
            <div class="unit-selector">
              <button
                type="button"
                class="unit-btn {customTfUnit === 'm' ? 'active' : ''}"
                onclick={() => (customTfUnit = 'm')}
              >
                Menit
              </button>
              <button
                type="button"
                class="unit-btn {customTfUnit === 'h' ? 'active' : ''}"
                onclick={() => (customTfUnit = 'h')}
              >
                Jam
              </button>
              <button
                type="button"
                class="unit-btn {customTfUnit === 'D' ? 'active' : ''}"
                onclick={() => (customTfUnit = 'D')}
              >
                Hari
              </button>
            </div>
            <button
              type="submit"
              class="custom-add-submit-btn"
              disabled={!customTfNumber || Number(customTfNumber) <= 0}
            >
              <Plus size={11} />
              <span>Tambah</span>
            </button>
          </form>
        </div>

        <!-- Footer Aksi Dropdown -->
        <div class="tf-popover-footer">
          <button
            type="button"
            class="utility-btn"
            title="Kembalikan favorit ke 1m, 5m, 15m, 1h, 4h, 1D"
            onclick={handleResetDefaultTimeframes}
          >
            <RotateCcw size={10} />
            <span>Reset Standar</span>
          </button>
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

  .quick-config-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-dim);
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
    align-self: center;
  }

  .quick-config-btn:hover {
    background-color: var(--bg-hover);
    color: var(--brand-primary);
  }

  .quick-config-btn.active {
    background-color: var(--bg-panel);
    border-color: var(--border-hairline);
    color: var(--brand-primary);
  }

  /* Quick Symbols Popover Dropdown */
  .quick-config-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 320px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    z-index: 250;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.12);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .quick-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-hairline);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  :global(.brand-accent-icon) {
    color: var(--brand-primary);
  }

  .menu-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--text-main);
  }

  .icon-close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: var(--radius-xs);
    transition: all 0.1s ease;
  }

  .icon-close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  /* Mode Switcher Tabs */
  .quick-mode-tabs {
    display: flex;
    gap: 4px;
    background-color: var(--bg-darkest);
    padding: 2px;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
  }

  .mode-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 5px 8px;
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .mode-tab:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .mode-tab.active {
    color: var(--brand-primary);
    background-color: var(--bg-panel);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .tab-pane {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .tab-description {
    font-size: 10.5px;
    color: var(--text-muted);
    line-height: 1.4;
    margin: 0;
  }

  .limit-selector-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    background-color: var(--bg-base);
    padding: 4px 8px;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
  }

  .sub-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim);
  }

  .section-row-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .pill-buttons {
    display: flex;
    gap: 2px;
  }

  .pill-btn {
    padding: 2px 7px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
    font-size: 10.5px;
    font-family: var(--font-mono);
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .pill-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .pill-btn.active {
    background-color: var(--bg-panel);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    font-weight: 700;
  }

  .chips-flow {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 110px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .preview-chip {
    padding: 3px 6px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: 10.5px;
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .preview-chip:hover {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .preview-chip.active {
    background-color: var(--bg-panel);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    font-weight: 700;
  }

  .pinned-chip {
    display: inline-flex;
    align-items: center;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    overflow: hidden;
    transition: all 0.12s ease;
  }

  .pinned-chip:hover {
    border-color: var(--border-bright);
  }

  .pinned-chip.active {
    border-color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.06);
  }

  .chip-sym-btn {
    padding: 3px 6px;
    background: transparent;
    border: none;
    color: var(--text-main);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .pinned-chip.active .chip-sym-btn {
    color: var(--brand-primary);
  }

  .chip-remove-btn {
    padding: 3px 4px;
    background: transparent;
    border: none;
    border-left: 1px solid var(--border-hairline);
    color: var(--text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s ease;
  }

  .chip-remove-btn:hover {
    background-color: rgba(255, 59, 105, 0.18);
    color: var(--bear-color);
  }

  .toggle-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10.5px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .toggle-chip:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .toggle-chip.pinned {
    background-color: rgba(0, 240, 144, 0.08);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    font-weight: 600;
  }

  :global(.chip-icon) {
    flex-shrink: 0;
  }

  .empty-hint {
    font-size: 10.5px;
    color: var(--text-dim);
    font-style: italic;
    padding: 4px 0;
  }

  .add-custom-form {
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }

  .add-input {
    flex: 1;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: 11px;
    padding: 5px 8px;
    outline: none;
  }

  .add-input:focus {
    border-color: var(--border-focus);
  }

  .add-submit-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 9px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .add-submit-btn:hover:not(:disabled) {
    background-color: var(--bg-hover);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .add-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .custom-bottom-actions {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border-hairline);
  }

  .utility-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .utility-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .action-link-btn {
    display: inline-flex;
    align-items: center;
    background: transparent;
    border: none;
    color: var(--brand-cyan);
    font-size: 10.5px;
    font-weight: 500;
    cursor: pointer;
    padding: 2px 0;
    transition: all 0.1s ease;
  }

  .action-link-btn:hover {
    text-decoration: underline;
    color: var(--text-main);
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
  .timeframe-section {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .timeframe-bar {
    display: flex;
    align-items: center;
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
    font-size: 10.5px;
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

  .tf-btn.temporary {
    border: 1px dashed rgba(0, 240, 144, 0.45);
    background-color: rgba(0, 240, 144, 0.08);
  }

  .tf-add-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 3px 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-xs);
    transition: all 0.12s ease;
  }

  .tf-add-btn:hover,
  .tf-add-btn.active {
    color: var(--brand-primary);
    background-color: var(--bg-hover);
  }

  .tf-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 290px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    z-index: 250;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.12);
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 480px;
  }

  .tf-popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-hairline);
  }

  .popover-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--text-main);
  }

  .tf-count-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: var(--radius-xs);
    background-color: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .tf-scroll-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    max-height: 220px;
    padding-right: 2px;
  }

  .tf-group-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tf-group-label {
    font-size: 8.5px;
    font-weight: 700;
    color: var(--text-dim);
    letter-spacing: 0.08em;
    padding: 2px 4px 0;
  }

  .tf-group-items {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .tf-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: var(--radius-xs);
    padding: 1px 6px;
    transition: background 0.1s ease;
  }

  .tf-row:hover {
    background-color: var(--bg-hover);
  }

  .tf-row.active-row {
    background-color: rgba(0, 240, 144, 0.08);
  }

  .tf-row-select {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    background: transparent;
    border: none;
    padding: 4px 0;
    text-align: left;
    cursor: pointer;
    color: var(--text-muted);
  }

  .tf-row-select:hover {
    color: var(--text-main);
  }

  .tf-pill-id {
    font-size: 11px;
    font-weight: 600;
    min-width: 28px;
    color: var(--text-main);
  }

  .tf-pill-id.current-tf {
    color: var(--brand-primary);
    font-weight: 700;
  }

  .tf-row-desc {
    font-size: 10px;
    color: var(--text-dim);
  }

  .tf-star-toggle {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    color: var(--text-dim);
    opacity: 0.35;
    transition: all 0.12s ease;
  }

  .tf-star-toggle:hover {
    opacity: 1;
    color: #f59e0b;
  }

  .tf-star-toggle.starred {
    opacity: 1;
    color: #f59e0b;
  }

  .tf-del-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    color: var(--alert-color);
    opacity: 0.4;
    transition: opacity 0.12s ease;
    margin-left: 2px;
  }

  .tf-del-btn:hover {
    opacity: 1;
  }

  .tf-custom-builder {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-top: 8px;
    border-top: 1px solid var(--border-hairline);
  }

  .custom-builder-form {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .custom-num-input {
    width: 60px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    padding: 4px 6px;
    border-radius: var(--radius-xs);
    outline: none;
  }

  .custom-num-input:focus {
    border-color: var(--border-focus);
  }

  .unit-selector {
    display: flex;
    background-color: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 1px;
    gap: 1px;
  }

  .unit-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 9.5px;
    font-weight: 600;
    padding: 3px 5px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .unit-btn.active {
    background-color: var(--bg-panel);
    color: var(--brand-primary);
  }

  .custom-add-submit-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 10px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    margin-left: auto;
    transition: all 0.12s ease;
  }

  .custom-add-submit-btn:hover:not(:disabled) {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    background-color: var(--bg-hover);
  }

  .custom-add-submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tf-popover-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 4px;
    border-top: 1px solid var(--border-hairline);
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
