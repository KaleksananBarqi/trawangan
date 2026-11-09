# 0021 - Yahoo Finance Provider, Multi-Asset Support, and Dynamic Feeder Context

## Konteks
Pengguna `trawangan` yang bertransaksi di luar aset kripto membutuhkan kapabilitas analisis teknikal, charting, watchlist, alert, dan eksekusi Pine Script untuk instrumen saham Indonesia (IDX), komoditas logam mulia (Emas/Perak), dan indeks saham Amerika Serikat (Nasdaq / S&P 500) tanpa paywall.

Dalam diskusi desain:
1. **Penolakan Pair Sintetis Kripto**: Pengguna secara eksplisit menolak penggunaan pair derivatif stablecoin seperti `XAUUSDT`, karena trader logam mulia dan pasar tradisional mengacu pada harga resmi berdenominasi mata uang riil **USD** (US Dollar per troy ounce).
2. **Mindset Otomatisasi Feeder**: Pengguna menginginkan pemilihan *data feeder* berlangsung mulus di balik layar (*dynamic context*): sistem secara otomatis berpindah ke feed yang sesuai dengan instrumen yang sedang dibuka di kanvas, tanpa mengharuskan pengguna mengubah pengaturan provider secara manual.
3. **Ketersediaan Data Gratis**: Layanan komersial data pasar real-time membebankan biaya lisensi bursa yang tinggi. Pengujian memvalidasi bahwa *endpoint* REST publik Yahoo Finance dapat diakses secara gratis dan andal untuk menyuplai riwayat OHLCV saham Indo (`*.JK`), kontrak berjangka emas riil USD (`GC=F`), perak (`SI=F`), serta indeks Nasdaq (`^IXIC`, `^NDX`, `QQQ`).

## Keputusan
1. **Penegasan Pure Charting Scope**:
   - Dukungan instrumen non-kripto tetap berada dalam batasan `Pure Charting Scope` (analisis grafik, drawing, alert, indikator teknikal, dan trading plan).
   - Tidak ada integrasi transaksi atau eksekusi order ke sekuritas/broker saham maupun pialang berjangka.

2. **Integrasi Yahoo Finance Provider (Multi-Asset Feed)**:
   - Mengimplementasikan `YahooFinanceProvider` untuk WebGL2 Vela Workspace dan `YahooFinanceAdapter` untuk `MarketFeedService`.
   - Mengambil data OHLCV historis dan quote berkala dari `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`.
   - Cakupan aset:
     - **Saham Indonesia (IDX)**: Simbol bursa Jakarta (`BBCA.JK`, `BBRI.JK`, `TLKM.JK`, `GOTO.JK`) dan IHSG (`^JKSE`) dengan kuotasi mata uang Rupiah (`IDR`).
     - **Logam Mulia (Metals USD)**: Kontrak acuan resmi COMEX Gold Futures (`GC=F`) dan Silver Futures (`SI=F`) dalam mata uang riil `USD`.
     - **Indeks & ETF AS**: Nasdaq Composite (`^IXIC`), Nasdaq-100 (`^NDX`), S&P 500 (`^GSPC`), dan Invesco QQQ (`QQQ`) dalam mata uang `USD`.

3. **Dynamic Feeder Context**:
   - Provider data aktif pada kanvas dan subsistem feed beradaptasi secara otomatis berdasarkan namespace simbol yang dibuka:
     - Simbol berakhiran `.JK`, diawali `^`, atau berakhiran `=F` dialihkan ke provider `yahoo`.
     - Simbol berakhiran `IDR` dialihkan ke provider `indodax`.
     - Simbol berakhiran `USDT` dialihkan ke provider `binance` atau `bitunix`.
   - Lencana status koneksi dan identitas feed di header/status bar diperbarui secara reaktif (contoh: `Yahoo Finance (Delayed 15m) • USD` atau `Indodax • IDR`).

4. **Client-side Candle Resampling (Timeframe 2H & 4H)**:
   - Karena Yahoo Finance API hanya menyediakan lilin native untuk interval `1m`, `5m`, `15m`, `30m`, `1h`, dan `1D`, adapter menyertakan mesin resampling otomatis:
   - Lilin `2h` dan `4h` dibentuk dari agregasi lilin `1h` (Open lilin pertama, High tertinggi, Low terendah, Close lilin terakhir, dan akumulasi total Volume).

5. **Symbol Aliasing Engine & Smart Provider Inference**:
   - Pengguna tidak diwajibkan menghafal kode simbol bursa Yahoo yang kompleks:
     - Pencarian `XAUUSD` atau `GOLD` secara otomatis memetakan dan menyarankan `GC=F (Gold Futures - COMEX USD)`.
     - Pencarian `SILVER` memetakan ke `SI=F`.
     - Pencarian `NASDAQ` menyarankan `^IXIC (Nasdaq Composite)` dan `^NDX (Nasdaq-100)`.
     - Pencarian ticker saham Indo 4 huruf (contoh: `BBCA`, `BBRI`) di tab Saham otomatis dialihkan ke `BBCA.JK`.
   - `resolveSymbolProvider` mengenali pola akhiran `.JK`, awalan `^`, dan akhiran `=F` secara native tanpa memerlukan prefix `yahoo:`.

6. **Transparansi Jeda Waktu (Delayed Feed) & Polling Guard**:
   - Sesuai regulasi data publik bursa saham, data Yahoo Finance memiliki jeda ~15 menit untuk saham Indo dan pasar AS.
   - Sistem menampilkan lencana visual `DELAYED 15M` pada status bar dan header grafik saat instrumen Yahoo aktif.
   - Frekuensi polling ticker berkala dibatasi pada interval 10–15 detik hanya selama jam perdagangan bursa aktif untuk mencegah pemblokiran IP (*rate limit* 429).

7. **Penanganan Sesi Jam Bursa Diskrit**:
   - Engine grafik WebGL2 memplot deretan lilin diskrit sesuai data transaksi nyata yang diterima dari feed tanpa menginjeksi lilin artifisial selama penutupan bursa atau akhir pekan, menjaga validitas indikator teknikal.

## Konsekuensi
- `trawangan` bertransformasi dari terminal charting kripto menjadi terminal multi-aset (Saham Indo, Emas & Perak Dunia, Indeks AS, dan Kripto) dengan biaya data nol (100% gratis).
- Trader emas mendapatkan visualisasi acuan riil harga emas dunia dalam USD tanpa bergantung pada token kripto sintetis.
- Pengalaman pengguna menjadi terpadu dan otomatis (*zero configuration*): pengguna cukup mencari nama aset dan sistem langsung menyetel feeder serta format mata uang yang tepat.
