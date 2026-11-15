<script lang="ts">
  import {
    Volume2,
    VolumeX,
    Bell,
    BellOff,
    Palette,
    Clock,
    Camera,
    Folder,
    FolderOpen,
    Sparkles,
    Send,
    MessageSquare,
    Eye,
    EyeOff
  } from '@lucide/svelte';
  import { THEME_PRESETS, resolveThemeConfig } from '../../constants/themes';
  import {
    isValidDiscordWebhookUrl,
    isValidTelegramConfig,
    sendTestDiscordNotification,
    sendTestNotification,
    sendTestTelegramNotification
  } from '../../services/systemNotificationService';
  import type { AppSettings } from '../../types/market';
  import {
    SUPPORTED_WORLD_CITIES,
    DEFAULT_WORLD_CLOCK_CITIES
  } from '../../services/worldClockService';
  import {
    openSnapshotFolder,
    pickSnapshotDirectory
  } from '../../services/chartSnapshotService';

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
    onNavigateTab?: (tab: string) => void;
  }

  let { settings, onUpdateSettings, onNavigateTab }: Props = $props();

  let testNotificationFeedback = $state<string | null>(null);
  let telegramTestFeedback = $state<{ ok: boolean; text: string } | null>(null);
  let isTestingTelegram = $state(false);
  let showTelegramToken = $state(false);

  let discordTestFeedback = $state<{ ok: boolean; text: string } | null>(null);
  let isTestingDiscord = $state(false);
  let showDiscordWebhook = $state(false);

  const isTelegramConfigValid = $derived(
    isValidTelegramConfig(settings.telegramBotToken, settings.telegramChatId)
  );
  const hasDiscordInput = $derived(Boolean((settings.discordWebhookUrl || '').trim()));
  const isDiscordUrlValid = $derived(isValidDiscordWebhookUrl(settings.discordWebhookUrl));

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
    testNotificationFeedback = 'Mengirim notifikasi desktop...';
    const ok = await sendTestNotification();
    if (ok) {
      testNotificationFeedback = '✓ Notifikasi terkirim ke desktop sistem!';
    } else {
      testNotificationFeedback = '⚠ Izin notifikasi desktop belum diizinkan.';
    }
    setTimeout(() => {
      testNotificationFeedback = null;
    }, 4500);
  }

  async function runExternalChannelTest(
    channelLabel: string,
    getTesting: () => boolean,
    setTesting: (v: boolean) => void,
    setFeedback: (fb: { ok: boolean; text: string } | null) => void,
    sender: () => Promise<{ ok: boolean; error?: string }>
  ) {
    if (getTesting()) return;
    setTesting(true);
    setFeedback({ ok: true, text: `Mengirim tes ke ${channelLabel}...` });
    const res = await sender();
    setTesting(false);
    setFeedback(
      res.ok
        ? { ok: true, text: `✓ Notifikasi tes terkirim ke ${channelLabel}!` }
        : { ok: false, text: `⚠ Gagal: ${res.error || 'Terjadi kesalahan'}` }
    );
    setTimeout(() => {
      setFeedback(null);
    }, 6000);
  }

  function handleSendTestTelegram() {
    return runExternalChannelTest(
      'Telegram',
      () => isTestingTelegram,
      (v) => (isTestingTelegram = v),
      (fb) => (telegramTestFeedback = fb),
      () =>
        sendTestTelegramNotification(
          settings.telegramBotToken || '',
          settings.telegramChatId || ''
        )
    );
  }

  function handleSendTestDiscord() {
    return runExternalChannelTest(
      'Discord',
      () => isTestingDiscord,
      (v) => (isTestingDiscord = v),
      (fb) => (discordTestFeedback = fb),
      () => sendTestDiscordNotification(settings.discordWebhookUrl || '')
    );
  }

  async function handlePickSnapshotDirectory() {
    const selected = await pickSnapshotDirectory();
    if (selected) {
      onUpdateSettings({ snapshotDirectory: selected });
    }
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

  <!-- Notifikasi Desktop Sistem -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Notifikasi Desktop Sistem</span>
      <span class="setting-desc">Kirim notifikasi native ke pusat notifikasi OS (Linux, Windows, macOS) saat alert terpicu</span>
      {#if testNotificationFeedback}
        <span class="notification-test-feedback mono-nums">{testNotificationFeedback}</span>
      {/if}
    </div>
    <div class="setting-action-group">
      <button
        type="button"
        class="btn-test-notification"
        onclick={handleSendTestNotification}
        title="Kirim notifikasi uji coba ke desktop sistem"
      >
        <Bell size={12} />
        <span>Tes Desktop</span>
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

  <!-- Notifikasi Bot Telegram -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Notifikasi Bot Telegram</span>
      <span class="setting-desc">Teruskan Price Alert & Pine Script Alert ke chat atau grup Telegram Anda</span>
      {#if telegramTestFeedback}
        <span class="notification-test-feedback {telegramTestFeedback.ok ? '' : 'error'} mono-nums">
          {telegramTestFeedback.text}
        </span>
      {/if}
    </div>
    <div class="setting-action-group">
      <button
        type="button"
        class="btn-test-notification"
        disabled={isTestingTelegram || !isTelegramConfigValid}
        onclick={handleSendTestTelegram}
        title={isTelegramConfigValid ? 'Kirim pesan tes ke Bot Telegram' : 'Lengkapi Bot Token & Chat ID terlebih dahulu'}
      >
        <Send size={12} />
        <span>{isTestingTelegram ? 'Mengirim...' : 'Tes Telegram'}</span>
      </button>
      <button
        type="button"
        class="toggle-btn {settings.telegramNotificationEnabled ? 'active' : ''}"
        onclick={() => onUpdateSettings({ telegramNotificationEnabled: !settings.telegramNotificationEnabled })}
      >
        {#if settings.telegramNotificationEnabled}
          <Send size={13} /> Aktif
        {:else}
          <BellOff size={13} /> Nonaktif
        {/if}
      </button>
    </div>
  </div>

  <div class="setting-sub-row channel-config-row">
    <div class="channel-fields-grid">
      <div class="channel-field">
        <label class="setting-label-sub" for="telegram-bot-token">Bot Token</label>
        <div class="secret-input-wrap">
          <input
            id="telegram-bot-token"
            type={showTelegramToken ? 'text' : 'password'}
            class="channel-input mono-nums"
            placeholder="Contoh: 123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ"
            value={settings.telegramBotToken || ''}
            oninput={(e) => onUpdateSettings({ telegramBotToken: e.currentTarget.value })}
            onchange={(e) => onUpdateSettings({ telegramBotToken: e.currentTarget.value.trim() })}
            autocomplete="off"
          />
          <button
            type="button"
            class="secret-toggle-btn"
            onclick={() => (showTelegramToken = !showTelegramToken)}
            title={showTelegramToken ? 'Sembunyikan Token' : 'Lihat Token'}
          >
            {#if showTelegramToken}
              <EyeOff size={13} />
            {:else}
              <Eye size={13} />
            {/if}
          </button>
        </div>
      </div>

      <div class="channel-field">
        <label class="setting-label-sub" for="telegram-chat-id">Chat ID</label>
        <input
          id="telegram-chat-id"
          type="text"
          class="channel-input mono-nums"
          placeholder="Contoh: 123456789 atau -100..."
          value={settings.telegramChatId || ''}
          oninput={(e) => onUpdateSettings({ telegramChatId: e.currentTarget.value })}
          onchange={(e) => onUpdateSettings({ telegramChatId: e.currentTarget.value.trim() })}
          autocomplete="off"
        />
      </div>
    </div>
  </div>

  <!-- Notifikasi Webhook Discord -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Notifikasi Webhook Discord</span>
      <span class="setting-desc">Kirim Rich Embed ke channel Discord Anda saat Price Alert atau Pine Alert terpicu</span>
      {#if discordTestFeedback}
        <span class="notification-test-feedback {discordTestFeedback.ok ? '' : 'error'} mono-nums">
          {discordTestFeedback.text}
        </span>
      {:else if hasDiscordInput && !isDiscordUrlValid}
        <span class="notification-test-feedback error mono-nums">
          ⚠ URL harus diawali https://discord.com/api/webhooks/
        </span>
      {/if}
    </div>
    <div class="setting-action-group">
      <button
        type="button"
        class="btn-test-notification"
        disabled={isTestingDiscord || !isDiscordUrlValid}
        onclick={handleSendTestDiscord}
        title={isDiscordUrlValid ? 'Kirim pesan tes ke Discord Webhook' : 'Masukkan URL Webhook Discord yang valid terlebih dahulu'}
      >
        <MessageSquare size={12} />
        <span>{isTestingDiscord ? 'Mengirim...' : 'Tes Discord'}</span>
      </button>
      <button
        type="button"
        class="toggle-btn {settings.discordNotificationEnabled ? 'active' : ''}"
        onclick={() => onUpdateSettings({ discordNotificationEnabled: !settings.discordNotificationEnabled })}
      >
        {#if settings.discordNotificationEnabled}
          <MessageSquare size={13} /> Aktif
        {:else}
          <BellOff size={13} /> Nonaktif
        {/if}
      </button>
    </div>
  </div>

  <div class="setting-sub-row channel-config-row">
    <div class="channel-field full-width">
      <label class="setting-label-sub" for="discord-webhook-url">Webhook URL</label>
      <div class="secret-input-wrap">
        <input
          id="discord-webhook-url"
          type={showDiscordWebhook ? 'text' : 'password'}
          class="channel-input mono-nums {hasDiscordInput && !isDiscordUrlValid ? 'input-invalid' : ''}"
          placeholder="https://discord.com/api/webhooks/..."
          value={settings.discordWebhookUrl || ''}
          oninput={(e) => onUpdateSettings({ discordWebhookUrl: e.currentTarget.value })}
          onchange={(e) => onUpdateSettings({ discordWebhookUrl: e.currentTarget.value.trim() })}
          autocomplete="off"
        />
        <button
          type="button"
          class="secret-toggle-btn"
          onclick={() => (showDiscordWebhook = !showDiscordWebhook)}
          title={showDiscordWebhook ? 'Sembunyikan URL' : 'Lihat URL'}
        >
          {#if showDiscordWebhook}
            <EyeOff size={13} />
          {:else}
            <Eye size={13} />
          {/if}
        </button>
      </div>
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
      <span>{resolveThemeConfig(settings.themePreset || 'signature', settings.savedUserThemes)?.name || 'trawangan (Signature)'}</span>
    </button>
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
        class="btn-pick-folder"
        title="Pilih folder penyimpanan via dialog native sistem operasi"
        onclick={handlePickSnapshotDirectory}
      >
        <FolderOpen size={13} />
        <span>Pilih Folder...</span>
      </button>
      <button
        type="button"
        class="btn-open-folder"
        title="Buka folder penyimpanan di File Manager"
        onclick={() => openSnapshotFolder(settings.snapshotDirectory)}
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
        <Sparkles size={13} /> Branded Snapshot Frame
      {:else}
        Clean Chart Export
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

<!-- Timeframe & Workspace Persistence -->
<div class="section-group">
  <h4 class="section-title">Timeframe & Penyimpanan Workspace</h4>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Timeframe Default (Aplikasi & Multi-Chart)</span>
      <span class="setting-desc">Interval lilin bawaan saat aplikasi dibuka dan saat panel baru terbentuk</span>
    </div>
    <select
      class="select-input mono-nums"
      value={settings.defaultTimeframe || '15m'}
      onchange={(e) => onUpdateSettings({ defaultTimeframe: e.currentTarget.value as any })}
    >
      <optgroup label="Menit">
        <option value="1m">1m (1 Menit)</option>
        <option value="3m">3m (3 Menit)</option>
        <option value="5m">5m (5 Menit)</option>
        <option value="15m">15m (15 Menit - Day Trading)</option>
        <option value="30m">30m (30 Menit)</option>
        <option value="45m">45m (45 Menit)</option>
      </optgroup>
      <optgroup label="Jam">
        <option value="1h">1h (1 Jam - Swing MTF)</option>
        <option value="2h">2h (2 Jam)</option>
        <option value="4h">4h (4 Jam - HTF Analisis)</option>
        <option value="6h">6h (6 Jam)</option>
        <option value="12h">12h (12 Jam)</option>
      </optgroup>
      <optgroup label="Hari & Pekan">
        <option value="1D">1D (1 Hari - Trend Utama)</option>
        <option value="1W">1W (1 Pekan)</option>
        <option value="1M">1M (1 Bulan)</option>
      </optgroup>
    </select>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Penyimpanan Otomatis Workspace (Auto-Save)</span>
      <span class="setting-desc">Simpan otomatis tata letak grid, simbol, dan perubahan workspace saat bekerja</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.autoSaveWorkspace !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ autoSaveWorkspace: settings.autoSaveWorkspace === false })}
    >
      {settings.autoSaveWorkspace !== false ? 'Aktif' : 'Nonaktif'}
    </button>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Muat Workspace Terakhir saat Startup</span>
      <span class="setting-desc">Otomatis memuat workspace, simbol, indikator, dan tata letak terakhir saat aplikasi dibuka</span>
    </div>
    <button
      type="button"
      class="toggle-btn {settings.autoLoadLastWorkspace !== false ? 'active' : ''}"
      onclick={() => onUpdateSettings({ autoLoadLastWorkspace: settings.autoLoadLastWorkspace === false })}
    >
      {settings.autoLoadLastWorkspace !== false ? 'Aktif' : 'Nonaktif'}
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

  .btn-test-notification:hover:not(:disabled) {
    background-color: var(--bg-hover);
    color: var(--text-main);
    border-color: var(--border-subtle);
  }

  .btn-test-notification:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .notification-test-feedback {
    font-size: 10.5px;
    color: var(--brand-primary);
    margin-top: 3px;
  }

  .notification-test-feedback.error {
    color: var(--bear-color, #FF4466);
  }

  .channel-config-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .channel-fields-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 10px;
  }

  .channel-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .channel-field.full-width {
    width: 100%;
  }

  .secret-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .channel-input {
    flex: 1;
    min-width: 0;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    font-size: 11px;
    padding: 6px 9px;
    border-radius: var(--radius-xs);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .channel-input:focus {
    border-color: var(--brand-primary);
  }

  .channel-input.input-invalid {
    border-color: var(--bear-color, #FF4466);
  }

  .secret-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    padding: 6px 8px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.12s ease;
  }

  .secret-toggle-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
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
    width: auto;
    max-width: 440px;
  }

  .directory-input {
    flex: 1;
    min-width: 130px;
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

  .btn-pick-folder,
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

  .btn-pick-folder:hover,
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
