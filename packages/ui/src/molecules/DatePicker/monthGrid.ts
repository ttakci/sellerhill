import type { MonthGridDay } from './DatePicker.types';

const pad = (n: number): string => String(n).padStart(2, '0');

/** `month` is zero-based, like `Date`. */
export const isoOf = (year: number, month: number, day: number): string => `${year}-${pad(month + 1)}-${pad(day)}`;

/** 0 = Sunday … 6 = Saturday. Uses the locale's own week start when the runtime exposes it. */
export const firstDayOfWeek = (locale: string): number => {
  try {
    const intlLocale = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay: number };
      getWeekInfo?: () => { firstDay: number };
    };
    const info = intlLocale.getWeekInfo?.() ?? intlLocale.weekInfo;
    if (info) {
      return info.firstDay % 7; // Intl: 1 = Monday … 7 = Sunday
    }
  } catch {
    // fall through to the default below
  }
  const lower = locale.toLowerCase();
  return lower === 'en' || lower.startsWith('en-us') ? 0 : 1;
};

/** Six weeks of cells covering `month` (zero-based), starting on `weekStart`. */
export function buildMonthGrid(year: number, month: number, weekStart: number): MonthGridDay[] {
  const lead = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, month, 1 - lead + i);
    return {
      iso: isoOf(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    };
  });
}
