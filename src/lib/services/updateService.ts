import { APP_VERSION } from '../config/version';

export interface ReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
  kind: 'windows' | 'macos' | 'linux' | 'other';
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  latestTag: string;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  publishedAt: string;
  isUpdateAvailable: boolean;
  assets: ReleaseAsset[];
  matchedAsset?: ReleaseAsset;
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'latest' | 'error';
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  lastChecked: Date | null;
  errorMessage: string | null;
}

/**
 * Utilitas komparasi semantic versioning (SemVer).
 * Mengembalikan:
 *   1  jika v1 > v2
 *  -1  jika v1 < v2
 *   0  jika v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || '').replace(/^v/, '').trim();
  const clean2 = (v2 || '').replace(/^v/, '').trim();
  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const a = parts1[i] ?? 0;
    const b = parts2[i] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Deteksi platform OS desktop aktif untuk rekomendasi installer.
 */
export function detectPlatform(): 'windows' | 'macos' | 'linux' {
  if (typeof window === 'undefined') return 'windows';
  const ua = window.navigator.userAgent.toLowerCase();
  const platform = (window.navigator as any)?.userAgentData?.platform?.toLowerCase() || window.navigator.platform?.toLowerCase() || '';

  if (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os')) {
    return 'macos';
  }
  if (platform.includes('linux') || ua.includes('linux') || ua.includes('x11')) {
    return 'linux';
  }
  return 'windows';
}

class UpdateService {
  private state: UpdateState = {
    status: 'idle',
    currentVersion: APP_VERSION,
    updateInfo: null,
    lastChecked: null,
    errorMessage: null,
  };

  private listeners: Set<(state: UpdateState) => void> = new Set();
  private hasInitializedVersion = false;

  private cachedReleaseData: any = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.initCurrentVersion();
  }

  /**
   * Inisialisasi versi aktif dari runtime Tauri desktop jika tersedia.
   */
  private async initCurrentVersion(): Promise<void> {
    if (this.hasInitializedVersion) return;
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      const ver = await getVersion();
      if (ver) {
        this.state.currentVersion = ver;
        this.hasInitializedVersion = true;
        this.notify();
      }
    } catch {
      // Fallback ke APP_VERSION package.json
      this.state.currentVersion = APP_VERSION;
      this.hasInitializedVersion = true;
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
   * Memeriksa rilis terbaru dari repositori GitHub resmi Trawangan.
   */
  public async checkForUpdates(silent = false): Promise<UpdateState> {
    await this.initCurrentVersion();

    if (!silent) {
      this.state.status = 'checking';
      this.state.errorMessage = null;
      this.notify();
    }

    try {
      let data: any;
      const now = Date.now();

      if (this.cachedReleaseData && (now - this.lastFetchTime) < this.CACHE_TTL_MS) {
        data = this.cachedReleaseData;
      } else {
        const res = await fetch('https://api.github.com/repos/KaleksananBarqi/trawangan/releases/latest', {
          headers: { Accept: 'application/vnd.github.v3+json' },
        });

        if (!res.ok) {
          throw new Error(`Gagal mengambil data rilis (HTTP ${res.status})`);
        }

        data = await res.json();
        this.cachedReleaseData = data;
        this.lastFetchTime = now;
      }

      const latestTag = data.tag_name || 'v0.0.0';
      const latestVersion = latestTag.replace(/^v/, '');
      const currentVersion = this.state.currentVersion;

      const isUpdateAvailable = compareSemver(latestVersion, currentVersion) > 0;

      // Parsing daftar aset rilis
      const os = detectPlatform();
      const rawAssets = Array.isArray(data.assets) ? data.assets : [];
      const assets: ReleaseAsset[] = rawAssets.map((a: any) => {
        const name: string = a.name || '';
        let kind: ReleaseAsset['kind'] = 'other';
        if (name.endsWith('.exe') || name.endsWith('.msi')) kind = 'windows';
        else if (name.endsWith('.dmg') || name.endsWith('.app.tar.gz')) kind = 'macos';
        else if (name.endsWith('.AppImage') || name.endsWith('.deb')) kind = 'linux';

        return {
          name,
          browserDownloadUrl: a.browser_download_url,
          size: a.size || 0,
          kind,
        };
      });

      // Cari aset yang paling cocok untuk OS pengguna
      let matchedAsset = assets.find((a) => {
        if (os === 'windows') return a.name.endsWith('.exe');
        if (os === 'macos') return a.name.endsWith('.dmg');
        if (os === 'linux') return a.name.endsWith('.AppImage');
        return false;
      }) || assets.find((a) => a.kind === os);

      const updateInfo: UpdateInfo = {
        currentVersion,
        latestVersion,
        latestTag,
        releaseName: data.name || latestTag,
        releaseNotes: data.body || 'Tidak ada catatan rilis.',
        releaseUrl: data.html_url || 'https://github.com/KaleksananBarqi/trawangan/releases/latest',
        publishedAt: data.published_at ? new Date(data.published_at).toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) : '',
        isUpdateAvailable,
        assets,
        matchedAsset,
      };

      this.state.updateInfo = updateInfo;
      this.state.lastChecked = new Date();
      this.state.status = isUpdateAvailable ? 'available' : 'latest';
      this.state.errorMessage = null;
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
}

export const updateService = new UpdateService();
