<script lang="ts">
  import {
    X,
    SlidersHorizontal,
    Palette,
    Monitor,
    Radio,
    Cpu,
    Info,
    HelpCircle,
    UserShield,
    Check
  } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import type { AppSettings } from '../types/market';
  import { updateService, type UpdateState } from '../services/updateService';

  // Submodul Pengaturan Terfokus (Architecture Deepening - Issue #9)
  import GeneralTab from './settings/GeneralTab.svelte';
  import AppearanceTab from './settings/AppearanceTab.svelte';
  import ChartTab from './settings/ChartTab.svelte';
  import ProfileTab from './settings/ProfileTab.svelte';
  import FeedTab from './settings/FeedTab.svelte';
  import SystemTab from './settings/SystemTab.svelte';
  import AboutTab from './settings/AboutTab.svelte';
  import HelpTab from './settings/HelpTab.svelte';

  interface Props {
    isOpen: boolean;
    settings: AppSettings;
    activeProviderId?: string;
    initialTab?: 'general' | 'appearance' | 'chart' | 'profile' | 'feed' | 'system' | 'about' | 'help';
    onClose: () => void;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
    onProviderChange?: (providerId: string) => void;
    onOpenChartSettings?: (section?: string) => void;
    onResetChartFactory?: () => void;
    onOpenGestureGuide?: () => void;
  }

  let {
    isOpen,
    settings,
    activeProviderId = 'binance',
    initialTab = 'general',
    onClose,
    onUpdateSettings,
    onProviderChange,
    onOpenChartSettings,
    onResetChartFactory,
    onOpenGestureGuide
  }: Props = $props();

  let activeTab = $state<'general' | 'appearance' | 'chart' | 'profile' | 'feed' | 'system' | 'about' | 'help'>('general');
  let updateState = $state<UpdateState>(updateService.getSnapshot());
  let unsubUpdate: (() => void) | null = null;

  $effect(() => {
    if (isOpen && initialTab) {
      activeTab = initialTab;
    }
  });

  $effect(() => {
    if (isOpen) {
      unsubUpdate = updateService.subscribe((s) => {
        updateState = s;
      });
    } else if (unsubUpdate) {
      unsubUpdate();
      unsubUpdate = null;
    }
  });

  onDestroy(() => {
    if (unsubUpdate) {
      unsubUpdate();
      unsubUpdate = null;
    }
  });
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
        <!-- Sidebar Navigation Tabs -->
        <nav class="settings-nav">
          <button
            class="nav-tab {activeTab === 'general' ? 'active' : ''}"
            onclick={() => (activeTab = 'general')}
          >
            <SlidersHorizontal size={14} />
            <span>Umum & Audio</span>
          </button>

          <button
            class="nav-tab {activeTab === 'appearance' ? 'active' : ''}"
            onclick={() => (activeTab = 'appearance')}
          >
            <Palette size={14} />
            <span>Tema & Tipografi</span>
          </button>

          <button
            class="nav-tab {activeTab === 'chart' ? 'active' : ''}"
            onclick={() => (activeTab = 'chart')}
          >
            <Monitor size={14} />
            <span>Tampilan Grafik</span>
          </button>

          <button
            class="nav-tab {activeTab === 'profile' ? 'active' : ''}"
            onclick={() => (activeTab = 'profile')}
          >
            <UserShield size={14} />
            <span>Profil & Watermark</span>
          </button>

          <button
            class="nav-tab {activeTab === 'feed' ? 'active' : ''}"
            onclick={() => (activeTab = 'feed')}
          >
            <Radio size={14} />
            <span>Data Feed</span>
          </button>

          <button
            class="nav-tab {activeTab === 'system' ? 'active' : ''}"
            onclick={() => (activeTab = 'system')}
          >
            <Cpu size={14} />
            <span>Sistem & Skrip Browser</span>
          </button>

          <button
            class="nav-tab {activeTab === 'about' ? 'active' : ''}"
            onclick={() => (activeTab = 'about')}
          >
            <Info size={14} />
            <span>Tentang Aplikasi</span>
            {#if updateState.status === 'available'}
              <span class="tab-update-dot" title="Pembaruan Tersedia"></span>
            {/if}
          </button>

          <button
            class="nav-tab {activeTab === 'help' ? 'active' : ''}"
            onclick={() => (activeTab = 'help')}
          >
            <HelpCircle size={14} />
            <span class="nav-tab-label">Bantuan & Shortcut</span>
            <span class="tab-shortcut-badge mono-nums">F1</span>
          </button>
        </nav>

        <!-- Tab Content Viewport -->
        <div class="tab-content">
          {#if activeTab === 'general'}
            <GeneralTab {settings} {onUpdateSettings} />
          {:else if activeTab === 'appearance'}
            <AppearanceTab {settings} {onUpdateSettings} />
          {:else if activeTab === 'chart'}
            <ChartTab
              {settings}
              {onUpdateSettings}
              {onClose}
              {onOpenChartSettings}
              {onResetChartFactory}
            />
          {:else if activeTab === 'profile'}
            <ProfileTab {settings} {onUpdateSettings} />
          {:else if activeTab === 'feed'}
            <FeedTab {activeProviderId} {onProviderChange} />
          {:else if activeTab === 'system'}
            <SystemTab />
          {:else if activeTab === 'about'}
            <AboutTab />
          {:else if activeTab === 'help'}
            <HelpTab onOpenGestureGuide={() => { onClose(); onOpenGestureGuide?.(); }} />
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
    background: rgba(11, 14, 20, 0.82);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .settings-modal {
    width: 680px;
    max-width: 94vw;
    background-color: var(--bg-surface, #161b22);
    border: 1px solid var(--border-hairline, #30363d);
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.75);
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
    background-color: var(--bg-panel, #0d1117);
    border-bottom: 1px solid var(--border-hairline, #30363d);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main, #ffffff);
  }

  .accent-icon {
    color: var(--brand-primary, #00f090);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted, #8b949e);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-xs, 4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: var(--text-main, #ffffff);
    background-color: var(--bg-hover, #21262d);
  }

  .modal-body {
    display: flex;
    min-height: 420px;
    max-height: 75vh;
  }

  .settings-nav {
    width: 185px;
    background-color: var(--bg-container, #0d1117);
    border-right: 1px solid var(--border-hairline, #30363d);
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
    border-radius: var(--radius-sm, 6px);
    background: none;
    border: none;
    color: var(--text-muted, #8b949e);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    position: relative;
  }

  .nav-tab:hover {
    color: var(--text-main, #ffffff);
    background-color: var(--bg-hover, #21262d);
  }

  .nav-tab.active {
    color: var(--brand-primary, #00f090);
    background-color: var(--bg-active, rgba(0, 240, 144, 0.08));
    font-weight: 600;
  }

  .nav-tab-label {
    flex: 1;
  }

  .tab-shortcut-badge {
    font-size: 9px;
    padding: 1px 4px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 3px;
    color: var(--text-dim, #6e7681);
  }

  .tab-update-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #38bdf8;
    margin-left: auto;
  }

  .tab-content {
    flex: 1;
    padding: 18px 20px;
    background-color: var(--bg-surface, #161b22);
    overflow-y: auto;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 10px 16px;
    background-color: var(--bg-panel, #0d1117);
    border-top: 1px solid var(--border-hairline, #30363d);
  }

  .primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background-color: var(--brand-primary, #00f090);
    color: #000000;
    font-weight: 600;
    font-size: 11px;
    border-radius: var(--radius-xs, 4px);
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .primary-btn:hover {
    opacity: 0.9;
  }
</style>
