<script lang="ts">
  /**
   * Primitif kontrol Modern Toggle Switch untuk status biner Neo-Quant (ADR-0029).
   * Menggantikan tombol kotak teks Aktif/Nonaktif agar selaras dengan kontrol desktop modern.
   */
  interface Props {
    checked: boolean;
    disabled?: boolean;
    label?: string;
    ariaLabel?: string;
    title?: string;
    onchange?: (checked: boolean) => void;
  }

  let {
    checked = false,
    disabled = false,
    label,
    ariaLabel = 'Toggle pengaturan',
    title = '',
    onchange
  }: Props = $props();

  const effectiveLabel = $derived(label ?? ariaLabel);

  function handleClick() {
    if (disabled) return;
    onchange?.(!checked);
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={effectiveLabel}
  {title}
  {disabled}
  class="nq-switch"
  class:on={checked}
  onclick={handleClick}
>
  <span class="nq-switch-thumb" aria-hidden="true"></span>
</button>

<style>
  .nq-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 36px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background-color: var(--bg-hover, #262626);
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.16s ease, opacity 0.16s ease;
  }

  .nq-switch:hover:not(:disabled) {
    background-color: var(--bg-active, #2E2E2E);
  }

  .nq-switch.on {
    background-color: var(--brand-primary, #FF69B4);
  }

  .nq-switch.on:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .nq-switch:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .nq-switch:focus-visible {
    outline: 2px solid var(--border-focus, #FF69B4);
    outline-offset: 2px;
  }

  .nq-switch-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background-color: #FFFFFF;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    transition: transform 0.16s ease;
    pointer-events: none;
  }

  .nq-switch.on .nq-switch-thumb {
    transform: translateX(16px);
    background-color: #FFFFFF;
  }

  @media (prefers-reduced-motion: reduce) {
    .nq-switch,
    .nq-switch-thumb {
      transition: none;
    }
  }
</style>
