# 0009. Dual-Track Volume Architecture and Session VWAP Integration

Untuk menyediakan analisis likuiditas dan profil harga terbobot volume (*volume-weighted analysis*) yang presisi tanpa mengorbankan performa render 60 FPS pada kanvas WebGL2, `trawangan` menetapkan keputusan arsitektur berikut:

1. **Dual-Track Volume Architecture (Native WebGL vs Pine Script)**:
   - **Native Volume Overlay (Default Track)**: Mengaktifkan layer histogram volume bawaan engine WebGL2 Vela (`nativeType: 'volume'`) secara otomatis di kaki kanvas harga utama untuk setiap sel chart baru. Pendekatan ini tidak membebani Web Worker Pine Script, bebas latency, dan mematuhi palet warna tema terminal.
   - **Pine Script Volume Study (Scripting Track)**: Menyediakan skrip preset Pine Script v5 resmi untuk Volume di katalog indikator, dilengkapi garis Moving Average (SMA 20) dan pewarnaan lilin up/down. Jalur ini diperuntukkan bagi trader yang memerlukan kustomisasi formula atau pembuatan sinyal alert volume.

2. **Unified Object Tree & Settings Seam**:
   - Kontrol visibilitas Native Volume diintegrasikan secara terpadu di dua titik:
     - **Settings Modal -> General/Chart**: Konfigurasi global `showVolume: boolean` (default: `true`).
     - **Unified Object Tree**: Native Volume terdaftar sebagai entitas layer di bilah dock kanan dengan kontrol ikon mata (*toggle visibility*) langsung tanpa membuka modal.

3. **Session VWAP with Dual Standard Deviation Bands**:
   - Menyediakan preset resmi **Session VWAP** Pine Script v5 dengan atribut `overlay=true`.
   - Menggunakan kalkulasi kumulatif `ta.vwap` dengan *session reset* harian berbasis zona waktu bursa (*exchange timezone*).
   - Dilengkapi pita deviasi standar ganda (+1σ / -1σ dan +2σ / -2σ) serta arsiran transparan (*translucent band fills*), di mana parameter pengganda deviasi dan visibilitas band dapat dikonfigurasi melalui dialog *Inputs*.

4. **Dedicated 'Volume' Indicator Category**:
   - Menambahkan kategori resmi baru **`Volume`** pada modal pustaka indikator (`IndicatorModal.svelte`), mendampingi kategori `Trend`, `Momentum`, `Volatility`, dan `Signals`.
   - Preset Volume dan Session VWAP dikelompokkan ke dalam kategori ini untuk penemuan instrumen likuiditas yang terorganisir.

5. **Multi-Chart Synchronization & Workspace Persistence**:
   - Status visibilitas `showVolume` disimpan secara persisten di dalam skema `SavedWorkspace` dan snapshot sesi `ChartSessionController`.
   - Saat sinkronisasi multi-chart aktif (`syncConfig.indicators` atau `syncConfig.style`), perubahan visibilitas volume pada sel aktif otomatis diselaraskan ke seluruh sel grafik di workspace.
