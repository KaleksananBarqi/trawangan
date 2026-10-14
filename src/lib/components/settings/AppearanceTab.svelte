<script lang="ts">
  import { Check, Minus, Plus, RotateCcw } from '@lucide/svelte';
  import {
    THEME_PRESETS,
    UI_FONT_OPTIONS,
    MONO_FONT_OPTIONS,
    FONT_SIZE_PRESETS,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    DEFAULT_FONT_SIZE
  } from '../../constants/themes';
  import type { AppSettings } from '../../types/market';

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  }

  let { settings, onUpdateSettings }: Props = $props();

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

  const activePreset = $derived(THEME_PRESETS[settings.themePreset || 'signature'] || THEME_PRESETS.signature);
  const currentBull = $derived(settings.customBullColor || activePreset.chart.upColor);
  const currentBear = $derived(settings.customBearColor || activePreset.chart.downColor);
  const isCustomActive = $derived(Boolean(settings.customBullColor || settings.customBearColor));

  function handleResetCandleColors() {
    onUpdateSettings({ customBullColor: undefined, customBearColor: undefined });
  }
</script>

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

  <!-- Kustomisasi Warna Candlestick Hibrida -->
  <div class="custom-candle-box">
    <div class="custom-candle-header">
      <div class="custom-candle-info">
        <span class="custom-candle-title">Kustomisasi Warna Candlestick</span>
        <span class="custom-candle-desc">
          Atur warna lilin Bullish dan Bearish secara mandiri. Garis tepi otomatis dihitung 15% lebih gelap dan sumbu mengikuti badan.
        </span>
      </div>
      <div class="custom-candle-actions">
        {#if isCustomActive}
          <span class="custom-active-badge">Custom Aktif</span>
        {:else}
          <span class="custom-theme-badge">Mengikuti Tema</span>
        {/if}
        <button
          type="button"
          class="btn-reset-candle"
          onclick={handleResetCandleColors}
          disabled={!isCustomActive}
          title="Kembalikan warna candlestick ke setelan bawaan tema aktif"
        >
          <RotateCcw size={12} />
          <span>Reset ke Tema</span>
        </button>
      </div>
    </div>

    <div class="custom-candle-inputs">
      <!-- Bullish Picker -->
      <div class="candle-picker-card">
        <div class="picker-label-row">
          <span class="picker-title">Candlestick Bullish (Naik)</span>
          <span class="picker-current-hex mono-nums">{currentBull}</span>
        </div>
        <div class="picker-controls">
          <input
            type="color"
            class="color-input"
            value={currentBull}
            onchange={(e) => onUpdateSettings({ customBullColor: e.currentTarget.value })}
            aria-label="Warna Candlestick Bullish"
          />
          <input
            type="text"
            class="hex-text-input mono-nums"
            value={currentBull}
            maxlength="7"
            onchange={(e) => {
              const val = e.currentTarget.value.trim();
              if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
                onUpdateSettings({ customBullColor: val });
              }
            }}
          />
        </div>
      </div>

      <!-- Bearish Picker -->
      <div class="candle-picker-card">
        <div class="picker-label-row">
          <span class="picker-title">Candlestick Bearish (Turun)</span>
          <span class="picker-current-hex mono-nums">{currentBear}</span>
        </div>
        <div class="picker-controls">
          <input
            type="color"
            class="color-input"
            value={currentBear}
            onchange={(e) => onUpdateSettings({ customBearColor: e.currentTarget.value })}
            aria-label="Warna Candlestick Bearish"
          />
          <input
            type="text"
            class="hex-text-input mono-nums"
            value={currentBear}
            maxlength="7"
            onchange={(e) => {
              const val = e.currentTarget.value.trim();
              if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
                onUpdateSettings({ customBearColor: val });
              }
            }}
          />
        </div>
      </div>
    </div>
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

<style>
  .section-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0;
  }

  .section-subtitle {
    font-size: 11.5px;
    color: var(--text-muted);
    line-height: 1.4;
    margin: -4px 0 2px 0;
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

  .custom-candle-box {
    margin-top: 14px;
    padding: 14px 16px;
    background: var(--bg-surface, #141414);
    border: 1px solid var(--border-subtle, #242424);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .custom-candle-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .custom-candle-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .custom-candle-title {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-main, #f7f7f7);
    letter-spacing: 0.02em;
  }

  .custom-candle-desc {
    font-size: 11px;
    color: var(--text-muted, #a3a3a3);
    max-width: 480px;
    line-height: 1.4;
  }

  .custom-candle-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .custom-active-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--brand-primary, #ff69b4);
    background: rgba(255, 105, 180, 0.12);
    border: 1px solid rgba(255, 105, 180, 0.3);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .custom-theme-badge {
    font-size: 10px;
    color: var(--text-muted, #a3a3a3);
    background: var(--bg-elevated, #1e1e1e);
    border: 1px solid var(--border-hairline, #242424);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .btn-reset-candle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    background: var(--bg-elevated, #1e1e1e);
    border: 1px solid var(--border-hairline, #242424);
    color: var(--text-main, #f7f7f7);
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-reset-candle:hover:not(:disabled) {
    background: var(--bg-hover, #2a2a2a);
    border-color: var(--border-subtle, #333333);
  }

  .btn-reset-candle:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .custom-candle-inputs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .candle-picker-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: var(--bg-darkest, #0f0f0f);
    border: 1px solid var(--border-hairline, #242424);
    border-radius: 6px;
  }

  .picker-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .picker-title {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted, #a3a3a3);
  }

  .picker-current-hex {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main, #f7f7f7);
  }

  .picker-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-input {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    width: 32px;
    height: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
  }

  .color-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-input::-webkit-color-swatch {
    border: 1px solid var(--border-subtle, #333);
    border-radius: 4px;
  }

  .hex-text-input {
    flex: 1;
    background: var(--bg-surface, #141414);
    border: 1px solid var(--border-hairline, #242424);
    color: var(--text-main, #f7f7f7);
    font-size: 11px;
    padding: 5px 8px;
    border-radius: 4px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .hex-text-input:focus {
    border-color: var(--brand-primary, #ff69b4);
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
    color: var(--text-muted);
  }

  .select-input {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11.5px;
    padding: 5px 8px;
    border-radius: var(--radius-xs);
    outline: none;
    cursor: pointer;
  }

  .select-input:focus {
    border-color: var(--brand-primary);
  }

  .setting-box-column {
    display: flex;
    flex-direction: column;
  }

  .custom-font-section {
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 14px;
    gap: 12px;
  }

  .setting-info-header {
    display: flex;
    flex-direction: column;
    gap: 3px;
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
    font-size: 0.9em;
  }

  .text-bull {
    color: var(--bull-color);
  }

  .text-bear {
    color: var(--bear-color);
  }

  .preview-pnl {
    margin-left: auto;
    font-weight: 700;
  }
</style>
