/**
 * Deep Module: Unified Theme Engine & Chart Mode Preset Memory (`themeEngine.ts`)
 *
 * Menggabungkan arsitektur Hibrida (Desain B Pure Intent Reducer + Desain C Headless Token Bundle Seam):
 * 1. Intent Transition Reducer (`transitionThemeState`):
 *    Menyembunyikan kompleksitas 6 slot memori preset (themePreset, chartThemePreset, activeDarkPreset,
 *    activeLightPreset, activeDarkChartPreset, activeLightChartPreset) dan transisi mode warna di balik
 *    aksi-aksi diskrit berbasis niat pengguna, menjamin konsistensi atomik dan pembersihan palet kustom.
 * 2. Headless Token Bundle Compiler (`assembleThemeCssBundle`):
 *    Mengompilasi seluruh token CSS (UI shell, tipografi, skema warna, kartu thesis overlay ADR-0019,
 *    dan Vela WebGL2 kit) menjadi objek data murni (`ThemeCssBundle`) yang 100% testable tanpa browser DOM.
 * 3. DOM Bridge Driver (`applyThemeCssBundle`):
 *    Adapter DOM tipis yang menyuntikkan bundle ke elemen root dokumen (`document.documentElement`).
 */

import type {
  AppSettings,
  ColorModePreference,
  CustomThemeDefinition,
  CustomThemePalette,
  ThemeId,
  ThemePresetId,
  UiDensity
} from '../types/market';
import {
  THEME_PRESETS,
  resolveThemeConfig,
  resolveEffectiveThemeColors,
  resolveEffectiveThemePreset,
  resolveEffectiveChartThemePreset,
  generateChartThesisThemeTokens,
  isBuiltInTheme,
  deleteUserTheme,
  renameUserTheme,
  createUserTheme,
  updateUserThemePalette,
  getNextColorMode,
  UI_FONT_OPTIONS,
  MONO_FONT_OPTIONS,
  type ThemeConfig
} from '../constants/themes';
import {
  generateVelaThemeTokens,
  deriveSurfaceColor,
  withAlpha,
  isDarkColor
} from '../utils/colorUtils';

/**
 * Representasi data murni (DTO) deklaratif dari seluruh atribut DOM dan CSS variabel tema.
 * Bebas dari ketergantungan pada objek window/document sehingga 100% testable secara headless.
 */
export interface ThemeCssBundle {
  dataTheme: string;
  dataThemeMode: 'dark' | 'light';
  colorScheme: 'dark' | 'light';
  rootCssVariables: Record<string, string>;
  removeCssVariables: string[];
}

/**
 * Konteks lingkungan runtime eksternal yang dibutuhkan oleh compiler token tema.
 */
export interface ThemeBundleContext {
  systemIsDark: boolean;
  uiFontCss?: string;
  monoFontCss?: string;
}

/**
 * Snapshot resolusi tema aktif untuk keperluan query komponen UI.
 */
export interface ResolvedThemeState {
  effectiveAppPreset: ThemeId;
  effectiveChartPreset: ThemeId;
  themeMode: 'dark' | 'light';
  isDark: boolean;
  isCustomActive: boolean;
  isSynced: boolean;
  appConfig: ThemeConfig;
  chartConfig: ThemeConfig;
}

/**
 * Aksi-aksi diskrit berbasis niat (*intent*) untuk transisi status pengaturan tema.
 */
export type ThemeAction =
  | { type: 'CYCLE_COLOR_MODE' }
  | { type: 'SET_COLOR_MODE'; mode: ColorModePreference }
  | { type: 'SET_SYNC_WITH_APP'; sync: boolean }
  | { type: 'SELECT_PRESET'; target: 'app' | 'chart' | 'both'; presetId: ThemeId }
  | { type: 'SET_MODE_PRESET_MEMORY'; slot: 'appDark' | 'appLight' | 'chartDark' | 'chartLight'; presetId: ThemeId }
  | { type: 'SAVE_USER_THEME'; name: string; mode: 'dark' | 'light'; palette: CustomThemePalette; id?: string }
  | { type: 'RENAME_USER_THEME'; themeId: string; newName: string }
  | { type: 'DELETE_USER_THEME'; themeId: string }
  | { type: 'UPDATE_USER_THEME_PALETTE'; themeId: string; palette: CustomThemePalette; mode?: 'dark' | 'light' }
  | { type: 'APPLY_CUSTOM_PALETTE'; palette: CustomThemePalette }
  | { type: 'CLEAR_CUSTOM_PALETTE' }
  | { type: 'SET_TYPOGRAPHY'; fontFamilyUi?: string; fontFamilyMono?: string; fontSize?: number; uiDensity?: UiDensity };

/**
 * Helper internal untuk menentukan fallback aman sebuah slot jika tema yang dihapus cocok.
 */
function reconcileSlot(
  deletedId: string,
  currentValue: string | undefined,
  fallbackValue: string
): string {
  if (currentValue === deletedId || !currentValue) {
    return fallbackValue;
  }
  return currentValue;
}

/**
 * Menyelesaikan status tema efektif saat ini (App Theme & Chart Canvas Theme)
 * secara deterministik dari pengaturan pengguna dan preferensi OS.
 */
export function resolveThemeState(
  settings: AppSettings,
  systemIsDark: boolean = true
): ResolvedThemeState {
  const isSynced = settings.syncChartWithAppTheme !== false;

  const effectiveAppPreset = resolveEffectiveThemePreset(
    settings.colorModePreference ?? 'system',
    systemIsDark,
    settings.themePreset ?? 'signature',
    settings.activeDarkPreset ?? 'signature',
    settings.activeLightPreset ?? 'red_folder'
  );

  const effectiveChartPreset = resolveEffectiveChartThemePreset(
    isSynced,
    effectiveAppPreset,
    settings.chartThemePreset ?? 'signature',
    settings.colorModePreference ?? 'system',
    systemIsDark,
    settings.activeDarkChartPreset,
    settings.activeLightChartPreset
  );

  const cp = isSynced ? settings.customPalette : undefined;
  const { isDark } = resolveEffectiveThemeColors(
    effectiveAppPreset,
    cp,
    settings.savedUserThemes
  );

  const appConfig = resolveThemeConfig(effectiveAppPreset, settings.savedUserThemes);
  const chartConfig = resolveThemeConfig(effectiveChartPreset, settings.savedUserThemes);

  return {
    effectiveAppPreset,
    effectiveChartPreset,
    themeMode: isDark ? 'dark' : 'light',
    isDark,
    isCustomActive: Boolean(cp && cp.enabled !== false),
    isSynced,
    appConfig,
    chartConfig
  };
}

/**
 * PURE REDUCER ENGINE: Menghitung transisi status tema secara atomik dan deterministik.
 * Menjamin 6 slot preset memori selalu valid dan konsisten, serta membersihkan override
 * palet kustom sementara saat pengguna beralih ke preset resmi bawaan.
 */
export function transitionThemeState(
  settings: AppSettings,
  action: ThemeAction,
  context: { systemIsDark: boolean } = { systemIsDark: true }
): Partial<AppSettings> {
  const { systemIsDark } = context;

  switch (action.type) {
    case 'CYCLE_COLOR_MODE': {
      const currentPref = settings.colorModePreference ?? 'system';
      const nextPref = getNextColorMode(currentPref);
      const darkPreset = settings.activeDarkPreset || 'signature';
      const lightPreset = settings.activeLightPreset || 'red_folder';
      const targetAppPreset =
        nextPref === 'dark'
          ? darkPreset
          : nextPref === 'light'
            ? lightPreset
            : systemIsDark
              ? darkPreset
              : lightPreset;

      const isSynced = settings.syncChartWithAppTheme !== false;
      const darkChartPreset =
        settings.activeDarkChartPreset || settings.chartThemePreset || darkPreset;
      const lightChartPreset =
        settings.activeLightChartPreset || settings.activeLightPreset || 'red_folder';

      const targetChartPreset = isSynced
        ? targetAppPreset
        : nextPref === 'dark'
          ? darkChartPreset
          : nextPref === 'light'
            ? lightChartPreset
            : systemIsDark
              ? darkChartPreset
              : lightChartPreset;

      return {
        colorModePreference: nextPref,
        themePreset: targetAppPreset,
        theme: targetAppPreset as any,
        chartThemePreset: targetChartPreset,
        customPalette: undefined,
        customBullColor: undefined,
        customBearColor: undefined
      };
    }

    case 'SET_COLOR_MODE': {
      const nextPref = action.mode;
      const darkPreset = settings.activeDarkPreset || 'signature';
      const lightPreset = settings.activeLightPreset || 'red_folder';
      const targetAppPreset =
        nextPref === 'dark'
          ? darkPreset
          : nextPref === 'light'
            ? lightPreset
            : systemIsDark
              ? darkPreset
              : lightPreset;

      const isSynced = settings.syncChartWithAppTheme !== false;
      const darkChartPreset =
        settings.activeDarkChartPreset || settings.chartThemePreset || darkPreset;
      const lightChartPreset =
        settings.activeLightChartPreset || settings.activeLightPreset || 'red_folder';

      const targetChartPreset = isSynced
        ? targetAppPreset
        : nextPref === 'dark'
          ? darkChartPreset
          : nextPref === 'light'
            ? lightChartPreset
            : systemIsDark
              ? darkChartPreset
              : lightChartPreset;

      return {
        colorModePreference: nextPref,
        themePreset: targetAppPreset,
        theme: targetAppPreset as any,
        chartThemePreset: targetChartPreset,
        customPalette: undefined,
        customBullColor: undefined,
        customBearColor: undefined
      };
    }

    case 'SET_SYNC_WITH_APP': {
      const sync = action.sync;
      if (sync) {
        // Saat sinkronisasi diaktifkan, samakan tema grafik dengan tema shell aplikasi saat ini
        const appPreset = settings.themePreset || 'signature';
        const cfg = resolveThemeConfig(appPreset, settings.savedUserThemes);
        const mode = cfg.mode || 'dark';

        return {
          syncChartWithAppTheme: true,
          chartThemePreset: appPreset,
          ...(mode === 'dark'
            ? { activeDarkChartPreset: appPreset }
            : { activeLightChartPreset: appPreset })
        };
      }
      return {
        syncChartWithAppTheme: false
      };
    }

    case 'SELECT_PRESET': {
      const { target, presetId } = action;
      const cfg = resolveThemeConfig(presetId, settings.savedUserThemes);
      const mode = cfg.mode || 'dark';
      const isSynced = settings.syncChartWithAppTheme !== false;

      // Jika target adalah app, both, atau jika syncChartWithAppTheme aktif
      if (target === 'app' || target === 'both' || isSynced) {
        const patch: Partial<AppSettings> = {
          themePreset: presetId,
          theme: presetId as any,
          colorModePreference: mode,
          ...(mode === 'dark' ? { activeDarkPreset: presetId } : { activeLightPreset: presetId }),
          customPalette: undefined,
          customBullColor: undefined,
          customBearColor: undefined
        };

        if (isSynced || target === 'both') {
          patch.chartThemePreset = presetId;
          if (mode === 'dark') {
            patch.activeDarkChartPreset = presetId;
          } else {
            patch.activeLightChartPreset = presetId;
          }
        }
        return patch;
      }

      // Decoupled Chart Target Selection (hanya mengubah tema grafik)
      const currentPref = settings.colorModePreference ?? 'system';
      const isLightMode =
        currentPref === 'light' || (currentPref === 'system' && !systemIsDark);

      return {
        chartThemePreset: presetId,
        ...(mode === 'dark' || !isLightMode
          ? { activeDarkChartPreset: presetId }
          : { activeLightChartPreset: presetId }),
        customPalette: undefined,
        customBullColor: undefined,
        customBearColor: undefined
      };
    }

    case 'SET_MODE_PRESET_MEMORY': {
      const { slot, presetId } = action;
      const patch: Partial<AppSettings> = {};

      if (slot === 'appDark') {
        patch.activeDarkPreset = presetId;
        if (settings.colorModePreference === 'dark') {
          patch.themePreset = presetId;
          patch.theme = presetId as any;
          if (settings.syncChartWithAppTheme !== false) {
            patch.chartThemePreset = presetId;
            patch.activeDarkChartPreset = presetId;
          }
        }
      } else if (slot === 'appLight') {
        patch.activeLightPreset = presetId;
        if (settings.colorModePreference === 'light') {
          patch.themePreset = presetId;
          patch.theme = presetId as any;
          if (settings.syncChartWithAppTheme !== false) {
            patch.chartThemePreset = presetId;
            patch.activeLightChartPreset = presetId;
          }
        }
      } else if (slot === 'chartDark') {
        patch.activeDarkChartPreset = presetId;
        if (settings.colorModePreference === 'dark' && settings.syncChartWithAppTheme === false) {
          patch.chartThemePreset = presetId;
        }
      } else if (slot === 'chartLight') {
        patch.activeLightChartPreset = presetId;
        if (settings.colorModePreference === 'light' && settings.syncChartWithAppTheme === false) {
          patch.chartThemePreset = presetId;
        }
      }

      patch.customPalette = undefined;
      patch.customBullColor = undefined;
      patch.customBearColor = undefined;
      return patch;
    }

    case 'DELETE_USER_THEME': {
      const { themeId } = action;
      const currentThemes = settings.savedUserThemes || [];
      const updatedList = deleteUserTheme(currentThemes, themeId);

      // Rekonsiliasi atomik untuk seluruh 6 slot preset memori
      const fallbackApp = reconcileSlot(themeId, settings.themePreset, 'signature');
      const fallbackChart = reconcileSlot(themeId, settings.chartThemePreset, 'signature');
      const fallbackDarkApp = reconcileSlot(themeId, settings.activeDarkPreset, 'signature');
      const fallbackLightApp = reconcileSlot(themeId, settings.activeLightPreset, 'red_folder');
      const fallbackDarkChart = reconcileSlot(themeId, settings.activeDarkChartPreset, 'signature');
      const fallbackLightChart = reconcileSlot(themeId, settings.activeLightChartPreset, 'red_folder');

      return {
        savedUserThemes: updatedList,
        themePreset: fallbackApp,
        chartThemePreset: fallbackChart,
        activeDarkPreset: fallbackDarkApp,
        activeLightPreset: fallbackLightApp,
        activeDarkChartPreset: fallbackDarkChart,
        activeLightChartPreset: fallbackLightChart
      };
    }

    case 'SAVE_USER_THEME': {
      const { name, mode, palette, id } = action;
      const currentThemes = settings.savedUserThemes || [];
      const newDef = createUserTheme(name, mode, palette, id);
      const updatedList = [...currentThemes, newDef];

      // Terapkan preset yang baru disimpan sebagai preset aktif
      const isSynced = settings.syncChartWithAppTheme !== false;
      const patch: Partial<AppSettings> = {
        savedUserThemes: updatedList,
        themePreset: newDef.id,
        theme: newDef.id as any,
        colorModePreference: mode,
        ...(mode === 'dark' ? { activeDarkPreset: newDef.id } : { activeLightPreset: newDef.id }),
        customPalette: undefined,
        customBullColor: undefined,
        customBearColor: undefined
      };

      if (isSynced) {
        patch.chartThemePreset = newDef.id;
        if (mode === 'dark') {
          patch.activeDarkChartPreset = newDef.id;
        } else {
          patch.activeLightChartPreset = newDef.id;
        }
      }

      return patch;
    }

    case 'RENAME_USER_THEME': {
      const { themeId, newName } = action;
      const currentThemes = settings.savedUserThemes || [];
      const updatedList = renameUserTheme(currentThemes, themeId, newName);
      return {
        savedUserThemes: updatedList
      };
    }

    case 'UPDATE_USER_THEME_PALETTE': {
      const { themeId, palette, mode } = action;
      const currentThemes = settings.savedUserThemes || [];
      const updatedList = updateUserThemePalette(currentThemes, themeId, palette, mode);
      return {
        savedUserThemes: updatedList,
        customPalette: undefined,
        customBullColor: undefined,
        customBearColor: undefined
      };
    }

    case 'APPLY_CUSTOM_PALETTE': {
      return {
        customPalette: {
          ...action.palette,
          enabled: true
        }
      };
    }

    case 'CLEAR_CUSTOM_PALETTE': {
      return {
        customPalette: undefined,
        customBullColor: undefined,
        customBearColor: undefined
      };
    }

    case 'SET_TYPOGRAPHY': {
      const patch: Partial<AppSettings> = {};
      if (action.fontFamilyUi !== undefined) patch.fontFamilyUi = action.fontFamilyUi;
      if (action.fontFamilyMono !== undefined) patch.fontFamilyMono = action.fontFamilyMono;
      if (action.fontSize !== undefined) patch.fontSize = action.fontSize;
      if (action.uiDensity !== undefined) patch.uiDensity = action.uiDensity;
      return patch;
    }

    default:
      return {};
  }
}

/**
 * PURE HEADLESS TOKEN BUNDLE COMPILER:
 * Mengompilasi seluruh token CSS UI shell, tipografi, kartu thesis, dan WebGL2 Vela
 * menjadi objek ThemeCssBundle murni yang siap diaplikasikan atau diverifikasi di unit test.
 */
export function assembleThemeCssBundle(
  settings: AppSettings,
  context: ThemeBundleContext
): ThemeCssBundle {
  const state = resolveThemeState(settings, context.systemIsDark);
  const cp = state.isSynced ? settings.customPalette : undefined;
  const isCustomActive = Boolean(cp && cp.enabled !== false && cp.candles && cp.general);

  const { background: bg, textColor: text, isDark } = resolveEffectiveThemeColors(
    state.effectiveAppPreset,
    cp,
    settings.savedUserThemes
  );

  // Tipografi & Skala
  const uiOpt = UI_FONT_OPTIONS.find((f) => f.id === settings.fontFamilyUi);
  const monoOpt = MONO_FONT_OPTIONS.find((f) => f.id === settings.fontFamilyMono);
  const uiFont = context.uiFontCss || (uiOpt ? uiOpt.css : "'Plus Jakarta Sans', sans-serif");
  const monoFont = context.monoFontCss || (monoOpt ? monoOpt.css : "'JetBrains Mono', monospace");

  const currentFontSize =
    settings.fontSize ??
    (settings.uiDensity === 'compact' ? 11 : settings.uiDensity === 'comfortable' ? 13.5 : 12);
  const fontScale = currentFontSize / 12;

  const rootCssVariables: Record<string, string> = {
    '--font-ui': uiFont,
    '--font-code': monoFont,
    '--base-font-size': `${currentFontSize}px`,
    '--font-scale': `${fontScale}`
  };
  const removeCssVariables: string[] = [];

  const shellKeys = [
    '--bg-darkest',
    '--bg-surface',
    '--bg-container',
    '--bg-panel',
    '--text-main',
    '--text-primary',
    '--bull-color',
    '--bear-color',
    '--brand-primary'
  ];

  if (isCustomActive && cp) {
    const containerSurface = deriveSurfaceColor(bg, 0.045);
    const panelSurface = deriveSurfaceColor(bg, 0.065);
    rootCssVariables['--bg-darkest'] = bg;
    rootCssVariables['--bg-surface'] = bg;
    rootCssVariables['--bg-container'] = containerSurface;
    rootCssVariables['--bg-panel'] = panelSurface;
    rootCssVariables['--text-main'] = text;
    rootCssVariables['--text-primary'] = text;
    rootCssVariables['--bull-color'] = cp.candles.bullBody;
    rootCssVariables['--bear-color'] = cp.candles.bearBody;
    rootCssVariables['--brand-primary'] = cp.candles.bullBody;
  } else if (!isBuiltInTheme(state.effectiveAppPreset)) {
    // Preset kustom pengguna: suntikkan token UI Shell
    rootCssVariables['--bg-darkest'] = state.appConfig.tokens.bgDarkest;
    rootCssVariables['--bg-surface'] = state.appConfig.tokens.bgSurface;
    rootCssVariables['--bg-container'] = state.appConfig.tokens.bgContainer;
    rootCssVariables['--bg-panel'] = state.appConfig.tokens.bgPanel;
    rootCssVariables['--text-main'] = state.appConfig.tokens.textMain;
    rootCssVariables['--text-primary'] =
      state.appConfig.tokens.textPrimary || state.appConfig.tokens.textMain;
    rootCssVariables['--bull-color'] = state.appConfig.tokens.bullColor;
    rootCssVariables['--bear-color'] = state.appConfig.tokens.bearColor;
    rootCssVariables['--brand-primary'] = state.appConfig.tokens.brandPrimary;
  } else {
    // Preset resmi bawaan: bersihkan override token CSS agar gaya default stylesheet aktif
    removeCssVariables.push(...shellKeys);
  }

  // Token Kartu Thesis Overlay berbasis Chart Canvas Theme aktif (ADR-0019)
  const thesisTokens = generateChartThesisThemeTokens(state.chartConfig);
  for (const [k, v] of Object.entries(thesisTokens)) {
    rootCssVariables[k] = v;
  }

  // Token WebGL2 Vela runtime kit
  const borderVela = isDark ? withAlpha(text, 0.14) : withAlpha(text, 0.18);
  const velaTokens = generateVelaThemeTokens(bg, text, borderVela, uiFont);
  for (const [k, v] of Object.entries(velaTokens)) {
    rootCssVariables[k] = v;
  }

  return {
    dataTheme: state.effectiveAppPreset,
    dataThemeMode: state.themeMode,
    colorScheme: state.themeMode,
    rootCssVariables,
    removeCssVariables
  };
}

/**
 * DOM BRIDGE DRIVER: Adapter tipis untuk menerapkan ThemeCssBundle ke elemen target (default: document.documentElement).
 * Aman dipanggil di lingkungan browser dan diabaikan secara elegan pada lingkungan headless/SSR.
 */
export function applyThemeCssBundle(
  targetDocOrElement: any,
  bundle: ThemeCssBundle
): void {
  if (!targetDocOrElement) return;

  const el =
    'documentElement' in targetDocOrElement
      ? targetDocOrElement.documentElement
      : targetDocOrElement;

  if (!el || !el.style || typeof el.setAttribute !== 'function') return;

  el.setAttribute('data-theme', bundle.dataTheme);
  el.setAttribute('data-theme-mode', bundle.dataThemeMode);

  if (typeof el.style.setProperty === 'function') {
    el.style.setProperty('color-scheme', bundle.colorScheme);

    for (const key of bundle.removeCssVariables) {
      if (typeof el.style.removeProperty === 'function') {
        el.style.removeProperty(key);
      }
    }

    for (const [key, value] of Object.entries(bundle.rootCssVariables)) {
      el.style.setProperty(key, value);
    }
  }
}
