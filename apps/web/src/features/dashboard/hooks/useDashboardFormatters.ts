/**
 * Locale-aware formatters for every dashboard surface (cards, chart, P&L).
 * Resolved once in the page container and passed down as props.
 *
 * `currency` is a separate parameter from `languageCode` on purpose — it
 * must come from the seller's connected eBay store marketplace
 * (`resolveStoreCurrency`), never from the UI language. See
 * `getLocaleConfig`'s doc comment.
 */

import { DashboardChartGranularity } from '@repo/shared';
import { formatCompactNumber, formatCurrency, formatDate, getLocaleConfig } from '@repo/ui';
import { useMemo } from 'react';

import type { DashboardFormatters } from '../dashboard.types';

export function useDashboardFormatters(languageCode: string, currency: string): DashboardFormatters {
  const { locale } = useMemo(() => getLocaleConfig(languageCode), [languageCode]);

  return useMemo<DashboardFormatters>(() => {
    const parseIsoDate = (isoDate: string): Date | null => {
      const [y, m, d] = isoDate.split('-').map(Number);
      if (!y || !m || !d) {
        return null;
      }
      return new Date(y, m - 1, d);
    };

    return {
      currency: (value) => formatCurrency(value, locale, currency),
      compactCurrency: (value) => formatCompactNumber(value, locale),
      number: (value) => new Intl.NumberFormat(locale).format(value),
      percent: (value) => `${new Intl.NumberFormat(locale).format(value)}%`,
      date: (isoDate) =>
        formatDate(isoDate, locale, { year: 'numeric', month: 'short', day: 'numeric' }),
      monthLabel: (isoDate) => {
        const date = parseIsoDate(isoDate);
        return date
          ? date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
          : isoDate;
      },
      trend: (trend) => {
        if (trend === null || trend === undefined) {
          return undefined;
        }
        const abs = Math.abs(Math.round(trend * 10) / 10);
        return `${trend >= 0 ? '+' : '−'}${new Intl.NumberFormat(locale).format(abs)}%`;
      },
      bucketLabel: (isoDate, granularity) => {
        const date = parseIsoDate(isoDate);
        if (!date) {
          return isoDate;
        }
        if (granularity === DashboardChartGranularity.MONTH) {
          return date.toLocaleDateString(locale, { month: 'short' });
        }
        return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
      },
      bucketLongLabel: (isoDate, granularity) => {
        const date = parseIsoDate(isoDate);
        if (!date) {
          return isoDate;
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
    };
  }, [locale, currency]);
}
