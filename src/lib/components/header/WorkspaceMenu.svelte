<script lang="ts">
  import { FolderOpen, Layers, Save, X, RefreshCw, Check, Plus } from '@lucide/svelte';
  import type { SavedWorkspace } from '../../types/market';
  import { loadWorkspaces, deleteWorkspace } from '../../services/persistence';

  interface Props {
    activeWorkspace?: SavedWorkspace | null;
    isAutoSaveWorkspace?: boolean;
    onToggleAutoSaveWorkspace?: () => void;
    onSaveWorkspace?: (name: string, overwriteId?: string) => void;
    onLoadWorkspace?: (w: SavedWorkspace) => void;
    onNewWorkspace?: () => void;
  }

  let {
    activeWorkspace = null,
    isAutoSaveWorkspace = true,
    onToggleAutoSaveWorkspace,
    onSaveWorkspace,
    onLoadWorkspace,
    onNewWorkspace,
  }: Props = $props();

  let showWorkspaceMenu = $state(false);
  let savedWorkspaces = $state<SavedWorkspace[]>([]);
  let workspaceNameInput = $state('');
  let overwriteFeedback = $state(false);
  let itemOverwriteFeedbackId = $state<string | null>(null);

  let duplicateTarget = $derived.by(() => {
    const trimmed = workspaceNameInput.trim().toLowerCase();
    if (!trimmed) return null;
    return savedWorkspaces.find((w) => w.name.trim().toLowerCase() === trimmed) || null;
  });

  async function loadWorkspacesList() {
    savedWorkspaces = await loadWorkspaces();
  }

  function handleSaveWorkspace() {
    const name = workspaceNameInput.trim();
    if (name && onSaveWorkspace) {
      onSaveWorkspace(name);
      workspaceNameInput = '';
      setTimeout(loadWorkspacesList, 120);
    }
  }

  function handleNewWorkspaceClick() {
    if (onNewWorkspace) {
      onNewWorkspace();
    }
    workspaceNameInput = '';
  }

  function handleOverwriteActive() {
    if (!activeWorkspace || !onSaveWorkspace) return;
    onSaveWorkspace(activeWorkspace.name, activeWorkspace.id);
    overwriteFeedback = true;
    setTimeout(() => {
      overwriteFeedback = false;
      loadWorkspacesList();
    }, 1500);
  }

  function handleOverwriteItem(w: SavedWorkspace) {
    if (!onSaveWorkspace) return;
    onSaveWorkspace(w.name, w.id);
    itemOverwriteFeedbackId = w.id;
    setTimeout(() => {
      itemOverwriteFeedbackId = null;
      loadWorkspacesList();
    }, 1500);
  }

  function handleConfirmOverwriteDuplicate(target: SavedWorkspace) {
    if (!onSaveWorkspace) return;
    onSaveWorkspace(target.name, target.id);
    workspaceNameInput = '';
    setTimeout(loadWorkspacesList, 120);
  }

  function handleLoadWorkspace(w: SavedWorkspace) {
    if (onLoadWorkspace) {
      onLoadWorkspace(w);
    }
    showWorkspaceMenu = false;
  }

  async function handleDeleteWorkspace(id: string) {
    await deleteWorkspace(id);
    await loadWorkspacesList();
  }
</script>

<div class="workspace-btn-group">
  <button
    class="workspace-toggle-btn {activeWorkspace ? 'has-active' : ''}"
    title="Kelola & Simpan Tata Letak Workspace (Klik untuk membuka menu)"
    onclick={() => {
      showWorkspaceMenu = !showWorkspaceMenu;
      if (showWorkspaceMenu) loadWorkspacesList();
    }}
  >
    <FolderOpen size={12} />
    <span class="workspace-active-badge">
      {activeWorkspace ? activeWorkspace.name : 'Workspaces'}
    </span>
    {#if isAutoSaveWorkspace && activeWorkspace}
      <span class="autosave-dot" title="Auto-Save aktif untuk {activeWorkspace.name}"></span>
    {/if}
  </button>

  {#if showWorkspaceMenu}
    <div class="workspace-dropdown obsidian-panel">
      <!-- Header Menu & Auto-Save Toggle -->
      <div class="workspace-menu-header">
        <span class="menu-title">Tata Letak Workspace</span>
        <div class="header-action-btns">
          <button
            type="button"
            class="new-workspace-btn"
            title="Mulai lembar kerja baru (Lepas kaitan workspace aktif agar perubahan tidak menimpa workspace lama)"
            onclick={handleNewWorkspaceClick}
          >
            <Plus size={11} />
            <span>Baru</span>
          </button>
          <button
            type="button"
            class="autosave-toggle-btn {isAutoSaveWorkspace ? 'active' : ''}"
            title="Nyalakan/matikan penyimpanan otomatis ke workspace aktif saat mengubah indikator/tata letak"
            onclick={() => onToggleAutoSaveWorkspace?.()}
          >
            <span class="autosave-indicator {isAutoSaveWorkspace ? 'on' : 'off'}"></span>
            <span>Auto-Save</span>
          </button>
        </div>
      </div>

      <!-- Quick Overwrite Card untuk Workspace Aktif -->
      {#if activeWorkspace}
        <div class="active-workspace-card">
          <div class="active-workspace-top">
            <div class="active-workspace-meta">
              <span class="active-tag">AKTIF</span>
              <span class="active-name" title={activeWorkspace.name}>{activeWorkspace.name}</span>
            </div>
            <button
              type="button"
              class="unlink-btn"
              onclick={handleNewWorkspaceClick}
              title="Lepas dari workspace ini agar perubahan tidak menimpanya"
            >
              <Plus size={10} />
              <span>Lepas Tautan</span>
            </button>
          </div>
          <button
            class="quick-overwrite-btn {overwriteFeedback ? 'saved' : ''}"
            onclick={handleOverwriteActive}
            title="Perbarui & Timpa perubahan ke workspace aktif ini"
          >
            {#if overwriteFeedback}
              <Check size={11} />
              <span>Tersimpan!</span>
            {:else}
              <Save size={11} />
              <span>Simpan Perubahan</span>
            {/if}
          </button>
        </div>
      {:else}
        <div class="unlinked-workspace-banner">
          <span class="unlinked-tag">LEMBAR KERJA BARU</span>
          <span class="unlinked-hint">Perubahan saat ini belum terkait dengan workspace mana pun. Simpan di bawah untuk membuat baru.</span>
        </div>
      {/if}

      <!-- Form Simpan Workspace Baru -->
      <div class="workspace-save-form">
        <input
          type="text"
          placeholder="Simpan sebagai workspace baru..."
          bind:value={workspaceNameInput}
          class="workspace-input"
          onkeydown={(e) => {
            if (e.key === 'Enter') handleSaveWorkspace();
          }}
        />
        <button
          onclick={handleSaveWorkspace}
          class="workspace-save-submit"
          title="Simpan sebagai Workspace Baru"
        >
          <Save size={12} />
        </button>
      </div>

      {#if duplicateTarget}
        <div class="duplicate-warning">
          <span class="duplicate-text">"{duplicateTarget.name}" sudah ada.</span>
          <button
            class="duplicate-overwrite-btn"
            onclick={() => handleConfirmOverwriteDuplicate(duplicateTarget)}
            title="Timpa data workspace ini"
          >
            Timpa (Overwrite)
          </button>
        </div>
      {/if}

      <div class="divider-line"></div>

      <!-- Daftar Workspace Tersimpan -->
      <div class="workspace-list-header">Daftar Tersimpan</div>
      <div class="workspace-list">
        {#if savedWorkspaces.length === 0}
          <div class="workspace-empty">Belum ada workspace tersimpan</div>
        {/if}
        {#each savedWorkspaces as w (w.id)}
          <div class="workspace-item {activeWorkspace?.id === w.id ? 'is-active' : ''}">
            <button class="workspace-load-btn" onclick={() => handleLoadWorkspace(w)}>
              <Layers size={12} class="workspace-icon {activeWorkspace?.id === w.id ? 'active-icon' : ''}" />
              <span class="workspace-name">{w.name}</span>
              {#if activeWorkspace?.id === w.id}
                <span class="active-pill">Aktif</span>
              {/if}
            </button>

            <div class="workspace-actions">
              <button
                class="workspace-action-btn overwrite {itemOverwriteFeedbackId === w.id ? 'saved' : ''}"
                title="Timpa {w.name} dengan tata letak saat ini"
                onclick={() => handleOverwriteItem(w)}
              >
                {#if itemOverwriteFeedbackId === w.id}
                  <Check size={11} />
                {:else}
                  <RefreshCw size={11} />
                {/if}
              </button>

              <button
                class="workspace-action-btn delete"
                title="Hapus {w.name}"
                onclick={() => handleDeleteWorkspace(w.id)}
              >
                <X size={11} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .workspace-btn-group {
    position: relative;
    display: flex;
  }

  .workspace-toggle-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 7px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .workspace-toggle-btn:hover,
  .workspace-toggle-btn.has-active {
    color: var(--brand-cyan);
    background-color: rgba(56, 189, 248, 0.08);
    border-color: rgba(56, 189, 248, 0.4);
  }

  .workspace-active-badge {
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .autosave-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #10b981;
    box-shadow: 0 0 5px rgba(16, 185, 129, 0.6);
  }

  .workspace-dropdown {
    position: absolute;
    top: 100%;
    margin-top: 4px;
    left: 0;
    width: 270px;
    z-index: 60;
    display: flex;
    flex-direction: column;
    padding: 9px;
    gap: 8px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  }

  .workspace-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 4px;
  }

  .menu-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
  }

  .header-action-btns {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .new-workspace-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 500;
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: var(--radius-xs);
    color: var(--brand-cyan);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .new-workspace-btn:hover {
    background: rgba(56, 189, 248, 0.18);
    border-color: var(--brand-cyan);
  }

  .autosave-toggle-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    font-size: 10px;
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .autosave-toggle-btn.active {
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.08);
  }

  .autosave-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--text-dim);
  }

  .autosave-indicator.on {
    background-color: #10b981;
    box-shadow: 0 0 4px #10b981;
  }

  .active-workspace-card {
    display: flex;
    flex-direction: column;
    padding: 6px 8px;
    background: rgba(56, 189, 248, 0.06);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: var(--radius-xs);
    gap: 6px;
  }

  .active-workspace-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .unlink-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    background: transparent;
    border: 1px dashed var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 9px;
    padding: 1px 5px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .unlink-btn:hover {
    color: var(--text-main);
    border-color: var(--text-dim);
    background: rgba(255, 255, 255, 0.04);
  }

  .unlinked-workspace-banner {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed var(--border-hairline);
    border-radius: var(--radius-xs);
  }

  .unlinked-tag {
    font-size: 8px;
    font-weight: 700;
    color: var(--brand-cyan);
    letter-spacing: 0.5px;
  }

  .unlinked-hint {
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1.3;
  }

  .active-workspace-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    overflow: hidden;
  }

  .active-tag {
    font-size: 8px;
    font-weight: 700;
    background: var(--brand-cyan);
    color: #000;
    padding: 1px 3px;
    border-radius: 2px;
    letter-spacing: 0.5px;
  }

  .active-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 105px;
  }

  .quick-overwrite-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    font-size: 10px;
    font-weight: 500;
    background: var(--brand-cyan);
    color: #000;
    border: none;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .quick-overwrite-btn:hover {
    filter: brightness(1.1);
  }

  .quick-overwrite-btn.saved {
    background: #10b981;
    color: #fff;
  }

  .workspace-save-form {
    display: flex;
    gap: 4px;
  }

  .workspace-input {
    flex: 1;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    padding: 4px 6px;
    border-radius: var(--radius-xs);
    outline: none;
  }

  .workspace-input:focus {
    border-color: var(--brand-cyan);
  }

  .workspace-save-submit {
    background-color: rgba(56, 189, 248, 0.1);
    color: var(--brand-cyan);
    border: 1px solid var(--brand-cyan);
    border-radius: var(--radius-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    transition: all 0.12s ease;
  }

  .workspace-save-submit:hover {
    background-color: rgba(56, 189, 248, 0.2);
  }

  .duplicate-warning {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: var(--radius-xs);
    font-size: 10px;
  }

  .duplicate-text {
    color: #f59e0b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  .duplicate-overwrite-btn {
    background: #f59e0b;
    color: #000;
    border: none;
    font-size: 9px;
    font-weight: 600;
    padding: 2px 5px;
    border-radius: 2px;
    cursor: pointer;
  }

  .divider-line {
    height: 1px;
    background-color: var(--border-hairline);
    margin: 2px 0;
  }

  .workspace-list-header {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-dim);
  }

  .workspace-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 180px;
    overflow-y: auto;
  }

  .workspace-empty {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    padding: 10px 0;
  }

  .workspace-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    border-radius: var(--radius-xs);
    transition: background 0.1s ease;
  }

  .workspace-item:hover {
    background-color: var(--bg-hover);
  }

  .workspace-item.is-active {
    background-color: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.2);
  }

  .workspace-load-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    flex: 1;
    text-align: left;
    overflow: hidden;
  }

  .workspace-load-btn:hover {
    color: var(--text-main);
  }

  :global(.workspace-icon.active-icon) {
    color: var(--brand-cyan);
  }

  .workspace-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .active-pill {
    font-size: 9px;
    background: rgba(56, 189, 248, 0.15);
    color: var(--brand-cyan);
    padding: 1px 4px;
    border-radius: 2px;
    margin-left: 4px;
  }

  .workspace-actions {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .workspace-action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    opacity: 0.6;
    transition: all 0.12s ease;
  }

  .workspace-action-btn:hover {
    opacity: 1;
  }

  .workspace-action-btn.overwrite {
    color: var(--brand-cyan);
  }

  .workspace-action-btn.overwrite:hover {
    background-color: rgba(56, 189, 248, 0.15);
  }

  .workspace-action-btn.overwrite.saved {
    color: #10b981;
  }

  .workspace-action-btn.delete {
    color: var(--alert-color);
  }

  .workspace-action-btn.delete:hover {
    background-color: rgba(255, 59, 105, 0.15);
  }
</style>
