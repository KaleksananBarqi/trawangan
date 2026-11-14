<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TableProperties, Crosshair, Calendar, BarChart3, SlidersHorizontal } from '@lucide/svelte';
  import {
    dataWindowService,
    formatDataWindowSections,
    type DataWindowState,
    type DataWindowSection
  } from '../services/dataWindowService';

  interface Props {
    activeSymbol?: string;
  }

  let { activeSymbol = '' }: Props = $props();

  let snapshot = $state<DataWindowState>(dataWindowService.getSnapshot());
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    unsubscribe = dataWindowService.subscribe((next) => {
      snapshot = next;
    });
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });

  let sections = $derived<DataWindowSection[]>(formatDataWindowSections(snapshot.readout));
</script>

<div class="data-window-panel" aria-label="Data Window Inspector">
  <!-- Sub-Toolbar Header -->
  <div class="sub-toolbar">
    <div class="toolbar-title-wrap">
      <TableProperties size={13} class="panel-icon text-cyan" />
      <span class="sub-title">Data Window</span>
      {#if activeSymbol}
        <span class="symbol-tag mono-nums">{activeSymbol}</span>
      {/if}
    </div>

    <div class="toolbar-status">
      {#if snapshot.isHovered}
        <span class="status-pill active mono-nums" title="Membaca data lilin di bawah kursor">
          <Crosshair size={10} class="pulse-icon" />
          <span>Kursor</span>
        </span>
      {:else if snapshot.hasData}
        <span class="status-pill muted mono-nums" title="Menampilkan data lilin terakhir (kursor di luar kanvas)">
          <span>Bar Terakhir</span>
        </span>
      {:else}
        <span class="status-pill idle mono-nums">Standby</span>
      {/if}
    </div>
  </div>

  <!-- Content Inspector View -->
  <div class="data-window-content">
    {#if !snapshot.hasData || sections.length === 0}
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <Crosshair size={24} class="empty-icon" />
        </div>
        <p class="empty-title">Data Window Siap</p>
        <p class="empty-desc">
          Gerakkan kursor crosshair di atas chart untuk memeriksa rincian harga OHLCV dan nilai seluruh plot indikator secara presisi.
        </p>
      </div>
    {:else}
      <div class="sections-scroll">
        {#each sections as section (section.title)}
          <div class="dw-group">
            <div class="dw-group-header">
              <span class="group-icon">
                {#if section.title === 'Time'}
                  <Calendar size={11} />
                {:else if section.title === 'Price'}
                  <BarChart3 size={11} />
                {:else}
                  <SlidersHorizontal size={11} />
                {/if}
              </span>
              <span class="group-title">{section.title}</span>
            </div>

            <div class="dw-group-body">
              {#each section.lines as line (line.label)}
                <div class="dw-row">
                  <span class="dw-label" title={line.label}>{line.label}</span>
                  <div class="dw-value-wrap">
                    {#if line.color && section.title !== 'Price' && section.title !== 'Time'}
                      <span
                        class="dw-color-dot"
                        style="background-color: {line.color};"
                        aria-hidden="true"
                      ></span>
                    {/if}
                    <span
                      class="dw-value mono-nums"
                      style={line.color ? `color: ${line.color};` : ''}
                    >
                      {line.value}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .data-window-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--bg-surface);
    color: var(--text-main);
    overflow: hidden;
  }

  .sub-toolbar {
    padding: 6px 10px;
    background-color: var(--bg-base);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
    min-height: 32px;
  }

  .toolbar-title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }

  .panel-icon {
    flex-shrink: 0;
  }

  .text-cyan {
    color: var(--brand-cyan, #38bdf8);
  }

  .sub-title {
    font-size: var(--font-size-base, 11px);
    font-weight: 700;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .symbol-tag {
    font-size: var(--font-size-2xs, 9px);
    padding: 1px 5px;
    border-radius: 3px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
  }

  .toolbar-status {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-2xs, 9px);
    padding: 2px 6px;
    border-radius: 10px;
    border: 1px solid var(--border-hairline);
  }

  .status-pill.active {
    background-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 12%, transparent);
    border-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 32%, transparent);
    color: var(--brand-cyan, #38bdf8);
  }

  .status-pill.muted {
    background-color: var(--bg-panel);
    color: var(--text-dim);
  }

  .status-pill.idle {
    background-color: transparent;
    color: var(--text-disabled);
  }

  .pulse-icon {
    animation: pulseGlow 1.5s infinite ease-in-out;
  }

  @keyframes pulseGlow {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .data-window-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 8px;
    gap: 8px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px 16px;
    color: var(--text-muted);
  }

  .empty-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    color: var(--brand-cyan, #38bdf8);
  }

  .empty-title {
    font-size: var(--font-size-md, 12px);
    font-weight: 600;
    color: var(--text-main);
    margin: 0 0 6px 0;
  }

  .empty-desc {
    font-size: var(--font-size-sm, 10px);
    color: var(--text-dim);
    line-height: 1.45;
    margin: 0;
    max-width: 220px;
  }

  .sections-scroll {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dw-group {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: 4px;
    overflow: hidden;
  }

  .dw-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-subtle);
    font-size: var(--font-size-sm, 10px);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .group-icon {
    display: flex;
    align-items: center;
    color: var(--text-dim);
  }

  .group-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dw-group-body {
    display: flex;
    flex-direction: column;
  }

  .dw-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--border-hairline) 40%, transparent);
    font-size: var(--font-size-sm, 10px);
    transition: background-color 0.1s ease;
  }

  .dw-row:last-child {
    border-bottom: none;
  }

  .dw-row:hover {
    background-color: var(--bg-hover);
  }

  .dw-label {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
  }

  .dw-value-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .dw-color-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dw-value {
    color: var(--text-main);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
