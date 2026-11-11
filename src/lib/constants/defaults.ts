import type { AppSettings, MultiChartSyncConfig, UserProfileConfig, CustomChartBackgroundConfig, SecurityWatermarkConfig } from '../types/market';
import { DEFAULT_WORLD_CLOCK_CITIES } from '../services/worldClockService';

/**
 * Konfigurasi bawaan sinkronisasi multi-chart Trawangan
 */
export const DEFAULT_SYNC_CONFIG: MultiChartSyncConfig = {
  crosshair: true,
  viewport: true,
  symbol: false,
  drawings: true,
  indicators: true,
};

/**
 * Pengaturan bawaan aplikasi Trawangan
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  timezone: 'Asia/Jakarta',
  soundEnabled: true,
  systemNotificationEnabled: true,
  showWatermark: true,
  showGrid: true,
  gridMode: 'normal',
  showReplayBar: false,
  showCurrentPriceLine: true,
  showVolume: true,
  showIndicatorPriceLabels: true,
  showDrawingPriceLabels: true,
  theme: 'signature',
  themePreset: 'signature',
  chartThemePreset: 'signature',
  syncChartWithAppTheme: true,
  savedUserThemes: [],
  colorModePreference: 'system',
  activeDarkPreset: 'signature',
  activeLightPreset: 'red_folder',
  activeDarkChartPreset: 'signature',
  activeLightChartPreset: 'red_folder',
  fontFamilyUi: 'Plus Jakarta Sans',
  fontFamilyMono: 'JetBrains Mono',
  uiDensity: 'regular',
  fontSize: 12,
  defaultTimeframe: '15m',
  favoriteTimeframes: ['1m', '5m', '15m', '1h', '4h', '1D'],
  customTimeframes: [],
  autoSaveWorkspace: true,
  autoLoadLastWorkspace: true,
  showWorldClocks: true,
  worldClockCities: [...DEFAULT_WORLD_CLOCK_CITIES],
  // Snapshot Preferences (#95, #125 Multi-Scale & Save Directory Setting)
  snapshotIncludeFrame: true,
  snapshotIncludePrice: true,
  snapshotIncludeTimestamp: true,
  snapshotScope: 'active',
  snapshotDirectory: '',
  snapshotScaleMultiplier: 2,
  snapshotThesisLayout: 'side-panel',
  // Trader Profile & Attribution Settings (#126)
  userProfile: {
    username: '',
    handle: '',
    avatarDataUrl: undefined,
  },
  // Kustomisasi latar belakang grafik (solid & vertikal gradient) (#128)
  customChartBackground: {
    mode: 'theme',
    solidColor: '#0F0F0F',
    gradientTop: '#0F0F0F',
    gradientBottom: '#181A20',
  },
  // Security Watermark Anti-Theft Settings (#127)
  securityWatermark: {
    enabled: false,
    text: '',
    opacity: 0.10,
    showOnLiveCanvas: false,
  },
  syncConfig: { ...DEFAULT_SYNC_CONFIG },
};

/**
 * Menyelesaikan dan menormalkan AppSettings dengan nilai default yang aman
 * jika data dari penyimpanan lokal parsial atau belum lengkap.
 */
export function resolveAppSettings(saved?: Partial<AppSettings> | null): AppSettings {
  if (!saved) {
    return {
      ...DEFAULT_APP_SETTINGS,
      syncConfig: { ...DEFAULT_SYNC_CONFIG },
    };
  }

  const mergedSyncConfig: MultiChartSyncConfig = {
    ...DEFAULT_SYNC_CONFIG,
    ...(saved.syncConfig || {}),
  };

  const rawProfile = saved.userProfile;
  const userProfile: UserProfileConfig = {
    username: typeof rawProfile?.username === 'string' ? rawProfile.username : (DEFAULT_APP_SETTINGS.userProfile?.username ?? ''),
    handle: typeof rawProfile?.handle === 'string' ? rawProfile.handle : (DEFAULT_APP_SETTINGS.userProfile?.handle ?? ''),
    avatarDataUrl: typeof rawProfile?.avatarDataUrl === 'string' ? rawProfile.avatarDataUrl : (DEFAULT_APP_SETTINGS.userProfile?.avatarDataUrl ?? undefined),
    ...(typeof rawProfile?.bio === 'string' ? { bio: rawProfile.bio } : {}),
  };

  const rawWatermark = saved.securityWatermark;
  let watermarkOpacity = typeof rawWatermark?.opacity === 'number' && !Number.isNaN(rawWatermark.opacity)
    ? rawWatermark.opacity
    : (DEFAULT_APP_SETTINGS.securityWatermark?.opacity ?? 0.10);
  if (watermarkOpacity < 0.05) watermarkOpacity = 0.05;
  if (watermarkOpacity > 0.30) watermarkOpacity = 0.30;

  const securityWatermark: SecurityWatermarkConfig = {
    enabled: typeof rawWatermark?.enabled === 'boolean'
      ? rawWatermark.enabled
      : (DEFAULT_APP_SETTINGS.securityWatermark?.enabled ?? false),
    text: typeof rawWatermark?.text === 'string'
      ? rawWatermark.text
      : (DEFAULT_APP_SETTINGS.securityWatermark?.text ?? ''),
    opacity: watermarkOpacity,
    showOnLiveCanvas: typeof rawWatermark?.showOnLiveCanvas === 'boolean'
      ? rawWatermark.showOnLiveCanvas
      : (DEFAULT_APP_SETTINGS.securityWatermark?.showOnLiveCanvas ?? false),
  };

  // Buang key legacy fitur yang telah dihapus agar tidak ikut tersebar ulang ke objek AppSettings
  const {
    clipboardWatcherEnabled: _legacyClipboardWatcher,
    clipboardAutoOpen: _legacyClipboardAutoOpen,
    ...sanitizedSaved
  } = saved as Partial<AppSettings> & Record<string, unknown>;

  return {
    ...DEFAULT_APP_SETTINGS,
    ...sanitizedSaved,
    gridMode:
      saved.gridMode === 'normal' || saved.gridMode === 'dimmed' || saved.gridMode === 'hidden'
        ? saved.gridMode
        : (saved.showGrid === false ? 'hidden' : 'normal'),
    showGrid: saved.gridMode ? saved.gridMode !== 'hidden' : (saved.showGrid ?? true),
    showCurrentPriceLine: saved.showCurrentPriceLine ?? DEFAULT_APP_SETTINGS.showCurrentPriceLine ?? true,
    showVolume: saved.showVolume ?? DEFAULT_APP_SETTINGS.showVolume ?? true,
    showIndicatorPriceLabels: saved.showIndicatorPriceLabels ?? DEFAULT_APP_SETTINGS.showIndicatorPriceLabels ?? true,
    showDrawingPriceLabels: saved.showDrawingPriceLabels ?? DEFAULT_APP_SETTINGS.showDrawingPriceLabels ?? true,
    colorModePreference:
      saved.colorModePreference === 'dark' ||
      saved.colorModePreference === 'light' ||
      saved.colorModePreference === 'system'
        ? saved.colorModePreference
        : (DEFAULT_APP_SETTINGS.colorModePreference ?? 'system'),
    syncChartWithAppTheme:
      typeof saved.syncChartWithAppTheme === 'boolean'
        ? saved.syncChartWithAppTheme
        : (DEFAULT_APP_SETTINGS.syncChartWithAppTheme ?? true),
    chartThemePreset:
      typeof saved.chartThemePreset === 'string' && saved.chartThemePreset
        ? saved.chartThemePreset
        : (typeof saved.themePreset === 'string' && saved.themePreset
            ? saved.themePreset
            : (DEFAULT_APP_SETTINGS.chartThemePreset ?? 'signature')),
    savedUserThemes: Array.isArray(saved.savedUserThemes)
      ? saved.savedUserThemes.filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string' && t.palette)
      : (DEFAULT_APP_SETTINGS.savedUserThemes ?? []),
    activeDarkPreset:
      typeof saved.activeDarkPreset === 'string' && saved.activeDarkPreset
        ? saved.activeDarkPreset
        : (DEFAULT_APP_SETTINGS.activeDarkPreset ?? 'signature'),
    activeLightPreset:
      typeof saved.activeLightPreset === 'string' && saved.activeLightPreset
        ? saved.activeLightPreset
        : (DEFAULT_APP_SETTINGS.activeLightPreset ?? 'red_folder'),
    activeDarkChartPreset:
      typeof saved.activeDarkChartPreset === 'string' && saved.activeDarkChartPreset
        ? saved.activeDarkChartPreset
        : (typeof saved.chartThemePreset === 'string' && saved.chartThemePreset && saved.chartThemePreset !== 'red_folder'
            ? saved.chartThemePreset
            : (DEFAULT_APP_SETTINGS.activeDarkChartPreset ?? 'signature')),
    activeLightChartPreset:
      typeof saved.activeLightChartPreset === 'string' && saved.activeLightChartPreset
        ? saved.activeLightChartPreset
        : (DEFAULT_APP_SETTINGS.activeLightChartPreset ?? 'red_folder'),
    autoSaveWorkspace: saved.autoSaveWorkspace ?? DEFAULT_APP_SETTINGS.autoSaveWorkspace ?? true,
    autoLoadLastWorkspace: saved.autoLoadLastWorkspace ?? DEFAULT_APP_SETTINGS.autoLoadLastWorkspace ?? true,
    showWorldClocks: saved.showWorldClocks ?? DEFAULT_APP_SETTINGS.showWorldClocks ?? true,
    worldClockCities: saved.worldClockCities ?? DEFAULT_APP_SETTINGS.worldClockCities ?? [
      ...DEFAULT_WORLD_CLOCK_CITIES,
    ],
    defaultTimeframe: saved.defaultTimeframe ?? DEFAULT_APP_SETTINGS.defaultTimeframe ?? '15m',
    snapshotIncludeFrame: saved.snapshotIncludeFrame ?? DEFAULT_APP_SETTINGS.snapshotIncludeFrame ?? true,
    snapshotIncludePrice: saved.snapshotIncludePrice ?? DEFAULT_APP_SETTINGS.snapshotIncludePrice ?? true,
    snapshotIncludeTimestamp: saved.snapshotIncludeTimestamp ?? DEFAULT_APP_SETTINGS.snapshotIncludeTimestamp ?? true,
    snapshotScope:
      saved.snapshotScope === 'all' || saved.snapshotScope === 'active'
        ? saved.snapshotScope
        : (DEFAULT_APP_SETTINGS.snapshotScope ?? 'active'),
    snapshotDirectory: saved.snapshotDirectory ?? DEFAULT_APP_SETTINGS.snapshotDirectory ?? '',
    snapshotScaleMultiplier:
      saved.snapshotScaleMultiplier === 1 ||
      saved.snapshotScaleMultiplier === 2 ||
      saved.snapshotScaleMultiplier === 4 ||
      saved.snapshotScaleMultiplier === 6
        ? saved.snapshotScaleMultiplier
        : (DEFAULT_APP_SETTINGS.snapshotScaleMultiplier ?? 2),
    snapshotThesisLayout:
      saved.snapshotThesisLayout === 'side-panel' ||
      saved.snapshotThesisLayout === 'overlay' ||
      saved.snapshotThesisLayout === 'hidden'
        ? saved.snapshotThesisLayout
        : (DEFAULT_APP_SETTINGS.snapshotThesisLayout ?? 'side-panel'),
    userProfile,
    customChartBackground: {
      mode:
        saved.customChartBackground?.mode === 'solid' ||
        saved.customChartBackground?.mode === 'gradient' ||
        saved.customChartBackground?.mode === 'theme'
          ? saved.customChartBackground.mode
          : 'theme',
      solidColor:
        saved.customChartBackground?.solidColor ||
        DEFAULT_APP_SETTINGS.customChartBackground?.solidColor ||
        '#0F0F0F',
      gradientTop:
        saved.customChartBackground?.gradientTop ||
        DEFAULT_APP_SETTINGS.customChartBackground?.gradientTop ||
        '#0F0F0F',
      gradientBottom:
        saved.customChartBackground?.gradientBottom ||
        DEFAULT_APP_SETTINGS.customChartBackground?.gradientBottom ||
        '#181A20',
    },
    securityWatermark,
    syncConfig: mergedSyncConfig,
  };
}

export interface LayoutTimeframePolicyParams {
  activeCell: any;
  cells: any[];
  defaultTimeframe?: string;
  syncTimeframe?: boolean;
}

/**
 * Menerapkan kebijakan timeframe saat layout multi-chart diperluas atau berganti:
 * - Cell aktif mempertahankan timeframe analisis saat ini.
 * - Cell tambahan/baru diinisialisasi dengan defaultTimeframe dari pengaturan.
 * - Jika syncTimeframe aktif, seluruh cell diselaraskan ke timeframe cell aktif.
 */
export function applyLayoutTimeframePolicy(params: LayoutTimeframePolicyParams): void {
  const { activeCell, cells, defaultTimeframe = '15m', syncTimeframe = false } = params;
  if (!cells || cells.length === 0) return;

  const activeTf = activeCell?.timeframe;

  for (const cell of cells) {
    if (cell === activeCell) {
      continue;
    }
    if (syncTimeframe && activeTf) {
      if (typeof cell.setTimeframe === 'function' && cell.timeframe !== activeTf) {
        cell.setTimeframe(activeTf);
      }
    } else if (defaultTimeframe) {
      if (typeof cell.setTimeframe === 'function' && cell.timeframe !== defaultTimeframe) {
        cell.setTimeframe(defaultTimeframe);
      }
    }
  }
}

