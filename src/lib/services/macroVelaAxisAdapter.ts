import { formatMacroCompactValue, resolveMacroIndexDescriptor } from './macroIndexCatalog';

export type MacroAxisMode = 'macro_usd' | 'macro_percent' | null;

interface MacroAxisAdapterState {
  mode: MacroAxisMode;
  tickHook: (ctx: any) => any;
  origDataWindowFmt?: (v: number, pane: any) => string;
  origChip?: (...args: any[]) => void;
  origDrawPriceLine?: (...args: any[]) => void;
}

const adapterStates = new WeakMap<object, MacroAxisAdapterState>();

export function resolveMacroAxisMode(symbol?: string | null): MacroAxisMode {
  const desc = resolveMacroIndexDescriptor(symbol);
  if (!desc) return null;
  return desc.quoteUnit === '%' ? 'macro_percent' : 'macro_usd';
}

function isStandardPriceMode(scene: any, pane: any): boolean {
  if (!pane || pane.kind !== 'price') return false;
  const scaleMode = scene?.scaleMode ?? 'price';
  return scaleMode !== 'percent' && scaleMode !== 'indexed';
}

function formatCountdownMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (v: number) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function resolveTagContrastColor(bg: string): '#000000' | '#ffffff' {
  const hex = (bg || '').trim();
  const matchHex = hex.match(/^#([0-9a-f]{6})$/i);
  let r = 0, g = 0, b = 0;
  if (matchHex) {
    const n = parseInt(matchHex[1], 16);
    r = ((n >> 16) & 255) / 255;
    g = ((n >> 8) & 255) / 255;
    b = (n & 255) / 255;
  } else {
    const matchRgb = hex.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!matchRgb) return '#ffffff';
    r = Number(matchRgb[1]) / 255;
    g = Number(matchRgb[2]) / 255;
    b = Number(matchRgb[3]) / 255;
  }
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum >= 0.4 ? '#000000' : '#ffffff';
}

/**
 * Memformat angka tick sumbu Y sesuai langkah antar tick agar label tidak duplikat saat zoom dalam,
 * sambil menjaga panjang karakter tetap muat pada kolom axis Vela 64px.
 */
export function formatMacroTickValue(
  value: number,
  mode: Exclude<MacroAxisMode, null>,
  step?: number
): string {
  if (!Number.isFinite(value)) return '-';
  if (mode === 'macro_percent') {
    const decimals = step !== undefined && step > 0 && step < 0.01 ? 3 : 2;
    return `${value.toFixed(decimals)}%`;
  }

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e12) {
    const decimals = step !== undefined && step > 0 && step < 1e10 ? 3 : 2;
    return `${sign}${(abs / 1e12).toFixed(decimals)}T`;
  }
  if (abs >= 1e9) {
    const scaled = abs / 1e9;
    const fine = step !== undefined && step > 0 && step < 1e8;
    const decimals = fine ? 3 : scaled >= 100 ? 1 : 2;
    return `${sign}${scaled.toFixed(decimals)}B`;
  }
  return formatMacroCompactValue(value, 'USD');
}

function getNativeRenderer(cell: any): any {
  return cell?.chart?.renderer?.renderer || cell?.chart?.renderer || null;
}

/**
 * Menyinkronkan formatter sumbu harga, crosshair chip, data window, dan badge harga terakhir
 * per cell Vela tanpa mengubah perilaku instrumen reguler atau berkas node_modules.
 */
export function syncCellMacroVelaAxis(cell: any, mode: MacroAxisMode): void {
  const native = getNativeRenderer(cell);
  if (!native || typeof native !== 'object') return;

  let state = adapterStates.get(native);
  if (!state && mode === null) {
    return;
  }

  if (!state) {
    state = {
      mode,
      tickHook: (ctx: any) => {
        if (!state?.mode || ctx?.pane?.kind !== 'price' || ctx?.mode !== 'price') {
          return null;
        }
        const defaults: Array<{ price: number; label: string; major?: boolean }> = ctx.defaults || [];
        if (defaults.length === 0) return null;

        let step: number | undefined;
        if (defaults.length >= 2) {
          step = Math.abs(defaults[1].price - defaults[0].price);
        }
        return defaults.map((t) => ({
          price: t.price,
          label: formatMacroTickValue(t.price, state!.mode!, step),
          major: t.major,
        }));
      },
    };

    if (typeof native.dataWindowFmt === 'function') {
      const origDataWindowFmt = native.dataWindowFmt;
      state.origDataWindowFmt = origDataWindowFmt;
      native.dataWindowFmt = function (this: any, v: number, pane: any) {
        if (state?.mode && isStandardPriceMode(native.scene, pane)) {
          return formatMacroCompactValue(v, state.mode === 'macro_percent' ? '%' : 'USD');
        }
        return origDataWindowFmt.call(this, v, pane);
      };
    }

    if (native.crosshairLayer && typeof native.crosshairLayer.chip === 'function') {
      const origChip = native.crosshairLayer.chip;
      state.origChip = origChip;
      native.crosshairLayer.chip = function (
        this: any,
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        text: string,
        bg: string,
        align: string,
        below = false,
        over = '#000000'
      ) {
        let nextText = text;
        if (state?.mode && align === 'left' && !below && native.scene?.panes && native.coords?.yToPrice) {
          for (const pane of native.scene.panes.values()) {
            if (y >= pane.bounds.top && y <= pane.bounds.top + pane.bounds.height) {
              if (pane.axisFormat !== 'none' && isStandardPriceMode(native.scene, pane)) {
                const hoveredPrice = native.coords.yToPrice(y, pane.scale, pane.bounds);
                if (Number.isFinite(hoveredPrice)) {
                  nextText = formatMacroCompactValue(
                    hoveredPrice,
                    state.mode === 'macro_percent' ? '%' : 'USD'
                  );
                }
              }
              break;
            }
          }
        }
        return origChip.call(this, ctx, x, y, nextText, bg, align, below, over);
      };
    }

    if (native.chrome && typeof native.chrome.drawPriceLineAndCountdown === 'function') {
      const origDrawPriceLine = native.chrome.drawPriceLineAndCountdown;
      state.origDrawPriceLine = origDrawPriceLine;
      native.chrome.drawPriceLineAndCountdown = function (
        this: any,
        ctx: CanvasRenderingContext2D,
        scene: any,
        coords: any,
        theme: any,
        dataW: number,
        pricePane: any
      ) {
        if (!state?.mode || !scene?.showPriceLabel || !isStandardPriceMode(scene, pricePane)) {
          return origDrawPriceLine.call(this, ctx, scene, coords, theme, dataW, pricePane);
        }

        const bars = scene.bars || [];
        const n = bars.length;
        if (!pricePane || n === 0 || scene.candlesHidden || pricePane.collapsed || pricePane.bounds.height <= 0) {
          return;
        }
        const last = bars[n - 1];
        const y = coords.priceToY(last.close, pricePane.scale, pricePane.bounds);
        if (y < pricePane.bounds.top || y > pricePane.bounds.top + pricePane.bounds.height) return;

        const color =
          typeof this.priceElementColor === 'function'
            ? this.priceElementColor(scene, coords, theme, last)
            : theme.upColor;

        if (scene.showPriceLine) {
          const yy = Math.round(y) + 0.5;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(0, yy);
          ctx.lineTo(dataW, yy);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const remaining =
          scene.showCountdown && coords.barInterval > 0 ? last.time + coords.barInterval - Date.now() : 0;
        const cdText = remaining > 0 ? formatCountdownMs(remaining) : null;
        const priceText = formatMacroCompactValue(
          last.close,
          state.mode === 'macro_percent' ? '%' : 'USD'
        );

        const pad = 8;
        const x = dataW + 1;
        const textColor = resolveTagContrastColor(color);
        ctx.textBaseline = 'middle';

        if (cdText !== null) {
          const w2 = Math.max(ctx.measureText(priceText).width, ctx.measureText(cdText).width) + pad;
          const top = y - 8;
          const tx = x + pad / 2;
          ctx.fillStyle = color;
          ctx.fillRect(x, top, w2, 32);
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.fillText(priceText, tx, top + 8);
          ctx.fillText(cdText, tx, top + 24);
          ctx.textAlign = 'start';
          return;
        }

        const w = ctx.measureText(priceText).width + pad;
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 8, w, 16);
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(priceText, x + w / 2, y);
        ctx.textAlign = 'start';
      };
    }

    adapterStates.set(native, state);
  }

  state.mode = mode;
  if (typeof native.set === 'function') {
    native.set('priceAxisTicks', mode ? state.tickHook : null);
  }
  native.scheduler?.invalidate?.(7);
}
