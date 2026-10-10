// Modul Deep Market Feed Trawangan: Mengabstraksi Polling Ticker, Evaluasi Alert, dan Routing Provider
import type { Candle, ProviderConfig, TickerInfo, MarketSearchResult } from '../../types/market';
import type { IMarketFeedService, MarketProviderAdapter, TickerListener, WatchlistTickersListener } from './types';
import { BinanceAdapter } from './adapters/binanceAdapter';
import { BitunixAdapter } from './adapters/bitunixAdapter';
import { MockMarketAdapter } from './adapters/mockAdapter';
import { DEFAULT_PROVIDERS, normalizeTicker } from './constants';
import { alertService } from '../alertService';

export class MarketFeedService implements IMarketFeedService {
  private adapters = new Map<string, MarketProviderAdapter>();
  private activeProviderId = 'binance';
  private pollingIntervalMs = 4000;
  private pollTimer: any = null;

  // Koleksi subscriber
  private activeSymbolSubscribers = new Map<string, Set<TickerListener>>();
  private watchlistSubscribers = new Set<{ symbols: string[]; listener: WatchlistTickersListener }>();

  // Cache ticker terkini dalam memori
  private tickerCache = new Map<string, TickerInfo>();

  constructor() {
    this.registerAdapter(new BinanceAdapter());
    this.registerAdapter(new BitunixAdapter());
    this.registerAdapter(new MockMarketAdapter());
  }

  public registerAdapter(adapter: MarketProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public setPollingInterval(ms: number): void {
    this.pollingIntervalMs = ms;
    if (this.pollTimer) {
      this.restartPollingLoop();
    }
  }

  public getAdapter(id = this.activeProviderId): MarketProviderAdapter {
    return this.adapters.get(id) || this.adapters.get('binance')!;
  }

  // ─── Manajemen Subscription ───

  public subscribeActiveTicker(symbol: string, listener: TickerListener): () => void {
    const clean = normalizeTicker(symbol);
    if (!this.activeSymbolSubscribers.has(clean)) {
      this.activeSymbolSubscribers.set(clean, new Set());
    }
    this.activeSymbolSubscribers.get(clean)!.add(listener);

    // Jika ada cache harga lama, kirim segera ke subscriber baru
    const cached = this.tickerCache.get(clean);
    if (cached) {
      listener(cached);
    }

    this.ensurePollingRunning();

    // Trigger pembaruan awal tanpa menunggu interval 4 detik
    this.fetchAndDispatchSingle(clean).catch(() => {});

    return () => {
      const set = this.activeSymbolSubscribers.get(clean);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.activeSymbolSubscribers.delete(clean);
        }
      }
      this.checkAndStopPollingIfEmpty();
    };
  }

  public subscribeWatchlistTickers(symbols: string[], listener: WatchlistTickersListener): () => void {
    const subObj = { symbols: [...symbols], listener };
    this.watchlistSubscribers.add(subObj);

    // Kirim data cache awal yang tersedia
    const initialMap: Record<string, TickerInfo> = {};
    for (const s of symbols) {
      const c = this.tickerCache.get(normalizeTicker(s));
      if (c) initialMap[s] = c;
    }
    if (Object.keys(initialMap).length > 0) {
      listener(initialMap);
    }

    this.ensurePollingRunning();

    // Trigger pembaruan awal
    this.pollTick().catch(() => {});

    return () => {
      this.watchlistSubscribers.delete(subObj);
      this.checkAndStopPollingIfEmpty();
    };
  }

  // ─── Polling Loop Multiplexer ───

  private ensurePollingRunning(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      this.pollTick().catch((err) => {
        console.warn('[MarketFeedService] Error pada polling loop:', err);
      });
    }, this.pollingIntervalMs);
  }

  private restartPollingLoop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.ensurePollingRunning();
  }

  private checkAndStopPollingIfEmpty(): void {
    const totalActiveSubscribers = Array.from(this.activeSymbolSubscribers.values()).reduce(
      (sum, set) => sum + set.size,
      0
    );
    if (totalActiveSubscribers === 0 && this.watchlistSubscribers.size === 0) {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    }
  }

  public async pollTick(): Promise<void> {
    const allSymbolsSet = new Set<string>();

    for (const sym of this.activeSymbolSubscribers.keys()) {
      allSymbolsSet.add(sym);
    }
    for (const sub of this.watchlistSubscribers) {
      for (const s of sub.symbols) {
        allSymbolsSet.add(s);
      }
    }

    if (allSymbolsSet.size === 0) return;

    const symbolsList = Array.from(allSymbolsSet);
    const adapter = this.getAdapter();
    const batchData = await adapter.fetchBatchTickers(symbolsList);

    // 1. Simpan ke cache & lakukan evaluasi alert terpusat
    for (const [sym, ticker] of Object.entries(batchData)) {
      if (ticker && ticker.price > 0) {
        this.tickerCache.set(normalizeTicker(sym), ticker);
        // Locality: Evaluasi alert harga otomatis di satu tempat
        alertService.evaluateAlerts(sym, ticker.price);
      }
    }

    // 2. Beritahu active symbol listeners
    for (const [sym, listeners] of this.activeSymbolSubscribers.entries()) {
      const t = batchData[sym] || this.tickerCache.get(sym);
      if (t) {
        for (const l of listeners) {
          l(t);
        }
      }
    }

    // 3. Beritahu watchlist subscribers
    for (const sub of this.watchlistSubscribers) {
      const subMap: Record<string, TickerInfo> = {};
      for (const s of sub.symbols) {
        const t = batchData[s] || this.tickerCache.get(normalizeTicker(s));
        if (t) subMap[s] = t;
      }
      sub.listener(subMap);
    }
  }

  private async fetchAndDispatchSingle(symbol: string): Promise<void> {
    const adapter = this.getAdapter();
    const ticker = await adapter.fetchTicker(symbol);
    if (ticker && ticker.price > 0) {
      this.tickerCache.set(symbol, ticker);
      alertService.evaluateAlerts(symbol, ticker.price);
      const listeners = this.activeSymbolSubscribers.get(symbol);
      if (listeners) {
        for (const l of listeners) {
          l(ticker);
        }
      }
    }
  }

  // ─── Direct Reader Methods ───

  public async getTicker(symbol: string): Promise<TickerInfo> {
    const clean = normalizeTicker(symbol);
    const cached = this.tickerCache.get(clean);
    if (cached) return cached;
    return this.getAdapter().fetchTicker(symbol);
  }

  public async getWatchlistTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
    return this.getAdapter().fetchBatchTickers(symbols);
  }

  public async getCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    return this.getAdapter().fetchCandles(symbol, interval, limit);
  }

  public async searchSymbols(
    query: string,
    filterType: 'all' | 'spot' | 'perp' = 'all'
  ): Promise<MarketSearchResult[]> {
    return this.getAdapter().searchSymbols(query, filterType);
  }

  // ─── Provider Configuration Management ───

  private isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  public async getActiveProviderId(): Promise<string> {
    const providers = await this.getSavedProviders();
    const active = providers.find((p) => p.is_active);
    this.activeProviderId = active ? active.id : 'binance';
    return this.activeProviderId;
  }

  public async setActiveProvider(id: string): Promise<void> {
    this.activeProviderId = id;

    if (this.isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_active_data_provider', { id });
        return;
      } catch (e) {
        console.warn('[MarketFeedService] Gagal set_active_data_provider di Rust:', e);
      }
    }

    try {
      const list = await this.getSavedProviders();
      const updated = list.map((p) => ({
        ...p,
        is_active: p.id === id,
      }));
      localStorage.setItem('trawangan_providers', JSON.stringify(updated));
    } catch (_) {}

    // Segera perbarui polling dengan provider baru
    this.pollTick().catch(() => {});
  }

  public async getSavedProviders(): Promise<ProviderConfig[]> {
    if (this.isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const list = await invoke<ProviderConfig[]>('get_data_providers');
        if (list && list.length > 0) return list;
      } catch (e) {
        console.error('[MarketFeedService] Error mengambil data providers dari Rust:', e);
      }
    }

    try {
      const raw = localStorage.getItem('trawangan_providers');
      if (raw) return JSON.parse(raw);
    } catch (_) {}

    return DEFAULT_PROVIDERS;
  }

  public async saveProviderConfig(provider: ProviderConfig): Promise<void> {
    if (this.isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('add_or_update_provider', { provider });
        return;
      } catch (e) {
        console.warn('[MarketFeedService] Gagal add_or_update_provider di Rust:', e);
      }
    }

    try {
      const list = await this.getSavedProviders();
      let updated = list.filter((p) => p.id !== provider.id);
      if (provider.is_active) {
        updated = updated.map((p) => ({ ...p, is_active: false }));
        this.activeProviderId = provider.id;
      }
      updated.push(provider);
      localStorage.setItem('trawangan_providers', JSON.stringify(updated));
    } catch (_) {}
  }

  public async deleteProvider(id: string): Promise<void> {
    if (this.isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('delete_data_provider', { id });
        return;
      } catch (e) {
        console.warn('[MarketFeedService] Gagal delete_data_provider di Rust:', e);
      }
    }

    try {
      const list = await this.getSavedProviders();
      const updated = list.filter((p) => p.id !== id);
      localStorage.setItem('trawangan_providers', JSON.stringify(updated));
    } catch (_) {}
  }
}

// Singleton Service Instance
export const marketFeed = new MarketFeedService();
