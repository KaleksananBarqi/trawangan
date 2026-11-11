// Pengujian Kontrak Struktural & Seam Verification untuk Tiket #170:
// Pembersihan Komponen Header Yatim dan Persistensi Mati QuickSymbolsConfig
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as persistenceModule from '../src/lib/services/persistence/index';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';

const rootDir = process.cwd();

function resolveProjectPath(relativePath: string): string {
  return path.resolve(rootDir, relativePath);
}

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(resolveProjectPath(relativePath), 'utf8');
}

describe('Tiket #170: Pembersihan Komponen Header Yatim & QuickSymbolsConfig', () => {
  describe('1. Penghapusan Komponen Header Yatim & Retensi WorkspaceLayoutMenu', () => {
    test('File komponen header yatim (WorkspaceMenu, LayoutGridSelector, QuickSymbolsDropdown) telah dihapus', () => {
      const orphanFiles = [
        'src/lib/components/header/WorkspaceMenu.svelte',
        'src/lib/components/header/LayoutGridSelector.svelte',
        'src/lib/components/header/QuickSymbolsDropdown.svelte',
      ];

      for (const file of orphanFiles) {
        assert.equal(
          fs.existsSync(resolveProjectPath(file)),
          false,
          `Komponen yatim ${file} harus sudah dihapus dari codebase`
        );
      }
    });

    test('Komponen aktif WorkspaceLayoutMenu.svelte tetap ada dan digunakan di Header.svelte', () => {
      const layoutMenuPath = 'src/lib/components/header/WorkspaceLayoutMenu.svelte';
      assert.equal(
        fs.existsSync(resolveProjectPath(layoutMenuPath)),
        true,
        'WorkspaceLayoutMenu.svelte adalah komponen aktif dan tidak boleh dihapus'
      );

      const headerContent = readProjectFile('src/lib/components/Header.svelte');
      assert.match(headerContent, /import\s+WorkspaceLayoutMenu\s+from\s+'\.\/header\/WorkspaceLayoutMenu\.svelte'/);
      assert.match(headerContent, /<WorkspaceLayoutMenu\b/);
    });
  });

  describe('2. Penghapusan Kontrak QuickSymbolsConfig & API Persistensi Mati', () => {
    test('Seam modul persistence tidak lagi mengekspor DEFAULT_QUICK_SYMBOLS_CONFIG atau load/saveQuickSymbolsConfig', () => {
      assert.equal('DEFAULT_QUICK_SYMBOLS_CONFIG' in persistenceModule, false);
      assert.equal('loadQuickSymbolsConfig' in persistenceModule, false);
      assert.equal('saveQuickSymbolsConfig' in persistenceModule, false);

      const service = new persistenceModule.PersistenceService(new InMemoryLocalStorageAdapter());
      assert.equal('loadQuickSymbolsConfig' in service, false);
      assert.equal('saveQuickSymbolsConfig' in service, false);

      // Pastikan kontrak persistensi aktif tetap tersedia
      assert.equal(typeof service.loadWatchlist, 'function');
      assert.equal(typeof service.saveWatchlist, 'function');
      assert.equal(typeof service.loadWorkspaces, 'function');
      assert.equal(typeof service.loadSettings, 'function');
    });

    test('market.ts, persistence/types.ts, persistence/index.ts, dan adapter bebas dari simbol QuickSymbolsConfig mati', () => {
      const targetFiles = [
        'src/lib/types/market.ts',
        'src/lib/services/persistence/types.ts',
        'src/lib/services/persistence/index.ts',
        'src/lib/services/persistence/inMemoryLocalStorageAdapter.ts',
        'src/lib/services/persistence/tauriSqliteAdapter.ts',
      ];

      for (const file of targetFiles) {
        const content = readProjectFile(file);
        assert.doesNotMatch(
          content,
          /\b(QuickSymbolsConfig|DEFAULT_QUICK_SYMBOLS_CONFIG|loadQuickSymbolsConfig|saveQuickSymbolsConfig|user_quick_symbols_config)\b/,
          `File ${file} masih mengandung referensi mati QuickSymbolsConfig`
        );
      }
    });
  });

  describe('3. Pembersihan Props/State Mati di Header.svelte & +page.svelte sambil Menjaga watchlistSymbols Aktif', () => {
    test('Header.svelte tidak lagi mendeklarasikan props legacy watchlistSymbols, quickSymbolsConfig, atau onQuickSymbolsConfigChange', () => {
      const headerContent = readProjectFile('src/lib/components/Header.svelte');

      assert.doesNotMatch(headerContent, /\bwatchlistSymbols\b/);
      assert.doesNotMatch(headerContent, /\bquickSymbolsConfig\b/);
      assert.doesNotMatch(headerContent, /\bonQuickSymbolsConfigChange\b/);
      assert.doesNotMatch(headerContent, /\b(WorkspaceMenu|LayoutGridSelector|QuickSymbolsDropdown)\b/);

      assert.match(headerContent, /<WorkspaceLayoutMenu\b/);
      assert.match(headerContent, /<ActionsMenu\b/);
      assert.match(headerContent, /<TimeframeSelector\b/);
      assert.match(headerContent, /<SnapshotMenu\b/);
      assert.match(headerContent, /<SymbolLogo\b/);
    });

    test('+page.svelte menghapus quickSymbolsConfig & binding <Header> sambil mempertahankan watchlistSymbols di WatchlistPanel, SymbolSearchModal, dan CreateAlertModal', () => {
      const pageContent = readProjectFile('src/routes/+page.svelte');

      assert.doesNotMatch(
        pageContent,
        /\b(QuickSymbolsConfig|DEFAULT_QUICK_SYMBOLS_CONFIG|loadQuickSymbolsConfig|saveQuickSymbolsConfig|quickSymbolsConfig|handleQuickSymbolsConfigChange)\b/
      );

      const headerCallMatch = pageContent.match(/<Header\b[\s\S]*?\n\s*\/>/);
      assert.ok(headerCallMatch, '<Header ... /> harus ditemukan di +page.svelte');
      assert.doesNotMatch(headerCallMatch[0], /\{watchlistSymbols\}/);
      assert.doesNotMatch(headerCallMatch[0], /\{quickSymbolsConfig\}/);
      assert.doesNotMatch(headerCallMatch[0], /onQuickSymbolsConfigChange=/);

      // Pastikan state watchlistSymbols aktif dan wiring ke komponen aktif tetap terjaga
      assert.match(pageContent, /let\s+watchlistSymbols\s*=\s*\$state<string\[\]>/);

      const watchlistPanelCall = pageContent.match(/<WatchlistPanel\b[\s\S]*?\n\s*\/>/);
      assert.ok(watchlistPanelCall, '<WatchlistPanel ... /> harus ditemukan di +page.svelte');
      assert.match(watchlistPanelCall[0], /\{watchlistSymbols\}/);

      const symbolSearchCall = pageContent.match(/<SymbolSearchModal\b[\s\S]*?\n\s*\/>/);
      assert.ok(symbolSearchCall, '<SymbolSearchModal ... /> harus ditemukan di +page.svelte');
      assert.match(symbolSearchCall[0], /\{watchlistSymbols\}/);

      const createAlertCall = pageContent.match(/<CreateAlertModal\b[\s\S]*?\n\s*\/>/);
      assert.ok(createAlertCall, '<CreateAlertModal ... /> harus ditemukan di +page.svelte');
      assert.match(createAlertCall[0], /availableSymbols=\{watchlistSymbols\}/);
    });
  });
});
