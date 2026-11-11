# 0023 - Skema Workspace State v2, Tata Letak Pane Bawah Adaptif, Multi-Cell Hybrid Restore, dan Kelengkapan Sesi

## Konteks & Latar Belakang
Sejak [ADR-0005](0005-multi-quote-feed-guard-and-workspace-layout-persistence.md) memperkenalkan persistensi `paneWeights` dan [ADR-0016](0016-unified-theme-engine-full-palette-matrix-and-cross-subsystem-propagation.md) serta [ADR-0018](0018-live-theme-preview-chart-context-menu-pruning-in-place-palette-editing-and-canvas-watermark-control.md) memperluas manajemen tema dan *Workspace Auto-Save Guard*, masih terdapat beberapa celah persistensi saat pengguna menata ruang analisis atau menutup aplikasi secara cepat:

1. **Proporsi Pane Bawah & Panel Volume Native Ter-reset:** Pemisahan sub-pane indikator osilator sebelumnya hanya menyimpan array numerik berbasis indeks (`paneWeights`) yang kerap bentrok dengan pembuatan pane asinkron dari worker Pine Script, serta tidak dilindungi ketika engine Vela memanggil `ensurePane()` ulang pada saat inisialisasi atau reset indikator volume native (memiliki tinggi bawaan *own-pane*).
2. **Kehilangan Perubahan Menjelang Penutupan Aplikasi:** Debounce auto-save 3,5 detik dan tidak adanya koordinasi flush pada event `beforeunload` / Tauri `onCloseRequested` membuat penggeseran separator panel, perubahan *bar spacing*, pergantian *price style*, atau perpindahan sel aktif tepat sebelum menutup jendela berisiko hilang. Selain itu, sejumlah mutasi internal chart (zoom, drag separator, klik sel, ubah input indikator) belum memancarkan sinyal dirty ke koordinator auto-save.
3. **Hilangnya Drawing pada Aksi "Save As" Workspace Baru:** `ChartDrawingController` menyimpan gambar ke SQLite berdasarkan `workspaceId:providerId:symbol`, sehingga ketika pengguna menyimpan sesi baru dari `default_workspace` (atau menduplikasi workspace ke nama baru), gambar yang sudah ada belum disalin ke `workspaceId` target.
4. **Keterbatasan Tata Letak Multi-Chart (`2v`, `2h`, `4`, dst.):** Hanya sel aktif saat ini yang terekam (`symbol`, `timeframe`, `priceStyle`), sementara sel lain dalam grid beserta pembagian kolom/baris (`trackSizes`), sel fokus (`activeCellIndex`), serta indikator per sel ketika `syncConfig.indicators === false` tidak tersimpan.
5. **Kelengkapan Posisi Viewport, Preferensi Chart Default, Geometri Kartu Tesis, & Toolbar Gambar:** Pengguna tidak bisa mempertahankan posisi pengguliran historis (`visibleRange`), tidak memuat `chartDefaultConfig` sebagai baseline saat startup, dan kehilangan ukuran/posisi `FloatingThesisCard` maupun status `snapMode`/`stayMode` di `DrawingToolbar`.

## Keputusan Arsitektur

### 1. Skema `SavedWorkspace` v2 & Migrasi Backward-Compatible
- Memperkenalkan `WORKSPACE_SCHEMA_VERSION = 2` beserta modul pure normalisasi [workspaceSchema.ts](../../src/lib/services/persistence/workspaceSchema.ts) (`normalizeWorkspace`, `computePaneSignature`).
- Seluruh dokumen v1 warisan secara otomatis dinormalkan saat dimuat di `PersistenceService.loadWorkspaces()` maupun SQLite adapter tanpa merusak data lama: `cells[0]` diisi dari root fields dan `paneLayout` diturunkan dari `paneWeights` + `indicators` non-overlay bila belum tersedia.

### 2. Tata Letak Panel Bawah Berbasis **Pane Signature** & Guard `ensurePane`
- Mengganti kebergantungan pada indeks array semata dengan **`PaneLayoutEntry`** (`{ signature, weight, collapsed? }`), di mana signature `'price'` mengidentifikasi pane lilin utama dan indikator non-overlay digabung secara alfabetis (misal `'RSI|Stochastic'`).
- Di [chartSessionController.ts](../../src/lib/services/chartSessionController.ts):
  - **`getPaneLayout(cell?)`** membaca struktur `workspace.panes` dan memancarkan `PaneLayoutEntry[]`.
  - **`applyPaneLayout(entries, { timeoutMs })`** menunggu kemunculan sub-pane secara event-driven (`pane:created` / polling ringan hingga timeout) lalu menyetel `heightWeight` & status `collapsed` yang cocok berdasarkan `Pane Signature`.
  - **`installEnsurePaneGuard`** mencegat pemanggilan ulang `ensurePane` pada pane yang telah di-restore agar proporsi `heightWeight` tersimpan tidak ditimpa kembali oleh nilai default Vela.
  - **`getNativeIndicators()` & `applyNativeIndicators()`** menangkap dan memulihkan konfigurasi indikator native (termasuk Volume *own-pane* dengan `heightPct` yang dipertahankan).

### 3. Pemicu Auto-Save Menyeluruh, Koordinator Debounce 1,5 Detik, dan Exit Flush
- Memusatkan logika lifecycle di [workspaceLifecycle.ts](../../src/lib/services/workspaceLifecycle.ts):
  - **`WorkspaceAutoSaveCoordinator`** menggunakan debounce **1500ms**, memeriksa perubahan nilai via `computeWorkspaceFingerprint`, dan menyediakan **`flushNow()`** untuk penyimpanan segera.
  - **`ChartSessionController`** memasang detektor mutasi chart (`viewport:changed`, drag separator via `capturePaneLayoutIfChanged`, ubah skala harga, style, indikator, volume native) yang dilindungi oleh `withSuppressedPersistEvents` selama proses restore berlangsung.
  - **Jaring Pengaman Penutupan (`executeExitFlush` & `resolvePendingWorkspaceOverride`):** Pada `beforeunload` dan Tauri `onCloseRequested`, snapshot terbaru ditulis secara **sinkron** ke `localStorage` (`trawangan_pending_workspace`) sebelum memicu `flushNow()` & `flushDrawings()`. Saat startup berikutnya, jika cadangan lokal lebih baru dari data SQLite, `resolvePendingWorkspaceOverride` memulihkannya dan menyinkronkan ke SQLite.

### 4. Kloning Drawing Lintas Workspace saat "Save As"
- Menambahkan query **`list_drawing_keys`** pada lapisan SQLite Rust ([db.rs](../../src-tauri/src/db.rs), [commands.rs](../../src-tauri/src/commands.rs), [lib.rs](../../src-tauri/src/lib.rs)) dan adapter TypeScript ([persistence/index.ts](../../src/lib/services/persistence/index.ts)) termasuk capability [default.json](../../src-tauri/capabilities/default.json).
- `cloneWorkspaceDrawings(sourceWorkspaceId, targetWorkspaceId)` menyalin seluruh record drawing (`{prefix}:{provider}:{symbol}` serta `_trawangan_meta`) sebelum `activeWorkspace` dialihkan ke workspace baru.

### 5. Keputusan K1 — Multi-Cell Hybrid State & `restoreAllCellDrawings`
- Pada grid multi-chart (`layout !== '1'`), tiap sel diabadikan dalam **`cells: CellSnapshot[]`** bersama **`trackSizes`** (`cols`, `rows`) dan **`activeCellIndex`**.
- **Pendekatan Hybrid K1:** Saat menyimpan dan memulihkan, `trawangan` memanfaatkan `workspace.getState()` / `applyState()` Vela untuk `trackSizes`, `activeCellId`, dan konfigurasi per sel (`symbol`, `timeframe`, `priceStyle`, `rendererConfig`, `session`, `bars`), tetapi **secara eksplisit membuang** `drawings` dan `indicators` dari payload state Vela karena kedua siklus hidup tersebut dikelola secara eksklusif oleh `ChartDrawingController` (`restoreAllCellDrawings` + `restorePlans`) dan `ChartSessionController` (PineTS worker).
- Ketika `isRestoringWorkspace === true`, `setLayout()` melewati kebijakan `applyLayoutTimeframePolicy` maupun kloning indikator otomatis dari sel utama sehingga komposisi masing-masing sel dalam snapshot tetap utuh.

### 6. Keputusan K2 — Pemulihan Posisi Scroll Historis (`visibleRange` & `atLiveEdge`)
- **`VisibleRangeSnapshot`** merekam `{ from, to, atLiveEdge }`.
- Saat snapshot dimuat melalui **`applyVisibleRange()`**:
  - Jika **`atLiveEdge !== false`** (pengguna sedang mengikuti candle live terbaru), chart tetap mengikuti ujung live tanpa melompat ke timestamp lama dan hanya memulihkan kepadatan zoom (`barSpacing`).
  - Jika **`atLiveEdge === false`** (pengguna sedang meninjau area historis tertentu), `applyVisibleRange()` menunggu hingga data historis sel selesai dimuat (`orchestrator.historyCompleted` atau listener satu-kali `chart.on('history:complete', ...)`), lalu memanggil `chart.setVisibleRange({ from, to })` di dalam `withSuppressedPersistEvents`.

### 7. Keputusan K3 — Prioritas `chartDefaultConfig` vs Konfigurasi Sel/Workspace
- Memisahkan lingkup konfigurasi visual:
  - Pengaturan aplikasi global (`themePreset`, `gridMode`, `showWatermark`, `timezone`, toggle label) tetap dikelola global via `AppSettings`.
  - **`rendererConfig`** (konfigurasi rendering per kanvas/sel) berlaku per workspace dan per sel dengan hirarki prioritas deterministik: **`workspace/cell rendererConfig` > `user chartDefaultConfig` (`trawangan_chart_default_config`) > bawaan pabrik (factory)**.
- `ChartSessionController.attach()` langsung menghidrasi `userChartDefaultConfig` secara sinkron dan asinkron, sementara tab **Grafik** di modal Pengaturan ([ChartTab.svelte](../../src/lib/components/settings/ChartTab.svelte)) menyediakan tombol **"Simpan sebagai Default"** yang dihubungkan ke `saveCurrentChartSettingsAsDefault()`.

### 8. Kelengkapan Geometri Kartu Tesis & Status Drawing Toolbar
- Menambahkan `thesisCardGeometry` ke [chartDrawingController.ts](../../src/lib/services/chartDrawingController.ts) dan menambatkan emisi pembaruan geometri pada [FloatingThesisCard.svelte](../../src/lib/components/FloatingThesisCard.svelte) hanya saat interaksi pengguna selesai (berhenti drag/resize, toggle mode lebar, toggle minimize/pill) disertai *equality guard* agar mount awal tidak memicu auto-save palsu.
- Menyimpan dan memulihkan `drawingToolbar` (`snapMode`, `stayMode`) di seluruh sel multi-chart serta menyertakan kedua dimensi baru tersebut dalam `computeWorkspaceFingerprint`.

## Konsekuensi & Dampak
- **Positif:**
  - Tinggi panel Volume & sub-pane osilator kustom, posisi scroll historis, grid multi-chart independen, preferensi chart default, geometri kartu tesis, serta mode Magnet/Stay tersimpan utuh lintas sesi termasuk saat aplikasi ditutup mendadak.
  - Kompatibilitas mundur 100% terhadap workspace v1 dan seluruh kontrak lama `computeWorkspaceFingerprint`.
  - Tervalidasi menyeluruh oleh suite tes TDD khusus (`workspaceSchemaMigration`, `workspacePaneLayout`, `nativeVolumePersistence`, `workspaceAutoSaveTriggers`, `workspaceSaveAsDrawingMigration`, `multiChartCellPersistence`, `phase6Completeness`), 868 tes TypeScript/unit (`npx tsx --test`), `svelte-check` (0 errors), dan 13 unit tes Rust (`cargo test`).
- **Pertimbangan:**
  - Penambahan properti baru ke `SavedWorkspace` di masa mendatang wajib didaftarkan ke `WorkspaceFingerprintInput` dan `computeWorkspaceFingerprint` ([workspaceService.ts](../../src/lib/services/persistence/workspaceService.ts)) agar perubahan nilai memicu auto-save dan tidak terbaca sebagai false-negative oleh *Workspace Auto-Save Guard*.
