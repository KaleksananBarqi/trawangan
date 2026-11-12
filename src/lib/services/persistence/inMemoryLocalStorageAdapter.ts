// Adapter In-Memory & Web LocalStorage untuk Lingkungan Pengujian dan Web Fallback
import type { AppPreferenceKey, AppPreferenceRecord, DrawingKeyEntry, PersistenceAdapter } from './types';
import type {
  MultiWatchlistRegistry,
  PineScriptRecord,
  PriceAlert,
  SavedTradingPlanRecord,
  SavedWorkspace,
} from '../../types/market';

const PREF_KEY_PREFIX = 'trawangan_pref_';

export class InMemoryLocalStorageAdapter implements PersistenceAdapter {
  private memoryStore = new Map<string, string>();
  private preferenceTimestamps = new Map<string, number>();

  private getItem(key: string): string | null {
    if (this.memoryStore.has(key)) {
      return this.memoryStore.get(key) || null;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) {
          this.memoryStore.set(key, val);
          return val;
        }
      } catch (_) {}
    }
    return null;
  }

  private setItem(key: string, value: string): void {
    this.memoryStore.set(key, value);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    }
  }

  private removeItem(key: string): void {
    this.memoryStore.delete(key);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    }
  }

  async loadDrawings(symbol: string, timeframe: string): Promise<string | null> {
    const key = `trawangan_drawings_${symbol}_${timeframe}`;
    return this.getItem(key);
  }

  async saveDrawings(symbol: string, timeframe: string, dataJson: string): Promise<void> {
    const key = `trawangan_drawings_${symbol}_${timeframe}`;
    this.setItem(key, dataJson);
  }

  async clearDrawings(symbol: string, timeframe: string): Promise<void> {
    const key = `trawangan_drawings_${symbol}_${timeframe}`;
    this.removeItem(key);
  }

  async listDrawingKeys(prefix: string): Promise<DrawingKeyEntry[]> {
    const cleanPrefix = prefix || '';
    const KEY_PREFIX = 'trawangan_drawings_';
    const seen = new Map<string, DrawingKeyEntry>();

    const inspectKey = (fullKey: string) => {
      if (!fullKey.startsWith(KEY_PREFIX)) return;
      const body = fullKey.slice(KEY_PREFIX.length);
      const lastUnderscore = body.lastIndexOf('_');
      if (lastUnderscore <= 0) return;
      const symbol = body.slice(0, lastUnderscore);
      const timeframe = body.slice(lastUnderscore + 1);
      if (symbol.startsWith(cleanPrefix)) {
        seen.set(`${symbol}::${timeframe}`, { symbol, timeframe });
      }
    };

    for (const fullKey of this.memoryStore.keys()) {
      inspectKey(fullKey);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) inspectKey(k);
        }
      } catch (_) {}
    }

    return Array.from(seen.values());
  }

  private parseJsonArray<T>(key: string): T[] {
    const raw = this.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async cloneWorkspaceDrawings(fromWsId: string, toWsId: string): Promise<number> {
    if (!fromWsId || !toWsId) return 0;
    const normFrom = fromWsId.trim().toLowerCase();
    const normTo = toWsId.trim().toLowerCase();
    if (!normFrom || !normTo || normFrom === normTo) return 0;

    const lowerPrefix = `${normFrom}:`;
    const allEntries = await this.listDrawingKeys('');
    let copied = 0;

    for (const entry of allEntries) {
      if (!entry.symbol.toLowerCase().startsWith(lowerPrefix)) continue;
      const suffix = entry.symbol.slice(lowerPrefix.length);
      if (!suffix) continue;

      const rawJson = await this.loadDrawings(entry.symbol, entry.timeframe);
      if (!rawJson) continue;

      await this.saveDrawings(`${normTo}:${suffix}`, entry.timeframe, rawJson);
      copied++;
    }
    return copied;
  }

  async listWorkspaces(): Promise<SavedWorkspace[]> {
    return this.parseJsonArray<SavedWorkspace>('trawangan_workspaces');
  }

  async upsertWorkspace(workspace: SavedWorkspace): Promise<void> {
    const list = await this.listWorkspaces();
    const idx = list.findIndex((w) => w.id === workspace.id);
    if (idx >= 0) {
      list[idx] = workspace;
    } else {
      list.push(workspace);
    }
    this.setItem('trawangan_workspaces', JSON.stringify(list));
  }

  async deleteWorkspace(id: string): Promise<void> {
    const cleanId = id.trim();
    const list = await this.listWorkspaces();
    const filtered = list.filter((w) => w.id !== id);
    this.setItem('trawangan_workspaces', JSON.stringify(filtered));

    if (cleanId && cleanId.toLowerCase() !== 'default_workspace') {
      const normPrefix = `${cleanId.toLowerCase()}:`;
      const allKeys = new Set<string>(this.memoryStore.keys());
      if (typeof localStorage !== 'undefined') {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) allKeys.add(k);
          }
        } catch (_) {}
      }
      const KEY_PREFIX = 'trawangan_drawings_';
      for (const fullKey of allKeys) {
        if (!fullKey.startsWith(KEY_PREFIX)) continue;
        const body = fullKey.slice(KEY_PREFIX.length);
        if (body.toLowerCase().startsWith(normPrefix)) {
          this.removeItem(fullKey);
        }
      }
    }
  }

  async listAlerts(): Promise<PriceAlert[]> {
    return this.parseJsonArray<PriceAlert>('trawangan_price_alerts');
  }

  async replaceAlerts(alerts: PriceAlert[]): Promise<void> {
    this.setItem('trawangan_price_alerts', JSON.stringify(alerts));
  }

  private sortPlansNewestFirst(list: SavedTradingPlanRecord[]): SavedTradingPlanRecord[] {
    return [...list].sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
  }

  async listTradingPlans(): Promise<SavedTradingPlanRecord[]> {
    return this.sortPlansNewestFirst(
      this.parseJsonArray<SavedTradingPlanRecord>('trawangan_trade_plan_vault')
    );
  }

  async upsertTradingPlan(record: SavedTradingPlanRecord): Promise<void> {
    const list = await this.listTradingPlans();
    const remaining = list.filter((item) => item.id !== record.id);
    const nextList = this.sortPlansNewestFirst([record, ...remaining]).slice(0, 200);
    this.setItem('trawangan_trade_plan_vault', JSON.stringify(nextList));
  }

  async deleteTradingPlan(id: string): Promise<void> {
    const list = await this.listTradingPlans();
    const filtered = list.filter((item) => item.id !== id);
    this.setItem('trawangan_trade_plan_vault', JSON.stringify(filtered));
  }

  async clearTradingPlans(): Promise<void> {
    this.removeItem('trawangan_trade_plan_vault');
  }

  async getPreference(key: AppPreferenceKey): Promise<string | null> {
    const cleanKey = key.trim();
    if (!cleanKey) return null;
    const val = this.getItem(`${PREF_KEY_PREFIX}${cleanKey}`);
    return val ?? null;
  }

  async setPreference(key: AppPreferenceKey, valueJson: string): Promise<void> {
    const cleanKey = key.trim();
    if (!cleanKey || !valueJson.trim()) {
      throw new Error('Kunci atau value JSON preferensi tidak boleh kosong');
    }
    JSON.parse(valueJson);
    this.setItem(`${PREF_KEY_PREFIX}${cleanKey}`, valueJson);
    this.preferenceTimestamps.set(cleanKey, Date.now());
  }

  async deletePreference(key: AppPreferenceKey): Promise<void> {
    const cleanKey = key.trim();
    if (!cleanKey) return;
    this.removeItem(`${PREF_KEY_PREFIX}${cleanKey}`);
    this.preferenceTimestamps.delete(cleanKey);
  }

  async loadAllPreferences(): Promise<AppPreferenceRecord[]> {
    const entries = new Map<string, AppPreferenceRecord>();

    const collect = (fullKey: string, valueJson: string | null) => {
      if (!fullKey.startsWith(PREF_KEY_PREFIX) || valueJson === null) return;
      const prefKey = fullKey.slice(PREF_KEY_PREFIX.length).trim();
      if (!prefKey) return;
      entries.set(prefKey, {
        key: prefKey,
        value_json: valueJson,
        updated_at: this.preferenceTimestamps.get(prefKey) ?? 0,
      });
    };

    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREF_KEY_PREFIX)) {
            collect(k, localStorage.getItem(k));
          }
        }
      } catch (_) {}
    }

    for (const [k, v] of this.memoryStore.entries()) {
      collect(k, v);
    }

    return Array.from(entries.values()).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  async loadWatchlist(): Promise<string[] | null> {
    const raw = this.getItem('trawangan_user_watchlist');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async saveWatchlist(symbols: string[]): Promise<void> {
    this.setItem('trawangan_user_watchlist', JSON.stringify(symbols));
  }

  async loadWatchlistRegistry(): Promise<MultiWatchlistRegistry | null> {
    const raw = this.getItem('trawangan_watchlist_registry');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as MultiWatchlistRegistry;
      if (parsed && Array.isArray(parsed.watchlists)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  async saveWatchlistRegistry(registry: MultiWatchlistRegistry): Promise<void> {
    this.setItem('trawangan_watchlist_registry', JSON.stringify(registry));
  }

  async loadScripts(): Promise<PineScriptRecord[]> {
    return this.parseJsonArray<PineScriptRecord>('trawangan_scripts');
  }

  async saveScript(script: PineScriptRecord): Promise<void> {
    const list = await this.loadScripts();
    const idx = list.findIndex((s) => s.id === script.id);
    if (idx >= 0) {
      list[idx] = script;
    } else {
      list.unshift(script);
    }
    this.setItem('trawangan_scripts', JSON.stringify(list));
  }

  async deleteScript(id: string): Promise<void> {
    const list = await this.loadScripts();
    const filtered = list.filter((s) => s.id !== id);
    this.setItem('trawangan_scripts', JSON.stringify(filtered));
  }

  /**
   * Helper pengujian untuk membersihkan memory store
   */
  public clearMemory(): void {
    this.memoryStore.clear();
    this.preferenceTimestamps.clear();
  }
}
