# Changelog

Semua perubahan penting pada proyek **trawangan** didokumentasikan di berkas ini.
Format penulisan mengacu pada standar [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan proyek ini mematuhi prinsip [Semantic Versioning](https://semver.org/lang/id/).

---

## [0.5.0] - 2026-10-11

### 🚀 Ditambahkan (Added)
- **Timeframe Adapter & Standardisasi Timeframe TradingView (`src/lib/utils/timeframeAdapter.ts`):**
  - Modul konversi dua arah (`toVelaTimeframe` dan `fromVelaTimeframe`) yang menjamin konsistensi representasi timeframe antara antarmuka TradingView, engine Vela, dan REST API bursa.
  - Memperbaiki bug kritis di mana timeframe bulanan (`1M`) tertukar menjadi 1 menit (`1m`) di engine Vela karena sensitivitas huruf kapital.
  - Pemetaan otomatis parameter interval query API klines untuk Binance dan Bitunix Futures (`toExchangeInterval`).
- **Kalkulator Rentang Historis Bar Replay & Lilin On-Demand (`src/lib/services/replay/historicalRange.ts`):**
  - Mesin kalkulasi window epoch (`calculateHistoricalWindow`, `getTimeframeDurationMs`) untuk mengunduh candle masa lampau saat pengguna memilih tanggal di luar batas lilin aktif di kanvas grafik.
  - Status pemuatan baru `loading` pada sesi replay dengan indikator visual animasi *pulse dot* (`loading-stream-badge`) di bilah kontrol ReplayBar.
  - Penghapusan limitasi pemilih tanggal di modal Replay (`ReplayDatePickerModal.svelte`), memungkinkan navigasi tanggal historis secara bebas dengan otomatisasi streaming.
- **Persistensi Workspace Terakhir saat Startup (`src/lib/services/persistence/workspaceService.ts`):**
  - Penambahan opsi preferensi `autoLoadLastWorkspace` pada `AppSettings` (aktif secara default).
  - Penyimpanan ID workspace aktif terakhir (`trawangan_last_workspace_id`) dan pemuatan otomatis layout, chart, dan indikator saat aplikasi di-boot.
  - Integrasi sakelar konfigurasi pada Tab Grafik di modal pengaturan (`SettingsModal.svelte`).
- **Resilient Error Diagnostic Overlay (`src/app.html`):**
  - Dialog pelaporan kesalahan runtime dan unhandled promise rejection bergaya *Obsidian Precision Terminal*.
  - Dilengkapi tombol cepat *Salin Log* ke clipboard dan shortcut penutup <kbd>Esc</kbd> untuk kemudahan pelaporan bug dan stabilitas pengguna.
- **Pengembangan Test Suite (Total 64 Passing Tests):**
  - Penambahan unit test baru di `tests/timeframeAdapter.test.ts`, `tests/replayHistoricalRange.test.ts`, dan `tests/workspacePersistence.test.ts`.

### 🔄 Diubah (Changed)
- **Penyelarasan Sinkronisasi Cell Timeframe:**
  - Pembaruan `Chart.svelte` untuk menyelaraskan perubahan timeframe cell dengan adapter Vela tanpa loop reaktivitas berulang.
- **Automasi CI/CD & Ekstraksi Catatan Rilis:**
  - Penambahan helper `scripts/extract-changelog.cjs` dan workflow skill `/release` untuk rilis otomatis dan deterministik ke GitHub.

---

## [0.4.0] - 2026-10-11

### 🚀 Ditambahkan (Added)
- **Sistem In-App Update Terpadu & SemVer Comparator:**
  - Modul layanan terpusat `src/lib/services/updateService.ts` untuk memeriksa ketersediaan rilis desktop terbaru langsung dari GitHub Releases API tanpa perantara.
  - Komparator SemVer matematis (`compareSemver`) yang presisi untuk membandingkan versi lokal terpasang dengan versi rilis remote.
  - Deteksi platform sistem operasi otomatis (`detectPlatform`) yang menyajikan tautan unduhan langsung untuk installer biner yang sesuai (.exe/.msi Windows, .dmg macOS, .AppImage/.deb Linux).
  - Tampilan kartu pembaruan dinamis (*Dynamic Update Card*) pada Tab Tentang di modal pengaturan: menampilkan perbandingan versi, tanggal rilis, ringkasan catatan rilis (*release notes*), serta tombol unduh installer langsung.
  - Pengecekan otomatis di latar belakang (*silent check*) 3 detik pasca-boot aplikasi dengan indikator pembaruan non-intrusif di Titlebar Header dan StatusBar.
- **Pusat Sumber Kebenaran Versi Terpusat (`src/lib/config/version.ts`):**
  - Variabel versi tunggal (`APP_VERSION`, `APP_NAME`, `APP_RELEASE_TAG`) yang tersinkronisasi langsung dari `package.json`.
  - Integrasi runtime Tauri API (`@tauri-apps/api/app`) untuk membaca versi native desktop dengan fallback otomatis ke konfigurasi terpusat.
- **Arsitektur ADR 0003: Core Architecture & Lightweight Guardrails:**
  - Perumusan dokumen arsitektur resmi [ADR 0003](docs/adr/0003-core-architecture-and-lightweight-guardrails.md) yang mengunci standar performa terminal desktop ultra-ringan (~30-50 MB RAM), isolasi state, dan tata kelola modularitas.
- **Perluasan Unit Test Suite (Total 53 Passing Tests):**
  - Penambahan unit test baru di `tests/updateService.test.ts` untuk memverifikasi logika komparasi SemVer, deteksi OS, dan integritas format `APP_VERSION`.

### 🔄 Diubah (Changed)
- **Standardisasi Galeri Showcase & Sinkronisasi Aset:**
  - Pembaruan 4 set tangkapan layar antarmuka resolusi tinggi: Terminal Charting Utama (`main.png`), Pine Script v6 Editor (`pine-editor.png`), Pengaturan Terminal & Data Feed (`setting.png`), dan Tentang / Preset Tema (`about.png`).
  - Sinkronisasi galeri 4 tab interaktif pada showcase landing page (`docs/index.html`) dan `README.md`.
  - Penghapusan versi statis hardcoded pada landing page publik agar tombol unduh dan CTA selalu relevan tanpa perlu diedit manual di setiap rilis.

---

## [0.3.1] - 2026-10-11

### 🚀 Ditambahkan (Added)
- **Persistensi Penuh Konfigurasi Multi-Chart:**
  - Konfigurasi sinkronisasi multi-chart (`syncConfig`: crosshair, viewport, symbol, drawings, indicators) kini otomatis tersimpan di `localStorage` dan dipulihkan kembali saat aplikasi dibuka ulang melalui helper `resolveAppSettings`.
  - Integrasi dua arah: pengubahan toggle sinkronisasi di bilah header maupun di dialog pengaturan langsung menyinkronkan memori dan penyimpanan secara persisten.
- **Seksi Baru Pengaturan Workspace & Multi-Chart:**
  - Penambahan seksi *"Perilaku Workspace & Sinkronisasi Multi-Chart"* pada Tab Grafik di modal pengaturan (`SettingsModal.svelte`).
  - Toggle terpusat untuk Auto-Save Workspace otomatis yang tersinkronisasi dua arah dengan header.
  - 5 kartu toggle kontrol bawaan sinkronisasi multi-chart (Kursor Crosshair, Gerakan Waktu Viewport, Simbol Pasar/Pair, Objek Gambar, dan Duplikasi Indikator).
- **Kebijakan Timeframe Bawaan pada Layout Split/Grid:**
  - Penerapan `defaultTimeframe` otomatis ke setiap cell/panel baru yang di-generate pada layout grid (`applyLayoutTimeframePolicy`).
  - Chart aktif yang sedang dianalisis tetap mempertahankan timeframe berjalan pengguna tanpa ter-reset.
- **Pengembangan Test Suite (Total 50 Unit Tests Passing):**
  - Penambahan pengujian unit komprehensif di `tests/persistence.test.ts` (uji persistensi `syncConfig` & `autoSaveWorkspace`) dan `tests/multiChartSync.test.ts` (uji alokasi timeframe cell baru layout grid).

### 🔄 Diubah (Changed)
- **Rebalancing UI Header: Tombol Langsung Indikator:**
  - Tombol aksi Alert di bilah kanan header digantikan langsung dengan tombol **Indikator** (`<Layers />`, label `Indikator`, dan badge jumlah indikator aktif `count-badge`) yang membuka perpustakaan indikator Pine Script v6 secara instan.
  - Tombol aksi pembuatan **Price Alert** dipindahkan ke slot pertama menu dropdown *Actions* (`ActionsMenu.svelte`) lengkap dengan label shortcut `Alt+A` dan tetap terintegrasi via panel samping dan klik kanan kanvas grafik.

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
