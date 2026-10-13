// Adapter Native SQLite via Tauri IPC Command
import type { PersistenceAdapter } from './types';
import type { PineScriptRecord } from '../../types/market';
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
