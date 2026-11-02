/**
 * Modul Tata Kelola Workspace dan Persistensi Startup Trawangan
 * 
 * Melacak workspace aktif dan mengelola penyimpanan serta pembacaan ID workspace terakhir.
 */
import type { SavedWorkspace } from '../../types/market';
import { loadWorkspaces, saveWorkspace, updateWorkspace, deleteWorkspace } from './index';

export const LAST_WORKSPACE_STORAGE_KEY = 'trawangan_last_workspace_id';

function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

/**
 * Membaca ID workspace yang terakhir kali aktif
 */
export function getLastActiveWorkspaceId(): string | null {
  const store = getLocalStorage();
  if (!store) return null;
  try {
    const id = store.getItem(LAST_WORKSPACE_STORAGE_KEY);
    return id && id.trim().length > 0 ? id.trim() : null;
  } catch (err) {
    console.warn('[workspaceService] Gagal membaca ID workspace terakhir:', err);
    return null;
  }
}

/**
 * Menyimpan ID workspace yang aktif untuk dimuat kembali pada startup berikutnya
 */
export function setLastActiveWorkspaceId(id: string | null | undefined): void {
  const store = getLocalStorage();
  if (!store) return;
  try {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      store.removeItem(LAST_WORKSPACE_STORAGE_KEY);
    } else {
      store.setItem(LAST_WORKSPACE_STORAGE_KEY, id.trim());
    }
  } catch (err) {
    console.warn('[workspaceService] Gagal menyimpan ID workspace terakhir:', err);
  }
}

/**
 * Menghasilkan fingerprint string deterministik dari parameter struktural workspace
 * Digunakan oleh Workspace Auto-Save Guard untuk mencegah I/O disk berulang
 * saat mutasi referensi array terjadi tanpa adanya perubahan nilai data.
 */
export function computeWorkspaceFingerprint(
  workspaceId: string,
  symbol: string,
  timeframe: string,
  layout: string,
  providerId: string,
  indicators?: Array<{ title?: string; source?: string; visible?: boolean; inputs?: any; props?: any }>
): string {
  const indParts = (indicators || [])
    .map((i) => {
      const inputsStr = i.inputs ? JSON.stringify(i.inputs) : '';
      const propsStr = i.props ? JSON.stringify(i.props) : '';
      return `${i.title || ''}:${i.source || ''}:${i.visible !== false}:${inputsStr}:${propsStr}`;
    })
    .sort()
    .join('|');

  return `${workspaceId || 'default'}:${symbol || ''}:${timeframe || ''}:${layout || '1'}:${providerId || 'binance'}#[${indParts}]`;
}

export {
  loadWorkspaces,
  saveWorkspace,
  updateWorkspace,
  deleteWorkspace,
};
