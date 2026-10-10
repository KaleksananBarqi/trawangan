// Layanan Notifikasi Native Sistem Windows (Windows Toast & Action Center)
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification';

/**
 * Format angka harga agar rapi
 */
function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '--';
  if (val >= 1000) return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (val >= 1) return val.toFixed(4);
  return val.toFixed(6);
}

/**
 * Terjemahkan kondisi alert ke teks bahasa Indonesia yang intuitif
 */
function getConditionText(cond: string): string {
  switch (cond) {
    case 'crossing_up':
    case 'above':
      return 'Menembus ke Atas (Crossing Up)';
    case 'crossing_down':
    case 'below':
      return 'Menembus ke Bawah (Crossing Down)';
    case 'greater_than':
      return 'Lebih Besar Dari (Greater Than)';
    case 'less_than':
      return 'Lebih Kecil Dari (Less Than)';
    case 'crossing':
    default:
      return 'Menyentuh Level (Crossing)';
  }
}

/**
 * Pastikan izin notifikasi sistem telah diberikan oleh pengguna
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    return granted;
  } catch (err) {
    // Fallback jika dijalankan di browser web standar
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      }
    }
    console.warn('Gagal memverifikasi izin notifikasi sistem:', err);
    return false;
  }
}

export interface WindowsAlertOptions {
  symbol: string;
  targetPrice: number;
  actualPrice?: number;
  condition?: string;
  label?: string;
}

/**
 * Kirim notifikasi toast native ke sistem Windows
 */
export async function sendWindowsAlertNotification(opts: WindowsAlertOptions): Promise<boolean> {
  const symbol = opts.symbol.toUpperCase();
  const targetFormatted = formatNumber(opts.targetPrice);
  const actualFormatted = opts.actualPrice ? formatNumber(opts.actualPrice) : targetFormatted;
  const condText = getConditionText(opts.condition || 'crossing');

  const title = `🔔 Price Alert: ${symbol}`;
  const body = opts.label && opts.label.trim()
    ? `Target $${targetFormatted} tercapai! (${opts.label})\nHarga: $${actualFormatted} • ${condText}`
    : `Target $${targetFormatted} tercapai! (Harga: $${actualFormatted})\nKondisi: ${condText}`;

  try {
    const hasPermission = await ensureNotificationPermission();
    if (hasPermission) {
      sendNotification({
        title,
        body,
      });
      return true;
    }
  } catch (err) {
    // Fallback Web Notification API
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icons/128x128.png',
        });
        return true;
      }
    } catch (_) {}
    console.warn('Gagal mengirim notifikasi toast Windows:', err);
  }
  return false;
}

/**
 * Kirim notifikasi uji coba untuk memverifikasi Windows Action Center
 */
export async function sendTestNotification(): Promise<boolean> {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return false;
  }

  try {
    sendNotification({
      title: '🔔 Trawangan Terminal - Tes Notifikasi Windows',
      body: 'Integrasi notifikasi desktop Windows aktif! Anda akan menerima alert saat target harga tercapai.',
    });
    return true;
  } catch (err) {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🔔 Trawangan Terminal - Tes Notifikasi Windows', {
          body: 'Integrasi notifikasi desktop Windows aktif!',
          icon: '/icons/128x128.png',
        });
        return true;
      }
    } catch (_) {}
    console.warn('Gagal mengirim notifikasi tes:', err);
    return false;
  }
}
