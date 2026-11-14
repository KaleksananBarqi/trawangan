# Specification: Unlocking Vela Extended Capabilities — Price Axis Countdown Timer, DataWindow Inspector, Pine Alerts Engine, Visible Range Presets, and Session Zones

## Problem Statement

Traders and technical chartists using the `trawangan` desktop terminal continue to experience friction and operational blind spots despite the powerful WebGL2 charting core and scripting engine embedded in the application:

1. **Uncertainty of Bar Close & Timing**: Scalpers and intraday momentum traders lack a real-time countdown timer directly on the price scale. Without a visible timer indicating exactly how many minutes and seconds remain before the current candlestick closes, traders risk premature entries or delayed executions based on unconfirmed candle patterns.
2. **Obscured Metric Inspection on Complex Charts**: When analyzing charts with multiple indicators (such as multi-line oscillators, Ichimoku clouds, or Bollinger Bands), numerical values in the header legend become crowded, truncated, or illegible. Chartist users have no dedicated, clean Data Window inspector panel to scrutinize exact OHLCV figures and precise multi-plot indicator outputs corresponding to the cursor's crosshair position.
3. **Silent Pine Script Alerts & Missed Trading Opportunities**: Custom Pine Script v5/v6 indicators written with `alert()` or `alertcondition()` evaluate calculations within the worker engine, but their triggers are never surfaced to the trader. The desktop environment remains silent, failing to dispatch in-app notifications or operating system push notifications when market criteria are satisfied.
4. **Tedious Multi-Timeframe and Macro Horizon Navigation**: Shifting between macro horizons (such as examining 1-day price action versus year-to-date or multi-year structural trends) requires repetitive manual panning, dragging, and timeframe adjustments. The absence of a dedicated Visible Range Presets toolbar hinders institutional analysis workflows.
5. **Ambiguity During After-Hours Equities Trading**: Traders monitoring US equities, indices, and ETFs (via Yahoo Finance) face visually continuous candlestick charts without differentiation between Regular Trading Hours (RTH) and Extended Trading Hours (ETH). This leads to confusion regarding liquidity gaps, overnight volatility spikes, and pre-market price anomalies.
6. **Friction in Drawing Tool Manipulation**: Power users creating technical drawings face ergonomic friction due to the absence of standard clipboard shortcuts (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`) for drawing objects and the lack of a direct double-click trigger to edit drawing coordinates and styling.

---

## Solution

1. **Price Axis Countdown Timer & WallClock Synchronization**:
   - Provide an optional real-time countdown timer badge positioned adjacent to the latest price line on the vertical price scale.
   - Synchronize the countdown cadence with the central terminal clock pulse, updating smoothly each second and cleanly transitioning upon bar expiration.
   - Expose a user toggle in the chart preferences settings dialog under the Scales category, persisting the setting in the workspace configuration.
2. **Dockable DataWindow Inspector Panel**:
   - Introduce a high-precision DataWindow inspector panel accessible from the Right Dock Rail or as an optional floating HUD.
   - Extract pre-formatted, scale-calibrated numerical snapshots (OHLCV and all active indicator plot series) dynamically from the charting engine as the crosshair moves across historical bars.
   - Render indicator values using their distinctive plot colors, organized hierarchically by indicator title.
3. **Pine Script Alert & Warning Telemetry Bridge**:
   - Establish an active telemetry bridge listening to runtime alert and warning events emitted by executing Pine Script instances.
   - Route incoming script alerts to the terminal's notification dispatcher, displaying non-intrusive in-app toast notifications and optional system-level desktop notifications with sound.
   - Forward script runtime warnings (such as mathematical division by zero or out-of-bounds array lookups) to the Pine Editor console output to aid developer debugging.
4. **Visible Range Presets Toolbar**:
   - Place an institutional range presets bar at the bottom footer of the chart viewport featuring standard institutional horizons: `1D`, `5D`, `1M`, `3M`, `6M`, `YTD`, `1Y`, and `ALL`.
   - Activating a range preset automatically calculates the optimal candle resolution, sets the visible time window in a single pass, and animates smoothly to the target perspective.
5. **Session Zones & Extended Hours Visual Shading**:
   - Enable session zones rendering for equity and index feeds that observe market sessions.
   - Apply thematic translucent background tinting: dawn amber for pre-market sessions, dusk blue for post-market sessions, and neutral shading for market closure periods.
   - Offer a toggle switch in the bottom statusline and chart settings to switch between Regular Trading Hours (RTH) and Extended Trading Hours (ETH).
6. **Drawing Object Clipboard & Interactive Ergonomics**:
   - Integrate standard desktop clipboard shortcuts (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`) into the drawing interaction layer, enabling rapid duplication of trendlines, channels, Fibonacci grids, and measurement tools across the chart.
   - Support double-click interactions on existing drawings to invoke the native settings and coordinates dialog.

---

## User Stories

### Price Axis Countdown Timer
1. As an intraday scalper, I want to see a countdown timer next to the active price line on the price axis, so that I know exactly when the current 1-minute or 5-minute candle will close.
2. As a swing trader waiting for a daily candle close, I want the countdown timer to display hours, minutes, and seconds remaining, so that I can schedule my analysis before the market settlement.
3. As a chartist who prefers a minimalist interface, I want to toggle the countdown timer on or off in the Chart Settings modal under the Scales tab, so that I can keep my price axis clean.
4. As a multi-chart user, I want the countdown timer setting to persist per cell or across synchronized workspace layouts, so that my preference is preserved across app relaunches.
5. As a trader observing high-volatility releases, I want the countdown timer to stay synchronized with the active market clock without lagging or drifting out of phase.

### DataWindow Inspector Surface
6. As a technical analyst, I want a dedicated DataWindow panel that displays the exact Date, Time, Open, High, Low, Close, and Volume of the candle currently hovered by my crosshair, so that I can verify price action with precision.
7. As a quantitative chartist using complex indicators with multiple plots (like MACD, Bollinger Bands, or Ichimoku), I want to see every individual plot value listed in the DataWindow, so that I don't have to decipher cramped legend headers.
8. As a user reviewing historical setups, I want the DataWindow values to update instantaneously as I glide my cursor over past candles, so that I can inspect indicator values bar by bar.
9. As a terminal user, I want to open the DataWindow from the Right Dock Rail or as a collapsible overlay, so that it does not permanently occupy canvas space when not needed.
10. As a trader inspecting indicators, I want each data row in the DataWindow to reflect the specific plot's assigned color, so that I can visually connect the numbers to their corresponding chart curves.
11. As a user moving the mouse completely outside the chart viewport, I want the DataWindow to cleanly display the latest bar's data, so that the panel remains informative rather than blanking out.

### Pine Script Alerts & Telemetry
12. As a Pine Script creator writing custom indicators with `alert()` calls, I want my script alerts to trigger desktop system notifications, so that I am notified of trade setups even when the terminal window is minimized.
13. As an algorithmic trader writing conditions with `alertcondition()`, I want to see in-app toast notifications with the alert title and message when the market triggers the condition, so that I can take immediate action.
14. As a trader running multiple indicator scripts, I want each alert notification to clearly identify which script and symbol generated the trigger, so that I don't confuse signals across pairs.
15. As a Pine developer debugging a script, I want runtime engine warnings (such as invalid operations or performance throttles) surfaced in the Pine console, so that I can locate and resolve logic flaws quickly.
16. As a user concerned with notification fatigue, I want to be able to mute or configure alert delivery per indicator instance in the indicator settings, so that I am not overwhelmed by spammy signals.

### Visible Range Presets
17. As an analyst evaluating year-to-date performance, I want to click a 'YTD' button in the chart footer, so that the chart immediately frames price action from January 1st to the present moment.
18. As a day trader reviewing intraday context, I want to click '1D' to fit all of today's trading action into view, so that I can immediately identify the daily high and low range.
19. As a macro investor examining secular cycles, I want to click '1Y' or 'ALL' to expand the viewport across multi-year history, so that I can determine long-term trend structures.
20. As a chartist clicking a range preset, I want the chart to select an optimal candlestick timeframe automatically (e.g. daily bars for 1Y, hourly bars for 1M), so that candles do not look unnaturally squished or sparse.
21. As a keyboard-oriented trader, I want quick commands or shortcuts to cycle through primary range presets, so that I can shift macro perspectives without mouse interaction.

### Session Zones & Extended Hours
22. As an equity trader following US stocks and ETFs, I want pre-market trading hours shaded with a translucent amber wash, so that I immediately recognize pre-opening gap activity.
23. As an after-hours trader, I want post-market sessions shaded with a cool blue wash, so that I can distinguish regular session liquidity from illiquid late-day trading.
24. As an analyst wanting clean regular-session charts, I want a toggle switch in the bottom status bar to switch between Regular Trading Hours (RTH) and Extended Trading Hours (ETH), so that my indicators are calculated solely over standard exchange hours when preferred.
25. As a crypto-only trader, I want continuous 24/7 markets to ignore session shading automatically, so that crypto candlestick backgrounds remain consistent and uncolored.

### Drawing Tools Native Ergonomics
26. As an active technical analyst, I want to select a drawing and press `Ctrl+C` followed by `Ctrl+V`, so that I can duplicate complex trendlines or parallel channels without redrawing them.
27. As a chartist constructing equidistant support/resistance levels, I want to press `Ctrl+D` on a selected horizontal level, so that a cloned instance appears immediately for rapid placement.
28. As a user modifying drawing properties, I want to double-click any drawing on the chart to open its configuration dialog, so that I can adjust line thickness, color, coordinates, and labels directly.
29. As a user managing complex drawing arrangements, I want cloned drawings to retain their exact visual styling, line style, and opacity settings, so that my analytical aesthetic remains unified.

---

## Implementation Decisions

### 1. Countdown Timer Subsystem
- **Core Seam Extension**: Enhance the central chart session controller to expose countdown configuration and state methods (`setPriceScaleCountdown`, `isPriceScaleCountdownEnabled`).
- **Engine Configuration Wiring**: Route the countdown preference into the underlying chart configuration options under the price scale definition.
- **Clock Pulse Synchronization**: Connect the price scale countdown cadence to the application's central wall clock pulse provider, guaranteeing that second ticks are synchronized across multi-chart grids.
- **Settings Dialog Integration**: Add a dedicated "Countdown to Bar Close" checkbox in the Chart Settings dialog within the Scales category, backed by reactive workspace persistence.

### 2. DataWindow Inspector Subsystem
- **Dedicated DataWindow Service**: Create an isolated DataWindow management service that coordinates active readout queries and crosshair movement subscriptions.
- **Readout Extraction Contract**: Pull snapshots on each crosshair update from the engine's native data window readout provider. The contract delivers pre-formatted strings for bar timestamp, OHLCV, and nested indicator groups with individual series titles, formatted values, and color identifiers.
- **Dockable Right Rail Integration**: Integrate the DataWindow as a first-class view option within the Right Dock Rail, allowing users to toggle between Watchlist, Alerts, Object Tree, and DataWindow with single-click persistence.
- **Fallback Readout Handling**: When the cursor departs the canvas, the service retains and displays the latest closed candle's readout rather than displaying an empty state.

### 3. Pine Script Alert & Warning Dispatcher
- **Engine Event Bridge**: Establish an event listener bridge within the chart session lifecycle that listens for `alert` and `warning` events emitted by running scripting engine sessions.
- **Unified Notification Routing**: Translate raw engine alert payloads (carrying identifier, message, title, timestamp, and bar index) into the terminal's global alert notification pipeline.
- **Desktop Push Notification Integration**: Connect the alert bridge to the operating system's desktop notification system using the native desktop notification plugin, honoring user notification permission settings and audio chime preferences.
- **Console Warning Channeling**: Direct non-fatal engine warnings to the Pine Editor console output drawer, formatted with timestamp and affected script title.

### 4. Visible Range Presets Toolbar
- **Preset Horizon Definitions**: Support eight standard institutional horizons: `1D`, `5D`, `1M`, `3M`, `6M`, `YTD`, `1Y`, and `ALL`.
- **Optimal Resolution Resolution**: Provide a deterministic mapping from each range preset to an optimal candlestick timeframe (e.g. `1m` for 1D, `15m` for 5D, `1h` for 1M, `4h` for 6M, `1D` for 1Y/YTD, `1W` for ALL).
- **Single-Pass Viewport Framing**: Apply preset range switches through the engine's unified market switch contract with the `visibleRange` property, allowing the core to fetch the required bar budget in one step without visual snapping.
- **Docked Range Bar UI**: Render a sleek, compact horizontal range chip bar anchored to the bottom edge of the chart canvas viewport.

### 5. Session Zones & Market Hours Shading
- **Session State Modeling**: Model session states as `regular` (RTH) versus `extended` (ETH).
- **Thematic Visual Tinting Tokens**: Apply standard session tints: amber for pre-market (`SESSION_PRE`), blue for post-market (`SESSION_POST`), and neutral slate for market closures (`SESSION_OFF`).
- **Provider Capability Gating**: Enable session shading and the RTH/ETH toggle solely on market providers that declare session capabilities (such as Yahoo Finance), leaving continuous crypto providers unaffected.
- **Bottombar Statusline Toggle**: Embed an interactive session indicator badge (`RTH` / `ETH`) in the bottom bar, enabling instant 1-click toggling of after-hours data.

### 6. Drawing Clipboard & Direct Settings Seam
- **Keybinding Interception in Command Dispatcher**: Register global and chart-scoped key combinations (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`) in the keyboard command dispatcher, routing to drawing controller clipboard actions.
- **Clipboard Management Bridge**: Bind drawing controller clipboard handlers to the engine's user drawings port methods (`copyToClipboard`, `paste`, `duplicate`).
- **Double-Click Detection & Settings Dispatch**: Detect double-tap/double-click gestures targeting active drawing items on the canvas, opening the drawing properties configuration dialog with populated coordinates and style values.

---

## Testing Decisions

### What Makes a Good Test
- Tests must strictly evaluate **observable external behavior, public contracts, and user interactions**, rather than internal private state or specific framework wiring.
- Tests must verify that toggling settings produces expected changes in configuration payloads, that events emitted by the engine translate into properly formed notifications, and that range switches result in valid viewport boundaries.
- Mocking must be restricted to external boundary seams (such as operating system push notification APIs and remote network fetches).

### Modules to Test
1. **Countdown Timer Lifecycle**: Test that enabling the countdown updates the price scale configuration and that the countdown text correctly reflects remaining seconds until bar expiration.
2. **DataWindow Data Extraction**: Test that crosshair events trigger readout extraction, formatting OHLCV values and multi-series indicator plots into the expected hierarchical structure.
3. **Pine Alert Telemetry Bridge**: Test that script alert events emit properly structured notification payloads to the alert service and desktop notification dispatcher.
4. **Range Presets Calculator & Viewport Framing**: Test that each preset identifier resolves to the expected timeframe resolution and calculates correct epoch millisecond boundaries for historical intervals.
5. **Session Zone Configuration**: Test that session state toggles between `regular` and `extended` update market requests for session-capable providers and remain inert for continuous feeds.
6. **Drawing Clipboard Actions**: Test that copy, paste, and duplicate commands properly clone drawing structures, maintaining style fidelity and applying appropriate spatial offsets.

### Prior Art
- Test patterns should follow existing comprehensive test suites:
  - `tests/priceStyle.test.ts` (for UI selector and controller synchronization).
  - `tests/pineStrategyTelemetry.test.ts` (for scripting engine event capture and data transformation).
  - `tests/timelineMarksController.test.ts` (for event marker management and lifecycle handling).
  - `tests/commandDispatcher.test.ts` (for keyboard shortcut routing and action dispatching).

---

## Out of Scope

1. **Brokerage Connectivity & Live Order Execution**: In accordance with the Pure Charting Scope defined in the project glossary, all trade signals, alerts, and strategy executions are strictly analytical and simulated. No live brokerage execution or API trading keys are within scope.
2. **Order Flow Footprint / Level 2 Market Depth**: While engine types support footprint data structures, high-frequency Level 2 bid/ask tick streaming requires dedicated infrastructure and is deferred to a subsequent order flow milestone.
3. **Custom Renko / Kagi Bar Transform SDK**: Implementing custom non-standard price transformation engines via plugin registration is deferred; standard candlestick, bar, line, area, and baseline views satisfy current trading needs.
4. **Third-Party External Plugin Marketplace**: The internal plugin framework will be utilized internally by core modules; dynamic loading of untrusted third-party code bundles is outside the scope of this terminal release.

---

## Further Notes

- **Zero-Paywall Parity**: Delivering real-time bar countdowns, complete DataWindow inspection, native Pine alerts, and range presets reinforces `trawangan`'s mission to provide institutional-grade charting capabilities without recurring paywalls or subscription barriers.
- **Reference Investigation**: This specification is directly grounded in primary source findings documented in `docs/research/2026-11-14-vela-extended-capabilities-gap-analysis.md`.
