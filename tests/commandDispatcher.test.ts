// Unit Tests untuk Deep Command Dispatcher & Unified Shortcut Registry
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CommandDispatcher,
  isEditableElement,
  type CommandDefinition
} from '../src/lib/services/commandDispatcher';

test('Deep Command Dispatcher Seam Suite', async (t) => {
  await t.test('1. Registry: Mendaftarkan perintah dan mengembalikan katalog terstruktur', () => {
    const dispatcher = new CommandDispatcher();
    
    dispatcher.register({
      id: 'test-action',
      category: 'Navigasi & Simbol',
      keys: ['Ctrl', 'K'],
      desc: 'Pencarian Cepat Simbol',
      allowInInput: true,
      match: { ctrlOrMeta: true, key: 'k', code: 'KeyK' },
    });

    const list = dispatcher.getCommands();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'test-action');
    assert.equal(list[0].category, 'Navigasi & Simbol');

    const grouped = dispatcher.getCommandsByCategory();
    assert.ok(grouped['Navigasi & Simbol']);
    assert.equal(grouped['Navigasi & Simbol'].length, 1);

    const filtered = dispatcher.filterCommands('pencarian');
    assert.equal(filtered.length, 1);
  });

  await t.test('2. Dispatch: Menjalankan handler saat kombinasi tombol cocok', () => {
    const dispatcher = new CommandDispatcher();
    let executed = false;

    dispatcher.register({
      id: 'search-modal',
      category: 'Navigasi & Simbol',
      keys: ['Ctrl', 'K'],
      desc: 'Buka modal pencarian',
      allowInInput: true,
      match: { ctrlOrMeta: true, key: 'k', code: 'KeyK' },
      handler: () => {
        executed = true;
      }
    });

    let prevented = false;
    let stopped = false;
    const mockEvent = {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      key: 'k',
      code: 'KeyK',
      target: { tagName: 'DIV' },
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; },
    } as unknown as KeyboardEvent;

    const handled = dispatcher.dispatch(mockEvent);
    assert.equal(handled, true);
    assert.equal(executed, true);
    assert.equal(prevented, true);
    assert.equal(stopped, true);
  });

  await t.test('3. Cross-Platform: Normalisasi ctrlOrMeta mendukung Meta (Cmd di macOS) dan Ctrl (Windows/Linux)', () => {
    const dispatcher = new CommandDispatcher();
    let triggeredCount = 0;

    dispatcher.register({
      id: 'quick-settings',
      category: 'Sistem & Bantuan',
      keys: ['Ctrl', ','],
      desc: 'Buka Settings',
      allowInInput: true,
      match: { ctrlOrMeta: true, key: ',', code: 'Comma' },
      handler: () => {
        triggeredCount++;
      }
    });

    // Simulasi di macOS dengan metaKey
    const macEvent = {
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: false,
      key: ',',
      code: 'Comma',
      target: null,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    assert.equal(dispatcher.dispatch(macEvent), true);
    assert.equal(triggeredCount, 1);

    // Simulasi di Windows dengan ctrlKey
    const winEvent = {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      key: ',',
      code: 'Comma',
      target: null,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    assert.equal(dispatcher.dispatch(winEvent), true);
    assert.equal(triggeredCount, 2);
  });

  await t.test('4. Input Element Suppression: Perintah dengan allowInInput: false ditekan saat berada di input', () => {
    const dispatcher = new CommandDispatcher();
    let navTriggered = false;

    dispatcher.register({
      id: 'watchlist-next',
      category: 'Navigasi & Simbol',
      keys: ['Space'],
      desc: 'Koin berikutnya di watchlist',
      allowInInput: false,
      match: { key: ' ', code: 'Space' },
      handler: () => {
        navTriggered = true;
      }
    });

    // Event di dalam input box
    const inputElementMock = {
      tagName: 'INPUT',
      isContentEditable: false,
      closest: () => null,
    };

    const eventInInput = {
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      key: ' ',
      code: 'Space',
      target: inputElementMock,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    // Harusnya diabaikan (tidak di-handle)
    const handledInInput = dispatcher.dispatch(eventInInput);
    assert.equal(handledInInput, false);
    assert.equal(navTriggered, false);

    // Event di canvas luar input
    const canvasElementMock = {
      tagName: 'CANVAS',
      isContentEditable: false,
      closest: () => null,
    };

    const eventInCanvas = {
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      key: ' ',
      code: 'Space',
      target: canvasElementMock,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledInCanvas = dispatcher.dispatch(eventInCanvas);
    assert.equal(handledInCanvas, true);
    assert.equal(navTriggered, true);
  });

  await t.test('5. Dynamic Handler Binding: Handler dapat di-bind atau di-override secara dinamis', () => {
    const dispatcher = new CommandDispatcher();
    dispatcher.register({
      id: 'toggle-watchlist',
      category: 'Navigasi & Simbol',
      keys: ['Alt', 'W'],
      desc: 'Buka atau tutup watchlist',
      match: { alt: true, key: 'w', code: 'KeyW' },
    });

    let toggleState = false;
    const unbind = dispatcher.bindHandler('toggle-watchlist', () => {
      toggleState = !toggleState;
    });

    const event = {
      ctrlKey: false,
      metaKey: false,
      altKey: true,
      shiftKey: false,
      key: 'w',
      code: 'KeyW',
      target: null,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    dispatcher.dispatch(event);
    assert.equal(toggleState, true);

    unbind();
    // Setelah unbind, tidak ada error dan tidak ada perubahan state
    dispatcher.dispatch(event);
    assert.equal(toggleState, true);
  });

  await t.test('8. Type-to-Search Canvas Guard: Keystroke alfanumerik pada kanvas memicu pencarian', () => {
    const dispatcher = new CommandDispatcher();
    let typedChar = '';
    const unbind = dispatcher.onTypeToSearch((char) => {
      typedChar = char;
    });

    let prevented = false;
    let stopped = false;
    let listenerHandler: ((e: any) => void) | null = null;
    const mockWindow = {
      addEventListener: (type: string, fn: any) => {
        if (type === 'keydown') listenerHandler = fn;
      },
      removeEventListener: () => {
        listenerHandler = null;
      },
    } as unknown as Window;

    const unbindGlobal = dispatcher.attachGlobalListener(mockWindow);

    // 1. Ketik huruf 'b' di luar elemen input
    if (listenerHandler) {
      (listenerHandler as (e: any) => void)({
        key: 'b',
        code: 'KeyB',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        target: { tagName: 'CANVAS' },
        preventDefault: () => { prevented = true; },
        stopPropagation: () => { stopped = true; },
      });
    }

    assert.equal(typedChar, 'B', 'Harus mengonversi ke huruf kapital B');
    assert.equal(prevented, true, 'Harus memanggil preventDefault');
    assert.equal(stopped, true, 'Harus memanggil stopPropagation');

    unbind();
    unbindGlobal();
  });

  await t.test('9. Input Element Guard: Pengetikan di dalam input/textarea tidak memicu Type-to-Search', () => {
    const dispatcher = new CommandDispatcher();
    let triggered = false;
    dispatcher.onTypeToSearch(() => {
      triggered = true;
    });

    let listenerHandler: ((e: any) => void) | null = null;
    const mockWindow = {
      addEventListener: (type: string, fn: any) => {
        if (type === 'keydown') listenerHandler = fn;
      },
      removeEventListener: () => {},
    } as unknown as Window;

    dispatcher.attachGlobalListener(mockWindow);

    // Ketik huruf di dalam input teks
    if (listenerHandler) {
      (listenerHandler as (e: any) => void)({
        key: 'e',
        code: 'KeyE',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        target: { tagName: 'INPUT' },
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    }

    assert.equal(triggered, false, 'Tidak boleh memicu Type-to-Search saat fokus di INPUT');
  });

  await t.test('10. Search Symbol Hotkey: Ctrl+K dan Cmd+K memicu pencarian dengan preventDefault', () => {
    const dispatcher = new CommandDispatcher();
    let searchTriggered = 0;

    dispatcher.register({
      id: 'search-symbol',
      category: 'Navigasi & Simbol',
      keys: ['Ctrl', 'K'],
      desc: 'Buka modal pencarian',
      match: { ctrlOrMeta: true, key: ['k', 'K'], code: 'KeyK' },
      handler: () => {
        searchTriggered++;
      },
    });

    // Test dengan lowercase 'k'
    let prev1 = false;
    dispatcher.dispatch({
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: null,
      preventDefault: () => { prev1 = true; },
      stopPropagation: () => {},
    } as unknown as KeyboardEvent);

    // Test dengan uppercase 'K' (misal saat CapsLock aktif)
    let prev2 = false;
    dispatcher.dispatch({
      key: 'K',
      code: 'KeyK',
      ctrlKey: false,
      metaKey: true, // Cmd di macOS
      altKey: false,
      shiftKey: false,
      target: null,
      preventDefault: () => { prev2 = true; },
      stopPropagation: () => {},
    } as unknown as KeyboardEvent);

    assert.equal(searchTriggered, 2);
    assert.equal(prev1, true);
    assert.equal(prev2, true);
  });
});
