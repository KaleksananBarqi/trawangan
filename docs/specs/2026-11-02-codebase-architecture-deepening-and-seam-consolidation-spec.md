# Specification: Codebase Architecture Deepening and Seam Consolidation

## Problem Statement

As the `trawangan` terminal has rapidly expanded across release cycles, several core subsystems have accumulated architectural friction, shallow pass-through abstractions, and internal seam leakage that degrade testability, navigability, and maintainability:

1. **Shallow Proxy for Command Registry (`shortcutService`)**:
   Keyboard shortcut definitions, physical key normalization, and category groupings are authored inside a deep `CommandDispatcher` module. However, the system maintains a separate 32-line `shortcutService` that acts solely as a pass-through proxy. This introduces a redundant layer of indirection without adding behavioral depth or invariant enforcement, failing the deletion test and introducing testing duplication.

2. **Fragmented 2D Canvas Snapshot Compositing (`chartSnapshotService` & `chartSnapshotOverlayService`)**:
   Capturing branded chart frames and attribution bars is artificially separated across two service boundaries. `chartSnapshotOverlayService` renders price scale badges and floating trading plan cards, while `chartSnapshotService` wraps the outer canvas frame, security watermark, and dedicated side panel. This split causes massive code duplication (over 850 lines of duplicate trading plan card rendering, identical text wrapping, and duplicated `drawRoundedRect` routines). Furthermore, internal canvas helpers (`colorToRgba`, `wrapCanvasText`) are exported and re-exported across the module seam, causing tests to assert on private plumbing rather than user-observable snapshot artifacts.

3. **Duplicated Shell Rail State and Dead Code (`leftToolbarService` & `rightDockService`)**:
   Managing the visibility of the structural left drawing rail and the right dock rail is implemented via two distinct services that duplicate observer subscriptions, persistence logic with localStorage, and snapshot querying. Moreover, `leftToolbarService` exposes an uncalled `handleKeydown` method that is never invoked by the application runtime and exists solely to satisfy its own unit tests, while actual shortcut triggering is already handled by the command dispatcher.

## Solution

Consolidate shallow layers and leaky seams into three robust, deep architectural modules while strictly adhering to domain glossary terminology and architecture decision records (ADR 0004, ADR 0005, ADR 0012, ADR 0013, ADR 0014, ADR 0015):

1. **Direct Deep Command Dispatcher**:
   Eliminate the pass-through `shortcutService` module via the deletion test. Reroute all shortcut glossary consumers (cheatsheet modal, settings help tab) to query `CommandDispatcher` directly as the single source of truth for command discovery, categorization, search filtering, and execution.

2. **Unified Deep Chart Snapshot Engine**:
   Consolidate all 2D snapshot compositing, price badge projection, floating thesis cards, dedicated thesis side panels, security watermarks, and branded frame attribution into a unified `SnapshotCompositor` deep module. Internalize canvas drawing helpers (`colorToRgba`, `wrapCanvasText`, `drawRoundedRect`) as private implementation details behind the seam, eliminating cross-module re-export leaks and deduplicating trading plan canvas rendering.

3. **Unified Workspace Shell Controller**:
   Unify left drawing toolbar rail state, right dock tabs, and terminal/Pine workspace mode transitions into a single deep `WorkspaceShell` module. Eliminate dead keyboard handler methods and provide a single cohesive persistence seam for the desktop shell layout.

---

## User Stories

1. As a technical trader, I want global keyboard shortcuts and cheatsheet glossaries to draw from a single synchronized registry, so that I never experience documentation drift or mismatched key combinations.
2. As a trader, I want to export branded snapshot charts with either floating thesis cards or dedicated side panels, so that my technical analysis setups are captured with identical high-fidelity typography and visual styling regardless of layout mode.
3. As a trader, I want the left drawing tool rail and right dock drawers to remember their collapsed and active states reliably across sessions, so that my customized terminal layout is instantly preserved upon reload.
4. As an open-source contributor, I want a clean, single-point interface for keyboard shortcuts, so that adding a new institutional hotkey requires registering it in only one place.
5. As an open-source contributor, I want 2D canvas snapshot rendering logic to be located in one cohesive module, so that updating brand badges, color presets, or font typography automatically updates both floating and side-panel export variants without duplicate refactoring.
6. As an AI agent pair programming on the codebase, I want deep modules with small interfaces and clear seams, so that I can implement future technical analysis features without navigating through dozens of shallow pass-through services.
7. As a test suite maintainer, I want unit tests to exercise observable outcomes at high-level module interfaces rather than asserting on private canvas helper re-exports, so that internal implementation refactorings do not cause false test failures.
8. As a developer, I want dead keyboard event handlers removed from toolbar services, so that keyboard dispatch flow is deterministic, centralized, and predictable across Windows, Linux, and macOS.
9. As a developer, I want the deletion test applied to redundant proxy services, so that cognitive load and bundle size are permanently minimized.
10. As a performance-conscious trader, I want snapshot generation to execute in a single unified canvas composition pass, so that export latency remains below 100 milliseconds even on 4K HiDPI displays.

---

## Implementation Decisions

### 1. Command Dispatcher Deepening & Shortcut Service Deletion
- Delete the redundant proxy module. All consumers that previously imported from the proxy module will import directly from the Command Dispatcher module.
- The Command Dispatcher module already encapsulates key parsing, modifier normalization (Ctrl vs Cmd, Alt, Shift), input suppression (suppressing hotkeys when focused in search inputs, textareas, or code editors), and action registration.
- The Command Dispatcher module remains the sole test surface for shortcut definitions, category queries, and search filtering. Tests previously asserting on the proxy module are migrated directly to the Command Dispatcher test suite.

### 2. Unified Snapshot Engine & Seam Encapsulation
- Consolidate all snapshot compositing into a single deep engine.
- Establish clean internal seams within the snapshot engine:
  - **Internal Dimension & Layout Math**: Pure geometric calculation of canvas dimensions, padding, header height, footer attribution bar height, and side panel offsets.
  - **Internal Price Scale Badge Renderer**: Renders entry, stop loss, and take profit price tags on the right axis of the snapshot canvas.
  - **Internal Unified Thesis Renderer**: Single reusable 2D canvas layout engine for rendering trading plan thesis cards (bias badges, confidence levels, entry/risk parameters, dynamic R-multiple badges, invalidation scenarios, and context zones). This eliminates the ~850 lines of duplicate canvas code between floating overlays and side panels.
  - **Internal Frame & Watermark Compositor**: Applies branded frame borders, corner radii, background gradients, security watermarks, and attribution metadata.
- Remove helper exports (`colorToRgba`, `wrapCanvasText`, `drawRoundedRect`) from the public module interface. These functions become private implementation details.
- Expose a single, focused, high-leverage external interface:
  ```typescript
  export interface SnapshotCompositionRequest {
    sourceCanvas: HTMLCanvasElement;
    options: SnapshotOptions;
    metadata: SnapshotMetadata;
    thesisData?: ParsedTradingPlan;
    priceBadges?: PriceScaleBadge[];
  }

  export async function compositeChartSnapshot(
    request: SnapshotCompositionRequest
  ): Promise<HTMLCanvasElement>;
  ```

### 3. Unified Workspace Shell Controller
- Consolidate left drawing rail collapse state, right dock open/active tab state, and workspace mode state into a single deep controller.
- Remove the dead `handleKeydown` method from the left toolbar service. Keystroke dispatching for toggling the drawing toolbar (`Alt+T`) remains exclusively governed by the Command Dispatcher invoking the shell controller's toggle action.
- Encapsulate `localStorage` persistence, debouncing, and reactive subscriptions internally so that UI components simply consume a single layout snapshot and dispatch high-level intent actions.

---

## Testing Decisions

- **Testing Principles**:
  - Only test external behavior observable across public module seams; never test internal functions, private helper re-exports, or internal canvas state mutations.
  - All tests must pass in Node.js test runners without requiring a full browser DOM or WebGL canvas engine (using established mock 2D canvas context patterns).
- **Modules Tested**:
  - `CommandDispatcher`: Verified for shortcut registration, key normalization, category grouping, search query filtering, and event dispatch.
  - `SnapshotCompositor`: Verified for canvas dimension calculations, side-by-side vs overlay layouts, branded frame attribution rendering, and security watermark adaptation under light and dark themes.
  - `WorkspaceShell`: Verified for reactive state transitions (rail collapse, dock tabs toggle/close, workspace mode), single-persistence synchronization, and clean rejection of invalid tab states.
- **Prior Art**:
  - `tests/commandDispatcher.test.ts`
  - `tests/chartSnapshotService.test.ts`
  - `tests/sideBySideSnapshotDimensions.test.ts`
  - `tests/sideBySideThesisPanelRenderer.test.ts`
  - `tests/leftToolbarDock.test.ts`

---

## Out of Scope

- Modifying the underlying WebGL2 charting renderer (`@luxalgo/vela`) or the Pine Script worker runtime (`@luxalgo/pinets`).
- Re-architecting the 2583-line `chartDrawingController.ts` drawing tool execution loop (which will be tackled in a dedicated subsequent refactoring milestone).
- Cloud synchronization of workspace layouts or themes (trawangan remains strictly 100% offline-first and local-first).
- External network I/O or server-side screenshot rendering.

---

## Further Notes

- This specification directly resolves technical debt and seam leakages identified during the `/improve-codebase-architecture` review.
- The elimination of `shortcutService` serves as a clean template for future deletion tests on shallow wrappers across the codebase.
- Consolidating the snapshot engine dramatically reduces regression risks when updating trading plan visual components or brand themes.
