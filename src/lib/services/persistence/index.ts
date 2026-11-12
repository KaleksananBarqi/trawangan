// Modul Utama Persistence Trawangan: Deep Module yang Mengabstraksi Seluruh Persistensi
import type {
  SavedWorkspace,
  PineScriptRecord,
  PriceAlert,
  AppSettings,
  SavedTradingPlanRecord,
  MultiWatchlistRegistry,
} from '../../types/market';
import type { IPersistenceService, PersistenceAdapter } from './types';
import { InMemoryLocalStorageAdapter } from './inMemoryLocalStorageAdapter';
import { TauriSqliteAdapter } from './tauriSqliteAdapter';
import { normalizeWorkspace, WORKSPACE_SCHEMA_VERSION } from './workspaceSchema';
import {
  buildUpdatedWatchlistRegistry,
  extractActiveWatchlistSymbols,
} from './watchlistProjection';

export const DEFAULT_WATCHLIST_SYMBOLS: string[] = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
];

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

  // ─── Multi-Watchlist Registry & Watchlist Projection ───

  async loadWatchlistRegistry(): Promise<MultiWatchlistRegistry | null> {
    return await this.adapter.loadWatchlistRegistry();
  }

  async saveWatchlistRegistry(registry: MultiWatchlistRegistry): Promise<void> {
    await this.adapter.saveWatchlistRegistry(registry);
  }

  async loadWatchlist(): Promise<string[]> {
    const registry = await this.adapter.loadWatchlistRegistry();
    const projected = extractActiveWatchlistSymbols(registry);
    if (projected) return projected;

    // Fallback satu kali untuk data legacy sebelum registry terisi
    const legacy = await this.adapter.loadWatchlist();
    if (legacy && legacy.length > 0) return legacy;
    return [...DEFAULT_WATCHLIST_SYMBOLS];
  }

  async saveWatchlist(symbols: string[]): Promise<void> {
    const existing = await this.adapter.loadWatchlistRegistry();
    const nextRegistry = buildUpdatedWatchlistRegistry(existing, symbols);
    if (!nextRegistry) return;
    await this.adapter.saveWatchlistRegistry(nextRegistry);
  }

  // ─── Price Alerts Persistence ───

  async loadAlerts(): Promise<PriceAlert[]> {
    return await this.adapter.listAlerts();
  }

  async saveAlerts(alerts: PriceAlert[]): Promise<void> {
    await this.adapter.replaceAlerts(alerts);
  }

  // ─── Workspaces Persistence ───

  async loadWorkspaces(): Promise<SavedWorkspace[]> {
    const rawList = await this.adapter.listWorkspaces();
    return Array.isArray(rawList) ? rawList.map((item) => normalizeWorkspace(item)) : [];
  }

  async saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'timestamp'> & { id?: string }): Promise<SavedWorkspace> {
    const list = await this.loadWorkspaces();
    const withVersion = { ...workspace, schemaVersion: workspace.schemaVersion ?? WORKSPACE_SCHEMA_VERSION };

    // 1. Jika ada ID yang ditentukan, timpa workspace dengan ID tersebut
    // 2. Jika nama sama persis sudah ada di daftar, timpa entri tersebut
    const existingById = withVersion.id ? list.find((w) => w.id === withVersion.id) : undefined;
    const existingByName = !existingById
      ? list.find((w) => w.name.trim().toLowerCase() === withVersion.name.trim().toLowerCase())
      : undefined;
    const targetExisting = existingById || existingByName;
    if (targetExisting) {
      const updated: SavedWorkspace = {
        ...targetExisting,
        ...withVersion,
        id: existingById ? withVersion.id! : targetExisting.id,
        timestamp: Date.now(),
      };
      await this.adapter.upsertWorkspace(updated);
      return updated;
    }

    // 3. Simpan sebagai workspace baru
    const newWorkspace: SavedWorkspace = {
      ...withVersion,
      id: withVersion.id || Date.now().toString(),
      timestamp: Date.now(),
    };
    await this.adapter.upsertWorkspace(newWorkspace);
    return newWorkspace;
  }

  async updateWorkspace(workspace: SavedWorkspace): Promise<void> {
    await this.adapter.upsertWorkspace({ ...workspace, timestamp: Date.now() });
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.adapter.deleteWorkspace(id);
  }

  /**
   * Menyalin seluruh dokumen drawing beserta `_trawangan_meta` dari workspace sumber ke workspace tujuan (Save As).
   */
  async cloneWorkspaceDrawings(fromWsId: string, toWsId: string): Promise<number> {
    if (!fromWsId || !toWsId) return 0;
    const normFrom = fromWsId.trim().toLowerCase();
    const normTo = toWsId.trim().toLowerCase();
    if (!normFrom || !normTo || normFrom === normTo) return 0;

    // Pastikan seluruh perubahan tertunda sudah tersimpan sebelum disalin
    await this.flushDrawings();
    return this.adapter.cloneWorkspaceDrawings(fromWsId, toWsId);
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
    const raw = await this.adapter.getPreference('app_settings');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const json = JSON.stringify(settings);
    await this.adapter.setPreference('app_settings', json);
  }

  // ─── Chart Default Config Persistence ───

  async loadChartDefaultConfig(): Promise<any | null> {
    // 1. Coba baca dari adapter (SQLite / InMemory)
    const raw = await this.adapter.getPreference('chart_default_config');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (err) {
        console.warn('[PersistenceService] Gagal parsing JSON chart default config:', err);
      }
    }
    // 2. Fallback instan ke localStorage browser jika ada (dipertahankan hingga Tiket #172)
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
    await this.adapter.setPreference('chart_default_config', json);
    // Sinkronkan ke localStorage browser secara sementara hingga konsolidasi Tiket #172
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('trawangan_chart_default_config', json);
      } catch (_) {}
    }
  }

  async clearChartDefaultConfig(): Promise<void> {
    await this.adapter.deletePreference('chart_default_config');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('trawangan_chart_default_config');
      } catch (_) {}
    }
  }

  // ─── Trade Plan Vault (Riwayat Rencana Perdagangan Otomatis - ADR-0019) ───

  async loadTradingPlanHistory(): Promise<SavedTradingPlanRecord[]> {
    const list = await this.adapter.listTradingPlans();
    if (list.length > 0) return list;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const local = window.localStorage.getItem('trawangan_trade_plan_vault');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (_) {}
    }
    return [];
  }

  private syncVaultLocalStorageCache(list: SavedTradingPlanRecord[]): void {
    // Sinkronkan cache localStorage browser secara sementara hingga konsolidasi Tiket #172
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (list.length === 0) {
          window.localStorage.removeItem('trawangan_trade_plan_vault');
        } else {
          window.localStorage.setItem('trawangan_trade_plan_vault', JSON.stringify(list));
        }
      } catch (_) {}
    }
  }

  async saveTradingPlanToHistory(
    record: Omit<SavedTradingPlanRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number }
  ): Promise<SavedTradingPlanRecord> {
    const list = await this.loadTradingPlanHistory();
    const now = Date.now();
    const cleanSymbol = (record.symbol || record.plan?.symbol || 'BTCUSDT').trim().toUpperCase();
    const normSym = cleanSymbol.replace(/\.P$|-PERP$|PERP$/i, '');
    const targetSig = Array.isArray(record.plan?.targets)
      ? record.plan.targets.map((t: any) => Number(t?.price || 0)).join(',')
      : '';

    // Cek deduplikasi berdasarkan ID atau kombinasi identik (Simbol + Bias + Entry + SL + Target)
    const existingIdx = list.findIndex((item) => {
      if (record.id && item.id === record.id) return true;
      const itemNormSym = (item.symbol || '').trim().toUpperCase().replace(/\.P$|-PERP$|PERP$/i, '');
      const itemTargetSig = Array.isArray(item.plan?.targets)
        ? item.plan.targets.map((t: any) => Number(t?.price || 0)).join(',')
        : '';
      return (
        itemNormSym === normSym &&
        item.plan?.bias === record.plan?.bias &&
        Number(item.plan?.entry) === Number(record.plan?.entry) &&
        Number(item.plan?.stopLoss) === Number(record.plan?.stopLoss) &&
        itemTargetSig === targetSig
      );
    });

    const savedRecord: SavedTradingPlanRecord = existingIdx !== -1
      ? {
          ...list[existingIdx],
          ...record,
          id: list[existingIdx].id,
          symbol: cleanSymbol,
          createdAt: list[existingIdx].createdAt || record.createdAt || now,
          updatedAt: now,
          plan: JSON.parse(JSON.stringify(record.plan)),
        }
      : {
          id: record.id || `vault_plan_${now}_${Math.random().toString(36).slice(2, 7)}`,
          symbol: cleanSymbol,
          providerId: record.providerId || 'binance',
          timeframe: record.timeframe || '15m',
          createdAt: record.createdAt || now,
          updatedAt: now,
          rawText: record.rawText || record.plan?.rawText || '',
          plan: JSON.parse(JSON.stringify(record.plan)),
        };

    // Jika adapter masih kosong namun cache localStorage fallback berisi riwayat lama, migrasikan lebih dulu sebelum upsert
    const existingAdapterList = await this.adapter.listTradingPlans();
    if (existingAdapterList.length === 0 && list.length > 0) {
      for (const legacyItem of [...list].reverse()) {
        if (legacyItem.id !== savedRecord.id) {
          await this.adapter.upsertTradingPlan(legacyItem);
        }
      }
    }

    await this.adapter.upsertTradingPlan(savedRecord);
    const updatedList = await this.adapter.listTradingPlans();
    this.syncVaultLocalStorageCache(updatedList);
    return savedRecord;
  }

  async deleteTradingPlanFromHistory(id: string): Promise<SavedTradingPlanRecord[]> {
    await this.adapter.deleteTradingPlan(id);
    const filtered = await this.adapter.listTradingPlans();
    this.syncVaultLocalStorageCache(filtered);
    return filtered;
  }

  async clearTradingPlanHistory(): Promise<void> {
    await this.adapter.clearTradingPlans();
    this.syncVaultLocalStorageCache([]);
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
export const loadWatchlistRegistry = () => storage.loadWatchlistRegistry();
export const saveWatchlistRegistry = (registry: MultiWatchlistRegistry) => storage.saveWatchlistRegistry(registry);

export const loadAlerts = () => storage.loadAlerts();
export const saveAlerts = (alerts: PriceAlert[]) => storage.saveAlerts(alerts);

export const loadWorkspaces = () => storage.loadWorkspaces();
export const saveWorkspace = (w: Omit<SavedWorkspace, 'id' | 'timestamp'> & { id?: string }) => storage.saveWorkspace(w);
export const updateWorkspace = (w: SavedWorkspace) => storage.updateWorkspace(w);
export const deleteWorkspace = (id: string) => storage.deleteWorkspace(id);
export const cloneWorkspaceDrawings = (fromWsId: string, toWsId: string) => storage.cloneWorkspaceDrawings(fromWsId, toWsId);
export { getLastActiveWorkspaceId, setLastActiveWorkspaceId, computeWorkspaceFingerprint } from './workspaceService';

export const loadScripts = () => storage.loadScripts();
export const saveScript = (s: PineScriptRecord) => storage.saveScript(s);
export const deleteScript = (id: string) => storage.deleteScript(id);

export const loadSettings = () => storage.loadSettings();
export const saveSettings = (cfg: Partial<AppSettings>) => storage.saveSettings(cfg);
export { resolveAppSettings } from '../../constants/defaults';

export const loadChartDefaultConfig = () => storage.loadChartDefaultConfig();
export const saveChartDefaultConfig = (cfg: any) => storage.saveChartDefaultConfig(cfg);
export const clearChartDefaultConfig = () => storage.clearChartDefaultConfig();

export const loadTradingPlanHistory = () => storage.loadTradingPlanHistory();
export const saveTradingPlanToHistory = (
  record: Omit<SavedTradingPlanRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number }
) => storage.saveTradingPlanToHistory(record);
export const deleteTradingPlanFromHistory = (id: string) => storage.deleteTradingPlanFromHistory(id);
export const clearTradingPlanHistory = () => storage.clearTradingPlanHistory();

