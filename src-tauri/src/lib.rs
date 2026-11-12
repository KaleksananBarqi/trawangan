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
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.set_focus();
                let _ = main_win.unminimize();
            }
        }))
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
            commands::load_cached_candles,
            commands::store_cached_candles,
            commands::list_workspaces,
            commands::upsert_workspace,
            commands::delete_workspace,
            commands::clone_workspace_drawings,
            commands::list_price_alerts,
            commands::replace_price_alerts,
            commands::list_trading_plans,
            commands::upsert_trading_plan,
            commands::delete_trading_plan,
            commands::clear_trading_plans,
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
            commands::list_drawing_keys,
            commands::load_watchlist_registry,
            commands::save_watchlist_registry,
            commands::get_app_preference,
            commands::set_app_preference,
            commands::delete_app_preference,
            commands::get_process_memory,
            commands::http_get,
            commands::get_default_snapshot_directory,
            commands::save_snapshot_file,
            commands::open_snapshot_folder,
            commands::pick_snapshot_directory
        ])
        .run(tauri::generate_context!())
        .expect("Terjadi error saat menjalankan aplikasi desktop Trawangan");
}
