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
 * Parameter input komprehensif untuk fingerprinting workspace.
 * Menjamin deteksi perubahan pada 15 dimensi state workspace (visual, skala, dock, dan trading plan).
 */
export interface WorkspaceFingerprintInput {
  id?: string;
  name?: string;
  symbol: string;
  timeframe: string;
  layout: string;
  providerId?: string;
  indicators?: Array<{ title?: string; source?: string; visible?: boolean; inputs?: any; props?: any }>;
  paneWeights?: number[];
  priceScaleState?: any;
  priceStyle?: string;
  barSpacing?: number;
  showVolume?: boolean;
  activeRightDockPanel?: string | null;
  syncConfig?: any;
  activePlans?: any[];
  showThesisCards?: boolean;
}

/**
 * Menghasilkan fingerprint string deterministik dari parameter struktural workspace
 * Digunakan oleh Workspace Auto-Save Guard untuk mencegah I/O disk berulang
 * saat mutasi referensi array terjadi tanpa adanya perubahan nilai data.
 * 
 * Mendukung pemanggilan polimorfik:
 * 1. Objek komprehensif (WorkspaceFingerprintInput) untuk memantau seluruh dimensi state.
 * 2. Posisi argumen terpisah (legacy) untuk kompatibilitas ke belakang dengan pengujian yang ada.
 */
export function computeWorkspaceFingerprint(input: WorkspaceFingerprintInput): string;
export function computeWorkspaceFingerprint(
  workspaceId: string,
  symbol: string,
  timeframe: string,
  layout: string,
  providerId: string,
  indicators?: Array<{ title?: string; source?: string; visible?: boolean; inputs?: any; props?: any }>
): string;
export function computeWorkspaceFingerprint(
  inputOrId: WorkspaceFingerprintInput | string,
  symbol?: string,
  timeframe?: string,
  layout?: string,
  providerId?: string,
  indicators?: Array<{ title?: string; source?: string; visible?: boolean; inputs?: any; props?: any }>
): string {
  if (typeof inputOrId === 'object' && inputOrId !== null) {
    const input = inputOrId;
    const wsId = input.id || input.name || 'default';
    const sym = input.symbol || '';
    const tf = input.timeframe || '';
    const ly = input.layout || '1';
    const pId = input.providerId || 'binance';

    const indParts = (input.indicators || [])
      .map((i) => {
        const inputsStr = i.inputs ? JSON.stringify(i.inputs) : '';
        const propsStr = i.props ? JSON.stringify(i.props) : '';
        return `${i.title || ''}:${i.source || ''}:${i.visible !== false}:${inputsStr}:${propsStr}`;
      })
      .sort()
      .join('|');

    const pwStr = (input.paneWeights || []).join(',');
    const pssStr = input.priceScaleState ? JSON.stringify(input.priceScaleState) : '';
    const styleStr = `${input.priceStyle || 'candles'}:${input.barSpacing ?? 8}:${input.showVolume !== false}`;
    const dockStr = input.activeRightDockPanel || '';
    const syncStr = input.syncConfig ? JSON.stringify(input.syncConfig) : '';

    const plansParts = (input.activePlans || [])
      .map((p: any) => {
        const tps = Array.isArray(p.takeProfits)
          ? p.takeProfits.map((t: any) => `${t.id || ''}:${t.price || 0}:${t.percent || 0}`).join(';')
          : '';
        return `${p.id || ''}:${p.symbol || ''}:${p.side || ''}:${p.entryPrice || 0}:${p.stopLoss || 0}:${tps}:${p.active !== false}`;
      })
      .sort()
      .join('|');

    const thesisStr = input.showThesisCards !== false ? 'thesis:on' : 'thesis:off';

    return `${wsId}:${sym}:${tf}:${ly}:${pId}#[${indParts}]#pw:[${pwStr}]#scale:[${pssStr}]#vis:[${styleStr}]#dock:[${dockStr}]#sync:[${syncStr}]#plans:[${plansParts}]#${thesisStr}`;
  }

  // Pemanggilan legacy 6 parameter posisi
  const wsId = inputOrId;
  const indParts = (indicators || [])
    .map((i) => {
      const inputsStr = i.inputs ? JSON.stringify(i.inputs) : '';
      const propsStr = i.props ? JSON.stringify(i.props) : '';
      return `${i.title || ''}:${i.source || ''}:${i.visible !== false}:${inputsStr}:${propsStr}`;
    })
    .sort()
    .join('|');

  return `${wsId || 'default'}:${symbol || ''}:${timeframe || ''}:${layout || '1'}:${providerId || 'binance'}#[${indParts}]`;
}

export {
  loadWorkspaces,
  saveWorkspace,
  updateWorkspace,
  deleteWorkspace,
};
