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
