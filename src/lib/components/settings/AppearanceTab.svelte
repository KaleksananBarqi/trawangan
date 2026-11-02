<script lang="ts">
  import {
    Check, Minus, Plus, RotateCcw, Copy, CheckCheck, Sun, Moon, Palette, FileText, Clipboard, X, Monitor,
    Save, Trash2, Edit2, Download
  } from '@lucide/svelte';
  import {
    THEME_PRESETS,
    buildCustomPaletteFromPreset,
    parseCustomPaletteFromText,
    serializeCustomPaletteJson,
    serializeCustomPaletteText,
    createUserTheme,
    renameUserTheme,
    deleteUserTheme,
    resolveDeletedThemeFallback,
    resolveThemeConfig,
    buildThemeConfigFromUserTheme,
    isBuiltInTheme,
  } from '../../constants/themes';
  import { isDarkColor } from '../../utils/colorUtils';
  import type {
    AppSettings,
    ColorModePreference,
    CustomChartBackgroundConfig,
    CustomThemePalette,
    CustomCandleColors,
    CustomGeneralColors,
    CustomThemeDefinition,
    ThemePresetId,
  } from '../../types/market';

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  }

  let { settings, onUpdateSettings }: Props = $props();

  const filterMode = $derived<'all' | 'dark' | 'light'>(settings.themeFilterMode || 'all');
  let copyFeedback = $state<string | null>(null);
  let isPasteModalOpen = $state(false);
  let pasteInputText = $state('');
  let pasteError = $state<string | null>(null);

  // Dual-Theme Decoupling & User Presets State (#149)
  const syncChartWithAppTheme = $derived<boolean>(settings.syncChartWithAppTheme ?? true);
  const savedUserThemes = $derived<CustomThemeDefinition[]>(settings.savedUserThemes || []);
  let targetThemeSelection = $state<'app' | 'chart'>('app');

  // Modal Save As ("Simpan Sebagai Tema Baru")
  let isSaveAsModalOpen = $state(false);
  let saveAsThemeName = $state('');
  let saveAsThemeMode = $state<'dark' | 'light'>('dark');
  let saveAsError = $state<string | null>(null);

  // Modal Rename Preset Pengguna
  let isRenameModalOpen = $state(false);
  let renameTargetThemeId = $state<string | null>(null);
  let renameThemeName = $state('');
  let renameError = $state<string | null>(null);

  function setFilterMode(mode: 'all' | 'dark' | 'light') {
    onUpdateSettings({ themeFilterMode: mode });
  }

  const colorModePref = $derived<ColorModePreference>(settings.colorModePreference || 'system');

  // Koleksi seluruh preset yang tersedia (Preset Resmi Bawaan + Preset Pengguna Tersimpan) (#149)
  const allAvailablePresets = $derived.by(() => {
    const builtIns = Object.values(THEME_PRESETS);
    const customPresets = savedUserThemes.map((u) => buildThemeConfigFromUserTheme(u));
    return [...builtIns, ...customPresets];
  });

  const darkPresets = $derived(allAvailablePresets.filter((p) => p.mode === 'dark'));
  const lightPresets = $derived(allAvailablePresets.filter((p) => p.mode === 'light'));

  const filteredPresets = $derived.by(() => {
    if (filterMode === 'dark') return darkPresets;
    if (filterMode === 'light') return lightPresets;
    return allAvailablePresets;
  });

  function handleSetColorMode(mode: ColorModePreference) {
    onUpdateSettings({
      colorModePreference: mode,
      ...(mode === 'dark' ? { themePreset: (settings.activeDarkPreset as any) || 'signature' } : {}),
      ...(mode === 'light' ? { themePreset: (settings.activeLightPreset as any) || 'red_folder' } : {}),
      ...(syncChartWithAppTheme && mode === 'dark' ? { chartThemePreset: (settings.activeDarkPreset as any) || 'signature' } : {}),
      ...(syncChartWithAppTheme && mode === 'light' ? { chartThemePreset: (settings.activeLightPreset as any) || 'red_folder' } : {}),
    });
  }

  function handleSetDarkPreset(presetId: string) {
    onUpdateSettings({
      activeDarkPreset: presetId,
      ...(colorModePref === 'dark' ? { themePreset: presetId as any } : {}),
      ...(syncChartWithAppTheme && colorModePref === 'dark' ? { chartThemePreset: presetId as any } : {}),
    });
  }

  function handleSetLightPreset(presetId: string) {
    onUpdateSettings({
      activeLightPreset: presetId,
      ...(colorModePref === 'light' ? { themePreset: presetId as any } : {}),
      ...(syncChartWithAppTheme && colorModePref === 'light' ? { chartThemePreset: presetId as any } : {}),
    });
  }

  const activePreset = $derived(
    resolveThemeConfig(settings.themePreset || 'signature', savedUserThemes)
  );
  const defaultPalette = $derived<CustomThemePalette>(
    buildCustomPaletteFromPreset((settings.themePreset as ThemePresetId) || 'signature')
  );
  const currentPalette = $derived<CustomThemePalette>(
    settings.customPalette || defaultPalette
  );
  const isCustomActive = $derived(
    Boolean(settings.customPalette && settings.customPalette.enabled !== false)
  );
  const isPaletteDark = $derived(
    isDarkColor(currentPalette.general?.background || activePreset.chart.background || '#0F0F0F')
  );

  function handleSelectChartPreset(preset: { id: string; mode: 'dark' | 'light' }) {
    onUpdateSettings({
      chartThemePreset: preset.id,
      customPalette: null as any,
      customBullColor: undefined,
      customBearColor: undefined,
    });
  }

  function handleSelectAppThemeDropdown(selectedId: string) {
    const target = allAvailablePresets.find((p) => p.id === selectedId);
    const mode = target?.mode || 'dark';
    onUpdateSettings({
      themePreset: selectedId,
      theme: selectedId as any,
      colorModePreference: mode,
      ...(mode === 'dark' ? { activeDarkPreset: selectedId } : { activeLightPreset: selectedId }),
      customPalette: null as any,
    });
  }

  function handleSelectChartThemeDropdown(selectedId: string) {
    onUpdateSettings({
      chartThemePreset: selectedId,
      customPalette: null as any,
      customBullColor: undefined,
      customBearColor: undefined,
    });
  }

  function handleSelectPreset(preset: { id: string; mode: 'dark' | 'light' }) {
    if (syncChartWithAppTheme) {
      onUpdateSettings({
        themePreset: preset.id,
        chartThemePreset: preset.id,
        theme: preset.id as any,
        colorModePreference: preset.mode,
        ...(preset.mode === 'dark' ? { activeDarkPreset: preset.id } : { activeLightPreset: preset.id }),
        customPalette: null as any,
        customBullColor: undefined,
        customBearColor: undefined,
      });
    } else {
      if (targetThemeSelection === 'app') {
        onUpdateSettings({
          themePreset: preset.id,
          theme: preset.id as any,
          colorModePreference: preset.mode,
          ...(preset.mode === 'dark' ? { activeDarkPreset: preset.id } : { activeLightPreset: preset.id }),
          customPalette: null as any,
        });
      } else {
        handleSelectChartPreset(preset);
      }
    }
  }

  function handleOpenSaveAs() {
    saveAsThemeName = '';
    saveAsThemeMode = isPaletteDark ? 'dark' : 'light';
    saveAsError = null;
    isSaveAsModalOpen = true;
  }

  function handleConfirmSaveAs() {
    const cleanName = saveAsThemeName.trim();
    if (!cleanName) {
      saveAsError = 'Nama tema tidak boleh kosong.';
      return;
    }

    const lowerName = cleanName.toLowerCase();
    const isBuiltInDuplicate = Object.values(THEME_PRESETS).some(
      (p) => p.name.trim().toLowerCase() === lowerName || p.id.toLowerCase() === lowerName
    );
    const isUserDuplicate = savedUserThemes.some(
      (t) => t.name.trim().toLowerCase() === lowerName
    );

    if (isBuiltInDuplicate || isUserDuplicate) {
      saveAsError = 'Nama tema sudah digunakan, gunakan nama lain.';
      return;
    }

    const newTheme = createUserTheme(cleanName, saveAsThemeMode, currentPalette);
    const updatedList = [...savedUserThemes, newTheme];

    onUpdateSettings({
      savedUserThemes: updatedList,
      themePreset: newTheme.id,
      ...(syncChartWithAppTheme ? { chartThemePreset: newTheme.id } : {}),
      customPalette: undefined,
    });

    isSaveAsModalOpen = false;
    saveAsThemeName = '';
    saveAsError = null;
    copyFeedback = `Tema "${newTheme.name}" berhasil disimpan!`;
    setTimeout(() => { copyFeedback = null; }, 2500);
  }

  function handleOpenRename(themeId: string, currentName: string, e: MouseEvent) {
    e.stopPropagation();
    renameTargetThemeId = themeId;
    renameThemeName = currentName;
    renameError = null;
    isRenameModalOpen = true;
  }

  function handleConfirmRename() {
    if (!renameTargetThemeId) return;
    const cleanName = renameThemeName.trim();
    if (!cleanName) {
      renameError = 'Nama tema tidak boleh kosong.';
      return;
    }

    const lowerName = cleanName.toLowerCase();
    const isBuiltInDuplicate = Object.values(THEME_PRESETS).some(
      (p) => p.name.trim().toLowerCase() === lowerName || p.id.toLowerCase() === lowerName
    );
    const isUserDuplicate = savedUserThemes.some(
      (t) => t.id !== renameTargetThemeId && t.name.trim().toLowerCase() === lowerName
    );

    if (isBuiltInDuplicate || isUserDuplicate) {
      renameError = 'Nama tema sudah digunakan, gunakan nama lain.';
      return;
    }

    try {
      const updatedList = renameUserTheme(savedUserThemes, renameTargetThemeId, cleanName);
      onUpdateSettings({ savedUserThemes: updatedList });
      isRenameModalOpen = false;
      renameTargetThemeId = null;
      renameThemeName = '';
      copyFeedback = `Nama tema diperbarui menjadi "${cleanName}"!`;
      setTimeout(() => { copyFeedback = null; }, 2500);
    } catch (err: any) {
      renameError = err?.message || 'Gagal mengubah nama tema.';
    }
  }

  function handleDeleteUserTheme(themeId: string, themeName: string, e: MouseEvent) {
    e.stopPropagation();
    try {
      const updatedList = deleteUserTheme(savedUserThemes, themeId);
      const fallbackApp = resolveDeletedThemeFallback(themeId, settings.themePreset, 'signature');
      const fallbackChart = resolveDeletedThemeFallback(themeId, settings.chartThemePreset, 'signature');

      onUpdateSettings({
        savedUserThemes: updatedList,
        themePreset: fallbackApp,
        chartThemePreset: fallbackChart,
      });
      copyFeedback = `Tema "${themeName}" berhasil dihapus.`;
      setTimeout(() => { copyFeedback = null; }, 2500);
    } catch (err: any) {
      copyFeedback = `Gagal menghapus: ${err?.message || 'Error'}`;
      setTimeout(() => { copyFeedback = null; }, 3000);
    }
  }

  async function handleExportUserThemeText(themeId: string, themeName: string, e: MouseEvent) {
    e.stopPropagation();
    const userTheme = savedUserThemes.find((t) => t.id === themeId);
    if (!userTheme) return;
    try {
      await navigator.clipboard.writeText(serializeCustomPaletteText(userTheme.palette));
      copyFeedback = `Palet teks "${themeName}" disalin ke clipboard!`;
      setTimeout(() => { copyFeedback = null; }, 2500);
    } catch (_) {}
  }

  async function handleExportUserThemeJson(themeId: string, themeName: string, e: MouseEvent) {
    e.stopPropagation();
    const userTheme = savedUserThemes.find((t) => t.id === themeId);
    if (!userTheme) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(userTheme, null, 2));
      copyFeedback = `Tema "${themeName}" disalin ke clipboard sebagai JSON!`;
      setTimeout(() => { copyFeedback = null; }, 2500);
    } catch (_) {}
  }

  const handleExportUserTheme = handleExportUserThemeJson;

  function sanitizeHex(val: string): string | null {
    let v = val.trim();
    if (!v.startsWith('#') && /^[0-9A-Fa-f]{3,8}$/.test(v)) {
      v = '#' + v;
    }
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(v)) {
      return v;
    }
    return null;
  }

  function handleUpdatePaletteColor<T extends 'candles' | 'general'>(
    section: T,
    key: T extends 'candles' ? keyof CustomCandleColors : keyof CustomGeneralColors,
    val: string
  ) {
    const clean = sanitizeHex(val);
    if (!clean) return;
    onUpdateSettings({
      customPalette: {
        ...currentPalette,
        enabled: true,
        [section]: {
          ...currentPalette[section],
          [key]: clean,
        },
      },
    });
  }

  const handleUpdateCandle = (key: keyof CustomCandleColors, val: string) =>
    handleUpdatePaletteColor('candles', key, val);
  const handleUpdateGeneral = (key: keyof CustomGeneralColors, val: string) =>
    handleUpdatePaletteColor('general', key, val);

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(serializeCustomPaletteJson(currentPalette));
      copyFeedback = 'JSON palet berhasil disalin!';
      setTimeout(() => { copyFeedback = null; }, 2500);
    } catch (_) {}
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(serializeCustomPaletteText(currentPalette));
      copyFeedback = 'Format teks Hex berhasil disalin!';
      setTimeout(() => { copyFeedback = null; }, 2500);
    } catch (_) {}
  }

  async function handleCopySingle(hex: string, label: string) {
    try {
      await navigator.clipboard.writeText(hex);
      copyFeedback = `${label} (${hex}) disalin!`;
      setTimeout(() => { copyFeedback = null; }, 2000);
    } catch (_) {}
  }

  function handleOpenPaste() {
    pasteInputText = '';
    pasteError = null;
    isPasteModalOpen = true;
  }

  function handleApplyPaste() {
    const parsed = parseCustomPaletteFromText(pasteInputText);
    if (parsed) {
      onUpdateSettings({
        customPalette: parsed,
      });
      isPasteModalOpen = false;
      pasteInputText = '';
      pasteError = null;
      copyFeedback = 'Palet kustom berhasil diterapkan!';
      setTimeout(() => { copyFeedback = null; }, 2500);
    } else {
      pasteError = 'Format tidak dapat dikenali. Tempel JSON atau teks baris (misal: "Bullish body: #D4A5A5").';
    }
  }

  function handleResetCustomPalette() {
    onUpdateSettings({
      customPalette: undefined,
      customBullColor: undefined,
      customBearColor: undefined,
    });
  }

  // Kustomisasi latar belakang grafik (solid & vertikal gradient) (#128)
  const customBg = $derived<CustomChartBackgroundConfig>(
    settings.customChartBackground || {
      mode: 'theme',
      solidColor: '#0F0F0F',
      gradientTop: '#0F0F0F',
      gradientBottom: '#181A20',
    }
  );
  const bgMode = $derived(customBg.mode || 'theme');
  const solidColorVal = $derived(customBg.solidColor || activePreset.chart.background || '#0F0F0F');
  const gradientTopVal = $derived(customBg.gradientTop || activePreset.chart.background || '#0F0F0F');
  const gradientBottomVal = $derived(customBg.gradientBottom || '#181A20');
  const isCustomBgActive = $derived(bgMode !== 'theme');

  function handleSetBgMode(mode: 'theme' | 'solid' | 'gradient') {
    onUpdateSettings({
      customChartBackground: {
        ...customBg,
        mode,
      },
    });
  }

  function handleUpdateSolidColor(solidColor: string) {
    onUpdateSettings({
      customChartBackground: {
        ...customBg,
        solidColor,
      },
    });
  }

  function handleUpdateGradientTop(gradientTop: string) {
    onUpdateSettings({
      customChartBackground: {
        ...customBg,
        gradientTop,
      },
    });
  }

  function handleUpdateGradientBottom(gradientBottom: string) {
    onUpdateSettings({
      customChartBackground: {
        ...customBg,
        gradientBottom,
      },
    });
  }

  function handleResetCustomBg() {
    onUpdateSettings({
      customChartBackground: {
        ...customBg,
        mode: 'theme',
      },
    });
  }
</script>

<div class="section-group">
  <!-- System Theme Bridge & Color Mode Selector (#148) -->
  <div class="system-bridge-section">
    <div class="presets-header-row">
      <div>
        <h4 class="section-title">Mode Warna & Sinkronisasi Sistem</h4>
        <p class="section-subtitle">
          Pilih mode warna antarmuka: ikuti skema OS host secara dinamis via System Theme Bridge, atau kunci ke Mode Gelap / Mode Terang.
        </p>
      </div>

      <!-- Segmented Control untuk colorModePreference -->
      <div class="theme-mode-filters" role="radiogroup" aria-label="Preferensi Mode Warna">
        <button
          type="button"
          class="filter-chip {colorModePref === 'system' ? 'active' : ''}"
          onclick={() => handleSetColorMode('system')}
          title="Ikuti preferensi tema sistem operasi secara otomatis"
        >
          <Monitor size={12} />
          <span>Ikuti Sistem</span>
        </button>
        <button
          type="button"
          class="filter-chip {colorModePref === 'dark' ? 'active' : ''}"
          onclick={() => handleSetColorMode('dark')}
          title="Paksa antarmuka terminal ke Mode Gelap"
        >
          <Moon size={12} />
          <span>Mode Gelap</span>
        </button>
        <button
          type="button"
          class="filter-chip {colorModePref === 'light' ? 'active' : ''}"
          onclick={() => handleSetColorMode('light')}
          title="Paksa antarmuka terminal ke Mode Terang"
        >
          <Sun size={12} />
          <span>Mode Terang</span>
        </button>
      </div>
    </div>

    <!-- Dropdowns untuk Preset Default Gelap & Terang -->
    <div class="theme-defaults-grid">
      <div class="setting-row default-preset-item">
        <div class="setting-info">
          <span class="setting-label">Preset Default Mode Gelap (activeDarkPreset)</span>
          <span class="setting-desc">Tema yang otomatis aktif saat berada di Mode Gelap</span>
        </div>
        <select
          class="select-input"
          value={settings.activeDarkPreset || 'signature'}
          onchange={(e) => handleSetDarkPreset(e.currentTarget.value)}
        >
          {#each darkPresets as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </div>

      <div class="setting-row default-preset-item">
        <div class="setting-info">
          <span class="setting-label">Preset Default Mode Terang (activeLightPreset)</span>
          <span class="setting-desc">Tema yang otomatis aktif saat berada di Mode Terang</span>
        </div>
        <select
          class="select-input"
          value={settings.activeLightPreset || 'red_folder'}
          onchange={(e) => handleSetLightPreset(e.currentTarget.value)}
        >
          {#each lightPresets as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Dual-Theme Decoupling Toggle (#149) -->
    <div class="setting-row sync-chart-row">
      <div class="setting-info">
        <span class="setting-label">Sinkronkan Tema Chart dengan Aplikasi</span>
        <span class="setting-desc">
          Saat aktif, tema kanvas chart otomatis mengikuti tema aplikasi. Nonaktifkan untuk memilih tema aplikasi dan tema chart secara terpisah.
        </span>
      </div>
      <label class="toggle-switch">
        <input
          type="checkbox"
          checked={syncChartWithAppTheme}
          onchange={(e) => {
            const checked = e.currentTarget.checked;
            onUpdateSettings({
              syncChartWithAppTheme: checked,
              ...(checked ? { chartThemePreset: settings.themePreset || 'signature' } : {}),
            });
          }}
          aria-label="Sinkronkan Tema Chart dengan Aplikasi"
        />
        <span class="slider"></span>
      </label>
    </div>

    <!-- Pemilih Independen Tema Aplikasi & Tema Chart saat Un-Synced (#149) -->
    {#if !syncChartWithAppTheme}
      <div class="decoupled-selectors-grid">
        <div class="setting-row default-preset-item">
          <div class="setting-info">
            <span class="setting-label">Tema Aplikasi (Desktop Shell)</span>
            <span class="setting-desc">Bilah header, sidebar, dock, status bar, dialog, dan Pine IDE</span>
          </div>
          <select
            class="select-input"
            value={settings.themePreset || 'signature'}
            onchange={(e) => handleSelectAppThemeDropdown(e.currentTarget.value)}
          >
            {#each allAvailablePresets as p}
              <option value={p.id}>{p.name} {p.badge ? `(${p.badge})` : ''}</option>
            {/each}
          </select>
        </div>

        <div class="setting-row default-preset-item">
          <div class="setting-info">
            <span class="setting-label">Tema Kanvas Chart (chartThemePreset)</span>
            <span class="setting-desc">Candlestick, gridline, crosshair, latar kanvas, dan watermark</span>
          </div>
          <select
            class="select-input"
            value={settings.chartThemePreset || 'signature'}
            onchange={(e) => handleSelectChartThemeDropdown(e.currentTarget.value)}
          >
            {#each allAvailablePresets as p}
              <option value={p.id}>{p.name} {p.badge ? `(${p.badge})` : ''}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="target-selection-strip">
        <span class="target-label">Target Penerapan Klik Kartu:</span>
        <div class="target-chips" role="radiogroup" aria-label="Target Penerapan Klik Kartu">
          <button
            type="button"
            class="filter-chip {targetThemeSelection === 'app' ? 'active' : ''}"
            onclick={() => (targetThemeSelection = 'app')}
          >
            Tema Aplikasi
          </button>
          <button
            type="button"
            class="filter-chip {targetThemeSelection === 'chart' ? 'active' : ''}"
            onclick={() => (targetThemeSelection = 'chart')}
          >
            Tema Kanvas Chart
          </button>
        </div>
      </div>
    {/if}
  </div>

  <div class="presets-header-row">
    <div>
      <h4 class="section-title">Preset Tema Tampilan & Candlestick</h4>
      <p class="section-subtitle">
        Pilih skema warna antarmuka dan palet candlestick. Tersedia tema gelap (Dark) dan terang (Light) dengan sinkronisasi penuh ke WebGL2 Vela & Pine IDE.
      </p>
    </div>

    <!-- Mode Filter Chips -->
    <div class="theme-mode-filters" role="radiogroup" aria-label="Filter Mode Tema">
      <button
        type="button"
        class="filter-chip {filterMode === 'all' ? 'active' : ''}"
        onclick={() => setFilterMode('all')}
      >
        <span>Semua ({allAvailablePresets.length})</span>
      </button>
      <button
        type="button"
        class="filter-chip {filterMode === 'dark' ? 'active' : ''}"
        onclick={() => setFilterMode('dark')}
      >
        <Moon size={11} />
        <span>Gelap ({darkPresets.length})</span>
      </button>
      <button
        type="button"
        class="filter-chip {filterMode === 'light' ? 'active' : ''}"
        onclick={() => setFilterMode('light')}
      >
        <Sun size={11} />
        <span>Terang ({lightPresets.length})</span>
      </button>
    </div>
  </div>

  <div class="theme-presets-grid">
    {#each filteredPresets as preset}
      {@const isSelectedApp = (settings.themePreset || 'signature') === preset.id}
      {@const isSelectedChart = (settings.chartThemePreset || 'signature') === preset.id}
      {@const isSelected = syncChartWithAppTheme ? isSelectedApp : (targetThemeSelection === 'app' ? isSelectedApp : isSelectedChart)}
      {@const isCustom = !isBuiltInTheme(preset.id)}
      <button
        type="button"
        class="theme-card {isSelected ? 'selected' : ''} {isCustom ? 'custom-theme-card' : ''}"
        onclick={() => handleSelectPreset(preset)}
      >
        <div class="theme-card-header">
          <span class="theme-name">{preset.name}</span>
          <div class="card-badges">
            {#if isCustom}
              <span class="mode-pill custom">[CUSTOM]</span>
            {/if}
            {#if preset.mode === 'light'}
              <span class="mode-pill light"><Sun size={9} /> LIGHT</span>
            {:else}
              <span class="mode-pill dark"><Moon size={9} /> DARK</span>
            {/if}
            <span class="theme-badge">{preset.badge}</span>
          </div>
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

        <div class="theme-card-footer">
          <div class="theme-status">
            {#if syncChartWithAppTheme}
              {#if isSelectedApp}
                <span class="status-active"><Check size={12} /> Sedang Digunakan</span>
              {:else}
                <span class="status-inactive">Klik untuk Terapkan</span>
              {/if}
            {:else}
              {#if isSelectedApp && isSelectedChart}
                <span class="status-active"><Check size={12} /> Aktif: Aplikasi & Chart</span>
              {:else if isSelectedApp}
                <span class="status-active"><Check size={12} /> Aktif: Tema Aplikasi</span>
              {:else if isSelectedChart}
                <span class="status-active"><Check size={12} /> Aktif: Tema Chart</span>
              {:else}
                <span class="status-inactive">Klik untuk {targetThemeSelection === 'app' ? 'Aplikasi' : 'Chart'}</span>
              {/if}
            {/if}
          </div>

          {#if isCustom}
            <div class="custom-card-actions" onclick={(e) => e.stopPropagation()}>
              <button
                type="button"
                class="btn-card-action"
                title="Ubah nama tema"
                onclick={(e) => handleOpenRename(preset.id, preset.name, e)}
              >
                <Edit2 size={11} />
              </button>
              <button
                type="button"
                class="btn-card-action"
                title="Ekspor palet sebagai teks Hex"
                onclick={(e) => handleExportUserThemeText(preset.id, preset.name, e)}
              >
                <FileText size={11} />
              </button>
              <button
                type="button"
                class="btn-card-action"
                title="Ekspor tema sebagai JSON"
                onclick={(e) => handleExportUserThemeJson(preset.id, preset.name, e)}
              >
                <Download size={11} />
              </button>
              <button
                type="button"
                class="btn-card-action btn-card-delete"
                title="Hapus tema"
                onclick={(e) => handleDeleteUserTheme(preset.id, preset.name, e)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          {/if}
        </div>
      </button>
    {/each}
  </div>

  <!-- Palet Kustom Studio (9 Dimensi - Sesuai Referensi chartthemes.com) -->
  <div class="custom-studio-box">
    <div class="custom-studio-header">
      <div class="custom-studio-info">
        <div class="studio-title-row">
          <Palette size={16} class="studio-icon" />
          <span class="custom-studio-title">Palet Kustom Studio</span>
          {#if isCustomActive}
            <span class="custom-active-badge">Custom Aktif</span>
          {:else}
            <span class="custom-theme-badge">Mengikuti Preset</span>
          {/if}
          <span class="mode-indicator {isPaletteDark ? 'dark' : 'light'}">
            {#if isPaletteDark}
              <Moon size={10} /> Mode Gelap Terdeteksi
            {:else}
              <Sun size={10} /> Mode Terang Terdeteksi
            {/if}
          </span>
        </div>
        <span class="custom-studio-desc">
          Kustomisasi 6 warna candlestick dan 3 warna umum. Perubahan langsung diaplikasikan serentak ke UI Trawangan, Pine IDE, kanvas WebGL2 Vela, dan dialog pengaturan bawaan Vela.
        </span>
      </div>

      <div class="custom-studio-actions">
        {#if copyFeedback}
          <span class="feedback-toast"><CheckCheck size={12} /> {copyFeedback}</span>
        {/if}
        <button
          type="button"
          class="btn-studio-action"
          onclick={handleCopyJson}
          title="Salin konfigurasi palet dalam format JSON ke clipboard"
        >
          <Copy size={12} />
          <span>Salin JSON</span>
        </button>
        <button
          type="button"
          class="btn-studio-action"
          onclick={handleCopyText}
          title="Salin ringkasan palet dalam format teks Hex (ala chartthemes.com)"
        >
          <FileText size={12} />
          <span>Salin Teks Hex</span>
        </button>
        <button
          type="button"
          class="btn-studio-action"
          onclick={handleOpenPaste}
          title="Tempel palet dari JSON atau teks daftar warna"
        >
          <Clipboard size={12} />
          <span>Tempel Palet</span>
        </button>
        <button
          type="button"
          class="btn-studio-action btn-save-as"
          onclick={handleOpenSaveAs}
          title="Simpan konfigurasi palet saat ini sebagai preset tema pengguna baru"
        >
          <Save size={12} />
          <span>Simpan Sebagai Tema Baru</span>
        </button>
        <button
          type="button"
          class="btn-studio-action btn-reset"
          onclick={handleResetCustomPalette}
          disabled={!isCustomActive}
          title="Kembalikan semua warna kustom ke setelan bawaan preset aktif"
        >
          <RotateCcw size={12} />
          <span>Reset ke Preset</span>
        </button>
      </div>
    </div>

    <!-- Kategori 1: Warna Candlestick -->
    <div class="studio-category">
      <div class="category-header">
        <span class="category-title">Warna Candlestick (Candle Colors)</span>
        <span class="category-sub">6 atribut lilin individual untuk kondisi Bullish dan Bearish</span>
      </div>

      <div class="studio-pickers-grid">
        <!-- Bearish Body -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bearish body</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() => handleCopySingle(currentPalette.candles.bearBody, 'Bearish body')}
              title="Salin kode hex"
            >
              <Copy size={10} />
            </button>
          </div>
          <div class="picker-bottom">
            <input
              type="color"
              class="color-chip"
              value={currentPalette.candles.bearBody}
              onchange={(e) => handleUpdateCandle('bearBody', e.currentTarget.value)}
              aria-label="Bearish body"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bearBody}
              maxlength="7"
              onchange={(e) => handleUpdateCandle('bearBody', e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bearish Wick -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bearish wick</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() => handleCopySingle(currentPalette.candles.bearWick, 'Bearish wick')}
              title="Salin kode hex"
            >
              <Copy size={10} />
            </button>
          </div>
          <div class="picker-bottom">
            <input
              type="color"
              class="color-chip"
              value={currentPalette.candles.bearWick}
              onchange={(e) => handleUpdateCandle('bearWick', e.currentTarget.value)}
              aria-label="Bearish wick"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bearWick}
              maxlength="7"
              onchange={(e) => handleUpdateCandle('bearWick', e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bearish Border -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bearish border</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() => handleCopySingle(currentPalette.candles.bearBorder, 'Bearish border')}
              title="Salin kode hex"
            >
              <Copy size={10} />
            </button>
          </div>
          <div class="picker-bottom">
            <input
              type="color"
              class="color-chip"
              value={currentPalette.candles.bearBorder}
              onchange={(e) => handleUpdateCandle('bearBorder', e.currentTarget.value)}
              aria-label="Bearish border"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bearBorder}
              maxlength="7"
              onchange={(e) => handleUpdateCandle('bearBorder', e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bullish Body -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bullish body</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() => handleCopySingle(currentPalette.candles.bullBody, 'Bullish body')}
              title="Salin kode hex"
            >
              <Copy size={10} />
            </button>
          </div>
          <div class="picker-bottom">
            <input
              type="color"
              class="color-chip"
              value={currentPalette.candles.bullBody}
              onchange={(e) => handleUpdateCandle('bullBody', e.currentTarget.value)}
              aria-label="Bullish body"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bullBody}
              maxlength="7"
              onchange={(e) => handleUpdateCandle('bullBody', e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bullish Wick -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bullish wick</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() => handleCopySingle(currentPalette.candles.bullWick, 'Bullish wick')}
              title="Salin kode hex"
            >
              <Copy size={10} />
            </button>
          </div>
          <div class="picker-bottom">
            <input
              type="color"
              class="color-chip"
              value={currentPalette.candles.bullWick}
              onchange={(e) => handleUpdateCandle('bullWick', e.currentTarget.value)}
              aria-label="Bullish wick"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bullWick}
              maxlength="7"
              onchange={(e) => handleUpdateCandle('bullWick', e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bullish Border -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bullish border</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() => handleCopySingle(currentPalette.candles.bullBorder, 'Bullish border')}
              title="Salin kode hex"
            >
              <Copy size={10} />
            </button>
          </div>
          <div class="picker-bottom">
            <input
              type="color"
              class="color-chip"
              value={currentPalette.candles.bullBorder}
              onchange={(e) => handleUpdateCandle('bullBorder', e.currentTarget.value)}
              aria-label="Bullish border"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bullBorder}
              maxlength="7"
              onchange={(e) => handleUpdateCandle('bullBorder', e.currentTarget.value)}
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Kategori 2: Warna Umum (General Colors) -->
    <div class="studio-category">
      <div class="category-header">
        <span class="category-title">Warna Umum (General Colors)</span>
        <span class="category-sub">3 atribut fondasi: latar kanvas & app, permukaan panel, dan tipografi teks</span>
      </div>

      <div class="studio-pickers-grid general-grid">
        <!-- Background Color -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Background color</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() => handleCopySingle(currentPalette.general.background, 'Background color')}
              title="Salin kode hex"
            >
              <Copy size={10} />
            </button>
          </div>
          <div class="picker-bottom">
            <input
              type="color"
              class="color-chip"
              value={currentPalette.general.background}
              onchange={(e) => handleUpdateGeneral('background', e.currentTarget.value)}
              aria-label="Background color"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.general.background}
              maxlength="7"
              onchange={(e) => handleUpdateGeneral('background', e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Foreground -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Foreground (Panel/Border)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() => handleCopySingle(currentPalette.general.foreground, 'Foreground')}
              title="Salin kode hex"
            >
              <Copy size={10} />
            </button>
          </div>
          <div class="picker-bottom">
            <input
              type="color"
              class="color-chip"
              value={currentPalette.general.foreground}
              onchange={(e) => handleUpdateGeneral('foreground', e.currentTarget.value)}
              aria-label="Foreground"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.general.foreground}
              maxlength="7"
              onchange={(e) => handleUpdateGeneral('foreground', e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Text color -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Text color (Teks & Sumbu)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() => handleCopySingle(currentPalette.general.textColor, 'Text color')}
              title="Salin kode hex"
            >
              <Copy size={10} />
            </button>
          </div>
          <div class="picker-bottom">
            <input
              type="color"
              class="color-chip"
              value={currentPalette.general.textColor}
              onchange={(e) => handleUpdateGeneral('textColor', e.currentTarget.value)}
              aria-label="Text color"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.general.textColor}
              maxlength="7"
              onchange={(e) => handleUpdateGeneral('textColor', e.currentTarget.value)}
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal Dialog Tempel Palet -->
  {#if isPasteModalOpen}
    <div class="studio-modal-scrim" onclick={() => (isPasteModalOpen = false)} role="presentation">
      <div class="studio-modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="modal-title-row">
            <Clipboard size={16} />
            <span class="modal-title">Tempel Palet Tema</span>
          </div>
          <button type="button" class="btn-modal-close" onclick={() => (isPasteModalOpen = false)}>
            <X size={14} />
          </button>
        </div>

        <p class="modal-desc">
          Tempelkan konfigurasi JSON atau format teks daftar warna (seperti salinan dari situs tema atau format chartthemes.com):
        </p>

        <textarea
          class="paste-textarea mono-nums"
          bind:value={pasteInputText}
          placeholder={`Contoh teks:\nBearish body: #9B1D20\nBearish wick: #7F4F4F\nBullish body: #D4A5A5\nBackground color: #edede9\nText color: #4A0E0F`}
          rows="8"
        ></textarea>

        {#if pasteError}
          <div class="paste-error-msg">{pasteError}</div>
        {/if}

        <div class="modal-footer">
          <button type="button" class="btn-cancel" onclick={() => (isPasteModalOpen = false)}>
            Batal
          </button>
          <button type="button" class="btn-apply-paste" onclick={handleApplyPaste}>
            Terapkan Palet
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal Dialog Simpan Sebagai Tema Baru (Save As) (#149) -->
  {#if isSaveAsModalOpen}
    <div class="studio-modal-scrim" onclick={() => (isSaveAsModalOpen = false)} role="presentation">
      <div class="studio-modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="modal-title-row">
            <Save size={16} />
            <span class="modal-title">Simpan Sebagai Tema Baru (Save As)</span>
          </div>
          <button type="button" class="btn-modal-close" onclick={() => (isSaveAsModalOpen = false)}>
            <X size={14} />
          </button>
        </div>

        <p class="modal-desc">
          Simpan palet 9 dimensi saat ini ke dalam koleksi tema pengguna personal. Tema ini akan tersimpan berdampingan dengan preset resmi dan dapat diterapkan secara mandiri ke antarmuka aplikasi atau grafik chart.
        </p>

        <div class="modal-form-group">
          <label class="modal-label" for="saveAsThemeName">Nama Preset Tema</label>
          <input
            id="saveAsThemeName"
            type="text"
            class="modal-input"
            placeholder="Contoh: Cyberpunk Neon, Coffee Paper"
            bind:value={saveAsThemeName}
            onkeydown={(e) => e.key === 'Enter' && handleConfirmSaveAs()}
            autofocus
          />
        </div>

        <div class="modal-form-group">
          <span class="modal-label">Kategori Mode Warna</span>
          <div class="modal-mode-options" role="radiogroup" aria-label="Mode Tema">
            <button
              type="button"
              class="filter-chip {saveAsThemeMode === 'dark' ? 'active' : ''}"
              onclick={() => (saveAsThemeMode = 'dark')}
            >
              <Moon size={11} />
              <span>Mode Gelap (Dark)</span>
            </button>
            <button
              type="button"
              class="filter-chip {saveAsThemeMode === 'light' ? 'active' : ''}"
              onclick={() => (saveAsThemeMode = 'light')}
            >
              <Sun size={11} />
              <span>Mode Terang (Light)</span>
            </button>
          </div>
        </div>

        {#if saveAsError}
          <div class="paste-error-msg">{saveAsError}</div>
        {/if}

        <div class="modal-footer">
          <button type="button" class="btn-cancel" onclick={() => (isSaveAsModalOpen = false)}>
            Batal
          </button>
          <button type="button" class="btn-apply-paste" onclick={handleConfirmSaveAs}>
            Simpan Tema
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal Dialog Ubah Nama Tema Pengguna (#149) -->
  {#if isRenameModalOpen}
    <div class="studio-modal-scrim" onclick={() => (isRenameModalOpen = false)} role="presentation">
      <div class="studio-modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="modal-title-row">
            <Edit2 size={16} />
            <span class="modal-title">Ubah Nama Tema Preset</span>
          </div>
          <button type="button" class="btn-modal-close" onclick={() => (isRenameModalOpen = false)}>
            <X size={14} />
          </button>
        </div>

        <div class="modal-form-group">
          <label class="modal-label" for="renameThemeName">Nama Baru</label>
          <input
            id="renameThemeName"
            type="text"
            class="modal-input"
            bind:value={renameThemeName}
            onkeydown={(e) => e.key === 'Enter' && handleConfirmRename()}
            autofocus
          />
        </div>

        {#if renameError}
          <div class="paste-error-msg">{renameError}</div>
        {/if}

        <div class="modal-footer">
          <button type="button" class="btn-cancel" onclick={() => (isRenameModalOpen = false)}>
            Batal
          </button>
          <button type="button" class="btn-apply-paste" onclick={handleConfirmRename}>
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Kustomisasi Latar Belakang Grafik (Solid & Vertical Gradient) (#128) -->
  <div class="custom-candle-box custom-bg-box">
    <div class="custom-candle-header">
      <div class="custom-candle-info">
        <span class="custom-candle-title">Latar Belakang Grafik</span>
        <span class="custom-candle-desc">
          Sesuaikan latar kanvas grafik dengan warna solid atau gradien vertikal kustom tanpa mengubah elemen tema lainnya.
        </span>
      </div>
      <div class="custom-candle-actions">
        {#if isCustomBgActive}
          <span class="custom-active-badge">Custom Aktif</span>
        {:else}
          <span class="custom-theme-badge">Mengikuti Tema</span>
        {/if}
        <button
          type="button"
          class="btn-reset-candle"
          onclick={handleResetCustomBg}
          disabled={!isCustomBgActive}
          title="Kembalikan latar belakang grafik ke setelan bawaan tema aktif"
        >
          <RotateCcw size={12} />
          <span>Reset ke Bawaan Tema</span>
        </button>
      </div>
    </div>

    <!-- Mode Selector Chips / Radio Buttons -->
    <div class="bg-mode-chips" role="radiogroup" aria-label="Mode Latar Belakang Grafik">
      <button
        type="button"
        class="bg-mode-chip {bgMode === 'theme' ? 'active' : ''}"
        role="radio"
        aria-checked={bgMode === 'theme'}
        onclick={() => handleSetBgMode('theme')}
      >
        <span>Bawaan Tema</span>
      </button>
      <button
        type="button"
        class="bg-mode-chip {bgMode === 'solid' ? 'active' : ''}"
        role="radio"
        aria-checked={bgMode === 'solid'}
        onclick={() => handleSetBgMode('solid')}
      >
        <span>Warna Solid</span>
      </button>
      <button
        type="button"
        class="bg-mode-chip {bgMode === 'gradient' ? 'active' : ''}"
        role="radio"
        aria-checked={bgMode === 'gradient'}
        onclick={() => handleSetBgMode('gradient')}
      >
        <span>Gradien Vertikal</span>
      </button>
    </div>

    {#if bgMode === 'solid'}
      <div class="custom-candle-inputs">
        <div class="candle-picker-card">
          <div class="picker-label-row">
            <span class="picker-title">Warna Latar Solid</span>
            <span class="picker-current-hex mono-nums">{solidColorVal}</span>
          </div>
          <div class="picker-controls">
            <input
              type="color"
              class="color-input"
              value={solidColorVal}
              onchange={(e) => handleUpdateSolidColor(e.currentTarget.value)}
              aria-label="Warna Latar Solid"
            />
            <input
              type="text"
              class="hex-text-input mono-nums"
              value={solidColorVal}
              maxlength="7"
              onchange={(e) => {
                let val = e.currentTarget.value.trim();
                if (!val.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(val)) {
                  val = '#' + val;
                }
                if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
                  handleUpdateSolidColor(val);
                }
              }}
            />
          </div>
        </div>
      </div>
    {:else if bgMode === 'gradient'}
      <div class="gradient-config-container">
        <!-- Live Preview Strip -->
        <div class="gradient-preview-wrap">
          <span class="preview-strip-label">Pratinjau Gradien Vertikal</span>
          <div
            class="gradient-live-strip"
            style="background: linear-gradient(180deg, {gradientTopVal}, {gradientBottomVal});"
            title="Pratinjau Gradien Vertikal: {gradientTopVal} -> {gradientBottomVal}"
          ></div>
        </div>

        <div class="custom-candle-inputs">
          <!-- Gradient Top Picker -->
          <div class="candle-picker-card">
            <div class="picker-label-row">
              <span class="picker-title">Warna Atas (Top)</span>
              <span class="picker-current-hex mono-nums">{gradientTopVal}</span>
            </div>
            <div class="picker-controls">
              <input
                type="color"
                class="color-input"
                value={gradientTopVal}
                onchange={(e) => handleUpdateGradientTop(e.currentTarget.value)}
                aria-label="Warna Atas Gradien"
              />
              <input
                type="text"
                class="hex-text-input mono-nums"
                value={gradientTopVal}
                maxlength="7"
                onchange={(e) => {
                  let val = e.currentTarget.value.trim();
                  if (!val.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(val)) {
                    val = '#' + val;
                  }
                  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
                    handleUpdateGradientTop(val);
                  }
                }}
              />
            </div>
          </div>

          <!-- Gradient Bottom Picker -->
          <div class="candle-picker-card">
            <div class="picker-label-row">
              <span class="picker-title">Warna Bawah (Bottom)</span>
              <span class="picker-current-hex mono-nums">{gradientBottomVal}</span>
            </div>
            <div class="picker-controls">
              <input
                type="color"
                class="color-input"
                value={gradientBottomVal}
                onchange={(e) => handleUpdateGradientBottom(e.currentTarget.value)}
                aria-label="Warna Bawah Gradien"
              />
              <input
                type="text"
                class="hex-text-input mono-nums"
                value={gradientBottomVal}
                maxlength="7"
                onchange={(e) => {
                  let val = e.currentTarget.value.trim();
                  if (!val.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(val)) {
                    val = '#' + val;
                  }
                  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
                    handleUpdateGradientBottom(val);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    {/if}
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

  /* System Theme Bridge & Color Mode Switcher (#148) */
  .system-bridge-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border-hairline);
  }

  .theme-defaults-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
  }

  .default-preset-item {
    background: var(--bg-surface);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-hairline);
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

  /* Header Preset dengan Filter */
  .presets-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }

  .theme-mode-filters {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-surface);
    padding: 3px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-hairline);
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    color: var(--text-main);
  }

  .filter-chip.active {
    background: var(--bg-elevated);
    color: var(--brand-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .card-badges {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mode-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 8.5px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: var(--radius-xs);
  }

  .mode-pill.light {
    background: rgba(234, 179, 8, 0.14);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }

  .mode-pill.dark {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.25);
  }

  .mode-pill.custom {
    background: rgba(255, 105, 180, 0.15);
    color: #ff69b4;
    border: 1px solid rgba(255, 105, 180, 0.35);
  }

  .theme-badge.custom-badge {
    background: rgba(255, 105, 180, 0.15);
    color: #ff69b4;
    border: 1px solid rgba(255, 105, 180, 0.35);
  }

  .theme-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 6px;
    border-top: 1px solid var(--border-hairline);
    width: 100%;
  }

  .custom-card-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  .btn-card-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    border-radius: var(--radius-xs);
    width: 22px;
    height: 22px;
    padding: 0;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .btn-card-action:hover {
    color: var(--text-main);
    border-color: var(--brand-primary);
  }

  .btn-card-action.btn-card-delete:hover {
    color: #ef4444;
    border-color: #ef4444;
  }

  .sync-chart-row {
    padding: 10px 0;
    border-top: 1px solid var(--border-hairline);
    margin-top: 8px;
  }

  .decoupled-selectors-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 8px;
    padding: 10px 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
  }

  .target-selection-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding: 6px 10px;
    background: var(--bg-darkest);
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-xs);
  }

  .target-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .target-chips {
    display: flex;
    gap: 6px;
  }

  /* Toggle Switch */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    cursor: pointer;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-elevated, #242424);
    border: 1px solid var(--border-subtle, #333);
    transition: 0.2s;
    border-radius: 20px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 2px;
    bottom: 2px;
    background-color: var(--text-muted, #a3a3a3);
    transition: 0.2s;
    border-radius: 50%;
  }

  .toggle-switch input:checked + .slider {
    background-color: rgba(255, 105, 180, 0.2);
    border-color: #ff69b4;
  }

  .toggle-switch input:checked + .slider:before {
    transform: translateX(16px);
    background-color: #ff69b4;
  }

  /* Form controls for modals */
  .modal-form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .modal-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .modal-input {
    width: 100%;
    background: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 12px;
    padding: 7px 10px;
    border-radius: 4px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .modal-input:focus {
    border-color: var(--brand-primary);
  }

  .modal-mode-options {
    display: flex;
    gap: 8px;
  }

  /* Palet Kustom Studio */
  .custom-studio-box {
    margin-top: 14px;
    padding: 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  }

  .custom-studio-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border-hairline);
    padding-bottom: 14px;
  }

  .custom-studio-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 600px;
  }

  .studio-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .studio-title-row :global(.studio-icon) {
    color: var(--brand-primary);
  }

  .custom-studio-title {
    font-size: 13px;
    font-weight: 800;
    color: var(--text-main);
    letter-spacing: 0.02em;
  }

  .mode-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
  }

  .mode-indicator.dark {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
  }

  .mode-indicator.light {
    background: rgba(234, 179, 8, 0.14);
    color: #ca8a04;
  }

  .custom-studio-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.45;
  }

  .custom-studio-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .feedback-toast {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    font-weight: 700;
    color: #10b981;
    background: rgba(16, 185, 129, 0.12);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .btn-studio-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-studio-action:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--border-bright);
    color: var(--text-primary);
  }

  .btn-studio-action:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-studio-action.btn-reset:hover:not(:disabled) {
    color: var(--bear-color);
  }

  /* Kategori */
  .studio-category {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .category-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .category-title {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-main);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .category-sub {
    font-size: 10.5px;
    color: var(--text-muted);
  }

  .studio-pickers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 10px;
  }

  .general-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }

  .studio-picker-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
    border-radius: 6px;
    transition: border-color 0.15s ease;
  }

  .studio-picker-card:hover {
    border-color: var(--border-bright);
  }

  .picker-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .picker-name {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .btn-mini-copy {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px;
    display: inline-flex;
    align-items: center;
    border-radius: 3px;
    transition: all 0.15s ease;
  }

  .btn-mini-copy:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }

  .picker-bottom {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-chip {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    width: 32px;
    height: 26px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
    flex-shrink: 0;
  }

  .color-chip::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-chip::-webkit-color-swatch {
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
  }

  .hex-box {
    flex: 1;
    background: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .hex-box:focus {
    border-color: var(--brand-primary);
  }

  /* Modal Tempel Palet */
  .studio-modal-scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .studio-modal-card {
    background: var(--bg-panel);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    width: 100%;
    max-width: 520px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
  }

  .btn-modal-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .btn-modal-close:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }

  .modal-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
    margin: 0;
  }

  .paste-textarea {
    width: 100%;
    background: var(--bg-darkest);
    border: 1px solid var(--border-hairline);
    border-radius: 6px;
    color: var(--text-main);
    font-size: 11px;
    padding: 10px;
    outline: none;
    resize: vertical;
    font-family: var(--font-code);
  }

  .paste-textarea:focus {
    border-color: var(--brand-primary);
  }

  .paste-error-msg {
    font-size: 10.5px;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .btn-cancel {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: 5px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-cancel:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }

  .btn-apply-paste {
    padding: 6px 14px;
    background: var(--brand-primary);
    border: none;
    border-radius: 5px;
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-apply-paste:hover {
    filter: brightness(1.1);
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

  .bg-mode-chips {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .bg-mode-chip {
    padding: 6px 12px;
    background: var(--bg-elevated, #1a1a1a);
    border: 1px solid var(--border-subtle, #282828);
    border-radius: 6px;
    color: var(--text-muted, #a3a3a3);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .bg-mode-chip:hover {
    color: var(--text-main, #ffffff);
    border-color: var(--border-hover, #444444);
  }

  .bg-mode-chip.active {
    background: rgba(255, 105, 180, 0.12);
    border-color: var(--brand-primary, #ff69b4);
    color: var(--brand-primary, #ff69b4);
    font-weight: 700;
  }

  .gradient-config-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gradient-preview-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-strip-label {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted, #888888);
  }

  .gradient-live-strip {
    height: 32px;
    width: 100%;
    border-radius: 6px;
    border: 1px solid var(--border-subtle, #333333);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
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
