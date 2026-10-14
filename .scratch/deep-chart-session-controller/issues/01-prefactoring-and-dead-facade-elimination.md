# 01: Prefactoring & Dead Facade Elimination

**What to build:** Clean up obsolete compatibility facades, unused imports, and dead storage layers across the charting subsystem so the codebase is free of dead paths before introducing the new session controller.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] Delete `src/lib/services/drawingStorage.ts` and `src/lib/services/workspaceStorage.ts` (0 active callers in codebase).
- [x] Migrate `PineEditor.svelte` and `Chart.svelte` to import directly from `marketFeed` and `persistence`, then delete `src/lib/services/marketProvider.ts`.
- [x] Remove unused leftover imports in `Chart.svelte` (e.g. `extractDrawingPriceBadges`, `extractIndicatorPriceBadges`).
- [x] All 174 existing tests pass with zero regressions.
