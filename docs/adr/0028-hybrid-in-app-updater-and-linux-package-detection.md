# 0028 - Arsitektur Hybrid In-App Updater dan Deteksi Paket Linux

## Status
Diterima (*Accepted*), 14 November 2026.

## Konteks
Sebelumnya, mekanisme pembaruan `trawangan` (`updateService.ts` dan `AboutTab.svelte`) hanya memeriksa metadata rilis GitHub API lalu melempar pengguna ke browser eksternal untuk mengunduh installer secara manual. Selain itu, deteksi aset Linux selalu memprioritaskan `.AppImage` (~83 MB) meskipun pengguna Fedora menginstal paket `.rpm` (~6,7 MB) yang sudah dipublikasikan di GitHub Releases.

Secara teknis pada Tauri v2:
- `tauri-plugin-updater` mendukung pembaruan *in-place* otomatis penuh (unduh, verifikasi signature `minisign`, pasang, restart) untuk **Windows** (`.exe`/`.msi`), **macOS** (`.app.tar.gz`), dan **Linux `.AppImage`**.
- `tauri-plugin-updater` **tidak mendukung** pembaruan *in-place* untuk paket sistem Linux **`.rpm`** dan **`.deb`**, karena biner dipasang pada jalur sistem milik `root` (`/usr/bin/trawangan`) dan dikelola oleh `dnf`, `zypper`, atau `apt`.

## Keputusan

1. **Arsitektur Hybrid In-App Updater:**
   - **Windows, macOS, dan Linux `.AppImage`:** Menggunakan `tauri-plugin-updater` dengan verifikasi signature kriptografis `minisign` (`latest.json` + berkas `.sig`).
   - **Linux `.rpm` dan `.deb`:** Menggunakan jalur *native* Rust (`updater.rs`) yang mengunduh paket dengan pelaporan progress streaming, memverifikasi integritas berkas terhadap `SHA256SUMS.txt` dari tag rilis yang sama, lalu memasang lewat elevasi sistem standar (`pkexec` + `dnf`/`zypper`/`rpm`/`apt-get`) dengan fallback `xdg-open` apabila `pkexec` tidak tersedia.
   - **Restart Bersih pada `single-instance`:** Setelah pemasangan `.rpm`/`.deb` sukses, berkas sementara dihapus dan proses lama meluncurkan helper terpisah yang menunggu PID lama keluar (melepas lock `tauri-plugin-single-instance`) sebelum menjalankan biner terbaru.

2. **Deteksi Asal Instalasi Runtime & Guard Store/Dev:**
   - Backend Rust memeriksa lingkungan eksekusi saat startup (`detect_install_environment`):
     - Mode pengembangan (`cfg!(debug_assertions)`) → nonaktifkan eksekusi *in-place*.
     - `FLATPAK_ID` → mode *Store-managed* (arahkan pembaruan ke Software Center / `flatpak update`).
     - `APPIMAGE` → `.AppImage` (via `tauri-plugin-updater`).
     - `rpm -qf <exe>` → `.rpm` (Fedora/openSUSE/RHEL).
     - `dpkg -S <exe>` → `.deb` (Debian/Ubuntu).
     - Disertai deteksi arsitektur CPU (`x86_64` vs `aarch64`).
   - UI `AboutTab.svelte` tetap menyediakan daftar pilihan manual seluruh format installer untuk pengguna yang ingin mengganti format.

3. **Alur UX Non-Blocking & Persistensi:**
   - Pengecekan metadata berjalan saat startup dan berkala tiap **6 jam**, tanpa auto-download diam-diam.
   - Unduhan hanya dimulai saat pengguna menekan tombol pembaruan; progress disimpan di `updateService` sehingga tampil di pill `Header` & `StatusBar` tanpa memblokir kanvas chart.
   - Pengguna dapat menunda/mengabaikan versi tertentu (disimpan di SQLite via `PersistenceService` dengan kunci `dismissed_update_version`, sesuai `ADR-0026`).

4. **Pengecualian Khusus Batas Dependensi ADR-0003:**
   - Dokumen `ADR-0003` tidak diubah. Subsistem *in-app updater* ini dicatat sebagai **pengecualian khusus yang terukur** terhadap batas penambahan dependensi +150 KB pada `ADR-0003` karena kebutuhan verifikasi kriptografis (`minisign`, `sha2`) dan abstraksi updater native Tauri v2, dengan syarat ukuran installer native (`.rpm`, `.deb`, `.exe`, `.msi`, `.dmg`) tetap berada jauh di bawah batas keras 20 MB (~5–7 MB) dan RAM idle tidak meningkat signifikan.

## Konsekuensi
- Pengguna di seluruh OS desktop (termasuk Fedora `.rpm` dan Debian/Ubuntu `.deb`) dapat mengunduh, memverifikasi, dan memasang pembaruan langsung dari dalam aplikasi.
- Pipeline `.github/workflows/release.yml` mempertahankan seluruh nama aset existing demi kompatibilitas mundur versi `<= v0.48.0`, sekaligus menerbitkan `latest.json`, berkas `.sig`, dan `SHA256SUMS.txt` melalui job finalisasi terpusat.
- Rilis CI memerlukan GitHub Secret `TAURI_SIGNING_PRIVATE_KEY` yang berpasangan dengan `pubkey` di `src-tauri/tauri.conf.json`.
