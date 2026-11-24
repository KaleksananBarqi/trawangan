/**
 * Arekan Localization Engine (`src/lib/i18n/index.ts`)
 *
 * Sistem lokalisasi 3 bahasa ringan (Zero External Bloat) dengan:
 * - `jv` (Default): Basa Jawa Ngoko Arekan Cadas / Suroboyoan
 * - `id`: Bahasa Indonesia
 * - `en`: English
 *
 * Istilah teknis pasar (Candlestick, Timeframe, Watchlist, Entry, Stop Loss, Take Profit,
 * Bullish, Bearish, Leverage, Lot, R-Multiple) tetap dipertahankan dalam bahasa Inggris standar.
 */

import { writable, derived, get, type Readable } from 'svelte/store';
import type { AppLanguage } from '../types/market';

export type { AppLanguage };

export const SUPPORTED_LANGUAGES: ReadonlyArray<{
  code: AppLanguage;
  shortLabel: string;
  label: string;
  badge: string;
}> = [
  { code: 'jv', shortLabel: 'JV', label: 'Jawa Ngoko Arekan (Default)', badge: 'ꦗꦮ' },
  { code: 'id', shortLabel: 'ID', label: 'Bahasa Indonesia', badge: 'ID' },
  { code: 'en', shortLabel: 'EN', label: 'English', badge: 'EN' }
] as const;

const dictionaries: Record<AppLanguage, Record<string, string>> = {
  jv: {
    // Common
    'common.done': 'Beres, Gas!',
    'common.close': 'Tutupen',
    'common.cancel': 'Gak Sido',
    'common.save': 'Simpenen',
    'common.delete': 'Busek',
    'common.copied': 'Wis Kesalin!',
    'common.reset': 'Balikno Awal',

    // Top bar & Header
    'header.searchPlaceholder': 'Golek koin, saham IDX, emas utawa makro (Ctrl+K)...',
    'header.settings': 'Setelan',
    'header.tutorial': 'Tutorial',
    'header.indicators': 'Indikator',
    'header.addTab': 'Bukak tab chart anyar',
    'header.langTooltip': 'Ganti Basa (Jawa Arekan / Indo / Inggris)',
    'header.watchlistAdd': 'Lebokno nang Watchlist',
    'header.watchlistRemove': 'Busek teko Watchlist',
    'header.providerSwitch': 'Ganti Bursa / Sumber Data',

    // Right Dock Rail
    'dock.watchlist': 'Watchlist & Rega Live',
    'dock.alerts': 'Price Alerts',
    'dock.objects': 'Object Tree & Indikator',
    'dock.datawindow': 'Data Window Inspector',
    'dock.plan': 'Trade Plan: Preview, Form, Teks & Vault',
    'dock.events': 'Kalender Makroekonomi',
    'dock.order': 'Order Manual & Broker (Opsional)',
    'dock.pine': 'Pine Script v6 IDE & Backtester',
    'dock.hidePanel': 'Singidno Panel',
    'dock.openPanel': 'Bukak Panel',

    // Trade Plan & Docked Thesis Preview
    'plan.tabPreview': 'Preview',
    'plan.tabForm': 'Form',
    'plan.tabText': 'Teks',
    'plan.tabHistory': 'Riwayat',
    'plan.editBtn': 'Edit',
    'plan.editInForm': 'Oprek plan iki nang Form',
    'plan.copyMarkdown': 'Salin tabel Markdown plan iki',
    'plan.newPlan': 'Gawe Plan Anyar',
    'plan.deletePlan': 'Busek Plan iki teko Chart',
    'plan.emptyPreviewTitle': 'Durung Ono Setup Plan Aktif, Rek!',
    'plan.emptyPreviewDesc': 'Ojok asal pencet Buy/Sell koyok wong ngawur, Cok! Gawe trade plan dhisik nang tab Form utawa paste draf Markdown (Ctrl+V) ben R-multiple karo SL-mu jelas.',
    'plan.createFirstPlan': 'Gas Gawe Trade Plan',
    'plan.autoAlerts': 'Pasang Alert Otomatis (Entry, SL & TP)',
    'plan.applyChanges': 'Simpen Oprekan Plan',
    'plan.applyToChart': 'Gas Pasang nang Chart',

    // Settings Modal
    'settings.title': 'Setelan Terminal & Telemetri Sistem',
    'settings.navGeneral': 'Umum, Basa & Audio',
    'settings.navAppearance': 'Tema & Werna',
    'settings.navTypography': 'Tipografi & Teks',
    'settings.navChart': 'Kanvas & Grafik',
    'settings.navProfile': 'Profil & Watermark',
    'settings.navFeed': 'Data Feed Pasar',
    'settings.navBroker': 'Broker & Eksekusi',
    'settings.navSystem': 'Sistem & Telemetri',
    'settings.navAbout': 'Tentang & Lisensi',
    'settings.navHelp': 'Bantuan & Shortcut',
    'settings.langLabel': 'Basa Terminal (Language)',
    'settings.langDesc': 'Pilih basa antarmuka terminal. Default nggawe Basa Jawa Ngoko Arekan Cadas!',
    'settings.replayTutorialLabel': 'Tutorial Start-Up Interaktif',
    'settings.replayTutorialDesc': 'Bingung cara nggawe Draw by Holding, Trade Plan, utawa konek Broker? Puterno maneh tutorial awal.',
    'settings.replayTutorialBtn': 'Puterno Tutorial Maneh',

    // About & License
    'about.tagline': 'Penerawangan Tajem Nembus Kabut Manipulasi Pasar · Gratis Pol Selawase!',
    'about.desc': 'Terminal charting multi-aset & kripto desktop super entheng (~45 MB RAM) tenogo Tauri v2 Rust, WebGL2 Vela 120 FPS, lan Pine Script v6 lokal. Charting murni tanpa paywall, ditambah opsi koneksi eksekusi broker manual nek koen butuh.',
    'about.licenseTitle': 'Lisensi Apache 2.0 + Atribusi Wajib (NOTICE)',
    'about.licenseBody': 'Dirilis nganggo Apache License 2.0. Bebas dioprek lan di-fork, TAPI sopo wae sing nge-fork utawa nyebarno ulang WAJIB nyantumno kredit asli secara JELAS & KLIR nang dokumentasi lan menu Tentang Aplikasi sesuai berkas NOTICE. Dilarang ndaku karya wong liyo, Cok!',

    // Startup Spotlight Tour
    'tour.badge': 'PANDUAN KILAT TRAWANGAN',
    'tour.skip': 'Skip Wae Lah',
    'tour.prev': 'Mbalik',
    'tour.next': 'Lanjut Gas',
    'tour.finish': 'Sikat! Mulai Nganalisa',
    'tour.step1Title': 'Sugeng Rawuh nang trawangan, Rek!',
    'tour.step1Body': 'Terminal charting desktop gratis pol, entheng puol (~45 MB RAM), gak pake langganan larang-larang! Sakdurunge gas nganalisa market, pilih dhisik basa lan mode werna sing paling cocok karo matamu.',
    'tour.step2Title': 'Golek Koin, Saham IDX, Emas & Makro (Ctrl+K)',
    'tour.step2Body': 'Ketik langsung huruf opo wae nang kanvas utawa pencet Ctrl+K! Kabeh ono: Kripto (Binance, Indodax IDR, Bitunix), Indeks Makro (TOTAL, TOTAL2, BTC.D), Saham Indo (BBCA.JK), sampek Emas COMEX (XAUUSD / GC=F), gratis tanpa API key!',
    'tour.step3Title': 'Draw by Holding (Shift+D / ~) & Scribble Erase',
    'tour.step3Body': 'Gak perlu klak-klik toolbar bolak-balik! Tahan tombol ~ utawa pencet Shift+D, terus goresno kursor nang chart: garis lurus dadi Trendline, kotak dadi Box, zig-zag langsung mbusek gambar! Cepet pol gawe nandani SNR & FVG.',
    'tour.step4Title': 'Tab Plan & Docked Thesis Preview (Ctrl+Shift+P)',
    'tour.step4Body': 'Kartu tesis saiki wis dipindah rapi nang jero Tab Plan panel tengen (sub-tab Preview) ben chart-mu resik gak ketutupan! Koen isok nulis nang Form, paste tabel Markdown (Ctrl+V), ngitung Dual-Entry + R-Multiple otomatis, lan nyimpen nang Vault.',
    'tour.step5Title': 'Pine Script v6 IDE (Alt+E) & Snapshot Ultra HD 6x',
    'tour.step5Body': 'Pasang indikator sak karepmu tanpa kuota! Bukak editor Pine v6 nang sebelah chart (Alt+E) sing mlaku nang Web Worker lokal. Nek analisa wis mateng, pencet Ctrl+Shift+S gawe ekspor gambar bening sampek 6x resolusi lengkap karo Thesis Side Panel!',
    'tour.step6Title': 'Koneksi Broker Opsional (Binance, Bitunix, MT5 CFD)',
    'tour.step6Body': 'Default-e trawangan iku murni charting ben koen gak gampang FOMO pencet Buy/Sell, Cok! Tapi nek koen wis siap tempur, bukak Setelan -> Broker & Eksekusi gawe ngaktifno Manual Order Ticket nang Binance, Bitunix, utawa MT5 CFD lokal.',

    // Broker & Execution Bridge
    'broker.tabTitle': 'Opt-In Execution Bridge (Binance, Bitunix & MT5 CFD)',
    'broker.tabSubtitle': '100% Opsional (Default OFF). Order dieksekusi MANUAL teko tab Order, terpisah tegas teko Trade Plan.',
    'broker.step1Title': 'Tahap 1: Persetujuan Risiko Mandiri (Wajib)',
    'broker.step1Warn': 'PERINGATAN KERAS: Kabeh API Key & Secret disimpen terenkripsi LOKAL nang laptop/PC-mu dewe tanpa server cloud trawangan. Risiko salah input lot, leverage, likuidasi, utawa rugi market 100% tanggung jawabmu pribadi!',
    'broker.step1ConfirmPlaceholder': 'Ketik GAS utawa SETUJU gawe mbukak kunci...',
    'broker.step1UnlockBtn': 'Bukak Kunci Setelan Broker',
    'broker.masterSwitchLabel': 'Aktifno Tab Manual Order Ticket nang Dock Kanan',
    'broker.masterSwitchDesc': 'Nek dipateni, kabeh tombol Buy/Sell lan ikon tab Order ilang resik teko layar.',
    'broker.orderTabTitle': 'MANUAL ORDER TICKET',
    'broker.planSeparatedNotice': 'Terpisah tegas teko Trade Plan: kabeh angka order wajib koen lebokno manual!'
  },
  id: {
    // Common
    'common.done': 'Selesai',
    'common.close': 'Tutup',
    'common.cancel': 'Batal',
    'common.save': 'Simpan',
    'common.delete': 'Hapus',
    'common.copied': 'Tersalin!',
    'common.reset': 'Reset',

    // Top bar & Header
    'header.searchPlaceholder': 'Cari koin, saham IDX, emas atau makro (Ctrl+K)...',
    'header.settings': 'Pengaturan',
    'header.tutorial': 'Tutorial',
    'header.indicators': 'Indikator',
    'header.addTab': 'Buka tab chart baru',
    'header.langTooltip': 'Ganti Bahasa (Jawa Arekan / Indonesia / English)',
    'header.watchlistAdd': 'Tambahkan ke Watchlist',
    'header.watchlistRemove': 'Hapus dari Watchlist',
    'header.providerSwitch': 'Ganti Bursa / Data Feed',

    // Right Dock Rail
    'dock.watchlist': 'Watchlist & Ticker Harga',
    'dock.alerts': 'Price Alerts',
    'dock.objects': 'Object Tree & Indikator',
    'dock.datawindow': 'Data Window Inspector',
    'dock.plan': 'Trade Plan: Preview, Form, Teks & Riwayat',
    'dock.events': 'Kalender Makroekonomi',
    'dock.order': 'Order Manual & Broker (Opsional)',
    'dock.pine': 'Pine Script v6 IDE & Backtester',
    'dock.hidePanel': 'Sembunyikan Panel',
    'dock.openPanel': 'Buka Panel',

    // Trade Plan & Docked Thesis Preview
    'plan.tabPreview': 'Preview',
    'plan.tabForm': 'Form',
    'plan.tabText': 'Teks',
    'plan.tabHistory': 'Riwayat',
    'plan.editBtn': 'Edit',
    'plan.editInForm': 'Edit rencana ini di Form',
    'plan.copyMarkdown': 'Salin tabel Markdown rencana ini',
    'plan.newPlan': 'Buat Plan Baru',
    'plan.deletePlan': 'Hapus Plan dari Grafik',
    'plan.emptyPreviewTitle': 'Belum Ada Trade Plan Aktif',
    'plan.emptyPreviewDesc': 'Susun rencana trading Anda terlebih dahulu lewat tab Form atau tempel tabel Markdown (Ctrl+V) untuk menampilkan kartu tesis lengkap di sini.',
    'plan.createFirstPlan': 'Buat Trade Plan Baru',
    'plan.autoAlerts': 'Alert Otomatis (Entry, SL & TP)',
    'plan.applyChanges': 'Terapkan Perubahan',
    'plan.applyToChart': 'Terapkan ke Chart',

    // Settings Modal
    'settings.title': 'Pengaturan & Telemetri Sistem',
    'settings.navGeneral': 'Umum, Bahasa & Audio',
    'settings.navAppearance': 'Tema & Warna',
    'settings.navTypography': 'Tipografi & Teks',
    'settings.navChart': 'Kanvas & Grafik',
    'settings.navProfile': 'Profil & Watermark',
    'settings.navFeed': 'Data Feed',
    'settings.navBroker': 'Broker & Eksekusi',
    'settings.navSystem': 'Sistem & Telemetri',
    'settings.navAbout': 'Tentang Aplikasi',
    'settings.navHelp': 'Bantuan & Shortcut',
    'settings.langLabel': 'Bahasa Antarmuka (Language)',
    'settings.langDesc': 'Pilih bahasa tampilan aplikasi (Jawa Ngoko Arekan, Indonesia, atau Inggris).',
    'settings.replayTutorialLabel': 'Panduan Tutorial Start-Up',
    'settings.replayTutorialDesc': 'Putar ulang tur pengenalan fitur utama trawangan dari awal.',
    'settings.replayTutorialBtn': 'Buka Tutorial Start-Up',

    // About & License
    'about.tagline': 'Visi Menembus Kabut Manipulasi Pasar · Zero Paywall',
    'about.desc': 'Terminal charting multi-aset & kripto desktop ultra-ringan (~45 MB RAM) bertenaga Tauri v2 Rust, WebGL2 Vela 120 FPS, dan Pine Script v6 lokal dengan dukungan koneksi eksekusi broker manual opsional.',
    'about.licenseTitle': 'Lisensi Apache 2.0 + Atribusi Wajib (NOTICE)',
    'about.licenseBody': 'Didistribusikan di bawah Apache License 2.0. Setiap fork, modifikasi, atau distribusi ulang WAJIB mempertahankan atribusi pembuat asli secara jelas dan eksplisit di berkas NOTICE, dokumentasi, dan dialog Tentang Aplikasi.',

    // Startup Spotlight Tour
    'tour.badge': 'TUR ORIENTASI TRAWANGAN',
    'tour.skip': 'Lewati Tutorial',
    'tour.prev': 'Sebelumnya',
    'tour.next': 'Berikutnya',
    'tour.finish': 'Mulai Analisis',
    'tour.step1Title': 'Selamat Datang di trawangan!',
    'tour.step1Body': 'Terminal charting desktop native ultra-ringan (~45 MB RAM) dan 100% gratis tanpa paywall. Pilih bahasa antarmuka dan skema warna favorit Anda sebelum memulai.',
    'tour.step2Title': 'Eksplorasi Multi-Aset & Makro (Ctrl+K)',
    'tour.step2Body': 'Ketik huruf langsung di kanvas atau tekan Ctrl+K untuk membuka aset Kripto (Binance, Indodax IDR, Bitunix), Indeks Makro (TOTAL, BTC.D), Saham IDX (BBCA.JK), hingga Emas COMEX (XAUUSD / GC=F).',
    'tour.step3Title': 'Draw by Holding (Shift+D / ~) & Scribble Erase',
    'tour.step3Body': 'Tahan tombol ~ atau aktifkan Shift+D lalu goreskan kursor di kanvas untuk menggambar Trendline, Box, atau Fibonacci secara instan. Coret zig-zag di atas gambar untuk menghapusnya.',
    'tour.step4Title': 'Tab Plan & Docked Thesis Preview (Ctrl+Shift+P)',
    'tour.step4Body': 'Kartu tesis kini terintegrasi rapi di sub-tab Preview pada panel Plan kanan agar kanvas grafik tetap bersih. Mendukung sinkronisasi Form <-> Markdown 2-arah, Dual-Entry, R-Multiple, dan Vault.',
    'tour.step5Title': 'Pine Script v6 IDE (Alt+E) & Snapshot Ultra HD 6x',
    'tour.step5Body': 'Pasang indikator tanpa batas kuota dengan runtime PineTS lokal di Web Worker, serta ekspor tangkapan layar Ultra HD hingga 6x lengkap dengan Thesis Side Panel (Ctrl+Shift+S).',
    'tour.step6Title': 'Koneksi Broker Opsional (Binance, Bitunix, MT5 CFD)',
    'tour.step6Body': 'Secara bawaan fitur eksekusi dimatikan agar fokus analisis terjaga. Jika dibutuhkan, aktifkan Opt-In Execution Bridge melalui Pengaturan -> Broker & Eksekusi untuk memakai Manual Order Ticket.',

    // Broker & Execution Bridge
    'broker.tabTitle': 'Opt-In Execution Bridge (Binance, Bitunix & MT5 CFD)',
    'broker.tabSubtitle': '100% Opsional (Default OFF). Eksekusi dilakukan secara MANUAL di tab Order, terpisah dari Trade Plan.',
    'broker.step1Title': 'Tahap 1: Persetujuan Risiko Mandiri (Wajib)',
    'broker.step1Warn': 'PERHATIAN: Seluruh kredensial API disimpan secara lokal & terenkripsi di perangkat Anda tanpa server perantara. Segala risiko eksekusi order, ukuran lot, dan fluktuasi pasar sepenuhnya menjadi tanggung jawab pengguna.',
    'broker.step1ConfirmPlaceholder': 'Ketik SETUJU atau GAS untuk membuka pengaturan...',
    'broker.step1UnlockBtn': 'Buka Pengaturan Kredensial Broker',
    'broker.masterSwitchLabel': 'Aktifkan Tab Manual Order Ticket di Dock Kanan',
    'broker.masterSwitchDesc': 'Saat dimatikan, seluruh antarmuka eksekusi order disembunyikan sepenuhnya.',
    'broker.orderTabTitle': 'MANUAL ORDER TICKET',
    'broker.planSeparatedNotice': 'Terpisah tegas dari Trade Plan: setiap parameter order wajib diisi manual.'
  },
  en: {
    // Common
    'common.done': 'Done',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.copied': 'Copied!',
    'common.reset': 'Reset',

    // Top bar & Header
    'header.searchPlaceholder': 'Search crypto, IDX stocks, gold or macro (Ctrl+K)...',
    'header.settings': 'Settings',
    'header.tutorial': 'Tutorial',
    'header.indicators': 'Indicators',
    'header.addTab': 'Open new chart tab',
    'header.langTooltip': 'Switch Language (Javanese Arekan / Indonesian / English)',
    'header.watchlistAdd': 'Add to Active Watchlist',
    'header.watchlistRemove': 'Remove from Active Watchlist',
    'header.providerSwitch': 'Switch Exchange / Data Feed',

    // Right Dock Rail
    'dock.watchlist': 'Watchlist & Live Tickers',
    'dock.alerts': 'Price Alerts',
    'dock.objects': 'Object Tree & Indicators',
    'dock.datawindow': 'Data Window Inspector',
    'dock.plan': 'Trade Plan: Preview, Form, Markdown & Vault',
    'dock.events': 'Macroeconomic Calendar',
    'dock.order': 'Manual Order & Broker (Optional)',
    'dock.pine': 'Pine Script v6 IDE & Backtester',
    'dock.hidePanel': 'Collapse Panel',
    'dock.openPanel': 'Expand Panel',

    // Trade Plan & Docked Thesis Preview
    'plan.tabPreview': 'Preview',
    'plan.tabForm': 'Form',
    'plan.tabText': 'Markdown',
    'plan.tabHistory': 'Vault',
    'plan.editBtn': 'Edit',
    'plan.editInForm': 'Edit this plan in Form view',
    'plan.copyMarkdown': 'Copy Markdown table',
    'plan.newPlan': 'New Plan',
    'plan.deletePlan': 'Delete Plan from Chart',
    'plan.emptyPreviewTitle': 'No Active Trade Plan Yet',
    'plan.emptyPreviewDesc': 'Build your structured setup in the Form tab or paste a Markdown table (Ctrl+V) to inspect the clean thesis preview card here.',
    'plan.createFirstPlan': 'Create Trade Plan',
    'plan.autoAlerts': 'Auto-Alerts (Entry, SL & TP)',
    'plan.applyChanges': 'Apply Changes',
    'plan.applyToChart': 'Apply to Chart',

    // Settings Modal
    'settings.title': 'System Settings & Telemetry',
    'settings.navGeneral': 'General, Language & Audio',
    'settings.navAppearance': 'Themes & Colors',
    'settings.navTypography': 'Typography & Text',
    'settings.navChart': 'Canvas & Chart',
    'settings.navProfile': 'Profile & Watermark',
    'settings.navFeed': 'Market Data Feed',
    'settings.navBroker': 'Brokers & Execution',
    'settings.navSystem': 'System & Telemetry',
    'settings.navAbout': 'About & License',
    'settings.navHelp': 'Help & Shortcuts',
    'settings.langLabel': 'Interface Language',
    'settings.langDesc': 'Choose terminal language (Javanese Arekan Default, Indonesian, or English).',
    'settings.replayTutorialLabel': 'Interactive Startup Tour',
    'settings.replayTutorialDesc': 'Replay the interactive onboarding guide for key workflows at any time.',
    'settings.replayTutorialBtn': 'Launch Startup Tour',

    // About & License
    'about.tagline': 'Piercing Through Market Noise · Zero Paywall Forever',
    'about.desc': 'Ultra-lightweight native desktop multi-asset & crypto charting terminal (~45 MB RAM) powered by Tauri v2 Rust, WebGL2 Vela 120 FPS, and local Pine Script v6 with optional manual broker execution.',
    'about.licenseTitle': 'Apache License 2.0 + Mandatory Attribution (NOTICE)',
    'about.licenseBody': 'Licensed under Apache License 2.0. Any fork, modification, or redistribution MUST prominently retain and display original creator attribution in the NOTICE file, documentation, and About UI dialog.',

    // Startup Spotlight Tour
    'tour.badge': 'TRAWANGAN QUICK TOUR',
    'tour.skip': 'Skip Tour',
    'tour.prev': 'Back',
    'tour.next': 'Next',
    'tour.finish': 'Start Charting',
    'tour.step1Title': 'Welcome to trawangan!',
    'tour.step1Body': 'Ultra-lightweight native charting terminal (~45 MB RAM) with zero paywalls. Pick your preferred language and color mode below to get started.',
    'tour.step2Title': 'Multi-Asset & Macro Search (Ctrl+K)',
    'tour.step2Body': 'Start typing anywhere on the canvas or press Ctrl+K to open Crypto pairs (Binance, Indodax IDR, Bitunix), Crypto Macro Indices (TOTAL, BTC.D), IDX Stocks, and COMEX Gold (XAUUSD / GC=F).',
    'tour.step3Title': 'Draw by Holding (Shift+D / ~) & Scribble Erase',
    'tour.step3Body': 'Hold ~ or press Shift+D and sketch directly on the chart to create Trendlines, Boxes, or Fibs automatically. Scribble zig-zag over any shape to erase it instantly.',
    'tour.step4Title': 'Plan Tab & Docked Thesis Preview (Ctrl+Shift+P)',
    'tour.step4Body': 'Your thesis card lives cleanly inside the Preview sub-tab of the right-hand Plan dock so candlesticks stay unobstructed. Enjoy lossless Form <-> Markdown sync, Dual-Entry, R-Multiples, and Vault.',
    'tour.step5Title': 'Pine Script v6 IDE (Alt+E) & 6x Ultra HD Snapshots',
    'tour.step5Body': 'Run unlimited custom Pine v6 indicators in an isolated Web Worker, and export crisp up-to-6x snapshots with a dedicated Side-by-Side Thesis Panel (Ctrl+Shift+S).',
    'tour.step6Title': 'Opt-In Broker Execution Bridge (Binance, Bitunix, MT5)',
    'tour.step6Body': 'Broker connectivity is 100% OFF by default to prevent impulsive clicks. Whenever you want manual execution, unlock it in Settings -> Brokers & Execution.',

    // Broker & Execution Bridge
    'broker.tabTitle': 'Opt-In Execution Bridge (Binance, Bitunix & MT5 CFD)',
    'broker.tabSubtitle': '100% Optional (Default OFF). Orders are placed MANUALLY in the Order tab, strictly decoupled from Trade Plans.',
    'broker.step1Title': 'Step 1: Self-Custody & Execution Risk Acknowledgement',
    'broker.step1Warn': 'IMPORTANT: All API credentials are encrypted locally on your machine with zero cloud relays. You bear 100% responsibility for manual order parameters, lot sizing, leverage, and market execution risks.',
    'broker.step1ConfirmPlaceholder': 'Type AGREE or GAS to unlock broker setup...',
    'broker.step1UnlockBtn': 'Unlock Broker Configuration',
    'broker.masterSwitchLabel': 'Enable Manual Order Ticket Tab in Right Dock',
    'broker.masterSwitchDesc': 'When turned OFF, all order entry controls and dock icons are completely hidden.',
    'broker.orderTabTitle': 'MANUAL ORDER TICKET',
    'broker.planSeparatedNotice': 'Strictly decoupled from Trade Plans: all order fields require explicit manual entry.'
  }
};

export const currentLanguage = writable<AppLanguage>('jv');

export function getAppLanguage(): AppLanguage {
  return get(currentLanguage);
}

export function setAppLanguage(lang: AppLanguage | undefined | null): void {
  const valid: AppLanguage = lang === 'id' || lang === 'en' || lang === 'jv' ? lang : 'jv';
  currentLanguage.set(valid);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = valid;
  }
}

export function getNextLanguage(current: AppLanguage = 'jv'): AppLanguage {
  if (current === 'jv') return 'id';
  if (current === 'id') return 'en';
  return 'jv';
}

export function translateInstant(lang: AppLanguage, key: string): string {
  return dictionaries[lang]?.[key] ?? dictionaries.jv[key] ?? key;
}

export function trInstant(jv: string, id: string, en: string, lang?: AppLanguage): string {
  const active = lang ?? get(currentLanguage);
  if (active === 'id') return id;
  if (active === 'en') return en;
  return jv;
}

export const t: Readable<(key: string) => string> = derived(
  currentLanguage,
  ($lang) => (key: string) => dictionaries[$lang]?.[key] ?? dictionaries.jv[key] ?? key
);

export const tr: Readable<(jv: string, id: string, en: string) => string> = derived(
  currentLanguage,
  ($lang) => (jv: string, id: string, en: string) =>
    $lang === 'id' ? id : $lang === 'en' ? en : jv
);
