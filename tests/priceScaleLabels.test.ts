// Unit Tests untuk Price Scale Labels (Indikator & Posisi Long/Short)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDrawingPriceBadges,
  extractIndicatorPriceBadges,
  type PriceScaleBadge
} from '../src/lib/services/priceScaleLabelService';

test('Price Scale Labels (Indikator & Posisi Drawing) Seam Suite', async (t) => {
  const dummyPriceToY = (price: number) => Math.round((100000 - price) * 0.1);

  await t.test('1. Posisi Long (Risk/Reward): anchors[1]=SL, anchors[2]=TP menghasilkan badge TP hijau & SL merah', () => {
    // Sesuai kontrak Vela: anchors[0] = Entry, anchors[1] = Stop Loss, anchors[2] = Target Profit
    const drawings = [
      {
        id: 'pos_long',
        type: 'position',
        visible: true,
        anchors: [
          { time: 1700000000000, price: 2547.17 }, // Entry
          { time: 1700000600000, price: 2529.75 }, // Stop Loss (SL)
          { time: 1700000600000, price: 2601.57 }, // Target (TP)
        ],
        style: { lineColor: '#3b82f6' },
      },
    ];

    const badges = extractDrawingPriceBadges(drawings as any, dummyPriceToY);
    assert.equal(badges.length, 3);

    const entry = badges.find((b) => b.kind === 'entry');
    assert.ok(entry);
    assert.equal(entry.price, 2547.17);
    assert.equal(entry.label, '2,547.17');
    assert.equal(entry.title, 'Entry');

    const tp = badges.find((b) => b.kind === 'take_profit');
    assert.ok(tp);
    assert.equal(tp.price, 2601.57);
    assert.equal(tp.label, '2,601.57');
    assert.equal(tp.title, 'Target (TP)');
    assert.equal(tp.color, '#10b981'); // Bullish green

    const sl = badges.find((b) => b.kind === 'stop_loss');
    assert.ok(sl);
    assert.equal(sl.price, 2529.75);
    assert.equal(sl.label, '2,529.75');
    assert.equal(sl.title, 'Stop (SL)');
    assert.equal(sl.color, '#ef4444'); // Bearish red
  });

  await t.test('1b. Posisi Short (Risk/Reward): anchors[1]=SL (atas), anchors[2]=TP (bawah)', () => {
    const drawings = [
      {
        id: 'pos_short',
        type: 'position',
        visible: true,
        anchors: [
          { time: 1700000000000, price: 2547.17 }, // Entry
          { time: 1700000600000, price: 2601.57 }, // Stop Loss (di atas entry)
          { time: 1700000600000, price: 2480.00 }, // Target TP (di bawah entry)
        ],
        style: { lineColor: '#3b82f6' },
      },
    ];

    const badges = extractDrawingPriceBadges(drawings as any, dummyPriceToY);
    assert.equal(badges.length, 3);

    const tp = badges.find((b) => b.kind === 'take_profit');
    assert.ok(tp);
    assert.equal(tp.price, 2480.00);
    assert.equal(tp.label, '2,480.00');
    assert.equal(tp.title, 'Target (TP)');
    assert.equal(tp.color, '#10b981');

    const sl = badges.find((b) => b.kind === 'stop_loss');
    assert.ok(sl);
    assert.equal(sl.price, 2601.57);
    assert.equal(sl.label, '2,601.57');
    assert.equal(sl.title, 'Stop (SL)');
    assert.equal(sl.color, '#ef4444');
  });

  await t.test('2. Gambar Tersembunyi (visible: false) tidak dimunculkan di skala harga', () => {
    const drawings = [
      {
        id: 'pos_hidden',
        type: 'position',
        visible: false,
        anchors: [
          { time: 1700000000000, price: 84000 },
          { time: 1700000600000, price: 86500 },
          { time: 1700000600000, price: 83000 },
        ],
        style: {},
      },
    ];

    const badges = extractDrawingPriceBadges(drawings as any, dummyPriceToY);
    assert.equal(badges.length, 0);
  });

  await t.test('3. Horizontal Line & Ray menghasilkan badge harga tunggal', () => {
    const drawings = [
      {
        id: 'hline_1',
        type: 'hline',
        visible: true,
        anchors: [{ time: 1700000000000, price: 85250.75 }],
        style: { lineColor: '#eab308' },
      },
    ];

    const badges = extractDrawingPriceBadges(drawings as any, dummyPriceToY);
    assert.equal(badges.length, 1);
    assert.equal(badges[0].price, 85250.75);
    assert.equal(badges[0].label, '85,250.75');
    assert.equal(badges[0].color, '#eab308');
  });

  await t.test('4. Indikator aktif dengan nilai terakhir menghasilkan badge skala harga', () => {
    const indicators = [
      {
        id: 'ema_20',
        title: 'EMA 20',
        visible: true,
        color: '#f97316',
        lastValue: 84120.5,
      },
      {
        id: 'sma_200_hidden',
        title: 'SMA 200',
        visible: false,
        color: '#3b82f6',
        lastValue: 80000,
      },
    ];

    const badges = extractIndicatorPriceBadges(indicators as any, dummyPriceToY);
    assert.equal(badges.length, 1);
    assert.equal(badges[0].id, 'ind_ema_20');
    assert.equal(badges[0].price, 84120.5);
    assert.equal(badges[0].label, '84,120.50');
    assert.equal(badges[0].color, '#f97316');
  });

  await t.test('5. Live Dragging: Mutasi in-place pada anchor target/stop memperbarui nilai badge secara instan', () => {
    // Simulasi drawing instance posisi Long yang dimutasi in-place saat user menggeser target handle
    const drawingInstance = {
      id: 'pos_live_drag',
      type: 'position',
      visible: true,
      anchors: [
        { time: 1700000000000, price: 2500.00 }, // Entry
        { time: 1700000600000, price: 2450.00 }, // Stop Loss
        { time: 1700000600000, price: 2600.00 }, // Target Profit (awal)
      ],
      style: { lineColor: '#3b82f6' },
      prices() {
        return {
          entry: this.anchors[0].price,
          stop: this.anchors[1].price,
          target: this.anchors[2].price,
        };
      },
    };

    const drawingsList = [drawingInstance];

    // Frame 1: Ekstraksi awal sebelum drag
    const initialBadges = extractDrawingPriceBadges(drawingsList as any, dummyPriceToY);
    const initialTp = initialBadges.find((b) => b.kind === 'take_profit');
    assert.ok(initialTp);
    assert.equal(initialTp.price, 2600.00);
    assert.equal(initialTp.label, '2,600.00');

    // Frame 2: User menggeser target ke atas menjadi 2750.50 (in-place mutation pada anchor)
    drawingInstance.anchors[2].price = 2750.50;
    const dragBadges = extractDrawingPriceBadges(drawingsList as any, dummyPriceToY);
    const draggedTp = dragBadges.find((b) => b.kind === 'take_profit');
    assert.ok(draggedTp);
    assert.equal(draggedTp.price, 2750.50);
    assert.equal(draggedTp.label, '2,750.50');
    assert.equal(draggedTp.color, '#10b981');

    // Frame 3: User menggeser stop loss menjadi 2420.00
    drawingInstance.anchors[1].price = 2420.00;
    const stopDragBadges = extractDrawingPriceBadges(drawingsList as any, dummyPriceToY);
    const draggedSl = stopDragBadges.find((b) => b.kind === 'stop_loss');
    assert.ok(draggedSl);
    assert.equal(draggedSl.price, 2420.00);
    assert.equal(draggedSl.label, '2,420.00');
    assert.equal(draggedSl.color, '#ef4444');
  });

  await t.test('6. Multi-drawing independence: Mutasi pada satu drawing tidak mempengaruhi drawing lain', () => {
    const drawing1 = {
      id: 'd1_long',
      type: 'position',
      visible: true,
      anchors: [
        { time: 1700000000000, price: 100 },
        { time: 1700000600000, price: 90 },
        { time: 1700000600000, price: 120 },
      ],
      style: { lineColor: '#3b82f6' },
    };
    const drawing2 = {
      id: 'd2_short',
      type: 'position',
      visible: true,
      anchors: [
        { time: 1700000000000, price: 50 },
        { time: 1700000600000, price: 55 },
        { time: 1700000600000, price: 40 },
      ],
      style: { lineColor: '#3b82f6' },
    };

    const list = [drawing1, drawing2];
    drawing1.anchors[2].price = 140; // Hanya ubah TP drawing 1

    const badges = extractDrawingPriceBadges(list as any, dummyPriceToY);
    const d1Tp = badges.find((b) => b.id === 'draw_d1_long_tp');
    const d2Tp = badges.find((b) => b.id === 'draw_d2_short_tp');

    assert.ok(d1Tp);
    assert.ok(d2Tp);
    assert.equal(d1Tp.price, 140);
    assert.equal(d1Tp.label, '140.0000'); // < 1000 menggunakan 4 desimal
    assert.equal(d2Tp.price, 40);
    assert.equal(d2Tp.label, '40.0000');
  });

  await t.test('7. Micro-precision crypto: Harga < 1 tidak dibulatkan ke 0.00', () => {
    const drawing = {
      id: 'd_micro',
      type: 'hline',
      visible: true,
      anchors: [{ time: 1700000000000, price: 0.005123 }],
      style: { lineColor: '#eab308' },
    };

    const badges = extractDrawingPriceBadges([drawing] as any, dummyPriceToY);
    assert.equal(badges.length, 1);
    assert.equal(badges[0].price, 0.005123);
    assert.equal(badges[0].label, '0.005123');
  });
});
