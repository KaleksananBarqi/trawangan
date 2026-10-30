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

/// Sanitasi nama berkas snapshot untuk mencegah path traversal.
/// Mengambil hanya komponen file_name murni dan menyediakan fallback aman jika kosong/berbahaya.
pub fn sanitize_snapshot_filename(filename: &str) -> String {
    let normalized = filename.replace('\\', "/");
    std::path::Path::new(&normalized)
        .file_name()
        .and_then(|f| f.to_str())
        .map(|s| s.trim())
        .filter(|&s| !s.is_empty() && s != "." && s != "..")
        .unwrap_or("trawangan-snapshot.png")
        .to_string()
}

/// Helper terpadu untuk resolusi direktori snapshot, ekspansi tilde (~),
/// fallback ke direktori bawaan, dan pembuatan direktori otomatis jika belum ada.
pub fn resolve_snapshot_dir(directory: Option<String>) -> Result<std::path::PathBuf, String> {
    use std::path::PathBuf;

    let target_dir: PathBuf = match directory {
        Some(d) if !d.trim().is_empty() && d.trim() != "default" => {
            let trimmed = d.trim();
            if trimmed.starts_with('~') {
                if let Some(home) = dirs::home_dir() {
                    home.join(
                        trimmed
                            .trim_start_matches('~')
                            .trim_start_matches('/')
                            .trim_start_matches('\\'),
                    )
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

    Ok(target_dir)
}

#[tauri::command]
pub async fn pick_snapshot_directory() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Pilih Folder Penyimpanan Snapshot")
        .pick_folder()
        .await;

    Ok(folder.map(|handle| handle.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub fn save_snapshot_file(
    directory: Option<String>,
    filename: String,
    base64_data: String,
) -> Result<String, String> {
    use base64::prelude::*;

    // 1. Tentukan direktori target menggunakan helper terpadu
    let target_dir = resolve_snapshot_dir(directory)?;

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

    // 4. Sanitasi nama berkas untuk mencegah celah keamanan path traversal:
    // Hanya komponen nama berkas murni yang digabungkan dengan target_dir.
    let safe_filename = sanitize_snapshot_filename(&filename);
    let target_file = target_dir.join(safe_filename);

    // 5. Tulis berkas ke filesystem
    std::fs::write(&target_file, &bytes)
        .map_err(|e| format!("Gagal menulis berkas {}: {}", target_file.display(), e))?;

    Ok(target_file.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_snapshot_folder(directory: Option<String>) -> Result<(), String> {
    let target_dir = resolve_snapshot_dir(directory)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_snapshot_filename_normal() {
        let name = sanitize_snapshot_filename("trawangan-BTCUSDT-15m.png");
        assert_eq!(name, "trawangan-BTCUSDT-15m.png");
    }

    #[test]
    fn test_sanitize_snapshot_filename_path_traversal() {
        // Relatif path traversal Unix
        assert_eq!(
            sanitize_snapshot_filename("../../../../etc/shadow"),
            "shadow"
        );
        // Relatif path traversal Windows
        assert_eq!(
            sanitize_snapshot_filename("..\\..\\Windows\\System32\\calc.exe"),
            "calc.exe"
        );
        // Absolute path Unix
        assert_eq!(
            sanitize_snapshot_filename("/var/log/secret.png"),
            "secret.png"
        );
        // Kombinasi traversal dots dan slash
        assert_eq!(
            sanitize_snapshot_filename("../../../snapshot.png"),
            "snapshot.png"
        );
    }

    #[test]
    fn test_sanitize_snapshot_filename_empty_and_special() {
        // String kosong
        assert_eq!(sanitize_snapshot_filename(""), "trawangan-snapshot.png");
        // Hanya whitespace
        assert_eq!(sanitize_snapshot_filename("   "), "trawangan-snapshot.png");
        // Hanya titik traversal
        assert_eq!(sanitize_snapshot_filename(".."), "trawangan-snapshot.png");
        assert_eq!(sanitize_snapshot_filename("."), "trawangan-snapshot.png");
        assert_eq!(sanitize_snapshot_filename("../../"), "trawangan-snapshot.png");
    }

    #[test]
    fn test_resolve_snapshot_dir_tilde_and_default() {
        // Fallback default
        let default_dir = resolve_snapshot_dir(None).expect("Harus berhasil menyelesaikan default");
        assert!(default_dir.exists());

        // Resolusi tilde (~)
        if let Some(home) = dirs::home_dir() {
            let resolved_tilde = resolve_snapshot_dir(Some("~/Pictures".to_string()))
                .expect("Harus berhasil expand tilde");
            assert_eq!(resolved_tilde, home.join("Pictures"));
        }
    }

    #[test]
    fn test_save_snapshot_file_sanitization_defense() {
        // Buat folder temporary untuk pengujian simpan
        let temp_dir = std::env::temp_dir().join("trawangan_test_snapshots");
        let temp_dir_str = temp_dir.to_string_lossy().to_string();

        let mock_png_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

        // Coba injeksi path traversal "../evil.png"
        let saved_path_str = save_snapshot_file(
            Some(temp_dir_str.clone()),
            "../../evil.png".to_string(),
            mock_png_base64.to_string(),
        )
        .expect("Penyimpanan harus sukses");

        let saved_path = std::path::PathBuf::from(&saved_path_str);
        // Pastikan berkas tersimpan di dalam temp_dir, BUKAN di parent direktori di luar
        assert_eq!(saved_path.parent().unwrap(), temp_dir.as_path());
        assert_eq!(saved_path.file_name().unwrap(), "evil.png");
        assert!(saved_path.exists());

        // Bersihkan berkas uji
        let _ = std::fs::remove_file(saved_path);
        let _ = std::fs::remove_dir_all(temp_dir);
    }
}




