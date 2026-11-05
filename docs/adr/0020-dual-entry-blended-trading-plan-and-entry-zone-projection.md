# 0020 - Dual-Entry, Blended Trading Plan Ingestion, and Entry Zone Projection

## Konteks
Dengan diadopsinya skema Anti-Front-Run pada prompt SMC v2 ([[ADR-0003 - Anti-Front-Run Dual-Entry and POI Proximity Filter]]), rencana perdagangan yang dihasilkan tidak lagi hanya memiliki satu titik harga masuk statis, melainkan memperkenalkan dua tingkat eksekusi:
1. `Entry 1 (Aggressive)`: Bertujuan menangkap pergerakan pada *Proximal Edge* POI LTF dengan *Front-Run Buffer* `0.10x ATR(14) LTF` (bobot 40% alokasi posisi).
2. `Entry 2 (Moderate)`: Bertujuan menangkap pemenuhan order pada level 50% *Consequent Encroachment* (ce FVG), 50% *Mean Threshold* (mt OB), atau area pasca-sapuan likuiditas IDM (bobot 60% alokasi posisi).
3. `Entry (Blended)`: Harga rata-rata tertimbang (`0.4×E1 + 0.6×E2`) yang menjadi jangkar matematika unit risiko 1R dan rasio RRR multi-target.

Sebelumnya, mesin parser rencana deterministik (`planParserService.ts`) mengabaikan baris `Entry 1` dan `Entry 2` dan hanya mengekstrak harga `Entry`, serta tidak memproyeksikan rentang zona masuk ke kanvas grafik. Selain itu, alert harga yang terpasang hanya mengawasi satu titik harga blended dan kartu tesis mengabaikan informasi bobot dan skor konfluensi.

## Keputusan
1. **Dukungan Skema Dual-Entry & Parsing Formula Blended**:
   - Memperluas interface `ParsedTradingPlan` dengan `entries: PlanEntryLevel[]`, `riskPercent: number`, dan `confluenceScore: { score, max }`.
   - Mengurai baris `Entry 1` (Agresif) dan `Entry 2` (Moderat) beserta bobot alokasinya (misal 40% dan 60%) dari teks atau formula baris `Entry`.
   - Jika harga `Entry` utama tidak dicantumkan, mesin parser menghitung harga *Blended Entry* secara otomatis berdasarkan bobot tertimbang.
   - Mengurai R-multiple bertingkat multi-acuan (`rMultipleByEntry`, misal `2.68R Blended / 1.92R E1`).

2. **Proyeksi Kanvas Kotak Arsiran Entry Zone**:
   - Mempertahankan kotak posisi bertingkat (*Staged Position Boxes*) berbasis *Blended Entry* agar koordinat RRR dan target profit tetap presisi.
   - Menambahkan kotak arsiran transparan (*Entry Zone Box*) di antara `min(E1, E2)` dan `max(E1, E2)` dengan warna palet yang selaras dengan bias posisi (`ENTRY_ZONE_STYLES.bull` atau `.bear`).
   - Kotak arsiran diikat secara siklus hidup ke dalam `planId` dan transaksi undo atomik (`Ctrl+Z`).

3. **Plan-Linked Auto-Alerts untuk Seluruh Tingkat Entri**:
   - `alertService.addPlanAlerts` membuat sinyal batas harga untuk:
     - Titik Blended Entry (`planRole: 'entry'`).
     - Level Entry 1 Agresif (`planRole: 'e1'`).
     - Level Entry 2 Moderat (`planRole: 'e2'`).
   - Seluruh alert entry, stop loss, dan target profit tersinkronisasi dan ikut dibersihkan saat rencana dihapus dari grafik.

4. **Integrasi UI & Snapshot**:
   - **Floating Thesis Card**: Menampilkan lencana skor konfluensi setup (`Skor 4/5`), pil level E1 & E2 beserta bobot dan harga, dan badge persentase risiko (`1.20%`).
   - **Import Plan Modal**: Menampilkan *live preview* kartu mini E1 & E2, status pasar yang mengevaluasi apakah harga sedang berada di dalam Entry Zone, dan rincian RRR ganda.
   - **Chart Snapshot Engine**: Menyertakan pil level E1 & E2 serta lencana skor konfluensi pada kartu tesis kanvas snapshot ultra-HD.

5. **Pembersihan False Positive Parser**:
   - Membatasi pencocokan kata kunci `Definisi` agar tidak lagi salah menangkap kata turunan seperti `"terdefinisi jelas"` pada daftar skor konfluensi.
   - Memperkuat sanitasi Markdown miring agar tidak memotong simbol konstanta bergaris bawah seperti `BULL_OB` dan `BEAR_OB`.
   - Menolak ekstraksi zona konteks fiktif yang bersumber dari narasi pergerakan harga ("turun ke") atau bagian kesimpulan/invalidasi.

## Konsekuensi
- Rencana perdagangan dari prompt SMC v2 / Anti-Front-Run dapat diimpor secara mulus tanpa kehilangan detail tingkat eksekusi mikro.
- Trader mendapatkan visualisasi zona entri yang jelas di grafik dan peringatan alert menyeluruh di seluruh titik order limit.
- Kompatibilitas ke belakang 100% terjaga untuk seluruh riwayat Trade Plan Vault dan rencana satu entri konvensional.
