// Modul Data Pasar (Market Data Service) untuk HTTP REST & Ingestion
use crate::db::Candle;
use reqwest::Client;
use serde_json::Value;

pub struct MarketService {
    client: Client,
}

impl MarketService {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .user_agent("trawangan/0.15.0")
                .build()
                .unwrap_or_default(),
        }
    }

    /// Mengambil data teks/JSON mentah dari URL eksternal via native reqwest (bebas CORS)
    pub async fn get(&self, url: &str, timeout_secs: Option<u64>) -> Result<String, String> {
        let mut req = self.client.get(url);
        if let Some(secs) = timeout_secs {
            req = req.timeout(std::time::Duration::from_secs(secs));
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("Gagal menghubungi endpoint: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Server mengembalikan status HTTP {}: {}",
                res.status(),
                res.status().canonical_reason().unwrap_or("")
            ));
        }

        res.text()
            .await
            .map_err(|e| format!("Gagal membaca respons server: {}", e))
    }

    /// Ambil data candle historis dari Binance Public REST API
    pub async fn fetch_binance_klines(
        &self,
        symbol: &str,
        interval: &str,
        limit: u32,
    ) -> Result<Vec<Candle>, String> {
        let clean_symbol = symbol
            .split(':')
            .last()
            .unwrap_or(symbol)
            .replace('/', "")
            .replace('-', "")
            .to_uppercase();

        let lower_interval = interval.to_lowercase();
        let clean_interval: &str = match lower_interval.as_str() {
            "1" => "1m",
            "3" => "3m",
            "5" => "5m",
            "15" => "15m",
            "30" => "30m",
            "60" => "1h",
            "120" => "2h",
            "240" => "4h",
            "d" | "1d" => "1d",
            "w" | "1w" => "1w",
            "m" => "1M",
            "1m" => if interval == "1M" { "1M" } else { "1m" },
            _ => {
                if lower_interval.ends_with('d') || lower_interval.ends_with('w') {
                    // Binance memakai lowercase untuk d dan w
                    lower_interval.as_str()
                } else {
                    interval
                }
            }
        };

        let url = format!(
            "https://api.binance.com/api/v3/klines?symbol={}&interval={}&limit={}",
            clean_symbol, clean_interval, limit
        );

        let res = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Gagal menghubungi Binance API: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Binance API mengembalikan status error: {}", res.status()));
        }

        let raw_klines: Value = res
            .json()
            .await
            .map_err(|e| format!("Gagal mem-parsing JSON respon Binance: {}", e))?;

        let kline_array = raw_klines
            .as_array()
            .ok_or_else(|| "Format respon Binance bukan array klines".to_string())?;

        let mut candles = Vec::with_capacity(kline_array.len());
        for item in kline_array {
            if let Some(arr) = item.as_array() {
                if arr.len() >= 6 {
                    let time = arr[0].as_i64().unwrap_or(0);
                    let open = arr[1].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                    let high = arr[2].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                    let low = arr[3].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                    let close = arr[4].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                    let volume = arr[5].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);

                    candles.push(Candle {
                        time,
                        open,
                        high,
                        low,
                        close,
                        volume,
                    });
                }
            }
        }

        Ok(candles)
    }

    /// Ambil candle dari endpoint kustom yang ditentukan pengguna
    pub async fn fetch_custom_klines(
        &self,
        base_url: &str,
        symbol: &str,
        interval: &str,
        limit: u32,
    ) -> Result<Vec<Candle>, String> {
        let url = if base_url.contains('?') {
            format!("{}&symbol={}&interval={}&limit={}", base_url, symbol, interval, limit)
        } else {
            format!("{}/klines?symbol={}&interval={}&limit={}", base_url.trim_end_matches('/'), symbol, interval, limit)
        };

        let res = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Gagal menghubungi Custom REST endpoint: {}", e))?;

        let raw: Value = res
            .json()
            .await
            .map_err(|e| format!("Gagal membaca JSON dari Custom endpoint: {}", e))?;

        // Dukung baik format array of arrays [[time, o, h, l, c, v]] atau array of objects [{time, open, ...}]
        let mut candles = Vec::new();
        if let Some(arr) = raw.as_array() {
            for item in arr {
                if let Some(sub_arr) = item.as_array() {
                    if sub_arr.len() >= 6 {
                        candles.push(Candle {
                            time: sub_arr[0].as_i64().unwrap_or(0),
                            open: sub_arr[1].as_f64().or_else(|| sub_arr[1].as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0),
                            high: sub_arr[2].as_f64().or_else(|| sub_arr[2].as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0),
                            low: sub_arr[3].as_f64().or_else(|| sub_arr[3].as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0),
                            close: sub_arr[4].as_f64().or_else(|| sub_arr[4].as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0),
                            volume: sub_arr[5].as_f64().or_else(|| sub_arr[5].as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0),
                        });
                    }
                } else if let Some(obj) = item.as_object() {
                    let time = obj.get("time").or_else(|| obj.get("timestamp")).and_then(|v| v.as_i64()).unwrap_or(0);
                    let open = obj.get("open").and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0.0);
                    let high = obj.get("high").and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0.0);
                    let low = obj.get("low").and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0.0);
                    let close = obj.get("close").and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0.0);
                    let volume = obj.get("volume").and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0.0);

                    candles.push(Candle {
                        time,
                        open,
                        high,
                        low,
                        close,
                        volume,
                    });
                }
            }
        }

        Ok(candles)
    }
}
