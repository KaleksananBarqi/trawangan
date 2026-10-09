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

/**
 * Mengambil daftar data provider yang tersimpan di SQLite
 */
export async function getSavedProviders(): Promise<ProviderConfig[]> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<ProviderConfig[]>('get_data_providers');
    } catch (e) {
      console.error('Error saat mengambil data providers dari Rust:', e);
    }
  }

  // Default jika di browser mode
  return [
    {
      id: 'binance-default',
      name: 'Binance Official Public',
      rest_url: 'https://api.binance.com',
      ws_url: 'wss://stream.binance.com:9443',
      is_active: true,
    },
  ];
}

/**
 * Menyimpan konfigurasi provider baru atau pembaruan
 */
export async function saveProviderConfig(provider: ProviderConfig): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('add_or_update_provider', { provider });
  }
}

/**
 * Mengambil 24hr ticker summary untuk simbol utama
 */
export async function fetch24hTicker(symbol: string): Promise<TickerInfo> {
  const clean = normalizeTicker(symbol);
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${clean}`);
    if (res.ok) {
      const data = await res.json();
      return {
        symbol: clean,
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
    symbol: clean,
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
 */
export async function fetchWatchlistTickers(
  symbols: string[]
): Promise<Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number }>> {
  if (!symbols || symbols.length === 0) return {};

  const cleanSymbols = symbols.map((s) => normalizeTicker(s));
  const encoded = encodeURIComponent(JSON.stringify(cleanSymbols));

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encoded}`);
    if (res.ok) {
      const data = await res.json();
      const map: Record<string, any> = {};
      for (const item of data) {
        map[item.symbol] = {
          price: parseFloat(item.lastPrice),
          change24h: parseFloat(item.priceChangePercent),
          high24h: parseFloat(item.highPrice),
          low24h: parseFloat(item.lowPrice),
          volume24h: parseFloat(item.volume),
        };
      }
      return map;
    }
  } catch (err) {
    console.warn('Gagal fetch batch watchlist tickers, fallback single queries:', err);
  }

  // Fallback parallel single query jika batch gagal
  const resultMap: Record<string, any> = {};
  await Promise.all(
    cleanSymbols.slice(0, 15).map(async (sym) => {
      try {
        const t = await fetch24hTicker(sym);
        resultMap[sym] = {
          price: t.price,
          change24h: t.change24h,
          high24h: t.high24h,
          low24h: t.low24h,
          volume24h: t.volume24h,
        };
      } catch {
        // Abaikan
      }
    })
  );
  return resultMap;
}


