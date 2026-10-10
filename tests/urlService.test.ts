import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { openExternalUrl } from '../src/lib/services/urlService';

describe('URL Service Unit Tests', () => {
  test('Menangani pemanggilan URL kosong tanpa melempar exception', async () => {
    await assert.doesNotReject(async () => {
      await openExternalUrl('');
    });
  });

  test('Fallback ke window.open jika di lingkungan browser web', async () => {
    let openedUrl = '';
    let targetParam = '';
    let featuresParam = '';

    // Mock window.open di lingkungan Node/test
    (globalThis as any).window = {
      open: (url: string, target?: string, features?: string) => {
        openedUrl = url;
        targetParam = target || '';
        featuresParam = features || '';
        return null;
      }
    };

    const targetUrl = 'https://saweria.co/arthex1204';
    await openExternalUrl(targetUrl);

    assert.equal(openedUrl, targetUrl);
    assert.equal(targetParam, '_blank');
    assert.equal(featuresParam, 'noopener,noreferrer');

    // Bersihkan mock
    delete (globalThis as any).window;
  });
});
