# 02: Modularize SettingsModal into Focused Section Submodules

**GitHub Issue:** [#9](https://github.com/KaleksananBarqi/trawangan/issues/9)

**What to build:**
Decompose the monolithic 3,870-line `SettingsModal.svelte` into a lightweight coordinating modal shell and dedicated tab section submodules under `src/lib/components/settings/`.
From the user's perspective:
- The Settings modal dialog (`Ctrl + ,` or top menu) continues to offer all terminal configuration tabs (General, Appearance, Chart, Data Feed, System & Performance, About / Release, and Shortcuts Help) with identical appearance, Obsidian precision design, and zero visual regression.
- Modifying settings in any tab updates preferences instantly, saves to `localStorage` and SQLite, and provides fluid tab navigation.
- Code maintainability and AI navigability improve drastically by splitting 2,200+ lines of scoped CSS and 7 separate domain controllers into self-contained submodules (<300 lines each), following the proven pattern from Header submodules.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Create dedicated submodules under `src/lib/components/settings/`:
  - `GeneralTab.svelte`: Default timeframe, notification sounds, Windows system alerts, workspace auto-save.
  - `AppearanceTab.svelte`: Theme presets, UI font, mono code font, UI density, custom font size stepper.
  - `ChartTab.svelte`: Watermark, current price line, price scale labels toggle, factory reset.
  - `FeedTab.svelte`: Exchange provider selection, latency display, ping status.
  - `SystemTab.svelte`: Telemetry indicators, RAM usage, cache clearance.
  - `AboutTab.svelte`: Application version info, GitHub release link, in-app update checker.
  - `HelpTab.svelte`: Integrated shortcut helper search.
- [x] Reduce `SettingsModal.svelte` from 3,870 lines to a slim coordinating shell (<250 lines) managing tab selection, modal backdrop, header/footer, and event propagation.
- [x] Localize CSS styling to each respective tab submodule rather than bundled in one giant block.
- [x] Ensure zero regression in setting persistence (`AppSettings`), reactive DOM root theming, or multi-chart sync config toggles.
- [x] Verify all test suites pass (`npm test`) and type-checking succeeds (`npm run check` with 0 errors).
