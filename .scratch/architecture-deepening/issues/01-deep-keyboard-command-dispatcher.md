# 01: Deep Keyboard Command Dispatcher & Unified Shortcut Registry

**GitHub Issue:** [#8](https://github.com/KaleksananBarqi/trawangan/issues/8)

**What to build:**
Unify shortcut definitions and physical keyboard dispatch into a deep `CommandDispatcher` module that serves as the single source of truth across the terminal.
From the user's perspective:
- All global keyboard shortcuts (TradingView parity: Alt+W for Watchlist, Alt+T for Left Toolbar Rail / Drawing Tools, Alt+H/F/M/R for drawings, / and Ctrl+I for indicators, Ctrl+K for symbol search, F11 for fullscreen, Replay space/arrows) trigger reliably regardless of focus, while cleanly suppressing keystrokes when typing in search inputs, modal textboxes, or CodeMirror editor panes.
- The Shortcut Cheatsheet modal (`F1` or `?`) displays live, synchronized key combinations directly from the registry without documentation drift or conflicting key bindings.
- The root page (`+page.svelte`) is relieved of its 225-line imperative keydown handler, delegating physical keystroke events to the dispatcher through a single method call.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Implement deep `CommandDispatcher` module with an action registry mapping action IDs to physical key combinations, categories, descriptions, and handler callbacks.
- [x] Encapsulate physical keystroke normalization (Ctrl vs Cmd, key vs code, Windows physical layout) and input suppression (inputs, textareas, contenteditable, CodeMirror).
- [x] Connect `ShortcutCheatsheetModal.svelte` and `shortcutService.ts` to query commands directly from the dispatcher's registry, resolving documentation drift and the Alt+T conflict.
- [x] Replace monolithic 225-line `handleKeyDown` in `src/routes/+page.svelte` with clean registration of action callbacks and a single delegating event dispatch call.
- [x] Add unit tests verifying keystroke parsing, modifier combinations, input suppression, and action dispatching without DOM fixtures.
- [x] Verify all tests pass (`npm test`) and type-checking succeeds (`npm run check` with 0 errors).
