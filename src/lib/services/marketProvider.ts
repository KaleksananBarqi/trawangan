// Facade Kompatibilitas Mundur untuk Market Provider
// Seluruh logika inti didelegasikan ke deep module MarketFeedService & persistence
import type { Candle, ProviderConfig, TickerInfo, PineScriptRecord, MarketSearchResult } from '../types/market';
import { marketFeed } from './market';
import { normalizeTicker as normalizeTickerConst } from './market/constants';
import { loadScripts, saveScript, deleteScript } from './persistence';

export type { MarketSearchResult };

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function normalizeTicker(sym: string): string {
  return normalizeTickerConst(sym);
}

export async function getHistoricalCandles(
  symbol: string,
  interval: string,
  limit = 500,
  _providerId?: string
): Promise<Candle[]> {
  return marketFeed.getCandles(symbol, interval, limit);
}

export async function getSavedProviders(): Promise<ProviderConfig[]> {
  return marketFeed.getSavedProviders();
}

export async function getActiveProviderId(): Promise<string> {
  return marketFeed.getActiveProviderId();
}

export async function setActiveProvider(id: string): Promise<void> {
  return marketFeed.setActiveProvider(id);
}

export async function saveProviderConfig(provider: ProviderConfig): Promise<void> {
  return marketFeed.saveProviderConfig(provider);
}

export async function deleteProvider(id: string): Promise<void> {
  return marketFeed.deleteProvider(id);
}

export async function fetch24hTicker(symbol: string): Promise<TickerInfo> {
  return marketFeed.getTicker(symbol);
}

export async function fetchWatchlistTickers(
  symbols: string[],
  _activeProviderId = 'binance'
): Promise<Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number }>> {
  return marketFeed.getWatchlistTickers(symbols);
}

export async function searchMarketSymbols(
  query: string,
  filterType: 'all' | 'spot' | 'perp' = 'all',
  _activeProviderId = 'binance'
): Promise<MarketSearchResult[]> {
  return marketFeed.searchSymbols(query, filterType);
}

export async function getSavedScripts(): Promise<PineScriptRecord[]> {
  return loadScripts();
}

export async function savePineScript(script: PineScriptRecord): Promise<void> {
  return saveScript(script);
}

export async function deletePineScript(id: string): Promise<void> {
  return deleteScript(id);
}
