// Unit Tests untuk Deep Command Dispatcher & Unified Shortcut Registry
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CommandDispatcher,
  createDefaultCommandDispatcher,
  isEditableElement,
  SHORTCUT_GLOSSARY,
  getShortcutsByCategory,
  filterShortcuts,
  type CommandDefinition,
  type ShortcutItem
} from '../src/lib/services/commandDispatcher';
import { rightDockService } from '../src/lib/services/rightDockService';

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

  await t.test('17. Tiket #138: Shortcut draw-delete cocok dengan tombol Delete dan Backspace, dan diabaikan pada input element', () => {
    const dispatcher = createDefaultCommandDispatcher();

    const cmd = dispatcher.getCommands().find((c) => c.id === 'draw-delete');
    assert.ok(cmd, 'Perintah draw-delete harus terdaftar di default commands');
    assert.equal(cmd.desc, 'Hapus objek gambar yang sedang dipilih');
    assert.equal(cmd.allowInInput, false);

    let deleteTriggered = 0;
    dispatcher.bindHandler('draw-delete', () => {
      deleteTriggered++;
    });

    let listenerHandler: ((e: any) => void) | null = null;
    const mockWindow = {
      addEventListener: (type: string, handler: any) => {
        if (type === 'keydown') listenerHandler = handler;
      },
      removeEventListener: () => {},
    } as unknown as Window;

    dispatcher.attachGlobalListener(mockWindow);
    assert.ok(listenerHandler, 'Global listener harus terpasang');

    // 1. Tombol Delete pada kanvas memicu draw-delete
    (listenerHandler as (e: any) => void)({
      key: 'Delete',
      code: 'Delete',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: { tagName: 'DIV' },
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    assert.equal(deleteTriggered, 1, 'Tombol Delete harus memicu draw-delete');

    // 2. Tombol Backspace pada kanvas memicu draw-delete
    (listenerHandler as (e: any) => void)({
      key: 'Backspace',
      code: 'Backspace',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    assert.equal(deleteTriggered, 2, 'Tombol Backspace harus memicu draw-delete');

    // 3. Tombol Delete pada input element diabaikan (suppressed)
    (listenerHandler as (e: any) => void)({
      key: 'Delete',
      code: 'Delete',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: { tagName: 'INPUT' },
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    assert.equal(deleteTriggered, 2, 'Tombol Delete di dalam input tidak boleh memicu draw-delete');

    // 4. Tombol Backspace pada textarea diabaikan (suppressed)
    (listenerHandler as (e: any) => void)({
      key: 'Backspace',
      code: 'Backspace',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: { tagName: 'TEXTAREA' },
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    assert.equal(deleteTriggered, 2, 'Tombol Backspace di dalam textarea tidak boleh memicu draw-delete');
  });

  await t.test('18. Tiket #140: Shortcut Alt+O (toggle-objects-tree) untuk Object Tree & Indikator dan supresi di input', () => {
    const dispatcher = createDefaultCommandDispatcher();

    // 1. Verifikasi registrasi perintah
    const cmd = dispatcher.getCommands().find((c) => c.id === 'toggle-objects-tree');
    assert.ok(cmd, 'Perintah toggle-objects-tree harus terdaftar di default commands');
    assert.equal(cmd.category, 'Navigasi & Simbol');
    assert.deepEqual(cmd.keys, ['Alt', 'O']);
    assert.equal(cmd.desc, 'Buka atau sembunyikan panel Object Tree & Lapisan Indikator');
    assert.equal(cmd.allowInInput, false, 'allowInInput harus bernilai false');
    assert.deepEqual(cmd.match, { alt: true, ctrlOrMeta: false, key: 'o', code: 'KeyO' });

    // 2. Eksekusi handler saat Alt+O ditekan di kanvas
    let toggleCount = 0;
    dispatcher.bindHandler('toggle-objects-tree', () => {
      toggleCount++;
    });

    let prevented = false;
    let stopped = false;
    const canvasEvent = {
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      key: 'o',
      code: 'KeyO',
      target: { tagName: 'CANVAS' },
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; },
    } as unknown as KeyboardEvent;

    const handled = dispatcher.dispatch(canvasEvent);
    assert.equal(handled, true, 'Alt+O harus berhasil di-dispatch');
    assert.equal(toggleCount, 1, 'Handler toggle-objects-tree harus dipanggil');
    assert.equal(prevented, true, 'preventDefault harus dipanggil');
    assert.equal(stopped, true, 'stopPropagation harus dipanggil');

    // 3. Supresi input: Alt+O tidak dieksekusi saat mengetik di elemen input atau textarea
    const inputEvent = {
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      key: 'o',
      code: 'KeyO',
      target: { tagName: 'INPUT', isContentEditable: false, closest: () => null },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const inputHandled = dispatcher.dispatch(inputEvent);
    assert.equal(inputHandled, false, 'Alt+O harus diabaikan saat fokus di input element');
    assert.equal(toggleCount, 1, 'toggleCount tidak boleh bertambah saat di input');

    const textareaEvent = {
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      key: 'o',
      code: 'KeyO',
      target: { tagName: 'TEXTAREA', isContentEditable: false, closest: () => null },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const textareaHandled = dispatcher.dispatch(textareaEvent);
    assert.equal(textareaHandled, false, 'Alt+O harus diabaikan saat fokus di textarea');
    assert.equal(toggleCount, 1, 'toggleCount tidak boleh bertambah saat di textarea');

    // 4. Muncul di filter dan cheatsheet modal secara otomatis
    const searchByName = dispatcher.filterCommands('object');
    assert.ok(searchByName.some((c) => c.id === 'toggle-objects-tree'), 'Harus ditemukan saat query "object"');

    const searchByKey = dispatcher.filterCommands('alt+o');
    assert.ok(searchByKey.some((c) => c.id === 'toggle-objects-tree'), 'Harus ditemukan saat query "alt+o"');
  });

  await t.test('19. Tiket #140: Smart-Toggle Semantics RightDockRail untuk Tab Objects dan Transisi Pine Workspace', () => {
    // Mock representasi state halaman +page.svelte
    let currentWorkspaceMode: 'terminal' | 'pine' = 'pine';
    const logs: string[] = [];

    // Gunakan instance RightDockService nyata
    rightDockService.resetState();

    function handleWorkspaceModeChange(mode: 'terminal' | 'pine') {
      currentWorkspaceMode = mode;
      logs.push(`Workspace beralih ke mode: ${mode}`);
    }

    const dispatcher = createDefaultCommandDispatcher();

    // Bind handler sesuai implementasi di +page.svelte
    dispatcher.bindHandler('toggle-objects-tree', () => {
      if (currentWorkspaceMode === 'pine') {
        handleWorkspaceModeChange('terminal');
      }
      rightDockService.toggleTab('objects');
      logs.push('Shortcut: Beralih panel Object Tree & Indikator (Alt+O)');
    });

    const triggerAltO = () => {
      dispatcher.dispatch({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        key: 'o',
        code: 'KeyO',
        target: { tagName: 'CANVAS' },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as KeyboardEvent);
    };

    // Skenario A: Workspace di mode 'pine' dan dock di watchlist
    assert.equal(currentWorkspaceMode, 'pine');
    assert.equal(rightDockService.getSnapshot().activeTab, 'watchlist');

    triggerAltO();

    // Harus beralih dari 'pine' ke 'terminal' dan mengaktifkan tab 'objects'
    assert.equal(currentWorkspaceMode, 'terminal', 'Workspace harus beralih ke terminal');
    let snap = rightDockService.getSnapshot();
    assert.equal(snap.isOpen, true, 'Right dock harus terbuka');
    assert.equal(snap.activeTab, 'objects', 'Active tab harus beralih ke objects');

    // Skenario B: Dock sedang terbuka pada tab 'objects' -> tekan Alt+O lagi harus melipat (close dock)
    triggerAltO();
    snap = rightDockService.getSnapshot();
    assert.equal(snap.isOpen, false, 'Right dock harus tertutup saat tab yang sama di-toggle');
    assert.equal(snap.activeTab, null);

    // Skenario C: Dock sedang tertutup -> tekan Alt+O harus membuka dock langsung pada tab 'objects'
    triggerAltO();
    snap = rightDockService.getSnapshot();
    assert.equal(snap.isOpen, true, 'Right dock harus terbuka kembali');
    assert.equal(snap.activeTab, 'objects', 'Tab aktif harus objects');

    // Skenario D: Dock sedang terbuka pada tab lain (misal 'alerts') -> tekan Alt+O harus beralih tab tanpa menutup
    rightDockService.openTab('alerts');
    assert.equal(rightDockService.getSnapshot().activeTab, 'alerts');

    triggerAltO();
    snap = rightDockService.getSnapshot();
    assert.equal(snap.isOpen, true, 'Dock harus tetap terbuka');
    assert.equal(snap.activeTab, 'objects', 'Tab harus berpindah ke objects');
  });

  await t.test('20. Tiket #141: Pintasan Ctrl+D untuk Duplikasi Objek Gambar (duplicate-selected-drawing) & Input Suppression', () => {
    const dispatcher = createDefaultCommandDispatcher();

    // 1. Verifikasi registrasi perintah bawaan
    const cmd = dispatcher.getCommands().find((c) => c.id === 'duplicate-selected-drawing');
    assert.ok(cmd, 'Perintah duplicate-selected-drawing harus terdaftar di dispatcher');
    assert.equal(cmd.category, 'Alat Gambar (Drawing Tools)');
    assert.deepEqual(cmd.keys, ['Ctrl', 'D']);
    assert.equal(cmd.desc, 'Duplikasi objek gambar yang sedang dipilih (Clone / Duplicate)');
    assert.equal(cmd.allowInInput, false, 'allowInInput harus false');
    assert.deepEqual(cmd.match, { ctrlOrMeta: true, alt: false, shift: false, key: 'd', code: 'KeyD' });

    // 2. Verifikasi eksekusi handler via Ctrl+D dan Meta+D
    let duplicateTriggeredCount = 0;
    const unbind = dispatcher.bindHandler('duplicate-selected-drawing', () => {
      duplicateTriggeredCount++;
    });

    // Simulasi Ctrl+D di kanvas (Windows/Linux)
    const ctrlDEvent = {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      key: 'd',
      code: 'KeyD',
      target: { tagName: 'CANVAS', isContentEditable: false, closest: () => null },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledCtrlD = dispatcher.dispatch(ctrlDEvent);
    assert.equal(handledCtrlD, true, 'Ctrl+D di canvas harus di-dispatch');
    assert.equal(duplicateTriggeredCount, 1);

    // Simulasi Cmd+D di kanvas (macOS)
    const metaDEvent = {
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: false,
      key: 'd',
      code: 'KeyD',
      target: { tagName: 'CANVAS', isContentEditable: false, closest: () => null },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledMetaD = dispatcher.dispatch(metaDEvent);
    assert.equal(handledMetaD, true, 'Cmd+D (Meta+D) di canvas harus di-dispatch');
    assert.equal(duplicateTriggeredCount, 2);

    // 3. Shift+Ctrl+D tidak boleh memicu duplikasi karena shift: false
    const shiftCtrlDEvent = {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: true,
      key: 'd',
      code: 'KeyD',
      target: { tagName: 'CANVAS', isContentEditable: false, closest: () => null },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledShiftCtrlD = dispatcher.dispatch(shiftCtrlDEvent);
    assert.equal(handledShiftCtrlD, false, 'Shift+Ctrl+D tidak boleh memicu duplikasi');
    assert.equal(duplicateTriggeredCount, 2);

    // 4. Verifikasi Input Suppression (disupresi saat fokus di input dan textarea)
    const inputEvent = {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      key: 'd',
      code: 'KeyD',
      target: { tagName: 'INPUT', isContentEditable: false, closest: () => null },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledInput = dispatcher.dispatch(inputEvent);
    assert.equal(handledInput, false, 'Ctrl+D harus disupresi saat fokus di input teks');
    assert.equal(duplicateTriggeredCount, 2);

    const textareaEvent = {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      key: 'd',
      code: 'KeyD',
      target: { tagName: 'TEXTAREA', isContentEditable: false, closest: () => null },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent;

    const handledTextarea = dispatcher.dispatch(textareaEvent);
    assert.equal(handledTextarea, false, 'Ctrl+D harus disupresi saat fokus di textarea');
    assert.equal(duplicateTriggeredCount, 2);

    // 5. Verifikasi terdaftar dan dapat dicari di filter / cheatsheet
    const searchDuplicate = dispatcher.filterCommands('duplikasi');
    assert.ok(searchDuplicate.some((c) => c.id === 'duplicate-selected-drawing'), 'Harus ditemukan saat query "duplikasi"');

    const searchCtrlD = dispatcher.filterCommands('ctrl+d');
    assert.ok(searchCtrlD.some((c) => c.id === 'duplicate-selected-drawing'), 'Harus ditemukan saat query "ctrl+d"');

    unbind();
  });

  await t.test('22. Unified Glosarium & Shortcut Registry Seam: Verifikasi SHORTCUT_GLOSSARY, filterShortcuts, & getShortcutsByCategory', () => {
    assert.ok(SHORTCUT_GLOSSARY.length >= 30, `Jumlah shortcut (${SHORTCUT_GLOSSARY.length}) harus >= 30`);

    for (const item of SHORTCUT_GLOSSARY) {
      assert.ok(item.category, `Item harus memiliki kategori: ${item.desc}`);
      assert.ok(Array.isArray(item.keys) && item.keys.length > 0, `Item harus memiliki tombol keys: ${item.desc}`);
      assert.ok(item.desc && item.desc.length > 3, `Item harus memiliki deskripsi jelas: ${item.desc}`);
    }

    const categories = new Set(SHORTCUT_GLOSSARY.map((s) => s.category));
    assert.ok(categories.has('Navigasi & Simbol'));
    assert.ok(categories.has('Alat Gambar (Drawing Tools)'));
    assert.ok(categories.has('Bar Replay (Simulasi)'));
    assert.ok(categories.has('Analisis & Indikator'));
    assert.ok(categories.has('Skala & Tampilan Grafik'));
    assert.ok(categories.has('Timeframe Cepat'));
    assert.ok(categories.has('Sistem & Bantuan'));

    // Verifikasi shortcut kritis
    const watchlistShortcut = SHORTCUT_GLOSSARY.find((s) => s.keys.includes('Alt') && s.keys.includes('W'));
    assert.ok(watchlistShortcut, 'Shortcut Alt + W untuk Watchlist harus terdaftar');

    const objectsTreeShortcut = SHORTCUT_GLOSSARY.find((s) => s.id === 'toggle-objects-tree' && s.keys.includes('Alt') && s.keys.includes('O'));
    assert.ok(objectsTreeShortcut, 'Shortcut Alt + O (toggle-objects-tree) harus terdaftar');

    const replayBackShortcut = SHORTCUT_GLOSSARY.find((s) => s.category === 'Bar Replay (Simulasi)' && s.keys.includes('←'));
    assert.ok(replayBackShortcut, 'Shortcut ← untuk Replay mundur 1 bar harus terdaftar');

    const indicatorShortcut = SHORTCUT_GLOSSARY.find((s) => s.category === 'Analisis & Indikator' && (s.keys.includes('/') || s.keys.includes('I')));
    assert.ok(indicatorShortcut, 'Shortcut indikator harus terdaftar');

    const settingsShortcut = SHORTCUT_GLOSSARY.find((s) => s.keys.includes('Ctrl') && s.keys.includes(','));
    assert.ok(settingsShortcut, 'Shortcut Ctrl + , untuk Settings harus terdaftar');

    // Pencarian Cepat filterShortcuts
    const replayResults = filterShortcuts('replay');
    assert.ok(replayResults.length >= 4);

    const altResults = filterShortcuts('Alt');
    assert.ok(altResults.length >= 6);

    const emptyResults = filterShortcuts('nonexistent_query_xyz');
    assert.equal(emptyResults.length, 0);
    assert.equal(filterShortcuts('').length, SHORTCUT_GLOSSARY.length);

    // Pengelompokan getShortcutsByCategory
    const grouped = getShortcutsByCategory();
    assert.ok(Object.keys(grouped).length >= 6);
    assert.ok(grouped['Navigasi & Simbol'].length >= 3);
    assert.ok(grouped['Bar Replay (Simulasi)'].length >= 4);
  });
});

