# Spec: Configurable Snapshot Directory, Native Folder Picker, and Safe File Export Engine

## Problem Statement

Pengguna terminal `trawangan` membutuhkan kendali penuh atas lokasi penyimpanan berkas tangkapan layar (*snapshot/screenshot*) analisis teknikal mereka pada sistem berkas lokal.

Saat ini, terdapat beberapa batasan dan kelemahan pada implementasi penyimpanan snapshot:
1. **Ketiadaan Pemilih Folder Interaktif (Native Directory Picker)**:
   Pengguna hanya disodori bidang teks manual dan tombol *preset chip* terbatas untuk menentukan jalur direktori penyimpanan. Pengguna awam di sistem operasi desktop (Windows, macOS, Linux) kesulitan mengetik path absolut secara manual dan mengharapkan adanya tombol dialog pemilih folder native sistem operasi (*system directory picker*).
2. **Celah Keamanan Potensi Path Traversal pada IPC Filesystem**:
   Nama berkas yang dikirim melalui antarmuka IPC diterima dan digabungkan secara langsung dengan path direktori target tanpa sanitasi komponen basis nama berkas (`file_name`). Hal ini menimbulkan risiko *path traversal* jika nama berkas memuat pola relatif seperti `../` atau path absolut tak terduga.
3. **Tekanan Saluran IPC & Latensi Akibat Payload Base64 Raksasa**:
   Pengiriman data gambar beresolusi 2x HiDPI (~10–15 MB string base64) secara utuh melalui parameter IPC Tauri membebani *buffer* pesan antrean IPC dan berpotensi memicu lonjakan latensi atau *freeze* antarmuka pada lingkungan WebKitGTK/Linux.
4. **Umpan Balik Jalur Berkas Palsu (*False-Positive Path Feedback*) pada Fallback Unduhan**:
   Ketika penyimpanan native melalui desktop IPC gagal atau terminal dijalankan pada lingkungan peramban web (*web mode*), sistem beralih ke pengunduhan peramban standar (`a.download`), namun notifikasi UI tetap melaporkan bahwa berkas tersimpan di path kustom lokal, sehingga menyesatkan pengguna.
5. **Inkonsistensi Kosakata Domain & Duplikasi Logika Antarmuka**:
   Label pada antarmuka pengaturan menggunakan istilah non-kanonik (`Clean Export` alih-alih `Clean Chart Export` sesuai `GLOSSARY.md`), serta logika resolusi direktori dan ekspansi jalur tilde (`~`) terduplikasi di beberapa modul backend.

---

## Solution

Membangun subsistem penyimpanan snapshot yang aman, efisien, dan ramah pengguna dengan mengintegrasikan dialog pemilih direktori native, sanitasi jalur berkas tanpa kompromi, dan pipa ekspor biner berkinerja tinggi:

1. **Native Directory Picker Dialog**:
   - Menyediakan tombol "Pilih Folder..." di sebelah bidang input path direktori pada menu Pengaturan (tab Umum).
   - Membuka dialog pemilih folder native sistem operasi secara asinkron (non-blocking) via backend Rust, yang langsung memperbarui preferensi `snapshotDirectory` pengguna setelah folder dipilih.
2. **Sanitasi Jalur Berkas & Pencegahan Path Traversal**:
   - Backend Rust menegakkan sanitasi ketat pada nama berkas sebelum penggabungan jalur: hanya mengambil komponen `file_name()` yang valid, menolak karakter terlarang sistem operasi, dan memastikan berkas selalu tertulis di dalam direktori target yang sah.
   - Logika penentuan direktori target dan ekspansi tilde diekstrak menjadi satu modul terpadu (*single source of truth*).
3. **Pipa Ekspor Biner Berkinerja Tinggi & Ringan**:
   - Mengoptimalkan transmisi penyimpanan dari frontend ke backend native dengan dukungan *byte chunking* / *raw binary payload* atau decoding stream yang efisien tanpa membanjiri serialisasi IPC JSON.
   - Menghilangkan sepenuhnya konversi sinkron `toDataURL` berskala 2x pada UI thread di seluruh jalur eksekusi (termasuk thumbnail toast), dengan menghasilkan thumbnail beresolusi rendah terpisah atau memanfaatkan representasi Object URL blob.
4. **Umpan Balik Lokasi Penyimpanan yang Akurat**:
   - Jika penyimpanan native ke direktori kustom berhasil, sistem melaporkan absolute path yang sebenarnya.
   - Jika sistem terpaksa melakukan fallback ke unduhan peramban standar, notifikasi secara jujur menginformasikan bahwa berkas diunduh ke folder *Downloads* peramban, bukan ke path kustom lokal.
5. **Kepatuhan Kosakata Domain & Restrukturisasi Pengaturan**:
   - Menyelaraskan seluruh teks antarmuka dengan `GLOSSARY.md` (menggunakan istilah kanonik `Clean Chart Export` dan `Branded Snapshot Frame`).
   - Merapikan seksi pengaturan snapshot di tab Umum agar terfokus murni pada konfigurasi penyimpanan dan preferensi ekspor utama tanpa duplikasi kontrol yang membingungkan.

---

## User Stories

1. As a desktop trader, I want to click a "Pilih Folder..." button in Settings, so that I can browse and select my desired snapshot folder using my operating system's native folder picker dialog without typing paths manually.
2. As a user on Windows, I want the native directory dialog to open the Windows Explorer folder browser, so that selecting my trading journal folder feels native and familiar.
3. As a user on Linux, I want the folder picker to use the desktop environment's native portal/GTK dialog, so that it integrates seamlessly with my file system permissions.
4. As a trader with an organized disk hierarchy, I want my selected snapshot folder path to persist across application restarts, so that all future snapshots automatically go into my designated folder.
5. As a trader who frequently shares charts, I want to see a clear "Buka Folder" button in both Settings and the Snapshot Preview Modal, so that I can quickly open my screenshots folder in my OS file manager with a single click.
6. As a privacy-conscious user, I want the snapshot file saving mechanism to reject any malicious relative paths (`../`) or directory traversal attempts, so that the application cannot write outside the intended directory.
7. As an active trader capturing multiple charts during high volatility, I want snapshot file saving to execute asynchronously in the background, so that the UI thread never stutters or drops frames when writing large PNGs to disk.
8. As a user of the quick snapshot shortcut (`Ctrl+Shift+S`), I want the saved notification toast to display the exact full path where the file was saved, so that I know precisely where to find it.
9. As a user running trawangan in a web browser fallback environment, I want the notification to state that the file was downloaded to my browser's default downloads folder, so that I am not misled by false local file paths.
10. As a technical analyst reading the settings menu, I want to see the canonical domain terminology "Clean Chart Export" and "Branded Snapshot Frame", so that the interface matches the application documentation and glossary.
11. As a trader who leaves the snapshot directory field empty, I want the application to automatically use my system's default OS Downloads directory without throwing errors.
12. As a user configuring custom paths, I want tilde expansion (`~/Pictures/Screenshots`) to resolve properly to my user home directory across Linux and macOS.
13. As a user on a multi-monitor or 4K setup, I want toast notification thumbnails to generate from a lightweight low-resolution raster, so that high-resolution chart composites do not freeze the UI process during toast display.
14. As an analyst taking rapid sequential snapshots, I want automatically generated filenames to remain collision-free, so that subsequent screenshots never overwrite existing analysis files.
15. As a trader resetting options, I want quick-selection chips for "Downloads (Bawaan)", "Pictures/Screenshots", and "Desktop", so that I can switch between common storage locations with a single click.

---

## Implementation Decisions

### 1. Modul Native Tauri & Keamanan Filesystem
- **Native Folder Picker Command**:
  Membangun command IPC `pick_snapshot_directory` pada backend Rust yang memanggil antarmuka dialog pemilih folder native sistem operasi secara asinkron dan mengembalikan opsi jalur string absolut yang dipilih atau null jika dibatalkan oleh pengguna.
- **Sanitasi Komponen Berkas & Pencegahan Path Traversal**:
  Menerapkan utilitas sanitasi nama berkas yang memangkas seluruh karakter path separator (`/`, `\`, `:`) dan memverifikasi bahwa penggabungan dengan direktori target menggunakan `Path::new(&filename).file_name()` murni, mencegah segala bentuk pelintasan direktori (*path traversal*).
- **Unifikasi Resolusi Direktori Target**:
  Mengekstrak fungsi pembantu `resolve_snapshot_dir` yang menjadi *single source of truth* untuk validasi direktori, ekspansi tilde pengguna (`~`), fallback ke `dirs::download_dir()` / `dirs::picture_dir()`, dan pembuatan direktori otomatis (`create_dir_all`).

### 2. Layanan Penyimpanan Frontend & Kontrak API
- **Spesifikasi Tipe Ketat & Eliminasi `any`**:
  Memperbarui kontrak antarmuka `saveSnapshotToFile(source: HTMLCanvasElement | string, filename: string, customDirectory?: string)` menjadi union type yang kuat, menghilangkan penggunaan `any`.
- **Integritas Umpan Balik Fallback**:
  Memastikan bahwa jika pemanggilan Tauri command gagal atau berada di luar lingkungan desktop, nilai balik `filePath` secara eksplisit mencerminkan jalur unduhan peramban (`Downloads/${filename}`) dan menyertakan indikator status fallback yang jujur ke lapisan pemanggil.
- **Thumbnail Toast Berbobot Ringan Tanpa `toDataURL` Raksasa**:
  Membuat thumbnail khusus untuk toast menggunakan representasi Object URL blob atau kanvas berskala kecil (maksimal 200px) alih-alih mengeksekusi `toDataURL` pada kanvas komposit 2x HiDPI skala penuh, mencegah pemblokiran thread utama.

### 3. Antarmuka Pengguna & Kosakata Domain
- **Integrasi Dialog pada `GeneralTab.svelte`**:
  Menyematkan tombol aksi "Pilih Folder..." dengan ikon penjelajah di samping input teks direktori snapshot, yang memanggil `pickSnapshotDirectory` dan memperbarui `snapshotDirectory` via `onUpdateSettings`.
- **Standardisasi Terminologi `GLOSSARY.md`**:
  Mengganti teks `Clean Export` menjadi `Clean Chart Export` pada seluruh kontrol opsi toggle dan dokumentasi antarmuka.

---

## Testing Decisions

### Apa yang Membuat Pengujian Ini Berkualitas:
- Menguji perilaku eksternal sistem (*black-box behavior*), bukan detail implementasi internal.
- Memverifikasi pencegahan celah keamanan *path traversal* dengan masukan berbahaya (`../../etc/shadow` atau `..\..\Windows`).
- Menguji resolusi direktori kustom, ekspansi tilde, dan mekanisme fallback secara deterministik.
- Memastikan tidak ada eksekusi sinkron berat yang memblokir loop reaktivitas Svelte 5.

### Modul yang Diuji:
1. `src/lib/services/chartSnapshotService.ts` (API simpan berkas, pemilih direktori, dan deteksi fallback).
2. `src/lib/constants/defaults.ts` & `PersistenceService` (persistensi dan normalisasi `snapshotDirectory`).
3. `src-tauri/src/commands.rs` (sanitasi nama berkas, keamanan path traversal, dan resolusi direktori).
4. `GeneralTab.svelte` & `SnapshotPreviewModal.svelte` (verifikasi antarmuka, terminologi domain, dan integrasi aksi pemilih folder).

### Prior Art:
- `tests/snapshotPreviewModalAndPersistence.test.ts` (pola pengujian mock canvas, persistensi settings, dan komposit snapshot).
- `tests/snapshotPreviewModalReactivity.test.ts` (pola pengujian isolasi reaktivitas dan pencegahan saturasi IPC).

---

## Out of Scope

1. Penyimpanan snapshot ke layanan cloud pihak ketiga (Google Drive, Dropbox, AWS S3) — terminal tetap berpegang teguh pada prinsip 100% offline dan privasi pengguna.
2. Penamaan berkas otomatis dengan format kustom berbasis template ekspresi rumit (*filename templating engine*) — tetap menggunakan pola nama kanonik terstruktur `trawangan-[symbol]-[tf]-[timestamp].png`.
3. Editor anotasi gambar bawaan (seperti menggambar panah atau teks di atas snapshot yang sudah selesai) — pengeditan grafik dilakukan langsung pada kanvas sebelum snapshot ditangkap.

---

## Further Notes

Fitur ini melengkapi arsitektur offline snapshot yang dirintis pada ADR 0012, memberikan kenyamanan level desktop kelas satu tanpa mengorbankan keamanan sistem berkas pengguna.
