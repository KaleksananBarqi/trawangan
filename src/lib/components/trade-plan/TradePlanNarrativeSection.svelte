<script lang="ts">
  import { ChevronDown, ChevronRight } from '@lucide/svelte';
  import type { PlanFormDraft } from '../../services/tradePlanFormService';

  interface Props {
    draft: PlanFormDraft;
    isOpen: boolean;
    filledCount: number;
    onToggleOpen: () => void;
    onPatchDraft: (patch: Partial<PlanFormDraft>) => void;
    onUpdateTargetReason: (index: number, reason: string) => void;
  }

  let {
    draft,
    isOpen,
    filledCount,
    onToggleOpen,
    onPatchDraft,
    onUpdateTargetReason,
  }: Props = $props();
</script>

<div class="form-card collapsible-card">
  <div class="collapsible-header-row">
    <button
      type="button"
      class="collapsible-toggle"
      onclick={onToggleOpen}
      aria-expanded={isOpen}
    >
      {#if isOpen}
        <ChevronDown size={13} />
      {:else}
        <ChevronRight size={13} />
      {/if}
      <span>Narasi Tesis & Metadata</span>
      {#if filledCount > 0}
        <span class="mini-count mono-nums">{filledCount}</span>
      {/if}
    </button>
  </div>

  {#if isOpen}
    <div class="collapsible-body">
      <div class="form-row-2col">
        <div class="field-group">
          <label class="field-label" for="tp-setup-status">Status Setup</label>
          <input
            id="tp-setup-status"
            type="text"
            class="form-input"
            value={draft.setupStatus}
            placeholder="Mis. Menunggu Konfirmasi"
            oninput={(e) => onPatchDraft({ setupStatus: e.currentTarget.value })}
          />
        </div>
        <div class="field-group">
          <span class="field-label">Konfluensi (Skor / Max)</span>
          <div class="confluence-inputs">
            <input
              type="text"
              inputmode="numeric"
              class="form-input mono-nums"
              value={draft.confluenceScore}
              placeholder="4"
              aria-label="Skor Konfluensi"
              oninput={(e) => onPatchDraft({ confluenceScore: e.currentTarget.value })}
            />
            <span class="conf-slash">/</span>
            <input
              type="text"
              inputmode="numeric"
              class="form-input mono-nums"
              value={draft.confluenceMax}
              placeholder="5"
              aria-label="Skor Maksimal Konfluensi"
              oninput={(e) => onPatchDraft({ confluenceMax: e.currentTarget.value })}
            />
          </div>
        </div>
      </div>

      <div class="form-row-2col">
        <div class="field-group">
          <label class="field-label" for="tp-probability">Probabilitas</label>
          <input
            id="tp-probability"
            type="text"
            class="form-input"
            value={draft.probability}
            placeholder="Mis. Tinggi (75%)"
            oninput={(e) => onPatchDraft({ probability: e.currentTarget.value })}
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="tp-prob-notes">Catatan Probabilitas</label>
          <input
            id="tp-prob-notes"
            type="text"
            class="form-input"
            value={draft.probabilityNotes}
            placeholder="Ringkasan keyakinan..."
            oninput={(e) => onPatchDraft({ probabilityNotes: e.currentTarget.value })}
          />
        </div>
      </div>

      <div class="field-group">
        <label class="field-label" for="tp-definition">Definisi Setup</label>
        <textarea
          id="tp-definition"
          rows="2"
          class="form-textarea"
          value={draft.definition}
          placeholder="Ringkasan definisi setup & konteks struktur..."
          oninput={(e) => onPatchDraft({ definition: e.currentTarget.value })}
        ></textarea>
      </div>

      <div class="field-group">
        <label class="field-label" for="tp-invalidation">Skenario Invalidasi</label>
        <textarea
          id="tp-invalidation"
          rows="2"
          class="form-textarea"
          value={draft.invalidationScenario}
          placeholder="Kondisi yang membatalkan setup..."
          oninput={(e) => onPatchDraft({ invalidationScenario: e.currentTarget.value })}
        ></textarea>
      </div>

      <div class="field-group">
        <label class="field-label" for="tp-entry-reason">Alasan Entry</label>
        <textarea
          id="tp-entry-reason"
          rows="2"
          class="form-textarea"
          value={draft.entryReason}
          placeholder="Katalis FVG/OB/Sweep untuk entry..."
          oninput={(e) => onPatchDraft({ entryReason: e.currentTarget.value })}
        ></textarea>
      </div>

      <div class="field-group">
        <label class="field-label" for="tp-sl-reason">Alasan Stop Loss</label>
        <input
          id="tp-sl-reason"
          type="text"
          class="form-input"
          value={draft.stopLossReason}
          placeholder="Dasar penempatan SL..."
          oninput={(e) => onPatchDraft({ stopLossReason: e.currentTarget.value })}
        />
      </div>

      {#each draft.targets as tgt, tIdx (tgt.id + '_reason_' + tIdx)}
        <div class="field-group">
          <label class="field-label" for="tp-reason-{tIdx}">
            Alasan {tgt.label || `TP${tIdx + 1}`}
          </label>
          <input
            id="tp-reason-{tIdx}"
            type="text"
            class="form-input"
            value={tgt.reason}
            placeholder="Target likuiditas / struktur untuk {tgt.label || `TP${tIdx + 1}`}..."
            oninput={(e) => onUpdateTargetReason(tIdx, e.currentTarget.value)}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .form-card {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-lg);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .collapsible-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .collapsible-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 0;
    cursor: pointer;
    flex: 1;
    text-align: left;
  }

  .collapsible-toggle:hover {
    color: var(--text-main);
  }

  .collapsible-toggle:focus-visible,
  .form-input:focus-visible,
  .form-textarea:focus-visible {
    outline: 1.5px solid var(--border-focus);
    outline-offset: 1px;
  }

  .mini-count {
    font-size: var(--font-size-xs);
    padding: 0 5px;
    border-radius: var(--radius-sm);
    background-color: color-mix(in srgb, var(--brand-cyan) 14%, transparent);
    color: var(--brand-cyan);
  }

  .collapsible-body {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding-top: 4px;
    border-top: 1px solid var(--border-hairline);
  }

  .form-row-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .field-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    box-sizing: border-box;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-md);
    color: var(--text-main);
    font-size: var(--font-size-base);
    padding: 5px 7px;
    transition: border-color 0.12s ease;
  }

  .form-input:focus,
  .form-textarea:focus {
    border-color: var(--border-focus);
  }

  .form-textarea {
    resize: vertical;
    font-family: inherit;
    line-height: 1.4;
  }

  .confluence-inputs {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .conf-slash {
    color: var(--text-dim);
    font-size: var(--font-size-base);
  }
</style>
