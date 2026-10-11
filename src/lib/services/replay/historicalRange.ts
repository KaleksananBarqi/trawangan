/**
 * Modul Kalkulator Rentang Waktu Lilin Historis untuk Bar Replay
 * 
 * Mengkalkulasi kebutuhan rentang waktu mundur (back-bars) dan maju (forward-bars)
 * saat pengguna memilih tanggal lampau yang belum ter-load di memori grafik.
 */

export interface HistoricalWindow {
  from: number;
  to: number;
  target: number;
  backBars: number;
  forwardBars: number;
}

/**
 * Menghitung estimasi durasi dalam milidetik untuk satu bar lilin berdasarkan timeframe
 */
export function getTimeframeDurationMs(timeframe: string): number {
  const tf = timeframe.trim();

  // Kasus Bulan: 1M, M, 1mo
  if (tf === '1M' || tf === 'M' || tf === '1mo' || /^\d+mo$/i.test(tf)) {
    return 30 * 24 * 3600 * 1000;
  }

  // Kasus Menit: 1m, 3m, 5m, 15m (m kecil, case-sensitive)
  const minuteMatch = /^(\d+)m$/.exec(tf);
  if (minuteMatch) {
    return parseInt(minuteMatch[1], 10) * 60 * 1000;
  }

  const hourMatch = /^(\d+)h$/i.exec(tf);
  if (hourMatch) {
    return parseInt(hourMatch[1], 10) * 3600 * 1000;
  }

  const dayMatch = /^(\d+)?d$/i.exec(tf);
  if (dayMatch || tf === 'D') {
    const days = dayMatch && dayMatch[1] ? parseInt(dayMatch[1], 10) : 1;
    return days * 24 * 3600 * 1000;
  }

  const weekMatch = /^(\d+)?w$/i.exec(tf);
  if (weekMatch || tf === 'W') {
    const weeks = weekMatch && weekMatch[1] ? parseInt(weekMatch[1], 10) : 1;
    return weeks * 7 * 24 * 3600 * 1000;
  }

  // Jika angka murni (menit)
  const num = parseInt(tf, 10);
  if (!isNaN(num) && num > 0) {
    return num * 60 * 1000;
  }

  return 15 * 60 * 1000; // Default 15m
}

/**
 * Menghitung window epoch [from, to] untuk memuat data historis sebelum dan sesudah target
 */
export function calculateHistoricalWindow(
  targetEpoch: number,
  timeframe: string,
  backBars = 500,
  forwardBars = 1000
): HistoricalWindow {
  const barMs = getTimeframeDurationMs(timeframe);
  const now = Date.now();

  const from = targetEpoch - (backBars * barMs);
  const rawTo = targetEpoch + (forwardBars * barMs);
  const to = Math.min(now, rawTo);

  return {
    from,
    to,
    target: targetEpoch,
    backBars,
    forwardBars,
  };
}

/**
 * Mengevaluasi apakah timestamp target sudah tercakup di dalam batas lilin grafik saat ini
 */
export function isTargetInReplayBounds(
  targetEpoch: number,
  bounds?: { first: number; last: number } | null
): boolean {
  if (!bounds || typeof bounds.first !== 'number' || typeof bounds.last !== 'number') {
    return false;
  }
  return targetEpoch >= bounds.first && targetEpoch <= bounds.last;
}
