// Sub-modul penyimpanan PriceAlert dan Plan-Linked Auto-Alerts
use rusqlite::{params, Connection, Result};
use serde_json::{Map, Value};

/// Pastikan tabel price_alerts tersedia
pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS price_alerts (
            id TEXT PRIMARY KEY,
            symbol TEXT NOT NULL,
            target_price REAL NOT NULL,
            condition TEXT NOT NULL,
            frequency TEXT NOT NULL,
            label TEXT NOT NULL,
            active INTEGER NOT NULL,
            triggered INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            triggered_at INTEGER,
            triggered_price REAL,
            plan_id TEXT,
            plan_role TEXT,
            sort_order INTEGER NOT NULL
        );",
    )
}

/// Ganti seluruh baris `price_alerts` dari slice JSON `Value` dalam satu pemanggilan berurutan
pub fn insert_alerts_from_values(conn: &Connection, items: &[Value]) -> Result<()> {
    conn.execute("DELETE FROM price_alerts", [])?;
    let mut stmt = conn.prepare_cached(
        "INSERT OR REPLACE INTO price_alerts (
            id, symbol, target_price, condition, frequency, label,
            active, triggered, created_at, triggered_at, triggered_price,
            plan_id, plan_role, sort_order
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
    )?;

    for (idx, item) in items.iter().enumerate() {
        let Some(id) = item.get("id").and_then(|v| v.as_str()).map(str::trim).filter(|s| !s.is_empty()) else {
            continue;
        };
        let symbol = item.get("symbol").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let target_price = item.get("targetPrice").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let condition = item.get("condition").and_then(|v| v.as_str()).unwrap_or("above").to_string();
        let frequency = item.get("frequency").and_then(|v| v.as_str()).unwrap_or("once").to_string();
        let label = item.get("label").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let active = if item.get("active").and_then(|v| v.as_bool()).unwrap_or(true) { 1 } else { 0 };
        let triggered = if item.get("triggered").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };
        let created_at = item.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(0);
        let triggered_at: Option<i64> = item.get("triggeredAt").and_then(|v| v.as_i64());
        let triggered_price: Option<f64> = item.get("triggeredPrice").and_then(|v| v.as_f64());
        let plan_id: Option<String> = item.get("planId").and_then(|v| v.as_str()).map(|s| s.to_string());
        let plan_role: Option<String> = item.get("planRole").and_then(|v| v.as_str()).map(|s| s.to_string());

        stmt.execute(params![
            id,
            symbol,
            target_price,
            condition,
            frequency,
            label,
            active,
            triggered,
            created_at,
            triggered_at,
            triggered_price,
            plan_id,
            plan_role,
            idx as i64
        ])?;
    }
    Ok(())
}

/// Ganti seluruh baris `price_alerts` secara transaksional (fail-loud pada JSON tidak valid)
pub fn replace_price_alerts(conn: &Connection, alerts_json: &str) -> Result<()> {
    let items: Vec<Value> = serde_json::from_str(alerts_json).map_err(|e| {
        rusqlite::Error::InvalidParameterName(format!("JSON price alerts tidak valid: {e}"))
    })?;
    super::with_transaction(conn, "BEGIN IMMEDIATE;", || {
        insert_alerts_from_values(conn, &items)
    })
}

/// Baca seluruh baris `price_alerts` berurutan sesuai `sort_order ASC`
pub fn list_price_alerts(conn: &Connection) -> Result<Vec<Value>> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, symbol, target_price, condition, frequency, label,
                active, triggered, created_at, triggered_at, triggered_price,
                plan_id, plan_role
         FROM price_alerts
         ORDER BY sort_order ASC",
    )?;
    let mut rows = stmt.query([])?;
    let mut list: Vec<Value> = Vec::new();
    while let Some(row) = rows.next()? {
        let mut obj = Map::new();
        obj.insert("id".to_string(), Value::String(row.get(0)?));
        obj.insert("symbol".to_string(), Value::String(row.get(1)?));
        obj.insert("targetPrice".to_string(), serde_json::json!(row.get::<_, f64>(2)?));
        obj.insert("condition".to_string(), Value::String(row.get(3)?));
        obj.insert("frequency".to_string(), Value::String(row.get(4)?));
        obj.insert("label".to_string(), Value::String(row.get(5)?));
        obj.insert("active".to_string(), Value::Bool(row.get::<_, i32>(6)? == 1));
        obj.insert("triggered".to_string(), Value::Bool(row.get::<_, i32>(7)? == 1));
        obj.insert("createdAt".to_string(), serde_json::json!(row.get::<_, i64>(8)?));
        if let Some(ta) = row.get::<_, Option<i64>>(9)? {
            obj.insert("triggeredAt".to_string(), serde_json::json!(ta));
        }
        if let Some(tp) = row.get::<_, Option<f64>>(10)? {
            obj.insert("triggeredPrice".to_string(), serde_json::json!(tp));
        }
        if let Some(pid) = row.get::<_, Option<String>>(11)? {
            obj.insert("planId".to_string(), Value::String(pid));
        }
        if let Some(pr) = row.get::<_, Option<String>>(12)? {
            obj.insert("planRole".to_string(), Value::String(pr));
        }
        list.push(Value::Object(obj));
    }
    Ok(list)
}
