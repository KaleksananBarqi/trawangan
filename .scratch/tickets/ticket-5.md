## Parent

Part of #64

## What to build

Enforce an exchange equality boundary on drawing synchronization across multi-chart grid layouts (2-cell or 4-cell).
When `syncConfig.drawings` is enabled, drawing updates must only propagate between workspace cells that share both the same symbol and the exact same `providerId`.
If one chart cell displays Binance BTC and another displays Bitunix BTC, drawing synchronization must be skipped to prevent price scale distortion and coordinate mismatch between disparate venues.

## Acceptance criteria

- [ ] Drawing synchronization checks that both source and target cells share the same `providerId`.
- [ ] Multi-chart layouts with different exchanges for the same asset keep their respective drawings strictly isolated.
- [ ] Multi-chart layouts with the same exchange on different timeframes (e.g. 15m and 1h) synchronize drawings smoothly as expected.
- [ ] Automated regression tests in `tests/multiChartSync.test.ts` or dedicated suites verify this boundary.

## Blocked by

- #65
