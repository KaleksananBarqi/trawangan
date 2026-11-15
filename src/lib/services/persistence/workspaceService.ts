/**
 * Modul Tata Kelola Workspace dan Persistensi Startup Trawangan
 * 
 * Melacak workspace aktif dan mengelola penyimpanan serta pembacaan ID workspace terakhir.
 */
import type { SavedWorkspace } from '../../types/market';
import { normalizeWorkspace } from './workspaceSchema';
import {
  loadWorkspaces,
  saveWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getLastActiveWorkspaceId,
  setLastActiveWorkspaceId,
} from './index';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * Menghasilkan fingerprint string deterministik langsung dari struktur kanonik SavedWorkspace
 * yang telah dinormalkan (tanpa tipe proyeksi manual terpisah).
 * Digunakan oleh Workspace Auto-Save Guard untuk mendeteksi perubahan seluruh dimensi state
 * (termasuk priceScaleCountdown di root maupun per-sel) sambil mengabaikan timestamp.
 *
 * Mendukung pemanggilan polimorfik:
 * 1. Objek kanonik SavedWorkspace (atau Partial<SavedWorkspace>) untuk memantau seluruh dimensi state.
 * 2. Posisi argumen terpisah (legacy) untuk kompatibilitas ke belakang dengan pengujian yang ada.
 */
export function computeWorkspaceFingerprint(workspace: Partial<SavedWorkspace>): string;
export function computeWorkspaceFingerprint(
  workspaceId: string,
  symbol: string,
  timeframe: string,
  layout: string,
  providerId: string,
  indicators?: Array<{ title?: string; source?: string; visible?: boolean; inputs?: any; props?: any }>
): string;
export function computeWorkspaceFingerprint(
  inputOrId: Partial<SavedWorkspace> | string,
  symbol?: string,
  timeframe?: string,
  layout?: string,
  providerId?: string,
  indicators?: Array<{ title?: string; source?: string; visible?: boolean; inputs?: any; props?: any }>
): string {
  if (typeof inputOrId === 'object' && inputOrId !== null) {
    // Normalkan ke skema v2 kanonik lalu buang timestamp agar waktu simpan tidak memicu dirty palsu
    const normalized = normalizeWorkspace(inputOrId);
    const { timestamp: _timestamp, ...canonical } = normalized;
    return stableStringify(canonical);
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
  getLastActiveWorkspaceId,
  setLastActiveWorkspaceId,
};
