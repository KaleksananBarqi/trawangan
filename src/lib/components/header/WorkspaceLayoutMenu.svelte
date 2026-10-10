<script lang="ts">
  import {
    LayoutGrid,
    FolderOpen,
    Layers,
    Save,
    X,
    RefreshCw,
    Check,
    Plus,
    ChevronDown,
    Square,
    Columns2,
    Rows2,
    Grid2X2
  } from '@lucide/svelte';
  import type { SavedWorkspace } from '../../types/market';
  import { loadWorkspaces, deleteWorkspace } from '../../services/persistence';

  interface Props {
    currentLayout: string;
    onLayoutChange: (layout: string) => void;
    activeWorkspace?: SavedWorkspace | null;
    isAutoSaveWorkspace?: boolean;
    onToggleAutoSaveWorkspace?: () => void;
    onSaveWorkspace?: (name: string, overwriteId?: string) => void;
    onLoadWorkspace?: (w: SavedWorkspace) => void;
    onNewWorkspace?: () => void;
  }

  let {
    currentLayout = '1',
    onLayoutChange,
    activeWorkspace = null,
    isAutoSaveWorkspace = true,
    onToggleAutoSaveWorkspace,
    onSaveWorkspace,
    onLoadWorkspace,
    onNewWorkspace,
  }: Props = $props();

  let showMenu = $state(false);
  let savedWorkspaces = $state<SavedWorkspace[]>([]);
  let workspaceNameInput = $state('');
  let overwriteFeedback = $state(false);
  let itemOverwriteFeedbackId = $state<string | null>(null);

  const layouts = [
    { id: '1', label: '1 Chart', desc: 'Single viewport', icon: Square },
    { id: '2h', label: '2 Horisontal', desc: 'Atas & Bawah', icon: Rows2 },
    { id: '2v', label: '2 Vertikal', desc: 'Kiri & Kanan', icon: Columns2 },
    { id: '4', label: '4 Grid', desc: 'Quad viewport', icon: Grid2X2 },
  ];

  let currentLayoutLabel = $derived.by(() => {
    const found = layouts.find((l) => l.id === currentLayout);
    return found ? found.label : '1 Chart';
  });

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
    showMenu = false;
  }

  async function handleDeleteWorkspace(id: string) {
    await deleteWorkspace(id);
    await loadWorkspacesList();
  }

  function handleLayoutSelect(id: string) {
    onLayoutChange(id);
  }

  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (showMenu && !target.closest('.workspace-layout-group')) {
      showMenu = false;
    }
  }
</script>

<svelte:window onclick={handleGlobalClick} />

<div class="workspace-layout-group">
  <button
    class="menu-trigger-btn {activeWorkspace ? 'has-active' : ''}"
    title="Pilih Layout Grid & Kelola Workspace"
    onclick={() => {
      showMenu = !showMenu;
      if (showMenu) loadWorkspacesList();
    }}
  >
    <LayoutGrid size={13} class="trigger-icon" />
    <span class="trigger-label">
      {#if activeWorkspace}
        {activeWorkspace.name} <small class="layout-badge">({currentLayoutLabel})</small>
      {:else}
        {currentLayoutLabel}
      {/if}
    </span>
    {#if isAutoSaveWorkspace && activeWorkspace}
      <span class="autosave-dot" title="Auto-Save aktif untuk {activeWorkspace.name}"></span>
    {/if}
    <ChevronDown size={11} class="dropdown-chevron {showMenu ? 'open' : ''}" />
  </button>

  {#if showMenu}
    <div class="menu-dropdown obsidian-panel">
      <!-- ─── SEKSI 1: PILIHAN LAYOUT GRID ─── -->
      <div class="section-container">
        <div class="section-title">
          <LayoutGrid size={11} />
          <span>TATA LETAK MULTI-CHART</span>
        </div>
        <div class="grid-options">
          {#each layouts as l}
            {@const IconComponent = l.icon}
            <button
              class="grid-option-card {currentLayout === l.id ? 'active' : ''}"
              title="Pilih tata letak {l.label} ({l.desc})"
              onclick={() => handleLayoutSelect(l.id)}
            >
              <div class="grid-icon-wrap">
                <IconComponent size={14} />
              </div>
              <div class="grid-info">
                <span class="grid-name">{l.label}</span>
                <span class="grid-desc">{l.desc}</span>
              </div>
              {#if currentLayout === l.id}
                <div class="active-indicator-pip"></div>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <div class="divider-line"></div>

      <!-- ─── SEKSI 2: PENGELOLAAN WORKSPACE ─── -->
      <div class="section-container">
        <div class="section-header-flex">
          <div class="section-title">
            <FolderOpen size={11} />
            <span>WORKSPACE TERORGANISIR</span>
          </div>
          <div class="header-action-btns">
            <button
              type="button"
              class="new-workspace-btn"
              title="Mulai lembar kerja baru tanpa keterikatan workspace lama"
              onclick={handleNewWorkspaceClick}
            >
              <Plus size={10} />
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

        <!-- Kartu Workspace Aktif Saat Ini -->
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
                title="Lepas kaitan dari workspace ini agar perubahan tidak menimpanya"
              >
                <Plus size={10} />
                <span>Lepas Tautan</span>
              </button>
            </div>
            <button
              class="quick-overwrite-btn {overwriteFeedback ? 'saved' : ''}"
              onclick={handleOverwriteActive}
              title="Simpan & Timpa perubahan sekarang ke workspace aktif ini"
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
            <span class="unlinked-hint">Perubahan saat ini belum terkait workspace tersimpan.</span>
          </div>
        {/if}

        <!-- Form Simpan Workspace Baru -->
        <div class="workspace-save-form">
          <input
            type="text"
            placeholder="Simpan nama workspace baru..."
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
            <Save size={11} />
            <span>Simpan</span>
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
              Timpa
            </button>
          </div>
        {/if}

        <!-- Daftar Workspace Tersimpan -->
        <div class="workspace-list-header">Daftar Tersimpan</div>
        <div class="workspace-list">
          {#if savedWorkspaces.length === 0}
            <div class="workspace-empty">Belum ada workspace tersimpan</div>
          {/if}
          {#each savedWorkspaces as w (w.id)}
            <div class="workspace-item {activeWorkspace?.id === w.id ? 'is-active' : ''}">
              <button class="workspace-load-btn" onclick={() => handleLoadWorkspace(w)}>
                <Layers size={11} class="workspace-icon {activeWorkspace?.id === w.id ? 'active-icon' : ''}" />
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
                    <Check size={10} />
                  {:else}
                    <RefreshCw size={10} />
                  {/if}
                </button>

                <button
                  class="workspace-action-btn delete"
                  title="Hapus {w.name}"
                  onclick={() => handleDeleteWorkspace(w.id)}
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .workspace-layout-group {
    position: relative;
    display: flex;
    align-items: center;
  }

  .menu-trigger-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    height: 26px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .menu-trigger-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .menu-trigger-btn.has-active {
    color: var(--brand-primary);
    border-color: rgba(0, 240, 144, 0.3);
    background-color: rgba(0, 240, 144, 0.04);
  }

  .trigger-icon {
    color: var(--brand-primary);
    flex-shrink: 0;
  }

  .trigger-label {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layout-badge {
    font-size: 10px;
    color: var(--text-dim);
    font-weight: 400;
  }

  .autosave-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--brand-primary);
    box-shadow: 0 0 6px var(--brand-primary);
    flex-shrink: 0;
  }

  .dropdown-chevron {
    transition: transform 0.15s ease;
    color: var(--text-dim);
  }

  .dropdown-chevron.open {
    transform: rotate(180deg);
  }

  .menu-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 310px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    z-index: 250;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-header-flex {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-dim);
    text-transform: uppercase;
  }

  .grid-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }

  .grid-option-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    cursor: pointer;
    text-align: left;
    transition: all 0.12s ease;
  }

  .grid-option-card:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .grid-option-card.active {
    background-color: rgba(0, 240, 144, 0.08);
    border-color: var(--brand-primary);
  }

  .grid-icon-wrap {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .grid-option-card.active .grid-icon-wrap {
    color: var(--brand-primary);
  }

  .grid-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .grid-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    line-height: 1.2;
  }

  .grid-desc {
    font-size: 9px;
    color: var(--text-dim);
    line-height: 1.1;
  }

  .active-indicator-pip {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--brand-primary);
  }

  .divider-line {
    height: 1px;
    background-color: var(--border-hairline);
    margin: 2px 0;
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
    padding: 2px 5px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    font-size: 9px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .new-workspace-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .autosave-toggle-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    font-size: 9px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .autosave-toggle-btn.active {
    border-color: rgba(0, 240, 144, 0.4);
    color: var(--brand-primary);
  }

  .autosave-indicator {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .autosave-indicator.on {
    background-color: var(--brand-primary);
    box-shadow: 0 0 5px var(--brand-primary);
  }

  .autosave-indicator.off {
    background-color: var(--text-dim);
  }

  .active-workspace-card {
    background-color: rgba(0, 240, 144, 0.05);
    border: 1px solid rgba(0, 240, 144, 0.25);
    border-radius: var(--radius-xs);
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .active-workspace-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .active-workspace-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .active-tag {
    font-size: 8.5px;
    font-weight: 700;
    padding: 1px 4px;
    background-color: var(--brand-primary);
    color: #000;
    border-radius: 2px;
  }

  .active-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .unlink-btn {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 9px;
    color: var(--text-dim);
    background: none;
    border: none;
    cursor: pointer;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .unlink-btn:hover {
    color: var(--text-main);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .quick-overwrite-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px;
    background-color: rgba(0, 240, 144, 0.12);
    border: 1px solid rgba(0, 240, 144, 0.35);
    color: var(--brand-primary);
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .quick-overwrite-btn:hover {
    background-color: rgba(0, 240, 144, 0.2);
  }

  .quick-overwrite-btn.saved {
    background-color: var(--brand-primary);
    color: #000;
  }

  .unlinked-workspace-banner {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 5px 7px;
    background-color: var(--bg-base);
    border: 1px dashed var(--border-hairline);
    border-radius: var(--radius-xs);
  }

  .unlinked-tag {
    font-size: 8.5px;
    font-weight: 700;
    color: var(--text-dim);
  }

  .unlinked-hint {
    font-size: 9px;
    color: var(--text-muted);
  }

  .workspace-save-form {
    display: flex;
    gap: 4px;
  }

  .workspace-input {
    flex: 1;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 4px 6px;
    font-size: 10.5px;
    color: var(--text-main);
    outline: none;
  }

  .workspace-input:focus {
    border-color: var(--brand-primary);
  }

  .workspace-save-submit {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
  }

  .workspace-save-submit:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .duplicate-warning {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 6px;
    background-color: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius-xs);
  }

  .duplicate-text {
    font-size: 9.5px;
    color: #ef4444;
  }

  .duplicate-overwrite-btn {
    padding: 2px 5px;
    background-color: #ef4444;
    color: #fff;
    border: none;
    border-radius: 2px;
    font-size: 9px;
    font-weight: 600;
    cursor: pointer;
  }

  .workspace-list-header {
    font-size: 9px;
    font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 2px;
  }

  .workspace-list {
    max-height: 120px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .workspace-empty {
    font-size: 9.5px;
    color: var(--text-dim);
    text-align: center;
    padding: 8px 0;
  }

  .workspace-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px;
    border-radius: var(--radius-xs);
    background-color: var(--bg-base);
    border: 1px solid transparent;
  }

  .workspace-item:hover {
    background-color: var(--bg-hover);
  }

  .workspace-item.is-active {
    border-color: rgba(0, 240, 144, 0.25);
    background-color: rgba(0, 240, 144, 0.04);
  }

  .workspace-load-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 10.5px;
    cursor: pointer;
    flex: 1;
    text-align: left;
    min-width: 0;
  }

  .workspace-load-btn:hover {
    color: var(--text-main);
  }

  .workspace-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .active-pill {
    font-size: 8px;
    background-color: rgba(0, 240, 144, 0.15);
    color: var(--brand-primary);
    padding: 1px 3px;
    border-radius: 2px;
  }

  .workspace-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .workspace-action-btn {
    background: none;
    border: none;
    padding: 2px 3px;
    border-radius: 2px;
    color: var(--text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .workspace-action-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .workspace-action-btn.delete:hover {
    color: #ef4444;
  }

  .workspace-action-btn.overwrite.saved {
    color: var(--brand-primary);
  }
</style>
