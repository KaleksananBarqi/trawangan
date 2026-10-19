import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compareSemver, detectPlatform } from '../src/lib/services/updateService';
import { APP_VERSION } from '../src/lib/config/version';

describe('Update Service & Semver Logic Unit Tests', () => {
  test('APP_VERSION terdefinisi dan cocok dengan format semantic versioning', () => {
    assert.ok(APP_VERSION);
    assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(APP_VERSION, '0.19.0');
  });

  test('compareSemver membandingkan versi dengan benar', () => {
    // Versi sama
    assert.equal(compareSemver('0.3.1', '0.3.1'), 0);
    assert.equal(compareSemver('v0.3.1', '0.3.1'), 0);
    assert.equal(compareSemver('0.3.1', 'v0.3.1'), 0);

    // Versi lebih tinggi
    assert.equal(compareSemver('0.3.2', '0.3.1'), 1);
    assert.equal(compareSemver('0.4.0', '0.3.1'), 1);
    assert.equal(compareSemver('1.0.0', '0.3.1'), 1);
    assert.equal(compareSemver('v0.3.2', 'v0.3.1'), 1);

    // Versi lebih rendah
    assert.equal(compareSemver('0.3.0', '0.3.1'), -1);
    assert.equal(compareSemver('0.1.0', '0.3.1'), -1);
    assert.equal(compareSemver('v0.2.9', 'v0.3.1'), -1);
  });

  test('detectPlatform mengembalikan nilai default yang valid', () => {
    const platform = detectPlatform();
    assert.ok(['windows', 'macos', 'linux'].includes(platform));
  });
});
