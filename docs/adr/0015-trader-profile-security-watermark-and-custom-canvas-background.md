# 0015 - Trader Profile Attribution, Security Watermark, and Custom Canvas Background

## Konteks
Fitur tangkapan layar grafik (*Branded Snapshot Engine*) yang diperkenalkan pada ADR-0012 berhasil menyediakan cara cepat dan estetis bagi trader untuk membagikan analisis teknikal tanpa watermark korporat yang menutupi candlestick. Namun, seiring meningkatnya penggunaan untuk publikasi di media sosial (X/Twitter, Telegram, Discord), muncul beberapa kebutuhan krusial:
1. **Keamanan Kepemilikan Analisis**: Trader membutuhkan tanda air (*security watermark*) personal di area grafik untuk mencegah pencurian atau klaim sepihak atas analisis mereka, namun tanda air ini tidak boleh merusak keterbacaan data candlestick.
2. **Personal Branding**: Trader ingin menyematkan identitas personal (foto profil/avatar, nama pengguna, dan handle media sosial) berdampingan dengan identitas resmi aplikasi tanpa mengorbankan privasi luring (*offline-first*).
3. **Kualitas Citra Multi-Resolusi**: Kebutuhan ekspor resolusi tinggi (4K Ultra HD dan 6x Super HD) untuk display besar atau cetak grafis, melengkapi skala standar 2x HiDPI.
4. **Kustomisasi Latar Belakang Kanvas**: Keinginan pengguna untuk mempersonalisasi warna latar belakang grafik (solid maupun gradien vertikal) secara global langsung dari menu pengaturan tema, terpisah dari setting internal engine chart.
5. **Harmonisasi Tema Kartu Tesis**: Komponen overlay rencana perdagangan (*Floating Thesis Card*) sebelumnya menggunakan warna hardcoded bernuansa biru slate yang tidak selaras ketika pengguna memilih tema Signature, Binance, Bitunix, atau TradingView.
6. **Koreksi Identitas Visual Brand**: Penyelarasan aset logo resmi aplikasi menggunakan `/static/logo.png` menggantikan implementasi monogram `tr` canvas sementara.

## Keputusan
1. **Trader Profile Attribution & Offline Storage**:
   - Menambahkan skema profil pengguna lokal pada `AppSettings` (disimpan di IndexedDB/localStorage): `userProfile: { avatarDataUrl?: string, username: string, handle?: string }`.
   - Mengintegrasikan avatar, username, dan handle ke dalam sisi kiri *Attribution Bar* di *Branded Snapshot Frame*, berdampingan dengan logo resmi aplikasi `/static/logo.png`.
   - Menyediakan fallback visual berbasis inisial huruf pertama saat foto profil belum diunggah.

2. **Security Watermark Engine**:
   - Mengimplementasikan layer tanda air proteksi di lapisan latar kanvas grafik (di belakang candlestick dan garis indikator).
   - Menata teks identitas secara diagonal (30°–45°) di tengah kanvas dengan slider opasitas terkontrol (default 10%, rentang 5%–30%).
   - Secara bawaan, tanda air hanya dirender saat komposit ekspor tangkapan layar, dengan opsi toggle *"Tampilkan di Kanvas Kerja"* bagi trader yang menginginkan proteksi visual saat sesi live streaming.

3. **Multi-Scale Export Compositing (1x, 2x, 4x, 6x)**:
   - Memperluas mesin `chartSnapshotService` untuk mendukung multiplier resolusi dinamis: `1x`, `2x (HiDPI)`, `4x (Ultra HD)`, dan `6x (Super HD)`.
   - Menampilkan estimasi dimensi piksel riil pada antarmuka dropdown dan pratinjau snapshot.
   - Menjalankan proses komposit beresolusi tinggi secara asinkron dengan indikator visual pemrosesan untuk menjaga responsivitas UI.

4. **Custom Canvas Background Engine (Solid & Gradien Vertikal)**:
   - Menambahkan pengaturan latar belakang kanvas terpadu pada tab *Tema & Tipografi*:
     - *Bawaan Tema*: Menggunakan warna latar preset aktif.
     - *Warna Solid*: Kustomisasi warna tunggal melalui color picker.
     - *Gradien Vertikal*: Dua titik warna (atas dan bawah) yang dirender mulus pada kanvas WebGL2 dan komposit 2D via `createLinearGradient`.
   - Menyediakan tombol pemulihan cepat (*Reset ke Bawaan Tema*).

5. **Reaktif Themed Thesis Overlay**:
   - Memutasi `FloatingThesisCard.svelte` dan `chartSnapshotOverlayService.ts` untuk mengonsumsi token palet tema aktif (`tokens.bgSecondary`, `tokens.borderSubtle`, `tokens.textPrimary`, `tokens.textMuted`).
   - Mempertahankan aksen bias Bullish dan Bearish sesuai konfigurasi candlestick tema aktif (Signature hot pink/white, Classic green/red).

6. **Tab Pengaturan "Profil & Watermark"**:
   - Menyediakan tab navigasi khusus di `SettingsModal.svelte` untuk memusatkan formulir identitas profil trader, konfigurasi tanda air keamanan, dan preferensi bawaan tangkapan layar.

## Konsekuensi
- Trader dapat membagikan analisis terproteksi dengan identitas personal yang tajam hingga resolusi 6x tanpa dependensi cloud atau risiko privasi.
- Tampilan grafik dan kartu tesis menjadi sepenuhnya konsisten secara visual di semua tema.
- Tidak ada beban overhead jaringan karena seluruh pemrosesan profil dan citra berjalan luring murni di sisi klien.
