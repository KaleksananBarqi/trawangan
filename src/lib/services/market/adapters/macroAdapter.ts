import type { MarketProviderAdapter } from '../types';
import type { Candle, MarketSearchResult, TickerInfo } from '../../../types/market';
import {
  canonicalizeMacroIndexSymbol,
  MACRO_INDEX_CATALOG,
} from '../../macroIndexCatalog';
import {
  MacroBasketCoordinator,
  sharedMacroBasketCoordinator,
} from '../../macroBasketCoordinator';

export class MacroIndexAdapter implements MarketProviderAdapter {
  id = 'macro';
  name = 'Crypto Macro (Synthetic)';
  private coordinator: MacroBasketCoordinator;

  constructor(coordinator?: MacroBasketCoordinator) {
    this.coordinator = coordinator ?? sharedMacroBasketCoordinator;
  }

  async fetchTicker(symbol: string): Promise<TickerInfo> {
    const canonical = canonicalizeMacroIndexSymbol(symbol);
    if (!canonical) {
      return {
        symbol: symbol.toUpperCase(),
        name: symbol,
        price: 0,
        change24h: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
      };
    }

    const batch = await this.coordinator.fetchLiveMacroTickers();
    return (
      batch[canonical] ?? {
        symbol: canonical,
        name: canonical,
        price: 0,
        change24h: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
      }
    );
  }

  async fetchBatchTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
    if (!symbols || symbols.length === 0) return {};
    const allTickers = await this.coordinator.fetchLiveMacroTickers();
    const out: Record<string, TickerInfo> = {};

    for (const raw of symbols) {
      const canonical = canonicalizeMacroIndexSymbol(raw);
      if (!canonical) continue;
      const hit = allTickers[canonical];
      if (hit) {
        out[raw] = hit;
        out[canonical] = hit;
      }
    }
    return out;
  }

  async fetchCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    return await this.coordinator.getMacroCandles(symbol, interval, limit);
  }

  async searchSymbols(
    query: string,
    filterType: 'all' | 'spot' | 'perp' = 'all'
  ): Promise<MarketSearchResult[]> {
    if (filterType === 'perp') return [];
    const q = (query || '').trim().toUpperCase().replace(/[\/\-_]/g, '');
    if (!q) {
      return MACRO_INDEX_CATALOG.map((item) => ({
        symbol: item.symbol,
        baseAsset: item.symbol,
        quoteAsset: item.quoteUnit,
        displayName: item.displayName,
        type: 'spot',
        provider: 'Macro Index',
      }));
    }

    const matches: MarketSearchResult[] = [];
    for (const item of MACRO_INDEX_CATALOG) {
      const symClean = item.symbol.replace(/\./g, '');
      const aliasHit = item.aliases.some((a) => a.includes(q) || q.includes(a));
      const textHit =
        item.symbol.includes(q) ||
        symClean.includes(q) ||
        item.displayName.toUpperCase().includes(q);
      if (aliasHit || textHit) {
        matches.push({
          symbol: item.symbol,
          baseAsset: item.symbol,
          quoteAsset: item.quoteUnit,
          displayName: item.displayName,
          type: 'spot',
          provider: 'Macro Index',
        });
      }
    }
    return matches;
  }
}
