import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTradingPlan,
  validatePlanSanity,
  type ParsedTradingPlan,
  type ParsedTarget,
  type PlanValidationResult,
} from '../src/lib/services/planParserService';

describe('Ticket 1 (#110): Deterministic Plan Parser & Sanity Guard Service', () => {
  const sampleMarkdownTable = `
|**Parameter**|**Nilai**|
|---|---|
|Bias|Bearish|
|Entry|81200.0 (Limit sell di dalam area FVG LTF 81182.2 - 81236.7)|
|Alasan Entry|Respek terhadap _unfilled_ Bearish FVG LTF [FAKTA], likuiditas buy-side internal tersapu [INFERENSI]|
|Stop Loss|81400.0|
|Alasan SL|Di atas swing high 81380.0 dengan buffer 20 poin [FAKTA]|
|TP1|80355.4|
|R multiple TP1|4.22R (R = |81200.0 - 81400.0| = 200). Jarak TP1 = 844.6. R: 844.6 / 200 = 4.223|
|Alasan TP1|Swing low terdekat 15m & penutupan imbalance lokal [INFERENSI]|
|TP2|79429.0|
|R multiple TP2|8.85R. Jarak TP2 = 1771.0. R: 1771.0 / 200 = 8.855|
|Alasan TP2|Draw on liquidity SSL utama harian [SPEKULASI]|
`.trim();

  describe('1. Parsing Tabel Markdown Rencana Perdagangan', () => {
    it('mengurai seluruh parameter tabel Markdown dengan akurat', () => {
      const plan = parseTradingPlan(sampleMarkdownTable);

      assert.equal(plan.bias, 'bearish');
      assert.equal(plan.entry, 81200.0);
      assert.equal(plan.stopLoss, 81400.0);
      assert.equal(plan.riskAmount, 200.0);
      assert.equal(plan.targets.length, 2);

      // Target 1
      assert.equal(plan.targets[0].id, 'tp1');
      assert.equal(plan.targets[0].label, 'TP1');
      assert.equal(plan.targets[0].price, 80355.4);
      assert.equal(plan.targets[0].rMultiple, 4.22);
      assert.equal(plan.targets[0].distance, 844.6);
      assert.match(plan.targets[0].reason || '', /Swing low terdekat/);

      // Target 2
      assert.equal(plan.targets[1].id, 'tp2');
      assert.equal(plan.targets[1].label, 'TP2');
      assert.equal(plan.targets[1].price, 79429.0);
      assert.equal(plan.targets[1].rMultiple, 8.85);
      assert.equal(plan.targets[1].distance, 1771.0);
      assert.match(plan.targets[1].reason || '', /Draw on liquidity SSL/);

      // Validasi berhasil
      assert.equal(plan.validation.valid, true);
      assert.equal(plan.validation.errors.length, 0);

      // Raw text dipertahankan
      assert.equal(plan.rawText, sampleMarkdownTable);
    });

    it('mengekstrak kamus alasan (reasons) dan tag epistemik', () => {
      const plan = parseTradingPlan(sampleMarkdownTable);

      assert.ok(plan.reasons.entry);
      assert.match(plan.reasons.entry, /\[FAKTA\]/);
      assert.match(plan.reasons.entry, /\[INFERENSI\]/);

      assert.ok(plan.reasons.stopLoss);
      assert.match(plan.reasons.stopLoss, /swing high 81380\.0/);

      assert.ok(plan.reasons.tp1);
      assert.ok(plan.reasons.tp2);
      assert.match(plan.reasons.tp2, /\[SPEKULASI\]/);
    });

    it('mengekstrak zona konteks (contextZones) seperti area FVG', () => {
      const plan = parseTradingPlan(sampleMarkdownTable);

      assert.ok(plan.contextZones.length >= 1);
      const fvgZone = plan.contextZones.find((z) => z.low === 81182.2 && z.high === 81236.7);
      assert.ok(fvgZone, 'Zona FVG 81182.2 - 81236.7 harus terdeteksi');
      assert.match(fvgZone.label, /FVG/i);
    });
  });

  describe('2. Parsing Format Teks Biasa (Key-Value)', () => {
    it('mengurai format baris teks biasa tanpa format tabel', () => {
      const plainText = `
Bias: Bearish
Entry: 81200.0 (Area FVG)
Alasan Entry: Rejection FVG
Stop Loss: 81400.0
Alasan SL: Swing High
TP1: 80355.4
Alasan TP1: Liquidity run
TP2: 79429.0
Alasan TP2: Daily demand
`.trim();

      const plan = parseTradingPlan(plainText);
      assert.equal(plan.bias, 'bearish');
      assert.equal(plan.entry, 81200.0);
      assert.equal(plan.stopLoss, 81400.0);
      assert.equal(plan.riskAmount, 200.0);
      assert.equal(plan.targets.length, 2);
      assert.equal(plan.targets[0].price, 80355.4);
      assert.equal(plan.targets[1].price, 79429.0);
      // R-multiple dihitung otomatis jika tidak disediakan eksplisit
      assert.equal(plan.targets[0].rMultiple, 4.22);
      assert.equal(plan.targets[1].rMultiple, 8.86); // (81200 - 79429) / 200 = 1771 / 200 = 8.855 -> rounded to 8.86
      assert.equal(plan.validation.valid, true);
    });

    it('mengenali variasi singkatan seperti SL, TP, Short, Long', () => {
      const text = `
Direction: Short
Entry: 50000
SL: 51000
TP: 48000
`.trim();

      const plan = parseTradingPlan(text);
      assert.equal(plan.bias, 'bearish');
      assert.equal(plan.entry, 50000);
      assert.equal(plan.stopLoss, 51000);
      assert.equal(plan.targets.length, 1);
      assert.equal(plan.targets[0].price, 48000);
      assert.equal(plan.targets[0].rMultiple, 2);
      assert.equal(plan.validation.valid, true);
    });

    it('mengurai rencana posisi Bullish / Long dengan benar', () => {
      const bullishText = `
|Parameter|Nilai|
|---|---|
|Bias|Bullish|
|Entry|65000.0|
|Stop Loss|64000.0|
|TP1|67000.0|
|TP2|70000.0|
`.trim();

      const plan = parseTradingPlan(bullishText);
      assert.equal(plan.bias, 'bullish');
      assert.equal(plan.entry, 65000.0);
      assert.equal(plan.stopLoss, 64000.0);
      assert.equal(plan.riskAmount, 1000.0);
      assert.equal(plan.targets.length, 2);
      assert.equal(plan.targets[0].rMultiple, 2.0);
      assert.equal(plan.targets[1].rMultiple, 5.0);
      assert.equal(plan.validation.valid, true);
    });
  });

  describe('3. Sanity Guard Validation Engine', () => {
    it('mendeteksi kesalahan jika Stop Loss di bawah Entry pada posisi Bearish', () => {
      const invalidBearish = `
Bias: Bearish
Entry: 81200.0
Stop Loss: 80000.0
TP1: 79000.0
`.trim();

      const plan = parseTradingPlan(invalidBearish);
      assert.equal(plan.validation.valid, false);
      assert.ok(
        plan.validation.errors.some((err) => /Stop Loss.*above.*Entry/i.test(err)),
        'Harus menghasilkan error SL di bawah Entry untuk Bearish'
      );
    });

    it('mendeteksi kesalahan jika Target TP di atas Entry pada posisi Bearish', () => {
      const invalidTargetBearish = `
Bias: Bearish
Entry: 81200.0
Stop Loss: 81500.0
TP1: 82000.0
`.trim();

      const plan = parseTradingPlan(invalidTargetBearish);
      assert.equal(plan.validation.valid, false);
      assert.ok(
        plan.validation.errors.some((err) => /Target.*below.*Entry/i.test(err)),
        'Harus menghasilkan error Target di atas Entry untuk Bearish'
      );
    });

    it('mendeteksi kesalahan jika Stop Loss di atas Entry pada posisi Bullish', () => {
      const invalidBullish = `
Bias: Bullish
Entry: 65000.0
Stop Loss: 66000.0
TP1: 68000.0
`.trim();

      const plan = parseTradingPlan(invalidBullish);
      assert.equal(plan.validation.valid, false);
      assert.ok(
        plan.validation.errors.some((err) => /Stop Loss.*below.*Entry/i.test(err)),
        'Harus menghasilkan error SL di atas Entry untuk Bullish'
      );
    });

    it('mendeteksi kesalahan jika Target TP di bawah Entry pada posisi Bullish', () => {
      const invalidTargetBullish = `
Bias: Bullish
Entry: 65000.0
Stop Loss: 64000.0
TP1: 63000.0
`.trim();

      const plan = parseTradingPlan(invalidTargetBullish);
      assert.equal(plan.validation.valid, false);
      assert.ok(
        plan.validation.errors.some((err) => /Target.*above.*Entry/i.test(err)),
        'Harus menghasilkan error Target di bawah Entry untuk Bullish'
      );
    });

    it('mendeteksi parameter tidak lengkap (missing entry / stopLoss / targets)', () => {
      const incomplete = `
Bias: Bullish
Entry: 65000.0
`.trim();

      const plan = parseTradingPlan(incomplete);
      assert.equal(plan.validation.valid, false);
      assert.ok(plan.validation.errors.some((err) => /Stop Loss/i.test(err)));
      assert.ok(plan.validation.errors.some((err) => /Target/i.test(err)));
    });

    it('mendeteksi bias netral atau tidak terdefinisi', () => {
      const neutral = `
Entry: 65000.0
Stop Loss: 64000.0
TP1: 67000.0
`.trim();

      const plan = parseTradingPlan(neutral);
      assert.equal(plan.bias, 'neutral');
      assert.equal(plan.validation.valid, false);
      assert.ok(plan.validation.errors.some((err) => /bias/i.test(err)));
    });

    it('memberikan peringatan jika urutan target tidak berurutan menjauhi entry', () => {
      const unorderedBearish = `
Bias: Bearish
Entry: 80000
Stop Loss: 81000
TP1: 75000
TP2: 78000
`.trim();

      const plan = parseTradingPlan(unorderedBearish);
      // Valid secara arah masing-masing (keduanya < Entry), tapi memunculkan warning
      assert.equal(plan.validation.valid, true);
      assert.ok(plan.validation.warnings.length > 0);
      assert.ok(plan.validation.warnings.some((w) => /TP2/i.test(w)));
    });

    it('validatePlanSanity dapat dipanggil mandiri', () => {
      const targets: ParsedTarget[] = [
        { id: 'tp1', label: 'TP1', price: 80000, distance: 1000, rMultiple: 1 },
      ];
      const res = validatePlanSanity('bearish', 81000, 82000, targets);
      assert.equal(res.valid, true);
      assert.equal(res.errors.length, 0);

      const invalidRes = validatePlanSanity('bearish', 81000, 80000, targets);
      assert.equal(invalidRes.valid, false);
      assert.ok(invalidRes.errors.length > 0);
    });
  });

  describe('4. Tick-Aligned Price Guard Sanitasi', () => {
    it('menyelaraskan nilai harga dengan options.tickSize', () => {
      const rawText = `
Bias: Bearish
Entry: 81200.37
Stop Loss: 81400.82
TP1: 80355.43
TP2: 79429.19
`.trim();

      // Tick size 0.5
      const plan = parseTradingPlan(rawText, { tickSize: 0.5 });
      assert.equal(plan.entry, 81200.5);
      assert.equal(plan.stopLoss, 81401.0);
      assert.equal(plan.targets[0].price, 80355.5);
      assert.equal(plan.targets[1].price, 79429.0);
      assert.equal(plan.riskAmount, 81401.0 - 81200.5);
    });

    it('menyelaraskan nilai zona konteks dengan options.tickSize', () => {
      const text = `
Bias: Bearish
Entry: 81200.0 (Area FVG 81182.23 - 81236.78)
Stop Loss: 81400.0
TP1: 80355.0
`.trim();

      const plan = parseTradingPlan(text, { tickSize: 0.1 });
      const zone = plan.contextZones[0];
      assert.ok(zone);
      assert.equal(zone.low, 81182.2);
      assert.equal(zone.high, 81236.8);
    });
  });

  describe('5. Toleransi Format dan Edge Cases', () => {
    it('mengabaikan format ribuan berkoma jika ada', () => {
      const formattedText = `
|Bias|Bullish|
|Entry|65,000.50|
|Stop Loss|64,000.00|
|TP1|68,000.00|
`.trim();

      const plan = parseTradingPlan(formattedText);
      assert.equal(plan.bias, 'bullish');
      assert.equal(plan.entry, 65000.5);
      assert.equal(plan.stopLoss, 64000.0);
      assert.equal(plan.targets[0].price, 68000.0);
      assert.equal(plan.validation.valid, true);
    });

    it('mendukung penulisan Take Profit tanpa nomor (tunggal) sebagai TP1', () => {
      const singleTarget = `
Bias: Long
Entry: 100
Stop Loss: 95
Take Profit: 110
`.trim();

      const plan = parseTradingPlan(singleTarget);
      assert.equal(plan.bias, 'bullish');
      assert.equal(plan.entry, 100);
      assert.equal(plan.stopLoss, 95);
      assert.equal(plan.targets.length, 1);
      assert.equal(plan.targets[0].id, 'tp1');
      assert.equal(plan.targets[0].label, 'TP1');
      assert.equal(plan.targets[0].price, 110);
      assert.equal(plan.targets[0].rMultiple, 2);
    });

    it('mengembalikan error gracefully jika teks kosong atau tidak bermakna', () => {
      const plan = parseTradingPlan('');
      assert.equal(plan.bias, 'neutral');
      assert.equal(plan.entry, 0);
      assert.equal(plan.stopLoss, 0);
      assert.equal(plan.targets.length, 0);
      assert.equal(plan.validation.valid, false);
      assert.ok(plan.validation.errors.length > 0);
    });
  });

  describe('6. Ekstraksi Kesimpulan, Probabilitas Setup & Skenario Invalidasi (#115)', () => {
    it('mengurai Bagian 6 Kesimpulan, Probabilitas Setup, dan Skenario Invalidasi', () => {
      const userFullText = `
5. Trading Plan

*Definisi: Entry diasumsikan dieksekusi konservatif pada rata-rata level Premium di 78300. Nilai R dikalkulasi dari Entry (78300) dan SL (78900). R = |78300 - 78900| = 600.*

| Parameter | Nilai |
| --- | --- |
| Bias | Bearish |
| Entry | 78300.0 (Tunggu harga masuk FVG MTF 78200.0 - 78377.9 diikuti 15m Bearish CHoCH) |
| Alasan Entry | Area *unfilled Bearish FVG* 1H bertumpang tindih dengan FVG 4H, merepresentasikan inefisiensi Premium yang belum dimitigasi **[FAKTA]**. Level ini adalah zona suplai institusional **[INFERENSI]**. |
| Stop Loss | 78900.0 |
| Alasan SL | Level ini diletakkan di atas MTF Swing High 78776.5 **[FAKTA]**. Jika level ini dibreak dan dipertahankan (close body), struktur MTF tervalidasi *shift* ke Bullish, menginvalidasi setup Bearish ini **[INFERENSI]**. |
| TP1 | 77300.0 |
| R multiple TP1 | 1.66R (R=600, Reward= |
| Alasan TP1 | Target objektif pertama menyapu SSL internal di 15m *Swing Low* terdekat **[FAKTA]**. Ini adalah titik aman pertama untuk mengamankan sebagian porsi posisi **[INFERENSI]**. |
| TP2 | 76270.0 |
| R multiple TP2 | 3.38R (R=600, Reward= |
| Alasan TP2 | Eksternal *Sell Side Liquidity* absolut dari rentang MTF, di mana penumpukan mayoritas *Stop Loss* LONG makro ritel bersarang **[INFERENSI]**. |
| RRR aktual (TP1) | 1:1.66 |
| RRR aktual (TP2) | 1:3.38 |

### 6. Kesimpulan & Confidence Level

* **Probabilitas Setup:** Medium-High. Tren HTF dan MTF sepenuhnya searah (Bearish). FVG Premium tersedia dengan jelas sebagai katalis entry, ditunjang pembentukan LTF *inducement*. (Catatan: RRR TP1 adalah 1:1.66 yang berada di bawah rasio emas 1:2, sehingga manajemen lot di TP1 harus rasional, sembari mempertahankan sisi *runners* untuk TP2 di atas 3R).
* **Skenario Invalidasi:** Jika harga agresif menembus level 78776.5 dengan candle 1H ditutup (*close*) kuat di atas level tersebut tanpa formasi penolakan (wick) atau absennya CHoCH Bearish LTF 15m, maka institusi tengah merombak arah tren makro dan setup SHORT batal secara mekanis.
      `.trim();

      const plan = parseTradingPlan(userFullText);

      assert.equal(plan.bias, 'bearish');
      assert.equal(plan.entry, 78300.0);
      assert.equal(plan.stopLoss, 78900.0);
      assert.equal(plan.riskAmount, 600.0);
      assert.equal(plan.targets.length, 2);
      assert.equal(plan.targets[0].price, 77300.0);
      assert.equal(plan.targets[1].price, 76270.0);

      // Verifikasi Kesimpulan
      assert.ok(plan.conclusion);
      assert.equal(plan.conclusion.probability, 'Medium-High');
      assert.match(plan.conclusion.probabilityNotes || '', /Tren HTF dan MTF sepenuhnya searah/);
      assert.match(plan.conclusion.invalidationScenario || '', /Jika harga agresif menembus level 78776.5/);

      // Verifikasi Definisi
      assert.match(plan.definition || '', /Entry diasumsikan dieksekusi konservatif/);

      // Verifikasi Zona FVG
      assert.ok(plan.contextZones.length > 0);
      assert.equal(plan.contextZones[0].low, 78200.0);
      assert.equal(plan.contextZones[0].high, 78377.9);

      // Verifikasi Ekstraksi RRR Rasio (1 : X)
      assert.equal(plan.targets[0].rMultiple, 1.66);
      assert.equal(plan.targets[1].rMultiple, 3.38);
    });

    it('Ticket 1 (#120): Mengurai format analisis SMC/ICT dengan format rasio 1:X dan rMultiple eksplisit tanpa distorsi', () => {
      const userSample = `
## 1. Multi-Timeframe Alignment
Struktur tren Bearish.

## 5. Trading Plan
| Parameter | Nilai |
| --- | --- |
| Bias | **Bearish** [INFERENSI] |
| Entry | **77640.0** (Limit order pasca-sweep BSL) |
| Alasan Entry | Menangkap aksi manipulasi stop run [FAKTA + INFERENSI] |
| Stop Loss | **77850.0** [INFERENSI] |
| Alasan SL | Di atas batas toleransi wick [FAKTA] |
| TP1 | **77050.0** [INFERENSI] |
| R multiple TP1 | **2.81R** (Dasar: Jarak) |
| Alasan TP1 | Pool Internal SSL [INFERENSI] |
| TP2 | **76250.0** [INFERENSI] |
| R multiple TP2 | **6.62R** (Dasar: Jarak) |
| Alasan TP2 | Pool External SSL [INFERENSI] |
| RRR aktual (TP1) | **1 : 2.81** |
| RRR aktual (TP2) | **1 : 6.62** |

## 6. Kesimpulan & Confidence Level
* **Probabilitas Setup:** **Medium Confidence**. Tren HTF mendukung penuh skenario pelemahan.
* **Skenario Invalidasi:** Setup dinyatakan batal jika candle 1H ditutup di atas level **77850.0**.
      `.trim();

      const plan = parseTradingPlan(userSample);

      assert.equal(plan.bias, 'bearish');
      assert.equal(plan.entry, 77640.0);
      assert.equal(plan.stopLoss, 77850.0);
      assert.equal(plan.riskAmount, 210.0);
      assert.equal(plan.targets.length, 2);
      assert.equal(plan.targets[0].price, 77050.0);
      assert.equal(plan.targets[0].rMultiple, 2.81);
      assert.equal(plan.targets[1].price, 76250.0);
      assert.equal(plan.targets[1].rMultiple, 6.62);
      assert.equal(plan.conclusion?.probability, 'Medium Confidence');
      assert.match(plan.conclusion?.invalidationScenario || '', /77850\.0/);
    });

    it('Bug Repro: Mengurai tabel Markdown bervalue multiline dengan baris kosong dan mencegah false context zone tanggal (10-30)', () => {
      const userText = `
## 1. Multi-Timeframe Alignment (HTF, MTF & LTF)
* **HTF Narrative:** Struktur 4H terkonfirmasi **Bearish** dengan sekuens *Lower High* di 81953.7 (10-29) dan *Lower Low* di 76270.0 (10-30).

---

## 5. Trading Plan

| Parameter | Nilai |
| --- | --- |
| Bias | Bearish |
| Entry | **78200.0** (Limit sell pada batas bawah 1H Bearish FVG setelah *liquidity run* atas resistansi lokal, terkonfirmasi penolakan di area pasokan) |
| Alasan Entry | Selaras dengan tren makro Bearish 4H [FAKTA]. Level 78200.0 adalah batas bawah 1H Bearish FVG (78200.0 – 78377.9) [FAKTA] dan gerbang masuk 4H Bearish FVG (78242.4 – 80549.9) [FAKTA], yang merupakan zona premium ideal untuk menyerap likuiditas beli ritel [INFERENSI] dan eksekusi mitigasi institusional [SPEKULASI].

 |
| Stop Loss | **78600.0** |
| Alasan SL | Ditempatkan di atas *Mean Threshold* (level 50% = 78577.2) dari 1H Bearish Order Block (78377.9 – 78776.5) [FAKTA]. Penutupan candle di atas *Mean Threshold* membatalkan validitas pertahanan institusional pada *order block* tersebut [INFERENSI].

 |
| TP1 | **77400.0** |
| R multiple TP1 | **2.0R** — Nilai $R = \\Vert{}78200.0 - 78600.0\\Vert{} = 400.0$ poin. Jarak ke TP1: $\\Vert{}78200.0 - 77400.0\\Vert{} = 800.0$ poin. $R\\text{ multiple} = 800.0 / 400.0 = 2.0R$. Angka ini didasarkan pada jarak menuju *liquidity pool* di bawah *Swing Low* 77458.4 [INFERENSI].

 |
| Alasan TP1 | Likuidasi Sell-Side Liquidity (SSL Pool 1) dari Stop Loss pembeli *breakout* di bawah *Swing Low* LTF 77458.4 [INFERENSI], tepat di atas 15m unmitigated Bullish OB (77462.2 – 77522.7) [FAKTA].

 |
| TP2 | **77000.0** |
| R multiple TP2 | **3.0R** — Jarak ke TP2: $\\Vert{}78200.0 - 77000.0\\Vert{} = 1200.0$ poin. $R\\text{ multiple} = 1200.0 / 400.0 = 3.0R$. Angka ini didasarkan pada jarak sapuan likuiditas penuh di bawah struktur *Higher Low* MTF 77060.0 [FAKTA + INFERENSI].

 |
| Alasan TP2 | Penyerapan Sell-Side Liquidity utama (SSL Pool 2) di bawah 1H *Swing Low* 77060.0 [FAKTA], sekaligus menjadi level invalidasi tren naik internal 1H [INFERENSI].

 |
| RRR aktual (TP1) | **1:2.0** |
| RRR aktual (TP2) | **1:3.0** |

---

## 6. Kesimpulan & Confidence Level
* **Skenario Invalidasi:**
* Setup terinvalidasi penuh jika terjadi penutupan candle 1H/4H secara meyakinkan (*candle body close*) di atas level 78776.5 (batas atas 1H Bearish OB & *Swing High* 10-30 06:00) [FAKTA].
      `.trim();

      const plan = parseTradingPlan(userText);

      // 1. Tesis / Alasan harus tercatat
      assert.ok(plan.reasons.entry, 'Tesis Alasan Entry harus tercatat');
      assert.match(plan.reasons.entry, /Selaras dengan tren makro Bearish 4H/);

      assert.ok(plan.reasons.stopLoss, 'Tesis Alasan SL harus tercatat');
      assert.match(plan.reasons.stopLoss, /Mean Threshold/);

      assert.ok(plan.reasons.tp1, 'Tesis Alasan TP1 harus tercatat');
      assert.match(plan.reasons.tp1, /Likuidasi Sell-Side Liquidity/);

      assert.ok(plan.reasons.tp2, 'Tesis Alasan TP2 harus tercatat');
      assert.match(plan.reasons.tp2, /Penyerapan Sell-Side Liquidity/);

      // 2. R multiple pada targets harus tercatat
      assert.equal(plan.targets[0].rMultiple, 2.0);
      assert.equal(plan.targets[1].rMultiple, 3.0);

      // 3. Tanggal (10-30 atau 10-29) tidak boleh dijadikan Context Zone
      const falseDateZone = plan.contextZones.find(
        (z) => (z.low === 10 && z.high === 30) || (z.low === 10 && z.high === 29)
      );
      assert.equal(falseDateZone, undefined, 'Format tanggal 10-30 tidak boleh dijadikan Context Zone');

      // 4. Label Context Zone harus bersih dan spesifik (bukan "Context Zone" generik jika ada nama institusional)
      const htfFvg = plan.contextZones.find((z) => z.low === 78242.4 && z.high === 80549.9);
      assert.ok(htfFvg, 'Zona 4H Bearish FVG harus terdeteksi');
      assert.equal(htfFvg?.label, '4H Bearish FVG');

      const mtfOb = plan.contextZones.find((z) => z.low === 78377.9 && z.high === 78776.5);
      assert.ok(mtfOb, 'Zona 1H Bearish Order Block harus terdeteksi');
      assert.equal(mtfOb?.label, '1H Bearish Order Block');

      const ltfOb = plan.contextZones.find((z) => z.low === 77462.2 && z.high === 77522.7);
      assert.ok(ltfOb, 'Zona 15m unmitigated Bullish OB harus terdeteksi');
      assert.equal(ltfOb?.label, '15m unmitigated Bullish OB');
    });
  });
});
