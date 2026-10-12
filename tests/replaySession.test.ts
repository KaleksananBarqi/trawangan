// Unit Tests Modul Deep Replay Session Trawangan
import test from 'node:test';
import assert from 'node:assert/strict';
import { ReplaySession, MockReplayDriver, type ReplaySnapshot } from '../src/lib/services/replay';

test('Deep Replay Session Module Unit Tests', async (t) => {
  await t.test('1. Initial State: sesi replay dimulai dalam keadaan idle tanpa subscriber aktif', () => {
    const session = new ReplaySession();
    const snap = session.getSnapshot();

    assert.equal(snap.active, false);
    assert.equal(snap.status, 'idle');
    assert.equal(snap.isPlaying, false);
    assert.equal(snap.isSelectingBar, false);
    assert.equal(snap.playbackSpeed, 1);
    assert.equal(snap.cutoffTime, null);
    assert.equal(snap.cursorTime, null);
    assert.equal(snap.remainingBars, 0);
    assert.equal(snap.bounds, null);
  });

  await t.test('2. Lifecycle open & cancel selection: mengaktifkan mode pemilihan bar & memicu driver seam', () => {
    const session = new ReplaySession();
    const mockDriver = new MockReplayDriver();
    session.bindDriver(mockDriver);

    session.open();
    let snap = session.getSnapshot();
    assert.equal(snap.active, true);
    assert.equal(snap.status, 'selecting_cutoff');
    assert.equal(snap.isSelectingBar, true);
    assert.equal(mockDriver.isVisualActive(), true);
    assert.ok(snap.bounds !== null);

    session.cancelBarSelection();
    snap = session.getSnapshot();
    assert.equal(snap.isSelectingBar, false);
    assert.equal(snap.status, 'idle');
    assert.equal(mockDriver.isVisualActive(), false);
  });

  await t.test('3. setCutoff: menetapkan titik potong lilin dan memperbarui remaining bars via driver', async () => {
    const timestamps = [1000, 2000, 3000, 4000, 5000];
    const mockDriver = new MockReplayDriver(timestamps);
    const session = new ReplaySession();
    session.bindDriver(mockDriver);

    session.open();
    const ok = await session.setCutoff(3000);
    assert.equal(ok, true);

    const snap = session.getSnapshot();
    assert.equal(snap.status, 'ready');
    assert.equal(snap.isSelectingBar, false);
    assert.equal(snap.cutoffTime, 3000);
    assert.equal(snap.cursorTime, 3000);
    // Index 2 dari 5 lilin (1000, 2000, 3000, 4000, 5000), sisa 2 lilin (4000 & 5000)
    assert.equal(snap.remainingBars, 2);
  });

  await t.test('4. Playback controls & step: memutar, jeda, mengatur kecepatan, dan step forward hingga selesai', async () => {
    const timestamps = [1000, 2000, 3000, 4000];
    const mockDriver = new MockReplayDriver(timestamps);
    const session = new ReplaySession();
    session.bindDriver(mockDriver);

    await session.setCutoff(2000);
    assert.equal(session.getSnapshot().remainingBars, 2);

    // Play & Pause
    session.play(3);
    assert.equal(session.getSnapshot().isPlaying, true);
    assert.equal(session.getSnapshot().status, 'playing');
    assert.equal(session.getSnapshot().playbackSpeed, 3);

    session.pause();
    assert.equal(session.getSnapshot().isPlaying, false);
    assert.equal(session.getSnapshot().status, 'paused');

    // Step 1 bar (dari 2000 ke 3000, sisa 1)
    session.step();
    assert.equal(session.getSnapshot().cursorTime, 3000);
    assert.equal(session.getSnapshot().remainingBars, 1);

    // Step 1 bar lagi (dari 3000 ke 4000, sisa 0 -> ended)
    session.step();
    assert.equal(session.getSnapshot().cursorTime, 4000);
    assert.equal(session.getSnapshot().remainingBars, 0);
    assert.equal(session.getSnapshot().status, 'ended');
    assert.equal(session.getSnapshot().isPlaying, false);

    // Step Back 1 bar mundur (dari 4000 kembali ke 3000, sisa 1 -> status ready/paused)
    session.stepBack();
    assert.equal(session.getSnapshot().cursorTime, 3000);
    assert.equal(session.getSnapshot().remainingBars, 1);
    assert.equal(session.getSnapshot().status, 'paused');

    // Step Back 1 bar mundur lagi (dari 3000 kembali ke 2000, sisa 2)
    session.stepBack();
    assert.equal(session.getSnapshot().cursorTime, 2000);
    assert.equal(session.getSnapshot().remainingBars, 2);

    // Play lalu Step Back: otomatis jeda playback
    session.play();
    assert.equal(session.getSnapshot().isPlaying, true);
    session.stepBack();
    assert.equal(session.getSnapshot().isPlaying, false);
    assert.equal(session.getSnapshot().cursorTime, 1000);
    assert.equal(session.getSnapshot().remainingBars, 3);

    // Rewind kembali ke 2000
    await session.rewind();
    assert.equal(session.getSnapshot().cursorTime, 2000);
    assert.equal(session.getSnapshot().remainingBars, 2);
    assert.equal(session.getSnapshot().status, 'ready');
  });

  await t.test('5. Close and Subscription cleanup: membersihkan state dan memanggil listener', () => {
    const session = new ReplaySession();
    const snapshots: ReplaySnapshot[] = [];

    const unsubscribe = session.subscribe((s) => {
      snapshots.push(s);
    });

    session.open();
    session.play();
    session.close();

    unsubscribe();
    session.open(); // Tidak boleh masuk ke snapshots karena sudah unsubscribe

    assert.ok(snapshots.length >= 4);
    const finalLogged = snapshots[snapshots.length - 1];
    assert.equal(finalLogged.active, false);
    assert.equal(finalLogged.status, 'idle');
  });
});
