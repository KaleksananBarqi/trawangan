import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiscordAlertEmbed,
  dispatchExternalAlertNotifications,
  escapeHtml,
  formatTelegramAlertHtml,
  isValidDiscordWebhookUrl,
  isValidTelegramConfig,
  sendDiscordWebhookNotification,
  sendTelegramNotification,
  type NotificationFetchFn,
} from '../src/lib/services/systemNotificationService';
import { DEFAULT_APP_SETTINGS, resolveAppSettings } from '../src/lib/constants/defaults';
import { PineAlertBridge } from '../src/lib/services/pineAlertBridge';

describe('Multi-Channel Alert Notification Suite (Desktop, Telegram, Discord)', () => {
  test('1. Validasi kredensial Telegram Bot & Discord Webhook URL', () => {
    assert.equal(isValidTelegramConfig('', ''), false);
    assert.equal(isValidTelegramConfig('invalid-token', '123456789'), false);
    assert.equal(isValidTelegramConfig('123456:ABCdefGHIjklMNOpqrsTUVwxyz1234', ''), false);
    assert.equal(isValidTelegramConfig('123456:ABCdefGHIjklMNOpqrsTUVwxyz1234', '123456789'), true);
    assert.equal(isValidTelegramConfig('123456:ABCdefGHIjklMNOpqrsTUVwxyz1234', '-100192837465'), true);

    assert.equal(isValidDiscordWebhookUrl(''), false);
    assert.equal(isValidDiscordWebhookUrl('https://example.com/webhook'), false);
    assert.equal(isValidDiscordWebhookUrl('https://discord.com/api/webhooks/123/abc'), true);
    assert.equal(isValidDiscordWebhookUrl('https://discordapp.com/api/webhooks/123/abc'), true);
  });

  test('2. Format HTML Telegram melakukan escaping karakter berbahaya dan menyertakan footer trawangan', () => {
    assert.equal(escapeHtml('A < B & C > D'), 'A &lt; B &amp; C &gt; D');

    const priceHtml = formatTelegramAlertHtml({
      kind: 'price',
      symbol: 'BTCUSDT',
      targetPrice: 95000,
      actualPrice: 95120.5,
      condition: 'crossing_up',
      label: 'Breakout <H4> & Reclaim',
      timestamp: 1731660000000,
    });

    assert.ok(priceHtml.includes('<b>🔔 Price Alert: BTCUSDT</b>'));
    assert.ok(priceHtml.includes('$95,000.00'));
    assert.ok(priceHtml.includes('$95,120.50'));
    assert.ok(priceHtml.includes('Breakout &lt;H4&gt; &amp; Reclaim'));
    assert.ok(priceHtml.includes('<i>trawangan</i>'));

    const pineHtml = formatTelegramAlertHtml({
      kind: 'pine',
      symbol: 'ETHUSDT',
      indicatorTitle: 'SuperTrend <Pro>',
      label: 'Buy Signal & Confirmation',
      timestamp: 1731660000000,
    });

    assert.ok(pineHtml.includes('<b>🔔 Pine Alert: ETHUSDT</b>'));
    assert.ok(pineHtml.includes('SuperTrend &lt;Pro&gt;'));
    assert.ok(pineHtml.includes('Buy Signal &amp; Confirmation'));
    assert.ok(pineHtml.includes('<i>trawangan</i>'));
  });

  test('3. Format Discord Rich Embed menggunakan warna dinamis dan footer "trawangan"', () => {
    const bullPayload: any = buildDiscordAlertEmbed({
      kind: 'price',
      symbol: 'BTCUSDT',
      targetPrice: 95000,
      actualPrice: 95100,
      condition: 'crossing_up',
      label: 'Long Entry',
      timestamp: 1731660000000,
    });

    assert.equal(bullPayload.username, 'trawangan');
    assert.equal(bullPayload.embeds[0].color, 0x00f090);
    assert.equal(bullPayload.embeds[0].footer.text, 'trawangan');
    assert.ok(bullPayload.embeds[0].fields.some((f: any) => f.name === 'Catatan' && f.value === 'Long Entry'));

    const bearPayload: any = buildDiscordAlertEmbed({
      kind: 'price',
      symbol: 'SOLUSDT',
      targetPrice: 200,
      actualPrice: 199.5,
      condition: 'crossing_down',
      timestamp: 1731660000000,
    });
    assert.equal(bearPayload.embeds[0].color, 0xf6465d);

    const pinePayload: any = buildDiscordAlertEmbed({
      kind: 'pine',
      symbol: 'ETHUSDT',
      indicatorTitle: 'RSI Divergence',
      label: 'Bullish Divergence',
      timestamp: 1731660000000,
    });
    assert.equal(pinePayload.embeds[0].color, 0x38bdf8);
    assert.equal(pinePayload.embeds[0].footer.text, 'trawangan');
  });

  test('4. sendTelegramNotification & sendDiscordWebhookNotification menangani sukses dan error HTTP', async () => {
    const capturedCalls: Array<{ url: string; body: string }> = [];

    const mockOkFetch: NotificationFetchFn = async (url, opts) => {
      capturedCalls.push({ url, body: opts?.body || '' });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '{"ok":true}',
        json: async <T = any>() => ({ ok: true }) as T,
      };
    };

    const tgOk = await sendTelegramNotification(
      '123456:ABCdefGHIjklMNOpqrsTUVwxyz1234',
      '123456789',
      '<b>Test</b>',
      mockOkFetch
    );
    assert.equal(tgOk.ok, true);
    assert.equal(capturedCalls[0].url, 'https://api.telegram.org/bot123456:ABCdefGHIjklMNOpqrsTUVwxyz1234/sendMessage');

    const dcOk = await sendDiscordWebhookNotification(
      'https://discord.com/api/webhooks/123/abc',
      { content: 'test' },
      mockOkFetch
    );
    assert.equal(dcOk.ok, true);
    assert.equal(capturedCalls[1].url, 'https://discord.com/api/webhooks/123/abc');

    const mockErrFetch: NotificationFetchFn = async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ description: 'Unauthorized bot token' }),
      json: async <T = any>() => ({}) as T,
    });

    const tgErr = await sendTelegramNotification(
      '123456:ABCdefGHIjklMNOpqrsTUVwxyz1234',
      '123456789',
      '<b>Test</b>',
      mockErrFetch
    );
    assert.equal(tgErr.ok, false);
    assert.ok(tgErr.error?.includes('401'));
    assert.ok(tgErr.error?.includes('Unauthorized bot token'));
  });

  test('5. dispatchExternalAlertNotifications hanya mengirim ke kanal yang aktif dan valid', async () => {
    const sentUrls: string[] = [];
    const mockFetch: NotificationFetchFn = async (url) => {
      sentUrls.push(url);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '',
        json: async <T = any>() => ({}) as T,
      };
    };

    // Hanya Telegram aktif
    dispatchExternalAlertNotifications(
      {
        kind: 'price',
        symbol: 'BTCUSDT',
        targetPrice: 90000,
        actualPrice: 90100,
        condition: 'crossing_up',
      },
      {
        telegramNotificationEnabled: true,
        telegramBotToken: '123456:ABCdefGHIjklMNOpqrsTUVwxyz1234',
        telegramChatId: '123456789',
        discordNotificationEnabled: false,
        discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc',
      },
      mockFetch
    );

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(sentUrls.length, 1);
    assert.ok(sentUrls[0].includes('api.telegram.org'));
  });

  test('6. PineAlertBridge meneruskan event Pine Script ke externalNotificationDispatcher', () => {
    const dispatched: Array<{ kind: string; symbol: string; label?: string }> = [];
    const mockAlertService: any = {
      isSoundEnabled: () => false,
      isSystemNotificationEnabled: () => false,
      getNotificationChannelsConfig: () => ({
        telegramNotificationEnabled: true,
        telegramBotToken: '123456:ABCdefGHIjklMNOpqrsTUVwxyz1234',
        telegramChatId: '123456789',
      }),
      dispatchPineAlert: () => ({}),
    };

    const bridge = new PineAlertBridge({
      alertService: mockAlertService,
      externalNotificationDispatcher: (event) => {
        dispatched.push({ kind: event.kind, symbol: event.symbol, label: event.label });
      },
    });

    bridge.handleAlert({ title: 'EMA Cross', message: 'Golden Cross' }, { symbol: 'ETHUSDT' });

    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].kind, 'pine');
    assert.equal(dispatched[0].symbol, 'ETHUSDT');
    assert.equal(dispatched[0].label, 'Golden Cross');
  });

  test('7. DEFAULT_APP_SETTINGS & resolveAppSettings menjaga kredensial kosong secara default', () => {
    assert.equal(DEFAULT_APP_SETTINGS.telegramNotificationEnabled, false);
    assert.equal(DEFAULT_APP_SETTINGS.telegramBotToken, '');
    assert.equal(DEFAULT_APP_SETTINGS.telegramChatId, '');
    assert.equal(DEFAULT_APP_SETTINGS.discordNotificationEnabled, false);
    assert.equal(DEFAULT_APP_SETTINGS.discordWebhookUrl, '');

    const resolved = resolveAppSettings({
      telegramNotificationEnabled: true,
      telegramBotToken: 'token-x',
      telegramChatId: '123456789',
      discordNotificationEnabled: true,
      discordWebhookUrl: 'https://discord.com/api/webhooks/1/2',
    });

    assert.equal(resolved.telegramNotificationEnabled, true);
    assert.equal(resolved.telegramBotToken, 'token-x');
    assert.equal(resolved.telegramChatId, '123456789');
    assert.equal(resolved.discordNotificationEnabled, true);
    assert.equal(resolved.discordWebhookUrl, 'https://discord.com/api/webhooks/1/2');
  });
});
