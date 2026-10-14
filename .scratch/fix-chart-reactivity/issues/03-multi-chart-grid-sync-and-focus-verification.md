# 03: End-to-End Multi-Chart Grid Layout & Cell Focus Synchronization Verification

## Parent
Part of #55

## What to build
Memvalidasi integrasi end-to-end pergantian layout grid multi-chart (tambah/kurang grid 1, 2, 2h, 4) bersama sinkronisasi klik sel aktif `cell:active`, price line guard, dan verifikasi menyeluruh 182+ tes lulus 100%.

## Blocked by
- 02: Chart.svelte Svelte 5 Effect Unstarvation

## Status
ready-for-agent

## Acceptance criteria
- [ ] Membuka layout 2 atau 4 menata ulang sel grafik secara responsif.
- [ ] Mengklik sel yang berbeda memperbarui status simbol dan timeframe di top header via `onActiveCellChange`.
- [ ] Garis harga terkini (price line guard) tetap aktif di seluruh sel baru.
- [ ] Seluruh 182+ unit tests di 24 suites lulus 100% tanpa regresi.
