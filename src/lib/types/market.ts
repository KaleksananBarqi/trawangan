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

export type WorkspaceMode = 'terminal' | 'pine';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  label: string;
  active: boolean;
  triggered: boolean;
  createdAt: number;
}

export interface ObjectTreeItem {
  id: string;
  type: 'indicator' | 'drawing';
  label: string;
  visible: boolean;
  locked?: boolean;
}

export interface AppSettings {
  timezone: string;
  soundEnabled: boolean;
  showWatermark: boolean;
  showGrid: boolean;
  showReplayBar: boolean;
  theme: 'obsidian';
}

export interface StrategyPerformanceSummary {
  netProfit: number;
  netProfitPercent: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
}



