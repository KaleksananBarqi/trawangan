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
import { HyperliquidAdapter } from './adapters/hyperliquidAdapter';
import { CoinbaseAdapter } from './adapters/coinbaseAdapter';
import { CustomFeedAdapter } from './adapters/customAdapter';
import { MockMarketAdapter } from './adapters/mockAdapter';
import { YahooFinanceAdapter } from './adapters/yahooAdapter';
import { MacroIndexAdapter } from './adapters/macroAdapter';
import { DEFAULT_PROVIDERS, normalizeTicker } from './constants';
import { alertService } from '../alertService';
import { SymbolSearchEngine } from './symbolSearchService';
import { isSectionToken } from '../watchlistUtils';
import { isYahooSymbol } from '../instrumentIdentity';
import { canonicalizeMacroIndexSymbol } from '../macroIndexCatalog';

/**
 * Memecah simbol pair (baik ber-prefix 'provider:symbol' atau raw) dan menginfer bursa target
 */
export function resolveSymbolProvider(
  rawSymbol: string,
  defaultProvider = 'binance'
): { providerId: string; cleanSymbol: string } {
  if (!rawSymbol || isSectionToken(rawSymbol)) return { providerId: '', cleanSymbol: '' };
  const trimmed = rawSymbol.trim();
  if (isSectionToken(trimmed)) return { providerId: '', cleanSymbol: '' };
  if (trimmed.includes(':')) {
    const colonIdx = trimmed.indexOf(':');
    const p = trimmed.slice(0, colonIdx).trim();
    const s = trimmed.slice(colonIdx + 1).trim();
    const pLower = (p || defaultProvider).toLowerCase();
    const sUpper = s.toUpperCase();
    const macroCanon = canonicalizeMacroIndexSymbol(sUpper);
    if (pLower === 'macro' || (macroCanon && (pLower === 'cryptocap' || pLower === 'index'))) {
      return {
        providerId: 'macro',
        cleanSymbol: macroCanon || sUpper,
      };
    }
    return {
      providerId: pLower,
      cleanSymbol: sUpper,
    };
  }

  const upper = trimmed.toUpperCase();
  const macroCanon = canonicalizeMacroIndexSymbol(upper);
  if (macroCanon) {
    return { providerId: 'macro', cleanSymbol: macroCanon };
  }

  // Deteksi bursa Yahoo Finance untuk Saham Indo (.JK), Indeks (^), dan Komoditas Futures (=F)
  if (isYahooSymbol(upper)) {
    return { providerId: 'yahoo', cleanSymbol: upper };
  }

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
  private chartStreamHealth = new Map<
    string,
    { providerId: string; state: FeedConnectionState; message?: string; errorCount: number }
  >();
  private unsubscribeAlerts: (() => void) | null = null;

  constructor() {
    this.registerAdapter(new BinanceAdapter());
    this.registerAdapter(new IndodaxAdapter());
    this.registerAdapter(new BitunixAdapter());
    this.registerAdapter(new HyperliquidAdapter());
    this.registerAdapter(new CoinbaseAdapter());
    this.registerAdapter(new MockMarketAdapter());
    this.registerAdapter(new YahooFinanceAdapter());
    this.registerAdapter(new MacroIndexAdapter());

    // Sinkronkan custom-* endpoint tersimpan di localStorage saat inisialisasi awal
    for (const cfg of this.getKnownProviderConfigsSync()) {
      this.syncCustomAdapter(cfg);
    }

    // Pantau perubahan alert untuk mengaktifkan atau menonaktifkan siklus polling otomatis
    this.unsubscribeAlerts = alertService.subscribe(() => {
      this.syncAlertPollingState();
    });
  }

  public registerAdapter(adapter: MarketProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
    this.searchEngine.registerAdapter(adapter);
  }

  /**
   * Mendaftarkan atau memperbarui CustomFeedAdapter untuk provider berawalan custom-*
   */
  public syncCustomAdapter(config: ProviderConfig): void {
    if (!config?.id) return;
    const idLower = config.id.trim().toLowerCase();
    if (!idLower.startsWith('custom')) return;
    if (!config.rest_url || !config.rest_url.trim()) return;

    const existing = this.adapters.get(config.id) || this.adapters.get(idLower);
    if (existing instanceof CustomFeedAdapter) {
      existing.updateConfig(config);
      this.adapters.set(idLower, existing);
      return;
    }

    const adapter = new CustomFeedAdapter({ ...config, id: idLower });
    this.registerAdapter(adapter);
    if (config.id !== idLower) {
      this.adapters.set(config.id, adapter);
    }
  }

  /**
   * Mengembalikan daftar konfigurasi provider secara sinkron (inMemory + fallback localStorage)
   */
  public getKnownProviderConfigsSync(): ProviderConfig[] {
    const byId = new Map<string, ProviderConfig>();
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('trawangan_providers');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              if (p?.id) byId.set(p.id, p);
            }
          }
        }
      } catch (_) {}
    }
    for (const p of this.inMemoryProviders) {
      if (p?.id) byId.set(p.id, p);
    }
    return Array.from(byId.values());
  }

  public getSearchEngine(): SymbolSearchEngine {
    return this.searchEngine;
  }

  private severityRank(state: FeedConnectionState): number {
    if (state === 'blocked') return 2;
    if (state === 'stalled') return 1;
    return 0;
  }

  public getConnectionStatus(): FeedConnectionStatus {
    let effectiveState: FeedConnectionState = this.connectionState;
    let effectiveErrors = this.consecutiveErrors;
    let effectiveMessage: string | undefined =
      this.connectionState === 'blocked'
        ? `Koneksi feed ke ${this.activeProviderId.toUpperCase()} terhambat (kemungkinan diblokir ISP).`
        : undefined;

    // Agregasikan status kesehatan dari stream candle aktif agar gangguan WebSocket/candle ikut terlihat
    const activeNorm = this.activeProviderId.toLowerCase().replace(/-/g, '_');
    for (const entry of this.chartStreamHealth.values()) {
      const entryNorm = entry.providerId ? entry.providerId.toLowerCase().replace(/-/g, '_') : '';
      if (entryNorm && entryNorm !== activeNorm) continue;
      if (this.severityRank(entry.state) > this.severityRank(effectiveState)) {
        effectiveState = entry.state;
        effectiveErrors = Math.max(effectiveErrors, entry.errorCount);
        if (entry.message) {
          effectiveMessage = entry.message;
        }
      } else if (
        entry.state === effectiveState &&
        entry.state !== 'connected'
      ) {
        effectiveErrors = Math.max(effectiveErrors, entry.errorCount);
        if (!effectiveMessage && entry.message) {
          effectiveMessage = entry.message;
        }
      }
    }

    return {
      state: effectiveState,
      providerId: this.activeProviderId,
      errorCount: effectiveErrors,
      message: effectiveMessage,
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
    const prevAggregate = this.getConnectionStatus().state;
    const hadTickerError = this.consecutiveErrors > 0 || this.connectionState !== 'connected';
    if (hadTickerError) {
      this.consecutiveErrors = 0;
      this.connectionState = 'connected';
    }
    const nextAggregate = this.getConnectionStatus().state;
    if (hadTickerError || prevAggregate !== nextAggregate) {
      this.notifyConnectionChange();
    }
  }

  public recordFailure(_err?: any): void {
    this.consecutiveErrors++;
    if (this.consecutiveErrors >= this.maxErrorThreshold) {
      this.connectionState = 'blocked';
    } else {
      this.connectionState = 'stalled';
    }
    this.notifyConnectionChange();
  }

  /**
   * Menerima laporan kesehatan dari live stream grafik (WebSocket / polling candle)
   * sehingga gangguan candle tidak tertutupi oleh suksesnya polling ticker REST.
   */
  public reportStreamState(
    sourceKey: string,
    providerId: string,
    state: FeedConnectionState,
    message?: string
  ): void {
    const prev = this.getConnectionStatus();
    const normalizedProvider = (providerId || this.activeProviderId).toLowerCase();

    if (state === 'connected') {
      this.chartStreamHealth.delete(sourceKey);
    } else {
      const existing = this.chartStreamHealth.get(sourceKey);
      const nextCount = (existing?.errorCount ?? 0) + 1;
      this.chartStreamHealth.set(sourceKey, {
        providerId: normalizedProvider,
        state,
        message,
        errorCount: Math.max(nextCount, state === 'blocked' ? this.maxErrorThreshold : 1),
      });
    }

    const next = this.getConnectionStatus();
    if (
      next.state !== prev.state ||
      next.errorCount !== prev.errorCount ||
      next.message !== prev.message
    ) {
      this.notifyConnectionChange();
    }
  }

  public clearStreamState(sourceKey: string): void {
    if (this.chartStreamHealth.has(sourceKey)) {
      const prev = this.getConnectionStatus();
      this.chartStreamHealth.delete(sourceKey);
      const next = this.getConnectionStatus();
      if (next.state !== prev.state || next.errorCount !== prev.errorCount) {
        this.notifyConnectionChange();
      }
    }
  }

  public resetConnectionError(): void {
    this.consecutiveErrors = 0;
    this.connectionState = 'connected';
    this.chartStreamHealth.clear();
    this.notifyConnectionChange();
  }

  public destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.unsubscribeAlerts) {
      this.unsubscribeAlerts();
      this.unsubscribeAlerts = null;
    }
    this.activeSymbolSubscribers.clear();
    this.watchlistSubscribers.clear();
    this.connectionListeners.clear();
    this.chartStreamHealth.clear();
  }

  public isPollingRunning(): boolean {
    return this.pollTimer !== null;
  }

  public setPollingInterval(ms: number): void {
    this.pollingIntervalMs = ms;
    if (this.pollTimer) {
      this.restartPollingLoop();
    }
  }

  public getAdapter(id = this.activeProviderId): MarketProviderAdapter {
    const cleanId = (id || this.activeProviderId || 'binance').trim().toLowerCase();
    const direct = this.adapters.get(cleanId) || this.adapters.get(id);
    if (direct) return direct;

    // Cocokkan ID custom-* dengan underscore maupun hyphen
    const cleanNorm = cleanId.replace(/-/g, '_');
    for (const [k, adapter] of this.adapters.entries()) {
      if (k.toLowerCase().replace(/-/g, '_') === cleanNorm) {
        return adapter;
      }
    }

    return this.adapters.get('binance')!;
  }

  // ─── Manajemen Subscription ───

  /**
   * Membaca cache ticker secara terisolasi per provider agar tidak terjadi kebocoran harga lintas bursa
   */
  private getCachedTicker(
    rawSymbol: string,
    providerId: string,
    cleanSymbol: string
  ): TickerInfo | undefined {
    const norm = normalizeTicker(cleanSymbol || rawSymbol);
    const scopedKey = `${providerId}:${norm}`;
    return (
      this.tickerCache.get(scopedKey) ||
      (!rawSymbol.includes(':') ? this.tickerCache.get(norm) : undefined)
    );
  }

  public subscribeActiveTicker(symbol: string, listener: TickerListener): () => void {
    const hasPrefix = symbol.includes(':');
    const { providerId, cleanSymbol } = resolveSymbolProvider(symbol, this.activeProviderId);
    const clean =
      providerId === 'macro'
        ? `macro:${cleanSymbol}`
        : hasPrefix
          ? `${providerId}:${cleanSymbol}`
          : cleanSymbol || normalizeTicker(symbol);

    if (!this.activeSymbolSubscribers.has(clean)) {
      this.activeSymbolSubscribers.set(clean, new Set());
    }
    this.activeSymbolSubscribers.get(clean)!.add(listener);

    // Jika ada cache harga lama yang cocok, kirim segera ke subscriber baru tanpa kebocoran lintas bursa
    const cached = this.getCachedTicker(symbol, providerId, cleanSymbol);
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
      if (!s || isSectionToken(s)) continue;
      const { providerId, cleanSymbol } = resolveSymbolProvider(s, this.activeProviderId);
      const c = this.getCachedTicker(s, providerId, cleanSymbol);
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

  private syncAlertPollingState(): void {
    const activeAlertSymbols = alertService
      .getActiveAlertSymbols()
      .filter((sym) => resolveSymbolProvider(sym, this.activeProviderId).providerId !== 'macro');
    if (activeAlertSymbols.length > 0) {
      const wasIdle = !this.pollTimer;
      this.ensurePollingRunning();
      if (wasIdle) {
        this.pollTick().catch(() => {});
      }
    } else {
      this.checkAndStopPollingIfEmpty();
    }
  }

  private checkAndStopPollingIfEmpty(): void {
    const totalActiveSubscribers = Array.from(this.activeSymbolSubscribers.values()).reduce(
      (sum, set) => sum + set.size,
      0
    );
    const activeAlertSymbols = alertService
      .getActiveAlertSymbols()
      .filter((sym) => resolveSymbolProvider(sym, this.activeProviderId).providerId !== 'macro');
    if (
      totalActiveSubscribers === 0 &&
      this.watchlistSubscribers.size === 0 &&
      activeAlertSymbols.length === 0
    ) {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    }
  }

  public async pollTick(): Promise<void> {
    const allSymbolsSet = new Set<string>();
    const activeOpenMacroSymbols = new Set<string>();

    for (const sym of this.activeSymbolSubscribers.keys()) {
      if (sym && !isSectionToken(sym)) {
        allSymbolsSet.add(sym);
        const resolved = resolveSymbolProvider(sym, this.activeProviderId);
        if (resolved.providerId === 'macro' && resolved.cleanSymbol) {
          activeOpenMacroSymbols.add(resolved.cleanSymbol);
        }
      }
    }
    for (const sub of this.watchlistSubscribers) {
      for (const s of sub.symbols) {
        if (!s || isSectionToken(s)) continue;
        const resolved = resolveSymbolProvider(s, this.activeProviderId);
        // Patuhi kebijakan zero-background: indeks makro di watchlist hanya boleh fetch jika grafiknya aktif terbuka.
        if (resolved.providerId === 'macro' && !activeOpenMacroSymbols.has(resolved.cleanSymbol)) {
          continue;
        }
        allSymbolsSet.add(s);
      }
    }
    const activeAlertSymbols = alertService.getActiveAlertSymbols();
    for (const sym of activeAlertSymbols) {
      if (!sym || isSectionToken(sym)) continue;
      const resolved = resolveSymbolProvider(sym, this.activeProviderId);
      if (resolved.providerId === 'macro' && !activeOpenMacroSymbols.has(resolved.cleanSymbol)) {
        continue;
      }
      allSymbolsSet.add(sym);
    }

    if (allSymbolsSet.size === 0) return;

    // 1. Partisi seluruh simbol berdasarkan provider target
    const providerMap = new Map<string, Array<{ raw: string; clean: string }>>();

    for (const rawSym of allSymbolsSet) {
      if (!rawSym || isSectionToken(rawSym)) continue;
      const { providerId, cleanSymbol } = resolveSymbolProvider(rawSym, this.activeProviderId);
      if (!providerId || !cleanSymbol) continue;
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, []);
      }
      providerMap.get(providerId)!.push({ raw: rawSym, clean: cleanSymbol });
    }


    const mergedBatchData: Record<string, TickerInfo> = {};
    const scopedCacheEntries: Array<{ key: string; legacyKey: string; ticker: TickerInfo; writeLegacy: boolean }> = [];
    let activeProviderSucceeded = false;
    let activeProviderHasQuery = false;
    let activeProviderError: any = null;
    const activeNorm = this.activeProviderId.toLowerCase().replace(/-/g, '_');

    // 2. Eksekusi batch per provider secara paralel
    await Promise.allSettled(
      Array.from(providerMap.entries()).map(async ([pId, symList]) => {
        const adapter = this.getAdapter(pId);
        const cleanList = Array.from(new Set(symList.map((s) => s.clean)));
        const isActive = pId.toLowerCase().replace(/-/g, '_') === activeNorm;

        if (isActive) {
          activeProviderHasQuery = true;
        }

        try {
          const batch = await adapter.fetchBatchTickers(cleanList);
          if (batch && Object.keys(batch).length > 0) {
            if (isActive) activeProviderSucceeded = true;
            // Petakan kembali hasil ticker ke raw symbol dan clean symbol
            for (const item of symList) {
              const found =
                batch[item.clean] || batch[normalizeTicker(item.clean)] || batch[item.raw];
              if (found) {
                mergedBatchData[item.raw] = found;
                mergedBatchData[item.clean] = found;
                const normClean = normalizeTicker(item.clean);
                scopedCacheEntries.push({
                  key: `${pId}:${normClean}`,
                  legacyKey: normClean,
                  ticker: found,
                  writeLegacy: isActive || !item.raw.includes(':'),
                });
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

    // 4. Update cache terisolasi per provider & notifikasi subscriber
    for (const entry of scopedCacheEntries) {
      if (entry.ticker && entry.ticker.price > 0) {
        this.tickerCache.set(entry.key, entry.ticker);
        if (entry.writeLegacy) {
          this.tickerCache.set(entry.legacyKey, entry.ticker);
        }
      }
    }
    for (const [sym, ticker] of Object.entries(mergedBatchData)) {
      if (ticker && ticker.price > 0) {
        alertService.evaluateAlerts(sym, ticker.price);
      }
    }

    for (const [sym, listeners] of this.activeSymbolSubscribers.entries()) {
      const { providerId, cleanSymbol } = resolveSymbolProvider(sym, this.activeProviderId);
      const t = mergedBatchData[sym] || this.getCachedTicker(sym, providerId, cleanSymbol);
      if (t) {
        for (const l of listeners) {
          l(t);
        }
      }
    }

    for (const sub of this.watchlistSubscribers) {
      const subMap: Record<string, TickerInfo> = {};
      for (const s of sub.symbols) {
        const { providerId, cleanSymbol } = resolveSymbolProvider(s, this.activeProviderId);
        const t = mergedBatchData[s] || this.getCachedTicker(s, providerId, cleanSymbol);
        if (t) subMap[s] = t;
      }
      sub.listener(subMap);
    }
  }

  private async fetchAndDispatchSingle(symbol: string): Promise<void> {
    try {
      const { providerId, cleanSymbol } = resolveSymbolProvider(symbol, this.activeProviderId);
      const adapter = this.getAdapter(providerId);
      const querySym = cleanSymbol || symbol;
      const ticker = await adapter.fetchTicker(querySym);
      if (ticker && ticker.price > 0) {
        this.recordSuccess();
        const norm = normalizeTicker(querySym);
        this.tickerCache.set(`${providerId}:${norm}`, ticker);
        if (providerId === this.activeProviderId || !symbol.includes(':')) {
          this.tickerCache.set(norm, ticker);
        }
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

  /**
   * Membaca snapshot cache ticker terakhir untuk simbol tertentu tanpa melakukan request jaringan.
   */
  public getTickerSnapshot(symbol: string): TickerInfo | null {
    if (!symbol || !symbol.trim()) return null;
    const { providerId, cleanSymbol } = resolveSymbolProvider(symbol, this.activeProviderId);
    const cached = this.getCachedTicker(symbol, providerId, cleanSymbol);
    return cached && cached.price > 0 ? cached : null;
  }

  /**
   * Mengambil harga ticker dari cache atau satu kali fetch ringan untuk referensi modal/panel.
   * Mengembalikan null apabila simbol tidak tersedia atau jaringan sedang bermasalah.
   */
  public async getLatestOrFetchTicker(symbol: string): Promise<TickerInfo | null> {
    if (!symbol || !symbol.trim()) return null;
    const cached = this.getTickerSnapshot(symbol);
    if (cached) return cached;
    try {
      const ticker = await this.getTicker(symbol);
      return ticker && ticker.price > 0 ? ticker : null;
    } catch {
      return null;
    }
  }

  /**
   * Memantau/mengambil harga referensi simbol secara non-reaktif di latar belakang (mendukung snapshot instan,
   * debounce timer, dan guard pembatalan anti-race-condition untuk dipakai di komponen Svelte).
   */
  public watchSymbolTicker(
    symbol: string,
    onTicker: (ticker: TickerInfo | null) => void,
    options?: {
      debounceMs?: number;
      onLoadingChange?: (loading: boolean) => void;
    }
  ): () => void {
    const cleanSym = (symbol || '').trim();
    if (!cleanSym || cleanSym.length < 3) {
      onTicker(null);
      options?.onLoadingChange?.(false);
      return () => {};
    }

    const snap = this.getTickerSnapshot(cleanSym);
    const resolvedPreview = resolveSymbolProvider(cleanSym, this.activeProviderId);
    if (resolvedPreview.providerId === 'macro') {
      onTicker(snap && snap.price > 0 ? snap : null);
      options?.onLoadingChange?.(false);
      return () => {};
    }
    if (snap && snap.price > 0) {
      onTicker(snap);
      options?.onLoadingChange?.(false);
      return () => {};
    }

    onTicker(null);
    let cancelled = false;
    let settled = false;
    const debounceMs = options?.debounceMs ?? 260;
    options?.onLoadingChange?.(true);

    const finishLoading = () => {
      if (!settled) {
        settled = true;
        options?.onLoadingChange?.(false);
      }
    };

    const timer = setTimeout(async () => {
      try {
        const fetched = await this.getLatestOrFetchTicker(cleanSym);
        if (!cancelled) {
          onTicker(fetched && fetched.price > 0 ? fetched : null);
        }
      } finally {
        if (!cancelled) {
          finishLoading();
        }
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      finishLoading();
    };
  }

  public async getTicker(symbol: string): Promise<TickerInfo> {
    const hasPrefix = symbol.includes(':');
    const { providerId, cleanSymbol } = resolveSymbolProvider(symbol, this.activeProviderId);
    const querySym = cleanSymbol || symbol;
    const norm = normalizeTicker(querySym);
    const scopedKey = `${providerId}:${norm}`;
    const cached = this.getCachedTicker(symbol, providerId, cleanSymbol);
    if (cached) return cached;

    const ticker = await this.getAdapter(providerId).fetchTicker(querySym);
    if (ticker && ticker.price > 0) {
      this.tickerCache.set(scopedKey, ticker);
      if (!hasPrefix || providerId === this.activeProviderId) {
        this.tickerCache.set(norm, ticker);
      }
    }
    return ticker;
  }

  public async getWatchlistTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
    if (!symbols || symbols.length === 0) return {};

    // Partisi per provider agar pembacaan langsung menghormati prefix bursa
    const resultMap: Record<string, TickerInfo> = {};
    const grouped = new Map<string, Array<{ raw: string; clean: string }>>();
    for (const s of symbols) {
      if (!s || isSectionToken(s)) continue;
      const { providerId, cleanSymbol } = resolveSymbolProvider(s, this.activeProviderId);
      if (!providerId || !cleanSymbol) continue;
      if (providerId === 'macro') {
        const cached = this.getCachedTicker(s, providerId, cleanSymbol);
        if (cached) {
          resultMap[s] = cached;
        }
        continue;
      }
      if (!grouped.has(providerId)) grouped.set(providerId, []);
      grouped.get(providerId)!.push({ raw: s, clean: cleanSymbol });
    }

    await Promise.allSettled(
      Array.from(grouped.entries()).map(async ([pId, items]) => {
        const cleanList = Array.from(new Set(items.map((i) => i.clean)));
        const batch = await this.getAdapter(pId).fetchBatchTickers(cleanList);
        if (!batch) return;
        for (const item of items) {
          const found = batch[item.clean] || batch[normalizeTicker(item.clean)] || batch[item.raw];
          if (found) {
            resultMap[item.raw] = found;
          }
        }
      })
    );

    return resultMap;
  }

  public async getCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const { providerId, cleanSymbol } = resolveSymbolProvider(symbol, this.activeProviderId);
    return this.getAdapter(providerId).fetchCandles(cleanSymbol || symbol, interval, limit);
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
    for (const p of providers) {
      this.syncCustomAdapter(p);
    }
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
    const targetCfg = this.inMemoryProviders.find((p) => p.id === id);
    if (targetCfg) {
      this.syncCustomAdapter(targetCfg);
    }

    let persistedInTauri = false;
    if (this.isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_active_data_provider', { id });
        persistedInTauri = true;

        // Hidrasi daftar provider dari Rust bila provider custom-* belum ada di adapter/memori lokal
        if (!targetCfg || id.trim().toLowerCase().startsWith('custom')) {
          await this.getSavedProviders();
          this.inMemoryProviders = this.inMemoryProviders.map((p) => ({
            ...p,
            is_active: p.id === id,
          }));
        }
      } catch (e) {
        console.warn('[MarketFeedService] Gagal set_active_data_provider di Rust:', e);
      }
    }

    if (!persistedInTauri && typeof localStorage !== 'undefined') {
      try {
        const list = await this.getSavedProviders();
        const updated = list.map((p) => ({
          ...p,
          is_active: p.id === id,
        }));
        localStorage.setItem('trawangan_providers', JSON.stringify(updated));
      } catch (_) {}
    }

    // Segera perbarui polling dengan provider baru pada jalur web maupun desktop Tauri
    this.pollTick().catch(() => {});
  }

  public async getSavedProviders(): Promise<ProviderConfig[]> {
    if (this.isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const list = await invoke<ProviderConfig[]>('get_data_providers');
        if (list && list.length > 0) {
          this.inMemoryProviders = list;
          for (const p of list) this.syncCustomAdapter(p);
          return list;
        }
      } catch (e) {
        console.error('[MarketFeedService] Error mengambil data providers dari Rust:', e);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('trawangan_providers');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.inMemoryProviders = parsed;
            for (const p of parsed) this.syncCustomAdapter(p);
            return parsed;
          }
        }
      } catch (_) {}
    }

    for (const p of this.inMemoryProviders) {
      this.syncCustomAdapter(p);
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
    this.syncCustomAdapter(provider);

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
    this.adapters.delete(id);
    this.adapters.delete(id.toLowerCase());

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
