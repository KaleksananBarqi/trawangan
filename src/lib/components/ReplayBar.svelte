<script lang="ts">
  import {
    History,
    Play,
    Pause,
    SkipForward,
    RotateCcw,
    Scissors,
    Calendar,
    X,
    Clock,
    Layers
  } from '@lucide/svelte';

  interface Props {
    isPlaying: boolean;
    playbackSpeed: number;
    isSelectingBar?: boolean;
    currentBarTime?: number | null;
    remainingBars?: number;
    onToggleSelectBar?: () => void;
    onOpenDatePicker?: () => void;
    onTogglePlay: () => void;
    onStepForward: () => void;
    onSelectSpeed: (speed: number) => void;
    onClose: () => void;
    onRewind?: () => void;
  }

  let {
    isPlaying,
    playbackSpeed,
    isSelectingBar = false,
    currentBarTime = null,
    remainingBars = 0,
    onToggleSelectBar,
    onOpenDatePicker,
    onTogglePlay,
    onStepForward,
    onSelectSpeed,
    onClose,
    onRewind,
  }: Props = $props();

  const speeds = [0.2, 0.5, 1, 3, 5, 10];

  function formatBarTime(epochMs: number | null | undefined): string {
    if (!epochMs) return '--:--';
    const d = new Date(epochMs);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
</script>

<div class="replay-controller-bar obsidian-panel">
  <!-- Left: Mode Badge & Time Telemetry -->
  <div class="group-left">
    <div class="replay-badge {isPlaying ? 'pulse-active' : ''}">
      <History size={12} class="text-bear" />
      <span class="badge-text mono-nums">BAR REPLAY</span>
    </div>

    <!-- Current Bar Time Indicator -->
    {#if currentBarTime}
      <div class="time-readout mono-nums" title="Waktu lilin yang sedang ditampilkan saat ini">
        <Clock size={11} class="text-dim" />
        <span class="time-label">{formatBarTime(currentBarTime)}</span>
      </div>
    {/if}

    <!-- Remaining Bars Counter -->
    {#if remainingBars > 0}
      <div class="remaining-badge mono-nums" title="Jumlah candle masa depan yang disembunyikan">
        <span>Sisa: {remainingBars.toLocaleString()} bar</span>
      </div>
    {/if}
  </div>

  <!-- Center: Action & Selection Tools + Playback -->
  <div class="group-center">
    <!-- Cut-off & Date Selection Tools -->
    <div class="selection-tools">
      {#if onToggleSelectBar}
        <button
          class="tool-btn {isSelectingBar ? 'active-cutter' : ''}"
          title={isSelectingBar ? 'Batalkan Pemilihan Bar' : 'Pilih Lilin di Grafik (Gunting Titik Replay)'}
          onclick={onToggleSelectBar}
        >
          <Scissors size={12} />
          <span>{isSelectingBar ? 'Klik Lilin...' : 'Pilih Bar'}</span>
        </button>
      {/if}

      {#if onOpenDatePicker}
        <button
          class="tool-btn"
          title="Lompat ke Tanggal & Jam Tertentu"
          onclick={onOpenDatePicker}
        >
          <Calendar size={12} />
          <span>Pilih Tanggal</span>
        </button>
      {/if}
    </div>

    <div class="divider"></div>

    <!-- Playback Control Buttons -->
    <div class="playback-buttons">
      {#if onRewind}
        <button
          class="step-btn"
          title="Kembali ke titik awal cut-off (Rewind)"
          onclick={onRewind}
        >
          <RotateCcw size={12} />
        </button>
      {/if}

      <button
        class="play-btn {isPlaying ? 'playing' : ''}"
        title={isPlaying ? 'Jeda Replay (Space)' : 'Mulai Replay (Space)'}
        onclick={onTogglePlay}
      >
        {#if isPlaying}
          <Pause size={12} />
        {:else}
          <Play size={12} fill="currentColor" />
        {/if}
      </button>

      <button
        class="step-btn"
        title="Langkah +1 Bar ke depan (Panah Kanan)"
        onclick={onStepForward}
      >
        <SkipForward size={12} />
      </button>
    </div>

    <div class="divider"></div>

    <!-- Speed Selector -->
    <div class="speed-selector mono-nums">
      <span class="speed-label">SPEED:</span>
      {#each speeds as s}
        <button
          class="speed-chip {playbackSpeed === s ? 'active' : ''}"
          onclick={() => onSelectSpeed(s)}
        >
          {s}x
        </button>
      {/each}
    </div>
  </div>

  <!-- Right: Close Button -->
  <div class="group-right">
    <button class="close-replay-btn" title="Keluar dari Bar Replay (Kembali ke Live)" onclick={onClose}>
      <X size={13} />
      <span class="close-text">Keluar</span>
    </button>
  </div>
</div>

<style>
  .replay-controller-bar {
    height: 36px;
    background-color: var(--bg-surface);
    border-bottom: 1px solid var(--border-medium);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    z-index: 25;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }

  .group-left, .group-center, .group-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .replay-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: rgba(255, 59, 105, 0.12);
    border: 1px solid rgba(255, 59, 105, 0.28);
    color: var(--bear-color);
    font-size: 10px;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: var(--radius-xs);
  }

  .replay-badge.pulse-active {
    box-shadow: 0 0 8px var(--bear-glow);
    border-color: var(--bear-color);
  }

  .time-readout {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    padding: 2px 8px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    color: var(--text-main);
  }

  .time-label {
    letter-spacing: -0.01em;
  }

  .remaining-badge {
    font-size: 10px;
    color: var(--text-dim);
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    padding: 2px 6px;
    border-radius: var(--radius-xs);
  }

  .selection-tools {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tool-btn {
    height: 24px;
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

  .tool-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .tool-btn.active-cutter {
    background-color: rgba(255, 59, 105, 0.18);
    border-color: var(--bear-color);
    color: var(--bear-color);
    font-weight: 700;
    animation: pulse-cutter 1.5s infinite;
  }

  @keyframes pulse-cutter {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(255, 59, 105, 0.4);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(255, 59, 105, 0);
    }
  }

  .divider {
    width: 1px;
    height: 16px;
    background-color: var(--border-hairline);
  }

  .playback-buttons {
    display: flex;
    gap: 3px;
  }

  .play-btn, .step-btn {
    width: 26px;
    height: 24px;
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

  .play-btn:hover, .step-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .play-btn.playing {
    background-color: var(--brand-primary);
    color: var(--bg-darkest);
    border-color: var(--brand-primary);
  }

  .speed-selector {
    display: flex;
    align-items: center;
    gap: 2px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .speed-label {
    font-size: 9px;
    color: var(--text-dim);
    margin-right: 2px;
  }

  .speed-chip {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 10px;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
    cursor: pointer;
  }

  .speed-chip:hover {
    color: var(--text-main);
  }

  .speed-chip.active {
    color: var(--brand-primary);
    background-color: var(--bg-surface);
    font-weight: 700;
  }

  .close-replay-btn {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    cursor: pointer;
    padding: 3px 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    transition: all 0.15s ease;
  }

  .close-replay-btn:hover {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.1);
    border-color: rgba(255, 59, 105, 0.3);
  }

  .close-text {
    font-weight: 500;
  }

  .text-bear {
    color: var(--bear-color);
  }

  .text-dim {
    color: var(--text-dim);
  }
</style>
