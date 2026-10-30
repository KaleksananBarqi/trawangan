<script lang="ts">
  import { X, Pencil, Sparkles, Check } from '@lucide/svelte';
  import { DRAW_BY_HOLDING_CARDS, type GestureCheatsheetCard } from '../constants/gestureCheatsheet.js';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen, onClose }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="modal-backdrop" onclick={onClose} role="presentation">
    <div
      class="modal-container obsidian-panel"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-by-holding-title"
    >
      <!-- Header Modal -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <Pencil size={18} class="header-icon text-cyan" />
          </div>
          <div>
            <div class="title-row">
              <h2 id="draw-by-holding-title" class="modal-title">Draw by holding</h2>
              <span class="version-pill mono-nums">Gesture Mode</span>
            </div>
            <p class="modal-subtitle">
              Tahan tombol <kbd class="inline-kbd">~</kbd> atau aktifkan mode <kbd class="inline-kbd">Shift+D</kbd> di kanvas grafik, lalu tarik satu goresan. Goresan akan otomatis bermutasi menjadi gambar yang sesuai.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn-close"
          onclick={onClose}
          aria-label="Tutup Panduan"
          title="Tutup (Esc)"
        >
          <X size={18} />
        </button>
      </div>

      <!-- Grid 13 Kartu Goresan Visual Bergaya OpenMarket -->
      <div class="cards-scroll-area">
        <div class="gesture-grid">
          {#each DRAW_BY_HOLDING_CARDS as card (card.id)}
            <div class="gesture-card" data-card-id={card.id}>
              <!-- Ilustrasi Sketsa Vektor SVG -->
              <div class="card-sketch-box">
                <svg
                  viewBox="0 0 180 110"
                  class="sketch-svg"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  {#if card.id === 'trendline'}
                    <!-- 1. Trend Line: a straight stroke / garis lurus miring -->
                    <g class="sketch-trendline">
                      <line x1="28" y1="84" x2="148" y2="28" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
                      <circle cx="28" cy="84" r="3.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
                      <circle cx="148" cy="28" r="3.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
                      <!-- Garis bantu pudar -->
                      <line x1="28" y1="84" x2="148" y2="84" stroke="rgba(255,255,255,0.12)" stroke-dasharray="3,3" />
                    </g>

                  {:else if card.id === 'ray'}
                    <!-- 2. Ray: straight, into the price axis / lurus menembus sumbu harga -->
                    <g class="sketch-ray">
                      <!-- Sumbu Harga Kanan -->
                      <line x1="145" y1="12" x2="145" y2="98" stroke="rgba(255,255,255,0.22)" stroke-dasharray="3,3" />
                      <text x="150" y="24" fill="#9CA3AF" font-size="8" font-family="monospace">42.5k</text>
                      <text x="150" y="55" fill="#9CA3AF" font-size="8" font-family="monospace">40.0k</text>
                      <text x="150" y="86" fill="#9CA3AF" font-size="8" font-family="monospace">37.5k</text>
                      <!-- Batang Ray menembus garis sumbu harga ke ujung kanan -->
                      <line x1="24" y1="78" x2="168" y2="28" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
                      <circle cx="24" cy="78" r="3.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
                      <path d="M 160 25 L 170 28 L 163 35" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </g>

                  {:else if card.id === 'horizontal'}
                    <!-- 3. Horizontal Line: a flat stroke, lands on the wick / garis datar menempel di ekor lilin -->
                    <g class="sketch-horizontal">
                      <!-- Candlestick Wicks di latar belakang -->
                      <!-- Lilin 1 -->
                      <line x1="60" y1="28" x2="60" y2="85" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />
                      <rect x="54" y="44" width="12" height="30" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
                      <!-- Lilin 2 -->
                      <line x1="115" y1="28" x2="115" y2="75" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />
                      <rect x="109" y="36" width="12" height="26" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
                      <!-- Garis datar horizontal yang snap tepat di ekor y=28 -->
                      <line x1="16" y1="28" x2="164" y2="28" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
                      <!-- Magnet Snap Reticle pada ujung ekor lilin 1 -->
                      <circle cx="60" cy="28" r="4.5" fill="#38BDF8" />
                      <circle cx="60" cy="28" r="8.5" stroke="#38BDF8" stroke-width="1" opacity="0.6" />
                    </g>

                  {:else if card.id === 'vertical'}
                    <!-- 4. Vertical Line: an upright stroke / garis tegak lurus -->
                    <g class="sketch-vertical">
                      <!-- Grid horizontal redup -->
                      <line x1="20" y1="35" x2="160" y2="35" stroke="rgba(255,255,255,0.08)" stroke-dasharray="2,2" />
                      <line x1="20" y1="75" x2="160" y2="75" stroke="rgba(255,255,255,0.08)" stroke-dasharray="2,2" />
                      <!-- Batang Garis Vertikal Lurus -->
                      <line x1="90" y1="14" x2="90" y2="96" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
                      <circle cx="90" cy="14" r="3.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
                      <circle cx="90" cy="96" r="3.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
                      <!-- Sumbu Waktu Bawah -->
                      <line x1="30" y1="96" x2="150" y2="96" stroke="rgba(255,255,255,0.2)" />
                      <line x1="90" y1="96" x2="90" y2="102" stroke="#FFFFFF" stroke-width="1.5" />
                    </g>

                  {:else if card.id === 'rectangle'}
                    <!-- 5. Rectangle: four sides that close / empat sisi tertutup -->
                    <g class="sketch-rectangle">
                      <rect
                        x="32"
                        y="26"
                        width="116"
                        height="58"
                        rx="3"
                        fill="rgba(56, 189, 248, 0.08)"
                        stroke="#FFFFFF"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <!-- Sudut-sudut Anchor -->
                      <circle cx="32" cy="26" r="3" fill="#38BDF8" />
                      <circle cx="148" cy="26" r="3" fill="#38BDF8" />
                      <circle cx="148" cy="84" r="3" fill="#38BDF8" />
                      <circle cx="32" cy="84" r="3" fill="#38BDF8" />
                    </g>

                  {:else if card.id === 'ellipse'}
                    <!-- 6. Ellipse: a round loop / lingkaran/oval mulus -->
                    <g class="sketch-ellipse">
                      <ellipse
                        cx="90"
                        cy="55"
                        rx="58"
                        ry="32"
                        fill="rgba(56, 189, 248, 0.08)"
                        stroke="#FFFFFF"
                        stroke-width="2.5"
                        stroke-linecap="round"
                      />
                      <!-- Titik keliling -->
                      <circle cx="32" cy="55" r="2.5" fill="#38BDF8" />
                      <circle cx="148" cy="55" r="2.5" fill="#38BDF8" />
                      <circle cx="90" cy="23" r="2.5" fill="#38BDF8" />
                      <circle cx="90" cy="87" r="2.5" fill="#38BDF8" />
                    </g>

                  {:else if card.id === 'fib'}
                    <!-- 7. Fib Retracement: three sides, swing to swing / 3 ayunan puncak ke lembah -->
                    <g class="sketch-fib">
                      <!-- Level horizontal fib -->
                      <line x1="20" y1="24" x2="160" y2="24" stroke="rgba(248, 113, 113, 0.5)" stroke-dasharray="2,2" />
                      <text x="135" y="21" fill="rgba(248, 113, 113, 0.85)" font-size="7" font-family="monospace">1.000</text>
                      <line x1="20" y1="46" x2="160" y2="46" stroke="rgba(250, 204, 21, 0.5)" stroke-dasharray="2,2" />
                      <text x="135" y="43" fill="rgba(250, 204, 21, 0.85)" font-size="7" font-family="monospace">0.618</text>
                      <line x1="20" y1="56" x2="160" y2="56" stroke="rgba(74, 222, 128, 0.5)" stroke-dasharray="2,2" />
                      <text x="135" y="53" fill="rgba(74, 222, 128, 0.85)" font-size="7" font-family="monospace">0.500</text>
                      <line x1="20" y1="86" x2="160" y2="86" stroke="rgba(96, 165, 250, 0.5)" stroke-dasharray="2,2" />
                      <text x="135" y="83" fill="rgba(96, 165, 250, 0.85)" font-size="7" font-family="monospace">0.000</text>

                      <!-- Ayunan Z-Shape Goresan Gesture -->
                      <path
                        d="M 32 24 L 86 86 L 140 46"
                        fill="none"
                        stroke="#FFFFFF"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <circle cx="32" cy="24" r="3.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
                      <circle cx="86" cy="86" r="3.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
                      <circle cx="140" cy="46" r="3.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
                    </g>

                  {:else if card.id === 'path'}
                    <!-- 8. Path: sharp turns / garis bersudut tajam -->
                    <g class="sketch-path">
                      <path
                        d="M 24 78 L 56 30 L 92 70 L 124 24 L 156 54"
                        fill="none"
                        stroke="#FFFFFF"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <!-- Titik sudut belokan -->
                      <circle cx="24" cy="78" r="2.5" fill="#38BDF8" />
                      <circle cx="56" cy="30" r="2.5" fill="#38BDF8" />
                      <circle cx="92" cy="70" r="2.5" fill="#38BDF8" />
                      <circle cx="124" cy="24" r="2.5" fill="#38BDF8" />
                      <circle cx="156" cy="54" r="2.5" fill="#38BDF8" />
                    </g>

                  {:else if card.id === 'arrow'}
                    <!-- 9. Arrow: a shaft with a hook / garis berujung panah -->
                    <g class="sketch-arrow">
                      <line x1="28" y1="78" x2="148" y2="32" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
                      <circle cx="28" cy="78" r="3.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
                      <!-- Kait Panah di Ujung -->
                      <path
                        d="M 126 26 L 150 31 L 142 52"
                        fill="none"
                        stroke="#FFFFFF"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </g>

                  {:else if card.id === 'scribble'}
                    <!-- 10. Scribble: zig-zag over it: gone / coret zigzag untuk menghapus -->
                    <g class="sketch-scribble">
                      <!-- Garis gambar yang dicoret (pudar putus-putus) -->
                      <line x1="24" y1="62" x2="156" y2="44" stroke="#FF69B4" stroke-width="2" stroke-dasharray="4,4" opacity="0.45" />
                      <!-- Coretan zigzag cepat bolak-balik -->
                      <path
                        d="M 40 32 L 56 78 L 74 28 L 92 82 L 110 30 L 128 78 L 144 34"
                        fill="none"
                        stroke="#FFFFFF"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <!-- Tanda GONE / Silang Merah -->
                      <circle cx="152" cy="44" r="9" fill="rgba(239, 68, 68, 0.2)" stroke="#EF4444" stroke-width="1" />
                      <path d="M 148 40 L 156 48 M 156 40 L 148 48" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" />
                    </g>

                  {:else if card.id === 'tab'}
                    <!-- 11. Tab: the other reading / ganti kandidat bentuk -->
                    <g class="sketch-tab">
                      <!-- Bentuk alternatif di latar belakang (Trend vs Ray vs Horizontal) -->
                      <line x1="30" y1="74" x2="150" y2="34" stroke="rgba(255,255,255,0.25)" stroke-dasharray="3,3" />
                      <line x1="30" y1="54" x2="150" y2="54" stroke="rgba(255,255,255,0.18)" stroke-dasharray="3,3" />

                      <!-- Panah Melingkar Dua Arah (Cycle) -->
                      <path
                        d="M 52 38 A 38 38 0 0 1 128 38"
                        fill="none"
                        stroke="#38BDF8"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                      <path d="M 124 30 L 132 38 L 122 44" fill="none" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      <path
                        d="M 128 72 A 38 38 0 0 1 52 72"
                        fill="none"
                        stroke="#38BDF8"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                      <path d="M 56 80 L 48 72 L 58 66" fill="none" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

                      <!-- Badge Tombol Tab di Tengah -->
                      <rect x="62" y="42" width="56" height="26" rx="4" fill="#171717" stroke="#38BDF8" stroke-width="1.5" />
                      <text x="90" y="59" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="11" font-weight="700">Tab ⇥</text>
                    </g>

                  {:else if card.id === 'quickdrag'}
                    <!-- 12. Quick drag: still pans / geser kanvas biasa -->
                    <g class="sketch-quickdrag">
                      <!-- Lilin-lilin bergerak -->
                      <line x1="45" y1="35" x2="45" y2="75" stroke="rgba(255,255,255,0.2)" />
                      <rect x="41" y="45" width="8" height="18" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />
                      <line x1="90" y1="28" x2="90" y2="82" stroke="rgba(255,255,255,0.2)" />
                      <rect x="86" y="38" width="8" height="24" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />
                      <line x1="135" y1="40" x2="135" y2="70" stroke="rgba(255,255,255,0.2)" />
                      <rect x="131" y="48" width="8" height="14" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />

                      <!-- Panah Horizontal Geser Kanvas (Pan Left / Right) -->
                      <line x1="35" y1="92" x2="145" y2="92" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
                      <path d="M 45 86 L 35 92 L 45 98" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M 135 86 L 145 92 L 135 98" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

                      <!-- Ikon Tangan / Grab -->
                      <circle cx="90" cy="55" r="16" fill="rgba(0,0,0,0.6)" stroke="#38BDF8" stroke-width="1.5" />
                      <path d="M 85 55 L 95 55 M 90 50 L 90 60" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" />
                    </g>

                  {:else if card.id === 'esc'}
                    <!-- 13. Esc: removes it / batalkan goresan -->
                    <g class="sketch-esc">
                      <!-- Goresan yang dibatalkan / lenyap -->
                      <path
                        d="M 32 72 Q 90 18 148 72"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        stroke-width="2"
                        stroke-dasharray="3,3"
                      />
                      <!-- Tanda Silang Batal -->
                      <circle cx="90" cy="52" r="18" fill="rgba(239, 68, 68, 0.15)" stroke="#EF4444" stroke-width="1.5" />
                      <path d="M 83 45 L 97 59 M 97 45 L 83 59" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" />
                      <!-- Badge Tombol Esc -->
                      <rect x="68" y="76" width="44" height="22" rx="3" fill="#171717" stroke="#525252" stroke-width="1" />
                      <text x="90" y="91" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="10" font-weight="700">Esc</text>
                    </g>
                  {/if}
                </svg>
              </div>

              <!-- Info Teks Kartu -->
              <div class="card-info">
                <div class="card-title-row">
                  <span class="card-title">{card.title}</span>
                  {#if card.badge}
                    <kbd class="card-badge mono-nums">{card.badge}</kbd>
                  {/if}
                </div>
                <div class="card-subtitle">{card.subtitle}</div>
                <div class="card-desc-id">{card.descId}</div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Footer Modal -->
      <div class="modal-footer">
        <div class="footer-tip">
          <Sparkles size={14} class="tip-icon text-cyan" />
          <span>Goresan gestur otomatis tersimpan ke riwayat <kbd class="inline-kbd">Ctrl+Z</kbd> dan <kbd class="inline-kbd">Ctrl+Y</kbd>.</span>
        </div>
        <button
          type="button"
          class="btn-got-it"
          onclick={onClose}
          aria-label="Tutup modal dan kembali ke grafik"
        >
          <Check size={14} />
          <span>Mengerti (Got it)</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(6, 8, 12, 0.82);
    backdrop-filter: blur(8px);
    z-index: 1050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn 0.15s ease-out;
  }

  .modal-container {
    width: 100%;
    max-width: 980px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-surface, #0f121a);
    border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85), 0 0 24px rgba(56, 189, 248, 0.1);
    overflow: hidden;
    animation: scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 18px 22px;
    border-bottom: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    background-color: rgba(255, 255, 255, 0.02);
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    max-width: 820px;
  }

  .header-icon-box {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background-color: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .modal-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-main, #f3f4f6);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .version-pill {
    font-size: 9.5px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
    background-color: rgba(56, 189, 248, 0.12);
    color: var(--brand-cyan, #38bdf8);
    border: 1px solid rgba(56, 189, 248, 0.25);
    text-transform: uppercase;
  }

  .modal-subtitle {
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--text-muted, #9ca3af);
    margin: 6px 0 0 0;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: var(--text-dim, #737373);
    padding: 6px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .btn-close:hover {
    color: var(--text-main, #ffffff);
    background-color: rgba(255, 255, 255, 0.08);
  }

  /* Area Scroll & Grid Kartu */
  .cards-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 20px 22px;
  }

  .gesture-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
  }

  /* Desain Kartu Bergaya OpenMarket */
  .gesture-card {
    display: flex;
    flex-direction: column;
    background-color: var(--bg-panel, #171717);
    border: 1px solid var(--border-hairline, #222222);
    border-radius: 6px;
    overflow: hidden;
    transition: all 0.18s ease;
  }

  .gesture-card:hover {
    border-color: rgba(56, 189, 248, 0.4);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
    transform: translateY(-1px);
  }

  .card-sketch-box {
    width: 100%;
    aspect-ratio: 16 / 10;
    background-color: #0b0d12;
    border-bottom: 1px solid var(--border-hairline, #202020);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    position: relative;
  }

  .sketch-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .card-info {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .card-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main, #f3f4f6);
  }

  .card-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background-color: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--text-muted, #a3a3a3);
  }

  .card-subtitle {
    font-size: 10.5px;
    color: var(--brand-cyan, #38bdf8);
    font-style: italic;
  }

  .card-desc-id {
    font-size: 10px;
    color: var(--text-dim, #737373);
    line-height: 1.35;
  }

  /* Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 22px;
    border-top: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    background-color: rgba(0, 0, 0, 0.25);
  }

  .footer-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-dim, #737373);
  }

  .tip-icon {
    flex-shrink: 0;
  }

  .btn-got-it {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--brand-cyan, #38bdf8);
    color: #0b0d12;
    border: none;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-got-it:hover {
    background-color: #7dd3fc;
    box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
  }

  .inline-kbd {
    display: inline-block;
    padding: 1px 5px;
    font-size: 10px;
    font-family: var(--font-code, monospace);
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 3px;
    color: var(--text-main, #ffffff);
    margin: 0 2px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
