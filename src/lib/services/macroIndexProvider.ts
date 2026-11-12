import {
  canonicalizeMacroIndexSymbol,
  MACRO_INDEX_CATALOG,
  resolveMacroIndexDescriptor,
} from './macroIndexCatalog';
import {
  MacroBasketCoordinator,
  normalizeMacroTimeframe,
  sharedMacroBasketCoordinator,
} from './macroBasketCoordinator';
import {
  createPollingSubscription,
  type ManagedStreamHandle,
  type StreamHealthSink,
} from './streamHealthGuard';
import type { OHLCV, SymbolInfo } from './yahooFinanceProvider';

export interface MacroIndexProviderOptions {
  coordinator?: MacroBasketCoordinator;
  healthSink?: StreamHealthSink;
  pollIntervalMs?: number;
  maxBackoffMs?: number;
}

export class MacroIndexProvider {
  private coordinator: MacroBasketCoordinator;
  private activeSubscriptions = new Map<string, ManagedStreamHandle>();
  private options: MacroIndexProviderOptions;

  constructor(options: MacroIndexProviderOptions = {}) {
    this.options = options;
    this.coordinator = options.coordinator ?? sharedMacroBasketCoordinator;
  }

  public setHealthSink(sink?: StreamHealthSink): void {
    this.options.healthSink = sink;
  }

  public getActiveSubscriptionCount(): number {
    return this.activeSubscriptions.size;
  }

  info() {
    return {
      name: 'macro',
      displayName: 'Crypto Macro (Synthetic)',
      description: 'Indeks Makro Kripto Sintetis (TOTAL, TOTAL2, TOTAL3, OTHERS, BTC.D, ETH.D, USDT.D)',
      capabilities: {
        enumerate: true,
        stream: true,
        symbolInfo: true,
      },
    };
  }

  public cleanMacroSymbol(ticker: string): string {
    return canonicalizeMacroIndexSymbol(ticker) || ticker.replace(/^macro:/i, '').trim().toUpperCase();
  }

  async getBars(ticker: string, timeframe: string, range: any = {}): Promise<OHLCV[]> {
    const clean = this.cleanMacroSymbol(ticker);
    const countBack = Number(range?.countBack || range?.limit) || undefined;

    try {
      const bars = await this.coordinator.getMacroCandles(clean, timeframe, countBack);
      if (bars.length === 0) return [];

      // Saat user menggulir histori ke kiri jauh melampaui data terlama (~1Y),
      // kembalikan array kosong agar Vela menghentikan pagination tanpa loop request.
      if (range?.to !== undefined && range?.to !== null) {
        const rawTo = Number(range.to);
        if (Number.isFinite(rawTo) && rawTo > 0) {
          const toMs = rawTo < 1e11 ? rawTo * 1000 : rawTo;
          if (toMs < bars[0].time) {
            return [];
          }
          const latestTime = bars[bars.length - 1].time;
          if (toMs < latestTime) {
            return bars.filter((b) => b.time <= toMs);
          }
        }
      }

      return bars;
    } catch (err: any) {
      console.warn(`[MacroIndexProvider] getBars error untuk ${clean}:`, err?.message || err);
      return [];
    }
  }

  public reconnectAll(): void {
    for (const handle of this.activeSubscriptions.values()) {
      handle.reconnect();
    }
  }

  /**
   * Memulai polling 10 detik eksklusif selama grafik indeks makro ini aktif terbuka.
   * Membatalkan request in-flight ketika cell ditutup atau berganti ke simbol lain.
   */
  subscribe(ticker: string, timeframe: string, onBar: (b: OHLCV) => void): () => void {
    const symbol = this.cleanMacroSymbol(ticker);
    const canonicalTf = normalizeMacroTimeframe(timeframe);
    const subKey = `macro:${symbol}:${canonicalTf}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    const abortController = new AbortController();

    const stopPolling = createPollingSubscription<OHLCV>({
      sourceKey: subKey,
      providerId: 'macro',
      pollIntervalMs: this.options.pollIntervalMs ?? 10_000,
      maxBackoffMs: this.options.maxBackoffMs ?? 60_000,
      healthSink: this.options.healthSink,
      fetchLatest: async () => {
        if (abortController.signal.aborted) return null;
        return await this.coordinator.getLatestLiveBar(symbol, canonicalTf, abortController.signal);
      },
      onBar,
      onRegister: (handle) => {
        this.activeSubscriptions.set(subKey, handle);
        return () => {
          this.activeSubscriptions.delete(subKey);
        };
      },
    });

    return () => {
      abortController.abort();
      stopPolling();
    };
  }

  async listSymbols() {
    return MACRO_INDEX_CATALOG.map((item) => ({
      symbol: item.symbol,
      ticker: item.symbol,
      description: item.displayName,
      type: 'index',
    }));
  }

  async getSymbolInfo(ticker: string): Promise<SymbolInfo> {
    const clean = this.cleanMacroSymbol(ticker);
    const desc = resolveMacroIndexDescriptor(clean);
    const isPercent = desc?.quoteUnit === '%';

    return {
      ticker: clean,
      name: clean,
      tickerid: `macro:${clean}`,
      description: desc?.displayName || clean,
      type: 'index',
      session: '24x7',
      exchange: 'MACRO',
      listed_exchange: 'MACRO',
      timezone: 'Etc/UTC',
      minmov: 1,
      pricescale: isPercent ? 100 : 1,
      has_intraday: true,
      supported_resolutions: ['1', '5', '15', '30', '60', '120', '240', '1D', '1W', '1M'],
      volume_precision: 0,
    };
  }
}
