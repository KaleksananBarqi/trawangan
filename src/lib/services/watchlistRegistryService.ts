import type { WatchlistRecord, MultiWatchlistRegistry } from '../types/market';
import { storage as defaultPersistence, PersistenceService } from './persistence';
import { isSectionToken } from './watchlistUtils';

export const DEFAULT_FACTORY_WATCHLISTS: WatchlistRecord[] = [
  {
    id: 'default',
    name: 'Daftar Utama',
    items: [
      'binance:BTCUSDT',
      'binance:ETHUSDT',
      'binance:SOLUSDT',
      'binance:BNBUSDT',
      'binance:XRPUSDT',
      'binance:DOGEUSDT',
      'binance:ADAUSDT',
      'binance:AVAXUSDT',
      'binance:LINKUSDT',
      'binance:SUIUSDT'
    ],
    isPreset: false,
  },
  {
    id: 'preset-binance',
    name: 'Binance Top 10',
    items: [
      'binance:BTCUSDT',
      'binance:ETHUSDT',
      'binance:SOLUSDT',
      'binance:BNBUSDT',
      'binance:XRPUSDT',
      'binance:DOGEUSDT',
      'binance:ADAUSDT',
      'binance:AVAXUSDT',
      'binance:LINKUSDT',
      'binance:SUIUSDT'
    ],
    isPreset: true,
  },
  {
    id: 'preset-indodax',
    name: 'Indodax IDR',
    items: [
      'indodax:BTCIDR',
      'indodax:ETHIDR',
      'indodax:USDTIDR',
      'indodax:SOLIDR',
      'indodax:DOGEIDR',
      'indodax:XRPIDR',
      'indodax:ADAIDR'
    ],
    isPreset: true,
  }
];

const LAYOUT_SLOT_ID = 'user_multi_watchlists';

export class WatchlistRegistryService {
  private persistence: PersistenceService;
  private watchlists: WatchlistRecord[] = [];
  private activeWatchlistId = 'default';
  private listeners: Set<(registry: { watchlists: WatchlistRecord[]; activeId: string }) => void> = new Set();
  private isLoaded = false;

  constructor(customPersistence?: PersistenceService) {
    this.persistence = customPersistence || defaultPersistence;
  }

  /**
   * Pemuatan inisial data multi-watchlist dengan dukungan migrasi data warisan
   */
  async load(): Promise<void> {
    if (this.isLoaded) {
      this.notify();
      return;
    }
    try {
      const raw = await this.persistence.loadLayoutSlot(LAYOUT_SLOT_ID);
      if (raw) {
        const parsed = JSON.parse(raw) as MultiWatchlistRegistry;
        if (parsed && Array.isArray(parsed.watchlists) && parsed.watchlists.length > 0) {
          this.watchlists = parsed.watchlists;
          this.activeWatchlistId = parsed.activeWatchlistId || this.watchlists[0].id;
          if (!this.watchlists.some((w) => w.id === this.activeWatchlistId)) {
            this.activeWatchlistId = this.watchlists[0].id;
          }
          this.isLoaded = true;
          this.notify();
          return;
        }
      }
    } catch (err) {
      console.warn('[WatchlistRegistryService] Gagal parsing multi-watchlist tersimpan:', err);
    }

    // Fallback: Periksa apakah ada watchlist warisan (single flat list)
    try {
      const legacySymbols = await this.persistence.loadWatchlist();
      if (legacySymbols && legacySymbols.length > 0) {
        // Migrasi legacy symbols ke "Daftar Utama"
        this.watchlists = [
          {
            id: 'default',
            name: 'Daftar Utama',
            items: [...legacySymbols],
            isPreset: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          ...DEFAULT_FACTORY_WATCHLISTS.filter((p) => p.id !== 'default').map((p) => ({
            ...p,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }))
        ];
        this.activeWatchlistId = 'default';
        this.isLoaded = true;
        await this.persist();
        this.notify();
        return;
      }
    } catch (err) {
      console.warn('[WatchlistRegistryService] Gagal memeriksa legacy watchlist:', err);
    }

    // Default inisialisasi awal
    this.watchlists = DEFAULT_FACTORY_WATCHLISTS.map((p) => ({
      ...p,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
    this.activeWatchlistId = 'default';
    this.isLoaded = true;
    await this.persist();
    this.notify();
  }

  private async persist(): Promise<void> {
    const payload: MultiWatchlistRegistry = {
      activeWatchlistId: this.activeWatchlistId,
      watchlists: this.watchlists,
    };
    await this.persistence.saveLayoutSlot(
      LAYOUT_SLOT_ID,
      'User Multi Watchlists Registry',
      JSON.stringify(payload)
    );

    // Selalu sinkronkan item watchlist aktif ke loadWatchlist/saveWatchlist lama
    // untuk kompatibilitas ke Quick Symbols & komponen eksternal (dengan menyaring token #section:)
    const active = this.getActiveWatchlist();
    if (active) {
      const cleanTickers = active.items.filter((item) => !isSectionToken(item));
      await this.persistence.saveWatchlist(cleanTickers);
    }
  }

  private notify(): void {
    const snapshot = {
      watchlists: this.listWatchlists(),
      activeId: this.activeWatchlistId,
    };
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[WatchlistRegistryService] Error in listener callback:', err);
      }
    }
  }

  subscribe(listener: (registry: { watchlists: WatchlistRecord[]; activeId: string }) => void): () => void {
    this.listeners.add(listener);
    if (this.isLoaded) {
      listener({
        watchlists: this.listWatchlists(),
        activeId: this.activeWatchlistId,
      });
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  listWatchlists(): WatchlistRecord[] {
    return this.watchlists.map((w) => ({
      ...w,
      items: [...w.items],
    }));
  }

  getWatchlist(id: string): WatchlistRecord | null {
    const found = this.watchlists.find((w) => w.id === id);
    if (!found) return null;
    return {
      ...found,
      items: [...found.items],
    };
  }

  getActiveWatchlistId(): string {
    return this.activeWatchlistId;
  }

  getActiveWatchlist(): WatchlistRecord {
    const found = this.getWatchlist(this.activeWatchlistId);
    if (found) return found;
    if (this.watchlists.length > 0) {
      this.activeWatchlistId = this.watchlists[0].id;
      return { ...this.watchlists[0], items: [...this.watchlists[0].items] };
    }
    return {
      id: 'default',
      name: 'Daftar Utama',
      items: [],
      isPreset: false,
    };
  }

  async setActiveWatchlistId(id: string): Promise<boolean> {
    if (!this.watchlists.some((w) => w.id === id)) {
      return false;
    }
    this.activeWatchlistId = id;
    await this.persist();
    this.notify();
    return true;
  }

  async createWatchlist(name: string, initialItems: string[] = []): Promise<WatchlistRecord> {
    const cleanName = name.trim() || 'Watchlist Baru';
    const newId = `wl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: WatchlistRecord = {
      id: newId,
      name: cleanName,
      items: [...initialItems],
      isPreset: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.watchlists.push(record);
    this.activeWatchlistId = newId;
    await this.persist();
    this.notify();
    return { ...record, items: [...record.items] };
  }

  async renameWatchlist(id: string, newName: string): Promise<boolean> {
    const target = this.watchlists.find((w) => w.id === id);
    if (!target) return false;
    const cleanName = newName.trim();
    if (!cleanName) return false;

    target.name = cleanName;
    target.updatedAt = Date.now();
    await this.persist();
    this.notify();
    return true;
  }

  async duplicateWatchlist(id: string): Promise<WatchlistRecord | null> {
    const source = this.watchlists.find((w) => w.id === id);
    if (!source) return null;

    const newId = `wl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: WatchlistRecord = {
      id: newId,
      name: `${source.name} (Salinan)`,
      items: [...source.items],
      isPreset: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.watchlists.push(record);
    await this.persist();
    this.notify();
    return { ...record, items: [...record.items] };
  }

  async deleteWatchlist(id: string): Promise<boolean> {
    // Proteksi batas minimum & identitas bawaan: tidak boleh menghapus 'default' atau jika hanya tersisa 1
    if (id === 'default' || this.watchlists.length <= 1) {
      return false;
    }

    const initialLen = this.watchlists.length;
    this.watchlists = this.watchlists.filter((w) => w.id !== id);
    if (this.watchlists.length === initialLen) {
      return false;
    }

    // Jika yang dihapus adalah watchlist aktif, alihkan ke 'default' atau watchlist pertama
    if (this.activeWatchlistId === id) {
      const defaultList = this.watchlists.find((w) => w.id === 'default');
      this.activeWatchlistId = defaultList ? defaultList.id : this.watchlists[0].id;
    }

    await this.persist();
    this.notify();
    return true;
  }

  async resetPresetWatchlist(id: string): Promise<boolean> {
    const factory = DEFAULT_FACTORY_WATCHLISTS.find((p) => p.id === id);
    if (!factory) return false;

    const target = this.watchlists.find((w) => w.id === id);
    if (!target) return false;

    target.items = [...factory.items];
    target.updatedAt = Date.now();
    await this.persist();
    this.notify();
    return true;
  }

  async updateWatchlistItems(id: string, items: string[]): Promise<boolean> {
    const target = this.watchlists.find((w) => w.id === id);
    if (!target) return false;

    target.items = [...items];
    target.updatedAt = Date.now();
    await this.persist();
    this.notify();
    return true;
  }

  async updateActiveItems(items: string[]): Promise<void> {
    await this.updateWatchlistItems(this.activeWatchlistId, items);
  }
}

// Instans global tunggal (singleton)
export const watchlistRegistry = new WatchlistRegistryService();
