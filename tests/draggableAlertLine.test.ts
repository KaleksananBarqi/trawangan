import test from 'node:test';
import assert from 'node:assert/strict';
import { alertService } from '../src/lib/services/alertService';
import { priceScaleOverlayController } from '../src/lib/services/priceScaleOverlayController';

test.describe('Draggable Alert Line Seam Suite (#21)', () => {
  test('1. Menghitung dan memperbarui targetPrice saat garis alert digeser', async () => {
    const alert = await alertService.addAlert({
      symbol: 'BTCUSDT',
      targetPrice: 60000,
      condition: 'crossing_up',
    });

    // Simulasi pointer drag: target dipindahkan dari 60000 ke 63500
    const newPrice = 63500;
    await alertService.updateAlert(alert.id, {
      targetPrice: newPrice,
      triggered: false,
      active: true,
    });

    const updated = alertService.getAlerts().find((a) => a.id === alert.id);
    assert.equal(updated?.targetPrice, 63500);
    assert.equal(updated?.active, true);
    assert.equal(updated?.triggered, false);
  });

  test('2. PriceScaleOverlayController memformat harga live saat dragging', () => {
    const formatted = priceScaleOverlayController.formatPrice(63500.5, 'USDT');
    assert.ok(formatted.includes('63,500.5') || formatted.includes('63500'));

    // Presisi token kecil
    const microFormatted = priceScaleOverlayController.formatPrice(0.000452, 'USDT');
    assert.ok(microFormatted.includes('0.000452'));
  });

  test('3. Listener menerima update saat alert digeser', async () => {
    let triggeredChange = false;
    const unsub = alertService.subscribe((list) => {
      if (list.some((a) => a.targetPrice === 72000)) {
        triggeredChange = true;
      }
    });

    const a = await alertService.addAlert({ symbol: 'BTCUSDT', targetPrice: 71000 });
    await alertService.updateAlert(a.id, { targetPrice: 72000 });

    assert.equal(triggeredChange, true);
    unsub();
  });
});
