# Specification: Live Theme Preview, Chart Context Menu Pruning, In-Place Palette Editing, Canvas Watermark Control, and Workspace Auto-Save Guard

## Problem Statement

Traders and technical chartists using the trawangan terminal face configuration disconnects, UI clutter, theme management overhead, and resource churn across several key settings and canvas subsystems:

1. **Stale Theme Preview Under Decoupled Dual-Theme Mode**:
   When the user unchecks "Sinkronkan Tema Chart dengan Aplikasi" (`syncChartWithAppTheme = false`) to customize the App Shell Theme and Chart Canvas Theme separately, selecting a new preset from the dropdowns or clicking a theme card does not immediately update the live application window. Because `resolveEffectiveThemePreset()` prioritizes existing `activeDarkPreset`/`activeLightPreset` values over `themePreset`, selecting an opposite-mode theme leaves the interface unchanged until the user separately toggles the color mode preference or restarts the modal. Traders cannot evaluate color adjustments in real-time.
2. **Fractured Settings Access via Right-Click Chart Context Menu**:
   Right-clicking the chart canvas displays a context menu item titled *"Pengaturan Grafik (Warna & Lilin)..."* which summons the third-party native Vela settings dialog. This splits chart appearance configuration across two competing entry points, creates visual inconsistency, and bypasses trawangan's centralized `SettingsModal` where typography, themes, palettes, and layouts are curated.
3. **Rigid Theme Preset Modification (No In-Place Palette Editing)**:
   In the Appearance Settings tab, theme cards for user-defined presets (`savedUserThemes`) only offer a rename button, text export, JSON export, and delete. If a trader wishes to refine the 6 candle colors or 3 general colors of an existing custom theme, they cannot edit it directly in-place. Instead, they are forced to adjust the palette studio at the bottom, save it as a new separate theme ("Save As") under a new name, and manually delete the older preset, creating friction for iterative styling.
4. **Missing Symbol Watermark Toggle in Appearance Settings**:
   The Appearance tab's description explicitly highlights that the Chart Canvas Theme configures candlestick, gridlines, crosshairs, canvas backgrounds, and *watermarks*. However, there is no toggle switch in the Appearance tab to turn off the large background ticker watermark on the chart canvas. Users must navigate away to the separate Chart Tab to find this control, creating confusion.
5. **Excessive Workspace Auto-Save Triggers (Terminal Log Spam and Disk Churn)**:
   The workspace auto-save watcher (`triggerWorkspaceAutoSave`) in the main page monitors changes using a Svelte 5 `$effect`. Because `activeIndicators` emits newly allocated array instances during chart render cycles, the effect triggers continuously every second. Even though debounced to 1.5 seconds, continuous re-triggers constantly reset the timer and periodically flush full workspace JSON payloads to SQLite, consuming unnecessary CPU cycles, creating flash storage write churn, and spamming terminal logs.

## Solution

1. **Instant Decoupled Live Theme Preview**:
   - Enhance the theme selection logic in `AppearanceTab` and `resolveEffectiveThemePreset`: when a user selects an App Theme (via select input or preset card) whose binary mode (`dark` or `light`) differs from the currently active color mode, automatically synchronize `colorModePreference` and the respective active preset (`activeDarkPreset` or `activeLightPreset`) to match the selected theme.
   - Ensure mutations to both `themePreset` (App Theme) and `chartThemePreset` (Chart Canvas Theme) reactively propagate immediately to the DOM root attributes (`data-theme`, `data-theme-mode`, CSS variables) and the chart canvas controller without requiring modal closure or page reload.
2. **Pruning Chart Settings from Right-Click Context Menu**:
   - Completely remove the *"Pengaturan Grafik (Warna & Lilin)..."* menu item and its adjacent divider from `ChartContextMenu.svelte`.
   - Keep the canvas context menu purely dedicated to fast analytical actions: Add Price Alert at price level, Draw Horizontal Line, Copy Price, and Reset Chart Scale (`Alt+Z`).
   - Centralize all candle and canvas appearance adjustments exclusively inside `SettingsModal` (under the Appearance Tab and Chart Tab), providing a clean link/button to Vela candle settings within `SettingsModal`.
3. **In-Place Theme Color Editing and Safe Forking**:
   - Add an "Edit Warna" action button (using a `Palette` icon) directly on theme cards in `AppearanceTab.svelte`.
   - For **User Theme Presets**: Clicking "Edit Warna" loads the 9-dimensional palette into the *Palet Kustom Studio*, smoothly scrolls to the editor, displays an active editing status banner (`Sedang Mengedit Warna: [Nama Tema]`), and provides an in-place save button (`Simpan Perubahan ke [Nama Tema]`) that updates the existing preset in `savedUserThemes` directly without creating duplicate entries.
   - For **Official Built-In Presets**: Clicking "Edit Warna" loads the official preset colors into the studio as a custom fork draft, enabling the user to customize the colors and use "Simpan Sebagai Tema Baru" without corrupting factory presets.
4. **Canvas Watermark Control in Appearance Settings**:
   - Add a dedicated toggle switch for *"Watermark Simbol di Kanvas"* directly inside the Chart Canvas Theme section of `AppearanceTab.svelte`.
   - Bind this toggle bi-directionally to `appSettings.showWatermark` and synchronize it with the existing toggle in `ChartTab.svelte`.
   - Ensure the chart session controller deterministically invokes `cell.setWatermarkVisible(show)` across all active WebGL2 canvas cells so the symbol watermark immediately disappears or appears without latency.
5. **Workspace Auto-Save Guard (Deep Equality and Quiet Debounce)**:
   - Implement structural/value equality hashing on workspace parameters (symbol, timeframe, layout, and indicator configurations) before triggering the auto-save timer.
   - Ignore spurious array reference changes when the underlying indicator data values are identical.
   - Increase the workspace auto-save debounce delay from 1.5 seconds to 3.5 seconds.
   - Silence repetitive auto-save log spam in the terminal, reserving notifications for user-initiated actions or actual write failures.

## User Stories

1. As a trader who decoupled the App Theme from the Chart Theme, I want my application interface to update immediately when I pick a new desktop shell theme, so that I can see the live preview without closing the settings window.
2. As a chartist selecting a light app theme while currently in dark mode, I want the terminal to automatically switch its active mode to light, so that the selected light preset displays without manual mode toggling.
3. As a user choosing an independent chart canvas theme (e.g. *Signature Dark* canvas with *Red Folder* app UI), I want the candlestick and chart canvas colors to re-render instantly, so that I can review my visual contrast pairing in real time.
4. As an analyst right-clicking the chart to add an alert or measure levels, I want the context menu to be compact and focused only on quick trading actions, so that my workflow is not cluttered by redundant settings dialogs.
5. As a product user, I want all chart visual styling and candle configuration to be managed centrally in the main Settings Modal, so that I have a consistent, single source of truth for terminal preferences.
6. As a trader with custom-saved theme presets, I want to click an "Edit Warna" button on my custom theme card, so that I can modify its candle or background colors directly without having to create a new theme and delete the old one.
7. As a user modifying an existing custom theme, I want to see a clear status banner showing which theme I am currently modifying, so that I am confident my color tweaks apply to the intended preset.
8. As a creator tweaking a custom theme, I want a single "Simpan Perubahan" button in the palette studio, so that the modifications overwrite the active user preset in-place in SQLite and local storage.
9. As a user who likes a built-in theme like *Midnight Indigo* or *Cyberpunk*, I want to click "Edit Warna" to fork its colors into the palette studio, so that I can use it as a starting point for a new theme without altering the official preset.
10. As a chartist working in the Appearance tab, I want to see a toggle to turn off the large symbol watermark behind candlesticks, so that I don't have to switch to the Chart tab just to hide the background ticker.
11. As a technical analyst presenting charts or streaming, I want the background symbol watermark to disappear immediately when toggled off, so that my canvas looks clean and distraction-free.
12. As a trader keeping the terminal open all day, I want the application not to execute disk write operations every second when nothing has changed, so that my computer's CPU and SSD resources are preserved.
13. As a developer inspecting the terminal console, I want clean, meaningful log output instead of continuous auto-save messages every second, so that actual operational diagnostics and network events stand out clearly.
14. As a power user making rapid layout or timeframe adjustments, I want auto-save to debounce quietly for 3.5 seconds before committing to SQLite, so that transient intermediate states do not cause unnecessary disk I/O.

## Implementation Decisions

### 1. Decoupled Live Theme Preview & Mode Alignment
- **Mode Synchronizer in `handleSelectPreset` (`AppearanceTab.svelte`)**:
  When `syncChartWithAppTheme === false` and `targetThemeSelection === 'app'`:
  - Inspect the selected preset's `.mode` (`'dark'` | `'light'`).
  - Update `themePreset: preset.id`, `theme: preset.id`.
  - If `preset.mode !== colorModePref`, also update `colorModePreference: preset.mode`.
  - Update `activeDarkPreset: preset.id` (if dark) or `activeLightPreset: preset.id` (if light).
- **Decoupled Dropdown Selector Synchronization**:
  In the `<select>` for "Tema Aplikasi (Desktop Shell)":
  - When the selection changes, resolve the preset mode from `allAvailablePresets`.
  - Update `themePreset`, `theme`, the appropriate `activeDarkPreset` or `activeLightPreset`, and align `colorModePreference` if needed so `resolveEffectiveThemePreset` reflects the change immediately.
- In the `<select>` for "Tema Kanvas Chart (chartThemePreset)":
  - Update `chartThemePreset: e.currentTarget.value`.
  - Clear any overriding `customPalette` if the user is switching to a preset.

### 2. Chart Context Menu Pruning
- In `src/lib/components/ChartContextMenu.svelte`:
  - Remove button `<button class="menu-item" onclick={handleOpenSettingsClick}>` ("Pengaturan Grafik (Warna & Lilin)...").
  - Remove the `<div class="menu-divider"></div>` immediately preceding it.
  - Remove `handleOpenSettingsClick` handler and the `SlidersHorizontal` icon import if unused.
  - Retain `onResetChartScale`, `onDrawHorizontalLine`, `onCopyPrice`, and price alert creation.

### 3. In-Place Theme Palette Editing
- **State in `AppearanceTab.svelte`**:
  ```ts
  let editingUserThemeId = $state<string | null>(null);
  let editingUserThemeName = $state<string | null>(null);
  ```
- **Card Action**:
  - Add `<button type="button" class="btn-card-action" title="Edit warna tema" onclick={(e) => handleStartEditThemeColors(preset, e)}>` with `<Palette size={11} />`.
  - For `isCustom` presets: set `editingUserThemeId = preset.id`, `editingUserThemeName = preset.name`, and populate `currentPalette` with preset colors.
  - For built-in presets: set `editingUserThemeId = null`, populate `currentPalette` with preset colors, and inform the user they can customize and "Simpan Sebagai Tema Baru".
- **Studio In-Place Update Action**:
  - When `editingUserThemeId` is set, render a prominent banner in `custom-studio-box`:
    `Sedang Mengedit: [editingUserThemeName]` with action buttons:
    - `[Simpan Perubahan ke Tema Ini]`: updates the corresponding item in `savedUserThemes` with `currentPalette`, calls `onUpdateSettings({ savedUserThemes })`, and clears editing state.
    - `[Batal / Selesai]`: exits editing mode.

### 4. Canvas Watermark Control in AppearanceTab
- In `AppearanceTab.svelte` under the decoupled/canvas section:
  - Add a setting row:
    ```svelte
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">Watermark Simbol di Kanvas</span>
        <span class="setting-desc">Tampilkan watermark simbol aset samar di belakang candlestick</span>
      </div>
      <button
        type="button"
        class="toggle-btn {settings.showWatermark !== false ? 'active' : ''}"
        onclick={() => onUpdateSettings({ showWatermark: settings.showWatermark === false })}
      >
        {settings.showWatermark !== false ? 'Aktif' : 'Nonaktif'}
      </button>
    </div>
    ```
- In `ChartSessionController` / `Chart.svelte`:
  - Ensure `setShowWatermark(show: boolean)` is available and propagates to all active cells in the workspace via `cell.setWatermarkVisible(show)`.

### 5. Workspace Auto-Save Guard & Debounce Hardening
- In `src/routes/+page.svelte`:
  - Introduce `lastSavedStateHash` or structural fingerprint of `[activeSymbol, activeTimeframe, currentLayout, activeIndicators.map(i => i.id + i.visible + JSON.stringify(i.inputs)).join('|')]`.
  - In `triggerWorkspaceAutoSave()`, compare the current fingerprint against `lastSavedStateHash`. If identical, skip scheduling.
  - Increase debounce timeout from `1500` ms to `3500` ms.
  - Remove `addSystemLog("Auto-save: ... tersimpan otomatis", "info")` from the routine save loop to eliminate terminal and UI log noise, or convert to debug-only.

## Testing Decisions

- **Behavioral Focus**:
  - Test external theme resolution behavior across mode switches and decoupled selections.
  - Test that in-place updates to `savedUserThemes` mutate the existing theme definition without modifying built-in presets.
  - Test that `ChartContextMenu` does not render settings triggers and only handles analytical actions.
  - Test that the workspace auto-save fingerprint ignores reference-only mutations.
- **Modules Tested**:
  - `tests/dualThemeDecouplingAndUserPresets.test.ts` (extended with in-place palette updating and live preview mode alignment).
  - `tests/chartContextMenuAndWatermark.test.ts` (verifying context menu pruning and watermark toggle synchronization).
  - `tests/workspacePersistence.test.ts` (verifying debounce and auto-save guard equality).
- **Prior Art**:
  - Existing test suites: `tests/dualThemeDecouplingAndUserPresets.test.ts`, `tests/systemThemeBridgeAndHeaderSwitcher.test.ts`, and `tests/workspacePersistence.test.ts`.

## Out of Scope

- Introducing new third-party drawing engines or altering Vela's internal WebGL2 shader pipelines.
- Multi-user cloud theme synchronization (trawangan remains 100% offline-first native desktop).
- Modifying security watermark profile logic (already settled in ADR 0015 and ADR 0017).

## Further Notes

- All changes adhere strictly to the offline-first zero-paywall desktop charting architecture of trawangan.
- Documented in ADR 0018 and domain glossary (`GLOSSARY.md`).
