import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  UpdateService,
  compareSemver,
  detectPlatform,
  classifyAssetKind,
  selectMatchedAsset,
  resolveUpdateStrategy,
  shouldShowUpdateBadge,
  getUpdatePillContent,
  type ReleaseAsset,
  type InstallEnvironment,
} from '../src/lib/services/updateService';
import { APP_VERSION } from '../src/lib/config/version';
import {
  inferUpdaterPlatformKey,
  buildLatestJson,
  formatSha256Sums,
} from '../scripts/generate-release-manifests.mjs';

const SAMPLE_ASSETS: ReleaseAsset[] = [
  {
    name: 'trawangan-0.49.0-1.x86_64.rpm',
    browserDownloadUrl:
      'https://github.com/KaleksananBarqi/trawangan/releases/download/v0.49.0/trawangan-0.49.0-1.x86_64.rpm',
    size: 7_000_000,
    kind: classifyAssetKind('trawangan-0.49.0-1.x86_64.rpm'),
  },
  {
    name: 'trawangan-0.49.0-1.aarch64.rpm',
    browserDownloadUrl:
      'https://github.com/KaleksananBarqi/trawangan/releases/download/v0.49.0/trawangan-0.49.0-1.aarch64.rpm',
    size: 6_800_000,
    kind: classifyAssetKind('trawangan-0.49.0-1.aarch64.rpm'),
  },
  {
    name: 'trawangan_0.49.0_amd64.deb',
    browserDownloadUrl:
      'https://github.com/KaleksananBarqi/trawangan/releases/download/v0.49.0/trawangan_0.49.0_amd64.deb',
    size: 7_000_000,
    kind: classifyAssetKind('trawangan_0.49.0_amd64.deb'),
  },
  {
    name: 'trawangan_0.49.0_amd64.AppImage',
    browserDownloadUrl:
      'https://github.com/KaleksananBarqi/trawangan/releases/download/v0.49.0/trawangan_0.49.0_amd64.AppImage',
    size: 85_000_000,
    kind: classifyAssetKind('trawangan_0.49.0_amd64.AppImage'),
  },
  {
    name: 'trawangan_0.49.0_x64-setup.exe',
    browserDownloadUrl:
      'https://github.com/KaleksananBarqi/trawangan/releases/download/v0.49.0/trawangan_0.49.0_x64-setup.exe',
    size: 5_000_000,
    kind: classifyAssetKind('trawangan_0.49.0_x64-setup.exe'),
  },
  {
    name: 'trawangan_0.49.0_aarch64.dmg',
    browserDownloadUrl:
      'https://github.com/KaleksananBarqi/trawangan/releases/download/v0.49.0/trawangan_0.49.0_aarch64.dmg',
    size: 5_500_000,
    kind: classifyAssetKind('trawangan_0.49.0_aarch64.dmg'),
  },
];

function createMockFetchRelease(tagName = 'v0.49.0'): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: tagName,
        name: `trawangan ${tagName}`,
        body: 'Pembaruan sistem in-app updater.',
        html_url: `https://github.com/KaleksananBarqi/trawangan/releases/tag/${tagName}`,
        published_at: '2026-11-14T16:00:00Z',
        assets: SAMPLE_ASSETS.map((a) => ({
          name: a.name,
          browser_download_url: a.browserDownloadUrl,
          size: a.size,
        })),
      }),
    }) as Response) as typeof fetch;
}

describe('Update Service & Semver Logic Unit Tests', () => {
  test('APP_VERSION terdefinisi dan cocok dengan format semantic versioning', () => {
    assert.ok(APP_VERSION);
    assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(APP_VERSION, '0.48.0');
  });

  test('compareSemver membandingkan versi dengan benar', () => {
    assert.equal(compareSemver('0.3.1', '0.3.1'), 0);
    assert.equal(compareSemver('v0.3.1', '0.3.1'), 0);
    assert.equal(compareSemver('0.3.1', 'v0.3.1'), 0);

    assert.equal(compareSemver('0.3.2', '0.3.1'), 1);
    assert.equal(compareSemver('0.4.0', '0.3.1'), 1);
    assert.equal(compareSemver('1.0.0', '0.3.1'), 1);
    assert.equal(compareSemver('v0.3.2', 'v0.3.1'), 1);

    assert.equal(compareSemver('0.3.0', '0.3.1'), -1);
    assert.equal(compareSemver('0.1.0', '0.3.1'), -1);
    assert.equal(compareSemver('v0.2.9', 'v0.3.1'), -1);
  });

  test('detectPlatform mengembalikan nilai default yang valid', () => {
    const platform = detectPlatform();
    assert.ok(['windows', 'macos', 'linux'].includes(platform));
  });

  test('classifyAssetKind mengenali seluruh paket termasuk .rpm', () => {
    assert.equal(classifyAssetKind('trawangan-0.48.0-1.x86_64.rpm'), 'linux');
    assert.equal(classifyAssetKind('trawangan_0.48.0_amd64.deb'), 'linux');
    assert.equal(classifyAssetKind('trawangan_0.48.0_amd64.AppImage'), 'linux');
    assert.equal(classifyAssetKind('trawangan_0.48.0_x64-setup.exe'), 'windows');
    assert.equal(classifyAssetKind('trawangan_0.48.0_x64_en-US.msi'), 'windows');
    assert.equal(classifyAssetKind('trawangan_0.48.0_aarch64.dmg'), 'macos');
    assert.equal(classifyAssetKind('trawangan_aarch64.app.tar.gz'), 'macos');
  });

  test('selectMatchedAsset memilih aset tepat untuk rpm (x86_64 & aarch64), deb, appimage, windows, dan macos', () => {
    const fedoraX64: InstallEnvironment = {
      os: 'linux',
      arch: 'x86_64',
      installKind: 'rpm',
      recommendedLinuxFormat: 'rpm',
      packageManager: 'dnf',
      canInAppUpdate: true,
      isDev: false,
    };
    assert.equal(selectMatchedAsset(SAMPLE_ASSETS, fedoraX64, 'linux')?.name, 'trawangan-0.49.0-1.x86_64.rpm');

    const fedoraArm: InstallEnvironment = { ...fedoraX64, arch: 'aarch64' };
    assert.equal(selectMatchedAsset(SAMPLE_ASSETS, fedoraArm, 'linux')?.name, 'trawangan-0.49.0-1.aarch64.rpm');

    const debEnv: InstallEnvironment = {
      os: 'linux',
      arch: 'x86_64',
      installKind: 'deb',
      recommendedLinuxFormat: 'deb',
      packageManager: 'apt-get',
      canInAppUpdate: true,
      isDev: false,
    };
    assert.equal(selectMatchedAsset(SAMPLE_ASSETS, debEnv, 'linux')?.name, 'trawangan_0.49.0_amd64.deb');

    const appImageEnv: InstallEnvironment = {
      os: 'linux',
      arch: 'x86_64',
      installKind: 'appimage',
      recommendedLinuxFormat: 'appimage',
      packageManager: null,
      canInAppUpdate: true,
      isDev: false,
    };
    assert.equal(selectMatchedAsset(SAMPLE_ASSETS, appImageEnv, 'linux')?.name, 'trawangan_0.49.0_amd64.AppImage');

    const winEnv: InstallEnvironment = {
      os: 'windows',
      arch: 'x86_64',
      installKind: 'windows',
      recommendedLinuxFormat: null,
      packageManager: null,
      canInAppUpdate: true,
      isDev: false,
    };
    assert.equal(selectMatchedAsset(SAMPLE_ASSETS, winEnv, 'windows')?.name, 'trawangan_0.49.0_x64-setup.exe');

    const macEnv: InstallEnvironment = {
      os: 'macos',
      arch: 'aarch64',
      installKind: 'macos',
      recommendedLinuxFormat: null,
      packageManager: null,
      canInAppUpdate: true,
      isDev: false,
    };
    assert.equal(selectMatchedAsset(SAMPLE_ASSETS, macEnv, 'macos')?.name, 'trawangan_0.49.0_aarch64.dmg');
  });

  test('resolveUpdateStrategy memetakan strategi hybrid dengan benar', () => {
    assert.equal(
      resolveUpdateStrategy({
        os: 'linux',
        arch: 'x86_64',
        installKind: 'rpm',
        recommendedLinuxFormat: 'rpm',
        packageManager: 'dnf',
        canInAppUpdate: true,
        isDev: false,
      }),
      'linux-package'
    );
    assert.equal(
      resolveUpdateStrategy({
        os: 'linux',
        arch: 'x86_64',
        installKind: 'appimage',
        recommendedLinuxFormat: 'appimage',
        packageManager: null,
        canInAppUpdate: true,
        isDev: false,
      }),
      'tauri-updater'
    );
    assert.equal(
      resolveUpdateStrategy({
        os: 'linux',
        arch: 'x86_64',
        installKind: 'flatpak',
        recommendedLinuxFormat: 'flatpak',
        packageManager: 'flatpak',
        canInAppUpdate: false,
        isDev: false,
      }),
      'store-managed'
    );
    assert.equal(
      resolveUpdateStrategy({
        os: 'linux',
        arch: 'x86_64',
        installKind: 'dev',
        recommendedLinuxFormat: 'rpm',
        packageManager: null,
        canInAppUpdate: false,
        isDev: true,
      }),
      'manual'
    );
  });

  test('shouldShowUpdateBadge & getUpdatePillContent konsisten lintas status', () => {
    const info = {
      currentVersion: '0.48.0',
      latestVersion: '0.49.0',
      latestTag: 'v0.49.0',
      releaseName: 'v0.49.0',
      releaseNotes: 'notes',
      releaseUrl: 'https://github.com/KaleksananBarqi/trawangan/releases/tag/v0.49.0',
      publishedAt: '2026-11-14',
      isUpdateAvailable: true,
      assets: SAMPLE_ASSETS,
    };

    assert.equal(shouldShowUpdateBadge({ status: 'available', updateInfo: info, dismissedVersion: null }), true);
    assert.equal(shouldShowUpdateBadge({ status: 'available', updateInfo: info, dismissedVersion: '0.49.0' }), false);
    assert.equal(shouldShowUpdateBadge({ status: 'downloading', updateInfo: info, dismissedVersion: '0.49.0' }), true);
    assert.equal(shouldShowUpdateBadge({ status: 'ready_to_install', updateInfo: info, dismissedVersion: '0.49.0' }), true);

    assert.deepEqual(getUpdatePillContent({ status: 'available', updateInfo: info, downloadProgress: null }), {
      icon: 'sparkles',
      label: 'Update v0.49.0',
    });
    assert.deepEqual(
      getUpdatePillContent({
        status: 'downloading',
        updateInfo: info,
        downloadProgress: { downloadedBytes: 3500, totalBytes: 7000, percent: 50 },
      }),
      { icon: 'download', label: 'Mengunduh 50%' }
    );
    assert.deepEqual(getUpdatePillContent({ status: 'ready_to_install', updateInfo: info, downloadProgress: null }), {
      icon: 'sparkles',
      label: 'Siap Pasang',
    });
    assert.deepEqual(getUpdatePillContent({ status: 'installing', updateInfo: info, downloadProgress: null }), {
      icon: 'spin',
      label: 'Memasang...',
    });
  });

  test('transisi state UpdateService jalur linux-package: available -> downloading -> ready_to_install -> batal pkexec -> installing', async () => {
    let savedDismissed: string | null = null;
    const observedStatuses: string[] = [];

    const service = new UpdateService({
      isTauri: () => true,
      getAppVersion: async () => '0.48.0',
      detectEnvironment: async () => ({
        os: 'linux',
        arch: 'x86_64',
        installKind: 'rpm',
        recommendedLinuxFormat: 'rpm',
        packageManager: 'dnf',
        canInAppUpdate: true,
        isDev: false,
      }),
      fetchFn: createMockFetchRelease('v0.49.0'),
      getDismissedVersion: () => savedDismissed,
      saveDismissedVersion: async (v) => {
        savedDismissed = v;
      },
      downloadLinuxPackage: async (params, onProgress) => {
        assert.equal(params.assetName, 'trawangan-0.49.0-1.x86_64.rpm');
        onProgress({ downloadedBytes: 3_500_000, totalBytes: 7_000_000, percent: 50 });
        onProgress({ downloadedBytes: 7_000_000, totalBytes: 7_000_000, percent: 100 });
        return {
          filePath: '/tmp/trawangan-updates/trawangan-0.49.0-1.x86_64.rpm',
          sha256: 'abc123',
          fileSize: 7_000_000,
        };
      },
      installLinuxPackage: async () => ({
        status: 'cancelled',
        message: 'Autentikasi sistem dibatalkan.',
      }),
    });

    const unsub = service.subscribe((s) => observedStatuses.push(s.status));

    const checked = await service.checkForUpdates(false);
    assert.equal(checked.status, 'available');
    assert.equal(checked.updateStrategy, 'linux-package');
    assert.equal(checked.updateInfo?.matchedAsset?.name, 'trawangan-0.49.0-1.x86_64.rpm');

    await service.dismissCurrentUpdate();
    assert.equal(savedDismissed, '0.49.0');
    assert.equal(shouldShowUpdateBadge(service.getSnapshot()), false);

    await service.clearDismissedUpdate();
    assert.equal(savedDismissed, null);
    assert.equal(shouldShowUpdateBadge(service.getSnapshot()), true);

    await service.downloadUpdate();
    const afterDownload = service.getSnapshot();
    assert.equal(afterDownload.status, 'ready_to_install');
    assert.equal(afterDownload.stagedPackagePath, '/tmp/trawangan-updates/trawangan-0.49.0-1.x86_64.rpm');
    assert.equal(afterDownload.downloadProgress?.percent, 100);

    await service.installAndRelaunch();
    const afterCancel = service.getSnapshot();
    assert.equal(afterCancel.status, 'ready_to_install');
    assert.equal(afterCancel.canRetryFallbackGui, true);
    assert.equal(afterCancel.statusMessage, 'Autentikasi sistem dibatalkan.');

    unsub();
    assert.ok(observedStatuses.includes('checking'));
    assert.ok(observedStatuses.includes('available'));
    assert.ok(observedStatuses.includes('downloading'));
    assert.ok(observedStatuses.includes('ready_to_install'));
    assert.ok(observedStatuses.includes('installing'));
  });

  test('pemulihan error unduhan dan alur tauri-updater dengan relaunch', async () => {
    let installed = false;
    let relaunched = false;
    let shouldFailDownload = true;

    const service = new UpdateService({
      isTauri: () => true,
      getAppVersion: async () => '0.48.0',
      detectEnvironment: async () => ({
        os: 'linux',
        arch: 'x86_64',
        installKind: 'appimage',
        recommendedLinuxFormat: 'appimage',
        packageManager: null,
        canInAppUpdate: true,
        isDev: false,
      }),
      fetchFn: createMockFetchRelease('v0.49.0'),
      checkTauriUpdater: async () => {
        if (shouldFailDownload) {
          throw new Error('Koneksi terputus');
        }
        return {
          download: async (cb) => {
            cb({ event: 'Started', data: { contentLength: 1000 } });
            cb({ event: 'Progress', data: { chunkLength: 500 } });
            cb({ event: 'Finished', data: {} });
          },
          install: async () => {
            installed = true;
          },
        };
      },
      relaunchApp: async () => {
        relaunched = true;
      },
    });

    await service.checkForUpdates(false);
    await service.downloadUpdate();
    assert.equal(service.getSnapshot().status, 'error');
    assert.match(service.getSnapshot().errorMessage ?? '', /Koneksi terputus/);

    shouldFailDownload = false;
    await service.downloadUpdate();
    assert.equal(service.getSnapshot().status, 'ready_to_install');

    await service.installAndRelaunch();
    assert.equal(installed, true);
    assert.equal(relaunched, true);
  });

  test('generator manifest CI menghasilkan latest.json dan SHA256SUMS.txt yang valid', () => {
    assert.equal(inferUpdaterPlatformKey('trawangan_0.49.0_x64-setup.exe'), 'windows-x86_64');
    assert.equal(inferUpdaterPlatformKey('trawangan_0.49.0_amd64.AppImage'), 'linux-x86_64');
    assert.equal(inferUpdaterPlatformKey('trawangan_aarch64.app.tar.gz'), 'darwin-aarch64');
    assert.equal(inferUpdaterPlatformKey('trawangan-0.49.0-1.x86_64.rpm'), null);

    const manifest = buildLatestJson({
      tag: 'v0.49.0',
      notes: 'Pembaruan sistem',
      pubDate: '2026-11-14T16:00:00Z',
      signedAssets: [
        { fileName: 'trawangan_0.49.0_x64-setup.exe', signature: 'SIG_WIN' },
        { fileName: 'trawangan_0.49.0_amd64.AppImage', signature: 'SIG_LINUX' },
        { fileName: 'trawangan_aarch64.app.tar.gz', signature: 'SIG_MAC' },
      ],
    });

    assert.equal(manifest.version, '0.49.0');
    assert.equal(manifest.platforms['windows-x86_64'].signature, 'SIG_WIN');
    assert.equal(
      manifest.platforms['linux-x86_64'].url,
      'https://github.com/KaleksananBarqi/trawangan/releases/download/v0.49.0/trawangan_0.49.0_amd64.AppImage'
    );
    assert.equal(manifest.platforms['darwin-aarch64'].signature, 'SIG_MAC');

    const sums = formatSha256Sums([
      { fileName: 'b.rpm', sha256: '2222' },
      { fileName: 'a.deb', sha256: '1111' },
    ]);
    assert.equal(sums, '1111  a.deb\n2222  b.rpm\n');
  });
});
