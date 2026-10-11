<script lang="ts">
  import { LayoutGrid, Crosshair, Share2, Move, Coins, Layers } from '@lucide/svelte';
  import type { MultiChartSyncConfig } from '../../types/market';

  interface Props {
    currentLayout: string;
    syncConfig?: MultiChartSyncConfig;
    onLayoutChange: (layout: string) => void;
    onToggleSyncCrosshair?: () => void;
    onToggleSyncViewport?: () => void;
    onToggleSyncSymbol?: () => void;
    onToggleSyncDrawings?: () => void;
    onToggleSyncIndicators?: () => void;
  }

  let {
    currentLayout,
    syncConfig = { crosshair: true, viewport: true, symbol: false, drawings: true, indicators: true },
    onLayoutChange,
    onToggleSyncCrosshair,
    onToggleSyncViewport,
    onToggleSyncSymbol,
    onToggleSyncDrawings,
    onToggleSyncIndicators
  }: Props = $props();

  const layouts = [
    { id: '1', label: '1 Chart' },
    { id: '2h', label: '2 Hori' },
    { id: '2v', label: '2 Vert' },
    { id: '4', label: '4 Grid' },
  ];
</script>

<div class="layout-bar">
  {#each layouts as l}
    <button
      class="layout-btn {currentLayout === l.id ? 'active' : ''}"
      title="Ganti tata letak {l.label}"
      onclick={() => onLayoutChange(l.id)}
    >
      <LayoutGrid size={12} />
      <span class="mono-nums">{l.id}</span>
    </button>
  {/each}

  {#if currentLayout !== '1'}
    <div class="sync-group">
      <button
        class="sync-toggle-btn {syncConfig.crosshair ? 'active' : ''}"
        title="Sinkronisasi Kursor Crosshair ({syncConfig.crosshair ? 'ON' : 'OFF'})"
        onclick={onToggleSyncCrosshair}
      >
        <Crosshair size={12} />
      </button>
      <button
        class="sync-toggle-btn {syncConfig.viewport ? 'active' : ''}"
        title="Sinkronisasi Gerakan & Rentang Waktu Viewport ({syncConfig.viewport ? 'ON' : 'OFF'})"
        onclick={onToggleSyncViewport}
      >
        <Move size={12} />
      </button>
      <button
        class="sync-toggle-btn {syncConfig.symbol ? 'active' : ''}"
        title="Sinkronisasi Simbol/Ticker Pasangan ({syncConfig.symbol ? 'ON' : 'OFF'})"
        onclick={onToggleSyncSymbol}
      >
        <Coins size={12} />
      </button>
      <button
        class="sync-toggle-btn {syncConfig.drawings ? 'active' : ''}"
        title="Sinkronisasi Objek Gambar Analisis ({syncConfig.drawings ? 'ON' : 'OFF'})"
        onclick={onToggleSyncDrawings}
      >
        <Share2 size={12} />
      </button>
      <button
        class="sync-toggle-btn {syncConfig.indicators ? 'active' : ''}"
        title="Sinkronisasi Indikator Teknikal ({syncConfig.indicators ? 'ON' : 'OFF'})"
        onclick={onToggleSyncIndicators}
      >
        <Layers size={12} />
      </button>
    </div>
  {/if}
</div>

<style>
  .layout-bar {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .layout-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 5px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .layout-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .layout-btn.active {
    color: var(--brand-primary);
    border-color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.08);
  }

  .sync-group {
    display: flex;
    gap: 2px;
    margin-left: 2px;
  }

  .sync-toggle-btn {
    padding: 3px 5px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .sync-toggle-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .sync-toggle-btn.active {
    color: var(--brand-cyan);
    border-color: var(--brand-cyan);
    background-color: rgba(56, 189, 248, 0.1);
  }
</style>
