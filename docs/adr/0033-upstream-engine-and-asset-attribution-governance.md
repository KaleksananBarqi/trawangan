# 0033. Upstream Engine, Open-Source Library, and Multi-Asset Visual Attribution Governance

## Status
Diterima (*Accepted*), 25 November 2026.

## Konteks
`trawangan` dibangun di atas ekosistem perangkat lunak bebas dan aset terbuka lintas domain:
1. **Engine Charting & Scripting:** `@luxalgo/vela` (`Apache-2.0` dengan berkas `NOTICE` wajib yang mengharuskan tampilan atribusi Vela yang terlihat pada aplikasi yang menampilkan chart), `pinets` dan `@luxalgo/vela-pinets` (`AGPL-3.0-only`), serta `acorn` / `acorn-walk` / `astring` (`MIT`).
2. **Runtime Native, Database & Antarmuka:** `Tauri v2` (`Apache-2.0 / MIT`), `Rust Core` & ekosistem crate (`tokio`, `reqwest`, `serde`, `sha2`, `chrono`, `rfd`), `SQLite` / `rusqlite` (`Public Domain / MIT`), `Svelte 5` & `Vite` (`MIT`), serta `CodeMirror 6` (`MIT`).
3. **Aset Visual, Ikonografi & Tipografi:** `Lucide Icons` (`ISC / MIT`), `Web3Icons` (`@0xa3k5/web3icons`, `MIT`), `SpotHQ Cryptocurrency Icons` (`MIT / CC0`), `HatScripts Circle Flags` (`MIT`), `MrChartist Global Stock Logos`, `davidepalazzo/ticker-logos`, `nvstly/icons`, `ShaadyEmad/ticker-logos`, ikon favicon domain resmi emiten IDX, tipografi `Plus Jakarta Sans` (Tokotype, `OFL-1.1`) & `JetBrains Mono` (`OFL-1.1`), serta aset vektor orisinal `trawangan` (`Apache-2.0`).
4. **Sumber Data Pasar, Makro & Kalender Publik:** Koneksi langsung ke Binance, Indodax, Bitunix, Hyperliquid, Coinbase Exchange, Yahoo Finance, CoinGecko Public API, DefiLlama Stablecoins API, dan Fair Economy / ForexFactory Weekly Calendar.

Sebelumnya, berkas `NOTICE` baru mencantumkan hak cipta `trawangan` tanpa menyertakan `NOTICE` wajib dari `@luxalgo/vela` maupun daftar lengkap lisensi upstream, dan antarmuka `AboutTab.svelte`, README 3 bahasa, serta landing page (`docs/index.html`) belum menyajikan peta atribusi terpadu untuk seluruh aset dan sumber data tersebut.

## Keputusan Arsitektur

1. **Registri Tunggal Terpusat (`Upstream Attribution Ledger`)**:
   - Menetapkan `src/lib/constants/attributions.ts` (`UPSTREAM_ATTRIBUTION_LEDGER`) sebagai sumber kebenaran tunggal bertipe ketat untuk seluruh atribusi yang dibagi ke dalam 4 kategori: `engines`, `assets`, `typography`, dan `data_sources`, lengkap dengan metadata paket/cakupan, pembuat, lisensi, URL resmi, dan peran terlokalisasi 3 bahasa (`jv`, `id`, `en`).
2. **Kepatuhan Penuh Berkas `NOTICE` (Klausul 4d Apache-2.0)**:
   - Berkas `NOTICE` di root repositori wajib memuat: (a) *Mandatory Attribution Notice* milik `trawangan` (`Kaleksanan Barqi Aji Massani`), (b) teks `NOTICE` resmi dari `@luxalgo/vela` (LuxAlgo), dan (c) daftar atribusi serta pengungkapan lisensi untuk `PineTS` (`AGPL-3.0-only`), runtime Rust/Tauri, UI/editor, repositori aset visual, tipografi `OFL-1.1`, dan sumber data publik.
3. **Empat Permukaan Atribusi Wajib yang Sinkron**:
   - **Antarmuka Aplikasi (`AboutTab.svelte`):** Menu *Setelan -> Tentang & Lisensi* wajib merender seluruh entri `UPSTREAM_ATTRIBUTION_LEDGER` dengan gaya *Neo-Quant Tonal Shell* (`ADR-0029`), lencana lisensi, tautan eksternal interaktif, dan dukungan 3 bahasa.
   - **Dokumentasi Repositori (`README.md`, `README.id.md`, `README.en.md`):** Ketiga berkas README resmi wajib memuat tabel atribusi lengkap untuk engine, pustaka, aset visual, tipografi, dan sumber data publik.
   - **Landing Page (`docs/index.html`, `docs/app.js`):** Menyediakan seksi khusus (`#atribusi`) yang dapat diakses dari navbar utama dan mendukung switcher bahasa `JV | ID | EN`.
   - **Sanggahan Merek Dagang (*Nominative Fair Use*):** Seluruh permukaan atribusi wajib menyatakan bahwa logo token kripto, logo emiten saham (IDX & AS), bendera, dan nama bursa tetap merupakan merek dagang pemilik masing-masing dan hanya digunakan untuk identifikasi instrumen analisis.
4. **Aturan Kontribusi & Guardrail Dependensi**:
   - Setiap penambahan paket npm, crate Cargo, paket ikon/aset baru, font, atau endpoint data publik baru di masa depan **wajib** didaftarkan pada `src/lib/constants/attributions.ts`, `NOTICE`, `AboutTab.svelte` (otomatis via ledger), ketiga README, dan `docs/index.html` sebelum PR diterima.

## Konsekuensi
- **Kepatuhan Hukum & Etika Open Source:** Menjamin kepatuhan penuh terhadap `Apache-2.0 Section 4(d)` (termasuk persyaratan visibilitas `Vela`), transparansi `AGPL-3.0-only` pada `PineTS`, dan pengakuan yang adil bagi seluruh kreator ikon serta penyedia font `OFL-1.1`.
- **Pemeliharaan Terstruktur:** Karena `AboutTab.svelte` membaca langsung dari `UPSTREAM_ATTRIBUTION_LEDGER`, pembaruan atau penambahan atribusi di UI aplikasi tidak lagi tersebar di banyak komponen.
