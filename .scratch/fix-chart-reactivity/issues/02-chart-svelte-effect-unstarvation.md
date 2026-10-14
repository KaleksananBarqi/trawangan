# 02: Chart.svelte Svelte 5 Effect Unstarvation & Explicit Signal Tracking

## Parent
Part of #55

## What to build
Memperbaiki reaktivitas di `Chart.svelte` dengan membaca seluruh props secara eksplisit di awal masing-masing `$effect`, menambahkan `$effect` terdedikasi untuk `controller.setTimeframe(timeframe)`, menghilangkan dependensi starvation yang diakibatkan oleh short-circuit `isMounted`, dan mempertahankan ukuran file `< 350 baris`.

## Blocked by
- 01: Core Controller Seam Fixes (#56)

## Status
closed

## Acceptance criteria
- [x] Props `symbol`, `providerId`, `timeframe`, `layout`, `syncConfig`, `themePreset`, `fontSize`, `timezone`, `showCurrentPriceLine`, dan `showWatermark` dibaca tanpa guard di baris pertama `$effect`.
- [x] Tersedia `$effect` terdedikasi untuk `controller.setTimeframe(timeframe)`.
- [x] Pergantian timeframe, simbol, dan layout di UI langsung diteruskan ke controller.
- [x] Komponen `Chart.svelte` tetap berada di bawah 350 baris kode deklaratif (sekarang 347 baris).
- [x] `npx svelte-check --threshold error` menghasilkan 0 error.
