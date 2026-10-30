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

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ProcessMemoryInfo {
    pub working_set_bytes: usize,
    pub private_bytes: usize,
}

#[tauri::command]
pub fn get_process_memory() -> Result<ProcessMemoryInfo, String> {
    #[cfg(target_os = "windows")]
    {
        use std::mem::size_of;
        use std::os::raw::c_void;

        #[repr(C)]
        struct ProcessMemoryCounters {
            cb: u32,
            page_fault_count: u32,
            peak_working_set_size: usize,
            working_set_size: usize,
            quota_peak_paged_pool_usage: usize,
            quota_paged_pool_usage: usize,
            quota_peak_non_paged_pool_usage: usize,
            quota_non_paged_pool_usage: usize,
            pagefile_usage: usize,
            peak_pagefile_usage: usize,
        }

        #[link(name = "psapi")]
        extern "system" {
            fn GetCurrentProcess() -> *mut c_void;
            fn GetProcessMemoryInfo(
                process: *mut c_void,
                counters: *mut ProcessMemoryCounters,
                cb: u32,
            ) -> i32;
        }

        unsafe {
            let mut pmc: ProcessMemoryCounters = std::mem::zeroed();
            pmc.cb = size_of::<ProcessMemoryCounters>() as u32;
            let handle = GetCurrentProcess();
            if GetProcessMemoryInfo(handle, &mut pmc, pmc.cb) != 0 {
                Ok(ProcessMemoryInfo {
                    working_set_bytes: pmc.working_set_size,
                    private_bytes: pmc.pagefile_usage,
                })
            } else {
                Err("Gagal membaca memori proses via GetProcessMemoryInfo".to_string())
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(ProcessMemoryInfo {
            working_set_bytes: 0,
            private_bytes: 0,
        })
    }
}

#[tauri::command]
pub async fn http_get(
    market: State<'_, MarketService>,
    url: String,
    timeout_secs: Option<u64>,
) -> Result<String, String> {
    market.get(&url, timeout_secs).await
}

// =========================================================================
// Snapshot & Screenshot Storage Management Commands
// =========================================================================

#[tauri::command]
pub fn get_default_snapshot_directory() -> Result<String, String> {
    let dir = dirs::download_dir()
        .or_else(|| dirs::picture_dir())
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_snapshot_file(
    directory: Option<String>,
    filename: String,
    base64_data: String,
) -> Result<String, String> {
    use base64::prelude::*;
    use std::path::PathBuf;

    // 1. Tentukan direktori target
    let target_dir: PathBuf = match directory {
        Some(d) if !d.trim().is_empty() && d.trim() != "default" => {
            let trimmed = d.trim();
            if trimmed.starts_with('~') {
                if let Some(home) = dirs::home_dir() {
                    home.join(trimmed.trim_start_matches('~').trim_start_matches('/'))
                } else {
                    PathBuf::from(trimmed)
                }
            } else {
                PathBuf::from(trimmed)
            }
        }
        _ => dirs::download_dir()
            .or_else(|| dirs::picture_dir())
            .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default()),
    };

    // Pastikan direktori tujuan tersedia
    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Gagal membuat direktori {}: {}", target_dir.display(), e))?;
    }

    // 2. Bersihkan header data URL base64 jika ada
    let clean_base64 = if let Some(idx) = base64_data.find(";base64,") {
        &base64_data[idx + 8..]
    } else if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    // 3. Dekode binary bytes
    let bytes = BASE64_STANDARD
        .decode(clean_base64.trim())
        .map_err(|e| format!("Gagal mendekode data base64 gambar: {}", e))?;

    // 4. Susun nama berkas dan path lengkap
    let safe_filename = if filename.trim().is_empty() {
        "trawangan-snapshot.png".to_string()
    } else {
        filename
    };
    let target_file = target_dir.join(safe_filename);

    // 5. Tulis berkas ke filesystem
    std::fs::write(&target_file, &bytes)
        .map_err(|e| format!("Gagal menulis berkas {}: {}", target_file.display(), e))?;

    Ok(target_file.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_snapshot_folder(directory: Option<String>) -> Result<(), String> {
    use std::path::PathBuf;

    let target_dir: PathBuf = match directory {
        Some(d) if !d.trim().is_empty() && d.trim() != "default" => {
            let trimmed = d.trim();
            if trimmed.starts_with('~') {
                if let Some(home) = dirs::home_dir() {
                    home.join(trimmed.trim_start_matches('~').trim_start_matches('/'))
                } else {
                    PathBuf::from(trimmed)
                }
            } else {
                PathBuf::from(trimmed)
            }
        }
        _ => dirs::download_dir()
            .or_else(|| dirs::picture_dir())
            .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default()),
    };

    if !target_dir.exists() {
        let _ = std::fs::create_dir_all(&target_dir);
    }

    let dir_str = target_dir.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir_str)
            .spawn()
            .map_err(|e| format!("Gagal membuka explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir_str)
            .spawn()
            .map_err(|e| format!("Gagal membuka finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir_str)
            .spawn()
            .map_err(|e| format!("Gagal membuka file manager: {}", e))?;
    }

    Ok(())
}




