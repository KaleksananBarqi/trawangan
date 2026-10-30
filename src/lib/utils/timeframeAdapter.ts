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

/**
 * Parsing input cepat dari TimeframeQuickBar ke format interval standar Trawangan
 * Contoh:
 * - "1" -> "1m"
 * - "15" -> "15m"
 * - "60" -> "1h"
 * - "120" -> "2h"
 * - "240" -> "4h"
 * - "1d" / "1D" / "D" -> "1D"
 * - "1w" / "1W" / "W" -> "1W"
 * - "1mo" / "1M" / "M" -> "1M"
 */
export function parseQuickTimeframeInput(raw: string): string {
  if (!raw) return '15m';
  const clean = raw.trim();
  if (!clean) return '15m';

  // 1. Format huruf tunggal
  const upper = clean.toUpperCase();
  if (upper === 'D' || upper === '1D') return '1D';
  if (upper === 'W' || upper === '1W') return '1W';
  if (clean === 'M' || upper === '1M' || upper === '1MO' || upper === 'MO') return '1M';
  if (clean === 'm') return '1m';
  if (upper === 'H' || upper === '1H') return '1h';

  // 2. Angka murni
  if (/^\d+$/.test(clean)) {
    const num = parseInt(clean, 10);
    if (num <= 0) return '1m';

    // Pemetaan menit standar Vela / TradingView
    const minuteMap: Record<number, string> = {
      1: '1m',
      3: '3m',
      5: '5m',
      15: '15m',
      30: '30m',
      45: '45m',
      60: '1h',
      120: '2h',
      180: '3h',
      240: '4h',
      360: '6h',
      480: '8h',
      720: '12h',
      1440: '1D',
      10080: '1W',
      43200: '1M',
    };

    if (minuteMap[num]) {
      return minuteMap[num];
    }

    if (num < 60) {
      return `${num}m`;
    }

    if (num % 60 === 0 && num < 1440) {
      return `${num / 60}h`;
    }

    if (num % 1440 === 0) {
      return `${num / 1440}D`;
    }

    return `${num}m`;
  }

  // 3. Format angka + unit
  const match = clean.match(/^(\d+)\s*([a-zA-Z]+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (unit === 'm' || unit === 'min' || unit === 'mins') {
      return `${num}m`;
    }
    if (unit === 'h' || unit === 'hr' || unit === 'hrs' || unit === 'hour' || unit === 'hours') {
      return `${num}h`;
    }
    if (unit === 'd' || unit === 'day' || unit === 'days') {
      return `${num}D`;
    }
    if (unit === 'w' || unit === 'wk' || unit === 'wks' || unit === 'week' || unit === 'weeks') {
      return `${num}W`;
    }
    if (unit === 'mo' || unit === 'mon' || unit === 'month' || unit === 'months' || match[2] === 'M') {
      return `${num}M`;
    }
    if (unit === 's' || unit === 'sec' || unit === 'secs') {
      return `${num}s`;
    }
  }

  return clean;
}

/**
 * Menghasilkan label deskriptif berbahasa Indonesia untuk interval
 */
export function describeTimeframe(tf: string): string {
  const norm = parseQuickTimeframeInput(tf);
  if (norm.endsWith('m') && !norm.includes('mo')) {
    const num = norm.replace('m', '');
    return `${num} Menit (${norm})`;
  }
  if (norm.endsWith('h')) {
    const num = norm.replace('h', '');
    return `${num} Jam (${norm})`;
  }
  if (norm.endsWith('D')) {
    const num = norm.replace('D', '');
    return `${num} Hari (${norm})`;
  }
  if (norm.endsWith('W')) {
    const num = norm.replace('W', '');
    return `${num} Minggu (${norm})`;
  }
  if (norm.endsWith('M')) {
    const num = norm.replace('M', '');
    return `${num} Bulan (${norm})`;
  }
  if (norm.endsWith('s')) {
    const num = norm.replace('s', '');
    return `${num} Detik (${norm})`;
  }
  return `Interval ${norm}`;
}

