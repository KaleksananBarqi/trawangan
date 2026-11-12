# 0024 - Crypto Macro Index and Calibrated Synthetic Basket Feeder

## Status
Diterima (*Accepted*), 12 November 2026.

## Konteks
Pengguna `trawangan` membutuhkan visualisasi indeks komposit makro pasar kripto (`TOTAL`, `TOTAL2`, `TOTAL3`, `OTHERS`) serta indeks dominasi (`BTC.D`, `ETH.D`, `USDT.D`) lengkap dengan candlestick OHLC multi-timeframe, Pine Script, drawing tools, alert pada chart aktif, dan Watchlist.

Dalam perancangan terdapat empat kendala struktural:
1. **Tidak Tersedia di API Publik Gratis:** Tidak ada provider bawaan `trawangan` (`binance`, `indodax`, `bitunix`, `hyperliquid`, `coinbase`, `yahoo`) maupun API publik resmi gratis (CoinGecko Free/Demo, CoinMarketCap Free, CoinPaprika) yang menyediakan candlestick OHLC multi-timeframe untuk indeks komposit seperti `TOTAL2` atau `TOTAL3` (endpoint histori global CoinGecko terkunci di paket berbayar *Analyst+* dan berbentuk titik garis *close-only*). Sementara itu, endpoint WebSocket internal pihak ketiga (`CRYPTOCAP`) tidak terdokumentasi resmi serta memberlakukan pembatasan header `Origin`.
2. **Pemisahan Domain & Normalisasi Istilah:** Istilah pengguna sebelumnya (*"pair unik"* / *"total1"*) bertabrakan dengan konsep `Multi-Quote Pair` di `GLOSSARY.md`. Indeks ini non-tradable dan simbol kanonikal pasar untuk total kapitalisasi keseluruhan adalah `TOTAL` (`TOTAL1` hanyalah alias pencarian).
3. **Skala Harga Triliun USD vs Sumbu `64px` Vela:** Nilai `TOTAL` (`~3e12`) akan mencetak hingga 16 karakter dan terpotong pada lebar sumbu kanan `@luxalgo/vela` (`AXIS_MASTER_W = 64`), sedangkan *formatter* bawaan Vela (`formatPriceLabel` dan `formatCompactValue`) belum mendukung notasi Triliun (`T`) maupun `%` pada seluruh elemen (tick grid, tag harga live, chip crosshair, DataWindow).
4. **Disiplin Sumber Daya ADR-0003 vs Tugas Latar Belakang:** Menjalankan sintesis multi-koin di latar belakang (via Watchlist, preview `Ctrl+K`, atau `Background Alert Engine`) bertentangan dengan target efisiensi memori dan kebutuhan pengguna agar feeder basket hanya hidup ketika simbol indeksnya sedang dibuka.

## Pilihan yang Dipertimbangkan
1. **Sumber Data Feeder:**
   - *Alternatif 1 (Ditolak): Endpoint WebSocket publik tidak terdokumentasi pihak ketiga.* Rentan perubahan protokol tanpa pemberitahuan, bertentangan dengan kebijakan pemakaian jalur API resmi terdokumentasi (pembatasan header `Origin`), dan memaksa penambahan dependensi WebSocket native Rust.
   - *Alternatif 2 (Ditolak sebagai Bawaan): BYOK API Berbayar Saja.* Melanggar prinsip `Zero-Paywall Parity` dan tetap tidak menyediakan OHLC intraday `TOTAL2`/`TOTAL3`. (`CustomFeedProvider` tetap dibuka bagi pengguna ber-feed eksternal).
   - *Alternatif 3 (Dipilih): Calibrated Synthetic Basket (`macro`).* Menghitung komposit lokal memakai API publik resmi gratis, sehingga 100% tanpa paywall dan tersedia multi-timeframe OHLC.
2. **Representasi Nilai di Chart Engine:**
   - *Alternatif 1 (Ditolak): Skala ulang nominal bar di adapter ke satuan Miliar (`3420`).* Menghindari patch formatter `@luxalgo/vela`, namun merusak keaslian angka mentah pada skrip Pine Script (`close`), level alert, dan catatan `Trading Plan Vault`.
   - *Alternatif 2 (Dipilih): Simpan nominal USD / persen asli*, dan tangani pemformatan ringkas `T`/`B`/`%` di Vela (`priceAxis.ticks` + patch ringan formatter) serta layanan label `trawangan`.

## Keputusan
1. **Taksonomi Domain & Cakupan Indeks (`Crypto Macro Index`):**
   - Menetapkan **Crypto Macro Index** sebagai kategori instrumen agregat non-tradable terpisah dari `Multi-Quote Pair`, dengan daftar kanonikal awal:
     - Kapitalisasi pasar (`$`): `TOTAL` (`TOTAL1` sebagai alias di `Symbol Aliasing Engine`), `TOTAL2` (`TOTAL - BTC`), `TOTAL3` (`TOTAL - BTC - ETH`), dan `OTHERS` (`TOTAL - Top 10`).
     - Dominasi (`%`): `BTC.D`, `ETH.D`, dan `USDT.D`.
   - Mengikuti konvensi standar TradingView, `TOTAL`, `TOTAL2`, dan `TOTAL3` **tetap menyertakan kapitalisasi stablecoin utama** (`USDT`, `USDC`), sambil mengecualikan token *wrapped/staked* duplikat (`WBTC`, `WETH`, `STETH`) untuk mencegah penghitungan ganda.
2. **Feeder Basket Sintetis Lokal Terkalibrasi (`macro` Provider):**
   - Mengambil daftar **Top 30 aset kripto non-wrapped paling likuid** beserta `circulating_supply` dan pengali kalibrasi titik kini dari CoinGecko (`/coins/markets` dan `/global`), dengan cache metadata minimal **15 menit** untuk menghindari HTTP `429`. Jika API gagal saat *cold start* (mis. limitasi `429`), koordinator memakai tabel `FALLBACK_MACRO_CONSTITUENTS` dan batas pasokan stablecoin statis cadangan agar grafik tetap dapat disintesis tanpa layar kosong.
   - Mengambil riwayat *circulating supply* harian **DefiLlama Stablecoins API** (`stablecoins.llama.fi`) secara paralel pada `stablecoincharts/all`, `stablecoin/1` (USDT), dan `stablecoin/2` (USDC) secara gratis tanpa API key guna menjaga akurasi historis `USDT.D` serta porsi stablecoin Top-10 pada `OTHERS`, `TOTAL`, `TOTAL2`, dan `TOTAL3`.
   - Mengambil candlestick OHLC komponen dari **Binance Spot** sebagai sumber primer, dengan failover otomatis ke **Coinbase Exchange** (paginasi mundur berjendela `300` bar dan worker pool penuh untuk seluruh 30 konstituen pada live ticker) apabila `Feed Connection Guard` mendeteksi pemblokiran ISP atau kegagalan jaringan.
   - Menyimpan candle komposit hasil sintesis ke tabel `candles` SQLite lokal (`src-tauri/src/db.rs` via IPC `load_cached_candles` / `store_cached_candles`) di bawah kunci terisolasi `macro:<SYMBOL>` dengan timestamp kesegaran per `symbol:timeframe` pada `trawangan_macro_cache_meta_v1`. Di batas IPC SQLite (`store_cached_candles`), `volume` yang kosong dinormalkan ke `0` untuk mematuhi skema `volume REAL NOT NULL`, sedangkan saat dibaca kembali bagi engine chart Vela field `volume` dihapus (`undefined`) sesuai kontrak `OHLCV` non-tradable.
   - Untuk rentang historis jauh di mana koin baru basket belum listing, kalkulasi tetap menjumlahkan subset konstituen yang aktif pada timestamp tersebut (anti-lookahead), dengan fokus horizon *backfill* default `~1 tahun` (`365 hari`).
3. **Kebijakan Beban Nol Latar (*Strict Active-Chart Only*):**
   - Feeder `macro` hanya boleh melakukan fetch komponen dan *live polling* ketika ticker **Crypto Macro Index** terkait benar-benar sedang terbuka pada sel grafik aktif (`activeSymbol`).
   - Pembaruan *live candle* chart aktif menggunakan **polling batch terjadwal (~10 detik)** lewat endpoint batch ticker multi-simbol tunggal, bukan membuka 30 koneksi WebSocket paralel (mematuhi anggaran RAM ADR-0003).
   - **Pengecualian Sadar terhadap ADR-0017 (`Background Alert Engine`):** `Crypto Macro Index` dikecualikan dari `Background Alert Engine`, polling Watchlist latar belakang, dan live preview `Ctrl+K` selama grafiknya tidak sedang terbuka (UI hanya membaca cache memori atau `-`). Seluruh simbol non-indeks (bursa kripto, Yahoo Finance, custom feed) tidak terpengaruh sama sekali.
4. **Routing, Visual Sumbu `64px`, & Guard Non-Tradable:**
   - Mendaftarkan provider ID `macro` sebagai konteks dinamis per sel (`setActiveProviderContext`) di `Dynamic Feeder Context` tanpa pernah menimpa provider global aktif (`is_active`) pada SQLite maupun menampilkannya di pengalih bursa global `FeedTab.svelte`. Simbol berawalan eksplisit seperti `custom:TOTAL` tetap terisolasi penuh pada namespace asalnya dan terpisah dari `macro:TOTAL`.
   - Menyediakan kategori terpisah `Makro Kripto` (`type: 'index'`) di `SymbolSearchModal`, monogram offline khusus tanpa lookup CDN atau dual-badge `USDT`, serta lencana transparan `SYNTHETIC (~1Y)` / `MACRO SYNTHETIC (~1Y)` (lengkap dengan tooltip `title` batas akurasi) di `Header`, `StatusBar`, dan `SymbolSearchModal`.
   - Mengaktifkan mode format `T`/`B`/`%` secara terisolasi per sel melalui wrapper runtime non-invasif `macroVelaAxisAdapter` (`priceAxisTicks`, `dataWindowFmt`, `crosshairLayer.chip`, dan `chrome.drawPriceLineAndCountdown` dengan kontras teks WCAG dari `resolveContrastTextColor` dan formatter tunggal `formatMacroCompactValue`), berevolusi dari konsep awal patch `node_modules/@luxalgo/vela` agar dependensi pihak ketiga tetap utuh.
   - Menyesuaikan `priceScaleLabelService.ts`, `chartSnapshotService.ts`, `alertFormHelper.ts` (termasuk parsing input ringkas suffix `T`/`B`/`M` + petunjuk `.macro-scope-hint` di `CreateAlertModal.svelte` guna membantu trader menyetel target Triliun/Miliar dan memahami cakupan alert aktif-only), serta `getAdaptiveTickSize` (`priceSnapService.ts`) memakai langkah tick adaptif berbasis magnitudo (`$1B` untuk rentang Triliun, `$100M` untuk puluhan/ratusan Miliar, dan `0.01` untuk indeks `%`).
   - Melindungi parser `parseAdaptiveSymbol` / `resolveCanonicalInstrumentSymbol` dari injeksi default `USDT`/`.P`, serta menyembunyikan `Native Volume Overlay` otomatis pada sel indeks sambil memulihkan preferensi volume user saat berpindah ke simbol reguler.

## Catatan Arsitektur & Kompromi terhadap ADR-0003 (§2.B Pembagian Stack)
- **Konflik Sadar (*Tracked Deviation*):** `ADR-0003` menetapkan pembagian peran agar I/O jaringan dan komputasi berat berada di Rust (Tauri v2 Core) sedangkan TypeScript frontend berperan sebagai *thin presentation layer*. Pada implementasi awal ini, koordinator jaringan feeder dan kalkulasi matematis basket (`macroBasketMath.ts` + `macroBasketCoordinator.ts`) berada di layer TypeScript frontend (via `universalFetch`), sedangkan Rust Core berperan pada persistensi cache SQLite lokal (`load_cached_candles` / `store_cached_candles`).
- **Alasan & Kontrol Risiko:** Menempatkan agregasi basket ~30 koin di frontend TypeScript mempercepat iterasi kalibrasi komposit, penggunaan ulang `resampleCandles` & `SymbolSearchEngine`, dan pembatalan request berbasis `AbortSignal` per sel tanpa menambah crate HTTP parsing tambahan (< 20 MB installer budget `ADR-0003`), sementara batas eksekusi dijaga ringan lewat worker pool `maxConcurrentKlines = 6` yang hanya hidup saat sel makro terbuka (ram/CPU nol di latar belakang). Pemindahan mesin sintesis ke Rust IPC tetap menjadi opsi optimasi apabila jumlah konstituen atau frekuensi *tick* diperluas jauh di atas 30 koin.

## Konsekuensi
- **Positif:**
  - `trawangan` memperoleh dukungan `TOTAL`, `TOTAL2`, `TOTAL3`, `OTHERS`, `BTC.D`, `ETH.D`, dan `USDT.D` 100% gratis tanpa API key, tanpa server middleware, dan sepenuhnya memakai API publik resmi.
  - Nol konsumsi jaringan dan CPU di latar belakang saat pengguna hanya menganalisis instrumen bursa reguler.
  - Nilai Pine Script v6, Alert pada chart aktif, dan Drawing Tools tetap konsisten pada satuan USD dan persen asli.
- **Pertimbangan & Batas Akurasi:**
  - Nilai basket sintetis merupakan aproksimasi struktural: akurat untuk pergerakan harga jangka pendek-menengah (`15m`-`1D` modern), namun memiliki selisih *long-tail* di luar Top-30 sebelum kalibrasi, *supply drift* multi-tahun bagi token berinflasi di luar stablecoin, dan *wick* High/Low agregat yang sedikit lebih lebar. Hal ini disampaikan secara eksplisit melalui lencana `SYNTHETIC (~1Y)`.
  - Adapter runtime `macroVelaAxisAdapter` membungkus hook instance `@luxalgo/vela` secara non-invasif; kompatibilitas tanda tangan renderer tetap perlu diverifikasi apabila memperbarui versi paket `@luxalgo/vela` di masa mendatang.
