// Unit & Integration Tests untuk Type-to-Search Cursor Guard dan Continuous Typing (Tiket #145)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applySearchInputFocus,
  type FocusableSearchInputElement,
  type SearchTriggerSource
} from '../src/lib/services/symbolSearchFocusGuard';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Mock HTMLInputElement yang mensimulasikan mekanisme seleksi kursor dan input karakter browser
 */
class MockInputElement implements FocusableSearchInputElement {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  focused: boolean = false;
  selected: boolean = false;
  setSelectionRangeCalls: Array<{ start: number; end: number }> = [];
  selectCalls: number = 0;

  constructor(initialValue: string = '') {
    this.value = initialValue;
    this.selectionStart = initialValue.length;
    this.selectionEnd = initialValue.length;
  }

  focus(): void {
    this.focused = true;
  }

  select(): void {
    this.selectCalls++;
    this.selected = true;
    this.selectionStart = 0;
    this.selectionEnd = this.value.length;
  }

  setSelectionRange(start: number, end: number): void {
    this.setSelectionRangeCalls.push({ start, end });
    this.selectionStart = start;
    this.selectionEnd = end;
    this.selected = (start === 0 && end === this.value.length && this.value.length > 0);
  }

  /**
   * Mensimulasikan pengetikan karakter pengguna pada elemen input sesuai standar DOM
   */
  typeCharacter(char: string): void {
    const before = this.value.slice(0, this.selectionStart);
    const after = this.value.slice(this.selectionEnd);
    this.value = before + char + after;
    const nextPos = this.selectionStart + char.length;
    this.selectionStart = nextPos;
    this.selectionEnd = nextPos;
    this.selected = false;
  }
}

test('Tiket #145: Type-to-Search Cursor Guard & Continuous Typing Suite', async (t) => {
  await t.test('1. Keystroke Trigger Guard: triggerSource "keystroke" TIDAK memanggil select(), melainkan setSelectionRange(len, len)', () => {
    const input = new MockInputElement('Z');
    
    // Buka modal pencarian dengan triggerSource 'keystroke' (misal mengetik huruf 'Z' di kanvas)
    applySearchInputFocus(input, 'keystroke', input.value.length);

    assert.equal(input.focused, true, 'Elemen input harus menerima fokus');
    assert.equal(input.selectCalls, 0, 'select() TIDAK boleh dipanggil pada pemicu keystroke');
    assert.equal(input.selected, false, 'Teks tidak boleh berada dalam kondisi terseleksi');
    assert.equal(input.setSelectionRangeCalls.length, 1, 'setSelectionRange harus dipanggil tepat 1 kali');
    assert.deepEqual(
      input.setSelectionRangeCalls[0],
      { start: 1, end: 1 },
      'Kursor harus diletakkan persis di akhir karakter pertama (len, len)'
    );
    assert.equal(input.selectionStart, 1);
    assert.equal(input.selectionEnd, 1);
  });

  await t.test('2. Explicit Trigger: triggerSource "explicit" (Ctrl+K atau klik) memanggil select() dan menyeleksi seluruh teks', () => {
    const input = new MockInputElement('BTC');

    // Buka modal secara eksplisit (Ctrl+K atau klik ikon search)
    applySearchInputFocus(input, 'explicit', input.value.length);

    assert.equal(input.focused, true, 'Elemen input harus menerima fokus');
    assert.equal(input.selectCalls, 1, 'select() harus dipanggil pada pembukaan eksplisit');
    assert.equal(input.selected, true, 'Seluruh teks input harus terseleksi');
    assert.equal(input.selectionStart, 0);
    assert.equal(input.selectionEnd, 3);
  });

  await t.test('3. Default Fallback: triggerSource undefined/omitted default ke "explicit"', () => {
    const input = new MockInputElement('ETH');

    // Pemanggilan tanpa argumen triggerSource
    applySearchInputFocus(input);

    assert.equal(input.focused, true, 'Elemen input harus menerima fokus');
    assert.equal(input.selectCalls, 1, 'select() harus dipanggil jika triggerSource tidak ditentukan');
    assert.equal(input.selected, true);
    assert.equal(input.selectionStart, 0);
    assert.equal(input.selectionEnd, 3);
  });

  await t.test('4. Continuous Typing: Mengetik karakter lanjutan setelah keystroke canvas menyambung bersih tanpa menimpa karakter awal', () => {
    // Skenario Type-to-Search: Pengguna menekan 'Z' di kanvas
    const input = new MockInputElement('Z');
    applySearchInputFocus(input, 'keystroke', input.value.length);

    // Pengguna segera mengetik karakter berikutnya: 'I', 'L', 'L' (misal mencari ZIL / ZILL)
    input.typeCharacter('I');
    assert.equal(input.value, 'ZI', 'Karakter pertama "Z" tidak boleh terhapus oleh karakter kedua "I"');

    input.typeCharacter('L');
    assert.equal(input.value, 'ZIL');

    input.typeCharacter('L');
    assert.equal(input.value, 'ZILL');
  });

  await t.test('5. Continuous Typing: Pembukaan eksplisit menimpa teks sebelumnya saat karakter baru diketik', () => {
    // Skenario Ctrl+K dengan query sebelumnya 'BTC'
    const input = new MockInputElement('BTC');
    applySearchInputFocus(input, 'explicit', input.value.length);

    // Pengguna mengetik huruf baru 'S'
    input.typeCharacter('S');
    assert.equal(input.value, 'S', 'Teks sebelumnya yang terseleksi harus digantikan oleh karakter baru');
  });

  await t.test('6. Kontrak SymbolSearchModal.svelte: Mendukung prop triggerSource dan menggunakan guard seleksi', () => {
    const modalPath = resolve(__dirname, '../src/lib/components/SymbolSearchModal.svelte');
    const content = readFileSync(modalPath, 'utf-8');

    assert.ok(
      content.includes('triggerSource?:') || content.includes('triggerSource:'),
      'SymbolSearchModal harus mendefinisikan prop triggerSource di Props interface'
    );
    assert.ok(
      content.includes('applySearchInputFocus') || content.includes('setSelectionRange'),
      'SymbolSearchModal harus menerapkan penanganan kursor setSelectionRange untuk Type-to-Search'
    );
  });

  await t.test('7. Kontrak +page.svelte: onTypeToSearch menyetel triggerSource ke "keystroke" dan dioper ke SymbolSearchModal', () => {
    const pagePath = resolve(__dirname, '../src/routes/+page.svelte');
    const content = readFileSync(pagePath, 'utf-8');

    assert.ok(
      content.includes('triggerSource'),
      '+page.svelte harus mengoper triggerSource ke SymbolSearchModal'
    );
    assert.ok(
      content.includes("symbolSearchTriggerSource = 'keystroke'") ||
        content.includes('symbolSearchTriggerSource = "keystroke"'),
      '+page.svelte harus menyetel triggerSource ke "keystroke" di handler onTypeToSearch'
    );
  });
});
