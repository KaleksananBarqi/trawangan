# 0032. Docked Thesis Preview Consolidation, Arekan Localization Engine, Startup Spotlight Tour, and Apache-2.0 Attribution Licensing

## Status
Diterima (*Accepted*), 24 November 2026. Mengamandemen `ADR-0014` dan `ADR-0019`.

## Konteks
1. **Kenyamanan Ruang Pandang Kanvas Grafik**: Penggunaan `FloatingThesisCard` yang melayang di atas kanvas grafik terbukti menghalangi candlestick dan garis indikator saat analisis intensif, padahal panel dock kanan sudah memiliki tab `Plan` yang memuat editor `Form`, `Teks`, dan `Riwayat`.
2. **Orientasi Pengguna Baru**: Banyaknya kapabilitas unik `trawangan` (seperti *Draw by Holding* `Shift+D`, tempel Markdown Trade Plan `Ctrl+V`, indeks makro `TOTAL`/`BTC.D`, dan *Side-by-Side Pine IDE*) membutuhkan alur tutorial interaktif saat aplikasi pertama kali dijalankan.
3. **Identitas Bahasa Jawa Ngoko Arekan (`jv` Default) & Multi-Bahasa**: Sesuai akar nama `trawangan`, aplikasi dan dokumentasi resmi membutuhkan dukungan tiga bahasa (**Jawa**, **Indonesia**, **Inggris**) dengan **Basa Jawa Ngoko Arekan** (Suroboyoan/Jawa Timuran yang lugas, blak-blakan, dan cadas) sebagai bahasa utama (default).
4. **Perlindungan Atribusi Open Source**: Lisensi MIT dinilai terlalu longgar terhadap fork yang menghapus identitas pembuat asli di antarmuka maupun dokumentasi.

## Keputusan Arsitektur

1. **Konsolidasi `Docked Thesis Preview` di Tab `Plan` & Penghapusan `FloatingThesisCard`**:
   - Menghapus `FloatingThesisCard.svelte` dari atas lapisan kanvas grafik WebGL2 sehingga area candlestick 100% bersih dari kartu melayang.
   - Menambahkan sub-tab **`Preview`** di dalam `TradePlanTab.svelte` (`Preview` | `Form` | `Teks` | `Riwayat`) yang merender kartu tesis visual lengkap (badge bias, probabilitas, skor konfluensi, Dual-Entry `E1`/`E2`, Zona Konteks POI, skenario invalidasi, target R-multiple, dan badge epistemik `[FAKTA]`/`[INFERENSI]`/`[SPEKULASI]`).
   - Perilaku cerdas tab `Plan`: otomatis membuka sub-tab **`Preview`** ketika simbol aktif sudah memiliki Trade Plan aktif (atau sesaat setelah plan diterapkan), dan otomatis membuka sub-tab **`Form`** jika simbol belum memiliki plan aktif.
   - Untuk ekspor gambar **Snapshot (`Ctrl+Shift+S`)**, tata letak tesis distandarkan menggunakan **`side-panel`** (berdampingan di sisi kanan grafik) atau **`hidden`**.

2. **Startup Spotlight Tour (Interactive First-Run Onboarding)**:
   - Menyediakan komponen `StartupTutorialModal.svelte` yang otomatis muncul pada peluncuran pertama (`hasCompletedOnboarding: false` di `AppSettings` SQLite) dan dapat dipanggil ulang kapan saja dari Header / menu Bantuan.
   - Memandu pengguna melalui:
     1. Sambutan & Pemilihan Bahasa (`Jawa Arekan [Default]`, `Indonesia`, `English`) + Mode Tema.
     2. Pencarian Simbol Multi-Aset & Indeks Makro (`Ctrl+K` / ketik langsung di kanvas).
     3. Gesture Engine *Draw by Holding* (`Shift+D` / `~`) & *Scribble Erase*.
     4. Tab `Plan` (`Preview`, `Form`, `Teks Markdown`, & `Vault`).
     5. *Side-by-Side Pine Script v6 IDE* (`Alt+E`) & *Snapshot Ultra HD* (`Ctrl+Shift+S`).
     6. Informasi fitur opsional *Opt-In Execution Bridge* di Pengaturan.

3. **Arekan Localization Engine (`jv` Default, `id`, `en`)**:
   - Membangun store dan kamus i18n reaktif ringan (`src/lib/i18n/`) tanpa dependensi library eksternal yang berat, dengan default **`jv` (Basa Jawa Ngoko Arekan, Level 1 Cadas/Suroboyoan)**.
   - Seluruh istilah teknis pasar modal/kripto (*Candlestick, Timeframe, Watchlist, Stop Loss, Take Profit, Entry, Bullish, Bearish, Leverage, R-Multiple*) tetap dipertahankan dalam bahasa Inggris standar industri.
   - Menyediakan pemilih bahasa instan di **Header / Pengaturan Umum / Tutorial Start-up**, halaman **Landing Page (`docs/index.html`)** dengan switcher `JV | ID | EN` (default `JV`), serta tiga berkas README berautan silang: **`README.md`** (Jawa Arekan - Default), **`README.id.md`** (Bahasa Indonesia), dan **`README.en.md`** (English).

4. **Migrasi Lisensi ke Apache License 2.0 + Berkas Wajib `NOTICE`**:
   - Mengganti lisensi repositori dari MIT menjadi **Apache License 2.0** dilengkapi berkas **`NOTICE`** resmi di root repositori.
   - Berdasarkan Klausul 4(d) Apache License 2.0, setiap pihak yang me-fork, memodifikasi, atau mendistribusikan ulang `trawangan` **wajib** menyertakan seluruh isi atribusi di berkas `NOTICE` secara jelas dan terlihat di dalam dokumentasi maupun tampilan *About / Tentang Aplikasi* pada karya turunannya, serta dilarang menyalahgunakan merek dagang/logo `trawangan` (Klausul 6).
