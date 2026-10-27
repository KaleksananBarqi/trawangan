# 0011 - Hybrid Symbol Logo and Adaptive Quote Engine

## Konteks
Sebelumnya, antarmuka terminal `trawangan` hanya menampilkan simbol sebagai teks mentah tanpa logo aset koin, serta memiliki asumsi kaku bahwa semua pencarian instrumen berkuotasi `USDT` (atau `IDR` di Indodax). Ketika pengguna memasukkan pasangan kripto-ke-kripto seperti `ETHBTC`, sistem secara keliru memaksakan penambahan sufiks `USDT` dan `.P` fiktif (`ETHBTCUSDT.P`). Selain itu, kuotasi non-fiat seperti BTC belum memiliki format presisi desimal dan label harga yang sesuai.

## Keputusan
1. **Hybrid Asset Logo Engine & Dual-Asset Badging**:
   - Membangun komponen terpusat `SymbolLogo.svelte` dengan strategi *3-tier fallback*: bundle SVG lokal koin terpopuler (`static/icons/coins/`), CDN publik aset kripto dengan caching, dan Monogram Avatar bergradien warna deterministik.
   - Menerapkan *Dual-Asset Badging* (logo base dominan + badge mini quote di sudut) untuk pasangan non-USDT di Header, Quick Symbols, Symbol Search Modal, dan Watchlist Panel.
2. **Adaptive Quote Parser & Venue Capability Guard**:
   - Memperbaiki parser simbol agar mengenali delimiter (`/`, `-`, spasi) maupun sufiks kuotasi standar (`USDT`, `USDC`, `BTC`, `ETH`, `IDR`, `EUR`, `USD`) tanpa memaksakan USDT jika kuotasi eksplisit diberikan.
   - Membatasi pasangan kripto-ke-kripto (seperti `ETHBTC`) hanya ke instrumen **Spot** bursa (menonaktifkan derivatif `.P` sintetis karena tidak ada kontrak futures perpetual untuk pair tersebut).
3. **Crypto-Denominated Precision & Quote Filter**:
   - Menambahkan filter chip `BTC (₿)` pada antarmuka pencarian simbol.
   - Memperbarui `priceScaleLabelService` dan formatter baris Watchlist untuk mendukung kuotasi BTC dengan presisi hingga 8 desimal (format Satoshi / `₿`).

## Konsekuensi
- Setiap simbol dijamin 100% memiliki identitas visual tanpa risiko gambar rusak atau lag jaringan (*offline-resilient*).
- Pengguna dapat mencari, menganalisis, dan memantau pasangan arbitrer seperti `ETH/BTC` atau `SOL/BTC` dengan mulus dan akurat.
- Tampilan harga di seluruh kanvas dan bilah samping selaras dengan satuan mata uang kuotasi yang sebenarnya.
