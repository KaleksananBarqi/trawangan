<script lang="ts">
  import {
    Minus,
    Plus,
    RotateCcw,
    Type,
    Monitor
  } from '@lucide/svelte';
  import {
    UI_FONT_OPTIONS,
    MONO_FONT_OPTIONS,
    FONT_SIZE_PRESETS,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    DEFAULT_FONT_SIZE
  } from '../../constants/themes';
  import type { AppSettings, UiDensity } from '../../types/market';
  import { tr } from '../../i18n';

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

  let effectiveFontSize = $derived(
    settings.fontSize ?? (settings.uiDensity === 'compact' ? 11 : settings.uiDensity === 'comfortable' ? 13.5 : DEFAULT_FONT_SIZE)
  );

  function handleStepFontSize(delta: number) {
    handleSetFontSize(effectiveFontSize + delta);
  }

  function handleSetDensity(density: UiDensity) {
    let size = DEFAULT_FONT_SIZE;
    if (density === 'compact') size = 11;
    else if (density === 'comfortable') size = 13.5;
    onUpdateSettings({ uiDensity: density, fontSize: size });
  }
</script>

<div class="section-group">
  <div class="section-header-row">
    <div>
      <h4 class="section-title">{$tr('Tipografi & Ukuran Huruf Terminal', 'Tipografi & Skala Teks Antarmuka', 'Typography & Interface Text Scale')}</h4>
      <p class="section-subtitle">
        {$tr('Setel model huruf menu, font angka/kode monospace, karo gede-cilike teks ben pas lan seger nang layarmu.', 'Atur jenis huruf antarmuka, font angka/kode monospace, serta sesuaikan ukuran teks agar optimal di layar monitor Anda.', 'Customize UI font family, monospace price/code font, and text scaling to match your display resolution.')}
      </p>
    </div>
  </div>

  <!-- Pilihan Font UI Sans -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Font Menu & Tombol (UI Sans)', 'Font Family Antarmuka (UI Sans)', 'Interface Font Family (UI Sans)')}</span>
      <span class="setting-desc">{$tr('Huruf gawe navigasi, menu, modal dialog, karo tombol', 'Font untuk navigasi, menu, dialog modal, dan tombol antarmuka', 'Font used across navigation bars, menus, dialogs, and buttons')}</span>
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

  <!-- Pilihan Font Monospace Angka & Kode -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Font Angka Rega & Kode (Monospace)', 'Font Angka & Kode (Monospace)', 'Numeric & Code Font (Monospace)')}</span>
      <span class="setting-desc">{$tr('Huruf presisi gawe digit rega chart, tabel angka, karo editor Pine Script', 'Font untuk digit harga chart, orderflow, dan editor Pine Script', 'Fixed-width font for price scales, tabular numbers, and Pine Script IDE')}</span>
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

  <!-- Kerapatan Antarmuka (UI Density) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr(' Rapat-Longgare Tampilan (UI Density)', 'Kerapatan Tampilan (UI Density)', 'Interface Density')}</span>
      <span class="setting-desc">{$tr('Jarak padding tombol, header, karo panel terminal', 'Spasi padding tombol, header, dan elemen visual antarmuka', 'Padding and spacing density across toolbars, headers, and panels')}</span>
    </div>
    <div class="density-btn-group" role="radiogroup" aria-label="Kerapatan UI">
      <button
        type="button"
        class="density-btn {settings.uiDensity === 'compact' ? 'active' : ''}"
        onclick={() => handleSetDensity('compact')}
        title={$tr('Padet gawe layar laptop cilik 13-14 inci', 'Spasi padat untuk layar kecil laptop 13-14 inci', 'Compact spacing for 13-14 inch laptops')}
      >
        <span>{$tr('Padet (11px)', 'Ringkas (11px)', 'Compact (11px)')}</span>
      </button>
      <button
        type="button"
        class="density-btn {(settings.uiDensity || 'regular') === 'regular' ? 'active' : ''}"
        onclick={() => handleSetDensity('regular')}
        title={$tr('Pas imbang gawe monitor standar 1080p', 'Spasi ideal seimbang untuk monitor standar 1080p', 'Balanced spacing for standard 1080p displays')}
      >
        <span>{$tr('Standar (12px)', 'Standar (12px)', 'Regular (12px)')}</span>
      </button>
      <button
        type="button"
        class="density-btn {settings.uiDensity === 'comfortable' ? 'active' : ''}"
        onclick={() => handleSetDensity('comfortable')}
        title={$tr('Ombo lega gawe monitor gede 2K / 4K', 'Spasi lega untuk layar resolusi tinggi 2K / 4K', 'Spacious layout for 2K / 4K high-res monitors')}
      >
        <span>{$tr('Ombo (13.5px)', 'Lega (13.5px)', 'Comfortable (13.5px)')}</span>
      </button>
    </div>
  </div>

  <!-- Kustom Ukuran Font Bebas (Slider + Stepper) -->
  <div class="setting-box-column custom-font-section">
    <div class="setting-info-header">
      <div class="setting-title-with-badge">
        <span class="setting-label">{$tr('Ukuran Huruf Presisi (Stepper & Slider)', 'Ukuran Font Presisi (Fine-Tuning Stepper & Slider)', 'Precision Font Size (Stepper & Slider)')}</span>
        <span class="font-current-badge mono-nums">
          {effectiveFontSize}px
        </span>
      </div>
      <span class="setting-desc">
        {$tr('Geser slider utawa ketik langsung ukuran huruf ben enak disawang nang laptop 13-14", monitor 1080p, 2K, sampek 4K.', 'Sesuaikan ukuran teks secara presisi dengan slider, stepper, atau input angka bebas agar pas dengan resolusi layar Anda (laptop 13-14", monitor 1080p, 2K, hingga 4K).', 'Fine-tune text size using the slider, steppers, or direct input to match your screen size (13-14" laptop, 1080p, 2K, or 4K).')}
      </span>
    </div>

    <!-- Kontrol Interaktif: Stepper [-] + Range Slider + Stepper [+] + Input Langsung + Reset -->
    <div class="font-controls-bar">
      <button
        type="button"
        class="font-step-btn"
        onclick={() => handleStepFontSize(-0.5)}
        title={$tr('Cilikno huruf 0.5px', 'Perkecil font 0.5px', 'Decrease font by 0.5px')}
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
          value={effectiveFontSize}
          oninput={(e) => handleSetFontSize(parseFloat(e.currentTarget.value))}
        />
        <div class="slider-ticks">
          <span>{MIN_FONT_SIZE}px (Min)</span>
          <span>12px ({$tr('Default', 'Bawaan', 'Default')})</span>
          <span>{MAX_FONT_SIZE}px ({$tr('Pol', 'Maks', 'Max')})</span>
        </div>
      </div>

      <button
        type="button"
        class="font-step-btn"
        onclick={() => handleStepFontSize(0.5)}
        title={$tr('Gedekno huruf 0.5px', 'Perbesar font 0.5px', 'Increase font by 0.5px')}
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
          value={effectiveFontSize}
          onchange={(e) => handleSetFontSize(parseFloat(e.currentTarget.value))}
        />
        <span class="font-unit">px</span>
      </div>

      <button
        type="button"
        class="btn-reset-font"
        onclick={() => handleSetFontSize(DEFAULT_FONT_SIZE)}
        title={$tr('Balikno ukuran awal 12px', 'Kembalikan ke ukuran standar bawaan 12px', 'Reset to default 12px size')}
      >
        <RotateCcw size={12} />
        <span>{$tr('Balikno', 'Reset', 'Reset')}</span>
      </button>
    </div>

    <!-- Shortcut Preset Ukuran Layar Monitor -->
    <div class="font-presets-row">
      <span class="presets-row-label">{$tr('Preset Layar Monitor:', 'Preset Layar Monitor:', 'Display Presets:')}</span>
      <div class="font-presets-chips">
        {#each FONT_SIZE_PRESETS as preset}
          {@const currentSize = effectiveFontSize}
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
      style="--preview-font-size: {effectiveFontSize}px;"
    >
      <div class="preview-header">
        <span class="preview-title">{$tr('Conto Tampilan Langsung (Skala Nyata)', 'Live Preview Tampilan (Skala Nyata)', 'Live Typography Preview (Actual Scale)')}</span>
        <span class="preview-badge mono-nums">
          {effectiveFontSize}px
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
    gap: 16px;
  }

  .section-header-row {
    margin-bottom: 4px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
    margin: 0 0 4px 0;
  }

  .section-subtitle {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 14px;
    background-color: var(--bg-panel);
    border: none;
    border-radius: var(--radius-md);
    gap: 16px;
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
    font-size: 10.5px;
    color: var(--text-muted);
  }

  .select-input {
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    padding: 6px 10px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    outline: none;
    cursor: pointer;
    min-width: 190px;
  }

  .select-input:focus {
    border-color: var(--brand-primary);
  }

  .density-btn-group {
    display: flex;
    align-items: center;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 2px;
    gap: 2px;
  }

  .density-btn {
    padding: 5px 10px;
    background: none;
    border: none;
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .density-btn:hover {
    color: var(--text-main);
  }

  .density-btn.active {
    background-color: var(--bg-hover);
    color: var(--brand-primary);
    font-weight: 600;
  }

  .setting-box-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
  }

  .setting-info-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting-title-with-badge {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .font-current-badge {
    font-size: 11px;
    font-weight: 700;
    color: var(--brand-primary);
    background: rgba(0, 240, 144, 0.12);
    padding: 2px 8px;
    border-radius: var(--radius-xs);
  }

  .font-controls-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .font-step-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .font-step-btn:hover {
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .slider-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .font-range-slider {
    width: 100%;
    accent-color: var(--brand-primary);
    cursor: pointer;
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
    gap: 4px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 2px 6px;
  }

  .font-number-input {
    width: 44px;
    background: none;
    border: none;
    color: var(--text-main);
    font-size: 11px;
    text-align: right;
    outline: none;
  }

  .font-unit {
    font-size: 10px;
    color: var(--text-dim);
  }

  .btn-reset-font {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 10.5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-reset-font:hover {
    color: var(--text-main);
    border-color: var(--border-bright);
  }

  .font-presets-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 4px;
    border-top: 1px dashed var(--border-subtle);
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
    background-color: rgba(0, 240, 144, 0.12);
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
    background-color: var(--bg-darkest, #06090e);
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
    background: rgba(0, 240, 144, 0.12);
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
    color: var(--bull-color, #00f090);
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
    color: var(--bull-color, #00f090);
  }

  .text-bear {
    color: var(--bear-color, #ff3b69);
  }
</style>
