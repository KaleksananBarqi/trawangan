// Adapter Native SQLite via Tauri IPC Command
import type { AppPreferenceKey, AppPreferenceRecord, PersistenceAdapter } from './types';
import type {
  MultiWatchlistRegistry,
  PineScriptRecord,
  PriceAlert,
  ProviderConfig,
  SavedTradingPlanRecord,
  SavedWorkspace,
} from '../../types/market';
import {
  buildUpdatedWatchlistRegistry,
  extractActiveWatchlistSymbols,
} from './watchlistProjection';

export type TauriInvokeFn = typeof import('@tauri-apps/api/core').invoke;

export class TauriSqliteAdapter implements PersistenceAdapter {
  private invokePromise: Promise<TauriInvokeFn> | null = null;

  constructor(invokeFn?: TauriInvokeFn) {
    if (invokeFn) {
      this.invokePromise = Promise.resolve(invokeFn);
    }
  }

  private async getInvoke(): Promise<TauriInvokeFn> {
    if (!this.invokePromise) {
      this.invokePromise = import('@tauri-apps/api/core').then((m) => m.invoke);
    }
    return this.invokePromise;
  }

  async loadDrawings(symbol: string, timeframe: string): Promise<string | null> {
    const invoke = await this.getInvoke();
    const raw = await invoke<string | null>('load_chart_drawings', { symbol, timeframe });
    return raw ?? null;
  }

  async saveDrawings(symbol: string, timeframe: string, dataJson: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('save_chart_drawings', { symbol, timeframe, dataJson });
  }

  async clearDrawings(symbol: string, timeframe: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('clear_chart_drawings', { symbol, timeframe });
  }

  async loadWatchlist(): Promise<string[] | null> {
    const registry = await this.loadWatchlistRegistry();
    return extractActiveWatchlistSymbols(registry);
  }

  async saveWatchlist(symbols: string[]): Promise<void> {
    const existing = await this.loadWatchlistRegistry();
    const nextRegistry = buildUpdatedWatchlistRegistry(existing, symbols);
    if (nextRegistry) {
      await this.saveWatchlistRegistry(nextRegistry);
    }
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
    const invoke = await this.getInvoke();
    const list = await invoke<PineScriptRecord[]>('get_saved_scripts');
    return Array.isArray(list) ? list : [];
  }

  async saveScript(script: PineScriptRecord): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('save_script', { script });
  }

  async deleteScript(id: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('delete_script', { id });
  }

  async cloneWorkspaceDrawings(fromWsId: string, toWsId: string): Promise<number> {
    const invoke = await this.getInvoke();
    return await invoke<number>('clone_workspace_drawings', { fromWsId, toWsId });
  }

  async listWorkspaces(): Promise<SavedWorkspace[]> {
    const invoke = await this.getInvoke();
    const rawList = await invoke<string[]>('list_workspaces');
    if (!Array.isArray(rawList)) return [];
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

  async getPreference(key: AppPreferenceKey): Promise<string | null> {
    const invoke = await this.getInvoke();
    return (await invoke<string | null>('get_app_preference', { key })) ?? null;
  }

  async setPreference(key: AppPreferenceKey, valueJson: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('set_app_preference', { key, valueJson });
  }

  async deletePreference(key: AppPreferenceKey): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('delete_app_preference', { key });
  }

  async loadAllPreferences(): Promise<AppPreferenceRecord[]> {
    const invoke = await this.getInvoke();
    const rows = await invoke<AppPreferenceRecord[]>('load_all_app_preferences');
    return Array.isArray(rows) ? rows : [];
  }

  async loadProviders(): Promise<ProviderConfig[]> {
    const invoke = await this.getInvoke();
    const rows = await invoke<ProviderConfig[]>('get_data_providers');
    return Array.isArray(rows) ? rows : [];
  }

  async saveProvider(provider: ProviderConfig): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('add_or_update_provider', { provider });
  }

  async setActiveProvider(id: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('set_active_data_provider', { id });
  }

  async deleteProvider(id: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke('delete_data_provider', { id });
  }
}
