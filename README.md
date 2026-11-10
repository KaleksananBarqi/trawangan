<p align="center">
  <img src="static/banner.png" alt="trawangan banner" width="100%">
</p>

# ꦠꦿꦮꦔꦤ꧀ · trawangan

> **Professional Desktop Multi-Asset & Crypto Charting Terminal: Zero Paywall**  
> Ditenagai oleh **Tauri v2 (Rust Core)**, **Svelte 5 (Runes)**, **LuxAlgo Vela (WebGL2 Engine 120 FPS)**, dan **PineTS v6**.

<p align="center">
  <a href="https://github.com/KaleksananBarqi/trawangan/releases/latest"><img src="https://img.shields.io/badge/Release-v0.42.0-FF69B4?style=flat-square&logo=github&logoColor=white" alt="Latest Version"></a>
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2.0-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri v2"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-Core-dea584?style=flat-square&logo=rust&logoColor=white" alt="Rust Core"></a>
  <a href="https://svelte.dev/"><img src="https://img.shields.io/badge/Svelte-5_Runes-FF3E00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte 5"></a>
  <a href="https://www.khronos.org/webgl/"><img src="https://img.shields.io/badge/WebGL2-120_FPS-990000?style=flat-square&logo=webgl&logoColor=white" alt="WebGL2"></a>
  <img src="https://img.shields.io/badge/Scope-Pure_Charting-FF69B4?style=flat-square" alt="Pure Charting Scope">
  <img src="https://img.shields.io/badge/Price-Zero_Paywall-brightgreen?style=flat-square" alt="Zero Paywall">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  🌐 <strong>Landing Page Resmi:</strong> <a href="https://kaleksananbarqi.github.io/trawangan/">https://kaleksananbarqi.github.io/trawangan/</a>
</p>

---

## 🔮 Filosofi & Makna Mendalam

Diambil dari etimologi bahasa Jawa **penerawangan** (ꦠꦿꦮꦔꦤ꧀: *kemampuan batiniah untuk melihat menembus kabut manipulasi, ilusi kasat mata, dan kekacauan duniawi*).

Di tengah ekosistem pasar modern yang bising dan sarat distorsi likuidasi, di mana pergerakan harga acap kali dimanipulasi dan platform charting komersial mengunci alat analisis dasar di balik biaya langganan bulanan, **trawangan** dirancang untuk mengembalikan kedaulatan visual kepada trader. Memberikan visualisasi data yang objektif, presisi tinggi, dan tajam tanpa batasan *paywall*, baik untuk pasar kripto maupun instrumen lintas aset (saham IDX, komoditas logam mulia riil USD, dan indeks AS).

> [!IMPORTANT]
> **Batasan Ruang Lingkup (Pure Charting Scope):**  
> `trawangan` berfokus murni pada visualisasi charting grafis performa tinggi, orderflow, indikator teknikal kustom, manajemen rencana trading, dan pengujian strategi Pine Script v6. Aplikasi ini **secara sengaja tidak menyediakan fitur eksekusi order trading langsung** maupun integrasi dompet/brokerage/sekuritas modal nyata demi menjaga kemurnian analisis tanpa distraksi psikologis eksekusi.

---

## ⚖️ Komparasi Fitur: Zero-Paywall Parity

Mengapa harus membayar langganan bulanan mahal hanya untuk memasang indikator, menggambar setup, dan menguji strategi?

| Fitur / Kapabilitas | `trawangan` (Desktop Native) | Platform Komersial Gratis (TradingView dkk) |
| :--- | :---: | :---: |
| **Indikator Simultan** | **Tanpa Batas (Unlimited)** | Terbatas (Maksimal 2 - 3 indikator) |
| **Tools Gambar Teknikal** | **76+ Varian Lengkap + Multi-Pane Gesture Inking** | Dibatasi / Berbayar |
| **Gesture Drawing Engine** | **Natural Inking (`Shift+D` / `~`), Scribble Erase** | Tidak Tersedia |
| **Multi-Chart Grid Layout** | **Bebas Penuh (1, 2, 2H, 4 Sel Sinkron)** | Terkunci di tier Pro/Premium ($14.95 - $59.95/bln) |
| **Kapasitas Watchlist** | **Multi-Watchlist Registry + Section Dividers (Tanpa Kuota)** | Dibatasi kuota ketat (maks. 30 simbol) |
| **Eksekusi Pine Script v6** | **Penuh (PineTS Web Worker Lokal)** | Dibatasi server rate-limit & paywall |
| **Manajemen Trading Plan** | **Tab Persisten `Plan` Panel Kanan (Form, Markdown 2-Arah, Vault), Dual-Entry (E1/E2), & Edit In-Place** | Wajib input posisi manual satu per satu |
| **Kalkulasi R & Zona Konteks** | **Auto R-Multiple (`+R` / `-1.00R`), Entry Zone Box, & POI Context Zones Transparan** | Kalkulasi manual / statis |
| **Ekspor Tangkapan Layar** | **Ultra HD hingga 6x (~11.5K) + Dedicated Thesis Side Panel** | Resolusi standar / Terbatas |
| **Atribusi & Watermark** | **Profil Trader Offline & Anti-Theft Watermark** | Terkunci / Watermark platform bawaan |
| **Sistem Tema & Palet** | **37 Preset Resmi (31 Tema Jawa + Warta Abang), Dual-Theme Decoupling, Studio 9D, & Kontras WCAG AA** | Terbatas pada tema bawaan gelap/terang |
| **Background Alert Engine** | **Multi-Aset Latar Belakang + Audio Chime + Auto-Alerts Terikat Plan** | Dibatasi kuota ketat (maks. 5 alert) |
| **Pintasan Institusional** | **Lengkap (`Ctrl+Shift+P`, `Ctrl+Enter`, `Alt+O`, `Ctrl+D`, `Alt+Z`, `Ctrl+Del`, `Shift+R`)** | Terbatas |
| **Cakupan Pasar & Data Feed** | **Kripto (Binance, Indodax IDR, Bitunix, Hyperliquid, Coinbase) + Saham IDX, Emas/Perak USD, Indeks AS (Yahoo Finance) + Custom Node** | Sering tertunda / dibatasi / berbayar |
| **Resiliensi Data Stream** | **Deep Stream Health Guard (Watchdog 30s, Verifikasi Tail REST, Auto-Reconnect)** | Bergantung koneksi tab browser |
| **Penyimpanan & Privasi** | **100% Offline Lokal (SQLite Rust `rusqlite`) + Isolasi Gambar per Workspace** | Pelacak cloud, telemetri, & iklan |
| **Beban Memori (RAM)** | **Ultra-Ringan (~30-50 MB Tauri v2)** | Boros RAM (500 MB - 1.5 GB Electron) |
| **Biaya Langganan** | **Rp 0 / $0 Selamanya (Lisensi MIT)** | $179 - $719 / tahun |

---

## 🚀 Kapabilitas Utama Terminal (v0.16 - v0.42)

### 1. 🎨 37 Preset Tema Jawa, Warta Abang, & Kontras Adaptif WCAG AA (v0.42.0, ADR-0022)
- **Koleksi 37 Preset Resmi (18 Gelap & 19 Terang):** Menggabungkan 5 preset klasik (`Signature`, `Binance Classic`, `Bitunix Neon`, `TradingView Pro`, `Coinglass Dark`), evolusi **Warta Abang** (`red_folder` dengan skema kertas hangat `#EAEAE5` & burgundy `#4E1112`), serta **31 preset baru bernuansa budaya Jawa** seperti `Ngrembaka`, `Kopi Tubruk`, `Samodra Wengi`, `Lembayung Awan`, `Ayem Tentrem`, `Surya Baskara`, hingga `Wates Dhuwur`.
- **Token Kontras Adaptif WCAG 2.1 AA (`>= 4.5:1`):** Menurunkan warna tinta tombol/lencana (`--on-brand-primary`, `--on-bull-color`, `--on-bear-color`) secara matematis via rasio kontras WCAG 2.1 serta `--bull-text` adaptif agar seluruh label untung dan tombol aksi tetap tajam di tema terang pastel maupun gelap pekat.
- **Pencarian Cepat Galeri Tema:** Bilah filter instan di *Appearance Settings* berdasarkan nama, deskripsi, atau ID tema, lengkap dengan kontras tepi pada pratinjau swatch warna.

### 2. 📋 Tab Persisten `Plan` Panel Kanan & Edit Form 2-Arah (v0.37 – v0.42.0, ADR-0014 / ADR-0019 / ADR-0020)
- **Satu Pintu di Panel Kanan (`Ctrl + Shift + P` / `Ctrl + V`):** Alur pembuatan, penyuntingan, dan arsip rencana trading kini terpusat di **Tab `Plan`** pada *Right Dock* dengan 3 sub-mode persisten: **Form Terstruktur**, **Teks Markdown 2-Arah (Lossless)**, dan **Riwayat (Trade Plan Vault)**.
- **Edit In-Place Atomik & Dirty Guard:** Sunting setup aktif langsung dari tombol Edit di tab `Layers` atau `FloatingThesisCard` tanpa menggandakan gambar, lengkap dengan deteksi perubahan level di kanvas (*"Level di chart berubah"*), penguncian simbol *read-only*, resizer lebar panel adaptif (`360px` / `300px`), dan eksekusi cepat `Ctrl + Enter`.
- **Dual-Entry (E1/E2 + Blended Entry) & Entry Zone Box:** Mendukung strategi Anti-Front-Run dengan dua level entri berbobot (`E1` Agresif & `E2` Moderat), kalkulasi otomatis *Blended Entry*, proyeksi kotak *Entry Zone*, R-multiple multi-acuan, persentase risiko, dan skor konfluensi.
- **POI-Only Context Zones & Plan-Linked Auto-Alerts:** Mengekstrak zona FVG, Order Block, IDM, Demand, dan Supply secara otomatis dengan kotak transparan 100%, label teks di tengah kanvas, polaritas warna mandiri (`bull`/`bear`/`neutral`), serta pendaftaran **Auto-Alerts** untuk Entry/E1/E2, Stop Loss, dan seluruh target TP1..TPn yang ikut bersih saat rencana dihapus.

### 3. 🌍 Data Feed Multi-Aset Gratis & Dynamic Feeder Context (v0.40.0, ADR-0021)
- **Cakupan Lintas Aset Tanpa API Key:** Mendukung charting gratis untuk **Saham Indonesia / IDX** (`BBCA.JK`, `BBRI.JK`, `TLKM.JK`, `^JKSE`), **Logam Mulia Riil USD** (`GC=F` Emas COMEX, `SI=F` Perak COMEX), serta **Indeks & ETF AS** (`^IXIC` Nasdaq, `^NDX`, `^GSPC`, `QQQ`) melalui Yahoo Finance Provider.
- **Dynamic Feeder Routing & Symbol Aliasing:** Provider aktif berpindah otomatis mengikuti simbol yang dibuka tanpa pengaturan manual, didukung pencarian alias cerdas (`GOLD` / `XAUUSD` -> `GC=F`, `NASDAQ` -> `^IXIC`, `BBCA` -> `BBCA.JK`), kategori aset, dan filter mata uang `USD ($)`.
- **Client-Side Candle Resampling & Guard Jam Bursa:** Membentuk lilin `2H` dan `4H` secara otomatis dari data basis `1H`, menampilkan lencana `DELAYED 15M` secara transparan, serta membatasi polling berkala hanya pada jam perdagangan bursa aktif.

### 4. 🛡️ Deep Stream Health Guard & Paritas Multi-Bursa (v0.41.0)
- **Deep Stream Health Guard (`streamHealthGuard.ts`):** Membungkus seluruh `DataProvider` WebGL2 dengan watchdog stream diam (30 detik), verifikasi ulang tail candle REST untuk membedakan pair sepi likuiditas dari koneksi putus, serta pemulihan otomatis saat jaringan OS kembali aktif atau tombol **Coba Ulang** ditekan.
- **Paritas Penuh 6+ Sumber Data:** Mendukung **Binance** (Spot & Futures `.P`), **Indodax** (IDR asli), **Bitunix** (WebSocket publik & sintesis *forming candle*), **Hyperliquid** (Perp & Spot), **Coinbase**, **Yahoo Finance**, serta **Custom Node REST/WebSocket** dengan *hot-reload*.

### 5. 🎨 Dual-Theme Decoupling, Chart Mode Memory & Tipografi (v0.31 – v0.36, ADR-0016 s.d. ADR-0019)
- **Pemisahan & Memori Tema per Mode:** Atur tema aplikasi (`appThemePreset`) dan tema kanvas chart (`chartThemePreset`) secara terpisah, disertai memori independen untuk mode gelap (`activeDarkChartPreset`) dan terang (`activeLightChartPreset`), tombol cepat Header (*Moon, Sun, Monitor*), serta *System Theme Bridge*.
- **Studio Preset 9D, Live Preview & In-Place Editing:** Kustomisasi 6 elemen lilin dan 3 warna bidang utama, simpan sebagai preset `[CUSTOM]`, edit warna langsung (*in-place*), *fork* aman dari tema resmi, serta ekspor/impor JSON maupun clipboard.
- **Tipografi & Kontrol Grid WebGL:** Tab khusus pengaturan font UI (`Plus Jakarta Sans`, `Inter`, `Roboto`, `System`), font data monospace (`JetBrains Mono`, `Fira Code`, `Consolas`), kepadatan layar, skala monitor, serta selector garis grid 3-mode (*Normal*, *Redup*, *Sembunyi*).

### 6. 📸 Side-by-Side Snapshot Ultra HD, Profil Trader & Watermark Anti-Maling (v0.26 – v0.34, ADR-0012 / ADR-0015)
- **Kompositor hingga 6x Super HD (~11520x6480):** Ekspor tangkapan layar tajam dalam mode *Side-by-Side* dengan **Dedicated 2D Thesis Side Panel** (~380px) yang memuat bias, harga entri, blok epistemik (`[FAKTA]`, `[INFERENSI]`, `[SPEKULASI]`), SL (`-1.00R`), dan target `+R` tanpa menutupi lilin harga.
- **Atribusi Offline & Watermark Keamanan:** Attribution Bar adaptif terhadap luminansi latar (termasuk tema terang seperti *Warta Abang*), avatar Base64 lokal, handle sosial media, dan watermark diagonal (-32°).

### 7. 🎯 Kalkulasi R Dinamis, Workspace-Scoped Persistence & Auto-Save Guard (v0.27 – v0.39)
- **Dynamic R-Multiple Price Scale Badges:** Menghitung rasio risk/reward langsung dari koordinat anchor (`TP1 +X.XXR`, `SL -1.00R`) dengan sinkronisasi dua arah saat posisi digeser di kanvas.
- **Isolasi & Ketahanan State Workspace:** Penyimpanan gambar terisolasi per `[workspaceId:providerId:symbol]`, pipeline pemuatan workspace deterministik (`workspaceLifecycle.ts`), dan *Auto-Save Fingerprint Guard* 15 dimensi (debounce 3.5s) yang mencegah race-condition I/O SQLite.

### 8. ✍️ Multi-Pane Gesture Engine & Suite Pintasan Institusional (v0.25 – v0.40, ADR-0013)
- **Draw by Holding (`Shift + D` / `~`) Lintas Pane:** Goreskan *Trend Line*, *Horizontal Ray*, *Vertical Line*, *Rectangle*, *Ellipse*, *Fib Retracement*, *Arrow*, atau *Path* baik di pane harga utama maupun sub-pane indikator (Volume & Osilator), ditambah *Scribble to Erase* dan Undo/Redo atomik (`Ctrl + Z`).
- **Navigasi & Produktivitas Cepat:** `Alt + O` (Tab Layers/Object Tree), `Ctrl + D` (Duplikasi objek gambar adaptif), `Alt + K`/`Alt + L` (Bulk Hide/Lock), `Ctrl + Delete` (Clear All), `Alt + Z`/`F` (Auto-Fit), `Alt + I` (Invert Scale), `Shift + R` (Bar Replay).

### 9. 🔔 Background Alert Engine & Jam Sesi Pasar Dunia (v0.21 – v0.39)
- **Evaluasi Alert Latar Belakang:** Memantau level harga seluruh simbol alert di latar belakang tanpa harus membuka grafiknya, memicu notifikasi desktop native serta Audio Chime sintetis.
- **World Market Session Clocks:** Pemantau sesi global Tokyo, London, New York, WIB/Jakarta, dan UTC di StatusBar beserta hybrid symbol logo engine.

---

## 📸 Galeri Tampilan Antarmuka

### 1. Terminal Charting Utama & Vela WebGL2 Engine (120 FPS)
Rendering candlestick mulus hingga 120 FPS dengan akselerasi hardware penuh, orderflow real-time, mode navigasi geser Hand-Pull (<kbd>H</kbd>), penghapus interaktif 1-klik, dan panel status responsif.

<p align="center">
  <img src="docs/assets/screenshots/main.png" alt="Terminal Charting Utama trawangan" width="95%">
</p>

### 2. Side-by-Side Pine Script v6 Editor & Web Worker Scripting
Tulis, edit, dan kompilasi skrip PineTS v6 secara mandiri berdampingan dengan grafik menggunakan editor modern CodeMirror 6 tanpa membebani UI thread utama.

<p align="center">
  <img src="docs/assets/screenshots/pine-editor.png" alt="Pine Script Editor trawangan" width="95%">
</p>

### 3. Pengaturan Terminal, Audio Chime Alerts & Multi-Provider Data Feed
Kustomisasi zona waktu chart reaktif (WIB/Jakarta, UTC), nada alert kristal sintetis Audio Chime, notifikasi native desktop, manajemen data feed multi-aset dan multi-exchange, serta telemetri hardware WebGL2 real-time.

<p align="center">
  <img src="docs/assets/screenshots/setting.png" alt="Pengaturan Terminal dan Multi-Provider trawangan" width="95%">
</p>

### 4. Preset Multi-Tema WebGL2 & Kustomisasi Candlestick Hibrida
Harmonisasi palet warna tema instan (Signature Cyber-Monochrome `#0F0F0F` + `#FF69B4`, Warta Abang, 31 preset tema Jawa, Binance Classic, Bitunix Neon, TradingView Pro, Coinglass Dark) ke seluruh sel kanvas WebGL2, studio preset pengguna dengan fitur *Save As*, serta integrasi System Theme Bridge.

<p align="center">
  <img src="docs/assets/screenshots/theme-custom.png" alt="Preset Multi-Tema dan Kustomisasi Warna Lilin trawangan" width="95%">
</p>

---

## ⌨️ Cheatsheet Pintasan Keyboard Institusional

Trawangan dirancang dengan orientasi keyboard penuh (*Keyboard-First Workflow*) untuk kecepatan eksekusi analisis tanpa ketergantungan mouse:

| Pintasan Keyboard | Aksi & Fungsi Terminal |
| :--- | :--- |
| <kbd>Shift + D</kbd> atau <kbd>~</kbd> | **Draw by Holding Gesture Inking:** Tahan pintasan dan goreskan mouse untuk menggambar bentuk teknikal pada pane harga maupun sub-pane indikator. |
| <kbd>Ctrl + Shift + P</kbd> | **Buka Tab `Plan` Panel Kanan:** Buka editor Form, Teks Markdown, dan Riwayat Trade Plan Vault di dock kanan. |
| <kbd>Ctrl + Enter</kbd> | **Terapkan / Simpan Trade Plan:** Proyeksikan plan baru atau simpan pembaruan *in-place* saat tab `Plan` aktif. |
| <kbd>Ctrl + V</kbd> (pada Kanvas) | **Smart Canvas Paste:** Tempelkan teks analisis/tabel trading plan untuk langsung membuka sub-mode Teks di tab `Plan`. |
| <kbd>Ctrl + Shift + S</kbd> | **Quick Snapshot Clipboard:** Salin tangkapan layar Ultra HD berbingkai Branded Frame ke clipboard dalam hitungan milidetik. |
| <kbd>Alt + W</kbd> | **Toggle Watchlist:** Buka atau sembunyikan panel daftar pantau di dock kanan. |
| <kbd>Alt + O</kbd> | **Toggle Layers / Object Tree:** Buka/tutup panel hierarki objek gambar dan indikator teknikal. |
| <kbd>Alt + T</kbd> | **Toggle Left Toolbar:** Buka atau sembunyikan bilah alat gambar kiri. |
| <kbd>Alt + E</kbd> | **Toggle Pine Script IDE:** Buka atau tutup editor strategi Pine Script v6 berdampingan dengan chart. |
| <kbd>Ctrl + D</kbd> | **Duplicate Selected Drawing:** Gandakan objek gambar terpilih dengan offset spasial adaptif cerdas (5 tick & 60s). |
| <kbd>Alt + Z</kbd> atau <kbd>F</kbd> | **Auto-Fit Viewport:** Reset dan selaraskan skala harga serta waktu ke seluruh candlestick historis di layar. |
| <kbd>Alt + I</kbd> | **Invert Price Scale:** Balik orientasi sumbu harga vertikal secara terbalik. |
| <kbd>Alt + K</kbd> / <kbd>Alt + L</kbd> | **Bulk Visibility / Lock:** Sembunyikan/tampilkan (`Alt+K`) atau kunci/buka kunci (`Alt+L`) seluruh gambar teknikal di kanvas. |
| <kbd>Ctrl + Delete</kbd> | **Clear All Drawings:** Bersihkan seluruh gambar teknikal pada grafik aktif secara serentak. |
| <kbd>Del</kbd> / <kbd>Backspace</kbd> | **Delete Selected Drawing:** Hapus objek gambar yang sedang aktif/dipilih. |
| <kbd>Ctrl + Z</kbd> / <kbd>Ctrl + Y</kbd> | **Atomic Undo / Redo:** Batalkan atau ulangi aksi manipulasi gambar di kanvas. |
| <kbd>Shift + R</kbd> | **Bar Replay Mode:** Masuk atau keluar mode simulasi lilin historis (`Space` play/pause, `←`/`→` step). |
| <kbd>Ctrl + K</kbd> atau Ketik Huruf | **Type-to-Search Sub-5ms:** Buka pencarian simbol kripto, saham IDX, komoditas, dan indeks AS. |
| Ketik Angka (<kbd>1</kbd>, <kbd>5</kbd>, <kbd>15</kbd>...) | **Timeframe Quick Input Bar:** Buka popover penggantian timeframe grafik secara kilat. |
| <kbd>H</kbd> | **Hand-Pull Navigation:** Beralih antara mode tangan geser grafik dan kursor. |
| <kbd>Space</kbd> / <kbd>Alt + ↑↓</kbd> | **Navigasi Watchlist:** Berpindah cepat ke simbol berikutnya (`Space` / `Alt+↓`) atau sebelumnya (`Shift+Space` / `Alt+↑`). |
| <kbd>/</kbd> atau <kbd>Ctrl + I</kbd> | **Katalog Indikator:** Buka modal katalog indikator teknikal dan strategi. |
| <kbd>Ctrl + ,</kbd> / <kbd>Ctrl + `</kbd> | **Pengaturan / Console Diagnostics:** Buka dialog Pengaturan (`Ctrl+,`) atau laci log diagnostik (``Ctrl+` ``). |
| <kbd>F1</kbd>, <kbd>?</kbd>, <kbd>F11</kbd> | **Cheatsheet & Fullscreen:** Tampilkan daftar seluruh pintasan (`F1`/`?`) atau mode layar penuh (`F11`). |

---

## 🎨 Identitas Visual & Tema Signature

* **Kanvas Background:** `#0F0F0F` (True dark minimalis)
* **Garis Grid:** Redup halus monokrom `rgba(255, 255, 255, 0.05)`
* **Candlestick Bullish:** Serba putih gading `#F7F7F7` (badan, garis batas, dan sumbu)
* **Candlestick Bearish:** Hot pink `#FF69B4` (badan & sumbu) dan `#CC5A7F` (garis batas)
* **Tipografi:** **Plus Jakarta Sans** / **Inter** / **Roboto** untuk UI dan **JetBrains Mono** / **Fira Code** / **Consolas** untuk angka finansial
* **37 Preset Resmi:** Tersedia 18 tema gelap dan 19 tema terang di Pengaturan (`Signature`, `Warta Abang`, 31 preset tema Jawa seperti `Ngrembaka`, `Kopi Tubruk`, `Samodra Wengi`, `Lembayung Awan`, `Ayem Tentrem`, serta `Binance Classic`, `Bitunix Neon`, `TradingView Pro`, `Coinglass Dark`, plus palet kustom 9D tanpa batas).

---

## 🛠️ Tech Stack Modern

- **Desktop Framework:** [Tauri v2](https://v2.tauri.app/) (Rust Core)
- **Frontend Framework:** [Svelte 5](https://svelte.dev/) (Runes) + SvelteKit SPA (adapter-static)
- **Bundler & Tooling:** [Vite](https://vitejs.dev/) + TypeScript
- **Chart Renderer:** [@luxalgo/vela](https://github.com/luxalgo/vela) (WebGL2 120 FPS Engine)
- **Scripting Engine:** [@luxalgo/vela-pinets](https://github.com/luxalgo/vela) + [PineTS](https://github.com/luxalgo/pinets)
- **Code Editor:** [CodeMirror 6](https://codemirror.net/) (Pine Editor dengan Reactive Compartments)
- **Database:** SQLite (Embedded Rust via `rusqlite`)
- **Icons:** [Lucide Svelte](https://lucide.dev/)

---

## 💻 Pengembangan Lokal (Local Development)

### Prasyarat
- [Node.js](https://nodejs.org/) (v20+)
- [Rust & Cargo](https://rustup.rs/) (stable)
- **Windows:** C++ Build Tools & WebView2 (sudah terinstal secara default pada Windows 10/11)
- **Linux:** `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, `libfuse2`
- **macOS:** Xcode Command Line Tools

### Menjalankan Mode Dev
```bash
# 1. Clone repositori
git clone https://github.com/KaleksananBarqi/trawangan.git
cd trawangan

# 2. Install dependensi frontend
npm install

# 3. Jalankan aplikasi desktop dengan hot-reload
npm run tauri dev
```

---

## 📦 Build Release Multi-Platform

### 1. Build Lokal
Untuk membuat installer lokal pada sistem operasi Anda:
```bash
npm run tauri build
```
Output installer (`.exe` NSIS installer & `.msi` di Windows, `.AppImage`, `.deb`, & `.rpm` di Linux, `.dmg` di macOS) akan berada di direktori:
`src-tauri/target/release/bundle/`

### 2. Build Multi-Platform Otomatis (CI/CD via GitHub Actions)
Aplikasi ini sudah dilengkapi dengan GitHub Actions CI/CD matrix workflow (`.github/workflows/release.yml`) untuk mem-build binary release secara otomatis di ketiga platform:

#### Cara Trigger Release Otomatis:
1. **Lewat Git Tag (Direkomendasikan):**
   ```bash
   git tag -a v0.42.0 -m "Release v0.42.0"
   git push origin v0.42.0
   ```
2. **Lewat GitHub CLI:**
   ```bash
   gh workflow run release.yml -f tag=v0.42.0
   ```
3. **Lewat GitHub Actions UI:**
   Buka tab **Actions** di GitHub -> Pilih **release trawangan** -> Klik **Run workflow** -> Masukkan versi tag (contoh `v0.42.0`).

### Hasil Paket Rilis Biner:
- **Windows:** `.exe` (NSIS Setup) & `.msi`
- **Linux:** `.AppImage` (Universal Linux), `.deb` (Debian/Ubuntu), & `.rpm` (Fedora/RHEL)
- **macOS:** `.dmg` & `.app.tar.gz` (Apple Silicon & Intel)

---

## 📚 Keputusan Arsitektur & Spesifikasi (ADR)

Seluruh arsitektur, filosofi, dan pagar pembatas performa Trawangan didokumentasikan dalam Architecture Decision Records (ADR):
- [ADR 0001: Brand Identity, Signature Theme, and Pure Charting Scope](docs/adr/0001-brand-identity-and-theming-system.md)
- [ADR 0002: Distribution Strategy and Self-Contained Landing Page Architecture](docs/adr/0002-distribution-and-landing-page-strategy.md)
- [ADR 0003: Core Architecture and Lightweight Guardrails Specification](docs/adr/0003-core-architecture-and-lightweight-guardrails.md)
- [ADR 0004: Docked Structural Shell and Persistent Side-by-Side Pine IDE](docs/adr/0004-docked-structural-shell-and-side-by-side-ide.md)
- [ADR 0005: Multi-Quote Indodax Integration, Feed Connection Guard, and Deep Workspace Persistence](docs/adr/0005-multi-quote-feed-guard-and-workspace-layout-persistence.md)
- [ADR 0006: Exchange-Aware Drawing Isolation and Multi-Provider Watchlist Architecture](docs/adr/0006-exchange-aware-drawings-and-multi-provider-watchlist.md)
- [ADR 0007: Unified Object Tree and Browser Deep Link Bridge Architecture](docs/adr/0007-unified-object-tree-and-browser-deep-link-bridge.md)
- [ADR 0008: Multi-Watchlist Registry and Section Dividers Architecture](docs/adr/0008-multi-watchlist-registry-and-section-dividers.md)
- [ADR 0009: Dual-Track Volume Architecture and Session VWAP Integration](docs/adr/0009-dual-track-volume-and-session-vwap.md)
- [ADR 0010: OHLC Magnet Snapping, Tick-Aligned Price Guard, and Alert Management Revamp](docs/adr/0010-magnet-snapping-and-alert-management-revamp.md)
- [ADR 0011: Hybrid Symbol Logo and Adaptive Quote Engine](docs/adr/0011-hybrid-symbol-logo-and-adaptive-quote-engine.md)
- [ADR 0012: Offline Branded Snapshot Engine and Attribution Frame](docs/adr/0012-offline-branded-snapshot-engine-and-attribution-frame.md)
- [ADR 0013: Draw by Holding Gesture Engine and Shortcut Revamp](docs/adr/0013-draw-by-holding-gesture-engine-and-shortcut-revamp.md)
- [ADR 0014: Deterministic Trading Plan Ingestion and Multi-Target Positions](docs/adr/0014-deterministic-trading-plan-ingestion-and-multi-target-positions.md)
- [ADR 0015: Trader Profile Attribution, Security Watermark, and Custom Canvas Background](docs/adr/0015-trader-profile-security-watermark-and-custom-canvas-background.md)
- [ADR 0016: Unified Theme Engine, Full Palette Matrix, and Cross-Subsystem Propagation](docs/adr/0016-unified-theme-engine-full-palette-matrix-and-cross-subsystem-propagation.md)
- [ADR 0017: Dual-Theme Decoupling, User Theme Presets, System Bridge, and Background Alert Engine](docs/adr/0017-dual-theme-decoupling-user-theme-presets-and-background-alert-engine.md)
- [ADR 0018: Live Theme Preview, Chart Context Menu Pruning, In-Place Palette Editing, Canvas Watermark Control, and Workspace Auto-Save Guard](docs/adr/0018-live-theme-preview-chart-context-menu-pruning-in-place-palette-editing-and-canvas-watermark-control.md)
- [ADR 0019: Chart Mode Preset Memory, Chart-Dominant Thesis Surface, Trade Plan Vault, and Plan-Linked Auto-Alerts](docs/adr/0019-chart-mode-preset-memory-chart-dominant-thesis-trade-plan-vault-and-auto-alerts.md)
- [ADR 0020: Dual-Entry, Blended Trading Plan Ingestion, and Entry Zone Projection](docs/adr/0020-dual-entry-blended-trading-plan-and-entry-zone-projection.md)
- [ADR 0021: Yahoo Finance Provider, Multi-Asset Support, and Dynamic Feeder Context](docs/adr/0021-yahoo-finance-provider-and-dynamic-feeder-routing.md)
- [ADR 0022: Koleksi Preset Tema Jawa, Evolusi Warta Abang, dan Token Kontras Adaptif WCAG](docs/adr/0022-javanese-theme-preset-collection-and-contrast-tokens.md)

---

## 📄 Lisensi
Didistribusikan di bawah lisensi terbuka **MIT License**. Lihat [LICENSE](LICENSE) untuk detail lengkap.
