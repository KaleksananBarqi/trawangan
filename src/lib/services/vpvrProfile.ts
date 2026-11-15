/**
 * vpvrProfile.ts
 *
 * Modul normalisasi parameter dan translasi opsi engine untuk Visible Range Volume Profile (VPVR).
 * Kalkulasi histogram VPVR dijalankan langsung oleh engine WebGL2 Vela.
 */

export type RowHeightMode = 'number-of-rows' | 'ticks-per-row';
export type VpvrAnchorMode = 'visible' | 'session' | 'custom';

export interface VpvrOptions {
  /** Jumlah baris horizontal pada profil (default: 24) */
  rows?: number;
  rowCount?: number;
  /** Mode penentuan tinggi baris: jumlah baris tetap atau tick per baris */
  rowHeightMode?: RowHeightMode;
  /** Ukuran tick minimum (digunakan pada mode ticks-per-row) */
  tickSize?: number;
  /** Jumlah tick per baris jika rowHeightMode === 'ticks-per-row' */
  ticksPerRow?: number;
  /** Persentase volume Value Area (default: 70, rentang: 0 - 100) */
  valueAreaPct?: number;
  valueAreaPercent?: number;
  valueAreaVolumePercentage?: number;
  /** Lebar maksimum histogram relatif terhadap lebar canvas (default: 30%, rentang: 5 - 90) */
  widthPct?: number;
  /** Warna volume naik (bullish) */
  upColor?: string;
  /** Warna volume turun (bearish) */
  downColor?: string;
  /** Apakah menampilkan penanda garis Point of Control (POC) */
  showPoc?: boolean;
  /** Warna garis / kotak Point of Control */
  pocColor?: string;
  /** Opasitas histogram di dalam Value Area (0 - 100, default: 62) */
  vaOpacity?: number;
  /** Opasitas histogram di luar Value Area (0 - 100, default: 28) */
  outsideOpacity?: number;
  /** Opasitas garis POC (0 - 100, default: 90) */
  pocOpacity?: number;
  /** Mode anchor VPVR: rentang tampak, sesi, atau rentang waktu kustom */
  anchorMode?: VpvrAnchorMode;
  /** Timestamp awal anchor kustom dalam detik/ms (>= 0, atau null jika tidak aktif) */
  anchorStartTime?: number | null;
  /** Timestamp akhir anchor kustom dalam detik/ms (>= 0, atau null jika tidak aktif) */
  anchorEndTime?: number | null;
}

export interface EngineVpvrOptions {
  rows: number;
  widthFrac: number;
  upColor: string;
  downColor: string;
  showPoc: boolean;
  valueAreaFrac: number;
  anchorMode: VpvrAnchorMode;
  anchorStartTime: number | null;
  anchorEndTime: number | null;
}

function sanitizeAnchorTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, value);
}

/**
 * Normalisasi parameter VPVR dari berbagai variasi penamaan input pipeline
 * serta melakukan clamping agar nilai tetap berada dalam batas aman engine Vela.
 */
export function normalizeVpvrInputs(inputs: Record<string, any> = {}): Required<VpvrOptions> {
  const rowCountRaw = inputs.rowCount ?? inputs.rows ?? 24;
  const rows = Math.round(
    Math.min(400, Math.max(2, typeof rowCountRaw === 'number' && Number.isFinite(rowCountRaw) ? rowCountRaw : 24))
  );

  const vaPctRaw = inputs.valueAreaVolumePercentage ?? inputs.valueAreaPct ?? inputs.valueAreaPercent ?? 70;
  const valueAreaPct = Math.min(
    100,
    Math.max(0, typeof vaPctRaw === 'number' && Number.isFinite(vaPctRaw) ? vaPctRaw : 70)
  );

  const widthPctRaw = inputs.widthPct ?? 30;
  const widthPct = Math.min(
    90,
    Math.max(5, typeof widthPctRaw === 'number' && Number.isFinite(widthPctRaw) ? widthPctRaw : 30)
  );

  const vaOpacityRaw = inputs.vaOpacity ?? 62;
  const vaOpacity = Math.min(
    100,
    Math.max(0, typeof vaOpacityRaw === 'number' && Number.isFinite(vaOpacityRaw) ? vaOpacityRaw : 62)
  );

  const outsideOpacityRaw = inputs.outsideOpacity ?? 28;
  const outsideOpacity = Math.min(
    100,
    Math.max(0, typeof outsideOpacityRaw === 'number' && Number.isFinite(outsideOpacityRaw) ? outsideOpacityRaw : 28)
  );

  const pocOpacityRaw = inputs.pocOpacity ?? 90;
  const pocOpacity = Math.min(
    100,
    Math.max(0, typeof pocOpacityRaw === 'number' && Number.isFinite(pocOpacityRaw) ? pocOpacityRaw : 90)
  );

  const rowHeightMode: RowHeightMode = inputs.rowHeightMode === 'ticks-per-row' ? 'ticks-per-row' : 'number-of-rows';
  const anchorMode: VpvrAnchorMode =
    inputs.anchorMode === 'session' || inputs.anchorMode === 'custom' ? inputs.anchorMode : 'visible';

  let anchorStartTime = sanitizeAnchorTimestamp(inputs.anchorStartTime);
  let anchorEndTime = sanitizeAnchorTimestamp(inputs.anchorEndTime);
  if (anchorStartTime !== null && anchorEndTime !== null && anchorStartTime > anchorEndTime) {
    [anchorStartTime, anchorEndTime] = [anchorEndTime, anchorStartTime];
  }

  return {
    rows,
    rowCount: rows,
    rowHeightMode,
    tickSize: typeof inputs.tickSize === 'number' && inputs.tickSize > 0 ? inputs.tickSize : 0.01,
    ticksPerRow: typeof inputs.ticksPerRow === 'number' && inputs.ticksPerRow > 0 ? inputs.ticksPerRow : 10,
    valueAreaPct,
    valueAreaPercent: valueAreaPct,
    valueAreaVolumePercentage: valueAreaPct,
    widthPct,
    upColor: typeof inputs.upColor === 'string' && inputs.upColor !== '' ? inputs.upColor : '#2962ff',
    downColor: typeof inputs.downColor === 'string' && inputs.downColor !== '' ? inputs.downColor : '#f23645',
    showPoc: inputs.showPoc !== false,
    pocColor: typeof inputs.pocColor === 'string' && inputs.pocColor !== '' ? inputs.pocColor : '#eab308',
    vaOpacity,
    outsideOpacity,
    pocOpacity,
    anchorMode,
    anchorStartTime,
    anchorEndTime,
  };
}

/**
 * Menerjemahkan input VPVR ternormalisasi ke format opsi layer engine Vela.
 */
export function toEngineVpvrOptions(inputs: Record<string, any> = {}): EngineVpvrOptions {
  const normalized = normalizeVpvrInputs(inputs);
  return {
    rows: normalized.rows,
    widthFrac: normalized.widthPct / 100,
    upColor: normalized.upColor,
    downColor: normalized.downColor,
    showPoc: normalized.showPoc,
    valueAreaFrac: normalized.valueAreaPct / 100,
    anchorMode: normalized.anchorMode,
    anchorStartTime: normalized.anchorStartTime,
    anchorEndTime: normalized.anchorEndTime,
  };
}
