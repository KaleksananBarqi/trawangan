# 0007. Unified Object Tree and Browser Deep Link Bridge Architecture

> **Status Parsial (Diperbarui oleh Spec #164 / Tiket #169):**
> - **Bagian 1 (`Unified Object Tree Architecture`)**: **TETAP AKTIF** dan dipertahankan penuh di panel dock kanan terminal `trawangan`.
> - **Bagian 2–5 (`Chart Deep Link Bridge`, `Multi-Platform URL Parser & Fallback Routing`, `Smart Clipboard Watcher`, dan `Tampermonkey Companion Script / BrowserBridgeGuide`)**: **DEPRECATED / Superseded & Dihapus** pada Spec #164 / Tiket #169. Implementasi peluncuran tautan eksternal standar tetap ditangani oleh `urlService`, sedangkan perilaku fokus & unminimize `single-instance` pada Rust Tauri backend tetap dipertahankan.

Untuk memberikan pengalaman inspeksi layer kanvas yang komprehensif ala TradingView, `trawangan` menetapkan keputusan arsitektur berikut:

1. **Unified Object Tree Architecture** *(AKTIF)*:
   - Menyatukan layer indikator aktif dan objek coretan gambar teknikal dalam satu pohon hierarki terpadu (*Unified Object Tree*) di panel dock kanan, terbagi dalam 2 grup *collapsible* (Indikator & Objek Gambar).
   - Mengikat siklus hidup objek gambar dari engine Vela (`drawing:created`, `drawing:edited`, `drawing:removed`, `drawing:settings`) secara reaktif ke Svelte 5 runes pada `chartDrawingController`.
   - Menyediakan kontrol granular per item: toggle visibilitas (mata), toggle kunci (gembok), hapus (tempat sampah), tombol pengaturan parameter (gear) dan buka di Pine IDE (kode) untuk indikator, serta tombol aksi massal (*Sembunyikan Semua*, *Kunci Semua*, *Hapus Semua*).
   - Menerapkan sinkronisasi seleksi dua arah: klik item layer memfokuskan objek di kanvas WebGL2, dan klik objek di kanvas otomatis menyorot dan menggulir item di panel layer (*auto-scroll into view*).

2. **Native Chart Deep Link Bridge (`trawangan://`)** *(DEPRECATED / Dihapus pada #164, #169)*:
   - ~~Mendaftarkan skema protokol native `trawangan://` pada tingkat sistem operasi Windows.~~ (Dihapus: `tauri-plugin-deep-link`, pin `rust-ini`, konfigurasi plugin `deep-link`, `register_all()`, dan event `deep-link-received` dicabut dari backend Tauri).
   - **Catatan:** *Single-Instance Guard* (`tauri-plugin-single-instance`) tetap aktif untuk memfokuskan dan mengembalikan jendela utama (`set_focus()` & `unminimize()`) saat instance kedua diluncurkan.
   - ~~Mendukung format URI: `trawangan://chart?symbol=BINANCE:BTCUSDT` dan `trawangan://open?url=<encoded_url>`.~~

3. **Multi-Platform URL Parser & Fallback Routing** *(DEPRECATED / Dihapus pada #164, #169)*:
   - ~~Mengurai URL dari platform charting eksternal (TradingView, Binance Web, Bybit, DexScreener/CoinMarketCap).~~ (`UrlInterceptorService` dihapus).
   - ~~Mengekstraksi bursa sumber dan menormalkan nama instrumen (termasuk strip sufiks derivatif seperti `.P` pada perpetual futures).~~
   - ~~Memprioritaskan data feed dari bursa sumber dan menjalankan fallback routing.~~

4. **Smart Clipboard Watcher Sentry** *(DEPRECATED / Dihapus pada #164, #169)*:
   - ~~Menjalankan pemantau papan klip lokal pasif saat aplikasi berjalan di latar belakang.~~ (`ClipboardWatcherService`, toast clipboard, serta properti `clipboardWatcherEnabled` dan `clipboardAutoOpen` dihapus; `resolveAppSettings` mengabaikan key legacy dengan aman).
   - ~~Jika pengguna menyalin URL platform charting kripto yang valid, Trawangan menampilkan toast konfirmasi non-intrusif di pojok antarmuka.~~

5. **Integrated Companion Script & In-App Tutorial** *(DEPRECATED / Dihapus pada #164, #169)*:
   - ~~Menyediakan berkas skrip browser pendamping (*userscript* Tampermonkey/Violentmonkey) di `scripts/trawangan-browser-bridge.user.js`.~~ (Berkas userscript dan komponen `BrowserBridgeGuide` dihapus; tab `system` di `SettingsModal` diperbarui menjadi *"Sistem & Telemetri"*).
   - ~~Mengintegrasikan pusat bantuan dan tutorial langkah-demi-langkah aktivasi skrip browser di `SettingsModal`.~~
