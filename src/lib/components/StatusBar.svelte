<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    HardDrive,
    Clock,
    Terminal,
    ChevronUp,
    ChevronDown,
    Wifi,
    Zap,
    Coffee,
    Sparkles,
    Download,
    RefreshCw
  } from '@lucide/svelte';
  import { telemetryService, type TelemetryData } from '../services/telemetryService';
  import {
    updateService,
    shouldShowUpdateBadge,
    getUpdatePillContent,
    type UpdateState
  } from '../services/updateService';
  import { openExternalUrl } from '../services/urlService';
  import { marketFeed } from '../services/market';
  import type { MarketSession } from '../services/marketSessionService';
  import type { FeedConnectionStatus } from '../services/market/types';
  import type { AppSettings } from '../types/market';
  import { formatLocalClockTime } from '../services/worldClockService';
  import NextEventPill from './statusbar/NextEventPill.svelte';
  import MarketSessionsPill from './statusbar/MarketSessionsPill.svelte';

  interface Props {
    isConsoleOpen: boolean;
    onToggleConsole: () => void;
    onOpenAbout?: () => void;
    onOpenEventsTab?: () => void;
    settings?: AppSettings;
    onSelectTimezone?: (tz: string) => void;
    marketSessionsFooterHidden?: boolean;
    onHideMarketSessionsFooter?: () => void;
    session?: MarketSession;
    sessionAvailable?: boolean;
    onToggleSession?: () => void;
  }

  let {
    isConsoleOpen,
    onToggleConsole,
    onOpenAbout,
    onOpenEventsTab,
    settings,
    onSelectTimezone,
    marketSessionsFooterHidden = false,
    onHideMarketSessionsFooter,
    session = 'regular',
    sessionAvailable = false,
    onToggleSession
  }: Props = $props();

  let nowDate = $state(new Date());
  let timeInterval: ReturnType<typeof setInterval> | null = null;
  let telemetry = $state<TelemetryData>(telemetryService.getSnapshot());
  let unsubTelemetry: (() => void) | null = null;
  let updateState = $state<UpdateState>(updateService.getSnapshot());
  let unsubUpdate: (() => void) | null = null;
  let feedStatus = $state<FeedConnectionStatus>(marketFeed.getConnectionStatus());
  let unsubFeed: (() => void) | null = null;

  const isUtcMode = $derived(settings?.timezone === 'UTC');
  const activeClock = $derived(formatLocalClockTime(nowDate, isUtcMode ? 'UTC' : undefined));

  function handleSessionToggleClick() {
    onToggleSession?.();
  }

  function updateClock() {
    nowDate = new Date();
  }

  function handleToggleClockTimezone() {
    if (!onSelectTimezone) return;
    if (isUtcMode) {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
      onSelectTimezone(localTz);
    } else {
      onSelectTimezone('UTC');
    }
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
  <!-- Kluster Kiri: Notifikasi Update & Telemetri Runtime Live -->
  <div class="left-cluster">
    {#if shouldShowUpdateBadge(updateState) && updateState.updateInfo}
      {@const pill = getUpdatePillContent(updateState)}
      <button
        class="telemetry-pill update-status-pill mono-nums"
        title="Pembaruan {updateState.updateInfo.latestTag} — klik untuk membuka tab Tentang Aplikasi."
        onclick={onOpenAbout}
      >
        {#if pill.icon === 'download'}
          <Download size={11} class="text-pink-sparkle" />
        {:else if pill.icon === 'spin'}
          <RefreshCw size={11} class="text-pink-sparkle spin" />
        {:else}
          <Sparkles size={11} class="text-pink-sparkle" />
        {/if}
        <span class="pill-badge badge-update">{pill.label}</span>
      </button>

      <div class="divider"></div>
    {/if}

    <!-- Metrik FPS Render Real-Time -->
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

    <!-- Metrik Latensi Jaringan (Ping) & Indikator Feed Connection Guard -->
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
      {#if feedStatus.providerId === 'yahoo'}
        <span class="pill-badge badge-amber font-mono" title="Feed Yahoo Finance (Saham Indo IDX & US) memiliki jeda 15 menit sesuai regulasi bursa">DELAYED 15M</span>
      {:else if feedStatus.providerId === 'macro'}
        <span class="pill-badge badge-cyan font-mono" title="Indeks makro sintetis terkalibrasi (~1 tahun): hanya aktif mengambil data saat grafik makro terbuka">SYNTHETIC (~1Y)</span>
      {/if}
    </div>

    <div class="divider"></div>

    <!-- Metrik Pemakaian RAM Real-Time -->
    <div
      class="telemetry-pill interactive mono-nums"
      title="Pemakaian RAM Real-Time: {telemetry.nativeProcessMb ? `Working Set Windows: ${telemetry.nativeProcessMb} MB` : ''}{telemetry.jsHeapMb ? ` (JS Heap: ${telemetry.jsHeapMb} MB)` : ''}"
    >
      <span class="icon-dim"><HardDrive size={11} /></span>
      <span class="pill-text">RAM: {telemetry.memoryMb.toFixed(1)}MB</span>
    </div>

    <div class="divider"></div>

    <NextEventPill {onOpenEventsTab} />
  </div>

  <!-- Kluster Kanan: Jam Lokal/UTC, Market Sessions Pill, Toggle Sesi RTH/ETH, Dukungan & Terminal Logs -->
  <div class="right-cluster">
    <div class="clocks-cluster">
      <button
        type="button"
        class="telemetry-pill world-clock-pill interactive mono-nums {isUtcMode ? 'active-timezone' : ''}"
        title={isUtcMode
          ? `Waktu UTC: ${activeClock.time} • Klik untuk beralih ke waktu lokal`
          : `Waktu Lokal: ${activeClock.time} ${activeClock.tzLabel} • Klik untuk beralih ke UTC`}
        onclick={handleToggleClockTimezone}
      >
        <span class="icon-dim"><Clock size={11} /></span>
        <span class="pill-text">{activeClock.time} {isUtcMode ? 'UTC' : activeClock.tzLabel}</span>
      </button>

      {#if settings?.showWorldClocks !== false && marketSessionsFooterHidden !== true}
        <MarketSessionsPill
          now={nowDate}
          referenceTz={settings?.timezone || 'UTC'}
          activeTimezones={settings?.worldClockCities}
          selectedTimezone={settings?.timezone}
          hidden={marketSessionsFooterHidden}
          {onSelectTimezone}
          onHideFromFooter={onHideMarketSessionsFooter}
        />
      {/if}
    </div>

    {#if sessionAvailable}
      {@const effectiveSession = session ?? settings?.marketSession ?? 'regular'}
      <div class="divider"></div>
      <button
        type="button"
        class="telemetry-pill session-toggle-pill interactive mono-nums {effectiveSession === 'extended' ? 'eth-active' : 'rth-active'}"
        title={effectiveSession === 'extended'
          ? 'Extended Trading Hours (ETH): Menampilkan Pre-Market & Post-Market dengan shading sesi. Klik untuk beralih ke RTH.'
          : 'Regular Trading Hours (RTH): Hanya jam bursa reguler. Klik untuk mengaktifkan Extended Hours (ETH).'}
        onclick={handleSessionToggleClick}
      >
        <span class="session-mode-dot {effectiveSession === 'extended' ? 'dot-eth' : 'dot-rth'}"></span>
        <span class="session-mode-label">{effectiveSession === 'extended' ? 'ETH' : 'RTH'}</span>
      </button>
    {/if}

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

  .pill-text {
    color: var(--text-muted);
  }

  .icon-dim {
    color: var(--text-dim);
  }

  .text-bull, .icon-dim :global(.text-bull) {
    color: var(--bull-color);
  }

  .icon-dim :global(.text-bear) {
    color: var(--bear-color);
  }

  .text-amber, .icon-dim :global(.text-amber) {
    color: #f59e0b;
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

  .badge-cyan {
    color: var(--brand-cyan, #38bdf8);
    background-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-cyan, #38bdf8) 32%, transparent);
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

  .clocks-cluster {
    display: flex;
    align-items: center;
    gap: 5px;
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

  .session-toggle-pill {
    background: var(--bg-tertiary, rgba(30, 41, 59, 0.55));
    border: 1px solid var(--border-subtle, rgba(148, 163, 184, 0.16));
    border-radius: var(--radius-xs, 4px);
    padding: 1px 7px;
    cursor: pointer;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    transition: all 0.15s ease;
  }

  .session-toggle-pill.eth-active {
    color: #38bdf8;
    background: rgba(14, 165, 233, 0.12);
    border-color: rgba(14, 165, 233, 0.35);
  }

  .session-toggle-pill.rth-active {
    color: var(--text-secondary, #cbd5e1);
  }

  .session-toggle-pill:hover {
    border-color: rgba(56, 189, 248, 0.5);
  }

  .session-mode-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    display: inline-block;
  }

  .session-mode-dot.dot-eth {
    background-color: #f97316;
    box-shadow: 0 0 6px rgba(249, 115, 22, 0.65);
  }

  .session-mode-dot.dot-rth {
    background-color: #9ca3af;
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
</style>
