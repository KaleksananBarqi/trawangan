// Sub-modul konfigurasi data provider bursa kripto
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub rest_url: String,
    pub ws_url: String,
    pub is_active: bool,
}

/// Pastikan tabel providers tersedia
pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            rest_url TEXT NOT NULL,
            ws_url TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0
        );",
    )
}

/// Sisipkan preset provider bawaan apabila belum ada
pub fn seed_defaults(conn: &Connection) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO providers (id, name, rest_url, ws_url, is_active)
         VALUES ('binance', 'Binance Official Public', 'https://api.binance.com', 'wss://stream.binance.com:9443', 1)",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO providers (id, name, rest_url, ws_url, is_active)
         VALUES ('hyperliquid', 'Hyperliquid DEX Perpetuals', 'https://api.hyperliquid.xyz', 'wss://api.hyperliquid.xyz/ws', 0)",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO providers (id, name, rest_url, ws_url, is_active)
         VALUES ('coinbase', 'Coinbase Exchange Spot', 'https://api.exchange.coinbase.com', 'wss://ws-feed.exchange.coinbase.com', 0)",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO providers (id, name, rest_url, ws_url, is_active)
         VALUES ('bitunix', 'Bitunix Futures', 'https://fapi.bitunix.com', 'wss://fapi.bitunix.com/public/', 0)",
        [],
    )?;
    Ok(())
}

/// Ambil seluruh data provider yang tersimpan
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

/// Simpan atau perbarui konfigurasi provider
pub fn save_provider(conn: &Connection, p: &ProviderConfig) -> Result<()> {
    let is_active_int = if p.is_active { 1 } else { 0 };
    if p.is_active {
        let _ = conn.execute("UPDATE providers SET is_active = 0", []);
    }
    conn.execute(
        "INSERT OR REPLACE INTO providers (id, name, rest_url, ws_url, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![p.id, p.name, p.rest_url, p.ws_url, is_active_int],
    )?;
    Ok(())
}

/// Tetapkan provider aktif secara eksklusif
pub fn set_active_provider(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("UPDATE providers SET is_active = 0", [])?;
    conn.execute("UPDATE providers SET is_active = 1 WHERE id = ?1", params![id])?;
    Ok(())
}

/// Hapus provider berdasarkan ID
pub fn delete_provider(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM providers WHERE id = ?1", params![id])?;
    Ok(())
}
