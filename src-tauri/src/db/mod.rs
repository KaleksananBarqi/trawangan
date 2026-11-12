// Modul Database SQLite Lokal untuk Caching Candle & Persistensi trawangan
pub mod alerts;
pub mod candles;
pub mod drawings;
pub mod migrations;
pub mod preferences;
pub mod providers;
pub mod scripts;
pub mod trading_plans;
pub mod watchlists;
pub mod workspaces;

use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub use candles::{cache_candles, get_cached_candles, Candle};
pub use drawings::{clear_drawings, get_drawings, list_drawing_keys, save_drawings, DrawingKeyEntry};
pub use providers::{delete_provider, get_providers, save_provider, set_active_provider, ProviderConfig};
pub use scripts::{delete_pine_script, get_pine_scripts, save_pine_script, PineScriptRecord};
pub use watchlists::{get_watchlist, save_watchlist};

pub struct DbState {
    pub conn: Mutex<Connection>,
}

/// Menjalankan operasi closure di dalam satu transaksi SQLite dengan rollback otomatis saat gagal
pub(crate) fn with_transaction<T, F>(conn: &Connection, begin_sql: &str, f: F) -> Result<T>
where
    F: FnOnce() -> Result<T>,
{
    conn.execute_batch(begin_sql)?;
    match f() {
        Ok(val) => {
            conn.execute_batch("COMMIT;")?;
            Ok(val)
        }
        Err(err) => {
            let _ = conn.execute_batch("ROLLBACK;");
            Err(err)
        }
    }
}

/// Mengonfigurasi PRAGMA koneksi, menjalankan migrasi berversi, dan menyisipkan preset bawaan
pub fn init_connection(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;",
    )?;
    migrations::migrate(conn)?;
    providers::seed_defaults(conn)?;
    Ok(())
}

/// Inisialisasi basis data SQLite desktop pada app_data_dir
pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let mut db_path = match app_handle.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => PathBuf::from("."),
    };

    if !db_path.exists() {
        let _ = fs::create_dir_all(&db_path);
    }

    db_path.push("trawangan.db");

    let conn = Connection::open(&db_path)?;
    init_connection(&conn)?;

    Ok(conn)
}

/// Shim kompatibilitas sementara untuk `save_workspace_layout` hingga slice domain menggantinya
pub fn save_workspace(conn: &Connection, id: &str, name: &str, layout_json: &str) -> Result<()> {
    match id {
        "user_workspaces_list" => workspaces::replace_workspaces_from_json(conn, layout_json),
        "user_price_alerts" => alerts::replace_alerts_from_json(conn, layout_json),
        "user_trade_plan_vault" => trading_plans::replace_plans_from_json(conn, layout_json),
        "user_multi_watchlists" => watchlists::replace_registry_from_json(conn, layout_json),
        "trawangan_chart_default_config" => {
            if layout_json.trim().is_empty() {
                preferences::delete_app_preference(conn, "chart_default_config")
            } else {
                preferences::set_app_preference(conn, "chart_default_config", layout_json)
            }
        }
        "trawangan_app_settings" => {
            if layout_json.trim().is_empty() {
                preferences::delete_app_preference(conn, "app_settings")
            } else {
                preferences::set_app_preference(conn, "app_settings", layout_json)
            }
        }
        _ => workspaces::save_workspace_row_raw(conn, id, name, layout_json),
    }
}

/// Shim kompatibilitas sementara untuk `load_workspace_layout` hingga slice domain menggantinya
pub fn get_workspace(conn: &Connection, id: &str) -> Result<Option<String>> {
    match id {
        "user_workspaces_list" => workspaces::export_workspaces_as_json(conn),
        "user_price_alerts" => alerts::export_alerts_as_json(conn),
        "user_trade_plan_vault" => trading_plans::export_plans_as_json(conn),
        "user_multi_watchlists" => watchlists::export_registry_as_json(conn),
        "trawangan_chart_default_config" => preferences::get_app_preference(conn, "chart_default_config"),
        "trawangan_app_settings" => preferences::get_app_preference(conn, "app_settings"),
        _ => workspaces::get_workspace_row_raw(conn, id),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn setup_v1_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_connection(&conn).unwrap();
        conn
    }

    fn setup_v0_legacy_db(conn: &Connection) {
        conn.execute_batch(
            "CREATE TABLE candles (
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume REAL NOT NULL,
                PRIMARY KEY (symbol, timeframe, timestamp)
            );
            CREATE TABLE workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                layout_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                rest_url TEXT NOT NULL,
                ws_url TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE scripts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                code TEXT NOT NULL,
                is_overlay INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE drawings (
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                data_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (symbol, timeframe)
            );
            CREATE TABLE watchlist (
                symbol TEXT PRIMARY KEY,
                sort_order INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );",
        )
        .unwrap();
    }

    #[test]
    fn test_pragmas_wal_and_foreign_keys_enabled_on_file_db() {
        let temp_path = std::env::temp_dir().join(format!(
            "trawangan_pragma_test_{}.db",
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(1)
        ));
        let conn = Connection::open(&temp_path).unwrap();
        init_connection(&conn).unwrap();

        let fk: i64 = conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0)).unwrap();
        let journal: String = conn.query_row("PRAGMA journal_mode", [], |r| r.get(0)).unwrap();
        let user_ver: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();

        assert_eq!(fk, 1);
        assert_eq!(journal.to_lowercase(), "wal");
        assert_eq!(user_ver, 1);

        drop(conn);
        let _ = fs::remove_file(&temp_path);
        let _ = fs::remove_file(format!("{}-wal", temp_path.display()));
        let _ = fs::remove_file(format!("{}-shm", temp_path.display()));
    }

    #[test]
    fn test_migration_v0_to_v1_migrates_all_slots_drawings_and_drops_legacy_watchlist() {
        let conn = Connection::open_in_memory().unwrap();
        setup_v0_legacy_db(&conn);

        // 1. Isi 6 slot hijack di workspaces v0
        conn.execute(
            "INSERT INTO workspaces (id, name, layout_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                "user_workspaces_list",
                "User Saved Workspaces",
                r#"[{"id":"ws-1","name":"Scalp","schemaVersion":2,"symbol":"BTCUSDT","timeframe":"15m","layout":"2","providerId":"binance","timestamp":1000}]"#,
                1000
            ],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO workspaces (id, name, layout_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                "user_price_alerts",
                "User Price Alerts",
                r#"[{"id":"al-1","symbol":"binance:BTCUSDT","targetPrice":95000,"condition":"above","frequency":"once","label":"TP","active":true,"triggered":false,"createdAt":1001,"planId":"plan-1","planRole":"entry"}]"#,
                1001
            ],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO workspaces (id, name, layout_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                "user_trade_plan_vault",
                "User Trade Plan Vault",
                r#"[{"id":"tp-1","symbol":"BTCUSDT","providerId":"binance","timeframe":"1h","createdAt":100,"updatedAt":200,"rawText":"LONG BTC","plan":{"bias":"long"}}]"#,
                1002
            ],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO workspaces (id, name, layout_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                "user_multi_watchlists",
                "User Multi Watchlists",
                r##"{"activeWatchlistId":"wl-2","watchlists":[{"id":"default","name":"Daftar Utama","items":["binance:BTCUSDT"],"isPreset":false},{"id":"wl-2","name":"Scalp","items":["#section:Perps","bitunix:ETHUSDT.P"],"isPreset":false}]}"##,
                1003
            ],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO workspaces (id, name, layout_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                "trawangan_chart_default_config",
                "User Chart Default Config",
                r#"{"theme":"signature"}"#,
                1004
            ],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO workspaces (id, name, layout_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                "trawangan_app_settings",
                "User App Settings",
                r#"{"autoSaveWorkspace":true}"#,
                1005
            ],
        )
        .unwrap();

        // 2. Isi drawings v0 dengan 0, 1, dan 2+ titik dua
        conn.execute(
            "INSERT INTO drawings (symbol, timeframe, data_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params!["BTCUSDT", "15m", r#"{"drawings":[1]}"#, 100],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO drawings (symbol, timeframe, data_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params!["indodax:BTCIDR", "GLOBAL", r#"{"drawings":[2]}"#, 200],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO drawings (symbol, timeframe, data_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params!["ws-1:bitunix:SOL:USDT", "GLOBAL", r#"{"drawings":[3]}"#, 300],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO drawings (symbol, timeframe, data_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params!["default_workspace:binance:ETHUSDT", "GLOBAL", r#"{"drawings":[4]}"#, 400],
        )
        .unwrap();

        // 3. Isi tabel watchlist legacy
        conn.execute(
            "INSERT INTO watchlist (symbol, sort_order, created_at) VALUES ('BTCUSDT', 0, 100)",
            [],
        )
        .unwrap();

        // Jalankan migrasi
        init_connection(&conn).unwrap();

        // Verifikasi user_version = 1
        let user_ver: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(user_ver, 1);

        // Verifikasi slot hijack hilang dari tabel workspaces & hanya workspace nyata yang tersisa
        let ws_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM workspaces", [], |r| r.get(0))
            .unwrap();
        assert_eq!(ws_count, 1);
        let (ws_id, ws_name, ws_sym): (String, String, String) = conn
            .query_row(
                "SELECT id, name, symbol FROM workspaces WHERE id = 'ws-1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(ws_id, "ws-1");
        assert_eq!(ws_name, "Scalp");
        assert_eq!(ws_sym, "BTCUSDT");

        // Verifikasi drawings terpecah ke kolom terstruktur
        let d0: String = conn
            .query_row(
                "SELECT data_json FROM drawings WHERE workspace_id = '' AND provider_id = 'binance' AND symbol = 'BTCUSDT' AND timeframe = '15m'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(d0, r#"{"drawings":[1]}"#);

        let d1: String = conn
            .query_row(
                "SELECT data_json FROM drawings WHERE workspace_id = '' AND provider_id = 'indodax' AND symbol = 'BTCIDR' AND timeframe = 'GLOBAL'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(d1, r#"{"drawings":[2]}"#);

        let d2: String = conn
            .query_row(
                "SELECT data_json FROM drawings WHERE workspace_id = 'ws-1' AND provider_id = 'bitunix' AND symbol = 'SOL:USDT' AND timeframe = 'GLOBAL'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(d2, r#"{"drawings":[3]}"#);

        let d3: String = conn
            .query_row(
                "SELECT data_json FROM drawings WHERE workspace_id = 'default_workspace' AND provider_id = 'binance' AND symbol = 'ETHUSDT' AND timeframe = 'GLOBAL'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(d3, r#"{"drawings":[4]}"#);

        // Verifikasi price_alerts, trading_plans, watchlists, app_preferences
        let alert_plan: String = conn
            .query_row("SELECT plan_id FROM price_alerts WHERE id = 'al-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(alert_plan, "plan-1");

        let tp_sym: String = conn
            .query_row("SELECT symbol FROM trading_plans WHERE id = 'tp-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(tp_sym, "BTCUSDT");

        let active_wl: String = conn
            .query_row("SELECT id FROM watchlists WHERE is_active = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(active_wl, "wl-2");

        // Verifikasi tabel watchlist lama sudah dihapus
        let legacy_wl_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'watchlist'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(legacy_wl_exists, 0);

        // Verifikasi app_preferences terisi
        assert_eq!(
            preferences::get_app_preference(&conn, "chart_default_config").unwrap(),
            Some(r#"{"theme":"signature"}"#.to_string())
        );
        assert_eq!(
            preferences::get_app_preference(&conn, "app_settings").unwrap(),
            Some(r#"{"autoSaveWorkspace":true}"#.to_string())
        );

        // Verifikasi idempotensi: ubah data pasca migrasi, lalu panggil init_connection lagi -> data tidak ter-reset
        preferences::delete_app_preference(&conn, "chart_default_config").unwrap();
        init_connection(&conn).unwrap();
        assert_eq!(
            preferences::get_app_preference(&conn, "chart_default_config").unwrap(),
            None
        );
    }

    #[test]
    fn test_migration_fallback_from_legacy_watchlist_table_when_multi_watchlist_absent() {
        let conn = Connection::open_in_memory().unwrap();
        setup_v0_legacy_db(&conn);

        conn.execute(
            "INSERT INTO watchlist (symbol, sort_order, created_at) VALUES ('SOLUSDT', 0, 50)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO watchlist (symbol, sort_order, created_at) VALUES ('ETHUSDT', 1, 51)",
            [],
        )
        .unwrap();

        init_connection(&conn).unwrap();

        let wl = get_watchlist(&conn).unwrap();
        assert_eq!(wl, vec!["SOLUSDT".to_string(), "ETHUSDT".to_string()]);
    }

    #[test]
    fn test_migration_tolerates_corrupted_json_and_empty_chart_sentinel() {
        let conn = Connection::open_in_memory().unwrap();
        setup_v0_legacy_db(&conn);

        conn.execute(
            "INSERT INTO workspaces (id, name, layout_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params!["user_workspaces_list", "Broken", "{not-valid-json", 100],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO workspaces (id, name, layout_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params!["trawangan_chart_default_config", "Empty", "", 100],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO workspaces (id, name, layout_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params!["trawangan_app_settings", "BrokenSettings", "{corrupt-json", 100],
        )
        .unwrap();

        init_connection(&conn).unwrap();

        let user_ver: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(user_ver, 1);
        assert_eq!(
            preferences::get_app_preference(&conn, "chart_default_config").unwrap(),
            None
        );
        assert_eq!(
            preferences::get_app_preference(&conn, "app_settings").unwrap(),
            None
        );
    }

    #[test]
    fn test_save_watchlist_shim_preserves_section_tokens_when_symbols_match() {
        let conn = setup_v1_test_db();
        let registry_json = r##"{"activeWatchlistId":"default","watchlists":[{"id":"default","name":"Daftar Utama","items":["#section:Utama","binance:BTCUSDT","binance:ETHUSDT"],"isPreset":false}]}"##;
        save_workspace(&conn, "user_multi_watchlists", "Multi", registry_json).unwrap();

        // Caller lama memanggil save_watchlist hanya dengan simbol non-section yang sama
        save_watchlist(
            &conn,
            &["binance:BTCUSDT".to_string(), "binance:ETHUSDT".to_string()],
        )
        .unwrap();

        let exported = get_workspace(&conn, "user_multi_watchlists").unwrap().unwrap();
        assert!(exported.contains("#section:Utama"));
    }

    #[test]
    fn test_watchlists_on_delete_cascade() {
        let conn = setup_v1_test_db();
        let registry = serde_json::json!({
            "activeWatchlistId": "wl-1",
            "watchlists": [
                { "id": "wl-1", "name": "List 1", "items": ["binance:BTCUSDT", "#section:Alt"], "isPreset": false }
            ]
        });
        watchlists::save_registry_from_value(&conn, &registry).unwrap();

        let items_before: i64 = conn
            .query_row("SELECT COUNT(*) FROM watchlist_items WHERE watchlist_id = 'wl-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(items_before, 2);

        conn.execute("DELETE FROM watchlists WHERE id = 'wl-1'", []).unwrap();

        let items_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM watchlist_items WHERE watchlist_id = 'wl-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(items_after, 0);
    }

    #[test]
    fn test_candle_caching_and_retrieval() {
        let conn = setup_v1_test_db();
        let sample_candles = vec![
            Candle { time: 1000, open: 100.0, high: 110.0, low: 95.0, close: 105.0, volume: 50.0 },
            Candle { time: 2000, open: 105.0, high: 115.0, low: 100.0, close: 112.0, volume: 60.0 },
            Candle { time: 3000, open: 112.0, high: 120.0, low: 110.0, close: 118.0, volume: 75.0 },
        ];

        cache_candles(&conn, "BTCUSDT", "1m", &sample_candles).unwrap();
        let cached = get_cached_candles(&conn, "BTCUSDT", "1m", 10).unwrap();

        assert_eq!(cached.len(), 3);
        assert_eq!(cached[0].time, 1000);
        assert_eq!(cached[2].close, 118.0);
    }

    #[test]
    fn test_workspace_and_provider_persistence() {
        let conn = setup_v1_test_db();
        save_workspace(&conn, "default", "Main 4-Grid", "{\"layout\":\"4\"}").unwrap();
        let layout = get_workspace(&conn, "default").unwrap();
        assert!(layout.unwrap().contains("\"layout\":\"4\""));

        let provider = ProviderConfig {
            id: "custom-node".to_string(),
            name: "Local Node".to_string(),
            rest_url: "http://localhost:8080".to_string(),
            ws_url: "ws://localhost:8080/ws".to_string(),
            is_active: true,
        };
        save_provider(&conn, &provider).unwrap();
        let providers = get_providers(&conn).unwrap();
        assert!(providers.iter().any(|p| p.id == "custom-node" && p.is_active));
    }

    #[test]
    fn test_pine_script_crud() {
        let conn = setup_v1_test_db();
        let script = PineScriptRecord {
            id: "user-script-1".to_string(),
            title: "Super EMA Ribbon".to_string(),
            code: "//@version=5\nindicator(\"Super EMA\", overlay=true)\nplot(ta.ema(close, 20))".to_string(),
            is_overlay: true,
            created_at: 1000,
            updated_at: 2000,
        };

        save_pine_script(&conn, &script).unwrap();
        let scripts = get_pine_scripts(&conn).unwrap();
        assert_eq!(scripts.len(), 1);
        assert_eq!(scripts[0].title, "Super EMA Ribbon");

        delete_pine_script(&conn, "user-script-1").unwrap();
        let scripts_after = get_pine_scripts(&conn).unwrap();
        assert_eq!(scripts_after.len(), 0);
    }

    #[test]
    fn test_drawings_persistence() {
        let conn = setup_v1_test_db();
        let doc_json = "{\"version\":1,\"drawings\":[{\"id\":\"dw-1\",\"type\":\"trend_line\"}]}";

        save_drawings(&conn, "BTCUSDT", "15m", doc_json).unwrap();
        let loaded = get_drawings(&conn, "BTCUSDT", "15m").unwrap();
        assert_eq!(loaded, Some(doc_json.to_string()));

        let loaded_diff_tf = get_drawings(&conn, "BTCUSDT", "1h").unwrap();
        assert_eq!(loaded_diff_tf, None);

        clear_drawings(&conn, "BTCUSDT", "15m").unwrap();
        let loaded_after = get_drawings(&conn, "BTCUSDT", "15m").unwrap();
        assert_eq!(loaded_after, None);
    }

    #[test]
    fn test_list_drawing_keys() {
        let conn = setup_v1_test_db();
        save_drawings(&conn, "default_workspace:binance:BTCUSDT", "GLOBAL", "{}").unwrap();
        save_drawings(&conn, "default_workspace:indodax:BTCIDR", "GLOBAL", "{}").unwrap();
        save_drawings(&conn, "defaultXworkspace:binance:ETHUSDT", "GLOBAL", "{}").unwrap();

        let keys = list_drawing_keys(&conn, "default_workspace:").unwrap();
        assert_eq!(keys.len(), 2);
        assert!(keys.iter().any(|k| k.symbol == "default_workspace:binance:BTCUSDT" && k.timeframe == "GLOBAL"));
        assert!(keys.iter().any(|k| k.symbol == "default_workspace:indodax:BTCIDR" && k.timeframe == "GLOBAL"));
    }

    #[test]
    fn test_watchlist_persistence() {
        let conn = setup_v1_test_db();
        let default_list = vec!["BTCUSDT".to_string(), "ETHUSDT".to_string(), "SOLUSDT".to_string()];
        save_watchlist(&conn, &default_list).unwrap();

        let list = get_watchlist(&conn).unwrap();
        assert_eq!(list.len(), 3);
        assert_eq!(list[0], "BTCUSDT");
        assert_eq!(list[2], "SOLUSDT");

        let updated_list = vec!["SOLUSDT".to_string(), "DOGEUSDT".to_string()];
        save_watchlist(&conn, &updated_list).unwrap();
        let list_updated = get_watchlist(&conn).unwrap();
        assert_eq!(list_updated.len(), 2);
        assert_eq!(list_updated[0], "SOLUSDT");
    }
}
