/**
 * TopSellersPanel (Presentation)
 * The Listings page's DataTable on the canvas: result count, sort picker,
 * cards by default with a table one toggle away, pagination, skeleton.
 */

import { DataTable, EmptyState, Text } from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { TopSellersPanelComponentProps } from './TopSellersPanel.types';

export const TopSellersPanelComponent = ({
  items,
  total,
  columns,
  renderGridCard,
  viewMode,
  onViewModeChange,
  sortOptions,
  sortValue,
  onSortChange,
  pagination,
  isLoading,
  onRowClick,
}: TopSellersPanelComponentProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard', 'translation']);

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
      emptyContent={
        <EmptyState
          icon="trending-up"
          title={t('dashboard.topSellers.emptyTitle')}
          description={t('dashboard.topSellers.emptySubtitle')}
          size="lg"
        />
      }
      loading={isLoading}
      pagination={pagination}
      onRowClick={onRowClick}
    />
  );
};
