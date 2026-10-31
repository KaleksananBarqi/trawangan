import type { AppSettings, MultiChartSyncConfig } from '../types/market';
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
  showReplayBar: false,
  showCurrentPriceLine: true,
  showVolume: true,
  showIndicatorPriceLabels: true,
  showDrawingPriceLabels: true,
  theme: 'signature',
  themePreset: 'signature',
  fontFamilyUi: 'Plus Jakarta Sans',
  fontFamilyMono: 'JetBrains Mono',
  uiDensity: 'regular',
  fontSize: 12,
  defaultTimeframe: '15m',
  favoriteTimeframes: ['1m', '5m', '15m', '1h', '4h', '1D'],
  customTimeframes: [],
  autoSaveWorkspace: true,
  autoLoadLastWorkspace: true,
  clipboardWatcherEnabled: true,
  clipboardAutoOpen: false,
  showWorldClocks: true,
  worldClockCities: [...DEFAULT_WORLD_CLOCK_CITIES],
  // Snapshot Preferences (#95, #125 Multi-Scale & Save Directory Setting)
  snapshotIncludeFrame: true,
  snapshotIncludePrice: true,
  snapshotIncludeTimestamp: true,
  snapshotScope: 'active',
  snapshotDirectory: '',
  snapshotScaleMultiplier: 2,
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

  return {
    ...DEFAULT_APP_SETTINGS,
    ...saved,
    showCurrentPriceLine: saved.showCurrentPriceLine ?? DEFAULT_APP_SETTINGS.showCurrentPriceLine ?? true,
    showVolume: saved.showVolume ?? DEFAULT_APP_SETTINGS.showVolume ?? true,
    showIndicatorPriceLabels: saved.showIndicatorPriceLabels ?? DEFAULT_APP_SETTINGS.showIndicatorPriceLabels ?? true,
    showDrawingPriceLabels: saved.showDrawingPriceLabels ?? DEFAULT_APP_SETTINGS.showDrawingPriceLabels ?? true,
    autoSaveWorkspace: saved.autoSaveWorkspace ?? DEFAULT_APP_SETTINGS.autoSaveWorkspace ?? true,
    autoLoadLastWorkspace: saved.autoLoadLastWorkspace ?? DEFAULT_APP_SETTINGS.autoLoadLastWorkspace ?? true,
    clipboardWatcherEnabled: saved.clipboardWatcherEnabled ?? DEFAULT_APP_SETTINGS.clipboardWatcherEnabled ?? true,
    clipboardAutoOpen: saved.clipboardAutoOpen ?? DEFAULT_APP_SETTINGS.clipboardAutoOpen ?? false,
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

