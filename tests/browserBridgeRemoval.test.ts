// Kontrak Pengujian Penghapusan Chart Deep Link Bridge, Userscript, & Smart Clipboard Watcher (#169)
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readRepoFile = (relPath: string): string =>
  readFileSync(resolve(process.cwd(), relPath), 'utf8');

describe('Penghapusan End-to-End Browser Bridge & Smart Clipboard Watcher (#169)', () => {
  test('1. Berkas modul bridge, userscript, panduan UI, dan tes usang telah dihapus sementara urlService tetap utuh', () => {
    const obsoletePaths = [
      'src/lib/services/clipboardWatcherService.ts',
      'src/lib/services/urlInterceptorService.ts',
      'src/lib/components/settings/BrowserBridgeGuide.svelte',
      'scripts/trawangan-browser-bridge.user.js',
      'tests/clipboardWatcherService.test.ts',
      'tests/urlInterceptorService.test.ts',
    ];

    for (const relPath of obsoletePaths) {
      assert.equal(
        existsSync(resolve(process.cwd(), relPath)),
        false,
        `Berkas usang seharusnya sudah dihapus: ${relPath}`
      );
    }

    // Pastikan peluncur tautan eksternal standar tetap dipertahankan untuk Buy Me Coffee dsb.
    assert.equal(existsSync(resolve(process.cwd(), 'src/lib/services/urlService.ts')), true);
    assert.equal(existsSync(resolve(process.cwd(), 'tests/urlService.test.ts')), true);

    const statusBarSrc = readRepoFile('src/lib/components/StatusBar.svelte');
    assert.match(statusBarSrc, /openExternalUrl/);
    assert.match(statusBarSrc, /Buy Me Coffee/);
  });

  test('2. SettingsModal memperbarui label tab system serta GeneralTab, SystemTab, dan HelpTab bersih dari Browser Bridge', () => {
    const settingsModalSrc = readRepoFile('src/lib/components/SettingsModal.svelte');
    assert.match(settingsModalSrc, /Sistem & Telemetri/);
    assert.doesNotMatch(settingsModalSrc, /Sistem & Skrip Browser/);
    assert.match(settingsModalSrc, /<SystemTab\s*\/>/);

    const generalTabSrc = readRepoFile('src/lib/components/settings/GeneralTab.svelte');
    assert.doesNotMatch(generalTabSrc, /Smart Clipboard Link Sentry/);
    assert.doesNotMatch(generalTabSrc, /clipboardWatcherEnabled/);
    assert.doesNotMatch(generalTabSrc, /clipboardAutoOpen/);
    assert.doesNotMatch(generalTabSrc, /bridge-tip-row/);
    assert.doesNotMatch(generalTabSrc, /Tampermonkey/);
    assert.doesNotMatch(generalTabSrc, /Sistem & Skrip Browser/);
    assert.doesNotMatch(generalTabSrc, /\bClipboardCheck\b|\bClipboard\b|\bExternalLink\b/);
    // Pastikan fitur non-bridge di GeneralTab tetap utuh
    assert.match(generalTabSrc, /Zona Waktu Chart/);
    assert.match(generalTabSrc, /Jam Bursa Dunia/);
    assert.match(generalTabSrc, /Notifikasi Sistem Windows/);
    assert.match(generalTabSrc, /openSnapshotFolder/);
    assert.match(generalTabSrc, /autoSaveWorkspace/);

    const systemTabSrc = readRepoFile('src/lib/components/settings/SystemTab.svelte');
    assert.doesNotMatch(systemTabSrc, /BrowserBridgeGuide/);
    assert.doesNotMatch(systemTabSrc, /\.bridge-header|\.copy-script-btn|\.tutorial-card|\.btn-test-link/);
    assert.match(systemTabSrc, /telemetryService/);
    assert.match(systemTabSrc, /Target Rendering/);

    const helpTabSrc = readRepoFile('src/lib/components/settings/HelpTab.svelte');
    assert.doesNotMatch(helpTabSrc, /BrowserBridgeGuide/);
    assert.match(helpTabSrc, /SHORTCUT_GLOSSARY/);
    assert.match(helpTabSrc, /Pine Script v6 IDE & Backtester/);
    assert.match(helpTabSrc, /Draw by Holding \(Gesture Engine\)/);
  });

  test('3. Halaman utama (+page.svelte) menghapus watcher clipboard, listener deep-link-received, handler, dan toast UI/CSS', () => {
    const pageSrc = readRepoFile('src/routes/+page.svelte');

    assert.doesNotMatch(pageSrc, /urlInterceptorService/);
    assert.doesNotMatch(pageSrc, /ClipboardWatcherService/);
    assert.doesNotMatch(pageSrc, /\bLink2\b/);
    assert.doesNotMatch(pageSrc, /detectedChartLink/);
    assert.doesNotMatch(pageSrc, /clipboardWatcher/);
    assert.doesNotMatch(pageSrc, /deep-link-received/);
    assert.doesNotMatch(pageSrc, /handleOpenDetectedChartLink/);
    assert.doesNotMatch(pageSrc, /clipboard-sentry-toast/);
    assert.doesNotMatch(pageSrc, /slideInToast/);

    // Pastikan komponen inti, keybinding, dan animasi console drawer tetap utuh
    assert.match(pageSrc, /<Header\b/);
    assert.match(pageSrc, /<WatchlistPanel\b/);
    assert.match(pageSrc, /<StatusBar\b/);
    assert.match(pageSrc, /commandDispatcher\.attachGlobalListener/);
    assert.match(pageSrc, /@keyframes slideUp/);
  });

  test('4. Backend Rust Tauri mencabut deep-link dan rust-ini sambil menjaga single_instance focus & unminimize', () => {
    const cargoToml = readRepoFile('src-tauri/Cargo.toml');
    assert.doesNotMatch(cargoToml, /tauri-plugin-deep-link/);
    assert.doesNotMatch(cargoToml, /rust-ini/);
    assert.match(cargoToml, /tauri-plugin-single-instance/);
    assert.match(cargoToml, /tauri-plugin-opener/);
    assert.match(cargoToml, /tauri-plugin-notification/);

    const tauriConf = JSON.parse(readRepoFile('src-tauri/tauri.conf.json'));
    assert.equal(tauriConf.productName, 'trawangan');
    assert.equal(tauriConf.plugins?.['deep-link'], undefined);
    assert.ok(Array.isArray(tauriConf.app?.windows));

    const libRs = readRepoFile('src-tauri/src/lib.rs');
    assert.doesNotMatch(libRs, /DeepLinkExt/);
    assert.doesNotMatch(libRs, /tauri_plugin_deep_link/);
    assert.doesNotMatch(libRs, /register_all/);
    assert.doesNotMatch(libRs, /deep-link-received/);
    assert.doesNotMatch(libRs, /trawangan:\/\//);
    assert.doesNotMatch(libRs, /\bEmitter\b/);

    // Pastikan perilaku single-instance focus & unminimize tetap terjaga ketat
    assert.match(libRs, /tauri_plugin_single_instance::init/);
    assert.match(libRs, /get_webview_window\("main"\)/);
    assert.match(libRs, /main_win\.set_focus\(\)/);
    assert.match(libRs, /main_win\.unminimize\(\)/);
  });

  test('5. Dokumentasi domain (GLOSSARY & ADR-0007) menandai Bridge/Watcher deprecated sambil mempertahankan Unified Object Tree', () => {
    const glossary = readRepoFile('GLOSSARY.md');
    // Unified Object Tree harus tetap aktif dan tidak diberi penanda deprecated
    const uotBlock = glossary.match(/\*\*Unified Object Tree\*\*:[\s\S]*?(?=\n\n\*\*)/)?.[0] ?? '';
    assert.ok(uotBlock.length > 0, 'Entri Unified Object Tree wajib tetap ada di GLOSSARY.md');
    assert.doesNotMatch(uotBlock, /DEPRECATED|Dihapus/i);

    // Chart Deep Link Bridge, Smart Clipboard Watcher, & Multi-Provider Fallback Routing ditandai deprecated/removed
    const bridgeBlock = glossary.match(/\*\*Chart Deep Link Bridge[\s\S]*?(?=\n\n\*\*)/)?.[0] ?? '';
    const watcherBlock = glossary.match(/\*\*Smart Clipboard Watcher[\s\S]*?(?=\n\n\*\*)/)?.[0] ?? '';
    const fallbackBlock = glossary.match(/\*\*Multi-Provider Fallback Routing[\s\S]*?(?=\n\n\*\*)/)?.[0] ?? '';
    assert.match(bridgeBlock, /DEPRECATED|Dihapus/i);
    assert.match(watcherBlock, /DEPRECATED|Dihapus/i);
    assert.match(fallbackBlock, /DEPRECATED|Dihapus/i);

    // ADR-0007 tetap ada dengan nama berkas yang ditautkan dari README.md
    assert.equal(
      existsSync(resolve(process.cwd(), 'docs/adr/0007-unified-object-tree-and-browser-deep-link-bridge.md')),
      true
    );
    const adr0007 = readRepoFile('docs/adr/0007-unified-object-tree-and-browser-deep-link-bridge.md');
    assert.match(adr0007, /Unified Object Tree Architecture/);
    assert.match(adr0007, /#164|#169/);
    assert.match(adr0007, /Bagian 2[–-]5.*(Superseded|Deprecated|Dihapus)|Superseded.*Bagian 2[–-]5/i);

    const readme = readRepoFile('README.md');
    assert.match(readme, /0007-unified-object-tree-and-browser-deep-link-bridge\.md/);
  });
});
