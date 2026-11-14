import {
  Vela,
  nativeIndicatorDescriptors,
  type NativeIndicatorDescriptor,
} from '@luxalgo/vela';
import { INDICATOR_PRESETS, type IndicatorPreset } from '../data/indicatorPresets';
import { resolveEffectiveVolumeColors } from '../constants/themes';
import type { PineScriptRecord } from '../types/market';

export type IndicatorCategory =
  | 'Trend'
  | 'Momentum'
  | 'Volatility'
  | 'Volume'
  | 'Profile'
  | 'Signals'
  | 'Custom';

export interface UnifiedIndicatorDescriptor {
  id: string;
  title: string;
  shortTitle?: string;
  category: IndicatorCategory;
  categories?: IndicatorCategory[];
  kind: 'native' | 'pine';
  overlay: boolean;
  visible?: boolean;
  description?: string;
  sourceCode?: string;
  nativeType?: string;
  inputsSchema?: any;
  defaultInputs?: Record<string, any>;
  multiInstance?: boolean;
  paneHint?: string;
  prominent?: boolean;
}

export interface FilterCatalogOptions {
  searchQuery?: string;
  category?: 'All' | IndicatorCategory | 'Custom Scripts' | string;
  kind?: 'all' | 'native' | 'pine';
  favoritesOnly?: boolean;
  favoriteIds?: string[];
}

/**
 * Pemetaan kategori resmi untuk 76 indikator native bawaan Vela
 */
export const NATIVE_CATEGORY_MAP: Record<string, IndicatorCategory> = {
  // Profil Volume & Titik Penting (2)
  'vpvr': 'Profile',
  'pivot-points': 'Profile',

  // Volume & Aliran Dana (17)
  'volume': 'Volume',
  'vwap': 'Volume',
  'on-balance-volume': 'Volume',
  'accumulation-distribution': 'Volume',
  'chaikin-money-flow': 'Volume',
  'chaikin-oscillator': 'Volume',
  'ease-of-movement': 'Volume',
  'force-index': 'Volume',
  'klinger-oscillator': 'Volume',
  'money-flow-index': 'Volume',
  'negative-volume-index': 'Volume',
  'positive-volume-index': 'Volume',
  'price-volume-trend': 'Volume',
  'volume-oscillator': 'Volume',
  'pvo': 'Volume',
  'volume-flow-indicator': 'Volume',
  'intraday-intensity': 'Volume',

  // Volatilitas & Pita Saluran (12)
  'bollinger-bands': 'Volatility',
  'percent-b': 'Volatility',
  'bandwidth': 'Volatility',
  'keltner-channels': 'Volatility',
  'donchian-channels': 'Volatility',
  'average-true-range': 'Volatility',
  'historical-volatility': 'Volatility',
  'chaikin-volatility': 'Volatility',
  'mass-index': 'Volatility',
  'standard-deviation': 'Volatility',
  'ulcer-index': 'Volatility',
  'choppiness-index': 'Volatility',

  // Sinyal Pola (1)
  'williams-fractal': 'Signals',

  // Indikator Tren & Rata-rata Bergerak (18)
  'sma': 'Trend',
  'ema': 'Trend',
  'moving-average': 'Trend',
  'rma': 'Trend',
  'zlema': 'Trend',
  'vidya': 'Trend',
  'ma-envelope': 'Trend',
  'linear-regression': 'Trend',
  'chandelier-exit': 'Trend',
  'chande-kroll-stop': 'Trend',
  'supertrend': 'Trend',
  'williams-alligator': 'Trend',
  'parabolic-sar': 'Trend',
  '52-week-high-low': 'Trend',
  'zigzag': 'Trend',
  'aroon': 'Trend',
  'average-directional-index': 'Trend',
  'vortex-indicator': 'Trend',

  // Momentum & Osilator (26)
  'rsi': 'Momentum',
  'stochastic': 'Momentum',
  'stochastic-rsi': 'Momentum',
  'macd': 'Momentum',
  'ppo': 'Momentum',
  'awesome-oscillator': 'Momentum',
  'commodity-channel-index': 'Momentum',
  'williams-percent-r': 'Momentum',
  'chande-momentum-oscillator': 'Momentum',
  'connors-rsi': 'Momentum',
  'fisher-transform': 'Momentum',
  'trix': 'Momentum',
  'true-strength-index': 'Momentum',
  'smi-ergodic': 'Momentum',
  'schaff-trend-cycle': 'Momentum',
  'know-sure-thing': 'Momentum',
  'coppock-curve': 'Momentum',
  'detrended-price-oscillator': 'Momentum',
  'rate-of-change': 'Momentum',
  'ultimate-oscillator': 'Momentum',
  'relative-vigor-index': 'Momentum',
  'relative-volatility-index': 'Momentum',
  'balance-of-power': 'Momentum',
  'elder-ray': 'Momentum',
  'ttm-squeeze': 'Momentum',
  'gator-oscillator': 'Momentum',
};

/**
 * Ringkasan deskripsi bahasa Indonesia untuk studi native populer
 */
export const NATIVE_DESCRIPTION_MAP: Record<string, string> = {
  'vpvr': 'Visible Range Volume Profile: Menampilkan distribusi volume transaksi per level harga pada rentang grafik yang terlihat (visible range), dilengkapi Point of Control (POC), Value Area (VAH/VAL 70%), dan pemisahan volume naik/turun berbasis WebGL2 60 FPS.',
  'pivot-points': 'Pivot Points Standard: Level support dan resistance matematis (Traditional, Fibonacci, Woodie, Classic, Demark, Camarilla).',
  'volume': 'Volume Transaksi: Menampilkan batang volume trading per lilin dengan indikator moving average.',
  'vwap': 'Volume Weighted Average Price: Rata-rata harga tertimbang volume untuk mengukur nilai wajar intraday.',
  'sma': 'Simple Moving Average: Rata-rata aritmatika harga penutupan selama periode waktu tertentu.',
  'ema': 'Exponential Moving Average: Rata-rata bergerak eksponensial yang memberikan bobot lebih pada harga terbaru.',
  'moving-average': 'Moving Average: Rata-rata pergerakan harga dasar yang fleksibel.',
  'rma': 'Smoothed Moving Average: Rata-rata pergerakan tereksponensial halus gaya Wilder.',
  'zlema': 'Zero-Lag Exponential Moving Average: Mengurangi jeda (*lag*) tren dengan memproyeksikan momentum data terkini.',
  'vidya': 'Variable Index Dynamic Average: Rata-rata bergerak yang menyesuaikan kecepatannya berdasarkan volatilitas Chande.',
  'ma-envelope': 'Moving Average Envelope: Pita persentase di atas dan di bawah rata-rata bergerak.',
  'linear-regression': 'Linear Regression Curve: Kurva garis tren regresi linier statistik harga penutupan.',
  'bollinger-bands': 'Bollinger Bands: Pita volatilitas atas, tengah, dan bawah berbasis deviasi standar dari SMA.',
  'percent-b': 'Bollinger Bands %B: Mengukur posisi harga relatif terhadap pita Bollinger Bands.',
  'bandwidth': 'Bollinger Bands Width: Mengukur lebar pita Bollinger Bands untuk mendeteksi siklus squeeze dan ekspansi.',
  'keltner-channels': 'Keltner Channels: Kanal volatilitas berbasis kelipatan Average True Range (ATR) di sekitar garis EMA.',
  'donchian-channels': 'Donchian Channels: Menampilkan rentang harga tertinggi dan terendah selama periode tertentu (kanal breakout).',
  'chandelier-exit': 'Chandelier Exit: Trailing stop loss berbasis volatilitas ATR dari titik harga tertinggi atau terendah.',
  'chande-kroll-stop': 'Chande Kroll Stop: Trailing stop berbasis volatilitas tinggi/rendah dari Tushar Chande.',
  'supertrend': 'SuperTrend: Indikator pengikut tren berbasis kelipatan ATR untuk menentukan arah tren dan level stop dinamis.',
  'williams-alligator': 'Williams Alligator: Kombinasi tiga rata-rata bergerak bergeser (Jaw, Teeth, Lips) untuk mengenali pembentukan tren.',
  'gator-oscillator': 'Gator Oscillator: Diagram visual divergensi antara garis-garis Williams Alligator.',
  'parabolic-sar': 'Parabolic SAR: Menentukan titik potensi pembalikan arah harga (stop and reverse) dengan akselerasi parabolik.',
  '52-week-high-low': '52-Week High/Low: Menampilkan level tertinggi dan terendah dalam rentang 52 minggu terakhir.',
  'zigzag': 'ZigZag: Menyaring fluktuasi harga kecil dan menghubungkan titik-titik balik harga yang signifikan.',
  'williams-fractal': 'Williams Fractal: Penanda panah pembalikan pola harga lima lilin (fraktal atas & bawah).',
  'rsi': 'Relative Strength Index: Mengukur kecepatan dan perubahan pergerakan harga untuk mengidentifikasi overbought dan oversold.',
  'stochastic': 'Stochastic Oscillator: Membandingkan harga penutupan dengan rentang harga selama periode waktu tertentu.',
  'stochastic-rsi': 'Stochastic RSI: Mengaplikasikan formula Stochastic pada nilai RSI untuk sensitivitas momentum maksimal.',
  'macd': 'Moving Average Convergence Divergence: Hubungan antara dua rata-rata bergerak eksponensial (MACD line, signal line, histogram).',
  'ppo': 'Percentage Price Oscillator: Versi persentase dari MACD yang cocok untuk membandingkan sekuritas lintas harga.',
  'awesome-oscillator': 'Awesome Oscillator: Selisih antara SMA 5 periode dan SMA 34 periode dari harga median.',
  'commodity-channel-index': 'Commodity Channel Index: Mengukur penyimpangan harga aset dari rata-rata statistiknya.',
  'williams-percent-r': 'Williams %R: Osilator momentum yang mengukur level overbought dan oversold pada skala 0 hingga -100.',
  'chande-momentum-oscillator': 'Chande Momentum Oscillator: Menghitung momentum murni pada hari kenaikan dan penurunan tanpa smoothing ganda.',
  'connors-rsi': 'Connors RSI: Komposit tiga komponen (RSI, Streak RSI, dan Percent Rank) untuk strategi mean-reversion jangka pendek.',
  'fisher-transform': 'Fisher Transform: Mengubah harga menjadi distribusi normal Gauss untuk mengidentifikasi pembalikan harga tajam.',
  'trix': 'TRIX: Osilator momentum persentase laju perubahan dari triple exponential moving average.',
  'true-strength-index': 'True Strength Index: Osilator momentum berbasis double smoothed harga untuk memfilter fluktuasi acak.',
  'smi-ergodic': 'SMI Ergodic Oscillator: Osilator Stochastic Momentum Index yang dilengkapi garis sinyal.',
  'schaff-trend-cycle': 'Schaff Trend Cycle: Menggabungkan MACD dengan Stochastic untuk siklus tren yang lebih cepat dan andal.',
  'know-sure-thing': 'Know Sure Thing (KST): Osilator momentum komposit berbasis empat laju perubahan harga yang dihaluskan.',
  'coppock-curve': 'Coppock Curve: Indikator momentum jangka panjang yang dirancang untuk mendeteksi titik balik pasar bullish.',
  'detrended-price-oscillator': 'Detrended Price Oscillator: Menghilangkan tren jangka panjang harga untuk menyoroti siklus pendek.',
  'rate-of-change': 'Rate of Change (ROC): Mengukur persentase perubahan harga antara harga sekarang dan periode n sebelumnya.',
  'ultimate-oscillator': 'Ultimate Oscillator: Menggabungkan tekanan beli pada tiga rentang waktu berbeda untuk mengurangi sinyal palsu.',
  'relative-vigor-index': 'Relative Vigor Index (RVI): Mengukur keyakinan tren berdasarkan posisi harga penutupan terhadap rentang lilin.',
  'relative-volatility-index': 'Relative Volatility Index: Mirip RSI tetapi mengukur deviasi standar arah pergerakan harga.',
  'balance-of-power': 'Balance of Power (BOP): Mengukur kekuatan pembeli vs penjual dengan mengevaluasi posisi penutupan lilin.',
  'elder-ray': 'Elder Ray Index: Mengukur Bull Power dan Bear Power terhadap Exponential Moving Average 13.',
  'ttm-squeeze': 'TTM Squeeze: Mengukur kompresi volatilitas Bollinger Bands di dalam Keltner Channels untuk mendeteksi breakout eksplosif.',
  'aroon': 'Aroon: Mengukur waktu yang dibutuhkan harga untuk mencetak level tertinggi atau terendah baru.',
  'average-directional-index': 'Average Directional Index (ADX): Mengukur kekuatan tren secara keseluruhan terlepas dari arah naik atau turun.',
  'vortex-indicator': 'Vortex Indicator: Menangkap awal tren baru dengan membandingkan jarak antara titik harga tertinggi dan terendah lilin berturut-turut.',
  'average-true-range': 'Average True Range (ATR): Mengukur volatilitas pasar berdasarkan rata-rata rentang harga sebenarnya.',
  'historical-volatility': 'Historical Volatility: Deviasi standar tahunan dari perubahan harga harian aset.',
  'chaikin-volatility': 'Chaikin Volatility: Menghitung persentase perubahan selisih harga tertinggi dan terendah dari waktu ke waktu.',
  'mass-index': 'Mass Index: Mengidentifikasi pembalikan tren berdasarkan penyempitan dan perluasan rentang lilin.',
  'standard-deviation': 'Standard Deviation: Mengukur dispersi statistik harga di sekitar nilai rata-ratanya.',
  'ulcer-index': 'Ulcer Index: Mengukur risiko penurunan (*downside risk*) dan kedalaman penurunan harga dari puncak.',
  'choppiness-index': 'Choppiness Index: Menentukan apakah pasar sedang bergerak dalam tren atau bergerak mendatar (*ranging/choppy*).',
  'on-balance-volume': 'On Balance Volume (OBV): Mengakumulasi volume perdagangan berdasarkan arah penutupan harga.',
  'accumulation-distribution': 'Accumulation / Distribution (A/D): Mengukur arus modal masuk dan keluar berdasarkan lokasi penutupan dalam rentang lilin.',
  'chaikin-money-flow': 'Chaikin Money Flow (CMF): Mengukur volume akumulasi/distribusi selama periode waktu tertentu untuk mengkonfirmasi tren.',
  'chaikin-oscillator': 'Chaikin Oscillator: Menerapkan formula MACD pada garis Accumulation/Distribution untuk momentum arus kas.',
  'ease-of-movement': 'Ease of Movement: Menghubungkan perubahan harga dengan volume untuk mengukur kemudahan harga bergerak.',
  'force-index': 'Force Index: Menggabungkan arah pergerakan harga, jarak pergerakan, dan volume transaksi.',
  'klinger-oscillator': 'Klinger Oscillator: Menentukan aliran uang jangka panjang sembari tetap sensitif terhadap fluktuasi jangka pendek.',
  'money-flow-index': 'Money Flow Index (MFI): RSI tertimbang volume yang mengukur tekanan beli dan jual aset.',
  'negative-volume-index': 'Negative Volume Index (NVI): Mengamati pergerakan harga pada hari-hari di mana volume transaksi menurun.',
  'positive-volume-index': 'Positive Volume Index (PVI): Mengamati pergerakan harga pada hari-hari di mana volume transaksi meningkat.',
  'price-volume-trend': 'Price Volume Trend: Mirip OBV tetapi menambahkan persentase perubahan harga ke dalam akumulasi volume.',
  'volume-oscillator': 'Volume Oscillator: Selisih antara dua rata-rata bergerak volume transaksi.',
  'pvo': 'Percentage Volume Oscillator: Selisih persentase antara dua moving average volume.',
  'volume-flow-indicator': 'Volume Flow Indicator: Osilator aliran volume berbasis perubahan harga tipikal dan volatilitas.',
  'intraday-intensity': 'Intraday Intensity: Melacak apakah dana institusional sedang melakukan akumulasi atau distribusi pada lilin intraday.'
};

/**
 * Memastikan bahwa seluruh built-in native indicators terdaftar di engine Vela
 */
export function ensureNativeIndicatorsRegistered(): void {
  try {
    if (nativeIndicatorDescriptors().length === 0) {
      // Inisialisasi headless/stub Vela agar memicu registrasi volume, vpvr, dan classicIndicators
      new Vela(null as any);
    }
  } catch (_) {
    // Constructor Vela mengeksekusi registrasi sebelum mengecek container element
  }
}

/**
 * IndicatorCatalogService - Layanan terpadu katalog indikator Trawangan
 * Mengagregasikan 76 native indicators Vela, Pine Script presets, dan skrip kustom pengguna.
 */
export class IndicatorCatalogService {
  private nativeCache: UnifiedIndicatorDescriptor[] | null = null;
  private presetCache: UnifiedIndicatorDescriptor[] | null = null;

  constructor() {
    this.ensureNativeRegistered();
  }

  /**
   * Memastikan native indicators sudah terdaftar di engine Vela
   */
  public ensureNativeRegistered(): void {
    ensureNativeIndicatorsRegistered();
  }

  /**
   * Mengambil daftar 76 native indicators bawaan Vela
   */
  public getNativeIndicators(): UnifiedIndicatorDescriptor[] {
    if (this.nativeCache && this.nativeCache.length >= 76) {
      return this.nativeCache;
    }

    this.ensureNativeRegistered();
    const descriptors: NativeIndicatorDescriptor[] = nativeIndicatorDescriptors();

    this.nativeCache = descriptors.map((d) => {
      const category = NATIVE_CATEGORY_MAP[d.type] || 'Trend';
      const description =
        NATIVE_DESCRIPTION_MAP[d.type] ||
        `${d.title} (${d.shortTitle || d.type.toUpperCase()}) — Studi native berkecepatan tinggi dengan WebGL2 bar transform.`;

      const isVpvr = d.type === 'vpvr';
      const categories: IndicatorCategory[] = isVpvr ? ['Profile', 'Volume'] : [category];
      const prominent = isVpvr ? true : false;

      let inputsSchema: any;
      try {
        if (typeof d.inputsSchema === 'function') {
          inputsSchema = d.inputsSchema();
        } else {
          inputsSchema = d.inputsSchema;
        }
      } catch (_) {}

      let defaultInputs: Record<string, any> | undefined;
      try {
        if (typeof d.defaultInputs === 'function') {
          defaultInputs = d.defaultInputs();
        } else {
          defaultInputs = d.defaultInputs;
        }
      } catch (_) {}

      // Perkaya skema parameter untuk Visible Range Volume Profile (VPVR)
      if (isVpvr) {
        inputsSchema = [
          { key: 'rows', title: 'Rows (Jumlah Baris)', type: 'int', defval: 24, min: 2, max: 400, step: 1 },
          { key: 'rowCount', title: 'Row Count', type: 'int', defval: 24, min: 2, max: 400, step: 1 },
          { key: 'rowHeightMode', title: 'Mode Tinggi Baris', type: 'text', defval: 'number-of-rows', options: ['number-of-rows', 'ticks-per-row'] },
          { key: 'valueAreaPct', title: 'Value Area Volume %', type: 'int', defval: 70, min: 0, max: 100, step: 1, tooltip: 'Persentase total volume transaksi yang dicakup oleh Value Area' },
          { key: 'widthPct', title: 'Lebar Histogram %', type: 'int', defval: 30, min: 5, max: 90, step: 1, tooltip: 'Lebar maksimum profil relatif terhadap pane harga' },
          { key: 'upColor', title: 'Warna Volume Naik (Up)', type: 'color', defval: '#2962ff' },
          { key: 'downColor', title: 'Warna Volume Turun (Down)', type: 'color', defval: '#f23645' },
          { key: 'showPoc', title: 'Tampilkan Point of Control (POC)', type: 'bool', defval: true },
          { key: 'pocColor', title: 'Warna Garis POC', type: 'color', defval: '#eab308' },
          { key: 'vaOpacity', title: 'Opasitas Value Area %', type: 'int', defval: 62, min: 0, max: 100, step: 1 },
          { key: 'outsideOpacity', title: 'Opasitas Luar Value Area %', type: 'int', defval: 28, min: 0, max: 100, step: 1 },
        ];
        defaultInputs = {
          rows: 24,
          rowCount: 24,
          rowHeightMode: 'number-of-rows',
          valueAreaPct: 70,
          valueAreaVolumePercentage: 70,
          widthPct: 30,
          upColor: '#2962ff',
          downColor: '#f23645',
          showPoc: true,
          pocColor: '#eab308',
          vaOpacity: 62,
          outsideOpacity: 28,
        };
      } else if (d.type === 'volume') {
        const { upColor: defaultUp, downColor: defaultDown } = resolveEffectiveVolumeColors();
        inputsSchema = [
          { key: 'upColor', title: 'Warna Naik (Bullish)', type: 'color', defval: defaultUp },
          { key: 'downColor', title: 'Warna Turun (Bearish)', type: 'color', defval: defaultDown },
          { key: 'heightPct', title: 'Tinggi Relatif (%)', type: 'int', defval: 15, min: 5, max: 50, step: 1, tooltip: 'Persentase tinggi grafik maksimum yang ditempati batang volume terbesar' },
        ];
        defaultInputs = {
          upColor: defaultUp,
          downColor: defaultDown,
          heightPct: 15,
        };
      }

      return {
        id: `native:${d.type}`,
        title: d.title,
        shortTitle: d.shortTitle,
        category,
        categories,
        kind: 'native',
        overlay: Boolean(d.overlay),
        description,
        nativeType: d.type,
        inputsSchema,
        defaultInputs,
        multiInstance: Boolean(d.multiInstance),
        paneHint: d.paneHint,
        prominent,
      };
    });

    return this.nativeCache;
  }

  /**
   * Mengambil daftar Pine Script presets bawaan Trawangan
   */
  public getPinePresets(): UnifiedIndicatorDescriptor[] {
    if (this.presetCache) {
      return this.presetCache;
    }

    this.presetCache = INDICATOR_PRESETS.map((p) => ({
      id: p.id,
      title: p.name,
      shortTitle: p.id.toUpperCase(),
      category: p.category,
      kind: 'pine',
      overlay: p.overlay,
      description: p.description,
      sourceCode: p.sourceCode,
    }));

    return this.presetCache;
  }

  /**
   * Mengambil daftar skrip kustom pengguna
   */
  public getCustomScripts(savedScripts: PineScriptRecord[] = []): UnifiedIndicatorDescriptor[] {
    if (!Array.isArray(savedScripts)) return [];

    return savedScripts.map((s) => ({
      id: s.id,
      title: s.title,
      category: 'Custom',
      kind: 'pine',
      overlay: Boolean(s.is_overlay),
      description: `Skrip kustom Pine Script v6 diperbarui pada ${new Date(s.updated_at).toLocaleDateString('id-ID')}`,
      sourceCode: s.code,
    }));
  }

  /**
   * Mengambil seluruh katalog gabungan (Native + Pine Presets + Skrip Kustom)
   */
  public getAllIndicators(savedScripts: PineScriptRecord[] = []): UnifiedIndicatorDescriptor[] {
    const native = this.getNativeIndicators();
    const presets = this.getPinePresets();
    const custom = this.getCustomScripts(savedScripts);
    return [...native, ...presets, ...custom];
  }

  /**
   * Filter katalog terpadu secara real-time berdasarkan query pencarian, kategori, tab, dan status favorit
   */
  public filterIndicators(
    allIndicators: UnifiedIndicatorDescriptor[],
    options: FilterCatalogOptions = {}
  ): UnifiedIndicatorDescriptor[] {
    const {
      searchQuery = '',
      category = 'All',
      kind = 'all',
      favoritesOnly = false,
      favoriteIds = [],
    } = options;

    const query = searchQuery.trim().toLowerCase();
    const isCategoryAll = !category || category === 'All';
    const isCustomCategory = category === 'Custom' || category === 'Custom Scripts';

    const filtered = allIndicators.filter((item) => {
      // 1. Filter jenis (kind)
      if (kind === 'native' && item.kind !== 'native') return false;
      if (kind === 'pine' && item.kind !== 'pine') return false;

      // 2. Filter kategori
      if (!isCategoryAll) {
        if (isCustomCategory) {
          if (item.category !== 'Custom' && item.kind !== 'pine') return false;
          if (item.category !== 'Custom' && !item.id.includes('-') && item.id.length < 15) return false;
        } else {
          const targetCat = category.toLowerCase();
          const matchPrimary = item.category.toLowerCase() === targetCat;
          const matchSecondary = Array.isArray(item.categories) && item.categories.some((c) => c.toLowerCase() === targetCat);
          if (!matchPrimary && !matchSecondary) {
            return false;
          }
        }
      }

      // 3. Filter favorit
      const isFav = this.isFavorited(item, favoriteIds);
      if (favoritesOnly && !isFav) {
        return false;
      }

      // 4. Pencarian teks real-time
      if (query !== '') {
        const titleMatch = item.title.toLowerCase().includes(query);
        const shortTitleMatch = item.shortTitle ? item.shortTitle.toLowerCase().includes(query) : false;
        const catMatch = item.category.toLowerCase().includes(query);
        const idMatch = item.id.toLowerCase().includes(query);
        const nativeTypeMatch = item.nativeType ? item.nativeType.toLowerCase().includes(query) : false;

        // Pencarian deskripsi menggunakan word boundary untuk menghindari false positive (mis. 'rsi' di 'dispersi')
        let descMatch = false;
        if (item.description) {
          try {
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wordRegex = new RegExp(`(?:^|\\s|[(\\[{\",.:;!?-])${escaped}(?:$|\\s|[)\\]}\",.:;!?-])`, 'i');
            descMatch = wordRegex.test(item.description);
          } catch (_) {
            descMatch = item.description.toLowerCase().includes(query);
          }
        }

        if (!titleMatch && !shortTitleMatch && !catMatch && !idMatch && !nativeTypeMatch && !descMatch) {
          return false;
        }
      }

      return true;
    });

    // Urutkan: favorit di posisi paling atas, disusul indikator prominent (misal VPVR), lalu abjad judul
    return filtered.sort((a, b) => {
      const favA = this.isFavorited(a, favoriteIds);
      const favB = this.isFavorited(b, favoriteIds);

      if (favA && !favB) return -1;
      if (!favA && favB) return 1;

      // Prioritas indikator prominent (seperti VPVR) di posisi atas
      if (a.prominent && !b.prominent) return -1;
      if (!a.prominent && b.prominent) return 1;

      return a.title.localeCompare(b.title, 'id-ID', { sensitivity: 'base' });
    });
  }

  /**
   * Memeriksa apakah indikator ada dalam daftar favorit
   */
  public isFavorited(item: UnifiedIndicatorDescriptor, favoriteIds: string[] = []): boolean {
    if (!Array.isArray(favoriteIds) || favoriteIds.length === 0) return false;
    return favoriteIds.includes(item.id);
  }

  /**
   * Mencari indikator tunggal berdasarkan ID, tipe native, atau judul
   */
  public findIndicator(
    idOrType: string,
    savedScripts: PineScriptRecord[] = []
  ): UnifiedIndicatorDescriptor | null {
    if (!idOrType) return null;
    const clean = idOrType.trim().toLowerCase();
    const all = this.getAllIndicators(savedScripts);

    // Pass 1: Prioritaskan pencocokan ID persis (e.g. 'rsi' preset vs 'native:rsi')
    for (const item of all) {
      if (item.id.toLowerCase() === clean) {
        return item;
      }
    }

    // Pass 2: Pencocokan tipe native atau judul
    for (const item of all) {
      if (
        (item.nativeType && item.nativeType.toLowerCase() === clean) ||
        (item.id.replace(/^native:/, '').toLowerCase() === clean) ||
        item.title.toLowerCase() === clean ||
        (item.shortTitle && item.shortTitle.toLowerCase() === clean)
      ) {
        return item;
      }
    }

    return null;
  }
}

/**
 * Singleton instance layanan katalog indikator
 */
export const indicatorCatalogService = new IndicatorCatalogService();
