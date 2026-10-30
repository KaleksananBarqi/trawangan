# Spec: Draw by Holding Gesture Engine and Shortcut Revamp

## Problem Statement

Pengguna terminal `trawangan` saat ini mengalami friksi ergonomis yang signifikan saat melakukan analisis teknikal menggunakan pintasan keyboard (*shortcuts*) dan alat gambar (*drawing tools*):

1. **Tabrakan Kritis Antara Type-to-Search dan Pintasan Alfanumerik**:
   Mekanisme deteksi keystroke kanvas saat ini (*Type-to-Search Canvas Guard*) secara agresif memotong semua pengetikan tombol alfanumerik tunggal (`0-9`, `a-z`) tanpa modifier langsung ke modal pencarian simbol instrumen. Akibatnya, pintasan angka cepat untuk pergantian *timeframe* (`1` untuk 1m, `3` untuk 3m, `5` untuk 5m, `0` untuk 15m, `4` untuk 4h) serta huruf tunggal (`D` untuk 1d, `W` untuk 1w, `F` untuk Fit Chart) tidak pernah bisa dieksekusi atau justru membuka modal pencarian koin secara tidak sengaja.
2. **Bentrokan Tombol Tunggal (Collision)**:
   Tombol `H` terdaftar ganda dengan dua fungsi bertentangan: mengaktifkan alat *Hand-Pull Pan Mode* dan mengganti timeframe lilin ke 1 Jam (*Hourly*).
3. **Ketergantungan pada Pintasan Kuno Berbasis Kombinasi Alt (Claw Grip)**:
   Alat gambar mengandalkan kombinasi dua tombol kaku berbasis `Alt` (`Alt+H`, `Alt+V`, `Alt+T`, `Alt+B`, `Alt+F`, `Alt+R`). Kombinasi ini menuntut posisi jari yang melelahkan (*claw grip*), lambat saat analisis cepat, dan sering dibajak oleh pintasan akselerator menu bawaan sistem operasi Linux/Windows.
4. **Alur Menggambar Konvensional yang Memerlukan Banyak Klik**:
   Untuk menggambar garis tren atau level support/resistance, pengguna harus memindahkan kursor ke bilah alat kiri, membuka menu flyout, memilih alat, mengklik titik awal di kanvas, lalu mengklik titik akhir. Tidak ada cara instan untuk langsung mencoretkan ide analisis teknikal secara alami di atas grafik lilin.

## Solution

Membangun arsitektur terpadu **Draw by Holding Gesture Engine** dan merevamp sistem pintasan keyboard secara menyeluruh:

1. **Pemisahan Domain Input Keyboard (Shortcut Revamp)**:
   - **Timeframe Quick Input Bar**: Pengetikan angka (`1`, `3`, `5`, `15`, `60`, dsb.) di kanvas grafik memunculkan bilah input *timeframe* melayang minimalis di atas grafik (gaya TradingView), bukan lagi membuka modal pencarian simbol. Menekan `Enter` langsung mengganti interval lilin.
   - **Symbol Search Filter**: Pengetikan huruf (`B`, `E`, `S`, dll.) tetap memicu pencarian simbol koin secara instan, kecuali jika tombol tersebut dipetakan sebagai aksi kanvas aktif.
   - **Pembersihan Konflik**: Mengeliminasi bentrokan tombol `H` dan menghapus ketergantungan wajib pada kombinasi `Alt + Huruf`.
2. **Dual-Trigger Gesture Draw (Dua Arah / Vice-Versa)**:
   - **Toolbar Toggle Button**: Menambahkan tombol baru berikon pena stylus pada kelompok alat pointer di bilah alat gambar kiri (bersebelahan dengan Kursor dan Hand-Pull). Mengkliknya mengunci kanvas ke *Gesture Draw Mode*.
   - **Shortcut Toggle Cepat (`Shift + D`)**: Menekan kombinasi `Shift+D` beralih instan antara mode kursor standar dan *Gesture Draw Mode* tanpa pegal tangan.
   - **Transient Hold Mode (`~` / Backquote atau `Shift+D`)**: Menahan tombol pemicu sambil melakukan drag mouse langsung mengaktifkan sapuan gesture seketika. Melepas tombol langsung mengembalikan kursor ke mode biasa.
   - **Visual Canvas Cue**: Kursor mouse bermutasi menjadi ikon pena stylus, disertai indikator status melayang halus di sudut kanvas.
3. **Mesin Pengenal Geometri Goresan Lokal (Client-Side Heuristic Recognizer)**:
   - Mengubah satu sapuan tangan bebas (*one continuous stroke*) menjadi 9 objek gambar definitif secara instan (0ms latensi, 100% offline):
     - **Trend Line**: Goresan lurus miring diagonal.
     - **Horizontal Line**: Goresan lurus horizontal (kemiringan < 7°).
     - **Vertical Line**: Goresan lurus vertikal (kemiringan > 83°).
     - **Ray**: Goresan lurus yang ditarik menembus atau mendekati batas sumbu harga kanan.
     - **Rectangle / Box**: Goresan empat sisi tertutup dengan sudut-sudut tegas.
     - **Ellipse**: Goresan melingkar atau oval tertutup dengan kurva membulat mulus.
     - **Fib Retracement**: Goresan 3 titik ayunan (*swing high-to-low*) berbentuk huruf Z/N.
     - **Path / Polyline**: Goresan garis bebas bersudut tajam banyak lekukan.
     - **Arrow**: Goresan lurus yang diakhiri kait/centang balik di ujungnya.
4. **Scribble to Erase (Penghapusan dengan Coretan Zigzag)**:
   - Sapuan zigzag bolak-balik dengan frekuensi pembalikan arah tinggi di atas objek gambar yang sudah ada langsung menghapus objek tersebut. Aksi penghapusan dicatat ke riwayat *Undo/Redo* (`Ctrl+Z` / `Ctrl+Y`).
5. **Smart Interaction Aids (Wick Snapping & Tab Candidate Cycling)**:
   - **OHLC Wick Snapping**: Garis horizontal dan Fib Retracement otomatis menempel (*snap*) pada ekor lilin (*wick High/Low*) terdekat dalam radius toleransi 20 piksel via subsistem magnet yang sudah ada.
   - **Live Dynamic Ink**: Sapuan kuas dirender secara real-time dengan efek tinta neon halus pada kanvas sementara.
   - **Floating HUD & Tab Cycling**: Setelah goresan selesai, muncul lencana kecil melayang yang menampilkan nama alat terdeteksi. Menekan tombol `Tab` langsung mengganti interpretasi bentuk alternatif (misalnya Trend Line ↔ Ray ↔ Horizontal Line), dan menekan `Esc` membatalkan gambar.
6. **Modal Panduan Visual "Draw by holding"**:
   - Modal cheatsheet interaktif yang menampilkan kartu visual contoh goresan tangan (garis, ray, box, fib, scribble) yang dapat diakses via ikon bantuan `?` di bilah alat kiri dan Pusat Pintasan Keyboard (`F1`).

## User Stories

1. As a technical analyst, I want to draw trendlines and support/resistance levels by sketching freehand strokes directly on the canvas, so that I don't have to navigate menus or remember obscure keyboard combos.
2. As a keyboard-first trader, I want pressing number keys on the chart canvas to open a minimal Timeframe Quick Input Bar, so that I can switch chart intervals rapidly without opening the symbol search modal.
3. As a momentum trader, I want typing alphabet keys on the chart canvas to immediately trigger the symbol search modal, so that I can jump between coin pairs effortlessly.
4. As a user operating in fast-moving market conditions, I want pressing `Shift+D` to toggle Gesture Draw Mode on and off, so that I can sketch multiple technical setups consecutively without holding down keys.
5. As a mouse-only user, I want a dedicated Gesture Draw icon button in the Left Drawing Toolbar pointer group, so that I can activate gesture drawing entirely with mouse clicks.
6. As a power user who prefers transient actions, I want holding the `~` (tilde/backquote) key while dragging the mouse to draw a gesture stroke, so that the canvas immediately returns to cursor mode when I release the key.
7. As a trader drawing horizontal support and resistance, I want a flat stroke (angle < 7°) to be recognized as a Horizontal Line, so that I can mark key price levels with a single flick.
8. As a trader identifying pivot levels, I want horizontal line gestures to magnetically snap to the nearest candle high or low wick within 20 pixels, so that my price levels are technically accurate to the exact cent/sat.
9. As a trend follower, I want a straight diagonal stroke to be recognized as a Trend Line connecting two price points, so that I can map market channels instantly.
10. As a breakout trader, I want a straight stroke drawn toward or through the right price scale to be classified as a Ray, so that my projected breakout levels extend cleanly into future price action.
11. As a timing analyst, I want a vertical stroke (angle > 83°) to become a Vertical Line, so that I can mark news release times and session opens easily.
12. As a supply and demand / ICT trader, I want drawing a closed four-sided loop to instantly turn into a Rectangle / Box, so that I can highlight order blocks and fair value gaps in one motion.
13. As a visual annotator, I want drawing a rounded closed loop to become an Ellipse, so that I can circle price consolidation clusters.
14. As a harmonic and retracement trader, I want a three-segment swing stroke (Z-shape from swing high to swing low) to become a Fibonacci Retracement, so that golden ratio levels appear without manual tool configuration.
15. As a chartist tracing wave structures, I want a multi-bend stroke with sharp corners to become a Path / Polyline, so that I can map out Elliott wave trajectories fluently.
16. As an analyst sharing chart ideas, I want drawing a stroke with a terminal hook/caret to become an Arrow, so that I can point out crucial price movements to viewers.
17. As an active trader who made a mistaken drawing, I want to scribble back and forth over any drawing to immediately delete it, so that I don't need to select the drawing and find the delete key.
18. As a user whose stroke might be ambiguous, I want a Floating HUD badge displaying the detected tool name with a `Tab: cycle | Esc: cancel` prompt, so that I know exactly what was created.
19. As a user whose diagonal stroke was classified as a Trend Line when I wanted an extended Ray, I want pressing `Tab` immediately after drawing to cycle through candidate interpretations, so that I never have to redraw from scratch.
20. As a user sketching gestures, I want to see a vibrant, smooth live ink stroke rendered on the canvas while my mouse is down, so that I have clear visual feedback on the stroke path.
21. As a trader who accidentally erased a drawing with a scribble gesture, I want pressing `Ctrl+Z` to undo the deletion, so that my technical analysis history is safely preserved.
22. As a trader who wants to cancel a stroke in progress, I want pressing `Esc` or releasing the mouse without sufficient stroke length to abort the gesture cleanly without leaving orphaned drawing nodes.
23. As a user reviewing application shortcuts, I want the Shortcut Cheatsheet Modal (`F1`) to reflect the updated, conflict-free hotkey mappings, so that documentation remains 100% accurate.
24. As a new user discovering the gesture feature, I want to click a small `?` button next to the Gesture Draw toolbar icon to open an illustrative "Draw by holding" visual guide modal, so that I can learn all supported gestures at a glance.
25. As a desktop trader on Linux or Windows, I want to no longer experience browser menu interruptions from legacy `Alt` combos, so that my charting sessions remain fluid and uninterrupted.

## Implementation Decisions

- **Domain Module: `gestureDrawingRecognizer`**:
  - Independent, deterministic mathematical stroke classification engine.
  - Takes an ordered sequence of raw 2D screen coordinates, resamples the path to uniform spatial intervals, computes bounding box dimensions, aspect ratio, stroke path length vs displacement linearity, directional reversal count, total angular curvature, and corner angles.
  - Evaluates candidate matches against geometric threshold rules and returns primary tool type, candidate list for Tab cycling, and snapped anchor coordinates.
- **Controller Extension: `chartDrawingController`**:
  - Manages active gesture state (`isGestureActive`, `isHoldingTriggerKey`).
  - Intercepts pointer events on the chart interaction layer: captures coordinates on pointerdown, feeds points into live stroke buffer on pointermove, and triggers recognition on pointerup.
  - Renders live neon ink on a dedicated overlay canvas during the gesture drag.
  - Resolves scribble bounding box collisions against the active chart's drawing layer objects to execute clean deletions with undo stack recording.
  - Integrates with the existing `ohlcMagnet` engine to snap horizontal lines and Fibonacci anchors to nearby candle wicks within a 20px radius.
- **Toolbar & Navigation: `DrawingToolbar.svelte`**:
  - Adds a new `gesture` tool item to `POINTER_TOOLS` alongside Cursor and Hand-pull with hotkey badge `Shift+D`.
  - Provides a subtle help pill button `?` that triggers the `DrawByHoldingModal`.
- **Keyboard Engine: `commandDispatcher.ts`**:
  - Modifies `Type-to-Search Canvas Guard` to distinguish digits (`0-9`) from letters (`a-z`).
  - Routes digit inputs to a floating `TimeframeQuickBar` component.
  - Routes letter inputs to the existing symbol search modal.
  - Registers `Shift+D` as the global toggle command for Gesture Draw Mode.
  - Listens to trigger hold key events (`~` / Backquote by default, with settings configurability) to provide transient hold drawing.
- **Modal Component: `DrawByHoldingModal.svelte`**:
  - Renders an illustrated cheatsheet card layout matching the OpenMarket visual aesthetic.
  - Showcases all 9 recognized drawing types and 3 interaction rules (Scribble, Tab cycle, Esc cancel) with clean SVG stroke graphics and concise descriptions.

## Testing Decisions

- **Good Test Criteria**:
  - Tests must evaluate public behaviors and observable outcomes: given a synthetic mouse stroke sequence, does the recognizer yield the expected drawing tool type and candidate ranking? Does dispatching key events toggle mode states correctly? Does scribble delete intersecting drawings?
  - Never test internal geometric calculation loop variables or private canvas rendering context state.
- **Target Modules to Test**:
  - `gestureDrawingRecognizer`: Unit tests with synthetic coordinate paths simulating lines, rays, boxes, ellipses, z-folds (fib), polylines, arrows, and zigzag scribbles.
  - `commandDispatcher`: Suite testing digit vs alphabet input routing, `Shift+D` toggle command, and suppression of conflicting shortcuts.
  - `chartDrawingController`: Integration tests verifying pointer event handling, gesture creation into drawing layer, scribble deletion, and undo/redo preservation.
- **Prior Art**:
  - Existing comprehensive test suites in `tests/commandDispatcher.test.ts`, `tests/chartDrawingController.test.ts`, and `tests/drawingToolsService.test.ts`.

## Out of Scope

- Machine learning or neural network-based stroke recognition (unnecessary overhead; deterministic mathematical geometry provides 0ms latency and 100% predictable behavior).
- Multi-touch tablet stylus pressure sensitivity (pen tilt/pressure) in the initial desktop release.
- Freehand 3D or perspective-warped shape recognition.

## Further Notes

- All changes maintain strict adherence to Trawangan's *Pure Charting Scope*, *Docked Structural Shell*, and *Exchange-Aware Drawing Isolation* principles.
- The gesture classification runs entirely in memory on the client thread without any network calls or telemetry.
