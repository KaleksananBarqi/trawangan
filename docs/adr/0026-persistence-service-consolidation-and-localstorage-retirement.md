# 0026 - Konsolidasi `PersistenceService`, Bootstrap Hydration, dan Pencabutan `localStorage` Legacy

## Status
Diterima (*Accepted*), 12 November 2026.

> *Amends `ADR-0003` (§2.E) dan melengkapi `ADR-0025`:* Menyelesaikan pemindahan seluruh pengaturan aplikasi, konfigurasi provider pasar, identitas workspace terakhir, dan preferensi ergonomi UI dari `localStorage` klien ke basis data SQLite lokal melalui **Bootstrap Hydration** pada `PersistenceService.bootstrap()`, sambil menjaga pengecualian permanen **Exit Flush & Pending Override** ([ADR-0023](0023-workspace-state-v2-pane-layout-and-per-cell-persistence.md)) serta cache efemeral **Crypto Macro Index** ([ADR-0024](0024-crypto-macro-index-and-synthetic-basket-feeder.md)).

## Konteks
Setelah [ADR-0025](0025-normalized-sqlite-persistence-and-typed-seam.md) menormalkan skema SQLite dan menyediakan tabel `app_preferences`, sejumlah subsistem `trawangan` masih membaca dan menulis `localStorage` WebView secara langsung karena kebutuhan pembacaan sinkron saat inisialisasi UI dan sesi chart:
1. Objek `trawangan_app_settings` (yang memuat `userProfile.avatarDataUrl` hingga ~2,5 MB / ~3,3 MB base64) menguras kuota origin `localStorage` (~5 MB) dan mengancam jalur backup sinkron **Exit Flush & Pending Override**.
2. Status `autoSaveWorkspace` terpecah antara `trawangan_app_settings` dan `trawangan_autosave_workspace`, `PersistenceService` masih menulis mirror ke `trawangan_chart_default_config` dan `trawangan_trade_plan_vault`, sedangkan `MarketFeedService` dan `ChartSessionController` mem-bypass `PersistenceAdapter` melalui pemanggilan IPC Tauri langsung serta dual-write `trawangan_providers`.
3. Preferensi ergonomi UI (**Docked Structural Shell**, **Right Dock Rail**, lebar panel, memori/favorit alat gambar, favorit indikator, dan riwayat pencarian simbol) masih tersebar di 10 kunci `localStorage` independen, termasuk pembacaan top-level saat evaluasi modul.

## Pilihan yang Dipertimbangkan
1. **Mengubah seluruh pembacaan UI dan inisialisasi chart menjadi asinkron per komponen:** Ditolak karena memicu *layout flicker*, *race condition* antara mount komponen anak Svelte dan hidrasi awal, serta duplikasi query IPC `get_app_preference` saat startup.
2. **Satu kali batch loading paralel via `PersistenceService.bootstrap()` + cache memori sinkron + migrasi allowlist satu kali:** Dipilih karena mempertahankan akses baca 0 ms di seluruh UI/controller setelah fase awal `onMount`, memadatkan hidrasi ke satu round-trip IPC `load_all_app_preferences` dan `loadProviders`, serta mencegah kehilangan data pengguna lama.

## Keputusan
1. **Bootstrap Hydration & Cache Sinkron (`PersistenceService.bootstrap()`):**
   - Menambahkan query batch `load_all_app_preferences` di backend Rust dan `bootstrap()` idempoten pada `IPersistenceService` untuk memuat seluruh baris `app_preferences` dan `providers` secara paralel ke cache memori sebelum shell UI, feed pasar, atau sesi chart membaca state.
   - Menghapus seluruh mirror write `localStorage` untuk `chart_default_config` dan `trawangan_trade_plan_vault`, serta memindahkan `last_active_workspace_id` ke `app_preferences`.
2. **Abstraksi Provider & Union Tertutup `UiPreferenceKey`:**
   - Memindahkan seluruh operasi CRUD provider ke `PersistenceAdapter` (`TauriSqliteAdapter` & `InMemoryLocalStorageAdapter`) dan mencabut bypass IPC serta `trawangan_providers` dari `MarketFeedService` dan `ChartSessionController`, sambil menjaga isolasi **Dynamic Feeder Context** (`macro`).
   - Menyatukan seluruh 10 preferensi UI Bucket B di balik satu set metode berparameter union tertutup `UiPreferenceKey` (`getUiPreferenceSync`, `setUiPreference`, `removeUiPreference`) dan menghapus pembacaan `localStorage` pada top-level modul.
3. **Migrasi Satu Kali Berbasis Allowlist & Proteksi Bucket C:**
   - Saat `bootstrap()` berjalan di atas adapter persisten non-`InMemoryLocalStorageAdapter`, `PersistenceService` mengimpor kunci legacy Bucket A dan B dari daftar allowlist eksplisit hanya jika entri tujuan di SQLite belum terisi (termasuk menggabungkan `trawangan_autosave_workspace` ke `appSettings.autoSaveWorkspace` saat belum disetel dan mengimpor provider legacy tanpa menimpa pilihan SQLite yang lebih baru).
   - Setiap kunci legacy (termasuk kunci yatim `trawangan_trade_plan_vault`) hanya dihapus dari `localStorage` setelah penulisan SQLite terkait berhasil; jika penulisan SQLite gagal, kunci lama dipertahankan utuh di `localStorage`.
   - Kunci Bucket C (`trawangan_workspace_pending_*` milik **Exit Flush & Pending Override** serta `trawangan_macro_cache_meta_v1` dan `trawangan_macro_metadata_v1` milik **Crypto Macro Index**) tidak pernah dibaca, diiterasi, dimigrasikan, ataupun dihapus oleh proses migrasi.

## Konsekuensi
- Kuota `localStorage` WebView kembali lega untuk keperluan penyelamatan sinkron **Exit Flush & Pending Override** meskipun pengguna menyimpan avatar profil berukuran besar di SQLite.
- Pengujian unit/integrasi lintas layanan cukup menyuntikkan `PersistenceService` berbasis `InMemoryLocalStorageAdapter` (dengan opsi `{ memoryOnly: true }` untuk isolasi total) atau `TauriSqliteAdapter` (dengan injeksi seam `invokeFn` untuk pengujian IPC) tanpa perlu memanipulasi `globalThis.localStorage`.
- *(Pembaruan `#173` / `#186`–`#188`):* Sisa `fallbackAdapter` dan pembacaan `localStorage` diam-diam di `TauriSqliteAdapter` telah dicabut total sehingga seluruh error IPC SQLite bersifat *fail-loud* murni. Selain itu, `listDrawingKeys` / `list_drawing_keys` telah dihapus, pembacaan nilai *falsy* valid (`""` dan `[]`) dipertahankan, `flushDrawings` mempropagasi rejection di semua cabang, dan kegagalan penulisan latar belakang `saveDrawingsDebounced` disalurkan lewat hook `onError` (`PersistenceService`) ke `Terminal Logs`.
