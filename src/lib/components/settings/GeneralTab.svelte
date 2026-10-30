<script lang="ts">
  import {
    Volume2,
    VolumeX,
    Bell,
    BellOff,
    Palette,
    Clipboard,
    ClipboardCheck,
    Clock,
    Camera,
    Folder,
    ExternalLink,
    Sparkles
  } from '@lucide/svelte';
  import { THEME_PRESETS } from '../../constants/themes';
  import { sendTestNotification } from '../../services/systemNotificationService';
  import type { AppSettings } from '../../types/market';
  import {
    SUPPORTED_WORLD_CITIES,
    DEFAULT_WORLD_CLOCK_CITIES
  } from '../../services/worldClockService';
  import { openSnapshotFolder } from '../../services/chartSnapshotService';

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
    onNavigateTab?: (tab: string) => void;
  }

  let { settings, onUpdateSettings, onNavigateTab }: Props = $props();

  let testNotificationFeedback = $state<string | null>(null);

  function handleToggleCity(tz: string) {
    const current = settings.worldClockCities ?? DEFAULT_WORLD_CLOCK_CITIES;
    let next: string[];
    if (current.includes(tz)) {
      if (current.length <= 1) return;
      next = current.filter((c) => c !== tz);
    } else {
      next = [...current, tz];
    }
    onUpdateSettings({ worldClockCities: next });
  }

  async function handleSendTestNotification() {
    testNotificationFeedback = 'Mengirim notifikasi ke Windows...';
    const ok = await sendTestNotification();
    if (ok) {
      testNotificationFeedback = '✓ Notifikasi terkirim ke Windows Action Center!';
    } else {
      testNotificationFeedback = '⚠ Izin notifikasi belum diizinkan di Windows.';
    }
    setTimeout(() => {
      testNotificationFeedback = null;
    }, 4500);
  }

  async function handleOpenSnapshotFolder(dir?: string) {
    await openSnapshotFolder(dir);
  }
</script>

<div class="section-group">
  <h4 class="section-title">Preferensi Regional & Notifikasi</h4>
  
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Zona Waktu Chart</span>
      <span class="setting-desc">Waktu referensi untuk sumbu horizontal candle</span>
    </div>
    <select
      class="select-input mono-nums"
      value={settings.timezone}
      onchange={(e) => onUpdateSettings({ timezone: e.currentTarget.value })}
    >
      <option value="Asia/Jakarta">UTC+7 (WIB / Jakarta)</option>
      <option value="Asia/Bangkok">UTC+7 (Bangkok)</option>
      <option value="Asia/Makassar">UTC+8 (WITA / Makassar)</option>
      <option value="Asia/Singapore">UTC+8 (Singapore / Shanghai)</option>
      <option value="Asia/Tokyo">UTC+9 (Tokyo / Seoul)</option>
      <option value="UTC">UTC+0 (Coordinated Universal Time)</option>
      <option value="Europe/London">UTC+0 (London / GMT)</option>
      <option value="Europe/Berlin">UTC+1 (Frankfurt / Berlin / Paris)</option>
      <option value="America/New_York">UTC-4 (New York EDT)</option>
      <option value="America/Chicago">UTC-5 (Chicago CDT)</option>
      <option value="America/Los_Angeles">UTC-7 (Los Angeles PDT)</option>
    </select>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Jam Bursa Dunia (StatusBar)</span>
      <span class="setting-desc">Tampilkan jam bursa New York, London, dan Tokyo beserta status sesi pasar di bilah status</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.showWorldClocks !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ showWorldClocks: settings.showWorldClocks === false ? true : false })}
    >
      {#if settings.showWorldClocks !== false}
        <Clock size={14} /> Aktif
      {:else}
        <Clock size={14} /> Nonaktif
      {/if}
    </button>
  </div>

  {#if settings.showWorldClocks !== false}
    <div class="setting-sub-row">
      <div class="setting-info">
        <span class="setting-label-sub">Pilihan Bursa Aktif</span>
        <span class="setting-desc">Pilih kota bursa dunia yang ingin ditampilkan di bilah status</span>
      </div>
      <div class="city-chips-group">
        {#each SUPPORTED_WORLD_CITIES as city (city.id)}
          {@const isEnabled = (settings.worldClockCities ?? DEFAULT_WORLD_CLOCK_CITIES).includes(city.timezone)}
          <button
            type="button"
            class="chip-toggle {isEnabled ? 'active' : ''}"
            onclick={() => handleToggleCity(city.timezone)}
            title="{isEnabled ? 'Klik untuk sembunyikan' : 'Klik untuk tampilkan'} jam {city.label}"
          >
            <span class="chip-dot"></span>
            <span>{city.label} ({city.shortCode})</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Efek Suara Notifikasi (Audio Chime)</span>
      <span class="setting-desc">Bunyikan nada kristal sintetis saat harga menembus level Alert</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.soundEnabled ? 'active' : ''}"
      onclick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
    >
      {#if settings.soundEnabled}
        <Volume2 size={14} /> Aktif
      {:else}
        <VolumeX size={14} /> Senyap
      {/if}
    </button>
  </div>

  <!-- Notifikasi Native Windows Action Center -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Notifikasi Sistem Windows (Windows Toast)</span>
      <span class="setting-desc">Kirim notifikasi native ke Windows Action Center saat alert terpicu</span>
      {#if testNotificationFeedback}
        <span class="notification-test-feedback mono-nums">{testNotificationFeedback}</span>
      {/if}
    </div>
    <div class="setting-action-group">
      <button
        type="button"
        class="btn-test-notification"
        onclick={handleSendTestNotification}
        title="Kirim notifikasi uji coba ke Windows"
      >
        <Bell size={12} />
        <span>Tes Notifikasi</span>
      </button>
      <button
        type="button"
        class="toggle-btn {settings.systemNotificationEnabled !== false ? 'active' : ''}"
        onclick={() => onUpdateSettings({ systemNotificationEnabled: settings.systemNotificationEnabled === false })}
      >
        {#if settings.systemNotificationEnabled !== false}
          <Bell size={14} /> Aktif
        {:else}
          <BellOff size={14} /> Nonaktif
        {/if}
      </button>
    </div>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Tema Visual Antarmuka</span>
      <span class="setting-desc">Skema warna yang saat ini aktif</span>
    </div>
    <button
      type="button"
      class="toggle-btn active"
      onclick={() => onNavigateTab?.('appearance')}
      title="Buka tab Tema & Tipografi"
    >
      <Palette size={13} />
      <span>{THEME_PRESETS[settings.themePreset || 'signature']?.name || 'trawangan (Signature)'}</span>
    </button>
  </div>

  <!-- Smart Clipboard Link Sentry -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Smart Clipboard Link Sentry</span>
      <span class="setting-desc">Deteksi otomatis saat menyalin tautan TradingView/bursa dari browser</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.clipboardWatcherEnabled !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ clipboardWatcherEnabled: settings.clipboardWatcherEnabled === false })}
    >
      {#if settings.clipboardWatcherEnabled !== false}
        <ClipboardCheck size={14} /> Aktif
      {:else}
        <Clipboard size={14} /> Nonaktif
      {/if}
    </button>
  </div>

  {#if settings.clipboardWatcherEnabled !== false}
    <div class="setting-row sub-row">
      <div class="setting-info">
        <span class="setting-label">Buka Tautan Langsung Tanpa Konfirmasi</span>
        <span class="setting-desc">Langsung arahkan grafik saat link tersalin tanpa memunculkan toast konfirmasi</span>
      </div>
      <button
        type="button"
        class="toggle-btn {settings.clipboardAutoOpen ? 'active' : ''}"
        onclick={() => onUpdateSettings({ clipboardAutoOpen: !settings.clipboardAutoOpen })}
      >
        {settings.clipboardAutoOpen ? 'Otomatis' : 'Tanya Dulu (Toast)'}
      </button>
    </div>
  {/if}

  <div class="setting-row sub-row bridge-tip-row">
    <div class="setting-info">
      <span class="setting-desc tip-text">
        💡 <strong>Integrasi Browser Web:</strong> Untuk mengalihkan tautan secara otomatis saat browsing di TradingView/Binance, buka tab <strong>Bantuan & Shortcut</strong> atau <strong>Sistem & Skrip Browser</strong> untuk menyalin skrip Tampermonkey.
      </span>
    </div>
  </div>

  <!-- Pengaturan Tangkapan Layar & Snapshot (#95 & Save Directory Setting) -->
  <div class="section-divider"></div>
  <h4 class="section-title">Tangkapan Layar & Snapshot Grafik</h4>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Folder Penyimpanan Snapshot</span>
      <span class="setting-desc">Lokasi direktori penyimpanan berkas gambar PNG saat snapshot diunduh</span>
    </div>
    <div class="directory-setting-group">
      <input
        type="text"
        class="directory-input mono-nums"
        placeholder="Bawaan: Folder Downloads OS"
        value={settings.snapshotDirectory || ''}
        onchange={(e) => onUpdateSettings({ snapshotDirectory: e.currentTarget.value.trim() })}
      />
      <button
        type="button"
        class="btn-open-folder"
        title="Buka folder penyimpanan di File Manager"
        onclick={() => handleOpenSnapshotFolder(settings.snapshotDirectory)}
      >
        <Folder size={13} />
        <span>Buka Folder</span>
      </button>
    </div>
  </div>

  <div class="setting-sub-row">
    <div class="setting-info">
      <span class="setting-label-sub">Pilihan Cepat Direktori</span>
      <span class="setting-desc">Pilih jalur direktori standar atau ketik path folder kustom di atas</span>
    </div>
    <div class="dir-chips-group">
      <button
        type="button"
        class="chip-toggle {(!settings.snapshotDirectory || settings.snapshotDirectory === '') ? 'active' : ''}"
        onclick={() => onUpdateSettings({ snapshotDirectory: '' })}
      >
        <span class="chip-dot"></span>
        <span>Downloads (Bawaan)</span>
      </button>
      <button
        type="button"
        class="chip-toggle {settings.snapshotDirectory === '~/Pictures/Screenshots' ? 'active' : ''}"
        onclick={() => onUpdateSettings({ snapshotDirectory: '~/Pictures/Screenshots' })}
      >
        <span class="chip-dot"></span>
        <span>Pictures/Screenshots</span>
      </button>
      <button
        type="button"
        class="chip-toggle {settings.snapshotDirectory === '~/Desktop' ? 'active' : ''}"
        onclick={() => onUpdateSettings({ snapshotDirectory: '~/Desktop' })}
      >
        <span class="chip-dot"></span>
        <span>Desktop</span>
      </button>
    </div>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Gaya Ekspor Snapshot Bawaan</span>
      <span class="setting-desc">Format kartu showcase dengan Attribution Bar atau kanvas murni</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.snapshotIncludeFrame !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ snapshotIncludeFrame: settings.snapshotIncludeFrame === false })}
    >
      {#if settings.snapshotIncludeFrame !== false}
        <Sparkles size={13} /> Branded Frame
      {:else}
        Clean Export
      {/if}
    </button>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Sertakan Harga Terakhir (Attribution Bar)</span>
      <span class="setting-desc">Tampilkan badge harga pasar aktif di bilah footer snapshot</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.snapshotIncludePrice !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ snapshotIncludePrice: settings.snapshotIncludePrice === false })}
    >
      {settings.snapshotIncludePrice !== false ? 'Sertakan' : 'Sembunyikan'}
    </button>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Sertakan Waktu Analisis</span>
      <span class="setting-desc">Tampilkan stempel tanggal dan jam lokal saat grafik ditangkap</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.snapshotIncludeTimestamp !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ snapshotIncludeTimestamp: settings.snapshotIncludeTimestamp === false })}
    >
      {settings.snapshotIncludeTimestamp !== false ? 'Sertakan' : 'Sembunyikan'}
    </button>
  </div>
</div>

<style>
  .section-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0 0 4px 0;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-main);
  }

  .setting-desc {
    font-size: 11px;
    color: var(--text-muted);
  }

  .select-input {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11.5px;
    padding: 5px 8px;
    border-radius: var(--radius-xs);
    outline: none;
    cursor: pointer;
  }

  .select-input:focus {
    border-color: var(--brand-primary);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    font-size: 11.5px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .toggle-btn.active {
    background-color: rgba(255, 105, 180, 0.12);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .setting-action-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-test-notification {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    font-size: 11px;
    padding: 5px 8px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-test-notification:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-subtle);
  }

  .notification-test-feedback {
    font-size: 10.5px;
    color: var(--brand-primary);
    margin-top: 3px;
  }

  /* Sub-Row Pilihan Bursa Jam Dunia */
  .setting-sub-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px 8px 20px;
    background-color: rgba(255, 255, 255, 0.02);
    border: 1px dashed var(--border-hairline);
    border-radius: var(--radius-sm);
    margin-top: -6px;
  }

  .setting-label-sub {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-main);
  }

  .city-chips-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .chip-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    font-size: 11px;
    font-family: var(--font-mono);
    padding: 3px 8px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .chip-toggle:hover {
    color: var(--text-main);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .chip-toggle.active {
    color: #ff69b4;
    border-color: rgba(255, 105, 180, 0.5);
    background-color: rgba(255, 105, 180, 0.1);
  }

  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--text-dim);
  }

  .chip-toggle.active .chip-dot {
    background-color: #ff69b4;
    box-shadow: 0 0 5px rgba(255, 105, 180, 0.6);
  }

  .section-divider {
    height: 1px;
    background-color: var(--border-hairline);
    margin: 8px 0;
  }

  .directory-setting-group {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 55%;
    max-width: 320px;
  }

  .directory-input {
    flex: 1;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-xs);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .directory-input:focus {
    border-color: var(--brand-primary);
  }

  .directory-input::placeholder {
    color: var(--text-dim);
  }

  .btn-open-folder {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .btn-open-folder:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--brand-primary);
  }

  .dir-chips-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
</style>
