// Kontrak Struktural & Seam Verification untuk Tiket #166:
// Tombol Bintang 1-Klik Watchlist di Header, Integrasi SymbolSearchModal, & +page.svelte
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Tiket #166: Tombol Bintang Quick Watchlist di Header & Konsolidasi Seam', () => {
  describe('1. Kontrak Header.svelte: Tombol Bintang (.watchlist-star-btn) di grup simbol', () => {
    const headerContent = readProjectFile('src/lib/components/Header.svelte');

    test('Header.svelte mengimpor ikon Star dan mendeklarasikan prop isWatchlisted serta onToggleActiveWatchlist', () => {
      const lucideImport = headerContent.match(/import\s*\{[\s\S]*?\}\s*from\s*'@lucide\/svelte';/);
      assert.ok(lucideImport, 'Header harus memiliki impor dari @lucide/svelte');
      assert.match(lucideImport[0], /\bStar\b/, 'Header harus mengimpor ikon Star');

      assert.match(headerContent, /\bisWatchlisted\??:\s*boolean/);
      assert.match(headerContent, /\bonToggleActiveWatchlist\??:\s*\(\)\s*=>\s*void/);
      assert.match(headerContent, /isWatchlisted\s*=\s*false/);
    });

    test('Tombol .watchlist-star-btn ditempatkan tepat di antara .symbol-badge-btn dan .provider-dropdown-container', () => {
      const symbolSectionMatch = headerContent.match(
        /<div class="symbol-section">([\s\S]*?)<\/div>\s*\n\s*<div class="divider"><\/div>/
      );
      assert.ok(symbolSectionMatch, 'Blok .symbol-section harus ditemukan di Header.svelte');
      const symbolSection = symbolSectionMatch[1];

      const badgeBtnEnd = symbolSection.indexOf('</button>');
      const starBtnIdx = symbolSection.indexOf('watchlist-star-btn');
      const providerDropdownIdx = symbolSection.indexOf('provider-dropdown-container');

      assert.notEqual(badgeBtnEnd, -1, '.symbol-badge-btn harus ditemukan');
      assert.notEqual(starBtnIdx, -1, '.watchlist-star-btn harus dirender di dalam .symbol-section');
      assert.notEqual(providerDropdownIdx, -1, '.provider-dropdown-container harus ditemukan');
      assert.ok(
        badgeBtnEnd < starBtnIdx && starBtnIdx < providerDropdownIdx,
        '.watchlist-star-btn harus berada di antara .symbol-badge-btn dan .provider-dropdown-container'
      );
    });

    test('Tombol .watchlist-star-btn memiliki aria-pressed, tooltip dinamis, fill Star reaktif, dan memanggil onToggleActiveWatchlist', () => {
      assert.match(headerContent, /class="watchlist-star-btn\s*\{isWatchlisted\s*\?\s*'active'\s*:\s*''\}"/);
      assert.match(headerContent, /aria-pressed=\{isWatchlisted\}/);
      assert.match(headerContent, /Hapus dari Watchlist Aktif/);
      assert.match(headerContent, /Tambahkan ke Watchlist Aktif/);
      assert.match(headerContent, /onToggleActiveWatchlist\?\.\(\)/);
      assert.match(headerContent, /<Star\b[^>]*fill=\{isWatchlisted\s*\?\s*'currentColor'\s*:\s*'none'\}/);

      // CSS .watchlist-star-btn dan .watchlist-star-btn.active tersedia
      assert.match(headerContent, /\.watchlist-star-btn\s*\{/);
      assert.match(headerContent, /\.watchlist-star-btn\.active\s*\{/);
    });
  });

  describe('2. Kontrak +page.svelte: State reaktif, handler toggle tanpa paksa dock kanan, & konsolidasi modal', () => {
    const pageContent = readProjectFile('src/routes/+page.svelte');

    test('+page.svelte mengimpor isSymbolInWatchlist & toggleSymbolInWatchlist dan menurunkan isActiveSymbolWatchlisted', () => {
      const utilsImportMatch = pageContent.match(
        /import\s*\{([^}]+)\}\s*from\s*'\.\.\/lib\/services\/watchlistUtils';/
      );
      assert.ok(utilsImportMatch, 'Impor watchlistUtils harus ditemukan di +page.svelte');
      assert.match(utilsImportMatch[1], /\bisSymbolInWatchlist\b/);
      assert.match(utilsImportMatch[1], /\btoggleSymbolInWatchlist\b/);
      assert.match(utilsImportMatch[1], /\bisSectionToken\b/);
      assert.doesNotMatch(utilsImportMatch[1], /\bparseWatchlistEntry\b/);
      assert.doesNotMatch(utilsImportMatch[1], /\bformatWatchlistEntry\b/);
      assert.doesNotMatch(utilsImportMatch[1], /\binsertSymbolIntoSection\b/);

      assert.match(
        pageContent,
        /isActiveSymbolWatchlisted\s*=\s*\$derived\(\s*isSymbolInWatchlist\(\s*watchlistSymbols,\s*activeSymbol,\s*activeProviderId\s*\)\s*\)/
      );
    });

    test('handleToggleActiveWatchlist menyimpan via watchlistRegistry.updateActiveItems, menulis Terminal Logs, dan tidak menyentuh workspaceShellService', () => {
      const fnMatch = pageContent.match(
        /async function handleToggleActiveWatchlist\(\)\s*\{([\s\S]*?)\n  \}/
      );
      assert.ok(fnMatch, 'Fungsi handleToggleActiveWatchlist harus didefinisikan di +page.svelte');
      const fnBody = fnMatch[1];

      assert.match(fnBody, /toggleSymbolInWatchlist\(\s*watchlistSymbols,\s*activeSymbol,\s*activeProviderId\s*\)/);
      assert.match(fnBody, /handleWatchlistChange\(/);
      assert.match(fnBody, /watchlistRegistry\.updateActiveItems\(/);
      assert.match(fnBody, /addSystemLog\(/);
      assert.doesNotMatch(
        fnBody,
        /workspaceShellService/,
        'handleToggleActiveWatchlist tidak boleh membuka atau menutup Right Dock Panel'
      );
    });

    test('handleToggleWatchlistSymbolFromSearch memakai seam toggleSymbolInWatchlist dan memperbarui watchlistRegistry', () => {
      const fnMatch = pageContent.match(
        /async function handleToggleWatchlistSymbolFromSearch\([^)]*\)\s*\{([\s\S]*?)\n  \}/
      );
      assert.ok(fnMatch, 'Fungsi handleToggleWatchlistSymbolFromSearch harus ditemukan di +page.svelte');
      const fnBody = fnMatch[1];

      assert.match(fnBody, /toggleSymbolInWatchlist\(/);
      assert.match(fnBody, /watchlistRegistry\.updateActiveItems\(/);
      assert.match(fnBody, /addSystemLog\(/);
    });

    test('<Header> di +page.svelte menerima isWatchlisted={isActiveSymbolWatchlisted} dan onToggleActiveWatchlist={handleToggleActiveWatchlist}', () => {
      const headerInvocation = pageContent.match(/<Header\b[\s\S]*?\n\s*\/>/);
      assert.ok(headerInvocation, '<Header ... /> harus ditemukan di +page.svelte');
      assert.match(headerInvocation[0], /isWatchlisted=\{isActiveSymbolWatchlisted\}/);
      assert.match(headerInvocation[0], /onToggleActiveWatchlist=\{handleToggleActiveWatchlist\}/);
    });
  });

  describe('3. Kontrak SymbolSearchModal.svelte: Memakai isSymbolInWatchlist dari WatchlistUtils', () => {
    const modalContent = readProjectFile('src/lib/components/SymbolSearchModal.svelte');

    test('SymbolSearchModal.svelte memakai isSymbolInWatchlist dan membersihkan impor parseWatchlistEntry/normalizeProviderId yang mati', () => {
      const utilsImportMatch = modalContent.match(
        /import\s*\{([^}]+)\}\s*from\s*'\.\.\/services\/watchlistUtils';/
      );
      assert.ok(utilsImportMatch, 'Impor watchlistUtils harus ditemukan di SymbolSearchModal.svelte');
      assert.match(utilsImportMatch[1], /\bisSymbolInWatchlist\b/);
      assert.match(utilsImportMatch[1], /\bformatWatchlistEntry\b/);
      assert.doesNotMatch(utilsImportMatch[1], /\bparseWatchlistEntry\b/);
      assert.doesNotMatch(utilsImportMatch[1], /\bnormalizeProviderId\b/);

      assert.match(
        modalContent,
        /\{@const\s+isWatchlisted\s*=\s*isSymbolInWatchlist\(\s*watchlistSymbols,\s*item\.symbol,\s*item\.provider\s*\)\}/
      );
    });
  });
});
