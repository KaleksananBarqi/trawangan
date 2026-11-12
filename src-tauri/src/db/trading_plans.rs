// Sub-modul arsip Trade Plan Vault (trading_plans) dengan batas kapasitas 200 baris
use rusqlite::{params, Connection, Result};
use serde_json::{Map, Value};

pub const MAX_TRADING_PLANS: usize = 200;

/// Pastikan tabel trading_plans dan indeks waktu pembaruan tersedia
pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS trading_plans (
            id TEXT PRIMARY KEY,
            symbol TEXT NOT NULL,
            provider_id TEXT,
            timeframe TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            raw_text TEXT,
            plan_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_trading_plans_updated ON trading_plans (updated_at DESC);",
    )
}

/// Sisipkan satu rekaman `SavedTradingPlanRecord` dari JSON `Value`
pub fn upsert_plan_value(conn: &Connection, item: &Value) -> Result<bool> {
    let Some(id) = item.get("id").and_then(|v| v.as_str()).map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(false);
    };
    let symbol = item.get("symbol").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let provider_id: Option<String> = item.get("providerId").and_then(|v| v.as_str()).map(|s| s.to_string());
    let timeframe: Option<String> = item.get("timeframe").and_then(|v| v.as_str()).map(|s| s.to_string());
    let created_at = item.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(0);
    let updated_at = item.get("updatedAt").and_then(|v| v.as_i64()).unwrap_or(created_at);
    let raw_text: Option<String> = item.get("rawText").and_then(|v| v.as_str()).map(|s| s.to_string());
    let plan_val = item.get("plan").cloned().unwrap_or(Value::Null);
    let plan_json = serde_json::to_string(&plan_val).unwrap_or_else(|_| "null".to_string());

    conn.execute(
        "INSERT OR REPLACE INTO trading_plans (
            id, symbol, provider_id, timeframe, created_at, updated_at, raw_text, plan_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            symbol,
            provider_id,
            timeframe,
            created_at,
            updated_at,
            raw_text,
            plan_json
        ],
    )?;
    Ok(true)
}

/// Pangkas tabel trading_plans agar tidak melebihi batas maksimal 200 entri terbaru
pub fn prune_to_limit(conn: &Connection, max_rows: usize) -> Result<()> {
    conn.execute(
        "DELETE FROM trading_plans
         WHERE id NOT IN (
             SELECT id FROM trading_plans
             ORDER BY updated_at DESC, rowid DESC
             LIMIT ?1
         )",
        params![max_rows as i64],
    )?;
    Ok(())
}

/// Ganti seluruh baris `trading_plans` dari string JSON array (shim sementara hingga Tiket #177)
pub fn replace_plans_from_json(conn: &Connection, json: &str) -> Result<()> {
    let Ok(items) = serde_json::from_str::<Vec<Value>>(json) else {
        return Ok(());
    };
    super::with_transaction(conn, "BEGIN IMMEDIATE;", || {
        conn.execute("DELETE FROM trading_plans", [])?;
        for item in &items {
            let _ = upsert_plan_value(conn, item)?;
        }
        prune_to_limit(conn, MAX_TRADING_PLANS)
    })
}

/// Ekspor seluruh baris `trading_plans` menjadi JSON array (shim sementara hingga Tiket #177)
pub fn export_plans_as_json(conn: &Connection) -> Result<Option<String>> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, symbol, provider_id, timeframe, created_at, updated_at, raw_text, plan_json
         FROM trading_plans
         ORDER BY updated_at DESC, rowid DESC",
    )?;
    let mut rows = stmt.query([])?;
    let mut list: Vec<Value> = Vec::new();
    while let Some(row) = rows.next()? {
        let mut obj = Map::new();
        obj.insert("id".to_string(), Value::String(row.get(0)?));
        obj.insert("symbol".to_string(), Value::String(row.get(1)?));
        if let Some(pid) = row.get::<_, Option<String>>(2)? {
            obj.insert("providerId".to_string(), Value::String(pid));
        }
        if let Some(tf) = row.get::<_, Option<String>>(3)? {
            obj.insert("timeframe".to_string(), Value::String(tf));
        }
        obj.insert("createdAt".to_string(), serde_json::json!(row.get::<_, i64>(4)?));
        obj.insert("updatedAt".to_string(), serde_json::json!(row.get::<_, i64>(5)?));
        if let Some(raw_text) = row.get::<_, Option<String>>(6)? {
            obj.insert("rawText".to_string(), Value::String(raw_text));
        }
        let plan_raw: String = row.get(7)?;
        let plan_val: Value = serde_json::from_str(&plan_raw).unwrap_or(Value::Null);
        obj.insert("plan".to_string(), plan_val);
        list.push(Value::Object(obj));
    }
    if list.is_empty() {
        Ok(None)
    } else {
        Ok(Some(serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string())))
    }
}
