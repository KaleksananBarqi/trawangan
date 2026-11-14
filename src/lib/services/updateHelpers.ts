// Utilitas murni (pure functions) dan kontrak tipe untuk subsistem pembaruan trawangan.

export type AssetKind = 'windows' | 'macos' | 'linux' | 'other';

export interface ReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
  kind: AssetKind;
}

export type InstallKind =
  | 'windows'
  | 'macos'
  | 'appimage'
  | 'rpm'
  | 'deb'
  | 'flatpak'
  | 'dev'
  | 'linux-unknown'
  | 'unknown';

export type UpdateStrategy = 'tauri-updater' | 'linux-package' | 'store-managed' | 'manual';

export interface InstallEnvironment {
  os: string;
  arch: string;
  installKind: InstallKind;
  recommendedLinuxFormat: string | null;
  packageManager: string | null;
  canInAppUpdate: boolean;
  isDev: boolean;
}

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number;
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

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready_to_install'
  | 'installing'
  | 'latest'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  installEnvironment: InstallEnvironment | null;
  updateStrategy: UpdateStrategy;
  downloadProgress: DownloadProgress | null;
  stagedPackagePath: string | null;
  dismissedVersion: string | null;
  lastChecked: Date | null;
  errorMessage: string | null;
  statusMessage: string | null;
  canRetryFallbackGui: boolean;
}

export interface UpdatePillContent {
  icon: 'download' | 'sparkles' | 'spin';
  label: string;
}

/**
 * Komparasi semantic versioning (SemVer): 1 jika v1 > v2, -1 jika v1 < v2, 0 jika sama.
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
 * Deteksi platform OS desktop aktif sebagai fallback saat runtime Tauri tidak tersedia.
 */
export function detectPlatform(): 'windows' | 'macos' | 'linux' {
  if (typeof window === 'undefined') return 'windows';
  const ua = window.navigator.userAgent.toLowerCase();
  const platform =
    (window.navigator as any)?.userAgentData?.platform?.toLowerCase() ||
    window.navigator.platform?.toLowerCase() ||
    '';

  if (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os')) {
    return 'macos';
  }
  if (platform.includes('linux') || ua.includes('linux') || ua.includes('x11')) {
    return 'linux';
  }
  return 'windows';
}

/**
 * Mengklasifikasikan nama file aset rilis GitHub ke kategori platform target.
 */
export function classifyAssetKind(name: string): AssetKind {
  if (name.endsWith('.exe') || name.endsWith('.msi')) return 'windows';
  if (name.endsWith('.dmg') || name.endsWith('.app.tar.gz')) return 'macos';
  if (name.endsWith('.AppImage') || name.endsWith('.deb') || name.endsWith('.rpm')) return 'linux';
  return 'other';
}

function matchesCpuArch(assetName: string, arch: string): boolean {
  const lower = assetName.toLowerCase();
  if (arch === 'aarch64' || arch === 'arm64') {
    return lower.includes('aarch64') || lower.includes('arm64');
  }
  return lower.includes('x86_64') || lower.includes('amd64') || lower.includes('x64');
}

/**
 * Memilih aset paling relevan dengan memperhatikan jenis instalasi Linux (.rpm / .deb / .AppImage) dan arsitektur CPU.
 */
export function selectMatchedAsset(
  assets: ReleaseAsset[],
  env: InstallEnvironment | null,
  fallbackOs: 'windows' | 'macos' | 'linux' = detectPlatform()
): ReleaseAsset | undefined {
  const targetOs =
    env?.os === 'windows' || env?.os === 'macos' || env?.os === 'linux' ? env.os : fallbackOs;
  const arch = env?.arch || 'x86_64';

  const findByExtension = (exts: string[]): ReleaseAsset | undefined => {
    for (const ext of exts) {
      const exactArch = assets.find((a) => a.name.endsWith(ext) && matchesCpuArch(a.name, arch));
      if (exactArch) return exactArch;
      const anyArch = assets.find((a) => a.name.endsWith(ext));
      if (anyArch) return anyArch;
    }
    return undefined;
  };

  if (targetOs === 'windows') {
    return findByExtension(['-setup.exe', '.exe', '.msi']) ?? assets.find((a) => a.kind === 'windows');
  }

  if (targetOs === 'macos') {
    return findByExtension(['.dmg', '.app.tar.gz']) ?? assets.find((a) => a.kind === 'macos');
  }

  const preferredLinux =
    env?.installKind === 'rpm' || env?.installKind === 'deb' || env?.installKind === 'appimage'
      ? env.installKind
      : env?.recommendedLinuxFormat;

  if (preferredLinux === 'rpm') {
    return findByExtension(['.rpm', '.AppImage', '.deb']) ?? assets.find((a) => a.kind === 'linux');
  }
  if (preferredLinux === 'deb') {
    return findByExtension(['.deb', '.AppImage', '.rpm']) ?? assets.find((a) => a.kind === 'linux');
  }
  return findByExtension(['.AppImage', '.rpm', '.deb']) ?? assets.find((a) => a.kind === 'linux');
}

/**
 * Menentukan strategi pembaruan berdasarkan hasil deteksi lingkungan dari backend Rust.
 */
export function resolveUpdateStrategy(env: InstallEnvironment | null): UpdateStrategy {
  if (!env) return 'manual';
  if (env.installKind === 'flatpak') return 'store-managed';
  if (!env.canInAppUpdate || env.isDev) return 'manual';
  if (env.installKind === 'windows' || env.installKind === 'macos' || env.installKind === 'appimage') {
    return 'tauri-updater';
  }
  if (env.installKind === 'rpm' || env.installKind === 'deb') {
    return 'linux-package';
  }
  return 'manual';
}

/**
 * Memeriksa apakah alur unduh/pasang sedang berlangsung agar pengecekan ulang tidak menimpa progres.
 */
export function isUpdateFlowActive(status: UpdateStatus): boolean {
  return status === 'downloading' || status === 'ready_to_install' || status === 'installing';
}

/**
 * Menentukan apakah notifikasi pill di Header / StatusBar perlu ditampilkan untuk versi baru.
 */
export function shouldShowUpdateBadge(
  state: Pick<UpdateState, 'status' | 'updateInfo' | 'dismissedVersion'>
): boolean {
  if (isUpdateFlowActive(state.status)) {
    return true;
  }
  if (state.status === 'available' && state.updateInfo) {
    return state.dismissedVersion !== state.updateInfo.latestVersion;
  }
  return false;
}

/**
 * Menyusun konten ikon dan teks untuk pill notifikasi di Header & StatusBar.
 */
export function getUpdatePillContent(
  state: Pick<UpdateState, 'status' | 'updateInfo' | 'downloadProgress'>
): UpdatePillContent {
  if (state.status === 'downloading') {
    return {
      icon: 'download',
      label: `Mengunduh ${Math.round(state.downloadProgress?.percent ?? 0)}%`,
    };
  }
  if (state.status === 'ready_to_install') {
    return { icon: 'sparkles', label: 'Siap Pasang' };
  }
  if (state.status === 'installing') {
    return { icon: 'spin', label: 'Memasang...' };
  }
  return {
    icon: 'sparkles',
    label: `Update ${state.updateInfo?.latestTag ?? ''}`.trim(),
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
