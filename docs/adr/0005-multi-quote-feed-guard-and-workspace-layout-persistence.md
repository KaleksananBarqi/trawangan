# 0005. Multi-Quote Indodax Integration, Feed Connection Guard, and Deep Workspace Persistence

Untuk mengatasi keterbatasan analisis pasar lokal, kerapuhan terhadap pemblokiran ISP lokal, dan hilangnya preferensi tata letak kanvas saat memuat sesi, `trawangan` menetapkan keputusan arsitektur berikut:

1. **First-Class Indodax & Multi-Quote Pair Support**: Mengintegrasikan bursa Indodax secara native (`IndodaxProvider` pada engine visual Vela WebGL2 dan `IndodaxAdapter` pada `MarketFeedService`) dengan akses langsung ke endpoint publik tanpa API key. Menghapus restriksi pencarian kuotasi USDT tunggal dan memperkenalkan *Multi-Quote Pair Search* yang mendukung pemisahan slash/strip (`BTC/IDR`, `BTC-IDR`), chip filter bursa (`Indodax`, `Binance`, `Bitunix`), chip kuotasi (`IDR`, `USDT`), riwayat pencarian terakhir (*Recent Searches*), live 24h ticker badge, serta pemformatan ribuan adaptif mata uang Rupiah pada sumbu harga kanan (*Price Scale*).
2. **Proactive Feed Connection Guard**: Mencegah kanvas grafik terjebak (*stuck*) saat koneksi feed terputus atau terkena pemblokiran DNS/ISP (seperti pemblokiran domain Binance di Indonesia) dengan memasang pengawas deteksi kegagalan. Saat gangguan terdeteksi, antarmuka memunculkan *Floating Warning Banner* di atas grafik dengan tombol aksi cepat satu klik untuk beralih langsung ke Indodax atau mencoba ulang koneksi.
3. **Deep Workspace & Sub-Pane Layout Persistence**: Memperluas skema penyimpanan `SavedWorkspace` agar tidak hanya menyimpan daftar indikator, melainkan merekam kondisi visual secara utuh:
   - `paneWeights`: Rasio proporsi vertikal kanvas grafik lilin utama terhadap sub-pane indikator osilator di bawahnya (misal Stochastic, RSI, MACD) yang diatur melalui bilah pemisah (*pane separator*).
   - `providerId`: Bursa aktif yang terikat pada workspace tersebut.
   - `priceScaleState`: Status mode skala sumbu harga kanan (Linier vs Logaritmik, serta manual drag range).
   - `priceStyle`: Gaya visual lilin (*Candlestick*, *Heikin Ashi*, *Bars*, *Line*).
   - `barSpacing`: Kerapatan zoom horizontal lilin terakhir.
   - `activeRightDockPanel`: Status panel sisi kanan yang sedang terbuka (*Watchlist*, *Pine IDE*, *Alerts*, atau *Collapsed*).
   - `syncConfig`: Matriks preferensi sinkronisasi pada tata letak multi-chart (2 atau 4 grafik).
4. **Preset Watchlist Pasar Lokal**: Menyediakan preset kategori tab di panel Watchlist (`Binance USDT` dan `Indodax IDR`) untuk akses cepat ke instrumen pasar teratas tanpa konfigurasi manual.
