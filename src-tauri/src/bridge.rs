use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

pub const BRIDGE_PORT: u16 = 47831;
pub const BRIDGE_ADDR: &str = "127.0.0.1:47831";

#[derive(Debug, Clone, Serialize)]
pub struct BridgeStatus {
    pub active: bool,
    pub port: u16,
    pub addr: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TradingViewBridgeOpenPayload {
    pub url: String,
    pub symbol: Option<String>,
    pub timeframe: Option<String>,
}

pub struct BridgeState {
    status: Arc<Mutex<BridgeStatus>>,
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            status: Arc::new(Mutex::new(BridgeStatus {
                active: false,
                port: BRIDGE_PORT,
                addr: BRIDGE_ADDR.to_string(),
                error: None,
            })),
        }
    }

    fn set_active(&self, active: bool, error: Option<String>) {
        if let Ok(mut guard) = self.status.lock() {
            guard.active = active;
            guard.error = error;
        }
    }

    pub fn snapshot(&self) -> BridgeStatus {
        self.status
            .lock()
            .map(|g| g.clone())
            .unwrap_or(BridgeStatus {
                active: false,
                port: BRIDGE_PORT,
                addr: BRIDGE_ADDR.to_string(),
                error: Some("Lock poisoned".to_string()),
            })
    }
}

#[tauri::command]
pub fn get_bridge_status(state: State<'_, BridgeState>) -> BridgeStatus {
    state.snapshot()
}

pub fn focus_main_window(app: &AppHandle) {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.unminimize();
        let _ = main_win.show();
        let _ = main_win.set_focus();
    }
}

pub fn emit_bridge_open(
    app: &AppHandle,
    url: String,
    symbol: Option<String>,
    timeframe: Option<String>,
) {
    focus_main_window(app);
    let payload = TradingViewBridgeOpenPayload {
        url,
        symbol,
        timeframe,
    };
    let _ = app.emit("tradingview-bridge-open", payload);
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hex = &input[i + 1..i + 3];
                if let Ok(val) = u8::from_str_radix(hex, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
                out.push(b'%');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }

    String::from_utf8_lossy(&out).into_owned()
}

fn parse_query_params(query: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut url_param = None;
    let mut symbol_param = None;
    let mut timeframe_param = None;

    for pair in query.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or("");
        let val = parts.next().unwrap_or("");
        let decoded = percent_decode(val);

        match key {
            "url" if !decoded.is_empty() => url_param = Some(decoded),
            "symbol" if !decoded.is_empty() => symbol_param = Some(decoded),
            "timeframe" | "interval" if !decoded.is_empty() => timeframe_param = Some(decoded),
            _ => {}
        }
    }

    (url_param, symbol_param, timeframe_param)
}

fn build_http_response(status_line: &str, content_type: &str, body: &str) -> Vec<u8> {
    format!(
        "HTTP/1.1 {status_line}\r\n\
         Content-Type: {content_type}\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, OPTIONS\r\n\
         Access-Control-Allow-Headers: *\r\n\
         Cache-Control: no-store\r\n\
         Connection: close\r\n\
         \r\n\
         {body}",
        body.len()
    )
    .into_bytes()
}

async fn handle_connection(mut socket: tokio::net::TcpStream, app: AppHandle) {
    let mut buf = [0u8; 8192];
    let n = match socket.read(&mut buf).await {
        Ok(0) | Err(_) => return,
        Ok(n) => n,
    };

    let req_text = String::from_utf8_lossy(&buf[..n]);
    let first_line = req_text.lines().next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("/");

    if method.eq_ignore_ascii_case("OPTIONS") {
        let resp = build_http_response("204 No Content", "text/plain", "");
        let _ = socket.write_all(&resp).await;
        return;
    }

    if !method.eq_ignore_ascii_case("GET") {
        let resp = build_http_response(
            "405 Method Not Allowed",
            "application/json",
            r#"{"ok":false,"error":"method_not_allowed"}"#,
        );
        let _ = socket.write_all(&resp).await;
        return;
    }

    let (path, query) = match target.split_once('?') {
        Some((p, q)) => (p, q),
        None => (target, ""),
    };

    let resp = match path {
        "/ping" => build_http_response(
            "200 OK",
            "application/json",
            r#"{"ok":true,"app":"trawangan"}"#,
        ),
        "/open" => {
            let (url_opt, symbol_opt, timeframe_opt) = parse_query_params(query);
            if url_opt.is_none() && symbol_opt.is_none() {
                build_http_response(
                    "400 Bad Request",
                    "application/json",
                    r#"{"ok":false,"error":"missing_url_or_symbol"}"#,
                )
            } else {
                let target_url = url_opt.unwrap_or_else(|| {
                    format!(
                        "https://www.tradingview.com/chart/?symbol={}",
                        symbol_opt.as_deref().unwrap_or("")
                    )
                });
                emit_bridge_open(&app, target_url, symbol_opt, timeframe_opt);
                build_http_response("200 OK", "application/json", r#"{"ok":true}"#)
            }
        }
        _ => build_http_response(
            "404 Not Found",
            "application/json",
            r#"{"ok":false,"error":"not_found"}"#,
        ),
    };

    let _ = socket.write_all(&resp).await;
}

/// Menjalankan TCP loopback listener ringan di 127.0.0.1:47831 untuk userscript TradingView.
pub fn spawn_loopback_bridge(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        match TcpListener::bind(BRIDGE_ADDR).await {
            Ok(listener) => {
                if let Some(state) = app.try_state::<BridgeState>() {
                    state.set_active(true, None);
                }
                loop {
                    match listener.accept().await {
                        Ok((socket, _addr)) => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                handle_connection(socket, app_handle).await;
                            });
                        }
                        Err(_) => continue,
                    }
                }
            }
            Err(err) => {
                if let Some(state) = app.try_state::<BridgeState>() {
                    state.set_active(false, Some(err.to_string()));
                }
            }
        }
    });
}
