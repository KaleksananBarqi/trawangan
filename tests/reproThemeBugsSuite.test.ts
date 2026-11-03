import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeWorkspaceFingerprint } from '../src/lib/services/persistence/workspaceService';
import { resolveEffectiveThemePreset, resolveEffectiveChartThemePreset, resolveEffectiveThemeColors, THEME_PRESETS } from '../src/lib/constants/themes';
import { generateVelaThemeTokens } from '../src/lib/utils/colorUtils';

describe('Diagnosing Bugs Suite: Workspace Startup Crash, Chart Theme Decoupling & Light Mode Screen Bug', () => {
  describe('Bug 2: Unhandled Promise Rejection on Workspace Auto-load at Startup', () => {
    const pagePath = path.resolve(process.cwd(), 'src/routes/+page.svelte');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    test('1. +page.svelte tidak memuat variabel undefined targetSym/targetTf/targetLayout/targetProvider di handleLoadWorkspace', () => {
      const loadWorkspaceMatch = pageContent.match(/async function handleLoadWorkspace\s*\(w:[^)]*\)\s*\{([\s\S]*?)\n\s*function/);
      assert.ok(loadWorkspaceMatch, 'handleLoadWorkspace harus ditemukan');
      const body = loadWorkspaceMatch[1];

      assert.doesNotMatch(body, /\btargetSym\b/, 'targetSym tidak boleh digunakan karena tidak terdefinisi');
      assert.doesNotMatch(body, /\btargetTf\b/, 'targetTf tidak boleh digunakan karena tidak terdefinisi');
      assert.doesNotMatch(body, /\btargetLayout\b/, 'targetLayout tidak boleh digunakan karena tidak terdefinisi');
      assert.doesNotMatch(body, /\btargetProvider\b/, 'targetProvider tidak boleh digunakan karena tidak terdefinisi');
    });

    test('2. computeWorkspaceFingerprint dapat dipanggil dengan properti dari objek SavedWorkspace w', () => {
      const mockWorkspace = {
        id: 'ws_test_1',
        name: 'Workspace Test',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        layout: '1',
        providerId: 'binance',
        indicators: []
      };

      assert.doesNotThrow(() => {
        const fp = computeWorkspaceFingerprint(
          mockWorkspace.id || mockWorkspace.name,
          mockWorkspace.symbol,
          mockWorkspace.timeframe,
          mockWorkspace.layout,
          mockWorkspace.providerId,
          mockWorkspace.indicators
        );
        assert.ok(fp.includes('ws_test_1'));
        assert.ok(fp.includes('BTCUSDT'));
      });
    });

    test('3. handleLoadWorkspace pada startup dibungkus dengan catch handler agar tidak memicu unhandled rejection', () => {
      assert.match(
        pageContent,
        /handleLoadWorkspace\(target\)\s*\.catch|\.catch\([^)]*handleLoadWorkspace/,
        'Pemanggilan handleLoadWorkspace(target) di startup wajib memiliki catch handler'
      );
    });

    test('4. handleLoadWorkspace menunggu (await) handleSymbolChange dan handleProviderChange sebelum menghitung computeWorkspaceFingerprint', () => {
      const loadWorkspaceMatch = pageContent.match(/async function handleLoadWorkspace\s*\(w:[^)]*\)\s*\{([\s\S]*?)\n\s*function/);
      assert.ok(loadWorkspaceMatch, 'handleLoadWorkspace harus ditemukan');
      const body = loadWorkspaceMatch[1];

      assert.match(
        body,
        /await\s+handleSymbolChange\s*\(\s*w\.symbol\s*\)/,
        'handleSymbolChange(w.symbol) di handleLoadWorkspace wajib di-await agar activeProviderId diperbarui secara akurat'
      );
      assert.match(
        body,
        /await\s+handleProviderChange\s*\(\s*w\.providerId\s*\)/,
        'handleProviderChange(w.providerId) di handleLoadWorkspace wajib di-await'
      );
    });
  });

  describe('Bug 3 & 1: Tema Kanvas Chart & Layar Putih di Mode Terang', () => {
    const controllerPath = path.resolve(process.cwd(), 'src/lib/services/chartSessionController.ts');
    const controllerContent = fs.readFileSync(controllerPath, 'utf8');
    const appearancePath = path.resolve(process.cwd(), 'src/lib/components/settings/AppearanceTab.svelte');
    const appearanceContent = fs.readFileSync(appearancePath, 'utf8');
    const pagePath = path.resolve(process.cwd(), 'src/routes/+page.svelte');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    test('1. generateVelaThemeTokens di ChartSessionController harus menyelaraskan background chart lokal', () => {
      const appColors = resolveEffectiveThemeColors('red_folder');
      const chartColors = resolveEffectiveThemeColors('signature');

      assert.equal(appColors.isDark, false, 'red_folder harus terdeteksi mode terang');
      assert.equal(chartColors.isDark, true, 'signature harus terdeteksi mode gelap');

      const chartTokens = generateVelaThemeTokens(chartColors.background, chartColors.textColor, '#242424');
      assert.equal(chartTokens['--vela-bg'], '#0F0F0F');
      assert.equal(chartTokens['--vela-surface'], '#0F0F0F');
      assert.equal(Object.keys(chartTokens).length, 26, 'generateVelaThemeTokens wajib menghasilkan 26 token --vela-*');
    });

    test('2. ChartSessionController.setTheme harus dapat mereset customPalette ke null saat undefined/null diberikan', () => {
      assert.match(
        controllerContent,
        /customPalette\?:\s*CustomThemePalette\s*\|\s*null/,
        'setTheme harus menerima CustomThemePalette | null'
      );
    });

    test('3. ChartSessionController.applyBackground menyuntikkan seluruh 26 token --vela-* via generateVelaThemeTokens ke container lokal chart', () => {
      const applyBgMatch = controllerContent.match(/public applyBackground\(\):\s*void\s*\{([\s\S]*?)\n  \/\*\*/);
      assert.ok(applyBgMatch, 'applyBackground harus ditemukan');
      const applyBgBody = applyBgMatch[1];

      assert.match(
        applyBgBody,
        /generateVelaThemeTokens\s*\(/,
        'applyBackground wajib memanggil generateVelaThemeTokens untuk mengisolasi seluruh 26 token --vela-* pada kontainer grafik'
      );
      assert.match(
        applyBgBody,
        /Object\.entries\([^)]*\)/,
        'applyBackground wajib mengiterasi seluruh entri token --vela-* dan menyuntikkannya ke container.style'
      );
    });

    test('4. Internal wrappers Vela selalu transparent melalui helper forceTransparent tanpa duplikasi', () => {
      const applyBgMatch = controllerContent.match(/public applyBackground\(\):\s*void\s*\{([\s\S]*?)\n  \/\*\*/);
      assert.ok(applyBgMatch, 'applyBackground harus ditemukan');
      const applyBgBody = applyBgMatch[1];

      assert.match(
        applyBgBody,
        /const\s+forceTransparent\s*=\s*\(\s*el:\s*Element\s*\)\s*=>/,
        'applyBackground wajib mengekstrak helper lokal forceTransparent(el: Element)'
      );
      assert.match(
        applyBgBody,
        /setProperty\(['"]background['"],\s*['"]transparent['"],\s*['"]important['"]\)/,
        'Wrappers internal Vela harus dibuat transparan agar tidak menutupi grafik'
      );
    });

    test('5. ChartSessionController.setTheme dan cell:created memanggil applyBackground() setelah operasi internal Vela', () => {
      const setThemeMatch = controllerContent.match(/public setTheme\([\s\S]*?\):\s*void\s*\{([\s\S]*?)this\.notify\(\);\s*\}/);
      assert.ok(setThemeMatch, 'setTheme harus ditemukan');
      const setThemeBody = setThemeMatch[1];

      // Pastikan applyBackground dipanggil setelah blok if (this.workspace) { ... }
      const lastWorkspaceIdx = setThemeBody.lastIndexOf('this.syncNativeVolumeColors()');
      const lastApplyBgIdx = setThemeBody.lastIndexOf('this.applyBackground()');
      assert.ok(
        lastApplyBgIdx > lastWorkspaceIdx,
        'this.applyBackground() wajib dipanggil kembali setelah blok manipulasi workspace di setTheme()'
      );

      // Pastikan cell:created juga memanggil this.applyBackground()
      assert.match(
        controllerContent,
        /this\.workspace\.on\(['"]cell:created['"],[\s\S]*?this\.applyBackground\(\)/,
        'Event listener cell:created wajib memanggil this.applyBackground() agar wrapper sel baru tetap transparan'
      );
    });

    test('6. AppearanceTab.svelte menggunakan komentar Bahasa Indonesia, snippet themePresetOptions, dan konsisten customPalette: undefined', () => {
      assert.doesNotMatch(
        appearanceContent,
        /Clear any stale custom palette override/,
        'Komentar bahasa Inggris di handleSetColorMode harus sudah diterjemahkan ke bahasa Indonesia'
      );
      assert.match(
        appearanceContent,
        /\{#snippet\s+themePresetOptions\(\)\}/,
        'AppearanceTab wajib mengekstrak {#snippet themePresetOptions()} untuk menghindari duplikasi <optgroup>'
      );
      const renderMatches = appearanceContent.match(/\{@render\s+themePresetOptions\(\)\}/g) || [];
      assert.ok(
        renderMatches.length >= 2,
        'themePresetOptions wajib di-render minimal pada kedua dropdown pemilih tema (Aplikasi & Chart)'
      );
      assert.doesNotMatch(
        appearanceContent,
        /customPalette:\s*null\s+as\s+any/,
        'AppearanceTab wajib menggunakan customPalette: undefined secara konsisten (bukan null as any)'
      );
    });

    test('7. +page.svelte mengisolasi customPalette saat syncChartWithAppTheme === false agar tidak menimpa kedua domain secara membabi-buta', () => {
      assert.match(
        pageContent,
        /syncChartWithAppTheme\s*!==\s*false\s*\?\s*appSettings\.customPalette\s*:\s*undefined/,
        '+page.svelte wajib mengisolasi customPalette saat mode tema aplikasi dan grafik tidak disinkronkan (decoupled)'
      );
    });
  });
});
