# Specification: Dual-Track Volume Architecture, Native WebGL Overlay, and Session VWAP Integration

## Problem Statement

Traders and technical analysts utilizing `trawangan` for cryptocurrency market analysis currently encounter a critical gap in liquidity and volume-weighted analysis tools:

1. **Absence of a Standard Volume Study in the Preset Library:**
   - In the indicator library modal, the presets are restricted to Trend, Momentum, Volatility, and Signals (`RSI`, `MACD`, `Bollinger Bands`, `Triple EMA Ribbon`, and `SuperTrend`).
   - There is no default or preset "Volume" indicator available for quick application, forcing users to either trade without volume or attempt writing custom Pine Script code.

2. **Failed and Blank VWAP Implementations:**
   - When users attempt to plot VWAP by authoring custom Pine Script scripts (e.g., typing `plot(vwap)` from Pine v4 conventions or `indicator("VWAP")` without `overlay=true`), the script fails with runtime errors (`vwap is not defined`) or renders an empty/misplaced plot in a disconnected sub-pane.
   - Users are left uncertain whether the platform actually fetches volume data from exchanges (such as Binance, Bitunix, or Indodax), leading to degraded confidence in the terminal's charting capabilities.

3. **Underutilized Native WebGL Volume Engine:**
   - While the underlying Vela WebGL2 engine contains an ultra-fast, zero-overhead native volume histogram implementation (`nativeType: 'volume'`), this capability is dormant and not exposed through the application's UI settings, Object Tree, or default chart initialization.

4. **Lack of Liquidity & Volume Categorization:**
   - As more studies are added, volume and liquidity tools lack a dedicated categorization in the indicator browser, making discovery unintuitive.

---

## Solution

1. **Dual-Track Volume Architecture (`Native Volume Overlay` & `Pine Script Volume Study`):**
   - **Native WebGL Volume Track (Default & High Performance):** Automatically activate the native WebGL volume histogram at the base of the primary price pane for every newly instantiated chart cell. It runs at a native 60 FPS without spawning additional Web Worker threads, adhering to the terminal's active theme palette.
   - **Pine Script Volume Study Track (Scripting & Flexibility):** Provide an official Pine Script v5 Volume preset in the indicator modal, featuring customizable up/down candle matching and an integrated 20-period Simple Moving Average (SMA) volume smoothing line.

2. **Official Session VWAP Preset (`Session VWAP`):**
   - Add an official Pine Script v5 preset for **Session VWAP** with `overlay=true`.
   - Calculate cumulative volume-weighted average price with automatic daily session resets aligned to exchange timezone (`ta.vwap`).
   - Equip the preset with institutional Dual Standard Deviation Bands (+1σ / -1σ and +2σ / -2σ) and translucent fill zones, complete with user-configurable inputs.

3. **Unified Object Tree & Settings Controls:**
   - Expose a global `showVolume: boolean` toggle in the terminal Settings modal (default: `true`).
   - Register Native Volume as a visible entity in the Unified Object Tree on the right dock rail, allowing users to toggle volume visibility per-cell with a single click.

4. **Dedicated 'Volume' Indicator Category:**
   - Introduce `'Volume'` as an official category in the indicator modal alongside `'Trend'`, `'Momentum'`, `'Volatility'`, and `'Signals'`.
   - Group both the Volume study and Session VWAP under this category.

5. **Multi-Chart Synchronization & Workspace Persistence:**
   - Persist the `showVolume` preference in `SavedWorkspace` and `ChartSessionSnapshot`.
   - Synchronize volume visibility state across grid cells when multi-chart layout synchronization is enabled.

---

## User Stories

1. As a technical analyst opening a cryptocurrency chart in `trawangan`, I want to see volume bars rendered at the bottom of the chart by default, so that I can immediately assess market liquidity without manual configuration.
2. As a scalper monitoring breakout candles, I want volume bars to be color-coded to match bullish and bearish price action, so that I can instantly identify buying vs. selling pressure.
3. As a day trader relying on VWAP, I want a pre-built Session VWAP indicator in the indicator modal, so that I can add it with a single click without having to write or debug Pine Script code.
4. As an institutional order flow trader, I want Session VWAP to feature standard deviation bands (+1σ and +2σ), so that I can evaluate overbought and oversold dynamic value areas.
5. As a trader using custom trading hours or session strategies, I want Session VWAP to reset automatically at the beginning of each trading day in the exchange's timezone, so that intraday volume calculations remain accurate.
6. As a user who prefers a clean, minimalist candlestick chart without volume distraction, I want to toggle volume visibility off in the Settings modal, so that my preference persists across terminal sessions.
7. As a chartist working with the Unified Object Tree, I want to see the Native Volume layer listed alongside other studies, so that I can hide or show it for the active cell with an eye icon.
8. As a multi-chart trader running a 4-chart layout, I want toggling volume visibility on the active chart to synchronize across all 4 charts when indicator/style sync is enabled, so that my workspace remains visually consistent.
9. As a swing trader customizing layout workspaces, I want my volume visibility preference to be saved in my named workspace presets, so that switching workspaces accurately restores my desired setup.
10. As a Pine Script programmer, I want an official Pine Script Volume preset with a 20-period Moving Average line, so that I can use it as a foundation for building custom volume breakout alerts.
11. As a user browsing the indicator modal, I want to click a dedicated 'Volume' category tab, so that I can quickly find all volume-related studies without sifting through unrelated momentum or trend indicators.
12. As a trader analyzing Indonesian rupiah pairs on Indodax, I want volume to render accurately using Indodax trading data, so that local exchange liquidity is correctly represented.
13. As a Bitunix perpetuals trader, I want volume and VWAP to reflect contract volume correctly, so that futures market dynamics are clear.
14. As a performance-conscious laptop user, I want the default volume overlay to be rendered directly via WebGL2 on the GPU, so that my battery and CPU worker threads are conserved.
15. As a user customizing indicator inputs, I want to adjust the standard deviation multipliers (e.g. from 1.0 to 1.5) on Session VWAP via a settings dialog, so that the bands align with my specific trading playbook.
16. As a trader who previously tried typing `plot(vwap)` and saw no output, I want clear, syntactically valid presets, so that I am never left confused by silent script failures.

---

## Implementation Decisions

1. **Primary Session Seam (`ChartSessionController`):**
   - Incorporate `showVolume: boolean` into `ChartSessionOptions` and `ChartSessionSnapshot`, defaulting to `true`.
   - Pass `volume: options.showVolume ?? true` to the `VelaWorkspace` initialization configuration.
   - Provide `setShowVolume(show: boolean)` on `ChartSessionController` to toggle `cell.volumeHidden` across active and follower cells, triggering subscriber notifications.

2. **Indicator Presets Extension (`indicatorPresets.ts`):**
   - Expand the `IndicatorPreset` category union type to include `'Volume'`:
     `category: 'Trend' | 'Momentum' | 'Volatility' | 'Signals' | 'Volume'`
   - Add official preset `vwap`:
     - Pine Script v5 code with `indicator("VWAP", shorttitle="VWAP", overlay=true)`
     - Uses `ta.vwap(hlc3)` or `ta.vwap` with daily reset logic.
     - Computes variance and standard deviation bands using `ta.stdev` or cumulative sum deviation.
     - Plots VWAP baseline (blue/cyan), Band 1 (+1σ/-1σ), Band 2 (+2σ/-2σ), and `fill` bands.
   - Add official preset `volume`:
     - Pine Script v5 code with `indicator("Volume", shorttitle="Vol", overlay=false, format=format.volume)`
     - Calculates `ta.sma(volume, 20)` for smoothing.
     - Plots volume columns colored conditionally on `close >= open ? #0ecb81 : #f6465d` and an orange MA line.

3. **Indicator Modal UX (`IndicatorModal.svelte`):**
   - Update `officialCategories` array to include `'Volume'`.
   - Ensure the search and category derivation properly display Volume presets when filtered.

4. **Unified Object Tree Seam (`ObjectTree.svelte` / `UnifiedObjectTree`):**
   - Detect presence of Native Volume on the active chart cell (`cell.presentNativeIndicators()` or `showVolume` state).
   - Display a dedicated "Volume (Native)" row under active studies with a toggle visibility button that delegates to `controller.setShowVolume()`.

5. **Persistence Schema (`persistence` / `workspaceService.ts`):**
   - Add `showVolume?: boolean` to `SavedWorkspace` interface.
   - Ensure workspace serialization captures `showVolume` and workspace restoration applies it during layout reconstruction.

---

## Testing Decisions

- **Test Focus (External Behavior over Implementation Details):**
  - Verify that `ChartSessionController` snapshot reflects `showVolume` state correctly.
  - Verify that toggling `showVolume` updates follower cells when multi-chart synchronization is enabled.
  - Verify that workspace save and load cycles faithfully preserve and restore `showVolume`.
  - Verify that Pine Script source codes for both `Volume` and `Session VWAP` compile and execute cleanly in PineTS without throwing syntax or runtime exceptions.
  - Verify that the 'Volume' category filter in indicator presets yields both presets.
- **Test File:**
  - `tests/volumeAndVwapIntegration.test.ts`
- **Prior Art:**
  - `tests/indicatorLifecycle.test.ts`
  - `tests/multiChartSync.test.ts`
  - `tests/workspacePersistence.test.ts`

---

## Out of Scope

- Anchored Volume Profile (AVP) or Fixed Range Volume Profile (FRVP) calculation modifications (already handled by Vela drawing tools).
- Order flow footprint / tick-by-tick delta cluster charts (requires specialized institutional data feed beyond standard kline OHLCV).
- Bid/ask volume delta splitting on historical bars where exchanges do not provide buy/sell quote volume.

---

## Further Notes

- Architecture documented in [docs/adr/0009-dual-track-volume-and-session-vwap.md](file:///c:/Projek/Trawangan/docs/adr/0009-dual-track-volume-and-session-vwap.md).
- Domain terms registered in [GLOSSARY.md](file:///c:/Projek/Trawangan/GLOSSARY.md).
