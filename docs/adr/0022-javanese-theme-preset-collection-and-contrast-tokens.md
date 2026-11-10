# 0022 - Koleksi Preset Tema Jawa, Evolusi Warta Abang, dan Token Kontras Adaptif WCAG

## Konteks & Latar Belakang
Sejak [ADR-0016](0016-unified-theme-engine-full-palette-matrix-and-cross-subsystem-propagation.md) dan [ADR-0017](0017-dual-theme-decoupling-user-theme-presets-and-background-alert-engine.md) diterapkan, `trawangan` hanya menyediakan 6 preset tema bawaan (5 mode gelap dan 1 mode terang `red_folder`). Untuk memperkaya pengalaman visual trader sekaligus menonjolkan identitas filosofi **Penerawangan**, diputuskan untuk memperluas galeri tema resmi secara masif dan memperkuat jaminan keterbacaan kontras UI lintas skema warna:

1. **Perluasan Koleksi Beridentitas Jawa**: Mengadaptasi ragam palet warna charting modern ke dalam penamaan bahasa Jawa yang khas (`Ngrembaka`, `Kopi Tubruk`, `Samodra Wengi`, `Lembayung Awan`, dll.) dengan deduplikasi entri kembar.
2. **Orisinalitas Warna & Penghindaran Duplikasi Identik**: Setiap palet referensi eksternal wajib melalui *micro color-shifting* (±3–10 unit RGB) pada seluruh atribut warna serta koreksi kesalahan ketik heksadesimal (*OCR typo `O`→`0`*) agar tidak identik hak cipta sambil tetap mempertahankan karakter visual aslinya.
3. **Keterbatasan Heuristik Kecerahan Tunggal (`YIQ < 128`)**: Penggunaan batas biner `isDarkColor()` sebelumnya membuat tombol berlatar aksen/lilin (`--brand-primary`, `--bull-color`, `--bear-color`) di UI Shell maupun teks `--bull-text` pada warna tengah (seperti ungu *lavender* `#8D6BD4` atau jingga terbakar `#CA641C`) berisiko gagal rasio kontras WCAG 2.1 AA (`< 4.5:1`) terhadap latar kartu `--bg-panel`.

## Keputusan Arsitektur

### 1. Registri 37 Preset Resmi (18 Mode Gelap & 19 Mode Terang)
- Menambahkan **31 preset tema Jawa baru** ke `THEME_PRESETS` ([themes.ts](../../src/lib/constants/themes.ts)) melalui builder deterministik `createBuiltInPreset`, sehingga total registri resmi meningkat dari 6 menjadi **37 preset**:
  - **Mode Gelap (`dark`, 18 tema)**: 5 preset legacy (`signature`, `binance`, `bitunix`, `tradingview`, `coinglass`) + 13 preset Jawa baru (`pundi_arta`, `samodra_wengi`, `undhuh_dana`, `segara_jero`, `getih_segara`, `tutup_sasi`, `kilat_wengi`, `tengah_wengi`, `surya_baskara`, `sapu_tirta`, `rame_sore`, `ayem_tentrem`, `wates_dhuwur`).
  - **Mode Terang (`light`, 19 tema)**: `red_folder` + 18 preset Jawa baru (`ngrembaka`, `kopi_tubruk`, `geni_mrengkang`, `rega_pasar`, `watu_putih`, `laku_batin`, `pasar_esuk`, `gading_ijo`, `sekar_jambon`, `kuning_kunir`, `mas_kencana`, `wangsit_lembah`, `dana_lestari`, `peken_ijo`, `paring_eling`, `lembayung_awan`, `kopi_klotok`, `banyu_segara`).
- Seluruh 32 preset Jawa (`red_folder` + 31 tema baru) wajib lolos pengujian ketidakidentikan 100% terhadap 8 nilai warna input eksternal (`background`, `textColor`, serta 6 atribut lilin) serta kompatibel penuh dengan polaritas `isDarkColor(background) === (mode === 'dark')`.

### 2. Evolusi `red_folder` Menjadi **Warta Abang** (Amandemen ADR-0016 §2)
- Keputusan ini **mengamandemen dan memperluas ADR-0016 §2**: daftar 6 preset bawaan diperluas menjadi 37 preset, dan preset `red_folder` (*Red Folder News*) dikonversi menjadi **Warta Abang** dengan skema warna yang digeser halus (`#EAEAE5` background, `#4E1112` text, `#CF9F9F` bullish, `#941B1E` bearish).
- **ID kanonikal `red_folder` wajib dipertahankan** untuk menjaga kompatibilitas mundur (*backward compatibility*) bagi pengaturan tersimpan pengguna, default `activeLightPreset`, fallback OS light mode, dan test integrasi historis.

### 3. Kontrak Token Foreground Adaptif (`--on-brand-primary`, `--on-bull-color`, `--on-bear-color`)
- Memperkenalkan 3 variabel CSS kontras global pada `:root`, seluruh 36 blok `[data-theme="<id>"]` di [theme.css](../../src/styles/theme.css), serta injeksi runtime untuk `customPalette` dan preset kustom pengguna via `applyAdaptiveContrastTokens` di [themeEngine.ts](../../src/lib/services/themeEngine.ts):
  - `--on-brand-primary`: Warna tinta kontras pada permukaan `--brand-primary` (termasuk pengikatan `--vela-selected-fg: var(--on-brand-primary)`).
  - `--on-bull-color`: Warna tinta kontras pada tombol/lencana berlatar `--bull-color`.
  - `--on-bear-color`: Warna tinta kontras pada tombol/lencana berlatar `--bear-color`.
- Penentuan tinta (`#FFFFFF` vs `#0A0A0A`) dihitung menggunakan **`resolveContrastTextColor`** di [colorUtils.ts](../../src/lib/utils/colorUtils.ts) berdasarkan perbandingan **rasio kontras WCAG 2.1 tertinggi** (`getContrastRatio`), bukan tebakan luminance YIQ `< 128`.
- Seluruh komponen UI Shell menstandarkan fallback CSS menjadi seragam (`var(--on-brand-primary, #000000)`, `var(--on-bull-color, #0F0F0F)`, `var(--on-bear-color, #0F0F0F)`).

### 4. Jaminan Keterbacaan `--bull-text` Berbasis WCAG 2.1 AA (*Hybrid Semantik*)
- Menggantikan logika `isDarkColor` untuk `--bull-text` dengan fungsi **`resolveReadableBullText(bgSurface, bgPanel, bullHex, isDark)`** di [colorUtils.ts](../../src/lib/utils/colorUtils.ts):
  - **Mode Terang dengan Lilin Cerah/Pastel (`!isDarkColor(bullHex)`)**: Menggunakan hijau semantik gelap `#166534` agar teks persentase untung dan lencana *bullish* (pada tema bernuansa rose, kuning, krem, atau hijau muda) tetap terbaca tajam dan intuitif.
  - **Warna Bull Jenuh/Gelap (Mode Terang & Gelap)**: Mempertahankan hue asli apabila rasio kontrasnya mencapai **>= 4.5:1** terhadap `--bg-darkest` maupun `--bg-panel`; jika belum tercapai, kecerahan digeser bertahap menuju `#000000` (mode terang) atau `#FFFFFF` (mode gelap) hingga minimal **4.8:1** (seperti pada `lembayung_awan` `#634B94`, `paring_eling` `#954A15`, `laku_batin` `#606162`, `rega_pasar` `#376790`, `undhuh_dana` `#47A5A4`, dan penyelarasan `tradingview` `#26A590`).

### 5. Ergonomi Galeri Tema di Pengaturan Tampilan
- `AppearanceTab.svelte` dilengkapi bilah pencarian instan (`themeSearchQuery`) beserta tombol pemulihan filter semantik (`.btn-reset-filter`) dan batas garis tepi kontras pada `.swatch-color` / `.mini-dot` agar kartu preset bernuansa putih/krem tetap terdefinisi jelas pada mode terang.

## Konsekuensi & Dampak
- **Positif**:
  - Seluruh tombol aksi primer, tombol trade plan Bull/Bear, badge header, dan teks status positif dijamin terbaca kontras di seluruh 37 preset bawaan maupun palet kustom pengguna tanpa CSS per-tema yang rapuh (`[data-theme='...']` per komponen).
  - Kontrak pengujian [tests/themes.test.ts](../../tests/themes.test.ts) kini mengawal penuh keunikan 37 preset, perbedaan 8 atribut warna dari referensi web, serta kepatuhan kontras WCAG AA (`>= 4.5:1`).
- **Pertimbangan**:
  - Setiap penambahan preset bawaan baru di masa mendatang wajib didaftarkan ke `ThemePresetId`, `THEME_PRESETS`, blok `[data-theme]` di `src/styles/theme.css` (dengan nilai `--bull-text` dan `--on-*` yang sinkron dengan `resolveReadableBullText` & `resolveContrastTextColor`), serta diuji di `tests/themes.test.ts`.
