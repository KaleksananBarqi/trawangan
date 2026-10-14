# Specification: Deep ChartSessionController, Workspace Orchestration, and Monolith View Collapse

## Problem Statement

Technical analysts, chartists, and terminal maintainers face serious friction, performance regressions, and architectural instability when interacting with the charting surface of `trawangan`:

1. **Monolithic Presentation Layer and Leaky Orchestration:**
   - The primary charting view component has expanded into a massive monolithic file (> 2,900 lines) carrying excessive responsibilities: low-level WebGL2 canvas attachment, multi-cell workspace iteration loops, manual DOM mutation observation (`MutationObserver` DOM node injection), indicator zombie-state tracking, drawing synchronization callbacks, and direct coordinate calculations.
   - Because the presentation layer is tightly coupled to browser-specific DOM elements, window events, and canvas context, automated test suites cannot test core charting behaviors directly. Test files are forced to re-implement and simulate internal component logic rather than testing across a real architectural seam.

2. **Scattered Workspace Persistence and Silent State Resets:**
   - Visual workspace state—including pane proportions (the vertical ratio between the primary candlestick canvas and oscillator sub-panes), price scale modes (linear vs. logarithmic), horizontal bar spacing, chart default configs, and timezones—is updated through disparate ad-hoc functions scattered throughout the presentation view.
   - When switching multi-chart grid layouts (e.g., from a single chart to 2-grid or 4-grid layouts) or reloading sessions, indicators and drawing layers risk being desynchronized or resurrected as ghost instances ("zombie indicators") due to the lack of a centralized session lifecycle manager.

3. **Duplicated Event Listeners and Wasteful Render Invalidation:**
   - Drawing mutations and indicator state events trigger multiple uncoordinated update cycles, causing redundant recalculations of price scale overlay coordinates and risking frame drops below the mandatory 60–120 FPS performance budget.

---

## Solution

1. **Consolidate Behind a Deep Module Seam (`ChartSessionController`):**
   - Introduce a high-leverage, deep non-UI controller that encapsulates the entire charting session lifecycle: WebGL2 workspace initialization, multi-cell event coordination, multi-chart synchronization, indicator lifecycle management, drawing state synchronization, and persistent workspace layout handling.
   - Collapse the presentation view into a lightweight, surgical presentation component (< 350 lines) that solely provides the WebGL2 canvas container element, passes high-level props, and delegates 100% of charting orchestration to the controller.

2. **Unified Single Test Surface:**
   - The public interface of the session controller becomes the canonical test seam for both production UI and headless test suites.
   - Test suites (`multiChartSync`, `indicatorLifecycle`, `chartPriceLineGuard`) exercise the actual production session controller directly without needing to mount heavyweight Svelte DOM components or fabricate mock simulations.

3. **Atomic Workspace Snapshot & Layout Persistence:**
   - Encapsulate the capture and restoration of `paneWeights`, `priceScaleState`, `priceStyle`, `barSpacing`, and `activeIndicators` inside the controller, ensuring a single atomic round-trip during workspace save and load operations.

---

## User Stories

1. As a technical analyst, I want the charting terminal to initialize instantly (< 1.0 second cold startup), so that I can begin analyzing market structures without latency.
2. As a trader using multi-chart grid layouts (single, 2-cell vertical, 2-cell horizontal, 4-grid), I want my layout, active indicators, and drawings to synchronize seamlessly across all active cells, so that I maintain visual consistency across all perspectives.
3. As a chartist, I want my oscillator sub-pane proportions (e.g., RSI, MACD, Stochastic) to be restored exactly as I configured them when reloading a saved workspace, so that I never have to manually readjust pane splitter heights.
4. As a trader analyzing volatile crypto pairs, I want the persistent price line guard to remain active and locked across all layout switches, timeframe changes, and preset theme transitions, so that the live market price is never lost.
5. As a Pine Script developer, I want custom indicators compiled in the dedicated Web Worker to attach cleanly to multi-cell workspaces without creating ghost or duplicate indicator entries, so that my memory consumption remains strictly within the 60–80 MB idle footprint budget.
6. As a chartist deleting an indicator from the chart, I want the removal to cleanly purge all internal engine handles and memory references across every active cell, so that zombie indicators cannot reappear on subsequent workspace loads.
7. As a technical analyst switching between candlestick, Heikin Ashi, and bar chart styles, I want my visual preferences to persist reliably across sessions without requiring manual re-selection.
8. As a price-action trader utilizing draggable alert lines on the canvas, I want pointer drag operations to update target price levels reactively at 60 FPS without dropping frames or stalling canvas rendering.
9. As an Indonesian crypto trader analyzing Indodax IDR pairs, I want the chart price scale to automatically format large numbers with localized thousand separators and appropriate decimal precision, so that price levels are clear and unambiguous.
10. As a multi-timeframe analyst, I want the active timezone preference (e.g., `Asia/Jakarta` UTC+7) to propagate reactively across all workspace cells and time axes, so that bar opening and closing timestamps match my local trading hours.
11. As a trader saving customized chart visual settings as default, I want the configuration to apply automatically to all future newly opened cells without fragile DOM observer hacks, so that my customized appearance is guaranteed.
12. As a power user rapidly switching timeframes using keyboard shortcuts, I want the chart controller to debounce and batch state mutations, so that rapid keystrokes do not trigger memory leaks or corrupted state trees.
13. As a user experiencing ISP blocking or temporary exchange endpoint disconnections, I want the charting session to surface a clean feed connection guard warning with one-click failover to backup providers without crashing the canvas.
14. As an automated test runner in CI, I want to instantiate the charting session headlessly, so that complete multi-chart synchronization and indicator lifecycle tests execute in milliseconds without a browser DOM.
15. As a core maintainer, I want all chart session logic localized in one deep module, so that any bugs related to multi-chart synchronization or layout restoration can be fixed once and verified everywhere.
16. As a developer adding a new chart feature, I want a clean, single-point interface to interact with the charting workspace, so that I do not need to understand or modify low-level Vela cell loops.
17. As a chartist who accidentally closes the application, I want the terminal's auto-save engine to capture the exact layout, drawings, and indicators before unmount, so that my work is never lost.
18. As a user switching between Terminal and Pine IDE modes, I want the chart canvas to resize smoothly without losing drawing coordinates or resetting horizontal zoom levels.
19. As a trader drawing technical setups with 68+ analytical tools, I want drawing creation, editing, and deletion to automatically synchronize with persistent storage without stalling the main UI thread.
20. As a developer reviewing pull requests, I want the main chart presentation component to remain under 350 lines of clear presentation code, so that code reviews are straightforward and maintainable.

---

## Implementation Decisions

1. **Core Architectural Seam:**
   - The architectural seam is established between the presentation layer (the user interface component) and the charting session engine.
   - The session controller exposes a lean, high-leverage interface that accepts a canvas container reference and configuration options, while encapsulating all internal workspace cells, event listeners, and engine calls behind the seam:

```typescript
// Proposed Seam Interface (encapsulating workspace complexity)
export interface IChartSessionController {
  attach(container: HTMLElement | null, options: ChartSessionOptions): () => void;
  setSymbol(symbol: string, timeframe: string, providerId: string): Promise<void>;
  setLayout(layout: string): void;
  syncLayout(config: MultiChartSyncConfig): void;
  setTimezone(timezone: string): void;
  setThemePreset(themeId: string): void;
  saveWorkspace(): Promise<SavedWorkspaceSnapshot>;
  loadWorkspace(snapshot: SavedWorkspaceSnapshot): Promise<void>;
  saveCurrentSettingsAsDefault(): Promise<boolean>;
  resetSettingsToFactory(): Promise<void>;
  destroy(): void;
  subscribe(listener: (state: ChartSessionStateSnapshot) => void): () => void;
}
```

2. **Internal Subsystem Encapsulation:**
   - The session controller internally hosts and coordinates:
     - **Cell Multi-Chart Synchronization Engine:** Manages cell iteration loops, crosshair broadcasting, viewport alignment, and multi-cell symbol routing.
     - **Indicator Lifecycle & Zombie Guard:** Wraps the indicator registry, ensures handles across all active cells are cleaned up atomically upon removal, and guards against ghost indicators during session load.
     - **Drawing Session Integration:** Coordinates drawing mutations and debounced storage dispatching with the drawing controller.
     - **Price Scale & Overlay Scheduler:** Schedules coordinate mapping and RAF 60 FPS updates for draggable alert lines and price badges.
     - **Persistent Price Line Guard:** Enforces `scene.showPriceLine = true` across all configuration changes and cell lifecycle events.
     - **Workspace Layout Engine:** Manages pane weights, price scale mode, bar spacing, and visual style restoration.

3. **Thin Presentation Layer (`Chart.svelte`):**
   - Strips out all direct cell traversal loops, DOM mutation observers, indicator registration loops, and coordinate math from the Svelte component.
   - The Svelte view becomes a pure declarative shell that renders the container `div`, binds context menu and alert overlay DOM elements based on reactive controller state snapshots, and calls controller methods in response to user gestures.

4. **Elimination of DOM Injection Observers:**
   - Replace the fragile `MutationObserver` that monitored `document.body` for `.vela-dialog--settings` to inject raw HTML buttons with a clean, programmatic configuration API provided directly by the session controller.

---

## Testing Decisions

- **Testing Principles:** Tests MUST only exercise external behavior across the architectural seam. Tests must NOT inspect private implementation state, mock internal loops, or rely on synthetic browser DOM implementations.
- **Modules to Test:**
  - `tests/chartSessionController.test.ts`: Test the full lifecycle of the controller—attaching to a container, switching symbols, updating layouts, applying multi-chart synchronization policies, and tearing down cleanly.
  - `tests/multiChartSync.test.ts`: Migrate to test multi-cell synchronization through the real controller interface, eliminating previous synthetic simulations.
  - `tests/indicatorLifecycle.test.ts`: Verify that indicator registration, visibility toggling, input updating, and removal across multi-cell setups operate atomically and leave zero zombie references.
  - `tests/chartPriceLineGuard.test.ts`: Test that the persistent price line guard strictly retains `currentPriceLine: true` across layout mutations and config patches through the controller interface.
- **Prior Art:** Existing suites `tests/multiChartSync.test.ts`, `tests/indicatorLifecycle.test.ts`, and `tests/chartDrawingController.test.ts`.

---

## Out of Scope

- Implementing automated order placement, trade execution, or crypto wallet connectivity (strictly prohibited by Pure Charting Scope in `GLOSSARY.md` and ADR 0003).
- Modifying the underlying WebGL2 shader pipelines of the third-party `@luxalgo/vela` engine.
- Altering the docked structural shell layout geometry or right dock rail navigation.

---

## Further Notes

- Adheres strictly to the architectural principles of `codebase-design`: high depth, minimal interface surface, strong locality, and a single canonical test seam.
- Domain terminology strictly follows [`GLOSSARY.md`](file:///c:/Projek/Trawangan/GLOSSARY.md) and ADRs 0003, 0004, and 0005.
