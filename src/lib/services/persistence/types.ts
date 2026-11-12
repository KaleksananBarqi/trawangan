// Kontrak Antarmuka (Interface) untuk Persistence Adapter dan Layanan Penyimpanan Trawangan
import type {
  SavedWorkspace,
  PineScriptRecord,
  PriceAlert,
  AppSettings,
  SavedTradingPlanRecord,
  MultiWatchlistRegistry,
  ProviderConfig,
} from '../../types/market';

export interface DrawingKeyEntry {
  symbol: string;
  timeframe: string;
}

export type AppPreferenceKey = 'app_settings' | 'chart_default_config';

export interface AppPreferenceRecord {
  key: string;
  value_json: string;
  updated_at: number;
}

/**
 * Adapter tingkat rendah di balik Seam penyimpanan.
 * Mengabstraksi apakah operasi disimpan ke SQLite via Tauri IPC atau In-Memory / LocalStorage.
 */
export interface PersistenceAdapter {
  // Gambar analisis teknikal (Drawings)
  loadDrawings(symbol: string, timeframe: string): Promise<string | null>;
  saveDrawings(symbol: string, timeframe: string, dataJson: string): Promise<void>;
  clearDrawings(symbol: string, timeframe: string): Promise<void>;
  listDrawingKeys?(prefix: string): Promise<DrawingKeyEntry[]>;
  cloneWorkspaceDrawings(fromWsId: string, toWsId: string): Promise<number>;

  // Workspaces (Workspace State v2)
  listWorkspaces(): Promise<SavedWorkspace[]>;
  upsertWorkspace(workspace: SavedWorkspace): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;

  // Price Alerts & Plan-Linked Auto-Alerts
  listAlerts(): Promise<PriceAlert[]>;
  replaceAlerts(alerts: PriceAlert[]): Promise<void>;

  // Trade Plan Vault (kapasitas maksimal 200 entri terbaru)
  listTradingPlans(): Promise<SavedTradingPlanRecord[]>;
  upsertTradingPlan(record: SavedTradingPlanRecord): Promise<void>;
  deleteTradingPlan(id: string): Promise<void>;
  clearTradingPlans(): Promise<void>;

  // Daftar pantau koin (Watchlist & Multi-Watchlist Registry relasional)
  loadWatchlist(): Promise<string[] | null>;
  saveWatchlist(symbols: string[]): Promise<void>;
  loadWatchlistRegistry(): Promise<MultiWatchlistRegistry | null>;
  saveWatchlistRegistry(registry: MultiWatchlistRegistry): Promise<void>;

  // Skrip indikator Pine Script
  loadScripts(): Promise<PineScriptRecord[]>;
  saveScript(script: PineScriptRecord): Promise<void>;
  deleteScript(id: string): Promise<void>;

  // Preferensi aplikasi & konfigurasi default chart (`app_preferences`)
  getPreference(key: AppPreferenceKey): Promise<string | null>;
  setPreference(key: AppPreferenceKey, valueJson: string): Promise<void>;
  deletePreference(key: AppPreferenceKey): Promise<void>;
  loadAllPreferences(): Promise<AppPreferenceRecord[]>;

  // Konfigurasi provider data pasar (`providers`)
  loadProviders(): Promise<ProviderConfig[]>;
  saveProvider(provider: ProviderConfig): Promise<void>;
  setActiveProvider(id: string): Promise<void>;
  deleteProvider(id: string): Promise<void>;
}

/**
 * Interface Domain Layanan Persistence Trawangan.
 * Memberikan leverage tinggi bagi pemanggil (callers) tanpa kebocoran detail teknis.
 */
export interface IPersistenceService {
  // Bootstrap & Cache Sinkron Preferensi
  bootstrap(): Promise<void>;
  isBootstrapped(): boolean;
  getPreferenceSync(key: AppPreferenceKey): string | null;

  // Drawings
  loadDrawings(symbol: string, timeframe: string): Promise<any | null>;
  saveDrawingsDebounced(symbol: string, timeframe: string, doc: any): void;
  flushDrawings(symbol?: string, timeframe?: string): Promise<void>;
  clearDrawings(symbol: string, timeframe: string): Promise<void>;

  // Watchlist
  loadWatchlist(): Promise<string[]>;
  saveWatchlist(symbols: string[]): Promise<void>;
  loadWatchlistRegistry(): Promise<MultiWatchlistRegistry | null>;
  saveWatchlistRegistry(registry: MultiWatchlistRegistry): Promise<void>;

  // Price Alerts
  loadAlerts(): Promise<PriceAlert[]>;
  saveAlerts(alerts: PriceAlert[]): Promise<void>;

  // Workspaces
  loadWorkspaces(): Promise<SavedWorkspace[]>;
  saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'timestamp'> & { id?: string }): Promise<SavedWorkspace>;
  updateWorkspace(workspace: SavedWorkspace): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  cloneWorkspaceDrawings(fromWsId: string, toWsId: string): Promise<number>;

  // Pine Scripts
  loadScripts(): Promise<PineScriptRecord[]>;
  saveScript(script: PineScriptRecord): Promise<void>;
  deleteScript(id: string): Promise<void>;

  // App Settings
  loadSettings(): Promise<Partial<AppSettings> | null>;
  saveSettings(settings: Partial<AppSettings>): Promise<void>;

  // Chart Default Configuration
  loadChartDefaultConfig(): Promise<any | null>;
  saveChartDefaultConfig(config: any): Promise<void>;
  clearChartDefaultConfig(): Promise<void>;

  // Trade Plan Vault (Riwayat Rencana Perdagangan Otomatis - ADR-0019)
  loadTradingPlanHistory(): Promise<SavedTradingPlanRecord[]>;
  saveTradingPlanToHistory(
    record: Omit<SavedTradingPlanRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number }
  ): Promise<SavedTradingPlanRecord>;
  deleteTradingPlanFromHistory(id: string): Promise<SavedTradingPlanRecord[]>;
  clearTradingPlanHistory(): Promise<void>;

  // Provider Data Pasar
  getProvidersSync(): ProviderConfig[];
  loadProviders(): Promise<ProviderConfig[]>;
  saveProvider(provider: ProviderConfig): Promise<void>;
  setActiveProvider(id: string): Promise<void>;
  deleteProvider(id: string): Promise<void>;
}


