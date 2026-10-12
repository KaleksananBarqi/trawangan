<script lang="ts">
  import {
    SlidersHorizontal,
    RotateCcw,
    Star,
    Crosshair,
    Move,
    Coins,
    PenTool,
    Layers
  } from '@lucide/svelte';
  import type { AppSettings } from '../../types/market';

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
    onClose: () => void;
    onOpenChartSettings?: (section?: string) => void;
    onResetChartFactory?: () => void;
  }

  let {
    settings,
    onUpdateSettings,
    onClose,
    onOpenChartSettings,
    onResetChartFactory
  }: Props = $props();

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
    { id: '1M', label: '1M' }
  ];

  let resetChartFeedback = $state<string | null>(null);

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
      indicators: true
    };
    const updatedSync = {
      ...currentSync,
      [key]: !currentSync[key]
    };
    onUpdateSettings({ syncConfig: updatedSync });
  }

  function handleResetChartFactoryClick() {
    if (onResetChartFactory) {
      onResetChartFactory();
      resetChartFeedback = '✓ Konfigurasi lilin dikembalikan ke default pabrik!';
      setTimeout(() => {
        resetChartFeedback = null;
      }, 3000);
    }
  }
</script>

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

<!-- Skala Harga & Label Sumbu Kanan -->
<div class="section-group">
  <h4 class="section-title">Skala Harga & Label Sumbu Kanan</h4>
  <p class="section-subtitle">
    Atur visibilitas garis harga horizontal dan label badge harga pada skala sumbu kanan.
  </p>

  <!-- Garis Harga Terakhir (Current Price Line) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Garis Harga Terakhir (Current Price Line)</span>
      <span class="setting-desc">Tampilkan garis horizontal dinamis yang membentang dari harga lilin aktif ke skala kanan</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.showCurrentPriceLine !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ showCurrentPriceLine: settings.showCurrentPriceLine === false })}
    >
      {settings.showCurrentPriceLine !== false ? 'Aktif' : 'Nonaktif'}
    </button>
  </div>

  <!-- Label Nilai Indikator di Skala Harga -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Label Nilai Indikator di Skala Kanan</span>
      <span class="setting-desc">Tampilkan badge angka nilai terakhir dari indikator teknikal aktif pada sumbu harga kanan</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.showIndicatorPriceLabels !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ showIndicatorPriceLabels: settings.showIndicatorPriceLabels === false })}
    >
      {settings.showIndicatorPriceLabels !== false ? 'Aktif' : 'Nonaktif'}
    </button>
  </div>

  <!-- Label Harga Posisi Long/Short & Gambar -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Label Harga Posisi Long/Short & Gambar</span>
      <span class="setting-desc">Tampilkan badge harga entry, target keuntungan (TP), dan batas rugi (SL) di sumbu kanan</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.showDrawingPriceLabels !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ showDrawingPriceLabels: settings.showDrawingPriceLabels === false })}
    >
      {settings.showDrawingPriceLabels !== false ? 'Aktif' : 'Nonaktif'}
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

  .section-subtitle {
    font-size: 11px;
    color: var(--text-dim, #6e7681);
    margin: -4px 0 6px 0;
    line-height: 1.4;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 14px;
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }

  .setting-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-base, #ffffff);
  }

  .setting-desc {
    font-size: 11px;
    color: var(--text-dim, #6e7681);
    line-height: 1.35;
  }

  .toggle-btn {
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid var(--border-subtle, #30363d);
    background: var(--bg-hover, #21262d);
    color: var(--text-dim, #8b949e);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .toggle-btn:hover {
    border-color: var(--border-focus, #58a6ff);
    color: var(--text-base, #ffffff);
  }

  .toggle-btn.active {
    background: rgba(35, 134, 54, 0.2);
    border-color: var(--bull-color, #238636);
    color: #3fb950;
  }

  .select-input {
    background: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    color: var(--text-base, #ffffff);
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 11px;
    outline: none;
    cursor: pointer;
  }

  .select-input:focus {
    border-color: var(--border-focus, #58a6ff);
  }

  .setting-box-column {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
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
  }

  .tf-fav-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    font-size: 11px;
    background: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
    color: var(--text-dim, #8b949e);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tf-fav-chip:hover {
    border-color: var(--border-focus, #58a6ff);
    color: var(--text-base, #ffffff);
  }

  .tf-fav-chip.starred {
    border-color: rgba(245, 158, 11, 0.5);
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }

  .tf-settings-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed var(--border-subtle, #30363d);
  }

  .tf-chip-summary {
    font-size: 10px;
    color: var(--text-dim, #6e7681);
  }

  .reset-defaults-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: none;
    color: var(--text-dim, #8b949e);
    font-size: 10px;
    cursor: pointer;
  }

  .reset-defaults-btn:hover {
    color: var(--text-base, #ffffff);
  }

  .multichart-sync-settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }

  .sync-setting-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
  }

  .sync-card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    margin-right: 8px;
  }

  .sync-card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-base, #ffffff);
  }

  .sync-card-desc {
    font-size: 10px;
    color: var(--text-dim, #6e7681);
    line-height: 1.25;
  }

  .btn-test-notification,
  .btn-reset-font {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid var(--border-subtle, #30363d);
    background: var(--bg-hover, #21262d);
    color: var(--text-base, #ffffff);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-test-notification:hover,
  .btn-reset-font:hover {
    border-color: var(--border-focus, #58a6ff);
    background: var(--bg-surface, #161b22);
  }

  .notification-test-feedback {
    font-size: 10px;
    color: #3fb950;
    margin-top: 2px;
  }
</style>
