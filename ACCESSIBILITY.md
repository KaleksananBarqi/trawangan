# Accessibility Statement

## Commitment

**trawangan** aims to be a fast, ergonomic, and inclusive desktop charting terminal across Linux, Windows, and macOS. We continuously work to improve keyboard operability, visual contrast, and screen-reader semantics across the application shell.

---

## Current Accessibility Support

### 1. Keyboard Navigation & Shortcuts

`trawangan` supports a keyboard-first workflow for core terminal navigation:

* `Ctrl + K` (or typing letters directly): Open the multi-asset Symbol Search modal.
* Numeric keys (`1`, `15`, `240`, etc.): Rapid timeframe switching.
* `Ctrl + Shift + P`: Open the docked `Plan` tab (`Preview`, `Form`, `Teks`, `Riwayat`).
* `Ctrl + Enter` / `Ctrl + V`: Submit Trade Plan edits or paste Markdown plans directly.
* `Alt + W` / `Alt + O` / `Alt + E`: Toggle Watchlist, Object Tree, and Pine Script v6 IDE panels.
* `Alt + A`: Create a quick Price Alert at the current cursor price.
* `Shift + R`: Enter/exit Bar Replay simulation (`Space` to play/pause).
* `F1` or `?`: Open the Keyboard Shortcuts & Help Center.

### 2. Visual Contrast, Themes & Typography

* **37 Built-In Theme Presets:** Includes dark, light, and high-contrast variants (31 Javanese cultural presets + Warta Abang) to accommodate varied visual needs and lighting conditions.
* **Density & Typography Controls:** Users can customize UI density and typography settings inside Settings (`TypographyTab`). Numeric price axes, R-multiples, and telemetry use tabular monospaced figures (**JetBrains Mono**) paired with **Plus Jakarta Sans** for UI text.

### 3. Semantic HTML & ARIA Attributes

Interactive shell components use semantic ARIA roles and labels where applicable, including:

* Modal dialogs (`role="dialog"`, `aria-modal="true"`)
* Validation and replay error notifications (`role="alert"`)
* Tab strips (`role="tablist"`, `role="tab"`, `aria-selected`)
* Menus and checkboxes (`role="menu"`, `role="menuitem"`, `role="menuitemcheckbox"`)
* Radio groups (`role="radiogroup"`) and descriptive `aria-label` attributes on icon buttons and sliders

### 4. Multilingual Support & Onboarding

* Built-in localization in **Basa Jawa Arekan**, **Bahasa Indonesia**, and **English**.
* Interactive **Startup Spotlight Tour** to guide new users through core controls and shortcuts.

---

## Known Limitations

We want to be transparent about areas where accessibility is currently limited:

* **WebGL2 Charting Canvas:** The primary candlestick and drawing canvas (powered by LuxAlgo Vela WebGL2) is rendered graphically on an HTML5 `<canvas>`. Direct screen-reader traversal of individual candlesticks, order blocks, or drawn overlays on the canvas is currently limited.
* **Pointer-Based Gesture Drawing:** *Draw by Holding* (`Shift + D` / `~`) and *Scribble Erase* rely on pointer/mouse movement. Core navigation, symbol switching, alerts, and Trade Plan entry (via `Form` or Markdown paste) remain usable via keyboard.

---

## Reporting Accessibility Barriers

If you encounter an accessibility barrier—such as missing keyboard focus, insufficient contrast in a theme preset, unlabeled controls, or screen-reader issues—please report it using our dedicated template:

👉 **[Open an Accessibility Barrier Report](https://github.com/KaleksananBarqi/trawangan/issues/new?template=accessibility_report.yml)**

Reports are automatically tagged with `accessibility` and `needs-triage`, and may be written in **English** or **Bahasa Indonesia**.
