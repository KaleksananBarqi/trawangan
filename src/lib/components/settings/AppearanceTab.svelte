<script lang="ts">
  import {
    Check,
    RotateCcw,
    Copy,
    CheckCheck,
    Sun,
    Moon,
    Palette,
    FileText,
    Clipboard,
    X,
    Monitor,
    Save,
    Trash2,
    Edit2,
    Download,
    Link2,
    Unlink,
    Sparkles,
    BarChart2,
    Sliders,
    ChevronDown,
    ChevronUp,
  } from "@lucide/svelte";
  import {
    THEME_PRESETS,
    buildCustomPaletteFromPreset,
    parseCustomPaletteFromText,
    serializeCustomPaletteJson,
    serializeCustomPaletteText,
    createUserTheme,
    renameUserTheme,
    deleteUserTheme,
    updateUserThemePalette,
    resolveDeletedThemeFallback,
    resolveThemeConfig,
    buildThemeConfigFromUserTheme,
    isBuiltInTheme,
  } from "../../constants/themes";
  import { isDarkColor } from "../../utils/colorUtils";
  import type {
    AppSettings,
    ColorModePreference,
    CustomChartBackgroundConfig,
    CustomThemePalette,
    CustomCandleColors,
    CustomGeneralColors,
    CustomThemeDefinition,
    ThemePresetId,
  } from "../../types/market";

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  }

  let { settings, onUpdateSettings }: Props = $props();

  const filterMode = $derived<"all" | "dark" | "light">(
    settings.themeFilterMode || "all",
  );
  let copyFeedback = $state<string | null>(null);
  let isPasteModalOpen = $state(false);
  let pasteInputText = $state("");
  let pasteError = $state<string | null>(null);
  let showAdvancedModeDefaults = $state(false);

  // Dual-Theme Decoupling & User Presets State (#149)
  const syncChartWithAppTheme = $derived<boolean>(
    settings.syncChartWithAppTheme ?? true,
  );
  const savedUserThemes = $derived<CustomThemeDefinition[]>(
    settings.savedUserThemes || [],
  );
  let targetThemeSelection = $state<"app" | "chart">("app");

  // Modal Save As ("Simpan Sebagai Tema Baru")
  let isSaveAsModalOpen = $state(false);
  let saveAsThemeName = $state("");
  let saveAsThemeMode = $state<"dark" | "light">("dark");
  let saveAsError = $state<string | null>(null);

  // Modal Rename Preset Pengguna
  let isRenameModalOpen = $state(false);
  let renameTargetThemeId = $state<string | null>(null);
  let renameThemeName = $state("");
  let renameError = $state<string | null>(null);

  // In-Place Theme Palette Editing State (#158, #162)
  let editingUserThemeId = $state<string | null>(null);
  let editingUserThemeName = $state<string | null>(null);

  // Koleksi seluruh preset yang tersedia (Preset Resmi Bawaan + Preset Pengguna Tersimpan) (#149)
  const allAvailablePresets = $derived.by(() => {
    const builtIns = Object.values(THEME_PRESETS);
    const customPresets = savedUserThemes.map((u) =>
      buildThemeConfigFromUserTheme(u),
    );
    return [...builtIns, ...customPresets];
  });

  const darkPresets = $derived(
    allAvailablePresets.filter((p) => p.mode === "dark"),
  );
  const lightPresets = $derived(
    allAvailablePresets.filter((p) => p.mode === "light"),
  );

  const filteredPresets = $derived.by(() => {
    if (filterMode === "dark") return darkPresets;
    if (filterMode === "light") return lightPresets;
    return allAvailablePresets;
  });

  const colorModePref = $derived<ColorModePreference>(
    settings.colorModePreference || "system",
  );

  const activeAppPresetConfig = $derived(
    resolveThemeConfig(settings.themePreset || "signature", savedUserThemes),
  );
  const activeChartPresetConfig = $derived(
    resolveThemeConfig(
      syncChartWithAppTheme
        ? settings.themePreset || "signature"
        : settings.chartThemePreset || "signature",
      savedUserThemes,
    ),
  );

  const activePreset = $derived(
    targetThemeSelection === "chart" && !syncChartWithAppTheme
      ? activeChartPresetConfig
      : activeAppPresetConfig,
  );

  const defaultPalette = $derived<CustomThemePalette>(
    buildCustomPaletteFromPreset(
      (targetThemeSelection === "chart" && !syncChartWithAppTheme
        ? settings.chartThemePreset || "signature"
        : settings.themePreset || "signature") as ThemePresetId,
      savedUserThemes,
    ),
  );
  const currentPalette = $derived<CustomThemePalette>(
    settings.customPalette || defaultPalette,
  );
  const isCustomActive = $derived(
    Boolean(settings.customPalette && settings.customPalette.enabled !== false),
  );
  const isPaletteDark = $derived(
    isDarkColor(
      currentPalette.general?.background ||
        activePreset.chart.background ||
        "#0F0F0F",
    ),
  );

  function showToast(msg: string) {
    copyFeedback = msg;
    setTimeout(() => {
      copyFeedback = null;
    }, 2600);
  }

  function handleStartEditThemeColors(preset: any, e?: MouseEvent) {
    e?.stopPropagation();
    const isUser = savedUserThemes.some((t) => t.id === preset.id);
    let targetPalette: CustomThemePalette;

    if (isUser) {
      const userTheme = savedUserThemes.find((t) => t.id === preset.id);
      targetPalette = userTheme?.palette
        ? JSON.parse(JSON.stringify(userTheme.palette))
        : buildCustomPaletteFromPreset(preset.id as any, savedUserThemes);
      editingUserThemeId = preset.id;
      editingUserThemeName = preset.name;
    } else {
      targetPalette = buildCustomPaletteFromPreset(
        preset.id as any,
        savedUserThemes,
      );
      editingUserThemeId = null;
      editingUserThemeName = null;
    }

    targetPalette.enabled = true;
    onUpdateSettings({ customPalette: targetPalette });

    if (typeof document !== "undefined") {
      const studioBox = document.querySelector(".custom-studio-box");
      studioBox?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleSaveInPlaceThemeColors() {
    if (!editingUserThemeId) return;
    const targetId = editingUserThemeId;
    const targetName = editingUserThemeName || "Tema";

    const updatedThemes = updateUserThemePalette(
      savedUserThemes,
      targetId,
      currentPalette,
      isPaletteDark ? "dark" : "light",
    );

    onUpdateSettings({
      savedUserThemes: updatedThemes,
      customPalette: undefined,
    });

    showToast(`Warna tema "${targetName}" berhasil diperbarui!`);
    editingUserThemeId = null;
    editingUserThemeName = null;
  }

  function handleCancelEditThemeColors() {
    editingUserThemeId = null;
    editingUserThemeName = null;
  }

  function setFilterMode(mode: "all" | "dark" | "light") {
    onUpdateSettings({ themeFilterMode: mode });
  }

  function handleSetColorMode(mode: ColorModePreference) {
    const darkPreset = (settings.activeDarkPreset as any) || "signature";
    const lightPreset = (settings.activeLightPreset as any) || "red_folder";
    const resolvedTarget =
      mode === "dark"
        ? darkPreset
        : mode === "light"
          ? lightPreset
          : settings.themePreset || darkPreset;

    onUpdateSettings({
      colorModePreference: mode,
      ...(mode === "dark" ? { themePreset: darkPreset, theme: darkPreset } : {}),
      ...(mode === "light"
        ? { themePreset: lightPreset, theme: lightPreset }
        : {}),
      ...(syncChartWithAppTheme ? { chartThemePreset: resolvedTarget } : {}),
      // Bersihkan sisa override palet kustom agar preset mode yang dipilih
      // benar-benar mengendalikan tampilan UI (mencegah layar putih akibat sisa palet lama).
      customPalette: undefined,
      customBullColor: undefined,
      customBearColor: undefined,
    });
  }

  function handleSetDarkPreset(presetId: string) {
    onUpdateSettings({
      activeDarkPreset: presetId,
      ...(colorModePref === "dark"
        ? { themePreset: presetId as any, theme: presetId as any }
        : {}),
      ...(syncChartWithAppTheme && colorModePref === "dark"
        ? { chartThemePreset: presetId as any }
        : {}),
      customPalette: undefined,
    });
  }

  function handleSetLightPreset(presetId: string) {
    onUpdateSettings({
      activeLightPreset: presetId,
      ...(colorModePref === "light"
        ? { themePreset: presetId as any, theme: presetId as any }
        : {}),
      ...(syncChartWithAppTheme && colorModePref === "light"
        ? { chartThemePreset: presetId as any }
        : {}),
      customPalette: undefined,
    });
  }

  function handleSelectChartPreset(preset: {
    id: string;
    mode: "dark" | "light";
  }) {
    onUpdateSettings({
      chartThemePreset: preset.id,
      customPalette: undefined,
      customBullColor: undefined,
      customBearColor: undefined,
    });
  }

  function handleSelectAppPreset(preset: {
    id: string;
    mode: "dark" | "light";
  }) {
    onUpdateSettings({
      themePreset: preset.id,
      theme: preset.id as any,
      colorModePreference: preset.mode,
      ...(preset.mode === "dark"
        ? { activeDarkPreset: preset.id }
        : { activeLightPreset: preset.id }),
      ...(syncChartWithAppTheme ? { chartThemePreset: preset.id } : {}),
      customPalette: undefined,
      customBullColor: undefined,
      customBearColor: undefined,
    });
  }

  function handleSelectBothPreset(preset: {
    id: string;
    mode: "dark" | "light";
  }) {
    onUpdateSettings({
      themePreset: preset.id,
      chartThemePreset: preset.id,
      theme: preset.id as any,
      colorModePreference: preset.mode,
      ...(preset.mode === "dark"
        ? { activeDarkPreset: preset.id }
        : { activeLightPreset: preset.id }),
      customPalette: undefined,
      customBullColor: undefined,
      customBearColor: undefined,
    });
  }

  function handleSelectAppThemeDropdown(selectedId: string) {
    const target = allAvailablePresets.find((p) => p.id === selectedId);
    const mode = target?.mode || "dark";
    handleSelectAppPreset({ id: selectedId, mode });
  }

  function handleSelectChartThemeDropdown(selectedId: string) {
    const target = allAvailablePresets.find((p) => p.id === selectedId);
    const mode = target?.mode || "dark";
    handleSelectChartPreset({ id: selectedId, mode });
  }

  function handleSelectPreset(preset: { id: string; mode: "dark" | "light" }) {
    if (syncChartWithAppTheme) {
      handleSelectBothPreset(preset);
    } else {
      if (targetThemeSelection === "app") {
        onUpdateSettings({
          themePreset: preset.id,
          theme: preset.id as any,
          colorModePreference: preset.mode,
          ...(preset.mode === "dark"
            ? { activeDarkPreset: preset.id }
            : { activeLightPreset: preset.id }),
          customPalette: undefined,
        });
      } else {
        handleSelectChartPreset(preset);
      }
    }
  }

  function handleToggleSyncChart(checked: boolean) {
    onUpdateSettings({
      syncChartWithAppTheme: checked,
      ...(checked
        ? { chartThemePreset: settings.themePreset || "signature" }
        : {}),
      customPalette: undefined,
    });
    if (checked) {
      targetThemeSelection = "app";
    }
  }

  function handleOpenSaveAs() {
    saveAsThemeName = "";
    saveAsThemeMode = isPaletteDark ? "dark" : "light";
    saveAsError = null;
    isSaveAsModalOpen = true;
  }

  function handleConfirmSaveAs() {
    const cleanName = saveAsThemeName.trim();
    if (!cleanName) {
      saveAsError = "Nama tema tidak boleh kosong.";
      return;
    }

    const lowerName = cleanName.toLowerCase();
    const isBuiltInDuplicate = Object.values(THEME_PRESETS).some(
      (p) =>
        p.name.trim().toLowerCase() === lowerName ||
        p.id.toLowerCase() === lowerName,
    );
    const isUserDuplicate = savedUserThemes.some(
      (t) => t.name.trim().toLowerCase() === lowerName,
    );

    if (isBuiltInDuplicate || isUserDuplicate) {
      saveAsError = "Nama tema sudah digunakan, gunakan nama lain.";
      return;
    }

    const newTheme = createUserTheme(
      cleanName,
      saveAsThemeMode,
      currentPalette,
    );
    const updatedList = [...savedUserThemes, newTheme];

    if (syncChartWithAppTheme) {
      onUpdateSettings({
        savedUserThemes: updatedList,
        themePreset: newTheme.id,
        chartThemePreset: newTheme.id,
        colorModePreference: saveAsThemeMode,
        ...(saveAsThemeMode === "dark"
          ? { activeDarkPreset: newTheme.id }
          : { activeLightPreset: newTheme.id }),
        customPalette: undefined,
      });
    } else if (targetThemeSelection === "chart") {
      onUpdateSettings({
        savedUserThemes: updatedList,
        chartThemePreset: newTheme.id,
        customPalette: undefined,
      });
    } else {
      onUpdateSettings({
        savedUserThemes: updatedList,
        themePreset: newTheme.id,
        colorModePreference: saveAsThemeMode,
        ...(saveAsThemeMode === "dark"
          ? { activeDarkPreset: newTheme.id }
          : { activeLightPreset: newTheme.id }),
        customPalette: undefined,
      });
    }

    isSaveAsModalOpen = false;
    saveAsThemeName = "";
    saveAsError = null;
    showToast(`Tema "${newTheme.name}" berhasil disimpan!`);
  }

  function handleOpenRename(
    themeId: string,
    currentName: string,
    e: MouseEvent,
  ) {
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
      renameError = "Nama tema tidak boleh kosong.";
      return;
    }

    const lowerName = cleanName.toLowerCase();
    const isBuiltInDuplicate = Object.values(THEME_PRESETS).some(
      (p) =>
        p.name.trim().toLowerCase() === lowerName ||
        p.id.toLowerCase() === lowerName,
    );
    const isUserDuplicate = savedUserThemes.some(
      (t) =>
        t.id !== renameTargetThemeId &&
        t.name.trim().toLowerCase() === lowerName,
    );

    if (isBuiltInDuplicate || isUserDuplicate) {
      renameError = "Nama tema sudah digunakan, gunakan nama lain.";
      return;
    }

    try {
      const updatedList = renameUserTheme(
        savedUserThemes,
        renameTargetThemeId,
        cleanName,
      );
      onUpdateSettings({ savedUserThemes: updatedList });
      isRenameModalOpen = false;
      renameTargetThemeId = null;
      renameThemeName = "";
      showToast(`Nama tema diperbarui menjadi "${cleanName}"!`);
    } catch (err: any) {
      renameError = err?.message || "Gagal mengubah nama tema.";
    }
  }

  function handleDeleteUserTheme(
    themeId: string,
    themeName: string,
    e: MouseEvent,
  ) {
    e.stopPropagation();
    try {
      const updatedList = deleteUserTheme(savedUserThemes, themeId);
      const fallbackApp = resolveDeletedThemeFallback(
        themeId,
        settings.themePreset,
        "signature",
      );
      const fallbackChart = resolveDeletedThemeFallback(
        themeId,
        settings.chartThemePreset,
        "signature",
      );

      onUpdateSettings({
        savedUserThemes: updatedList,
        themePreset: fallbackApp,
        chartThemePreset: fallbackChart,
      });
      showToast(`Tema "${themeName}" berhasil dihapus.`);
    } catch (err: any) {
      showToast(`Gagal menghapus: ${err?.message || "Error"}`);
    }
  }

  async function handleExportUserThemeText(
    themeId: string,
    themeName: string,
    e: MouseEvent,
  ) {
    e.stopPropagation();
    const userTheme = savedUserThemes.find((t) => t.id === themeId);
    if (!userTheme) return;
    try {
      await navigator.clipboard.writeText(
        serializeCustomPaletteText(userTheme.palette),
      );
      showToast(`Palet teks "${themeName}" disalin ke clipboard!`);
    } catch (_) {}
  }

  async function handleExportUserThemeJson(
    themeId: string,
    themeName: string,
    e: MouseEvent,
  ) {
    e.stopPropagation();
    const userTheme = savedUserThemes.find((t) => t.id === themeId);
    if (!userTheme) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(userTheme, null, 2));
      showToast(`Tema "${themeName}" disalin ke clipboard sebagai JSON!`);
    } catch (_) {}
  }

  function sanitizeHex(val: string): string | null {
    let v = val.trim();
    if (!v.startsWith("#") && /^[0-9A-Fa-f]{3,8}$/.test(v)) {
      v = "#" + v;
    }
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(v)) {
      return v;
    }
    return null;
  }

  function handleUpdatePaletteColor<T extends "candles" | "general">(
    section: T,
    key: T extends "candles"
      ? keyof CustomCandleColors
      : keyof CustomGeneralColors,
    val: string,
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
    handleUpdatePaletteColor("candles", key, val);
  const handleUpdateGeneral = (key: keyof CustomGeneralColors, val: string) =>
    handleUpdatePaletteColor("general", key, val);

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(
        serializeCustomPaletteJson(currentPalette),
      );
      showToast("JSON palet berhasil disalin!");
    } catch (_) {}
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(
        serializeCustomPaletteText(currentPalette),
      );
      showToast("Format teks Hex berhasil disalin!");
    } catch (_) {}
  }

  async function handleCopySingle(hex: string, label: string) {
    try {
      await navigator.clipboard.writeText(hex);
      showToast(`${label} (${hex}) disalin!`);
    } catch (_) {}
  }

  function handleOpenPaste() {
    pasteInputText = "";
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
      pasteInputText = "";
      pasteError = null;
      showToast("Palet kustom berhasil diterapkan!");
    } else {
      pasteError =
        'Format tidak dapat dikenali. Tempel JSON atau teks baris (misal: "Bullish body: #D4A5A5").';
    }
  }

  function handleResetCustomPalette() {
    onUpdateSettings({
      customPalette: undefined,
      customBullColor: undefined,
      customBearColor: undefined,
    });
    editingUserThemeId = null;
    editingUserThemeName = null;
  }

  // Kustomisasi latar belakang grafik (solid & vertikal gradient) (#128)
  const customBg = $derived<CustomChartBackgroundConfig>(
    settings.customChartBackground || {
      mode: "theme",
      solidColor: "#0F0F0F",
      gradientTop: "#0F0F0F",
      gradientBottom: "#181A20",
    },
  );
  const bgMode = $derived(customBg.mode || "theme");
  const solidColorVal = $derived(
    customBg.solidColor || activeChartPresetConfig.chart.background || "#0F0F0F",
  );
  const gradientTopVal = $derived(
    customBg.gradientTop || activeChartPresetConfig.chart.background || "#0F0F0F",
  );
  const gradientBottomVal = $derived(customBg.gradientBottom || "#181A20");
  const isCustomBgActive = $derived(bgMode !== "theme");

  function handleSetBgMode(mode: "theme" | "solid" | "gradient") {
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
        mode: "theme",
      },
    });
  }
</script>

{#snippet themePresetOptions()}
  <optgroup label="Tema Gelap (Dark)">
    {#each darkPresets as p}
      <option value={p.id}>{p.name} {p.badge ? `(${p.badge})` : ""}</option>
    {/each}
  </optgroup>
  <optgroup label="Tema Terang (Light)">
    {#each lightPresets as p}
      <option value={p.id}>{p.name} {p.badge ? `(${p.badge})` : ""}</option>
    {/each}
  </optgroup>
{/snippet}

<div class="section-group">
  <!-- ═════════════════════════════════════════════════════════════════════════ -->
  <!-- BAGIAN 1: PUSAT KENDALI TEMA APLIKASI VS TEMA KANVAS CHART (DUAL HUB)     -->
  <!-- ═════════════════════════════════════════════════════════════════════════ -->
  <div class="theme-hub-box">
    <!-- Baris Atas: Mode Warna Cepat + Toggle Sinkronisasi -->
    <div class="hub-top-bar">
      <div class="hub-mode-group">
        <span class="hub-group-label">Mode Tampilan:</span>
        <div
          class="theme-mode-filters"
          role="radiogroup"
          aria-label="Preferensi Mode Warna"
        >
          <button
            type="button"
            class="filter-chip {colorModePref === 'system' ? 'active' : ''}"
            onclick={() => handleSetColorMode("system")}
            title="Ikuti tema sistem operasi secara otomatis"
          >
            <Monitor size={12} />
            <span>Ikuti Sistem</span>
          </button>
          <button
            type="button"
            class="filter-chip {colorModePref === 'dark' ? 'active' : ''}"
            onclick={() => handleSetColorMode("dark")}
            title="Gunakan Mode Gelap"
          >
            <Moon size={12} />
            <span>Mode Gelap</span>
          </button>
          <button
            type="button"
            class="filter-chip {colorModePref === 'light' ? 'active' : ''}"
            onclick={() => handleSetColorMode("light")}
            title="Gunakan Mode Terang"
          >
            <Sun size={12} />
            <span>Mode Terang</span>
          </button>
        </div>
      </div>

      <!-- Sakelar Utama: Sinkronkan Tema Chart dengan Aplikasi -->
      <div class="hub-sync-pill {syncChartWithAppTheme ? 'synced' : 'decoupled'}">
        <div class="sync-pill-text">
          {#if syncChartWithAppTheme}
            <Link2 size={13} class="sync-icon-linked" />
            <span>Sinkronkan Tema Chart dengan Aplikasi</span>
          {:else}
            <Unlink size={13} class="sync-icon-unlinked" />
            <span>Sinkronkan Tema Chart dengan Aplikasi (Terpisah)</span>
          {/if}
        </div>
        <label class="toggle-switch">
          <input
            type="checkbox"
            checked={syncChartWithAppTheme}
            onchange={(e) => handleToggleSyncChart(e.currentTarget.checked)}
            aria-label="Sinkronkan Tema Chart dengan Aplikasi"
          />
          <span class="slider"></span>
        </label>
      </div>
    </div>

    <!-- 2 Kartu Status Utama: [1] Tema Aplikasi (UI Shell) & [2] Tema Kanvas Chart -->
    <div class="dual-domain-cards">
      <!-- KARTU DOMAIN 1: TEMA APLIKASI (UI SHELL) -->
      <div
        class="domain-card {!syncChartWithAppTheme && targetThemeSelection === 'app' ? 'active-target' : ''}"
        onclick={() => {
          if (!syncChartWithAppTheme) targetThemeSelection = "app";
        }}
        role="button"
        tabindex="0"
        onkeydown={(e) => {
          if (!syncChartWithAppTheme && (e.key === "Enter" || e.key === " ")) {
            targetThemeSelection = "app";
          }
        }}
      >
        <div class="domain-card-top">
          <div class="domain-title-wrap">
            <Monitor size={15} class="domain-icon" />
            <div>
              <div class="domain-title">Tema Aplikasi (Menu & Panel UI)</div>
              <div class="domain-subtitle">
                Header, Watchlist, Sidebar, Dialog & Pine IDE
              </div>
            </div>
          </div>
          {#if !syncChartWithAppTheme}
            <span
              class="target-focus-badge {targetThemeSelection === 'app' ? 'active' : ''}"
            >
              {targetThemeSelection === "app" ? "✓ Sedang Diatur" : "Klik untuk Atur"}
            </span>
          {/if}
        </div>

        <div class="domain-selector-row" onclick={(e) => e.stopPropagation()}>
          <div class="domain-mini-swatches">
            <span
              class="mini-dot"
              style="background: {activeAppPresetConfig.tokens.bgDarkest};"
              title="Latar UI"
            ></span>
            <span
              class="mini-dot"
              style="background: {activeAppPresetConfig.tokens.brandPrimary};"
              title="Aksen UI"
            ></span>
          </div>
          <select
            class="select-input domain-select"
            value={settings.themePreset || "signature"}
            onchange={(e) =>
              handleSelectAppThemeDropdown(e.currentTarget.value)}
            aria-label="Pilih Tema Aplikasi"
          >
            {@render themePresetOptions()}
          </select>
        </div>
      </div>

      <!-- KARTU DOMAIN 2: TEMA KANVAS CHART (GRAFIK & LILIN) -->
      <div
        class="domain-card {!syncChartWithAppTheme && targetThemeSelection === 'chart' ? 'active-target' : ''} {syncChartWithAppTheme ? 'is-synced-card' : ''}"
        onclick={() => {
          if (!syncChartWithAppTheme) targetThemeSelection = "chart";
        }}
        role="button"
        tabindex="0"
        onkeydown={(e) => {
          if (!syncChartWithAppTheme && (e.key === "Enter" || e.key === " ")) {
            targetThemeSelection = "chart";
          }
        }}
      >
        <div class="domain-card-top">
          <div class="domain-title-wrap">
            <BarChart2 size={15} class="domain-icon" />
            <div>
              <div class="domain-title">Tema Kanvas Chart (Grafik & Lilin)</div>
              <div class="domain-subtitle">
                Latar grafik, candlestick bull/bear, grid & crosshair
              </div>
            </div>
          </div>
          {#if syncChartWithAppTheme}
            <button
              type="button"
              class="btn-unlink-quick"
              onclick={(e) => {
                e.stopPropagation();
                handleToggleSyncChart(false);
                targetThemeSelection = "chart";
              }}
              title="Pisahkan tema chart agar bisa berbeda dari tema aplikasi"
            >
              <Unlink size={11} />
              <span>Bedakan dari Aplikasi</span>
            </button>
          {:else}
            <span
              class="target-focus-badge {targetThemeSelection === 'chart' ? 'active' : ''}"
            >
              {targetThemeSelection === "chart" ? "✓ Sedang Diatur" : "Klik untuk Atur"}
            </span>
          {/if}
        </div>

        <div class="domain-selector-row" onclick={(e) => e.stopPropagation()}>
          <div class="domain-mini-swatches">
            <span
              class="mini-dot"
              style="background: {activeChartPresetConfig.chart.background};"
              title="Latar Chart"
            ></span>
            <span
              class="mini-dot"
              style="background: {activeChartPresetConfig.chart.upColor};"
              title="Bullish Candle"
            ></span>
            <span
              class="mini-dot"
              style="background: {activeChartPresetConfig.chart.downColor};"
              title="Bearish Candle"
            ></span>
          </div>
          {#if syncChartWithAppTheme}
            <div class="synced-chart-readout">
              <Link2 size={12} />
              <span>Mengikuti Tema Aplikasi ({activeAppPresetConfig.name})</span>
            </div>
          {:else}
            <select
              class="select-input domain-select"
              value={settings.chartThemePreset || "signature"}
              onchange={(e) =>
                handleSelectChartThemeDropdown(e.currentTarget.value)}
              aria-label="Pilih Tema Kanvas Chart"
            >
              {@render themePresetOptions()}
            </select>
          {/if}
        </div>
      </div>
    </div>

    <!-- Baris Tambahan: Watermark Simbol & Opsi Lanjutan Default Gelap/Terang -->
    <div class="hub-bottom-bar">
      <div class="watermark-inline-row">
        <span class="watermark-inline-label">Watermark Simbol di Kanvas:</span>
        <label class="toggle-switch">
          <input
            type="checkbox"
            checked={settings.showWatermark !== false}
            onchange={(e) =>
              onUpdateSettings({ showWatermark: e.currentTarget.checked })}
            aria-label="Watermark Simbol di Kanvas"
          />
          <span class="slider"></span>
        </label>
      </div>

      <button
        type="button"
        class="btn-advanced-defaults"
        onclick={() => (showAdvancedModeDefaults = !showAdvancedModeDefaults)}
      >
        <Sliders size={11} />
        <span>Atur Tema Favorit Saat Pindah Gelap/Terang</span>
        {#if showAdvancedModeDefaults}
          <ChevronUp size={12} />
        {:else}
          <ChevronDown size={12} />
        {/if}
      </button>
    </div>

    {#if showAdvancedModeDefaults}
      <div class="theme-defaults-grid">
        <div class="setting-row default-preset-item">
          <div class="setting-info">
            <span class="setting-label">Tema Favorit Mode Gelap</span>
            <span class="setting-desc">
              Otomatis dipakai saat Anda menekan tombol Mode Gelap
            </span>
          </div>
          <select
            class="select-input"
            value={settings.activeDarkPreset || "signature"}
            onchange={(e) => handleSetDarkPreset(e.currentTarget.value)}
          >
            {#each darkPresets as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        </div>

        <div class="setting-row default-preset-item">
          <div class="setting-info">
            <span class="setting-label">Tema Favorit Mode Terang</span>
            <span class="setting-desc">
              Otomatis dipakai saat Anda menekan tombol Mode Terang
            </span>
          </div>
          <select
            class="select-input"
            value={settings.activeLightPreset || "red_folder"}
            onchange={(e) => handleSetLightPreset(e.currentTarget.value)}
          >
            {#each lightPresets as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        </div>
      </div>
    {/if}
  </div>

  <!-- ═════════════════════════════════════════════════════════════════════════ -->
  <!-- BAGIAN 2: GALERI PRESET TEMA (BAWAAN & KUSTOM PENGGUNA)                   -->
  <!-- ═════════════════════════════════════════════════════════════════════════ -->
  <div class="presets-header-row">
    <div>
      <h4 class="section-title">Galeri Preset Tema & Candlestick</h4>
      <p class="section-subtitle">
        {#if syncChartWithAppTheme}
          Klik kartu tema di bawah untuk menerapkan sekaligus ke <b>Aplikasi & Kanvas Chart</b>.
        {:else}
          Mode terpisah aktif: klik kartu untuk menerapkan ke <b>{targetThemeSelection === "app" ? "Tema Aplikasi" : "Tema Kanvas Chart"}</b>, atau gunakan tombol langsung pada kartu.
        {/if}
      </p>
    </div>

    <!-- Filter Mode Tema -->
    <div
      class="theme-mode-filters"
      role="radiogroup"
      aria-label="Filter Mode Tema"
    >
      <button
        type="button"
        class="filter-chip {filterMode === 'all' ? 'active' : ''}"
        onclick={() => setFilterMode("all")}
      >
        <span>Semua ({allAvailablePresets.length})</span>
      </button>
      <button
        type="button"
        class="filter-chip {filterMode === 'dark' ? 'active' : ''}"
        onclick={() => setFilterMode("dark")}
      >
        <Moon size={11} />
        <span>Gelap ({darkPresets.length})</span>
      </button>
      <button
        type="button"
        class="filter-chip {filterMode === 'light' ? 'active' : ''}"
        onclick={() => setFilterMode("light")}
      >
        <Sun size={11} />
        <span>Terang ({lightPresets.length})</span>
      </button>
    </div>
  </div>

  <div class="theme-presets-grid">
    {#each filteredPresets as preset}
      {@const isSelectedApp =
        (settings.themePreset || "signature") === preset.id}
      {@const isSelectedChart = syncChartWithAppTheme
        ? isSelectedApp
        : (settings.chartThemePreset || "signature") === preset.id}
      {@const isSelected = syncChartWithAppTheme
        ? isSelectedApp
        : isSelectedApp || isSelectedChart}
      {@const isCustom = !isBuiltInTheme(preset.id)}
      <div
        class="theme-card {isSelected ? 'selected' : ''} {isCustom
          ? 'custom-theme-card'
          : ''}"
        onclick={() => handleSelectPreset(preset)}
        role="button"
        tabindex="0"
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleSelectPreset(preset);
          }
        }}
      >
        <div class="theme-card-header">
          <span class="theme-name">{preset.name}</span>
          <div class="card-badges">
            {#if isCustom}
              <span class="mode-pill custom">[CUSTOM]</span>
            {/if}
            {#if preset.mode === "light"}
              <span class="mode-pill light"><Sun size={9} /> LIGHT</span>
            {:else}
              <span class="mode-pill dark"><Moon size={9} /> DARK</span>
            {/if}
          </div>
        </div>

        <p class="theme-desc">{preset.description}</p>

        <!-- Preview Swatches -->
        <div class="theme-swatches">
          <div
            class="swatch-item"
            title="Latar Kanvas ({preset.tokens.bgDarkest})"
          >
            <span
              class="swatch-color"
              style="background-color: {preset.tokens
                .bgDarkest}; border: 1px solid rgba(255,255,255,0.2);"
            ></span>
            <span class="swatch-label">Latar</span>
          </div>
          <div
            class="swatch-item"
            title="Candlestick Bull ({preset.chart.upColor})"
          >
            <span
              class="swatch-color"
              style="background-color: {preset.chart.upColor};"
            ></span>
            <span class="swatch-label">Bull</span>
          </div>
          <div
            class="swatch-item"
            title="Candlestick Bear ({preset.chart.downColor})"
          >
            <span
              class="swatch-color"
              style="background-color: {preset.chart.downColor};"
            ></span>
            <span class="swatch-label">Bear</span>
          </div>
          <div
            class="swatch-item"
            title="Aksen Brand ({preset.tokens.brandPrimary})"
          >
            <span
              class="swatch-color"
              style="background-color: {preset.tokens.brandPrimary};"
            ></span>
            <span class="swatch-label">Aksen</span>
          </div>
        </div>

        <!-- Status & Tombol Aksi Langsung (Tidak Membingungkan) -->
        <div class="theme-card-footer" onclick={(e) => e.stopPropagation()}>
          {#if syncChartWithAppTheme}
            <div class="theme-status">
              {#if isSelectedApp}
                <span class="status-active">
                  <Check size={12} /> Aktif (Aplikasi & Chart)
                </span>
              {:else}
                <button
                  type="button"
                  class="btn-apply-direct"
                  onclick={() => handleSelectBothPreset(preset)}
                >
                  Pakai Tema Ini
                </button>
              {/if}
            </div>
          {:else}
            <!-- Saat mode terpisah, tampilkan 2 tombol langsung: [Aplikasi] dan [Chart] -->
            <div class="decoupled-card-buttons">
              <button
                type="button"
                class="btn-domain-apply {isSelectedApp ? 'active' : ''}"
                onclick={() => handleSelectAppPreset(preset)}
                title="Terapkan tema ini ke antarmuka Aplikasi"
              >
                {#if isSelectedApp}
                  <Check size={10} /> Aplikasi
                {:else}
                  Pakai di Aplikasi
                {/if}
              </button>
              <button
                type="button"
                class="btn-domain-apply {isSelectedChart ? 'active' : ''}"
                onclick={() => handleSelectChartPreset(preset)}
                title="Terapkan tema ini ke Kanvas Chart"
              >
                {#if isSelectedChart}
                  <Check size={10} /> Chart
                {:else}
                  Pakai di Chart
                {/if}
              </button>
            </div>
          {/if}

          <div class="custom-card-actions">
            <button
              type="button"
              class="btn-card-action"
              title="Edit warna tema"
              onclick={(e) => handleStartEditThemeColors(preset, e)}
            >
              <Palette size={11} />
            </button>
            {#if isCustom}
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
                onclick={(e) =>
                  handleExportUserThemeText(preset.id, preset.name, e)}
              >
                <FileText size={11} />
              </button>
              <button
                type="button"
                class="btn-card-action"
                title="Ekspor tema sebagai JSON"
                onclick={(e) =>
                  handleExportUserThemeJson(preset.id, preset.name, e)}
              >
                <Download size={11} />
              </button>
              <button
                type="button"
                class="btn-card-action btn-card-delete"
                title="Hapus tema"
                onclick={(e) =>
                  handleDeleteUserTheme(preset.id, preset.name, e)}
              >
                <Trash2 size={11} />
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- ═════════════════════════════════════════════════════════════════════════ -->
  <!-- BAGIAN 3: STUDIO KUSTOMISASI TEMA & LATAR KANVAS                          -->
  <!-- ═════════════════════════════════════════════════════════════════════════ -->
  <div class="custom-studio-box">
    <div class="custom-studio-header">
      <div class="custom-studio-info">
        <div class="studio-title-row">
          <Sparkles size={16} class="studio-icon" />
          <span class="custom-studio-title">Studio Kustomisasi Tema (Custom Theme Builder)</span>
          {#if isCustomActive}
            <span class="custom-active-badge">Live Preview Aktif</span>
          {:else}
            <span class="custom-theme-badge">Basis: {activePreset.name}</span>
          {/if}
          <span class="mode-indicator {isPaletteDark ? 'dark' : 'light'}">
            {#if isPaletteDark}
              <Moon size={10} /> Mode Gelap
            {:else}
              <Sun size={10} /> Mode Terang
            {/if}
          </span>
        </div>

        {#if editingUserThemeId}
          <div class="in-place-edit-banner">
            <span>Sedang Mengedit Warna: <b>{editingUserThemeName}</b></span>
            <div class="in-place-actions">
              <button
                type="button"
                class="btn-studio-action btn-save-as"
                onclick={handleSaveInPlaceThemeColors}
              >
                <Save size={13} /> Simpan Perubahan ke Tema Ini
              </button>
              <button
                type="button"
                class="btn-studio-action btn-reset"
                onclick={handleCancelEditThemeColors}
              >
                <X size={13} /> Batal
              </button>
            </div>
          </div>
        {/if}

        <span class="custom-studio-desc">
          Ubah warna lilin candlestick atau warna latar di bawah untuk melihat hasilnya secara langsung, lalu klik <b>"Simpan Sebagai Tema Baru"</b> agar tersimpan di galeri tema Anda.
        </span>
      </div>

      <div class="custom-studio-actions">
        {#if copyFeedback}
          <span class="feedback-toast">
            <CheckCheck size={12} /> {copyFeedback}
          </span>
        {/if}
        <button
          type="button"
          class="btn-studio-action btn-save-as"
          onclick={handleOpenSaveAs}
          title="Simpan racikan warna saat ini sebagai preset tema pribadi baru"
        >
          <Save size={12} />
          <span>Simpan Sebagai Tema Baru</span>
        </button>
        <button
          type="button"
          class="btn-studio-action"
          onclick={handleOpenPaste}
          title="Tempel palet dari JSON atau teks daftar warna"
        >
          <Clipboard size={12} />
          <span>Impor / Tempel Palet</span>
        </button>
        <button
          type="button"
          class="btn-studio-action"
          onclick={handleCopyText}
          title="Salin ringkasan palet dalam format teks Hex"
        >
          <FileText size={12} />
          <span>Salin Hex</span>
        </button>
        <button
          type="button"
          class="btn-studio-action"
          onclick={handleCopyJson}
          title="Salin konfigurasi palet dalam format JSON"
        >
          <Copy size={12} />
          <span>Salin JSON</span>
        </button>
        <button
          type="button"
          class="btn-studio-action btn-reset"
          onclick={handleResetCustomPalette}
          disabled={!isCustomActive}
          title="Kembalikan semua warna kustom ke setelan bawaan preset aktif"
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>
      </div>
    </div>

    <!-- Kategori 1: Warna Candlestick -->
    <div class="studio-category">
      <div class="category-header">
        <span class="category-title">1. Warna Lilin Candlestick (Bullish & Bearish)</span>
        <span class="category-sub">
          Atur warna badan lilin (Body), sumbu (Wick), dan garis tepi (Border)
        </span>
      </div>

      <div class="studio-pickers-grid">
        <!-- Bullish Body -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bullish Body (Naik)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() =>
                handleCopySingle(
                  currentPalette.candles.bullBody,
                  "Bullish body",
                )}
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
              onchange={(e) =>
                handleUpdateCandle("bullBody", e.currentTarget.value)}
              aria-label="Bullish body"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bullBody}
              maxlength="7"
              onchange={(e) =>
                handleUpdateCandle("bullBody", e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bullish Wick -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bullish Wick (Sumbu Naik)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() =>
                handleCopySingle(
                  currentPalette.candles.bullWick,
                  "Bullish wick",
                )}
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
              onchange={(e) =>
                handleUpdateCandle("bullWick", e.currentTarget.value)}
              aria-label="Bullish wick"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bullWick}
              maxlength="7"
              onchange={(e) =>
                handleUpdateCandle("bullWick", e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bullish Border -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bullish Border (Tepi Naik)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() =>
                handleCopySingle(
                  currentPalette.candles.bullBorder,
                  "Bullish border",
                )}
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
              onchange={(e) =>
                handleUpdateCandle("bullBorder", e.currentTarget.value)}
              aria-label="Bullish border"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bullBorder}
              maxlength="7"
              onchange={(e) =>
                handleUpdateCandle("bullBorder", e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bearish Body -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bearish Body (Turun)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() =>
                handleCopySingle(
                  currentPalette.candles.bearBody,
                  "Bearish body",
                )}
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
              onchange={(e) =>
                handleUpdateCandle("bearBody", e.currentTarget.value)}
              aria-label="Bearish body"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bearBody}
              maxlength="7"
              onchange={(e) =>
                handleUpdateCandle("bearBody", e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bearish Wick -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bearish Wick (Sumbu Turun)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() =>
                handleCopySingle(
                  currentPalette.candles.bearWick,
                  "Bearish wick",
                )}
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
              onchange={(e) =>
                handleUpdateCandle("bearWick", e.currentTarget.value)}
              aria-label="Bearish wick"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bearWick}
              maxlength="7"
              onchange={(e) =>
                handleUpdateCandle("bearWick", e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Bearish Border -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Bearish Border (Tepi Turun)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() =>
                handleCopySingle(
                  currentPalette.candles.bearBorder,
                  "Bearish border",
                )}
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
              onchange={(e) =>
                handleUpdateCandle("bearBorder", e.currentTarget.value)}
              aria-label="Bearish border"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.candles.bearBorder}
              maxlength="7"
              onchange={(e) =>
                handleUpdateCandle("bearBorder", e.currentTarget.value)}
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Kategori 2: Warna Fondasi (Latar, Panel, Teks) -->
    <div class="studio-category">
      <div class="category-header">
        <span class="category-title">2. Warna Fondasi Tema (Latar, Panel & Teks)</span>
        <span class="category-sub">
          Mengatur warna dasar kanvas/aplikasi, permukaan panel, dan teks sumbu
        </span>
      </div>

      <div class="studio-pickers-grid general-grid">
        <!-- Background Color -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Background (Latar Utama)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() =>
                handleCopySingle(
                  currentPalette.general.background,
                  "Background color",
                )}
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
              onchange={(e) =>
                handleUpdateGeneral("background", e.currentTarget.value)}
              aria-label="Background color"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.general.background}
              maxlength="7"
              onchange={(e) =>
                handleUpdateGeneral("background", e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Foreground -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Foreground (Permukaan Panel)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() =>
                handleCopySingle(
                  currentPalette.general.foreground,
                  "Foreground",
                )}
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
              onchange={(e) =>
                handleUpdateGeneral("foreground", e.currentTarget.value)}
              aria-label="Foreground"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.general.foreground}
              maxlength="7"
              onchange={(e) =>
                handleUpdateGeneral("foreground", e.currentTarget.value)}
            />
          </div>
        </div>

        <!-- Text color -->
        <div class="studio-picker-card">
          <div class="picker-top">
            <span class="picker-name">Text Color (Teks & Angka Sumbu)</span>
            <button
              type="button"
              class="btn-mini-copy"
              onclick={() =>
                handleCopySingle(
                  currentPalette.general.textColor,
                  "Text color",
                )}
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
              onchange={(e) =>
                handleUpdateGeneral("textColor", e.currentTarget.value)}
              aria-label="Text color"
            />
            <input
              type="text"
              class="hex-box mono-nums"
              value={currentPalette.general.textColor}
              maxlength="7"
              onchange={(e) =>
                handleUpdateGeneral("textColor", e.currentTarget.value)}
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Kategori 3: Efek Latar Belakang Khusus Kanvas Chart (Solid / Gradien) -->
    <div class="studio-category studio-bg-override">
      <div class="custom-candle-header">
        <div class="custom-candle-info">
          <span class="category-title">3. Efek Latar Kanvas Chart Khusus (Solid / Gradien Vertikal)</span>
          <span class="category-sub">
            Opsional: Timpa khusus latar belakang kanvas chart dengan gradien atau warna solid tanpa mengubah tema utama.
          </span>
        </div>
        <div class="custom-candle-actions">
          {#if isCustomBgActive}
            <span class="custom-active-badge">Override Aktif</span>
          {:else}
            <span class="custom-theme-badge">Mengikuti Tema Chart</span>
          {/if}
          <button
            type="button"
            class="btn-reset-candle"
            onclick={handleResetCustomBg}
            disabled={!isCustomBgActive}
            title="Kembalikan latar belakang grafik ke setelan bawaan tema chart"
          >
            <RotateCcw size={12} />
            <span>Ikuti Tema</span>
          </button>
        </div>
      </div>

      <div
        class="bg-mode-chips"
        role="radiogroup"
        aria-label="Mode Latar Belakang Grafik"
      >
        <button
          type="button"
          class="bg-mode-chip {bgMode === 'theme' ? 'active' : ''}"
          role="radio"
          aria-checked={bgMode === "theme"}
          onclick={() => handleSetBgMode("theme")}
        >
          <span>Bawaan Tema Chart</span>
        </button>
        <button
          type="button"
          class="bg-mode-chip {bgMode === 'solid' ? 'active' : ''}"
          role="radio"
          aria-checked={bgMode === "solid"}
          onclick={() => handleSetBgMode("solid")}
        >
          <span>Warna Solid Khusus</span>
        </button>
        <button
          type="button"
          class="bg-mode-chip {bgMode === 'gradient' ? 'active' : ''}"
          role="radio"
          aria-checked={bgMode === "gradient"}
          onclick={() => handleSetBgMode("gradient")}
        >
          <span>Gradien Vertikal</span>
        </button>
      </div>

      {#if bgMode === "solid"}
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
                  const clean = sanitizeHex(e.currentTarget.value);
                  if (clean) handleUpdateSolidColor(clean);
                }}
              />
            </div>
          </div>
        </div>
      {:else if bgMode === "gradient"}
        <div class="gradient-config-container">
          <div class="gradient-preview-wrap">
            <span class="preview-strip-label">Pratinjau Gradien Vertikal</span>
            <div
              class="gradient-live-strip"
              style="background: linear-gradient(180deg, {gradientTopVal}, {gradientBottomVal});"
              title="Pratinjau Gradien Vertikal: {gradientTopVal} -> {gradientBottomVal}"
            ></div>
          </div>

          <div class="custom-candle-inputs">
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
                    const clean = sanitizeHex(e.currentTarget.value);
                    if (clean) handleUpdateGradientTop(clean);
                  }}
                />
              </div>
            </div>

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
                  onchange={(e) =>
                    handleUpdateGradientBottom(e.currentTarget.value)}
                  aria-label="Warna Bawah Gradien"
                />
                <input
                  type="text"
                  class="hex-text-input mono-nums"
                  value={gradientBottomVal}
                  maxlength="7"
                  onchange={(e) => {
                    const clean = sanitizeHex(e.currentTarget.value);
                    if (clean) handleUpdateGradientBottom(clean);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Modal Dialog Tempel Palet -->
  {#if isPasteModalOpen}
    <div
      class="studio-modal-scrim"
      onclick={() => (isPasteModalOpen = false)}
      role="presentation"
    >
      <div
        class="studio-modal-card"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div class="modal-header">
          <div class="modal-title-row">
            <Clipboard size={16} />
            <span class="modal-title">Impor / Tempel Palet Tema</span>
          </div>
          <button
            type="button"
            class="btn-modal-close"
            onclick={() => (isPasteModalOpen = false)}
          >
            <X size={14} />
          </button>
        </div>

        <p class="modal-desc">
          Tempelkan konfigurasi JSON atau format teks daftar warna (seperti
          salinan dari situs tema atau format chartthemes.com):
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
          <button
            type="button"
            class="btn-cancel"
            onclick={() => (isPasteModalOpen = false)}
          >
            Batal
          </button>
          <button
            type="button"
            class="btn-apply-paste"
            onclick={handleApplyPaste}
          >
            Terapkan Palet
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal Dialog Simpan Sebagai Tema Baru (Save As) (#149) -->
  {#if isSaveAsModalOpen}
    <div
      class="studio-modal-scrim"
      onclick={() => (isSaveAsModalOpen = false)}
      role="presentation"
    >
      <div
        class="studio-modal-card"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div class="modal-header">
          <div class="modal-title-row">
            <Save size={16} />
            <span class="modal-title">Simpan Sebagai Tema Baru (Save As)</span>
          </div>
          <button
            type="button"
            class="btn-modal-close"
            onclick={() => (isSaveAsModalOpen = false)}
          >
            <X size={14} />
          </button>
        </div>

        <p class="modal-desc">
          Simpan racikan warna saat ini ke dalam koleksi tema pribadi Anda. Tema
          ini akan muncul di Galeri Preset dan dapat digunakan untuk Aplikasi
          maupun Kanvas Chart.
        </p>

        <div class="modal-form-group">
          <label class="modal-label" for="saveAsThemeName">Nama Tema Baru</label>
          <input
            id="saveAsThemeName"
            type="text"
            class="modal-input"
            placeholder="Contoh: Cyberpunk Neon, Kopi Sore"
            bind:value={saveAsThemeName}
            onkeydown={(e) => e.key === "Enter" && handleConfirmSaveAs()}
          />
        </div>

        <div class="modal-form-group">
          <span class="modal-label">Kategori Mode Warna</span>
          <div
            class="modal-mode-options"
            role="radiogroup"
            aria-label="Mode Tema"
          >
            <button
              type="button"
              class="filter-chip {saveAsThemeMode === 'dark' ? 'active' : ''}"
              onclick={() => (saveAsThemeMode = "dark")}
            >
              <Moon size={11} />
              <span>Mode Gelap (Dark)</span>
            </button>
            <button
              type="button"
              class="filter-chip {saveAsThemeMode === 'light' ? 'active' : ''}"
              onclick={() => (saveAsThemeMode = "light")}
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
          <button
            type="button"
            class="btn-cancel"
            onclick={() => (isSaveAsModalOpen = false)}
          >
            Batal
          </button>
          <button
            type="button"
            class="btn-apply-paste"
            onclick={handleConfirmSaveAs}
          >
            Simpan Tema
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal Dialog Ubah Nama Tema Pengguna (#149) -->
  {#if isRenameModalOpen}
    <div
      class="studio-modal-scrim"
      onclick={() => (isRenameModalOpen = false)}
      role="presentation"
    >
      <div
        class="studio-modal-card"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div class="modal-header">
          <div class="modal-title-row">
            <Edit2 size={16} />
            <span class="modal-title">Ubah Nama Tema</span>
          </div>
          <button
            type="button"
            class="btn-modal-close"
            onclick={() => (isRenameModalOpen = false)}
          >
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
            onkeydown={(e) => e.key === "Enter" && handleConfirmRename()}
          />
        </div>

        {#if renameError}
          <div class="paste-error-msg">{renameError}</div>
        {/if}

        <div class="modal-footer">
          <button
            type="button"
            class="btn-cancel"
            onclick={() => (isRenameModalOpen = false)}
          >
            Batal
          </button>
          <button
            type="button"
            class="btn-apply-paste"
            onclick={handleConfirmRename}
          >
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .section-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-main);
    margin: 0;
  }

  .section-subtitle {
    font-size: 11.5px;
    color: var(--text-muted);
    line-height: 1.4;
    margin: 2px 0 0 0;
  }

  /* ─── BAGIAN 1: THEME HUB BOX (DUAL DOMAIN CARDS) ─── */
  .theme-hub-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: 8px;
  }

  .hub-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-hairline);
  }

  .hub-mode-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hub-group-label {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-main);
  }

  .hub-sync-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 10px;
    border-radius: 6px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
  }

  .hub-sync-pill.decoupled {
    border-color: var(--brand-primary);
    background: rgba(255, 105, 180, 0.06);
  }

  .sync-pill-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-main);
  }

  .dual-domain-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
    gap: 12px;
  }

  .domain-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    background: var(--bg-surface);
    border: 1.5px solid var(--border-hairline);
    border-radius: 7px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .domain-card:hover {
    border-color: var(--border-bright);
  }

  .domain-card.active-target {
    border-color: var(--brand-primary);
    box-shadow: 0 0 12px rgba(255, 105, 180, 0.14);
  }

  .domain-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .domain-title-wrap {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .domain-title-wrap :global(.domain-icon) {
    color: var(--brand-primary);
    margin-top: 2px;
    flex-shrink: 0;
  }

  .domain-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main);
  }

  .domain-subtitle {
    font-size: 10.5px;
    color: var(--text-muted);
    margin-top: 1px;
  }

  .target-focus-badge {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--bg-elevated);
    color: var(--text-muted);
    border: 1px solid var(--border-hairline);
    white-space: nowrap;
  }

  .target-focus-badge.active {
    background: rgba(255, 105, 180, 0.15);
    color: var(--brand-primary);
    border-color: var(--brand-primary);
  }

  .btn-unlink-quick {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--bg-elevated);
    color: var(--text-main);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .btn-unlink-quick:hover {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .domain-selector-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: auto;
  }

  .domain-mini-swatches {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    background: var(--bg-darkest);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
  }

  .mini-dot {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: inline-block;
  }

  .domain-select {
    flex: 1;
    width: 100%;
    font-weight: 600;
  }

  .synced-chart-readout {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--bg-darkest);
    border: 1px dashed var(--border-subtle);
    padding: 6px 10px;
    border-radius: 4px;
  }

  .hub-bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-top: 8px;
    border-top: 1px solid var(--border-hairline);
  }

  .watermark-inline-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .watermark-inline-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .btn-advanced-defaults {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .btn-advanced-defaults:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }

  .theme-defaults-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 10px;
    padding-top: 6px;
  }

  .default-preset-item {
    background: var(--bg-surface);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-hairline);
  }

  /* ─── BAGIAN 2: GALERI PRESET TEMA ─── */
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
    gap: 4px;
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

  .theme-presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(235px, 1fr));
    gap: 10px;
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
    gap: 6px;
  }

  .theme-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main);
  }

  .card-badges {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
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

  .theme-desc {
    font-size: 10.5px;
    color: var(--text-muted);
    line-height: 1.35;
    min-height: 28px;
    margin: 0;
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

  .theme-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid var(--border-hairline);
    width: 100%;
  }

  .theme-status {
    font-size: 10px;
    font-weight: 600;
  }

  .status-active {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--brand-primary);
  }

  .btn-apply-direct {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-main);
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-apply-direct:hover {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .decoupled-card-buttons {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .btn-domain-apply {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9.5px;
    font-weight: 600;
    padding: 3px 7px;
    border-radius: 4px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .btn-domain-apply:hover {
    color: var(--text-main);
    border-color: var(--brand-primary);
  }

  .btn-domain-apply.active {
    background: rgba(255, 105, 180, 0.14);
    color: var(--brand-primary);
    border-color: var(--brand-primary);
    font-weight: 700;
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

  /* ─── TOGGLE SWITCH (DENGAN POSITION RELATIVE WAJIB) ─── */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    cursor: pointer;
    flex-shrink: 0;
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

  /* ─── BAGIAN 3: STUDIO KUSTOMISASI TEMA ─── */
  .custom-studio-box {
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
    gap: 6px;
    max-width: 620px;
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

  .in-place-edit-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    padding: 8px 12px;
    background: rgba(255, 105, 180, 0.1);
    border: 1px solid var(--brand-primary);
    border-radius: 6px;
    font-size: 11.5px;
    color: var(--text-main);
  }

  .in-place-actions {
    display: flex;
    align-items: center;
    gap: 6px;
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

  .btn-studio-action.btn-save-as {
    background: var(--brand-primary);
    border-color: var(--brand-primary);
    color: #000000;
    font-weight: 700;
  }

  .btn-studio-action.btn-save-as:hover {
    filter: brightness(1.08);
    color: #000000;
  }

  .btn-studio-action:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-studio-action.btn-reset:hover:not(:disabled) {
    color: var(--bear-color);
  }

  .studio-category {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .studio-bg-override {
    padding-top: 12px;
    border-top: 1px solid var(--border-hairline);
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

  /* ─── MODALS ─── */
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
    color: #000000;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-apply-paste:hover {
    filter: brightness(1.1);
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
</style>
