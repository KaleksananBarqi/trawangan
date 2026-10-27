// Kontrak Antarmuka (Interface) Modul Deep Market Feed Trawangan
import type { Candle, ProviderConfig, TickerInfo, MarketSearchResult } from '../../types/market';
import type { SymbolSearchEngine } from './symbolSearchService';

export type TickerListener = (ticker: TickerInfo) => void;
export type WatchlistTickersListener = (tickers: Record<string, TickerInfo>) => void;

export type FeedConnectionState = 'connected' | 'stalled' | 'blocked';

export interface FeedConnectionStatus {
  state: FeedConnectionState;
  providerId: string;
  errorCount: number;
  message?: string;
}

export type FeedConnectionListener = (status: FeedConnectionStatus) => void;

/**
 * Adapter tingkat rendah di balik Seam Market Feed.
 * Mengabstraksi komunikasi teknis dengan bursa kripto (Binance, Bitunix, Mock).
 */
export interface MarketProviderAdapter {
  id: string;
  name: string;
  
  // Mengambil 24hr ticker untuk satu simbol
  fetchTicker(symbol: string): Promise<TickerInfo>;

  // Mengambil 24hr ticker batch untuk daftar simbol
  fetchBatchTickers(symbols: string[]): Promise<Record<string, TickerInfo>>;

  // Mengambil data candle historis (OHLCV)
  fetchCandles(symbol: string, interval: string, limit?: number): Promise<Candle[]>;

  // Pencarian simbol pasar
  searchSymbols(query: string, filterType?: 'all' | 'spot' | 'perp'): Promise<MarketSearchResult[]>;
}

export interface SearchSymbolsOptions {
  filterType?: 'all' | 'spot' | 'perp';
  exchange?: 'all' | 'binance' | 'indodax' | 'bitunix';
  quoteAsset?: 'all' | 'IDR' | 'USDT' | 'BTC';
}

/**
 * Interface Domain Layanan Market Feed Trawangan.
 * Memberikan leverage tinggi bagi pemanggil (callers) tanpa perlu mengelola timer loop sendiri.
 */
export interface IMarketFeedService {
  // ─── Langganan Ticker Real-Time (Multiplexed) ───
  subscribeActiveTicker(symbol: string, listener: TickerListener): () => void;
  subscribeWatchlistTickers(symbols: string[], listener: WatchlistTickersListener): () => void;

  // ─── Mesin Pencarian Simbol Terpadu ───
  getSearchEngine(): SymbolSearchEngine;

  // ─── Feed Connection Guard ───
  getConnectionStatus(): FeedConnectionStatus;
  onConnectionChange(listener: FeedConnectionListener): () => void;
  resetConnectionError(): void;
  destroy?(): void;

  // ─── Pembacaan Langsung (Direct Read) ───
  getTicker(symbol: string): Promise<TickerInfo>;
  getWatchlistTickers(symbols: string[]): Promise<Record<string, TickerInfo>>;
  getCandles(symbol: string, interval: string, limit?: number): Promise<Candle[]>;
  searchSymbols(
    query: string,
    options?: SearchSymbolsOptions | ('all' | 'spot' | 'perp')
  ): Promise<MarketSearchResult[]>;
  searchLocalSymbols?(
    query: string,
    options?: SearchSymbolsOptions | ('all' | 'spot' | 'perp')
  ): MarketSearchResult[];

  // ─── Manajemen Provider ───
  getActiveProviderId(): Promise<string>;
  setActiveProvider(id: string): Promise<void>;
  getSavedProviders(): Promise<ProviderConfig[]>;
  saveProviderConfig(provider: ProviderConfig): Promise<void>;
  deleteProvider(id: string): Promise<void>;
}
