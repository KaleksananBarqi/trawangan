# Specification: Price Scale Position Labels & Global Keyboard Shortcuts

## Problem Statement

Users of the `trawangan` crypto charting terminal encounter two critical usability problems during market analysis:

1. **Inverted and Misaligned Price Scale Labels:**
   - When placing a Long or Short Position (Risk/Reward) tool, the price labels on the right price scale are fatally inverted: the upper Target Profit level is labeled red as `STOP (SL)`, while the lower Stop Loss level is labeled green as `TARGET (TP)`.
   - Furthermore, the price badge overlays remain completely static and frozen in place when the chart is panned (dragged), zoomed (scroll wheel), or resized, causing the badges to drift away from the drawing lines and appear visibly detached and crooked ("gk lurus sama gambarnya").

2. **Unresponsive Global Keyboard Shortcuts:**
   - Essential keyboard shortcuts frequently fail to respond when the cursor or focus is placed over the WebGL chart canvas. On Windows, key combinations such as `Alt + W` (Watchlist), `Alt + R` (Position Tool), `Alt + E` (Pine IDE), `/` (Indicators), and rapid timeframe switching (`1`, `5`, `H`, `D`) are swallowed by the canvas or blocked by the operating system window mnemonics, disrupting fluid keyboard-first chart analysis.

---

## Solution

1. **Accurate Risk-Reward Price Level Extraction:**
   - Realign the anchor index mapping for position drawings so that Entry, Stop Loss, and Take Profit levels correspond precisely to their mathematical definitions. Take Profit levels are consistently labeled and styled with bullish green tones, while Stop Loss levels are labeled and styled with bearish red tones, adapting seamlessly to both Long and Short trade orientations.

2. **Real-Time Dynamic Badge Synchronization:**
   - Connect the vertical position calculations of the price scale badges directly to chart viewport interaction events (pan gesture, pointer drag, mouse wheel, container resize). Badges dynamically recalculate their Y-coordinates and stick crisp and parallel to the horizontal line coordinates of the drawings in real time.

3. **Capture-Phase Keyboard Shortcut Dispatcher:**
   - Register the global keyboard event listener on the `window` Capture Phase with physical key code (`e.code`) normalization. This ensures shortcuts are captured instantly before reaching the WebGL canvas event handlers, while strictly preserving native text editing behavior when inputs or code editors are focused.

---

## User Stories

1. As a cryptocurrency technical analyst, I want the Take Profit price label on the right price scale to accurately reflect the target profit level with green bullish styling, so that I can instantly verify my upside target without misreading my risk.
2. As a trader managing downside risk, I want the Stop Loss price label on the right price scale to accurately reflect my stop level with red bearish styling, so that I can monitor my maximum acceptable drawdown with clarity.
3. As a short seller placing a Short position, I want the upper level to be displayed as Stop Loss in red and the lower level as Take Profit in green, so that both Long and Short positions behave intuitively and accurately.
4. As a user panning and dragging the chart viewport up and down, I want the drawing price scale badges to move in real-time synchrony with the chart lines, so that the labels remain perfectly aligned with their corresponding drawings at all times.
5. As a user zooming in and out using the mouse wheel, I want the drawing price scale badges to recalculate their vertical positions smoothly, so that they never detach from the price levels they represent.
6. As a user resizing the application window, I want the price scale badges to immediately update their vertical positions, so that they stay pinned to their corresponding prices on the redrawn scale.
7. As an active chartist using keyboard shortcuts, I want to toggle the Watchlist dock using Alt + W while the chart is focused, so that I can switch instruments without having to manually click the sidebar icon.
8. As a technical analyst rapidly switching tools, I want to activate the Long/Short Position risk-reward tool via Alt + R, so that I can immediately plan trade setups with minimum friction.
9. As a day trader navigating multiple pairs, I want to cycle through my watchlist using Space and Shift + Space, so that I can scan tickers sequentially without breaking my visual focus.
10. As a Pine Script programmer, I want to toggle the Pine Script IDE panel using Alt + E even when interacting with the chart canvas, so that I can edit strategies swiftly.
11. As a trader using technical indicators, I want pressing the slash key (/) or Ctrl + I to reliably open the indicator catalog modal, so that I can search and attach indicators effortlessly.
12. As a keyboard-first user, I want timeframe shortcut keys (1, 3, 5, 0, 4, H, D, W) to reliably change the active chart interval on Windows keyboards, so that I can perform multi-timeframe analysis seamlessly.
13. As a charting power user, I want the Horizontal Line drawing tool shortcut (Alt + H) to arm the tool immediately, so that I can mark horizontal support and resistance levels without delay.
14. As a user working in full-screen immersion, I want Shift + F and F11 to toggle full-screen mode cleanly, so that I can maximize chart real estate.
15. As a trader creating price alerts, I want Alt + A to initiate alert creation at the current cursor price, so that I can set alerts instantly without multiple clicks.
16. As a new user discovering shortcuts, I want pressing F1 or ? to bring up the comprehensive shortcut glossary modal, so that I can review all available commands quickly.
17. As a trader typing notes or inputs in modals or editors, I want global chart shortcuts to be safely suppressed while typing in input fields, so that my typing does not accidentally trigger unwanted chart actions.
18. As an aesthetic-conscious trader, I want the price scale badges on the right axis to align with crisp integer rounding to the horizontal grid lines, so that the visual presentation feels cohesive and professional.

---

## Implementation Decisions

### 1. Price Scale Label Extraction Service
- Update the anchor resolution contract for `position` drawings. The anchor sequence is formalized as:
  - Index 0: Entry Level
  - Index 1: Stop Loss Level
  - Index 2: Take Profit (Target) Level
- Implement an orientation guard comparing entry, stop, and target values to ensure that whether an analyst draws Long or Short positions, Stop Loss is unambiguously colored `#ef4444` and Take Profit is colored `#10b981`.

### 2. Viewport-Synchronized Real-Time Coordinates
- Decouple the rendering coordinates of price scale badges from static Svelte template evaluations.
- Maintain a reactive coordinate mapping in the chart component state.
- Wire update hooks to active user interactions on the chart container:
  - Wheel events (`wheel`) for zoom.
  - Pointer movement during active mouse-down states (`pointermove` + `buttons === 1`) for pan gestures.
  - Container dimension changes via `ResizeObserver`.
- Calculate Y-coordinates through the primary active price pane bounds and scaling projector using integer pixel rounding.

### 3. Global Keyboard Capture Dispatcher
- Switch the global keyboard event listener registration from the default bubbling phase to the `Capture` phase (`{ capture: true }`).
- Normalize key evaluation using physical key codes (`e.code`) in conjunction with `e.key` (e.g. `KeyW`, `KeyE`, `KeyR`, `KeyH`, `Slash`, `Digit1`, `Numpad1`).
- Prevent default browser/window menu capture on Alt chords (`preventDefault()`) when a match is found.
- Maintain a strict focus guard: skip chart shortcut interception whenever the active document element is an `INPUT`, `TEXTAREA`, `[contenteditable="true"]`, or a CodeMirror editor container (`.cm-editor`).

---

## Testing Decisions

### Good Test Principles
- Tests must verify observable external behavior and contracts rather than internal private implementation details.
- Label extraction tests must assert the resulting badge attributes (price values, badge titles, kind, color codes) from raw drawing definitions.
- Shortcut glossary tests must verify query matching and comprehensive coverage of terminal navigation categories.

### Modules Tested
- Price scale badge extraction and formatting service (`priceScaleLabelService`).
- Keyboard shortcut dictionary and query filtering service (`shortcutService`).
- Keyboard dispatch event logic and focus exclusion.

### Prior Art
- Existing automated test suites in the codebase:
  - `tests/priceScaleLabels.test.ts`
  - `tests/shortcutService.test.ts`
  - `tests/leftToolbarDock.test.ts`

---

## Out of Scope

- Modifying the bundled WebGL rendering engine internals in third-party library dependencies.
- Adding brand new geometric drawing types outside the existing technical tool catalog.
- User-customizable shortcut key remap configurations (persisting custom user keybindings is reserved for a future release).

---

## Further Notes

- This specification adheres strictly to `trawangan`'s *Pure Charting Scope* and *Zero-Paywall Parity* principles.
- The Capture-phase approach provides robust cross-platform reliability on Windows desktop (Tauri v2 / WebView2).
