<script lang="ts">
  import {
    MousePointer,
    Hand,
    Eraser,
    TrendingUp,
    Minus,
    ArrowUpRight,
    ArrowUp,
    ArrowDown,
    MoveHorizontal,
    MoveVertical,
    Crosshair,
    Ruler,
    Square,
    Circle,
    Triangle,
    Paintbrush,
    Highlighter,
    Layers,
    DollarSign,
    Type,
    MessageSquare,
    StickyNote,
    Tag,
    Milestone,
    Compass,
    Activity,
    ChartBar,
    Calendar,
    Flag,
    Star,
    Search,
    Shapes,
    Magnet,
    Pin,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Undo2,
    Redo2,
    Trash2,
    X,
    Sparkles,
    GitFork,
    GripVertical,
    ChevronLeft,
  } from '@lucide/svelte';
  import type { DrawingToolType, SnapMode } from '../types/market.js';
  import {
    DRAWING_TOOL_GROUPS,
    getToolMeta,
    getLastUsedTool,
    setLastUsedTool,
    getFavoriteTools,
    toggleFavoriteTool,
    isToolFavorite,
    getFavoritesBarPosition,
    saveFavoritesBarPosition,
    clampFavoritesBarPosition,
    STAMP_PRESETS,
    type StampPreset,
    type FavoritesBarPosition,
    type DrawingGroupId,
    type DrawingToolItem,
  } from '../services/drawingToolsService.js';

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
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
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
    isCollapsed = false,
    onToggleCollapse,
  }: Props = $props();

  // State flyout menu
  let openFlyout = $state<DrawingGroupId | 'pointer' | null>(null);
  let lastUsedPointerTool = $state<DrawingToolType>('cursor');
  let searchQuery = $state('');
  let isFavoritesBarVisible = $state(true);

  // State reaktif lokal untuk favorites & last used
  let favoriteToolIds = $state<DrawingToolType[]>(getFavoriteTools());
  let lastUsedPerGroup = $state<Record<DrawingGroupId, DrawingToolType>>({
    lines: getLastUsedTool('lines'),
    channels_pitchforks: getLastUsedTool('channels_pitchforks'),
    fib_gann: getLastUsedTool('fib_gann'),
    waves_harmonics: getLastUsedTool('waves_harmonics'),
    shapes_brushes: getLastUsedTool('shapes_brushes'),
    measure_volume: getLastUsedTool('measure_volume'),
    annotations: getLastUsedTool('annotations'),
  });

  // ─── Floating Favorites Bar Draggable Engine ───
  let favBarEl = $state<HTMLDivElement | null>(null);
  let favBarPos = $state<FavoritesBarPosition>(getFavoritesBarPosition());
  let isDraggingFavBar = $state(false);
  let dragStartPointer = { x: 0, y: 0 };
  let dragStartPos = { x: 0, y: 0 };

  function handleStartDragFavBar(e: PointerEvent) {
    // Hanya tangani tombol utama (klik kiri)
    if (e.button !== 0) return;
    e.preventDefault();
    isDraggingFavBar = true;
    dragStartPointer = { x: e.clientX, y: e.clientY };
    dragStartPos = { ...favBarPos };

    function onPointerMove(moveEvent: PointerEvent) {
      if (!isDraggingFavBar) return;
      const dx = moveEvent.clientX - dragStartPointer.x;
      const dy = moveEvent.clientY - dragStartPointer.y;
      const rawX = dragStartPos.x + dx;
      const rawY = dragStartPos.y + dy;

      const barWidth = favBarEl?.offsetWidth || 220;
      const barHeight = favBarEl?.offsetHeight || 36;
      favBarPos = clampFavoritesBarPosition(
        { x: rawX, y: rawY },
        barWidth,
        barHeight,
        window.innerWidth,
        window.innerHeight
      );
    }

    function onPointerUp() {
      if (isDraggingFavBar) {
        isDraggingFavBar = false;
        saveFavoritesBarPosition(favBarPos);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  // Pemetaan Ikon Dinamis per Tool
  function getIconComponent(toolId: DrawingToolType | null) {
    if (!toolId || toolId === 'cursor') return MousePointer;
    if (toolId === 'handpull') return Hand;
    if (toolId === 'eraser') return Eraser;

    switch (toolId) {
      // Lines
      case 'trendline': return TrendingUp;
      case 'ray':
      case 'hray':
      case 'arrow': return ArrowUpRight;
      case 'hline': return Minus;
      case 'extendedline': return MoveHorizontal;
      case 'vline': return MoveVertical;
      case 'crossline': return Crosshair;
      case 'infoline': return TrendingUp;
      case 'trendangle': return Compass;

      // Channels & Pitchforks
      case 'parallelchannel':
      case 'disjointchannel':
      case 'flattopbottom':
      case 'regressionchannel': return MoveHorizontal;
      case 'pitchfork':
      case 'schiffpitchfork':
      case 'modifiedschiffpitchfork':
      case 'insidepitchfork': return GitFork;

      // Fib & Gann
      case 'fibretracement':
      case 'fibextension':
      case 'fibextensiontrend':
      case 'fibchannel':
      case 'fibfan':
      case 'fibspeedfan':
      case 'fibspiral':
      case 'gannfan': return Layers;
      case 'fibtimezones':
      case 'trendfibtime': return Calendar;
      case 'fibcircles':
      case 'fibarcs': return Circle;
      case 'fibwedge': return Triangle;
      case 'gannbox':
      case 'gannsquare': return Square;
      case 'dedekind': return Shapes;
      case 'sonic':
      case 'supersonic': return Activity;
      case 'goldensonic':
      case 'goldensupersonic': return Sparkles;

      // Waves & Harmonics
      case 'elliottimpulse':
      case 'elliottcorrection':
      case 'headshoulders': return Activity;
      case 'xabcd':
      case 'cypher':
      case 'gartley':
      case 'bat':
      case 'butterfly':
      case 'crab':
      case 'shark':
      case 'abcd': return Shapes;

      // Shapes & Brushes
      case 'box':
      case 'rotatedrect': return Square;
      case 'freehand': return Paintbrush;
      case 'highlighter': return Highlighter;
      case 'circle':
      case 'ellipse':
      case 'arc': return Circle;
      case 'triangle': return Triangle;
      case 'polyline':
      case 'path':
      case 'curve': return Activity;

      // Measurement & Volume
      case 'position': return DollarSign;
      case 'datepricerange': return Calendar;
      case 'measure': return Ruler;
      case 'magnifier': return Search;
      case 'anchoredvwap':
      case 'fixedrangevp': return ChartBar;

      // Annotations
      case 'text': return Type;
      case 'callout':
      case 'comment': return MessageSquare;
      case 'note': return StickyNote;
      case 'pricenote':
      case 'pricelabel': return Tag;
      case 'signpost': return Milestone;
      case 'arrowmarkup': return ArrowUp;
      case 'arrowmarkdown': return ArrowDown;
      case 'flagmark': return Flag;
      case 'iconstamp': return Sparkles;

      default: return TrendingUp;
    }
  }

  let flyoutTop = $state(100);

  function toggleFlyout(groupId: DrawingGroupId, e?: MouseEvent | Event) {
    if (openFlyout === groupId) {
      openFlyout = null;
    } else {
      openFlyout = groupId;
      searchQuery = '';
      if (e && e.currentTarget) {
        const target = e.currentTarget as HTMLElement;
        const toolItem = target.closest('.tool-item') || target;
        const rect = toolItem.getBoundingClientRect();
        flyoutTop = Math.max(8, Math.min(rect.top - 4, window.innerHeight - 440));
      }
    }
  }

  function handleSelectToolItem(toolId: DrawingToolType, groupId?: DrawingGroupId) {
    if (groupId) {
      setLastUsedTool(groupId, toolId);
      lastUsedPerGroup[groupId] = toolId;
    } else {
      // Cari grup tool ini jika tidak diberikan
      const meta = getToolMeta(toolId);
      if (meta) {
        setLastUsedTool(meta.category, toolId);
        lastUsedPerGroup[meta.category] = toolId;
      }
    }
    onSelectTool(toolId);
    openFlyout = null;
  }

  function handleDirectGroupClick(group: (typeof DRAWING_TOOL_GROUPS)[0], e?: MouseEvent) {
    const currentLastUsed = lastUsedPerGroup[group.id] || group.defaultTool;
    if (activeTool === currentLastUsed) {
      // Jika sudah aktif, klik tombol akan membuka flyout
      toggleFlyout(group.id, e);
    } else {
      // Jika belum aktif, aktifkan tool terakhir dari grup tersebut
      handleSelectToolItem(currentLastUsed, group.id);
    }
  }

  function handleToggleFav(e: MouseEvent, toolId: DrawingToolType) {
    e.stopPropagation();
    toggleFavoriteTool(toolId);
    favoriteToolIds = getFavoriteTools();
  }

  function isGroupActive(group: (typeof DRAWING_TOOL_GROUPS)[0]): boolean {
    if (!activeTool) return false;
    return group.tools.some((t) => t.id === activeTool);
  }

  const POINTER_TOOLS: Array<{ id: DrawingToolType; label: string; shortcut?: string }> = [
    { id: 'cursor', label: 'Kursor (Seleksi & Pindah)', shortcut: 'Esc' },
    { id: 'handpull', label: 'Hand-Pull (Geser Kanvas)', shortcut: 'H' },
    { id: 'eraser', label: 'Penghapus Interaktif' }
  ];

  function isPointerActive(): boolean {
    return activeTool === 'cursor' || activeTool === 'handpull' || activeTool === 'eraser' || activeTool === null;
  }

  function getCurrentPointerTool(): DrawingToolType {
    if (activeTool === 'handpull' || activeTool === 'eraser' || activeTool === 'cursor') {
      return activeTool;
    }
    return lastUsedPointerTool;
  }

  function handleSelectPointerTool(toolId: DrawingToolType) {
    lastUsedPointerTool = toolId;
    onSelectTool(toolId);
    openFlyout = null;
  }

  function togglePointerFlyout(e?: MouseEvent | Event) {
    if (openFlyout === 'pointer') {
      openFlyout = null;
    } else {
      openFlyout = 'pointer';
      if (e && e.currentTarget) {
        const target = e.currentTarget as HTMLElement;
        const toolItem = target.closest('.tool-item') || target;
        const rect = toolItem.getBoundingClientRect();
        flyoutTop = Math.max(8, Math.min(rect.top - 4, window.innerHeight - 440));
      }
    }
  }

  function handleDirectPointerClick() {
    const current = getCurrentPointerTool();
    if (activeTool === current) {
      togglePointerFlyout();
    } else {
      handleSelectPointerTool(current);
    }
  }

  let currentPtrTool = $derived(getCurrentPointerTool());
  let CurrentPtrIcon = $derived(getIconComponent(currentPtrTool));
  let isPtrActive = $derived(isPointerActive());
  let isPointerFlyoutOpen = $derived(openFlyout === 'pointer');

  // Menutup flyout jika pengguna mengklik di luar area toolbar atau flyout
  function handleDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.drawing-toolbar') && !target.closest('.favorites-bar') && !target.closest('.flyout-menu')) {
      openFlyout = null;
    }
  }

  // Keyboard shortcut Esc menutup flyout
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && openFlyout) {
      openFlyout = null;
    }
  }
</script>

<svelte:window onclick={handleDocumentClick} onkeydown={handleKeyDown} />

<!-- Toolbar Vertikal Utama Trawangan (Docked Structural Rail) -->
<aside class="drawing-toolbar glass-panel {isCollapsed ? 'collapsed' : ''}" aria-label="Bilah Alat Gambar Teknikal">
  <div class="toolbar-scroll-container" onscroll={() => { if (openFlyout) openFlyout = null; }}>
  <!-- 1. Flyout Pointer & Navigasi (Cursor, Handpull, Eraser) -->
  <div class="tool-item">
    <div
      class="tool-btn-wrapper {isPtrActive ? 'active' : ''} {isPointerFlyoutOpen ? 'flyout-open' : ''}"
      oncontextmenu={(e) => {
        e.preventDefault();
        togglePointerFlyout(e);
      }}
    >
      <button
        type="button"
        class="tool-btn"
        title="{currentPtrTool === 'handpull' ? 'Hand-Pull (Geser Kanvas - H)' : currentPtrTool === 'eraser' ? 'Penghapus Interaktif' : 'Kursor (Seleksi Objek)'} (Klik untuk aktifkan, klik kanan atau panah untuk pilihan)"
        onclick={handleDirectPointerClick}
      >
        <CurrentPtrIcon size={15} />
      </button>
      <button
        type="button"
        class="sub-arrow-btn"
        title="Buka pilihan Navigasi Pointer & Hand-Pull"
        onclick={(e) => {
          e.stopPropagation();
          togglePointerFlyout(e);
        }}
      >
        <span class="sub-arrow">▸</span>
      </button>
    </div>

    <!-- Submenu Flyout Pointer & Navigasi -->
    {#if isPointerFlyoutOpen}
      <div
        class="flyout-menu obsidian-panel"
        style="top: {flyoutTop}px;"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="flyout-header-row">
          <span class="flyout-header-title">Pointer & Navigasi</span>
          <span class="flyout-count-badge mono-nums">3</span>
        </div>

        <div class="flyout-tools-list">
          {#each POINTER_TOOLS as pTool (pTool.id)}
            {@const PtrIcon = getIconComponent(pTool.id)}
            {@const isThisActive = (activeTool === pTool.id) || (pTool.id === 'cursor' && activeTool === null)}

            <button
              type="button"
              class="flyout-tool-row {isThisActive ? 'active-row' : ''}"
              onclick={() => handleSelectPointerTool(pTool.id)}
            >
              <div class="tool-label-group">
                <PtrIcon size={14} class="tool-icon" />
                <span class="tool-name">{pTool.label}</span>
              </div>
              {#if pTool.shortcut}
                <span class="tool-shortcut-badge mono-nums">{pTool.shortcut}</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="tool-divider"></div>

  <!-- 2. Tujuh Kategori Utama Tools Drawing Vela -->
  {#each DRAWING_TOOL_GROUPS as group (group.id)}
    {@const currentToolId = lastUsedPerGroup[group.id] || group.defaultTool}
    {@const CurrentIcon = getIconComponent(currentToolId)}
    {@const activeInThisGroup = isGroupActive(group)}
    {@const isThisFlyoutOpen = openFlyout === group.id}

    <div class="tool-item">
      <div
        class="tool-btn-wrapper {activeInThisGroup ? 'active' : ''} {isThisFlyoutOpen ? 'flyout-open' : ''}"
        oncontextmenu={(e) => {
          e.preventDefault();
          toggleFlyout(group.id, e);
        }}
      >
        <button
          type="button"
          class="tool-btn"
          title="{group.label} (Klik untuk aktifkan, klik kanan atau panah untuk pilihan)"
          onclick={(e) => handleDirectGroupClick(group, e)}
        >
          <CurrentIcon size={15} />
        </button>
        <button
          type="button"
          class="sub-arrow-btn"
          title="Buka pilihan {group.label}"
          onclick={(e) => {
            e.stopPropagation();
            toggleFlyout(group.id, e);
          }}
        >
          <span class="sub-arrow">▸</span>
        </button>
      </div>

      <!-- Submenu Flyout -->
      {#if isThisFlyoutOpen}
        <div
          class="flyout-menu obsidian-panel"
          style="top: {flyoutTop}px;"
          onclick={(e) => e.stopPropagation()}
        >
          <div class="flyout-header-row">
            <span class="flyout-header-title">{group.label}</span>
            <span class="flyout-count-badge mono-nums">{group.tools.length}</span>
          </div>

          <!-- Quick Search Filter jika item > 8 -->
          {#if group.tools.length > 8}
            <div class="flyout-search-box">
              <Search size={12} class="search-icon" />
              <input
                type="text"
                bind:value={searchQuery}
                placeholder="Cari tool..."
                class="flyout-search-input"
              />
              {#if searchQuery}
                <button
                  type="button"
                  class="clear-search-btn"
                  onclick={() => (searchQuery = '')}
                >
                  <X size={10} />
                </button>
              {/if}
            </div>
          {/if}

          {#if group.id === 'annotations'}
            <!-- Quick Stamp Palette (Target, Warning, Breakout, Pin, Flag) -->
            <div class="stamp-quick-palette">
              <span class="stamp-palette-title">Stempel Cepat:</span>
              <div class="stamp-chips-row">
                {#each STAMP_PRESETS as stamp (stamp.id)}
                  <button
                    type="button"
                    class="stamp-chip-btn"
                    style="--stamp-color: {stamp.color};"
                    title="{stamp.label} ({stamp.description})"
                    onclick={() => handleSelectToolItem(stamp.tool, group.id)}
                  >
                    <span class="stamp-chip-emoji">{stamp.emoji}</span>
                    <span class="stamp-chip-label">{stamp.label}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- List Items -->
          <div class="flyout-list-scroll">
            {#each group.tools.filter((t) => !searchQuery || t.label.toLowerCase().includes(searchQuery.toLowerCase()) || (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())))) as tool (tool.id)}
              {@const ToolIcon = getIconComponent(tool.id)}
              {@const isFav = favoriteToolIds.includes(tool.id)}
              {@const isItemActive = activeTool === tool.id}

              <div class="flyout-item-row {isItemActive ? 'active' : ''}">
                <button
                  type="button"
                  class="flyout-item-action"
                  onclick={() => handleSelectToolItem(tool.id, group.id)}
                >
                  <span class="flyout-item-icon">
                    <ToolIcon size={14} />
                  </span>
                  <span class="flyout-item-label">{tool.label}</span>
                  {#if tool.shortcut}
                    <span class="flyout-item-shortcut mono-nums">{tool.shortcut}</span>
                  {/if}
                </button>

                <!-- Star Favorite Button -->
                <button
                  type="button"
                  class="star-btn {isFav ? 'starred' : ''}"
                  title={isFav ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
                  onclick={(e) => handleToggleFav(e, tool.id)}
                >
                  <Star size={12} fill={isFav ? '#E5A93C' : 'transparent'} />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/each}

  <div class="tool-divider"></div>

  <!-- 3. Toggle Bilah Favorit (Quick Favorites Bar) -->
  <div class="tool-item">
    <button
      type="button"
      class="tool-btn {isFavoritesBarVisible && favoriteToolIds.length > 0 ? 'active glow-amber' : ''}"
      title="Bilah Alat Favorit ({favoriteToolIds.length} tool) - Klik untuk {isFavoritesBarVisible ? 'Sembunyikan' : 'Tampilkan'}"
      onclick={() => (isFavoritesBarVisible = !isFavoritesBarVisible)}
    >
      <Star size={15} fill={isFavoritesBarVisible && favoriteToolIds.length > 0 ? '#E5A93C' : 'transparent'} />
    </button>
  </div>

  <div class="tool-divider"></div>

  <!-- 4. Magnet Snap Toggle -->
  <div class="tool-item">
    <button
      type="button"
      class="tool-btn snap-btn {snapMode !== 'off' ? 'active snap-' + snapMode : ''}"
      title="Magnet Snap (Mode: {snapMode.toUpperCase()})"
      onclick={onToggleSnap}
    >
      <Magnet size={15} />
      {#if snapMode !== 'off'}
        <span class="snap-badge mono-nums">{snapMode === 'weak' ? 'W' : 'S'}</span>
      {/if}
    </button>
  </div>

  <!-- 5. Stay in Drawing Mode Toggle -->
  <div class="tool-item">
    <button
      type="button"
      class="tool-btn {stayMode ? 'active glow-cyan' : ''}"
      title="Tetap Dalam Mode Gambar ({stayMode ? 'AKTIF' : 'NONAKTIF'})"
      onclick={onToggleStay}
    >
      <Pin size={15} />
    </button>
  </div>

  <!-- 6. Lock / Unlock All Drawings -->
  <div class="tool-item">
    <button
      type="button"
      class="tool-btn {isLocked ? 'active glow-warn' : ''}"
      title={isLocked ? 'Buka Kunci Seluruh Gambar' : 'Kunci Seluruh Gambar'}
      onclick={onToggleLock}
    >
      {#if isLocked}
        <Lock size={15} class="text-warn" />
      {:else}
        <Unlock size={15} />
      {/if}
    </button>
  </div>

  <!-- 7. Hide / Show All Drawings -->
  <div class="tool-item">
    <button
      type="button"
      class="tool-btn {isHidden ? 'active text-dim' : ''}"
      title={isHidden ? 'Tampilkan Seluruh Gambar' : 'Sembunyikan Seluruh Gambar'}
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

  <!-- 8. History & Clear Utilities -->
  <div class="tool-item">
    <button
      type="button"
      class="tool-btn action-btn"
      title="Undo Gambar Terakhir (Ctrl+Z)"
      disabled={!canUndo}
      onclick={onUndo}
    >
      <Undo2 size={15} />
    </button>
  </div>

  <div class="tool-item">
    <button
      type="button"
      class="tool-btn action-btn"
      title="Redo Gambar (Ctrl+Y)"
      disabled={!canRedo}
      onclick={onRedo}
    >
      <Redo2 size={15} />
    </button>
  </div>

  <div class="tool-item">
    <button
      type="button"
      class="tool-btn delete-btn"
      title="Hapus Seluruh Objek Gambar di Grafik"
      onclick={onClear}
    >
      <Trash2 size={15} />
    </button>
  </div>
  </div>

  <!-- Dock Rail Footer (Tombol Collapse Alt+T) -->
  <div class="dock-collapse-footer">
    <button
      type="button"
      class="tool-btn collapse-toggle-btn"
      title="Sembunyikan Bilah Gambar (Alt+T)"
      onclick={() => onToggleCollapse?.()}
    >
      <ChevronLeft size={14} />
    </button>
  </div>
</aside>

<!-- Bilah Alat Favorit Melayang (Quick Floating Favorites Bar ala TradingView) -->
{#if isFavoritesBarVisible && favoriteToolIds.length > 0}
  <div
    bind:this={favBarEl}
    class="favorites-bar glass-panel {isDraggingFavBar ? 'dragging' : ''}"
    style="left: {favBarPos.x}px; top: {favBarPos.y}px;"
    aria-label="Bilah Alat Favorit"
  >
    <div
      class="fav-drag-handle"
      title="Tarik untuk memindahkan bilah favorit"
      onpointerdown={handleStartDragFavBar}
    >
      <GripVertical size={13} />
    </div>

    {#each favoriteToolIds as favId (favId)}
      {@const meta = getToolMeta(favId)}
      {@const FavIcon = getIconComponent(favId)}
      {#if meta}
        <button
          type="button"
          class="fav-btn {activeTool === favId ? 'active' : ''}"
          title="{meta.label}{meta.shortcut ? ` (${meta.shortcut})` : ''}"
          onclick={() => handleSelectToolItem(favId, meta.category)}
        >
          <FavIcon size={14} />
        </button>
      {/if}
    {/each}

    <div class="fav-divider"></div>

    <button
      type="button"
      class="fav-close-btn"
      title="Tutup Bilah Favorit"
      onclick={() => (isFavoritesBarVisible = false)}
    >
      <X size={12} />
    </button>
  </div>
{/if}

<style>
  /* ─── Main Vertical Toolbar (Docked Structural Rail) ─── */
  .drawing-toolbar {
    width: 44px;
    min-width: 44px;
    height: 100%;
    background-color: var(--bg-surface, #121721);
    border-right: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    user-select: none;
    z-index: 35;
    flex-shrink: 0;
    box-shadow: none;
    border-radius: 0;
    transition: width 0.15s ease, min-width 0.15s ease;
  }

  .drawing-toolbar.collapsed {
    display: none;
    width: 0px;
    min-width: 0px;
    padding: 0;
    border-right: none;
    overflow: hidden;
  }

  .toolbar-scroll-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    width: 100%;
    overflow-y: auto;
    overflow-x: visible;
    scrollbar-width: none;
    padding: 0 4px;
  }

  .toolbar-scroll-container::-webkit-scrollbar {
    display: none;
  }

  .dock-collapse-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding-top: 4px;
    border-top: 1px solid var(--border-hairline, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .collapse-toggle-btn {
    color: var(--text-muted, #71767b);
  }

  .collapse-toggle-btn:hover {
    color: var(--text-main, #ffffff);
    background-color: rgba(255, 255, 255, 0.08);
  }

  .tool-item {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .tool-btn-wrapper {
    position: relative;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-xs, 4px);
    transition: all 0.12s ease;
  }

  .tool-btn-wrapper.active {
    background: rgba(0, 240, 255, 0.12);
    border: 1px solid rgba(0, 240, 255, 0.5);
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.25);
  }

  .tool-btn-wrapper.active .tool-btn {
    color: #00f0ff;
  }

  .tool-btn-wrapper.flyout-open {
    background: rgba(255, 255, 255, 0.08);
  }

  .tool-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs, 4px);
    color: var(--text-muted, #888888);
    cursor: pointer;
    transition: all 0.12s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    padding: 0;
  }

  .tool-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-main, #eeeeee);
  }

  .tool-btn.active {
    background: rgba(0, 240, 255, 0.12);
    color: #00f0ff;
    border-color: rgba(0, 240, 255, 0.5);
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.25);
  }

  .sub-arrow-btn {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    border: none;
    border-top-left-radius: 4px;
    border-bottom-right-radius: 3px;
    cursor: pointer;
    padding: 0;
    z-index: 2;
    transition: all 0.12s ease;
  }

  .sub-arrow-btn:hover {
    background: rgba(0, 240, 255, 0.35);
  }

  .sub-arrow {
    font-size: 8px;
    color: var(--text-dim, #888888);
    line-height: 1;
    transition: transform 0.12s ease;
  }

  .sub-arrow-btn:hover .sub-arrow,
  .tool-btn-wrapper:hover .sub-arrow {
    color: #ffffff;
    transform: scale(1.15);
  }

  .tool-divider {
    width: 20px;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 2px 0;
  }

  /* Snap and Tool Variations */
  .tool-btn.snap-weak {
    color: #00f090;
    border-color: rgba(0, 240, 144, 0.4);
    background: rgba(0, 240, 144, 0.12);
  }

  .tool-btn.snap-strong {
    color: #818cf8;
    border-color: rgba(129, 140, 248, 0.4);
    background: rgba(129, 140, 248, 0.15);
  }

  .snap-badge {
    position: absolute;
    bottom: 1px;
    right: 2px;
    font-size: 8px;
    font-weight: 700;
    line-height: 1;
  }

  .action-btn:hover {
    color: #00f0ff;
  }

  .delete-btn:hover {
    color: #ff3b69;
    background: rgba(255, 59, 105, 0.15);
  }

  .text-warn {
    color: #f59e0b;
  }

  .glow-warn {
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(245, 158, 11, 0.12);
  }

  .glow-cyan {
    border-color: rgba(0, 240, 255, 0.4);
    background: rgba(0, 240, 255, 0.12);
  }

  .glow-amber {
    border-color: rgba(229, 169, 60, 0.4);
    color: #e5a93c;
  }

  /* ─── Submenu Flyout Menu (Fixed Viewport Clamped) ─── */
  .flyout-menu {
    position: fixed;
    left: 44px;
    width: 240px;
    max-height: min(440px, calc(100vh - 40px));
    padding: 6px;
    border-radius: 8px;
    background-color: rgba(18, 18, 22, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 14px 38px rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 1000;
    backdrop-filter: blur(16px);
    animation: flyoutSlideIn 0.14s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .flyout-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .flyout-header-title {
    font-size: 11px;
    font-weight: 700;
    color: #f0f0f0;
    letter-spacing: 0.3px;
  }

  .flyout-count-badge {
    font-size: 10px;
    color: #888888;
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .stamp-quick-palette {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 4px 4px 4px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    margin-bottom: 4px;
  }

  .stamp-palette-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #71767b);
  }

  .stamp-chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .stamp-chip-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.12s ease;
    font-size: 10px;
    color: var(--text-main, #e5e7eb);
  }

  .stamp-chip-btn:hover {
    background: rgba(255, 255, 255, 0.09);
    border-color: var(--stamp-color, #00f0ff);
    box-shadow: 0 0 6px rgba(0, 240, 255, 0.2);
  }

  .stamp-chip-emoji {
    font-size: 11px;
    line-height: 1;
  }

  .stamp-chip-label {
    font-size: 9.5px;
    font-weight: 500;
  }

  .flyout-search-box {
    display: flex;
    align-items: center;
    position: relative;
    padding: 2px 4px;
  }

  .flyout-search-box :global(.search-icon) {
    position: absolute;
    left: 10px;
    color: #666666;
  }

  .flyout-search-input {
    width: 100%;
    height: 24px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 0 20px 0 24px;
    font-size: 11px;
    color: #ffffff;
    outline: none;
    transition: border-color 0.12s ease;
  }

  .flyout-search-input:focus {
    border-color: rgba(0, 240, 255, 0.5);
  }

  .clear-search-btn {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: #888888;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
  }

  .flyout-list-scroll {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 340px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
    padding-right: 2px;
  }

  .flyout-list-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .flyout-list-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
  }

  .flyout-item-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 4px;
    color: #b0b0b0;
    font-size: 11px;
    transition: all 0.12s ease;
    user-select: none;
  }

  .flyout-item-row:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .flyout-item-row.active {
    background: rgba(0, 240, 255, 0.12);
    color: #00f0ff;
    font-weight: 600;
  }

  .flyout-item-action {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    padding: 3px 0;
    min-width: 0;
  }

  .flyout-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    flex-shrink: 0;
  }

  .flyout-item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .flyout-item-shortcut {
    font-size: 9px;
    color: #666666;
    background: rgba(255, 255, 255, 0.04);
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .star-btn {
    background: transparent;
    border: none;
    color: #555555;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    transition: all 0.12s ease;
  }

  .star-btn:hover {
    color: #e5a93c;
    transform: scale(1.15);
  }

  .star-btn.starred {
    color: #e5a93c;
  }

  /* ─── Floating Favorites Bar ─── */
  .favorites-bar {
    position: fixed;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 4px 6px;
    background: rgba(16, 16, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(12px);
    user-select: none;
    touch-action: none;
    animation: fadeIn 0.15s ease-out;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .favorites-bar.dragging {
    border-color: rgba(0, 240, 255, 0.5);
    box-shadow: 0 16px 42px rgba(0, 0, 0, 0.85);
    cursor: grabbing;
  }

  .fav-drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666666;
    padding: 2px 4px;
    cursor: grab;
    transition: color 0.12s ease;
  }

  .fav-drag-handle:hover,
  .favorites-bar.dragging .fav-drag-handle {
    color: #00f0ff;
  }

  .fav-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #a0a0a0;
    cursor: pointer;
    transition: all 0.12s ease;
    padding: 0;
  }

  .fav-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .fav-btn.active {
    background: rgba(0, 240, 255, 0.14);
    color: #00f0ff;
    border-color: rgba(0, 240, 255, 0.4);
    box-shadow: 0 0 8px rgba(0, 240, 255, 0.2);
  }

  .fav-divider {
    width: 1px;
    height: 16px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 2px;
  }

  .fav-close-btn {
    background: transparent;
    border: none;
    color: #666666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 3px;
  }

  .fav-close-btn:hover {
    color: #ff3b69;
    background: rgba(255, 59, 105, 0.12);
  }

  /* Animations */
  @keyframes flyoutSlideIn {
    from {
      opacity: 0;
      transform: translateX(-6px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
