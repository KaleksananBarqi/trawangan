# 0029. Neo-Quant Tonal Shell and Modern Desktop Control Primitives

Status: accepted

Untuk menghilangkan kesan kaku dan *box-in-box fatigue* dari gaya border `1px` seragam serta radius mikro `2px-4px` pada antarmuka desktop `trawangan`, kami menetapkan **Neo-Quant Tonal Shell** sebagai bahasa visual standar Desktop App. Alih-alih membungkus setiap panel, tombol, dan baris pengaturan dengan garis tepi keras, pemisahan visual dicapai melalui kontras blok permukaan tonal di atas lapisan dasar `--bg-shell` (celah struktural `2px` pada Docked Structural Shell *full-bleed*), skala radius bertingkat (`0px` shell, `5px-6px` kontrol & baris daftar, `8px` kartu/popover, `10px` modal), serta tiga primitif kontrol baru: baris pengaturan blok tonal tanpa border (`gap: 3px`), *Modern Toggle Switch* untuk status biner, dan indikator item aktif berupa latar `--bg-elevated` dengan bilah aksen kiri `2.5px`.

## Considered Options

Kami membandingkan enam arah estetika modern melalui prototipe interaktif lintas tema (*Signature*, *Surya Hitam*, *Warta Abang*):

- **A. Precision Modern Workstation (Linear / Raycast / Zed):** Bersih dan elegan, namun masih mengandalkan garis pemisah `rgba` dan terasa lebih seperti aplikasi produktivitas umum ketimbang kokpit quant.
- **B. Soft Glassy / macOS Native:** Terlihat halus, tetapi *backdrop blur* dan sudut besar (`10px-18px`) menambah kebisingan visual di sekitar kanvas chart serta menabrak pagar batas anti-slop (`R-10`).
- **C. Modern Trading Terminal (TradingView / Hyperliquid Rounded Inset):** Langsung terasa modern, tetapi celah *gutter* `5px-6px` dan kartu *inset* beradius `10px` memakan ruang bersih kanvas dan menggeser kontrak *full-bleed* ADR-0004.
- **D. Swiss Minimalist Flat:** Sangat lega untuk mode terang, tetapi terlalu renggang untuk kepadatan data terminal charting multi-panel.
- **E. Tactile Instrument (Braun / Teenage Engineering):** Ikonik dan unik, namun *bevel* fisik dan *recessed well* menuntut kalibrasi bayangan rumit agar tetap konsisten di 37 preset tema + palet kustom 9D.
- **F. Neo-Quant Contrast (Dipilih):** Menghapus seluruh kebisingan garis kotak-dalam-kotak tanpa mengorbankan kepadatan informasi maupun efisiensi ruang layar *full-bleed* ADR-0004, serta mudah diturunkan secara deterministik oleh *Adaptive Luminance Engine*.

## Consequences

- `themeEngine.ts` dan `theme.css` menambahkan token permukaan paling dalam `--bg-shell` yang dihitung deterministik untuk seluruh 37 preset bawaan (gelap & terang) dan palet kustom 9D agar kontras celah `2px` selalu terbaca tanpa bergantung pada border `1px`.
- Skala radius desktop di `theme.css` diperbarui dari `2px/3px/4px/6px` menjadi `5px/6px/8px/10px` (dengan panel perimeter shell tetap `0px` agar *full-bleed*).
- Komponen Settings, Modal, Watchlist, Header, dan Right Dock bermigrasi secara bertahap dari tombol kotak ber-border dan toggle teks `Aktif`/`Nonaktif` ke primitif tonal tanpa border, *Modern Toggle Switch*, dan *left accent bar* `2.5px`.
- `DESIGN.md` diperbarui sebagai *single source of truth* agar aturan Desktop App selaras dengan standar modern Web Showcase.
