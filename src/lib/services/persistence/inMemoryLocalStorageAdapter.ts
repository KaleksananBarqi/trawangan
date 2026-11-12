// Adapter In-Memory & Web LocalStorage untuk Lingkungan Pengujian dan Web Fallback
import type { DrawingKeyEntry, PersistenceAdapter } from './types';
import type { PineScriptRecord, SavedWorkspace } from '../../types/market';

export class InMemoryLocalStorageAdapter implements PersistenceAdapter {
  private memoryStore = new Map<string, string>();

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

  async cloneWorkspaceDrawings(fromWsId: string, toWsId: string): Promise<number> {
    if (!fromWsId || !toWsId) return 0;
    const normFrom = fromWsId.trim().toLowerCase();
    const normTo = toWsId.trim().toLowerCase();
    if (!normFrom || !normTo || normFrom === normTo) return 0;

    const lowerPrefix = `${normFrom}:`;
    const entries = await this.listDrawingKeys(lowerPrefix);
    const prefixes = [lowerPrefix];

    const rawTrimmedFrom = fromWsId.trim();
    if (rawTrimmedFrom && rawTrimmedFrom !== normFrom) {
      const rawPrefix = `${rawTrimmedFrom}:`;
      prefixes.push(rawPrefix);
      const rawEntries = await this.listDrawingKeys(rawPrefix);
      for (const re of rawEntries) {
        if (!entries.some((e) => e.symbol === re.symbol && e.timeframe === re.timeframe)) {
          entries.push(re);
        }
      }
    }

    let copied = 0;
    for (const entry of entries) {
      const matchedPrefix = prefixes.find((p) => entry.symbol.startsWith(p));
      if (!matchedPrefix) continue;
      const suffix = entry.symbol.slice(matchedPrefix.length);
      if (!suffix) continue;

      const rawJson = await this.loadDrawings(entry.symbol, entry.timeframe);
      if (!rawJson) continue;

      await this.saveDrawings(`${normTo}:${suffix}`, entry.timeframe, rawJson);
      copied++;
    }
    return copied;
  }

  async listWorkspaces(): Promise<SavedWorkspace[]> {
    const raw = this.getItem('trawangan_workspaces');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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

  async loadScripts(): Promise<PineScriptRecord[]> {
    const raw = this.getItem('trawangan_scripts');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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

  async loadLayoutSlot(id: string): Promise<string | null> {
    return this.getItem(`trawangan_slot_${id}`);
  }

  async saveLayoutSlot(id: string, _name: string, json: string): Promise<void> {
    this.setItem(`trawangan_slot_${id}`, json);
  }

  /**
   * Helper pengujian untuk membersihkan memory store
   */
  public clearMemory(): void {
    this.memoryStore.clear();
  }
}
