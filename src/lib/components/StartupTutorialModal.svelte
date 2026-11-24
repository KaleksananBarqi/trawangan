<script lang="ts">
  import {
    Sparkles,
    Search,
    Pencil,
    FileText,
    Code,
    Zap,
    X,
    ChevronRight,
    ChevronLeft,
    Check,
    Globe,
    Moon,
    Sun,
    Monitor
  } from '@lucide/svelte';
  import type { AppLanguage, AppSettings, ColorModePreference } from '../types/market';
  import { t, SUPPORTED_LANGUAGES } from '../i18n';

  interface Props {
    isOpen: boolean;
    settings: AppSettings;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
    onComplete: () => void;
    onOpenBrokerSettings?: () => void;
  }

  let {
    isOpen,
    settings,
    onUpdateSettings,
    onComplete,
    onOpenBrokerSettings
  }: Props = $props();

  let currentStep = $state(0);

  $effect(() => {
    if (isOpen) {
      currentStep = 0;
    }
  });

  const steps = $derived([
    {
      id: 'welcome',
      title: $t('tour.step1Title'),
      body: $t('tour.step1Body'),
      shortcut: 'Jawa Arekan · ID · EN',
      highlightRegion: 'center'
    },
    {
      id: 'search',
      title: $t('tour.step2Title'),
      body: $t('tour.step2Body'),
      shortcut: 'Ctrl + K / Type on Canvas',
      highlightRegion: 'top'
    },
    {
      id: 'gesture',
      title: $t('tour.step3Title'),
      body: $t('tour.step3Body'),
      shortcut: 'Hold ~  /  Shift + D',
      highlightRegion: 'left'
    },
    {
      id: 'plan',
      title: $t('tour.step4Title'),
      body: $t('tour.step4Body'),
      shortcut: 'Ctrl + Shift + P  /  Ctrl + V',
      highlightRegion: 'right'
    },
    {
      id: 'pine',
      title: $t('tour.step5Title'),
      body: $t('tour.step5Body'),
      shortcut: 'Alt + E  /  Ctrl + Shift + S',
      highlightRegion: 'right'
    },
    {
      id: 'broker',
      title: $t('tour.step6Title'),
      body: $t('tour.step6Body'),
      shortcut: 'Opt-In · Default OFF',
      highlightRegion: 'settings'
    }
  ]);

  const activeStepData = $derived(steps[currentStep] || steps[0]);

  function handleSelectLanguage(lang: AppLanguage) {
    onUpdateSettings({ language: lang });
  }

  function handleSelectColorMode(mode: ColorModePreference) {
    onUpdateSettings({ colorModePreference: mode });
  }

  function handleFinish() {
    onUpdateSettings({ hasCompletedOnboarding: true });
    onComplete();
  }
</script>

{#if isOpen}
  <div class="tour-backdrop" role="dialog" aria-modal="true" aria-label="Startup Spotlight Tour">
    <!-- Spotlight Beacon Rings -->
    {#if activeStepData.highlightRegion === 'top'}
      <div class="spotlight-beacon beacon-top"></div>
    {:else if activeStepData.highlightRegion === 'left'}
      <div class="spotlight-beacon beacon-left"></div>
    {:else if activeStepData.highlightRegion === 'right'}
      <div class="spotlight-beacon beacon-right"></div>
    {:else if activeStepData.highlightRegion === 'settings'}
      <div class="spotlight-beacon beacon-top-right"></div>
    {/if}

    <div class="tour-card obsidian-panel">
      <!-- Top Bar -->
      <div class="tour-header">
        <div class="tour-badge mono-nums">
          <Sparkles size={12} />
          <span>{$t('tour.badge')} · {currentStep + 1}/{steps.length}</span>
        </div>

        <button type="button" class="skip-btn" onclick={handleFinish}>
          <span>{$t('tour.skip')}</span>
          <X size={13} />
        </button>
      </div>

      <!-- Step Progress Dots -->
      <div class="step-dots">
        {#each steps as s, idx (s.id)}
          <button
            type="button"
            class="dot {idx === currentStep ? 'active' : idx < currentStep ? 'done' : ''}"
            aria-label="Step {idx + 1}"
            onclick={() => (currentStep = idx)}
          ></button>
        {/each}
      </div>

      <!-- Visual Icon & Content -->
      <div class="tour-body">
        <div class="step-hero-row">
          <div class="step-icon-box">
            {#if activeStepData.id === 'welcome'}
              <Sparkles size={22} />
            {:else if activeStepData.id === 'search'}
              <Search size={22} />
            {:else if activeStepData.id === 'gesture'}
              <Pencil size={22} />
            {:else if activeStepData.id === 'plan'}
              <FileText size={22} />
            {:else if activeStepData.id === 'pine'}
              <Code size={22} />
            {:else}
              <Zap size={22} />
            {/if}
          </div>

          <div class="step-meta">
            <span class="shortcut-pill mono-nums">{activeStepData.shortcut}</span>
            <h3 class="step-title">{activeStepData.title}</h3>
          </div>
        </div>

        <p class="step-desc">{activeStepData.body}</p>

        {#if activeStepData.id === 'welcome'}
          <div class="quick-setup-panel">
            <div class="setup-group">
              <span class="setup-lbl">
                <Globe size={12} />
                <span>{$t('settings.langLabel')}</span>
              </span>
              <div class="setup-pills">
                {#each SUPPORTED_LANGUAGES as lang (lang.code)}
                  {@const active = (settings.language ?? 'jv') === lang.code}
                  <button
                    type="button"
                    class="setup-pill {active ? 'active' : ''}"
                    onclick={() => handleSelectLanguage(lang.code)}
                  >
                    <span class="mono-nums">{lang.badge}</span>
                    <span>{lang.label}</span>
                  </button>
                {/each}
              </div>
            </div>

            <div class="setup-group">
              <span class="setup-lbl">Mode Tampilan (Theme Mode)</span>
              <div class="setup-pills">
                <button
                  type="button"
                  class="setup-pill {(settings.colorModePreference ?? 'system') === 'dark' ? 'active' : ''}"
                  onclick={() => handleSelectColorMode('dark')}
                >
                  <Moon size={12} />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  class="setup-pill {(settings.colorModePreference ?? 'system') === 'light' ? 'active' : ''}"
                  onclick={() => handleSelectColorMode('light')}
                >
                  <Sun size={12} />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  class="setup-pill {(settings.colorModePreference ?? 'system') === 'system' ? 'active' : ''}"
                  onclick={() => handleSelectColorMode('system')}
                >
                  <Monitor size={12} />
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>
        {:else if activeStepData.id === 'broker' && onOpenBrokerSettings}
          <div class="broker-cta-row">
            <button
              type="button"
              class="broker-open-btn"
              onclick={() => {
                handleFinish();
                onOpenBrokerSettings?.();
              }}
            >
              <Zap size={13} />
              <span>{$t('settings.navBroker')} (Opsional) ↗</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- Navigation Footer -->
      <div class="tour-footer">
        <button
          type="button"
          class="nav-btn secondary"
          disabled={currentStep === 0}
          onclick={() => (currentStep = Math.max(0, currentStep - 1))}
        >
          <ChevronLeft size={14} />
          <span>{$t('tour.prev')}</span>
        </button>

        {#if currentStep < steps.length - 1}
          <button
            type="button"
            class="nav-btn primary"
            onclick={() => (currentStep = Math.min(steps.length - 1, currentStep + 1))}
          >
            <span>{$t('tour.next')}</span>
            <ChevronRight size={14} />
          </button>
        {:else}
          <button type="button" class="nav-btn finish" onclick={handleFinish}>
            <Check size={14} />
            <span>{$t('tour.finish')}</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .tour-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1400;
    background: rgba(8, 10, 15, 0.82);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .spotlight-beacon {
    position: fixed;
    border: 2px solid var(--brand-primary, #FF69B4);
    border-radius: 10px;
    box-shadow: 0 0 0 4px rgba(255, 105, 180, 0.18), 0 0 32px rgba(255, 105, 180, 0.45);
    pointer-events: none;
    animation: pulseBeacon 1.8s infinite ease-in-out;
  }

  .beacon-top {
    top: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, 88vw);
    height: 66px;
  }

  .beacon-left {
    top: 76px;
    left: 4px;
    width: 48px;
    bottom: 34px;
  }

  .beacon-right {
    top: 76px;
    right: 4px;
    width: 46px;
    bottom: 34px;
  }

  .beacon-top-right {
    top: 4px;
    right: 6px;
    width: 240px;
    height: 34px;
  }

  @keyframes pulseBeacon {
    0%, 100% { opacity: 0.95; }
    50% { opacity: 0.45; }
  }

  .tour-card {
    width: 540px;
    max-width: 95vw;
    background: var(--bg-surface, #111318);
    border-radius: 12px;
    box-shadow: 0 28px 72px rgba(0, 0, 0, 0.82);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    z-index: 2;
  }

  .tour-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 8px;
    background: var(--bg-panel, #16181f);
  }

  .tour-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: var(--brand-primary, #FF69B4);
  }

  .skip-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 5px;
  }

  .skip-btn:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .step-dots {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 16px 12px;
    background: var(--bg-panel, #16181f);
    border-bottom: 1px solid var(--border-hairline);
  }

  .dot {
    flex: 1;
    height: 4px;
    border-radius: 999px;
    border: none;
    background: var(--bg-elevated);
    cursor: pointer;
    padding: 0;
    transition: all 0.16s ease;
  }

  .dot.done {
    background: color-mix(in srgb, var(--brand-primary) 48%, transparent);
  }

  .dot.active {
    background: var(--brand-primary, #FF69B4);
  }

  .tour-body {
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .step-hero-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .step-icon-box {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--brand-primary) 14%, transparent);
    color: var(--brand-primary, #FF69B4);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .step-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .shortcut-pill {
    align-self: flex-start;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    color: var(--brand-cyan, #38bdf8);
  }

  .step-title {
    margin: 0;
    font-size: 15.5px;
    font-weight: 800;
    color: var(--text-main);
  }

  .step-desc {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.58;
    color: var(--text-muted);
  }

  .quick-setup-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    background: var(--bg-panel);
  }

  .setup-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .setup-lbl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
  }

  .setup-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .setup-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.14s ease;
  }

  .setup-pill:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .setup-pill.active {
    background: color-mix(in srgb, var(--brand-primary) 16%, transparent);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .broker-cta-row {
    display: flex;
    padding-top: 2px;
  }

  .broker-open-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-cyan) 35%, transparent);
    color: var(--brand-cyan);
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
  }

  .tour-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-panel);
    border-top: 1px solid var(--border-hairline);
  }

  .nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: filter 0.14s ease, opacity 0.14s ease;
  }

  .nav-btn.secondary {
    background: var(--bg-elevated);
    color: var(--text-muted);
  }

  .nav-btn.secondary:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .nav-btn.primary {
    background: var(--brand-cyan, #38bdf8);
    color: #0b0e14;
  }

  .nav-btn.finish {
    background: var(--brand-primary, #FF69B4);
    color: #0b0e14;
  }
</style>
