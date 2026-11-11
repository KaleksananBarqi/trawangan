// Pengujian Kontrak Struktural Tiket #167: Pemangkasan Sub-Toolbar Watchlist & Penghapusan Modal Redundan
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const watchlistTabPath = path.join(rootDir, 'src/lib/components/right-dock/WatchlistTab.svelte');
const watchlistPanelPath = path.join(rootDir, 'src/lib/components/WatchlistPanel.svelte');
const pagePath = path.join(rootDir, 'src/routes/+page.svelte');

describe('Tiket #167: Pemangkasan Sub-Toolbar Watchlist & Modal Redundan', () => {
  describe('1. Kontrak WatchlistTab.svelte: Hapus sub-toolbar, quick-add, omni-search, & modal tambah kategori', () => {
    const content = fs.readFileSync(watchlistTabPath, 'utf-8');

    test('Menghapus baris .sub-toolbar beserta tombol Cari Pair, +, dan FolderPlus', () => {
      assert.doesNotMatch(content, /class="[^"]*\bsub-toolbar\b/);
      assert.doesNotMatch(content, /\.sub-toolbar\b/);
      assert.doesNotMatch(content, /Cari simbol|Cari Pair|Tambah Kategori \/ Section/);
      assert.doesNotMatch(content, /add-symbol-btn|add-section-toolbar-btn|symbol-search-trigger-btn/);
    });

    test('Menghapus form tambah simbol cepat inline (.add-form) dan modal tambah kategori', () => {
      assert.doesNotMatch(content, /class="add-form"|\.add-form\b|showAddInput|handleAddSymbol\b/);
      assert.doesNotMatch(content, /showAddSectionModal|handleAddSectionSubmit\b/);
    });

    test('Menghapus state, efek, cabang markup, dan CSS omni-search lokal dari WatchlistTab', () => {
      assert.doesNotMatch(
        content,
        /\b(searchQuery|exchangeSearchResults|isSearchingExchange|selectedOmniIndex|searchDebounceTimer|handleSearchKeyDown|handleAddSymbolFromExchange|filteredSymbols)\b/
      );
      assert.doesNotMatch(content, /omni-section-header|omni-empty|btn-open-global-search|add-exchange-btn/);
      assert.doesNotMatch(content, /\bonOpenSymbolSearch\b/);
    });

    test('Menghapus impor ikon dan utilitas yang tidak lagi dipakai di WatchlistTab', () => {
      const lucideImportMatch = content.match(/import\s*\{[\s\S]*?\}\s*from\s*'@lucide\/svelte';/);
      assert.ok(lucideImportMatch, 'WatchlistTab harus tetap mengimpor ikon yang masih dipakai dari @lucide/svelte');
      assert.doesNotMatch(
        lucideImportMatch[0],
        /\b(Plus|Search|Globe|Loader2|FolderPlus)\b/,
        'Ikon mati (Plus, Search, Globe, Loader2, FolderPlus) harus dihapus dari impor @lucide/svelte'
      );
    });

    test('Memperbarui salinan empty-state agar mengarahkan ke tombol Bintang di Header atau Ctrl+K', () => {
      assert.doesNotMatch(content, /tombol \+ di atas/);
      assert.match(
        content,
        /class="empty-state"[\s\S]*?Bintang[\s\S]*?Header[\s\S]*?Ctrl\+K/,
        'Empty-state harus mengarahkan pengguna ke tombol Bintang di Header atau Ctrl+K'
      );
    });

    test('Mempertahankan WatchlistSwitcher, kontrol Section Divider, pindah kategori, drag-and-drop, dan SymbolLogo', () => {
      assert.match(content, /<WatchlistSwitcher\b/);
      assert.match(content, /groupedSections/);
      assert.match(content, /handleToggleSectionCollapse/);
      assert.match(content, /openRenameSection/);
      assert.match(content, /showRenameSectionModal/);
      assert.match(content, /handleDeleteSection/);
      assert.match(content, /moveItemToSection/);
      assert.match(content, /reorderWatchlistItems/);
      assert.match(content, /<SymbolLogo\b/);
    });
  });

  describe('2. Kontrak WatchlistPanel.svelte: Hapus modal SymbolSearchModal cadangan & prop onOpenSymbolSearch', () => {
    const panelContent = fs.readFileSync(watchlistPanelPath, 'utf-8');

    test('Menghapus impor dan instance SymbolSearchModal beserta state isSymbolSearchOpen & handleToggleSymbolFromSearch', () => {
      assert.doesNotMatch(panelContent, /SymbolSearchModal/);
      assert.doesNotMatch(panelContent, /\b(isSymbolSearchOpen|handleToggleSymbolFromSearch)\b/);
    });

    test('Menghapus prop onOpenSymbolSearch dari Props, destructuring, dan penerusan ke WatchlistTab', () => {
      assert.doesNotMatch(panelContent, /\bonOpenSymbolSearch\b/);
    });

    test('Menghapus impor watchlistUtils yang menjadi mati sambil mempertahankan isSectionToken', () => {
      assert.doesNotMatch(
        panelContent,
        /\b(parseWatchlistEntry|formatWatchlistEntry|insertSymbolIntoSection|WatchlistSectionToken)\b/
      );
      assert.match(panelContent, /\bisSectionToken\b/);
    });

    test('Mempertahankan WatchlistTab, AlertsTab, LayersTab, TradePlanTab, applyWatchlistUpdate, dan watchlistRegistry', () => {
      assert.match(panelContent, /<WatchlistTab\b/);
      assert.match(panelContent, /<AlertsTab\b/);
      assert.match(panelContent, /<LayersTab\b/);
      assert.match(panelContent, /<TradePlanTab\b/);
      assert.match(panelContent, /applyWatchlistUpdate/);
      assert.match(panelContent, /watchlistRegistry/);
      assert.match(panelContent, /lastActiveSectionId/);
      assert.match(panelContent, /onRequestCreateAlert/);
    });
  });

  describe('3. Kontrak +page.svelte: Hapus onOpenSymbolSearch dari WatchlistPanel & pertahankan pencarian global', () => {
    const pageContent = fs.readFileSync(pagePath, 'utf-8');

    test('Pemanggilan <WatchlistPanel> tidak lagi meneruskan prop onOpenSymbolSearch namun mempertahankan {watchlistSymbols}', () => {
      const panelInvocation = pageContent.match(/<WatchlistPanel\b[\s\S]*?\n\s*\/>/);
      assert.ok(panelInvocation, '<WatchlistPanel> harus dirender di +page.svelte');
      assert.doesNotMatch(
        panelInvocation[0],
        /\bonOpenSymbolSearch\b/,
        '<WatchlistPanel> tidak boleh menerima prop onOpenSymbolSearch'
      );
      assert.match(panelInvocation[0], /\{watchlistSymbols\}/);
      assert.match(panelInvocation[0], /onSelectSymbol=/);
      assert.match(panelInvocation[0], /onWatchlistChange=/);
    });

    test('Mempertahankan pencarian pair global terpusat via SymbolSearchModal, Ctrl+K, Header, dan Type-to-Search Canvas Guard', () => {
      assert.match(pageContent, /<SymbolSearchModal\b/);
      assert.match(pageContent, /commandDispatcher\.bindHandler\('search-symbol'/);
      assert.match(pageContent, /commandDispatcher\.onTypeToSearch/);
      const headerInvocation = pageContent.match(/<Header\b[\s\S]*?\n\s*\/>/);
      assert.ok(headerInvocation, '<Header> harus dirender di +page.svelte');
      assert.match(headerInvocation[0], /\bonOpenSymbolSearch=/);
    });
  });
});
