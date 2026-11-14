import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { WorkspaceShellService } from '../src/lib/services/workspaceShellService';
import { PersistenceService } from '../src/lib/services/persistence';
import { InMemoryLocalStorageAdapter } from '../src/lib/services/persistence/inMemoryLocalStorageAdapter';
import {
  DataWindowService,
  formatDataWindowSections,
  type DataWindowReadout,
  type DataWindowState
} from '../src/lib/services/dataWindowService';

describe('DataWindow Inspector Suite (#203)', () => {
  describe('1. Right Dock Rail & WorkspaceShell Tab Integration', () => {
    let adapter: InMemoryLocalStorageAdapter;
    let persistence: PersistenceService;
    let shell: WorkspaceShellService;

    beforeEach(() => {
      adapter = new InMemoryLocalStorageAdapter();
      persistence = new PersistenceService(adapter);
      shell = new WorkspaceShellService(persistence);
      shell.resetState();
    });

    it('mendukung tab "datawindow" sebagai tab dock kanan yang valid dan dapat di-toggle', () => {
      shell.toggleRightDockTab('datawindow');
      let snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, true);
      assert.strictEqual(snap.activeRightDockTab, 'datawindow');
      assert.strictEqual(snap.lastOpenedRightDockTab, 'datawindow');

      // Click-to-close toggle
      shell.toggleRightDockTab('datawindow');
      snap = shell.getSnapshot();
      assert.strictEqual(snap.isRightDockOpen, false);
      assert.strictEqual(snap.activeRightDockTab, null);
      assert.strictEqual(snap.lastOpenedRightDockTab, 'datawindow');
    });

    it('menyimpan dan memulihkan status tab "datawindow" melalui PersistenceService', () => {
      shell.openRightDockTab('datawindow');
      assert.strictEqual(shell.getSnapshot().activeRightDockTab, 'datawindow');

      // Instansiasi shell baru untuk memverifikasi hidrasi dari persistence
      const newShell = new WorkspaceShellService(persistence);
      const restoredSnap = newShell.getSnapshot();
      assert.strictEqual(restoredSnap.activeRightDockTab, 'datawindow');
      assert.strictEqual(restoredSnap.lastOpenedRightDockTab, 'datawindow');
    });
  });

  describe('2. DataWindow Formatting & Group Parsing', () => {
    it('mengonversi readout menjadi seksi terstruktur Time, Price, dan Indicators', () => {
      const mockReadout: DataWindowReadout = {
        date: '2026-11-14',
        time: '09:30',
        ohlc: {
          o: '91,250.00',
          h: '91,800.50',
          l: '90,950.00',
          c: '91,650.00',
          vol: '4.25K',
          up: true,
        },
        groups: [
          {
            name: 'RSI (14)',
            rows: [
              { label: 'RSI', value: '62.45', color: '#7E57C2' },
              { label: 'RSI-based MA', value: '58.12', color: '#FFB74D' },
            ],
          },
          {
            name: 'MACD (12, 26, 9)',
            rows: [
              { label: 'MACD', value: '142.50', color: '#2962FF' },
              { label: 'Signal', value: '118.20', color: '#FF6D00' },
              { label: 'Histogram', value: '24.30', color: '#26A69A' },
            ],
          },
        ],
      };

      const sections = formatDataWindowSections(mockReadout);
      assert.strictEqual(sections.length, 4, 'Harus menghasilkan 4 seksi (Time, Price, RSI, MACD)');

      // Time section
      assert.strictEqual(sections[0].title, 'Time');
      assert.strictEqual(sections[0].lines[0].label, 'Date');
      assert.strictEqual(sections[0].lines[0].value, '2026-11-14');
      assert.strictEqual(sections[0].lines[1].label, 'Time');
      assert.strictEqual(sections[0].lines[1].value, '09:30');

      // Price section
      assert.strictEqual(sections[1]?.title, 'Price');
      assert.strictEqual(sections[1]?.lines.length, 5); // Open, High, Low, Close, Volume
      assert.strictEqual(sections[1]?.lines[0]?.label, 'Open');
      assert.strictEqual(sections[1]?.lines[0]?.value, '91,250.00');
      assert.strictEqual(sections[1]?.lines[3]?.label, 'Close');
      assert.strictEqual(sections[1]?.lines[3]?.value, '91,650.00');
      assert.strictEqual(sections[1]?.lines[4]?.label, 'Volume');
      assert.strictEqual(sections[1]?.lines[4]?.value, '4.25K');
      assert.ok(sections[1]?.lines[0]?.color?.includes('--bull-color'), 'Lilin bullish memakai warna bull');

      // Indicator sections
      assert.strictEqual(sections[2].title, 'RSI (14)');
      assert.strictEqual(sections[2].lines[0].label, 'RSI');
      assert.strictEqual(sections[2].lines[0].value, '62.45');
      assert.strictEqual(sections[2].lines[0].color, '#7E57C2');

      assert.strictEqual(sections[3].title, 'MACD (12, 26, 9)');
      assert.strictEqual(sections[3].lines.length, 3);
      assert.strictEqual(sections[3].lines[2].label, 'Histogram');
      assert.strictEqual(sections[3].lines[2].value, '24.30');
      assert.strictEqual(sections[3].lines[2].color, '#26A69A');
    });

    it('menangani candle bearish dengan warna bear pada seksi harga', () => {
      const bearishReadout: DataWindowReadout = {
        date: '2026-11-14',
        time: '10:00',
        ohlc: {
          o: '91,650.00',
          h: '91,700.00',
          l: '90,400.00',
          c: '90,500.00',
          vol: '8.10K',
          up: false,
        },
        groups: [],
      };

      const sections = formatDataWindowSections(bearishReadout);
      assert.strictEqual(sections.length, 2);
      assert.ok(sections[1]?.lines[0]?.color?.includes('--bear-color'), 'Lilin bearish memakai warna bear');
    });

    it('mengembalikan array kosong jika readout null', () => {
      assert.deepStrictEqual(formatDataWindowSections(null), []);
    });
  });

  describe('3. DataWindowService Lifecycle & Crosshair Subscriptions', () => {
    let service: DataWindowService;

    beforeEach(() => {
      service = new DataWindowService();
    });

    it('menginisialisasi dengan state kosong', () => {
      const snap = service.getSnapshot();
      assert.strictEqual(snap.readout, null);
      assert.strictEqual(snap.isHovered, false);
      assert.strictEqual(snap.hasData, false);
    });

    it('memberitahu subscriber saat setReadout dipanggil', () => {
      let notifiedSnap: DataWindowState | null = null;
      const unsub = service.subscribe((s) => {
        notifiedSnap = s;
      });

      const sampleReadout: DataWindowReadout = {
        date: '2026-11-14',
        time: '11:00',
        ohlc: { o: '100', h: '105', l: '95', c: '102', up: true },
        groups: [],
      };

      service.setReadout(sampleReadout);
      assert.ok(notifiedSnap);
      assert.strictEqual((notifiedSnap as DataWindowState).hasData, true);
      assert.strictEqual((notifiedSnap as DataWindowState).isHovered, true);
      assert.strictEqual((notifiedSnap as DataWindowState).readout?.date, '2026-11-14');

      unsub();
    });

    it('attachChart mengikat event crosshair dan mengekstrak readout dari chart.renderer', () => {
      let crosshairCallback: (() => void) | null = null;
      let eventCallbacks = new Map<string, () => void>();

      const mockReadout: DataWindowReadout = {
        date: '2026-11-14',
        time: '12:00',
        ohlc: { o: '90000', h: '91000', l: '89500', c: '90800', up: true },
        groups: [
          {
            name: 'EMA 20',
            rows: [{ label: 'EMA', value: '90450', color: '#00E676' }],
          },
        ],
      };

      const mockChart = {
        renderer: {
          dataWindowReadout: () => mockReadout,
          onCrosshairMove: (cb: () => void) => {
            crosshairCallback = cb;
            return () => {
              crosshairCallback = null;
            };
          },
        },
        on: (event: string, cb: () => void) => {
          eventCallbacks.set(event, cb);
          return () => {
            eventCallbacks.delete(event);
          };
        },
      };

      const detach = service.attachChart(mockChart);

      // Pembaruan awal saat attach
      let snap = service.getSnapshot();
      assert.strictEqual(snap.hasData, true);
      assert.strictEqual(snap.readout?.date, '2026-11-14');
      assert.strictEqual(snap.readout?.groups[0].name, 'EMA 20');

      // Simulasi gerakan crosshair
      const triggerCrosshair = crosshairCallback as (() => void) | null;
      assert.ok(triggerCrosshair, 'Crosshair callback harus terpasang');
      triggerCrosshair();

      snap = service.getSnapshot();
      assert.strictEqual(snap.hasData, true);
      assert.strictEqual(snap.isHovered, true);

      // Detach membersihkan listener
      detach();
      assert.strictEqual(crosshairCallback, null);
    });

    it('mempertahankan data candle terakhir saat mouse keluar dari kanvas (mouse leave retention)', () => {
      let pointerLeaveCallback: (() => void) | null = null;
      const mockContainer = {
        addEventListener: (event: string, cb: () => void) => {
          if (event === 'pointerleave') pointerLeaveCallback = cb;
        },
        removeEventListener: (event: string) => {
          if (event === 'pointerleave') pointerLeaveCallback = null;
        },
      } as unknown as HTMLElement;

      const latestBarReadout: DataWindowReadout = {
        date: '2026-11-14',
        time: '13:00',
        ohlc: { o: '92000', h: '92500', l: '91800', c: '92300', up: true },
        groups: [],
      };

      const mockChart = {
        renderer: {
          dataWindowReadout: () => latestBarReadout,
          onCrosshairMove: () => () => {},
        },
        on: () => () => {},
      };

      service.attachChart(mockChart, mockContainer);
      assert.strictEqual(service.getSnapshot().hasData, true);

      // Simulasikan kursor keluar dari kanvas
      const triggerLeave = pointerLeaveCallback as (() => void) | null;
      assert.ok(triggerLeave, 'Listener pointerleave harus terpasang pada kontainer chart');
      triggerLeave();

      const snapAfterLeave = service.getSnapshot();
      // Data tetap hadir (tidak menjadi null/blank)
      assert.strictEqual(snapAfterLeave.hasData, true);
      assert.strictEqual(snapAfterLeave.isHovered, false);
      assert.strictEqual(snapAfterLeave.readout?.time, '13:00');
      assert.strictEqual(snapAfterLeave.readout?.ohlc?.c, '92300');
    });

    it('updateFromChart mempertahankan lastValidReadout jika renderer mengembalikan null', () => {
      let returnNull = false;
      const validBar: DataWindowReadout = {
        date: '2026-11-14',
        time: '14:00',
        ohlc: { o: '93000', h: '93500', l: '92800', c: '93200', up: true },
        groups: [],
      };

      const mockChart = {
        renderer: {
          dataWindowReadout: () => (returnNull ? null : validBar),
        },
      };

      service.updateFromChart(mockChart);
      assert.strictEqual(service.getSnapshot().hasData, true);
      assert.strictEqual(service.getSnapshot().readout?.time, '14:00');

      // Renderer mengembalikan null (misal transisi atau cursor off screen)
      returnNull = true;
      service.updateFromChart(mockChart);

      const snap = service.getSnapshot();
      assert.strictEqual(snap.hasData, true, 'hasData tetap true karena mempertahankan candle terakhir');
      assert.strictEqual(snap.isHovered, false, 'isHovered menjadi false');
      assert.strictEqual(snap.readout?.ohlc?.c, '93200', 'Data bar terakhir tetap dipertahankan');
    });

    it('attachWorkspace mengikat sel aktif dan beralih dinamis saat event cell:active dipancarkan', () => {
      let cellActiveCallback: (() => void) | null = null;

      const chartA = {
        renderer: {
          dataWindowReadout: () => ({
            date: '2026-11-14',
            time: '15:00',
            ohlc: { o: '100', h: '110', l: '90', c: '105', up: true },
            groups: [{ name: 'Chart A Indicator', rows: [{ label: 'Val', value: '10', color: '#ff0000' }] }],
          }),
          onCrosshairMove: () => () => {},
        },
        on: () => () => {},
      };

      const chartB = {
        renderer: {
          dataWindowReadout: () => ({
            date: '2026-11-14',
            time: '15:15',
            ohlc: { o: '200', h: '220', l: '190', c: '215', up: true },
            groups: [{ name: 'Chart B Indicator', rows: [{ label: 'Val', value: '20', color: '#00ff00' }] }],
          }),
          onCrosshairMove: () => () => {},
        },
        on: () => () => {},
      };

      const mockWorkspace = {
        active: { chart: chartA },
        on: (event: string, cb: () => void) => {
          if (event === 'cell:active') {
            cellActiveCallback = cb;
          }
          return () => {
            if (event === 'cell:active') cellActiveCallback = null;
          };
        },
      };

      const detachWs = service.attachWorkspace(mockWorkspace);
      assert.strictEqual(service.getSnapshot().readout?.groups[0].name, 'Chart A Indicator');

      // Ganti sel aktif ke Chart B
      mockWorkspace.active = { chart: chartB };
      const triggerCellActive = cellActiveCallback as (() => void) | null;
      assert.ok(triggerCellActive);
      triggerCellActive();

      assert.strictEqual(service.getSnapshot().readout?.groups[0].name, 'Chart B Indicator');
      assert.strictEqual(service.getSnapshot().readout?.time, '15:15');

      detachWs();
    });

    it('clear() dan destroy() mereset seluruh memori dan subscriber', () => {
      service.setReadout({
        date: '2026-11-14',
        time: '14:00',
        ohlc: { o: '1', h: '2', l: '0.5', c: '1.5', up: true },
        groups: [],
      });
      assert.strictEqual(service.getSnapshot().hasData, true);

      service.clear();
      const snap = service.getSnapshot();
      assert.strictEqual(snap.hasData, false);
      assert.strictEqual(snap.readout, null);
    });
  });
});
