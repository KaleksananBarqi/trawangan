<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Check, Copy, Database, Download, Link2, Wifi } from '@lucide/svelte';
  import { telemetryService, type TelemetryData } from '../../services/telemetryService';
  import userscriptSource from '../../../../scripts/trawangan-tradingview-bridge.user.js?raw';

  interface BridgeStatus {
    active: boolean;
    port: number;
    addr: string;
    error?: string | null;
  }

  let telemetry = $state<TelemetryData>(telemetryService.getSnapshot());
  let unsubTelemetry: (() => void) | null = null;
  let bridgeStatus = $state<BridgeStatus>({
    active: false,
    port: 47831,
    addr: '127.0.0.1:47831',
    error: null,
  });
  let bridgeChecked = $state(false);
  let copySuccess = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function refreshBridgeStatus() {
    try {
      const status = await invoke<BridgeStatus>('get_bridge_status');
      bridgeStatus = status;
    } catch {
      // Fallback probe HTTP untuk mode preview browser di luar Tauri runtime
      try {
        const res = await fetch('http://127.0.0.1:47831/ping', { mode: 'cors' });
        bridgeStatus = {
          active: res.ok,
          port: 47831,
          addr: '127.0.0.1:47831',
          error: res.ok ? null : `HTTP ${res.status}`,
        };
      } catch {
        bridgeStatus = {
          active: false,
          port: 47831,
          addr: '127.0.0.1:47831',
          error: 'Listener tidak aktif',
        };
      }
    } finally {
      bridgeChecked = true;
    }
  }

  async function copyUserscript() {
    try {
      await navigator.clipboard.writeText(userscriptSource);
      copySuccess = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copySuccess = false;
      }, 2000);
    } catch (err) {
      console.error('[SystemTab] Gagal menyalin userscript:', err);
    }
  }

  function downloadUserscript() {
    const blob = new Blob([userscriptSource], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trawangan-tradingview-bridge.user.js';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  onMount(() => {
    unsubTelemetry = telemetryService.subscribe((data) => {
      telemetry = data;
    });
    void refreshBridgeStatus();
  });

  onDestroy(() => {
    if (unsubTelemetry) {
      unsubTelemetry();
      unsubTelemetry = null;
    }
    if (copyTimer) {
      clearTimeout(copyTimer);
      copyTimer = null;
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

<div class="section-group">
  <div class="bridge-header">
    <div>
      <h4 class="section-title">TradingView Browser Bridge ({bridgeStatus.addr})</h4>
      <p class="section-desc">
        Menangkap tautan chart TradingView dari Firefox/Chrome secara instan via loopback HTTP tanpa dialog izin browser.
      </p>
    </div>
    <span
      class="bridge-badge mono-nums {bridgeStatus.active
        ? 'badge-active'
        : bridgeChecked
          ? 'badge-inactive'
          : 'badge-checking'}"
    >
      {bridgeStatus.active ? 'ACTIVE' : bridgeChecked ? 'OFFLINE' : 'CHECKING'}
    </span>
  </div>

  <div class="bridge-card">
    <div class="bridge-meta">
      <Link2 size={14} class="text-cyan" />
      <span class="bridge-hint">
        Pasang Userscript di Tampermonkey atau Violentmonkey. Tambahkan <code>?notrawangan=1</code> pada URL untuk tetap membuka di browser.
      </span>
    </div>

    {#if bridgeStatus.error && !bridgeStatus.active && bridgeChecked}
      <div class="bridge-error mono-nums">{bridgeStatus.error}</div>
    {/if}

    <div class="bridge-actions">
      <button type="button" class="bridge-btn primary" onclick={copyUserscript}>
        {#if copySuccess}
          <Check size={13} />
          <span>Userscript Tersalin</span>
        {:else}
          <Copy size={13} />
          <span>Salin Userscript (Tampermonkey / Violentmonkey)</span>
        {/if}
      </button>

      <button type="button" class="bridge-btn" onclick={downloadUserscript}>
        <Download size={13} />
        <span>Simpan File .user.js</span>
      </button>
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

  .bridge-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .bridge-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .badge-active {
    background-color: rgba(63, 185, 80, 0.14);
    color: #3fb950;
    border: 1px solid rgba(63, 185, 80, 0.35);
  }

  .badge-inactive {
    background-color: rgba(248, 81, 73, 0.14);
    color: #f85149;
    border: 1px solid rgba(248, 81, 73, 0.35);
  }

  .badge-checking {
    background-color: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .bridge-card {
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bridge-meta {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11px;
    color: var(--text-dim, #8b949e);
    line-height: 1.45;
  }

  .bridge-hint code {
    color: var(--text-base, #ffffff);
    background-color: rgba(110, 118, 129, 0.2);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .bridge-error {
    font-size: 10px;
    color: #f85149;
  }

  .bridge-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .bridge-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 5px;
    border: 1px solid var(--border-subtle, #30363d);
    background-color: rgba(110, 118, 129, 0.12);
    color: var(--text-base, #ffffff);
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .bridge-btn:hover {
    background-color: rgba(110, 118, 129, 0.22);
  }

  .bridge-btn.primary {
    border-color: rgba(56, 189, 248, 0.4);
    background-color: rgba(56, 189, 248, 0.14);
    color: #38bdf8;
  }

  .bridge-btn.primary:hover {
    background-color: rgba(56, 189, 248, 0.24);
  }
</style>
