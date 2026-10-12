<script lang="ts">
  import {
    Radio,
    Wifi,
    Check,
    RefreshCw,
    PlugZap,
    Trash2
  } from '@lucide/svelte';
  import type { ProviderConfig } from '../../types/market';
  import { marketFeed } from '../../services/market';

  interface Props {
    activeProviderId?: string;
    onProviderChange?: (providerId: string) => void;
  }

  let {
    activeProviderId = 'binance',
    onProviderChange
  }: Props = $props();

  let providersList = $state<ProviderConfig[]>([]);
  let selectedProviderId = $state('binance');
  let showCustomForm = $state(false);
  let customName = $state('');
  let customRestUrl = $state('');
  let customWsUrl = $state('');
  let isTestingConnection = $state(false);
  let testFeedback = $state<{ success: boolean; message: string } | null>(null);

  async function loadProviders() {
    try {
      providersList = await marketFeed.getSavedProviders();
      const active = providersList.find((p) => p.is_active);
      if (active) {
        selectedProviderId = active.id;
      } else if (activeProviderId) {
        selectedProviderId = activeProviderId;
      }
    } catch (err) {
      console.error('Gagal memuat provider data:', err);
    }
  }

  $effect(() => {
    loadProviders();
  });

  $effect(() => {
    if (activeProviderId) {
      selectedProviderId = activeProviderId;
    }
  });

  let customProviders = $derived(
    providersList.filter((p) => !['binance', 'bitunix', 'hyperliquid', 'coinbase'].includes(p.id))
  );

  let selectedProviderName = $derived.by(() => {
    if (selectedProviderId === 'binance') return 'Binance Official Public';
    if (selectedProviderId === 'bitunix') return 'Bitunix Futures (USDT-M)';
    if (selectedProviderId === 'hyperliquid') return 'Hyperliquid DEX Perpetuals';
    if (selectedProviderId === 'coinbase') return 'Coinbase Exchange Spot';
    const custom = providersList.find((p) => p.id === selectedProviderId);
    return custom ? custom.name : 'Binance Official';
  });

  async function handleSwitchProvider(providerId: string) {
    selectedProviderId = providerId;
    await marketFeed.setActiveProvider(providerId);
    await loadProviders();
    onProviderChange?.(providerId);
  }

  async function handleTestCustomConnection() {
    if (!customRestUrl.trim()) {
      testFeedback = { success: false, message: 'Masukkan REST API Base URL terlebih dahulu.' };
      return;
    }
    isTestingConnection = true;
    testFeedback = null;
    const start = performance.now();
    try {
      const res = await fetch(customRestUrl.trim(), { method: 'GET', mode: 'cors' });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok || res.status < 400) {
        testFeedback = {
          success: true,
          message: `Endpoint terjangkau! HTTP ${res.status} (${elapsed}ms latency)`
        };
      } else {
        testFeedback = {
          success: false,
          message: `Endpoint merespon status error HTTP ${res.status} (${elapsed}ms)`
        };
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      testFeedback = {
        success: false,
        message: `Gagal ping endpoint (${elapsed}ms): ${err.message || 'CORS / Network Error'}`
      };
    } finally {
      isTestingConnection = false;
    }
  }

  async function handleSaveCustomProvider() {
    if (!customName.trim() || !customRestUrl.trim()) {
      testFeedback = { success: false, message: 'Nama dan REST URL wajib diisi.' };
      return;
    }
    const newConfig: ProviderConfig = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      rest_url: customRestUrl.trim(),
      ws_url: customWsUrl.trim(),
      is_active: true
    };
    await marketFeed.saveProviderConfig(newConfig);
    await loadProviders();
    selectedProviderId = newConfig.id;
    onProviderChange?.(newConfig.id);
    customName = '';
    customRestUrl = '';
    customWsUrl = '';
    showCustomForm = false;
    testFeedback = { success: true, message: 'Custom node berhasil disimpan dan diaktifkan!' };
  }

  async function handleDeleteCustomProvider(id: string) {
    await marketFeed.deleteProvider(id);
    await loadProviders();
    if (selectedProviderId === id) {
      handleSwitchProvider('binance');
    }
  }
</script>

<div class="section-group">
  <!-- Status Header Banner -->
  <div class="feed-status-card">
    <div class="feed-status-left">
      <span class="feed-pulsing-pip"></span>
      <div class="feed-status-text">
        <span class="feed-eyebrow">FEED AKTIF SAAT INI</span>
        <span class="feed-current-name font-bold text-bull">{selectedProviderName}</span>
      </div>
    </div>
    <div class="feed-status-right">
      <span class="feed-tag live"><Radio size={11} /> WebGL2 Stream</span>
      <span class="feed-tag latency mono-nums"><Wifi size={11} /> &lt;40ms</span>
    </div>
  </div>

  <!-- Preset Bursa Resmi -->
  <div>
    <h4 class="section-title">Bursa & Preset Resmi (Vela Native)</h4>
    <p class="section-desc">
      Didukung secara langsung oleh renderer WebGL2 Vela tanpa perlu konfigurasi API key tambahan.
    </p>
  </div>

  <div class="provider-grid">
    <!-- Binance Preset Card -->
    <button
      type="button"
      class="provider-card {selectedProviderId === 'binance' ? 'selected' : ''}"
      onclick={() => handleSwitchProvider('binance')}
    >
      <div class="card-header">
        <div class="brand-box">
          <div class="avatar binance">B</div>
          <div>
            <div class="brand-title">Binance Official</div>
            <div class="brand-subtitle">Spot & USDT Perpetuals</div>
          </div>
        </div>
        {#if selectedProviderId === 'binance'}
          <span class="badge-active"><Check size={11} /> Aktif</span>
        {:else}
          <span class="badge-choose">Pilih</span>
        {/if}
      </div>
      <p class="card-caption">
        Bursa crypto global dengan likuiditas nomor satu dan update tick kline milidetik.
      </p>
      <div class="card-meta">
        <span class="meta-pill">Global Liquid</span>
        <span class="meta-pill highlight">Rekomendasi</span>
      </div>
    </button>

    <!-- Bitunix Futures Preset Card -->
    <button
      type="button"
      class="provider-card {selectedProviderId === 'bitunix' ? 'selected' : ''}"
      onclick={() => handleSwitchProvider('bitunix')}
    >
      <div class="card-header">
        <div class="brand-box">
          <div class="avatar bitunix">BX</div>
          <div>
            <div class="brand-title">Bitunix Futures</div>
            <div class="brand-subtitle">USDT-Margined Perpetuals</div>
          </div>
        </div>
        {#if selectedProviderId === 'bitunix'}
          <span class="badge-active"><Check size={11} /> Aktif</span>
        {:else}
          <span class="badge-choose">Pilih</span>
        {/if}
      </div>
      <p class="card-caption">
        Data feed kontrak futures perpetual Bitunix dengan direct REST klines dan orderbook futures.
      </p>
      <div class="card-meta">
        <span class="meta-pill">Futures Perp</span>
        <span class="meta-pill highlight">Trawangan Feed</span>
      </div>
    </button>

    <!-- Hyperliquid Preset Card -->
    <button
      type="button"
      class="provider-card {selectedProviderId === 'hyperliquid' ? 'selected' : ''}"
      onclick={() => handleSwitchProvider('hyperliquid')}
    >
      <div class="card-header">
        <div class="brand-box">
          <div class="avatar hyperliquid">H</div>
          <div>
            <div class="brand-title">Hyperliquid DEX</div>
            <div class="brand-subtitle">On-chain L1 Perpetuals</div>
          </div>
        </div>
        {#if selectedProviderId === 'hyperliquid'}
          <span class="badge-active"><Check size={11} /> Aktif</span>
        {:else}
          <span class="badge-choose">Pilih</span>
        {/if}
      </div>
      <p class="card-caption">
        DEX perpetual terdesentralisasi on-chain dengan orderbook L1 berkecepatan tinggi.
      </p>
      <div class="card-meta">
        <span class="meta-pill">Decentralized</span>
        <span class="meta-pill">Direct WS</span>
      </div>
    </button>

    <!-- Coinbase Preset Card -->
    <button
      type="button"
      class="provider-card {selectedProviderId === 'coinbase' ? 'selected' : ''}"
      onclick={() => handleSwitchProvider('coinbase')}
    >
      <div class="card-header">
        <div class="brand-box">
          <div class="avatar coinbase">C</div>
          <div>
            <div class="brand-title">Coinbase Exchange</div>
            <div class="brand-subtitle">Regulated US Spot</div>
          </div>
        </div>
        {#if selectedProviderId === 'coinbase'}
          <span class="badge-active"><Check size={11} /> Aktif</span>
        {:else}
          <span class="badge-choose">Pilih</span>
        {/if}
      </div>
      <p class="card-caption">
        Standar bursa teregulasi AS dengan orderbook spot institusional.
      </p>
      <div class="card-meta">
        <span class="meta-pill">Institutional</span>
        <span class="meta-pill">US Spot</span>
      </div>
    </button>
  </div>

  <!-- Custom Node / Proxy Gateway Section -->
  <div class="custom-section">
    <div class="custom-header">
      <div>
        <h4 class="section-title">Koneksi Node / Proxy Kustom</h4>
        <p class="section-desc">
          Hubungkan gateway lokal, internal relay proxy, atau private aggregator node Anda.
        </p>
      </div>
      <button
        class="btn-custom-toggle"
        onclick={() => (showCustomForm = !showCustomForm)}
      >
        {showCustomForm ? 'Tutup Formulir' : '+ Tambah Custom Endpoint'}
      </button>
    </div>

    {#if showCustomForm}
      <div class="custom-form-panel">
        <div class="form-field">
          <label for="custom-name">Nama Provider / Node</label>
          <input
            id="custom-name"
            type="text"
            placeholder="e.g. My Private Relay / Local Node"
            bind:value={customName}
            class="text-input"
          />
        </div>

        <div class="form-field">
          <label for="custom-rest">REST API Base URL (Kline Historis)</label>
          <input
            id="custom-rest"
            type="text"
            placeholder="https://api.myfeed.com atau http://127.0.0.1:8080"
            bind:value={customRestUrl}
            class="text-input mono-nums"
          />
        </div>

        <div class="form-field">
          <label for="custom-ws">WebSocket Stream URL (Opsional)</label>
          <input
            id="custom-ws"
            type="text"
            placeholder="wss://stream.myfeed.com/ws"
            bind:value={customWsUrl}
            class="text-input mono-nums"
          />
        </div>

        {#if testFeedback}
          <div class="feedback-banner {testFeedback.success ? 'success' : 'error'} mono-nums">
            {testFeedback.message}
          </div>
        {/if}

        <div class="form-btn-group">
          <button
            class="btn-ping"
            disabled={isTestingConnection}
            onclick={handleTestCustomConnection}
          >
            {#if isTestingConnection}
              <RefreshCw size={13} class="spin" />
              <span>Menguji...</span>
            {:else}
              <PlugZap size={13} />
              <span>Uji Koneksi (Ping)</span>
            {/if}
          </button>
          <button class="btn-save" onclick={handleSaveCustomProvider}>
            <Check size={13} />
            <span>Simpan & Terapkan</span>
          </button>
        </div>
      </div>
    {/if}

    <!-- Custom Providers List -->
    {#if customProviders.length > 0}
      <div class="custom-list">
        {#each customProviders as cp}
          <div class="custom-item {selectedProviderId === cp.id ? 'active' : ''}">
            <div class="custom-item-info">
              <span class="custom-item-name font-bold">{cp.name}</span>
              <span class="custom-item-url mono-nums">{cp.rest_url}</span>
            </div>
            <div class="custom-item-actions">
              {#if selectedProviderId === cp.id}
                <span class="badge-active"><Check size={11} /> Aktif</span>
              {:else}
                <button
                  class="btn-use-custom"
                  onclick={() => handleSwitchProvider(cp.id)}
                >
                  Gunakan
                </button>
              {/if}
              <button
                class="btn-trash"
                title="Hapus Provider Kustom"
                onclick={() => handleDeleteCustomProvider(cp.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .section-group {
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-desc {
    font-size: 11px;
    color: var(--text-dim, #6e7681);
    margin: 4px 0 0 0;
    line-height: 1.4;
  }

  .text-bull {
    color: #3fb950;
  }

  .font-bold {
    font-weight: 700;
  }

  .feed-status-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
  }

  .feed-status-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .feed-pulsing-pip {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #3fb950;
    box-shadow: 0 0 8px #3fb950;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.9); }
  }

  .feed-status-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .feed-eyebrow {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-dim, #6e7681);
  }

  .feed-current-name {
    font-size: 13px;
  }

  .feed-status-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .feed-tag {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .feed-tag.live {
    background-color: rgba(63, 185, 80, 0.1);
    color: #3fb950;
    border: 1px solid rgba(63, 185, 80, 0.25);
  }

  .feed-tag.latency {
    background-color: rgba(56, 189, 248, 0.1);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.25);
  }

  .provider-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }

  .provider-card {
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .provider-card:hover {
    background-color: var(--bg-hover, #21262d);
    border-color: var(--border-focus, #58a6ff);
  }

  .provider-card.selected {
    border-color: #3fb950;
    background-color: rgba(63, 185, 80, 0.05);
    box-shadow: 0 0 14px rgba(63, 185, 80, 0.12);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .brand-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
  }

  .avatar.binance { background-color: #F0B90B; color: #000; }
  .avatar.bitunix { background-color: #06B6D4; color: #000; }
  .avatar.hyperliquid { background-color: #50E3C2; color: #000; }
  .avatar.coinbase { background-color: #0052FF; color: #fff; }

  .brand-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-base, #ffffff);
  }

  .brand-subtitle {
    font-size: 9px;
    color: var(--text-dim, #6e7681);
  }

  .badge-active {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 700;
    background-color: rgba(63, 185, 80, 0.15);
    color: #3fb950;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(63, 185, 80, 0.3);
  }

  .badge-choose {
    font-size: 10px;
    color: var(--text-dim, #6e7681);
    padding: 2px 6px;
    background-color: var(--bg-hover, #21262d);
    border-radius: 4px;
    border: 1px solid var(--border-subtle, #30363d);
  }

  .card-caption {
    font-size: 10px;
    color: var(--text-dim, #8b949e);
    line-height: 1.4;
    margin: 0;
    flex: 1;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .meta-pill {
    font-size: 9px;
    color: var(--text-dim, #6e7681);
    background-color: var(--bg-subtle, #0d1117);
    padding: 2px 5px;
    border-radius: 4px;
  }

  .meta-pill.highlight {
    color: #3fb950;
    background-color: rgba(63, 185, 80, 0.1);
  }

  .custom-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 4px;
  }

  .custom-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-custom-toggle {
    font-size: 11px;
    font-weight: 600;
    background: transparent;
    border: 1px solid var(--border-subtle, #30363d);
    color: var(--text-base, #ffffff);
    padding: 5px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-custom-toggle:hover {
    background-color: var(--bg-hover, #21262d);
    border-color: var(--border-focus, #58a6ff);
  }

  .custom-form-panel {
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-field label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-dim, #6e7681);
  }

  .text-input {
    background-color: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    color: var(--text-base, #ffffff);
    padding: 6px 10px;
    font-size: 11px;
    border-radius: 4px;
    outline: none;
  }

  .text-input:focus {
    border-color: var(--border-focus, #58a6ff);
  }

  .feedback-banner {
    font-size: 11px;
    padding: 6px 10px;
    border-radius: 4px;
  }

  .feedback-banner.success {
    background-color: rgba(63, 185, 80, 0.1);
    color: #3fb950;
    border: 1px solid rgba(63, 185, 80, 0.25);
  }

  .feedback-banner.error {
    background-color: rgba(248, 81, 73, 0.1);
    color: #f85149;
    border: 1px solid rgba(248, 81, 73, 0.25);
  }

  .form-btn-group {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .btn-ping, .btn-save {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-ping {
    background-color: var(--bg-hover, #21262d);
    border: 1px solid var(--border-subtle, #30363d);
    color: var(--text-base, #ffffff);
  }

  .btn-ping:hover {
    border-color: var(--border-focus, #58a6ff);
  }

  .btn-save {
    background-color: #238636;
    border: 1px solid #2ea043;
    color: #ffffff;
  }

  .btn-save:hover {
    background-color: #2ea043;
  }

  .custom-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .custom-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
  }

  .custom-item.active {
    border-color: #3fb950;
    background-color: rgba(63, 185, 80, 0.05);
  }

  .custom-item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .custom-item-name {
    font-size: 11px;
    color: var(--text-base, #ffffff);
  }

  .custom-item-url {
    font-size: 10px;
    color: var(--text-dim, #6e7681);
  }

  .custom-item-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-use-custom {
    font-size: 10px;
    padding: 3px 8px;
    background-color: var(--bg-hover, #21262d);
    border: 1px solid var(--border-subtle, #30363d);
    color: var(--text-base, #ffffff);
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-use-custom:hover {
    border-color: var(--border-focus, #58a6ff);
  }

  .btn-trash {
    background: transparent;
    border: none;
    color: var(--text-dim, #6e7681);
    cursor: pointer;
    padding: 3px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-trash:hover {
    color: #f85149;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
