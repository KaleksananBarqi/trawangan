<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
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
    Minus,
    Folder
  } from '@lucide/svelte';
  import { THEME_PRESETS } from '../constants/themes';
  import type { AppSettings, SnapshotScaleMultiplier } from '../types/market';
  import {
    compositeSnapshot,
    generateSnapshotFilename,
    copySnapshotToClipboard,
    downloadSnapshot,
    saveSnapshotToFile,
    openSnapshotFolder,
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
  let scaleMultiplier = $state<SnapshotScaleMultiplier>(2);

  // State Zoom & Snapshot Frozen Data (Mencegah re-render dari WebSocket ticker)
  let zoomLevel = $state(1);
  let capturedAt = $state<number>(Date.now());
  let capturedPrice = $state<number | null>(null);

  // Cache kanvas sumber grafik saat modal dibuka untuk mencegah re-evaluasi WebGL sinkron (non-reaktif untuk efisiensi Svelte 5)
  let cachedSourceCanvas: HTMLCanvasElement | null = null;

  // State Pratinjau
  let previewUrl = $state<string>('');
  let previewBlobUrl: string | null = null;
  let previewDimensions = $state<{ width: number; height: number }>({ width: 0, height: 0 });
  let isRendering = $state(false);
  let isExporting = $state(false);
  let renderError = $state<string | null>(null);

  // Status visual aksi
  let copied = $state(false);
  let copyTimer: any = null;

  // Guard untuk mendeteksi transisi tepi (edge-triggered) buka/tutup modal
  let wasOpen = false;

  /**
   * Membersihkan Object URL blob dari memori untuk mencegah memory leak
   */
  function revokePreviewUrl() {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      previewBlobUrl = null;
    }
  }

  // Inisialisasi snapshot saat modal dibuka dengan guard dan untrack
  // Mencegah cyclic reactive dependency dan WebSocket price flood
  $effect(() => {
    if (isOpen && !wasOpen) {
      wasOpen = true;
      untrack(() => {
        capturedAt = Date.now();
        capturedPrice = currentPrice;
        zoomLevel = 1;
        includeFrame = appSettings.snapshotIncludeFrame ?? true;
        includePrice = appSettings.snapshotIncludePrice ?? true;
        includeTimestamp = appSettings.snapshotIncludeTimestamp ?? true;
        snapshotScope = appSettings.snapshotScope ?? 'active';
        scaleMultiplier = appSettings.snapshotScaleMultiplier ?? 2;

        // Tangkap kanvas sumber sekali saja saat modal dibuka
        cachedSourceCanvas = getScreenshotCanvas(snapshotScope);
        renderPreview();
      });
    } else if (!isOpen && wasOpen) {
      wasOpen = false;
      untrack(() => {
        if (copyTimer) {
          clearTimeout(copyTimer);
          copyTimer = null;
        }
        copied = false;
        cachedSourceCanvas = null;
        revokePreviewUrl();
        previewUrl = '';
      });
    }
  });

  onDestroy(() => {
    if (copyTimer) clearTimeout(copyTimer);
    revokePreviewUrl();
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
      snapshotScaleMultiplier: scaleMultiplier,
    });
  }

  /**
   * Menghasilkan kanvas komposit snapshot berdasarkan konfigurasi aktif
   */
  function generateCurrentComposite(): HTMLCanvasElement | null {
    if (!cachedSourceCanvas) {
      cachedSourceCanvas = getScreenshotCanvas(snapshotScope);
    }
    const sourceCanvas = cachedSourceCanvas;
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
      lastPrice: capturedPrice,
      timezone: appSettings.timezone || 'Asia/Jakarta',
      timestamp: capturedAt,
      layout: currentLayout,
      scope: 'active',
    };

    const activeTheme = THEME_PRESETS[appSettings.themePreset || 'signature'] || THEME_PRESETS.signature;
    const backgroundColor = activeTheme?.chart?.background || activeTheme?.tokens?.bgDarkest || '#0F0F0F';

    const options: SnapshotOptions = {
      mode: includeFrame ? 'branded' : 'clean',
      scaleMultiplier: scaleMultiplier,
      backgroundColor,
      customBackground: appSettings.customChartBackground,
      includePrice,
      includeTimestamp,
      metadata,
      userProfile: appSettings.userProfile,
    };

    return compositeSnapshot(sourceCanvas, options);
  }

  /**
   * Me-render ulang gambar pratinjau snapshot secara reaktif dan asinkron
   */
  async function renderPreview() {
    isRendering = true;
    renderError = null;

    // Beri jeda tick mikro agar loader spinner ter-render responsif di thread UI
    await new Promise((resolve) => setTimeout(resolve, 16));

    try {
      const composite = generateCurrentComposite();
      if (!composite) {
        renderError = 'Kanvas grafik belum siap atau tidak ditemukan.';
        revokePreviewUrl();
        previewUrl = '';
        return;
      }

      previewDimensions = {
        width: composite.width,
        height: composite.height,
      };

      if (typeof composite.toBlob === 'function') {
        composite.toBlob((blob) => {
          if (!blob) {
            renderError = 'Gagal membuat berkas gambar pratinjau.';
            return;
          }
          revokePreviewUrl();
          previewBlobUrl = URL.createObjectURL(blob);
          previewUrl = previewBlobUrl;
        }, 'image/png');
      } else if (typeof composite.toDataURL === 'function') {
        // Fallback untuk lingkungan tanpa Blob ObjectURL (cth. pengujian headless sederhana)
        revokePreviewUrl();
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

  // Ganti Multiplier Resolusi Snapshot (#125)
  async function handleScaleMultiplierChange(mult: SnapshotScaleMultiplier) {
    if (scaleMultiplier === mult || isRendering) return;
    scaleMultiplier = mult;
    persistChanges();
    await renderPreview();
  }

  // Menghitung estimasi dimensi piksel riil berdasarkan ukuran chart aktual (#125)
  function getEstimatedPixelDimensions(mult: SnapshotScaleMultiplier): string {
    const sourceW = cachedSourceCanvas?.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const sourceH = cachedSourceCanvas?.height || (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.75) : 1080);
    const dim = calculateCompositeDimensions(sourceW, sourceH, {
      mode: includeFrame ? 'branded' : 'clean',
      scaleMultiplier: mult,
      metadata: {
        symbol: activeSymbol,
        timeframe: activeTimeframe,
        providerId: activeProviderId,
      },
    });
    return `${mult}x · ${dim.width} × ${dim.height} px`;
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
    // Ambil tangkapan kanvas baru khusus untuk scope yang berbeda
    cachedSourceCanvas = getScreenshotCanvas(scope);
    persistChanges();
    renderPreview();
  }

  // Eksekusi Salin Gambar ke Clipboard
  async function handleCopyToClipboard() {
    if (isExporting || isRendering) return;
    isExporting = true;
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
        onLog?.(`Snapshot grafik disalin ke clipboard! (PNG ${scaleMultiplier}x)`, 'success');
      } else {
        // Fallback jika Clipboard API diblokir oleh browser / OS: simpan ke berkas
        const isMulti = snapshotScope === 'all';
        const filename = generateSnapshotFilename(
          isMulti ? 'MULTI-CHART-GRID' : activeSymbol,
          isMulti ? `layout-${currentLayout}` : activeTimeframe,
          capturedAt
        );
        const saveRes = await saveSnapshotToFile(composite, filename, appSettings.snapshotDirectory);
        onLog?.(`Akses clipboard ditolak. Gambar otomatis disimpan di: ${saveRes.filePath || filename}`, 'info');
      }
    } catch (err: any) {
      onLog?.(err?.message || 'Gagal menyalin gambar ke clipboard.', 'warn');
    } finally {
      isExporting = false;
    }
  }

  // Eksekusi Simpan / Unduh Berkas PNG ke Direktori
  async function handleDownloadImage() {
    if (isExporting || isRendering) return;
    isExporting = true;
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
      const res = await saveSnapshotToFile(composite, filename, appSettings.snapshotDirectory);
      if (res.success) {
        onLog?.(`Snapshot berhasil disimpan di: ${res.filePath || filename} (${scaleMultiplier}x)`, 'success');
      } else {
        onLog?.(res.error || 'Gagal menyimpan gambar snapshot.', 'warn');
      }
    } catch (err: any) {
      onLog?.(err?.message || 'Gagal mengunduh gambar snapshot.', 'warn');
    } finally {
      isExporting = false;
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
              <span class="loading-text">Memproses komposit resolusi tinggi ({scaleMultiplier}x)...</span>
              <span class="loading-subtext mono-nums">{getEstimatedPixelDimensions(scaleMultiplier)}</span>
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
              Dimensi: {previewDimensions.width} × {previewDimensions.height} px ({scaleMultiplier}x · {scaleMultiplier === 1 ? 'Standar' : scaleMultiplier === 2 ? 'HiDPI' : scaleMultiplier === 4 ? 'Ultra HD' : 'Super HD'})
            </span>
            <span class="info-tag format-badge">PNG 100% Client-Side</span>
          </div>
        </div>

        <!-- Sidebar Kontrol Opsi (Kanan) -->
        <div class="controls-sidebar">
          <!-- Pilihan Multiplier Skala Resolusi (#125) -->
          <div class="sidebar-section">
            <span class="section-title">RESOLUSI EKSPOR (SCALE MULTIPLIER)</span>
            <div class="scale-multiplier-grid">
              {#each ([1, 2, 4, 6] as const) as mult}
                <button
                  type="button"
                  class="scale-multiplier-card {scaleMultiplier === mult ? 'active' : ''}"
                  onclick={() => handleScaleMultiplierChange(mult)}
                  disabled={isRendering || isExporting}
                >
                  <div class="scale-card-header">
                    <span class="scale-badge-tag">{mult}x</span>
                    <span class="scale-label-name">
                      {mult === 1 ? 'Standar' : mult === 2 ? 'HiDPI Retina' : mult === 4 ? 'Ultra HD 4K' : 'Super HD 6K'}
                    </span>
                  </div>
                  <span class="scale-pixel-dim mono-nums">
                    {getEstimatedPixelDimensions(mult)}
                  </span>
                </button>
              {/each}
            </div>
          </div>

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
                  <span class="btn-title">Branded Snapshot Frame</span>
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
                  <span class="btn-title">Clean Chart Export</span>
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

          <!-- Lokasi Folder Penyimpanan Aktif -->
          <div class="sidebar-section">
            <div class="section-title-row">
              <span class="section-title">LOKASI PENYIMPANAN</span>
              <button
                type="button"
                class="btn-folder-link"
                title="Buka folder penyimpanan di File Manager"
                onclick={() => openSnapshotFolder(appSettings.snapshotDirectory)}
              >
                <Folder size={11} />
                <span>Buka</span>
              </button>
            </div>
            <div class="storage-info-box">
              <span class="storage-path mono-nums" title={appSettings.snapshotDirectory || 'Folder Downloads bawaan sistem'}>
                {appSettings.snapshotDirectory && appSettings.snapshotDirectory.length > 0
                  ? appSettings.snapshotDirectory
                  : 'Downloads (Bawaan OS)'}
              </span>
            </div>
          </div>

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
            disabled={isRendering || isExporting}
            title="Salin gambar PNG ke clipboard"
          >
            {#if isExporting}
              <span class="mini-spinner"></span>
              <span>Memproses...</span>
            {:else if copied}
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
            disabled={isRendering || isExporting}
            title="Unduh berkas PNG ke penyimpanan komputer"
          >
            {#if isExporting}
              <span class="mini-spinner"></span>
              <span>Menyimpan...</span>
            {:else}
              <Download size={14} class="btn-icon" />
              <span>Unduh PNG</span>
            {/if}
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

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-folder-link {
    display: flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: #ff69b4;
    font-size: 10.5px;
    cursor: pointer;
    padding: 0;
    transition: opacity 0.15s ease;
  }

  .btn-folder-link:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  .storage-info-box {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed var(--border-hairline, rgba(255, 255, 255, 0.06));
    border-radius: 6px;
    overflow: hidden;
  }

  .storage-path {
    font-size: 10.5px;
    color: var(--text-muted, #7c828d);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .loading-text {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #ffffff);
  }

  .loading-subtext {
    font-size: 11px;
    color: var(--text-muted, #7c828d);
    letter-spacing: 0.02em;
  }

  .mini-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  /* Scale Multiplier Grid (#125) */
  .scale-multiplier-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .scale-multiplier-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.06));
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    gap: 4px;
  }

  .scale-multiplier-card:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .scale-multiplier-card.active {
    background: rgba(255, 105, 180, 0.1);
    border-color: #ff69b4;
    box-shadow: 0 0 10px rgba(255, 105, 180, 0.15);
  }

  .scale-multiplier-card:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .scale-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
  }

  .scale-badge-tag {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 700;
    color: #ff69b4;
    background: rgba(255, 105, 180, 0.12);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .scale-multiplier-card.active .scale-badge-tag {
    background: #ff69b4;
    color: #0f0f0f;
  }

  .scale-label-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary, #ffffff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .scale-pixel-dim {
    font-size: 9.5px;
    color: var(--text-muted, #7c828d);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }

  .scale-multiplier-card.active .scale-pixel-dim {
    color: #ff80bf;
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
