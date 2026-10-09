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
 * Ambil daftar simbol watchlist pengguna dari SQLite
 */
export async function fetchWatchlist(): Promise<string[]> {
  try {
    const list = await invoke<string[]>('get_user_watchlist');
    return list && list.length > 0 ? list : [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
      'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
    ];
  } catch (err) {
    console.warn('Gagal memuat watchlist:', err);
    return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
  }
}

/**
 * Simpan daftar simbol watchlist pengguna ke SQLite
 */
export async function persistWatchlist(symbols: string[]): Promise<void> {
  try {
    await invoke('save_user_watchlist', { symbols });
  } catch (err) {
    console.error('Gagal menyimpan watchlist:', err);
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

