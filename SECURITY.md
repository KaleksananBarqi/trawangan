# Security Policy

## Supported Versions

Only the latest minor release series of **trawangan** actively receives security patches.

| Version | Supported |
| ------- | ------------------ |
| `0.58.x` (Latest Release) | :white_check_mark: |
| `< 0.58.0` | :x: |

Please update to the [latest release](https://github.com/KaleksananBarqi/trawangan/releases/latest) before reporting an issue.

---

## Reporting a Vulnerability

**Do NOT open a public GitHub Issue for security vulnerabilities.**

Please report security vulnerabilities privately through **GitHub Private Vulnerability Reporting**:

👉 **[Report a Vulnerability via GitHub Security Advisories](https://github.com/KaleksananBarqi/trawangan/security/advisories/new)**

### What to Include

To help reproduce and fix the issue quickly, please include:

* Affected `trawangan` version and operating system (Linux, Windows, or macOS)
* Component or area affected
* Clear step-by-step reproduction instructions or a minimal Proof of Concept (PoC)
* Potential security impact

### Response Timeline

`trawangan` is maintained independently. You can expect a **best-effort acknowledgement within 72 hours**, followed by investigation, coordinated remediation, and disclosure once a fix is released.

---

## Security Scope

### In Scope

We prioritize security reports affecting the following components of `trawangan`:

* **Opt-In Execution Bridge Credentials & Signing:** Handling, storage, or leakage of API keys/secrets and request signing logic (`HMAC-SHA256` for Binance, `SHA256` for Bitunix).
* **Local MT5 CFD Bridge (`127.0.0.1:15555`):** Request validation, origin/CSRF exposure, or unintended local/remote access via `TrawanganMT5Bridge.mq5` and the Rust bridge client.
* **Pine Script v6 Execution (`PineTS` Web Worker):** Sandbox escapes, arbitrary code execution outside the Web Worker boundary, or XSS via script output/labels.
* **Tauri v2 Runtime, IPC & Auto-Updater:** Command privilege escalation, capability/permission bypasses, deep-link injection, or updater integrity issues (`tauri-plugin-updater`).
* **Local SQLite Storage (`rusqlite`) & Trade Plan Vault:** SQL injection, unsafe deserialization, or local data corruption/exposure.

### Out of Scope

* Financial or trading losses resulting from market volatility, user strategy decisions, indicator interpretation, or manual order execution.
* Vulnerabilities in third-party exchanges, brokers, or upstream public APIs (Binance, Indodax, Bitunix, Hyperliquid, Coinbase, Yahoo Finance, CoinGecko, DefiLlama, Fair Economy). Please report those directly to the respective provider.
* Issues reproducible only on unsupported older versions (`< 0.58.0`) or third-party modified forks.

---

## Disclosure Process

Once a vulnerability report is confirmed, we will work on a fix privately via the GitHub Security Advisory workspace, publish a patched release, and coordinate public credit (if desired by the reporter) after users have had a reasonable window to upgrade.
