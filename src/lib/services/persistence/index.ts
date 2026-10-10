// Modul Utama Persistence Trawangan: Deep Module yang Mengabstraksi Seluruh Persistensi
import type {
  SavedWorkspace,
  PineScriptRecord,
  PriceAlert,
  QuickSymbolsConfig,
  AppSettings,
} from '../../types/market';
import type { IPersistenceService, PersistenceAdapter } from './types';
import { InMemoryLocalStorageAdapter } from './inMemoryLocalStorageAdapter';
import { TauriSqliteAdapter } from './tauriSqliteAdapter';

export const DEFAULT_WATCHLIST_SYMBOLS: string[] = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
];

export const DEFAULT_QUICK_SYMBOLS_CONFIG: QuickSymbolsConfig = {
  mode: 'watchlist',
  customSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'],
  maxDisplayCount: 5,
};

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export class PersistenceService implements IPersistenceService {
  private adapter: PersistenceAdapter;
  private debounceTimers = new Map<string, any>();

  constructor(customAdapter?: PersistenceAdapter) {
    if (customAdapter) {
      this.adapter = customAdapter;
    } else if (isTauriEnvironment()) {
      this.adapter = new TauriSqliteAdapter();
    } else {
      this.adapter = new InMemoryLocalStorageAdapter();
    }
  }

  /**
   * Mengganti adapter secara dinamis (sangat berguna untuk headless testing / mocking)
   */
  public setAdapter(adapter: PersistenceAdapter): void {
    this.adapter = adapter;
  }

  // ─── Drawings Persistence (Debounced) ───

  async loadDrawings(symbol: string, timeframe: string): Promise<any | null> {
    const raw = await this.adapter.loadDrawings(symbol, timeframe);
    if (!raw) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      console.warn(`[PersistenceService] Gagal parsing JSON drawings ${symbol}:${timeframe}:`, err);
      return null;
    }
  }

  saveDrawingsDebounced(symbol: string, timeframe: string, doc: any, delayMs = 400): void {
    const key = `${symbol}:${timeframe}`;
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      try {
        const dataJson = typeof doc === 'string' ? doc : JSON.stringify(doc);
        await this.adapter.saveDrawings(symbol, timeframe, dataJson);
      } catch (err) {
        console.warn(`[PersistenceService] Gagal menyimpan debounced drawings ${key}:`, err);
      }
    }, delayMs);

    this.debounceTimers.set(key, timer);
  }

  async clearDrawings(symbol: string, timeframe: string): Promise<void> {
    const key = `${symbol}:${timeframe}`;
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
      this.debounceTimers.delete(key);
    }
    await this.adapter.clearDrawings(symbol, timeframe);
  }

  // ─── Watchlist Persistence ───

  async loadWatchlist(): Promise<string[]> {
    const list = await this.adapter.loadWatchlist();
    if (list && list.length > 0) return list;
    return [...DEFAULT_WATCHLIST_SYMBOLS];
  }

  async saveWatchlist(symbols: string[]): Promise<void> {
    await this.adapter.saveWatchlist(symbols);
  }

  // ─── Price Alerts Persistence ───

  async loadAlerts(): Promise<PriceAlert[]> {
    const raw = await this.adapter.loadLayoutSlot('user_price_alerts');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async saveAlerts(alerts: PriceAlert[]): Promise<void> {
    const json = JSON.stringify(alerts);
    await this.adapter.saveLayoutSlot('user_price_alerts', 'User Price Alerts', json);
  }

  // ─── Quick Symbols Config Persistence ───

  async loadQuickSymbolsConfig(): Promise<QuickSymbolsConfig> {
    const raw = await this.adapter.loadLayoutSlot('user_quick_symbols_config');
    if (!raw) return { ...DEFAULT_QUICK_SYMBOLS_CONFIG };
    try {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_QUICK_SYMBOLS_CONFIG,
        ...parsed,
      };
    } catch {
      return { ...DEFAULT_QUICK_SYMBOLS_CONFIG };
    }
  }

  async saveQuickSymbolsConfig(config: QuickSymbolsConfig): Promise<void> {
    const json = JSON.stringify(config);
    await this.adapter.saveLayoutSlot('user_quick_symbols_config', 'User Quick Symbols Config', json);
  }

  // ─── Workspaces Persistence ───

  async loadWorkspaces(): Promise<SavedWorkspace[]> {
    const raw = await this.adapter.loadLayoutSlot('user_workspaces_list');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'timestamp'>): Promise<SavedWorkspace> {
    const list = await this.loadWorkspaces();
    const newWorkspace: SavedWorkspace = {
      ...workspace,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    list.push(newWorkspace);
    await this.adapter.saveLayoutSlot('user_workspaces_list', 'User Saved Workspaces', JSON.stringify(list));
    return newWorkspace;
  }

  async deleteWorkspace(id: string): Promise<void> {
    const list = await this.loadWorkspaces();
    const filtered = list.filter((w) => w.id !== id);
    await this.adapter.saveLayoutSlot('user_workspaces_list', 'User Saved Workspaces', JSON.stringify(filtered));
  }

  // ─── Pine Scripts Persistence ───

  async loadScripts(): Promise<PineScriptRecord[]> {
    return this.adapter.loadScripts();
  }

  async saveScript(script: PineScriptRecord): Promise<void> {
    await this.adapter.saveScript(script);
  }

  async deleteScript(id: string): Promise<void> {
    await this.adapter.deleteScript(id);
  }

  // ─── App Settings Persistence ───

  async loadSettings(): Promise<Partial<AppSettings> | null> {
    const raw = await this.adapter.loadLayoutSlot('trawangan_app_settings');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const json = JSON.stringify(settings);
    await this.adapter.saveLayoutSlot('trawangan_app_settings', 'User App Settings', json);
  }

  // ─── Chart Default Config Persistence ───

  async loadChartDefaultConfig(): Promise<any | null> {
    // 1. Coba baca dari adapter (SQLite / InMemory)
    const raw = await this.adapter.loadLayoutSlot('trawangan_chart_default_config');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (err) {
        console.warn('[PersistenceService] Gagal parsing JSON chart default config:', err);
      }
    }
    // 2. Fallback instan ke localStorage browser jika ada
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const local = window.localStorage.getItem('trawangan_chart_default_config');
        if (local) return JSON.parse(local);
      } catch (_) {}
    }
    return null;
  }

  async saveChartDefaultConfig(config: any): Promise<void> {
    const json = typeof config === 'string' ? config : JSON.stringify(config);
    // Simpan ke adapter (SQLite / InMemory)
    await this.adapter.saveLayoutSlot('trawangan_chart_default_config', 'User Chart Default Config', json);
    // Sinkronkan ke localStorage browser untuk fallback cepat
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('trawangan_chart_default_config', json);
      } catch (_) {}
    }
  }

  async clearChartDefaultConfig(): Promise<void> {
    await this.adapter.saveLayoutSlot('trawangan_chart_default_config', 'User Chart Default Config', '');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('trawangan_chart_default_config');
      } catch (_) {}
    }
  }
}

// Singleton Service Instance
export const storage = new PersistenceService();

// Export fungsi pembantu langsung untuk kompatibilitas & leverage pemanggil
export const loadDrawings = (sym: string, tf: string) => storage.loadDrawings(sym, tf);
export const saveDrawingsDebounced = (sym: string, tf: string, doc: any) => storage.saveDrawingsDebounced(sym, tf, doc);
export const clearDrawings = (sym: string, tf: string) => storage.clearDrawings(sym, tf);

export const loadWatchlist = () => storage.loadWatchlist();
export const saveWatchlist = (symbols: string[]) => storage.saveWatchlist(symbols);

export const loadAlerts = () => storage.loadAlerts();
export const saveAlerts = (alerts: PriceAlert[]) => storage.saveAlerts(alerts);

export const loadQuickSymbolsConfig = () => storage.loadQuickSymbolsConfig();
export const saveQuickSymbolsConfig = (cfg: QuickSymbolsConfig) => storage.saveQuickSymbolsConfig(cfg);

export const loadWorkspaces = () => storage.loadWorkspaces();
export const saveWorkspace = (w: Omit<SavedWorkspace, 'id' | 'timestamp'>) => storage.saveWorkspace(w);
export const deleteWorkspace = (id: string) => storage.deleteWorkspace(id);

export const loadScripts = () => storage.loadScripts();
export const saveScript = (s: PineScriptRecord) => storage.saveScript(s);
export const deleteScript = (id: string) => storage.deleteScript(id);

export const loadSettings = () => storage.loadSettings();
export const saveSettings = (cfg: Partial<AppSettings>) => storage.saveSettings(cfg);

export const loadChartDefaultConfig = () => storage.loadChartDefaultConfig();
export const saveChartDefaultConfig = (cfg: any) => storage.saveChartDefaultConfig(cfg);
export const clearChartDefaultConfig = () => storage.clearChartDefaultConfig();
