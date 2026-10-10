<p align="center">
  <img src="static/banner.png" alt="trawangan banner" width="100%">
</p>

# ꦠꦿꦮꦔꦤ꧀ · trawangan

> **Professional Desktop Crypto Charting Terminal — Zero Paywall**  
> Ditenagai oleh **Tauri v2 (Rust Core)**, **Svelte 5 (Runes)**, **LuxAlgo Vela (WebGL2 Engine)**, dan **PineTS v6**.

<p align="center">
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

Diambil dari etimologi bahasa Jawa **penerawangan** (ꦠꦿꦮꦔꦤ꧀ — *kemampuan batiniah untuk melihat menembus kabut manipulasi, ilusi kasat mata, dan kekacauan duniawi*). 

Di tengah ekosistem pasar kripto modern yang bising dan sarat distorsi likuidasi—di mana pergerakan harga acap kali dimanipulasi dan platform charting komersial mengunci alat analisis dasar di balik biaya langganan bulanan—**trawangan** dirancang untuk mengembalikan kedaulatan visual kepada trader. Memberikan visualisasi data yang objektif, presisi tinggi, dan tajam tanpa batasan *paywall*.

> [!IMPORTANT]
> **Batasan Ruang Lingkup (Pure Charting Scope):**  
> `trawangan` berfokus murni pada visualisasi charting grafis performa tinggi, orderflow, indikator teknikal kustom, dan pengujian strategi Pine Script v6. Aplikasi ini **secara sengaja tidak menyediakan fitur eksekusi order trading langsung** maupun integrasi dompet/brokerage modal nyata demi menjaga kemurnian analisis tanpa distraksi psikologis eksekusi.

---

## ⚖️ Komparasi Fitur: Zero-Paywall Parity

Mengapa harus membayar langganan bulanan mahal hanya untuk memasang indikator dan menguji strategi?

| Fitur / Kapabilitas | `trawangan` (Desktop Native) | Platform Komersial Gratis (TradingView dkk) |
| :--- | :---: | :---: |
| **Indikator Simultan** | **Tanpa Batas (Unlimited)** | Terbatas (Maksimal 2 - 3 indikator) |
| **Kapasitas Watchlist** | **Tanpa Kuota (Unlimited)** | Dibatasi kuota ketat (maks. 30 simbol) |
| **Eksekusi Pine Script v6** | **Penuh (PineTS Web Worker Lokal)** | Dibatasi server rate-limit & paywall |
| **Data Feed Multi-Exchange** | **Real-time WebSocket Langsung** | Sering tertunda (*delayed*) / berbayar |
| **Penyimpanan & Privasi** | **100% Offline Lokal (SQLite)** | Pelacak cloud, telemetri, & iklan |
| **Beban Memori (RAM)** | **Ultra-Ringan (~30-50 MB Tauri)** | Boros RAM (500 MB - 1.5 GB Electron) |
| **Biaya Langganan** | **Rp 0 / $0 Selamanya (MIT)** | $14.95 - $59.95 / bulan |

---

## 📸 Galeri Tampilan Antarmuka

### 1. Terminal Charting Utama & Vela WebGL2 Engine
Rendering candlestick mulus hingga 120 FPS dengan akselerasi hardware penuh, orderflow real-time, dan panel status responsif.

<p align="center">
  <img src="static/screenshots/main.png" alt="Terminal Charting Utama trawangan" width="95%">
</p>

### 2. Pine Script v6 Editor & Web Worker Scripting
Tulis, edit, dan kompilasi script PineTS v6 secara mandiri tanpa membebani UI thread utama.

<p align="center">
  <img src="static/screenshots/pinescript.png" alt="Pine Script Editor trawangan" width="95%">
</p>

### 3. Preset Multi-Tema & Filosofi Sistem
Dukungan *Signature Palette* cyberpunk minimalis (`#0F0F0F` + `#FF69B4`), tema exchange klasik (Binance, TradingView, Bitunix, Coinglass), serta kustomisasi densitas font antarmuka.

<p align="center">
  <img src="static/screenshots/about.png" alt="Preset Multi-Tema dan Modal Tentang trawangan" width="95%">
</p>

---

## 🎨 Identitas Visual & Tema Signature
* **Kanvas Background:** `#0F0F0F` (True dark minimalis)
* **Garis Grid:** Redup halus monokrom `rgba(255, 255, 255, 0.05)`
* **Candlestick Bullish:** Serba putih gading `#F7F7F7` (badan, garis batas, dan sumbu)
* **Candlestick Bearish:** Hot pink `#FF69B4` (badan & sumbu) dan `#CC5A7F` (garis batas)
* **Brand Monogram:** `tr` hot pink dengan tipografi utama **Plus Jakarta Sans Extra Bold (800)**
* **Preset Alternatif:** Tersedia tema exchange di Pengaturan (`Binance Classic`, `Bitunix Neon`, `TradingView Pro`, `Coinglass Dark`).

---

## 🚀 Fitur Unggulan

- **Ultra-Ringan & Efisien:** Menggunakan arsitektur native desktop berbasis Tauri v2 dengan konsumsi RAM minimal (~30-50MB), jauh lebih hemat dibandingkan platform berbasis Electron.
- **WebGL2 Charting Engine:** Rendering grafik candle berkecepatan tinggi hingga 60-120 FPS menggunakan LuxAlgo Vela.
- **Custom Scripting (PineTS):** Dukungan Pine Script execution langsung di aplikasi melalui LuxAlgo PineTS yang berjalan di Web Worker tanpa memblokir UI thread.
- **Multi-Exchange Real-Time Feed:** Koneksi WebSocket real-time dan REST fallback ke Binance, Bitunix, Hyperliquid, dan Coinbase.
- **Offline Drawing Storage:** Penyimpanan alat gambar, indikator, dan konfigurasi chart secara lokal menggunakan SQLite (`rusqlite`) di layer Rust.
- **Cross-Platform:** Kompatibel penuh untuk **Windows**, **Linux**, dan **macOS**.

---

## 🛠️ Tech Stack

- **Desktop Framework:** [Tauri v2](https://v2.tauri.app/) (Rust)
- **Frontend Framework:** [Svelte 5](https://svelte.dev/) (Runes) + SvelteKit SPA (adapter-static)
- **Bundler & Tooling:** [Vite](https://vitejs.dev/) + TypeScript
- **Chart Renderer:** [@luxalgo/vela](https://github.com/luxalgo/vela) (WebGL2)
- **Scripting Engine:** [@luxalgo/vela-pinets](https://github.com/luxalgo/vela) + [PineTS](https://github.com/luxalgo/pinets)
- **Code Editor:** [CodeMirror 6](https://codemirror.net/) (Pine Editor)
- **Database:** SQLite (Embedded Rust via `rusqlite`)
- **Icons:** [Lucide Svelte](https://lucide.dev/)

---

## 💻 Pengembangan Lokal (Local Development)

### Prasyarat
- [Node.js](https://nodejs.org/) (v20+)
- [Rust & Cargo](https://rustup.rs/) (stable)
- **Windows:** C++ Build Tools & WebView2 (sudah terinstal secara default pada Windows 10/11)
- **Linux:** `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
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

### 1. Build Lokal (Windows)
Untuk membuat installer lokal pada Windows:
```bash
npm run tauri build
```
Output installer (`.exe` NSIS installer & `.msi`) akan berada di direktori:
`src-tauri/target/release/bundle/`

### 2. Build Multi-Platform Otomatis (CI/CD via GitHub Actions)
Aplikasi ini sudah dilengkapi dengan GitHub Actions CI/CD matrix workflow (`.github/workflows/release.yml`) untuk mem-build binary release secara otomatis di ketiga platform:

#### Cara Trigger Release Otomatis:
1. **Lewat Git Tag (Direkomendasikan):**
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin v0.1.0
   ```
2. **Lewat GitHub CLI:**
   ```bash
   gh workflow run release.yml -f tag=v0.1.0
   ```
3. **Lewat GitHub Actions UI:**
   Buka tab **Actions** di GitHub -> Pilih **release trawangan** -> Klik **Run workflow** -> Masukkan versi tag (contoh `v0.1.0`).

### Hasil Paket Rilis Biner:
- **Windows:** `.exe` (NSIS Setup) & `.msi`
- **Linux:** `.deb` (Debian/Ubuntu) & `.AppImage` (Universal Linux)
- **macOS:** `.dmg` & `.app` (Apple Silicon & Intel)

---

## 📄 Lisensi
Didistribusikan di bawah lisensi terbuka **MIT License**. Lihat [LICENSE](LICENSE) untuk detail lengkap.
