// Tests untuk Bug Diagnosis: Snapshot Preview Modal UI Freeze / Infinite Reactivity on Linux (#97)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compile } from 'svelte/compiler';
// @ts-ignore
import * as s from 'svelte/internal/client';

test('SnapshotPreviewModal: Pencegahan Reactivity Loop & UI Thread Saturation', async (t) => {
  const modalFilePath = path.resolve('src/lib/components/SnapshotPreviewModal.svelte');
  const sourceCode = fs.readFileSync(modalFilePath, 'utf8');

  await t.test('1. Static Analysis: Memastikan $effect menggunakan guard atau untrack untuk mencegah dependency cycle', () => {
    // Memeriksa bahwa SnapshotPreviewModal.svelte mengimpor untrack dari svelte
    assert.match(
      sourceCode,
      /import\s*\{[^}]*untrack[^}]*\}\s*from\s*['"]svelte['"]/,
      'SnapshotPreviewModal.svelte wajib mengimpor `untrack` dari `svelte`'
    );

    // Memeriksa bahwa isOpen menggunakan guard edge-detection (misal `isOpen && !wasOpen` atau `untrack`)
    assert.match(
      sourceCode,
      /untrack\s*\(\s*\(\s*\)\s*=>/,
      'Inisialisasi snapshot di dalam $effect wajib dibungkus dalam untrack(() => ...)'
    );
  });

  await t.test('2. Ticker Price Isolation: Perubahan currentPrice dari WebSocket tidak boleh memicu re-render canvas live', () => {
    // Dalam modal snapshot, harga harus dibekukan saat modal dibuka (freeze snapshot state)
    // dan tidak boleh langsung membaca prop `currentPrice` yang terus berubah dari WebSocket di dalam effect.
    assert.match(
      sourceCode,
      /capturedPrice\s*=|frozenPrice\s*=/,
      'SnapshotPreviewModal wajib membekukan harga (capturedPrice) saat modal dibuka agar ticker WebSocket tidak memicu re-render konstan'
    );
  });

  await t.test('3. Source Canvas Caching: Opsi toggle (Frame/Price/Time) tidak boleh memanggil getScreenshotCanvas ulang', () => {
    // getScreenshotCanvas memicu render WebGL sinkron di Vela (this.paintData()).
    // Kanvas sumber harus dicache saat modal dibuka atau saat scope berganti, bukan di setiap render preview.
    assert.match(
      sourceCode,
      /cachedSourceCanvas|cachedCanvas/,
      'SnapshotPreviewModal wajib menyimpan cache canvas sumber saat modal dibuka untuk mencegah re-evaluasi WebGL berulang'
    );
  });

  await t.test('4. Memory & IPC Safety: Menghindari toDataURL PNG sinkron berukuran besar dengan menggunakan toBlob / createObjectURL', () => {
    // toDataURL('image/png') pada resolusi 2x HiDPI menghasilkan string base64 10-15MB yang membekukan IPC WebKitGTK.
    // Kode harus menggunakan URL.createObjectURL dan URL.revokeObjectURL untuk pratinjau yang ringan dan aman.
    assert.match(
      sourceCode,
      /createObjectURL/,
      'SnapshotPreviewModal wajib menggunakan URL.createObjectURL(blob) untuk pratinjau agar WebKitGTK tidak mengalami deadlock IPC'
    );
    assert.match(
      sourceCode,
      /revokeObjectURL/,
      'SnapshotPreviewModal wajib membersihkan URL blob dengan revokeObjectURL saat modal ditutup atau di-unmount'
    );
  });

  await t.test('5. Svelte 5 Reactive Loop Repro: Memverifikasi simulasi efek tanpa untrack vs dengan untrack', () => {
    // Simulasi bug: Jika effect membaca state yang diperbarui di dalamnya atau membaca currentPrice
    let buggyEffectCalls = 0;
    let buggyCanvasCaptures = 0;

    const cleanupBuggy = s.effect_root(() => {
      const isOpen = s.mutable_source(true);
      const currentPrice = s.mutable_source(65000);
      const capturedAt = s.mutable_source(Date.now());
      const previewUrl = s.mutable_source('');

      // Pola buggy yang ada sebelumnya
      s.user_effect(() => {
        buggyEffectCalls++;
        if (s.get(isOpen)) {
          s.set(capturedAt, Date.now(), true);
          // membaca currentPrice & capturedAt di dalam effect:
          const price = s.get(currentPrice);
          const time = s.get(capturedAt);
          buggyCanvasCaptures++;
          s.set(previewUrl, 'data:image/png;base64,...', true);
        }
      });

      s.flush();

      // Mensimulasikan 5 lonjakan harga dari WebSocket ticker
      for (let i = 1; i <= 5; i++) {
        s.set(currentPrice, 65000 + i, true);
        s.flush();
      }
    });
    cleanupBuggy();

    // Verifikasi bahwa pola lama memicu re-render berulang kali (siklus efek internal + setiap tick harga)
    assert.ok(buggyEffectCalls >= 6, `Pola lama memanggil effect berulang kali (${buggyEffectCalls} kali)`);
    assert.ok(buggyCanvasCaptures >= 6, `Pola lama memanggil canvas capture berulang kali (${buggyCanvasCaptures} kali)`);

    // Sekarang simulasikan pola yang sudah diperbaiki (Fixed) dengan edge-trigger & untrack
    let fixedEffectCalls = 0;
    let fixedCanvasCaptures = 0;

    const cleanupFixed = s.effect_root(() => {
      const isOpen = s.mutable_source(true);
      const currentPrice = s.mutable_source(65000);
      let wasOpen = false;
      const previewUrl = s.mutable_source('');
      let capturedPrice = 0;
      let capturedTime = 0;

      s.user_effect(() => {
        fixedEffectCalls++;
        const open = s.get(isOpen);
        if (open && !wasOpen) {
          wasOpen = true;
          // untrack semua operasi internal dan pembacaan prop dinamis:
          s.untrack(() => {
            capturedPrice = s.get(currentPrice);
            capturedTime = Date.now();
            fixedCanvasCaptures++;
            s.set(previewUrl, 'blob:http://localhost/mock-uuid', true);
          });
        } else if (!open && wasOpen) {
          wasOpen = false;
        }
      });

      s.flush();

      // Mensimulasikan 5 lonjakan harga dari WebSocket ticker
      for (let i = 1; i <= 5; i++) {
        s.set(currentPrice, 65000 + i, true);
        s.flush();
      }
    });
    cleanupFixed();

    // Pola yang diperbaiki hanya memanggil canvas capture 1 KALI saat modal dibuka
    assert.strictEqual(fixedCanvasCaptures, 1, 'Pola baru hanya meng-capture canvas 1 KALI saat modal dibuka');
    assert.strictEqual(fixedEffectCalls, 1, 'Pola baru tidak terpengaruh oleh WebSocket ticker ticks');
  });
});
