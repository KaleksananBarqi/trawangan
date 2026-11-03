# Aturan Global Anti-Gravity

## 1. Panduan Bahasa & Komunikasi
- **Bahasa Utama:** Wajib gunakan bahasa Indonesia untuk seluruh respons, penjelasan, saran *refactoring*, dan diskusi.
- **Komentar Kode:** Tulis komentar di dalam kode (*inline comments*, *docstrings*, *JSDoc*) menggunakan bahasa Indonesia yang lugas dan jelas.
- **Istilah Teknis & Sintaksis:** Pertahankan bahasa Inggris untuk sintaksis kode (nama variabel, fungsi, *class*) dan istilah standar industri (*array*, *callback*, *deployment*, *merge*). Istilah serapan yang sudah umum (variabel, fungsi, pustaka, server) diperbolehkan.
- **Gaya Bahasa:** Profesional, santai, dan *to the point*. Hindari gaya terjemahan harfiah (*translationese*) yang kaku.

## 2. Integrasi Second Brain (Obsidian via MCP)
Fokus pada otomatisasi manajemen pengetahuan. Patuhi alur *Read*, *Write*, dan *Update* berikut:

### A. Pengambilan Konteks (Read)
- **Wajib Cek Sebelum Koding:** Selalu panggil *tool* `search_vault_smart` atau `get_vault_file` untuk mencari keputusan arsitektur, standar koding, atau konteks proyek sebelum merancang solusi atau menulis kode.
- Jadikan catatan di Obsidian sebagai sumber kebenaran (*source of truth*) utama.

### B. Dokumentasi Otomatis (Auto-Save)
- **Eksekusi Tanpa Konfirmasi:** Setelah menyelesaikan task **PENTING**, langsung panggil `append_to_vault_file` (atau `create_vault_file` jika belum ada) **tanpa menunggu persetujuan user**.
- **Klasifikasi Task:**
  - 🔴 **PENTING (Wajib Auto-Save):** Fitur baru, *bug fix* mayor, *refactoring* arsitektur (perubahan alur data/nama modul), keputusan teknis baru (pilihan library/pola desain), dan perubahan skema/kontrak API.
  - 🟢 **TRIVIAL (Jangan Disimpan):** Perbaikan *typo*, penyesuaian *whitespace*/komentar, *rename* variabel lokal, eksperimen gagal, dan eksekusi perintah rutin (*build*, *test*). Jangan melakukan *spam* catatan.
- **Format & Struktur Catatan:**
  - **Lokasi Target:** `Project Logs/YYYY-MM-DD - <ringkasan-singkat>.md` (atau tambahkan ke log harian yang ada). Untuk keputusan sistem, simpan di `Architecture/`.
  - **Isi Minimal:** Tanggal, ringkasan perubahan, daftar file utama yang dimodifikasi, dan alasan keputusan.
  - **Metadata:** Gunakan format *Wikilinks* (contoh: `[[Nama Note]]`) dan wajib sertakan tag relevan (contoh: `#dev-log`, `#architecture`).

### C. Pemeliharaan Catatan (Update)
- Jika kode yang diperbarui mengubah arsitektur utama atau nama fungsi esensial, lacak dan perbarui catatan lama di Obsidian menggunakan `search_and_replace` atau `patch_vault_file` agar dokumentasi tidak usang.
