<script lang="ts">
  import { FolderOpen, Layers, Save, X } from '@lucide/svelte';
  import type { SavedWorkspace } from '../../types/market';
  import { loadWorkspaces, deleteWorkspace } from '../../services/persistence';

  interface Props {
    onSaveWorkspace?: (name: string) => void;
    onLoadWorkspace?: (w: SavedWorkspace) => void;
  }

  let { onSaveWorkspace, onLoadWorkspace }: Props = $props();

  let showWorkspaceMenu = $state(false);
  let savedWorkspaces = $state<SavedWorkspace[]>([]);
  let workspaceNameInput = $state('');

  async function loadWorkspacesList() {
    savedWorkspaces = await loadWorkspaces();
  }

  function handleSaveWorkspace() {
    if (workspaceNameInput.trim() && onSaveWorkspace) {
      onSaveWorkspace(workspaceNameInput.trim());
      workspaceNameInput = '';
      setTimeout(loadWorkspacesList, 100);
    }
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
    class="workspace-toggle-btn"
    title="Kelola & Simpan Tata Letak Workspace"
    onclick={() => {
      showWorkspaceMenu = !showWorkspaceMenu;
      if (showWorkspaceMenu) loadWorkspacesList();
    }}
  >
    <FolderOpen size={12} />
    <span>Workspaces</span>
  </button>

  {#if showWorkspaceMenu}
    <div class="workspace-dropdown obsidian-panel">
      <div class="workspace-save-form">
        <input
          type="text"
          placeholder="Simpan tata letak saat ini..."
          bind:value={workspaceNameInput}
          class="workspace-input"
          onkeydown={(e) => {
            if (e.key === 'Enter') handleSaveWorkspace();
          }}
        />
        <button
          onclick={handleSaveWorkspace}
          class="workspace-save-submit"
          title="Simpan Workspace"
        >
          <Save size={12} />
        </button>
      </div>

      <div class="workspace-list">
        {#if savedWorkspaces.length === 0}
          <div class="workspace-empty">Belum ada workspace tersimpan</div>
        {/if}
        {#each savedWorkspaces as w}
          <div class="workspace-item">
            <button class="workspace-load-btn" onclick={() => handleLoadWorkspace(w)}>
              <Layers size={12} class="workspace-icon" />
              <span class="workspace-name">{w.name}</span>
            </button>
            <button
              class="workspace-del-btn"
              title="Hapus {w.name}"
              onclick={() => handleDeleteWorkspace(w.id)}
            >
              <X size={12} />
            </button>
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
    gap: 4px;
    padding: 3px 6px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .workspace-toggle-btn:hover {
    color: var(--brand-cyan);
    background-color: rgba(56, 189, 248, 0.1);
    border-color: var(--brand-cyan);
  }

  .workspace-dropdown {
    position: absolute;
    top: 100%;
    margin-top: 4px;
    left: 0;
    width: 240px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 8px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
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

  .workspace-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
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
    padding: 4px;
    border-radius: var(--radius-xs);
  }

  .workspace-item:hover {
    background-color: var(--bg-hover);
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
  }

  .workspace-load-btn:hover {
    color: var(--text-main);
  }

  .workspace-del-btn {
    background: transparent;
    border: none;
    color: var(--alert-color);
    cursor: pointer;
    opacity: 0.5;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
  }

  .workspace-del-btn:hover {
    opacity: 1;
    background-color: rgba(255, 59, 105, 0.1);
  }
</style>
