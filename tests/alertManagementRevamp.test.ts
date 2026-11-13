import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { alertService } from '../src/lib/services/alertService';
import type { PriceAlert } from '../src/lib/types/market';

describe('Ticket 2: Alert Service Update & Sanitization Seam', () => {
  beforeEach(async () => {
    // Bersihkan alert yang ada
    const all = alertService.getAlerts();
    for (const a of all) {
      await alertService.deleteAlert(a.id);
    }
  });

  it('1. updateAlert memodifikasi targetPrice, condition, frequency, dan label tanpa mengubah ID', async () => {
    const alert = await alertService.addAlert({
      symbol: 'BTCUSDT',
      targetPrice: 65000,
      condition: 'crossing_up',
      frequency: 'once',
      label: 'Target Lama',
    });

    assert.equal(alert.symbol, 'BTCUSDT');
    assert.equal(alert.targetPrice, 65000);

    await alertService.updateAlert(alert.id, {
      targetPrice: 68500.25,
      condition: 'crossing_down',
      frequency: 'every_time',
      label: 'Target Baru Terupdate',
    });

    const updated = alertService.getAlerts().find((a) => a.id === alert.id);
    assert.ok(updated);
    assert.equal(updated.id, alert.id);
    assert.equal(updated.targetPrice, 68500.25);
    assert.equal(updated.condition, 'crossing_down');
    assert.equal(updated.frequency, 'every_time');
    assert.equal(updated.label, 'Target Baru Terupdate');
    assert.equal(updated.active, true);
  });

  it('2. updateAlert secara otomatis menerapkan Tick-Aligned Price Guard pada targetPrice baru', async () => {
    const alert = await alertService.addAlert({
      symbol: 'BTCUSDT',
      targetPrice: 65000,
      condition: 'crossing_up',
    });

    // Perbarui dengan angka float berdesimal panjang acak
    await alertService.updateAlert(alert.id, {
      targetPrice: 68421.391827419,
    });

    const updated = alertService.getAlerts().find((a) => a.id === alert.id);
    assert.ok(updated);
    // Harga >= 1000 secara otomatis dibulatkan ke 2 desimal (0.01)
    assert.equal(updated.targetPrice, 68421.39);
  });

  it('3. Menghapus alert melalui deleteAlert membersihkan entitas dari memori dan notifikasi', async () => {
    const alert = await alertService.addAlert({
      symbol: 'ETHUSDT',
      targetPrice: 3500,
    });

    assert.equal(alertService.getAlerts().length, 1);
    await alertService.deleteAlert(alert.id);
    assert.equal(alertService.getAlerts().length, 0);
  });
});

describe('Hapus Massal Alert: deleteAlertsBySymbol & deleteTriggeredAlerts', () => {
  beforeEach(async () => {
    await alertService.clearAllAlerts();
  });

  it('4. deleteAlertsBySymbol menghapus semua alert simbol yang cocok dan mengembalikan jumlahnya', async () => {
    await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 65000 });
    await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 70000 });
    await alertService.addAlert({ symbol: 'ETHUSDT', targetPrice: 3500 });

    const removed = await alertService.deleteAlertsBySymbol('BTCUSDT');

    assert.equal(removed, 2);
    const remaining = alertService.getAlerts();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].symbol, 'ETHUSDT');
  });

  it('5. deleteAlertsBySymbol mengembalikan 0 jika tidak ada alert cocok untuk simbol tersebut', async () => {
    await alertService.addAlert({ symbol: 'ETHUSDT', targetPrice: 3500 });

    const removed = await alertService.deleteAlertsBySymbol('SOLUSDT');

    assert.equal(removed, 0);
    assert.equal(alertService.getAlerts().length, 1);
  });

  it('6. deleteTriggeredAlerts (tanpa filter simbol) hanya menghapus alert berstatus triggered', async () => {
    // Tambah alert: 2 akan kita picu (triggered), 1 tetap aktif
    await alertService.addAlert({ symbol: 'XLMUSDT', targetPrice: 0.15, condition: 'crossing_up' });
    await alertService.addAlert({ symbol: 'AAVEUSDT', targetPrice: 118, condition: 'crossing_up' });
    await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 69000, condition: 'crossing_up' });

    // Evaluasi harga untuk memicu XLMUSDT dan AAVEUSDT
    alertService.evaluateAlerts('XLMUSDT', 0.14);
    alertService.evaluateAlerts('XLMUSDT', 0.16); // Terpicu crossing_up

    alertService.evaluateAlerts('AAVEUSDT', 115);
    alertService.evaluateAlerts('AAVEUSDT', 120); // Terpicu crossing_up

    // Verifikasi 2 alert berstatus triggered
    const triggeredBefore = alertService.getAlerts().filter((a) => a.triggered);
    assert.equal(triggeredBefore.length, 2);

    // Hapus seluruh riwayat terpicu
    const removed = await alertService.deleteTriggeredAlerts();

    assert.equal(removed, 2);
    const remaining = alertService.getAlerts();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].symbol, 'BTCUSDT');
    assert.equal(remaining[0].triggered, false);
  });

  it('7. deleteTriggeredAlerts dengan filter simbol hanya menghapus riwayat terpicu simbol tersebut', async () => {
    await alertService.addAlert({ symbol: 'XLMUSDT', targetPrice: 0.15, condition: 'crossing_up' });
    await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 69000, condition: 'crossing_up' });

    // Picu keduanya
    alertService.evaluateAlerts('XLMUSDT', 0.14);
    alertService.evaluateAlerts('XLMUSDT', 0.16);
    alertService.evaluateAlerts('BTCUSDT', 68000);
    alertService.evaluateAlerts('BTCUSDT', 70000);

    // Hapus hanya riwayat terpicu milik XLMUSDT
    const removed = await alertService.deleteTriggeredAlerts('XLMUSDT');

    assert.equal(removed, 1);
    const remaining = alertService.getAlerts();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].symbol, 'BTCUSDT');
    assert.equal(remaining[0].triggered, true);
  });

  it('8. clearAllAlerts mengosongkan seluruh daftar alert tanpa terkecuali', async () => {
    await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 65000 });
    await alertService.addAlert({ symbol: 'ETHUSDT', targetPrice: 3500 });
    await alertService.addAlert({ symbol: 'SOLUSDT', targetPrice: 170 });

    assert.equal(alertService.getAlerts().length, 3);

    await alertService.clearAllAlerts();

    assert.equal(alertService.getAlerts().length, 0);
  });
});
