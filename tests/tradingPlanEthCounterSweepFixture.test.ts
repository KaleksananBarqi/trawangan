import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseTradingPlan, inferZonePolarity } from '../src/lib/services/planParserService';

const ETH_COUNTER_SWEEP_PLAN = `### 1. Multi-Timeframe Alignment (HTF, MTF & LTF)

* **HTF Narrative (4H):**
* **[FAKTA]:** Struktur mekanis 4H berstatus \`Ranging/Mixed\` dengan Dealing Range Recent \`2236.06–2317.59\` (EQ 50%: \`2276.82\`). Harga saat ini (\`2292.21\`) berada di zona **PREMIUM**. Pada candle \`11-04 00:00\`, harga menyapu (\`wick_sweep\`) Ref LOW \`2236.06\` hingga mencetak titik terendah \`2225.01\` lalu ditutup kembali di atasnya pada \`2248.43\` dengan lonjakan volume (\`859,015\`, spike \`x2.14\`). Harga saat ini berada di dalam \`BEAR_OB\` 4H (\`2281.62–2303.50\`, MT: \`2292.56\`) dan zona \`BEAR FVG\` 4H (\`2256.50–2323.01\`).
* **[INFERENSI]:** Meskipun MTF terklasifikasi Bearish, terjadinya *Sell-Side Liquidity (SSL) Sweep* yang agresif di bawah \`2236.06\` disertai penolakan volume tinggi pada 4H mengindikasikan akumulasi pasca-manipulasi (*Judas Swing* / *Turtle Soup* bawah). Dengan tersapunya likuiditas sisi bawah, *Draw on Liquidity* (DOL) mayor berikutnya memiliki probabilitas lebih tinggi (Medium-High confidence) untuk berbalik mengincar *Buy-Side Liquidity* (BSL) yang belum tersentuh (\`untested\`) di \`2308.52\` dan Ref HIGH 4H di \`2317.59\`.


* **MTF Alignment (1H):**
* **[FAKTA]:** Klasifikasi mekanis 1H adalah \`Bearish\` dengan Dealing Range \`2225.01–2298.78\` (EQ: \`2261.90\`), menempatkan harga saat ini (\`2292.21\`) di zona **PREMIUM**. Namun, candle 1H \`11-04 05:00\` melonjak hingga \`2307.00\` (melampaui Ref HIGH 1H \`2298.78\`) dan ditutup pada \`2292.31\` dengan volume spike \`x1.87\` (\`285,221\`). Pergerakan impulsif ini meninggalkan \`BULL FVG\` 1H yang belum terisi (\`2249.77–2275.99\`) dan \`BULL_OB\` 1H \`unmitigated\` (\`2242.14–2270.40\`, MT: \`2256.27\`).
* **[INFERENSI]:** Klasifikasi mekanis 1H belum memperbarui swing high \`2307.00\`, namun secara perilaku harga, sapuan di bawah \`2236.06\` yang langsung dibalas kenaikan vertikal ke \`2307.00\` menandakan pergeseran momentum (*displacement* bullish). Karena harga saat ini berada di zona **Premium** (\`2292.21\` > EQ \`2261.90\`), eksekusi Buy di harga pasar saat ini sangat berisiko; skenario optimal adalah menunggu *retracement* ke zona **Discount** MTF (di bawah \`2261.90\` atau ke batas atas \`BULL FVG\` 1H di \`2275.99\`).


* **LTF Context (15m):**
* **[FAKTA]:** Struktur 15m adalah \`Ranging/Mixed\`. Setelah mencetak LL di \`2225.01\` (\`11-04 03:00\`), harga menembus (\`broken\`) LH \`2277.88\` dan HH \`2286.00\`, serta menyentuh \`2307.00\` pada candle \`11-04 05:45\` (close \`2292.31\`, volume spike \`x1.89\`). Terdapat tiga \`BULL FVG\` 15m \`unfilled\`: \`2284.85–2292.30\`, \`2268.19–2275.99\`, dan \`2249.77–2256.50\`, serta tiga \`BULL_OB\` 15m \`unmitigated\`: \`2278.26–2284.85\`, \`2256.50–2266.80\`, dan \`2239.11–2249.29\`.
* **[INFERENSI]:** LTF 15m telah mengonfirmasi *Market Structure Shift* (MSS) bullish melalui penembusan \`2277.88\` dan \`2286.00\`. Kenaikan di akhir sesi Asia ini terlalu curam dan meninggalkan banyak ketidakseimbangan (*imbalance*), sehingga struktur LTF terdekat di \`2278.26–2284.85\` berpotensi tinggi hanya menjadi **Inducement (IDM)** sebelum harga melakukan *pullback* yang lebih sehat ke POI Discount.



---

### 2. Pemetaan Likuiditas Ritel & Inducement (IDM)

* **2a. Retail Liquidity Proxy (Heuristik Mekanis):**
* **[INFERENSI]:** *Breakout buyers* yang mengejar kenaikan saat harga menembus \`2286.00\` dan \`2298.78\` kemungkinan besar menempatkan *trailing Stop Loss* (SSL) tepat di bawah *low* candle impulsif 15m terakhir (\`2278.67\` dan \`2275.99\`) serta di bawah \`BULL_OB\` 15m terdekat (\`2278.26\`).
* **[SPEKULASI]:** *Counter-trend sellers* ritel yang melakukan *short* karena melihat penolakan *wick* di \`2307.00\` (dekat angka bulat psikologis \`2300.00\`) kemungkinan menaruh Stop Loss (BSL) tepat di atas \`2307.00\` dan swing high \`2308.52\`.


* **2b. Inducement / Sweep Zone (IDM — Internal Liquidity):**
* **[INFERENSI]:** Klaster likuiditas internal terdekat yang berfungsi sebagai **Inducement (IDM)** untuk skenario Bullish adalah zona **\`2275.99–2278.67\`** (batas bawah candle 1H \`05:00\` di \`2275.99\` dan \`BULL_OB\` 15m atas di \`2278.26–2284.85\`). Sapuan (*sweep*) ke bawah \`2275.99\` akan memicu Stop Loss *early buyers* sekaligus membawa harga masuk ke dalam irisan \`BULL FVG\` 1H (\`2249.77–2275.99\`) dan \`BULL FVG\` 15m (\`2268.19–2275.99\`).



---

### 3. Draw on Liquidity (DOL) = Target Take Profit

Berdasarkan prioritas likuiditas eksternal di sisi atas (*Buy-Side Liquidity*):

1. **Target TP1 — \`2308.52\` [FAKTA + INFERENSI]:**
* **[FAKTA]:** Merupakan Extreme Ref HIGH pada LTF 15m (\`11-03 13:30\`) dan Swing High HH pada MTF 1H (\`11-03 13:00\`) yang berstatus \`untested\`, berada tepat di atas *high* terbaru \`2307.00\`.
* **[INFERENSI]:** Kenaikan ke \`2307.00\` yang berhenti hanya \`1.52\` poin di bawah \`2308.52\` menciptakan *Relative Equal Highs* (REH) mekanis (\`2307.00\` vs \`2308.52\`) yang menjadi magnet likuiditas utama (*high-probability BSL pool*).


2. **Target TP2 — \`2317.59\` [FAKTA + INFERENSI]:**
* **[FAKTA]:** Merupakan Recent/Nearest Ref HIGH pada HTF 4H (\`11-02 00:00\`) dan Extreme Ref HIGH pada MTF 1H (\`11-02 03:00\`) yang berstatus \`untested\`, serta berada di bagian atas \`BEAR FVG\` 4H (\`2256.50–2323.01\`) dan \`BEAR FVG\` 1H (\`2293.87–2325.76\`).
* **[INFERENSI]:** Menjadi target penyelesaian *Dealing Range* 4H (\`2236.06–2317.59\`) setelah sisi bawah (\`2236.06\`) selesai disapu.



---

### 4. Logika Kontra-Ritel & Status Konfirmasi Entry

* **Status Setup:** **Tipe B — \`PENDING / CONDITIONAL\` \`[INFERENSI]**\`
* **Logika Eksekusi & Kontra-Ritel:**
* **[FAKTA]:** Harga saat ini (\`2292.21\`) berada di zona Premium baik pada 4H (EQ \`2276.82\`) maupun 1H (EQ \`2261.90\`), tepat setelah lonjakan vertikal dari \`2225.01\` ke \`2307.00\`.
* **[INFERENSI]:** Membeli di \`2292.21\` melanggar disiplin *Dealing Range* (membeli di Premium tepat di bawah *resistance* \`BEAR_OB\` 4H \`2292.56\`). Skenario kontra-ritel membutuhkan harga untuk turun terlebih dahulu menyapu **IDM \`2275.99–2278.67**\` (mematikan posisi *late breakout buyers*), lalu memitigasi zona konfluensi **\`BULL FVG\` 15m (\`2268.19–2275.99\`)** dan **\`BULL_OB\` 15m (\`2256.50–2266.80\`, MT: \`2261.65\`)** yang berhimpitan dengan **EQ 50% MTF (\`2261.90\`)** serta **\`BULL FVG\` 1H (\`2249.77–2275.99\`)**.
* **Syarat Trigger Wajib:** Tunggu harga turun menembus \`2275.99\` (sweep IDM) dan menyentuh area \`2261.90–2268.19\`, diikuti pembentukan *wick rejection* atau penutupan candle 15m kembali di atas \`2268.19\` sebagai konfirmasi *re-accumulation* sebelum eksekusi Long.



---

### 5. Trading Plan

**Definisi & Kalkulasi R:**

* \`Entry\` = \`2266.80\`
* \`Stop Loss\` = \`2247.50\`
* \`1R\` = \`|2266.80 − 2247.50| = 19.30 poin\` (\`0.85%\` dari harga Entry). Dasar pemilihan 1R: jarak struktural dari batas atas \`BULL_OB\` 15m (\`2266.80\`) ke bawah batas bawah \`BULL FVG\` 15m/1H (\`2249.77\`), setara dengan \`1.42x ATR(14) LTF\` (\`13.60\`) atau \`1.03x ATR(14) MTF\` (\`18.82\`), memberikan ruang bernapas di luar *noise* volatilitas normal.

| Parameter | Nilai |
| --- | --- |
| Bias | Bullish (Counter-Sweep Retracement) |
| Status Setup | PENDING (Conditional) |
| Entry | **2266.80** (Menunggu sweep di bawah IDM \`2275.99\` masuk ke zona \`2261.65–2268.19\` + konfirmasi candle 15m close kembali di atas \`2266.80\`) |
| Alasan Entry | **[FAKTA]:** Level \`2266.80\` adalah batas atas \`BULL_OB\` 15m \`unmitigated\` (\`2256.50–2266.80\`), berada tepat di bawah \`BULL FVG\` 15m (\`2268.19–2275.99\`) dan di dalam \`BULL FVG\` 1H (\`2249.77–2275.99\`), serta berada di zona Discount HTF (< \`2276.82\`). **[INFERENSI]:** Entry di level ini memastikan likuiditas IDM di \`2275.99–2278.26\` telah disapu lebih dulu dan memberikan harga beli yang dekat dengan Equilibrium 1H (\`2261.90\`). |
| Stop Loss | **2247.50** |
| Jarak Risiko (1R) | \`19.30\` poin (\`0.85%\` dari Entry) → \`Pos Size = Risk($) / 0.0085\` |
| Alasan SL | **[FAKTA]:** Ditempatkan di bawah batas bawah \`BULL FVG\` 1H & 15m (\`2249.77\`) serta di bawah batas atas \`BULL_OB\` 15m ketiga (\`2249.29\`). **[INFERENSI]:** Jika harga menembus dan menutup di bawah \`2249.77\`, maka seluruh *displacement gap* pada 1H gagal bertahan dan struktur *retracement* dinyatakan tidak valid. Diberi buffer \`2.27\` poin (\`~0.10%\`) di bawah \`2249.77\` untuk mengantisipasi *spread* dan *taker fee*. |
| TP1 | **2308.52** |
| R multiple TP1 | **2.16R** (\` |
| Alasan TP1 | **[FAKTA]:** Merupakan Swing High HH 1H (\`11-03 13:00\`) dan Extreme Ref HIGH 15m (\`11-03 13:30\`) di \`2308.52\` yang berstatus \`untested\`. **[INFERENSI]:** Pool likuiditas BSL terdekat yang berpasangan dengan *high* terbaru \`2307.00\` (membentuk *Relative Equal Highs* sebagai magnet target pertama). |
| TP2 | **2317.59** |
| R multiple TP2 | **2.63R** (\` |
| Alasan TP2 | **[FAKTA]:** Merupakan Recent/Nearest Ref HIGH 4H (\`11-02 00:00\`) dan Extreme Ref HIGH 1H (\`11-02 03:00\`) yang berstatus \`untested\`, sekaligus mengisi bagian atas \`BEAR FVG\` 4H (\`2256.50–2323.01\`). **[INFERENSI]:** Target likuiditas eksternal utama (BSL) dari siklus *range* 4H pasca terjadinya sapuan di sisi bawah (\`2236.06\`). |

---

### 6. Kesimpulan, Rubrik Confidence & Invalidasi

* **Skor Konfluensi (4/5 Poin):**
1. **(+1) HTF DOL searah:** Pasca \`wick_sweep\` di Ref LOW 4H \`2236.06\` dengan volume spike \`x2.14\`, DOL 4H mengarah ke Ref HIGH \`2317.59\` (\`untested\`).
2. **(+0) Harga di zona Premium/Discount MTF yang tepat thd EQ 50%:** Harga saat ini (\`2292.21\`) masih berada di zona **Premium** terhadap EQ 1H (\`2261.90\`) dan 4H (\`2276.82\`), sehingga wajib menunggu *pullback* (belum ideal untuk *instant execution*).
3. **(+1) Sweep Inducement (IDM) jelas:** Sapuan mayor pada SSL \`2236.06\` telah terjadi (\`2225.01\`), dan zona IDM internal LTF terpetakan jelas di \`2275.99–2278.67\` tepat di atas POI Entry.
4. **(+1) Konfluensi POI LTF (FVG/OB/MSS) & Volume:** MSS 15m telah terkonfirmasi (\`broken\` \`2286.00\`) dengan volume spike di ketiga timeframe (\`4H x2.14\`, \`1H x1.87\`, \`15m x1.89\`), didukung irisan \`BULL_OB\` 15m (\`2256.50–2266.80\`) dan \`BULL FVG\` 1H (\`2249.77–2275.99\`).
5. **(+1) RRR TP1 ≥ 1:2:** RRR pada TP1 mencapai **1 : 2.16** (\`2.16R\`) dan TP2 mencapai **1 : 2.63** (\`2.63R\`).


* **Confidence Level:** **High (4/5 poin)** — dengan catatan disiplin menunggu harga turun ke zona Entry (\`2266.80\`) dan tidak melakukan *FOMO buy* di harga Premium saat ini (\`2292.21\`).
* **Invalidasi & Skenario Flip (1 Kalimat):** Setup Bullish ini batal sepenuhnya jika candle 1H ditutup di bawah **\`2247.50\`** (menembus \`BULL FVG\` 1H \`2249.77\`), yang sekaligus memicu *flip bias* menjadi **Bearish** dengan skenario *short* saat *retest* untuk mengincar ulang likuiditas *Sell-Side* di Extreme Low **\`2225.01\`** dan **\`2172.85\`**.
`;

describe('Regression Fixture: ETH Counter-Sweep Trading Plan Ingestion', () => {
  it('mengurai seluruh parameter inti, kesimpulan, status, dan zona POI dengan presisi', () => {
    const plan = parseTradingPlan(ETH_COUNTER_SWEEP_PLAN, { tickSize: 0.01 });

    // 1. Parameter Inti
    assert.equal(plan.bias, 'bullish');
    assert.equal(plan.entry, 2266.8);
    assert.equal(plan.stopLoss, 2247.5);
    assert.equal(plan.riskAmount, 19.3);
    assert.equal(plan.targets.length, 2);
    assert.equal(plan.targets[0].price, 2308.52);
    assert.equal(plan.targets[0].rMultiple, 2.16);
    assert.equal(plan.targets[1].price, 2317.59);
    assert.equal(plan.targets[1].rMultiple, 2.63);

    // 2. Setup Status
    assert.equal(plan.setupStatus, 'PENDING (Conditional)');

    // 3. Kesimpulan & Definisi
    assert.equal(plan.conclusion?.probability, 'High (4/5 poin)');
    assert.ok(plan.conclusion?.probabilityNotes?.includes('dengan catatan disiplin menunggu harga turun'));
    assert.ok(plan.conclusion?.invalidationScenario?.includes('Setup Bullish ini batal sepenuhnya jika candle 1H ditutup di bawah'));
    assert.ok(plan.definition);

    // 4. Pembersihan Markdown pada reasons (tanpa sisa ** atau backtick berlebihan)
    assert.ok(!plan.reasons.entry.includes('**'));
    assert.ok(!plan.reasons.entry.includes('`'));
    assert.ok(plan.reasons.entry.includes('[FAKTA]: Level 2266.80 adalah batas atas'));

    // 5. Context Zones (POI-only: 11 POI + 1 IDM = 12 zona)
    assert.equal(plan.contextZones.length, 12);

    // Pastikan tidak ada rentang Dealing Range atau trigger area yang lolos
    const forbiddenRanges = [
      { low: 2236.06, high: 2317.59 }, // Dealing Range 4H
      { low: 2225.01, high: 2298.78 }, // Dealing Range 1H
      { low: 2261.9, high: 2268.19 },  // trigger zone
      { low: 2261.65, high: 2268.19 }  // mitigation zone text
    ];
    for (const fr of forbiddenRanges) {
      const match = plan.contextZones.find(
        (z) => Math.abs(z.low - fr.low) < 0.01 && Math.abs(z.high - fr.high) < 0.01
      );
      assert.equal(match, undefined, `Rentang ${fr.low}-${fr.high} tidak boleh lolos sebagai Context Zone`);
    }

    // Pastikan 12 zona institusional terdeteksi dengan polaritas dan rentang yang benar
    const expectedZones = [
      { labelPrefix: '4H OB', low: 2281.62, high: 2303.5, polarity: 'bear' },
      { labelPrefix: '4H FVG', low: 2256.5, high: 2323.01, polarity: 'bear' },
      { labelPrefix: '1H FVG', low: 2249.77, high: 2275.99, polarity: 'bull' },
      { labelPrefix: '1H OB', low: 2242.14, high: 2270.4, polarity: 'bull' },
      { labelPrefix: '15m FVG', low: 2284.85, high: 2292.3, polarity: 'bull' },
      { labelPrefix: '15m FVG', low: 2268.19, high: 2275.99, polarity: 'bull' },
      { labelPrefix: '15m FVG', low: 2249.77, high: 2256.5, polarity: 'bull' },
      { labelPrefix: '15m OB', low: 2278.26, high: 2284.85, polarity: 'bull' },
      { labelPrefix: '15m OB', low: 2256.5, high: 2266.8, polarity: 'bull' },
      { labelPrefix: '15m OB', low: 2239.11, high: 2249.29, polarity: 'bull' },
      { labelPrefix: 'IDM', low: 2275.99, high: 2278.67, polarity: 'neutral' },
      { labelPrefix: '1H FVG', low: 2293.87, high: 2325.76, polarity: 'bear' }
    ];

    for (const ez of expectedZones) {
      const found = plan.contextZones.find(
        (z) => Math.abs(z.low - ez.low) < 0.01 && Math.abs(z.high - ez.high) < 0.01
      );
      assert.ok(found, `Zona ${ez.labelPrefix} (${ez.low}-${ez.high}) harus terdeteksi`);
      assert.equal(found?.polarity, ez.polarity);
      assert.ok(found?.label.includes(ez.labelPrefix));
    }
  });
});
