<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Calendar } from '@lucide/svelte';
  import {
    macroEventsService,
    getNextUpcomingEvent,
    formatEventCountdown,
    formatShortEventName,
    formatEventDateTimeInTimezone,
    getTimezoneShortLabel,
    type MacroEventsState,
  } from '../../services/macroEventsService';
  import { workspaceShellService } from '../../services/workspaceShellService';

  interface Props {
    timezone?: string;
    onOpenEventsTab?: () => void;
  }

  let { timezone, onOpenEventsTab }: Props = $props();

  let eventsState = $state<MacroEventsState>(macroEventsService.getSnapshot());
  let nowMs = $state(Date.now());
  let isHovered = $state(false);

  let unsubEvents: (() => void) | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const nextEvent = $derived.by(() =>
    getNextUpcomingEvent(eventsState.events, nowMs, { scope: 'us_crypto', category: 'all' }) ??
    getNextUpcomingEvent(eventsState.events, nowMs, { scope: 'all', category: 'all' })
  );

  const shortTitle = $derived(nextEvent ? formatShortEventName(nextEvent.title) : 'Events');
  const countdownText = $derived(nextEvent ? formatEventCountdown(nextEvent.timestamp, nowMs) : '');

  const formattedHoverDate = $derived.by(() => {
    if (!nextEvent) return '';
    return `${formatEventDateTimeInTimezone(nextEvent.timestamp, timezone)} ${getTimezoneShortLabel(timezone)}`;
  });

  function handleClick() {
    if (onOpenEventsTab) {
      onOpenEventsTab();
    } else {
      workspaceShellService.openRightDockTab('events');
    }
  }

  onMount(() => {
    unsubEvents = macroEventsService.subscribe((next) => {
      eventsState = next;
    });
    void macroEventsService.refresh();
    tickTimer = setInterval(() => {
      nowMs = Date.now();
    }, 30_000);
  });

  onDestroy(() => {
    unsubEvents?.();
    if (tickTimer) clearInterval(tickTimer);
  });
</script>

<div
  class="next-event-wrapper"
  role="presentation"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
>
  <button
    type="button"
    class="next-event-pill mono-nums"
    onclick={handleClick}
    aria-label={nextEvent ? `${nextEvent.title} in ${countdownText}` : 'Buka tab Events'}
  >
    {#if nextEvent}
      <span class="impact-dot impact-{nextEvent.impact}" aria-hidden="true"></span>
      <span class="pill-title">{shortTitle}</span>
      <span class="pill-countdown">in {countdownText}</span>
    {:else}
      <Calendar size={11} class="pill-icon" />
      <span class="pill-title">Events</span>
    {/if}
  </button>

  {#if isHovered && nextEvent}
    <div class="event-hover-banner" role="tooltip">
      <div class="banner-header">
        <span class="impact-dot impact-{nextEvent.impact}"></span>
        <span class="banner-title">{nextEvent.title}</span>
        <span class="banner-sep">·</span>
        <span class="banner-time mono-nums">{formattedHoverDate}</span>
      </div>
      <div class="banner-metrics mono-nums">
        {#if nextEvent.forecast}
          <span>Forecast <strong>{nextEvent.forecast}</strong></span>
        {/if}
        {#if nextEvent.previous}
          <span>Previous <strong>{nextEvent.previous}</strong></span>
        {/if}
        <span class="banner-hint">Next market event. Click to open the Events tab.</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .next-event-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .next-event-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 19px;
    padding: 0 7px;
    border-radius: 4px;
    border: 1px solid var(--border-hairline);
    background: color-mix(in srgb, var(--bg-surface) 75%, transparent);
    color: var(--text-muted);
    font-size: 10px;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
  }

  .next-event-pill:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.06));
    border-color: var(--border-bright);
    color: var(--text-primary);
  }

  .impact-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .impact-dot.impact-high {
    background-color: #ef4444;
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.55);
  }

  .impact-dot.impact-medium {
    background-color: #f59e0b;
  }

  .impact-dot.impact-low {
    background-color: #3b82f6;
  }

  .pill-title {
    color: var(--text-primary);
    font-weight: 600;
  }

  .pill-countdown {
    color: var(--text-dim);
  }

  .event-hover-banner {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    z-index: 90;
    min-width: 310px;
    max-width: 440px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--bg-elevated, #14171f);
    border: 1px solid var(--border-bright);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    gap: 4px;
    pointer-events: none;
  }

  .banner-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-primary);
    flex-wrap: wrap;
  }

  .banner-title {
    font-weight: 600;
  }

  .banner-sep,
  .banner-time {
    color: var(--text-dim);
    font-size: 10.5px;
  }

  .banner-metrics {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 10px;
    color: var(--text-muted);
  }

  .banner-metrics strong {
    color: var(--text-primary);
    font-weight: 600;
  }

  .banner-hint {
    color: var(--text-dim);
    font-family: var(--font-sans, sans-serif);
  }
</style>
