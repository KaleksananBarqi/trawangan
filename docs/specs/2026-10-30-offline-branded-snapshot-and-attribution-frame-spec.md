# Spec: Offline Branded Snapshot Engine and Attribution Frame

## Problem Statement

Pengguna terminal `trawangan` sering membagikan analisis teknikal grafik lilin (*candlestick*) dan konfigurasi indikator mereka ke media sosial (Twitter/X, Telegram, Discord), forum analisis, atau menyimpannya ke jurnal trading pribadi.

Saat ini, pengguna menghadapi beberapa kendala visual dan alur kerja (*friction*):
1. **Ketiadaan Fitur Screenshot Bawaan yang Terintegrasi**:
   Pengguna terpaksa mengandalkan alat tangkapan layar eksternal sistem operasi (seperti Windows Snipping Tool atau shortcut PrintScreen), yang memerlukan langkah pemotongan manual (*crop*), memakan waktu, dan sering menghasilkan batas gambar yang canggung atau tidak rapi.
2. **Ketiadaan Konteks Metadata pada Gambar**:
   Tangkapan layar manual tidak memuat informasi penting mengenai instrumen yang dianalisis—seperti simbol pair aset, interval waktu (*timeframe*), bursa asal (*exchange*), harga penutupan lilin terakhir, dan waktu analisis—sehingga audiens di media sosial sering kali bingung membaca konteks grafik.
3. **Risiko Polusi Visual dari Watermark Konvensional**:
   Banyak platform charting komersial menempatkan cap teks atau logo berukuran besar melintang secara diagonal di tengah kanvas grafik, yang mengaburkan ekor lilin (*wick*), formasi pola harga, dan garis indikator teknikal krusial.
4. **Ketergantungan Cloud & Masalah Privasi di Platform Lain**:
   Layanan tangkapan layar komersial sering mengunggah gambar ke server cloud publik pihak ketiga secara paksa, menimbulkan latensi dan mengorbankan privasi pengguna.

## Solution

Membangun mesin tangkapan layar komposit offline murni (**Offline Branded Snapshot Engine**) dengan konsep **Branded Snapshot Frame** dan **Attribution Bar**:

1. **Branded Snapshot Frame & Attribution Bar**:
   - Membungkus kanvas grafik WebGL2 dengan bingkai kartu gelap minimalis (`#0F0F0F` atau sesuai palet tema aktif), garis tepi luar redup (`1px solid rgba(255, 255, 255, 0.08)`), sudut membulat halus (`12px`), dan padding proporsional (24px) di sekeliling grafik.
   - Menyematkan **Attribution Bar** di bagian bawah grafik yang memisahkan data secara bersih:
     - Sisi Kiri: Monogram resmi `tr` hot pink (`#FF69B4`), tipografi brand `trawangan`, serta badge instrumen (`simbol`, `timeframe`, `nama bursa`).
     - Sisi Kanan: Harga pasar saat tangkapan diambil, stempel waktu lokal pengguna (WIB/UTC), dan tautan terminal `kaleksananbarqi.github.io/trawangan`.
   - Menghilangkan sepenuhnya watermark diagonal yang menutupi candlestick demi menjaga kemurnian analisis (*Pure Charting Scope*).

2. **Dual-Mode Export & Multi-Chart Support**:
   - Mendukung dua mode ekspor: **Branded Frame** (kartu showcase siap bagikan) dan **Clean Chart** (murni piksel kanvas tanpa bingkai luar).
   - Mendukung penangkapan fleksibel: **Chart Aktif Saja** (default) dan **Seluruh Grid Multi-Chart** saat layout multi-grafik aktif.

3. **Ultra-Sharp 2x HiDPI & Alur Cepat (Clipboard-First)**:
   - Komposit dirender pada skala resolusi 2x (HiDPI) agar teks dan garis lilin tetap tajam di layar resolusi tinggi.
   - Alur *Clipboard-First*: menekan tombol kamera atau pintasan global `Ctrl+Shift+S` langsung menyalin gambar format PNG ke clipboard sistem via Clipboard API, disertai notifikasi toast visual yang elegan.
   - Menyediakan modal pratinjau interaktif (`SnapshotPreviewModal`) untuk meninjau gambar, mengubah opsi toggle bingkai, atau mengunduh file PNG dengan nama terstruktur (`trawangan-[symbol]-[tf]-[timestamp].png`).

4. **100% Offline & Persistensi Preferensi Lokal**:
   - Seluruh proses perakitan gambar berjalan di memori lokal klien tanpa koneksi server eksternal dan tanpa telemetri.
   - Preferensi snapshot tersimpan secara otomatis di `appSettings` lokal.

## User Stories

1. As a cryptocurrency trader, I want to capture a screenshot of my chart using a single keyboard shortcut (`Ctrl+Shift+S`), so that I can share my market setup instantly without opening external screenshot utilities.
2. As a social media content creator, I want my chart screenshots to be beautifully framed with a sleek dark card background, subtle border, and rounded corners, so that my posted charts look modern and professional on Twitter/X and Telegram.
3. As a technical analyst, I want the candlestick area to remain 100% free of diagonal watermarks, so that neither wicks nor key levels are obscured.
4. As a trader sharing setups with a community, I want an Attribution Bar below the chart containing the asset pair, timeframe, exchange, current price, and timestamp, so that viewers immediately understand the exact context of the analysis.
5. As an educator writing technical reports, I want a toggle to export a "Clean Chart" without the branded frame or attribution footer, so that I can embed pure chart graphics into articles and slides.
6. As a multi-chart user analyzing correlations or multi-timeframe setups, I want an option to capture the entire multi-chart grid layout in a single unified image, so that I don't have to stitch individual charts together manually.
7. As a trader on a mobile device or high-resolution display, I want the snapshot to be generated at 2x HiDPI resolution, so that numbers, indicators, and candle wicks remain crisp when zoomed in.
8. As a fast-paced intraday trader, I want pressing `Ctrl+Shift+S` to copy the PNG directly to my system clipboard, so that I can immediately paste (`Ctrl+V`) into a Discord channel or Telegram chat in less than 2 seconds.
9. As a user whose clipboard write is completed, I want an unobtrusive toast notification confirming that the image was copied, with a quick action button to preview or save the image as a file.
10. As a desktop user, I want a dedicated Camera icon button in the top-right header next to Indicator and Settings, so that the snapshot feature is immediately discoverable and accessible via mouse.
11. As a user clicking the Camera icon in the header, I want a dropdown menu offering "Salin Gambar ke Clipboard", "Simpan Gambar (PNG)", and "Pratinjau & Kustomisasi...", so that I can choose my desired action effortlessly.
12. As a user who wants to inspect the image before saving, I want a Snapshot Preview Modal showing an interactive preview of the final rendered card with zoom/pan and export action buttons.
13. As a trader with a preferred export style (e.g., always Branded Frame with price and timestamp), I want the application to remember my snapshot settings across sessions in local storage, so that I don't have to reconfigure them every time.
14. As an Indonesian trader, I want timestamps in the attribution footer to display in my chosen local timezone (e.g., WIB / Asia/Jakarta) by default, so that time references match my operational day.
15. As a privacy-conscious trader, I want all image rendering and file creation to execute completely offline on my local machine without uploading anything to the internet or external servers.
16. As a user organizing my trade records, I want downloaded snapshot files to follow a clean, consistent naming convention (`trawangan-[symbol]-[timeframe]-[timestamp].png`), so that my screenshot folder stays organized chronologically.
17. As a user whose system clipboard API is blocked or denied permission by the OS/browser, I want an automatic fallback that triggers file download and notifies me gracefully, so that I never lose my captured chart.

## Implementation Decisions

1. **Snapshot Compositor Service (`chartSnapshotService`)**:
   - Provide a specialized utility service responsible for:
     - Capturing the active WebGL2 canvas or full multi-chart workspace raster from the Vela workspace instance (`workspace.screenshotCanvas()`, `workspace.screenshot()`, or individual cell renderers).
     - Assembling an offscreen 2D HTML5 Canvas at 2x scale:
       - Rendering the outer container background adhering to the active theme palette (`#0F0F0F` default).
       - Drawing the chart raster with 24px inner padding and rounded corner clipping.
       - Rendering the Attribution Bar at the bottom containing:
         - Left: SVG/Canvas drawn `tr` monogram (hot pink `#FF69B4`), bold `trawangan` wordmark, and instrument badge (`[SYMBOL] · [TF] · [PROVIDER]`).
         - Right: Last close price formatted with symbol-appropriate precision, localized timestamp with timezone indicator, and website link (`kaleksananbarqi.github.io/trawangan`).
     - Providing high-level orchestration methods:
       - `captureSnapshot(options)`: Generates composite canvas / blob.
       - `copySnapshotToClipboard(options)`: Copies PNG blob via Clipboard API.
       - `downloadSnapshot(options)`: Triggers native file download.

2. **Header Camera Button & Actions Dropdown (`Header.svelte` & `SnapshotMenu.svelte`)**:
   - Place a `Camera` icon action button in the right actions section of `Header.svelte`.
   - Clicking opens a compact dropdown with options:
     - *Salin Gambar ke Clipboard* (Shortcut `Ctrl+Shift+S`)
     - *Simpan Gambar PNG*
     - *Pratinjau & Kustomisasi...*
   - Register global keyboard shortcut `Ctrl+Shift+S` via `commandDispatcher` / global window listener to trigger quick clipboard capture.

3. **Snapshot Preview Modal (`SnapshotPreviewModal.svelte`)**:
   - Interactive dialog displaying the rendered snapshot.
   - Controls:
     - Toggle *Branded Frame* vs *Clean Chart*.
     - Scope selector: *Chart Aktif* vs *Seluruh Grid* (when multi-chart layout is active).
     - Toggles for *Sertakan Harga* and *Sertakan Waktu*.
     - Action buttons: "Salin ke Clipboard" and "Unduh File PNG".

4. **Floating Feedback Toast Notification**:
   - Display a lightweight toast message upon successful capture: *"Snapshot disalin ke clipboard!"* with a preview thumbnail and a "Buka Pratinjau" action button.
   - Automatically auto-dismiss after 4 seconds.

5. **Persistence Integration (`appSettings`)**:
   - Extend `AppSettings` interface with snapshot preferences:
     - `snapshotIncludeFrame: boolean` (default `true`)
     - `snapshotIncludePrice: boolean` (default `true`)
     - `snapshotIncludeTimestamp: boolean` (default `true`)
     - `snapshotScope: 'active' | 'all'` (default `'active'`)
   - Persist changes to local SQLite database via `saveAppSettings`.

## Testing Decisions

- **Test Seam (Single Highest Point)**:
  - The primary test seam is the `chartSnapshotService` module:
    - Tested via unit tests with a mock canvas and simulated chart dimensions.
    - Tests verify external behavior: correct composite dimensions calculation (frame vs clean), accurate attribution text formatting, correct filename generation, proper fallback handling for clipboard errors, and preference persistence.
- **Modules to be Tested**:
  - `src/lib/services/chartSnapshotService.ts`
  - Integration with `commandDispatcher` for `Ctrl+Shift+S` shortcut execution.
- **Prior Art**:
  - `tests/chartThemeCandleSync.test.ts` (canvas theme rendering verification).
  - `tests/clipboardWatcherService.test.ts` (clipboard interaction testing).
  - `tests/priceScaleLabels.test.ts` (price formatting and tick-alignment testing).

## Out of Scope

- Cloud hosting or automated upload to external image sharing services (Imgur, Cloudinary, Twitter API).
- Video recording or animated GIF generation of price action.
- Proprietary watermark encryption or steganography.
- Automatic social media bot posting from desktop.

## Further Notes

- Architecture decision recorded in `docs/adr/0012-offline-branded-snapshot-engine-and-attribution-frame.md`.
- Domain terms recorded in `GLOSSARY.md` (`Branded Snapshot Frame`, `Clean Chart Export`, `Attribution Bar`, `Quick Snapshot Action`).
