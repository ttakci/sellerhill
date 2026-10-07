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
    const calendar = Object.prototype.hasOwnProperty.call(CALENDAR_PRESETS, input.preset)
      ? CALENDAR_PRESETS[input.preset]
      : undefined;
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
