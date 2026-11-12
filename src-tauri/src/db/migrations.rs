// Sub-modul migrasi skema SQLite berversi menggunakan PRAGMA user_version
use rusqlite::{params, Connection, Result};
use serde_json::Value;

pub const CURRENT_SCHEMA_VERSION: i64 = 1;

fn table_exists(conn: &Connection, table_name: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        params![table_name],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

fn table_has_column(conn: &Connection, table_name: &str, column_name: &str) -> Result<bool> {
    let sql = format!("PRAGMA table_info({})", table_name);
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column_name {
            return Ok(true);
        }
    }
    Ok(false)
}

fn migrate_drawings_v0_to_v1(conn: &Connection) -> Result<()> {
    let has_table = table_exists(conn, "drawings")?;
    if !has_table {
        return super::drawings::create_table(conn);
    }

    if table_has_column(conn, "drawings", "workspace_id")? {
        return super::drawings::create_table(conn);
    }

    conn.execute_batch("ALTER TABLE drawings RENAME TO drawings_legacy;")?;
    super::drawings::create_table(conn)?;

    let rows_to_migrate: Vec<(String, String, String, i64)> = {
        let mut stmt = conn.prepare(
            "SELECT symbol, timeframe, data_json, updated_at FROM drawings_legacy ORDER BY updated_at ASC",
        )?;
        let iter = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;
        iter.collect::<Result<Vec<_>>>()?
    };

    {
        let mut insert_stmt = conn.prepare(
            "INSERT OR REPLACE INTO drawings (workspace_id, provider_id, symbol, timeframe, data_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )?;

        for (raw_symbol, timeframe, data_json, updated_at) in rows_to_migrate {
            let (workspace_id, provider_id, clean_symbol) =
                super::drawings::split_composite_key(&raw_symbol);
            insert_stmt.execute(params![
                workspace_id,
                provider_id,
                clean_symbol,
                timeframe,
                data_json,
                updated_at
            ])?;
        }
    }

    conn.execute_batch("DROP TABLE drawings_legacy;")?;
    Ok(())
}

fn migrate_workspaces_and_slots_v0_to_v1(conn: &Connection) -> Result<()> {
    let has_table = table_exists(conn, "workspaces")?;
    if !has_table {
        return super::workspaces::create_table(conn);
    }

    if table_has_column(conn, "workspaces", "schema_version")? {
        return super::workspaces::create_table(conn);
    }

    let legacy_rows: Vec<(String, String, String, i64)> = {
        let mut stmt = conn.prepare(
            "SELECT id, name, layout_json, updated_at FROM workspaces",
        )?;
        let iter = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;
        iter.collect::<Result<Vec<_>>>()?
    };

    conn.execute_batch("ALTER TABLE workspaces RENAME TO workspaces_legacy;")?;
    super::workspaces::create_table(conn)?;

    for (id, name, layout_json, updated_at) in legacy_rows {
        match id.as_str() {
            "user_workspaces_list" => {
                if let Ok(Value::Array(arr)) = serde_json::from_str::<Value>(&layout_json) {
                    for item in arr {
                        if item.is_object() {
                            let _ = super::workspaces::upsert_workspace_value(conn, &item, updated_at);
                        }
                    }
                }
            }
            "user_price_alerts" => {
                if let Ok(Value::Array(arr)) = serde_json::from_str::<Value>(&layout_json) {
                    let _ = super::alerts::insert_alerts_from_values(conn, &arr);
                }
            }
            "user_trade_plan_vault" => {
                if let Ok(Value::Array(arr)) = serde_json::from_str::<Value>(&layout_json) {
                    for item in arr {
                        if item.is_object() {
                            let _ = super::trading_plans::upsert_plan_value(conn, &item);
                        }
                    }
                    let _ = super::trading_plans::prune_to_limit(
                        conn,
                        super::trading_plans::MAX_TRADING_PLANS,
                    );
                }
            }
            "user_multi_watchlists" => {
                if let Ok(val) = serde_json::from_str::<Value>(&layout_json) {
                    if val.is_object() {
                        let _ = super::watchlists::save_registry_from_value(conn, &val);
                    }
                }
            }
            "trawangan_chart_default_config" => {
                if !layout_json.trim().is_empty() && serde_json::from_str::<Value>(&layout_json).is_ok() {
                    super::preferences::set_app_preference_with_timestamp(
                        conn,
                        "chart_default_config",
                        &layout_json,
                        updated_at,
                    )?;
                }
            }
            "trawangan_app_settings" => {
                if !layout_json.trim().is_empty() && serde_json::from_str::<Value>(&layout_json).is_ok() {
                    super::preferences::set_app_preference_with_timestamp(
                        conn,
                        "app_settings",
                        &layout_json,
                        updated_at,
                    )?;
                }
            }
            _ => {
                // Pertahankan baris workspace v0 non-slot bila pernah tersimpan langsung
                super::workspaces::save_workspace_row_raw(conn, &id, &name, &layout_json)?;
            }
        }
    }

    conn.execute_batch("DROP TABLE workspaces_legacy;")?;
    Ok(())
}

fn migrate_legacy_watchlist_v0_to_v1(conn: &Connection) -> Result<()> {
    if !table_exists(conn, "watchlist")? {
        return Ok(());
    }

    let watchlists_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM watchlists", [], |row| row.get(0))?;

    if watchlists_count == 0 {
        let legacy_items: Vec<(String, i64)> = {
            let mut stmt = conn.prepare(
                "SELECT symbol, created_at FROM watchlist ORDER BY sort_order ASC, created_at ASC",
            )?;
            let iter = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))?;
            iter.collect::<Result<Vec<_>>>()?
        };

        if !legacy_items.is_empty() {
            let now = chrono::Utc::now().timestamp_millis();
            let created_at = legacy_items.first().map(|(_, ts)| *ts).unwrap_or(now);
            conn.execute(
                "INSERT INTO watchlists (id, name, is_preset, is_active, sort_order, created_at, updated_at)
                 VALUES ('default', 'Daftar Utama', 0, 1, 0, ?1, ?2)",
                params![created_at, now],
            )?;

            let mut item_stmt = conn.prepare(
                "INSERT INTO watchlist_items (watchlist_id, sort_order, entry) VALUES ('default', ?1, ?2)",
            )?;
            for (idx, (sym, _)) in legacy_items.into_iter().enumerate() {
                item_stmt.execute(params![idx as i64, sym])?;
            }
        }
    }

    conn.execute_batch("DROP TABLE IF EXISTS watchlist;")?;
    Ok(())
}

/// Memastikan seluruh skema v1 tersedia dan memigrasikan basis data lama secara atomik
pub fn migrate(conn: &Connection) -> Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if version >= CURRENT_SCHEMA_VERSION {
        return Ok(());
    }

    super::with_transaction(conn, "BEGIN IMMEDIATE;", || {
        super::candles::create_table(conn)?;
        super::providers::create_table(conn)?;
        super::scripts::create_table(conn)?;
        super::alerts::create_table(conn)?;
        super::trading_plans::create_table(conn)?;
        super::watchlists::create_tables(conn)?;
        super::preferences::create_table(conn)?;

        migrate_drawings_v0_to_v1(conn)?;
        migrate_workspaces_and_slots_v0_to_v1(conn)?;
        migrate_legacy_watchlist_v0_to_v1(conn)?;

        conn.execute_batch("PRAGMA user_version = 1;")?;
        Ok(())
    })
}
