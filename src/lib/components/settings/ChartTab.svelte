<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    SlidersHorizontal,
    RotateCcw,
    Star,
    Crosshair,
    Move,
    Coins,
    PenTool,
    Layers,
    Save
  } from '@lucide/svelte';
  import type { AppSettings } from '../../types/market';
  import { timelineMarksController } from '../../services/timelineMarksController';
  import type { MarketSession } from '../../services/marketSessionService';
  import ToggleSwitch from '../common/ToggleSwitch.svelte';
  import { tr, trInstant } from '../../i18n';

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
    onClose: () => void;
    onOpenChartSettings?: (section?: string) => void;
    onSaveChartAsDefault?: () => Promise<boolean> | boolean;
    onResetChartFactory?: () => void;
    sessionState?: { session: MarketSession; sessionAvailable: boolean };
    onSetSession?: (mode: MarketSession) => void;
  }

  let {
    settings,
    onUpdateSettings,
    onClose,
    onOpenChartSettings,
    onSaveChartAsDefault,
    onResetChartFactory,
    sessionState,
    onSetSession
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

  let saveDefaultFeedback = $state<string | null>(null);
  let resetChartFeedback = $state<string | null>(null);
  let saveDefaultFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let resetChartFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let currentGridMode = $derived(settings.gridMode || (settings.showGrid === false ? 'hidden' : 'normal'));

  let isMacroMarksVisible = $state(timelineMarksController.isGroupVisible('macro'));
  let isMacroHighImpactOnly = $state(timelineMarksController.isMacroHighImpactOnly());
  let isTradesMarksVisible = $state(timelineMarksController.isGroupVisible('trades'));
  let isJournalMarksVisible = $state(timelineMarksController.isGroupVisible('journal'));
  let currentMarketSession = $derived(sessionState?.session ?? settings.marketSession ?? 'regular');
  let isSessionAvailable = $derived(sessionState?.sessionAvailable ?? false);

  function toggleMacroMarks() {
    const next = !isMacroMarksVisible;
    timelineMarksController.setGroupVisible('macro', next);
    isMacroMarksVisible = next;
  }

  function toggleMacroHighImpactOnly() {
    const next = !isMacroHighImpactOnly;
    timelineMarksController.setMacroHighImpactOnly(next);
    isMacroHighImpactOnly = next;
  }

  function toggleTradesMarks() {
    const next = !isTradesMarksVisible;
    timelineMarksController.setGroupVisible('trades', next);
    isTradesMarksVisible = next;
  }

  function toggleJournalMarks() {
    const next = !isJournalMarksVisible;
    timelineMarksController.setGroupVisible('journal', next);
    isJournalMarksVisible = next;
  }

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

  async function handleSaveChartAsDefaultClick() {
    if (onSaveChartAsDefault) {
      const ok = await onSaveChartAsDefault();
      saveDefaultFeedback = ok
        ? trInstant('✓ Sip! Setelan chart wis disimpen dadi default permanen!', '✓ Konfigurasi chart disimpan sebagai default permanen!', '✓ Chart configuration saved as permanent default!')
        : trInstant('Gagal nyimpen setelan chart default.', 'Gagal menyimpan konfigurasi chart default.', 'Failed to save default chart configuration.');
      if (saveDefaultFeedbackTimer) {
        clearTimeout(saveDefaultFeedbackTimer);
      }
      saveDefaultFeedbackTimer = setTimeout(() => {
        saveDefaultFeedbackTimer = null;
        saveDefaultFeedback = null;
      }, 3000);
    }
  }

  function handleResetChartFactoryClick() {
    if (onResetChartFactory) {
      onResetChartFactory();
      resetChartFeedback = trInstant('✓ Werna candle wis dibalikno nang setelan pabrik!', '✓ Konfigurasi lilin dikembalikan ke default pabrik!', '✓ Candlestick configuration restored to factory defaults!');
      if (resetChartFeedbackTimer) {
        clearTimeout(resetChartFeedbackTimer);
      }
      resetChartFeedbackTimer = setTimeout(() => {
        resetChartFeedbackTimer = null;
        resetChartFeedback = null;
      }, 3000);
    }
  }

  onDestroy(() => {
    if (saveDefaultFeedbackTimer) {
      clearTimeout(saveDefaultFeedbackTimer);
      saveDefaultFeedbackTimer = null;
    }
    if (resetChartFeedbackTimer) {
      clearTimeout(resetChartFeedbackTimer);
      resetChartFeedbackTimer = null;
    }
  });
</script>

<div class="section-group">
  <h4 class="section-title">{$tr('Resik-Resik & Tampilan Kanvas Chart', 'Kebersihan & Tampilan Canvas', 'Canvas Cleanliness & Display')}</h4>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Garis Kotak Latar (Grid Lines)', 'Garis Grid Latar (Grid Lines)', 'Background Grid Lines')}</span>
      <span class="setting-desc">{$tr('Ketokno garis bantu rega karo waktu nganggo pilihan ketebalan', 'Tampilkan pemandu koordinat harga dan waktu dengan pilihan intensitas garis', 'Display price and time coordinate grid lines with adjustable intensity')}</span>
    </div>
    <div class="grid-mode-selector" role="radiogroup" aria-label="Garis Grid">
      <button
        type="button"
        class="mode-chip {currentGridMode === 'normal' ? 'active' : ''}"
        onclick={() => onUpdateSettings({ gridMode: 'normal', showGrid: true })}
        title={$tr('Garis grid ketok jelas standar tema', 'Garis grid tampil jelas dengan opasitas tema standar', 'Standard grid visibility')}
      >
        <span>Normal</span>
      </button>
      <button
        type="button"
        class="mode-chip {currentGridMode === 'dimmed' ? 'active' : ''}"
        onclick={() => onUpdateSettings({ gridMode: 'dimmed', showGrid: true })}
        title={$tr('Garis grid remeng-remeng alus', 'Garis grid samar dan redup (transparan halus)', 'Subtle dimmed grid lines')}
      >
        <span>{$tr('Remeng', 'Redup', 'Dimmed')}</span>
      </button>
      <button
        type="button"
        class="mode-chip {currentGridMode === 'hidden' ? 'active' : ''}"
        onclick={() => onUpdateSettings({ gridMode: 'hidden', showGrid: false })}
        title={$tr('Singidno kabeh garis grid ben kanvas resik pol', 'Sembunyikan seluruh garis koordinat horizontal dan vertikal', 'Hide all horizontal and vertical grid lines')}
      >
        <span>{$tr('Singidno', 'Sembunyi', 'Hidden')}</span>
      </button>
    </div>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Watermark Simbol Gede', 'Watermark Simbol Besar', 'Large Symbol Watermark')}</span>
      <span class="setting-desc">{$tr('Ketokno tulisan simbol samar nang mburine candlestick', 'Tampilkan watermark samar di belakang candlestick', 'Show subtle ticker watermark behind candlesticks')}</span>
    </div>
    <ToggleSwitch
      checked={Boolean(settings.showWatermark)}
      ariaLabel="Watermark Simbol Besar"
      onchange={(next) => onUpdateSettings({ showWatermark: next })}
    />
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Balok Volume Market (Native Overlay)', 'Histogram Volume Pasar (Native Overlay)', 'Market Volume Histogram (Native Overlay)')}</span>
      <span class="setting-desc">{$tr('Ketokno bar volume WebGL2 nang ngisor kanvas candle utama', 'Tampilkan bar volume WebGL2 di dasar panel candlestick harga utama', 'Render WebGL2 volume bars along the bottom of the main price pane')}</span>
    </div>
    <ToggleSwitch
      checked={settings.showVolume !== false}
      ariaLabel="Histogram Volume Pasar"
      onchange={(next) => onUpdateSettings({ showVolume: next })}
    />
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Hollow Candles (Candle Munggah Bolong)', 'Hollow Candles (Body Bullish Transparan)', 'Hollow Candles (Transparent Bullish Body)')}</span>
      <span class="setting-desc">{$tr('Kosongno jeroan awak candle bullish, nyisakno garis pinggir & sumbu', 'Kosongkan isian body lilin naik (bullish) dengan garis tepi & sumbu mengikuti warna tema', 'Render bullish candles with hollow bodies and themed borders/wicks')}</span>
    </div>
    <ToggleSwitch
      checked={Boolean(settings.hollowCandles)}
      ariaLabel="Hollow Candles"
      onchange={(next) => onUpdateSettings({ hollowCandles: next })}
    />
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Transparansi Objek Pane Utama', 'Opasitas Objek Pane Utama', 'Main Pane Objects Opacity')} ({Math.round((settings.mainPaneObjectsOpacity ?? 1) * 100)}%)</span>
      <span class="setting-desc">{$tr('Remengno indikator overlay, volume, VPVR, karo gambar nang pane utama tanpa ngganggu candle', 'Redupkan indikator overlay, volume overlay, VPVR, dan gambar pada pane harga utama tanpa memengaruhi lilin atau sub-pane lain', 'Dim overlay indicators, volume, VPVR, and drawings on the main pane without affecting candles')}</span>
    </div>
    <div class="opacity-slider-wrap" style="display: flex; align-items: center; gap: 8px; min-width: 150px;">
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.05"
        aria-label="Opasitas Objek Pane Utama"
        value={settings.mainPaneObjectsOpacity ?? 1}
        oninput={(e) => onUpdateSettings({ mainPaneObjectsOpacity: parseFloat(e.currentTarget.value) })}
        style="flex: 1; accent-color: var(--brand-primary);"
      />
      <span class="mono-nums" style="font-size: 11px; min-width: 36px; text-align: right;">
        {Math.round((settings.mainPaneObjectsOpacity ?? 1) * 100)}%
      </span>
    </div>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Bar Replay Controller</span>
      <span class="setting-desc">{$tr('Ketokno toolbar simulasi puter ulang candle lawas nang ndhuwur chart', 'Tampilkan toolbar replay candle historis di atas grafik', 'Show historical candle replay controls above the chart')}</span>
    </div>
    <ToggleSwitch
      checked={Boolean(settings.showReplayBar)}
      ariaLabel="Bar Replay Controller"
      onchange={(next) => onUpdateSettings({ showReplayBar: next })}
    />
  </div>

  <!-- Sesi Pasar RTH / ETH (Yahoo Finance Equities & Indices) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Jam Sesi Bursa (RTH / ETH)', 'Sesi Perdagangan (RTH / ETH)', 'Trading Sessions (RTH / ETH)')}</span>
      <span class="setting-desc">
        {#if isSessionAvailable}
          {$tr('Pilih Regular Trading Hours (RTH) utawa Extended Hours (ETH) lengkap karo warna Pre-Market & Post-Market.', 'Pilih Regular Trading Hours (RTH) atau Extended Hours (ETH) dengan shading Pre-Market & Post-Market.', 'Switch between Regular Trading Hours (RTH) and Extended Hours (ETH) with Pre/Post-Market shading.')}
        {:else}
          {$tr('Khusus saham & indeks Yahoo Finance. Market kripto 24/7 otomatis nyuekno shading sesi iki.', 'Aktif untuk saham & indeks Yahoo Finance. Pasar kripto 24/7 otomatis mengabaikan shading sesi.', 'Active for Yahoo Finance equities & indices. 24/7 crypto markets ignore session shading.')}
        {/if}
      </span>
    </div>
    <div class="segmented-group" role="group" aria-label="Pilihan Sesi Perdagangan">
      <button
        type="button"
        class="mode-chip {currentMarketSession === 'regular' ? 'active' : ''}"
        onclick={() => {
          if (onSetSession) {
            onSetSession('regular');
          } else {
            onUpdateSettings({ marketSession: 'regular' });
          }
        }}
        title="Regular Trading Hours (RTH)"
      >
        <span>RTH</span>
      </button>
      <button
        type="button"
        class="mode-chip {currentMarketSession === 'extended' ? 'active' : ''}"
        onclick={() => {
          if (onSetSession) {
            onSetSession('extended');
          } else {
            onUpdateSettings({ marketSession: 'extended' });
          }
        }}
        title="Extended Trading Hours (ETH)"
      >
        <span>ETH</span>
      </button>
    </div>
  </div>
</div>

<!-- Skala Harga & Label Sumbu Kanan -->
<div class="section-group">
  <h4 class="section-title">{$tr('Skala Rega & Badge Sumbu Tengen', 'Skala Harga & Label Sumbu Kanan', 'Price Scale & Right Axis Labels')}</h4>
  <p class="section-subtitle">
    {$tr('Setel garis rega mendatar karo label rega nang sumbu tengen chart.', 'Atur visibilitas garis harga horizontal dan label badge harga pada skala sumbu kanan.', 'Configure horizontal price lines and value badges along the right-hand price scale.')}
  </p>

  <!-- Garis Harga Terakhir (Current Price Line) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Garis Rega Saiki (Current Price Line)', 'Garis Harga Terakhir (Current Price Line)', 'Current Price Line')}</span>
      <span class="setting-desc">{$tr('Ketokno garis mendatar teko rega candle urip sampek skala tengen', 'Tampilkan garis horizontal dinamis yang membentang dari harga lilin aktif ke skala kanan', 'Draw a live horizontal line from the current bar price to the right scale')}</span>
    </div>
    <ToggleSwitch
      checked={settings.showCurrentPriceLine !== false}
      label="Garis Harga Terakhir"
      onchange={(next) => onUpdateSettings({ showCurrentPriceLine: next })}
    />
  </div>

  <!-- Hitung Mundur Penutupan Lilin (Countdown to Bar Close) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Countdown Tutup Candle', 'Hitung Mundur Penutupan Lilin', 'Countdown to Bar Close')}</span>
      <span class="setting-desc">{$tr('Ketokno sisa waktu sakdurunge candle saiki ganti candle anyar', 'Tampilkan hitung mundur waktu penutupan lilin aktif pada sumbu harga kanan', 'Display remaining time before the active candlestick closes')}</span>
    </div>
    <ToggleSwitch
      checked={Boolean(settings.showPriceScaleCountdown)}
      label="Hitung Mundur Penutupan Lilin"
      onchange={(next) => onUpdateSettings({ showPriceScaleCountdown: next })}
    />
  </div>

  <!-- Label Nilai Indikator di Skala Harga -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Badge Angka Indikator nang Sumbu Tengen', 'Label Nilai Indikator di Skala Kanan', 'Indicator Value Labels on Scale')}</span>
      <span class="setting-desc">{$tr('Ketokno angka terakhir teko indikator sing lagi dipasang nang sumbu tengen', 'Tampilkan badge angka nilai terakhir dari indikator teknikal aktif pada sumbu harga kanan', 'Show latest value badges for active technical indicators on the price axis')}</span>
    </div>
    <ToggleSwitch
      checked={settings.showIndicatorPriceLabels !== false}
      label="Label Nilai Indikator di Skala Kanan"
      onchange={(next) => onUpdateSettings({ showIndicatorPriceLabels: next })}
    />
  </div>

  <!-- Label Harga Posisi Long/Short & Gambar -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Badge Rega Posisi Long/Short & Gambar', 'Label Harga Posisi Long/Short & Gambar', 'Drawing & Long/Short Price Labels')}</span>
      <span class="setting-desc">{$tr('Ketokno badge rega Entry, TP, karo SL nang sumbu tengen', 'Tampilkan badge harga entry, target keuntungan (TP), dan batas rugi (SL) di sumbu kanan', 'Show Entry, TP, and SL price badges for drawings on the right axis')}</span>
    </div>
    <ToggleSwitch
      checked={settings.showDrawingPriceLabels !== false}
      label="Label Harga Posisi Long/Short & Gambar"
      onchange={(next) => onUpdateSettings({ showDrawingPriceLabels: next })}
    />
  </div>

  <!-- Garis Price Alert pada Grafik -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Garis Price Alert nang Chart', 'Garis Price Alert di Grafik', 'Price Alert Lines on Chart')}</span>
      <span class="setting-desc">{$tr('Ketokno garis & label alert nang kanvas (meski disingidno, alarm tetep jalan nang mburi layar)', 'Tampilkan garis & label alert pada kanvas (notifikasi latar belakang tetap berjalan saat disembunyikan)', 'Render alert lines on canvas (background alert monitoring stays active when hidden)')}</span>
    </div>
    <ToggleSwitch
      checked={settings.showAlertLines !== false}
      label="Garis Price Alert di Grafik"
      onchange={(next) => onUpdateSettings({ showAlertLines: next })}
    />
  </div>
</div>

<!-- Penanda Garis Waktu & Peristiwa Pasar (Timeline Marks & Events) -->
<div class="section-group">
  <h4 class="section-title">{$tr('Tenger Garis Waktu & Berita Makro (Timeline Marks)', 'Penanda Garis Waktu & Peristiwa Pasar (Timeline Marks)', 'Timeline Marks & Market Events')}</h4>
  <p class="section-subtitle">
    {$tr('Pasang tenger rilis berita makro, eksekusi plan, karo catetan jurnal nang garis waktu ngisor chart.', 'Tampilkan penanda peristiwa ekonomi makro, eksekusi trading plan, dan catatan jurnal langsung pada sumbu horizontal waktu chart.', 'Display macroeconomic releases, trade plan fills, and journal pins along the time axis.')}
  </p>

  <!-- Acara Kalender Makroekonomi -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Berita Kalender Makroekonomi (FOMC, CPI, NFP)', 'Acara Kalender Makroekonomi (FOMC, CPI, NFP)', 'Macroeconomic Calendar Events (FOMC, CPI, NFP)')}</span>
      <span class="setting-desc">{$tr('Ketokno bunderan tenger berita ekonomi nang sumbu waktu chart', 'Tampilkan titik penanda rilis ekonomi pada sumbu waktu chart', 'Show economic release markers along the chart timeline')}</span>
    </div>
    <ToggleSwitch
      checked={isMacroMarksVisible}
      label="Acara Kalender Makroekonomi"
      onchange={() => toggleMacroMarks()}
    />
  </div>

  {#if isMacroMarksVisible}
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">{$tr('Mung Berita High Impact Wae', 'Hanya High Impact di Chart', 'High-Impact Events Only')}</span>
        <span class="setting-desc">{$tr('Singidno berita ecek-ecek (Medium/Low) ben chart gak rame', 'Sembunyikan penanda event Medium dan Low Impact dari sumbu waktu chart', 'Hide Medium and Low impact markers from the chart timeline')}</span>
      </div>
      <ToggleSwitch
        checked={isMacroHighImpactOnly}
        label="Hanya High Impact di Chart"
        onchange={() => toggleMacroHighImpactOnly()}
      />
    </div>
  {/if}

  <!-- Eksekusi Trading Plan -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Tenger Titik Trade Plan (Entry, TP, SL)', 'Titik Eksekusi Rencana Trading (Entry, TP, SL)', 'Trade Plan Touch Markers (Entry, TP, SL)')}</span>
      <span class="setting-desc">{$tr('Ketokno ikon tenger pas candle nyenggol level Entry, TP, utawa SL plan-mu', 'Tampilkan penanda glyph visual pada lilin di mana order plan terisi atau tersentuh', 'Display glyph markers on bars where trade plan levels were touched')}</span>
    </div>
    <ToggleSwitch
      checked={isTradesMarksVisible}
      label="Titik Eksekusi Rencana Trading"
      onchange={() => toggleTradesMarks()}
    />
  </div>

  <!-- Catatan Jurnal & Tesis -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Catetan Jurnal & Tesis Trader', 'Catatan Jurnal & Tesis Trader', 'Trader Journal & Thesis Pins')}</span>
      <span class="setting-desc">{$tr('Tempelno catetan evaluasi pribadimu nang candle jam tertentu', 'Sematkan anotasi personal dan catatan evaluasi pada timestamp candle tertentu', 'Pin personal annotations and review notes onto specific bar timestamps')}</span>
    </div>
    <ToggleSwitch
      checked={isJournalMarksVisible}
      label="Catatan Jurnal & Tesis Trader"
      onchange={() => toggleJournalMarks()}
    />
  </div>

  <!-- Tombol Dialog Events Bawaan Vela -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Setelan Lanjutan Events (Vela Events Tab)', 'Detail Pengaturan Events (Vela Events Tab)', 'Advanced Events Settings (Vela Events Tab)')}</span>
      <span class="setting-desc">{$tr('Bukak setelan lengkap penanda event nang dialog asli Vela', 'Buka konfigurasi lanjutan penanda peristiwa pada dialog bawaan chart', 'Open detailed event marker settings in the native Vela dialog')}</span>
    </div>
    <button
      type="button"
      class="btn-test-notification"
      onclick={() => {
        onClose();
        onOpenChartSettings?.('Events');
      }}
      title={$tr('Bukak dialog setelan events Vela', 'Buka dialog pengaturan events bawaan Vela', 'Open Vela events settings')}
    >
      <SlidersHorizontal size={13} />
      <span>{$tr('Bukak Events Settings', 'Buka Events Settings', 'Open Events Settings')}</span>
    </button>
  </div>
</div>

<!-- Konfigurasi Lilin & Tampilan VelaChart -->
<div class="section-group">
  <h4 class="section-title">{$tr('Werna Candle & Oprekan VelaChart', 'Warna Lilin & Tampilan VelaChart', 'Candlestick Colors & VelaChart Settings')}</h4>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Setelan Candle & Bar (Vela Settings)', 'Pengaturan Lilin & Bar (Vela Settings)', 'Candle & Bar Properties (Vela Settings)')}</span>
      <span class="setting-desc">{$tr('Oprek werna candle, garis pinggir, sumbu, jarak bar, karo animasi liwat modal VelaChart', 'Kustomisasi warna candle, borders, wick, spacing, dan animasi via modal VelaChart', 'Customize candle colors, borders, wicks, bar spacing, and animations via VelaChart modal')}</span>
    </div>
    <button
      type="button"
      class="btn-test-notification"
      onclick={() => {
        onClose();
        onOpenChartSettings?.('Symbol');
      }}
      title={$tr('Bukak dialog setelan candle Vela', 'Buka dialog pengaturan lilin Vela', 'Open Vela candle settings')}
    >
      <SlidersHorizontal size={13} />
      <span>{$tr('Bukak Chart Settings', 'Buka Chart Settings', 'Open Chart Settings')}</span>
    </button>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Simpen Setelan Chart dadi Default', 'Simpan Konfigurasi Chart sebagai Default', 'Save Current Chart Setup as Default')}</span>
      <span class="setting-desc">{$tr('Dadekno werna candle, skala, karo tampilan Vela saiki dadi patokan default permanen', 'Jadikan warna lilin, skala, dan tampilan Vela saat ini sebagai preset konfigurasi default permanen', 'Save current Vela colors, scales, and layout properties as your permanent default')}</span>
      {#if saveDefaultFeedback}
        <span class="notification-test-feedback mono-nums">{saveDefaultFeedback}</span>
      {/if}
    </div>
    <button
      type="button"
      class="btn-test-notification"
      onclick={handleSaveChartAsDefaultClick}
      title={$tr('Simpen setelan chart saiki dadi default permanen', 'Simpan konfigurasi chart saat ini sebagai default permanen', 'Save current chart setup as default')}
    >
      <Save size={12} />
      <span>{$tr('Simpen dadi Default', 'Simpan sebagai Default', 'Save as Default')}</span>
    </button>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Balikno Setelan Candle nang Awal Pabrik', 'Reset Konfigurasi Lilin ke Default Pabrik', 'Reset Candle Properties to Factory Defaults')}</span>
      <span class="setting-desc">{$tr('Busek setelan default oprekanmu lan balikno werna asli Vela', 'Hapus preset konfigurasi default yang pernah disimpan dan kembalikan ke warna awal bawaan Vela', 'Clear saved overrides and restore original Vela candlestick defaults')}</span>
      {#if resetChartFeedback}
        <span class="notification-test-feedback mono-nums">{resetChartFeedback}</span>
      {/if}
    </div>
    <button
      type="button"
      class="btn-reset-font"
      onclick={handleResetChartFactoryClick}
      title={$tr('Balikno setelan candle nang pabrik', 'Kembalikan konfigurasi lilin ke default pabrik', 'Restore factory candle defaults')}
    >
      <RotateCcw size={12} />
      <span>{$tr('Balikno Pabrik', 'Reset ke Pabrik', 'Factory Reset')}</span>
    </button>
  </div>
</div>

<div class="section-group">
  <h4 class="section-title">{$tr(' Pin Timeframe Favorit', 'Sematan Timeframe Favorit', 'Pinned Favorite Timeframes')}</h4>
  <p class="section-subtitle">
    {$tr('Pilih timeframe endi wae sing kate dipajang langsung nang bar dhuwur chart.', 'Pilih timeframe mana saja yang disematkan langsung di bilah navigasi kilat header grafik.', 'Choose which timeframe intervals stay pinned in the top chart toolbar.')}
  </p>

  <!-- Pilihan Sematan Timeframe Favorit -->
  <div class="setting-box-column">
    <div class="setting-info-header">
      <span class="setting-label">{$tr('Timeframe Favorit nang Header (intang ⭐)', 'Timeframe Favorit di Header (Sematkan ⭐)', 'Pinned Header Timeframes (⭐)')}</span>
      <span class="setting-desc">{$tr('Klik bintang gawe masang utawa nyopot timeframe teko header', 'Pilih timeframe mana saja yang tampil di bilah navigasi kilat', 'Click to pin or unpin intervals on the quick bar')}</span>
    </div>

    <div class="tf-favorites-chips-grid">
      {#each ALL_AVAILABLE_TIMEFRAMES as tfOpt}
        {@const isStarred = (settings.favoriteTimeframes || ['1m', '5m', '15m', '1h', '4h', '1D']).includes(tfOpt.id)}
        <button
          type="button"
          class="tf-fav-chip {isStarred ? 'starred' : ''}"
          title="{isStarred ? $tr('Copot teko header', 'Lepas sematan', 'Unpin') : $tr('Pasang nang header', 'Sematkan ke bilah atas', 'Pin to header')} {tfOpt.label}"
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
            title="{isStarred ? $tr('Copot teko header', 'Lepas sematan', 'Unpin') : $tr('Pasang nang header', 'Sematkan ke bilah atas', 'Pin to header')} {ctf}"
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
        {(settings.favoriteTimeframes || ['1m', '5m', '15m', '1h', '4h', '1D']).length} {$tr('timeframe kepasang nang bar dhuwur', 'timeframe disematkan di bilah atas', 'timeframes pinned to top bar')}
      </span>
      <button
        type="button"
        class="reset-defaults-btn"
        title="1m, 5m, 15m, 1h, 4h, 1D"
        onclick={() => onUpdateSettings({ favoriteTimeframes: ['1m', '5m', '15m', '1h', '4h', '1D'] })}
      >
        <RotateCcw size={11} />
        <span>{$tr('Balikno Standar', 'Reset Standar', 'Reset Defaults')}</span>
      </button>
    </div>
  </div>
</div>

<!-- SEKSI 3: SINKRONISASI MULTI-CHART -->
<div class="section-group">
  <h4 class="section-title">{$tr('Sinkronisasi Multi-Chart Grid', 'Sinkronisasi Multi-Chart Grid', 'Multi-Chart Grid Synchronization')}</h4>
  <p class="section-subtitle">
    {$tr('Setel opo wae sing melu bareng pas koen mbukak mode 2 Split utawa 4 Grid.', 'Atur preferensi sinkronisasi bawaan saat menggunakan tata letak multi-chart (2 Split, 4 Grid, dsb.).', 'Configure default pane synchronization behavior in split/grid multi-chart layouts.')}
  </p>

  <!-- Sinkronisasi Multi-Chart Cards Grid -->
  <div class="setting-box-column">
    <div class="setting-info-header">
      <span class="setting-label">{$tr('Setelan Awal Sinkronisasi Multi-Chart', 'Perilaku Default Sinkronisasi Multi-Chart', 'Default Multi-Chart Sync Rules')}</span>
      <span class="setting-desc">{$tr('Otomatis aktif pas pindah nang mode 2 Split, 3 Pane, utawa 4 Grid', 'Status sinkronisasi awal saat beralih ke tata letak split/grid (2 Split, 4 Grid, dsb.)', 'Initial sync state when switching into split or grid layouts')}</span>
    </div>

    <div class="multichart-sync-settings-grid">
      <!-- 1. Crosshair Sync -->
      <div class="sync-setting-card">
        <div class="sync-card-info">
          <div class="sync-card-title">
            <Crosshair size={13} class="sync-icon" />
            <span>{$tr('Kursor Crosshair', 'Kursor Crosshair', 'Crosshair Cursor')}</span>
          </div>
          <span class="sync-card-desc">{$tr('Gerakno kursor barengan nang kabeh kotak chart', 'Sinkronkan koordinat kursor mouse serempak antar panel grafik', 'Sync mouse crosshair coordinates across all panes')}</span>
        </div>
        <ToggleSwitch
          checked={settings.syncConfig?.crosshair ?? true}
          ariaLabel="Sinkronisasi Kursor Crosshair"
          onchange={() => handleToggleSync('crosshair')}
        />
      </div>

      <!-- 2. Viewport / Scroll Sync -->
      <div class="sync-setting-card">
        <div class="sync-card-info">
          <div class="sync-card-title">
            <Move size={13} class="sync-icon" />
            <span>{$tr('Geseran Waktu (Viewport)', 'Gerakan Viewport (Waktu)', 'Time Viewport (Pan/Zoom)')}</span>
          </div>
          <span class="sync-card-desc">{$tr('Zoom lan geser jam candle barengan antar chart', 'Penyelarasan zoom dan pan horizontal rentang waktu candle', 'Align horizontal zoom and time scrolling across panes')}</span>
        </div>
        <ToggleSwitch
          checked={settings.syncConfig?.viewport ?? true}
          ariaLabel="Sinkronisasi Viewport"
          onchange={() => handleToggleSync('viewport')}
        />
      </div>

      <!-- 3. Symbol Sync -->
      <div class="sync-setting-card">
        <div class="sync-card-info">
          <div class="sync-card-title">
            <Coins size={13} class="sync-icon" />
            <span>{$tr('Koin / Simbol Pair', 'Simbol Pasar (Pair)', 'Market Symbol (Pair)')}</span>
          </div>
          <span class="sync-card-desc">{$tr('Ganti koin nang siji chart langsung ngganti kabeh chart', 'Ganti simbol di satu chart otomatis mengganti semua chart', 'Changing symbol in one pane updates all panes')}</span>
        </div>
        <ToggleSwitch
          checked={settings.syncConfig?.symbol ?? false}
          ariaLabel="Sinkronisasi Simbol Pasar"
          onchange={() => handleToggleSync('symbol')}
        />
      </div>

      <!-- 4. Drawings Sync -->
      <div class="sync-setting-card">
        <div class="sync-card-info">
          <div class="sync-card-title">
            <PenTool size={13} class="sync-icon" />
            <span>{$tr('Gambar & Garis (Drawings)', 'Objek Gambar (Drawings)', 'Chart Drawings')}</span>
          </div>
          <span class="sync-card-desc">{$tr('Trendline, kotak SNR, lan coretan nyambung nang kabeh timeframe', 'Garis tren, horizontal line, dan anotasi gambar tersinkron', 'Sync trendlines, boxes, and annotations across panes')}</span>
        </div>
        <ToggleSwitch
          checked={settings.syncConfig?.drawings ?? true}
          ariaLabel="Sinkronisasi Objek Gambar"
          onchange={() => handleToggleSync('drawings')}
        />
      </div>

      <!-- 5. Indicators Sync (Auto-Clone) -->
      <div class="sync-setting-card">
        <div class="sync-card-info">
          <div class="sync-card-title">
            <Layers size={13} class="sync-icon" />
            <span>{$tr('Indikator Teknikal', 'Indikator Teknikal', 'Technical Indicators')}</span>
          </div>
          <span class="sync-card-desc">{$tr('Otomatis nyalin indikator aktif nang kotak chart anyar', 'Duplikasi indikator aktif ke seluruh cell layout baru secara otomatis', 'Automatically clone active indicators into new grid panes')}</span>
        </div>
        <ToggleSwitch
          checked={settings.syncConfig?.indicators ?? true}
          ariaLabel="Sinkronisasi Indikator Teknikal"
          onchange={() => handleToggleSync('indicators')}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .section-group {
    margin-bottom: 22px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-dim, #808080);
    margin: 0 0 6px 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-subtitle {
    font-size: 11px;
    color: var(--text-muted, #A3A3A3);
    margin: -2px 0 8px 2px;
    line-height: 1.4;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 11px 14px;
    background: var(--bg-panel, #171717);
    border: none;
    border-radius: var(--radius-md, 6px);
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

  .grid-mode-selector {
    display: flex;
    align-items: center;
    background-color: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
    padding: 2px;
    gap: 2px;
  }

  .mode-chip {
    padding: 4px 10px;
    background: none;
    border: none;
    border-radius: 3px;
    color: var(--text-dim, #8b949e);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-chip:hover {
    color: var(--text-base, #ffffff);
  }

  .mode-chip.active {
    background-color: var(--bg-hover, #21262d);
    color: var(--brand-primary, #00f090);
    font-weight: 600;
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
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 4px;
  }

  .sync-setting-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--bg-panel, #171717);
    border: none;
    border-radius: var(--radius-md, 6px);
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
