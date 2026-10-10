<script lang="ts">
  import { Plus, Clock, X, Star, Trash2, RotateCcw } from '@lucide/svelte';
  import type { Timeframe } from '../../types/market';

  interface Props {
    activeTimeframe: Timeframe;
    favoriteTimeframes?: Timeframe[];
    customTimeframes?: string[];
    onTimeframeChange: (tf: Timeframe) => void;
    onFavoriteTimeframesChange?: (tfs: Timeframe[]) => void;
    onCustomTimeframesChange?: (customs: string[]) => void;
  }

  let {
    activeTimeframe,
    favoriteTimeframes = ['1m', '5m', '15m', '1h', '4h', '1D'],
    customTimeframes = [],
    onTimeframeChange,
    onFavoriteTimeframesChange,
    onCustomTimeframesChange
  }: Props = $props();

  const STANDARD_TIMEFRAME_GROUPS = [
    {
      group: 'Menit',
      items: [
        { id: '1m', label: '1m', desc: '1 Menit' },
        { id: '3m', label: '3m', desc: '3 Menit' },
        { id: '5m', label: '5m', desc: '5 Menit' },
        { id: '15m', label: '15m', desc: '15 Menit' },
        { id: '30m', label: '30m', desc: '30 Menit' },
        { id: '45m', label: '45m', desc: '45 Menit' },
      ],
    },
    {
      group: 'Jam',
      items: [
        { id: '1h', label: '1h', desc: '1 Jam' },
        { id: '2h', label: '2h', desc: '2 Jam' },
        { id: '4h', label: '4h', desc: '4 Jam' },
        { id: '6h', label: '6h', desc: '6 Jam' },
        { id: '12h', label: '12h', desc: '12 Jam' },
      ],
    },
    {
      group: 'Hari & Pekan',
      items: [
        { id: '1D', label: '1D', desc: '1 Hari' },
        { id: '1W', label: '1W', desc: '1 Pekan' },
        { id: '1M', label: '1M', desc: '1 Bulan' },
      ],
    },
  ];

  let showTimeframeEditor = $state(false);
  let customTfNumber = $state<string | number>('');
  let customTfUnit = $state<'m' | 'h' | 'D'>('m');

  function toggleFavoriteTimeframe(tf: Timeframe) {
    if (favoriteTimeframes.includes(tf)) {
      if (favoriteTimeframes.length <= 1) return; // Sisakan minimal 1 favorit
      const updated = favoriteTimeframes.filter((t) => t !== tf);
      onFavoriteTimeframesChange?.(updated);
    } else {
      const updated = [...favoriteTimeframes, tf];
      onFavoriteTimeframesChange?.(updated);
    }
  }

  function handleAddCustomTimeframe(e?: Event) {
    e?.preventDefault();
    const num = parseInt(String(customTfNumber).trim(), 10);
    if (isNaN(num) || num <= 0) return;
    const newTf = `${num}${customTfUnit}`;

    if (!customTimeframes.includes(newTf)) {
      const updatedCustoms = [...customTimeframes, newTf];
      onCustomTimeframesChange?.(updatedCustoms);
    }
    if (!favoriteTimeframes.includes(newTf)) {
      const updatedFavs = [...favoriteTimeframes, newTf];
      onFavoriteTimeframesChange?.(updatedFavs);
    }
    customTfNumber = '';
    onTimeframeChange(newTf);
  }

  function handleRemoveCustomTimeframe(tf: string) {
    const updatedCustoms = customTimeframes.filter((t) => t !== tf);
    const updatedFavs = favoriteTimeframes.filter((t) => t !== tf);
    onCustomTimeframesChange?.(updatedCustoms);
    onFavoriteTimeframesChange?.(updatedFavs);
  }

  function handleResetDefaultTimeframes() {
    const def: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D'];
    onFavoriteTimeframesChange?.(def);
  }

  function handleGlobalClick(e: MouseEvent) {
    if (!showTimeframeEditor) return;
    const target = e.target as HTMLElement | null;
    if (target && !target.closest('.timeframe-section')) {
      showTimeframeEditor = false;
    }
  }

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && showTimeframeEditor) {
      showTimeframeEditor = false;
    }
  }
</script>

<svelte:window onclick={handleGlobalClick} onkeydown={handleGlobalKeyDown} />

<div class="timeframe-section">
  <div class="timeframe-bar">
    {#each favoriteTimeframes as tf}
      <button
        class="tf-btn mono-nums {activeTimeframe === tf ? 'active' : ''}"
        title="Ganti timeframe ke {tf}"
        onclick={() => onTimeframeChange(tf)}
      >
        {tf}
      </button>
    {/each}

    <!-- Smart Active Indicator jika timeframe aktif tidak ada di daftar favorit -->
    {#if !favoriteTimeframes.includes(activeTimeframe)}
      <button
        class="tf-btn mono-nums active temporary"
        title="Timeframe aktif saat ini ({activeTimeframe}) - Belum disematkan"
        onclick={() => onTimeframeChange(activeTimeframe)}
      >
        {activeTimeframe}
      </button>
    {/if}

    <!-- Tombol Plus / Kelola Timeframe -->
    <button
      class="tf-add-btn {showTimeframeEditor ? 'active' : ''}"
      title="Kelola Timeframe & Favorit Bilah Atas"
      onclick={(e) => {
        e.stopPropagation();
        showTimeframeEditor = !showTimeframeEditor;
      }}
    >
      <Plus size={11} />
    </button>
  </div>

  <!-- Popover Dropdown Kelola Timeframe & Favorit (Obsidian Precision) -->
  {#if showTimeframeEditor}
    <div class="tf-dropdown obsidian-panel" onclick={(e) => e.stopPropagation()}>
      <!-- Header Popover -->
      <div class="tf-popover-header">
        <div class="header-left">
          <Clock size={12} class="brand-accent-icon" />
          <span class="popover-title">Timeframe & Favorit</span>
        </div>
        <div class="header-right">
          <span class="tf-count-badge">{favoriteTimeframes.length} Favorit</span>
          <button
            class="icon-close-btn"
            title="Tutup (Esc)"
            onclick={() => (showTimeframeEditor = false)}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <!-- Daftar Kategori Timeframe Standar -->
      <div class="tf-scroll-list">
        {#each STANDARD_TIMEFRAME_GROUPS as group}
          <div class="tf-group-block">
            <span class="tf-group-label">{group.group.toUpperCase()}</span>
            <div class="tf-group-items">
              {#each group.items as item}
                {@const isStarred = favoriteTimeframes.includes(item.id)}
                {@const isCurrent = activeTimeframe === item.id}
                <div class="tf-row {isCurrent ? 'active-row' : ''}">
                  <button
                    class="tf-row-select"
                    title="Ganti ke {item.label} ({item.desc})"
                    onclick={() => {
                      onTimeframeChange(item.id);
                      showTimeframeEditor = false;
                    }}
                  >
                    <span class="tf-pill-id mono-nums {isCurrent ? 'current-tf' : ''}">
                      {item.label}
                    </span>
                    <span class="tf-row-desc">{item.desc}</span>
                  </button>
                  <button
                    class="tf-star-toggle {isStarred ? 'starred' : ''}"
                    title={isStarred ? 'Hapus dari bilah atas' : 'Sematkan ke bilah atas'}
                    onclick={() => toggleFavoriteTimeframe(item.id)}
                  >
                    <Star
                      size={11}
                      fill={isStarred ? '#f59e0b' : 'none'}
                      color={isStarred ? '#f59e0b' : 'currentColor'}
                    />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/each}

        <!-- Kategori Kustom Jika Ada -->
        {#if customTimeframes && customTimeframes.length > 0}
          <div class="tf-group-block">
            <span class="tf-group-label">KUSTOM PENGGUNA</span>
            <div class="tf-group-items">
              {#each customTimeframes as ctf}
                {@const isStarred = favoriteTimeframes.includes(ctf)}
                {@const isCurrent = activeTimeframe === ctf}
                <div class="tf-row {isCurrent ? 'active-row' : ''}">
                  <button
                    class="tf-row-select"
                    title="Ganti ke {ctf}"
                    onclick={() => {
                      onTimeframeChange(ctf);
                      showTimeframeEditor = false;
                    }}
                  >
                    <span class="tf-pill-id mono-nums {isCurrent ? 'current-tf' : ''}">
                      {ctf}
                    </span>
                    <span class="tf-row-desc">Interval Kustom</span>
                  </button>
                  <button
                    class="tf-star-toggle {isStarred ? 'starred' : ''}"
                    title={isStarred ? 'Hapus dari bilah atas' : 'Sematkan ke bilah atas'}
                    onclick={() => toggleFavoriteTimeframe(ctf)}
                  >
                    <Star
                      size={11}
                      fill={isStarred ? '#f59e0b' : 'none'}
                      color={isStarred ? '#f59e0b' : 'currentColor'}
                    />
                  </button>
                  <button
                    class="tf-del-btn"
                    title="Hapus timeframe kustom"
                    onclick={() => handleRemoveCustomTimeframe(ctf)}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Form Tambah Timeframe Kustom Baru -->
      <div class="tf-custom-builder">
        <span class="sub-label">Buat Timeframe Baru:</span>
        <form class="custom-builder-form" onsubmit={handleAddCustomTimeframe}>
          <input
            type="number"
            min="1"
            max="1000"
            placeholder="Nilai..."
            bind:value={customTfNumber}
            class="custom-num-input mono-nums"
          />
          <div class="unit-selector">
            <button
              type="button"
              class="unit-btn {customTfUnit === 'm' ? 'active' : ''}"
              onclick={() => (customTfUnit = 'm')}
            >
              Menit
            </button>
            <button
              type="button"
              class="unit-btn {customTfUnit === 'h' ? 'active' : ''}"
              onclick={() => (customTfUnit = 'h')}
            >
              Jam
            </button>
            <button
              type="button"
              class="unit-btn {customTfUnit === 'D' ? 'active' : ''}"
              onclick={() => (customTfUnit = 'D')}
            >
              Hari
            </button>
          </div>
          <button
            type="submit"
            class="custom-add-submit-btn"
            disabled={!customTfNumber || Number(customTfNumber) <= 0}
          >
            <Plus size={11} />
            <span>Tambah</span>
          </button>
        </form>
      </div>

      <!-- Footer Aksi Dropdown -->
      <div class="tf-popover-footer">
        <button
          type="button"
          class="utility-btn"
          title="Kembalikan favorit ke 1m, 5m, 15m, 1h, 4h, 1D"
          onclick={handleResetDefaultTimeframes}
        >
          <RotateCcw size={10} />
          <span>Reset Standar</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .timeframe-section {
    position: relative;
    display: flex;
    align-items: center;
  }

  .timeframe-bar {
    display: flex;
    align-items: center;
    gap: 3px;
    background-color: var(--bg-base);
    padding: 2px 4px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--border-hairline);
  }

  .tf-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 6px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .tf-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .tf-btn.active {
    color: var(--brand-primary);
    background-color: var(--bg-panel);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .tf-btn.temporary {
    border: 1px dashed var(--brand-primary);
    color: var(--brand-primary);
  }

  .tf-add-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px;
    border-radius: var(--radius-xs);
    transition: all 0.12s ease;
  }

  .tf-add-btn:hover,
  .tf-add-btn.active {
    color: var(--brand-primary);
    background-color: var(--bg-hover);
  }

  .tf-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 270px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    z-index: 250;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.12);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tf-popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-hairline);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .popover-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
  }

  .tf-count-badge {
    font-size: 9px;
    background-color: rgba(0, 240, 144, 0.1);
    color: var(--brand-primary);
    padding: 1px 5px;
    border-radius: 10px;
    font-weight: 600;
  }

  .icon-close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-xs);
    transition: all 0.1s ease;
  }

  .icon-close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .tf-scroll-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .tf-group-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tf-group-label {
    font-size: 9px;
    font-weight: 700;
    color: var(--text-dim);
    letter-spacing: 0.04em;
    padding-left: 2px;
  }

  .tf-group-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tf-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 6px;
    border-radius: var(--radius-xs);
    transition: background-color 0.1s ease;
  }

  .tf-row:hover {
    background-color: var(--bg-hover);
  }

  .tf-row.active-row {
    background-color: rgba(0, 240, 144, 0.06);
  }

  .tf-row-select {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    flex: 1;
    text-align: left;
    padding: 0;
  }

  .tf-pill-id {
    font-size: 11px;
    font-weight: 600;
    min-width: 28px;
    color: var(--text-main);
  }

  .tf-pill-id.current-tf {
    color: var(--brand-primary);
    font-weight: 700;
  }

  .tf-row-desc {
    font-size: 10px;
    color: var(--text-dim);
  }

  .tf-star-toggle {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    color: var(--text-dim);
    opacity: 0.35;
    transition: all 0.12s ease;
  }

  .tf-star-toggle:hover,
  .tf-star-toggle.starred {
    opacity: 1;
    color: #f59e0b;
  }

  .tf-del-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    color: var(--alert-color);
    opacity: 0.4;
    transition: opacity 0.12s ease;
    margin-left: 2px;
  }

  .tf-del-btn:hover {
    opacity: 1;
  }

  .tf-custom-builder {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-top: 8px;
    border-top: 1px solid var(--border-hairline);
  }

  .sub-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .custom-builder-form {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .custom-num-input {
    width: 60px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    padding: 4px 6px;
    border-radius: var(--radius-xs);
    outline: none;
  }

  .custom-num-input:focus {
    border-color: var(--border-focus);
  }

  .unit-selector {
    display: flex;
    background-color: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 1px;
    gap: 1px;
  }

  .unit-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 9.5px;
    font-weight: 600;
    padding: 3px 5px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .unit-btn.active {
    background-color: var(--bg-panel);
    color: var(--brand-primary);
  }

  .custom-add-submit-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 10px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    margin-left: auto;
    transition: all 0.12s ease;
  }

  .custom-add-submit-btn:hover:not(:disabled) {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    background-color: var(--bg-hover);
  }

  .custom-add-submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tf-popover-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 4px;
    border-top: 1px solid var(--border-hairline);
  }

  .utility-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-xs);
    transition: all 0.1s ease;
  }

  .utility-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }
</style>
