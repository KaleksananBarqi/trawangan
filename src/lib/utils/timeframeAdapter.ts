/**
 * Modul Adaptasi Timeframe Standar TradingView <-> Vela Engine <-> Bursa
 * 
 * Menjamin konsistensi representasi timeframe:
 * - Standar TradingView / UI Trawangan: '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1D', '1W', '1M'
 * - Vela Engine Timeframe: '1', '3', '5', '15', '30', '60', '120', '240', 'D', 'W', 'M'
 * - Bursa REST Klines Interval (Binance/Bitunix): '1m', '15m', '1h', '4h', '1d', '1w', '1M'
 */

/**
 * Konversi timeframe UI / TradingView ke format yang dipahami Vela Workspace
 */
export function toVelaTimeframe(tf: string): string {
  if (!tf) return '15m';

  // Kasus kritis: 1M (Bulanan) harus dipetakan ke 'M' agar Vela tidak menormalisasinya menjadi 1 menit
  if (tf === '1M' || tf === '1mo' || tf === 'M') {
    return 'M';
  }

  if (tf === '1D' || tf === 'D') {
    return 'D';
  }

  if (tf === '1W' || tf === 'W') {
    return 'W';
  }

  return tf;
}

/**
 * Konversi format internal Vela kembali ke format standar TradingView di antarmuka Trawangan
 */
export function fromVelaTimeframe(tf: string): string {
  if (!tf) return '15m';

  if (tf === 'M' || tf === '1mo' || tf === '1M') {
    return '1M';
  }

  if (tf === 'D' || tf === '1D') {
    return '1D';
  }

  if (tf === 'W' || tf === '1W') {
    return '1W';
  }

  // Pemetaan menit mentah Vela ke format label menit/jam
  const minuteMap: Record<string, string> = {
    '1': '1m',
    '3': '3m',
    '5': '5m',
    '15': '15m',
    '30': '30m',
    '45': '45m',
    '60': '1h',
    '120': '2h',
    '180': '3h',
    '240': '4h',
    '360': '6h',
    '480': '8h',
    '720': '12h',
  };

  if (minuteMap[tf]) {
    return minuteMap[tf];
  }

  return tf;
}

/**
 * Konversi timeframe ke interval resmi klines REST API bursa kripto (Binance / Bitunix)
 */
export function toExchangeInterval(tf: string, _providerId = 'binance'): string {
  if (isMonthlyTimeframe(tf)) {
    return '1M';
  }

  if (tf === '1D' || tf === 'D') {
    return '1d';
  }

  if (tf === '1W' || tf === 'W') {
    return '1w';
  }

  return tf;
}

/**
 * Cek apakah sebuah timeframe merupakan timeframe bulanan
 */
export function isMonthlyTimeframe(tf: string): boolean {
  return tf === '1M' || tf === 'M' || tf === '1mo';
}
