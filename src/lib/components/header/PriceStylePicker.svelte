<script lang="ts">
  import {
    ChartCandlestick,
    ChartBar,
    ChartLine,
    ChartArea,
    Baseline,
    ChevronDown,
    Check
  } from '@lucide/svelte';
  import type { PriceStyle, PriceStyleOption } from '../../types/market';
  import { PRICE_STYLE_OPTIONS } from '../../types/market';

  interface Props {
    activePriceStyle?: PriceStyle | string;
    onPriceStyleChange: (style: PriceStyle) => void;
  }

  let {
    activePriceStyle = 'candles',
    onPriceStyleChange
  }: Props = $props();

  let showMenu = $state(false);

  // Helper untuk memetakan ikon yang sesuai per gaya grafik
  function getStyleIcon(style: string) {
    switch (style) {
      case 'heikinashi':
      case 'candles':
        return ChartCandlestick;
      case 'bars':
        return ChartBar;
      case 'line':
        return ChartLine;
      case 'area':
        return ChartArea;
      case 'baseline':
        return Baseline;
      default:
        return ChartCandlestick;
    }
  }

  const currentOption = $derived.by(() => {
    return PRICE_STYLE_OPTIONS.find((opt) => opt.id === activePriceStyle) || PRICE_STYLE_OPTIONS[0];
  });

  const ActiveIcon = $derived(getStyleIcon(activePriceStyle));

  function handleSelect(style: PriceStyle) {
    onPriceStyleChange(style);
    showMenu = false;
  }

  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (showMenu && !target.closest('.price-style-picker-group')) {
      showMenu = false;
    }
  }
</script>

<svelte:window onclick={handleGlobalClick} />

<div class="price-style-picker-group">
  <button
    type="button"
    class="style-trigger-btn {showMenu ? 'open' : ''}"
    title="Gaya Tampilan Grafik: {currentOption.label} ({currentOption.description})"
    onclick={() => (showMenu = !showMenu)}
  >
    <ActiveIcon size={13} class="trigger-icon {activePriceStyle === 'heikinashi' ? 'text-brand' : 'text-cyan-accent'}" />
    <span class="trigger-label">{currentOption.label}</span>
    <ChevronDown size={11} class="dropdown-chevron {showMenu ? 'open' : ''}" />
  </button>

  {#if showMenu}
    <div class="style-dropdown obsidian-panel" role="menu">
      <div class="dropdown-header">
        <span>GAYA TAMPILAN HARGA</span>
      </div>

      <div class="style-options-list">
        {#each PRICE_STYLE_OPTIONS as opt (opt.id)}
          {@const ItemIcon = getStyleIcon(opt.id)}
          {@const isActive = activePriceStyle === opt.id}
          <button
            type="button"
            class="style-item-btn {isActive ? 'active' : ''}"
            role="menuitem"
            onclick={() => handleSelect(opt.id)}
          >
            <div class="item-left">
              <span class="item-icon-wrap {isActive ? 'active-icon' : ''}">
                <ItemIcon size={14} />
              </span>
              <div class="item-text">
                <div class="item-title-row">
                  <span class="item-title">{opt.label}</span>
                  {#if opt.id === 'heikinashi'}
                    <span class="ha-badge mono-nums">HA</span>
                  {/if}
                </div>
                <span class="item-desc">{opt.description}</span>
              </div>
            </div>

            {#if isActive}
              <Check size={12} class="check-icon" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .price-style-picker-group {
    position: relative;
    display: flex;
    align-items: center;
  }

  .style-trigger-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--color-text-secondary, #94a3b8);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    white-space: nowrap;
  }

  .style-trigger-btn:hover {
    background: var(--color-bg-hover, rgba(255, 255, 255, 0.04));
    color: var(--color-text-primary, #f1f5f9);
    border-color: var(--color-border-subtle, rgba(255, 255, 255, 0.08));
  }

  .style-trigger-btn.open {
    background: var(--color-bg-active, rgba(56, 189, 248, 0.1));
    color: var(--color-primary, #38bdf8);
    border-color: rgba(56, 189, 248, 0.3);
  }

  .trigger-icon {
    flex-shrink: 0;
  }

  :global(.text-brand) {
    color: var(--color-brand, #38bdf8);
  }

  :global(.text-cyan-accent) {
    color: var(--color-cyan, #06b6d4);
  }

  .trigger-label {
    letter-spacing: -0.01em;
  }

  .dropdown-chevron {
    transition: transform 0.15s ease;
    color: var(--color-text-muted, #64748b);
  }

  .dropdown-chevron.open {
    transform: rotate(180deg);
    color: var(--color-text-primary, #f1f5f9);
  }

  /* Dropdown Popover */
  .style-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 260px;
    background: var(--color-bg-surface, #0f172a);
    border: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    padding: 4px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    backdrop-filter: blur(12px);
  }

  .dropdown-header {
    padding: 6px 8px 4px 8px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--color-text-muted, #64748b);
    border-bottom: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.06));
    margin-bottom: 4px;
  }

  .style-options-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .style-item-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s ease;
  }

  .style-item-btn:hover {
    background: var(--color-bg-hover, rgba(255, 255, 255, 0.05));
  }

  .style-item-btn.active {
    background: var(--color-bg-active, rgba(56, 189, 248, 0.12));
    border-color: rgba(56, 189, 248, 0.25);
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .item-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--color-text-secondary, #94a3b8);
    flex-shrink: 0;
  }

  .item-icon-wrap.active-icon {
    background: rgba(56, 189, 248, 0.15);
    color: var(--color-primary, #38bdf8);
  }

  .item-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .item-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .item-title {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-primary, #f1f5f9);
  }

  .ha-badge {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 2px;
    background: rgba(56, 189, 248, 0.2);
    color: #38bdf8;
  }

  .item-desc {
    font-size: 9.5px;
    color: var(--color-text-muted, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .check-icon {
    color: var(--color-primary, #38bdf8);
    flex-shrink: 0;
  }
</style>
