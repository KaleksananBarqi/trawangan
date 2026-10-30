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

  await t.test('11. Tiket #103: Timeframe Quick Input Guard: Pengetikan angka memicu onTypeTimeframe dan TIDAK memicu onTypeToSearch', () => {
    const dispatcher = new CommandDispatcher();
    let typedTimeframe = '';
    let typedSearch = '';

    dispatcher.onTypeTimeframe((digit) => {
      typedTimeframe += digit;
    });
    dispatcher.onTypeToSearch((char) => {
      typedSearch += char;
    });

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

    let prevented = false;
    let stopped = false;
    // Ketik angka '5' di kanvas
    if (listenerHandler) {
      (listenerHandler as (e: any) => void)({
        key: '5',
        code: 'Digit5',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        target: { tagName: 'CANVAS' },
        preventDefault: () => { prevented = true; },
        stopPropagation: () => { stopped = true; },
      });
    }

    assert.equal(typedTimeframe, '5', 'Digit angka harus memicu onTypeTimeframe');
    assert.equal(typedSearch, '', 'Digit angka TIDAK boleh memicu onTypeToSearch');
    assert.equal(prevented, true, 'Harus memanggil preventDefault');
    assert.equal(stopped, true, 'Harus memanggil stopPropagation');

    unbindGlobal();
  });

  await t.test('12. Tiket #103: Symbol Search Guard: Pengetikan huruf alfabet memicu onTypeToSearch', () => {
    const dispatcher = new CommandDispatcher();
    let typedTimeframe = '';
    let typedSearch = '';

    dispatcher.onTypeTimeframe((digit) => {
      typedTimeframe += digit;
    });
    dispatcher.onTypeToSearch((char) => {
      typedSearch += char;
    });

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

    // Ketik huruf 'e' di kanvas
    if (listenerHandler) {
      (listenerHandler as (e: any) => void)({
        key: 'e',
        code: 'KeyE',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        target: { tagName: 'CANVAS' },
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    }

    assert.equal(typedSearch, 'E', 'Huruf alfabet harus memicu onTypeToSearch');
    assert.equal(typedTimeframe, '', 'Huruf alfabet TIDAK boleh memicu onTypeTimeframe');

    unbindGlobal();
  });

  await t.test('13. Tiket #103: Shortcut H memicu draw-handpull tanpa bentrokan dengan 1H atau Symbol Search', () => {
    const dispatcher = new CommandDispatcher();
    let handpullTriggered = false;
    let searchTriggered = false;
    let timeframeTriggered = false;

    // Daftarkan draw-handpull sesuai DEFAULT_COMMANDS
    dispatcher.register({
      id: 'draw-handpull',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['H'],
      desc: 'Beralih antara Mode Hand-Pull (Tangan Geser Grafik) dan Kursor',
      match: {
        customMatch: (e) =>
          !isEditableElement(e.target) &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey &&
          (e.key === 'h' || e.key === 'H' || e.code === 'KeyH'),
      },
      handler: () => {
        handpullTriggered = true;
      },
    });

    dispatcher.onTypeToSearch(() => {
      searchTriggered = true;
    });
    dispatcher.onTypeTimeframe(() => {
      timeframeTriggered = true;
    });

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

    // Tekan tombol 'h' di kanvas
    if (listenerHandler) {
      (listenerHandler as (e: any) => void)({
        key: 'h',
        code: 'KeyH',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: { tagName: 'CANVAS' },
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    }

    assert.equal(handpullTriggered, true, 'Shortcut H harus memicu draw-handpull');
    assert.equal(searchTriggered, false, 'Shortcut H TIDAK boleh memicu onTypeToSearch');
    assert.equal(timeframeTriggered, false, 'Shortcut H TIDAK boleh memicu onTypeTimeframe');

    unbindGlobal();
  });

  await t.test('14. Tiket #103: Input Element Guard: Angka di dalam elemen input tidak memicu onTypeTimeframe', () => {
    const dispatcher = new CommandDispatcher();
    let timeframeTriggered = false;

    dispatcher.onTypeTimeframe(() => {
      timeframeTriggered = true;
    });

    let listenerHandler: ((e: any) => void) | null = null;
    const mockWindow = {
      addEventListener: (type: string, fn: any) => {
        if (type === 'keydown') listenerHandler = fn;
      },
      removeEventListener: () => {},
    } as unknown as Window;

    dispatcher.attachGlobalListener(mockWindow);

    // Ketik angka '1' di dalam input
    if (listenerHandler) {
      (listenerHandler as (e: any) => void)({
        key: '1',
        code: 'Digit1',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        target: { tagName: 'INPUT' },
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    }

    assert.equal(timeframeTriggered, false, 'Pengetikan angka di input teks tidak boleh memicu onTypeTimeframe');
  });

  await t.test('15. Tiket #103: Timeframe Parser: Normalisasi input cepat interval lilin', async () => {
    const { parseQuickTimeframeInput, describeTimeframe } = await import('../src/lib/utils/timeframeAdapter');

    // Angka murni
    assert.equal(parseQuickTimeframeInput('1'), '1m');
    assert.equal(parseQuickTimeframeInput('3'), '3m');
    assert.equal(parseQuickTimeframeInput('5'), '5m');
    assert.equal(parseQuickTimeframeInput('15'), '15m');
    assert.equal(parseQuickTimeframeInput('30'), '30m');
    assert.equal(parseQuickTimeframeInput('60'), '1h');
    assert.equal(parseQuickTimeframeInput('120'), '2h');
    assert.equal(parseQuickTimeframeInput('240'), '4h');
    assert.equal(parseQuickTimeframeInput('1440'), '1D');

    // Angka + unit
    assert.equal(parseQuickTimeframeInput('4h'), '4h');
    assert.equal(parseQuickTimeframeInput('1D'), '1D');
    assert.equal(parseQuickTimeframeInput('1w'), '1W');
    assert.equal(parseQuickTimeframeInput('1M'), '1M');

    // Huruf tunggal
    assert.equal(parseQuickTimeframeInput('d'), '1D');
    assert.equal(parseQuickTimeframeInput('w'), '1W');
    assert.equal(parseQuickTimeframeInput('m'), '1m');
    assert.equal(parseQuickTimeframeInput('M'), '1M');

    // Deskripsi
    assert.ok(describeTimeframe('15m').includes('15 Menit'));
    assert.ok(describeTimeframe('1h').includes('1 Jam'));
    assert.ok(describeTimeframe('1D').includes('1 Hari'));
  });

  await t.test('16. Tiket #104: Shortcut Shift+D mengeksekusi toggle-gesture-mode dan tidak memicu Symbol Search', () => {
    const dispatcher = new CommandDispatcher();
    let gestureToggled = false;
    let symbolSearched = false;

    dispatcher.register({
      id: 'toggle-gesture-mode',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Shift', 'D'],
      desc: 'Gesture Draw Mode',
      match: {
        shift: true,
        ctrlOrMeta: false,
        alt: false,
        key: ['d', 'D'],
        code: 'KeyD',
      },
      handler: () => {
        gestureToggled = true;
      },
    });

    dispatcher.onTypeToSearch(() => {
      symbolSearched = true;
    });

    let listenerHandler: ((e: any) => void) | null = null;
    const mockWindow = {
      addEventListener: (type: string, handler: any) => {
        if (type === 'keydown') listenerHandler = handler;
      },
      removeEventListener: () => {},
    } as unknown as Window;

    dispatcher.attachGlobalListener(mockWindow);

    if (listenerHandler) {
      (listenerHandler as (e: any) => void)({
        key: 'D',
        code: 'KeyD',
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        target: { tagName: 'DIV' },
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    }

    assert.equal(gestureToggled, true, 'Shift+D harus memicu toggle-gesture-mode');
    assert.equal(symbolSearched, false, 'Shift+D tidak boleh membuka modal Symbol Search');
  });
});
