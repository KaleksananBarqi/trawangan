<script lang="ts">
  import {
    X,
    Cpu,
    Monitor,
    SlidersHorizontal,
    Database,
    Wifi,
    Check,
    Volume2,
    VolumeX,
    Grid,
    Clock,
    Sparkles
  } from '@lucide/svelte';
  import type { AppSettings } from '../types/market';

  interface Props {
    isOpen: boolean;
    settings: AppSettings;
    onClose: () => void;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  }

  let { isOpen, settings, onClose, onUpdateSettings }: Props = $props();

  let activeTab = $state<'general' | 'chart' | 'system'>('general');

  // Simulasi Telemetri Hardware WebGL2 Real-Time (untuk diagnosa)
  let fps = $state(120);
  let vram = $state('82 MB');
  let l2Latency = $state('180 µs');
  let droppedPackets = $state(0);
</script>

{#if isOpen}
  <div class="modal-backdrop" onclick={onClose} role="presentation">
    <div
      class="settings-modal obsidian-panel"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-title">
          <span class="accent-icon"><SlidersHorizontal size={16} /></span>
          <span>Pengaturan & Telemetri Sistem</span>
        </div>
        <button class="close-btn" onclick={onClose} title="Tutup Pengaturan">
          <X size={16} />
        </button>
      </div>

      <div class="modal-body">
        <!-- Sidebar Tabs -->
        <nav class="settings-nav">
          <button
            class="nav-tab {activeTab === 'general' ? 'active' : ''}"
            onclick={() => (activeTab = 'general')}
          >
            <SlidersHorizontal size={14} />
            <span>Umum & Audio</span>
          </button>

          <button
            class="nav-tab {activeTab === 'chart' ? 'active' : ''}"
            onclick={() => (activeTab = 'chart')}
          >
            <Monitor size={14} />
            <span>Tampilan Grafik</span>
          </button>

          <button
            class="nav-tab {activeTab === 'system' ? 'active' : ''}"
            onclick={() => (activeTab = 'system')}
          >
            <Cpu size={14} />
            <span>Telemetri & WebGL2</span>
          </button>
        </nav>

        <!-- Tab Content -->
        <div class="tab-content">
          {#if activeTab === 'general'}
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
                  <option value="Asia/Makassar">UTC+8 (WITA / Singapore)</option>
                  <option value="Asia/Tokyo">UTC+9 (Tokyo)</option>
                  <option value="UTC">UTC+0 (Coordinated Universal Time)</option>
                  <option value="America/New_York">UTC-4 (New York EDT)</option>
                </select>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Efek Suara Notifikasi (Audio Chime)</span>
                  <span class="setting-desc">Bunyikan nada saat harga menembus level Alert</span>
                </div>
                <button
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

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Tema Visual Antarmuka</span>
                  <span class="setting-desc">Desain token palet institusional</span>
                </div>
                <div class="theme-badge">
                  <Sparkles size={13} class="text-bull" />
                  <span>Obsidian Precision Terminal</span>
                </div>
              </div>
            </div>

          {:else if activeTab === 'chart'}
            <div class="section-group">
              <h4 class="section-title">Kebersihan & Tampilan Canvas</h4>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Garis Grid Latar (Grid Lines)</span>
                  <span class="setting-desc">Tampilkan garis pemandu koordinat horizontal dan vertikal</span>
                </div>
                <button
                  class="toggle-btn {settings.showGrid ? 'active' : ''}"
                  onclick={() => onUpdateSettings({ showGrid: !settings.showGrid })}
                >
                  {settings.showGrid ? 'Tampilkan' : 'Sembunyikan'}
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Watermark Simbol Besar</span>
                  <span class="setting-desc">Tampilkan watermark samar di belakang candlestick</span>
                </div>
                <button
                  class="toggle-btn {settings.showWatermark ? 'active' : ''}"
                  onclick={() => onUpdateSettings({ showWatermark: !settings.showWatermark })}
                >
                  {settings.showWatermark ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Bar Replay Controller</span>
                  <span class="setting-desc">Tampilkan toolbar replay candle historis di atas grafik</span>
                </div>
                <button
                  class="toggle-btn {settings.showReplayBar ? 'active' : ''}"
                  onclick={() => onUpdateSettings({ showReplayBar: !settings.showReplayBar })}
                >
                  {settings.showReplayBar ? 'Tampil' : 'Sembunyi'}
                </button>
              </div>
            </div>

          {:else if activeTab === 'system'}
            <div class="section-group">
              <h4 class="section-title">Status Akselerasi WebGL 2.0 & Native Core</h4>
              <p class="section-desc">
                Informasi telemetri perangkat keras dipindahkan ke sini agar area kerja grafik tetap bersih dan maksimal.
              </p>

              <div class="telemetry-grid mono-nums">
                <div class="telemetry-card">
                  <span class="card-label">Target Rendering</span>
                  <span class="card-value text-bull">{fps} FPS</span>
                  <span class="card-sub">LuxAlgo Vela WebGL2</span>
                </div>

                <div class="telemetry-card">
                  <span class="card-label">Estimasi VRAM Buffer</span>
                  <span class="card-value">{vram}</span>
                  <span class="card-sub">Zero Heap Thrash</span>
                </div>

                <div class="telemetry-card">
                  <span class="card-label">L2 Network Latency</span>
                  <span class="card-value text-cyan">{l2Latency}</span>
                  <span class="card-sub">Direct Binance Streams</span>
                </div>

                <div class="telemetry-card">
                  <span class="card-label">Packet Drop Health</span>
                  <span class="card-value">{droppedPackets} Dropped</span>
                  <span class="card-sub">Zero loss buffering</span>
                </div>
              </div>

              <div class="status-summary obsidian-card">
                <div class="status-item">
                  <Database size={14} class="text-bull" />
                  <span>SQLite rusqlite: <strong>Local Offline Active</strong></span>
                </div>
                <div class="status-item">
                  <Wifi size={14} class="text-cyan" />
                  <span>Engine: <strong>Tauri v2 Native Rust Backend</strong></span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button class="primary-btn" onclick={onClose}>
          <Check size={14} /> Selesai
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(11, 14, 20, 0.78);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .settings-modal {
    width: 620px;
    max-width: 92vw;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    height: 44px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
  }

  .accent-icon {
    color: var(--brand-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .modal-body {
    display: flex;
    min-height: 320px;
  }

  .settings-nav {
    width: 170px;
    background-color: var(--bg-container);
    border-right: 1px solid var(--border-hairline);
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .nav-tab:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .nav-tab.active {
    color: var(--brand-primary);
    background-color: var(--bg-active);
    font-weight: 600;
  }

  .tab-content {
    flex: 1;
    padding: 18px;
    background-color: var(--bg-surface);
    overflow-y: auto;
  }

  .section-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
    margin-bottom: 2px;
  }

  .section-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
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
    color: var(--text-dim);
  }

  .select-input {
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-main);
    padding: 6px 10px;
    border-radius: var(--radius-xs);
    font-size: 12px;
    cursor: pointer;
    outline: none;
  }

  .select-input:focus {
    border-color: var(--border-focus);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    color: var(--text-muted);
    padding: 6px 12px;
    border-radius: var(--radius-xs);
    font-size: 11px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .toggle-btn.active {
    background-color: rgba(0, 240, 144, 0.12);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
    font-weight: 600;
  }

  .theme-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--brand-primary);
    background: rgba(0, 240, 144, 0.08);
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    border: 1px solid rgba(0, 240, 144, 0.25);
  }

  .telemetry-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .telemetry-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-label {
    font-size: 11px;
    color: var(--text-dim);
  }

  .card-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-main);
  }

  .card-sub {
    font-size: 10px;
    color: var(--text-muted);
  }

  .status-summary {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .status-item strong {
    color: var(--text-main);
  }

  .text-bull {
    color: var(--bull-color);
  }

  .text-cyan {
    color: var(--brand-cyan);
  }

  .modal-footer {
    height: 48px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: var(--bg-panel);
    border-top: 1px solid var(--border-hairline);
  }

  .primary-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--brand-primary);
    color: var(--bg-darkest);
    border: none;
    padding: 6px 14px;
    border-radius: var(--radius-xs);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .primary-btn:hover {
    opacity: 0.9;
  }
</style>
