// Modul Tauri IPC Commands yang dipanggil oleh Frontend
use crate::db::{
    cache_candles, clear_drawings, delete_pine_script, delete_provider, get_cached_candles,
    get_drawings, get_pine_scripts, get_providers, get_watchlist, get_workspace, save_drawings,
    save_pine_script, save_provider, save_watchlist, save_workspace, set_active_provider,
    Candle, DbState, PineScriptRecord, ProviderConfig,
};
use crate::market::MarketService;
use tauri::State;

#[tauri::command]
pub async fn fetch_candles(
    db: State<'_, DbState>,
    market: State<'_, MarketService>,
    symbol: String,
    interval: String,
    limit: Option<u32>,
    provider_id: Option<String>,
) -> Result<Vec<Candle>, String> {
    let candle_limit = limit.unwrap_or(500);

    // Coba ambil provider jika ada
    let provider_opt = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let providers = get_providers(&conn).unwrap_or_default();
        if let Some(id) = &provider_id {
            providers.into_iter().find(|p| &p.id == id)
        } else {
            providers.into_iter().find(|p| p.is_active)
        }
    };

    // Ambil candle dari network
    let fetched_candles = if let Some(p) = provider_opt {
        if p.id.starts_with("binance") {
            market.fetch_binance_klines(&symbol, &interval, candle_limit).await
        } else {
            market.fetch_custom_klines(&p.rest_url, &symbol, &interval, candle_limit).await
        }
    } else {
        market.fetch_binance_klines(&symbol, &interval, candle_limit).await
    };

    match fetched_candles {
        Ok(candles) => {
            // Simpan ke SQLite cache di background thread
            if let Ok(conn) = db.conn.lock() {
                let _ = cache_candles(&conn, &symbol, &interval, &candles);
            }
            Ok(candles)
        }
        Err(err) => {
            // Jika koneksi gagal, coba fallback ke cache SQLite lokal
            if let Ok(conn) = db.conn.lock() {
                if let Ok(cached) = get_cached_candles(&conn, &symbol, &interval, candle_limit) {
                    if !cached.is_empty() {
                        return Ok(cached);
                    }
                }
            }
            Err(err)
        }
    }
}

#[tauri::command]
pub fn save_workspace_layout(
    db: State<'_, DbState>,
    id: String,
    name: String,
    layout_json: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    save_workspace(&conn, &id, &name, &layout_json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_workspace_layout(
    db: State<'_, DbState>,
    id: String,
) -> Result<Option<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_workspace(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_data_providers(
    db: State<'_, DbState>,
) -> Result<Vec<ProviderConfig>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_providers(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_or_update_provider(
    db: State<'_, DbState>,
    provider: ProviderConfig,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    save_provider(&conn, &provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_active_data_provider(
    db: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    set_active_provider(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_data_provider(
    db: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    delete_provider(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_saved_scripts(
    db: State<'_, DbState>,
) -> Result<Vec<PineScriptRecord>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_pine_scripts(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_script(
    db: State<'_, DbState>,
    script: PineScriptRecord,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    save_pine_script(&conn, &script).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_script(
    db: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    delete_pine_script(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_chart_drawings(
    db: State<'_, DbState>,
    symbol: String,
    timeframe: String,
    data_json: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    save_drawings(&conn, &symbol, &timeframe, &data_json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_chart_drawings(
    db: State<'_, DbState>,
    symbol: String,
    timeframe: String,
) -> Result<Option<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_drawings(&conn, &symbol, &timeframe).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_chart_drawings(
    db: State<'_, DbState>,
    symbol: String,
    timeframe: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    clear_drawings(&conn, &symbol, &timeframe).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_user_watchlist(
    db: State<'_, DbState>,
) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_watchlist(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_user_watchlist(
    db: State<'_, DbState>,
    symbols: Vec<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    save_watchlist(&conn, &symbols).map_err(|e| e.to_string())
}


