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
    EyeOff,
    Globe,
    Play
  } from '@lucide/svelte';
  import { THEME_PRESETS, resolveThemeConfig } from '../../constants/themes';
  import { t, tr, trInstant, SUPPORTED_LANGUAGES } from '../../i18n';
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
    readMarketSessionsFooterHidden,
    setMarketSessionsFooterHidden
  } from '../../services/persistence/uiPreferencesHelper';
  import {
    openSnapshotFolder,
    pickSnapshotDirectory
  } from '../../services/chartSnapshotService';
  import ToggleSwitch from '../common/ToggleSwitch.svelte';

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
    onNavigateTab?: (tab: string) => void;
    onReplayTutorial?: () => void;
  }

  let { settings, onUpdateSettings, onNavigateTab, onReplayTutorial }: Props = $props();

  let testNotificationFeedback = $state<string | null>(null);
  let telegramTestFeedback = $state<{ ok: boolean; text: string } | null>(null);
  let isTestingTelegram = $state(false);
  let showTelegramToken = $state(false);

  let discordTestFeedback = $state<{ ok: boolean; text: string } | null>(null);
  let isTestingDiscord = $state(false);
  let showDiscordWebhook = $state(false);
  let isMarketSessionsFooterHidden = $state(readMarketSessionsFooterHidden());

  async function handleToggleMarketSessionsFooter() {
    const nextHidden = !isMarketSessionsFooterHidden;
    isMarketSessionsFooterHidden = nextHidden;
    await setMarketSessionsFooterHidden(nextHidden);
  }

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
    testNotificationFeedback = trInstant('Ngirim notifikasi desktop...', 'Mengirim notifikasi desktop...', 'Sending desktop notification...');
    const ok = await sendTestNotification();
    if (ok) {
      testNotificationFeedback = trInstant('✓ Sip! Notifikasi wis mendarat nang desktop!', '✓ Notifikasi terkirim ke desktop sistem!', '✓ Test notification sent to system desktop!');
    } else {
      testNotificationFeedback = trInstant('⚠ Izin notifikasi desktop durung dibukak, Rek.', '⚠ Izin notifikasi desktop belum diizinkan.', '⚠ Desktop notification permission is not granted.');
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
    setFeedback({ ok: true, text: trInstant(`Ngirim tes nang ${channelLabel}...`, `Mengirim tes ke ${channelLabel}...`, `Sending test to ${channelLabel}...`) });
    const res = await sender();
    setTesting(false);
    setFeedback(
      res.ok
        ? { ok: true, text: trInstant(`✓ Notifikasi tes melbu nang ${channelLabel}!`, `✓ Notifikasi tes terkirim ke ${channelLabel}!`, `✓ Test notification delivered to ${channelLabel}!`) }
        : { ok: false, text: `⚠ ${trInstant('Gagal', 'Gagal', 'Failed')}: ${res.error || trInstant('Ono error rek', 'Terjadi kesalahan', 'An error occurred')}` }
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
  <h4 class="section-title">{$tr('Setelan Wilayah, Basa & Notifikasi', 'Preferensi Regional & Notifikasi', 'Regional & Notification Preferences')}</h4>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$t('settings.langLabel')}</span>
      <span class="setting-desc">{$t('settings.langDesc')}</span>
    </div>
    <div class="city-chips-group">
      {#each SUPPORTED_LANGUAGES as lang (lang.code)}
        {@const isActiveLang = (settings.language ?? 'jv') === lang.code}
        <button
          type="button"
          class="chip-toggle {isActiveLang ? 'active' : ''}"
          onclick={() => onUpdateSettings({ language: lang.code })}
        >
          <Globe size={11} />
          <span>{lang.badge} · {lang.label}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if onReplayTutorial}
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">{$t('settings.replayTutorialLabel')}</span>
        <span class="setting-desc">{$t('settings.replayTutorialDesc')}</span>
      </div>
      <button
        type="button"
        class="toggle-btn active"
        onclick={() => onReplayTutorial?.()}
      >
        <Play size={12} />
        <span>{$t('settings.replayTutorialBtn')}</span>
      </button>
    </div>
  {/if}
  
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Zona Jam Chart', 'Zona Waktu Chart', 'Chart Timezone')}</span>
      <span class="setting-desc">{$tr('Patokan jam gawe sumbu waktu candle nang ngisor chart', 'Waktu referensi untuk sumbu horizontal candle', 'Reference timezone for the horizontal candlestick time axis')}</span>
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
      <span class="setting-label">{$tr('Jam Bursa Donya (StatusBar)', 'Jam Bursa Dunia (StatusBar)', 'World Exchange Clocks (StatusBar)')}</span>
      <span class="setting-desc">{$tr('Ketokno jam bursa New York, London, karo Tokyo plus status bukak/tutup nang ngisor', 'Tampilkan jam bursa New York, London, dan Tokyo beserta status sesi pasar di bilah status', 'Display New York, London, and Tokyo exchange clocks and market session status in the footer')}</span>
    </div>
    <ToggleSwitch
      checked={settings.showWorldClocks !== false}
      ariaLabel="Jam Bursa Dunia"
      onchange={(next) => onUpdateSettings({ showWorldClocks: next })}
    />
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Market Sessions nang Footer (StatusBar)', 'Market Sessions di Footer (StatusBar)', 'Market Sessions Pill in Footer')}</span>
      <span class="setting-desc">{$tr('Ketokno pill interaktif Market Sessions lengkap karo timeline 24 jam & countdown', 'Tampilkan pill interaktif Market Sessions dengan timeline 24 jam & countdown di bilah status', 'Show interactive 24-hour Market Sessions timeline & countdown pill in the status bar')}</span>
    </div>
    <ToggleSwitch
      checked={!isMarketSessionsFooterHidden}
      ariaLabel="Market Sessions di Footer"
      onchange={() => handleToggleMarketSessionsFooter()}
    />
  </div>

  {#if settings.showWorldClocks !== false}
    <div class="setting-sub-row">
      <div class="setting-info">
        <span class="setting-label-sub">{$tr('Pilihan Kutha Sesi Bursa', 'Pilihan Sesi Bursa Aktif', 'Active Exchange Cities')}</span>
        <span class="setting-desc">{$tr('Default: New York, London, Tokyo. Tambahan: Jakarta (IDX) & Sydney (ASX)', 'Bawaan: New York, London, Tokyo. Opsional: Jakarta (IDX) & Sydney (ASX)', 'Default: New York, London, Tokyo. Optional: Jakarta (IDX) & Sydney (ASX)')}</span>
      </div>
      <div class="city-chips-group">
        {#each SUPPORTED_WORLD_CITIES as city (city.id)}
          {@const isEnabled = (settings.worldClockCities ?? DEFAULT_WORLD_CLOCK_CITIES).includes(city.timezone)}
          <button
            type="button"
            class="chip-toggle {isEnabled ? 'active' : ''}"
            onclick={() => handleToggleCity(city.timezone)}
            title="{isEnabled ? $tr('Klik gawe nyingidno', 'Klik untuk sembunyikan', 'Click to hide') : $tr('Klik gawe ngetokno', 'Klik untuk tampilkan', 'Click to show')} {city.label}"
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
      <span class="setting-label">{$tr('Suoro Bel Alert (Audio Chime)', 'Efek Suara Notifikasi (Audio Chime)', 'Notification Sound Chime')}</span>
      <span class="setting-desc">{$tr(' Munekno suoro teng-teng bening pas rega nembus garis Alert', 'Bunyikan nada kristal sintetis saat harga menembus level Alert', 'Play a synthesized crystal chime whenever price crosses an Alert level')}</span>
    </div>
    <ToggleSwitch
      checked={Boolean(settings.soundEnabled)}
      ariaLabel="Efek Suara Notifikasi"
      onchange={(next) => onUpdateSettings({ soundEnabled: next })}
    />
  </div>

  <!-- Notifikasi Desktop Sistem -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Notifikasi Desktop OS', 'Notifikasi Desktop Sistem', 'System Desktop Notifications')}</span>
      <span class="setting-desc">{$tr('Kirim pop-up notifikasi asli nang pojok layar OS (Linux, Windows, macOS) pas alert jeblug', 'Kirim notifikasi native ke pusat notifikasi OS (Linux, Windows, macOS) saat alert terpicu', 'Send native OS desktop notifications (Linux, Windows, macOS) when alerts trigger')}</span>
      {#if testNotificationFeedback}
        <span class="notification-test-feedback mono-nums">{testNotificationFeedback}</span>
      {/if}
    </div>
    <div class="setting-action-group">
      <button
        type="button"
        class="btn-test-notification"
        onclick={handleSendTestNotification}
        title={$tr('Jajal kirim notifikasi tes nang desktop', 'Kirim notifikasi uji coba ke desktop sistem', 'Send a test notification to your desktop')}
      >
        <Bell size={12} />
        <span>{$tr('Jajal Desktop', 'Tes Desktop', 'Test Desktop')}</span>
      </button>
      <ToggleSwitch
        checked={settings.systemNotificationEnabled !== false}
        ariaLabel="Notifikasi Desktop Sistem"
        onchange={(next) => onUpdateSettings({ systemNotificationEnabled: next })}
      />
    </div>
  </div>

  <!-- Notifikasi Bot Telegram -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Notifikasi Bot Telegram', 'Notifikasi Bot Telegram', 'Telegram Bot Notifications')}</span>
      <span class="setting-desc">{$tr('Terusno Price Alert & Pine Script Alert langsung nang chat utawa grup Telegram-mu', 'Teruskan Price Alert & Pine Script Alert ke chat atau grup Telegram Anda', 'Forward Price Alerts & Pine Script Alerts straight to your Telegram chat or group')}</span>
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
        title={isTelegramConfigValid ? $tr('Kirim pesen tes nang Bot Telegram', 'Kirim pesan tes ke Bot Telegram', 'Send test message to Telegram Bot') : $tr('Isien dhisik Bot Token karo Chat ID', 'Lengkapi Bot Token & Chat ID terlebih dahulu', 'Fill in Bot Token & Chat ID first')}
      >
        <Send size={12} />
        <span>{isTestingTelegram ? $tr('Ngirim...', 'Mengirim...', 'Sending...') : $tr('Jajal Telegram', 'Tes Telegram', 'Test Telegram')}</span>
      </button>
      <ToggleSwitch
        checked={Boolean(settings.telegramNotificationEnabled)}
        ariaLabel="Notifikasi Bot Telegram"
        onchange={(next) => onUpdateSettings({ telegramNotificationEnabled: next })}
      />
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
            placeholder={$tr('Conto: 123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ', 'Contoh: 123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ', 'Example: 123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ')}
            value={settings.telegramBotToken || ''}
            oninput={(e) => onUpdateSettings({ telegramBotToken: e.currentTarget.value })}
            onchange={(e) => onUpdateSettings({ telegramBotToken: e.currentTarget.value.trim() })}
            autocomplete="off"
          />
          <button
            type="button"
            class="secret-toggle-btn"
            onclick={() => (showTelegramToken = !showTelegramToken)}
            title={showTelegramToken ? $tr('Singidno Token', 'Sembunyikan Token', 'Hide Token') : $tr('Delok Token', 'Lihat Token', 'Show Token')}
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
          placeholder={$tr('Conto: 123456789 utawa -100...', 'Contoh: 123456789 atau -100...', 'Example: 123456789 or -100...')}
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
      <span class="setting-label">{$tr('Notifikasi Webhook Discord', 'Notifikasi Webhook Discord', 'Discord Webhook Notifications')}</span>
      <span class="setting-desc">{$tr('Kirim Rich Embed mbois nang channel Discord-mu pas Price Alert utawa Pine Alert muni', 'Kirim Rich Embed ke channel Discord Anda saat Price Alert atau Pine Alert terpicu', 'Post Rich Embeds to your Discord channel when Price Alerts or Pine Alerts fire')}</span>
      {#if discordTestFeedback}
        <span class="notification-test-feedback {discordTestFeedback.ok ? '' : 'error'} mono-nums">
          {discordTestFeedback.text}
        </span>
      {:else if hasDiscordInput && !isDiscordUrlValid}
        <span class="notification-test-feedback error mono-nums">
          ⚠ {$tr('URL kudu diawali https://discord.com/api/webhooks/', 'URL harus diawali https://discord.com/api/webhooks/', 'URL must start with https://discord.com/api/webhooks/')}
        </span>
      {/if}
    </div>
    <div class="setting-action-group">
      <button
        type="button"
        class="btn-test-notification"
        disabled={isTestingDiscord || !isDiscordUrlValid}
        onclick={handleSendTestDiscord}
        title={isDiscordUrlValid ? $tr('Kirim pesen tes nang Discord Webhook', 'Kirim pesan tes ke Discord Webhook', 'Send test message to Discord Webhook') : $tr('Lebokno URL Webhook Discord sing bener dhisik', 'Masukkan URL Webhook Discord yang valid terlebih dahulu', 'Enter a valid Discord Webhook URL first')}
      >
        <MessageSquare size={12} />
        <span>{isTestingDiscord ? $tr('Ngirim...', 'Mengirim...', 'Sending...') : $tr('Jajal Discord', 'Tes Discord', 'Test Discord')}</span>
      </button>
      <ToggleSwitch
        checked={Boolean(settings.discordNotificationEnabled)}
        ariaLabel="Notifikasi Webhook Discord"
        onchange={(next) => onUpdateSettings({ discordNotificationEnabled: next })}
      />
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
          title={showDiscordWebhook ? $tr('Singidno URL', 'Sembunyikan URL', 'Hide URL') : $tr('Delok URL', 'Lihat URL', 'Show URL')}
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
      <span class="setting-label">{$tr('Tema Werna Terminal', 'Tema Visual Antarmuka', 'Active Interface Theme')}</span>
      <span class="setting-desc">{$tr('Racikan werna sing saiki kepasang', 'Skema warna yang saat ini aktif', 'Currently active color scheme')}</span>
    </div>
    <button
      type="button"
      class="toggle-btn active"
      onclick={() => onNavigateTab?.('appearance')}
      title={$tr('Bukak tab Tema & Werna', 'Buka tab Tema & Tipografi', 'Open Themes & Colors tab')}
    >
      <Palette size={13} />
      <span>{resolveThemeConfig(settings.themePreset || 'signature', settings.savedUserThemes)?.name || 'trawangan (Signature)'}</span>
    </button>
  </div>

  <!-- Pengaturan Tangkapan Layar & Snapshot (#95 & Save Directory Setting) -->
  <div class="section-divider"></div>
  <h4 class="section-title">{$tr('Jepretan Layar & Snapshot Chart', 'Tangkapan Layar & Snapshot Grafik', 'Chart Screenshots & Snapshots')}</h4>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Folder Nyimpen Snapshot', 'Folder Penyimpanan Snapshot', 'Snapshot Save Directory')}</span>
      <span class="setting-desc">{$tr('Panggon folder nyimpen file gambar PNG pas koen undhuh snapshot', 'Lokasi direktori penyimpanan berkas gambar PNG saat snapshot diunduh', 'Folder path where exported PNG chart snapshots are saved')}</span>
    </div>
    <div class="directory-setting-group">
      <input
        type="text"
        class="directory-input mono-nums"
        placeholder={$tr('Default: Folder Downloads OS', 'Bawaan: Folder Downloads OS', 'Default: OS Downloads Folder')}
        value={settings.snapshotDirectory || ''}
        onchange={(e) => onUpdateSettings({ snapshotDirectory: e.currentTarget.value.trim() })}
      />
      <button
        type="button"
        class="btn-pick-folder"
        title={$tr('Pilih folder liwat dialog asli sistem operasi', 'Pilih folder penyimpanan via dialog native sistem operasi', 'Pick save folder via native OS dialog')}
        onclick={handlePickSnapshotDirectory}
      >
        <FolderOpen size={13} />
        <span>{$tr('Pilih Folder...', 'Pilih Folder...', 'Choose Folder...')}</span>
      </button>
      <button
        type="button"
        class="btn-open-folder"
        title={$tr('Bukak folder nang File Manager', 'Buka folder penyimpanan di File Manager', 'Open folder in File Manager')}
        onclick={() => openSnapshotFolder(settings.snapshotDirectory)}
      >
        <Folder size={13} />
        <span>{$tr('Bukak Folder', 'Buka Folder', 'Open Folder')}</span>
      </button>
    </div>
  </div>

  <div class="setting-sub-row">
    <div class="setting-info">
      <span class="setting-label-sub">{$tr('Pilihan Cepet Folder', 'Pilihan Cepat Direktori', 'Quick Folder Presets')}</span>
      <span class="setting-desc">{$tr('Pilih folder standar utawa ketik path folder karepmu nang dhuwur', 'Pilih jalur direktori standar atau ketik path folder kustom di atas', 'Select a standard folder preset or enter a custom path above')}</span>
    </div>
    <div class="dir-chips-group">
      <button
        type="button"
        class="chip-toggle {(!settings.snapshotDirectory || settings.snapshotDirectory === '') ? 'active' : ''}"
        onclick={() => onUpdateSettings({ snapshotDirectory: '' })}
      >
        <span class="chip-dot"></span>
        <span>{$tr('Downloads (Default)', 'Downloads (Bawaan)', 'Downloads (Default)')}</span>
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
      <span class="setting-label">{$tr('Model Ekspor Snapshot Default', 'Gaya Ekspor Snapshot Bawaan', 'Default Snapshot Export Style')}</span>
      <span class="setting-desc">{$tr('Kartu mbois lengkap karo Attribution Bar utawa kanvas resik polosan', 'Format kartu showcase dengan Attribution Bar atau kanvas murni', 'Showcase card with Attribution Bar or raw chart canvas')}</span>
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
      <span class="setting-label">{$tr('Katutno Rega Terakhir (Attribution Bar)', 'Sertakan Harga Terakhir (Attribution Bar)', 'Include Last Price (Attribution Bar)')}</span>
      <span class="setting-desc">{$tr('Ketokno badge rega market aktif nang baris ngisor snapshot', 'Tampilkan badge harga pasar aktif di bilah footer snapshot', 'Show active market price badge on the snapshot attribution bar')}</span>
    </div>
    <ToggleSwitch
      checked={settings.snapshotIncludePrice !== false}
      ariaLabel="Sertakan Harga Terakhir"
      onchange={(next) => onUpdateSettings({ snapshotIncludePrice: next })}
    />
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Katutno Jam Analisa', 'Sertakan Waktu Analisis', 'Include Analysis Timestamp')}</span>
      <span class="setting-desc">{$tr('Ketokno tanggal karo jam lokal pas chart dijepret', 'Tampilkan stempel tanggal dan jam lokal saat grafik ditangkap', 'Display local date and time stamp when the chart was captured')}</span>
    </div>
    <ToggleSwitch
      checked={settings.snapshotIncludeTimestamp !== false}
      ariaLabel="Sertakan Waktu Analisis"
      onchange={(next) => onUpdateSettings({ snapshotIncludeTimestamp: next })}
    />
  </div>
</div>

<!-- Timeframe & Workspace Persistence -->
<div class="section-group" style="margin-top: 16px;">
  <h4 class="section-title">{$tr('Timeframe & Simpenan Workspace', 'Timeframe & Penyimpanan Workspace', 'Timeframe & Workspace Persistence')}</h4>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Timeframe Default (Aplikasi & Multi-Chart)', 'Timeframe Default (Aplikasi & Multi-Chart)', 'Default Timeframe (App & Multi-Chart)')}</span>
      <span class="setting-desc">{$tr('Timeframe candle awal pas mbukak aplikasi utawa mbukak panel anyar', 'Interval lilin bawaan saat aplikasi dibuka dan saat panel baru terbentuk', 'Initial candle interval when launching the app or spawning new panes')}</span>
    </div>
    <select
      class="select-input mono-nums"
      value={settings.defaultTimeframe || '15m'}
      onchange={(e) => onUpdateSettings({ defaultTimeframe: e.currentTarget.value as any })}
    >
      <optgroup label={$tr('Menitan', 'Menit', 'Minutes')}>
        <option value="1m">1m (1 {$tr('Menit', 'Menit', 'Min')})</option>
        <option value="3m">3m (3 {$tr('Menit', 'Menit', 'Min')})</option>
        <option value="5m">5m (5 {$tr('Menit', 'Menit', 'Min')})</option>
        <option value="15m">15m (15 {$tr('Menit - Day Trading', 'Menit - Day Trading', 'Min - Day Trading')})</option>
        <option value="30m">30m (30 {$tr('Menit', 'Menit', 'Min')})</option>
        <option value="45m">45m (45 {$tr('Menit', 'Menit', 'Min')})</option>
      </optgroup>
      <optgroup label={$tr('Jaman', 'Jam', 'Hours')}>
        <option value="1h">1h (1 {$tr('Jam - Swing MTF', 'Jam - Swing MTF', 'Hour - Swing MTF')})</option>
        <option value="2h">2h (2 {$tr('Jam', 'Jam', 'Hours')})</option>
        <option value="4h">4h (4 {$tr('Jam - HTF Analisa', 'Jam - HTF Analisis', 'Hours - HTF Analysis')})</option>
        <option value="6h">6h (6 {$tr('Jam', 'Jam', 'Hours')})</option>
        <option value="12h">12h (12 {$tr('Jam', 'Jam', 'Hours')})</option>
      </optgroup>
      <optgroup label={$tr('Dinoan & Mingguan', 'Hari & Pekan', 'Days & Weeks')}>
        <option value="1D">1D (1 {$tr('Dino - Trend Utama', 'Hari - Trend Utama', 'Day - Primary Trend')})</option>
        <option value="1W">1W (1 {$tr('Minggu', 'Pekan', 'Week')})</option>
        <option value="1M">1M (1 {$tr('Wulan', 'Bulan', 'Month')})</option>
      </optgroup>
    </select>
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Simpen Otomatis Workspace (Auto-Save)', 'Penyimpanan Otomatis Workspace (Auto-Save)', 'Auto-Save Workspace')}</span>
      <span class="setting-desc">{$tr('Simpen otomatis tata letak grid, koin, karo oprekanmu pas lagi nganalisa', 'Simpan otomatis tata letak grid, simbol, dan perubahan workspace saat bekerja', 'Automatically persist grid layout, symbols, and workspace edits while working')}</span>
    </div>
    <ToggleSwitch
      checked={settings.autoSaveWorkspace !== false}
      ariaLabel="Penyimpanan Otomatis Workspace"
      onchange={(next) => onUpdateSettings({ autoSaveWorkspace: next })}
    />
  </div>

  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">{$tr('Bukak Workspace Terakhir pas Startup', 'Muat Workspace Terakhir saat Startup', 'Restore Last Workspace on Startup')}</span>
      <span class="setting-desc">{$tr('Langsung mbukak workspace, koin, indikator, karo layout terakhirmu pas aplikasi urip', 'Otomatis memuat workspace, simbol, indikator, dan tata letak terakhir saat aplikasi dibuka', 'Automatically reload your last active workspace, symbols, and indicators on launch')}</span>
    </div>
    <ToggleSwitch
      checked={settings.autoLoadLastWorkspace !== false}
      ariaLabel="Muat Workspace Terakhir saat Startup"
      onchange={(next) => onUpdateSettings({ autoLoadLastWorkspace: next })}
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
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim);
    margin: 0 0 6px 2px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 14px;
    background-color: var(--bg-panel);
    border: none;
    border-radius: var(--radius-md, 6px);
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
    border: 1px solid transparent;
    color: var(--text-main);
    font-size: 11.5px;
    padding: 6px 10px;
    border-radius: var(--radius-md, 6px);
    outline: none;
    cursor: pointer;
    transition: border-color 0.14s ease;
  }

  .select-input:focus {
    border-color: var(--brand-primary);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-elevated);
    border: none;
    color: var(--text-muted);
    font-size: 11.5px;
    font-weight: 500;
    padding: 6px 11px;
    border-radius: var(--radius-sm, 5px);
    cursor: pointer;
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  .toggle-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .toggle-btn.active {
    background-color: color-mix(in srgb, var(--brand-primary) 14%, transparent);
    color: var(--brand-primary);
  }

  .setting-action-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-test-notification {
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--bg-elevated);
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-sm, 5px);
    cursor: pointer;
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  .btn-test-notification:hover:not(:disabled) {
    background-color: var(--bg-hover);
    color: var(--text-main);
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
    border: 1px solid transparent;
    color: var(--text-main);
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-md, 6px);
    outline: none;
    transition: border-color 0.14s ease;
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
    background-color: var(--bg-elevated);
    border: none;
    color: var(--text-muted);
    padding: 6px 8px;
    border-radius: var(--radius-sm, 5px);
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.12s ease, color 0.12s ease;
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
    padding: 10px 14px 10px 18px;
    background-color: var(--bg-container);
    border: none;
    border-radius: var(--radius-md, 6px);
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
    background-color: var(--bg-elevated);
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-family: var(--font-mono);
    padding: 4px 9px;
    border-radius: var(--radius-sm, 5px);
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .chip-toggle:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .chip-toggle.active {
    color: var(--brand-primary);
    background-color: color-mix(in srgb, var(--brand-primary) 14%, transparent);
  }

  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--text-dim);
  }

  .chip-toggle.active .chip-dot {
    background-color: var(--brand-primary);
    box-shadow: 0 0 5px color-mix(in srgb, var(--brand-primary) 60%, transparent);
  }

  .section-divider {
    height: 10px;
  }

  .directory-setting-group {
    display: flex;
    align-items: center;
    gap: 6px;
    width: auto;
    max-width: 440px;
  }

  .directory-input {
    flex: 1;
    min-width: 130px;
    background-color: var(--bg-surface);
    border: 1px solid transparent;
    color: var(--text-main);
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-md, 6px);
    outline: none;
    transition: border-color 0.14s ease;
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
    background-color: var(--bg-elevated);
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-sm, 5px);
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  .btn-pick-folder:hover,
  .btn-open-folder:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .dir-chips-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
</style>
