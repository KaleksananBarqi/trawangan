# 0002. Distribution Strategy and Self-Contained Landing Page Architecture

## Konteks & Status
Aplikasi desktop `trawangan` membutuhkan sarana distribusi installer multi-platform (Windows, Linux, macOS) serta etalase visual (*landing page*) yang mengenalkan filosofi produk dan keunggulan *Zero-Paywall Parity*.

## Keputusan
1. **Hosting Landing Page via GitHub Pages (`/docs` directory):**
   - Landing page dibangun menggunakan Vanilla HTML5, CSS3, dan JavaScript mandiri tanpa ketergantungan pada runtime Node.js, framework berat, atau pipeline bundler terpisah di direktori `docs/`.
   - Menggunakan aset mandiri di `docs/assets/` sehingga halaman dapat langsung disajikan oleh GitHub Pages dengan konfigurasi build `Deploy from a branch > /docs`.
   - Menghindari pembengkakan ukuran binary desktop Tauri v2 karena landing page tidak dibundel ke dalam installer lokal.

2. **Distribusi Biner via GitHub Releases:**
   - Semua paket instalasi biner (`.exe`, `.msi`, `.AppImage`, `.deb`, `.dmg`) didistribusikan melalui GitHub Releases resmi di repositori `https://github.com/KaleksananBarqi/trawangan/releases`.
   - Landing page dilengkapi deteksi otomatis sistem operasi pengunjung (Client OS Detection) untuk memberikan tautan unduhan langsung ke biner yang sesuai, dengan fallback ke halaman rilis penuh.

## Konsekuensi & Kompromi
- **Keuntungan:** Nol biaya hosting server, zero pipeline overhead, kecepatan muat halaman maksimal, dan pemeliharaan satu atap di repositori utama.
- **Kompromi:** Pembaruan landing page dilakukan secara langsung dengan mengedit aset di `docs/` tanpa SSR (*Server-Side Rendering*), yang mana sangat mencukupi untuk kebutuhan situs pameran (*showcase*) aplikasi desktop.
