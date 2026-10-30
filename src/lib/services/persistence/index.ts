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
  private pendingDebounceData = new Map<string, { symbol: string; timeframe: string; doc: any }>();

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
    this.pendingDebounceData.set(key, { symbol, timeframe, doc });

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      this.pendingDebounceData.delete(key);
      try {
        const dataJson = typeof doc === 'string' ? doc : JSON.stringify(doc);
        await this.adapter.saveDrawings(symbol, timeframe, dataJson);
      } catch (err) {
        console.warn(`[PersistenceService] Gagal menyimpan debounced drawings ${key}:`, err);
      }
    }, delayMs);

    this.debounceTimers.set(key, timer);
  }

  async flushDrawings(targetSymbol?: string, targetTimeframe?: string): Promise<void> {
    if (targetSymbol && targetTimeframe) {
      const key = `${targetSymbol}:${targetTimeframe}`;
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
        this.debounceTimers.delete(key);
      }
      const pending = this.pendingDebounceData.get(key);
      this.pendingDebounceData.delete(key);
      if (pending) {
        try {
          const dataJson = typeof pending.doc === 'string' ? pending.doc : JSON.stringify(pending.doc);
          await this.adapter.saveDrawings(pending.symbol, pending.timeframe, dataJson);
        } catch (err) {
          console.warn(`[PersistenceService] Gagal flush drawings ${key}:`, err);
        }
      }
    } else if (targetSymbol) {
      const prefix = `${targetSymbol}:`;
      const promises: Promise<void>[] = [];
      for (const [key, timer] of [...this.debounceTimers.entries()]) {
        if (key.startsWith(prefix)) {
          clearTimeout(timer);
          this.debounceTimers.delete(key);
          const pending = this.pendingDebounceData.get(key);
          this.pendingDebounceData.delete(key);
          if (pending) {
            const dataJson = typeof pending.doc === 'string' ? pending.doc : JSON.stringify(pending.doc);
            promises.push(this.adapter.saveDrawings(pending.symbol, pending.timeframe, dataJson).catch(() => {}));
          }
        }
      }
      await Promise.all(promises);
    } else {
      const promises: Promise<void>[] = [];
      for (const [key, timer] of [...this.debounceTimers.entries()]) {
        clearTimeout(timer);
        const pending = this.pendingDebounceData.get(key);
        if (pending) {
          const dataJson = typeof pending.doc === 'string' ? pending.doc : JSON.stringify(pending.doc);
          promises.push(this.adapter.saveDrawings(pending.symbol, pending.timeframe, dataJson).catch(() => {}));
        }
      }
      this.debounceTimers.clear();
      this.pendingDebounceData.clear();
      await Promise.all(promises);
    }
  }

  async clearDrawings(symbol: string, timeframe: string): Promise<void> {
    const key = `${symbol}:${timeframe}`;
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
      this.debounceTimers.delete(key);
      this.pendingDebounceData.delete(key);
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

  async saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'timestamp'> & { id?: string }): Promise<SavedWorkspace> {
    const list = await this.loadWorkspaces();
    
    // 1. Jika ada ID yang ditentukan, timpa workspace dengan ID tersebut
    if (workspace.id) {
      const idx = list.findIndex((w) => w.id === workspace.id);
      if (idx !== -1) {
        const updated: SavedWorkspace = {
          ...list[idx],
          ...workspace,
          id: workspace.id,
          timestamp: Date.now(),
        };
        list[idx] = updated;
        await this.adapter.saveLayoutSlot('user_workspaces_list', 'User Saved Workspaces', JSON.stringify(list));
        return updated;
      }
    }

    // 2. Jika nama sama persis sudah ada di daftar, timpa entri tersebut
    const existingIndex = list.findIndex((w) => w.name.trim().toLowerCase() === workspace.name.trim().toLowerCase());
    if (existingIndex !== -1) {
      const updated: SavedWorkspace = {
        ...list[existingIndex],
        ...workspace,
        id: list[existingIndex].id,
        timestamp: Date.now(),
      };
      list[existingIndex] = updated;
      await this.adapter.saveLayoutSlot('user_workspaces_list', 'User Saved Workspaces', JSON.stringify(list));
      return updated;
    }

    // 3. Simpan sebagai workspace baru
    const newWorkspace: SavedWorkspace = {
      ...workspace,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    list.push(newWorkspace);
    await this.adapter.saveLayoutSlot('user_workspaces_list', 'User Saved Workspaces', JSON.stringify(list));
    return newWorkspace;
  }

  async updateWorkspace(workspace: SavedWorkspace): Promise<void> {
    const list = await this.loadWorkspaces();
    const idx = list.findIndex((w) => w.id === workspace.id);
    if (idx !== -1) {
      list[idx] = { ...workspace, timestamp: Date.now() };
    } else {
      list.push({ ...workspace, timestamp: Date.now() });
    }
    await this.adapter.saveLayoutSlot('user_workspaces_list', 'User Saved Workspaces', JSON.stringify(list));
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

  // ─── Layout Slot Direct Access ───

  async loadLayoutSlot(id: string): Promise<string | null> {
    return this.adapter.loadLayoutSlot(id);
  }

  async saveLayoutSlot(id: string, name: string, json: string): Promise<void> {
    await this.adapter.saveLayoutSlot(id, name, json);
  }
}


// Singleton Service Instance
export const storage = new PersistenceService();

// Export fungsi pembantu langsung untuk kompatibilitas & leverage pemanggil
export const loadDrawings = (sym: string, tf: string) => storage.loadDrawings(sym, tf);
export const saveDrawingsDebounced = (sym: string, tf: string, doc: any) => storage.saveDrawingsDebounced(sym, tf, doc);
export const flushDrawings = (sym?: string, tf?: string) => storage.flushDrawings(sym, tf);
export const clearDrawings = (sym: string, tf: string) => storage.clearDrawings(sym, tf);

export const loadWatchlist = () => storage.loadWatchlist();
export const saveWatchlist = (symbols: string[]) => storage.saveWatchlist(symbols);

export const loadAlerts = () => storage.loadAlerts();
export const saveAlerts = (alerts: PriceAlert[]) => storage.saveAlerts(alerts);

export const loadQuickSymbolsConfig = () => storage.loadQuickSymbolsConfig();
export const saveQuickSymbolsConfig = (cfg: QuickSymbolsConfig) => storage.saveQuickSymbolsConfig(cfg);

export const loadWorkspaces = () => storage.loadWorkspaces();
export const saveWorkspace = (w: Omit<SavedWorkspace, 'id' | 'timestamp'> & { id?: string }) => storage.saveWorkspace(w);
export const updateWorkspace = (w: SavedWorkspace) => storage.updateWorkspace(w);
export const deleteWorkspace = (id: string) => storage.deleteWorkspace(id);
export { getLastActiveWorkspaceId, setLastActiveWorkspaceId } from './workspaceService';

export const loadScripts = () => storage.loadScripts();
export const saveScript = (s: PineScriptRecord) => storage.saveScript(s);
export const deleteScript = (id: string) => storage.deleteScript(id);

export const loadSettings = () => storage.loadSettings();
export const saveSettings = (cfg: Partial<AppSettings>) => storage.saveSettings(cfg);
export { resolveAppSettings } from '../../constants/defaults';

export const loadChartDefaultConfig = () => storage.loadChartDefaultConfig();
export const saveChartDefaultConfig = (cfg: any) => storage.saveChartDefaultConfig(cfg);
export const clearChartDefaultConfig = () => storage.clearChartDefaultConfig();

export const loadLayoutSlot = (id: string) => storage.loadLayoutSlot(id);
export const saveLayoutSlot = (id: string, name: string, json: string) => storage.saveLayoutSlot(id, name, json);

