// Layanan Ekstraksi & Formatter Label Harga pada Skala Kanan (Indikator & Drawing Tools)
import { roundToTickSize } from './priceSnapService';

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
 * Mendukung pemformatan standar internasional (USDT/USD) dan standar lokal Rupiah Indonesia (IDR).
 */
export function formatPriceLabel(price: number, quoteCurrency?: string): string {
  if (typeof price !== 'number' || isNaN(price)) return '0.00';

  const upperQuote = quoteCurrency?.toUpperCase();
  if (upperQuote === 'BTC') {
    return `${price.toFixed(8)} ₿`;
  }

  const isIdr = upperQuote === 'IDR';

  if (isIdr) {
    if (price >= 100) {
      if (Number.isInteger(price) || Math.abs(price - Math.round(price)) < 1e-4) {
        return Math.round(price).toLocaleString('id-ID');
      }
      return price.toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    if (price >= 1) {
      return price.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
    }
    return price.toLocaleString('id-ID', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  }

  // Format default (USDT / USD / internasional)
  if (price >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (price >= 1) {
    return price.toFixed(4);
  }
  return price.toFixed(6);
}

/**
 * Memformat angka harga lengkap dengan simbol/unit mata uang kuotasi yang tepat
 * sesuai aturan Crypto-Denominated Precision (tanpa memaksakan prefix '$' pada pair BTC atau kripto non-USD).
 */
export function formatPriceWithQuoteSymbol(price: number, quoteCurrency?: string): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) return '--';
  const upperQuote = (quoteCurrency || 'USDT').trim().toUpperCase();
  const formatted = formatPriceLabel(price, upperQuote);

  if (upperQuote === 'IDR') {
    return `Rp ${formatted}`;
  }
  if (upperQuote === 'BTC') {
    return formatted;
  }
  if (upperQuote === 'EUR') {
    return `€${formatted}`;
  }
  if (upperQuote === 'GBP') {
    return `£${formatted}`;
  }
  if (upperQuote === 'TRY') {
    return `₺${formatted}`;
  }
  if (
    upperQuote === 'USD' ||
    upperQuote === 'USDT' ||
    upperQuote === 'USDC' ||
    upperQuote === 'FDUSD' ||
    upperQuote === 'BUSD'
  ) {
    return `$${formatted}`;
  }
  return `${formatted} ${upperQuote}`;
}

/**
 * Mengekstrak label harga dari objek gambar aktif (khususnya Posisi Long/Short Risk-Reward & Garis Horisontal)
 */
export function extractDrawingPriceBadges(
  drawings: any[],
  priceToY?: (price: number) => number | null,
  quoteCurrency?: string
): PriceScaleBadge[] {
  if (!Array.isArray(drawings) || drawings.length === 0) return [];

  const badges: PriceScaleBadge[] = [];
  const seenEntries = new Set<string>();
  const seenStopLosses = new Set<string>();

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
      const sanitize = (val: any) => (typeof val === 'number' && !isNaN(val) ? roundToTickSize(val) : undefined);

      const entryPrice = sanitize(prices?.entry ?? anchors[0]?.price);
      const stopPrice = sanitize(prices?.stop ?? anchors[1]?.price);
      const targetPrice = sanitize(prices?.target ?? anchors[2]?.price);

      const hasValidEntry = typeof entryPrice === 'number' && !isNaN(entryPrice);
      const hasValidStop = typeof stopPrice === 'number' && !isNaN(stopPrice);
      const hasValidTarget = typeof targetPrice === 'number' && !isNaN(targetPrice);

      const riskDistance = hasValidEntry && hasValidStop ? Math.abs(entryPrice - stopPrice) : 0;
      const isBearish = d.metadata?.bias === 'bearish' || (hasValidEntry && hasValidStop && stopPrice > entryPrice);

      const planKey = d.metadata?.planId || d.id;

      if (hasValidEntry) {
        const entryKey = `${planKey}_${entryPrice}`;
        if (!seenEntries.has(entryKey)) {
          seenEntries.add(entryKey);
          const col = d.style?.lineColor || '#00f0ff';
          badges.push({
            id: `draw_${d.id}_entry`,
            price: entryPrice,
            label: formatPriceLabel(entryPrice, quoteCurrency),
            color: col,
            bgColor: '#1e293b',
            kind: 'entry',
            title: 'Entry',
            y: priceToY ? priceToY(entryPrice) : null,
          });
        }
      }

      if (hasValidTarget) {
        // Ekstraksi basis label target (misal 'TP1', 'TP2', 'Target')
        let baseLabel = d.metadata?.targetLabel || (d.metadata?.stageIndex ? `TP${d.metadata.stageIndex}` : '');
        if (!baseLabel && d.targetLabel) {
          // Bersihkan teks kurung lama jika ada (misal 'TP1 (4.22R)' -> 'TP1')
          baseLabel = d.targetLabel.replace(/\s*\([^)]*\)/g, '').trim();
        }
        if (!baseLabel) {
          baseLabel = d.metadata?.planId ? 'TP' : 'Target';
        }

        let tpTitle = `${baseLabel} (TP)`;
        if (riskDistance > 0 && hasValidEntry) {
          // Hitung R dinamis sesuai arah posisi
          const rawR = isBearish
            ? (entryPrice - targetPrice) / riskDistance
            : (targetPrice - entryPrice) / riskDistance;
          const sign = rawR >= 0 ? '+' : '-';
          const rStr = `${sign}${Math.abs(rawR).toFixed(2)}R`;
          tpTitle = `${baseLabel} (${rStr})`;
        } else if ((!hasValidEntry || !hasValidStop) && typeof d.metadata?.rMultiple === 'number' && !isNaN(d.metadata.rMultiple)) {
          const sign = d.metadata.rMultiple >= 0 ? '+' : '-';
          tpTitle = `${baseLabel} (${sign}${Math.abs(d.metadata.rMultiple).toFixed(2)}R)`;
        }

        badges.push({
          id: `draw_${d.id}_tp`,
          price: targetPrice,
          label: formatPriceLabel(targetPrice, quoteCurrency),
          color: '#10b981', // Hijau Bullish Take Profit
          bgColor: '#064e3b',
          kind: 'take_profit',
          title: tpTitle,
          y: priceToY ? priceToY(targetPrice) : null,
        });
      }

      if (hasValidStop) {
        const slKey = `${planKey}_${stopPrice}`;
        if (!seenStopLosses.has(slKey)) {
          seenStopLosses.add(slKey);
          const slBase = d.metadata?.planId ? 'SL' : 'Stop';
          const slTitle = riskDistance > 0 ? `${slBase} (-1.00R)` : (d.metadata?.planId ? 'SL' : 'Stop (SL)');

          badges.push({
            id: `draw_${d.id}_sl`,
            price: stopPrice,
            label: formatPriceLabel(stopPrice, quoteCurrency),
            color: '#ef4444', // Merah Bearish Stop Loss
            bgColor: '#7f1d1d',
            kind: 'stop_loss',
            title: slTitle,
            y: priceToY ? priceToY(stopPrice) : null,
          });
        }
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
          label: formatPriceLabel(p, quoteCurrency),
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
  priceToY?: (price: number) => number | null,
  quoteCurrency?: string
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
        label: formatPriceLabel(val, quoteCurrency),
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
