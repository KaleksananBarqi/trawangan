# Project Log: Live Drag Real-Time Synchronization Price Scale Labels

- **Tanggal:** 2026-10-12
- **Status:** Selesai & Terintegrasi ke Branch `main` (Issues #5, #6, #7 Closed)
- **Terkait:** `trawangan`, `Vela Chart`, `TradingView Parity`, `Price Scale Badges`
- **Tag:** #dev-log #bugfix #architecture #trawangan #price-scales #event-lifecycle

---

## 1. Ringkasan Masalah & Solusi

### Masalah
Saat pengguna memilih alat gambar posisi Long atau Short di terminal `trawangan`, kemudian menggeser pegangan target (Take Profit) atau stop (Stop Loss), angka harga pada badge sumbu kanan tidak ikut berubah (membeku di nilai awal).

### Akar Masalah (*Root Cause*)
1. **Event Name Mismatch:** Event listener di `Chart.svelte` sebelumnya mendengarkan event yang tidak ada (`drawing:updated`), sedangkan engine Vela secara resmi memancarkan event `drawing:edited` saat perubahan selesai.
2. **Interactive Drag In-Place Disconnection:** Selama interaksi drag berlangsung (`pointermove` saat mouse ditekan), Vela memodifikasi koordinat anchor secara *in-place* di memori tanpa memancarkan event selesai sampai mouse dilepas. State Svelte menahan array lama dan hanya menghitung ulang posisi Y dari nilai statis lama, sehingga teks harga tidak pernah diperbarui selama kursor digeser.

### Solusi
1. **Event Resmi Vela:** Mengaitkan event resmi `drawing:created`, `drawing:edited`, `drawing:draft`, `drawing:removed`, dan `drawing:settings` pada instance chart.
2. **Live Re-Extraction pada Drag Aktif:** Pada setiap event `pointermove` saat mouse ditekan (`e.buttons > 0`), menyegarkan salinan array gambar aktif `activeDrawings = [...(activeChart.drawings.all?.() || [])]`, mengekstrak ulang nilai harga anchor secara live, dan menyinkronkan posisi Y pada 60 FPS di dalam loop `requestAnimationFrame`.
3. **Penyimpanan Persisten Hemat I/O:** Auto-save ke database SQLite hanya dipicu saat interaksi mutasi selesai (pada `pointerup` atau `drawing:edited`) dengan debounce yang aman, mencegah beban I/O disk tinggi selama gerakan drag.
4. **Presisi Kripto Mikro:** Memperbarui `formatPriceLabel` agar mendukung token kripto berharga pecahan mikro tanpa membulatkannya menjadi `$0.00`.

---

## 2. File yang Dimodifikasi

- `src/lib/services/priceScaleLabelService.ts`:
  - Peningkatan fungsi `formatPriceLabel` untuk presisi multi-desimal aset kripto (2 desimal untuk $\ge 1000$, 4 desimal untuk $1-1000$, 6 desimal untuk $< 1$).
- `src/lib/components/Chart.svelte`:
  - Pendaftaran event resmi Vela (`drawing:edited`, `drawing:draft`, `drawing:settings`, `drawing:created`, `drawing:removed`).
  - Penambahan `handleDrawingDraft()` dan integrasi penyegaran live drawings di `updateBadgePositions()`.
  - Pemasangan listener global `pointerup` di window untuk menjamin commit auto-save saat mouse dilepas di manapun.
- `tests/priceScaleLabels.test.ts`:
  - Penambahan pengujian unit seam untuk mutasi in-place saat live dragging, independensi multi-drawing, dan presisi harga mikro (100% lulus, 100/100 tests di seluruh workspace).
- `docs/specs/2026-10-12-live-drag-price-scale-labels-spec.md`:
  - Dokumen spesifikasi fungsional dan teknis.

---

## 3. Keputusan Arsitektur

1. **Pemilihan Event Resmi Vela:**
   - Menghindari tebakan event pihak ketiga dengan memeriksa langsung implementasi bundle `@luxalgo/vela` (`workspace.cjs` / `PositionTool.ts`), di mana event resmi modifikasi gambar terverifikasi sebagai `drawing:edited` dan `drawing:draft`.
2. **Reaktivitas Array Shallow Copy vs Mutasi In-Place:**
   - Objek drawing di Vela dimutasi secara in-place. Dengan mendistribusikan salinan array baru `[...activeChart.drawings.all()]` pada frame interaksi aktif, compiler Svelte 5 mengenali perubahan state dan mengevaluasi ulang turunan `$derived` harga badge secara instan.
3. **Pemisahan Jalur Rendering Visual vs Database I/O:**
   - Merender badge harga dan koordinat Y pada 60 FPS menggunakan rAF memory state tanpa melakukan penulisan disk, dan hanya menjalankan debounced I/O saat `pointerup` dipicu.
