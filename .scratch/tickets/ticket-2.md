## Parent

Part of #64

## What to build

Fix the asymmetric and stalled exchange switching in `handleSymbolChange` so that selecting a symbol from the search modal (or command palette) transitions to the specified exchange 100% deterministically.
Specifically, eliminate the condition that prevents switching from Bitunix or other providers back to Binance. When a user selects a Bitunix pair, the active provider must switch to Bitunix; when selecting a Binance pair, it must switch to Binance; and when selecting an Indodax pair, it must switch to Indodax.

## Acceptance criteria

- [ ] Selecting a Binance pair from search while currently on Bitunix immediately transitions `activeProviderId` and `marketFeed` to Binance.
- [ ] Selecting a Bitunix pair from search while currently on Binance or Indodax transitions to Bitunix.
- [ ] Selecting an Indodax pair transitions to Indodax.
- [ ] Visual indicators (topbar exchange pill, active provider status) immediately reflect the new venue.
- [ ] No race conditions between provider transition and symbol update.

## Blocked by

None (can start immediately)
