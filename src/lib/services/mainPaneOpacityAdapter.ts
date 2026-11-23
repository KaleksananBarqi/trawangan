// Adapter non-invasif untuk mengatur opasitas objek non-candle khusus pada pane utama ('price').
// Menjaga candlestick utama dan seluruh indikator/gambar di sub-pane (own-pane) tetap 100% solid.

const ATTACHED_CELL_SYMBOL = Symbol('trawangan_main_pane_opacity_attached');
// Bitmask flag scheduler Vela untuk memaksa repaint seluruh lapisan (Data + Overlay + Chrome)
const INVALIDATE_ALL_LAYERS_FLAG = 7;

export interface MainPaneOpacityHandle {
  setOpacity(nextOpacity: number): void;
  getOpacity(): number;
}

/**
 * Menormalkan nilai opasitas objek pane utama ke rentang aman [0.1, 1.0].
 */
export function clampMainPaneOpacity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0.1, value));
}

function isPricePane(pane: any): boolean {
  if (!pane) return false;
  return pane.kind === 'price' || pane.id === 'price';
}

function withBatchAlpha(batch: any, opacity: number, fn: () => any): any {
  if (!batch || typeof batch.alpha !== 'number') {
    return fn();
  }
  const prev = batch.alpha;
  batch.alpha = prev * opacity;
  try {
    return fn();
  } finally {
    batch.alpha = prev;
  }
}

function withCanvasAlpha(ctx: any, opacity: number, fn: () => any): any {
  if (!ctx || typeof ctx.globalAlpha !== 'number') {
    return fn();
  }
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * opacity;
  try {
    return fn();
  } finally {
    ctx.globalAlpha = prev;
  }
}

function wrapMethodWithOpacity(
  target: any,
  methodName: string,
  getAlpha: () => number,
  shouldApply: (args: any[]) => boolean,
  resolveContext: (self: any, args: any[]) => any,
  applyCtx: (ctx: any, alpha: number, fn: () => any) => any
): void {
  if (!target || typeof target[methodName] !== 'function') return;
  const orig = target[methodName];
  if ((orig as any).__trawanganOpacityWrapped) return;

  const wrapped = function (this: any, ...args: any[]) {
    const opacity = getAlpha();
    if (opacity >= 0.999 || !shouldApply(args)) {
      return orig.apply(this, args);
    }
    const ctx = resolveContext(this, args);
    return applyCtx(ctx, opacity, () => orig.apply(this, args));
  };
  (wrapped as any).__trawanganOpacityWrapped = true;
  target[methodName] = wrapped;
}

/**
 * Memasang adapter opasitas objek non-candle pane utama ke renderer Vela milik sebuah sel.
 * Idempoten per sel; aman dipanggil berulang kali.
 */
export function attachMainPaneOpacityAdapter(
  cellOrRenderer: any,
  initialOpacity = 1
): MainPaneOpacityHandle {
  const chart = cellOrRenderer?.chart || cellOrRenderer?.inner || cellOrRenderer;
  const renderer =
    chart?.renderer?.renderer ||
    chart?.renderer ||
    (cellOrRenderer?.backend || cellOrRenderer?.chrome ? cellOrRenderer : null);

  if (!renderer) {
    let fallbackOpacity = clampMainPaneOpacity(initialOpacity);
    return {
      setOpacity(next: number) {
        fallbackOpacity = clampMainPaneOpacity(next);
      },
      getOpacity() {
        return fallbackOpacity;
      },
    };
  }

  const existing: MainPaneOpacityHandle | undefined = renderer[ATTACHED_CELL_SYMBOL];
  if (existing) {
    existing.setOpacity(initialOpacity);
    return existing;
  }

  let currentOpacity = clampMainPaneOpacity(initialOpacity);
  const getOpacity = () => currentOpacity;
  const firstArgCtx = (_self: any, args: any[]) => args[0];
  const thisCtx = (self: any) => self?.ctx;

  // 1. Indikator overlay (WebGL2Backend & Canvas2dBackend) hanya pada pane 'price'
  const backend = renderer.backend;
  if (backend) {
    const paneAt = (idx: number) => (args: any[]) => isPricePane(args[idx]);
    // WebGL2Backend
    wrapMethodWithOpacity(backend, 'emitBackground', getOpacity, paneAt(2), firstArgCtx, withBatchAlpha);
    wrapMethodWithOpacity(backend, 'emitFill', getOpacity, paneAt(3), firstArgCtx, withBatchAlpha);
    wrapMethodWithOpacity(backend, 'emitSeries', getOpacity, paneAt(2), firstArgCtx, withBatchAlpha);
    wrapMethodWithOpacity(backend, 'emitHline', getOpacity, paneAt(2), firstArgCtx, withBatchAlpha);

    // Canvas2dBackend
    wrapMethodWithOpacity(backend, 'drawBackground', getOpacity, paneAt(2), firstArgCtx, withCanvasAlpha);
    wrapMethodWithOpacity(backend, 'drawFill', getOpacity, paneAt(3), firstArgCtx, withCanvasAlpha);
    wrapMethodWithOpacity(backend, 'drawSeries', getOpacity, paneAt(2), firstArgCtx, withCanvasAlpha);
    wrapMethodWithOpacity(backend, 'drawHline', getOpacity, paneAt(2), firstArgCtx, withCanvasAlpha);
  }

  // 2. Pine Script drawings (IndicatorDrawingSlices) pada pane 'price'
  wrapMethodWithOpacity(
    renderer.indicatorSlices,
    'paintEntry',
    getOpacity,
    (args) => isPricePane(args[1]?.pane),
    firstArgCtx,
    withCanvasAlpha
  );

  // 3. User drawings & Trading Plans (top canvas & interleaved slices) khusus paneId === 'price'
  wrapMethodWithOpacity(
    renderer.userDrawings?.painter,
    'paintOne',
    getOpacity,
    (args) => (args[1]?.paneId ?? 'price') === 'price',
    firstArgCtx,
    withCanvasAlpha
  );

  // 4. Native Volume Overlay (hanya saat berada di pane 'price', yaitu !args.fillPane)
  wrapMethodWithOpacity(
    renderer.volumeRenderer,
    'render',
    getOpacity,
    (args) => !args[0]?.fillPane,
    thisCtx,
    withCanvasAlpha
  );

  // 5. VPVR (selalu berada di pane 'price')
  wrapMethodWithOpacity(
    renderer.vpvrRenderer,
    'render',
    getOpacity,
    () => true,
    thisCtx,
    withCanvasAlpha
  );

  const handle: MainPaneOpacityHandle = {
    setOpacity(next: number) {
      const clamped = clampMainPaneOpacity(next);
      if (clamped === currentOpacity) return;
      currentOpacity = clamped;
      renderer.scheduler?.invalidate?.(INVALIDATE_ALL_LAYERS_FLAG);
      renderer.userDrawings?.render?.();
    },
    getOpacity() {
      return currentOpacity;
    },
  };

  renderer[ATTACHED_CELL_SYMBOL] = handle;
  return handle;
}
