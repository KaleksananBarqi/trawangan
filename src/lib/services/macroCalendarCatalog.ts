/**
 * Katalog Acara Kalender Makroekonomi Terstandarisasi (Macroeconomic Calendar Catalog)
 * Menyediakan data rilis kalender ekonomi berdampak tinggi (FOMC, CPI, NFP, GDP, dll.)
 * untuk ditampilkan sebagai penanda waktu (Timeline Marks) pada grafik Trawangan.
 */

import type { MacroCalendarEvent } from './timelineMarksController';

/**
 * Daftar acara makroekonomi terkurasi dengan jadwal rilis historis & mendatang.
 */
export const STANDARD_MACRO_CALENDAR_EVENTS: readonly MacroCalendarEvent[] = [
  {
    id: 'us_fomc_2026_11',
    title: 'FOMC Interest Rate Decision',
    timestamp: 1794168000000, // 2026-11-05 01:00 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '4.50%',
    forecast: '4.50%',
    previous: '4.75%',
    unit: '%',
    category: 'central_bank',
    description: 'Keputusan suku bunga acuan Federal Reserve AS (Fed Funds Target Rate) dan proyeksi kebijakan moneter.',
    relevantSymbols: ['BTCUSDT', 'TOTAL', 'TOTAL2', 'BTC.D', 'USDT.D', '^IXIC', 'GC=F']
  },
  {
    id: 'us_cpi_2026_11',
    title: 'US CPI (Consumer Price Index YoY)',
    timestamp: 1794751800000, // 2026-11-12 13:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '2.4%',
    forecast: '2.3%',
    previous: '2.5%',
    unit: '%',
    category: 'inflation',
    description: 'Indeks Harga Konsumen AS mengukur perubahan harga barang dan jasa dari perspektif konsumen.',
    relevantSymbols: ['BTCUSDT', 'TOTAL', 'BTC.D', 'USDT.D', '^IXIC', 'GC=F']
  },
  {
    id: 'us_nfp_2026_11',
    title: 'US Non-Farm Payrolls (NFP)',
    timestamp: 1794231000000, // 2026-11-06 13:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '165K',
    forecast: '150K',
    previous: '142K',
    unit: 'K',
    category: 'employment',
    description: 'Jumlah tenaga kerja baru di luar sektor pertanian AS dalam bulan berjalan.',
    relevantSymbols: ['BTCUSDT', 'TOTAL', 'BTC.D', 'USDT.D', '^IXIC']
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
    description: 'Indikator inflasi preferensi Federal Reserve yang mengecualikan komponen makanan dan energi bergejolak.',
    relevantSymbols: ['BTCUSDT', 'TOTAL', 'BTC.D', '^IXIC']
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
    description: 'Keputusan suku bunga refinancing utama oleh European Central Bank (Bank Sentral Eropa).',
    relevantSymbols: ['EURUSD', 'BTCUSDT', 'TOTAL']
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
    description: 'Pertumbuhan Produk Domestik Bruto AS triwulanan tahunan (laporan estimasi pendahuluan).',
    relevantSymbols: ['BTCUSDT', 'TOTAL', '^IXIC']
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
    description: 'Indeks aktivitas manufaktur nasional ISM mengukur ekspansi (>50) atau kontraksi (<50) sektor pabrikan.',
    relevantSymbols: ['BTCUSDT', 'TOTAL', 'GC=F']
  }
];
