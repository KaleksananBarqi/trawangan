<script lang="ts">
  import {
    History,
    Play,
    Pause,
    SkipForward,
    LocateFixed,
    X,
    TrendingUp,
    TrendingDown
  } from '@lucide/svelte';

  interface Props {
    isPlaying: boolean;
    playbackSpeed: number;
    onTogglePlay: () => void;
    onStepForward: () => void;
    onSelectSpeed: (speed: number) => void;
    onClose: () => void;
  }

  let {
    isPlaying,
    playbackSpeed,
    onTogglePlay,
    onStepForward,
    onSelectSpeed,
    onClose,
  }: Props = $props();

  const speeds = [0.5, 1, 3, 10];
</script>

<div class="replay-controller-bar obsidian-panel">
  <!-- Left Replay Controls -->
  <div class="controls-group">
    <div class="replay-badge">
      <History size={12} class="text-bear" />
      <span class="mono-nums">BAR REPLAY MODE</span>
    </div>

    <div class="divider"></div>

    <div class="playback-buttons">
      <button
        class="play-btn {isPlaying ? 'playing' : ''}"
        title={isPlaying ? 'Jeda Replay' : 'Mulai Replay'}
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
        title="Langkah +1 Bar ke depan"
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

  <!-- Right Multi-Timeframe Trend Matrix -->
  <div class="mtf-group mono-nums">
    <span class="mtf-title">MTF TREND:</span>
    <span class="mtf-tag bull">1m ▲</span>
    <span class="mtf-tag bull">5m ▲</span>
    <span class="mtf-tag bull">15m ▲</span>
    <span class="mtf-tag bull">1h ▲</span>
    <span class="mtf-tag bear">4h ▼</span>
    <span class="mtf-tag bull">1D ▲</span>

    <button class="close-replay-btn" title="Keluar dari Bar Replay" onclick={onClose}>
      <X size={13} />
    </button>
  </div>
</div>

<style>
  .replay-controller-bar {
    height: 32px;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    z-index: 25;
    flex-shrink: 0;
  }

  .controls-group, .mtf-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .replay-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: rgba(255, 59, 105, 0.12);
    border: 1px solid rgba(255, 59, 105, 0.25);
    color: var(--bear-color);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-xs);
  }

  .divider {
    width: 1px;
    height: 14px;
    background-color: var(--border-hairline);
  }

  .playback-buttons {
    display: flex;
    gap: 3px;
  }

  .play-btn, .step-btn {
    width: 24px;
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
    gap: 3px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .speed-label {
    font-size: 9px;
    color: var(--text-dim);
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

  .mtf-title {
    font-size: 10px;
    color: var(--text-dim);
    font-weight: 600;
  }

  .mtf-tag {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: var(--radius-xs);
  }

  .mtf-tag.bull {
    color: var(--bull-color);
    background-color: rgba(0, 240, 144, 0.1);
  }

  .mtf-tag.bear {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.1);
  }

  .close-replay-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    border-radius: var(--radius-xs);
    margin-left: 4px;
  }

  .close-replay-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .text-bear {
    color: var(--bear-color);
  }
</style>
