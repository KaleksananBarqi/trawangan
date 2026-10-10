// Layanan Data Pasar untuk Komunikasi Frontend dengan Tauri Rust Core / Web Fallback
import type { Candle, ProviderConfig, TickerInfo } from '../types/market';

// Cek apakah aplikasi berjalan di dalam Tauri Desktop
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Normalisasi simbol agar aman dari prefix exchange/provider (misal binance:BTCUSDT -> BTCUSDT)
 */
export function normalizeTicker(sym: string): string {
  if (!sym) return '';
  const parts = sym.split(':');
  const raw = parts[parts.length - 1];
  return raw.replace(/[\/\-_]/g, '').toUpperCase();
}

/**
 * Mengambil candle historis via Tauri Rust Command atau REST fallback
 */
export async function getHistoricalCandles(
  symbol: string,
  interval: string,
  limit = 500,
  providerId?: string
): Promise<Candle[]> {
  const cleanSymbol = normalizeTicker(symbol);

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const data = await invoke<Candle[]>('fetch_candles', {
        symbol: cleanSymbol,
        interval,
        limit,
        providerId: providerId || null,
      });
      return data;
    } catch (err) {
      console.warn('Gagal memanggil Tauri command, beralih ke direct fetch fallback:', err);
    }
  }

  // Fallback direct Binance REST API di browser
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`
  );
  if (!res.ok) {
    throw new Error(`Respon error dari Binance API: ${res.statusText}`);
  }
  const raw = await res.json();
  return raw.map((item: any[]) => ({
    time: item[0],
    open: parseFloat(item[1]),
    high: parseFloat(item[2]),
    low: parseFloat(item[3]),
    close: parseFloat(item[4]),
    volume: parseFloat(item[5]),
  }));
}

const DEFAULT_BROWSER_PROVIDERS: ProviderConfig[] = [
  {
    id: 'binance',
    name: 'Binance Official Public',
    rest_url: 'https://api.binance.com',
    ws_url: 'wss://stream.binance.com:9443',
    is_active: true,
  },
  {
    id: 'bitunix',
    name: 'Bitunix Futures (USDT-M)',
    rest_url: 'https://fapi.bitunix.com',
    ws_url: 'wss://fapi.bitunix.com/public/',
    is_active: false,
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid DEX Perpetuals',
    rest_url: 'https://api.hyperliquid.xyz',
    ws_url: 'wss://api.hyperliquid.xyz/ws',
    is_active: false,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Exchange Spot',
    rest_url: 'https://api.exchange.coinbase.com',
    ws_url: 'wss://ws-feed.exchange.coinbase.com',
    is_active: false,
  },
];

/**
 * Mengambil daftar data provider yang tersimpan di SQLite atau fallback localStorage
 */
export async function getSavedProviders(): Promise<ProviderConfig[]> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const list = await invoke<ProviderConfig[]>('get_data_providers');
      if (list && list.length > 0) return list;
    } catch (e) {
      console.error('Error saat mengambil data providers dari Rust:', e);
    }
  }

  // Fallback localStorage jika di browser mode
  try {
    const raw = localStorage.getItem('trawangan_providers');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_) { }

  return DEFAULT_BROWSER_PROVIDERS;
}

/**
 * Mengambil ID data provider yang sedang aktif
 */
export async function getActiveProviderId(): Promise<string> {
  const providers = await getSavedProviders();
  const active = providers.find((p) => p.is_active);
  return active ? active.id : 'binance';
}

/**
 * Mengatur provider aktif secara eksklusif
 */
export async function setActiveProvider(id: string): Promise<void> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_active_data_provider', { id });
      return;
    } catch (e) {
      console.warn('Gagal memanggil set_active_data_provider:', e);
    }
  }

  // Fallback localStorage
  try {
    const list = await getSavedProviders();
    const updated = list.map((p) => ({
      ...p,
      is_active: p.id === id,
    }));
    localStorage.setItem('trawangan_providers', JSON.stringify(updated));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Menyimpan konfigurasi provider baru atau pembaruan
 */
export async function saveProviderConfig(provider: ProviderConfig): Promise<void> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('add_or_update_provider', { provider });
      return;
    } catch (e) {
      console.warn('Gagal memanggil add_or_update_provider:', e);
    }
  }

  // Fallback localStorage
  try {
    const list = await getSavedProviders();
    let updated = list.filter((p) => p.id !== provider.id);
    if (provider.is_active) {
      updated = updated.map((p) => ({ ...p, is_active: false }));
    }
    updated.push(provider);
    localStorage.setItem('trawangan_providers', JSON.stringify(updated));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Menghapus provider kustom
 */
export async function deleteProvider(id: string): Promise<void> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_data_provider', { id });
      return;
    } catch (e) {
      console.warn('Gagal memanggil delete_data_provider:', e);
    }
  }

  // Fallback localStorage
  try {
    const list = await getSavedProviders();
    const updated = list.filter((p) => p.id !== id);
    localStorage.setItem('trawangan_providers', JSON.stringify(updated));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Mengambil 24hr ticker summary untuk simbol utama (mendukung Spot dan Perpetual .P)
 */
export async function fetch24hTicker(symbol: string): Promise<TickerInfo> {
  const isPerp = symbol.toUpperCase().endsWith('.P');
  const clean = normalizeTicker(symbol).replace(/\.P$/i, '');
  
  if (isPerp) {
    try {
      const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${clean}`);
      if (res.ok) {
        const data = await res.json();
        return {
          symbol: `${clean}.P`,
          name: symbol,
          price: parseFloat(data.lastPrice),
          change24h: parseFloat(data.priceChangePercent),
          high24h: parseFloat(data.highPrice),
          low24h: parseFloat(data.lowPrice),
          volume24h: parseFloat(data.volume),
        };
      }
    } catch (err) {
      console.warn('Gagal fetch Binance Futures 24h ticker:', err);
    }
  }

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${clean}`);
    if (res.ok) {
      const data = await res.json();
      return {
        symbol: isPerp ? `${clean}.P` : clean,
        name: symbol,
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volume24h: parseFloat(data.volume),
      };
    }
  } catch (err) {
    console.error('Error fetch 24h ticker:', err);
  }

  return {
    symbol: isPerp ? `${clean}.P` : clean,
    name: symbol,
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    volume24h: 0,
  };
}

/**
 * Mengambil seluruh skrip Pine tersimpan dari SQLite
 */
export async function getSavedScripts(): Promise<import('../types/market').PineScriptRecord[]> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_saved_scripts');
    } catch (e) {
      console.warn('Gagal memanggil get_saved_scripts:', e);
    }
  }

  // Fallback localStorage jika dijalankan di web browser biasa
  try {
    const raw = localStorage.getItem('trawangan_scripts');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Menyimpan skrip Pine ke SQLite
 */
export async function savePineScript(script: import('../types/market').PineScriptRecord): Promise<void> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_script', { script });
      return;
    } catch (e) {
      console.warn('Gagal memanggil save_script:', e);
    }
  }

  // Fallback localStorage
  try {
    const scripts = await getSavedScripts();
    const idx = scripts.findIndex((s) => s.id === script.id);
    if (idx >= 0) {
      scripts[idx] = script;
    } else {
      scripts.unshift(script);
    }
    localStorage.setItem('trawangan_scripts', JSON.stringify(scripts));
  } catch (e) {
    console.error('Gagal menyimpan skrip ke localStorage:', e);
  }
}

/**
 * Menghapus skrip Pine dari SQLite
 */
export async function deletePineScript(id: string): Promise<void> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_script', { id });
      return;
    } catch (e) {
      console.warn('Gagal memanggil delete_script:', e);
    }
  }

  // Fallback localStorage
  try {
    const scripts = (await getSavedScripts()).filter((s) => s.id !== id);
    localStorage.setItem('trawangan_scripts', JSON.stringify(scripts));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Mengambil ringkasan ticker 24 jam untuk daftar simbol dalam watchlist
 * Mendukung pemisahan otomatis instrumen Spot vs Perpetuals (.P) dan provider Bitunix
 */
export async function fetchWatchlistTickers(
  symbols: string[],
  activeProviderId = 'binance'
): Promise<Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number }>> {
  if (!symbols || symbols.length === 0) return {};

  const resultMap: Record<string, any> = {};

  // 1. Jika active provider adalah Bitunix, coba ambil dari API Bitunix Futures
  if (activeProviderId === 'bitunix') {
    try {
      const bRes = await fetch('https://fapi.bitunix.com/api/v1/futures/market/tickers');
      if (bRes.ok) {
        const bJson = await bRes.json();
        if (bJson && bJson.code === 0 && Array.isArray(bJson.data)) {
          const bitunixMap = new Map<string, any>();
          for (const item of bJson.data) {
            const sym = item.symbol;
            const last = parseFloat(item.lastPrice || item.last || '0');
            const open = parseFloat(item.open || '0');
            const change = open > 0 ? ((last - open) / open) * 100 : 0;
            const high = parseFloat(item.high || '0');
            const low = parseFloat(item.low || '0');
            const vol = parseFloat(item.baseVol || item.quoteVol || '0');
            bitunixMap.set(sym, { price: last, change24h: change, high24h: high, low24h: low, volume24h: vol });
          }

          for (const originalSym of symbols) {
            const bare = originalSym.replace(/\.P$/i, '').toUpperCase();
            const found = bitunixMap.get(bare);
            if (found) {
              resultMap[originalSym] = found;
            }
          }

          if (Object.keys(resultMap).length > 0) {
            return resultMap;
          }
        }
      }
    } catch (bErr) {
      console.warn('Bitunix tickers fetch gagal, fallback ke Binance tickers:', bErr);
    }
  }

  // 2. Pemisahan simbol: Spot vs Perpetuals (.P)
  const spotSymbols: string[] = [];
  const perpSymbols: string[] = [];

  for (const s of symbols) {
    if (s.toUpperCase().endsWith('.P')) {
      perpSymbols.push(s);
    } else {
      spotSymbols.push(s);
    }
  }

  // 3. Batch fetch Spot tickers dari Binance Spot API
  if (spotSymbols.length > 0) {
    const cleanSpots = spotSymbols.map((s) => normalizeTicker(s));
    try {
      const encoded = encodeURIComponent(JSON.stringify(cleanSpots));
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encoded}`);
      if (res.ok) {
        const data = await res.json();
        for (const item of data) {
          resultMap[item.symbol] = {
            price: parseFloat(item.lastPrice),
            change24h: parseFloat(item.priceChangePercent),
            high24h: parseFloat(item.highPrice),
            low24h: parseFloat(item.lowPrice),
            volume24h: parseFloat(item.volume),
          };
        }
      }
    } catch (err) {
      console.warn('Gagal fetch batch spot tickers:', err);
    }
  }

  // 4. Fetch Perpetual tickers dari Binance Futures API
  if (perpSymbols.length > 0) {
    try {
      const fRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
      if (fRes.ok) {
        const fData = await fRes.json();
        const fMap = new Map<string, any>();
        for (const item of fData) {
          fMap.set(item.symbol, {
            price: parseFloat(item.lastPrice),
            change24h: parseFloat(item.priceChangePercent),
            high24h: parseFloat(item.highPrice),
            low24h: parseFloat(item.lowPrice),
            volume24h: parseFloat(item.volume),
          });
        }

        for (const pSym of perpSymbols) {
          const bare = pSym.replace(/\.P$/i, '').toUpperCase();
          const match = fMap.get(bare);
          if (match) {
            resultMap[pSym] = match;
          }
        }
      }
    } catch (fErr) {
      console.warn('Gagal fetch batch futures tickers:', fErr);
    }
  }

  return resultMap;
}

export interface MarketSearchResult {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayName: string;
  type: 'spot' | 'perp';
  provider: string;
  price?: number;
  change24h?: number;
}

// Master daftar koin terverifikasi untuk pencarian instan
const VERIFIED_CRYPTO_ASSETS = [
  { base: 'BTC', name: 'Bitcoin' },
  { base: 'ETH', name: 'Ethereum' },
  { base: 'SOL', name: 'Solana' },
  { base: 'BNB', name: 'Binance Coin' },
  { base: 'XRP', name: 'Ripple' },
  { base: 'DOGE', name: 'Dogecoin' },
  { base: 'ADA', name: 'Cardano' },
  { base: 'AVAX', name: 'Avalanche' },
  { base: 'SUI', name: 'Sui Network' },
  { base: 'LINK', name: 'Chainlink' },
  { base: 'PEPE', name: 'Pepe' },
  { base: 'SHIB', name: 'Shiba Inu' },
  { base: 'NEAR', name: 'NEAR Protocol' },
  { base: 'APT', name: 'Aptos' },
  { base: 'DOT', name: 'Polkadot' },
  { base: 'RENDER', name: 'Render Token' },
  { base: 'TAO', name: 'Bittensor' },
  { base: 'FET', name: 'Artificial Superintelligence Alliance' },
  { base: 'INJ', name: 'Injective' },
  { base: 'ARB', name: 'Arbitrum' },
  { base: 'OP', name: 'Optimism' },
  { base: 'MATIC', name: 'Polygon' },
  { base: 'POL', name: 'Polygon Ecosystem' },
  { base: 'LTC', name: 'Litecoin' },
  { base: 'BCH', name: 'Bitcoin Cash' },
  { base: 'KAS', name: 'Kaspa' },
  { base: 'SEI', name: 'Sei' },
  { base: 'TIA', name: 'Celestia' },
  { base: 'WIF', name: 'dogwifhat' },
  { base: 'BONK', name: 'Bonk' },
  { base: 'FLOKI', name: 'Floki' },
  { base: 'ENA', name: 'Ethena' },
  { base: 'PENDLE', name: 'Pendle' },
  { base: 'AAVE', name: 'Aave' },
  { base: 'UNI', name: 'Uniswap' },
  { base: 'TON', name: 'Toncoin' },
  { base: 'TRX', name: 'TRON' },
  { base: 'ATOM', name: 'Cosmos' },
  { base: 'FTM', name: 'Fantom' },
  { base: 'ALGO', name: 'Algorand' },
];

/**
 * Mencari simbol pasar yang valid (Spot vs Perpetuals .P)
 */
export async function searchMarketSymbols(
  query: string,
  filterType: 'all' | 'spot' | 'perp' = 'all',
  activeProviderId = 'binance'
): Promise<MarketSearchResult[]> {
  const q = query.trim().toUpperCase();
  const results: MarketSearchResult[] = [];

  const providerName = activeProviderId === 'bitunix' ? 'Bitunix Futures' : 'Binance';

  for (const asset of VERIFIED_CRYPTO_ASSETS) {
    const match =
      !q ||
      asset.base.includes(q) ||
      asset.name.toUpperCase().includes(q) ||
      `${asset.base}USDT`.includes(q);

    if (match) {
      // 1. Tambahkan varian Perpetual (.P) jika filter 'all' atau 'perp'
      if (filterType === 'all' || filterType === 'perp') {
        results.push({
          symbol: `${asset.base}USDT.P`,
          baseAsset: asset.base,
          quoteAsset: 'USDT',
          displayName: `${asset.name} Perpetual`,
          type: 'perp',
          provider: providerName,
        });
      }

      // 2. Tambahkan varian Spot jika filter 'all' atau 'spot'
      if (filterType === 'all' || filterType === 'spot') {
        results.push({
          symbol: `${asset.base}USDT`,
          baseAsset: asset.base,
          quoteAsset: 'USDT',
          displayName: `${asset.name} Spot`,
          type: 'spot',
          provider: activeProviderId === 'bitunix' ? 'Binance Spot' : 'Binance Spot',
        });
      }
    }
  }

  // Jika user mengetikkan custom simbol yang belum ada di daftar terverifikasi, tambahkan opsi custom
  if (q && !results.some((r) => r.symbol.startsWith(q))) {
    const cleanBase = q.replace(/USDT$/i, '').replace(/\.P$/i, '');
    if (filterType === 'all' || filterType === 'perp') {
      results.unshift({
        symbol: `${cleanBase}USDT.P`,
        baseAsset: cleanBase,
        quoteAsset: 'USDT',
        displayName: `${cleanBase} Perpetual Contract`,
        type: 'perp',
        provider: providerName,
      });
    }
    if (filterType === 'all' || filterType === 'spot') {
      results.unshift({
        symbol: `${cleanBase}USDT`,
        baseAsset: cleanBase,
        quoteAsset: 'USDT',
        displayName: `${cleanBase} Spot Pair`,
        type: 'spot',
        provider: 'Crypto Spot',
      });
    }
  }

  return results.slice(0, 30);
}



