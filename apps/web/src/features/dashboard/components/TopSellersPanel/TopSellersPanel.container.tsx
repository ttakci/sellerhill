/**
 * TopSellersPanel Container
 * The listings that sold in the dashboard's range, ranked — rendered in the
 * Listings page's own card/table format so a seller reads them the same way.
 * The figures on each card are the range's (revenue and its change, units,
 * orders, confirmed net profit), not the listing's lifetime.
 */

import { TOP_LISTINGS_DEFAULT_LIMIT, TopListingSortKey, type TopListingDto } from '@repo/shared';
import { Sparkline, type ViewMode } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetTopListingsQuery } from '../../api/dashboardApi';
import { useTopSellersColumns } from '../../hooks/useTopSellersColumns';
import { toTopSellerStats, trendTone } from '../../utils/topSellerCard';

import { TopSellersPanelComponent } from './TopSellersPanel.component';
import type { TopSellersPanelProps } from './TopSellersPanel.types';

import { ListingCard } from '@/domain-ui';
import { toListingCardProps } from '@/features/listings/shared/listing-card.mapper';

const SORT_KEYS = Object.values(TopListingSortKey);

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

  const { currentData, isFetching } = useGetTopListingsQuery(
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

  const sortOptions = useMemo(
    () => SORT_KEYS.map((key) => ({ value: key, label: t(`dashboard.topSellers.sort.${key}` as 'dashboard.title') })),
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

  const renderGridCard = useCallback(
    (item: TopListingDto) => (
      <ListingCard
        key={item.listing.id}
        {...toListingCardProps(item.listing, tListings, locale)}
        stats={toTopSellerStats(item, t, locale)}
        trend={
          <Sparkline
            values={item.series}
            tone={trendTone(item.changes.sales)}
            ariaLabel={t('dashboard.topSellers.trendAria')}
          />
        }
        orientation="horizontal"
        onClick={() => onOpenListing(item.listing.id)}
      />
    ),
    [t, tListings, locale, onOpenListing],
  );

  const handleRowClick = useCallback((row: TopListingDto) => onOpenListing(row.listing.id), [onOpenListing]);

  return (
    <TopSellersPanelComponent
      items={items}
      total={total}
      columns={columns}
      renderGridCard={renderGridCard}
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
      onRowClick={handleRowClick}
    />
  );
};
