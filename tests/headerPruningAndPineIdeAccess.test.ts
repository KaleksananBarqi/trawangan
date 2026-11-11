// Kontrak Struktural & Seam Verification untuk Tiket #165:
// Header Chrome Pruning, ActionsMenu Alert Removal, HelpTab Copy, dan Akses Pine IDE
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultCommandDispatcher } from '../src/lib/services/commandDispatcher';
import { PersistenceService } from '../src/lib/services/persistence/index';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Tiket #165: Header Chrome Pruning, ActionsMenu, HelpTab & Pelestarian Pine IDE', () => {
  describe('1. Header Chrome Pruning & Pelestarian Kontrol Inti (Header.svelte & +page.svelte)', () => {
    test('Header.svelte menghapus badge version-tag, mode-switcher Terminal|Pine IDE, dan tombol Fullscreen', () => {
      const headerContent = readProjectFile('src/lib/components/Header.svelte');

      // Badge label dekoratif "terminal" dan CSS-nya harus dihapus
      assert.doesNotMatch(headerContent, /class="version-tag"/);
      assert.doesNotMatch(headerContent, /\.version-tag\s*\{/);

      // Grup switcher Terminal | Pine IDE dan CSS-nya harus dihapus
      assert.doesNotMatch(headerContent, /class="mode-switcher"/);
      assert.doesNotMatch(headerContent, /\.mode-switcher\s*\{/);
      assert.doesNotMatch(headerContent, /\.mode-btn\b/);

      // Tombol Fullscreen dan handler lokal toggleFullscreen harus dihapus
      assert.doesNotMatch(headerContent, /function\s+toggleFullscreen\b/);
      assert.doesNotMatch(headerContent, /Toggle Layar Penuh/);
      assert.doesNotMatch(headerContent, /<Maximize2\b/);

      // Brand badge utama dan divider tetap terjaga
      assert.match(headerContent, /class="brand-badge"/);
      assert.match(headerContent, /class="brand-title">trawangan<\/span>/);
    });

    test('Header.svelte menghapus props mati, impor ikon tak terpakai, dan aturan CSS symbol-section duplikat sambil menjaga .active-sym-title', () => {
      const headerContent = readProjectFile('src/lib/components/Header.svelte');

      // Impor ikon dan tipe yang tidak lagi dipakai di Header
      assert.doesNotMatch(headerContent, /\bWorkspaceMode\b/);
      assert.doesNotMatch(headerContent, /\bActivity\b/);
      assert.doesNotMatch(headerContent, /\bCode\b/);
      assert.doesNotMatch(headerContent, /\bSearch\b/);
      assert.doesNotMatch(headerContent, /\bBell\b/);
      assert.doesNotMatch(headerContent, /\bFlame\b/);
      assert.doesNotMatch(headerContent, /\bMaximize2\b/);

      // Props mati peninggalan switcher/watchlist/alert di Header
      assert.doesNotMatch(headerContent, /\bworkspaceMode\??:/);
      assert.doesNotMatch(headerContent, /\bisWatchlistOpen\??:/);
      assert.doesNotMatch(headerContent, /\bonSymbolChange\??:/);
      assert.doesNotMatch(headerContent, /\bonWorkspaceModeChange\??:/);
      assert.doesNotMatch(headerContent, /\bonToggleWatchlist\??:/);
      assert.doesNotMatch(headerContent, /\bonRequestCreateAlert\??:/);
      assert.doesNotMatch(headerContent, /\bticker\??:/);

      // Tidak ada duplikasi aturan CSS .symbol-section atau selector mati .search-icon/.provider-pill
      const symbolSectionMatches = headerContent.match(/\.symbol-section\s*\{/g) ?? [];
      assert.equal(symbolSectionMatches.length, 1, 'Harus hanya ada satu definisi CSS .symbol-section');
      const symbolBadgeMatches = headerContent.match(/\.symbol-badge-btn\s*\{/g) ?? [];
      assert.equal(symbolBadgeMatches.length, 1, 'Harus hanya ada satu definisi CSS .symbol-badge-btn');
      assert.doesNotMatch(headerContent, /\.search-icon\s*\{/);
      assert.doesNotMatch(headerContent, /\.provider-pill\s*\{/);

      // KRITIS: .active-sym-title dan kontrol indikator/tema tetap dipertahankan
      assert.match(headerContent, /\.active-sym-title\s*\{/, 'CSS .active-sym-title harus tetap dipertahankan');
      assert.match(headerContent, /\bactiveIndicators\??:/);
      assert.match(headerContent, /\bonOpenIndicatorModal:/);
      assert.match(headerContent, /class="action-btn indicator-header-btn/);
      assert.match(headerContent, /color-mode-btn/);
    });

    test('+page.svelte tidak meneruskan props yang dihapus ke <Header> sambil tetap menjaga activeIndicators & onOpenIndicatorModal', () => {
      const pageContent = readProjectFile('src/routes/+page.svelte');
      const headerCallMatch = pageContent.match(/<Header[\s\S]*?\/>/);
      assert.ok(headerCallMatch, '<Header ... /> harus ditemukan di +page.svelte');
      const headerCall = headerCallMatch[0];

      assert.doesNotMatch(headerCall, /\{ticker\}/);
      assert.doesNotMatch(headerCall, /\{workspaceMode\}/);
      assert.doesNotMatch(headerCall, /onSymbolChange=/);
      assert.doesNotMatch(headerCall, /onWorkspaceModeChange=/);
      assert.doesNotMatch(headerCall, /onRequestCreateAlert=/);

      // Tetap diteruskan untuk tombol Indikator header
      assert.match(headerCall, /\{activeIndicators\}/);
      assert.match(headerCall, /onOpenIndicatorModal=/);
    });
  });

  describe('2. ActionsMenu Pruning & Retensi Kontrol Analisis (ActionsMenu.svelte & Header.svelte)', () => {
    test('ActionsMenu.svelte menghapus tombol "Buat Price Alert", props mati, impor ikon mati, dan CSS tak terpakai', () => {
      const menuContent = readProjectFile('src/lib/components/header/ActionsMenu.svelte');

      // Sub-item Buat Price Alert dan ikon Bell/Check dihapus
      assert.doesNotMatch(menuContent, /Buat Price Alert/);
      assert.doesNotMatch(menuContent, /\bBell\b/);
      assert.doesNotMatch(menuContent, /\bCheck\b/);
      assert.doesNotMatch(menuContent, /\bAlert,/);

      // Props & state mati dihapus
      assert.doesNotMatch(menuContent, /\bactiveIndicators\b/);
      assert.doesNotMatch(menuContent, /\bonOpenIndicatorModal\b/);
      assert.doesNotMatch(menuContent, /\bonRequestCreateAlert\b/);
      assert.doesNotMatch(menuContent, /\bactiveIndicatorCount\b/);

      // CSS selector mati dihapus
      assert.doesNotMatch(menuContent, /\.count-badge\s*\{/);
      assert.doesNotMatch(menuContent, /\.action-item-btn\.highlight\b/);
      assert.doesNotMatch(menuContent, /\.item-badge\s*\{/);
    });

    test('ActionsMenu.svelte mempertahankan Bar Replay, Toolbar Gambar, dan kelima toggle Sinkronisasi Multi-Chart', () => {
      const menuContent = readProjectFile('src/lib/components/header/ActionsMenu.svelte');

      assert.match(menuContent, /Bar Replay/);
      assert.match(menuContent, /Toolbar Gambar/);
      assert.match(menuContent, /SINKRONISASI MULTI-CHART/);
      assert.match(menuContent, /onToggleSyncCrosshair/);
      assert.match(menuContent, /onToggleSyncViewport/);
      assert.match(menuContent, /onToggleSyncSymbol/);
      assert.match(menuContent, /onToggleSyncDrawings/);
      assert.match(menuContent, /onToggleSyncIndicators/);
    });

    test('Header.svelte tidak meneruskan activeIndicators, onOpenIndicatorModal, atau onRequestCreateAlert ke <ActionsMenu>', () => {
      const headerContent = readProjectFile('src/lib/components/Header.svelte');
      const actionsMenuCallMatch = headerContent.match(/<ActionsMenu[\s\S]*?\/>/);
      assert.ok(actionsMenuCallMatch, '<ActionsMenu ... /> harus ditemukan di Header.svelte');
      const actionsMenuCall = actionsMenuCallMatch[0];

      assert.doesNotMatch(actionsMenuCall, /\{activeIndicators\}/);
      assert.doesNotMatch(actionsMenuCall, /\{onOpenIndicatorModal\}/);
      assert.doesNotMatch(actionsMenuCall, /\{onRequestCreateAlert\}/);
    });
  });

  describe('3. Pembaruan Panduan Pine Script v6 IDE di HelpTab (HelpTab.svelte)', () => {
    test('HelpTab.svelte mengarahkan pengguna ke Right Dock Rail (<>), Library Indikator, Unified Object Tree, dan Alt+E alih-alih header kiri atas', () => {
      const helpContent = readProjectFile('src/lib/components/settings/HelpTab.svelte');

      // Tidak lagi merujuk switcher header kiri atas yang sudah dihapus
      assert.doesNotMatch(helpContent, /di header kiri atas/i);

      // Merujuk seluruh jalur akses Pine IDE yang dipertahankan
      assert.match(helpContent, /Right Dock Rail/);
      assert.match(helpContent, /&lt;&gt;|<>/);
      assert.match(helpContent, /Library Indikator/);
      assert.match(helpContent, /Unified Object Tree/);
      assert.match(helpContent, /Alt\+E/);

      // Kartu Draw by Holding tetap utuh
      assert.match(helpContent, /Draw by Holding \(Gesture Engine\)/);
    });
  });

  describe('4. Pelestarian Pine Script v6 IDE, Penyimpanan Skrip SQLite, dan Pintasan Keyboard (F11, Alt+A, Alt+E)', () => {
    test('Jalur akses Pine IDE tetap utuh di RightDockRail, IndicatorModal, LayersTab, dan +page.svelte', () => {
      const dockContent = readProjectFile('src/lib/components/RightDockRail.svelte');
      assert.match(dockContent, /onTogglePineMode\?\.\(\)/);
      assert.match(dockContent, /<Code\b/);

      const indicatorModalContent = readProjectFile('src/lib/components/IndicatorModal.svelte');
      assert.match(indicatorModalContent, /\+ Buat Skrip Baru/);
      assert.match(indicatorModalContent, /SKRIP SAYA/);
      assert.match(indicatorModalContent, /Edit di IDE/);
      assert.match(indicatorModalContent, /onOpenInEditor/);

      const layersTabContent = readProjectFile('src/lib/components/right-dock/LayersTab.svelte');
      assert.match(layersTabContent, /onOpenIndicatorInPine\?\.\(/);
      assert.match(layersTabContent, /<Code\b/);

      const pageContent = readProjectFile('src/routes/+page.svelte');
      assert.match(pageContent, /<PineEditor\b/);
      assert.match(pageContent, /onTogglePineMode=\{\(\) => \{\s*handleWorkspaceModeChange\(/);
      assert.match(pageContent, /bindHandler\('toggle-pine-editor'/);
      assert.match(pageContent, /bindHandler\('fullscreen-toggle'/);
      assert.match(pageContent, /bindHandler\('create-alert-cursor'/);
    });

    test('CommandDispatcher tetap mengeksekusi F11 (fullscreen-toggle), Alt+A (create-alert-cursor), dan Alt+E (toggle-pine-editor)', () => {
      const dispatcher = createDefaultCommandDispatcher();
      const fired: string[] = [];

      dispatcher.bindHandler('fullscreen-toggle', () => {
        fired.push('fullscreen-toggle');
      });
      dispatcher.bindHandler('create-alert-cursor', () => {
        fired.push('create-alert-cursor');
      });
      dispatcher.bindHandler('toggle-pine-editor', () => {
        fired.push('toggle-pine-editor');
      });

      const makeEvent = (overrides: Record<string, unknown>) =>
        ({
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          shiftKey: false,
          target: { tagName: 'CANVAS', isContentEditable: false, closest: () => null },
          preventDefault: () => {},
          stopPropagation: () => {},
          ...overrides,
        }) as unknown as KeyboardEvent;

      assert.equal(dispatcher.dispatch(makeEvent({ key: 'F11', code: 'F11' })), true);
      assert.equal(dispatcher.dispatch(makeEvent({ altKey: true, key: 'a', code: 'KeyA' })), true);
      assert.equal(dispatcher.dispatch(makeEvent({ altKey: true, key: 'e', code: 'KeyE' })), true);

      assert.deepEqual(fired, [
        'fullscreen-toggle',
        'create-alert-cursor',
        'toggle-pine-editor',
      ]);
    });

    test('Persistensi skrip Pine (PersistenceService & adapter SQLite Tauri) tetap berfungsi penuh', async () => {
      const adapter = new InMemoryLocalStorageAdapter();
      adapter.clearMemory();
      const service = new PersistenceService(adapter);

      await service.saveScript({
        id: 'pine_test_165',
        title: 'Pine IDE Continuity Check',
        code: '//@version=6\nindicator("Continuity")',
        is_overlay: true,
        created_at: 1000,
        updated_at: 2000,
      });

      const scripts = await service.loadScripts();
      assert.equal(scripts.length, 1);
      assert.equal(scripts[0].id, 'pine_test_165');

      const sqliteAdapterContent = readProjectFile('src/lib/services/persistence/tauriSqliteAdapter.ts');
      assert.match(sqliteAdapterContent, /get_saved_scripts/);
      assert.match(sqliteAdapterContent, /save_script/);
    });
  });

  describe('5. Dokumentasi Domain: Amandemen ADR-0004 (Spec #164, #165, #168)', () => {
    test('ADR-0004 memuat catatan Amandemen pemangkasan switcher Header, pelestarian Pine IDE, & rebalance telemetri StatusBar', () => {
      const adr0004 = readProjectFile('docs/adr/0004-docked-structural-shell-and-side-by-side-ide.md');
      assert.match(adr0004, />\s*\*\*Amandemen \(Spec #164, #165, #168\):\*\*/);
      assert.match(adr0004, /Terminal \| Pine IDE/);
      assert.match(adr0004, /Persistent Side-by-Side Pine IDE/);
      assert.match(adr0004, /Right Dock Rail/);
      assert.match(adr0004, /Unified Object Tree/);
      assert.match(adr0004, /Alt\+E/);
      assert.match(adr0004, /FPS/);
      assert.match(adr0004, /Ping/);
      assert.match(adr0004, /RAM/);
    });
  });
});
