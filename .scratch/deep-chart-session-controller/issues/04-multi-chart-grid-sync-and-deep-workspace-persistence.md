# 04: Multi-Chart Grid Synchronization & Deep Workspace Persistence

**What to build:** Encapsulate multi-chart grid layout switching (single, split horizontal/vertical, 4-grid) and atomic persistence of pane proportions, price scale mode, bar spacing, and chart styles into `ChartSessionController`.

**Blocked by:** 03: Indicator Lifecycle, Zombie Guard & Persistent Price Line Guard Integration (#52)

**Status:** ready-for-agent

- [ ] Implement `setLayout(layout: string)` and `syncLayout(config: MultiChartSyncConfig)` inside `ChartSessionController`.
- [ ] Implement atomic snapshotting and restoration methods: `saveWorkspaceState()` and `loadWorkspaceState()` covering `paneWeights`, `priceScaleState`, `priceStyle`, and `barSpacing`.
- [ ] Implement programmatic chart settings persistence (`saveCurrentSettingsAsDefault` and `resetSettingsToFactory`) without DOM `MutationObserver` hacks.
- [ ] Migrate `tests/multiChartSync.test.ts` from synthetic simulation mocks to testing the real controller interface.
- [ ] All tests pass.
