/**
 * vpvrProfile.ts
 * 
 * Modul kalkulasi dan normalisasi parameter untuk Visible Range Volume Profile (VPVR)
 * Menghitung distribusi volume transaksi per level harga pada rentang lilin tampak (visible range),
 * menentukan Point of Control (POC), Value Area High (VAH), Value Area Low (VAL),
 * serta pemisahan volume beli (up) dan jual (down).
 */

export type RowHeightMode = 'number-of-rows' | 'ticks-per-row';

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
}

export interface VpvrRow {
  /** Harga batas bawah baris */
  price: number;
  /** Volume transaksi naik (close >= open) */
  up: number;
  /** Volume transaksi turun (close < open) */
  down: number;
  /** Total akumulasi volume pada baris ini (up + down) */
  total: number;
  /** Apakah baris ini berada di dalam Value Area */
  isValueArea: boolean;
  /** Apakah baris ini merupakan Point of Control */
  isPoc: boolean;
}

export interface VpvrProfileResult {
  /** Seluruh baris profil harga */
  rows: VpvrRow[];
  /** Tinggi harga per baris */
  rowHeight: number;
  /** Harga terendah pada rentang tampak */
  minPrice: number;
  /** Harga tertinggi pada rentang tampak */
  maxPrice: number;
  /** Akumulasi volume terbesar di antara seluruh baris */
  maxVolume: number;
  /** Total keseluruhan volume transaksi dalam rentang tampak */
  totalVolume: number;
  /** Indeks baris Point of Control */
  pocIndex: number;
  /** Harga level Point of Control */
  pocPrice: number;
  /** Indeks baris batas bawah Value Area (VAL) */
  valIndex: number;
  /** Harga Value Area Low */
  valPrice: number;
  /** Indeks baris batas atas Value Area (VAH) */
  vahIndex: number;
  /** Harga Value Area High */
  vahPrice: number;
  /** Persentase volume yang tercakup dalam Value Area */
  valueAreaPercentage: number;
  /** Rentang indeks lilin yang dihitung */
  barRange: { fromIndex: number; toIndex: number; barCount: number };
}

export interface CandleBar {
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Normalisasi parameter VPVR dari berbagai variasi penamaan input pipeline
 */
export function normalizeVpvrInputs(inputs: Record<string, any> = {}): Required<VpvrOptions> {
  const rowCountRaw = inputs.rowCount ?? inputs.rows ?? 24;
  const rows = Math.round(Math.min(400, Math.max(2, typeof rowCountRaw === 'number' && Number.isFinite(rowCountRaw) ? rowCountRaw : 24)));

  const vaPctRaw = inputs.valueAreaVolumePercentage ?? inputs.valueAreaPct ?? 70;
  const valueAreaPct = Math.min(100, Math.max(0, typeof vaPctRaw === 'number' && Number.isFinite(vaPctRaw) ? vaPctRaw : 70));

  const widthPctRaw = inputs.widthPct ?? 30;
  const widthPct = Math.min(90, Math.max(5, typeof widthPctRaw === 'number' && Number.isFinite(widthPctRaw) ? widthPctRaw : 30));

  const vaOpacityRaw = inputs.vaOpacity ?? 62;
  const vaOpacity = Math.min(100, Math.max(0, typeof vaOpacityRaw === 'number' && Number.isFinite(vaOpacityRaw) ? vaOpacityRaw : 62));

  const outsideOpacityRaw = inputs.outsideOpacity ?? 28;
  const outsideOpacity = Math.min(100, Math.max(0, typeof outsideOpacityRaw === 'number' && Number.isFinite(outsideOpacityRaw) ? outsideOpacityRaw : 28));

  const pocOpacityRaw = inputs.pocOpacity ?? 90;
  const pocOpacity = Math.min(100, Math.max(0, typeof pocOpacityRaw === 'number' && Number.isFinite(pocOpacityRaw) ? pocOpacityRaw : 90));

  const rowHeightMode: RowHeightMode = inputs.rowHeightMode === 'ticks-per-row' ? 'ticks-per-row' : 'number-of-rows';

  return {
    rows,
    rowCount: rows,
    rowHeightMode,
    tickSize: typeof inputs.tickSize === 'number' && inputs.tickSize > 0 ? inputs.tickSize : 0.01,
    ticksPerRow: typeof inputs.ticksPerRow === 'number' && inputs.ticksPerRow > 0 ? inputs.ticksPerRow : 10,
    valueAreaPct,
    valueAreaVolumePercentage: valueAreaPct,
    widthPct,
    upColor: typeof inputs.upColor === 'string' && inputs.upColor !== '' ? inputs.upColor : '#2962ff',
    downColor: typeof inputs.downColor === 'string' && inputs.downColor !== '' ? inputs.downColor : '#f23645',
    showPoc: inputs.showPoc !== false,
    pocColor: typeof inputs.pocColor === 'string' && inputs.pocColor !== '' ? inputs.pocColor : '#eab308',
    vaOpacity,
    outsideOpacity,
    pocOpacity,
  };
}

/**
 * Menghitung profil distribusi volume tampak (VPVR) berdasarkan rentang lilin aktif
 */
export function calculateVpvrProfile(
  bars: CandleBar[],
  fromIndex: number,
  toIndex: number,
  options: VpvrOptions = {}
): VpvrProfileResult | null {
  if (!Array.isArray(bars) || bars.length === 0) return null;

  const from = Math.max(0, Math.min(fromIndex, toIndex));
  const to = Math.min(bars.length - 1, Math.max(fromIndex, toIndex));
  if (from > to) return null;

  const normalized = normalizeVpvrInputs(options);

  // 1. Tentukan rentang harga minimum dan maksimum pada lilin yang memiliki volume
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalCandleVolume = 0;

  for (let i = from; i <= to; i += 1) {
    const b = bars[i];
    if (!b || !(b.volume != null && b.volume > 0)) continue;
    if (b.low < minPrice) minPrice = b.low;
    if (b.high > maxPrice) maxPrice = b.high;
    totalCandleVolume += b.volume;
  }

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || totalCandleVolume <= 0) {
    return null;
  }

  // 2. Hitung jumlah baris (row count) dan tinggi tiap baris (row height)
  let n = normalized.rows;
  let rowH: number;

  if (normalized.rowHeightMode === 'ticks-per-row' && normalized.tickSize > 0 && normalized.ticksPerRow > 0) {
    rowH = normalized.tickSize * normalized.ticksPerRow;
    if (maxPrice > minPrice) {
      n = Math.max(2, Math.min(400, Math.round((maxPrice - minPrice) / rowH)));
      rowH = (maxPrice - minPrice) / n;
    } else {
      n = 1;
      rowH = 1;
    }
  } else {
    n = maxPrice > minPrice ? Math.max(2, Math.round(normalized.rows)) : 1;
    rowH = maxPrice > minPrice ? (maxPrice - minPrice) / n : 1;
  }

  // Inisialisasi baris
  const rows: Array<{ price: number; up: number; down: number; total: number; isValueArea: boolean; isPoc: boolean }> =
    Array.from({ length: n }, (_, k) => ({
      price: minPrice + k * rowH,
      up: 0,
      down: 0,
      total: 0,
      isValueArea: false,
      isPoc: false,
    }));

  const clamp = (val: number, maxVal: number) => Math.max(0, Math.min(maxVal - 1, val));

  // 3. Distribusikan volume setiap lilin ke baris-baris harga yang relevan
  for (let i = from; i <= to; i += 1) {
    const b = bars[i];
    const v = b?.volume;
    if (!(v != null && v > 0)) continue;

    const side = b.close >= b.open ? 'up' : 'down';
    const span = b.high - b.low;

    if (span <= 0) {
      const k = clamp(Math.floor((b.low - minPrice) / rowH), n);
      rows[k][side] += v;
      continue;
    }

    const kFirst = clamp(Math.floor((b.low - minPrice) / rowH), n);
    const kLast = clamp(Math.floor((b.high - minPrice) / rowH - 1e-9), n);

    for (let k = kFirst; k <= kLast; k += 1) {
      const rowBot = minPrice + k * rowH;
      const overlap = Math.min(b.high, rowBot + rowH) - Math.max(b.low, rowBot);
      if (overlap > 0) {
        rows[k][side] += (v * overlap) / span;
      }
    }
  }

  // 4. Hitung total volume tiap baris dan tentukan Point of Control (POC)
  let total = 0;
  let maxTotal = 0;
  let poc = 0;

  for (let k = 0; k < n; k += 1) {
    const row = rows[k];
    row.total = row.up + row.down;
    total += row.total;
    if (row.total > maxTotal) {
      maxTotal = row.total;
      poc = k;
    }
  }

  if (maxTotal <= 0 || total <= 0) return null;

  // 5. Tentukan Value Area High (VAH) & Value Area Low (VAL)
  const targetFraction = Math.min(1, Math.max(0, normalized.valueAreaPct / 100));
  const targetVolume = total * targetFraction;

  let vaFrom = poc;
  let vaTo = poc;
  let acc = maxTotal;

  while (acc < targetVolume && (vaFrom > 0 || vaTo < n - 1)) {
    const below = vaFrom > 0 ? rows[vaFrom - 1].total : -1;
    const above = vaTo < n - 1 ? rows[vaTo + 1].total : -1;

    if (above > below) {
      vaTo += 1;
      acc += above;
    } else {
      vaFrom -= 1;
      acc += below;
    }
  }

  // Tandai status POC dan Value Area pada masing-masing baris
  for (let k = 0; k < n; k += 1) {
    rows[k].isValueArea = k >= vaFrom && k <= vaTo;
    rows[k].isPoc = k === poc;
  }

  const pocPrice = minPrice + (poc + 0.5) * rowH;
  const valPrice = minPrice + vaFrom * rowH;
  const vahPrice = minPrice + (vaTo + 1) * rowH;

  return {
    rows,
    rowHeight: rowH,
    minPrice,
    maxPrice,
    maxVolume: maxTotal,
    totalVolume: total,
    pocIndex: poc,
    pocPrice,
    valIndex: vaFrom,
    valPrice,
    vahIndex: vaTo,
    vahPrice,
    valueAreaPercentage: (acc / total) * 100,
    barRange: {
      fromIndex: from,
      toIndex: to,
      barCount: to - from + 1,
    },
  };
}
