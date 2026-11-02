# Specification: Dual-Theme Decoupling, User Presets, System Theme Bridge, Type-to-Search Guard, and Background Alert Engine

## Problem Statement

Traders and technical chartists using the trawangan terminal encounter visual clashes, customization limitations, keyboard search friction, and background alert unreliability across several core subsystems:

1. **Coupled App UI and Chart Canvas Theming with Illegible UI Clashes**: Currently, the styling of the desktop shell and the WebGL2 canvas are coupled in a single theme structure. In certain views, hardcoded color values clash when switching between dark and light palettes. Most notably:
   - The chart right-click context menu uses a hardcoded dark background (`rgba(16, 20, 29, 0.97)`), while its label typography reads `--text-main`. In light themes (such as *Red Folder News* with `#4A0E0F` burgundy text), dark text on a dark background becomes completely illegible.
   - The security watermark engine renders profile text using hardcoded `#FFFFFF`, creating poor contrast or visual collisions when rendered over light-themed canvas backgrounds or export frames.
2. **Absence of OS System Theme Synchronization and Quick Mode Toggle**: Switching between dark and light environments requires opening the Appearance Settings tab and manually picking a preset. There is no one-click toggle in the primary header and no automatic synchronization with the host operating system's color scheme (`prefers-color-scheme`).
3. **Single Transient Custom Palette Without "Save As" Capabilities**: Traders can customize colors in the Appearance tab, but there is only a single temporary custom palette slot. Users cannot name, save, or build a personal collection of distinct custom themes alongside built-in presets.
4. **Type-to-Search Canvas Guard Keystroke Erase Bug**: When typing an alphanumeric symbol trigger directly on the chart canvas (e.g., pressing `Z`), the symbol search dialog opens, but immediately selects all text. Typing the subsequent character (e.g., `I` or `B`) replaces the selected first letter instead of appending to it, frustrating quick symbol navigation.
5. **Dormant Alerts for Inactive Symbols**: Price alerts configured on symbols that are not currently displayed on an open chart canvas and not present in the actively selected watchlist tab are never polled by the market feed. As a consequence, alerts on background symbols fail to trigger, creating a blocker for upcoming synchronized trade setup workflows.

## Solution

1. **Decoupled App UI Theme vs Chart Canvas Theme**:
   - Separate visual styling into two distinct but harmonizable domains: **App UI Theme** (governing header, toolbar, dock, dialogs, context menus, status bar, and code editor) and **Chart Canvas Theme** (governing candlestick body/wick/borders, canvas background, gridlines, crosshair, and screenshot watermark).
   - Provide an explicit `syncChartWithAppTheme` preference (defaulting to enabled).
   - Refactor the chart context menu styling to rely purely on semantic CSS custom properties (`--bg-panel` and `--text-main`), eliminating hardcoded hex background values.
   - Adapt screenshot watermark text color deterministically to match canvas background luminance (pure white with dark stroke on dark backgrounds; deep contrast fill with subtle light stroke on light backgrounds).
2. **System Theme Bridge and Quick Mode Switcher**:
   - Introduce a three-state preference `colorModePreference: 'system' | 'dark' | 'light'`.
   - Maintain associations with two configurable preset IDs: `activeDarkPreset` (defaulting to `signature`) and `activeLightPreset` (defaulting to `red_folder`).
   - Listen reactively to system color scheme changes when set to `system`.
   - Add a fast one-click toggle button on the header control strip to cycle between Dark, Light, and System modes.
3. **User Theme Presets ("Save As" Engine)**:
   - Expand the persistence engine to store a collection of user-defined themes (`savedUserThemes`).
   - Implement a "Save As" flow in Appearance Settings that prompts for a custom name and assigns a base mode (`dark` or `light`).
   - Display saved custom themes as first-class cards alongside official presets, with options to apply, rename, export, or delete.
4. **Contextual Type-to-Search Focus & Cursor Placement**:
   - In the symbol search dialog, distinguish between automated keystroke triggers (*Type-to-Search*) and explicit user openings (`Ctrl + K` or search bar clicks).
   - For Type-to-Search triggers, place the text cursor at the end of the input (`setSelectionRange(len, len)`) without selecting the text, preserving the first character and allowing seamless continuous typing.
   - For explicit openings, retain full text selection (`select()`) so users can replace existing queries in one keystroke.
5. **Background Alert Engine**:
   - Augment the background market feed polling loop to automatically aggregate all unique symbols from active price alerts (`alertService.getActiveAlertSymbols()`).
   - Ingest and poll these symbols in parallel batches across active providers, guaranteeing real-time alert evaluation and notification delivery regardless of active chart or watchlist state.

## User Stories

1. As a technical analyst using a light theme, I want the chart right-click context menu to display dark text on a light panel background, so that all menu items, price levels, and shortcuts are clearly legible.
2. As a trader capturing chart snapshots on light or custom backgrounds, I want the security watermark to automatically adapt its text color and stroke contrast, so that my attribution remains legible without visually overpowering the chart.
3. As a day trader working in changing ambient light, I want a single-click button on the terminal header to toggle between Dark and Light mode, so that I can adapt my workspace instantly without digging into settings menus.
4. As a user whose operating system switches automatically between dark and light modes on a schedule, I want trawangan to follow my system preference seamlessly, so that the terminal aligns with my desktop environment.
5. As a trader with preferred color schemes, I want to designate which specific preset is used when entering Dark mode and which is used when entering Light mode, so that toggling modes always selects my favorite configurations.
6. As a chartist who customized a unique 9-dimensional candle and background palette, I want to click "Save As" and give it a custom name, so that I can store my creation permanently in my theme collection.
7. As an aesthetic-focused trader, I want to categorize my custom saved themes into Dark or Light modes, so that they filter and respond accurately to mode switcher actions.
8. As a user managing custom palettes, I want to rename or delete custom themes I created while built-in presets remain protected as read-only, so that I have full lifecycle control over my presets without risking factory defaults.
9. As a power user, I want to export my custom theme definitions as JSON or text format, so that I can back them up or share them with other traders.
10. As a trader who prefers dark terminal controls with a light chart canvas, I want to disable chart-to-app theme synchronization, so that I can independently pair any app theme with any chart canvas theme.
11. As a fast-typing chartist pressing letters like `Z` on the canvas, I want subsequent letters like `I` to append cleanly to form `ZI`, so that my initial keystroke is not accidentally overwritten.
12. As a keyboard user pressing `Ctrl + K` to change symbols, I want the existing symbol text to be fully selected, so that typing a new ticker replaces the old query immediately.
13. As a swing trader tracking 20 different crypto pairs, I want price alerts on background symbols to trigger even when I am viewing a completely different chart, so that I never miss an Entry, Take Profit, or Stop Loss signal.
14. As an active trader whose watchlist is organized into separate tabs, I want alerts on symbols located in background tabs or outside the watchlist to remain active, so that my risk management triggers are not dependent on UI tab selection.
15. As a resource-conscious user running a lightweight desktop app, I want background alert polling to deduplicate identical symbols across providers, so that system resource consumption and exchange API bandwidth remain minimal.
16. As a trader planning trade setups with multi-target orders, I want alerts generated from trading plan levels to be continuously monitored in the background, so that the upcoming synchronized trade setup system functions reliably.

## Implementation Decisions

### 1. Dual-Theme Decoupling & Semantic CSS Injection
- **App UI vs Chart State**:
  - In `AppSettings`, separate theme configuration into `appThemePreset` (or general `themePreset`), `chartThemePreset`, and a synchronization flag `syncChartWithAppTheme: boolean` (default: `true`).
  - When `syncChartWithAppTheme` is enabled, mutating the app theme preset automatically updates the chart theme preset. When disabled, each setting can be adjusted independently.
- **Dynamic Context Menu Styling**:
  - In the context menu component, eliminate hardcoded `rgba(16, 20, 29, 0.97)` and replace with:
    `background-color: var(--bg-panel, #171717);`
    `border: 1px solid var(--border-medium, #2a3447);`
    `color: var(--text-main, #f7f7f7);`
  - Ensure menu item hover and disabled states reference `--bg-hover` and `--text-dim` respectively.
- **Adaptive Screenshot Watermark**:
  - In the screenshot attribution renderer, calculate the luminance of the active chart background (`isDarkColor(chartBackground)`).
  - If dark: render watermark text with `fillStyle = 'rgba(255, 255, 255, 0.9)'` and `strokeStyle = 'rgba(0, 0, 0, 0.5)'`.
  - If light: render watermark text with `fillStyle = 'rgba(20, 20, 20, 0.85)'` and `strokeStyle = 'rgba(255, 255, 255, 0.6)'`.

### 2. System Theme Bridge & Header Switcher
- **State Model**:
  ```ts
  type ColorModePreference = 'system' | 'dark' | 'light';
  
  interface AppSettings {
    colorModePreference: ColorModePreference;
    activeDarkPreset: ThemePresetId | string;
    activeLightPreset: ThemePresetId | string;
    syncChartWithAppTheme: boolean;
    savedUserThemes: CustomThemeDefinition[];
    // ...existing settings
  }
  ```
- **OS MediaQuery Reaction**:
  - At the application root, register a media query listener for `(prefers-color-scheme: dark)`.
  - When `colorModePreference === 'system'`, apply `activeDarkPreset` when the system prefers dark, and `activeLightPreset` when the system prefers light.
- **Header Fast Toggle**:
  - Add an intuitive toggle control to the header action bar showing an icon indicating the current active mode (Sun for light, Moon for dark, Computer/Monitor for system). Clicking cycles or toggles between dark and light (with an option to revert to system).

### 3. User Theme Preset Management ("Save As")
- **Custom Theme Definition Structure**:
  ```ts
  interface CustomThemeDefinition {
    id: string; // "user_theme_" + timestamp
    name: string;
    mode: 'dark' | 'light';
    palette: CustomThemePalette;
    createdAt: number;
    updatedAt: number;
  }
  ```
- **Save As Modal & Storage**:
  - In Appearance Settings, provide a "Save As" button. Upon clicking, open a modal prompting for the theme name and mode.
  - Store saved themes in the workspace persistence layer.
  - Render user themes alongside built-in presets with distinct visual indicators and management actions (rename, delete, export).

### 4. Contextual Type-to-Search Selection Guard
- **Trigger Distinguisher in Search Dialog**:
  - Accept an optional prop `triggerSource?: 'keystroke' | 'explicit'`.
  - When the dialog opens:
    - If `triggerSource === 'keystroke'`: focus `searchInputEl`, then set `searchInputEl.setSelectionRange(query.length, query.length)`.
    - If `triggerSource === 'explicit'` (or undefined): focus `searchInputEl` and invoke `searchInputEl.select()`.

### 5. Background Alert Engine
- **Active Alert Symbol Extraction**:
  - In `AlertService`, expose `getActiveAlertSymbols(): string[]`, which returns all deduplicated symbols where `alert.active === true && alert.triggered === false`.
- **Market Feed Symbol Assembly**:
  - In `MarketFeedService.pollTick()`, combine:
    1. Active chart symbols (`this.activeSymbolSubscribers.keys()`)
    2. Active watchlist tab symbols (`this.watchlistSubscribers`)
    3. Active alert symbols (`alertService.getActiveAlertSymbols()`)
  - Deduplicate all symbols and partition them across their respective exchange providers.
  - Dispatched ticker updates feed directly into `alertService.evaluateAlerts(symbol, ticker.price)`.

## Testing Decisions

- **Test Highest Seams with External Behavioral Assertions**: All tests must exercise external APIs and user-visible behaviors rather than private fields or DOM implementation minutiae.
- **Theme Engine & System Bridge Suite**:
  - Verify that `resolveEffectiveThemeColors` correctly evaluates dark vs light backgrounds and produces matching luminance flags.
  - Verify that user theme definitions can be created, saved, retrieved, renamed, and deleted without mutating built-in presets.
  - Verify that `colorModePreference` correctly switches active presets between dark and light defaults.
- **Context Menu & Watermark Contrast Suite**:
  - Verify that context menu styling properties map to semantic CSS custom properties without hardcoded dark background overrides.
  - Verify watermark renderer generates high-contrast fill and stroke values when passed both light (`#FFFFFF`, `#EDEDE9`) and dark (`#0F0F0F`, `#181A20`) canvas background colors.
- **Type-to-Search Keystroke Guard Suite**:
  - Verify that opening the symbol search dialog with a keystroke trigger positions the text cursor at the end of the query without text selection.
  - Verify that opening explicitly (`Ctrl + K` or button click) selects the input text entirely.
- **Background Alert Ingestion Suite**:
  - Create alerts on symbols not present in `activeSymbolSubscribers` or `watchlistSubscribers`.
  - Trigger `pollTick()` and verify that the background alert symbols are included in the provider batch query.
  - Simulate a price cross for an inactive chart symbol and verify that the alert triggers, records `triggeredAt`, and dispatches notification events.
- **Prior Art**: Follow established test harnesses in `tests/themes.test.ts`, `tests/marketFeed.test.ts`, `tests/alertManagementRevamp.test.ts`, and `tests/securityWatermark.test.ts`.

## Out of Scope

- Cloud synchronization of user theme presets across distinct devices (persisted locally offline via SQLite/localStorage).
- External webhook notifications (e.g. Telegram / Discord bot alerts), which belong to a future alert notification bridge spec.
- User-customizable Pine Script syntax highlight color authoring (syntax highlighter dynamically adapts via CodeMirror Compartment to the active app theme).

## Further Notes

- Resolving the context menu readability bug and decoupling chart from app theme fulfills long-standing community feedback regarding light theme ergonomics.
- The Background Alert Engine provides the technical foundation required for the planned *Synchronized Trade Setup & Alert Automation* feature.
