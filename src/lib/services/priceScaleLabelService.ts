// Layanan Ekstraksi & Formatter Label Harga pada Skala Kanan (Indikator & Drawing Tools)

export interface PriceScaleBadge {
  id: string;
  price: number;
  label: string;
  color: string;
  bgColor?: string;
  kind: 'entry' | 'take_profit' | 'stop_loss' | 'drawing' | 'indicator';
  y?: number | null;
  title?: string;
}

/**
 * Format angka harga dengan pemisah ribuan dan desimal presisi
 */
export function formatPriceLabel(price: number): string {
  if (typeof price !== 'number' || isNaN(price)) return '0.00';
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Mengekstrak label harga dari objek gambar aktif (khususnya Posisi Long/Short Risk-Reward & Garis Horisontal)
 */
export function extractDrawingPriceBadges(
  drawings: any[],
  priceToY?: (price: number) => number | null
): PriceScaleBadge[] {
  if (!Array.isArray(drawings) || drawings.length === 0) return [];

  const badges: PriceScaleBadge[] = [];

  for (const d of drawings) {
    if (!d || d.visible === false) continue;
    const anchors = Array.isArray(d.anchors) ? d.anchors : [];
    if (anchors.length === 0) continue;

    if (d.type === 'position') {
      // Pada Vela Drawing PositionTool:
      // anchors[0] = Entry
      // anchors[1] = Stop Loss (stopPx)
      // anchors[2] = Target Profit (targetPx)
      const prices = typeof d.prices === 'function' ? d.prices() : null;
      const entryPrice = prices?.entry ?? anchors[0]?.price;
      const stopPrice = prices?.stop ?? anchors[1]?.price;
      const targetPrice = prices?.target ?? anchors[2]?.price;

      if (typeof entryPrice === 'number' && !isNaN(entryPrice)) {
        const col = d.style?.lineColor || '#3b82f6';
        badges.push({
          id: `draw_${d.id}_entry`,
          price: entryPrice,
          label: formatPriceLabel(entryPrice),
          color: col,
          bgColor: col,
          kind: 'entry',
          title: 'Entry',
          y: priceToY ? priceToY(entryPrice) : null,
        });
      }

      if (typeof targetPrice === 'number' && !isNaN(targetPrice)) {
        badges.push({
          id: `draw_${d.id}_tp`,
          price: targetPrice,
          label: formatPriceLabel(targetPrice),
          color: '#10b981', // Hijau Bullish Take Profit
          bgColor: '#10b981',
          kind: 'take_profit',
          title: 'Target (TP)',
          y: priceToY ? priceToY(targetPrice) : null,
        });
      }

      if (typeof stopPrice === 'number' && !isNaN(stopPrice)) {
        badges.push({
          id: `draw_${d.id}_sl`,
          price: stopPrice,
          label: formatPriceLabel(stopPrice),
          color: '#ef4444', // Merah Bearish Stop Loss
          bgColor: '#ef4444',
          kind: 'stop_loss',
          title: 'Stop (SL)',
          y: priceToY ? priceToY(stopPrice) : null,
        });
      }
    } else if (
      d.type === 'hline' ||
      d.type === 'hray' ||
      d.type === 'pricelabel' ||
      d.type === 'pricenote'
    ) {
      const p = anchors[0]?.price;
      if (typeof p === 'number' && !isNaN(p)) {
        const col = d.style?.lineColor || '#eab308';
        badges.push({
          id: `draw_${d.id}`,
          price: p,
          label: formatPriceLabel(p),
          color: col,
          bgColor: col,
          kind: 'drawing',
          title: d.text?.content || 'Price',
          y: priceToY ? priceToY(p) : null,
        });
      }
    }
  }

  return badges;
}

/**
 * Mengekstrak label harga dari indikator aktif yang memiliki nilai plot terakhir
 */
export function extractIndicatorPriceBadges(
  indicators: any[],
  priceToY?: (price: number) => number | null
): PriceScaleBadge[] {
  if (!Array.isArray(indicators) || indicators.length === 0) return [];

  const badges: PriceScaleBadge[] = [];

  for (const ind of indicators) {
    if (!ind || ind.visible === false) continue;
    const val = ind.lastValue;
    if (typeof val === 'number' && !isNaN(val)) {
      badges.push({
        id: `ind_${ind.id}`,
        price: val,
        label: formatPriceLabel(val),
        color: ind.color || '#f97316',
        bgColor: 'rgba(15, 23, 42, 0.94)',
        kind: 'indicator',
        title: ind.title || 'Ind',
        y: priceToY ? priceToY(val) : null,
      });
    }
  }

  return badges;
}
