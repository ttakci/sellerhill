# Dashboard Date Range + Seller Timezone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One date-range filter beside the dashboard tabs drives cards, chart and P&L, and every "day" is the seller's own calendar day (`users.timezone`).

**Architecture:** A pure resolver in `@repo/shared` turns a preset or custom range plus "today in the seller's zone" into the card chain, the chart/P&L granularity and the bucket keys. The API reads `users.timezone`, asks Postgres for the local today, runs the resolver, and aggregates with index-friendly local-midnight bounds. The web stops computing dates: it sends `range`/`from`/`to` and renders the dates the API returns. A new `DateRangePicker` molecule sits on the right of the tab rail.

**Tech Stack:** NestJS 10 + raw `pg`, Postgres 16 (`AT TIME ZONE`, `GROUPING SETS`, `unnest … WITH ORDINALITY`), React 18 + RTK Query + Emotion, Jest (api, runs shared code from `dist/cjs`), Vitest (web).

**Spec:** `docs/superpowers/specs/2026-10-07-dashboard-date-range-design.md`

## Global Constraints

- Default preset is **`today`**.
- "Day" = seller's calendar day from `users.timezone` (IANA); NULL or invalid → `UTC`. Week starts Monday.
- Filters use bounds: `col >= (($from)::date::timestamp AT TIME ZONE ($tz)::text) AND col < ((($to)::date + 1)::timestamp AT TIME ZONE ($tz)::text)`. Buckets use `date_trunc(unit, col AT TIME ZONE tz)`. Never `CURRENT_DATE` in the dashboard.
- UTC stays for: eBay quota day, Best Sellers `viewed_on`, subscription/quota windows, retention.
- Custom range: `from ≤ to ≤ today`, ≤ 731 days → else 400 `dashboard.errors.invalidRange`.
- Granularity: ≤2 days chart hour / P&L day; ≤31 day/day; ≤92 week/week; else month/month.
- Repo rules: 4-file split for every web component; no hardcoded colours/spacing/strings; every new i18n key in all 16 locales (`en tr ru hi ur ar az bn de fr es it ro uk zh pt`); `@repo/ui` never imports `@repo/shared`; rebuild `@repo/shared` before API Jest and `@repo/ui` before web after editing them.
- Shared working tree: other agents commit here. **Stage by explicit path, never `git add -A`, never stash.** Migration number = next free at the time you write it (check `ls apps/api/migrations | tail`, including untracked files).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **DST day** — a range spanning 2026-11-01 in `America/Los_Angeles` must count an order at 01:30 local exactly once and the day bucket must hold 25 hours of orders. Test in Task 2 (bounds SQL against local Postgres).
2. **Month-end comparison clamp** — `thisMonth` on 2026-03-31 compares against 02-01..02-28, never 03-03. Test in Task 1.
3. **Order just before local midnight** — an order at 23:30 Istanbul time (20:30 UTC) belongs to that Istanbul day in the card AND in the order list "view all". Test in Task 3 (SQL against local Postgres, both services).
4. **Stored timezone Postgres doesn't know** (row edited by hand, or a name Node accepts) — dashboard must still answer, using UTC, not 500. Test in Task 2.
5. **Custom range with `to` in the seller's future but the server's past** (seller in UTC−8 asks for "today" at 02:00 UTC) — resolver must judge `to ≤ today` against the seller's today, which the API passes in. Test in Task 4 (controller/service spec with a fake today).

---

## File map

| File | Responsibility |
|---|---|
| `packages/shared/src/domain/dashboard/dashboard-range.ts` (new) | Pure range resolver, presets, bucket keys/windows |
| `packages/shared/src/domain/dashboard/dashboard.types.ts` | DTOs: `range`, `periods`, `chart`, `pnl`; `HOUR` granularity |
| `packages/shared/src/domain/common/timezone.ts` (new) | `DEFAULT_USER_TIMEZONE` |
| `apps/api/migrations/NNN_users_timezone.sql` (new) | `users.timezone` |
| `apps/api/src/common/timezone/` (new) | `TimezoneService`, `TimezoneModule` (@Global), `local-day-sql.ts` |
| `apps/api/src/modules/profile/*` + shared profile types | timezone read/write + validation |
| `apps/api/src/modules/orders/orders.service.ts`, `apps/api/src/modules/listings/listings.service.ts` | local-day filters |
| `apps/api/src/modules/dashboard/*` | range API, e-mail methods |
| `packages/ui/src/molecules/DateRangePicker/` (new) + `DatePicker/monthGrid.ts` (new) | picker molecule |
| `apps/web/src/features/dashboard/**` | wiring, URL state, panels, demo |
| `apps/web/src/features/profile/**`, `apps/web/src/layouts/AppLayout/AppLayout.container.tsx` | timezone card + auto-fill |
| `packages/shared/src/i18n/resources/*/{dashboard,profile}.json` | copy, 16 locales |
| `CLAUDE.md` | docs |

---

### Task 1: Shared range resolver

**Files:**
- Create: `packages/shared/src/domain/dashboard/dashboard-range.ts`
- Modify: `packages/shared/src/domain/dashboard/index.ts`, `packages/shared/src/domain/dashboard/dashboard.types.ts` (add `HOUR` to `DashboardChartGranularity` only — the DTO reshape is Task 4)
- Test: `apps/api/src/modules/dashboard/dashboard-range.spec.ts`

**Interfaces:**
- Produces (exported from `@repo/shared`): `DashboardRangePreset`, `DashboardPeriodUnit`, `DashboardDateWindow`, `DashboardPeriodLabel`, `ResolvedDashboardPeriod`, `DashboardRangeInput`, `ResolvedDashboardRange`, `DashboardBucketWindow`, `DashboardRangeError`, `DASHBOARD_CARD_COUNT` (4), `DASHBOARD_MAX_RANGE_DAYS` (731), `DEFAULT_DASHBOARD_RANGE_PRESET`, `isIsoDate(v)`, `addIsoDays(iso, n)`, `rangeDayCount(w)`, `resolveDashboardRange(input, today)`, `dashboardGranularityFor(days)`, `dashboardBucketKeys(range, g)`, `dashboardBucketWindows(range, g)`.

- [ ] **Step 1: Add `HOUR` to the granularity enum**

In `dashboard.types.ts`:

```ts
export enum DashboardChartGranularity {
  /** One point per hour — ranges of up to 2 days. */
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}
```

- [ ] **Step 2: Write the failing spec**

`apps/api/src/modules/dashboard/dashboard-range.spec.ts`:

```ts
import {
  DashboardChartGranularity as G,
  DashboardPeriodUnit,
  DashboardRangeError,
  DashboardRangePreset as P,
  dashboardBucketKeys,
  dashboardBucketWindows,
  resolveDashboardRange,
} from '@repo/shared';

// 2026-10-07 is a Wednesday; Monday of its week is 10-05.
const TODAY = '2026-10-07';
const win = (p: { from: string; to: string }) => `${p.from}..${p.to}`;

describe('resolveDashboardRange — calendar presets', () => {
  it('today: today, yesterday, 2 and 3 days ago; hourly chart', () => {
    const r = resolveDashboardRange({ preset: P.TODAY }, TODAY);
    expect(r.periods.map(win)).toEqual([
      '2026-10-07..2026-10-07', '2026-10-06..2026-10-06', '2026-10-05..2026-10-05', '2026-10-04..2026-10-04',
    ]);
    expect(win(r.periods[0].comparison)).toBe('2026-10-06..2026-10-06');
    expect(r.periods.map((p) => p.label.offset)).toEqual([0, 1, 2, 3]);
    expect(r.periods[0].label.unit).toBe(DashboardPeriodUnit.DAY);
    expect(r.chartGranularity).toBe(G.HOUR);
    expect(r.pnlGranularity).toBe(G.DAY);
  });

  it('yesterday starts the chain one day back', () => {
    const r = resolveDashboardRange({ preset: P.YESTERDAY }, TODAY);
    expect(win(r.range)).toBe('2026-10-06..2026-10-06');
    expect(r.periods.map((p) => p.label.offset)).toEqual([1, 2, 3, 4]);
  });

  it('thisWeek is to-date and compares the same elapsed days of last week', () => {
    const r = resolveDashboardRange({ preset: P.THIS_WEEK }, TODAY);
    expect(win(r.periods[0])).toBe('2026-10-05..2026-10-07');
    expect(win(r.periods[0].comparison)).toBe('2026-09-28..2026-09-30');
    expect(win(r.periods[1])).toBe('2026-09-28..2026-10-04');
    expect(win(r.periods[1].comparison)).toBe('2026-09-21..2026-09-27');
  });

  it('thisMonth: month-to-date, then full previous months', () => {
    const r = resolveDashboardRange({ preset: P.THIS_MONTH }, TODAY);
    expect(r.periods.map(win)).toEqual([
      '2026-10-01..2026-10-07', '2026-09-01..2026-09-30', '2026-08-01..2026-08-31', '2026-07-01..2026-07-31',
    ]);
    expect(win(r.periods[0].comparison)).toBe('2026-09-01..2026-09-07');
    expect(win(r.periods[3].comparison)).toBe('2026-06-01..2026-06-30');
    expect(r.chartGranularity).toBe(G.DAY);
  });

  it('clamps the to-date comparison at the end of a shorter month', () => {
    const r = resolveDashboardRange({ preset: P.THIS_MONTH }, '2026-03-31');
    expect(win(r.periods[0].comparison)).toBe('2026-02-01..2026-02-28');
  });

  it('thisYear compares the same days of last year; monthly chart', () => {
    const r = resolveDashboardRange({ preset: P.THIS_YEAR }, TODAY);
    expect(win(r.periods[0])).toBe('2026-01-01..2026-10-07');
    expect(win(r.periods[0].comparison)).toBe('2025-01-01..2025-10-07');
    expect(r.chartGranularity).toBe(G.MONTH);
  });

  it('lastMonth is a full month with a full-month comparison', () => {
    const r = resolveDashboardRange({ preset: P.LAST_MONTH }, TODAY);
    expect(win(r.periods[0])).toBe('2026-09-01..2026-09-30');
    expect(win(r.periods[0].comparison)).toBe('2026-08-01..2026-08-31');
  });
});

describe('resolveDashboardRange — rolling presets and custom ranges', () => {
  it('last7Days steps back by 7 days', () => {
    const r = resolveDashboardRange({ preset: P.LAST_7_DAYS }, TODAY);
    expect(r.periods.slice(0, 2).map(win)).toEqual(['2026-10-01..2026-10-07', '2026-09-24..2026-09-30']);
    expect(r.periods[0].label).toEqual({ unit: DashboardPeriodUnit.SPAN, offset: 0, preset: P.LAST_7_DAYS });
    expect(r.periods[1].label.preset).toBeNull();
  });

  it('last3Months is 92 days → weekly', () => {
    const r = resolveDashboardRange({ preset: P.LAST_3_MONTHS }, TODAY);
    expect(win(r.range)).toBe('2026-07-08..2026-10-07');
    expect(r.chartGranularity).toBe(G.WEEK);
  });

  it('last12Months → monthly', () => {
    const r = resolveDashboardRange({ preset: P.LAST_12_MONTHS }, TODAY);
    expect(win(r.range)).toBe('2025-10-08..2026-10-07');
    expect(r.chartGranularity).toBe(G.MONTH);
  });

  it('a custom range steps back by its own length', () => {
    const r = resolveDashboardRange({ from: '2026-09-10', to: '2026-09-19' }, TODAY);
    expect(r.preset).toBeNull();
    expect(r.periods.slice(0, 2).map(win)).toEqual(['2026-09-10..2026-09-19', '2026-08-31..2026-09-09']);
    expect(win(r.periods[0].comparison)).toBe('2026-08-31..2026-09-09');
  });

  it.each([
    [{ from: '2026-10-01', to: '2026-10-08' }, 'to after today'],
    [{ from: '2026-10-05', to: '2026-10-01' }, 'from after to'],
    [{ from: '2026-02-31', to: '2026-03-01' }, 'not a real date'],
    [{ from: '2024-10-06', to: '2026-10-07' }, 'longer than 731 days'],
  ])('refuses %j (%s)', (input) => {
    expect(() => resolveDashboardRange(input, TODAY)).toThrow(DashboardRangeError);
  });

  it('refuses an unknown preset', () => {
    expect(() => resolveDashboardRange({ preset: 'nope' as P }, TODAY)).toThrow(DashboardRangeError);
  });
});

describe('bucket keys and windows', () => {
  it('hour keys match to_char(…, YYYY-MM-DD HH24)', () => {
    const keys = dashboardBucketKeys({ from: TODAY, to: TODAY }, G.HOUR);
    expect(keys).toHaveLength(24);
    expect(keys[0]).toBe('2026-10-07 00');
    expect(keys[23]).toBe('2026-10-07 23');
  });

  it('week keys start on the Monday on or before `from`', () => {
    const keys = dashboardBucketKeys({ from: '2026-07-08', to: TODAY }, G.WEEK);
    expect(keys[0]).toBe('2026-07-06');
    expect(keys[keys.length - 1]).toBe('2026-10-05');
    expect(keys).toHaveLength(14);
  });

  it('month windows are clipped to the range', () => {
    const w = dashboardBucketWindows({ from: '2026-01-01', to: TODAY }, G.MONTH);
    expect(w[0]).toEqual({ key: '2026-01-01', from: '2026-01-01', to: '2026-01-31' });
    expect(w[w.length - 1]).toEqual({ key: '2026-10-01', from: '2026-10-01', to: TODAY });
  });

  it('day windows are one per day', () => {
    const w = dashboardBucketWindows({ from: '2026-10-01', to: TODAY }, G.DAY);
    expect(w).toHaveLength(7);
    expect(w[6]).toEqual({ key: TODAY, from: TODAY, to: TODAY });
  });
});
```

- [ ] **Step 3: Run it — fails (exports missing)**

Run: `pnpm --filter @repo/shared build; pnpm --filter api test -- dashboard-range`
Expected: FAIL, `resolveDashboardRange is not a function` (or TS error on imports).

- [ ] **Step 4: Implement `dashboard-range.ts`**

```ts
/**
 * Dashboard date ranges — ONE pure resolver shared by the API and the demo.
 *
 * Input: a preset or a custom { from, to }, plus "today" as a YYYY-MM-DD the
 * caller obtained IN THE SELLER'S TIME ZONE. All arithmetic is on calendar
 * dates (UTC-based Date math on date-only strings), so the process time zone
 * can never shift a day.
 */

import { DashboardChartGranularity } from './dashboard.types';

export enum DashboardRangePreset {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last7Days',
  LAST_30_DAYS = 'last30Days',
  THIS_WEEK = 'thisWeek',
  LAST_WEEK = 'lastWeek',
  THIS_MONTH = 'thisMonth',
  LAST_MONTH = 'lastMonth',
  LAST_3_MONTHS = 'last3Months',
  THIS_YEAR = 'thisYear',
  LAST_YEAR = 'lastYear',
  LAST_12_MONTHS = 'last12Months',
}

/** How a card is labelled: calendar units count back from "this"; SPAN renders its dates. */
export enum DashboardPeriodUnit {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  SPAN = 'span',
}

export interface DashboardDateWindow {
  from: string;
  to: string;
}

export interface DashboardPeriodLabel {
  unit: DashboardPeriodUnit;
  /** 0 = this/today, 1 = last/yesterday, n = n units ago. For SPAN, the index in the chain. */
  offset: number;
  /** Set on the first SPAN card of a preset, so it reads "Last 7 days". */
  preset: DashboardRangePreset | null;
}

export interface ResolvedDashboardPeriod extends DashboardDateWindow {
  label: DashboardPeriodLabel;
  /** What this card's trend is measured against. */
  comparison: DashboardDateWindow;
}

export type DashboardRangeInput = { preset: DashboardRangePreset } | DashboardDateWindow;

export interface ResolvedDashboardRange {
  preset: DashboardRangePreset | null;
  range: DashboardDateWindow;
  /** Newest first; periods[0] is the range itself. */
  periods: ResolvedDashboardPeriod[];
  chartGranularity: DashboardChartGranularity;
  pnlGranularity: DashboardChartGranularity;
}

export interface DashboardBucketWindow extends DashboardDateWindow {
  /** Matches the SQL bucket key (to_char of date_trunc). */
  key: string;
}

export const DASHBOARD_CARD_COUNT = 4;
export const DASHBOARD_MAX_RANGE_DAYS = 731;
export const DEFAULT_DASHBOARD_RANGE_PRESET = DashboardRangePreset.TODAY;

export class DashboardRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardRangeError';
  }
}

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toMs = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-31). */
export const isIsoDate = (value: string): boolean => ISO_DATE.test(value) && fromMs(toMs(value)) === value;

export const addIsoDays = (iso: string, days: number): string => fromMs(toMs(iso) + days * DAY_MS);

const addIsoMonths = (iso: string, months: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return fromMs(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, lastDay)));
};

/** Inclusive day count of a window. */
export const rangeDayCount = (w: DashboardDateWindow): number => Math.round((toMs(w.to) - toMs(w.from)) / DAY_MS) + 1;

const minIso = (a: string, b: string): string => (a < b ? a : b);
const maxIso = (a: string, b: string): string => (a > b ? a : b);

const startOfWeek = (iso: string): string => {
  const dow = new Date(toMs(iso)).getUTCDay(); // 0 Sun … 6 Sat
  return addIsoDays(iso, dow === 0 ? -6 : 1 - dow);
};

type CalendarUnit = DashboardPeriodUnit.DAY | DashboardPeriodUnit.WEEK | DashboardPeriodUnit.MONTH | DashboardPeriodUnit.YEAR;

const unitStart = (unit: CalendarUnit, iso: string): string => {
  switch (unit) {
    case DashboardPeriodUnit.DAY:
      return iso;
    case DashboardPeriodUnit.WEEK:
      return startOfWeek(iso);
    case DashboardPeriodUnit.MONTH:
      return `${iso.slice(0, 7)}-01`;
    default:
      return `${iso.slice(0, 4)}-01-01`;
  }
};

/** Moves a unit START by n units (a start is always day 1 for months/years, so no clamping). */
const shiftUnit = (unit: CalendarUnit, start: string, n: number): string => {
  switch (unit) {
    case DashboardPeriodUnit.DAY:
      return addIsoDays(start, n);
    case DashboardPeriodUnit.WEEK:
      return addIsoDays(start, 7 * n);
    case DashboardPeriodUnit.MONTH:
      return addIsoMonths(start, n);
    default:
      return addIsoMonths(start, 12 * n);
  }
};

/** The full calendar unit `offset` units before the one containing `today`. */
const unitWindow = (unit: CalendarUnit, today: string, offset: number): DashboardDateWindow => {
  const from = shiftUnit(unit, unitStart(unit, today), -offset);
  return { from, to: addIsoDays(shiftUnit(unit, from, 1), -1) };
};

const CALENDAR_PRESETS: Partial<Record<DashboardRangePreset, { unit: CalendarUnit; offset: number }>> = {
  [DashboardRangePreset.TODAY]: { unit: DashboardPeriodUnit.DAY, offset: 0 },
  [DashboardRangePreset.YESTERDAY]: { unit: DashboardPeriodUnit.DAY, offset: 1 },
  [DashboardRangePreset.THIS_WEEK]: { unit: DashboardPeriodUnit.WEEK, offset: 0 },
  [DashboardRangePreset.LAST_WEEK]: { unit: DashboardPeriodUnit.WEEK, offset: 1 },
  [DashboardRangePreset.THIS_MONTH]: { unit: DashboardPeriodUnit.MONTH, offset: 0 },
  [DashboardRangePreset.LAST_MONTH]: { unit: DashboardPeriodUnit.MONTH, offset: 1 },
  [DashboardRangePreset.THIS_YEAR]: { unit: DashboardPeriodUnit.YEAR, offset: 0 },
  [DashboardRangePreset.LAST_YEAR]: { unit: DashboardPeriodUnit.YEAR, offset: 1 },
};

const rollingWindow = (preset: DashboardRangePreset, today: string): DashboardDateWindow | null => {
  switch (preset) {
    case DashboardRangePreset.LAST_7_DAYS:
      return { from: addIsoDays(today, -6), to: today };
    case DashboardRangePreset.LAST_30_DAYS:
      return { from: addIsoDays(today, -29), to: today };
    case DashboardRangePreset.LAST_3_MONTHS:
      return { from: addIsoDays(addIsoMonths(today, -3), 1), to: today };
    case DashboardRangePreset.LAST_12_MONTHS:
      return { from: addIsoDays(addIsoMonths(today, -12), 1), to: today };
    default:
      return null;
  }
};

export function dashboardGranularityFor(days: number): {
  chartGranularity: DashboardChartGranularity;
  pnlGranularity: DashboardChartGranularity;
} {
  if (days <= 2) {
    return { chartGranularity: DashboardChartGranularity.HOUR, pnlGranularity: DashboardChartGranularity.DAY };
  }
  if (days <= 31) {
    return { chartGranularity: DashboardChartGranularity.DAY, pnlGranularity: DashboardChartGranularity.DAY };
  }
  if (days <= 92) {
    return { chartGranularity: DashboardChartGranularity.WEEK, pnlGranularity: DashboardChartGranularity.WEEK };
  }
  return { chartGranularity: DashboardChartGranularity.MONTH, pnlGranularity: DashboardChartGranularity.MONTH };
}

const calendarPeriods = (
  preset: DashboardRangePreset,
  unit: CalendarUnit,
  offset: number,
  today: string,
): ResolvedDashboardPeriod[] => {
  const full = Array.from({ length: DASHBOARD_CARD_COUNT + 1 }, (_, k) => unitWindow(unit, today, offset + k));
  // The unit containing today ends today (to-date).
  const clipped = full.map((w) => (w.to > today ? { from: w.from, to: today } : w));
  return clipped.slice(0, DASHBOARD_CARD_COUNT).map((w, k) => {
    const previous = clipped[k + 1];
    const toDate = full[k].to > today;
    const comparison = toDate
      ? { from: previous.from, to: minIso(addIsoDays(previous.from, rangeDayCount(w) - 1), previous.to) }
      : previous;
    return { ...w, label: { unit, offset: offset + k, preset: k === 0 ? preset : null }, comparison };
  });
};

const spanPeriods = (first: DashboardDateWindow, preset: DashboardRangePreset | null): ResolvedDashboardPeriod[] => {
  const length = rangeDayCount(first);
  const windows = Array.from({ length: DASHBOARD_CARD_COUNT + 1 }, (_, k) => ({
    from: addIsoDays(first.from, -k * length),
    to: addIsoDays(first.to, -k * length),
  }));
  return windows.slice(0, DASHBOARD_CARD_COUNT).map((w, k) => ({
    ...w,
    label: { unit: DashboardPeriodUnit.SPAN, offset: k, preset: k === 0 ? preset : null },
    comparison: windows[k + 1],
  }));
};

const finish = (preset: DashboardRangePreset | null, periods: ResolvedDashboardPeriod[]): ResolvedDashboardRange => {
  const range = { from: periods[0].from, to: periods[0].to };
  return { preset, range, periods, ...dashboardGranularityFor(rangeDayCount(range)) };
};

export function resolveDashboardRange(input: DashboardRangeInput, today: string): ResolvedDashboardRange {
  if (!isIsoDate(today)) {
    throw new DashboardRangeError(`invalid today: ${today}`);
  }
  if ('preset' in input) {
    const calendar = CALENDAR_PRESETS[input.preset];
    if (calendar) {
      return finish(input.preset, calendarPeriods(input.preset, calendar.unit, calendar.offset, today));
    }
    const rolling = rollingWindow(input.preset, today);
    if (!rolling) {
      throw new DashboardRangeError(`unknown preset: ${String(input.preset)}`);
    }
    return finish(input.preset, spanPeriods(rolling, input.preset));
  }
  const { from, to } = input;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to || to > today) {
    throw new DashboardRangeError(`invalid range: ${from}..${to}`);
  }
  if (rangeDayCount(input) > DASHBOARD_MAX_RANGE_DAYS) {
    throw new DashboardRangeError(`range longer than ${DASHBOARD_MAX_RANGE_DAYS} days`);
  }
  return finish(null, spanPeriods({ from, to }, null));
}

/** Oldest → newest bucket keys, equal to the SQL `to_char(date_trunc(…))` keys. */
export function dashboardBucketKeys(range: DashboardDateWindow, granularity: DashboardChartGranularity): string[] {
  const keys: string[] = [];
  if (granularity === DashboardChartGranularity.HOUR || granularity === DashboardChartGranularity.DAY) {
    for (let day = range.from; day <= range.to; day = addIsoDays(day, 1)) {
      if (granularity === DashboardChartGranularity.DAY) {
        keys.push(day);
      } else {
        for (let h = 0; h < 24; h += 1) {
          keys.push(`${day} ${pad2(h)}`);
        }
      }
    }
    return keys;
  }
  if (granularity === DashboardChartGranularity.WEEK) {
    for (let k = startOfWeek(range.from); k <= range.to; k = addIsoDays(k, 7)) {
      keys.push(k);
    }
    return keys;
  }
  for (let k = `${range.from.slice(0, 7)}-01`; k <= range.to; k = addIsoMonths(k, 1)) {
    keys.push(k);
  }
  return keys;
}

/** Day/week/month buckets of the range, each clipped to it. Oldest → newest. Not for HOUR. */
export function dashboardBucketWindows(
  range: DashboardDateWindow,
  granularity: DashboardChartGranularity,
): DashboardBucketWindow[] {
  return dashboardBucketKeys(range, granularity).map((key) => {
    const end =
      granularity === DashboardChartGranularity.WEEK
        ? addIsoDays(key, 6)
        : granularity === DashboardChartGranularity.MONTH
          ? addIsoDays(addIsoMonths(key, 1), -1)
          : key;
    return { key, from: maxIso(key, range.from), to: minIso(end, range.to) };
  });
}
```

Export it: `packages/shared/src/domain/dashboard/index.ts` → add `export * from './dashboard-range';`.

- [ ] **Step 5: Run the spec — passes**

Run: `pnpm --filter @repo/shared build; pnpm --filter api test -- dashboard-range`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/domain/dashboard/dashboard-range.ts packages/shared/src/domain/dashboard/index.ts packages/shared/src/domain/dashboard/dashboard.types.ts apps/api/src/modules/dashboard/dashboard-range.spec.ts
git commit -m "feat(dashboard): pure range resolver for presets, custom ranges and buckets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `users.timezone`, `TimezoneService`, local-day SQL, profile

**Files:**
- Create: `apps/api/migrations/NNN_users_timezone.sql`, `apps/api/src/common/timezone/timezone.service.ts`, `apps/api/src/common/timezone/timezone.module.ts`, `apps/api/src/common/timezone/local-day-sql.ts`, `packages/shared/src/domain/common/timezone.ts`
- Modify: `apps/api/src/app.module.ts`, `packages/shared/src/domain/common/index.ts` (or wherever `common.constants` is re-exported — check `packages/shared/src/domain/common/`), `packages/shared/src/domain/profile/profile.types.ts`, `apps/api/src/modules/profile/dto/update-profile.dto.ts`, `apps/api/src/modules/profile/profile.service.ts`, `packages/shared/src/i18n/resources/*/profile.json` (error key, 16 locales)
- Test: `apps/api/src/common/timezone/local-day-sql.spec.ts`, `apps/api/src/common/timezone/timezone.service.spec.ts`, `apps/api/src/modules/profile/profile-timezone.spec.ts`

**Interfaces:**
- Produces: `DEFAULT_USER_TIMEZONE = 'UTC'` (`@repo/shared`); `TimezoneService.isValid(name): Promise<boolean>`, `TimezoneService.getForUser(userId): Promise<string>`; `localDayStartSql(dateExpr, tzExpr)`, `localDayEndExclusiveSql(dateExpr, tzExpr)`, `buildLocalRangeSql(column, fromExpr, toExpr, tzExpr)`; `ProfileDto.timezone?: string`, `UpdateProfileRequest.timezone?: string`.

- [ ] **Step 1: Migration**

`apps/api/migrations/NNN_users_timezone.sql` (NNN = next free number):

```sql
-- The seller's own calendar day for the dashboard and the daily summary e-mail.
-- IANA name validated against pg_timezone_names by the API; NULL = UTC.
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT NULL;
COMMENT ON COLUMN users.timezone IS 'IANA time zone (pg_timezone_names). NULL = UTC.';
```

Apply locally: restart the API or `pnpm --filter api migrate` (check `apps/api/package.json` for the script name).

- [ ] **Step 2: Failing specs for the SQL helper**

`apps/api/src/common/timezone/local-day-sql.spec.ts`:

```ts
import { buildLocalRangeSql, localDayEndExclusiveSql, localDayStartSql } from './local-day-sql';

describe('local-day SQL', () => {
  it('turns a local date into its local midnight as an instant', () => {
    expect(localDayStartSql('$2', '$4')).toBe('(($2)::date::timestamp AT TIME ZONE ($4)::text)');
  });

  it('ends at the NEXT local midnight, exclusive', () => {
    expect(localDayEndExclusiveSql('$3', '$4')).toBe('((($3)::date + 1)::timestamp AT TIME ZONE ($4)::text)');
  });

  it('bounds the column on both sides without casting the column', () => {
    const sql = buildLocalRangeSql('o.order_date', '$2', '$3', '$4');
    expect(sql).toBe(
      'o.order_date >= (($2)::date::timestamp AT TIME ZONE ($4)::text) AND o.order_date < ((($3)::date + 1)::timestamp AT TIME ZONE ($4)::text)',
    );
    expect(sql).not.toMatch(/o\.order_date\s+AT TIME ZONE/);
  });
});
```

`apps/api/src/common/timezone/timezone.service.spec.ts`:

```ts
import { TimezoneService } from './timezone.service';

function make(rows: { timezone: string | null }[], names = ['UTC', 'Europe/Istanbul', 'America/Los_Angeles']) {
  const query = jest.fn(async (sql: string) =>
    sql.includes('pg_timezone_names') ? names.map((name) => ({ name })) : rows,
  );
  return { service: new TimezoneService({ query } as never), query };
}

describe('TimezoneService', () => {
  it('accepts a name Postgres knows and refuses one it does not', async () => {
    const { service } = make([]);
    await expect(service.isValid('Europe/Istanbul')).resolves.toBe(true);
    await expect(service.isValid('Mars/Olympus')).resolves.toBe(false);
    await expect(service.isValid('')).resolves.toBe(false);
  });

  it('loads pg_timezone_names once', async () => {
    const { service, query } = make([]);
    await service.isValid('UTC');
    await service.isValid('UTC');
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('pg_timezone_names'))).toHaveLength(1);
  });

  it('returns the stored zone', async () => {
    await expect(make([{ timezone: 'Europe/Istanbul' }]).service.getForUser('u1')).resolves.toBe('Europe/Istanbul');
  });

  it('falls back to UTC for NULL, for a missing user and for a name Postgres does not know', async () => {
    await expect(make([{ timezone: null }]).service.getForUser('u1')).resolves.toBe('UTC');
    await expect(make([]).service.getForUser('u1')).resolves.toBe('UTC');
    await expect(make([{ timezone: 'Mars/Olympus' }]).service.getForUser('u1')).resolves.toBe('UTC');
  });
});
```

Run: `pnpm --filter api test -- timezone local-day-sql` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`packages/shared/src/domain/common/timezone.ts`:

```ts
/** A seller whose `users.timezone` is empty sees days in UTC (the behaviour before the column existed). */
export const DEFAULT_USER_TIMEZONE = 'UTC';
```

Export it from the common barrel (same file that exports `common.constants`).

`apps/api/src/common/timezone/local-day-sql.ts`:

```ts
/**
 * Local-calendar-day bounds for a timestamptz column.
 *
 * A filter ALWAYS compares the raw column against two instants (local midnight
 * of `from`, local midnight of the day after `to`) — index-friendly, and right
 * on a 23- or 25-hour DST day. Never cast the column (`col AT TIME ZONE tz`) in
 * a WHERE; that is for GROUP BY buckets only.
 *
 * Arguments are SQL expressions (placeholders like `$2`, or `w.d_from`), never
 * user text.
 */
export function localDayStartSql(dateExpr: string, tzExpr: string): string {
  return `((${dateExpr})::date::timestamp AT TIME ZONE (${tzExpr})::text)`;
}

export function localDayEndExclusiveSql(dateExpr: string, tzExpr: string): string {
  return `(((${dateExpr})::date + 1)::timestamp AT TIME ZONE (${tzExpr})::text)`;
}

export function buildLocalRangeSql(column: string, fromExpr: string, toExpr: string, tzExpr: string): string {
  return `${column} >= ${localDayStartSql(fromExpr, tzExpr)} AND ${column} < ${localDayEndExclusiveSql(toExpr, tzExpr)}`;
}
```

`apps/api/src/common/timezone/timezone.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_USER_TIMEZONE } from '@repo/shared';

import { DatabaseService } from '../database/database.service';

/**
 * The seller's time zone. Names are validated against POSTGRES
 * (`pg_timezone_names`), not Node: SQL is what consumes them, and a name Node
 * accepts but Postgres does not would make every dashboard query fail (22023).
 */
@Injectable()
export class TimezoneService {
  private readonly logger = new Logger(TimezoneService.name);
  private names: Promise<Set<string>> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  private loadNames(): Promise<Set<string>> {
    if (!this.names) {
      this.names = this.databaseService
        .query<{ name: string }>('SELECT name FROM pg_timezone_names')
        .then((rows) => new Set(rows.map((row) => row.name)))
        .catch((error: unknown) => {
          this.names = null; // retry on the next call
          throw error;
        });
    }
    return this.names;
  }

  async isValid(name: string): Promise<boolean> {
    if (!name || name.length > 64) {
      return false;
    }
    return (await this.loadNames()).has(name);
  }

  /** The stored zone, or UTC when it is empty, unknown to Postgres, or unreadable. */
  async getForUser(userId: string): Promise<string> {
    try {
      const rows = await this.databaseService.query<{ timezone: string | null }>(
        'SELECT timezone FROM users WHERE id = $1',
        [userId],
      );
      const stored = rows[0]?.timezone;
      if (!stored) {
        return DEFAULT_USER_TIMEZONE;
      }
      if (await this.isValid(stored)) {
        return stored;
      }
      this.logger.warn(`users.timezone for ${userId} is not a Postgres zone; using UTC`);
    } catch (error) {
      this.logger.warn(`timezone lookup failed for ${userId}; using UTC: ${String(error)}`);
    }
    return DEFAULT_USER_TIMEZONE;
  }
}
```

`apps/api/src/common/timezone/timezone.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { TimezoneService } from './timezone.service';

/** Global, like PlatformSettingsService — any module can read a seller's day. */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [TimezoneService],
  exports: [TimezoneService],
})
export class TimezoneModule {}
```

Add `TimezoneModule` to `AppModule.imports` next to `SettingsModule`.

- [ ] **Step 4: Run — passes**

Run: `pnpm --filter @repo/shared build; pnpm --filter api test -- timezone local-day-sql`
Expected: PASS.

- [ ] **Step 5: DST + unknown-zone check against local Postgres (Review Focus 1, 4)**

With `pnpm docker:up` running, execute in psql (`docker exec -it sellerhill_postgres psql -U <user> -d <db>`; read user/db from `apps/api/.env`):

```sql
-- 2026-11-01 is 25 hours long in Los Angeles: 07:00Z → 08:00Z next day.
SELECT ('2026-11-01'::date::timestamp AT TIME ZONE 'America/Los_Angeles') AS start_z,
       (('2026-11-01'::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles') AS end_z,
       (('2026-11-01'::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
         - ('2026-11-01'::date::timestamp AT TIME ZONE 'America/Los_Angeles') AS length;
```

Expected: `length = 25:00:00`. Then `SELECT 'x'::date::timestamp AT TIME ZONE 'Mars/Olympus';` errors 22023 — the reason `getForUser` validates. Record both outputs in the task report.

- [ ] **Step 6: Profile carries and validates the zone — failing spec**

`apps/api/src/modules/profile/profile-timezone.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

import { ProfileService } from './profile.service';

const ROW = {
  id: 'u1', first_name: 'A', last_name: 'B', email: 'a@b.c', phone_number: null, avatar_url: null,
  job_title: null, bio: null, country: null, city_state: null, postal_code: null, timezone: 'Europe/Istanbul',
  email_verified: true, status: 'active', created_at: new Date(0), updated_at: new Date(0),
};

function make(valid: boolean) {
  const query = jest.fn(async () => [ROW]);
  const timezones = { isValid: jest.fn(async () => valid) };
  return { service: new ProfileService({ query } as never, timezones as never), query };
}

describe('profile timezone', () => {
  it('returns the stored zone', async () => {
    await expect(make(true).service.getProfile('u1')).resolves.toMatchObject({ timezone: 'Europe/Istanbul' });
  });

  it('writes a zone Postgres knows', async () => {
    const { service, query } = make(true);
    await service.updateProfile('u1', { timezone: 'Europe/Istanbul' });
    expect(String(query.mock.calls[0][0])).toContain('timezone = $1');
  });

  it('refuses a zone Postgres does not know, writing nothing', async () => {
    const { service, query } = make(false);
    await expect(service.updateProfile('u1', { timezone: 'Mars/Olympus' })).rejects.toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
});
```

Run → FAIL.

- [ ] **Step 7: Implement profile changes**

- `profile.types.ts`: add `timezone?: string;` to `ProfileDto` and `UpdateProfileRequest`.
- `update-profile.dto.ts`: add

```ts
  @ApiPropertyOptional({ description: 'IANA time zone', example: 'Europe/Istanbul' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
```

(import `MaxLength` from `class-validator`).
- `profile.service.ts`: inject `TimezoneService` as the second constructor parameter; add `timezone: string | null` to `UserEntity`; add `timezone` to the SELECT column list in `getProfile`; add `timezone: 'timezone'` to `fieldsTemplate`; at the top of `updateProfile`:

```ts
    if (request.timezone !== undefined && !(await this.timezoneService.isValid(request.timezone))) {
      throw new BadRequestException('profile.errors.invalidTimezone');
    }
```

and `timezone: user.timezone || undefined` in `mapToDto`.
- i18n: add `"errors": { "invalidTimezone": "…" }` under the `profile` root of every `profile.json` (16 locales; if an `errors` object exists, add the key into it). EN "This time zone is not recognised.", TR "Bu saat dilimi tanınmıyor."; write the other 14 natively.

- [ ] **Step 8: Run all API tests touching profile/timezone — pass**

Run: `pnpm --filter @repo/shared build; pnpm --filter api test -- profile timezone local-day-sql`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/migrations/NNN_users_timezone.sql apps/api/src/common/timezone apps/api/src/app.module.ts packages/shared/src/domain/common packages/shared/src/domain/profile/profile.types.ts apps/api/src/modules/profile packages/shared/src/i18n/resources/*/profile.json
git commit -m "feat(timezone): users.timezone, Postgres-validated TimezoneService, local-day SQL bounds" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Orders and listings date filters use the seller's day

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts:232-243` (dateFrom/dateTo), `apps/api/src/modules/listings/listings.service.ts:605-621` (soldFrom/soldTo; CSV export reuses `getListings`)
- Test: `apps/api/src/common/timezone/local-day-filters.guard.spec.ts`

**Interfaces:**
- Consumes: `TimezoneService.getForUser`, `localDayStartSql`, `localDayEndExclusiveSql` (Task 2).

- [ ] **Step 1: Failing guard spec**

```ts
import * as fs from 'fs';
import * as path from 'path';

const read = (...p: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8').replace(/\r\n/g, '\n');

describe('order-date filters are bounded by the seller’s local midnight', () => {
  const orders = read('modules', 'orders', 'orders.service.ts');
  const listings = read('modules', 'listings', 'listings.service.ts');

  it('orders dateFrom/dateTo use the local-day helpers', () => {
    expect(orders).toMatch(/localDayStartSql\(/);
    expect(orders).toMatch(/localDayEndExclusiveSql\(/);
    expect(orders).not.toMatch(/o\.order_date >= \$\$\{paramIndex\}::date/);
  });

  it('listings soldFrom/soldTo use the local-day helpers', () => {
    expect(listings).toMatch(/o_sold\.order_date >= \$\{localDayStartSql\(/);
    expect(listings).toMatch(/o_sold\.order_date < \$\{localDayEndExclusiveSql\(/);
    expect(listings).not.toMatch(/o_sold\.order_date >= \$\$\{paramIndex\}::date/);
  });
});
```

Run: `pnpm --filter api test -- local-day-filters` → FAIL.

- [ ] **Step 2: Orders**

Inject `TimezoneService` as the last constructor parameter of `OrdersService` (no spec constructs `OrdersService`; confirm with `grep -rn "new OrdersService(" apps/api/src`). Replace the two blocks:

```ts
    if (filters?.dateFrom || filters?.dateTo) {
      // The seller's calendar day: local midnight → next local midnight.
      const tz = await this.timezoneService.getForUser(userId);
      const tzParam = `$${paramIndex}`;
      params.push(tz);
      paramIndex++;
      if (filters.dateFrom) {
        conditions.push(`o.order_date >= ${localDayStartSql(`$${paramIndex}`, tzParam)}`);
        params.push(filters.dateFrom);
        paramIndex++;
      }
      if (filters.dateTo) {
        conditions.push(`o.order_date < ${localDayEndExclusiveSql(`$${paramIndex}`, tzParam)}`);
        params.push(filters.dateTo);
        paramIndex++;
      }
    }
```

Check `findAll`'s count query reuses the same `conditions`/`params` (it does if built once — verify; if the count query rebuilds params, mirror the change there).

- [ ] **Step 3: Listings**

Add `TimezoneService` to `ListingsService` as a NEW last parameter, `@Optional() private readonly timezoneService?: TimezoneService` (after `storeSettings`; specs construct the service with 7 args, so it must be optional). Replace the soldFrom/soldTo block:

```ts
    if (query.soldFrom?.trim() || query.soldTo?.trim()) {
      const soldConds: string[] = [
        'o_sold.listing_id = l.id',
        'o_sold.user_id = l.user_id',
        `o_sold.status <> '${OrderStatus.CANCELLED}'`,
      ];
      const tz = (await this.timezoneService?.getForUser(userId)) ?? DEFAULT_USER_TIMEZONE;
      const tzParam = `$${paramIndex}`;
      params.push(tz);
      paramIndex++;
      if (query.soldFrom?.trim()) {
        soldConds.push(`o_sold.order_date >= ${localDayStartSql(`$${paramIndex}`, tzParam)}`);
        params.push(query.soldFrom.trim());
        paramIndex++;
      }
      if (query.soldTo?.trim()) {
        soldConds.push(`o_sold.order_date < ${localDayEndExclusiveSql(`$${paramIndex}`, tzParam)}`);
        params.push(query.soldTo.trim());
        paramIndex++;
      }
      conditions.push(`EXISTS (SELECT 1 FROM orders o_sold WHERE ${soldConds.join(' AND ')})`);
    }
```

The guard regex expects `` o_sold.order_date >= ${localDayStartSql( `` — keep that exact shape. Also check `getUntrackedListings` (same file) for a soldFrom/soldTo filter; if it has one, apply the same change.

- [ ] **Step 4: Run guard + existing listings/orders specs**

Run: `pnpm --filter api test -- local-day-filters listing orders`
Expected: PASS (existing specs unaffected by the optional parameter).

- [ ] **Step 5: Real-SQL check (Review Focus 3)**

`PREPARE` the generated statements against local Postgres. Quickest path: log the SQL once by calling the endpoint locally (`GET /api/v1/orders?dateFrom=2026-10-07&dateTo=2026-10-07` with a user whose `timezone = 'Europe/Istanbul'`), or paste the fragment into psql:

```sql
SELECT '2026-10-07 20:30:00+00'::timestamptz >= ('2026-10-07'::date::timestamp AT TIME ZONE 'Europe/Istanbul'::text)
   AND '2026-10-07 20:30:00+00'::timestamptz < (('2026-10-07'::date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul'::text) AS in_day;
-- 20:30Z = 23:30 Istanbul → true
SELECT '2026-10-07 21:30:00+00'::timestamptz < (('2026-10-07'::date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul'::text) AS still_in_day;
-- 21:30Z = 00:30 next day → false
```

Expected: `true`, then `false`. Record in the report.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/orders/orders.service.ts apps/api/src/modules/listings/listings.service.ts apps/api/src/common/timezone/local-day-filters.guard.spec.ts
git commit -m "fix(orders,listings): date filters count the seller's calendar day" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Dashboard API — range, local day, e-mail methods

**Files:**
- Modify: `packages/shared/src/domain/dashboard/dashboard.types.ts`, `apps/api/src/modules/dashboard/dashboard.service.ts`, `apps/api/src/modules/dashboard/dashboard.controller.ts`, `apps/api/src/modules/dashboard/dashboard-tracked-scope.guard.spec.ts` (only if a regex breaks), `packages/shared/src/i18n/resources/*/dashboard.json` (`dashboard.errors.invalidRange`)
- Test: `apps/api/src/modules/dashboard/dashboard.service.spec.ts`, `apps/api/src/modules/dashboard/dashboard-local-day.guard.spec.ts`

**Interfaces:**
- Consumes: Task 1 resolver, Task 2 `TimezoneService`, `buildLocalRangeSql`.
- Produces (shared types):

```ts
export interface DashboardRangeDto {
  preset: DashboardRangePreset | null;
  from: string;
  to: string;
  /** Seller-local today (YYYY-MM-DD). */
  today: string;
  timezone: string;
  chartGranularity: DashboardChartGranularity;
  pnlGranularity: DashboardChartGranularity;
}

export interface DashboardPeriodDto {
  from: string;
  to: string;
  label: DashboardPeriodLabel;
  metrics: PeriodMetricsDto;
}

/** One P&L column (was DashboardHistoryMonth): a day, week or month of the range. */
export interface DashboardPnlColumn {
  /** Bucket key (YYYY-MM-DD of the bucket start). */
  key: string;
  dateFrom: string;
  dateTo: string;
  /** The column that contains today. */
  isCurrent: boolean;
  sales: number; units: number; orders: number; refunds: number;
  adFee: number; amazonShipping: number; amazonTax: number; purchasePrice: number;
  transactionFee: number; ebayEarnings: number; grossProfit: number; netProfit: number;
  profitConfirmed: number; profitProvisional: number; estimatedPayout: number; margin: number; roi: number;
}

export interface DashboardDataDto {
  range: DashboardRangeDto;
  /** 4 cards, newest first. */
  periods: DashboardPeriodDto[];
  chart: { granularity: DashboardChartGranularity; points: DashboardChartPoint[]; summary: PeriodMetricsDto };
  pnl: { granularity: DashboardChartGranularity; columns: DashboardPnlColumn[] };
}

export interface DashboardStoreMetrics {
  ebayAccountId: string;
  metrics: PeriodMetricsDto;
}
```

Remove `DashboardPeriodKey`, `DashboardMetricsDto`, `DASHBOARD_CURRENT_PERIOD_KEY`, `DashboardHistoryMonth` (spec note: P&L columns stay flat — `metricRows.monthField` keeps indexing them — instead of nesting `metrics`). `DashboardChartPoint.period` doc: "bucket key — `YYYY-MM-DD`, or `YYYY-MM-DD HH` for hourly".
- Produces (service, the e-mail contract):
  - `getRangeMetrics(userId: string, window: DashboardDateWindow, timezone: string, ebayAccountId?: string): Promise<PeriodMetricsDto>`
  - `getDayMetrics(userId: string, localDate: string, timezone: string, ebayAccountId?: string): Promise<PeriodMetricsDto>`
  - `getRangeMetricsByStore(userId: string, window: DashboardDateWindow, timezone: string): Promise<{ total: PeriodMetricsDto; stores: DashboardStoreMetrics[] }>`
  - `getDashboard(userId: string, input: DashboardRangeInput, ebayAccountId?: string): Promise<DashboardDataDto>`

**Note:** after this task `apps/web` does not type-check until Task 6. That is expected; run only API checks here.

- [ ] **Step 1: Failing service spec**

`apps/api/src/modules/dashboard/dashboard.service.spec.ts` (fake DB answering by SQL shape):

```ts
import { BadRequestException } from '@nestjs/common';
import { DashboardChartGranularity as G, DashboardRangePreset as P } from '@repo/shared';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

const AGG = {
  sales: '10', orders: '1', units: '1', refunds: '0', gross_profit: '3', payout: '8',
  profit_confirmed: '2', profit_provisional: '0', revenue_uncosted: '0', orders_pending_capture: '0',
  orders_capture_failed: '0', orders_untracked: '0', cost_of_goods: '5', transaction_fees: '1',
  ad_fees: '0', amazon_shipping: '0', amazon_tax: '0',
};

function make(today = '2026-10-07', timezone = 'Europe/Istanbul') {
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('now() AT TIME ZONE')) return [{ today }];
    if (sql.includes('WITH ORDINALITY')) {
      return (params[1] as string[]).map((_, i) => ({ idx: String(i + 1), ...AGG }));
    }
    if (sql.includes('GROUPING SETS')) {
      return [
        { ebay_account_id: 's1', is_total: 0, ...AGG },
        { ebay_account_id: null, is_total: 1, ...AGG, sales: '30' },
      ];
    }
    return []; // bucket queries: empty → zero-filled
  });
  const timezones = { getForUser: jest.fn(async () => timezone) };
  return { service: new DashboardService({ query } as never, timezones as never), query, timezones };
}

describe('DashboardService.getDashboard', () => {
  it('anchors on the seller-local today and returns four periods with trends', async () => {
    const { service, query } = make();
    const data = await service.getDashboard('u1', { preset: P.TODAY });
    expect(data.range).toMatchObject({ from: '2026-10-07', to: '2026-10-07', today: '2026-10-07', timezone: 'Europe/Istanbul' });
    expect(data.periods).toHaveLength(4);
    expect(data.periods[0].metrics.trend).toBe(0); // 10 vs 10
    const todaySql = query.mock.calls.find(([sql]) => String(sql).includes('now() AT TIME ZONE'));
    expect(todaySql?.[1]).toEqual(['Europe/Istanbul']);
  });

  it('sends all eight windows (4 periods + 4 comparisons) in ONE aggregate query', async () => {
    const { service, query } = make();
    await service.getDashboard('u1', { preset: P.THIS_MONTH });
    const agg = query.mock.calls.filter(([sql]) => String(sql).includes('WITH ORDINALITY'));
    expect(agg).toHaveLength(1);
    expect((agg[0][1] as unknown[])[1]).toHaveLength(8);
  });

  it('zero-fills 24 hourly chart points and one P&L column for today', async () => {
    const { service } = make();
    const data = await service.getDashboard('u1', { preset: P.TODAY });
    expect(data.chart.granularity).toBe(G.HOUR);
    expect(data.chart.points).toHaveLength(24);
    expect(data.pnl.columns).toEqual([expect.objectContaining({ key: '2026-10-07', isCurrent: true })]);
  });

  it('P&L columns are newest first and only the one containing today is current', async () => {
    const { service } = make();
    const data = await service.getDashboard('u1', { preset: P.THIS_MONTH });
    expect(data.pnl.columns[0]).toMatchObject({ key: '2026-10-07', isCurrent: true });
    expect(data.pnl.columns.filter((c) => c.isCurrent)).toHaveLength(1);
  });

  it('judges a custom range against the SELLER’s today, not the server’s (Review Focus 5)', async () => {
    // Seller in Los Angeles; their today is still 10-06.
    const { service } = make('2026-10-06', 'America/Los_Angeles');
    await expect(service.getDashboard('u1', { from: '2026-10-01', to: '2026-10-07' })).rejects.toThrow();
    await expect(service.getDashboard('u1', { from: '2026-10-01', to: '2026-10-06' })).resolves.toBeDefined();
  });
});

describe('e-mail methods', () => {
  it('getDayMetrics is a one-day getRangeMetrics', async () => {
    const { service, query } = make();
    const m = await service.getDayMetrics('u1', '2026-10-06', 'Europe/Istanbul', 's1');
    expect(m.sales).toBe(10);
    const call = query.mock.calls.find(([sql]) => String(sql).includes('WITH ORDINALITY'));
    expect(call?.[1]).toEqual(['u1', ['2026-10-06'], ['2026-10-06'], 'Europe/Istanbul', 's1']);
  });

  it('getRangeMetricsByStore returns the total row and each store row', async () => {
    const { service } = make();
    const r = await service.getRangeMetricsByStore('u1', { from: '2026-10-06', to: '2026-10-06' }, 'UTC');
    expect(r.total.sales).toBe(30);
    expect(r.stores).toEqual([expect.objectContaining({ ebayAccountId: 's1' })]);
  });
});

describe('DashboardController range parsing', () => {
  const controller = (svc: Partial<DashboardService>) => new DashboardController(svc as DashboardService);
  const req = { user: { sub: 'u1' } };

  it('defaults to today', async () => {
    const getDashboard = jest.fn(async () => ({}) as never);
    await controller({ getDashboard }).getDashboard(req);
    expect(getDashboard).toHaveBeenCalledWith('u1', { preset: P.TODAY }, undefined);
  });

  it('refuses an unknown preset and a half custom range', async () => {
    const c = controller({ getDashboard: jest.fn() });
    await expect(c.getDashboard(req, 'forever')).rejects.toThrow(BadRequestException);
    await expect(c.getDashboard(req, undefined, '2026-10-01')).rejects.toThrow(BadRequestException);
  });
});
```

Run: `pnpm --filter @repo/shared build; pnpm --filter api test -- dashboard.service` → FAIL.

- [ ] **Step 2: Guard spec**

`apps/api/src/modules/dashboard/dashboard-local-day.guard.spec.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';

const service = fs
  .readFileSync(path.join(__dirname, 'dashboard.service.ts'), 'utf8')
  .replace(/\r\n/g, '\n');

describe('the dashboard counts the seller’s calendar day', () => {
  it('never uses the database calendar', () => {
    expect(service).not.toMatch(/CURRENT_DATE/);
  });
  it('anchors today in the seller zone', () => {
    expect(service).toMatch(/now\(\) AT TIME ZONE \$1::text/);
  });
  it('filters with local-midnight bounds and buckets in the seller zone', () => {
    expect(service).toMatch(/buildLocalRangeSql\(/);
    expect(service).toMatch(/AT TIME ZONE \$\d+::text\)/); // inside date_trunc for buckets
  });
});
```

- [ ] **Step 3: Implement the service**

Rewrite `dashboard.service.ts`, keeping `PeriodAggregateRow`, `num`, `round`, `calcChange`, `emptyAggregate`, `buildPeriod` and `periodSelect` **unchanged** (the tracked-scope guard reads `periodSelect`). Delete `MetricsQueryRow`, `GRANULARITY_SQL`, `HISTORY_MONTHS`, `getAnchorDate`, `toIsoDate`, `startOfIsoWeek`, `bucketKeys`, `sumAggregates`, `getMetrics`, `getChart`, `getHistory`. Add:

```ts
import { Injectable } from '@nestjs/common';
import {
  DashboardChartGranularity,
  DashboardRangeError,
  OrderCostCaptureStatus,
  OrderStatus,
  dashboardBucketKeys,
  dashboardBucketWindows,
  isIsoDate,
  resolveDashboardRange,
  type DashboardChartPoint,
  type DashboardDataDto,
  type DashboardDateWindow,
  type DashboardPnlColumn,
  type DashboardRangeInput,
  type DashboardStoreMetrics,
  type PeriodMetricsDto,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { buildLocalRangeSql } from '../../common/timezone/local-day-sql';
import { TimezoneService } from '../../common/timezone/timezone.service';

interface WindowAggregateRow extends PeriodAggregateRow { idx: string | number }
interface BucketQueryRow extends PeriodAggregateRow { period: string }
interface StoreAggregateRow extends PeriodAggregateRow { ebay_account_id: string | null; is_total: number | string }

/** date_trunc unit + to_char format per granularity — enum-keyed, never user text. */
const BUCKET_SQL: Record<DashboardChartGranularity, { unit: string; format: string }> = {
  [DashboardChartGranularity.HOUR]: { unit: 'hour', format: 'YYYY-MM-DD HH24' },
  [DashboardChartGranularity.DAY]: { unit: 'day', format: 'YYYY-MM-DD' },
  [DashboardChartGranularity.WEEK]: { unit: 'week', format: 'YYYY-MM-DD' },
  [DashboardChartGranularity.MONTH]: { unit: 'month', format: 'YYYY-MM-DD' },
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timezoneService: TimezoneService,
  ) {}

  async getDashboard(userId: string, input: DashboardRangeInput, ebayAccountId?: string): Promise<DashboardDataDto> {
    const timezone = await this.timezoneService.getForUser(userId);
    const today = await this.getLocalToday(timezone);
    const resolved = resolveDashboardRange(input, today); // DashboardRangeError → 400 in the controller
    const windows = resolved.periods.flatMap((p) => [{ from: p.from, to: p.to }, p.comparison]);
    const samePnlBuckets = resolved.pnlGranularity === resolved.chartGranularity;

    const [aggregates, chartRows, pnlRows] = await Promise.all([
      this.aggregateWindows(userId, windows, timezone, ebayAccountId),
      this.aggregateBuckets(userId, resolved.range, resolved.chartGranularity, timezone, ebayAccountId),
      samePnlBuckets
        ? Promise.resolve(null)
        : this.aggregateBuckets(userId, resolved.range, resolved.pnlGranularity, timezone, ebayAccountId),
    ]);

    const periods = resolved.periods.map((p, k) => ({
      from: p.from,
      to: p.to,
      label: p.label,
      metrics: this.buildPeriod(aggregates[2 * k], aggregates[2 * k + 1]),
    }));

    const points: DashboardChartPoint[] = dashboardBucketKeys(resolved.range, resolved.chartGranularity).map((key) => {
      const agg = chartRows.get(key) ?? this.emptyAggregate();
      return {
        period: key,
        sales: this.round(this.num(agg.sales)),
        units: this.num(agg.units),
        orders: this.num(agg.orders),
        netProfit: this.round(this.num(agg.profit_confirmed)),
        grossProfit: this.round(this.num(agg.gross_profit)),
        refunds: this.num(agg.refunds),
      };
    });

    const pnlSource = pnlRows ?? chartRows;
    const columns: DashboardPnlColumn[] = dashboardBucketWindows(resolved.range, resolved.pnlGranularity)
      .reverse()
      .map((w) => this.toPnlColumn(w.key, w, pnlSource.get(w.key) ?? this.emptyAggregate(), today));

    return {
      range: {
        preset: resolved.preset,
        from: resolved.range.from,
        to: resolved.range.to,
        today,
        timezone,
        chartGranularity: resolved.chartGranularity,
        pnlGranularity: resolved.pnlGranularity,
      },
      periods,
      chart: { granularity: resolved.chartGranularity, points, summary: periods[0].metrics },
      pnl: { granularity: resolved.pnlGranularity, columns },
    };
  }

  /* ─── the e-mail contract: same fragment, same numbers as the cards ─── */

  async getRangeMetrics(
    userId: string,
    window: DashboardDateWindow,
    timezone: string,
    ebayAccountId?: string,
  ): Promise<PeriodMetricsDto> {
    this.assertWindow(window);
    const [row] = await this.aggregateWindows(userId, [window], timezone, ebayAccountId);
    return this.buildPeriod(row);
  }

  async getDayMetrics(userId: string, localDate: string, timezone: string, ebayAccountId?: string): Promise<PeriodMetricsDto> {
    return this.getRangeMetrics(userId, { from: localDate, to: localDate }, timezone, ebayAccountId);
  }

  async getRangeMetricsByStore(
    userId: string,
    window: DashboardDateWindow,
    timezone: string,
  ): Promise<{ total: PeriodMetricsDto; stores: DashboardStoreMetrics[] }> {
    this.assertWindow(window);
    const rows = await this.databaseService.query<StoreAggregateRow>(
      `SELECT ebay_account_id, GROUPING(ebay_account_id) AS is_total, ${this.periodSelect()}
       FROM orders
       WHERE user_id = $1 AND ${buildLocalRangeSql('order_date', '$2', '$3', '$4')}
       GROUP BY GROUPING SETS ((ebay_account_id), ())`,
      [userId, window.from, window.to, timezone],
    );
    const totalRow = rows.find((r) => this.num(r.is_total) === 1) ?? this.emptyAggregate();
    const stores = rows
      .filter((r) => this.num(r.is_total) === 0 && r.ebay_account_id)
      .map((r) => ({ ebayAccountId: r.ebay_account_id as string, metrics: this.buildPeriod(r) }));
    return { total: this.buildPeriod(totalRow), stores };
  }

  /* ─── queries ─── */

  private assertWindow(window: DashboardDateWindow): void {
    if (!isIsoDate(window.from) || !isIsoDate(window.to) || window.from > window.to) {
      throw new DashboardRangeError(`invalid window ${window.from}..${window.to}`);
    }
  }

  /** The seller's calendar today — never Postgres' CURRENT_DATE (UTC on production). */
  private async getLocalToday(timezone: string): Promise<string> {
    const rows = await this.databaseService.query<{ today: string }>(
      `SELECT to_char((now() AT TIME ZONE $1::text)::date, 'YYYY-MM-DD') AS today`,
      [timezone],
    );
    return rows[0].today;
  }

  /** One aggregate per window, index-aligned with the input, in ONE statement. */
  private async aggregateWindows(
    userId: string,
    windows: DashboardDateWindow[],
    timezone: string,
    ebayAccountId?: string,
  ): Promise<PeriodAggregateRow[]> {
    const params: unknown[] = [userId, windows.map((w) => w.from), windows.map((w) => w.to), timezone];
    const store = ebayAccountId ? ' AND orders.ebay_account_id = $5' : '';
    if (ebayAccountId) {
      params.push(ebayAccountId);
    }
    const rows = await this.databaseService.query<WindowAggregateRow>(
      `SELECT w.idx, ${this.periodSelect()}
       FROM unnest($2::date[], $3::date[]) WITH ORDINALITY AS w(d_from, d_to, idx)
       LEFT JOIN orders
         ON orders.user_id = $1
        AND ${buildLocalRangeSql('orders.order_date', 'w.d_from', 'w.d_to', '$4')}${store}
       GROUP BY w.idx
       ORDER BY w.idx`,
      params,
    );
    const byIdx = new Map(rows.map((r) => [this.num(r.idx), r]));
    return windows.map((_, i) => byIdx.get(i + 1) ?? this.emptyAggregate());
  }

  private async aggregateBuckets(
    userId: string,
    range: DashboardDateWindow,
    granularity: DashboardChartGranularity,
    timezone: string,
    ebayAccountId?: string,
  ): Promise<Map<string, PeriodAggregateRow>> {
    const { unit, format } = BUCKET_SQL[granularity];
    const params: unknown[] = [userId, range.from, range.to, timezone];
    const store = ebayAccountId ? ' AND ebay_account_id = $5' : '';
    if (ebayAccountId) {
      params.push(ebayAccountId);
    }
    const rows = await this.databaseService.query<BucketQueryRow>(
      `SELECT to_char(date_trunc('${unit}', order_date AT TIME ZONE $4::text), '${format}') AS period,
              ${this.periodSelect()}
       FROM orders
       WHERE user_id = $1 AND ${buildLocalRangeSql('order_date', '$2', '$3', '$4')}${store}
       GROUP BY 1`,
      params,
    );
    return new Map(rows.map((r) => [r.period, r]));
  }

  private toPnlColumn(key: string, w: DashboardDateWindow, agg: PeriodAggregateRow, today: string): DashboardPnlColumn {
    const p = this.buildPeriod(agg);
    return {
      key,
      dateFrom: w.from,
      dateTo: w.to,
      isCurrent: w.from <= today && today <= w.to,
      sales: p.sales,
      units: p.units,
      orders: p.orders,
      refunds: p.refunds,
      adFee: p.adFees,
      amazonShipping: p.amazonShipping,
      amazonTax: p.amazonTax,
      purchasePrice: p.costOfGoods,
      transactionFee: p.transactionFees,
      ebayEarnings: p.estimatedPayout,
      grossProfit: p.grossProfit,
      netProfit: p.netProfit,
      profitConfirmed: p.profitConfirmed,
      profitProvisional: p.profitProvisional,
      estimatedPayout: p.estimatedPayout,
      margin: p.margin,
      roi: p.roi,
    };
  }

  // … keep num, round, calcChange, emptyAggregate, buildPeriod, periodSelect as they are …
}
```

Note the guard regex `AT TIME ZONE \$\d+::text\)` matches `order_date AT TIME ZONE $4::text)` inside `date_trunc(...)`. Update the file header comment (it still describes today/week/month/year and 12 months).

- [ ] **Step 4: Controller**

```ts
import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  DashboardRangeError,
  DashboardRangePreset,
  DEFAULT_DASHBOARD_RANGE_PRESET,
  type DashboardDataDto,
  type DashboardRangeInput,
} from '@repo/shared';
// … existing swagger imports, isUUID, parseStoreId …

const INVALID_RANGE = 'dashboard.errors.invalidRange';

function parseRangeInput(range?: string, from?: string, to?: string): DashboardRangeInput {
  const f = from?.trim();
  const t = to?.trim();
  if (f || t) {
    if (!f || !t) {
      throw new BadRequestException(INVALID_RANGE);
    }
    return { from: f, to: t };
  }
  const preset = range?.trim();
  if (!preset) {
    return { preset: DEFAULT_DASHBOARD_RANGE_PRESET };
  }
  if (!(Object.values(DashboardRangePreset) as string[]).includes(preset)) {
    throw new BadRequestException(INVALID_RANGE);
  }
  return { preset: preset as DashboardRangePreset };
}
```

Handler signature: `getDashboard(req, range?, from?, to?, ebayAccountId?)` with `@Query('range')`, `@Query('from')`, `@Query('to')`, `@Query('ebayAccountId')` (keep this parameter ORDER — the spec calls `getDashboard(req, 'forever')` and `getDashboard(req, undefined, '2026-10-01')`). Body:

```ts
    const input = parseRangeInput(range, from, to);
    try {
      return await this.dashboardService.getDashboard(req.user.sub, input, parseStoreId(ebayAccountId));
    } catch (error) {
      if (error instanceof DashboardRangeError) {
        throw new BadRequestException(INVALID_RANGE);
      }
      throw error;
    }
```

Replace the `chartGranularity` `@ApiQuery` with three (`range` enum `DashboardRangePreset`, `from`, `to`). `DashboardRangeError` may cross the CJS boundary as a different class in Jest; if `instanceof` fails in the spec, also accept `(error as Error)?.name === 'DashboardRangeError'`.

- [ ] **Step 5: i18n `dashboard.errors.invalidRange`** in all 16 `dashboard.json` (EN "That date range can't be shown.", TR "Bu tarih aralığı gösterilemiyor.").

- [ ] **Step 6: Run API tests and typecheck**

Run: `pnpm --filter @repo/shared build; pnpm --filter api test -- dashboard; pnpm --filter api exec tsc --noEmit`
Expected: PASS; API tsc clean.

- [ ] **Step 7: PREPARE the three statements against local Postgres**

In psql, PREPARE each SQL string from the service with placeholder types, e.g.:

```sql
PREPARE agg(uuid, date[], date[], text) AS
SELECT w.idx, COUNT(orders.id) FROM unnest($2::date[], $3::date[]) WITH ORDINALITY AS w(d_from, d_to, idx)
LEFT JOIN orders ON orders.user_id = $1
 AND orders.order_date >= ((w.d_from)::date::timestamp AT TIME ZONE ($4)::text)
 AND orders.order_date < (((w.d_to)::date + 1)::timestamp AT TIME ZONE ($4)::text)
GROUP BY w.idx ORDER BY w.idx;
EXECUTE agg('00000000-0000-0000-0000-000000000000', ARRAY['2026-10-01','2026-09-01']::date[], ARRAY['2026-10-07','2026-09-30']::date[], 'Europe/Istanbul');
```

Do the same with the full `periodSelect` text copied from the service (bucket query and GROUPING SETS query too). Expected: no error; two rows from `agg`. Better: run the API locally and hit `GET /api/v1/dashboard?range=thisMonth` with a real token — expect 200.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/domain/dashboard/dashboard.types.ts apps/api/src/modules/dashboard packages/shared/src/i18n/resources/*/dashboard.json
git commit -m "feat(dashboard): range-driven API on the seller's calendar day; getRangeMetrics/getDayMetrics for the daily e-mail" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `DateRangePicker` molecule

**Files:**
- Create: `packages/ui/src/molecules/DatePicker/monthGrid.ts`, `packages/ui/src/molecules/DateRangePicker/{DateRangePicker.container.tsx,DateRangePicker.component.tsx,DateRangePicker.style.ts,DateRangePicker.types.ts,index.ts}`
- Modify: `packages/ui/src/molecules/DatePicker/DatePicker.container.tsx` (use `monthGrid.ts`), `packages/ui/src/index.ts`
- Test: `apps/web/src/utils/dateRangeMonthGrid.test.ts` (Vitest — web is the only UI test runner; import from `@repo/ui`)

**Interfaces:**
- Produces:

```ts
export interface DateRangePickerPreset { value: string; label: string }
export interface DateRangePickerProps {
  presets: DateRangePickerPreset[];
  /** Highlighted preset, or null when a custom range is active. */
  selectedPreset: string | null;
  /** Current range (YYYY-MM-DD) — seeds the calendar. */
  from: string;
  to: string;
  /** Last selectable day (seller-local today). */
  maxDate: string;
  /** Text on the closed trigger, already composed ("Today · 7 Oct"). */
  triggerLabel: string;
  /** Heading of the custom section / bottom sheet title. */
  customLabel: string;
  applyLabel: string;
  cancelLabel: string;
  /** Accessible name of the popover. */
  dialogLabel: string;
  locale: string;
  onPresetSelect: (value: string) => void;
  onRangeApply: (from: string, to: string) => void;
  className?: string;
}
// monthGrid.ts
export interface MonthGridDay { iso: string; day: number; isCurrentMonth: boolean }
export function firstDayOfWeek(locale: string): number;
export function buildMonthGrid(year: number, month: number, weekStart: number): MonthGridDay[];
export function isoOf(year: number, month: number, day: number): string;
```

- [ ] **Step 1: Failing Vitest for the grid helper**

`apps/web/src/utils/dateRangeMonthGrid.test.ts`:

```ts
import { buildMonthGrid, firstDayOfWeek } from '@repo/ui';
import { describe, expect, it } from 'vitest';

describe('buildMonthGrid', () => {
  it('October 2026 with a Monday week start begins on Mon 28 Sep and has 42 cells', () => {
    const grid = buildMonthGrid(2026, 9, 1);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ iso: '2026-09-28', day: 28, isCurrentMonth: false });
    expect(grid[3]).toEqual({ iso: '2026-10-01', day: 1, isCurrentMonth: true });
  });

  it('en-US starts the week on Sunday, tr on Monday', () => {
    expect(firstDayOfWeek('en-US')).toBe(0);
    expect(firstDayOfWeek('tr-TR')).toBe(1);
  });
});
```

Run: `pnpm --filter web test -- dateRangeMonthGrid` → FAIL.

- [ ] **Step 2: Extract `monthGrid.ts`** — move `pad`, `toIso` (rename `isoOf`), `firstDayOfWeek` out of `DatePicker.container.tsx` verbatim, plus:

```ts
export function buildMonthGrid(year: number, month: number, weekStart: number): MonthGridDay[] {
  const lead = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, month, 1 - lead + i);
    return { iso: isoOf(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), isCurrentMonth: date.getMonth() === month };
  });
}
```

Make `DatePicker.container.tsx` import these (its `days` memo maps `buildMonthGrid(...)` adding `isSelected`/`isToday`). Export `buildMonthGrid`, `firstDayOfWeek`, `isoOf`, `MonthGridDay` from `packages/ui/src/index.ts`.

- [ ] **Step 3: Types file** — `DateRangePicker.types.ts` with `DateRangePickerPreset`, `DateRangePickerProps` (above) and:

```ts
export interface DateRangePickerDay {
  iso: string;
  day: number;
  isCurrentMonth: boolean;
  isDisabled: boolean;
  isStart: boolean;
  isEnd: boolean;
  isInRange: boolean;
  isToday: boolean;
}
export interface DateRangePickerMonth { title: string; days: DateRangePickerDay[] }
export interface DateRangePickerComponentProps {
  presets: DateRangePickerPreset[];
  selectedPreset: string | null;
  triggerLabel: string;
  customLabel: string;
  applyLabel: string;
  cancelLabel: string;
  dialogLabel: string;
  previousMonthLabel: string;
  nextMonthLabel: string;
  weekdays: string[];
  months: DateRangePickerMonth[];
  canApply: boolean;
  isOpen: boolean;
  isMobile: boolean;
  className?: string;
  containerRef: React.RefObject<HTMLDivElement>;
  panelRef: React.RefObject<HTMLDivElement>;
  onToggle: () => void;
  onClose: () => void;
  onPresetSelect: (value: string) => void;
  onDaySelect: (iso: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onApply: () => void;
}
```

- [ ] **Step 4: Container**

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildMonthGrid, firstDayOfWeek, isoOf } from '../DatePicker/monthGrid';

import { DateRangePickerComponent } from './DateRangePicker.component';
import type { DateRangePickerDay, DateRangePickerMonth, DateRangePickerProps } from './DateRangePicker.types';

/** Same threshold as Select/Dropdown's bottom sheet. */
const MOBILE_MAX_WIDTH_PX = 640;

const viewOf = (iso: string) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 });

export const DateRangePicker = ({
  presets, selectedPreset, from, to, maxDate, triggerLabel, customLabel, applyLabel, cancelLabel,
  dialogLabel, locale, onPresetSelect, onRangeApply, className,
}: DateRangePickerProps): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_MAX_WIDTH_PX);
  // Draft selection: start set on the first click, end on the second.
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [draftEnd, setDraftEnd] = useState<string | null>(null);
  // Left month shown; desktop shows it and the next one, mobile one month.
  const [view, setView] = useState(() => viewOf(to));

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_MAX_WIDTH_PX);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const weekStart = useMemo(() => firstDayOfWeek(locale), [locale]);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2023, 0, 1 + ((weekStart + i) % 7))));
  }, [locale, weekStart]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);

  const start = draftStart ?? from;
  const end = draftStart ? draftEnd : to;

  const months = useMemo<DateRangePickerMonth[]>(() => {
    const count = isMobile ? 1 : 2;
    return Array.from({ length: count }, (_, offset) => {
      const first = new Date(view.year, view.month + offset, 1);
      const grid = buildMonthGrid(first.getFullYear(), first.getMonth(), weekStart);
      const days: DateRangePickerDay[] = grid.map((cell) => ({
        ...cell,
        isDisabled: cell.iso > maxDate,
        isStart: cell.iso === start,
        isEnd: end !== null && cell.iso === end,
        isInRange: end !== null && cell.iso > start && cell.iso < end,
        isToday: cell.iso === maxDate,
      }));
      return { title: monthFormatter.format(first), days };
    });
  }, [isMobile, view, weekStart, maxDate, start, end, monthFormatter]);

  const shiftMonth = useCallback((delta: number) => {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }, []);

  const resetDraft = () => {
    setDraftStart(null);
    setDraftEnd(null);
  };

  const handleToggle = () => {
    if (!isOpen) {
      resetDraft();
      // Desktop: the right-hand month is the one holding `to`.
      const v = viewOf(to);
      setView(isMobile ? v : { year: new Date(v.year, v.month - 1, 1).getFullYear(), month: new Date(v.year, v.month - 1, 1).getMonth() });
    }
    setIsOpen((open) => !open);
  };

  const handleDaySelect = (iso: string) => {
    if (iso > maxDate) {
      return;
    }
    if (!draftStart || draftEnd) {
      setDraftStart(iso);
      setDraftEnd(null);
      return;
    }
    if (iso < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(iso);
    } else {
      setDraftEnd(iso);
    }
  };

  const monthLabel = (delta: number) => monthFormatter.format(new Date(view.year, view.month + delta, 1));

  return (
    <DateRangePickerComponent
      presets={presets}
      selectedPreset={draftStart ? null : selectedPreset}
      triggerLabel={triggerLabel}
      customLabel={customLabel}
      applyLabel={applyLabel}
      cancelLabel={cancelLabel}
      dialogLabel={dialogLabel}
      previousMonthLabel={monthLabel(-1)}
      nextMonthLabel={monthLabel(1)}
      weekdays={weekdays}
      months={months}
      canApply={Boolean(draftStart && draftEnd)}
      isOpen={isOpen}
      isMobile={isMobile}
      className={className}
      containerRef={containerRef}
      panelRef={panelRef}
      onToggle={handleToggle}
      onClose={() => setIsOpen(false)}
      onPresetSelect={(value) => {
        onPresetSelect(value);
        setIsOpen(false);
      }}
      onDaySelect={handleDaySelect}
      onPreviousMonth={() => shiftMonth(-1)}
      onNextMonth={() => shiftMonth(1)}
      onApply={() => {
        if (draftStart && draftEnd) {
          onRangeApply(draftStart, draftEnd);
          setIsOpen(false);
        }
      }}
    />
  );
};

DateRangePicker.displayName = 'DateRangePicker';
```

(`isoOf` import is unused here if not needed — drop it if lint complains.)

- [ ] **Step 5: Component**

```tsx
import type React from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './DateRangePicker.style';
import type { DateRangePickerComponentProps, DateRangePickerMonth } from './DateRangePicker.types';

export const DateRangePickerComponent = (props: DateRangePickerComponentProps): React.ReactElement => {
  const {
    presets, selectedPreset, triggerLabel, customLabel, applyLabel, cancelLabel, dialogLabel,
    previousMonthLabel, nextMonthLabel, weekdays, months, canApply, isOpen, isMobile, className,
    containerRef, panelRef, onToggle, onClose, onPresetSelect, onDaySelect, onPreviousMonth, onNextMonth, onApply,
  } = props;

  const renderMonth = (month: DateRangePickerMonth) => (
    <S.Month key={month.title}>
      <S.MonthTitle>{month.title}</S.MonthTitle>
      <S.Grid>
        {weekdays.map((weekday) => (
          <S.Weekday key={weekday}>{weekday}</S.Weekday>
        ))}
        {month.days.map((day) => (
          <S.Day
            key={day.iso}
            type="button"
            disabled={day.isDisabled}
            $muted={!day.isCurrentMonth}
            $edge={day.isStart || day.isEnd}
            $inRange={day.isInRange}
            $today={day.isToday}
            aria-pressed={day.isStart || day.isEnd}
            onClick={() => onDaySelect(day.iso)}
          >
            {day.isCurrentMonth ? day.day : ''}
          </S.Day>
        ))}
      </S.Grid>
    </S.Month>
  );

  const body = (
    <S.Body $mobile={isMobile}>
      <S.Presets role="listbox" aria-label={dialogLabel}>
        {presets.map((preset) => (
          <S.PresetButton
            key={preset.value}
            type="button"
            role="option"
            aria-selected={preset.value === selectedPreset}
            $active={preset.value === selectedPreset}
            onClick={() => onPresetSelect(preset.value)}
          >
            {preset.label}
            {preset.value === selectedPreset && <Icon name="check" size={16} color="brand.primary" />}
          </S.PresetButton>
        ))}
      </S.Presets>
      <S.Custom>
        <S.CustomHeader>
          <Text variant="body-sm" weight="semibold">{customLabel}</Text>
          <S.Nav>
            <S.NavButton type="button" aria-label={previousMonthLabel} onClick={onPreviousMonth}>
              <Icon name="chevron-left" size={18} />
            </S.NavButton>
            <S.NavButton type="button" aria-label={nextMonthLabel} onClick={onNextMonth}>
              <Icon name="chevron-right" size={18} />
            </S.NavButton>
          </S.Nav>
        </S.CustomHeader>
        <S.Months>{months.map(renderMonth)}</S.Months>
        <S.Actions>
          <Button variant="secondary" size="small" onClick={onClose}>
            <Text variant="body-sm">{cancelLabel}</Text>
          </Button>
          <Button variant="primary" size="small" disabled={!canApply} onClick={onApply}>
            <Text variant="body-sm" weight="semibold">{applyLabel}</Text>
          </Button>
        </S.Actions>
      </S.Custom>
    </S.Body>
  );

  return (
    <S.Container ref={containerRef} className={className}>
      <S.Trigger type="button" $isOpen={isOpen} aria-haspopup="dialog" aria-expanded={isOpen} onClick={onToggle}>
        <Icon name="calendar-today" size={18} color="text.secondary" />
        <S.TriggerText>{triggerLabel}</S.TriggerText>
        <Icon name="chevron-down" size={16} color="text.tertiary" />
      </S.Trigger>

      {isOpen && !isMobile && (
        <S.Panel ref={panelRef} role="dialog" aria-label={dialogLabel}>
          {body}
        </S.Panel>
      )}

      {isOpen &&
        isMobile &&
        createPortal(
          <S.Overlay onClick={onClose}>
            <S.Sheet ref={panelRef} role="dialog" aria-label={dialogLabel} onClick={(e) => e.stopPropagation()}>
              <S.SheetHeader>
                <Text variant="body" weight="semibold">{dialogLabel}</Text>
                <S.NavButton type="button" aria-label={cancelLabel} onClick={onClose}>
                  <Icon name="x" size={18} />
                </S.NavButton>
              </S.SheetHeader>
              {body}
            </S.Sheet>
          </S.Overlay>,
          document.body,
        )}
    </S.Container>
  );
};

DateRangePickerComponent.displayName = 'DateRangePickerComponent';
```

Check that `Button` accepts `disabled` and that icon names `calendar-today`, `check`, `chevron-down`, `chevron-left`, `chevron-right`, `x` exist in `packages/ui/src/atoms/Icon/icons/index.tsx` (all are used elsewhere already).

- [ ] **Step 6: Styles** — `DateRangePicker.style.ts`. Reuse the token vocabulary of `DatePicker.style.ts` (copy its `NavButton`, `Weekday`, `Grid`, `MonthTitle` verbatim) and `Select.style.ts`'s `Overlay` / `BottomSheet` (as `Overlay` / `Sheet`, `max-height: 85vh; overflow-y: auto`), plus:

```ts
export const Container = styled.div`
  position: relative;
  display: inline-flex;
`;

/** Compact control: same height as a small Select so it sits on the tab rail's baseline. */
export const Trigger = styled.button<{ $isOpen: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  box-sizing: border-box;
  height: ${controlHeight('small', false)};
  padding: 0 ${CONTROL_PADDING_X};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid
    ${({ $isOpen, theme }) => ($isOpen ? theme.colors.brand.primary : tkn(CONTROL_BORDER_COLOR_PATH)({ theme }))};
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  white-space: nowrap;

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const TriggerText = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.primary')};
`;

/** Opens to the LEFT edge of the trigger's right side — the control sits at the rail's right end. */
export const Panel = styled.div`
  position: absolute;
  top: calc(100% + ${tkn('spacing.xs')});
  inset-inline-end: 0;
  z-index: ${tkn('zIndex.dropdown')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.lg')};
`;

export const Body = styled.div<{ $mobile: boolean }>`
  display: flex;
  flex-direction: ${({ $mobile }) => ($mobile ? 'column' : 'row')};
`;

export const Presets = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 12rem;
  padding: ${tkn('spacing.sm')};
  border-inline-end: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const PresetButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border: none;
  border-radius: ${tkn('radius.md')};
  background: transparent;
  text-align: start;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${({ $active, theme }) => ($active ? theme.colors.brand.primary : theme.colors.text.primary)};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
  }
`;

export const Custom = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
`;

export const CustomHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const Nav = styled.div`
  display: flex;
  gap: ${tkn('spacing.2xs')};
`;

export const Months = styled.div`
  display: flex;
  gap: ${tkn('spacing.lg')};
`;

export const Month = styled.div`
  width: 16rem;
  max-width: 100%;
`;

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
`;

export const SheetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const Day = styled.button<{ $muted: boolean; $edge: boolean; $inRange: boolean; $today: boolean }>`
  height: 2.25rem;
  padding: 0;
  border: 0.0625rem solid
    ${({ $today, $edge, theme }) => ($today && !$edge ? theme.colors.brand.primary : 'transparent')};
  border-radius: ${tkn('radius.md')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  background: ${({ $edge, $inRange, theme }) =>
    $edge ? theme.colors.brand.primary : $inRange ? theme.colors.table.rowSelected : 'transparent'};
  color: ${({ $edge, $muted, theme }) =>
    $edge ? theme.colors.text.inverse : $muted ? theme.colors.text.tertiary : theme.colors.text.primary};
  visibility: ${({ $muted }) => ($muted ? 'hidden' : 'visible')};

  &:disabled {
    cursor: not-allowed;
    color: ${tkn('colors.text.tertiary')};
    opacity: 0.5;
  }
`;
```

Imports at the top: `styled` from `@emotion/styled`, `CONTROL_BORDER_COLOR_PATH`, `CONTROL_PADDING_X`, `controlHeight` from `../../styles/formControl`, `tkn` from `../../theme/tkn`. In the mobile `Body`, `Presets` should lose its inline-end border and gain a bottom border — add `@media (max-width: ${tkn('breakpoints.smBelow')}) { border-inline-end: none; border-bottom: … }` to `Presets`. If `opacity: 0.5` trips the magic-number lint rule, use an existing opacity token (`grep -rn "opacity" packages/ui/src/theme/designTokens.ts`).

- [ ] **Step 7: Export** — `index.ts` in the folder (`export { DateRangePicker } from './DateRangePicker.container'; export type { DateRangePickerProps, DateRangePickerPreset } from './DateRangePicker.types';`) and the same two lines in `packages/ui/src/index.ts` next to `DatePicker`.

- [ ] **Step 8: Build, test, lint**

Run: `pnpm --filter @repo/ui build; pnpm --filter web test -- dateRangeMonthGrid; pnpm lint`
Expected: PASS, lint 0 warnings (DatePicker behaviour unchanged).

- [ ] **Step 9: Commit**

```bash
git add packages/ui/src/molecules/DatePicker packages/ui/src/molecules/DateRangePicker packages/ui/src/index.ts apps/web/src/utils/dateRangeMonthGrid.test.ts
git commit -m "feat(ui): DateRangePicker molecule (presets + two-month range calendar, bottom sheet on phones)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Dashboard web wiring + demo + i18n

**Files:**
- Modify: `apps/web/src/features/dashboard/api/dashboardApi.ts`, `hooks/useDashboardUrlState.ts`, `hooks/useDashboardFormatters.ts`, `dashboard.types.ts`, `DashboardPage/*` (4 files), `components/CardsPanel/CardsPanel.types.ts` (+ component if it reads `key`), `components/ChartPanel/*` (drop granularity switch), `components/PnlPanel/*`, `utils/metricRows.ts` (type rename), `apps/web/src/features/demo/demoData.ts`, `apps/web/src/features/demo/demoBaseQuery.ts`, `packages/shared/src/i18n/resources/*/dashboard.json`
- Create: `apps/web/src/features/dashboard/utils/periodLabels.ts`, `apps/web/src/features/dashboard/utils/periodLabels.test.ts`, `apps/web/src/features/dashboard/hooks/useDashboardUrlState.test.ts`
- Delete: `apps/web/src/features/dashboard/utils/periodRanges.ts`

**Interfaces:**
- Consumes: Task 1 (`DashboardRangePreset`, `DashboardPeriodUnit`, `resolveDashboardRange`, bucket helpers), Task 4 DTOs, Task 5 `DateRangePicker`.
- Produces: `GetDashboardArgs = { range?: DashboardRangePreset; from?: string; to?: string; ebayAccountId?: string }`; URL state `{ tab, range: DashboardRangeInput, card: number, setTab, setRange, setCard }`.

- [ ] **Step 1: Failing tests — URL state and labels**

`apps/web/src/features/dashboard/hooks/useDashboardUrlState.test.ts` (use the pattern of an existing hook test with `MemoryRouter` + `renderHook`; find one with `grep -rln "renderHook" apps/web/src`):

```ts
import { DashboardRangePreset, DashboardTab } from '@repo/shared';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useDashboardUrlState } from './useDashboardUrlState';

const wrap = (url: string) => ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, { initialEntries: [url] }, children);

describe('useDashboardUrlState', () => {
  it('defaults to today, cards, first card', () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper: wrap('/dashboard') });
    expect(result.current.range).toEqual({ preset: DashboardRangePreset.TODAY });
    expect(result.current.tab).toBe(DashboardTab.CARDS);
    expect(result.current.card).toBe(0);
  });

  it('reads a preset and a custom range', () => {
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?range=thisMonth') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.THIS_MONTH });
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?from=2026-09-01&to=2026-09-30') }).result.current.range)
      .toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('an unknown preset falls back to today; a half custom range too', () => {
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?range=forever') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.TODAY });
    expect(renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?from=2026-09-01') }).result.current.range)
      .toEqual({ preset: DashboardRangePreset.TODAY });
  });

  it('switching range resets the selected card', () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper: wrap('/d?card=2') });
    act(() => result.current.setRange({ preset: DashboardRangePreset.THIS_WEEK }));
    expect(result.current.card).toBe(0);
    expect(result.current.range).toEqual({ preset: DashboardRangePreset.THIS_WEEK });
  });
});
```

`apps/web/src/features/dashboard/utils/periodLabels.test.ts`:

```ts
import { DashboardPeriodUnit as U, DashboardRangePreset as P } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { periodLabelKey } from './periodLabels';

describe('periodLabelKey', () => {
  it.each([
    [{ unit: U.DAY, offset: 0, preset: P.TODAY }, { key: 'dashboard.periodLabel.day.current' }],
    [{ unit: U.DAY, offset: 1, preset: null }, { key: 'dashboard.periodLabel.day.previous' }],
    [{ unit: U.DAY, offset: 3, preset: null }, { key: 'dashboard.periodLabel.day.ago', count: 3 }],
    [{ unit: U.MONTH, offset: 0, preset: P.THIS_MONTH }, { key: 'dashboard.periodLabel.month.current' }],
    [{ unit: U.SPAN, offset: 0, preset: P.LAST_7_DAYS }, { key: 'dashboard.range.preset.last7Days' }],
    [{ unit: U.SPAN, offset: 1, preset: null }, null],
    [{ unit: U.SPAN, offset: 0, preset: null }, null],
  ])('%j → %j', (label, expected) => {
    expect(periodLabelKey(label)).toEqual(expected);
  });
});
```

Run: `pnpm --filter web test -- useDashboardUrlState periodLabels` → FAIL.

- [ ] **Step 2: `utils/periodLabels.ts`**

```ts
/**
 * Which i18n key names a period card. `null` = no name, render the dates
 * (a custom range, or the earlier windows of a rolling preset).
 */
import { DashboardPeriodUnit, type DashboardPeriodLabel } from '@repo/shared';

export interface PeriodLabelKey {
  key: string;
  count?: number;
}

export function periodLabelKey(label: DashboardPeriodLabel): PeriodLabelKey | null {
  if (label.unit === DashboardPeriodUnit.SPAN) {
    return label.offset === 0 && label.preset ? { key: `dashboard.range.preset.${label.preset}` } : null;
  }
  const base = `dashboard.periodLabel.${label.unit}`;
  if (label.offset === 0) {
    return { key: `${base}.current` };
  }
  if (label.offset === 1) {
    return { key: `${base}.previous` };
  }
  return { key: `${base}.ago`, count: label.offset };
}
```

- [ ] **Step 3: URL state hook** — rewrite `useDashboardUrlState.ts`:

```ts
import { DashboardRangePreset, DashboardTab, DEFAULT_DASHBOARD_RANGE_PRESET, isIsoDate, type DashboardRangeInput } from '@repo/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { DashboardUrlState } from '../dashboard.types';

const PARAM_TAB = 'tab';
const PARAM_RANGE = 'range';
const PARAM_FROM = 'from';
const PARAM_TO = 'to';
const PARAM_CARD = 'card';
const DEFAULT_TAB = DashboardTab.CARDS;
const CARD_COUNT = 4;

export function useDashboardUrlState(): DashboardUrlState {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get(PARAM_TAB);
  const tab = (Object.values(DashboardTab) as string[]).includes(rawTab ?? '') ? (rawTab as DashboardTab) : DEFAULT_TAB;

  const from = searchParams.get(PARAM_FROM) ?? '';
  const to = searchParams.get(PARAM_TO) ?? '';
  const rawRange = searchParams.get(PARAM_RANGE) ?? '';
  const rangeKey = isIsoDate(from) && isIsoDate(to) ? `c:${from}:${to}` : `p:${rawRange}`;
  const range = useMemo<DashboardRangeInput>(() => {
    if (rangeKey.startsWith('c:')) {
      return { from, to };
    }
    return (Object.values(DashboardRangePreset) as string[]).includes(rawRange)
      ? { preset: rawRange as DashboardRangePreset }
      : { preset: DEFAULT_DASHBOARD_RANGE_PRESET };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const rawCard = Number(searchParams.get(PARAM_CARD));
  const card = Number.isInteger(rawCard) && rawCard > 0 && rawCard < CARD_COUNT ? rawCard : 0;

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setTab = useCallback(
    (value: DashboardTab) => update((n) => (value === DEFAULT_TAB ? n.delete(PARAM_TAB) : n.set(PARAM_TAB, value))),
    [update],
  );

  const setRange = useCallback(
    (value: DashboardRangeInput) =>
      update((n) => {
        n.delete(PARAM_CARD);
        n.delete(PARAM_RANGE);
        n.delete(PARAM_FROM);
        n.delete(PARAM_TO);
        if ('preset' in value) {
          if (value.preset !== DEFAULT_DASHBOARD_RANGE_PRESET) {
            n.set(PARAM_RANGE, value.preset);
          }
        } else {
          n.set(PARAM_FROM, value.from);
          n.set(PARAM_TO, value.to);
        }
      }),
    [update],
  );

  const setCard = useCallback(
    (value: number) => update((n) => (value === 0 ? n.delete(PARAM_CARD) : n.set(PARAM_CARD, String(value)))),
    [update],
  );

  return useMemo(() => ({ tab, range, card, setTab, setRange, setCard }), [tab, range, card, setTab, setRange, setCard]);
}
```

**URL collision check:** the dashboard page must not already use `from=` for anything (the view-all links put `from=dashboard` on the TARGET page, not on `/dashboard`). Confirm `ActiveStoreProvider`'s `searchForStoreSwitch` keeps `range/from/to/card` (it keeps everything but `page,r,c,drawer,asins` — fine).

Update `dashboard.types.ts`: `DashboardUrlState` = `{ tab; range: DashboardRangeInput; card: number; setTab; setRange(v: DashboardRangeInput); setCard(i: number) }`; delete `PeriodDateInfo`'s use by `periodRanges` (keep the interface: the container still builds `{ from, to, dateRange }` per card); `DashboardMetricRow.monthField: keyof DashboardPnlColumn`; `DashboardFormatters.bucketLabel/bucketLongLabel` accept `HOUR`.

- [ ] **Step 4: API slice**

```ts
import type { DashboardDataDto, DashboardRangeInput } from '@repo/shared';

export interface GetDashboardArgs {
  range: DashboardRangeInput;
  ebayAccountId?: string;
}

// query:
query: ({ range, ebayAccountId }) => {
  const params: Record<string, string> = 'preset' in range ? { range: range.preset } : { from: range.from, to: range.to };
  if (ebayAccountId) {
    params.ebayAccountId = ebayAccountId;
  }
  return { url: '/dashboard', method: 'GET', params };
},
```

- [ ] **Step 5: Formatters — hour buckets**

In `useDashboardFormatters.ts`, `parseIsoDate` must accept `YYYY-MM-DD HH`:

```ts
    const parseBucket = (key: string): Date | null => {
      const [datePart, hourPart] = key.split(' ');
      const [y, m, d] = datePart.split('-').map(Number);
      if (!y || !m || !d) {
        return null;
      }
      return new Date(y, m - 1, d, hourPart ? Number(hourPart) : 0);
    };
```

and in `bucketLabel` / `bucketLongLabel` add a first branch:

```ts
        if (granularity === DashboardChartGranularity.HOUR) {
          return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        }
```

(long label: `date.toLocaleString(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })`). Also add `pnlColumnLabel(column: DashboardPnlColumn, granularity)` to the formatter set: DAY → `day: '2-digit', month: 'short'`; WEEK → `"dd MMM – dd MMM"` from `dateFrom`/`dateTo`; MONTH → existing `monthLabel(dateFrom)`; and `dateRange(from, to)`: same day → `dd.MM.yyyy` (`day: '2-digit', month: '2-digit', year: 'numeric'`), otherwise `dd MMM – dd MMM` (add year when the years differ).

- [ ] **Step 6: Page container**

Replace in `DashboardPage.container.tsx`:
- `const { tab, range, card, setTab, setRange, setCard } = useDashboardUrlState();`
- `useGetDashboardQuery({ range, ebayAccountId: storeFilter }, { skip: noStore })`.
- Remove `getAllPeriodRanges` / `periodDates`. The active window comes from the response:

```ts
  const periodsDto = dashboardData?.periods ?? [];
  const activeWindow = periodsDto[card] ?? periodsDto[0];
  const carouselFrom = activeWindow?.from;
  const carouselTo = activeWindow?.to;
```

Carousel queries use `soldFrom: carouselFrom, soldTo: carouselTo` / `dateFrom: carouselFrom, dateTo: carouselTo` and add `|| !activeWindow` to their `skip`. `buildRangeParams` uses `carouselFrom/carouselTo`.
- Cards: four gradients in order, and labels from `periodLabelKey`:

```ts
  const gradients = [
    theme.colors.dashboard.periodTodayGradient,
    theme.colors.dashboard.periodThisWeekGradient,
    theme.colors.dashboard.periodThisMonthGradient,
    theme.colors.dashboard.periodThisYearGradient,
  ];
  const periods = useMemo(
    () =>
      periodsDto.map((p, index) => {
        const dateRange = formatters.dateRange(p.from, p.to);
        const labelKey = periodLabelKey(p.label);
        return {
          index,
          title: labelKey ? t(labelKey.key as 'dashboard.title', { count: labelKey.count }) : dateRange,
          dates: { from: p.from, to: p.to, dateRange },
          metrics: p.metrics,
          gradient: gradients[index % gradients.length],
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodsDto, formatters, t, theme],
  );
```

`CardsPanel.types.ts`: `PeriodCardEntry.key` becomes `index: number`; `selectedPeriod: number`; `onPeriodSelect: (index: number) => void` (update `CardsPanel.component.tsx` where it compares/keys). Pass `selectedPeriod: card, onPeriodSelect: setCard`.
- Picker props (built here, rendered by the component):

```ts
  const rangePresets = useMemo(
    () =>
      Object.values(DashboardRangePreset).map((value) => ({
        value,
        label: t(`dashboard.range.preset.${value}` as 'dashboard.title'),
      })),
    [t],
  );
  const appliedRange = dashboardData?.range;
  const triggerLabel = appliedRange
    ? `${appliedRange.preset ? t(`dashboard.range.preset.${appliedRange.preset}` as 'dashboard.title') : t('dashboard.range.custom')} · ${formatters.dateRange(appliedRange.from, appliedRange.to)}`
    : t('dashboard.range.preset.today');
  const rangePickerProps = {
    presets: rangePresets,
    selectedPreset: 'preset' in range ? range.preset : null,
    from: appliedRange?.from ?? '',
    to: appliedRange?.to ?? '',
    maxDate: appliedRange?.today ?? '',
    triggerLabel,
    customLabel: t('dashboard.range.custom'),
    applyLabel: t('dashboard.range.apply'),
    cancelLabel: t('dashboard.range.cancel'),
    dialogLabel: t('dashboard.range.title'),
    locale,
    onPresetSelect: (value: string) => setRange({ preset: value as DashboardRangePreset }),
    onRangeApply: (from: string, to: string) => setRange({ from, to }),
  };
```

Render the picker only once `appliedRange` exists (it needs `maxDate`); before that, the component renders nothing in that slot.
- Chart props: drop `granularity`/`onGranularityChange` inputs from the URL; pass `granularity: dashboardData?.chart.granularity ?? DashboardChartGranularity.HOUR`.
- P&L props: `columns: dashboardData?.pnl.columns ?? []`, `granularity: dashboardData?.pnl.granularity ?? DashboardChartGranularity.DAY`, `csvStamp: appliedRange?.to ?? ''`.
- A 400 from a stale custom URL (e.g. `to` after today) must not leave the page stuck: in the error effect, if `'status' in error && error.status === 400`, call `setRange({ preset: DEFAULT_DASHBOARD_RANGE_PRESET })` instead of `showMessage`.

- [ ] **Step 7: Page component + style + types**

`DashboardPage.types.ts`: add `rangePickerProps: DateRangePickerProps | null` (import the type from `@repo/ui`). Component:

```tsx
    <S.Toolbar>
      <S.Tabs … />
      {rangePickerProps && <S.RangePicker {...rangePickerProps} />}
    </S.Toolbar>
```

Style: replace the stale "store filter pinned right" comments; add

```ts
/** The date filter sits at the right end of the tab rail, on its baseline. */
export const RangePicker = styled(DateRangePicker)`
  flex: 0 0 auto;
  align-self: center;
  margin-bottom: ${tkn('spacing.xs')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    order: -1;
    width: 100%;
  }
`;
```

(`order: -1` puts the picker on its own full-width row ABOVE the tabs on a phone, matching the toolbar's existing wrap comment.) Import `DateRangePicker` from `@repo/ui`.

- [ ] **Step 8: ChartPanel** — remove `granularityOptions`, `granularityValue`, `onGranularityChange` from types, container and component (delete the `SegmentedControl` JSX and any style used only by it). Keep `granularity` for tick formatting. Delete `dashboard.chart.granularity.*` keys from all 16 locales.

- [ ] **Step 9: PnlPanel** — types: `columns: DashboardPnlColumn[]`, `granularity: DashboardChartGranularity`, `csvStamp: string` replace `months`. Container: rename `months` → `columns` throughout; header labels:

```ts
  const columnLabels = useMemo(
    () => columns.map((column) => (column.isCurrent ? t('dashboard.pnl.currentPeriod') : formatters.pnlColumnLabel(column, granularity))),
    [columns, formatters, granularity, t],
  );
```

CSV filename `sellerhill-pnl-${csvStamp}.csv`. Component: highlight `$current={column.isCurrent}` instead of `index === 0` (pass an `isCurrent: boolean[]` or the columns through — keep it a plain prop array; the component stays presentational). `dashboard.pnl.subtitle` copy changes to "Breakdown of the selected period" in all locales.

- [ ] **Step 10: Delete `utils/periodRanges.ts`**; `grep -rn "periodRanges\|DashboardPeriodKey\|DashboardHistoryMonth\|DASHBOARD_CURRENT_PERIOD_KEY" apps/web/src` must return nothing.

- [ ] **Step 11: Demo** — `demoData.ts`: replace `buildDemoDashboard(granularity)` with `buildDemoDashboard(input: DashboardRangeInput): DashboardDataDto`:

```ts
const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const ordersIn = (w: DashboardDateWindow): OrderDto[] =>
  DEMO_ORDERS.filter((o) => {
    const day = localIso(new Date(o.createdAt));
    return day >= w.from && day <= w.to;
  });

const trendOf = (cur: number, prev: number): number | null => (prev === 0 ? null : round2(((cur - prev) / prev) * 100));

export function buildDemoDashboard(input: DashboardRangeInput): DashboardDataDto {
  const today = localIso(new Date());
  let resolved: ResolvedDashboardRange;
  try {
    resolved = resolveDashboardRange(input, today);
  } catch {
    resolved = resolveDashboardRange({ preset: DEFAULT_DASHBOARD_RANGE_PRESET }, today);
  }
  const periods = resolved.periods.map((p) => {
    const current = aggregate(ordersIn(p), null, null);
    const previous = aggregate(ordersIn(p.comparison), null, null);
    return {
      from: p.from,
      to: p.to,
      label: p.label,
      metrics: { ...current, trend: trendOf(current.sales, previous.sales), profitTrend: trendOf(current.profitConfirmed, previous.profitConfirmed) },
    };
  });

  const pointFor = (w: DashboardDateWindow, key: string): DashboardChartPoint => {
    const m = aggregate(ordersIn(w), null, null);
    return { period: key, sales: m.sales, units: m.units, orders: m.orders, netProfit: m.profitConfirmed, grossProfit: m.grossProfit, refunds: m.refunds };
  };
  const points: DashboardChartPoint[] =
    resolved.chartGranularity === DashboardChartGranularity.HOUR
      ? dashboardBucketKeys(resolved.range, DashboardChartGranularity.HOUR).map((key) => {
          const [day, hour] = key.split(' ');
          const orders = DEMO_ORDERS.filter((o) => {
            const d = new Date(o.createdAt);
            return localIso(d) === day && d.getHours() === Number(hour);
          });
          const m = aggregate(orders, null, null);
          return { period: key, sales: m.sales, units: m.units, orders: m.orders, netProfit: m.profitConfirmed, grossProfit: m.grossProfit, refunds: m.refunds };
        })
      : dashboardBucketWindows(resolved.range, resolved.chartGranularity).map((w) => pointFor(w, w.key));

  const columns: DashboardPnlColumn[] = dashboardBucketWindows(resolved.range, resolved.pnlGranularity)
    .reverse()
    .map((w) => {
      const m = aggregate(ordersIn(w), null, null);
      return {
        key: w.key, dateFrom: w.from, dateTo: w.to, isCurrent: w.from <= today && today <= w.to,
        sales: m.sales, units: m.units, orders: m.orders, refunds: m.refunds, adFee: m.adFees,
        amazonShipping: m.amazonShipping, amazonTax: m.amazonTax, purchasePrice: m.costOfGoods,
        transactionFee: m.transactionFees, ebayEarnings: m.estimatedPayout, grossProfit: m.grossProfit,
        netProfit: m.netProfit, profitConfirmed: m.profitConfirmed, profitProvisional: m.profitProvisional,
        estimatedPayout: m.estimatedPayout, margin: m.margin, roi: m.roi,
      };
    });

  return {
    range: {
      preset: resolved.preset, from: resolved.range.from, to: resolved.range.to, today,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      chartGranularity: resolved.chartGranularity, pnlGranularity: resolved.pnlGranularity,
    },
    periods,
    chart: { granularity: resolved.chartGranularity, points, summary: periods[0].metrics },
    pnl: { granularity: resolved.pnlGranularity, columns },
  };
}
```

Delete `scaleMonth`, and `scaleMetrics` if nothing else uses it (`grep`). Demo orders span ~a few weeks, so long ranges show real zeros — that is correct (no invented history). `demoBaseQuery.ts`:

```ts
  if (path === '/dashboard') {
    const input: DashboardRangeInput =
      params.from && params.to ? { from: String(params.from), to: String(params.to) } : { preset: (params.range as DashboardRangePreset) || DEFAULT_DASHBOARD_RANGE_PRESET };
    return ok(buildDemoDashboard(input));
  }
```

- [ ] **Step 12: i18n (all 16 `dashboard.json`)** — under `dashboard`:

```json
"range": {
  "title": "Date range",
  "custom": "Custom range",
  "apply": "Apply",
  "cancel": "Cancel",
  "preset": {
    "today": "Today", "yesterday": "Yesterday", "last7Days": "Last 7 days", "last30Days": "Last 30 days",
    "thisWeek": "This week", "lastWeek": "Last week", "thisMonth": "This month", "lastMonth": "Last month",
    "last3Months": "Last 3 months", "thisYear": "This year", "lastYear": "Last year", "last12Months": "Last 12 months"
  }
},
"periodLabel": {
  "day":   { "current": "Today",     "previous": "Yesterday",  "ago_one": "{{count}} day ago",   "ago_other": "{{count}} days ago" },
  "week":  { "current": "This week", "previous": "Last week",  "ago_one": "{{count}} week ago",  "ago_other": "{{count}} weeks ago" },
  "month": { "current": "This month","previous": "Last month", "ago_one": "{{count}} month ago", "ago_other": "{{count}} months ago" },
  "year":  { "current": "This year", "previous": "Last year",  "ago_one": "{{count}} year ago",  "ago_other": "{{count}} years ago" }
}
```

TR: Bugün / Dün / {{count}} gün önce; Bu hafta / Geçen hafta / {{count}} hafta önce; Bu ay / Geçen ay / {{count}} ay önce; Bu yıl / Geçen yıl / {{count}} yıl önce; presets: Bugün, Dün, Son 7 gün, Son 30 gün, Bu hafta, Geçen hafta, Bu ay, Geçen ay, Son 3 ay, Bu yıl, Geçen yıl, Son 12 ay; title "Tarih aralığı", custom "Özel aralık", apply "Uygula", cancel "Vazgeç". Plural suffixes per locale as in CLAUDE.md "Plurals" (ru/uk `_one/_few/_many/_other`, ro `_one/_few/_other`, fr/es/it/pt `_one/_many/_other`, ar six forms, hi/ur/bn `_one/_other`, zh `_other`). Remove the now-unused `today/thisWeek/thisMonth/thisYear` top-level keys only if `grep -rn "dashboard\.today\|dashboard\.thisWeek" apps/web/src` finds no other user. JSON files may be CRLF — keep line endings (check with `file`), and run `node -e` parity check: every locale has the same key tree as `en`.

- [ ] **Step 13: Build + typecheck + tests + lint**

Run: `pnpm --filter @repo/shared build; pnpm --filter @repo/ui build; pnpm --filter web test; pnpm typecheck; pnpm lint`
Expected: web tests PASS; `tsc` reports only the 3 pre-existing `dominantBaseline` errors; lint 0.

- [ ] **Step 14: Manual check in demo mode**

`pnpm --filter web exec vite --port 5199`, open `http://localhost:5199/tr` → enter the demo → `/tr/dashboard`. Check, at 1440px and 375px: picker on the right of the tabs (above them on the phone); default "Bugün" with cards Bugün/Dün/2 gün önce/3 gün önce; chart tab hourly axis; P&L one column; "Bu ay" → day columns with today highlighted; custom range via the calendar; days after today disabled; card click retargets carousels; view-all link carries the card's dates. Screenshot each state into the scratchpad and look at them.

- [ ] **Step 15: Commit**

```bash
git add apps/web/src/features/dashboard apps/web/src/features/demo/demoData.ts apps/web/src/features/demo/demoBaseQuery.ts packages/shared/src/i18n/resources/*/dashboard.json
git rm apps/web/src/features/dashboard/utils/periodRanges.ts
git commit -m "feat(dashboard): one date filter for cards, chart and P&L; dates come from the API" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Timezone on the profile page + one-time auto-fill

**Files:**
- Create: `apps/web/src/features/profile/hooks/useTimezoneAutoFill.ts`, `apps/web/src/features/profile/utils/timezoneOptions.ts`, `apps/web/src/features/profile/utils/timezoneOptions.test.ts`
- Modify: `apps/web/src/features/profile/ProfilePage.{container,component,style,types}.tsx/ts`, `apps/web/src/features/profile/api/profileApi.ts` (path: the file under `features/profile/api/`), `apps/web/src/layouts/AppLayout/AppLayout.container.tsx`, `packages/shared/src/i18n/resources/*/profile.json`

**Interfaces:**
- Consumes: `ProfileDto.timezone`, `UpdateProfileRequest.timezone` (Task 2).
- Produces: `getTimezoneOptions(current?: string): { value: string; label: string }[]`, `useTimezoneAutoFill(enabled: boolean): void`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';

import { getTimezoneOptions } from './timezoneOptions';

describe('getTimezoneOptions', () => {
  it('lists IANA zones sorted, labelled with the zone name', () => {
    const options = getTimezoneOptions();
    expect(options.length).toBeGreaterThan(100);
    expect(options.find((o) => o.value === 'Europe/Istanbul')?.label).toContain('Europe/Istanbul');
    const values = options.map((o) => o.value);
    expect([...values].sort()).toEqual(values);
  });

  it('always includes the current value even if the runtime does not list it', () => {
    expect(getTimezoneOptions('Etc/Unknown').some((o) => o.value === 'Etc/Unknown')).toBe(true);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `timezoneOptions.ts`**

```ts
/** IANA zones from the browser (same approach as countryOptions' Intl.DisplayNames — no bundled list). */
export function getTimezoneOptions(current?: string): { value: string; label: string }[] {
  const supported =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const values = new Set<string>(supported);
  values.add('UTC');
  if (current) {
    values.add(current);
  }
  return [...values].sort().map((value) => ({ value, label: value.replace(/_/g, ' ') }));
}
```

Adjust the test's first assertion to `toContain('Europe/Istanbul')` — the label for this zone has no underscore, so it matches.

- [ ] **Step 3: Auto-fill hook**

```ts
import { useEffect, useRef } from 'react';

import { isDemoMode } from '@/features/demo/demoMode';
import { useGetProfileQuery, useUpdateProfileMutation } from '@/features/profile/api/profileApi';

/**
 * Fills users.timezone ONCE from the browser when it is empty. Never overwrites
 * a set value (a travelling seller's "yesterday" must not move). Fail-soft.
 */
export function useTimezoneAutoFill(enabled: boolean): void {
  const { data: profile } = useGetProfileQuery(undefined, { skip: !enabled || isDemoMode() });
  const [updateProfile] = useUpdateProfileMutation();
  const sent = useRef(false);

  useEffect(() => {
    if (!profile || profile.timezone || sent.current) {
      return;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) {
      return;
    }
    sent.current = true;
    updateProfile({ timezone }).catch(() => undefined);
  }, [profile, updateProfile]);
}
```

Fix the import path of `profileApi` to the real file name. In `profileApi`, change `updateProfile`'s `invalidatesTags` to `['Profile', 'Auth', 'Dashboard']` (a zone change moves every dashboard figure). Call `useTimezoneAutoFill(Boolean(currentUser))` in `AppLayout.container.tsx` (use whatever the container already reads for the signed-in user; the seller shell only — not `OperatorLayout`).

- [ ] **Step 4: Profile page card** — a separate card under "Address", titled `profile.timezone.title`, with a searchable `ModernSelect` (`isSearchable`, options from `getTimezoneOptions(profile.timezone)`, value `profile.timezone ?? ''`, label `profile.timezone.label`) and `InfoMessage`/caption `profile.timezone.help`. It saves on change (`updateProfile({ timezone })`, mutation flag into `useLoading`), independent of the page's edit mode. Container owns the handler; component renders; style in `.style.ts`; prop types in `.types.ts`. On a 400 show the standard error `MessageModal` with `profile.errors.invalidTimezone`.

i18n (16 `profile.json`): `timezone.title` "Time zone" / "Saat dilimi"; `timezone.label` "Time zone"; `timezone.help` "Your dashboard and daily summary count days in this time zone." / "Panel ve günlük özet günleri bu saat dilimine göre sayar."

- [ ] **Step 5: Tests, lint, manual**

Run: `pnpm --filter web test -- timezoneOptions; pnpm lint; pnpm typecheck`
Manual (local API + web, a real account): clear `users.timezone` for your user in local Postgres, load `/tr/dashboard`, confirm one `PATCH /profile` with your browser zone and the column filled; reload — no second PATCH; change the zone on `/tr/profile`, dashboard refetches.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/profile apps/web/src/layouts/AppLayout/AppLayout.container.tsx packages/shared/src/i18n/resources/*/profile.json
git commit -m "feat(profile): seller time zone setting, filled once from the browser" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs and final verification

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-07-dashboard-date-range-design.md` (two corrections below)

- [ ] **Step 1: Spec corrections** — in §2 drop "(full names only; abbreviations such as `EST` are refused)" (pg_timezone_names lists `EST` as a name); in §4 change the `pnl.columns` shape to the flat `DashboardPnlColumn` used by the code.

- [ ] **Step 2: CLAUDE.md** — rewrite "### Dashboard panel (Sellerboard-style)": toolbar = tabs + `DateRangePicker` on the right; URL `?range=` (default `today`, omitted) or `?from&to`, `?card=0..3`, `tab`; `period`/`granularity` gone; API `GET /v1/dashboard?range|from&to&ebayAccountId` → `{ range, periods, chart, pnl }`; resolver `resolveDashboardRange` in shared is the single date logic (API + demo), web never computes dates; card chain rule; granularity table; e-mail methods `getRangeMetrics` / `getDayMetrics` / `getRangeMetricsByStore`. Add a short "### Seller time zone (`users.timezone`)" section: decision, Postgres validation, auto-fill once from the web, bounds-vs-cast SQL rule with `common/timezone/local-day-sql.ts`, what stays UTC, guards (`dashboard-local-day.guard.spec.ts`, `local-day-filters.guard.spec.ts`). Add the migration row to the migrations table. Remove "Bucket keys are anchored on Postgres' `CURRENT_DATE`" (now wrong).

- [ ] **Step 3: Full verification**

Run: `pnpm --filter @repo/shared build; pnpm --filter @repo/ui build; pnpm --filter api test; pnpm --filter web test; pnpm typecheck; pnpm lint`
Expected: all API and web tests pass; typecheck shows only the 3 known `dominantBaseline` errors; lint 0.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-07-dashboard-date-range-design.md
git commit -m "docs: dashboard date range + seller time zone" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Report the commit hashes** (`git log --oneline -8`) to the operator — the daily-e-mail session waits on `getDayMetrics`' commit.
