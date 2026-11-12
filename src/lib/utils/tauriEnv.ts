/**
 * Utilitas bersama untuk mendeteksi apakah aplikasi berjalan di dalam shell desktop Tauri.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
