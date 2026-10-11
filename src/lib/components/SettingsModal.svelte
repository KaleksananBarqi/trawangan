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
    RotateCcw,
    Bell,
    BellOff,
    Palette,
    Type,
    Minus,
    Plus,
    Info,
    Coffee,
    HelpCircle,
    Keyboard,
    BookOpen,
    Command,
    Search,
    Code,
    Crosshair,
    Move,
    Coins,
    PenTool,
    Layers,
    Download,
    AlertCircle
  } from '@lucide/svelte';
  import { openExternalUrl } from '../services/urlService';
  import { updateService, type UpdateState } from '../services/updateService';
  import {
    THEME_PRESETS,
    UI_FONT_OPTIONS,
    MONO_FONT_OPTIONS,
    DENSITY_OPTIONS,
    FONT_SIZE_PRESETS,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    DEFAULT_FONT_SIZE
  } from '../constants/themes';
  import { sendTestNotification } from '../services/systemNotificationService';
  import type { AppSettings, ProviderConfig } from '../types/market';
  import { marketFeed } from '../services/market';
  import { telemetryService, type TelemetryData } from '../services/telemetryService';
  import { onDestroy } from 'svelte';

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

  function handleToggleSync(key: 'crosshair' | 'viewport' | 'symbol' | 'drawings' | 'indicators') {
    const currentSync = settings.syncConfig || {
      crosshair: true,
      viewport: true,
      symbol: false,
      drawings: true,
      indicators: true,
    };
    const updatedSync = {
      ...currentSync,
      [key]: !currentSync[key],
    };
    onUpdateSettings({ syncConfig: updatedSync });
  }

  function handleSetFontSize(newSize: number) {
    if (isNaN(newSize)) return;
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(newSize * 2) / 2));
    let density = settings.uiDensity;
    if (clamped <= 11) density = 'compact';
    else if (clamped >= 13.5) density = 'comfortable';
    else density = 'regular';

    onUpdateSettings({ fontSize: clamped, uiDensity: density });
  }

  function handleStepFontSize(delta: number) {
    const current = settings.fontSize ?? (settings.uiDensity === 'compact' ? 11 : settings.uiDensity === 'comfortable' ? 13.5 : DEFAULT_FONT_SIZE);
    handleSetFontSize(current + delta);
  }

  interface Props {
    isOpen: boolean;
    settings: AppSettings;
    activeProviderId?: string;
    initialTab?: 'general' | 'appearance' | 'chart' | 'feed' | 'system' | 'about' | 'help';
    onClose: () => void;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
    onProviderChange?: (providerId: string) => void;
    onOpenChartSettings?: (section?: string) => void;
    onResetChartFactory?: () => void;
  }

  let {
    isOpen,
    settings,
    activeProviderId = 'binance',
    initialTab = 'general',
    onClose,
    onUpdateSettings,
    onProviderChange,
    onOpenChartSettings,
    onResetChartFactory
  }: Props = $props();

  let activeTab = $state<'general' | 'appearance' | 'chart' | 'feed' | 'system' | 'about' | 'help'>('general');
  let resetChartFeedback = $state<string | null>(null);
  let helpSearchQuery = $state('');

  $effect(() => {
    if (isOpen && initialTab) {
      activeTab = initialTab;
    }
  });

  const SHORTCUT_ITEMS = [
    { category: 'Navigasi & Simbol', keys: ['Ctrl', 'K'], desc: 'Buka modal pencarian simbol & pair pasar' },
    { category: 'Navigasi & Simbol', keys: ['Space'], desc: 'Pindah ke koin berikutnya di daftar Watchlist' },
    { category: 'Navigasi & Simbol', keys: ['Shift', 'Space'], desc: 'Pindah ke koin sebelumnya di daftar Watchlist' },

    { category: 'Alat Gambar (Drawing Tools)', keys: ['Alt', 'T'], desc: 'Aktifkan alat Garis Tren (Trendline)' },
    { category: 'Alat Gambar (Drawing Tools)', keys: ['Alt', 'H'], desc: 'Aktifkan alat Garis Horisontal (Horizontal Line)' },
    { category: 'Alat Gambar (Drawing Tools)', keys: ['Alt', 'F'], desc: 'Aktifkan alat Fibonacci Retracement' },
    { category: 'Alat Gambar (Drawing Tools)', keys: ['Alt', 'M'], desc: 'Aktifkan Penggaris Ukur Jarak & Persentase (Measure)' },
    { category: 'Alat Gambar (Drawing Tools)', keys: ['Alt', 'Z'], desc: 'Reset skala & paskan grafik ke layar penuh (Fit Chart)' },
    { category: 'Alat Gambar (Drawing Tools)', keys: ['F'], desc: 'Shortcut alternatif untuk Fit Chart' },
    { category: 'Alat Gambar (Drawing Tools)', keys: ['Escape'], desc: 'Batalkan alat aktif / kembali ke kursor default' },
    { category: 'Alat Gambar (Drawing Tools)', keys: ['Delete / Backspace'], desc: 'Hapus objek terpilih / batalkan gambar terakhir' },
    { category: 'Alat Gambar (Drawing Tools)', keys: ['Ctrl', 'Z'], desc: 'Urungkan tindakan gambar terakhir (Undo)' },
    { category: 'Alat Gambar (Drawing Tools)', keys: ['Ctrl', 'Y'], desc: 'Ulangi tindakan gambar (Redo)' },

    { category: 'Timeframe Cepat', keys: ['1'], desc: 'Beralih ke Timeframe 1 Menit (1m)' },
    { category: 'Timeframe Cepat', keys: ['5'], desc: 'Beralih ke Timeframe 5 Menit (5m)' },
    { category: 'Timeframe Cepat', keys: ['0'], desc: 'Beralih ke Timeframe 15 Menit (15m)' },

    { category: 'Bar Replay (Simulasi)', keys: ['Shift', 'R'], desc: 'Buka atau tutup mode simulasi Bar Replay' },
    { category: 'Bar Replay (Simulasi)', keys: ['Space'], desc: 'Putar otomatis atau jeda lilin (saat replay aktif)' },
    { category: 'Bar Replay (Simulasi)', keys: ['→'], desc: 'Langkah maju satu candle ke depan (Step)' },
    { category: 'Bar Replay (Simulasi)', keys: ['Escape'], desc: 'Batalkan mode pemilihan lilin awal cutline' },

    { category: 'Price Alert', keys: ['Alt', 'A'], desc: 'Buat Price Alert baru pada harga kursor terakhir' },

    { category: 'Sistem & Bantuan', keys: ['Ctrl', '`'], desc: 'Buka atau tutup laci Terminal Console Logs' },
    { category: 'Sistem & Bantuan', keys: ['F1 / ?'], desc: 'Buka pusat bantuan & panduan tombol shortcut ini' },
  ];

  let filteredShortcuts = $derived.by(() => {
    const q = helpSearchQuery.trim().toLowerCase();
    if (!q) return SHORTCUT_ITEMS;
    return SHORTCUT_ITEMS.filter(
      (item) =>
        item.keys.some((k) => k.toLowerCase().includes(q)) ||
        item.desc.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  });

  let groupedShortcuts = $derived.by(() => {
    const groups: Record<string, typeof SHORTCUT_ITEMS> = {};
    for (const item of filteredShortcuts) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  });

  function handleResetChartFactoryClick() {
    if (onResetChartFactory) {
      onResetChartFactory();
      resetChartFeedback = '✓ Konfigurasi lilin dikembalikan ke default pabrik!';
      setTimeout(() => {
        resetChartFeedback = null;
      }, 3000);
    }
  }

  // ─── State Cek Pembaruan (About Page) ───
  let updateState = $state<UpdateState>(updateService.getSnapshot());
  let unsubUpdate: (() => void) | null = null;

  async function handleCheckUpdate() {
    await updateService.checkForUpdates(false);
  }

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
  let telemetry = $state<TelemetryData>(telemetryService.getSnapshot());
  let unsubTelemetry: (() => void) | null = null;

  // ─── Feedback Tes Notifikasi Windows ───
  let testNotificationFeedback = $state<string | null>(null);

  async function handleSendTestNotification() {
    testNotificationFeedback = 'Mengirim notifikasi ke Windows...';
    const ok = await sendTestNotification();
    if (ok) {
      testNotificationFeedback = '✓ Notifikasi terkirim ke Windows Action Center!';
    } else {
      testNotificationFeedback = '⚠ Izin notifikasi belum diizinkan di Windows.';
    }
    setTimeout(() => {
      testNotificationFeedback = null;
    }, 4500);
  }

  $effect(() => {
    if (isOpen) {
      loadProviders();
      unsubTelemetry = telemetryService.subscribe((data) => {
        telemetry = data;
      });
      unsubUpdate = updateService.subscribe((s) => {
        updateState = s;
      });
    } else {
      if (unsubTelemetry) {
        unsubTelemetry();
        unsubTelemetry = null;
      }
      if (unsubUpdate) {
        unsubUpdate();
        unsubUpdate = null;
      }
    }
  });

  onDestroy(() => {
    if (unsubTelemetry) unsubTelemetry();
    if (unsubUpdate) unsubUpdate();
  });

  $effect(() => {
    if (activeProviderId) {
      selectedProviderId = activeProviderId;
    }
  });

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
            class="nav-tab {activeTab === 'appearance' ? 'active' : ''}"
            onclick={() => (activeTab = 'appearance')}
          >
            <Palette size={14} />
            <span>Tema & Tipografi</span>
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

          <button
            class="nav-tab {activeTab === 'about' ? 'active' : ''}"
            onclick={() => (activeTab = 'about')}
          >
            <Info size={14} />
            <span>Tentang Aplikasi</span>
            {#if updateState.status === 'available'}
              <span class="tab-update-dot" title="Pembaruan Tersedia"></span>
            {/if}
          </button>

          <button
            class="nav-tab {activeTab === 'help' ? 'active' : ''}"
            onclick={() => (activeTab = 'help')}
          >
            <HelpCircle size={14} />
            <span class="nav-tab-label">Bantuan & Shortcut</span>
            <span class="tab-shortcut-badge mono-nums">F1</span>
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
                  <span class="setting-desc">Bunyikan nada kristal sintetis saat harga menembus level Alert</span>
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

              <!-- Notifikasi Native Windows Action Center -->
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Notifikasi Sistem Windows (Windows Toast)</span>
                  <span class="setting-desc">Kirim notifikasi native ke Windows Action Center saat alert terpicu</span>
                  {#if testNotificationFeedback}
                    <span class="notification-test-feedback mono-nums">{testNotificationFeedback}</span>
                  {/if}
                </div>
                <div class="setting-action-group">
                  <button
                    type="button"
                    class="btn-test-notification"
                    onclick={handleSendTestNotification}
                    title="Kirim notifikasi uji coba ke Windows"
                  >
                    <Bell size={12} />
                    <span>Tes Notifikasi</span>
                  </button>
                  <button
                    type="button"
                    class="toggle-btn {settings.systemNotificationEnabled !== false ? 'active' : ''}"
                    onclick={() => onUpdateSettings({ systemNotificationEnabled: settings.systemNotificationEnabled === false })}
                  >
                    {#if settings.systemNotificationEnabled !== false}
                      <Bell size={14} /> Aktif
                    {:else}
                      <BellOff size={14} /> Nonaktif
                    {/if}
                  </button>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Tema Visual Antarmuka</span>
                  <span class="setting-desc">Skema warna yang saat ini aktif</span>
                </div>
                <button class="toggle-btn active" onclick={() => (activeTab = 'appearance')} title="Buka tab Tema & Tipografi">
                  <Palette size={13} />
                  <span>{THEME_PRESETS[settings.themePreset || 'signature']?.name || 'trawangan (Signature)'}</span>
                </button>
              </div>
            </div>

          <!-- TAB: TEMA & TIPOGRAFI -->
          {:else if activeTab === 'appearance'}
            <div class="section-group">
              <h4 class="section-title">Preset Tema Tampilan & Candlestick</h4>
              <p class="section-subtitle">
                Pilih skema warna antarmuka dan palet candlestick. Tema signature trawangan dirancang dengan kontras Cyber-Monochrome ultra-gelap (#0F0F0F).
              </p>

              <div class="theme-presets-grid">
                {#each Object.values(THEME_PRESETS) as preset}
                  {@const isSelected = (settings.themePreset || 'signature') === preset.id}
                  <button
                    type="button"
                    class="theme-card {isSelected ? 'selected' : ''}"
                    onclick={() => onUpdateSettings({ themePreset: preset.id, theme: preset.id as any })}
                  >
                    <div class="theme-card-header">
                      <span class="theme-name">{preset.name}</span>
                      <span class="theme-badge">{preset.badge}</span>
                    </div>

                    <p class="theme-desc">{preset.description}</p>

                    <!-- Preview Swatches -->
                    <div class="theme-swatches">
                      <div class="swatch-item" title="Latar Kanvas ({preset.tokens.bgDarkest})">
                        <span class="swatch-color" style="background-color: {preset.tokens.bgDarkest}; border: 1px solid rgba(255,255,255,0.2);"></span>
                        <span class="swatch-label">Latar</span>
                      </div>
                      <div class="swatch-item" title="Candlestick Bull ({preset.chart.upColor})">
                        <span class="swatch-color" style="background-color: {preset.chart.upColor};"></span>
                        <span class="swatch-label">Bull</span>
                      </div>
                      <div class="swatch-item" title="Candlestick Bear ({preset.chart.downColor})">
                        <span class="swatch-color" style="background-color: {preset.chart.downColor};"></span>
                        <span class="swatch-label">Bear</span>
                      </div>
                      <div class="swatch-item" title="Aksen Brand ({preset.tokens.brandPrimary})">
                        <span class="swatch-color" style="background-color: {preset.tokens.brandPrimary};"></span>
                        <span class="swatch-label">Aksen</span>
                      </div>
                    </div>

                    <div class="theme-status">
                      {#if isSelected}
                        <span class="status-active"><Check size={12} /> Sedang Digunakan</span>
                      {:else}
                        <span class="status-inactive">Klik untuk Terapkan</span>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <div class="section-group">
              <h4 class="section-title">Tipografi & Skala Teks Antarmuka</h4>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Font Family Antarmuka (UI Sans)</span>
                  <span class="setting-desc">Font untuk navigasi, menu, dialog modal, dan tombol antarmuka</span>
                </div>
                <select
                  class="select-input"
                  value={settings.fontFamilyUi || 'Plus Jakarta Sans'}
                  onchange={(e) => onUpdateSettings({ fontFamilyUi: e.currentTarget.value })}
                >
                  {#each UI_FONT_OPTIONS as opt}
                    <option value={opt.id}>{opt.label}</option>
                  {/each}
                </select>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Font Angka & Kode (Monospace)</span>
                  <span class="setting-desc">Font untuk digit harga chart, orderflow, dan editor Pine Script</span>
                </div>
                <select
                  class="select-input mono-nums"
                  value={settings.fontFamilyMono || 'JetBrains Mono'}
                  onchange={(e) => onUpdateSettings({ fontFamilyMono: e.currentTarget.value })}
                >
                  {#each MONO_FONT_OPTIONS as opt}
                    <option value={opt.id}>{opt.label}</option>
                  {/each}
                </select>
              </div>

              <!-- KUSTOM UKURAN FONT BEBAS UNTUK MENYESUAIKAN UKURAN LAYAR USER -->
              <div class="setting-box-column custom-font-section">
                <div class="setting-info-header">
                  <div class="setting-title-with-badge">
                    <span class="setting-label">Ukuran Font Kustom (Custom Font Size)</span>
                    <span class="font-current-badge mono-nums">
                      {(settings.fontSize ?? (settings.uiDensity === 'compact' ? 11 : settings.uiDensity === 'comfortable' ? 13.5 : DEFAULT_FONT_SIZE))}px
                    </span>
                  </div>
                  <span class="setting-desc">
                    Sesuaikan ukuran teks secara presisi dengan slider, stepper, atau input angka bebas agar pas dengan resolusi layar Anda (laptop 13-14", monitor 1080p, 2K, hingga 4K).
                  </span>
                </div>

                <!-- Kontrol Interaktif: Stepper [-] + Range Slider + Stepper [+] + Input Langsung + Reset -->
                <div class="font-controls-bar">
                  <button
                    type="button"
                    class="font-step-btn"
                    onclick={() => handleStepFontSize(-0.5)}
                    title="Perkecil font 0.5px"
                  >
                    <Minus size={13} />
                  </button>

                  <div class="slider-wrapper">
                    <input
                      type="range"
                      class="font-range-slider"
                      min={MIN_FONT_SIZE}
                      max={MAX_FONT_SIZE}
                      step="0.5"
                      value={settings.fontSize ?? (settings.uiDensity === 'compact' ? 11 : settings.uiDensity === 'comfortable' ? 13.5 : DEFAULT_FONT_SIZE)}
                      oninput={(e) => handleSetFontSize(parseFloat(e.currentTarget.value))}
                    />
                    <div class="slider-ticks">
                      <span>{MIN_FONT_SIZE}px (Min)</span>
                      <span>12px (Bawaan)</span>
                      <span>{MAX_FONT_SIZE}px (Maks)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="font-step-btn"
                    onclick={() => handleStepFontSize(0.5)}
                    title="Perbesar font 0.5px"
                  >
                    <Plus size={13} />
                  </button>

                  <div class="font-direct-input-box">
                    <input
                      type="number"
                      class="font-number-input mono-nums"
                      min={MIN_FONT_SIZE}
                      max={MAX_FONT_SIZE}
                      step="0.5"
                      value={settings.fontSize ?? (settings.uiDensity === 'compact' ? 11 : settings.uiDensity === 'comfortable' ? 13.5 : DEFAULT_FONT_SIZE)}
                      onchange={(e) => handleSetFontSize(parseFloat(e.currentTarget.value))}
                    />
                    <span class="font-unit">px</span>
                  </div>

                  <button
                    type="button"
                    class="btn-reset-font"
                    onclick={() => handleSetFontSize(DEFAULT_FONT_SIZE)}
                    title="Kembalikan ke ukuran standar bawaan 12px"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                </div>

                <!-- Shortcut Preset Ukuran Layar Monitor -->
                <div class="font-presets-row">
                  <span class="presets-row-label">Preset Layar Monitor:</span>
                  <div class="font-presets-chips">
                    {#each FONT_SIZE_PRESETS as preset}
                      {@const currentSize = settings.fontSize ?? (settings.uiDensity === 'compact' ? 11 : settings.uiDensity === 'comfortable' ? 13.5 : DEFAULT_FONT_SIZE)}
                      {@const isActive = Math.abs(currentSize - preset.size) < 0.25}
                      <button
                        type="button"
                        class="preset-size-chip {isActive ? 'active' : ''}"
                        onclick={() => handleSetFontSize(preset.size)}
                        title="{preset.desc}"
                      >
                        <span class="chip-size mono-nums">{preset.size}px</span>
                        <span class="chip-label">{preset.label.split(' ')[1] || preset.label}</span>
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Live Typography Preview Box -->
                <div
                  class="font-preview-box"
                  style="--preview-font-size: {(settings.fontSize ?? (settings.uiDensity === 'compact' ? 11 : settings.uiDensity === 'comfortable' ? 13.5 : DEFAULT_FONT_SIZE))}px;"
                >
                  <div class="preview-header">
                    <span class="preview-title">Live Preview Tampilan (Skala Nyata)</span>
                    <span class="preview-badge mono-nums">
                      {(settings.fontSize ?? (settings.uiDensity === 'compact' ? 11 : settings.uiDensity === 'comfortable' ? 13.5 : DEFAULT_FONT_SIZE))}px
                    </span>
                  </div>
                  <div class="preview-content">
                    <div class="preview-ui-row">
                      <span class="preview-symbol">BTCUSDT</span>
                      <span class="preview-tf">15m</span>
                      <span class="preview-title-app">trawangan · terminal</span>
                      <span class="preview-status-pill">LIVE 60 FPS</span>
                    </div>
                    <div class="preview-numbers-row mono-nums">
                      <span class="preview-metric">O: <strong class="text-bull">64,250.00</strong></span>
                      <span class="preview-metric">H: <strong class="text-bull">64,890.50</strong></span>
                      <span class="preview-metric">L: <strong class="text-bear">63,900.00</strong></span>
                      <span class="preview-metric">C: <strong class="text-bull">64,720.00</strong></span>
                      <span class="preview-pnl text-bull">+1.25% (+798.50)</span>
                    </div>
                  </div>
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

            <!-- Konfigurasi Lilin & Tampilan VelaChart -->
            <div class="section-group">
              <h4 class="section-title">Warna Lilin & Tampilan VelaChart</h4>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Pengaturan Lilin & Bar (Vela Settings)</span>
                  <span class="setting-desc">Kustomisasi warna candle, borders, wick, spacing, dan animasi via modal VelaChart</span>
                </div>
                <button
                  type="button"
                  class="btn-test-notification"
                  onclick={() => {
                    onClose();
                    onOpenChartSettings?.('Symbol');
                  }}
                  title="Buka dialog pengaturan lilin Vela"
                >
                  <SlidersHorizontal size={13} />
                  <span>Buka Chart Settings</span>
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Reset Konfigurasi Lilin ke Default Pabrik</span>
                  <span class="setting-desc">Hapus template default yang pernah disimpan dan kembalikan ke warna awal bawaan Vela</span>
                  {#if resetChartFeedback}
                    <span class="notification-test-feedback mono-nums">{resetChartFeedback}</span>
                  {/if}
                </div>
                <button
                  type="button"
                  class="btn-reset-font"
                  onclick={handleResetChartFactoryClick}
                  title="Kembalikan konfigurasi lilin ke default pabrik"
                >
                  <RotateCcw size={12} />
                  <span>Reset ke Pabrik</span>
                </button>
              </div>
            </div>


            <div class="section-group">
              <h4 class="section-title">Timeframe & Navigasi Bilah Atas</h4>

              <!-- Pilihan Timeframe Default -->
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Timeframe Default (Aplikasi & Layout Multi-Chart)</span>
                  <span class="setting-desc">Interval candle bawaan saat aplikasi dibuka dan saat panel baru terbentuk pada layout grid</span>
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

            <!-- SEKSI 3: PERILAKU WORKSPACE & MULTI-CHART -->
            <div class="section-group">
              <h4 class="section-title">Perilaku Workspace & Sinkronisasi Multi-Chart</h4>
              <p class="section-subtitle">
                Atur perilaku penyimpanan otomatis workspace dan preferensi sinkronisasi bawaan saat menggunakan multi-chart grid.
              </p>

              <!-- Auto-Save Workspace Toggle -->
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Penyimpanan Otomatis Workspace (Auto-Save)</span>
                  <span class="setting-desc">Simpan otomatis tata letak grid, simbol, dan perubahan workspace saat bekerja</span>
                </div>
                <button
                  type="button"
                  class="toggle-btn {settings.autoSaveWorkspace !== false ? 'active' : ''}"
                  onclick={() => onUpdateSettings({ autoSaveWorkspace: settings.autoSaveWorkspace === false })}
                >
                  {settings.autoSaveWorkspace !== false ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              <!-- Auto-Load Last Workspace on Startup Toggle -->
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Muat Workspace Terakhir saat Startup</span>
                  <span class="setting-desc">Otomatis memuat workspace, simbol, indikator, dan tata letak terakhir saat aplikasi dibuka</span>
                </div>
                <button
                  type="button"
                  class="toggle-btn {settings.autoLoadLastWorkspace !== false ? 'active' : ''}"
                  onclick={() => onUpdateSettings({ autoLoadLastWorkspace: settings.autoLoadLastWorkspace === false })}
                >
                  {settings.autoLoadLastWorkspace !== false ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              <!-- Sinkronisasi Multi-Chart Cards Grid -->
              <div class="setting-box-column">
                <div class="setting-info-header">
                  <span class="setting-label">Perilaku Default Sinkronisasi Multi-Chart</span>
                  <span class="setting-desc">Status sinkronisasi awal saat beralih ke tata letak split/grid (2 Split, 4 Grid, dsb.)</span>
                </div>

                <div class="multichart-sync-settings-grid">
                  <!-- 1. Crosshair Sync -->
                  <div class="sync-setting-card">
                    <div class="sync-card-info">
                      <div class="sync-card-title">
                        <Crosshair size={13} class="sync-icon" />
                        <span>Kursor Crosshair</span>
                      </div>
                      <span class="sync-card-desc">Sinkronkan koordinat kursor mouse serempak antar panel grafik</span>
                    </div>
                    <button
                      type="button"
                      class="toggle-btn {(settings.syncConfig?.crosshair ?? true) ? 'active' : ''}"
                      onclick={() => handleToggleSync('crosshair')}
                    >
                      {(settings.syncConfig?.crosshair ?? true) ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>

                  <!-- 2. Viewport / Scroll Sync -->
                  <div class="sync-setting-card">
                    <div class="sync-card-info">
                      <div class="sync-card-title">
                        <Move size={13} class="sync-icon" />
                        <span>Gerakan Viewport (Waktu)</span>
                      </div>
                      <span class="sync-card-desc">Penyelarasan zoom dan pan horizontal rentang waktu candle</span>
                    </div>
                    <button
                      type="button"
                      class="toggle-btn {(settings.syncConfig?.viewport ?? true) ? 'active' : ''}"
                      onclick={() => handleToggleSync('viewport')}
                    >
                      {(settings.syncConfig?.viewport ?? true) ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>

                  <!-- 3. Symbol Sync -->
                  <div class="sync-setting-card">
                    <div class="sync-card-info">
                      <div class="sync-card-title">
                        <Coins size={13} class="sync-icon" />
                        <span>Simbol Pasar (Pair)</span>
                      </div>
                      <span class="sync-card-desc">Ganti simbol di satu chart otomatis mengganti semua chart</span>
                    </div>
                    <button
                      type="button"
                      class="toggle-btn {(settings.syncConfig?.symbol ?? false) ? 'active' : ''}"
                      onclick={() => handleToggleSync('symbol')}
                    >
                      {(settings.syncConfig?.symbol ?? false) ? 'Aktif' : 'Independen'}
                    </button>
                  </div>

                  <!-- 4. Drawings Sync -->
                  <div class="sync-setting-card">
                    <div class="sync-card-info">
                      <div class="sync-card-title">
                        <PenTool size={13} class="sync-icon" />
                        <span>Objek Gambar (Drawings)</span>
                      </div>
                      <span class="sync-card-desc">Garis tren, horizontal line, dan anotasi gambar tersinkron</span>
                    </div>
                    <button
                      type="button"
                      class="toggle-btn {(settings.syncConfig?.drawings ?? true) ? 'active' : ''}"
                      onclick={() => handleToggleSync('drawings')}
                    >
                      {(settings.syncConfig?.drawings ?? true) ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>

                  <!-- 5. Indicators Sync (Auto-Clone) -->
                  <div class="sync-setting-card">
                    <div class="sync-card-info">
                      <div class="sync-card-title">
                        <Layers size={13} class="sync-icon" />
                        <span>Indikator Teknikal</span>
                      </div>
                      <span class="sync-card-desc">Duplikasi indikator aktif ke seluruh cell layout baru secara otomatis</span>
                    </div>
                    <button
                      type="button"
                      class="toggle-btn {(settings.syncConfig?.indicators ?? true) ? 'active' : ''}"
                      onclick={() => handleToggleSync('indicators')}
                    >
                      {(settings.syncConfig?.indicators ?? true) ? 'Auto-Clone' : 'Manual'}
                    </button>
                  </div>
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
                  <span class="card-value {telemetry.fps >= 55 ? 'text-bull' : telemetry.fps >= 30 ? 'text-amber' : 'text-bear'}">{telemetry.fps} FPS</span>
                  <span class="card-sub">Actual Canvas Frame Rate</span>
                </div>

                <div class="telemetry-card">
                  <span class="card-label">Estimasi RAM Buffer</span>
                  <span class="card-value">{telemetry.memoryMb.toFixed(1)} MB</span>
                  <span class="card-sub">{telemetry.nativeProcessMb ? 'Windows Working Set' : 'JS Heap Memory'}</span>
                </div>

                <div class="telemetry-card">
                  <span class="card-label">Network Latency (Ping)</span>
                  <span class="card-value {telemetry.isOnline && telemetry.latencyMs !== null ? 'text-cyan' : 'text-bear'}">
                    {telemetry.isOnline && telemetry.latencyMs !== null ? `${telemetry.latencyMs} ms` : 'Offline / Timeout'}
                  </span>
                  <span class="card-sub">RTT to {telemetry.providerName}</span>
                </div>

                <div class="telemetry-card">
                  <span class="card-label">Packet Drop Health</span>
                  <span class="card-value {telemetry.packetDrops > 0 ? 'text-amber' : ''}">{telemetry.packetDrops} Gagal / Drop</span>
                  <span class="card-sub">{telemetry.packetDrops === 0 ? 'Zero connection loss' : 'Detected drops'}</span>
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

          <!-- TAB: TENTANG APLIKASI (ABOUT) -->
          {:else if activeTab === 'about'}
            <div class="about-pane">
              <!-- Hero Brand Showcase Card -->
              <div class="about-hero-card">
                <div class="about-logo-frame">
                  <img src="/logo-icon.svg" alt="trawangan logo" class="about-logo-img" />
                </div>
                <div class="about-hero-details">
                  <div class="about-title-row">
                    <h3 class="about-app-name">trawangan</h3>
                    <span class="about-version-badge mono-nums">v{updateState.currentVersion} · Stabil</span>
                  </div>
                  <div class="about-javanese-tagline">
                    <span class="javanese-script">ꦠꦿꦮꦔꦤ꧀</span>
                    <span class="tagline-separator">·</span>
                    <span class="tagline-text">Visi Menembus Kabut Manipulasi Pasar</span>
                  </div>
                  <p class="about-description">
                    Terminal charting kripto desktop ultra-ringan bertenaga WebGL2 Vela Engine dan runtime Pine Script v6. Didesain khusus untuk analisa teknikal grafis dan pengujian strategi kuantitatif independen: nol eksekusi order broker komersial, bebas distorsi, latensi ultra-rendah, dan integritas privasi database lokal.
                  </p>

                  <!-- Hero Action Buttons -->
                  <div class="about-actions-row">
                    <button
                      type="button"
                      class="btn-coffee-saweria"
                      onclick={() => openExternalUrl('https://saweria.co/arthex1204')}
                      title="Dukung pengembangan trawangan di Saweria"
                    >
                      <Coffee size={14} class="saweria-coffee-icon" />
                      <span>Belikan Saya Kopi (Saweria)</span>
                      <ExternalLink size={12} class="external-pill-icon" />
                    </button>

                    <button
                      type="button"
                      class="btn-check-update"
                      onclick={handleCheckUpdate}
                      disabled={updateState.status === 'checking'}
                      title="Periksa ketersediaan versi rilis terbaru"
                    >
                      <RefreshCw size={13} class={updateState.status === 'checking' ? 'spin' : ''} />
                      <span>{updateState.status === 'checking' ? 'Memeriksa...' : 'Periksa Pembaruan'}</span>
                    </button>
                  </div>

                  <!-- Dynamic Update Card Showcase -->
                  {#if updateState.status === 'available' && updateState.updateInfo}
                    <div class="update-card-featured glassmorphism">
                      <div class="update-card-header">
                        <div class="update-badge-glow">
                          <Sparkles size={14} class="sparkle-icon" />
                          <span>PEMBARUAN BARU TERSEDIA</span>
                        </div>
                        <span class="update-tag mono-nums">{updateState.updateInfo.latestTag}</span>
                      </div>

                      <div class="update-card-body">
                        <div class="version-comparison-row mono-nums">
                          <div class="version-chip current">
                            <span class="chip-label">Saat Ini</span>
                            <span class="chip-val">v{updateState.currentVersion}</span>
                          </div>
                          <span class="comparison-arrow">➔</span>
                          <div class="version-chip latest">
                            <span class="chip-label">Rilis Baru</span>
                            <span class="chip-val">{updateState.updateInfo.latestTag}</span>
                          </div>
                          {#if updateState.updateInfo.publishedAt}
                            <span class="published-date">({updateState.updateInfo.publishedAt})</span>
                          {/if}
                        </div>

                        <!-- Release Notes Summary Container -->
                        <div class="release-notes-box">
                          <div class="notes-header">
                            <Info size={13} />
                            <span>Catatan Pembaruan ({updateState.updateInfo.releaseName})</span>
                          </div>
                          <pre class="notes-content">{updateState.updateInfo.releaseNotes}</pre>
                        </div>

                        <!-- Direct Actions -->
                        <div class="update-card-actions">
                          {#if updateState.updateInfo.matchedAsset}
                            <button
                              type="button"
                              class="btn-download-update"
                              onclick={() => openExternalUrl(updateState.updateInfo!.matchedAsset!.browserDownloadUrl)}
                              title="Unduh file rilis: {updateState.updateInfo.matchedAsset.name}"
                            >
                              <Download size={14} />
                              <span>Unduh {updateState.updateInfo.matchedAsset.name}</span>
                            </button>
                          {:else}
                            <button
                              type="button"
                              class="btn-download-update"
                              onclick={() => openExternalUrl(updateState.updateInfo!.releaseUrl)}
                              title="Buka rilis dan unduh installer"
                            >
                              <Download size={14} />
                              <span>Unduh Installer Resmi</span>
                            </button>
                          {/if}

                          <button
                            type="button"
                            class="btn-view-github"
                            onclick={() => openExternalUrl(updateState.updateInfo!.releaseUrl)}
                            title="Buka catatan rilis lengkap di GitHub"
                          >
                            <ExternalLink size={13} />
                            <span>Lihat di GitHub</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  {:else if updateState.status === 'latest'}
                    <div class="update-feedback-banner success mono-nums">
                      <Check size={14} />
                      <span>✓ Anda sudah menggunakan versi rilis terbaru (v{updateState.currentVersion}). Sistem berada pada performa optimal.</span>
                      {#if updateState.lastChecked}
                        <span class="check-time">· Dicek pukul {updateState.lastChecked.toLocaleTimeString('id-ID', { hour12: false })}</span>
                      {/if}
                    </div>
                  {:else if updateState.status === 'error'}
                    <div class="update-feedback-banner error mono-nums">
                      <AlertCircle size={14} />
                      <span>{updateState.errorMessage || 'Gagal menghubungi server GitHub.'}</span>
                    </div>
                  {:else if updateState.status === 'checking'}
                    <div class="update-feedback-banner info mono-nums">
                      <RefreshCw size={13} class="spin" />
                      <span>Memeriksa ketersediaan pembaruan dari server GitHub...</span>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Tech Specifications Grid -->
              <div class="section-group">
                <h4 class="section-title">Spesifikasi Engine & Arsitektur</h4>
                <div class="specs-grid">
                  <div class="spec-card">
                    <span class="spec-key">Core Charting Engine</span>
                    <span class="spec-val">LuxAlgo Vela (WebGL2 Native Canvas)</span>
                  </div>
                  <div class="spec-card">
                    <span class="spec-key">Scripting Runtime</span>
                    <span class="spec-val">Pine Script v6 (PineTS AST Engine)</span>
                  </div>
                  <div class="spec-card">
                    <span class="spec-key">Desktop Shell Host</span>
                    <span class="spec-val">Tauri v2 + Rust Native x64</span>
                  </div>
                  <div class="spec-card">
                    <span class="spec-key">User Interface</span>
                    <span class="spec-val">Svelte 5 + Vite (Zero Run-Time VDOM)</span>
                  </div>
                  <div class="spec-card">
                    <span class="spec-key">Database Lokal</span>
                    <span class="spec-val">SQLite Local Embedded (rusqlite)</span>
                  </div>
                  <div class="spec-card">
                    <span class="spec-key">Lisensi Software</span>
                    <span class="spec-val">MIT Open Source License</span>
                  </div>
                </div>
              </div>

              <!-- Community & Project Links -->
              <div class="section-group">
                <h4 class="section-title">Tautan Resmi & Komunitas</h4>
                <div class="about-links-grid">
                  <button
                    type="button"
                    class="about-link-card"
                    onclick={() => openExternalUrl('https://github.com/KaleksananBarqi/trawangan')}
                  >
                    <div class="link-card-left">
                      <ExternalLink size={14} class="text-cyan" />
                      <div class="link-card-text">
                        <span class="link-card-title">GitHub Repository</span>
                        <span class="link-card-sub">Kode sumber terbuka, diskusi & kontribusi</span>
                      </div>
                    </div>
                    <span class="link-arrow">↗</span>
                  </button>

                  <button
                    type="button"
                    class="about-link-card"
                    onclick={() => openExternalUrl('https://github.com/KaleksananBarqi/trawangan/releases')}
                  >
                    <div class="link-card-left">
                      <RefreshCw size={14} class="text-bull" />
                      <div class="link-card-text">
                        <span class="link-card-title">Catatan Rilis (Changelog)</span>
                        <span class="link-card-sub">Riwayat versi, fitur baru & perbaikan bug</span>
                      </div>
                    </div>
                    <span class="link-arrow">↗</span>
                  </button>

                  <button
                    type="button"
                    class="about-link-card coffee-variant"
                    onclick={() => openExternalUrl('https://saweria.co/arthex1204')}
                  >
                    <div class="link-card-left">
                      <Coffee size={14} class="text-amber" />
                      <div class="link-card-text">
                        <span class="link-card-title">Saweria Donasi (@arthex1204)</span>
                        <span class="link-card-sub">Dukungan kopi pengembang untuk kelanjutan proyek</span>
                      </div>
                    </div>
                    <span class="link-arrow">↗</span>
                  </button>
                </div>
              </div>

              <!-- Meta Footer -->
              <div class="about-footer-meta">
                <p>trawangan · Dibuat dengan dedikasi untuk trader teknikal & analis independen.</p>
                <p class="meta-copyright">Copyright © 2026 KaleksananBarqi / arthex1204. All rights reserved.</p>
              </div>
            </div>
          {:else if activeTab === 'help'}
            <div class="tab-content">
              <!-- Header Seksi Bantuan -->
              <div class="section-group">
                <div class="help-header-flex">
                  <div>
                    <h3 class="section-heading">Pusat Bantuan & Panduan Shortcut</h3>
                    <p class="section-desc">
                      Gunakan tombol pintas keyboard berikut untuk mempercepat navigasi grafik, eksekusi alat gambar, dan analisis pasar.
                    </p>
                  </div>
                  <div class="help-f1-badge mono-nums">
                    <span>Shortcut Bantuan:</span> <kbd class="kbd-key">F1</kbd> / <kbd class="kbd-key">?</kbd>
                  </div>
                </div>

                <!-- Input Pencarian Cepat Shortcut -->
                <div class="shortcut-search-box">
                  <Search size={14} class="search-icon-dim" />
                  <input
                    type="text"
                    placeholder="Cari tombol shortcut (e.g. replay, alt, kursor, fit)..."
                    bind:value={helpSearchQuery}
                    class="shortcut-search-input"
                  />
                  {#if helpSearchQuery}
                    <button class="clear-search-btn" onclick={() => (helpSearchQuery = '')}>
                      <X size={12} />
                    </button>
                  {/if}
                </div>
              </div>

              <!-- Daftar Shortcut Per Kategori -->
              <div class="section-group">
                <div class="shortcut-categories-container">
                  {#if Object.keys(groupedShortcuts).length === 0}
                    <div class="empty-shortcut-state">
                      <HelpCircle size={24} class="text-dim" />
                      <span>Tidak ada tombol shortcut yang cocok dengan "{helpSearchQuery}".</span>
                    </div>
                  {/if}

                  {#each Object.entries(groupedShortcuts) as [categoryName, items]}
                    <div class="shortcut-category-card">
                      <div class="category-header">
                        <span class="category-title">{categoryName}</span>
                        <span class="category-count mono-nums">{items.length} pintasan</span>
                      </div>

                      <div class="shortcut-items-table">
                        {#each items as item}
                          <div class="shortcut-row">
                            <div class="shortcut-keys-wrapper">
                              {#each item.keys as keyPart, idx}
                                <kbd class="kbd-key mono-nums">{keyPart}</kbd>
                                {#if idx < item.keys.length - 1}
                                  <span class="kbd-plus">+</span>
                                {/if}
                              {/each}
                            </div>
                            <div class="shortcut-desc">{item.desc}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Panduan Fitur Inti (Quick Guide) -->
              <div class="section-group">
                <h4 class="section-title">Panduan Ringkas Fitur Utama</h4>
                <div class="feature-guides-grid">
                  <div class="feature-guide-card">
                    <div class="guide-card-header">
                      <Grid size={14} class="text-cyan" />
                      <span class="guide-card-title">Multi-Chart & Sinkronisasi</span>
                    </div>
                    <p class="guide-card-body">
                      Pilih tata letak multi-chart (1, 2 Horisontal, 2 Vertikal, 4 Grid) lewat tombol menu
                      <strong>Workspace & Layout</strong>. Aktifkan sinkronisasi kursor crosshair, gerakan waktu viewport,
                      simbol, dan objek gambar secara langsung lewat menu <strong>Actions</strong> di header.
                    </p>
                  </div>

                  <div class="feature-guide-card">
                    <div class="guide-card-header">
                      <Code size={14} class="text-bull" />
                      <span class="guide-card-title">Pine Script v6 IDE & Backtester</span>
                    </div>
                    <p class="guide-card-body">
                      Beralih ke mode <strong>Pine IDE</strong> di header kiri atas untuk membuat, mengedit, dan mengevaluasi indikator
                      serta strategi kuantitatif kustom secara instan menggunakan AST Engine Pine Script v6 di Web Worker independen.
                    </p>
                  </div>

                  <div class="feature-guide-card">
                    <div class="guide-card-header">
                      <Radio size={14} class="text-amber" />
                      <span class="guide-card-title">Data Feed Binance & Bitunix</span>
                    </div>
                    <p class="guide-card-body">
                      Ganti penyedia feed live antara <strong>Binance Futures</strong> dan <strong>Bitunix Futures</strong>
                      di tab <strong>Data Feed</strong>. Trawangan Terminal mendukung format koin perpetual standar dan simbol <span class="mono-nums">.P</span> secara mulus.
                    </p>
                  </div>
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

  .setting-action-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-test-notification {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-medium, #2a3447);
    color: #38bdf8;
    padding: 6px 10px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-test-notification:hover {
    background-color: rgba(56, 189, 248, 0.15);
    border-color: #38bdf8;
    color: #ffffff;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.25);
  }

  .notification-test-feedback {
    font-size: 10px;
    color: #38bdf8;
    margin-top: 2px;
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

  /* ─── Theme Presets & Typography Tab Styles ─── */
  .section-subtitle {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 12px;
    line-height: 1.4;
  }

  .theme-presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 10px;
    margin-top: 6px;
  }

  .theme-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.18s ease;
  }

  .theme-card:hover {
    border-color: var(--border-bright);
    background-color: var(--bg-elevated);
  }

  .theme-card.selected {
    border-color: var(--brand-primary);
    background-color: var(--bg-elevated);
    box-shadow: 0 0 14px rgba(255, 105, 180, 0.15);
  }

  .theme-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .theme-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main);
  }

  .theme-card .theme-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: var(--radius-xs);
    background: rgba(255, 105, 180, 0.12);
    color: var(--brand-primary);
    border: 1px solid rgba(255, 105, 180, 0.25);
  }

  .theme-desc {
    font-size: 10.5px;
    color: var(--text-muted);
    line-height: 1.35;
    min-height: 28px;
  }

  .theme-swatches {
    display: flex;
    gap: 10px;
    padding: 6px 8px;
    background: var(--bg-darkest);
    border-radius: var(--radius-xs);
    border: 1px solid var(--border-subtle);
  }

  .swatch-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .swatch-color {
    width: 20px;
    height: 12px;
    border-radius: 2px;
    display: inline-block;
  }

  .swatch-label {
    font-size: 8px;
    color: var(--text-dim);
    text-transform: uppercase;
    font-weight: 600;
  }

  .theme-status {
    margin-top: 4px;
    font-size: 10px;
    font-weight: 600;
  }

  .status-active {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--brand-primary);
  }

  .status-inactive {
    color: var(--text-dim);
  }

  .density-chips-group {
    display: flex;
    gap: 6px;
  }

  .density-chip {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 500;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .density-chip:hover {
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .density-chip.active {
    background-color: rgba(255, 105, 180, 0.14);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    font-weight: 600;
  }

  /* ─── Custom Font Controls & Live Preview ─── */
  .custom-font-section {
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 14px;
    gap: 12px;
  }

  .setting-title-with-badge {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .font-current-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: var(--radius-xs);
    background: rgba(255, 105, 180, 0.15);
    color: var(--brand-primary);
    border: 1px solid rgba(255, 105, 180, 0.3);
  }

  .font-controls-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 8px 12px;
  }

  .font-step-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .font-step-btn:hover {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    background-color: var(--bg-hover);
  }

  .slider-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .font-range-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    outline: none;
    cursor: pointer;
  }

  .font-range-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--brand-primary);
    cursor: pointer;
    box-shadow: 0 0 8px rgba(255, 105, 180, 0.5);
    transition: transform 0.1s ease;
  }

  .font-range-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .font-range-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: var(--brand-primary);
    cursor: pointer;
    box-shadow: 0 0 8px rgba(255, 105, 180, 0.5);
  }

  .slider-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: var(--text-dim);
  }

  .font-direct-input-box {
    display: flex;
    align-items: center;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 0 6px;
    height: 26px;
    flex-shrink: 0;
  }

  .font-number-input {
    width: 44px;
    background: transparent;
    border: none;
    color: var(--text-main);
    font-size: 11.5px;
    font-weight: 600;
    text-align: right;
    outline: none;
  }

  .font-number-input::-webkit-inner-spin-button,
  .font-number-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .font-unit {
    font-size: 10px;
    color: var(--text-muted);
    margin-left: 2px;
  }

  .btn-reset-font {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 8px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10.5px;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .btn-reset-font:hover {
    border-color: var(--border-bright);
    color: var(--text-main);
  }

  .font-presets-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .presets-row-label {
    font-size: 10.5px;
    color: var(--text-muted);
  }

  .font-presets-chips {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .preset-size-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10.5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-size-chip:hover {
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .preset-size-chip.active {
    background-color: rgba(255, 105, 180, 0.12);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    font-weight: 600;
  }

  .preset-size-chip .chip-size {
    font-weight: 700;
  }

  .preset-size-chip .chip-label {
    font-size: 9.5px;
    color: var(--text-dim);
  }

  .preset-size-chip.active .chip-label {
    color: var(--brand-primary);
    opacity: 0.85;
  }

  /* Live Preview Box */
  .font-preview-box {
    background-color: var(--bg-darkest);
    border: 1px dashed var(--border-bright);
    border-radius: var(--radius-xs);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 6px;
  }

  .preview-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim);
    font-weight: 600;
  }

  .preview-badge {
    font-size: 10px;
    color: var(--brand-primary);
    font-weight: 700;
  }

  .preview-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-ui-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--preview-font-size, 12px);
    color: var(--text-main);
  }

  .preview-symbol {
    font-weight: 800;
    color: var(--text-main);
  }

  .preview-tf {
    font-weight: 700;
    color: var(--brand-primary);
    background: rgba(255, 105, 180, 0.12);
    padding: 1px 5px;
    border-radius: 2px;
    font-size: 0.85em;
  }

  .preview-title-app {
    color: var(--text-muted);
  }

  .preview-status-pill {
    margin-left: auto;
    font-size: 0.75em;
    font-weight: 700;
    color: var(--bull-color);
    background: rgba(247, 247, 247, 0.08);
    padding: 1px 6px;
    border-radius: 2px;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .preview-numbers-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: calc(var(--preview-font-size, 12px) * 0.95);
    color: var(--text-muted);
    flex-wrap: wrap;
  }

  .preview-metric {
    display: inline-flex;
    gap: 3px;
  }

  .preview-pnl {
    margin-left: auto;
    font-weight: 700;
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

  /* ─── ABOUT PAGE STYLES ─── */
  .about-pane {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .about-hero-card {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  }

  .about-logo-frame {
    width: 68px;
    height: 68px;
    border-radius: var(--radius-md);
    background-color: #141414;
    border: 1px solid rgba(255, 105, 180, 0.35);
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 16px rgba(255, 105, 180, 0.12);
  }

  .about-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .about-hero-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .about-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .about-app-name {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    font-family: var(--font-brand);
    color: var(--text-main);
    letter-spacing: -0.02em;
  }

  .about-version-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--brand-primary);
    background: rgba(255, 105, 180, 0.12);
    border: 1px solid rgba(255, 105, 180, 0.28);
    padding: 2px 7px;
    border-radius: var(--radius-xs);
  }

  .about-javanese-tagline {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .javanese-script {
    color: var(--brand-primary);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .tagline-separator {
    color: var(--text-dim);
  }

  .tagline-text {
    font-style: italic;
    color: var(--text-muted);
  }

  .about-description {
    margin: 2px 0 6px 0;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .about-actions-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .btn-coffee-saweria {
    display: flex;
    align-items: center;
    gap: 7px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(255, 105, 180, 0.14) 100%);
    border: 1px solid rgba(245, 158, 11, 0.45);
    color: #fbbf24;
    padding: 6px 13px;
    border-radius: var(--radius-xs);
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.16s ease;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.1);
  }

  .btn-coffee-saweria:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.28) 0%, rgba(255, 105, 180, 0.24) 100%);
    color: #ffffff;
    border-color: #fbbf24;
    box-shadow: 0 0 14px rgba(245, 158, 11, 0.3);
  }

  .saweria-coffee-icon {
    color: #f59e0b;
    transition: transform 0.2s ease;
  }

  .btn-coffee-saweria:hover .saweria-coffee-icon {
    transform: rotate(-10deg) scale(1.1);
  }

  .external-pill-icon {
    color: rgba(251, 191, 36, 0.7);
    margin-left: 2px;
  }

  .btn-check-update {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-medium, #2a3447);
    color: var(--text-main);
    padding: 6px 12px;
    border-radius: var(--radius-xs);
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-check-update:hover:not(:disabled) {
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
    color: #ffffff;
  }

  .btn-check-update:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .update-feedback-banner {
    padding: 6px 10px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    margin-top: 4px;
    display: flex;
    align-items: center;
  }

  .update-feedback-banner.success {
    background: rgba(0, 240, 144, 0.08);
    border: 1px solid rgba(0, 240, 144, 0.25);
    color: var(--bull-color);
  }

  .update-feedback-banner.info {
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: #38bdf8;
    gap: 7px;
  }

  .update-feedback-banner.error {
    background: rgba(255, 68, 88, 0.08);
    border: 1px solid rgba(255, 68, 88, 0.25);
    color: var(--bear-color);
    gap: 7px;
  }

  .check-time {
    color: var(--text-dim);
    margin-left: 6px;
    font-size: 10px;
  }

  .tab-update-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--brand-primary);
    box-shadow: 0 0 6px var(--brand-primary);
    margin-left: auto;
    animation: updatePulse 1.8s infinite;
  }

  @keyframes updatePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }

  /* Featured Update Announcement Card */
  .update-card-featured {
    margin-top: 10px;
    background: rgba(255, 105, 180, 0.04);
    border: 1px solid rgba(255, 105, 180, 0.3);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(255, 105, 180, 0.08);
  }

  .update-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .update-badge-glow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    font-weight: 800;
    color: var(--brand-primary);
    letter-spacing: 0.05em;
  }

  :global(.sparkle-icon) {
    color: var(--brand-primary);
    animation: sparkleSpin 3s linear infinite;
  }

  @keyframes sparkleSpin {
    0% { transform: rotate(0deg); }
    50% { transform: rotate(180deg) scale(1.15); }
    100% { transform: rotate(360deg); }
  }

  .update-tag {
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    background: rgba(255, 105, 180, 0.25);
    border: 1px solid rgba(255, 105, 180, 0.4);
    padding: 2px 8px;
    border-radius: var(--radius-xs);
  }

  .update-card-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .version-comparison-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .version-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-base);
    border: 1px solid var(--border-hairline);
    padding: 2px 7px;
    border-radius: var(--radius-xs);
  }

  .version-chip.latest {
    border-color: rgba(255, 105, 180, 0.4);
    background: rgba(255, 105, 180, 0.08);
  }

  .chip-label {
    color: var(--text-dim);
    font-size: 9.5px;
  }

  .chip-val {
    font-weight: 700;
    color: var(--text-main);
  }

  .version-chip.latest .chip-val {
    color: var(--brand-primary);
  }

  .comparison-arrow {
    color: var(--text-dim);
    font-size: 10px;
  }

  .published-date {
    color: var(--text-dim);
    font-size: 10px;
    margin-left: 4px;
  }

  .release-notes-box {
    background: var(--bg-darkest);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xs);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 140px;
    overflow-y: auto;
  }

  .notes-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .notes-content {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--text-muted);
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .update-card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .btn-download-update {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--brand-primary);
    color: #0f0f0f;
    border: none;
    font-size: 11px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 10px rgba(255, 105, 180, 0.3);
  }

  .btn-download-update:hover {
    background: #ff80bf;
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(255, 105, 180, 0.45);
  }

  .btn-view-github {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-base);
    color: var(--text-muted);
    border: 1px solid var(--border-hairline);
    font-size: 11px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-view-github:hover {
    color: var(--text-main);
    border-color: var(--border-bright);
    background: var(--bg-hover);
  }

  .specs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .spec-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 8px 10px;
  }

  .spec-key {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .spec-val {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-main);
  }

  .about-links-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .about-link-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.14s ease;
    text-align: left;
    width: 100%;
  }

  .about-link-card:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-bright);
  }

  .about-link-card.coffee-variant:hover {
    border-color: rgba(245, 158, 11, 0.4);
    background-color: rgba(245, 158, 11, 0.06);
  }

  .link-card-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .link-card-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .link-card-title {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-main);
  }

  .link-card-sub {
    font-size: 10px;
    color: var(--text-dim);
  }

  .link-arrow {
    font-size: 12px;
    color: var(--text-dim);
    transition: transform 0.15s ease;
  }

  .about-link-card:hover .link-arrow {
    color: var(--text-main);
    transform: translate(2px, -2px);
  }

  .about-footer-meta {
    font-size: 10px;
    color: var(--text-dim);
    line-height: 1.5;
    border-top: 1px solid var(--border-hairline);
    padding-top: 10px;
  }

  .about-footer-meta p {
    margin: 0;
  }

  .meta-copyright {
    color: var(--text-disabled, #525252);
    margin-top: 2px !important;
  }

  /* ─── Styling Tab Bantuan & Shortcut (Help) ─── */
  .tab-shortcut-badge {
    margin-left: auto;
    font-size: 8.5px;
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--text-dim);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--border-hairline);
  }

  .nav-tab.active .tab-shortcut-badge {
    color: var(--brand-primary);
    border-color: rgba(0, 240, 144, 0.3);
    background-color: rgba(0, 240, 144, 0.1);
  }

  .help-header-flex {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .help-f1-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: var(--text-muted);
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    padding: 3px 7px;
    border-radius: var(--radius-xs);
    flex-shrink: 0;
  }

  .shortcut-search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 6px 10px;
    margin-top: 6px;
    transition: border-color 0.15s ease;
  }

  .shortcut-search-box:focus-within {
    border-color: var(--brand-primary);
  }

  .search-icon-dim {
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .shortcut-search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 11.5px;
    color: var(--text-main);
  }

  .shortcut-search-input::placeholder {
    color: var(--text-dim);
  }

  .clear-search-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
  }

  .clear-search-btn:hover {
    color: var(--text-main);
  }

  .shortcut-categories-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .empty-shortcut-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--text-dim);
    font-size: 11.5px;
    background-color: var(--bg-base);
    border: 1px dashed var(--border-hairline);
    border-radius: var(--radius-xs);
  }

  .shortcut-category-card {
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    overflow: hidden;
  }

  .category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background-color: var(--bg-container);
    border-bottom: 1px solid var(--border-hairline);
  }

  .category-title {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .category-count {
    font-size: 9.5px;
    color: var(--text-dim);
  }

  .shortcut-items-table {
    display: flex;
    flex-direction: column;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    gap: 14px;
    transition: background-color 0.12s ease;
  }

  .shortcut-row:last-child {
    border-bottom: none;
  }

  .shortcut-row:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }

  .shortcut-keys-wrapper {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: 140px;
    flex-shrink: 0;
  }

  .kbd-key {
    display: inline-block;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text-main);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-bottom: 2px solid var(--border-bright);
    border-radius: 3px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .kbd-plus {
    font-size: 9px;
    color: var(--text-dim);
  }

  .shortcut-desc {
    font-size: 11px;
    color: var(--text-muted);
    flex: 1;
  }

  .feature-guides-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 8px;
  }

  .feature-guide-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .guide-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .guide-card-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
  }

  .guide-card-body {
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1.45;
    margin: 0;
  }

  .guide-card-body strong {
    color: var(--text-main);
  }

  /* ─── MULTICHART SYNC SETTINGS GRID ─── */
  .multichart-sync-settings-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
  }

  .sync-setting-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    transition: all 0.15s ease;
  }

  .sync-setting-card:hover {
    border-color: var(--border-bright);
    background-color: var(--bg-base);
  }

  .sync-card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sync-card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-main);
  }

  .sync-card-title :global(.sync-icon) {
    color: var(--brand-primary, #00f090);
  }

  .sync-card-desc {
    font-size: 10px;
    color: var(--text-dim);
  }
</style>
