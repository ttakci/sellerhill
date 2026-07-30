/**
 * Client-side date ranges for dashboard period cards.
 * Must align with backend SQL (Monday-start weeks via ISO / date_trunc week).
 */

import { DashboardPeriodKey } from '@repo/shared';

import type { PeriodDateInfo } from '../dashboard.types';

const pad = (n: number): string => String(n).padStart(2, '0');

const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Monday of the week containing `d` (local). */
const startOfWeekMonday = (d: Date): Date => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};

export function getPeriodRange(key: DashboardPeriodKey, locale: string): PeriodDateInfo {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtShort = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });

  if (key === DashboardPeriodKey.TODAY) {
    return { from: toIsoDate(today), to: toIsoDate(today), dateRange: fmt(today) };
  }

  if (key === DashboardPeriodKey.THIS_WEEK) {
    const weekStart = startOfWeekMonday(today);
    return {
      from: toIsoDate(weekStart),
      to: toIsoDate(today),
      dateRange: `${fmtShort(weekStart)} – ${fmtShort(today)}`,
    };
  }

  if (key === DashboardPeriodKey.THIS_MONTH) {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: toIsoDate(monthStart),
      to: toIsoDate(today),
      dateRange: `${fmtShort(monthStart)} – ${fmtShort(today)}`,
    };
  }

  const yearStart = new Date(today.getFullYear(), 0, 1);
  return {
    from: toIsoDate(yearStart),
    to: toIsoDate(today),
    dateRange: `${fmtShort(yearStart)} – ${fmtShort(today)}`,
  };
}

export function getAllPeriodRanges(locale: string): Record<DashboardPeriodKey, PeriodDateInfo> {
  return {
    [DashboardPeriodKey.TODAY]: getPeriodRange(DashboardPeriodKey.TODAY, locale),
    [DashboardPeriodKey.THIS_WEEK]: getPeriodRange(DashboardPeriodKey.THIS_WEEK, locale),
    [DashboardPeriodKey.THIS_MONTH]: getPeriodRange(DashboardPeriodKey.THIS_MONTH, locale),
    [DashboardPeriodKey.THIS_YEAR]: getPeriodRange(DashboardPeriodKey.THIS_YEAR, locale),
  };
}
