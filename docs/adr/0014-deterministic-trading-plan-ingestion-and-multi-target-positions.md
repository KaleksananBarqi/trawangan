# 0014 - Deterministic Trading Plan Ingestion and Multi-Target Positions

## Konteks
Trader di `trawangan` kerap menyusun rencana perdagangan (*trading plan*) terstruktur dalam format teks atau tabel Markdown (berisi parameter Bias, Entry, Stop Loss, Target TP1/TP2, serta tesis analisis kualitatif `[FAKTA]`, `[INFERENSI]`, `[SPEKULASI]`). Memasukkan angka-angka koordinat ini secara manual satu per satu ke dalam alat gambar grafik konvensional memakan waktu, rawan salah ketik (*human error*), dan memperlambat momentum analisis pasar.

Di sisi lain, `trawangan` berpegang teguh pada prinsip terminal charting desktop native yang ultra-ringan, beroperasi 100% lokal (*offline*), dan menjaga privasi penuh tanpa ketergantungan pada model LLM eksternal atau modul OCR berbasis piksel yang lambat dan berat.

## Keputusan
1. **Deterministic Trading Plan Parser (Zero-LLM & Zero-OCR)**:
   - Membangun mesin parser teks/markdown berbasis *lenient regex tokenization* yang mengurai parameter trading secara lokal dan deterministik (< 5 ms).
   - Mengekstrak harga numerik pertama dari baris parameter `Bias`, `Entry`, `Stop Loss`, dan target dinamis (`TP1` s.d. `TPn`), serta mengabaikan teks keterangan pelengkap di dalam sel.
   - Mengekstrak narasi analisis kualitatif (`Alasan Entry`, `Alasan SL`, `Alasan TP`, catatan FVG) untuk disimpan sebagai metadata terstruktur.

2. **Sanity Guard & Tick-Aligned Price Guard**:
   - Memvalidasi konsistensi logika arah posisi sebelum diterapkan ke grafik:
     - Untuk *Bearish / Short*: memastikan `SL > Entry` dan seluruh `TP < Entry`.
     - Untuk *Bullish / Long*: memastikan `SL < Entry` dan seluruh `TP > Entry`.
   - Menyelaraskan seluruh tingkat harga secara otomatis dengan kelipatan ukuran tick (*tick size*) instrumen bursa aktif via `roundToTickSize`.

3. **Visualisasi Staged Multi-Target Position**:
   - Mengatasi limitasi alat posisi standar (yang hanya mendukung 1 target) dengan memetakan posisi multi-target sebagai rangkaian kotak bertingkat (*staged boxes*):
     - Stage 1 (TP1): Membentang dari candle awal ($t_0$) hingga $t_1$ dengan target harga TP1 dan label rasio `TP1 (X.XX R)`.
     - Stage 2 (TP2): Membentang dari $t_1$ hingga $t_2$ dengan target harga TP2 dan label rasio `TP2 (X.XX R)`.
     - Seluruh stage berbagi tingkat Entry dan Stop Loss yang identik secara visual dan matematis.
   - Mengikat pembuatan grup posisi ini ke dalam satu transaksi riwayat *Undo/Redo* atomik (`Ctrl+Z`).

4. **Alur Antarmuka Pengguna (UI/UX) & Pintasan**:
   - Menyediakan modal dialog **"Import Trading Plan"** dengan pintasan keyboard cepat **`Ctrl + Shift + P`**, menu konteks grafik, dan tombol pada Drawing Toolbar.
   - Dilengkapi *Live Preview* reaktif yang menampilkan kartu parameter, status validasi, dan rincian R-multiple secara instan saat teks ditempelkan (*paste*).
   - Mengintegrasikan pendengar *Smart Clipboard Paste* pada kanvas grafik yang otomatis membuka modal impor saat teks tabel terdeteksi.

5. **Penyimpanan Metadata Analisis Kualitatif**:
   - Menyimpan seluruh teks narasi alasan ke dalam metadata objek gambar tanpa mengotori kanvas grafik.
   - Narasi dapat diinspeksi secara non-intrusif melalui tooltip kursor kanvas dan panel hierarki **Object Tree** di bilah dock kanan.

## Konsekuensi
- Trader dapat memindahkan rencana posisi multi-target dari catatan teks ke kanvas grafik hanya dalam 1 detik.
- Aplikasi tetap berukuran sangat ramping tanpa dependensi model machine learning/LLM atau library OCR citra.
- Visualisasi target bertingkat tersaji secara elegan, presisi, dan sepenuhnya selaras dengan palet tema serta aturan pembulatan bursa kripto aktif.
