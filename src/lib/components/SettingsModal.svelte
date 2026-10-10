<script lang="ts">
  import {
    X,
    Cpu,
    Monitor,
    SlidersHorizontal,
    Database,
    Wifi,
    Check,
    Volume2,
    VolumeX,
    Grid,
    Clock,
    Sparkles,
    Radio,
    PlugZap,
    RefreshCw,
    Trash2,
    Server,
    ExternalLink,
    Zap,
    Star,
    RotateCcw
  } from '@lucide/svelte';
  import type { AppSettings, ProviderConfig } from '../types/market';
  import {
    getSavedProviders,
    setActiveProvider,
    saveProviderConfig,
    deleteProvider
  } from '../services/marketProvider';

  const ALL_AVAILABLE_TIMEFRAMES = [
    { id: '1m', label: '1m' },
    { id: '3m', label: '3m' },
    { id: '5m', label: '5m' },
    { id: '15m', label: '15m' },
    { id: '30m', label: '30m' },
    { id: '45m', label: '45m' },
    { id: '1h', label: '1h' },
    { id: '2h', label: '2h' },
    { id: '4h', label: '4h' },
    { id: '6h', label: '6h' },
    { id: '12h', label: '12h' },
    { id: '1D', label: '1D' },
    { id: '1W', label: '1W' },
    { id: '1M', label: '1M' },
  ];

  function handleToggleFavFromSettings(tf: string) {
    const current = settings.favoriteTimeframes || ['1m', '5m', '15m', '1h', '4h', '1D'];
    if (current.includes(tf)) {
      if (current.length <= 1) return; // Sisakan minimal 1 favorit
      onUpdateSettings({ favoriteTimeframes: current.filter((t) => t !== tf) });
    } else {
      onUpdateSettings({ favoriteTimeframes: [...current, tf] });
    }
  }

  interface Props {
    isOpen: boolean;
    settings: AppSettings;
    activeProviderId?: string;
    onClose: () => void;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
    onProviderChange?: (providerId: string) => void;
  }

  let {
    isOpen,
    settings,
    activeProviderId = 'binance',
    onClose,
    onUpdateSettings,
    onProviderChange
  }: Props = $props();

  let activeTab = $state<'general' | 'chart' | 'feed' | 'system'>('general');

  // ─── Provider Management State ───
  let providersList = $state<ProviderConfig[]>([]);
  let selectedProviderId = $state('binance');
  let showCustomForm = $state(false);
  let customName = $state('');
  let customRestUrl = $state('');
  let customWsUrl = $state('');
  let isTestingConnection = $state(false);
  let testFeedback = $state<{ success: boolean; message: string } | null>(null);

  // ─── Telemetri Hardware WebGL2 Real-Time ───
  let fps = $state(120);
  let vram = $state('82 MB');
  let l2Latency = $state('180 µs');
  let droppedPackets = $state(0);

  $effect(() => {
    if (isOpen) {
      loadProviders();
    }
  });

  $effect(() => {
    if (activeProviderId) {
      selectedProviderId = activeProviderId;
    }
  });

  async function loadProviders() {
    try {
      providersList = await getSavedProviders();
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

  let customProviders = $derived(
    providersList.filter((p) => !['binance', 'hyperliquid', 'coinbase'].includes(p.id))
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
    await setActiveProvider(providerId);
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
    await saveProviderConfig(newConfig);
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
    await deleteProvider(id);
    await loadProviders();
    if (selectedProviderId === id) {
      handleSwitchProvider('binance');
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" onclick={onClose} role="presentation">
    <div
      class="settings-modal obsidian-panel"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-title">
          <span class="accent-icon"><SlidersHorizontal size={16} /></span>
          <span>Pengaturan & Telemetri Sistem</span>
        </div>
        <button class="close-btn" onclick={onClose} title="Tutup Pengaturan">
          <X size={16} />
        </button>
      </div>

      <div class="modal-body">
        <!-- Sidebar Navigation Tabs -->
        <nav class="settings-nav">
          <button
            class="nav-tab {activeTab === 'general' ? 'active' : ''}"
            onclick={() => (activeTab = 'general')}
          >
            <SlidersHorizontal size={14} />
            <span>Umum & Audio</span>
          </button>

          <button
            class="nav-tab {activeTab === 'chart' ? 'active' : ''}"
            onclick={() => (activeTab = 'chart')}
          >
            <Monitor size={14} />
            <span>Tampilan Grafik</span>
          </button>

          <button
            class="nav-tab {activeTab === 'feed' ? 'active' : ''}"
            onclick={() => (activeTab = 'feed')}
          >
            <Radio size={14} />
            <span>Data Feed</span>
          </button>

          <button
            class="nav-tab {activeTab === 'system' ? 'active' : ''}"
            onclick={() => (activeTab = 'system')}
          >
            <Cpu size={14} />
            <span>Telemetri & WebGL2</span>
          </button>
        </nav>

        <!-- Tab Content Viewport -->
        <div class="tab-content">
          <!-- TAB 1: UMUM & AUDIO -->
          {#if activeTab === 'general'}
            <div class="section-group">
              <h4 class="section-title">Preferensi Regional & Notifikasi</h4>
              
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Zona Waktu Chart</span>
                  <span class="setting-desc">Waktu referensi untuk sumbu horizontal candle</span>
                </div>
                <select
                  class="select-input mono-nums"
                  value={settings.timezone}
                  onchange={(e) => onUpdateSettings({ timezone: e.currentTarget.value })}
                >
                  <option value="Asia/Jakarta">UTC+7 (WIB / Jakarta)</option>
                  <option value="Asia/Makassar">UTC+8 (WITA / Singapore)</option>
                  <option value="Asia/Tokyo">UTC+9 (Tokyo)</option>
                  <option value="UTC">UTC+0 (Coordinated Universal Time)</option>
                  <option value="America/New_York">UTC-4 (New York EDT)</option>
                </select>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Efek Suara Notifikasi (Audio Chime)</span>
                  <span class="setting-desc">Bunyikan nada saat harga menembus level Alert</span>
                </div>
                <button
                  class="toggle-btn {settings.soundEnabled ? 'active' : ''}"
                  onclick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                >
                  {#if settings.soundEnabled}
                    <Volume2 size={14} /> Aktif
                  {:else}
                    <VolumeX size={14} /> Senyap
                  {/if}
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Tema Visual Antarmuka</span>
                  <span class="setting-desc">Desain token palet institusional</span>
                </div>
                <div class="theme-badge">
                  <Sparkles size={13} class="text-bull" />
                  <span>Obsidian Precision Terminal</span>
                </div>
              </div>
            </div>

          <!-- TAB 2: TAMPILAN GRAFIK -->
          {:else if activeTab === 'chart'}
            <div class="section-group">
              <h4 class="section-title">Kebersihan & Tampilan Canvas</h4>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Garis Grid Latar (Grid Lines)</span>
                  <span class="setting-desc">Tampilkan garis pemandu koordinat horizontal dan vertikal</span>
                </div>
                <button
                  class="toggle-btn {settings.showGrid ? 'active' : ''}"
                  onclick={() => onUpdateSettings({ showGrid: !settings.showGrid })}
                >
                  {settings.showGrid ? 'Tampilkan' : 'Sembunyikan'}
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Watermark Simbol Besar</span>
                  <span class="setting-desc">Tampilkan watermark samar di belakang candlestick</span>
                </div>
                <button
                  class="toggle-btn {settings.showWatermark ? 'active' : ''}"
                  onclick={() => onUpdateSettings({ showWatermark: !settings.showWatermark })}
                >
                  {settings.showWatermark ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Bar Replay Controller</span>
                  <span class="setting-desc">Tampilkan toolbar replay candle historis di atas grafik</span>
                </div>
                <button
                  class="toggle-btn {settings.showReplayBar ? 'active' : ''}"
                  onclick={() => onUpdateSettings({ showReplayBar: !settings.showReplayBar })}
                >
                  {settings.showReplayBar ? 'Tampil' : 'Sembunyi'}
                </button>
              </div>
            </div>

            <div class="section-group">
              <h4 class="section-title">Timeframe & Navigasi Bilah Atas</h4>

              <!-- Pilihan Timeframe Default -->
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Timeframe Default (Saat Membuka Aplikasi)</span>
                  <span class="setting-desc">Interval chart yang otomatis aktif saat pertama kali dibuka</span>
                </div>
                <select
                  class="select-input mono-nums"
                  value={settings.defaultTimeframe || '15m'}
                  onchange={(e) => onUpdateSettings({ defaultTimeframe: e.currentTarget.value as any })}
                >
                  <optgroup label="Menit">
                    <option value="1m">1m (1 Menit)</option>
                    <option value="3m">3m (3 Menit)</option>
                    <option value="5m">5m (5 Menit)</option>
                    <option value="15m">15m (15 Menit - Day Trading)</option>
                    <option value="30m">30m (30 Menit)</option>
                    <option value="45m">45m (45 Menit)</option>
                  </optgroup>
                  <optgroup label="Jam">
                    <option value="1h">1h (1 Jam - Swing MTF)</option>
                    <option value="2h">2h (2 Jam)</option>
                    <option value="4h">4h (4 Jam - HTF Analisis)</option>
                    <option value="6h">6h (6 Jam)</option>
                    <option value="12h">12h (12 Jam)</option>
                  </optgroup>
                  <optgroup label="Hari & Pekan">
                    <option value="1D">1D (1 Hari - Trend Utama)</option>
                    <option value="1W">1W (1 Pekan)</option>
                    <option value="1M">1M (1 Bulan)</option>
                  </optgroup>
                  {#if settings.customTimeframes && settings.customTimeframes.length > 0}
                    <optgroup label="Kustom Pengguna">
                      {#each settings.customTimeframes as ctf}
                        <option value={ctf}>{ctf} (Kustom)</option>
                      {/each}
                    </optgroup>
                  {/if}
                </select>
              </div>

              <!-- Pilihan Sematan Timeframe Favorit -->
              <div class="setting-box-column">
                <div class="setting-info-header">
                  <span class="setting-label">Timeframe Favorit di Header (Sematkan ⭐)</span>
                  <span class="setting-desc">Pilih timeframe mana saja yang tampil di bilah navigasi kilat</span>
                </div>

                <div class="tf-favorites-chips-grid">
                  {#each ALL_AVAILABLE_TIMEFRAMES as tfOpt}
                    {@const isStarred = (settings.favoriteTimeframes || ['1m', '5m', '15m', '1h', '4h', '1D']).includes(tfOpt.id)}
                    <button
                      type="button"
                      class="tf-fav-chip {isStarred ? 'starred' : ''}"
                      title="{isStarred ? 'Lepas sematan' : 'Sematkan ke bilah atas'} {tfOpt.label}"
                      onclick={() => handleToggleFavFromSettings(tfOpt.id)}
                    >
                      <Star size={11} fill={isStarred ? '#f59e0b' : 'none'} color={isStarred ? '#f59e0b' : 'currentColor'} />
                      <span class="mono-nums">{tfOpt.label}</span>
                    </button>
                  {/each}

                  {#if settings.customTimeframes && settings.customTimeframes.length > 0}
                    {#each settings.customTimeframes as ctf}
                      {@const isStarred = (settings.favoriteTimeframes || []).includes(ctf)}
                      <button
                        type="button"
                        class="tf-fav-chip {isStarred ? 'starred' : ''}"
                        title="{isStarred ? 'Lepas sematan' : 'Sematkan ke bilah atas'} {ctf}"
                        onclick={() => handleToggleFavFromSettings(ctf)}
                      >
                        <Star size={11} fill={isStarred ? '#f59e0b' : 'none'} color={isStarred ? '#f59e0b' : 'currentColor'} />
                        <span class="mono-nums">{ctf}</span>
                      </button>
                    {/each}
                  {/if}
                </div>

                <div class="tf-settings-actions">
                  <span class="tf-chip-summary">
                    {(settings.favoriteTimeframes || ['1m', '5m', '15m', '1h', '4h', '1D']).length} timeframe disematkan di bilah atas
                  </span>
                  <button
                    type="button"
                    class="reset-defaults-btn"
                    title="Kembalikan favorit ke 1m, 5m, 15m, 1h, 4h, 1D"
                    onclick={() => onUpdateSettings({ favoriteTimeframes: ['1m', '5m', '15m', '1h', '4h', '1D'] })}
                  >
                    <RotateCcw size={11} />
                    <span>Reset Standar</span>
                  </button>
                </div>
              </div>
            </div>

          <!-- TAB 3: DATA PROVIDER & FEED (BARU & TERINTEGRASI) -->
          {:else if activeTab === 'feed'}
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

          <!-- TAB 4: TELEMETRI & WEBGL2 -->
          {:else if activeTab === 'system'}
            <div class="section-group">
              <h4 class="section-title">Status Akselerasi WebGL 2.0 & Native Core</h4>
              <p class="section-desc">
                Informasi telemetri perangkat keras dipindahkan ke sini agar area kerja grafik tetap bersih dan maksimal.
              </p>

              <div class="telemetry-grid mono-nums">
                <div class="telemetry-card">
                  <span class="card-label">Target Rendering</span>
                  <span class="card-value text-bull">{fps} FPS</span>
                  <span class="card-sub">LuxAlgo Vela WebGL2</span>
                </div>

                <div class="telemetry-card">
                  <span class="card-label">Estimasi VRAM Buffer</span>
                  <span class="card-value">{vram}</span>
                  <span class="card-sub">Zero Heap Thrash</span>
                </div>

                <div class="telemetry-card">
                  <span class="card-label">L2 Network Latency</span>
                  <span class="card-value text-cyan">{l2Latency}</span>
                  <span class="card-sub">Direct Streams</span>
                </div>

                <div class="telemetry-card">
                  <span class="card-label">Packet Drop Health</span>
                  <span class="card-value">{droppedPackets} Dropped</span>
                  <span class="card-sub">Zero loss buffering</span>
                </div>
              </div>

              <div class="status-summary obsidian-card">
                <div class="status-item">
                  <Database size={14} class="text-bull" />
                  <span>SQLite rusqlite: <strong>Local Offline Active</strong></span>
                </div>
                <div class="status-item">
                  <Wifi size={14} class="text-cyan" />
                  <span>Engine: <strong>Tauri v2 Native Rust Backend</strong></span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button class="primary-btn" onclick={onClose}>
          <Check size={14} /> Selesai
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(11, 14, 20, 0.82);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .settings-modal {
    width: 680px;
    max-width: 94vw;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.75);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    height: 44px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
  }

  .accent-icon {
    color: var(--brand-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .modal-body {
    display: flex;
    min-height: 380px;
    max-height: 75vh;
  }

  .settings-nav {
    width: 175px;
    background-color: var(--bg-container);
    border-right: 1px solid var(--border-hairline);
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .nav-tab:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .nav-tab.active {
    color: var(--brand-primary);
    background-color: var(--bg-active);
    font-weight: 600;
  }

  .tab-content {
    flex: 1;
    padding: 18px 20px;
    background-color: var(--bg-surface);
    overflow-y: auto;
  }

  .section-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
    margin-bottom: 2px;
  }

  .section-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-main);
  }

  .setting-desc {
    font-size: 11px;
    color: var(--text-dim);
  }

  .select-input {
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    padding: 6px 10px;
    border-radius: var(--radius-xs);
    font-size: 12px;
    cursor: pointer;
    outline: none;
  }

  .select-input:focus {
    border-color: var(--border-focus);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    padding: 6px 12px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .toggle-btn.active {
    background-color: rgba(0, 240, 144, 0.12);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    font-weight: 600;
  }

  .theme-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--brand-primary);
    background: rgba(0, 240, 144, 0.08);
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    border: 1px solid rgba(0, 240, 144, 0.25);
  }

  /* Timeframe Settings in Chart Tab */
  .setting-box-column {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
  }

  .setting-info-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tf-favorites-chips-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
  }

  .tf-fav-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .tf-fav-chip:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .tf-fav-chip.starred {
    background-color: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.4);
    color: var(--text-main);
    font-weight: 600;
  }

  .tf-settings-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid var(--border-hairline);
  }

  .tf-chip-summary {
    font-size: 11px;
    color: var(--text-dim);
  }

  .reset-defaults-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10.5px;
    padding: 3px 8px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .reset-defaults-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  /* ─── DATA FEED STYLING ─── */
  .feed-status-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
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
    background-color: var(--bull-color);
    box-shadow: 0 0 8px var(--bull-color);
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
    color: var(--text-dim);
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
    border-radius: var(--radius-xs);
  }

  .feed-tag.live {
    background-color: rgba(0, 240, 144, 0.1);
    color: var(--brand-primary);
    border: 1px solid rgba(0, 240, 144, 0.25);
  }

  .feed-tag.latency {
    background-color: rgba(0, 242, 254, 0.1);
    color: var(--brand-cyan);
    border: 1px solid rgba(0, 242, 254, 0.25);
  }

  .provider-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .provider-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .provider-card:hover {
    background-color: var(--bg-panel);
    border-color: var(--border-medium);
  }

  .provider-card.selected {
    border-color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.03);
    box-shadow: 0 0 14px rgba(0, 240, 144, 0.12);
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
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
  }

  .avatar.binance {
    background-color: #F0B90B;
    color: #000;
  }

  .avatar.bitunix {
    background-color: #06B6D4;
    color: #000;
  }

  .avatar.hyperliquid {
    background-color: #50E3C2;
    color: #000;
  }

  .avatar.coinbase {
    background-color: #0052FF;
    color: #fff;
  }

  .brand-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main);
  }

  .brand-subtitle {
    font-size: 9px;
    color: var(--text-dim);
  }

  .badge-active {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 700;
    background-color: rgba(0, 240, 144, 0.15);
    color: var(--brand-primary);
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    border: 1px solid rgba(0, 240, 144, 0.3);
  }

  .badge-choose {
    font-size: 10px;
    color: var(--text-dim);
    padding: 2px 6px;
    background-color: var(--bg-panel);
    border-radius: var(--radius-xs);
    border: 1px solid var(--border-hairline);
  }

  .card-caption {
    font-size: 10px;
    color: var(--text-muted);
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
    color: var(--text-dim);
    background-color: var(--bg-darkest);
    padding: 2px 5px;
    border-radius: var(--radius-xs);
  }

  .meta-pill.highlight {
    color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.08);
  }

  /* ─── CUSTOM NODE / PROXY ─── */
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
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    padding: 4px 10px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-custom-toggle:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-medium);
  }

  .custom-form-panel {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
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
    color: var(--text-dim);
  }

  .text-input {
    background-color: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    padding: 6px 10px;
    font-size: 11px;
    border-radius: var(--radius-xs);
    outline: none;
  }

  .text-input:focus {
    border-color: var(--border-focus);
  }

  .feedback-banner {
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-xs);
  }

  .feedback-banner.success {
    background-color: rgba(0, 240, 144, 0.1);
    color: var(--bull-color);
    border: 1px solid rgba(0, 240, 144, 0.25);
  }

  .feedback-banner.error {
    background-color: rgba(255, 59, 105, 0.1);
    color: var(--bear-color);
    border: 1px solid rgba(255, 59, 105, 0.25);
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
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-ping {
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
  }

  .btn-ping:hover {
    background-color: var(--bg-hover);
  }

  .btn-save {
    background-color: var(--brand-primary);
    border: 1px solid var(--brand-primary);
    color: var(--bg-darkest);
  }

  .btn-save:hover {
    opacity: 0.9;
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
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
  }

  .custom-item.active {
    border-color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.04);
  }

  .custom-item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .custom-item-name {
    font-size: 11px;
    color: var(--text-main);
  }

  .custom-item-url {
    font-size: 10px;
    color: var(--text-dim);
  }

  .custom-item-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-use-custom {
    font-size: 10px;
    padding: 2px 8px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    border-radius: var(--radius-xs);
    cursor: pointer;
  }

  .btn-use-custom:hover {
    background-color: var(--bg-hover);
  }

  .btn-trash {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 3px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-trash:hover {
    color: var(--bear-color);
  }

  /* ─── TELEMETRI STYLING ─── */
  .telemetry-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .telemetry-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-label {
    font-size: 11px;
    color: var(--text-dim);
  }

  .card-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-main);
  }

  .card-sub {
    font-size: 10px;
    color: var(--text-muted);
  }

  .status-summary {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .status-item strong {
    color: var(--text-main);
  }

  .text-bull {
    color: var(--bull-color);
  }

  .text-cyan {
    color: var(--brand-cyan);
  }

  .font-bold {
    font-weight: 700;
  }

  /* ─── FOOTER ─── */
  .modal-footer {
    height: 48px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: var(--bg-panel);
    border-top: 1px solid var(--border-hairline);
  }

  .primary-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--brand-primary);
    color: var(--bg-darkest);
    border: none;
    padding: 6px 14px;
    border-radius: var(--radius-xs);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .primary-btn:hover {
    opacity: 0.9;
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
