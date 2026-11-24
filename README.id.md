<p align="center">
  <img src="static/banner.png" alt="trawangan banner" width="100%">
</p>

<p align="center">
  <strong>🌐 Pilih Bahasa / Language:</strong>
  &nbsp;<a href="README.md">🔥 Basa Jawa Arekan (Default)</a>&nbsp; ·
  &nbsp;🇮🇩 <strong>Bahasa Indonesia</strong>&nbsp; ·
  &nbsp;<a href="README.en.md">🇬🇧 English</a>
</p>

# ꦠꦿꦮꦔꦤ꧀ · trawangan

> **Terminal Charting Desktop Multi-Aset & Kripto: Zero Paywall Selamanya**  
> Dibangun di atas **Tauri v2 (Rust Core)**, **Svelte 5 (Runes)**, **LuxAlgo Vela (WebGL2 Engine 120 FPS)**, dan **PineTS v6**.

<p align="center">
  <a href="https://github.com/KaleksananBarqi/trawangan/releases/latest"><img src="https://img.shields.io/github/v/release/KaleksananBarqi/trawangan?color=FF69B4&label=Latest%20Release&style=flat-square&logo=github&logoColor=white" alt="Latest Release"></a>
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2.0-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri v2"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-Core-dea584?style=flat-square&logo=rust&logoColor=white" alt="Rust Core"></a>
  <a href="https://svelte.dev/"><img src="https://img.shields.io/badge/Svelte-5_Runes-FF3E00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte 5"></a>
  <a href="https://www.khronos.org/webgl/"><img src="https://img.shields.io/badge/WebGL2-120_FPS-990000?style=flat-square&logo=webgl&logoColor=white" alt="WebGL2"></a>
  <img src="https://img.shields.io/badge/Price-Zero_Paywall-brightgreen?style=flat-square" alt="Zero Paywall">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0_%2B_NOTICE-blue?style=flat-square" alt="Apache 2.0 License"></a>
</p>

<p align="center">
  <strong>Landing Page Resmi:</strong> <a href="https://kaleksananbarqi.github.io/trawangan/">https://kaleksananbarqi.github.io/trawangan/</a>
</p>

---

## Filosofi & Ruang Lingkup Produk

Nama **trawangan** berasal dari kosakata Jawa *penerawangan* (ꦠꦿꦮꦔꦤ꧀), yaitu ketajaman melihat menembus kabut ilusi dan kesimpangsiuran situasi pasar.

Di tengah platform charting komersial yang membatasi jumlah indikator, layout multi-chart, dan skrip di balik biaya langganan bulanan, **trawangan** mengembalikan kendali penuh meja analisis ke tangan penggunanya. Seluruh grafik, indikator, daftar pantau, skrip Pine v6, hingga arsip rencana trading berjalan secara lokal tanpa paywall untuk pasar kripto, indeks makro kripto, saham Indonesia (IDX), komoditas logam mulia USD, dan indeks AS.

> [!IMPORTANT]
> **Charting Murni secara Bawaan + Opt-In Execution Bridge (`ADR-0031`):**  
> Secara default, `trawangan` berjalan 100% murni untuk analisis grafik tanpa tombol Buy/Sell agar Anda terhindar dari klik impulsif. Namun bagi trader yang menginginkan eksekusi langsung, tersedia **Opt-In Execution Bridge (100% Opsional, Default OFF)** menuju **1. Binance**, **2. Bitunix**, dan **3. Broker CFD / MetaTrader 5 (MT5)** setelah melewati gerbang konfigurasi keamanan 3 langkah. Eksekusi order dipisahkan secara tegas dari Trade Plan dan wajib diinput **manual** di tab **Order**.

---

## Komparasi Fitur: Zero-Paywall Parity

| Fitur / Kapabilitas | `trawangan` (Desktop Native) | Platform Komersial Gratis |
| :--- | :---: | :---: |
| **Indikator Simultan** | **Tanpa batas di satu kanvas** | Dibatasi (umumnya 2 - 3 indikator) |
| **Alat Gambar Teknikal** | **76 varian lengkap + Gesture Inking multi-pane** | Sebagian dikunci di paket berbayar |
| **Gesture Drawing Engine** | **Draw by Holding (`Shift+D` / `~`) & Scribble Erase** | Tidak tersedia |
| **Multi-Chart Grid Layout** | **Bebas penuh (1, 2, 2H, 4 sel) + kloning `Save As`** | Multi-chart dikunci di langganan bulanan |
| **Manajemen Trading Plan** | **Tab `Plan` (`Preview` \| `Form` \| `Teks` \| `Riwayat`), Dual-Entry & Edit In-Place** | Wajib tarik kotak & hitung R manual |
| **Docked Thesis Preview** | **Terintegrasi rapi di sub-tab `Preview` (Kanvas bebas halangan)** | Tidak tersedia |
| **Opt-In Execution Bridge** | **Opsional (Default OFF): Binance, Bitunix & Local MT5 CFD + Tutorial Lengkap** | Terikat broker afiliasi tertentu |
| **Tutorial Start-Up & Multi-Bahasa** | **Interactive Spotlight Tour + 3 Bahasa (`Jawa Arekan Default`, `ID`, `EN`)** | Statis |
| **Eksekusi Pine Script v6** | **CodeMirror 6 IDE + Web Worker PineTS lokal** | Dibatasi antrean & kompilasi server |
| **Ekspor Tangkapan Layar** | **Ultra HD 2x - 6x + Dedicated Thesis Side Panel** | Resolusi standar 1x |
| **Sistem Tema & Kontras** | **37 preset resmi (31 tema Jawa + Warta Abang) & Studio 9D** | Pilihan tema terbatas |
| **Cakupan Pasar & Makro** | **Binance, Indodax IDR, Bitunix, Hyperliquid, Coinbase, Yahoo Finance (IDX, COMEX, US), & Makro (`TOTAL` 1-3, `OTHERS`, `BTC.D`)** | Data tambahan sering berbayar |
| **Konsumsi Memori (RAM)** | **Ringan ~30 - 50 MB (Native Rust)** | 500 MB - 1.5 GB (Electron / Browser) |
| **Biaya & Lisensi** | **Rp 0 / \$0 Selamanya (Apache 2.0 + Wajib Kredit `NOTICE`)** | \$14.95 - \$59.95 / bulan |

---

## Kapabilitas Utama

### 1. Docked Thesis Preview di Tab `Plan` & Dual-Entry (`ADR-0014` - `ADR-0032`)
Kartu tesis tidak lagi melayang menutupi candlestick di kanvas grafik. Seluruh pembacaan tesis kini menyatu rapi di sub-tab **`Preview`** pada tab **`Plan`** di dock kanan (`Preview | Form | Teks | Riwayat`), lengkap dengan lencana epistemik (`[FAKTA]`, `[INFERENSI]`, `[SPEKULASI]`), bobot **Dual-Entry (`E1` & `E2` + `Blended Entry`)**, **POI Context Zones**, dan jarak harga pasar live. Saat mengekspor gambar via `Ctrl+Shift+S`, tesis dirender berdampingan melalui **Dedicated Thesis Side Panel**.

### 2. Opt-In Execution Bridge: Binance, Bitunix, & Broker CFD MT5 (`ADR-0031`)
Secara bawaan nonaktif total (*zero UI footprint*). Saat diaktifkan melalui **Pengaturan → Broker & Eksekusi**:
- Dilengkapi **Gerbang Persetujuan Risiko**, penyimpanan kredensial terenkripsi lokal di SQLite Rust Core, serta **Tutorial Setup Lengkap Langkah-demi-Langkah** di dalam aplikasi.
- Mendukung **Binance** (Spot & USDⓈ-M Futures via `HMAC-SHA256`), **Bitunix** (Perpetual OpenAPI via `SHA256`), dan **Broker CFD / MetaTrader 5** melalui generator 1-klik **`TrawanganMT5Bridge.mq5`** yang berjalan 100% gratis dan lokal di `127.0.0.1:15555`.
- Menampilkan tab **`Order` (`Manual Order Ticket`)** di dock kanan yang **dipisahkan secara tegas dari Trade Plan** sehingga seluruh order wajib diinput dan dikonfirmasi manual oleh pengguna.

### 3. Startup Spotlight Tour & Lokalisasi 3 Bahasa (`jv` Default, `id`, `en`)
Tur interaktif 6 langkah menyambut pengguna saat peluncuran pertama (dan dapat diputar ulang kapan saja dari tombol **Tutorial** di Header), disertai dukungan tiga bahasa reaktif: **Basa Jawa Ngoko Arekan (Default)**, **Bahasa Indonesia**, dan **English**.

---

## Galeri Tampilan Antarmuka (8 Permukaan Kerja)

### 1. Terminal Charting Utama & WebGL2 Vela Engine
<p align="center">
  <img src="docs/assets/screenshots/home.png" alt="Terminal charting utama trawangan" width="95%">
</p>

### 2. Panel Watchlist Lintas Bursa & Multi-Watchlist
<p align="center">
  <img src="docs/assets/screenshots/watchlist.png" alt="Panel Watchlist lintas bursa" width="95%">
</p>

### 3. Tab Trade Plan, Dual-Entry & Proyeksi Multi-Target
<p align="center">
  <img src="docs/assets/screenshots/trade-plan.png" alt="Tab Trade Plan dan proyeksi multi-target" width="95%">
</p>

### 4. Gesture Engine: Draw by Holding (`Shift+D` / `~`) & Scribble Erase
<p align="center">
  <img src="docs/assets/screenshots/gesture-draw.png" alt="Gesture Draw by Holding" width="95%">
</p>

### 5. Side-by-Side Pine Script v6 IDE (CodeMirror 6 + Web Worker)
<p align="center">
  <img src="docs/assets/screenshots/ide-editor.png" alt="Side-by-Side Pine Script v6 IDE" width="95%">
</p>

### 6. Manajemen Price Alert, Draggable Line & Background Engine
<p align="center">
  <img src="docs/assets/screenshots/alert.png" alt="Manajemen Price Alert" width="95%">
</p>

### 7. Pengaturan Terminal, Bahasa, Audio Chime & Broker Bridge
<p align="center">
  <img src="docs/assets/screenshots/setting.png" alt="Modal Pengaturan Terminal" width="95%">
</p>

### 8. Dual-Theme Decoupling & 37 Preset Tema Resmi
<p align="center">
  <img src="docs/assets/screenshots/tema.png" alt="Galeri 37 Preset Tema" width="95%">
</p>

---

## Pengembangan Lokal & Build

```bash
git clone https://github.com/KaleksananBarqi/trawangan.git
cd trawangan
npm ci
npm run tauri dev
```

Untuk membangun paket rilis installer native:
```bash
npm run tauri build
```

*(Catatan Arsitektur Mobile: Kelayakan kompilasi iOS & Android menggunakan Tauri v2 Mobile + Adaptive Touch Shell terdokumentasi di [ADR-0030](docs/adr/0030-tauri-v2-mobile-readiness-and-adaptive-touch-shell.md)).*

---

## Lisensi & Atribusi Wajib (Apache 2.0 + `NOTICE`)

Didistribusikan di bawah **Apache License, Version 2.0** (lihat [LICENSE](LICENSE) dan [NOTICE](NOTICE)).

> [!WARNING]
> **Kewajiban Atribusi Eksplisit (Klausul 4d Apache License 2.0):**  
> Setiap pihak yang melakukan fork, memodifikasi, atau mendistribusikan ulang perangkat lunak ini (baik kode sumber maupun biner) **wajib** menyertakan atribusi pembuat asli (**Kaleksanan Barqi Aji Massani, `https://github.com/KaleksananBarqi/trawangan`**) secara jelas dan terlihat di dalam berkas `NOTICE`, dokumentasi/README, serta dialog **"Tentang Aplikasi / About"** pada antarmuka pengguna karya turunannya.
