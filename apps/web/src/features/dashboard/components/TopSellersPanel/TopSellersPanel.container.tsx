/**
 * TopSellersPanel Container
 * The listings that sold in the dashboard's range, ranked — rendered in the
 * Listings page's own card/table format so a seller reads them the same way.
 * The figures on each card are the range's (revenue and its change, units,
 * orders, confirmed net profit), not the listing's lifetime.
 */

import { TOP_LISTINGS_DEFAULT_LIMIT, TopListingSortKey } from '@repo/shared';
import type { ViewMode } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetTopListingsQuery } from '../../api/dashboardApi';
import { useTopSellersColumns } from '../../hooks/useTopSellersColumns';
import { toTopSellerStats, trendTone } from '../../utils/topSellerCard';

import { TopSellersPanelComponent } from './TopSellersPanel.component';
import type { TopSellerCardModel, TopSellersPanelProps } from './TopSellersPanel.types';

import { toListingCardProps } from '@/features/listings/shared/listing-card.mapper';

const SORT_KEYS = Object.values(TopListingSortKey);

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
  onOpenListing,
}: TopSellersPanelProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard', 'translation']);
  // The listing card mapper reads the listings namespace as its default.
  const { t: tListings } = useTranslation(['listings', 'translation']);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [limit, setLimit] = useState<number>(TOP_LISTINGS_DEFAULT_LIMIT);

  const { currentData, isFetching, isError, refetch } = useGetTopListingsQuery(
    { range, ebayAccountId, sortBy, page, limit },
    { skip: !ebayAccountId },
  );
  // A new range/sort/page shows the skeleton, never the previous answer's rows.
  const isLoading = isFetching && !currentData;
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

  const cards = useMemo(
    () =>
      Object.fromEntries(
        items.map((item): [string, TopSellerCardModel] => [
          item.listing.id,
          {
            card: toListingCardProps(item.listing, tListings, locale),
            stats: toTopSellerStats(item, t, locale),
            series: item.series,
            trendTone: trendTone(item.changes.sales),
          },
        ]),
      ),
    [items, t, tListings, locale],
  );

  const sortOptions = useMemo(
    () => SORT_KEYS.map((key) => ({ value: key, label: t(SORT_LABEL_KEYS[key]) })),
    [t],
  );

  const handleSortChange = useCallback(
    (value: string | number) => {
      const next = String(value);
      if ((SORT_KEYS as string[]).includes(next)) {
        onSortChange(next as TopListingSortKey);
      }
    },
    [onSortChange],
  );

  const handleRowsPerPageChange = useCallback(
    (next: number) => {
      setLimit(next);
      onPageChange(1);
    },
    [onPageChange],
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
    />
  );
};
