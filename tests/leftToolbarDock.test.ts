import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { leftToolbarService } from '../src/lib/services/leftToolbarService';

const memoryStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      memoryStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete memoryStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(memoryStorage)) delete memoryStorage[k];
    },
  };
}

describe('Left Toolbar Dock Service Seam Suite (Docked Left Rail & Alt+T)', () => {
  beforeEach(() => {
    // Reset state ke kondisi awal
    leftToolbarService.resetState();
    localStorage.clear();
  });

  it('1. Initial State: rel gambar kiri terbuka (isCollapsed = false) secara default', () => {
    const snap = leftToolbarService.getSnapshot();
    assert.strictEqual(snap.isCollapsed, false);
  });

  it('2. toggleCollapse: membalik status isCollapsed dan menyimpan ke localStorage', () => {
    leftToolbarService.toggleCollapse();
    assert.strictEqual(leftToolbarService.getSnapshot().isCollapsed, true);
    assert.strictEqual(localStorage.getItem('trawangan_left_rail_collapsed'), 'true');

    leftToolbarService.toggleCollapse();
    assert.strictEqual(leftToolbarService.getSnapshot().isCollapsed, false);
    assert.strictEqual(localStorage.getItem('trawangan_left_rail_collapsed'), 'false');
  });

  it('3. setCollapsed: menetapkan status collapse secara deterministik', () => {
    leftToolbarService.setCollapsed(true);
    assert.strictEqual(leftToolbarService.getSnapshot().isCollapsed, true);

    leftToolbarService.setCollapsed(false);
    assert.strictEqual(leftToolbarService.getSnapshot().isCollapsed, false);
  });

  it('4. Shortcut Keyboard Alt+T: otomatis mentrigger toggleCollapse saat Alt+T ditekan', () => {
    let preventDefaultCalled = false;
    const eventAltT = {
      altKey: true,
      key: 't',
      preventDefault: () => {
        preventDefaultCalled = true;
      },
    } as unknown as KeyboardEvent;

    const handled = leftToolbarService.handleKeydown(eventAltT);
    assert.strictEqual(handled, true);
    assert.strictEqual(preventDefaultCalled, true);
    assert.strictEqual(leftToolbarService.getSnapshot().isCollapsed, true);

    // Tekan Alt+T lagi
    leftToolbarService.handleKeydown(eventAltT);
    assert.strictEqual(leftToolbarService.getSnapshot().isCollapsed, false);
  });

  it('5. Event Keyboard Lain: tidak mentrigger perubahan bila bukan Alt+T', () => {
    let preventDefaultCalled = false;
    const eventCtrlT = {
      ctrlKey: true,
      key: 't',
      preventDefault: () => {
        preventDefaultCalled = true;
      },
    } as unknown as KeyboardEvent;

    const handled = leftToolbarService.handleKeydown(eventCtrlT);
    assert.strictEqual(handled, false);
    assert.strictEqual(preventDefaultCalled, false);
    assert.strictEqual(leftToolbarService.getSnapshot().isCollapsed, false);
  });

  it('6. Subscription Lifecycle: listener menerima snapshot saat status collapse berubah', () => {
    let callCount = 0;
    let latestSnap = leftToolbarService.getSnapshot();

    const unsub = leftToolbarService.subscribe((s) => {
      callCount++;
      latestSnap = s;
    });

    leftToolbarService.toggleCollapse();
    assert.strictEqual(callCount, 1);
    assert.strictEqual(latestSnap.isCollapsed, true);

    unsub();
    leftToolbarService.toggleCollapse();
    assert.strictEqual(callCount, 1);
  });
});
