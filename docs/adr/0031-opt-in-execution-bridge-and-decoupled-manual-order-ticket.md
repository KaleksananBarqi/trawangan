# 0031. Opt-In Execution Bridge, 3-Step Security Gate, Local MT5 Socket Bridge, and Decoupled Manual Order Ticket

## Status
Diterima (*Accepted*), 24 November 2026. Mengamandemen batasan *Zero Brokerage* pada `ADR-0001` dan `ADR-0003`.

## Konteks
Pada fase awal (`ADR-0001` & `ADR-0003`), `trawangan` menetapkan `Pure Charting Scope` yang melarang seluruh koneksi akun broker dan eksekusi order. Namun, pengguna tingkat lanjut membutuhkan opsi untuk mengeksekusi transaksi langsung ke **Binance**, **Bitunix**, dan **Broker CFD populer berbasis MetaTrader 5 (MT5)** tanpa harus berpindah aplikasi, dengan dua syarat mutlak:
1. Fitur ini **100% Opsional (Default OFF)** dan baru aktif setelah pengguna melewati serangkaian pengaturan keamanan eksplisit.
2. **Pemisahan Tegas dari Trade Plan**: Proyeksi `Trade Plan` harus tetap murni sebagai alat perencanaan visual dan analisis risiko, sedangkan penempatan order ke broker harus dilakukan secara **manual** melalui tiket order terpisah agar tidak terjadi eksekusi otomatis yang tidak disengaja.

## Keputusan Arsitektur

1. **Zero UI Footprint by Default (`Opt-In Execution Bridge`)**:
   - Secara bawaan (`executionBridgeEnabled: false`), `trawangan` beroperasi 100% dalam mode murni charting. Tidak ada ikon tab order di `Right Dock Rail`, tidak ada tombol Buy/Sell, dan tidak ada koneksi jaringan ke endpoint privat bursa.

2. **Gerbang Aktivasi 3 Langkah (3-Step Security Gate)**:
   - Di dalam Modal Pengaturan (Tab **Broker & Eksekusi**), pengguna wajib melewati 3 tahap sebelum fitur eksekusi terbuka:
     - **Tahap 1: Persetujuan Risiko Mandiri (*Self-Custody & Execution Disclaimer*)**: Pengguna membaca dan menyetujui bahwa seluruh kredensial disimpan secara lokal di perangkat pengguna dan risiko eksekusi order sepenuhnya berada di tangan pengguna, lalu mengetik kata konfirmasi.
     - **Tahap 2: Konfigurasi Kredensial & Verifikasi Koneksi + Tutorial Lengkap**: Pengguna menyiapkan koneksi untuk salah satu atau ketiga broker yang didukung (**Binance**, **Bitunix**, **MT5 CFD**) dengan panduan langkah-demi-langkah (*in-app setup tutorial*) dan wajib menjalankan **"Tes Koneksi & Verifikasi"** hingga berhasil.
     - **Tahap 3: Enkripsi Kredensial Lokal**: Kredensial API Secret dienkripsi di lapisan Rust Core (stream-cipher SHA-256 dengan nonce acak 16-byte per-write format `v2` yang terikat mesin lokal di brankas SQLite) dan tidak pernah diekspos sebagai teks terbuka di log maupun ekspor workspace.

3. **Arsitektur Tiga Konektor Broker (Direct-from-Client, Zero Cloud Relay)**:
   - **Binance (Spot & USDⓈ-M Futures)**: Penandatanganan payload `HMAC-SHA256` langsung dari Rust Core (`src-tauri`) ke REST API resmi Binance tanpa server perantara.
   - **Bitunix (Spot & Perpetual Futures)**: Penandatanganan `SHA256` sesuai spesifikasi OpenAPI resmi Bitunix langsung dari Rust Core.
   - **Broker CFD / MetaTrader 5 via `Local MT5 Socket Bridge`**:
     - Karena terminal MT5 tidak menyediakan REST API terbuka, `trawangan` menyediakan generator skrip Expert Advisor resmi **`TrawanganMT5Bridge.mq5`** beserta tutorial pemasangan lengkap di dalam aplikasi.
     - EA berjalan di terminal MT5 desktop pengguna dan membuka kanal lokal (`http://127.0.0.1:15555` dengan token otorisasi lokal) sehingga `trawangan` dapat membaca saldo/posisi dan mengirim perintah order manual ke broker CFD mana pun (Exness, HFM, Pepperstone, Octa, dll.) secara gratis dan berlatensi < 2 ms.

4. **Decoupled Manual Order Ticket (Terpisah dari Trade Plan)**:
   - Tab `Plan` **dilarang** memiliki tombol eksekusi order ke broker.
   - Ketika `Opt-In Execution Bridge` aktif, sebuah tab khusus **`Order`** muncul di `Right Dock Rail` yang memuat:
     - **Pemilih Akun Broker & Ringkasan Akun**: Menampilkan status koneksi, *Balance*, *Equity*, dan *Available Margin* secara real-time.
     - **Manual Order Ticket**: Input manual penuh oleh pengguna meliputi arah (*Buy/Long* atau *Sell/Short*), tipe order (*Market* atau *Limit*), *Harga Entry*, *Quantity / Lot*, *Leverage*, serta nilai *Stop Loss* dan *Take Profit* opsional, dilengkapi modal konfirmasi akhir sebelum transmisi.
     - **Manajemen Posisi & Order Aktif**: Daftar posisi terbuka (*Open Positions*) dan antrean order (*Pending Orders*) dengan aksi manual *Close Position* dan *Cancel Order*.

## Konsekuensi
- Pengguna yang hanya ingin melakukan charting murni tetap mendapatkan pengalaman bebas distraksi seperti semula.
- Trader aktif dapat mengeksekusi order manual ke Binance, Bitunix, dan MT5 CFD dalam satu terminal dengan keamanan kredensial lokal dan pemisahan psikologis yang jelas antara *merencanakan setup* (Tab `Plan`) dan *mengeksekusi transaksi* (Tab `Order`).
