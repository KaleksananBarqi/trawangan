# Specification: Drawing Object Deletion, Auto-Fit Scale Fix, and Productivity Shortcut Suite

## Problem Statement

Traders and technical chartists using the trawangan terminal face ergonomic friction and silent command failures in several core keyboard workflows:
1. When a drawing object (trendline, box, horizontal line, Fibonacci, etc.) is selected on the chart canvas, pressing the `Delete` or `Backspace` key incorrectly triggers global `handleUndo()` instead of deleting the selected object. If no object is selected, pressing `Del` or `Backspace` inadvertently undid previous chart actions, corrupting the trader's visual annotations.
2. Pressing `Alt + Z` (and the fast-key `F`) to reset the chart scale and fit historical candles to the screen does not function at all, because the viewport controller invokes an unexposed `.fit()` method on the underlying canvas instance instead of delegating to the native chart cell view reset method.
3. Chartists lack essential high-frequency shortcuts standard in institutional charting platforms:
   - There is no keyboard shortcut to quickly toggle the Unified Object Tree & Indicator Layers dock panel on the right sidebar.
   - There is no shortcut to duplicate or clone selected drawing objects (`Ctrl + D`).
   - There are no shortcuts to bulk toggle visibility (`Alt + K`), lock annotations (`Alt + L`), clear all drawings on the current symbol (`Ctrl + Del`), or invert the vertical price scale (`Alt + I`).

## Solution

1. **Dedicated Selected Object Deletion via Delete / Backspace**: Re-route `draw-delete` in the keyboard command dispatcher to verify whether a drawing object is actively selected in the drawing controller. If selected, delete that exact drawing object (and only that individual node if part of a linked multi-target trading plan); if no object is selected, execute a safe no-op without mutating the undo timeline.
2. **Definitive Viewport Auto-Fit Scaling (`Alt + Z` and `F`)**: Fix the chart scale reset delegation in the chart component to target the active cell's native `resetView()` routine (with fallback to the renderer's `fitContent()`), restoring instantaneous full-history framing and vertical auto-scaling across `Alt + Z`, `F`, and double-clicks on the price scale.
3. **Smart Toggle for Object Tree & Indicators (`Alt + O`)**: Introduce `Alt + O` mapped to the right dock rail's Object Tree & Indicator Layers tab. Employing smart-toggle semantics, pressing `Alt + O` opens the dock directly to the objects tab, switches tabs seamlessly if another tab is active, or closes the dock if the objects tab is already open, while preserving keyboard focus on the chart canvas.
4. **Institutional Shortcut Suite**: Enrich the unified shortcut registry and the keyboard cheatsheet modal with high-value chartist actions:
   - `Ctrl + D`: Duplicate the actively selected drawing with a gentle spatial offset.
   - `Alt + K`: Toggle hide / show for all drawings on the active symbol.
   - `Alt + L`: Toggle lock / unlock for all drawings to prevent accidental dragging.
   - `Ctrl + Del`: Bulk clear all drawings on the current symbol.
   - `Alt + I`: Invert price scale for alternate market perspectives.

## User Stories

1. As a chartist, I want pressing `Delete` or `Backspace` while an object is selected to delete only that object, so that I can clean up invalid trendlines and annotations instantly without using context menus.
2. As a chartist, I want pressing `Delete` or `Backspace` when no drawing is selected to do nothing, so that my previous drawing history is not accidentally undone.
3. As a plan trader, I want deleting a specific target line that belongs to a multi-TP plan to only remove that individual level, so that the rest of my trading plan structure remains intact on the chart.
4. As a trader, I want pressing `Alt + Z` to auto-scale the price axis and fit all loaded candles into the viewport, so that I can immediately regain perspective after zooming or panning far away.
5. As a trader with conflicting OS driver shortcuts (such as NVIDIA GeForce Experience overlay on Windows), I want pressing the single key `F` to execute the exact same auto-fit reset as `Alt + Z`, so that I have a guaranteed collision-free alternative.
6. As a chartist, I want double-clicking the price scale or time scale to auto-scale the view, so that I can navigate seamlessly with mouse actions as well as keyboard shortcuts.
7. As an active analyst, I want to press `Alt + O` to toggle the Unified Object Tree & Indicator panel, so that I can inspect layer hierarchies and indicator settings without taking my hands off the keyboard.
8. As a trader viewing the Watchlist tab, I want pressing `Alt + O` to switch directly to the Object Tree without closing the dock, so that switching panels requires only a single keystroke.
9. As a trader viewing the Object Tree tab, I want pressing `Alt + O` again to close the right dock drawer, so that I can quickly maximize my chart workspace area.
10. As a technical analyst, I want keyboard focus to remain on the chart canvas when opening the Object Tree via `Alt + O`, so that subsequent chart pan, zoom, and drawing keystrokes are immediately received.
11. As a pattern trader drawing parallel channels or support zones, I want to select a line or box and press `Ctrl + D`, so that a duplicate is created instantly with identical visual styles.
12. As a trader preparing clean charts for screenshots, I want to press `Alt + K` to toggle the visibility of all drawings on and off, so that I can inspect naked price action without permanently erasing my work.
13. As a chartist with complex markup, I want to press `Alt + L` to lock all drawings against accidental drag movements, so that panning the canvas remains safe.
14. As an analyst clearing out stale markup, I want to press `Ctrl + Del` to remove all drawings from the active symbol, so that I do not need to click the trash icon on the toolbar.
15. As a crypto trader, I want to press `Alt + I` to invert the price chart upside down, so that I can evaluate market biases from an objective opposite perspective.
16. As a new user, I want all these shortcuts clearly categorized and searchable in the Keyboard Cheatsheet modal (`F1` or `?`), so that I can discover and master terminal hotkeys effortlessly.
17. As a terminal user typing in the symbol search bar or pine script editor, I want drawing and navigation shortcuts suppressed while inputs are focused, so that typing characters does not trigger accidental chart mutations.

## Implementation Decisions

- **Command Dispatcher Registry**: Extend the centralized command registry with standardized definitions for `draw-delete`, `toggle-objects-tree`, `toggle-hide-drawings`, `toggle-lock-drawings`, `clear-all-drawings`, `duplicate-selected-drawing`, and `invert-price-scale`. All shortcuts must enforce `allowInInput: false` to guarantee input element suppression, except where explicitly needed in modals.
- **Drawing Controller Selection & Deletion Seam**: The drawing controller must expose and consume `getSelectedDrawingId()` and `deleteDrawing(id: string)`. The root page handler binds `draw-delete` to query the active selection; if an ID is returned, delete that drawing and register a system log event. If null, return cleanly with no mutation.
- **Drawing Duplication Engine**: In the drawing controller, implement a duplication method that takes the selected drawing ID, copies its geometry and styling properties, applies a slight coordinate offset (either price delta or tick delta) to make the clone immediately discernible, assigns a new unique identifier, selects the cloned drawing, and commits the action to the undo/redo stack.
- **Viewport Reset Delegation Seam**: Update the chart session controller and chart component interface for `fitChart()` to target the active cell in the workspace. The method calls `cell.resetView()`, with defensive fallback to `renderer.resetView()` or `chart.fitContent()`.
- **Right Dock Integration**: The right dock service manages dock visibility and tab switching state. `toggle-objects-tree` delegates directly to `rightDockService.toggleTab('objects')` and transitions workspace modes back to 'terminal' if invoked while in Pine Script mode.
- **Cheatsheet Synchronization**: Because the shortcut cheatsheet modal pulls directly from `commandDispatcher.getCommands()`, all additions in the default command table are automatically rendered, searchable, and grouped by category without duplicate manual markup.

## Testing Decisions

- **Focus on External Behavioral Contracts**: Tests must evaluate the external behaviors of the command dispatcher, drawing controller, and right dock service rather than private implementation details.
- **Dispatcher Keystroke Matching Tests**:
  - Verify that `Delete` and `Backspace` events trigger `draw-delete`.
  - Verify that `Alt + O` dispatches `toggle-objects-tree`.
  - Verify that `Ctrl + D` dispatches `duplicate-selected-drawing`.
  - Verify that `Alt + K`, `Alt + L`, `Ctrl + Del`, and `Alt + I` trigger their respective actions.
  - Verify that none of these shortcuts trigger when the event target is an `HTMLInputElement` or `HTMLTextAreaElement`.
- **Drawing Controller Operations Tests**:
  - Verify that invoking `draw-delete` with an active selection removes the drawing and clears selection.
  - Verify that invoking `draw-delete` with no active selection leaves drawing list and undo history untouched.
  - Verify that `duplicate-selected-drawing` creates a distinct drawing with copied properties, distinct ID, slight offset, and pushes an undo entry.
  - Verify that `bulkHideDrawings`, `bulkLockDrawings`, and `bulkDeleteDrawings` toggle their respective state properties and notify subscribers.
- **Prior Art**: Follow the established testing style in `tests/commandDispatcher.test.ts`, `tests/chartDrawingController.test.ts`, and `tests/rightDockService.test.ts`.

## Out of Scope

- Multi-select lasso box for deleting or duplicating dozens of drawings simultaneously (retained for future multi-selection spec).
- Global customizable hotkey remapping UI (hotkeys remain standardized and deterministic across all client installations).
- Direct brokerage order execution or trading hotkeys (violates the pure charting scope defined in GLOSSARY.md).

## Further Notes

- The fix for `Alt + Z` resolves a long-standing regression where `chart.fit()` was erroneously assumed to be a member of the underlying chart instance.
- Adding `Alt + O` complements `Alt + W` (Watchlist), completing the primary keyboard navigation model for the Right Dock Rail.
