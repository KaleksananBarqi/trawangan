# 0018. Live Theme Preview, Chart Context Menu Pruning, In-Place Palette Editing, Canvas Watermark Control, and Workspace Auto-Save Guard

## Konteks & Latar Belakang
Pada sistem penyesuaian visual sebelumnya (ADR 0016 dan 0017), skema tema aplikasi dan tema kanvas grafik telah didecouple (`syncChartWithAppTheme`). Namun, ditemukan beberapa friksi operasional dan ketidaksempurnaan ergonomi:
1. Saat `syncChartWithAppTheme` nonaktif, pemilihan tema aplikasi via dropdown atau klik kartu tema tidak bereaksi secara langsung (*live preview*) karena `resolveEffectiveThemePreset()` memprioritaskan preset gelap/terang lama tanpa menyelaraskan `colorModePreference`.
2. Klik kanan pada kanvas grafik masih memuat opsi *"Pengaturan Grafik (Warna & Lilin)..."* yang memicu dialog bawaan internal Vela, membuat alur konfigurasi terpecah dan bertentangan dengan prinsip pengaturan terpusat di `SettingsModal`.
3. Pada kartu tema kustom pengguna (*User Theme Preset*), pengguna hanya dapat mengubah nama tema (*rename*), tanpa kemampuan mengedit warna tema yang sudah disimpan secara langsung (*in-place update*). Untuk mengubah warna, pengguna terpaksa membuat tema baru via "Save As" lalu menghapus tema lama secara manual.
4. Pengaturan untuk mematikan watermark simbol besar di belakang grafik belum tersedia di *Tab Tampilan (AppearanceTab)*, meskipun deskripsi antarmuka menyebutkan kendali watermark. Pengguna kesulitan menemukan sakelar pemati watermark.
5. Subsistem `triggerWorkspaceAutoSave` di `+page.svelte` terpicu setiap detik akibat referensi array `activeIndicators` yang dibuat ulang pada siklus pemantauan kanvas, membebani I/O disk SQLite dan memicu spam log terminal yang tidak perlu.

## Keputusan Arsitektur

### 1. Reaktivitas Live Preview Tema Terpisah (Decoupled Live Preview)
- Menyelaraskan pemilihan tema aplikasi: saat pengguna memilih tema aplikasi (baik melalui dropdown maupun kartu tema) dengan mode biner yang berlawanan dari mode aktif saat itu, sistem secara deterministik menyinkronkan `colorModePreference` ke mode tema terkait (`'dark'` atau `'light'`).
- Memastikan `effectiveThemePreset` dan `chartThemePreset` langsung diperbarui secara reaktif ke root DOM dan controller kanvas tanpa perlu menutup dialog pengaturan atau memuat ulang halaman.

### 2. Pemangkasan Menu Konteks Kanvas (Chart Context Menu Pruning)
- Menghapus sepenuhnya opsi *"Pengaturan Grafik (Warna & Lilin)..."* dan garis pemisahnya dari `ChartContextMenu.svelte`.
- Menu konteks kanvas grafik difokuskan murni untuk aksi analitikal cepat:
  1. Tambah Price Alert pada level harga kursor
  2. Gambar Garis Horizontal
  3. Salin Angka Harga ke Clipboard
  4. Reset Skala Grafik (`Alt+Z`)
- Seluruh pengaturan tampilan visual lilin dan kanvas diarahkan terpusat ke `SettingsModal` (Tab Tampilan dan Tab Grafik).

### 3. In-Place Theme Color Editing & Safe Forking
- Menambahkan tombol aksi "Edit Warna" (ikon `Palette`) pada setiap kartu tema di `AppearanceTab.svelte`.
- Untuk **User Theme Preset**: Mengklik "Edit Warna" akan memuat 9 nilai warna tema ke dalam *Palet Kustom Studio*, menggulir tampilan secara mulus ke studio, dan mengaktifkan mode penyuntingan tema aktif (`Sedang Mengedit: [Nama Tema]`) dengan tombol aksi *"Simpan Perubahan ke Tema Ini"* yang langsung memperbarui entitas di `savedUserThemes`.
- Untuk **Preset Bawaan Resmi**: Mengklik "Edit Warna" akan memuat palet resmi ke studio sebagai draf duplikasi kustom (*forking*) dengan tombol *"Simpan Sebagai Tema Baru"*, menjaga integritas tema resmi dari modifikasi destruktif.

### 4. Kontrol Visibilitas Watermark Simbol di Tab Tampilan (Canvas Watermark Guard)
- Menambahkan toggle eksplisit *"Watermark Simbol di Kanvas"* pada seksi Tema Kanvas Chart di `AppearanceTab.svelte`.
- Menghubungkan toggle ini secara dua arah dengan properti `showWatermark` pada `AppSettings` dan menyinkronkannya dengan Tab Grafik.
- Mengintegrasikan pemanggilan `cell.setWatermarkVisible(show)` secara deterministik pada controller grafik sehingga penonaktifan watermark berlangsung instan di seluruh sel WebGL2.

### 5. Workspace Auto-Save Guard (Deep Equality & Debounce Hardening)
- Menambahkan pemeriksaan kesamaan nilai struktural (*deep/value equality hash*) sebelum memicu penjadwalan auto-save workspace.
- Mengabaikan mutasi yang hanya disebabkan oleh alokasi ulang referensi array atau objek identik.
- Meningkatkan penahan waktu (*debounce*) dari 1,5 detik menjadi 3,5 detik guna mengeliminasi lonjakan I/O disk lokal pada SQLite.
- Menyenapkan log autosave rutin dari terminal/console agar tidak mengaburkan peringatan sistem yang lebih kritis.

## Konsekuensi & Dampak
- **Positif:**
  - Pengalaman personalisasi tema menjadi instan dan mulus (*WYSIWYG live preview*).
  - Alur pengaturan pengguna menjadi konsisten dan terpusat di satu dialog modal.
  - Pengelolaan tema kustom pengguna menjadi jauh lebih praktis dan ramah pengguna.
  - Terminal menjadi tenang dan bebas spam log, dengan penghematan siklus CPU dan write-cycle SSD.
- **Pertimbangan:**
  - Pengguna yang sebelumnya terbiasa mengakses pengaturan lilin Vela via klik kanan kanvas kini perlu membukanya via Tab Grafik atau Tab Tampilan di Pengaturan.
