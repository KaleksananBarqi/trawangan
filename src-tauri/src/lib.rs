pub mod db;
pub mod market;
pub mod commands;

use db::{init_db, DbState};
use market::MarketService;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Inisialisasi basis data SQLite
            let conn = init_db(app.handle())
                .expect("Gagal menginisialisasi basis data SQLite Trawangan");
            
            app.manage(DbState {
                conn: Mutex::new(conn),
            });
            app.manage(MarketService::new());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fetch_candles,
            commands::save_workspace_layout,
            commands::load_workspace_layout,
            commands::get_data_providers,
            commands::add_or_update_provider,
            commands::set_active_data_provider,
            commands::delete_data_provider,
            commands::get_saved_scripts,
            commands::save_script,
            commands::delete_script,
            commands::save_chart_drawings,
            commands::load_chart_drawings,
            commands::clear_chart_drawings,
            commands::get_user_watchlist,
            commands::save_user_watchlist,
            commands::get_process_memory,
            commands::http_get
        ])
        .run(tauri::generate_context!())
        .expect("Terjadi error saat menjalankan aplikasi desktop Trawangan");
}
