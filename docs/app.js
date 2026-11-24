/**
 * trawangan: Logika Interaktif Etalase Web Multi-Bahasa (Tanpa Versi Statis)
 * Default Bahasa: `jv` (Basa Jawa Ngoko Arekan Cadas), mendukung `id` dan `en`.
 */

const I18N_LANDING = {
  jv: {
    skipLink: 'Loncat nang konten utama',
    navPhilosophy: 'Filosofi',
    navCompare: 'Komparasi',
    navFeatures: 'Kapabilitas',
    navGallery: 'Galeri (8)',
    navShortcuts: 'Pintasan',
    headerDownload: 'Unduh Gratis',
    heroTitle1: 'Ndelok Tajem Nembus Kabut',
    heroTitle2: 'Manipulasi Pasar.',
    heroSubtitle:
      'Terminal charting desktop native tenogo Tauri v2 lan Rust Core (~45 MB RAM). Pantau kripto global, indeks makro (TOTAL, BTC.D), Indodax IDR, saham IDX, sampek emas COMEX nang kanvas WebGL2 120 FPS, Pine Script v6 lokal, Docked Thesis Preview, lan Opt-In Broker Bridge, gratis pol selawase tanpa paywall, Rek!',
    metaBadge1: 'Rilis Stabil Resmi',
    metaBadge3: 'Zero Paywall',
    ctaWin: 'Unduh gawe Windows (.exe)',
    ctaMac: 'Unduh gawe macOS (.dmg)',
    ctaLin: 'Unduh gawe Linux (.AppImage)',
    ctaSub: 'Gratis pol selawase · Native Rust · Tanpa akun cloud',
    installerLabel: 'Installer resmi multi-platform:',
    heroCaption: 'Tangkapan layar asli desktop trawangan (Chart resik bebas overlay!)',
    spec1Title: 'Gratis Pol Selawase',
    spec1Note: 'Indikator & grid 1-4 sel bebas kuota',
    spec2Note: 'Akselerasi GPU mulus tanpa ngelag',
    spec3Title: 'RAM Super Entheng',
    spec3Note: 'Native Rust tanpa bloat Electron',
    spec4Title: 'Tema & Budaya Jawa',
    spec4Note: '31 tema Jawa + Warta Abang + Studio 9D',
    spec5Title: 'Arekan, Indo & EN',
    spec5Note: 'Jawa Ngoko Arekan Cadas dadi default',
    spec6Title: 'Broker Bridge (OFF)',
    spec6Note: 'Opsional: Binance, Bitunix & MT5 Lokal',
    philKicker: 'Makna & Karakter',
    philHeading: 'Filosofi nang Mburine trawangan',
    philBody1:
      'Jeneng trawangan dijupuk teko basa Jawa penerawangan (ꦠꦿꦮꦔꦤ꧀), ketajaman mripat kanggo nembus kabut manipulasi bandar lan noise pasar sing semrawut.',
    philBody2:
      'Akeh platform charting sing ngunci fitur dhasar nang mburi langganan wulanan larang. trawangan mbalekno meja riset 100% gratis nang laptopmu: latar peteng matte Signature sing adem nang mata, tanpa iklan popup sing nggarai emosi, lan database SQLite 100% lokal.',
    philQuote:
      '"Analisa sing bener iku lahir teko chart sing resik, pikiran sing tenang, lan R-multiple sing jelas, dudu kakehan FOMO pencet tombol ngawur, Cok!"',
    scopeHeading: 'Charting Murni Default + Opt-In Broker Bridge',
    scopeIntro:
      'Secara bawaan, trawangan mlaku murni kanggo charting tanpa tombol Buy/Sell. Nanging yen koen butuh eksekusi manual, tersedia gerbang opsional sing aman.',
    scopeIncTitle: 'Kapabilitas Inti (Aktif Bawaan)',
    scopeInc1: 'Visualisasi WebGL2 120 FPS lintas Kripto, Makro (TOTAL, BTC.D), Saham IDX, Emas COMEX & Indeks AS.',
    scopeInc2: 'Docked Thesis Preview nang jero Tab Plan (Preview | Form | Teks | Riwayat), chart resik bebas halangan!',
    scopeInc3: 'Gesture Draw by Holding (Shift+D / ~), Pine Script v6 Web Worker lokal, & Snapshot Ultra HD 6x.',
    scopeInc4: 'Startup Spotlight Tour interaktif & 3 pilihan basa (Jawa Arekan Default, Indonesia, Inggris).',
    scopeOptTitle: 'Opt-In Execution Bridge (100% Opsional · Default OFF)',
    scopeOpt1: 'Wajib ngliwati 3-Step Security Gate & Tutorial Setup Komplit nang Setelan sakdurunge aktif.',
    scopeOpt2: 'Konek langsung tanpa cloud relay nang 1. Binance, 2. Bitunix, lan 3. Broker CFD / MT5 Lokal (TrawanganMT5Bridge.mq5).',
    scopeOpt3: 'Terpisah tegas teko Trade Plan: order wajib diketik & dikonfirmasi MANUAL nang tab Order!',
    compHeading: 'Lapo Mbayar Sewa Wulanan Gawe Fitur Dhasar?',
    compSub: 'Adu mekanik langsung antarane trawangan desktop native lawan batasan akun gratisan nang platform komersial.',
    compCol1: 'Kapabilitas & Arsitektur',
    compCol3: 'Platform Komersial Gratisan',
    cRow1T: 'Tanpa wates kuota blas!',
    cRow1C: 'Dibatasi 2 - 3 indikator tok',
    cRow2T: 'Bebas 1, 2, 2H, 4 Sel + Save As',
    cRow2C: 'Dikunci nang langganan berbayar',
    cRow3T: 'Sub-tab Preview | Form | Markdown | Vault (<5ms)',
    cRow3C: 'Nggaris kotak & ngitung R manual',
    cRow4C: 'Klak-klik toolbar bolak-balik',
    cRow5T: 'Opsional (OFF): Binance, Bitunix & Local MT5 CFD',
    cRow5C: 'Terikat broker mitra tertentu',
    cRow6C: 'Data bursa ekstra sering bayar maneh',
    cRow7Title: 'Biaya & Lisensi',
    cRow7T: 'Rp 0 / $0 Selawase',
    cRow7C: 'Sewa wulanan terus-terusan',
    featKicker: 'Arsitektur Terminal',
    featHeading: 'Dirancang Gawe Riset Tajem & Eksekusi Disiplin',
    featSub: 'Saben modul mlaku entheng nang ndhuwur Rust Core lan WebGL2 ben pindah koin, coret-coret chart, sampek nyusun setup mlaku instan.',
    mod1Title: 'Tab Plan Panel Tengen, Dual-Entry & Snapshot 6x',
    mod1Desc:
      'Kartu tesis gak maneh nutupi candlestick nang chart! Kabeh pratinjau tesis saiki manggon rapi nang sub-tab Preview jero Tab Plan panel tengen. Dukung sinkronisasi Form <-> Markdown 2-arah, bobot Dual-Entry (E1 & E2), POI Context Zones, lan ekspor gambar PNG sampek 6x lengkap karo Dedicated Thesis Side Panel.',
    mod2Title: 'Koneksi Opsional Binance, Bitunix & MT5 CFD Lokal',
    mod2Desc:
      '100% opsional lan mati secara default. Yen diaktifno liwat gerbang keamanan 3 tahap nang Setelan (lengkap karo tutorial langkah-demi-langkah), koen isok eksekusi order manual nang Binance, Bitunix, utawa broker CFD MT5 opo wae lewat TrawanganMT5Bridge.mq5 (127.0.0.1), terpisah tegas teko Trade Plan!',
    mod3Desc: 'Tahan Shift+D utawa ~ terus goresno kursor nang chart gawe nggawe Trendline, Ray, Box, utawa Fibonacci otomatis. Coret zig-zag gawe mbusek objek sak detik!',
    mod4Desc: 'Bukak editor CodeMirror 6 nang sebelah chart (Alt+E) lengkap karo Console & Strategy Backtester sing mlaku terisolasi nang Web Worker lokal.',
    mod5Desc: 'Dilengkapi tutorial interaktif pas pertama mbukak aplikasi lan pilihan 3 basa instan: Jawa Ngoko Arekan Cadas (Default), Bahasa Indonesia, lan English.',
    galKicker: 'Tampilan Nyata Desktop',
    galHeading: '8 Permukaan Kerja Utama trawangan',
    galSub: 'Klik tab nang ngisor utawa gawe tombol panah keyboard kanggo ndelok tangkapan layar asli terbaru.',
    shortHeading: 'Kendali Kilat nang Drijimu',
    shortSub: 'Dirancang ben koen gak kakehan golek menu pas market lagi mlayu banter.',
    faqHeading: 'Pitakonan Teknis & Lisensi',
    faqSub: 'Jawaban blak-blakan soal lisensi Apache 2.0 + NOTICE, koneksi broker opsional, lan privasi SQLite lokal.',
    faqQ1: 'Opo bener trawangan gratis pol selawase tanpa paywall?',
    faqA1: 'Iyo rek, 100% gratis selawase! Gak ono akun Pro/Premium bayaran, indikator bebas pasang sak karepmu, lan multi-chart 1-4 sel kebukak kabeh.',
    faqQ2: 'Yok opo cara kerjane koneksi Broker Opsional (Binance, Bitunix, MT5 CFD)?',
    faqA2: 'Default-e OFF total ben chart-mu resik. Nek butuh, bukak Setelan -> Broker & Eksekusi, woco tutorial setup komplit nang jero app, lebokno API Key (dienkripsi lokal nang Rust SQLite) utawa download EA TrawanganMT5Bridge.mq5 gawe MetaTrader 5 lokal. Order wajib diketik MANUAL nang tab Order, terpisah tegas teko Trade Plan!',
    faqQ3: 'Opo aturan lisensi Apache 2.0 + NOTICE nek aplikasi iki di-fork?',
    faqA3: 'Kode sumber terbuka lan bebas dioprek, TAPI sesuai Klausul 4(d) Apache License 2.0 lan berkas NOTICE, saben fork utawa distribusi ulang WAJIB nyantumno kredit pembuat asli (Kaleksanan Barqi Aji Massani) secara jelas lan ketok mata nang dokumentasi lan tampilan Tentang Aplikasi!',
    dlHeading: 'Pasang trawangan nang Laptop / PC-mu',
    dlSub: 'Unduh paket installer biner resmi paling anyar langsung teko GitHub Releases sesuai OS-mu, utawa build dewe teko source code.',
    buildSourceLabel: 'Utawa oprek lan build langsung teko repositori sumber (Node.js 20+ & Rust):',
    footerDesc: 'Terminal charting desktop native multi-aset berbasis Tauri v2 lan Rust Core. Dirilis nang ngisore Apache License 2.0 kanthi atribusi wajib NOTICE.',
    footerDisclaimer: 'Dudu penasihat keuangan. Segala keputusan analisa lan eksekusi order manual 100% tanggung jawab pribadi.'
  },
  id: {
    skipLink: 'Lewati ke konten utama',
    navPhilosophy: 'Filosofi',
    navCompare: 'Komparasi',
    navFeatures: 'Kapabilitas',
    navGallery: 'Galeri (8)',
    navShortcuts: 'Pintasan',
    headerDownload: 'Unduh Gratis',
    heroTitle1: 'Melihat Menembus Kabut',
    heroTitle2: 'Manipulasi Pasar.',
    heroSubtitle:
      'Terminal charting desktop native berbasis Tauri v2 dan Rust Core (~45 MB RAM). Analisis kripto global, indeks makro (TOTAL, BTC.D), Indodax IDR, saham IDX, hingga emas COMEX lewat kanvas WebGL2 120 FPS, Pine Script v6 lokal, Docked Thesis Preview, dan Opt-In Broker Bridge tanpa paywall.',
    metaBadge1: 'Rilis Stabil Resmi',
    metaBadge3: 'Zero Paywall',
    ctaWin: 'Unduh untuk Windows (.exe)',
    ctaMac: 'Unduh untuk macOS (.dmg)',
    ctaLin: 'Unduh untuk Linux (.AppImage)',
    ctaSub: 'Gratis selamanya · Native Rust · Tanpa akun cloud',
    installerLabel: 'Installer resmi multi-platform:',
    heroCaption: 'Tangkapan layar asli desktop trawangan (Kanvas bersih bebas halangan)',
    spec1Title: 'Zero Paywall Selamanya',
    spec1Note: 'Indikator & grid 1-4 sel bebas kuota',
    spec2Note: 'Kanvas grafis akselerasi GPU mulus',
    spec3Title: 'RAM Ultra Ringan',
    spec3Note: 'Native Rust tanpa beban Electron',
    spec4Title: 'Tema & Budaya Jawa',
    spec4Note: '31 tema Jawa + Warta Abang + Studio 9D',
    spec5Title: '3 Bahasa Reaktif',
    spec5Note: 'Jawa Arekan (Default), Indonesia & EN',
    spec6Title: 'Broker Bridge (OFF)',
    spec6Note: 'Opsional: Binance, Bitunix & MT5 Lokal',
    philKicker: 'Makna & Prinsip',
    philHeading: 'Filosofi di Balik trawangan',
    philBody1:
      'Nama trawangan berasal dari kosakata Jawa penerawangan (ꦠꦿꦮꦔꦤ꧀), yang bermakna ketajaman melihat menembus kabut ilusi dan kesimpangsiuran situasi pasar.',
    philBody2:
      'Di tengah platform charting yang mengunci fitur dasar di balik langganan bulanan, trawangan mengembalikan kendali penuh meja analisis ke perangkat lokal Anda tanpa iklan dan 100% berbasis SQLite offline.',
    philQuote:
      '"Analisis yang jernih lahir dari kanvas grafik yang bersih, rasio risiko yang terukur, dan disiplin eksekusi tanpa paksaan langganan."',
    scopeHeading: 'Charting Murni Bawaan + Opt-In Broker Bridge',
    scopeIntro:
      'Secara default trawangan berjalan murni tanpa tombol Buy/Sell untuk mencegah klik impulsif, dilengkapi jembatan eksekusi manual opsional bagi yang membutuhkan.',
    scopeIncTitle: 'Kapabilitas Inti (Aktif Bawaan)',
    scopeInc1: 'Visualisasi WebGL2 120 FPS untuk Kripto, Indeks Makro (TOTAL, BTC.D), Saham IDX, Emas COMEX & Indeks AS.',
    scopeInc2: 'Docked Thesis Preview di dalam Tab Plan (Preview | Form | Teks | Riwayat) sehingga kanvas bebas tertutup kartu.',
    scopeInc3: 'Gesture Draw by Holding (Shift+D / ~), Pine Script v6 Web Worker lokal, & Snapshot Ultra HD 6x.',
    scopeInc4: 'Startup Spotlight Tour interaktif & 3 pilihan bahasa (Jawa Arekan Default, Indonesia, Inggris).',
    scopeOptTitle: 'Opt-In Execution Bridge (100% Opsional · Default OFF)',
    scopeOpt1: 'Wajib melewati 3-Step Security Gate & Tutorial Setup Lengkap di Pengaturan sebelum aktif.',
    scopeOpt2: 'Terhubung langsung tanpa server cloud ke 1. Binance, 2. Bitunix, dan 3. Broker CFD / MT5 Lokal (TrawanganMT5Bridge.mq5).',
    scopeOpt3: 'Dipisahkan tegas dari Trade Plan: seluruh order wajib diketik & dikonfirmasi MANUAL di tab Order.',
    compHeading: 'Mengapa Membayar Sewa Bulanan untuk Fitur Dasar?',
    compSub: 'Perbandingan langsung antara trawangan desktop native dengan tier gratis platform komersial.',
    compCol1: 'Kapabilitas & Arsitektur',
    compCol3: 'Platform Komersial Gratis',
    cRow1T: 'Tanpa batas kuota di satu kanvas',
    cRow1C: 'Dibatasi 2 - 3 indikator',
    cRow2T: 'Penuh 1, 2, 2H, 4 Sel + Save As',
    cRow2C: 'Dikunci di langganan berbayar',
    cRow3T: 'Sub-tab Preview | Form | Markdown | Vault (<5ms)',
    cRow3C: 'Tarik kotak & hitung R manual',
    cRow4C: 'Klik ikon toolbar berulang kali',
    cRow5T: 'Opsional (OFF): Binance, Bitunix & Local MT5 CFD',
    cRow5C: 'Terikat broker afiliasi tertentu',
    cRow6C: 'Data tambahan sering berbayar',
    cRow7Title: 'Biaya & Lisensi',
    cRow7T: 'Rp 0 / $0 Selamanya',
    cRow7C: 'Langganan berulang tiap bulan',
    featKicker: 'Arsitektur Terminal',
    featHeading: 'Direkayasa untuk Kecepatan Riset & Disiplin Eksekusi',
    featSub: 'Setiap subsistem dibangun di atas Rust Core dan WebGL2 agar perpindahan instrumen dan penyusunan Trade Plan berlangsung instan.',
    mod1Title: 'Tab Plan Panel Kanan, Dual-Entry & Snapshot 6x',
    mod1Desc:
      'Kartu tesis kini terintegrasi di sub-tab Preview dalam Tab Plan dock kanan agar lilin harga tidak tertutup. Mendukung sinkronisasi Form <-> Markdown 2-arah, Dual-Entry (E1 & E2), POI Context Zones, dan ekspor PNG 6x dengan Dedicated Thesis Side Panel.',
    mod2Title: 'Koneksi Opsional Binance, Bitunix & MT5 CFD Lokal',
    mod2Desc:
      '100% opsional dan mati secara bawaan. Setelah melewati gerbang keamanan 3 tahap beserta tutorial lengkap di Pengaturan, gunakan tab Order untuk mengirim order manual ke Binance, Bitunix, atau MT5 CFD via TrawanganMT5Bridge.mq5, terpisah tegas dari Trade Plan.',
    mod3Desc: 'Tahan Shift+D atau ~ dan goreskan kursor di kanvas untuk menggambar Trendline, Ray, Box, atau Fibonacci instan; coret zig-zag untuk menghapus.',
    mod4Desc: 'Buka editor CodeMirror 6 berdampingan dengan grafik (Alt+E) beserta Console & Backtester di dalam Web Worker lokal.',
    mod5Desc: 'Dilengkapi tur orientasi interaktif saat peluncuran awal dan dukungan tiga bahasa instan (Jawa Arekan Default, Indonesia, Inggris).',
    galKicker: 'Tampilan Nyata Desktop',
    galHeading: '8 Permukaan Kerja Utama trawangan',
    galSub: 'Pilih tab di bawah atau gunakan tombol panah keyboard untuk memeriksa tangkapan layar asli.',
    shortHeading: 'Kendali Cepat di Ujung Jemari',
    shortSub: 'Dirancang agar analis tidak perlu memecah konsentrasi mencari menu saat harga bergerak cepat.',
    faqHeading: 'Detail Teknis & Lisensi',
    faqSub: 'Penjelasan mengenai lisensi Apache 2.0 + NOTICE, koneksi broker opsional, dan penyimpanan SQLite offline.',
    faqQ1: 'Apakah trawangan benar-benar gratis selamanya tanpa paywall?',
    faqA1: 'Ya, 100% gratis selamanya tanpa tier berbayar, tanpa batasan jumlah indikator per kanvas, dan bebas memakai grid 1 hingga 4 sel.',
    faqQ2: 'Bagaimana cara kerja Opt-In Execution Bridge (Binance, Bitunix, MT5 CFD)?',
    faqA2: 'Secara bawaan fitur ini OFF total. Anda dapat membukanya di Pengaturan -> Broker & Eksekusi dengan mengikuti tutorial lengkap di dalam aplikasi. Order wajib diinput manual melalui tab Order yang terpisah tegas dari Trade Plan.',
    faqQ3: 'Apa kewajiban lisensi Apache 2.0 + NOTICE jika proyek ini di-fork?',
    faqA3: 'Sesuai Klausul 4(d) Apache License 2.0 dan berkas NOTICE, setiap fork atau distribusi ulang WAJIB mencantumkan atribusi pembuat asli (Kaleksanan Barqi Aji Massani) secara jelas dan terlihat pada dokumentasi dan dialog Tentang Aplikasi.',
    dlHeading: 'Pasang trawangan di Perangkat Anda',
    dlSub: 'Unduh paket installer biner resmi terbaru dari GitHub Releases sesuai sistem operasi Anda, atau kompilasi langsung dari kode sumber.',
    buildSourceLabel: 'Atau bangun langsung dari repositori sumber (membutuhkan Node.js 20+ dan Rust):',
    footerDesc: 'Terminal charting desktop native multi-aset berbasis Tauri v2 dan Rust Core di bawah lisensi Apache 2.0 + Mandatory NOTICE.',
    footerDisclaimer: 'Bukan penasihat keuangan. Segala analisis dan eksekusi order manual sepenuhnya tanggung jawab pengguna.'
  },
  en: {
    skipLink: 'Skip to main content',
    navPhilosophy: 'Philosophy',
    navCompare: 'Compare',
    navFeatures: 'Capabilities',
    navGallery: 'Gallery (8)',
    navShortcuts: 'Shortcuts',
    headerDownload: 'Free Download',
    heroTitle1: 'Piercing Through the Fog of',
    heroTitle2: 'Market Manipulation.',
    heroSubtitle:
      'Ultra-lightweight native desktop charting terminal powered by Tauri v2 & Rust Core (~45 MB RAM). Analyze global crypto, macro indices (TOTAL, BTC.D), Indodax IDR, IDX stocks, and COMEX gold on a 120 FPS WebGL2 canvas with local Pine Script v6, Docked Thesis Preview, and Opt-In Broker Bridge, zero paywall forever.',
    metaBadge1: 'Official Stable Release',
    metaBadge3: 'Zero Paywall',
    ctaWin: 'Download for Windows (.exe)',
    ctaMac: 'Download for macOS (.dmg)',
    ctaLin: 'Download for Linux (.AppImage)',
    ctaSub: 'Free forever · Native Rust · No cloud account',
    installerLabel: 'Official multi-platform installers:',
    heroCaption: 'Authentic desktop capture of trawangan (Zero canvas overlay clutter)',
    spec1Title: 'Zero Paywall Forever',
    spec1Note: 'Unlimited indicators & 1-4 cell grids',
    spec2Note: 'Hardware-accelerated GPU canvas',
    spec3Title: 'Ultra-Light RAM',
    spec3Note: 'Native Rust without Electron bloat',
    spec4Title: 'Javanese & Custom Themes',
    spec4Note: '37 official presets + 9D Palette Studio',
    spec5Title: '3 Live Languages',
    spec5Note: 'Javanese Arekan (Default), ID & EN',
    spec6Title: 'Broker Bridge (OFF)',
    spec6Note: 'Optional: Binance, Bitunix & Local MT5',
    philKicker: 'Meaning & Principles',
    philHeading: 'The Philosophy Behind trawangan',
    philBody1:
      'trawangan comes from the Javanese word penerawangan (ꦠꦿꦮꦔꦤ꧀), sharp perceptual clarity cutting through market illusions and noise.',
    philBody2:
      'While commercial platforms lock multi-chart grids and indicator slots behind recurring subscriptions, trawangan restores complete local ownership on your machine with offline SQLite storage and zero ads.',
    philQuote:
      '"Objective technical analysis thrives on an unobstructed chart, deterministic R-multiples, and disciplined execution free from paywalls."',
    scopeHeading: 'Pure Charting by Default + Opt-In Broker Bridge',
    scopeIntro:
      'Out of the box, trawangan runs with zero Buy/Sell buttons to prevent impulsive trades, while offering an optional gated bridge for manual execution.',
    scopeIncTitle: 'Core Capabilities (Enabled by Default)',
    scopeInc1: '120 FPS WebGL2 charting across Crypto, Macro Indices (TOTAL, BTC.D), IDX Stocks, COMEX Gold & US Indices.',
    scopeInc2: 'Docked Thesis Preview inside the right-hand Plan tab (Preview | Form | Markdown | Vault), zero floating clutter.',
    scopeInc3: 'Draw by Holding gestures (Shift+D / ~), isolated Pine Script v6 Web Worker, & up-to-6x Ultra HD Snapshots.',
    scopeInc4: 'Interactive Startup Spotlight Tour & 3 built-in languages (Javanese Arekan Default, Indonesian, English).',
    scopeOptTitle: 'Opt-In Execution Bridge (100% Optional · Default OFF)',
    scopeOpt1: 'Requires completing a 3-Step Security Gate & complete in-app setup guide in Settings.',
    scopeOpt2: 'Direct zero-cloud-relay connectors for 1. Binance, 2. Bitunix, and 3. CFD Brokers / Local MT5 (TrawanganMT5Bridge.mq5).',
    scopeOpt3: 'Strictly decoupled from Trade Plans: all orders require explicit MANUAL entry in the Order tab.',
    compHeading: 'Why Pay Monthly Rent for Essential Tools?',
    compSub: 'Direct comparison between native desktop trawangan and commercial cloud free tiers.',
    compCol1: 'Capability & Architecture',
    compCol3: 'Commercial Free Tiers',
    cRow1T: 'Unlimited per canvas',
    cRow1C: 'Capped at 2 - 3 indicators',
    cRow2T: 'Full 1, 2, 2H, 4 Cells + Save As',
    cRow2C: 'Locked behind paid subscriptions',
    cRow3T: 'Docked Preview | Form | Markdown | Vault (<5ms)',
    cRow3C: 'Manual box drawing & R math',
    cRow4C: 'Repeated toolbar clicking',
    cRow5T: 'Optional (OFF): Binance, Bitunix & Local MT5 CFD',
    cRow5C: 'Tied to specific partner brokers',
    cRow6C: 'Extra exchange feeds often paid',
    cRow7Title: 'Cost & License',
    cRow7T: '$0 Forever',
    cRow7C: 'Recurring monthly subscription',
    featKicker: 'Terminal Architecture',
    featHeading: 'Engineered for Rapid Research & Disciplined Execution',
    featSub: 'Built on Rust Core and WebGL2 so symbol switching, multi-pane sketching, and trade planning feel instantaneous.',
    mod1Title: 'Docked Right-Panel Plan Tab, Dual-Entry & 6x Snapshots',
    mod1Desc:
      'Thesis cards live cleanly inside the Preview sub-tab of the Plan dock rather than floating over candlesticks. Enjoy lossless Form <-> Markdown sync, weighted Dual-Entry (E1 & E2), POI Context Zones, and 6x PNG exports with a Dedicated Thesis Side Panel.',
    mod2Title: 'Optional Binance, Bitunix & Local MT5 CFD Execution',
    mod2Desc:
      '100% optional and OFF by default. Unlock via a 3-step security gate with complete step-by-step tutorials in Settings to send manual orders to Binance, Bitunix, or any MT5 CFD broker via TrawanganMT5Bridge.mq5, strictly separated from Trade Plans.',
    mod3Desc: 'Hold Shift+D or ~ and sketch on the canvas to create Trendlines, Boxes, or Fibs automatically; scribble zig-zag to erase.',
    mod4Desc: 'Open the side-by-side CodeMirror 6 IDE (Alt+E) with Console & Strategy Backtester running in an isolated Web Worker.',
    mod5Desc: 'Includes a 6-step interactive first-run Spotlight Tour and instant switching across Javanese Arekan (Default), Indonesian, and English.',
    galKicker: 'Real Desktop Interface',
    galHeading: '8 Core Workspaces of trawangan',
    galSub: 'Select any tab below or use keyboard arrow keys to inspect authentic desktop captures.',
    shortHeading: 'Keyboard-First Control',
    shortSub: 'Built so analysts stay focused on price action without hunting through nested menus.',
    faqHeading: 'Technical & Licensing FAQ',
    faqSub: 'Straightforward answers on Apache 2.0 + NOTICE attribution, opt-in broker routing, and local SQLite privacy.',
    faqQ1: 'Is trawangan truly free forever with zero paywalls?',
    faqA1: 'Yes, 100% free forever with no Pro/Premium tiers, unlimited indicators per chart, and full 1-to-4 multi-chart grid layouts.',
    faqQ2: 'How does the Opt-In Execution Bridge (Binance, Bitunix, MT5 CFD) work?',
    faqA2: 'It is completely OFF by default. You can unlock it in Settings -> Brokers & Execution with step-by-step tutorials, local Rust credential encryption, and 1-click TrawanganMT5Bridge.mq5 generation. Every order is entered manually in the Order tab, strictly decoupled from Trade Plans.',
    faqQ3: 'What are the Apache 2.0 + NOTICE requirements if I fork this app?',
    faqA3: 'Under Apache License 2.0 Section 4(d) and our NOTICE file, any fork or redistribution MUST prominently retain and display explicit credit to the original author (Kaleksanan Barqi Aji Massani) in documentation and the About UI screen.',
    dlHeading: 'Install trawangan on Your Machine',
    dlSub: 'Download the latest official native installer from GitHub Releases for your OS, or compile directly from source.',
    buildSourceLabel: 'Or build directly from source repository (requires Node.js 20+ and Rust):',
    footerDesc: 'Native multi-asset desktop charting terminal powered by Tauri v2 and Rust Core under Apache License 2.0 + Mandatory NOTICE.',
    footerDisclaimer: 'Not financial advice. All chart analysis and manual order execution are 100% at the user’s own risk.'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ctaLabel = document.getElementById('cta-target-os');
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform =
    window.navigator?.userAgentData?.platform?.toLowerCase() ||
    window.navigator.platform?.toLowerCase() ||
    '';

  let detectedOs = 'windows';
  if (platform.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os')) {
    detectedOs = 'macos';
  } else if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) {
    detectedOs = 'linux';
  }

  let activeLang = 'jv';
  try {
    const saved = localStorage.getItem('trawangan_landing_lang');
    if (saved === 'jv' || saved === 'id' || saved === 'en') {
      activeLang = saved;
    }
  } catch (_) {}

  const langButtons = Array.from(document.querySelectorAll('.lang-btn'));

  function applyLanguage(lang) {
    const dict = I18N_LANDING[lang] || I18N_LANDING.jv;
    activeLang = lang;
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && dict[key]) {
        el.textContent = dict[key];
      }
    });

    if (ctaLabel) {
      if (detectedOs === 'macos') ctaLabel.textContent = dict.ctaMac;
      else if (detectedOs === 'linux') ctaLabel.textContent = dict.ctaLin;
      else ctaLabel.textContent = dict.ctaWin;
    }

    langButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    try {
      localStorage.setItem('trawangan_landing_lang', lang);
    } catch (_) {}
  }

  langButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-lang') || 'jv';
      applyLanguage(next);
    });
  });

  applyLanguage(activeLang);

  // Mobile Menu Drawer
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  function setMenuState(open) {
    if (!navToggle || !navMenu) return;
    navMenu.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      setMenuState(!navMenu.classList.contains('nav-open'));
    });

    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => setMenuState(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('nav-open')) {
        setMenuState(false);
        navToggle.focus();
      }
    });
  }

  // Gallery Tabs (8 Screenshots)
  const tabButtons = Array.from(document.querySelectorAll('.gallery-tab-btn'));
  const panels = Array.from(document.querySelectorAll('.gallery-panel'));

  function activateTab(index, moveFocus = false) {
    const btn = tabButtons[index];
    if (!btn) return;
    const targetId = btn.getAttribute('data-target');

    tabButtons.forEach((b, i) => {
      const isActive = i === index;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      b.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach((panel) => {
      const isActive = panel.id === `panel-${targetId}`;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
      if (isActive) {
        const panelImg = panel.querySelector('img[loading="lazy"]');
        if (panelImg) panelImg.loading = 'eager';
      }
    });

    if (moveFocus) btn.focus();
  }

  tabButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => activateTab(index, false));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        activateTab((index + 1) % tabButtons.length, true);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        activateTab((index - 1 + tabButtons.length) % tabButtons.length, true);
      } else if (e.key === 'Home') {
        e.preventDefault();
        activateTab(0, true);
      } else if (e.key === 'End') {
        e.preventDefault();
        activateTab(tabButtons.length - 1, true);
      }
    });
  });

  // Smooth Scroll
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetHref = this.getAttribute('href');
      if (!targetHref || targetHref === '#') return;
      const targetEl = document.querySelector(targetHref);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({
          behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
          block: 'start'
        });
      }
    });
  });

  // FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector('.faq-question');
    if (!questionBtn) return;
    questionBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach((other) => {
        if (other !== item) {
          other.classList.remove('active');
          other.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('active', !isActive);
      questionBtn.setAttribute('aria-expanded', !isActive ? 'true' : 'false');
    });
  });

  // Copy Build Command
  const copyBtn = document.getElementById('copy-build-cmd');
  const buildCmdEl = document.getElementById('build-cmd-text');
  let copyResetTimer = null;

  if (copyBtn && buildCmdEl) {
    copyBtn.addEventListener('click', async () => {
      const commandText = buildCmdEl.textContent?.trim() || '';
      if (!commandText) return;
      try {
        await navigator.clipboard.writeText(commandText);
        copyBtn.textContent = 'Copied!';
      } catch (_) {
        copyBtn.textContent = 'Ctrl+C';
      }
      if (copyResetTimer) clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => {
        copyBtn.textContent = 'Salin Perintah';
      }, 2200);
    });
  }
});
