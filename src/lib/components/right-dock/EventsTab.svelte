<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { RefreshCw, ChevronRight, ChevronDown, ArrowLeftRight } from '@lucide/svelte';
  import {
    macroEventsService,
    groupEventsBySchedule,
    formatEventCountdown,
    type MacroScopeFilter,
    type MacroCategoryFilter,
    type MacroEventsState,
  } from '../../services/macroEventsService';
  import type { MacroCalendarEvent, MacroImpact } from '../../services/timelineMarksController';

  interface Props {
    activeSymbol?: string;
    onFocusEventTimestamp?: (timestampMs: number) => void;
  }

  let { activeSymbol = 'BTCUSDT', onFocusEventTimestamp }: Props = $props();

  let eventsState = $state<MacroEventsState>(macroEventsService.getSnapshot());
  let scopeFilter = $state<MacroScopeFilter>('us_crypto');
  let categoryFilter = $state<MacroCategoryFilter>('all');
  let showDateInTimeCol = $state(false);
  let selectedEventId = $state<string | null>(null);
  let collapsedGroupKeys = $state<Record<string, boolean>>({ earlier: true });
  let expandedGroupRows = $state<Record<string, boolean>>({});
  let nowMs = $state(Date.now());

  let unsubEvents: (() => void) | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const MAX_ROWS_PER_GROUP = 6;

  const CATEGORY_PILLS: Array<{ id: MacroCategoryFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'macro', label: 'Macro' },
    { id: 'central_bank', label: 'Central Bank' },
    { id: 'inflation', label: 'Inflation' },
    { id: 'employment', label: 'Employment' },
  ];

  const scheduleGroups = $derived.by(() =>
    groupEventsBySchedule(eventsState.events, nowMs, {
      scope: scopeFilter,
      category: categoryFilter,
    })
  );

  function isGroupCollapsed(key: string, defaultCollapsed: boolean): boolean {
    return key in collapsedGroupKeys ? collapsedGroupKeys[key] : defaultCollapsed;
  }

  function toggleGroupCollapse(key: string, defaultCollapsed: boolean) {
    collapsedGroupKeys = {
      ...collapsedGroupKeys,
      [key]: !isGroupCollapsed(key, defaultCollapsed),
    };
  }

  function toggleShowMoreGroup(key: string) {
    expandedGroupRows = {
      ...expandedGroupRows,
      [key]: !expandedGroupRows[key],
    };
  }

  function formatTimeCell(timestampMs: number): string {
    const d = new Date(timestampMs);
    if (showDateInTimeCol) {
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    }
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function parseNumericValue(raw: string | number | undefined): number | null {
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const match = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const n = parseFloat(match[0]);
    return Number.isFinite(n) ? n : null;
  }

  function getActualToneClass(ev: MacroCalendarEvent): string {
    if (ev.actual === undefined || ev.actual === '') return 'tone-upcoming';
    const act = parseNumericValue(ev.actual);
    const exp = parseNumericValue(ev.forecast);
    if (act === null || exp === null || act === exp) return 'tone-neutral';
    return act > exp ? 'tone-bull' : 'tone-bear';
  }

  function getImpactSegments(impact: MacroImpact): number {
    if (impact === 'high') return 3;
    if (impact === 'medium') return 2;
    return 1;
  }

  function handleRowClick(ev: MacroCalendarEvent) {
    selectedEventId = selectedEventId === ev.id ? null : ev.id;
    onFocusEventTimestamp?.(ev.timestamp);
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

<div class="events-tab">
  <header class="events-header">
    <div class="header-top">
      <span class="panel-title">Events</span>
      <span class="symbol-context mono-nums" title="Instrumen aktif">{activeSymbol}</span>
      <button
        type="button"
        class="refresh-btn {eventsState.isLoading ? 'spinning' : ''}"
        title="Muat ulang kalender ekonomi"
        onclick={() => void macroEventsService.refresh(true)}
      >
        <RefreshCw size={12} />
      </button>
    </div>

    <!-- Segmented Scope Filter -->
    <div class="scope-segmented" role="tablist" aria-label="Scope pasar event">
      <button
        type="button"
        class="scope-btn {scopeFilter === 'us_crypto' ? 'active' : ''}"
        onclick={() => (scopeFilter = 'us_crypto')}
      >
        US & Crypto
      </button>
      <button
        type="button"
        class="scope-btn {scopeFilter === 'all' ? 'active' : ''}"
        onclick={() => (scopeFilter = 'all')}
      >
        All markets
      </button>
      <button
        type="button"
        class="scope-btn {scopeFilter === 'major' ? 'active' : ''}"
        onclick={() => (scopeFilter = 'major')}
      >
        Major only
      </button>
    </div>

    <!-- Category Pills -->
    <div class="category-pills">
      {#each CATEGORY_PILLS as cat}
        <button
          type="button"
          class="cat-pill {categoryFilter === cat.id ? 'active' : ''}"
          onclick={() => (categoryFilter = cat.id)}
        >
          {cat.label}
        </button>
      {/each}
    </div>
  </header>

  <!-- Table Column Header -->
  <div class="events-table-head">
    <span class="col-imp">IMP</span>
    <button
      type="button"
      class="col-time time-toggle-btn"
      title="Klik untuk mengganti format Jam / Tanggal"
      onclick={() => (showDateInTimeCol = !showDateInTimeCol)}
    >
      <span>TIME</span>
      <ArrowLeftRight size={10} />
    </button>
    <span class="col-event">EVENT</span>
    <span class="col-exp">EXP</span>
    <span class="col-act">ACT</span>
  </div>

  <!-- Events Schedule List -->
  <div class="events-body">
    {#if scheduleGroups.length === 0}
      <div class="empty-state">Tidak ada event yang cocok dengan filter saat ini.</div>
    {:else}
      {#each scheduleGroups as group (group.key)}
        {@const collapsed = isGroupCollapsed(group.key, group.defaultCollapsed)}
        {@const isExpandedRows = !!expandedGroupRows[group.key]}
        {@const visibleEvents = isExpandedRows ? group.events : group.events.slice(0, MAX_ROWS_PER_GROUP)}
        {@const hiddenCount = Math.max(0, group.events.length - visibleEvents.length)}

        <section class="schedule-group">
          <button
            type="button"
            class="group-header"
            onclick={() => toggleGroupCollapse(group.key, group.defaultCollapsed)}
          >
            {#if collapsed}
              <ChevronRight size={12} />
            {:else}
              <ChevronDown size={12} />
            {/if}
            <span class="group-label">{group.label}</span>
            <span class="group-count mono-nums">{group.events.length}</span>
          </button>

          {#if !collapsed}
            <div class="group-rows">
              {#each visibleEvents as ev (ev.id)}
                {@const segments = getImpactSegments(ev.impact)}
                {@const isReleased = ev.timestamp <= nowMs || (ev.actual !== undefined && ev.actual !== '')}
                {@const isSelected = selectedEventId === ev.id}

                <button
                  type="button"
                  class="event-row {isSelected ? 'selected' : ''}"
                  onclick={() => handleRowClick(ev)}
                >
                  <!-- 3-Segment SVG Impact Gauge -->
                  <span class="col-imp" title="Impact: {ev.impact}">
                    <svg class="impact-gauge impact-{ev.impact}" viewBox="0 0 20 12" width="18" height="11" aria-hidden="true">
                      <path
                        d="M 2.5 10.5 A 7.5 7.5 0 0 1 6.2 4.1"
                        class="seg {segments >= 1 ? 'lit' : ''}"
                      />
                      <path
                        d="M 7.8 3.2 A 7.5 7.5 0 0 1 12.2 3.2"
                        class="seg {segments >= 2 ? 'lit' : ''}"
                      />
                      <path
                        d="M 13.8 4.1 A 7.5 7.5 0 0 1 17.5 10.5"
                        class="seg {segments >= 3 ? 'lit' : ''}"
                      />
                    </svg>
                  </span>

                  <span class="col-time mono-nums">{formatTimeCell(ev.timestamp)}</span>

                  <span class="col-event">
                    <span class="ev-country">{ev.country ?? ev.currency ?? ''}</span>
                    <span class="ev-title">{ev.title}</span>
                  </span>

                  <span class="col-exp mono-nums">{ev.forecast ?? '—'}</span>

                  <span class="col-act mono-nums {isReleased ? getActualToneClass(ev) : 'tone-countdown'}">
                    {#if ev.actual !== undefined && ev.actual !== ''}
                      {ev.actual}
                    {:else if ev.timestamp > nowMs}
                      {formatEventCountdown(ev.timestamp, nowMs)}
                    {:else}
                      —
                    {/if}
                  </span>
                </button>

                {#if isSelected}
                  <div class="event-detail-drawer">
                    {#if ev.description}
                      <p class="detail-desc">{ev.description}</p>
                    {/if}
                    <div class="detail-meta mono-nums">
                      <span>Previous: <strong>{ev.previous ?? '—'}</strong></span>
                      <span>Forecast: <strong>{ev.forecast ?? '—'}</strong></span>
                      {#if ev.actual}
                        <span>Actual: <strong>{ev.actual}</strong></span>
                      {/if}
                    </div>
                  </div>
                {/if}
              {/each}

              {#if hiddenCount > 0}
                <button
                  type="button"
                  class="show-more-btn"
                  onclick={() => toggleShowMoreGroup(group.key)}
                >
                  Show {hiddenCount} more
                </button>
              {/if}
            </div>
          {/if}
        </section>
      {/each}
    {/if}
  </div>
</div>

<style>
  .events-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    color: var(--text-primary);
    font-size: 11px;
  }

  .events-header {
    padding: 8px 10px 6px;
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .header-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .panel-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .symbol-context {
    font-size: 10px;
    color: var(--text-dim);
    padding: 1px 5px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--bg-darkest) 60%, transparent);
    border: 1px solid var(--border-hairline);
  }

  .refresh-btn {
    margin-left: auto;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-dim);
    width: 22px;
    height: 22px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .refresh-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  }

  .refresh-btn.spinning :global(svg) {
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .scope-segmented {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    padding: 2px;
    border-radius: 5px;
    background: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
  }

  .scope-btn {
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 4px 4px;
    font-size: 10px;
    font-weight: 500;
    color: var(--text-dim);
    cursor: pointer;
    white-space: nowrap;
  }

  .scope-btn.active {
    background: var(--bg-surface);
    color: var(--text-primary);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  }

  .category-pills {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .category-pills::-webkit-scrollbar {
    display: none;
  }

  .cat-pill {
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 10px;
    color: var(--text-dim);
    cursor: pointer;
    white-space: nowrap;
  }

  .cat-pill:hover {
    color: var(--text-primary);
    border-color: var(--border-bright);
  }

  .cat-pill.active {
    background: color-mix(in srgb, var(--brand-cyan, #38bdf8) 14%, transparent);
    border-color: color-mix(in srgb, var(--brand-cyan, #38bdf8) 45%, transparent);
    color: var(--brand-cyan, #38bdf8);
    font-weight: 600;
  }

  .events-table-head,
  .event-row {
    display: grid;
    grid-template-columns: 28px 42px minmax(0, 1fr) 46px 52px;
    align-items: center;
    gap: 4px;
    padding: 0 10px;
  }

  .events-table-head {
    height: 24px;
    font-size: 9.5px;
    font-weight: 600;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border-hairline);
    background: color-mix(in srgb, var(--bg-darkest) 40%, transparent);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .time-toggle-btn {
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    cursor: pointer;
  }

  .time-toggle-btn:hover {
    color: var(--text-primary);
  }

  .col-exp,
  .col-act {
    text-align: right;
  }

  .events-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .empty-state {
    padding: 24px 12px;
    text-align: center;
    color: var(--text-dim);
    font-size: 11px;
  }

  .group-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    background: color-mix(in srgb, var(--bg-darkest) 55%, transparent);
    border: none;
    border-bottom: 1px solid var(--border-hairline);
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }

  .group-header:hover {
    color: var(--text-primary);
  }

  .group-count {
    margin-left: auto;
    font-size: 9.5px;
    color: var(--text-dim);
    background: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: 999px;
    padding: 0 6px;
  }

  .event-row {
    width: 100%;
    min-height: 30px;
    padding-top: 5px;
    padding-bottom: 5px;
    background: transparent;
    border: none;
    border-bottom: 1px solid color-mix(in srgb, var(--border-hairline) 55%, transparent);
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    font-size: 10.5px;
  }

  .event-row:hover,
  .event-row.selected {
    background: var(--bg-hover, rgba(255, 255, 255, 0.04));
  }

  .col-imp {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .impact-gauge .seg {
    fill: none;
    stroke: color-mix(in srgb, var(--text-dim) 32%, transparent);
    stroke-width: 2.3;
    stroke-linecap: round;
  }

  .impact-gauge.impact-high .seg.lit {
    stroke: #ef4444;
  }

  .impact-gauge.impact-medium .seg.lit {
    stroke: #f59e0b;
  }

  .impact-gauge.impact-low .seg.lit {
    stroke: #3b82f6;
  }

  .col-time {
    color: var(--text-dim);
    font-size: 10px;
  }

  .col-event {
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-width: 0;
  }

  .ev-country {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .ev-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-primary);
  }

  .col-exp {
    color: var(--text-muted);
    font-size: 10px;
  }

  .col-act {
    font-size: 10px;
    font-weight: 600;
  }

  .tone-countdown {
    color: var(--text-dim);
    font-weight: 500;
  }

  .tone-bull {
    color: var(--bull-color, #10b981);
  }

  .tone-bear {
    color: var(--bear-color, #ef4444);
  }

  .tone-neutral {
    color: var(--text-primary);
  }

  .tone-upcoming {
    color: var(--text-dim);
  }

  .event-detail-drawer {
    padding: 6px 12px 8px 42px;
    background: color-mix(in srgb, var(--bg-darkest) 45%, transparent);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-desc {
    margin: 0;
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .detail-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 10px;
    color: var(--text-dim);
  }

  .detail-meta strong {
    color: var(--text-primary);
  }

  .show-more-btn {
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-hairline);
    color: var(--brand-cyan, #38bdf8);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
  }

  .show-more-btn:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.04));
  }
</style>
