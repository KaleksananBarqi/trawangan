/**
 * Modul Koordinator Lifecycle Workspace dan Auto-Save Guard Engine
 * 
 * Modul ini menjadi fasad dalam arsitektur deep module untuk:
 * 1. Menjalankan pipeline pemuatan workspace secara terstruktur, deterministik, dan bebas race-condition.
 * 2. Mengenkapsulasi tahapan double-barrier clean-slate, navigasi bursa, restorasi indikator Pine,
 *    pemulihan skala harga, bobot pane, dan rekonstruksi rencana perdagangan (Multi-Target Trading Plans).
 * 3. Mengelola siklus auto-save workspace ber-debounce dengan dirty-checking berbasis Comprehensive Fingerprint.
 */

import type { SavedWorkspace, ActiveIndicatorInfo } from '../types/market';
import {
  computeWorkspaceFingerprint,
  type WorkspaceFingerprintInput,
} from './persistence/workspaceService';

export interface WorkspaceChartPort {
  clearAllIndicators(): void;
  addPineIndicator(source: string, title?: string, inputs?: any, props?: any): Promise<void>;
  getActiveIndicators(): any[];
  toggleIndicatorVisibility(idOrTitle: string): void;
  setPriceStyle(style: string): void;
  setBarSpacing(spacing: number): void;
  applyPriceScaleState(state: any): void;
  applyPaneWeights(weights: number[]): void;
}

export interface WorkspacePlanPort {
  setWorkspaceId(id: string): void;
  clearAllPlans(): void;
  clearCanvasVisuals?(): void;
  restorePlans(plans: any[], showThesisCards?: boolean): void;
  getActivePlans(): any[];
  isThesisCardsVisible(): boolean;
  flushDrawings?(): Promise<void>;
}

export interface WorkspaceShellPort {
  openRightDockTab(tab: string): void;
  closeRightDock(): void;
}

export interface WorkspaceLoadPipelineOptions {
  workspace: SavedWorkspace;
  chart: WorkspaceChartPort;
  plan: WorkspacePlanPort;
  shell?: WorkspaceShellPort;
  activeProviderId: string;
  onProviderChange: (providerId: string) => Promise<void>;
  onSymbolChange: (symbol: string) => Promise<void>;
  onTimeframeChange: (timeframe: any) => void;
  onLayoutChange: (layout: string) => void;
  onSyncConfigChange?: (config: any) => void;
  onShowVolumeChange?: (show: boolean) => void;
  onSyncIndicators: () => void;
  onLog?: (message: string, level?: 'info' | 'success' | 'warn' | 'error') => void;
}

export interface WorkspaceLoadResult {
  success: boolean;
  fingerprint: string;
  indicatorCount: number;
  indicatorTitles: string;
  error?: Error;
}

/**
 * Menjalankan pipeline pemuatan workspace terpadu secara atomik dan deterministik.
 */
export async function executeWorkspaceLoadPipeline(
  options: WorkspaceLoadPipelineOptions
): Promise<WorkspaceLoadResult> {
  const {
    workspace: w,
    chart,
    plan,
    shell,
    activeProviderId,
    onProviderChange,
    onSymbolChange,
    onTimeframeChange,
    onLayoutChange,
    onSyncConfigChange,
    onShowVolumeChange,
    onSyncIndicators,
    onLog,
  } = options;

  try {
    // 1. Inisialisasi identitas workspace pada modul gambar & flush
    if (w.id) {
      plan.setWorkspaceId(w.id);
    }
    if (typeof plan.flushDrawings === 'function') {
      try { await plan.flushDrawings(); } catch (_) {}
    }

    // 2. Tahap 1 Clean-slate: Kosongkan indikator chart lama
    chart.clearAllIndicators();

    // 3. Terapkan konfigurasi provider, simbol, timeframe, dan layout
    if (w.providerId && w.providerId !== activeProviderId) {
      await onProviderChange(w.providerId);
    }
    await onSymbolChange(w.symbol);
    onTimeframeChange(w.timeframe);
    onLayoutChange(w.layout);

    if (w.syncConfig && typeof onSyncConfigChange === 'function') {
      onSyncConfigChange(w.syncConfig);
    }

    if (shell && w.activeRightDockPanel !== undefined) {
      if (w.activeRightDockPanel === null) {
        shell.closeRightDock();
      } else {
        shell.openRightDockTab(w.activeRightDockPanel);
      }
    }

    if (w.showVolume !== undefined && typeof onShowVolumeChange === 'function') {
      onShowVolumeChange(w.showVolume);
    }

    // Barrier jeda singkat agar render grid layout & WebGL stabil
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 4. Tahap 2 Clean-slate (Double-barrier): Pastikan chart benar-benar bersih sebelum memuat indikator baru
    chart.clearAllIndicators();

    // 5. Muat indikator dari workspace secara deterministik dengan inputs & props lengkap
    if (Array.isArray(w.indicators) && w.indicators.length > 0) {
      for (const ind of w.indicators) {
        if (ind?.source) {
          try {
            await chart.addPineIndicator(ind.source, ind.title, ind.inputs, ind.props);
            if (ind.visible === false && ind.title) {
              const active = chart.getActiveIndicators();
              const target = active.find((a: any) => a.title === ind.title);
              if (target && target.visible) {
                chart.toggleIndicatorVisibility(target.id || target.title);
              }
            }
          } catch (e) {
            console.warn(`[WorkspaceLifecycle] Gagal memuat indikator ${ind.title}:`, e);
          }
        }
      }
    }

    // 6. Sinkronkan state indikator akhir ke UI
    onSyncIndicators();

    // 7. Pulihkan skala lilin, zoom barSpacing, skala harga, dan bobot pane
    if (w.priceStyle) {
      chart.setPriceStyle(w.priceStyle);
    }
    if (w.barSpacing) {
      chart.setBarSpacing(w.barSpacing);
    }
    if (w.priceScaleState) {
      chart.applyPriceScaleState(w.priceScaleState);
    }
    if (Array.isArray(w.paneWeights) && w.paneWeights.length > 0) {
      chart.applyPaneWeights(w.paneWeights);
    }

    // 8. Pulihkan rencana perdagangan dan kartu tesis aktif (#116)
    if (Array.isArray(w.activePlans) && w.activePlans.length > 0) {
      plan.restorePlans(w.activePlans, w.showThesisCards ?? true);
    } else {
      plan.clearAllPlans();
    }

    // 9. Hitung fingerprint komprehensif untuk auto-save guard
    const latestIndicators = chart.getActiveIndicators();
    const fingerprint = computeWorkspaceFingerprint({
      id: w.id || w.name,
      name: w.name,
      symbol: w.symbol,
      timeframe: w.timeframe,
      layout: w.layout,
      providerId: w.providerId || activeProviderId,
      indicators: latestIndicators.length > 0 ? latestIndicators : w.indicators || [],
      paneWeights: w.paneWeights,
      priceScaleState: w.priceScaleState,
      priceStyle: w.priceStyle,
      barSpacing: w.barSpacing,
      showVolume: w.showVolume,
      activeRightDockPanel: w.activeRightDockPanel,
      syncConfig: w.syncConfig,
      activePlans: plan.getActivePlans(),
      showThesisCards: plan.isThesisCardsVisible(),
    });

    const indCount = w.indicators?.length || 0;
    const indTitles = w.indicators && w.indicators.length > 0
      ? w.indicators.map((i: any) => i.title).join(', ')
      : 'tanpa indikator';

    if (onLog) {
      onLog(`Workspace "${w.name}" dimuat (${indCount} indikator: ${indTitles})`, 'success');
    }

    return {
      success: true,
      fingerprint,
      indicatorCount: indCount,
      indicatorTitles: indTitles,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn('[WorkspaceLifecycle] Gagal memuat workspace:', error);
    if (onLog) {
      onLog(`Gagal memuat workspace: ${error.message}`, 'warn');
    }
    return {
      success: false,
      fingerprint: '',
      indicatorCount: 0,
      indicatorTitles: '',
      error,
    };
  }
}

export interface AutoSaveCoordinatorOptions {
  debounceMs?: number;
  onSave: (input: WorkspaceFingerprintInput) => Promise<SavedWorkspace | void>;
  onError?: (err: any) => void;
}

/**
 * Koordinator auto-save workspace yang aman, tahan debouncing, dan berbasis dirty-checking komprehensif.
 */
export class WorkspaceAutoSaveCoordinator {
  private timer: any = null;
  private isSaving = false;
  private lastSavedFingerprint = '';
  private debounceMs: number;
  private onSave: (input: WorkspaceFingerprintInput) => Promise<SavedWorkspace | void>;
  private onError?: (err: any) => void;

  constructor(options: AutoSaveCoordinatorOptions) {
    this.debounceMs = options.debounceMs ?? 3500;
    this.onSave = options.onSave;
    this.onError = options.onError;
  }

  public getSavedFingerprint(): string {
    return this.lastSavedFingerprint;
  }

  public setSavedFingerprint(fp: string): void {
    this.lastSavedFingerprint = fp;
  }

  public cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public isPending(): boolean {
    return this.timer !== null || this.isSaving;
  }

  /**
   * Memicu auto-save jika fingerprint input berbeda dengan fingerprint yang sudah tersimpan.
   */
  public trigger(input: WorkspaceFingerprintInput): string | null {
    const currentFingerprint = computeWorkspaceFingerprint(input);

    // KUNCI GUARD: Jika fingerprint nilai sama persis dengan yang sudah tersimpan, abaikan!
    if (this.lastSavedFingerprint && this.lastSavedFingerprint === currentFingerprint) {
      return null;
    }

    this.cancel();

    this.timer = setTimeout(async () => {
      this.timer = null;
      if (this.isSaving) return;
      this.isSaving = true;

      try {
        await this.onSave(input);
        this.lastSavedFingerprint = currentFingerprint;
      } catch (err) {
        if (this.onError) {
          this.onError(err);
        } else {
          console.warn('[WorkspaceAutoSaveCoordinator] Gagal menyimpan workspace:', err);
        }
      } finally {
        this.isSaving = false;
      }
    }, this.debounceMs);

    return currentFingerprint;
  }
}
