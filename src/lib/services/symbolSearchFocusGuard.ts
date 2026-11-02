export type SearchTriggerSource = 'keystroke' | 'explicit';

export interface FocusableSearchInputElement {
  focus: () => void;
  select: () => void;
  setSelectionRange: (start: number, end: number) => void;
  value: string;
}

/**
 * Menerapkan penanganan fokus kontekstual pada input modal pencarian simbol (Tiket #145).
 * 
 * - Jika modal dipicu oleh keystroke kanvas ('keystroke' / Type-to-Search):
 *   Kursor diletakkan di akhir teks (`setSelectionRange(len, len)`) tanpa memanggil `select()`,
 *   sehingga pengetikan karakter berikutnya menyambung secara kontinu tanpa menimpa karakter awal.
 * 
 * - Jika modal dibuka secara eksplisit ('explicit' / `Ctrl+K` / klik tombol pencarian):
 *   Teks diseleksi penuh via `select()` agar pengguna dapat langsung mengganti simbol sebelumnya.
 */
export function applySearchInputFocus(
  inputEl: FocusableSearchInputElement | null | undefined,
  triggerSource: SearchTriggerSource = 'explicit',
  queryLength?: number
): void {
  if (!inputEl) return;
  inputEl.focus();

  if (triggerSource === 'keystroke') {
    const len = typeof queryLength === 'number' ? queryLength : (inputEl.value ? inputEl.value.length : 0);
    inputEl.setSelectionRange(len, len);
  } else {
    inputEl.select();
  }
}
