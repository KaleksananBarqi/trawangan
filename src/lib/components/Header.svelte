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
    Share2
  } from '@lucide/svelte';
  import type { TickerInfo, Timeframe, MultiChartSyncConfig } from '../types/market';

  interface Props {
    activeSymbol: string;
    activeTimeframe: Timeframe;
    ticker: TickerInfo | null;
    currentLayout: string;
    syncConfig?: MultiChartSyncConfig;
    activeIndicatorCount?: number;
    isPineEditorOpen?: boolean;
    isDrawingToolbarVisible?: boolean;
    isWatchlistOpen?: boolean;
    onSymbolChange: (sym: string) => void;
    onTimeframeChange: (tf: Timeframe) => void;
    onLayoutChange: (layout: string) => void;
    onToggleSyncCrosshair?: () => void;
    onToggleSyncDrawings?: () => void;
    onToggleDrawingToolbar?: () => void;
    onToggleWatchlist?: () => void;
    onOpenProviderModal: () => void;
    onOpenIndicatorModal: () => void;
    onTogglePineEditor: () => void;
  }

  let {
    activeSymbol,
    activeTimeframe,
    ticker,
    currentLayout,
    syncConfig = { crosshair: true, symbol: false, drawings: true },
    activeIndicatorCount = 0,
    isPineEditorOpen = false,
    isDrawingToolbarVisible = true,
    isWatchlistOpen = true,
    onSymbolChange,
    onTimeframeChange,
    onLayoutChange,
    onToggleSyncCrosshair,
    onToggleSyncDrawings,
    onToggleDrawingToolbar,
    onToggleWatchlist,
    onOpenProviderModal,
    onOpenIndicatorModal,
    onTogglePineEditor,
  }: Props = $props();

  const quickSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'];
  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D'];
  const layouts = [
    { id: '1', label: '1 Chart' },
    { id: '2h', label: '2 Hori' },
    { id: '2v', label: '2 Vert' },
    { id: '4', label: '4 Grid' },
  ];

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

<header class="header glass-panel">
  <!-- Brand & Logo -->
  <div class="brand-section">
    <div class="brand-badge">
      <Zap size={16} class="brand-icon" />
      <span class="brand-title">TRAWANGAN</span>
    </div>
    <span class="version-tag">PRO</span>
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
      <span class="active-sym-label">{activeSymbol}</span>
      <span class="dropdown-arrow">▾</span>
    </button>

    {#if showSymbolPicker}
      <div class="symbol-dropdown glass-panel">
        <form onsubmit={handleCustomSymbolSubmit}>
          <input
            type="text"
            placeholder="Ketik simbol (e.g. BTCUSDT)..."
            bind:value={customSymbolInput}
            class="symbol-input"
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
          ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </span>
        <span class="change-badge {ticker.change24h >= 0 ? 'bg-bull' : 'bg-bear'}">
          {#if ticker.change24h >= 0}
            <TrendingUp size={12} />
          {:else}
            <TrendingDown size={12} />
          {/if}
          {ticker.change24h >= 0 ? '+' : ''}{ticker.change24h.toFixed(2)}%
        </span>
      </div>

      <div class="hl-stats">
        <span class="stat-item"><small>24h H:</small> ${ticker.high24h.toLocaleString()}</span>
        <span class="stat-item"><small>24h L:</small> ${ticker.low24h.toLocaleString()}</span>
      </div>
    </div>
  {/if}

  <div class="spacer"></div>

  <!-- Timeframes Bar -->
  <div class="timeframe-bar">
    {#each timeframes as tf}
      <button
        class="tf-btn {activeTimeframe === tf ? 'active' : ''}"
        onclick={() => onTimeframeChange(tf)}
      >
        {tf}
      </button>
    {/each}
  </div>

  <div class="divider"></div>

  <!-- Layout & Multi-Chart Bar -->
  <div class="layout-bar">
    {#each layouts as l}
      <button
        class="layout-btn {currentLayout === l.id ? 'active' : ''}"
        title="Ganti tata letak {l.label}"
        onclick={() => onLayoutChange(l.id)}
      >
        <LayoutGrid size={13} />
        <span>{l.id}</span>
      </button>
    {/each}

    {#if currentLayout !== '1'}
      <div class="sync-group">
        <button
          class="sync-toggle-btn {syncConfig.crosshair ? 'active' : ''}"
          title="Sinkronisasi Kursor Crosshair antar Chart ({syncConfig.crosshair ? 'ON' : 'OFF'})"
          onclick={onToggleSyncCrosshair}
        >
          <Crosshair size={13} />
        </button>
        <button
          class="sync-toggle-btn {syncConfig.drawings ? 'active' : ''}"
          title="Sinkronisasi Gambar Analisis antar Chart ({syncConfig.drawings ? 'ON' : 'OFF'})"
          onclick={onToggleSyncDrawings}
        >
          <Share2 size={13} />
        </button>
      </div>
    {/if}
  </div>

  <div class="divider"></div>

  <!-- Action Controls -->
  <div class="actions-section">
    <!-- Toggle Drawing Tools -->
    <button
      class="action-btn {isDrawingToolbarVisible ? 'active' : ''}"
      title="Tampilkan / Sembunyikan Toolbar Alat Gambar"
      onclick={onToggleDrawingToolbar}
    >
      <PenTool size={14} />
      <span>Draw</span>
    </button>

    <button
      class="action-btn {activeIndicatorCount > 0 ? 'active' : ''}"
      title="Buka library indikator teknikal"
      onclick={onOpenIndicatorModal}
    >
      <Layers size={14} />
      <span>Indicators</span>
      {#if activeIndicatorCount > 0}
        <span class="count-badge">{activeIndicatorCount}</span>
      {/if}
    </button>

    <button
      class="action-btn {isPineEditorOpen ? 'active' : ''}"
      title="Toggle in-app Pine Script Editor"
      onclick={onTogglePineEditor}
    >
      <Code size={14} />
      <span>Pine Editor</span>
    </button>

    <!-- Toggle Watchlist Panel -->
    <button
      class="action-btn {isWatchlistOpen ? 'active' : ''}"
      title="Tampilkan / Sembunyikan Daftar Pantau Koin (Watchlist)"
      onclick={onToggleWatchlist}
    >
      <Flame size={14} />
      <span>Watchlist</span>
    </button>

    <button
      class="action-btn"
      title="Pengaturan Data Provider"
      onclick={onOpenProviderModal}
    >
      <SlidersHorizontal size={14} />
      <span>Provider</span>
    </button>

    <button
      class="action-btn icon-only"
      title="Toggle Layar Penuh"
      onclick={toggleFullscreen}
    >
      <Maximize2 size={15} />
    </button>
  </div>
</header>

<style>
  .header {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 10px;
    border-bottom: 1px solid var(--border-subtle);
    z-index: 100;
  }

  .brand-section {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .brand-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--brand-cyan);
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  :global(.brand-icon) {
    color: var(--brand-cyan);
    filter: drop-shadow(0 0 6px rgba(0, 242, 254, 0.6));
  }

  .brand-title {
    font-size: 13px;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .version-tag {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 5px;
    background: rgba(0, 242, 254, 0.12);
    color: var(--brand-cyan);
    border-radius: 4px;
    border: 1px solid rgba(0, 242, 254, 0.3);
  }

  .divider {
    width: 1px;
    height: 20px;
    background: var(--border-subtle);
  }

  .spacer {
    flex: 1;
  }

  /* Symbol styles */
  .symbol-section {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .quick-symbols {
    display: flex;
    gap: 4px;
  }

  .symbol-chip {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .symbol-chip:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .symbol-chip.active {
    background: var(--brand-blue);
    border-color: var(--brand-cyan);
    color: #fff;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
  }

  .custom-symbol-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-panel);
    border: 1px solid var(--border-medium);
    color: var(--text-main);
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .custom-symbol-btn:hover {
    border-color: var(--brand-cyan);
  }

  .symbol-dropdown {
    position: absolute;
    top: 38px;
    left: 0;
    padding: 8px;
    border-radius: var(--radius-md);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
    z-index: 200;
  }

  .symbol-input {
    background: var(--bg-darkest);
    border: 1px solid var(--border-bright);
    color: var(--text-main);
    padding: 6px 10px;
    font-size: 12px;
    border-radius: var(--radius-sm);
    outline: none;
    width: 200px;
  }

  /* Ticker stats */
  .ticker-stats {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .price-box {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .price-value {
    font-size: 14px;
    font-weight: 700;
  }

  .change-badge {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .bull { color: var(--bull-color); }
  .bear { color: var(--bear-color); }
  .bg-bull { background: rgba(14, 203, 129, 0.15); color: var(--bull-color); }
  .bg-bear { background: rgba(246, 70, 93, 0.15); color: var(--bear-color); }

  .hl-stats {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .hl-stats small {
    color: var(--text-dim);
  }

  /* Timeframe bar */
  .timeframe-bar {
    display: flex;
    gap: 2px;
  }

  .tf-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 7px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tf-btn:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .tf-btn.active {
    background: var(--bg-active);
    color: var(--brand-cyan);
    font-weight: 700;
  }

  /* Layout buttons */
  .layout-bar {
    display: flex;
    gap: 3px;
  }

  .layout-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-size: 11px;
    padding: 3px 6px;
    border-radius: 4px;
    cursor: pointer;
  }

  .layout-btn:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .layout-btn.active {
    background: var(--bg-active);
    border-color: var(--brand-cyan);
    color: var(--brand-cyan);
  }

  .sync-group {
    display: flex;
    gap: 2px;
    margin-left: 2px;
    padding-left: 4px;
    border-left: 1px solid var(--border-subtle);
  }

  .sync-toggle-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-dim);
    cursor: pointer;
    transition: all 0.15s;
  }

  .sync-toggle-btn:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }

  .sync-toggle-btn.active {
    color: var(--brand-cyan);
    border-color: rgba(0, 242, 254, 0.4);
    background: rgba(0, 242, 254, 0.12);
  }

  /* Actions */
  .actions-section {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-panel);
    border: 1px solid var(--border-medium);
    color: var(--text-main);
    font-size: 11px;
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    border-color: var(--brand-cyan);
  }

  .action-btn.icon-only {
    padding: 5px 6px;
  }

  .count-badge {
    background: var(--brand-cyan);
    color: var(--bg-darkest);
    font-size: 9px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 8px;
    margin-left: 2px;
  }
</style>
