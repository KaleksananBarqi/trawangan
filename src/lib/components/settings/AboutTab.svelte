<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    Coffee,
    RefreshCw,
    Sparkles,
    Info,
    Download,
    ExternalLink,
    Check,
    AlertCircle,
    Package,
    RotateCcw,
    EyeOff,
    ChevronDown
  } from '@lucide/svelte';
  import { openExternalUrl } from '../../services/urlService';
  import { updateService, formatBytes, type InstallKind, type UpdateState } from '../../services/updateService';

  let updateState = $state<UpdateState>(updateService.getSnapshot());
  let unsubUpdate: (() => void) | null = null;
  let showManualAssets = $state(false);

  const envLabel = $derived.by(() => {
    const env = updateState.installEnvironment;
    if (!env) return null;
    const kindMap: Record<InstallKind, string> = {
      rpm: 'Linux · RPM',
      deb: 'Linux · DEB',
      appimage: 'Linux · AppImage',
      flatpak: 'Linux · Flatpak (Store)',
      windows: 'Windows',
      macos: 'macOS',
      dev: 'Mode Pengembangan',
      'linux-unknown': 'Linux',
      unknown: env.os,
    };
    const base = kindMap[env.installKind] ?? env.os;
    return `${base} (${env.arch})`;
  });

  const isUpdateCardVisible = $derived(
    Boolean(
      updateState.updateInfo?.isUpdateAvailable &&
        (updateState.status === 'available' ||
          updateState.status === 'downloading' ||
          updateState.status === 'ready_to_install' ||
          updateState.status === 'installing' ||
          updateState.status === 'error')
    )
  );

  const isBusyUpdating = $derived(
    updateState.status === 'checking' ||
      updateState.status === 'downloading' ||
      updateState.status === 'installing'
  );

  onMount(() => {
    updateService.init();
    unsubUpdate = updateService.subscribe((s) => {
      updateState = s;
    });
  });

  onDestroy(() => {
    if (unsubUpdate) {
      unsubUpdate();
      unsubUpdate = null;
    }
  });

  async function handleCheckUpdate() {
    await updateService.checkForUpdates(false);
  }
</script>

<div class="about-pane">
  <!-- Hero Brand Showcase Card -->
  <div class="about-hero-card">
    <div class="about-logo-frame">
      <img src="/logo-icon.svg" alt="trawangan logo" class="about-logo-img" />
    </div>
    <div class="about-hero-details">
      <div class="about-title-row">
        <h3 class="about-app-name">trawangan</h3>
        <span class="about-version-badge mono-nums">v{updateState.currentVersion} · Stabil</span>
        {#if envLabel}
          <span class="about-env-badge mono-nums" title="Lingkungan paket terdeteksi">{envLabel}</span>
        {/if}
      </div>
      <div class="about-javanese-tagline">
        <span class="javanese-script">ꦠꦿꦮꦔꦤ꧀</span>
        <span class="tagline-separator">·</span>
        <span class="tagline-text">Visi Menembus Kabut Manipulasi Pasar</span>
      </div>
      <p class="about-description">
        Terminal charting kripto desktop ultra-ringan bertenaga WebGL2 Vela Engine dan runtime Pine Script v6. Didesain khusus untuk analisa teknikal grafis dan pengujian strategi kuantitatif independen: nol eksekusi order broker komersial, bebas distorsi, latensi ultra-rendah, dan integritas privasi database lokal.
      </p>

      <!-- Hero Action Buttons -->
      <div class="about-actions-row">
        <button
          type="button"
          class="btn-coffee-saweria"
          onclick={() => openExternalUrl('https://saweria.co/arthex1204')}
          title="Dukung pengembangan trawangan di Saweria"
        >
          <Coffee size={14} class="saweria-coffee-icon" />
          <span>Belikan Saya Kopi (Saweria)</span>
          <ExternalLink size={12} class="external-pill-icon" />
        </button>

        <button
          type="button"
          class="btn-check-update"
          onclick={handleCheckUpdate}
          disabled={isBusyUpdating}
          title="Periksa ketersediaan versi rilis terbaru"
        >
          <RefreshCw size={13} class={updateState.status === 'checking' ? 'spin' : ''} />
          <span>{updateState.status === 'checking' ? 'Memeriksa...' : 'Periksa Pembaruan'}</span>
        </button>
      </div>

      <!-- Store-Managed Guard Banner (Selalu tampil pada build Flatpak/Store) -->
      {#if updateState.updateStrategy === 'store-managed'}
        <div class="update-feedback-banner info mono-nums">
          <Package size={14} />
          <span>Aplikasi terpasang melalui Flatpak/Store. Pembaruan dikelola oleh Software Center atau <code>flatpak update</code>.</span>
        </div>
      {/if}

      <!-- Dynamic Update Card Showcase -->
      {#if isUpdateCardVisible && updateState.updateInfo}
        {@const info = updateState.updateInfo}
        {@const isDismissed = updateState.dismissedVersion === info.latestVersion}
        <div class="update-card-featured glassmorphism">
          <div class="update-card-header">
            <div class="update-badge-glow">
              <Sparkles size={14} class="sparkle-icon" />
              <span>PEMBARUAN BARU TERSEDIA</span>
            </div>
            <span class="update-tag mono-nums">{info.latestTag}</span>
          </div>

          <div class="update-card-body">
            <div class="version-comparison-row mono-nums">
              <div class="version-chip current">
                <span class="chip-label">Saat Ini</span>
                <span class="chip-val">v{updateState.currentVersion}</span>
              </div>
              <span class="comparison-arrow">➔</span>
              <div class="version-chip latest">
                <span class="chip-label">Rilis Baru</span>
                <span class="chip-val">{info.latestTag}</span>
              </div>
              {#if info.publishedAt}
                <span class="published-date">({info.publishedAt})</span>
              {/if}
            </div>

            <!-- Release Notes Summary Container -->
            <div class="release-notes-box">
              <div class="notes-header">
                <Info size={13} />
                <span>Catatan Pembaruan ({info.releaseName})</span>
              </div>
              <pre class="notes-content">{info.releaseNotes}</pre>
            </div>

            {#if updateState.updateStrategy === 'store-managed'}
              <div class="update-card-actions">
                <button
                  type="button"
                  class="btn-view-github"
                  onclick={() => openExternalUrl(info.releaseUrl)}
                  title="Buka catatan rilis lengkap di GitHub"
                >
                  <ExternalLink size={13} />
                  <span>Lihat Catatan Rilis di GitHub</span>
                </button>
              </div>
            {:else if updateState.status === 'downloading'}
              <div class="update-progress-box mono-nums">
                <div class="progress-meta">
                  <span>Mengunduh {info.matchedAsset?.name ?? 'pembaruan'}...</span>
                  <span>
                    {Math.round(updateState.downloadProgress?.percent ?? 0)}%
                    {#if updateState.downloadProgress?.totalBytes}
                      · {formatBytes(updateState.downloadProgress.downloadedBytes)} / {formatBytes(updateState.downloadProgress.totalBytes)}
                    {/if}
                  </span>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    style="width: {Math.min(100, Math.max(0, updateState.downloadProgress?.percent ?? 0))}%"
                  ></div>
                </div>
              </div>
            {:else if updateState.status === 'ready_to_install' || updateState.status === 'installing'}
              {#if updateState.statusMessage}
                <div class="update-feedback-banner info mono-nums">
                  <Info size={13} />
                  <span>{updateState.statusMessage}</span>
                </div>
              {/if}
              <div class="update-card-actions">
                <button
                  type="button"
                  class="btn-download-update"
                  disabled={updateState.status === 'installing'}
                  onclick={() => updateService.installAndRelaunch()}
                >
                  {#if updateState.status === 'installing'}
                    <RefreshCw size={14} class="spin" />
                    <span>Memasang Pembaruan...</span>
                  {:else}
                    <RotateCcw size={14} />
                    <span>Pasang & Restart Sekarang</span>
                  {/if}
                </button>

                {#if updateState.canRetryFallbackGui}
                  <button
                    type="button"
                    class="btn-view-github"
                    onclick={() => updateService.openStagedPackageWithSystemGui()}
                    title="Buka berkas installer lewat Software Center sistem"
                  >
                    <Package size={13} />
                    <span>Buka Software Center</span>
                  </button>
                {/if}
              </div>
              {#if updateState.updateStrategy === 'linux-package' && updateState.status === 'ready_to_install'}
                <p class="update-hint-text">
                  Dialog autentikasi sistem akan muncul untuk memasang paket {info.matchedAsset?.name ?? 'Linux'}, lalu aplikasi akan dibuka ulang otomatis.
                </p>
              {/if}
            {:else}
              <!-- Status available / error -->
              <div class="update-card-actions">
                {#if updateState.updateStrategy === 'tauri-updater' || updateState.updateStrategy === 'linux-package'}
                  <button
                    type="button"
                    class="btn-download-update"
                    onclick={() => updateService.downloadUpdate()}
                    title="Unduh dan verifikasi {info.matchedAsset?.name ?? info.latestTag} langsung di dalam aplikasi"
                  >
                    <Download size={14} />
                    <span>Unduh & Pasang Pembaruan</span>
                  </button>
                {:else if info.matchedAsset}
                  <button
                    type="button"
                    class="btn-download-update"
                    onclick={() => openExternalUrl(info.matchedAsset!.browserDownloadUrl)}
                    title="Unduh file rilis: {info.matchedAsset.name}"
                  >
                    <Download size={14} />
                    <span>Unduh {info.matchedAsset.name}</span>
                  </button>
                {:else}
                  <button
                    type="button"
                    class="btn-download-update"
                    onclick={() => openExternalUrl(info.releaseUrl)}
                    title="Buka rilis dan unduh installer"
                  >
                    <Download size={14} />
                    <span>Unduh Installer Resmi</span>
                  </button>
                {/if}

                {#if !isDismissed}
                  <button
                    type="button"
                    class="btn-view-github"
                    onclick={() => updateService.dismissCurrentUpdate()}
                    title="Sembunyikan lencana notifikasi untuk versi ini"
                  >
                    <EyeOff size={13} />
                    <span>Abaikan Versi Ini</span>
                  </button>
                {:else}
                  <button
                    type="button"
                    class="btn-view-github"
                    onclick={() => updateService.clearDismissedUpdate()}
                    title="Tampilkan kembali lencana notifikasi versi ini"
                  >
                    <Sparkles size={13} />
                    <span>Tampilkan Notifikasi</span>
                  </button>
                {/if}

                <button
                  type="button"
                  class="btn-view-github"
                  onclick={() => openExternalUrl(info.releaseUrl)}
                  title="Buka catatan rilis lengkap di GitHub"
                >
                  <ExternalLink size={13} />
                  <span>GitHub</span>
                </button>
              </div>
            {/if}

            {#if updateState.errorMessage}
              <div class="update-feedback-banner error mono-nums">
                <AlertCircle size={14} />
                <span>{updateState.errorMessage}</span>
              </div>
            {/if}

            {#if info.assets.length > 0}
              <div class="manual-assets-drawer">
                <button
                  type="button"
                  class="manual-assets-toggle"
                  onclick={() => (showManualAssets = !showManualAssets)}
                >
                  <span>Unduh Format Lain (Manual) · {info.assets.length} paket</span>
                  <ChevronDown size={13} class={showManualAssets ? 'rotated' : ''} />
                </button>
                {#if showManualAssets}
                  <div class="manual-assets-list mono-nums">
                    {#each info.assets as asset}
                      <button
                        type="button"
                        class="manual-asset-row {info.matchedAsset?.name === asset.name ? 'matched' : ''}"
                        onclick={() => openExternalUrl(asset.browserDownloadUrl)}
                      >
                        <span class="asset-name">{asset.name}</span>
                        <span class="asset-size">{formatBytes(asset.size)} ↗</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {:else if updateState.status === 'latest'}
        <div class="update-feedback-banner success mono-nums">
          <Check size={14} />
          <span>✓ Anda sudah menggunakan versi rilis terbaru (v{updateState.currentVersion}). Sistem berada pada performa optimal.</span>
          {#if updateState.lastChecked}
            <span class="check-time">· Dicek pukul {updateState.lastChecked.toLocaleTimeString('id-ID', { hour12: false })}</span>
          {/if}
        </div>
      {:else if updateState.status === 'error'}
        <div class="update-feedback-banner error mono-nums">
          <AlertCircle size={14} />
          <span>{updateState.errorMessage || 'Gagal menghubungi server GitHub.'}</span>
        </div>
      {:else if updateState.status === 'checking'}
        <div class="update-feedback-banner info mono-nums">
          <RefreshCw size={13} class="spin" />
          <span>Memeriksa ketersediaan pembaruan dari server GitHub...</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Tech Specifications Grid -->
  <div class="section-group">
    <h4 class="section-title">Spesifikasi Engine & Arsitektur</h4>
    <div class="specs-grid">
      <div class="spec-card">
        <span class="spec-key">Core Charting Engine</span>
        <span class="spec-val">LuxAlgo Vela (WebGL2 Native Canvas)</span>
      </div>
      <div class="spec-card">
        <span class="spec-key">Scripting Runtime</span>
        <span class="spec-val">Pine Script v6 (PineTS AST Engine)</span>
      </div>
      <div class="spec-card">
        <span class="spec-key">Desktop Shell Host</span>
        <span class="spec-val">Tauri v2 + Rust Native x64</span>
      </div>
      <div class="spec-card">
        <span class="spec-key">User Interface</span>
        <span class="spec-val">Svelte 5 + Vite (Zero Run-Time VDOM)</span>
      </div>
      <div class="spec-card">
        <span class="spec-key">Database Lokal</span>
        <span class="spec-val">SQLite Local Embedded (rusqlite)</span>
      </div>
      <div class="spec-card">
        <span class="spec-key">Lisensi Software</span>
        <span class="spec-val">MIT Open Source License</span>
      </div>
    </div>
  </div>

  <!-- Community & Project Links -->
  <div class="section-group">
    <h4 class="section-title">Tautan Resmi & Komunitas</h4>
    <div class="about-links-grid">
      <button
        type="button"
        class="about-link-card"
        onclick={() => openExternalUrl('https://github.com/KaleksananBarqi/trawangan')}
      >
        <div class="link-card-left">
          <ExternalLink size={14} class="text-cyan" />
          <div class="link-card-text">
            <span class="link-card-title">GitHub Repository</span>
            <span class="link-card-sub">Kode sumber terbuka, diskusi & kontribusi</span>
          </div>
        </div>
        <span class="link-arrow">↗</span>
      </button>

      <button
        type="button"
        class="about-link-card"
        onclick={() => openExternalUrl('https://github.com/KaleksananBarqi/trawangan/releases')}
      >
        <div class="link-card-left">
          <RefreshCw size={14} class="text-bull" />
          <div class="link-card-text">
            <span class="link-card-title">Catatan Rilis (Changelog)</span>
            <span class="link-card-sub">Riwayat versi, fitur baru & perbaikan bug</span>
          </div>
        </div>
        <span class="link-arrow">↗</span>
      </button>

      <button
        type="button"
        class="about-link-card coffee-variant"
        onclick={() => openExternalUrl('https://saweria.co/arthex1204')}
      >
        <div class="link-card-left">
          <Coffee size={14} class="text-amber" />
          <div class="link-card-text">
            <span class="link-card-title">Saweria Donasi (@arthex1204)</span>
            <span class="link-card-sub">Dukungan kopi pengembang untuk kelanjutan proyek</span>
          </div>
        </div>
        <span class="link-arrow">↗</span>
      </button>
    </div>
  </div>

  <!-- Meta Footer -->
  <div class="about-footer-meta">
    <p>trawangan · Dibuat dengan dedikasi untuk trader teknikal & analis independen.</p>
    <p class="meta-copyright">Copyright © 2026 KaleksananBarqi / arthex1204. All rights reserved.</p>
  </div>
</div>

<style>
  .about-pane {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .about-hero-card {
    display: flex;
    gap: 16px;
    padding: 16px;
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 8px;
  }

  .about-logo-frame {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }

  .about-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .about-hero-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .about-title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .about-app-name {
    font-size: 18px;
    font-weight: 800;
    margin: 0;
    color: var(--text-base, #ffffff);
  }

  .about-version-badge {
    font-size: 11px;
    padding: 2px 8px;
    background: rgba(88, 166, 255, 0.15);
    color: #58a6ff;
    border-radius: 12px;
    border: 1px solid rgba(88, 166, 255, 0.3);
  }

  .about-env-badge {
    font-size: 10px;
    padding: 2px 8px;
    background: rgba(63, 185, 80, 0.12);
    color: #3fb950;
    border-radius: 12px;
    border: 1px solid rgba(63, 185, 80, 0.3);
  }

  .about-javanese-tagline {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-dim, #6e7681);
  }

  .javanese-script {
    font-size: 13px;
    color: #f59e0b;
  }

  .about-description {
    font-size: 11px;
    color: var(--text-dim, #8b949e);
    line-height: 1.45;
    margin: 0;
  }

  .about-actions-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .btn-coffee-saweria,
  .btn-check-update {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-coffee-saweria {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #f59e0b;
  }

  .btn-coffee-saweria:hover {
    background: rgba(245, 158, 11, 0.2);
  }

  .btn-check-update {
    background: var(--bg-hover, #21262d);
    border: 1px solid var(--border-subtle, #30363d);
    color: var(--text-base, #ffffff);
  }

  .btn-check-update:hover {
    border-color: var(--border-focus, #58a6ff);
  }

  .update-card-featured {
    background: rgba(22, 27, 34, 0.8);
    border: 1px solid #58a6ff;
    border-radius: 6px;
    padding: 12px;
    margin-top: 8px;
  }

  .update-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .update-badge-glow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    color: #58a6ff;
  }

  .update-tag {
    font-size: 11px;
    font-weight: 700;
    color: #3fb950;
  }

  .version-comparison-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    margin-bottom: 8px;
  }

  .version-chip {
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--bg-subtle, #0d1117);
  }

  .release-notes-box {
    background: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
  }

  .notes-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--text-dim, #6e7681);
    margin-bottom: 4px;
  }

  .notes-content {
    font-size: 10px;
    color: var(--text-base, #ffffff);
    white-space: pre-wrap;
    margin: 0;
    max-height: 120px;
    overflow-y: auto;
  }

  .update-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .btn-download-update,
  .btn-view-github {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-download-update {
    background: #238636;
    border: 1px solid #2ea043;
    color: #ffffff;
  }

  .btn-download-update:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .btn-view-github {
    background: var(--bg-hover, #21262d);
    border: 1px solid var(--border-subtle, #30363d);
    color: var(--text-base, #ffffff);
  }

  .update-progress-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    background: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-base, #ffffff);
  }

  .progress-track {
    width: 100%;
    height: 6px;
    background: rgba(88, 166, 255, 0.15);
    border-radius: 999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #2ea043, #58a6ff);
    transition: width 0.15s ease;
  }

  .update-hint-text {
    font-size: 10px;
    color: var(--text-dim, #8b949e);
    margin: 6px 0 0 0;
  }

  .manual-assets-drawer {
    margin-top: 10px;
    border-top: 1px solid var(--border-subtle, #30363d);
    padding-top: 8px;
  }

  .manual-assets-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: transparent;
    border: none;
    color: var(--text-dim, #8b949e);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 0;
  }

  .manual-assets-toggle:hover {
    color: var(--text-base, #ffffff);
  }

  .manual-assets-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .manual-asset-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    background: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
    color: var(--text-base, #ffffff);
    font-size: 10px;
    cursor: pointer;
    text-align: left;
  }

  .manual-asset-row:hover {
    border-color: #58a6ff;
  }

  .manual-asset-row.matched {
    border-color: rgba(63, 185, 80, 0.5);
  }

  .asset-size {
    color: var(--text-dim, #8b949e);
  }

  :global(.rotated) {
    transform: rotate(180deg);
    transition: transform 0.15s ease;
  }

  .update-feedback-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    padding: 8px 12px;
    border-radius: 4px;
    margin-top: 4px;
  }

  .update-feedback-banner.success {
    background: rgba(63, 185, 80, 0.1);
    color: #3fb950;
    border: 1px solid rgba(63, 185, 80, 0.3);
  }

  .update-feedback-banner.error {
    background: rgba(248, 81, 73, 0.1);
    color: #f85149;
    border: 1px solid rgba(248, 81, 73, 0.3);
  }

  .update-feedback-banner.info {
    background: rgba(88, 166, 255, 0.1);
    color: #58a6ff;
    border: 1px solid rgba(88, 166, 255, 0.3);
  }

  .section-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .specs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .spec-card {
    padding: 8px 12px;
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .spec-key {
    font-size: 10px;
    color: var(--text-dim, #6e7681);
  }

  .spec-val {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-base, #ffffff);
  }

  .about-links-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }

  .about-link-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .about-link-card:hover {
    border-color: var(--border-focus, #58a6ff);
    background: var(--bg-hover, #21262d);
  }

  .link-card-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .link-card-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .link-card-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-base, #ffffff);
  }

  .link-card-sub {
    font-size: 10px;
    color: var(--text-dim, #6e7681);
  }

  .link-arrow {
    color: var(--text-dim, #6e7681);
    font-size: 12px;
  }

  .about-footer-meta {
    text-align: center;
    font-size: 10px;
    color: var(--text-dim, #6e7681);
    padding: 16px 0 8px 0;
    border-top: 1px solid var(--border-subtle, #30363d);
  }

  .about-footer-meta p {
    margin: 2px 0;
  }

  .text-cyan { color: #38bdf8; }
  .text-bull { color: #3fb950; }
  .text-amber { color: #f59e0b; }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
