<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Play,
    Pause,
    SkipForward,
    SkipBack,
    FastForward,
    RotateCcw,
    Scissors,
    Calendar,
    X,
    GripVertical,
    ChevronUp,
    AlertTriangle,
  } from '@lucide/svelte';
  import {
    replaySession,
    REPLAY_SPEED_OPTIONS,
    type ReplaySnapshot,
  } from '../services/replay';
  import ReplayDatePickerModal from './ReplayDatePickerModal.svelte';

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let sessionSnap = $state<ReplaySnapshot>(replaySession.getSnapshot());
  let unsub: (() => void) | null = null;

  let isDatePickerOpen = $state(false);
  let isSpeedMenuOpen = $state(false);
  let hudEl: HTMLDivElement | null = $state(null);

  // Offset posisi drag relatif terhadap default tengah-bawah
  let dragOffsetX = $state(0);
  let dragOffsetY = $state(0);
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;

  // Preview & draft scrubber agar drag tidak memicu seekTo() konkuren di setiap piksel
  let scrubDraftTime = $state<number | null>(null);
  let scrubHoverPct = $state<number | null>(null);
  let scrubHoverTime = $state<number | null>(null);

  onMount(() => {
    unsub = replaySession.subscribe((snap) => {
      sessionSnap = snap;
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleWindowKeydownCapture, true);
    }
  });

  onDestroy(() => {
    if (unsub) unsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleWindowKeydownCapture, true);
    }
  });

  let isPlaying = $derived(sessionSnap.isPlaying);
  let playbackSpeed = $derived(sessionSnap.playbackSpeed);
  let isSelectingBar = $derived(sessionSnap.isSelectingBar);
  let currentBarTime = $derived(sessionSnap.cursorTime);
  let remainingBars = $derived(sessionSnap.remainingBars);
  let hasCutoff = $derived(sessionSnap.cutoffTime !== null && sessionSnap.status !== 'idle');

  let scrubMin = $derived.by(() => {
    const cut = sessionSnap.cutoffTime ?? sessionSnap.bounds?.first ?? 0;
    if (currentBarTime !== null && currentBarTime < cut) {
      return sessionSnap.bounds?.first ?? currentBarTime;
    }
    return cut;
  });
  let scrubMax = $derived(sessionSnap.bounds?.last ?? scrubMin);
  let scrubValue = $derived.by(() => {
    const activeTime = scrubDraftTime ?? currentBarTime;
    if (!activeTime || scrubMax <= scrubMin) return scrubMin;
    return Math.max(scrubMin, Math.min(scrubMax, activeTime));
  });
  let scrubPct = $derived(
    scrubMax > scrubMin ? ((scrubValue - scrubMin) / (scrubMax - scrubMin)) * 100 : 0
  );

  function formatBarTime(epochMs: number | null | undefined): string {
    if (!epochMs) return '--:--';
    return new Date(epochMs).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function handleToggleSelectBar() {
    isSpeedMenuOpen = false;
    if (sessionSnap.isSelectingBar) {
      replaySession.cancelBarSelection();
    } else {
      replaySession.enableBarSelection();
    }
  }

  function handleToggleDatePicker() {
    isSpeedMenuOpen = false;
    isDatePickerOpen = !isDatePickerOpen;
  }

  function handleTogglePlay() {
    isSpeedMenuOpen = false;
    replaySession.togglePlay();
  }

  function handleStepBackward() {
    isSpeedMenuOpen = false;
    replaySession.stepBack(1);
  }

  function handleStepForward() {
    isSpeedMenuOpen = false;
    replaySession.step(1);
  }

  function handleSkipToEnd() {
    isSpeedMenuOpen = false;
    void replaySession.skipToEnd();
  }

  function handleSelectSpeed(s: number) {
    isSpeedMenuOpen = false;
    replaySession.setSpeed(s);
  }

  function handleRewind() {
    isSpeedMenuOpen = false;
    void replaySession.rewind();
  }

  function handleClose() {
    isDatePickerOpen = false;
    isSpeedMenuOpen = false;
    if (onClose) {
      onClose();
    } else {
      replaySession.close();
    }
  }

  function handleScrubInput(e: Event) {
    const val = Number((e.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(val) && val > 0) {
      scrubDraftTime = val;
    }
  }

  function handleScrubCommit(e: Event) {
    const val = Number((e.currentTarget as HTMLInputElement).value);
    scrubDraftTime = null;
    if (Number.isFinite(val) && val > 0) {
      void replaySession.seekTo(val);
    }
  }

  function handleScrubMouseMove(e: MouseEvent) {
    if (scrubMax <= scrubMin) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    scrubHoverPct = pct * 100;
    scrubHoverTime = Math.round(scrubMin + pct * (scrubMax - scrubMin));
  }

  function handleScrubMouseLeave() {
    scrubHoverPct = null;
    scrubHoverTime = null;
  }

  // Dragging HUD dengan viewport clamping
  function handleGripPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOriginX = dragOffsetX;
    dragOriginY = dragOffsetY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function handleGripPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const maxW = typeof window !== 'undefined' ? window.innerWidth * 0.42 : 500;
    const maxUp = typeof window !== 'undefined' ? window.innerHeight - 140 : 600;
    dragOffsetX = Math.max(-maxW, Math.min(maxW, dragOriginX + dx));
    dragOffsetY = Math.max(-maxUp, Math.min(24, dragOriginY + dy));
  }

  function handleGripPointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  }

  function resetHudPosition() {
    dragOffsetX = 0;
    dragOffsetY = 0;
  }

  function handleWindowPointerDown(e: PointerEvent) {
    if (!isSpeedMenuOpen) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('.speed-popover-wrap')) return;
    isSpeedMenuOpen = false;
  }

  function handleWindowKeydownCapture(e: KeyboardEvent) {
    if (e.key === 'Escape' && isSpeedMenuOpen) {
      isSpeedMenuOpen = false;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div
  bind:this={hudEl}
  class="replay-hud-anchor"
  style="transform: translate(calc(-50% + {dragOffsetX}px), {dragOffsetY}px);"
>
  {#if sessionSnap.errorMessage}
    <div class="replay-error-toast obsidian-card mono-nums" role="alert">
      <AlertTriangle size={12} class="err-icon" />
      <span>{sessionSnap.errorMessage}</span>
      <button type="button" class="err-close" onclick={() => replaySession.clearError()} title="Tutup">
        <X size={11} />
      </button>
    </div>
  {/if}

  {#if isDatePickerOpen}
    <div class="anchored-datepicker">
      <ReplayDatePickerModal
        isOpen={isDatePickerOpen}
        bounds={sessionSnap.bounds}
        currentBarTime={currentBarTime}
        onSelectDate={(ts) => {
          void replaySession.setCutoff(ts);
        }}
        onClose={() => (isDatePickerOpen = false)}
      />
    </div>
  {/if}

  <div class="replay-floating-pill obsidian-card {isPlaying ? 'is-playing' : ''} {isDragging ? 'is-dragging' : ''}">
    <button
      type="button"
      class="drag-grip-btn"
      title="Geser posisi Replay HUD (Double-click untuk reset)"
      onpointerdown={handleGripPointerDown}
      onpointermove={handleGripPointerMove}
      onpointerup={handleGripPointerUp}
      onpointercancel={handleGripPointerUp}
      ondblclick={resetHudPosition}
    >
      <GripVertical size={13} />
    </button>

    {#if sessionSnap.status === 'loading'}
      <div class="hud-loading-state mono-nums">
        <span class="loading-spinner-dot"></span>
        <span>Memuat histori candle...</span>
      </div>
    {:else if isSelectingBar && !hasCutoff}
      <div class="hud-selecting-state">
        <span class="cut-pulse-badge mono-nums">
          <Scissors size={12} />
          <span>Klik candle di grafik untuk memotong</span>
        </span>
        <button
          type="button"
          class="hud-chip-btn"
          data-replay-datepicker-trigger
          onclick={handleToggleDatePicker}
        >
          <Calendar size={12} />
          <span>Pilih Tanggal</span>
        </button>
      </div>
    {:else}
      <div class="hud-section">
        <button
          type="button"
          class="hud-icon-text-btn {isSelectingBar ? 'active-cutter' : ''}"
          title={isSelectingBar ? 'Batalkan mode gunting' : 'Pilih ulang titik potong di grafik'}
          onclick={handleToggleSelectBar}
        >
          <Scissors size={12} />
          <span>{isSelectingBar ? 'Klik Lilin...' : 'Potong'}</span>
        </button>

        <button
          type="button"
          class="hud-icon-text-btn time-btn mono-nums {isDatePickerOpen ? 'active-btn' : ''}"
          data-replay-datepicker-trigger
          title="Lompat ke tanggal & jam tertentu"
          onclick={handleToggleDatePicker}
        >
          <Calendar size={12} />
          <span>{formatBarTime(currentBarTime)}</span>
        </button>
      </div>

      <div class="hud-divider"></div>

      <div class="hud-section transport-group">
        <button
          type="button"
          class="hud-step-btn"
          title="Kembali ke awal cut-off (Rewind)"
          onclick={handleRewind}
        >
          <RotateCcw size={12} />
        </button>

        <button
          type="button"
          class="hud-step-btn"
          title="Mundur 1 Bar (←)"
          onclick={handleStepBackward}
        >
          <SkipBack size={12} />
        </button>

        <button
          type="button"
          class="hud-play-btn {isPlaying ? 'playing' : ''}"
          title={isPlaying ? 'Jeda Replay (Space)' : 'Putar Replay (Space)'}
          onclick={handleTogglePlay}
        >
          {#if isPlaying}
            <Pause size={13} />
          {:else}
            <Play size={13} fill="currentColor" />
          {/if}
        </button>

        <button
          type="button"
          class="hud-step-btn"
          title="Maju 1 Bar (→)"
          onclick={handleStepForward}
        >
          <SkipForward size={12} />
        </button>

        <button
          type="button"
          class="hud-step-btn"
          title="Lompat ke bar real-time terakhir (tanpa menutup Replay)"
          onclick={handleSkipToEnd}
        >
          <FastForward size={12} />
        </button>
      </div>

      <div class="hud-divider"></div>

      <!-- Interactive Timeline Scrubber -->
      <div
        class="scrubber-wrap"
        onmousemove={handleScrubMouseMove}
        onmouseleave={handleScrubMouseLeave}
        role="group"
        aria-label="Timeline Replay Scrubber"
      >
        {#if scrubHoverPct !== null && scrubHoverTime !== null}
          <div class="scrub-tooltip mono-nums" style="left: {scrubHoverPct}%;">
            {formatBarTime(scrubHoverTime)}
          </div>
        {/if}
        <input
          type="range"
          class="scrubber-range"
          min={scrubMin}
          max={Math.max(scrubMin + 1, scrubMax)}
          value={scrubValue}
          disabled={scrubMax <= scrubMin}
          oninput={handleScrubInput}
          onchange={handleScrubCommit}
          style="--scrub-pct: {scrubPct}%;"
          aria-label="Geser posisi waktu replay"
        />
        <span class="scrub-counter mono-nums" title="Progres bar replay">
          {sessionSnap.totalReplayBars > 0
            ? `${sessionSnap.currentStepIndex}/${sessionSnap.totalReplayBars}`
            : `-${remainingBars}`}
        </span>
      </div>

      <div class="hud-divider"></div>

      <!-- Speed Popover -->
      <div class="speed-popover-wrap">
        {#if isSpeedMenuOpen}
          <div class="speed-menu obsidian-card mono-nums">
            {#each REPLAY_SPEED_OPTIONS as s}
              <button
                type="button"
                class="speed-opt {playbackSpeed === s ? 'active' : ''}"
                onclick={() => handleSelectSpeed(s)}
              >
                {s}x
              </button>
            {/each}
          </div>
        {/if}
        <button
          type="button"
          class="speed-trigger-btn mono-nums {isSpeedMenuOpen ? 'active-btn' : ''}"
          title="Kecepatan Replay"
          onclick={() => (isSpeedMenuOpen = !isSpeedMenuOpen)}
        >
          <span>{playbackSpeed}x</span>
          <ChevronUp size={11} />
        </button>
      </div>
    {/if}

    <div class="hud-divider"></div>

    <button
      type="button"
      class="hud-close-btn"
      title="Keluar dari Bar Replay (Kembali ke Live)"
      onclick={handleClose}
    >
      <X size={13} />
    </button>
  </div>
</div>

<style>
  .replay-hud-anchor {
    position: absolute;
    bottom: 44px;
    left: 50%;
    z-index: 45;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }

  .anchored-datepicker {
    pointer-events: auto;
  }

  .replay-error-toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    background-color: rgba(34, 15, 20, 0.96);
    border: 1px solid rgba(255, 59, 105, 0.45);
    border-radius: var(--radius-sm);
    color: #fca5a5;
    font-size: 11px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
  }

  :global(.err-icon) {
    color: var(--bear-color);
    flex-shrink: 0;
  }

  .err-close {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px;
    display: flex;
  }

  .err-close:hover {
    color: var(--text-main);
  }

  .replay-floating-pill {
    pointer-events: auto;
    height: 40px;
    padding: 0 8px 0 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: rgba(16, 19, 26, 0.94);
    backdrop-filter: blur(14px);
    border: 1px solid var(--border-medium);
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.04);
    user-select: none;
    white-space: nowrap;
  }

  .replay-floating-pill.is-playing {
    border-color: rgba(0, 212, 170, 0.45);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65), 0 0 12px rgba(0, 212, 170, 0.14);
  }

  .replay-floating-pill.is-dragging {
    cursor: grabbing;
    opacity: 0.94;
  }

  .drag-grip-btn {
    width: 18px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: grab;
    border-radius: var(--radius-xs);
    padding: 0;
  }

  .drag-grip-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .drag-grip-btn:active {
    cursor: grabbing;
  }

  .hud-section {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hud-divider {
    width: 1px;
    height: 18px;
    background-color: var(--border-hairline);
    flex-shrink: 0;
  }

  .hud-selecting-state {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 2px;
  }

  .cut-pulse-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--bear-color);
    padding: 0 4px;
  }

  .hud-loading-state {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #fbbf24;
    padding: 0 8px;
  }

  .loading-spinner-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: #fbbf24;
    box-shadow: 0 0 8px rgba(251, 191, 36, 0.8);
    animation: pulseDot 0.9s infinite alternate ease-in-out;
  }

  @keyframes pulseDot {
    0% { transform: scale(0.75); opacity: 0.5; }
    100% { transform: scale(1.25); opacity: 1; }
  }

  .hud-chip-btn,
  .hud-icon-text-btn {
    height: 28px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .hud-chip-btn:hover,
  .hud-icon-text-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .hud-icon-text-btn.active-btn {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .hud-icon-text-btn.active-cutter {
    background-color: rgba(255, 59, 105, 0.16);
    border-color: var(--bear-color);
    color: var(--bear-color);
    font-weight: 700;
  }

  .time-btn {
    color: var(--text-main);
  }

  .transport-group {
    gap: 3px;
  }

  .hud-step-btn,
  .hud-play-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .hud-step-btn:hover,
  .hud-play-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .hud-play-btn {
    width: 32px;
    color: var(--text-main);
  }

  .hud-play-btn.playing {
    background-color: var(--brand-primary);
    border-color: var(--brand-primary);
    color: var(--on-brand-primary, #000000);
  }

  .scrubber-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
  }

  .scrub-tooltip {
    position: absolute;
    bottom: 28px;
    transform: translateX(-50%);
    padding: 2px 7px;
    background-color: rgba(10, 12, 18, 0.96);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-xs);
    font-size: 10px;
    color: var(--text-main);
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  }

  .scrubber-range {
    -webkit-appearance: none;
    appearance: none;
    width: 118px;
    height: 4px;
    border-radius: 99px;
    background: linear-gradient(
      to right,
      var(--brand-primary) 0%,
      var(--brand-primary) var(--scrub-pct, 0%),
      rgba(255, 255, 255, 0.14) var(--scrub-pct, 0%),
      rgba(255, 255, 255, 0.14) 100%
    );
    outline: none;
    cursor: pointer;
  }

  .scrubber-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: var(--brand-primary);
    border: 2px solid #0b0e14;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
    cursor: grab;
  }

  .scrubber-range:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .scrub-counter {
    font-size: 10px;
    color: var(--text-dim);
    min-width: 46px;
    text-align: right;
  }

  .speed-popover-wrap {
    position: relative;
  }

  .speed-trigger-btn {
    height: 28px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .speed-trigger-btn:hover,
  .speed-trigger-btn.active-btn {
    background-color: var(--bg-hover);
    border-color: var(--brand-primary);
  }

  .speed-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    min-width: 66px;
    background-color: rgba(17, 20, 27, 0.98);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-sm);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.7);
  }

  .speed-opt {
    height: 24px;
    padding: 0 8px;
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    text-align: left;
    cursor: pointer;
  }

  .speed-opt:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .speed-opt.active {
    background-color: rgba(0, 212, 170, 0.15);
    color: var(--brand-primary);
    font-weight: 700;
  }

  .hud-close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .hud-close-btn:hover {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.12);
    border-color: rgba(255, 59, 105, 0.3);
  }
</style>
