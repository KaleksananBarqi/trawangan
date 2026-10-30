pub mod db;
pub mod market;
pub mod commands;

use db::{init_db, DbState};
use market::MarketService;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.set_focus();
                let _ = main_win.unminimize();
            }
            for arg in argv {
                if arg.starts_with("trawangan://") || arg.contains("tradingview.com") || arg.contains("binance.com") {
                    let _ = app.emit("deep-link-received", arg);
                }
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Daftarkan skema custom URI trawangan:// ke OS desktop saat runtime dev/production
            #[cfg(desktop)]
            {
                let _ = app.deep_link().register_all();
            }

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
            commands::http_get,
            commands::get_default_snapshot_directory,
            commands::save_snapshot_file,
            commands::open_snapshot_folder,
            commands::pick_snapshot_directory
        ])
        .run(tauri::generate_context!())
        .expect("Terjadi error saat menjalankan aplikasi desktop Trawangan");
}
