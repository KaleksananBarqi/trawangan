# 0003. Core Architecture and Lightweight Guardrails Specification

## Status
Diterima & Mengikat (*Accepted & Enforced*) — 11 Oktober 2026.

---

## 1. Konteks & Filosofi Dasar

Aplikasi **trawangan** lahir dari visi yang jelas: **membangun platform charting dan analisis teknikal crypto desktop yang ultra-ringan, mandiri, tanpa paywall, dan menggunakan bahasa pemrograman paling hemat sumber daya**.

Banyak platform charting komersial atau aplikasi desktop modern dibangun di atas runtime yang gemuk (seperti Electron atau Node.js yang memakan RAM 500 MB – 1.5 GB), sarat pelacak data (*telemetry tracking*), dan mengunci fitur-fitur dasar analisis teknikal di balik biaya langganan bulanan. 

Untuk memastikan pengembangan jangka panjang tidak mengalami pembengkakan (*code rot & feature bloat*), dokumen Architecture Decision Record (ADR) ini menetapkan **pagar pembatas arsitektur yang ketat (*non-negotiable guardrails*)** yang wajib ditaati oleh seluruh kontributor dan agen AI.

---

## 2. Prinsip Arsitektur Inti (Core Architectural Tenets)

### A. Ruang Lingkup Murni Analisis (Pure Charting Scope)
- **Zero Brokerage & Zero Trade Execution:** `trawangan` murni merupakan terminal visualisasi grafik teknikal, analisis orderflow, dan lingkungan eksekusi skrip Pine Script v6.
- **Larangan Modul Finansial:** Dilarang keras mengintegrasikan modul koneksi dompet Web3 (*crypto wallet*), manajemen private key, atau eksekusi order beli/jual langsung ke pasar modal. Hal ini menjaga kode tetap ringkas, menjamin keamanan mutlak, dan mempertahankan fokus pengguna pada analisis objektif.

### B. Pembagian Peran Bahasa Pemrograman (Stack Division)
- **Rust (Tauri v2 Core):**
  - Bertindak sebagai tulang punggung native desktop tanpa overhead runtime Chromium/Node.js.
  - Menangani seluruh operasi I/O file, koneksi jaringan/streaming WebSocket langsung ke exchange, caching database time-series, dan komputasi intensif berbasis memori aman (*zero garbage collection latency*).
- **Svelte 5 (Runes) + TypeScript (Frontend):**
  - Murni bertindak sebagai *thin presentation layer* dengan ukuran kompilasi minimal dan pembaruan DOM berbasis surgical signals/runes tanpa overhead Virtual DOM.
- **WebGL2 Engine (@luxalgo/vela):**
  - Akselerasi visual candlestick dan orderflow langsung ke GPU (60–120 FPS).
- **Larangan Runtime Berat:** Dilarang keras memasukkan runtime Electron, Node.js sidecar, Python, atau JVM ke dalam installer aplikasi desktop.

### C. Isolasi Komputasi Skrip di Dedicated Web Worker
- Seluruh eksekusi kalkulasi matematis indikator teknikal (@luxalgo/pinets & @luxalgo/vela-pinets) **wajib diisolasi di dalam Dedicated Web Worker**.
- Kalkulasi ratusan ribu bar lilin atau loop skrip yang berat tidak boleh memblokir *main UI thread* agar interaksi antarmuka dan rendering grafik tetap mulus di 60+ FPS.

### D. Arsitektur Langsung ke Bursa (Direct-to-Exchange, Zero Middleware)
- Data pasar mengalir langsung dari endpoint publik bursa (Binance, Bybit, OKX, Bitunix) ke klien melalui WebSocket dan REST API.
- Tidak ada server penengah (*no intermediary proxy/backend server*) milik Trawangan. Hal ini menjamin privasi pengguna, nol latensi perantara, dan nol biaya perawatan server bagi proyek.

### E. Persistensi 100% Mandiri & Offline-First (SQLite Terkonsolidasi & Pengecualian Sinkron)
> *Diamandemen oleh [ADR-0025](0025-normalized-sqlite-persistence-and-typed-seam.md) dan [ADR-0026](0026-persistence-service-consolidation-and-localstorage-retirement.md) (12 November 2026):* Seluruh konfigurasi pengguna, provider data pasar, serta preferensi antarmuka dipindahkan dari `localStorage` klien ke basis data **SQLite** lokal dengan **Bootstrap Hydration** sinkron.
- **Sumber Kebenaran Tunggal di SQLite (`PersistenceService`):** Pengaturan aplikasi (`app_settings` termasuk avatar profil), `chart_default_config`, `last_active_workspace_id`, konfigurasi provider data pasar (`providers`), daftar pantau, alert, **Trade Plan Vault**, skrip Pine, gambar teknikal, tata letak workspace, serta seluruh preferensi UI bertipe (`UiPreferenceKey`) disimpan di basis data embedded **SQLite** lokal via Rust Core (`rusqlite`) dan dimuat paralel ke cache memori satu kali saat `PersistenceService.bootstrap()`.
- **Pencabutan Akses `localStorage` & Pengecualian Permanen (Bucket C):** Layanan dan komponen UI desktop dilarang membaca atau menulis `localStorage` secara langsung (migrasi satu kali berbasis allowlist di `bootstrap()` membersihkan kunci legacy termasuk `trawangan_trade_plan_vault` setelah simpan SQLite berhasil). Pengecualian permanen `localStorage` klien hanya berlaku untuk dua jalur sinkron esensial:
  1. **Exit Flush & Pending Override** (`trawangan_workspace_pending_*`, [ADR-0023](0023-workspace-state-v2-pane-layout-and-per-cell-persistence.md)) guna mengamankan perubahan mendadak pada event sinkron `beforeunload` / `onCloseRequested`.
  2. **Crypto Macro Index** cache kesegaran & metadata basket efemeral (`trawangan_macro_cache_meta_v1` dan `trawangan_macro_metadata_v1`, [ADR-0024](0024-crypto-macro-index-and-synthetic-basket-feeder.md)).
  *(Catatan: Pada mode Web/headless non-Tauri, `InMemoryLocalStorageAdapter` tetap beroperasi sebagai adapter cadangan terisolasi di balik kontrak `PersistenceAdapter`.)*
- **Cache Candle Historis:** Disimpan secara terkompresi di basis data embedded **SQLite** lokal via Rust Core (`rusqlite`).
- **Nol Dependensi Cloud:** Aplikasi dapat beroperasi penuh secara *offline* untuk data yang sudah di-cache tanpa perlu otentikasi akun atau server cloud.

---

## 3. Batasan Mutlak Sumber Daya (Hard Resource Budgets)

Setiap implementasi kode baru wajib mematuhi batasan kuantitatif berikut:

| Metrik | Ambang Batas (*Hard Limit*) | Metode Pengukuran |
| :--- | :--- | :--- |
| **Idle RAM Footprint** | **Maksimal 60 – 80 MB** | Task Manager OS / Internal Telemetry Service |
| **Heavy Load RAM (Multi-Chart)** | **Maksimal 150 MB** | 4-Grid Chart + 10 Indikator Aktif |
| **Ukuran Binary Installer** | **Maksimal 20 MB** | Paket rilis `.exe` / `.msi` / `.AppImage` |
| **Cold Startup Time** | **< 1.0 Detik** | Dari peluncuran biner hingga kanvas WebGL2 interaktif |
| **Frame Rate Rendering** | **Stabil 60 – 120 FPS** | Telemetri FPS bawaan Trawangan |

---

## 4. Kebijakan Ketergantungan (Dependency Hygiene)

1. **Anti-Bloat Library:**
   - Dilarang menginstal UI component library monolitik pihak ketiga (seperti Material UI, Ant Design, Chakra UI).
   - Seluruh styling komponen antarmuka menggunakan Vanilla CSS terstruktur atau *scoped styles* Svelte 5 berbasis design token warna Trawangan.
2. **Audit Dependensi Wajib:**
   - Penambahan paket npm atau crate Cargo baru harus dibuktikan tidak menaikkan ukuran bundle lebih dari 150 KB dan tidak memiliki ketergantungan transitif yang berlebihan.
   - Utamakan pustaka native standar atau modul utilitas internal yang ringkas.

---

## 5. Matriks Penolakan Kode (Pull Request Rejection Criteria)

Perubahan kode, fitur baru, atau *refactoring* akan **ditolak secara otomatis** jika melanggar salah satu kriteria berikut:

- ❌ **Terjadi Memory Leak:** Objek listeners, WebSocket, worker, atau chart instance yang tidak dibersihkan dengan benar saat komponen dihancurkan (`onDestroy`), menyebabkan kenaikan konsumsi RAM terus-menerus.
- ❌ **Penurunan FPS Kanvas:** Menyisipkan kalkulasi sinkronus berat di *main thread* yang menyebabkan jeda (*frame drop / stuttering*) di bawah 60 FPS.
- ❌ **Manipulasi DOM Manual di Luar Reaktivitas:** Melakukan mutasi langsung ke elemen DOM di luar siklus hidup Svelte 5 (kecuali elemen kanvas internal WebGL2 yang dikelola oleh Vela engine).
- ❌ **Pelanggaran Batasan Ruang Lingkup:** Mencoba menyisipkan fitur trading eksekusi, integrasi wallet, atau server proxy eksternal.

---

## 6. Konsekuensi & Kompromi (Trade-offs)

- **Keuntungan:** 
  - Aplikasi terasa instan, sangat responsif, dan hemat baterai di laptop.
  - Pengguna mendapatkan pengalaman trading terminal profesional secara gratis tanpa beban memori tinggi seperti platform berbasis Electron.
  - Kemudahan pemeliharaan (*maintainability*) karena basis kode tetap ramping dan terisolasi rapi.
- **Kompromi:**
  - Pengembang harus menulis styling UI kustom secara mandiri menggunakan Svelte 5 daripada mengandalkan pustaka komponen instan yang siap pakai.
  - Komunikasi antara layer UI dan layer native memerlukan kontrak IPC Tauri yang terdefinisi dengan jelas dan bertipe ketat.
