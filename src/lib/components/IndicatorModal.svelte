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
    Compass,
    TrendingUp,
    Activity,
    SlidersHorizontal,
    BarChart3,
    Zap,
    Cpu
  } from '@lucide/svelte';
  import {
    indicatorCatalogService,
    type UnifiedIndicatorDescriptor,
    type IndicatorCategory
  } from '../services/indicatorCatalogService';
  import { loadScripts, deleteScript } from '../services/persistence';
  import {
    loadFavoriteIndicatorIds,
    toggleFavoriteIndicatorId
  } from '../services/persistence/uiPreferencesHelper';
  import type { PineScriptRecord } from '../types/market';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectIndicator?: (code: string, title: string) => void;
    onSelectNativeIndicator?: (type: string, title?: string) => void;
    onApplyIndicator?: (descriptor: UnifiedIndicatorDescriptor) => void;
    onOpenInEditor: (code: string, title: string, id?: string) => void;
  }

  let {
    isOpen,
    onClose,
    onSelectIndicator,
    onSelectNativeIndicator,
    onApplyIndicator,
    onOpenInEditor
  }: Props = $props();

  // Search & Navigation States
  let searchQuery = $state('');
  let activeCategory = $state<'All' | 'Trend' | 'Momentum' | 'Volatility' | 'Volume' | 'Profile' | 'Signals' | 'Custom Scripts' | 'Favorites'>('All');
  let kindFilter = $state<'all' | 'native' | 'pine'>('all');
  let savedScripts = $state<PineScriptRecord[]>([]);
  let favoriteIds = $state<string[]>([]);
  let addedFeedbackMap = $state<Record<string, boolean>>({});

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

  async function loadFavorites() {
    try {
      const loaded = await loadFavoriteIndicatorIds();
      if (isOpen) {
        favoriteIds = loaded;
      }
    } catch (err) {
      console.warn('Gagal memuat daftar indikator favorit:', err);
    }
  }

  async function toggleFavorite(e: MouseEvent, id: string) {
    e.stopPropagation();
    try {
      favoriteIds = await toggleFavoriteIndicatorId(id, favoriteIds);
    } catch (err) {
      console.warn(`Gagal mengubah status favorit indikator ${id}:`, err);
    }
  }

  async function handleDeleteScript(e: MouseEvent, scriptId: string, title: string) {
    e.stopPropagation();
    if (confirm(`Hapus skrip "${title}" dari penyimpanan lokal?`)) {
      await deleteScript(scriptId);
      await loadSavedScripts();
    }
  }

  function handleCreateNewScript() {
    onOpenInEditor('', 'New_Strategy_v6.pine');
    onClose();
  }

  function handleApply(indicator: UnifiedIndicatorDescriptor) {
    if (onApplyIndicator) {
      onApplyIndicator(indicator);
    } else if (indicator.kind === 'native') {
      if (onSelectNativeIndicator) {
        onSelectNativeIndicator(indicator.nativeType || indicator.id.replace(/^native:/, ''), indicator.title);
      } else if (onSelectIndicator) {
        onSelectIndicator(indicator.nativeType || indicator.id, indicator.title);
      }
    } else {
      if (onSelectIndicator) {
        onSelectIndicator(indicator.sourceCode || '', indicator.title);
      }
    }

    addedFeedbackMap[indicator.id] = true;
    setTimeout(() => {
      addedFeedbackMap[indicator.id] = false;
    }, 2000);
  }

  // Agregasi seluruh indikator dari service
  let allIndicators = $derived(indicatorCatalogService.getAllIndicators(savedScripts));

  // Perhitungan badge counter untuk setiap tab kategori
  let countAll = $derived(allIndicators.length);
  let countTrend = $derived(allIndicators.filter((i) => i.category === 'Trend').length);
  let countMomentum = $derived(allIndicators.filter((i) => i.category === 'Momentum').length);
  let countVolatility = $derived(allIndicators.filter((i) => i.category === 'Volatility').length);
  let countVolume = $derived(
    allIndicators.filter((i) => i.category === 'Volume' || i.categories?.includes('Volume')).length
  );
  let countProfile = $derived(
    allIndicators.filter((i) => i.category === 'Profile' || i.categories?.includes('Profile')).length
  );
  let countSignals = $derived(
    allIndicators.filter((i) => i.category === 'Signals' || i.categories?.includes('Signals')).length
  );
  let countNative = $derived(allIndicators.filter((i) => i.kind === 'native').length);
  let countPine = $derived(allIndicators.filter((i) => i.kind === 'pine').length);
  let countCustom = $derived(savedScripts.length);
  let countFavorites = $derived(
    allIndicators.filter((i) => indicatorCatalogService.isFavorited(i, favoriteIds)).length
  );

  // Filter daftar indikator secara real-time
  let filteredIndicators = $derived(
    indicatorCatalogService.filterIndicators(allIndicators, {
      searchQuery,
      category: activeCategory,
      kind: kindFilter,
      favoritesOnly: activeCategory === 'Favorites',
      favoriteIds,
    })
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
      aria-label="Katalog Terpadu Indikator & Studi WebGL"
    >
      <!-- Top Titlebar -->
      <header class="modal-header">
        <div class="header-left">
          <div class="icon-wrap">
            <Layers size={16} class="text-bull" />
          </div>
          <div class="header-text">
            <h3>Katalog Terpadu Indikator & Scripting Library</h3>
            <span class="sub-text">76 Studi Native WebGL2 Instan & Pustaka Algoritma Pine Script v6</span>
          </div>
        </div>
        <button class="btn-close" title="Tutup Modal (Esc)" onclick={onClose}>
          <X size={16} />
        </button>
      </header>

      <!-- Search & Quick Filter Toolbar -->
      <div class="search-toolbar">
        <div class="search-input-wrapper">
          <Search size={14} class="search-icon" />
          <input
            type="text"
            placeholder="Cari indikator berdasarkan nama, singkatan (e.g. RSI, VRVP, ATR, SMA, MACD, VPVR)..."
            bind:value={searchQuery}
            class="search-input mono-nums"
          />
          {#if searchQuery}
            <button class="btn-clear-search" onclick={() => (searchQuery = '')}>
              <X size={12} />
            </button>
          {/if}
        </div>

        <!-- Kind Filter Chips (Semua, Native, Pine) -->
        <div class="kind-filter-row">
          <button
            class="kind-chip {kindFilter === 'all' ? 'active' : ''}"
            onclick={() => (kindFilter = 'all')}
          >
            Semua Studi ({countAll})
          </button>
          <button
            class="kind-chip {kindFilter === 'native' ? 'active' : ''}"
            onclick={() => (kindFilter = 'native')}
          >
            <Cpu size={11} />
            <span>Native ({countNative})</span>
          </button>
          <button
            class="kind-chip {kindFilter === 'pine' ? 'active' : ''}"
            onclick={() => (kindFilter = 'pine')}
          >
            <Code size={11} />
            <span>Pine Script ({allIndicators.filter((i) => i.kind === 'pine').length})</span>
          </button>
        </div>
      </div>

      <!-- Main Layout Body: Dual-Navigation (Sidebar + Content View) -->
      <div class="modal-body-layout">
        <!-- Left Sidebar Navigation Rail -->
        <aside class="sidebar-nav">
          <div class="nav-section-title">KATEGORI INDIKATOR</div>

          <button
            class="nav-tab-btn {activeCategory === 'All' ? 'active' : ''}"
            onclick={() => (activeCategory = 'All')}
          >
            <Compass size={14} />
            <span class="tab-label">Semua Indikator</span>
            <span class="count-pill">{countAll}</span>
          </button>

          <button
            class="nav-tab-btn {activeCategory === 'Trend' ? 'active' : ''}"
            onclick={() => (activeCategory = 'Trend')}
          >
            <TrendingUp size={14} />
            <span class="tab-label">Trend</span>
            <span class="count-pill">{countTrend}</span>
          </button>

          <button
            class="nav-tab-btn {activeCategory === 'Momentum' ? 'active' : ''}"
            onclick={() => (activeCategory = 'Momentum')}
          >
            <Activity size={14} />
            <span class="tab-label">Momentum</span>
            <span class="count-pill">{countMomentum}</span>
          </button>

          <button
            class="nav-tab-btn {activeCategory === 'Volatility' ? 'active' : ''}"
            onclick={() => (activeCategory = 'Volatility')}
          >
            <SlidersHorizontal size={14} />
            <span class="tab-label">Volatilitas</span>
            <span class="count-pill">{countVolatility}</span>
          </button>

          <button
            class="nav-tab-btn {activeCategory === 'Volume' ? 'active' : ''}"
            onclick={() => (activeCategory = 'Volume')}
          >
            <BarChart3 size={14} />
            <span class="tab-label">Volume</span>
            <span class="count-pill">{countVolume}</span>
          </button>

          <button
            class="nav-tab-btn {activeCategory === 'Profile' ? 'active' : ''}"
            onclick={() => (activeCategory = 'Profile')}
          >
            <Layers size={14} />
            <span class="tab-label">Profil Volume</span>
            <span class="count-pill">{countProfile}</span>
          </button>

          <button
            class="nav-tab-btn {activeCategory === 'Signals' ? 'active' : ''}"
            onclick={() => (activeCategory = 'Signals')}
          >
            <Zap size={14} />
            <span class="tab-label">Signals</span>
            <span class="count-pill">{countSignals}</span>
          </button>

          <div class="nav-section-title mt-2">SKRIP SAYA & PERSONALISASI</div>

          <button
            class="nav-tab-btn {activeCategory === 'Custom Scripts' ? 'active' : ''}"
            onclick={() => (activeCategory = 'Custom Scripts')}
          >
            <Code size={14} />
            <span class="tab-label">Skrip Saya</span>
            <span class="count-pill custom-count">{countCustom}</span>
          </button>

          <button
            class="nav-tab-btn {activeCategory === 'Favorites' ? 'active' : ''}"
            onclick={() => (activeCategory = 'Favorites')}
          >
            <Star size={14} class="text-gold" />
            <span class="tab-label">Favorit</span>
            <span class="count-pill">{countFavorites}</span>
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
          <div class="list-group-header">
            <span class="group-title">
              {activeCategory === 'All' ? 'SELURUH INDIKATOR TERSEDIA' : activeCategory.toUpperCase()}
            </span>
            <span class="group-count">{filteredIndicators.length} Hasil Ditampilkan</span>
          </div>

          <div class="cards-grid">
            {#each filteredIndicators as indicator (indicator.id)}
              {@const isFav = indicatorCatalogService.isFavorited(indicator, favoriteIds)}
              {@const isAdded = Boolean(addedFeedbackMap[indicator.id])}

              <div class="indicator-card {indicator.kind === 'native' ? 'native-card' : 'pine-card'} {indicator.prominent ? 'prominent-card' : ''} obsidian-panel">
                <div class="card-top-row">
                  <button
                    class="btn-star {isFav ? 'starred' : ''}"
                    title={isFav ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                    onclick={(e) => toggleFavorite(e, indicator.id)}
                  >
                    <Star size={13} fill={isFav ? 'currentColor' : 'none'} />
                  </button>

                  <div class="card-titles">
                    <div class="title-with-short">
                      <span class="card-name mono-nums">{indicator.title}</span>
                      {#if indicator.shortTitle}
                        <span class="short-title-tag mono-nums">({indicator.shortTitle})</span>
                      {/if}
                    </div>

                    <div class="badges-row">
                      {#if indicator.prominent}
                        <span class="badge-source badge-prominent" title="Studi Profil Unggulan">Unggulan</span>
                      {/if}

                      <!-- Badge Native vs Pine vs Skrip Saya -->
                      {#if indicator.kind === 'native'}
                        <span class="badge-source badge-native">Native</span>
                      {:else if indicator.category === 'Custom'}
                        <span class="badge-source badge-custom">Skrip Saya</span>
                      {:else}
                        <span class="badge-source badge-pine">Pine</span>
                      {/if}

                      <span class="badge-cat">{indicator.category}</span>

                      <span class="badge-type {indicator.overlay ? 'overlay' : 'sub'}">
                        {indicator.overlay ? 'Overlay' : 'Sub-Pane'}
                      </span>

                      {#if indicator.multiInstance}
                        <span class="badge-multi" title="Dapat dipasang lebih dari 1 instance dengan parameter berbeda">Multi</span>
                      {/if}
                    </div>
                  </div>
                </div>

                <p class="card-description">{indicator.description}</p>

                <div class="card-actions">
                  {#if indicator.sourceCode}
                    <button
                      class="btn-action-edit"
                      title="Buka dan modifikasi kode di Pine Script IDE"
                      onclick={() => {
                        onOpenInEditor(indicator.sourceCode!, indicator.title, indicator.category === 'Custom' ? indicator.id : undefined);
                        onClose();
                      }}
                    >
                      <Code size={13} />
                      <span>Edit di IDE</span>
                    </button>
                  {/if}

                  {#if indicator.category === 'Custom'}
                    <button
                      class="btn-action-delete"
                      title="Hapus skrip dari database lokal"
                      onclick={(e) => handleDeleteScript(e, indicator.id, indicator.title)}
                    >
                      <Trash2 size={13} />
                    </button>
                  {/if}

                  <button
                    class="btn-action-apply {isAdded ? 'applied' : ''}"
                    title="Terapkan indikator ini ke grafik WebGL aktif"
                    onclick={() => handleApply(indicator)}
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

          <!-- EMPTY STATES -->
          {#if filteredIndicators.length === 0}
            <div class="empty-results-box">
              {#if activeCategory === 'Custom Scripts'}
                <Code size={36} class="empty-icon text-bull" />
                <h4>Belum ada skrip kustom tersimpan</h4>
                <p>Buat dan kustomisasi strategi trading Anda sendiri menggunakan Pine Script v6 di editor bawaan.</p>
                <button class="btn-create-first" onclick={handleCreateNewScript}>
                  <FilePlus size={14} />
                  <span>+ Buat Skrip Pertama Sekarang</span>
                </button>
              {:else if activeCategory === 'Favorites'}
                <Star size={36} class="empty-icon text-gold" />
                <h4>Belum ada indikator favorit</h4>
                <p>Klik ikon bintang (⭐) pada kartu indikator mana pun untuk menyematkannya di bagian teratas dan tab favorit ini.</p>
              {:else}
                <Search size={36} class="empty-icon text-muted" />
                <h4>Tidak ada indikator yang cocok</h4>
                <p>Tidak ditemukan indikator dengan kata kunci pencarian "<b>{searchQuery}</b>".</p>
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
          <span>Studi Native dihitung instan tanpa beban Web Worker · Gunakan <code>Ctrl+S</code> di Pine Editor untuk kompilasi skrip</span>
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
    width: 860px;
    max-width: 95vw;
    height: 640px;
    max-height: 90vh;
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

  /* Search & Quick Filter Toolbar */
  .search-toolbar {
    padding: 10px 16px;
    background-color: var(--bg-panel, #0E121A);
    border-bottom: 1px solid var(--border-hairline, #1E293B);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  .kind-filter-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .kind-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background-color: var(--bg-container, #131722);
    border: 1px solid var(--border-hairline, #1E293B);
    border-radius: var(--radius-xs, 4px);
    color: var(--text-muted, #94A3B8);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .kind-chip:hover {
    color: var(--text-main, #F8FAFC);
    border-color: var(--border-bright, #334155);
  }

  .kind-chip.active {
    background-color: rgba(0, 240, 144, 0.1);
    color: var(--brand-primary, #00F090);
    border-color: var(--brand-primary, #00F090);
    font-weight: 600;
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
    width: 220px;
    background-color: var(--bg-panel, #0E121A);
    border-right: 1px solid var(--border-hairline, #1E293B);
    display: flex;
    flex-direction: column;
    padding: 12px 10px;
    gap: 3px;
    flex-shrink: 0;
    overflow-y: auto;
  }

  .nav-section-title {
    font-size: 9px;
    font-weight: 700;
    color: var(--text-dim, #64748B);
    padding: 4px 8px;
    letter-spacing: 0.5px;
  }

  .nav-section-title.mt-2 {
    margin-top: 8px;
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

  .sidebar-spacer {
    flex: 1;
    min-height: 10px;
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
    gap: 12px;
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

  .title-with-short {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .card-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main, #F8FAFC);
    line-height: 1.3;
  }

  .short-title-tag {
    font-size: 10px;
    font-weight: 600;
    color: var(--brand-primary, #00F090);
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
    padding: 1px 6px;
    border-radius: 2px;
  }

  .badge-prominent {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15));
    color: #FBBF24;
    border: 1px solid rgba(245, 158, 11, 0.45);
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.2);
  }

  .prominent-card {
    border-color: rgba(245, 158, 11, 0.3) !important;
    background: linear-gradient(180deg, rgba(245, 158, 11, 0.04) 0%, rgba(15, 23, 42, 0.6) 100%) !important;
  }

  .prominent-card:hover {
    border-color: rgba(245, 158, 11, 0.55) !important;
  }

  .badge-native {
    background-color: rgba(0, 240, 144, 0.12);
    color: var(--brand-primary, #00F090);
    border: 1px solid rgba(0, 240, 144, 0.3);
  }

  .badge-pine {
    background-color: rgba(56, 189, 248, 0.12);
    color: #38BDF8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .badge-custom {
    background-color: rgba(168, 85, 247, 0.12);
    color: #C084FC;
    border: 1px solid rgba(168, 85, 247, 0.3);
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

  .badge-multi {
    font-size: 9px;
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-dim, #64748B);
    padding: 1px 5px;
    border-radius: 2px;
  }

  .card-description {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted, #94A3B8);
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
    color: var(--on-brand-primary, #000000);
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
    background-color: var(--bg-panel, #0E121A);
    border: 1px dashed var(--border-hairline, #1E293B);
    border-radius: var(--radius-md, 8px);
    margin-top: 10px;
  }

  .empty-icon {
    margin-bottom: 12px;
  }

  .empty-results-box h4 {
    margin: 0 0 6px 0;
    font-size: 13px;
    color: var(--text-main, #F8FAFC);
  }

  .empty-results-box p {
    margin: 0 0 16px 0;
    font-size: 11px;
    color: var(--text-dim, #64748B);
    max-width: 320px;
    line-height: 1.5;
  }

  .btn-create-first,
  .btn-reset-search {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background-color: rgba(0, 240, 144, 0.1);
    border: 1px solid var(--brand-primary, #00F090);
    color: var(--brand-primary, #00F090);
    border-radius: var(--radius-xs, 4px);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-create-first:hover,
  .btn-reset-search:hover {
    background-color: var(--brand-primary, #00F090);
    color: var(--on-brand-primary, #000000);
  }

  /* Footer */
  .modal-footer {
    height: 44px;
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
    border-radius: 3px;
    color: var(--text-muted, #94A3B8);
  }

  .btn-footer-close {
    padding: 5px 14px;
    background-color: var(--bg-panel, #0E121A);
    border: 1px solid var(--border-hairline, #1E293B);
    color: var(--text-main, #F8FAFC);
    border-radius: var(--radius-xs, 4px);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-footer-close:hover {
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.05));
    border-color: var(--border-bright, #334155);
  }
</style>
