// Sub-modul skrip indikator Pine Script kustom
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PineScriptRecord {
    pub id: String,
    pub title: String,
    pub code: String,
    pub is_overlay: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Pastikan tabel scripts tersedia
pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS scripts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            code TEXT NOT NULL,
            is_overlay INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );",
    )
}

/// Simpan atau perbarui skrip Pine Script
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

/// Ambil seluruh skrip Pine Script terurut dari pembaruan terbaru
pub fn get_pine_scripts(conn: &Connection) -> Result<Vec<PineScriptRecord>> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, title, code, is_overlay, created_at, updated_at FROM scripts ORDER BY updated_at DESC",
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
