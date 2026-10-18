// Modul Deep Market Feed Trawangan: Mengabstraksi Polling Ticker, Evaluasi Alert, dan Routing Provider
import type { Candle, ProviderConfig, TickerInfo, MarketSearchResult } from '../../types/market';
import type {
  IMarketFeedService,
  MarketProviderAdapter,
  TickerListener,
  WatchlistTickersListener,
  FeedConnectionState,
  FeedConnectionStatus,
  FeedConnectionListener,
  SearchSymbolsOptions,
} from './types';
import { BinanceAdapter } from './adapters/binanceAdapter';
import { IndodaxAdapter } from './adapters/indodaxAdapter';
import { BitunixAdapter } from './adapters/bitunixAdapter';
import { MockMarketAdapter } from './adapters/mockAdapter';
import { DEFAULT_PROVIDERS, normalizeTicker } from './constants';
import { alertService } from '../alertService';
import { SymbolSearchEngine } from './symbolSearchService';

/**
 * Memecah simbol pair (baik ber-prefix 'provider:symbol' atau raw) dan menginfer bursa target
 */
export function resolveSymbolProvider(
  rawSymbol: string,
  defaultProvider = 'binance'
): { providerId: string; cleanSymbol: string } {
  if (!rawSymbol) return { providerId: defaultProvider.toLowerCase(), cleanSymbol: '' };
  const trimmed = rawSymbol.trim();
  if (trimmed.includes(':')) {
    const [p, s] = trimmed.split(':');
    return {
      providerId: (p || defaultProvider).toLowerCase(),
      cleanSymbol: s.toUpperCase(),
    };
  }
  const upper = trimmed.toUpperCase();
  if (upper.endsWith('IDR')) {
    return { providerId: 'indodax', cleanSymbol: upper };
  }
  if (upper.endsWith('.P') && defaultProvider === 'indodax') {
    return { providerId: 'bitunix', cleanSymbol: upper };
  }
  if (upper.includes('USDT') && defaultProvider === 'indodax') {
    return { providerId: 'binance', cleanSymbol: upper };
  }
  return { providerId: defaultProvider.toLowerCase(), cleanSymbol: upper };
}

export class MarketFeedService implements IMarketFeedService {
  private adapters = new Map<string, MarketProviderAdapter>();
  private activeProviderId = 'binance';
  private pollingIntervalMs = 4000;
  private pollTimer: any = null;

  // Mesin pencarian simbol terpadu multi-tier
  private searchEngine = new SymbolSearchEngine();

  // Koleksi subscriber
  private activeSymbolSubscribers = new Map<string, Set<TickerListener>>();
  private watchlistSubscribers = new Set<{ symbols: string[]; listener: WatchlistTickersListener }>();

  // Cache ticker terkini dalam memori
  private tickerCache = new Map<string, TickerInfo>();

  // Feed Connection Guard state
  private consecutiveErrors = 0;
  private readonly maxErrorThreshold = 3;
  private connectionState: FeedConnectionState = 'connected';
  private connectionListeners = new Set<FeedConnectionListener>();

  constructor() {
    this.registerAdapter(new BinanceAdapter());
    this.registerAdapter(new IndodaxAdapter());
    this.registerAdapter(new BitunixAdapter());
    this.registerAdapter(new MockMarketAdapter());
  }

  public registerAdapter(adapter: MarketProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
    this.searchEngine.registerAdapter(adapter);
  }

  public getConnectionStatus(): FeedConnectionStatus {
    return {
      state: this.connectionState,
      providerId: this.activeProviderId,
      errorCount: this.consecutiveErrors,
      message:
        this.connectionState === 'blocked'
          ? `Koneksi feed ke ${this.activeProviderId.toUpperCase()} terhambat (kemungkinan diblokir ISP).`
          : undefined,
    };
  }

  public onConnectionChange(listener: FeedConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.getConnectionStatus());
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private notifyConnectionChange(): void {
    const status = this.getConnectionStatus();
    for (const listener of this.connectionListeners) {
      listener(status);
    }
  }

  public recordSuccess(): void {
    if (this.consecutiveErrors > 0 || this.connectionState !== 'connected') {
      this.consecutiveErrors = 0;
      this.connectionState = 'connected';
      this.notifyConnectionChange();
    }
  }

  public recordFailure(_err?: any): void {
    this.consecutiveErrors++;
    const oldState = this.connectionState;
    if (this.consecutiveErrors >= this.maxErrorThreshold) {
      this.connectionState = 'blocked';
    } else {
      this.connectionState = 'stalled';
    }
    this.notifyConnectionChange();
  }

  public resetConnectionError(): void {
    this.consecutiveErrors = 0;
    this.connectionState = 'connected';
    this.notifyConnectionChange();
  }

  public destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.activeSymbolSubscribers.clear();
    this.watchlistSubscribers.clear();
    this.connectionListeners.clear();
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

    // Pastikan timer tidak menahan event loop Node.js pada test runner
    if (typeof (this.pollTimer as any)?.unref === 'function') {
      (this.pollTimer as any).unref();
    }
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

    // 1. Partisi seluruh simbol berdasarkan provider target
    const providerMap = new Map<string, Array<{ raw: string; clean: string }>>();

    for (const rawSym of allSymbolsSet) {
      const { providerId, cleanSymbol } = resolveSymbolProvider(rawSym, this.activeProviderId);
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, []);
      }
      providerMap.get(providerId)!.push({ raw: rawSym, clean: cleanSymbol });
    }

    const mergedBatchData: Record<string, TickerInfo> = {};
    let activeProviderSucceeded = false;
    let activeProviderHasQuery = false;
    let activeProviderError: any = null;

    // 2. Eksekusi batch per provider secara paralel
    await Promise.allSettled(
      Array.from(providerMap.entries()).map(async ([pId, symList]) => {
        const adapter = this.adapters.get(pId) || this.getAdapter();
        const cleanList = Array.from(new Set(symList.map((s) => s.clean)));
        const isActive = pId === this.activeProviderId;

        if (isActive) {
          activeProviderHasQuery = true;
        }

        try {
          const batch = await adapter.fetchBatchTickers(cleanList);
          if (batch && Object.keys(batch).length > 0) {
            if (isActive) activeProviderSucceeded = true;
            // Petakan kembali hasil ticker ke raw symbol dan clean symbol
            for (const item of symList) {
              const found = batch[item.clean] || batch[normalizeTicker(item.clean)];
              if (found) {
                mergedBatchData[item.raw] = found;
                mergedBatchData[item.clean] = found;
              }
            }
          } else if (isActive && cleanList.length > 0) {
            activeProviderError = new Error(`Batch tickers for ${pId} returned empty`);
          }
        } catch (err) {
          if (isActive) {
            activeProviderError = err;
          }
          console.warn(`[MarketFeedService] Error polling provider ${pId}:`, err);
        }
      })
    );

    // 3. Catat status koneksi bursa aktif
    if (activeProviderHasQuery) {
      if (activeProviderSucceeded) {
        this.recordSuccess();
      } else if (activeProviderError) {
        this.recordFailure(activeProviderError);
      }
    } else {
      this.recordSuccess();
    }

    // 4. Update cache & notifikasi subscriber
    for (const [sym, ticker] of Object.entries(mergedBatchData)) {
      if (ticker && ticker.price > 0) {
        this.tickerCache.set(normalizeTicker(sym), ticker);
        alertService.evaluateAlerts(sym, ticker.price);
      }
    }

    for (const [sym, listeners] of this.activeSymbolSubscribers.entries()) {
      const t = mergedBatchData[sym] || this.tickerCache.get(sym);
      if (t) {
        for (const l of listeners) {
          l(t);
        }
      }
    }

    for (const sub of this.watchlistSubscribers) {
      const subMap: Record<string, TickerInfo> = {};
      for (const s of sub.symbols) {
        const t = mergedBatchData[s] || this.tickerCache.get(normalizeTicker(s));
        if (t) subMap[s] = t;
      }
      sub.listener(subMap);
    }
  }

  private async fetchAndDispatchSingle(symbol: string): Promise<void> {
    try {
      const adapter = this.getAdapter();
      const ticker = await adapter.fetchTicker(symbol);
      if (ticker && ticker.price > 0) {
        this.recordSuccess();
        this.tickerCache.set(symbol, ticker);
        alertService.evaluateAlerts(symbol, ticker.price);
        const listeners = this.activeSymbolSubscribers.get(symbol);
        if (listeners) {
          for (const l of listeners) {
            l(ticker);
          }
        }
      }
    } catch (err) {
      this.recordFailure(err);
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
    options?: SearchSymbolsOptions | ('all' | 'spot' | 'perp')
  ): Promise<MarketSearchResult[]> {
    return this.searchEngine.search(query, options);
  }

  public searchLocalSymbols(
    query: string,
    options?: SearchSymbolsOptions | ('all' | 'spot' | 'perp')
  ): MarketSearchResult[] {
    return this.searchEngine.searchLocal(query, options);
  }

  // ─── Provider Configuration Management ───

  private isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  private inMemoryProviders: ProviderConfig[] = [...DEFAULT_PROVIDERS];

  public async getActiveProviderId(): Promise<string> {
    const providers = await this.getSavedProviders();
    const active = providers.find((p) => p.is_active);
    this.activeProviderId = active ? active.id : 'binance';
    return this.activeProviderId;
  }

  public async setActiveProvider(id: string): Promise<void> {
    this.activeProviderId = id;
    this.resetConnectionError();

    this.inMemoryProviders = this.inMemoryProviders.map((p) => ({
      ...p,
      is_active: p.id === id,
    }));

    if (this.isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_active_data_provider', { id });
        return;
      } catch (e) {
        console.warn('[MarketFeedService] Gagal set_active_data_provider di Rust:', e);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const list = await this.getSavedProviders();
        const updated = list.map((p) => ({
          ...p,
          is_active: p.id === id,
        }));
        localStorage.setItem('trawangan_providers', JSON.stringify(updated));
      } catch (_) {}
    }

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

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('trawangan_providers');
        if (raw) return JSON.parse(raw);
      } catch (_) {}
    }

    return this.inMemoryProviders;
  }

  public async saveProviderConfig(provider: ProviderConfig): Promise<void> {
    let updated = this.inMemoryProviders.filter((p) => p.id !== provider.id);
    if (provider.is_active) {
      updated = updated.map((p) => ({ ...p, is_active: false }));
      this.activeProviderId = provider.id;
    }
    updated.push(provider);
    this.inMemoryProviders = updated;

    if (this.isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('add_or_update_provider', { provider });
        return;
      } catch (e) {
        console.warn('[MarketFeedService] Gagal add_or_update_provider di Rust:', e);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const list = await this.getSavedProviders();
        let listUpdated = list.filter((p) => p.id !== provider.id);
        if (provider.is_active) {
          listUpdated = listUpdated.map((p) => ({ ...p, is_active: false }));
        }
        listUpdated.push(provider);
        localStorage.setItem('trawangan_providers', JSON.stringify(listUpdated));
      } catch (_) {}
    }
  }

  public async deleteProvider(id: string): Promise<void> {
    this.inMemoryProviders = this.inMemoryProviders.filter((p) => p.id !== id);

    if (this.isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('delete_data_provider', { id });
        return;
      } catch (e) {
        console.warn('[MarketFeedService] Gagal delete_data_provider di Rust:', e);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const list = await this.getSavedProviders();
        const updated = list.filter((p) => p.id !== id);
        localStorage.setItem('trawangan_providers', JSON.stringify(updated));
      } catch (_) {}
    }
  }
}

// Singleton Service Instance
export const marketFeed = new MarketFeedService();
