<script lang="ts">
  import {
    ChevronDown,
    Plus,
    X,
    Check,
    Pencil,
    Copy,
    Trash2,
    RotateCcw,
    MoreHorizontal,
    List,
    AlertTriangle
  } from '@lucide/svelte';
  import type { WatchlistRecord } from '../types/market';

  interface Props {
    activeWatchlist: WatchlistRecord;
    watchlists: WatchlistRecord[];
    onSelectWatchlist: (id: string) => void;
    onCreateWatchlist: (name: string) => Promise<void>;
    onRenameWatchlist: (id: string, newName: string) => Promise<void>;
    onDuplicateWatchlist: (id: string) => Promise<void>;
    onDeleteWatchlist: (id: string) => Promise<void>;
    onResetPreset: (id: string) => Promise<void>;
  }

  let {
    activeWatchlist,
    watchlists,
    onSelectWatchlist,
    onCreateWatchlist,
    onRenameWatchlist,
    onDuplicateWatchlist,
    onDeleteWatchlist,
    onResetPreset,
  }: Props = $props();

  let isOpen = $state(false);
  let activeMenuId = $state<string | null>(null);

  // Modal dialog states
  let showCreateModal = $state(false);
  let newWatchlistName = $state('');

  let showRenameModal = $state(false);
  let renameTargetId = $state<string | null>(null);
  let renameValue = $state('');

  let showDeleteConfirm = $state(false);
  let deleteTargetId = $state<string | null>(null);
  let deleteTargetName = $state('');

  const customWatchlists = $derived(watchlists.filter((w) => !w.isPreset));
  const presetWatchlists = $derived(watchlists.filter((w) => w.isPreset));

  function toggleDropdown() {
    isOpen = !isOpen;
    activeMenuId = null;
  }

  function closeDropdown() {
    isOpen = false;
    activeMenuId = null;
  }

  function handleSelect(id: string) {
    onSelectWatchlist(id);
    closeDropdown();
  }

  function openCreateModal() {
    newWatchlistName = '';
    showCreateModal = true;
    closeDropdown();
  }

  async function submitCreate() {
    const clean = newWatchlistName.trim();
    if (clean) {
      await onCreateWatchlist(clean);
    }
    showCreateModal = false;
    newWatchlistName = '';
  }

  function openRenameModal(w: WatchlistRecord, e: MouseEvent) {
    e.stopPropagation();
    renameTargetId = w.id;
    renameValue = w.name;
    showRenameModal = true;
    activeMenuId = null;
    closeDropdown();
  }

  async function submitRename() {
    if (renameTargetId && renameValue.trim()) {
      await onRenameWatchlist(renameTargetId, renameValue.trim());
    }
    showRenameModal = false;
    renameTargetId = null;
    renameValue = '';
  }

  async function handleDuplicate(id: string, e: MouseEvent) {
    e.stopPropagation();
    activeMenuId = null;
    await onDuplicateWatchlist(id);
    closeDropdown();
  }

  function openDeleteConfirm(w: WatchlistRecord, e: MouseEvent) {
    e.stopPropagation();
    deleteTargetId = w.id;
    deleteTargetName = w.name;
    showDeleteConfirm = true;
    activeMenuId = null;
    closeDropdown();
  }

  async function submitDelete() {
    if (deleteTargetId) {
      await onDeleteWatchlist(deleteTargetId);
    }
    showDeleteConfirm = false;
    deleteTargetId = null;
    deleteTargetName = '';
  }

  async function handleReset(id: string, e: MouseEvent) {
    e.stopPropagation();
    activeMenuId = null;
    await onResetPreset(id);
    closeDropdown();
  }

  function toggleItemMenu(id: string, e: MouseEvent) {
    e.stopPropagation();
    activeMenuId = activeMenuId === id ? null : id;
  }

  // Count helper: ignores #section: tokens
  function getTickerCount(items: string[]): number {
    return items.filter((item) => !item.startsWith('#section:')).length;
  }
</script>

<div class="watchlist-switcher-container">
  <!-- Trigger Button -->
  <button
    type="button"
    class="switcher-trigger-btn {isOpen ? 'open' : ''}"
    onclick={toggleDropdown}
    title="Pilih atau kelola daftar pantau"
  >
    <div class="trigger-left">
      <List size={13} class="list-icon" />
      <span class="watchlist-name">{activeWatchlist.name}</span>
      <span class="count-pill mono-nums">{getTickerCount(activeWatchlist.items)}</span>
    </div>
    <ChevronDown size={13} class="chevron-icon {isOpen ? 'rotated' : ''}" />
  </button>

  <!-- Dropdown Popover Backdrop & Menu -->
  {#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="popover-backdrop" onclick={closeDropdown}></div>

    <div class="switcher-popover obsidian-popover">
      <div class="popover-header">
        <span class="popover-title">Daftar Pantau</span>
        <button
          type="button"
          class="btn-new-watchlist"
          onclick={openCreateModal}
          title="Buat daftar pantau baru"
        >
          <Plus size={11} />
          <span>Baru</span>
        </button>
      </div>

      <div class="popover-scroll-area">
        <!-- Seksi 1: Daftar Kustom Pengguna -->
        {#if customWatchlists.length > 0}
          <div class="group-label">DAFTAR KUSTOM</div>
          {#each customWatchlists as w (w.id)}
            {@const isActive = w.id === activeWatchlist.id}
            {@const count = getTickerCount(w.items)}
            <div class="watchlist-menu-row {isActive ? 'active-row' : ''}">
              <button
                type="button"
                class="row-select-btn"
                onclick={() => handleSelect(w.id)}
              >
                <div class="row-info">
                  {#if isActive}
                    <Check size={12} class="active-check-icon" />
                  {:else}
                    <span class="check-spacer"></span>
                  {/if}
                  <span class="item-name" title={w.name}>{w.name}</span>
                </div>
                <span class="item-count mono-nums">{count}</span>
              </button>

              <div class="action-menu-wrapper">
                <button
                  type="button"
                  class="btn-row-action {activeMenuId === w.id ? 'active' : ''}"
                  onclick={(e) => toggleItemMenu(w.id, e)}
                  title="Menu aksi"
                >
                  <MoreHorizontal size={13} />
                </button>

                {#if activeMenuId === w.id}
                  <div class="sub-action-menu">
                    <button
                      type="button"
                      class="sub-action-item"
                      onclick={(e) => openRenameModal(w, e)}
                    >
                      <Pencil size={11} />
                      <span>Ganti Nama</span>
                    </button>
                    <button
                      type="button"
                      class="sub-action-item"
                      onclick={(e) => handleDuplicate(w.id, e)}
                    >
                      <Copy size={11} />
                      <span>Duplikasi</span>
                    </button>
                    {#if watchlists.length > 1}
                      <button
                        type="button"
                        class="sub-action-item danger"
                        onclick={(e) => openDeleteConfirm(w, e)}
                      >
                        <Trash2 size={11} />
                        <span>Hapus</span>
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}

        <!-- Seksi 2: Daftar Bawaan / Presets -->
        {#if presetWatchlists.length > 0}
          <div class="group-label">PRESET SISTEM</div>
          {#each presetWatchlists as w (w.id)}
            {@const isActive = w.id === activeWatchlist.id}
            {@const count = getTickerCount(w.items)}
            <div class="watchlist-menu-row {isActive ? 'active-row' : ''}">
              <button
                type="button"
                class="row-select-btn"
                onclick={() => handleSelect(w.id)}
              >
                <div class="row-info">
                  {#if isActive}
                    <Check size={12} class="active-check-icon" />
                  {:else}
                    <span class="check-spacer"></span>
                  {/if}
                  <span class="item-name" title={w.name}>{w.name}</span>
                  <span class="preset-pill">BAWAAN</span>
                </div>
                <span class="item-count mono-nums">{count}</span>
              </button>

              <div class="action-menu-wrapper">
                <button
                  type="button"
                  class="btn-row-action {activeMenuId === w.id ? 'active' : ''}"
                  onclick={(e) => toggleItemMenu(w.id, e)}
                  title="Menu aksi"
                >
                  <MoreHorizontal size={13} />
                </button>

                {#if activeMenuId === w.id}
                  <div class="sub-action-menu">
                    <button
                      type="button"
                      class="sub-action-item"
                      onclick={(e) => openRenameModal(w, e)}
                    >
                      <Pencil size={11} />
                      <span>Ganti Nama</span>
                    </button>
                    <button
                      type="button"
                      class="sub-action-item"
                      onclick={(e) => handleDuplicate(w.id, e)}
                    >
                      <Copy size={11} />
                      <span>Duplikasi</span>
                    </button>
                    <button
                      type="button"
                      class="sub-action-item"
                      onclick={(e) => handleReset(w.id, e)}
                    >
                      <RotateCcw size={11} />
                      <span>Reset ke Bawaan</span>
                    </button>
                    {#if watchlists.length > 1}
                      <button
                        type="button"
                        class="sub-action-item danger"
                        onclick={(e) => openDeleteConfirm(w, e)}
                      >
                        <Trash2 size={11} />
                        <span>Hapus</span>
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Modal 1: Buat Watchlist Baru -->
{#if showCreateModal}
  <div class="modal-backdrop">
    <div class="switcher-modal obsidian-modal">
      <div class="modal-header">
        <span>Buat Watchlist Baru</span>
        <button type="button" class="btn-close-modal" onclick={() => (showCreateModal = false)}>
          <X size={13} />
        </button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); submitCreate(); }}>
        <div class="modal-body">
          <label for="create-wl-name" class="modal-label">Nama Watchlist:</label>
          <input
            id="create-wl-name"
            type="text"
            placeholder="Contoh: Spot Investasi, Scalp 5m..."
            bind:value={newWatchlistName}
            class="modal-input"
          />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-modal-cancel" onclick={() => (showCreateModal = false)}>
            Batal
          </button>
          <button type="submit" class="btn-modal-submit" disabled={!newWatchlistName.trim()}>
            Buat
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal 2: Ganti Nama Watchlist -->
{#if showRenameModal}
  <div class="modal-backdrop">
    <div class="switcher-modal obsidian-modal">
      <div class="modal-header">
        <span>Ganti Nama Watchlist</span>
        <button type="button" class="btn-close-modal" onclick={() => (showRenameModal = false)}>
          <X size={13} />
        </button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); submitRename(); }}>
        <div class="modal-body">
          <label for="rename-wl-name" class="modal-label">Nama Baru:</label>
          <input
            id="rename-wl-name"
            type="text"
            bind:value={renameValue}
            class="modal-input"
          />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-modal-cancel" onclick={() => (showRenameModal = false)}>
            Batal
          </button>
          <button type="submit" class="btn-modal-submit" disabled={!renameValue.trim()}>
            Simpan
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal 3: Konfirmasi Hapus Watchlist -->
{#if showDeleteConfirm}
  <div class="modal-backdrop">
    <div class="switcher-modal obsidian-modal confirm-delete-modal">
      <div class="modal-header">
        <div class="modal-header-danger">
          <AlertTriangle size={15} class="warning-icon" />
          <span>Hapus Daftar Pantau?</span>
        </div>
        <button type="button" class="btn-close-modal" onclick={() => (showDeleteConfirm = false)}>
          <X size={13} />
        </button>
      </div>
      <div class="modal-body">
        <p class="confirm-text">
          Apakah kamu yakin ingin menghapus <b>"{deleteTargetName}"</b>? Seluruh instrumen di dalamnya akan dihapus.
        </p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-modal-cancel" onclick={() => (showDeleteConfirm = false)}>
          Batal
        </button>
        <button type="button" class="btn-modal-danger" onclick={submitDelete}>
          Ya, Hapus
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .watchlist-switcher-container {
    position: relative;
    width: 100%;
    padding: 4px 10px;
    background: #111111;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    box-sizing: border-box;
  }

  .switcher-trigger-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: #e5e5e5;
    font-size: 11.5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .switcher-trigger-btn:hover,
  .switcher-trigger-btn.open {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .trigger-left {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  :global(.list-icon) {
    color: #ff69b4;
    flex-shrink: 0;
  }

  .watchlist-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .count-pill {
    padding: 1px 5px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    font-size: 10px;
    color: #888888;
  }

  :global(.chevron-icon) {
    color: #888888;
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  :global(.chevron-icon.rotated) {
    transform: rotate(180deg);
  }

  /* Popover */
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
  }

  .switcher-popover {
    position: absolute;
    top: calc(100% + 4px);
    left: 10px;
    right: 10px;
    background: #141414;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
    z-index: 999;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 380px;
  }

  .popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #181818;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .popover-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #a3a3a3;
  }

  .btn-new-watchlist {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(255, 105, 180, 0.12);
    border: 1px solid rgba(255, 105, 180, 0.3);
    border-radius: 4px;
    color: #ff69b4;
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-new-watchlist:hover {
    background: rgba(255, 105, 180, 0.22);
    border-color: #ff69b4;
  }

  .popover-scroll-area {
    padding: 6px 0;
    overflow-y: auto;
  }

  .group-label {
    padding: 6px 12px 3px 12px;
    font-size: 9.5px;
    font-weight: 700;
    color: #666666;
    letter-spacing: 0.6px;
  }

  .watchlist-menu-row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px 0 12px;
    height: 32px;
    transition: background 0.12s ease;
  }

  .watchlist-menu-row:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .watchlist-menu-row.active-row {
    background: rgba(255, 105, 180, 0.08);
  }

  .row-select-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
    height: 100%;
    background: transparent;
    border: none;
    color: #d4d4d4;
    font-size: 11.5px;
    text-align: left;
    cursor: pointer;
    padding: 0;
    min-width: 0;
  }

  .row-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  :global(.active-check-icon) {
    color: #ff69b4;
    flex-shrink: 0;
  }

  .check-spacer {
    width: 12px;
    flex-shrink: 0;
  }

  .item-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }

  .watchlist-menu-row.active-row .item-name {
    color: #ffffff;
    font-weight: 600;
  }

  .preset-pill {
    padding: 1px 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    font-size: 8.5px;
    color: #777777;
    letter-spacing: 0.3px;
  }

  .item-count {
    font-size: 10.5px;
    color: #666666;
    margin-right: 6px;
  }

  .action-menu-wrapper {
    position: relative;
  }

  .btn-row-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #777777;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .btn-row-action:hover,
  .btn-row-action.active {
    background: rgba(255, 255, 255, 0.1);
    color: #e5e5e5;
  }

  .sub-action-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: #1c1c1c;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 6px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
    z-index: 1000;
    min-width: 140px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sub-action-item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #cccccc;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .sub-action-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .sub-action-item.danger {
    color: #f87171;
  }

  .sub-action-item.danger:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
    z-index: 1050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .switcher-modal {
    background: #181818;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    width: 100%;
    max-width: 340px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.8);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #202020;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 12px;
    font-weight: 600;
    color: #e5e5e5;
  }

  .modal-header-danger {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #f87171;
  }

  :global(.warning-icon) {
    color: #f87171;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #777777;
    cursor: pointer;
    padding: 2px;
  }

  .btn-close-modal:hover {
    color: #ffffff;
  }

  .modal-body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .modal-label {
    font-size: 11px;
    color: #a3a3a3;
  }

  .modal-input {
    width: 100%;
    padding: 7px 10px;
    background: #101010;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 5px;
    color: #ffffff;
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
  }

  .modal-input:focus {
    border-color: #ff69b4;
  }

  .confirm-text {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #cccccc;
  }

  .confirm-text b {
    color: #ffffff;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 14px;
    background: #1a1a1a;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .btn-modal-cancel {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    color: #aaaaaa;
    font-size: 11.5px;
    cursor: pointer;
  }

  .btn-modal-cancel:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
  }

  .btn-modal-submit {
    padding: 6px 14px;
    background: #ff69b4;
    border: none;
    border-radius: 5px;
    color: #ffffff;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-modal-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-modal-danger {
    padding: 6px 14px;
    background: #dc2626;
    border: none;
    border-radius: 5px;
    color: #ffffff;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-modal-danger:hover {
    background: #ef4444;
  }
</style>
