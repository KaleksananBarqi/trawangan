<script lang="ts">
  import { Eye, EyeOff, Code, X } from '@lucide/svelte';
  import type { ActiveIndicatorInfo } from '../types/market';

  interface Props {
    indicators: ActiveIndicatorInfo[];
    onToggleVisibility: (id: string) => void;
    onEditIndicator: (id: string) => void;
    onRemoveIndicator: (id: string) => void;
  }

  let {
    indicators,
    onToggleVisibility,
    onEditIndicator,
    onRemoveIndicator,
  }: Props = $props();
</script>

{#if indicators.length > 0}
  <div class="active-bar glass-panel mono-nums">
    <span class="active-label">ACTIVE ({indicators.length}):</span>
    <div class="indicators-track">
      {#each indicators as ind}
        <div class="indicator-chip {ind.visible ? '' : 'hidden'}">
          <span class="chip-title">{ind.title}</span>

          <button
            class="chip-action"
            title={ind.visible ? 'Sembunyikan' : 'Tampilkan'}
            onclick={() => onToggleVisibility(ind.id)}
          >
            {#if ind.visible}
              <Eye size={12} />
            {:else}
              <EyeOff size={12} />
            {/if}
          </button>

          {#if ind.source}
            <button
              class="chip-action"
              title="Edit kode skrip di Pine Editor"
              onclick={() => onEditIndicator(ind.id)}
            >
              <Code size={12} />
            </button>
          {/if}

          <button
            class="chip-action remove"
            title="Hapus dari chart"
            onclick={() => onRemoveIndicator(ind.id)}
          >
            <X size={12} />
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .active-bar {
    position: absolute;
    top: 8px;
    left: 48px; /* Di samping shared drawing toolbar Vela */
    height: 28px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    z-index: 40;
    pointer-events: auto;
  }

  .active-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-dim);
    letter-spacing: 0.05em;
  }

  .indicators-track {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .indicator-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-surface);
    border: 1px solid var(--border-medium);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-main);
    transition: all 0.15s;
  }

  .indicator-chip.hidden {
    opacity: 0.5;
  }

  .chip-title {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
    font-weight: 600;
  }

  .chip-action {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: 2px;
  }

  .chip-action:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }

  .chip-action.remove:hover {
    color: var(--bear-color);
  }
</style>
