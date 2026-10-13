# Specification: Defensive Current Price Line Engine, Hand-Pull Pan Navigation, and Zero-Omission Drawing Suite

## Problem Statement

Technical analysts and traders using the `trawangan` charting terminal encounter three significant impediments to their charting workflow:

1. **Flaky and Disappearing Current Price Line:**
   - The horizontal current price line (last price line) indicating the live market price frequently vanishes or fails to appear entirely on the WebGL2 canvas.
   - Root-cause analysis reveals that whenever canvas configurations are updated (such as changing timeframes, switching layout splits, adjusting scale margins, applying theme presets, or updating settings), the underlying engine's `applyConfig` method silently overwrites `scene.showPriceLine` with `undefined` if the patch does not explicitly supply `currentPriceLine: true`. Furthermore, cell recreation and initial market loads do not reactively re-assert the price line.

2. **Accidental Drawing Displacement During Canvas Panning & Lack of Hand-Pull Mode:**
   - Currently, the toolbar only offers a single generic cursor tool. When chartists navigate dense technical charts covered in trendlines, order blocks, and Fibonacci retracements, clicking and dragging on the canvas frequently grabs and displaces nearby drawing anchors instead of panning the canvas.
   - There is no dedicated Hand-Pull (`grab`/`grabbing`) pan navigation mode to decouple chart dragging from drawing manipulation.

3. **Incomplete Drawing Suite Exposure & Missing Eraser Mode:**
   - The underlying `@luxalgo/vela` engine implements 68 technical drawing tool types, plus interactive `measure` and `eraser` modes. However, the application toolbar does not expose the full set of tools in a clean, categorized hierarchy with dedicated icons, and lacks an interactive one-click Eraser mode to quickly remove individual drawings without right-clicking or clearing the entire canvas.

---

## Solution

1. **Defensive Price Line Enforce Engine:**
   - Implement an active interceptor on `applyConfig` and renderer configuration patches that permanently locks `priceScale.currentPriceLine` to `true` (unless explicitly disabled by the user in Settings).
   - Hook into all charting lifecycle events (`market:changed`, `cell:created`, `script:run`, symbol/timeframe changes, and layout re-initialization) to immediately heal and assert `scene.showPriceLine = true`.

2. **Hand-Pull Pan Mode & Navigation Flyout:**
   - Transform the top toolbar button into a dedicated Navigation & Pointer flyout containing:
     - **Cursor (Pointer / Crosshair):** Standard pointer mode for drawing selection, anchor adjustment, and crosshair coordinate readouts.
     - **Handpull (Hand Pan Tool):** Dedicated pan navigation mode that switches the canvas cursor to `grab` / `grabbing` and disables drawing anchor hit-testing so the user can drag and pan across densely annotated charts without accidentally moving drawings.
     - **Eraser (Interactive Single-Item Eraser):** Puts the engine into native eraser mode, turning the cursor into an eraser to delete drawings one-by-one with a single click.
   - Add ergonomic keyboard shortcuts: press `H` to toggle Hand-Pull mode, and hold `Spacebar` to temporarily activate Hand-Pull mode (reverting upon release).

3. **Zero-Omission Drawing Suite:**
   - Expose 100% of all 68 drawing tools available in the Vela engine across structured flyouts (Lines, Channels & Pitchforks, Fibonacci & Gann, Harmonics & Elliott, Shapes & Brushes, Projections & Volume, Annotations & Stamps).
   - Provide Lucide icons and keyboard shortcuts for every tool category.
   - Add quick-picker support for `iconstamp` and `flagmark` so traders can place specific visual setup markers (target, warning, breakout, pin, flag) directly on the chart.

---

## User Stories

1. As a technical analyst, I want the current market price line to remain consistently visible on the chart canvas, so that I never lose track of where the market is trading.
2. As a multi-chart trader switching between grid layouts (single, split horizontal, split vertical, 2x2 grid), I want the current price line to automatically appear on all newly formed cells, so that every active chart displays the live market level.
3. As a chartist changing timeframes (e.g., from 15m to 4h), I want the current price line to stay active immediately without disappearing, so that I can analyze multiple time horizons seamlessly.
4. As a user modifying chart settings or applying custom color themes, I want the underlying renderer configuration patches to preserve the current price line, so that visual customization never breaks core charting features.
5. As a trader panning through a chart crowded with support/resistance lines and rectangles, I want a dedicated Hand-Pull mode, so that I can drag the chart canvas freely without accidentally moving any drawing anchors.
6. As a chart user, I want the mouse cursor to display as an open hand (`grab`) in Hand-Pull mode and clench into a closed hand (`grabbing`) while dragging, so that I have clear visual feedback of the active interaction mode.
7. As an active chartist, I want to press `H` on my keyboard to switch between Cursor and Hand-Pull mode, so that I can toggle navigation states without clicking the toolbar.
8. As a power user, I want to hold the Spacebar to pan the chart with Hand-Pull mode and have it return to my previous tool when I release the Spacebar, so that my technical analysis flow remains uninterrupted.
9. As a trader who drew an incorrect trendline, I want an interactive Eraser tool in the toolbar, so that I can click on any drawing to erase it individually with a single click.
10. As a user in Eraser mode, I want the cursor to indicate the eraser state, so that I know clicking a drawing will delete it immediately.
11. As a harmonic pattern trader, I want all harmonic patterns (XABCD, ABCD, Gartley, Bat, Butterfly, Crab, Shark, Cypher) readily available in the toolbar, so that I can map advanced geometric setups without missing tools.
12. As an Elliott Wave practitioner, I want both Elliott Impulse (12345) and Correction (ABC) waves accessible with dedicated icons, so that I can annotate wave counts accurately.
13. As a Gann and Fibonacci analyst, I want all Gann tools (Gann Fan, Gann Box, Gann Square) and Fibonacci variants (Retracement, Extension, Fan, Arcs, Circles, Wedge, Spiral, Timezones) available, so that I have complete analytical parity with premium platforms.
14. As an institutional order flow trader, I want Anchored VWAP and Fixed Range Volume Profile (FRVP) tools in the toolbar, so that I can analyze volume distribution at key turning points.
15. As a trader marking trade entries, I want the Icon Stamp tool to let me choose setup badges (Target, Warning, Breakout, Pin, Flag), so that I can annotate charts with clear visual context.
16. As a user searching for tools, I want the flyout search filter to cover all 68 technical tools and their aliases, so that I can find specialized tools in milliseconds.

---

## Implementation Decisions

1. **Defensive Price Line Enforce Engine:**
   - In `Chart.svelte`, create an active defensive enforcement function `enforceCurrentPriceLine()` that sets `native.scene.showPriceLine = true` across all workspace cells and dispatches a render invalidation request.
   - Patch `applyConfig` calls and intercept renderer config mutations so that `priceScale.currentPriceLine` is strictly preserved as `true`.
   - Bind `enforceCurrentPriceLine()` to workspace lifecycle events: `cell:created`, `market:changed`, `timeframe:changed`, layout mutation effects, and live tick handlers.

2. **Hand-Pull Navigation Engine:**
   - Extend `DrawingToolType` in `src/lib/types/market.ts` to include `'handpull'` and `'eraser'`.
   - Update `chartDrawingController.ts`:
     - When `tool === 'handpull'`, invoke `chart.drawings.setTool(null)` and set canvas style cursor to `grab`/`grabbing`. Suppress drawing anchor hit-testing so all pointer drags route to chart viewport panning.
     - When `tool === 'eraser'`, invoke native Vela `chart.drawings.setMode('eraser')`.
     - When `tool === 'cursor'` or `null`, restore default crosshair/pointer interaction.
   - In `src/lib/components/DrawingToolbar.svelte`, replace the static single-button cursor with a Navigation & Pointer flyout group:
     - Item 1: Cursor (`MousePointer`) - Shortcut `Alt+1` or default.
     - Item 2: Hand-Pull (`Hand`) - Shortcut `H`.
     - Item 3: Eraser (`Eraser`) - Shortcut `Alt+E`.
   - In `+page.svelte` and `Chart.svelte`, add a Spacebar keydown/keyup listener that temporarily arms `handpull` on press and restores the previous tool on release (ignoring inputs/textareas).

3. **Zero-Omission Drawing Suite & Icon Stamp Palette:**
   - Verify that all 68 tools from Vela's `DrawingTypeKey` are mapped in `src/lib/services/drawingToolsService.ts` and `src/lib/types/market.ts`.
   - In `DrawingToolbar.svelte`, provide specific Lucide icon mappings for all tools (e.g. `Hand` for handpull, `Eraser` for eraser, `Sparkles` for sonic/golden ratios, `ChartBar` for volume tools, `Milestone` for signpost, etc.).
   - Provide a quick stamp picker popup for `iconstamp` and `flagmark` to allow rapid selection of annotation glyphs.

---

## Testing Decisions

- **Testing Principles:** Test external contract and behavioral invariants only; avoid asserting internal implementation minutiae.
- **Modules to Test:**
  - `tests/chartPriceLineGuard.test.ts`: Test that `applyConfig` mutations, multi-cell creation, and timeframe changes preserve `showPriceLine = true` without silent reset.
  - `tests/chartDrawingController.test.ts`: Test that selecting `'handpull'` disarms drawing placement while setting pan mode, and selecting `'eraser'` arms native eraser mode.
  - `tests/drawingToolsService.test.ts`: Test that all 68 Vela drawing tools + navigation modes are registered in `DRAWING_TOOL_GROUPS` without omission, have valid labels and categories, and resolve appropriate metadata.
- **Prior Art:** Existing suites `tests/chartPriceLineGuard.test.ts`, `tests/chartDrawingController.test.ts`, and `tests/drawingToolsService.test.ts`.

---

## Out of Scope

- Automated trading bot execution or brokerage order routing (adhering to Pure Charting Scope in `GLOSSARY.md`).
- Multi-object marquee selection changes (confirmed in grilling that native `Ctrl + Drag` already operates as desired).
- Modifying core WebGL2 shader pipelines of `@luxalgo/vela`.

---

## Further Notes

- All terminology adheres strictly to [`GLOSSARY.md`](file:///c:/Projek/Trawangan/GLOSSARY.md), including **Persistent Price Line Guard**, **Hand-Pull Pan Mode**, and **Zero-Omission Drawing Suite**.
