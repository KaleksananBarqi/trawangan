# 0016. Unified Theme Engine, Full Palette Matrix, and Cross-Subsystem Propagation

## Konteks & Latar Belakang
Sebelum keputusan ini, sistem tema di Trawangan terpecah secara parsial dan inkonsisten (*serampangan*):
1. **Kustomisasi Lilin Terbatas**: Hanya mendukung override warna *body* lilin (bullish & bearish), sedangkan *border* dihitung otomatis (-15% kecerahan) dan *wick* dipaksa mengikuti warna body.
2. **Ketiadaan Token Vela (`--vela-*`)**: Komponen bawaan kit WebGL2 `@luxalgo/vela` (seperti dialog pengaturan indikator, *chart settings gear*, popup *drawing levels*, dan *context menu*) mengandalkan CSS custom properties bertaraf `--vela-*`. Ketiadaan token ini di elemen root DOM menyebabkan dialog internal chart tampil rusak, gelap kaku, dan bertabrakan dengan antarmuka host.
3. **Pine Editor Terisolasi**: `PineEditor.svelte` menggunakan skema tema CodeMirror 6 statis yang di-hardcode ke `#0A0D14`, sehingga tidak pernah terpengaruh oleh pergantian tema, terutama saat beralih ke skema terang (*Light Theme*).
4. **Ketiadaan Dukungan Tema Terang Terstruktur**: Aplikasi mengasumsikan lingkungan ultra-gelap permanen. Transparansi statis seperti `rgba(255, 255, 255, 0.05)` membuat teks atau elemen tidak terbaca saat warna latar diatur ke warna terang/krem (seperti tema *Red Folder News*).
5. **Desinkronisasi Mode Vela**: Pengaturan bawaan chart Vela memiliki opsi `Color theme: Dark | Light` yang tidak tersambung dengan state tema Trawangan.

## Keputusan Arsitektur

### 1. Model Data Matriks Palet Penuh (Full Palette Matrix - 9 Dimensi)
Mengadopsi struktur palet kustom 9 atribut modular sesuai standar platform charting modern (*chartthemes.com*):
- **Candle Colors (6 atribut)**:
  - Bullish: `bullBody`, `bullWick`, `bullBorder`
  - Bearish: `bearBody`, `bearWick`, `bearBorder`
- **General Colors (3 atribut)**:
  - `background`: Fondasi kanvas grafik dan latar aplikasi.
  - `foreground`: Surface container, cards, panels, hairline borders.
  - `textColor`: Tipografi teks utama, skala harga, dan label waktu.

### 2. Kategorisasi Eksplisit Dark & Light Theme & Mode Switcher
- Seluruh Preset Tema dikelompokkan ke dalam kategori biner yang tegas:
  - **Dark Themes**: `signature` (Cyber-Monochrome), `binance` (Binance Classic), `bitunix` (Bitunix Neon), `tradingview` (TradingView Pro), `coinglass` (Coinglass Dark).
  - **Light Themes**: `red_folder` (Red Folder News — latar krem `#edede9`, teks burgundy `#4A0E0F`, bullish rose `#D4A5A5`, bearish crimson `#9B1D20`).
- Antarmuka pengaturan menyediakan penyaring/pengatur cepat mode (Semua, Dark, Light) serta badge status visual `[DARK]` dan `[LIGHT]` pada tiap kartu preset.

### 3. Unified Token Engine & Injeksi Token `--vela-*`
- Menghubungkan seluruh token CSS aplikasi (`--bg-*`, `--text-*`, `--border-*`) dan token runtime Vela (`--vela-bg`, `--vela-fg`, `--vela-border`, `--vela-surface-elev`, `--vela-dialog-*`, dll.) langsung ke `:root` (`document.documentElement`).
- Mengatur properti CSS `color-scheme: dark` atau `color-scheme: light` secara dinamis pada `:root` dan elemen dialog Vela.

### 4. Pine Editor Reaktif via CodeMirror 6 Compartment
- Menggantikan objek tema statis di `PineEditor.svelte` dengan ekstensi tema reaktif berbasis CodeMirror `Compartment`.
- Menyelaraskan background editor, gutter, selection, caret, border, dan syntax highlighter secara instan dengan warna `background`, `foreground`, dan `text` aktif.

### 5. Sinkronisasi Dua Arah Vela `onThemeSelect`
- Memasang listener `onThemeSelect` pada instance chart Vela:
  - Jika pengguna memilih **Light** di dalam chart settings Vela: Trawangan beralih ke preset light aktif (`red_folder` atau custom light).
  - Jika pengguna memilih **Dark** di dalam chart settings Vela: Trawangan beralih ke preset dark aktif (`signature` atau custom dark).
- Pembaruan tema dari sisi Trawangan secara simultan memperbarui status `surfaceBackground` Vela sehingga dropdown dialog Vela selalu mencerminkan mode saat ini.

### 6. Adaptive Luminance Engine untuk Elemen Grafis Sekunder
- Warna kisi grafik (*grid*), kursor silang (*crosshair*), dan garis pemisah skala (*panes separator*) diturunkan secara deterministik (*auto-derived*) berdasarkan tingkat kecerahan latar (`isDarkColor`) dan warna teks pengguna tanpa membebani pengguna dengan input berlebih.

### 7. Import/Export Palet Fleksibel & Tombol Salin Cepat
- Mendukung salin/tempel format JSON terstruktur maupun format teks baris (*plain-text key-value*) langsung dari clipboard sistem.
- Menyediakan tombol salin cepat Hex per-item individual (`btn-mini-copy`) di sebelah setiap masukan warna untuk mempermudah transfer nilai warna persis seperti alur kerja pada `chartthemes.com`.

## Konsekuensi & Dampak
- **Positif**:
  - Tampilan visual 100% konsisten di seluruh lapisan (UI Shell desktop, kanvas WebGL2 Vela, dialog internal Vela, dan Pine Script IDE).
  - Trawangan kini resmi mendukung mode terang (*Light Mode*) berkualitas analitis tinggi tanpa teks yang hilang atau kontras yang pecah.
  - Alur kustomisasi sangat fleksibel dan kompatibel dengan tema eksternal (*chartthemes*).
- **Pertimbangan**:
  - Penambahan preset `red_folder` memperluas cakupan tipe `ThemePresetId` yang harus didukung oleh persistence layer dan snapshot renderer.
