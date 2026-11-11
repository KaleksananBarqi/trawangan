/**
 * Modul Tata Kelola Workspace dan Persistensi Startup Trawangan
 * 
 * Melacak workspace aktif dan mengelola penyimpanan serta pembacaan ID workspace terakhir.
 */
import type {
  CellSnapshot,
  NativeIndicatorSnapshot,
  PaneLayoutEntry,
  SavedWorkspace,
  SnapMode,
  VisibleRangeSnapshot,
} from '../../types/market';
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
 * Menjamin deteksi perubahan pada seluruh dimensi state workspace v2 (visual, pane layout, indikator native, viewport, multi-cell, skala, dock, dan trading plan).
 */
export interface WorkspaceFingerprintInput {
  id?: string;
  name?: string;
  schemaVersion?: number;
  symbol: string;
  timeframe: string;
  layout: string;
  providerId?: string;
  indicators?: Array<{ title?: string; source?: string; visible?: boolean; inputs?: any; props?: any }>;
  paneWeights?: number[];
  paneLayout?: PaneLayoutEntry[];
  priceScaleState?: any;
  priceStyle?: string;
  barSpacing?: number;
  showVolume?: boolean;
  nativeIndicators?: NativeIndicatorSnapshot[];
  visibleRange?: VisibleRangeSnapshot | null;
  cells?: CellSnapshot[];
  trackSizes?: { cols?: number[]; rows?: number[] };
  activeCellIndex?: number;
  activeRightDockPanel?: string | null;
  syncConfig?: any;
  activePlans?: any[];
  showThesisCards?: boolean;
  thesisCardGeometry?: Record<string, any>;
  drawingToolbar?: { snapMode?: SnapMode; stayMode?: boolean };
}

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
        const inputsStr = i.inputs ? stableStringify(i.inputs) : '';
        const propsStr = i.props ? stableStringify(i.props) : '';
        return `${i.title || ''}:${i.source || ''}:${i.visible !== false}:${inputsStr}:${propsStr}`;
      })
      .sort()
      .join('|');

    const pwStr = (input.paneWeights || []).join(',');
    const plStr = input.paneLayout ? stableStringify(input.paneLayout) : '';
    const niStr = input.nativeIndicators ? stableStringify(input.nativeIndicators) : '';
    const pssStr = input.priceScaleState ? stableStringify(input.priceScaleState) : '';
    const styleStr = `${input.priceStyle || 'candles'}:${input.barSpacing ?? 8}:${input.showVolume !== false}`;
    const vrStr = input.visibleRange ? stableStringify(input.visibleRange) : '';
    const dockStr = input.activeRightDockPanel || '';
    const syncStr = input.syncConfig ? stableStringify(input.syncConfig) : '';
    const cellsStr = input.cells ? stableStringify(input.cells) : '';
    const tracksStr = input.trackSizes ? stableStringify(input.trackSizes) : '';
    const activeCellStr = input.activeCellIndex !== undefined ? String(input.activeCellIndex) : '';
    const geomStr = input.thesisCardGeometry ? stableStringify(input.thesisCardGeometry) : '';
    const tbStr = input.drawingToolbar ? stableStringify(input.drawingToolbar) : '';

    // Mendukung kedua skema: ParsedTradingPlan (bias/entry/entries/targets) maupun legacy (side/entryPrice/takeProfits)
    const plansParts = (input.activePlans || [])
      .map((p: any) => {
        const dir = p.bias ?? p.side ?? '';
        const entryVal = p.entry ?? p.entryPrice ?? 0;
        const entriesVal = Array.isArray(p.entries)
          ? p.entries.map((e: any) => `${e.id || ''}:${e.price ?? 0}:${e.ratio ?? ''}`).join(',')
          : '';
        const targetList = Array.isArray(p.targets)
          ? p.targets
          : Array.isArray(p.takeProfits)
            ? p.takeProfits
            : [];
        const tps = targetList
          .map((t: any) => `${t.id || ''}:${t.price ?? 0}:${t.percent ?? t.allocationPct ?? 0}`)
          .join(';');
        return `${p.id || ''}:${p.symbol || ''}:${dir}:${entryVal}:[${entriesVal}]:${p.stopLoss ?? 0}:${tps}:${p.active !== false}`;
      })
      .sort()
      .join('|');

    const thesisStr = input.showThesisCards !== false ? 'thesis:on' : 'thesis:off';

    return `${wsId}:${sym}:${tf}:${ly}:${pId}#[${indParts}]#pw:[${pwStr}]#pl:[${plStr}]#ni:[${niStr}]#scale:[${pssStr}]#vis:[${styleStr}]#vr:[${vrStr}]#dock:[${dockStr}]#sync:[${syncStr}]#cells:[${cellsStr}]#tracks:[${tracksStr}]#ac:${activeCellStr}#plans:[${plansParts}]#${thesisStr}#geom:[${geomStr}]#tb:[${tbStr}]`;
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
