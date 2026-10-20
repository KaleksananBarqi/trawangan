# Spec: OHLC Magnet Snapping, Tick-Aligned Price Guard, and Alert Management Revamp

## Problem Statement

Saat ini, pengguna terminal `trawangan` menghadapi dua kendala ergonomis utama pada analisis teknikal dan manajemen sinyal:
1. **Pecahan Desimal Acak (*Floating Point Noise*) Tanpa Snapping**:
   Ketika menggeser garis batas harga (*Draggable Alert Line*) atau mengatur jangkar posisi Long/Short (*Risk/Reward Position Tool*), kalkulasi harga membaca koordinat piksel mentah kanvas. Hal ini menyebabkan angka target memiliki banyak koma desimal acak yang tidak realistis (misal: `$68421.391827419`), serta menyulitkan penempatan level target yang tepat di pucuk jarum lilin (*swing high/low*).
2. **Ketiadaan Akses Edit Manual pada Alert yang Sudah Dibuat**:
   Setelah sebuah alert dibuat, pengguna tidak dapat menyunting kembali target harga atau parameter pemicunya secara manual menggunakan keyboard. Di kanvas grafik, alert hanya bisa digeser atau dihapus, dan di bilah sisi (*Watchlist/Alerts*), tidak ada tombol sunting. Selain itu, form modal alert yang ada saat ini selalu memicu pembuatan alert baru alih-alih memperbarui alert yang sedang dipilih.

## Solution

Mengimplementasikan arsitektur snapping ganda (**Tick-Aligned Price Guard** dan **OHLC Magnet Snapping**) serta merefaktor sistem manajemen alert menjadi alur pengeditan dua arah (*two-way edit*):
1. **Tick-Aligned Price Guard & OHLC Magnet**:
   - Pembulatan harga otomatis yang selalu mematuhi ukuran *tick* bursa atau presisi adaptif berbasis magnitudo nominal harga.
   - Penambatan magnetik interaktif ke titik Open, High, Low, atau Close lilin candlestick terdekat dengan radius toleransi 15 piksel (prioritas High dan Low), dilengkapi indikator pendar visual (*halo dot*) dan pembalik status sementara via tombol penolong `Shift`.
   - Penerapan konsisten pada garis alert dan ketiga jangkar instrumen Long/Short (Entry, Stop Loss, Take Profit).
2. **Revamp Manajemen Alert Dua Arah**:
   - Pemicu edit manual instan melalui *double-click* atau tombol edit pada *badge* kanvas grafik, serta tombol pensil edit pada daftar alert di bilah kanan.
   - Refaktor `CreateAlertModal` menjadi modal terpadu yang memuat data alert lama, memanggil `alertService.updateAlert`, dan menyediakan opsi hapus cepat langsung di dalam modal.

## User Stories

1. As a technical trader, I want dragging an alert line on the chart to automatically snap to the High or Low of nearby candlestick wicks, so that I can set exact breakout or invalidation levels effortlessly.
2. As a trader analyzing small timeframes, I want prices selected via dragging to always be rounded to the active instrument's tick size, so that I don't see ugly numbers with 10 decimal digits.
3. As a user adjusting an alert, I want to double-click the alert badge on the chart canvas, so that a modal opens immediately with the exact current price prefilled for precise keyboard editing.
4. As a user reviewing alerts in the right dock panel, I want an "Edit" button on each alert item, so that I can modify the target price, trigger condition, or label without recreating the alert from scratch.
5. As a trader using the Long/Short position tool, I want the Entry, Stop Loss, and Take Profit lines to magnetically stick to candle highs and lows in real-time, so that my risk-to-reward ratio is calculated with clean, realistic execution levels.
6. As a user dragging an alert line in a dense chart area, I want to hold the `Shift` key to temporarily disable magnet snapping, so that I can place an alert at a custom level without it clinging to nearby candles.
7. As a user with magnet mode disabled in the left toolbar, I want to hold the `Shift` key during drag to temporarily activate magnet snapping, so that I don't have to keep toggling the toolbar button.
8. As a trader observing the chart during a drag gesture, I want to see a visual halo dot on the candle point currently being snapped to, so that I have unmistakable visual confirmation of which price point is locked.
9. As a trader holding low-priced altcoins (e.g., meme tokens with values < $0.001), I want adaptive precision formatting that preserves necessary significant decimals without excessive zero-padding, so that small price movements remain accurate.
10. As a trader editing an existing alert, I want a direct "Delete" button inside the edit modal, so that I can discard the alert immediately if I decide it is no longer relevant while editing.
11. As a user submitting edits to an existing alert, I want the system to preserve its original creation history and identifier while updating target parameters, so that my alert lists and notification references remain intact.
12. As a trader adjusting a Long/Short drawing, I want the projected target and stop values to update smoothly at 60 FPS and cleanly commit upon mouse release, so that the terminal feels fluid and responsive.

## Implementation Decisions

1. **Price Sanitization & Magnet Engine Core**:
   - Provide a pure mathematical calculation module responsible for:
     - Resolving effective tick size from symbol metadata or dynamic magnitude tiers ($\ge 1000 \rightarrow 0.01$; $1 \dots 1000 \rightarrow 0.0001$; $< 1 \rightarrow$ significant decimals).
     - Evaluating candle OHLC proximity within a 15px radius, prioritizing High and Low points over Open and Close.
     - Supporting dynamic modifier inversion (`shiftKey` toggles snap state).
2. **Alert Service Extension**:
   - Ensure `alertService.updateAlert(id, updates)` properly triggers subscriber updates, persists state via storage, and preserves the active/triggered status lifecycle.
3. **Unified Alert Modal (`CreateAlertModal.svelte`)**:
   - Refactor modal state to support dual operation (`mode: 'create' | 'edit'`).
   - In edit mode, prefill existing symbol, targetPrice, condition, frequency, and label.
   - Replace primary action button with "Simpan Perubahan" dispatching `updateAlert`.
   - Provide a secondary danger button "Hapus Alert Ini" calling `deleteAlert`.
4. **Canvas Draggable Alert Line Interaction (`Chart.svelte`)**:
   - Integrate the magnet snapping engine into `handleAlertPointerMove`, tracking snapped target coordinates and rendering a visual halo indicator.
   - Listen to `dblclick` or click on an edit action icon on `.alert-line-badge` to trigger `onRequestEditAlert`.
5. **Right Dock Watchlist Alerts Panel Integration (`WatchlistPanel.svelte`)**:
   - Add an Edit action button (pencil icon) alongside the existing Toggle, Reset, and Delete buttons in the alerts list.
   - Clicking Edit triggers the unified modal in edit mode with the selected alert instance.
6. **Risk/Reward Position Tool Snapping**:
   - Integrate OHLC magnet snapping and tick-aligned quantization into the drag handlers of Entry, Profit Target, and Stop Loss anchors on the Vela position tool.

## Testing Decisions

- **Test Focus (External Behavior over Implementation Details)**:
   - Verify tick size quantization across diverse price magnitudes (high-value Bitcoin, mid-value tokens, sub-cent altcoins).
   - Verify OHLC magnet calculation selects the correct candle point (High/Low priority over Open/Close) within tolerance radius and respects Shift key inversion.
   - Verify `alertService.updateAlert` correctly mutates the alert record, persists changes, and dispatches to subscribers.
   - Verify `CreateAlertModal` invokes `updateAlert` in edit mode and `addAlert` in create mode.
   - Verify regression coverage across existing chart, drawing, and alert test suites.
- **Test Files**:
   - `tests/priceSnapAndTickGuard.test.ts`
   - `tests/alertManagementRevamp.test.ts`
- **Prior Art**:
   - `tests/liveDragPriceScaleLabels.test.ts`
   - `tests/alertNotifications.test.ts`

## Out of Scope

- Automated trade execution or exchange order placement from snapped levels (strictly adheres to Pure Charting Scope in `GLOSSARY.md`).
- Volume profile node snapping (point of control / value area magnet).
- Cross-hair magnetic snapping during passive hover (limited to active drawing and drag gestures).

## Further Notes

- Architecture recorded in `docs/adr/0010-magnet-snapping-and-alert-management-revamp.md`.
- Domain terms registered in `GLOSSARY.md` (`OHLC Magnet Snapping`, `Tick-Aligned Price Guard`, `Draggable Alert Line`).
