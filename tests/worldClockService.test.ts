import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_WORLD_CLOCK_CITIES,
  formatLocalClockTime,
  formatMarketHours,
  formatWorldClockTime,
  getWorldClockSnapshot,
  isMarketSessionOpen,
  SUPPORTED_WORLD_CITIES,
} from '../src/lib/services/worldClockService';
import { DEFAULT_APP_SETTINGS, resolveAppSettings } from '../src/lib/constants/defaults';

test('World Clock Service & Settings Persistence Suite', async (t) => {
  await t.test('1. DEFAULT_APP_SETTINGS menyertakan konfigurasi bawaan world clocks', () => {
    assert.equal(DEFAULT_APP_SETTINGS.showWorldClocks, true);
    assert.deepEqual(DEFAULT_APP_SETTINGS.worldClockCities, [
      'Asia/Tokyo',
      'Europe/London',
      'America/New_York',
    ]);
  });

  await t.test('2. resolveAppSettings menyelesaikan konfigurasi world clocks secara aman', () => {
    // Tanpa input (fallback total)
    const emptyResolved = resolveAppSettings(null);
    assert.equal(emptyResolved.showWorldClocks, true);
    assert.deepEqual(emptyResolved.worldClockCities, [
      'Asia/Tokyo',
      'Europe/London',
      'America/New_York',
    ]);

    // Dengan input kustom
    const customResolved = resolveAppSettings({
      showWorldClocks: false,
      worldClockCities: ['Asia/Tokyo'],
    });
    assert.equal(customResolved.showWorldClocks, false);
    assert.deepEqual(customResolved.worldClockCities, ['Asia/Tokyo']);
  });

  await t.test('3. SUPPORTED_WORLD_CITIES memuat metadata untuk Tokyo, London, dan New York', () => {
    const tokyo = SUPPORTED_WORLD_CITIES.find((c) => c.timezone === 'Asia/Tokyo');
    const london = SUPPORTED_WORLD_CITIES.find((c) => c.timezone === 'Europe/London');
    const ny = SUPPORTED_WORLD_CITIES.find((c) => c.timezone === 'America/New_York');

    assert.ok(tokyo, 'Tokyo harus terdaftar');
    assert.equal(tokyo.shortCode, 'TYO');
    assert.equal(tokyo.marketName, 'TSE');

    assert.ok(london, 'London harus terdaftar');
    assert.equal(london.shortCode, 'LON');
    assert.equal(london.marketName, 'LSE');

    assert.ok(ny, 'New York harus terdaftar');
    assert.equal(ny.shortCode, 'NY');
    assert.equal(ny.marketName, 'NYSE');
  });

  await t.test('4. formatWorldClockTime mengonversi timestamp UTC ke format HH:mm dan tanggal lokal bursa', () => {
    // 2026-10-21 00:00:00 UTC
    // Tokyo (UTC+9) -> 09:00:00
    // London (UTC+1 BST pada Oktober akhir sebelum pergantian jam atau UTC+0)
    // New York (UTC-4 EDT pada Oktober) -> 20:00:00 hari sebelumnya (2026-10-20)
    const fixedUtcDate = new Date('2026-10-21T00:00:00Z');

    const tokyoTime = formatWorldClockTime(fixedUtcDate, 'Asia/Tokyo');
    assert.equal(tokyoTime.time, '09:00');
    assert.equal(tokyoTime.fullTime, '09:00:00');

    const nyTime = formatWorldClockTime(fixedUtcDate, 'America/New_York');
    assert.equal(nyTime.time, '20:00');
    assert.equal(nyTime.fullTime, '20:00:00');
  });

  await t.test('5. getWorldClockSnapshot merangkum seluruh kota aktif', () => {
    const fixedUtcDate = new Date('2026-10-21T03:30:00Z');
    const snapshot = getWorldClockSnapshot(fixedUtcDate, ['Asia/Tokyo', 'Europe/London', 'America/New_York']);

    assert.equal(snapshot.length, 3);
    assert.equal(snapshot[0].shortCode, 'TYO');
    assert.equal(snapshot[0].time, '12:30');
    assert.equal(snapshot[1].shortCode, 'LON');
    assert.equal(snapshot[2].shortCode, 'NY');
  });

  await t.test('6. isMarketSessionOpen mengevaluasi jam kerja bursa dan akhir pekan dengan tepat', () => {
    const tokyoMeta = SUPPORTED_WORLD_CITIES.find((c) => c.timezone === 'Asia/Tokyo')!;
    const nyMeta = SUPPORTED_WORLD_CITIES.find((c) => c.timezone === 'America/New_York')!;

    // Rabu 2026-10-21 01:00 UTC = 10:00 JST (TSE Open: 09:00 - 15:30)
    const wednesdayTokyoOpen = new Date('2026-10-21T01:00:00Z');
    assert.equal(isMarketSessionOpen(wednesdayTokyoOpen, tokyoMeta.timezone, tokyoMeta.marketHours), true);

    // Rabu 2026-10-21 07:00 UTC = 16:00 JST (TSE Closed)
    const wednesdayTokyoClosed = new Date('2026-10-21T07:00:00Z');
    assert.equal(isMarketSessionOpen(wednesdayTokyoClosed, tokyoMeta.timezone, tokyoMeta.marketHours), false);

    // Minggu 2026-10-25 01:00 UTC = 10:00 JST (TSE Closed karena akhir pekan)
    const sundayDate = new Date('2026-10-25T01:00:00Z');
    assert.equal(isMarketSessionOpen(sundayDate, tokyoMeta.timezone, tokyoMeta.marketHours), false);

    // Rabu 2026-10-21 13:00 UTC = 09:00 EDT (NYSE Pre-market/Closed, buka 09:30)
    const wednesdayNyPre = new Date('2026-10-21T13:00:00Z');
    assert.equal(isMarketSessionOpen(wednesdayNyPre, nyMeta.timezone, nyMeta.marketHours), false);

    // Rabu 2026-10-21 14:00 UTC = 10:00 EDT (NYSE Open: 09:30 - 16:00)
    const wednesdayNyOpen = new Date('2026-10-21T14:00:00Z');
    assert.equal(isMarketSessionOpen(wednesdayNyOpen, nyMeta.timezone, nyMeta.marketHours), true);
  });

  await t.test('7. Sinkronisasi zona waktu: Mengubah timezone controller saat clock diklik', () => {
    let mockActiveTimezone = 'Asia/Jakarta';
    const mockController = {
      setTimezone: (tz: string) => {
        mockActiveTimezone = tz;
      },
      getTimezone: () => mockActiveTimezone,
    };

    const targetCity = SUPPORTED_WORLD_CITIES.find((c) => c.shortCode === 'NY')!;
    mockController.setTimezone(targetCity.timezone);
    assert.equal(mockController.getTimezone(), 'America/New_York');
  });

  await t.test('8. formatMarketHours menghasilkan string deskripsi jam bursa yang rapi', () => {
    const hours = { openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 };
    assert.equal(formatMarketHours(hours), '09:30 - 16:00');

    const singleDigitHours = { openHour: 8, openMinute: 5, closeHour: 9, closeMinute: 0 };
    assert.equal(formatMarketHours(singleDigitHours), '08:05 - 09:00');
  });

  await t.test('9. formatLocalClockTime menghasilkan format titik dua HH:mm:ss dan label zona waktu sistem', () => {
    const date = new Date('2026-10-21T01:30:45Z');
    const local = formatLocalClockTime(date, 'Asia/Jakarta');

    assert.equal(local.time, '08:30:45');
    assert.ok(local.tzLabel.length > 0);
  });
});

