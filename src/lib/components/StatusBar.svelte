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
    Sparkles,
    Globe
  } from '@lucide/svelte';
  import { telemetryService, type TelemetryData } from '../services/telemetryService';
  import { updateService, type UpdateState } from '../services/updateService';
  import { openExternalUrl } from '../services/urlService';
  import { marketFeed } from '../services/market';
  import type { FeedConnectionStatus } from '../services/market/types';
  import type { AppSettings } from '../types/market';
  import {
    getWorldClockSnapshot,
    formatLocalClockTime,
    DEFAULT_WORLD_CLOCK_CITIES,
    type WorldClockItem
  } from '../services/worldClockService';

  interface Props {
    isConsoleOpen: boolean;
    onToggleConsole: () => void;
    onOpenAbout?: () => void;
    settings?: AppSettings;
    onSelectTimezone?: (tz: string) => void;
  }

  let {
    isConsoleOpen,
    onToggleConsole,
    onOpenAbout,
    settings,
    onSelectTimezone
  }: Props = $props();

  let localClock = $state(formatLocalClockTime(new Date()));
  let worldClocks = $state<WorldClockItem[]>([]);
  let isWorldClocksDropdownOpen = $state(false);
  let timeInterval: any = null;
  let telemetry = $state<TelemetryData>(telemetryService.getSnapshot());
  let unsubTelemetry: (() => void) | null = null;
  let updateState = $state<UpdateState>(updateService.getSnapshot());
  let unsubUpdate: (() => void) | null = null;
  let feedStatus = $state<FeedConnectionStatus>(marketFeed.getConnectionStatus());
  let unsubFeed: (() => void) | null = null;

  function updateClock() {
    const now = new Date();
    localClock = formatLocalClockTime(now);
    const activeCities = settings?.worldClockCities ?? DEFAULT_WORLD_CLOCK_CITIES;
    worldClocks = getWorldClockSnapshot(now, activeCities);
  }

  function handleSelectTimezone(tz: string) {
    if (onSelectTimezone) {
      onSelectTimezone(tz);
    }
    isWorldClocksDropdownOpen = false;
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

    <!-- Kluster Jam: Jam Lokal + Jam Bursa Dunia -->
    <div class="clocks-cluster">
      <!-- Jam Lokal Pengguna (Selalu Tampil) -->
      <button
        type="button"
        class="telemetry-pill world-clock-pill interactive mono-nums {(!settings?.timezone || settings?.timezone === 'Asia/Jakarta') ? 'active-timezone' : ''}"
        title="Waktu Lokal Sistem: {localClock.time} {localClock.tzLabel} • Klik untuk sinkronkan timezone chart ke waktu lokal"
        onclick={() => handleSelectTimezone('Asia/Jakarta')}
      >
        <span class="icon-dim"><Clock size={11} /></span>
        <span class="pill-text">{localClock.time} {localClock.tzLabel}</span>
      </button>

      {#if settings?.showWorldClocks !== false}
        <!-- Mode Desktop (>= 1080px): Deretan Horizontal Pill Jam Dunia -->
        <div class="world-clocks-desktop">
          {#each worldClocks as clock (clock.id)}
            <button
              type="button"
              class="telemetry-pill world-clock-pill interactive mono-nums {settings?.timezone === clock.timezone ? 'active-timezone' : ''}"
              title="{clock.label} ({clock.marketName}): {clock.fullTime} • {clock.dateStr}&#10;Status Pasar: {clock.marketStatusText} (Jam Bursa: {clock.marketHoursDesc})&#10;Klik untuk sinkronkan timezone chart"
              onclick={() => handleSelectTimezone(clock.timezone)}
            >
              <span class="session-pip {clock.isOpen ? 'pip-open' : 'pip-closed'}"></span>
              <span class="city-code">{clock.shortCode}</span>
              <span class="pill-text">{clock.time}</span>
            </button>
          {/each}
        </div>

        <!-- Mode Responsif / Layar Sempit (< 1080px): Tombol Popover Dropdown -->
        <div class="world-clocks-mobile">
          <button
            type="button"
            class="telemetry-pill world-clock-btn interactive mono-nums {isWorldClocksDropdownOpen ? 'active' : ''}"
            title="Buka status jam bursa dunia (Tokyo, London, New York)"
            onclick={() => (isWorldClocksDropdownOpen = !isWorldClocksDropdownOpen)}
          >
            <span class="icon-dim"><Globe size={11} /></span>
            <span class="pill-text">World Clocks ({worldClocks.length})</span>
            {#if isWorldClocksDropdownOpen}
              <ChevronDown size={10} />
            {:else}
              <ChevronUp size={10} />
            {/if}
          </button>

          {#if isWorldClocksDropdownOpen}
            <button
              type="button"
              class="popover-backdrop"
              onclick={() => (isWorldClocksDropdownOpen = false)}
              aria-label="Tutup menu jam dunia"
            ></button>

            <div class="world-clocks-popover">
              <div class="popover-header">
                <span class="popover-title">JAM BURSA DUNIA</span>
                <span class="popover-hint">Klik untuk sinkronkan chart</span>
              </div>
              <div class="popover-list">
                {#each worldClocks as clock (clock.id)}
                  <button
                    type="button"
                    class="popover-item {settings?.timezone === clock.timezone ? 'active-timezone' : ''}"
                    onclick={() => handleSelectTimezone(clock.timezone)}
                  >
                    <div class="popover-item-left">
                      <span class="session-pip {clock.isOpen ? 'pip-open' : 'pip-closed'}"></span>
                      <span class="popover-city">{clock.label}</span>
                      <span class="popover-market">({clock.marketName})</span>
                    </div>
                    <div class="popover-item-right">
                      <span class="popover-time mono-nums">{clock.time}</span>
                      <span class="status-badge {clock.isOpen ? 'badge-open' : 'badge-closed'}">
                        {clock.marketStatusText}
                      </span>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
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

  /* Gaya Kluster Jam Dunia & Popover Responsif */
  .clocks-cluster {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .world-clocks-desktop {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .world-clocks-mobile {
    display: none;
    position: relative;
    align-items: center;
  }

  .world-clock-pill {
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 5px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-dim);
    transition: all 0.15s ease;
  }

  .world-clock-pill:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
    border-color: var(--border-hairline);
  }

  .world-clock-pill.active-timezone {
    color: #ff69b4 !important;
    background-color: rgba(255, 105, 180, 0.1) !important;
    border-color: rgba(255, 105, 180, 0.5) !important;
    box-shadow: 0 0 6px rgba(255, 105, 180, 0.2);
  }

  .city-code {
    font-size: 9px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .session-pip {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  .pip-open {
    background-color: var(--bull-color, #22c55e);
    box-shadow: 0 0 5px rgba(34, 197, 94, 0.6);
  }

  .pip-closed {
    background-color: var(--text-dim, #666);
    opacity: 0.5;
  }

  .world-clock-btn {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    transition: all 0.15s ease;
  }

  .world-clock-btn:hover,
  .world-clock-btn.active {
    color: var(--text-main);
    background-color: var(--bg-hover);
    border-color: rgba(255, 105, 180, 0.4);
  }

  /* Panel Popover Mengambang */
  .popover-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    border: none;
    cursor: default;
    z-index: 99;
  }

  .world-clocks-popover {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 0;
    min-width: 240px;
    background-color: #121212;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm, 4px);
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.7);
    padding: 6px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 6px;
    border-bottom: 1px solid var(--border-hairline);
    font-size: 9px;
    color: var(--text-muted);
  }

  .popover-title {
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--text-main);
  }

  .popover-hint {
    font-size: 8px;
    color: var(--text-dim);
  }

  .popover-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .popover-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-main);
    transition: all 0.12s ease;
    text-align: left;
    width: 100%;
  }

  .popover-item:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-hairline);
  }

  .popover-item.active-timezone {
    background-color: rgba(255, 105, 180, 0.1);
    border-color: rgba(255, 105, 180, 0.4);
    color: #ff69b4;
  }

  .popover-item-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .popover-city {
    font-weight: 600;
  }

  .popover-market {
    font-size: 9px;
    color: var(--text-dim);
  }

  .popover-item-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .popover-time {
    font-weight: 600;
  }

  .status-badge {
    font-size: 8px;
    padding: 1px 4px;
    border-radius: 2px;
    font-weight: 700;
  }

  .badge-open {
    background-color: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .badge-closed {
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--text-dim);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* Breakpoint Media Query Responsif (< 1080px) */
  @media (max-width: 1079px) {
    .world-clocks-desktop {
      display: none;
    }
    .world-clocks-mobile {
      display: flex;
    }
  }
</style>
