<script lang="ts">
  import {
    MousePointer,
    TrendingUp,
    Minus,
    ArrowUpRight,
    Square,
    DollarSign,
    Type,
    Magnet,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Undo2,
    Redo2,
    Trash2,
    Ruler,
    Layers,
    ChevronRight,
    Pin
  } from '@lucide/svelte';
  import type { DrawingToolType, SnapMode } from '../types/market';

  interface Props {
    activeTool: DrawingToolType | null;
    snapMode: SnapMode;
    stayMode: boolean;
    isLocked: boolean;
    isHidden: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    onSelectTool: (tool: DrawingToolType | null) => void;
    onToggleSnap: () => void;
    onToggleStay: () => void;
    onToggleLock: () => void;
    onToggleHide: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onClear: () => void;
  }

  let {
    activeTool,
    snapMode,
    stayMode,
    isLocked,
    isHidden,
    canUndo = true,
    canRedo = true,
    onSelectTool,
    onToggleSnap,
    onToggleStay,
    onToggleLock,
    onToggleHide,
    onUndo,
    onRedo,
    onClear,
  }: Props = $props();

  // Flyout submenu states
  let openFlyout = $state<string | null>(null);

  const lineTools = [
    { id: 'trendline' as DrawingToolType, label: 'Trend Line', icon: TrendingUp },
    { id: 'hline' as DrawingToolType, label: 'Horizontal Line', icon: Minus },
    { id: 'hray' as DrawingToolType, label: 'Horizontal Ray', icon: ArrowUpRight },
    { id: 'ray' as DrawingToolType, label: 'Ray', icon: ArrowUpRight },
    { id: 'arrow' as DrawingToolType, label: 'Arrow', icon: ArrowUpRight },
  ];

  const geomTools = [
    { id: 'fibretracement' as DrawingToolType, label: 'Fib Retracement', icon: Layers },
    { id: 'box' as DrawingToolType, label: 'Rectangle (Order Block)', icon: Square },
  ];

  const posTools = [
    { id: 'position' as DrawingToolType, label: 'Position (Risk/Reward)', icon: DollarSign },
    { id: 'measure' as DrawingToolType, label: 'Measure Ruler', icon: Ruler },
  ];

  function toggleFlyout(name: string) {
    openFlyout = openFlyout === name ? null : name;
  }

  function handleSelect(tool: DrawingToolType | null) {
    onSelectTool(tool);
    openFlyout = null;
  }
</script>

<aside class="drawing-toolbar glass-panel">
  <!-- 1. Cursor / Selection Tool -->
  <div class="tool-item">
    <button
      class="tool-btn {activeTool === 'cursor' || activeTool === null ? 'active' : ''}"
      title="Cursor (Select & Pan)"
      onclick={() => handleSelect('cursor')}
    >
      <MousePointer size={16} />
    </button>
  </div>

  <div class="tool-divider"></div>

  <!-- 2. Lines Group -->
  <div class="tool-item">
    <button
      class="tool-btn {lineTools.some((t) => t.id === activeTool) ? 'active' : ''}"
      title="Line Tools (Trendline, Horizontal)"
      onclick={() => toggleFlyout('lines')}
    >
      <TrendingUp size={16} />
      <span class="sub-arrow">▸</span>
    </button>

    {#if openFlyout === 'lines'}
      <div class="flyout-menu glass-panel">
        <div class="flyout-header">Lines & Rays</div>
        {#each lineTools as t}
          {@const Icon = t.icon}
          <button
            class="flyout-item {activeTool === t.id ? 'active' : ''}"
            onclick={() => handleSelect(t.id)}
          >
            <span class="flyout-icon"><Icon size={14} /></span>
            <span class="flyout-label">{t.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 3. Geometric & Fibonacci Group -->
  <div class="tool-item">
    <button
      class="tool-btn {geomTools.some((t) => t.id === activeTool) ? 'active' : ''}"
      title="Fibonacci & Shapes (Rectangle / FVG)"
      onclick={() => toggleFlyout('shapes')}
    >
      <Square size={16} />
      <span class="sub-arrow">▸</span>
    </button>

    {#if openFlyout === 'shapes'}
      <div class="flyout-menu glass-panel">
        <div class="flyout-header">Patterns & Shapes</div>
        {#each geomTools as t}
          {@const Icon = t.icon}
          <button
            class="flyout-item {activeTool === t.id ? 'active' : ''}"
            onclick={() => handleSelect(t.id)}
          >
            <span class="flyout-icon"><Icon size={14} /></span>
            <span class="flyout-label">{t.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 4. Position & Risk/Reward Group -->
  <div class="tool-item">
    <button
      class="tool-btn {posTools.some((t) => t.id === activeTool) ? 'active' : ''}"
      title="Position Tools (Risk/Reward, Ruler)"
      onclick={() => toggleFlyout('pos')}
    >
      <DollarSign size={16} />
      <span class="sub-arrow">▸</span>
    </button>

    {#if openFlyout === 'pos'}
      <div class="flyout-menu glass-panel">
        <div class="flyout-header">Risk & Measure</div>
        {#each posTools as t}
          {@const Icon = t.icon}
          <button
            class="flyout-item {activeTool === t.id ? 'active' : ''}"
            onclick={() => handleSelect(t.id)}
          >
            <span class="flyout-icon"><Icon size={14} /></span>
            <span class="flyout-label">{t.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 5. Text Annotation Tool -->
  <div class="tool-item">
    <button
      class="tool-btn {activeTool === 'text' ? 'active' : ''}"
      title="Text Note / Annotation"
      onclick={() => handleSelect('text')}
    >
      <Type size={16} />
    </button>
  </div>

  <div class="tool-divider"></div>

  <!-- 6. Magnet Snap Toggle -->
  <div class="tool-item">
    <button
      class="tool-btn snap-btn {snapMode !== 'off' ? 'active snap-' + snapMode : ''}"
      title="Magnet Snap (Mode: {snapMode.toUpperCase()})"
      onclick={onToggleSnap}
    >
      <Magnet size={16} />
      {#if snapMode !== 'off'}
        <span class="snap-badge">{snapMode === 'weak' ? 'W' : 'S'}</span>
      {/if}
    </button>
  </div>

  <!-- 7. Stay in Drawing Mode Toggle -->
  <div class="tool-item">
    <button
      class="tool-btn {stayMode ? 'active glow-cyan' : ''}"
      title="Stay in Drawing Mode ({stayMode ? 'ON' : 'OFF'})"
      onclick={onToggleStay}
    >
      <Pin size={15} />
    </button>
  </div>

  <!-- 8. Lock / Unlock All -->
  <div class="tool-item">
    <button
      class="tool-btn {isLocked ? 'active glow-warn' : ''}"
      title="{isLocked ? 'Unlock All Drawings' : 'Lock All Drawings'}"
      onclick={onToggleLock}
    >
      {#if isLocked}
        <Lock size={15} class="text-warn" />
      {:else}
        <Unlock size={15} />
      {/if}
    </button>
  </div>

  <!-- 9. Hide / Show All -->
  <div class="tool-item">
    <button
      class="tool-btn {isHidden ? 'active text-dim' : ''}"
      title="{isHidden ? 'Show All Drawings' : 'Hide All Drawings'}"
      onclick={onToggleHide}
    >
      {#if isHidden}
        <EyeOff size={15} />
      {:else}
        <Eye size={15} />
      {/if}
    </button>
  </div>

  <div class="tool-divider"></div>

  <!-- 10. Undo / Redo Actions -->
  <div class="tool-item">
    <button
      class="tool-btn action-btn"
      title="Undo Drawing (Ctrl+Z)"
      onclick={onUndo}
    >
      <Undo2 size={15} />
    </button>
  </div>

  <div class="tool-item">
    <button
      class="tool-btn action-btn"
      title="Redo Drawing (Ctrl+Y)"
      onclick={onRedo}
    >
      <Redo2 size={15} />
    </button>
  </div>

  <!-- 11. Clear / Trash All -->
  <div class="tool-item">
    <button
      class="tool-btn delete-btn"
      title="Clear All Drawings on Canvas"
      onclick={onClear}
    >
      <Trash2 size={15} />
    </button>
  </div>
</aside>

<style>
  .drawing-toolbar {
    position: absolute;
    left: 8px;
    top: 38px;
    z-index: 35;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 4px;
    border-radius: var(--radius-md);
    gap: 4px;
    width: 38px;
    border: 1px solid var(--border-subtle);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }

  .tool-item {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .tool-btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .tool-btn:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .tool-btn.active {
    background: rgba(0, 242, 254, 0.15);
    color: var(--brand-cyan);
    border-color: rgba(0, 242, 254, 0.4);
    box-shadow: 0 0 10px rgba(0, 242, 254, 0.25);
  }

  .tool-btn.snap-weak {
    color: var(--bull-color);
    border-color: rgba(14, 203, 129, 0.4);
    background: rgba(14, 203, 129, 0.12);
  }

  .tool-btn.snap-strong {
    color: var(--brand-purple);
    border-color: rgba(139, 92, 246, 0.4);
    background: rgba(139, 92, 246, 0.15);
  }

  .snap-badge {
    position: absolute;
    bottom: 2px;
    right: 2px;
    font-size: 8px;
    font-weight: 700;
    line-height: 1;
  }

  .sub-arrow {
    position: absolute;
    right: 1px;
    bottom: -1px;
    font-size: 8px;
    opacity: 0.6;
    line-height: 1;
  }

  .tool-divider {
    width: 20px;
    height: 1px;
    background: var(--border-subtle);
    margin: 3px 0;
  }

  .action-btn:hover {
    color: var(--brand-cyan);
  }

  .delete-btn:hover {
    color: var(--bear-color);
    background: rgba(246, 70, 93, 0.15);
  }

  .text-warn {
    color: #f59e0b;
  }

  .glow-warn {
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(245, 158, 11, 0.12);
  }

  .glow-cyan {
    border-color: rgba(0, 242, 254, 0.4);
    background: rgba(0, 242, 254, 0.12);
  }

  /* Flyout Menu Styling */
  .flyout-menu {
    position: absolute;
    left: 42px;
    top: 0;
    min-width: 190px;
    padding: 6px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-medium);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    gap: 3px;
    z-index: 60;
    animation: fadeIn 0.15s ease-out;
  }

  .flyout-header {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 4px 8px;
    letter-spacing: 0.5px;
  }

  .flyout-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .flyout-item:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .flyout-item.active {
    background: rgba(0, 242, 254, 0.15);
    color: var(--brand-cyan);
    font-weight: 600;
  }

  .flyout-icon {
    display: flex;
    align-items: center;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
