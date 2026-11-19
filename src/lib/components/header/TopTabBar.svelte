<script lang="ts">
  import {
    Search,
    Plus,
    X,
    Settings,
    Moon,
    Sun,
    Monitor,
    Sparkles,
    Download,
    RefreshCw,
  } from '@lucide/svelte';
  import SymbolLogo from '../common/SymbolLogo.svelte';
  import { parseAdaptiveSymbol } from '../../services/market/symbolSearchService';
  import type { ChartTabItem } from '../../services/chartTabsService';
  import type { ColorModePreference } from '../../types/market';
  import {
    shouldShowUpdateBadge,
    getUpdatePillContent,
    type UpdateState,
  } from '../../services/updateService';

  interface Props {
    tabs: ChartTabItem[];
    activeTabId: string;
    onSelectTab?: (tabId: string) => void;
    onAddTab?: () => void;
    onCloseTab?: (tabId: string) => void;
    onReorderTabs?: (fromIndex: number, toIndex: number) => void;
    onOpenSymbolSearch?: () => void;
    updateState?: UpdateState;
    colorModePreference?: ColorModePreference;
    colorModeTooltip?: string;
    onCycleColorMode?: () => void;
    onOpenSettingsModal?: (
      tab?: 'general' | 'appearance' | 'chart' | 'feed' | 'system' | 'about' | 'help'
    ) => void;
  }

  let {
    tabs = [],
    activeTabId = '',
    onSelectTab,
    onAddTab,
    onCloseTab,
    onReorderTabs,
    onOpenSymbolSearch,
    updateState,
    colorModePreference = 'system',
    colorModeTooltip = 'Ganti mode warna tema',
    onCycleColorMode,
    onOpenSettingsModal,
  }: Props = $props();

  const canCloseTabs = $derived(tabs.length > 1);
  let draggedTabIndex = $state<number | null>(null);
  let dragOverTabIndex = $state<number | null>(null);

  function handleTabDragStart(e: DragEvent, index: number) {
    draggedTabIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleTabDragOver(e: DragEvent, index: number) {
    if (draggedTabIndex === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverTabIndex = index;
  }

  function handleTabDrop(e: DragEvent, toIndex: number) {
    e.preventDefault();
    if (draggedTabIndex !== null && draggedTabIndex !== toIndex) {
      onReorderTabs?.(draggedTabIndex, toIndex);
    }
    draggedTabIndex = null;
    dragOverTabIndex = null;
  }

  function handleTabDragEnd() {
    draggedTabIndex = null;
    dragOverTabIndex = null;
  }
</script>

<div class="top-tab-bar">
  <div class="top-bar-left">
    <div class="brand-badge" title="trawangan · Professional Crypto Charting Terminal">
      <img src="/no background.svg" alt="trawangan logo" class="brand-logo-img" />
      <span class="brand-title">trawangan</span>
    </div>

    <div class="tabs-strip" role="tablist" aria-label="Quick Chart Tabs">
      {#each tabs as tab, idx (tab.id)}
        {@const parsed = parseAdaptiveSymbol(tab.symbol)}
        {@const isActive = tab.id === activeTabId}
        <div
          class="chart-tab {isActive ? 'active' : ''} {dragOverTabIndex === idx && draggedTabIndex !== idx ? 'drag-over' : ''}"
          role="tab"
          tabindex="0"
          draggable={true}
          aria-selected={isActive}
          title="{tab.providerId.toUpperCase()}:{tab.symbol} · {tab.timeframe}"
          onclick={() => onSelectTab?.(tab.id)}
          ondragstart={(e) => handleTabDragStart(e, idx)}
          ondragover={(e) => handleTabDragOver(e, idx)}
          ondrop={(e) => handleTabDrop(e, idx)}
          ondragend={handleTabDragEnd}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectTab?.(tab.id);
            }
          }}
          onauxclick={(e) => {
            if (e.button === 1 && canCloseTabs) {
              e.preventDefault();
              onCloseTab?.(tab.id);
            }
          }}
        >
          <SymbolLogo
            baseAsset={parsed.baseAsset}
            quoteAsset={parsed.quoteAsset}
            symbol={tab.symbol}
            provider={tab.providerId}
            size="xs"
          />
          <span class="tab-symbol mono-nums">{tab.symbol}</span>
          <span class="tab-tf mono-nums">{tab.timeframe}</span>
          {#if canCloseTabs}
            <button
              type="button"
              class="tab-close-btn"
              title="Tutup tab"
              aria-label="Tutup tab {tab.symbol}"
              onclick={(e) => {
                e.stopPropagation();
                onCloseTab?.(tab.id);
              }}
            >
              <X size={11} />
            </button>
          {/if}
        </div>
      {/each}

      <button
        type="button"
        class="add-tab-btn"
        title="Buka tab chart baru"
        aria-label="Buka tab chart baru"
        onclick={() => onAddTab?.()}
      >
        <Plus size={13} />
      </button>
    </div>
  </div>

  <div class="top-bar-right">
    <button
      type="button"
      class="omni-search-box"
      title="Cari simbol atau pair (Ctrl+K)"
      onclick={() => onOpenSymbolSearch?.()}
    >
      <Search size={12} class="omni-search-icon" />
      <span class="omni-placeholder">Search symbol or pair...</span>
      <kbd class="omni-kbd mono-nums">Ctrl+K</kbd>
    </button>

    {#if updateState && shouldShowUpdateBadge(updateState) && updateState.updateInfo}
      {@const pill = getUpdatePillContent(updateState)}
      <button
        type="button"
        class="top-action-btn update-pill mono-nums"
        title="Versi baru {updateState.updateInfo.latestTag} — klik untuk mengelola pembaruan."
        onclick={() => onOpenSettingsModal?.('about')}
      >
        {#if pill.icon === 'download'}
          <Download size={12} />
        {:else if pill.icon === 'spin'}
          <RefreshCw size={12} class="spin" />
        {:else}
          <Sparkles size={12} class="update-sparkle-icon" />
        {/if}
        <span>{pill.label}</span>
      </button>
    {/if}

    <button
      type="button"
      class="top-action-btn icon-only color-mode-btn"
      title={colorModeTooltip}
      aria-label="Ganti mode warna tema"
      onclick={() => onCycleColorMode?.()}
    >
      {#if colorModePreference === 'dark'}
        <Moon size={13} />
      {:else if colorModePreference === 'light'}
        <Sun size={13} />
      {:else}
        <Monitor size={13} />
      {/if}
    </button>

    <button
      type="button"
      class="top-action-btn"
      title="Buka Pengaturan & Panduan Bantuan"
      onclick={() => onOpenSettingsModal?.('general')}
    >
      <Settings size={13} />
      <span>Setting</span>
    </button>
  </div>
</div>

<style>
  .top-tab-bar {
    height: 32px;
    background-color: var(--bg-panel, var(--bg-surface));
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    gap: 8px;
    min-width: 0;
  }

  .top-bar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .brand-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    flex-shrink: 0;
  }

  .brand-logo-img {
    width: 14px;
    height: 14px;
    object-fit: contain;
    display: block;
    filter: drop-shadow(0 0 5px rgba(255, 105, 180, 0.4));
  }

  .brand-title {
    font-family: var(--font-brand);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-main);
    text-transform: lowercase;
  }

  .tabs-strip {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tabs-strip::-webkit-scrollbar {
    display: none;
  }

  .chart-tab {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 7px;
    border-radius: var(--radius-xs);
    border: 1px solid transparent;
    background-color: transparent;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.12s ease;
    user-select: none;
  }

  .chart-tab:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .chart-tab.active {
    background-color: var(--bg-base);
    border-color: var(--border-bright, var(--border-hairline));
    color: var(--text-main);
  }

  .tab-symbol {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .tab-tf {
    font-size: 9.5px;
    font-weight: 600;
    color: var(--text-dim);
    background-color: var(--bg-container);
    padding: 0 4px;
    border-radius: 2px;
    line-height: 15px;
  }

  .chart-tab.active .tab-tf {
    color: var(--brand-primary, #00f090);
  }

  .tab-close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    padding: 0;
    border: none;
    border-radius: 2px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
    opacity: 0.65;
  }

  .tab-close-btn:hover {
    opacity: 1;
    background-color: rgba(239, 68, 68, 0.16);
    color: #f87171;
  }

  .add-tab-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: var(--radius-xs);
    border: 1px solid var(--border-hairline);
    background-color: var(--bg-base);
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.12s ease;
  }

  .add-tab-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .top-bar-right {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }

  .omni-search-box {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    min-width: 200px;
    padding: 0 7px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .omni-search-box:hover {
    border-color: var(--border-bright);
    color: var(--text-muted);
    background-color: var(--bg-hover);
  }

  :global(.omni-search-icon) {
    flex-shrink: 0;
    opacity: 0.8;
  }

  .omni-placeholder {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .omni-kbd {
    font-size: 9px;
    color: var(--text-dim);
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    padding: 0 4px;
    border-radius: 2px;
    line-height: 15px;
  }

  .top-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 7px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .top-action-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .top-action-btn.icon-only {
    padding: 0 6px;
  }

  .update-pill {
    background: rgba(255, 105, 180, 0.15) !important;
    border-color: rgba(255, 105, 180, 0.5) !important;
    color: var(--brand-primary) !important;
    font-weight: 700 !important;
    box-shadow: 0 0 10px rgba(255, 105, 180, 0.25);
  }

  :global(.update-sparkle-icon) {
    animation: sparkleSpin 3s linear infinite;
  }

  @keyframes sparkleSpin {
    0% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(180deg) scale(1.15);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
