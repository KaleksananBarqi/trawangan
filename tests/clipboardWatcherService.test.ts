import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ClipboardWatcherService } from '../src/lib/services/clipboardWatcherService';

describe('Clipboard Watcher Service Seam Suite', () => {
  test('1. Deteksi URL TradingView yang valid dari clipboard', async () => {
    let detectedTarget: any = null;

    const watcher = new ClipboardWatcherService({
      readClipboard: async () => 'https://www.tradingview.com/chart/?symbol=BINANCE:ARIAUSDT.P',
      onDetected: (target) => {
        detectedTarget = target;
      }
    });

    await watcher.checkClipboard();
    assert.ok(detectedTarget, 'Harus mendeteksi URL TradingView');
    assert.equal(detectedTarget.symbol, 'ARIAUSDT.P');
    assert.equal(detectedTarget.providerId, 'binance');
  });

  test('2. Dedup Guard: Mengabaikan teks yang sama pada pemeriksaan berulang', async () => {
    let callCount = 0;

    const watcher = new ClipboardWatcherService({
      readClipboard: async () => 'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT',
      onDetected: () => {
        callCount++;
      }
    });

    await watcher.checkClipboard();
    assert.equal(callCount, 1);

    // Panggilan kedua dengan konten clipboard yang sama persis
    await watcher.checkClipboard();
    assert.equal(callCount, 1, 'Tidak boleh memicu callback ganda untuk teks clipboard yang identik');
  });

  test('3. Mengabaikan teks sembarang yang bukan URL charting', async () => {
    let triggered = false;

    const watcher = new ClipboardWatcherService({
      readClipboard: async () => 'Halo apa kabar, ini teks biasa bukan chart',
      onDetected: () => {
        triggered = true;
      }
    });

    await watcher.checkClipboard();
    assert.equal(triggered, false);
  });

  test('4. Kontrol Enable / Disable', async () => {
    let triggered = false;

    const watcher = new ClipboardWatcherService({
      readClipboard: async () => 'https://www.tradingview.com/chart/?symbol=BYBIT:SOLUSDT',
      onDetected: () => {
        triggered = true;
      }
    });

    watcher.setEnabled(false);
    await watcher.checkClipboard();
    assert.equal(triggered, false, 'Tidak boleh mendeteksi saat watcher dinonaktifkan');

    watcher.setEnabled(true);
    await watcher.checkClipboard();
    assert.equal(triggered, true, 'Harus mendeteksi setelah diaktifkan kembali');
  });
});
