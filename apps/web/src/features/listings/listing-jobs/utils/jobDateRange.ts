import { ListingJobDatePreset } from '@repo/shared';

import type { JobDateRange } from './jobDateRange.types';

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const daysBefore = (from: Date, days: number): Date => {
  const result = new Date(from);
  result.setDate(result.getDate() - days);
  return result;
};

/**
 * Resolves a discoverable date-range preset (a Select, not a free-text field)
 * to explicit YYYY-MM-DD bounds for the jobs list query. The backend only
 * ever sees plain date bounds — it never parses a typed date out of search
 * text.
 */
export const resolveJobDateRange = (
  preset: ListingJobDatePreset,
  now: Date = new Date()
): JobDateRange => {
  const today = toIsoDate(now);
  switch (preset) {
    case ListingJobDatePreset.TODAY:
      return { dateFrom: today, dateTo: today };
    case ListingJobDatePreset.LAST_7_DAYS:
      return { dateFrom: toIsoDate(daysBefore(now, 6)), dateTo: today };
    case ListingJobDatePreset.LAST_30_DAYS:
      return { dateFrom: toIsoDate(daysBefore(now, 29)), dateTo: today };
    case ListingJobDatePreset.THIS_MONTH:
      return { dateFrom: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: today };
    case ListingJobDatePreset.ALL:
    default:
      return {};
  }
};
