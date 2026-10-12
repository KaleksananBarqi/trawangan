import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { rightDockService } from '../src/lib/services/rightDockService';

describe('Right Dock Service Seam Suite (TradingView Dock Rail Parity)', () => {
  beforeEach(() => {
    // Reset state ke kondisi awal
    rightDockService.resetState();
  });

  it('1. Initial State: rel kanan terbuka secara default pada tab watchlist', () => {
    const snap = rightDockService.getSnapshot();
    assert.strictEqual(snap.isOpen, true);
    assert.strictEqual(snap.activeTab, 'watchlist');
    assert.strictEqual(snap.lastOpenedTab, 'watchlist');
  });

  it('2. 1-Klik Switch Tab: mengklik tab lain saat panel terbuka langsung mengganti tab tanpa menutup drawer', () => {
    rightDockService.toggleTab('alerts');
    let snap = rightDockService.getSnapshot();
    assert.strictEqual(snap.isOpen, true);
    assert.strictEqual(snap.activeTab, 'alerts');
    assert.strictEqual(snap.lastOpenedTab, 'alerts');

    rightDockService.toggleTab('objects');
    snap = rightDockService.getSnapshot();
    assert.strictEqual(snap.isOpen, true);
    assert.strictEqual(snap.activeTab, 'objects');
    assert.strictEqual(snap.lastOpenedTab, 'objects');
  });

  it('3. Click-to-Close: mengklik tab yang sedang aktif otomatis melipat (collapse) drawer ke 0px', () => {
    // Saat ini di watchlist dan terbuka
    assert.strictEqual(rightDockService.getSnapshot().isOpen, true);
    assert.strictEqual(rightDockService.getSnapshot().activeTab, 'watchlist');

    // Klik lagi tab watchlist
    rightDockService.toggleTab('watchlist');
    const snap = rightDockService.getSnapshot();
    assert.strictEqual(snap.isOpen, false);
    assert.strictEqual(snap.activeTab, null);
    // lastOpenedTab tetap mengingat watchlist agar bisa dibuka kembali
    assert.strictEqual(snap.lastOpenedTab, 'watchlist');
  });

  it('4. Re-Open dari kondisi tertutup: mengklik tab apapun membuka drawer langsung ke tab tersebut', () => {
    // Tutup panel terlebih dahulu
    rightDockService.close();
    assert.strictEqual(rightDockService.getSnapshot().isOpen, false);

    // Klik alerts
    rightDockService.toggleTab('alerts');
    const snap = rightDockService.getSnapshot();
    assert.strictEqual(snap.isOpen, true);
    assert.strictEqual(snap.activeTab, 'alerts');
    assert.strictEqual(snap.lastOpenedTab, 'alerts');
  });

  it('5. Hider Chevron Toggle: membuka dan menutup drawer berdasarkan tab terakhir yang aktif', () => {
    // Set tab ke objects lalu tutup
    rightDockService.toggleTab('objects');
    rightDockService.toggleHider();
    let snap = rightDockService.getSnapshot();
    assert.strictEqual(snap.isOpen, false);
    assert.strictEqual(snap.lastOpenedTab, 'objects');

    // Klik hider lagi untuk membuka kembali tab objects
    rightDockService.toggleHider();
    snap = rightDockService.getSnapshot();
    assert.strictEqual(snap.isOpen, true);
    assert.strictEqual(snap.activeTab, 'objects');
  });

  it('6. Subscription Lifecycle: listener menerima snapshot baru setiap kali state berubah', () => {
    let callCount = 0;
    let latestSnap = rightDockService.getSnapshot();

    const unsub = rightDockService.subscribe((s) => {
      callCount++;
      latestSnap = s;
    });

    rightDockService.toggleTab('alerts');
    assert.strictEqual(callCount, 1);
    assert.strictEqual(latestSnap.activeTab, 'alerts');

    rightDockService.close();
    assert.strictEqual(callCount, 2);
    assert.strictEqual(latestSnap.isOpen, false);

    unsub();
    rightDockService.toggleTab('watchlist');
    // callCount tidak bertambah setelah unsubscribe
    assert.strictEqual(callCount, 2);
  });

  it('7. Canonical Sole Control: Rel kanan mengelola siklus buka-tutup mandiri tanpa dependensi tombol header atas', () => {
    // Memastikan aksi panel hanya berpusat pada rel kanan
    rightDockService.openTab('alerts');
    assert.strictEqual(rightDockService.getSnapshot().isOpen, true);
    assert.strictEqual(rightDockService.getSnapshot().activeTab, 'alerts');

    // Tutup melalui toggle tab yang sama
    rightDockService.toggleTab('alerts');
    assert.strictEqual(rightDockService.getSnapshot().isOpen, false);
    assert.strictEqual(rightDockService.getSnapshot().activeTab, null);
    assert.strictEqual(rightDockService.getSnapshot().lastOpenedTab, 'alerts');

    // Buka kembali melalui hider
    rightDockService.toggleHider();
    assert.strictEqual(rightDockService.getSnapshot().isOpen, true);
    assert.strictEqual(rightDockService.getSnapshot().activeTab, 'alerts');
  });

  it('8. Rapid Multi-Tab Toggle: Transisi cepat antar tab mempertahankan integritas state', () => {
    const tabs = ['watchlist', 'alerts', 'objects', 'watchlist', 'objects'] as const;
    for (const t of tabs) {
      rightDockService.openTab(t);
      const snap = rightDockService.getSnapshot();
      assert.strictEqual(snap.isOpen, true);
      assert.strictEqual(snap.activeTab, t);
      assert.strictEqual(snap.lastOpenedTab, t);
    }
  });
});
