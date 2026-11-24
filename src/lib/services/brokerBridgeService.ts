/**
 * Layanan Klien Frontend untuk Opt-In Execution Bridge (ADR-0031)
 *
 * Menjembatani komunikasi IPC ke Rust Core (`broker_bridge.rs`) dengan fallback aman
 * saat dijalankan di lingkungan web/test non-Tauri.
 */

import type { BrokerId } from '../types/market';
import { isTauriEnvironment } from '../utils/tauriEnv';
import { generateMt5ExpertAdvisorSource } from '../data/mt5BridgeAdvisorTemplate';

export interface BrokerConfigPublic {
  broker_id: BrokerId;
  market_mode: 'futures' | 'spot' | 'cfd';
  api_key_masked: string;
  has_secret: boolean;
  endpoint_url: string;
  is_verified: boolean;
  updated_at: number;
}

export interface SaveBrokerCredentialsInput {
  broker_id: BrokerId;
  market_mode: 'futures' | 'spot' | 'cfd';
  api_key: string;
  api_secret: string;
  endpoint_url?: string;
}

export interface BrokerAccountSummary {
  broker_id: BrokerId;
  connected: boolean;
  currency: string;
  balance: number;
  equity: number;
  available_margin: number;
  server_info: string;
}

export interface BrokerPositionItem {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entry_price: number;
  unrealized_pnl: number;
  leverage?: number;
}

export interface BrokerOpenOrderItem {
  order_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  order_type: string;
  price: number;
  quantity: number;
}

export interface ManualOrderRequest {
  broker_id: BrokerId;
  symbol: string;
  side: 'BUY' | 'SELL';
  order_type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  stop_loss?: number;
  take_profit?: number;
  leverage?: number;
}

export interface ManualOrderResponse {
  success: boolean;
  order_id: string;
  message: string;
}

const inMemoryFallbackConfigs = new Map<BrokerId, BrokerConfigPublic>();

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export function isRiskAcknowledgementValid(rawInput: string): boolean {
  const cleaned = rawInput.trim().toUpperCase();
  return cleaned === 'SETUJU' || cleaned === 'GAS' || cleaned === 'AGREE';
}

export async function listBrokerConfigs(): Promise<BrokerConfigPublic[]> {
  if (!isTauriEnvironment()) {
    return Array.from(inMemoryFallbackConfigs.values());
  }
  return invokeTauri<BrokerConfigPublic[]>('list_broker_configs');
}

export async function saveBrokerCredentials(
  input: SaveBrokerCredentialsInput
): Promise<BrokerConfigPublic> {
  if (!isTauriEnvironment()) {
    const rec: BrokerConfigPublic = {
      broker_id: input.broker_id,
      market_mode: input.market_mode,
      api_key_masked: input.api_key ? `${input.api_key.slice(0, 4)}••••` : '••••',
      has_secret: Boolean(input.api_secret),
      endpoint_url:
        input.endpoint_url ||
        (input.broker_id === 'mt5'
          ? 'http://127.0.0.1:15555'
          : input.broker_id === 'bitunix'
            ? 'https://fapi.bitunix.com'
            : 'https://fapi.binance.com'),
      is_verified: false,
      updated_at: Date.now()
    };
    inMemoryFallbackConfigs.set(input.broker_id, rec);
    return rec;
  }
  return invokeTauri<BrokerConfigPublic>('save_broker_credentials', { input });
}

export async function deleteBrokerCredentials(brokerId: BrokerId): Promise<void> {
  if (!isTauriEnvironment()) {
    inMemoryFallbackConfigs.delete(brokerId);
    return;
  }
  await invokeTauri<void>('delete_broker_credentials', { brokerId });
}

export async function verifyBrokerConnection(brokerId: BrokerId): Promise<BrokerAccountSummary> {
  if (!isTauriEnvironment()) {
    const existing = inMemoryFallbackConfigs.get(brokerId);
    if (!existing) {
      throw new Error('Simpan kredensial broker terlebih dahulu sebelum verifikasi.');
    }
    inMemoryFallbackConfigs.set(brokerId, { ...existing, is_verified: true, updated_at: Date.now() });
    return {
      broker_id: brokerId,
      connected: true,
      currency: brokerId === 'mt5' ? 'USD' : 'USDT',
      balance: 1000,
      equity: 1000,
      available_margin: 1000,
      server_info: `${brokerId.toUpperCase()} Simulated Dev Mode`
    };
  }
  return invokeTauri<BrokerAccountSummary>('verify_broker_connection', { brokerId });
}

export async function getBrokerAccountState(brokerId: BrokerId): Promise<{
  summary: BrokerAccountSummary;
  positions: BrokerPositionItem[];
  openOrders: BrokerOpenOrderItem[];
}> {
  if (!isTauriEnvironment()) {
    return {
      summary: {
        broker_id: brokerId,
        connected: true,
        currency: brokerId === 'mt5' ? 'USD' : 'USDT',
        balance: 1000,
        equity: 1000,
        available_margin: 1000,
        server_info: `${brokerId.toUpperCase()} Simulated Dev Mode`
      },
      positions: [],
      openOrders: []
    };
  }
  const [summary, positions, openOrders] = await invokeTauri<
    [BrokerAccountSummary, BrokerPositionItem[], BrokerOpenOrderItem[]]
  >('get_broker_account_state', { brokerId });
  return { summary, positions, openOrders };
}

export async function placeManualBrokerOrder(
  req: ManualOrderRequest
): Promise<ManualOrderResponse> {
  if (req.quantity <= 0 || Number.isNaN(req.quantity)) {
    throw new Error('Ukuran Quantity / Lot harus lebih besar dari 0.');
  }
  if (req.order_type === 'LIMIT' && (!req.price || req.price <= 0)) {
    throw new Error('Harga Limit harus lebih besar dari 0.');
  }
  if (!isTauriEnvironment()) {
    return {
      success: true,
      order_id: `SIM-${Date.now()}`,
      message: `[Simulated] Order ${req.side} ${req.order_type} ${req.quantity} ${req.symbol} diterima.`
    };
  }
  return invokeTauri<ManualOrderResponse>('place_manual_broker_order', { req });
}

export async function cancelManualBrokerOrder(
  brokerId: BrokerId,
  symbol: string,
  orderId: string
): Promise<string> {
  if (!isTauriEnvironment()) {
    return `[Simulated] Order #${orderId} dibatalkan.`;
  }
  return invokeTauri<string>('cancel_manual_broker_order', {
    brokerId,
    symbol,
    orderId
  });
}

export function downloadMt5ExpertAdvisorFile(port = 15555, localToken = 'trawangan-mt5-local'): void {
  if (typeof document === 'undefined') return;
  const content = generateMt5ExpertAdvisorSource(port, localToken);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'TrawanganMT5Bridge.mq5';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
