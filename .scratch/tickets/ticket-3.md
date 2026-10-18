## Parent

Part of #64

## What to build

Overhaul the background price polling loop (`marketFeed.pollTick`) into a multi-provider multiplexer that partitions watchlist symbols by their bound provider and queries each adapter (`binance`, `bitunix`, `indodax`) independently.
This ensures that switching to Indodax does not request USDT pairs from Indodax, and switching to Bitunix does not request IDR pairs from Bitunix, completely eliminating false "Network Error / Stalled Feed" triggers.

## Acceptance criteria

- [ ] `marketFeed.pollTick` groups symbols by resolved `providerId` before dispatching batch requests.
- [ ] Each provider adapter only receives batch queries for symbols it actually supports.
- [ ] Ticker responses from different providers are merged cleanly into the central ticker cache and alert evaluation system.
- [ ] Switching between exchanges does not cause empty batch responses or increment spurious connection error counters.
- [ ] Automated regression tests in `tests/multiProviderPolling.test.ts` pass cleanly.

## Blocked by

- #66
