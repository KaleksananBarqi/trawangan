## Parent

Part of #64

## What to build

Upgrade the watchlist storage model, presentation components, and interaction contracts to preserve the originating exchange for each watchlist entry.
Store entries in the format `${providerId}:${symbol}` (e.g. `bitunix:BTCUSDT`, `binance:BTCUSDT`, `indodax:BTCIDR`) with backward compatibility for legacy un-prefixed records.
In the Watchlist panel, display crisp, color-coded exchange badges (`BINANCE`, `BITUNIX`, `INDODAX`) next to each ticker.
Clicking any entry in the Watchlist must navigate directly to both that symbol and its originating provider, allowing users to watch and toggle between Binance BTC and Bitunix BTC without them overwriting each other.

## Acceptance criteria

- [ ] Watchlist stores and serializes items as `${providerId}:${symbol}` strings, maintaining backward compatibility for legacy records.
- [ ] Watchlist panel renders visual exchange badges (`BINANCE`, `BITUNIX`, `INDODAX`) for each entry.
- [ ] Users can add the same symbol from different exchanges (e.g. `BTCUSDT` from Bitunix and `BTCUSDT` from Binance) to the watchlist simultaneously.
- [ ] Clicking a watchlist item immediately routes the active chart to the correct symbol and provider.
- [ ] Removing an entry only deletes that specific exchange/symbol pair.
- [ ] Automated regression tests in `tests/exchangeAwareWatchlist.test.ts` pass cleanly.

## Blocked by

- #65
- #66
- #67
