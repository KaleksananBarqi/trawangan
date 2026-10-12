# 03: Deep Chart Drawing Controller & Canvas Operations Consolidation

**GitHub Issue:** [#10](https://github.com/KaleksananBarqi/trawangan/issues/10)

**What to build:**
Consolidate drawing tool state, user interaction, canvas adapters, debounced persistence, and drawing operations into a deep `ChartDrawingController` module.
From the user's perspective:
- Activating technical analysis drawing tools (Trendlines, Horizontal lines, Fib Retracement, Position Long/Short, etc.) from the Left Toolbar, Favorites bar, or keyboard shortcuts (`Alt+H`, `Alt+F`, `Alt+M`, `Alt+R`) behaves consistently across single-chart and multi-chart layouts.
- Drawing operations (Undo `Ctrl+Z`, Redo `Ctrl+Y`, Clear All, Lock, Hide/Unhide) execute reliably and persist automatically to SQLite and localStorage with zero lag.
- The 2,658-line `Chart.svelte` sheds 15 imperative pass-through methods (`setDrawingTool`, `setSnapMode`, `setStayMode`, `undoDrawing`, `redoDrawing`, `clearAllDrawings`, `lockAllDrawings`, `hideAllDrawings`, etc.), delegating drawing lifecycle and events to the deep controller.

**Blocked by:** 01 (Deep Keyboard Command Dispatcher & Unified Shortcut Registry / #8)

**Status:** completed

- [x] Implement a deep `ChartDrawingController` module encapsulating drawing state, active tool selection, snap/stay modes, lock/visibility toggles, and persistence debouncing.
- [x] Connect direct integration with Vela's drawing manager engine behind a clean seam inside the drawing controller.
- [x] Bind drawing shortcuts (`Alt+H`, `Alt+F`, `Alt+M`, `Alt+R`, `Ctrl+Z`, `Ctrl+Y`, `Del`) to the drawing controller through the `CommandDispatcher` created in #8.
- [x] Refactor `Chart.svelte` to drop pass-through drawing methods and connect canvas instances to the controller via lifecycle hooks.
- [x] Refactor `DrawingToolbar.svelte` to communicate with the drawing controller through its unified interface rather than passing imperative calls through the root page.
- [x] Add unit tests verifying drawing state transitions, undo/redo handling, and persistence triggers without requiring WebGL rendering.
- [x] Verify all tests pass (`npm test`) and type-checking succeeds (`npm run check` with 0 errors).
