<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Calendar, Clock, X, Check, ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { replaySession } from '../services/replay';

  interface Props {
    isOpen: boolean;
    bounds?: { first: number; last: number } | null;
    currentBarTime?: number | null;
    onSelectDate?: (timestamp: number) => void;
    onClose: () => void;
  }

  let {
    isOpen,
    bounds: propBounds,
    currentBarTime: propCurrentBarTime,
    onSelectDate,
    onClose,
  }: Props = $props();

  let bounds = $derived(propBounds !== undefined ? propBounds : replaySession.getSnapshot().bounds);
  let currentBarTime = $derived(propCurrentBarTime !== undefined ? propCurrentBarTime : replaySession.getSnapshot().cursorTime);

  const MONTHS_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const WEEKDAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  let viewYear = $state(new Date().getFullYear());
  let viewMonth = $state(new Date().getMonth());
  let selYear = $state(new Date().getFullYear());
  let selMonth = $state(new Date().getMonth());
  let selDay = $state(new Date().getDate());
  let selHour = $state(0);
  let selMinute = $state(0);
  let quickText = $state('');
  let errorMessage = $state('');

  let popoverEl: HTMLDivElement | null = $state(null);
  let wasOpen = false;

  function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
  }

  function syncFromEpoch(epochMs: number) {
    const d = new Date(epochMs);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    selYear = d.getFullYear();
    selMonth = d.getMonth();
    selDay = d.getDate();
    selHour = d.getHours();
    selMinute = d.getMinutes();
    syncQuickText();
  }

  function syncQuickText() {
    quickText = `${selYear}-${pad2(selMonth + 1)}-${pad2(selDay)} ${pad2(selHour)}:${pad2(selMinute)}`;
  }

  $effect(() => {
    if (isOpen && !wasOpen) {
      wasOpen = true;
      errorMessage = '';
      const baseTime = currentBarTime || (bounds ? bounds.last - 24 * 3600 * 1000 : Date.now() - 24 * 3600 * 1000);
      syncFromEpoch(baseTime);
    } else if (!isOpen && wasOpen) {
      wasOpen = false;
    }
  });

  function formatDisplayDate(epochMs: number): string {
    return new Date(epochMs).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  const calendarCells = $derived.by(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const now = new Date();
    const cells: Array<{ day: number | null; isToday: boolean; isSelected: boolean; isFuture: boolean }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, isToday: false, isSelected: false, isFuture: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cellDateStart = new Date(viewYear, viewMonth, d, 0, 0, 0, 0).getTime();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      cells.push({
        day: d,
        isToday: cellDateStart === todayStart,
        isSelected: viewYear === selYear && viewMonth === selMonth && d === selDay,
        isFuture: cellDateStart > todayStart,
      });
    }
    return cells;
  });

  function prevMonth() {
    if (viewMonth === 0) {
      viewMonth = 11;
      viewYear--;
    } else {
      viewMonth--;
    }
  }

  function nextMonth() {
    const now = new Date();
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) {
      return;
    }
    if (viewMonth === 11) {
      viewMonth = 0;
      viewYear++;
    } else {
      viewMonth++;
    }
  }

  function selectDay(day: number) {
    errorMessage = '';
    selYear = viewYear;
    selMonth = viewMonth;
    selDay = day;
    syncQuickText();
  }

  function adjustHour(delta: number) {
    errorMessage = '';
    selHour = (selHour + delta + 24) % 24;
    syncQuickText();
  }

  function adjustMinute(delta: number) {
    errorMessage = '';
    selMinute = (selMinute + delta + 60) % 60;
    syncQuickText();
  }

  function parseStrictQuickText(val: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})$/.exec(val.trim());
    if (!match) return null;
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const hh = parseInt(match[4], 10);
    const mm = parseInt(match[5], 10);
    const parsed = new Date(y, m, d, hh, mm, 0, 0);
    if (
      isNaN(parsed.getTime()) ||
      parsed.getFullYear() !== y ||
      parsed.getMonth() !== m ||
      parsed.getDate() !== d ||
      parsed.getHours() !== hh ||
      parsed.getMinutes() !== mm
    ) {
      return null;
    }
    return parsed;
  }

  function handleQuickTextInput(val: string) {
    quickText = val;
    errorMessage = '';
    const parsed = parseStrictQuickText(val);
    if (parsed) {
      selYear = parsed.getFullYear();
      selMonth = parsed.getMonth();
      selDay = parsed.getDate();
      selHour = parsed.getHours();
      selMinute = parsed.getMinutes();
      viewYear = selYear;
      viewMonth = selMonth;
    }
  }

  const presets = [
    { label: '24 Jam', offsetMs: 24 * 3600 * 1000 },
    { label: '3 Hari', offsetMs: 3 * 24 * 3600 * 1000 },
    { label: '7 Hari', offsetMs: 7 * 24 * 3600 * 1000 },
    { label: '30 Hari', offsetMs: 30 * 24 * 3600 * 1000 },
  ];

  function applyPreset(offsetMs: number) {
    errorMessage = '';
    const referenceTime = bounds?.last || Date.now();
    syncFromEpoch(referenceTime - offsetMs);
  }

  function applyChartStart() {
    errorMessage = '';
    if (bounds?.first) {
      syncFromEpoch(bounds.first);
    }
  }

  function handleSubmit(e?: SubmitEvent) {
    if (e) e.preventDefault();
    errorMessage = '';

    const parsedQuick = parseStrictQuickText(quickText);
    if (!parsedQuick) {
      errorMessage = 'Format tanggal atau jam tidak valid (gunakan YYYY-MM-DD HH:mm).';
      return;
    }

    const selectedEpoch = parsedQuick.getTime();
    if (selectedEpoch > Date.now()) {
      errorMessage = 'Waktu tidak boleh berada di masa depan.';
      return;
    }

    if (onSelectDate) {
      onSelectDate(selectedEpoch);
    } else {
      void replaySession.setCutoff(selectedEpoch);
    }
    onClose();
  }

  function handleWindowPointerDown(e: PointerEvent) {
    if (!isOpen || !popoverEl) return;
    const target = e.target as HTMLElement | null;
    if (target && (popoverEl.contains(target) || target.closest('[data-replay-datepicker-trigger]'))) {
      return;
    }
    onClose();
  }

  function handleWindowKeydownCapture(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      // Tangkap di capture-phase agar Esc tidak ikut memicu cancel-action di CommandDispatcher
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      onClose();
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleWindowKeydownCapture, true);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleWindowKeydownCapture, true);
    }
  });
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

{#if isOpen}
  <div
    bind:this={popoverEl}
    class="replay-date-popover obsidian-card"
    role="dialog"
    aria-label="Lompat ke Tanggal Replay"
  >
    <div class="popover-header">
      <div class="header-title">
        <Calendar size={14} class="header-icon" />
        <span>Lompat ke Tanggal & Jam</span>
      </div>
      <button type="button" class="close-btn" title="Tutup (Esc)" onclick={onClose}>
        <X size={13} />
      </button>
    </div>

    <form class="popover-body" onsubmit={handleSubmit}>
      <div class="presets-row">
        {#each presets as p}
          <button type="button" class="preset-chip" onclick={() => applyPreset(p.offsetMs)}>
            {p.label}
          </button>
        {/each}
        {#if bounds?.first}
          <button type="button" class="preset-chip preset-start" onclick={applyChartStart} title="Lompat ke candle paling awal di memori">
            Awal Chart
          </button>
        {/if}
      </div>

      <div class="calendar-box">
        <div class="cal-nav">
          <button type="button" class="nav-btn" onclick={prevMonth} title="Bulan Sebelumnya">
            <ChevronLeft size={14} />
          </button>
          <span class="cal-month-label">{MONTHS_ID[viewMonth]} {viewYear}</span>
          <button type="button" class="nav-btn" onclick={nextMonth} title="Bulan Berikutnya">
            <ChevronRight size={14} />
          </button>
        </div>

        <div class="cal-weekdays">
          {#each WEEKDAYS_ID as wd}
            <span>{wd}</span>
          {/each}
        </div>

        <div class="cal-grid mono-nums">
          {#each calendarCells as cell}
            {#if cell.day === null}
              <span class="cal-empty"></span>
            {:else}
              <button
                type="button"
                class="cal-day {cell.isSelected ? 'selected' : ''} {cell.isToday ? 'today' : ''}"
                disabled={cell.isFuture}
                onclick={() => selectDay(cell.day!)}
              >
                {cell.day}
              </button>
            {/if}
          {/each}
        </div>
      </div>

      <div class="time-and-input-row">
        <div class="time-stepper">
          <Clock size={12} class="time-icon" />
          <div class="hm-group mono-nums">
            <button type="button" class="hm-btn" onclick={() => adjustHour(-1)}>-</button>
            <input
              type="number"
              min="0"
              max="23"
              class="hm-input"
              value={pad2(selHour)}
              oninput={(e) => {
                const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
                if (!isNaN(v) && v >= 0 && v <= 23) {
                  selHour = v;
                  syncQuickText();
                }
              }}
            />
            <button type="button" class="hm-btn" onclick={() => adjustHour(1)}>+</button>
          </div>
          <span class="hm-sep">:</span>
          <div class="hm-group mono-nums">
            <button type="button" class="hm-btn" onclick={() => adjustMinute(-5)}>-</button>
            <input
              type="number"
              min="0"
              max="59"
              class="hm-input"
              value={pad2(selMinute)}
              oninput={(e) => {
                const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
                if (!isNaN(v) && v >= 0 && v <= 59) {
                  selMinute = v;
                  syncQuickText();
                }
              }}
            />
            <button type="button" class="hm-btn" onclick={() => adjustMinute(5)}>+</button>
          </div>
        </div>

        <input
          type="text"
          class="quick-text-input mono-nums"
          placeholder="YYYY-MM-DD HH:mm"
          value={quickText}
          oninput={(e) => handleQuickTextInput((e.currentTarget as HTMLInputElement).value)}
          aria-label="Ketik tanggal dan jam"
        />
      </div>

      {#if bounds && bounds.first && bounds.last}
        <div class="bounds-hint mono-nums">
          <span>Memori: {formatDisplayDate(bounds.first)} — {formatDisplayDate(bounds.last)}</span>
        </div>
      {/if}

      {#if errorMessage}
        <div class="error-banner mono-nums">{errorMessage}</div>
      {/if}

      <div class="popover-footer">
        <button type="button" class="cancel-btn" onclick={onClose}>Batal</button>
        <button type="submit" class="submit-btn">
          <Check size={13} />
          <span>Lompat ke Tanggal Ini</span>
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  .replay-date-popover {
    width: 320px;
    max-height: calc(100vh - 140px);
    overflow-y: auto;
    background-color: rgba(17, 20, 27, 0.98);
    backdrop-filter: blur(14px);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-md);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.04);
    z-index: 60;
  }

  .popover-header {
    height: 34px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--border-hairline);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-main);
  }

  :global(.header-icon) {
    color: var(--brand-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .popover-body {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .presets-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .preset-chip {
    flex: 1 1 auto;
    height: 24px;
    padding: 0 7px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .preset-chip:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .preset-start {
    color: var(--brand-primary);
  }

  .calendar-box {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 8px;
  }

  .cal-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .nav-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    cursor: pointer;
  }

  .nav-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .cal-month-label {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-main);
  }

  .cal-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 9.5px;
    font-weight: 600;
    color: var(--text-dim);
    margin-bottom: 4px;
  }

  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .cal-empty {
    height: 26px;
  }

  .cal-day {
    height: 26px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s ease;
  }

  .cal-day:hover:not(:disabled) {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .cal-day.today {
    border-color: rgba(255, 255, 255, 0.18);
    color: var(--text-main);
  }

  .cal-day.selected {
    background-color: var(--brand-primary);
    color: var(--on-brand-primary, #000000);
    font-weight: 700;
  }

  .cal-day:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }

  .time-and-input-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .time-stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 4px 8px;
  }

  :global(.time-icon) {
    color: var(--text-dim);
  }

  .hm-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .hm-btn {
    width: 20px;
    height: 22px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hm-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .hm-input {
    width: 32px;
    height: 22px;
    text-align: center;
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: 11.5px;
    font-weight: 600;
    outline: none;
  }

  .hm-input::-webkit-inner-spin-button,
  .hm-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .hm-sep {
    font-weight: 700;
    color: var(--text-dim);
  }

  .quick-text-input {
    width: 100%;
    height: 28px;
    padding: 0 8px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: 11px;
    outline: none;
  }

  .quick-text-input:focus {
    border-color: var(--brand-primary);
  }

  .bounds-hint {
    font-size: 9.5px;
    color: var(--text-dim);
    text-align: center;
  }

  .error-banner {
    background-color: rgba(255, 59, 105, 0.12);
    border: 1px solid rgba(255, 59, 105, 0.3);
    color: var(--bear-color);
    padding: 5px 8px;
    border-radius: var(--radius-xs);
    font-size: 10.5px;
  }

  .popover-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border-hairline);
  }

  .cancel-btn {
    height: 28px;
    padding: 0 10px;
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
  }

  .cancel-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .submit-btn {
    height: 28px;
    padding: 0 12px;
    background-color: var(--brand-primary);
    border: 1px solid var(--brand-primary);
    border-radius: var(--radius-xs);
    color: var(--on-brand-primary, #000000);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
  }

  .submit-btn:hover {
    opacity: 0.92;
  }
</style>
