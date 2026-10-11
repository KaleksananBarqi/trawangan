# Changelog

Semua perubahan penting pada proyek **trawangan** didokumentasikan di berkas ini.
Format penulisan mengacu pada standar [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan proyek ini mematuhi prinsip [Semantic Versioning](https://semver.org/lang/id/).

---

## [0.3.0] - 2026-10-11

### 🚀 Ditambahkan (Added)
- **Multi-Chart Layouts & Grid Selector:**
  - Menu pemilihan tata letak grid multi-chart interaktif (`WorkspaceLayoutMenu.svelte`, `LayoutGridSelector.svelte`) dengan visualisasi live preview: 1 Single Chart, 2 Split Horizontal, 2 Split Vertikal, 3 Grid (1 Besar + 2 Kecil), dan 4 Grid (2x2 Quad).
  - Alur pergantian layout mulus dengan retensi state simbol dan interval pada panel yang sedang terfokus.
- **Auto-Clone & Rekonsiliasi Indikator Lintas Panel:**
  - **Auto-Clone Indikator saat Ekspansi Layout:** Panel/cell baru otomatis menduplikasi dan mewarisi seluruh konfigurasi indikator dari chart utama aktif ketika beralih ke mode multi-chart.
  - **Rekonsiliasi Indikator Otomatis:** Menyelaraskan seluruh follower cell dengan chart induk saat sinkronisasi indikator diaktifkan kembali.
  - **Kontrol Sinkronisasi Independen:** Pengaturan terpisah untuk Toggle Kursor Crosshair (`syncCursor`) dan Toggle Viewport Range (`syncViewport`).
- **Persistensi Pengaturan Lilin & Fitur "Simpan sebagai Default":**
  - Opsi *"Simpan sebagai Default"* dan *"Reset ke Default"* pada dialog konfigurasi lilin VelaChart (warna lilin bullish/bearish, border, wick, background canvas, grid line).
  - Penyimpanan preferensi offline di SQLite lokal dan storage adapter sehingga kustomisasi lilin tetap awet saat aplikasi dimulai ulang atau beralih simbol.
- **Pusat Bantuan Shortcut Keyboard & Navigasi Cepat:**
  - Tab "Shortcut" interaktif pada modal Pengaturan (`SettingsModal.svelte`) yang merangkum seluruh tombol pintas terminal (Navigasi simbol, Timeframe, Toggle Pine IDE, Fullscreen, Drawing tools).
- **SEO & Web Indexing Metadata di Landing Page:**
  - Penambahan `sitemap.xml`, `robots.txt`, verifikasi Google Search Console, URL kanonikal, serta schema terstruktur JSON-LD `SoftwareApplication` di `docs/index.html`.
- **Pengembangan Test Suite (Total 47 Unit Tests Passing):**
  - Penambahan 9 unit test baru: `tests/multiChartSync.test.ts` (8 skenario komprehensif menguji auto-clone indikator, rekonsiliasi, kursor eksternal, dan integrasi setting Vela) serta pengujian persistensi default grafik.

### 🔄 Diubah (Changed)
- **Pemisahan Modular Header & Titlebar:**
  - Dekomposisi titlebar header menjadi submodul mandiri (`ActionsMenu.svelte`) serta pemisahan pemilih grid tata letak ke dalam popover grid khusus yang ergonomis.
- **Peningkatan Manajemen Memori Pine IDE & Indikator:**
  - Pencegahan memory leak dan instance stacking saat skrip indikator diperbarui atau dihapus berkali-kali pada kanvas VelaChart.
  - Mode docking Pine IDE side panel dengan pembatasan lebar aman (340px - 850px) dan eliminasi efek circular reactivity.
- **Responsivitas Interaksi Kanvas VelaChart:**
  - Optimalisasi event handling menu klik kanan (Chart Context Menu) dengan ambang batas jitter mouse agar tidak memicu panning grafik.

### 🐛 Diperbaiki (Fixed)
- **Pencegahan Layar Putih (Blank Screen) Pasca-Build:**
  - Penambahan background dasar gelap inline `#0F0F0F` di `src/app.html` dan visualizer darurat runtime untuk mencegah tampilan blank saat startup Windows WebView2.
  - Pengaktifan fitur `"devtools"` pada konfigurasi Tauri untuk mempermudah audit devtools jika diperlukan.
- **Sinkronisasi Reaktif Workspace:**
  - Perbaikan alur clean-slate load workspace dan penanganan overwrite saat auto-save tata letak grafik.

---

## [0.2.0] - 2026-10-10

### 🚀 Ditambahkan (Added)
- **Landing Page Mandiri di `docs/`:**
  - Halaman showcase modern (`index.html`, `style.css`, `app.js`) dengan arsitektur mandiri yang siap disajikan langsung via GitHub Pages.
  - Deteksi sistem operasi pengunjung (Client OS Detection) otomatis untuk tombol CTA unduh installer (`.exe`, `.dmg`, `.AppImage`).
  - Galeri interaktif dengan live screenshot tabs (Terminal Charting, Pine Editor, Preset Multi-Tema).
  - Tabel komparasi fitur eksplisit *Zero-Paywall Parity* vs platform komersial berbayar.
- **Aset Visual & Brand Identity:**
  - Banner hero resmi [`banner.png`](static/banner.png) beresolusi tinggi dengan skema warna signature.
  - Logo monogram `tr` dalam varian SVG (`logo-full.svg`, `logo-icon.svg`, `no background.svg`) dan icon multi-resolusi.
  - Screenshot antarmuka asli di `static/screenshots/` (`main.png`, `pinescript.png`, `about.png`).
- **Dokumentasi & Standar Arsitektur:**
  - [ADR 0002](docs/adr/0002-distribution-and-landing-page-strategy.md): Keputusan strategi distribusi biner via GitHub Releases dan hosting landing page mandiri via GitHub Pages.
  - [ADR 0001](docs/adr/0001-brand-identity-and-theming-system.md): Standarisasi identitas brand, tema bawaan, dan batasan ruang lingkup *Pure Charting Scope*.
  - [GLOSSARY.md](GLOSSARY.md): Kamus domain bahasa resmi (*Penerawangan*, *Zero-Paywall Parity*, *Theme Preset*).
- **Fitur Charting & Modul Inti:**
  - **Multi-Chart Synchronization Engine:** Sinkronisasi kursor crosshair dan viewport lilin lintas multi-panel kanvas.
  - **Deep Telemetry Module:** Pemantauan real-time latensi jaringan multi-provider (Binance, Bitunix, Hyperliquid), FPS WebGL2, dan konsumsi memori.
  - **Deep Replay Session:** Mode simulasi pemutaran pergerakan candle bar-by-bar untuk pengujian strategi historis.
  - **Penyimpanan Offline SQLite Lokal:** Manajemen penyimpanan drawing tools, watchlist, dan konfigurasi chart di layer Rust tanpa pelacak cloud.
  - **Preset Multi-Tema:** Penambahan tema *Signature Cyber-Monochrome* (`#0F0F0F` + `#FF69B4`), Binance Classic, Bitunix Neon, TradingView Pro, dan Coinglass Dark.
  - **Unit Test Suite:** Penambahan 38 unit test menyeluruh yang memvalidasi integritas persistensi, telemetri, sinkronisasi chart, dan tema.

### 🔄 Diubah (Changed)
- **Perombakan Total `README.md`:** Menambahkan banner visual, badge status ekosistem, tabel komparasi fitur transparan, ulasan filosofis budaya Jawa *Penerawangan* (ꦠꦿꦮꦔꦤ꧀), serta panduan pengembang lokal dan rilis.
- **Penyelarasan Workflow Rilis (`.github/workflows/release.yml`):**
  - Standarisasi penulisan nama brand menjadi huruf kecil `release trawangan` dan `trawangan <tag>`.
  - Format `releaseBody` otomatis yang kaya informasi, memuat ringkasan fitur tanpa paywall dan petunjuk unduhan biner per OS.
- **Refactoring Header & Titlebar:** Memecah komponen titlebar monolitik menjadi sub-komponen terpisah dengan batas antarmuka yang bersih.
- **Market Feed Adapters:** Peningkatan modularitas subscription WebSocket dan REST fallback multi-exchange.

---

## [0.1.0] - 2026-10-09

### 🚀 Ditambahkan (Added)
- Rilis perdana fondasi shell desktop native berbasis Tauri v2 (Rust) dan Svelte 5 (Runes).
- Integrasi kanvas WebGL2 LuxAlgo Vela Charting Engine untuk rendering candlestick berkecepatan tinggi.
- Integrasi PineTS v6 Web Worker untuk eksekusi skrip indikator Pine Script di lingkungan terisolasi.
- Alur CI/CD GitHub Actions matrix awal untuk build multi-platform otomatis (Windows, Linux, macOS).
