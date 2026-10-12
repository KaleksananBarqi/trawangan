# Changelog

Semua perubahan penting pada proyek **trawangan** didokumentasikan di berkas ini.
Format penulisan mengacu pada standar [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan proyek ini mematuhi prinsip [Semantic Versioning](https://semver.org/lang/id/).

---

## [0.8.0] - 2026-10-12

### 🚀 Ditambahkan (Added)
- **Live Drag Real-Time Synchronization untuk Label Skala Harga Sumbu Kanan:**
  - Sinkronisasi dinamis 60 FPS pada badge harga posisi Risk/Reward (Long & Short) serta garis gambar saat anchor target atau stop digeser secara interaktif.
  - Nilai teks harga numerik dan koordinat vertikal (Y) bergerak sejajar dan menempel mulus pada gambar saat proses drag mouse berlangsung.
  - Pendaftaran event resmi engine Vela (`drawing:edited`, `drawing:draft`, `drawing:created`, `drawing:removed`, `drawing:settings`).
  - Mekanisme auto-save SQLite yang hemat I/O hanya saat mutasi selesai (pada `pointerup` / `drawing:edited`).
  - Peningkatan fungsi `formatPriceLabel` untuk presisi multi-desimal aset kripto mikro (< $1) tanpa pembulatan ke `$0.00`.
- **Capture-Phase Global Windows Keyboard Shortcut Dispatcher:**
  - Registrasi listener keyboard global pada `window` Capture Phase (`{ capture: true }`) dengan normalisasi kode fisik tombol (`e.code` dan `e.key`).
  - Menjamin hotkey esensial (`Alt+W`, `Alt+R`, `Alt+E`, `Alt+H`, `Alt+T`, `/`, `F11`, `Shift+F`, `Space`, timeframe chords) merespons seketika tanpa tertelan oleh kanvas WebGL Vela di OS Windows.
  - Dilengkapi *focus guard* yang aman agar tidak mengganggu pengetikan pada input, modal, atau editor Pine Script.
- **Kamus Data & Modal Glosarium Shortcut Keyboard (`F1` / `?`):**
  - Modal panduan interaktif baru (`src/lib/components/ShortcutCheatsheetModal.svelte`) dengan pencarian instan dan 30+ kombinasi tombol terorganisir rapi dalam 6 kategori kerja terminal.
- **Tombol & Shortcut Mundur 1 Bar pada Bar Replay:**
  - Menambahkan kapabilitas mundur 1 lilin (`stepBack`) pada sesi Bar Replay melalui tombol baru di `ReplayBar.svelte` dan shortcut <kbd>ArrowLeft</kbd>.

### 🐛 Diperbaiki (Fixed)
- **Resolusi Inversi Level & Warna Posisi Risk/Reward:**
  - Memperbaiki pemetaan indeks anchor posisi Vela sehingga Take Profit (TP) selalu konsisten berwarna hijau bullish (`#10b981`) dan Stop Loss (SL) selalu konsisten berwarna merah bearish (`#ef4444`) untuk posisi Long maupun Short.
- **Resolusi Badge Harga yang Membeku Saat Pan/Zoom:**
  - Menghubungkan kalkulasi koordinat `getPriceY()` ke event viewport (`wheel`, `pointermove`, `ResizeObserver`, `requestAnimationFrame`), sehingga badge selalu menempel sejajar saat kanvas grafik digeser atau di-zoom.

## [0.7.0] - 2026-10-12

### 🚀 Ditambahkan (Added)
- **Arsitektur UI/UX Docked Structural Shell (ADR 0004):**
  - **Docked Left Rail (44px) (`src/lib/components/DrawingToolbar.svelte`):**
    - Mengubah bilah alat gambar kiri dari komponen melayang (*floating overlay*) menjadi rel struktural *docked* (lebar 44px) yang mendorong kanvas WebGL2 ke kanan, menjamin lilin grafik (*candlestick wicks*) bersih dan tidak pernah tertutup oleh tombol toolbar.
    - Dilengkapi tombol *collapse* halus di footer rel dan shortcut keyboard global <kbd>Alt+T</kbd> melalui modul layanan baru `src/lib/services/leftToolbarService.ts`.
    - Bilah bintang favorit (*Draggable Floating Favorites Bar*) tetap melayang bebas di atas grafik untuk fleksibilitas pengguna.
  - **Permanent Right Dock Rail (38px) (`src/lib/components/RightDockRail.svelte`):**
    - Menghadirkan rel ikon vertikal permanen selebar 38px di tepi paling kanan jendela terminal, selaras dengan standar profesional TradingView.
    - Memuat kluster ikon 32x32px untuk navigasi cepat: Watchlist (Flame), Price Alerts (Bell + badge counter aktif), Object Tree/Layers (Layers + count indikator), Pine IDE shortcut toggle (Code), serta tombol hider chevron di bagian bawah.
  - **Layanan Manajemen State Rel Kanan (`src/lib/services/rightDockService.ts`):**
    - Mengelola status rel kanan (`isOpen`, `activeTab`, `lastOpenedTab`) dengan dukungan navigasi 1-klik untuk membuka/mengganti tab, *click-to-close* saat tab aktif diklik ulang, dan persistensi otomatis ke `localStorage`.
  - **Fixed Viewport-Clamped Flyout Submenu:**
    - Merekayasa ulang posisi submenu flyout alat gambar menggunakan `position: fixed` dengan `z-index: 1000` dan kalkulasi koordinat dinamis dari `getBoundingClientRect()`, membebaskan menu dari batasan pemotongan kontainer scroll (`overflow-y: auto`) sehingga seluruh 70+ alat gambar dapat dipilih dengan mudah.
- **Pengembangan Test Suite Komprehensif (Total 85 Passing Tests):**
    - Penambahan test suite `tests/leftToolbarDock.test.ts` (6 tests) untuk pengujian rel kiri, collapse, dan shortcut <kbd>Alt+T</kbd>.
    - Penambahan test suite `tests/rightDockService.test.ts` (8 tests) untuk pengujian siklus hidup dock rail kanan, click-to-close, canonical control seam, dan rapid multi-tab toggle.

### 🔄 Diubah (Changed)
- **Pembersihan Pusat Kendali Drawer Kanan:**
  - Menghapus tombol canggung melayang dengan teks berotasi `"PANEL"` pada `src/lib/components/WatchlistPanel.svelte`.
  - Menghapus tombol redundan `"Panel"` pada header bilah navigasi atas (`src/lib/components/Header.svelte`), memusatkan seluruh kontrol panel kanan secara kanonikal ke rel dock kanan.
- **Mempertahankan Nilai Inti Terminal Trawangan:**
  - Mempertahankan posisi Pine Script v6 IDE di sisi kanan berdampingan dengan grafik (*side-by-side*), sehingga tinggi vertikal kanvas chart tetap maksimal 100% untuk eksekusi visual strategi secara langsung.
  - Mempertahankan integritas bilah status telemetri ultra-ringan di footer (RAM, FPS, ping RTT, SQLite lokal).

### 🐛 Diperbaiki (Fixed)
- **Resolusi Runtime Error `effect_update_depth_exceeded` di Svelte 5:**
  - Mengganti sinkronisasi dua arah `$effect` pada `WatchlistPanel.svelte` dengan rumus reaktif murni `$derived(propActiveTab ?? internalTab)`.
  - Membungkus registrasi pembaruan feed awal pada `subscribeWatchlistTickers` dan `subscribeActiveTicker` dengan `untrack()` dari Svelte 5, mencegah emisi data cache sinkron memicu rekursi loop reaktif tanpa akhir.
- **Pembersihan Resize Recursion pada Chart:**
  - Menghapus pemanggilan redundan `window.dispatchEvent(resize)` di dalam ResizeObserver `src/lib/components/Chart.svelte` untuk mencegah cascading render loop pada kanvas WebGL2.

---

## [0.6.0] - 2026-10-11

### 🚀 Ditambahkan (Added)
- **Ekspansi 70+ Tools Gambar Teknikal Vela (`src/lib/services/drawingToolsService.ts`):**
  - Mendaftarkan dan mengelompokkan katalog lengkap 70+ tools gambar bawaan library LuxAlgo Vela ke dalam 7 kategori profesional:
    - *Garis & Ray:* Trendline, Ray, Horizontal Line/Ray, Extended Line, Vertical Line, Cross Line, Info Line, Trend Angle, Arrow.
    - *Saluran & Pitchfork:* Parallel Channel, Regression Channel, Flat Top/Bottom, Disjoint Channel, Andrews Pitchfork, Schiff Pitchfork, Modified Schiff, Inside Pitchfork.
    - *Fibonacci & Gann:* Fib Retracement, Extension, Fan, Timezones, Channel, Circles, Arcs, Wedge, Spiral, Gann Box/Square/Fan, Dedekind, Sonic Ratios, Supersonic.
    - *Pola Harmonik & Elliott Wave:* Elliott Impulse Wave (12345), Elliott Correction Wave (ABC), XABCD, ABCD, Head & Shoulders, Gartley, Bat, Butterfly, Crab, Shark, Cypher.
    - *Bentuk & Kuas:* Brush (Freehand Drawing), Highlighter (Stabilo), Polyline, Path, Box (Order Block / FVG), Rotated Rect, Circle, Ellipse, Triangle, Curve, Arc.
    - *Proyeksi, Pengukuran & Volume:* Risk/Reward Long/Short Position, Date & Price Range, Measure Ruler, Magnifier, Anchored VWAP, Fixed Range Volume Profile (FRVP).
    - *Teks & Anotasi:* Text Note, Callout, Sticky Note, Price Note, Comment, Price Label, Signpost, Bull/Bear Marker Arrows, Flags, Icon Stamp.
  - Perluasan skema tipe `DrawingToolType` di `src/lib/types/market.ts` agar kompatibel penuh dengan `@luxalgo/vela`.
- **Fitur Last Used Tool Memory:**
  - Toolbar secara adaptif mengingat tool terakhir yang dipilih dari setiap grup kategori dan otomatis mengganti ikon utama di bilah toolbar luar (`localStorage['trawangan_drawings_last_used']`).
- **Pencarian Cepat dalam Flyout (*Instant Search Filter*):**
  - Kolom input pencarian instan pada sub-menu flyout kategori untuk mempermudah pemilihan alat gambar dari puluhan opsi yang tersedia.
- **Sistem Favorit & Bilah Favorit Melayang Dinamis (*Draggable Floating Favorites Bar*):**
  - Tombol bintang (⭐) pada setiap item flyout untuk menandai tool favorit dengan persistensi ke `localStorage['trawangan_drawings_favorites']`.
  - Bilah mini toolbar horizontal melayang (*Floating Favorites Bar*) ala TradingView yang dapat di-drag & drop bebas ke posisi mana pun di monitor dengan proteksi *clamping* batas layar serta persistensi koordinat (`localStorage['trawangan_drawings_fav_pos']`).
- **Pengujian TDD Komprehensif (Total 71 Passing Tests):**
  - Pembuatan unit test suite baru `tests/drawingToolsService.test.ts` yang menguji katalog, metadata, shortcut, last-used memory, favorites management, search filter, dan kalkulasi batas drag floating bar.

### 🔄 Diubah (Changed)
- **Peningkatan UX Interaksi Toolbar (`src/lib/components/DrawingToolbar.svelte`):**
  - Memperbesar hitbox tombol panah kecil sub-menu (`sub-arrow-btn`) menjadi `14px × 14px` dengan highlight hover yang nyaman.
  - Dukungan interaksi Klik Kanan (`contextmenu`) pada seluruh tombol grup toolbar untuk langsung membuka flyout menu.
  - Mengklik ulang tombol grup yang sedang aktif langsung membuka menu flyout tools terkait.

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
