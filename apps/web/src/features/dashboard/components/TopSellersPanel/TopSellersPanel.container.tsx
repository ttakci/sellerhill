/**
 * TopSellersPanel Container
 * The listings that sold in the dashboard's range, ranked — rendered in the
 * Listings page's own card/table format so a seller reads them the same way.
 * The figures on each card are the range's (revenue and its change, units,
 * orders, confirmed net profit), not the listing's lifetime.
 */

import { useTheme } from '@emotion/react';
import { DashboardChartGranularity, TOP_LISTINGS_DEFAULT_LIMIT, TopListingSortKey } from '@repo/shared';
import { formatCurrency, type SparklineTone, type ViewMode } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetTopListingsQuery } from '../../api/dashboardApi';
import { useTopSellersColumns } from '../../hooks/useTopSellersColumns';
import { findPeakIndex, toTopSellerStats, trendTone } from '../../utils/topSellerCard';

import { TopSellersPanelComponent } from './TopSellersPanel.component';
import type { TopSellerCardModel, TopSellersPanelProps } from './TopSellersPanel.types';

import { toListingCardProps } from '@/features/listings/shared/listing-card.mapper';

const SORT_KEYS = Object.values(TopListingSortKey);

/**
 * What the trend line draws for each sort: the sorted metric, revenue for the
 * change sort (the series the API returns). Money is the listing's currency.
 */
const TREND_METRIC: Record<TopListingSortKey, { labelKey: string; money: boolean }> = {
  [TopListingSortKey.SALES]: { labelKey: 'dashboard.topSellers.stats.sales', money: true },
  [TopListingSortKey.CHANGE]: { labelKey: 'dashboard.topSellers.stats.sales', money: true },
  [TopListingSortKey.UNITS]: { labelKey: 'dashboard.topSellers.stats.units', money: false },
  [TopListingSortKey.ORDERS]: { labelKey: 'dashboard.topSellers.stats.orders', money: false },
  [TopListingSortKey.NET_PROFIT]: { labelKey: 'dashboard.topSellers.stats.netProfit', money: true },
};

const GRANULARITY_KEY: Record<DashboardChartGranularity, string> = {
  [DashboardChartGranularity.HOUR]: 'dashboard.topSellers.trend.granularity.hour',
  [DashboardChartGranularity.DAY]: 'dashboard.topSellers.trend.granularity.day',
  [DashboardChartGranularity.WEEK]: 'dashboard.topSellers.trend.granularity.week',
  [DashboardChartGranularity.MONTH]: 'dashboard.topSellers.trend.granularity.month',
};

/** The sort picker's label per key — exhaustive over the enum. */
const SORT_LABEL_KEYS: Record<TopListingSortKey, string> = {
  [TopListingSortKey.SALES]: 'dashboard.topSellers.sort.sales',
  [TopListingSortKey.UNITS]: 'dashboard.topSellers.sort.units',
  [TopListingSortKey.ORDERS]: 'dashboard.topSellers.sort.orders',
  [TopListingSortKey.NET_PROFIT]: 'dashboard.topSellers.sort.netProfit',
  [TopListingSortKey.CHANGE]: 'dashboard.topSellers.sort.change',
};

export const TopSellersPanel = ({
  range,
  ebayAccountId,
  sortBy,
  page,
  onSortChange,
  onPageChange,
  locale,
  formatters,
  onOpenListing,
}: TopSellersPanelProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard', 'translation']);
  // The listing card mapper reads the listings namespace as its default.
  const { t: tListings } = useTranslation(['listings', 'translation']);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [limit, setLimit] = useState<number>(TOP_LISTINGS_DEFAULT_LIMIT);

  const { currentData, isFetching, isError, refetch } = useGetTopListingsQuery(
    { range, ebayAccountId, sortBy, page, limit },
    { skip: !ebayAccountId }
  );
  // A new range/sort/page shows the skeleton, never the previous answer's rows.
  // No store yet (still resolving) is loading too — never a flash of "nothing sold".
  const isLoading = (isFetching && !currentData) || !ebayAccountId;
  const items = useMemo(() => currentData?.items ?? [], [currentData]);
  const total = currentData?.total ?? 0;

  // A page past the end (a bookmark, a store switch keeping `?tpage=`) would
  // read "nothing sold" while listings did sell: go back to the first page.
  useEffect(() => {
    if (currentData && currentData.items.length === 0 && currentData.total > 0 && page > 1) {
      onPageChange(1);
    }
  }, [currentData, page, onPageChange]);

  const columns = useTopSellersColumns(locale);
  const theme = useTheme();

  // Up green, down red; flat or no comparison in the brand blue (a grey line read as "disabled").
  const lineColor = useCallback(
    (tone: SparklineTone): string =>
      tone === 'positive'
        ? theme.colors.semantic.success
        : tone === 'negative'
          ? theme.colors.semantic.error
          : theme.colors.brand.primary,
    [theme]
  );

  const trendColors = useMemo(
    () => ({
      empty: theme.colors.text.tertiary,
      surface: theme.colors.surface.primary,
      grid: theme.colors.border.primary,
      axis: theme.colors.text.tertiary,
      axisFontSize: theme.typography.fontSize.xs,
    }),
    [theme]
  );

  const granularity = currentData?.granularity ?? DashboardChartGranularity.DAY;
  const seriesKeys = useMemo(() => currentData?.seriesKeys ?? [], [currentData]);
  const trendMetric = TREND_METRIC[currentData?.sortBy ?? sortBy];

  const formatTrendTick = useCallback(
    (key: string) => formatters.bucketLabel(key, granularity),
    [formatters, granularity]
  );
  const formatTrendTooltipTitle = useCallback(
    (key: string) => formatters.bucketLongLabel(key, granularity),
    [formatters, granularity]
  );
  const stopCardClick = useCallback((event: React.MouseEvent) => event.stopPropagation(), []);

  const buildTrend = useCallback(
    (series: number[], currency: string, tone: SparklineTone) => {
      const count = new Intl.NumberFormat(locale);
      const formatValue = (value: number): string =>
        trendMetric.money ? formatCurrency(value, locale, currency, 2) : count.format(value);
      const points = seriesKeys.map((key, index) => ({ key, value: series[index] ?? 0 }));
      const peak = findPeakIndex(points.map((p) => p.value));
      const valueLabel = t(trendMetric.labelKey);
      return {
        points,
        title: t('dashboard.topSellers.trend.title', {
          metric: valueLabel,
          granularity: t(GRANULARITY_KEY[granularity]),
        }),
        peakLabel:
          peak === null
            ? undefined
            : t('dashboard.topSellers.trend.peak', {
                date: formatters.bucketLabel(points[peak].key, granularity),
                value: formatValue(points[peak].value),
              }),
        valueLabel,
        color: lineColor(tone),
        formatValue,
      };
    },
    [locale, trendMetric, seriesKeys, t, granularity, formatters, lineColor]
  );

  const cards = useMemo(
    () =>
      Object.fromEntries(
        items.map((item): [string, TopSellerCardModel] => [
          item.listing.id,
          {
            card: toListingCardProps(item.listing, tListings, locale),
            stats: toTopSellerStats(item, t, locale),
            trend: buildTrend(item.series, item.listing.currency || 'USD', trendTone(item.changes.sales)),
          },
        ])
      ),
    [items, t, tListings, locale, buildTrend]
  );

  const sortOptions = useMemo(() => SORT_KEYS.map((key) => ({ value: key, label: t(SORT_LABEL_KEYS[key]) })), [t]);

  const handleSortChange = useCallback(
    (value: string | number) => {
      const next = String(value);
      if ((SORT_KEYS as string[]).includes(next)) {
        onSortChange(next as TopListingSortKey);
      }
    },
    [onSortChange]
  );

  const handleRowsPerPageChange = useCallback(
    (next: number) => {
      setLimit(next);
      onPageChange(1);
    },
    [onPageChange]
  );

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <TopSellersPanelComponent
      items={items}
      cards={cards}
      total={total}
      columns={columns}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      sortOptions={sortOptions}
      sortValue={sortBy}
      onSortChange={handleSortChange}
      pagination={{
        count: total,
        page,
        rowsPerPage: limit,
        onPageChange,
        onRowsPerPageChange: handleRowsPerPageChange,
        labelRowsPerPage: t('translation:common.rowsPerPage'),
        labelInfo: t('translation:common.showing_info'),
      }}
      isLoading={isLoading}
      isError={isError && !isFetching}
      onRetry={handleRetry}
      onOpenListing={onOpenListing}
      trendColors={trendColors}
      formatTrendTick={formatTrendTick}
      formatTrendTooltipTitle={formatTrendTooltipTitle}
      stopCardClick={stopCardClick}
    />
  );
};
