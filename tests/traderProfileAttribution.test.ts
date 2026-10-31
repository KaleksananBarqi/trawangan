import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APP_SETTINGS,
  resolveAppSettings
} from '../src/lib/constants/defaults';
import type { AppSettings, UserProfileConfig } from '../src/lib/types/market';
import {
  compositeSnapshot,
  type SnapshotOptions,
  type SnapshotMetadata
} from '../src/lib/services/chartSnapshotService';

/**
 * Mock helper untuk 2D Canvas Context dalam lingkungan Node.js
 */
function createMockCanvas(width = 800, height = 600) {
  const operations: { method: string; args: any[] }[] = [];
  const state: Record<string, any> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };

  const context: any = {
    ...state,
    save: () => operations.push({ method: 'save', args: [] }),
    restore: () => operations.push({ method: 'restore', args: [] }),
    beginPath: () => operations.push({ method: 'beginPath', args: [] }),
    closePath: () => operations.push({ method: 'closePath', args: [] }),
    moveTo: (x: number, y: number) => operations.push({ method: 'moveTo', args: [x, y] }),
    lineTo: (x: number, y: number) => operations.push({ method: 'lineTo', args: [x, y] }),
    arc: (...args: any[]) => operations.push({ method: 'arc', args }),
    arcTo: (...args: any[]) => operations.push({ method: 'arcTo', args }),
    roundRect: (...args: any[]) => operations.push({ method: 'roundRect', args }),
    rect: (...args: any[]) => operations.push({ method: 'rect', args }),
    fill: () => operations.push({ method: 'fill', args: [context.fillStyle] }),
    stroke: () => operations.push({ method: 'stroke', args: [context.strokeStyle] }),
    clip: () => operations.push({ method: 'clip', args: [] }),
    clearRect: (...args: any[]) => operations.push({ method: 'clearRect', args }),
    fillRect: (...args: any[]) => operations.push({ method: 'fillRect', args }),
    strokeRect: (...args: any[]) => operations.push({ method: 'strokeRect', args }),
    fillText: (text: string, x: number, y: number, maxWidth?: number) =>
      operations.push({ method: 'fillText', args: [text, x, y, maxWidth, context.font, context.fillStyle] }),
    strokeText: (text: string, x: number, y: number) =>
      operations.push({ method: 'strokeText', args: [text, x, y] }),
    drawImage: (...args: any[]) => operations.push({ method: 'drawImage', args }),
    measureText: (text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
  };

  const canvas = {
    width,
    height,
    getContext: (type: string) => (type === '2d' ? context : null),
    toDataURL: (type = 'image/png') => `data:${type};base64,mockImageData`,
    toBlob: (cb: (blob: Blob | null) => void, type = 'image/png') => {
      const mockBlob = new Blob(['mockBlobData'], { type });
      cb(mockBlob);
    },
    operations,
    context,
  };

  return canvas;
}

describe('Tiket #126: Trader Profile Settings & Personal Attribution Seam Suite', () => {
  const baseMetadata: SnapshotMetadata = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    providerId: 'binance',
    lastPrice: 67420.5,
    timezone: 'Asia/Jakarta',
    timestamp: new Date('2026-10-31T12:00:00Z'),
  };

  describe('1. AppSettings & Defaults: userProfile Schema & Normalization', () => {
    test('DEFAULT_APP_SETTINGS menyertakan konfigurasi bawaan userProfile', () => {
      assert.ok(DEFAULT_APP_SETTINGS.userProfile, 'userProfile harus terdefinisi di DEFAULT_APP_SETTINGS');
      assert.equal(DEFAULT_APP_SETTINGS.userProfile.username, '');
      assert.equal(DEFAULT_APP_SETTINGS.userProfile.handle, '');
      assert.equal(DEFAULT_APP_SETTINGS.userProfile.avatarDataUrl, undefined);
    });

    test('resolveAppSettings menormalkan profil kosong atau null ke nilai default yang aman', () => {
      const resolvedNull = resolveAppSettings(null);
      assert.deepEqual(resolvedNull.userProfile, {
        username: '',
        handle: '',
        avatarDataUrl: undefined,
      });

      const resolvedPartial = resolveAppSettings({
        userProfile: {
          username: 'Nakamoto',
        } as any,
      });
      assert.ok(resolvedPartial.userProfile);
      assert.equal(resolvedPartial.userProfile.username, 'Nakamoto');
      assert.equal(resolvedPartial.userProfile.handle, '');
      assert.equal(resolvedPartial.userProfile.avatarDataUrl, undefined);
    });

    test('resolveAppSettings mempertahankan identitas profil lengkap dan membersihkan tipe invalid', () => {
      const mockProfile: UserProfileConfig = {
        username: 'Satoshi Nakamoto',
        handle: '@satoshi',
        avatarDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      };

      const resolved = resolveAppSettings({ userProfile: mockProfile });
      assert.ok(resolved.userProfile);
      assert.equal(resolved.userProfile.username, 'Satoshi Nakamoto');
      assert.equal(resolved.userProfile.handle, '@satoshi');
      assert.equal(resolved.userProfile.avatarDataUrl, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');

      // Tipe invalid dikembalikan ke default
      const resolvedInvalid = resolveAppSettings({
        userProfile: {
          username: 12345 as any,
          handle: null as any,
          avatarDataUrl: false as any,
        },
      });
      assert.ok(resolvedInvalid.userProfile);
      assert.equal(resolvedInvalid.userProfile.username, '');
      assert.equal(resolvedInvalid.userProfile.handle, '');
      assert.equal(resolvedInvalid.userProfile.avatarDataUrl, undefined);
    });
  });

  describe('2. Branded Snapshot Attribution Bar: Personal Trader Attribution', () => {
    test('Merender foto profil citra avatar saat avatarDataUrl / avatarImage tersedia', () => {
      const sourceCanvas = createMockCanvas(800, 600);
      const targetCanvas = createMockCanvas(1, 1);
      const mockLogo = { name: 'app-logo' };
      const mockAvatar = { name: 'trader-avatar-img' };

      const options: SnapshotOptions = {
        mode: 'branded',
        scaleMultiplier: 2,
        logoImage: mockLogo,
        avatarImage: mockAvatar,
        userProfile: {
          username: 'Satoshi',
          handle: '@nakamoto',
          avatarDataUrl: 'data:image/png;base64,mockAvatarData',
        },
        metadata: baseMetadata,
      };

      compositeSnapshot(sourceCanvas, options, targetCanvas);

      // Verifikasi logo resmi digambar
      const logoOp = targetCanvas.operations.find(
        (op) => op.method === 'drawImage' && op.args[0] === mockLogo
      );
      assert.ok(logoOp, 'Logo resmi aplikasi harus digambar');

      // Verifikasi avatar citra digambar dengan pemotongan sirkular (clip)
      const avatarOp = targetCanvas.operations.find(
        (op) => op.method === 'drawImage' && op.args[0] === mockAvatar
      );
      assert.ok(avatarOp, 'Citra avatar pengguna harus digambar');

      const clipOp = targetCanvas.operations.find((op) => op.method === 'clip');
      assert.ok(clipOp, 'Kliping sirkular harus diterapkan pada avatar');

      // Verifikasi Username dan Handle dirender
      const usernameOp = targetCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'Satoshi'
      );
      assert.ok(usernameOp, 'Username "Satoshi" harus dirender pada canvas');

      const handleOp = targetCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === '@nakamoto'
      );
      assert.ok(handleOp, 'Social handle "@nakamoto" harus dirender pada canvas');

      // Verifikasi branding bawaan 'trawangan' tidak ditampilkan saat username terisi
      const brandOp = targetCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'trawangan'
      );
      assert.equal(brandOp, undefined, 'Branding teks "trawangan" tidak boleh muncul jika profil pengguna aktif');
    });

    test('Fallback inisial avatar huruf pertama saat foto avatar belum diunggah', () => {
      const sourceCanvas = createMockCanvas(800, 600);
      const targetCanvas = createMockCanvas(1, 1);
      const mockLogo = { name: 'app-logo' };

      const options: SnapshotOptions = {
        mode: 'branded',
        scaleMultiplier: 2,
        logoImage: mockLogo,
        userProfile: {
          username: 'Barqi',
          handle: '@barqi',
          // avatarDataUrl sengaja tidak diisi
        },
        metadata: baseMetadata,
      };

      compositeSnapshot(sourceCanvas, options, targetCanvas);

      // Verifikasi lingkaran latar aksen (#FF69B4) untuk inisial dibuat
      const arcOp = targetCanvas.operations.find((op) => op.method === 'arc');
      assert.ok(arcOp, 'Lingkaran avatar harus digambar via arc');

      const fillAksenOp = targetCanvas.operations.find(
        (op) => op.method === 'fill' && op.args[0] === '#FF69B4'
      );
      assert.ok(fillAksenOp, 'Lingkaran latar inisial harus menggunakan aksen #FF69B4');

      // Verifikasi inisial huruf pertama kapital 'B' dirender di dalam badge avatar
      const initialOp = targetCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'B'
      );
      assert.ok(initialOp, 'Inisial huruf pertama "B" harus dirender');

      // Verifikasi nama 'Barqi' dan handle '@barqi' tetap ditampilkan
      const usernameOp = targetCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'Barqi'
      );
      assert.ok(usernameOp, 'Username "Barqi" harus dirender');

      const handleOp = targetCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === '@barqi'
      );
      assert.ok(handleOp, 'Handle "@barqi" harus dirender');
    });

    test('Fallback anggun ke branding bawaan "trawangan" saat username kosong', () => {
      const sourceCanvas = createMockCanvas(800, 600);
      const targetCanvas = createMockCanvas(1, 1);
      const mockLogo = { name: 'app-logo' };

      const options: SnapshotOptions = {
        mode: 'branded',
        scaleMultiplier: 2,
        logoImage: mockLogo,
        userProfile: {
          username: '',
          handle: '',
        },
        metadata: baseMetadata,
      };

      compositeSnapshot(sourceCanvas, options, targetCanvas);

      // Teks brand 'trawangan' harus dirender
      const brandOp = targetCanvas.operations.find(
        (op) => op.method === 'fillText' && op.args[0] === 'trawangan'
      );
      assert.ok(brandOp, 'Teks brand "trawangan" harus dirender jika username kosong');

      // Tidak ada inisial atau drawing avatar
      const initialOp = targetCanvas.operations.find(
        (op) => op.method === 'fillText' && typeof op.args[0] === 'string' && op.args[0].length === 1 && op.args[0] === op.args[0].toUpperCase() && op.args[0] !== '·'
      );
      assert.equal(initialOp, undefined, 'Tidak boleh ada badge inisial saat username kosong');
    });
  });
});
