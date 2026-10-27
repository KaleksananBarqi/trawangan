<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import {
    Plus,
    X,
    Search,
    TrendingUp,
    TrendingDown,
    ChevronRight,
    ChevronLeft,
    Flame,
    Bell,
    Layers,
    Eye,
    EyeOff,
    Trash2,
    CheckCircle2,
    Play,
    Pause,
    RotateCcw,
    ArrowUpRight,
    ArrowDownRight,
    MoveHorizontal,
    SlidersHorizontal,
    Globe,
    Check,
    Loader2,
    Lock,
    Unlock,
    Settings,
    Code,
    ChevronDown,
    ChevronUp,
    Square,
    Type,
    Minus,
    FolderPlus,
    Pencil,
    MoreHorizontal,
    Folder,
    GripVertical
  } from '@lucide/svelte';
  import { loadWatchlist, saveWatchlist } from '../services/persistence';
  import { marketFeed } from '../services/market';
  import { alertService } from '../services/alertService';
  import {
    parseWatchlistEntry,
    formatWatchlistEntry,
    normalizeProviderId,
    isSectionToken,
    formatSectionToken,
    parseSectionToken,
    insertSymbolIntoSection,
    moveItemToSection,
    reorderWatchlistItems,
    type WatchlistSectionToken
  } from '../services/watchlistUtils';
  import SymbolSearchModal from './SymbolSearchModal.svelte';
  import WatchlistSwitcher from './WatchlistSwitcher.svelte';
  import SymbolLogo from './common/SymbolLogo.svelte';
  import { parseAdaptiveSymbol } from '../services/market/symbolSearchService';
  import { watchlistRegistry } from '../services/watchlistRegistryService';
  import { getSearchResultKey } from '../services/market/symbolSearchService';
  import type { PriceAlert, ObjectTreeItem, MarketSearchResult, WatchlistRecord } from '../types/market';

  interface Props {
    isOpen: boolean;
    activeTab?: 'watchlist' | 'alerts' | 'objects';
    onTabChange?: (tab: 'watchlist' | 'alerts' | 'objects') => void;
    activeSymbol: string;
    activeProviderId?: string;
    watchlistSymbols?: string[];
    activeIndicators?: { id: string; title: string; visible: boolean; source?: string; inputs?: any }[];
    activeDrawings?: any[];
    selectedDrawingId?: string | null;
    showVolume?: boolean;
    onToggleVolumeVisibility?: () => void;
    onSelectSymbol: (symbol: string, providerId?: string) => void;
    onToggleCollapse: () => void;
    onToggleIndicatorVisibility?: (id: string) => void;
    onRemoveIndicator?: (id: string) => void;
    onConfigureIndicator?: (id: string) => void;
    onOpenIndicatorInPine?: (id: string, source?: string) => void;
    onToggleDrawingVisibility?: (id: string) => void;
    onToggleDrawingLock?: (id: string) => void;
    onRemoveDrawing?: (id: string) => void;
    onSelectDrawing?: (id: string | null) => void;
    onBulkHideDrawings?: (hidden: boolean) => void;
    onBulkLockDrawings?: (locked: boolean) => void;
    onBulkDeleteDrawings?: () => void;
    onWatchlistChange?: (symbols: string[]) => void;
    onRequestCreateAlert?: () => void;
    onRequestEditAlert?: (alert: PriceAlert) => void;
    onOpenSymbolSearch?: () => void;
  }

  let {
    isOpen,
    activeTab: propActiveTab,
    onTabChange,
    activeSymbol,
    activeProviderId = 'binance',
    watchlistSymbols: propSymbols,
    activeIndicators = [],
    activeDrawings = [],
    selectedDrawingId = null,
    showVolume = true,
    onToggleVolumeVisibility,
    onSelectSymbol,
    onToggleCollapse,
    onToggleIndicatorVisibility,
    onRemoveIndicator,
    onConfigureIndicator,
    onOpenIndicatorInPine,
    onToggleDrawingVisibility,
    onToggleDrawingLock,
    onRemoveDrawing,
    onSelectDrawing,
    onBulkHideDrawings,
    onBulkLockDrawings,
    onBulkDeleteDrawings,
    onWatchlistChange,
    onRequestCreateAlert,
    onRequestEditAlert,
    onOpenSymbolSearch,
  }: Props = $props();

  let internalTab = $state<'watchlist' | 'alerts' | 'objects'>('watchlist');
  let activeTab = $derived(propActiveTab ?? internalTab);

  function switchTab(tab: 'watchlist' | 'alerts' | 'objects') {
    internalTab = tab;
    onTabChange?.(tab);
  }
  let isSymbolSearchOpen = $state(false);

  // State Collapsible Groups di Tab Objects
  let isIndicatorsGroupOpen = $state(true);
  let isDrawingsGroupOpen = $state(true);
  let nativeVolumeCount = $derived(showVolume ? 1 : 0);
  let totalIndicatorsCount = $derived(activeIndicators.length + nativeVolumeCount);

  // Action untuk otomatis scroll item layer yang aktif ke pandangan
  function scrollIntoViewIfSelected(node: HTMLElement, isSelected: boolean) {
    if (isSelected) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return {
      update(selected: boolean) {
        if (selected) {
          node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };
  }

  // Jika ada drawing yang dipilih dari kanvas dan grup drawings tertutup, otomatis buka
  $effect(() => {
    if (selectedDrawingId && !isDrawingsGroupOpen) {
      isDrawingsGroupOpen = true;
    }
  });

  function getDrawingMeta(drawing: any) {
    const type = drawing.type || 'drawing';
    const anchors = Array.isArray(drawing.anchors) ? drawing.anchors : [];
    let priceStr = '';
    if (anchors.length > 0 && typeof anchors[0]?.price === 'number') {
      priceStr = `@ ${anchors[0].price.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
    }

    switch (type) {
      case 'trendline':
        return { title: 'Garis Tren (Trendline)', icon: TrendingUp, subtitle: priceStr };
      case 'hline':
        return { title: 'Garis Horisontal (H-Line)', icon: MoveHorizontal, subtitle: priceStr };
      case 'hray':
        return { title: 'Sinar Horisontal (H-Ray)', icon: ArrowUpRight, subtitle: priceStr };
      case 'vline':
        return { title: 'Garis Vertikal', icon: Minus, subtitle: 'Time axis' };
      case 'fibonacci':
        return { title: 'Fibonacci Retracement', icon: SlidersHorizontal, subtitle: priceStr };
      case 'rectangle':
        return { title: 'Kotak (Rectangle)', icon: Square, subtitle: priceStr };
      case 'position':
        return { title: 'Posisi Long/Short', icon: TrendingUp, subtitle: priceStr };
      case 'text':
      case 'note':
      case 'callout':
        return {
          title: drawing.text?.content ? `Teks: "${drawing.text.content.slice(0, 16)}"` : 'Anotasi Teks',
          icon: Type,
          subtitle: priceStr
        };
      case 'pricelabel':
      case 'pricenote':
        return { title: 'Label Harga', icon: MoveHorizontal, subtitle: priceStr };
      default:
        return { title: drawing.name || drawing.type || 'Objek Gambar', icon: Layers, subtitle: priceStr };
    }
  }

  // Multi-Watchlist state & Registry integration
  let registryWatchlists = $state<WatchlistRecord[]>([]);
  let registryActiveId = $state<string>('default');
  let unsubRegistry: (() => void) | null = null;

  const activeWatchlist = $derived.by<WatchlistRecord>(() => {
    const found = registryWatchlists.find((w) => w.id === registryActiveId);
    if (found) return found;
    return {
      id: registryActiveId,
      name: 'Daftar Utama',
      items: symbols,
      isPreset: false,
    };
  });

  let lastActiveSectionId = $state<string | null | undefined>(undefined);

  function getSectionIdForSymbol(sym: string): string | null {
    let currentId: string | null = null;
    for (const item of symbols) {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        currentId = parsed ? parsed.id : null;
      } else if (item === sym) {
        return currentId;
      }
    }
    return null;
  }

  function handleSelectSymbol(rawEntry: string) {
    const { providerId, symbol } = parseWatchlistEntry(rawEntry);
    lastActiveSectionId = getSectionIdForSymbol(rawEntry);
    onSelectSymbol(symbol, providerId);
  }

  let symbols = $state<string[]>([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT'
  ]);
  let tickerMap = $state<Record<string, { price: number; change24h: number; high24h: number; low24h: number; volume24h: number }>>({});
  let searchQuery = $state('');
  let newSymbolInput = $state('');
  // Alerts state & filters
  let alerts = $state<PriceAlert[]>([]);
  let alertFilterMode = $state<'all' | 'current'>('all');
  let newAlertPrice = $state('');
  let newAlertLabel = $state('');
  let showAddInput = $state(false);
  let showAddAlert = $state(false);
  let unsubWatchlistFeed: (() => void) | null = null;
  let unsubAlerts: (() => void) | null = null;

  const displayAlerts = $derived.by(() => {
    if (alertFilterMode === 'current') {
      const clean = activeSymbol.replace('.P', '').toUpperCase();
      return alerts.filter((a) => a.symbol.replace('.P', '').toUpperCase() === clean);
    }
    return alerts;
  });

  const activeAlertsCount = $derived(alerts.filter((a) => a.active && !a.triggered).length);
  const triggeredAlertsCount = $derived(alerts.filter((a) => a.triggered).length);

  let lastSyncedHash = '';

  $effect(() => {
    if (propSymbols) {
      const h = JSON.stringify(propSymbols);
      if (h !== lastSyncedHash) {
        lastSyncedHash = h;
        symbols = [...propSymbols];
      }
    }
  });

  async function applyWatchlistUpdate(newSymbols: string[]) {
    symbols = [...newSymbols];
    lastSyncedHash = JSON.stringify(newSymbols);
    if (JSON.stringify(newSymbols) !== JSON.stringify(propSymbols)) {
      onWatchlistChange?.(newSymbols);
    }
    await watchlistRegistry.updateActiveItems(newSymbols);
  }

  async function loadInitialWatchlist() {
    try {
      await watchlistRegistry.load();
    } catch (err) {
      console.warn('Gagal memuat awal multi-watchlist:', err);
    }
  }

  $effect(() => {
    const syms = symbols;
    if (syms && syms.length > 0) {
      if (unsubWatchlistFeed) unsubWatchlistFeed();
      unsubWatchlistFeed = untrack(() => {
        return marketFeed.subscribeWatchlistTickers(syms, (newMap) => {
          tickerMap = { ...tickerMap, ...newMap };
        });
      });
      return () => {
        if (unsubWatchlistFeed) {
          unsubWatchlistFeed();
          unsubWatchlistFeed = null;
        }
      };
    }
  });

  onMount(() => {
    unsubRegistry = watchlistRegistry.subscribe(({ watchlists: list, activeId }) => {
      registryWatchlists = list;
      registryActiveId = activeId;
      const current = list.find((w) => w.id === activeId);
      if (current) {
        symbols = [...current.items];
        lastSyncedHash = JSON.stringify(symbols);
        if (JSON.stringify(symbols) !== JSON.stringify(propSymbols)) {
          onWatchlistChange?.(symbols);
        }
      }
    });
    loadInitialWatchlist();
    unsubAlerts = alertService.subscribe((list) => {
      alerts = list;
    });
  });

  onDestroy(() => {
    if (unsubWatchlistFeed) unsubWatchlistFeed();
    if (unsubAlerts) unsubAlerts();
    if (unsubRegistry) unsubRegistry();
  });


  async function handleAddSymbol(e: Event) {
    e.preventDefault();
    const clean = newSymbolInput.trim().toUpperCase();
    if (!clean) return;

    let formatted = clean;
    if (clean.endsWith('.P')) {
      const base = clean.slice(0, -2);
      formatted = base.endsWith('USDT') ? clean : `${base}USDT.P`;
    } else if (!clean.endsWith('USDT') && !clean.endsWith('IDR')) {
      formatted = `${clean}USDT`;
    }

    const entry = formatWatchlistEntry(formatted, activeProviderId);
    if (!symbols.includes(entry)) {
      const next = insertSymbolIntoSection(symbols, entry, lastActiveSectionId);
      await applyWatchlistUpdate(next);
    }
    newSymbolInput = '';
    showAddInput = false;
  }

  // ─── Omni-Search State & Background Exploration ───
  let exchangeSearchResults = $state<MarketSearchResult[]>([]);
  let isSearchingExchange = $state(false);
  let selectedOmniIndex = $state(0);
  let searchDebounceTimer: any = null;

  $effect(() => {
    const q = searchQuery.trim();
    if (!q) {
      exchangeSearchResults = [];
      isSearchingExchange = false;
      selectedOmniIndex = 0;
      return;
    }

    // 1. Respon instan < 5ms dari cache memori lokal
    if (marketFeed.searchLocalSymbols) {
      const instant = marketFeed.searchLocalSymbols(q);
      exchangeSearchResults = instant.slice(0, 15);
    }

    // 2. Query menyeluruh bursa dengan debounce 150ms
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
      isSearchingExchange = true;
      try {
        const fullResults = await marketFeed.searchSymbols(q);
        exchangeSearchResults = fullResults.slice(0, 25);
      } catch (err) {
        console.warn('Gagal mencari simbol bursa:', err);
      } finally {
        isSearchingExchange = false;
      }
    }, 150);
  });

  async function handleAddSymbolFromExchange(e: MouseEvent, sym: string, providerId?: string) {
    e.stopPropagation();
    e.preventDefault();
    const entry = formatWatchlistEntry(sym, providerId || activeProviderId);
    const target = parseWatchlistEntry(entry);
    const exists = symbols.some((s) => {
      if (s === entry) return true;
      const p = parseWatchlistEntry(s);
      return p.symbol === target.symbol && p.providerId === target.providerId;
    });
    if (!exists) {
      const next = insertSymbolIntoSection(symbols, entry, lastActiveSectionId);
      await applyWatchlistUpdate(next);
    }
  }

  function handleSearchKeyDown(e: KeyboardEvent) {
    const totalOmniItems = filteredSymbols.length + exchangeSearchResults.length;
    if (totalOmniItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedOmniIndex = (selectedOmniIndex + 1) % totalOmniItems;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedOmniIndex = (selectedOmniIndex - 1 + totalOmniItems) % totalOmniItems;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedOmniIndex < filteredSymbols.length) {
        handleSelectSymbol(filteredSymbols[selectedOmniIndex]);
      } else {
        const exItem = exchangeSearchResults[selectedOmniIndex - filteredSymbols.length];
        if (exItem) {
          handleSelectSymbol(exItem.symbol);
        }
      }
    }
  }

  async function handleToggleSymbolFromSearch(rawInput: string) {
    let entry = rawInput;
    if (!entry.includes(':')) {
      entry = formatWatchlistEntry(rawInput, activeProviderId);
    }
    const target = parseWatchlistEntry(entry);
    const exists = symbols.some((s) => {
      if (s === entry) return true;
      const p = parseWatchlistEntry(s);
      return p.symbol === target.symbol && p.providerId === target.providerId;
    });

    let next: string[];
    if (exists) {
      next = symbols.filter((s) => {
        if (s === entry) return false;
        const p = parseWatchlistEntry(s);
        return !(p.symbol === target.symbol && p.providerId === target.providerId);
      });
    } else {
      next = insertSymbolIntoSection(symbols, entry, lastActiveSectionId);
    }
    await applyWatchlistUpdate(next);
  }

  async function handleRemoveSymbol(e: MouseEvent, rawEntry: string) {
    e.stopPropagation();
    e.preventDefault();
    const target = parseWatchlistEntry(rawEntry);
    const next = symbols.filter((s) => {
      if (s === rawEntry) return false;
      const p = parseWatchlistEntry(s);
      return !(p.symbol === target.symbol && p.providerId === target.providerId);
    });
    await applyWatchlistUpdate(next);
  }

  function handleTriggerOpenCreateAlert() {
    if (onRequestCreateAlert) {
      onRequestCreateAlert();
    } else {
      showAddAlert = !showAddAlert;
    }
  }

  async function handleCreateAlert(e: Event) {
    e.preventDefault();
    const p = parseFloat(newAlertPrice);
    if (!p) return;

    const curP = tickerMap[activeSymbol]?.price || 0;
    const cond = curP > 0 ? (p > curP ? 'crossing_up' : 'crossing_down') : 'crossing';

    await alertService.addAlert({
      symbol: activeSymbol,
      targetPrice: p,
      condition: cond,
      frequency: 'once',
      label: newAlertLabel.trim() || `Target ${activeSymbol} @ ${p}`,
    });

    newAlertPrice = '';
    newAlertLabel = '';
    showAddAlert = false;
  }

  async function handleToggleAlert(id: string) {
    await alertService.toggleAlertActive(id);
  }

  async function handleResetAlert(id: string) {
    await alertService.resetTriggeredAlert(id);
  }

  async function handleRemoveAlert(id: string) {
    await alertService.deleteAlert(id);
  }

  function getConditionBadge(cond: string) {
    switch (cond) {
      case 'crossing_up':
      case 'above':
        return { label: '↗ Crossing Up', class: 'bull' };
      case 'crossing_down':
      case 'below':
        return { label: '↘ Crossing Down', class: 'bear' };
      case 'crossing':
        return { label: '↔ Crossing', class: 'cyan' };
      case 'greater_than':
        return { label: '≥ Greater', class: 'bull' };
      case 'less_than':
        return { label: '≤ Less', class: 'bear' };
      default:
        return { label: 'Crossing', class: 'muted' };
    }
  }

  function calculateAlertDistance(target: number, sym: string): { diffText: string; pctText: string; isBull: boolean } | null {
    const cur = tickerMap[sym]?.price;
    if (!cur || cur <= 0) return null;
    const diff = target - cur;
    const pct = (diff / cur) * 100;
    const isBull = diff > 0;
    return {
      diffText: `${isBull ? '+' : ''}$${Math.abs(diff).toFixed(diff >= 100 ? 1 : 2)}`,
      pctText: `${isBull ? '+' : ''}${pct.toFixed(2)}%`,
      isBull,
    };
  }

  const filteredSymbols = $derived(
    symbols.filter((s) => !isSectionToken(s) && s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  interface SectionGroup {
    section: WatchlistSectionToken | null;
    items: string[];
  }

  const groupedSections = $derived.by<SectionGroup[]>(() => {
    const groups: SectionGroup[] = [];
    let current: SectionGroup = { section: null, items: [] };

    for (const item of symbols) {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        if (parsed) {
          if (current.section !== null || current.items.length > 0) {
            groups.push(current);
          }
          current = { section: parsed, items: [] };
          continue;
        }
      }
      current.items.push(item);
    }

    if (current.section !== null || current.items.length > 0) {
      groups.push(current);
    }

    return groups;
  });

  // Section Modal & Menu States
  let showAddSectionModal = $state(false);
  let newSectionName = $state('');

  let showRenameSectionModal = $state(false);
  let renameSectionId = $state<string | null>(null);
  let renameSectionValue = $state('');

  let activeSectionMenuId = $state<string | null>(null);

  async function handleAddSectionSubmit() {
    const clean = newSectionName.trim().toUpperCase();
    if (!clean) return;
    const token = formatSectionToken(clean);
    const parsed = parseSectionToken(token);
    if (parsed) {
      lastActiveSectionId = parsed.id;
    }
    await applyWatchlistUpdate([...symbols, token]);
    newSectionName = '';
    showAddSectionModal = false;
  }

  async function handleToggleSectionCollapse(sectionId: string) {
    lastActiveSectionId = sectionId;
    const next = symbols.map((item) => {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        if (parsed && parsed.id === sectionId) {
          return formatSectionToken(parsed.name, parsed.id, !parsed.isCollapsed);
        }
      }
      return item;
    });
    await applyWatchlistUpdate(next);
  }

  function openRenameSection(section: WatchlistSectionToken, e: MouseEvent) {
    e.stopPropagation();
    renameSectionId = section.id;
    renameSectionValue = section.name;
    showRenameSectionModal = true;
    activeSectionMenuId = null;
  }

  async function handleRenameSectionSubmit() {
    if (!renameSectionId || !renameSectionValue.trim()) return;
    const clean = renameSectionValue.trim().toUpperCase();
    const next = symbols.map((item) => {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        if (parsed && parsed.id === renameSectionId) {
          return formatSectionToken(clean, parsed.id, parsed.isCollapsed);
        }
      }
      return item;
    });
    await applyWatchlistUpdate(next);
    showRenameSectionModal = false;
    renameSectionId = null;
    renameSectionValue = '';
  }

  async function handleDeleteSection(sectionId: string, e: MouseEvent) {
    e.stopPropagation();
    activeSectionMenuId = null;
    const next = symbols.filter((item) => {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        return parsed?.id !== sectionId;
      }
      return true;
    });
    await applyWatchlistUpdate(next);
  }

  // ─── Drag & Drop Reordering ───
  let draggedItemIndex = $state<number | null>(null);
  let dragOverItemIndex = $state<number | null>(null);
  let dragOverPosition = $state<'before' | 'after'>('before');

  function handleDragStart(e: DragEvent, index: number) {
    draggedItemIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    const currentTarget = e.currentTarget as HTMLElement;
    const rect = currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    dragOverPosition = e.clientY < midY ? 'before' : 'after';
    dragOverItemIndex = index;
  }

  function handleDragLeave() {
    // Biarkan dragOverItemIndex tetap aktif untuk kestabilan visual
  }

  async function handleDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      draggedItemIndex = null;
      dragOverItemIndex = null;
      return;
    }

    const reordered = reorderWatchlistItems(symbols, draggedItemIndex, targetIndex, dragOverPosition);
    draggedItemIndex = null;
    dragOverItemIndex = null;
    await applyWatchlistUpdate(reordered);
  }

  function handleDragEnd() {
    draggedItemIndex = null;
    dragOverItemIndex = null;
  }

  // ─── Coin Context Menu State ("Pindahkan ke Kategori...") ───
  let activeCoinMenuSymbol = $state<string | null>(null);

  const availableSections = $derived.by<WatchlistSectionToken[]>(() => {
    const list: WatchlistSectionToken[] = [];
    for (const item of symbols) {
      if (isSectionToken(item)) {
        const parsed = parseSectionToken(item);
        if (parsed) list.push(parsed);
      }
    }
    return list;
  });

  async function handleMoveSymbolToSection(sym: string, targetSecId: string | null) {
    activeCoinMenuSymbol = null;
    const updated = moveItemToSection(symbols, sym, targetSecId);
    await applyWatchlistUpdate(updated);
  }

  function formatPrice(p?: number, sym?: string): string {

    if (!p) return '--';
    if (sym && (sym.endsWith('IDR') || sym.includes('/IDR'))) {
      if (p >= 1) return `Rp ${Math.round(p).toLocaleString('id-ID')}`;
      return `Rp ${p.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    if (sym && (sym.endsWith('BTC') || sym.includes('/BTC')) && sym !== 'BTC' && !sym.startsWith('BTC')) {
      return `${p.toFixed(8)} ₿`;
    }
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  }
</script>

<!-- Watchlist & Telemetry Right Drawer Panel -->
{#if isOpen}
  <aside class="right-panel obsidian-panel">
    <!-- Panel Header: Tab Switching -->
    <div class="panel-header">
      <nav class="panel-tabs">
        <button
          class="tab-btn {activeTab === 'watchlist' ? 'active' : ''}"
          onclick={() => switchTab('watchlist')}
        >
          <Flame size={13} />
          <span>Watchlist</span>
          <span class="count-pill mono-nums">{symbols.length}</span>
        </button>

        <button
          class="tab-btn {activeTab === 'alerts' ? 'active' : ''}"
          onclick={() => switchTab('alerts')}
        >
          <Bell size={13} />
          <span>Alerts</span>
          <span class="count-pill mono-nums">{alerts.length}</span>
        </button>

        <button
          class="tab-btn {activeTab === 'objects' ? 'active' : ''}"
          onclick={() => switchTab('objects')}
        >
          <Layers size={13} />
          <span>Layers</span>
          {#if totalIndicatorsCount > 0}
            <span class="count-pill mono-nums">{totalIndicatorsCount}</span>
          {/if}
        </button>
      </nav>

      <button
        class="collapse-action-btn"
        title="Tutup Panel"
        onclick={onToggleCollapse}
      >
        <ChevronRight size={15} />
      </button>
    </div>

    <!-- TAB 1: WATCHLIST -->
    {#if activeTab === 'watchlist'}
      <!-- Watchlist Toolbar: Add & Search -->
      <div class="sub-toolbar">
        <div class="search-box">
          <span class="search-icon"><Search size={12} /></span>
          <input
            type="text"
            placeholder="Cari simbol (e.g. RE, BTC, ETH)..."
            bind:value={searchQuery}
            onkeydown={handleSearchKeyDown}
            class="search-input"
          />
          {#if searchQuery}
            <button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')}>
              <X size={11} />
            </button>
          {/if}
        </div>

        <button
          type="button"
          class="symbol-search-trigger-btn"
          title="Buka Pencarian Pair Kripto Valid (Spot / Perpetuals)"
          onclick={() => {
            if (onOpenSymbolSearch) onOpenSymbolSearch();
            else isSymbolSearchOpen = true;
          }}
        >
          <Search size={11} />
          <span>Cari Pair</span>
        </button>

        <button
          class="add-symbol-btn {showAddInput ? 'active' : ''}"
          title="Input Cepat Simbol"
          onclick={() => (showAddInput = !showAddInput)}
        >
          <Plus size={13} />
        </button>

        <button
          type="button"
          class="add-section-toolbar-btn"
          title="Tambah Kategori / Section"
          onclick={() => (showAddSectionModal = true)}
        >
          <FolderPlus size={13} />
        </button>
      </div>


      <!-- Multi-Watchlist Switcher Popover -->
      {#if !searchQuery.trim()}
        <WatchlistSwitcher
          {activeWatchlist}
          watchlists={registryWatchlists}
          onSelectWatchlist={async (id) => {
            await watchlistRegistry.setActiveWatchlistId(id);
          }}
          onCreateWatchlist={async (name) => {
            await watchlistRegistry.createWatchlist(name);
          }}
          onRenameWatchlist={async (id, name) => {
            await watchlistRegistry.renameWatchlist(id, name);
          }}
          onDuplicateWatchlist={async (id) => {
            await watchlistRegistry.duplicateWatchlist(id);
          }}
          onDeleteWatchlist={async (id) => {
            await watchlistRegistry.deleteWatchlist(id);
          }}
          onResetPreset={async (id) => {
            await watchlistRegistry.resetPresetWatchlist(id);
          }}
        />
      {/if}


      <!-- Feed Status & Column Headers -->
      <div class="table-head mono-nums">
        <div class="col-symbol-wrapper">
          <span class="col-symbol">Symbol</span>
          <span class="active-feed-pill">{activeProviderId.toUpperCase()}</span>
        </div>
        <span class="col-price">Last Price</span>
        <span class="col-change">24h %</span>
      </div>

      {#if showAddInput}
        <form class="add-form" onsubmit={handleAddSymbol}>
          <input
            type="text"
            placeholder="Ketik simbol (e.g. BTCUSDT.P, BTCIDR)..."
            bind:value={newSymbolInput}
            class="add-input mono-nums"
          />
          <button type="submit" class="submit-add-btn">Add</button>
        </form>
      {/if}

      <!-- Watchlist & Omni-Search Items List -->
      <div class="items-list">
        {#if searchQuery.trim()}
          <!-- ─── 1. Koin Lokal Terdaftar di Watchlist ─── -->
          {#if filteredSymbols.length > 0}
            <div class="omni-section-header">
              <span>Di Watchlist ({filteredSymbols.length})</span>
            </div>
            {#each filteredSymbols as sym, idx (sym)}
              {@const entry = parseWatchlistEntry(sym)}
              {@const p = parseAdaptiveSymbol(entry.symbol)}
              {@const ticker = tickerMap[sym] || tickerMap[entry.symbol]}
              {@const isBull = (ticker?.change24h ?? 0) >= 0}
              {@const isHighlighted = selectedOmniIndex === idx}
              {@const isCurrentActive = activeSymbol === entry.symbol && activeProviderId === entry.providerId}
              <div class="watchlist-row {isCurrentActive ? 'active-row' : ''} {isHighlighted ? 'omni-highlighted' : ''}">
                <button
                  type="button"
                  class="row-select-btn"
                  onclick={() => handleSelectSymbol(sym)}
                >
                  <div class="row-symbol">
                    <span class="status-pip {isBull ? 'pip-bull' : 'pip-bear'}"></span>
                    <SymbolLogo baseAsset={p.baseAsset} quoteAsset={p.quoteAsset} size="sm" />
                    <span class="symbol-name">{p.baseAsset}</span>
                    <span class="venue-badge {entry.providerId} mono-nums">{entry.providerId.toUpperCase()}</span>
                    {#if entry.symbol.endsWith('.P')}
                      <span class="type-tag perp mono-nums">.P</span>
                    {:else if entry.symbol.endsWith('IDR')}
                      <span class="type-tag idr mono-nums">IDR</span>
                    {:else if p.quoteAsset && p.quoteAsset !== 'USDT'}
                      <span class="type-tag spot mono-nums">{p.quoteAsset}</span>
                    {:else}
                      <span class="type-tag spot mono-nums">SPOT</span>
                    {/if}
                  </div>

                  <div class="row-price mono-nums">
                    {formatPrice(ticker?.price, entry.symbol)}
                  </div>

                  <div class="row-change mono-nums">
                    {#if ticker?.change24h !== undefined}
                      <span class="change-pill {isBull ? 'pill-bull' : 'pill-bear'}">
                        {#if isBull}+{/if}{ticker.change24h.toFixed(2)}%
                      </span>
                    {:else}
                      <span class="change-placeholder">--</span>
                    {/if}
                  </div>
                </button>

                <button
                  type="button"
                  class="delete-item-btn"
                  title="Hapus dari watchlist"
                  onclick={(e) => handleRemoveSymbol(e, sym)}
                >
                  <X size={11} />
                </button>
              </div>
            {/each}
          {/if}

          <!-- ─── 2. Hasil Agregasi Bursa (Exchange Results) ─── -->
          {#if exchangeSearchResults.length > 0}
            <div class="omni-section-header exchange-header">
              <div class="omni-header-left">
                <Globe size={11} />
                <span>Hasil dari Bursa ({exchangeSearchResults.length})</span>
              </div>
              {#if isSearchingExchange}
                <span class="omni-loading-pip">
                  <Loader2 size={10} class="spin" />
                  <span>Memuat...</span>
                </span>
              {/if}
            </div>

            {#each exchangeSearchResults as item, exIdx (getSearchResultKey(item))}
              {@const globalIdx = filteredSymbols.length + exIdx}
              {@const isInWatchlist = symbols.some((w) => {
                const p = parseWatchlistEntry(w);
                return p.symbol === item.symbol.toUpperCase() && p.providerId === normalizeProviderId(item.provider);
              })}
              {@const isHighlighted = selectedOmniIndex === globalIdx}
              <div class="watchlist-row exchange-row {activeSymbol === item.symbol ? 'active-row' : ''} {isHighlighted ? 'omni-highlighted' : ''}">
                <button
                  type="button"
                  class="row-select-btn"
                  onclick={() => handleSelectSymbol(item.symbol)}
                >
                  <div class="row-symbol">
                    <span class="status-pip {item.type === 'perp' ? 'pip-perp' : 'pip-spot'}"></span>
                    <SymbolLogo baseAsset={item.baseAsset} quoteAsset={item.quoteAsset} size="sm" />
                    <span class="symbol-name">{item.baseAsset}</span>
                    <span class="symbol-quote mono-nums">/{item.quoteAsset}</span>
                    {#if item.type === 'perp'}
                      <span class="type-tag perp mono-nums">.P</span>
                    {:else if item.quoteAsset === 'IDR'}
                      <span class="type-tag idr mono-nums">IDR</span>
                    {:else if item.quoteAsset && item.quoteAsset !== 'USDT'}
                      <span class="type-tag spot mono-nums">{item.quoteAsset}</span>
                    {:else}
                      <span class="type-tag spot mono-nums">SPOT</span>
                    {/if}
                  </div>

                  <div class="exchange-venue-desc">
                    {item.provider}
                  </div>
                </button>

                <!-- Tombol 1-klik Tambah ke Watchlist (+) -->
                <button
                  type="button"
                  class="add-exchange-btn {isInWatchlist ? 'already-added' : ''}"
                  title={isInWatchlist ? 'Sudah ada di daftar pantau' : 'Tambahkan ke watchlist'}
                  onclick={(e) => handleAddSymbolFromExchange(e, item.symbol, item.provider)}
                  disabled={isInWatchlist}
                >
                  {#if isInWatchlist}
                    <Check size={12} />
                  {:else}
                    <Plus size={12} />
                  {/if}
                </button>
              </div>
            {/each}
          {/if}

          {#if filteredSymbols.length === 0 && exchangeSearchResults.length === 0}
            <div class="empty-state omni-empty">
              {#if isSearchingExchange}
                <Loader2 size={20} class="spin" />
                <span>Mencari di seluruh bursa...</span>
              {:else}
                <span>Tidak ada koin yang cocok dengan "{searchQuery}".</span>
                <button
                  type="button"
                  class="btn-open-global-search"
                  onclick={() => {
                    if (onOpenSymbolSearch) onOpenSymbolSearch();
                    else isSymbolSearchOpen = true;
                  }}
                >
                  <Search size={11} />
                  <span>Cari Online di Menu Simbol (Ctrl+K)</span>
                </button>
              {/if}
            </div>
          {/if}

        {:else}
          <!-- ─── 3. Tampilan Normal Terkelompok Kategori / Section ─── -->
          {#each groupedSections as group (group.section ? group.section.id : '__uncat__')}
            {#if group.section}
              {@const sec = group.section}
              {@const secTokenStr = symbols.find((s) => isSectionToken(s) && parseSectionToken(s)?.id === sec.id) || ''}
              {@const secGlobalIndex = symbols.indexOf(secTokenStr)}
              <div
                class="section-divider-row {sec.isCollapsed ? 'collapsed' : ''} {dragOverItemIndex === secGlobalIndex && dragOverPosition === 'before' ? 'drop-target-before' : ''} {dragOverItemIndex === secGlobalIndex && dragOverPosition === 'after' ? 'drop-target-after' : ''} {draggedItemIndex === secGlobalIndex ? 'is-dragging' : ''}"
                draggable="true"
                ondragstart={(e) => handleDragStart(e, secGlobalIndex)}
                ondragover={(e) => handleDragOver(e, secGlobalIndex)}
                ondragleave={handleDragLeave}
                ondrop={(e) => handleDrop(e, secGlobalIndex)}
                ondragend={handleDragEnd}
              >
                <button
                  type="button"
                  class="section-toggle-btn"
                  onclick={() => handleToggleSectionCollapse(sec.id)}
                  title={sec.isCollapsed ? 'Bentangkan kategori' : 'Lipat kategori'}
                >
                  <ChevronDown size={11} class="section-chevron {sec.isCollapsed ? 'collapsed' : ''}" />
                  <span class="section-title">{sec.name}</span>
                  <span class="section-count mono-nums">{group.items.length}</span>
                </button>

                <div class="section-menu-wrapper">
                  <button
                    type="button"
                    class="btn-section-menu {activeSectionMenuId === sec.id ? 'active' : ''}"
                    onclick={(e) => {
                      e.stopPropagation();
                      activeSectionMenuId = activeSectionMenuId === sec.id ? null : sec.id;
                    }}
                    title="Opsi kategori"
                  >
                    <MoreHorizontal size={12} />
                  </button>

                  {#if activeSectionMenuId === sec.id}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="section-menu-backdrop" onclick={() => (activeSectionMenuId = null)}></div>
                    <div class="section-dropdown-menu">
                      <button
                        type="button"
                        class="section-menu-item"
                        onclick={(e) => openRenameSection(sec, e)}
                      >
                        <Pencil size={11} />
                        <span>Ganti Nama Kategori</span>
                      </button>
                      <button
                        type="button"
                        class="section-menu-item danger"
                        onclick={(e) => handleDeleteSection(sec.id, e)}
                      >
                        <Trash2 size={11} />
                        <span>Hapus Kategori (Simpan Koin)</span>
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            {#if !group.section || !group.section.isCollapsed}
              {#each group.items as sym (sym)}
                {@const symGlobalIndex = symbols.indexOf(sym)}
                {@const entry = parseWatchlistEntry(sym)}
                {@const p = parseAdaptiveSymbol(entry.symbol)}
                {@const ticker = tickerMap[sym] || tickerMap[entry.symbol]}
                {@const isBull = (ticker?.change24h ?? 0) >= 0}
                {@const isCurrentActive = activeSymbol === entry.symbol && activeProviderId === entry.providerId}
                <div
                  class="watchlist-row {isCurrentActive ? 'active-row' : ''} {dragOverItemIndex === symGlobalIndex && dragOverPosition === 'before' ? 'drop-target-before' : ''} {dragOverItemIndex === symGlobalIndex && dragOverPosition === 'after' ? 'drop-target-after' : ''} {draggedItemIndex === symGlobalIndex ? 'is-dragging' : ''}"
                  draggable="true"
                  ondragstart={(e) => handleDragStart(e, symGlobalIndex)}
                  ondragover={(e) => handleDragOver(e, symGlobalIndex)}
                  ondragleave={handleDragLeave}
                  ondrop={(e) => handleDrop(e, symGlobalIndex)}
                  ondragend={handleDragEnd}
                  oncontextmenu={(e) => {
                    e.preventDefault();
                    activeCoinMenuSymbol = activeCoinMenuSymbol === sym ? null : sym;
                  }}
                >
                  <button
                    type="button"
                    class="row-select-btn"
                    onclick={() => handleSelectSymbol(sym)}
                  >
                    <div class="row-symbol">
                      <span class="row-drag-handle" title="Tarik untuk menata ulang urutan">
                        <GripVertical size={10} />
                      </span>
                      <span class="status-pip {isBull ? 'pip-bull' : 'pip-bear'}"></span>
                      <SymbolLogo baseAsset={p.baseAsset} quoteAsset={p.quoteAsset} size="sm" />
                      <span class="symbol-name">{p.baseAsset}</span>
                      <span class="venue-badge {entry.providerId} mono-nums">{entry.providerId.toUpperCase()}</span>
                      {#if entry.symbol.endsWith('.P')}
                        <span class="type-tag perp mono-nums">.P</span>
                      {:else if entry.symbol.endsWith('IDR')}
                        <span class="type-tag idr mono-nums">IDR</span>
                      {:else if p.quoteAsset && p.quoteAsset !== 'USDT'}
                        <span class="type-tag spot mono-nums">{p.quoteAsset}</span>
                      {:else}
                        <span class="type-tag spot mono-nums">SPOT</span>
                      {/if}
                    </div>

                    <div class="row-price mono-nums">
                      {formatPrice(ticker?.price, entry.symbol)}
                    </div>

                    <div class="row-change mono-nums">
                      {#if ticker?.change24h !== undefined}
                        <span class="change-pill {isBull ? 'pill-bull' : 'pill-bear'}">
                          {#if isBull}+{/if}{ticker.change24h.toFixed(2)}%
                        </span>
                      {:else}
                        <span class="change-placeholder">--</span>
                      {/if}
                    </div>
                  </button>

                  <div class="coin-row-actions">
                    <!-- Tombol Opsi Koin / Pindahkan Kategori -->
                    <div class="coin-menu-wrapper">
                      <button
                        type="button"
                        class="btn-coin-menu {activeCoinMenuSymbol === sym ? 'active' : ''}"
                        title="Pindahkan koin ke kategori..."
                        onclick={(e) => {
                          e.stopPropagation();
                          activeCoinMenuSymbol = activeCoinMenuSymbol === sym ? null : sym;
                        }}
                      >
                        <MoreHorizontal size={11} />
                      </button>

                      {#if activeCoinMenuSymbol === sym}
                        {@const currentSecId = getSectionIdForSymbol(sym)}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div class="coin-menu-backdrop" onclick={(e) => { e.stopPropagation(); activeCoinMenuSymbol = null; }}></div>
                        <div class="coin-dropdown-menu" role="menu">
                          <div class="coin-dropdown-header">Pindahkan ke Kategori:</div>
                          <button
                            type="button"
                            class="coin-menu-item {currentSecId === null ? 'current' : ''}"
                            onclick={(e) => {
                              e.stopPropagation();
                              handleMoveSymbolToSection(sym, null);
                            }}
                          >
                            <Folder size={11} />
                            <span class="menu-label">Tanpa Kategori (Bagian Atas)</span>
                            {#if currentSecId === null}
                              <Check size={11} class="menu-check" />
                            {/if}
                          </button>

                          {#each availableSections as avSec (avSec.id)}
                            <button
                              type="button"
                              class="coin-menu-item {currentSecId === avSec.id ? 'current' : ''}"
                              onclick={(e) => {
                                e.stopPropagation();
                                handleMoveSymbolToSection(sym, avSec.id);
                              }}
                            >
                              <Folder size={11} />
                              <span class="menu-label">{avSec.name}</span>
                              {#if currentSecId === avSec.id}
                                <Check size={11} class="menu-check" />
                              {/if}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>

                    <!-- Tombol Hapus Koin -->
                    <button
                      type="button"
                      class="delete-item-btn"
                      title="Hapus dari watchlist"
                      onclick={(e) => handleRemoveSymbol(e, sym)}
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          {/each}

          {#if symbols.filter((s) => !isSectionToken(s)).length === 0}
            <div class="empty-state">
              <span>Daftar pantau kosong. Tambahkan koin dengan tombol + di atas.</span>
            </div>
          {/if}
        {/if}

      </div>

    <!-- TAB 2: PRICE ALERTS -->
    {:else if activeTab === 'alerts'}
      <div class="sub-toolbar alert-sub-toolbar">
        <div class="alert-filter-tabs">
          <button
            type="button"
            class="filter-pill {alertFilterMode === 'all' ? 'active' : ''}"
            onclick={() => (alertFilterMode = 'all')}
          >
            Semua ({alerts.length})
          </button>
          <button
            type="button"
            class="filter-pill {alertFilterMode === 'current' ? 'active' : ''}"
            onclick={() => (alertFilterMode = 'current')}
          >
            {activeSymbol.replace('USDT', '').replace('.P', '')} ({displayAlerts.length})
          </button>
        </div>

        <button
          type="button"
          class="add-symbol-btn {showAddAlert ? 'active' : ''}"
          title="Buat Price Alert Baru"
          onclick={handleTriggerOpenCreateAlert}
        >
          <Plus size={13} />
          <span>Alert</span>
        </button>
      </div>

      {#if showAddAlert}
        <form class="alert-form" onsubmit={handleCreateAlert}>
          <div class="alert-input-group">
            <input
              type="number"
              step="any"
              placeholder="Target harga (e.g. 69500)..."
              bind:value={newAlertPrice}
              class="add-input mono-nums"
              required
            />
            <input
              type="text"
              placeholder="Catatan / Label..."
              bind:value={newAlertLabel}
              class="add-input"
            />
          </div>
          <button type="submit" class="submit-add-btn">Set Alert</button>
        </form>
      {/if}

      <div class="items-list alerts-list">
        {#each displayAlerts as a (a.id)}
          {@const condBadge = getConditionBadge(a.condition)}
          {@const distance = calculateAlertDistance(a.targetPrice, a.symbol)}
          <div class="alert-card {a.triggered ? 'triggered' : ''} {!a.active ? 'paused' : ''}">
            <div class="alert-main">
              <!-- Baris Atas: Simbol, Badge Kondisi, & Status -->
              <div class="alert-top">
                <button
                  type="button"
                  class="alert-sym-btn mono-nums"
                  title="Beralih grafik ke simbol {a.symbol}"
                  onclick={() => onSelectSymbol(a.symbol)}
                >
                  <span class="sym-txt">{a.symbol}</span>
                </button>

                <span class="badge-cond {condBadge.class}">
                  {condBadge.label}
                </span>

                {#if a.triggered}
                  <span class="badge-alert triggered">TRIGGERED</span>
                {:else if !a.active}
                  <span class="badge-alert paused">PAUSED</span>
                {:else}
                  <span class="badge-alert active">ACTIVE</span>
                {/if}
              </div>

              <!-- Baris Tengah: Target Price & Selisih Jarak -->
              <div class="alert-price-row mono-nums">
                <span class="target-val">${formatPrice(a.targetPrice)}</span>
                {#if distance && a.active && !a.triggered}
                  <span class="distance-pill {distance.isBull ? 'pill-bull' : 'pill-bear'}">
                    {distance.pctText} ({distance.diffText})
                  </span>
                {:else if a.triggered && a.triggeredPrice}
                  <span class="hit-pill">
                    Hit @ ${formatPrice(a.triggeredPrice)}
                  </span>
                {/if}
              </div>

              <!-- Baris Bawah: Catatan Label -->
              {#if a.label}
                <span class="alert-label">{a.label}</span>
              {/if}
            </div>

            <!-- Tombol Aksi Kontrol Alert -->
            <div class="alert-actions">
              {#if a.triggered}
                <button
                  type="button"
                  class="icon-alert-btn reset"
                  title="Aktifkan kembali alert ini"
                  onclick={() => handleResetAlert(a.id)}
                >
                  <RotateCcw size={12} />
                </button>
              {:else}
                <button
                  type="button"
                  class="icon-alert-btn toggle {a.active ? 'active' : ''}"
                  title={a.active ? 'Jeda alert ini' : 'Aktifkan alert ini'}
                  onclick={() => handleToggleAlert(a.id)}
                >
                  {#if a.active}
                    <Pause size={12} />
                  {:else}
                    <Play size={12} />
                  {/if}
                </button>
              {/if}

              <button
                type="button"
                class="icon-alert-btn edit"
                title="Sunting Alert Ini (Ubah Target & Kondisi)"
                onclick={() => onRequestEditAlert?.(a)}
              >
                <Pencil size={12} />
              </button>

              <button
                type="button"
                class="icon-alert-btn delete"
                title="Hapus Price Alert ini"
                onclick={() => handleRemoveAlert(a.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        {/each}

        {#if displayAlerts.length === 0}
          <div class="empty-state alert-empty">
            <span class="empty-icon"><Bell size={24} /></span>
            <span class="empty-title">Belum ada Price Alert</span>
            <p class="empty-sub">
              Klik kanan pada grafik di harga mana pun untuk membuat alert instan, atau klik tombol <strong>+ Alert</strong> di atas.
            </p>
          </div>
        {/if}
      </div>

    <!-- TAB 3: UNIFIED OBJECT TREE & INDICATOR LAYERS -->
    {:else if activeTab === 'objects'}
      <div class="sub-toolbar">
        <span class="sub-title">Unified Object Tree</span>
        <span class="layer-count mono-nums">{totalIndicatorsCount + activeDrawings.length} Total</span>
      </div>

      <div class="items-list objects-list">
        <!-- 1. GRUP INDIKATOR AKTIF -->
        <div class="tree-group">
          <div
            class="tree-group-header"
            role="button"
            tabindex="0"
            onclick={() => (isIndicatorsGroupOpen = !isIndicatorsGroupOpen)}
            onkeydown={(e) => e.key === 'Enter' && (isIndicatorsGroupOpen = !isIndicatorsGroupOpen)}
          >
            <div class="tree-group-title">
              <span class="chevron-icon">
                {#if isIndicatorsGroupOpen}
                  <ChevronDown size={13} />
                {:else}
                  <ChevronRight size={13} />
                {/if}
              </span>
              <span>Indikator</span>
              <span class="group-count mono-nums">{totalIndicatorsCount}</span>
            </div>
          </div>

          {#if isIndicatorsGroupOpen}
            <div class="tree-group-content">
              <!-- Layer Native Volume Overlay (Bawaan WebGL Engine) -->
              <div class="layer-item">
                <div class="layer-info">
                  <span class="layer-icon"><Layers size={13} /></span>
                  <span class="layer-name" title="Volume (Native Overlay)">Volume (Native Overlay)</span>
                </div>

                <div class="layer-actions">
                  <button
                    class="icon-action-btn {showVolume ? 'visible' : 'hidden'}"
                    title={showVolume ? 'Sembunyikan Volume' : 'Tampilkan Volume'}
                    onclick={() => onToggleVolumeVisibility?.()}
                  >
                    {#if showVolume}
                      <Eye size={12} />
                    {:else}
                      <EyeOff size={12} />
                    {/if}
                  </button>
                </div>
              </div>

              {#each activeIndicators as ind (ind.id)}
                <div class="layer-item">
                  <div class="layer-info">
                    <span class="layer-icon"><Layers size={13} /></span>
                    <span class="layer-name" title={ind.title}>{ind.title}</span>
                  </div>

                  <div class="layer-actions">
                    <button
                      class="icon-action-btn"
                      title="Pengaturan Parameter Indikator"
                      onclick={() => onConfigureIndicator?.(ind.id)}
                    >
                      <Settings size={12} />
                    </button>

                    {#if ind.source || ind.id.includes('pine')}
                      <button
                        class="icon-action-btn pine-btn"
                        title="Buka Skrip di Pine IDE"
                        onclick={() => onOpenIndicatorInPine?.(ind.id, ind.source)}
                      >
                        <Code size={12} />
                      </button>
                    {/if}

                    <button
                      class="icon-action-btn {ind.visible ? 'visible' : 'hidden'}"
                      title={ind.visible ? 'Sembunyikan' : 'Tampilkan'}
                      onclick={() => onToggleIndicatorVisibility?.(ind.id)}
                    >
                      {#if ind.visible}
                        <Eye size={12} />
                      {:else}
                        <EyeOff size={12} />
                      {/if}
                    </button>

                    <button
                      class="icon-action-btn delete"
                      title="Hapus Indikator"
                      onclick={() => onRemoveIndicator?.(ind.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              {/each}

              {#if activeIndicators.length === 0 && !showVolume}
                <div class="empty-subgroup">
                  <span>Tidak ada indikator aktif</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- 2. GRUP OBJEK GAMBAR (DRAWINGS) -->
        <div class="tree-group">
          <div class="tree-group-header">
            <div
              class="tree-group-title clickable"
              role="button"
              tabindex="0"
              onclick={() => (isDrawingsGroupOpen = !isDrawingsGroupOpen)}
              onkeydown={(e) => e.key === 'Enter' && (isDrawingsGroupOpen = !isDrawingsGroupOpen)}
            >
              <span class="chevron-icon">
                {#if isDrawingsGroupOpen}
                  <ChevronDown size={13} />
                {:else}
                  <ChevronRight size={13} />
                {/if}
              </span>
              <span>Objek Gambar</span>
              <span class="group-count mono-nums">{activeDrawings.length}</span>
            </div>

            <!-- Tombol Aksi Massal Objek Gambar -->
            <div class="group-bulk-actions">
              <button
                class="bulk-action-btn"
                title="Sembunyikan / Tampilkan Semua Gambar"
                onclick={(e) => {
                  e.stopPropagation();
                  onBulkHideDrawings?.(activeDrawings.some((d) => d.visible !== false));
                }}
              >
                <Eye size={11} />
              </button>
              <button
                class="bulk-action-btn"
                title="Kunci / Buka Semua Gambar"
                onclick={(e) => {
                  e.stopPropagation();
                  onBulkLockDrawings?.(activeDrawings.some((d) => !d.locked));
                }}
              >
                <Lock size={11} />
              </button>
              <button
                class="bulk-action-btn delete"
                title="Hapus Semua Gambar"
                onclick={(e) => {
                  e.stopPropagation();
                  onBulkDeleteDrawings?.();
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          {#if isDrawingsGroupOpen}
            <div class="tree-group-content">
              {#each activeDrawings as drawing (drawing.id)}
                {@const meta = getDrawingMeta(drawing)}
                {@const isSelected = selectedDrawingId === drawing.id}
                {@const isVisible = drawing.visible !== false}
                {@const isLocked = drawing.locked === true}
                {@const IconComp = meta.icon}
                <div
                  class="layer-item drawing-item {isSelected ? 'selected' : ''}"
                  use:scrollIntoViewIfSelected={isSelected}
                  role="button"
                  tabindex="0"
                  onclick={() => onSelectDrawing?.(drawing.id)}
                  onkeydown={(e) => e.key === 'Enter' && onSelectDrawing?.(drawing.id)}
                >
                  <div class="layer-info">
                    <span class="layer-icon drawing-icon">
                      <IconComp size={13} />
                    </span>
                    <div class="drawing-labels">
                      <span class="layer-name">{meta.title}</span>
                      {#if meta.subtitle}
                        <span class="layer-sub mono-nums">{meta.subtitle}</span>
                      {/if}
                    </div>
                  </div>

                  <div class="layer-actions" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
                    <button
                      class="icon-action-btn {isVisible ? 'visible' : 'hidden'}"
                      title={isVisible ? 'Sembunyikan Objek' : 'Tampilkan Objek'}
                      onclick={() => onToggleDrawingVisibility?.(drawing.id)}
                    >
                      {#if isVisible}
                        <Eye size={12} />
                      {:else}
                        <EyeOff size={12} />
                      {/if}
                    </button>

                    <button
                      class="icon-action-btn {isLocked ? 'locked' : ''}"
                      title={isLocked ? 'Buka Kunci Objek' : 'Kunci Objek'}
                      onclick={() => onToggleDrawingLock?.(drawing.id)}
                    >
                      {#if isLocked}
                        <Lock size={12} />
                      {:else}
                        <Unlock size={12} />
                      {/if}
                    </button>

                    <button
                      class="icon-action-btn delete"
                      title="Hapus Objek Gambar"
                      onclick={() => onRemoveDrawing?.(drawing.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              {/each}

              {#if activeDrawings.length === 0}
                <div class="empty-subgroup">
                  <span>Belum ada coretan gambar pada pair ini</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </aside>
{/if}

<SymbolSearchModal
  isOpen={isSymbolSearchOpen}
  activeSymbol={activeSymbol}
  activeProviderId={activeProviderId}
  watchlistSymbols={symbols}
  onSelectSymbol={onSelectSymbol}
  onToggleWatchlistSymbol={handleToggleSymbolFromSearch}
  onClose={() => (isSymbolSearchOpen = false)}
/>

<!-- Modal Tambah Kategori / Section -->
{#if showAddSectionModal}
  <div class="modal-backdrop">
    <div class="switcher-modal obsidian-modal">
      <div class="modal-header">
        <span>Tambah Kategori Watchlist</span>
        <button type="button" class="btn-close-modal" onclick={() => (showAddSectionModal = false)}>
          <X size={13} />
        </button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); handleAddSectionSubmit(); }}>
        <div class="modal-body">
          <label class="modal-label" for="add-section-name">Nama Kategori / Section</label>
          <input
            id="add-section-name"
            type="text"
            class="modal-input"
            placeholder="e.g. DEFI, LAYER 1, MEMECOIN"
            bind:value={newSectionName}
          />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-modal-cancel" onclick={() => (showAddSectionModal = false)}>
            Batal
          </button>
          <button type="submit" class="btn-modal-submit" disabled={!newSectionName.trim()}>
            Simpan
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal Ganti Nama Kategori / Section -->
{#if showRenameSectionModal}
  <div class="modal-backdrop">
    <div class="switcher-modal obsidian-modal">
      <div class="modal-header">
        <span>Ganti Nama Kategori</span>
        <button type="button" class="btn-close-modal" onclick={() => { showRenameSectionModal = false; renameSectionId = null; }}>
          <X size={13} />
        </button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); handleRenameSectionSubmit(); }}>
        <div class="modal-body">
          <label class="modal-label" for="rename-section-name">Nama Baru Kategori</label>
          <input
            id="rename-section-name"
            type="text"
            class="modal-input"
            placeholder="Nama kategori baru"
            bind:value={renameSectionValue}
          />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-modal-cancel" onclick={() => { showRenameSectionModal = false; renameSectionId = null; }}>
            Batal
          </button>
          <button type="submit" class="btn-modal-submit" disabled={!renameSectionValue.trim()}>
            Simpan
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .collapsed-toggle-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 35;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-right: none;
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    padding: 10px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--text-muted);
    transition: all 0.15s ease;
  }

  .collapsed-toggle-btn:hover {
    color: var(--brand-primary);
    background-color: var(--bg-hover);
  }

  .vertical-label {
    writing-mode: vertical-lr;
    transform: rotate(180deg);
    font-size: var(--font-size-xs, 9px);
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .right-panel {
    width: 300px;
    height: 100%;
    background-color: var(--bg-surface);
    border-left: 1px solid var(--border-hairline);
    display: flex;
    flex-direction: column;
    z-index: 30;
    flex-shrink: 0;
    overflow: hidden;
  }

  /* Header & Tabs */
  .panel-header {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
    flex-shrink: 0;
  }

  .panel-tabs {
    display: flex;
    gap: 2px;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 7px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-size-base, 11px);
    font-weight: 500;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .tab-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .tab-btn.active {
    color: var(--brand-primary);
    background-color: var(--bg-base);
    font-weight: 600;
  }

  .count-pill {
    font-size: var(--font-size-xs, 9px);
    background-color: var(--bg-container);
    color: var(--text-dim);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .tab-btn.active .count-pill {
    background-color: rgba(0, 240, 144, 0.15);
    color: var(--brand-primary);
  }

  .collapse-action-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    padding: 4px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .collapse-action-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  /* Sub Toolbar */
  .sub-toolbar {
    padding: 6px 8px;
    background-color: var(--bg-base);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-shrink: 0;
  }

  .sub-title {
    font-size: var(--font-size-base, 11px);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .layer-count {
    font-size: var(--font-size-sm, 10px);
    color: var(--text-dim);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    padding: 3px 6px;
    flex: 1;
  }

  .search-icon {
    color: var(--text-dim);
  }

  .search-input {
    background: none;
    border: none;
    color: var(--text-main);
    font-size: var(--font-size-base, 11px);
    width: 100%;
    outline: none;
  }

  .clear-search-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 0;
  }

  .symbol-search-trigger-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: var(--radius-xs);
    color: #60a5fa;
    font-size: var(--font-size-sm, 10px);
    font-weight: 600;
    padding: 3px 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .symbol-search-trigger-btn:hover {
    background-color: rgba(59, 130, 246, 0.22);
    border-color: #60a5fa;
    color: #93c5fd;
  }

  .add-symbol-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--brand-primary);
    font-size: var(--font-size-base, 11px);
    font-weight: 600;
    padding: 3px 6px;
    cursor: pointer;
  }

  .add-symbol-btn:hover,
  .add-symbol-btn.active {
    background-color: rgba(0, 240, 144, 0.12);
    border-color: var(--brand-primary);
  }

  .add-form, .alert-form {
    padding: 6px 8px;
    background-color: var(--bg-panel);
    border-bottom: 1px solid var(--border-hairline);
    display: flex;
    gap: 6px;
  }

  .alert-input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .add-input {
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-main);
    font-size: var(--font-size-base, 11px);
    padding: 4px 6px;
    outline: none;
  }

  .add-input:focus {
    border-color: var(--border-focus);
  }

  .submit-add-btn {
    background-color: var(--brand-primary);
    color: var(--bg-darkest);
    border: none;
    border-radius: var(--radius-xs);
    font-size: var(--font-size-sm, 10px);
    font-weight: 700;
    padding: 0 8px;
    cursor: pointer;
  }

  /* Table Head */
  .table-head {
    display: grid;
    grid-template-columns: 100px 1fr 65px;
    padding: 4px 8px;
    background-color: var(--bg-container);
    border-bottom: 1px solid var(--border-hairline);
    font-size: var(--font-size-sm, 10px);
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .col-symbol-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .active-feed-pill {
    font-size: var(--font-size-2xs, 8px);
    font-weight: 700;
    padding: 1px 3px;
    border-radius: 2px;
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-muted);
    border: 1px solid var(--border-hairline);
    letter-spacing: 0.05em;
  }

  .col-price {
    text-align: right;
    padding-right: 8px;
  }

  .col-change {
    text-align: right;
  }

  /* Items List */
  .items-list {
    flex: 1;
    overflow-y: auto;
    background-color: var(--bg-surface);
  }

  .watchlist-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid rgba(30, 41, 59, 0.4);
    position: relative;
  }

  .watchlist-row:hover {
    background-color: var(--bg-hover);
  }

  .watchlist-row.active-row {
    background-color: rgba(59, 130, 246, 0.08);
    border-left: 2px solid var(--brand-blue);
  }

  .row-select-btn {
    display: grid;
    grid-template-columns: 100px 1fr 65px;
    align-items: center;
    padding: 5px 8px;
    background: none;
    border: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }

  .row-symbol {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-pip {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }

  .pip-bull {
    background-color: var(--bull-color);
  }

  .pip-bear {
    background-color: var(--bear-color);
  }

  .symbol-name {
    font-size: var(--font-size-base, 11px);
    font-weight: 600;
    color: var(--text-main);
  }

  .type-tag {
    font-size: var(--font-size-2xs, 8px);
    font-weight: 700;
    padding: 1px 3px;
    border-radius: 2px;
    letter-spacing: 0.04em;
    line-height: 1;
  }



  .type-tag.perp {
    background-color: rgba(234, 179, 8, 0.15);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }

  .type-tag.idr {
    background-color: rgba(37, 99, 235, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(37, 99, 235, 0.3);
  }

  .type-tag.spot {
    background-color: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .venue-badge {
    font-size: var(--font-size-2xs, 8px);
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 2px;
    letter-spacing: 0.05em;
    line-height: 1;
    text-transform: uppercase;
  }

  .venue-badge.binance {
    background-color: rgba(240, 185, 11, 0.15);
    color: #f0b90b;
    border: 1px solid rgba(240, 185, 11, 0.3);
  }

  .venue-badge.bitunix {
    background-color: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .venue-badge.indodax {
    background-color: rgba(37, 99, 235, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(37, 99, 235, 0.3);
  }

  .venue-badge.hyperliquid {
    background-color: rgba(20, 184, 166, 0.15);
    color: #2dd4bf;
    border: 1px solid rgba(20, 184, 166, 0.3);
  }

  .venue-badge.coinbase {
    background-color: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .row-price {
    font-size: var(--font-size-base, 11px);
    color: var(--text-main);
    text-align: right;
    padding-right: 8px;
  }

  .row-change {
    text-align: right;
  }

  .change-pill {
    display: inline-block;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
    font-size: var(--font-size-sm, 10px);
    font-weight: 600;
  }

  .pill-bull {
    color: var(--bull-color);
    background-color: rgba(0, 240, 144, 0.1);
  }

  .pill-bear {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.1);
  }

  /* ─── Drag & Drop Visual Indicators ─── */
  .row-drag-handle {
    opacity: 0;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    cursor: grab;
    transition: opacity 0.12s ease;
    margin-right: -2px;
  }

  .watchlist-row:hover .row-drag-handle {
    opacity: 0.6;
  }

  .row-drag-handle:hover {
    opacity: 1 !important;
    color: var(--text-main);
  }

  .watchlist-row.drop-target-before,
  .section-divider-row.drop-target-before {
    border-top: 2px solid var(--brand-primary) !important;
  }

  .watchlist-row.drop-target-after,
  .section-divider-row.drop-target-after {
    border-bottom: 2px solid var(--brand-primary) !important;
  }

  .watchlist-row.is-dragging,
  .section-divider-row.is-dragging {
    opacity: 0.35 !important;
    background-color: rgba(255, 255, 255, 0.05);
  }

  /* ─── Coin Row Actions & Context Menu ─── */
  .coin-row-actions {
    opacity: 0;
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 3px;
    transition: all 0.15s ease;
  }

  .watchlist-row:hover .coin-row-actions {
    opacity: 1;
  }

  .coin-menu-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .btn-coin-menu {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    cursor: pointer;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: all 0.15s ease;
  }

  .btn-coin-menu:hover,
  .btn-coin-menu.active {
    color: var(--text-main);
    background-color: var(--bg-hover);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .coin-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 110;
  }

  .coin-dropdown-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 111;
    min-width: 190px;
    background-color: #181818;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .coin-dropdown-header {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim);
    padding: 4px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 2px;
  }

  .coin-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 5px 8px;
    background: none;
    border: none;
    border-radius: 4px;
    color: #e5e5e5;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    width: 100%;
    transition: all 0.1s ease;
  }

  .coin-menu-item:hover {
    background-color: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .coin-menu-item.current {
    color: var(--brand-primary);
    font-weight: 600;
  }

  .menu-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.menu-check) {
    color: var(--brand-primary);
    flex-shrink: 0;
  }

  .delete-item-btn {
    opacity: 0;
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    cursor: pointer;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: all 0.15s ease;
  }

  .coin-row-actions .delete-item-btn {
    position: static;
    transform: none;
    opacity: 1;
  }

  .watchlist-row:hover .delete-item-btn {
    opacity: 1;
  }

  .delete-item-btn:hover {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.18);
    border-color: rgba(255, 59, 105, 0.4);
  }

  /* ─── Omni-Search Watchlist Styles (Tiket #24) ─── */
  .omni-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    background-color: rgba(15, 23, 42, 0.7);
    border-bottom: 1px solid var(--border-hairline);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .omni-section-header.exchange-header {
    background-color: rgba(14, 116, 144, 0.12);
    border-top: 1px solid rgba(14, 116, 144, 0.3);
    border-bottom: 1px solid rgba(14, 116, 144, 0.3);
    color: #38bdf8;
  }

  .omni-header-left {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .omni-loading-pip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    color: #38bdf8;
    text-transform: none;
  }

  .watchlist-row.exchange-row .row-select-btn {
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .symbol-quote {
    font-size: 10px;
    color: var(--text-dim);
  }

  .exchange-venue-desc {
    font-size: 10px;
    color: var(--text-dim);
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 28px;
  }

  .add-exchange-btn {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border-radius: var(--radius-xs);
    background-color: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    z-index: 5;
    padding: 0;
  }

  .add-exchange-btn:hover:not(:disabled) {
    background-color: #2563eb;
    border-color: #3b82f6;
    color: #ffffff;
    box-shadow: 0 0 8px rgba(37, 99, 235, 0.4);
  }

  .add-exchange-btn.already-added {
    background-color: rgba(0, 240, 144, 0.12);
    border-color: rgba(0, 240, 144, 0.3);
    color: var(--brand-primary);
    cursor: default;
    opacity: 0.8;
  }

  .watchlist-row.omni-highlighted {
    background-color: rgba(59, 130, 246, 0.14) !important;
    border-left: 2px solid #38bdf8 !important;
  }

  .omni-empty {
    padding: 24px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    color: var(--text-dim);
  }

  .btn-open-global-search {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background-color: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.35);
    border-radius: var(--radius-xs);
    color: #60a5fa;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-open-global-search:hover {
    background-color: rgba(59, 130, 246, 0.25);
    border-color: #60a5fa;
    color: #93c5fd;
  }

  .spin {
    animation: spin-anim 1s linear infinite;
  }

  @keyframes spin-anim {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Alerts Sub Toolbar & Filters */
  .alert-sub-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    background-color: var(--bg-base);
    border-bottom: 1px solid var(--border-hairline);
  }

  .alert-filter-tabs {
    display: flex;
    gap: 3px;
  }

  .filter-pill {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    font-size: 10px;
    padding: 2px 6px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .filter-pill:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .filter-pill.active {
    color: var(--brand-cyan);
    background-color: rgba(56, 189, 248, 0.12);
    border-color: rgba(56, 189, 248, 0.25);
    font-weight: 600;
  }

  /* Alerts List */
  .alerts-list {
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .alert-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 8px 10px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    position: relative;
    transition: all 0.15s ease;
  }

  .alert-card:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-medium);
  }

  .alert-card.triggered {
    border-color: rgba(255, 59, 105, 0.45);
    background-color: rgba(255, 59, 105, 0.06);
    box-shadow: 0 0 10px var(--bear-glow);
  }

  .alert-card.paused {
    opacity: 0.6;
    border-style: dashed;
  }

  .alert-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .alert-top {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .alert-sym-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
    display: inline-flex;
    align-items: center;
  }

  .alert-sym-btn:hover .sym-txt {
    color: var(--brand-primary);
    text-decoration: underline;
  }

  .badge-cond {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .badge-cond.bull {
    background-color: rgba(0, 240, 144, 0.12);
    color: var(--bull-color);
  }

  .badge-cond.bear {
    background-color: rgba(255, 59, 105, 0.12);
    color: var(--bear-color);
  }

  .badge-cond.cyan {
    background-color: rgba(56, 189, 248, 0.12);
    color: var(--brand-cyan);
  }

  .badge-cond.muted {
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-dim);
  }

  .badge-alert {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .badge-alert.active {
    background-color: rgba(0, 240, 144, 0.15);
    color: var(--brand-primary);
  }

  .badge-alert.triggered {
    background-color: rgba(255, 59, 105, 0.2);
    color: var(--bear-color);
    animation: pulseTrigger 1.5s infinite;
  }

  @keyframes pulseTrigger {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .badge-alert.paused {
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--text-dim);
  }

  .alert-price-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .target-val {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
  }

  .distance-pill {
    font-size: 9.5px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .hit-pill {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--bull-color);
    background-color: rgba(0, 240, 144, 0.1);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .alert-label {
    font-size: 10px;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .alert-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: 6px;
  }

  .icon-alert-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .icon-alert-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .icon-alert-btn.toggle.active:hover {
    color: #eab308;
    background-color: rgba(234, 179, 8, 0.15);
  }

  .icon-alert-btn.reset:hover {
    color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.15);
  }

  .icon-alert-btn.delete:hover {
    color: var(--bear-color);
    background-color: rgba(255, 59, 105, 0.15);
  }

  .alert-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 30px 14px;
  }

  .empty-icon {
    color: var(--text-dim);
    opacity: 0.5;
  }

  .empty-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .empty-sub {
    font-size: 10px;
    color: var(--text-dim);
    line-height: 1.4;
    text-align: center;
  }

  /* Layer Objects */
  /* Unified Object Tree */
  .objects-list {
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
  }

  .tree-group {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .tree-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background-color: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--border-hairline);
    user-select: none;
  }

  .tree-group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main);
  }

  .tree-group-title.clickable {
    cursor: pointer;
  }

  .chevron-icon {
    display: flex;
    align-items: center;
    color: var(--text-dim);
  }

  .group-count {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-dim);
  }

  .group-bulk-actions {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .bulk-action-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    padding: 2px 4px;
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .bulk-action-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .bulk-action-btn.delete:hover {
    color: var(--bear-color);
  }

  .tree-group-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px;
  }

  .layer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    background-color: var(--bg-base);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    transition: all 0.12s ease;
  }

  .layer-item.drawing-item {
    cursor: pointer;
  }

  .layer-item.drawing-item:hover {
    background-color: var(--bg-hover);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .layer-item.drawing-item.selected {
    background-color: rgba(0, 240, 144, 0.08);
    border-color: rgba(0, 240, 144, 0.4);
  }

  .layer-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .layer-icon {
    display: flex;
    align-items: center;
    color: var(--brand-primary);
    flex-shrink: 0;
  }

  .drawing-icon {
    color: #60a5fa;
  }

  .drawing-labels {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .layer-name {
    font-size: 11px;
    color: var(--text-main);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-sub {
    font-size: 9px;
    color: var(--text-dim);
    line-height: 1;
  }

  .layer-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .icon-action-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    padding: 3px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .icon-action-btn:hover {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .icon-action-btn.pine-btn:hover {
    color: #a855f7;
    background-color: rgba(168, 85, 247, 0.15);
  }

  .icon-action-btn.locked {
    color: #eab308;
  }

  .icon-action-btn.delete:hover {
    color: var(--bear-color);
  }

  .empty-subgroup {
    padding: 12px 8px;
    text-align: center;
    font-size: 10px;
    color: var(--text-dim);
    font-style: italic;
  }

  .empty-state {
    padding: 24px 12px;
    text-align: center;
    font-size: 11px;
    color: var(--text-dim);
  }

  /* Add Section Button in Toolbar */
  .add-section-toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-container);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-xs);
    color: var(--text-dim);
    padding: 3px 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-section-toolbar-btn:hover {
    color: var(--brand-primary);
    background-color: rgba(0, 240, 144, 0.12);
    border-color: var(--brand-primary);
  }

  /* Section Divider Row */
  .section-divider-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background-color: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;
    user-select: none;
    transition: background-color 0.12s ease;
  }

  .section-divider-row:hover {
    background-color: rgba(255, 255, 255, 0.04);
  }

  .section-divider-row.collapsed {
    opacity: 0.8;
  }

  .section-toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    padding: 0;
    flex: 1;
    text-align: left;
    transition: color 0.12s ease;
  }

  .section-toggle-btn:hover {
    color: var(--text-main);
  }

  :global(.section-chevron) {
    color: var(--text-dim);
    transition: transform 0.15s ease;
  }

  :global(.section-chevron.collapsed) {
    transform: rotate(-90deg);
  }

  .section-title {
    color: var(--text-muted);
  }

  .section-toggle-btn:hover .section-title {
    color: var(--text-main);
  }

  .section-count {
    font-size: 9px;
    color: var(--text-dim);
    background-color: rgba(255, 255, 255, 0.06);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .section-menu-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .btn-section-menu {
    background: none;
    border: none;
    color: var(--text-dim);
    padding: 2px 4px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
    opacity: 0.6;
  }

  .section-divider-row:hover .btn-section-menu,
  .btn-section-menu.active {
    opacity: 1;
  }

  .btn-section-menu:hover,
  .btn-section-menu.active {
    color: var(--text-main);
    background-color: var(--bg-hover);
  }

  .section-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
  }

  .section-dropdown-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 101;
    min-width: 170px;
    background-color: #181818;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-menu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background: none;
    border: none;
    border-radius: 4px;
    color: #e5e5e5;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    width: 100%;
    transition: all 0.1s ease;
  }

  .section-menu-item:hover {
    background-color: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .section-menu-item.danger {
    color: #f87171;
  }

  .section-menu-item.danger:hover {
    background-color: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
  }

  /* Modal Backdrop & Shared Modal Classes for WatchlistPanel */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
    z-index: 1050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .switcher-modal {
    background: #181818;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    width: 100%;
    max-width: 320px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.8);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #202020;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 12px;
    font-weight: 600;
    color: #e5e5e5;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #777777;
    cursor: pointer;
    padding: 2px;
  }

  .btn-close-modal:hover {
    color: #ffffff;
  }

  .modal-body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .modal-label {
    font-size: 11px;
    color: #a3a3a3;
  }

  .modal-input {
    width: 100%;
    padding: 7px 10px;
    background: #101010;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 5px;
    color: #ffffff;
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
  }

  .modal-input:focus {
    border-color: #ff69b4;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 14px;
    background: #1a1a1a;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .btn-modal-cancel {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    color: #aaaaaa;
    font-size: 11.5px;
    cursor: pointer;
  }

  .btn-modal-cancel:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
  }

  .btn-modal-submit {
    padding: 6px 14px;
    background: #ff69b4;
    border: none;
    border-radius: 5px;
    color: #ffffff;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-modal-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
