/**
 * TopSellersPanel (Presentation)
 * The Listings page's DataTable on the canvas: result count, sort picker,
 * cards by default with a table one toggle away, pagination, skeleton.
 */

import type { TopListingDto } from '@repo/shared';
import { DataTable, EmptyState, Sparkline, Text } from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { TopSellersPanelComponentProps } from './TopSellersPanel.types';

import { ListingCard } from '@/domain-ui';

export const TopSellersPanelComponent = ({
  items,
  cards,
  total,
  columns,
  viewMode,
  onViewModeChange,
  sortOptions,
  sortValue,
  onSortChange,
  pagination,
  isLoading,
  isError,
  onRetry,
  onOpenListing,
}: TopSellersPanelComponentProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard', 'listings', 'translation']);

  // The whole card opens the listing, so it carries no "details" hint — with
  // four range figures the hint would wrap onto a row of its own.
  const renderGridCard = (item: TopListingDto) => {
    const model = cards[item.listing.id];
    return model ? (
      <ListingCard
        key={item.listing.id}
        {...model.card}
        detailLabel={undefined}
        stats={model.stats}
        trend={
          <Sparkline values={model.series} tone={model.trendTone} ariaLabel={t('dashboard.topSellers.trendAria')} />
        }
        orientation="horizontal"
        onClick={() => onOpenListing(item.listing.id)}
      />
    ) : null;
  };

  const emptyContent = isError ? (
    <EmptyState
      icon="alert-triangle"
      title={t('translation:message.error.header')}
      description={t('listings:listings.errors.loadFailed')}
      action={t('translation:common.retry')}
      onAction={onRetry}
      size="lg"
    />
  ) : (
    <EmptyState
      icon="trending-up"
      title={t('dashboard.topSellers.emptyTitle')}
      description={t('dashboard.topSellers.emptySubtitle')}
      size="lg"
    />
  );

  return (
    <DataTable
      sortOptions={sortOptions}
      sortValue={sortValue}
      onSortChange={onSortChange}
      sortLabel={t('dashboard.topSellers.sortLabel')}
      resultLabel={
        <Trans
          i18nKey="dashboard.topSellers.result"
          ns="dashboard"
          count={total}
          values={{ count: total }}
          components={{ b: <Text variant="body-sm" weight="bold" color="text.primary">{null}</Text> }}
        />
      }
      gridMinItemWidth="27rem"
      gridMaxColumns={2}
      columns={columns}
      data={items}
      renderGridCard={renderGridCard}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      emptyContent={emptyContent}
      loading={isLoading}
      pagination={pagination}
      onRowClick={(row) => onOpenListing(row.listing.id)}
    />
  );
};
