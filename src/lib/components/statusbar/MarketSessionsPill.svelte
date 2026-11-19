<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EyeOff } from '@lucide/svelte';
  import {
    DEFAULT_WORLD_CLOCK_CITIES,
    formatLocalClockTime,
    getMarketSessionsSummary,
    type MarketSessionItem,
  } from '../../services/worldClockService';
  import {
    readMarketSessionsFooterHidden,
    setMarketSessionsFooterHidden,
  } from '../../services/persistence/uiPreferencesHelper';

  interface Props {
    now?: Date;
    referenceTz?: string;
    activeTimezones?: string[];
    selectedTimezone?: string;
    hidden?: boolean;
    onSelectTimezone?: (tz: string) => void;
    onHideFromFooter?: () => void;
  }

  let {
    now,
    referenceTz = 'UTC',
    activeTimezones = DEFAULT_WORLD_CLOCK_CITIES,
    selectedTimezone,
    hidden,
    onSelectTimezone,
    onHideFromFooter,
  }: Props = $props();

  let internalNow = $state(new Date());
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let isHovered = $state(false);
  let isLockedOpen = $state(false);
  let isHiddenLocal = $state(false);
  let hideHintVisible = $state(false);

  const effectiveNow = $derived(now ?? internalNow);
  const isFooterHidden = $derived(hidden ?? isHiddenLocal);

  const summary = $derived(
    getMarketSessionsSummary(effectiveNow, referenceTz, activeTimezones)
  );

  const localClock = $derived(formatLocalClockTime(effectiveNow));
  const utcClock = $derived(formatLocalClockTime(effectiveNow, 'UTC'));

  const TIMELINE_TICKS = [
    { label: '06:00', leftPct: 25 },
    { label: '12:00', leftPct: 50 },
    { label: '18:00', leftPct: 75 },
    { label: '00:00', leftPct: 100 },
  ];

  onMount(() => {
    isHiddenLocal = readMarketSessionsFooterHidden();
    if (!now) {
      tickTimer = setInterval(() => {
        internalNow = new Date();
      }, 1000);
    }
  });

  onDestroy(() => {
    if (tickTimer) clearInterval(tickTimer);
  });

  function handlePillClick() {
    isLockedOpen = !isLockedOpen;
    if (isLockedOpen) {
      isHovered = false;
    }
  }

  function handleCityClick(session: MarketSessionItem) {
    onSelectTimezone?.(session.timezone);
    isLockedOpen = false;
  }

  async function handleHideFromFooter() {
    isLockedOpen = false;
    isHovered = false;
    hideHintVisible = true;
    await setMarketSessionsFooterHidden(true);
    setTimeout(() => {
      isHiddenLocal = true;
      hideHintVisible = false;
      onHideFromFooter?.();
    }, 1800);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isLockedOpen) {
      isLockedOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !isFooterHidden}
  <div
    class="market-sessions-wrap"
    role="region"
    aria-label="Market Sessions"
    onmouseenter={() => {
      if (!isLockedOpen) isHovered = true;
    }}
    onmouseleave={() => {
      isHovered = false;
    }}
  >
    {#if hideHintVisible}
      <div class="hide-hint-toast">
        Disembunyikan. Aktifkan lagi di Settings → General → Market Sessions.
      </div>
    {/if}

    <button
      type="button"
      class="market-sessions-pill mono-nums {isLockedOpen ? 'active' : ''}"
      aria-expanded={isLockedOpen}
      title="Market Sessions — Hover untuk timeline 24 jam, klik untuk detail & sinkronisasi zona waktu"
      onclick={handlePillClick}
    >
      <span class="mini-track" aria-hidden="true">
        {#if summary.featuredSession}
          {#each summary.featuredSession.timelineSegments24h as seg, idx (idx)}
            <span
              class="mini-seg"
              style="left: {seg.startPct}%; width: {Math.max(4, seg.endPct - seg.startPct)}%; background-color: {summary.featuredSession.accentColor};"
            ></span>
          {/each}
        {/if}
        <span class="mini-cursor" style="left: {summary.nowCursorPct}%;"></span>
      </span>
      <span class="pill-label">{summary.featuredPillText}</span>
    </button>

    {#if isHovered && !isLockedOpen}
      <div class="timeline-hover-card" role="tooltip">
        <div class="timeline-axis">
          <span class="axis-spacer"></span>
          <div class="axis-track">
            {#each TIMELINE_TICKS as tick (tick.label)}
              <span
                class="axis-tick mono-nums"
                style="left: {tick.leftPct}%;"
              >
                {tick.label}
              </span>
            {/each}
          </div>
          <span class="axis-hours-spacer mono-nums">{referenceTz === 'UTC' ? 'UTC' : 'LOCAL'}</span>
        </div>

        <div class="timeline-rows">
          {#each summary.sessions as session (session.id)}
            <div class="timeline-row">
              <div class="row-city">
                <span
                  class="city-dot"
                  style="background-color: {session.accentColor};"
                ></span>
                <span class="city-name">{session.label}</span>
              </div>

              <div class="row-track">
                {#each session.timelineSegments24h as seg, idx (idx)}
                  <span
                    class="row-segment"
                    style="left: {seg.startPct}%; width: {Math.max(1, seg.endPct - seg.startPct)}%; background-color: {session.accentColor}; opacity: {session.isOpen ? 0.92 : 0.45};"
                  ></span>
                {/each}
                <span
                  class="now-cursor-line"
                  style="left: {summary.nowCursorPct}%;"
                ></span>
              </div>

              <span class="row-hours mono-nums">{session.referenceHoursText}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if isLockedOpen}
      <button
        type="button"
        class="popover-backdrop"
        aria-label="Tutup popover Market Sessions"
        onclick={() => (isLockedOpen = false)}
      ></button>

      <div class="sessions-popover" role="dialog" aria-label="Market Sessions">
        <div class="popover-header">
          <span class="popover-title">MARKET SESSIONS</span>
          <div class="header-clocks mono-nums">
            <span>Local {localClock.time}</span>
            <span class="clock-sep">·</span>
            <span>UTC {utcClock.time}</span>
          </div>
        </div>

        <div class="popover-list">
          {#each summary.sessions as session (session.id)}
            {@const isSelected = selectedTimezone === session.timezone}
            <button
              type="button"
              class="session-row {isSelected ? 'selected-tz' : ''}"
              onclick={() => handleCityClick(session)}
              title="Klik untuk sinkronkan zona waktu chart ke {session.label} ({session.timezone})"
            >
              <div class="session-row-main">
                <div class="session-left">
                  <span
                    class="status-dot {session.isOpen ? 'open' : 'closed'}"
                    style="border-color: {session.accentColor}; background-color: {session.isOpen ? session.accentColor : 'transparent'};"
                  ></span>
                  <span class="session-city">{session.label}</span>
                  <span class="session-market">{session.marketName}</span>
                </div>

                <div class="session-right">
                  <span class="status-badge {session.isOpen ? 'badge-open' : 'badge-closed'}">
                    {session.statusText}
                  </span>
                  <span class="countdown-text mono-nums">{session.countdownText}</span>
                </div>
              </div>

              {#if session.isOpen || session.sessionProgressRatio > 0}
                <div class="session-progress-track">
                  <div
                    class="session-progress-fill"
                    style="width: {Math.round(session.sessionProgressRatio * 100)}%; background-color: {session.accentColor};"
                  ></div>
                </div>
              {/if}
            </button>
          {/each}
        </div>

        <div class="popover-footer">
          <button
            type="button"
            class="hide-footer-btn"
            onclick={handleHideFromFooter}
          >
            <EyeOff size={12} />
            <span>Hide from footer</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .market-sessions-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .market-sessions-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 20px;
    padding: 0 7px;
    border-radius: var(--radius-xs, 4px);
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted, #94a3b8);
    font-size: 10px;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .market-sessions-pill:hover,
  .market-sessions-pill.active {
    color: var(--text-main, #e2e8f0);
    background-color: var(--bg-hover, rgba(148, 163, 184, 0.1));
    border-color: var(--border-hairline, rgba(148, 163, 184, 0.18));
  }

  .mini-track {
    position: relative;
    width: 32px;
    height: 5px;
    border-radius: 999px;
    background-color: rgba(148, 163, 184, 0.22);
    overflow: hidden;
    flex-shrink: 0;
  }

  .mini-seg {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
    opacity: 0.85;
  }

  .mini-cursor {
    position: absolute;
    top: -1px;
    bottom: -1px;
    width: 1.5px;
    background-color: #ffffff;
    box-shadow: 0 0 3px rgba(255, 255, 255, 0.75);
    transform: translateX(-50%);
  }

  .pill-label {
    white-space: nowrap;
    font-weight: 500;
  }

  .timeline-hover-card {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    width: 340px;
    padding: 10px 12px;
    background-color: var(--bg-surface, #121216);
    border: 1px solid var(--border-hairline, rgba(148, 163, 184, 0.2));
    border-radius: var(--radius-sm, 6px);
    box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.65);
    z-index: 120;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .timeline-axis {
    display: grid;
    grid-template-columns: 76px 1fr 78px;
    align-items: center;
    gap: 8px;
    font-size: 9px;
    color: var(--text-dim, #64748b);
  }

  .axis-track {
    position: relative;
    height: 12px;
  }

  .axis-tick {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  .axis-tick:last-child {
    transform: translateX(-100%);
  }

  .axis-hours-spacer {
    text-align: right;
    font-size: 8.5px;
    letter-spacing: 0.04em;
  }

  .timeline-rows {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .timeline-row {
    display: grid;
    grid-template-columns: 76px 1fr 78px;
    align-items: center;
    gap: 8px;
  }

  .row-city {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .city-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .city-name {
    font-size: 10.5px;
    font-weight: 500;
    color: var(--text-main, #e2e8f0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-track {
    position: relative;
    height: 7px;
    border-radius: 999px;
    background-color: rgba(148, 163, 184, 0.14);
    overflow: hidden;
  }

  .row-segment {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
  }

  .now-cursor-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1.5px;
    background-color: #ffffff;
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
    transform: translateX(-50%);
  }

  .row-hours {
    font-size: 9.5px;
    color: var(--text-muted, #94a3b8);
    text-align: right;
    white-space: nowrap;
  }

  .popover-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    border: none;
    cursor: default;
    z-index: 110;
  }

  .sessions-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    width: 320px;
    background-color: var(--bg-surface, #121216);
    border: 1px solid var(--border-hairline, rgba(148, 163, 184, 0.2));
    border-radius: var(--radius-sm, 6px);
    box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.72);
    z-index: 120;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-hairline, rgba(148, 163, 184, 0.15));
  }

  .popover-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-main, #e2e8f0);
  }

  .header-clocks {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 9.5px;
    color: var(--text-muted, #94a3b8);
  }

  .clock-sep {
    opacity: 0.5;
  }

  .popover-list {
    display: flex;
    flex-direction: column;
    padding: 6px;
    gap: 4px;
  }

  .session-row {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
    padding: 7px 8px;
    border: 1px solid transparent;
    border-radius: var(--radius-xs, 4px);
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.12s ease, border-color 0.12s ease;
  }

  .session-row:hover {
    background-color: var(--bg-hover, rgba(148, 163, 184, 0.08));
  }

  .session-row.selected-tz {
    background-color: rgba(255, 105, 180, 0.08);
    border-color: rgba(255, 105, 180, 0.35);
  }

  .session-row-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .session-left {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    border-width: 1.5px;
    border-style: solid;
    flex-shrink: 0;
  }

  .session-city {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main, #e2e8f0);
  }

  .session-market {
    font-size: 9.5px;
    color: var(--text-dim, #64748b);
  }

  .session-right {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
  }

  .status-badge {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .badge-open {
    color: #34d399;
    background-color: rgba(16, 185, 129, 0.14);
  }

  .badge-closed {
    color: var(--text-dim, #94a3b8);
    background-color: rgba(148, 163, 184, 0.12);
  }

  .countdown-text {
    font-size: 10px;
    color: var(--text-muted, #94a3b8);
    min-width: 82px;
    text-align: right;
  }

  .session-progress-track {
    width: 100%;
    height: 2px;
    border-radius: 999px;
    background-color: rgba(148, 163, 184, 0.14);
    overflow: hidden;
  }

  .session-progress-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .popover-footer {
    border-top: 1px solid var(--border-hairline, rgba(148, 163, 184, 0.15));
    padding: 6px 8px;
  }

  .hide-footer-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 5px 6px;
    border: none;
    border-radius: var(--radius-xs, 4px);
    background: transparent;
    color: var(--text-muted, #94a3b8);
    font-size: 10.5px;
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .hide-footer-btn:hover {
    background-color: var(--bg-hover, rgba(148, 163, 184, 0.1));
    color: var(--text-main, #e2e8f0);
  }

  .hide-hint-toast {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    width: 260px;
    padding: 7px 10px;
    font-size: 10px;
    color: var(--text-main, #e2e8f0);
    background-color: var(--bg-surface, #121216);
    border: 1px solid var(--border-hairline, rgba(148, 163, 184, 0.25));
    border-radius: var(--radius-xs, 4px);
    box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.6);
    z-index: 130;
  }
</style>
