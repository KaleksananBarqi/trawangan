# 0027 - Batas Persistensi `DrawingScope` dan Otoritas Tunggal Active Trading Plan (`_trawangan_meta`)

## Status
Diterima (*Accepted*), 12 November 2026.

> *Amends / Clarifies `ADR-0019` dan `ADR-0023`:* Menetapkan `PersistenceService` sebagai pemilik tunggal resolusi kunci penyimpanan gambar berbasis `DrawingScope`, serta menetapkan dokumen gambar (`drawings._trawangan_meta`) bersama `TradingPlanLifecycle` sebagai otoritas utama state **Trading Plan** aktif kanvas di atas fallback warisan `SavedWorkspace.activePlans` dan arsip **Trade Plan Vault**.

## Konteks
Sebelum konsolidasi Spec `#174` (`#189`–`#191`), tanggung jawab penyimpanan gambar dan kepemilikan state rencana perdagangan aktif di `trawangan` saling tumpang tindih lintas empat titik:
1. `ChartDrawingController` merangkai dan me-re-ekspor helper kunci string `resolveDrawingKey` / `resolveDrawingStorageKey`, menggandakan **6-tahap *fallback lookup* warisan** pada `restoreDrawings` dan `restoreAllCellDrawings`, sementara `clearAll()` sempat memanggil `clearDrawings` dengan simbol mentah sehingga rekaman **Workspace-Scoped Drawings** di SQLite tetap utuh dan muncul kembali saat dimuat ulang.
2. State rencana perdagangan aktif (*ActiveTradingPlan*) tersimpan ganda di `drawings._trawangan_meta` (diperbarui tiap mutasi kanvas) dan `SavedWorkspace.activePlans` (snapshot **Workspace State v2** yang hanya diperbarui saat simpan workspace atau **Workspace Auto-Save Guard** aktif). Saat workspace dimuat (`restoreWorkspaceChartAndPlans`), `restorePlans(w.activePlans)` dipanggil tanpa memeriksa apakah dokumen gambar sudah membawa `_trawangan_meta`, sehingga plan yang telah dihapus pengguna di kanvas (misalnya saat auto-save nonaktif) kembali dibangkitkan oleh snapshot `w.activePlans` yang basi.
3. Pada workspace multi-sel, serialisasi envelope `_trawangan_meta` perlu menjaga isolasi per instrumen agar dokumen satu sel tidak membawa atau merehidrasi plan milik sel lain.

## Pilihan yang Dipertimbangkan
1. **Menghapus field `activePlans` sepenuhnya dari `SavedWorkspace` (`Workspace State v2`):** Ditolak karena memutus kompatibilitas mundur terhadap snapshot/fixture workspace warisan yang belum memiliki `_trawangan_meta` di dokumen `drawings`, serta memengaruhi kontrak `computeWorkspaceFingerprint` pada **Workspace Auto-Save Guard**.
2. **Menyatukan otoritas aktif di `_trawangan_meta` + `TradingPlanLifecycle`, memindahkan resolusi kunci ke `DrawingScope` di `PersistenceService`, dan menjaga `SavedWorkspace.activePlans` sebagai fallback warisan serta input *fingerprint*:** Dipilih karena mencegah kebangkitan plan terhapus tanpa mematahkan migrasi snapshot warisan maupun deteksi dirty-state workspace.

## Keputusan
1. **Batas Persistensi `DrawingScope` (`ChartDrawingController` -> `PersistenceService`):**
   - `PersistenceService` (`IPersistenceService`) menyediakan kontrak terstruktur `DrawingScope` (`workspaceId`, `providerId`, `symbol`, `timeframe`) beserta metode `loadScopedDrawings`, `saveScopedDrawingsDebounced`, `flushScopedDrawings`, dan `clearScopedDrawings`.
   - Pembentukan kunci kanonikal dan **6-tahap *fallback lookup* warisan** (`GLOBAL` lalu timeframe spesifik pada tingkat `workspaceId:provider:symbol`, `provider:symbol`, dan simbol bare Binance) dipusatkan di `PersistenceService`.
   - `ChartDrawingController` tidak mengimpor ataupun me-re-ekspor `resolveDrawingKey` / `resolveDrawingStorageKey`, dan meneruskan `DrawingScope` di seluruh jalur simpan, *flush*, *restore*, pergantian sel, serta `clearAll()`.
2. **Otoritas Tunggal Plan Aktif (`_trawangan_meta` + `TradingPlanLifecycle`) vs `SavedWorkspace.activePlans`:**
   - `restoreAllCellDrawings` (dan `restoreDrawings` pada jalur sel tunggal) mengembalikan sinyal `{ hasAuthoritativePlanMeta: boolean }` yang bernilai `true` apabila setidaknya satu dokumen gambar sel yang dipulihkan membawa envelope `_trawangan_meta` valid—termasuk ketika `_trawangan_meta.activePlans` bernilai `[]` setelah seluruh plan dihapus di kanvas.
   - Pada `restoreWorkspaceChartAndPlans`, bila `hasAuthoritativePlanMeta === true`, pemanggilan `plan.restorePlans(w.activePlans, ...)` dilarang sehingga `SavedWorkspace.activePlans` basi tidak pernah menimpa kanvas; visibilitas kartu tesis tetap diterapkan melalui `plan.setThesisCardsVisible(w.showThesisCards ?? true)`.
   - `SavedWorkspace.activePlans` tetap dipertahankan sebagai *fallback* warisan hanya ketika dokumen gambar belum membawa `_trawangan_meta` (atau `restoreAllCellDrawings` tidak tersedia), dan tetap diisi pada `buildWorkspaceSnapshotPayload` demi menjaga paritas `computeWorkspaceFingerprint` untuk **Workspace Auto-Save Guard**.
3. **Pemisahan Tegas dengan *Trade Plan Vault* (`ADR-0019`):**
   - **Trade Plan Vault** (`trading_plans`) berfungsi murni sebagai katalog arsip riwayat yang ditulis hanya pada aksi eksplisit penerapan atau penyuntingan form (`projectPlan` / `updatePlan` ketika `skipVaultSave` tidak aktif), tidak ditulis selama drag **Bidirectional Sync** di kanvas, dan tidak pernah dibaca sebagai sumber rehidrasi otomatis saat workspace dimuat.

## Konsekuensi
- Penghapusan plan di kanvas atau eksekusi `clearAll()` tetap persisten lintas muat ulang workspace meskipun **Workspace Auto-Save Guard** sedang dimatikan.
- Snapshot dan fixture **Workspace State v2** warisan tanpa `_trawangan_meta` tetap dapat memulihkan plan lewat fallback `SavedWorkspace.activePlans` dan menjaga paritas *fingerprint*.
- `ChartDrawingController` terlepas bersih dari detail format kunci SQLite dan logika pencarian fallback bertingkat.
