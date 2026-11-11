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

    test('Menghapus hook spekulatif mati lastActiveSectionId, onSelectSectionId, dan getSectionIdForSymbol sambil mempertahankan menu kategori koin', () => {
      assert.doesNotMatch(
        content,
        /\b(lastActiveSectionId|onSelectSectionId|getSectionIdForSymbol)\b/,
        'Hook mati lastActiveSectionId/onSelectSectionId/getSectionIdForSymbol harus dihapus dari WatchlistTab'
      );
      assert.match(content, /const\s+currentSecId\s*=\s*group\.section\?\.id\s*\?\?\s*null/);
    });

    test('handleRemoveSymbol memakai helper bersama removeSymbolFromWatchlist tanpa duplikasi pencocokan parseWatchlistEntry', () => {
      assert.match(content, /\bremoveSymbolFromWatchlist\b/);
      const removeFnMatch = content.match(
        /async function handleRemoveSymbol\([^)]*\)\s*\{([\s\S]*?)\n  \}/
      );
      assert.ok(removeFnMatch, 'Fungsi handleRemoveSymbol harus ditemukan di WatchlistTab.svelte');
      assert.match(removeFnMatch[1], /removeSymbolFromWatchlist\(\s*symbols,\s*rawEntry\s*\)/);
      assert.doesNotMatch(removeFnMatch[1], /parseWatchlistEntry/);
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

    test('Mempertahankan WatchlistTab, AlertsTab, LayersTab, TradePlanTab, applyWatchlistUpdate, dan watchlistRegistry tanpa prop mati lastActiveSectionId/onSelectSectionId', () => {
      assert.doesNotMatch(
        panelContent,
        /\b(lastActiveSectionId|onSelectSectionId)\b/,
        'WatchlistPanel tidak boleh menyimpan atau meneruskan hook mati lastActiveSectionId/onSelectSectionId'
      );
      assert.match(panelContent, /<WatchlistTab\b/);
      assert.match(panelContent, /<AlertsTab\b/);
      assert.match(panelContent, /<LayersTab\b/);
      assert.match(panelContent, /<TradePlanTab\b/);
      assert.match(panelContent, /applyWatchlistUpdate/);
      assert.match(panelContent, /watchlistRegistry/);
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

  describe('4. Dokumentasi Domain: Deprekasi Omni-Search Watchlist di GLOSSARY.md', () => {
    test('GLOSSARY.md menandai Omni-Search Watchlist deprecated (Spec #164) dan merujuk Header, Ctrl+K, serta Type-to-Search Canvas Guard', () => {
      const glossary = fs.readFileSync(path.join(rootDir, 'GLOSSARY.md'), 'utf-8');
      const omniBlock =
        glossary.match(/\*\*Omni-Search Watchlist\*\*[\s\S]*?(?=\n\n\*\*)/)?.[0] ?? '';
      assert.ok(omniBlock.length > 0, 'Entri Omni-Search Watchlist harus tetap ada di GLOSSARY.md');
      assert.match(omniBlock, /DEPRECATED\s*\/\s*Dihapus.*Spec #164/i);
      assert.match(omniBlock, /\bHeader\b/);
      assert.match(omniBlock, /Ctrl\+K/);
      assert.match(omniBlock, /Type-to-Search Canvas Guard/);
    });
  });
});
