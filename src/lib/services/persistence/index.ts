// Modul Utama Persistence Trawangan: Deep Module yang Mengabstraksi Seluruh Persistensi
import type {
  SavedWorkspace,
  PineScriptRecord,
  PriceAlert,
  AppSettings,
  SavedTradingPlanRecord,
  MultiWatchlistRegistry,
  ProviderConfig,
} from '../../types/market';
import type { AppPreferenceKey, IPersistenceService, PersistenceAdapter, UiPreferenceKey } from './types';
import { InMemoryLocalStorageAdapter } from './inMemoryLocalStorageAdapter';
import { TauriSqliteAdapter } from './tauriSqliteAdapter';
import { normalizeWorkspace, WORKSPACE_SCHEMA_VERSION } from './workspaceSchema';
import {
  buildUpdatedWatchlistRegistry,
  extractActiveWatchlistSymbols,
} from './watchlistProjection';
import { DEFAULT_PROVIDERS } from '../market/constants';

export const DEFAULT_WATCHLIST_SYMBOLS: string[] = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
];

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function cloneProviders(list: ProviderConfig[]): ProviderConfig[] {
  return list.map((p) => ({ ...p }));
}

function mergeProvidersWithDefaults(persisted: ProviderConfig[]): ProviderConfig[] {
  const validPersisted = Array.isArray(persisted)
    ? persisted.filter((p) => p && typeof p.id === 'string' && p.id.trim().length > 0)
    : [];
  if (validPersisted.length === 0) {
    return cloneProviders(DEFAULT_PROVIDERS);
  }

  const hasActivePersisted = validPersisted.some((p) => Boolean(p.is_active));
  const byId = new Map<string, ProviderConfig>();

  for (const def of DEFAULT_PROVIDERS) {
    byId.set(def.id, {
      ...def,
      is_active: hasActivePersisted ? false : def.is_active,
    });
  }

  for (const item of validPersisted) {
    const existingDefault = byId.get(item.id);
    byId.set(item.id, existingDefault ? { ...existingDefault, ...item } : { ...item });
  }

  return Array.from(byId.values());
}

export class PersistenceService implements IPersistenceService {
  private adapter: PersistenceAdapter;
  private debounceTimers = new Map<string, any>();
  private pendingDebounceData = new Map<string, { symbol: string; timeframe: string; doc: any }>();
  private preferenceCache = new Map<string, string>();
  private preferenceWriteEpoch = new Map<string, number>();
  private providersCache: ProviderConfig[] | null = null;
  private adapterPersistedProviderIds: Set<string> | null = null;
  private bootstrapped = false;
  private bootstrapPromise: Promise<void> | null = null;

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
    this.bootstrapped = false;
    this.bootstrapPromise = null;
    this.preferenceCache.clear();
    this.preferenceWriteEpoch.clear();
    this.providersCache = null;
    this.adapterPersistedProviderIds = null;
  }

  // ─── Bootstrap & Cache Sinkron Preferensi ───

  isBootstrapped(): boolean {
    return this.bootstrapped;
  }

  /**
   * Memuat seluruh entri preferensi dan konfigurasi provider secara paralel satu kali saat startup UI (idempoten).
   */
  async bootstrap(): Promise<void> {
    if (this.bootstrapped) return;
    if (this.bootstrapPromise) return this.bootstrapPromise;

    const targetAdapter = this.adapter;
    const run = (async () => {
      const [preferences, providers] = await Promise.all([
        targetAdapter.loadAllPreferences(),
        targetAdapter.loadProviders(),
      ]);
      if (this.adapter !== targetAdapter) return;

      this.preferenceCache.clear();
      if (Array.isArray(preferences)) {
        for (const entry of preferences) {
          if (entry && typeof entry.key === 'string' && typeof entry.value_json === 'string') {
            this.preferenceCache.set(entry.key, entry.value_json);
          }
        }
      }
      this.syncProvidersCacheFromAdapter(providers);
      this.bootstrapped = true;
    })();

    this.bootstrapPromise = run;
    try {
      await run;
    } finally {
      if (this.bootstrapPromise === run) {
        this.bootstrapPromise = null;
      }
    }
  }

  /**
   * Membaca nilai JSON preferensi secara sinkron dari cache memori (mengembalikan null aman bila belum siap).
   */
  getPreferenceSync(key: AppPreferenceKey): string | null {
    return this.preferenceCache.get(key) ?? null;
  }

  private parseCachedJsonPreference<T>(key: AppPreferenceKey): T | null {
    const raw = this.getPreferenceSync(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Membaca dan mem-parsing preferensi UI bertipe dari cache bootstrap secara sinkron.
   */
  getUiPreferenceSync<T>(key: UiPreferenceKey): T | null {
    const raw = this.getPreferenceSync(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[PersistenceService] Gagal parsing JSON preferensi UI "${key}":`, err);
      return null;
    }
  }

  /**
   * Menyimpan preferensi UI bertipe ke adapter `app_preferences` dan menyinkronkan cache secara langsung.
   */
  async setUiPreference<T>(key: UiPreferenceKey, value: T): Promise<void> {
    if (value === undefined) {
      throw new Error(`Nilai preferensi UI "${key}" tidak boleh undefined (JSON tidak valid)`);
    }
    const json = JSON.stringify(value);
    if (typeof json !== 'string') {
      throw new Error(`Nilai preferensi UI "${key}" gagal diserialisasi ke JSON`);
    }
    await this.setAndSyncPreference(key, json);
  }

  /**
   * Menghapus preferensi UI dari adapter `app_preferences` dan cache memori.
   */
  async removeUiPreference(key: UiPreferenceKey): Promise<void> {
    await this.deleteAndSyncPreference(key);
  }
  private async getAndSyncPreference(key: AppPreferenceKey): Promise<string | null> {
    const startEpoch = this.preferenceWriteEpoch.get(key) ?? 0;
    const raw = await this.adapter.getPreference(key);
    // Hindari pembacaan asinkron yang terlambat menimpa mutasi/penghapusan terbaru pada key yang sama
    if ((this.preferenceWriteEpoch.get(key) ?? 0) !== startEpoch) {
      return this.preferenceCache.get(key) ?? null;
    }
    if (raw !== null) {
      this.preferenceCache.set(key, raw);
    } else {
      this.preferenceCache.delete(key);
    }
    return raw;
  }

  private async setAndSyncPreference(key: AppPreferenceKey, valueJson: string): Promise<void> {
    // Perbarui cache secara optimistik agar pembaca sinkron langsung konsisten, lalu rollback bila adapter gagal
    const nextEpoch = (this.preferenceWriteEpoch.get(key) ?? 0) + 1;
    this.preferenceWriteEpoch.set(key, nextEpoch);
    const prev = this.preferenceCache.get(key);
    this.preferenceCache.set(key, valueJson);
    try {
      await this.adapter.setPreference(key, valueJson);
    } catch (err) {
      if (this.preferenceWriteEpoch.get(key) === nextEpoch) {
        if (prev !== undefined) {
          this.preferenceCache.set(key, prev);
        } else {
          this.preferenceCache.delete(key);
        }
      }
      throw err;
    }
  }

  private async deleteAndSyncPreference(key: AppPreferenceKey): Promise<void> {
    const nextEpoch = (this.preferenceWriteEpoch.get(key) ?? 0) + 1;
    this.preferenceWriteEpoch.set(key, nextEpoch);
    const prev = this.preferenceCache.get(key);
    this.preferenceCache.delete(key);
    try {
      await this.adapter.deletePreference(key);
    } catch (err) {
      if (this.preferenceWriteEpoch.get(key) === nextEpoch) {
        if (prev !== undefined) {
          this.preferenceCache.set(key, prev);
        }
      }
      throw err;
    }
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

  getLastActiveWorkspaceIdSync(): string | null {
    const parsed = this.parseCachedJsonPreference<unknown>('last_active_workspace_id');
    return typeof parsed === 'string' && parsed.trim().length > 0 ? parsed.trim() : null;
  }

  async setLastActiveWorkspaceId(id: string | null | undefined): Promise<void> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      await this.deleteAndSyncPreference('last_active_workspace_id');
      return;
    }
    await this.setAndSyncPreference('last_active_workspace_id', JSON.stringify(id.trim()));
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

  getSettingsSync(): Partial<AppSettings> | null {
    const parsed = this.parseCachedJsonPreference<Partial<AppSettings>>('app_settings');
    return parsed && typeof parsed === 'object' ? parsed : null;
  }

  async loadSettings(): Promise<Partial<AppSettings> | null> {
    const raw = await this.getAndSyncPreference('app_settings');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const json = JSON.stringify(settings);
    await this.setAndSyncPreference('app_settings', json);
  }

  // ─── Chart Default Config Persistence ───

  getChartDefaultConfigSync(): any | null {
    return this.parseCachedJsonPreference<any>('chart_default_config');
  }

  async loadChartDefaultConfig(): Promise<any | null> {
    const raw = await this.getAndSyncPreference('chart_default_config');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (err) {
        console.warn('[PersistenceService] Gagal parsing JSON chart default config:', err);
      }
    }
    return null;
  }

  async saveChartDefaultConfig(config: any): Promise<void> {
    const json = typeof config === 'string' ? config : JSON.stringify(config);
    await this.setAndSyncPreference('chart_default_config', json);
  }

  async clearChartDefaultConfig(): Promise<void> {
    await this.deleteAndSyncPreference('chart_default_config');
  }

  // ─── Trade Plan Vault (Riwayat Rencana Perdagangan Otomatis - ADR-0019) ───

  async loadTradingPlanHistory(): Promise<SavedTradingPlanRecord[]> {
    return await this.adapter.listTradingPlans();
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

    await this.adapter.upsertTradingPlan(savedRecord);
    return savedRecord;
  }

  async deleteTradingPlanFromHistory(id: string): Promise<SavedTradingPlanRecord[]> {
    await this.adapter.deleteTradingPlan(id);
    return await this.adapter.listTradingPlans();
  }

  async clearTradingPlanHistory(): Promise<void> {
    await this.adapter.clearTradingPlans();
  }

  // ─── Market Data Providers Persistence ───

  private syncProvidersCacheFromAdapter(rawProviders: ProviderConfig[]): ProviderConfig[] {
    const persistedIds = new Set<string>();
    if (Array.isArray(rawProviders)) {
      for (const p of rawProviders) {
        if (p && typeof p.id === 'string' && p.id.trim().length > 0) {
          persistedIds.add(p.id);
        }
      }
    }
    this.adapterPersistedProviderIds = persistedIds;
    const merged = mergeProvidersWithDefaults(rawProviders);
    this.providersCache = merged;
    return merged;
  }

  getProvidersSync(): ProviderConfig[] {
    return cloneProviders(this.providersCache ?? DEFAULT_PROVIDERS);
  }

  async loadProviders(): Promise<ProviderConfig[]> {
    const raw = await this.adapter.loadProviders();
    const resolved = this.syncProvidersCacheFromAdapter(raw);
    return cloneProviders(resolved);
  }

  async saveProvider(provider: ProviderConfig): Promise<void> {
    await this.adapter.saveProvider(provider);
    this.adapterPersistedProviderIds?.add(provider.id);

    const base = cloneProviders(this.providersCache ?? DEFAULT_PROVIDERS).filter(
      (p) => p.id !== provider.id
    );
    const next = provider.is_active
      ? base.map((p) => ({ ...p, is_active: false }))
      : base;
    next.push({ ...provider });
    this.providersCache = next;
  }

  async setActiveProvider(id: string): Promise<void> {
    const defaultCandidate = DEFAULT_PROVIDERS.find((p) => p.id === id);
    if (
      this.adapterPersistedProviderIds !== null &&
      !this.adapterPersistedProviderIds.has(id) &&
      defaultCandidate
    ) {
      // Pastikan preset bawaan TS yang belum di-seed oleh Rust (seperti indodax/yahoo) tetap tersimpan aktif di SQLite
      await this.adapter.saveProvider({ ...defaultCandidate, is_active: true });
      this.adapterPersistedProviderIds.add(id);
    } else {
      await this.adapter.setActiveProvider(id);
    }

    const base = cloneProviders(this.providersCache ?? DEFAULT_PROVIDERS);
    this.providersCache = base.map((p) => ({
      ...p,
      is_active: p.id === id,
    }));
  }

  async deleteProvider(id: string): Promise<void> {
    await this.adapter.deleteProvider(id);
    this.adapterPersistedProviderIds?.delete(id);
    const base = cloneProviders(this.providersCache ?? DEFAULT_PROVIDERS);
    this.providersCache = base.filter((p) => p.id !== id);
  }
}


// Singleton Service Instance
export const storage = new PersistenceService();

// Export fungsi pembantu langsung untuk kompatibilitas & leverage pemanggil
export type { AppPreferenceKey, IPersistenceService, UiPreferenceKey } from './types';
export const bootstrapPersistence = () => storage.bootstrap();
export const isPersistenceBootstrapped = () => storage.isBootstrapped();
export const getPreferenceSync = (key: AppPreferenceKey) => storage.getPreferenceSync(key);
export const getUiPreferenceSync = <T>(key: UiPreferenceKey) => storage.getUiPreferenceSync<T>(key);
export const setUiPreference = <T>(key: UiPreferenceKey, value: T) => storage.setUiPreference<T>(key, value);
export const removeUiPreference = (key: UiPreferenceKey) => storage.removeUiPreference(key);

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
export const getLastActiveWorkspaceId = () => storage.getLastActiveWorkspaceIdSync();
export const setLastActiveWorkspaceId = (id: string | null | undefined) => storage.setLastActiveWorkspaceId(id);
export { computeWorkspaceFingerprint } from './workspaceService';

export const loadScripts = () => storage.loadScripts();
export const saveScript = (s: PineScriptRecord) => storage.saveScript(s);
export const deleteScript = (id: string) => storage.deleteScript(id);

export const getSettingsSync = () => storage.getSettingsSync();
export const loadSettings = () => storage.loadSettings();
export const saveSettings = (cfg: Partial<AppSettings>) => storage.saveSettings(cfg);
export { resolveAppSettings } from '../../constants/defaults';

export const getChartDefaultConfigSync = () => storage.getChartDefaultConfigSync();
export const loadChartDefaultConfig = () => storage.loadChartDefaultConfig();
export const saveChartDefaultConfig = (cfg: any) => storage.saveChartDefaultConfig(cfg);
export const clearChartDefaultConfig = () => storage.clearChartDefaultConfig();

export const loadTradingPlanHistory = () => storage.loadTradingPlanHistory();
export const saveTradingPlanToHistory = (
  record: Omit<SavedTradingPlanRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number }
) => storage.saveTradingPlanToHistory(record);
export const deleteTradingPlanFromHistory = (id: string) => storage.deleteTradingPlanFromHistory(id);
export const clearTradingPlanHistory = () => storage.clearTradingPlanHistory();

export const getProvidersSync = () => storage.getProvidersSync();
export const loadProviders = () => storage.loadProviders();
export const saveProvider = (provider: ProviderConfig) => storage.saveProvider(provider);
export const setActiveProvider = (id: string) => storage.setActiveProvider(id);
export const deleteProvider = (id: string) => storage.deleteProvider(id);

