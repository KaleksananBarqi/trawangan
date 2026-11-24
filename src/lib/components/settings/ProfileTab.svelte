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
  import ToggleSwitch from '../common/ToggleSwitch.svelte';
  import { tr, trInstant } from '../../i18n';

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

    // Batasan ukuran berkas avatar maksimal 2.5 MB untuk menjaga efisiensi penyimpanan lokal SQLite
    if (file.size > 2.5 * 1024 * 1024) {
      fileErrorMessage = trInstant('Gambar kegeden, Cok! Maksimal 2.5 MB wae.', 'Ukuran citra terlalu besar (maksimal 2.5 MB). Silakan gunakan gambar yang lebih ringkas.', 'Image exceeds 2.5 MB limit. Please pick a smaller image.');
      target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      fileErrorMessage = trInstant('Format file gak cocok. Pilih gambar PNG, JPG, SVG, utawa WebP.', 'Format berkas tidak didukung. Harap pilih gambar (PNG, JPG, SVG, WebP).', 'Unsupported format. Please choose PNG, JPG, SVG, or WebP.');
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
      fileErrorMessage = trInstant('Gagal moco file gambar. Jajal maneh.', 'Gagal membaca berkas gambar. Silakan coba lagi.', 'Failed to read image file. Please try again.');
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
  <h4 class="section-title">{$tr('Identitas Trader & Jeneng Snapshot', 'Identitas Trader & Atribusi Snapshot', 'Trader Identity & Snapshot Attribution')}</h4>
  <p class="section-subtitle">
    {$tr('Pasang foto profil karo jeneng akunmu sing bakal mejeng nang Attribution Bar ngisor gambar snapshot chart. Kabeh disimpen 100% lokal nang PC-mu dewe tanpa upload cloud.', 'Konfigurasikan avatar dan nama pengguna yang disematkan pada Attribution Bar bingkai snapshot grafik. Seluruh data disimpan 100% lokal di browser Anda (offline-first) tanpa sinkronisasi cloud pihak ketiga.', 'Configure your avatar and handle shown on the snapshot Attribution Bar. Stored 100% locally on your machine with zero cloud sync.')}
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
        <span class="avatar-title">{$tr('Foto Profil Trader', 'Foto Profil Trader', 'Trader Avatar')}</span>
        <span class="avatar-desc">{$tr('Paling mbois rasio 1:1 (kotak). Bakal njedhul bunder nang Attribution Bar snapshot.', 'Rekomendasi rasio 1:1 (persegi). Tampil bulat di Attribution Bar snapshot.', 'Recommended 1:1 square ratio. Rendered circular on the snapshot Attribution Bar.')}</span>
      </div>

      <div class="action-buttons-row">
        <button
          type="button"
          class="btn-profile-action upload-btn"
          onclick={handleTriggerUpload}
          title={$tr('Pilih foto profil teko komputer', 'Unggah Foto Profil dari Komputer', 'Upload avatar from computer')}
        >
          <Upload size={13} />
          <span>{currentProfile.avatarDataUrl ? $tr('Ganti Foto', 'Ganti Foto', 'Change Photo') : $tr('Pasang Foto', 'Unggah Foto', 'Upload Photo')}</span>
        </button>

        {#if currentProfile.avatarDataUrl}
          <button
            type="button"
            class="btn-profile-action delete-btn"
            onclick={handleRemoveAvatar}
            title={$tr('Busek Foto Profil', 'Hapus Foto Profil', 'Remove Avatar')}
          >
            <Trash2 size={13} />
            <span>{$tr('Busek', 'Hapus', 'Remove')}</span>
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
      <span class="setting-label">{$tr('Jeneng Trader / Brand', 'Nama Pengguna (Trader / Brand)', 'Display Name (Trader / Brand)')}</span>
      <span class="setting-desc">{$tr('Jeneng utawa julukanmu sing mejeng nang Attribution Bar', 'Nama atau inisial yang tampil di Attribution Bar', 'Name or alias shown on the Attribution Bar')}</span>
    </div>
    <div class="input-container">
      <input
        type="text"
        class="text-input"
        placeholder="e.g. Satoshi Nakamoto"
        value={currentProfile.username}
        oninput={(e) => updateProfile({ username: e.currentTarget.value })}
        maxlength={32}
      />
    </div>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Social Media Handle</span>
      <span class="setting-desc">{$tr('Username X/Twitter, Telegram, utawa channel komunitasmu', 'Akun X/Twitter, Telegram, atau channel publik Anda', 'Your X/Twitter, Telegram, or public channel handle')}</span>
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
      <span class="setting-label">{$tr('Bio Singkat / Gaya Trading', 'Deskripsi Singkat / Bio Trader', 'Short Bio / Trading Style')}</span>
      <span class="setting-desc">{$tr('Tulis gaya analisamu (conto: Price Action & SMC Suroboyo)', 'Status, keahlian, atau deskripsi singkat profil Anda', 'Tagline, specialty, or trading style badge')}</span>
    </div>
    <div class="input-container">
      <input
        type="text"
        class="text-input"
        placeholder="e.g. Crypto Analyst & Swing Trader"
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
        <span class="preview-header-label">{$tr('Conto Tampilan Attribution Bar Snapshot', 'Pratinjau Attribution Bar Snapshot', 'Snapshot Attribution Bar Preview')}</span>
      </div>
      <span class="preview-badge-status">
        {currentProfile.username || currentProfile.handle || currentProfile.avatarDataUrl ? $tr('Profil Pribadi Urip', 'Personal Attribution Aktif', 'Personal Attribution Active') : 'Default trawangan Branding'}
      </span>
    </div>

    <div class="attribution-preview-bar">
      <!-- Sisi Kiri: Logo Resmi + Identitas Personal / Bawaan -->
      <div class="attribution-left">
        <!-- Logo Resmi Aplikasi -->
        <div class="app-logo-box">
          <img src="/static/logo.png" alt="trawangan" class="app-logo-img" onerror={(e) => {
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
      <h4 class="section-title">{$tr('Watermark Anti-Colong (Anti-Theft)', 'Watermark Keamanan (Anti-Theft)', 'Security Watermark (Anti-Theft)')}</h4>
      <span class="anti-theft-tag mono-nums">
        <ShieldCheck size={11} />
        ANTI-THEFT
      </span>
    </div>
    <p class="section-subtitle">
      {$tr('Tempelno watermark miring tipis nang tengah kanvas snapshot ben gambar analisamu gak dicolong maling sinyal ngaku-ngaku, Cok!', 'Sematkan tanda air diagonal semi-transparan pada kanvas snapshot untuk melindungi karya analisis teknis Anda dari pembajakan tanpa atribusi.', 'Stamp a diagonal semi-transparent watermark across snapshots to protect your technical charts from uncredited reposts.')}
    </p>
  </div>

  <!-- 1. Toggle Switch Aktifkan Watermark Keamanan -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Uripno Watermark Anti-Colong', 'Aktifkan Watermark Keamanan', 'Enable Security Watermark')}</span>
      <span class="setting-desc">{$tr('Pasang cap miring nang tengah gambar pas ekspor snapshot', 'Sematkan tanda air diagonal pada snapshot dan tangkapan layar grafik', 'Embed diagonal watermark on exported chart snapshots')}</span>
    </div>
    <ToggleSwitch
      checked={Boolean(currentWatermark.enabled)}
      ariaLabel="Aktifkan Watermark Keamanan"
      onchange={(next) => updateWatermark({ enabled: next })}
    />
  </div>

  <!-- 2. Input Field Teks Kustom -->
  <div class="setting-row {currentWatermark.enabled ? '' : 'is-disabled'}">
    <div class="setting-info">
      <span class="setting-label">{$tr('Tulisan Watermark Kustom', 'Teks Watermark Kustom', 'Custom Watermark Text')}</span>
      <span class="setting-desc">{$tr('Kosongno wae nek pingin otomatis nganggo jeneng & handle profilmu', 'Kosongkan untuk otomatis menggunakan nama pengguna & handle profil', 'Leave blank to automatically use your profile name & handle')}</span>
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
        <span class="setting-label">{$tr('Ketebalan Watermark', 'Opasitas Tanda Air', 'Watermark Opacity')}</span>
        <span class="opacity-pill mono-nums">
          {Math.round((currentWatermark.opacity ?? 0.10) * 100)}%
        </span>
      </div>
      <span class="setting-desc">{$tr('Setel sepiro ketoke (5% tipis alus sampek 30% cetho pol)', 'Atur tingkat transparansi (5% sangat samar hingga 30% tegas)', 'Adjust transparency from 5% subtle to 30% bold')}</span>
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
        <span>5% ({$tr('Tipis', 'Samar', 'Subtle')})</span>
        <span>10% ({$tr('Default', 'Bawaan', 'Default')})</span>
        <span>30% ({$tr('Cetho', 'Tegas', 'Bold')})</span>
      </div>
    </div>
  </div>

  <!-- 4. Toggle Switch Tampilkan di Kanvas Kerja Aktif -->
  <div class="setting-row {currentWatermark.enabled ? '' : 'is-disabled'}">
    <div class="setting-info">
      <span class="setting-label">{$tr('Ketokno Langsung nang Kanvas Live', 'Tampilkan di Kanvas Kerja Aktif', 'Show on Live Chart Canvas')}</span>
      <span class="setting-desc">{$tr('Munculno watermark langsung nang kanvas pas koen lagi live streaming utawa share screen', 'Munculkan tanda air langsung di kanvas kerja grafik (cocok untuk live stream & presentasi)', 'Display watermark directly on the live chart workspace (great for livestreams)')}</span>
    </div>
    <ToggleSwitch
      checked={Boolean(currentWatermark.showOnLiveCanvas && currentWatermark.enabled)}
      disabled={!currentWatermark.enabled}
      ariaLabel="Tampilkan Watermark di Kanvas Kerja Aktif"
      onchange={(next) => updateWatermark({ showOnLiveCanvas: next })}
    />
  </div>

  <!-- 5. Pratinjau Tampilan Teks Watermark Miring (Live Preview) -->
  <div class="watermark-preview-card">
    <div class="preview-section-header">
      <div class="preview-title-group">
        <Sparkles size={13} class="sparkle-icon" />
        <span class="preview-header-label">{$tr('Conto Watermark Miring', 'Pratinjau Tanda Air Diagonal', 'Diagonal Watermark Preview')}</span>
      </div>
      <span class="preview-badge-status {currentWatermark.enabled ? 'active' : 'inactive'}">
        {currentWatermark.enabled ? `${$tr('Urip', 'Aktif', 'Active')} (${Math.round((currentWatermark.opacity ?? 0.10) * 100)}%)` : $tr('Mati', 'Nonaktif', 'Off')}
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
      <h4 class="section-title">{$tr('Setelan Default Jepretan Snapshot', 'Preferensi Tangkapan Layar Bawaan', 'Default Snapshot Preferences')}</h4>
      <span class="snapshot-tag mono-nums">
        <Camera size={11} />
        SNAPSHOT
      </span>
    </div>
    <p class="section-subtitle">
      {$tr('Atur resolusi beninge gambar lan info opo wae sing katut pas njepret chart.', 'Konfigurasikan resolusi bawaan dan informasi yang disematkan saat mengambil snapshot grafik cepat atau via dialog ekspor.', 'Configure default export resolution and metadata badges for chart snapshots.')}
    </p>
  </div>

  <!-- 1. Selector Chip Multiplier Resolusi Bawaan: 1x, 2x (HiDPI), 4x (4K), 6x (Super HD) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Resolusi Bening Snapshot (Scale Multiplier)', 'Resolusi Snapshot Bawaan (Scale Multiplier)', 'Default Snapshot Scale Multiplier')}</span>
      <span class="setting-desc">{$tr('Tingkat ketajeman gambar sing diekspor (HiDPI sampek Super HD 6x)', 'Tingkat ketajaman kanvas grafik yang dihasilkan (HiDPI hingga Ultra HD 6K)', 'Output pixel density multiplier (from 1x up to crisp 6x Super HD)')}</span>
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
      <span class="setting-label">{$tr('Bingkai Branded Frame Default', 'Bingkai Branded Frame Bawaan', 'Default Branded Snapshot Frame')}</span>
      <span class="setting-desc">{$tr('Pasang bingkai mbois lengkap karo Attribution Bar (profil, logo, rega) utawa kanvas resik', 'Sematkan kartu showcase dengan Attribution Bar (identitas trader, logo, harga) atau kanvas murni', 'Wrap exported chart in a showcase frame with Attribution Bar or export raw canvas')}</span>
    </div>
    <ToggleSwitch
      checked={currentIncludeFrame}
      label="Bingkai Branded Frame Bawaan"
      onchange={(next) => onUpdateSettings({ snapshotIncludeFrame: next })}
    />
  </div>

  <!-- 3. Toggle Switch snapshotIncludePrice (Sertakan Harga Terakhir) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Katutno Rega Terakhir', 'Sertakan Harga Terakhir', 'Include Last Price')}</span>
      <span class="setting-desc">{$tr('Ketokno angka rega market aktif nang Attribution Bar snapshot', 'Tampilkan nilai harga pasar aktif di Attribution Bar snapshot', 'Display active market price on the snapshot Attribution Bar')}</span>
    </div>
    <ToggleSwitch
      checked={currentIncludePrice}
      ariaLabel="Sertakan Harga Terakhir"
      onchange={(next) => onUpdateSettings({ snapshotIncludePrice: next })}
    />
  </div>

  <!-- 4. Toggle Switch snapshotIncludeTimestamp (Sertakan Stempel Waktu Lokal) -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Katutno Tanggal & Jam Lokal', 'Sertakan Stempel Waktu Lokal', 'Include Local Timestamp')}</span>
      <span class="setting-desc">{$tr('Ketokno info tanggal karo jam analisa pas gambar dijepret', 'Tampilkan informasi tanggal dan jam analisis lokal saat grafik diambil', 'Show local capture date and time on the snapshot footer')}</span>
    </div>
    <ToggleSwitch
      checked={currentIncludeTimestamp}
      ariaLabel="Sertakan Stempel Waktu Lokal"
      onchange={(next) => onUpdateSettings({ snapshotIncludeTimestamp: next })}
    />
  </div>
</div>

<style>
  .section-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
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
    padding: 11px 14px;
    background-color: var(--bg-panel, #171717);
    border: none;
    border-radius: var(--radius-md, 6px);
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
