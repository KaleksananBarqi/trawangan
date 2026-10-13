import test from 'node:test';
import assert from 'node:assert/strict';
import { alertService } from '../src/lib/services/alertService';
import type { PriceAlert } from '../src/lib/types/market';

test.describe('Alert Service & In-Place Editing Seam Suite (#20)', () => {
  test('1. Menambahkan alert baru dan memverifikasi atribut inisialisasi', async () => {
    const alert = await alertService.addAlert({
      symbol: 'BTCUSDT',
      targetPrice: 65000,
      condition: 'crossing_up',
      frequency: 'once',
      label: 'Resistance Test',
    });

    assert.ok(alert.id);
    assert.equal(alert.symbol, 'BTCUSDT');
    assert.equal(alert.targetPrice, 65000);
    assert.equal(alert.condition, 'crossing_up');
    assert.equal(alert.frequency, 'once');
    assert.equal(alert.active, true);
    assert.equal(alert.triggered, false);

    const found = alertService.getAlerts().find((a) => a.id === alert.id);
    assert.ok(found);
    assert.equal(found.targetPrice, 65000);
  });

  test('2. In-Place Edit Alert: update targetPrice, condition, frequency, dan label', async () => {
    const original = await alertService.addAlert({
      symbol: 'ETHUSDT',
      targetPrice: 3200,
      condition: 'crossing_up',
      frequency: 'once',
      label: 'Target Lama',
    });

    // Simulasi alert terpicu
    await alertService.updateAlert(original.id, { triggered: true, active: false });
    let current = alertService.getAlerts().find((a) => a.id === original.id);
    assert.equal(current?.triggered, true);

    // Lakukan edit in-place: ganti harga, ubah label, dan aktifkan kembali
    await alertService.updateAlert(original.id, {
      targetPrice: 3450,
      condition: 'crossing_down',
      frequency: 'every_time',
      label: 'Target Baru',
      triggered: false,
      active: true,
    });

    const updated = alertService.getAlerts().find((a) => a.id === original.id);
    assert.ok(updated);
    assert.equal(updated.targetPrice, 3450);
    assert.equal(updated.condition, 'crossing_down');
    assert.equal(updated.frequency, 'every_time');
    assert.equal(updated.label, 'Target Baru');
    assert.equal(updated.triggered, false);
    assert.equal(updated.active, true);
  });

  test('3. Reset Triggered Alert mengembalikan status aktif', async () => {
    const alert = await alertService.addAlert({
      symbol: 'SOLUSDT',
      targetPrice: 150,
      condition: 'crossing_up',
      frequency: 'once',
    });

    await alertService.updateAlert(alert.id, { triggered: true, active: false });
    await alertService.resetTriggeredAlert(alert.id);

    const resetAlert = alertService.getAlerts().find((a) => a.id === alert.id);
    assert.equal(resetAlert?.active, true);
    assert.equal(resetAlert?.triggered, false);
  });

  test('4. Hapus alert membersihkan dari daftar tersimpan', async () => {
    const alert = await alertService.addAlert({
      symbol: 'ADAUSDT',
      targetPrice: 0.5,
      condition: 'crossing',
    });

    assert.ok(alertService.getAlerts().some((a) => a.id === alert.id));
    await alertService.deleteAlert(alert.id);
    assert.ok(!alertService.getAlerts().some((a) => a.id === alert.id));
  });
});
