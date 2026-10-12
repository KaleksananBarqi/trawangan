<script lang="ts">
  import {
    Flame,
    Bell,
    Layers,
    Code,
    ChevronRight,
    ChevronLeft
  } from '@lucide/svelte';
  import type { RightDockTab } from '../services/rightDockService';
  import type { WorkspaceMode } from '../types/market';

  interface Props {
    isOpen: boolean;
    activeTab: RightDockTab | null;
    workspaceMode?: WorkspaceMode;
    activeAlertsCount?: number;
    activeIndicatorsCount?: number;
    onToggleTab: (tab: RightDockTab) => void;
    onToggleHider: () => void;
    onTogglePineMode?: () => void;
  }

  let {
    isOpen,
    activeTab,
    workspaceMode = 'terminal',
    activeAlertsCount = 0,
    activeIndicatorsCount = 0,
    onToggleTab,
    onToggleHider,
    onTogglePineMode,
  }: Props = $props();
</script>

<aside class="right-dock-rail" aria-label="Bilah Dock Kanan TradingView Parity">
  <!-- Top Tool Icons Cluster -->
  <div class="dock-cluster top-cluster">
    <!-- 1. Watchlist -->
    <button
      type="button"
      class="dock-btn {isOpen && activeTab === 'watchlist' && workspaceMode !== 'pine' ? 'active' : ''}"
      title="Watchlist & Ticker Kripto"
      onclick={() => onToggleTab('watchlist')}
    >
      <Flame size={16} class="dock-icon" />
    </button>

    <!-- 2. Price Alerts -->
    <button
      type="button"
      class="dock-btn {isOpen && activeTab === 'alerts' && workspaceMode !== 'pine' ? 'active' : ''}"
      title="Price Alerts ({activeAlertsCount} Aktif)"
      onclick={() => onToggleTab('alerts')}
    >
      <Bell size={16} class="dock-icon" />
      {#if activeAlertsCount > 0}
        <span class="dock-badge mono-nums">{activeAlertsCount}</span>
      {/if}
    </button>

    <!-- 3. Object Tree / Layers -->
    <button
      type="button"
      class="dock-btn {isOpen && activeTab === 'objects' && workspaceMode !== 'pine' ? 'active' : ''}"
      title="Object Tree & Indikator ({activeIndicatorsCount})"
      onclick={() => onToggleTab('objects')}
    >
      <Layers size={16} class="dock-icon" />
      {#if activeIndicatorsCount > 0}
        <span class="dock-badge count-muted mono-nums">{activeIndicatorsCount}</span>
      {/if}
    </button>

    <div class="dock-divider"></div>

    <!-- 4. Pine Script IDE Mode Shortcut -->
    <button
      type="button"
      class="dock-btn {workspaceMode === 'pine' ? 'active pine-active' : ''}"
      title="Pine Script v6 Editor & Backtester"
      onclick={() => onTogglePineMode?.()}
    >
      <Code size={16} class="dock-icon" />
    </button>
  </div>

  <!-- Bottom Cluster: Hider Chevron -->
  <div class="dock-cluster bottom-cluster">
    <button
      type="button"
      class="dock-btn hider-btn"
      title={isOpen || workspaceMode === 'pine' ? 'Sembunyikan Panel' : 'Buka Panel'}
      onclick={onToggleHider}
    >
      {#if isOpen || workspaceMode === 'pine'}
        <ChevronRight size={15} />
      {:else}
        <ChevronLeft size={15} />
      {/if}
    </button>
  </div>
</aside>

<style>
  .right-dock-rail {
    width: 38px;
    min-width: 38px;
    height: 100%;
    background-color: var(--bg-surface, #121721);
    border-left: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    user-select: none;
    z-index: 40;
    flex-shrink: 0;
  }

  .dock-cluster {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
  }

  .dock-divider {
    width: 20px;
    height: 1px;
    background-color: var(--border-hairline, rgba(255, 255, 255, 0.08));
    margin: 4px 0;
  }

  .dock-btn {
    position: relative;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs, 4px);
    color: var(--text-muted, #8b949e);
    cursor: pointer;
    transition: all 0.12s cubic-bezier(0.16, 1, 0.3, 1);
    padding: 0;
  }

  .dock-btn:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-main, #e6edf3);
  }

  .dock-btn.active {
    background-color: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.35);
  }

  .dock-btn.pine-active {
    background-color: rgba(255, 105, 180, 0.14);
    color: #ff69b4;
    border-color: rgba(255, 105, 180, 0.4);
  }

  .dock-btn.active::before {
    content: '';
    position: absolute;
    right: -3px;
    top: 6px;
    bottom: 6px;
    width: 2.5px;
    background-color: currentColor;
    border-radius: 2px 0 0 2px;
  }

  .dock-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 13px;
    height: 13px;
    padding: 0 3px;
    border-radius: 7px;
    background: #ff3b69;
    color: #ffffff;
    font-size: 8.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    box-shadow: 0 0 6px rgba(255, 59, 105, 0.5);
  }

  .dock-badge.count-muted {
    background: rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
    box-shadow: none;
  }

  .hider-btn {
    color: var(--text-muted, #71767b);
  }

  .hider-btn:hover {
    color: var(--text-main, #ffffff);
    background-color: rgba(255, 255, 255, 0.08);
  }
</style>
