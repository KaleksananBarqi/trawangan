# Changelog

Semua perubahan penting pada proyek **trawangan** didokumentasikan di berkas ini.
Format penulisan mengacu pada standar [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan proyek ini mematuhi prinsip [Semantic Versioning](https://semver.org/lang/id/).

---

## [0.40.0] - 2026-11-09

### 🚀 Ditambahkan (Added)
- **Dukungan Multi-Aset Yahoo Finance & Dynamic Feeder Context (ADR-0021):**
  - **Integrasi Feed Multi-Aset Gratis:** Mendukung data pasar non-kripto gratis tanpa API key untuk Saham Indonesia/IDX (`*.JK`), Indeks Saham AS (`^IXIC`, `^NDX`, `QQQ`), dan Komoditas riil berdenominasi USD (`GC=F` Emas dan `SI=F` Perak).
  - **Dynamic Feeder Routing & Provider Context:** Pengalihan provider aktif secara otomatis mengikuti instrumen yang dipilih tanpa perlu konfigurasi manual di Pengaturan.
  - **Lencana Status Keterlambatan (Delayed 15M):** Penanda visual transparan `DELAYED 15M` pada Header dan Status Bar saat feed instrumen Yahoo aktif dengan pembatasan polling cerdas untuk mencegah rate limiting.
  - **Client-Side Candle Resampling:** Mesin resampling lilin otomatis untuk menghasilkan timeframe 2 Jam (2H) dan 4 Jam (4H) dari data basis 1 Jam Yahoo Finance.
  - **Symbol Aliasing Engine & Offline Registry Sub-10ms:** Pencarian cerdas alias simbol populer (`GOLD`/`XAUUSD` -> `GC=F`, `NASDAQ` -> `^IXIC`, `BBCA` -> `BBCA.JK`).
  - **Kategori Aset & Filter USD:** Tab navigasi kategori aset (`Semua Aset`, `Kripto`, `Saham Indo (IDX)`, `Komoditas & Indeks`) serta filter denominasi `USD ($)` pada modal pencarian simbol.

### 🐛 Diperbaiki (Fixed)
- **Multi-Pane Gesture Drawing pada Sub-Pane Indikator (Volume & Osilator):**
  - Mengatasi masalah di mana hasil gestur gambar teknikal (*draw by holding*) tidak muncul saat digambar di sub-pane bawah (Volume dan Stochastic Oscillator).
  - Menetapkan resolusi pane dinamis (`targetPaneId`) dan memproyeksikan anchors ke data-space sub-pane terkait secara presisi tanpa terpotong (*clipped out*).
  - Mengisolasi wick snapping hanya untuk lilin harga pada pane utama (`'price'`) dan mengaktifkan dukungan *scribble to erase* multi-pane.

## [0.39.0] - 2026-11-08

### 🚀 Ditambahkan (Added)
- **Modul Inti Identitas Instrumen Kanonikal & Venue Capability Guard (`instrumentIdentity.ts`):**
  - Titik tunggal kebenaran (SSOT) untuk parsing simbol, pemisahan base/quote/contractType, pembersihan sufiks derivatif (`.P`, `-PERP`, `PERP`), dan normalisasi delimiter (`[-_/]`).
  - Resolusi kunci penyimpanan gambar (`resolveDrawingStorageKey`) dan format simbol bursa Vela (`resolveVelaSymbolKey`) yang deterministik dan bebas inkonsistensi huruf besar/kecil.
  - Guard routing bursa otomatis (`routeVenueForSymbol`) yang menyatukan aturan penentuan bursa (Indodax untuk IDR, Bitunix untuk kontrak `.P`, Binance untuk USDT/USDC, Hyperliquid, dan Coinbase).
- **Mesin Lifecycle Workspace & Comprehensive Auto-Save Guard (`workspaceLifecycle.ts`):**
  - Pipeline pemuatan workspace terstruktur (`executeWorkspaceLoadPipeline`) dengan proteksi double-barrier clean-slate, pemulihan indikator Pine deterministik dengan inputs & props lengkap, restorasi skala harga & bobot pane, serta rekonstruksi rencana perdagangan (#116).
  - Koordinator auto-save ber-debounce (`WorkspaceAutoSaveCoordinator`) dengan dirty-checking komprehensif untuk mencegah race-condition I/O penyimpanan.
  - Perluasan polimorfik `computeWorkspaceFingerprint` di `workspaceService.ts` untuk melacak seluruh 15 dimensi state workspace (`paneWeights`, `priceScaleState`, `priceStyle`, `barSpacing`, `showVolume`, `activeRightDockPanel`, `syncConfig`, `activePlans`, `showThesisCards`).
- **Mesin Tema Terpadu & Memori Preset Kanvas Independen (`themeEngine.ts`):**
  - Intent reducer murni (`transitionThemeState`) dan perakit CSS bundle headless (`assembleThemeCssBundle`) untuk penanganan tema aplikasi dan kanvas chart.
  - Memori preset decoupled yang mempertahankan pilihan tema mode gelap (`activeDarkChartPreset`) dan mode terang (`activeLightChartPreset`) secara independen saat `syncChartWithAppTheme === false`.
- **Mesin Presentasi Kartu Tesis & Layout Kanvas 2D Terpadu (`thesisOverlayEngine.ts`):**
  - Penyatuan model data presentasi dan tata letak kanvas 2-pass antara kartu tesis apung (`FloatingThesisCard.svelte`), panel samping snapshot (`renderDedicatedThesisSidePanel`), dan snapshot kanvas langsung (`drawThesisCardOnCanvas`).
- **Modul Tata Kelola Rencana Perdagangan Mandiri (`tradingPlanLifecycle.ts`):**
  - Pemisahan siklus hidup rencana perdagangan, sinkronisasi alert otomatis, persistensi vault, dan kalkulasi risiko dinamis melalui abstraksi port/adapter `TradingPlanHostPort`.

### 🔄 Diubah (Changed)
- **Pembersihan Logika Imperatif & Timer Soup di `+page.svelte`:**
  - Mengeliminasi cascading timeouts acak (`setTimeout(150)`, `setTimeout(100)`, `setTimeout(600)`) pada pemuatan workspace dan menggantinya dengan pipeline terstruktur berbasis Promise.
  - Menyederhanakan penanganan siklus tema dari ~85 baris mutasi DOM ad-hoc menjadi pemanggilan deklaratif `applyThemeCssBundle()`.
- **Refactoring Antarmuka Pengaturan Tema (`AppearanceTab.svelte`):**
  - Mengganti perulangan fallback 6x manual saat menghapus preset pengguna dengan resolver transisi tema terpadu.

### 🐛 Diperbaiki (Fixed)
- **Penyelarasan Pencocokan Simbol pada Alert & Skala Harga:**
  - Menutup bug di mana alert yang dibuat pada simbol ber-prefix atau berformat non-standar (seperti `BINANCE:BTCUSDT`, `BTC-PERP`, atau `BTC/USDT`) gagal terpicu pada `alertService.ts` atau tidak muncul pada garis sumbu harga di `priceScaleOverlayController.ts`.
- **Pencegahan Silent State Loss pada Auto-Save Workspace:**
  - Menutup celah di mana perubahan pada `activePlans` (Multi-Target Trading Plans), bobot pane, atau skala harga diabaikan oleh auto-save guard karena tidak tercakup dalam perhitungan fingerprint sebelumnya.
- **Eliminasi Canvas Drag Drift pada Rencana Perdagangan Dual-Entry:**
  - Menutup bug pergeseran koordinat delta saat memindahkan kotak posisi Dual-Entry (E1 & E2) dan kotak Entry Zone di kanvas chart.
- **Konsistensi Visual Kartu Tesis pada Snapshot:**
  - Memulihkan pil level E1 & E2, lencana epistemik, dan skor konfluensi setup yang sebelumnya hilang pada beberapa mode rendering snapshot ultra-HD.

## [0.38.1] - 2026-11-06

### 🔄 Diubah (Changed)
- **Visualisasi Kotak Gambar Transparan 100% dengan Teks di Tengah Kanvas:**
  - Menyetel latar belakang seluruh kotak non-posisi (`type: 'box'`) menjadi 100% transparan (`fillColor: 'transparent'`), menghilangkan arsiran warna padat sehingga candlestick di belakangnya terlihat jernih dan bebas gangguan visual.
  - Mempertahankan garis border luar (`lineColor`) dengan ketebalan 1px yang tegas sesuai polaritas zona (hijau untuk *bullish*, merah muda untuk *bearish*, dan abu-abu untuk *neutral*).
  - Menyelaraskan teks label pada kotak Context Zone (FVG, OB, IDM, Supply, Demand) dan kotak proyeksi Entry Zone tepat di tengah-tengah area kotak secara horizontal maupun vertikal (`align: 'center'`, `halign: 'center'`, `valign: 'middle'`).
  - Menambahkan pengaman sanitasi pada `createDrawing` dan listener mutasi `handleDrawingMutated` pada `chartDrawingController.ts` agar seluruh gambar bertipe `box` (baik dari parsing plan, gesture recognition, maupun perkakas gambar manual) otomatis mengadopsi gaya transparan 100% dan teks di posisi tengah.
  - Mempertahankan visualisasi kotak posisi Long dan Short (`type: 'position'`) dengan warna latar rasio risiko/imbalan bawaan mesin grafik.

## [0.38.0] - 2026-11-05

### 🚀 Ditambahkan (Added)
- **Dukungan Skema Dual-Entry (E1 Aggressive & E2 Moderate) dan Blended Entry (ADR-0020):**
  - Mengurai struktur rencana perdagangan SMC v2 / Anti-Front-Run (`Render-1.md`) dengan dua level masuk terpisah: `Entry 1 (Aggressive)` (proximal edge POI dengan front-run buffer) dan `Entry 2 (Moderate)` (50% CE/MT atau area pasca-sapuan likuiditas IDM).
  - Ekstraksi bobot posisi per entri (misal `0.4` dan `0.6`) dari formula baris `Entry` atau persentase alokasi, serta perhitungan otomatis harga *Blended Entry* tertimbang jika baris Entry tidak dicantumkan.
  - Dukungan parsing R-multiple multi-acuan (`rMultipleByEntry`) untuk pelaporan R terpisah pada level Blended vs Entry 1.
  - Ekstraksi persentase risiko `riskPercent` (`1.20%`) dan skor konfluensi `confluenceScore` (`4/5`).
- **Proyeksi Kotak Arsiran Entry Zone pada Kanvas Grafik:**
  - Menggambar kotak arsiran transparan (*Entry Zone Box*) di antara `min(E1, E2)` dan `max(E1, E2)` dengan palet warna terisolasi yang selaras dengan bias posisi (`ENTRY_ZONE_STYLES.bull` atau `.bear`).
  - Mengikat siklus hidup kotak Entry Zone ke dalam `planId` dan transaksi undo/redo atomik (`Ctrl+Z`).
- **Plan-Linked Auto-Alerts Komprehensif untuk Seluruh Level Entri:**
  - Memasang alert otomatis seketika untuk titik Blended Entry, Level Entry 1, dan Level Entry 2, berdampingan dengan Stop Loss dan seluruh Target Profit (TP1..TPn).
  - Sinkronisasi otomatis nilai target alert saat pengguna menggeser kotak posisi di kanvas.
- **Peningkatan Visual Floating Thesis Card & Import Plan Modal:**
  - `FloatingThesisCard.svelte`: Menampilkan pil level E1 & E2 beserta bobot dan harga, lencana skor konfluensi setup (`4/5`), dan persentase risiko (`1.20%`).
  - `ImportPlanModal.svelte`: Menampilkan kartu mini preview E1 & E2 dan mendeteksi status pasar *"Di Dalam Entry Zone (Menjemput Limit)"*.
  - `chartSnapshotService.ts`: Menyertakan pil level E1 & E2 serta lencana skor konfluensi pada kartu tesis snapshot canvas ultra-HD.
- **Pencatatan Dokumen Arsitektur & Kamus Domain:**
  - Menambahkan ADR resmi `docs/adr/0020-dual-entry-blended-trading-plan-and-entry-zone-projection.md`.
  - Menambahkan definisi istilah kanonikal *Dual-Entry Plan* dan *Blended Entry* pada `GLOSSARY.md`.

### 🐛 Diperbaiki (Fixed)
- **Pembersihan False Positive Parser Rencana Perdagangan:**
  - Membatasi pencocokan kata kunci `Definisi` agar tidak lagi salah menangkap kata turunan seperti *"terdefinisi jelas"* pada daftar skor konfluensi.
  - Memperbaiki regex `stripInlineMarkdown()` agar tidak memotong konstanta bergaris bawah seperti `BULL_OB` dan `BEAR_OB`.
  - Menyaring zona konteks fiktif yang berasal dari narasi aksi harga ("turun ke") atau bagian kesimpulan/invalidasi.

## [0.37.0] - 2026-11-04

### 🚀 Ditambahkan (Added)
- **Ekstraksi POI-Only Context Zone & Polaritas Warna Mandiri (Zone Polarity):**
  - Mesin parser `planParserService.ts` kini memindai zona FVG, Order Block (OB), Inducement (IDM), Demand, dan Supply berbasis klausa anchor POI dan mengabaikan rentang non-POI (seperti Dealing Range makro dan teks narasi trigger).
  - Standarisasi format penamaan label ringkas pada Context Zone: `<TF> <kind> <polarity>` (contoh: `4H OB Bear`, `1H FVG Bull`, `15m OB Bull`, `IDM`).
  - Menambahkan tipe `ZonePolarity` (`bull` / `bear` / `neutral`) dan fungsi inferensi `inferZonePolarity()`.
- **Transparansi Optik Ultra-Rendah pada Objek Gambar Zona:**
  - Mengurangi opasitas isian (*fill alpha*) menjadi `0.04` dan garis batas (*border alpha*) menjadi `0.25` pada `chartDrawingController.ts`, mencegah tabrakan visual dan blok warna padat saat banyak zona bertumpuk (*stacked*).
  - Pewarnaan kotak zona mengikuti polaritas mandirinya (Bullish/Demand hijau `#00FF88`, Bearish/Supply pink `#FF69B4`, IDM/Netral abu-abu `#A0A0A0`), terlepas dari bias arah posisi induk.
- **Ekstraksi Status Setup & Kesimpulan Komprehensif:**
  - Menangkap atribut `Status Setup` (misalnya `PENDING (Conditional)`) dan menampilkannya sebagai lencana visual di header `FloatingThesisCard` dan dialog `ImportPlanModal`.
  - Memperluas ekstraksi kesimpulan untuk mengenali `Confidence Level` (beserta catatan narasi) dan `Invalidasi & Skenario Flip`.
  - Mendukung blok multiline `Definisi & Kalkulasi R`.

### 🔄 Diubah (Changed)
- **Sanitasi Tipografi Markdown pada Tesis & Snapshot:**
  - Fungsi `stripInlineMarkdown()` membersihkan karakter asterisk formatting (`**`) dan backtick tanpa merusak penanda epistemik `[FAKTA]`, `[INFERENSI]`, dan `[SPEKULASI]`.
  - Memperbarui `FloatingThesisCard.svelte`, `ImportPlanModal.svelte`, dan `chartSnapshotService.ts` agar badge dan pill zona menggunakan warna polaritas mandiri masing-masing zona.
  - Memperbarui kamus kanonikal `GLOSSARY.md` dengan entri `Context Zone` dan `Zone Polarity`.

## [0.36.0] - 2026-11-03

### 🚀 Ditambahkan (Added)
- **Memori Preset Tema per Mode, Thesis Card Dominan Chart, Trade Plan Vault & Auto-Alert (ADR-0019):**
  - Menambahkan memori preset tema chart per mode (gelap/terang), penanganan palet kustom, dan utilitas warna (`themes.ts`, `defaults.ts`, `colorUtils.ts`, `AppearanceTab.svelte`).
  - Memperluas tipe dan layanan persistensi agar Trade Plan Vault dan pengaturan bertahan setelah aplikasi dimulai ulang.
  - Menambahkan alert harga otomatis dari rencana perdagangan (`alertService.ts`).

### 🔄 Diubah (Changed)
- Memperbarui `chartDrawingController`, `priceScaleOverlayController`, dan `chartSnapshotService` untuk thesis card, auto-alert, dan overlay snapshot.
- Menyesuaikan `Chart.svelte`, `FloatingThesisCard`, `ImportPlanModal`, `SnapshotPreviewModal`, `WatchlistPanel`, dan `+page.svelte`.
- Mendokumentasikan keputusan di `docs/adr/0019-*` dan memperbarui `GLOSSARY.md`.

### 🐛 Diperbaiki (Fixed)
- Memperbaiki `ReferenceError` di `Chart.svelte`: helper `scheduleBadgePositionUpdate` dipulihkan dan mendelegasikan ke `priceScaleOverlayController.scheduleUpdate()`.

## [0.35.1] - 2026-11-03

### 🔄 Diubah (Changed)
- **Perombakan UI/UX Pengaturan Tema & Pemisahan Domain Aplikasi vs Chart (`AppearanceTab.svelte`):**
  - Menyederhanakan menu pengaturan tema menjadi 3 bagian terstruktur: **Pusat Kendali Tema** (2 kartu domain berdampingan untuk Tema Aplikasi dan Tema Kanvas Chart), **Galeri Preset Tema & Candlestick** dengan tombol aksi langsung (`Pakai di Aplikasi` & `Pakai di Chart`), serta **Studio Kustomisasi Tema** terpadu.
  - Menghapus kontrol "Target Penerapan Klik Kartu" yang membingungkan dan menggabungkan pengaturan warna candlestick, warna dasar permukaan UI, serta latar belakang kanvas chart ke dalam satu studio kustomisasi.

### 🐛 Diperbaiki (Fixed)
- **Sinkronisasi Repaint Kanvas WebGL2 & Pemulihan Warna Tema Gelap/Terang (`chartSessionController.ts`, `+page.svelte`):**
  - Memperbaiki bug warna tema terang pada kanvas chart yang tertinggal saat berpindah kembali ke tema gelap dengan memperbarui `layout` (`background`, `textColor`, `borderColor`), `crosshair`, properti `r.scene`, serta memicu `r.scheduler.invalidate(7)` pada `setTheme()`.
  - Memperbaiki `handleCycleColorMode()` di Header agar menyinkronkan `chartThemePreset` saat mode sinkron aktif dan membersihkan override `customPalette` yang menahan warna lama.
  - Memperluas `buildCustomPaletteFromPreset()` di `themes.ts` agar mendukung ID preset tema kustom pengguna (`user:*`).

## [0.35.0] - 2026-11-03

### 🚀 Ditambahkan (Added)
- **Live Theme Preview & Binary Mode Alignment (#161):**
  - Saat `syncChartWithAppTheme` nonaktif, pemilihan tema aplikasi lawan mode otomatis menyelaraskan `colorModePreference` dan preset aktif, dengan live preview instan ke DOM dan kanvas WebGL2.
- **In-Place Palette Editing & Safe Preset Forking (#162):**
  - Tombol "Edit Warna" (ikon Palette) ditambahkan pada kartu tema di AppearanceTab. Untuk tema pengguna: mode *in-place update* dengan banner "Simpan Perubahan ke Tema Ini" + "Batal". Untuk tema resmi: *fork* ke Palet Kustom Studio.
- **Canvas Watermark Control (#163):**
  - Toggle "Watermark Simbol di Kanvas" ditambahkan di seksi Tema Kanvas Chart pada AppearanceTab, menyinkronkan prop `showWatermark` ke `setWatermarkVisible()` di engine WebGL2 Vela.

### 🔄 Diubah (Changed)
- **Chart Context Menu Pruning (#159):**
  - Opsi "Pengaturan Grafik (Warna & Lilin)" dihapus dari klik kanan kanvas. Pengaturan visual lilin hanya diakses via `SettingsModal`. Menu konteks murni aksi analitikal (Alert, Garis Horizontal, Salin Harga, Reset Skala).
- **Workspace Auto-Save Guard & Quiet Debounce (#160):**
  - `computeWorkspaceFingerprint` (deep equality hash) ditambahkan ke `workspaceService.ts`. Debounce diperpanjang ke 3500ms. Log spam auto-save disenyapkan. Terminal kini tenang dan hemat I/O disk.
- **ADR 0018 & Spec #158:**
  - Dokumentasi keputusan desain live theme preview, context menu pruning, in-place palette editing, watermark control, dan auto-save guard.

## [0.34.1] - 2026-11-02

### 🐛 Diperbaiki (Fixed)
- **Koreksi Parameter Ordinat `lineTo` pada Helper Kanvas `drawRoundedRect`**:
  - Memperbaiki galat *runtime error* (`lineTo@[native code]: TypeError: Not enough arguments`) di WebView Tauri (WebKit) saat mengambil screenshot grafik dengan *price scale badges* atau *thesis cards*.
  - Menyelaraskan panggilan `ctx.lineTo(x, y + radius.tl)` dengan kontrak spesifikasi W3C Canvas 2D pada kedua cabang kurva (`arcTo` dan fallback `quadraticCurveTo`).
  - Menambahkan *strict mock test suite* pada `tests/screenshotCanvasRuntimeErrorBugRepro.test.ts` untuk memvalidasi pemenuhan jumlah argumen Web IDL canvas di lingkungan WebKit desktop.

## [0.34.0] - 2026-11-02

### 🚀 Ditambahkan (Added)
- **Deep Module WorkspaceShell (`workspaceShellService.ts`) (#152, #154)**:
  - Modul tunggal berarsitektur mendalam yang mengendalikan rel bilah gambar kiri (drawing toolbar), dock panel drawer kanan (watchlist, alerts, object tree), serta transisi mode workspace (`terminal` | `pine`).
  - Menyatukan sistem persistensi `localStorage` (`trawangan_left_rail_collapsed` dan `trawangan_right_dock_state`) dengan validasi parsing JSON yang aman dan toleran terhadap kegagalan.
  - Memberikan antarmuka reaktif tunggal untuk `+page.svelte` dan `RightDockRail.svelte`, mengeliminasi overhead pub/sub subscription ganda menjadi satu aliran state terpadu.
- **Suite Pengujian Komprehensif WorkspaceShell (`tests/workspaceShell.test.ts`) (#154)**:
  - Menguji siklus hidup rel bilah kiri, tab switching dock kanan (1-klik ganti tab, click-to-close, hider chevron toggle), transisi mode terminal/pine, serta pemulihan persistensi pada instansiasi baru.

### 🔄 Diubah (Changed)
- **Konsolidasi Single Source of Truth Keyboard Shortcuts (`commandDispatcher.ts`) (#152, #153)**:
  - Glosarium pintasan keyboard lengkap (`SHORTCUT_GLOSSARY`) dan helper filter kategori dipindahkan langsung ke dalam `commandDispatcher.ts`.
  - Mengeliminasi modul adapter dangkal `shortcutService.ts` dan menyerap seluruh unit test pintasan ke dalam `commandDispatcher.test.ts`.
  - Konsumen modal cheatsheet (`ShortcutCheatsheetModal.svelte`) dan tab bantuan (`HelpTab.svelte`) kini langsung terhubung ke `commandDispatcher`.
- **Penyatuan Engine Kompositor Snapshot Kanvas 2D (`chartSnapshotService.ts`) (#152, #155, #156)**:
  - `chartSnapshotOverlayService.ts` diserap seutuhnya ke dalam `chartSnapshotService.ts`, membentuk deep module komposisi snapshot tunggal yang bebas ketergantungan fragmen eksternal.
  - Penyatuan engine visual trading plan (lencana bias Bullish/Bearish, probabilitas setup, parameter entry, pills context zone FVG, skenario pembatalan bergaris putus-putus, target likuiditas berjenjang dengan lencana +R, dan catatan risiko) antara kartu mengambang (floating card) dan panel samping berdedikasi (side-panel).
  - Helper 2D kanvas (`colorToRgba`, `wrapCanvasText`, `drawRoundedRect`, `drawGripDots`) dienkapitulasi secara internal di dalam modul snapshot dan dihentikan dari kebocoran re-export publik.
  - `Chart.svelte` dan test suite snapshot kini mendelegasikan screenshot grafik langsung ke `chartSnapshotService`.

### 🐛 Diperbaiki (Fixed)
- **Pembersihan Dead Code & Pengetatan Seam Antarmuka (#154, #155)**:
  - Menghapus method `handleKeydown` yang tidak terpakai dari service layer toolbar (event keyboard kini 100% diproses melalui binding deklaratif `commandDispatcher`).
  - Mengeliminasi duplikasi implementasi `drawRoundedRect` antar-modul dan memperkuat ketahanan kanvas 2D dengan dukungan adaptif terhadap `ctx.roundRect`, `ctx.arcTo`, `ctx.quadraticCurveTo`, dan `ctx.rect`.
  - Menghapus 4 berkas service dan tes lama yang terfragmentasi (`shortcutService.ts`, `leftToolbarService.ts`, `rightDockService.ts`, `chartSnapshotOverlayService.ts`).

## [0.33.0] - 2026-11-02

### 🚀 Ditambahkan (Added)
- **Persistensi Gambar & Trade Setup Komposit Multi-Dimensi (#151)**:
  - **Kunci Gabungan Workspace-Scoped**: Mengaitkan penyimpanan gambar kanvas ke dimensi komposit `[workspaceId:providerId:symbol]` via `resolveDrawingKey`. Analisis teknikal pada Workspace A kini terisolasi penuh dari Workspace B meskipun memantau pasangan koin dan bursa yang sama.
  - **Serialisasi Metadata Trade Setup**: Payload basis data lokal SQLite / LocalStorage kini merekam seluruh `drawingMetadata`, daftar rencana trading aktif (`activePlans`), serta relasi `planDrawingIds`.
  - **Pembersihan State & Rekonstruksi Reverse Mapping**: Saat pemulihan gambar (`restoreDrawings`), memori lama di-reset secara bersih dan pemetaan balik `drawingPlanMap` (`drawingId -> planId`) direkonstruksi, menjamin penghapusan objek gambar di kanvas memicu sinkronisasi pembersihan kartu thesis dan plan terkait.
  - **Auto-Flush Atomik & Listener `beforeunload`**: Pemanggilan `flushDrawings()` dilakukan secara atomik sebelum pergantian simbol, bursa, atau workspace, serta terikat pada event `beforeunload` jendela aplikasi untuk mencegah setup hilang saat aplikasi ditutup mendadak.
  - **Pemuatan Ulang Reaktif Antar-Workspace**: Pergantian workspace kini otomatis memuat gambar target workspace secara instan meskipun simbol aktifnya tidak berubah.
  - **Clean Slate Workspace Baru**: Pembuatan workspace baru otomatis membersihkan kanvas aktif dan memori plan tanpa mewarisi coretan lama.
  - **Backward Compatibility Fallback**: Gambar warisan versi lama tanpa prefix workspace (`provider:symbol` dan `symbol`) tetap otomatis dimuat pada workspace default.
- **Tab Baru Tipografi & Skala Teks Antarmuka (`TypographyTab.svelte`) (#151)**:
  - **Pemisahan Khusus Pengaturan Teks**: Tab mandiri untuk konfigurasi font antarmuka UI Sans (`fontFamilyUi`), font monospace angka dan kode (`fontFamilyMono`), kerapatan UI (*compact*, *regular*, *comfortable*), dan skala font bebas.
  - **Kontrol Stepper & Slider Presisi**: Dilengkapi stepper tombol [-] / [+], range slider, dan input angka langsung dengan indikator persentase serta preset ukuran monitor (laptop 13-14", monitor 1080p, 2K, hingga 4K).
  - **Live Preview Tampilan Skala Nyata**: Kotak pratinjau real-time yang langsung merefleksikan perubahan jenis font dan ukuran teks sebelum disimpan.
- **Kontrol Garis Grid 3-Mode Langsung ke WebGL (#151)**:
  - **Selector Segmented Cepat**: Pilihan mode garis grid latar belakang (*Normal*, *Redup*, *Sembunyi*) langsung di tab Grafik tanpa perlu membuka dialog internal engine Vela.
  - **Integrasi WebGL Renderer**: Terhubung langsung ke properti garis horizontal dan vertikal kanvas grafik dengan kalkulasi opasitas dan warna yang tersentralisasi via `resolveEffectiveGridColor`.

### 🔄 Diubah (Changed)
- **Pelebaran & Tata Letak Modal Pengaturan (Settings Modal 920px) (#151)**:
  - Dimensi modal diperbesar dari 780px × 75vh menjadi **920px × 82vh** (lebar maksimal 94vw dan tinggi minimum 520px).
  - Lebar navigasi sidebar diperluas menjadi **210px**, memberikan ruang lapang saat menjelajahi tema dan studio warna.
- **Restrukturisasi Taksonomi & Pembersihan Menu Pengaturan (#151)**:
  - **Pembersihan Tab Tampilan (`AppearanceTab.svelte`)**: Murni berfokus pada Mode Warna (Gelap/Terang/Sistem), Studio Palet Candlestick, dan Galeri Preset Tema.
  - **Pusat Pengaturan Umum (`GeneralTab.svelte`)**: Menampung preferensi bahasa antarmuka, Timeframe Default aplikasi (`defaultTimeframe`), serta tombol penyimpanan otomatis workspace (`autoSaveWorkspace` dan `autoLoadLastWorkspace`).
  - **Pembersihan Tab Grafik (`ChartTab.svelte`)**: Menghapus opsi duplikat timeframe dan persistensi workspace yang kini tersentralisasi di tab Umum.
- **Isolasi Tema Trawangan dari Pembajakan Vela (Single Source of Truth) (#151)**:
  - Memutus listener `chart.onThemeSelect` dan menyembunyikan opsi `canvas.theme` dari dialog internal chart Vela (`setSettingsVisibility({ hidden: ['canvas.theme'] })`). Tema Trawangan menjadi satu-satunya otoritas pengatur warna grafik.

### 🐛 Diperbaiki (Fixed)
- **Pencegahan Race Condition Storage pada Transisi Konteks (#151)**:
  - Fungsi penanganan perubahan simbol, pergantian provider bursa, dan pembuatan workspace baru kini bersifat `async` dengan `await flushDrawings()`, mengeliminasi risiko penimpaan data akibat operasi penulisan disk asinkron.
- **Refactoring Standar Koding & Debt Teknis (#151)**:
  - Menyatukan ekspresi evaluasi ukuran font di `TypographyTab.svelte` ke satu reactive rune `$derived(effectiveFontSize)`.
  - Mengabstraksi setter context chart ke interface `DrawingContextResolvers` dan menstandardisasi penamaan variabel lokal menjadi deskriptif (`provider`, `normalizedSymbol`).

## [0.32.0] - 2026-11-02

### 🚀 Ditambahkan (Added)
- **Dekopling Tema Aplikasi vs Tema Kanvas Grafik (Dual-Theme Decoupling) (ADR 0017 & Issue #144)**:
  - **Pemisahan Independen App Theme & Chart Theme**: Memungkinkan pengguna memilih tema UI Shell/Aplikasi (`appThemePreset`) dan tema kanvas grafik (`chartThemePreset`) secara terpisah.
  - **Opsi Sinkronisasi Dua Arah (*Sync Chart with App Theme*)**: Toggle reaktif untuk otomatis menyelaraskan kanvas grafik dengan tema aplikasi aktif saat dinyalakan, atau membebaskan padanan tema saat dinonaktifkan (misal UI Shell gelap dengan kanvas grafik koran terang *Red Folder News*).
- **Studio Preset Tema Pengguna & Fitur "Save As" (#149)**:
  - **Simpan Tema Kustom Sebagai Preset**: Pengguna kini dapat menyimpan konfigurasi palet kustom sebagai preset tema baru milik sendiri (*User Theme Preset*) dengan nama unik, badge visual `[CUSTOM]`, dan identifikasi aman.
  - **Manajemen Lengkap Preset Kustom**: Fitur ganti nama (*Rename*), hapus (*Delete*), ekspor ke berkas JSON atau teks clipboard, serta impor preset secara instan dari dialog Appearance Settings.
  - **Injeksi Token CSS Dinamis**: Preset kustom otomatis menyuntikkan token warna `--bg-app`, `--bg-panel`, `--text-main`, dll. ke `:root` DOM host sehingga tampilan antarmuka selalu serasi.
- **System Theme Bridge & Header Color Mode Switcher (#148)**:
  - **Peralihan Mode Warna 1-Klik**: Tombol switcher cepat di bilah Header (`.color-mode-btn`) dengan ikon reaktif (*Moon* untuk Gelap, *Sun* untuk Terang, *Monitor* untuk Sistem).
  - **Integrasi Preferensi Perangkat/OS**: Opsi mode `system` mendeteksi dan merespons perubahan mode sistem operasi secara *real-time* via `window.matchMedia('(prefers-color-scheme: dark)')`.
  - **Asosiasi Preset Default Per-Mode**: Pengguna dapat menetapkan preset spesifik untuk mode gelap (`darkThemePreset`) dan mode terang (`lightThemePreset`) yang akan aktif otomatis saat berganti mode.
- **Background Alert Engine & Dynamic Market Feed Ingestion (#146)**:
  - **Evaluasi Alert Latar Belakang**: Alert harga tetap aktif dievaluasi dan memicu notifikasi visual serta suara meskipun instrumen/koin yang bersangkutan sedang tidak dibuka pada grafik aktif.
  - **Ingesti Simbol Dinamis**: Metode `alertService.getActiveAlertSymbols()` otomatis menyuntikkan seluruh simbol alert yang aktif ke dalam putaran polling data pasar (`marketFeed.pollTick()`).
  - **Kontinuitas Polling Tanpa Idle Prematur**: Mekanisme polling pasar tetap berjalan aktif dan otomatis kembali menyala (*resume from idle*) jika terdapat alert aktif baru, menjamin kesiapan sinkronisasi trading setup dan level harga penting.

### 🔄 Diubah (Changed)
- **Attribution Bar Screenshot Adaptif Terhadap Luminansi (#144, #147)**:
  - Fungsi `resolveAttributionBarColors` pada modul snapshot komposit otomatis mengevaluasi kecerahan latar belakang bingkai grafik (`isDarkColor(frameBg)`).
  - Pada tema latar terang (*Light Theme* seperti *Red Folder News*), seluruh elemen teks identitas (nama trader, handle, bio, instrumen, timestamp, URL, dan harga pasar) menggunakan warna kontras gelap pekat dari token tema, mencegah teks putih nabrak atau pudar.
- **UI Menu Konteks Grafik Berbasis Token Semantik CSS (#147)**:
  - Refactoring `ChartContextMenu.svelte` dari warna latar abu-abu gelap statis menjadi token semantik `--bg-panel`, `--text-main`, `--bg-hover`, dan `--border-medium`, memastikan tampilan menu klik kanan kontras tinggi dan rapi di tema terang maupun gelap.

### 🐛 Diperbaiki (Fixed)
- **Perbaikan Kursor & UX Pencarian Koin (Type-to-Search Cursor Guard) (#145)**:
  - Membedakan pemicu pencarian simbol: pengetikan langsung (*keystroke type-to-search*) mengarahkan kursor ke akhir teks (`setSelectionRange(len, len)`), menyelesaikan masalah huruf pertama terhapus saat pengguna mengetik huruf kedua secara cepat.
  - Pemanggilan eksplisit (via tombol pencarian atau `Ctrl+K`) tetap memblok seluruh teks input (`select()`) agar pengguna dapat langsung menimpa pencarian sebelumnya.

## [0.31.0] - 2026-11-02

### 🚀 Ditambahkan (Added)
- **Unified Theme Engine & Full Palette Matrix (9 Dimensi) (ADR 0016)**:
  - **Matriks Palet Penuh 9 Dimensi**: Mendukung konfigurasi dan kustomisasi 6 komponen lilin individual (`bullBody`, `bullWick`, `bullBorder`, `bearBody`, `bearWick`, `bearBorder`) dan 3 atribut warna umum (`background`, `foreground/container`, `textColor`) sesuai standar modern (*chartthemes.com*).
  - **Preset Resmi Baru "Red Folder News" (`red_folder`)**: Preset tema terang (*Light Theme*) terinspirasi dari referensi jurnalisme keuangan dengan latar krem koran (`#edede9`), tipografi burgundy (`#4A0E0F`), lilin bullish rose (`#D4A5A5`), dan lilin bearish crimson (`#9B1D20`).
  - **Studio Palet Kustom Interaktif**: Sub-panel baru pada Appearance Settings dengan 9 pemilih warna individual, indikator status luminance, tombol salin cepat Hex per-item individual (`btn-mini-copy`), ekspor JSON palet, serta modal impor palet toleran yang membaca JSON maupun format teks mentah baris-demi-baris dari clipboard.
  - **Kategorisasi Eksplisit & Filter Mode Tema**: Pengelompokan tegas preset menjadi Mode Gelap (*Dark*) dan Mode Terang (*Light*) dengan badge visual `[DARK]` / `[LIGHT]` dan filter cepat (Semua, Gelap, Terang) yang tersimpan secara persisten di `AppSettings`.
  - **Adaptive Luminance Engine**: Kalkulasi deterministik berbasis kontras latar belakang untuk auto-deriving warna kisi kanvas (*grid*), garis batas (*border*), kursor silang (*crosshair*), dan separator skala chart tanpa membebani konfigurasi manual pengguna.

### 🔄 Diubah (Changed)
- **Harmonisasi Seluruh Subsistem UI Shell, Editor, & WebGL2**:
  - **Injeksi Token Vela (`--vela-*`)**: Menginjeksikan seluruh token CSS kit WebGL2 Vela dinamis ke `:root` DOM host sehingga popup gear pengaturan, menu konteks, dan dialog indikator internal Vela (`@zag-js/dialog`) tampil selaras dengan tema aktif.
  - **Reaktif Pine Editor Compartment**: Mengganti tema statis CodeMirror 6 dengan ekstensi reaktif `Compartment` yang menyelaraskan warna latar, gutter baris, selection, kursor, dan penyorotan sintaksis (*syntax highlighting*) secara adaptif antara lingkungan gelap dan terang.
  - **Sinkronisasi Dua Arah Switch Mode Tema Vela**: Menghubungkan listener `chart.onThemeSelect` ke state tema Trawangan, menyinkronkan perpindahan mode terang/gelap dari dalam dialog Vela tanpa mereset palet kustom pengguna yang sudah sesuai mode.
  - **Pemusatan Resolusi Warna Tema**: Mengabstraksikan kalkulasi warna efektif ke fungsi pembantu `resolveEffectiveThemeColors()` di `themes.ts` untuk menghilangkan duplikasi kode lintas modul.

### 🐛 Diperbaiki (Fixed)
- **Koreksi Tautologi & Penimpaan Semantik Token Brand**:
  - Menghapus logika ternary tautologis pada `document.documentElement` yang sebelumnya menimpa `--brand-primary` dengan warna lilin bearish pengguna.

## [0.30.1] - 2026-11-01

### 🐛 Diperbaiki (Fixed)
- **Sinkronisasi Event Seleksi Kanvas & Penghapusan Objek Gambar via Del/Backspace**:
  - **Penyelarasan Event Seleksi Vela**: Memperbaiki ketidaksesuaian nama event pada `chartDrawingController.ts` dari `'drawing:select'` ke event resmi WebGL2 Vela **`'drawing:selected'`** (`{ id: string | null, ids: string[] }`). Kini, mengklik objek gambar langsung pada kanvas grafik mencatat ID objek terpilih (`selectedDrawingId`) secara instan dan akurat.
  - **Fallback Cerdas Status Seleksi Engine**: Menambahkan inspeksi langsung pada array `activeChart.drawings.ctrl.selectedIds` di dalam `getSelectedDrawingId()`, menjamin ID seleksi selalu terdeteksi meski event asinkron belum sempat diproses.
  - **Dukungan Multi-Selection & Penghapusan Fleksibel**: Menambahkan method `getSelectedDrawingIds()` dan `deleteSelectedDrawing()`, serta memperbarui handler `draw-delete` di `src/routes/+page.svelte` untuk mengeksekusi penghapusan objek gambar yang sedang dipilih secara andal.
  - **Listener Dinamis Seluruh Sel Workspace**: Mengaitkan listener drawing secara dinamis ke seluruh sel yang ada di workspace serta berlangganan event `workspace.on('cell:created')` dan `workspace.on('cell:active')`.
  - **Kompatibilitas macOS Keyboard**: Menyertakan `e.code === 'Backspace'` pada matcher perintah `draw-delete` di `commandDispatcher.ts` guna menjamin tombol Backspace/Delete pada papan ketik macOS berfungsi konsisten.
  - **Pengujian Regresi Otomatis**: Menambahkan suite pengujian terfokus di `tests/reproDelDrawingSelection.test.ts` untuk memvalidasi alur klik kanvas, penekanan tombol Del/Backspace, deselect klik kanvas kosong (*safe no-op*), dan pembatalan (*undo*).

## [0.30.0] - 2026-11-01

### 🚀 Ditambahkan (Added)
- **Suite Pintasan Institusional & Produktivitas Gambar (#137, #140, #141, #142):**
  - **Smart-Toggle Object Tree & Indikator (`Alt + O`) (#140)**: Pintasan cerdas untuk membuka panel samping daftar objek dan indikator (`rightDockService.toggleTab('objects')`), berpindah ke tab objek jika sedang berada di tab lain, atau menutup panel jika sudah aktif di tab tersebut. Otomatis mengalihkan `workspaceMode` dari Pine Script ke mode terminal standar saat dibuka, dengan tetap mempertahankan fokus keyboard pada kanvas grafik.
  - **Mesin Duplikasi Objek Gambar (`Ctrl + D`) (#141)**: Mengimplementasikan method `duplicateDrawing(id)` dan `duplicateSelectedDrawing()` pada `ChartDrawingController` dengan pergeseran spasial adaptif (*gentle spatial offset*: 5 tick harga dan 60s waktu) berbasis ukuran tick harga aktual. Mendukung aksi undo/redo atomik (`DrawingUndoAction` berlabel `'create'`) serta otomatis menyeleksi klon baru.
  - **Toggle Visibilitas & Kunci Seluruh Gambar (`Alt + K` & `Alt + L`) (#137)**: Pintasan produktivitas untuk menyembunyikan/menampilkan (`bulkHideDrawings`) atau mengunci/membuka kunci (`bulkLockDrawings`) seluruh objek gambar pada grafik aktif secara serentak disertai notifikasi umpan balik (*toast feedback*).
  - **Hapus Seluruh Objek Gambar Sekaligus (`Ctrl + Delete`) (#142)**: Pintasan cepat untuk membersihkan seluruh objek gambar pada simbol aktif kanvas dengan konfirmasi dan notifikasi sistem yang aman.
  - **Pembalikan Sumbu Skala Harga (`Alt + I`) (#137)**: Pintasan untuk membalik orientasi sumbu harga vertikal (*invert price scale*) pada sel aktif melalui command dispatcher.
  - **Proteksi Pengetikan & Tampilan Cheatsheet**: Seluruh kombinasi pintasan baru dikonfigurasi dengan `allowInInput: false` guna mencegah eksekusi saat pengguna mengetik di input form, kotak pencarian, atau editor script, serta disajikan secara terstruktur di Cheatsheet Pintasan Keyboard (`F1` / `?`).
- **Tick-Aligned Price Guard (GLOSSARY.md)**:
  - Menggantikan batas toleransi harga mengambang arbitrer `0.0005` pada `isPriceMatch` di `chartDrawingController.ts` dengan ambang dinamis `getAdaptiveTickSize(expected) * 1.5`, menjamin akurasi identifikasi anchor harga di seluruh rentang harga instrumen kripto.

### 🔄 Diubah (Changed)
- **Pembaruan Deskripsi Perintah Terminal**:
  - Memperbarui deskripsi perintah `draw-delete` pada `commandDispatcher.ts` dari *"Hapus objek gambar yang sedang dipilih atau urungkan aksi"* menjadi *"Hapus objek gambar yang sedang dipilih"* agar mencerminkan semantik penghapusan objek secara tepat.

### 🐛 Diperbaiki (Fixed)
- **Delegasi Auto-Fit Scaling Viewport Grafik (`Alt + Z` & `F`) (#139)**:
  - Memperbaiki kegagalan diam-diam (*silent failure*) pada `fitChart()` yang sebelumnya memanggil method non-existent pada instans Vela. Kini mendelegasikan secara tepat ke `cell.resetView()` pada sel aktif, dengan fallback defensif berjenjang ke `renderer.resetView()`, `chart.fitContent()`, atau `chart.resetView()`.
  - Mengaktifkan kembali pintasan keyboard `Alt + Z`, tombol tunggal `F`, serta event listener `ondblclick` pada sumbu harga dan sumbu waktu untuk auto-fit framing seluruh candle historis ke viewport secara instan.
  - Memasang `chartPriceScaleInputGuard` saat sel dimount untuk mencegah objek gambar latar belakang mengklaim interaksi klik dan drag pada sumbu skala harga dan waktu.
- **Isolasi Penghapusan Objek Gambar Tunggal pada Del & Backspace (#138)**:
  - Menghubungkan perintah `draw-delete` langsung ke `chartDrawingController.deleteDrawing(selectedId)` untuk menghapus hanya objek gambar yang sedang dipilih.
  - Mencegah eksekusi `handleUndo()` yang merusak riwayat anotasi saat tidak ada objek gambar terpilih (beralih ke *safe no-op*).
  - Mengisolasi penghapusan node bertingkat pada rencana perdagangan: menghapus salah satu node (misal TP tertentu) tidak lagi menghapus seluruh rencana trading selama masih ada node aktif lain di kanvas.
- **Pencegahan Duplikasi Objek Gambar Startup & Tabrakan Teks Entry Snapshot**:
  - **Deduplikasi Gambar Pasca Startup**: Mengimplementasikan `tryRelinkPlanDrawings` untuk merekonsiliasi pemuatan database kanvas (`restoreDrawings`) dengan sinkronisasi workspace (`restorePlans`), mencegah penggandaan ganda objek gambar posisi dan kotak zona konteks (FVG) saat membuka kembali aplikasi, dilengkapi pembersihan mandiri (*self-healing*).
  - **Pencegahan Teks Entry Bertabrakan**: Memperbaiki urutan pengukuran font kanvas pada panel samping tesis mandiri (`DedicatedThesisSidePanel`), menjamin jarak horizontal aman antara label "Entry" dan angka harga entry.

## [0.29.0] - 2026-11-01

### 🚀 Ditambahkan (Added)
- **Side-by-Side Snapshot Layout & Dedicated Thesis Side Panel (#132, #133, #134, #135, #136):**
  - **Pemisahan Kanvas Bersih (Clean Chart Separation)**: Saat mengekspor tangkapan layar dalam mode *Side Panel*, kartu tesis mengambang (`FloatingThesisCard`) dilewati dari atas kanvas lilin sehingga *candlestick*, zona order block SMC, dan indikator teknikal tetap 100% terlihat tanpa terhalang elemen antarmuka, sementara lencana skala harga (Entry, SL, TP) tetap tampil utuh pada sumbu harga kanan.
  - **Panel Samping Tesis Mandiri (Dedicated 2D Thesis Side Panel)**: Menghadirkan panel analisis samping kanan terstruktur (~380px) berstandar editorial finansial modern, lengkap dengan lencana bias (*Bullish/Bearish*) dan harga entry, pil katalis multi-timeframe, blok narasi berformat epistemik (*[FAKTA]*, *[INFERENSI]*, *[SPEKULASI]*), batas invalidasi SL dengan badge risiko (`-1.00R`), daftar target likuiditas bertingkat dengan proyeksi `+R`, serta unit risiko dan catatan probabilitas setup.
  - **Adaptasi Tinggi Kanvas Dinamis & Preservasi Aspek Rasio 1:1**: Tinggi kanvas komposit snapshot beradaptasi secara dinamis mengikuti panjang teks tesis, dengan kanvas grafik lilin di sisi kiri tetap *top-aligned* mempertahankan rasio aspek 1:1 tanpa peregangan atau distorsi vertikal.
  - **Bilah Atribusi Terpadu (Unified Attribution Bar)**: *Attribution Bar* di bagian bawah membentang menyatukan grafik candlestick dan panel samping tesis di dalam satu bingkai *Branded Snapshot Frame* yang harmonis.
  - **Isolasi Watermark Keamanan**: *Security Watermark* dibatasi (*clipped*) secara ketat hanya pada area grafik di sisi kiri, menjaga keterbacaan teks dan angka pada panel tesis tetap optimal.
  - **Kontrol Interaktif pada Modal Pratinjau Snapshot (`SnapshotPreviewModal`)**: Menyediakan selektor opsi tata letak tesis saat terdapat rencana trading aktif: *Side Panel (Samping Kanan)* (bawaan & rekomendasi), *Overlay di Atas Grafik*, dan *Sembunyikan*, yang memperbarui pratinjau kanvas dan estimasi dimensi secara reaktif.
  - **Persistensi Preferensi & Integrasi Pintasan Cepat (`Ctrl+Shift+S`)**: Preferensi `snapshotThesisLayout` otomatis tersimpan ke `AppSettings` secara lokal dan diwarisi oleh pintasan salin instan ke papan klip (`Ctrl+Shift+S`), dengan *graceful fallback* ke ekspor grafik tunggal standar saat tidak ada rencana aktif atau tesis disembunyikan.
  - **Dukungan Mode Ekspor Bersih (Clean Chart Export)**: Mode *Clean Export* mendukung tata letak berdampingan tanpa margin bingkai luar dan tanpa bilah atribusi.

### 🔄 Diubah (Changed)
- **Harmonisasi Helper Kanvas & Konsolidasi Kontrak Snapshot**:
  - Mengekstrak dan menggunakan ulang fungsi helper kanvas `colorToRgba` dan `wrapCanvasText` antara `chartSnapshotOverlayService` dan `chartSnapshotService` untuk mengeliminasi duplikasi kode.
  - Mengonsolidasikan properti `tradingPlan` sebagai properti kanonikal pada antarmuka `SnapshotOptions`.

## [0.28.0] - 2026-11-01

### 🚀 Ditambahkan (Added)
- **Penguatan Parser Rencana Perdagangan Deterministik (Hardening Plan Ingestion - #131):**
  - **Deteksi Tanggal Komprehensif (`isDateOrTimestampPattern`)**: Validator mandiri untuk mencegah format tanggal kalender lengkap (ISO `YYYY-MM-DD`, `DD-MM-YYYY`), format jam/menit (`10-30 06:00`), stempel waktu dalam kurung `(10-30)`, maupun tanggal berawalan kata kunci (`OB tanggal 10-30`) keliru diekstrak sebagai zona harga konteks fiktif.
  - **Sanitasi Penekanan Markdown pada Label Institusional**: Penangkap label kini secara transparan membersihkan simbol pemformatan Markdown (`**`, `*`, `__`, `_`), sehingga zona seperti `**1H Bearish OB**` atau `*4H Bearish FVG*` diekstrak dengan nama institusional yang bersih dan presisi alih-alih label generik `Context Zone`.
  - **Proteksi Skala Harga Aset Bernilai Rendah**: Memvalidasi rentang harga terhadap harga referensi instrumen aktif sehingga rentang harga bulat riil pada koin murah ($10–$25 pada koin seharga $15) tetap dipertahankan sebagai Context Zone valid.
  - **Toleransi Sel Tabel Multiline & Karakter Pemformatan Internal**: Penggabungan sel tabel multiline yang kebal terhadap jeda baris kosong internal, penutup pipa terpisah (` |`), pembatas `---`, maupun penomoran `#1` di dalam narasi tesis.

### 🔄 Diubah (Changed)
- **Refactoring Arsitektur Parser & Pembersihan Code Smells**:
  - Mengekstrak helper lokal `ensureTrailingPipe` untuk menstandarkan format baris tabel Markdown di seluruh cabang normalisasi.
  - Mengubah variabel singkatan ambigu `lm` menjadi `labelMatch` untuk meningkatkan keterbacaan kode domain.

### 🐛 Diperbaiki (Fixed)
- **Pencatatan Lengkap Tesis/Alasan pada Tabel Multiline**: Memperbaiki anomali di mana sel narasi alasan (`reasons.entry`, `reasons.stopLoss`, `reasons.tp1`, `reasons.tp2`) bernilai kosong akibat syarat kaku `trimmed.endsWith('|')`.
- **Eliminasi False Context Zone Tanggal `10.00 - 30.00`**: Mengeliminasi kotak dan lencana zona konteks fiktif berharga ekstrem $10–$30 pada grafik aset bernilai besar (BTC) yang dipicu oleh kemunculan tanggal kalender di dekat singkatan institusional.

## [0.27.0] - 2026-11-01

### 🚀 Ditambahkan (Added)
- **Kalkulasi & Visualisasi R Dinamis pada TP1, TP2, dan SL:**
  - **Sumbu Skala Harga Kanan (Price Scale Badges)**: Menghitung rasio imbalan/risiko R-Multiple secara dinamis langsung dari selisih koordinat harga aktual anchor ($R = \frac{|\Delta\text{TP}|}{\text{riskDistance}}$).
  - **Format Label Padat**: Menyelaraskan teks badge sumbu harga kanan menjadi format padat `TP1 (+X.XXR)`, `TP2 (+X.XXR)`, dan `SL (-1.00R)`, serta `Target (+X.XXR)` dan `Stop (-1.00R)` pada alat gambar posisi manual (*single position tool*).
  - **Zero-Division Guard & Directional Sign Awareness**: Ketika level `entry == stopLoss`, kalkulasi R di-fallback secara anggun tanpa menghasilkan nilai `NaN` atau `Infinity`. Arah target yang berlawanan dengan bias setup secara akurat menampilkan tanda minus (contoh: `-0.50R`).
  - **Lencana R Stop Loss pada Kartu Tesis & Ekspor Snapshot**: Menambahkan lencana eksplisit `-1.00R` dengan aksen merah lembut berdampingan dengan harga Stop Loss pada judul seksi `INVALIDASI & STOP LOSS` di Floating Thesis Card maupun kanvas snapshot Ultra HD.
  - **Sinkronisasi Dua Arah (Bidirectional Sync)**: Menyeret anchor harga Entry, Stop Loss, atau Take Profit pada kanvas grafik secara otomatis memperbarui koordinat harga dan nilai `rMultiple` pada registry `activePlans` dan menyinkronkan seluruh kotak posisi bertingkat saudara (*sibling staged position boxes*).

### 🐛 Diperbaiki (Fixed)
- **Eliminasi String Cacat `+-` pada R-Multiple Negatif**: Memperbaiki pemformatan tanda keuntungan pada Floating Thesis Card dan snapshot overlay agar target dengan nilai R negatif tidak menghasilkan awalan ganda `+-0.50R`.
- **Pembersihan Stale R pada Stop Loss Nol**: Memastikan badge skala harga trading plan tidak lagi menampilkan nilai R usang dari metadata saat jarak risiko bernilai nol.

## [0.26.0] - 2026-10-31

### 🚀 Ditambahkan (Added)
- **Penerimaan Rencana Perdagangan Deterministik & Posisi Multi-Target (ADR-0014, #109, #110, #111, #112, #113, #115, #119, #120, #121, #122, #123):**
  - **Parser Rencana Perdagangan Lokal Cepat (Zero-LLM & Zero-OCR)**: Mesin parser deterministik berbasis regex (< 5 ms) yang mengekstrak parameter posisi (`Bias`, `Entry`, `Stop Loss`, `TP1..TPn`), rasio RRR / R-multiple, zona Fair Value Gap (FVG), serta narasi analisis kualitatif dari tabel Markdown maupun teks bebas.
  - **Sanity Guard & Tick-Aligned Price Guard**: Validasi konsistensi logika arah posisi (Bearish: SL > Entry > TP; Bullish: SL < Entry < TP) serta penyelarasan harga otomatis dengan tick size bursa aktif (`roundToTickSize`).
  - **Staged Multi-Target Position Drawing Engine**: Pemetaan target bertingkat ke dalam kontigu kotak posisi bertingkat ($t_0 \to t_1$, $t_1 \to t_2$) yang berbagi Entry & SL matematis identik, dengan label R-multiple dinamis dan transaksi Undo/Redo atomik serentak (`Ctrl+Z`).
  - **Kartu Tesis Melayang HUD (Glassmorphism Floating Thesis Card)**: HUD melayang semitransparan di atas kanvas grafik yang dapat digeser (*draggable*) dan diminimalkan (*minimizable*), menampilkan sorotan epistemik (`[FAKTA]`, `[INFERENSI]`, `[SPEKULASI]`), skenario pembatalan (*invalidation scenario*), penggambaran otomatis kotak zona FVG (*auto-draw FVG box*), serta badge harga Entry/SL/TP pada sumbu harga kanan.
  - **Penyelarasan Snapshot High-Fidelity & Isolasi Simbol Koin**: Kartu tesis kini terintegrasi secara proporsional ke dalam komposit ekspor grafik tanpa ruang kosong gelap (*void*), dan rencana perdagangan terisolasi secara ketat per simbol koin aktif (setup BTC tidak bocor saat membuka SOL).
  - **Akses Cepat & Smart Canvas Paste**: Modal import dapat dipanggil via pintasan global `Ctrl + Shift + P`, tombol Drawing Toolbar, menu konteks klik kanan, atau deteksi tempel otomatis kanvas `Ctrl + V`.
- **Komposit Tangkapan Layar Ultra HD, Profil Trader, Watermark Keamanan & Latar Kanvas Kustom (ADR-0015, #124, #125, #126, #127, #128, #129, #130):**
  - **Multi-Scale Snapshot Compositing (1x, 2x HiDPI, 4x Ultra HD, 6x Super HD)**: Dukungan ekspor resolusi ekstrim hingga 6x Super HD (~11520x6480 piksel) dengan penyesuaian skala elemen tipografi dan pratinjau dimensi piksel instan (*real-time dimension badge*).
  - **Integrasi Logo Resmi Vektor**: Mengganti monogram manual `tr` dengan logo SVG resmi `trawangan` beresolusi tinggi pada *Branded Snapshot Frame*.
  - **Pengaturan Profil Trader Mandiri (Offline-First) & Atribusi Personal**: Tab pengaturan "Profil & Watermark" baru untuk mengunggah avatar lokal (Base64), menyetel username, handle `@social`, dan deskripsi ringkas (*bio*), dengan kliping sirkular native pada Attribution Bar snapshot.
  - **Tanda Air Keamanan Anti-Maling (Anti-Theft Security Watermark)**: Teks watermark diagonal semi-transparan berputar -32° di tengah grafik kanvas untuk melindungi karya analisis dari pembajakan/reupload, dengan kontrol opasitas (5%–30%), opsi tampil di kanvas kerja langsung, serta sakelar toggle interaktif langsung di modal pratinjau snapshot.
  - **Latar Belakang Kanvas Grafik Kustom (Custom Canvas Background)**: Opsi fleksibel di tab Appearance untuk mengatur latar grafik ke mode Tema Preset Bawaan (`theme`), Warna Heksadesimal Tunggal (`solid`), atau Gradien Vertikal Dua Warna (`gradient`), yang direproduksi secara identik di kanvas live WebGL maupun ekspor 2D snapshot.
  - **Harmonisasi Desain Tema Kartu Tesis & Snapshot**: Sinkronisasi penuh token warna CSS kartu tesis melayang dan overlay snapshot dengan tema grafik aktif (#129).

### 🔄 Diubah (Changed)
- **Penyempurnaan Alur Gestur Pasca Menggambar (Draw by Holding Engine)**:
  - Mengembalikan kursor mouse ke kursor default dan mengaktifkan seleksi langsung (*auto-select*) pada objek gambar baru hasil gestur.
  - Mengisolasi penanganan pointer event kanvas tinta (*ink canvas*) dan mereset status drag grafik untuk mencegah pergeseran kanvas hantu (*ghost panning*).

### 🐛 Diperbaiki (Fixed)
- **Perbaikan Transparansi Kanvas Vela & Urutan Kompositor Watermark**:
  - Mengatasi latar belakang hitam pekat internal kontainer Vela saat mode custom background aktif.
  - Memperbaiki urutan komposit snapshot agar lilin grafik dirender terlebih dahulu sebelum tanda air keamanan, memastikan teks watermark profil melayang jelas di atas candlestick tanpa tertimpa kanvas pekat.

## [0.25.0] - 2026-10-31

### 🚀 Ditambahkan (Added)
- **Mesin Gambar Berbasis Gestur "Draw by Holding" (ADR-0013, #102, #104, #105, #106, #107):**
  - **Natural Inking via Shortcut Hold (`Shift+D` / `~`)**: Pengguna dapat menahan pintasan keyboard (`Shift+D` atau `~` / Backquote) lalu menggoreskan mouse di atas grafik secara bebas untuk langsung melahirkan alat gambar yang sesuai.
  - **Pengenalan Pola Geometris Cerdas (*Gesture Recognizer*)**:
    - *Trend Line*: Goresan garis lurus miring secara presisi menghubungkan titik awal dan akhir.
    - *Ray*: Goresan garis lurus horizontal/miring yang menembus batas sumbu harga kanan.
    - *Horizontal Line*: Goresan mendatar (< 15°) otomatis menempel (*snap*) pada wick / lilin terdekat.
    - *Vertical Line*: Goresan tegak lurus (> 75°) menancap pada waktu bar lilin.
    - *Rectangle / Box*: Goresan tertutup bersudut empat dengan deteksi rasio aspek bounding box.
    - *Ellipse*: Goresan loop oval melingkar tertutup.
    - *Fib Retracement*: Goresan tiga sisi zigzag swing-to-swing untuk memproyeksikan level Fibonacci.
    - *Arrow*: Batang garis dengan ujung kait panah terarah.
    - *Path*: Garis bersegmen dengan deteksi belokan sudut tajam.
  - **Penghapusan Coretan Cepat (*Scribble Erase*)**: Menggoreskan coretan zig-zag bolak-balik di atas objek gambar yang ada akan langsung menghapusnya seketika, dengan dukungan penuh pemulihan riwayat *Undo* (`Ctrl+Z`).
  - **Siklus Kandidat Interaktif (*Tab*) & Pembatalan (*Esc*)**: Menampilkan *floating HUD* kandidat berbatas waktu; menekan `Tab` berganti ke interpretasi alat alternatif (misal dari garis ke ray), dan `Esc` membatalkan pembuatan objek seketika.
  - **Katalog Panduan Visual (*Visual Cheatsheet Modal*)**: Modal panduan visual "Draw by holding" dengan kartu ilustrasi pola coretan untuk setiap alat yang dapat diakses langsung dari tombol toolbar samping atau pintasan.
- **Revamp Sistem Pintasan Keyboard & Input Timeframe Cepat (#102, #103):**
  - **Timeframe Quick Input Bar**: Mengetik angka (misal `1`, `5`, `15`, `60`, `240`) langsung memunculkan popover bar pencarian timeframe yang cepat dan responsif, menggantikan popup lama yang kaku.
  - **Input Dispatcher Terpusat**: Penyempurnaan isolasi penekanan tombol keyboard agar tidak bentrok dengan input form modal, Pine IDE, atau menu pencarian koin (`Ctrl+K`).
  - **Pencegahan Konflik Shortcut**: Shortcut gestur dialihkan ke `Shift+D` agar tidak memicu pencarian koin (`D`), serta pemulihan tool otomatis saat tombol shortcut dilepas.

### 🔄 Diubah (Changed)
- **Seleksi Alat & Perubahan Kursor Otomatis Pasca Gestur**:
  - Setelah goresan selesai, alat yang dikenali langsung aktif di toolbar dan kursor mouse otomatis berganti ke alat tersebut di kanvas grafik Vela.
  - Resolusi titik anchor secara otomatis mengonversi koordinat piksel goresan ke nilai waktu dan harga (*time/price*) grafik Vela melalui *drawing projector*.

## [0.24.0] - 2026-10-30

### 🚀 Ditambahkan (Added)
- **Pengaturan Lokasi Penyimpanan Snapshot Kustom (#97, #98, #99, #100, #101):**
  - **Pemilih Folder Native OS**: Tombol "Pilih Folder..." di menu Pengaturan (tab Umum) yang membuka dialog pemilih direktori native sistem operasi secara asinkron (`rfd`) di Windows, macOS, dan Linux.
  - **Konfigurasi `snapshotDirectory` di `appSettings`**: Pengguna dapat menentukan folder kustom (misal `~/Pictures/Screenshots`, `/media/storage/snaps`, atau drive sekunder) dengan persistensi SQLite lokal dan fallback otomatis ke folder `Downloads` bawaan OS.
  - **Quick Folder Chips**: Tombol cepat untuk beralih instan antara `Downloads (Bawaan)`, `Pictures/Screenshots`, dan `Desktop`.
  - **Tombol "Buka Folder" Terpadu**: Membuka langsung folder penyimpanan di File Manager native (Nautilus, Dolphin, Explorer, Finder) dari menu Pengaturan dan modal pratinjau snapshot.
- **Pipa Ekspor Biner Berkinerja Tinggi & Pengamanan Filesystem (#97, #98, #100):**
  - **Transmisi Biner Raw IPC**: Mendukung pengiriman data biner mentah (`Uint8Array` / `Vec<u8>`) dari `canvas.toBlob()` langsung ke backend Tauri, menghilangkan lonjakan serialisasi string Base64 belasan megabyte di saluran IPC.
  - **Sanitasi Path Traversal Guard**: Penegakan sanitasi ketat pada nama berkas di sisi Rust (`Path::file_name()`), memangkas dan menolak karakter traversal (`../`, `..\`, absolute root, dan titik dua `:`) demi keamanan integritas filesystem.

### 🔄 Diubah (Changed)
- **Penyelarasan Kosakata Kanonik Domain**:
  - Menyelaraskan seluruh label antarmuka dengan `GLOSSARY.md`, menggunakan istilah kanonik `Clean Chart Export` dan `Branded Snapshot Frame` pada seluruh toggle opsi ekspor.
- **Pengerasan Layanan & Integritas Umpan Balik Fallback**:
  - Menghapus tipe `any` pada `saveSnapshotToFile` menuju pengetikan TypeScript yang ketat.
  - Memastikan umpan balik unduhan fallback melaporkan folder `Downloads/[filename]` secara jujur saat terminal dijalankan di luar lingkungan desktop.
  - Mengeliminasi overhead proxy `$state` Svelte 5 pada elemen kanvas DOM di modal pratinjau.

### 🐛 Diperbaiki (Fixed)
- **Pencegahan UI Freeze & Deadlock IPC pada Linux Fedora / WebKitGTK (#97):**
  - Memperbaiki siklus reaktivitas Svelte 5 pada `$effect` modal pratinjau dengan menerapkan transisi tepi (`wasOpen`) dan pembungkus `untrack()`.
  - Mengisolasi pembaruan harga ticker WebSocket real-time (`capturedPrice`) sehingga fluktuasi harga tidak lagi memicu render komposit berulang tanpa henti.
  - Mengganti konversi sinkron berat `toDataURL` skala penuh 2x HiDPI dengan pembuatan thumbnail ringan (`createSnapshotThumbnail`) dan `URL.createObjectURL(blob)`, mengeliminasi saturasi antrean IPC dan deadlock GPU buffer di WebKitGTK.

## [0.23.0] - 2026-10-30

### 🚀 Ditambahkan (Added)
- **Offline Branded Snapshot Engine & Attribution Bar (ADR 0012, #92, #93):**
  - **Zero-Obtrusive Branded Frame**: Menggantikan watermark diagonal tradisional dengan bingkai kartu gelap minimalis berlatar belakang adaptif mengikuti tema aktif (`#0F0F0F` pada Signature Dark), sudut membulat 12px, border redup `1px rgba(255, 255, 255, 0.08)`, dan padding 24px di sekeliling grafik tanpa mengaburkan candlestick atau wick.
  - **Attribution Bar Terpadu**: Bilah metadata di bagian bawah kartu memuat logo monogram resmi `tr` hot pink (`#FF69B4`), nama brand `trawangan`, badge instrumen (`[SYMBOL] · [TF] · [BURSA]` atau `MULTI-CHART GRID · [LAYOUT] · [BURSA]`), harga penutupan terakhir terformat, stempel waktu lokal pengguna (WIB/UTC), dan tautan publik `kaleksananbarqi.github.io/trawangan`.
  - **Clean Chart Export Mode**: Opsi ekspor murni kanvas grafik WebGL2 tanpa bingkai luar atau footer untuk keperluan penyusunan laporan teknis dan embedding bersih.
  - **2x HiDPI Ultra-Sharp Rendering**: Komposit kanvas 2D dirender pada skala resolusi tajam 2x HiDPI sehingga teks dan detail garis lilin tetap jernih di layar resolusi tinggi.
  - **100% Offline & Zero Paywall**: Seluruh komposit rendering berjalan di sisi klien secara lokal tanpa lalu lintas jaringan, tanpa server cloud eksternal, dan tanpa pelacakan telemetri.
- **Header Camera Action & Pintasan Global (ADR 0012, #92, #94):**
  - **Tombol Kamera & Snapshot Menu (`SnapshotMenu.svelte`)**: Menyematkan tombol aksi `Camera` di Header kanan terminal dengan menu popover berisi 3 opsi aksi cepat: *Salin Gambar ke Clipboard*, *Simpan Gambar (PNG)*, dan *Pratinjau & Kustomisasi...*.
  - **Pintasan Keyboard Global `Ctrl+Shift+S`**: Mendaftarkan shortcut keyboard global pada `commandDispatcher` untuk menyalin tangkapan grafik ke clipboard sistem dalam waktu < 2 detik (*Clipboard-First*).
  - **Floating Snapshot Toast (`SnapshotToast.svelte`)**: Menampilkan notifikasi visual toast di sudut layar saat snapshot berhasil disalin, lengkap dengan thumbnail pratinjau, pesan resolusi 2x HiDPI, tombol aksi *"Buka Pratinjau"*, dan tombol *"Unduh File"*.
- **Modal Pratinjau Interaktif & Persistensi Pengaturan (ADR 0012, #92, #95):**
  - **Interactive Snapshot Preview Modal (`SnapshotPreviewModal.svelte`)**: Dialog modal pratinjau dengan kontrol zoom responsif (25% hingga 300%), sakelar mode *Branded Frame* vs *Clean Chart*, toggle tampilan harga dan waktu, serta tombol aksi cepat *Salin ke Clipboard* dan *Unduh PNG*.
  - **Dukungan Multi-Chart Grid Scope**: Kemampuan memilih cakupan tangkapan antara *Chart Aktif Saja* atau *Seluruh Grid Workspace* (1, 2, 2H, 4 sel) saat tata letak multi-chart aktif.
  - **Persistensi SQLite Lokal (`appSettings`)**: Preferensi snapshot pengguna (`snapshotIncludeFrame`, `snapshotIncludePrice`, `snapshotIncludeTimestamp`, `snapshotScope`) tersimpan persisten ke basis data SQLite lokal.
  - **Penamaan Berkas Terstruktur**: Format unduhan file otomatis mengikuti standar rapi `trawangan-[symbol]-[timeframe]-[timestamp].png`.

### 🔄 Diubah (Changed)
- **Ekstraksi Kanvas Terpusat**:
  - Mendelegasikan penanganan ekstraksi kanvas sel WebGL dan stitching layout multi-chart ke `ChartSessionController.getScreenshotCanvas(scope)`, menjadikan antarmuka `Chart.svelte` facade tipis yang bersih.
- **Deduplikasi Pemformatan Harga**:
  - Menyelaraskan logika format harga snapshot dengan `priceScaleLabelService.formatPriceLabel` untuk konsistensi representasi desimal bursa dan kripto.

## [0.22.0] - 2026-10-27

### 🚀 Ditambahkan (Added)
- **Hybrid Asset Logo Engine (ADR 0011, #86, #89, #90):**
  - **Offline-First Local SVG Bundle**: Menyertakan 43 aset logo vektor koin lokal di `static/icons/coins/` untuk koin-koin top (BTC, ETH, SOL, BNB, XRP, DOGE, dll.) dan mata uang kuotasi utama (USDT, USDC, IDR), menjamin render seketika tanpa jeda jaringan (<1ms).
  - **3-Tier Cascade Resolution**: Strategi resolusi bertingkat yang andal (Tier 1: SVG Lokal bawaan ➔ Tier 2: CDN Kripto Publik jsDelivr/SpotHQ ➔ Tier 3: Monogram Avatar deterministik dengan palet gradien berbasis hash ticker string).
  - **Dual-Asset Badging**: Komponen visual `<SymbolLogo />` yang menampilkan logo aset dasar (*base asset*) berdampingan dengan badge mini aset kuotasi (*quote asset*) di sudut kanan-bawah secara otomatis untuk pasangan rasio non-USDT (seperti `ETH/BTC` dan `BTC/IDR`).
  - **Integrasi Visual Luas**: Menyematkan logo koin di seluruh titik antarmuka pengguna: Header bilah atas, Bilah Koin Cepat (*Quick Symbols*), Modal Pencarian Simbol, dan Panel Daftar Pantau (*Watchlist*).
- **Adaptive Quote Parser & Arbitrary Pair Search (ADR 0011, #86, #87):**
  - **Pencarian Pasangan Fleksibel**: Mendukung pencarian pasangan koin antar-kripto dalam berbagai format query (`ETHBTC`, `ETH/BTC`, `ETH-BTC`, `ETH_BTC`) tanpa memaksakan penambahan sufiks `USDT`.
  - **Venue Capability Guard**: Mencegah pembuatan kontrak derivatif perpetual `.P` fiktif (`ETHBTCUSDT.P`) untuk pasangan kripto-ke-kripto, memastikan perutean bursa diarahkan secara tepat ke pasar Binance Spot.
  - **In-Memory Registry Spot Pair Expansion**: Memperluas registri pasangan offline dengan pasangan spot BTC terpopuler (`POPULAR_BTC_PAIRS`) untuk penelusuran kilat sub-10ms.
- **Crypto-Denominated Precision & BTC Filter Chips (ADR 0011, #86, #88):**
  - **Chip Filter Kuotasi BTC (₿)**: Menambahkan filter kuotasi `BTC (₿)` di samping USDT dan IDR pada dialog pencarian instrumen pasar.
  - **Presisi Satoshi 8 Desimal**: Memperbarui mesin format skala harga dan kartu watchlist agar menampilkan kuotasi Bitcoin dengan format satoshi hingga 8 desimal (`0.03451234 ₿`) tanpa simbol mata uang dolar (`$`).

### 🔄 Diubah (Changed)
- **Ekstraksi Ticker Bersih**:
  - Mengganti pemotongan string kaku pada resolusi logo koin dengan memanfaatkan fungsi kanonikal `parseAdaptiveSymbol`.
- **Pengaturan Gradien Monogram Avatar**:
  - Memperbarui latar belakang avatar teks koin dari warna solid menjadi gradien 135 derajat berbasis rona warna hash deterministik agar konsisten dengan estetika tema gelap Obsidian Vela.

## [0.21.0] - 2026-10-21

### 🚀 Ditambahkan (Added)
- **Jam Bursa Dunia Default di StatusBar (Tokyo, London, New York):**
  - Menampilkan jam 3 pusat keuangan utama dunia secara default: Tokyo (`TYO` / TSE - `Asia/Tokyo`), London (`LON` / LSE - `Europe/London`), dan New York (`NY` / NYSE - `America/New_York`) berformat `HH:mm` berdampingan dengan jam lokal sistem (`HH:mm:ss <TZ>`) di footer terminal.
  - **Deteksi Sesi Pasar Real-Time (*Market Session Status*)**: Indikator visual dot (Hijau = **OPEN**, Abu-abu = **CLOSED**) yang mengevaluasi jam kerja bursa secara presisi (TSE: 09:00–15:30 JST, LSE: 08:00–16:30 GMT/BST, NYSE: 09:30–16:00 EST/EDT) dengan penanganan otomatis *Daylight Saving Time* (DST) dan libur akhir pekan.
  - **1-Klik Sinkronisasi Timezone Grafik**: Mengklik salah satu pill jam bursa langsung mengubah zona waktu chart (`chartSessionController.setTimezone`) ke kota tersebut dengan aksen border pink aktif (`#ff69b4`). Mengklik jam lokal mereset timezone chart ke zona lokal pengguna.
  - **Adaptasi Responsif Layar Sempit (< 1079px)**: Deretan jam dunia otomatis menciut menjadi tombol popover interaktif `World Clocks` saat ruang bilah status terbatas agar tidak mendesak tombol utilitas telemetri dan terminal logs.
  - **Kustomisasi Seleksi Bursa di Modal Settings**: Menambahkan toggle global `showWorldClocks` serta pemilih bursa mandiri (*chip-toggle*) di **Settings > Preferensi Regional** untuk fleksibilitas pengaturan kota yang ingin ditampilkan.

### 🔄 Diubah (Changed)
- **Normalisasi Format Jam Lokal:**
  - Format waktu lokal kini selalu menggunakan separator titik dua standar (`HH:mm:ss`) serta mendeteksi singkatan zona waktu sistem secara dinamis (`WIB`, `WITA`, `WIT`, `JST`, `BST`, dll.) menggunakan API `Intl.DateTimeFormat`.
- **Standarisasi Terminologi Pengaturan:**
  - Mengubah label status nonaktif toggle jam dunia dari *"Senyap"* menjadi *"Nonaktif"* agar selaras dengan toggle preferensi lainnya.

## [0.20.0] - 2026-10-21

### 🚀 Ditambahkan (Added)
- **Arsitektur Dual-Layer Snapping ("Sticky") (ADR 0010, #81, #82):**
  - **Tick-Aligned Price Guard**: Mesin pembulatan harga adaptif bertingkat yang selalu mematuhi ukuran *tick* bursa atau presisi nominal harga aset (mencegah desimal liar tak berhingga seperti `$68421.391827419`).
  - **OHLC Magnet Snapping**: Mengunci koordinat harga secara otomatis ke titik Open, High, Low, atau Close lilin candlestick terdekat dengan radius toleransi 15 piksel, memprioritaskan titik ekstrem sumbu lilin (High/Low) di atas Open/Close.
  - **Shift Inversion Guard**: Menahan tombol `Shift` saat melakukan *drag* garis batas atau menggambar akan membalik status snapping secara sementara untuk fleksibilitas instan tanpa bolak-balik menyalakan kontrol toolbar.
  - **Snap Halo Indicator**: Umpan balik visual berupa titik pendar (*halo dot*) beranimasi denyut (*pulse*) tepat pada koordinat X dan Y lilin yang sedang dikunci, disertai tag `MAGNET: HIGH/LOW` pada badge harga.
- **Revamp Manajemen Alert Dua Arah (ADR 0010, #81, #83, #84):**
  - **Unified Create & Edit Modal (`CreateAlertModal.svelte`)**: Merefaktor dialog alert untuk mendukung mode pembuatan maupun penyuntingan penuh dengan data lama terisi otomatis, tombol "Simpan Perubahan" yang memanggil `alertService.updateAlert`, serta tombol aksi cepat "Hapus Alert Ini".
  - **Akses Sunting Langsung di Kanvas (`Chart.svelte`)**: Menambahkan tombol pensil (*Edit*) dan dukungan *double-click* langsung pada *badge* garis alert kanvas grafik untuk membuka modal sunting seketika.
  - **Tombol Sunting di Panel Samping (`WatchlistPanel.svelte`)**: Menyematkan tombol aksi edit berikon pensil (`Pencil`) pada setiap item baris daftar alert.
- **Integrasi Presisi pada Long/Short Position Tool (#85):**
  - Ketiga jangkar pengukuran harga pada *Risk/Reward Position Tool* (Entry, Stop Loss, dan Take Profit) kini otomatis disanitasi menggunakan *Tick-Aligned Price Guard* dan mematuhi penambatan magnet lilin OHLC, memastikan rasio risiko/imbalan dihitung dari level harga yang bersih.

### 🔄 Diubah (Changed)
- **Sanitasi Otomatis pada `alertService`:**
  - Metode `addAlert` dan `updateAlert` pada `alertService` kini secara otomatis melakukan kuantisasi harga target ke kelipatan *tick size* terdekat sebelum disimpan ke penyimpanan lokal dan disiarkan ke subscriber.

## [0.19.0] - 2026-10-19

### 🚀 Ditambahkan (Added)
- **Arsitektur Dual-Track Volume & Native WebGL2 Overlay (ADR 0009, #76):**
  - Menerapkan arsitektur volume jalur ganda (*Dual-Track Volume Architecture*): layer histogram volume bawaan engine WebGL2 Vela (`nativeType: 'volume'`) aktif secara default di bagian bawah kanvas harga utama untuk setiap sel grafik baru. Memberikan render 60 FPS bebas *latency* tanpa membebani Web Worker Pine Script.
  - Menyediakan skrip resmi Pine Script v5 untuk Volume di katalog indikator, dilengkapi garis Moving Average (SMA 20) dan pewarnaan lilin *up/down* bagi pengguna yang membutuhkan kustomisasi formula atau sinyal *alert*.
  - Menambahkan kontrol visibilitas volume (`showVolume`) terintegrasi pada **Settings Modal -> General/Chart** dan langsung di bilah dock **Unified Object Tree** (ikon mata).
- **Session VWAP dengan Dual Standard Deviation Bands (ADR 0009, #76):**
  - Menyediakan preset resmi **Session VWAP** Pine Script v5 (mengadopsi basis formula resmi TradingView v6) dengan atribut `overlay=true`.
  - Kalkulasi kumulatif `ta.vwap` dengan *session reset* harian berbasis zona waktu bursa (*exchange timezone*).
  - Dilengkapi pita deviasi standar ganda (±1σ dan ±2σ) serta arsiran transparan (*translucent fills*), dengan parameter pengganda deviasi dan visibilitas band yang dapat dikonfigurasi melalui dialog *Inputs*.
- **Kategori Khusus 'Volume' pada Pustaka Indikator (ADR 0009):**
  - Menambahkan kategori resmi baru **`Volume`** pada modal katalog indikator (`IndicatorModal.svelte`), mengelompokkan preset Volume dan Session VWAP agar mudah ditemukan.
- **Sinkronisasi Multi-Chart & Persistensi Workspace:**
  - Status visibilitas volume disimpan persisten di dalam skema `SavedWorkspace` dan snapshot sesi `ChartSessionController`.
  - Sinkronisasi perubahan visibilitas volume otomatis menyebar ke seluruh sel grafik saat multi-chart sync aktif.
- **Lisensi Proyek:**
  - Menambahkan berkas lisensi resmi open-source MIT License ke repositori.

### 🔄 Diubah (Changed)
- **Sinkronisasi Warna Volume Otomatis Mengikuti Tema Aktif:**
  - Menyelaraskan palet warna volume (baik Native WebGL2 histogram maupun Pine Script Volume study) secara otomatis dan *real-time* saat berganti tema terminal (Dark, Light, Retro Terminal, dll.), memastikan kontras lilin *bullish* dan *bearish* tetap optimal tanpa perlu reload halaman.

### 🐛 Diperbaiki (Fixed)
- Memperbaiki evaluasi eksekusi formula VWAP Pine Script dan penanganan sinkronisasi multi-chart layout.

## [0.18.1] - 2026-10-19

### 🐛 Diperbaiki (Fixed)
- **Sinkronisasi Multi-Watchlist Registry & Modal Pencarian Simbol:**
  - Memperbaiki `handleToggleWatchlistSymbolFromSearch` di root page agar memutasi `watchlistRegistry.updateActiveItems` dan `insertSymbolIntoSection`, memastikan koin yang disimpan dari dialog `SymbolSearchModal` (`Ctrl+K` / Header / *Cari Pair*) langsung tercatat ke registry dan counter pada dropdown switcher seketika bertambah.
  - Menghubungkan root page secara reaktif ke `watchlistRegistry.subscribe()` sehingga instrumen pada watchlist aktif non-default (seperti watchlist kustom "futures") selalu sinkron saat beralih daftar pantau.
- **Klarifikasi Label Menu Klik Kanan Koin:**
  - Mengubah label menu context klik kanan pada baris koin dari *"Daftar Utama (Tanpa Kategori)"* menjadi *"Tanpa Kategori (Bagian Atas)"* untuk mengeliminasi kebingungan pengguna saat berada di watchlist selain "Daftar Utama".
- **Normalisasi Format Bursa & Pencarian Omni-Search:**
  - Memperbaiki `handleAddSymbolFromExchange` dan pengecekan `isInWatchlist` pada template omni-search agar menggunakan `formatWatchlistEntry` dan `parseWatchlistEntry` yang konsisten dengan provider.
  - Memperbolehkan sinkronisasi daftar simbol lokal ketika bernilai array kosong (`[]`) untuk watchlist baru yang belum memiliki instrumen.
  - Menambahkan guard idempotensi `if (this.isLoaded)` pada `WatchlistRegistryService.load()` untuk mencegah *race condition* reload.
- **Proteksi Navigasi Shortcut Keyboard:**
  - Menyaring token divider kategori (`#section:`) pada navigasi instrumen keyboard (`Space` / `Shift+Space`), memastikan chart hanya berpindah ke pair perdagangan valid.

## [0.18.0] - 2026-10-19

### 🚀 Ditambahkan (Added)
- **Multi-Watchlist Registry & Switcher Popover (ADR-0008, #70, #71, #72):**
  - Menggantikan bilah preset statis lama dengan bilah dropdown selektor popover di bagian atas panel Watchlist (`WatchlistSwitcher.svelte`).
  - Mendukung pembuatan daftar pantau tak terbatas dengan nama kustom, duplikasi cepat, ganti nama, dan penghapusan dengan modal konfirmasi aman.
  - Menyediakan preset sistem pabrik (`Binance Top 10` dan `Indodax IDR`) yang bebas dimodifikasi dengan tombol penyelamat *"Reset ke Bawaan"*.
  - Proteksi terminal: daftar pantau terakhir dan "Daftar Utama" tidak dapat dihapus, dengan auto-fallback otomatis saat penghapusan watchlist aktif.
  - Migrasi transparan tanpa kehilangan koin dari format penyimpanan warisan (*legacy storage*) ke slot `user_multi_watchlists`.
- **Watchlist Section Dividers & Grouping (ADR-0008, #70, #73, #74):**
  - Format data linier *Flat Ordered List* berbasis token `#section:<id>:<name>:<isCollapsed>`, memastikan operasi pembacaan dan reordering berkecepatan $O(1)$.
  - Baris pembatas kategori (*Section Dividers*) visual dengan status *collapse/expand* yang tersimpan persisten di penyimpanan lokal.
  - Menu aksi kategori titik tiga (`···`) untuk *"Ganti Nama Kategori"* dan *"Hapus Kategori (Simpan Koin)"* (menghapus kategori tidak menghapus instrumen di dalamnya).
  - Tombol toolbar [`FolderPlus`] untuk penambahan kategori baru secara instan.
- **Symbol Placement Cerdas, Drag & Drop, dan Menu Aksi Koin (#70, #75):**
  - **Penempatan Simbol Otomatis:** Koin baru yang ditambahkan via input cepat `+`, Omni-Search, maupun menu `Ctrl+K` otomatis disisipkan ke bawah kategori terbuka terakhir (atau di paling atas daftar jika tanpa kategori).
  - **Drag & Drop Reordering:** Menyeret (*drag and drop*) koin maupun baris pembatas kategori melintasi seksi dengan indikator garis pemandu aksen (*accent drop target line*).
  - **Menu Aksi & Klik Kanan Koin:** Tombol opsi hover `···` dan klik kanan (`oncontextmenu`) pada baris instrumen untuk *"Pindahkan ke Kategori..."* dengan submenu pilihan kategori.
- **Multiplexer Safe Polling Filter:**
  - Token seksi disaring di tingkat `subscribeWatchlistTickers` dan `pollTick` sehingga adapter bursa tidak pernah menerima string non-ticker.
  - Instrumen di bawah kategori terlipat (*collapsed*) tetap dipolling secara aktif di latar belakang sehingga Price Alert dan data harga seketika segar saat kategori dibuka kembali.

### 🔄 Diubah (Changed)
- Mengisolasi perubahan multi-watchlist murni di dalam tab Watchlist, menjaga bilah *Quick Symbols* di Header tetap bersih dan ringkas.
- Sinkronisasi instrumen watchlist aktif ke penyimpanan legacy secara otomatis menyaring token kategori agar tidak mencemari pembacaan data eksternal.

### 🐛 Diperbaiki (Fixed)
- Memperbaiki kompilasi Linux pada `tauri-plugin-deep-link` dengan mengunci dependensi `rust-ini` ke versi `0.21.1`.

## [0.17.0] - 2026-10-19

### 🚀 Ditambahkan (Added)
- **Unified Object Tree & Layer Inspector (ADR 0007):**
  - Menyatukan layer Indikator Aktif dan Objek Gambar Teknikal ke dalam dua grup hierarki *collapsible* pada dock panel kanan.
  - Kontrol granular per item: toggle visibilitas, gembok (lock/unlock), hapus individual, konfigurasi parameter (gear), dan tombol pembuka source code langsung di Pine IDE.
  - Aksi massal: sembunyikan semua gambar, kunci semua gambar, dan hapus semua gambar secara serentak dengan modal konfirmasi.
  - Sinkronisasi dua arah (*Two-Way Selection Sync*): klik item di layer menyorot objek di kanvas; klik objek gambar di kanvas menyorot dan menggulir otomatis (*smooth scroll into view*) item di panel layer, serta membuka grup yang tertutup secara reaktif.
- **Chart Deep Link Bridge & Browser Interception (ADR 0007):**
  - Mendaftarkan skema protokol native OS `trawangan://` dengan Single-Instance Guard (`tauri-plugin-single-instance` & `tauri-plugin-deep-link`) agar tautan dari browser eksternal langsung memfokuskan jendela Trawangan aktif tanpa membuat proses baru.
  - Normalisasi simbol otomatis: membersihkan sufiks kontrak derivatif (`.P`, `-PERP`, `SWAP`) dan parsing base/quote currency.
  - **Multi-Provider Fallback Routing:** Memprioritaskan feed bursa asal (misal Binance), dan secara otomatis mengalihkan feed ke bursa cadangan terbaik (`bitunix`, `indodax`, `bybit`) jika pair tidak tersedia di bursa asal, disertai notifikasi visual transparan.
- **Companion Userscript Tampermonkey v1.1.0 & Interactive Floating HUD:**
  - Skrip browser pendamping (`scripts/trawangan-browser-bridge.user.js`) dengan metode peluncuran anchor click dan Floating Action Banner interaktif di halaman TradingView untuk memintas pemblokiran pop-up browser.
  - Sinkronisasi otomatis ke clipboard untuk memicu Smart Clipboard Watcher di latar belakang.
- **Smart Clipboard Link Sentry:**
  - Pemantau papan klip lokal pasif dengan deduplikasi hash saat jendela Trawangan difokuskan, memunculkan toast konfirmasi non-intrusif ("Buka di Trawangan" / "Abaikan") di pojok kanan bawah terminal.
- **Panduan & Skrip Browser Terintegrasi di Pengaturan:**
  - Seksi panduan dan tombol 1-klik salin skrip Tampermonkey terpasang di tab **Bantuan & Shortcut (F1)** dan **Sistem & Skrip Browser**.

### 🔄 Diubah (Changed)
- **Peningkatan Tipografi & Keamanan Tipe (Type Safety):**
  - Menambahkan metode formal `getSearchEngine(): SymbolSearchEngine` pada antarmuka `IMarketFeedService` dan `MarketFeedService`, mengeliminasi unsafe type assertion `(marketFeed as any)`.
  - Mengganti repeated switches pemetaan bursa dengan kamus pemetaan konstan `EXCHANGE_MAP`.

### 🧪 Pengujian (Tests)
- Menambahkan 25 unit test baru pada `tests/urlInterceptorService.test.ts`, `tests/clipboardWatcherService.test.ts`, dan `tests/chartDrawingLayerOperations.test.ts` (total 237 tests passing di 36 suites, 100% lulus).

## [0.16.0] - 2026-10-18

### 🚀 Ditambahkan (Added)
- **Isolasi Objek Gambar Analitis per Bursa (Exchange-Aware Drawing Isolation) (#64, #65):**
  - Menerapkan arsitektur compound storage key `${providerId}:${symbol}` pada kanvas grafik dan SQLite lokal, memisahkan coretan teknikal antar bursa secara absolut (misal BTCUSDT di Binance terpisah dari BTCUSDT di Bitunix).
  - Mengimplementasikan pembersihan kanvas eksplisit via `clearCanvasVisuals()` saat berpindah konteks dan fallback kompatibilitas mundur ke data legacy `binance`.
- **Navigasi Bursa Deterministik pada Pencarian Simbol (#64, #66):**
  - Memastikan pemilihan simbol dari modal pencarian (Ctrl+K) langsung beralih ke bursa target sesuai `providerHint`, mengeliminasi network error palsu.
- **Watchlist Polling Multiplexer Multi-Bursa (#64, #67):**
  - Mempartisi simbol daftar pantau dan mengeksekusi polling harga latar belakang secara paralel ke masing-masing adapter bursa (`binance`, `bitunix`, `indodax`) tanpa membebani provider aktif.
- **Model Data Watchlist Multi-Provider & Badge Visual Venue (#64, #68):**
  - Mendukung format entri watchlist `${providerId}:${symbol}` dengan backward compatibility parsing.
  - Menghadirkan badge visual venue (`.venue-badge`) pada Omni-Search dan Watchlist panel, serta auto-routing bursa 1-klik saat simbol dipilih.
- **Drawing Synchronization Boundary Guard Multi-Chart (#64, #69):**
  - Membatasi propagasi gambar analitis hanya antar sel grafik yang berbagi `providerId` dan `symbol` yang identik, mencegah distorsi skala harga lintas bursa pada layout multi-pane.
- **Native Rust IPC HTTP Bridge Bebas CORS:**
  - Menyediakan perintah native Tauri IPC `http_get` via `reqwest` di backend Rust dan bridge `universalFetch` di frontend. Menghilangkan 100% pemblokiran CORS WebView2 Chromium saat memuat feed pasar, candle Vela, dan ping telemetri untuk Bitunix dan Indodax.

### 🐛 Diperbaiki (Fixed)
- **Eliminasi Hilangnya Gambar saat Switch Simbol Cepat (Event Suppression Guard & Debounce Flush):**
  - Mencegah penimpaan dokumen kosong ke database SQLite akibat cascading event `drawing:removed` saat pembersihan kanvas dengan guard `isRestoring`.
  - Mengimplementasikan `flushDrawings()` untuk mengamankan perubahan gambar in-flight yang terjadi dalam interval debounce 400ms sebelum konteks simbol berpindah.
- **Perbaikan Status Palsu `FEED STALLED` & `FEED BLOCKED`:**
  - Menghilangkan kegagalan HTTP akibat pembatasan CORS pada Bitunix dan Indodax di desktop app.
  - Memperbaiki cacat endpoint single ticker Bitunix dari 404 menjadi batch lookup `/tickers`.

### 🧪 Pengujian (Tests)
- Menambahkan test suite baru: `tests/exchangeAwareDrawing.test.ts`, `tests/deterministicProviderSwitching.test.ts`, `tests/multiProviderPolling.test.ts`, `tests/exchangeAwareWatchlist.test.ts`, `tests/multiChartSync.test.ts`, `tests/drawingContextPreservation.test.ts`, dan `tests/universalHttpClient.test.ts` (total 212 tests passing).

## [0.15.0] - 2026-10-14

### 🚀 Ditambahkan (Added)
- **Harmonisasi Warna Candlestick dengan Theme Preset WebGL2 (#59, #60):**
  - Mengintegrasikan pembaruan `applyConfig({ candles, bars })` pada `ChartSessionController.setTheme()` sehingga seluruh Theme Preset (Signature, Binance Classic, Bitunix Neon, TradingView, Coinglass) langsung memperbarui warna badan, sumbu (*wick*), dan garis tepi (*border*) candlestick di seluruh sel grafik WebGL2 tanpa memerlukan reload atau membuka dialog setelan internal Vela.
  - Mempertahankan Signature Theme cyberpunk minimalis dengan lilin bullish putih gading (`#F7F7F7`) dan bearish hot pink (`#FF69B4`).
- **Kustomisasi Lilin Hibrida (Bull & Bear) di Tab Tampilan (#59, #61):**
  - Menghadirkan kontrol pemilih warna mandiri (*color pickers*) untuk lilin Bullish dan Bearish di `AppearanceTab.svelte`.
  - Menerapkan kalkulasi deterministik penurunan kecerahan garis tepi (*border*) otomatis sebesar 15% via utilitas baru `deriveBorderColor()` di `colorUtils.ts` agar tepi lilin tetap tegas dan nyaman di mata tanpa konfigurasi rumit.
  - Menyediakan tombol *"Reset ke Tema"* untuk mengembalikan warna lilin ke setelan bawaan tema aktif dengan sekali klik.
  - Mendukung pengetikan langsung kode warna hex dengan auto-prefix simbol tanda pagar `#`.
  - Persistensi pengaturan warna kustom di `appSettings` tersimpan otomatis lintas sesi aplikasi.
- **Penyelarasan Transisi Tema & Reset Setelan Pabrik Cerdas (#59, #62):**
  - Memilih Theme Preset baru di grid kartu tema secara otomatis membersihkan warna kustom (*auto-clear*) agar pengguna langsung merasakan visual otentik dari tema baru yang dipilih.
  - Menyelaraskan tombol *"Reset ke Setelan Pabrik"* pada setelan grafik agar memulihkan lilin dan elemen grafik ke Theme Preset yang sedang aktif, bukan warna pabrik lawas.

### 🧪 Pengujian (Tests)
- Menambahkan rangkaian unit test menyeluruh pada `tests/chartThemeCandleSync.test.ts` (propagasi tema, override warna kustom, reset setelan pabrik) dan `tests/colorUtils.test.ts` (akurasi formula derivasi warna heksadesimal).

## [0.14.1] - 2026-10-14

### 🐛 Diperbaiki (Fixed)
- **Reaktivitas Timeframe, Layout Grid, dan Simbol Grafik (#55, #56, #57):**
  - **Propagasi Timeframe ke Vela Workspace (#56):** Memperbaiki metode `ChartSessionController.setTimeframe()` agar secara eksplisit meneruskan mutasi interval/timeframe ke seluruh sel workspace aktif via `cell.setTimeframe()`.
  - **Sinkronisasi Simbol & Timeframe (#56):** Menyelaraskan alur `setSymbol(symbol, timeframe)` pada controller sehingga pembaruan timeframe tidak hanya disimpan di memori internal, melainkan diteruskan ke sel grafik.
  - **Eliminasi Svelte 5 Effect Dependency Starvation (#57):** Memperbaiki penanganan `$state` pada `isMounted` di `Chart.svelte` dan mengekstrak evaluasi seluruh props (`symbol`, `timeframe`, `layout`, `syncConfig`, dll.) secara eksplisit di baris teratas blok `$effect`. Ini mencegah hilangnya pelacakan dependensi reaktif Svelte 5 yang sebelumnya menyebabkan pergantian timeframe, simbol, dan layout tidak bereaksi.
  - **Sinkronisasi Fokus Multi-Chart Cell (`cell:active`) (#56, #58):** Memasang listener event `cell:active` pada Vela Workspace di controller untuk memicu callback `onActiveCellChange({ symbol, timeframe })`, sehingga status simbol dan interval di top bar selalu tersinkronisasi saat pengguna mengeklik sel berbeda pada grid multi-chart.
- **Rangkaian Tes Regresi Reaktivitas Grafik (#58):**
  - Menambahkan pengujian end-to-end headless pada `tests/chartReactivityRepro.test.ts` dan `tests/chartSessionController.test.ts` untuk memvalidasi interaksi pergantian timeframe, transisi layout multi-chart, dan propagasi fokus sel.

## [0.14.0] - 2026-10-14

### 🚀 Ditambahkan (Added)
- **Deep ChartSessionController & Headless Lifecycle Seam (#49, #51):**
  - Mengimplementasikan `ChartSessionController` sebagai deep module independen yang mengabstraksi orkestrasi sesi grafik, siklus hidup WebGL2 Vela Workspace, inisialisasi multi-bursa (Binance, Indodax, Bitunix, Hyperliquid, Coinbase), dan pembersihan memori.
  - Mendukung injection `workspaceFactory` untuk eksekusi headless unit testing tanpa memerlukan DOM atau kanvas WebGL nyata.
- **Multi-Chart Grid Synchronization & Deep Workspace Persistence (#49, #53):**
  - Mengenkapsulasi alur perpindahan layout grid multi-chart (1, 2, 2h, 4 sel) beserta sinkronisasi kursor, viewport, simbol, dan indikator.
  - Menghadirkan rekonsiliasi atomik `saveWorkspaceState` dan `loadWorkspaceState` yang memulihkan proporsi sub-pane (`paneWeights`), konfigurasi skala harga logaritmik/manual (`priceScaleState`), style harga, bar spacing, serta indikator aktif ke seluruh sel.
  - Menyediakan persistensi pengaturan grafik pengguna (`saveCurrentSettingsAsDefault` dan `resetSettingsToFactory`).

### 🔄 Diubah (Changed)
- **Perampingan Monolit `Chart.svelte` (< 350 Baris) (#49, #54):**
  - Memangkas komponen inti `Chart.svelte` dari 2.940 baris menjadi hanya 347 baris presentasi deklaratif yang ramping dan mudah dipelihara.
  - Mengekstrak 440 baris stylesheet presentasi ke berkas terpisah `src/lib/components/chart.css`.
  - Mengeliminasi seluruh loop iterasi sel imperatif, mutasi DOM manual, dan redundansi observer dari lapisan view komponen.
- **Pembersihan Modul Dead Storage Facades (#49, #50):**
  - Mengeliminasi modul lama `drawingStorage.ts`, `workspaceStorage.ts`, dan `marketProvider.ts` yang redundan, serta memigrasikan seluruh pemanggil ke antarmuka resmi `persistence.ts` dan `marketFeed`.

### 🐛 Diperbaiki (Fixed)
- **Penyatuan Siklus Hidup Indikator & Defensive Price Line Guard (#49, #52):**
  - Mengintegrasikan manajemen indikator dan pencegahan residu zombie ke dalam controller tunggal, memastikan sinkronisasi penghapusan instans di semua sel grid.
  - Menyatukan interseptor defensif `enforceCurrentPriceLine` agar garis harga terkini tidak pernah hilang saat switching simbol, pergantian timeframe, atau mutasi layout multi-chart.

## [0.13.1] - 2026-10-14

### 🐛 Diperbaiki (Fixed)
- **Eliminasi Residu Zombie Indikator pada Siklus Save-Load Workspace (#48):**
  - Memperbaiki penanganan event `indicator:removed` dari engine Vela yang sebelumnya mengabaikan ID indikator yang dihapus.
  - Mengimplementasikan modul `IndicatorRegistry` dengan fitur auto-pruning indikator mati dan pencocokan ID multi-cell yang menyeluruh.
  - Memastikan `getActiveIndicators()` tidak lagi mengembalikan fallback handle zombie ke fungsi simpan workspace, sehingga indikator yang dihapus dari kanvas atau daftar objek tidak akan muncul kembali saat me-load workspace.

## [0.13.0] - 2026-10-13

### 🚀 Ditambahkan (Added)
- **Hand-Pull Pan Navigation Mode (#43, #45):**
  - Mode geser kanvas tangan (Hand-Pull) di bilah alat kiri untuk navigasi grafik yang mulus dan bebas distraksi.
  - Saat aktif, kursor kanvas berubah menjadi `grab` / `grabbing`, dan seluruh interaksi geser murni menggeser kanvas tanpa risiko memindahkan titik atau garis gambar teknikal.
  - Didukung tombol pintas <kbd>H</kbd> untuk beralih mode secara instan, serta penahanan tombol <kbd>Spacebar</kbd> untuk geser kanvas sementara.
- **Flyout Pointer & Navigation Selector (#43, #45):**
  - Slot teratas bilah alat gambar kiri diubah menjadi flyout selektor terpadu untuk Kursor (`MousePointer`), Hand-Pull (`Hand`), dan Penghapus (`Eraser`).
- **Interactive Single-Item Eraser Mode (#43, #46):**
  - Mode penghapus interaktif satuan yang terintegrasi langsung dengan engine Vela. Pengguna dapat menghapus objek gambar teknikal apa pun dengan 1-klik di kanvas tanpa menu konteks.
  - Menekan tombol <kbd>Esc</kbd> otomatis mengembalikan kontrol ke mode kursor standar.
- **Zero-Omission 76 Vela Drawing Tools Suite (#43, #47):**
  - Ketersediaan 100% dari seluruh 76 varian `DrawingTypeKey` engine Vela di toolbar Trawangan tanpa pengurangan.
  - Setiap varian alat gambar dilengkapi label dwibahasa, kata kunci pencarian berindeks, dan ikon visual Lucide yang spesifik tanpa *fallback* generik.
- **Quick Stamp Palette (#43, #47):**
  - Palette stempel visual cepat untuk alat `iconstamp` dan `flagmark`, menyediakan preset siap pakai: Target 🎯, Warning ⚠️, Breakout 🚀, Pin 📌, dan Flag 🚩.

### 🐛 Diperbaiki (Fixed)
- **Defensive Current Price Line Enforce Engine (#43, #44):**
  - Memasang interceptor defensif pada mutasi konfigurasi grafik Vela (`applyConfig`) agar mutasi parsial (perubahan tema, margin, toggle skala logaritmik) tidak pernah menimpa `priceScale.currentPriceLine` menjadi `undefined`.
  - Mengimplementasikan auto-healing pada siklus event `market:changed` dan `history:complete` dengan memicu `native.scheduler.invalidate(4)` untuk memastikan garis harga terkini selalu tampil konsisten tanpa berkedip atau hilang senyap.

## [0.12.1] - 2026-10-13

### 🐛 Diperbaiki (Fixed)
- **Eliminasi Svelte Runtime Error Duplicate Key pada Pencarian Simbol (#26):**
  - Mengatasi crash `https://svelte.dev/e/each_key_duplicate` saat membuka modal pencarian via `Ctrl+K`, Type-to-Search, atau tombol pencarian header.
  - Memperkenalkan helper `getSearchResultKey` untuk membentuk kunci unik majemuk (`provider:symbol:type`) sehingga item dari bursa yang berbeda (seperti `BTCUSDT.P` di Binance Futures dan Bitunix Futures) tidak lagi berbenturan pada blok `{#each}` Svelte.
  - Mencegah UI membeku (*freeze/stuck*) saat rekonsiliasi DOM komponen pencarian simbol.

### 🛡️ Pertahanan Berlapis (Defense-in-Depth)
- **Deduplikasi Final pada SymbolSearchEngine:**
  - Menambahkan filter deduplikasi akhir berbasis `getSearchResultKey` pada metode `search()` dan `searchLocal()` untuk menjamin integritas data 100% unik sebelum diteruskan ke antarmuka pengguna.
- **Penyelarasan Key pada Watchlist Omni-Search:**
  - Menyelaraskan blok perulangan hasil pencarian bursa di `WatchlistPanel` menggunakan `getSearchResultKey` yang konsisten.
- **Reset State Dialog Pencarian:**
  - Memastikan `query` dan `selectedIndex` ter-reset secara bersih ke `initialQuery || ''` dan `0` saat dialog dibuka.

## [0.12.0] - 2026-10-13

### 🚀 Ditambahkan (Added)
- **Ergonomi Kanvas & Intersepsi Keyboard Cepat (Type-to-Search Canvas Guard) (#26, #27):**
  - Intersepsi keystroke alfanumerik cerdas saat fokus pada kanvas grafik yang otomatis membuka modal pencarian simbol tanpa memicu gangguan manipulasi grafik atau konflik hotkey.
  - Akses pencarian simbol global instan melalui pintasan keyboard `Ctrl+K` / `Cmd+K` dengan auto-focus query input.
- **Pencarian Simbol Sub-5ms & Auto-Switching Provider Multi-Bursa (#26, #28):**
  - Respons pencarian simbol super cepat (< 5ms) memanfaatkan indeks cache memori lokal.
  - Pengalihan otomatis (*auto-switching*) penyedia data (Binance, Indodax, Bitunix) saat simbol dipilih dari hasil pencarian tanpa perlu konfigurasi manual.
- **Sinkronisasi Zona Waktu Reaktif Antar-Pane Vela Workspace (#26, #29):**
  - Sinkronisasi pengaturan zona waktu (WIB/Asia/Jakarta, UTC, Asia/Bangkok, New York, Tokyo, London, Sydney) secara reaktif ke seluruh sel multi-pane workspace grafik Vela dan native renderer.
- **Adaptive UI Typography Scale (#26, #30):**
  - Opsi skala ukuran tipografi antarmuka terpadu (Kompak 12px, Default 13px, Nyaman 14px, Luas 16px) yang secara adaptif menyesuaikan seluruh panel dock rail, bilah status, header, dan teks label kanvas.

### ⚡ Performa & Optimasi (Performance)
- **Promise Caching Dynamic Import pada `TauriSqliteAdapter` (#31):**
  - Meng-cache promise dynamic import dari `@tauri-apps/api/core` untuk menghindari overhead re-import berulang pada setiap pemanggilan database persistence layer.
- **Pre-allocation Array Candle Bitunix (#35):**
  - Mengoptimalkan alokasi memori heap dengan menginisialisasi ukuran array lilin di awal (`new Array(len)`) saat parsing respons pasar Bitunix.
- **Optimasi Pengambilan Watchlist di Rust Backend (#37):**
  - Menggantikan iterasi manual dengan idiomatic `.collect()` pada layer Rust Tauri untuk mempercepat serialisasi data watchlist.

### 🛡️ Keamanan & Perbaikan Bug (Fixed & Security)
- **Remediasi Celah DOM-based XSS pada `app.html` (#32):**
  - Mengganti injeksi `innerHTML` langsung pada variabel title dengan metode DOM aman (`createElement`, `textContent`) guna mengeliminasi potensi celah cross-site scripting.
- **Binding Timezone ke Konstruktor Vela & Renderer Native (#29):**
  - Menghubungkan opsi zona waktu langsung ke konstruktor `VelaWorkspace` serta pemanggilan `workspace.setTimezone(tz)` dan `native.set('timezone', tz)` agar sumbu waktu grafik selalu akurat.
- **Pembersihan Scanner Komentar Bug pada Test Suite (#40):**
  - Memperbaiki komentar pada `tests/chartPriceLineGuard.test.ts` agar tidak memicu false positive pada scanner audit kode.

### 🔄 Pemeliharaan Kode (Refactor & Docs)
- **Modularisasi `DEFAULT_COMMANDS` (#39):**
  - Mengekstrak registrasi command bawaan dari fungsi monolitik `createDefaultCommandDispatcher` menjadi konstanta tingkat modul untuk meningkatkan maintainability dan code health.
- **Standardisasi Workflow Rilis & Otomasi Logging MCP:**
  - Pembaruan skill otomasi rilis dengan validasi pre-flight git, verifikasi changelog, dan integrasi pencatatan Second Brain langsung melalui Obsidian MCP.

## [0.11.0] - 2026-10-13

### 🚀 Ditambahkan (Added)
- **Alur Price Alert Interaktif & Form Decoupling (#20, #21):**
  - Mengisolasi inisialisasi modal alert menggunakan transisi pembukaan satu kali (`lastIsOpen` + `untrack`), mengeliminasi bug reset input harga manual dan focus loop saat tick WebSocket pasar masuk.
  - Tombol preset offset persentase cepat (-10%, -5%, -1%, +1%, +5%, +10%) terhadap harga pasar live.
  - Mode penyuntingan alert in-place (`editingAlert`) langsung dari daftar Price Alerts di Right Dock Rail.
  - Garis batas alert interaktif pada kanvas grafik (*Draggable Alert Line*) yang dapat digeser secara vertikal secara real-time 60 FPS untuk mengatur target harga baru tanpa membuka dialog, dilengkapi chime audio (`playSuccessPip`) dan notifikasi toast.
- **Persistent Price Line Guard pada Kanvas Grafik (#22):**
  - Perlindungan otomatis garis harga terakhir (*Last/Current Price Line*) agar tidak hilang saat berganti mode skala (Log/Linear/Auto), invert scale, reset view, maupun switching multi-chart split panes.
  - Injeksi otomatis `priceScale.currentPriceLine = true` pada setiap mutasi konfigurasi kanvas Vela dan penegakan verifikasi scene renderer saat lilin baru diterima.
- **Mesin Pencarian Simbol Multi-Tier dengan Offline Cache & Dynamic Online Fallback (#23):**
  - Mesin *scoring ranking multi-tier* terpadu (`SymbolSearchEngine`) yang memprioritaskan kecocokan prefix ticker (seperti query `"re"` langsung menempatkan `RENDER`, `REEF`, `REQ`, `REN`, `REI` di posisi puncak di atas substring acak).
  - Cache memori lokal yang memberikan respons pencarian instan (< 10ms).
  - Sintesis *dynamic online fallback* untuk koin baru/belum terindeks (`{TOKEN}USDT`, `{TOKEN}USDT.P`, `{TOKEN}IDR`).
  - Agregasi pencarian simbol lintas seluruh bursa (Binance Spot & Futures, Indodax IDR, Bitunix).
- **Watchlist Omni-Search Bar & Eksplorasi Simbol Cepat (#24):**
  - Transformasi bilah pencarian Watchlist menjadi *Omni-Search Bar* yang menyaring koin lokal tersimpan sekaligus menampilkan seksi *"Hasil dari Bursa"*.
  - Tombol aksi 1-klik `+` untuk langsung menambahkan instrumen bursa ke watchlist tanpa menutup panel.
  - Klik baris instrumen bursa langsung membuka grafik aset terkait dengan peralihan provider otomatis (Binance/Indodax).
  - Navigasi keyboard penuh (Panah Atas/Bawah, Enter) dengan auto scroll-into-view pada menu pencarian simbol (Ctrl + K) dan Watchlist.

## [0.10.0] - 2026-10-12

### 🚀 Ditambahkan (Added)
- **Integrasi Provider Native Indodax & Pemformatan Rupiah (IDR) (#15):**
  - Penyedia data pasar bawaan untuk bursa lokal Indonesia (Indodax) dengan modul `IndodaxProvider` (kontrak grafik Vela) dan `IndodaxAdapter` (konektor REST ticker/kline).
  - Standarisasi pemformatan angka nominal Rupiah (IDR) dengan tanda pemisah ribuan titik (contoh: `Rp 1.480.000.000`) pada skala harga grafik (`priceScaleLabelService.ts`) serta badge status.
  - Penanganan khusus untuk kripto bernilai mikro (PEPE, SHIB) dalam denominasi IDR tanpa pemotongan desimal signifikan.
- **Subsistem Feed Connection Guard & Banner Peringatan ISP (#16):**
  - Subsistem pengawas proaktif `FeedConnectionGuard` pada `MarketFeedService` untuk mendeteksi kegagalan beruntun, batas waktu koneksi, dan pemblokiran jaringan/ISP (misal blokir Binance di Indonesia).
  - Banner peringatan mengambang non-intrusif pada kanvas grafik (`Chart.svelte`) yang menyediakan aksi satu klik untuk beralih instan ke Indodax atau membuka dialog pengaturan.
  - Indikator status koneksi adaptif pada bilah status bawah (`StatusBar.svelte`).
- **Pencarian Simbol Multi-Quote & Filter Bursa dengan Riwayat Pencarian (#17):**
  - Modal pencarian simbol multi-bursa (`SymbolSearchModal.svelte`) dengan filter bursa (Semua, Binance, Indodax, Custom) dan filter quote currency (Semua, USDT, IDR, USD).
  - Penyimpanan 5 riwayat pencarian terakhir (*recent searches*) secara persisten pada penyimpanan lokal.
  - Normalisasi simbol komprehensif (`BTC/IDR`, `BTCUSDT`, dsb) dengan agregasi data harga live 24h ticker badge.
  - Dukungan navigasi keyboard penuh (Up, Down, Enter, Escape) dan debounce query instan.
- **Watchlist Preset Tab Indodax IDR & Dukungan Endpoint Kustom (#18):**
  - Bilah tab preset kategori pada `WatchlistPanel.svelte`: tab `[Binance USDT]` dan `[Indodax IDR]` untuk navigasi cepat daftar pantauan pasar lokal dan global.
  - Dropdown pemilih provider instan di bilah navigasi utama (`Header.svelte`) untuk berganti penyedia feed secara langsung tanpa membuka pengaturan.
  - Dukungan penambahan endpoint node kustom dengan mekanisme fallback penyimpanan in-memory yang tangguh pada lingkungan pengujian headless.
- **Deep Workspace Layout & Sub-Pane Persistence (#14):**
  - Persistensi mendalam konfigurasi tata letak terminal ke penyimpanan lokal.
  - Menyimpan dan memulihkan proporsi pembagian vertikal sub-pane osilator (`paneWeights`), konfigurasi skala harga (`priceScaleState`), style grafik, bar spacing, panel aktif right dock rail, dan status sinkronisasi layout multi-chart.

### 🔄 Diubah (Changed)
- **Optimasi Kecepatan Eksekusi Test Runner:**
  - Integrasi paket `tsx` ke dalam `devDependencies` dan optimasi npm script sehingga waktu eksekusi unit test terpangkas menjadi ~850 ms.
  - Penambahan unref timer background interval pada provider pasar untuk memastikan proses Node.js langsung keluar tanpa delay setelah assertion pengujian selesai.
  - Peningkatan cakupan unit test suite menjadi 130 tests (16 test suites) yang lolos 100%.

## [0.9.0] - 2026-10-12

### 🚀 Ditambahkan (Added)
- **Deep Keyboard Command Dispatcher (`src/lib/services/commandDispatcher.ts`):**
  - Mengenkapsulasi matching shortcut keyboard, normalisasi modifier lintas platform (Windows/macOS: Ctrl/Cmd, Alt, Shift), input focus guards (mencegah bentrok saat mengetik di input/textarea), dan eksekusi handler.
  - Memusatkan kamus shortcut glosarium ke dalam registry tunggal (*single source of truth*), menggantikan 22+ percabangan `if-else` imperatif di `+page.svelte`.
  - Penambahan unit test suite `tests/commandDispatcher.test.ts`.
- **Modularisasi Komponen Pengaturan ke 7 Submodul Domain (`src/lib/components/settings/`):**
  - Memecah berkas monolitik `SettingsModal.svelte` (sebelumnya 3.871 baris) menjadi modul-modul independen yang bersih:
    - `GeneralTab.svelte`: Notifikasi sistem operasi, audio alert synth, bahasa antarmuka.
    - `AppearanceTab.svelte`: Preset tema (Cyber-Monochrome, Vela, dll), tipografi font UI & monospace, density layout.
    - `ChartTab.svelte`: Sinkronisasi multi-chart layout, timeframe default, countdown bar.
    - `FeedTab.svelte`: Konfigurasi penyedia feed data kripto dan interval polling.
    - `SystemTab.svelte`: Auto-load workspace startup dan manajemen cache lokal.
    - `AboutTab.svelte`: Informasi rilis, platform OS, status updater aplikasi.
    - `HelpTab.svelte`: Glosarium shortcut interaktif dan dokumentasi terminal.
  - Mengurangi ukuran `SettingsModal.svelte` menjadi shell koordinasi ramping (<240 baris).
  - Penambahan unit test suite `tests/settingsModal.test.ts`.
- **Deep Chart Drawing Controller (`src/lib/services/chartDrawingController.ts`):**
  - Mengonsolidasikan pengelolaan tool gambar aktif, adapter kanvas chart aktif, mutasi riwayat undo/redo, penghapusan gambar, dan event hooks ke dalam satu layanan terpadu.
  - Mengeliminasi 15 metode passthrough di `Chart.svelte` dan `+page.svelte`.
  - Terintegrasi langsung dengan `CommandDispatcher` (Alt+H, Alt+F, Alt+M, Alt+R, Alt+B, Ctrl+Z, Ctrl+Y, Esc).
  - Penambahan unit test suite `tests/chartDrawingController.test.ts`.
- **Real-Time Price Scale Overlay Controller (`src/lib/services/priceScaleOverlayController.ts`):**
  - Mengekstrak kalkulasi matematis harga-ke-koordinat-pixel (`priceToY`, `yToPrice`), pelacakan live pointer drag, dan mikro-presisi kripto dari `Chart.svelte`.
  - Mengeliminasi timer polling interval 400ms yang boros daya CPU, digantikan dengan RAF batching scheduler yang sinkron 60 FPS saat terjadi interaksi aktif pengguna (drag pointer, zoom, pan).
  - Penambahan unit test suite `tests/priceScaleOverlayController.test.ts`.

### 🔄 Diubah (Changed)
- **Refactoring Arsitektur Deep Modules (Codebase Design):**
  - Merampingkan antarmuka publik antar komponen terminal dan memperdalam implementasi logika internal sesuai standar *Deep Modules vs Shallow Modules*.
  - Meningkatkan stabilitas dan skalabilitas basis kode secara menyeluruh tanpa regresi fungsionalitas.
  - Menambah total unit test passing menjadi 120 tests (15 test suites).

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
