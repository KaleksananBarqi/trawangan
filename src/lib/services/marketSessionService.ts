/**
 * Modul Aturan Klasifikasi Sesi Pasar (Market Session Rules)
 * Menyediakan aturan murni (stateless) untuk mendeteksi dukungan sesi perdagangan (RTH/ETH),
 * spesifikasi jam bursa, dan token warna tematik WebGL2 Vela.
 */

// Token warna tematik sesuai spesifikasi Vela WebGL2
export const SESSION_PRE = '#f97316';
export const SESSION_POST = '#0ea5e9';
export const SESSION_OFF = '#9ca3af';

export type MarketSession = 'regular' | 'extended';
export type MarketSessionMode = MarketSession;

export interface SessionWindow {
  start: number; // Menit dari awal hari (0 - 1440)
  end: number;   // Menit dari awal hari (0 - 1440)
}

export interface SessionSpec {
  regular: SessionWindow;
  extended: SessionWindow;
  overnight: boolean;
  timezone: string;
}

/**
 * Memeriksa apakah provider atau simbol tertentu mendukung sesi perdagangan (RTH/ETH).
 * Feed kripto continuous 24/7 (Binance, Indodax, Bitunix, Coinbase, dsb) mengembalikan false.
 */
export function isSessionSupported(symbol: string, providerId?: string): boolean {
  if (!symbol) return false;
  const prov = (providerId || '').toLowerCase();

  // Venue continuous kripto tidak memiliki jam bursa / session shading
  if (
    prov === 'binance' ||
    prov === 'indodax' ||
    prov === 'bitunix' ||
    prov === 'coinbase' ||
    prov === 'hyperliquid' ||
    prov === 'custom'
  ) {
    return false;
  }

  const clean = symbol.replace(/^(yahoo|binance|indodax|bitunix|coinbase|macro):/i, '').trim().toUpperCase();

  // Kripto pairs (USDT, BUSD, USDC, IDR, BTC, ETH) diabaikan secara aman
  if (
    clean.endsWith('USDT') ||
    clean.endsWith('USDC') ||
    clean.endsWith('BUSD') ||
    clean.endsWith('IDR') ||
    clean.includes('USDT.P') ||
    clean.includes('-USD')
  ) {
    return false;
  }

  // Yahoo Finance Equities & Indices (Saham US, ETF, dan Indeks global)
  if (prov === 'yahoo' || symbol.toLowerCase().startsWith('yahoo:')) {
    // Bursa Indonesia (.JK) hanya memiliki sesi reguler (tidak ada pre/post market retail)
    if (clean.endsWith('.JK') || clean === '^JKSE') {
      return true;
    }
    // Komoditas futures (=F) memiliki jam trading overnight
    if (clean.includes('=F')) {
      return true;
    }
    // US Equities & Indices (^GSPC, ^IXIC, AAPL, TSLA, SPY, QQQ, dll)
    return true;
  }

  return false;
}

/**
 * Mengambil spesifikasi sesi pasar berdasarkan simbol dan provider.
 */
export function getSymbolSessionSpec(symbol: string, providerId?: string): SessionSpec | null {
  if (!isSessionSupported(symbol, providerId)) {
    return null;
  }

  const clean = symbol.replace(/^(yahoo|binance|indodax|bitunix|coinbase|macro):/i, '').trim().toUpperCase();

  // Bursa Efek Indonesia (.JK dan ^JKSE): 09:00 - 16:15 WIB
  if (clean.endsWith('.JK') || clean === '^JKSE') {
    return {
      regular: { start: 9 * 60, end: 16 * 60 + 15 },
      extended: { start: 9 * 60, end: 16 * 60 + 15 },
      overnight: false,
      timezone: 'Asia/Jakarta',
    };
  }

  // Kontrak berjangka komoditas COMEX/NYMEX (=F): Overnight
  if (clean.includes('=F')) {
    return {
      regular: { start: 9 * 60 + 30, end: 16 * 60 },
      extended: { start: 18 * 60, end: 17 * 60 },
      overnight: true,
      timezone: 'America/New_York',
    };
  }

  // Default US Equities & Indices:
  // Regular (RTH): 09:30 - 16:00 ET (570 s/d 960 menit)
  // Extended (ETH): 04:00 - 20:00 ET (240 s/d 1200 menit, pre 04:00-09:30, post 16:00-20:00)
  return {
    regular: { start: 9 * 60 + 30, end: 16 * 60 },
    extended: { start: 4 * 60, end: 20 * 60 },
    overnight: false,
    timezone: 'America/New_York',
  };
}
