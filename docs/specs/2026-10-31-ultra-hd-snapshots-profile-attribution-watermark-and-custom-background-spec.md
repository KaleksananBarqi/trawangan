# Spec: Ultra HD Multi-Scale Snapshots, Trader Profile Attribution, Security Watermark, Custom Canvas Background, and Themed Thesis Overlay

## Problem Statement

Pengguna terminal `trawangan` menghadapi beberapa kendala visual, keamanan hak cipta analisis, dan fleksibilitas kustomisasi antarmuka saat menganalisis pasar serta membagikan grafik ke media sosial dan komunitas trading:

1. **Hasil Tangkapan Layar Buram pada Tampilan Beresolusi Tinggi (Ketiadaan Opsi 4K / Super HD)**:
   Saat ini mesin snapshot (`chartSnapshotService`) terkunci kaku pada skala 2x HiDPI tunggal. Ketika trader menggunakan monitor beresolusi tinggi (4K/6K) atau ingin mengekspor grafik untuk dicetak atau diunggah ke platform media sosial yang membutuhkan kerapatan piksel ekstra tinggi, angka skala harga, garis indikator, dan ekor lilin (*candlestick wicks*) terlihat kurang tajam dan tidak ada kontrol multiplier resolusi yang fleksibel (seperti 4K atau 6x Super HD).

2. **Identitas Logo pada Bilah Atribusi Tidak Akurat**:
   Bilah atribusi tangkapan layar (*Attribution Bar*) saat ini menggambar monogram vektor huruf `tr` manual yang dibuat secara terpisah dan bukan merupakan representasi visual logo resmi aplikasi `trawangan`. Pengguna mengidentifikasi bahwa logo yang sah adalah aset citra resmi `logo.png` pada folder aset statis aplikasi dan menghendaki seluruh representasi brand konsisten menggunakan aset resmi tersebut.

3. **Kerentanan Pembajakan Analisis & Ketiadaan Tanda Air Keamanan (Security Watermark)**:
   Trader membagikan ide perdagangan dan analisis teknikal ke ruang publik (Twitter/X, Telegram, Discord). Tanpa penanda kepemilikan di area grafik, gambar analisis sangat rentan di-screenshot ulang (*re-uploaded*) atau diklaim sepihak oleh pihak lain tanpa atribusi. Di sisi lain, platform komersial kerap menggunakan tanda air besar yang menutupi lilin harga sehingga merusak keterbacaan data teknikal.

4. **Ketiadaan Personal Branding Trader pada Hasil Ekspor**:
   Tangkapan layar saat ini hanya menampilkan brand aplikasi dan metadata instrumen bursa. Trader tidak memiliki fasilitas untuk menyematkan identitas personal mereka—seperti foto profil/avatar, nama pengguna, dan tautan handle media sosial—secara rapi dan proporsional di bilah atribusi.

5. **Keterbatasan Kustomisasi Latar Belakang Grafik**:
   Warna latar belakang kanvas grafik terkunci permanen pada warna bawaan Theme Preset yang aktif (misalnya `#0F0F0F` untuk tema Signature). Pengguna tidak memiliki opsi mudah untuk menyesuaikan latar belakang kanvas—baik warna solid kustom maupun gradien vertikal modern—langsung dari menu pengaturan tema tanpa menyentuh setelan internal engine grafik.

6. **Inkonsistensi Tema pada Kartu Tesis Rencana Perdagangan (Floating Thesis Card)**:
   Komponen kartu tesis rencana trading (`FloatingThesisCard`) serta perender overlay kanvas tangkapan layarnya menggunakan palet warna biru slate gelap yang terkunci kaku (*hardcoded* `rgba(13, 20, 36, ...)`). Hal ini membuat kartu tesis tampak terisolasi dan tidak selaras ketika pengguna berganti tema ke Signature (Cyber-Monochrome), Bitunix, Binance, atau TradingView.

---

## Solution

Menghadirkan penyempurnaan komprehensif pada subsistem tangkapan layar, sistem identitas visual, kustomisasi kanvas, dan harmonisasi tema rencana trading:

1. **Mesin Komposit Multi-Skala Dinamis (1x, 2x, 4x, 6x Multiplier Engine)**:
   - Menyediakan pilihan multiplier resolusi tangkapan layar: `1x (Standar)`, `2x (HiDPI - Bawaan)`, `4x (Ultra HD 4K)`, dan `6x (Super HD / Cetak)`.
   - Menampilkan label estimasi dimensi piksel riil (misal: *"4x · 7680 × 4320 px"*) pada menu dropdown kamera dan modal pratinjau snapshot.
   - Menjalankan proses perakitan komposit beresolusi tinggi secara asinkron dengan status umpan balik visual (*loading indicator*) agar antarmuka pengguna tidak mengalami pembekuan (*UI freezing*).

2. **Integrasi Logo Resmi Aplikasi (`logo.png`)**:
   - Mengganti total gambar monogram vektor `tr` pada `chartSnapshotService` dengan pemuatan citra resmi `logo.png` dari folder aset statis aplikasi melalui mekanisme pra-pemuatan (*preloading/caching*).
   - Memastikan seluruh elemen penjenamaan di seluruh antarmuka secara konsisten merujuk pada aset resmi aplikasi.

3. **Trader Profile Attribution (Lokal & Offline-First)**:
   - Menyediakan skema data profil pengguna lokal pada `appSettings`: foto avatar (format base64), nama pengguna (*username*), dan deskripsi singkat/handle media sosial.
   - Menata identitas trader secara elegan di sisi kiri Attribution Bar berdampingan dengan logo resmi aplikasi:
     `[logo.png trawangan]` + `[Avatar Profil]` + **`Username`** (`@handle`) · `[SIMBOL · TF · BURSA]`.
   - Menyediakan avatar cadangan (*fallback*) berupa lingkaran berlatar aksen tema dengan inisial huruf pertama nama pengguna ketika foto belum diunggah.

4. **Security Watermark Kanvas Semi-Transparan**:
   - Membangun layer tanda air proteksi yang dirender melintang diagonal (kemiringan 35°) di area tengah kanvas grafik, tepat di bawah candlestick dan garis indikator.
   - Teks tanda air otomatis memuat `Username · Handle` (atau teks kustom yang dapat ditentukan pengguna), dengan slider opasitas halus (rentang 5%–30%, default 10%) agar terbaca jelas oleh pembajak tanpa mengaburkan analisis harga.
   - Secara bawaan, tanda air hanya aktif pada hasil ekspor gambar tangkapan layar, dengan opsi toggle *"Tampilkan di Kanvas Kerja"* bagi pengguna yang membutuhkan proteksi visual saat sesi siaran langsung (*live streaming*).

5. **Kustomisasi Latar Belakang Kanvas (Solid & Gradien Vertikal)**:
   - Menghadirkan pengaturan latar belakang kanvas terpadu pada menu *Pengaturan -> Tema & Tipografi*:
     - *Bawaan Tema*: Menggunakan warna latar asli dari preset tema yang aktif.
     - *Warna Solid*: Kustomisasi warna tunggal melalui color picker.
     - *Gradien Vertikal*: Dua pilihan warna (atas dan bawah) yang dirender mulus pada kanvas WebGL2 dan komposit snapshot 2D (`createLinearGradient`).
   - Menyediakan tombol pemulihan instan (*Reset ke Bawaan Tema*).

6. **Harmonisasi Tema Kartu Tesis Rencana Trading**:
   - Merefaktor `FloatingThesisCard.svelte` dan `chartSnapshotOverlayService.ts` agar secara reaktif mengonsumsi token palet tema aktif (`tokens.bgSecondary`, `tokens.borderSubtle`, `tokens.textPrimary`, `tokens.textMuted`) dengan gaya *translucent glassmorphism*.
   - Menyelaraskan aksen warna bias Bullish dan Bearish dengan konfigurasi candlestick tema aktif (Signature hot pink/putih, Classic hijau/merah).

7. **Tab Pengaturan Terpadu "Profil & Watermark"**:
   - Menyediakan tab navigasi khusus pada jendela *Settings Modal* untuk memusatkan formulir identitas profil trader, konfigurasi tanda air keamanan, dan preferensi bawaan tangkapan layar.

---

## User Stories

1. As a cryptocurrency analyst sharing setups on social media, I want to export chart snapshots at 4x (Ultra HD) or 6x (Super HD), so that my charts retain razor-sharp line clarity and legibility when displayed on 4K monitors or retina screens.
2. As a trader using the quick screenshot shortcut (`Ctrl+Shift+S`), I want the export to respect my preferred resolution multiplier (e.g., 2x or 4x), so that I don't have to reconfigure settings every time I take a quick snap.
3. As a user opening the camera dropdown menu in the top header, I want to see a resolution selector (1x, 2x, 4x, 6x) with estimated pixel dimensions (e.g., "7680 × 4320 px"), so that I can choose the right balance between image detail and file size.
4. As a user generating a heavy 6x snapshot, I want a visual loading indicator while the canvas composites, so that I know the system is actively processing the high-resolution image and has not frozen.
5. As a trader, I want the official `logo.png` application graphic to appear on the attribution bar instead of an outdated manual `tr` monogram, so that the branding on shared charts matches the genuine application identity.
6. As a privacy-conscious user, I want my trader profile (avatar image, username, social handle) to be stored 100% locally on my machine in `appSettings`, so that none of my personal data is sent to external cloud servers.
7. As a content creator, I want to upload a custom profile picture (avatar) in the settings, so that my personal photo appears on every chart snapshot I produce.
8. As a user who hasn't uploaded a profile photo yet, I want the snapshot attribution bar to display an elegant circular avatar badge with my first initial, so that the layout looks clean and complete even without a photo.
9. As a trader with a public persona, I want my username and social handle (e.g., `@crypto_trader`) to be prominently placed beside the official logo on the snapshot attribution footer, so that viewers instantly recognize my authorship.
10. As an analyst publishing exclusive research, I want a semi-transparent security watermark rendered diagonally across the center of the chart area, so that others cannot crop or steal my analysis and claim it as their own.
11. As a technical trader, I want the security watermark text to render strictly behind the candlesticks and indicator plots, so that my price action, trendlines, and candle wicks remain 100% visible and uncluttered.
12. As a user configuring the watermark, I want a slider to adjust watermark opacity between 5% and 30% (with a 10% default), so that I can fine-tune its subtlety according to my theme contrast.
13. As a trader who prefers a distraction-free daily workspace, I want the security watermark to apply only to exported screenshots by default, so that my live charting canvas stays clean while I work.
14. As a live-streaming educator or YouTuber, I want a toggle option to "Show Watermark on Active Canvas", so that my live video broadcast is continuously protected against unauthorized screen recording.
15. As a user customizing my watermark, I want the watermark text to automatically default to my `Username · Handle`, while also offering an optional custom text field, so that I have full control over the displayed protection text.
16. As an aesthetic trader, I want to customize my chart canvas background directly from the "Tema & Tipografi" settings tab, so that I can tailor the visual mood without navigating complex engine menus.
17. As a user customizing my background, I want to choose between "Theme Default", "Solid Color", and "Vertical Gradient", so that I can create immersive dark backgrounds.
18. As a user selecting "Vertical Gradient", I want two independent color pickers for the top and bottom colors, so that I can create smooth vertical ambient gradients for my charts.
19. As a user experimenting with background colors, I want a "Reset ke Bawaan Tema" button, so that I can immediately restore the original theme preset background if I don't like my custom colors.
20. As a user exporting a chart with a custom background, I want the snapshot compositor to replicate the exact solid or gradient background on the exported PNG, so that the shared image looks identical to my screen.
21. As a user of the Signature Theme (Cyber-Monochrome), I want the Floating Thesis Card overlay to reflect my theme's dark background and hot pink accents, so that trading plan cards don't stick out with an unrelated blue slate color.
22. As a user of Binance or TradingView theme presets, I want the Floating Thesis Card and its snapshot canvas overlay to automatically adopt the active theme's surface color, border color, and text colors, so that visual hierarchy is maintained across the app.
23. As a user importing trading plans, I want the thesis card background to feature modern translucent glassmorphism with backdrop blur, so that the chart candles underneath remain subtly visible while the card text is easily readable.
24. As a settings user, I want a dedicated "Profil & Watermark" tab in the Settings Modal navigation sidebar, so that my identity settings, watermark controls, and screenshot defaults are grouped intuitively in one place.
25. As a user choosing "Clean Chart" export mode, I want the outer branded frame removed while still having the security watermark applied to the chart canvas if enabled, so that my bare chart is still protected.
26. As an active trader using different screen sizes, I want all profile avatar rendering, watermark text rendering, and high-resolution compositing to scale proportionally across 1x, 2x, 4x, and 6x, so that fonts and badges never appear pixelated or misaligned.

---

## Implementation Decisions

### 1. Skema Pengaturan Baru pada `AppSettings`
Menambahkan definisi tipe dan nilai bawaan pada antarmuka pengaturan aplikasi:

```typescript
export type SnapshotScaleMultiplier = 1 | 2 | 4 | 6;

export interface UserProfileConfig {
  username: string;
  handle: string;
  avatarDataUrl?: string; // Format base64 data URL
}

export interface SecurityWatermarkConfig {
  enabled: boolean;
  text?: string; // Teks kustom; jika kosong, fallback ke `${username} · ${handle}`
  opacity: number; // Rentang 0.05 s.d. 0.30, bawaan: 0.10
  showOnLiveCanvas: boolean; // Bawaan: false
}

export interface CustomChartBackgroundConfig {
  mode: 'theme' | 'solid' | 'gradient';
  solidColor?: string;
  gradientTop?: string;
  gradientBottom?: string;
}
```

Nilai bawaan pada `defaultSettings`:
- `snapshotScaleMultiplier`: `2`
- `userProfile`: `{ username: '', handle: '', avatarDataUrl: undefined }`
- `securityWatermark`: `{ enabled: false, text: '', opacity: 0.10, showOnLiveCanvas: false }`
- `customChartBackground`: `{ mode: 'theme', solidColor: '#0F0F0F', gradientTop: '#0F0F0F', gradientBottom: '#181A20' }`

### 2. Multi-Skala Resolusi & Pemrosesan Citra Asinkron (`chartSnapshotService.ts`)
- Memperluas antarmuka `SnapshotOptions` untuk menerima `scaleMultiplier: SnapshotScaleMultiplier`, `userProfile: UserProfileConfig`, `watermark: SecurityWatermarkConfig`, dan `background: CustomChartBackgroundConfig`.
- Mengimplementasikan loader citra lokal asinkron (`preloadImage(src: string): Promise<HTMLImageElement>`) dengan memori cache internal untuk aset `/static/logo.png` dan `avatarDataUrl`.
- Menghitung resolusi keluaran kanvas secara proporsional:
  `dimensi = ukuranLogis * skalaDPR * scaleMultiplier`.
- Mengeliminasi kode monogram vektor `tr` dan menggantikannya dengan rendering citra `logo.png` yang telah di-cache.

### 3. Rendering Security Watermark pada Kanvas 2D
- Fungsi perender watermark diagonal:
  - Menyimpan status konteks (`ctx.save()`).
  - Mengatur translasi ke titik tengah area kanvas grafik (`centerX`, `centerY`).
  - Menerapkan rotasi sudut -30° s.d. -35° (`ctx.rotate(-0.55)`).
  - Mengatur transparansi global (`ctx.globalAlpha = watermark.opacity`).
  - Menggambar teks watermark dengan font tebal (`JetBrains Mono` / `Plus Jakarta Sans`) dan warna kontras cerah (`#FFFFFF`).
  - Mengembalikan status konteks (`ctx.restore()`).
- Urutan rendering komposit snapshot:
  1. Background kanvas (Solid atau Gradien).
  2. Lapisan grafik sumber (WebGL2 canvas).
  3. Lapisan Security Watermark (jika aktif).
  4. Lapisan Thesis Overlay & Price Badges.
  5. Lapisan Bingkai Luar & Attribution Bar (pada mode Branded Frame).

### 4. Attribution Bar dengan Profil Pengguna
- Sisi kiri Attribution Bar:
  - Posisi 1: Citra logo resmi `/static/logo.png` (ukuran proporsional ~26px * scale).
  - Posisi 2: Avatar pengguna (jika ada citra avatar, dirender dengan klip lingkaran; jika kosong, render lingkaran latar aksen tema dengan inisial huruf pertama username).
  - Posisi 3: Teks `username` (tebal putih) dan `handle` (abu-abu redup).
  - Posisi 4: Titik pemisah redup `·`.
  - Posisi 5: Badge instrumen (`SIMBOL · TF · BURSA`).
- Jika profil kosong (`username` kosong), tata letak otomatis kembali ke penjenamaan standar `trawangan` tanpa kekosongan spasi.

### 5. Mesin Kustomisasi Latar Belakang Kanvas (`AppearanceTab.svelte` & Controller)
- Menambahkan kartu kontrol latar belakang kanvas pada `AppearanceTab.svelte`:
  - Radio pilihan mode: *Bawaan Tema*, *Warna Solid*, *Gradien Vertikal*.
  - Input picker interaktif dengan pratinjau warna langsung (*live preview*).
  - Tombol pemulihan (*Reset ke Bawaan Tema*).
- Pada `chartSessionController.ts`:
  - Mengaplikasikan background terpilih ke kontainer pembungkus kanvas (`wrapper.style.background`).
  - Jika mode *Gradien Vertikal*, menginjeksikan CSS `linear-gradient(180deg, topColor, bottomColor)`.
  - Pada komposit snapshot kanvas 2D, membuat `ctx.createLinearGradient(0, chartY, 0, chartY + chartHeight)` agar gradien terisi mulus.

### 6. Penyelarasan Tema Kartu Tesis (`FloatingThesisCard` & Snapshot Overlay)
- Pada `FloatingThesisCard.svelte`:
  - Mengganti latar belakang hardcoded `rgba(13, 20, 36, 0.92)` dengan variabel CSS dinamis `var(--bg-secondary, rgba(20, 24, 35, 0.92))`.
  - Menyambungkan border kartu dengan `var(--border-subtle)` atau aksen tema aktif.
- Pada `chartSnapshotOverlayService.ts`:
  - Mengambil token tema aktif dari parameter konfigurasi snapshot.
  - Mengganti warna isian latar kanvas dengan warna tema sekunder (`themeConfig.tokens.bgSecondary`).
  - Mengganti warna tipografi judul dan teks dengan token tema aktif (`tokens.textPrimary`, `tokens.textMuted`).

### 7. Tab Baru "Profil & Watermark" di `SettingsModal.svelte`
- Membuat komponen Svelte baru: `src/lib/components/settings/ProfileTab.svelte`.
- Mendaftarkan tab pada daftar navigasi samping `SettingsModal.svelte`:
  - ID Tab: `'profile'`
  - Label: `'Profil & Watermark'`
  - Ikon: Ikon User Shield / Badge SVG.
- Isi Tab:
  - Seksi 1: Identitas Trader (Unggah foto profil dengan input berkas gambar lokal -> konversi base64, input nama pengguna, input handle medsos).
  - Seksi 2: Watermark Keamanan (Toggle aktifkan, input teks kustom, slider opasitas 5%–30%, toggle tampil di kanvas kerja).
  - Seksi 3: Preferensi Tangkapan Layar (Multiplier skala bawaan 1x–6x, toggle bingkai bawaan, toggle harga/waktu bawaan).

---

## Testing Decisions

### 1. Kriteria Pengujian yang Baik
- Pengujian berfokus murni pada perilaku eksternal yang dapat diamati (*black-box observable behavior*), bukan pada detail manipulasi DOM internal atau pemanggilan fungsi privat.
- Pengujian memverifikasi keutuhan dan proporsionalitas dimensi kanvas komposit pada setiap tingkat multiplier (1x, 2x, 4x, 6x).
- Pengujian memvalidasi bahwa data profil (avatar, username, handle) dan watermark keamanan tercermin dengan benar pada pemanggilan API kanvas 2D.
- Pengujian memverifikasi persistensi dan pemulihan konfigurasi profil, watermark, dan latar belakang kanvas melalui `appSettings`.
- Pengujian memastikan tidak ada regresi pada mode ekspor *Clean Chart* maupun penangkapan *Multi-Chart Grid*.

### 2. Modul yang Diuji
- **`chartSnapshotService`**: Pengujian komposit resolusi multi-skala, integrasi logo citra resmi, rendering profil attribution bar, watermark diagonal, dan latar belakang solid/gradien.
- **`chartSnapshotOverlayService`**: Pengujian adaptasi warna kartu tesis terhadap konfigurasi preset tema yang berbeda.
- **`persistence` & `appSettings`**: Pengujian skema data baru, nilai bawaan, dan serialisasi penyimpanan lokal.
- **`SettingsModal` / `ProfileTab`**: Pengujian integrasi navigasi tab baru dan interaksi pembaruan profil serta watermark.

### 3. Prior Art Pengujian di Repositori
- `tests/chartSnapshotService.test.ts`: Pengujian unit dan integrasi komposit kanvas 2D, tata letak dimensi, dan penanganan fallback lingkungan non-browser.
- `tests/snapshotPreviewModalAndPersistence.test.ts`: Pengujian persistensi preferensi ekspor dan reaktivitas modal pratinjau.
- `tests/tradingPlanSnapshotAndPersistence.test.ts`: Pengujian rendering overlay kartu rencana trading pada kanvas snapshot.
- `tests/themes.test.ts` & `tests/chartThemeCandleSync.test.ts`: Pengujian sinkronisasi token tema dan warna candlestick.

---

## Out of Scope

- Sinkronisasi data profil pengguna ke server awan (cloud sync / remote account login) — tetap mempertahankan prinsip 100% lokal & privat.
- Deteksi otomatis atau penghapusan watermark berbasis kecerdasan buatan (*AI-powered watermark detector/remover*).
- Fitur perekaman video kanvas grafik atau ekspor format animasi GIF.
- Eksekusi order perdagangan atau integrasi akun broker/bursa (tetap mematuhi filosofi *Pure Charting Scope*).

---

## Further Notes

- Kepatuhan penuh terhadap standar terminologi domain `GLOSSARY.md` (`Branded Snapshot Frame`, `Attribution Bar`, `Trader Profile Attribution`, `Security Watermark`, `Custom Canvas Background`, dan `Themed Thesis Overlay`).
- Dokumentasi arsitektur telah dicatat pada `docs/adr/0015-trader-profile-security-watermark-and-custom-canvas-background.md`.
- Seluruh komentar kode dan antarmuka teks disusun menggunakan Bahasa Indonesia yang lugas dan jelas sesuai aturan global repositori.
