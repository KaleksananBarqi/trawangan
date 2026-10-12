# 04: Extract Real-Time Price Scale Overlay Controller from Chart Viewport

**GitHub Issue:** [#11](https://github.com/KaleksananBarqi/trawangan/issues/11)

**What to build:**
Extract dynamic price scale badge calculations, real-time coordinate transformations, live pointer drag tracking, and price alert line overlays from `Chart.svelte` into a dedicated `PriceScaleOverlayController` module.
From the user's perspective:
- As technical analysis drawings (Horizontal Lines, Long/Short Risk-Reward position tools) are placed or dragged live on the canvas, corresponding color-coded price badges on the right price scale update synchronously at 60 FPS without lag.
- Price alerts and indicator badges continue to align precisely with current price scale movements and viewport panning/zooming.
- `Chart.svelte` drops hundreds of lines of RAF loop logic, DOM overlay positioning calculations, and pointer drag event listeners, keeping its focus purely on WebGL2 canvas viewport rendering.

**Blocked by:** 03 (Deep Chart Drawing Controller & Canvas Operations Consolidation / #10)

**Status:** completed

- [x] Create a dedicated `PriceScaleOverlayController` module to manage badge state, live coordinate conversion (price-to-Y math), and alert threshold tracking.
- [x] Connect live dragging mutation hooks and drawing updates directly between `ChartDrawingController` (#10) and `PriceScaleOverlayController`.
- [x] Move the 60 FPS `requestAnimationFrame` sync loop and badge DOM overlay positioning out of `Chart.svelte` into the overlay module.
- [x] Add unit tests verifying price-to-Y conversion math, micro-precision crypto formatting, and live drag coordinate updates without requiring WebGL canvas context.
- [x] Verify all existing test suites pass (`npm test`) and type-checking succeeds (`npm run check` with 0 errors).
