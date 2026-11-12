// Sub-modul cache candle time-series lokal
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candle {
    pub time: i64, // Epoch dalam milidetik
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

/// Pastikan tabel dan indeks cache candle tersedia
pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
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
        );
        CREATE INDEX IF NOT EXISTS idx_candles_lookup
            ON candles (symbol, timeframe, timestamp DESC);",
    )
}

/// Simpan batch candle ke dalam database SQLite
pub fn cache_candles(conn: &Connection, symbol: &str, timeframe: &str, candles: &[Candle]) -> Result<()> {
    if candles.is_empty() {
        return Ok(());
    }

    super::with_transaction(conn, "BEGIN TRANSACTION;", || {
        let mut stmt = conn.prepare_cached(
            "INSERT OR REPLACE INTO candles (symbol, timeframe, timestamp, open, high, low, close, volume)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
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
    })
}

/// Ambil candle dari cache lokal secara kronologis ascending
pub fn get_cached_candles(
    conn: &Connection,
    symbol: &str,
    timeframe: &str,
    limit: u32,
) -> Result<Vec<Candle>> {
    let mut stmt = conn.prepare_cached(
        "SELECT timestamp, open, high, low, close, volume
         FROM candles
         WHERE symbol = ?1 AND timeframe = ?2
         ORDER BY timestamp DESC
         LIMIT ?3",
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

    result.reverse();
    Ok(result)
}
