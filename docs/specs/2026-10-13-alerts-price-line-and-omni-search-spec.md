# Specification: Comprehensive Price Alerts Flow, Persistent Price Line, and Omni-Search Engine

## Problem Statement

Users of the `trawangan` crypto technical charting terminal encounter three significant usability bottlenecks during market monitoring and charting analysis:

1. **Broken Price Alert Creation & Editing Flow:**
   - In the Price Alert creation modal, real-time ticker price ticks continuously re-trigger Svelte reactivity effects while the modal is open. Every few milliseconds as live price updates arrive, the price input value is wiped or overwritten, and text focus/selection is continuously forced, making manual numeric input via keyboard virtually impossible.
   - Once created, existing price alerts cannot be edited (target price, condition, or frequency cannot be amended) without completely deleting and recreating them.
   - Price alerts displayed on the chart canvas are purely static lines with no interactive capability to drag or reposition target price levels directly from the chart viewport.

2. **Intermittent Disappearance of the Last Price Line:**
   - The red/dynamic horizontal current price line indicating the latest market price frequently disappears from the charting viewport.
   - Root cause analysis reveals that viewport mutations (toggling logarithmic scale, inverting the scale, reloading workspace layouts, or resetting defaults) invoke canvas configuration patching without explicitly preserving the `currentPriceLine` flag. The underlying renderer scene silently resets `showPriceLine` to `undefined` (false), while the frontend application settings remain nominally active without triggering a re-render.

3. **Non-Intuitive, Rigid Watchlist and Symbol Search:**
   - The search input inside the Watchlist panel currently operates only as an isolated filter over already-added local symbols. When a user types a query such as "re" looking for Render Token (`RENDER`), nothing appears because the symbol has not yet been manually added to the local watchlist.
   - Quick-add inputs lack auto-completion and fuzzy matching, requiring users to guess and type exact symbol identifiers (e.g., `RENDERUSDT`).
   - Exchange provider adapters rely on small static arrays rather than dynamic exchange metadata, causing short queries to fail or return arbitrary results across multi-provider feeds (Binance, Indodax, Bitunix, Hyperliquid, Coinbase).

---

## Solution

1. **Stabilized Alert Lifecycle & Draggable Chart Alert Lines:**
   - Decouple modal form initialization from reactive live ticker ticks using untracked one-shot opening transitions. Users can manually type and edit prices without interruption.
   - Add percentage-based quick-offset buttons (`-5%`, `-2%`, `-1%`, `Current Market`, `+1%`, `+2%`, `+5%`) for rapid alert setup.
   - Expand the alert modal to support both Creation and Editing modes, enabling in-place amendments of existing alert parameters.
   - Transform chart alert lines into **Draggable Alert Lines**: users can grab the price alert badge directly on the chart canvas, drag it vertically to a new price level with live 60 FPS price projection, and release to commit the change with instant haptic/sound confirmation.

2. **Persistent Price Line Guard:**
   - Implement defensive configuration enforcement across the charting subsystem. Every layout mutation, scale state adjustment (Log/Linear/Invert), and cell recreation explicitly asserts `currentPriceLine: true`.
   - Implement an active scene guard that continuously verifies that the last price line renderer is active and styled across the full canvas width.

3. **Omni-Search Watchlist & Multi-Tier Multi-Exchange Engine:**
   - Upgrade the Watchlist search bar into an **Omni-Search Watchlist** bar: it instantly filters local symbols and simultaneously reveals a "Bursa (Exchange Results)" section beneath, with single-click `+` buttons to add pairs to the watchlist and instant chart navigation.
   - Implement a centralized multi-tier ranking engine across all supported exchanges (Binance Spot & Futures, Indodax IDR, Bitunix, Hyperliquid, Coinbase):
     - **Tier 1:** Exact ticker match or prefix ticker match (e.g., typing "re" immediately ranks `RENDER`, `REEF`, `REQ`, `REN`, `REI` at the top).
     - **Tier 2:** Prefix asset name match (e.g., "Render Token").
     - **Tier 3:** Substring/fuzzy match across symbols and project names.
   - Implement an offline-first background cache for full exchange pair registries (`exchangeInfo`), paired with an online fallback synthesizer so that newly listed or unindexed tokens remain fully searchable and loadable.

---

## User Stories

1. As a technical analyst, I want to type target alert prices manually in the alert dialog without my input getting erased or re-selected by live market price updates, so that I can set exact price levels quickly.
2. As a trader analyzing volatile assets, I want quick-offset percentage buttons (-2%, -1%, Current, +1%, +2%) in the alert dialog, so that I can set boundary alerts relative to the current market price with a single click.
3. As a chart user, I want the trigger condition (Crossing Up, Crossing Down, Crossing) to auto-adjust when I select a price above or below the current market price, so that my alert logic is always sound.
4. As a trader with active price alerts, I want to edit the price, trigger condition, frequency, and label of an existing alert from the Watchlist Alerts tab, so that I do not need to delete and re-enter alerts when market conditions shift.
5. As an active chartist, I want to drag an alert line vertically across the canvas using its price badge, so that I can reposition my price targets visually without opening a modal.
6. As a user dragging a chart alert line, I want to see the real-time target price update smoothly in the badge as I move the mouse, so that I know the exact price level before releasing.
7. As a trader releasing a dragged alert line, I want the new target price to be saved immediately with an audible chime and subtle notification toast, so that I receive instant confirmation that my alert is armed.
8. As a user reviewing existing chart alerts, I want clicking an alert badge on the chart to open the edit dialog, so that I can inspect and adjust its advanced settings.
9. As a chartist switching between Linear and Logarithmic price scales, I want the red/accent current market price line to remain visible at all times, so that I always know where the market is trading.
10. As a multi-chart user switching grid layouts or adding split panes, I want the current price line to persist across all cells, so that my charting workspace remains consistent.
11. As a trader switching timeframes or symbols, I want the current price line to render reliably as soon as the latest candle is received, so that there is no visual flicker or missing price indicator.
12. As a user resetting chart view or applying default chart settings, I want the current price line setting to stay protected against accidental deactivation, so that my analysis environment never degrades.
13. As a watchlist user, I want typing "re" into the Watchlist search bar to instantly display matching local symbols as well as relevant exchange pairs like RENDER, REEF, and REQ, so that I can discover and monitor assets effortlessly.
14. As an analyst looking for new assets, I want single-click "+" buttons on exchange search results inside the Watchlist panel, so that I can add pairs directly to my watchlist without leaving the sidebar.
15. As a trader searching in the Ctrl + K symbol search modal, I want query matching to prioritize ticker prefixes (e.g., "re" matches RENDER before arbitrary tokens containing "re" in their description), so that the most relevant assets appear first.
16. As a multi-exchange trader, I want the symbol search engine to aggregate results across Binance, Indodax, Bitunix, Hyperliquid, and Coinbase, so that I can find pairs regardless of the exchange venue.
17. As an Indodax trader, I want searching for IDR pairs to prioritize local Indodax spot markets when the IDR filter or keyword is used, so that I can find fiat pairs quickly.
18. As a user searching for an obscure or newly listed coin not yet cached locally, I want an online fallback search to query the exchange API directly, so that I am never prevented from charting valid trading instruments.
19. As a keyboard power user, I want arrow-key navigation and Enter key selection in both the Watchlist search and the Ctrl + K modal, so that I can switch chart symbols entirely via keyboard.
20. As an analyst monitoring trade setups, I want price alerts to support both "Once" and "Every Time" frequencies with persistent SQLite storage, so that my alert configuration survives application restarts.

---

## Implementation Decisions

1. **Alert Form Reactivity Decoupling:**
   - Modal initialization will run on one-shot open transitions (`isOpen` false -> true) using Svelte 5 untracked state reads. Live ticker ticks will update distance percentage readouts only, without touching input values or triggering element focus loops.
   - Unified modal contract accepting an optional `editingAlert` entity to toggle between Create and Update modes.

2. **Canvas Draggable Alert Line Interaction:**
   - The visual overlay alert badges will register pointerdown events that capture the cursor and engage the 60 FPS projection controller.
   - Live Y-coordinates will be mapped to exact price units via the price scale coordinate projector.
   - Pointer release triggers asynchronous persistence to the alert service with lightweight toast dispatch and audio feedback.

3. **Persistent Price Line Guard in Charting Core:**
   - Introduce an explicit assertion seam in the chart lifecycle controller: every configuration patch (`applyConfig`, `applyPriceScaleState`, workspace cell creation, layout rearrangement, and default settings restoration) strictly forces `priceScale.currentPriceLine = true`.
   - Establish a verification guard that inspects the active scene renderer state upon candle ingestion and re-enforces price line visibility whenever the scene property is lost.

4. **Omni-Search Watchlist & Multi-Tier Ranking Engine:**
   - Deconstruct Watchlist search into a dual-layer view:
     - Layer A: Filtered local watchlist items.
     - Layer B: Dynamic exchange search results with quick-add actions and quote badges.
   - Multi-tier ranking algorithm:
     - Tier 1: Exact ticker match or ticker starting with query (score 100).
     - Tier 2: Asset base starting with query (score 80).
     - Tier 3: Display name / project name starting with query (score 60).
     - Tier 4: Substring containment (score 40).
   - Multi-provider background registry caching with local storage persistence and dynamic online fallback generation.

---

## Testing Decisions

### What Makes a Good Test
- Tests must verify observable contracts, user interactions, and mathematical accuracy rather than internal private variables.
- All tests must run deterministically and fast without blocking on live external network connections (using mock adapters or synthetic fixtures).

### Modules Tested
- **Alert Service & Form State**: Verifies alert creation, parameter updates, frequency handling, toggle state, and alert triggering math (`tests/alertService.test.ts`).
- **Price Scale Overlay & Coordinate Projection**: Verifies accurate price-to-Y and Y-to-price bidirectional mapping for alert dragging (`tests/priceScaleOverlayController.test.ts`).
- **Multi-Tier Symbol Search Engine**: Verifies ranking order (prefix over substring, e.g., "re" matches RENDER before random tokens), multi-exchange aggregation, and fallback behavior (`tests/symbolSearch.test.ts`).
- **Current Price Line Configuration Enforcement**: Verifies that config patches retain `currentPriceLine` across scale transformations (`tests/chartPriceLineGuard.test.ts`).

### Prior Art
- `tests/priceScaleOverlayController.test.ts`
- `tests/marketFeed.test.ts`
- `tests/priceScaleLabels.test.ts`
- `tests/persistence.test.ts`

---

## Out of Scope

- Automated trade execution or brokerage order placement (strictly adheres to the Pure Charting Scope defined in GLOSSARY.md).
- Cloud-synced alert push notifications when the desktop application is fully closed.

---

## Further Notes

- All terminology adheres to [GLOSSARY.md](file:///c:/Projek/Trawangan/GLOSSARY.md), specifically **Omni-Search Watchlist**, **Draggable Alert Line**, and **Persistent Price Line Guard**.
