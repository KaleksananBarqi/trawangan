# 0012 - Offline Branded Snapshot Engine and Attribution Frame

## Konteks
Sebagai terminal charting desktop profesional dengan filosofi *zero paywall* dan *pure charting scope*, pengguna `trawangan` kerap membagikan analisis teknikal grafik ke media sosial (Twitter/X, Telegram, Discord, blog riset) atau menyimpannya ke dalam jurnal trading pribadi.

Di platform komersial, fitur tangkapan layar sering kali terkunci di balik langganan, bergantung pada server cloud eksternal yang lambat dan mengorbankan privasi pengguna via URL publik, atau membubuhkan cap *watermark* diagonal yang mengganggu dan menutupi area lilin (*candlestick*). Di sisi lain, *screenshot* mentah bawaan OS sering kali terpotong tidak rapi, buram pada layar HiDPI, dan tidak menyertakan konteks penting instrumen (simbol, timeframe, bursa, harga penutupan, dan waktu analisis).

## Keputusan
1. **Offline Branded Snapshot Frame & Attribution Bar**:
   - Membangun mesin komposit kanvas 2D lokal murni (`snapshotCompositor`) yang membungkus grafik WebGL2 dengan padding bertema gelap minimalis (`#0F0F0F`), sudut membulat halus (`12px`), dan garis batas redup.
   - Menyematkan **Attribution Bar** di bagian bawah kanvas:
     - Sisi Kiri: Monogram resmi `tr` hot pink (`#FF69B4`), teks brand `trawangan`, serta badge instrumen (`simbol`, `timeframe`, `nama bursa`).
     - Sisi Kanan: Harga pasar terkini, stempel waktu lokal pengguna (WIB/UTC), dan tautan publik `kaleksananbarqi.github.io/trawangan`.
   - Mengeliminasi segala bentuk watermark yang menutupi candlestick; identitas brand disajikan secara elegan di luar area data.

2. **Dual-Mode Export & Multi-Chart Grid Support**:
   - Mendukung dua mode ekspor: **Branded Frame** (kartu estetis siap bagikan) dan **Clean Chart** (murni piksel kanvas lilin tanpa bingkai luar untuk kebutuhan dokumentasi teknis).
   - Mendukung penangkapan fleksibel: **Chart Aktif Saja** (default) serta **Seluruh Grid Multi-Chart** saat menggunakan tata letak multi-grafik (2, 2H, atau 4 sel).

3. **Ultra-Sharp 2x HiDPI Compositing & Clipboard-First Workflow**:
   - Merender komposit kartu pada skala 2x (HiDPI) agar tipografi, wick lilin, dan garis indikator tetap tajam saat di-zoom.
   - Mengadopsi alur kerja *Clipboard-First*: menekan tombol cepat atau pintasan `Ctrl+Shift+S` langsung menyalin gambar format PNG ke clipboard sistem via Clipboard API, disertai notifikasi toast visual yang elegan.
   - Menyediakan fallback unduhan file PNG lokal dengan konvensi penamaan terstruktur (`trawangan-[symbol]-[timeframe]-[timestamp].png`).

4. **Persistensi Preferensi Lokal**:
   - Menyimpan preferensi pengguna (mode bingkai aktif/nonaktif, opsi tampilan harga/waktu) secara permanen di basis data lokal `appSettings` tanpa telemetri atau dependensi cloud.

## Konsekuensi
- Trader dapat membagikan analisis teknikal berkualitas tinggi dalam waktu kurang dari 1 detik secara instan.
- Privasi data terjaga 100% karena pemrosesan gambar sepenuhnya berjalan di sisi klien secara offline tanpa lalu lintas jaringan keluar.
- Identitas brand `trawangan` tersiar secara konsisten, estetis, dan profesional ke komunitas trading global.
