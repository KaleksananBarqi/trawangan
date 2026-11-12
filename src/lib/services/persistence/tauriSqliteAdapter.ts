// Adapter Native SQLite via Tauri IPC Command
import type { DrawingKeyEntry, PersistenceAdapter } from './types';
import type {
  MultiWatchlistRegistry,
  PineScriptRecord,
  PriceAlert,
  SavedTradingPlanRecord,
  SavedWorkspace,
} from '../../types/market';
import { InMemoryLocalStorageAdapter } from './inMemoryLocalStorageAdapter';

export class TauriSqliteAdapter implements PersistenceAdapter {
  private fallbackAdapter = new InMemoryLocalStorageAdapter();
  private invokePromise: Promise<typeof import('@tauri-apps/api/core').invoke> | null = null;

  private async getInvoke(): Promise<typeof import('@tauri-apps/api/core').invoke> {
    if (!this.invokePromise) {
      this.invokePromise = import('@tauri-apps/api/core').then((m) => m.invoke);
    }
    return this.invokePromise;
  }

  async loadDrawings(symbol: string, timeframe: string): Promise<string | null> {
    try {
      const invoke = await this.getInvoke();
      const raw = await invoke<string | null>('load_chart_drawings', { symbol, timeframe });
      if (raw) return raw;
    } catch (err) {
      console.warn(`[TauriSqliteAdapter] Gagal load drawings ${symbol}:${timeframe}, beralih ke fallback:`, err);
    }
    return this.fallbackAdapter.loadDrawings(symbol, timeframe);
  }

  async saveDrawings(symbol: string, timeframe: string, dataJson: string): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      await invoke('save_chart_drawings', { symbol, timeframe, dataJson });
      return;
    } catch (err) {
      console.warn(`[TauriSqliteAdapter] Gagal save drawings ${symbol}:${timeframe}, beralih ke fallback:`, err);
    }
    await this.fallbackAdapter.saveDrawings(symbol, timeframe, dataJson);
  }

  async clearDrawings(symbol: string, timeframe: string): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      await invoke('clear_chart_drawings', { symbol, timeframe });
    } catch (err) {
      console.warn(`[TauriSqliteAdapter] Gagal clear drawings ${symbol}:${timeframe}:`, err);
    }
    await this.fallbackAdapter.clearDrawings(symbol, timeframe);
  }

  async listDrawingKeys(prefix: string): Promise<DrawingKeyEntry[]> {
    const merged = new Map<string, DrawingKeyEntry>();
    try {
      const invoke = await this.getInvoke();
      const sqliteKeys = await invoke<DrawingKeyEntry[]>('list_drawing_keys', { prefix });
      if (Array.isArray(sqliteKeys)) {
        for (const item of sqliteKeys) {
          if (item?.symbol && item?.timeframe) {
            merged.set(`${item.symbol}::${item.timeframe}`, item);
          }
        }
      }
    } catch (err) {
      console.warn(`[TauriSqliteAdapter] Gagal listDrawingKeys "${prefix}" dari SQLite:`, err);
    }
    try {
      const fallbackKeys = await this.fallbackAdapter.listDrawingKeys(prefix);
      for (const item of fallbackKeys) {
        if (item?.symbol && item?.timeframe) {
          merged.set(`${item.symbol}::${item.timeframe}`, item);
        }
      }
    } catch (_) {}
    return Array.from(merged.values());
  }

  async loadWatchlist(): Promise<string[] | null> {
    try {
      const invoke = await this.getInvoke();
      const list = await invoke<string[]>('get_user_watchlist');
      if (list && list.length > 0) return list;
    } catch (err) {
      console.warn('[TauriSqliteAdapter] Gagal load watchlist dari SQLite, beralih ke fallback:', err);
    }
    return this.fallbackAdapter.loadWatchlist();
  }

  async saveWatchlist(symbols: string[]): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      await invoke('save_user_watchlist', { symbols });
    } catch (err) {
      console.warn('[TauriSqliteAdapter] Gagal save watchlist ke SQLite, beralih ke fallback:', err);
    }
    await this.fallbackAdapter.saveWatchlist(symbols);
  }

  async loadWatchlistRegistry(): Promise<MultiWatchlistRegistry | null> {
    const invoke = await this.getInvoke();
    const res = await invoke<MultiWatchlistRegistry | null>('load_watchlist_registry');
    return res ?? null;
  }

  async saveWatchlistRegistry(registry: MultiWatchlistRegistry): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('save_watchlist_registry', { registryJson: JSON.stringify(registry) });
  }

  async loadScripts(): Promise<PineScriptRecord[]> {
    try {
      const invoke = await this.getInvoke();
      const list = await invoke<PineScriptRecord[]>('get_saved_scripts');
      if (list) return list;
    } catch (err) {
      console.warn('[TauriSqliteAdapter] Gagal load Pine scripts dari SQLite, beralih ke fallback:', err);
    }
    return this.fallbackAdapter.loadScripts();
  }

  async saveScript(script: PineScriptRecord): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      await invoke('save_script', { script });
      return;
    } catch (err) {
      console.warn('[TauriSqliteAdapter] Gagal save Pine script ke SQLite, beralih ke fallback:', err);
    }
    await this.fallbackAdapter.saveScript(script);
  }

  async deleteScript(id: string): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      await invoke('delete_script', { id });
      return;
    } catch (err) {
      console.warn('[TauriSqliteAdapter] Gagal delete Pine script dari SQLite, beralih ke fallback:', err);
    }
    await this.fallbackAdapter.deleteScript(id);
  }

  async cloneWorkspaceDrawings(fromWsId: string, toWsId: string): Promise<number> {
    const invoke = await this.getInvoke();
    return await invoke<number>('clone_workspace_drawings', { fromWsId, toWsId });
  }

  async listWorkspaces(): Promise<SavedWorkspace[]> {
    const invoke = await this.getInvoke();
    const rawList = await invoke<string[]>('list_workspaces');
    const result: SavedWorkspace[] = [];
    for (const raw of rawList) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          result.push(parsed as SavedWorkspace);
        }
      } catch (err) {
        console.warn('[TauriSqliteAdapter] Gagal parsing workspace JSON:', err);
      }
    }
    return result;
  }

  async upsertWorkspace(workspace: SavedWorkspace): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('upsert_workspace', { workspaceJson: JSON.stringify(workspace) });
  }

  async deleteWorkspace(id: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('delete_workspace', { id });
  }

  async listAlerts(): Promise<PriceAlert[]> {
    const invoke = await this.getInvoke();
    const list = await invoke<PriceAlert[]>('list_price_alerts');
    return Array.isArray(list) ? list : [];
  }

  async replaceAlerts(alerts: PriceAlert[]): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('replace_price_alerts', { alertsJson: JSON.stringify(alerts) });
  }

  async listTradingPlans(): Promise<SavedTradingPlanRecord[]> {
    const invoke = await this.getInvoke();
    const list = await invoke<SavedTradingPlanRecord[]>('list_trading_plans');
    return Array.isArray(list) ? list : [];
  }

  async upsertTradingPlan(record: SavedTradingPlanRecord): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('upsert_trading_plan', { planRecordJson: JSON.stringify(record) });
  }

  async deleteTradingPlan(id: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('delete_trading_plan', { id });
  }

  async clearTradingPlans(): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('clear_trading_plans');
  }

  async loadLayoutSlot(id: string): Promise<string | null> {
    try {
      const invoke = await this.getInvoke();
      const raw = await invoke<string | null>('load_workspace_layout', { id });
      if (raw) return raw;
    } catch (err) {
      console.warn(`[TauriSqliteAdapter] Gagal load slot "${id}" dari SQLite:`, err);
    }
    return this.fallbackAdapter.loadLayoutSlot(id);
  }

  async saveLayoutSlot(id: string, name: string, json: string): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      await invoke('save_workspace_layout', {
        id,
        name,
        layoutJson: json,
      });
    } catch (err) {
      console.warn(`[TauriSqliteAdapter] Gagal save slot "${id}" ke SQLite:`, err);
    }
    await this.fallbackAdapter.saveLayoutSlot(id, name, json);
  }
}
