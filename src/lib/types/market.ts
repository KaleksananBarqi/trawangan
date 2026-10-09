// Tipe Data Pasar & Konfigurasi Chart Trawangan

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerInfo {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  rest_url: string;
  ws_url: string;
  is_active: boolean;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W';

export interface SymbolOption {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  name: string;
}

export interface PineScriptRecord {
  id: string;
  title: string;
  code: string;
  is_overlay: boolean;
  created_at: number;
  updated_at: number;
}

export interface ActiveIndicatorInfo {
  id: string;
  title: string;
  source?: string;
  visible: boolean;
}

export type DrawingToolType =
  | 'cursor'
  | 'trendline'
  | 'hline'
  | 'hray'
  | 'ray'
  | 'arrow'
  | 'fibretracement'
  | 'box'
  | 'position'
  | 'text'
  | 'callout'
  | 'pricelabel'
  | 'measure';

export type SnapMode = 'off' | 'weak' | 'strong';

export interface WatchlistItem {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export interface MultiChartSyncConfig {
  crosshair: boolean;
  symbol: boolean;
  drawings: boolean;
}


