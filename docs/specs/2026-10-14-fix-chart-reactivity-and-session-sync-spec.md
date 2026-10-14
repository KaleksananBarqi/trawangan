# Spec: Fix Chart Reactivity, Timeframe Switching, Multi-Chart Layouts, and Symbol Routing

## Problem Statement

Setelah perampingan `Chart.svelte` menjadi komponen presentasi tipis (< 350 baris), pengguna menghadapi tiga masalah fungsional kritis:
1. **Pergantian Timeframe Tidak Berfungsi:** Mengubah interval timeframe dari header (misal: 15m ke 1h) tidak mengubah resolusi lilin pada kanvas WebGL Vela.
2. **Pergantian Tata Letak Grid Multi-Chart Tidak Berfungsi:** Memilih opsi layout grid (1, 2, 2h, 4 sel) tidak memicu penataan ulang sel grafik di workspace.
3. **Pergantian Simbol Tidak Berfungsi:** Memilih koin baru dari Watchlist atau Modal Pencarian Simbol tidak memperbarui pasangan aset pada grafik aktif.

Ketiga masalah ini berakar dari:
- **Svelte 5 Dynamic Dependency Starvation:** Penggunaan `if (isMounted)` pada `$effect` di mana `isMounted` merupakan variabel non-reaktif (`let isMounted = false`). Pada run awal sebelum `onMount`, seluruh blok kode di dalam `if` dilewati sehingga runtime Svelte 5 tidak pernah mendaftarkan props `symbol`, `timeframe`, dan `layout` sebagai dependensi reaktif.
- **Pemutusan Seam `setTimeframe`:** Tidak adanya pemanggilan terdedikasi `controller.setTimeframe(timeframe)` pada `$effect` `Chart.svelte`, serta method `setSymbol()` di `ChartSessionController` yang tidak menyelaraskan timeframe pada sel aktif.
- **Ketiadaan Listener `cell:active`:** Belum dipasangnya listener `cell:active` pada `ChartSessionController.attach()`, menyebabkan seleksi sel multi-chart tidak tersinkronisasi kembali ke header `+page.svelte`.

## Solution

Mengembalikan reaktivitas penuh pada antarmuka grafik desktop Trawangan dengan:
1. **Mengaktifkan Runtime Tracking Svelte 5 di `Chart.svelte`:**
   - Membaca sinyal props (`symbol`, `timeframe`, `layout`, `syncConfig`, dsb.) di lingkup terluar masing-masing `$effect` sebelum pemeriksaan status `controller.isAttached()`.
   - Mengubah `isMounted` menjadi state reaktif `$state(false)` atau mengandalkan status keterikatan controller `controller.isAttached()`.
   - Menyediakan `$effect` terdedikasi untuk `controller.setTimeframe(timeframe)`.
2. **Memulihkan Propagasi Seam Timeframe & Simbol pada `ChartSessionController`:**
   - Menghubungkan pembaruan `timeframe` langsung ke `cell.setTimeframe()` di seluruh sel atau sel aktif sesuai `syncConfig.timeframe`.
   - Menyempurnakan `setSymbol()` agar memperbarui simbol sekaligus menyelaraskan timeframe jika diberikan.
3. **Menghubungkan Event Seleksi Sel `cell:active`:**
   - Memasang listener `workspace.on('cell:active')` pada `ChartSessionController.attach()` untuk memicu callback `onActiveCellChange({ symbol, timeframe })`.

## User Stories

1. As a trader, I want to change the active timeframe from the header toolbar (1m, 5m, 15m, 1h, 4h, 1D), so that the chart canvas immediately re-renders candles at the selected interval.
2. As a trader, I want keyboard shortcuts for timeframes (e.g. numeric keys or dropdown) to update the chart timeframe instantly.
3. As a trader, I want selecting a new asset pair from the Watchlist or Search Modal to immediately change the symbol and feed provider on the active chart.
4. As a trader, I want automatic exchange routing (Binance for USDT/.P, Indodax for IDR) to update the active chart seamlessly when clicking crypto pairs.
5. As a trader, I want to select a multi-chart layout (2 horizontal, 2 vertical, 4 grid) from the header, so that the canvas immediately splits into multiple independent charts.
6. As a trader, I want to switch back to a single chart layout (layout 1), so that the canvas cleanly collapses to one active chart while preserving indicators.
7. As a trader, I want clicking an inactive cell in a multi-chart layout to update the header symbol and timeframe badges, so that I know which chart is currently active.
8. As a trader, I want timeframe synchronization across all cells when `syncConfig.timeframe` is enabled, so that multi-chart layouts show identical timeframes.
9. As a trader, I want symbol synchronization across all cells when `syncConfig.symbol` is enabled, so that multi-chart layouts analyze the same asset across different timeframes.
10. As a trader, I want persistent price line guard to remain intact across symbol, timeframe, and layout changes, so that the current price line never flickers or disappears.

## Implementation Decisions

1. **Explicit Prop Reading in Svelte 5 Effects:**
   Setiap `$effect` di `Chart.svelte` akan membaca nilai prop di baris pertama tanpa guard:
   ```svelte
   $effect(() => {
     const curTf = timeframe;
     if (controller.isAttached()) {
       controller.setTimeframe(curTf);
     }
   });
   ```
   Hal ini menjamin bahwa compiler Svelte 5 selalu mendaftarkan prop tersebut sebagai dependensi aktif pada grafik reaktivitas.

2. **Seam `setTimeframe` Propagasi Menyeluruh:**
   `ChartSessionController.setTimeframe(tf)` akan:
   - Mengonversi format ke internal Vela via `toVelaTimeframe(tf)`.
   - Jika `syncConfig.timeframe` aktif: mengiterasi seluruh sel aktif via `this.getAllCells()` dan memanggil `cell.setTimeframe()`.
   - Jika `syncConfig.timeframe` tidak aktif: memanggil `this.workspace.active.setTimeframe()`.
   - Memicu `this.notify()` dan memverifikasi price line guard.

3. **Penyempurnaan `setSymbol` Seam:**
   `ChartSessionController.setSymbol(symbol, timeframe, providerId)` akan:
   - Menyelesaikan format bursa via `resolveVelaSymbol()`.
   - Mengubah simbol pada seluruh sel (jika `syncConfig.symbol` aktif) atau pada sel aktif.
   - Jika argumen `timeframe` diberikan dan berbeda dari timeframe sel saat ini, otomatis memanggil `setTimeframe()` untuk memastikan konsistensi.

4. **Integrasi Listener `cell:active`:**
   Pada `ChartSessionController.attach()`:
   - Memasang `this.workspace.on('cell:active', (ev: any) => { ... })`.
   - Membaca simbol dan timeframe dari sel aktif yang baru, menormalkan string (`binance:BTCUSDT` -> `BTCUSDT`), dan memanggil `this.onActiveCellChange({ symbol, timeframe })`.

## Testing Decisions

- **Spesifikasi Pengujian Bebas DOM / Headless Seam:** Menguji perilaku eksternal controller melalui dependency injection `workspaceFactory` tanpa ketergantungan pada browser asli.
- **Skenario Pengujian Kritis:**
  1. Pergantian timeframe dari '15m' ke '1h' dan '1D' harus mengubah timeframe pada sel aktif workspace Vela.
  2. Pemanggilan `setSymbol` dengan timeframe baru harus mengubah kedua atribut simbol dan timeframe pada sel workspace.
  3. Pergantian layout dari '1' ke '2' atau '4' harus memicu `workspace.setLayout()` dan menghasilkan jumlah sel yang sesuai.
  4. Event `cell:active` pada workspace harus memanggil callback `onActiveCellChange` dengan simbol dan timeframe yang bersih.
- **Prior Art:** Memperluas suite pengujian [`tests/chartSessionController.test.ts`](file:///c:/Projek/Trawangan/tests/chartSessionController.test.ts) dan memigrasikan reproduksi [`tests/chartReactivityRepro.test.ts`](file:///c:/Projek/Trawangan/tests/chartReactivityRepro.test.ts).

## Out of Scope

- Penambahan varian layout baru selain 1, 2, 2h, dan 4.
- Pengubahan arsitektur provider WebSocket feed bursa.
- Perubahan antarmuka modal pengaturan chart atau drawing toolbar.

## Further Notes

- Seluruh perbaikan harus mempertahankan batasan baris `Chart.svelte` tetap berada di bawah target **< 350 baris**.
- Validasi wajib lolos 100% pada `npx svelte-check --threshold error` dan seluruh unit test `npm test`.
