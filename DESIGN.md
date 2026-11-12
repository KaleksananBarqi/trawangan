# Design System: trawangan

> **penerawangan (ꦠꦿꦮꦔꦤ꧀): Presisi Cyber-Monochrome untuk Observasi Pasar Tanpa Paywall.**
> Dokumen ini menetapkan arah visual, token desain, hierarki permukaan, serta pagar batas anti-slop untuk seluruh antarmuka **trawangan**, baik pada aplikasi desktop native berbasis Tauri v2 (`src/`) maupun etalase web dan dokumentasi (`docs/`). Filosofi desainnya bertumpu pada keheningan visual: latar hitam arang matte (`#0F0F0F` / `#0E0E10`), candlestick Putih Tulang (`#F7F7F7`) vs Merah Muda Tajam (`#FF69B4`), penumpukan tonal hairline `1px`, dan disiplin satu aksen terfokus tanpa noise dekoratif.

**Atribut Arah & Dial (/antislop Reference Fields):**
- **Product Identity:** `trawangan` (selalu ditulis huruf kecil), terminal charting desktop multi-aset murni (**Pure Charting Scope**, tanpa fitur eksekusi order maupun dompet).
- **Default Preset Direction:** Signature Cyber-Monochrome (`#0F0F0F` + `#F7F7F7` Bull + `#FF69B4` Bear/Brand Accent).
- **Dial (Web Showcase / Landing & Docs):** `Dial: ENERGY 2 / RHYTHM 2 / MOTION 1`
- **Dial (Desktop Charting Cockpit):** `Dial: ENERGY 2 / RHYTHM 1 / MOTION 1`

---

## 1. Visual Theme & Atmosphere

Identitas visual **trawangan** lahir dari makna etimologis Jawa *penerawangan*: ketajaman melihat menembus kabut ilusi pasar. Alih-alih mengulang estetika retail trading konvensional yang dipenuhi hijau-merah neon menyilaukan, panel kaca mengambang, atau gradasi pelangi generik, **trawangan** menyingkirkan distraksi emosional dengan permukaan gelap matte berkejelasan tinggi dan sinyal warna biner yang berdisiplin.

Sistem ini menyatukan **dua permukaan kerja yang berbagi satu jiwa visual**:
1. **Desktop Terminal Shell (`src/`):** Kokpit kerja ultra-padat berbasis **Docked Structural Shell (ADR-0004)**. Fokus utama 100% diserahkan kepada kanvas WebGL2 (`@luxalgo/vela` 120 FPS), diapit bilah dock tepi (`40px` Header, `44px` Toolbar Kiri, `38px` Rail Kanan, `26px` StatusBar) tanpa panel mengambang yang menutupi lilin harga.
2. **Web Showcase & Documentation (`docs/`):** Halaman publik bergaya editorial gelap yang lega, merayakan kemampuan biner native melalui ritme seksi asimetris, perbandingan data kontras tinggi, dan tangkapan layar aplikasi nyata (`docs/assets/screenshots/`).

### Mood & Feeling

- **Desktop Terminal (`ENERGY 2 / RHYTHM 1 / MOTION 1`):** Tenang, mekanis, dingin secara objektif, namun sangat responsif terhadap kiblat keyboard (`Shift+D`, `Ctrl+K`, `Ctrl+Shift+P`). Transisi status berlangsung instan (`120ms - 180ms`) tanpa animasi dekoratif yang mengganggu pembacaan candlestick atau orderflow.
- **Web Showcase (`ENERGY 2 / RHYTHM 2 / MOTION 1`):** Tegas, berwibawa secara teknis, dan fokus. Setiap layar hanya menonjolkan satu titik perhatian utama (Primary Download CTA di atas lipatan, atau kartu *flagship* 2-kolom pada matriks fitur), dipisahkan oleh ruang kosong struktural yang luas (`84px` per seksi).

### Visual Character

- **Penolakan Hijau/Merah Retail Default:** Tema *Signature* memilih Putih Murni (`#F7F7F7`) untuk *Bullish* dan Hot Pink (`#FF69B4`) untuk *Bearish* demi memutus bias psikologis "untung vs rugi" konvensional menjadi pembacaan struktur harga yang netral.
- **Tonal Stacking Matte + Garis Hairline 1px:** Kedalaman antar-modul di terminal desktop dicapai lewat pergeseran luminansi abu-abu arang yang rapat (`#0F0F0F` -> `#141414` -> `#171717` -> `#1E1E1E`) dan pemisah `1px solid #222222`, bukan bayangan mengambang tebal atau efek kaca buram di semua tempat.
- **Satu Aksen Dominan Terkendali:** Hot Pink (`#FF69B4`) bertindak sebagai penanda fokus primer: tombol aksi utama (`Selesai`, `+ Pasang`, `+ Tambah ke Chart`, `.btn-cta-main`), timeframe aktif, indikator `:focus-visible` keyboard, serta garis kuotasi aktif.

### Design Rationale (R-31)

- **Kanvas Gelap `#0F0F0F` / `#0E0E10`:** Trader menatap grafik berjam-jam; latar arang matte meredam silau monitor sekaligus memberi rasio kontras maksimal bagi sumbu harga, teks monospasi, dan candlestick.
- **Dua Dial Berbeda di Satu Merek:** Terminal desktop menuntut prediktabilitas spasial maksimal (`RHYTHM 1`) agar memori otot tidak terganggu, sedangkan etalase web perlu pergeseran komposisi antar-seksi (`RHYTHM 2`) agar pembaca terus menyimak informasi teknis.

---

## 2. Color Palette & Roles

Palet inti **trawangan** mematuhi batasan ketat maksimal 2 hingga 3 warna peran fungsional di atas spektrum netral arang/kertas, serta diverifikasi menggunakan standar kontras **WCAG 2.1 AA** (`>= 4.5:1` teks normal, `>= 3.0:1` teks besar >=18px dan komponen UI).

### Signature Dark Foundation: Canvas & Surfaces

| Role | Name | Hex / Value | CSS Variable (`app` / `docs`) | Kegunaan |
| :--- | :--- | :--- | :--- | :--- |
| Primary App Canvas | Obsidian True Dark | `#0F0F0F` | `--bg-darkest`, `--bg-surface` | Latar kanvas chart WebGL2, StatusBar, Header |
| Primary Web Canvas | Deep Charcoal Ink | `#0E0E10` | `--bg-canvas` | Latar utama halaman landing & dokumentasi |
| Surface Level 1 | Terminal Base | `#121212` / `#141414` | `--bg-base`, `--bg-container` | Latar sidebar navigasi modal, badge hint, container rendah |
| Surface Level 2 (App) | Structural Panel Matte | `#171717` | `--bg-panel`, `--bg-secondary` | Kartu menu, panel pengaturan, Floating Thesis Card |
| Surface Level 2 (Web) | Editorial Surface Matte | `#151518` | `--bg-surface` | Kartu filosofi, wrapper tabel, viewport galeri, FAQ |
| Elevated Surface | Hover & Strip Layer | `#1E1E1E` / `#1C1C22` | `--bg-elevated` / `--bg-surface-elevated` | Header popover, kartu OS download, strip aksi |
| Interactive Hover | Graphite Hover | `#262626` / `#22222A` | `--bg-hover` / `--bg-surface-hover` | Status hover item watchlist, tombol dock, menu dropdown |
| Active / Selected | Charcoal Depressed | `#2E2E2E` | `--bg-active` | Tab atau item baris yang sedang terpilih |
| Header Glass Overlay | Translucent Header | `rgba(14, 14, 16, 0.92)` | `--bg-header` | Khusus `.site-header` web dengan `blur(16px)` (batas cap R-10) |

### Hairline Borders & Chart Grid

| Role | Name | Hex / Value | CSS Variable | Kegunaan |
| :--- | :--- | :--- | :--- | :--- |
| App 1px Divider | Hairline Charcoal | `#222222` | `--border-hairline` | Pemisah antarmuka dock `1px`, batas panel modal |
| App Subtle Border | Low Edge | `#202020` / `#2C2C2C` | `--border-subtle`, `--border-medium` | Pembatas sel internal dan input form |
| Interactive Edge | Drag / Hover Handle | `#383838` | `--border-bright` | Batas hover kontrol dan resizer panel |
| Web Subtle / Medium Border | White Alpha Hairline | `rgba(255,255,255,0.08)` / `0.14` | `--border-subtle`, `--border-medium` | Pembatas kartu web matte agar tetap presisi |
| WebGL Chart Grid | Subtle Grid Line | `rgba(255, 255, 255, 0.05)` | Chart Grid (Mode Redup/Normal) | Garis referensi sumbu tanpa menyaingi lilin |
| Focus Ring | Precision Focus | `#FF69B4` | `--border-focus`, `:focus-visible` | Outline fokus keyboard global (`2px solid`, offset `3px` di web) |

### Typography Colors (WCAG AA Verified)

Seluruh angka rasio di bawah terukur melalui `contrast-check.py`.

| Role | Name | Hex | Kontras Terhadap Canvas | Status WCAG AA | Aturan Pemakaian |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Primary Ink (App) | Ivory White | `#F7F7F7` | **17.89:1** (`#0F0F0F`), **16.73:1** (`#171717`) | PASS AAA | Angka harga, judul modal, teks utama, ikon aktif |
| Primary Ink (Web) | Pure Crisp White | `#F7F7F8` | **18.01:1** (`#0E0E10`) | PASS AAA | Hero H1, heading seksi, label utama tabel |
| Muted Ink (App) | Neutral Silver | `#A3A3A3` | **7.60:1** (`#0F0F0F`), **7.11:1** (`#171717`) | PASS AAA | Label form, tab tidak aktif, deskripsi sekunder |
| Muted Ink (Web) | Cool Slate Gray | `#B4B4C0` | **9.39:1** (`#0E0E10`) | PASS AAA | Paragraf hero, deskripsi fitur, jawaban FAQ |
| Dim Ink (Web / Target) | Muted Cool Slate | `#8E8EA0` | **5.99:1** (`#0E0E10`), **5.66:1** (`#151518`), **5.27:1** (`#1C1C22`) | PASS AA | Caption, metadata versi, placeholder, footer |
| Dim Ink Min (App Surface) | Mid Slate Minimum | `#808080` / `#8A8A8A` | `#808080`: **4.85:1** (`#0F0F0F`), **4.54:1** (`#171717`); `#8A8A8A`: **4.83:1** (`#1E1E1E`) | PASS AA | Target aman teks dim kecil pada panel aplikasi; gunakan `#8A8A8A` bila di atas `#1E1E1E` |
| Legacy Dim Token (Guardrail) | Dark Ash (`--text-dim` lama) | `#737373` | **4.04:1** (`#0F0F0F`) | **FAIL normal (<18px)**, PASS large | Dilarang dipakai untuk teks informatif `<18px` di komponen baru (`theme.css` masih memakai `#737373` untuk unit/telemetri non-kritis; naikkan ke min `#808080`/`#8A8A8A` saat disentuh) |
| Disabled State | Muted Graphite | `#525252` | Sengaja rendah (<3:1) | Exempt (Disabled UI) | Hanya untuk teks placeholder tidak aktif / kontrol `disabled` |

### Signature Signals & Brand Accent (Maximum Restraint: 1 Accent)

| Role | Name | Hex / Value | CSS Variable | Rasio & Kegunaan |
| :--- | :--- | :--- | :--- | :--- |
| Brand Primary / Bear | Hot Pink Signature | `#FF69B4` | `--brand-primary`, `--bear-color`, `--accent-pink` | **7.24:1** (`#0F0F0F`), **7.28:1** (`#0E0E10`), **6.77:1** (`#171717`). CTA primer, lilin bearish & sumbu, tab aktif, timeframe terpilih, badge versi |
| Ink on Brand Accent | Obsidian Ink | `#0F0F0F` / `#0E0E10` | `--on-brand-primary`, `--on-bear-color` | **7.24:1** / **7.28:1** di atas `#FF69B4`. Wajib dipakai untuk teks tombol primer berwarna pink |
| Hot Pink Hover | Softened Blossom | `#FF85C4` | `--accent-pink-hover` | Hover tombol CTA di etalase web |
| Bear Candle Border | Deep Rose Edge | `#CC5A7F` / `#D81B60` | `borderDownColor`, `--bear-fill` | Batas luar lilin bearish agar kontur tetap tegas saat berdampingan |
| Bull Signal | Signature Ivory Bull | `#F7F7F7` / `#E5E5E5` | `--bull-color`, `--bull-fill` | **17.89:1** (`#0F0F0F`). Lilin bullish & delta positif di Watchlist / header quote |
| Soft Pink Tint & Edge | Accent Wash | `rgba(255,105,180,0.12)` / `0.35` | `--accent-pink-soft`, `--accent-pink-border` | Latar tipis badge versi, header kolom unggulan tabel, fokus aktif |

### Semantic, Telemetry & Exchange Tokens

Warna sekunder dibatasi ketat untuk status operasional nyata, bukan dekorasi:

| Role | Color Hex | Kontras di `#0F0F0F` | Pemakaian |
| :--- | :--- | :--- | :--- |
| Auxiliary Info / Indikator | `#38BDF8` (`--brand-cyan`) | **8.95:1** (PASS AAA) | Tombol **Indikator**, tab aktif panel dock Watchlist/Alerts, feed badge `BITUNIX` |
| Warning / Favorite / Delay | `#FBBF24` / `#F59E0B` | **11.48:1** (`#FBBF24`) | Ikon bintang Watchlist aktif, status `DELAYED 15M` Yahoo Finance, feed `BINANCE` (`#F3BA2F`), tombol `Buy Me Coffee` |
| Market Session Open / Live | `#22C55E` | **8.41:1** (PASS AAA) | Hanya untuk indikator sesi bursa buka (`TYO`, `LON`, `NY`) dan ping/FPS sehat di StatusBar |
| Danger / Critical Drop | `#FF4466` | **5.72:1** (PASS AA) | Status error feed terputus, hapus data, validasi gagal, FPS kritis |
| Indodax Feed Badge | `#60A5FA` | **7.54:1** (PASS AAA) | Lencana provider `INDODAX` IDR |

### Dual-Theme & Multi-Preset Architecture (37 Official Presets, ADR-0017 / ADR-0022)

Selain *Signature*, terminal desktop mendukung **37 preset resmi (18 gelap, 19 terang)** plus palet kustom 9D tak terbatas dengan pemisahan total antara **Tema Aplikasi (`appThemePreset`)** dan **Tema Kanvas Chart (`chartThemePreset`)**, serta *Chart Mode Preset Memory*. Agar aturan kontras `R-25` dan `R-34` terjaga di seluruh tema termasuk mode terang:
- **Adaptive On-Color Tokens (`themeEngine.ts`):** Sistem menghitung otomatis warna teks kontras tinggi untuk tombol/badge aksen dan lilin melalui token `--on-brand-primary`, `--on-bull-color`, `--on-bear-color`, dan `--bull-text` (sehingga tidak ada teks putih di atas kuning terang atau teks hitam di atas burgundy pekat).
- **Light Theme Reference (`red_folder` / Warta Abang):**
  - Latar Kertas Hangat: `#EAEAE5` (`--bg-darkest`)
  - Tinta Primer & Bear Candle (Burgundy Peplum): `#4E1112` (kontras **12.31:1** di `#EAEAE5`, PASS AAA)
  - Aksen Primer & Bull Candle (Crimson Editorial): `#941B1E` (kontras **7.15:1** di `#EAEAE5`, PASS AA)
  - Tinta Sekunder: `#7A4C4C` (kontras **5.87:1** di `#EAEAE5`, PASS AA)
  - Teks di atas Brand/Bear: `#FFFFFF` (`--on-brand-primary`, `--on-bear-color`)
- **31 Preset Bernuansa Budaya Jawa:** Antara lain `Ngrembaka`, `Kopi Tubruk`, `Samodra Wengi`, `Lembayung Awan` (`#E2E2F7` / `#46047B`), `Ayem Tentrem` (`#161719` / `#D8F8F9`), `Banyu Segara`, `Kopi Klotok`, hingga `Wates Dhuwur` (`#151517` monokrom abu). Seluruh preset dibangun deterministik via `createBuiltInPreset` dan `ensureReadableTextColor`.

### Color Restraint Rationale (R-31)

- **Mengapa Putih `#F7F7F7` + Hot Pink `#FF69B4`:** Membedakan karakter **trawangan** dalam satu detik dari terminal clone TradingView/Binance, sambil menjaga luminansi tinggi tanpa kejenuhan RGB primer yang melelahkan retina.

---

## 3. Typography Rules

Sistem tipografi memisahkan **suara merek & navigasi** dari **presisi angka finansial**: huruf humanis geometris untuk kejelasan UI, dipasangkan secara ketat dengan huruf monospasi berangka sejajar (`tabular-nums`) untuk harga, persentase, timestamp, dan kode Pine Script.

### Font Families

```css
/* Brand Wordmark & UI Navigasi */
--font-brand: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-ui: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;

/* Angka Finansial, Telemetri & Pine Script v6 (Wajib tabular-nums via .mono-nums) */
--font-code: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

- **Pilihan Kustomisasi Resmi di Pengaturan (`TypographyTab.svelte`):**
  - UI Sans: `Plus Jakarta Sans` (default), `Inter`, `Roboto`, atau `System`.
  - Monospace Data & Kode: `JetBrains Mono` (default), `Fira Code`, atau `Consolas`.
- **Aturan Penulisan Wordmark:** Nama **`trawangan`** di Header, Landing Navbar, dan Logo selalu tampil dalam huruf kecil (`text-transform: lowercase`), bobot `800` (ExtraBold), dengan tracking rapat `-0.02em` (app) hingga `-0.04em` (web). Aksara Jawa `ꦠꦿꦮꦔꦤ꧀` dipakai sebagai penanda etimologis pada tag filosofi dan footer, tanpa tracking berlebihan.

### Type Scale 1: Desktop Terminal Cockpit (`src/styles/theme.css`)

Diukur dari `--base-font-size: 12px` dikalikan `--font-scale` (Preset kerapatan: **Compact** `11px`, **Regular** `12px`, **Comfortable** `13.5px`; rentang kustom `9px - 20px` untuk monitor 1080p hingga 4K).

| Element / Role | CSS Token | Effective Size (at 1x) | Weight | Tracking / Props | Konteks Pemakaian |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Modal & Section Heading | `--font-size-xl` | `14px` (`1.17x`) | `600 - 700` | `-0.01em` | Judul modal Settings/Indikator |
| Brand Title / Major Label | `--font-size-lg` | `12.5px - 13px` | `700 - 800` | `-0.02em`, lowercase | Brand `trawangan`, judul kartu tema/tab aktif |
| Body / Symbol & Control | `--font-size-md` | `12px` (`--base-font-size`) | `500 - 700` | `0.02em` untuk simbol | Nama ticker (`ETHUSDT.P`), tab modal, input form |
| Dense List / Watchlist Row | `--font-size-base` | `11px` | `400 - 600` | `tabular-nums` (`.mono-nums`) | Baris harga Watchlist, button header, isi panel |
| Telemetry / StatusBar / Keys | `--font-size-sm` | `10px` | `500 - 700` | `--font-code`, `tabular-nums` | `62 FPS`, `RAM: 45.0MB`, jam bursa, tombol `Terminal Logs` |
| Micro Badge / Pill Header | `--font-size-xs` | `9px` | `700` | `0.03em - 0.05em`, uppercase | `BITUNIX`, `DARK`/`LIGHT`, `Ctrl+K`, header kolom |
| Ultra-Compact Counter | `--font-size-2xs` | `8.5px` | `700` | `0.04em` | `DELAYED 15M`, count badge di dock rail (`13px` tinggi) |

### Type Scale 2: Web Showcase & Documentation (`docs/style.css`)

Skala editorial responsif untuk keterbacaan jarak jauh dan komposisi naratif.

| Element | Size | Weight | Line Height | Tracking | Konteks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Hero H1 Display | `clamp(2.4rem, 5.5vw, 4.2rem)` (`34px` <= 768px) | `800` | `1.15` | `-0.04em` | Headline hero utama landing page |
| Section Title (H2) | `clamp(1.9rem, 3.8vw, 2.6rem)` | `800` | `1.2` | `-0.03em` | Judul setiap seksi landing |
| Stat Highlight Number | `1.85rem` (`29.6px`) | `800` | `1.15` | `-0.02em`, `--font-mono` | Ribbon metrik kunci (`120 FPS`, `0 Rp/bln`) |
| Brand Wordmark (Web) | `1.35rem` (`21.6px`) | `800` | `1` | `-0.04em` | Teks logo `.brand-name` navbar |
| Feature Title (H3) | `1.15rem` (`18.4px`) | `700` | `1.3` | `-0.01em` | Judul kartu fitur flagship & standar |
| Hero / Section Lead | `1.05rem - 1.12rem` | `400 - 500` | `1.65 - 1.7` | `0` | Subjudul pengantar seksi & filosofi |
| Body Copy | `0.94rem - 1rem` (`15px - 16px`) | `400` | `1.6 - 1.65` | `0` | Deskripsi fitur, jawaban FAQ |
| Technical KBD / Code Pill | `0.82rem` (`13.1px`) | `700` | `1.2` | `0`, `--font-mono` | Keycap `<kbd>` pintasan & tag versi |
| Section Kicker | `0.8rem` (`12.8px`) | `700` | `1.2` | `0.08em`, uppercase | Label konteks ringkas di atas H2 (`R-06` terbatas pada kicker pendek, bukan headline besar) |

### Typography Philosophy & Rationale (R-31)

- **Mengapa `Plus Jakarta Sans` + `JetBrains Mono`:** `Plus Jakarta Sans` memberi bentuk huruf geometris bersih berkarakter lokal yang tajam pada bobot 700/800 untuk lowercase `trawangan`, sementara `JetBrains Mono` dengan `font-variant-numeric: tabular-nums` mencegah kolom harga Watchlist dan sumbu harga bergetar (*horizontal jitter*) saat tick real-time mengalir 120 FPS.
- **Anti-Slop Typographic Guardrail (`R-06`):** Jangan pernah memakai font monospasi berukuran raksasa sebagai judul hero, atau label uppercase berjarak huruf ekstrem (`HOW IT WORKS` dengan `0.25em` tracking) sebagai pengisi kosong. Monospace hanya dipakai untuk angka real-time, kode skrip, penanda versi, dan tombol pintasan `<kbd>`.

---

## 4. Component Stylings

Komponen di **trawangan** menggunakan pendekatan fungsional berjenjang: kontrol mekanis beradius micro-sharp (`2px - 6px`) di terminal desktop, dan hierarki radius bertingkat (`4px -> 8px -> 12px -> 16px`) di halaman web. Setiap komponen wajib menjaga `:focus-visible`, `cursor: pointer`, serta status hover/active/disabled yang nyata (`R-32`, `R-39`).

### Primary CTA & Action Buttons

1. **Web Primary Download CTA (`.btn-cta-main`):** Satu-satunya elemen berglow tetap di viewport (`R-13`).
   ```css
   .btn-cta-main {
     display: inline-flex;
     align-items: center;
     gap: 14px;
     min-height: 54px;
     padding: 0 32px;
     background: var(--accent-pink); /* #FF69B4 */
     color: #0E0E10;                  /* Kontras 7.28:1 */
     border-radius: 12px;             /* --radius-md */
     font-weight: 800;
     box-shadow: 0 8px 24px rgba(255, 105, 180, 0.28);
     cursor: pointer;
     transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
   }
   .btn-cta-main:hover {
     background: #FF85C4;
     transform: translateY(-2px);
     box-shadow: 0 12px 32px rgba(255, 105, 180, 0.42);
   }
   ```
2. **Desktop Terminal Primary Button (`.primary-btn`, e.g., `Selesai`, `+ Pasang`, `+ Tambah ke Chart`):** Padat tanpa glow berlebih, warna adaptif antar-tema.
   ```css
   .primary-btn {
     display: inline-flex;
     align-items: center;
     gap: 6px;
     padding: 6px 14px;
     background-color: var(--brand-primary);    /* #FF69B4 di Signature */
     color: var(--on-brand-primary, #0F0F0F);   /* Adaptif WCAG AA */
     font-weight: 600;
     font-size: var(--font-size-base, 11px);
     border-radius: var(--radius-xs, 2px);
     border: none;
     cursor: pointer;
   }
   ```
3. **Header & Rail Controls (Desktop):**
   - Header `.action-btn`: tinggi fix `26px`, `padding: 3px 7px`, `background: var(--bg-base)`, `border: 1px solid var(--border-hairline)`, `border-radius: 2px`.
   - Right Dock `.dock-btn`: `32px x 32px`, transparan default; kondisi aktif memakai latar `color-mix(in srgb, currentColor 14%, transparent)` dan bilah indikator vertikal kanan `2.5px` (`::before`).
4. **Secondary & Sub-Action Buttons (Web `.btn-github` / `.btn-sub-download`):** `min-height: 44px`, `border-radius: 8px`, latar `rgba(255,255,255,0.05)`, batas `1px solid rgba(255,255,255,0.08)`, tanpa panah dekoratif (`R-08`).

### Cards, Panels & Asymmetric Showcase Hierarchy

- **Desktop Structural Panels (`.obsidian-panel`, kartu indikator/tema di `indicator.png` & `theme.png`):**
  ```css
  .obsidian-panel {
    background-color: var(--bg-surface);       /* #0F0F0F / #171717 */
    border: 1px solid var(--border-hairline);  /* #222222 */
    border-radius: var(--radius-md, 4px);
  }
  ```
  Kartu preset tema menyertakan **4 swatch kotak tajam** (`LATAR`, `BULL`, `BEAR`, `AKSEN`) dengan border tipis agar warna latar yang mirip tetap terlihat batasnya, serta badge mode pojok kanan (`DARK` / `LIGHT`).
- **Web Asymmetric Feature Cards (`R-14`):**
  - *Flagship Card (`.feature-card.flagship`, span 2 kolom):* Gradasi gelap terukur (`linear-gradient(135deg, #18181D 0%, #131317 100%)`), border `rgba(255,105,180,0.35)`, padding `32px 36px`, grid horizontal `[48px icon] [rich technical description]`.
  - *Standard Card (`.feature-card`, grid 2 kolom):* Matte solid `#151518`, border `rgba(255,255,255,0.08)`, padding `26px 28px`, ikon vertikal di atas judul. Dilarang membuat seluruh grid seragam identik tanpa penekanan hierarki.
- **Chart-Dominant Floating Thesis Card (`generateChartThesisThemeTokens`):**
  Saat komponen melayang di atas kanvas grafik, warna panel diturunkan langsung dari `--chart-thesis-*` tema grafik aktif (94% solid surface + batas hairline kontekstual), sehingga kartu tesis selaras baik di latar gelap `#0F0F0F` maupun kertas *Warta Abang* `#EAEAE5`.

### Inputs, Search Bars & Focus Ring Architecture

- **Desktop Search & Modal Inputs (Search Simbol `Ctrl+K`, Pencarian Tema, Pencarian Indikator, Form Plan):**
  - Latar lebih dalam dari modal (`#0F0F0F` / `--bg-darkest`), border `1px solid var(--border-hairline)`, radius `2px - 4px`, ikon kaca pembesar di kiri.
  - Wajib memiliki state **Empty** (pesan informatif saat simbol/tema tidak ditemukan), **Loading** (status fetch/sync jelas), dan **Error** (pesan + tombol **Coba Ulang** pada stream feed terputus, memenuhi `R-27`).
- **Global Keyboard Focus Ring (`R-32`):**
  ```css
  /* Web Showcase */
  :focus-visible {
    outline: 2px solid var(--accent-pink);
    outline-offset: 3px;
  }

  /* Desktop Terminal Tight Controls (Rail & StatusBar) */
  .dock-btn:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: -1px;
  }
  ```
  Jangan pernah menyetel `outline: none` tanpa pengganti kontras tinggi yang jelas.

### Navigation & Structural Chrome

- **Desktop Top Header (`Header.svelte`):** Tinggi tetap `40px`, padding `0 10px`, border bawah `1px solid #222222`. Berisi urutan deterministik: Brand Badge (`logo` + `trawangan`) -> `divider` -> Symbol Search + Watchlist Star + Provider Pill (`BITUNIX` / `BINANCE` / `INDODAX` / `YAHOO` + `DELAYED 15M`) -> Quick Timeframes -> `spacer` -> Layout Workspace -> `Actions` -> `Indikator` -> `Snapshot` -> Theme Quick Cycle -> `Setting`.
- **Desktop Bottom StatusBar (`StatusBar.svelte`):** Tinggi `26px`, latar `#0F0F0F`, border atas `1px solid #222222`, font `--font-code` `10px`. Kiri: `FPS` badge (`62 FPS`), `Ping` (`278ms`), `RAM: 45.0MB`. Kanan: Jam Lokal (`WIB` + `UTC+7`), World Clocks (`TYO`, `LON`, `NY` dengan pip hijau/redup sesi pasar), `Buy Me Coffee`, dan `Terminal Logs [CTRL+\`]`.
- **Web Sticky Header (`.site-header`):** Tinggi `72px`, **satu-satunya elemen dengan efek kaca buram (`backdrop-filter: blur(16px)`)** di seluruh etalase web (`R-10`). Pada viewport `<= 768px`, link menu berubah menjadi drawer dengan toggle hamburger `44px x 44px` (`#nav-toggle`) yang mendukung tombol `Escape`.

### Badges, Keycaps & Semantic Labels (R-09 Caps)

- **Keycaps (`<kbd>` & `.kbd-hint`):** Di terminal memakai `9px` mono dengan `padding: 1px 4px` dan radius `2px`; di etalase web memakai `0.82rem` mono warna `#FF69B4`, latar `rgba(255,105,180,0.1)`, border pink tipis, dan `box-shadow: 0 2px 0 rgba(0,0,0,0.5)` untuk kesan tombol fisik mekanis.
- **Anti-Slop Badge Rule (`R-09`):** Dilarang menaruh lencana kapsul pemasaran kosong ("AI Powered", "New", "Fast", "Best"). Lencana hanya sah bila membawa status teknis nyata: versi rilis aktual, `DELAYED 15M`, `SIAP` (status Pine Engine), `Skrip Saya` / `Separate Pane`, `CUSTOM` / `BUILTIN`, atau penghitung jumlah indikator aktif.

### Component Rationale (R-31)

- **Mengapa Radius Micro (`2px - 6px`) di Desktop vs bertingkat (`4px - 16px`) di Web:** Terminal finansial memerlukan ketegasan kotak piksel agar sumbu harga, input order/plan, dan sel grid sejajar sempurna tanpa ruang mati. Sebaliknya, etalase web memakai skala `4px -> 8px -> 12px -> 16px` agar kontrol kecil dan frame screenshot asli (`1920x1036`) terbaca hierarkis tanpa gaya "serba kapsul".

---

## 5. Layout Principles

### Spacing Scale Tokens

- **Desktop Terminal Density Scale (Tight Mechanical Grid):**
  - Micro-gap antar tombol header & dock: `4px` (`RightDockRail`, `Actions`), `7px` (gap utama Header), `8px` (gap cluster StatusBar).
  - Padding strip dock: `0 10px` (Header & StatusBar), `6px 0` (Dock Rail vertikal).
  - Padding dialog & kartu internal: `8px 10px` (navigasi modal sidebar), `18px 20px` (tab content panel modal).
- **Web Showcase Editorial Scale (Structured Breathing Room):**
  - Lebar maksimum kontainer: `1200px` (`padding: 0 24px`), viewport frame / showcase: `max-width: 1100px`.
  - Jarak vertikal antar-seksi (`.section`): `84px 0`.
  - Margin bawah heading seksi: `44px`.
  - Gap grid kartu fitur & metrik: `16px - 20px`.

### Desktop Workspace Architecture: Docked Structural Shell (ADR-0004)

Tata letak aplikasi desktop dikunci ke struktur fleksibel perimeter tanpa overlap:
1. **Top Bar (`40px`)** terbentang penuh di atas.
2. **Middle Workband (`flex: 1`)** dibagi horizontal menjadi:
   - **Left `DrawingToolbar` (`44px`, collapsible via `Alt+T`):** Alat gambar teknikal terkelompok rapi, dengan opsi strip *Favorites* mengambang ringkas yang dapat ditutup.
   - **Primary Chart Canvas (`flex: 1`):** Kanvas WebGL2 penuh, mendukung split 1, 2, 2H, hingga 4 sel grafik sinkron.
   - **Side-by-Side Pine Script v6 IDE (opsional `Alt+E`):** Berbagi ruang horizontal langsung di sebelah kanvas dengan CodeMirror 6 + footer `Console & Tester`, sehingga editor skrip tidak menutup pergerakan candle.
   - **Resizable Right Dock Panel (`300px` default / `360px` mode Trade Plan, dapat ditarik):** Menampilkan **Watchlist**, **Alerts**, **Objects/Layers**, atau **Tab Persisten `Plan`** (Form, Markdown 2-arah, Vault).
   - **Permanent Right Dock Rail (`38px`):** Akses 1-klik ke seluruh panel kanan dan chevron collapse.
3. **Bottom `StatusBar` (`26px`)** terbentang penuh di bawah sebagai instrumen kesehatan runtime.

### Web Section Rhythm (`docs/index.html`, R-05 / RHYTHM 2)

Agar setiap seksi terasa disusun oleh perancang khusus dan bebas pola templat berulang:
1. **Hero Showcase (Centered Focal + `1920x1036` Window Frame + Metrics Ribbon):** Versi rilisan nyata -> Display H1 -> 1 Primary Glow CTA -> Frame jendela asli dengan `main.png` (`width="1920" height="1036"`, `fetchpriority="high"`) -> metrik konkret tanpa fabrikasi.
2. **Filosofi (Editorial Split Surface):** Kartu lebar tunggal beraksen `quote` garis kiri `#FF69B4` dan tag dwibahasa `ꦠꦿꦮꦔꦤ꧀ | penerawangan`.
3. **Komparasi (High-Contrast Data Table):** Tabel responsif dengan kolom **trawangan** diberi sorotan garis vertikal pink transparan.
4. **Kapabilitas Utama (Asymmetric Matrix):** 2 kartu *Flagship* selebar 2 kolom penuh di atas, diikuti grid kartu pendukung 2 kolom.
5. **Pintasan Keyboard (Compact Matrix Grid):** Grid padu `minmax(280px, 1fr)` menonjolkan `<kbd>` monospasi mekanis.
6. **Galeri Tampilan Nyata (Interactive Tabbed Viewport):** Kontrol tab keyboard-accessible (`ArrowLeft`/`Right`/`Home`/`End`) menampilkan tangkapan layar asli `1920x1036` (`aspect-ratio: 1920 / 1036` agar tidak terpotong).
7. **FAQ (Focused Accordion):** Kolom tunggal terpusat `max-width: 860px` dengan ikon `+` berotasi `45deg` saat aktif.
8. **Download Matrix & Split Footer:** Kartu OS grid otomatis + Footer 2 kolom (`2fr 1fr` deskripsi vs tautan), bukan templat 4-kolom kaku.

### Layout & Spacing Rationale (R-31)

- **Mengapa Dock Perimeter di Desktop vs Variasi Seksi `84px` di Web:** Perimeter dock (`40px` / `44px` / `38px` / `26px`) melindungi area kanvas candlestick agar zero-overlap saat analisis real-time, sedangkan jeda vertikal `84px` dan komposisi berbeda di setiap seksi web memecah kelelahan baca halaman panjang (`R-05`).

---

## 6. Depth & Elevation

Alih-alih membuat setiap elemen mengambang dengan bayangan kabur besar (`R-12`), **trawangan** menggunakan **hierarki kecerahan permukaan matte (Tonal Stacking)** sebagai mekanisme kedalaman utama, dan hanya mengeluarkan shadow atau backdrop blur pada lapisan overlay sejati.

| Layer / Elevation | Desktop App Implementation | Web Showcase Implementation | Aturan Ketat (Purpose-Gate) |
| :--- | :--- | :--- | :--- |
| **Level 0: Canvas Base** | `#0F0F0F` + WebGL grid `0.05` alpha | `#0E0E10` solid bersih (`R-07`, nol grid dekoratif) | Fondasi diam untuk data dan keterbacaan |
| **Level 1: Docked & Content Cards** | `#141414` - `#171717` + `1px solid #222222`, **tanpa drop shadow** | `#151518` + `1px solid rgba(255,255,255,0.08)`, `--shadow-card` (`0 4px 20px rgba(0,0,0,0.35)`) | Kartu membedakan konten lewat langkah tonal, bukan bayangan tebal |
| **Level 2: Popovers & Sticky Chrome** | `#1E1E1E`, border `#2C2C2C`, shadow terfokus (`0 8px 24px rgba(0,0,0,0.6)`) | `.site-header`: `rgba(14,14,16,0.92)` + `backdrop-filter: blur(16px)` | **Cap `R-10`:** Glass blur maksimal 1 elemen utama di halaman web |
| **Level 3: Modals & Hero Frame** | `SettingsModal` / `IndicatorModal` (`920px`, `z-index: 1000`, backdrop `rgba(11,14,20,0.82)` + `blur(5px)`, shadow `0 20px 48px rgba(0,0,0,0.75)`) | `.hero-visual-frame`: `--shadow-elevated` (`0 12px 36px rgba(0,0,0,0.5)`) | Memisahkan tugas modal penuh dari chart aktif di belakangnya |
| **Level 4: Focal Glow** | Dipakai hemat pada bar/badge sinyal kritis (`var(--bear-glow)` `6px`) | **Hanya `.btn-cta-main`** (`0 8px 24px rgba(255,105,180,0.28)`) | **Cap `R-13`:** Maksimal 1-2 titik glow di layar; dilarang menyala di kartu + badge + ikon bersamaan |

### Guardrails Terhadap Drift Kode Legacy

Pemeriksaan kode sumber mengidentifikasi beberapa sisa gaya lama yang **tidak boleh direplikasi** pada fitur atau revisi baru:
1. **Animasi Tak Terbatas di `Header.svelte` (`@keyframes headerPulse`, `sparkleSpin`):** Tombol update Pill memakai animasi loop tanpa henti. Untuk desain baru, patuhi `MOTION 1` dan `R-39` (hindari loop dekoratif >5 detik tanpa kontrol jeda; ganti dengan penanda statis/transisi hover yang halus).
2. **Sisa Token Hijau/Cyan Lama (`#00F090`, `#00F0FF`, `.glass-panel`):** Sejumlah fallback CSS di `Header.svelte`, `IndicatorModal.svelte`, `SettingsModal.svelte`, dan `DrawingToolbar.svelte` masih menuliskan `#00F090` atau `#00f0ff` / `.glass-panel`. Komponen baru wajib terikat ke `--brand-primary` (`#FF69B4`), `--brand-cyan` (`#38BDF8`), dan panel matte `--bg-panel` (`#171717`).
3. **Kontras `--text-dim: #737373` di `src/styles/theme.css`:** Rasio `#737373` di atas `#0F0F0F` hanya `4.04:1`. Untuk teks informatif `<18px` di komponen baru, gunakan minimal `#808080` (`4.85:1` di `#0F0F0F`) atau `#8A8A8A` (`4.83:1` di `#1E1E1E`), atau `--text-dim: #8E8EA0` di etalase web (`5.99:1`).

---

## 7. Do's and Don'ts

### Visual & Identity Do's

- **DO** tulis nama produk selalu dalam huruf kecil **`trawangan`** di header, logo, judul modal, dan UI copy (`GLOSSARY.md`).
- **DO** pertahankan kombinasi **Signature White Bull (`#F7F7F7`) + Hot Pink Bear (`#FF69B4`)** di atas `#0F0F0F` / `#0E0E10` sebagai wajah bawaan setiap presentasi produk.
- **DO** gunakan `tabular-nums` (`.mono-nums` / `JetBrains Mono`) untuk seluruh harga, perubahan persentase, rasio R-multiple (`+2.50R`, `-1.00R`), FPS, ping, dan stempel waktu.
- **DO** berikan ruang napas di kanvas WebGL2 dengan menyandarkan kontrol ke dock tepi (`40px` / `44px` / `38px` / `26px`) tanpa menumpuk modal atau panel di atas aksi harga aktif.
- **DO** gunakan tangkapan layar aplikasi nyata (`docs/assets/screenshots/*.png`) beserta `width`, `height`, dan `alt` deskriptif di materi web/dokumentasi (`R-22`, `R-40`).
- **DO** verifikasi kontras warna di *semua* mode tema yang dikirim (terutama tema terang seperti *Warta Abang* `#EAEAE5` via token adaptif `--on-brand-primary`, `--bull-text`).

### Strict Don'ts (Anti-Slop & Domain Guardrails)

- **DON'T** gunakan karakter em dash (U+2014) di teks UI, heading, deskripsi, komentar UX, maupun copy landing page (`R-02`). Ganti dengan koma, titik dua, titik, atau tanda kurung.
- **DON'T** sisipkan fitur eksekusi order (`Buy`, `Sell`, `Place Order`), sambungan dompet Web3/API key trading, atau klaim sebagai platform brokerage (`ADR-0001`: **Pure Charting Scope**).
- **DON'T** kembalikan warna default candlestick ke hijau neon & merah standar di tema *Signature*, atau gunakan skema gradasi biru-ungu / ungu-hitam generik AI (`R-01`).
- **DON'T** tampilkan statistik pengguna palsu (`10K+ Users`, `99.9% Uptime`), testimoni rekaan, avatar AI, atau skor rating fiktif (`R-17`, `R-18`, `R-36`, `R-38`).
- **DON'T** pakai kata buzzword AI (`Revolutionary`, `Seamless`, `Next Generation`, `AI Powered`, `Ultimate`) maupun tombol CTA hambar (`Get Started`, `Learn More`, `Try Now`) (`R-15`, `R-16`). Ganti dengan bahasa teknis konkret dan aksi spesifik (`Unduh trawangan v0.45`, `+ Tambah ke Chart`, `Simpan Plan [Ctrl+Enter]`).
- **DON'T** jadikan semua tombol, kartu, input, dan lencana berbentuk kapsul (`9999px`) secara seragam (`R-11`), atau menumpuk glow + glass blur + grid background bersamaan (`R-07`, `R-10`, `R-13`).

---

## 8. Responsive Behavior

**trawangan** memperlakukan responsivitas sebagai struktur inti di desktop sempit/multi-window maupun layar mobile web (`R-03`), lengkap dengan perlindungan aksesibilitas gerak.

### Unified Breakpoints Table

| Permukaan | Breakpoint | Adaptasi Tata Letak & Perilaku | Target Ergonomi |
| :--- | :--- | :--- | :--- |
| **Desktop App (`StatusBar`)** | `>= 1080px` | `.world-clocks-desktop` tampil inline sejajar (`TYO`, `LON`, `NY`) dengan pip hijau/redup status sesi bursa | Pemantauan 1-pandang di layar kerja standar |
| **Desktop App (`StatusBar`)** | `<= 1079px` | Jam dunia ringkas terlipat menjadi satu tombol popover `World Clocks (3)` ber-backdrop klik luar | Mencegah kolisi teks dengan `RAM` & `Terminal Logs` pada jendela split-screen |
| **Desktop App (`RightDockPanel`)** | Adaptif User (`300px` / `360px`) | Lebar default `300px` (`270px - 620px`) untuk Watchlist/Alerts/Layers, melebar otomatis ke `360px` (`310px - 680px`) saat membuka `Tab Plan`, serta Pine IDE `340px - 850px` via resizer drag & keyboard | Panel kanan tetap nyaman dibaca tanpa mencekik kanvas grafik |
| **Desktop App (Typography Presets)** | `1080p` / `1440p` / `4K` | Pilihan font base `10px`, `11px` (Compact), `12px` (Regular default), `13.5px` (Comfortable), hingga `14px - 20px` via `TypographyTab` | Keterbacaan tajam lintas DPI & skala monitor OS |
| **Web Showcase** | `> 900px` | Grid fitur 2-kolom penuh dengan `.feature-card.flagship` span 2 kolom horizontal; Footer `2fr 1fr`; Navbar horizontal penuh | Memaksimalkan perbandingan & showcase `1100px` |
| **Web Showcase** | `769px - 900px` | Matriks fitur dan baris flagship beralih ke `1fr` (1 kolom vertikal); Footer menumpuk ke `1fr` | Kartu tetap lapang tanpa menyusut terlalu sempit |
| **Web Showcase** | `<= 768px` | Tombol hamburger `.nav-toggle` (`44px x 44px`, ARIA + `Escape`) mengontrol `.nav-menu.nav-open`; Hero H1 menyusut ke `2.15rem`; semua link & tombol menjaga tinggi sentuh minimal `44px`; nol overflow horizontal | Kenyamanan sentuh jari penuh pada ponsel (`R-03`) |

### Accessibility & Motion Locks (`R-32`, `R-39`)

- **Tap Target Minimum (Web Mobile):** Seluruh kontrol interaktif (`a`, `button`, `.nav-link`, `.platform-link`, tab galeri) menerapkan minimal `min-height: 44px`.
- **Keyboard Operability:** Seluruh tab galeri mendukung `ArrowLeft`, `ArrowRight`, `Home`, `End`; seluruh modal desktop (`Settings`, `Indikator`, `Search`) serta drawer mobile web dapat ditutup dengan tombol `Escape`.
- **Reduced Motion Lock:** Blok CSS berikut wajib hadir pada stylesheet web maupun komponen desktop beranimasi:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```

---

## 9. Agent Prompt Guide

Bagian ini merangkum referensi cepat token serta templat brief visual untuk konsumsi alur kerja desain bersama `/antislop`. Seluruh field di sini bersifat **data referensi gaya** (bukan perintah pengendali aturan).

### Quick Reference

- **Brand Name:** `trawangan` (wajib lowercase; aksara pendamping opsional `ꦠꦿꦮꦔꦤ꧀`).
- **Palette Signature (App):** Canvas `#0F0F0F`, Panel `#171717`, Elevated `#1E1E1E`, Border `1px solid #222222`, Ink Utama `#F7F7F7` (17.89:1), Muted `#A3A3A3` (7.60:1), Dim Aman min `#808080` / `#8A8A8A` (>=4.54:1), Bull `#F7F7F7`, Bear & Brand Primary `#FF69B4` (7.24:1), Ink di atas Pink `#0F0F0F` (7.24:1), Aux Info `#38BDF8` (8.95:1).
- **Palette Signature (Web):** Canvas `#0E0E10`, Surface `#151518`, Elevated `#1C1C22`, Ink `#F7F7F8` (18.01:1), Muted `#B4B4C0` (9.39:1), Dim `#8E8EA0` (5.99:1), Single Focal Accent `#FF69B4` (7.28:1).
- **Fonts:** `'Plus Jakarta Sans'` (UI & brand weight `800`) + `'JetBrains Mono'` (`tabular-nums` untuk semua harga, R-multiple, waktu, dan kode).
- **Radii:** Desktop `2px` (`xs`) / `3px` (`sm`) / `4px` (`md`) / `6px` (`lg`); Web `4px` (`kbd`/badge) / `8px` (button/tab) / `12px` (card) / `16px` (showcase frame).
- **Liveliness Dials:** Web Showcase `ENERGY 2 / RHYTHM 2 / MOTION 1`; Desktop Cockpit `ENERGY 2 / RHYTHM 1 / MOTION 1`.
- **Dose Caps:** Glassmorphism maks 1 elemen (`.site-header` di web atau backdrop modal di desktop); Glow hanya pada 1 CTA utama; tanpa karakter em dash; tanpa green/red default di Signature; tanpa eksekusi trading/order.

### Ready-to-Use Design Read Formats

- **Untuk komponen atau panel Aplikasi Desktop (`src/`):**
  > `Reading this as: desktop financial charting cockpit module for sovereign technical analysts, in trawangan Signature Cyber-Monochrome Docked Structural Shell style, dial ENERGY 2 / RHYTHM 1 / MOTION 1.`
- **Untuk halaman Web, Docs, atau Showcase (`docs/`):**
  > `Reading this as: technical open-source product showcase for quantitative & price-action traders, in trawangan Signature Dark Editorial Matte style, dial ENERGY 2 / RHYTHM 2 / MOTION 1.`

### Prompt Template (Design Brief Snippet)

```text
Konteks Desain: Antarmuka untuk terminal charting desktop open-source trawangan (Pure Charting Scope, tanpa fitur eksekusi order atau wallet).
Arah Visual (DESIGN.md):
- Tema Signature Cyber-Monochrome: kanvas gelap matte #0F0F0F (app) atau #0E0E10 (web), permukaan panel #171717 / #151518 dengan pemisah presisi hairline 1px (#222222 atau rgba(255,255,255,0.08)).
- Penekanan polaritas & aksen: White Bull (#F7F7F7) dan Hot Pink Bear / Primary Accent (#FF69B4) dengan teks #0F0F0F di atas tombol pink; hindari warna hijau/merah default maupun gradasi biru-ungu AI.
- Tipografi: Plus Jakarta Sans untuk UI & wordmark lowercase "trawangan", JetBrains Mono dengan tabular-nums (.mono-nums) untuk angka harga, persentase, timeframe, R-multiple, dan telemetri.
- Hierarki permukaan & dosis: [untuk Desktop Shell: radius 2px-4px, Docked Structural Shell tanpa overlap candle, dial ENERGY 2 / RHYTHM 1 / MOTION 1] / [untuk Web: radius bertingkat 4px/8px/12px/16px, asymmetric sections, maksimal 1 elemen glass blur dan 1 CTA glow utama, dial ENERGY 2 / RHYTHM 2 / MOTION 1].
- Batasan kualitas: Kontras WCAG AA >= 4.5:1 di seluruh teks normal (min #808080/#8A8A8A app, #8E8EA0 web), navigasi keyboard lengkap dengan :focus-visible 2px solid #FF69B4, state empty/loading/error nyata, dukung @media (prefers-reduced-motion: reduce), serta nol karakter em dash dan nol statistik/testimoni fiktif.
```

### Verified Visual Assets Inventory

Seluruh komponen showcase dan dokumentasi wajib mengacu pada aset asli terverifikasi berikut beserta dimensi eksaknya (`R-22`, `R-40`; dilarang menggantinya dengan ilustrasi generik, mockup skeleton, atau atribut dimensi palsu):
- Brand Marks (`docs/assets/`):
  - `logo-icon.svg` (viewBox `1080x1080`, ikon monogram `t` `#FF69B4` dalam squircle putih)
  - `logo-full.svg` (viewBox `1280x640`, monogram + wordmark `trawangan` ExtraBold `#FF69B4`)
  - `banner.png` (`3843x1923`)
  - `logo.png` (`128x128`) & `favicon.png` (`64x64`)
- Real App Captures (`docs/assets/screenshots/`, seluruhnya beresolusi asli `1920x1036`):
  - `main.png` (`1920x1036`): Terminal charting utama WebGL2 (`ETHUSDT.P` Signature White Bull & Hot Pink Bear, docked rails, StatusBar telemetri).
  - `watchlist.png` (`1920x1036`): Panel kanan Watchlist aktif dengan badge exchange & delta harga + favorites drawing bar.
  - `indicator.png` (`1920x1036`): Modal `Indikator & Scripting Library` dengan skrip kustom Pine Script v6 dan CTA `+ Pasang`.
  - `pineeditor.png` (`1920x1036`): Mode kerja split Side-by-Side Pine Script v6 IDE (CodeMirror 6 + grafik WebGL2 berdampingan).
  - `setting.png` (`1920x1036`): Modal `Pengaturan & Telemetri Sistem` (tab `Umum & Audio`, dropdown, tombol toggle pink, pemilihan folder snapshot).
  - `theme.png` (`1920x1036`): Galeri `Tema & Warna` menampilkan Dual-Theme Decoupling dan swatch preset resmi (`Signature`, `Binance Classic`, `Bitunix Neon`, `TradingView Pro`, `Coinglass Dark`, `Warta Abang`, beserta preset budaya Jawa).

> Catatan Sinkronisasi `docs/`: Saat memperbarui halaman web, pastikan `<img>` memakai atribut `width="1920" height="1036"` dan merujuk nama berkas aktual (`pineeditor.png`, `theme.png`, `watchlist.png`, `indicator.png`), bukan nama usang (`pine-editor.png`, `theme-custom.png`) atau dimensi `1280x720`.
