# trawangan Domain Glossary

trawangan adalah aplikasi desktop native ultra-ringan untuk analisis teknikal, charting kripto multi-provider, dan eksekusi Pine Script v6 tanpa paywall.

## Core Language

**trawangan**:
Terminal charting pasar kripto berbasis desktop (Tauri v2 + WebGL2) yang berfokus murni pada analisis teknikal, visualisasi grafik, dan pengujian strategi. Ditulis dengan huruf kecil.
_Avoid_: Trawangan, TRAWANGAN, Exchange, Broker, Trading Platform

**Penerawangan**:
Filosofi inti produk yang diambil dari bahasa Jawa (ꦠꦿꦮꦔꦤ꧀), merujuk pada kapabilitas trader untuk melihat menembus kabut manipulasi dan kebisingan pasar melalui visualisasi data presisi.
_Avoid_: Spekulasi, Tebak-tebakan

**Pure Charting Scope**:
Batasan produk pada fase awal yang memprioritaskan fitur analisis grafik, indikator, drawing, dan backtesting Pine Script, tanpa integrasi eksekusi order trading atau penempatan modal secara langsung.
_Avoid_: Automated trading bot, Brokerage connectivity, Order execution

**Theme Preset**:
Paket konfigurasi visual yang mengatur skema warna kanvas, garis grid, tipografi, serta warna badan, batas, dan sumbu candlestick.
_Avoid_: Skin, Template

**Signature Palette**:
Palet warna default trawangan yang menggunakan latar belakang ultra-gelap (`#0F0F0F`), candlestick bullish putih gading (`#F7F7F7`), dan candlestick bearish serta aksen brand hot pink (`#FF69B4`).
_Avoid_: Green/Red default, Normal theme

**Brand Typography**:
Standar tipografi identitas nama brand `trawangan` yang menggunakan font *Plus Jakarta Sans Extra Bold* (weight 800) untuk mencerminkan proporsi geometris logo monogram.
_Avoid_: Generic sans-serif, Serif, All-caps styling

**Zero-Paywall Parity**:
Prinsip penyediaan kapabilitas analisis teknikal tingkat lanjut—termasuk jumlah indikator aktif tanpa batas pada satu kanvas, watchlist kustom tanpa kuota, dan eksekusi Pine Script v6 lokal—tanpa pungutan biaya langganan atau restriksi fitur berbayar.
_Avoid_: Freemium, Trial period, Paywalled indicators

**Docked Structural Shell**:
Pola tata letak antarmuka di mana bilah alat gambar kiri dan bilah widget kanan terpasang secara struktural pada tepi jendela aplikasi, bukan sebagai widget yang melayang di atas kanvas candlestick.
_Avoid_: Floating toolbar overlay, Floating tool pill

**Right Dock Rail**:
Bilah rel ikon vertikal permanen di sisi kanan layar untuk navigasi instan satu klik antara Watchlist, Price Alerts, Object Tree, dan Pine IDE.
_Avoid_: Floating panel button, Rotating label button, Collapsed panel toggle

**Pane Proportion**:
Rasio vertikal antara kanvas grafik lilin utama dan sub-pane indikator osilator di bawahnya yang diatur via bilah pemisah dan tersimpan di workspace.
_Avoid_: Panel split ratio, Chart height percent

**Feed Connection Guard**:
Subsistem pengawas konektivitas data feed yang mendeteksi kegagalan jaringan atau pemblokiran ISP secara proaktif dan menyediakan mekanisme pengalihan bursa cadangan.
_Avoid_: Network monitor, Error catcher

**Multi-Quote Pair**:
Pasangan perdagangan aset kripto dengan berbagai mata uang kuotasi (seperti IDR, USDT, USD) yang dapat dicari dan dianalisis lintas bursa.
_Avoid_: Fiat pair, Non-USDT pair

**Omni-Search Watchlist**:
Bilah input pintar pada bilah sisi Watchlist yang menyatukan penyaringan instrumen lokal tersimpan dengan eksplorasi instrumen global bursa multi-provider secara real-time.
_Avoid_: Local filter only, Disconnected search modal

**Draggable Alert Line**:
Garis visual horizontal penanda sinyal batas harga pada kanvas grafik yang dapat digeser (drag-and-drop) secara interaktif untuk memperbarui level target harga secara instan tanpa dialog modal.
_Avoid_: Static alert line, Read-only alert badge

**OHLC Magnet Snapping**:
Mekanisme penambatan koordinat harga interaktif (pada garis alert dan alat gambar Long/Short) secara otomatis ke level Open, High, Low, atau Close lilin candlestick terdekat saat kursor berada dalam radius ambang toleransi.
_Avoid_: Freeform floating price, Unsnapped drag, Raw pixel coordinate

**Tick-Aligned Price Guard**:
Mekanisme pembulatan dan sanitasi harga otomatis yang menjamin seluruh penempatan target alert dan titik pengukuran posisi Long/Short selalu selaras dengan kelipatan ukuran tick (*tick size*) instrumen bursa aktif, mengeliminasi angka desimal acak yang berlebihan.
_Avoid_: Arbitrary float precision, Infinite decimal prices, Raw float coordinate

**Persistent Price Line Guard**:
Mekanisme pertahanan di subsistem grafik yang menjamin garis harga terkini (last price line) tetap aktif dan terhindar dari reset senyap saat mutasi konfigurasi kanvas, pergantian timeframe, atau perubahan tata letak sel.
_Avoid_: Disappearing price line, Flaky last price

**Type-to-Search Canvas Guard**:
Kapabilitas deteksi keystroke alfanumerik instan langsung pada kanvas grafik yang memicu pembukaan modal pencarian simbol dengan karakter pertama terisi otomatis (meniru ergonomi standar TradingView) tanpa harus menekan kombinasi `Ctrl+K`.
_Avoid_: Modal shortcut only, Hidden search trigger

**Chart Timezone Sync**:
Mekanisme transmisi preferensi zona waktu pengguna (default `Asia/Jakarta` UTC+7) secara reaktif ke seluruh sel WebGL2 kanvas grafik Vela dan sumbu waktu horizontal lilin.
_Avoid_: Static UTC chart, Disconnected timezone

**Adaptive UI Typography Scale**:
Sistem penskalaan visual antarmuka terminal modular berbasis faktor `--font-scale` yang menjamin seluruh panel, label instrumen, dan skala sumbu harga membesar/mengecil secara seragam sesuai konfigurasi kerapatan layar.
_Avoid_: Fixed pixel text, Rigid layout

**Hand-Pull Pan Mode**:
Mode navigasi grafik interaktif yang mengubah kursor menjadi tangan cengkeram (`grab`/`grabbing`) dan mengisolasi gestur geser kanvas sepenuhnya dari manipulasi atau seleksi titik jangkar objek gambar.
_Avoid_: Canvas scroll mode, Dragging tool, Screen pan

**Zero-Omission Drawing Suite**:
Prinsip penyediaan 100% seluruh 68 varian alat gambar analitikal dan utilitas bawaan engine Vela secara lengkap di bilah alat gambar Trawangan tanpa pengurangan fitur.
_Avoid_: Partial toolset, Basic drawing kit, Reduced tools

**Exchange-Aware Drawing Isolation**:
Prinsip pengisolasian layer coretan gambar teknikal secara mutlak pada kombinasi bursa dan simbol (`providerId:symbol`), menjamin analisis pada satu bursa tidak mencemari kanvas bursa lain.
_Avoid_: Global drawing layer, Shared exchange shapes, Mixed canvas drawings

**Exchange-Aware Watchlist**:
Format entitas daftar pantau instrumen yang mengikat bursa asal (`providerId:symbol`), memungkinkan pemantauan instrumen yang sama dari berbagai bursa secara berdampingan tanpa saling menimpa.
_Avoid_: Raw symbol watchlist, Single exchange watchlist

**Multi-Provider Watchlist Polling Multiplexer**:
Mekanisme polling harga berkala pada daftar pantau yang secara otomatis mengelompokkan instrumen per bursa asal dan menyalurkannya ke adapter yang tepat, mencegah kegagalan polling palsu (*Network Error/Stalled Feed*).
_Avoid_: Uniform provider polling, Misrouted feed request

**Unified Object Tree**:
Panel hierarki terpadu pada bilah dock kanan terminal trawangan yang memvisualisasikan layer indikator aktif dan seluruh objek coretan gambar teknikal dengan kontrol visibilitas individual, penguncian, penyorotan dua arah kanvas, serta konfigurasi parameter.
_Avoid_: Split indicator list, Floating drawing manager, Disconnected layers

**Chart Deep Link Bridge**:
Subsistem penangkap tautan platform charting eksternal (TradingView, Binance, Bybit) berbasis skema URI native `trawangan://` dan skrip browser pendamping (*companion script*) yang mengekstraksi bursa serta simbol untuk diarahkan langsung ke chart trawangan.
_Avoid_: External link scraper, Browser tab sniffer, Manual symbol re-entry

**Smart Clipboard Watcher**:
Modul pengawas papan klip lokal pada trawangan yang secara aman dan pasif mendeteksi penyalinan URL platform charting kripto serta menampilkan notifikasi toast konfirmasi cepat untuk membuka simbol terkait dalam 1 klik.
_Avoid_: Aggressive clipboard hijacker, Silent auto-navigating watcher

**Multi-Provider Fallback Routing**:
Mekanisme resolusi data feed yang memprioritaskan bursa sumber dari tautan eksternal (misal Binance), dan secara cerdas mengalihkan ke bursa cadangan terbaik (Bitunix, Indodax, Bybit) jika bursa asal tidak menyediakan instrumen tersebut.
_Avoid_: Hard failing feed, Blank chart error

**Multi-Watchlist Registry**:
Mekanisme pengelolaan banyak daftar pantau independen dalam satu terminal, memungkinkan pengguna mengisolasi konteks analisis (seperti Portofolio Spot, Futures Scalp, Altcoin Ecosystem, dan Indodax IDR) via bilah popover selektor tanpa risiko data saling menimpa.
_Avoid_: Single global watchlist, Overwriting preset lists

**Watchlist Section Divider**:
Baris penanda kategori struktural di dalam sebuah daftar pantau yang mengelompokkan instrumen sejenis, mendukung status lipat/bentang (*collapse/expand*), dan secara otomatis diabaikan oleh subsistem polling pasar agar tidak memicu permintaan ticker palsu.
_Avoid_: Fake ticker row, Hardcoded section, Flat uncategorized list

**Native Volume Overlay**:
Visualisasi histogram volume berbasis WebGL2 yang di-render langsung di sub-lapisan dasar kanvas harga utama oleh engine grafik tanpa alokasi thread worker Pine Script tambahan, menghasilkan pembacaan likuiditas ultra-efisien 60 FPS.
_Avoid_: Scripted volume panel, Detached volume sub-pane, Heavy volume worker

**Session VWAP**:
Indikator analisis teknikal berbasis Pine Script yang menghitung rata-rata harga terbobot volume kumulatif dengan mekanisme *reset* otomatis pada awal sesi hari perdagangan bursa (exchange timezone), dilengkapi pita deviasi standar untuk membaca batas nilai wajar institusional.
_Avoid_: Rolling VWAP, Fixed-window moving average, Raw average price

**Hybrid Asset Logo Engine**:
Mesin resolusi visual identitas koin dengan strategi multi-tier (CDN cache publik, bundle lokal koin utama, dan monogram avatar bergradien warna) untuk memastikan setiap simbol selalu memiliki representasi visual tanpa risiko gambar rusak.
_Avoid_: Static icon pack, Broken image fallback, Missing coin icon

**Dual-Asset Badging**:
Pola visualisasi instrumen perdagangan di mana logo aset dasar (base asset) ditampilkan dominan dengan penanda mini logo aset kuotasi (quote asset) di sudut bawah, khususnya untuk pasangan kripto-ke-kripto atau non-USDT.
_Avoid_: Single coin badge, Merged text icon, Unbadged pair

**Adaptive Quote Parser**:
Mekanisme pemecahan simbol cerdas yang mengekstraksi base asset dan quote asset dari delimiter eksplisit maupun sufiks kuotasi yang dikenal (seperti USDT, IDR, BTC, USDC) tanpa memaksakan kuotasi default.
_Avoid_: Forced USDT affix, Rigid pair string, Hardcoded quote assumption

**Venue Capability Guard**:
Aturan validasi pasar yang membatasi pembuatan atau perutean jenis instrumen (seperti Spot vs Perpetual) sesuai dengan kontrak riil yang disediakan bursa asal.
_Avoid_: Blind perpetual routing, Synthetic contract 404, Fake perp symbol

**Crypto-Denominated Precision**:
Skema pemformatan harga dan label sumbu nilai dengan satuan mata uang kripto (seperti Satoshi / ₿) dan presisi dinamis hingga 8 desimal untuk pasangan perdagangan antar-kripto.
_Avoid_: Dollar-formatted crypto, Truncated satoshi, Fiat-only price scale

