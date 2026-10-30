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

  await t.test('8. Klasifikasi loop 4 sudut menghasilkan box (Rectangle / Order Block) (#105)', () => {
    // Loop 4 sisi persegi panjang tertutup
    const boxStroke: GesturePoint[] = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 180 },
      { x: 300, y: 250 },
      { x: 200, y: 250 },
      { x: 100, y: 250 },
      { x: 100, y: 170 },
      { x: 100, y: 100 }
    ];

    const res = recognizeGesture(boxStroke);
    assert.equal(res.tool, 'box');
    assert.ok(res.confidence >= 0.85);
    assert.equal(res.candidates[0].tool, 'box');
    assert.equal(res.candidates[0].label, 'Rectangle / Box');
    assert.ok(res.candidates.some((c) => c.tool === 'ellipse'));
    assert.equal(res.points.length, 2);
    assert.equal(res.points[0].x, 100);
    assert.equal(res.points[0].y, 100);
    assert.equal(res.points[1].x, 300);
    assert.equal(res.points[1].y, 250);

    // Variasi: loop persegi panjang yang ujungnya sedikit tidak rapat (jarak < 25% diagonal)
    const slightlyOpenBox: GesturePoint[] = [
      { x: 150, y: 200 },
      { x: 350, y: 200 },
      { x: 350, y: 320 },
      { x: 150, y: 320 },
      { x: 155, y: 205 }
    ];
    const resOpen = recognizeGesture(slightlyOpenBox);
    assert.equal(resOpen.tool, 'box');
    assert.equal(resOpen.candidates[0].tool, 'box');
  });

  await t.test('9. Klasifikasi lingkaran atau oval mulus menghasilkan ellipse (#105)', () => {
    // Kurva oval halus tanpa sudut tajam (36 titik)
    const ovalStroke: GesturePoint[] = [];
    const centerX = 200;
    const centerY = 150;
    const radiusX = 80;
    const radiusY = 50;
    for (let i = 0; i <= 36; i++) {
      const angleRad = (i / 36) * 2 * Math.PI;
      ovalStroke.push({
        x: Math.round(centerX + radiusX * Math.cos(angleRad)),
        y: Math.round(centerY + radiusY * Math.sin(angleRad))
      });
    }

    const res = recognizeGesture(ovalStroke);
    assert.equal(res.tool, 'ellipse');
    assert.ok(res.confidence >= 0.85);
    assert.equal(res.candidates[0].tool, 'ellipse');
    assert.equal(res.candidates[0].label, 'Ellipse');
    assert.ok(res.candidates.some((c) => c.tool === 'box'));
    assert.equal(res.points.length, 2);
    // Bounding box oval
    assert.equal(res.points[0].x, centerX - radiusX);
    assert.equal(res.points[0].y, centerY - radiusY);
    assert.equal(res.points[1].x, centerX + radiusX);
    assert.equal(res.points[1].y, centerY + radiusY);
  });

  await t.test('10. Klasifikasi goresan berbatang lurus dengan terminal hook menghasilkan arrow (#105)', () => {
    // Panah horizontal: batang lurus dari x=100 ke x=400 (y=200), lalu kait balik ke (370, 170)
    const horizontalArrow: GesturePoint[] = [
      { x: 100, y: 200 },
      { x: 200, y: 200 },
      { x: 300, y: 200 },
      { x: 400, y: 200 }, // Ujung panah
      { x: 370, y: 170 }  // Kait panah tajam
    ];

    const res = recognizeGesture(horizontalArrow);
    assert.equal(res.tool, 'arrow');
    assert.ok(res.confidence >= 0.85);
    assert.equal(res.candidates[0].tool, 'arrow');
    assert.equal(res.candidates[0].label, 'Arrow');
    assert.ok(res.candidates.some((c) => c.tool === 'trendline'));
    assert.ok(res.candidates.some((c) => c.tool === 'ray'));
    assert.equal(res.points.length, 2);
    assert.equal(res.points[0].x, 100);
    assert.equal(res.points[0].y, 200);
    assert.equal(res.points[1].x, 400);
    assert.equal(res.points[1].y, 200);

    // Panah diagonal
    const diagonalArrow: GesturePoint[] = [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 300, y: 300 }, // Ujung panah
      { x: 280, y: 260 }  // Kait panah
    ];
    const resDiag = recognizeGesture(diagonalArrow);
    assert.equal(resDiag.tool, 'arrow');
    assert.equal(resDiag.points[0].x, 100);
    assert.equal(resDiag.points[1].x, 300);
  });

  await t.test('11. Klasifikasi goresan Z/N 3 segmen menghasilkan fibretracement & mendukung extreme wick snapping (#105)', () => {
    // Pola Z (Swing High ke Swing Low)
    const zStroke: GesturePoint[] = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 300, y: 100 }, // Belokan 1
      { x: 220, y: 200 },
      { x: 150, y: 300 }, // Belokan 2
      { x: 250, y: 300 },
      { x: 350, y: 300 }
    ];

    const res = recognizeGesture(zStroke);
    assert.equal(res.tool, 'fibretracement');
    assert.ok(res.confidence >= 0.85);
    assert.equal(res.candidates[0].tool, 'fibretracement');
    assert.equal(res.candidates[0].label, 'Fib Retracement');
    assert.ok(res.candidates.some((c) => c.tool === 'path'));
    assert.ok(res.candidates.some((c) => c.tool === 'trendline'));
    assert.equal(res.points.length, 2);
    assert.equal(res.points[0].y, 100);
    assert.equal(res.points[1].y, 300);

    // Pola N (Ayunan vertikal)
    const nStroke: GesturePoint[] = [
      { x: 100, y: 300 },
      { x: 100, y: 100 }, // Belokan 1 (High)
      { x: 200, y: 300 }, // Belokan 2 (Low)
      { x: 200, y: 100 }
    ];
    const resN = recognizeGesture(nStroke);
    assert.equal(resN.tool, 'fibretracement');

    // Extreme Wick Snapping: menempelkan Y ekstrem ke High wick (92) dan Low wick (308)
    const candleWicks = [
      { highY: 92, lowY: 150 },
      { highY: 260, lowY: 308 }
    ];

    const resSnapped = recognizeGesture(zStroke, {
      wicks: candleWicks,
      wickSnapRadius: 20
    });
    assert.equal(resSnapped.tool, 'fibretracement');
    assert.equal(resSnapped.points[0].y, 92);  // Menempel ke 92 dari 100
    assert.equal(resSnapped.points[1].y, 308); // Menempel ke 308 dari 300
  });

  await t.test('12. Klasifikasi poliline terbuka berkelok-kelok (> 2 belokan) menghasilkan path (#105)', () => {
    // Poliline 4 segmen dengan 3 sudut tajam
    const multiBendPath: GesturePoint[] = [
      { x: 100, y: 100 },
      { x: 200, y: 220 }, // Belokan 1
      { x: 260, y: 140 }, // Belokan 2
      { x: 360, y: 320 }, // Belokan 3
      { x: 460, y: 200 }
    ];

    const res = recognizeGesture(multiBendPath);
    assert.equal(res.tool, 'path');
    assert.ok(res.confidence >= 0.85);
    assert.equal(res.candidates[0].tool, 'path');
    assert.equal(res.candidates[0].label, 'Path');
    assert.ok(res.candidates.some((c) => c.tool === 'trendline'));
    // Path mempertahankan koordinat simpul-simpul poliline
    assert.ok(res.points.length >= 4);
  });

  await t.test('13. Deteksi pola goresan scribble zigzag bolak-balik menghasilkan tool scribble (#106)', () => {
    // Pola coretan zigzag horizontal rapat bolak-balik (> 3 reversal, rasio pathLength / diagonal > 3.5)
    const horizontalScribble: GesturePoint[] = [
      { x: 100, y: 100 },
      { x: 200, y: 105 }, // Kanan (+100)
      { x: 105, y: 110 }, // Kiri (-95, Rev 1)
      { x: 195, y: 115 }, // Kanan (+90, Rev 2)
      { x: 110, y: 120 }, // Kiri (-85, Rev 3)
      { x: 200, y: 125 }  // Kanan (+90, Rev 4)
    ];

    const resH = recognizeGesture(horizontalScribble);
    assert.equal(resH.tool, 'scribble');
    assert.ok(resH.confidence >= 0.85);
    assert.equal(resH.candidates[0].tool, 'scribble');
    assert.ok(resH.scribbleBounds);
    assert.equal(resH.scribbleBounds.minX, 100);
    assert.equal(resH.scribbleBounds.maxX, 200);
    assert.equal(resH.scribbleBounds.minY, 100);
    assert.equal(resH.scribbleBounds.maxY, 125);

    // Pola coretan zigzag vertikal rapat bolak-balik
    const verticalScribble: GesturePoint[] = [
      { x: 100, y: 100 },
      { x: 105, y: 200 }, // Bawah (+100)
      { x: 110, y: 105 }, // Atas (-95, Rev 1)
      { x: 115, y: 195 }, // Bawah (+90, Rev 2)
      { x: 120, y: 110 }, // Atas (-85, Rev 3)
      { x: 125, y: 200 }  // Bawah (+90, Rev 4)
    ];

    const resV = recognizeGesture(verticalScribble);
    assert.equal(resV.tool, 'scribble');
    assert.ok(resV.confidence >= 0.85);
    assert.equal(resV.candidates[0].tool, 'scribble');
    assert.ok(resV.scribbleBounds);
    assert.equal(resV.scribbleBounds.minX, 100);
    assert.equal(resV.scribbleBounds.maxX, 125);
    assert.equal(resV.scribbleBounds.minY, 100);
    assert.equal(resV.scribbleBounds.maxY, 200);
  });
});
