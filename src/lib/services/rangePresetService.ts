// Service Manajemen Visible Range Presets
// Mengatur pemetaan horizon waktu standar institusional ('1D'..'ALL'),
// penentuan resolusi timeframe candle optimal, kalkulasi bar budget,
// serta komputasi batas viewport span deterministik.

import type { Timeframe } from '../types/market';
import { toVelaTimeframe } from '../utils/timeframeAdapter';

/**
 * Delapan preset rentang waktu standar institusional
 */
export type VisibleRangePreset = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

export const VISIBLE_RANGE_PRESETS: readonly VisibleRangePreset[] = [
  '1D',
  '5D',
  '1M',
  '3M',
  '6M',
  'YTD',
  '1Y',
  'ALL',
] as const;

export interface RangePresetConfig {
  id: VisibleRangePreset;
  label: string;
  timeframe: Timeframe;
  velaTimeframe: string;
  bars: number;
  description: string;
  spanMs?: number;
}

const DAY_MS = 86_400_000;

/**
 * Konfigurasi deterministik untuk setiap preset rentang waktu
 */
const PRESET_CONFIGS: Record<VisibleRangePreset, RangePresetConfig> = {
  '1D': {
    id: '1D',
    label: '1D',
    timeframe: '1m',
    velaTimeframe: '1',
    bars: 1500, // 24 jam @ 1m = 1440 bar
    description: '1 Hari (1 Menit)',
    spanMs: DAY_MS,
  },
  '5D': {
    id: '5D',
    label: '5D',
    timeframe: '5m',
    velaTimeframe: '5',
    bars: 1800, // 5 hari @ 5m = 1440 bar (+ buffer)
    description: '5 Hari (5 Menit)',
    spanMs: 5 * DAY_MS,
  },
  '1M': {
    id: '1M',
    label: '1M',
    timeframe: '30m',
    velaTimeframe: '30',
    bars: 1500, // 30 hari @ 30m = 1440 bar
    description: '1 Bulan (30 Menit)',
    spanMs: 30 * DAY_MS,
  },
  '3M': {
    id: '3M',
    label: '3M',
    timeframe: '1h',
    velaTimeframe: '60',
    bars: 2200, // 90 hari @ 1h = 2160 bar
    description: '3 Bulan (1 Jam)',
    spanMs: 90 * DAY_MS,
  },
  '6M': {
    id: '6M',
    label: '6M',
    timeframe: '4h',
    velaTimeframe: '240',
    bars: 1200, // 180 hari @ 4h = 1080 bar
    description: '6 Bulan (4 Jam)',
    spanMs: 180 * DAY_MS,
  },
  'YTD': {
    id: 'YTD',
    label: 'YTD',
    timeframe: '1D',
    velaTimeframe: 'D',
    bars: 500, // <= 366 hari @ 1D
    description: 'Tahun Berjalan / Year to Date (1 Hari)',
  },
  '1Y': {
    id: '1Y',
    label: '1Y',
    timeframe: '1D',
    velaTimeframe: 'D',
    bars: 500, // 365 hari @ 1D
    description: '1 Tahun (1 Hari)',
    spanMs: 365 * DAY_MS,
  },
  'ALL': {
    id: 'ALL',
    label: 'ALL',
    timeframe: '1W',
    velaTimeframe: 'W',
    bars: 5000, // Seluruh riwayat yang tersedia dari provider
    description: 'Seluruh Riwayat (1 Minggu)',
  },
};

/**
 * Validasi apakah sebuah nilai adalah VisibleRangePreset yang valid
 */
export function isValidRangePreset(preset: unknown): preset is VisibleRangePreset {
  if (typeof preset !== 'string') return false;
  return VISIBLE_RANGE_PRESETS.includes(preset as VisibleRangePreset);
}

/**
 * Mengambil konfigurasi preset lengkap berdasarkan id
 */
export function getRangePresetConfig(preset: VisibleRangePreset): RangePresetConfig {
  const cfg = PRESET_CONFIGS[preset];
  if (!cfg) {
    return PRESET_CONFIGS['1D'];
  }
  return { ...cfg };
}

/**
 * Menghitung rentang waktu { from, to } untuk preset yang dipilih
 * @param preset Identifier preset
 * @param bars Kumpulan candle bars yang sudah dimuat (opsional)
 * @param referenceTime Waktu acuan saat ini dalam epoch milidetik (opsional, default: Date.now())
 */
export function calculateRangePresetSpan(
  preset: VisibleRangePreset,
  bars?: Array<{ time: number }>,
  referenceTime?: number
): { from: number; to: number } {
  const now = referenceTime ?? Date.now();
  const hasBars = Array.isArray(bars) && bars.length > 0;
  const firstBarTime = hasBars ? bars[0].time : null;
  const lastBarTime = hasBars ? bars[bars.length - 1].time : now;

  const to = referenceTime !== undefined ? referenceTime : lastBarTime;

  if (preset === 'ALL') {
    if (hasBars && firstBarTime !== null) {
      return { from: firstBarTime, to: lastBarTime };
    }
    // Fallback bila data candle belum terisi: 5 tahun ke belakang
    return { from: to - 5 * 365 * DAY_MS, to };
  }

  let from: number;
  if (preset === 'YTD') {
    const toDate = new Date(to);
    from = Date.UTC(toDate.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  } else {
    const config = PRESET_CONFIGS[preset];
    const span = config?.spanMs ?? DAY_MS;
    from = to - span;
  }

  // Jika bar pertama lebih baru dari 'from', batas bawah disesuaikan jika data terbatas
  if (hasBars && firstBarTime !== null && firstBarTime > from) {
    from = firstBarTime;
  }

  return { from, to };
}

/**
 * Merotasi preset ke horizon berikutnya atau sebelumnya secara siklik
 */
export function getNextRangePreset(
  current: VisibleRangePreset | null | undefined,
  direction: 'next' | 'prev' = 'next'
): VisibleRangePreset {
  if (!current || !isValidRangePreset(current)) {
    return '1D';
  }

  const currentIndex = VISIBLE_RANGE_PRESETS.indexOf(current);
  const total = VISIBLE_RANGE_PRESETS.length;

  if (direction === 'prev') {
    const nextIndex = (currentIndex - 1 + total) % total;
    return VISIBLE_RANGE_PRESETS[nextIndex];
  }

  const nextIndex = (currentIndex + 1) % total;
  return VISIBLE_RANGE_PRESETS[nextIndex];
}
