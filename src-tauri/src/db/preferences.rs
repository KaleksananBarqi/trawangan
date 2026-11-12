// Sub-modul preferensi aplikasi dan konfigurasi default chart
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppPreferenceEntry {
    pub key: String,
    pub value_json: String,
    pub updated_at: i64,
}

/// Pastikan tabel app_preferences tersedia
pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS app_preferences (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );",
    )
}

/// Baca nilai JSON preferensi berdasarkan kunci
pub fn get_app_preference(conn: &Connection, key: &str) -> Result<Option<String>> {
    let clean_key = key.trim();
    if clean_key.is_empty() {
        return Ok(None);
    }
    let mut stmt = conn.prepare_cached("SELECT value_json FROM app_preferences WHERE key = ?1")?;
    let mut rows = stmt.query(params![clean_key])?;
    if let Some(row) = rows.next()? {
        let val: String = row.get(0)?;
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

/// Simpan atau perbarui nilai JSON preferensi dengan timestamp eksplisit (untuk migrasi)
pub(crate) fn set_app_preference_with_timestamp(
    conn: &Connection,
    key: &str,
    value_json: &str,
    updated_at: i64,
) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_preferences (key, value_json, updated_at)
         VALUES (?1, ?2, ?3)",
        params![key, value_json, updated_at],
    )?;
    Ok(())
}

/// Simpan atau perbarui nilai JSON preferensi berdasarkan kunci (fail-loud bila JSON atau key tidak valid)
pub fn set_app_preference(conn: &Connection, key: &str, value_json: &str) -> Result<()> {
    let clean_key = key.trim();
    if clean_key.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Kunci preferensi tidak boleh kosong".to_string(),
        ));
    }
    serde_json::from_str::<serde_json::Value>(value_json).map_err(|e| {
        rusqlite::Error::InvalidParameterName(format!("JSON preferensi tidak valid: {e}"))
    })?;
    let now = chrono::Utc::now().timestamp_millis();
    set_app_preference_with_timestamp(conn, clean_key, value_json, now)
}

/// Hapus baris preferensi secara nyata via SQL DELETE
pub fn delete_app_preference(conn: &Connection, key: &str) -> Result<()> {
    let clean_key = key.trim();
    if clean_key.is_empty() {
        return Ok(());
    }
    conn.execute("DELETE FROM app_preferences WHERE key = ?1", params![clean_key])?;
    Ok(())
}

/// Muat seluruh baris preferensi aplikasi secara batch dalam satu query (terurut berdasarkan key)
pub fn load_all_app_preferences(conn: &Connection) -> Result<Vec<AppPreferenceEntry>> {
    let mut stmt = conn.prepare_cached(
        "SELECT key, value_json, updated_at FROM app_preferences ORDER BY key ASC",
    )?;
    let mut rows = stmt.query([])?;
    let mut entries = Vec::new();
    while let Some(row) = rows.next()? {
        entries.push(AppPreferenceEntry {
            key: row.get(0)?,
            value_json: row.get(1)?,
            updated_at: row.get(2)?,
        });
    }
    Ok(entries)
}
