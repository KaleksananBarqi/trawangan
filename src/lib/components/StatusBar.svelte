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
    Wifi
  } from '@lucide/svelte';

  interface Props {
    isConsoleOpen: boolean;
    onToggleConsole: () => void;
  }

  let { isConsoleOpen, onToggleConsole }: Props = $props();

  let currentTime = $state('');
  let timeInterval: any = null;

  function updateClock() {
    const now = new Date();
    currentTime = now.toLocaleTimeString('id-ID', { hour12: false });
  }

  onMount(() => {
    updateClock();
    timeInterval = setInterval(updateClock, 1000);
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
  });
</script>

<footer class="system-status-bar">
  <!-- Left Telemetry Cluster -->
  <div class="left-cluster">
    <div class="telemetry-pill">
      <span class="live-pip"></span>
      <span class="pill-text font-bold">Engine: NATIVE_SYS_X64</span>
    </div>

    <div class="divider"></div>

    <div class="telemetry-pill">
      <span class="icon-dim"><HardDrive size={12} /></span>
      <span class="pill-text mono-nums">RAM: ~46MB / Ultra Lightweight</span>
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

  <!-- Right Time & Console Toggle Cluster -->
  <div class="right-cluster">
    <div class="telemetry-pill mono-nums">
      <span class="icon-dim"><Clock size={12} /></span>
      <span class="pill-text">{currentTime} WIB (UTC+7)</span>
    </div>

    <div class="divider"></div>

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
</style>
