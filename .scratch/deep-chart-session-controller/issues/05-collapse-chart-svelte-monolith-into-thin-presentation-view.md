# 05: Collapse Chart.svelte Monolith into Thin Presentation View

**What to build:** Rewire the primary charting component to delegate 100% of workspace orchestration, cell loops, indicator lifecycle, and layout persistence to `ChartSessionController`, slashing the monolith down from 2,940 lines to under 350 lines of pure declarative Svelte code.

**Blocked by:** 04: Multi-Chart Grid Synchronization & Deep Workspace Persistence (#53)

**Status:** ready-for-agent

- [ ] Connect `Chart.svelte` to `ChartSessionController` via the clean single seam.
- [ ] Remove all direct cell iteration loops, manual MutationObserver DOM injections, and redundant drawing listeners from `Chart.svelte`.
- [ ] Reduce line count of `Chart.svelte` from 2,940 lines to under 350 lines.
- [ ] Verify that all user-facing charting interactions (candlesticks, drawing tools, indicators, draggable alerts, context menu, multi-chart layouts) function smoothly with 60–120 FPS performance.
- [ ] Complete full regression check: all 174+ tests pass.
