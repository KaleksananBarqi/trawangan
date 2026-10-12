// Layanan Kamus Glosarium & Registry Keyboard Shortcuts Terminal Trawangan
// Menyediakan daftar lengkap pintasan keyboard, pencarian interaktif, dan kategorisasi.

export interface ShortcutItem {
  id: string;
  category:
    | 'Navigasi & Simbol'
    | 'Alat Gambar (Drawing Tools)'
    | 'Bar Replay (Simulasi)'
    | 'Analisis & Indikator'
    | 'Skala & Tampilan Grafik'
    | 'Timeframe Cepat'
    | 'Sistem & Bantuan';
  keys: string[];
  desc: string;
  context?: string;
}

/**
 * Glosarium lengkap pintasan keyboard terminal Trawangan.
 * Mengacu pada standar TradingView & alur kerja charting profesional.
 */
export const SHORTCUT_GLOSSARY: ShortcutItem[] = [
  // --- Navigasi & Simbol ---
  {
    id: 'search-symbol',
    category: 'Navigasi & Simbol',
    keys: ['Ctrl', 'K'],
    desc: 'Buka modal pencarian simbol instrumen atau ketik langsung di keyboard'
  },
  {
    id: 'toggle-watchlist',
    category: 'Navigasi & Simbol',
    keys: ['Alt', 'W'],
    desc: 'Buka atau sembunyikan panel daftar pantau (Watchlist)'
  },
  {
    id: 'next-symbol',
    category: 'Navigasi & Simbol',
    keys: ['Alt', '↓'],
    desc: 'Beralih ke simbol berikutnya pada daftar pantau'
  },
  {
    id: 'prev-symbol',
    category: 'Navigasi & Simbol',
    keys: ['Alt', '↑'],
    desc: 'Beralih ke simbol sebelumnya pada daftar pantau'
  },
  {
    id: 'cancel-action',
    category: 'Navigasi & Simbol',
    keys: ['Esc'],
    desc: 'Batalkan alat gambar aktif, hilangkan seleksi, atau tutup jendela modal'
  },

  // --- Alat Gambar (Drawing Tools) ---
  {
    id: 'draw-trendline',
    category: 'Alat Gambar (Drawing Tools)',
    keys: ['Alt', 'T'],
    desc: 'Aktifkan alat Garis Tren (Trendline)'
  },
  {
    id: 'draw-hline',
    category: 'Alat Gambar (Drawing Tools)',
    keys: ['Alt', 'H'],
    desc: 'Aktifkan alat Garis Horizontal (Horizontal Line)'
  },
  {
    id: 'draw-vline',
    category: 'Alat Gambar (Drawing Tools)',
    keys: ['Alt', 'V'],
    desc: 'Aktifkan alat Garis Vertikal (Vertical Line)'
  },
  {
    id: 'draw-position',
    category: 'Alat Gambar (Drawing Tools)',
    keys: ['Alt', 'R'],
    desc: 'Aktifkan alat Kalkulasi Posisi Long / Short (Risk / Reward)'
  },
  {
    id: 'draw-fibonacci',
    category: 'Alat Gambar (Drawing Tools)',
    keys: ['Alt', 'F'],
    desc: 'Aktifkan alat Retracement Fibonacci'
  },
  {
    id: 'draw-box',
    category: 'Alat Gambar (Drawing Tools)',
    keys: ['Alt', 'B'],
    desc: 'Aktifkan alat Kotak Area (Box / Rectangle Area)'
  },
  {
    id: 'draw-undo',
    category: 'Alat Gambar (Drawing Tools)',
    keys: ['Ctrl', 'Z'],
    desc: 'Urungkan (Undo) perubahan gambar terakhir'
  },
  {
    id: 'draw-redo',
    category: 'Alat Gambar (Drawing Tools)',
    keys: ['Ctrl', 'Y'],
    desc: 'Ulangi (Redo) perubahan gambar yang diurungkan'
  },
  {
    id: 'draw-delete',
    category: 'Alat Gambar (Drawing Tools)',
    keys: ['Del'],
    desc: 'Hapus objek gambar yang sedang dipilih'
  },

  // --- Bar Replay (Simulasi) ---
  {
    id: 'replay-toggle',
    category: 'Bar Replay (Simulasi)',
    keys: ['Shift', 'R'],
    desc: 'Aktifkan atau keluar dari mode simulasi Bar Replay'
  },
  {
    id: 'replay-play-pause',
    category: 'Bar Replay (Simulasi)',
    keys: ['Space'],
    desc: 'Mulai atau jeda putaran otomatis simulasi lilin harga'
  },
  {
    id: 'replay-step-forward',
    category: 'Bar Replay (Simulasi)',
    keys: ['→'],
    desc: 'Maju 1 bar simulasi ke depan'
  },
  {
    id: 'replay-step-backward',
    category: 'Bar Replay (Simulasi)',
    keys: ['←'],
    desc: 'Mundur 1 bar simulasi ke belakang (potong ulang 1 lilin)'
  },
  {
    id: 'replay-reset',
    category: 'Bar Replay (Simulasi)',
    keys: ['R'],
    desc: 'Kembalikan simulasi ke titik potong awal'
  },

  // --- Analisis & Indikator ---
  {
    id: 'open-indicators',
    category: 'Analisis & Indikator',
    keys: ['/'],
    desc: 'Buka modal katalog indikator teknikal & strategi'
  },
  {
    id: 'open-indicators-alt',
    category: 'Analisis & Indikator',
    keys: ['Ctrl', 'I'],
    desc: 'Pintasan alternatif untuk membuka katalog indikator'
  },
  {
    id: 'toggle-pine-editor',
    category: 'Analisis & Indikator',
    keys: ['Alt', 'E'],
    desc: 'Buka atau tutup Pine Script IDE / Editor Strategi'
  },

  // --- Skala & Tampilan Grafik ---
  {
    id: 'scale-auto-reset',
    category: 'Skala & Tampilan Grafik',
    keys: ['Alt', 'A'],
    desc: 'Kembalikan skala grafik ke posisi otomatis (Auto Scale / Reset)'
  },
  {
    id: 'scale-logarithmic',
    category: 'Skala & Tampilan Grafik',
    keys: ['Alt', 'L'],
    desc: 'Beralih antara skala linear dan skala logaritmik'
  },
  {
    id: 'scale-percentage',
    category: 'Skala & Tampilan Grafik',
    keys: ['Alt', 'P'],
    desc: 'Beralih antara tampilan harga absolut dan skala persentase'
  },
  {
    id: 'zoom-in',
    category: 'Skala & Tampilan Grafik',
    keys: ['+'],
    desc: 'Perbesar tampilan waktu grafik (Zoom In)'
  },
  {
    id: 'zoom-out',
    category: 'Skala & Tampilan Grafik',
    keys: ['-'],
    desc: 'Perkecil tampilan waktu grafik (Zoom Out)'
  },

  // --- Timeframe Cepat ---
  {
    id: 'tf-1m',
    category: 'Timeframe Cepat',
    keys: ['1'],
    desc: 'Ganti rentang waktu lilin ke 1 Menit'
  },
  {
    id: 'tf-3m',
    category: 'Timeframe Cepat',
    keys: ['3'],
    desc: 'Ganti rentang waktu lilin ke 3 Menit'
  },
  {
    id: 'tf-5m',
    category: 'Timeframe Cepat',
    keys: ['5'],
    desc: 'Ganti rentang waktu lilin ke 5 Menit'
  },
  {
    id: 'tf-15m',
    category: 'Timeframe Cepat',
    keys: ['1', '5'],
    desc: 'Ganti rentang waktu lilin ke 15 Menit'
  },
  {
    id: 'tf-1h',
    category: 'Timeframe Cepat',
    keys: ['H'],
    desc: 'Ganti rentang waktu lilin ke 1 Jam (Hourly)'
  },
  {
    id: 'tf-4h',
    category: 'Timeframe Cepat',
    keys: ['4'],
    desc: 'Ganti rentang waktu lilin ke 4 Jam'
  },
  {
    id: 'tf-1d',
    category: 'Timeframe Cepat',
    keys: ['D'],
    desc: 'Ganti rentang waktu lilin ke 1 Hari (Daily)'
  },
  {
    id: 'tf-1w',
    category: 'Timeframe Cepat',
    keys: ['W'],
    desc: 'Ganti rentang waktu lilin ke 1 Minggu (Weekly)'
  },

  // --- Sistem & Bantuan ---
  {
    id: 'help-cheatsheet',
    category: 'Sistem & Bantuan',
    keys: ['?'],
    desc: 'Buka kamus glosarium lengkap pintasan keyboard'
  },
  {
    id: 'help-cheatsheet-f1',
    category: 'Sistem & Bantuan',
    keys: ['F1'],
    desc: 'Pintasan bantuan cepat glosarium keyboard'
  },
  {
    id: 'open-settings',
    category: 'Sistem & Bantuan',
    keys: ['Ctrl', ','],
    desc: 'Buka jendela pengaturan aplikasi dan preferensi visual'
  },
  {
    id: 'fullscreen-toggle',
    category: 'Sistem & Bantuan',
    keys: ['F11'],
    desc: 'Beralih ke mode layar penuh (Full Screen)'
  },
  {
    id: 'save-layout',
    category: 'Sistem & Bantuan',
    keys: ['Ctrl', 'S'],
    desc: 'Simpan konfigurasi tata letak grafik & status analisis'
  }
];

/**
 * Filter shortcut berdasarkan query pencarian (mencocokkan keys, deskripsi, atau kategori).
 */
export function filterShortcuts(query: string): ShortcutItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SHORTCUT_GLOSSARY];

  return SHORTCUT_GLOSSARY.filter((item) => {
    const descMatch = item.desc.toLowerCase().includes(q);
    const categoryMatch = item.category.toLowerCase().includes(q);
    const keyMatch = item.keys.some((k) => k.toLowerCase().includes(q));
    const combinedKeys = item.keys.join('+').toLowerCase();
    const comboMatch = combinedKeys.includes(q);
    return descMatch || categoryMatch || keyMatch || comboMatch;
  });
}

/**
 * Mengelompokkan item shortcut berdasarkan nama kategori.
 */
export function getShortcutsByCategory(): Record<string, ShortcutItem[]> {
  const result: Record<string, ShortcutItem[]> = {};

  for (const item of SHORTCUT_GLOSSARY) {
    if (!result[item.category]) {
      result[item.category] = [];
    }
    result[item.category].push(item);
  }

  return result;
}
