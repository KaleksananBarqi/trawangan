<script lang="ts">
  import {
    Search,
    X,
    HelpCircle,
    Grid,
    Code,
    Radio,
    Pencil,
    Sparkles,
  } from "@lucide/svelte";
  import {
    SHORTCUT_GLOSSARY,
    filterShortcuts,
  } from "../../services/commandDispatcher";
  import { tr } from "../../i18n";

  interface Props {
    onOpenGestureGuide?: () => void;
  }

  let { onOpenGestureGuide }: Props = $props();

  let helpSearchQuery = $state("");

  let filteredShortcuts = $derived.by(() => {
    return filterShortcuts(helpSearchQuery);
  });

  let groupedShortcuts = $derived.by(() => {
    const groups: Record<string, typeof SHORTCUT_GLOSSARY> = {};
    for (const item of filteredShortcuts) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  });

  function translateCategoryName(
    cat: string,
    trFn: (jv: string, id: string, en: string) => string,
  ): string {
    switch (cat) {
      case "Navigasi & Simbol":
        return trFn(
          "Navigasi & Golek Koin",
          "Navigasi & Simbol",
          "Navigation & Symbols",
        );
      case "Alat Gambar (Drawing Tools)":
        return trFn(
          "Alat Gambar (Drawing Tools)",
          "Alat Gambar (Drawing Tools)",
          "Drawing Tools",
        );
      case "Alat Gambar & Anotasi":
        return trFn(
          "Alat Gambar & Corat-Coret",
          "Alat Gambar & Anotasi",
          "Drawings & Annotations",
        );
      case "Bar Replay (Simulasi)":
        return trFn(
          "Bar Replay (Latihan Backtest)",
          "Bar Replay (Simulasi)",
          "Bar Replay (Simulation)",
        );
      case "Analisis & Indikator":
        return trFn(
          "Analisa & Indikator",
          "Analisis & Indikator",
          "Analysis & Indicators",
        );
      case "Skala & Tampilan Grafik":
        return trFn(
          "Skala & Tampilan Chart",
          "Skala & Tampilan Grafik",
          "Scale & Chart View",
        );
      case "Timeframe Cepat":
        return trFn(
          "Pindah Timeframe Kilat",
          "Timeframe Cepat",
          "Quick Timeframes",
        );
      case "Sistem & Bantuan":
        return trFn("Sistem & Bantuan", "Sistem & Bantuan", "System & Help");
      default:
        return cat;
    }
  }
</script>

<div class="help-pane">
  <!-- Header Seksi Bantuan -->
  <div class="section-group">
    <div class="help-header-flex">
      <div>
        <h3 class="section-heading">
          {$tr(
            "Markas Bantuan & Contekan Shortcut",
            "Pusat Bantuan & Panduan Shortcut",
            "Help Center & Keyboard Shortcuts",
          )}
        </h3>
        <p class="section-desc">
          {$tr(
            "Apalno tombol shortcut iki ben tanganmu sat-set pas nggambar SNR, mbukak koin, lan nganalisa market.",
            "Gunakan tombol pintas keyboard berikut untuk mempercepat navigasi grafik, eksekusi alat gambar, dan analisis pasar.",
            "Master these keyboard shortcuts to speed up chart navigation, drawing execution, and market analysis.",
          )}
        </p>
      </div>
      <div class="help-f1-badge mono-nums">
        <span
          >{$tr(
            "Shortcut Bantuan:",
            "Shortcut Bantuan:",
            "Help Shortcut:",
          )}</span
        > <kbd class="kbd-key">F1</kbd> / <kbd class="kbd-key">?</kbd>
      </div>
    </div>

    <!-- Input Pencarian Cepat Shortcut -->
    <div class="shortcut-search-box">
      <Search size={14} class="search-icon-dim" />
      <input
        type="text"
        placeholder={$tr(
          "Golek tombol shortcut (conto: replay, alt, kursor, fit)...",
          "Cari tombol shortcut (e.g. replay, alt, kursor, fit)...",
          "Search shortcuts (e.g. replay, alt, cursor, fit)...",
        )}
        bind:value={helpSearchQuery}
        class="shortcut-search-input"
      />
      {#if helpSearchQuery}
        <button class="clear-search-btn" onclick={() => (helpSearchQuery = "")}>
          <X size={12} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Daftar Shortcut Per Kategori -->
  <div class="section-group">
    <div class="shortcut-categories-container">
      {#if Object.keys(groupedShortcuts).length === 0}
        <div class="empty-shortcut-state">
          <HelpCircle size={24} class="text-dim" />
          <span
            >{$tr(
              `Gak nemu shortcut sing cocok karo "${helpSearchQuery}", Rek.`,
              `Tidak ada tombol shortcut yang cocok dengan "${helpSearchQuery}".`,
              `No keyboard shortcuts matched "${helpSearchQuery}".`,
            )}</span
          >
        </div>
      {/if}

      {#each Object.entries(groupedShortcuts) as [categoryName, items]}
        <div class="shortcut-category-card">
          <div class="category-header">
            <span class="category-title"
              >{translateCategoryName(categoryName, $tr)}</span
            >
            <span class="category-count mono-nums"
              >{items.length} {$tr("shortcut", "pintasan", "shortcuts")}</span
            >
          </div>

          <div class="shortcut-items-table">
            {#each items as item}
              <div class="shortcut-row">
                <div class="shortcut-keys-wrapper">
                  {#each item.keys as keyPart, idx}
                    <kbd class="kbd-key mono-nums">{keyPart}</kbd>
                    {#if idx < item.keys.length - 1}
                      <span class="kbd-plus">+</span>
                    {/if}
                  {/each}
                </div>
                <div class="shortcut-desc">{item.desc}</div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Panduan Fitur Inti (Quick Guide) -->
  <div class="section-group">
    <h4 class="section-title">
      {$tr(
        "Contekan Kilat Fitur Andalan",
        "Panduan Ringkas Fitur Utama",
        "Core Feature Quick Guides",
      )}
    </h4>
    <div class="feature-guides-grid">
      <div class="feature-guide-card">
        <div class="guide-card-header">
          <Grid size={14} class="text-cyan" />
          <span class="guide-card-title"
            >{$tr(
              "Multi-Chart & Sinkronisasi",
              "Multi-Chart & Sinkronisasi",
              "Multi-Chart & Grid Sync",
            )}</span
          >
        </div>
        <p class="guide-card-body">
          {$tr(
            "Pilih tata letak multi-chart (1, 2 Horisontal, 2 Vertikal, 4 Grid) liwat menu Workspace & Layout. Uripno sinkronisasi kursor crosshair, geseran waktu viewport, koin, lan gambar langsung teko menu Actions nang header.",
            "Pilih tata letak multi-chart (1, 2 Horisontal, 2 Vertikal, 4 Grid) lewat menu Workspace & Layout. Aktifkan sinkronisasi kursor crosshair, gerakan waktu viewport, simbol, dan objek gambar secara langsung lewat menu Actions di header.",
            "Switch multi-chart layouts (1, 2 Horizontal, 2 Vertical, 4 Grid) via the Workspace & Layout menu. Toggle crosshair, time viewport, symbol, and drawing sync from the header Actions menu.",
          )}
        </p>
      </div>

      <div class="feature-guide-card">
        <div class="guide-card-header">
          <Code size={14} class="text-bull" />
          <span class="guide-card-title">Pine Script v6 IDE & Backtester</span>
        </div>
        <p class="guide-card-body">
          {$tr(
            "Bukak Pine Script v6 IDE liwat ikon <> nang Right Dock Rail, Library Indikator (Edit di IDE / + Buat Skrip Baru), Unified Object Tree, utawa pencet Alt+E gawe ngoprek indikator lan ngetes strategi nang Web Worker lokal.",
            "Buka Pine Script v6 IDE lewat ikon <> di Right Dock Rail, Library Indikator (Edit di IDE / + Buat Skrip Baru), ikon <> pada Unified Object Tree, atau pintasan Alt+E untuk membuat, menyunting, dan mengevaluasi indikator serta strategi kuantitatif di Web Worker independen.",
            "Open the Pine Script v6 IDE via the <> icon in the Right Dock Rail, Indicator Library, Unified Object Tree, or press Alt+E to write and backtest custom indicators inside an isolated Web Worker.",
          )}
        </p>
      </div>

      <div class="feature-guide-card">
        <div class="guide-card-header">
          <Radio size={14} class="text-amber" />
          <span class="guide-card-title"
            >{$tr(
              "Data Feed Multi-Bursa",
              "Data Feed Binance & Bitunix",
              "Multi-Exchange Market Feeds",
            )}</span
          >
        </div>
        <p class="guide-card-body">
          {$tr(
            "Gonta-ganti sumber data live antarane Binance, Indodax IDR, Bitunix Futures, Hyperliquid, lan Coinbase nang tab Data Feed Pasar. Kabeh koin spot, perpetual .P, saham IDX, lan XAUUSD langsung jalan mulus!",
            "Ganti penyedia feed live antara Binance Futures dan Bitunix Futures di tab Data Feed. trawangan Terminal mendukung format koin perpetual standar dan simbol .P secara mulus.",
            "Switch live market feeds across Binance, Indodax IDR, Bitunix Futures, Hyperliquid, and Coinbase in the Data Feed tab with seamless .P perpetual symbol support.",
          )}
        </p>
      </div>

      <div class="feature-guide-card">
        <div class="guide-card-header">
          <Pencil size={14} class="text-cyan" />
          <span class="guide-card-title">Draw by Holding (Gesture Engine)</span>
        </div>
        <p class="guide-card-body">
          {$tr(
            "Tahan tombol ~ utawa pencet Shift+D nang kanvas chart gawe nggambar bebas sat-set! Goresanmu otomatis dadi Trend Line, Ray, Horizontal Line, Box, Ellipse, Fib, Polyline, Arrow, utawa coret zig-zag (Scribble to Erase) gawe mbusek.",
            "Tahan tombol ~ atau aktifkan mode Shift+D di kanvas grafik untuk menggambar bebas. Goresan otomatis dikenali menjadi Trend Line, Ray, Horizontal Line, Box, Ellipse, Fib, Polyline, Arrow, atau Scribble to Erase.",
            "Hold ~ or toggle Shift+D on the chart canvas to sketch freehand. Strokes automatically snap into Trend Lines, Rays, Horizontal Lines, Boxes, Ellipses, Fibs, Polylines, Arrows, or Scribble-to-Erase.",
          )}
        </p>
        {#if onOpenGestureGuide}
          <button
            type="button"
            class="guide-action-btn"
            onclick={() => onOpenGestureGuide?.()}
          >
            <Sparkles size={11} />
            <span
              >{$tr(
                "Bukak Panduan Gambar...",
                "Buka Panduan Visual...",
                "Open Visual Gesture Guide...",
              )}</span
            >
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .help-pane {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .help-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .section-heading {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    color: var(--text-base, #ffffff);
  }

  .section-desc {
    font-size: 11px;
    color: var(--text-dim, #6e7681);
    margin: 4px 0 0 0;
    line-height: 1.4;
  }

  .help-f1-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-dim, #8b949e);
    padding: 4px 8px;
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 4px;
    white-space: nowrap;
  }

  .shortcut-search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    padding: 6px 12px;
  }

  .shortcut-search-box:focus-within {
    border-color: var(--border-focus, #58a6ff);
  }

  .shortcut-search-input {
    background: transparent;
    border: none;
    color: var(--text-base, #ffffff);
    font-size: 12px;
    outline: none;
    flex: 1;
  }

  .clear-search-btn {
    background: transparent;
    border: none;
    color: var(--text-dim, #6e7681);
    cursor: pointer;
  }

  .shortcut-categories-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shortcut-category-card {
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    overflow: hidden;
  }

  .category-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--border-subtle, #30363d);
  }

  .category-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .category-count {
    font-size: 10px;
    color: var(--text-dim, #6e7681);
  }

  .shortcut-items-table {
    display: flex;
    flex-direction: column;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid rgba(48, 54, 61, 0.4);
    font-size: 11px;
  }

  .shortcut-row:last-child {
    border-bottom: none;
  }

  .shortcut-keys-wrapper {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .kbd-key {
    background: var(--bg-subtle, #0d1117);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-base, #ffffff);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
  }

  .kbd-plus {
    color: var(--text-dim, #6e7681);
    font-size: 9px;
  }

  .shortcut-desc {
    color: var(--text-dim, #8b949e);
  }

  .empty-shortcut-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px;
    color: var(--text-dim, #6e7681);
    font-size: 12px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .feature-guides-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }

  .feature-guide-card {
    background: var(--bg-surface, #161b22);
    border: 1px solid var(--border-subtle, #30363d);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .guide-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .guide-card-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-base, #ffffff);
  }

  .guide-card-body {
    font-size: 10.5px;
    color: var(--text-dim, #8b949e);
    line-height: 1.4;
    margin: 0;
  }

  .guide-action-btn {
    margin-top: 4px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 4px;
    color: var(--brand-cyan, #38bdf8);
    font-size: 10px;
    font-weight: 600;
    padding: 4px 8px;
    cursor: pointer;
    align-self: flex-start;
    transition: all 0.12s ease;
  }

  .guide-action-btn:hover {
    background: var(--brand-cyan, #38bdf8);
    color: #0b0d12;
  }

  .text-cyan {
    color: #38bdf8;
  }
  .text-bull {
    color: #3fb950;
  }
  .text-amber {
    color: #f59e0b;
  }
</style>
