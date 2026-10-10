// Layanan Penyimpanan & Sinkronisasi Gambar Analisis Teknikal serta Watchlist
import { invoke } from '@tauri-apps/api/core';

// Map untuk mengelola debounced save per pasangan simbol:timeframe
const debounceTimers = new Map<string, any>();

/**
 * Simpan dokumen gambar analisis teknikal ke SQLite dengan auto-debounce 400ms
 */
export async function saveDrawingsDebounced(
  symbol: string,
  timeframe: string,
  doc: any
): Promise<void> {
  const key = `${symbol}:${timeframe}`;
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key));
  }

  const timer = setTimeout(async () => {
    debounceTimers.delete(key);
    try {
      const dataJson = typeof doc === 'string' ? doc : JSON.stringify(doc);
      await invoke('save_chart_drawings', {
        symbol,
        timeframe,
        dataJson,
      });
    } catch (err) {
      console.warn(`Gagal menyimpan drawings untuk ${key}:`, err);
    }
  }, 400);

  debounceTimers.set(key, timer);
}

/**
 * Muat dokumen gambar analisis teknikal dari SQLite
 */
export async function loadDrawings(
  symbol: string,
  timeframe: string
): Promise<any | null> {
  try {
    const raw = await invoke<string | null>('load_chart_drawings', {
      symbol,
      timeframe,
    });
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Gagal memuat drawings untuk ${symbol} ${timeframe}:`, err);
    return null;
  }
}

/**
 * Hapus seluruh gambar untuk simbol dan timeframe tertentu
 */
export async function clearDrawings(
  symbol: string,
  timeframe: string
): Promise<void> {
  try {
    await invoke('clear_chart_drawings', {
      symbol,
      timeframe,
    });
  } catch (err) {
    console.error(`Gagal menghapus drawings untuk ${symbol}:`, err);
  }
}

/**
 * Ambil daftar simbol watchlist pengguna dari SQLite (dengan fallback localStorage)
 */
export async function fetchWatchlist(): Promise<string[]> {
  try {
    const list = await invoke<string[]>('get_user_watchlist');
    if (list && list.length > 0) return list;
  } catch (err) {
    console.warn('Gagal memuat watchlist dari SQLite:', err);
  }

  try {
    const local = localStorage.getItem('trawangan_user_watchlist');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}

  return [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
  ];
}

/**
 * Simpan daftar simbol watchlist pengguna ke SQLite dan localStorage
 */
export async function persistWatchlist(symbols: string[]): Promise<void> {
  try {
    localStorage.setItem('trawangan_user_watchlist', JSON.stringify(symbols));
  } catch (_) {}

  try {
    await invoke('save_user_watchlist', { symbols });
  } catch (err) {
    console.warn('Gagal menyimpan watchlist ke SQLite:', err);
  }
}

/**
 * Ambil daftar price alerts dari SQLite (dengan fallback ke localStorage)
 */
export async function fetchAlerts(): Promise<any[]> {
  try {
    const raw = await invoke<string | null>('load_workspace_layout', { id: 'user_price_alerts' });
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Gagal memuat alerts dari SQLite:', err);
  }

  try {
    const local = localStorage.getItem('trawangan_user_alerts');
    if (local) return JSON.parse(local);
  } catch (_) {}

  return [];
}

/**
 * Simpan daftar price alerts ke SQLite dan localStorage
 */
export async function persistAlerts(alerts: any[]): Promise<void> {
  const json = JSON.stringify(alerts);
  try {
    localStorage.setItem('trawangan_user_alerts', json);
  } catch (_) {}

  try {
    await invoke('save_workspace_layout', {
      id: 'user_price_alerts',
      name: 'User Price Alerts',
      layoutJson: json,
    });
  } catch (err) {
    console.warn('Gagal menyimpan alerts ke SQLite:', err);
  }
}

import type { QuickSymbolsConfig } from '../types/market';

export const DEFAULT_QUICK_SYMBOLS_CONFIG: QuickSymbolsConfig = {
  mode: 'watchlist',
  customSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'],
  maxDisplayCount: 5,
};

/**
 * Ambil konfigurasi koin cepat header dari SQLite (fallback localStorage & default)
 */
export async function fetchQuickSymbolsConfig(): Promise<QuickSymbolsConfig> {
  try {
    const raw = await invoke<string | null>('load_workspace_layout', { id: 'user_quick_symbols_config' });
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_QUICK_SYMBOLS_CONFIG,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn('Gagal memuat quick symbols config dari SQLite:', err);
  }

  try {
    const local = localStorage.getItem('trawangan_quick_symbols_config');
    if (local) {
      return {
        ...DEFAULT_QUICK_SYMBOLS_CONFIG,
        ...JSON.parse(local),
      };
    }
  } catch (_) {}

  return DEFAULT_QUICK_SYMBOLS_CONFIG;
}

/**
 * Simpan konfigurasi koin cepat header ke SQLite dan localStorage
 */
export async function persistQuickSymbolsConfig(config: QuickSymbolsConfig): Promise<void> {
  const json = JSON.stringify(config);
  try {
    localStorage.setItem('trawangan_quick_symbols_config', json);
  } catch (_) {}

  try {
    await invoke('save_workspace_layout', {
      id: 'user_quick_symbols_config',
      name: 'User Quick Symbols Config',
      layoutJson: json,
    });
  } catch (err) {
    console.warn('Gagal menyimpan quick symbols config ke SQLite:', err);
  }
}
