# 0019. Chart Mode Preset Memory, Chart-Dominant Thesis Surface, Trade Plan Vault, and Plan-Linked Auto-Alerts

## Konteks & Latar Belakang
1. **Kehilangan Memori Tema Kanvas saat Beralih Mode Warna:** Ketika pengguna menonaktifkan sinkronisasi tema aplikasi dan kanvas (`syncChartWithAppTheme: false`), `AppSettings` sebelumnya hanya memiliki satu variabel `chartThemePreset` tanpa pasangan mode gelap/terang (`activeDarkChartPreset` dan `activeLightChartPreset`). Akibatnya, saat pengguna mengatur tema kanvas gelap *Kustom A* lalu beralih ke mode terang via halaman utama, tema kanvas yang sebelumnya diatur untuk mode terang (*Kustom B*) tertimpa oleh *Kustom A*.
2. **Tabrakan Kontras pada Kartu & Panel Thesis:** Pada struktur palet kustom 9-dimensi (`CustomThemePalette`), atribut `general.foreground` (yang pada standar `chartthemes.com` merepresentasikan elemen depan/garis kisi di atas kanvas dan bernilai terang pada mode gelap) sebelumnya dipetakan menjadi token latar permukaan (`bgContainer`, `bgPanel`, `bgSecondary`). Hal ini menyebabkan latar belakang kartu/panel Thesis menjadi putih terang sementara teks di atasnya juga terang, serta terjadi ketidaksinkronan antara tampilan *Floating Thesis Card* (yang sempat mengikuti CSS variabel aplikasi) dengan hasil ekspor snapshot.
3. **Sifat Sementara Trade Plan & Absennya Alert Otomatis:** Rencana perdagangan (`ParsedTradingPlan`) sebelumnya hanya hidup di memori sesi aktif dan hilang saat coretan gambar dibersihkan. Selain itu, setelah memproyeksikan kotak Long/Short multi-target ke grafik, trader masih harus memasang `PriceAlert` satu per satu secara manual untuk titik Entry, Stop Loss, dan setiap target TP.

## Keputusan Arsitektur

### 1. Chart Mode Preset Memory (`activeDarkChartPreset` & `activeLightChartPreset`)
- Memperluas `AppSettings` dengan `activeDarkChartPreset?: ThemeId` dan `activeLightChartPreset?: ThemeId`.
- Ketika `syncChartWithAppTheme === false`, pemilihan tema kanvas saat mode tampilan sedang gelap otomatis memperbarui `activeDarkChartPreset`, dan saat mode terang otomatis memperbarui `activeLightChartPreset`.
- Fungsi `resolveEffectiveChartThemePreset` dan siklus pergantian mode warna (`handleCycleColorMode` / `handleSetColorMode`) disempurnakan agar kanvas grafik secara otomatis beralih antara `activeDarkChartPreset` dan `activeLightChartPreset` mengikuti mode warna aktif (Dark/Light/System).
- Menambahkan 2 kontrol pemilih eksplisit (**Tema Kanvas Favorit Mode Gelap** & **Tema Kanvas Favorit Mode Terang**) pada bagian *Atur Tema Favorit Saat Pindah Gelap/Terang* di `AppearanceTab.svelte`.

### 2. Chart-Dominant Thesis Surface & Koreksi Filosofi Token `Foreground`
- Mengoreksi `buildThemeConfigFromUserTheme` pada `src/lib/constants/themes.ts` agar token permukaan kartu/panel (`bgContainer`, `bgPanel`, `bgElevated`, `bgSecondary`) **diturunkan secara matematis dari `general.background`** menggunakan *Adaptive Luminance* (dinaikkan sedikit kecerahannya pada latar gelap, atau diteduhkan pada latar terang), bukan mengambil `general.foreground` secara mentah. Atribut `general.foreground` digunakan sesuai filosofi chart untuk aksen garis grid dan border halus.
- Menyeragamkan sumber warna **Floating Thesis Card** (`FloatingThesisCard.svelte`) dan **Dedicated Thesis Side Panel / Snapshot Overlay** (`chartSnapshotService.ts`) agar selalu mengikuti warna latar **Chart Canvas Theme** aktif yang lebih dominan di area kerja grafik, serta mengeliminasi seluruh warna *hardcoded* pada komponen `FloatingThesisCard.svelte`.

### 3. Trade Plan Vault (Arsip Otomatis & Re-Plot Lintas Waktu)
- Membangun penyimpanan otomatis `SavedTradingPlanRecord` di lapisan persistensi (`user_trade_plan_vault` via `PersistenceService`) yang merekam setiap Trade Plan yang diterapkan tanpa memerlukan tombol simpan manual (dilengkapi deduplikasi cerdas berdasarkan simbol, bias, entry, SL, dan daftar TP).
- Menyediakan tab **"Riwayat Plan"** di dalam `ImportPlanModal.svelte` (`Ctrl+Shift+P`) serta akses cepat dari panel **Object Tree** untuk meninjau kembali *outlook* masa lalu.
- Saat rencana masa lalu dipilih untuk ditampilkan kembali (*Re-Plot to Chart*), kotak posisi bertingkat dan zona FVG direntangkan hingga ke lilin harga terbaru saat ini (*time-stretched to current candle*) agar trader dapat langsung membandingkan posisi harga pasar terkini terhadap rencana masa lalu.

### 4. Plan-Linked Auto-Alerts (Otomatisasi Sinyal Entry, SL, dan TP1..TPn)
- Menambahkan properti opsional `planId?: string` dan `planRole?: 'entry' | 'sl' | string` pada `PriceAlert`.
- Saat Trade Plan baru diterapkan ke grafik (dengan opsi `[✓] Pasang Alert Otomatis (Entry, SL, TP)` aktif secara default), sistem secara otomatis mendaftarkan alert harga ke `alertService`:
  - **Entry**: kondisi `crossing` (`⚡ [LONG/SHORT PLAN] Entry @ <harga>`)
  - **Stop Loss**: kondisi `crossing_down` (Long) atau `crossing_up` (Short) (`🛡️ [LONG/SHORT PLAN] SL (-1.00R) @ <harga>`)
  - **TP1..TPn**: kondisi `crossing_up` (Long) atau `crossing_down` (Short) (`🎯 [LONG/SHORT PLAN] TPk (+X.XXR) @ <harga>`)
- Mengikat siklus hidup alert ke `planId`: ketika sebuah Trade Plan dihapus dari kanvas (melalui tombol tutup kartu Thesis, *Undo* `Ctrl+Z`, atau *Clear All Drawings*), seluruh alert berstatus aktif/belum terpicu yang memiliki `planId` tersebut otomatis ikut dibersihkan (`alertService.deleteAlertsByPlanId(planId)`).
- Saat me-*load* ulang rencana masa lalu dari **Riwayat Plan** untuk sekadar *review*, auto-alert tidak dipasang ulang secara otomatis kecuali diminta secara eksplisit oleh pengguna.
