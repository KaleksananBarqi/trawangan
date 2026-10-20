# 0010. OHLC Magnet Snapping, Tick-Aligned Price Guard, and Alert Management Revamp

Untuk mengeliminasi angka desimal berlebih (*floating point noise*) dan menyediakan ergonomi penempatan level analisis teknikal yang presisi serta alur pembaruan sinyal batas harga yang intuitif, `trawangan` menetapkan keputusan arsitektur berikut:

1. **Dual-Layer Snapping Architecture (Tick-Aligned Guard & OHLC Magnet)**:
   - **Tick-Aligned Price Guard (Sanitasi Presisi)**: Seluruh perhitungan harga interaktif—baik saat menggeser garis alert maupun mengatur jangkar *Risk/Reward Position Tool*—wajib melewati filter sanitasi kelipatan ukuran *tick* (*tick size*). Resolusi dilakukan secara bertingkat: mematuhi `tickSize` instrumen bursa aktif jika tersedia, atau beralih ke pembulatan adaptif berdasarkan magnitudo nominal harga (mencegah desimal panjang tak berhingga).
   - **OHLC Magnet Snapping (Penambatan Candlestick)**: Saat mode magnet aktif, posisi harga mengunci secara otomatis ke titik ekstrem lilin candlestick terdekat dengan radius toleransi 15 piksel. Titik **High** dan **Low** (ujung sumbu/*wicks*) diprioritaskan sebelum Open dan Close.

2. **Interaktivitas Kanvas & Pembalik Status Dinamis (`Shift` Modifier)**:
   - **Real-Time Projection**: Selama gestur geser (*drag*), proyeksi harga dan penyesuaian area visual (misalnya rasio Risk/Reward dan garis batas alert) diperbarui secara instan pada 60 FPS, kemudian disimpan (*commit*) ke layer state saat mouse dilepas (*pointer up*).
   - **Snap Halo Indicator**: Saat kursor tertambat ke titik lilin, antarmuka memunculkan feedback visual berupa titik pendar (*halo dot*) pada lilin dan label status magnet pada *badge* harga kanvas.
   - **Shift Inversion Guard**: Menahan tombol `Shift` saat dragging akan membalik status magnet secara sementara: mengizinkan gerakan halus bebas (*freeform*) saat magnet menyala, atau mengaktifkan snap instan saat magnet mati tanpa perlu bolak-balik menyalakan kontrol toolbar.

3. **Revamp Manajemen Alert (Unified Create/Edit Modal & Two-Way Triggers)**:
   - **Akses Pengeditan Dua Arah (*Two-Way Access*)**: Pengguna dapat memicu pengeditan manual alert yang sudah ada melalui (1) *Double-click* atau klik tombol edit pada *badge* garis alert di kanvas grafik, dan (2) Tombol pensil (*Edit*) pada daftar alert di bilah kanan (*Watchlist/Alerts Tab*).
   - **Unified Create/Edit Modal**: `CreateAlertModal.svelte` direfaktor untuk menangani mode pembuatan maupun penyuntingan. Dalam mode sunting, form otomatis terisi dengan data alert yang dipilih, tombol aksi utama memanggil `alertService.updateAlert(id, updates)`, serta menyediakan tombol aksi cepat hapus langsung di dalam modal.

4. **Konsistensi Long/Short (Risk/Reward Position Tool)**:
   - Ketiga jangkar pengukuran harga pada *Position Tool* (level *Entry Price*, *Profit Target*, dan *Stop Loss*) tunduk secara seragam pada aturan *Tick-Aligned Price Guard* dan *OHLC Magnet Snapping*. Hal ini memastikan perhitungan rasio RR bersih dan bebas dari anomali pecahan desimal.
