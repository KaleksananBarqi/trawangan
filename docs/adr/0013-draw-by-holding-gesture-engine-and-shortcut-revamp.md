# 0013 - Draw by Holding Gesture Engine and Shortcut Revamp

## Konteks
Terminal charting desktop `trawangan` dirancang untuk analisis teknikal berkecepatan tinggi dengan ergonomi keyboard-first. Namun seiring berkembangnya fitur, subsistem shortcut dan manipulasi gambar teknikal menghadapi dua masalah utama:
1. **Penyumbatan Alur Input Keyboard (Keyboard Input Collision)**:
   Mekanisme *Type-to-Search Canvas Guard* memotong semua karakter alfanumerik tunggal (`0-9`, `a-z`) tanpa modifier langsung ke modal pencarian koin. Hal ini menyebabkan pintasan angka pergantian *timeframe* (`1, 3, 5, 0, 4, H, D, W`) tidak dapat dieksekusi atau justru membuka modal pencarian koin secara tidak sengaja, serta memicu konflik pada tombol `H` antara mode *Hand-Pull* dan *1H Timeframe*.
2. **Keterbatasan Ergonomi Alat Gambar Konvensional**:
   Pintasan gambar lama bertumpu pada kombinasi tombol berbasis `Alt` (`Alt+H`, `Alt+V`, `Alt+T`, `Alt+B`, `Alt+F`, `Alt+R`) yang menuntut posisi tangan canggung (*claw grip*), rentan dibajak oleh menu akselerator sistem operasi Linux/Windows, dan memperlambat trader saat ingin mencoretkan analisis teknikal secara spontan di atas lilin *candlestick*.

## Keputusan
1. **Pemisahan Domain Input Keyboard (Shortcut Revamp)**:
   - **Timeframe Quick Input Bar**: Mengarahkan seluruh pengetikan angka (`1`, `3`, `5`, `15`, `60`, dsb.) di atas kanvas grafik ke bilah input *timeframe* melayang minimalis (gaya TradingView), bukan lagi membuka modal pencarian simbol. Menekan `Enter` langsung mengganti interval lilin.
   - **Symbol Search Filter**: Menjaga agar pengetikan huruf alfabet murni (`B`, `E`, `S`, dll.) memicu modal pencarian koin, sementara tombol fungsi kanvas dan pintasan sistem dibersihkan dari bentrokan.
   - **Pembersihan Alt-Combos**: Mengeliminasi ketergantungan wajib pada kombinasi `Alt` untuk alat gambar utama demi mencegah konflik dengan jendela OS.

2. **Dual-Trigger Gesture Draw Engine (Dua Arah / Vice-Versa)**:
   - Menyediakan dua moda aktivasi yang saling melengkapi:
     - **Toolbar Toggle Button**: Menambahkan tombol baru berikon pena stylus di bilah alat gambar kiri (*Drawing Toolbar*) pada grup *Pointer Tools* (bersebelahan dengan Kursor dan Hand-Pull) untuk mengunci kanvas ke *Gesture Draw Mode*.
     - **Keyboard Toggle Shortcut (`Shift + D`)**: Menekan kombinasi `Shift+D` beralih instan antara mode kursor standar dan *Gesture Draw Mode*.
     - **Transient Hold Mode (`~` / Backquote atau `Shift+D`)**: Menahan tombol pemicu sambil menggoreskan mouse langsung menggambar gesture seketika; melepas tombol mengembalikan kanvas ke kursor normal.
   - Menampilkan status visual yang jelas: kursor mouse bermutasi menjadi pena stylus dan lencana status *"Gesture Mode"* muncul di sudut kanvas.

3. **Mesin Pengenal Geometri Goresan Lokal (Client-Side Heuristic Recognizer)**:
   - Mengubah satu sapuan goresan bebas (*one continuous stroke*) menjadi 9 objek gambar teknikal secara deterministik, offline, dan berlatensi 0ms:
     - *Trend Line* (garis lurus diagonal)
     - *Horizontal Line* (garis dengan sudut kemiringan < 7°)
     - *Vertical Line* (garis dengan sudut kemiringan > 83°)
     - *Ray* (garis lurus yang menembus/mendekati sumbu harga kanan)
     - *Rectangle / Box* (kotak empat sisi tertutup bersudut tegas)
     - *Ellipse* (lingkaran atau oval tertutup berlekuk mulus)
     - *Fib Retracement* (pola ayunan 3 titik Z/N dari puncak ke lembah)
     - *Path / Polyline* (garis bersudut tajam banyak lekukan)
     - *Arrow* (garis dengan kait panah di ujung akhir)

4. **Scribble to Erase & Smart Interaction Aids**:
   - **Scribble Erase**: Sapuan zigzag bolak-balik berfrekuensi tinggi di atas objek gambar langsung menghapus objek tersebut secara otomatis dan mencatatnya ke riwayat *Undo/Redo* (`Ctrl+Z`).
   - **OHLC Wick Snapping**: Garis horizontal dan Fib Retracement otomatis menempel (*snap*) pada ekor lilin (*wick High/Low*) terdekat dalam radius toleransi 20 piksel via subsistem magnet yang ada.
   - **Tab Candidate Cycling & Floating HUD**: Menampilkan *Floating HUD* hasil deteksi dengan opsi menekan `Tab` untuk beralih ke kandidat bentuk alternatif (misal: Trend Line ↔ Ray ↔ Horizontal Line).
   - **Live Dynamic Ink**: Menampilkan goresan kuas bercahaya dinamis pada kanvas overlay selama mouse ditekan.

5. **Modal Panduan Visual "Draw by holding"**:
   - Menyediakan modal bantuan visual interaktif bergaya OpenMarket dengan contoh ilustratif setiap bentuk goresan yang dapat diakses via ikon `?` pada toolbar dan Pusat Pintasan Keyboard (`F1`).

## Konsekuensi
- Trader dapat mencoretkan analisis teknikal, garis tren, dan level support/resistance secara natural dalam hitungan detik tanpa harus membuka menu alat gambar berulang kali.
- Tidak ada tabrakan input antara pencarian koin dan pergantian timeframe; pengalaman keyboard-first menjadi sangat mulus dan konsisten.
- Seluruh pengenalan bentuk dijalankan secara matematis di memori lokal klien tanpa ketergantungan model AI eksternal atau jaringan, menjamin privasi dan latensi 0ms.
