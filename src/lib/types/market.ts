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

export type StandardTimeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '45m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '12h'
  | '1D'
  | '1W'
  | '1M';

export type Timeframe = StandardTimeframe | (string & {});

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
  inputs?: Record<string, any>;
  props?: Record<string, any>;
}

export type DrawingToolType =
  // Kontrol kursor, navigasi & ukur
  | 'cursor'
  | 'handpull'
  | 'eraser'
  | 'measure'
  // Garis (Lines)
  | 'trendline'
  | 'hline'
  | 'ray'
  | 'extendedline'
  | 'vline'
  | 'hray'
  | 'crossline'
  | 'infoline'
  | 'trendangle'
  // Saluran & Pitchforks (Channels & Pitchforks)
  | 'parallelchannel'
  | 'disjointchannel'
  | 'flattopbottom'
  | 'regressionchannel'
  | 'pitchfork'
  | 'schiffpitchfork'
  | 'modifiedschiffpitchfork'
  | 'insidepitchfork'
  // Fibonacci & Gann
  | 'fibretracement'
  | 'fibextension'
  | 'fibextensiontrend'
  | 'fibfan'
  | 'fibtimezones'
  | 'fibchannel'
  | 'fibspeedfan'
  | 'trendfibtime'
  | 'fibcircles'
  | 'fibarcs'
  | 'fibwedge'
  | 'fibspiral'
  | 'gannfan'
  | 'gannbox'
  | 'gannsquare'
  // Geometri & Matematika Gelombang
  | 'dedekind'
  | 'sonic'
  | 'supersonic'
  | 'goldensonic'
  | 'goldensupersonic'
  // Pola Harmonik & Elliott Wave
  | 'xabcd'
  | 'abcd'
  | 'elliottimpulse'
  | 'elliottcorrection'
  | 'headshoulders'
  | 'gartley'
  | 'bat'
  | 'butterfly'
  | 'crab'
  | 'shark'
  | 'cypher'
  // Proyeksi, Volume & Pengukuran
  | 'position'
  | 'datepricerange'
  | 'magnifier'
  | 'anchoredvwap'
  | 'fixedrangevp'
  // Bentuk, Kuas & Panah (Shapes, Brushes & Arrows)
  | 'freehand'
  | 'highlighter'
  | 'polyline'
  | 'path'
  | 'box'
  | 'rotatedrect'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'arc'
  | 'curve'
  | 'arrow'
  | 'arrowmarkup'
  | 'arrowmarkdown'
  // Teks & Anotasi (Text & Annotations)
  | 'text'
  | 'callout'
  | 'note'
  | 'pricenote'
  | 'comment'
  | 'pricelabel'
  | 'signpost'
  | 'flagmark'
  | 'iconstamp';

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
  viewport: boolean;
  symbol: boolean;
  drawings: boolean;
  indicators?: boolean;
  timeframe?: boolean;
}

export type WorkspaceMode = 'terminal' | 'pine';

export type AlertCondition =
  | 'crossing'
  | 'crossing_up'
  | 'crossing_down'
  | 'greater_than'
  | 'less_than'
  | 'above'
  | 'below';

export type AlertFrequency = 'once' | 'every_time';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: AlertCondition;
  frequency: AlertFrequency;
  label: string;
  active: boolean;
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
  triggeredPrice?: number;
}

export interface ObjectTreeItem {
  id: string;
  type: 'indicator' | 'drawing';
  label: string;
  visible: boolean;
  locked?: boolean;
}

export type ThemePresetId = 'signature' | 'binance' | 'bitunix' | 'tradingview' | 'coinglass';
export type UiDensity = 'compact' | 'regular' | 'comfortable';

export interface AppSettings {
  timezone: string;
  soundEnabled: boolean;
  systemNotificationEnabled?: boolean;
  showWatermark: boolean;
  showGrid: boolean;
  showReplayBar: boolean;
  showCurrentPriceLine?: boolean;
  showIndicatorPriceLabels?: boolean;
  showDrawingPriceLabels?: boolean;
  theme?: 'signature' | 'binance' | 'bitunix' | 'tradingview' | 'coinglass' | 'obsidian';
  themePreset?: ThemePresetId;
  fontFamilyUi?: string;
  fontFamilyMono?: string;
  uiDensity?: UiDensity;
  fontSize?: number;
  defaultTimeframe?: Timeframe;
  favoriteTimeframes?: Timeframe[];
  customTimeframes?: string[];
  syncConfig?: MultiChartSyncConfig;
  autoSaveWorkspace?: boolean;
  autoLoadLastWorkspace?: boolean;
}


export interface StrategyTradeRecord {
  id: string;
  tradeNum: number;
  direction: 'long' | 'short';
  entryPrice: number;
  entryTime: number;
  entryComment?: string;
  exitPrice?: number;
  exitTime?: number;
  exitComment?: string;
  size: number;
  profit?: number;
  profitPercent?: number;
  status: 'open' | 'closed';
  maxDrawdown?: number;
  maxRunup?: number;
}

export interface StrategyPerformanceSummary {
  strategyTitle?: string;
  netProfit: number;
  netProfitPercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  evenTrades: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  initialCapital: number;
  equity: number;
  openTrades: number;
  currentPosition: {
    size: number;
    avgPrice: number;
    direction: 'flat' | 'long' | 'short';
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  };
  trades: StrategyTradeRecord[];
}
export interface QuickSymbolsConfig {
  mode: 'watchlist' | 'custom';
  customSymbols: string[];
  maxDisplayCount: number;
}

export interface SavedWorkspace {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  layout: string;
  providerId?: string;
  paneWeights?: number[];
  priceScaleState?: {
    mode?: 'price' | 'log' | 'percent';
    auto?: boolean;
    manualScale?: { min: number; max: number } | null;
  };
  priceStyle?: string;
  barSpacing?: number;
  activeRightDockPanel?: string | null;
  syncConfig?: MultiChartSyncConfig;
  indicators: {
    title: string;
    source?: string;
    visible: boolean;
    inputs?: Record<string, any>;
    props?: Record<string, any>;
  }[];
  timestamp: number;
}


export interface MarketSearchResult {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayName: string;
  type: 'spot' | 'perp';
  provider: string;
  price?: number;
  change24h?: number;
}
