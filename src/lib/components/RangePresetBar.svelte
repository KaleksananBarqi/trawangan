<!-- Komponen Toolbar Visible Range Presets -->
<!-- Bilah tombol rentang waktu institusional (1D, 5D, 1M, 3M, 6M, YTD, 1Y, ALL) -->
<!-- Memungkinkan navigasi cepat horizon waktu dan framing viewport dalam satu lintasan (single-pass) -->

<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    VISIBLE_RANGE_PRESETS,
    getRangePresetConfig,
    type VisibleRangePreset
  } from '../services/rangePresetService';
  import type { ChartSessionController } from '../services/chartSessionController';

  interface Props {
    controller?: ChartSessionController | null;
    activePreset?: VisibleRangePreset | null;
    onSelectPreset?: (preset: VisibleRangePreset) => void;
    className?: string;
  }

  let {
    controller = null,
    activePreset: propActivePreset = null,
    onSelectPreset,
    className = ''
  }: Props = $props();

  let controllerActivePreset = $state<VisibleRangePreset | null>(null);
  let unsubController: (() => void) | null = null;

  // Dengarkan perubahan state snapshot controller secara reaktif
  $effect(() => {
    if (unsubController) {
      unsubController();
      unsubController = null;
    }

    if (controller) {
      controllerActivePreset = controller.getActiveRangePreset();
      unsubController = controller.subscribe((snapshot) => {
        controllerActivePreset = snapshot.activeRangePreset ?? null;
      });
    } else {
      controllerActivePreset = null;
    }
  });

  onDestroy(() => {
    if (unsubController) {
      unsubController();
      unsubController = null;
    }
  });

  const effectiveActivePreset = $derived(
    propActivePreset !== null && propActivePreset !== undefined
      ? propActivePreset
      : controllerActivePreset
  );

  function handlePresetClick(preset: VisibleRangePreset) {
    if (onSelectPreset) {
      onSelectPreset(preset);
    } else if (controller) {
      void controller.setVisibleRangePreset(preset);
    }
  }
</script>

<nav
  class="range-preset-bar {className}"
  role="toolbar"
  aria-label="Preset Rentang Waktu Grafik"
>
  {#each VISIBLE_RANGE_PRESETS as preset (preset)}
    {@const config = getRangePresetConfig(preset)}
    {@const isActive = effectiveActivePreset === preset}
    <button
      type="button"
      class="range-chip-btn {isActive ? 'active' : ''} mono-nums"
      aria-pressed={isActive}
      title="{config.description} (Klik untuk membingkai grafik)"
      onclick={() => handlePresetClick(preset)}
    >
      {config.label}
    </button>
  {/each}
</nav>

<style>
  .range-preset-bar {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 5px;
    background: rgba(15, 23, 42, 0.82);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    user-select: none;
    z-index: 15;
  }

  .range-chip-btn {
    appearance: none;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-dim, #94a3b8);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1.2;
    padding: 3px 6px;
    cursor: pointer;
    transition: color 0.12s ease, background-color 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
  }

  .range-chip-btn:hover {
    color: var(--text-main, #f8fafc);
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .range-chip-btn:focus-visible {
    outline: 2px solid var(--brand-primary, #00f090);
    outline-offset: 1px;
  }

  .range-chip-btn.active {
    color: var(--brand-primary, #00f090);
    background: rgba(0, 240, 144, 0.12);
    border-color: rgba(0, 240, 144, 0.4);
    box-shadow: 0 0 8px rgba(0, 240, 144, 0.22);
    font-weight: 700;
  }
</style>
