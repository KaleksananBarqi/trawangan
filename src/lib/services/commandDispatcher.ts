// Deep Command Dispatcher & Unified Shortcut Registry Module
// Menyediakan satu sumber kebenaran (Single Source of Truth) untuk definisi perintah,
// normalisasi keystroke fisik OS Windows/macOS, input suppression, dan eksekusi shortcut.

export type CommandCategory =
  | 'Navigasi & Simbol'
  | 'Alat Gambar (Drawing Tools)'
  | 'Bar Replay (Simulasi)'
  | 'Analisis & Indikator'
  | 'Skala & Tampilan Grafik'
  | 'Timeframe Cepat'
  | 'Sistem & Bantuan';

export interface KeyMatcher {
  ctrlOrMeta?: boolean;
  ctrlOnly?: boolean;
  metaOnly?: boolean;
  alt?: boolean;
  shift?: boolean;
  exactModifiers?: boolean;
  key?: string | string[];
  code?: string | string[];
  customMatch?: (e: KeyboardEvent) => boolean;
}

export type CommandHandler = (e: KeyboardEvent) => boolean | void;

export interface CommandDefinition {
  id: string;
  category: CommandCategory;
  keys: string[];
  desc: string;
  context?: string;
  allowInInput?: boolean;
  match?: KeyMatcher;
  handler?: CommandHandler;
}

/**
 * Memeriksa apakah elemen yang sedang menerima fokus adalah input teks yang dapat diedit
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof (target as any).tagName !== 'string') return false;
  const el = target as HTMLElement;

  if (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable
  ) {
    return true;
  }

  if (typeof el.closest === 'function') {
    if (
      el.closest('input') ||
      el.closest('textarea') ||
      el.closest('.cm-editor') ||
      el.closest('.monaco-editor') ||
      el.closest('[contenteditable="true"]')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Deep Command Dispatcher Engine
 */
export class CommandDispatcher {
  private commands = new Map<string, CommandDefinition>();
  private handlers = new Map<string, CommandHandler>();

  /**
   * Daftarkan perintah ke dalam registry
   */
  register(cmd: CommandDefinition): () => void {
    this.commands.set(cmd.id, cmd);
    if (cmd.handler) {
      this.handlers.set(cmd.id, cmd.handler);
    }
    return () => {
      this.commands.delete(cmd.id);
      this.handlers.delete(cmd.id);
    };
  }

  /**
   * Daftarkan handler dinamis untuk perintah tertentu
   */
  bindHandler(id: string, handler: CommandHandler): () => void {
    this.handlers.set(id, handler);
    return () => {
      if (this.handlers.get(id) === handler) {
        this.handlers.delete(id);
      }
    };
  }

  /**
   * Eksekusi event keyboard
   * Mengembalikan true jika event cocok dengan perintah dan berhasil ditangani
   */
  dispatch(e: KeyboardEvent): boolean {
    const isInput = isEditableElement(e.target);
    const key = (e.key || '').toLowerCase();
    const code = e.code || '';
    const ctrlOrMeta = Boolean(e.ctrlKey || e.metaKey);

    for (const cmd of this.commands.values()) {
      // 1. Cek suppress input element jika allowInInput bernilai false (default)
      if (isInput && !cmd.allowInInput) {
        continue;
      }

      const match = cmd.match;
      if (!match) continue;

      // 2. Cek custom matcher jika didefinisikan
      if (typeof match.customMatch === 'function') {
        if (!match.customMatch(e)) continue;
      } else {
        // 3. Evaluasi modifier keys
        if (match.ctrlOrMeta !== undefined && match.ctrlOrMeta !== ctrlOrMeta) {
          continue;
        }
        if (match.ctrlOnly !== undefined && match.ctrlOnly !== Boolean(e.ctrlKey)) {
          continue;
        }
        if (match.metaOnly !== undefined && match.metaOnly !== Boolean(e.metaKey)) {
          continue;
        }
        if (match.alt !== undefined && match.alt !== Boolean(e.altKey)) {
          continue;
        }
        if (match.shift !== undefined && match.shift !== Boolean(e.shiftKey)) {
          continue;
        }

        // Cek exact modifiers jika diinginkan
        if (match.exactModifiers) {
          const expectCtrl = Boolean(match.ctrlOrMeta || match.ctrlOnly || match.metaOnly);
          if (ctrlOrMeta !== expectCtrl) continue;
          if (Boolean(e.altKey) !== Boolean(match.alt)) continue;
          if (Boolean(e.shiftKey) !== Boolean(match.shift)) continue;
        }

        // 4. Evaluasi Key / Code
        let keyMatched = false;
        if (match.key !== undefined) {
          const keys = Array.isArray(match.key) ? match.key : [match.key];
          keyMatched = keys.some((k) => k.toLowerCase() === key);
        }

        let codeMatched = false;
        if (match.code !== undefined) {
          const codes = Array.isArray(match.code) ? match.code : [match.code];
          codeMatched = codes.includes(code);
        }

        // Jika salah satu key atau code ditentukan, minimal satu harus cocok
        if (match.key !== undefined || match.code !== undefined) {
          if (!keyMatched && !codeMatched) {
            continue;
          }
        }
      }

      // Handler eksekusi
      const handler = this.handlers.get(cmd.id) || cmd.handler;
      if (handler) {
        try {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        } catch (_) {}

        handler(e);
        return true;
      }
    }

    return false;
  }

  /**
   * Ambil seluruh perintah yang terdaftar
   */
  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Kelompokkan perintah berdasarkan kategori
   */
  getCommandsByCategory(): Record<string, CommandDefinition[]> {
    const result: Record<string, CommandDefinition[]> = {};
    for (const cmd of this.commands.values()) {
      if (!result[cmd.category]) {
        result[cmd.category] = [];
      }
      result[cmd.category].push(cmd);
    }
    return result;
  }

  /**
   * Cari perintah berdasarkan teks pencarian
   */
  filterCommands(query: string): CommandDefinition[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getCommands();

    return this.getCommands().filter((item) => {
      const descMatch = item.desc.toLowerCase().includes(q);
      const categoryMatch = item.category.toLowerCase().includes(q);
      const keyMatch = item.keys.some((k) => k.toLowerCase().includes(q));
      const comboMatch = item.keys.join('+').toLowerCase().includes(q);
      return descMatch || categoryMatch || keyMatch || comboMatch;
    });
  }

  private typeToSearchHandler: ((char: string) => void) | null = null;
  private typeTimeframeHandler: ((digit: string) => void) | null = null;

  /**
   * Daftarkan handler Type-to-Search saat pengguna mengetik huruf langsung di kanvas grafik
   */
  onTypeToSearch(handler: (char: string) => void): () => void {
    this.typeToSearchHandler = handler;
    return () => {
      if (this.typeToSearchHandler === handler) {
        this.typeToSearchHandler = null;
      }
    };
  }

  /**
   * Daftarkan handler Type-Timeframe saat pengguna mengetik digit angka langsung di kanvas grafik
   */
  onTypeTimeframe(handler: (digit: string) => void): () => void {
    this.typeTimeframeHandler = handler;
    return () => {
      if (this.typeTimeframeHandler === handler) {
        this.typeTimeframeHandler = null;
      }
    };
  }

  /**
   * Pasang event listener global di capture-phase pada window
   */
  attachGlobalListener(targetWindow: Window = window): () => void {
    if (!targetWindow || typeof targetWindow.addEventListener !== 'function') {
      return () => {};
    }

    const handler = (e: KeyboardEvent) => {
      const isInput = isEditableElement(e.target);

      // Jika fokus berada pada input teks atau editor yang dapat diedit,
      // jangan mengintersepsi ketikan kanvas; teruskan langsung ke dispatch
      if (isInput) {
        this.dispatch(e);
        return;
      }

      // Saat fokus berada di kanvas grafik (bukan elemen teks) dan tanpa modifier Ctrl/Meta/Alt:
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key;

        // 1. Timeframe Quick Input Guard:
        // Pengetikan digit angka (0-9) di kanvas membuka bilah TimeframeQuickBar,
        // dan TIDAK PERNAH memicu Type-to-Search (pencarian simbol).
        if (key && key.length === 1 && /^[0-9]$/.test(key)) {
          try {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
          } catch (_) {}

          if (this.typeTimeframeHandler) {
            this.typeTimeframeHandler(key);
          }
          return;
        }

        // 2. Evaluasi perintah shortcut aktif di kanvas terlebih dahulu
        // (misalnya: tombol 'H' untuk Hand-Pull, 'F' untuk Fit-Chart, dsb.)
        if (this.dispatch(e)) {
          return;
        }

        // 3. Type-to-Search Canvas Guard:
        // Pengetikan huruf alfabet (a-zA-Z) tunggal yang tidak dipetakan sebagai aksi kanvas aktif
        // langsung membuka modal pencarian simbol instrumen.
        if (key && key.length === 1 && /^[a-zA-Z]$/.test(key)) {
          if (this.typeToSearchHandler) {
            try {
              if (typeof e.preventDefault === 'function') e.preventDefault();
              if (typeof e.stopPropagation === 'function') e.stopPropagation();
            } catch (_) {}
            this.typeToSearchHandler(key.toUpperCase());
            return;
          }
        }

        return;
      }

      this.dispatch(e);
    };

    targetWindow.addEventListener('keydown', handler, true);
    return () => {
      targetWindow.removeEventListener('keydown', handler, true);
    };
  }
}

/**
 * Inisialisasi daftar perintah bawaan terminal Trawangan (30+ perintah terstandarisasi)
 */
export const DEFAULT_COMMANDS: CommandDefinition[] = [
    // --- Navigasi & Simbol ---
    {
      id: 'search-symbol',
      category: 'Navigasi & Simbol',
      keys: ['Ctrl', 'K'],
      desc: 'Buka modal pencarian simbol instrumen atau ketik langsung di keyboard',
      allowInInput: true,
      match: { ctrlOrMeta: true, key: 'k', code: 'KeyK' },
    },
    {
      id: 'toggle-watchlist',
      category: 'Navigasi & Simbol',
      keys: ['Alt', 'W'],
      desc: 'Buka atau sembunyikan panel daftar pantau (Watchlist)',
      match: { alt: true, ctrlOrMeta: false, key: 'w', code: 'KeyW' },
    },
    {
      id: 'next-symbol',
      category: 'Navigasi & Simbol',
      keys: ['Alt', '↓'],
      desc: 'Beralih ke simbol berikutnya pada daftar pantau',
      match: { alt: true, ctrlOrMeta: false, key: 'arrowdown', code: 'ArrowDown' },
    },
    {
      id: 'prev-symbol',
      category: 'Navigasi & Simbol',
      keys: ['Alt', '↑'],
      desc: 'Beralih ke simbol sebelumnya pada daftar pantau',
      match: { alt: true, ctrlOrMeta: false, key: 'arrowup', code: 'ArrowUp' },
    },
    {
      id: 'nav-watchlist-space',
      category: 'Navigasi & Simbol',
      keys: ['Space'],
      desc: 'Koin berikutnya (Space) atau koin sebelumnya (Shift+Space)',
      match: { ctrlOrMeta: false, alt: false, key: ' ', code: 'Space' },
    },
    {
      id: 'cancel-action',
      category: 'Navigasi & Simbol',
      keys: ['Esc'],
      desc: 'Batalkan alat gambar aktif, hilangkan seleksi, atau tutup jendela modal',
      match: { key: 'escape', code: 'Escape' },
    },

    // --- Alat Gambar (Drawing Tools) ---
    {
      id: 'toggle-gesture-mode',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Shift', 'D'],
      desc: 'Beralih antara Mode Gambar Gestur (Gesture Draw Mode) dan Kursor',
      match: {
        shift: true,
        ctrlOrMeta: false,
        alt: false,
        key: ['d', 'D'],
        code: 'KeyD',
      },
    },
    {
      id: 'toggle-left-toolbar',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'T'],
      desc: 'Buka atau sembunyikan bilah alat gambar kiri (Left Drawing Toolbar)',
      match: { alt: true, ctrlOrMeta: false, key: 't', code: 'KeyT' },
    },
    {
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
    },
    {
      id: 'draw-hline',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'H'],
      desc: 'Aktifkan alat Garis Horizontal (Horizontal Line)',
      match: { alt: true, ctrlOrMeta: false, key: 'h', code: 'KeyH' },
    },
    {
      id: 'draw-vline',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'V'],
      desc: 'Aktifkan alat Garis Vertikal (Vertical Line)',
      match: { alt: true, ctrlOrMeta: false, key: 'v', code: 'KeyV' },
    },
    {
      id: 'draw-position',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'R'],
      desc: 'Aktifkan alat Kalkulasi Posisi Long / Short (Risk / Reward)',
      match: { alt: true, ctrlOrMeta: false, key: 'r', code: 'KeyR' },
    },
    {
      id: 'draw-fibonacci',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'F'],
      desc: 'Aktifkan alat Retracement Fibonacci',
      match: { alt: true, ctrlOrMeta: false, key: 'f', code: 'KeyF' },
    },
    {
      id: 'draw-measure',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'M'],
      desc: 'Aktifkan alat Penggaris / Jarak Bar (Measure Tool)',
      match: { alt: true, ctrlOrMeta: false, key: 'm', code: 'KeyM' },
    },
    {
      id: 'draw-box',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'B'],
      desc: 'Aktifkan alat Kotak Area (Box / Rectangle Area)',
      match: { alt: true, ctrlOrMeta: false, key: 'b', code: 'KeyB' },
    },
    {
      id: 'create-alert-cursor',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Alt', 'A'],
      desc: 'Buat Price Alert pada harga posisi kursor saat ini',
      match: { alt: true, ctrlOrMeta: false, key: 'a', code: 'KeyA' },
    },
    {
      id: 'draw-undo',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Ctrl', 'Z'],
      desc: 'Urungkan (Undo) perubahan gambar terakhir',
      allowInInput: false,
      match: { ctrlOrMeta: true, shift: false, key: 'z', code: 'KeyZ' },
    },
    {
      id: 'draw-redo',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Ctrl', 'Y'],
      desc: 'Ulangi (Redo) perubahan gambar yang diurungkan',
      allowInInput: false,
      match: {
        customMatch: (e) =>
          Boolean((e.ctrlKey || e.metaKey) && (e.key?.toLowerCase() === 'y' || (e.shiftKey && e.key?.toLowerCase() === 'z'))),
      },
    },
    {
      id: 'draw-delete',
      category: 'Alat Gambar (Drawing Tools)',
      keys: ['Del'],
      desc: 'Hapus objek gambar yang sedang dipilih atau urungkan aksi',
      allowInInput: false,
      match: {
        customMatch: (e) =>
          !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace' || e.code === 'Delete'),
      },
    },

    // --- Bar Replay (Simulasi) ---
    {
      id: 'replay-toggle',
      category: 'Bar Replay (Simulasi)',
      keys: ['Shift', 'R'],
      desc: 'Aktifkan atau keluar dari mode simulasi Bar Replay',
      match: { shift: true, ctrlOrMeta: false, alt: false, key: 'r', code: 'KeyR' },
    },
    {
      id: 'replay-play-pause',
      category: 'Bar Replay (Simulasi)',
      keys: ['Space'],
      desc: 'Mulai atau jeda putaran otomatis simulasi lilin harga (saat Replay aktif)',
    },
    {
      id: 'replay-step-forward',
      category: 'Bar Replay (Simulasi)',
      keys: ['→'],
      desc: 'Maju 1 bar simulasi ke depan',
    },
    {
      id: 'replay-step-backward',
      category: 'Bar Replay (Simulasi)',
      keys: ['←'],
      desc: 'Mundur 1 bar simulasi ke belakang (potong ulang 1 lilin)',
    },

    // --- Analisis & Indikator ---
    {
      id: 'open-indicators',
      category: 'Analisis & Indikator',
      keys: ['/'],
      desc: 'Buka modal katalog indikator teknikal & strategi',
      match: {
        customMatch: (e) =>
          !isEditableElement(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '/' || e.code === 'Slash'),
      },
    },
    {
      id: 'open-indicators-ctrl-i',
      category: 'Analisis & Indikator',
      keys: ['Ctrl', 'I'],
      desc: 'Pintasan alternatif untuk membuka katalog indikator',
      allowInInput: true,
      match: { ctrlOrMeta: true, key: 'i', code: 'KeyI' },
    },
    {
      id: 'toggle-pine-editor',
      category: 'Analisis & Indikator',
      keys: ['Alt', 'E'],
      desc: 'Buka atau tutup Pine Script IDE / Editor Strategi',
      match: { alt: true, ctrlOrMeta: false, key: 'e', code: 'KeyE' },
    },

    // --- Skala & Tampilan Grafik ---
    {
      id: 'fit-chart-z',
      category: 'Skala & Tampilan Grafik',
      keys: ['Alt', 'Z'],
      desc: 'Reset skala & pas kanvas grafik (Auto Fit)',
      match: { alt: true, ctrlOrMeta: false, key: 'z', code: 'KeyZ' },
    },
    {
      id: 'fit-chart-f',
      category: 'Skala & Tampilan Grafik',
      keys: ['F'],
      desc: 'Pintasan cepat fit grafik ke viewport',
      match: { ctrlOrMeta: false, alt: false, shift: false, key: 'f', code: 'KeyF' },
    },

    // --- Timeframe Cepat ---
    {
      id: 'tf-quick',
      category: 'Timeframe Cepat',
      keys: ['0-9'],
      desc: 'Buka bilah Timeframe Cepat dengan mengetik angka di kanvas (contoh: 15, 60, 1D)',
    },

    // --- Sistem & Bantuan ---
    {
      id: 'toggle-console',
      category: 'Sistem & Bantuan',
      keys: ['Ctrl', '`'],
      desc: 'Buka atau tutup laci Terminal Diagnostics & Log Sistem',
      allowInInput: true,
      match: { ctrlOrMeta: true, key: '`', code: 'Backquote' },
    },
    {
      id: 'open-settings',
      category: 'Sistem & Bantuan',
      keys: ['Ctrl', ','],
      desc: 'Buka jendela pengaturan aplikasi dan preferensi visual',
      allowInInput: true,
      match: { ctrlOrMeta: true, key: ',', code: 'Comma' },
    },
    {
      id: 'help-cheatsheet-f1',
      category: 'Sistem & Bantuan',
      keys: ['F1'],
      desc: 'Buka panduan glosarium lengkap pintasan keyboard',
      allowInInput: true,
      match: { key: 'f1', code: 'F1' },
    },
    {
      id: 'help-cheatsheet-question',
      category: 'Sistem & Bantuan',
      keys: ['?'],
      desc: 'Buka panduan glosarium keyboard saat tidak berada di input',
      match: {
        customMatch: (e) =>
          !isEditableElement(e.target) && (e.key === '?' || (e.shiftKey && e.code === 'Slash')),
      },
    },
    {
      id: 'fullscreen-toggle',
      category: 'Sistem & Bantuan',
      keys: ['F11'],
      desc: 'Beralih ke mode layar penuh (Full Screen)',
      allowInInput: true,
      match: {
        customMatch: (e) =>
          e.code === 'F11' ||
          e.key?.toLowerCase() === 'f11' ||
          (!isEditableElement(e.target) && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key?.toLowerCase() === 'f'),
      },
    },
    {
      id: 'quick-snapshot-copy',
      category: 'Sistem & Bantuan',
      keys: ['Ctrl', 'Shift', 'S'],
      desc: 'Salin snapshot grafik bermerek ke clipboard',
      allowInInput: false,
      match: {
        ctrlOrMeta: true,
        shift: true,
        key: 's',
        code: 'KeyS',
      },
    },
  ];

export function createDefaultCommandDispatcher(): CommandDispatcher {
  const dispatcher = new CommandDispatcher();

  for (const cmd of DEFAULT_COMMANDS) {
    dispatcher.register(cmd);
  }

  return dispatcher;
}

/**
 * Singleton default command dispatcher
 */
export const commandDispatcher = createDefaultCommandDispatcher();
