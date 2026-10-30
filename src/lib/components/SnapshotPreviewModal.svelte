<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Camera,
    Copy,
    Download,
    X,
    Check,
    SlidersHorizontal,
    Layers,
    Clock,
    DollarSign,
    Sparkles,
    Image as ImageIcon,
    Plus,
    Minus
  } from '@lucide/svelte';
  import type { AppSettings } from '../types/market';
  import { THEME_PRESETS } from '../constants/themes';
  import {
    compositeSnapshot,
    generateSnapshotFilename,
    copySnapshotToClipboard,
    downloadSnapshot,
    calculateCompositeDimensions,
    type SnapshotOptions,
    type SnapshotMetadata
  } from '../services/chartSnapshotService';

  interface Props {
    isOpen: boolean;
    activeSymbol: string;
    activeTimeframe: string;
    activeProviderId: string;
    currentPrice?: number | null;
    currentLayout?: string;
    appSettings: AppSettings;
    getScreenshotCanvas: (scope: 'active' | 'all') => HTMLCanvasElement | null;
    onUpdateSettings?: (newSettings: Partial<AppSettings>) => void | Promise<void>;
    onClose: () => void;
    onLog?: (message: string, type?: 'info' | 'success' | 'warn') => void;
  }

  let {
    isOpen,
    activeSymbol,
    activeTimeframe,
    activeProviderId,
    currentPrice = null,
    currentLayout = '1',
    appSettings,
    getScreenshotCanvas,
    onUpdateSettings,
    onClose,
    onLog,
  }: Props = $props();

  // State Kontrol Interaktif
  let includeFrame = $state(true);
  let includePrice = $state(true);
  let includeTimestamp = $state(true);
  let snapshotScope = $state<'active' | 'all'>('active');

  // State Zoom Interaktif (User Story 12)
  let zoomLevel = $state(1);
  let capturedAt = $state<number>(Date.now());

  // State Pratinjau
  let previewUrl = $state<string>('');
  let previewDimensions = $state<{ width: number; height: number }>({ width: 0, height: 0 });
  let isRendering = $state(false);
  let renderError = $state<string | null>(null);

  // Status visual aksi
  let copied = $state(false);
  let copyTimer: any = null;

  // Inisialisasi opsi dari appSettings saat modal dibuka
  $effect(() => {
    if (isOpen) {
      capturedAt = Date.now();
      zoomLevel = 1;
      includeFrame = appSettings.snapshotIncludeFrame ?? true;
      includePrice = appSettings.snapshotIncludePrice ?? true;
      includeTimestamp = appSettings.snapshotIncludeTimestamp ?? true;
      snapshotScope = appSettings.snapshotScope ?? 'active';
      renderPreview();
    } else {
      if (copyTimer) {
        clearTimeout(copyTimer);
        copyTimer = null;
      }
      copied = false;
    }
  });

  onDestroy(() => {
    if (copyTimer) clearTimeout(copyTimer);
  });

  // Handler Kontrol Zoom (+ / - / Reset 100%)
  function handleZoomIn() {
    zoomLevel = Math.min(3, Math.round((zoomLevel + 0.25) * 100) / 100);
  }

  function handleZoomOut() {
    zoomLevel = Math.max(0.25, Math.round((zoomLevel - 0.25) * 100) / 100);
  }

  function handleResetZoom() {
    zoomLevel = 1;
  }

  // Keyboard shortcut listener (Escape untuk tutup)
  function handleKeyDown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  /**
   * Menyimpan perubahan preferensi pengguna secara persisten ke appSettings
   */
  function persistChanges() {
    onUpdateSettings?.({
      snapshotIncludeFrame: includeFrame,
      snapshotIncludePrice: includePrice,
      snapshotIncludeTimestamp: includeTimestamp,
      snapshotScope: snapshotScope,
    });
  }

  /**
   * Menghasilkan kanvas komposit snapshot berdasarkan konfigurasi aktif
   */
  function generateCurrentComposite(): HTMLCanvasElement | null {
    const sourceCanvas = getScreenshotCanvas(snapshotScope);
    if (!sourceCanvas) return null;

    const isMulti = snapshotScope === 'all';
    const layoutLabel = currentLayout === '2v' ? '2-SPLIT VERTICAL'
      : currentLayout === '2h' ? '2-SPLIT HORIZONTAL'
      : currentLayout === '4' ? '4-GRID'
      : `LAYOUT ${currentLayout.toUpperCase()}`;

    const metadata: SnapshotMetadata = isMulti ? {
      symbol: 'MULTI-CHART GRID',
      timeframe: layoutLabel,
      providerId: activeProviderId,
      lastPrice: null,
      timezone: appSettings.timezone || 'Asia/Jakarta',
      timestamp: capturedAt,
      layout: currentLayout,
      scope: 'all',
    } : {
      symbol: activeSymbol,
      timeframe: activeTimeframe,
      providerId: activeProviderId,
      lastPrice: currentPrice,
      timezone: appSettings.timezone || 'Asia/Jakarta',
      timestamp: capturedAt,
      layout: currentLayout,
      scope: 'active',
    };

    const activeTheme = THEME_PRESETS[appSettings.themePreset || 'signature'] || THEME_PRESETS.signature;
    const backgroundColor = activeTheme?.chart?.background || activeTheme?.tokens?.bgDarkest || '#0F0F0F';

    const options: SnapshotOptions = {
      mode: includeFrame ? 'branded' : 'clean',
      scale: 2,
      backgroundColor,
      includePrice,
      includeTimestamp,
      metadata,
    };

    return compositeSnapshot(sourceCanvas, options);
  }

  /**
   * Me-render ulang gambar pratinjau snapshot secara reaktif
   */
  function renderPreview() {
    isRendering = true;
    renderError = null;

    try {
      const composite = generateCurrentComposite();
      if (!composite) {
        renderError = 'Kanvas grafik belum siap atau tidak ditemukan.';
        previewUrl = '';
        return;
      }

      previewDimensions = {
        width: composite.width,
        height: composite.height,
      };

      if (typeof composite.toDataURL === 'function') {
        previewUrl = composite.toDataURL('image/png');
      } else {
        renderError = 'Format kanvas tidak didukung di lingkungan ini.';
      }
    } catch (err: any) {
      renderError = err?.message || 'Gagal me-render pratinjau snapshot.';
    } finally {
      isRendering = false;
    }
  }

  // Toggle Opsi Mode Bingkai
  function toggleFrameMode(frame: boolean) {
    if (includeFrame === frame) return;
    includeFrame = frame;
    persistChanges();
    renderPreview();
  }

  // Toggle Sertakan Harga Terakhir
  function togglePrice(e: Event) {
    includePrice = (e.target as HTMLInputElement).checked;
    persistChanges();
    renderPreview();
  }

  // Toggle Sertakan Waktu Analisis
  function toggleTimestamp(e: Event) {
    includeTimestamp = (e.target as HTMLInputElement).checked;
    persistChanges();
    renderPreview();
  }

  // Ganti Cakupan Snapshot (Chart Aktif vs Grid Layout)
  function handleScopeChange(scope: 'active' | 'all') {
    if (snapshotScope === scope) return;
    snapshotScope = scope;
    persistChanges();
    renderPreview();
  }

  // Eksekusi Salin Gambar ke Clipboard
  async function handleCopyToClipboard() {
    try {
      const composite = generateCurrentComposite();
      if (!composite) {
        onLog?.('Kanvas grafik tidak tersedia untuk disalin.', 'warn');
        return;
      }

      const res = await copySnapshotToClipboard(composite);
      if (res.success) {
        copied = true;
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
          copied = false;
        }, 2200);
        onLog?.('Snapshot grafik disalin ke clipboard! (PNG 2x HiDPI)', 'success');
      } else {
        // Fallback jika Clipboard API diblokir oleh browser / OS
        const isMulti = snapshotScope === 'all';
        const filename = generateSnapshotFilename(
          isMulti ? 'MULTI-CHART-GRID' : activeSymbol,
          isMulti ? `layout-${currentLayout}` : activeTimeframe,
          capturedAt
        );
        downloadSnapshot(composite, filename);
        onLog?.(`Akses clipboard ditolak. Gambar otomatis disimpan sebagai ${filename}`, 'info');
      }
    } catch (err: any) {
      onLog?.(err?.message || 'Gagal menyalin gambar ke clipboard.', 'warn');
    }
  }

  // Eksekusi Unduh Berkas PNG
  function handleDownloadImage() {
    try {
      const composite = generateCurrentComposite();
      if (!composite) {
        onLog?.('Kanvas grafik tidak tersedia untuk diunduh.', 'warn');
        return;
      }

      const isMulti = snapshotScope === 'all';
      const filename = generateSnapshotFilename(
        isMulti ? 'MULTI-CHART-GRID' : activeSymbol,
        isMulti ? `layout-${currentLayout}` : activeTimeframe,
        capturedAt
      );
      downloadSnapshot(composite, filename);
      onLog?.(`Snapshot berhasil disimpan sebagai ${filename}`, 'success');
    } catch (err: any) {
      onLog?.(err?.message || 'Gagal mengunduh gambar snapshot.', 'warn');
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
  <div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
    <div
      class="snapshot-modal-card obsidian-panel"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-modal-title"
    >
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="brand-badge-icon">
            <Camera size={15} />
          </div>
          <div class="header-titles">
            <h3 id="snapshot-modal-title">Pratinjau Snapshot Grafik</h3>
            <span class="header-subtitle mono-nums">
              {#if snapshotScope === 'all'}
                MULTI-CHART GRID · LAYOUT {currentLayout.toUpperCase()} · {activeProviderId.toUpperCase()}
              {:else}
                {activeSymbol} · {activeTimeframe} · {activeProviderId.toUpperCase()}
              {/if}
            </span>
          </div>
        </div>
        <button
          type="button"
          class="close-btn"
          title="Tutup (Esc)"
          aria-label="Tutup Dialog"
          onclick={onClose}
        >
          <X size={15} />
        </button>
      </div>

      <!-- Modal Body (Preview & Controls) -->
      <div class="modal-body">
        <!-- Area Pratinjau Visual (Kiri / Tengah) -->
        <div class="preview-stage">
          <!-- Interactive Zoom Controls Toolbar (User Story 12) -->
          <div class="preview-zoom-toolbar">
            <button
              type="button"
              class="zoom-btn"
              title="Perkecil Zoom (-)"
              aria-label="Perkecil Zoom (-)"
              disabled={zoomLevel <= 0.25}
              onclick={handleZoomOut}
            >
              <Minus size={13} />
            </button>
            <button
              type="button"
              class="zoom-btn zoom-reset-btn"
              title="Reset Zoom (100%)"
              aria-label="Reset Zoom (100%)"
              onclick={handleResetZoom}
            >
              <span>{Math.round(zoomLevel * 100)}%</span>
            </button>
            <button
              type="button"
              class="zoom-btn"
              title="Perbesar Zoom (+)"
              aria-label="Perbesar Zoom (+)"
              disabled={zoomLevel >= 3}
              onclick={handleZoomIn}
            >
              <Plus size={13} />
            </button>
          </div>

          {#if isRendering}
            <div class="preview-loading">
              <span class="loading-spinner"></span>
              <span>Membuat komposit grafik...</span>
            </div>
          {:else if renderError}
            <div class="preview-error">
              <ImageIcon size={32} class="text-muted" />
              <p class="error-text">{renderError}</p>
            </div>
          {:else if previewUrl}
            <div class="preview-viewport">
              <div
                class="preview-image-box"
                style="transform: scale({zoomLevel}); transform-origin: center center;"
              >
                <img
                  src={previewUrl}
                  alt="Pratinjau Snapshot Grafik"
                  class="preview-img"
                />
              </div>
            </div>
          {/if}

          <!-- Metadata Status Bar di bawah pratinjau -->
          <div class="preview-infobar">
            <span class="info-tag mono-nums">
              Dimensi: {previewDimensions.width} × {previewDimensions.height} px (2x HiDPI)
            </span>
            <span class="info-tag format-badge">PNG 100% Client-Side</span>
          </div>
        </div>

        <!-- Sidebar Kontrol Opsi (Kanan) -->
        <div class="controls-sidebar">
          <div class="sidebar-section">
            <span class="section-title">GAYA EKSPOR (EXPORT MODE)</span>
            <div class="mode-toggle-group">
              <button
                type="button"
                class="mode-btn {includeFrame ? 'active' : ''}"
                onclick={() => toggleFrameMode(true)}
              >
                <div class="mode-btn-content">
                  <Sparkles size={13} class="icon-sparkle" />
                  <span class="btn-title">Branded Frame</span>
                </div>
                <span class="btn-desc">Kartu showcase + Attribution Bar</span>
              </button>

              <button
                type="button"
                class="mode-btn {!includeFrame ? 'active' : ''}"
                onclick={() => toggleFrameMode(false)}
              >
                <div class="mode-btn-content">
                  <ImageIcon size={13} />
                  <span class="btn-title">Clean Chart</span>
                </div>
                <span class="btn-desc">Piksel murni tanpa kartu bingkai</span>
              </button>
            </div>
          </div>

          <!-- Pilihan Multi-Chart Scope (tampil jika layout bukan single 1) -->
          {#if currentLayout !== '1'}
            <div class="sidebar-section">
              <span class="section-title">CAKUPAN GRAFIK (SCOPE)</span>
              <div class="scope-toggle-group">
                <button
                  type="button"
                  class="scope-btn {snapshotScope === 'active' ? 'active' : ''}"
                  onclick={() => handleScopeChange('active')}
                >
                  <Layers size={12} />
                  <span>Chart Aktif Saja</span>
                </button>
                <button
                  type="button"
                  class="scope-btn {snapshotScope === 'all' ? 'active' : ''}"
                  onclick={() => handleScopeChange('all')}
                >
                  <Layers size={12} class="rotate-icon" />
                  <span>Seluruh Grid Workspace</span>
                </button>
              </div>
            </div>
          {/if}

          <!-- Pilihan Elemen Attribution Bar (hanya relevan di mode branded frame) -->
          {#if includeFrame}
            <div class="sidebar-section">
              <span class="section-title">METADATA ATTRIBUTION BAR</span>
              <div class="toggles-list">
                <label class="toggle-row">
                  <div class="toggle-label-wrap">
                    <DollarSign size={13} class="toggle-icon text-brand-cyan" />
                    <span class="toggle-label">Sertakan Harga Terakhir</span>
                  </div>
                  <input
                    type="checkbox"
                    class="custom-switch"
                    checked={includePrice}
                    onchange={togglePrice}
                  />
                </label>

                <label class="toggle-row">
                  <div class="toggle-label-wrap">
                    <Clock size={13} class="toggle-icon text-muted" />
                    <span class="toggle-label">Sertakan Waktu Analisis</span>
                  </div>
                  <input
                    type="checkbox"
                    class="custom-switch"
                    checked={includeTimestamp}
                    onchange={toggleTimestamp}
                  />
                </label>
              </div>
            </div>
          {/if}

          <!-- Ringkasan Informasi Privasi -->
          <div class="sidebar-footer-note">
            <p>
              🔒 <strong>100% Offline:</strong> Seluruh proses komposit berjalan di perangkat Anda tanpa transmisi cloud. Preferensi tersimpan otomatis.
            </p>
          </div>
        </div>
      </div>

      <!-- Modal Actions Footer -->
      <div class="modal-footer">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={onClose}
        >
          Tutup
        </button>

        <div class="primary-actions">
          <!-- Tombol Salin ke Clipboard -->
          <button
            type="button"
            class="btn btn-copy {copied ? 'btn-copied' : ''}"
            onclick={handleCopyToClipboard}
            title="Salin gambar PNG ke clipboard"
          >
            {#if copied}
              <Check size={14} class="btn-icon" />
              <span>Tersalin ke Clipboard!</span>
            {:else}
              <Copy size={14} class="btn-icon" />
              <span>Salin ke Clipboard</span>
            {/if}
          </button>

          <!-- Tombol Simpan Berkas PNG -->
          <button
            type="button"
            class="btn btn-download"
            onclick={handleDownloadImage}
            title="Unduh berkas PNG ke penyimpanan komputer"
          >
            <Download size={14} class="btn-icon" />
            <span>Unduh PNG</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(6, 9, 14, 0.82);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .snapshot-modal-card {
    width: 1060px;
    max-width: 95vw;
    max-height: 92vh;
    background-color: var(--bg-surface, #111318);
    border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85), 0 0 1px rgba(255, 255, 255, 0.12);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  .modal-header {
    height: 52px;
    padding: 0 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-panel, #171920);
    border-bottom: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.06));
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-badge-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 105, 180, 0.14);
    color: #ff69b4;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 105, 180, 0.25);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .header-titles h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #ffffff);
    letter-spacing: -0.01em;
  }

  .header-subtitle {
    font-size: 11px;
    color: var(--text-muted, #7c828d);
    font-family: var(--font-mono, monospace);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    background: transparent;
    border: none;
    color: var(--text-muted, #7c828d);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .close-btn:hover {
    background-color: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  /* Modal Body */
  .modal-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Preview Stage */
  .preview-stage {
    flex: 1;
    background-color: #08090b;
    background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 0);
    background-size: 16px 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 380px;
    position: relative;
    overflow: auto;
  }

  .preview-loading,
  .preview-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-muted, #7c828d);
    font-size: 13px;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #ff69b4;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-text {
    margin: 0;
    color: #e06c75;
  }

  /* Zoom Toolbar (#95 User Story 12) */
  .preview-zoom-toolbar {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 10;
    display: flex;
    align-items: center;
    background: rgba(20, 20, 20, 0.75);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-xs, 4px);
    backdrop-filter: blur(8px);
    padding: 2px 4px;
    gap: 2px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .zoom-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #7c828d);
    padding: 4px 6px;
    cursor: pointer;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-mono, monospace);
    transition: all 0.12s ease;
  }

  .zoom-btn:hover:not(:disabled) {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }

  .zoom-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .zoom-reset-btn {
    min-width: 44px;
  }

  .preview-viewport {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    width: 100%;
    min-height: 0;
    overflow: auto;
    margin-bottom: 12px;
  }

  .preview-image-box {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease-out;
  }

  .preview-img {
    max-width: 100%;
    max-height: 480px;
    object-fit: contain;
    border-radius: 6px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.15);
  }

  .preview-infobar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
  }

  .info-tag {
    font-size: 11px;
    color: #7c828d;
    background: rgba(255, 255, 255, 0.04);
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .format-badge {
    color: #26a69a;
    font-weight: 500;
  }

  /* Sidebar Controls */
  .controls-sidebar {
    width: 320px;
    background-color: var(--bg-panel, #171920);
    border-left: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.06));
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }

  .sidebar-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-muted, #7c828d);
  }

  /* Mode Toggle */
  .mode-toggle-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .mode-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.06));
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .mode-btn.active {
    background: rgba(255, 105, 180, 0.08);
    border-color: #ff69b4;
  }

  .mode-btn-content {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 2px;
  }

  .mode-btn.active .mode-btn-content {
    color: #ff69b4;
  }

  .icon-sparkle {
    color: #ff69b4;
  }

  .btn-desc {
    font-size: 10px;
    color: var(--text-muted, #7c828d);
    line-height: 1.25;
  }

  /* Scope Toggle */
  .scope-toggle-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .scope-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.06));
    font-size: 12px;
    color: var(--text-secondary, #b0b4bb);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .scope-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .scope-btn.active {
    background: rgba(0, 188, 212, 0.1);
    border-color: #00bcd4;
    color: #00bcd4;
    font-weight: 600;
  }

  .rotate-icon {
    transform: rotate(90deg);
  }

  /* Toggles List */
  .toggles-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    padding: 10px 12px;
    border-radius: 6px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .toggle-label-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toggle-label {
    font-size: 12px;
    color: var(--text-primary, #ffffff);
  }

  .text-brand-cyan {
    color: #00bcd4;
  }

  .custom-switch {
    appearance: none;
    width: 32px;
    height: 18px;
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    position: relative;
    cursor: pointer;
    outline: none;
    transition: background-color 0.2s ease;
  }

  .custom-switch::after {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: #ffffff;
    top: 2px;
    left: 2px;
    transition: transform 0.2s ease;
  }

  .custom-switch:checked {
    background-color: #ff69b4;
  }

  .custom-switch:checked::after {
    transform: translateX(14px);
  }

  /* Footer Note */
  .sidebar-footer-note {
    margin-top: auto;
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-muted, #7c828d);
    background: rgba(255, 255, 255, 0.02);
    border-left: 2px solid #ff69b4;
    padding: 8px 10px;
    border-radius: 0 4px 4px 0;
  }

  .sidebar-footer-note strong {
    color: var(--text-primary, #ffffff);
  }

  /* Modal Footer */
  .modal-footer {
    height: 56px;
    padding: 0 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-panel, #171920);
    border-top: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.06));
    flex-shrink: 0;
  }

  .primary-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    padding: 0 14px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
    border: none;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-secondary, #b0b4bb);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-copy {
    background: #00bcd4;
    color: #06090e;
    font-weight: 600;
  }

  .btn-copy:hover {
    background: #26c6da;
    box-shadow: 0 0 12px rgba(0, 188, 212, 0.35);
  }

  .btn-copy.btn-copied {
    background: #26a69a;
    color: #ffffff;
  }

  .btn-download {
    background: #ff69b4;
    color: #0f0f0f;
    font-weight: 600;
  }

  .btn-download:hover {
    background: #ff80bf;
    box-shadow: 0 0 12px rgba(255, 105, 180, 0.35);
  }
</style>
