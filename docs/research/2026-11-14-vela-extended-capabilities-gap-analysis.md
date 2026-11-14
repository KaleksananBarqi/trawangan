# Analisis Komparasi Lanjutan: Fitur & Subsistem Vela yang Belum Diimplementasikan di Trawangan (Pasca-Spec #192)

**Tanggal:** 2026-11-14  
**Status:** Riset & Temuan Investigasi Primer (Tahap 2)  
**Target Repositori:** `@luxalgo/vela` (v0.8.3) & `@luxalgo/vela-pinets` (v0.2.15) vs `trawangan`  
**Sumber Primer yang Diperiksa:**
1. `node_modules/@luxalgo/vela/dist/index.d.ts`, `dist/index.cjs`, `dist/contributions-HGqnNb_P.d.ts`
2. `node_modules/@luxalgo/vela/dist/options-lMUwmRwh.d.ts`
3. `node_modules/@luxalgo/vela/dist/workspace.d.ts` & `dist/workspace.cjs`
4. `node_modules/@luxalgo/vela/dist/DataProvider-oH78tYXL.d.ts`
5. `node_modules/@luxalgo/vela/dist/plugin-Cr2Pj8q8.d.ts` & `dist/side-panel-_2UK1gSm.d.ts`
6. `node_modules/@luxalgo/vela/dist/statusline-model-CY1wzxHg.d.ts`
7. `node_modules/@luxalgo/vela-pinets/dist/index.d.ts` & `dist/index.cjs`
8. Basis kode Trawangan (`src/lib/services/`, `src/lib/components/`, `src/routes/`)

---

## 1. Eksekutif Ringkasan

Implementasi **Spec #192** telah berhasil mengintegrasikan pilar-pilar penting dari riset tahap 1:
- Katalog **76 Native Indicators** bawaan Vela dengan modal pengaturan interaktif (`IndicatorCatalogService`, `IndicatorSettingsModal.svelte`).
- **Header Price Style Selector** (6 gaya harga bawaan: Candles, Heikin-Ashi, Bars, Line, Area, Baseline).
- **Timeline Marks Engine** (`chart.marks`, `TimelineMarksController.ts` untuk kalender makro dan eksekusi plan).
- **Pine Multi-Ticker Security Data** (`fetchSeries` untuk Pine `request.security()`).
- **Pine Strategy Telemetry Bridge** (`StrategyState`, `StrategyTrade[]`, dan panah `TradeExecution`).

Kendati demikian, audit menyeluruh terhadap pustaka `@luxalgo/vela` dan `@luxalgo/vela-pinets` mengungkap bahwa **masih ada subsistem dan kapabilitas canggih Vela yang belum dieksploitasi atau belum terhubung sepenuhnya** ke antarmuka dan alur kerja pengguna di Trawangan. 

Laporan ini memetakan seluruh kapabilitas yang terlewat, mengidentifikasi status implementasinya di Trawangan, dan menyusun peta jalan prioritas untuk fase pengembangan berikutnya.

---

## 2. Temuan Rinci per Subsistem yang Belum Diimplementasikan

---

### A. DataWindow & Cursor Readouts (Inspektur Angka Crosshair Presisi)
- **Fakta Vela (Sumber Primer: `dist/options-lMUwmRwh.d.ts:1475-1508`, `dist/contributions-HGqnNb_P.d.ts:1220`):**
  - Vela memiliki API `getDataWindowReadout()` / `chart.renderer.dataWindowReadout()` yang mengembalikan struktur `DataWindowReadout`:
    ```typescript
    interface DataWindowReadout {
      date: string; // "2026-07-03"
      time: string; // "14:30"
      ohlc: DataWindowOHLC | null; // o, h, l, c, vol, up
      groups: DataWindowGroup[]; // name (indikator) + rows (setiap plot: label, value, color)
    }
    ```
  - Nilai angka pada setiap baris plot sudah diformat secara otomatis (*pre-formatted*) mengikuti skala harga dan presisi masing-masing pane, sehingga UI host tidak perlu melakukan kalkulasi desimal sendiri.
- **Kondisi Trawangan Saat Ini:**
  - Trawangan **sama sekali belum memanfaatkan `dataWindowReadout()`** (0 referensi di UI).
  - Trader saat ini hanya bisa membaca angka di legend header kecil yang sering terpotong jika indikator memiliki banyak output plot (seperti Bollinger Bands, MACD, Ichimoku).
- **Dampak & Nilai:**
  - Komponen sidebar / popover "Data Window" adalah fitur standar di terminal institusional (TradingView, Bloomberg) untuk membedah data candle dan puluhan nilai indikator secara presisi pada posisi kursor.

---

### B. Pine Script Alerts & Telemetry Runtime (`alert()`, `alertcondition()`)
- **Fakta Vela (Sumber Primer: `dist/contributions-HGqnNb_P.d.ts:90-102, 1061-1064`, `vela-pinets/dist/index.cjs:1730`):**
  - Vela mendefinisikan interface `EngineAlert` dan `EngineWarning`:
    ```typescript
    interface EngineAlert {
      id: string;
      message: string;
      title?: string;
      time: number;
      barIndex: number;
      freq?: string;
    }
    ```
  - Worker PineScript secara aktif memancarkan event `alert` dan `warning` saat skrip pengguna memanggil fungsi Pine `alert("Pesannya")` atau saat `alertcondition(...)` terpenuhi.
  - Event ini diekspos melalui event bus chart: `chart.on('alert', (payload) => ...)` dan `chart.on('warning', (payload) => ...)`.
- **Kondisi Trawangan Saat Ini:**
  - `chartSessionController.ts` **tidak memasang listener untuk event `alert` maupun `warning`**.
  - Panggilan alert di dalam skrip PineScript berakhir senyap tanpa memicu toast UI, suara lonceng, maupun notifikasi sistem desktop (`@tauri-apps/plugin-notification`).
- **Dampak & Nilai:**
  - Mengaktifkan listener ini memungkinkan trader mengatur alert otomatis dari indikator kustom mereka sendiri langsung ke desktop OS!

---

### C. Price Axis Countdown Timer & WallClock Sync
- **Fakta Vela (Sumber Primer: `dist/index.d.ts:207, 720-726`):**
  - Vela memiliki opsi skala harga: `priceScale.countdown: true`.
  - Saat aktif, kanvas WebGL2 merender badge hitung mundur (misal `02:41` pada candle 5 menit) tepat di samping label harga terakhir pada sumbu vertikal.
  - Sincronisasi detik dikelola oleh `chart.renderer.setWallClock(clock: WallClock | null)`.
- **Kondisi Trawangan Saat Ini:**
  - Opsi `countdown` belum pernah diaktifkan atau diekspos di pengaturan skala harga Trawangan.
- **Dampak & Nilai:**
  - Fitur yang sangat esensial bagi scalper intraday dan swing trader untuk mengetahui dengan pasti sisa durasi sebelum bar tertutup (*bar close confirmation*).

---

### D. Bar Replay Intrabar Tick Playback (`lowerTimeframeTicks` & `setTicks`)
- **Fakta Vela (Sumber Primer: `dist/contributions-HGqnNb_P.d.ts:790-825`, `dist/index.d.ts:1552-1569`):**
  - Mesin replay Vela (`chart.replay` / `ReplayControl`) mendukung pemutaran berbasis tick intra-bar (`chart.replay.setTicks(source)` dan `chart.replay.stepUpdate()`).
  - Fungsi utilitas `lowerTimeframeTicks(chart, timeframe)` dan `barsToTicks(bars)` memungkinkan bar timeframe tinggi (misal 1 Jam) dimainkan secara realistis menggunakan tick-tick dari timeframe rendah (misal 1 Menit).
- **Kondisi Trawangan Saat Ini:**
  - Trawangan sudah memiliki toolbar `ReplayBar.svelte` dan driver `ReplaySession`, namun **hanya mendukung pergeseran bar utuh (*whole bar step*)**.
  - Metode `stepBack` di `Chart.svelte:255` masih berupa fungsi kosong (`() => {}`).
  - Intrabar tick playback belum dihubungkan.
- **Dampak & Nilai:**
  - Menghadirkan simulasi pergerakan harga mikro di dalam candle, membuat visualisasi backtest terasa identik dengan kondisi pasar live nyata.

---

### E. Visible Range Presets Bar (Navigasi Rentang Waktu Cepat)
- **Fakta Vela (Sumber Primer: `dist/options-lMUwmRwh.d.ts:1843`, `dist/statusline-model-CY1wzxHg.d.ts:330-350`):**
  - Vela mendefinisikan tipe rentang cepat:
    ```typescript
    type VisibleRangePreset = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'YTD' | 'ALL';
    ```
  - Mendukung penyesuaian otomatis viewport grafik melalui `chart.setMarket({ visibleRange: '1M' })` atau `chart.setVisibleRange(...)`, lengkap dengan kalkulasi jumlah bar (*bar budget*) yang optimal.
- **Kondisi Trawangan Saat Ini:**
  - Trawangan tidak memiliki bilah tombol rentang cepat (*Range Chips Bar*) di footer chart. Pengguna harus menggeser dan memperbesar/memperkecil kanvas secara manual.
- **Dampak & Nilai:**
  - Akses satu-klik untuk melihat kinerja aset dalam 1 Hari, 1 Bulan, Year-To-Date (YTD), atau 1 Tahun.

---

### F. Session Zones & Jam Pasar Bursa (Regular vs Extended Hours)
- **Fakta Vela (Sumber Primer: `dist/plugin-Cr2Pj8q8.d.ts:701-705`, `dist/options-lMUwmRwh.d.ts:1848-1853`):**
  - Vela membedakan sesi pasar: `MarketSession = 'regular' | 'extended'`.
  - Membawa token warna tematik:
    - `SESSION_PRE = "#f97316"` (Amber fajar pre-market)
    - `SESSION_POST = "#0ea5e9"` (Biru senja after-hours)
    - `SESSION_OFF = "#9ca3af"` (Abu-abu libur/bursa tutup)
  - Fitur WebGL2 `sessionZones` mewarnai area latar belakang candle sesuai fase jam pasar.
- **Kondisi Trawangan Saat Ini:**
  - Trawangan memperlakukan seluruh data sebagai pasar kontinyu tanpa shading jam bursa.
- **Dampak & Nilai:**
  - Sangat krusial saat menganalisis saham US (Apple, Tesla, NVDA) dan indeks (S&P 500, Nasdaq) via Yahoo Finance, agar trader tidak tertipu oleh volume rendah pada sesi after-hours.

---

### G. Order Flow Footprints Data Feed (`request.footprint`)
- **Fakta Vela (Sumber Primer: `node_modules/@luxalgo/vela-pinets/dist/index.d.ts:17-60, 103, 165`):**
  - Engine `PineWorkerEngine` menerima handler `footprints: FootprintSource` untuk melayani panggilan Pine v5/v6 `request.footprint()`.
  - Format data mencakup rincian volume bid/ask per tingkat harga di setiap bar:
    ```typescript
    interface FootprintLevel {
      price: number;
      buyVolume: number;  // Ask lifts
      sellVolume: number; // Bid hits
    }
    interface FootprintBar {
      openTime: number;
      levels: FootprintLevel[];
    }
    ```
- **Kondisi Trawangan Saat Ini:**
  - `PineWorkerEngine` di Trawangan diinstansiasi tanpa properti `footprints`.
- **Dampak & Nilai:**
  - Membuka jalan bagi indikator tingkat lanjut: Delta Divergence, Imbalance Footprint, dan Volume POC intra-bar.

---

### H. Progressive Data Loading & Differential Tail Fetching
- **Fakta Vela (Sumber Primer: `dist/DataProvider-oH78tYXL.d.ts:39-48, 154-171`, `dist/index.d.ts:1331-1393`):**
  - `getBarsProgressive`: Memungkinkan provider mengirimkan data secara bertahap (batch 100 candle terkini langsung dirender dalam <30ms, sementara 50.000 candle lama di-stream di background).
  - `CachingDataFeed` & `sharedBarStore`: Menyimpan riwayat bar dalam memori dan hanya mengunduh selisih bar (*uncached tail*) saat simbol dibuka kembali.
- **Kondisi Trawangan Saat Ini:**
  - Pengambilan data lilin masih menggunakan pola monolitik REST, menyebabkan jeda visual sesaat (*loading stall*) saat memuat riwayat panjang.
- **Dampak & Nilai:**
  - Menghilangkan *freezing* antarmuka dan mempercepat pergantian simbol secara instan.

---

### I. WebGL2 Visual Effects & Animasi Dinamis
- **Fakta Vela (Sumber Primer: `dist/options-lMUwmRwh.d.ts:1952-1954, 2046-2075`):**
  - `glow: number`: Efek neon bloom bercahaya pada garis indikator dan garis harga pada backend WebGL2 (0 = nonaktif, ~0.6 = glowing intensif).
  - `animations.liveBar: true | number`: Easing pembentukan lilin live (candle high/low/close bergeser halus saat tick baru masuk alih-alih melompat kaku).
  - `animations.intro: 'settle' | 'grow'`: Animasi transisi pegas saat chart pertama kali dibuka (*first-paint reveal*).
  - `animations.autoscale: boolean`: Gliding autoscale halus saat grafik bergeser.
- **Kondisi Trawangan Saat Ini:**
  - Opsi efek visual WebGL2 ini belum diekspos di tab preferensi atau pengaturan chart.
- **Dampak & Nilai:**
  - Memberikan sentuhan estetika antarmuka modern khas Vela Terminal / Cyberpunk Dark Mode.

---

### J. Pine Table System UI Management (`DrawingTable`, `table.new`)
- **Fakta Vela (Sumber Primer: `dist/options-lMUwmRwh.d.ts:270-318`, `vela-pinets/dist/index.cjs:1265`):**
  - `@luxalgo/vela-pinets` dan engine Vela secara native mendukung Pine tables: `table.new()`, `table.cell()`, `table.merge_cells()` yang dirender di 9 posisi jangkar kanvas.
- **Kondisi Trawangan Saat Ini:**
  - Tabel dirender secara otomatis di kanvas jika dipanggil oleh skrip, namun Trawangan tidak memiliki kontrol pengaturan (toggle show/hide tabel, scaling ukuran teks tabel, atau pergeseran posisi).
- **Dampak & Nilai:**
  - Berguna saat pengguna menjalankan skrip Screener / Multi-Timeframe Dashboard agar tabel tidak menutupi aksi harga lilin.

---

### K. Drawing Tools Native Ergonomics (Clipboard, Settings Popover & Favorites)
- **Fakta Vela (Sumber Primer: `dist/contributions-HGqnNb_P.d.ts:1533-1551`):**
  - `chart.drawings.copyToClipboard(ids)`
  - `chart.drawings.paste()`
  - `chart.drawings.duplicate(ids)`
  - `chart.drawings.openSettings(id)`: Menampilkan dialog properti warna, ketebalan garis, dan level koordinat native.
- **Kondisi Trawangan Saat Ini:**
  - Trawangan menggunakan drawing toolbar berbasis Svelte, namun belum menyambungkan shortcut keyboard clipboard (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`) ke API drawing native Vela.
  - Double-click pada drawing di chart belum memicu dialog settings native.

---

### L. Plugin Architecture Framework (Custom Layers & Contributions)
- **Fakta Vela (Sumber Primer: `dist/plugin-Cr2Pj8q8.d.ts:215-245, 546-675`, `dist/contributions-HGqnNb_P.d.ts:2081-2280`):**
  - `registerChartType(def: ChartTypeDefinition)`: Menambahkan tipe lilin kustom baru (Renko, Kagi, Point & Figure) lengkap dengan `dataEngine` dan `barTransform`.
  - `registerRendererLayer(def: RendererLayerDefinition)`: Menambahkan layer kanvas WebGL2 kustom di bawah (`below-data`) atau di atas (`above-data`) candle, dengan kemampuan `modulateBase` (meredupkan lilin di bawahnya).
  - `registerLegendAction(desc: LegendActionDescriptor)`: Menambahkan tombol aksi kustom langsung pada baris legend indikator (misal tombol "Buka di Pine Editor" atau "Kloning Indikator").
  - `registerSymbolRanking(hook: SymbolRankingHook)`: Mengatur algoritma ranking dan autocomplete di pencarian simbol.
- **Kondisi Trawangan Saat Ini:**
  - Trawangan belum menggunakan sistem registrasi plugin native Vela, melainkan mengandalkan komponen UI eksternal Svelte.
- **Dampak & Nilai:**
  - Mengintegrasikan hook plugin native memungkinkan ekstensi pihak ketiga berjalan langsung di dalam loop render kanvas Vela tanpa overhead DOM wrapper.

---

## 3. Matriks Komparasi Ringkas & Prioritas

| No | Fitur / Subsistem Vela | Status di Vela | Status di Trawangan | Prioritas | Estimasi Kompleksitas |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | **Price Axis Countdown Timer** (`priceScale.countdown`) | ✅ Core Ready | ❌ Belum diekspos | 🔴 **Sangat Tinggi (P1)** | Rendah (Quick Win) |
| 2 | **DataWindow & Cursor Readouts** (`getDataWindowReadout`) | ✅ Core Ready | ❌ Belum ada UI | 🔴 **Sangat Tinggi (P1)** | Sedang |
| 3 | **Pine Script Alerts Telemetry** (`chart.on('alert')`) | ✅ Core Ready | ❌ Belum didengarkan | 🔴 **Sangat Tinggi (P1)** | Sedang |
| 4 | **Visible Range Presets Bar** (`1D`, `1M`, `YTD`, `ALL`) | ✅ Core Ready | ❌ Belum ada UI bar | 🟡 **Tinggi (P2)** | Rendah - Sedang |
| 5 | **Session Zones Pre/Post Market** (`SESSION_PRE/POST`) | ✅ Core Ready | ❌ Belum diaktifkan | 🟡 **Tinggi (P2)** | Sedang (Perlu data bursa) |
| 6 | **Intrabar Tick Replay** (`lowerTimeframeTicks`, `setTicks`) | ✅ Core Ready | ⚠️ Hanya whole bar | 🟡 **Tinggi (P2)** | Sedang |
| 7 | **Drawing Tools Clipboard & Settings Popover** | ✅ Core Ready | ⚠️ Toolbar custom | 🟡 **Tinggi (P2)** | Rendah |
| 8 | **WebGL2 Visual Effects** (`glow`, `liveBar`, `intro`) | ✅ Core Ready | ❌ Belum di preferensi | 🟢 **Menengah (P3)** | Rendah |
| 9 | **Progressive Candle Streaming & BarStore** | ✅ Core Ready | ❌ Monolitik fetch | 🟢 **Menengah (P3)** | Sedang - Tinggi |
| 10 | **Pine Table Dashboard Management** | ✅ Core Ready | ⚠️ Render pasif | 🟢 **Menengah (P3)** | Rendah |
| 11 | **Order Flow Footprints** (`request.footprint`) | ✅ Core Ready | ❌ Belum dioper | 🟢 **Menengah (P3)** | Tinggi (Butuh Data L2) |
| 12 | **Plugin Architecture SDK** (`registerChartType`, dll.) | ✅ Core Ready | ❌ Belum dipakai | ⚪ **Arsitektural (P4)** | Tinggi |

---

## 4. Rekomendasi Rencana Aksi (Next Roadmap)

### Sprint 1: Quick Wins & Trader Daily Utilities (P1)
1. **Countdown Timer Sumbu Harga**: Tambahkan opsi `countdown: true` pada `priceScale` di preferensi chart agar trader dapat langsung melihat sisa waktu bar di samping harga aktif.
2. **DataWindow Sidebar Panel**: Bangun komponen panel samping atau floating HUD yang memanggil `chart.renderer.dataWindowReadout()` saat kursor bergerak untuk menyajikan rincian OHLCV dan seluruh nilai plot indikator secara komprehensif.
3. **Pine Alerts Notification Integration**: Pasang listener `chart.on('alert')` di `chartSessionController.ts` dan hubungkan ke sistem toast dan push notification Tauri (`@tauri-apps/plugin-notification`).

### Sprint 2: Navigation & Market Structure (P2)
1. **Range Presets Bar (Footer)**: Tempatkan bilah chip rentang waktu (`1D`, `5D`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `ALL`) di bagian bawah layar untuk navigasi cepat.
2. **Session Zones untuk Saham AS**: Aktifkan fitur `sessionZones` untuk feed Yahoo Finance dengan shading warna amber pada jam pre-market dan biru pada jam post-market.
3. **Drawing Shortcuts & Settings**: Tautkan shortcut keyboard clipboard (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`) ke `chart.drawings.copyToClipboard()` / `duplicate()`.

### Sprint 3: Deep Engine Polish (P3)
1. **Intrabar Replay Playback**: Sempurnakan `ReplaySession` dengan mengintegrasikan `lowerTimeframeTicks` agar candle bar replay bergerak dinamis tick demi tick.
2. **WebGL2 Visual Polish**: Tambahkan slider pengaturan intensitas `glow` dan opsi animasi pembentukan lilin (`liveBar: true`) di modal pengaturan chart.
