// Modul Opt-In Execution Bridge (ADR-0031)
// Menyediakan enkripsi kredensial lokal di SQLite dan konektor eksekusi manual langsung ke:
// 1. Binance (Spot & USDⓈ-M Futures) via HMAC-SHA256 murni
// 2. Bitunix (Spot & Perpetual Futures) via SHA256 OpenAPI
// 3. Broker CFD / MetaTrader 5 via Local MT5 Socket Bridge (127.0.0.1)

use crate::db::DbState;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

static NONCE_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
struct Mt5Cache {
    expected_token: String,
    last_seen_ms: i64,
    summary: Option<BrokerAccountSummary>,
    positions: Vec<BrokerPositionItem>,
    orders: Vec<BrokerOpenOrderItem>,
    pending_commands: VecDeque<serde_json::Value>,
}

pub struct Mt5BridgeState {
    cache: Arc<Mutex<Mt5Cache>>,
    listener_started: AtomicBool,
}

impl Mt5BridgeState {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Mutex::new(Mt5Cache::default())),
            listener_started: AtomicBool::new(false),
        }
    }
}

fn ensure_mt5_loopback_listener(state: &Mt5BridgeState, token: &str) {
    if let Ok(mut guard) = state.cache.lock() {
        guard.expected_token = token.to_string();
    }
    if state
        .listener_started
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    let cache = Arc::clone(&state.cache);
    tauri::async_runtime::spawn(async move {
        let Ok(listener) = TcpListener::bind("127.0.0.1:15555").await else {
            return;
        };
        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                continue;
            };
            let cache_ref = Arc::clone(&cache);
            tokio::spawn(async move {
                let mut buf = vec![0u8; 32768];
                let Ok(n) = socket.read(&mut buf).await else {
                    return;
                };
                if n == 0 {
                    return;
                }
                let raw = String::from_utf8_lossy(&buf[..n]);
                let Some((head, body)) = raw.split_once("\r\n\r\n") else {
                    let _ = socket
                        .write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
                        .await;
                    return;
                };

                let first_line = head.lines().next().unwrap_or("");
                let mut token_header = String::new();
                for line in head.lines().skip(1) {
                    if let Some((k, v)) = line.split_once(':') {
                        if k.trim().eq_ignore_ascii_case("X-Trawangan-Token") {
                            token_header = v.trim().to_string();
                        }
                    }
                }

                let (status_line, resp_json) = if first_line.starts_with("POST /mt5-sync") {
                    let mut guard = cache_ref.lock().unwrap_or_else(|e| e.into_inner());
                    if !guard.expected_token.is_empty() && token_header != guard.expected_token {
                        (
                            "HTTP/1.1 401 Unauthorized",
                            serde_json::json!({ "error": "Invalid X-Trawangan-Token" }).to_string(),
                        )
                    } else if let Ok(val) = serde_json::from_str::<serde_json::Value>(body.trim()) {
                        guard.last_seen_ms = chrono::Utc::now().timestamp_millis();
                        guard.summary = Some(BrokerAccountSummary {
                            broker_id: "mt5".to_string(),
                            connected: true,
                            currency: val
                                .get("currency")
                                .and_then(|v| v.as_str())
                                .unwrap_or("USD")
                                .to_string(),
                            balance: val.get("balance").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            equity: val.get("equity").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            available_margin: val
                                .get("freeMargin")
                                .and_then(|v| v.as_f64())
                                .unwrap_or(0.0),
                            server_info: val
                                .get("server")
                                .and_then(|v| v.as_str())
                                .unwrap_or("MT5 Local EA Bridge")
                                .to_string(),
                        });
                        if let Some(arr) = val.get("positions").and_then(|v| v.as_array()) {
                            guard.positions = arr
                                .iter()
                                .map(|p| BrokerPositionItem {
                                    id: p
                                        .get("ticket")
                                        .map(|v| v.to_string().trim_matches('"').to_string())
                                        .unwrap_or_default(),
                                    symbol: p
                                        .get("symbol")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string(),
                                    side: p
                                        .get("side")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("LONG")
                                        .to_string(),
                                    size: p.get("volume").and_then(|v| v.as_f64()).unwrap_or(0.0),
                                    entry_price: p
                                        .get("priceOpen")
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(0.0),
                                    unrealized_pnl: p
                                        .get("profit")
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(0.0),
                                    leverage: None,
                                })
                                .collect();
                        }
                        if let Some(arr) = val.get("orders").and_then(|v| v.as_array()) {
                            guard.orders = arr
                                .iter()
                                .map(|o| BrokerOpenOrderItem {
                                    order_id: o
                                        .get("ticket")
                                        .map(|v| v.to_string().trim_matches('"').to_string())
                                        .unwrap_or_default(),
                                    symbol: o
                                        .get("symbol")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string(),
                                    side: o
                                        .get("side")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("BUY")
                                        .to_string(),
                                    order_type: o
                                        .get("type")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("LIMIT")
                                        .to_string(),
                                    price: o.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0),
                                    quantity: o
                                        .get("volume")
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(0.0),
                                })
                                .collect();
                        }
                        let next_cmd = guard
                            .pending_commands
                            .pop_front()
                            .unwrap_or_else(|| serde_json::json!({ "ok": true }));
                        ("HTTP/1.1 200 OK", next_cmd.to_string())
                    } else {
                        (
                            "HTTP/1.1 400 Bad Request",
                            serde_json::json!({ "error": "Invalid JSON payload" }).to_string(),
                        )
                    }
                } else {
                    (
                        "HTTP/1.1 200 OK",
                        serde_json::json!({ "service": "trawangan-mt5-bridge", "ok": true })
                            .to_string(),
                    )
                };

                let resp = format!(
                    "{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status_line,
                    resp_json.len(),
                    resp_json
                );
                let _ = socket.write_all(resp.as_bytes()).await;
            });
        }
    });
}

fn is_local_mt5_loopback(endpoint: &str) -> bool {
    let trimmed = endpoint.trim();
    trimmed.is_empty()
        || trimmed.starts_with("http://127.0.0.1:15555")
        || trimmed.starts_with("http://localhost:15555")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokerConfigPublic {
    pub broker_id: String,
    pub market_mode: String, // "futures" | "spot" | "cfd"
    pub api_key_masked: String,
    pub has_secret: bool,
    pub endpoint_url: String,
    pub is_verified: bool,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveBrokerCredentialsInput {
    pub broker_id: String,
    pub market_mode: String,
    pub api_key: String,
    pub api_secret: String,
    pub endpoint_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokerAccountSummary {
    pub broker_id: String,
    pub connected: bool,
    pub currency: String,
    pub balance: f64,
    pub equity: f64,
    pub available_margin: f64,
    pub server_info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokerPositionItem {
    pub id: String,
    pub symbol: String,
    pub side: String, // "LONG" | "SHORT"
    pub size: f64,
    pub entry_price: f64,
    pub unrealized_pnl: f64,
    pub leverage: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokerOpenOrderItem {
    pub order_id: String,
    pub symbol: String,
    pub side: String,       // "BUY" | "SELL"
    pub order_type: String, // "LIMIT" | "MARKET" | "STOP"
    pub price: f64,
    pub quantity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualOrderRequest {
    pub broker_id: String,
    pub symbol: String,
    pub side: String,       // "BUY" | "SELL"
    pub order_type: String, // "MARKET" | "LIMIT"
    pub quantity: f64,
    pub price: Option<f64>,
    pub stop_loss: Option<f64>,
    pub take_profit: Option<f64>,
    pub leverage: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualOrderResponse {
    pub success: bool,
    pub order_id: String,
    pub message: String,
}

struct StoredBrokerRow {
    market_mode: String,
    api_key: String,
    api_secret_plain: String,
    endpoint_url: String,
    is_verified: bool,
}

pub fn ensure_broker_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS broker_credentials (
            broker_id TEXT PRIMARY KEY,
            market_mode TEXT NOT NULL DEFAULT 'futures',
            api_key TEXT NOT NULL DEFAULT '',
            api_secret_enc TEXT NOT NULL DEFAULT '',
            endpoint_url TEXT NOT NULL DEFAULT '',
            is_verified INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        );",
    )
}

fn derive_local_vault_key() -> [u8; 32] {
    let host_hint = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "trawangan_local_host".to_string());
    let user_hint = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "trader".to_string());
    let mut hasher = Sha256::new();
    hasher.update(b"trawangan_vault_v1::");
    hasher.update(host_hint.as_bytes());
    hasher.update(b"::");
    hasher.update(user_hint.as_bytes());
    let digest = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&digest);
    key
}

fn generate_nonce_16() -> [u8; 16] {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let seq = NONCE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let mut h = Sha256::new();
    h.update(nanos.to_le_bytes());
    h.update(seq.to_le_bytes());
    h.update(std::process::id().to_le_bytes());
    let digest = h.finalize();
    let mut out = [0u8; 16];
    out.copy_from_slice(&digest[..16]);
    out
}

fn xor_sha256_stream(key: &[u8; 32], nonce: Option<&[u8]>, data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len());
    for (idx, b) in data.iter().enumerate() {
        let mut block_hasher = Sha256::new();
        block_hasher.update(key);
        if let Some(n) = nonce {
            block_hasher.update(n);
        }
        block_hasher.update((idx as u64).to_le_bytes());
        let stream_byte = block_hasher.finalize()[0];
        out.push(b ^ stream_byte);
    }
    out
}

fn seal_secret(plain: &str) -> String {
    if plain.is_empty() {
        return String::new();
    }
    let key = derive_local_vault_key();
    let nonce = generate_nonce_16();
    let out = xor_sha256_stream(&key, Some(&nonce), plain.as_bytes());
    format!("v2:{}:{}", hex::encode(nonce), BASE64.encode(out))
}

fn open_secret(encoded: &str) -> String {
    if encoded.is_empty() {
        return String::new();
    }
    let key = derive_local_vault_key();
    if let Some(rest) = encoded.strip_prefix("v2:") {
        let Some((nonce_hex, b64)) = rest.split_once(':') else {
            return String::new();
        };
        let Ok(nonce) = hex::decode(nonce_hex) else {
            return String::new();
        };
        let Ok(cipher) = BASE64.decode(b64) else {
            return String::new();
        };
        let out = xor_sha256_stream(&key, Some(&nonce), &cipher);
        return String::from_utf8(out).unwrap_or_default();
    }

    // Kompatibilitas mundur format v1 (tanpa nonce)
    let Ok(cipher) = BASE64.decode(encoded) else {
        return String::new();
    };
    let out = xor_sha256_stream(&key, None, &cipher);
    String::from_utf8(out).unwrap_or_default()
}

fn mask_key(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.len() <= 8 {
        if trimmed.is_empty() {
            return String::new();
        }
        return "••••••••".to_string();
    }
    format!("{}••••{}", &trimmed[..4], &trimmed[trimmed.len() - 4..])
}

/// Implementasi murni RFC 2104 HMAC-SHA256 menggunakan crate `sha2` tanpa dependensi eksternal tambahan
pub fn hmac_sha256_hex(secret: &str, message: &str) -> String {
    const BLOCK_SIZE: usize = 64;
    let mut key_block = [0u8; BLOCK_SIZE];
    let secret_bytes = secret.as_bytes();
    if secret_bytes.len() > BLOCK_SIZE {
        let mut hasher = Sha256::new();
        hasher.update(secret_bytes);
        let digest = hasher.finalize();
        key_block[..32].copy_from_slice(&digest);
    } else {
        key_block[..secret_bytes.len()].copy_from_slice(secret_bytes);
    }

    let mut ipad = [0x36u8; BLOCK_SIZE];
    let mut opad = [0x5cu8; BLOCK_SIZE];
    for i in 0..BLOCK_SIZE {
        ipad[i] ^= key_block[i];
        opad[i] ^= key_block[i];
    }

    let mut inner = Sha256::new();
    inner.update(ipad);
    inner.update(message.as_bytes());
    let inner_digest = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(opad);
    outer.update(inner_digest);
    hex::encode(outer.finalize())
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// Tanda tangan Bitunix OpenAPI: SHA256(SHA256(nonce + timestamp + apiKey + queryParams + body) + secretKey)
fn bitunix_sign(
    nonce: &str,
    timestamp: &str,
    api_key: &str,
    query_concat: &str,
    body_str: &str,
    secret_key: &str,
) -> String {
    let digest_first = sha256_hex(&format!(
        "{}{}{}{}{}",
        nonce, timestamp, api_key, query_concat, body_str
    ));
    sha256_hex(&format!("{}{}", digest_first, secret_key))
}

fn load_stored_broker(conn: &Connection, broker_id: &str) -> Result<StoredBrokerRow, String> {
    ensure_broker_table(conn).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT market_mode, api_key, api_secret_enc, endpoint_url, is_verified FROM broker_credentials WHERE broker_id = ?1",
        params![broker_id],
        |row| {
            let enc: String = row.get(2)?;
            let verified_int: i64 = row.get(4)?;
            Ok(StoredBrokerRow {
                market_mode: row.get(0)?,
                api_key: row.get(1)?,
                api_secret_plain: open_secret(&enc),
                endpoint_url: row.get(3)?,
                is_verified: verified_int != 0,
            })
        },
    )
    .map_err(|_| format!("Kredensial untuk broker '{}' belum dikonfigurasi.", broker_id))
}

fn clean_exchange_symbol(raw: &str) -> String {
    raw.split(':')
        .next_back()
        .unwrap_or(raw)
        .trim()
        .trim_end_matches(".P")
        .trim_end_matches("-PERP")
        .replace(['/', '-'], "")
        .to_uppercase()
}

#[tauri::command]
pub fn list_broker_configs(db: State<'_, DbState>) -> Result<Vec<BrokerConfigPublic>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    ensure_broker_table(&conn).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT broker_id, market_mode, api_key, api_secret_enc, endpoint_url, is_verified, updated_at
             FROM broker_credentials ORDER BY broker_id ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let key: String = row.get(2)?;
            let enc: String = row.get(3)?;
            let verified_int: i64 = row.get(5)?;
            Ok(BrokerConfigPublic {
                broker_id: row.get(0)?,
                market_mode: row.get(1)?,
                api_key_masked: mask_key(&key),
                has_secret: !enc.is_empty(),
                endpoint_url: row.get(4)?,
                is_verified: verified_int != 0,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for item in rows {
        out.push(item.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn save_broker_credentials(
    db: State<'_, DbState>,
    mt5_state: State<'_, Mt5BridgeState>,
    input: SaveBrokerCredentialsInput,
) -> Result<BrokerConfigPublic, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    ensure_broker_table(&conn).map_err(|e| e.to_string())?;

    let existing_secret_enc: Option<String> = conn
        .query_row(
            "SELECT api_secret_enc FROM broker_credentials WHERE broker_id = ?1",
            params![input.broker_id],
            |r| r.get(0),
        )
        .ok();

    let existing_key: Option<String> = conn
        .query_row(
            "SELECT api_key FROM broker_credentials WHERE broker_id = ?1",
            params![input.broker_id],
            |r| r.get(0),
        )
        .ok();

    let final_key = if input.api_key.trim().is_empty() {
        existing_key.unwrap_or_default()
    } else {
        input.api_key.trim().to_string()
    };

    let final_enc = if input.api_secret.trim().is_empty() {
        existing_secret_enc.clone().unwrap_or_default()
    } else {
        seal_secret(input.api_secret.trim())
    };

    let default_endpoint = match input.broker_id.as_str() {
        "mt5" => "http://127.0.0.1:15555",
        "bitunix" => "https://fapi.bitunix.com",
        _ => "https://fapi.binance.com",
    };
    let endpoint = input
        .endpoint_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(default_endpoint)
        .to_string();

    let now = chrono::Utc::now().timestamp_millis();
    if input.broker_id == "mt5" && is_local_mt5_loopback(&endpoint) {
        let plain_token = if input.api_secret.trim().is_empty() {
            existing_secret_enc
                .as_deref()
                .map(open_secret)
                .unwrap_or_default()
        } else {
            input.api_secret.trim().to_string()
        };
        ensure_mt5_loopback_listener(mt5_state.inner(), &plain_token);
    }
    conn.execute(
        "INSERT OR REPLACE INTO broker_credentials
         (broker_id, market_mode, api_key, api_secret_enc, endpoint_url, is_verified, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
        params![
            input.broker_id,
            input.market_mode,
            final_key,
            final_enc,
            endpoint,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(BrokerConfigPublic {
        broker_id: input.broker_id,
        market_mode: input.market_mode,
        api_key_masked: mask_key(&final_key),
        has_secret: !final_enc.is_empty(),
        endpoint_url: endpoint,
        is_verified: false,
        updated_at: now,
    })
}

#[tauri::command]
pub fn delete_broker_credentials(db: State<'_, DbState>, broker_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    ensure_broker_table(&conn).map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM broker_credentials WHERE broker_id = ?1",
        params![broker_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

async fn fetch_account_summary_internal(
    broker_id: &str,
    cfg: &StoredBrokerRow,
) -> Result<BrokerAccountSummary, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    match broker_id {
        "binance" => {
            if cfg.api_key.is_empty() || cfg.api_secret_plain.is_empty() {
                return Err("API Key dan Secret Binance wajib diisi.".to_string());
            }
            let ts = chrono::Utc::now().timestamp_millis();
            let query = format!("timestamp={}&recvWindow=5000", ts);
            let sig = hmac_sha256_hex(&cfg.api_secret_plain, &query);
            let is_spot = cfg.market_mode == "spot";
            let base = if is_spot {
                "https://api.binance.com"
            } else {
                "https://fapi.binance.com"
            };
            let path = if is_spot {
                "/api/v3/account"
            } else {
                "/fapi/v2/account"
            };
            let url = format!("{}{}?{}&signature={}", base, path, query, sig);
            let resp = client
                .get(&url)
                .header("X-MBX-APIKEY", &cfg.api_key)
                .send()
                .await
                .map_err(|e| format!("Gagal menghubungi Binance: {}", e))?;

            let status = resp.status();
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                let msg = json
                    .get("msg")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Koneksi Binance ditolak");
                return Err(format!("Binance API Error: {}", msg));
            }

            if is_spot {
                let mut usdt_free = 0.0;
                let mut usdt_locked = 0.0;
                if let Some(arr) = json.get("balances").and_then(|v| v.as_array()) {
                    for b in arr {
                        if b.get("asset").and_then(|a| a.as_str()) == Some("USDT") {
                            usdt_free = b
                                .get("free")
                                .and_then(|v| v.as_str())
                                .and_then(|s| s.parse::<f64>().ok())
                                .unwrap_or(0.0);
                            usdt_locked = b
                                .get("locked")
                                .and_then(|v| v.as_str())
                                .and_then(|s| s.parse::<f64>().ok())
                                .unwrap_or(0.0);
                        }
                    }
                }
                Ok(BrokerAccountSummary {
                    broker_id: "binance".to_string(),
                    connected: true,
                    currency: "USDT".to_string(),
                    balance: usdt_free + usdt_locked,
                    equity: usdt_free + usdt_locked,
                    available_margin: usdt_free,
                    server_info: "Binance Spot REST".to_string(),
                })
            } else {
                let wallet: f64 = json
                    .get("totalWalletBalance")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0.0);
                let margin_bal: f64 = json
                    .get("totalMarginBalance")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(wallet);
                let avail: f64 = json
                    .get("availableBalance")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(wallet);
                Ok(BrokerAccountSummary {
                    broker_id: "binance".to_string(),
                    connected: true,
                    currency: "USDT".to_string(),
                    balance: wallet,
                    equity: margin_bal,
                    available_margin: avail,
                    server_info: "Binance USDⓈ-M Futures".to_string(),
                })
            }
        }
        "bitunix" => {
            if cfg.api_key.is_empty() || cfg.api_secret_plain.is_empty() {
                return Err("API Key dan Secret Bitunix wajib diisi.".to_string());
            }
            let ts = chrono::Utc::now().timestamp_millis().to_string();
            let nonce = format!("trw{}", ts);
            let query_concat = "marginCoinUSDT";
            let sign = bitunix_sign(&nonce, &ts, &cfg.api_key, query_concat, "", &cfg.api_secret_plain);
            let base = if cfg.endpoint_url.is_empty() {
                "https://fapi.bitunix.com"
            } else {
                cfg.endpoint_url.trim_end_matches('/')
            };
            let url = format!("{}/api/v1/futures/account?marginCoin=USDT", base);
            let resp = client
                .get(&url)
                .header("api-key", &cfg.api_key)
                .header("nonce", &nonce)
                .header("timestamp", &ts)
                .header("sign", &sign)
                .header("Content-Type", "application/json")
                .send()
                .await
                .map_err(|e| format!("Gagal menghubungi Bitunix: {}", e))?;

            let status = resp.status();
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let code = json.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
            if !status.is_success() || code != 0 {
                let msg = json
                    .get("msg")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Otentikasi Bitunix gagal");
                return Err(format!("Bitunix API Error: {}", msg));
            }
            let data = json.get("data").cloned().unwrap_or(serde_json::Value::Null);
            let avail = data
                .get("available")
                .and_then(|v| v.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| v.as_f64()))
                .unwrap_or(0.0);
            let margin = data
                .get("margin")
                .and_then(|v| v.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| v.as_f64()))
                .unwrap_or(0.0);
            let pnl = data
                .get("crossUnrealizedPNL")
                .and_then(|v| v.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| v.as_f64()))
                .unwrap_or(0.0);

            Ok(BrokerAccountSummary {
                broker_id: "bitunix".to_string(),
                connected: true,
                currency: "USDT".to_string(),
                balance: avail + margin,
                equity: avail + margin + pnl,
                available_margin: avail,
                server_info: "Bitunix Perpetual OpenAPI".to_string(),
            })
        }
        "mt5" => {
            let base = cfg.endpoint_url.trim().trim_end_matches('/');
            let url = format!("{}/account", base);
            let resp = client
                .get(&url)
                .header("X-Trawangan-Token", &cfg.api_secret_plain)
                .send()
                .await
                .map_err(|e| {
                    format!(
                        "Tidak dapat terhubung ke Local MT5 Bridge di {} ({}). Pastikan terminal MetaTrader 5 dan EA TrawanganMT5Bridge sedang aktif.",
                        base, e
                    )
                })?;

            let status = resp.status();
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                let msg = json
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Token MT5 lokal tidak cocok");
                return Err(format!("MT5 Bridge Error: {}", msg));
            }
            Ok(BrokerAccountSummary {
                broker_id: "mt5".to_string(),
                connected: true,
                currency: json
                    .get("currency")
                    .and_then(|v| v.as_str())
                    .unwrap_or("USD")
                    .to_string(),
                balance: json.get("balance").and_then(|v| v.as_f64()).unwrap_or(0.0),
                equity: json.get("equity").and_then(|v| v.as_f64()).unwrap_or(0.0),
                available_margin: json
                    .get("freeMargin")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0),
                server_info: json
                    .get("server")
                    .and_then(|v| v.as_str())
                    .unwrap_or("MT5 Local EA Bridge")
                    .to_string(),
            })
        }
        _ => Err(format!("Broker '{}' tidak dikenal.", broker_id)),
    }
}

#[tauri::command]
pub async fn verify_broker_connection(
    db: State<'_, DbState>,
    mt5_state: State<'_, Mt5BridgeState>,
    broker_id: String,
) -> Result<BrokerAccountSummary, String> {
    let cfg = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        load_stored_broker(&conn, &broker_id)?
    };

    let summary = if broker_id == "mt5" && is_local_mt5_loopback(&cfg.endpoint_url) {
        ensure_mt5_loopback_listener(mt5_state.inner(), &cfg.api_secret_plain);
        let guard = mt5_state.cache.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp_millis();
        match &guard.summary {
            Some(s) if now - guard.last_seen_ms <= 20_000 => s.clone(),
            _ => {
                return Err(
                    "Listener MT5 aktif di 127.0.0.1:15555, tetapi EA TrawanganMT5Bridge.mq5 belum mengirim heartbeat. Pastikan EA sudah dipasang di chart MT5 & Algo Trading berwarna hijau."
                        .to_string(),
                )
            }
        }
    } else {
        fetch_account_summary_internal(&broker_id, &cfg).await?
    };

    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE broker_credentials SET is_verified = 1, updated_at = ?1 WHERE broker_id = ?2",
            params![now, broker_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(summary)
}

#[tauri::command]
pub async fn get_broker_account_state(
    db: State<'_, DbState>,
    mt5_state: State<'_, Mt5BridgeState>,
    broker_id: String,
) -> Result<(BrokerAccountSummary, Vec<BrokerPositionItem>, Vec<BrokerOpenOrderItem>), String> {
    let cfg = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        load_stored_broker(&conn, &broker_id)?
    };
    if !cfg.is_verified {
        return Err("Broker belum terverifikasi. Jalankan 'Tes Koneksi & Verifikasi' di Pengaturan terlebih dahulu.".to_string());
    }

    if broker_id == "mt5" && is_local_mt5_loopback(&cfg.endpoint_url) {
        ensure_mt5_loopback_listener(mt5_state.inner(), &cfg.api_secret_plain);
        let guard = mt5_state.cache.lock().map_err(|e| e.to_string())?;
        let summary = guard.summary.clone().ok_or_else(|| {
            "Belum ada heartbeat dari EA TrawanganMT5Bridge.mq5 di 127.0.0.1:15555.".to_string()
        })?;
        return Ok((summary, guard.positions.clone(), guard.orders.clone()));
    }

    let summary = fetch_account_summary_internal(&broker_id, &cfg).await?;
    let mut positions = Vec::new();
    let mut open_orders = Vec::new();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    if broker_id == "binance" && cfg.market_mode != "spot" {
        let ts = chrono::Utc::now().timestamp_millis();
        let q = format!("timestamp={}&recvWindow=5000", ts);
        let sig = hmac_sha256_hex(&cfg.api_secret_plain, &q);
        if let Ok(resp) = client
            .get(format!("https://fapi.binance.com/fapi/v2/positionRisk?{}&signature={}", q, sig))
            .header("X-MBX-APIKEY", &cfg.api_key)
            .send()
            .await
        {
            if let Ok(serde_json::Value::Array(arr)) = resp.json::<serde_json::Value>().await {
                for item in arr {
                    let amt: f64 = item
                        .get("positionAmt")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0.0);
                    if amt.abs() > 0.0 {
                        let sym = item
                            .get("symbol")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let entry: f64 = item
                            .get("entryPrice")
                            .and_then(|v| v.as_str())
                            .and_then(|s| s.parse().ok())
                            .unwrap_or(0.0);
                        let pnl: f64 = item
                            .get("unRealizedProfit")
                            .and_then(|v| v.as_str())
                            .and_then(|s| s.parse().ok())
                            .unwrap_or(0.0);
                        let lev: Option<u32> = item
                            .get("leverage")
                            .and_then(|v| v.as_str())
                            .and_then(|s| s.parse().ok());
                        positions.push(BrokerPositionItem {
                            id: format!("{}:{}", sym, if amt > 0.0 { "LONG" } else { "SHORT" }),
                            symbol: sym,
                            side: if amt > 0.0 { "LONG".to_string() } else { "SHORT".to_string() },
                            size: amt.abs(),
                            entry_price: entry,
                            unrealized_pnl: pnl,
                            leverage: lev,
                        });
                    }
                }
            }
        }

        let ts2 = chrono::Utc::now().timestamp_millis();
        let q2 = format!("timestamp={}&recvWindow=5000", ts2);
        let sig2 = hmac_sha256_hex(&cfg.api_secret_plain, &q2);
        if let Ok(resp) = client
            .get(format!("https://fapi.binance.com/fapi/v1/openOrders?{}&signature={}", q2, sig2))
            .header("X-MBX-APIKEY", &cfg.api_key)
            .send()
            .await
        {
            if let Ok(serde_json::Value::Array(arr)) = resp.json::<serde_json::Value>().await {
                for o in arr {
                    open_orders.push(BrokerOpenOrderItem {
                        order_id: o
                            .get("orderId")
                            .map(|v| v.to_string().trim_matches('"').to_string())
                            .unwrap_or_default(),
                        symbol: o.get("symbol").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        side: o.get("side").and_then(|v| v.as_str()).unwrap_or("BUY").to_string(),
                        order_type: o.get("type").and_then(|v| v.as_str()).unwrap_or("LIMIT").to_string(),
                        price: o
                            .get("price")
                            .and_then(|v| v.as_str())
                            .and_then(|s| s.parse().ok())
                            .unwrap_or(0.0),
                        quantity: o
                            .get("origQty")
                            .and_then(|v| v.as_str())
                            .and_then(|s| s.parse().ok())
                            .unwrap_or(0.0),
                    });
                }
            }
        }
    } else if broker_id == "mt5" {
        let base = if cfg.endpoint_url.trim().is_empty() {
            "http://127.0.0.1:15555"
        } else {
            cfg.endpoint_url.trim().trim_end_matches('/')
        };
        if let Ok(resp) = client
            .get(format!("{}/positions", base))
            .header("X-Trawangan-Token", &cfg.api_secret_plain)
            .send()
            .await
        {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(arr) = json.get("positions").and_then(|v| v.as_array()) {
                    for p in arr {
                        positions.push(BrokerPositionItem {
                            id: p
                                .get("ticket")
                                .map(|v| v.to_string().trim_matches('"').to_string())
                                .unwrap_or_default(),
                            symbol: p.get("symbol").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            side: p.get("side").and_then(|v| v.as_str()).unwrap_or("LONG").to_string(),
                            size: p.get("volume").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            entry_price: p.get("priceOpen").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            unrealized_pnl: p.get("profit").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            leverage: None,
                        });
                    }
                }
                if let Some(arr) = json.get("orders").and_then(|v| v.as_array()) {
                    for o in arr {
                        open_orders.push(BrokerOpenOrderItem {
                            order_id: o
                                .get("ticket")
                                .map(|v| v.to_string().trim_matches('"').to_string())
                                .unwrap_or_default(),
                            symbol: o.get("symbol").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            side: o.get("side").and_then(|v| v.as_str()).unwrap_or("BUY").to_string(),
                            order_type: o.get("type").and_then(|v| v.as_str()).unwrap_or("LIMIT").to_string(),
                            price: o.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            quantity: o.get("volume").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        });
                    }
                }
            }
        }
    }

    Ok((summary, positions, open_orders))
}

#[tauri::command]
pub async fn place_manual_broker_order(
    db: State<'_, DbState>,
    mt5_state: State<'_, Mt5BridgeState>,
    req: ManualOrderRequest,
) -> Result<ManualOrderResponse, String> {
    if req.quantity <= 0.0 {
        return Err("Quantity / Lot wajib lebih besar dari 0.".to_string());
    }
    let cfg = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        load_stored_broker(&conn, &req.broker_id)?
    };
    if !cfg.is_verified {
        return Err("Broker belum terverifikasi. Lakukan verifikasi di Pengaturan terlebih dahulu.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let side = req.side.trim().to_uppercase();
    let order_type = req.order_type.trim().to_uppercase();

    match req.broker_id.as_str() {
        "binance" => {
            let sym = clean_exchange_symbol(&req.symbol);
            let is_spot = cfg.market_mode == "spot";
            let base = if is_spot {
                "https://api.binance.com"
            } else {
                "https://fapi.binance.com"
            };

            if !is_spot {
                if let Some(lev) = req.leverage {
                    if lev >= 1 && lev <= 125 {
                        let ts_lev = chrono::Utc::now().timestamp_millis();
                        let q_lev = format!("symbol={}&leverage={}&timestamp={}", sym, lev, ts_lev);
                        let sig_lev = hmac_sha256_hex(&cfg.api_secret_plain, &q_lev);
                        let _ = client
                            .post(format!("https://fapi.binance.com/fapi/v1/leverage?{}&signature={}", q_lev, sig_lev))
                            .header("X-MBX-APIKEY", &cfg.api_key)
                            .send()
                            .await;
                    }
                }
            }

            let ts = chrono::Utc::now().timestamp_millis();
            let mut params_vec = vec![
                format!("symbol={}", sym),
                format!("side={}", side),
                format!("type={}", order_type),
                format!("quantity={}", req.quantity),
            ];
            if order_type == "LIMIT" {
                let p = req.price.ok_or_else(|| "Harga Limit wajib diisi.".to_string())?;
                params_vec.push("timeInForce=GTC".to_string());
                params_vec.push(format!("price={}", p));
            }
            params_vec.push(format!("timestamp={}", ts));
            params_vec.push("recvWindow=5000".to_string());

            let query = params_vec.join("&");
            let sig = hmac_sha256_hex(&cfg.api_secret_plain, &query);
            let path = if is_spot { "/api/v3/order" } else { "/fapi/v1/order" };
            let url = format!("{}{}?{}&signature={}", base, path, query, sig);

            let resp = client
                .post(&url)
                .header("X-MBX-APIKEY", &cfg.api_key)
                .send()
                .await
                .map_err(|e| format!("Gagal mengirim order ke Binance: {}", e))?;

            let status = resp.status();
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                let msg = json.get("msg").and_then(|v| v.as_str()).unwrap_or("Order ditolak Binance");
                return Err(format!("Binance Order Error: {}", msg));
            }
            let order_id = json
                .get("orderId")
                .map(|v| v.to_string().trim_matches('"').to_string())
                .unwrap_or_else(|| "OK".to_string());

            Ok(ManualOrderResponse {
                success: true,
                order_id: order_id.clone(),
                message: format!("Order {} {} {} berhasil dikirim ke Binance (ID: {}).", side, order_type, sym, order_id),
            })
        }
        "bitunix" => {
            let sym = clean_exchange_symbol(&req.symbol);
            let ts = chrono::Utc::now().timestamp_millis().to_string();
            let nonce = format!("trword{}", ts);
            let mut body_obj = serde_json::json!({
                "symbol": sym,
                "side": side,
                "tradeSide": "OPEN",
                "orderType": order_type,
                "qty": req.quantity.to_string(),
            });
            if order_type == "LIMIT" {
                let p = req.price.ok_or_else(|| "Harga Limit wajib diisi.".to_string())?;
                body_obj["price"] = serde_json::Value::String(p.to_string());
                body_obj["effect"] = serde_json::Value::String("GTC".to_string());
            }
            if let Some(tp) = req.take_profit.filter(|v| *v > 0.0) {
                body_obj["tpPrice"] = serde_json::Value::String(tp.to_string());
            }
            if let Some(sl) = req.stop_loss.filter(|v| *v > 0.0) {
                body_obj["slPrice"] = serde_json::Value::String(sl.to_string());
            }
            let body_str = serde_json::to_string(&body_obj).map_err(|e| e.to_string())?;
            let sign = bitunix_sign(&nonce, &ts, &cfg.api_key, "", &body_str, &cfg.api_secret_plain);
            let base = if cfg.endpoint_url.is_empty() {
                "https://fapi.bitunix.com"
            } else {
                cfg.endpoint_url.trim_end_matches('/')
            };
            let url = format!("{}/api/v1/futures/trade/place_order", base);
            let resp = client
                .post(&url)
                .header("api-key", &cfg.api_key)
                .header("nonce", &nonce)
                .header("timestamp", &ts)
                .header("sign", &sign)
                .header("Content-Type", "application/json")
                .body(body_str)
                .send()
                .await
                .map_err(|e| format!("Gagal mengirim order ke Bitunix: {}", e))?;

            let status = resp.status();
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let code = json.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
            if !status.is_success() || code != 0 {
                let msg = json.get("msg").and_then(|v| v.as_str()).unwrap_or("Order ditolak Bitunix");
                return Err(format!("Bitunix Order Error: {}", msg));
            }
            let order_id = json
                .get("data")
                .and_then(|d| d.get("orderId"))
                .and_then(|v| v.as_str())
                .unwrap_or("OK")
                .to_string();

            Ok(ManualOrderResponse {
                success: true,
                order_id: order_id.clone(),
                message: format!("Order {} {} {} berhasil dikirim ke Bitunix (ID: {}).", side, order_type, sym, order_id),
            })
        }
        "mt5" => {
            if is_local_mt5_loopback(&cfg.endpoint_url) {
                ensure_mt5_loopback_listener(mt5_state.inner(), &cfg.api_secret_plain);
                let queue_id = format!("MT5-Q-{}", chrono::Utc::now().timestamp_millis());
                let cmd = serde_json::json!({
                    "action": "ORDER",
                    "queueId": queue_id,
                    "symbol": req.symbol.trim(),
                    "side": side,
                    "orderType": order_type,
                    "volume": req.quantity,
                    "price": req.price.unwrap_or(0.0),
                    "sl": req.stop_loss.unwrap_or(0.0),
                    "tp": req.take_profit.unwrap_or(0.0),
                });
                let mut guard = mt5_state.cache.lock().map_err(|e| e.to_string())?;
                guard.pending_commands.push_back(cmd);
                return Ok(ManualOrderResponse {
                    success: true,
                    order_id: queue_id.clone(),
                    message: format!(
                        "Perintah order {} {} Lot {} dikirim ke antrean EA MT5 ({}).",
                        side,
                        req.quantity,
                        req.symbol.trim(),
                        queue_id
                    ),
                });
            }
            let base = cfg.endpoint_url.trim().trim_end_matches('/');
            let payload = serde_json::json!({
                "symbol": req.symbol.trim(),
                "side": side,
                "orderType": order_type,
                "volume": req.quantity,
                "price": req.price.unwrap_or(0.0),
                "sl": req.stop_loss.unwrap_or(0.0),
                "tp": req.take_profit.unwrap_or(0.0),
            });
            let resp = client
                .post(format!("{}/order", base))
                .header("X-Trawangan-Token", &cfg.api_secret_plain)
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Gagal menghubungi MT5 Bridge lokal: {}", e))?;

            let status = resp.status();
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Order ditolak oleh MT5");
                return Err(format!("MT5 Order Error: {}", msg));
            }
            let ticket = json
                .get("ticket")
                .map(|v| v.to_string().trim_matches('"').to_string())
                .unwrap_or_else(|| "MT5-OK".to_string());

            Ok(ManualOrderResponse {
                success: true,
                order_id: ticket.clone(),
                message: format!("Order {} {} Lot {} berhasil dieksekusi di MT5 (Ticket #{}).", side, req.quantity, req.symbol.trim(), ticket),
            })
        }
        _ => Err("Broker tidak didukung.".to_string()),
    }
}

#[tauri::command]
pub async fn cancel_manual_broker_order(
    db: State<'_, DbState>,
    mt5_state: State<'_, Mt5BridgeState>,
    broker_id: String,
    symbol: String,
    order_id: String,
) -> Result<String, String> {
    let cfg = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        load_stored_broker(&conn, &broker_id)?
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    match broker_id.as_str() {
        "binance" => {
            let sym = clean_exchange_symbol(&symbol);
            let ts = chrono::Utc::now().timestamp_millis();
            let q = format!("symbol={}&orderId={}&timestamp={}&recvWindow=5000", sym, order_id, ts);
            let sig = hmac_sha256_hex(&cfg.api_secret_plain, &q);
            let is_spot = cfg.market_mode == "spot";
            let url = if is_spot {
                format!("https://api.binance.com/api/v3/order?{}&signature={}", q, sig)
            } else {
                format!("https://fapi.binance.com/fapi/v1/order?{}&signature={}", q, sig)
            };
            let resp = client
                .delete(&url)
                .header("X-MBX-APIKEY", &cfg.api_key)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                let txt = resp.text().await.unwrap_or_default();
                return Err(format!("Gagal membatalkan order Binance: {}", txt));
            }
            Ok(format!("Order #{} dibatalkan.", order_id))
        }
        "mt5" => {
            if is_local_mt5_loopback(&cfg.endpoint_url) {
                ensure_mt5_loopback_listener(mt5_state.inner(), &cfg.api_secret_plain);
                let cmd = serde_json::json!({
                    "action": "CANCEL",
                    "ticket": order_id,
                    "symbol": symbol.trim(),
                });
                let mut guard = mt5_state.cache.lock().map_err(|e| e.to_string())?;
                guard.pending_commands.push_back(cmd);
                return Ok(format!(
                    "Perintah tutup/batal tiket MT5 #{} dikirim ke antrean EA MT5.",
                    order_id
                ));
            }
            let base = cfg.endpoint_url.trim().trim_end_matches('/');
            let resp = client
                .post(format!("{}/cancel", base))
                .header("X-Trawangan-Token", &cfg.api_secret_plain)
                .json(&serde_json::json!({ "ticket": order_id }))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                let txt = resp.text().await.unwrap_or_default();
                return Err(format!("Gagal menutup/membatalkan tiket MT5: {}", txt));
            }
            Ok(format!("Tiket MT5 #{} ditutup/dibatalkan.", order_id))
        }
        _ => Err("Pembatalan order untuk broker ini silakan lakukan via pasangan order berlawanan atau terminal.".to_string()),
    }
}
