<script lang="ts">
  import { X, Check, Globe, Database, PlugZap, RefreshCw } from '@lucide/svelte';
  import type { ProviderConfig } from '../types/market';
  import { getSavedProviders, saveProviderConfig } from '../services/marketProvider';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen, onClose }: Props = $props();

  let providers = $state<ProviderConfig[]>([]);
  let activeId = $state('binance-default');
  let customName = $state('');
  let customRestUrl = $state('');
  let customWsUrl = $state('');
  let testStatus = $state<{ text: string; success: boolean } | null>(null);
  let isTesting = $state(false);

  $effect(() => {
    if (isOpen) {
      loadProviders();
    }
  });

  async function loadProviders() {
    try {
      providers = await getSavedProviders();
      const active = providers.find((p) => p.is_active);
      if (active) activeId = active.id;
    } catch (e) {
      console.error(e);
    }
  }

  async function handleTestConnection() {
    if (!customRestUrl) {
      testStatus = { text: 'Masukkan REST URL terlebih dahulu', success: false };
      return;
    }
    isTesting = true;
    testStatus = null;
    try {
      const res = await fetch(customRestUrl, { method: 'GET' });
      if (res.ok) {
        testStatus = { text: `Terkoneksi (HTTP ${res.status})`, success: true };
      } else {
        testStatus = { text: `Koneksi gagal (HTTP ${res.status})`, success: false };
      }
    } catch (err: any) {
      testStatus = { text: `Gagal: ${err.message || 'Network error'}`, success: false };
    } finally {
      isTesting = false;
    }
  }

  async function handleSaveCustomProvider() {
    if (!customName || !customRestUrl) return;

    const newProvider: ProviderConfig = {
      id: `custom-${Date.now()}`,
      name: customName,
      rest_url: customRestUrl,
      ws_url: customWsUrl || '',
      is_active: true,
    };

    await saveProviderConfig(newProvider);
    await loadProviders();
    activeId = newProvider.id;
    customName = '';
    customRestUrl = '';
    customWsUrl = '';
    testStatus = { text: 'Provider kustom berhasil disimpan ke SQLite!', success: true };
  }

  async function handleSelectProvider(p: ProviderConfig) {
    activeId = p.id;
    p.is_active = true;
    await saveProviderConfig(p);
  }
</script>

{#if isOpen}
  <div class="modal-backdrop">
    <div class="modal-card glass-panel">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-title">
          <Globe size={18} class="header-icon" />
          <h3>Pengaturan Data Feed Provider</h3>
        </div>
        <button class="close-btn" onclick={onClose}>
          <X size={18} />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <p class="modal-desc">
          Trawangan mendukung data provider pluggable. Anda bisa menggunakan preset exchange resmi atau menghubungkan endpoint kustom / private proxy sendiri.
        </p>

        <!-- Provider List -->
        <div class="section-title">
          <Database size={14} />
          <span>Provider Aktif & Tersimpan (SQLite)</span>
        </div>

        <div class="provider-list">
          {#each providers as p}
            <button
              type="button"
              class="provider-item {activeId === p.id ? 'active' : ''}"
              onclick={() => handleSelectProvider(p)}
            >
              <div class="item-info">
                <div class="item-name">{p.name}</div>
                <div class="item-url">{p.rest_url}</div>
              </div>
              {#if activeId === p.id}
                <span class="active-badge"><Check size={14} /> Aktif</span>
              {/if}
            </button>
          {/each}
        </div>

        <!-- Add Custom Provider Form -->
        <div class="section-title custom-form-title">
          <PlugZap size={14} />
          <span>Tambah Custom Endpoint Provider</span>
        </div>

        <div class="form-group">
          <label for="provider-name">Nama Provider</label>
          <input
            id="provider-name"
            type="text"
            placeholder="e.g. My Private Node / Local Aggregator"
            bind:value={customName}
          />
        </div>

        <div class="form-group">
          <label for="provider-rest">REST API Base URL (untuk historical candles)</label>
          <input
            id="provider-rest"
            type="text"
            placeholder="https://api.mycrypto-feed.com/v1"
            bind:value={customRestUrl}
          />
        </div>

        <div class="form-group">
          <label for="provider-ws">WebSocket Stream URL (opsional)</label>
          <input
            id="provider-ws"
            type="text"
            placeholder="wss://stream.mycrypto-feed.com/ws"
            bind:value={customWsUrl}
          />
        </div>

        {#if testStatus}
          <div class="test-feedback {testStatus.success ? 'success' : 'error'}">
            {testStatus.text}
          </div>
        {/if}

        <div class="form-actions">
          <button
            class="btn-secondary"
            disabled={isTesting}
            onclick={handleTestConnection}
          >
            {#if isTesting}
              <RefreshCw size={14} class="spin" />
            {/if}
            Uji Koneksi
          </button>
          <button class="btn-primary" onclick={handleSaveCustomProvider}>
            Simpan & Gunakan
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-card {
    width: 520px;
    max-width: 90vw;
    border-radius: var(--radius-lg);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-main);
  }

  :global(.header-icon) {
    color: var(--brand-cyan);
  }

  .modal-header h3 {
    font-size: 15px;
    font-weight: 600;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .close-btn:hover {
    color: var(--text-main);
  }

  .modal-body {
    padding: 20px;
  }

  .modal-desc {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
    margin-bottom: 16px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 10px;
  }

  .custom-form-title {
    margin-top: 20px;
  }

  .provider-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .provider-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
  }

  .provider-item:hover {
    background: var(--bg-hover);
    border-color: var(--border-medium);
  }

  .provider-item.active {
    background: var(--bg-active);
    border-color: var(--brand-cyan);
  }

  .item-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
  }

  .item-url {
    font-size: 11px;
    color: var(--text-dim);
  }

  .active-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--brand-cyan);
    background: rgba(0, 242, 254, 0.12);
    padding: 3px 8px;
    border-radius: 4px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .form-group label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .form-group input {
    background: var(--bg-darkest);
    border: 1px solid var(--border-medium);
    color: var(--text-main);
    padding: 8px 10px;
    font-size: 12px;
    border-radius: var(--radius-sm);
    outline: none;
  }

  .form-group input:focus {
    border-color: var(--brand-cyan);
  }

  .test-feedback {
    font-size: 11px;
    padding: 6px 10px;
    border-radius: 4px;
    margin-bottom: 12px;
  }
  .test-feedback.success {
    background: rgba(14, 203, 129, 0.15);
    color: var(--bull-color);
  }
  .test-feedback.error {
    background: rgba(246, 70, 93, 0.15);
    color: var(--bear-color);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 16px;
  }

  .btn-secondary,
  .btn-primary {
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 600;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s;
  }

  .btn-secondary {
    background: var(--bg-surface);
    border: 1px solid var(--border-medium);
    color: var(--text-main);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  .btn-primary {
    background: var(--brand-blue);
    border: 1px solid var(--brand-cyan);
    color: #fff;
  }

  .btn-primary:hover {
    background: #2563eb;
    box-shadow: 0 0 12px rgba(0, 242, 254, 0.4);
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }
</style>
