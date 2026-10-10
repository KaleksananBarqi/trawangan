import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * Layanan utilitas untuk membuka URL eksternal di browser default sistem.
 * Mendukung Tauri v2 Desktop (via @tauri-apps/plugin-opener) dan fallback browser web standar.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;

  try {
    await openUrl(url);
  } catch (err) {
    // Fallback jika opener gagal atau aplikasi dijalankan di lingkungan web/dev browser
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
