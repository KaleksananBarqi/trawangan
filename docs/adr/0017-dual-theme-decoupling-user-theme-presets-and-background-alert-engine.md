# 0017. Dual-Theme Decoupling, User Theme Presets, System Bridge, and Background Alert Engine

## Konteks & Latar Belakang
Pada arsitektur tema sebelumnya (ADR 0016), skema warna Desktop Shell dan Kanvas WebGL2 digabungkan dalam satu objek tema terpadu. Penggabungan ini menimbulkan masalah kontras visual pada beberapa komponen (seperti menu konteks klik kanan yang berlatar gelap permanen sehingga teks burgundy pada tema terang tidak terbaca, serta watermark snapshot yang berwana putih statis). Selain itu, preferensi mode gelap/terang belum terhubung ke sistem operasi, pengguna hanya memiliki 1 slot palet kustom sementara tanpa fitur penyimpanan nama, navigasi pencarian simbol kanvas mengalami bug seleksi karakter pertama (*erased initial keystroke*), dan subsistem alert harga hanya mengevaluasi simbol yang sedang terbuka di kanvas atau di watchlist aktif.

## Keputusan Arsitektur

### 1. Dekopling App Theme vs Chart Canvas Theme
- Memisahkan konfigurasi visual menjadi dua domain yang terisolasi namun dapat disinkronkan:
  - **App UI Theme**: Mengatur Desktop Shell (Header, Toolbar, Right Dock, Watchlist, Context Menu, Modal/Dialog, Status Bar, Pine Editor).
  - **Chart Canvas Theme**: Mengatur kanvas WebGL2 murni (Candlestick 6-atribut, warna latar kanvas, garis grid, crosshair, watermark).
- Menyediakan opsi preferensi `syncChartWithAppTheme: boolean` (default: `true`). Jika dinonaktifkan, pengguna dapat bebas memadukan App UI Gelap dengan Kanvas Terang atau sebaliknya.
- Mengeliminasi seluruh hardcoded hex color pada menu konteks (`ChartContextMenu.svelte`) dan menggantinya dengan CSS token dinamis `--bg-panel` dan `--text-main`.
- Menyesuaikan perenderan watermark keamanan snapshot (`chartSnapshotService.ts`) agar warna teks adaptif terhadap luminance latar belakang grafik aktif.

### 2. System Theme Bridge & Dual Default Presets
- Menerapkan preferensi `colorModePreference: 'system' | 'dark' | 'light'`.
- Menghubungkan listener `window.matchMedia('(prefers-color-scheme: dark)')` saat mode `system` aktif.
- Mengasosiasikan dua preset terdaftar untuk peralihan instan: `activeDarkPreset` (default: `signature`) dan `activeLightPreset` (default: `red_folder`).
- Menambahkan tombol sakelar cepat Dark/Light/System satu klik pada bilah Header antarmuka.

### 3. User Theme Presets ("Save As")
- Memperluas persistence layer untuk mendukung koleksi tema pengguna `savedUserThemes: CustomThemeDefinition[]`.
- Menyediakan alur dialog **Save As** yang memvalidasi nama tema unik dan mode dasarnya (`dark` | `light`).
- Tema kustom pengguna berstatus warga kelas satu (*first-class preset*) berdampingan dengan preset resmi bawaan, dapat dipilih, diekspor, diubah namanya (*rename*), atau dihapus (*delete*).

### 4. Perbaikan Ergonomi Type-to-Search (Canvas Keystroke Guard)
- Mengoreksi penanganan fokus pada `SymbolSearchModal.svelte`:
  - Jika modal dipicu oleh pengetikan langsung di kanvas (*Type-to-Search*): kursor diletakkan di akhir karakter (`setSelectionRange(len, len)`) tanpa memanggil `select()`, mencegah karakter pertama terhapus oleh karakter berikutnya.
  - Jika modal dibuka melalui `Ctrl+K` atau klik tombol pencarian: teks input tetap di-select penuh agar pengguna dapat langsung mengganti simbol sebelumnya.

### 5. Background Alert Engine
- Memodifikasi `MarketFeedService` (`src/lib/services/market/index.ts`) agar secara otomatis mengumpulkan seluruh simbol unik dari alert yang sedang aktif (`alertService.getActiveAlertSymbols()`).
- Memasukkan simbol-simbol alert tersebut ke dalam antrean polling latar belakang terlepas dari apakah simbol tersebut sedang dibuka di chart atau ada di watchlist aktif.
- Menjaga efisiensi jaringan dengan mendeduplikasi simbol per bursa/provider.

## Konsekuensi & Dampak
- **Positif:**
  - Menghilangkan bug keterbacaan teks pada klik kanan dan watermark.
  - Menjamin alert harga dan rencana trading (*trade setup*) selalu terpicu tepat waktu di latar belakang.
  - Memberikan pengalaman pencarian koin (*Type-to-Search*) yang mulus setara standar TradingView.
  - Pengguna bebas berkreasi dan mengoleksi berbagai tema kustom tanpa batasan satu slot palet.
- **Pertimbangan:**
  - Polling simbol alert di latar belakang sedikit menambah muatan batch request, namun termitigasi oleh batching endpoint multi-simbol bursa.
