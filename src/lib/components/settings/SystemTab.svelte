<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Database, Wifi } from '@lucide/svelte';
  import { telemetryService, type TelemetryData } from '../../services/telemetryService';

  let telemetry = $state<TelemetryData>(telemetryService.getSnapshot());
  let unsubTelemetry: (() => void) | null = null;

  onMount(() => {
    unsubTelemetry = telemetryService.subscribe((data) => {
      telemetry = data;
    });
  });

  onDestroy(() => {
    if (unsubTelemetry) {
      unsubTelemetry();
      unsubTelemetry = null;
    }
  });
</script>

<div class="section-group">
  <h4 class="section-title">Status Akselerasi WebGL 2.0 & Native Core</h4>
  <p class="section-desc">
    Informasi telemetri perangkat keras dipindahkan ke sini agar area kerja grafik tetap bersih dan maksimal.
  </p>

  <div class="telemetry-grid mono-nums">
    <div class="telemetry-card">
      <span class="card-label">Target Rendering</span>
      <span class="card-value {telemetry.fps >= 55 ? 'text-bull' : telemetry.fps >= 30 ? 'text-amber' : 'text-bear'}">{telemetry.fps} FPS</span>
      <span class="card-sub">Actual Canvas Frame Rate</span>
    </div>

    <div class="telemetry-card">
      <span class="card-label">Estimasi RAM Buffer</span>
      <span class="card-value">{telemetry.memoryMb.toFixed(1)} MB</span>
      <span class="card-sub">{telemetry.nativeProcessMb ? 'Windows Working Set' : 'JS Heap Memory'}</span>
    </div>

    <div class="telemetry-card">
      <span class="card-label">Network Latency (Ping)</span>
      <span class="card-value {telemetry.isOnline && telemetry.latencyMs !== null ? 'text-cyan' : 'text-bear'}">
        {telemetry.isOnline && telemetry.latencyMs !== null ? `${telemetry.latencyMs} ms` : 'Offline / Timeout'}
      </span>
      <span class="card-sub">RTT to {telemetry.providerName}</span>
    </div>

    <div class="telemetry-card">
      <span class="card-label">Packet Drop Health</span>
      <span class="card-value {telemetry.packetDrops > 0 ? 'text-amber' : ''}">{telemetry.packetDrops} Gagal / Drop</span>
      <span class="card-sub">{telemetry.packetDrops === 0 ? 'Zero connection loss' : 'Detected drops'}</span>
    </div>
  </div>

  <div class="status-summary obsidian-card">
    <div class="status-item">
      <Database size={14} class="text-bull" />
      <span>SQLite rusqlite: <strong>Local Offline Active</strong></span>
    </div>
    <div class="status-item">
      <Wifi size={14} class="text-cyan" />
      <span>Engine: <strong>Tauri v2 Native Rust Backend</strong></span>
    </div>
  </div>
</div>

<style>
  .section-group {
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-desc {
    font-size: 11px;
    color: var(--text-dim, #6e7681);
    margin: 4px 0 0 0;
    line-height: 1.4;
  }

  .telemetry-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .telemetry-card {
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-label {
    font-size: 11px;
    color: var(--text-dim, #6e7681);
  }

  .card-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
  }

  .card-sub {
    font-size: 10px;
    color: var(--text-dim, #6e7681);
  }

  .text-bull {
    color: #3fb950;
  }

  .text-bear {
    color: #f85149;
  }

  .text-amber {
    color: #f59e0b;
  }

  .text-cyan {
    color: #38bdf8;
  }

  .status-summary {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    font-size: 11px;
    color: var(--text-base, #ffffff);
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
