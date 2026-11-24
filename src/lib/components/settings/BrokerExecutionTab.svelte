<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ShieldAlert,
    Check,
    Lock,
    Unlock,
    BookOpen,
    Download,
    RefreshCw,
    Trash2,
    Eye,
    EyeOff,
    Zap,
    Copy,
    ChevronDown
  } from '@lucide/svelte';
  import type { AppSettings, BrokerId } from '../../types/market';
  import {
    listBrokerConfigs,
    saveBrokerCredentials,
    verifyBrokerConnection,
    deleteBrokerCredentials,
    isRiskAcknowledgementValid,
    downloadMt5ExpertAdvisorFile,
    type BrokerConfigPublic
  } from '../../services/brokerBridgeService';
  import { generateMt5ExpertAdvisorSource } from '../../data/mt5BridgeAdvisorTemplate';
  import ToggleSwitch from '../common/ToggleSwitch.svelte';
  import { t, tr, trInstant } from '../../i18n';

  interface Props {
    settings: AppSettings;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
  }

  let { settings, onUpdateSettings }: Props = $props();

  let confirmWord = $state('');
  let riskCheckbox = $state(false);
  let selectedSetupBroker = $state<BrokerId>('binance');
  let configs = $state<BrokerConfigPublic[]>([]);
  let isLoadingConfigs = $state(false);

  // Form states
  let binanceMode = $state<'futures' | 'spot'>('futures');
  let binanceApiKey = $state('');
  let binanceSecret = $state('');
  let showBinanceSecret = $state(false);

  let bitunixApiKey = $state('');
  let bitunixSecret = $state('');
  let showBitunixSecret = $state(false);

  let mt5Endpoint = $state('http://127.0.0.1:15555');
  let mt5Token = $state('trawangan-mt5-local');
  let showMt5Code = $state(false);
  let copiedEa = $state(false);

  let isSavingOrTesting = $state(false);
  let feedback = $state<{ ok: boolean; text: string } | null>(null);
  let openGuide = $state<'binance' | 'bitunix' | 'mt5' | null>('binance');

  const isRiskUnlocked = $derived(Boolean(settings.executionRiskAccepted));
  const canUnlockRisk = $derived(riskCheckbox && isRiskAcknowledgementValid(confirmWord));

  const verifiedCount = $derived(configs.filter((c) => c.is_verified).length);
  const activeBrokerConfig = $derived(
    configs.find((c) => c.broker_id === selectedSetupBroker) || null
  );

  async function reloadConfigs() {
    isLoadingConfigs = true;
    try {
      configs = await listBrokerConfigs();
      const mt5Cfg = configs.find((c) => c.broker_id === 'mt5');
      if (mt5Cfg?.endpoint_url) {
        mt5Endpoint = mt5Cfg.endpoint_url;
      }
      const binCfg = configs.find((c) => c.broker_id === 'binance');
      if (binCfg?.market_mode === 'spot' || binCfg?.market_mode === 'futures') {
        binanceMode = binCfg.market_mode;
      }
    } catch (err: any) {
      feedback = { ok: false, text: err?.message || 'Gagal memuat konfigurasi broker.' };
    } finally {
      isLoadingConfigs = false;
    }
  }

  onMount(() => {
    void reloadConfigs();
  });

  function handleUnlockStep1() {
    if (!canUnlockRisk) return;
    onUpdateSettings({ executionRiskAccepted: true });
    confirmWord = '';
  }

  async function handleSaveAndVerify(brokerId: BrokerId) {
    if (isSavingOrTesting) return;
    isSavingOrTesting = true;
    feedback = null;

    try {
      if (brokerId === 'binance') {
        await saveBrokerCredentials({
          broker_id: 'binance',
          market_mode: binanceMode,
          api_key: binanceApiKey,
          api_secret: binanceSecret,
          endpoint_url: binanceMode === 'spot' ? 'https://api.binance.com' : 'https://fapi.binance.com'
        });
        binanceSecret = '';
      } else if (brokerId === 'bitunix') {
        await saveBrokerCredentials({
          broker_id: 'bitunix',
          market_mode: 'futures',
          api_key: bitunixApiKey,
          api_secret: bitunixSecret,
          endpoint_url: 'https://fapi.bitunix.com'
        });
        bitunixSecret = '';
      } else {
        await saveBrokerCredentials({
          broker_id: 'mt5',
          market_mode: 'cfd',
          api_key: 'MT5_LOCAL',
          api_secret: mt5Token,
          endpoint_url: mt5Endpoint
        });
      }

      const summary = await verifyBrokerConnection(brokerId);
      await reloadConfigs();
      onUpdateSettings({ activeBrokerId: brokerId });
      feedback = {
        ok: true,
        text: trInstant(
          `✓ Mantap nyambung! ${summary.server_info} · Saldo: ${summary.balance.toFixed(2)} ${summary.currency}`,
          `✓ Terverifikasi! ${summary.server_info} · Saldo: ${summary.balance.toFixed(2)} ${summary.currency}`,
          `✓ Verified! ${summary.server_info} · Balance: ${summary.balance.toFixed(2)} ${summary.currency}`
        )
      };
    } catch (err: any) {
      await reloadConfigs();
      feedback = {
        ok: false,
        text: `⚠ ${trInstant('Gagal verifikasi', 'Verifikasi gagal', 'Verification failed')}: ${err?.message || String(err)}`
      };
    } finally {
      isSavingOrTesting = false;
    }
  }

  async function handleSaveCredentialsOnly(brokerId: BrokerId) {
    if (isSavingOrTesting) return;
    isSavingOrTesting = true;
    feedback = null;
    try {
      if (brokerId === 'binance') {
        await saveBrokerCredentials({
          broker_id: 'binance',
          market_mode: binanceMode,
          api_key: binanceApiKey,
          api_secret: binanceSecret
        });
        binanceSecret = '';
      } else if (brokerId === 'bitunix') {
        await saveBrokerCredentials({
          broker_id: 'bitunix',
          market_mode: 'futures',
          api_key: bitunixApiKey,
          api_secret: bitunixSecret
        });
        bitunixSecret = '';
      } else {
        await saveBrokerCredentials({
          broker_id: 'mt5',
          market_mode: 'cfd',
          api_key: 'MT5_LOCAL',
          api_secret: mt5Token,
          endpoint_url: mt5Endpoint
        });
      }
      await reloadConfigs();
      feedback = {
        ok: true,
        text: trInstant(
          'Kunci API wis disimpen terenkripsi nang SQLite lokal. Klik tombol Verifikasi gawe ngetes sambungan!',
          'Kredensial disimpan terenkripsi di SQLite lokal. Klik "Simpan & Tes Koneksi (Verifikasi)" untuk mengaktifkan.',
          'Credentials encrypted in local SQLite. Click "Save & Test Connection (Verify)" to activate.'
        )
      };
    } catch (err: any) {
      feedback = { ok: false, text: err?.message || String(err) };
    } finally {
      isSavingOrTesting = false;
    }
  }

  async function handleDeleteBroker(brokerId: BrokerId) {
    await deleteBrokerCredentials(brokerId);
    await reloadConfigs();
    if (configs.filter((c) => c.is_verified).length === 0) {
      onUpdateSettings({ executionBridgeEnabled: false });
    }
    feedback = {
      ok: true,
      text: trInstant(
        `Kunci API ${brokerId.toUpperCase()} wis dibusek resik teko PC-mu.`,
        `Kredensial ${brokerId.toUpperCase()} dihapus bersih dari perangkat.`,
        `${brokerId.toUpperCase()} credentials wiped from this device.`
      )
    };
  }

  async function handleCopyMt5Source() {
    const code = generateMt5ExpertAdvisorSource(15555, mt5Token || 'trawangan-mt5-local');
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
      copiedEa = true;
      setTimeout(() => (copiedEa = false), 1800);
    }
  }
</script>

<div class="broker-tab-pane">
  <div class="hero-header">
    <div class="hero-left">
      <div class="hero-icon">
        <Zap size={18} />
      </div>
      <div>
        <h3 class="hero-title">{$t('broker.tabTitle')}</h3>
        <p class="hero-sub">{$t('broker.tabSubtitle')}</p>
      </div>
    </div>

    <span class="status-pill mono-nums {settings.executionBridgeEnabled ? 'on' : 'off'}">
      {settings.executionBridgeEnabled ? 'BRIDGE ACTIVE' : 'DEFAULT OFF'}
    </span>
  </div>

  <!-- STEP 1: RISK GATE -->
  {#if !isRiskUnlocked}
    <div class="gate-card warning-gate">
      <div class="gate-title-row">
        <ShieldAlert size={16} class="text-warn" />
        <h4>{$t('broker.step1Title')}</h4>
      </div>
      <p class="gate-body">{$t('broker.step1Warn')}</p>

      <ul class="safety-rules">
        <li>{$tr('API Secret dikunci rapet nang lapisan Rust lokal (SQLite broker_credentials), blas gak dikirim nang server sopo-sopo.', 'Kredensial API Secret dienkripsi di lapisan Rust lokal (SQLite broker_credentials), nol pengiriman ke server pihak ketiga.', 'API Secrets are encrypted inside the local Rust layer (broker_credentials SQLite) with zero third-party cloud relays.')}</li>
        <li><strong>{$tr('WAJIB PATENI izin Tarik Duit (Withdrawal OFF) pas nggawe API Key nang Binance utawa Bitunix, Cok!', 'Wajib matikan izin Penarikan Dana (Withdrawal OFF) saat membuat API Key di Binance maupun Bitunix.', 'ALWAYS keep Withdrawal permission OFF when creating API Keys on Binance or Bitunix.')}</strong></li>
        <li><strong>{$tr('Terpisah tegas teko Trade Plan:', 'Terpisah tegas dari Trade Plan:', 'Strictly decoupled from Trade Plans:')}</strong> {$tr('nggambar Trade Plan gak bakal tau nembak order dewe. Kabeh order kudu koen ketik lan pencet manual nang tab Order.', 'menggambar Trade Plan tidak akan pernah memicu order otomatis. Seluruh order wajib Anda ketik dan konfirmasi manual di tab Order.', 'drawing a Trade Plan never triggers automated orders. Every order must be typed and confirmed manually inside the Order tab.')}</li>
      </ul>

      <label class="ack-checkbox">
        <input type="checkbox" bind:checked={riskCheckbox} />
        <span>{$tr('Aku paham kabeh risiko eksekusi manual lan wani tanggung jawab 100% atas akunku dewe!', 'Saya paham seluruh risiko eksekusi manual dan bertanggung jawab penuh atas akun broker saya sendiri.', 'I understand all manual execution risks and accept full responsibility for my own brokerage accounts.')}</span>
      </label>

      <div class="unlock-row">
        <input
          type="text"
          class="confirm-input mono-nums"
          placeholder={$t('broker.step1ConfirmPlaceholder')}
          bind:value={confirmWord}
        />
        <button
          type="button"
          class="unlock-btn"
          disabled={!canUnlockRisk}
          onclick={handleUnlockStep1}
        >
          <Unlock size={13} />
          <span>{$t('broker.step1UnlockBtn')}</span>
        </button>
      </div>
    </div>
  {:else}
    <!-- MASTER SWITCH -->
    <div class="master-switch-card">
      <div class="switch-info">
        <span class="switch-title">{$t('broker.masterSwitchLabel')}</span>
        <span class="switch-desc">
          {$t('broker.masterSwitchDesc')}
          {#if verifiedCount === 0}
            <strong class="text-warn"> {$tr('(Verifikasi minimal 1 broker nang ngisor dhisik, Rek!)', '(Verifikasi minimal 1 broker di bawah terlebih dahulu)', '(Verify at least 1 broker below first)')}</strong>
          {/if}
        </span>
      </div>
      <ToggleSwitch
        checked={Boolean(settings.executionBridgeEnabled)}
        ariaLabel="Master Execution Bridge"
        onchange={(next) => {
          if (next && verifiedCount === 0) {
            feedback = {
              ok: false,
              text: trInstant(
                '⚠ Simpen lan klik "Simpen & Jajal Sambungan (Verifikasi)" nang salah siji broker dhisik sakdurunge muripno Master Switch!',
                '⚠ Simpan dan klik "Simpan & Tes Koneksi (Verifikasi)" pada salah satu broker terlebih dahulu sebelum menyalakan Master Switch.',
                '⚠ Save and click "Save & Test Connection (Verify)" on at least one broker before enabling the Master Switch.'
              )
            };
            return;
          }
          onUpdateSettings({ executionBridgeEnabled: next });
        }}
      />
    </div>

    {#if feedback}
      <div class="feedback-banner {feedback.ok ? 'ok' : 'err'} mono-nums">
        {feedback.text}
      </div>
    {/if}

    <!-- STEP 2: BROKER SELECTOR & CREDENTIAL SETUP -->
    <div class="broker-tabs-bar">
      {#each [
        { id: 'binance' as BrokerId, label: '1. Binance (Spot / Futures)' },
        { id: 'bitunix' as BrokerId, label: '2. Bitunix (Perpetual)' },
        { id: 'mt5' as BrokerId, label: '3. Broker CFD / MetaTrader 5' }
      ] as b (b.id)}
        {@const cfg = configs.find((c) => c.broker_id === b.id)}
        <button
          type="button"
          class="broker-pill {selectedSetupBroker === b.id ? 'active' : ''}"
          onclick={() => {
            selectedSetupBroker = b.id;
            openGuide = b.id;
            feedback = null;
          }}
        >
          <span>{b.label}</span>
          {#if cfg?.is_verified}
            <span class="verified-dot" title={$tr('Wis Verifikasi', 'Terverifikasi', 'Verified')}>✓</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- CONFIGURATION FORM PER BROKER -->
    <div class="config-card">
      {#if activeBrokerConfig}
        <div class="saved-status-bar mono-nums">
          <span>
            {$tr('Status Kesimpen:', 'Status Tersimpan:', 'Saved Status:')}
            <strong class={activeBrokerConfig.is_verified ? 'text-bull' : 'text-warn'}>
              {activeBrokerConfig.is_verified ? 'VERIFIED & READY' : 'UNVERIFIED'}
            </strong>
            {#if activeBrokerConfig.api_key_masked}
              · Key: {activeBrokerConfig.api_key_masked}
            {/if}
          </span>
          <button
            type="button"
            class="btn-delete-cred"
            onclick={() => handleDeleteBroker(selectedSetupBroker)}
          >
            <Trash2 size={12} />
            <span>{$tr('Busek Kunci API', 'Hapus Kredensial', 'Delete Credentials')}</span>
          </button>
        </div>
      {/if}

      {#if selectedSetupBroker === 'binance'}
        <div class="form-grid">
          <div class="field">
            <label for="bin-mode">{$tr('Mode Market Binance', 'Mode Pasar Binance', 'Binance Market Mode')}</label>
            <select id="bin-mode" class="input-ctrl" bind:value={binanceMode}>
              <option value="futures">USDⓈ-M Perpetual Futures (fapi.binance.com)</option>
              <option value="spot">Spot Market (api.binance.com)</option>
            </select>
          </div>

          <div class="field">
            <label for="bin-key">Binance API Key</label>
            <input
              id="bin-key"
              type="text"
              class="input-ctrl mono-nums"
              placeholder={activeBrokerConfig?.api_key_masked || $tr('Paste API Key Binance...', 'Tempel API Key Binance...', 'Paste Binance API Key...')}
              bind:value={binanceApiKey}
              autocomplete="off"
            />
          </div>

          <div class="field full">
            <label for="bin-sec">{$tr('Binance API Secret (Dienkripsi Lokal)', 'Binance API Secret (Dienkripsi Lokal)', 'Binance API Secret (Encrypted Locally)')}</label>
            <div class="secret-row">
              <input
                id="bin-sec"
                type={showBinanceSecret ? 'text' : 'password'}
                class="input-ctrl mono-nums"
                placeholder={activeBrokerConfig?.has_secret ? $tr('•••••••••••••••• (Wis kesimpen aman)', '•••••••••••••••• (Tersimpan terenkripsi)', '•••••••••••••••• (Stored encrypted)') : $tr('Paste Secret Key Binance...', 'Tempel Secret Key Binance...', 'Paste Binance Secret Key...')}
                bind:value={binanceSecret}
                autocomplete="off"
              />
              <button type="button" class="icon-btn" onclick={() => (showBinanceSecret = !showBinanceSecret)}>
                {#if showBinanceSecret}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
              </button>
            </div>
          </div>
        </div>
      {:else if selectedSetupBroker === 'bitunix'}
        <div class="form-grid">
          <div class="field">
            <label for="bx-key">Bitunix API Key</label>
            <input
              id="bx-key"
              type="text"
              class="input-ctrl mono-nums"
              placeholder={activeBrokerConfig?.api_key_masked || $tr('Paste API Key Bitunix...', 'Tempel API Key Bitunix...', 'Paste Bitunix API Key...')}
              bind:value={bitunixApiKey}
              autocomplete="off"
            />
          </div>

          <div class="field">
            <label for="bx-sec">{$tr('Bitunix Secret Key (Dienkripsi Lokal)', 'Bitunix Secret Key (Dienkripsi Lokal)', 'Bitunix Secret Key (Encrypted Locally)')}</label>
            <div class="secret-row">
              <input
                id="bx-sec"
                type={showBitunixSecret ? 'text' : 'password'}
                class="input-ctrl mono-nums"
                placeholder={activeBrokerConfig?.has_secret ? $tr('•••••••••••••••• (Wis kesimpen aman)', '•••••••••••••••• (Tersimpan terenkripsi)', '•••••••••••••••• (Stored encrypted)') : $tr('Paste Secret Key Bitunix...', 'Tempel Secret Key Bitunix...', 'Paste Bitunix Secret Key...')}
                bind:value={bitunixSecret}
                autocomplete="off"
              />
              <button type="button" class="icon-btn" onclick={() => (showBitunixSecret = !showBitunixSecret)}>
                {#if showBitunixSecret}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div class="form-grid">
          <div class="field">
            <label for="mt5-url">{$tr('Alamat Local MT5 Socket Bridge', 'Endpoint Local MT5 Socket Bridge', 'Local MT5 Socket Bridge Endpoint')}</label>
            <input
              id="mt5-url"
              type="text"
              class="input-ctrl mono-nums"
              placeholder="http://127.0.0.1:15555"
              bind:value={mt5Endpoint}
            />
          </div>

          <div class="field">
            <label for="mt5-tok">{$tr('Local Security Token (Padakno karo Input EA MT5)', 'Local Security Token (Samakan di Input EA MT5)', 'Local Security Token (Match with MT5 EA Input)')}</label>
            <input
              id="mt5-tok"
              type="text"
              class="input-ctrl mono-nums"
              placeholder="trawangan-mt5-local"
              bind:value={mt5Token}
            />
          </div>
        </div>

        <div class="mt5-ea-actions">
          <button
            type="button"
            class="btn-ea-download"
            onclick={() => downloadMt5ExpertAdvisorFile(15555, mt5Token || 'trawangan-mt5-local')}
          >
            <Download size={13} />
            <span>{$tr('Undhuh File EA', 'Unduh File EA', 'Download EA File')} <code>TrawanganMT5Bridge.mq5</code></span>
          </button>

          <button type="button" class="btn-secondary" onclick={handleCopyMt5Source}>
            {#if copiedEa}
              <Check size={13} />
              <span>{$tr('Kode MQL5 Wis Kesalin!', 'Kode MQL5 Tersalin!', 'MQL5 Source Copied!')}</span>
            {:else}
              <Copy size={13} />
              <span>{$tr('Salin Kode MQL5', 'Salin Kode Sumber MQL5', 'Copy MQL5 Source Code')}</span>
            {/if}
          </button>

          <button type="button" class="btn-secondary" onclick={() => (showMt5Code = !showMt5Code)}>
            <span>{showMt5Code ? $tr('Singidno Kode', 'Sembunyikan Kode', 'Hide EA Code') : $tr('Delok Kode EA', 'Lihat Kode EA', 'View EA Code')}</span>
          </button>
        </div>

        {#if showMt5Code}
          <pre class="ea-code-preview mono-nums">{generateMt5ExpertAdvisorSource(15555, mt5Token || 'trawangan-mt5-local')}</pre>
        {/if}
      {/if}

      <div class="action-buttons-row">
        <button
          type="button"
          class="btn-secondary"
          disabled={isSavingOrTesting}
          onclick={() => handleSaveCredentialsOnly(selectedSetupBroker)}
        >
          <Lock size={13} />
          <span>{$tr('Simpen Terenkripsi', 'Simpan Terenkripsi', 'Save Encrypted')}</span>
        </button>

        <button
          type="button"
          class="btn-verify"
          disabled={isSavingOrTesting}
          onclick={() => handleSaveAndVerify(selectedSetupBroker)}
        >
          <RefreshCw size={13} class={isSavingOrTesting ? 'spin' : ''} />
          <span>{isSavingOrTesting ? $tr('Ngetes Sambungan...', 'Menguji Koneksi...', 'Testing Connection...') : $tr('Simpen & Jajal Sambungan (Verifikasi)', 'Simpan & Tes Koneksi (Verifikasi)', 'Save & Test Connection (Verify)')}</span>
        </button>
      </div>
    </div>

    <!-- COMPLETE STEP-BY-STEP USER TUTORIAL -->
    <div class="tutorial-section">
      <div class="tutorial-header">
        <BookOpen size={14} class="text-cyan" />
        <h4>{$tr('Tutorial Komplit Setup Broker teko Nol (Step-by-Step)', 'Panduan Lengkap Setup Broker untuk Pengguna (Step-by-Step)', 'Complete Step-by-Step Broker Setup Guide')}</h4>
      </div>

      <!-- Tutorial 1: Binance -->
      <div class="guide-accordion">
        <button
          type="button"
          class="guide-trigger"
          onclick={() => (openGuide = openGuide === 'binance' ? null : 'binance')}
        >
          <span>📘 {$tr('Tutorial Setup API Key Binance (Spot & USDⓈ-M Futures)', 'Tutorial Lengkap Setup API Key Binance (Spot & USDⓈ-M Futures)', 'Binance API Key Setup Guide (Spot & USDⓈ-M Futures)')}</span>
          <ChevronDown size={14} class={openGuide === 'binance' ? 'rotated' : ''} />
        </button>
        {#if openGuide === 'binance'}
          <ol class="guide-steps">
            <li>{$tr('Login nang akun Binance-mu, bukak menu Profile -> API Management, terus klik Create API -> System Generated (HMAC).', 'Login ke akun Binance Anda, buka menu Profile -> API Management, lalu klik Create API -> System Generated (HMAC).', 'Log in to Binance, open Profile -> API Management, and click Create API -> System Generated (HMAC).')}</li>
            <li>{$tr('Kei jeneng label (conto: trawangan-desktop) terus rampungno verifikasi 2FA/Passkey.', 'Beri nama label (misalnya trawangan-desktop) dan selesaikan verifikasi 2FA/Passkey.', 'Label the key (e.g. trawangan-desktop) and complete 2FA/Passkey verification.')}</li>
            <li>{$tr('Nang bagian API Restrictions:', 'Pada bagian API Restrictions:', 'Under API Restrictions:')}
              <ul>
                <li>{$tr('Centang Enable Reading.', 'Centang Enable Reading.', 'Check Enable Reading.')}</li>
                <li>{$tr('Centang Enable Futures (gawe USDⓈ-M Perpetual) lan/utawa Enable Spot & Margin Trading.', 'Centang Enable Futures (untuk USDⓈ-M Perpetual) dan/atau Enable Spot & Margin Trading.', 'Check Enable Futures (for USDⓈ-M Perpetual) and/or Enable Spot & Margin Trading.')}</li>
                <li><strong>{$tr('AWAS OJOK NGANTI CENTANG "Enable Withdrawals", COK! Benno mati total ben duitmu aman!', 'PENTING: JANGAN PERNAH mencentang "Enable Withdrawals"! Biarkan mati demi keamanan mutlak.', 'CRITICAL: NEVER enable "Enable Withdrawals"! Keep withdrawals strictly disabled.')}</strong></li>
              </ul>
            </li>
            <li>{$tr('Disarano banget milih Restrict access to trusted IPs only terus lebokno IP publik internetmu ben kunci API gak mati saben 90 dino.', 'Sangat disarankan memilih Restrict access to trusted IPs only dan memasukkan alamat IP publik internet Anda agar API Key tidak kedaluwarsa dalam 90 hari.', 'Strongly recommended: select Restrict access to trusted IPs only and enter your public IP address.')}</li>
            <li>{$tr('Salin API Key karo Secret Key nang kolom dhuwur, pilih mode Futures/Spot, terus klik Simpen & Jajal Sambungan (Verifikasi).', 'Salin API Key dan Secret Key ke kolom di atas, pilih mode pasar (Futures/Spot), lalu klik Simpan & Tes Koneksi (Verifikasi).', 'Paste your API Key and Secret Key above, pick Futures or Spot, and click Save & Test Connection (Verify).')}</li>
          </ol>
        {/if}
      </div>

      <!-- Tutorial 2: Bitunix -->
      <div class="guide-accordion">
        <button
          type="button"
          class="guide-trigger"
          onclick={() => (openGuide = openGuide === 'bitunix' ? null : 'bitunix')}
        >
          <span>📘 {$tr('Tutorial Setup OpenAPI Bitunix (Perpetual Futures)', 'Tutorial Lengkap Setup OpenAPI Bitunix (Perpetual Futures)', 'Bitunix OpenAPI Setup Guide (Perpetual Futures)')}</span>
          <ChevronDown size={14} class={openGuide === 'bitunix' ? 'rotated' : ''} />
        </button>
        {#if openGuide === 'bitunix'}
          <ol class="guide-steps">
            <li>{$tr('Login nang web resmi Bitunix, klik ikon Profil pojok tengen dhuwur, terus pilih API Management.', 'Login ke situs resmi Bitunix, arahkan kursor ke ikon Profil di kanan atas, lalu pilih API Management.', 'Log in to Bitunix, hover your Profile menu in the top-right corner, and open API Management.')}</li>
            <li>{$tr('Klik Create API, kei jeneng trawangan, lan pilih izin Read-Write / Trade (Futures).', 'Klik tombol Create API, isi catatan nama trawangan, dan pilih izin Read-Write / Trade (Futures).', 'Click Create API, name it trawangan, and grant Read-Write / Trade (Futures) permission.')}</li>
            <li>{$tr('Pastikno izin Withdraw TETEP MATI! Lebokno IP nek nggawe IP statis, terus konfirmasi kode 2FA/Email.', 'Pastikan izin Withdraw tetap NONAKTIF. Isi daftar IP jika Anda menggunakan IP statis, lalu konfirmasi kode 2FA/Email.', 'Ensure Withdraw permission remains DISABLED. Confirm via 2FA/Email.')}</li>
            <li>{$tr('Salin API Key karo Secret Key sing njedhul (Secret mung muncul pisan pas digawe!) nang form Bitunix dhuwur.', 'Salin API Key dan Secret Key yang tampil (Secret hanya muncul satu kali saat dibuat) ke form Bitunix di atas.', 'Copy the displayed API Key and Secret Key (shown only once) into the Bitunix fields above.')}</li>
            <li>{$tr('Klik Simpen & Jajal Sambungan (Verifikasi) sampek metu status VERIFIED & READY lengkap karo saldo USDT-mu.', 'Klik tombol Simpan & Tes Koneksi (Verifikasi) hingga muncul status VERIFIED & READY beserta saldo USDT Anda.', 'Click Save & Test Connection (Verify) until VERIFIED & READY appears with your USDT balance.')}</li>
          </ol>
        {/if}
      </div>

      <!-- Tutorial 3: MetaTrader 5 CFD -->
      <div class="guide-accordion">
        <button
          type="button"
          class="guide-trigger"
          onclick={() => (openGuide = openGuide === 'mt5' ? null : 'mt5')}
        >
          <span>📘 {$tr('Tutorial Setup Broker CFD / MetaTrader 5 (Exness, HFM, Pepperstone, Octa, IC Markets, lsp.)', 'Tutorial Lengkap Setup Broker CFD / MetaTrader 5 (MT5) (Exness, HFM, Pepperstone, Octa, IC Markets, dll.)', 'CFD Broker / MetaTrader 5 (MT5) Local Bridge Setup (Exness, HFM, Pepperstone, IC Markets, etc.)')}</span>
          <ChevronDown size={14} class={openGuide === 'mt5' ? 'rotated' : ''} />
        </button>
        {#if openGuide === 'mt5'}
          <ol class="guide-steps">
            <li>{$tr('Berhubung server MetaTrader 5 gak nduwe REST API publik gratis, trawangan nggawe jalur Local MT5 Socket Bridge (100% Gratis & Lokal nang PC-mu dewe).', 'Karena server MetaTrader 5 tidak menyediakan REST API publik gratis, trawangan memakai arsitektur Local MT5 Socket Bridge (100% Gratis & Lokal di PC Anda).', 'Since MetaTrader 5 servers do not expose a free public REST API, trawangan uses a 100% free Local MT5 Socket Bridge on your PC.')}</li>
            <li>{$tr('Klik tombol Undhuh File EA TrawanganMT5Bridge.mq5 nang dhuwur.', 'Klik tombol Unduh File EA TrawanganMT5Bridge.mq5 di atas.', 'Click Download EA File TrawanganMT5Bridge.mq5 above.')}</li>
            <li>{$tr('Bukak aplikasi desktop MetaTrader 5-mu (pastikno wis login akun Live/Demo broker CFD koyok Exness, HFM, Pepperstone, lsp.).', 'Buka aplikasi desktop MetaTrader 5 Anda (sudah login ke akun Live/Demo broker CFD pilihan Anda seperti Exness, HFM, Pepperstone, dll.).', 'Open your MetaTrader 5 desktop terminal logged into your Live or Demo CFD account.')}</li>
            <li>{$tr('Klik menu File -> Open Data Folder nang MT5, melbu folder MQL5/Experts/, terus cemplungno file TrawanganMT5Bridge.mq5 nang kono.', 'Klik menu File -> Open Data Folder di MT5, masuk ke folder MQL5/Experts/, lalu letakkan file TrawanganMT5Bridge.mq5 di sana.', 'In MT5 click File -> Open Data Folder, open MQL5/Experts/, and drop TrawanganMT5Bridge.mq5 inside.')}</li>
            <li>{$tr('Pencet F4 gawe mbukak MetaEditor, klik pindho file TrawanganMT5Bridge.mq5, terus pencet F7 (Compile) sampek tulisan 0 errors.', 'Tekan F4 untuk membuka MetaEditor, klik dua kali file TrawanganMT5Bridge.mq5, lalu tekan F7 (Compile) hingga tertulis 0 errors.', 'Press F4 to open MetaEditor, open TrawanganMT5Bridge.mq5, and press F7 (Compile) until 0 errors.')}</li>
            <li>{$tr('Mbalik nang MT5, bukak Tools -> Options -> Expert Advisors:', 'Kembali ke jendela utama MT5, buka menu Tools -> Options -> Expert Advisors:', 'Back in MT5, open Tools -> Options -> Expert Advisors:')}
              <ul>
                <li>{$tr('Centang Allow Algorithmic Trading.', 'Centang Allow Algorithmic Trading.', 'Enable Allow Algorithmic Trading.')}</li>
                <li>{$tr('Centang Allow WebRequest for listed URL terus tambahno http://127.0.0.1:15555.', 'Centang Allow WebRequest for listed URL dan tambahkan URL http://127.0.0.1:15555.', 'Enable Allow WebRequest for listed URL and add http://127.0.0.1:15555.')}</li>
              </ul>
            </li>
            <li>{$tr('Seret (drag & drop) TrawanganMT5Bridge teko Navigator nang salah siji chart MT5, samakno InpSecretToken karo Local Security Token nang dhuwur, lan pastikno tombol Algo Trading warna ijo!', 'Tarik (drag & drop) TrawanganMT5Bridge dari panel Navigator ke salah satu chart di MT5, pastikan nilai InpSecretToken sama persis dengan Local Security Token di atas, dan pastikan tombol Algo Trading di toolbar atas MT5 berwarna hijau.', 'Attach TrawanganMT5Bridge onto any MT5 chart, match InpSecretToken with your Local Security Token above, and ensure Algo Trading is green.')}</li>
            <li>{$tr('Klik Simpen & Jajal Sambungan (Verifikasi) nang trawangan, terus uripno Master Switch gawe mbukak tab Order Manual nang dock tengen. Gas!', 'Klik Simpan & Tes Koneksi (Verifikasi) di trawangan, lalu nyalakan Master Switch di atas untuk membuka tab Order Manual di dock kanan!', 'Click Save & Test Connection (Verify) in trawangan, then toggle ON the Master Switch to unlock the Manual Order Ticket tab!')}</li>
          </ol>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .broker-tab-pane {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .hero-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg-panel);
    border-radius: 8px;
  }

  .hero-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .hero-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--brand-primary) 14%, transparent);
    color: var(--brand-primary);
    flex-shrink: 0;
  }

  .hero-title {
    margin: 0;
    font-size: 13.5px;
    font-weight: 800;
    color: var(--text-main);
  }

  .hero-sub {
    margin: 2px 0 0;
    font-size: 11px;
    color: var(--text-muted);
  }

  .status-pill {
    font-size: 10px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .status-pill.off {
    background: var(--bg-elevated);
    color: var(--text-dim);
  }

  .status-pill.on {
    background: color-mix(in srgb, var(--bull-color) 16%, transparent);
    color: var(--bull-color);
  }

  .gate-card {
    padding: 16px;
    border-radius: 8px;
    background: var(--bg-panel);
    border: 1px solid color-mix(in srgb, var(--status-warn) 42%, transparent);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gate-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .gate-title-row h4 {
    margin: 0;
    font-size: 13px;
    color: var(--status-warn);
  }

  .gate-body {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--text-main);
  }

  .safety-rules {
    margin: 0;
    padding-left: 18px;
    font-size: 11px;
    line-height: 1.55;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ack-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11.5px;
    color: var(--text-main);
    cursor: pointer;
  }

  .unlock-row {
    display: flex;
    gap: 8px;
  }

  .confirm-input {
    flex: 1;
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: var(--bg-surface);
    color: var(--text-main);
    font-size: 11.5px;
  }

  .unlock-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 6px;
    border: none;
    background: var(--brand-primary);
    color: #0b0e14;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
  }

  .unlock-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .master-switch-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--bg-panel);
  }

  .switch-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .switch-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main);
  }

  .switch-desc {
    font-size: 11px;
    color: var(--text-muted);
  }

  .feedback-banner {
    padding: 9px 12px;
    border-radius: 6px;
    font-size: 11px;
  }

  .feedback-banner.ok {
    background: color-mix(in srgb, var(--bull-color) 13%, transparent);
    color: var(--bull-color);
  }

  .feedback-banner.err {
    background: color-mix(in srgb, var(--bear-color) 14%, transparent);
    color: var(--bear-color);
  }

  .broker-tabs-bar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .broker-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--bg-panel);
    border: 1px solid transparent;
    color: var(--text-muted);
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
  }

  .broker-pill.active {
    background: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    border-color: var(--brand-cyan);
    color: var(--brand-cyan);
  }

  .verified-dot {
    font-size: 10px;
    padding: 0 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bull-color) 20%, transparent);
    color: var(--bull-color);
  }

  .config-card {
    padding: 14px;
    border-radius: 8px;
    background: var(--bg-panel);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .saved-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    border-radius: 6px;
    background: var(--bg-surface);
    font-size: 11px;
  }

  .btn-delete-cred {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    border: none;
    background: color-mix(in srgb, var(--bear-color) 14%, transparent);
    color: var(--bear-color);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field.full {
    grid-column: 1 / -1;
  }

  .field label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .input-ctrl {
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: var(--bg-surface);
    color: var(--text-main);
    font-size: 11.5px;
    width: 100%;
  }

  .secret-row {
    display: flex;
    gap: 6px;
  }

  .icon-btn {
    padding: 0 9px;
    border-radius: 6px;
    border: none;
    background: var(--bg-elevated);
    color: var(--text-muted);
    cursor: pointer;
  }

  .mt5-ea-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .btn-ea-download {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--brand-cyan) 40%, transparent);
    background: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    color: var(--brand-cyan);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .ea-code-preview {
    max-height: 190px;
    overflow: auto;
    padding: 10px;
    border-radius: 6px;
    background: #0a0c10;
    font-size: 10px;
    color: var(--text-muted);
    margin: 0;
  }

  .action-buttons-row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 6px;
    border: none;
    background: var(--bg-elevated);
    color: var(--text-main);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-verify {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 6px;
    border: none;
    background: var(--bull-color);
    color: #0a0d12;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
  }

  .tutorial-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .tutorial-header {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .tutorial-header h4 {
    margin: 0;
    font-size: 12px;
    color: var(--text-main);
  }

  .guide-accordion {
    border-radius: 7px;
    background: var(--bg-panel);
    overflow: hidden;
  }

  .guide-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: var(--text-main);
    font-size: 11.5px;
    cursor: pointer;
    text-align: left;
  }

  .guide-steps {
    margin: 0;
    padding: 4px 16px 12px 28px;
    font-size: 11px;
    line-height: 1.55;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .text-warn { color: var(--status-warn, #f59e0b); }
  .text-bull { color: var(--bull-color, #00ff88); }
  .text-cyan { color: var(--brand-cyan, #38bdf8); }
</style>
