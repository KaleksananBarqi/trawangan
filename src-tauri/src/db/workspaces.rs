// Sub-modul penyimpanan workspace (Workspace State v2)
use rusqlite::{params, Connection, Result};
use serde_json::Value;

/// Pastikan tabel workspaces v1 tersedia
pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            schema_version INTEGER NOT NULL DEFAULT 2,
            symbol TEXT NOT NULL DEFAULT '',
            timeframe TEXT NOT NULL DEFAULT '',
            layout TEXT NOT NULL DEFAULT '1',
            provider_id TEXT,
            layout_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );",
    )
}

/// Sisipkan atau perbarui satu baris workspace dari JSON `SavedWorkspace`
pub fn upsert_workspace_value(conn: &Connection, item: &Value, fallback_updated_at: i64) -> Result<bool> {
    let id = match item.get("id").and_then(|v| v.as_str()).map(str::trim) {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => return Ok(false),
    };
    let name = item
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Workspace")
        .to_string();
    let schema_version = item
        .get("schemaVersion")
        .and_then(|v| v.as_i64())
        .unwrap_or(2);
    let symbol = item
        .get("symbol")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let timeframe = item
        .get("timeframe")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let layout = item
        .get("layout")
        .and_then(|v| v.as_str())
        .unwrap_or("1")
        .to_string();
    let provider_id: Option<String> = item
        .get("providerId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let updated_at = item
        .get("timestamp")
        .and_then(|v| v.as_i64())
        .unwrap_or(fallback_updated_at);
    let layout_json = serde_json::to_string(item).unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "INSERT OR REPLACE INTO workspaces (
            id, name, schema_version, symbol, timeframe, layout, provider_id, layout_json, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            name,
            schema_version,
            symbol,
            timeframe,
            layout,
            provider_id,
            layout_json,
            updated_at
        ],
    )?;
    Ok(true)
}

/// Ganti seluruh daftar workspace dari array JSON (dipakai shim slot sementara hingga Tiket #176)
pub fn replace_workspaces_from_json(conn: &Connection, json: &str) -> Result<()> {
    let Ok(parsed) = serde_json::from_str::<Vec<Value>>(json) else {
        return Ok(());
    };
    let now = chrono::Utc::now().timestamp_millis();
    super::with_transaction(conn, "BEGIN IMMEDIATE;", || {
        conn.execute("DELETE FROM workspaces", [])?;
        for item in &parsed {
            let _ = upsert_workspace_value(conn, item, now)?;
        }
        Ok(())
    })
}

/// Serialisasikan seluruh baris tabel workspaces menjadi JSON array (dipakai shim sementara hingga Tiket #176)
pub fn export_workspaces_as_json(conn: &Connection) -> Result<Option<String>> {
    let mut stmt = conn.prepare_cached(
        "SELECT layout_json FROM workspaces ORDER BY updated_at ASC, rowid ASC",
    )?;
    let mut rows = stmt.query([])?;
    let mut items: Vec<Value> = Vec::new();
    while let Some(row) = rows.next()? {
        let raw: String = row.get(0)?;
        if let Ok(val) = serde_json::from_str::<Value>(&raw) {
            items.push(val);
        }
    }
    if items.is_empty() {
        Ok(None)
    } else {
        Ok(Some(serde_json::to_string(&items).unwrap_or_else(|_| "[]".to_string())))
    }
}

/// Simpan satu baris workspace langsung (shim sementara untuk API `save_workspace` lama)
pub fn save_workspace_row_raw(conn: &Connection, id: &str, name: &str, layout_json: &str) -> Result<()> {
    let now = chrono::Utc::now().timestamp_millis();
    if let Ok(mut val) = serde_json::from_str::<Value>(layout_json) {
        if let Some(obj) = val.as_object_mut() {
            if !obj.contains_key("id") {
                obj.insert("id".to_string(), Value::String(id.to_string()));
            }
            if !obj.contains_key("name") {
                obj.insert("name".to_string(), Value::String(name.to_string()));
            }
            let _ = upsert_workspace_value(conn, &val, now)?;
            return Ok(());
        }
    }
    conn.execute(
        "INSERT OR REPLACE INTO workspaces (
            id, name, schema_version, symbol, timeframe, layout, provider_id, layout_json, updated_at
        ) VALUES (?1, ?2, 2, '', '', '1', NULL, ?3, ?4)",
        params![id, name, layout_json, now],
    )?;
    Ok(())
}

/// Ambil `layout_json` satu workspace berdasarkan ID (shim sementara untuk API `get_workspace` lama)
pub fn get_workspace_row_raw(conn: &Connection, id: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare_cached("SELECT layout_json FROM workspaces WHERE id = ?1")?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

/// Ambil seluruh `layout_json` workspace tersimpan terurut stabil
pub fn list_workspaces(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare_cached(
        "SELECT layout_json FROM workspaces ORDER BY updated_at ASC, rowid ASC",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect()
}

/// Sisipkan atau perbarui satu baris workspace dari JSON `SavedWorkspace`
pub fn upsert_workspace(conn: &Connection, workspace_json: &str) -> Result<()> {
    let val: Value = serde_json::from_str(workspace_json)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let now = chrono::Utc::now().timestamp_millis();
    upsert_workspace_value(conn, &val, now)?;
    Ok(())
}

/// Hapus satu workspace beserta seluruh drawings miliknya dalam satu transaksi atomik.
/// Tidak pernah menyentuh `default_workspace`, gambar warisan tanpa workspace (`''`), atau workspace lain.
pub fn delete_workspace(conn: &Connection, id: &str) -> Result<()> {
    let clean_id = id.trim();
    if clean_id.is_empty() {
        return Ok(());
    }

    super::with_transaction(conn, "BEGIN IMMEDIATE;", || {
        conn.execute("DELETE FROM workspaces WHERE id = ?1", params![clean_id])?;
        if !clean_id.eq_ignore_ascii_case("default_workspace") {
            conn.execute(
                "DELETE FROM drawings WHERE LOWER(workspace_id) = LOWER(?1)",
                params![clean_id],
            )?;
        }
        Ok(())
    })
}
