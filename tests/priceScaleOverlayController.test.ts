// Unit Tests untuk PriceScaleOverlayController
import test from 'node:test';
import assert from 'node:assert/strict';
import { PriceScaleOverlayController } from '../src/lib/services/priceScaleOverlayController';
import type { PriceAlert } from '../src/lib/types/market';

test('PriceScaleOverlayController Deep Module Suite', async (t) => {
  await t.test('1. formatPrice memformat harga kripto dengan mikro-presisi yang tepat', () => {
    const controller = new PriceScaleOverlayController();

    // Harga null / NaN
    assert.equal(controller.formatPrice(null), '--');
    assert.equal(controller.formatPrice(NaN), '--');

    // Harga besar >= 1000
    assert.equal(controller.formatPrice(65432.1), '65,432.10');

    // Harga menengah >= 1
    assert.equal(controller.formatPrice(2.45), '2.4500');

    // Mikro-presisi < 1
    assert.equal(controller.formatPrice(0.000123), '0.000123');
    assert.equal(controller.formatPrice(0.000005), '0.000005');
  });

  await t.test('2. priceToY menghitung koordinat Y dan menyaring harga di luar viewport', () => {
    const controller = new PriceScaleOverlayController();

    // Mock chart container dan pane coords
    const mockContainer = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
    };

    const mockCoords = {
      priceToY: (price: number, _scale: any, _bounds: any) => {
        // Linear mapping contoh: harga 100 -> y=200, harga 500 -> y=-100 (di luar layar)
        return 600 - price * 4;
      }
    };

    const mockChart = {
      renderer: {
        renderer: {
          coords: mockCoords,
          pricePane: {
            scale: {},
            bounds: { top: 0, height: 600 }
          }
        }
      }
    };

    const mockWorkspace = {
      active: { chart: mockChart }
    };

    controller.attachChart(mockContainer as any, mockWorkspace as any);

    // Harga 100 -> y = 600 - 400 = 200 (di dalam viewport 0..600)
    assert.equal(controller.getPriceY(100), 200);

    // Harga 200 -> y = 600 - 800 = -200 (di luar viewport atas -> harus null)
    assert.equal(controller.getPriceY(200), null);

    // Harga -50 -> y = 600 - (-200) = 800 (di luar viewport bawah -> harus null)
    assert.equal(controller.getPriceY(-50), null);
  });

  await t.test('3. updateAlerts menghasilkan pemetaan posisi Y alert untuk simbol yang cocok', () => {
    const controller = new PriceScaleOverlayController();

    const mockCoords = {
      priceToY: (price: number) => price * 2
    };

    const mockChart = {
      renderer: {
        renderer: {
          coords: mockCoords,
          pricePane: {
            scale: {},
            bounds: { top: 0, height: 1000 }
          }
        }
      }
    };

    controller.attachChart(
      { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 1000 }) } as any,
      { active: { chart: mockChart } } as any
    );

    const alerts: PriceAlert[] = [
      { id: 'a1', symbol: 'BTCUSDT', targetPrice: 150, condition: 'crossing', frequency: 'once', label: 'Alert 1', active: true, triggered: false, createdAt: 1 },
      { id: 'a2', symbol: 'BTCUSDT.P', targetPrice: 200, condition: 'crossing', frequency: 'once', label: 'Alert 2', active: true, triggered: false, createdAt: 2 },
      { id: 'a3', symbol: 'ETHUSDT', targetPrice: 50, condition: 'crossing', frequency: 'once', label: 'Alert 3', active: true, triggered: false, createdAt: 3 }
    ];

    controller.updateAlerts(alerts, 'BTCUSDT');

    const positions = controller.getSnapshot().alertYPositions;
    assert.equal(positions['a1'], 300);
    assert.equal(positions['a2'], 400);
    assert.equal(positions['a3'], undefined); // Berbeda simbol
  });

  await t.test('4. Subscriptions menerima snapshot posisi saat terjadi update data', () => {
    const controller = new PriceScaleOverlayController();
    let notifyCount = 0;

    const unsub = controller.subscribe(() => {
      notifyCount++;
    });

    controller.updateAlerts([], 'BTCUSDT');
    assert.ok(notifyCount >= 1);

    unsub();
  });
});
