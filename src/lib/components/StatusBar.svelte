<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Cpu,
    Database,
    HardDrive,
    Clock,
    Terminal,
    ChevronUp,
    ChevronDown,
    Activity,
    Wifi,
    Zap,
    Coffee,
    Sparkles
  } from '@lucide/svelte';
  import { telemetryService, type TelemetryData } from '../services/telemetryService';
  import { updateService, type UpdateState } from '../services/updateService';
  import { openExternalUrl } from '../services/urlService';
  import { marketFeed } from '../services/market';
  import type { FeedConnectionStatus } from '../services/market/types';

  interface Props {
    isConsoleOpen: boolean;
    onToggleConsole: () => void;
    onOpenAbout?: () => void;
  }

  let { isConsoleOpen, onToggleConsole, onOpenAbout }: Props = $props();

  let currentTime = $state('');
  let timeInterval: any = null;
  let telemetry = $state<TelemetryData>(telemetryService.getSnapshot());
  let unsubTelemetry: (() => void) | null = null;
  let updateState = $state<UpdateState>(updateService.getSnapshot());
  let unsubUpdate: (() => void) | null = null;
  let feedStatus = $state<FeedConnectionStatus>(marketFeed.getConnectionStatus());
  let unsubFeed: (() => void) | null = null;

  function updateClock() {
    const now = new Date();
    currentTime = now.toLocaleTimeString('id-ID', { hour12: false });
  }

  onMount(() => {
    updateClock();
    timeInterval = setInterval(updateClock, 1000);
    unsubTelemetry = telemetryService.subscribe((data) => {
      telemetry = data;
    });
    unsubUpdate = updateService.subscribe((data) => {
      updateState = data;
    });
    unsubFeed = marketFeed.onConnectionChange((st) => {
      feedStatus = st;
    });
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
    if (unsubTelemetry) unsubTelemetry();
    if (unsubUpdate) unsubUpdate();
    if (unsubFeed) unsubFeed();
  });
</script>

<footer class="system-status-bar">
  <!-- Left Telemetry Cluster: Sistem Dasar -->
  <div class="left-cluster">
    {#if updateState.status === 'available' && updateState.updateInfo}
      <button
        class="telemetry-pill update-status-pill mono-nums"
        title="Pembaruan {updateState.updateInfo.latestTag} siap! Klik untuk melihat rilis."
        onclick={onOpenAbout}
      >
        <Sparkles size={11} class="text-pink-sparkle" />
        <span class="pill-badge badge-update">Update {updateState.updateInfo.latestTag}</span>
      </button>

      <div class="divider"></div>
    {/if}

    <div class="telemetry-pill">
      <span class="live-pip"></span>
      <span class="pill-text font-bold">Engine: NATIVE_SYS_X64</span>
    </div>

    <div class="divider"></div>

    <div class="telemetry-pill">
      <Database size={12} class="text-bull" />
      <span class="pill-text">SQLite Local ACTIVE</span>
    </div>

    <div class="divider"></div>

    <div class="telemetry-pill">
      <Terminal size={12} class="text-bull" />
      <span class="pill-text text-bull">Pine Script v6 Runtime Ready</span>
    </div>
  </div>

  <!-- Right Time & Real-Time Performance Cluster -->
  <div class="right-cluster">
    <!-- Real-Time FPS Metric -->
    <div
      class="telemetry-pill interactive mono-nums"
      title="Actual WebGL2 Render Frame Rate: {telemetry.fps} FPS"
    >
      <span class="icon-dim"><Zap size={11} class={telemetry.fps >= 55 ? 'text-bull' : telemetry.fps >= 30 ? 'text-amber' : 'text-bear'} /></span>
      <span class="pill-badge {telemetry.fps >= 55 ? 'badge-bull' : telemetry.fps >= 30 ? 'badge-amber' : 'badge-bear'}">
        {telemetry.fps} FPS
      </span>
    </div>

    <div class="divider"></div>

    <!-- Real-Time Network Latency (Ping) Metric & Feed Connection Guard Indicator -->
    <div
      class="telemetry-pill interactive mono-nums"
      title="Status Feed: {feedStatus.state === 'blocked' ? 'Koneksi Terhambat / Diblokir ISP' : feedStatus.state === 'stalled' ? 'Koneksi Tersendat' : 'Terkoneksi Stabil'}. Round-Trip Ping ke {telemetry.providerName}: {telemetry.latencyMs !== null ? `${telemetry.latencyMs} ms` : 'Offline / Timeout'} (Packet Drops: {telemetry.packetDrops})"
    >
      <span class="icon-dim"><Wifi size={11} class={feedStatus.state === 'blocked' || !telemetry.isOnline ? 'text-bear' : feedStatus.state === 'stalled' || (telemetry.latencyMs || 0) > 150 ? 'text-amber' : 'text-bull'} /></span>
      {#if feedStatus.state === 'blocked'}
        <span class="pill-badge badge-bear">FEED BLOCKED</span>
      {:else if feedStatus.state === 'stalled'}
        <span class="pill-badge badge-amber">FEED STALLED</span>
      {:else if telemetry.isOnline && telemetry.latencyMs !== null}
        <span class="pill-text {telemetry.latencyMs > 150 ? 'text-amber' : 'text-bull'}">
          {telemetry.latencyMs}ms
        </span>
      {:else}
        <span class="pill-badge badge-bear">OFFLINE</span>
      {/if}
    </div>

    <div class="divider"></div>

    <!-- Real-Time RAM Usage Metric -->
    <div
      class="telemetry-pill interactive mono-nums"
      title="Pemakaian RAM Real-Time: {telemetry.nativeProcessMb ? `Working Set Windows: ${telemetry.nativeProcessMb} MB` : ''}{telemetry.jsHeapMb ? ` (JS Heap: ${telemetry.jsHeapMb} MB)` : ''}"
    >
      <span class="icon-dim"><HardDrive size={11} /></span>
      <span class="pill-text">RAM: {telemetry.memoryMb.toFixed(1)}MB</span>
    </div>

    <div class="divider"></div>

    <!-- Clock -->
    <div class="telemetry-pill mono-nums">
      <span class="icon-dim"><Clock size={11} /></span>
      <span class="pill-text">{currentTime} WIB</span>
    </div>

    <!-- Buy Me Coffee Button -->
    <button
      type="button"
      class="coffee-btn"
      title="Dukung pengembang: Belikan saya kopi di Saweria (https://saweria.co/arthex1204)"
      onclick={() => openExternalUrl('https://saweria.co/arthex1204')}
    >
      <Coffee size={11} class="coffee-icon" />
      <span>Buy Me Coffee</span>
    </button>

    <div class="divider"></div>

    <!-- Terminal Log Button -->
    <button
      class="terminal-log-btn {isConsoleOpen ? 'active' : ''}"
      title="Buka / Tutup Terminal Logs [Ctrl+`]"
      onclick={onToggleConsole}
    >
      <Terminal size={12} />
      <span>Terminal Logs [CTRL+`]</span>
      {#if isConsoleOpen}
        <ChevronDown size={12} />
      {:else}
        <ChevronUp size={12} />
      {/if}
    </button>
  </div>
</footer>

<style>
  .system-status-bar {
    height: 26px;
    background-color: var(--bg-darkest);
    border-top: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-dim);
    z-index: 50;
    flex-shrink: 0;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.4);
  }

  .left-cluster, .right-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .telemetry-pill {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .live-pip {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--bull-color);
    box-shadow: 0 0 6px var(--bull-color);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.9); }
  }

  .pill-text {
    color: var(--text-muted);
  }

  .font-bold {
    font-weight: 700;
    color: var(--text-main);
  }

  .icon-dim {
    color: var(--text-dim);
  }

  .text-bull {
    color: var(--bull-color);
  }

  .text-bear {
    color: var(--bear-color);
  }

  .text-amber {
    color: #f59e0b;
  }

  .text-cyan {
    color: #38bdf8;
  }

  .interactive {
    cursor: default;
    transition: opacity 0.15s ease;
  }

  .interactive:hover {
    opacity: 0.85;
  }

  .pill-badge {
    padding: 1px 4px;
    border-radius: var(--radius-xs, 3px);
    font-weight: 700;
    font-size: 9.5px;
  }

  .badge-bull {
    color: var(--bull-color);
    background-color: rgba(0, 240, 144, 0.1);
    border: 1px solid rgba(0, 240, 144, 0.25);
  }

  .badge-amber {
    color: #f59e0b;
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .badge-bear {
    color: var(--bear-color);
    background-color: rgba(255, 68, 88, 0.1);
    border: 1px solid rgba(255, 68, 88, 0.25);
  }

  .badge-update {
    color: var(--brand-primary);
    background-color: rgba(255, 105, 180, 0.15);
    border: 1px solid rgba(255, 105, 180, 0.45);
    box-shadow: 0 0 6px rgba(255, 105, 180, 0.2);
  }

  .update-status-pill {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: transform 0.15s ease;
  }

  .update-status-pill:hover {
    transform: translateY(-1px);
  }

  :global(.text-pink-sparkle) {
    color: var(--brand-primary);
  }

  .divider {
    width: 1px;
    height: 12px;
    background-color: var(--border-hairline);
  }

  .terminal-log-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    padding: 2px 7px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .terminal-log-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .terminal-log-btn.active {
    background-color: rgba(0, 240, 144, 0.12);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .coffee-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: #f59e0b;
    padding: 2px 7px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .coffee-btn:hover {
    color: #fbbf24;
    background-color: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
  }

  :global(.coffee-icon) {
    color: #f59e0b;
    transition: transform 0.2s ease;
  }

  .coffee-btn:hover :global(.coffee-icon) {
    transform: rotate(-10deg) scale(1.1);
  }
</style>
