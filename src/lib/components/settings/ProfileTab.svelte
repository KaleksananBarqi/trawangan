<script lang="ts">
  import {
    User,
    Upload,
    Trash2,
    ShieldCheck,
    AtSign,
    Sparkles,
    Camera,
    Image as ImageIcon
  } from '@lucide/svelte';
  import type { AppSettings, UserProfileConfig, SecurityWatermarkConfig, SnapshotScaleMultiplier } from '../../types/market';
  import { resolveSecurityWatermarkText } from '../../services/chartSnapshotService';

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
      bio: '',
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

  // Akses konfigurasi tanda air keamanan dengan fallback aman (#127)
  const currentWatermark = $derived<SecurityWatermarkConfig>(
    settings.securityWatermark || {
      enabled: false,
      text: '',
      opacity: 0.10,
      showOnLiveCanvas: false,
    }
  );

  function updateWatermark(patch: Partial<SecurityWatermarkConfig>) {
    const updated: SecurityWatermarkConfig = {
      enabled: currentWatermark.enabled,
      text: currentWatermark.text ?? '',
      opacity: currentWatermark.opacity ?? 0.10,
      showOnLiveCanvas: currentWatermark.showOnLiveCanvas ?? false,
      ...patch,
    };
    onUpdateSettings({ securityWatermark: updated });
  }

  // Teks watermark yang efektif untuk pratinjau langsung
  const effectiveWatermarkText = $derived.by(() => {
    return resolveSecurityWatermarkText(currentWatermark, currentProfile);
  });

  // Placeholder informatif dinamis berdasarkan identitas profil saat ini
  const watermarkPlaceholder = $derived.by(() => {
    const u = currentProfile.username?.trim();
    const h = currentProfile.handle?.trim();
    if (u && h) {
      return `${u} · ${h.startsWith('@') ? h : '@' + h}`;
    }
    if (u) return u;
    if (h) return h.startsWith('@') ? h : `@${h}`;
    return 'misal: Satoshi Nakamoto · @nakamoto';
  });

  // Opsi pilihan multiplier skala resolusi bawaan (#124, #125)
  const scaleMultiplierOptions: Array<{ value: SnapshotScaleMultiplier; label: string; desc: string }> = [
    { value: 1, label: '1x', desc: 'Standar' },
    { value: 2, label: '2x (HiDPI)', desc: 'HiDPI Retina' },
    { value: 4, label: '4x (4K)', desc: 'Ultra HD 4K' },
    { value: 6, label: '6x (Super HD)', desc: 'Super HD 6K' },
  ];

  // Preferensi snapshot turunan dengan fallback bawaan
  const currentScaleMultiplier = $derived<SnapshotScaleMultiplier>(settings.snapshotScaleMultiplier ?? 2);
  const currentIncludeFrame = $derived<boolean>(settings.snapshotIncludeFrame !== false);
  const currentIncludePrice = $derived<boolean>(settings.snapshotIncludePrice !== false);
  const currentIncludeTimestamp = $derived<boolean>(settings.snapshotIncludeTimestamp !== false);

  function updateProfile(patch: Partial<UserProfileConfig>) {
    fileErrorMessage = null;
    const updated: UserProfileConfig = {
      username: currentProfile.username ?? '',
      handle: currentProfile.handle ?? '',
      bio: currentProfile.bio ?? '',
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

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Deskripsi Singkat / Bio Trader</span>
      <span class="setting-desc">Status, keahlian, atau deskripsi singkat profil Anda</span>
    </div>
    <div class="input-container">
      <input
        type="text"
        class="text-input"
        placeholder="misal: Crypto Analyst & Swing Trader"
        value={currentProfile.bio ?? ''}
        oninput={(e) => updateProfile({ bio: e.currentTarget.value })}
        maxlength={40}
      />
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
        {currentProfile.username || currentProfile.handle || currentProfile.avatarDataUrl ? 'Personal Attribution Aktif' : 'Default trawangan Branding'}
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

        {#if currentProfile.username || currentProfile.handle || currentProfile.avatarDataUrl}
          <!-- Avatar Pengguna -->
          <div class="bar-avatar-wrap">
            {#if currentProfile.avatarDataUrl}
              <img
                src={currentProfile.avatarDataUrl}
                alt={currentProfile.username || 'Avatar'}
                class="bar-avatar-img"
              />
            {:else}
              <div class="bar-avatar-initial">
                <span>{initialLetter || 'T'}</span>
              </div>
            {/if}
          </div>

          <!-- Nama Pengguna -->
          <span class="bar-username">{currentProfile.username || (formattedHandlePreview ? formattedHandlePreview : 'Trader')}</span>

          <!-- Handle -->
          {#if currentProfile.username && formattedHandlePreview}
            <span class="bar-handle mono-nums">{formattedHandlePreview}</span>
          {/if}

          <!-- Bio / Deskripsi -->
          {#if currentProfile.bio}
            <span class="bar-bio italic">({currentProfile.bio})</span>
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

  <div class="section-divider"></div>

  <!-- Seksi Watermark Keamanan Anti-Pencurian (#127) -->
  <div class="watermark-header-group">
    <div class="header-with-badge">
      <h4 class="section-title">Watermark Keamanan (Anti-Theft)</h4>
      <span class="anti-theft-tag mono-nums">
        <ShieldCheck size={11} />
        ANTI-THEFT
      </span>
    </div>
    <p class="section-subtitle">
      Sematkan tanda air diagonal semi-transparan pada kanvas snapshot untuk melindungi karya analisis teknis Anda dari pembajakan tanpa atribusi.
    </p>
  </div>

  <!-- 1. Toggle Switch Aktifkan Watermark Keamanan -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Aktifkan Watermark Keamanan</span>
      <span class="setting-desc">Sematkan tanda air diagonal pada snapshot dan tangkapan layar grafik</span>
    </div>
    <button
      type="button"
      class="toggle-btn {currentWatermark.enabled ? 'active' : ''}"
      onclick={() => updateWatermark({ enabled: !currentWatermark.enabled })}
      aria-pressed={currentWatermark.enabled}
    >
      <span class="toggle-dot"></span>
      <span>{currentWatermark.enabled ? 'Aktif' : 'Nonaktif'}</span>
    </button>
  </div>

  <!-- 2. Input Field Teks Kustom -->
  <div class="setting-row {currentWatermark.enabled ? '' : 'is-disabled'}">
    <div class="setting-info">
      <span class="setting-label">Teks Watermark Kustom</span>
      <span class="setting-desc">Kosongkan untuk otomatis menggunakan nama pengguna & handle profil</span>
    </div>
    <div class="input-container">
      <input
        type="text"
        class="text-input"
        placeholder={watermarkPlaceholder}
        value={currentWatermark.text ?? ''}
        oninput={(e) => updateWatermark({ text: e.currentTarget.value })}
        disabled={!currentWatermark.enabled}
        maxlength={64}
      />
    </div>
  </div>

  <!-- 3. Slider Opasitas (5% - 30%, step 1%, default 10%) -->
  <div class="setting-row {currentWatermark.enabled ? '' : 'is-disabled'}">
    <div class="setting-info">
      <div class="label-with-badge">
        <span class="setting-label">Opasitas Tanda Air</span>
        <span class="opacity-pill mono-nums">
          {Math.round((currentWatermark.opacity ?? 0.10) * 100)}%
        </span>
      </div>
      <span class="setting-desc">Atur tingkat transparansi (5% sangat samar hingga 30% tegas)</span>
    </div>
    <div class="slider-container">
      <input
        type="range"
        class="opacity-range-slider"
        min="0.05"
        max="0.30"
        step="0.01"
        value={currentWatermark.opacity ?? 0.10}
        disabled={!currentWatermark.enabled}
        oninput={(e) => updateWatermark({ opacity: parseFloat(e.currentTarget.value) })}
      />
      <div class="slider-ticks mono-nums">
        <span>5% (Samar)</span>
        <span>10% (Bawaan)</span>
        <span>30% (Tegas)</span>
      </div>
    </div>
  </div>

  <!-- 4. Toggle Switch Tampilkan di Kanvas Kerja Aktif -->
  <div class="setting-row {currentWatermark.enabled ? '' : 'is-disabled'}">
    <div class="setting-info">
      <span class="setting-label">Tampilkan di Kanvas Kerja Aktif</span>
      <span class="setting-desc">Munculkan tanda air langsung di kanvas kerja grafik (cocok untuk live stream & presentasi)</span>
    </div>
    <button
      type="button"
      class="toggle-btn {currentWatermark.showOnLiveCanvas && currentWatermark.enabled ? 'active' : ''}"
      disabled={!currentWatermark.enabled}
      onclick={() => updateWatermark({ showOnLiveCanvas: !currentWatermark.showOnLiveCanvas })}
      aria-pressed={currentWatermark.showOnLiveCanvas && currentWatermark.enabled}
    >
      <span class="toggle-dot"></span>
      <span>{currentWatermark.showOnLiveCanvas && currentWatermark.enabled ? 'Tampil di Live' : 'Hanya Snapshot'}</span>
    </button>
  </div>

  <!-- 5. Pratinjau Tampilan Teks Watermark Miring (Live Preview) -->
  <div class="watermark-preview-card">
    <div class="preview-section-header">
      <div class="preview-title-group">
        <Sparkles size={13} class="sparkle-icon" />
        <span class="preview-header-label">Pratinjau Tanda Air Diagonal</span>
      </div>
      <span class="preview-badge-status {currentWatermark.enabled ? 'active' : 'inactive'}">
        {currentWatermark.enabled ? `Aktif (${Math.round((currentWatermark.opacity ?? 0.10) * 100)}%)` : 'Nonaktif'}
      </span>
    </div>

    <div class="watermark-stage-box">
      <!-- Mock Grid Background Kanvas -->
      <div class="mock-grid-bg" aria-hidden="true"></div>

      <!-- Tanda Air Diagonal Miring -->
      <div
        class="preview-watermark-overlay"
        style="opacity: {currentWatermark.enabled ? (currentWatermark.opacity ?? 0.10) : 0.04};"
      >
        <span class="diagonal-watermark-text mono-nums">
          {effectiveWatermarkText}
        </span>
      </div>

      <!-- Mock Mini Candlestick Decorator -->
      <div class="mock-candles-decor" aria-hidden="true">
        <span class="mock-candle green" style="height: 28px;"></span>
        <span class="mock-candle green" style="height: 42px;"></span>
        <span class="mock-candle red" style="height: 35px;"></span>
        <span class="mock-candle green" style="height: 50px;"></span>
        <span class="mock-candle red" style="height: 30px;"></span>
        <span class="mock-candle green" style="height: 60px;"></span>
      </div>
    </div>
  </div>

  <div class="section-divider"></div>

  <!-- Seksi 3: Preferensi Tangkapan Layar Bawaan (#124, #125) -->
  <div class="snapshot-header-group">
    <div class="header-with-badge">
      <h4 class="section-title">Preferensi Tangkapan Layar Bawaan</h4>
      <span class="snapshot-tag mono-nums">
        <Camera size={11} />
        SNAPSHOT
      </span>
    </div>
    <p class="section-subtitle">
      Konfigurasikan resolusi bawaan dan informasi yang disematkan saat mengambil snapshot grafik cepat atau via dialog ekspor.
    </p>
  </div>

  <!-- 1. Selector Chip Multiplier Resolusi Bawaan: 1x, 2x (HiDPI), 4x (4K), 6x (Super HD) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Resolusi Snapshot Bawaan (Scale Multiplier)</span>
      <span class="setting-desc">Tingkat ketajaman kanvas grafik yang dihasilkan (HiDPI hingga Ultra HD 6K)</span>
    </div>
    <div class="multiplier-chips-group">
      {#each scaleMultiplierOptions as opt}
        <button
          type="button"
          class="chip-toggle {currentScaleMultiplier === opt.value ? 'active' : ''}"
          onclick={() => onUpdateSettings({ snapshotScaleMultiplier: opt.value })}
          title="{opt.desc} ({opt.value}x)"
        >
          <span class="chip-dot"></span>
          <span>{opt.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- 2. Toggle Switch snapshotIncludeFrame (Bingkai Branded Frame Bawaan) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Bingkai Branded Frame Bawaan</span>
      <span class="setting-desc">Sematkan kartu showcase dengan Attribution Bar (identitas trader, logo, harga) atau kanvas murni</span>
    </div>
    <button
      type="button"
      class="toggle-btn {currentIncludeFrame ? 'active' : ''}"
      onclick={() => onUpdateSettings({ snapshotIncludeFrame: !currentIncludeFrame })}
      aria-pressed={currentIncludeFrame}
    >
      <span class="toggle-dot"></span>
      <span>{currentIncludeFrame ? 'Branded Frame' : 'Clean Chart'}</span>
    </button>
  </div>

  <!-- 3. Toggle Switch snapshotIncludePrice (Sertakan Harga Terakhir) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Sertakan Harga Terakhir</span>
      <span class="setting-desc">Tampilkan nilai harga pasar aktif di Attribution Bar snapshot</span>
    </div>
    <button
      type="button"
      class="toggle-btn {currentIncludePrice ? 'active' : ''}"
      onclick={() => onUpdateSettings({ snapshotIncludePrice: !currentIncludePrice })}
      aria-pressed={currentIncludePrice}
    >
      <span class="toggle-dot"></span>
      <span>{currentIncludePrice ? 'Sertakan' : 'Sembunyikan'}</span>
    </button>
  </div>

  <!-- 4. Toggle Switch snapshotIncludeTimestamp (Sertakan Stempel Waktu Lokal) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Sertakan Stempel Waktu Lokal</span>
      <span class="setting-desc">Tampilkan informasi tanggal dan jam analisis lokal saat grafik diambil</span>
    </div>
    <button
      type="button"
      class="toggle-btn {currentIncludeTimestamp ? 'active' : ''}"
      onclick={() => onUpdateSettings({ snapshotIncludeTimestamp: !currentIncludeTimestamp })}
      aria-pressed={currentIncludeTimestamp}
    >
      <span class="toggle-dot"></span>
      <span>{currentIncludeTimestamp ? 'Sertakan' : 'Sembunyikan'}</span>
    </button>
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

  /* Seksi Watermark Keamanan (#127) */
  .section-divider {
    height: 1px;
    background-color: var(--border-hairline, rgba(255, 255, 255, 0.08));
    margin: 4px 0;
  }

  .watermark-header-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .header-with-badge {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .anti-theft-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    color: #ff69b4;
    background-color: rgba(255, 105, 180, 0.12);
    border: 1px solid rgba(255, 105, 180, 0.3);
    padding: 1px 6px;
    border-radius: var(--radius-xs, 4px);
    letter-spacing: 0.05em;
  }

  .setting-row.is-disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  /* Toggle Button */
  .toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-xs, 4px);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.1));
    background-color: var(--bg-darkest, #0c0c0c);
    color: var(--text-dim, #777777);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.25);
    color: var(--text-main, #ffffff);
  }

  .toggle-btn.active {
    background-color: rgba(255, 105, 180, 0.12);
    border-color: #ff69b4;
    color: #ff69b4;
  }

  .toggle-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--text-dim, #666666);
    transition: all 0.15s ease;
  }

  .toggle-btn.active .toggle-dot {
    background-color: #ff69b4;
    box-shadow: 0 0 6px rgba(255, 105, 180, 0.7);
  }

  /* Slider Opasitas */
  .label-with-badge {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .opacity-pill {
    font-size: 11px;
    font-weight: 700;
    color: #ff69b4;
    background-color: rgba(255, 105, 180, 0.15);
    padding: 1px 6px;
    border-radius: var(--radius-xs, 4px);
  }

  .slider-container {
    width: 240px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  }

  .opacity-range-slider {
    width: 100%;
    height: 4px;
    appearance: none;
    -webkit-appearance: none;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    accent-color: #ff69b4;
  }

  .opacity-range-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff69b4;
    cursor: pointer;
    box-shadow: 0 0 6px rgba(255, 105, 180, 0.5);
  }

  .slider-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    color: var(--text-dim, #666666);
  }

  /* Pratinjau Watermark Miring */
  .watermark-preview-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background-color: var(--bg-darkest, #0c0c0c);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-sm, 6px);
    padding: 12px 14px;
  }

  .preview-badge-status.inactive {
    color: var(--text-dim, #777777);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .watermark-stage-box {
    position: relative;
    height: 110px;
    background-color: #0d0d0d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-xs, 4px);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mock-grid-bg {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
  }

  .preview-watermark-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  .diagonal-watermark-text {
    transform: rotate(-32deg);
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
    white-space: nowrap;
    user-select: none;
    letter-spacing: 0.06em;
  }

  .mock-candles-decor {
    position: absolute;
    bottom: 8px;
    right: 18px;
    display: flex;
    align-items: flex-end;
    gap: 6px;
    opacity: 0.35;
    pointer-events: none;
  }

  .mock-candle {
    width: 6px;
    border-radius: 1px;
  }

  .mock-candle.green {
    background-color: #089981;
  }

  .mock-candle.red {
    background-color: #f23645;
  }

  /* Seksi 3: Preferensi Tangkapan Layar Bawaan (#124, #125) */
  .snapshot-header-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 4px;
  }

  .snapshot-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 9.5px;
    font-weight: 700;
    color: #38bdf8;
    background-color: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.3);
    padding: 1px 6px;
    border-radius: var(--radius-xs, 4px);
    letter-spacing: 0.05em;
  }

  .multiplier-chips-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .chip-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-darkest, #0c0c0c);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.1));
    color: var(--text-muted, #8e8e8e);
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-mono, monospace);
    padding: 4px 10px;
    border-radius: var(--radius-xs, 4px);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .chip-toggle:hover {
    color: var(--text-main, #ffffff);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .chip-toggle.active {
    color: #ff69b4;
    border-color: rgba(255, 105, 180, 0.5);
    background-color: rgba(255, 105, 180, 0.12);
  }

  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--text-dim, #666666);
    transition: all 0.15s ease;
  }

  .chip-toggle.active .chip-dot {
    background-color: #ff69b4;
    box-shadow: 0 0 5px rgba(255, 105, 180, 0.6);
  }
</style>
