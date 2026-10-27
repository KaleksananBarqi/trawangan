<script lang="ts">
  import {
    resolveCoinLogoUrl,
    getMonogramInitials,
    getMonogramColor,
  } from '../../services/symbolLogoService';

  interface Props {
    baseAsset: string;
    quoteAsset?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | number;
    showDualBadge?: boolean;
    class?: string;
  }

  let {
    baseAsset = '',
    quoteAsset = '',
    size = 'md',
    showDualBadge = false,
    class: customClass = '',
  }: Props = $props();

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

  const baseResolution = $derived(resolveCoinLogoUrl(baseAsset));
  const quoteResolution = $derived(quoteAsset ? resolveCoinLogoUrl(quoteAsset) : null);

  const shouldRenderDualBadge = $derived.by(() => {
    if (!quoteAsset) return false;
    const q = quoteAsset.toUpperCase();
    const b = baseAsset.toUpperCase();
    if (q === b) return false;
    if (showDualBadge) return true;
    // Tampilkan dual-badge jika bukan kuotasi standar USDT
    return q !== 'USDT';
  });

  // Sinkronisasi sumber gambar saat baseAsset atau quoteAsset berganti
  $effect(() => {
    if (baseAsset) {
      currentBaseSrc = baseResolution.primary;
      hasBaseError = false;
    }
  });

  $effect(() => {
    if (quoteAsset && quoteResolution) {
      currentQuoteSrc = quoteResolution.primary;
      hasQuoteError = false;
    }
  });

  // Penanganan error cascade 3-tier: Tier 1 (Lokal) -> Tier 2 (CDN Publik) -> Tier 3 (Monogram Avatar)
  function handleBaseError() {
    if (currentBaseSrc !== baseResolution.cdnFallback && baseResolution.cdnFallback) {
      currentBaseSrc = baseResolution.cdnFallback;
    } else {
      hasBaseError = true;
    }
  }

  function handleQuoteError() {
    if (quoteResolution && currentQuoteSrc !== quoteResolution.cdnFallback && quoteResolution.cdnFallback) {
      currentQuoteSrc = quoteResolution.cdnFallback;
    } else {
      hasQuoteError = true;
    }
  }
</script>

<div
  class="symbol-logo-container {customClass}"
  style="width: {pixelSize}px; height: {pixelSize}px;"
  title="{baseAsset}{quoteAsset ? '/' + quoteAsset : ''}"
>
  <!-- Logo Koin Utama / Monogram Avatar -->
  <div
    class="logo-base-wrapper"
    style="width: {pixelSize}px; height: {pixelSize}px;"
  >
    {#if !hasBaseError && currentBaseSrc}
      <img
        src={currentBaseSrc}
        alt="{baseAsset} logo"
        class="coin-img"
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

  <!-- Dual-Asset Badge: Mini Quote Badge di sudut kanan-bawah -->
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
  }

  .coin-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
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
