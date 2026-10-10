import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('Pine IDE Side Panel Revamp & Circular Reactivity Prevention', () => {
  test('Width Clamping: Lebar Side Panel harus dibatasi dalam rentang aman [340px, 850px]', () => {
    function clampPinePanelWidth(targetWidth: number, windowWidth = 1920): number {
      const maxWidth = Math.min(850, windowWidth * 0.65);
      return Math.max(340, Math.min(maxWidth, targetWidth));
    }

    assert.strictEqual(clampPinePanelWidth(200), 340, 'Tidak boleh lebih kecil dari 340px');
    assert.strictEqual(clampPinePanelWidth(500), 500, 'Ukuran ideal 500px harus dipertahankan');
    assert.strictEqual(clampPinePanelWidth(1200), 850, 'Tidak boleh melebihi batas 850px pada layar lebar');
    assert.strictEqual(clampPinePanelWidth(800, 1000), 650, 'Pada layar 1000px, batas maksimal adalah 65% (650px)');
  });

  test('Reactivity Guard: Normalisasi simbol dan timeframe mencegah feedback loop berulang', () => {
    let parentUpdateCount = 0;
    const currentActive = { symbol: 'BTCUSDT', timeframe: '15m' };

    function onCellActive(rawSym: string, tf: string) {
      const cleanSym = rawSym.includes(':') ? rawSym.split(':')[1] : rawSym;
      // Guard circular loop: hanya trigger parent jika ada perbedaan nyata
      if (cleanSym !== currentActive.symbol || tf !== currentActive.timeframe) {
        parentUpdateCount++;
        currentActive.symbol = cleanSym;
        currentActive.timeframe = tf;
      }
    }

    // Simulasi event native Vela yang berulang saat cell focus atau layout set
    onCellActive('binance:BTCUSDT', '15m');
    assert.strictEqual(parentUpdateCount, 0, 'Event dengan simbol dan timeframe identik tidak boleh memicu mutasi parent');

    onCellActive('BTCUSDT', '15m');
    assert.strictEqual(parentUpdateCount, 0, 'Format tanpa prefix yang sama juga harus di-guard');

    // Ketika user benar-benar berganti ke pair lain
    onCellActive('binance:ETHUSDT', '1h');
    assert.strictEqual(parentUpdateCount, 1, 'Pergantian pair nyata harus diproses');
    assert.strictEqual(currentActive.symbol, 'ETHUSDT');
    assert.strictEqual(currentActive.timeframe, '1h');

    // Event duplikat berikutnya harus langsung diabaikan
    onCellActive('binance:ETHUSDT', '1h');
    assert.strictEqual(parentUpdateCount, 1, 'Tidak boleh ada update berulang');
  });

  test('Coexistence State: Mode Pine IDE dan Watchlist bersifat mutually exclusive', () => {
    type WorkspaceMode = 'terminal' | 'pine';

    function getVisibleRightPanel(workspaceMode: WorkspaceMode, isWatchlistOpen: boolean): 'pine' | 'watchlist' | 'none' {
      if (workspaceMode === 'pine') {
        return 'pine';
      }
      return isWatchlistOpen ? 'watchlist' : 'none';
    }

    assert.strictEqual(getVisibleRightPanel('pine', true), 'pine', 'Saat Pine IDE aktif, panel kanan menampilkan Pine Editor');
    assert.strictEqual(getVisibleRightPanel('terminal', true), 'watchlist', 'Saat terminal aktif dan watchlist terbuka, tampilkan watchlist');
    assert.strictEqual(getVisibleRightPanel('terminal', false), 'none', 'Saat terminal aktif dan watchlist tertutup, tidak ada panel kanan');
  });
});
