// Unit & Integration Tests untuk Dual-Theme Decoupling dan User Theme Presets ("Save As") Studio (Tiket #149)
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_APP_SETTINGS,
  resolveAppSettings
} from '../src/lib/constants/defaults';
import {
  THEME_PRESETS,
  createUserTheme,
  renameUserTheme,
  deleteUserTheme,
  isBuiltInTheme,
  resolveThemeConfig,
  resolveDeletedThemeFallback,
  resolveEffectiveChartThemePreset,
  resolveEffectiveThemeColors,
  buildCustomPaletteFromPreset
} from '../src/lib/constants/themes';
import type {
  CustomThemeDefinition,
  CustomThemePalette,
  AppSettings,
  ThemePresetId
} from '../src/lib/types/market';

describe('Tiket #149: Dual-Theme Decoupling & User Theme Presets ("Save As") Studio Suite', () => {
  const samplePalette: CustomThemePalette = {
    enabled: true,
    candles: {
      bullBody: '#00FFCC',
      bullWick: '#00DDAA',
      bullBorder: '#00AA88',
      bearBody: '#FF0055',
      bearWick: '#DD0044',
      bearBorder: '#AA0033'
    },
    general: {
      background: '#05070A',
      foreground: '#0E131A',
      textColor: '#E0E6ED'
    }
  };

  describe('1. CustomThemeDefinition CRUD Helpers Unit Tests (themes.ts)', () => {
    test('createUserTheme: membuat preset tema kustom dengan ID unik, nama, mode, palet, dan timestamp', () => {
      const created = createUserTheme('Cyberpunk Wave', 'dark', samplePalette);

      assert.ok(created.id, 'ID tema harus terisi');
      assert.ok(created.id.startsWith('user_theme_'), 'ID tema kustom harus diawali user_theme_');
      assert.equal(created.name, 'Cyberpunk Wave');
      assert.equal(created.mode, 'dark');
      assert.deepEqual(created.palette, samplePalette);
      assert.ok(typeof created.createdAt === 'number' && created.createdAt > 0);
      assert.ok(typeof created.updatedAt === 'number' && created.updatedAt >= created.createdAt);
    });

    test('createUserTheme: mendukung penentuan ID spesifik jika disediakan', () => {
      const created = createUserTheme('Light Paper', 'light', samplePalette, 'custom_id_123');
      assert.equal(created.id, 'custom_id_123');
      assert.equal(created.mode, 'light');
    });

    test('resolveThemeConfig: menemukan tema pengguna berdasarkan ID dan menghasilkan ThemeConfig valid', () => {
      const userTheme = createUserTheme('Cyberpunk Wave', 'dark', samplePalette, 'user_theme_test_1');
      const config = resolveThemeConfig('user_theme_test_1', [userTheme]);

      assert.equal(config.id, 'user_theme_test_1');
      assert.equal(config.name, 'Cyberpunk Wave');
      assert.equal(config.mode, 'dark');
      assert.equal(config.badge, 'CUSTOM');
      assert.equal(config.chart.background, '#05070A');
      assert.equal(config.chart.upColor, '#00FFCC');
      assert.equal(config.chart.downColor, '#FF0055');
      assert.equal(config.chart.wickUpColor, '#00DDAA');
      assert.equal(config.chart.wickDownColor, '#DD0044');
      assert.equal(config.chart.borderUpColor, '#00AA88');
      assert.equal(config.chart.borderDownColor, '#AA0033');
      assert.equal(config.tokens.bgDarkest, '#05070A');
      assert.equal(config.tokens.textMain, '#E0E6ED');
    });

    test('resolveThemeConfig: mengembalikan preset resmi jika ID merupakan preset bawaan', () => {
      const config = resolveThemeConfig('signature');
      assert.equal(config.id, 'signature');
      assert.equal(config.name, 'trawangan (Signature)');
      assert.equal(config.mode, 'dark');
    });

    test('resolveThemeConfig: fallback aman ke signature jika ID tidak ditemukan', () => {
      const config = resolveThemeConfig('non_existent_theme_id', []);
      assert.equal(config.id, 'signature');
      assert.equal(config.name, 'trawangan (Signature)');
    });

    test('renameUserTheme: memperbarui nama tema dan updatedAt', () => {
      const userTheme = createUserTheme('Old Name', 'dark', samplePalette, 'user_theme_rename_1');
      const initialUpdated = userTheme.updatedAt;

      // Tunggu jeda minimal untuk memastikan timestamp updatedAt bertambah
      const themes = [userTheme];
      const renamedList = renameUserTheme(themes, 'user_theme_rename_1', 'Brand New Name');

      const target = renamedList.find((t) => t.id === 'user_theme_rename_1');
      assert.ok(target, 'Tema yang diubah namanya harus ada');
      assert.equal(target.name, 'Brand New Name');
      assert.ok(target.updatedAt >= initialUpdated, 'updatedAt harus diperbarui');
    });

    test('renameUserTheme: mencegah pengubahan nama preset bawaan resmi', () => {
      assert.throws(
        () => renameUserTheme([], 'signature', 'Hacked Signature'),
        /Tidak dapat mengubah nama preset resmi bawaan/
      );
    });

    test('deleteUserTheme: menghapus tema pengguna dari koleksi', () => {
      const theme1 = createUserTheme('Theme 1', 'dark', samplePalette, 'theme_1');
      const theme2 = createUserTheme('Theme 2', 'light', samplePalette, 'theme_2');
      const list = [theme1, theme2];

      const remaining = deleteUserTheme(list, 'theme_1');
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].id, 'theme_2');
    });

    test('deleteUserTheme: mencegah penghapusan preset resmi bawaan', () => {
      assert.throws(
        () => deleteUserTheme([], 'binance'),
        /Tidak dapat menghapus preset resmi bawaan/
      );
    });

    test('resolveDeletedThemeFallback: mengembalikan preset fallback aman jika tema yang dihapus sedang aktif', () => {
      // Jika tema yang dihapus sedang aktif, fallback ke signature
      const fallbackActive = resolveDeletedThemeFallback('user_theme_del', 'user_theme_del', 'signature');
      assert.equal(fallbackActive, 'signature');

      // Jika tema lain yang dihapus, pertahankan tema aktif saat ini
      const unchanged = resolveDeletedThemeFallback('user_theme_other', 'user_theme_current', 'signature');
      assert.equal(unchanged, 'user_theme_current');
    });

    test('isBuiltInTheme: mengenali preset resmi bawaan vs preset kustom pengguna', () => {
      assert.equal(isBuiltInTheme('signature'), true);
      assert.equal(isBuiltInTheme('binance'), true);
      assert.equal(isBuiltInTheme('bitunix'), true);
      assert.equal(isBuiltInTheme('tradingview'), true);
      assert.equal(isBuiltInTheme('coinglass'), true);
      assert.equal(isBuiltInTheme('red_folder'), true);
      assert.equal(isBuiltInTheme('user_theme_123'), false);
      assert.equal(isBuiltInTheme('custom_palette'), false);
    });
  });

  describe('2. Dual-Theme Decoupling Logic Suite', () => {
    test('resolveEffectiveChartThemePreset: saat syncChartWithAppTheme === true, tema chart selalu selaras dengan tema aplikasi', () => {
      const effectiveChart = resolveEffectiveChartThemePreset(
        true, // syncChartWithAppTheme
        'binance', // effectiveAppPreset
        'red_folder' // chartThemePreset
      );
      assert.equal(effectiveChart, 'binance', 'Chart harus mengikuti tema aplikasi saat sync aktif');
    });

    test('resolveEffectiveChartThemePreset: saat syncChartWithAppTheme === false, tema chart independen dari tema aplikasi', () => {
      const effectiveChart = resolveEffectiveChartThemePreset(
        false, // syncChartWithAppTheme
        'binance', // app is dark binance
        'red_folder' // chart is light red_folder
      );
      assert.equal(effectiveChart, 'red_folder', 'Chart harus mempertahankan chartThemePreset saat un-synced');
    });

    test('resolveEffectiveChartThemePreset: saat syncChartWithAppTheme === false dengan preset pengguna kustom', () => {
      const effectiveChart = resolveEffectiveChartThemePreset(
        false,
        'tradingview',
        'user_theme_neon_glow'
      );
      assert.equal(effectiveChart, 'user_theme_neon_glow');
    });

    test('resolveEffectiveThemeColors: menggunakan warna latar dan teks dari user theme yang didaftarkan', () => {
      const userTheme = createUserTheme('Custom Emerald', 'dark', samplePalette, 'user_theme_emerald');
      const colors = resolveEffectiveThemeColors('user_theme_emerald', null, [userTheme]);

      assert.equal(colors.background, '#05070A');
      assert.equal(colors.textColor, '#E0E6ED');
      assert.equal(colors.isDark, true);
    });
  });

  describe('3. AppSettings & resolveAppSettings Seam Suite for Decoupling and Presets', () => {
    test('DEFAULT_APP_SETTINGS memiliki default syncChartWithAppTheme true, chartThemePreset signature, dan savedUserThemes []', () => {
      assert.equal(DEFAULT_APP_SETTINGS.syncChartWithAppTheme, true);
      assert.equal(DEFAULT_APP_SETTINGS.chartThemePreset, 'signature');
      assert.deepEqual(DEFAULT_APP_SETTINGS.savedUserThemes, []);
    });

    test('resolveAppSettings: menyelesaikan nilai default untuk pengaturan baru jika null', () => {
      const resolved = resolveAppSettings(null);
      assert.equal(resolved.syncChartWithAppTheme, true);
      assert.equal(resolved.chartThemePreset, 'signature');
      assert.deepEqual(resolved.savedUserThemes, []);
    });

    test('resolveAppSettings: mempertahankan nilai tersimpan untuk syncChartWithAppTheme, chartThemePreset, dan savedUserThemes', () => {
      const userTheme = createUserTheme('My Custom', 'dark', samplePalette, 'my_saved_1');
      const partial: Partial<AppSettings> = {
        syncChartWithAppTheme: false,
        themePreset: 'binance',
        chartThemePreset: 'red_folder',
        savedUserThemes: [userTheme]
      };

      const resolved = resolveAppSettings(partial);
      assert.equal(resolved.syncChartWithAppTheme, false);
      assert.equal(resolved.themePreset, 'binance');
      assert.equal(resolved.chartThemePreset, 'red_folder');
      assert.equal(resolved.savedUserThemes?.length, 1);
      assert.equal(resolved.savedUserThemes?.[0].id, 'my_saved_1');
    });

    test('resolveAppSettings: chartThemePreset default selaras dengan themePreset jika chartThemePreset tidak disediakan', () => {
      const partial: Partial<AppSettings> = {
        themePreset: 'bitunix'
      };
      const resolved = resolveAppSettings(partial);
      assert.equal(resolved.chartThemePreset, 'bitunix');
    });
  });

  describe('4. AppearanceTab Settings UI Contract for Dual-Theme & User Presets Studio', () => {
    const tabPath = path.resolve(process.cwd(), 'src/lib/components/settings/AppearanceTab.svelte');
    const tabContent = fs.readFileSync(tabPath, 'utf8');

    test('AppearanceTab.svelte menyediakan kontrol saklar sinkronisasi tema chart (syncChartWithAppTheme)', () => {
      assert.match(
        tabContent,
        /syncChartWithAppTheme/,
        'AppearanceTab harus mengelola preferensi syncChartWithAppTheme'
      );
      assert.match(
        tabContent,
        /Sinkronkan Tema Chart dengan Aplikasi/i,
        'AppearanceTab harus memuat label "Sinkronkan Tema Chart dengan Aplikasi"'
      );
    });

    test('AppearanceTab.svelte menyediakan pemilih independen untuk tema chart saat un-synced', () => {
      assert.match(
        tabContent,
        /chartThemePreset/,
        'AppearanceTab harus mengelola chartThemePreset secara independen'
      );
    });

    test('AppearanceTab.svelte menyediakan tombol "Save As" (Simpan Sebagai Tema Baru) di Custom Palette Studio', () => {
      assert.match(
        tabContent,
        /Simpan Sebagai Tema Baru|Save As/i,
        'AppearanceTab harus memiliki tombol Simpan Sebagai Tema Baru'
      );
    });

    test('AppearanceTab.svelte menyediakan modal Save As dengan input Nama dan Mode (dark/light)', () => {
      assert.match(
        tabContent,
        /saveAsModal|isSaveAsModalOpen|saveAsThemeName/i,
        'AppearanceTab harus memiliki state modal Save As'
      );
      assert.match(
        tabContent,
        /createUserTheme/,
        'AppearanceTab harus memanggil createUserTheme saat menyimpan tema baru'
      );
    });

    test('AppearanceTab.svelte merender preset pengguna kustom dengan badge [CUSTOM] dan aksi Rename/Delete/Export', () => {
      assert.match(
        tabContent,
        /savedUserThemes/,
        'AppearanceTab harus membaca koleksi savedUserThemes'
      );
      assert.match(
        tabContent,
        /CUSTOM/i,
        'AppearanceTab harus menyertakan badge CUSTOM untuk tema pengguna'
      );
      assert.match(
        tabContent,
        /renameUserTheme/i,
        'AppearanceTab harus mendukung aksi renameUserTheme'
      );
      assert.match(
        tabContent,
        /deleteUserTheme/i,
        'AppearanceTab harus mendukung aksi deleteUserTheme'
      );
    });
  });

  describe('5. Chart Canvas & Root Page Theming Seam (+page.svelte & Chart.svelte)', () => {
    const pagePath = path.resolve(process.cwd(), 'src/routes/+page.svelte');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    const chartPath = path.resolve(process.cwd(), 'src/lib/components/Chart.svelte');
    const chartContent = fs.readFileSync(chartPath, 'utf8');

    test('+page.svelte membedakan tema aplikasi dengan tema chart kanvas berdasarkan syncChartWithAppTheme', () => {
      assert.match(
        pageContent,
        /syncChartWithAppTheme/,
        '+page.svelte harus memeriksa preferensi syncChartWithAppTheme'
      );
      assert.match(
        pageContent,
        /resolveEffectiveChartThemePreset|chartThemePreset/,
        '+page.svelte harus menyelesaikan tema chart terpisah saat decoupling aktif'
      );
    });

    test('Chart.svelte menerima themePreset yang mendukung preset pengguna (ThemePresetId | string)', () => {
      assert.match(
        chartContent,
        /themePreset\??:\s*(ThemePresetId\s*\|\s*string|string)/,
        'Chart.svelte Props harus mengizinkan ThemePresetId | string'
      );
    });
  });
});
