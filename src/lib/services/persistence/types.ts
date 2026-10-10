// Kontrak Antarmuka (Interface) untuk Persistence Adapter dan Layanan Penyimpanan Trawangan
import type {
  SavedWorkspace,
  PineScriptRecord,
  PriceAlert,
  QuickSymbolsConfig,
  AppSettings,
} from '../../types/market';

/**
 * Adapter tingkat rendah di balik Seam penyimpanan.
 * Mengabstraksi apakah operasi disimpan ke SQLite via Tauri IPC atau In-Memory / LocalStorage.
 */
export interface PersistenceAdapter {
  // Gambar analisis teknikal (Drawings)
  loadDrawings(symbol: string, timeframe: string): Promise<string | null>;
  saveDrawings(symbol: string, timeframe: string, dataJson: string): Promise<void>;
  clearDrawings(symbol: string, timeframe: string): Promise<void>;

  // Daftar pantau koin (Watchlist)
  loadWatchlist(): Promise<string[] | null>;
  saveWatchlist(symbols: string[]): Promise<void>;

  // Skrip indikator Pine Script
  loadScripts(): Promise<PineScriptRecord[]>;
  saveScript(script: PineScriptRecord): Promise<void>;
  deleteScript(id: string): Promise<void>;

  // Slot tata letak & dokumen terstruktur (Workspaces, Alerts, Configs)
  loadLayoutSlot(id: string): Promise<string | null>;
  saveLayoutSlot(id: string, name: string, json: string): Promise<void>;
}

/**
 * Interface Domain Layanan Persistence Trawangan.
 * Memberikan leverage tinggi bagi pemanggil (callers) tanpa kebocoran detail teknis.
 */
export interface IPersistenceService {
  // Drawings
  loadDrawings(symbol: string, timeframe: string): Promise<any | null>;
  saveDrawingsDebounced(symbol: string, timeframe: string, doc: any): void;
  clearDrawings(symbol: string, timeframe: string): Promise<void>;

  // Watchlist
  loadWatchlist(): Promise<string[]>;
  saveWatchlist(symbols: string[]): Promise<void>;

  // Price Alerts
  loadAlerts(): Promise<PriceAlert[]>;
  saveAlerts(alerts: PriceAlert[]): Promise<void>;

  // Quick Symbols
  loadQuickSymbolsConfig(): Promise<QuickSymbolsConfig>;
  saveQuickSymbolsConfig(config: QuickSymbolsConfig): Promise<void>;

  // Workspaces
  loadWorkspaces(): Promise<SavedWorkspace[]>;
  saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'timestamp'>): Promise<SavedWorkspace>;
  deleteWorkspace(id: string): Promise<void>;

  // Pine Scripts
  loadScripts(): Promise<PineScriptRecord[]>;
  saveScript(script: PineScriptRecord): Promise<void>;
  deleteScript(id: string): Promise<void>;

  // App Settings
  loadSettings(): Promise<Partial<AppSettings> | null>;
  saveSettings(settings: Partial<AppSettings>): Promise<void>;
}
