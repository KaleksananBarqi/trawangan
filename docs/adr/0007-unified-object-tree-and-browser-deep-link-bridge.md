# 0007. Unified Object Tree and Browser Deep Link Bridge Architecture

Untuk memberikan pengalaman inspeksi layer kanvas yang komprehensif ala TradingView serta memungkinkan penangkapan tautan grafik pasar kripto langsung dari browser eksternal ke dalam aplikasi desktop native, `trawangan` menetapkan keputusan arsitektur berikut:

1. **Unified Object Tree Architecture**:
   - Menyatukan layer indikator aktif dan objek coretan gambar teknikal dalam satu pohon hierarki terpadu (*Unified Object Tree*) di panel dock kanan, terbagi dalam 2 grup *collapsible* (Indikator & Objek Gambar).
   - Mengikat siklus hidup objek gambar dari engine Vela (`drawing:created`, `drawing:edited`, `drawing:removed`, `drawing:settings`) secara reaktif ke Svelte 5 runes pada `chartDrawingController`.
   - Menyediakan kontrol granular per item: toggle visibilitas (mata), toggle kunci (gembok), hapus (tempat sampah), tombol pengaturan parameter (gear) dan buka di Pine IDE (kode) untuk indikator, serta tombol aksi massal (*Sembunyikan Semua*, *Kunci Semua*, *Hapus Semua*).
   - Menerapkan sinkronisasi seleksi dua arah: klik item layer memfokuskan objek di kanvas WebGL2, dan klik objek di kanvas otomatis menyorot dan menggulir item di panel layer (*auto-scroll into view*).

2. **Native Chart Deep Link Bridge (`trawangan://`)**:
   - Mendaftarkan skema protokol native `trawangan://` pada tingkat sistem operasi Windows.
   - Menerapkan *Single-Instance Guard* sehingga aktivasi tautan dari luar aplikasi tidak meluncurkan jendela baru, melainkan meneruskan payload simbol/URL ke proses yang sedang berjalan dan membawa jendela ke latar depan (*focus/foreground*).
   - Mendukung format URI: `trawangan://chart?symbol=BINANCE:BTCUSDT` dan `trawangan://open?url=<encoded_url>`.

3. **Multi-Platform URL Parser & Fallback Routing**:
   - Mengurai URL dari platform charting eksternal (TradingView, Binance Web, Bybit, DexScreener/CoinMarketCap).
   - Mengekstraksi bursa sumber dan menormalkan nama instrumen (termasuk strip sufiks derivatif seperti `.P` pada perpetual futures).
   - Memprioritaskan data feed dari bursa sumber (misal `binance`). Jika simbol tidak ditemukan pada bursa asal atau koneksi feed bursa tersebut mengalami kendala, sistem secara otomatis menjalankan *fallback routing* ke bursa cadangan terbaik (`bitunix`, `indodax`, `bybit`) yang menyediakan aset tersebut via `SymbolSearchEngine`, disertai notifikasi informatif.

4. **Smart Clipboard Watcher Sentry**:
   - Menjalankan pemantau papan klip lokal pasif saat aplikasi berjalan di latar belakang.
   - Jika pengguna menyalin URL platform charting kripto yang valid, Trawangan menampilkan toast konfirmasi non-intrusif di pojok antarmuka (*"Buka [Simbol] di Trawangan?"*) agar tidak merusak alur kerja penyalinan data pengguna lain, dengan opsi auto-navigate langsung yang dapat diaktifkan di Pengaturan.

5. **Integrated Companion Script & In-App Tutorial**:
   - Menyediakan berkas skrip browser pendamping (*userscript* Tampermonkey/Violentmonkey) di direktori repositori `scripts/trawangan-browser-bridge.user.js` yang secara otomatis mencegat navigasi URL TradingView dan mengalihkannya ke protokol `trawangan://`.
   - Mengintegrasikan pusat bantuan dan tutorial langkah-demi-langkah aktivasi skrip browser beserta tombol 1-klik salin skrip langsung di dalam dialog Pengaturan (`SettingsModal`) terminal Trawangan.
