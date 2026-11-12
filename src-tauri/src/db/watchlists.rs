// Sub-modul Multi-Watchlist Registry relasional (watchlists + watchlist_items ON DELETE CASCADE)
use rusqlite::{params, Connection, Result};
use serde_json::{Map, Value};

/// Pastikan tabel watchlists dan watchlist_items (beserta FOREIGN KEY CASCADE) tersedia
pub fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS watchlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            is_preset INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS watchlist_items (
            watchlist_id TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            entry TEXT NOT NULL,
            PRIMARY KEY (watchlist_id, sort_order),
            FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE
        );",
    )
}

/// Simpan seluruh Multi-Watchlist Registry ke `watchlists` dan `watchlist_items`
pub fn save_registry_from_value(conn: &Connection, registry: &Value) -> Result<()> {
    let active_id = registry
        .get("activeWatchlistId")
        .and_then(|v| v.as_str())
        .unwrap_or("default");
    let lists = match registry.get("watchlists").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return Ok(()),
    };

    let now = chrono::Utc::now().timestamp_millis();
    conn.execute("DELETE FROM watchlists", [])?;

    let mut wl_stmt = conn.prepare_cached(
        "INSERT INTO watchlists (id, name, is_preset, is_active, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )?;
    let mut item_stmt = conn.prepare_cached(
        "INSERT INTO watchlist_items (watchlist_id, sort_order, entry) VALUES (?1, ?2, ?3)",
    )?;

    for (wl_idx, wl) in lists.iter().enumerate() {
        let Some(id) = wl.get("id").and_then(|v| v.as_str()).map(str::trim).filter(|s| !s.is_empty()) else {
            continue;
        };
        let name = wl.get("name").and_then(|v| v.as_str()).unwrap_or("Watchlist");
        let is_preset = if wl.get("isPreset").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };
        let is_active = if id == active_id { 1 } else { 0 };
        let created_at = wl.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(now);
        let updated_at = wl.get("updatedAt").and_then(|v| v.as_i64()).unwrap_or(now);

        wl_stmt.execute(params![
            id,
            name,
            is_preset,
            is_active,
            wl_idx as i64,
            created_at,
            updated_at
        ])?;

        if let Some(items) = wl.get("items").and_then(|v| v.as_array()) {
            for (item_idx, entry_val) in items.iter().enumerate() {
                if let Some(entry) = entry_val.as_str() {
                    item_stmt.execute(params![id, item_idx as i64, entry])?;
                }
            }
        }
    }
    Ok(())
}

/// Simpan seluruh Multi-Watchlist Registry secara transaksional dari JSON string (fail-loud)
pub fn save_watchlist_registry(conn: &Connection, registry_json: &str) -> Result<()> {
    let val: Value = serde_json::from_str(registry_json).map_err(|e| {
        rusqlite::Error::InvalidParameterName(format!("JSON watchlist registry tidak valid: {e}"))
    })?;
    if !val.is_object() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Watchlist registry harus berupa objek JSON".to_string(),
        ));
    }
    super::with_transaction(conn, "BEGIN IMMEDIATE;", || {
        save_registry_from_value(conn, &val)
    })
}

/// Muat seluruh Multi-Watchlist Registry dari tabel relasional `watchlists` & `watchlist_items`
pub fn load_watchlist_registry(conn: &Connection) -> Result<Option<Value>> {
    let mut wl_stmt = conn.prepare_cached(
        "SELECT id, name, is_preset, is_active, created_at, updated_at
         FROM watchlists
         ORDER BY sort_order ASC",
    )?;
    let mut wl_rows = wl_stmt.query([])?;

    let mut watchlists: Vec<Value> = Vec::new();
    let mut active_id: Option<String> = None;

    while let Some(row) = wl_rows.next()? {
        let id: String = row.get(0)?;
        let name: String = row.get(1)?;
        let is_preset = row.get::<_, i32>(2)? == 1;
        let is_active = row.get::<_, i32>(3)? == 1;
        let created_at: i64 = row.get(4)?;
        let updated_at: i64 = row.get(5)?;

        if is_active {
            active_id = Some(id.clone());
        }

        let mut item_stmt = conn.prepare_cached(
            "SELECT entry FROM watchlist_items WHERE watchlist_id = ?1 ORDER BY sort_order ASC",
        )?;
        let item_rows = item_stmt.query_map(params![id], |r| r.get::<_, String>(0))?;
        let items: Vec<Value> = item_rows.filter_map(|r| r.ok()).map(Value::String).collect();

        let mut obj = Map::new();
        obj.insert("id".to_string(), Value::String(id));
        obj.insert("name".to_string(), Value::String(name));
        obj.insert("items".to_string(), Value::Array(items));
        obj.insert("isPreset".to_string(), Value::Bool(is_preset));
        obj.insert("createdAt".to_string(), serde_json::json!(created_at));
        obj.insert("updatedAt".to_string(), serde_json::json!(updated_at));
        watchlists.push(Value::Object(obj));
    }

    if watchlists.is_empty() {
        return Ok(None);
    }

    let resolved_active = active_id.unwrap_or_else(|| {
        watchlists[0]
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("default")
            .to_string()
    });

    Ok(Some(serde_json::json!({
        "activeWatchlistId": resolved_active,
        "watchlists": watchlists
    })))
}
