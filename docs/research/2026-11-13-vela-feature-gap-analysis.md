# Analisis Komparasi Fitur: LuxAlgo/Vela vs Trawangan

**Tanggal:** 2026-11-13  
**Status:** Riset & Temuan Investigasi Primer  
**Target Repositori:** `LuxAlgo/Vela` (`@luxalgo/vela` v0.8.3, `@luxalgo/vela-pinets` v0.2.15) vs `trawangan`  
**Sumber Primer yang Diperiksa:**
1. `node_modules/@luxalgo/vela/package.json` & `README.md`
2. `node_modules/@luxalgo/vela/dist/index.cjs` & `dist/contributions-HGqnNb_P.d.ts`
3. `node_modules/@luxalgo/vela/dist/options-lMUwmRwh.d.ts`
4. `node_modules/@luxalgo/vela/dist/workspace.d.ts`
5. `node_modules/@luxalgo/vela/dist/DataProvider-oH78tYXL.d.ts`
6. `node_modules/@luxalgo/vela-pinets/dist/index.cjs` & `dist/index.d.ts`
7. Basis kode Trawangan (`src/lib/services/`, `src/lib/components/`, `src/lib/data/`)

---

## 1. Eksekutif Ringkasan

Trawangan menggunakan `@luxalgo/vela` sebagai engine visualisasi grafik berbasis WebGL2 dan `@luxalgo/vela-pinets` untuk mengeksekusi Pine Script v5/v6. Namun, integrasi Trawangan saat ini baru menyentuh sebagian kecil dari kemampuan penuh yang disediakan oleh Vela. 

Banyak modul inti yang **sangat bernilai tinggi (*high-value*)** di Vela belum dihubungkan ke antarmuka atau logika Trawangan:
1. **76 Native Indicators** bawaan Vela (0 overhead worker, instant reactive) tidak diekspos sama sekali; Trawangan hanya menyediakan 7 preset Pine Script di modal indikator.
2. **Chart Price Styles / Tipe Lilin** (Heikin Ashi, Baseline, Area, Bars, Line, serta Plugin SDK) sudah didukung engine Vela, namun tidak memiliki pemilih / dropdown di UI Trawangan.
3. **Timeline Marks (`chart.marks`)**: Penanda peristiwa interaktif pada sumbu waktu (bisa untuk Kalender Ekonomi, Dividen, Laporan Keuangan, Eksekusi Order, Catatan Jurnal) sama sekali belum dipakai (0 pemanggilan).
4. **Pine Strategy Backtester & Trade Executions**: Engine `@luxalgo/vela-pinets` secara internal menghitung metriks backtesting lengkap (`StrategyState`, `StrategyTrade[]`, `TradeExecution`), namun Trawangan tidak menampilkan tab pengujian strategi maupun panah eksekusi beli/jual di lilin.
5. **Dukungan Multi-Simbol Pine (`request.security` via `fetchSeries`)**: Engine worker Pine tidak diberi handler `fetchSeries`, sehingga pemanggilan multi-ticker di Pine Script gagal.
6. **Order Flow & Footprints (`request.footprint` via `footprints`)**: Opsi data footprint volume bid/ask intra-bar di worker engine belum dihubungkan.
7. **Sesi Jam Pasar & Session Zones**: Shading pre-market / post-market (`SESSION_PRE`, `SESSION_POST`) dan seleksi `MarketSession` (`regular` vs `extended`) belum diaktifkan.
8. **Visible Range Volume Profile (VPVR)**: Indikator profil volume rentang tampak native belum dihadirkan di katalog indikator.

---

## 2. Temuan Rinci per Area Fungsional

### A. Indikator: Kesenjangan 76 Native Indicators vs 7 Preset Skrip Pine
- **Fakta Vela (Sumber Primer: `dist/index.cjs:38463`, `dist/contributions-HGqnNb_P.d.ts`):**
  Vela membawa **76 indikator native** yang dihitung langsung pada thread utama dengan performa tinggi tanpa perlu mem-parsing atau mengeksekusi Web Worker Pine Script:
  - **Moving Averages & Regresi (8):** SMA, EMA, MA Dasar, Smoothed MA (RMA), Zero-Lag EMA (ZLEMA), Variable Index Dynamic Average (VIDYA), MA Envelope, Linear Regression Curve.
  - **Bands & Channels (5):** Bollinger Bands, Bollinger Bands %B, Bollinger Bands Width, Keltner Channels, Donchian Channels.
  - **Stop & Trend Overlays (7):** SuperTrend, Parabolic SAR, Chandelier Exit, Chande Kroll Stop, Williams Alligator, ZigZag, Williams Fractal, 52-Week High/Low.
  - **Momentum & Oscillators (25):** RSI, Stochastic, Stochastic RSI, MACD, Percentage Price Oscillator (PPO), Awesome Oscillator, Commodity Channel Index (CCI), Williams %R, Chande Momentum Oscillator (CMO), Connors RSI, Fisher Transform, TRIX, True Strength Index (TSI), SMI Ergodic, Schaff Trend Cycle, Know Sure Thing (KST), Coppock Curve, Detrended Price Oscillator (DPO), Rate of Change (ROC), Ultimate Oscillator, Relative Vigor Index (RVI), Relative Volatility Index, Balance of Power, Elder Ray, TTM Squeeze, Gator Oscillator, Aroon, Average Directional Index (ADX), Vortex Indicator.
  - **Volatilitas & Risiko (7):** Average True Range (ATR), Historical Volatility, Chaikin Volatility, Mass Index, Standard Deviation, Ulcer Index, Choppiness Index.
  - **Volume & Money Flow (12):** On Balance Volume (OBV), Accumulation/Distribution (A/D), Chaikin Money Flow (CMF), Chaikin Oscillator, Ease of Movement, Force Index, Klinger Oscillator, Money Flow Index (MFI), Negative Volume Index (NVI), Positive Volume Index (PVI), Price Volume Trend (PVT), Volume Oscillator, Percentage Volume Oscillator (PVO), Volume Flow Indicator (VFI), Intraday Intensity.
  - **Profil Volume & Anchored (3):** Visible Range Volume Profile (VPVR), Pivot Points Standard (Traditional, Fibonacci, Woodie, Classic, Demark, Camarilla), Anchored VWAP.
- **Kondisi Trawangan Saat Ini (Sumber: `src/lib/data/indicatorPresets.ts`, `src/lib/components/IndicatorModal.svelte`):**
  - Trawangan hanya memiliki **7 preset indikator** (`rsi`, `macd`, `bb`, `ema-ribbon`, `supertrend`, `vwap`, `volume`).
  - Seluruh indikator tersebut berupa kode sumber string Pine Script v5/v6 yang diteruskan ke `PineWorkerEngine`.
  - Fungsi native Vela `chart.availableNativeIndicators()` dan `chart.addNativeIndicator()` tidak pernah dipanggil di modal pemilih indikator.
- **Dampak & Nilai Penting:**
  - Menghubungkan 76 native indicators akan membuat library indikator Trawangan seketika setara dengan charting platform institusional.
  - Native indicators tidak membebani worker Pine, tidak memerlukan kompilasi AST, dan hemat memori.

---

### B. Chart Styles: Tipe Lilin Alternatif & Plugin SDK
- **Fakta Vela (Sumber Primer: `dist/options-lMUwmRwh.d.ts:1691`, `dist/plugin-Cr2Pj8q8.js`):**
  Vela mendukung tipe harga (*PriceStyle*):
  - `'candles'`
  - `'bars'` (OHLC bar chart)
  - `'line'`
  - `'area'`
  - `'baseline'`
  - `'heikinashi'` (menghitung lilin rata-rata Heikin-Ashi secara langsung di layer bar transform tanpa merusak data asli)
  - Plugin SDK via `registerChartType` & `registerRendererLayer` untuk tipe kustom (Renko, Kagi, Point & Figure).
- **Kondisi Trawangan Saat Ini (Sumber: `src/lib/services/chartSessionController.ts:3413`, `src/lib/components/header/`):**
  - Trawangan memiliki method `setPriceStyle()` dan `getPriceStyle()` di `chartSessionController.ts`, serta menyimpan preferensi ini di skema workspace SQLite.
  - **Namun di UI Shell (Header / Toolbar), tidak ada menu atau tombol dropdown bagi pengguna untuk memilih tipe lilin**.
- **Dampak & Nilai Penting:**
  - Fitur sudah siap 90% di level backend/service, hanya butuh komponen UI dropdown di Header untuk mengaktifkan Heikin Ashi, Line, Area, Baseline, dan Bars bagi trader.

---

### C. Timeline Marks: Anotasi Peristiwa pada Sumbu Waktu (`chart.marks`)
- **Fakta Vela (Sumber Primer: `dist/contributions-BhOBRenr.d.cts:1578-1640`, `dist/options-lMUwmRwh.d.ts:1290-1360`):**
  - `chart.marks` (`MarksControl`, `MarksController`, `TimelineMark`) menyediakan API khusus untuk merender penanda peristiwa pada lilin spesifik:
    - Dukungan glyph ikon, teks, dan tooltip.
    - Pengelompokan otomatis (*clustering*) saat zoom out.
    - Popup interaktif saat diklik: mendukung teks polos, HTML kaya, atau daftar kartu info (`MarkPanelItem[]`).
    - Dukungan hirarki grup (`MarkGroup`) dengan opsi visible/hidden di dialog Pengaturan tab *Events*.
- **Kondisi Trawangan Saat Ini:**
  - Trawangan sama sekali tidak menggunakan `chart.marks` (0 referensi di kode).
- **Dampak & Nilai Penting:**
  - Fitur ini sangat cocok dipadukan dengan:
    1. **Kalender Ekonomi Makro:** Menampilkan tanda peristiwa penting (FOMC, CPI, NFP) langsung di bar grafik, relevan dengan fitur *Crypto Macro Index* yang baru dirilis di Trawangan.
    2. **Riwayat Eksekusi Trading Plan:** Menandai waktu saat order limit terisi (*filled*), take profit tercapai, atau stop loss tersentuh.
    3. **Anotasi Jurnal Tesis:** Menyematkan catatan analisis trader pada candle tertentu.
    4. **Dividen & Earnings:** Menampilkan jadwal rilis pendapatan pada saham Yahoo Finance.

---

### D. Pine Strategy Backtester & Trade Executions
- **Fakta Vela (Sumber Primer: `dist/contributions-BhOBRenr.d.cts:1-120`, `options-lMUwmRwh.d.ts:2100`):**
  - `@luxalgo/vela-pinets` dan engine Vela mendukung simulasi strategi Pine (`strategy(...)`):
    - Mengembalikan `StrategyState`: Net PnL, Gross Profit, Gross Loss, Win rate, Win/Loss/Even count, Max Drawdown, Max Runup, Open Position, Avg Price.
    - Mengembalikan buku besar transaksi: `StrategyTrade[]` (setiap round-trip lengkap dengan waktu/harga entry dan exit, kuantitas, komisi, dan runup/drawdown transaksi).
    - Merender `TradeExecution` secara visual: panah beli hijau di bawah bar dan panah jual merah di atas bar dengan label order ID.
- **Kondisi Trawangan Saat Ini:**
  - Trawangan memiliki modul Pine Editor (`PineEditorModal.svelte`), namun hanya memanfaatkan plotting visual grafik (`plot`, `hline`, `fill`).
  - Tidak ada panel "Strategy Tester" / Laporan Kinerja di UI Trawangan.
- **Dampak & Nilai Penting:**
  - Trader tidak bisa melihat metrik performa (win rate, profit factor, drawdown) saat menguji strategi trading di Pine Editor.

---

### E. Integrasi Data Lanjutan pada Scripting Engine
- **Fakta Vela (Sumber Primer: `node_modules/@luxalgo/vela-pinets/dist/index.d.ts:6-105`):**
  - `PineWorkerEngine` menerima 2 opsi vital:
    1. `fetchSeries?: (symbol: string, timeframe: string, range?: BarRange) => Promise<OHLCV[]>`: Melayani fungsi Pine `request.security(symbol, timeframe, expression)`.
    2. `footprints?: (symbol: string, timeframe: string, range?: BarRange) => Promise<FootprintBar[]>`: Melayani fungsi Pine `request.footprint()` untuk analisis volume delta order flow.
- **Kondisi Trawangan Saat Ini (Sumber: `src/lib/services/chartSessionController.ts:124`, `line 799`):**
  - Diinstansiasi dengan `new PineWorkerEngine()` tanpa opsi sama sekali.
- **Dampak & Nilai Penting:**
  - Script Pine yang membutuhkan data simbol lain (misal rasio BTC/ETH, korelasi indeks makro) tidak berfungsi dan menghasilkan data kosong.

---

### F. Jam Sesi Pasar (Trading Sessions & Session Zones)
- **Fakta Vela (Sumber Primer: `dist/options-lMUwmRwh.d.ts:1848-1908`, `dist/index.d.ts:133-171`):**
  - Vela memiliki abstraksi `MarketSession` (`'regular'` vs `'extended'`).
  - Fitur `sessionZones`: Kanvas WebGL2 mewarnai zona pre-market (`SESSION_PRE`), post-market (`SESSION_POST`), dan jam pasar tutup (`SESSION_OFF`) dengan warna transparan tematik.
- **Kondisi Trawangan Saat Ini:**
  - Trawangan memperlakukan semua pasar sebagai sesi kontinu tunggal tanpa shading visual jam bursa.
- **Dampak & Nilai Penting:**
  - Sangat berguna saat melihat aset saham AS / ETF / Indeks via Yahoo Finance, di mana fluktuasi di luar jam bursa reguler (after-hours) sering kali membingungkan jika tidak dibedakan warnanya.

---

### G. Progressive Data Loading & Differential Tail Fetching
- **Fakta Vela (Sumber Primer: `dist/DataProvider-oH78tYXL.d.ts:35-85`):**
  - `loadProgressive`: Memungkinkan chart langsung merender 100 candle terbaru dalam hitungan milidetik, sementara riwayat ratusan ribu bar lama di-*stream* di background.
  - `loadRange`: Mengambil hanya rentang selisih candle yang belum tersimpan (*uncached tail*) saat terjadi reconnect.
- **Kondisi Trawangan Saat Ini:**
  - Trawangan mengambil snapshot candle historis penuh dalam satu panggilan REST API, yang dapat menyebabkan jeda visual jika mengambil 1000+ bar.

---

## 3. Matriks Perbandingan Ringkas

| Fitur / Kemampuan Vela | Status di Vela | Status di Trawangan | Prioritas Implementasi |
| :--- | :---: | :---: | :---: |
| **76 Native Indicators** (SMA, EMA, ATR, Keltner, Donchian, Parabolic SAR, MFI, CMF, ZigZag, dll.) | ✅ Lengkap di Core | ❌ Hanya 7 Pine Preset | 🔴 **Sangat Tinggi** (Cepat & Berdampak Besar) |
| **Chart Type Picker** (Candles, Bars, Line, Area, Baseline, Heikin Ashi) | ✅ Lengkap di Renderer | ⚠️ Method siap, UI pemilih belum ada | 🔴 **Sangat Tinggi** (Quick Win) |
| **Visible Range Volume Profile (VPVR)** | ✅ Native Study bawaan | ❌ Belum diekspos di UI | 🟡 **Tinggi** |
| **Timeline Marks (`chart.marks`)** | ✅ API & Clustering siap | ❌ Belum dipakai sama sekali | 🟡 **Tinggi** (Katalis Fitur Kalender/Jurnal) |
| **Multi-Ticker Pine (`fetchSeries` / `request.security`)** | ✅ Didukung Worker Engine | ❌ Tidak dioper ke konstruktor | 🟡 **Tinggi** |
| **Pine Strategy Tester & Trade Markers** | ✅ Didukung Core & PineTS | ❌ Hasil eksekusi diabaikan | 🟢 **Menengah** |
| **Trading Sessions & Pre/Post-Market Shading** | ✅ Fitur `sessionZones` siap | ❌ Belum diaktifkan | 🟢 **Menengah** |
| **Orderflow Footprints (`request.footprint`)** | ✅ Engine port siap | ❌ Belum ada data feed bid/ask | ⚪ **Rendah** (Butuh datafeed Level 2) |
| **Plugin Architecture (`registerSidePanel`, dll.)** | ✅ API Kontribusi siap | ⚠️ Diganti custom overlay Svelte | ⚪ **Arsitektural** (Sudah diselesaikan via Svelte) |

---

## 4. Rekomendasi Rencana Aksi (Action Plan)

1. **Fase 1: Quick Wins (UI & Native Indicators)**
   - Tambahkan pemilih tipe lilin (*Price Style Selector*) di Header Trawangan: `Candles`, `Heikin Ashi`, `Bars`, `Line`, `Area`, `Baseline`.
   - Hubungkan `chart.availableNativeIndicators()` ke `IndicatorModal.svelte` sehingga pengguna dapat memilih dari 76 indikator native Vela selain skrip Pine.
2. **Fase 2: Scripting & Multi-Market Hardening**
   - Teruskan handler `fetchSeries` ke instansiasi `PineWorkerEngine` agar `request.security()` di Pine Script dapat berjalan dengan meminjam provider data Trawangan.
   - Tambahkan dukungan penanda peristiwa waktu (`chart.marks`) untuk menampilkan titik eksekusi trading plan dan sinyal alert.
3. **Fase 3: Strategy Tester & Sesi Pasar**
   - Buat panel tab *Strategy Tester* di bawah grafik atau di samping Pine Editor untuk membaca `StrategyState` dan `StrategyTrade[]`.
   - Aktifkan `sessionZones` untuk provider Yahoo Finance guna membedakan jam reguler dan jam pre/post-market.
