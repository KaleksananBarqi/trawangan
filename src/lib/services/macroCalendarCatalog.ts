/**
 * Katalog Acara Kalender Makroekonomi Terstandarisasi (Macroeconomic Calendar Catalog)
 * Menyediakan data rilis kalender ekonomi berdampak tinggi (FOMC, CPI, NFP, GDP, dll.)
 * untuk ditampilkan sebagai penanda waktu (Timeline Marks) pada grafik Trawangan.
 *
 * Catatan Arsitektur:
 * Acara makroekonomi global (seperti inflasi CPI, suku bunga The Fed FOMC, data tenaga kerja NFP)
 * berlaku untuk seluruh pasar finansial dan aset kripto (market-wide). Oleh karena itu,
 * `relevantSymbols` dibiarkan kosong/tidak didefinisikan agar penanda peristiwa berita
 * selalu muncul pada sumbu waktu instrumen manapun yang sedang dianalisis trader.
 */

import type { MacroCalendarEvent } from './timelineMarksController';

/**
 * Daftar acara makroekonomi terkurasi dengan jadwal rilis historis & terkini.
 * Rentang waktu disesuaikan mencakup rilis penting November 2026 (termasuk CPI 12 Nov, PPI 13 Nov,
 * Pidato Fed Powell 14 Nov, dan Retail Sales 14 Nov) agar langsung terlihat pada viewport lilin aktif.
 */
export const STANDARD_MACRO_CALENDAR_EVENTS: readonly MacroCalendarEvent[] = [
  {
    id: 'us_fomc_2026_11',
    title: 'FOMC Interest Rate Decision',
    timestamp: 1794247200000, // 2026-11-05 18:00 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '4.50%',
    forecast: '4.50%',
    previous: '4.75%',
    unit: '%',
    category: 'central_bank',
    description: 'Keputusan suku bunga acuan Federal Reserve AS (Fed Funds Target Rate) dan proyeksi kebijakan moneter.'
  },
  {
    id: 'us_nfp_2026_11',
    title: 'US Non-Farm Payrolls (NFP)',
    timestamp: 1794317400000, // 2026-11-06 13:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '165K',
    forecast: '150K',
    previous: '142K',
    unit: 'K',
    category: 'employment',
    description: 'Jumlah tenaga kerja baru di luar sektor pertanian AS dalam bulan berjalan.'
  },
  {
    id: 'us_cpi_2026_11',
    title: 'US CPI (Consumer Price Index YoY)',
    timestamp: 1794490200000, // 2026-11-12 13:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '2.6%',
    forecast: '2.6%',
    previous: '2.4%',
    unit: '%',
    category: 'inflation',
    description: 'Indeks Harga Konsumen AS mengukur perubahan harga barang dan jasa dari perspektif konsumen.'
  },
  {
    id: 'us_ppi_2026_11',
    title: 'US PPI (Producer Price Index MoM)',
    timestamp: 1794576600000, // 2026-11-13 13:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '0.2%',
    forecast: '0.2%',
    previous: '0.1%',
    unit: '%',
    category: 'inflation',
    description: 'Indeks Harga Produsen mengukur rata-rata perubahan harga jual domestik yang diterima produsen komoditas.'
  },
  {
    id: 'us_jobless_claims_2026_11',
    title: 'US Initial Jobless Claims',
    timestamp: 1794576600000, // 2026-11-13 13:30 UTC
    impact: 'medium',
    country: 'US',
    currency: 'USD',
    actual: '217K',
    forecast: '223K',
    previous: '221K',
    unit: 'K',
    category: 'employment',
    description: 'Jumlah klaim pertama kali tunjangan pengangguran di Amerika Serikat.'
  },
  {
    id: 'fed_powell_speech_2026_11',
    title: 'Fed Chair Powell Speech',
    timestamp: 1794621600000, // 2026-11-14 02:00 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    category: 'central_bank',
    description: 'Pidato ketua Federal Reserve Jerome Powell terkait kondisi ekonomi makro dan arah suku bunga acuan.'
  },
  {
    id: 'us_retail_sales_2026_11',
    title: 'US Retail Sales (MoM)',
    timestamp: 1794663000000, // 2026-11-14 13:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    forecast: '0.3%',
    previous: '0.4%',
    unit: '%',
    category: 'growth',
    description: 'Data penjualan ritel AS mengukur total penerimaan toko ritel dan mencerminkan kekuatan belanja konsumen.'
  },
  {
    id: 'ecb_rate_2026_10',
    title: 'ECB Monetary Policy Decision',
    timestamp: 1793540100000, // 2026-10-29 12:15 UTC
    impact: 'medium',
    country: 'EU',
    currency: 'EUR',
    actual: '3.25%',
    forecast: '3.25%',
    previous: '3.50%',
    unit: '%',
    category: 'central_bank',
    description: 'Keputusan suku bunga refinancing utama oleh European Central Bank (Bank Sentral Eropa).'
  },
  {
    id: 'us_gdp_2026_q3',
    title: 'US GDP Growth Rate QoQ (Adv)',
    timestamp: 1793626200000, // 2026-10-30 12:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '2.8%',
    forecast: '3.0%',
    previous: '3.0%',
    unit: '%',
    category: 'growth',
    description: 'Pertumbuhan Produk Domestik Bruto AS triwulanan tahunan (laporan estimasi pendahuluan).'
  },
  {
    id: 'us_pce_2026_10',
    title: 'US Core PCE Price Index YoY',
    timestamp: 1793712600000, // 2026-10-31 12:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '2.6%',
    forecast: '2.6%',
    previous: '2.7%',
    unit: '%',
    category: 'inflation',
    description: 'Indikator inflasi preferensi Federal Reserve yang mengecualikan komponen makanan dan energi bergejolak.'
  },
  {
    id: 'us_ism_pmi_2026_11',
    title: 'ISM Manufacturing PMI',
    timestamp: 1793977200000, // 2026-11-03 15:00 UTC
    impact: 'medium',
    country: 'US',
    currency: 'USD',
    actual: '48.5',
    forecast: '47.6',
    previous: '47.2',
    unit: 'pts',
    category: 'growth',
    description: 'Indeks aktivitas manufaktur nasional ISM mengukur ekspansi (>50) atau kontraksi (<50) sektor pabrikan.'
  }
];
