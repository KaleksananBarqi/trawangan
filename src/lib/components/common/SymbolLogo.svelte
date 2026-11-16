<script lang="ts">
  import {
    resolveAssetLogoUrl,
    resolveQuoteLogoUrl,
    shouldShowDualAssetBadge,
    getMonogramInitials,
    getMonogramColor,
    type AssetLogoClass,
    type LogoResolution,
  } from '../../services/symbolLogoService';
  import { recordLogoFailure, recordLogoSuccess } from '../../services/symbolLogoCache';

  interface Props {
    baseAsset: string;
    quoteAsset?: string;
    symbol?: string;
    provider?: string;
    assetClass?: AssetLogoClass;
    size?: 'xs' | 'sm' | 'md' | 'lg' | number;
    showDualBadge?: boolean;
    class?: string;
  }

  let {
    baseAsset = '',
    quoteAsset = '',
    symbol = '',
    provider = '',
    assetClass,
    size = 'md',
    showDualBadge = false,
    class: customClass = '',
  }: Props = $props();

  let baseFallbackIndex = $state(0);
  let quoteFallbackIndex = $state(0);
  let currentBaseSrc = $state<string | null>(null);
  let currentQuoteSrc = $state<string | null>(null);
  let hasBaseError = $state(false);
  let hasQuoteError = $state(false);

  const pixelSize = $derived.by(() => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'xs': return 16;
      case 'sm': return 20;
      case 'md': return 24;
      case 'lg': return 32;
      default: return 24;
    }
  });

  const quotePixelSize = $derived(Math.max(9, Math.round(pixelSize * 0.52)));

  const baseResolution = $derived(
    resolveAssetLogoUrl(baseAsset || symbol, { symbol, provider, assetClass })
  );
  const quoteResolution = $derived(resolveQuoteLogoUrl(quoteAsset, baseResolution));
  const shouldRenderDualBadge = $derived(
    shouldShowDualAssetBadge(baseAsset, quoteAsset, baseResolution, showDualBadge)
  );

  $effect(() => {
    baseFallbackIndex = 0;
    currentBaseSrc = baseResolution.primary || null;
    hasBaseError = !baseResolution.primary;
  });

  $effect(() => {
    quoteFallbackIndex = 0;
    if (quoteResolution) {
      currentQuoteSrc = quoteResolution.primary || null;
      hasQuoteError = !quoteResolution.primary;
    } else {
      currentQuoteSrc = null;
      hasQuoteError = false;
    }
  });

  function handleBaseLoad() {
    if (currentBaseSrc && /^https?:\/\//i.test(currentBaseSrc) && baseResolution.cacheKey) {
      recordLogoSuccess(baseResolution.cacheKey, currentBaseSrc);
    }
  }

  function advanceFallback(
    resolution: LogoResolution | null,
    index: number,
    onNext: (url: string, nextIdx: number) => void,
    onExhausted: () => void
  ) {
    const nextUrl = resolution?.fallbacks[index];
    if (nextUrl) {
      onNext(nextUrl, index + 1);
    } else {
      onExhausted();
    }
  }

  function handleBaseError() {
    advanceFallback(
      baseResolution,
      baseFallbackIndex,
      (url, nextIdx) => {
        currentBaseSrc = url;
        baseFallbackIndex = nextIdx;
      },
      () => {
        hasBaseError = true;
        if (baseResolution.cacheKey) {
          recordLogoFailure(baseResolution.cacheKey);
        }
      }
    );
  }

  function handleQuoteError() {
    advanceFallback(
      quoteResolution,
      quoteFallbackIndex,
      (url, nextIdx) => {
        currentQuoteSrc = url;
        quoteFallbackIndex = nextIdx;
      },
      () => {
        hasQuoteError = true;
      }
    );
  }
</script>

<div
  class="symbol-logo-container {customClass}"
  style="width: {pixelSize}px; height: {pixelSize}px;"
  title="{baseAsset}{quoteAsset ? '/' + quoteAsset : ''}"
>
  <div
    class="logo-base-wrapper {!hasBaseError && currentBaseSrc && baseResolution.needsContrastBacking ? 'contrast-backing' : ''}"
    style="width: {pixelSize}px; height: {pixelSize}px;"
  >
    {#if !hasBaseError && currentBaseSrc}
      <img
        src={currentBaseSrc}
        alt="{baseAsset} logo"
        class="coin-img {baseResolution.needsContrastBacking ? 'contain-img' : ''}"
        onload={handleBaseLoad}
        onerror={handleBaseError}
        loading="lazy"
      />
    {:else}
      <div
        class="monogram-avatar"
        style="background: {getMonogramColor(baseAsset)}; font-size: {Math.max(7, Math.round(pixelSize * 0.4))}px;"
      >
        <span>{getMonogramInitials(baseAsset)}</span>
      </div>
    {/if}
  </div>

  {#if shouldRenderDualBadge && quoteResolution}
    <div
      class="logo-quote-badge"
      style="width: {quotePixelSize}px; height: {quotePixelSize}px; right: -{Math.round(quotePixelSize * 0.15)}px; bottom: -{Math.round(quotePixelSize * 0.15)}px;"
      title="Kuotasi: {quoteAsset}"
    >
      {#if !hasQuoteError && currentQuoteSrc}
        <img
          src={currentQuoteSrc}
          alt="{quoteAsset} logo"
          class="quote-img"
          onerror={handleQuoteError}
          loading="lazy"
        />
      {:else}
        <div
          class="quote-monogram"
          style="background: {getMonogramColor(quoteAsset)}; font-size: {Math.max(6, Math.round(quotePixelSize * 0.45))}px;"
        >
          <span>{getMonogramInitials(quoteAsset).slice(0, 2)}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .symbol-logo-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    user-select: none;
  }

  .logo-base-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.05);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    box-sizing: border-box;
  }

  .logo-base-wrapper.contrast-backing {
    background: rgba(248, 250, 252, 0.94);
    padding: 2px;
  }

  .coin-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 50%;
  }

  .coin-img.contain-img {
    object-fit: contain;
    border-radius: 50%;
  }

  .monogram-avatar {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-family: var(--font-brand, 'Plus Jakarta Sans', system-ui, sans-serif);
    color: #ffffff;
    border-radius: 50%;
    letter-spacing: -0.03em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }

  .logo-quote-badge {
    position: absolute;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    border: 1.5px solid #0f0f0f;
    z-index: 2;
  }

  .quote-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 50%;
  }

  .quote-monogram {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    color: #ffffff;
    border-radius: 50%;
  }
</style>
