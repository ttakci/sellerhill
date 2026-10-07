/**
 * Locale-aware formatters for every dashboard surface (cards, chart, P&L).
 * Resolved once in the page container and passed down as props.
 *
 * `currency` is a separate parameter from `languageCode` on purpose — it
 * must come from the seller's connected eBay store marketplace
 * (`resolveStoreCurrency`), never from the UI language. See
 * `getLocaleConfig`'s doc comment.
 *
 * Every date here is a calendar date the API already resolved on the
 * seller's day (`YYYY-MM-DD`, or `YYYY-MM-DD HH` for an hour bucket), parsed
 * as a LOCAL date so the browser's time zone can never shift it.
 */

import { DashboardChartGranularity } from '@repo/shared';
import { formatCompactNumber, formatCurrency, formatDate, getLocaleConfig } from '@repo/ui';
import { useMemo } from 'react';

import type { DashboardFormatters } from '../dashboard.types';

export function useDashboardFormatters(languageCode: string, currency: string): DashboardFormatters {
  const { locale } = useMemo(() => getLocaleConfig(languageCode), [languageCode]);

  return useMemo<DashboardFormatters>(() => {
    const parseBucket = (key: string): Date | null => {
      const [datePart, hourPart] = key.split(' ');
      const [y, m, d] = datePart.split('-').map(Number);
      if (!y || !m || !d) {
        return null;
      }
      return new Date(y, m - 1, d, hourPart ? Number(hourPart) : 0);
    };

    const dayMonth = (date: Date): string => date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    const dayMonthYear = (date: Date): string =>
      date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });

    /** "01 Oct – 07 Oct"; the year is added on both ends when it differs. */
    const span = (from: string, to: string): string => {
      const start = parseBucket(from);
      const end = parseBucket(to);
      if (!start || !end) {
        return `${from} – ${to}`;
      }
      if (from === to) {
        return dayMonth(start);
      }
      if (start.getFullYear() !== end.getFullYear()) {
        return `${dayMonthYear(start)} – ${dayMonthYear(end)}`;
      }
      return `${dayMonth(start)} – ${dayMonth(end)}`;
    };

    /** "07.10.2026" (separator and order follow the locale). */
    const numericDate = (iso: string): string => {
      const date = parseBucket(iso);
      return date ? date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : iso;
    };

    const monthLabel = (isoDate: string): string => {
      const date = parseBucket(isoDate);
      return date ? date.toLocaleDateString(locale, { month: 'short', year: 'numeric' }) : isoDate;
    };

    return {
      currency: (value) => formatCurrency(value, locale, currency),
      compactCurrency: (value) => formatCompactNumber(value, locale),
      number: (value) => new Intl.NumberFormat(locale).format(value),
      percent: (value) => `${new Intl.NumberFormat(locale).format(value)}%`,
      date: (isoDate) =>
        formatDate(isoDate, locale, { year: 'numeric', month: 'short', day: 'numeric' }),
      monthLabel,
      trend: (trend) => {
        if (trend === null || trend === undefined) {
          return undefined;
        }
        const abs = Math.abs(Math.round(trend * 10) / 10);
        return `${trend >= 0 ? '+' : '−'}${new Intl.NumberFormat(locale).format(abs)}%`;
      },
      bucketLabel: (bucketKey, granularity) => {
        const date = parseBucket(bucketKey);
        if (!date) {
          return bucketKey;
        }
        if (granularity === DashboardChartGranularity.HOUR) {
          return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        }
        if (granularity === DashboardChartGranularity.MONTH) {
          return date.toLocaleDateString(locale, { month: 'short' });
        }
        return dayMonth(date);
      },
      bucketLongLabel: (bucketKey, granularity) => {
        const date = parseBucket(bucketKey);
        if (!date) {
          return bucketKey;
        }
        if (granularity === DashboardChartGranularity.HOUR) {
          return date.toLocaleString(locale, {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
        if (granularity === DashboardChartGranularity.MONTH) {
          return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        }
        return date.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      },
      pnlColumnLabel: (column, granularity) => {
        if (granularity === DashboardChartGranularity.MONTH) {
          return monthLabel(column.dateFrom);
        }
        if (granularity === DashboardChartGranularity.WEEK) {
          return span(column.dateFrom, column.dateTo);
        }
        const date = parseBucket(column.dateFrom);
        return date ? dayMonth(date) : column.dateFrom;
      },
      dateRange: (from, to) => (from === to ? numericDate(from) : span(from, to)),
      numericDateRange: (from, to) =>
        from === to ? numericDate(from) : `${numericDate(from)} – ${numericDate(to)}`,
      weekday: (isoDate) => {
        const date = parseBucket(isoDate);
        return date ? date.toLocaleDateString(locale, { weekday: 'long' }) : isoDate;
      },
    };
  }, [locale, currency]);
}
