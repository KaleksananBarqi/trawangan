import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { TelemetryService } from '../src/lib/services/telemetryService';

describe('Deep Real-Time Telemetry Module Unit Tests', () => {
  let telemetry: TelemetryService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    telemetry = new TelemetryService();
  });

  afterEach(() => {
    telemetry.stop();
    global.fetch = originalFetch;
  });

  test('1. Initial State & Subscription: menerima snapshot telemetri awal', () => {
    const snap = telemetry.getSnapshot();
    assert.strictEqual(typeof snap.fps, 'number');
    assert.strictEqual(typeof snap.memoryMb, 'number');
    assert.strictEqual(snap.packetDrops, 0);
    assert.strictEqual(snap.providerName, 'Binance');

    let receivedData: any = null;
    const unsub = telemetry.subscribe((data) => {
      receivedData = data;
    });

    assert.notStrictEqual(receivedData, null);
    assert.strictEqual(receivedData.providerName, 'Binance');

    unsub();
  });

  test('2. Provider Switching: mengubah nama provider target ping secara reaktif', () => {
    let currentProvider = '';
    const unsub = telemetry.subscribe((data) => {
      currentProvider = data.providerName;
    });

    telemetry.setActiveProvider('bitunix');
    assert.strictEqual(currentProvider, 'Bitunix');

    telemetry.setActiveProvider('hyperliquid');
    assert.strictEqual(currentProvider, 'Hyperliquid');

    telemetry.setActiveProvider('custom-dex');
    assert.strictEqual(currentProvider, 'Custom Feed');

    unsub();
  });

  test('3. Network Latency: mengukur RTT saat endpoint merespons dengan sukses', async () => {
    // Mock global fetch sukses
    global.fetch = async () => {
      return new Response(JSON.stringify({}), { status: 200 });
    };

    await telemetry.measurePing();
    const snap = telemetry.getSnapshot();

    assert.strictEqual(snap.isOnline, true);
    assert.notStrictEqual(snap.latencyMs, null);
    assert.strictEqual(typeof snap.latencyMs, 'number');
    assert.ok((snap.latencyMs as number) >= 0);
  });

  test('4. Packet Drop & Offline Detection: menangani kegagalan jaringan atau timeout', async () => {
    // Mock global fetch melempar network exception
    global.fetch = async () => {
      throw new Error('Network Connection Aborted / Timeout');
    };

    const initialDrops = telemetry.getSnapshot().packetDrops;
    await telemetry.measurePing();
    const snap = telemetry.getSnapshot();

    assert.strictEqual(snap.isOnline, false);
    assert.strictEqual(snap.latencyMs, null);
    assert.strictEqual(snap.packetDrops, initialDrops + 1);
  });

  test('5. Memory Measurement: membaca heap atau memori proses secara stabil', async () => {
    await telemetry.measureMemory();
    const snap = telemetry.getSnapshot();

    assert.ok(snap.memoryMb > 0);
    assert.strictEqual(typeof snap.memoryMb, 'number');
  });

  test('6. Unsubscribe Lifecycle: subscriber yang berhenti tidak lagi menerima event', () => {
    let callCount = 0;
    const unsub = telemetry.subscribe(() => {
      callCount++;
    });

    assert.strictEqual(callCount, 1); // Emisi awal saat subscribe

    telemetry.setActiveProvider('bitunix');
    assert.strictEqual(callCount, 2);

    unsub();

    telemetry.setActiveProvider('binance');
    assert.strictEqual(callCount, 2); // Tidak bertambah setelah unsubscribe
  });
});
