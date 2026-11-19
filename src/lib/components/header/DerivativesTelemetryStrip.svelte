<script lang="ts">
  import {
    formatCompactUsd,
    formatFundingRatePct,
    type DerivativesTelemetrySnapshot,
  } from '../../services/market/derivativesTelemetryService';

  interface Props {
    snapshot: DerivativesTelemetrySnapshot | null;
    livePrice?: number | null;
    liveChange24h?: number | null;
  }

  let { snapshot, livePrice = null, liveChange24h = null }: Props = $props();

  const displayPrice = $derived(livePrice ?? snapshot?.price ?? null);
  const displayChange = $derived(liveChange24h ?? snapshot?.change24hPct ?? null);

  function formatDisplayPrice(price: number | null): string {
    if (price === null || !Number.isFinite(price) || price <= 0) return '--';
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (price >= 1) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }

  function formatChangeBadge(pct: number | null): string {
    if (pct === null || !Number.isFinite(pct)) return '--';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  }

  const changeToneClass = $derived(
    displayChange === null ? 'neutral' : displayChange >= 0 ? 'bullish' : 'bearish'
  );

  const fundingToneClass = $derived.by(() => {
    const rate = snapshot?.fundingRate;
    if (rate === null || rate === undefined) return 'neutral';
    return rate >= 0 ? 'bullish' : 'bearish';
  });
</script>

<div class="telemetry-strip">
  <div class="price-block">
    <span class="live-price mono-nums">{formatDisplayPrice(displayPrice)}</span>
    <span class="change-badge mono-nums {changeToneClass}">
      {formatChangeBadge(displayChange)}
    </span>
  </div>

  <div class="metric-col">
    <span class="metric-label">24H VOLUME</span>
    <span class="metric-value mono-nums">{formatCompactUsd(snapshot?.volume24hUsd)}</span>
  </div>

  {#if snapshot?.showOpenInterest}
    <div class="metric-col">
      <span class="metric-label">OPEN INTEREST</span>
      <span class="metric-value mono-nums">{formatCompactUsd(snapshot.openInterestUsd)}</span>
    </div>
  {/if}

  {#if snapshot?.showFunding}
    <div class="metric-col">
      <span class="metric-label">FUNDING / COUNTDOWN</span>
      <div class="funding-pair mono-nums">
        <span class="funding-rate {fundingToneClass}">
          {formatFundingRatePct(snapshot.fundingRate)}
        </span>
        <span class="funding-countdown">{snapshot.countdownText}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .telemetry-strip {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    overflow: hidden;
  }

  .price-block {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .live-price {
    font-size: 13px;
    font-weight: 800;
    color: var(--text-main);
    letter-spacing: -0.01em;
  }

  .change-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: var(--radius-xs, 3px);
    line-height: 15px;
  }

  .change-badge.bullish {
    color: var(--status-bull, #10b981);
    background-color: color-mix(in srgb, var(--status-bull, #10b981) 14%, transparent);
  }

  .change-badge.bearish {
    color: var(--status-bear, #ef4444);
    background-color: color-mix(in srgb, var(--status-bear, #ef4444) 14%, transparent);
  }

  .change-badge.neutral {
    color: var(--text-dim);
    background-color: var(--bg-container);
  }

  .metric-col {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    line-height: 1.1;
    flex-shrink: 0;
  }

  .metric-label {
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-dim);
    text-transform: uppercase;
  }

  .metric-value {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-main);
  }

  .funding-pair {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    font-weight: 700;
  }

  .funding-rate.bullish {
    color: var(--status-bull, #10b981);
  }

  .funding-rate.bearish {
    color: var(--status-bear, #ef4444);
  }

  .funding-rate.neutral {
    color: var(--text-dim);
  }

  .funding-countdown {
    color: var(--text-muted);
    font-weight: 600;
  }
</style>
