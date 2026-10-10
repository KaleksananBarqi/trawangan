<script lang="ts">
  import {
    SlidersHorizontal,
    Layers,
    History,
    PenTool,
    Crosshair,
    Move,
    Coins,
    Share2,
    ChevronDown,
    Check,
    Sparkles
  } from '@lucide/svelte';
  import type { MultiChartSyncConfig } from '../../types/market';

  interface Props {
    activeIndicators?: { title: string; source?: string; visible: boolean }[];
    isReplayActive?: boolean;
    isDrawingToolbarVisible?: boolean;
    currentLayout?: string;
    syncConfig?: MultiChartSyncConfig;
    onOpenIndicatorModal: () => void;
    onToggleReplay?: () => void;
    onToggleDrawingToolbar?: () => void;
    onToggleSyncCrosshair?: () => void;
    onToggleSyncViewport?: () => void;
    onToggleSyncSymbol?: () => void;
    onToggleSyncDrawings?: () => void;
  }

  let {
    activeIndicators = [],
    isReplayActive = false,
    isDrawingToolbarVisible = true,
    currentLayout = '1',
    syncConfig = { crosshair: true, viewport: true, symbol: false, drawings: true },
    onOpenIndicatorModal,
    onToggleReplay,
    onToggleDrawingToolbar,
    onToggleSyncCrosshair,
    onToggleSyncViewport,
    onToggleSyncSymbol,
    onToggleSyncDrawings,
  }: Props = $props();

  let showMenu = $state(false);

  let activeIndicatorCount = $derived(activeIndicators.length);

  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (showMenu && !target.closest('.actions-menu-group')) {
      showMenu = false;
    }
  }

  function handleIndicatorClick() {
    onOpenIndicatorModal();
    showMenu = false;
  }
</script>

<svelte:window onclick={handleGlobalClick} />

<div class="actions-menu-group">
  <button
    class="actions-trigger-btn {activeIndicatorCount > 0 || isReplayActive ? 'has-active' : ''}"
    title="Aksi & Pengaturan Fitur (Indikator, Replay, Draw, Sinkronisasi)"
    onclick={() => (showMenu = !showMenu)}
  >
    <SlidersHorizontal size={13} class="trigger-icon" />
    <span>Actions</span>
    {#if activeIndicatorCount > 0}
      <span class="count-badge mono-nums">{activeIndicatorCount}</span>
    {/if}
    {#if isReplayActive}
      <span class="replay-dot" title="Bar Replay Aktif"></span>
    {/if}
    <ChevronDown size={11} class="dropdown-chevron {showMenu ? 'open' : ''}" />
  </button>

  {#if showMenu}
    <div class="actions-dropdown obsidian-panel">
      <!-- ─── BAGIAN 1: ALAT & FITUR UTAMA ─── -->
      <div class="section-title">
        <Sparkles size={11} />
        <span>FITUR ANALISIS</span>
      </div>

      <div class="menu-items">
        <!-- 1. Indikator Modal -->
        <button
          class="action-item-btn {activeIndicatorCount > 0 ? 'highlight' : ''}"
          onclick={handleIndicatorClick}
        >
          <div class="item-left">
            <Layers size={13} class="item-icon" />
            <div class="item-text">
              <span class="item-title">Indikator Teknikal</span>
              <span class="item-desc">Library Pine Script v6</span>
            </div>
          </div>
          {#if activeIndicatorCount > 0}
            <span class="item-badge mono-nums">{activeIndicatorCount} aktif</span>
          {:else}
            <span class="item-shortcut">Buka</span>
          {/if}
        </button>

        <!-- 2. Bar Replay -->
        <button
          class="action-item-btn {isReplayActive ? 'active-replay' : ''}"
          onclick={() => {
            onToggleReplay?.();
          }}
        >
          <div class="item-left">
            <History size={13} class="item-icon" />
            <div class="item-text">
              <span class="item-title">Bar Replay</span>
              <span class="item-desc">Backtest simulasi candle</span>
            </div>
          </div>
          <div class="item-right-toggle">
            <span class="toggle-pill {isReplayActive ? 'on' : 'off'}">
              {isReplayActive ? 'AKTIF' : 'OFF'}
            </span>
            <span class="item-shortcut mono-nums">Shift+R</span>
          </div>
        </button>

        <!-- 3. Alat Gambar (Drawing Toolbar) -->
        <button
          class="action-item-btn {isDrawingToolbarVisible ? 'active-draw' : ''}"
          onclick={() => {
            onToggleDrawingToolbar?.();
          }}
        >
          <div class="item-left">
            <PenTool size={13} class="item-icon" />
            <div class="item-text">
              <span class="item-title">Toolbar Gambar</span>
              <span class="item-desc">Trendline, Fib, Penggaris</span>
            </div>
          </div>
          <span class="toggle-pill {isDrawingToolbarVisible ? 'on' : 'off'}">
            {isDrawingToolbarVisible ? 'TAMPIL' : 'SEMBUNYI'}
          </span>
        </button>
      </div>

      <div class="divider-line"></div>

      <!-- ─── BAGIAN 2: SINKRONISASI MULTI-CHART ─── -->
      <div class="section-title">
        <Share2 size={11} />
        <span>SINKRONISASI MULTI-CHART</span>
        {#if currentLayout === '1'}
          <span class="multi-notice">(Aktif saat multi-chart)</span>
        {/if}
      </div>

      <div class="sync-grid">
        <!-- Crosshair -->
        <button
          class="sync-item-btn {syncConfig.crosshair ? 'active' : ''}"
          title="Sinkronisasi Kursor Crosshair"
          onclick={onToggleSyncCrosshair}
        >
          <Crosshair size={12} />
          <span>Crosshair</span>
          <span class="sync-pip {syncConfig.crosshair ? 'on' : 'off'}"></span>
        </button>

        <!-- Viewport -->
        <button
          class="sync-item-btn {syncConfig.viewport ? 'active' : ''}"
          title="Sinkronisasi Gerakan & Rentang Waktu Viewport"
          onclick={onToggleSyncViewport}
        >
          <Move size={12} />
          <span>Viewport</span>
          <span class="sync-pip {syncConfig.viewport ? 'on' : 'off'}"></span>
        </button>

        <!-- Symbol -->
        <button
          class="sync-item-btn {syncConfig.symbol ? 'active' : ''}"
          title="Sinkronisasi Simbol/Ticker Pasangan"
          onclick={onToggleSyncSymbol}
        >
          <Coins size={12} />
          <span>Simbol</span>
          <span class="sync-pip {syncConfig.symbol ? 'on' : 'off'}"></span>
        </button>

        <!-- Drawings -->
        <button
          class="sync-item-btn {syncConfig.drawings ? 'active' : ''}"
          title="Sinkronisasi Objek Gambar Analisis"
          onclick={onToggleSyncDrawings}
        >
          <Share2 size={12} />
          <span>Gambar</span>
          <span class="sync-pip {syncConfig.drawings ? 'on' : 'off'}"></span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .actions-menu-group {
    position: relative;
    display: flex;
    align-items: center;
  }

  .actions-trigger-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    height: 26px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .actions-trigger-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .actions-trigger-btn.has-active {
    color: var(--brand-primary);
    border-color: rgba(0, 240, 144, 0.3);
    background-color: rgba(0, 240, 144, 0.04);
  }

  .trigger-icon {
    color: var(--brand-primary);
    flex-shrink: 0;
  }

  .count-badge {
    background-color: rgba(0, 240, 144, 0.2);
    color: var(--brand-primary);
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 4.5px;
    border-radius: 9px;
  }

  .replay-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #38bdf8;
    box-shadow: 0 0 6px #38bdf8;
  }

  .dropdown-chevron {
    transition: transform 0.15s ease;
    color: var(--text-dim);
  }

  .dropdown-chevron.open {
    transform: rotate(180deg);
  }

  .actions-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 270px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    z-index: 250;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-dim);
    text-transform: uppercase;
  }

  .multi-notice {
    font-size: 8.5px;
    color: var(--text-dim);
    font-weight: 400;
    text-transform: none;
  }

  .menu-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .action-item-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    cursor: pointer;
    text-align: left;
    transition: all 0.12s ease;
  }

  .action-item-btn:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .action-item-btn.highlight {
    border-color: rgba(0, 240, 144, 0.25);
    background-color: rgba(0, 240, 144, 0.03);
  }

  .action-item-btn.active-replay {
    border-color: rgba(56, 189, 248, 0.35);
    background-color: rgba(56, 189, 248, 0.05);
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .item-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .action-item-btn.highlight .item-icon {
    color: var(--brand-primary);
  }

  .action-item-btn.active-replay .item-icon {
    color: #38bdf8;
  }

  .item-text {
    display: flex;
    flex-direction: column;
  }

  .item-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    line-height: 1.2;
  }

  .item-desc {
    font-size: 9px;
    color: var(--text-dim);
    line-height: 1.1;
  }

  .item-badge {
    font-size: 9px;
    background-color: rgba(0, 240, 144, 0.15);
    color: var(--brand-primary);
    padding: 1px 5px;
    border-radius: var(--radius-xs);
    font-weight: 600;
  }

  .item-shortcut {
    font-size: 9px;
    color: var(--text-dim);
  }

  .item-right-toggle {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .toggle-pill {
    font-size: 8.5px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 2px;
    letter-spacing: 0.02em;
  }

  .toggle-pill.on {
    background-color: rgba(0, 240, 144, 0.15);
    color: var(--brand-primary);
    border: 1px solid rgba(0, 240, 144, 0.3);
  }

  .toggle-pill.off {
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--text-dim);
    border: 1px solid var(--border-hairline);
  }

  .divider-line {
    height: 1px;
    background-color: var(--border-hairline);
    margin: 2px 0;
  }

  .sync-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }

  .sync-item-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 7px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-size: 10px;
    color: var(--text-muted);
    transition: all 0.12s ease;
  }

  .sync-item-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .sync-item-btn.active {
    border-color: rgba(56, 189, 248, 0.35);
    color: #38bdf8;
    background-color: rgba(56, 189, 248, 0.06);
  }

  .sync-pip {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .sync-pip.on {
    background-color: #38bdf8;
    box-shadow: 0 0 5px #38bdf8;
  }

  .sync-pip.off {
    background-color: var(--border-bright);
  }
</style>
