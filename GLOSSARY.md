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


