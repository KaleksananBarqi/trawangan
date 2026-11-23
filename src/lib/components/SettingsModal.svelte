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
    Check,
    Type
  } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import type { AppSettings } from '../types/market';
  import type { MarketSession } from '../services/marketSessionService';
  import { updateService, shouldShowUpdateBadge, type UpdateState } from '../services/updateService';

  // Submodul Pengaturan Terfokus (Architecture Deepening - Issue #9)
  import GeneralTab from './settings/GeneralTab.svelte';
  import AppearanceTab from './settings/AppearanceTab.svelte';
  import TypographyTab from './settings/TypographyTab.svelte';
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
    initialTab?: 'general' | 'appearance' | 'typography' | 'chart' | 'profile' | 'feed' | 'system' | 'about' | 'help';
    onClose: () => void;
    onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
    onProviderChange?: (providerId: string) => void;
    onOpenChartSettings?: (section?: string) => void;
    onSaveChartAsDefault?: () => Promise<boolean> | boolean;
    onResetChartFactory?: () => void;
    onOpenGestureGuide?: () => void;
    sessionState?: { session: MarketSession; sessionAvailable: boolean };
    onSetSession?: (mode: MarketSession) => void;
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
    onSaveChartAsDefault,
    onResetChartFactory,
    onOpenGestureGuide,
    sessionState,
    onSetSession
  }: Props = $props();

  let activeTab = $state<'general' | 'appearance' | 'typography' | 'chart' | 'profile' | 'feed' | 'system' | 'about' | 'help'>('general');
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
            <span>Tema & Warna</span>
          </button>

          <button
            class="nav-tab {activeTab === 'typography' ? 'active' : ''}"
            onclick={() => (activeTab = 'typography')}
          >
            <Type size={14} />
            <span>Tipografi & Teks</span>
          </button>

          <button
            class="nav-tab {activeTab === 'chart' ? 'active' : ''}"
            onclick={() => (activeTab = 'chart')}
          >
            <Monitor size={14} />
            <span>Kanvas & Grafik</span>
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
            <span>Sistem & Telemetri</span>
          </button>

          <button
            class="nav-tab {activeTab === 'about' ? 'active' : ''}"
            onclick={() => (activeTab = 'about')}
          >
            <Info size={14} />
            <span>Tentang Aplikasi</span>
            {#if shouldShowUpdateBadge(updateState)}
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
            <GeneralTab
              {settings}
              {onUpdateSettings}
              onNavigateTab={(tab) => (activeTab = tab as any)}
            />
          {:else if activeTab === 'appearance'}
            <AppearanceTab {settings} {onUpdateSettings} />
          {:else if activeTab === 'typography'}
            <TypographyTab {settings} {onUpdateSettings} />
          {:else if activeTab === 'chart'}
            <ChartTab
              {settings}
              {onUpdateSettings}
              {onClose}
              {onOpenChartSettings}
              {onSaveChartAsDefault}
              {onResetChartFactory}
              {sessionState}
              {onSetSession}
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
    width: 920px;
    max-width: 94vw;
    background-color: var(--bg-surface, #0F0F0F);
    border: 1px solid var(--border-subtle, #202020);
    border-radius: var(--radius-xl, 10px);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75);
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
    background-color: var(--bg-panel, #171717);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main, #F7F7F7);
  }

  .accent-icon {
    color: var(--brand-primary, #FF69B4);
  }

  .close-btn {
    background: var(--bg-elevated, #1E1E1E);
    border: none;
    color: var(--text-muted, #A3A3A3);
    cursor: pointer;
    padding: 5px;
    border-radius: var(--radius-sm, 5px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  .close-btn:hover {
    color: var(--text-main, #F7F7F7);
    background-color: var(--bg-hover, #262626);
  }

  .modal-body {
    display: flex;
    min-height: 520px;
    max-height: 82vh;
    gap: 2px;
    background-color: var(--bg-shell, #08080A);
  }

  .settings-nav {
    width: 210px;
    background-color: var(--bg-panel, #171717);
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-sm, 5px);
    background: none;
    border: none;
    color: var(--text-muted, #A3A3A3);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.14s ease, color 0.14s ease;
    position: relative;
  }

  .nav-tab:hover {
    color: var(--text-main, #F7F7F7);
    background-color: var(--bg-hover, #262626);
  }

  .nav-tab.active {
    color: var(--brand-primary, #FF69B4);
    background-color: var(--bg-elevated, #1E1E1E);
    box-shadow: inset 2.5px 0 0 var(--brand-primary, #FF69B4);
    font-weight: 600;
  }

  .nav-tab-label {
    flex: 1;
  }

  .tab-shortcut-badge {
    font-size: 9px;
    padding: 1px 5px;
    background: var(--bg-elevated, #1E1E1E);
    border: none;
    border-radius: var(--radius-xs, 4px);
    color: var(--text-dim, #808080);
  }

  .tab-update-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--brand-cyan, #38bdf8);
    margin-left: auto;
  }

  .tab-content {
    flex: 1;
    padding: 18px 20px;
    background-color: var(--bg-surface, #0F0F0F);
    overflow-y: auto;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 10px 16px;
    background-color: var(--bg-panel, #171717);
  }

  .primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background-color: var(--brand-primary, #FF69B4);
    color: var(--on-brand-primary, #0F0F0F);
    font-weight: 600;
    font-size: 11.5px;
    border-radius: var(--radius-md, 6px);
    border: none;
    cursor: pointer;
    transition: filter 0.15s ease;
  }

  .primary-btn:hover {
    filter: brightness(1.08);
  }
</style>
