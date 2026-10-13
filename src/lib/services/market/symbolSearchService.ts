import type { MarketSearchResult } from '../../types/market';
import type { MarketProviderAdapter, SearchSymbolsOptions } from './types';
import { VERIFIED_CRYPTO_ASSETS } from './constants';

/**
 * Daftar token populer tambahan untuk memastikan cakupan offline registry instan (< 10ms).
 * Termasuk koin berawalan 'RE' (RENDER, REEF, REQ, REN, REI) serta koin DeFi/L1 populer.
 */
export const EXTENDED_REGISTRY_ASSETS: Array<{ base: string; name: string }> = [
  ...VERIFIED_CRYPTO_ASSETS,
  { base: 'REEF', name: 'Reef' },
  { base: 'REQ', name: 'Request Network' },
  { base: 'REN', name: 'Ren' },
  { base: 'REI', name: 'Rei Network' },
  { base: 'RESOLV', name: 'Resolv' },
  { base: 'JUP', name: 'Jupiter' },
  { base: 'JTO', name: 'Jito' },
  { base: 'PYTH', name: 'Pyth Network' },
  { base: 'ONDO', name: 'Ondo Finance' },
  { base: 'ORDI', name: 'Ordinals' },
  { base: '1000SATS', name: 'SATS (Ordinals)' },
  { base: 'BLUR', name: 'Blur' },
  { base: 'STRK', name: 'Starknet' },
  { base: 'DYDX', name: 'dYdX' },
  { base: 'RUNE', name: 'THORChain' },
  { base: 'ICP', name: 'Internet Computer' },
  { base: 'FIL', name: 'Filecoin' },
  { base: 'AR', name: 'Arweave' },
  { base: 'STX', name: 'Stacks' },
  { base: 'LDO', name: 'Lido DAO' },
  { base: 'WLD', name: 'Worldcoin' },
  { base: 'TRUMP', name: 'Official Trump' },
  { base: 'HBAR', name: 'Hedera' },
  { base: 'VET', name: 'VeChain' },
  { base: 'CRV', name: 'Curve DAO' },
  { base: 'MKR', name: 'Maker' },
];

/**
 * Pasangan Indodax bawaan untuk fast IDR offline lookup.
 */
export const POPULAR_INDODAX_PAIRS: Array<{ base: string; quote: string; name: string }> = [
  { base: 'BTC', quote: 'IDR', name: 'Bitcoin Rupiah' },
  { base: 'ETH', quote: 'IDR', name: 'Ethereum Rupiah' },
  { base: 'USDT', quote: 'IDR', name: 'Tether Rupiah' },
  { base: 'SOL', quote: 'IDR', name: 'Solana Rupiah' },
  { base: 'DOGE', quote: 'IDR', name: 'Dogecoin Rupiah' },
  { base: 'XRP', quote: 'IDR', name: 'Ripple Rupiah' },
  { base: 'ADA', quote: 'IDR', name: 'Cardano Rupiah' },
  { base: 'RENDER', quote: 'IDR', name: 'Render Token Rupiah' },
  { base: 'PEPE', quote: 'IDR', name: 'Pepe Rupiah' },
  { base: 'SHIB', quote: 'IDR', name: 'Shiba Inu Rupiah' },
  { base: 'BNB', quote: 'IDR', name: 'Binance Coin Rupiah' },
  { base: 'SUI', quote: 'IDR', name: 'Sui Rupiah' },
  { base: 'NEAR', quote: 'IDR', name: 'NEAR Protocol Rupiah' },
  { base: 'AVAX', quote: 'IDR', name: 'Avalanche Rupiah' },
  { base: 'MATIC', quote: 'IDR', name: 'Polygon Rupiah' },
  { base: 'LINK', quote: 'IDR', name: 'Chainlink Rupiah' },
];

/**
 * Menghitung skor kecocokan multi-tier untuk item hasil pencarian.
 *
 * Tiering Rule:
 * - Exact Match (Base/Ticker persis sama dengan Query) : Score 120
 * - Tier 1: Simbol / BaseAsset berawalan query        : Score 80 - 100
 * - Tier 2: Nama proyek berawalan query               : Score 60 - 75
 * - Tier 3: Kata dalam nama proyek berawalan query    : Score 50 - 59
 * - Tier 4: Substring match dalam ticker atau nama    : Score 20 - 45
 * - Tidak cocok sama sekali                           : Score 0
 */
export function calculateSearchScore(rawQuery: string, item: MarketSearchResult): number {
  const q = rawQuery.trim().toUpperCase().replace(/[\/\-_]/g, '');
  if (!q) return 50;

  const sym = (item.symbol || '').toUpperCase().replace(/[\/\-_]/g, '');
  const base = (item.baseAsset || '').toUpperCase();
  const name = (item.displayName || '').toUpperCase();

  // 1. Exact Match: BaseAsset atau Simbol persis sama
  if (base === q || sym === q) {
    return 120;
  }
  if (sym === `${q}USDT` || sym === `${q}USDT.P` || sym === `${q}IDR`) {
    return 115;
  }

  // 2. Tier 1: Prefix Match pada BaseAsset atau Ticker
  if (base.startsWith(q)) {
    // Beri penalti kecil sebanding dengan selisih panjang agar koin yang lebih ringkas berada di atas
    const lengthDelta = Math.max(0, base.length - q.length);
    return Math.max(80, 100 - lengthDelta * 2);
  }
  if (sym.startsWith(q)) {
    const lengthDelta = Math.max(0, sym.length - q.length);
    return Math.max(80, 95 - lengthDelta * 2);
  }

  // 3. Tier 2: Prefix Match pada Display Name
  if (name.startsWith(q)) {
    return 70;
  }

  // 4. Tier 3: Word-boundary match pada Display Name (misal kata kedua berawalan Q)
  const words = name.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) {
    return 60;
  }

  // 5. Tier 4: Substring Containment (kategori terendah)
  if (base.includes(q)) {
    return 45;
  }
  if (sym.includes(q)) {
    return 35;
  }
  if (name.includes(q)) {
    return 25;
  }

  return 0;
}

/**
 * Mengurutkan hasil pencarian berdasarkan skor multi-tier secara menurun.
 */
export function rankSearchResults(
  query: string,
  items: MarketSearchResult[]
): MarketSearchResult[] {
  const scored = items.map((item) => ({
    item,
    score: calculateSearchScore(query, item),
  }));

  // Filter hanya item yang relevan jika query tidak kosong
  const q = query.trim();
  const filtered = q ? scored.filter((s) => s.score > 0) : scored;

  filtered.sort((a, b) => {
    // 1. Urutkan berdasarkan skor tertinggi
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // 2. Jika skor sama, dahulukan simbol yang lebih pendek
    if (a.item.symbol.length !== b.item.symbol.length) {
      return a.item.symbol.length - b.item.symbol.length;
    }
    // 3. Jika masih sama, urutkan alfabetis
    return a.item.symbol.localeCompare(b.item.symbol);
  });

  return filtered.map((s) => s.item);
}

/**
 * Mesin Pencarian Simbol Terpadu (Omni-Search Engine).
 * Menggabungkan registry in-memory cepat (< 10ms), agregasi multi-bursa, dan online fallback.
 */
export class SymbolSearchEngine {
  private adapters = new Map<string, MarketProviderAdapter>();
  private localRegistry: MarketSearchResult[] = [];

  constructor() {
    this.initLocalRegistry();
  }

  /**
   * Menginisialisasi registry lokal in-memory untuk sub-10ms lookup offline-first.
   */
  private initLocalRegistry(): void {
    const list: MarketSearchResult[] = [];

    // Pasangan Binance Spot & Futures dari aset terverifikasi & extended
    for (const asset of EXTENDED_REGISTRY_ASSETS) {
      list.push({
        symbol: `${asset.base}USDT.P`,
        baseAsset: asset.base,
        quoteAsset: 'USDT',
        displayName: `${asset.name} Perpetual`,
        type: 'perp',
        provider: 'Binance Futures',
      });
      list.push({
        symbol: `${asset.base}USDT`,
        baseAsset: asset.base,
        quoteAsset: 'USDT',
        displayName: `${asset.name} Spot`,
        type: 'spot',
        provider: 'Binance Spot',
      });
    }

    // Pasangan Indodax IDR
    for (const pair of POPULAR_INDODAX_PAIRS) {
      list.push({
        symbol: `${pair.base}${pair.quote}`,
        baseAsset: pair.base,
        quoteAsset: pair.quote,
        displayName: `${pair.name} Spot`,
        type: 'spot',
        provider: 'Indodax Spot',
      });
    }

    this.localRegistry = list;
  }

  public registerAdapter(adapter: MarketProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Pencarian langsung pada cache memori lokal.
   * Sangat cepat (< 10ms) dan tidak memerlukan koneksi jaringan eksternal.
   */
  public searchLocal(
    query: string,
    options?: SearchSymbolsOptions | ('all' | 'spot' | 'perp')
  ): MarketSearchResult[] {
    let filterType: 'all' | 'spot' | 'perp' = 'all';
    let exchange = 'all';
    let quoteAsset = 'all';

    if (options === 'all' || options === 'spot' || options === 'perp') {
      filterType = options;
    } else if (options && typeof options === 'object') {
      if (options.filterType) filterType = options.filterType;
      if (options.exchange) exchange = options.exchange;
      if (options.quoteAsset) quoteAsset = options.quoteAsset;
    }

    const q = query.trim().toUpperCase().replace(/[\/\-_]/g, '');

    let filtered = this.localRegistry.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (quoteAsset !== 'all' && (item.quoteAsset || '').toUpperCase() !== quoteAsset.toUpperCase()) {
        return false;
      }
      if (exchange !== 'all') {
        const prov = item.provider.toLowerCase();
        if (exchange === 'binance' && !prov.includes('binance')) return false;
        if (exchange === 'indodax' && !prov.includes('indodax')) return false;
        if (exchange === 'bitunix' && !prov.includes('bitunix')) return false;
      }
      return true;
    });

    return rankSearchResults(q, filtered);
  }

  /**
   * Pencarian agregat lengkap melintasi seluruh adapter bursa dengan online fallback sintetis.
   */
  public async search(
    query: string,
    options?: SearchSymbolsOptions | ('all' | 'spot' | 'perp')
  ): Promise<MarketSearchResult[]> {
    let filterType: 'all' | 'spot' | 'perp' = 'all';
    let exchange = 'all';
    let quoteAsset = 'all';

    if (options === 'all' || options === 'spot' || options === 'perp') {
      filterType = options;
    } else if (options && typeof options === 'object') {
      if (options.filterType) filterType = options.filterType;
      if (options.exchange) exchange = options.exchange;
      if (options.quoteAsset) quoteAsset = options.quoteAsset;
    }

    // Normalisasi format query garis miring "BTC/IDR" -> "BTCIDR"
    const rawQ = query.trim();
    const slashMatch = rawQ.match(/^([A-Za-z0-9]+)[\/\-_]([A-Za-z0-9]+)$/);
    let effectiveQuery = rawQ;
    if (slashMatch) {
      effectiveQuery = slashMatch[1] + slashMatch[2];
      if (quoteAsset === 'all') {
        const detectedQuote = slashMatch[2].toUpperCase();
        if (detectedQuote === 'IDR' || detectedQuote === 'USDT') {
          quoteAsset = detectedQuote;
        }
      }
    }

    const cleanQ = effectiveQuery.trim().toUpperCase().replace(/[\/\-_]/g, '');

    // Kumpulkan hasil lokal terlebih dahulu
    const localMatches = this.searchLocal(effectiveQuery, { filterType, exchange: exchange as any, quoteAsset: quoteAsset as any });

    // Tentukan adapter bursa target
    let targetAdapters: MarketProviderAdapter[] = [];
    if (exchange !== 'all') {
      const ad = this.adapters.get(exchange);
      if (ad) targetAdapters.push(ad);
    } else {
      targetAdapters = Array.from(this.adapters.values());
    }

    // Jalankan adapter search secara paralel
    const promises = targetAdapters.map(async (ad) => {
      try {
        return await ad.searchSymbols(effectiveQuery, filterType);
      } catch (err) {
        console.warn(`[SymbolSearchEngine] Error adapter ${ad.id}:`, err);
        return [];
      }
    });

    const adapterLists = await Promise.all(promises);

    // Gabungkan seluruh hasil
    const combined: MarketSearchResult[] = [...localMatches];
    for (const list of adapterLists) {
      combined.push(...list);
    }

    // Filter berdasarkan quoteAsset jika ditentukan
    const filteredByQuote = combined.filter((item) => {
      if (quoteAsset !== 'all') {
        if ((item.quoteAsset || '').toUpperCase() !== quoteAsset.toUpperCase()) {
          return false;
        }
      }
      return true;
    });

    // Deduplikasi berdasarkan symbol + provider
    const deduplicated: MarketSearchResult[] = [];
    const seen = new Set<string>();
    for (const item of filteredByQuote) {
      const key = `${item.symbol}_${item.provider}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      }
    }

    // Dynamic Online Fallback jika query memiliki isi dan belum ada hasil yang cocok persis
    if (cleanQ && !deduplicated.some((r) => r.baseAsset === cleanQ || r.symbol === cleanQ)) {
      const cleanBase = cleanQ
        .replace(/USDT$/i, '')
        .replace(/IDR$/i, '')
        .replace(/\.P$/i, '');

      if (cleanBase.length >= 2) {
        // Fallback USDT (Binance Spot & Futures) jika tidak sedang filter IDR saja
        if (quoteAsset === 'all' || quoteAsset === 'USDT') {
          if (filterType === 'all' || filterType === 'perp') {
            deduplicated.unshift({
              symbol: `${cleanBase}USDT.P`,
              baseAsset: cleanBase,
              quoteAsset: 'USDT',
              displayName: `${cleanBase} Perpetual Contract`,
              type: 'perp',
              provider: 'Binance Futures',
            });
          }
          if (filterType === 'all' || filterType === 'spot') {
            deduplicated.unshift({
              symbol: `${cleanBase}USDT`,
              baseAsset: cleanBase,
              quoteAsset: 'USDT',
              displayName: `${cleanBase} Spot Pair`,
              type: 'spot',
              provider: 'Binance Spot',
            });
          }
        }

        // Fallback IDR (Indodax) jika filter all atau IDR
        if (quoteAsset === 'all' || quoteAsset === 'IDR') {
          if (filterType === 'all' || filterType === 'spot') {
            deduplicated.push({
              symbol: `${cleanBase}IDR`,
              baseAsset: cleanBase,
              quoteAsset: 'IDR',
              displayName: `${cleanBase}/IDR Spot Pair`,
              type: 'spot',
              provider: 'Indodax Spot',
            });
          }
        }
      }
    }

    // Urutkan dengan ranking multi-tier
    return rankSearchResults(effectiveQuery, deduplicated);
  }
}
