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
  | 'gesture'
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

/**
 * Konfigurasi profil personal trader untuk atribusi snapshot frame (#126)
 */
export interface UserProfileConfig {
  username: string;
  handle: string;
  bio?: string;
  avatarDataUrl?: string;
}

/**
 * Konfigurasi kustom latar belakang kanvas grafik (#128)
 * Mendukung mode tema bawaan ('theme'), warna tunggal ('solid'), dan gradien vertikal ('gradient').
 */
export interface CustomChartBackgroundConfig {
  mode: 'theme' | 'solid' | 'gradient';
  solidColor?: string;
  gradientTop?: string;
  gradientBottom?: string;
}

/**
 * Konfigurasi tanda air keamanan anti-pencurian semi-transparan pada kanvas (#127)
 */
export interface SecurityWatermarkConfig {
  enabled: boolean;
  text?: string;
  opacity: number; // 0.05 - 0.30, default: 0.10
  showOnLiveCanvas: boolean; // default: false
}

export interface AppSettings {
  timezone: string;
  soundEnabled: boolean;
  systemNotificationEnabled?: boolean;
  showWatermark: boolean;
  showGrid: boolean;
  showReplayBar: boolean;
  showCurrentPriceLine?: boolean;
  showVolume?: boolean;
  showIndicatorPriceLabels?: boolean;
  showDrawingPriceLabels?: boolean;
  theme?: 'signature' | 'binance' | 'bitunix' | 'tradingview' | 'coinglass' | 'obsidian';
  themePreset?: ThemePresetId;
  customBullColor?: string;
  customBearColor?: string;
  customChartBackground?: CustomChartBackgroundConfig;
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
  clipboardWatcherEnabled?: boolean;
  clipboardAutoOpen?: boolean;
  showWorldClocks?: boolean;
  worldClockCities?: string[];
  // Snapshot Preferences (#95, #125 Multi-Scale & Save Directory Setting)
  snapshotIncludeFrame?: boolean;
  snapshotIncludePrice?: boolean;
  snapshotIncludeTimestamp?: boolean;
  snapshotScope?: 'active' | 'all';
  snapshotDirectory?: string;
  snapshotScaleMultiplier?: SnapshotScaleMultiplier;
  // Trader Profile & Attribution Settings (#126)
  userProfile?: UserProfileConfig;
  // Security Watermark Anti-Theft Settings (#127)
  securityWatermark?: SecurityWatermarkConfig;
}

/**
 * Pilihan faktor pengali resolusi untuk ekspor snapshot grafik (#125)
 * Mendukung 1x (Web Standar), 2x (HiDPI Retina), 4x (Ultra HD 4K), dan 6x (Super HD 6K).
 */
export type SnapshotScaleMultiplier = 1 | 2 | 4 | 6;


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
  showVolume?: boolean;
  activeRightDockPanel?: string | null;
  syncConfig?: MultiChartSyncConfig;
  activePlans?: any[];
  showThesisCards?: boolean;
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

export interface WatchlistRecord {
  id: string;
  name: string;
  items: string[];
  isPreset?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface MultiWatchlistRegistry {
  activeWatchlistId: string;
  watchlists: WatchlistRecord[];
}

