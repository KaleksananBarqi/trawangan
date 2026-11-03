import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createUserTheme,
  registerUserThemes,
  resolveThemeConfig,
  resolveEffectiveChartThemePreset,
  generateChartThesisThemeTokens,
  THEME_PRESETS
} from '../src/lib/constants/themes';
import {
  isDarkColor,
  deriveSurfaceColor,
  ensureReadableTextColor
} from '../src/lib/utils/colorUtils';
import { resolveAppSettings, DEFAULT_APP_SETTINGS } from '../src/lib/constants/defaults';
import {
  saveTradingPlanToHistory,
  loadTradingPlanHistory,
  deleteTradingPlanFromHistory,
  clearTradingPlanHistory
} from '../src/lib/services/persistence';
import { alertService } from '../src/lib/services/alertService';
import { parseTradingPlan } from '../src/lib/services/planParserService';
import { ChartDrawingController } from '../src/lib/services/chartDrawingController';
import { renderDedicatedThesisSidePanel, drawThesisCardOnCanvas } from '../src/lib/services/chartSnapshotService';

const SAMPLE_LONG_MARKDOWN = `| Parameter | Nilai |
| --- | --- |
| Bias | Bullish |
| Entry | 2257.4 |
| Alasan Entry | Sweep internal liquidity LTF 15m [FAKTA] |
| Stop Loss | 2248.0 |
| Alasan SL | Di bawah swing low [FAKTA] |
| TP1 | 2282.0 |
| Alasan TP1 | Bearish FVG 1H [FAKTA] |
| TP2 | 2303.5 |
| Alasan TP2 | Equal Highs EQH [INFERENSI] |`;

const SAMPLE_SHORT_MARKDOWN = `| Parameter | Nilai |
| --- | --- |
| Bias | Bearish |
| Entry | 81200.0 |
| Stop Loss | 81400.0 |
| TP1 | 80355.4 |
| TP2 | 79429.0 |`;

function createMockWorkspace() {
  const drawings: any[] = [];
  const activeChart = {
    data: () => [
      { time: 1700000000000, open: 2250, high: 2260, low: 2245, close: 2255 },
      { time: 1700000900000, open: 2255, high: 2265, low: 2250, close: 2258 }
    ],
    drawings: {
      all: () => drawings,
      create: (spec: any) => {
        const id = spec.id || `draw_${drawings.length + 1}_${Date.now()}`;
        const item = { ...spec, id };
        drawings.push(item);
        return item;
      },
      removeMany: (ids: string[]) => {
        for (let i = drawings.length - 1; i >= 0; i--) {
          if (ids.includes(drawings[i].id)) {
            drawings.splice(i, 1);
          }
        }
      },
      remove: (id: string) => {
        const idx = drawings.findIndex((d) => d.id === id);
        if (idx !== -1) drawings.splice(idx, 1);
      },
      toJSON: () => ({ version: 1, drawings: [...drawings] }),
      fromJSON: (doc: any) => {
        drawings.length = 0;
        if (Array.isArray(doc?.drawings)) {
          drawings.push(...doc.drawings);
        }
      }
    }
  };
  return {
    workspace: {
      active: {
        symbol: 'ETHUSDT.P',
        timeframe: '15m',
        chart: activeChart
      },
      cells: () => [{ chart: activeChart }]
    },
    drawings
  };
}

describe('ADR-0019: Chart Mode Preset Memory, Chart-Dominant Thesis Surface, Trade Plan Vault & Auto-Alerts Suite', () => {
  describe('1. Chart Mode Preset Memory (Decoupled Dark & Light Canvas Memory)', () => {
    it('menyelesaikan activeDarkChartPreset saat mode gelap dan activeLightChartPreset saat mode terang ketika syncChartWithAppTheme === false', () => {
      const darkCanvasPreset = 'user_theme_custom_a';
      const lightCanvasPreset = 'user_theme_custom_b';

      // Saat mode gelap: kanvas menggunakan Tema Kustom A
      const resolvedDark = resolveEffectiveChartThemePreset(
        false,
        'binance',
        darkCanvasPreset,
        'dark',
        true,
        darkCanvasPreset,
        lightCanvasPreset
      );
      assert.equal(resolvedDark, 'user_theme_custom_a');

      // Saat pindah ke mode terang via halaman utama: kanvas beralih ke Tema Kustom B (tidak tertumpuk Tema Kustom A!)
      const resolvedLight = resolveEffectiveChartThemePreset(
        false,
        'red_folder',
        darkCanvasPreset,
        'light',
        false,
        darkCanvasPreset,
        lightCanvasPreset
      );
      assert.equal(resolvedLight, 'user_theme_custom_b');

      // Saat mode system (OS terang): kanvas menggunakan Tema Kustom B
      const resolvedSystemLight = resolveEffectiveChartThemePreset(
        false,
        'red_folder',
        darkCanvasPreset,
        'system',
        false,
        darkCanvasPreset,
        lightCanvasPreset
      );
      assert.equal(resolvedSystemLight, 'user_theme_custom_b');

      // Saat mode system (OS gelap): kanvas kembali ke Tema Kustom A
      const resolvedSystemDark = resolveEffectiveChartThemePreset(
        false,
        'binance',
        lightCanvasPreset,
        'system',
        true,
        darkCanvasPreset,
        lightCanvasPreset
      );
      assert.equal(resolvedSystemDark, 'user_theme_custom_a');
    });

    it('resolveAppSettings menormalisasi activeDarkChartPreset dan activeLightChartPreset dengan aman', () => {
      const defaults = resolveAppSettings(null);
      assert.equal(defaults.activeDarkChartPreset, DEFAULT_APP_SETTINGS.activeDarkChartPreset);
      assert.equal(defaults.activeLightChartPreset, DEFAULT_APP_SETTINGS.activeLightChartPreset);

      const custom = resolveAppSettings({
        syncChartWithAppTheme: false,
        activeDarkChartPreset: 'user_theme_a',
        activeLightChartPreset: 'user_theme_b'
      });
      assert.equal(custom.activeDarkChartPreset, 'user_theme_a');
      assert.equal(custom.activeLightChartPreset, 'user_theme_b');
    });
  });

  describe('2. Chart-Dominant Thesis Surface & Custom Theme Foreground Philosophy Fix', () => {
    it('mencegah tabrakan kontras (putih di atas putih) ketika tema kustom gelap memiliki general.foreground terang (seperti di chartthemes.com)', () => {
      const userThemeWithLightForeground = createUserTheme(
        'Dark Chart With Light Grid Foreground',
        'dark',
        {
          enabled: true,
          candles: {
            bullBody: '#00FF88',
            bullWick: '#00FF88',
            bullBorder: '#00CC6A',
            bearBody: '#FF3B69',
            bearWick: '#FF3B69',
            bearBorder: '#CC2952'
          },
          general: {
            background: '#0D1117', // Latar chart gelap
            foreground: '#E5E7EB', // Foreground terang (warna garis/grid di chartthemes.com)
            textColor: '#F3F4F6'   // Teks terang
          }
        },
        'user_theme_clash_repro'
      );

      registerUserThemes([userThemeWithLightForeground]);
      const cfg = resolveThemeConfig('user_theme_clash_repro', [userThemeWithLightForeground]);

      // Permukaan kartu/panel (bgSecondary, bgContainer, bgPanel) HARUS tetap gelap karena diturunkan dari background (#0D1117), BUKAN memakai #E5E7EB mentah!
      assert.equal(
        isDarkColor(cfg.tokens.bgSecondary),
        true,
        `bgSecondary (${cfg.tokens.bgSecondary}) harus tetap gelap selaras dengan chart background (#0D1117)`
      );
      assert.equal(
        isDarkColor(cfg.tokens.bgContainer),
        true,
        `bgContainer (${cfg.tokens.bgContainer}) harus tetap gelap`
      );
      assert.notEqual(cfg.tokens.bgSecondary.toUpperCase(), '#E5E7EB');

      // Token CSS --chart-thesis-* juga harus menghasilkan surface gelap dan teks terang yang terbaca jelas
      const thesisTokens = generateChartThesisThemeTokens(cfg);
      assert.equal(isDarkColor(thesisTokens['--chart-thesis-bg-solid']), true);
      assert.equal(isDarkColor(thesisTokens['--chart-thesis-text']), false);
    });

    it('renderDedicatedThesisSidePanel dan drawThesisCardOnCanvas memperbaiki kontras jika diberi themeConfig dengan bgSecondary terang namun chart background gelap', () => {
      const drawOps: any[] = [];
      const mockCtx: any = {
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arcTo: () => {},
        quadraticCurveTo: () => {},
        arc: () => {},
        rect: () => {},
        clip: () => {},
        fill: function () {
          drawOps.push({ op: 'fill', fillStyle: this.fillStyle });
        },
        stroke: function () {
          drawOps.push({ op: 'stroke', strokeStyle: this.strokeStyle });
        },
        fillText: function (text: string) {
          drawOps.push({ op: 'fillText', text, fillStyle: this.fillStyle });
        },
        measureText: (txt: string) => ({ width: String(txt).length * 6 })
      };

      const clashingTheme = {
        ...THEME_PRESETS.signature,
        chart: {
          ...THEME_PRESETS.signature.chart,
          background: '#111318' // Gelap
        },
        tokens: {
          ...THEME_PRESETS.signature.tokens,
          bgSecondary: '#ECEFF4', // Terang (simulasi bug lama)
          textPrimary: '#FFFFFF'  // Terang
        }
      };

      const plan = { ...parseTradingPlan(SAMPLE_LONG_MARKDOWN), id: 'plan_contrast_test' };
      renderDedicatedThesisSidePanel(mockCtx, plan, 0, 0, 360, 720, 1, clashingTheme);

      const firstFill = drawOps.find((op) => op.op === 'fill');
      assert.ok(firstFill, 'Harus menggambar latar belakang panel');
      // Tidak boleh merender rgba(236, 239, 244, ...) (#ECEFF4) karena chart background gelap!
      assert.equal(
        String(firstFill.fillStyle).includes('236, 239, 244'),
        false,
        `Latar panel (${firstFill.fillStyle}) tidak boleh berwarna putih terang saat chart gelap`
      );
    });
  });

  describe('3. Trade Plan Vault (Automatic Outlook History & Smart Deduplication)', () => {
    it('menyimpan Trade Plan secara otomatis, melakukan deduplikasi cerdas, dan mendukung penghapusan', async () => {
      await clearTradingPlanHistory();
      const initial = await loadTradingPlanHistory();
      assert.equal(initial.length, 0);

      const planLong = parseTradingPlan(SAMPLE_LONG_MARKDOWN);
      const saved1 = await saveTradingPlanToHistory({
        id: 'vault_plan_1',
        symbol: 'ETHUSDT.P',
        providerId: 'binance',
        timeframe: '15m',
        rawText: SAMPLE_LONG_MARKDOWN,
        plan: { ...planLong, id: 'vault_plan_1', symbol: 'ETHUSDT.P' }
      });
      assert.equal(saved1.symbol, 'ETHUSDT.P');
      assert.equal(saved1.plan.entry, 2257.4);

      const listAfter1 = await loadTradingPlanHistory();
      assert.equal(listAfter1.length, 1);

      // Deduplikasi cerdas: menyimpan ulang plan dengan simbol, bias, entry, SL, dan TP yang sama persis tidak membuat duplikat
      await saveTradingPlanToHistory({
        id: 'vault_plan_1_reapplied',
        symbol: 'ETHUSDT.P',
        providerId: 'binance',
        timeframe: '15m',
        rawText: SAMPLE_LONG_MARKDOWN,
        plan: { ...planLong, id: 'vault_plan_1_reapplied', symbol: 'ETHUSDT.P' }
      });
      const listAfterDup = await loadTradingPlanHistory();
      assert.equal(listAfterDup.length, 1, 'Harus melakukan deduplikasi untuk plan identik');

      // Plan kedua dengan simbol berbeda tetap ditambahkan sebagai entri baru
      const planShort = parseTradingPlan(SAMPLE_SHORT_MARKDOWN);
      const saved2 = await saveTradingPlanToHistory({
        id: 'vault_plan_2',
        symbol: 'BTCUSDT.P',
        providerId: 'binance',
        timeframe: '1h',
        rawText: SAMPLE_SHORT_MARKDOWN,
        plan: { ...planShort, id: 'vault_plan_2', symbol: 'BTCUSDT.P' }
      });
      const listAfter2 = await loadTradingPlanHistory();
      assert.equal(listAfter2.length, 2);

      // Hapus salah satu entri
      const afterDelete = await deleteTradingPlanFromHistory(saved2.id);
      assert.equal(afterDelete.length, 1);

      await clearTradingPlanHistory();
    });
  });

  describe('4. Plan-Linked Auto-Alerts & Lifecycle Binding', () => {
    it('membuat alert otomatis untuk Entry, Stop Loss, dan seluruh TP (TP1..TPn) dengan arah kondisi yang tepat', async () => {
      await alertService.clearAllAlerts();

      // 1. Uji LONG Plan: Entry (crossing), SL (crossing_down), TP1 & TP2 (crossing_up)
      const longPlan = {
        ...parseTradingPlan(SAMPLE_LONG_MARKDOWN),
        id: 'plan_long_alerts_1',
        symbol: 'ETHUSDT.P'
      };
      const createdLongAlerts = await alertService.addPlanAlerts(longPlan, 'ETHUSDT.P');
      assert.equal(createdLongAlerts.length, 4, 'Harus membuat 4 alert (Entry, SL, TP1, TP2)');

      const entryAlert = createdLongAlerts.find((a) => a.planRole === 'entry');
      const slAlert = createdLongAlerts.find((a) => a.planRole === 'sl');
      const tp1Alert = createdLongAlerts.find((a) => a.planRole === 'tp1');
      const tp2Alert = createdLongAlerts.find((a) => a.planRole === 'tp2');

      assert.ok(entryAlert);
      assert.equal(entryAlert.condition, 'crossing');
      assert.equal(entryAlert.targetPrice, 2257.4);
      assert.equal(entryAlert.planId, 'plan_long_alerts_1');

      assert.ok(slAlert);
      assert.equal(slAlert.condition, 'crossing_down');
      assert.equal(slAlert.targetPrice, 2248.0);

      assert.ok(tp1Alert);
      assert.equal(tp1Alert.condition, 'crossing_up');
      assert.equal(tp1Alert.targetPrice, 2282.0);

      assert.ok(tp2Alert);
      assert.equal(tp2Alert.condition, 'crossing_up');
      assert.equal(tp2Alert.targetPrice, 2303.5);

      // 2. Uji SHORT Plan: Entry (crossing), SL (crossing_up), TP1 & TP2 (crossing_down)
      const shortPlan = {
        ...parseTradingPlan(SAMPLE_SHORT_MARKDOWN),
        id: 'plan_short_alerts_1',
        symbol: 'BTCUSDT.P'
      };
      const createdShortAlerts = await alertService.addPlanAlerts(shortPlan, 'BTCUSDT.P');
      assert.equal(createdShortAlerts.length, 4);

      const shortSl = createdShortAlerts.find((a) => a.planRole === 'sl');
      const shortTp1 = createdShortAlerts.find((a) => a.planRole === 'tp1');
      assert.equal(shortSl?.condition, 'crossing_up');
      assert.equal(shortTp1?.condition, 'crossing_down');

      // 3. Uji Lifecycle Cleanup: menghapus planId hanya menghapus alert yang belum terpicu milik plan tersebut
      const removedCount = await alertService.deleteAlertsByPlanId('plan_long_alerts_1');
      assert.equal(removedCount, 4);
      const remaining = alertService.getAlerts();
      assert.equal(remaining.length, 4);
      assert.equal(remaining.every((a) => a.planId === 'plan_short_alerts_1'), true);

      await alertService.clearAllAlerts();
    });

    it('ChartDrawingController mengintegrasikan auto-save Vault dan auto-alerts saat createMultiTargetPosition serta membersihkannya saat removePlan / undo', async () => {
      await clearTradingPlanHistory();
      await alertService.clearAllAlerts();

      const { workspace } = createMockWorkspace();
      const controller = new ChartDrawingController();
      controller.attachWorkspace(
        workspace,
        () => 'ETHUSDT.P',
        () => '15m',
        () => 'binance'
      );

      const parsed = parseTradingPlan(SAMPLE_LONG_MARKDOWN);
      const res = controller.createMultiTargetPosition(
        { ...parsed, symbol: 'ETHUSDT.P' },
        { autoCreateAlerts: true }
      );
      assert.ok(res);
      assert.ok(res.planId);

      // Pastikan alert terbuat di alertService
      const alertsAfterCreate = alertService.getAlerts().filter((a) => a.planId === res.planId);
      assert.equal(alertsAfterCreate.length, 4);

      // Tunggu microtask penyelesaian saveTradingPlanToHistory
      await new Promise((r) => setTimeout(r, 10));

      // Pastikan tersimpan di Trade Plan Vault
      const vaultAfterCreate = await loadTradingPlanHistory();
      assert.equal(vaultAfterCreate.length, 1);
      assert.equal(vaultAfterCreate[0].id, res.planId);

      // Saat di-undo, alert terkait otomatis dihapus dari alertService
      controller.undo();
      const alertsAfterUndo = alertService.getAlerts().filter((a) => a.planId === res.planId);
      assert.equal(alertsAfterUndo.length, 0);

      // Saat di-redo, alert terkait otomatis dipasang kembali
      controller.redo();
      const alertsAfterRedo = alertService.getAlerts().filter((a) => a.planId === res.planId);
      assert.equal(alertsAfterRedo.length, 4);

      // Saat removePlan dipanggil, alert terkait otomatis dibersihkan
      controller.removePlan(res.planId);
      const alertsAfterRemove = alertService.getAlerts().filter((a) => a.planId === res.planId);
      assert.equal(alertsAfterRemove.length, 0);

      await clearTradingPlanHistory();
      await alertService.clearAllAlerts();
    });
  });
});
