# Spec: Theme Preset Candlestick Harmonization and Custom Candle Palette

## Problem Statement

Pengguna terminal charting `trawangan` menghadapi ketidakharmonisan visual antara antarmuka aplikasi dan kanvas grafik candlestick WebGL2:
1. **Candlestick Tidak Selaras dengan Theme Preset:** Ketika pengguna beralih antara Theme Preset (misalnya dari *Signature* ke *Binance Classic*, *Bitunix Neon*, *TradingView*, atau *Coinglass*) di bilah Pengaturan, warna shell UI (bilah alat, tombol, teks) berubah, tetapi warna lilin candlestick (*bullish* dan *bearish*) pada kanvas WebGL2 tetap menggunakan warna lama atau tidak terpengaruh.
2. **Keterbatasan `workspace.setTheme` pada Engine Vela:** Pemanggilan `workspace.setTheme()` hanya memengaruhi palet dasar global kanvas, sementara engine WebGL2 Vela mengisolasi konfigurasi warna lilin di dalam dokumen `candles` dan `bars` yang dikelola via `applyConfig()`. Jika dokumen konfigurasi sel grafik belum dipasok dengan blok `candles`, atau jika pengguna pernah membuka dialog setelan native Vela, warna lilin tidak mengikuti pergantian tema secara otomatis.
3. **Ketiadaan Kustomisasi Palet Lilin Personal:** Pengguna yang ingin memadukan warna lilin unik (misalnya kombinasi warna lilin kesukaan atau kebutuhan aksesibilitas kontras) tidak memiliki kontrol mandiri di Pengaturan Tampilan tanpa merusak integritas tema dasar.
4. **Reset Pabrik Tidak Memperhitungkan Tema Aktif:** Menekan tombol "Reset ke Pabrik" pada setelan chart saat ini menghapus konfigurasi tanpa menyelaraskan lilin kembali ke palet Theme Preset yang sedang aktif dipilih oleh pengguna.

## Solution

Menyediakan harmonisasi warna lilin secara menyeluruh dan fitur kustomisasi warna candlestick hibrida:
1. **Propagasi Otomatis Warna Candlestick per Theme Preset:** Setiap pergantian Theme Preset secara deterministik memperbarui token visual antarmuka sekaligus memanggil `applyConfig()` dengan konfigurasi lengkap `candles` (`upColor`, `downColor`, `borderUpColor`, `borderDownColor`, `wickUpColor`, `wickDownColor`) dan `bars` pada seluruh sel grafik WebGL2 aktif.
2. **Kustomisasi Lilin Hibrida (Bull & Bear Pickers):** Menyediakan dua input pemilih warna (Bullish & Bearish) di tab *Tampilan* (Appearance) di bawah grid Theme Preset. Warna sumbu (*wick*) otomatis diselaraskan dengan warna badan, dan warna garis tepi (*border*) diturunkan secara proporsional (-15% brightness) untuk mencegah kelelahan mata (*eye fatigue*) serta menjaga estetika visual premium.
3. **Transisi Tema Deterministik:** Memilih Theme Preset baru di grid kartu tema akan secara otomatis mereset kustomisasi warna lilin, menjamin pengguna langsung merasakan karakter autentik dari tema yang baru dipilih tanpa kebingungan *state*.
4. **Aktivasi Implisit & Tombol Reset ke Tema:** Pengguna cukup memilih warna baru untuk langsung mengaktifkan *override*. Tombol "Reset ke Tema" disediakan untuk mengembalikan warna lilin ke nilai bawaan Theme Preset yang sedang aktif kapan saja.
5. **Reset Pabrik Cerdas Berbasis Tema Aktif:** Operasi reset setelan grafik ke pabrik memulihkan lilin dan elemen kanvas ke warna Theme Preset yang sedang aktif, bukan warna hardcoded lawas.

## User Stories

1. As a trader, I want selecting a Theme Preset in Settings (e.g. Binance Classic, Bitunix, TradingView) to immediately update both the UI shell and the candlestick colors on the chart canvas, so that the terminal has a unified and cohesive visual identity.
2. As a trader, I want the Signature Theme to render ivory white (`#F7F7F7`) bullish candles and hot pink (`#FF69B4`) bearish candles on the WebGL2 canvas by default, so that the distinctive cyber-monochrome brand aesthetic is preserved.
3. As a trader, I want selecting the Binance Classic theme to immediately render emerald green bullish candles and crimson red bearish candles across all chart cells, so that my market instincts match standard exchange conventions.
4. As a trader, I want selecting the Bitunix Neon theme to display neon green bull candles and rose pink bear candles with matching wick colors, so that high-contrast night trading is visually comfortable.
5. As a trader, I want to customize the bullish candlestick color using an intuitive color picker in Appearance settings, so that I can tailor the chart to my visual preferences.
6. As a trader, I want to customize the bearish candlestick color using an intuitive color picker in Appearance settings, so that downward price action matches my preferred color palette.
7. As a trader, I want custom candle wick colors to automatically match the selected body color, so that I do not need to configure wick colors individually.
8. As a trader, I want custom candle border colors to be automatically calculated at a subtle 15% darker shade of the body color, so that candle edges remain crisp without manual adjustments.
9. As a trader, I want a "Reset ke Tema" button next to custom candle color controls, so that I can effortlessly discard custom overrides and revert to the active theme's defaults.
10. As a trader, I want my custom candle color overrides to be automatically cleared whenever I pick a different Theme Preset from the grid, so that I can immediately evaluate the authentic styling of the new theme.
11. As a trader, I want custom candle colors to persist across app restarts in my global settings, so that my preferred color palette is maintained every time I launch trawangan.
12. As a trader using a multi-chart grid layout (2, 2h, or 4 cells), I want theme changes and custom candle colors to apply instantaneously and identically across all visible cells, so that multi-timeframe analysis remains harmonious.
13. As a trader, I want clicking "Reset ke Setelan Pabrik" in Chart Settings to restore candlestick styling to the currently active Theme Preset instead of a generic factory state, so that my theme choice remains intact.
14. As a trader, I want preview swatches in the Theme Presets grid to accurately represent both the canvas background and the actual candle colors rendered on the chart, so that what I see in Settings matches what appears on screen.

## Implementation Decisions

1. **Schema Extension on App Settings:**
   Memperluas kontrak `AppSettings` dengan properti warna lilin kustom opsional:
   - `customBullColor?: string` (format HEX, misal `#00F090`)
   - `customBearColor?: string` (format HEX, misal `#FF3B69`)
   Ketiadaan nilai atau nilai `undefined` menandakan bahwa kanvas menggunakan warna Theme Preset bawaan (aktivasi implisit).

2. **Orkestrasi Terpusat pada ChartSessionController:**
   - Memperbarui signature `setTheme(preset: ThemePresetId, fontSize?: number, customCandleColors?: { bullColor?: string; bearColor?: string })`.
   - Di dalam `setTheme()`, hitung konfigurasi efektif lilin (*effective candle configuration*):
     - Jika `customCandleColors?.bullColor` tersedia: gunakan nilai tersebut untuk badan dan sumbu, lalu turunkan warna garis tepi sebesar 15% lebih gelap menggunakan utilitas deterministik *color darken*.
     - Jika tidak tersedia: ambil nilai lengkap dari `THEME_PRESETS[preset].chart` (`upColor`, `downColor`, `borderUpColor`, `borderDownColor`, `wickUpColor`, `wickDownColor`).
   - Lakukan dua tahap pembaruan pada Vela:
     a. Panggil `workspace.setTheme(themeObj)` untuk konfigurasi kanvas global (background, grid, text, border).
     b. Iterasi seluruh sel aktif via `this.getAllCells()`, ambil instans native renderer (`cell?.chart?.renderer?.renderer || cell?.chart?.renderer`), dan panggil:
        ```typescript
        r.applyConfig({
          candles: {
            upColor: effectiveUp,
            downColor: effectiveDown,
            borderUpColor: effectiveBorderUp,
            borderDownColor: effectiveBorderDown,
            wickUpColor: effectiveWickUp,
            wickDownColor: effectiveWickDown,
            bodyVisible: true,
            borderVisible: true,
            wickVisible: true
          },
          bars: {
            upColor: effectiveUp,
            downColor: effectiveDown
          }
        });
        ```
   - Pasang nilai `effectiveCandleConfig` tersebut ke dalam `activeChartDefaultConfig` sehingga sel baru yang dibuat saat pergantian tata letak (*layout*) multi-chart langsung mewarisi warna lilin yang aktif.

3. **Utilitas Auto-Derivation Border Color:**
   - Menyediakan fungsi utilitas deterministik `deriveBorderColor(hexColor: string, darkenPercent = 0.15): string` yang mengonversi warna heksadesimal ke RGB, mengurangi nilai kanal sebesar 15%, dan mengembalikan kode HEX 6 digit yang valid.

4. **Reaktivitas Antarmuka Svelte 5 di Chart.svelte & +page.svelte:**
   - Props `customBullColor` dan `customBearColor` diteruskan dari `appSettings` di `+page.svelte` ke komponen `Chart.svelte`.
   - Komponen `Chart.svelte` menambahkan `$effect` terdedikasi yang membaca sinyal `themePreset`, `fontSize`, `customBullColor`, dan `customBearColor`, lalu memanggil `controller.setTheme(...)`.
   - Saat pengguna mengklik kartu tema baru di `AppearanceTab.svelte`, handler memperbarui `themePreset` sekaligus mereset `customBullColor: undefined` dan `customBearColor: undefined`.

5. **Antarmuka Kustomisasi Lilin di AppearanceTab:**
   - Menambahkan sub-bagian visual *Kustomisasi Warna Candlestick* tepat di bawah grid kartu tema.
   - Menyediakan kontrol pemilih warna native (`<input type="color">`) yang disandingkan dengan input teks hex dan indikator swatch visual.
   - Menyertakan tombol "Reset ke Tema" dengan ikon putar balik (`RotateCcw`), yang dinonaktifkan (*disabled*) jika tidak ada kustomisasi aktif.

6. **Penyempurnaan Reset Pabrik:**
   - Pada method `resetSettingsToFactory()` di `ChartSessionController`, setelah menghapus `clearChartDefaultConfig()`, panggil ulang `this.setTheme(this.themePreset, this.fontSize)` agar seluruh sel kanvas langsung kembali ke warna Theme Preset aktif.

## Testing Decisions

1. **Prinsip Good Test (Black-Box & Behavior-Driven):**
   - Pengujian hanya memverifikasi perilaku eksternal: apakah memanggil `setTheme()` memicu `applyConfig()` dengan payload `candles` dan `bars` yang benar pada renderer, dan apakah pergantian preset mengembalikan warna lilin yang sesuai.
   - Tidak menguji mekanisme internal WebGL shader atau pipeline penggambaran canvas bawaan Vela.

2. **Modul yang Diuji:**
   - `ChartSessionController`: Verifikasi pemanggilan `setTheme()` dengan Theme Preset Signature, Binance, Bitunix, dsb., serta verifikasi pengaplikasian `customCandleColors` dan auto-derivation warna border.
   - `themes.ts` / Theme Constants: Verifikasi kelengkapan token `chart` (termasuk `borderUpColor`, `borderDownColor`, `wickUpColor`, `wickDownColor`) di seluruh preset.
   - Color Derivation Helper: Verifikasi akurasi kalkulasi fungsi penurunan kecerahan 15% pada berbagai format hex.

3. **Prior Art:**
   - Mengikuti struktur pengujian pada `tests/themes.test.ts` dan mock headless workspace pada `tests/chartSessionController.test.ts`.

## Out of Scope

1. **Pewarnaan Kondisional Lilin Berbasis Logika Pine Script:** Pewarnaan lilin per-bar berdasarkan sinyal indikator teknikal (misal: RSI overbought) tetap ditangani oleh modul `plotcandle()` PineTS runtime, bukan oleh pengaturan tema terminal.
2. **Kustomisasi Ketebalan Garis Tepi atau Transparansi Sumbu:** Pengguna hanya mengatur warna dasar badan lilin; sumbu dan garis tepi diatur secara harmonis dan otomatis.
3. **Pembedaan Warna Lilin Antar Sel Multi-Chart:** Seluruh sel dalam tata letak multi-chart mengadopsi skema warna tema dan kustomisasi yang seragam.

## Further Notes

- Konvensi nama tema dan filosofi visual mengikuti standar `GLOSSARY.md` (*Theme Preset*, *Signature Palette*, *Penerawangan*) serta *ADR 0001* (*Brand Identity, Signature Theme, and Pure Charting Scope*).
- Palet bawaan *Signature Theme* (`#F7F7F7` untuk bull dan `#FF69B4` untuk bear) tetap menjadi default yang tidak berubah jika pengguna tidak mengatur warna custom.
