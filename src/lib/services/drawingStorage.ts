// Deprecated Compatibility Facade - Gunakan $lib/services/persistence secara langsung
export {
  saveDrawingsDebounced,
  loadDrawings,
  clearDrawings,
  loadWatchlist as fetchWatchlist,
  saveWatchlist as persistWatchlist,
  loadAlerts as fetchAlerts,
  saveAlerts as persistAlerts,
  loadQuickSymbolsConfig as fetchQuickSymbolsConfig,
  saveQuickSymbolsConfig as persistQuickSymbolsConfig,
  DEFAULT_QUICK_SYMBOLS_CONFIG,
} from './persistence';
