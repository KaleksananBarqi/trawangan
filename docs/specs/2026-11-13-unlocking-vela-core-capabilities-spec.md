# Specification: Unlocking Vela Core Capabilities — Native Indicators Catalog, Price Styles Selector, Timeline Marks, and Scripting Engine Hardening

## Problem Statement

Traders and technical chartists using the `trawangan` desktop terminal are constrained by significant feature omissions despite the powerful `@luxalgo/vela` WebGL2 charting core and `@luxalgo/vela-pinets` engine already embedded in the application:

1. **Underutilized Indicator Ecosystem & Worker Serialization Bottleneck**: `trawangan` currently restricts users to only seven built-in indicator presets (`rsi`, `macd`, `bb`, `ema-ribbon`, `supertrend`, `vwap`, `volume`). Every single one is executed as an interpreted Pine Script v5/v6 inside a Web Worker. Meanwhile, Vela provides **76 high-performance native indicators** (including Visible Range Volume Profile (VPVR), Parabolic SAR, ATR, Chaikin Money Flow, Money Flow Index, Donchian Channels, Keltner Channels, Williams Fractal, ZigZag, TTM Squeeze, and zero-lag moving averages) that run directly on the chart's bars on the main thread with zero worker serialization latency, instant parameter reactivity, and automatic settings schema. None of these 76 native indicators are discoverable or accessible in the terminal's indicator modal.
2. **Missing Price Style / Chart Type Controls**: While the underlying Vela renderer supports six institutional price display styles (`candles`, `heikinashi`, `bars`, `line`, `area`, `baseline`), and while backend methods exist in `trawangan`'s session controller, the user interface completely lacks a chart style selector in the header or toolbar. Users are permanently locked to default candlesticks with no way to switch to Heikin-Ashi or baseline views.
3. **Absence of Event Anchoring on Timeline (`chart.marks`)**: Vela includes a first-class timeline event marker system (`chart.marks`) with automatic zoom clustering, tooltips, interactive popup panels, and hierarchically grouped event toggles in settings. `trawangan` does not utilize this capability at all, leaving traders without visual timeline cues for scheduled macroeconomic events (FOMC, CPI, NFP), corporate earnings/dividends on equity feeds, trading plan execution logs (entry/target/stop fill points), or candlestick-anchored journal thesis notes.
4. **Multi-Ticker Scripting Limitation in Pine IDE (`request.security`)**: `trawangan` instantiates the Pine worker engine without wiring the series fetch callback (`fetchSeries`). As a result, any Pine Script attempting to call `request.security(...)` for inter-market correlation, market dominance (e.g., BTC.D), or synthetic pair spreads fails or returns empty data series.
5. **Lack of Strategy Backtest Result Surface**: When users run Pine scripts declared with `strategy(...)`, the engine calculates a complete trade simulation ledger (`StrategyState`, `StrategyTrade[]`, and `TradeExecution`), yet `trawangan` discards this telemetry, offering no strategy tester summary, equity curve, or trade history table.

---

## Solution

1. **Comprehensive Unified Indicator Catalog (Zero-Paywall Parity)**:
   - Expose the complete suite of **76 Vela Native Indicators** alongside existing Pine Script presets in the Indicator Modal.
   - Categorize all indicators into logical families: Trend, Momentum, Volatility, Volume, Profile, and Signals.
   - When a native indicator is selected, mount it instantly via Vela's native indicator subsystem without spawning or burdening the Pine Web Worker.
   - Support native indicator parameter tuning using Vela's built-in input schema and ensure persistence across workspace sessions.
2. **Header Price Style Selector**:
   - Introduce an institutional-grade Chart Style selector dropdown in the top header toolbar adjacent to the timeframe selector.
   - Provide instant 1-click switching between Candlestick, Heikin-Ashi, Bar, Line, Area, and Baseline styles.
   - Persist the selected price style per-cell in the workspace SQLite database and synchronize across multi-cell sync groups when configured.
3. **Timeline Event Marker Engine (`chart.marks`)**:
   - Establish a centralized timeline markers service wrapping Vela's `chart.marks` controller.
   - Enable automated clustering, hover tooltips, and rich detail popups.
   - Wire initial timeline marks for:
     - Macroeconomic calendar events and high-impact releases.
     - Trading plan execution markers (visualizing planned vs. triggered entries, take-profits, and stops).
     - Timestamped trader thesis notes.
   - Support event group toggles in the chart settings modal under an *Events* tab.
4. **Scripting Engine Hardening with Inter-Symbol Data (`fetchSeries`)**:
   - Supply a robust `fetchSeries` provider adapter to the `PineWorkerEngine` factory.
   - Delegate inter-symbol data requests to `trawangan`'s multi-provider market feed and local cached kline storage, fully enabling Pine v5/v6 `request.security()` calls.
5. **Pine Strategy Telemetry Bridge**:
   - Capture `IndicatorModel.trades` and `context()` snapshots from running strategy instances.
   - Render native buy/sell trade execution markers (`TradeExecution`) on candle bars.
   - Provide the foundation for a dockable Strategy Tester performance summary panel.

---

## User Stories

### Unified Indicator Catalog (76 Native Studies + Pine)
1. As a technical analyst, I want to browse all 76 native Vela indicators in the Indicator Modal, so that I have immediate access to classic studies like ATR, Parabolic SAR, and Donchian Channels without writing custom Pine scripts.
2. As a volume profile trader, I want to select Visible Range Volume Profile (VPVR) from the indicator catalog, so that I can analyze high-volume nodes and point of control (POC) directly on my WebGL2 chart canvas.
3. As a chartist, I want native indicators to mount instantly without compilation delay, so that my workspace remains responsive even when adding multiple studies.
4. As a momentum trader, I want to use native Stochastic RSI, CCI, and Fisher Transform, so that I can identify cycle peaks and valleys with zero worker thread overhead.
5. As a trend follower, I want to apply Chandelier Exit and SuperTrend directly from the native catalog, so that I can establish objective trailing stops on my active pair.
6. As an analyst evaluating market strength, I want to access Chaikin Money Flow (CMF), Money Flow Index (MFI), and On Balance Volume (OBV), so that I can detect institutional accumulation and distribution patterns.
7. As a trader with multi-cell workspaces, I want native indicators to synchronize their settings and lifecycle cleanly across all active cells, so that my charts do not produce zombie or duplicated layers.
8. As a user opening the Indicator Modal, I want clear category filters (All, Trend, Momentum, Volatility, Volume, Profile, Custom Scripts, Favorites), so that I can quickly locate specific tools among the expanded 80+ indicator library.
9. As a trader adjusting indicator lengths, I want the native settings dialog to open when clicking the gear icon, so that I can modify periods, source inputs, and colors interactively.
10. As a power user, I want to star any native indicator as a favorite, so that my most frequent studies appear at the top of the modal and shortcuts bar.
11. As a user saving my workspace, I want native indicators and their customized inputs saved to the local SQLite database, so that my charting layout restores faithfully upon reopening `trawangan`.

### Price Styles & Chart Types
12. As a swing trader, I want to select Heikin-Ashi from a price style dropdown in the header toolbar, so that noise is filtered out and trend continuity becomes immediately apparent.
13. As an intraday scalper, I want to switch to a classic OHLC Bar chart, so that I can inspect exact bar open and close tick ticks with minimal visual clutter.
14. As an analyst tracking macro trends, I want to switch to an Area or Baseline chart style, so that I can visualize performance relative to a custom baseline reference level.
15. As a multi-chart user, I want the price style selector to reflect the active cell's current style, so that I always know which representation is active.
16. As a multi-chart user with style sync enabled, I want changing the price style in the active chart to update all linked cells in the grid, so that my multi-timeframe analysis maintains a consistent visual format.
17. As a keyboard-first user, I want hotkeys or quick commands to cycle through primary chart styles, so that I can switch perspectives without reaching for the mouse.

### Timeline Marks & Macro/Trade Anchors
18. As a crypto macro analyst, I want high-impact economic events (CPI, FOMC rate decisions, NFP) displayed as clean glyph marks on the chart's timeline, so that I can anticipate upcoming volatility spikes.
19. As a trader hovering over a timeline mark, I want to see a tooltip summarizing the event title and release time, so that I can assess the context at a glance.
20. As a trader clicking a timeline mark, I want an interactive popup displaying detailed figures (actual, forecast, previous), so that I have complete macro context without leaving the terminal.
21. As a long-term chartist zooming out to daily or weekly views, I want overlapping timeline marks to cluster smoothly into a single numbered badge, so that my time scale does not become crowded.
22. As a systematic trader, I want my executed trading plan milestones (entry filled, take-profit hit, stop-loss hit) rendered as distinct timeline marks, so that I can review my trade execution against historical price action.
23. As an active journaler, I want to anchor personal notes and thesis tags to specific candlestick timestamps via timeline marks, so that my trading rationale remains attached to the exact market moment.
24. As a user who prefers a clean time axis, I want an *Events* section in the chart settings dialog to toggle visibility of individual mark groups (Macro, Trade Plans, Journal Notes), so that I control visual density.

### Scripting Engine Hardening & Strategy Backtesting
25. As a Pine Script developer, I want to call `request.security()` in my custom indicators to fetch price and volume from another symbol or timeframe, so that I can compute inter-market ratios (like ETH/BTC) and market dominance metrics.
26. As a multi-provider terminal user, I want `fetchSeries` to automatically route cross-symbol requests through `trawangan`'s active market providers and local candle caches, so that data requests are resolved swiftly and reliably.
27. As an algorithmic trader writing Pine `strategy(...)` scripts, I want buy and sell order fills rendered as visual arrows on the chart candles, so that I can visually verify where entries and exits triggered.
28. As a strategy developer, I want access to simulation metrics (Net Profit, Win Rate, Profit Factor, Max Drawdown, Total Trades) computed by the engine, so that I can evaluate strategy effectiveness inside the desktop terminal.
29. As a terminal user running memory-intensive scripts, I want the scripting engine to clean up data series and listeners when a script is removed, so that background RAM consumption remains minimal.

---

## Implementation Decisions

### 1. Unified Indicator Catalog Architecture
- **Catalog Aggregator**: Construct an `IndicatorCatalogService` that acts as the single source of truth for all available indicators in `trawangan`. It aggregates:
  - The 76 native indicators exposed by `@luxalgo/vela` (`nativeIndicatorDescriptors()`).
  - The curated Pine presets in `INDICATOR_PRESETS`.
  - Locally saved user Pine scripts from the SQLite database.
- **Unified Indicator Metadata Model**: Define a polymorphic descriptor interface:
  ```typescript
  interface UnifiedIndicatorDescriptor {
    id: string;
    title: string;
    shortTitle?: string;
    category: 'Trend' | 'Momentum' | 'Volatility' | 'Volume' | 'Profile' | 'Signals' | 'Custom';
    kind: 'native' | 'pine';
    overlay: boolean;
    description?: string;
    sourceCode?: string;       // For Pine indicators
    nativeType?: string;       // For Vela native indicators
    inputsSchema?: any;        // Schema for native inputs dialog
  }
  ```
- **Lifecycle & Execution Seam**:
  - The chart session controller will expose a polymorphic `addIndicatorToCell(descriptor: UnifiedIndicatorDescriptor, cell?: any)` method.
  - If `kind === 'native'`, delegate to `cell.chart.addNativeIndicator(descriptor.nativeType, options)`.
  - If `kind === 'pine'`, delegate to `cell.chart.addIndicator(descriptor.sourceCode, options)` via `PineWorkerEngine`.
  - Update `IndicatorRegistry` to track both `NativeIndicatorHandle` and `PineIndicatorHandle`, guaranteeing clean removal and multi-cell synchronization.

### 2. Price Style Integration & Header Toolbar UI
- **Header Control Component**: Add a `PriceStylePicker` dropdown component to the primary header toolbar, positioned adjacent to the timeframe selector.
- **Available Styles Contract**: Expose institutional styles supported by the WebGL2 renderer:
  - `candles`: Standard Japanese Candlesticks (default)
  - `heikinashi`: Averaged Heikin-Ashi bars
  - `bars`: Traditional OHLC Bars
  - `line`: Close-price line series
  - `area`: Gradient-filled close-price area
  - `baseline`: Relative performance baseline against median value
- **Reactivity & Persistence Seam**:
  - Interacting with the picker invokes `chartSessionController.setPriceStyle(style)`.
  - The controller updates the active cell's native price style, emits a change event, and triggers persistence to the active workspace slot in SQLite.
  - If multi-chart style sync is enabled in `syncConfig.style`, the controller broadcasts the new style to all cells in the workspace.

### 3. Timeline Marks Subsystem
- **Dedicated Timeline Marks Controller**: Create a `TimelineMarksController` module that interfaces directly with Vela's `chart.marks` API (`MarksControl`).
- **Standardized Mark Groups**: Establish predefined hierarchical groups:
  - `macro`: Macroeconomic releases (subgroups: `high-impact`, `medium-impact`, `low-impact`).
  - `trades`: Execution fills from deterministic trading plans (`entries`, `take-profits`, `stop-losses`).
  - `journal`: Timestamped user thesis annotations and bookmarks.
- **Interaction Model**:
  - Marks render on the time scale with theme-consistent accent colors.
  - When hovered, show brief popover text.
  - When clicked, emit a structured event or render a detailed card containing event figures or trade details.
  - Integrate mark group visibility controls into `trawangan`'s existing chart appearance and settings tabs.

### 4. Pine Script Engine Hardening (`fetchSeries`)
- **Inter-Symbol Series Provider**: Implement a `fetchSeries` provider function:
  ```typescript
  type FetchSeriesHandler = (
    symbol: string,
    timeframe: string,
    range?: { from?: number; to?: number; limit?: number }
  ) => Promise<Array<[number, number, number, number, number, number]>>;
  ```
- **Routing & Caching**: The handler parses the requested symbol (supporting `EXCHANGE:TICKER` or bare ticker syntax), queries local SQLite cached klines first, and falls back to `marketFeed` / `universalFetch` across Indodax, Bitunix, Binance, Coinbase, Hyperliquid, Yahoo Finance, or Synthetic Macro providers.
- **Engine Injection**: Pass `fetchSeries` into `new PineWorkerEngine({ fetchSeries })` inside `chartSessionController`, enabling seamless `request.security()` resolution.

### 5. Strategy Execution Markers & Telemetry Surface
- **Execution Markers Binding**: Configure `PineWorkerEngine` to route strategy trade fills into Vela's renderer, painting visual `TradeExecution` marker units (green buy arrows below bars, red sell arrows above bars) on strategy activation.
- **Telemetry Extraction**: Expose a snapshot method on the session controller to read `IndicatorHandle.context()` when a script completes a computation run, extracting `StrategyState` and `StrategyTrade[]` for consumption by future performance inspector tabs.

---

## Testing Decisions

### Guiding Principles
- **Behavioral & Contract-Focused**: Test external observable behavior across the public APIs of the session controller, indicator catalog, and timeline marks manager. Avoid asserting internal DOM structures or mock-heavy private methods.
- **Local Substitutability**: Tests must execute in the lightweight headless `tsx --test` test suite without requiring WebGL2 canvas or browser environments, using mockable Vela chart stubs.

### Test Coverage Plan
1. **Indicator Catalog & Aggregator Tests**:
   - Verify `IndicatorCatalogService` loads and indexes all 76 native indicators from Vela alongside Pine presets.
   - Verify searching by title, short title, and category correctly filters both native and Pine entries.
   - Verify that adding a native indicator invokes `addNativeIndicator` on the chart cell, while adding a Pine script invokes `addIndicator`.
   - Verify that toggling favorites updates the persistent favorites set and correctly sorts favorite items to the top.
2. **Price Style Controller Tests**:
   - Verify that setting a price style updates the active cell and records the style in the workspace snapshot payload.
   - Verify that when style synchronization is active, changing price style in cell 0 propagates to cell 1..N.
   - Verify that switching to invalid or unknown price styles falls back gracefully to `'candles'`.
3. **Timeline Marks Controller Tests**:
   - Verify `TimelineMarksController.setMarks(marks)` properly formats and forwards items to `chart.marks.set()`.
   - Verify mark group definition and visibility toggle methods correctly update group status.
   - Verify clear marks on symbol change purges stale event markers.
4. **Pine `fetchSeries` Adapter Tests**:
   - Verify `fetchSeries` correctly normalizes symbol strings and delegates to the appropriate market provider.
   - Verify that cached historical bars are returned without unnecessary network dispatch.
   - Verify that range boundary conditions (`from`, `to`, `limit`) are respected when slicing series data.
5. **Prior Art**:
   - Align test structures with existing robust suites in `tests/commandDispatcher.test.ts`, `tests/macroIndexProvider.test.ts`, and `tests/workspaceLifecycle.test.ts`.

---

## Out of Scope

1. **Brokerage Connectivity & Real-Money Order Placement**: `trawangan` strictly adheres to its *Pure Charting Scope* (GLOSSARY.md). Strategy execution is purely simulated/backtested on historical data; no live broker order submission or API trading keys will be handled.
2. **Order Flow Footprint Data Feed (Level 2 / L2 Orderbook)**: While Vela's engine supports `request.footprint()`, integrating tick-level bid/ask order flow requires dedicated high-frequency Level 2 tick streaming infrastructure, which is deferred to a future milestone.
3. **Custom Non-Standard Chart Renderers (Renko, Point & Figure)**: Only the six standard styles provided out-of-the-box by Vela (`candles`, `heikinashi`, `bars`, `line`, `area`, `baseline`) will be exposed initially. Custom canvas transforms via `registerChartType` remain future work.
4. **Full-Blown Pine Strategy Code Editor Overhaul**: Editing and compiling Pine scripts will continue through the existing `PineEditorModal`. This spec focuses on capturing the telemetry and displaying on-chart trade execution markers, not redesigning the CodeMirror editor interface.

---

## Further Notes

- **Zero-Paywall Parity**: Unlocking 76 native indicators and institutional chart styles directly supports `trawangan`'s core value proposition of providing unrestricted professional-grade charting tools without subscriptions.
- **Performance Benefits**: Shifting common studies (SMA, EMA, RSI, MACD, Bollinger Bands, ATR) from Pine Web Workers to native WebGL2 calculation significantly reduces CPU and RAM consumption on low-power laptops and multi-cell grids.
- **Reference Documentation**: Full technical gap analysis and raw primary source citations are available in `docs/research/2026-11-13-vela-feature-gap-analysis.md`.
