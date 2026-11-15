import { getNativeIndicator } from '@luxalgo/vela';
import { IndicatorRegistry } from './indicatorRegistry';
import { normalizeVpvrInputs } from './vpvrProfile';
import { resolveEffectiveVolumeColors } from '../constants/themes';
import { isVolumeIndicator } from '../data/indicatorPresets';
import { computePaneSignature } from './persistence/workspaceSchema';
import type {
  ActiveIndicatorInfo,
  CustomThemePalette,
  NativeIndicatorSnapshot,
  PaneLayoutEntry,
  SavedWorkspaceIndicator,
  ThemePresetId,
} from '../types/market';

export type StudyLanguage = 'pine' | 'native';

export interface StudyDescriptor {
  id?: string;
  language: StudyLanguage;
  title: string;
  source?: string;
  nativeType?: string;
  visible?: boolean;
  placement?: 'overlay' | 'own-pane';
  inputs?: Record<string, any>;
  props?: Record<string, any>;
}

export interface CellStudySnapshot {
  pine: SavedWorkspaceIndicator[];
  native: NativeIndicatorSnapshot[];
  unified: ActiveIndicatorInfo[];
}

export interface StudyThemeContext {
  themePreset: ThemePresetId | string;
  customPalette?: CustomThemePalette | null;
  customCandleColors?: { bullColor?: string; bearColor?: string } | null;
}

export interface ChartStudyManagerHooks {
  getThemeContext?: () => StudyThemeContext;
  withSuppressedPersistEvents?: (fn: () => void) => void;
  scheduleTimeout?: (fn: () => void, ms: number) => void;
  onStudyRemoved?: (id: string) => void;
  onStudiesChanged?: () => void;
  onPersistableChange?: (reason: string) => void;
  onPineStrategyMounted?: (cell: any, handle: any, title: string) => void;
  enableTradeVisibility?: (cell: any) => void;
  onVolumeVisibilityChanged?: (cell: any, visible: boolean) => void;
  waitForChartCondition?: (
    chart: any,
    events: string[],
    predicate: () => boolean,
    timeoutMs: number
  ) => Promise<void>;
  isDestroyed?: () => boolean;
}

/**
 * ChartStudyManager - Modul siklus hidup study (indikator Pine & Native) berbasis sel.
 * Mengelola penambahan, penghapusan, toggle visibilitas, pembaruan input, normalisasi VPVR,
 * sinkronisasi warna Native Volume Overlay, komputasi Pane Signature, cloning multi-sel,
 * serta capture/restore snapshot study per sel secara seragam.
 */
export class ChartStudyManager {
  constructor(
    private readonly registry: IndicatorRegistry,
    private readonly hooks: ChartStudyManagerHooks = {}
  ) {}

  /**
   * Menambahkan satu study (Pine atau Native) ke satu sel target secara seragam dan sinkron.
   */
  public addStudySync(
    cell: any,
    descriptor: StudyDescriptor,
    options?: { deduplicate?: boolean; register?: boolean }
  ): any | null {
    const chart = cell?.chart || cell?.inner;
    if (!cell || !chart) return null;

    if (descriptor.language === 'native') {
      return this.mountNativeOnCell(cell, chart, descriptor, options);
    }
    return this.mountPineOnCell(cell, chart, descriptor, options);
  }

  /**
   * Menambahkan satu study (Pine atau Native) ke satu sel target secara seragam.
   */
  public async addStudy(
    cell: any,
    descriptor: StudyDescriptor,
    options?: { deduplicate?: boolean; register?: boolean }
  ): Promise<any | null> {
    return this.addStudySync(cell, descriptor, options);
  }

  /**
   * Menambahkan satu study ke banyak sel sekaligus dan mendaftarkan seluruh handle secara terpadu.
   */
  public async addStudyToCells(
    cells: any[],
    descriptor: StudyDescriptor,
    options?: { deduplicate?: boolean }
  ): Promise<{ ok: boolean; handles: any[]; firstHandle: any | null }> {
    const validCells = (cells || []).filter((c) => Boolean(c?.chart || c?.inner));
    if (validCells.length === 0) {
      return { ok: false, handles: [], firstHandle: null };
    }

    if (descriptor.language === 'pine' && options?.deduplicate !== false) {
      const cleanTitle = (descriptor.title || 'Custom Indicator').trim();
      const trimmedSource = (descriptor.source || '').trim();
      for (const entry of this.registry.getActiveIndicators(undefined, () => validCells)) {
        if (entry.title === cleanTitle || (trimmedSource && entry.source && entry.source.trim() === trimmedSource)) {
          this.removeStudy(entry.id, validCells, true);
        }
      }
    }

    const createdHandles: any[] = [];
    let firstHandle: any = null;

    for (const cell of validCells) {
      const handle = await this.addStudy(cell, descriptor, {
        deduplicate: options?.deduplicate,
        register: false,
      });
      if (handle) {
        createdHandles.push(handle);
        if (!firstHandle) firstHandle = handle;
      }
    }

    if (!firstHandle) {
      return { ok: false, handles: [], firstHandle: null };
    }

    const normalized = this.resolveStudyInputs(descriptor);
    const cleanType = this.resolveNativeType(descriptor);
    const cleanTitle = (descriptor.title || firstHandle.title || cleanType || 'Custom Indicator').trim();

    if (descriptor.language === 'native' && cleanType === 'volume') {
      this.syncVolumeColors(validCells, undefined, true);
    }

    this.registry.register({
      id: firstHandle.id,
      handle: firstHandle,
      handles: createdHandles,
      title: cleanTitle,
      source: descriptor.language === 'native' ? cleanType : (descriptor.source || ''),
      visible: firstHandle.visible ?? descriptor.visible ?? true,
      inputs: normalized.inputs,
      props: descriptor.props,
    });

    if (descriptor.language === 'pine' && normalized.inputs && Object.keys(normalized.inputs).length > 0) {
      const schedule = this.hooks.scheduleTimeout;
      if (schedule) {
        schedule(() => {
          this.runWithSuppressedPersist(() => {
            for (const h of createdHandles) {
              try {
                if (typeof h?.setInputs === 'function') h.setInputs(normalized.inputs);
              } catch (_) {}
            }
          });
          this.hooks.onStudiesChanged?.();
        }, 350);
      }
    }

    this.hooks.onStudiesChanged?.();
    if (descriptor.language === 'native') {
      this.hooks.onPersistableChange?.('indicator:add_native');
    }
    return { ok: true, handles: createdHandles, firstHandle };
  }

  /**
   * Menghapus study dari registry dan sel target.
   */
  public removeStudy(id: string, cells: any[] = [], syncAllCells: boolean = true): boolean {
    if (id) {
      this.hooks.onStudyRemoved?.(id);
    }
    const ok = this.registry.removeIndicator(id, syncAllCells, () => cells);
    this.hooks.onStudiesChanged?.();
    this.hooks.onPersistableChange?.('indicator:remove');
    return ok;
  }

  /**
   * Mengubah visibilitas study pada sel aktif atau seluruh sel.
   */
  public toggleStudyVisibility(id: string, syncAllCells: boolean = true): boolean | null {
    const next = this.registry.toggleVisibility(id, syncAllCells);
    this.hooks.onStudiesChanged?.();
    this.hooks.onPersistableChange?.('indicator:visibility');
    return next;
  }

  /**
   * Memperbarui input study dan menormalisasi parameter VPVR secara otomatis.
   */
  public updateStudyInputs(id: string, inputs: Record<string, any>): boolean {
    const entry = this.registry.findEntry(id)?.entry;
    const isVpvr = entry?.source === 'vpvr' || id.toLowerCase().includes('vpvr');
    const resolvedInputs = isVpvr && inputs ? normalizeVpvrInputs(inputs) : inputs;

    const ok = this.registry.updateInputs(id, resolvedInputs);
    this.hooks.onStudiesChanged?.();
    this.hooks.onPersistableChange?.('indicator:inputs');
    return ok;
  }

  /**
   * Mengambil skema input untuk study tertentu.
   */
  public getInputSchema(idOrType: string): any[] {
    return this.registry.getSchema(idOrType);
  }

  /**
   * Mengambil nilai input saat ini untuk study tertentu.
   */
  public getInputs(idOrType: string): Record<string, any> {
    return this.registry.getInputs(idOrType);
  }

  /**
   * Menyelaraskan warna Native Volume Overlay (dan opsional Pine Volume) ke tema aktif.
   */
  public syncVolumeColors(
    cells: any[],
    themeCtx?: StudyThemeContext,
    syncPineIndicators: boolean = true
  ): void {
    const ctx = themeCtx ?? this.getThemeContext();
    const { upColor: effectiveUp, downColor: effectiveDown, maColor: effectiveMA } =
      resolveEffectiveVolumeColors(
        ctx.themePreset,
        ctx.customPalette || undefined,
        ctx.customCandleColors || undefined
      );

    for (const c of cells || []) {
      const chart = c?.chart || c?.inner;
      if (!chart) continue;

      let activeHeightPct: number | undefined;
      if (typeof chart.indicators === 'function') {
        for (const ind of Array.from(chart.indicators() || []) as any[]) {
          const isNativeVol = ind?.nativeType === 'volume' || ind?.source === 'volume' || ind?.id === 'native:volume';
          const isPineVol = isVolumeIndicator(ind?.title);

          if (isNativeVol && typeof ind.inputValues === 'function') {
            try {
              const vals = ind.inputValues();
              if (typeof vals?.heightPct === 'number' && Number.isFinite(vals.heightPct)) {
                activeHeightPct = vals.heightPct;
              }
            } catch (_) {}
          }

          if ((isNativeVol || (syncPineIndicators && isPineVol)) && typeof ind.setInputs === 'function') {
            try {
              this.runWithSuppressedPersist(() => {
                ind.setInputs({
                  upColor: effectiveUp,
                  downColor: effectiveDown,
                  ...(isPineVol ? { maColor: effectiveMA } : {}),
                });
              });
            } catch (err) {
              console.warn('[ChartStudyManager] syncVolumeColors setInputs error:', err);
            }
          }
        }
      }

      const renderer = chart.renderer?.renderer || chart.renderer;
      if (renderer) {
        const existingFrac = renderer.scene?.volumeLayer?.heightFrac;
        const preservedFrac =
          activeHeightPct !== undefined
            ? Math.min(0.5, Math.max(0.05, activeHeightPct / 100))
            : (typeof existingFrac === 'number' && Number.isFinite(existingFrac) ? existingFrac : 0.15);

        if (typeof renderer.setNativeData === 'function') {
          renderer.setNativeData('volume', {
            upColor: effectiveUp,
            downColor: effectiveDown,
            heightFrac: preservedFrac,
          });
        } else if (renderer.scene?.volumeLayer) {
          renderer.scene.volumeLayer.upColor = effectiveUp;
          renderer.scene.volumeLayer.downColor = effectiveDown;
          renderer.scheduler?.invalidate?.(3);
        }
      }
    }

    let hasRegistryUpdate = false;
    for (const item of this.registry.getActiveIndicators()) {
      const isNativeVol = item.source === 'volume' || item.id === 'native:volume' || (item as any).nativeType === 'volume';
      const isPineVol = syncPineIndicators && isVolumeIndicator(item.title);
      if (isNativeVol || isPineVol) {
        this.runWithSuppressedPersist(() => {
          this.registry.updateInputs(item.id, {
            upColor: effectiveUp,
            downColor: effectiveDown,
            ...(isPineVol ? { maColor: effectiveMA } : {}),
          });
        });
        hasRegistryUpdate = true;
      }
    }
    if (hasRegistryUpdate) {
      this.hooks.onStudiesChanged?.();
    }
  }

  /**
   * Menghitung tata letak pane beserta Pane Signature deterministik untuk satu sel.
   */
  public getPaneLayout(cell: any): PaneLayoutEntry[] {
    try {
      const chart = cell?.chart || cell?.inner;
      const native = chart?.renderer?.renderer || chart?.renderer;
      if (!native?.scene) return [];

      const scenePanesMap: Map<string, any> | undefined = native.scene.panes;
      const orderedScenePanes: any[] =
        typeof native.scene.orderedPanes === 'function' ? native.scene.orderedPanes() : [];

      if (chart?.panes && typeof chart.panes.list === 'function') {
        const listed = chart.panes.list() || [];
        if (listed.length > 0) {
          return listed.map((p: any, idx: number) => {
            const sp =
              scenePanesMap?.get?.(p.id) ||
              orderedScenePanes.find((item: any) => item?.id === p.id) ||
              orderedScenePanes[idx];
            const weight =
              typeof sp?.heightWeight === 'number' && Number.isFinite(sp.heightWeight) && sp.heightWeight > 0
                ? sp.heightWeight
                : p.kind === 'price'
                  ? 3
                  : 1;
            const collapsed =
              typeof p.collapsed === 'boolean' ? p.collapsed : Boolean(sp?.collapsed);
            return {
              signature: computePaneSignature(p),
              weight,
              ...(collapsed ? { collapsed: true } : {}),
            };
          });
        }
      }

      if (orderedScenePanes.length > 0) {
        return orderedScenePanes.map((sp: any, idx: number) => {
          const isPrice = sp.kind === 'price' || sp.id === 'price';
          const weight =
            typeof sp.heightWeight === 'number' && Number.isFinite(sp.heightWeight) && sp.heightWeight > 0
              ? sp.heightWeight
              : isPrice
                ? 3
                : 1;
          return {
            signature: isPrice ? 'price' : `study:${idx}`,
            weight,
            ...(sp.collapsed ? { collapsed: true } : {}),
          };
        });
      }
    } catch (err) {
      console.warn('[ChartStudyManager] Gagal membaca paneLayout:', err);
    }
    return [];
  }

  /**
   * Mengkloning daftar study (Pine maupun Native seperti VPVR) ke seluruh target sel yang belum memilikinya.
   */
  public cloneStudiesToCells(
    snapshot: ActiveIndicatorInfo[] | StudyDescriptor[],
    cells: any[],
    options?: { skipNativeTypes?: string[] }
  ): void {
    if (!Array.isArray(snapshot) || snapshot.length === 0 || !Array.isArray(cells)) return;

    const skipSet = new Set(options?.skipNativeTypes ?? ['volume']);

    for (const cell of cells) {
      const chart = cell?.chart || cell?.inner;
      if (!cell || !chart || typeof chart.indicators !== 'function') continue;

      const existing = Array.from(chart.indicators() || []) as any[];
      const existingTitles = new Set(existing.map((ind: any) => ind?.title).filter(Boolean));
      const existingNativeTypes = new Set(
        existing.map((ind: any) => (typeof ind?.nativeType === 'string' ? ind.nativeType : '')).filter(Boolean)
      );

      for (const item of snapshot) {
        const desc = this.toStudyDescriptor(item);
        if (!desc.title) continue;

        if (desc.language === 'native') {
          const nativeType = this.resolveNativeType(desc);
          if (!nativeType || skipSet.has(nativeType)) continue;
          if (existingNativeTypes.has(nativeType) || existingTitles.has(desc.title)) continue;

          const handle = this.addStudySync(cell, desc, { deduplicate: false, register: false });
          if (handle) {
            existingNativeTypes.add(nativeType);
            existingTitles.add(desc.title);
            this.attachHandleToRegistry(item.id || handle.id, handle, desc);
          }
        } else {
          if (existingTitles.has(desc.title)) continue;
          const handle = this.addStudySync(cell, desc, { deduplicate: false, register: false });
          if (handle) {
            existingTitles.add(desc.title);
            this.attachHandleToRegistry(item.id || handle.id, handle, desc);
          }
        }
      }
    }

    this.hooks.onStudiesChanged?.();
  }

  /**
   * Mengambil snapshot lengkap seluruh study (Pine & Native) milik satu sel secara lossless.
   */
  public captureCellStudies(
    cell: any,
    options?: { includeUnregisteredVolume?: boolean }
  ): CellStudySnapshot {
    const chart = cell?.chart || cell?.inner;
    if (!chart || typeof chart.indicators !== 'function') {
      return { pine: [], native: [], unified: [] };
    }

    const placementById = new Map<string, 'overlay' | 'own-pane'>();
    if (chart.panes && typeof chart.panes.list === 'function') {
      try {
        for (const p of chart.panes.list() || []) {
          const isOverlay = p?.kind === 'price' || p?.id === 'price';
          for (const item of p?.indicators || []) {
            if (item?.id) placementById.set(item.id, isOverlay ? 'overlay' : 'own-pane');
          }
        }
      } catch (_) {}
    }

    const pine: SavedWorkspaceIndicator[] = [];
    const native: NativeIndicatorSnapshot[] = [];
    const unified: ActiveIndicatorInfo[] = [];

    for (const ind of Array.from(chart.indicators() || []) as any[]) {
      if (!ind) continue;
      const isNative = typeof ind.nativeType === 'string' && ind.nativeType.length > 0;
      const matched = this.registry.findEntry(ind.id || ind.title);
      const reg = matched?.entry;

      let liveInputs: Record<string, any> | undefined;
      try {
        if (typeof ind.inputValues === 'function') {
          const vals = ind.inputValues();
          if (vals && Object.keys(vals).length > 0) liveInputs = { ...vals };
        } else if (ind.inputs && typeof ind.inputs === 'object' && Object.keys(ind.inputs).length > 0) {
          liveInputs = { ...ind.inputs };
        }
      } catch (_) {}

      let liveProps: Record<string, any> | undefined;
      try {
        if (typeof ind.propValues === 'function') {
          const pvals = ind.propValues();
          if (pvals && Object.keys(pvals).length > 0) liveProps = { ...pvals };
        } else if (ind.props && typeof ind.props === 'object' && Object.keys(ind.props).length > 0) {
          liveProps = { ...ind.props };
        }
      } catch (_) {}

      const mergedInputs =
        liveInputs || reg?.inputs ? { ...(reg?.inputs || {}), ...(liveInputs || {}) } : undefined;
      const mergedProps =
        liveProps || reg?.props ? { ...(reg?.props || {}), ...(liveProps || {}) } : undefined;
      const visible = ind.visible !== undefined ? Boolean(ind.visible) : (reg?.visible ?? true);

      if (isNative) {
        const placement: 'overlay' | 'own-pane' =
          placementById.get(ind.id) ??
          (ind.paneId && ind.paneId !== 'price' ? 'own-pane' : 'overlay');

        native.push({
          type: ind.nativeType,
          ...(mergedInputs && Object.keys(mergedInputs).length > 0 ? { inputs: mergedInputs } : {}),
          visible,
          placement,
        });

        if (ind.nativeType !== 'volume' || options?.includeUnregisteredVolume || matched) {
          unified.push({
            id: ind.id || reg?.id || `native:${ind.nativeType}`,
            title: ind.title || reg?.title || ind.nativeType,
            source: ind.nativeType,
            language: 'native',
            nativeType: ind.nativeType,
            placement,
            visible,
            ...(mergedInputs && Object.keys(mergedInputs).length > 0 ? { inputs: mergedInputs } : {}),
            ...(mergedProps && Object.keys(mergedProps).length > 0 ? { props: mergedProps } : {}),
          });
        }
      } else {
        const title = ind.title || reg?.title || 'Indicator';
        const source = ind.source || reg?.source;
        pine.push({
          title,
          source,
          visible,
          ...(mergedInputs && Object.keys(mergedInputs).length > 0 ? { inputs: mergedInputs } : {}),
          ...(mergedProps && Object.keys(mergedProps).length > 0 ? { props: mergedProps } : {}),
        });
        unified.push({
          id: ind.id || reg?.id || title,
          title,
          source,
          language: 'pine',
          visible,
          ...(mergedInputs && Object.keys(mergedInputs).length > 0 ? { inputs: mergedInputs } : {}),
          ...(mergedProps && Object.keys(mergedProps).length > 0 ? { props: mergedProps } : {}),
        });
      }
    }

    return { pine, native, unified };
  }

  /**
   * Memulihkan snapshot study (Pine & Native) ke satu sel secara lossless.
   */
  public async restoreCellStudies(
    cell: any,
    snapshot: CellStudySnapshot | ActiveIndicatorInfo[] | StudyDescriptor[],
    options?: { clearExisting?: boolean }
  ): Promise<void> {
    const chart = cell?.chart || cell?.inner;
    if (!cell || !chart) return;

    if (options?.clearExisting !== false && typeof chart.indicators === 'function') {
      for (const existingInd of Array.from(chart.indicators() || []) as any[]) {
        if (existingInd?.nativeType === 'volume') continue;
        try {
          if (typeof existingInd?.remove === 'function') existingInd.remove();
        } catch (_) {}
      }
    }

    const descriptors: StudyDescriptor[] = Array.isArray(snapshot)
      ? snapshot.map((item) => this.toStudyDescriptor(item))
      : [
          ...snapshot.pine.map((p) => ({
            language: 'pine' as const,
            title: p.title,
            source: p.source,
            visible: p.visible,
            inputs: p.inputs,
            props: p.props,
          })),
          ...snapshot.native.map((n) => ({
            language: 'native' as const,
            nativeType: n.type,
            title: n.type,
            source: n.type,
            visible: n.visible,
            placement: n.placement,
            inputs: n.inputs as Record<string, any> | undefined,
          })),
        ];

    for (const desc of descriptors) {
      if (desc.language === 'native' && this.resolveNativeType(desc) === 'volume') {
        const existingVol: any =
          typeof chart.indicators === 'function'
            ? (Array.from(chart.indicators() || []) as any[]).find((ind: any) => ind?.nativeType === 'volume')
            : null;
        if (existingVol) {
          const resolved = this.resolveStudyInputs(desc);
          this.runWithSuppressedPersist(() => {
            if (resolved.inputs && typeof existingVol.setInputs === 'function') {
              existingVol.setInputs(resolved.inputs);
            }
            if (desc.visible !== undefined && typeof existingVol.setVisible === 'function') {
              existingVol.setVisible(Boolean(desc.visible));
            }
            if (desc.placement && typeof chart.panes?.moveIndicator === 'function' && existingVol.id) {
              const currentPlacement = this.getHandlePlacement(chart, existingVol);
              if (currentPlacement !== desc.placement) {
                chart.panes.moveIndicator(
                  existingVol.id,
                  desc.placement === 'own-pane' ? { newPane: true } : 'price'
                );
              }
            }
          });
          continue;
        }
      }

      await this.addStudy(cell, desc, { deduplicate: true, register: true });
    }
  }

  /**
   * Memperkaya handle native dengan method `update` dan `descriptor` skema input Vela.
   */
  public enrichNativeHandle(handle: any, type: string): void {
    if (!handle) return;
    if (typeof handle.update !== 'function') {
      handle.update = (newInputs: Record<string, any>) => {
        if (typeof handle.setInputs === 'function') {
          handle.setInputs(newInputs);
        }
      };
    }
    try {
      const descriptor = getNativeIndicator(type);
      if (descriptor) {
        handle.descriptor = descriptor;
        if (!(descriptor as any).inputs && typeof descriptor.inputsSchema === 'function') {
          try {
            (descriptor as any).inputs = descriptor.inputsSchema();
          } catch (err) {
            console.warn(`[ChartStudyManager] Gagal mengekstrak inputsSchema untuk tipe "${type}":`, err);
          }
        }
      }
    } catch (err) {
      console.warn(`[ChartStudyManager] Gagal memperkaya native handle untuk tipe "${type}":`, err);
    }
  }

  private mountNativeOnCell(
    cell: any,
    chart: any,
    descriptor: StudyDescriptor,
    options?: { register?: boolean }
  ): any | null {
    if (typeof chart.addNativeIndicator !== 'function') return null;

    const cleanType = this.resolveNativeType(descriptor);
    const cleanTitle = (descriptor.title || cleanType).trim();
    const resolved = this.resolveStudyInputs({ ...descriptor, nativeType: cleanType });
    const addOptions: Record<string, any> = {};
    if (resolved.inputs) addOptions.inputs = resolved.inputs;
    if (descriptor.props) addOptions.props = descriptor.props;
    if (descriptor.title) addOptions.title = cleanTitle;

    const handle = chart.addNativeIndicator(cleanType, addOptions);
    if (!handle) return null;

    this.enrichNativeHandle(handle, cleanType);

    if (descriptor.visible === false && typeof handle.setVisible === 'function') {
      try { handle.setVisible(false); } catch (_) {}
    }

    if (descriptor.placement && typeof chart.panes?.moveIndicator === 'function' && handle.id) {
      const currentPlacement = this.getHandlePlacement(chart, handle);
      if (currentPlacement !== descriptor.placement) {
        try {
          chart.panes.moveIndicator(
            handle.id,
            descriptor.placement === 'own-pane' ? { newPane: true } : 'price'
          );
        } catch (err) {
          console.warn(`[ChartStudyManager] moveIndicator(${cleanType}) error:`, err);
        }
      }
    }

    if (options?.register !== false) {
      if (cleanType === 'volume') {
        this.syncVolumeColors([cell], undefined, true);
      }
      this.registry.register({
        id: handle.id || `${cell.id || 'cell'}:${cleanTitle}`,
        handle,
        handles: [handle],
        title: cleanTitle || handle.title || cleanType,
        source: cleanType,
        visible: handle.visible ?? descriptor.visible ?? true,
        inputs: resolved.inputs,
        props: descriptor.props,
      });
      this.hooks.onStudiesChanged?.();
      this.hooks.onPersistableChange?.('indicator:add_native_cell');
    }

    return handle;
  }

  private mountPineOnCell(
    cell: any,
    chart: any,
    descriptor: StudyDescriptor,
    options?: { deduplicate?: boolean; register?: boolean }
  ): any | null {
    if (typeof chart.addIndicator !== 'function') return null;

    const source = descriptor.source || 'plot(close)';
    const cleanTitle = (descriptor.title || 'Custom Indicator').trim();

    if (options?.deduplicate !== false && typeof chart.indicators === 'function') {
      try {
        for (const ind of Array.from(chart.indicators() || []) as any[]) {
          if (ind && !ind.nativeType && (ind.title === cleanTitle || ind.title === descriptor.title)) {
            if (typeof ind.remove === 'function') ind.remove();
          }
        }
      } catch (_) {}
    }

    const isStrategy = /\bstrategy\s*\(/.test(source);
    if (isStrategy) {
      this.hooks.enableTradeVisibility?.(cell);
    }

    const resolved = this.resolveStudyInputs(descriptor);
    const isOverlay = source.includes('overlay=true') || source.includes('overlay = true');
    const addOptions: Record<string, any> = {
      language: 'pine',
      title: cleanTitle,
      ...(isOverlay ? { overlay: true, pane: 'price' } : {}),
    };
    if (resolved.inputs && Object.keys(resolved.inputs).length > 0) {
      addOptions.inputs = resolved.inputs;
    }
    if (descriptor.props && Object.keys(descriptor.props).length > 0) {
      addOptions.props = descriptor.props;
    }

    const handle = chart.addIndicator(source, addOptions);
    if (!handle) return null;

    if (isStrategy) {
      this.hooks.onPineStrategyMounted?.(cell, handle, cleanTitle);
    }

    if (resolved.inputs && typeof handle.setInputs === 'function') {
      try { handle.setInputs(resolved.inputs); } catch (_) {}
    }
    if (descriptor.props && typeof handle.setProps === 'function') {
      try { handle.setProps(descriptor.props); } catch (_) {}
    }
    if (descriptor.visible === false && typeof handle.setVisible === 'function') {
      try { handle.setVisible(false); } catch (_) {}
    }

    if (options?.register !== false) {
      this.registry.register({
        id: handle.id || `${cell.id || 'cell'}:${cleanTitle}`,
        handle,
        handles: [handle],
        title: cleanTitle,
        source,
        visible: descriptor.visible ?? true,
        inputs: resolved.inputs,
        props: descriptor.props,
      });
      this.hooks.onStudiesChanged?.();
    }

    return handle;
  }

  private toStudyDescriptor(item: ActiveIndicatorInfo | StudyDescriptor): StudyDescriptor {
    if ('language' in item && (item.language === 'native' || item.language === 'pine')) {
      return { ...item, language: item.language };
    }
    const info = item as ActiveIndicatorInfo;
    const rawSource = (info.source || '').trim();
    const idIsNative = typeof info.id === 'string' && info.id.startsWith('native:');
    const regEntry = info.id ? this.registry.findEntry(info.id)?.entry : null;
    const isNativeHandle = Boolean(regEntry?.handle?.nativeType || regEntry?.handle?.descriptor);
    const looksLikeNativeId =
      Boolean(rawSource) &&
      !rawSource.includes('\n') &&
      !rawSource.includes('(') &&
      Boolean(getNativeIndicator(rawSource.replace(/^native:/, '')));

    const isNative = idIsNative || isNativeHandle || looksLikeNativeId;
    if (isNative) {
      const nativeType = (
        info.nativeType ||
        regEntry?.handle?.nativeType ||
        rawSource ||
        info.id ||
        info.title
      )
        .trim()
        .replace(/^native:/, '');
      return {
        id: info.id,
        language: 'native',
        nativeType,
        title: info.title || nativeType,
        source: nativeType,
        visible: info.visible ?? true,
        placement: info.placement,
        inputs: info.inputs,
        props: info.props,
      };
    }

    return {
      id: info.id,
      language: 'pine',
      title: info.title,
      source: info.source || 'plot(close)',
      visible: info.visible ?? true,
      inputs: info.inputs,
      props: info.props,
    };
  }

  private attachHandleToRegistry(entryId: string, handle: any, desc: StudyDescriptor): void {
    const matched = entryId ? this.registry.findEntry(entryId) : null;
    if (matched) {
      const entry = matched.entry;
      if (!entry.handles) entry.handles = entry.handle ? [entry.handle] : [];
      if (!entry.handles.includes(handle)) {
        entry.handles.push(handle);
      }
      return;
    }

    const resolved = this.resolveStudyInputs(desc);
    this.registry.register({
      id: handle.id || entryId || desc.title,
      handle,
      handles: [handle],
      title: desc.title,
      source: desc.language === 'native' ? this.resolveNativeType(desc) : (desc.source || ''),
      visible: desc.visible ?? true,
      inputs: resolved.inputs,
      props: desc.props,
    });
  }

  private resolveNativeType(descriptor: StudyDescriptor): string {
    return (descriptor.nativeType || descriptor.source || descriptor.id || descriptor.title || '')
      .trim()
      .replace(/^native:/, '');
  }

  private resolveStudyInputs(descriptor: StudyDescriptor): { inputs?: Record<string, any> } {
    if (descriptor.language === 'native') {
      const cleanType = this.resolveNativeType(descriptor);
      if (cleanType === 'vpvr' && descriptor.inputs) {
        return { inputs: normalizeVpvrInputs(descriptor.inputs) };
      }
      if (cleanType === 'volume') {
        const ctx = this.getThemeContext();
        const { upColor: effectiveUp, downColor: effectiveDown } = resolveEffectiveVolumeColors(
          ctx.themePreset,
          ctx.customPalette || undefined,
          ctx.customCandleColors || undefined
        );
        const currentInputs = (descriptor.inputs || {}) as Record<string, any>;
        const upStr = typeof currentInputs.upColor === 'string' ? currentInputs.upColor.toLowerCase() : '';
        const downStr = typeof currentInputs.downColor === 'string' ? currentInputs.downColor.toLowerCase() : '';
        const isVelaDefaultUp = !upStr || upStr === '#26a69a';
        const isVelaDefaultDown = !downStr || downStr === '#ef5350';
        return {
          inputs: {
            ...currentInputs,
            upColor: isVelaDefaultUp ? effectiveUp : currentInputs.upColor,
            downColor: isVelaDefaultDown ? effectiveDown : currentInputs.downColor,
          },
        };
      }
      return { inputs: descriptor.inputs ? { ...descriptor.inputs } : undefined };
    }

    const cleanTitle = (descriptor.title || '').trim();
    const isVolumeScript = isVolumeIndicator(cleanTitle);
    let effectiveInputs = descriptor.inputs ? { ...descriptor.inputs } : undefined;
    if (isVolumeScript) {
      const ctx = this.getThemeContext();
      const { upColor: effectiveUp, downColor: effectiveDown, maColor: effectiveMA } =
        resolveEffectiveVolumeColors(
          ctx.themePreset,
          ctx.customPalette || undefined,
          ctx.customCandleColors || undefined
        );
      effectiveInputs = {
        upColor: effectiveUp,
        downColor: effectiveDown,
        maColor: effectiveMA,
        ...(effectiveInputs || {}),
      };
    }
    return { inputs: effectiveInputs };
  }

  private getHandlePlacement(chart: any, handle: any): 'overlay' | 'own-pane' {
    if (chart?.panes && typeof chart.panes.list === 'function') {
      try {
        for (const p of chart.panes.list() || []) {
          if ((p?.indicators || []).some((it: any) => it?.id === handle?.id)) {
            return p?.kind === 'price' || p?.id === 'price' ? 'overlay' : 'own-pane';
          }
        }
      } catch (_) {}
    }
    return handle?.paneId && handle.paneId !== 'price' ? 'own-pane' : 'overlay';
  }

  private getThemeContext(): StudyThemeContext {
    return (
      this.hooks.getThemeContext?.() ?? {
        themePreset: 'obsidian-pink' as ThemePresetId,
        customPalette: null,
        customCandleColors: null,
      }
    );
  }

  private runWithSuppressedPersist(fn: () => void): void {
    if (this.hooks.withSuppressedPersistEvents) {
      this.hooks.withSuppressedPersistEvents(fn);
    } else {
      fn();
    }
  }
}
