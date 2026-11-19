import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseForexFactoryEvents,
  mergeMacroEvents,
  filterMacroEvents,
  getNextUpcomingEvent,
  groupEventsBySchedule,
  formatEventCountdown,
  formatShortEventName,
  MacroEventsService,
} from '../macroEventsService';
import type { MacroCalendarEvent } from '../timelineMarksController';
import { InMemoryLocalStorageAdapter } from '../persistence/inMemoryLocalStorageAdapter';
import { PersistenceService } from '../persistence';

const BASE_EVENTS: MacroCalendarEvent[] = [
  {
    id: 'ev_earlier',
    title: 'US CPI (Consumer Price Index YoY)',
    timestamp: Date.UTC(2026, 10, 17, 13, 30), // Tue 17 Nov 2026 13:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    actual: '2.7%',
    forecast: '2.6%',
    previous: '2.5%',
    category: 'inflation',
  },
  {
    id: 'ev_today_claims',
    title: 'US Initial Jobless Claims',
    timestamp: Date.UTC(2026, 10, 19, 13, 30), // Thu 19 Nov 2026 13:30 UTC
    impact: 'medium',
    country: 'US',
    currency: 'USD',
    forecast: '200K',
    previous: '200K',
    category: 'employment',
  },
  {
    id: 'ev_today_eu',
    title: 'ECB Monetary Policy Decision',
    timestamp: Date.UTC(2026, 10, 19, 12, 15), // Thu 19 Nov 2026 12:15 UTC
    impact: 'high',
    country: 'EU',
    currency: 'EUR',
    forecast: '3.25%',
    previous: '3.50%',
    category: 'central_bank',
  },
  {
    id: 'ev_upcoming_gdp',
    title: 'US GDP Growth Rate QoQ',
    timestamp: Date.UTC(2026, 10, 25, 13, 30), // Wed 25 Nov 2026 13:30 UTC
    impact: 'high',
    country: 'US',
    currency: 'USD',
    forecast: '2.8%',
    previous: '3.0%',
    category: 'growth',
  },
  {
    id: 'ev_upcoming_low',
    title: 'US Baker Hughes Oil Rig Count',
    timestamp: Date.UTC(2026, 10, 19, 11, 0), // Thu 19 Nov 2026 11:00 UTC (lebih dekat tapi low impact)
    impact: 'low',
    country: 'US',
    currency: 'USD',
    category: 'macro',
  },
];

describe('MacroEventsService (Ticket #226)', () => {
  describe('1. Parsing ForexFactory JSON & Filtering News/Holidays', () => {
    it('mengonversi payload ForexFactory dan membuang Holiday/Non-Economic', () => {
      const raw = [
        {
          title: 'Core CPI m/m',
          country: 'USD',
          date: '2026-11-19T13:30:00Z',
          impact: 'High',
          forecast: '0.3%',
          previous: '0.2%',
        },
        {
          title: 'Bank Holiday',
          country: 'JPY',
          date: '2026-11-19T00:00:00Z',
          impact: 'Holiday',
          forecast: '',
          previous: '',
        },
        {
          title: 'FOMC Statement',
          country: 'USD',
          date: '2026-11-20T19:00:00Z',
          impact: 'Medium',
          forecast: '',
          previous: '',
        },
      ];

      const parsed = parseForexFactoryEvents(raw);
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].title, 'Core CPI m/m');
      assert.strictEqual(parsed[0].impact, 'high');
      assert.strictEqual(parsed[0].country, 'US');
      assert.strictEqual(parsed[0].currency, 'USD');
      assert.strictEqual(parsed[0].category, 'inflation');
      assert.strictEqual(parsed[1].category, 'central_bank');
    });
  });

  describe('2. getNextUpcomingEvent & Countdown Formatting', () => {
    it('memilih event terdekat dengan prioritas High/Medium di atas Low', () => {
      const nowMs = Date.UTC(2026, 10, 19, 10, 0); // 19 Nov 2026 10:00 UTC
      const next = getNextUpcomingEvent(BASE_EVENTS, nowMs, { scope: 'us_crypto', category: 'all' });
      assert.ok(next);
      // ev_upcoming_low pukul 11:00 dilewati karena ada ev_today_claims (medium) pukul 13:30
      assert.strictEqual(next.id, 'ev_today_claims');
    });

    it('menghormati filter Major only saat memilih upcoming event', () => {
      const nowMs = Date.UTC(2026, 10, 19, 10, 0);
      const nextMajor = getNextUpcomingEvent(BASE_EVENTS, nowMs, { scope: 'major', category: 'all' });
      assert.ok(nextMajor);
      assert.strictEqual(nextMajor.id, 'ev_today_eu');
    });

    it('memformat countdown dan nama singkat event dengan benar', () => {
      const nowMs = Date.UTC(2026, 10, 19, 7, 57);
      const targetMs = Date.UTC(2026, 10, 19, 13, 30);
      assert.strictEqual(formatEventCountdown(targetMs, nowMs), '5h 33m');
      assert.strictEqual(formatEventCountdown(nowMs + 25 * 60_000, nowMs), '25m');
      assert.strictEqual(formatEventCountdown(nowMs + (6 * 24 + 5) * 3600_000, nowMs), '6d 5h');
      assert.strictEqual(formatShortEventName('US Initial Jobless Claims'), 'Claims');
      assert.strictEqual(formatShortEventName('FOMC Interest Rate Decision'), 'FOMC');
    });
  });

  describe('3. groupEventsBySchedule & Scope/Category Filtering', () => {
    it('mengelompokkan event ke Earlier this week, Today, dan tanggal mendatang', () => {
      const nowMs = Date.UTC(2026, 10, 19, 10, 0); // Thu 19 Nov 2026
      const groups = groupEventsBySchedule(BASE_EVENTS, nowMs, {
        scope: 'all',
        category: 'all',
      });

      assert.strictEqual(groups.length, 3);
      assert.strictEqual(groups[0].kind, 'earlier');
      assert.strictEqual(groups[0].label, 'Earlier this week');
      assert.strictEqual(groups[0].events.length, 1);
      assert.strictEqual(groups[0].defaultCollapsed, true);

      assert.strictEqual(groups[1].kind, 'today');
      assert.ok(groups[1].label.startsWith('Today'));
      assert.strictEqual(groups[1].events.length, 3);
      assert.strictEqual(groups[1].defaultCollapsed, false);

      assert.strictEqual(groups[2].kind, 'upcoming');
      assert.strictEqual(groups[2].events[0].id, 'ev_upcoming_gdp');
    });

    it('memfilter scope Major only dan kategori Employment/Inflation secara akurat', () => {
      const majorOnly = filterMacroEvents(BASE_EVENTS, { scope: 'major', category: 'all' });
      assert.ok(majorOnly.every((e) => e.impact === 'high'));
      assert.strictEqual(majorOnly.length, 3);

      const employmentOnly = filterMacroEvents(BASE_EVENTS, { scope: 'all', category: 'employment' });
      assert.strictEqual(employmentOnly.length, 1);
      assert.strictEqual(employmentOnly[0].id, 'ev_today_claims');
    });
  });

  describe('4. Merge, Cache TTL 30m, Offline Fallback & TimelineMarks Sync', () => {
    it('menggabungkan event live dan katalog fallback tanpa duplikat', () => {
      const fallback: MacroCalendarEvent[] = [
        {
          id: 'us_cpi_2026_11',
          title: 'US CPI (Consumer Price Index YoY)',
          timestamp: Date.UTC(2026, 10, 17, 13, 30),
          impact: 'high',
          country: 'US',
          currency: 'USD',
          forecast: '2.6%',
        },
      ];
      const live: MacroCalendarEvent[] = [
        {
          id: 'ff_usd_cpi',
          title: 'US CPI (Consumer Price Index YoY)',
          timestamp: Date.UTC(2026, 10, 17, 13, 30),
          impact: 'high',
          country: 'US',
          currency: 'USD',
          actual: '2.7%',
          forecast: '2.6%',
        },
      ];

      const merged = mergeMacroEvents(live, fallback);
      assert.strictEqual(merged.length, 1);
      assert.strictEqual(merged[0].actual, '2.7%');
    });

    it('menggunakan cache SQLite/app_preferences dalam TTL 30m dan menyinkronkan ke TimelineMarksController', async () => {
      const adapter = new InMemoryLocalStorageAdapter();
      const persistence = new PersistenceService(adapter);
      let fetchCalls = 0;
      let syncedCount = 0;

      const service = new MacroEventsService({
        persistence,
        fetcher: async () => {
          fetchCalls += 1;
          return [
            {
              title: 'US Initial Jobless Claims',
              country: 'USD',
              date: '2026-11-19T13:30:00Z',
              impact: 'High',
              forecast: '200K',
              previous: '200K',
            },
          ];
        },
      });

      service.attachTimelineController({
        loadMacroEvents(events) {
          syncedCount = events.length;
        },
      });

      await service.refresh();
      assert.strictEqual(fetchCalls, 1);
      assert.ok(syncedCount >= 1);

      // Panggil refresh lagi sebelum TTL 30m habis -> tidak boleh fetch ulang
      await service.refresh();
      assert.strictEqual(fetchCalls, 1);
    });
  });
});
