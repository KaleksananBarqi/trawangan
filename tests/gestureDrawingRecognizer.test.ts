// Pengujian TDD: Core Gesture Recognizer & Linear Drawing Tools (#104)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recognizeGesture,
  snapToNearestCandleWick,
  calculateStrokeAngle,
  type GesturePoint,
  type GestureRecognizerOptions
} from '../src/lib/services/gestureDrawingRecognizer';

test('Core Gesture Recognizer Seam Suite (#104)', async (t) => {
  await t.test('1. Mengabaikan goresan yang terlalu pendek atau tidak valid (< 2 titik atau < 10px)', () => {
    // 0 atau 1 titik
    assert.deepEqual(recognizeGesture([]), {
      tool: null,
      confidence: 0,
      candidates: [],
      points: []
    });

    assert.deepEqual(recognizeGesture([{ x: 100, y: 100 }]), {
      tool: null,
      confidence: 0,
      candidates: [],
      points: []
    });

    // Jarak < 10px (jitter/klik tidak sengaja)
    const tinyStroke: GesturePoint[] = [
      { x: 100, y: 100 },
      { x: 103, y: 102 }
    ];
    const res = recognizeGesture(tinyStroke);
    assert.equal(res.tool, null);
    assert.equal(res.confidence, 0);
  });

  await t.test('2. Klasifikasi garis horizontal lurus (kemiringan sudut < 7°)', () => {
    // Sudut 0° (murni datar dari x=100 ke x=400, y=250)
    const flatStroke: GesturePoint[] = [
      { x: 100, y: 250 },
      { x: 200, y: 250 },
      { x: 300, y: 250 },
      { x: 400, y: 250 }
    ];
    const resFlat = recognizeGesture(flatStroke);
    assert.equal(resFlat.tool, 'hline');
    assert.ok(resFlat.confidence >= 0.85);
    assert.equal(resFlat.candidates[0].tool, 'hline');
    assert.equal(resFlat.candidates[0].label, 'Horizontal Line');
    assert.equal(resFlat.points.length, 2);
    assert.equal(resFlat.points[0].y, 250);
    assert.equal(resFlat.points[1].y, 250);

    // Sedikit miring tapi < 7° (misal dx=300, dy=15 -> ~2.86°)
    const slightSlope: GesturePoint[] = [
      { x: 50, y: 100 },
      { x: 150, y: 105 },
      { x: 250, y: 110 },
      { x: 350, y: 115 }
    ];
    const angle = calculateStrokeAngle(slightSlope);
    assert.ok(angle < 7, `Sudut ${angle}° harus < 7°`);

    const resSlight = recognizeGesture(slightSlope);
    assert.equal(resSlight.tool, 'hline');
    assert.equal(resSlight.candidates[0].tool, 'hline');
    // Titik Y horizontal harus diselaraskan
    assert.equal(resSlight.points[0].y, resSlight.points[1].y);
  });

  await t.test('3. Klasifikasi garis vertikal tegak (kemiringan sudut > 83°)', () => {
    // Sudut 90° (murni tegak dari y=50 ke y=400, x=200)
    const straightVertical: GesturePoint[] = [
      { x: 200, y: 50 },
      { x: 200, y: 150 },
      { x: 200, y: 280 },
      { x: 200, y: 400 }
    ];
    const resVert = recognizeGesture(straightVertical);
    assert.equal(resVert.tool, 'vline');
    assert.ok(resVert.confidence >= 0.85);
    assert.equal(resVert.candidates[0].tool, 'vline');
    assert.equal(resVert.candidates[0].label, 'Vertical Line');
    assert.equal(resVert.points.length, 2);
    // Titik X vertikal harus diselaraskan
    assert.equal(resVert.points[0].x, resVert.points[1].x);

    // Miring sedikit dari tegak tapi > 83° (misal dx=15, dy=300 -> ~87.14°)
    const slightTiltVertical: GesturePoint[] = [
      { x: 100, y: 50 },
      { x: 105, y: 150 },
      { x: 110, y: 250 },
      { x: 115, y: 350 }
    ];
    const vertAngle = calculateStrokeAngle(slightTiltVertical);
    assert.ok(vertAngle > 83, `Sudut ${vertAngle}° harus > 83°`);

    const resTiltVert = recognizeGesture(slightTiltVertical);
    assert.equal(resTiltVert.tool, 'vline');
    assert.equal(resTiltVert.candidates[0].tool, 'vline');
  });

  await t.test('4. Klasifikasi ray menuju sumbu harga kanan', () => {
    // Garis diagonal yang ditarik ke kanan dan berakhir dekat batas sumbu kanan (canvasWidth: 1000, margin: 50px)
    const rayStroke: GesturePoint[] = [
      { x: 200, y: 300 },
      { x: 500, y: 250 },
      { x: 750, y: 200 },
      { x: 970, y: 180 } // x=970 berada dalam batas 50px dari 1000
    ];

    const opts: GestureRecognizerOptions = {
      canvasWidth: 1000,
      rightMarginThreshold: 50
    };

    const resRay = recognizeGesture(rayStroke, opts);
    assert.equal(resRay.tool, 'ray');
    assert.ok(resRay.confidence > 0.7);
    assert.equal(resRay.candidates[0].tool, 'ray');
    assert.equal(resRay.candidates[0].label, 'Ray');

    // Tab candidate cycling harus menyediakan Trend Line dan Horizontal Line sebagai opsi alternatif
    const candidateTools = resRay.candidates.map((c) => c.tool);
    assert.ok(candidateTools.includes('trendline'));
    assert.ok(candidateTools.includes('hline'));
  });

  await t.test('5. Klasifikasi trendline diagonal biasa', () => {
    // Garis diagonal dari tengah kanvas yang tidak mencapai tepi kanan
    const diagonalStroke: GesturePoint[] = [
      { x: 100, y: 100 },
      { x: 200, y: 180 },
      { x: 300, y: 260 },
      { x: 400, y: 340 }
    ];

    const opts: GestureRecognizerOptions = {
      canvasWidth: 1000,
      rightMarginThreshold: 50
    };

    const angle = calculateStrokeAngle(diagonalStroke);
    assert.ok(angle >= 7 && angle <= 83, `Sudut ${angle}° harus di antara 7° dan 83°`);

    const resTrend = recognizeGesture(diagonalStroke, opts);
    assert.equal(resTrend.tool, 'trendline');
    assert.ok(resTrend.confidence > 0.7);
    assert.equal(resTrend.candidates[0].tool, 'trendline');
    assert.equal(resTrend.candidates[0].label, 'Trend Line');

    // Kandidat alternatif harus mencakup ray
    assert.ok(resTrend.candidates.some((c) => c.tool === 'ray'));
  });

  await t.test('6. snapToNearestCandleWick menempelkan koordinat Y ke level ekor lilin dalam radius 20px', () => {
    const candleWicks = [
      { highY: 120, lowY: 180 },
      { highY: 240, lowY: 310 },
      { highY: 450, lowY: 520 }
    ];

    // Jarak 8px dari High 240 (targetY = 248) -> harus snap ke 240
    const snap1 = snapToNearestCandleWick(248, candleWicks, 20);
    assert.equal(snap1.snapped, true);
    assert.equal(snap1.y, 240);
    assert.equal(snap1.distance, 8);

    // Jarak 15px dari Low 180 (targetY = 165) -> harus snap ke 180
    const snap2 = snapToNearestCandleWick(165, candleWicks, 20);
    assert.equal(snap2.snapped, true);
    assert.equal(snap2.y, 180);
    assert.equal(snap2.distance, 15);

    // Jarak 25px (di luar radius 20px) -> tidak boleh snap
    const snap3 = snapToNearestCandleWick(275, candleWicks, 20);
    assert.equal(snap3.snapped, false);
    assert.equal(snap3.y, 275);
    assert.equal(snap3.distance, 0);

    // Bekerja dengan array angka Y langsung
    const rawWickLevels = [100, 200, 300];
    const snap4 = snapToNearestCandleWick(195, rawWickLevels, 20);
    assert.equal(snap4.snapped, true);
    assert.equal(snap4.y, 200);
  });

  await t.test('7. recognizeGesture otomatis melakukan wick snapping pada Horizontal Line dan Ray', () => {
    const candleWicks = [
      { highY: 300, lowY: 380 }
    ];

    // Garis horizontal ditarik pada Y=308 (jarak 8px dari High wick 300)
    const hlineNearWick: GesturePoint[] = [
      { x: 100, y: 308 },
      { x: 300, y: 308 }
    ];

    const res = recognizeGesture(hlineNearWick, { wicks: candleWicks, wickSnapRadius: 20 });
    assert.equal(res.tool, 'hline');
    // Titik Y harus di-snap ke 300 persis
    assert.equal(res.points[0].y, 300);
    assert.equal(res.points[1].y, 300);

    // Ray dengan titik awal Y=295 (jarak 5px dari High wick 300) dan sudut diagonal ~12°
    const rayNearWick: GesturePoint[] = [
      { x: 150, y: 295 },
      { x: 600, y: 200 },
      { x: 980, y: 120 }
    ];

    const resRay = recognizeGesture(rayNearWick, {
      canvasWidth: 1000,
      wicks: candleWicks,
      wickSnapRadius: 20
    });
    assert.equal(resRay.tool, 'ray');
    // Titik awal Y harus di-snap ke 300
    assert.equal(resRay.points[0].y, 300);
  });
});
