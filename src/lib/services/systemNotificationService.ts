// Layanan Notifikasi Multi-Kanal (Desktop OS Native, Telegram Bot, dan Discord Webhook)
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification';
import { universalFetch, type UniversalFetchOptions, type UniversalResponse } from './httpClient';

export type NotificationFetchFn = (
  url: string,
  options?: UniversalFetchOptions
) => Promise<UniversalResponse>;

/**
 * Format angka harga agar rapi
 */
function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '--';
  if (val >= 1000) return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (val >= 1) return val.toFixed(4);
  return val.toFixed(6);
}

/**
 * Terjemahkan kondisi alert ke teks bahasa Indonesia yang intuitif
 */
function getConditionText(cond: string): string {
  switch (cond) {
    case 'crossing_up':
    case 'above':
      return 'Menembus ke Atas (Crossing Up)';
    case 'crossing_down':
    case 'below':
      return 'Menembus ke Bawah (Crossing Down)';
    case 'greater_than':
      return 'Lebih Besar Dari (Greater Than)';
    case 'less_than':
      return 'Lebih Kecil Dari (Less Than)';
    case 'crossing':
    default:
      return 'Menyentuh Level (Crossing)';
  }
}

/**
 * Pastikan izin notifikasi sistem telah diberikan oleh pengguna
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    return granted;
  } catch (err) {
    // Fallback jika dijalankan di browser web standar
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      }
    }
    console.warn('Gagal memverifikasi izin notifikasi sistem:', err);
    return false;
  }
}

export interface WindowsAlertOptions {
  symbol: string;
  targetPrice: number;
  actualPrice?: number;
  condition?: string;
  label?: string;
}

export interface DesktopNotificationPayload {
  title: string;
  body: string;
  icon?: string;
}

/**
 * Kirim notifikasi push desktop generik melalui plugin Tauri atau Web Notification API
 */
export async function sendDesktopNotification(payload: DesktopNotificationPayload): Promise<boolean> {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return false;
  }

  try {
    sendNotification({
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
    });
    return true;
  } catch (err) {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/icons/128x128.png',
        });
        return true;
      }
    } catch (_) {}
    console.warn('Gagal mengirim notifikasi desktop:', err);
    return false;
  }
}

/**
 * Kirim notifikasi toast native ke sistem desktop
 */
export async function sendDesktopAlertNotification(opts: WindowsAlertOptions): Promise<boolean> {
  const symbol = opts.symbol.toUpperCase();
  const targetFormatted = formatNumber(opts.targetPrice);
  const actualFormatted = opts.actualPrice ? formatNumber(opts.actualPrice) : targetFormatted;
  const condText = getConditionText(opts.condition || 'crossing');

  const title = `🔔 Price Alert: ${symbol}`;
  const body = opts.label && opts.label.trim()
    ? `Target $${targetFormatted} tercapai! (${opts.label})\nHarga: $${actualFormatted} • ${condText}`
    : `Target $${targetFormatted} tercapai! (Harga: $${actualFormatted})\nKondisi: ${condText}`;

  return sendDesktopNotification({ title, body, icon: '/icons/128x128.png' });
}

/** @deprecated Gunakan sendDesktopAlertNotification */
export const sendWindowsAlertNotification = sendDesktopAlertNotification;

/**
 * Kirim notifikasi uji coba untuk memverifikasi notifikasi desktop sistem
 */
export async function sendTestNotification(): Promise<boolean> {
  const title = '🔔 trawangan - Tes Notifikasi Desktop';
  const body =
    'Integrasi notifikasi desktop sistem aktif! Anda akan menerima alert saat target harga atau Pine Script terpicu.';

  return sendDesktopNotification({ title, body, icon: '/icons/128x128.png' });
}

export interface NotificationChannelsConfig {
  systemNotificationEnabled?: boolean;
  telegramNotificationEnabled?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  discordNotificationEnabled?: boolean;
  discordWebhookUrl?: string;
}

/**
 * Ekstrak konfigurasi kanal notifikasi dari objek AppSettings parsial
 */
export function extractNotificationChannelsConfig(
  settings: NotificationChannelsConfig
): NotificationChannelsConfig {
  return {
    systemNotificationEnabled: settings.systemNotificationEnabled !== false,
    telegramNotificationEnabled: Boolean(settings.telegramNotificationEnabled),
    telegramBotToken: settings.telegramBotToken || '',
    telegramChatId: settings.telegramChatId || '',
    discordNotificationEnabled: Boolean(settings.discordNotificationEnabled),
    discordWebhookUrl: settings.discordWebhookUrl || '',
  };
}

export interface ChannelDispatchResult {
  ok: boolean;
  error?: string;
}

export interface AlertNotificationEvent {
  kind: 'price' | 'pine';
  symbol: string;
  targetPrice?: number;
  actualPrice?: number;
  condition?: string;
  label?: string;
  indicatorTitle?: string;
  timestamp?: number;
}

const DISCORD_COLOR_BULL = 0x00f090;
const DISCORD_COLOR_BEAR = 0xf6465d;
const DISCORD_COLOR_CYAN = 0x38bdf8;

/**
 * Validasi dasar kredensial Bot Telegram (Bot Token & Chat ID wajib terisi)
 */
export function isValidTelegramConfig(botToken?: string, chatId?: string): boolean {
  const token = (botToken || '').trim();
  const chat = (chatId || '').trim();
  if (!token || !chat) return false;
  // Format umum token BotFather: <bot_id>:<secret>
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(token);
}

/**
 * Validasi URL Discord Webhook
 */
export function isValidDiscordWebhookUrl(webhookUrl?: string): boolean {
  const url = (webhookUrl || '').trim();
  return (
    url.startsWith('https://discord.com/api/webhooks/') ||
    url.startsWith('https://discordapp.com/api/webhooks/')
  );
}

/**
 * Escape karakter khusus HTML untuk mode parse_mode: 'HTML' Telegram
 */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatEventTimestamp(ts?: number): string {
  const date = new Date(ts || Date.now());
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function resolveDiscordEmbedColor(event: AlertNotificationEvent): number {
  if (event.kind === 'pine') return DISCORD_COLOR_CYAN;
  switch (event.condition) {
    case 'crossing_up':
    case 'above':
    case 'greater_than':
      return DISCORD_COLOR_BULL;
    case 'crossing_down':
    case 'below':
    case 'less_than':
      return DISCORD_COLOR_BEAR;
    default:
      return DISCORD_COLOR_CYAN;
  }
}

/**
 * Bangun pesan HTML terstruktur untuk dikirim ke Telegram Bot API
 */
export function formatTelegramAlertHtml(event: AlertNotificationEvent): string {
  const symbol = escapeHtml((event.symbol || 'CHART').toUpperCase());
  const timeStr = escapeHtml(formatEventTimestamp(event.timestamp));

  if (event.kind === 'pine') {
    const indicator = escapeHtml(event.indicatorTitle || 'Pine Script Alert');
    const message = escapeHtml(event.label || 'Alert terpicu');
    return [
      `<b>🔔 Pine Alert: ${symbol}</b>`,
      `<b>Indikator:</b> ${indicator}`,
      `<b>Pesan:</b> ${message}`,
      `<b>Waktu:</b> <code>${timeStr}</code>`,
      ``,
      `<i>trawangan</i>`,
    ].join('\n');
  }

  const targetFormatted = formatNumber(event.targetPrice);
  const actualFormatted = event.actualPrice !== undefined ? formatNumber(event.actualPrice) : targetFormatted;
  const condText = escapeHtml(getConditionText(event.condition || 'crossing'));
  const lines = [
    `<b>🔔 Price Alert: ${symbol}</b>`,
    `<b>Target:</b> <code>$${escapeHtml(targetFormatted)}</code>`,
    `<b>Harga Terpicu:</b> <code>$${escapeHtml(actualFormatted)}</code>`,
    `<b>Kondisi:</b> ${condText}`,
  ];
  if (event.label && event.label.trim()) {
    lines.push(`<b>Catatan:</b> ${escapeHtml(event.label.trim())}`);
  }
  lines.push(`<b>Waktu:</b> <code>${timeStr}</code>`, ``, `<i>trawangan</i>`);
  return lines.join('\n');
}

/**
 * Bangun payload Rich Embed untuk dikirim ke Discord Webhook
 */
export function buildDiscordAlertEmbed(event: AlertNotificationEvent): Record<string, unknown> {
  const symbol = (event.symbol || 'CHART').toUpperCase();
  const color = resolveDiscordEmbedColor(event);
  const isoTimestamp = new Date(event.timestamp || Date.now()).toISOString();

  if (event.kind === 'pine') {
    return {
      username: 'trawangan',
      embeds: [
        {
          title: `🔔 Pine Alert: ${symbol}`,
          color,
          fields: [
            {
              name: 'Indikator',
              value: event.indicatorTitle || 'Pine Script Alert',
              inline: true,
            },
            {
              name: 'Simbol',
              value: symbol,
              inline: true,
            },
            {
              name: 'Pesan',
              value: event.label || 'Alert terpicu',
              inline: false,
            },
          ],
          footer: { text: 'trawangan' },
          timestamp: isoTimestamp,
        },
      ],
    };
  }

  const targetFormatted = formatNumber(event.targetPrice);
  const actualFormatted = event.actualPrice !== undefined ? formatNumber(event.actualPrice) : targetFormatted;
  const condText = getConditionText(event.condition || 'crossing');

  const fields = [
    { name: 'Simbol', value: symbol, inline: true },
    { name: 'Target Harga', value: `$${targetFormatted}`, inline: true },
    { name: 'Harga Terpicu', value: `$${actualFormatted}`, inline: true },
    { name: 'Kondisi', value: condText, inline: false },
  ];

  if (event.label && event.label.trim()) {
    fields.push({ name: 'Catatan', value: event.label.trim(), inline: false });
  }

  return {
    username: 'trawangan',
    embeds: [
      {
        title: `🔔 Price Alert: ${symbol}`,
        color,
        fields,
        footer: { text: 'trawangan' },
        timestamp: isoTimestamp,
      },
    ],
  };
}

/**
 * Kirim pesan HTML ke Telegram Bot API
 */
export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  htmlText: string,
  fetchImpl: NotificationFetchFn = universalFetch
): Promise<ChannelDispatchResult> {
  const token = (botToken || '').trim();
  const chat = (chatId || '').trim();

  if (!isValidTelegramConfig(token, chat)) {
    return {
      ok: false,
      error: 'Bot Token atau Chat ID Telegram tidak valid atau belum diisi.',
    };
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      timeoutMs: 10000,
    });

    const rawText = await res.text().catch(() => '');
    if (!res.ok) {
      let detail = rawText;
      try {
        const parsed = JSON.parse(rawText);
        if (parsed?.description) detail = parsed.description;
      } catch (_) {}
      return {
        ok: false,
        error: `Telegram HTTP ${res.status}${detail ? `: ${detail}` : ''}`,
      };
    }

    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && parsed.ok === false) {
          return {
            ok: false,
            error: parsed.description || 'Telegram API mengembalikan ok: false',
          };
        }
      } catch (_) {}
    }

    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Kirim payload Rich Embed ke Discord Webhook
 */
export async function sendDiscordWebhookNotification(
  webhookUrl: string,
  payload: Record<string, unknown>,
  fetchImpl: NotificationFetchFn = universalFetch
): Promise<ChannelDispatchResult> {
  const url = (webhookUrl || '').trim();
  if (!isValidDiscordWebhookUrl(url)) {
    return {
      ok: false,
      error: 'URL Webhook Discord tidak valid (harus diawali https://discord.com/api/webhooks/).',
    };
  }

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 10000,
    });

    if (!res.ok) {
      const rawText = await res.text().catch(() => '');
      let detail = rawText;
      try {
        const parsed = JSON.parse(rawText);
        if (parsed?.message) detail = parsed.message;
      } catch (_) {}
      return {
        ok: false,
        error: `Discord HTTP ${res.status}${detail ? `: ${detail}` : ''}`,
      };
    }

    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Kirim pesan uji coba ke Bot Telegram
 */
export async function sendTestTelegramNotification(
  botToken: string,
  chatId: string,
  fetchImpl: NotificationFetchFn = universalFetch
): Promise<ChannelDispatchResult> {
  const text = [
    `<b>🔔 Tes Notifikasi Telegram</b>`,
    `Integrasi notifikasi Bot Telegram aktif! Anda akan menerima alert saat target harga atau Pine Script terpicu.`,
    `<b>Waktu:</b> <code>${escapeHtml(formatEventTimestamp())}</code>`,
    ``,
    `<i>trawangan</i>`,
  ].join('\n');

  return sendTelegramNotification(botToken, chatId, text, fetchImpl);
}

/**
 * Kirim pesan uji coba ke Webhook Discord
 */
export async function sendTestDiscordNotification(
  webhookUrl: string,
  fetchImpl: NotificationFetchFn = universalFetch
): Promise<ChannelDispatchResult> {
  const payload = {
    username: 'trawangan',
    embeds: [
      {
        title: '🔔 Tes Notifikasi Discord',
        description:
          'Integrasi notifikasi Discord Webhook aktif! Anda akan menerima alert saat target harga atau Pine Script terpicu.',
        color: DISCORD_COLOR_BULL,
        footer: { text: 'trawangan' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return sendDiscordWebhookNotification(webhookUrl, payload, fetchImpl);
}

/**
 * Kirim notifikasi alert ke kanal eksternal aktif (Telegram & Discord) secara paralel & non-blocking
 */
export function dispatchExternalAlertNotifications(
  event: AlertNotificationEvent,
  config: NotificationChannelsConfig,
  fetchImpl: NotificationFetchFn = universalFetch
): void {
  if (config.telegramNotificationEnabled && isValidTelegramConfig(config.telegramBotToken, config.telegramChatId)) {
    const html = formatTelegramAlertHtml(event);
    void sendTelegramNotification(
      config.telegramBotToken!,
      config.telegramChatId!,
      html,
      fetchImpl
    ).then((res) => {
      if (!res.ok) {
        console.warn('[Notification:Telegram] Gagal mengirim alert:', res.error);
      }
    });
  }

  if (config.discordNotificationEnabled && isValidDiscordWebhookUrl(config.discordWebhookUrl)) {
    const embedPayload = buildDiscordAlertEmbed(event);
    void sendDiscordWebhookNotification(
      config.discordWebhookUrl!,
      embedPayload,
      fetchImpl
    ).then((res) => {
      if (!res.ok) {
        console.warn('[Notification:Discord] Gagal mengirim alert:', res.error);
      }
    });
  }
}
