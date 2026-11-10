<script lang="ts">
  import {
    Flame,
    Bell,
    Layers,
    Sparkles,
    Code,
    ChevronRight,
    ChevronLeft
  } from '@lucide/svelte';
  import type { RightDockTab } from '../services/workspaceShellService';
  import type { WorkspaceMode } from '../types/market';

  interface Props {
    isOpen: boolean;
    activeTab: RightDockTab | null;
    workspaceMode?: WorkspaceMode;
    activeAlertsCount?: number;
    activeIndicatorsCount?: number;
    activePlansCount?: number;
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
    activePlansCount = 0,
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

    <!-- 4. Trade Plan (Form, Teks & Riwayat) -->
    <button
      type="button"
      class="dock-btn {isOpen && activeTab === 'plan' && workspaceMode !== 'pine' ? 'active' : ''}"
      title="Trade Plan: Form, Teks & Riwayat ({activePlansCount} Aktif)"
      onclick={() => onToggleTab('plan')}
    >
      <Sparkles size={16} class="dock-icon" />
      {#if activePlansCount > 0}
        <span class="dock-badge count-cyan mono-nums">{activePlansCount}</span>
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
    background-color: var(--bg-surface);
    border-left: 1px solid var(--border-hairline);
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
    background-color: var(--border-hairline);
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
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s cubic-bezier(0.16, 1, 0.3, 1);
    padding: 0;
  }

  .dock-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .dock-btn:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: -1px;
  }

  .dock-btn.active {
    background-color: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    color: var(--brand-cyan);
    border-color: color-mix(in srgb, var(--brand-cyan) 38%, transparent);
  }

  .dock-btn.pine-active {
    background-color: color-mix(in srgb, var(--brand-primary) 16%, transparent);
    color: var(--brand-primary);
    border-color: color-mix(in srgb, var(--brand-primary) 42%, transparent);
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
    background: var(--bear-color);
    color: var(--on-bear-color, #0F0F0F);
    font-size: var(--font-size-2xs, 8.5px);
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    box-shadow: 0 0 6px var(--bear-glow);
  }

  .dock-badge.count-muted {
    background: var(--bg-elevated);
    color: var(--text-main);
    box-shadow: none;
  }

  .dock-badge.count-cyan {
    background: var(--brand-cyan);
    color: var(--bg-darkest);
    box-shadow: none;
  }

  .hider-btn {
    color: var(--text-muted);
  }

  .hider-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }
</style>
