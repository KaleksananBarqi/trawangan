<script lang="ts">
  import {
    Sliders,
    X,
    RotateCcw,
    Check,
    Palette,
    HelpCircle,
    Plus,
    Minus,
  } from '@lucide/svelte';
  import { getNativeIndicator } from '@luxalgo/vela';

  export interface InputSchemaItem {
    key: string;
    title: string;
    type: 'int' | 'float' | 'bool' | 'string' | 'source' | 'color' | string;
    defval: any;
    min?: number;
    max?: number;
    step?: number;
    options?: readonly string[];
    group?: string;
    inline?: string;
    tooltip?: string;
  }

  interface Props {
    isOpen: boolean;
    indicatorId?: string;
    indicatorTitle?: string;
    nativeType?: string;
    schema?: InputSchemaItem[];
    inputs?: Record<string, any>;
    handle?: any;
    onClose: () => void;
    onApply?: (newInputs: Record<string, any>) => void;
    onRevert?: (previousInputs: Record<string, any>) => void;
    onChange?: (currentInputs: Record<string, any>) => void;
  }

  let {
    isOpen = false,
    indicatorId = '',
    indicatorTitle = '',
    nativeType = '',
    schema = [],
    inputs = {},
    handle = null,
    onClose,
    onApply,
    onRevert,
    onChange,
  }: Props = $props();

  // Snapshot nilai awal saat modal pertama kali dibuka untuk kemampuan revert/batal
  let initialSnapshot = $state<Record<string, any>>({});
  // Nilai input live yang sedang diedit pengguna
  let draftInputs = $state<Record<string, any>>({});
  // Tab aktif (Settings vs Style)
  let activeTab = $state<'settings' | 'style'>('settings');

  // Skema input yang diselesaikan
  const resolvedSchema = $derived.by<InputSchemaItem[]>(() => {
    if (schema && schema.length > 0) return schema;
    if (handle?.inputs && Array.isArray(handle.inputs) && handle.inputs.length > 0) {
      return handle.inputs;
    }
    if (handle?.descriptor?.inputs && Array.isArray(handle.descriptor.inputs)) {
      return handle.descriptor.inputs;
    }
    const type = nativeType || indicatorId?.replace(/^native:/, '');
    if (type) {
      try {
        const desc = getNativeIndicator(type);
        if (desc && typeof desc.inputsSchema === 'function') {
          return desc.inputsSchema();
        }
      } catch (_) {}
    }
    return [];
  });

  // Nilai bawaan (default inputs) dari skema atau descriptor
  const defaultValues = $derived.by<Record<string, any>>(() => {
    const res: Record<string, any> = {};
    const type = nativeType || indicatorId?.replace(/^native:/, '');
    if (type) {
      try {
        const desc = getNativeIndicator(type);
        if (desc && typeof desc.defaultInputs === 'function') {
          Object.assign(res, desc.defaultInputs());
        }
      } catch (_) {}
    }
    for (const item of resolvedSchema) {
      if (res[item.key] === undefined && item.defval !== undefined) {
        res[item.key] = item.defval;
      }
    }
    return res;
  });

  // Pemisahan tab: Pengaturan Input vs Gaya (Style)
  const settingsInputs = $derived(
    resolvedSchema.filter(
      (s: InputSchemaItem) => s.type !== 'color' && (s.group?.toLowerCase() !== 'style')
    )
  );

  const styleInputs = $derived(
    resolvedSchema.filter(
      (s: InputSchemaItem) => s.type === 'color' || (s.group?.toLowerCase() === 'style')
    )
  );

  const hasStyleTab = $derived(styleInputs.length > 0);

  // Inisialisasi snapshot saat modal dibuka
  $effect(() => {
    if (isOpen) {
      const liveVals = handle && typeof handle.inputValues === 'function' ? handle.inputValues() : {};
      const merged = { ...defaultValues, ...(inputs || {}), ...(liveVals || {}) };
      initialSnapshot = { ...merged };
      draftInputs = { ...merged };
      activeTab = 'settings';
    }
  });

  // Panggil pembaruan reaktif ke handle dan callback setiap kali ada input berubah
  function dispatchLiveUpdate(newDraft: Record<string, any>) {
    draftInputs = newDraft;

    // Panggil method update pada handle jika ada (reaktif ke canvas WebGL2)
    if (handle) {
      if (typeof handle.update === 'function') {
        try {
          handle.update(newDraft);
        } catch (_) {}
      } else if (typeof handle.setInputs === 'function') {
        try {
          handle.setInputs(newDraft);
        } catch (_) {}
      }
    }

    if (onChange) {
      try {
        onChange(newDraft);
      } catch (_) {}
    }
  }

  function handleFieldChange(key: string, value: any) {
    const updated = { ...draftInputs, [key]: value };
    dispatchLiveUpdate(updated);
  }

  function handleNumberStep(key: string, delta: number, min?: number, max?: number) {
    const cur = typeof draftInputs[key] === 'number' ? draftInputs[key] : (defaultValues[key] ?? 0);
    let next = cur + delta;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    handleFieldChange(key, next);
  }

  // Tombol Reset ke Default
  function handleReset() {
    const defs = { ...defaultValues };
    dispatchLiveUpdate(defs);
  }

  // Tombol Batal: Kembalikan ke snapshot awal sebelum modal dibuka
  function handleCancel() {
    dispatchLiveUpdate(initialSnapshot);
    if (onRevert) {
      try {
        onRevert(initialSnapshot);
      } catch (_) {}
    }
    onClose();
  }

  // Tombol Terapkan / Simpan
  function handleApply() {
    if (onApply) {
      try {
        onApply(draftInputs);
      } catch (_) {}
    }
    onClose();
  }

  // Handle tombol Escape
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleCancel();
    }
  }

  const standardSources = ['Close', 'Open', 'High', 'Low', 'HL2', 'HLC3', 'OHLC4', 'HLCC4'];
</script>

<svelte:window onkeydown={isOpen ? handleKeyDown : undefined} />

{#if isOpen}
  <!-- Backdrop Modal -->
  <div
    class="settings-modal-backdrop"
    onclick={handleCancel}
    role="presentation"
  >
    <!-- Card Dialog Modal -->
    <div
      class="settings-modal-card"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-indicator-title"
    >
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title-box">
          <span class="header-icon"><Sliders size={16} /></span>
          <div>
            <h3 id="modal-indicator-title" class="title-text">
              {indicatorTitle || nativeType || 'Pengaturan Indikator'}
            </h3>
            <span class="subtitle-text">Konfigurasi parameter matematis & visual</span>
          </div>
        </div>

        <button
          type="button"
          class="close-button"
          onclick={handleCancel}
          title="Tutup dialog (Batal)"
          aria-label="Tutup"
        >
          <X size={15} />
        </button>
      </div>

      <!-- Tab Bar (jika ada pembagian Settings & Style) -->
      {#if hasStyleTab}
        <div class="tab-bar">
          <button
            type="button"
            class="tab-button {activeTab === 'settings' ? 'active' : ''}"
            onclick={() => (activeTab = 'settings')}
          >
            <Sliders size={13} />
            <span>Parameter</span>
            <span class="tab-count">{settingsInputs.length}</span>
          </button>

          <button
            type="button"
            class="tab-button {activeTab === 'style' ? 'active' : ''}"
            onclick={() => (activeTab = 'style')}
          >
            <Palette size={13} />
            <span>Gaya Tampilan</span>
            <span class="tab-count">{styleInputs.length}</span>
          </button>
        </div>
      {/if}

      <!-- Form Body -->
      <div class="modal-body">
        {#if activeTab === 'settings'}
          <div class="inputs-grid">
            {#each settingsInputs as item (item.key)}
              {@const val = draftInputs[item.key] !== undefined ? draftInputs[item.key] : item.defval}
              <div class="input-row">
                <div class="label-box">
                  <label for="input-{item.key}" class="field-label">{item.title || item.key}</label>
                  {#if item.tooltip}
                    <span class="info-tooltip" title={item.tooltip}>
                      <HelpCircle size={11} />
                    </span>
                  {/if}
                </div>

                <div class="control-box">
                  <!-- 1. Tipe INTEGER -->
                  {#if item.type === 'int'}
                    <div class="stepper-box">
                      <button
                        type="button"
                        class="stepper-btn"
                        onclick={() => handleNumberStep(item.key, -(item.step || 1), item.min, item.max)}
                        disabled={item.min !== undefined && val <= item.min}
                        title="Kurangi"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        id="input-{item.key}"
                        type="number"
                        class="number-input"
                        step={item.step || 1}
                        min={item.min}
                        max={item.max}
                        value={val}
                        oninput={(e) => handleFieldChange(item.key, parseInt((e.target as HTMLInputElement).value, 10) || 0)}
                      />
                      <button
                        type="button"
                        class="stepper-btn"
                        onclick={() => handleNumberStep(item.key, item.step || 1, item.min, item.max)}
                        disabled={item.max !== undefined && val >= item.max}
                        title="Tambah"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                  <!-- 2. Tipe FLOAT -->
                  {:else if item.type === 'float'}
                    <div class="stepper-box">
                      <button
                        type="button"
                        class="stepper-btn"
                        onclick={() => handleNumberStep(item.key, -(item.step || 0.1), item.min, item.max)}
                        disabled={item.min !== undefined && val <= item.min}
                        title="Kurangi"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        id="input-{item.key}"
                        type="number"
                        class="number-input"
                        step={item.step || 0.01}
                        min={item.min}
                        max={item.max}
                        value={val}
                        oninput={(e) => handleFieldChange(item.key, parseFloat((e.target as HTMLInputElement).value) || 0)}
                      />
                      <button
                        type="button"
                        class="stepper-btn"
                        onclick={() => handleNumberStep(item.key, item.step || 0.1, item.min, item.max)}
                        disabled={item.max !== undefined && val >= item.max}
                        title="Tambah"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                  <!-- 3. Tipe SOURCE DROPDOWN -->
                  {:else if item.type === 'source' || (item.type === 'string' && (item.options || item.key.toLowerCase().includes('source')))}
                    {@const opts = item.options && item.options.length > 0 ? item.options : standardSources}
                    <select
                      id="input-{item.key}"
                      class="select-input"
                      value={String(val)}
                      onchange={(e) => handleFieldChange(item.key, (e.target as HTMLSelectElement).value)}
                    >
                      {#each opts as opt}
                        <option value={opt}>{opt}</option>
                      {/each}
                    </select>

                  <!-- 4. Tipe BOOLEAN TOGGLE -->
                  {:else if item.type === 'bool'}
                    <label class="toggle-switch">
                      <input
                        id="input-{item.key}"
                        type="checkbox"
                        checked={Boolean(val)}
                        onchange={(e) => handleFieldChange(item.key, (e.target as HTMLInputElement).checked)}
                      />
                      <span class="toggle-slider"></span>
                      <span class="toggle-text">{val ? 'Aktif' : 'Nonaktif'}</span>
                    </label>

                  <!-- Fallback: String / Plain input -->
                  {:else}
                    <input
                      id="input-{item.key}"
                      type="text"
                      class="text-input"
                      value={val ?? ''}
                      oninput={(e) => handleFieldChange(item.key, (e.target as HTMLInputElement).value)}
                    />
                  {/if}
                </div>
              </div>
            {/each}

            {#if settingsInputs.length === 0}
              <div class="empty-state">
                <span>Tidak ada parameter numerik yang dapat dikonfigurasi.</span>
              </div>
            {/if}
          </div>

        <!-- TAB STYLE (Colors & Visuals) -->
        {:else if activeTab === 'style'}
          <div class="inputs-grid">
            {#each styleInputs as item (item.key)}
              {@const val = draftInputs[item.key] !== undefined ? draftInputs[item.key] : item.defval}
              <div class="input-row">
                <div class="label-box">
                  <label for="input-color-{item.key}" class="field-label">{item.title || item.key}</label>
                  {#if item.tooltip}
                    <span class="info-tooltip" title={item.tooltip}>
                      <HelpCircle size={11} />
                    </span>
                  {/if}
                </div>

                <div class="control-box color-control-box">
                  <div class="color-picker-wrapper">
                    <input
                      id="input-color-{item.key}"
                      type="color"
                      class="color-native-input"
                      value={typeof val === 'string' && val.startsWith('#') ? val.slice(0, 7) : '#5b9cf6'}
                      oninput={(e) => handleFieldChange(item.key, (e.target as HTMLInputElement).value)}
                    />
                    <span
                      class="color-swatch"
                      style="background-color: {val};"
                    ></span>
                  </div>
                  <input
                    type="text"
                    class="color-hex-input mono-nums"
                    value={val ?? ''}
                    oninput={(e) => handleFieldChange(item.key, (e.target as HTMLInputElement).value)}
                  />
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer Buttons -->
      <div class="modal-footer">
        <button
          type="button"
          class="footer-btn btn-reset"
          onclick={handleReset}
          title="Reset ke nilai bawaan"
        >
          <RotateCcw size={12} />
          <span>Default</span>
        </button>

        <div class="footer-action-group">
          <button
            type="button"
            class="footer-btn btn-cancel"
            onclick={handleCancel}
          >
            Batal
          </button>

          <button
            type="button"
            class="footer-btn btn-apply"
            onclick={handleApply}
          >
            <Check size={13} />
            <span>Terapkan</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .settings-modal-card {
    width: 440px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    background: #181a20;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
    overflow: hidden;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #1c1f26;
  }

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(91, 156, 246, 0.15);
    color: #5b9cf6;
  }

  .title-text {
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
    color: #f3f4f6;
    letter-spacing: -0.01em;
  }

  .subtitle-text {
    display: block;
    font-size: 11px;
    color: #9ca3af;
    margin-top: 1px;
  }

  .close-button {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f3f4f6;
  }

  /* Tab Bar */
  .tab-bar {
    display: flex;
    padding: 0 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #191b22;
    gap: 8px;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #9ca3af;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab-button:hover {
    color: #e5e7eb;
  }

  .tab-button.active {
    color: #5b9cf6;
    border-bottom-color: #5b9cf6;
  }

  .tab-count {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    color: #9ca3af;
  }

  .tab-button.active .tab-count {
    background: rgba(91, 156, 246, 0.2);
    color: #5b9cf6;
  }

  /* Body & Form Grid */
  .modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    max-height: 400px;
  }

  .inputs-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .input-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .label-box {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .field-label {
    font-size: 12px;
    color: #d1d5db;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .info-tooltip {
    color: #6b7280;
    cursor: help;
    display: flex;
    align-items: center;
  }

  .control-box {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  /* Stepper Box (Int / Float) */
  .stepper-box {
    display: inline-flex;
    align-items: center;
    background: #121418;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    overflow: hidden;
  }

  .stepper-btn {
    background: transparent;
    border: none;
    color: #9ca3af;
    padding: 6px 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s;
  }

  .stepper-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #f3f4f6;
  }

  .stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .number-input {
    width: 64px;
    background: transparent;
    border: none;
    color: #f3f4f6;
    font-size: 12px;
    text-align: center;
    padding: 5px 0;
    font-family: inherit;
    outline: none;
    -moz-appearance: textfield;
  }

  .number-input::-webkit-inner-spin-button,
  .number-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Select Input */
  .select-input {
    min-width: 130px;
    background: #121418;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #f3f4f6;
    font-size: 12px;
    padding: 5px 10px;
    outline: none;
    cursor: pointer;
  }

  .select-input:focus {
    border-color: #5b9cf6;
  }

  /* Toggle Switch */
  .toggle-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .toggle-slider {
    position: relative;
    width: 32px;
    height: 18px;
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 18px;
    transition: all 0.2s;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .toggle-switch input:checked + .toggle-slider {
    background-color: #089981;
  }

  .toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(14px);
  }

  .toggle-text {
    font-size: 11px;
    color: #9ca3af;
  }

  /* Color Picker */
  .color-control-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-picker-wrapper {
    position: relative;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
  }

  .color-native-input {
    position: absolute;
    top: -5px;
    left: -5px;
    width: 34px;
    height: 34px;
    opacity: 0;
    cursor: pointer;
  }

  .color-swatch {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 4px;
  }

  .color-hex-input {
    width: 80px;
    background: #121418;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #f3f4f6;
    font-size: 11.5px;
    padding: 4px 8px;
    outline: none;
  }

  .color-hex-input:focus {
    border-color: #5b9cf6;
  }

  .text-input {
    width: 130px;
    background: #121418;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #f3f4f6;
    font-size: 12px;
    padding: 5px 8px;
    outline: none;
  }

  .empty-state {
    padding: 24px 0;
    text-align: center;
    color: #6b7280;
    font-size: 12px;
  }

  /* Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: #1c1f26;
  }

  .footer-action-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .footer-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }

  .btn-reset {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.1);
    color: #9ca3af;
  }

  .btn-reset:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f3f4f6;
  }

  .btn-cancel {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.12);
    color: #d1d5db;
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f3f4f6;
  }

  .btn-apply {
    background: #2563eb;
    border-color: #3b82f6;
    color: #ffffff;
  }

  .btn-apply:hover {
    background: #1d4ed8;
  }

  .mono-nums {
    font-variant-numeric: tabular-nums;
  }
</style>
