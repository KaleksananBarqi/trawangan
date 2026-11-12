# 0025 - Normalisasi Skema SQLite Per Domain, Migrasi Berversi, dan Kontrak Seam `PersistenceAdapter` Bertipe

## Status
Diterima (*Accepted*), 12 November 2026.

> *Amends / Contradicts `ADR-0003` (§2.E):* Memindahkan penyimpanan entitas domain (`workspaces`, `app_settings`, `price_alerts`, **Trade Plan Vault**, dan **Multi-Watchlist Registry**) dari asumsi `localStorage` klien pada `ADR-0003` §2.E ke tabel SQLite terstruktur lokal, demi integritas referensial, penghapusan anti-orphan, dan batas transaksi atomik. Penyatuan penuh serta pencabutan sisa akses langsung `localStorage` dijadwalkan pada `#172`–`#174`.

## Konteks
Sebelum konsolidasi (`#171`), basis data SQLite lokal desktop `trawangan` (`src-tauri/src/db.rs`) menyimpan enam entitas domain berbeda (`workspaces`, `price_alerts`, **Trade Plan Vault**, **Multi-Watchlist Registry**, `chart_default_config`, dan `app_settings`) sebagai gumpalan JSON tak terrelasi di dalam satu tabel `workspaces` lewat API generik `loadLayoutSlot` / `saveLayoutSlot`, serta memelihara tabel `watchlist` kembar melalui *dual-write*. Pola tersebut menimbulkan empat masalah struktural:
1. Penghapusan workspace menyisakan seluruh dokumen `drawings` terkait sebagai baris yatim (*orphan*) karena kolom `symbol` mencampurkan `<workspaceId>:<providerId>:<symbol>`.
2. Kloning *Save As* workspace memerlukan pemindahan dokumen bolak-balik lintas batas IPC Tauri.
3. Penghapusan `chart_default_config` menulis string kosong `""` sebagai sentinel alih-alih menghapus baris, sedangkan pengubahan satu entri **Trade Plan Vault** atau workspace memaksa penulisan ulang seluruh koleksi JSON.
4. Koneksi SQLite belum mengaktifkan `PRAGMA foreign_keys = ON`, belum memakai mode `WAL`, belum memiliki mekanisme migrasi skema berversi, dan seluruh logika penyimpanan terpusat dalam satu berkas Rust monolitik.

## Pilihan yang Dipertimbangkan
1. **Menambah kolom metadata di atas tabel `workspaces` lama dengan `loadLayoutSlot` / `saveLayoutSlot`:** Ditolak karena mempertahankan *slot hijacking*, *dual-write* watchlist, sentinel `""`, dan tidak memungkinkan `ON DELETE CASCADE` atau query terindeks per domain.
2. **Mengganti seluruh skema secara normal per domain dengan migrasi otomatis berversi (`PRAGMA user_version`) dan *expand-contract* bertahap:** Dipilih karena menjaga data pengguna v0 tetap utuh tanpa kehilangan satu entri pun, sekaligus membersihkan batas `PersistenceAdapter` secara aman antar irisan vertikal.

## Keputusan
1. **Modularisasi Storage Rust Per Domain:** Memecah basis data Rust menjadi `src-tauri/src/db/` dengan sub-modul terpisah untuk transaksi/koneksi (`mod.rs`), migrasi (`migrations.rs`), `candles`, `providers`, `scripts`, `drawings`, `workspaces`, `alerts`, `trading_plans`, `watchlists`, dan `preferences`.
2. **PRAGMA & Migrasi Berversi Atomik (`v0 -> v1`):** Mengaktifkan `PRAGMA foreign_keys = ON;` dan `PRAGMA journal_mode = WAL;` pada setiap inisialisasi koneksi, lalu menjalankan migrasi idempoten berbasis `PRAGMA user_version = 1` di dalam transaksi tunggal (`BEGIN IMMEDIATE; ... COMMIT;`) untuk memindahkan seluruh slot JSON `workspaces`, tabel `watchlist` lama, dan format key `drawings` warisan ke skema terstruktur.
3. **Skema Relasional Per Domain:**
   - `workspaces` menyimpan satu baris per **Workspace State v2** (menjaga `layout_json` per workspace).
   - `drawings` memisahkan kolom terstruktur `(workspace_id, provider_id, symbol, timeframe)` dengan `PRIMARY KEY (workspace_id, provider_id, symbol, timeframe)`, menerapkan **Workspace-Scoped Drawings** yang memungkinkan pembersihan *anti-orphan* saat `delete_workspace` (`LOWER(workspace_id)`) sambil menjaga `default_workspace` dan entri tanpa pengikatan workspace, serta kloning atomik satu transaksi SQLite (`INSERT OR REPLACE ... SELECT`) pada `clone_workspace_drawings`.
   - `price_alerts` menyimpan setiap **PriceAlert** (termasuk **Plan-Linked Auto-Alerts**) terurut `sort_order ASC` dengan penggantian batch transaksional.
   - `trading_plans` menyimpan **Trade Plan Vault** per baris (`upsert_trading_plan`) dengan pemangkasan otomatis ke kapasitas `200` entri terbaru (`ORDER BY updated_at DESC, rowid DESC`) di sisi SQLite.
   - `watchlists` dan `watchlist_items` terhubung melalui `FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE` untuk **Multi-Watchlist Registry** (menghentikan tabel `watchlist` terpisah dan *dual-write*).
   - `app_preferences` menyimpan `app_settings` dan `chart_default_config` dengan validasi JSON ketat (*fail-loud* menolak sentinel `""`) dan penghapusan nyata SQL `DELETE` (`delete_app_preference`).
4. **Pembersihan Kontrak `PersistenceAdapter`:** Menghapus `loadLayoutSlot` / `saveLayoutSlot` dan command IPC lama (`save_workspace_layout`, `load_workspace_layout`, `get_user_watchlist`, `save_user_watchlist`), sehingga seluruh pemanggil hanya berkomunikasi lewat metode domain terketik di `PersistenceService` dan `PersistenceAdapter`.

## Konsekuensi
- Perubahan skema berikutnya harus menambah nomor `PRAGMA user_version` (`v1 -> v2`, dst.) di `src-tauri/src/db/migrations.rs` beserta uji migrasi in-memory dan uji file database.
- Akses langsung `localStorage` tersisa di luar `PersistenceAdapter` (termasuk mirror sementara vault dan konfigurasi default chart di `PersistenceService`) maupun pengetatan error *fail-loud* `TauriSqliteAdapter` dikonsolidasikan pada spesifikasi lanjutan `#172`, `#173`, dan `#174`.
