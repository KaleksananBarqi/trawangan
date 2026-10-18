# Specification: Exchange-Aware Drawing Isolation, Multi-Provider Watchlist, and Deterministic Feed Switching

## Problem Statement

Technical analysts and multi-exchange crypto traders in `trawangan` encounter severe data leaks, UI desynchronization, and network connection errors when navigating instruments across different exchanges (Binance, Bitunix, and Indodax):

1. **Drawing Leakage Across Disparate Exchanges (Cross-Exchange Drawing Contamination):**
   - When a user draws technical analysis shapes (e.g., trendlines, horizontal support/resistance lines, Fibonacci retracements, geometric boxes) on a pair in Binance (e.g., `BTCUSDT`), and then navigates to the same coin on Bitunix (`BTCUSDT.P`), the drawings from Binance remain persistently on the canvas.
   - Because the underlying Vela WebGL2 engine does not clear its active drawing layer on symbol/venue transitions, and the persistence adapter historically saved drawings with an exchange-agnostic key (`(symbol, timeframe)` rather than `(providerId, symbol, timeframe)`), drawings drawn against one exchange's specific price action, wicks, and spreads contaminate other exchanges.

2. **Exchange-Agnostic Watchlist Flattening and Silent Provider Loss:**
   - The watchlist system stores instruments as flat, bare symbol strings (`["BTCUSDT", "ETHUSDT"]`).
   - When a user adds a Bitunix perpetual pair from the search modal to their watchlist, the watchlist only records `"BTCUSDT"`.
   - When the user subsequently clicks that entry in the watchlist, the terminal fails to restore the Bitunix provider and silently defaults back to Binance, frustrating traders who specifically track futures or spot pairs on alternative venues.
   - Furthermore, the watchlist UI lacks any visual indicator or badge showing which exchange an instrument originates from.

3. **Non-Deterministic Provider Transitions and Spurious Network Error Triggers:**
   - In the presentation view (`handleSymbolChange`), provider switching logic is asymmetric: it contains an explicit guard that only transitions to Binance if the current provider is Indodax (`if (activeProviderId === 'indodax')`), preventing a clean transition to Binance when switching from Bitunix.
   - When the active exchange changes (e.g., switching to Indodax or Bitunix), the background polling loop (`marketFeed.pollTick`) continues requesting the entire flat watchlist across the active adapter. Because Indodax does not recognize USDT pairs and Bitunix does not recognize IDR pairs, the adapter receives empty batch responses, triggering consecutive failure counters and erroneously surfacing the yellow "Koneksi feed terhambat / diblokir ISP" warning banner even when the network connection is perfectly healthy.

---

## Solution

1. **Exchange-Aware Drawing Isolation (`Exchange-Aware Drawing Suite`):**
   - Bind drawing persistence keys strictly to `(providerId, symbol, timeframe)` (e.g., `binance:BTCUSDT`, `bitunix:BTCUSDT`, `indodax:BTCIDR`).
   - On every symbol or provider change, the drawing controller performs an atomic canvas wipe on the active chart drawings and asynchronously restores only the drawings associated with the incoming exchange and symbol.
   - Preserve historical drawings: legacy records in SQLite saved without an exchange prefix are automatically mapped to `binance` as an immutable legacy fallback.

2. **Exchange-Aware Watchlist Architecture (`Exchange-Aware Watchlist`):**
   - Upgrade the watchlist item data model to encapsulate the venue: `${providerId}:${symbol}` (e.g., `bitunix:BTCUSDT`, `binance:BTCUSDT`, `indodax:BTCIDR`), with full backward-compatibility for legacy un-prefixed records.
   - Render crisp, color-coded exchange badges (`BINANCE`, `BITUNIX`, `INDODAX`) alongside instrument tickers in the Watchlist panel.
   - Ensure clicking an item deterministically dispatches both the symbol and its originating `providerId` to the active session.

3. **Multi-Provider Watchlist Polling Multiplexer & Deterministic Switching:**
   - Overhaul `marketFeed.pollTick` into a multiplexer that partitions watchlist symbols by their bound provider, routing each batch only to its valid provider adapter.
   - Refactor `handleSymbolChange` to deterministically adopt the incoming `providerHint` without conditional blocks that stall between non-Indodax providers.

4. **Multi-Chart Drawing Sync Boundary:**
   - Enforce a strict exchange equality guard on multi-chart drawing synchronization: cross-cell drawing sync is only permitted between cells that share both the exact same symbol and the exact same `providerId`.

---

## User Stories

1. As a technical analyst drawing trendlines on Binance `BTCUSDT`, I want those lines to remain exclusively on Binance, so that switching to Bitunix `BTCUSDT.P` presents a clean canvas tailored to Bitunix price action.
2. As a futures trader charting Bitunix contracts, I want my Bitunix drawings to automatically persist and restore whenever I return to Bitunix, so that my work is never lost.
3. As a chartist with legacy drawings created prior to this update, I want my existing drawings automatically mapped to Binance, so that none of my historical technical setups disappear.
4. As a multi-exchange trader, I want to add `BTCUSDT` from Bitunix and `BTCUSDT` from Binance to my watchlist simultaneously, so that I can monitor both venues side by side.
5. As a trader glancing at my Watchlist panel, I want to see visual venue badges (`BITUNIX`, `BINANCE`, `INDODAX`) next to each symbol, so that I immediately know which market each row represents.
6. As a user clicking a Bitunix instrument in my Watchlist, I want the charting canvas to automatically switch to the Bitunix data provider and symbol, so that I don't have to manually re-select the exchange in settings.
7. As an Indonesian crypto trader clicking an Indodax `BTCIDR` pair in my Watchlist, I want the terminal to seamlessly transition to Indodax without throwing a provider mismatch error.
8. As a user searching for coins in Omni-Search, I want selecting a Bitunix or Binance result to transition the active charting session deterministically, so that the correct venue is loaded 100% of the time.
9. As a trader with mixed-exchange watchlist items, I want background price polling to query each exchange independently, so that missing pairs on one exchange do not trigger false "Network Error / Stalled Feed" banners.
10. As a user on a restricted network where Binance is blocked, I want selecting an Indodax or Bitunix pair to immediately clear any previous connection warnings and stream live candles without stalling.
11. As a multi-chart user utilizing a 2-grid layout with Binance BTC on the left and Bitunix BTC on the right, I want drawing tools on the left to stay on the left, so that price disparity between the two exchanges does not distort my chart.
12. As a multi-chart user with two Binance charts on different timeframes (15m and 4h), I want drawings to sync between them seamlessly when `syncConfig.drawings` is enabled, so that multi-timeframe analysis remains effortless.
13. As a trader deleting a drawing on Bitunix, I want the deletion to only affect Bitunix records in SQLite, leaving Binance drawings completely untouched.
14. As a user removing an item from the Watchlist, I want the removal to respect the specific `providerId:symbol` combination, so that removing `binance:BTCUSDT` does not remove `bitunix:BTCUSDT`.
15. As a keyboard power user using quick-symbol switching, I want rapid symbol transitions to debounce canvas drawing restoration safely, so that fast keystrokes do not cause race conditions or memory leaks.
16. As an automated test in CI, I want to verify drawing isolation headlessly across mock providers, ensuring regression-free multi-exchange persistence.
17. As an automated test in CI, I want to verify that the watchlist poller partitions symbols into correct adapter batches, ensuring zero empty-batch errors.
18. As a maintainer reviewing data structures, I want watchlist storage to maintain backward compatibility with legacy string arrays, so that user databases upgrade smoothly without manual migrations.
19. As a trader inspecting the Object Tree in the right dock panel, I want drawing items to accurately reflect the active exchange's drawings, so that I can hide or lock individual shapes reliably.
20. As a user saving a workspace, I want the saved workspace snapshot to preserve the active exchange and symbol cleanly, so that loading the workspace restores the complete technical setup seamlessly.

---

## Implementation Decisions

1. **Drawing Persistence Namespace Keying:**
   - In `ChartDrawingController` and `PersistenceAdapter`, drawing keys are normalized as `${providerId.toLowerCase()}:${symbol.toUpperCase()}` (e.g., `binance:BTCUSDT`).
   - When loading drawings, if no record is found for `binance:SYMBOL`, the loader checks the legacy un-prefixed `SYMBOL` record as a fallback, preserving backward compatibility.
   - When saving or clearing drawings, the key always includes the active `providerId`.

2. **Canvas Wipe on Chart Session Transition:**
   - Inside `ChartDrawingController`, provide an explicit `clearCanvasVisuals()` and `restoreDrawings(targetSymbol, targetTimeframe, providerId)` method.
   - In `ChartSessionController.setSymbol(symbol, timeframe, providerId)`, trigger a drawing layer reset and invoke `restoreDrawings` with the new target coordinates.

3. **Exchange-Aware Watchlist Encoding:**
   - Watchlist symbols are serialized as `${providerId}:${symbol}` strings in the SQLite `watchlist` table and in-memory stores.
   - Helper utilities `parseWatchlistEntry(raw: string): { symbol: string, providerId: string }` and `formatWatchlistEntry(symbol: string, providerId: string): string` provide standard serialization.
   - If a legacy un-prefixed entry (e.g., `"BTCUSDT"`) is read:
     - If it ends with `IDR`, assign `providerId = 'indodax'`.
     - Otherwise, assign `providerId = 'binance'`.

4. **Multi-Provider Polling Multiplexer:**
   - In `MarketFeedService.pollTick`, group active watchlist subscriptions by their resolved `providerId`.
   - Dispatch `fetchBatchTickers` concurrently to each respective registered adapter (`binance`, `bitunix`, `indodax`).
   - Merge resulting tickers into the centralized cache and evaluate price alerts globally.

5. **Deterministic Provider Switching in Presentation Layer:**
   - In `+page.svelte` (`handleSymbolChange`), eliminate the restrictive `if (activeProviderId === 'indodax')` condition.
   - When `providerHint` is present, unconditionally invoke `marketFeed.setActiveProvider(providerHint)` and update `activeProviderId` if it differs from the current active provider.

6. **Multi-Chart Sync Boundary Guard:**
   - When iterating over workspace cells during drawing sync events in `ChartSessionController`, verify that `cell.providerId === activeCell.providerId` before dispatching drawing synchronization.

---

## Testing Decisions

- **Behavioral, Seam-Level Tests:**
  - Tests will target the public contracts of `ChartDrawingController`, `MarketFeedService`, and `PersistenceService` directly, without relying on mock DOM nodes.
- **Test Modules:**
  1. `tests/exchangeAwareDrawing.test.ts`: Tests saving drawings on Binance, switching to Bitunix, verifying canvas clear, verifying independent persistence, and legacy fallback retrieval.
  2. `tests/exchangeAwareWatchlist.test.ts`: Tests adding identical symbols from different providers to watchlist, serialization/deserialization, backward-compatibility parsing, and removal.
  3. `tests/multiProviderPolling.test.ts`: Tests `MarketFeedService` batch partitioning, ensuring adapters only receive their own symbols, and verifying zero false failure recordings.
- **Prior Art:**
  - Leverages existing test patterns from `tests/workspacePersistence.test.ts`, `tests/chartDrawingController.test.ts`, and `tests/multiChartSync.test.ts`.

---

## Out of Scope

- Adding new third-party exchanges beyond the existing supported set (`binance`, `bitunix`, `indodax`, `hyperliquid`, `coinbase`).
- Cloud account synchronization for drawings or watchlists (local-first SQLite persistence only).
- Cross-exchange order execution or account balance management.

---

## Further Notes

- All changes strictly preserve `trawangan`'s performance budget: idle memory footprint must remain under 80 MB, and drawing switching must resolve in < 50ms without UI hitching.
