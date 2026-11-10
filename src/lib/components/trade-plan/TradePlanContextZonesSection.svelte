<script lang="ts">
  import { ChevronDown, ChevronRight, Plus, Trash2 } from '@lucide/svelte';
  import type { ZonePolarity } from '../../services/planParserService';
  import type { PlanFormZoneDraft } from '../../services/tradePlanFormService';

  interface Props {
    zones: PlanFormZoneDraft[];
    isOpen: boolean;
    onToggleOpen: () => void;
    onAddZone: () => void;
    onRemoveZone: (index: number) => void;
    onUpdateZone: (index: number, patch: Partial<PlanFormZoneDraft>) => void;
  }

  let {
    zones,
    isOpen,
    onToggleOpen,
    onAddZone,
    onRemoveZone,
    onUpdateZone,
  }: Props = $props();
</script>

<div class="form-card collapsible-card">
  <div class="collapsible-header-row">
    <button
      type="button"
      class="collapsible-toggle"
      onclick={onToggleOpen}
      aria-expanded={isOpen}
    >
      {#if isOpen}
        <ChevronDown size={13} />
      {:else}
        <ChevronRight size={13} />
      {/if}
      <span>Context Zones (FVG / OB / IDM)</span>
      {#if zones.length > 0}
        <span class="mini-count mono-nums">{zones.length}</span>
      {/if}
    </button>

    <button
      type="button"
      class="btn-inline-add"
      onclick={onAddZone}
    >
      <Plus size={11} />
      <span>Zona</span>
    </button>
  </div>

  {#if isOpen}
    <div class="collapsible-body">
      {#if zones.length === 0}
        <div class="empty-zone-hint">
          Belum ada zona konteks. Klik "+ Zona" untuk menandai area FVG/OB/IDM di chart.
        </div>
      {:else}
        {#each zones as z, zIdx (z.id)}
          <div class="zone-editor-card">
            <div class="zone-top-inputs">
              <input
                type="text"
                class="form-input zone-label-input"
                value={z.label}
                placeholder="Label (mis. Bearish FVG 15m)"
                aria-label="Label zona konteks {zIdx + 1}"
                oninput={(e) => onUpdateZone(zIdx, { label: e.currentTarget.value })}
              />
              <select
                class="form-select zone-polarity-select"
                value={z.polarity}
                aria-label="Polaritas zona konteks {zIdx + 1}"
                onchange={(e) => onUpdateZone(zIdx, { polarity: e.currentTarget.value as ZonePolarity })}
              >
                <option value="bull">Bullish</option>
                <option value="bear">Bearish</option>
                <option value="neutral">Netral</option>
              </select>
              <button
                type="button"
                class="btn-row-remove"
                title="Hapus zona ini"
                aria-label="Hapus zona konteks {zIdx + 1}"
                onclick={() => onRemoveZone(zIdx)}
              >
                <Trash2 size={11} />
              </button>
            </div>
            <div class="zone-price-inputs">
              <input
                type="text"
                inputmode="decimal"
                class="form-input mono-nums"
                value={z.low}
                placeholder="Batas Bawah (Low)"
                aria-label="Batas bawah zona konteks {zIdx + 1}"
                oninput={(e) => onUpdateZone(zIdx, { low: e.currentTarget.value })}
              />
              <input
                type="text"
                inputmode="decimal"
                class="form-input mono-nums"
                value={z.high}
                placeholder="Batas Atas (High)"
                aria-label="Batas atas zona konteks {zIdx + 1}"
                oninput={(e) => onUpdateZone(zIdx, { high: e.currentTarget.value })}
              />
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .form-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-lg);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .collapsible-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .collapsible-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 0;
    cursor: pointer;
    flex: 1;
    text-align: left;
  }

  .collapsible-toggle:hover {
    color: var(--text-main);
  }

  .collapsible-toggle:focus-visible,
  .btn-inline-add:focus-visible,
  .btn-row-remove:focus-visible,
  .form-input:focus-visible,
  .form-select:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: 1px;
  }

  .mini-count {
    font-size: var(--font-size-xs);
    padding: 0 5px;
    border-radius: var(--radius-sm);
    background-color: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    color: var(--brand-cyan);
  }

  .btn-inline-add {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    background-color: color-mix(in srgb, var(--brand-cyan) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-cyan) 28%, transparent);
    border-radius: var(--radius-md);
    color: var(--brand-cyan);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-inline-add:hover {
    background-color: color-mix(in srgb, var(--brand-cyan) 20%, transparent);
  }

  .collapsible-body {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding-top: 4px;
    border-top: 1px solid var(--border-hairline);
  }

  .empty-zone-hint {
    font-size: var(--font-size-sm);
    color: var(--text-dim);
    text-align: center;
    padding: 6px;
  }

  .zone-editor-card {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 6px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
  }

  .zone-top-inputs {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .form-input,
  .form-select {
    width: 100%;
    box-sizing: border-box;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    color: var(--text-main);
    font-size: var(--font-size-base);
    padding: 5px 7px;
    transition: border-color 0.12s ease;
  }

  .form-input:focus,
  .form-select:focus {
    border-color: var(--border-focus);
  }

  .zone-label-input {
    flex: 1;
    min-width: 0;
  }

  .zone-polarity-select {
    width: 78px;
    flex-shrink: 0;
    font-size: var(--font-size-sm);
  }

  .zone-price-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }

  .btn-row-remove {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-dim);
    padding: 4px;
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .btn-row-remove:hover {
    color: var(--status-danger);
    background-color: color-mix(in srgb, var(--status-danger) 12%, transparent);
  }
</style>
