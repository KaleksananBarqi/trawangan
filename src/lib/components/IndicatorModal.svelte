<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Search,
    X,
    Plus,
    Code,
    Trash2,
    Layers,
    Sparkles,
    Star,
    Check,
    FilePlus,
    Clock,
    Tag,
    FolderKanban,
    Compass
  } from '@lucide/svelte';
  import { INDICATOR_PRESETS, type IndicatorPreset } from '../data/indicatorPresets';
  import { loadScripts, deleteScript } from '../services/persistence';
  import type { PineScriptRecord } from '../types/market';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectIndicator: (code: string, title: string) => void;
    onOpenInEditor: (code: string, title: string, id?: string) => void;
  }

  let { isOpen, onClose, onSelectIndicator, onOpenInEditor }: Props = $props();

  // Search & Navigation States
  let searchQuery = $state('');
  let activeNavTab = $state<'all' | 'official' | 'custom' | 'favorites'>('all');
  let selectedCategoryFilter = $state<string>('All');
  let savedScripts = $state<PineScriptRecord[]>([]);
  let favoriteIds = $state<string[]>([]);
  let addedFeedbackMap = $state<Record<string, boolean>>({});

  const officialCategories = ['All', 'Volume', 'Trend', 'Momentum', 'Volatility', 'Signals'];

  // Muat data skrip tersimpan dan daftar favorit saat modal dibuka
  $effect(() => {
    if (isOpen) {
      loadSavedScripts();
      loadFavorites();
      searchQuery = '';
      addedFeedbackMap = {};
    }
  });

  async function loadSavedScripts() {
    try {
      savedScripts = await loadScripts();
    } catch (err) {
      console.warn('Gagal memuat skrip tersimpan:', err);
    }
  }

  function loadFavorites() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('trawangan_fav_indicators');
        if (raw) favoriteIds = JSON.parse(raw);
      } catch (_) {}
    }
  }

  function toggleFavorite(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (favoriteIds.includes(id)) {
      favoriteIds = favoriteIds.filter((item) => item !== id);
    } else {
      favoriteIds = [...favoriteIds, id];
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('trawangan_fav_indicators', JSON.stringify(favoriteIds));
    }
  }

  async function handleDeleteScript(e: MouseEvent, script: PineScriptRecord) {
    e.stopPropagation();
    if (confirm(`Hapus skrip "${script.title}" dari penyimpanan lokal?`)) {
      await deleteScript(script.id);
      await loadSavedScripts();
    }
  }

  function handleCreateNewScript() {
    onOpenInEditor('', 'New_Strategy_v6.pine');
    onClose();
  }

  function handleApplyIndicator(code: string, title: string, keyId: string) {
    onSelectIndicator(code, title);
    addedFeedbackMap[keyId] = true;
    setTimeout(() => {
      addedFeedbackMap[keyId] = false;
    }, 2000);
  }

  // Filter Presets Resmi
  const filteredPresets = $derived(
    INDICATOR_PRESETS.filter((p) => {
      const matchCat = selectedCategoryFilter === 'All' || p.category === selectedCategoryFilter;
      const matchSearch =
        searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFav = activeNavTab !== 'favorites' || favoriteIds.includes(p.id);
      return matchCat && matchSearch && matchFav;
    })
  );

  // Filter Skrip Kustom Pengguna
  const filteredSavedScripts = $derived(
    savedScripts.filter((s) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchFav = activeNavTab !== 'favorites' || favoriteIds.includes(s.id);
      return matchSearch && matchFav;
    })
  );

  // Total count
  let totalSavedCount = $derived(savedScripts.length);
  let totalPresetsCount = $derived(INDICATOR_PRESETS.length);
  let totalFavoritesCount = $derived(
    favoriteIds.filter(
      (id) => INDICATOR_PRESETS.some((p) => p.id === id) || savedScripts.some((s) => s.id === id)
    ).length
  );
</script>

<svelte:window onkeydown={(e) => {
  if (isOpen && e.key === 'Escape') onClose();
}} />

{#if isOpen}
  <!-- Backdrop -->
  <div class="modal-backdrop" onclick={onClose} role="presentation">
    <!-- Main Modal Window (Stop propagation to prevent accidental close) -->
    <div
      class="modal-window obsidian-panel"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Indikator & Scripting Library"
    >
      <!-- Top Titlebar -->
      <header class="modal-header">
        <div class="header-left">
          <div class="icon-wrap">
            <Layers size={16} class="text-bull" />
          </div>
          <div class="header-text">
            <h3>Indikator & Scripting Library</h3>
            <span class="sub-text">Pustaka algoritma teknikal bawaan & skrip kustom Pine Script v6</span>
          </div>
        </div>
        <button class="btn-close" title="Tutup Modal (Esc)" onclick={onClose}>
          <X size={16} />
        </button>
      </header>

      <!-- Search Toolbar Bar -->
      <div class="search-toolbar">
        <div class="search-input-wrapper">
          <Search size={14} class="search-icon" />
          <input
            type="text"
            placeholder="Cari indikator atau skrip saya (e.g. RSI, EMA, SuperTrend, MACD, Volume)..."
            bind:value={searchQuery}
            class="search-input mono-nums"
          />
          {#if searchQuery}
            <button class="btn-clear-search" onclick={() => (searchQuery = '')}>
              <X size={12} />
            </button>
          {/if}
        </div>
      </div>

      <!-- Main Layout Body: Dual-Navigation (Sidebar + Content View) -->
      <div class="modal-body-layout">
        <!-- Left Sidebar Navigation Rail -->
        <aside class="sidebar-nav">
          <div class="nav-section-title">SUMBER INDIKATOR</div>

          <button
            class="nav-tab-btn {activeNavTab === 'all' ? 'active' : ''}"
            onclick={() => {
              activeNavTab = 'all';
              selectedCategoryFilter = 'All';
            }}
          >
            <Compass size={14} />
            <span class="tab-label">Semua Indikator</span>
            <span class="count-pill">{totalPresetsCount + totalSavedCount}</span>
          </button>

          <button
            class="nav-tab-btn {activeNavTab === 'official' ? 'active' : ''}"
            onclick={() => {
              activeNavTab = 'official';
              selectedCategoryFilter = 'All';
            }}
          >
            <FolderKanban size={14} />
            <span class="tab-label">Bawaan Resmi</span>
            <span class="count-pill">{totalPresetsCount}</span>
          </button>

          <!-- Sub-kategori chips jika tab official aktif -->
          {#if activeNavTab === 'official'}
            <div class="sub-filter-group">
              {#each officialCategories as cat}
                <button
                  class="sub-chip {selectedCategoryFilter === cat ? 'active' : ''}"
                  onclick={() => (selectedCategoryFilter = cat)}
                >
                  {cat}
                </button>
              {/each}
            </div>
          {/if}

          <button
            class="nav-tab-btn {activeNavTab === 'custom' ? 'active' : ''}"
            onclick={() => {
              activeNavTab = 'custom';
              selectedCategoryFilter = 'All';
            }}
          >
            <Code size={14} />
            <span class="tab-label">Skrip Saya</span>
            <span class="count-pill custom-count">{totalSavedCount}</span>
          </button>

          <button
            class="nav-tab-btn {activeNavTab === 'favorites' ? 'active' : ''}"
            onclick={() => {
              activeNavTab = 'favorites';
              selectedCategoryFilter = 'All';
            }}
          >
            <Star size={14} class="text-gold" />
            <span class="tab-label">Favorit</span>
            <span class="count-pill">{totalFavoritesCount}</span>
          </button>

          <div class="sidebar-spacer"></div>

          <!-- Quick Action: Buat Skrip Baru -->
          <div class="create-script-box">
            <button
              class="btn-new-script"
              title="Buka template baru di Pine Script Editor"
              onclick={handleCreateNewScript}
            >
              <FilePlus size={13} />
              <span>+ Buat Skrip Baru</span>
            </button>
          </div>
        </aside>

        <!-- Right Content List Area -->
        <main class="content-list-pane">
          <!-- SECTION 1: SKRIP SAYA (Tampil jika tab 'all', 'custom', atau 'favorites') -->
          {#if (activeNavTab === 'all' || activeNavTab === 'custom' || activeNavTab === 'favorites') && filteredSavedScripts.length > 0}
            <div class="list-group-header">
              <span class="group-title">SKRIP SAYA (KUSTOM)</span>
              <span class="group-count">{filteredSavedScripts.length} Tersimpan</span>
            </div>

            <div class="cards-grid">
              {#each filteredSavedScripts as script (script.id)}
                {@const isFav = favoriteIds.includes(script.id)}
                {@const isAdded = Boolean(addedFeedbackMap[script.id])}

                <div class="indicator-card custom-card obsidian-panel">
                  <div class="card-top-row">
                    <button
                      class="btn-star {isFav ? 'starred' : ''}"
                      title={isFav ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                      onclick={(e) => toggleFavorite(e, script.id)}
                    >
                      <Star size={13} fill={isFav ? 'currentColor' : 'none'} />
                    </button>

                    <div class="card-titles">
                      <span class="card-name mono-nums">{script.title}</span>
                      <div class="badges-row">
                        <span class="badge-source badge-custom">Skrip Saya</span>
                        <span class="badge-type {script.is_overlay ? 'overlay' : 'sub'}">
                          {script.is_overlay ? 'Chart Overlay' : 'Separate Pane'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="card-meta mono-nums">
                    <Clock size={11} class="meta-icon" />
                    <span>Diperbarui: {new Date(script.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>

                  <div class="card-actions">
                    <button
                      class="btn-action-edit"
                      title="Buka dan modifikasi kode di Pine Script IDE"
                      onclick={() => {
                        onOpenInEditor(script.code, script.title, script.id);
                        onClose();
                      }}
                    >
                      <Code size={13} />
                      <span>Edit di IDE</span>
                    </button>

                    <button
                      class="btn-action-delete"
                      title="Hapus skrip dari database lokal"
                      onclick={(e) => handleDeleteScript(e, script)}
                    >
                      <Trash2 size={13} />
                    </button>

                    <button
                      class="btn-action-apply {isAdded ? 'applied' : ''}"
                      title="Terapkan indikator ini ke grafik WebGL aktif"
                      onclick={() => handleApplyIndicator(script.code, script.title, script.id)}
                    >
                      {#if isAdded}
                        <Check size={13} />
                        <span>✓ Terpasang</span>
                      {:else}
                        <Plus size={13} />
                        <span>Pasang</span>
                      {/if}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- SECTION 2: PRESET RESMI (Tampil jika tab 'all', 'official', atau 'favorites') -->
          {#if (activeNavTab === 'all' || activeNavTab === 'official' || activeNavTab === 'favorites') && filteredPresets.length > 0}
            <div class="list-group-header">
              <span class="group-title">KATALOG RESMI (BUILT-IN)</span>
              <span class="group-count">{filteredPresets.length} Indikator</span>
            </div>

            <div class="cards-grid">
              {#each filteredPresets as preset (preset.id)}
                {@const isFav = favoriteIds.includes(preset.id)}
                {@const isAdded = Boolean(addedFeedbackMap[preset.id])}

                <div class="indicator-card official-card obsidian-panel">
                  <div class="card-top-row">
                    <button
                      class="btn-star {isFav ? 'starred' : ''}"
                      title={isFav ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                      onclick={(e) => toggleFavorite(e, preset.id)}
                    >
                      <Star size={13} fill={isFav ? 'currentColor' : 'none'} />
                    </button>

                    <div class="card-titles">
                      <span class="card-name mono-nums">{preset.name}</span>
                      <div class="badges-row">
                        <span class="badge-source badge-official">Resmi</span>
                        <span class="badge-cat">{preset.category}</span>
                        <span class="badge-type {preset.overlay ? 'overlay' : 'sub'}">
                          {preset.overlay ? 'Overlay' : 'Sub-Pane'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p class="card-description">{preset.description}</p>

                  <div class="card-actions">
                    <button
                      class="btn-action-edit"
                      title="Salin dan buka kode preset ini di Pine Script Editor"
                      onclick={() => {
                        onOpenInEditor(preset.sourceCode, preset.name);
                        onClose();
                      }}
                    >
                      <Code size={13} />
                      <span>Edit di IDE</span>
                    </button>

                    <button
                      class="btn-action-apply {isAdded ? 'applied' : ''}"
                      title="Terapkan preset ini ke grafik WebGL aktif"
                      onclick={() => handleApplyIndicator(preset.sourceCode, preset.name, preset.id)}
                    >
                      {#if isAdded}
                        <Check size={13} />
                        <span>✓ Terpasang</span>
                      {:else}
                        <Plus size={13} />
                        <span>Pasang</span>
                      {/if}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- EMPTY STATES -->
          {#if filteredSavedScripts.length === 0 && filteredPresets.length === 0}
            <div class="empty-results-box">
              {#if activeNavTab === 'custom'}
                <Code size={36} class="empty-icon text-bull" />
                <h4>Belum ada skrip kustom tersimpan</h4>
                <p>Buat dan kustomisasi strategi trading Anda sendiri menggunakan Pine Script v6 di editor bawaan.</p>
                <button class="btn-create-first" onclick={handleCreateNewScript}>
                  <FilePlus size={14} />
                  <span>+ Buat Skrip Pertama Sekarang</span>
                </button>
              {:else if activeNavTab === 'favorites'}
                <Star size={36} class="empty-icon text-gold" />
                <h4>Belum ada indikator favorit</h4>
                <p>Klik ikon bintang (⭐) pada kartu indikator mana pun untuk menambahkannya ke daftar favorit ini.</p>
              {:else}
                <Search size={36} class="empty-icon text-muted" />
                <h4>Tidak ada indikator yang cocok</h4>
                <p>Tidak ditemukan indikator atau skrip dengan kata kunci "<b>{searchQuery}</b>".</p>
                <button class="btn-reset-search" onclick={() => (searchQuery = '')}>
                  Reset Pencarian
                </button>
              {/if}
            </div>
          {/if}
        </main>
      </div>

      <!-- Footer Bar -->
      <footer class="modal-footer">
        <div class="footer-hint mono-nums">
          <span>Tip: Gunakan shortcut <code>Ctrl+S</code> di Pine Editor untuk kompilasi langsung ke chart</span>
        </div>
        <div class="footer-buttons">
          <button class="btn-footer-close" onclick={onClose}>
            Selesai
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(3, 7, 13, 0.78);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-window {
    width: 820px;
    max-width: 94vw;
    height: 600px;
    max-height: 88vh;
    background-color: var(--bg-panel, #0E121A);
    border: 1px solid var(--border-hairline, #1E293B);
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  .modal-header {
    height: 48px;
    background-color: var(--bg-container, #131722);
    border-bottom: 1px solid var(--border-hairline, #1E293B);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .icon-wrap {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-xs, 4px);
    background-color: rgba(0, 240, 144, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header-text h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #F8FAFC);
  }

  .header-text .sub-text {
    font-size: 10px;
    color: var(--text-dim, #64748B);
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-muted, #94A3B8);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-xs, 4px);
    display: flex;
  }

  .btn-close:hover {
    color: var(--text-main, #F8FAFC);
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.05));
  }

  /* Search Toolbar */
  .search-toolbar {
    padding: 10px 16px;
    background-color: var(--bg-panel, #0E121A);
    border-bottom: 1px solid var(--border-hairline, #1E293B);
    flex-shrink: 0;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input-wrapper .search-icon {
    position: absolute;
    left: 12px;
    color: var(--text-dim, #64748B);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: 34px;
    background-color: var(--bg-darkest, #07090E);
    border: 1px solid var(--border-hairline, #1E293B);
    border-radius: var(--radius-xs, 4px);
    padding: 0 34px 0 34px;
    font-size: 12px;
    color: var(--text-main, #F8FAFC);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .search-input:focus {
    border-color: var(--border-focus, #00F090);
  }

  .btn-clear-search {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: var(--text-dim, #64748B);
    cursor: pointer;
    padding: 2px;
    display: flex;
  }

  /* Main Body Layout */
  .modal-body-layout {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  /* Left Sidebar Navigation */
  .sidebar-nav {
    width: 210px;
    background-color: var(--bg-panel, #0E121A);
    border-right: 1px solid var(--border-hairline, #1E293B);
    display: flex;
    flex-direction: column;
    padding: 12px 10px;
    gap: 4px;
    flex-shrink: 0;
  }

  .nav-section-title {
    font-size: 9px;
    font-weight: 700;
    color: var(--text-dim, #64748B);
    padding: 4px 8px;
    letter-spacing: 0.5px;
  }

  .nav-tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: none;
    border: none;
    border-radius: var(--radius-xs, 4px);
    color: var(--text-muted, #94A3B8);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .nav-tab-btn:hover {
    color: var(--text-main, #F8FAFC);
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.04));
  }

  .nav-tab-btn.active {
    color: var(--brand-primary, #00F090);
    background-color: rgba(0, 240, 144, 0.08);
    font-weight: 600;
  }

  .tab-label {
    flex: 1;
  }

  .count-pill {
    font-size: 10px;
    background-color: var(--bg-container, #131722);
    color: var(--text-dim, #64748B);
    padding: 1px 6px;
    border-radius: 10px;
  }

  .count-pill.custom-count {
    color: var(--brand-primary, #00F090);
  }

  .sub-filter-group {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 4px 8px 18px;
  }

  .sub-chip {
    background-color: var(--bg-darkest, #07090E);
    border: 1px solid var(--border-hairline, #1E293B);
    color: var(--text-dim, #64748B);
    font-size: 10px;
    padding: 2px 6px;
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
  }

  .sub-chip:hover {
    color: var(--text-main, #F8FAFC);
    border-color: var(--border-bright, #334155);
  }

  .sub-chip.active {
    background-color: rgba(59, 130, 246, 0.15);
    color: #38BDF8;
    border-color: #38BDF8;
  }

  .sidebar-spacer {
    flex: 1;
  }

  .create-script-box {
    padding-top: 10px;
    border-top: 1px solid var(--border-hairline, #1E293B);
  }

  .btn-new-script {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px;
    background-color: rgba(0, 240, 144, 0.08);
    border: 1px solid rgba(0, 240, 144, 0.3);
    color: var(--brand-primary, #00F090);
    border-radius: var(--radius-xs, 4px);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-new-script:hover {
    background-color: rgba(0, 240, 144, 0.16);
    border-color: var(--brand-primary, #00F090);
  }

  /* Right Content List Area */
  .content-list-pane {
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background-color: var(--bg-darkest, #07090E);
  }

  .list-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-hairline, #1E293B);
    padding-bottom: 6px;
  }

  .group-title {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-dim, #64748B);
    letter-spacing: 0.5px;
  }

  .group-count {
    font-size: 10px;
    color: var(--text-dim, #64748B);
  }

  .cards-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Indicator Card */
  .indicator-card {
    background-color: var(--bg-panel, #0E121A);
    border: 1px solid var(--border-hairline, #1E293B);
    border-radius: var(--radius-xs, 4px);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 0.15s ease;
  }

  .indicator-card:hover {
    border-color: var(--border-bright, #334155);
  }

  .card-top-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .btn-star {
    background: none;
    border: none;
    color: var(--text-dim, #64748B);
    cursor: pointer;
    padding: 2px;
    margin-top: 1px;
    display: flex;
    border-radius: var(--radius-xs, 4px);
  }

  .btn-star:hover,
  .btn-star.starred {
    color: #F59E0B;
  }

  .card-titles {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main, #F8FAFC);
    line-height: 1.3;
  }

  .badges-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .badge-source {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 2px;
  }

  .badge-official {
    background-color: rgba(56, 189, 248, 0.12);
    color: #38BDF8;
  }

  .badge-custom {
    background-color: rgba(0, 240, 144, 0.12);
    color: var(--brand-primary, #00F090);
  }

  .badge-cat {
    font-size: 9px;
    background-color: var(--bg-container, #131722);
    color: var(--text-dim, #64748B);
    padding: 1px 5px;
    border-radius: 2px;
  }

  .badge-type {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 2px;
  }

  .badge-type.overlay {
    background-color: rgba(168, 85, 247, 0.12);
    color: #C084FC;
  }

  .badge-type.sub {
    background-color: rgba(245, 158, 11, 0.12);
    color: #FBBF24;
  }

  .card-description {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted, #94A3B8);
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--text-dim, #64748B);
  }

  .card-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
  }

  .btn-action-edit {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    background-color: var(--bg-container, #131722);
    border: 1px solid var(--border-hairline, #1E293B);
    color: var(--text-muted, #94A3B8);
    border-radius: var(--radius-xs, 4px);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action-edit:hover {
    color: var(--text-main, #F8FAFC);
    border-color: var(--border-bright, #334155);
  }

  .btn-action-delete {
    display: flex;
    align-items: center;
    padding: 4px 6px;
    background-color: var(--bg-container, #131722);
    border: 1px solid var(--border-hairline, #1E293B);
    color: var(--text-dim, #64748B);
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
  }

  .btn-action-delete:hover {
    color: var(--bear-color, #FF3B69);
    border-color: var(--bear-color, #FF3B69);
  }

  .btn-action-apply {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background-color: var(--brand-primary, #00F090);
    border: none;
    color: var(--bg-darkest, #07090E);
    border-radius: var(--radius-xs, 4px);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action-apply:hover {
    opacity: 0.9;
  }

  .btn-action-apply.applied {
    background-color: rgba(0, 240, 144, 0.2);
    color: var(--brand-primary, #00F090);
    border: 1px solid var(--brand-primary, #00F090);
  }

  /* Empty States */
  .empty-results-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    gap: 8px;
  }

  .empty-results-box h4 {
    margin: 4px 0 0 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main, #F8FAFC);
  }

  .empty-results-box p {
    margin: 0;
    font-size: 11px;
    color: var(--text-dim, #64748B);
    max-width: 320px;
    line-height: 1.4;
  }

  .btn-create-first,
  .btn-reset-search {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background-color: var(--bg-container, #131722);
    border: 1px solid var(--border-bright, #334155);
    color: var(--brand-primary, #00F090);
    border-radius: var(--radius-xs, 4px);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-create-first:hover,
  .btn-reset-search:hover {
    border-color: var(--brand-primary, #00F090);
  }

  /* Footer */
  .modal-footer {
    height: 40px;
    background-color: var(--bg-container, #131722);
    border-top: 1px solid var(--border-hairline, #1E293B);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    flex-shrink: 0;
  }

  .footer-hint {
    font-size: 10px;
    color: var(--text-dim, #64748B);
  }

  .footer-hint code {
    background-color: var(--bg-darkest, #07090E);
    border: 1px solid var(--border-hairline, #1E293B);
    padding: 1px 4px;
    border-radius: 2px;
    color: var(--brand-primary, #00F090);
  }

  .btn-footer-close {
    padding: 4px 12px;
    background-color: var(--bg-panel, #0E121A);
    border: 1px solid var(--border-hairline, #1E293B);
    color: var(--text-muted, #94A3B8);
    border-radius: var(--radius-xs, 4px);
    font-size: 11px;
    cursor: pointer;
  }

  .btn-footer-close:hover {
    color: var(--text-main, #F8FAFC);
    border-color: var(--border-bright, #334155);
  }

  .text-bull {
    color: var(--brand-primary, #00F090);
  }

  .text-gold {
    color: #F59E0B;
  }
</style>
