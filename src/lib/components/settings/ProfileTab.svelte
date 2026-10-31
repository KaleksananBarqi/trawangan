<script lang="ts">
  import {
    User,
    Upload,
    Trash2,
    ShieldCheck,
    AtSign,
    Sparkles,
    Image as ImageIcon
  } from '@lucide/svelte';
  import type { AppSettings, UserProfileConfig } from '../../types/market';

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  }

  let { settings, onUpdateSettings }: Props = $props();

  let fileInputRef: HTMLInputElement | null = null;
  let fileErrorMessage = $state<string | null>(null);

  // Akses nilai profil saat ini dengan fallback aman
  const currentProfile = $derived<UserProfileConfig>(
    settings.userProfile || {
      username: '',
      handle: '',
      avatarDataUrl: undefined,
    }
  );

  const initialLetter = $derived.by(() => {
    const name = currentProfile.username?.trim();
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : '';
  });

  const formattedHandlePreview = $derived.by(() => {
    const h = currentProfile.handle?.trim();
    if (!h) return '';
    return h.startsWith('@') ? h : `@${h}`;
  });

  function updateProfile(patch: Partial<UserProfileConfig>) {
    fileErrorMessage = null;
    const updated: UserProfileConfig = {
      username: currentProfile.username ?? '',
      handle: currentProfile.handle ?? '',
      avatarDataUrl: currentProfile.avatarDataUrl,
      ...patch,
    };
    onUpdateSettings({ userProfile: updated });
  }

  function handleTriggerUpload() {
    fileInputRef?.click();
  }

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // Batasan ukuran berkas avatar maksimal 2.5 MB untuk menjaga efisiensi localStorage
    if (file.size > 2.5 * 1024 * 1024) {
      fileErrorMessage = 'Ukuran citra terlalu besar (maksimal 2.5 MB). Silakan gunakan gambar yang lebih ringkas.';
      target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      fileErrorMessage = 'Format berkas tidak didukung. Harap pilih gambar (PNG, JPG, SVG, WebP).';
      target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        updateProfile({ avatarDataUrl: result });
      }
      target.value = '';
    };
    reader.onerror = () => {
      fileErrorMessage = 'Gagal membaca berkas gambar. Silakan coba lagi.';
      target.value = '';
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveAvatar() {
    updateProfile({ avatarDataUrl: undefined });
    if (fileInputRef) {
      fileInputRef.value = '';
    }
  }
</script>

<div class="section-group">
  <h4 class="section-title">Identitas Trader & Atribusi Snapshot</h4>
  <p class="section-subtitle">
    Konfigurasikan avatar dan nama pengguna yang disematkan pada Attribution Bar bingkai snapshot grafik.
    Seluruh data disimpan 100% lokal di browser Anda (*offline-first*) tanpa sinkronisasi cloud pihak ketiga.
  </p>

  <!-- Area Avatar Profil -->
  <div class="profile-card obsidian-box">
    <div class="avatar-container">
      {#if currentProfile.avatarDataUrl}
        <img
          src={currentProfile.avatarDataUrl}
          alt={currentProfile.username || 'Avatar Trader'}
          class="avatar-image"
        />
      {:else if initialLetter}
        <div class="avatar-initial-badge">
          <span>{initialLetter}</span>
        </div>
      {:else}
        <div class="avatar-placeholder">
          <User size={32} class="avatar-placeholder-icon" />
        </div>
      {/if}
    </div>

    <div class="avatar-actions">
      <div class="avatar-info-text">
        <span class="avatar-title">Foto Profil Trader</span>
        <span class="avatar-desc">Rekomendasi rasio 1:1 (persegi). Tampil bulat di Attribution Bar snapshot.</span>
      </div>

      <div class="action-buttons-row">
        <button
          type="button"
          class="btn-profile-action upload-btn"
          onclick={handleTriggerUpload}
          title="Unggah Foto Profil dari Komputer"
        >
          <Upload size={13} />
          <span>{currentProfile.avatarDataUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
        </button>

        {#if currentProfile.avatarDataUrl}
          <button
            type="button"
            class="btn-profile-action delete-btn"
            onclick={handleRemoveAvatar}
            title="Hapus Foto Profil"
          >
            <Trash2 size={13} />
            <span>Hapus</span>
          </button>
        {/if}

        <input
          type="file"
          bind:this={fileInputRef}
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onchange={handleFileChange}
          class="hidden-file-input"
          aria-hidden="true"
        />
      </div>

      {#if fileErrorMessage}
        <div class="error-banner">
          <span>{fileErrorMessage}</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Form Input Nama Pengguna & Social Handle -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Nama Pengguna (Trader / Brand)</span>
      <span class="setting-desc">Nama atau inisial yang tampil di Attribution Bar</span>
    </div>
    <div class="input-container">
      <input
        type="text"
        class="text-input"
        placeholder="misal: Satoshi Nakamoto"
        value={currentProfile.username}
        oninput={(e) => updateProfile({ username: e.currentTarget.value })}
        maxlength={32}
      />
    </div>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Social Media Handle</span>
      <span class="setting-desc">Akun X/Twitter, Telegram, atau channel publik Anda</span>
    </div>
    <div class="input-container">
      <div class="handle-input-wrapper">
        <span class="handle-prefix">@</span>
        <input
          type="text"
          class="text-input handle-field mono-nums"
          placeholder="nakamoto"
          value={currentProfile.handle?.replace(/^@/, '') ?? ''}
          oninput={(e) => {
            const raw = e.currentTarget.value.trim().replace(/^@/, '');
            updateProfile({ handle: raw ? `@${raw}` : '' });
          }}
          maxlength={30}
        />
      </div>
    </div>
  </div>

  <!-- Pratinjau Tampilan Atribusi Snapshot (Live Preview) -->
  <div class="preview-card-section">
    <div class="preview-section-header">
      <div class="preview-title-group">
        <Sparkles size={13} class="sparkle-icon" />
        <span class="preview-header-label">Pratinjau Attribution Bar Snapshot</span>
      </div>
      <span class="preview-badge-status">
        {currentProfile.username ? 'Personal Attribution Aktif' : 'Default trawangan Branding'}
      </span>
    </div>

    <div class="attribution-preview-bar">
      <!-- Sisi Kiri: Logo Resmi + Identitas Personal / Bawaan -->
      <div class="attribution-left">
        <!-- Logo Resmi Aplikasi -->
        <div class="app-logo-box">
          <img src="/static/logo.png" alt="trawangan" class="app-logo-img" onerror={(e) => {
            // Sembunyikan jika gambar belum terpasang di browser
            (e.currentTarget as HTMLElement).style.display = 'none';
          }} />
          <span class="app-logo-fallback"></span>
        </div>

        {#if currentProfile.username}
          <!-- Avatar Pengguna -->
          <div class="bar-avatar-wrap">
            {#if currentProfile.avatarDataUrl}
              <img
                src={currentProfile.avatarDataUrl}
                alt={currentProfile.username}
                class="bar-avatar-img"
              />
            {:else}
              <div class="bar-avatar-initial">
                <span>{initialLetter}</span>
              </div>
            {/if}
          </div>

          <!-- Nama Pengguna -->
          <span class="bar-username">{currentProfile.username}</span>

          <!-- Handle -->
          {#if formattedHandlePreview}
            <span class="bar-handle mono-nums">{formattedHandlePreview}</span>
          {/if}
        {:else}
          <!-- Fallback Brand Bawaan trawangan -->
          <span class="bar-brand-name">trawangan</span>
        {/if}

        <span class="bar-separator">·</span>

        <!-- Badge Pasangan Instrumen Mock -->
        <span class="bar-instrument mono-nums">BTCUSDT · 15m · BINANCE</span>
      </div>

      <!-- Sisi Kanan: Metadata Mock -->
      <div class="attribution-right">
        <span class="bar-price mono-nums">$67,420.50</span>
        <span class="bar-time mono-nums">31 Okt 2026, 12:00 WIB</span>
        <span class="bar-url mono-nums">kaleksananbarqi.github.io/trawangan</span>
      </div>
    </div>
  </div>
</div>

<style>
  .section-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #ffffff);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-subtitle {
    font-size: 11.5px;
    color: var(--text-muted, #a0a0a0);
    margin: -10px 0 4px 0;
    line-height: 1.5;
  }

  /* Profile Card Header Box */
  .profile-card {
    display: flex;
    align-items: center;
    gap: 18px;
    background-color: var(--bg-surface, #141414);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-sm, 6px);
    padding: 16px;
  }

  .avatar-container {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--bg-darkest, #0a0a0a);
    border: 2px solid var(--border-bright, rgba(255, 255, 255, 0.15));
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-initial-badge {
    width: 100%;
    height: 100%;
    background-color: #ff69b4;
    color: #0f0f0f;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 800;
    font-family: var(--font-sans, sans-serif);
    user-select: none;
  }

  .avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim, #666666);
  }

  .avatar-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .avatar-info-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .avatar-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main, #ffffff);
  }

  .avatar-desc {
    font-size: 11px;
    color: var(--text-muted, #8e8e8e);
  }

  .action-buttons-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .btn-profile-action {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.12));
    background-color: var(--bg-hover, #1f1f1f);
    color: var(--text-main, #ffffff);
  }

  .btn-profile-action.upload-btn:hover {
    background-color: rgba(255, 105, 180, 0.15);
    border-color: #ff69b4;
    color: #ff69b4;
  }

  .btn-profile-action.delete-btn {
    background-color: transparent;
    color: var(--text-dim, #777777);
  }

  .btn-profile-action.delete-btn:hover {
    background-color: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
    color: #ef4444;
  }

  .hidden-file-input {
    display: none;
  }

  .error-banner {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-xs, 4px);
    margin-top: 4px;
  }

  /* Setting Row Form Inputs */
  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background-color: var(--bg-surface, #141414);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.05));
    border-radius: var(--radius-xs, 4px);
    gap: 16px;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .setting-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main, #ffffff);
  }

  .setting-desc {
    font-size: 11px;
    color: var(--text-muted, #7e7e7e);
  }

  .input-container {
    width: 240px;
    flex-shrink: 0;
  }

  .text-input {
    width: 100%;
    background-color: var(--bg-darkest, #0c0c0c);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.1));
    color: var(--text-main, #ffffff);
    font-size: 11.5px;
    padding: 6px 10px;
    border-radius: var(--radius-xs, 4px);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }

  .text-input:focus {
    border-color: #ff69b4;
  }

  .handle-input-wrapper {
    display: flex;
    align-items: center;
    background-color: var(--bg-darkest, #0c0c0c);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-xs, 4px);
    padding: 0 0 0 10px;
    transition: border-color 0.15s ease;
  }

  .handle-input-wrapper:focus-within {
    border-color: #ff69b4;
  }

  .handle-prefix {
    color: var(--text-dim, #666666);
    font-family: var(--font-mono, monospace);
    font-size: 11.5px;
    font-weight: 600;
    user-select: none;
  }

  .handle-field {
    border: none;
    background: transparent;
    padding-left: 4px;
  }

  .handle-field:focus {
    border: none;
  }

  /* Live Preview Card */
  .preview-card-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
    background-color: var(--bg-darkest, #0c0c0c);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-sm, 6px);
    padding: 12px 14px;
  }

  .preview-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.05));
  }

  .preview-title-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sparkle-icon {
    color: #ff69b4;
  }

  .preview-header-label {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim, #777777);
  }

  .preview-badge-status {
    font-size: 10px;
    font-weight: 600;
    color: #ff69b4;
    background-color: rgba(255, 105, 180, 0.1);
    padding: 1px 6px;
    border-radius: 2px;
  }

  .attribution-preview-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #0f0f0f;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-xs, 4px);
    padding: 10px 14px;
    gap: 16px;
    overflow-x: auto;
  }

  .attribution-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .app-logo-box {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .app-logo-img {
    width: 22px;
    height: 22px;
    object-fit: contain;
  }

  .app-logo-fallback {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 5px;
    background: #ff69b4;
    z-index: -1;
  }

  .bar-avatar-wrap {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .bar-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bar-avatar-initial {
    width: 100%;
    height: 100%;
    background-color: #ff69b4;
    color: #0f0f0f;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
  }

  .bar-username {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
  }

  .bar-handle {
    font-size: 11px;
    color: #9e9e9e;
    white-space: nowrap;
  }

  .bar-brand-name {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
  }

  .bar-separator {
    color: rgba(255, 255, 255, 0.25);
    font-size: 11px;
  }

  .bar-instrument {
    font-size: 11px;
    color: #b0b0b0;
    font-weight: 500;
    white-space: nowrap;
  }

  .attribution-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .bar-price {
    font-size: 12px;
    font-weight: 700;
    color: #ffffff;
  }

  .bar-time {
    font-size: 11px;
    color: #9e9e9e;
  }

  .bar-url {
    font-size: 10px;
    color: #6e6e6e;
  }

  .mono-nums {
    font-family: var(--font-mono, monospace);
  }
</style>
