---
name: release
description: Release automation workflow for Trawangan. Triggers on requests to release, publish a new version, bump version, write changelog, tag, or push a release.
---

# Trawangan Release Workflow

Workflow otomatis untuk merilis versi baru aplikasi desktop **trawangan** secara deterministik, aman, dan teruji.

Gunakan alur ini setiap kali pengguna meminta rilis baru, bump versi, pembaruan changelog rilis, atau tagging & pushing release.

---

## 🎯 Completion Criteria (Gerbang Penyelesaian)
Alur rilis dianggap **SELESAI** jika dan hanya jika:
1. Seluruh 4 berkas manifes versi terverifikasi sinkron pada versi SemVer target.
2. `CHANGELOG.md` memuat seksi rilis baru dengan standar *Keep a Changelog*.
3. Gerbang pengujian lolos 100% (`npm test` pass, `npm run check` 0 error, `cargo check` clean).
4. Git commit dan annotated git tag `v<version>` terbentuk.
5. Branch utama dan git tag berhasil di-push ke remote GitHub (`origin`).
6. Dokumentasi Second Brain di Obsidian berhasil dicatat via MCP tanpa menunggu konfirmasi manual.

---

## 📋 Langkah-Langkah Eksekusi (In-File Steps)

### Langkah 1: Resolusi Versi SemVer Target
1. Periksa versi saat ini pada `package.json` (`pkg.version`).
2. Periksa commit terakhir sejak tag rilis sebelumnya:
   ```powershell
   git log $(git describe --tags --abbrev=0)..HEAD --oneline
   ```
3. Tentukan nomor versi SemVer berikutnya:
   - **Patch (`0.x.Y+1`)**: Hanya perbaikan bug kecil, penyesuaian styling minor, atau perbaikan dokumentasi internal.
   - **Minor (`0.X+1.0`)**: Penambahan fitur baru yang *backwards-compatible* (misal: penambahan modul, pembaruan arsitektur ADR, in-app update, layout baru).
   - **Major (`X+1.0.0`)**: Rilis stabil mayor dengan perombakan antarmuka/kontrak data yang memecah kompatibilitas.
   *(Jika pengguna menentukan versi eksplisit, gunakan versi dari pengguna).*

---

### Langkah 2: Sinkronisasi Manifes Versi
Perbarui nomor versi ke nilai target pada seluruh berkas berikut secara serentak:
1. **`package.json`**:
   - Kolom `"version": "X.Y.Z"`
2. **`src-tauri/tauri.conf.json`**:
   - Kolom `"version": "X.Y.Z"`
3. **`src-tauri/Cargo.toml`**:
   - Kolom `version = "X.Y.Z"` pada blok `[package]`
4. **`tests/updateService.test.ts`**:
   - Selaraskan baris assertion: `assert.equal(APP_VERSION, 'X.Y.Z');`

---

### Langkah 3: Kompilasi Catatan Rilis pada `CHANGELOG.md`
1. Buka [CHANGELOG.md](file:///c:/Projek/Trawangan/CHANGELOG.md).
2. Sisipkan seksi rilis baru tepat di bawah garis pemisah header utama (`---`):
   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD

   ### 🚀 Ditambahkan (Added)
   - Deskripsi fitur baru, endpoint, atau kapabilitas yang ditambahkan.

   ### 🔄 Diubah (Changed)
   - Deskripsi peningkatan UX, refactoring komponen, atau pembaruan konfigurasi.

   ### 🐛 Diperbaiki (Fixed)
   - Deskripsi perbaikan bug (jika ada).
   ```
3. Pastikan bahasa yang digunakan adalah bahasa Indonesia yang lugas dan profesional sesuai standar proyek.

---

### Langkah 4: Quality Gate (Verifikasi Kualitas Wajib)
Jalankan rangkaian pengujian berikut secara berurutan:
1. **Unit Test Suite:**
   ```powershell
   npm test
   ```
   *Kriteria lolos:* Semua unit test harus berstatus passing (0 failures).
2. **Type Check & Svelte Validation:**
   ```powershell
   npm run check
   ```
   *Kriteria lolos:* 0 errors ditemukan.
3. **Rust Backend Check:**
   ```powershell
   cargo check --manifest-path src-tauri/Cargo.toml
   ```
   *Kriteria lolos:* Kompilasi sukses tanpa error. Hal ini juga otomatis memperbarui `src-tauri/Cargo.lock`.

> [!CAUTION]
> **JANGAN PERNAH** melanjutkan ke langkah Git Commit/Push jika ada pengujian atau pemeriksaan yang gagal! Perbaiki akar masalahnya terlebih dahulu.

---

### Langkah 5: Git Commit & Tagging
1. Tambahkan semua berkas yang telah diperbarui ke staging:
   ```powershell
   git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock tests/updateService.test.ts CHANGELOG.md
   ```
2. Buat commit rilis dengan format pesan standar:
   ```powershell
   git commit -m "chore(release): bump version to vX.Y.Z and update CHANGELOG"
   ```
   *(Atau gunakan tipe `feat(release):` jika rilis didominasi oleh fitur mayor).*
3. Buat annotated git tag:
   ```powershell
   git tag -a vX.Y.Z -m "Release vX.Y.Z: <Ringkasan Singkat Fitur>"
   ```

---

### Langkah 6: Remote Push (Memicu CI/CD Rilis)
1. Push branch `main` ke remote:
   ```powershell
   git push origin main
   ```
2. Push git tag ke remote:
   ```powershell
   git push origin vX.Y.Z
   ```
   *Catatan:* Push tag `v*` akan otomatis memicu workflow GitHub Actions `.github/workflows/release.yml` untuk mem-build installer biner multi-platform (Windows `.exe`/`.msi`, Linux `.AppImage`/`.deb`, macOS `.dmg`).

---

### Langkah 7: Dokumentasi Otomatis Second Brain (Obsidian MCP)
Panggil tool `create_vault_file` pada MCP `mcp-tools-istefox` **tanpa menunggu persetujuan pengguna**:
- **Lokasi Target:** `Project Logs/YYYY-MM-DD - Rilis vX.Y.Z <Ringkasan Singkat>.md`
- **Metadata Frontmatter:**
  ```yaml
  ---
  title: "Rilis vX.Y.Z - <Ringkasan Singkat>"
  date: "YYYY-MM-DD"
  tags:
    - "#dev-log"
    - "#trawangan"
    - "#release"
    - "#semver"
    - "#changelog"
  project: "[[Architecture/Trawangan - Crypto Charting Architecture]]"
  ---
  ```
- **Konten:** Ringkasan perubahan rilis, daftar berkas yang disentuh, status git commit & tag, dan pranala Wikilinks ke catatan arsitektur relevan.
