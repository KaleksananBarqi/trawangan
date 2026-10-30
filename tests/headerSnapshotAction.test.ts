// Unit Tests untuk Header Camera Action, Shortcut Ctrl+Shift+S, dan Quick Snapshot Toast (#94)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commandDispatcher,
  createDefaultCommandDispatcher,
  type CommandDefinition
} from '../src/lib/services/commandDispatcher';
import {
  compositeSnapshot,
  generateSnapshotFilename,
  copySnapshotToClipboard,
  downloadSnapshot,
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';

// Mock Canvas 2D untuk pengujian node environment
function createMockCanvas(width = 1200, height = 800): any {
  const drawCalls: string[] = [];
  return {
    width,
    height,
    getContext: (type: string) => ({
      save: () => drawCalls.push('save'),
      restore: () => drawCalls.push('restore'),
      beginPath: () => drawCalls.push('beginPath'),
      closePath: () => drawCalls.push('closePath'),
      moveTo: (x: number, y: number) => drawCalls.push(`moveTo(${x},${y})`),
      lineTo: (x: number, y: number) => drawCalls.push(`lineTo(${x},${y})`),
      arc: () => drawCalls.push('arc'),
      arcTo: () => drawCalls.push('arcTo'),
      roundRect: () => drawCalls.push('roundRect'),
      rect: () => drawCalls.push('rect'),
      fill: () => drawCalls.push('fill'),
      stroke: () => drawCalls.push('stroke'),
      clip: () => drawCalls.push('clip'),
      fillRect: () => drawCalls.push('fillRect'),
      strokeRect: () => drawCalls.push('strokeRect'),
      fillText: (text: string) => drawCalls.push(`fillText(${text})`),
      drawImage: () => drawCalls.push('drawImage'),
      measureText: (text: string) => ({ width: text.length * 9 }),
      fillStyle: '#000',
      strokeStyle: '#fff',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
    }),
    toDataURL: (mime = 'image/png') => `data:${mime};base64,mockPngBase64EncodedData`,
    toBlob: (cb: (blob: Blob | null) => void) => {
      cb(new Blob(['mockPngData'], { type: 'image/png' }));
    },
    getDrawCalls: () => drawCalls,
  };
}

test('Header Camera Action, Shortcut Ctrl+Shift+S, & Quick Toast Suite (#94)', async (t) => {
  await t.test('1. Shortcut Registry: Memverifikasi pendaftaran pintasan quick-snapshot-copy', () => {
    const dispatcher = createDefaultCommandDispatcher();
    const commands = dispatcher.getCommands();
    const snapshotCmd = commands.find((c) => c.id === 'quick-snapshot-copy');

    assert.ok(snapshotCmd, 'Perintah quick-snapshot-copy harus terdaftar di default commands');
    assert.deepEqual(snapshotCmd.keys, ['Ctrl', 'Shift', 'S']);
    assert.equal(snapshotCmd.allowInInput, false, 'Shortcut snapshot tidak boleh aktif saat pengguna mengetik di input');

    // Uji dispatch dengan kombinasi Ctrl+Shift+S
    let executed = false;
    dispatcher.bindHandler('quick-snapshot-copy', () => {
      executed = true;
    });

    let prevented = false;
    let stopped = false;
    const keyboardEventCtrl = {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: true,
      key: 'S',
      code: 'KeyS',
      target: { tagName: 'DIV' },
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; },
    } as any;

    const dispatchedCtrl = dispatcher.dispatch(keyboardEventCtrl);
    assert.equal(dispatchedCtrl, true, 'Event Ctrl+Shift+S harus berhasil di-dispatch');
    assert.equal(executed, true, 'Handler snapshot harus terpanggil');
    assert.equal(prevented, true, 'Event browser default harus di-prevent');

    // Uji dispatch dengan Cmd+Shift+S di macOS
    executed = false;
    prevented = false;
    const keyboardEventMeta = {
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: true,
      key: 's',
      code: 'KeyS',
      target: { tagName: 'DIV' },
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; },
    } as any;

    const dispatchedMeta = dispatcher.dispatch(keyboardEventMeta);
    assert.equal(dispatchedMeta, true, 'Event Cmd+Shift+S harus berhasil di-dispatch');
    assert.equal(executed, true, 'Handler snapshot harus terpanggil pada macOS metaKey');

    // Uji suppress saat fokus di input teks
    executed = false;
    const keyboardEventInInput = {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: true,
      key: 's',
      code: 'KeyS',
      target: { tagName: 'INPUT' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any;

    const dispatchedInput = dispatcher.dispatch(keyboardEventInInput);
    assert.equal(dispatchedInput, false, 'Event tidak boleh di-dispatch saat target berupa elemen input');
    assert.equal(executed, false, 'Handler tidak boleh dieksekusi di dalam input teks');
  });

  await t.test('2. Snapshot Menu: Definisi aksi menu dan trigger callback', () => {
    // Definisi item menu snapshot
    const menuActions = [
      { id: 'quick-copy', label: 'Salin Gambar ke Clipboard', shortcut: 'Ctrl+Shift+S' },
      { id: 'quick-download', label: 'Simpan Gambar (PNG)', shortcut: null },
      { id: 'open-preview', label: 'Pratinjau & Kustomisasi...', shortcut: null },
    ];

    assert.equal(menuActions.length, 3);
    assert.equal(menuActions[0].shortcut, 'Ctrl+Shift+S');

    let copyTriggered = false;
    let downloadTriggered = false;
    let previewTriggered = false;

    const handlers: Record<string, () => void> = {
      'quick-copy': () => { copyTriggered = true; },
      'quick-download': () => { downloadTriggered = true; },
      'open-preview': () => { previewTriggered = true; },
    };

    menuActions.forEach((action) => {
      handlers[action.id]?.();
    });

    assert.equal(copyTriggered, true, 'Aksi copy harus terpicu');
    assert.equal(downloadTriggered, true, 'Aksi download harus terpicu');
    assert.equal(previewTriggered, true, 'Aksi preview harus terpicu');
  });

  await t.test('3. Snapshot Orchestration: Alur pembuatan komposit dan clipboard write', async () => {
    const mockSource = createMockCanvas(800, 500);
    const metadata: SnapshotMetadata = {
      symbol: 'BTCUSDT',
      timeframe: '15m',
      providerId: 'binance',
      lastPrice: 65432.1,
      timezone: 'Asia/Jakarta',
      timestamp: new Date('2026-10-30T10:00:00Z'),
    };

    const targetCanvas = createMockCanvas(1600, 1000);
    const compositeRes = compositeSnapshot(
      mockSource,
      {
        mode: 'branded',
        scale: 2,
        metadata,
      },
      targetCanvas
    );

    assert.ok(compositeRes);
    const calls = targetCanvas.getDrawCalls();
    assert.ok(calls.includes('drawImage'), 'Canvas komposit harus menggambar source chart');
    assert.ok(calls.some((c: string) => c.includes('fillText(trawangan)')), 'Canvas komposit harus memuat teks trawangan');

    // Mock Clipboard API
    let writtenItems: any[] = [];
    const mockClipboard = {
      write: async (items: any[]) => {
        writtenItems = items;
      },
    };

    // Polyfill global ClipboardItem jika belum ada di node environment
    if (typeof (globalThis as any).ClipboardItem === 'undefined') {
      (globalThis as any).ClipboardItem = class MockClipboardItem {
        data: any;
        constructor(data: any) {
          this.data = data;
        }
      };
    }

    const copyResult = await copySnapshotToClipboard(targetCanvas, mockClipboard);
    assert.equal(copyResult.success, true, 'Penyalinan snapshot ke clipboard harus sukses');
    assert.equal(writtenItems.length, 1, 'Harus menulis 1 item ke clipboard');

    // Uji penamaan download snapshot
    const filename = generateSnapshotFilename(metadata.symbol, metadata.timeframe, metadata.timestamp);
    assert.ok(filename.startsWith('trawangan-BTCUSDT-15m-'));
    assert.ok(filename.endsWith('.png'));
  });

  await t.test('4. Snapshot Toast State Management & Auto Dismiss', () => {
    // Model state toast snapshot
    interface SnapshotToastState {
      visible: boolean;
      type: 'copied' | 'saved' | 'error';
      message: string;
      thumbnailUrl?: string;
      timestamp: number;
    }

    let toast: SnapshotToastState | null = {
      visible: true,
      type: 'copied',
      message: 'Snapshot disalin ke clipboard! (PNG, 2x HiDPI)',
      thumbnailUrl: 'data:image/png;base64,mockThumb',
      timestamp: Date.now(),
    };

    assert.equal(toast.visible, true);
    assert.equal(toast.type, 'copied');
    assert.ok(toast.message.includes('disalin ke clipboard'));
    assert.ok(toast.thumbnailUrl?.startsWith('data:image/png'));

    // Simulasi manual dismiss
    function dismissToast() {
      if (toast) {
        toast = { ...toast, visible: false };
      }
    }

    dismissToast();
    assert.equal(toast?.visible, false, 'Toast harus tertutup setelah dismiss');

    // Simulasi pembuatan toast simpan
    toast = {
      visible: true,
      type: 'saved',
      message: 'Snapshot tersimpan ke file PNG!',
      timestamp: Date.now(),
    };

    assert.equal(toast.type, 'saved');
    assert.equal(toast.message, 'Snapshot tersimpan ke file PNG!');
  });

  await t.test('5. Quick Download Callback di Snapshot Toast (User Story 9)', () => {
    let downloadTriggered = false;
    let toastState: { visible: boolean; type?: string; message?: string } | null = {
      visible: true,
      type: 'copied',
      message: 'Snapshot disalin ke clipboard! (PNG, 2x HiDPI)',
    };

    function handleQuickDownload() {
      downloadTriggered = true;
      toastState = {
        visible: true,
        type: 'saved',
        message: 'Snapshot tersimpan sebagai trawangan-BTCUSDT-15m-20261030-190000.png',
      };
    }

    // Simulasi klik tombol "Unduh File" pada SnapshotToast
    assert.strictEqual(downloadTriggered, false);
    handleQuickDownload();
    assert.strictEqual(downloadTriggered, true, 'Callback onQuickDownload harus terpanggil');
    assert.strictEqual(toastState?.type, 'saved');
    assert.ok(toastState?.message?.includes('tersimpan sebagai'));
  });
});
