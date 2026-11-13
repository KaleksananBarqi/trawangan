import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TimelineMarksController,
  formatMacroTimelineMark,
  formatTradeExecutionTimelineMark,
  formatPlanLevelTimelineMarks,
  formatJournalTimelineMark,
  type MacroCalendarEvent,
  type TradeExecutionMarkerData,
  type JournalMarkNote,
  type StandardMarkGroupId
} from '../src/lib/services/timelineMarksController';
import type { ParsedTradingPlan } from '../src/lib/services/planParserService';
import type { PriceAlert } from '../src/lib/types/market';

// Mock implementasi Vela MarksControl
function createMockMarksControl() {
  const marksMap = new Map<string, any>();
  const groupsMap = new Map<string, any>();
  const visibilityMap = new Map<string, boolean>();

  return {
    marksMap,
    groupsMap,
    visibilityMap,
    supported: true,
    add(mark: any) {
      marksMap.set(mark.id, mark);
      return this;
    },
    set(marks: readonly any[]) {
      marksMap.clear();
      for (const m of marks) marksMap.set(m.id, m);
      return this;
    },
    remove(id: string) {
      marksMap.delete(id);
      return this;
    },
    clear() {
      marksMap.clear();
      return this;
    },
    all() {
      return Array.from(marksMap.values());
    },
    defineGroup(group: any) {
      groupsMap.set(group.id, group);
      if (group.visible !== undefined && !visibilityMap.has(group.id)) {
        visibilityMap.set(group.id, group.visible);
      }
      return this;
    },
    groups() {
      return Array.from(groupsMap.values());
    },
    setGroupVisible(id: string, visible: boolean = true) {
      visibilityMap.set(id, visible);
      return this;
    },
    isGroupVisible(id: string) {
      if (visibilityMap.has(id)) return visibilityMap.get(id)!;
      const grp = groupsMap.get(id);
      return grp?.visible ?? true;
    }
  };
}

// Mock chart dengan marks dan event emitter
function createMockChart() {
  const marks = createMockMarksControl();
  const listeners = new Map<string, Function[]>();

  return {
    marks,
    on(event: string, fn: Function) {
      const list = listeners.get(event) || [];
      list.push(fn);
      listeners.set(event, list);
      return () => {
        const updated = (listeners.get(event) || []).filter((h) => h !== fn);
        listeners.set(event, updated);
      };
    },
    emit(event: string, payload: any) {
      const list = listeners.get(event) || [];
      for (const fn of list) fn(payload);
    }
  };
}

test.describe('TimelineMarksController & Event Markers Suite (#198)', () => {
  test('1. Definisi Grup Terstandarisasi (macro, trades, journal) & Pewarisan Visibilitas', () => {
    const controller = new TimelineMarksController();
    const groups = controller.getGroups();

    // Pastikan 3 grup utama terdefinisi
    const groupIds = groups.map((g) => g.id);
    assert.ok(groupIds.includes('macro'), 'Grup macro harus terdefinisi');
    assert.ok(groupIds.includes('trades'), 'Grup trades harus terdefinisi');
    assert.ok(groupIds.includes('journal'), 'Grup journal harus terdefinisi');

    // Pastikan subgrup bersarang terdefinisi
    assert.ok(groupIds.includes('macro.high'), 'Subgrup macro.high harus terdefinisi');
    assert.ok(groupIds.includes('trades.entry'), 'Subgrup trades.entry harus terdefinisi');
    assert.ok(groupIds.includes('trades.tp'), 'Subgrup trades.tp harus terdefinisi');
    assert.ok(groupIds.includes('trades.sl'), 'Subgrup trades.sl harus terdefinisi');

    // Default semua grup terlihat (visible = true)
    assert.equal(controller.isGroupVisible('macro'), true);
    assert.equal(controller.isGroupVisible('macro.high'), true);

    // Toggle parent group macro ke false
    controller.setGroupVisible('macro', false);
    assert.equal(controller.isGroupVisible('macro'), false);
    // Subgrup macro.high harus efektif false karena parent mati
    assert.equal(controller.isGroupVisible('macro.high'), false);

    // Nyalakan kembali parent macro
    controller.setGroupVisible('macro', true);
    assert.equal(controller.isGroupVisible('macro.high'), true);

    // Matikan hanya subgrup
    controller.setGroupVisible('macro.high', false);
    assert.equal(controller.isGroupVisible('macro'), true);
    assert.equal(controller.isGroupVisible('macro.high'), false);
  });

  test('2. Pemformatan Acara Makroekonomi (formatMacroTimelineMark)', () => {
    const event: MacroCalendarEvent = {
      id: 'us_cpi_2026_11',
      title: 'US Consumer Price Index (CPI YoY)',
      timestamp: 1794681000000,
      impact: 'high',
      country: 'US',
      currency: 'USD',
      actual: '2.4%',
      forecast: '2.3%',
      previous: '2.5%',
      description: 'Laporan inflasi harga konsumen tahunan Amerika Serikat.',
      relevantSymbols: ['BTCUSDT', 'TOTAL']
    };

    const mark = formatMacroTimelineMark(event);
    assert.equal(mark.id, 'macro_us_cpi_2026_11');
    assert.equal(mark.time, 1794681000000);
    assert.equal(mark.title, 'US Consumer Price Index (CPI YoY)');
    assert.equal(mark.group, 'macro.high');

    // Validasi glyph: high impact warna merah, shape circle
    assert.equal(mark.glyph.shape, 'circle');
    assert.equal(mark.glyph.color, '#ef4444');
    assert.equal(mark.glyph.letter, 'US');

    // Validasi tooltip informatif
    assert.ok(mark.tooltip?.includes('US'));
    assert.ok(mark.tooltip?.includes('CPI YoY'));
    assert.ok(mark.tooltip?.includes('2.4%'));

    // Validasi content panel
    assert.ok(mark.content && typeof mark.content === 'object');
    if (typeof mark.content === 'object' && 'panel' in mark.content) {
      const items = mark.content.panel.items;
      assert.ok(items.length >= 4);
      const labels = items.map((i: any) => i.label).filter(Boolean);
      assert.ok(labels.includes('Actual'));
      assert.ok(labels.includes('Forecast'));
      assert.ok(labels.includes('Previous'));
    } else {
      assert.fail('Format content harus berupa panel dengan items');
    }
  });

  test('3. Pemformatan Eksekusi Trading Plan (formatTradeExecutionTimelineMark)', () => {
    const tradeData: TradeExecutionMarkerData = {
      id: 'trade_fill_101',
      symbol: 'BTCUSDT',
      time: 1794682000000,
      type: 'entry',
      side: 'buy',
      price: 64200,
      size: 0.5,
      planId: 'plan_btc_breakout',
      label: 'Long Entry Filled',
      rMultiple: 1.0,
      notes: 'Eksekusi order beli pada breakout resistensi.'
    };

    const mark = formatTradeExecutionTimelineMark(tradeData);
    assert.equal(mark.id, 'trade_entry_trade_fill_101');
    assert.equal(mark.time, 1794682000000);
    assert.equal(mark.group, 'trades.entry');
    assert.equal(mark.glyph.shape, 'diamond');
    assert.equal(mark.glyph.color, '#10b981');
    assert.equal(mark.glyph.letter, 'E');

    assert.ok(mark.tooltip?.includes('64,200') || mark.tooltip?.includes('64200'));

    // Cek content panel
    if (typeof mark.content === 'object' && 'panel' in mark.content) {
      const items = mark.content.panel.items;
      const fields = items.filter((i: any) => i.type === 'field');
      assert.ok(fields.some((f: any) => f.label === 'Price'));
      assert.ok(fields.some((f: any) => f.label === 'Side' && f.value.toUpperCase() === 'BUY'));
    } else {
      assert.fail('Format trade content harus berupa panel');
    }
  });

  test('4. Proyeksi Penanda Level Plan & Alert Trigger (formatPlanLevelTimelineMarks)', () => {
    const plan: ParsedTradingPlan = {
      bias: 'bullish',
      entry: 64000,
      entries: [
        { id: 'e1', label: 'E1', price: 64000, style: 'aggressive', reason: 'Order block retest' }
      ],
      stopLoss: 62000,
      targets: [
        { id: 'tp1', label: 'TP1', price: 68000, rMultiple: 2.0, reason: 'Liquidity pool target' },
        { id: 'tp2', label: 'TP2', price: 72000, rMultiple: 4.0, reason: 'HTF swing high' }
      ],
      riskAmount: 500,
      reasons: {},
      contextZones: [],
      rawText: 'Bullish BTC setup',
      validation: { valid: true, errors: [], warnings: [] },
      symbol: 'BTCUSDT'
    };

    const alerts: PriceAlert[] = [
      {
        id: 'alert_e1',
        symbol: 'BTCUSDT',
        targetPrice: 64000,
        condition: 'crossing',
        frequency: 'once',
        label: 'BTCUSDT E1',
        active: false,
        triggered: true,
        createdAt: 1794600000000,
        triggeredAt: 1794610000000,
        triggeredPrice: 64010,
        planId: 'plan_1',
        planRole: 'entry'
      },
      {
        id: 'alert_tp1',
        symbol: 'BTCUSDT',
        targetPrice: 68000,
        condition: 'crossing',
        frequency: 'once',
        label: 'BTCUSDT TP1',
        active: false,
        triggered: true,
        createdAt: 1794600000000,
        triggeredAt: 1794640000000,
        triggeredPrice: 68050,
        planId: 'plan_1',
        planRole: 'tp'
      }
    ];

    const marks = formatPlanLevelTimelineMarks(plan, alerts, 1794600000000);
    assert.ok(marks.length >= 3, 'Harus menghasilkan penanda untuk Entry, TP1, TP2, dan SL');

    // Penanda entry harus memakai triggeredAt dari alert (1794610000000)
    const entryMark = marks.find((m) => m.group === 'trades.entry');
    assert.ok(entryMark);
    assert.equal(entryMark?.time, 1794610000000);

    // Penanda TP1 harus memakai triggeredAt dari alert (1794640000000)
    const tp1Mark = marks.find((m) => m.id.includes('tp1'));
    assert.ok(tp1Mark);
    assert.equal(tp1Mark?.time, 1794640000000);
    assert.equal(tp1Mark?.glyph.shape, 'pin');
  });

  test('5. Pemformatan Catatan Jurnal (formatJournalTimelineMark)', () => {
    const note: JournalMarkNote = {
      id: 'journal_1',
      symbol: 'BTCUSDT',
      time: 1794650000000,
      title: 'Analisis Likuiditas SFP',
      note: 'Terjadi swing failure pattern di atas high kemarin.',
      tags: ['SFP', 'Liquidity', 'HTF'],
      author: 'TraderPro'
    };

    const mark = formatJournalTimelineMark(note);
    assert.equal(mark.id, 'journal_journal_1');
    assert.equal(mark.time, 1794650000000);
    assert.equal(mark.group, 'journal');
    assert.equal(mark.glyph.shape, 'square');
    assert.equal(mark.glyph.color, '#8b5cf6');
    assert.equal(mark.glyph.letter, 'J');
    assert.ok(mark.tooltip?.includes('Analisis Likuiditas SFP'));
  });

  test('6. Interaksi dengan chart.marks API (attach, set, add, remove, clear)', () => {
    const controller = new TimelineMarksController();
    const mockChart = createMockChart();

    controller.attach(mockChart);

    // Pastikan grup telah didefinisikan pada chart.marks
    assert.ok(mockChart.marks.groupsMap.has('macro'));
    assert.ok(mockChart.marks.groupsMap.has('trades'));
    assert.ok(mockChart.marks.groupsMap.has('journal'));

    // Tambah penanda
    const testMark = {
      id: 'm1',
      time: 1000,
      title: 'Test Mark 1',
      group: 'macro',
      glyph: { color: '#ff0000', letter: 'T' }
    };
    controller.addMark(testMark);
    assert.equal(mockChart.marks.marksMap.size, 1);
    assert.equal(mockChart.marks.marksMap.get('m1')?.title, 'Test Mark 1');

    // Hapus penanda
    controller.removeMark('m1');
    assert.equal(mockChart.marks.marksMap.size, 0);

    // Set batch marks
    controller.setMarks([
      testMark,
      { id: 'm2', time: 2000, title: 'Test 2', group: 'trades', glyph: { color: '#00ff00' } }
    ]);
    assert.equal(mockChart.marks.marksMap.size, 2);

    // Clear marks
    controller.clearMarks();
    assert.equal(mockChart.marks.marksMap.size, 0);

    // Detach
    controller.detach();
  });

  test('7. Filter Simbol & Pembersihan Penanda Usang saat Pergantian Pasar (syncForMarket)', () => {
    const controller = new TimelineMarksController();
    const mockChart = createMockChart();
    controller.attach(mockChart);

    // Muat data makro, trade plan BTC, dan trade plan ETH
    controller.loadMacroEvents([
      {
        id: 'macro_fomc',
        title: 'FOMC Rate Decision',
        timestamp: 1794700000000,
        impact: 'high',
        country: 'US',
        relevantSymbols: ['BTCUSDT', 'TOTAL']
      }
    ]);

    controller.loadTradeExecution({
      id: 'btc_e1',
      symbol: 'BTCUSDT',
      time: 1794710000000,
      type: 'entry',
      price: 65000
    });

    controller.loadTradeExecution({
      id: 'eth_e1',
      symbol: 'ETHUSDT',
      time: 1794715000000,
      type: 'entry',
      price: 3400
    });

    // Sinkronisasi untuk BTCUSDT
    controller.syncForMarket('BTCUSDT');
    const btcMarks = controller.getActiveMarks();
    const btcIds = btcMarks.map((m) => m.id);
    assert.ok(btcIds.includes('macro_macro_fomc'), 'FOMC harus tampil di BTCUSDT');
    assert.ok(btcIds.includes('trade_entry_btc_e1'), 'Trade BTC harus tampil di BTCUSDT');
    assert.ok(!btcIds.includes('trade_entry_eth_e1'), 'Trade ETH TIDAK boleh tampil di BTCUSDT');

    // Ganti simbol ke ETHUSDT -> stale marks BTC harus terpurger bersih
    controller.syncForMarket('ETHUSDT');
    const ethMarks = controller.getActiveMarks();
    const ethIds = ethMarks.map((m) => m.id);
    assert.ok(!ethIds.includes('trade_entry_btc_e1'), 'Trade BTC harus terpurger saat di ETHUSDT');
    assert.ok(ethIds.includes('trade_entry_eth_e1'), 'Trade ETH harus tampil di ETHUSDT');
    // FOMC tidak memiliki relevantSymbols ETHUSDT secara spesifik, tetapi jika event bersifat global makro, dapat dikonfigurasi
  });

  test('8. Penanganan Event mark:click & Pembersihan Bersih (destroy)', () => {
    const controller = new TimelineMarksController();
    const mockChart = createMockChart();
    controller.attach(mockChart);

    let clickedPayload: any = null;
    const unsubClick = controller.onMarkClick((evt) => {
      clickedPayload = evt;
    });

    // Simulasikan emit mark:click dari chart
    mockChart.emit('mark:click', { id: 'macro_test', ids: ['macro_test'], time: 1000, group: 'macro' });
    assert.ok(clickedPayload);
    assert.equal(clickedPayload.id, 'macro_test');

    unsubClick();
    clickedPayload = null;
    mockChart.emit('mark:click', { id: 'macro_test', ids: ['macro_test'], time: 1000 });
    assert.equal(clickedPayload, null, 'Listener click harus sudah berhenti');

    controller.destroy();
    assert.equal(controller.isAttached(), false);
  });

  test('9. Multi-cell Workspace Propagation & cell:created Auto-Attach', () => {
    const controller = new TimelineMarksController();
    const cell1 = { id: 'c1', chart: createMockChart() };
    const cell2 = { id: 'c2', chart: createMockChart() };
    const cellMap = new Map<string, any>([['c1', cell1], ['c2', cell2]]);

    const wsListeners = new Map<string, Function[]>();
    const mockWorkspace = {
      cells: () => Array.from(cellMap.values()),
      cell: (id: string) => cellMap.get(id),
      on: (ev: string, fn: Function) => {
        const list = wsListeners.get(ev) || [];
        list.push(fn);
        wsListeners.set(ev, list);
        return () => {};
      },
      emit: (ev: string, payload: any) => {
        const list = wsListeners.get(ev) || [];
        for (const fn of list) fn(payload);
      }
    };

    // Attach workspace
    controller.attach(mockWorkspace);

    // Tambah satu mark
    controller.addMark({
      id: 'm_sync',
      time: 5000,
      title: 'Sync Mark',
      group: 'trades',
      glyph: { color: '#00ff00' }
    });

    // Pastikan kedua cell menerima mark
    assert.equal(cell1.chart.marks.marksMap.size, 1);
    assert.equal(cell2.chart.marks.marksMap.size, 1);

    // Simulasikan pembuatan cell ke-3 saat layout berubah
    const cell3 = { id: 'c3', chart: createMockChart() };
    cellMap.set('c3', cell3);
    mockWorkspace.emit('cell:created', { id: 'c3' });

    // Cell ke-3 harus otomatis ter-attach dan menerima mark yang sama
    assert.equal(cell3.chart.marks.marksMap.size, 1);
    assert.equal(cell3.chart.marks.marksMap.get('m_sync')?.title, 'Sync Mark');

    controller.detach();
    assert.equal(controller.isAttached(), false);
  });

  test('10. Integrasi ChartSessionController dengan TimelineMarksController', async () => {
    const { ChartSessionController } = await import('../src/lib/services/chartSessionController');
    const session = new ChartSessionController({
      symbol: 'BTCUSDT',
      timeframe: '15m'
    });

    const marksCtrl = session.getTimelineMarksController();
    assert.ok(marksCtrl instanceof TimelineMarksController, 'Harus menyediakan instance TimelineMarksController');

    // Pastikan grup standar siap
    const groups = marksCtrl.getGroups();
    assert.ok(groups.length >= 3);

    session.destroy();
  });
});
