// Modul Database SQLite Lokal untuk Caching Candle & Pengaturan Trawangan
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candle {
    pub time: i64, // Milliseconds epoch
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub rest_url: String,
    pub ws_url: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PineScriptRecord {
    pub id: String,
    pub title: String,
    pub code: String,
    pub is_overlay: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct DbState {
    pub conn: Mutex<Connection>,
}

/// Inisialisasi basis data SQLite dan tabel-tabel utama
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

    // Buat tabel candle untuk offline time-series cache
    conn.execute(
        "CREATE TABLE IF NOT EXISTS candles (
            symbol TEXT NOT NULL,
            timeframe TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            volume REAL NOT NULL,
            PRIMARY KEY (symbol, timeframe, timestamp)
        )",
        [],
    )?;

    // Index timestamp untuk query cepat
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_candles_lookup 
         ON candles (symbol, timeframe, timestamp DESC)",
        [],
    )?;

    // Tabel untuk menyimpan konfigurasi layout workspace
    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            layout_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Tabel untuk custom data providers
    conn.execute(
        "CREATE TABLE IF NOT EXISTS providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            rest_url TEXT NOT NULL,
            ws_url TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    // Tabel untuk skrip Pine Script kustom
    conn.execute(
        "CREATE TABLE IF NOT EXISTS scripts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            code TEXT NOT NULL,
            is_overlay INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Tabel untuk persistensi gambar analisis teknikal (drawings)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS drawings (
            symbol TEXT NOT NULL,
            timeframe TEXT NOT NULL,
            data_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (symbol, timeframe)
        )",
        [],
    )?;

    // Tabel untuk daftar pantau koin (watchlist)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS watchlist (
            symbol TEXT PRIMARY KEY,
            sort_order INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Masukkan default Binance provider jika belum ada
    conn.execute(
        "INSERT OR IGNORE INTO providers (id, name, rest_url, ws_url, is_active)
         VALUES ('binance-default', 'Binance Official Public', 'https://api.binance.com', 'wss://stream.binance.com:9443', 1)",
        [],
    )?;

    // Inisialisasi default watchlist jika masih kosong
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM watchlist", [], |row| row.get(0)).unwrap_or(0);
    if count == 0 {
        let defaults = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "SUIUSDT"];
        let now = chrono::Utc::now().timestamp_millis();
        for (idx, sym) in defaults.iter().enumerate() {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO watchlist (symbol, sort_order, created_at) VALUES (?1, ?2, ?3)",
                params![sym, idx as i64, now],
            );
        }
    }

    Ok(conn)
}

/// Simpan batch candle ke dalam database SQLite
pub fn cache_candles(conn: &Connection, symbol: &str, timeframe: &str, candles: &[Candle]) -> Result<()> {
    let mut stmt = conn.prepare_cached(
        "INSERT OR REPLACE INTO candles (symbol, timeframe, timestamp, open, high, low, close, volume)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    )?;

    for c in candles {
        stmt.execute(params![
            symbol,
            timeframe,
            c.time,
            c.open,
            c.high,
            c.low,
            c.close,
            c.volume
        ])?;
    }

    Ok(())
}

/// Ambil candle dari cache lokal
pub fn get_cached_candles(conn: &Connection, symbol: &str, timeframe: &str, limit: u32) -> Result<Vec<Candle>> {
    let mut stmt = conn.prepare_cached(
        "SELECT timestamp, open, high, low, close, volume 
         FROM candles 
         WHERE symbol = ?1 AND timeframe = ?2 
         ORDER BY timestamp DESC 
         LIMIT ?3"
    )?;

    let mut rows = stmt.query(params![symbol, timeframe, limit])?;
    let mut result = Vec::new();

    while let Some(row) = rows.next()? {
        result.push(Candle {
            time: row.get(0)?,
            open: row.get(1)?,
            high: row.get(2)?,
            low: row.get(3)?,
            close: row.get(4)?,
            volume: row.get(5)?,
        });
    }

    // Urutkan ascending agar sesuai urutan kronologis chart
    result.reverse();
    Ok(result)
}

/// Simpan layout workspace ke SQLite
pub fn save_workspace(conn: &Connection, id: &str, name: &str, layout_json: &str) -> Result<()> {
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "INSERT OR REPLACE INTO workspaces (id, name, layout_json, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![id, name, layout_json, now],
    )?;
    Ok(())
}

/// Ambil layout workspace
pub fn get_workspace(conn: &Connection, id: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare_cached("SELECT layout_json FROM workspaces WHERE id = ?1")?;
    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        let json: String = row.get(0)?;
        Ok(Some(json))
    } else {
        Ok(None)
    }
}

/// Ambil semua custom provider yang tersimpan
pub fn get_providers(conn: &Connection) -> Result<Vec<ProviderConfig>> {
    let mut stmt = conn.prepare_cached("SELECT id, name, rest_url, ws_url, is_active FROM providers")?;
    let mut rows = stmt.query([])?;
    let mut providers = Vec::new();

    while let Some(row) = rows.next()? {
        let is_active_int: i32 = row.get(4)?;
        providers.push(ProviderConfig {
            id: row.get(0)?,
            name: row.get(1)?,
            rest_url: row.get(2)?,
            ws_url: row.get(3)?,
            is_active: is_active_int == 1,
        });
    }

    Ok(providers)
}

/// Simpan custom provider
pub fn save_provider(conn: &Connection, p: &ProviderConfig) -> Result<()> {
    let is_active_int = if p.is_active { 1 } else { 0 };
    conn.execute(
        "INSERT OR REPLACE INTO providers (id, name, rest_url, ws_url, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![p.id, p.name, p.rest_url, p.ws_url, is_active_int],
    )?;
    Ok(())
}

/// Simpan skrip Pine Script ke SQLite
pub fn save_pine_script(conn: &Connection, script: &PineScriptRecord) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO scripts (id, title, code, is_overlay, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            script.id,
            script.title,
            script.code,
            if script.is_overlay { 1 } else { 0 },
            script.created_at,
            script.updated_at
        ],
    )?;
    Ok(())
}

/// Ambil seluruh skrip Pine Script tersimpan
pub fn get_pine_scripts(conn: &Connection) -> Result<Vec<PineScriptRecord>> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, title, code, is_overlay, created_at, updated_at FROM scripts ORDER BY updated_at DESC"
    )?;
    let mut rows = stmt.query([])?;
    let mut list = Vec::new();

    while let Some(row) = rows.next()? {
        let is_overlay_int: i32 = row.get(3)?;
        list.push(PineScriptRecord {
            id: row.get(0)?,
            title: row.get(1)?,
            code: row.get(2)?,
            is_overlay: is_overlay_int == 1,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        });
    }

    Ok(list)
}

/// Hapus skrip Pine Script berdasarkan ID
pub fn delete_pine_script(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM scripts WHERE id = ?1", params![id])?;
    Ok(())
}

/// Simpan gambar analisis teknikal (drawings JSON document) per simbol & timeframe
pub fn save_drawings(conn: &Connection, symbol: &str, timeframe: &str, data_json: &str) -> Result<()> {
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "INSERT OR REPLACE INTO drawings (symbol, timeframe, data_json, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![symbol, timeframe, data_json, now],
    )?;
    Ok(())
}

/// Ambil gambar analisis teknikal yang tersimpan untuk pasangan simbol & timeframe
pub fn get_drawings(conn: &Connection, symbol: &str, timeframe: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare_cached(
        "SELECT data_json FROM drawings WHERE symbol = ?1 AND timeframe = ?2"
    )?;

    let mut rows = stmt.query(params![symbol, timeframe])?;
    if let Some(row) = rows.next()? {
        let json: String = row.get(0)?;
        Ok(Some(json))
    } else {
        Ok(None)
    }
}

/// Hapus gambar analisis teknikal untuk simbol & timeframe tertentu
pub fn clear_drawings(conn: &Connection, symbol: &str, timeframe: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM drawings WHERE symbol = ?1 AND timeframe = ?2",
        params![symbol, timeframe],
    )?;
    Ok(())
}

/// Ambil daftar simbol dalam watchlist pengguna terurut berdasarkan sort_order
pub fn get_watchlist(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare_cached(
        "SELECT symbol FROM watchlist ORDER BY sort_order ASC, created_at ASC"
    )?;

    let rows = stmt.query_map([], |row| row.get(0))?;
    let mut symbols = Vec::new();
    for s in rows {
        symbols.push(s?);
    }
    Ok(symbols)
}

/// Perbarui seluruh daftar watchlist pengguna
pub fn save_watchlist(conn: &Connection, symbols: &[String]) -> Result<()> {
    conn.execute("DELETE FROM watchlist", [])?;
    let now = chrono::Utc::now().timestamp_millis();
    let mut stmt = conn.prepare_cached(
        "INSERT INTO watchlist (symbol, sort_order, created_at) VALUES (?1, ?2, ?3)"
    )?;

    for (idx, sym) in symbols.iter().enumerate() {
        stmt.execute(params![sym, idx as i64, now])?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
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
            )",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                layout_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                rest_url TEXT NOT NULL,
                ws_url TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0
            )",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE scripts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                code TEXT NOT NULL,
                is_overlay INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE drawings (
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                data_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (symbol, timeframe)
            )",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE watchlist (
                symbol TEXT PRIMARY KEY,
                sort_order INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        ).unwrap();
        conn
    }

    #[test]
    fn test_candle_caching_and_retrieval() {
        let conn = setup_test_db();
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
        let conn = setup_test_db();
        save_workspace(&conn, "default", "Main 4-Grid", "{\"layout\":\"4\"}").unwrap();
        let layout = get_workspace(&conn, "default").unwrap();
        assert_eq!(layout, Some("{\"layout\":\"4\"}".to_string()));

        let provider = ProviderConfig {
            id: "custom-node".to_string(),
            name: "Local Node".to_string(),
            rest_url: "http://localhost:8080".to_string(),
            ws_url: "ws://localhost:8080/ws".to_string(),
            is_active: true,
        };
        save_provider(&conn, &provider).unwrap();
        let providers = get_providers(&conn).unwrap();
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].name, "Local Node");
        assert!(providers[0].is_active);
    }

    #[test]
    fn test_pine_script_crud() {
        let conn = setup_test_db();
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
        let conn = setup_test_db();
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
    fn test_watchlist_persistence() {
        let conn = setup_test_db();
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

