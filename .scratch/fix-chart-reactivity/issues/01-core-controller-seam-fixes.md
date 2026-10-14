# 01: Core Controller Seam Fixes — Timeframe Propagation, Combined setSymbol, and cell:active Listener

## Parent
Part of #55

## What to build
Memperbaiki engine `ChartSessionController` agar pembaruan timeframe terpropagasi nyata ke sel workspace Vela, `setSymbol()` menyelaraskan timeframe jika diberikan, dan event `cell:active` dari VelaWorkspace dipasang untuk memicu `onActiveCellChange`.

## Blocked by
None (can start immediately)

## Status
closed

## Acceptance criteria
- [x] `controller.setTimeframe(tf)` memanggil `cell.setTimeframe(toVelaTimeframe(tf))` pada sel aktif atau seluruh sel (sesuai `syncConfig.timeframe`).
- [x] `controller.setSymbol(symbol, timeframe, providerId)` memperbarui simbol sekaligus menyelaraskan timeframe pada sel jika timeframe disediakan.
- [x] Listener `workspace.on('cell:active')` dipasang pada `attach()` dan memanggil `onActiveCellChange({ symbol, timeframe })`.
- [x] Pengujian reproduksi `tests/chartReactivityRepro.test.ts` berubah dari merah menjadi hijau.
- [x] Seluruh unit test di `tests/chartSessionController.test.ts` lulus 100%.
