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
    ChevronDown,
    ShieldCheck
  } from '@lucide/svelte';
  import { openExternalUrl } from '../../services/urlService';
  import { updateService, formatBytes, type InstallKind, type UpdateState } from '../../services/updateService';
  import { t, tr } from '../../i18n';

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
      dev: $tr('Mode Oprek Dev', 'Mode Pengembangan', 'Development Mode'),
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
        <span class="about-version-badge mono-nums">v{updateState.currentVersion} · {$tr('Stabil Pol', 'Stabil', 'Stable')}</span>
        {#if envLabel}
          <span class="about-env-badge mono-nums" title={$tr('Paket sistem sing kedeteksi', 'Lingkungan paket terdeteksi', 'Detected package environment')}>{envLabel}</span>
        {/if}
      </div>
      <div class="about-javanese-tagline">
        <span class="javanese-script">ꦠꦿꦮꦔꦤ꧀</span>
        <span class="tagline-separator">·</span>
        <span class="tagline-text">{$t('about.tagline')}</span>
      </div>
      <p class="about-description">
        {$t('about.desc')}
      </p>

      <!-- Hero Action Buttons -->
      <div class="about-actions-row">
        <button
          type="button"
          class="btn-coffee-saweria"
          onclick={() => openExternalUrl('https://saweria.co/arthex1204')}
          title={$tr('Traktir kopi dev trawangan nang Saweria rek!', 'Dukung pengembangan trawangan di Saweria', 'Support trawangan development on Saweria')}
        >
          <Coffee size={14} class="saweria-coffee-icon" />
          <span>{$tr('Tukokno Kopi Cak (Saweria)', 'Belikan Saya Kopi (Saweria)', 'Buy Me a Coffee (Saweria)')}</span>
          <ExternalLink size={12} class="external-pill-icon" />
        </button>

        <button
          type="button"
          class="btn-check-update"
          onclick={handleCheckUpdate}
          disabled={isBusyUpdating}
          title={$tr('Cek ono update rilis anyar opo gak', 'Periksa ketersediaan versi rilis terbaru', 'Check for the latest release version')}
        >
          <RefreshCw size={13} class={updateState.status === 'checking' ? 'spin' : ''} />
          <span>{updateState.status === 'checking' ? $tr('Nggoleki...', 'Memeriksa...', 'Checking...') : $tr('Cek Update Anyar', 'Periksa Pembaruan', 'Check for Updates')}</span>
        </button>
      </div>

      <!-- Store-Managed Guard Banner (Selalu tampil pada build Flatpak/Store) -->
      {#if updateState.updateStrategy === 'store-managed'}
        <div class="update-feedback-banner info mono-nums">
          <Package size={14} />
          <span>{$tr('Aplikasi iki dipasang liwat Flatpak/Store. Update diurus langsung karo Software Center utawa', 'Aplikasi terpasang melalui Flatpak/Store. Pembaruan dikelola oleh Software Center atau', 'Installed via Flatpak/Store. Updates are managed by Software Center or')} <code>flatpak update</code>.</span>
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
              <span>{$tr('ONO UPDATE ANYAR REK!', 'PEMBARUAN BARU TERSEDIA', 'NEW UPDATE AVAILABLE')}</span>
            </div>
            <span class="update-tag mono-nums">{info.latestTag}</span>
          </div>

          <div class="update-card-body">
            <div class="version-comparison-row mono-nums">
              <div class="version-chip current">
                <span class="chip-label">{$tr('Saiki', 'Saat Ini', 'Current')}</span>
                <span class="chip-val">v{updateState.currentVersion}</span>
              </div>
              <span class="comparison-arrow">➔</span>
              <div class="version-chip latest">
                <span class="chip-label">{$tr('Versi Anyar', 'Rilis Baru', 'Latest')}</span>
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
                <span>{$tr('Catetan Oprekan Anyar', 'Catatan Pembaruan', 'Release Notes')} ({info.releaseName})</span>
              </div>
              <pre class="notes-content">{info.releaseNotes}</pre>
            </div>

            {#if updateState.updateStrategy === 'store-managed'}
              <div class="update-card-actions">
                <button
                  type="button"
                  class="btn-view-github"
                  onclick={() => openExternalUrl(info.releaseUrl)}
                  title={$tr('Bukak catetan rilis komplit nang GitHub', 'Buka catatan rilis lengkap di GitHub', 'View full release notes on GitHub')}
                >
                  <ExternalLink size={13} />
                  <span>{$tr('Delok Rilis nang GitHub', 'Lihat Catatan Rilis di GitHub', 'View Release Notes on GitHub')}</span>
                </button>
              </div>
            {:else if updateState.status === 'downloading'}
              <div class="update-progress-box mono-nums">
                <div class="progress-meta">
                  <span>{$tr('Ngundhuh', 'Mengunduh', 'Downloading')} {info.matchedAsset?.name ?? $tr('update', 'pembaruan', 'update')}...</span>
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
                    <span>{$tr('Masang Update...', 'Memasang Pembaruan...', 'Installing Update...')}</span>
                  {:else}
                    <RotateCcw size={14} />
                    <span>{$tr('Pasang & Restart Saiki', 'Pasang & Restart Sekarang', 'Install & Restart Now')}</span>
                  {/if}
                </button>

                {#if updateState.canRetryFallbackGui}
                  <button
                    type="button"
                    class="btn-view-github"
                    onclick={() => updateService.openStagedPackageWithSystemGui()}
                    title={$tr('Bukak file installer liwat Software Center sistem', 'Buka berkas installer lewat Software Center sistem', 'Open staged installer with system Software Center')}
                  >
                    <Package size={13} />
                    <span>{$tr('Bukak Software Center', 'Buka Software Center', 'Open Software Center')}</span>
                  </button>
                {/if}
              </div>
              {#if updateState.updateStrategy === 'linux-package' && updateState.status === 'ready_to_install'}
                <p class="update-hint-text">
                  {$tr('Bakal njedhul dialog password sistem gawe masang paket', 'Dialog autentikasi sistem akan muncul untuk memasang paket', 'A system authentication prompt will appear to install')} {info.matchedAsset?.name ?? 'Linux'}, {$tr('terus aplikasi langsung restart dewe.', 'lalu aplikasi akan dibuka ulang otomatis.', 'then the app will relaunch automatically.')}
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
                    title="{$tr('Undhuh lan verifikasi langsung nang jero aplikasi:', 'Unduh dan verifikasi langsung di dalam aplikasi:', 'Download and verify directly inside the app:')} {info.matchedAsset?.name ?? info.latestTag}"
                  >
                    <Download size={14} />
                    <span>{$tr('Undhuh & Pasang Update', 'Unduh & Pasang Pembaruan', 'Download & Install Update')}</span>
                  </button>
                {:else if info.matchedAsset}
                  <button
                    type="button"
                    class="btn-download-update"
                    onclick={() => openExternalUrl(info.matchedAsset!.browserDownloadUrl)}
                    title="{$tr('Undhuh file rilis:', 'Unduh file rilis:', 'Download release asset:')} {info.matchedAsset.name}"
                  >
                    <Download size={14} />
                    <span>{$tr('Undhuh', 'Unduh', 'Download')} {info.matchedAsset.name}</span>
                  </button>
                {:else}
                  <button
                    type="button"
                    class="btn-download-update"
                    onclick={() => openExternalUrl(info.releaseUrl)}
                    title={$tr('Bukak rilis lan undhuh installer resmi', 'Buka rilis dan unduh installer', 'Open release page and download installer')}
                  >
                    <Download size={14} />
                    <span>{$tr('Undhuh Installer Resmi', 'Unduh Installer Resmi', 'Download Official Installer')}</span>
                  </button>
                {/if}

                {#if !isDismissed}
                  <button
                    type="button"
                    class="btn-view-github"
                    onclick={() => updateService.dismissCurrentUpdate()}
                    title={$tr('Singidno titik notifikasi gawe versi iki', 'Sembunyikan lencana notifikasi untuk versi ini', 'Dismiss update badge for this version')}
                  >
                    <EyeOff size={13} />
                    <span>{$tr('Cuekno Versi Iki', 'Abaikan Versi Ini', 'Ignore This Version')}</span>
                  </button>
                {:else}
                  <button
                    type="button"
                    class="btn-view-github"
                    onclick={() => updateService.clearDismissedUpdate()}
                    title={$tr('Ketokno maneh lencana notifikasi versi iki', 'Tampilkan kembali lencana notifikasi versi ini', 'Show update badge again')}
                  >
                    <Sparkles size={13} />
                    <span>{$tr('Ketokno Notifikasi', 'Tampilkan Notifikasi', 'Show Notification')}</span>
                  </button>
                {/if}

                <button
                  type="button"
                  class="btn-view-github"
                  onclick={() => openExternalUrl(info.releaseUrl)}
                  title={$tr('Bukak catetan rilis nang GitHub', 'Buka catatan rilis lengkap di GitHub', 'Open full release notes on GitHub')}
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
                  <span>{$tr('Undhuh Format Liyane (Manual)', 'Unduh Format Lain (Manual)', 'Download Other Formats (Manual)')} · {info.assets.length} {$tr('paket', 'paket', 'packages')}</span>
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
                        <span class="asset-size">{asset.size > 0 ? `${formatBytes(asset.size)} ` : ''}↗</span>
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
          <span>✓ {$tr(`Sip! Koen wis nggawe versi paling anyar (v${updateState.currentVersion}). Mesin siap gaspol!`, `Anda sudah menggunakan versi rilis terbaru (v${updateState.currentVersion}). Sistem berada pada performa optimal.`, `You are running the latest release (v${updateState.currentVersion}). System is running at peak performance.`)}</span>
          {#if updateState.lastChecked}
            <span class="check-time">· {$tr('Dicek jam', 'Dicek pukul', 'Checked at')} {updateState.lastChecked.toLocaleTimeString('id-ID', { hour12: false })}</span>
          {/if}
        </div>
      {:else if updateState.status === 'error'}
        <div class="update-feedback-banner error mono-nums">
          <AlertCircle size={14} />
          <span>{updateState.errorMessage || $tr('Gagal nyambung nang server GitHub, Cok.', 'Gagal menghubungi server GitHub.', 'Failed to reach GitHub servers.')}</span>
        </div>
      {:else if updateState.status === 'checking'}
        <div class="update-feedback-banner info mono-nums">
          <RefreshCw size={13} class="spin" />
          <span>{$tr('Sik nggoleki info update teko server GitHub...', 'Memeriksa ketersediaan pembaruan dari server GitHub...', 'Checking GitHub servers for updates...')}</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Tech Specifications Grid -->
  <div class="section-group">
    <h4 class="section-title">{$tr('Jeroan Mesin & Arsitektur', 'Spesifikasi Engine & Arsitektur', 'Engine & Architecture Specs')}</h4>
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
        <span class="spec-key">{$tr('Database Lokal', 'Database Lokal', 'Local Database')}</span>
        <span class="spec-val">SQLite Local Embedded (rusqlite)</span>
      </div>
      <div class="spec-card">
        <span class="spec-key">{$tr('Lisensi Software', 'Lisensi Software', 'Software License')}</span>
        <span class="spec-val">Apache License 2.0 + NOTICE</span>
      </div>
    </div>
  </div>

  <!-- Mandatory Attribution & Apache 2.0 Notice Card -->
  <div class="section-group">
    <h4 class="section-title">{$t('about.licenseTitle')}</h4>
    <div class="notice-attribution-card">
      <div class="notice-header-row">
        <ShieldCheck size={15} class="text-cyan" />
        <strong>Apache-2.0 Mandatory Attribution Notice (Section 4d)</strong>
      </div>
      <p class="notice-body-text">
        {$t('about.licenseBody')}
      </p>
      <div class="notice-credit-box mono-nums">
        Based on trawangan (https://github.com/KaleksananBarqi/trawangan) · Created by Kaleksanan Barqi Aji Massani (@KaleksananBarqi / @arthex1204)
      </div>
    </div>
  </div>

  <!-- Community & Project Links -->
  <div class="section-group">
    <h4 class="section-title">{$tr('Link Resmi & Tongkrongan', 'Tautan Resmi & Komunitas', 'Official Links & Community')}</h4>
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
            <span class="link-card-sub">{$tr('Source code bukaan, diskusi & oprek bareng', 'Kode sumber terbuka, diskusi & kontribusi', 'Open-source code, discussions & contributions')}</span>
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
            <span class="link-card-title">{$tr('Catetan Rilis (Changelog)', 'Catatan Rilis (Changelog)', 'Release Notes (Changelog)')}</span>
            <span class="link-card-sub">{$tr('Riwayat versi, fitur anyar & tambalan bug', 'Riwayat versi, fitur baru & perbaikan bug', 'Version history, new features & bug fixes')}</span>
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
            <span class="link-card-title">{$tr('Traktir Kopi Saweria (@arthex1204)', 'Saweria Donasi (@arthex1204)', 'Saweria Tip Jar (@arthex1204)')}</span>
            <span class="link-card-sub">{$tr('Suntikan bensin kopi ben proyek iki tetep gaspol gratis!', 'Dukungan kopi pengembang untuk kelanjutan proyek', 'Support independent development with a coffee')}</span>
          </div>
        </div>
        <span class="link-arrow">↗</span>
      </button>
    </div>
  </div>

  <!-- Meta Footer -->
  <div class="about-footer-meta">
    <p>{$tr('trawangan · Digawe tenanan gawe arek-arek trader teknikal & analis mandiri sing wegah dipalak langganan.', 'trawangan · Dibuat dengan dedikasi untuk trader teknikal & analis independen.', 'trawangan · Crafted with dedication for independent technical traders & analysts.')}</p>
    <p class="meta-copyright">Copyright © 2026 Kaleksanan Barqi Aji Massani (@KaleksananBarqi / @arthex1204). Licensed under Apache-2.0 with Mandatory Attribution NOTICE.</p>
  </div>
</div>

<style>
  .notice-attribution-card {
    padding: 12px 14px;
    background: var(--bg-surface, #161b22);
    border: 1px solid rgba(56, 189, 248, 0.32);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .notice-header-row {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    color: var(--text-base, #ffffff);
  }

  .notice-body-text {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-dim, #8b949e);
  }

  .notice-credit-box {
    padding: 7px 10px;
    border-radius: 5px;
    background: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    font-size: 10.5px;
    color: var(--brand-primary, #FF69B4);
  }
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
