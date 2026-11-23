// Layanan State & Persistensi Quick Chart Tabs
import type { Timeframe } from '../types/market';
import { storage } from './persistence';
import type { IPersistenceService } from './persistence/types';

export interface ChartTabItem {
  id: string;
  symbol: string;
  providerId: string;
  timeframe: Timeframe;
  pinned?: boolean;
}

export interface ChartTabsState {
  tabs: ChartTabItem[];
  activeTabId: string;
}

export interface OpenChartTabInput {
  symbol: string;
  providerId: string;
  timeframe?: Timeframe;
}

export interface SyncChartTabInput {
  symbol?: string;
  providerId?: string;
  timeframe?: Timeframe;
}

type TabsPersistence = Pick<IPersistenceService, 'bootstrap' | 'getUiPreferenceSync' | 'setUiPreference'>;
type TabsListener = (state: ChartTabsState) => void;

const DEFAULT_TAB_SEED = {
  symbol: 'BTCUSDT',
  providerId: 'binance',
  timeframe: '15m' as Timeframe,
};

let tabSequence = 0;

function nextTabId(): string {
  tabSequence += 1;
  return `tab_${Date.now()}_${tabSequence}`;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function normalizeProvider(providerId: string): string {
  return providerId.trim().toLowerCase();
}

function sanitizeTab(raw: unknown): ChartTabItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<ChartTabItem>;
  const symbol = typeof candidate.symbol === 'string' ? normalizeSymbol(candidate.symbol) : '';
  const providerId = typeof candidate.providerId === 'string' ? normalizeProvider(candidate.providerId) : '';
  const timeframe = typeof candidate.timeframe === 'string' ? candidate.timeframe.trim() : '';
  if (!symbol || !providerId || !timeframe) return null;

  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : nextTabId();
  return {
    id,
    symbol,
    providerId,
    timeframe,
    ...(candidate.pinned ? { pinned: true } : {}),
  };
}

export class ChartTabsService {
  private persistence: TabsPersistence;
  private listeners = new Set<TabsListener>();
  private state: ChartTabsState;

  constructor(persistence: TabsPersistence = storage) {
    this.persistence = persistence;
    const initialTab: ChartTabItem = {
      id: nextTabId(),
      ...DEFAULT_TAB_SEED,
    };
    this.state = {
      tabs: [initialTab],
      activeTabId: initialTab.id,
    };
  }

  public async bootstrap(fallback?: OpenChartTabInput): Promise<ChartTabsState> {
    await this.persistence.bootstrap();
    const saved = this.persistence.getUiPreferenceSync<unknown>('chart_tabs_state');

    if (saved && typeof saved === 'object') {
      const rawTabs = Array.isArray((saved as ChartTabsState).tabs) ? (saved as ChartTabsState).tabs : [];
      const cleanTabs = rawTabs.map(sanitizeTab).filter((t): t is ChartTabItem => t !== null);

      if (cleanTabs.length > 0) {
        const rawActiveId = (saved as ChartTabsState).activeTabId;
        const hasActive = cleanTabs.some((t) => t.id === rawActiveId);
        this.state = {
          tabs: cleanTabs,
          activeTabId: hasActive ? rawActiveId : cleanTabs[0].id,
        };
        this.notify();
        return this.getState();
      }
    }

    const seedTab: ChartTabItem = {
      id: nextTabId(),
      symbol: fallback?.symbol ? normalizeSymbol(fallback.symbol) : DEFAULT_TAB_SEED.symbol,
      providerId: fallback?.providerId ? normalizeProvider(fallback.providerId) : DEFAULT_TAB_SEED.providerId,
      timeframe: fallback?.timeframe || DEFAULT_TAB_SEED.timeframe,
    };
    this.state = {
      tabs: [seedTab],
      activeTabId: seedTab.id,
    };
    this.notify();
    return this.getState();
  }

  public getState(): ChartTabsState {
    return {
      tabs: this.state.tabs.map((t) => ({ ...t })),
      activeTabId: this.state.activeTabId,
    };
  }

  public getTabs(): ChartTabItem[] {
    return this.state.tabs.map((t) => ({ ...t }));
  }

  public getActiveTab(): ChartTabItem {
    return (
      this.state.tabs.find((t) => t.id === this.state.activeTabId) ||
      this.state.tabs[0]
    );
  }

  public subscribe(listener: TabsListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public focusTab(id: string): ChartTabItem | null {
    const target = this.state.tabs.find((t) => t.id === id);
    if (!target) return null;
    if (this.state.activeTabId !== target.id) {
      this.state = { ...this.state, activeTabId: target.id };
      this.persistAndNotify();
    }
    return { ...target };
  }

  /**
   * Beralih ke tab berikutnya (+1) atau sebelumnya (-1) secara siklik.
   */
  public cycleTab(direction: 1 | -1): ChartTabItem | null {
    const len = this.state.tabs.length;
    if (len === 0) return null;
    const currentIdx = this.state.tabs.findIndex((t) => t.id === this.state.activeTabId);
    const baseIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = (baseIdx + direction + len) % len;
    const target = this.state.tabs[nextIdx];
    return this.focusTab(target.id);
  }

  /**
   * Lompat ke tab berdasarkan indeks 1-based (1..8), atau tab terakhir untuk 9.
   */
  public focusTabByIndex(oneBasedIndex: number): ChartTabItem | null {
    const len = this.state.tabs.length;
    if (len === 0 || oneBasedIndex < 1) return null;
    const targetIdx = oneBasedIndex >= 9 ? len - 1 : oneBasedIndex - 1;
    if (targetIdx >= len) return null;
    return this.focusTab(this.state.tabs[targetIdx].id);
  }

  public openOrFocusTab(input: OpenChartTabInput): ChartTabItem {
    const symbol = normalizeSymbol(input.symbol);
    const providerId = normalizeProvider(input.providerId);
    const existingIdx = this.state.tabs.findIndex(
      (t) => normalizeProvider(t.providerId) === providerId && normalizeSymbol(t.symbol) === symbol
    );

    if (existingIdx >= 0) {
      const existing = this.state.tabs[existingIdx];
      const nextTimeframe = input.timeframe || existing.timeframe;
      const updatedTab: ChartTabItem = {
        ...existing,
        timeframe: nextTimeframe,
      };
      const nextTabs = this.state.tabs.map((t, idx) => (idx === existingIdx ? updatedTab : t));
      this.state = {
        tabs: nextTabs,
        activeTabId: updatedTab.id,
      };
      this.persistAndNotify();
      return { ...updatedTab };
    }

    const activeTf = this.getActiveTab()?.timeframe || DEFAULT_TAB_SEED.timeframe;
    const created: ChartTabItem = {
      id: nextTabId(),
      symbol,
      providerId,
      timeframe: input.timeframe || activeTf,
    };
    this.state = {
      tabs: [...this.state.tabs, created],
      activeTabId: created.id,
    };
    this.persistAndNotify();
    return { ...created };
  }

  public syncActiveTab(input: SyncChartTabInput): ChartTabItem | null {
    const idx = this.state.tabs.findIndex((t) => t.id === this.state.activeTabId);
    if (idx < 0) return null;

    const current = this.state.tabs[idx];
    const nextSymbol = input.symbol ? normalizeSymbol(input.symbol) : current.symbol;
    const nextProvider = input.providerId ? normalizeProvider(input.providerId) : current.providerId;
    const nextTf = input.timeframe || current.timeframe;

    if (
      nextSymbol === current.symbol &&
      nextProvider === current.providerId &&
      nextTf === current.timeframe
    ) {
      return { ...current };
    }

    const updated: ChartTabItem = {
      ...current,
      symbol: nextSymbol,
      providerId: nextProvider,
      timeframe: nextTf,
    };
    const nextTabs = this.state.tabs.map((t, i) => (i === idx ? updated : t));
    this.state = {
      ...this.state,
      tabs: nextTabs,
    };
    this.persistAndNotify();
    return { ...updated };
  }

  public addNewTab(defaults?: Partial<OpenChartTabInput>): ChartTabItem {
    const active = this.getActiveTab();
    const created: ChartTabItem = {
      id: nextTabId(),
      symbol: defaults?.symbol ? normalizeSymbol(defaults.symbol) : active?.symbol || DEFAULT_TAB_SEED.symbol,
      providerId: defaults?.providerId
        ? normalizeProvider(defaults.providerId)
        : active?.providerId || DEFAULT_TAB_SEED.providerId,
      timeframe: defaults?.timeframe || active?.timeframe || DEFAULT_TAB_SEED.timeframe,
    };
    this.state = {
      tabs: [...this.state.tabs, created],
      activeTabId: created.id,
    };
    this.persistAndNotify();
    return { ...created };
  }

  public closeTab(id: string): boolean {
    // Guard: minimal 1 tab harus selalu aktif agar workspace tidak kosong
    if (this.state.tabs.length <= 1) return false;

    const removeIdx = this.state.tabs.findIndex((t) => t.id === id);
    if (removeIdx < 0) return false;

    const nextTabs = this.state.tabs.filter((t) => t.id !== id);
    let nextActiveId = this.state.activeTabId;
    if (nextActiveId === id) {
      const fallbackIdx = Math.min(removeIdx, nextTabs.length - 1);
      nextActiveId = nextTabs[fallbackIdx].id;
    }

    this.state = {
      tabs: nextTabs,
      activeTabId: nextActiveId,
    };
    this.persistAndNotify();
    return true;
  }

  public reorderTabs(fromIndex: number, toIndex: number): boolean {
    const len = this.state.tabs.length;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= len ||
      toIndex >= len ||
      fromIndex === toIndex
    ) {
      return false;
    }

    const nextTabs = [...this.state.tabs];
    const [moved] = nextTabs.splice(fromIndex, 1);
    nextTabs.splice(toIndex, 0, moved);

    this.state = {
      ...this.state,
      tabs: nextTabs,
    };
    this.persistAndNotify();
    return true;
  }

  private persistAndNotify(): void {
    void this.persistence.setUiPreference('chart_tabs_state', this.state);
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export const chartTabsService = new ChartTabsService();
