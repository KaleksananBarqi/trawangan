# Contributing to trawangan

Thank you for your interest in contributing to **trawangan** (`ꦠꦿꦮꦔꦤ꧀`), a native desktop multi-asset and crypto charting terminal built with **Tauri v2 (Rust Core)**, **Svelte 5 (Runes)**, **LuxAlgo Vela (WebGL2)**, and **PineTS v6**.

> **Language Note:** Repository governance docs are in English, while Issues, bug reports, and Pull Request descriptions written in **English** or **Bahasa Indonesia** are equally welcome.

---

## Contribution Model (Guided Open)

To keep the codebase lightweight, focused, and aligned with architectural decisions:

* **Direct Pull Requests Allowed:** Small bug fixes, typo corrections, test additions, accessibility improvements, and documentation updates may be submitted directly via a Pull Request.
* **Issue First Required:** New features, new exchange/data-source integrations, UI paradigm shifts, or architectural changes **must** start with a GitHub Issue (using the appropriate Issue Form) to align with the maintainer before writing code.
* **Architecture & Domain Context:** Before proposing or implementing changes, review existing Architectural Decision Records in [`docs/adr/`](docs/adr/) and domain terminology in [`GLOSSARY.md`](GLOSSARY.md).

---

## Project Guardrails (Non-Negotiable)

All contributions must strictly respect these core principles:

1. **Zero Paywall:** Never introduce paywalled features, subscription gates, artificial indicator/chart limits, or user-tracking telemetry.
2. **Charting-First & Opt-In Execution Bridge (`ADR-0031`):** `trawangan` operates as a pure charting and research terminal by default. The Opt-In Execution Bridge (Binance, Bitunix, Local MT5 CFD) **must** remain opt-in, default OFF, and strictly decoupled from Trade Plans (manual order entry only).
3. **Licensing & Mandatory Attribution (`Apache-2.0` + `NOTICE`):**
   * Preserve [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE), including mandatory attribution to `trawangan` and upstream engines such as **LuxAlgo Vela** (`Apache-2.0 + NOTICE`).
   * Be mindful of license compatibility when adding dependencies (e.g., `PineTS` uses `AGPL-3.0-only`). Do not introduce incompatible proprietary dependencies.

---

## Local Development Setup

### Prerequisites

* **Node.js** (LTS) and **npm**
* **Rust toolchain** (`rustup`, `cargo`, `rustc`)
* **Tauri v2 system dependencies** for your OS (see the [Tauri Prerequisites Guide](https://v2.tauri.app/start/prerequisites/))

### Getting Started

```bash
git clone https://github.com/KaleksananBarqi/trawangan.git
cd trawangan
npm ci
npm run tauri dev
```

For production desktop builds:

```bash
npm run tauri build
```

---

## Verification Before Opening a PR

Before submitting any Pull Request, run the following checks locally and verify they pass cleanly:

```bash
# 1. Svelte & TypeScript type checking
npm run check

# 2. Unit & integration tests
npm test
```

If your changes touch any Rust or Tauri code inside `src-tauri/`, you must also verify:

```bash
cd src-tauri && cargo check
```

---

## Commit & Pull Request Conventions

* **Conventional Commits:** Prefix commit messages and PR titles cleanly, for example:
  * `feat(watchlist): add custom sorting`
  * `fix(chart): resolve timeframe cycle wrap`
  * `docs(readme): update shortcut table`
  * `refactor(plan): extract dual-entry parser`
  * `test(replay): cover scrubber edge cases`
  * `chore(deps): bump patch dependencies`
* **Link Issues:** Reference the related issue in your PR description using `Closes #123` or `Fixes #123`.
* **Focused PRs:** Keep Pull Requests small and scoped to one concern. For UI changes, attach screenshots or short screen recordings in the PR body.

---

## AI-Assisted Contributions Policy

You are welcome to use AI coding assistants when preparing contributions, provided that:

1. You disclose AI assistance in the **Pull Request Template** checklist.
2. You have personally reviewed, understood, and verified every line of code in the diff.
3. All local checks (`npm run check`, `npm test`, and `cargo check` when applicable) pass before submission.

Unreviewed, broken, or spammy AI-generated Pull Requests will be closed without review.

---

## Related Community Standards

* [Code of Conduct](CODE_OF_CONDUCT.md) — Community behavior standards and crypto anti-spam rules
* [Security Policy](SECURITY.md) — Private vulnerability reporting guidelines
* [Accessibility Statement](ACCESSIBILITY.md) — Current support, limitations, and barrier reporting
