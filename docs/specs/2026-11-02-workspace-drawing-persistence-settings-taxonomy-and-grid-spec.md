# Specification: Workspace-Scoped Drawing Persistence, Settings Taxonomy Rework, Theme Decoupling, and Grid Mode Control

## Problem Statement

Technical traders using the trawangan terminal face severe workflow interruptions, layout claustrophobia, and configuration confusion across three primary domains:

1. **Trade Setup & Drawing Disappearance on Workspace Transitions and Session Closure**:
   - Currently, user chart drawings and calculated trade plan metadata (Entry, Stop Loss, Target Price levels, Risk-to-Reward parameters) are tied either to global symbol namespaces or lose synchronization when transitioning between workspaces or restarting the application.
   - Incomplete state reconciliation when switching to another workspace with identical or different symbols risks drawing leakage, phantom trading plans remaining in memory, or missing reverse mappings (`drawingPlanMap`) which breaks plan deletion synchronization.
   - If the application window is abruptly closed or reloaded, in-flight debounced drawings (within the 400ms buffer) fail to flush immediately to SQLite/localStorage, causing lost analytical work.
   - When a trader creates a brand-new workspace ("Workspace Baru"), residual visual drawings from the previous workspace persist rather than starting with a clean slate.

2. **Cramped Settings Modal & Convoluted Option Taxonomy**:
   - The settings modal dimensions (780px × 75vh) are too tight for the growing suite of customization controls. In particular, custom theme card galleries and candlestick palette preview builders feel restricted.
   - The settings menu taxonomy conflates distinct concerns: UI font families, numeric monospace typography, scale steppers, default timeframes, and workspace persistence are scattered between the "Tampilan" (Appearance) and "Tampilan Grafik" (Chart) tabs. This creates user hesitation and duplicated controls.

3. **Vela Canvas Theme Hijacking (Lack of Single Source of Truth)**:
   - When users switch between dark and light modes in trawangan, internal chart event callbacks from the underlying Vela WebGL2 engine (`chart.onThemeSelect`) can inadvertently override trawangan's theme preferences.
   - The internal Vela chart settings dialog exposes a `canvas.theme` selector, creating a conflicting secondary pathway for theme configuration that bypasses trawangan's theme engine.

4. **Inaccessible Grid Line Customization**:
   - Adjusting background coordinate grid line intensity or hiding them requires the user to dive into the internal WebGL chart settings modal rather than adjusting it directly alongside other trawangan canvas preferences.

---

## Solution

1. **Workspace-Scoped Drawing Isolation & Atomic Trade Setup Persistence**:
   - Establish a composite persistence key: `[workspaceId:providerId:symbol]` (e.g., `scalping_ws:binance:BTCUSDT`).
   - Serialize full trade setup state—including `drawingMetadata`, active trading plans (`activePlans`), and plan-to-drawing relationships (`planDrawingIds`)—into the database payload under `_trawangan_meta`.
   - On workspace or symbol transitions, guarantee atomic flushing (`await flushDrawings()`) without debounce delay.
   - Attach a window `beforeunload` lifecycle hook ensuring in-flight drawings flush prior to process termination.
   - In `restoreDrawings`, properly clear previous plan state from memory, load workspace-scoped data, reconstruct the bidirectional `drawingPlanMap`, and provide backward compatibility fallbacks for legacy non-prefixed records.
   - When initializing a new workspace, execute a clean slate reset (`clearCanvasVisuals` and `clearAllPlans`).
   - Trigger drawing restoration reactively whenever the active `workspaceId` changes, even if the active symbol remains unchanged.

2. **Expanded Settings Modal & Modular Typography Taxonomy**:
   - Enlarge the settings container to `920px` width (max `94vw`) and `82vh` height (min `520px`), expanding the tab navigation sidebar to `210px`.
   - Separate concerns into distinct, focused domains:
     - **General (`GeneralTab`)**: Application language, default timeframe (`defaultTimeframe`), auto-save workspace (`autoSaveWorkspace`), and auto-load startup workspace (`autoLoadLastWorkspace`).
     - **Appearance (`AppearanceTab`)**: Color mode (System, Dark, Light), App-to-Chart theme sync toggle, Theme Preset Gallery, and Candlestick Studio.
     - **Typography (`TypographyTab`)**: Independent tab for UI sans-serif fonts, code/table monospace fonts, freeform font size scale slider/stepper with percentage indicators, UI density selection, and live real-scale preview box.
     - **Chart & Canvas (`ChartTab`)**: Canvas visual elements (crosshair, watermark, last price line) and direct grid mode controls, removing duplicated timeframe and workspace toggles.

3. **Isolate Theme Engine as Single Source of Truth**:
   - Disconnect the `chart.onThemeSelect` callback from mutating trawangan's theme state.
   - Hide the `canvas.theme` entry in the Vela settings dialog via `chart.setSettingsVisibility({ hidden: ['canvas.theme'] })`.
   - Guarantee unidirectional theme propagation from trawangan to WebGL2 canvas.

4. **Direct 3-Mode Grid Line Control**:
   - Introduce a structured `GridMode` contract (`'normal' | 'dimmed' | 'hidden'`) in `AppSettings`.
   - Provide a clean 3-option segmented control directly in `ChartTab`.
   - Wire grid mode directly to WebGL renderer cell options, controlling horizontal and vertical line visibility and alpha transparency without opening internal engine dialogs.

---

## User Stories

1. As a technical trader managing multiple market strategies, I want my chart drawings and trade setups to be scoped to my active workspace, so that scalping setups in my short-term workspace do not clutter or overwrite my swing-trading workspace on the same asset.
2. As a trader analyzing positions on Binance and Bitunix simultaneously, I want drawings on `binance:BTCUSDT` isolated from `bitunix:BTCUSDT.P`, so that exchange-specific liquidity levels remain accurate.
3. As an active analyst, I want entry price, stop-loss, and multi-stage target levels of my trading plans saved with full metadata in SQLite/localStorage, so that trade thesis parameters and risk-to-reward metrics remain fully intact across app restarts.
4. As a user closing or refreshing the terminal window, I want my pending drawings immediately flushed to persistent storage via a `beforeunload` listener, so that I never lose trade setups drawn seconds before closing.
5. As a trader creating a brand-new workspace, I want the canvas and active plan state cleared to a clean slate, so that drawings from my previous workspace do not leak into the new setup.
6. As a trader switching between two workspaces that happen to monitor the same active symbol, I want the drawings for the new workspace restored immediately, so that I see the correct drawings for that specific workspace context.
7. As an existing trawangan user upgrading from older versions, I want my legacy drawings saved under `provider:symbol` or `symbol` restored smoothly via a fallback mechanism in the default workspace, so that historical chart analyses are not lost.
8. As a trader customizing my workspace theme, I want the settings modal to have a spacious 920px × 82vh canvas with a 210px sidebar, so that navigating settings and inspecting color palettes feels comfortable rather than cramped.
9. As a trader tailoring chart readability, I want a dedicated "Tipografi & Teks" settings tab, so that I can configure UI fonts, numeric monospace fonts, and font scaling with a real-time preview without digging through color palettes.
10. As a trader adjusting overall terminal text size, I want both stepper increment buttons and a slider for font scaling with a percentage readout, so that I can fine-tune text readability effortlessly across high-DPI displays.
11. As a user reviewing appearance preferences, I want the Appearance tab dedicated exclusively to color mode, theme preset selection, and candlestick styling, so that the interface remains focused and uncluttered.
12. As a user managing workspace preferences, I want default timeframe and auto-save toggles located in the General tab, so that chart canvas preferences are strictly separated from app-level persistence settings.
13. As a user, I want the settings tabs to have no redundant duplicated controls between General and Chart settings, so that I am never confused about where a setting lives or which control is authoritative.
14. As a trader toggling between Dark and Light mode in trawangan, I want trawangan to remain the absolute single source of truth for all canvas and UI styling, so that internal WebGL engine callbacks never hijack or revert my theme choices.
15. As a user exploring the internal chart configuration dialog, I want the confusing internal `canvas.theme` selector hidden, so that I don't accidentally set conflicting canvas styles outside of trawangan's theme manager.
16. As a technical chartist who prefers a clean, distraction-free chart, I want to switch grid lines between Normal, Dimmed, and Hidden directly from trawangan's settings, so that I don't have to navigate deep internal engine menus to adjust line opacity.
17. As an analyst deleting a drawing anchor associated with an active trading plan, I want the corresponding plan and thesis card cleanly removed because the bidirectional mapping was properly restored, so that orphaned calculation state does not linger in memory.

---

## Implementation Decisions

- **Composite Key Structure**:
  - The persistence key resolves to `[workspaceId:providerId:symbol]` whenever a workspace context is provided.
  - When no workspace context exists or legacy callers query without workspace parameters, the key safely resolves to `[providerId:symbol]` for backward compatibility.
  - Case normalization enforces lowercase for workspace and provider tokens and uppercase for symbol tokens.

- **Metadata Payload Structure**:
  - The drawing document envelope encapsulates `_trawangan_meta` containing:
    ```ts
    {
      drawingMetadata: Record<string, unknown>;
      activePlans: Array<ParsedTradingPlan & { id: string }>;
      planDrawingIds: Array<[string, string[]]>;
      timestamp: number;
    }
    ```
  - Upon restoration, `activePlans`, `drawingMetadata`, and `planDrawingIds` are populated, and the reverse lookup map `drawingPlanMap` (`drawingId -> planId`) is fully reconstructed. Prior to loading, existing in-memory plan stores are cleared.

- **Storage Flush Synchronization**:
  - Context transition functions (`handleSymbolChange`, `handleProviderChange`, `handleLoadWorkspace`, `handleNewWorkspace`) await `flushDrawings()` to guarantee atomic writes.
  - Window `beforeunload` triggers synchronous-equivalent flush operations before unmount.

- **Settings Taxonomy Separation**:
  - `GeneralTab`: Houses application language, default timeframe (`defaultTimeframe`), auto-save workspace (`autoSaveWorkspace`), and startup auto-load (`autoLoadLastWorkspace`).
  - `AppearanceTab`: Houses Dark/Light mode preference, chart-to-app theme sync toggle, theme preset selector, and custom candlestick studio.
  - `TypographyTab`: Newly introduced component dedicated to UI fonts, monospace fonts, font scale slider & steppers, UI density selection, and live sample box.
  - `ChartTab`: Houses crosshair style, symbol watermark toggle, current price line toggle, and the 3-mode grid selector. Duplicated timeframe and workspace persistence controls are completely purged from this tab.
  - `SettingsModal`: Container geometry updated to `920px` width, `82vh` max height, `520px` min height, and `210px` nav width.

- **Theme Decoupling Architecture**:
  - Disconnect `chart.onThemeSelect` listener in session controller.
  - Invoke `chart.setSettingsVisibility({ hidden: ['canvas.theme'] })` on all cell instances.
  - Define `GridMode` as `'normal' | 'dimmed' | 'hidden'`, dynamically deriving WebGL grid line properties (line visibility and opacity) during theme application.

---

## Testing Decisions

- **What makes a good test**: Tests must verify external observable behavior (persistence across reloads, isolation between workspaces, theme isolation, accurate DOM dimensions and tab count) without asserting private implementation details.
- **Modules to test**:
  - `ChartDrawingController` & persistence adapter: composite key resolution, metadata payload enrichment, bidirectional plan mapping reconstruction on restore, backward-compatibility legacy key fallback, and workspace-to-workspace drawing isolation.
  - `ChartSessionController`: grid mode evaluation, theme isolation, and hidden settings visibility.
  - `SettingsModal` & Tab components: verification of 9 distinct tabs, modal dimensions (920px × 82vh), presence of grid mode segmented buttons in `ChartTab`, and absence of redundant duplicated controls.
- **Prior Art**:
  - `tests/exchangeAwareDrawing.test.ts`
  - `tests/drawingContextPreservation.test.ts`
  - `tests/settingsModal.test.ts`
  - `tests/workspaceDrawingAndGridDecoupling.test.ts`

---

## Out of Scope

- Cloud synchronizing drawings across separate user machines (all data remains 100% offline-first in local SQLite/localStorage).
- Custom RGB color pickers for individual grid lines (grid lines follow theme palette luminance with normal/dimmed/hidden modes).
- User-authored font uploads via `.ttf` files (system font picker and curated web-safe options remain the supported mechanism).

---

## Further Notes

- This specification synthesizes the architectural decisions agreed upon during the interactive grilling session, resolves all issues raised in the two-axis code review, and solidifies the foundation for future advanced trading plan tools.
