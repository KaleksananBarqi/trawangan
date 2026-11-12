/**
 * panelResizeHelper — Helper modular untuk sesi resize tepi panel berbasis pointer & keyboard.
 * Mengelola event listener `window` secara deterministik dan menyediakan fungsi `cancel()`
 * untuk pembersihan aman pada `onDestroy` agar tidak terjadi memory leak.
 */
import { storage } from './persistence';
import type { IPersistenceService, UiPreferenceKey } from './persistence/types';

export interface ResizeWindowTarget {
  innerWidth: number;
  addEventListener: (type: 'pointermove' | 'pointerup' | 'pointercancel', listener: (ev: any) => void) => void;
  removeEventListener: (type: 'pointermove' | 'pointerup' | 'pointercancel', listener: (ev: any) => void) => void;
  dispatchEvent?: (event: Event) => boolean;
}

export interface EdgeResizeOptions {
  startClientX: number;
  startWidth: number;
  minWidth: number;
  maxCap: number;
  /** Rasio maksimal lebar panel terhadap lebar viewport (default 0.6) */
  viewportMaxRatio?: number;
  /** Tepi panel yang ditarik: `'left-edge'` untuk panel dock kanan, `'right-edge'` untuk panel kiri */
  edge?: 'left-edge' | 'right-edge';
  /** Kunci preferensi UI PersistenceService untuk menyimpan lebar final saat pointer dilepas */
  preferenceKey?: UiPreferenceKey;
  /** Kunci storage kustom opsional (hanya dipakai jika `storage` disuntikkan eksplisit) */
  storageKey?: string;
  /** Pancarkan `window.dispatchEvent(new Event('resize'))` setelah selesai drag (default `true`) */
  dispatchResizeEvent?: boolean;
  onResize: (nextWidth: number) => void;
  onEnd?: (finalWidth: number, committed: boolean) => void;
  /** Dependency injection opsional untuk pengujian unit tanpa DOM global */
  windowTarget?: ResizeWindowTarget | null;
  persistence?: Pick<IPersistenceService, 'setUiPreference'> | null;
  storage?: Pick<Storage, 'setItem'> | null;
}

export interface EdgeResizeSession {
  cancel: () => void;
}

/**
 * Menghitung lebar panel yang terkunci dalam batas `[minWidth, maxCap]` serta batas rasio viewport.
 */
export function clampPanelWidth(
  candidateWidth: number,
  minWidth: number,
  maxCap: number,
  viewportWidth?: number,
  viewportMaxRatio = 0.6
): number {
  const viewportMax =
    typeof viewportWidth === 'number' && viewportWidth > 0
      ? Math.floor(viewportWidth * viewportMaxRatio)
      : maxCap;
  const effectiveMax = Math.max(minWidth, Math.min(maxCap, viewportMax));
  return Math.round(Math.max(minWidth, Math.min(effectiveMax, candidateWidth)));
}

/**
 * Menghitung lebar baru saat pengguna mengubah ukuran pemisah (separator) memakai keyboard.
 */
export function adjustPanelWidthByKeyboard(
  key: string,
  shiftKey: boolean,
  currentWidth: number,
  minWidth: number,
  maxCap: number,
  edge: 'left-edge' | 'right-edge' = 'left-edge',
  viewportMaxRatio = 0.6
): number | null {
  const step = shiftKey ? 40 : 16;
  let delta = 0;

  if (key === 'ArrowLeft') {
    delta = edge === 'left-edge' ? step : -step;
  } else if (key === 'ArrowRight') {
    delta = edge === 'left-edge' ? -step : step;
  } else {
    return null;
  }

  const vw = typeof window !== 'undefined' ? window.innerWidth : undefined;
  return clampPanelWidth(currentWidth + delta, minWidth, maxCap, vw, viewportMaxRatio);
}

/**
 * Memulai sesi resize tepi panel menggunakan pointer event pada `window`.
 * Kembalikan `{ cancel }` untuk membatalkan serta melepas seluruh listener ketika komponen di-unmount.
 */
export function startEdgeResizeSession(options: EdgeResizeOptions): EdgeResizeSession {
  const target: ResizeWindowTarget | null =
    options.windowTarget !== undefined
      ? options.windowTarget
      : typeof window !== 'undefined'
        ? (window as unknown as ResizeWindowTarget)
        : null;

  if (!target) {
    return { cancel: () => {} };
  }

  const edge = options.edge ?? 'left-edge';
  const ratio = options.viewportMaxRatio ?? 0.6;
  const shouldDispatch = options.dispatchResizeEvent !== false;
  let latestWidth = options.startWidth;
  let active = true;

  const cleanup = () => {
    target.removeEventListener('pointermove', handlePointerMove);
    target.removeEventListener('pointerup', handlePointerUp);
    target.removeEventListener('pointercancel', handlePointerCancel);
  };

  const handlePointerMove = (ev: { clientX?: number }) => {
    if (!active || typeof ev?.clientX !== 'number') return;
    const rawDelta =
      edge === 'left-edge'
        ? options.startClientX - ev.clientX
        : ev.clientX - options.startClientX;

    latestWidth = clampPanelWidth(
      options.startWidth + rawDelta,
      options.minWidth,
      options.maxCap,
      target.innerWidth,
      ratio
    );
    options.onResize(latestWidth);
  };

  const finish = (committed: boolean) => {
    if (!active) return;
    active = false;
    cleanup();

    if (committed) {
      if (options.preferenceKey) {
        const persistenceService =
          options.persistence !== undefined ? options.persistence : storage;
        if (persistenceService) {
          void persistenceService.setUiPreference(options.preferenceKey, latestWidth).catch(() => {});
        }
      } else if (options.storageKey && options.storage) {
        try {
          options.storage.setItem(options.storageKey, String(latestWidth));
        } catch (_) {}
      }

      if (shouldDispatch && typeof target.dispatchEvent === 'function' && typeof Event !== 'undefined') {
        try {
          target.dispatchEvent(new Event('resize'));
        } catch (_) {}
      }
    }

    options.onEnd?.(latestWidth, committed);
  };

  const handlePointerUp = () => finish(true);
  const handlePointerCancel = () => finish(false);

  target.addEventListener('pointermove', handlePointerMove);
  target.addEventListener('pointerup', handlePointerUp);
  target.addEventListener('pointercancel', handlePointerCancel);

  return {
    cancel: () => finish(false)
  };
}
