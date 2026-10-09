# Trawangan 📈

> **Ultra-Lightweight Native Crypto Charting Desktop Application**  
> Ditenagai oleh **Tauri v2 (Rust Core)**, **Svelte 5**, **LuxAlgo Vela (WebGL2)**, dan **PineTS**.

---

## 🚀 Fitur Utama

- **Ultra-Ringan & Efisien:** Menggunakan arsitektur native desktop berbasis Tauri v2 dengan konsumsi RAM minimal (~30-50MB), jauh lebih hemat dibandingkan platform berbasis Electron.
- **WebGL2 Charting Engine:** Rendering grafik candle berkecepatan tinggi hingga 60-120 FPS menggunakan LuxAlgo Vela.
- **Custom Scripting (PineTS):** Dukungan Pine Script execution langsung di aplikasi melalui LuxAlgo PineTS yang berjalan di Web Worker tanpa memblokir UI thread.
- **Multi-Exchange Real-Time Feed:** Koneksi WebSocket real-time dan REST fallback ke Binance Spot & Futures.
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
- Windows: C++ Build Tools & WebView2 (sudah terinstal secara default pada Windows 10/11)
- Linux: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
- macOS: Xcode Command Line Tools

### Menjalankan Mode Dev
```bash
# Install dependensi frontend
npm install

# Jalankan dalam mode development dengan Hot Reload
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

### 2. Build Multi-Platform Otomatis (Windows, Linux, macOS via GitHub Actions)
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
   Buka tab **Actions** di GitHub -> Pilih **Release Trawangan** -> Klik **Run workflow** -> Masukkan versi tag (contoh `v0.1.0`).

### Hasil Paket Rilis:
- **Windows:** `.exe` (NSIS Setup) & `.msi`
- **Linux:** `.deb` (Debian/Ubuntu) & `.AppImage` (Universal Linux)
- **macOS:** `.dmg` & `.app` (Apple Silicon & Intel)

---

## 📄 Lisensi
Distributed under the MIT License.
