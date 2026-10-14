# 04: Multi-Chart Grid Synchronization & Deep Workspace Persistence

**What to build:** Encapsulate multi-chart grid layout switching (single, split horizontal/vertical, 4-grid) and atomic persistence of pane proportions, price scale mode, bar spacing, and chart styles into `ChartSessionController`.

**Blocked by:** 03: Indicator Lifecycle, Zombie Guard & Persistent Price Line Guard Integration (#52)

**Status:** closed

- [x] Implement `setLayout(layout: string)` and `syncLayout(config: MultiChartSyncConfig)` inside `ChartSessionController`.
- [x] Implement atomic snapshotting and restoration methods: `saveWorkspaceState()` and `loadWorkspaceState()` covering `paneWeights`, `priceScaleState`, `priceStyle`, and `barSpacing`.
- [x] Implement programmatic chart settings persistence (`saveCurrentSettingsAsDefault` and `resetSettingsToFactory`) without DOM `MutationObserver` hacks.
- [x] Migrate `tests/multiChartSync.test.ts` from synthetic simulation mocks to testing the real controller interface.
- [x] All tests pass.
