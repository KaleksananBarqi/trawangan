import { APP_VERSION } from '../config/version';
import { getUiPreferenceSync, setUiPreference, removeUiPreference } from './persistence';
import {
  buildAssetsFromLatestManifest,
  classifyAssetKind,
  compareSemver,
  detectPlatform,
  formatBytes,
  formatRateLimitErrorMessage,
  formatReleaseDate,
  getUpdatePillContent,
  isUpdateFlowActive,
  parseSha256SumsAssets,
  resolveUpdateStrategy,
  selectMatchedAsset,
  shouldShowUpdateBadge,
  type AssetKind,
  type DownloadProgress,
  type InstallEnvironment,
  type InstallKind,
  type LatestManifestPayload,
  type ReleaseAsset,
  type UpdateInfo,
  type UpdatePillContent,
  type UpdateState,
  type UpdateStatus,
  type UpdateStrategy,
} from './updateHelpers';

export {
  classifyAssetKind,
  compareSemver,
  detectPlatform,
  formatBytes,
  getUpdatePillContent,
  isUpdateFlowActive,
  resolveUpdateStrategy,
  selectMatchedAsset,
  shouldShowUpdateBadge,
};
export type {
  AssetKind,
  DownloadProgress,
  InstallEnvironment,
  InstallKind,
  ReleaseAsset,
  UpdateInfo,
  UpdatePillContent,
  UpdateState,
  UpdateStatus,
  UpdateStrategy,
};

const RELEASE_API_URL = 'https://api.github.com/repos/KaleksananBarqi/trawangan/releases/latest';
const RELEASE_DOWNLOAD_BASE = 'https://github.com/KaleksananBarqi/trawangan/releases/download';
const RELEASE_TAG_BASE = 'https://github.com/KaleksananBarqi/trawangan/releases/tag';
const LATEST_MANIFEST_URL = 'https://github.com/KaleksananBarqi/trawangan/releases/latest/download/latest.json';
const PERIODIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface TauriUpdateHandle {
  download: (cb: (event: any) => void) => Promise<void>;
  install: () => Promise<void>;
}

export interface UpdateServiceAdapters {
  fetchFn?: typeof fetch;
  isTauri?: () => boolean;
  getAppVersion?: () => Promise<string>;
  detectEnvironment?: () => Promise<InstallEnvironment>;
  checkTauriUpdater?: () => Promise<TauriUpdateHandle | null>;
  relaunchApp?: () => Promise<void>;
  downloadLinuxPackage?: (
    params: { assetName: string; assetUrl: string; checksumUrl: string },
    onProgress: (progress: DownloadProgress) => void
  ) => Promise<{ filePath: string; sha256: string; fileSize: number }>;
  installLinuxPackage?: (filePath: string) => Promise<{ status: string; message: string }>;
  openLinuxFallbackGui?: (filePath: string) => Promise<void>;
  getDismissedVersion?: () => string | null;
  saveDismissedVersion?: (version: string | null) => Promise<void>;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export class UpdateService {
  private state: UpdateState = {
    status: 'idle',
    currentVersion: APP_VERSION,
    updateInfo: null,
    installEnvironment: null,
    updateStrategy: 'manual',
    downloadProgress: null,
    stagedPackagePath: null,
    dismissedVersion: null,
    lastChecked: null,
    errorMessage: null,
    statusMessage: null,
    canRetryFallbackGui: false,
  };

  private listeners: Set<(state: UpdateState) => void> = new Set();
  private hasInitializedRuntime = false;
  private pendingTauriUpdate: TauriUpdateHandle | null = null;
  private cachedApiEtag: string | null = null;
  private cachedApiData: any | null = null;
  private adapters: UpdateServiceAdapters;

  constructor(adapters: UpdateServiceAdapters = {}) {
    this.adapters = adapters;
  }

  /**
   * Inisialisasi konteks runtime (versi terpasang, lingkungan paket Rust, dan versi yang diabaikan).
   * Dipanggil secara lazy setelah PersistenceService selesai bootstrap (tanpa side-effect saat import modul).
   */
  public async init(): Promise<void> {
    if (this.hasInitializedRuntime) return;
    this.hasInitializedRuntime = true;

    this.syncDismissedVersionFromPersistence();

    const tauriActive = this.adapters.isTauri ? this.adapters.isTauri() : isTauriRuntime();
    if (tauriActive) {
      try {
        const ver = this.adapters.getAppVersion
          ? await this.adapters.getAppVersion()
          : await (await import('@tauri-apps/api/app')).getVersion();
        if (ver) {
          this.state.currentVersion = ver;
        }
      } catch {
        this.state.currentVersion = APP_VERSION;
      }

      try {
        const env = this.adapters.detectEnvironment
          ? await this.adapters.detectEnvironment()
          : await (await import('@tauri-apps/api/core')).invoke<InstallEnvironment>('detect_install_environment');
        this.state.installEnvironment = env;
        this.state.updateStrategy = resolveUpdateStrategy(env);
      } catch {
        this.state.updateStrategy = 'manual';
      }
    } else {
      this.state.currentVersion = APP_VERSION;
      this.state.updateStrategy = 'manual';
    }

    this.notify();
  }

  private syncDismissedVersionFromPersistence(): void {
    try {
      const saved = this.adapters.getDismissedVersion
        ? this.adapters.getDismissedVersion()
        : getUiPreferenceSync<string>('dismissed_update_version');
      this.state.dismissedVersion = typeof saved === 'string' && saved.trim() ? saved.trim() : null;
    } catch {
      this.state.dismissedVersion = null;
    }
  }

  public getSnapshot(): UpdateState {
    return { ...this.state };
  }

  public subscribe(callback: (state: UpdateState) => void): () => void {
    this.listeners.add(callback);
    callback(this.getSnapshot());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  /**
   * Menjadwalkan pengecekan rilis berkala di latar belakang (bawaan setiap 6 jam).
   */
  public startPeriodicChecks(intervalMs = PERIODIC_CHECK_INTERVAL_MS): () => void {
    const timerId = setInterval(() => {
      if (isUpdateFlowActive(this.state.status)) {
        return;
      }
      this.checkForUpdates(true);
    }, intervalMs);

    return () => clearInterval(timerId);
  }

  /**
   * Menyembunyikan notifikasi pill Header/StatusBar untuk versi rilis tertentu.
   */
  public async dismissCurrentUpdate(): Promise<void> {
    const ver = this.state.updateInfo?.latestVersion;
    if (!ver) return;
    this.state.dismissedVersion = ver;
    this.notify();
    try {
      if (this.adapters.saveDismissedVersion) {
        await this.adapters.saveDismissedVersion(ver);
      } else {
        await setUiPreference('dismissed_update_version', ver);
      }
    } catch (err) {
      console.warn('[updateService] Gagal menyimpan dismissed_update_version:', err);
    }
  }

  /**
   * Menghapus status abaikan versi tertentu agar pill kembali aktif.
   */
  public async clearDismissedUpdate(): Promise<void> {
    this.state.dismissedVersion = null;
    this.notify();
    try {
      if (this.adapters.saveDismissedVersion) {
        await this.adapters.saveDismissedVersion(null);
      } else {
        await removeUiPreference('dismissed_update_version');
      }
    } catch {
      // Abaikan
    }
  }

  /**
   * Memeriksa rilis terbaru dari repositori GitHub resmi trawangan.
   */
  public async checkForUpdates(silent = false): Promise<UpdateState> {
    await this.init();
    this.syncDismissedVersionFromPersistence();

    if (isUpdateFlowActive(this.state.status)) {
      return this.getSnapshot();
    }

    if (!silent) {
      this.state.status = 'checking';
      this.state.errorMessage = null;
      this.state.statusMessage = null;
      this.notify();
    }

    try {
      const fetchImpl = this.adapters.fetchFn ?? fetch;
      const updateInfo = await this.fetchLatestUpdateInfo(fetchImpl);

      this.state.updateInfo = updateInfo;
      this.state.lastChecked = new Date();
      this.state.status = updateInfo.isUpdateAvailable ? 'available' : 'latest';
      this.state.errorMessage = null;
      this.state.statusMessage = null;
    } catch (err: any) {
      console.warn('[updateService] Gagal memeriksa pembaruan:', err);
      this.state.lastChecked = new Date();
      if (!silent) {
        this.state.status = 'error';
        this.state.errorMessage = err?.message || 'Gagal menghubungi server rilis.';
      } else {
        this.state.status = 'idle';
      }
    }

    this.notify();
    return this.getSnapshot();
  }

  /**
   * Mengambil metadata rilis terbaru dari GitHub API (dengan ETag cache) lalu fallback ke manifest statis saat rate-limit.
   */
  private async fetchLatestUpdateInfo(fetchImpl: typeof fetch): Promise<UpdateInfo> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (this.cachedApiEtag && this.cachedApiData) {
      headers['If-None-Match'] = this.cachedApiEtag;
    }

    const res = await fetchImpl(RELEASE_API_URL, { headers });

    if (res.status === 304 && this.cachedApiData) {
      return this.buildUpdateInfoFromGitHubApi(this.cachedApiData);
    }

    if (res.ok) {
      const data = await res.json();
      const etag = res.headers?.get?.('etag');
      if (etag) {
        this.cachedApiEtag = etag;
        this.cachedApiData = data;
      }
      return this.buildUpdateInfoFromGitHubApi(data);
    }

    if (res.status === 403 || res.status === 429) {
      try {
        return await this.fetchFromStaticManifestFallback(fetchImpl);
      } catch {
        const resetHeader = res.headers?.get?.('x-ratelimit-reset') ?? null;
        const remaining = res.headers?.get?.('x-ratelimit-remaining');
        if (res.status === 429 || remaining === '0') {
          throw new Error(formatRateLimitErrorMessage(res.status, resetHeader));
        }
      }
    }

    throw new Error(`Gagal mengambil data rilis (HTTP ${res.status})`);
  }

  private buildUpdateInfoFromGitHubApi(data: any): UpdateInfo {
    const latestTag = data.tag_name || 'v0.0.0';
    const latestVersion = latestTag.replace(/^v/, '');
    const currentVersion = this.state.currentVersion;
    const isUpdateAvailable = compareSemver(latestVersion, currentVersion) > 0;

    const rawAssets = Array.isArray(data.assets) ? data.assets : [];
    const assets: ReleaseAsset[] = rawAssets
      .filter((a: any) => {
        const name: string = a?.name || '';
        return !name.endsWith('.sig') && name !== 'latest.json' && name !== 'SHA256SUMS.txt';
      })
      .map((a: any) => {
        const name: string = a.name || '';
        return {
          name,
          browserDownloadUrl: a.browser_download_url,
          size: a.size || 0,
          kind: classifyAssetKind(name),
        };
      });

    const matchedAsset = selectMatchedAsset(assets, this.state.installEnvironment, detectPlatform());

    return {
      currentVersion,
      latestVersion,
      latestTag,
      releaseName: data.name || latestTag,
      releaseNotes: data.body || 'Tidak ada catatan rilis.',
      releaseUrl: data.html_url || 'https://github.com/KaleksananBarqi/trawangan/releases/latest',
      publishedAt: formatReleaseDate(data.published_at),
      isUpdateAvailable,
      assets,
      matchedAsset,
    };
  }

  /**
   * Fallback bebas rate-limit menggunakan berkas rilis statis `latest.json` dan `SHA256SUMS.txt`.
   */
  private async fetchFromStaticManifestFallback(fetchImpl: typeof fetch): Promise<UpdateInfo> {
    const manifestRes = await fetchImpl(LATEST_MANIFEST_URL);
    if (!manifestRes.ok) {
      throw new Error(`Gagal mengambil latest.json (HTTP ${manifestRes.status})`);
    }

    const manifest = (await manifestRes.json()) as LatestManifestPayload;
    const rawVersion = (manifest.version || '0.0.0').trim();
    const latestVersion = rawVersion.replace(/^v/, '');
    const latestTag = `v${latestVersion}`;
    const currentVersion = this.state.currentVersion;
    const isUpdateAvailable = compareSemver(latestVersion, currentVersion) > 0;

    let assets: ReleaseAsset[] = [];
    try {
      const sumsRes = await fetchImpl(`${RELEASE_DOWNLOAD_BASE}/${latestTag}/SHA256SUMS.txt`);
      if (sumsRes.ok) {
        const sumsText = await sumsRes.text();
        assets = parseSha256SumsAssets(sumsText, latestTag, RELEASE_DOWNLOAD_BASE);
      }
    } catch {
      // Abaikan kegagalan SHA256SUMS.txt; lanjut pakai daftar platform dari latest.json.
    }

    if (assets.length === 0) {
      assets = buildAssetsFromLatestManifest(manifest);
    }

    const matchedAsset = selectMatchedAsset(assets, this.state.installEnvironment, detectPlatform());

    return {
      currentVersion,
      latestVersion,
      latestTag,
      releaseName: `trawangan ${latestTag}`,
      releaseNotes: manifest.notes || 'Tidak ada catatan rilis.',
      releaseUrl: `${RELEASE_TAG_BASE}/${latestTag}`,
      publishedAt: formatReleaseDate(manifest.pub_date),
      isUpdateAvailable,
      assets,
      matchedAsset,
    };
  }

  /**
   * Mengunduh pembaruan di dalam aplikasi sesuai strategi OS / format instalasi.
   */
  public async downloadUpdate(): Promise<void> {
    if (isUpdateFlowActive(this.state.status) || !this.state.updateInfo?.isUpdateAvailable) {
      return;
    }

    this.state.status = 'downloading';
    this.state.errorMessage = null;
    this.state.statusMessage = null;
    this.state.canRetryFallbackGui = false;
    this.state.downloadProgress = { downloadedBytes: 0, totalBytes: null, percent: 0 };
    this.notify();

    try {
      if (this.state.updateStrategy === 'tauri-updater') {
        await this.downloadViaTauriUpdater();
      } else if (this.state.updateStrategy === 'linux-package') {
        await this.downloadViaLinuxPackage();
      } else {
        throw new Error('Pembaruan in-app tidak tersedia untuk lingkungan ini. Silakan unduh manual.');
      }

      this.state.status = 'ready_to_install';
      this.state.statusMessage = 'Berkas pembaruan terunduh dan terverifikasi. Siap dipasang & restart.';
      this.notify();
    } catch (err: any) {
      console.error('[updateService] Gagal mengunduh pembaruan:', err);
      this.state.status = 'error';
      this.state.downloadProgress = null;
      this.state.errorMessage = err?.message || 'Gagal mengunduh berkas pembaruan.';
      this.notify();
    }
  }

  private async downloadViaTauriUpdater(): Promise<void> {
    const update = this.adapters.checkTauriUpdater
      ? await this.adapters.checkTauriUpdater()
      : await (await import('@tauri-apps/plugin-updater')).check();

    if (!update) {
      throw new Error(
        'Manifest rilis bertanda tangan (latest.json) belum tersedia untuk versi ini. Gunakan tombol Unduh Manual di bawah.'
      );
    }

    let downloadedBytes = 0;
    let totalBytes: number | null = null;

    await update.download((event: any) => {
      if (event.event === 'Started') {
        totalBytes = event.data.contentLength ?? null;
        this.state.downloadProgress = { downloadedBytes: 0, totalBytes, percent: 0 };
        this.notify();
      } else if (event.event === 'Progress') {
        downloadedBytes += event.data.chunkLength;
        const percent = totalBytes && totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0;
        this.state.downloadProgress = { downloadedBytes, totalBytes, percent };
        this.notify();
      } else if (event.event === 'Finished') {
        this.state.downloadProgress = {
          downloadedBytes,
          totalBytes: totalBytes ?? downloadedBytes,
          percent: 100,
        };
        this.notify();
      }
    });

    this.pendingTauriUpdate = update;
  }

  private async downloadViaLinuxPackage(): Promise<void> {
    const asset = this.state.updateInfo?.matchedAsset;
    const tag = this.state.updateInfo?.latestTag;
    if (!asset || !tag || !(asset.name.endsWith('.rpm') || asset.name.endsWith('.deb'))) {
      throw new Error('Aset paket .rpm / .deb yang cocok tidak ditemukan pada rilis ini.');
    }

    const checksumUrl = `${RELEASE_DOWNLOAD_BASE}/${tag}/SHA256SUMS.txt`;

    if (this.adapters.downloadLinuxPackage) {
      const result = await this.adapters.downloadLinuxPackage(
        { assetName: asset.name, assetUrl: asset.browserDownloadUrl, checksumUrl },
        (progress) => {
          this.state.downloadProgress = progress;
          this.notify();
        }
      );
      this.state.stagedPackagePath = result.filePath;
      return;
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    const unlisten = await listen<DownloadProgress>('updater://download-progress', (event) => {
      this.state.downloadProgress = event.payload;
      this.notify();
    });

    try {
      const result = await invoke<{ filePath: string; sha256: string; fileSize: number }>(
        'download_and_verify_linux_package',
        {
          assetName: asset.name,
          assetUrl: asset.browserDownloadUrl,
          checksumUrl,
        }
      );
      this.state.stagedPackagePath = result.filePath;
    } finally {
      unlisten();
    }
  }

  /**
   * Memasang pembaruan yang sudah terunduh & terverifikasi lalu membuka ulang aplikasi.
   */
  public async installAndRelaunch(): Promise<void> {
    if (this.state.status !== 'ready_to_install') return;

    this.state.status = 'installing';
    this.state.errorMessage = null;
    this.state.statusMessage =
      this.state.updateStrategy === 'linux-package'
        ? 'Menunggu otorisasi sistem dan memasang paket...'
        : 'Memasang pembaruan dan menyiapkan restart...';
    this.notify();

    try {
      if (this.state.updateStrategy === 'tauri-updater' && this.pendingTauriUpdate) {
        await this.pendingTauriUpdate.install();
        if (this.adapters.relaunchApp) {
          await this.adapters.relaunchApp();
        } else {
          const { relaunch } = await import('@tauri-apps/plugin-process');
          await relaunch();
        }
        return;
      }

      if (this.state.updateStrategy === 'linux-package' && this.state.stagedPackagePath) {
        const res = this.adapters.installLinuxPackage
          ? await this.adapters.installLinuxPackage(this.state.stagedPackagePath)
          : await (
              await import('@tauri-apps/api/core')
            ).invoke<{ status: string; message: string }>('install_linux_package_and_relaunch', {
              filePath: this.state.stagedPackagePath,
            });

        if (res.status === 'cancelled' || res.status === 'fallback_opened') {
          this.state.status = 'ready_to_install';
          this.state.statusMessage = res.message;
          this.state.canRetryFallbackGui = res.status === 'cancelled';
          this.notify();
          return;
        }

        this.state.statusMessage = res.message;
        this.notify();
        return;
      }

      throw new Error('Paket pembaruan belum siap dipasang.');
    } catch (err: any) {
      console.error('[updateService] Gagal memasang pembaruan:', err);
      this.state.status = 'ready_to_install';
      this.state.errorMessage = err?.message || 'Gagal memasang pembaruan.';
      this.state.canRetryFallbackGui = this.state.updateStrategy === 'linux-package' && !!this.state.stagedPackagePath;
      this.notify();
    }
  }

  /**
   * Membuka berkas .rpm/.deb yang sudah diunduh menggunakan Software Center sistem (fallback GUI).
   */
  public async openStagedPackageWithSystemGui(): Promise<void> {
    if (!this.state.stagedPackagePath) return;
    try {
      if (this.adapters.openLinuxFallbackGui) {
        await this.adapters.openLinuxFallbackGui(this.state.stagedPackagePath);
      } else {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_local_installer_fallback', { filePath: this.state.stagedPackagePath });
      }
      this.state.statusMessage = 'Berkas installer dibuka di Software Center sistem.';
      this.notify();
    } catch (err: any) {
      this.state.errorMessage = err?.message || 'Gagal membuka installer di Software Center.';
      this.notify();
    }
  }
}

export const updateService = new UpdateService();
