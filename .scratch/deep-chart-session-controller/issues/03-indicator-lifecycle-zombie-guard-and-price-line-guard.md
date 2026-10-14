# 03: Indicator Lifecycle, Zombie Guard & Persistent Price Line Guard Integration

**What to build:** Integrate indicator registration, zombie-free removal, visibility toggling, and the persistent price line guard into `ChartSessionController` so callers and UI components never have to manually iterate over workspace cells or pass cell-retrieval callbacks.

**Blocked by:** 02: Core ChartSessionController Engine & Headless Lifecycle Seam (#51)

**Status:** ready-for-agent

- [ ] Move indicator synchronization methods (`addIndicator`, `removeIndicator`, `toggleIndicatorVisibility`, `updateIndicatorInputs`, `clearAllIndicators`) into `ChartSessionController`.
- [ ] Eliminate the requirement for callers to pass `getAllWorkspaceCells` callbacks or cell arrays.
- [ ] Integrate `Persistent Price Line Guard` inside `ChartSessionController` so that `currentPriceLine: true` is defensively asserted across `applyConfig` and cell creation events.
- [ ] Migrate `tests/indicatorLifecycle.test.ts` and `tests/chartPriceLineGuard.test.ts` to test `ChartSessionController` directly at the seam.
- [ ] All tests pass.
