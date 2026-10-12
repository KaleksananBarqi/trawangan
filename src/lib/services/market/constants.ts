// Daftar master aset terverifikasi & konfigurasi default bursa
import type { ProviderConfig } from '../../types/market';

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'binance',
    name: 'Binance Official Public',
    rest_url: 'https://api.binance.com',
    ws_url: 'wss://stream.binance.com:9443',
    is_active: true,
  },
  {
    id: 'indodax',
    name: 'Indodax Official Spot (IDR)',
    rest_url: 'https://indodax.com',
    ws_url: '',
    is_active: false,
  },
  {
    id: 'bitunix',
    name: 'Bitunix Futures (USDT-M)',
    rest_url: 'https://fapi.bitunix.com',
    ws_url: 'wss://fapi.bitunix.com/public/',
    is_active: false,
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid DEX Perpetuals',
    rest_url: 'https://api.hyperliquid.xyz',
    ws_url: 'wss://api.hyperliquid.xyz/ws',
    is_active: false,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Exchange Spot',
    rest_url: 'https://api.exchange.coinbase.com',
    ws_url: 'wss://ws-feed.exchange.coinbase.com',
    is_active: false,
  },
];

export const VERIFIED_CRYPTO_ASSETS = [
  { base: 'BTC', name: 'Bitcoin' },
  { base: 'ETH', name: 'Ethereum' },
  { base: 'SOL', name: 'Solana' },
  { base: 'BNB', name: 'Binance Coin' },
  { base: 'XRP', name: 'Ripple' },
  { base: 'DOGE', name: 'Dogecoin' },
  { base: 'ADA', name: 'Cardano' },
  { base: 'AVAX', name: 'Avalanche' },
  { base: 'SUI', name: 'Sui Network' },
  { base: 'LINK', name: 'Chainlink' },
  { base: 'PEPE', name: 'Pepe' },
  { base: 'SHIB', name: 'Shiba Inu' },
  { base: 'NEAR', name: 'NEAR Protocol' },
  { base: 'APT', name: 'Aptos' },
  { base: 'DOT', name: 'Polkadot' },
  { base: 'RENDER', name: 'Render Token' },
  { base: 'TAO', name: 'Bittensor' },
  { base: 'FET', name: 'Artificial Superintelligence Alliance' },
  { base: 'INJ', name: 'Injective' },
  { base: 'ARB', name: 'Arbitrum' },
  { base: 'OP', name: 'Optimism' },
  { base: 'MATIC', name: 'Polygon' },
  { base: 'POL', name: 'Polygon Ecosystem' },
  { base: 'LTC', name: 'Litecoin' },
  { base: 'BCH', name: 'Bitcoin Cash' },
  { base: 'KAS', name: 'Kaspa' },
  { base: 'SEI', name: 'Sei' },
  { base: 'TIA', name: 'Celestia' },
  { base: 'WIF', name: 'dogwifhat' },
  { base: 'BONK', name: 'Bonk' },
  { base: 'FLOKI', name: 'Floki' },
  { base: 'ENA', name: 'Ethena' },
  { base: 'PENDLE', name: 'Pendle' },
  { base: 'AAVE', name: 'Aave' },
  { base: 'UNI', name: 'Uniswap' },
  { base: 'TON', name: 'Toncoin' },
  { base: 'TRX', name: 'TRON' },
  { base: 'ATOM', name: 'Cosmos' },
  { base: 'FTM', name: 'Fantom' },
  { base: 'ALGO', name: 'Algorand' },
];

export function normalizeTicker(sym: string): string {
  if (!sym) return '';
  const parts = sym.split(':');
  const raw = parts[parts.length - 1];
  return raw.replace(/[\/\-_]/g, '').toUpperCase();
}
