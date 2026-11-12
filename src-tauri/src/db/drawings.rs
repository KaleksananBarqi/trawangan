// Sub-modul dokumen gambar analisis teknikal (drawings) berkolom terstruktur
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrawingKeyEntry {
    pub symbol: String,
    pub timeframe: String,
}

/// Pastikan tabel drawings v1 beserta indeks workspace tersedia
pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS drawings (
            workspace_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            timeframe TEXT NOT NULL,
            data_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (workspace_id, provider_id, symbol, timeframe)
        );
        CREATE INDEX IF NOT EXISTS idx_drawings_workspace ON drawings (workspace_id);",
    )
}

/// Memecah key gabungan lama (`<workspaceId>:<providerId>:<symbol>`) menjadi kolom terstruktur.
/// - 0 titik dua -> `("", "binance", raw)`
/// - 1 titik dua -> `("", provider_id, symbol)`
/// - 2+ titik dua -> `(workspace_id, provider_id, sisa_symbol)`
pub fn split_composite_key(raw: &str) -> (String, String, String) {
    let parts: Vec<&str> = raw.splitn(3, ':').collect();
    match parts.len() {
        1 => (String::new(), "binance".to_string(), parts[0].to_string()),
        2 => (String::new(), parts[0].to_string(), parts[1].to_string()),
        _ => (
            parts[0].to_string(),
            parts[1].to_string(),
            parts[2].to_string(),
        ),
    }
}

/// Merangkai kembali key komposit untuk kompatibilitas caller/IPC sementara sebelum kontrak scope baru
pub fn format_composite_key(workspace_id: &str, provider_id: &str, symbol: &str) -> String {
    if workspace_id.is_empty() {
        if provider_id == "binance" && !symbol.contains(':') {
            symbol.to_string()
        } else {
            format!("{}:{}", provider_id, symbol)
        }
    } else {
        format!("{}:{}:{}", workspace_id, provider_id, symbol)
    }
}

/// Simpan dokumen gambar analisis teknikal menggunakan pemecahan key komposit di batas storage
pub fn save_drawings(conn: &Connection, symbol: &str, timeframe: &str, data_json: &str) -> Result<()> {
    let now = chrono::Utc::now().timestamp_millis();
    let (workspace_id, provider_id, clean_symbol) = split_composite_key(symbol);
    conn.execute(
        "INSERT OR REPLACE INTO drawings (workspace_id, provider_id, symbol, timeframe, data_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![workspace_id, provider_id, clean_symbol, timeframe, data_json, now],
    )?;
    Ok(())
}

/// Ambil dokumen gambar analisis teknikal
pub fn get_drawings(conn: &Connection, symbol: &str, timeframe: &str) -> Result<Option<String>> {
    let (workspace_id, provider_id, clean_symbol) = split_composite_key(symbol);
    let mut stmt = conn.prepare_cached(
        "SELECT data_json FROM drawings
         WHERE workspace_id = ?1 AND provider_id = ?2 AND symbol = ?3 AND timeframe = ?4",
    )?;

    let mut rows = stmt.query(params![workspace_id, provider_id, clean_symbol, timeframe])?;
    if let Some(row) = rows.next()? {
        let json: String = row.get(0)?;
        Ok(Some(json))
    } else {
        Ok(None)
    }
}

/// Mengambil daftar kunci drawing berdasarkan prefix (kompatibilitas sementara hingga Tiket #173/#180)
pub fn list_drawing_keys(conn: &Connection, prefix: &str) -> Result<Vec<DrawingKeyEntry>> {
    let mut stmt = conn.prepare_cached(
        "SELECT workspace_id, provider_id, symbol, timeframe FROM drawings",
    )?;
    let mut rows = stmt.query([])?;
    let mut entries = Vec::new();
    while let Some(row) = rows.next()? {
        let ws_id: String = row.get(0)?;
        let provider_id: String = row.get(1)?;
        let symbol: String = row.get(2)?;
        let timeframe: String = row.get(3)?;
        let full_key = format_composite_key(&ws_id, &provider_id, &symbol);
        if full_key.starts_with(prefix) {
            entries.push(DrawingKeyEntry {
                symbol: full_key,
                timeframe,
            });
        }
    }
    Ok(entries)
}

/// Hapus dokumen gambar analisis teknikal
pub fn clear_drawings(conn: &Connection, symbol: &str, timeframe: &str) -> Result<()> {
    let (workspace_id, provider_id, clean_symbol) = split_composite_key(symbol);
    conn.execute(
        "DELETE FROM drawings
         WHERE workspace_id = ?1 AND provider_id = ?2 AND symbol = ?3 AND timeframe = ?4",
        params![workspace_id, provider_id, clean_symbol, timeframe],
    )?;
    Ok(())
}

/// Menyalin seluruh dokumen drawings beserta `_trawangan_meta` antar workspace dalam satu transaksi SQL
pub fn clone_workspace_drawings(conn: &Connection, from_ws_id: &str, to_ws_id: &str) -> Result<usize> {
    let norm_from = from_ws_id.trim().to_lowercase();
    let norm_to = to_ws_id.trim().to_lowercase();
    if norm_from.is_empty() || norm_to.is_empty() || norm_from == norm_to {
        return Ok(0);
    }

    let now = chrono::Utc::now().timestamp_millis();
    super::with_transaction(conn, "BEGIN IMMEDIATE;", || {
        let count = conn.execute(
            "INSERT OR REPLACE INTO drawings (workspace_id, provider_id, symbol, timeframe, data_json, updated_at)
             SELECT ?1, provider_id, symbol, timeframe, data_json, ?2
             FROM drawings
             WHERE LOWER(workspace_id) = ?3",
            params![norm_to, now, norm_from],
        )?;
        Ok(count)
    })
}
