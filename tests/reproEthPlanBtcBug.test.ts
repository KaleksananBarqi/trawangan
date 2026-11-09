import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTradingPlan, extractFallbackSymbol } from '../src/lib/services/planParserService';

describe('Bug Repro & Regression: Deteksi Simbol Rencana Perdagangan (Korelasi Benchmark Guard)', () => {
  const userPlanText = `## 1. Multi-Timeframe Alignment (HTF, MTF & LTF)

* **Hierarki & Resolusi Konflik:** Berdasarkan prinsip \`HTF > MTF > LTF\`, arah ekspansi likuiditas utama ditentukan oleh HTF yang berstatus Bearish, sementara dealing range MTF memetakan zona ekuilibrium makro, dan LTF mengonfirmasi perpindahan momentum struktural untuk trigger eksekusi [INFERENSI].
* **HTF Narrative:** Struktur 1H berada dalam tren Bearish mekanis dengan pembentukan swing struktural menurun dari Lower High (LH) 2434.00, 2268.55, 2253.43 hingga LH terbaru di 2159.25 [FAKTA]. Seluruh swing low perantara telah berstatus \`broken\` dan menyisakan swing low ekstrem di 2050.32 berstatus \`untested\` [FAKTA]. *Draw on Liquidity* (DOL) makro adalah likuiditas sisi jual (Sell-Side Liquidity / SSL) di bawah Ref LOW 2050.32 [INFERENSI]. Korelasi benchmark BTCUSDT yang berstatus Bearish di HTF (1H) dan MTF (15m) serta funding rate negatif (-0.0042%) memperkuat bias ekspansi distribusi [FAKTA + INFERENSI].
* **MTF Alignment:** Dealing Range MTF (15m) berada pada rentang 2050.32–2159.25 dengan EQ (50%) di 2104.78 [FAKTA]. Posisi harga saat ini (2092.34) berada di zona DISCOUNT dealing range MTF [FAKTA]. Meskipun secara mekanis range MTF berstatus Ranging/Mixed, candle 15m penutupan 07:00 UTC mencetak displacement impulsif ber-volume tinggi (200.106 lot) yang menembus swing low 2126.08 dan 2116.02 menjadi \`broken\` [FAKTA]. Hal ini mengonfirmasi kelanjutan displacement searah bias HTF menuju ekstrim bawah [INFERENSI].
* **LTF Context:** Struktur 5m berstatus Bearish dengan swing low 2101.02 yang tertembus (\`broken\`) dan mencetak Lower Low baru di 2081.41 pada 07:10 UTC [FAKTA]. Retracement dari 2081.41 menuju 2100.53 (07:20 UTC) dan 2098.26 (07:35 UTC) menguji batas Premium dari dealing range LTF (2081.41–2116.20, EQ 2098.80) [FAKTA + INFERENSI]. Rejection yang terjadi pada candle 07:35 mengonfirmasi bahwa pullback ini merupakan mitigasi ke dalam Fair Value Gap (FVG) LTF, bukan Market Structure Shift (MSS) pembalikan [INFERENSI].

---

## 2. Pemetaan Likuiditas Ritel & Inducement (IDM)

* **2a. Retail Liquidity Proxy (Heuristik Mekanis):**
* **Retail Support / Double Bottom Proxy:** Area swing low 2081.41–2082.16 yang terbentuk pada candle 07:10 dan 07:25 UTC merupakan zona tempat pembeli ritel menaruh buy-stop / breakout orders dan Stop Loss bagi pembeli agresif [INFERENSI].
* **Retail Resistance / Trendline Liquidity:** Puncak-puncak internal di 2100.53 (07:20 UTC) dan 2098.26 (07:35 UTC) menjadi proxy penempatan Stop Loss bagi penjual ritel *early breakout* yang mengejar momentum turun [SPEKULASI].
* **Round Number Psychological Pools:** Level angka bulat 2100.00 dan 2050.00 menjadi konsentrasi resting orders ritel [SPEKULASI].

* **2b. Inducement / Sweep Zone (IDM — Internal Liquidity):**
* High internal pada 2098.26–2100.53 bertindak sebagai Inducement (IDM) mikro [INFERENSI].
* Up-move pada candle 07:35 UTC (High 2098.26) telah menyapu likuiditas buy-stop internal ritel yang masuk saat konsolidasi 07:25–07:30 UTC sebelum kembali tertekan turun [INFERENSI + SPEKULASI].

---

## 3. Draw on Liquidity (DOL) = Target Take Profit

1. **DOL 1 (Internal Liquidity — TP1): 2081.41 [FAKTA]**
* Merupakan level Recent Swing Low LTF (11-09 07:10 UTC, status \`untested\`) [FAKTA].
* Menampung klaster Sell-Side Liquidity (SSL) ritel yang terakumulasi pasca pantulan London open [INFERENSI].

2. **DOL 2 (External Liquidity — TP2 / Main DOL): 2050.32 [FAKTA]**
* Merupakan level Recent & Extreme Ref LOW pada timeframe HTF (1H) dan MTF (15m) (11-08 21:00 UTC, status \`untested\`) [FAKTA].
* Bertindak sebagai magnet likuiditas utama makro tempat *Smart Money* menyelesaikan siklus distribusi dealing range HTF [INFERENSI + SPEKULASI].

---

## 4. Mode Eksekusi, Logika Kontra-Ritel & Status Konfirmasi Entry

* **Mode Eksekusi Terpilih: Mode Continuation (Trend Kuat)**
* *Justifikasi:* HTF berstatus Bearish, MTF baru saja mencetak displacement penembusan swing low struktural dengan volume spike (x2.40 pada MTF candle 07:00), dan struktur LTF 5m telah mencetak Lower Low baru (\`broken\` di 2101.02 menuju 2081.41) [FAKTA]. Terdapat Unfilled Bearish FVG LTF pada 2093.30–2101.20 yang berjarak ≤ 1.5x ATR LTF dari harga saat ini [FAKTA].

* **Logika Kontra-Ritel:** Ritel cenderung melakukan panic-sell di lembah (2081–2085) atau mencoba menangkap pisau jatuh (buying support) di area diskon MTF. Smart Money memanfaatkan retest ke area FVG / EQ LTF untuk memfasilitasi posisi jual institusional kepada liquidity provider ritel sebelum ekspansi lanjutan menuju 2050.32 [SPEKULASI].
* **Status Setup:**
* **Tipe A — \`ACTIVE / TRIGGERED\` [FAKTA]:** Pada candle tertutup 07:35 UTC, harga bergerak naik hingga High 2098.26, menyentuh Proximal Edge (2093.30) dan 50% Consequent Encroachment (2097.25) dari Bearish FVG 5m, lalu ditutup di 2097.54 [FAKTA].
* **Tipe B — \`PENDING (Limit Order Guard)\` [INFERENSI]:** Bagi eksekusi baru pada current price 2092.34, order sell limit ditempatkan pada Proximal Edge FVG (2093.30 ≥ Current Price) dan Consequent Encroachment (2097.25) untuk menangkap sisa mitigasi FVG.

---

## 5. Trading Plan (Dual-Entry & Blended Reference)

| Parameter | Nilai |
| --- | --- |
| Bias | Bearish |
| Status Setup | ACTIVE (Triggered) / PENDING (Limit Retest) — Mode Continuation |
| Entry 1 (Aggressive) | 2093.30 |
| Entry 2 (Moderate) | 2097.25 |
| Entry (Blended) | 2095.67 |
| Alasan Entry | Entry 1 di Proximal Edge Bearish FVG LTF (07:15 UTC) memenuhi syarat guard limit order ≥ Current price 2092.34 [FAKTA]. Entry 2 di Consequent Encroachment (ce 50%) FVG 2093.30–2101.20 [FAKTA]. Setup telah terpicu pada wick candle 07:35 UTC (High 2098.26) yang merejeksi area premium LTF [INFERENSI]. |
| Stop Loss | 2102.50 |
| Jarak Risiko (1R) | |2095.67 − 2102.50| = 6.83 poin (0.326% dari Blended Entry) → Pos Size = Risk($) / 0.326% |
| Alasan SL | Ditempatkan di atas Distal Edge Bearish FVG LTF (2101.20) ditambah buffer spread/taker fee sebesar 1.30 poin (~0.062%). Penutupan candle di atas 2101.20 membatalkan validitas FVG institusional [INFERENSI]. |
| TP1 | 2081.41 |
| R multiple TP1 | 2.09R (Blended) / 1.29R (Entry 1) |
| Alasan TP1 | Sapuan likuiditas Recent Swing Low LTF (11-09 07:10 UTC). Dasar R: jarak 14.26 poin dari Blended Entry (1.43x ATR LTF 9.96) [FAKTA + INFERENSI]. |
| TP2 | 2050.32 |
| R multiple TP2 | 6.64R (Blended) |
| Alasan TP2 | Sapuan likuiditas makro HTF/MTF Ref LOW (11-08 21:00 UTC). Dasar R: jarak 45.35 poin dari Blended Entry (4.55x ATR LTF / 1.43x ATR HTF) [FAKTA + INFERENSI]. |

*Catatan Kalkulasi RRR:*

* **Entry 1 ke TP1:** $(2093.30 - 2081.41) / (2102.50 - 2093.30) = 11.89 / 9.20 = 1.29\text{R}$ (memenuhi syarat minimum $\ge 1:1.2$).
* **Blended Entry ke TP1:** $(2095.67 - 2081.41) / 6.83 = 14.26 / 6.83 = 2.09\text{R}$ (memenuhi syarat minimum $\ge 1:1.5$).
* **Blended Entry ke TP2:** $(2095.67 - 2050.32) / 6.83 = 45.35 / 6.83 = 6.64\text{R}$ (memenuhi konfluensi $\ge 1:2$).

---

## 6. Kesimpulan, Rubrik Confidence & Invalidasi

* **Skor Konfluensi (4/5):**
* (+1) HTF DOL searah Bearish menuju SSL 2050.32 [FAKTA + INFERENSI].
* (+0) Posisi harga berada di zona DISCOUNT dealing range MTF (kurang optimal untuk short makro, namun momentum searah) [FAKTA].
* (+1) Mode Continuation tervalidasi dengan alignment LTF Bearish, BOS 2101.02 broken, dan POI LTF sangat dekat (0.96 poin vs ambang $\le 1.5\text{x}$ ATR = 14.94) [FAKTA].
* (+1) Konfluensi London Open Killzone (07:00–10:00 UTC) disertai volume spike breakdown MTF x2.40 dan rejection FVG Consequent Encroachment 2097.25 [FAKTA + INFERENSI].
* (+1) Rasio Risk-to-Reward Blended ke TP2 sebesar 6.64R ($\ge 1:2$) dan TP1 dari Entry 1 sebesar 1.29R ($\ge 1:1.2$) [FAKTA].

* **Confidence Level:** **High (4/5)**.
* **Invalidasi & Skenario Flip (1 Kalimat):** Setup short batal jika candle 5m ditutup di atas 2102.50, dan bias berbalik (flip bullish) hanya jika terbentuk penembusan candle close di atas Swing High 2116.20 yang disertai volume konfirmasi sebagai Market Structure Shift (MSS).`;

  it('seharusnya TIDAK salah mendeteksi BTCUSDT ketika simbol hanya disebut sebagai benchmark korelasi', () => {
    const plan = parseTradingPlan(userPlanText);
    // Simbol harus undefined agar otomatis mengaitkan dengan activeSymbol (ETHUSDT)
    assert.equal(plan.symbol, undefined, 'Simbol harusnya undefined jika hanya ada benchmark korelasi!');
  });

  it('mendeteksi simbol utama jika dicantumkan pada judul dokumen meskipun ada korelasi benchmark', () => {
    const textWithTitle = `# Analisis Teknikal ETHUSDT 15m\n${userPlanText}`;
    const plan = parseTradingPlan(textWithTitle);
    assert.equal(plan.symbol, 'ETHUSDT');
  });

  it('mendeteksi simbol utama jika dicantumkan pada tabel parameter', () => {
    const textWithTablePair = userPlanText.replace(
      '| Bias | Bearish |',
      '| Pair | ETHUSDT |\n| Bias | Bearish |'
    );
    const plan = parseTradingPlan(textWithTablePair);
    assert.equal(plan.symbol, 'ETHUSDT');
  });

  it('mengabaikan simbol yang disebut dengan frase "sebagai benchmark" atau "relative to"', () => {
    const text1 = 'Pergerakan harga relatif terhadap BTCUSDT menunjukkan kelemahan.';
    assert.equal(extractFallbackSymbol?.(text1), undefined);

    const text2 = 'Kami menggunakan BTCUSDT sebagai benchmark pasar.';
    assert.equal(extractFallbackSymbol?.(text2), undefined);
  });
});
