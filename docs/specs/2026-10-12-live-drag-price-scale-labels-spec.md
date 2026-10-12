# Specification: Live Drag Real-Time Synchronization for Price Scale Labels

## Problem Statement

When using technical drawing tools on the `trawangan` charting terminal—specifically the Long and Short Position (Risk/Reward) tools as well as Horizontal Line tools—users encounter a freeze in the right-axis price labels:
- After placing a Long or Short position on the canvas, when the user drags the target (Take Profit) or stop (Stop Loss) anchor handle to adjust the level, the corresponding price label on the right price scale remains frozen at its initial value and fails to update dynamically during the drag gesture.
- The root cause is twofold:
  1. The chart event listener previously listened to a nonexistent event name (`drawing:updated`), whereas the underlying Vela charting engine officially emits `drawing:edited` upon change completion.
  2. During an active interactive drag gesture (`pointermove` while mouse button is held down), Vela mutates anchor prices in-place in memory without emitting terminal events until pointer release. Because the Svelte reactive state held a stale reference and only recalculated the Y position of the old static price, neither the displayed price text nor the live vertical alignment tracked the mouse cursor in real time.

---

## Solution

1. **Connect Official Lifecycle Events:**
   - Listen to the authentic Vela drawing events: `drawing:created`, `drawing:edited`, `drawing:removed`, and `drawing:draft`.
2. **Interactive Live Re-extraction During Drag Gestures:**
   - During active pointer gestures over the chart canvas, trigger a real-time re-extraction of drawing prices directly from the active drawings collection.
   - Force Svelte 5 reactivity invalidation by assigning a fresh array copy on every interactive frame so that `$derived` price badges immediately evaluate the latest live anchor prices (`targetPrice`, `stopPrice`, `entryPrice`).
3. **Simultaneous 60 FPS Text and Coordinate Synchronization:**
   - Coordinate the price badge text formatting (`$formatPrice(...)`) and vertical Y-coordinate positioning within the shared `scheduleBadgePositionUpdate()` animation frame loop, ensuring the right price scale badge sticks parallel to the drawing line and updates its numbers continuously as the analyst drags the handle.

---

## User Stories

1. As a cryptocurrency technical analyst, I want the Take Profit price label on the right price scale to immediately update its numeric value while I am dragging the target handle of a Long position, so that I can see the exact target price in real-time.
2. As a short seller, I want the Take Profit price label on the right price scale to dynamically track downward as I drag the lower target handle of a Short position, so that I can accurately target key support levels.
3. As a risk-conscious trader, I want the Stop Loss price label on the right price scale to update its numeric price dynamically while I drag the stop loss handle, so that I can calibrate my risk-to-reward ratio with precision.
4. As a technical chartist, I want the right price scale badge position (Y-coordinate) and its text content to move in unison during the entire drag gesture, so that there is zero disconnect between the visual drawing line and the axis label.
5. As a trader adjusting entry levels, I want the entry price badge to recalculate both its displayed price and vertical position when moving the central position handle, so that my trade plan reflects my intended entry point.
6. As a power user, I want the updated price levels to be immediately committed and saved to local storage upon releasing the mouse (pointer up), so that my modifications persist across sessions.
7. As a chart analyst using the gear settings popup on a position drawing, I want any manual numeric edits in the settings dialog to immediately reflect on the right price scale labels via the `drawing:edited` event, so that popup edits stay in sync with the axis.
8. As a user moving other line drawing tools (such as Horizontal Lines or Rays), I want dragging their anchors to update the corresponding right-axis price badge in real time, so that all interactive tools exhibit consistent live behavior.
9. As an analyst operating in high-volatility markets, I want the live badge updates during drag gestures to maintain smooth 60 FPS performance without lagging or freezing the chart render loop.
10. As a trader using multiple open position drawings on a single chart, I want dragging one drawing's target to update only that specific position's badge while keeping other badges intact, so that complex setups remain distinct and clear.
11. As a keyboard and mouse user, I want canceling an in-progress drag via the Escape key to revert the price scale badges back to the original anchors, so that aborted adjustments do not leave incorrect prices on the scale.
12. As a visual trader, I want the background color and semantic indicators (green for TP, red for SL) to remain consistent throughout the drag operation, so that the meaning of the level is never ambiguous.

---

## Implementation Decisions

1. **Vela Drawing Event Binding:**
   - Register handlers for `drawing:created`, `drawing:edited`, `drawing:removed`, and `drawing:draft` on the chart instance.
   - Replace any legacy `drawing:updated` registrations with `drawing:edited`.

2. **Active Drag Reactivity Invalidation:**
   - In the pointer move handler on the chart container, when pointer interaction is active (`e.buttons > 0` or drag state is true), read the live drawings from the active chart manager and clone the collection (`activeDrawings = [...activeChart.drawings.all()]`).
   - Ensure the extraction logic evaluates live prices from both `drawing.prices()` and `drawing.anchors` to reflect continuous coordinate transformations.

3. **Batched 60 FPS Animation Frame Dispatch:**
   - Keep badge Y-coordinate projection and badge price re-evaluation synchronized under `scheduleBadgePositionUpdate()` driven by `requestAnimationFrame`.
   - Avoid redundant DOM reflows by updating the reactive coordinate dictionary only when coordinates or values change.

4. **Persistence Isolation:**
   - Restrict SQLite auto-save database writes to the terminal mutation events (`drawing:edited` and pointer up release) to preserve I/O performance and prevent unnecessary disk writes during high-frequency dragging.

---

## Testing Decisions

### Good Test Principles
- Tests must verify observable behavior: when drawing prices or anchors mutate, the extracted price scale badges must immediately yield updated numerical values, formatted labels, and semantic styles.
- Avoid asserting on internal drag controller private methods; test the extraction and synchronization seam with dynamic mutated states.

### Modules Tested
- `priceScaleLabelService`: Dynamic badge extraction from live mutated drawing instances (testing initial placement, in-place handle modification, and multi-drawing independence).
- Event wiring and reactive synchronization seams.

### Prior Art
- `tests/priceScaleLabels.test.ts`

---

## Out of Scope

- Modifying the underlying WebGL rendering shaders or math routines in third-party `@luxalgo/vela` packages.
- Adding brand new geometric drawing types not currently supported by the engine.
- External order execution or broker integration (preserving the *Pure Charting Scope*).

---

## Further Notes

- Adheres strictly to the `trawangan` domain glossary (*Pure Charting Scope*, *Zero-Paywall Parity*, and *Signature Palette*).
