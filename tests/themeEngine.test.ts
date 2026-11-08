/**
 * Unit & Integration Tests untuk Deep Module `themeEngine.ts`
 *
 * Menguji:
 * 1. Intent Transition Reducer (`transitionThemeState`):
 *    - Transisi siklus mode warna (`CYCLE_COLOR_MODE`) dan konsistensi 6 slot preset memori.
 *    - Pemilihan preset (`SELECT_PRESET`) untuk App vs Chart Canvas (Synced vs Decoupled).
 *    - Rekonsiliasi atomik fallback 6 slot saat User Theme dihapus (`DELETE_USER_THEME`).
 *    - Pembersihan otomatis palet kustom sementara saat beralih ke preset resmi.
 *    - Manajemen User Themes (`SAVE_USER_THEME`, `RENAME_USER_THEME`, `UPDATE_USER_THEME_PALETTE`).
 * 2. Headless Token Bundle Compiler (`assembleThemeCssBundle`):
 *    - Verifikasi DTO murni `ThemeCssBundle` (UI Shell, Tipografi, Thesis Overlay ADR-0019, Vela WebGL2).
 * 3. DOM Bridge Driver (`applyThemeCssBundle`):
 *    - Verifikasi adapter DOM tipis mengaplikasikan atribut & CSS custom properties.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  transitionThemeState,
  resolveThemeState,
  assembleThemeCssBundle,
  applyThemeCssBundle,
  type ThemeCssBundle
} from '../src/lib/services/themeEngine';
import { DEFAULT_APP_SETTINGS } from '../src/lib/constants/defaults';
import type { AppSettings, CustomThemeDefinition, CustomThemePalette } from '../src/lib/types/market';

const mockPalette: CustomThemePalette = {
  enabled: true,
  candles: {
    bullBody: '#00E676',
    bullWick: '#00C853',
    bullBorder: '#00B0FF',
    bearBody: '#FF1744',
    bearWick: '#D50000',
    bearBorder: '#C51162'
  },
  general: {
    background: '#121212',
    foreground: '#1F1F1F',
    textColor: '#E0E0E0'
  }
};

describe('Deep Theme Engine Suite (Reducer, Headless Token Compiler, & DOM Seam)', () => {
  describe('1. Intent Transition Reducer (transitionThemeState)', () => {
    it('CYCLE_COLOR_MODE: berputar Dark -> Light -> System -> Dark dan menyelaraskan 6 slot memori', () => {
      let state: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        colorModePreference: 'dark',
        themePreset: 'signature',
        activeDarkPreset: 'signature',
        activeLightPreset: 'red_folder',
        syncChartWithAppTheme: true,
        customPalette: mockPalette,
        customBullColor: '#00E676',
        customBearColor: '#FF1744'
      };

      // 1. Dark -> Light
      let patch = transitionThemeState(state, { type: 'CYCLE_COLOR_MODE' }, { systemIsDark: true });
      assert.equal(patch.colorModePreference, 'light');
      assert.equal(patch.themePreset, 'red_folder');
      assert.equal(patch.chartThemePreset, 'red_folder');
      assert.equal(patch.customPalette, undefined, 'Override palet kustom harus dibersihkan');
      assert.equal(patch.customBullColor, undefined);
      assert.equal(patch.customBearColor, undefined);

      state = { ...state, ...patch };

      // 2. Light -> System (saat OS systemIsDark: false)
      patch = transitionThemeState(state, { type: 'CYCLE_COLOR_MODE' }, { systemIsDark: false });
      assert.equal(patch.colorModePreference, 'system');
      assert.equal(patch.themePreset, 'red_folder', 'Mode system saat OS terang harus memilih light preset');

      state = { ...state, ...patch };

      // 3. System -> Dark
      patch = transitionThemeState(state, { type: 'CYCLE_COLOR_MODE' }, { systemIsDark: false });
      assert.equal(patch.colorModePreference, 'dark');
      assert.equal(patch.themePreset, 'signature');
      assert.equal(patch.chartThemePreset, 'signature');
    });

    it('CYCLE_COLOR_MODE di mode decoupled: menjaga chartThemePreset independen sesuai activeDarkChartPreset & activeLightChartPreset', () => {
      const state: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        colorModePreference: 'dark',
        syncChartWithAppTheme: false,
        themePreset: 'signature',
        chartThemePreset: 'bitunix',
        activeDarkPreset: 'signature',
        activeLightPreset: 'red_folder',
        activeDarkChartPreset: 'bitunix',
        activeLightChartPreset: 'coinglass'
      };

      // Beralih ke Light: App beralih ke red_folder, Chart beralih ke coinglass
      const patch = transitionThemeState(state, { type: 'CYCLE_COLOR_MODE' }, { systemIsDark: true });
      assert.equal(patch.colorModePreference, 'light');
      assert.equal(patch.themePreset, 'red_folder');
      assert.equal(patch.chartThemePreset, 'coinglass', 'Chart harus beralih ke activeLightChartPreset');
    });

    it('SELECT_PRESET saat synced: mengubah preset app & chart sekaligus memperbarui slot memori mode aktif', () => {
      const state: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        syncChartWithAppTheme: true,
        themePreset: 'signature',
        chartThemePreset: 'signature',
        activeDarkPreset: 'signature',
        activeLightPreset: 'red_folder'
      };

      // Pilih preset 'binance' (mode dark)
      const patch = transitionThemeState(
        state,
        { type: 'SELECT_PRESET', target: 'app', presetId: 'binance' },
        { systemIsDark: true }
      );

      assert.equal(patch.themePreset, 'binance');
      assert.equal(patch.chartThemePreset, 'binance');
      assert.equal(patch.activeDarkPreset, 'binance');
      assert.equal(patch.activeDarkChartPreset, 'binance');
      assert.equal(patch.colorModePreference, 'dark');
    });

    it('SELECT_PRESET saat decoupled: memilih tema chart tidak mengubah tema app', () => {
      const state: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        syncChartWithAppTheme: false,
        themePreset: 'signature',
        chartThemePreset: 'signature',
        activeDarkPreset: 'signature',
        activeDarkChartPreset: 'signature'
      };

      const patch = transitionThemeState(
        state,
        { type: 'SELECT_PRESET', target: 'chart', presetId: 'bitunix' },
        { systemIsDark: true }
      );

      assert.equal(patch.chartThemePreset, 'bitunix');
      assert.equal(patch.activeDarkChartPreset, 'bitunix');
      assert.equal(patch.themePreset, undefined, 'Tema app tidak boleh disentuh');
    });

    it('SET_SYNC_WITH_APP: true otomatis menyelaraskan chartThemePreset dengan themePreset', () => {
      const state: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        syncChartWithAppTheme: false,
        themePreset: 'binance',
        chartThemePreset: 'bitunix'
      };

      const patch = transitionThemeState(state, { type: 'SET_SYNC_WITH_APP', sync: true });
      assert.equal(patch.syncChartWithAppTheme, true);
      assert.equal(patch.chartThemePreset, 'binance');
      assert.equal(patch.activeDarkChartPreset, 'binance');
    });

    it('DELETE_USER_THEME: rekonsiliasi atomik 6 slot preset memori tanpa kebocoran', () => {
      const userTheme1: CustomThemeDefinition = {
        id: 'user_theme_del_target',
        name: 'Cyber Theme',
        mode: 'dark',
        palette: mockPalette,
        createdAt: 1000,
        updatedAt: 1000
      };

      // Simulasikan tema ini sedang aktif di seluruh 6 slot
      const state: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        savedUserThemes: [userTheme1],
        themePreset: 'user_theme_del_target',
        chartThemePreset: 'user_theme_del_target',
        activeDarkPreset: 'user_theme_del_target',
        activeLightPreset: 'user_theme_del_target',
        activeDarkChartPreset: 'user_theme_del_target',
        activeLightChartPreset: 'user_theme_del_target'
      };

      const patch = transitionThemeState(state, {
        type: 'DELETE_USER_THEME',
        themeId: 'user_theme_del_target'
      });

      // Tema terhapus dari daftar
      assert.equal(patch.savedUserThemes?.length, 0);

      // Invarian 6-slot fallback terkunci secara atomik
      assert.equal(patch.themePreset, 'signature');
      assert.equal(patch.chartThemePreset, 'signature');
      assert.equal(patch.activeDarkPreset, 'signature');
      assert.equal(patch.activeLightPreset, 'red_folder');
      assert.equal(patch.activeDarkChartPreset, 'signature');
      assert.equal(patch.activeLightChartPreset, 'red_folder');
    });

    it('SAVE_USER_THEME: menyimpan preset kustom baru dan langsung mengaktifkannya', () => {
      const state: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        savedUserThemes: [],
        syncChartWithAppTheme: true
      };

      const patch = transitionThemeState(state, {
        type: 'SAVE_USER_THEME',
        name: 'Neon Matrix',
        mode: 'dark',
        palette: mockPalette,
        id: 'user_theme_neon'
      });

      assert.equal(patch.savedUserThemes?.length, 1);
      assert.equal(patch.savedUserThemes![0].id, 'user_theme_neon');
      assert.equal(patch.savedUserThemes![0].name, 'Neon Matrix');
      assert.equal(patch.themePreset, 'user_theme_neon');
      assert.equal(patch.chartThemePreset, 'user_theme_neon');
      assert.equal(patch.activeDarkPreset, 'user_theme_neon');
      assert.equal(patch.activeDarkChartPreset, 'user_theme_neon');
    });
  });

  describe('2. Headless Token Bundle Compiler (assembleThemeCssBundle)', () => {
    it('mengompilasi seluruh token CSS (UI Shell, Thesis Overlay ADR-0019, Vela WebGL2) menjadi DTO murni tanpa error', () => {
      const settings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        themePreset: 'signature',
        chartThemePreset: 'signature',
        colorModePreference: 'dark'
      };

      const bundle = assembleThemeCssBundle(settings, {
        systemIsDark: true,
        uiFontCss: "'Plus Jakarta Sans', sans-serif",
        monoFontCss: "'JetBrains Mono', monospace"
      });

      assert.equal(bundle.dataTheme, 'signature');
      assert.equal(bundle.dataThemeMode, 'dark');
      assert.equal(bundle.colorScheme, 'dark');

      // Tipografi
      assert.equal(bundle.rootCssVariables['--font-ui'], "'Plus Jakarta Sans', sans-serif");
      assert.equal(bundle.rootCssVariables['--font-code'], "'JetBrains Mono', monospace");
      assert.ok(bundle.rootCssVariables['--base-font-size']);
      assert.ok(bundle.rootCssVariables['--font-scale']);

      // Thesis Overlay Tokens (ADR-0019)
      assert.ok(bundle.rootCssVariables['--chart-thesis-bg']);
      assert.ok(bundle.rootCssVariables['--chart-thesis-border']);
      assert.ok(bundle.rootCssVariables['--chart-thesis-bull']);
      assert.ok(bundle.rootCssVariables['--chart-thesis-bear']);

      // Vela WebGL2 Tokens
      assert.equal(bundle.rootCssVariables['--vela-bg'], '#0F0F0F');
      assert.ok(bundle.rootCssVariables['--vela-fg']);
      assert.ok(bundle.rootCssVariables['--vela-surface-elev']);

      // Preset resmi: menyertakan removeCssVariables untuk membersihkan override
      assert.ok(bundle.removeCssVariables.includes('--bg-darkest'));
      assert.ok(bundle.removeCssVariables.includes('--brand-primary'));
    });

    it('menyuntikkan variabel UI Shell saat tema pengguna kustom aktif', () => {
      const customTheme: CustomThemeDefinition = {
        id: 'user_theme_custom_1',
        name: 'Dark Emerald',
        mode: 'dark',
        palette: mockPalette,
        createdAt: 1000,
        updatedAt: 1000
      };

      const settings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        themePreset: 'user_theme_custom_1',
        activeDarkPreset: 'user_theme_custom_1',
        savedUserThemes: [customTheme],
        colorModePreference: 'dark'
      };

      const bundle = assembleThemeCssBundle(settings, { systemIsDark: true });

      assert.equal(bundle.dataTheme, 'user_theme_custom_1');
      assert.equal(bundle.removeCssVariables.length, 0);
      assert.equal(bundle.rootCssVariables['--bg-darkest'], '#121212');
      assert.equal(bundle.rootCssVariables['--text-main'], '#E0E0E0');
      assert.equal(bundle.rootCssVariables['--bull-color'], '#00E676');
      assert.equal(bundle.rootCssVariables['--bear-color'], '#FF1744');
    });
  });

  describe('3. DOM Bridge Driver (applyThemeCssBundle)', () => {
    it('mengaplikasikan atribut dan CSS properties ke mock target document element', () => {
      const attributes: Record<string, string> = {};
      const properties: Record<string, string> = {};
      const removedProperties: string[] = [];

      const mockElement = {
        setAttribute(name: string, value: string) {
          attributes[name] = value;
        },
        style: {
          setProperty(name: string, value: string) {
            properties[name] = value;
          },
          removeProperty(name: string) {
            removedProperties.push(name);
          }
        }
      };

      const mockDocument = {
        documentElement: mockElement
      };

      const bundle: ThemeCssBundle = {
        dataTheme: 'bitunix',
        dataThemeMode: 'dark',
        colorScheme: 'dark',
        rootCssVariables: {
          '--font-ui': "'Plus Jakarta Sans', sans-serif",
          '--chart-thesis-bg': 'rgba(13, 17, 23, 0.94)'
        },
        removeCssVariables: ['--bg-darkest', '--brand-primary']
      };

      applyThemeCssBundle(mockDocument, bundle);

      assert.equal(attributes['data-theme'], 'bitunix');
      assert.equal(attributes['data-theme-mode'], 'dark');
      assert.equal(properties['color-scheme'], 'dark');
      assert.equal(properties['--font-ui'], "'Plus Jakarta Sans', sans-serif");
      assert.equal(properties['--chart-thesis-bg'], 'rgba(13, 17, 23, 0.94)');
      assert.deepEqual(removedProperties, ['--bg-darkest', '--brand-primary']);
    });
  });
});
