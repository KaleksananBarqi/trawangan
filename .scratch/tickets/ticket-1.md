## Parent

Part of #64

## What to build

Ensure technical drawings (trendlines, rays, shapes, text, etc.) are strictly isolated by exchange and symbol (`providerId:symbol`), so that drawings created on Binance (e.g. `BTCUSDT`) do not appear when switching to Bitunix (`BTCUSDT.P`), and vice versa.
When switching symbols or providers, the active drawing layer on the Vela WebGL2 canvas must be cleared atomically, and the drawings belonging to the target exchange/symbol loaded.
Historical legacy drawings saved without an exchange prefix must be preserved and automatically accessible under `binance`.

## Acceptance criteria

- [ ] Technical drawings are stored and retrieved using `(providerId, symbol, timeframe)` compound keys.
- [ ] Switching between different exchanges for the same base asset (e.g. Binance BTC to Bitunix BTC) cleans the canvas and restores only the target exchange's drawings.
- [ ] Legacy drawings in SQLite without an exchange prefix fall back to `binance` without data loss.
- [ ] Deleting or modifying a drawing on one exchange does not affect the drawings of another exchange.
- [ ] Automated regression tests in `tests/exchangeAwareDrawing.test.ts` pass cleanly.

## Blocked by

None (can start immediately)
