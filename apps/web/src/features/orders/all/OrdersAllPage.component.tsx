import type { OrderDto } from '@repo/shared';
import { Button, DataTable, EmptyState, PageHeader, SearchField, Select, Text } from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { toOrderCardProps } from '../shared/order-card.mapper';
import { OrderCard } from '../shared/OrderCard';
import { OrderStageLegend } from '../shared/OrderStageLegend';

import * as S from './OrdersAllPage.style';
import type { OrdersAllPageProps } from './OrdersAllPage.types';

export const OrdersAllPageComponent: React.FC<OrdersAllPageProps> = ({
  orders,
  columns,
  columnOptions,
  visibleColumnKeys,
  onToggleColumn,
  onMoveColumn,
  sortColumn,
  sortDirection,
  onSort,
  tableView,
  onTableViewChange,
  pagination,
  search,
  onSearchChange,
  tab,
  tabItems,
  onTabChange,
  stage,
  onStageChange,
  stageOptions,
  trackingState,
  onTrackingStateChange,
  trackingStateOptions,
  flag,
  onFlagChange,
  flagOptions,
  onClearFilters,
  hasActiveFilters,
  sortOptions,
  sortValue,
  onSortChange,
  resultCount,
  isInitialLoading,
  formatCurrency,
  formatDate,
  formatDay,
  onOrderClick,
  onBack,
  onDownload,
}) => {
  const { t } = useTranslation(['orders', 'listings', 'translation']);

  const renderGridCard = (order: OrderDto) => {
    const card = toOrderCardProps(order, t, formatCurrency, formatDate, formatDay);
    return <OrderCard key={order.id} {...card} onClick={() => onOrderClick(order.id)} />;
  };

  return (
    <S.Container>
      {/*
        No manual "sync from eBay" action: the 20-minute cron already keeps this
        list current, and eBay meters the Fulfillment API per APPLICATION across
        every seller — a user-triggered pull spends a shared quota for almost no
        new information.
      */}
      <PageHeader
        title={t('orders.all.title')}
        subtitle={t('orders.all.subtitle', { count: resultCount })}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
      />

      <S.Toolbar>
        {/* One rail answers "what needs me / what is in flight / what is done";
            the legend beside it explains every badge the table can show. */}
        <S.TabsRow>
          <S.StageTabs
            items={tabItems}
            value={tab}
            onChange={onTabChange}
            variant="underline"
            ariaLabel={t('orders.stageLegend.columnStage')}
          />
          <OrderStageLegend />
        </S.TabsRow>

        <S.FilterRow>
          <S.SearchWrapper>
            <SearchField
              value={search}
              onChange={onSearchChange}
              placeholder={t('orders.actions.search')}
              size="small"
              fullWidth
            />
          </S.SearchWrapper>
          <S.SelectWrapper>
            <Select
              value={stage}
              onChange={onStageChange}
              options={stageOptions}
              placeholder={t('orders.filters.allStages')}
              size="small"
              fullWidth
            />
          </S.SelectWrapper>
          <S.SelectWrapper>
            <Select
              value={trackingState}
              onChange={onTrackingStateChange}
              options={trackingStateOptions}
              placeholder={t('orders.filters.allTrackingStates')}
              size="small"
              fullWidth
            />
          </S.SelectWrapper>
          <S.SelectWrapper>
            <Select
              value={flag}
              onChange={onFlagChange}
              options={flagOptions}
              placeholder={t('orders.filters.allFlags')}
              size="small"
              fullWidth
            />
          </S.SelectWrapper>
          <S.FilterActions>
            {hasActiveFilters && (
              <Button variant="text" size="small" onClick={onClearFilters}>
                <Text variant="body-sm">{t('orders.filters.clearAll')}</Text>
              </Button>
            )}
          </S.FilterActions>
        </S.FilterRow>
      </S.Toolbar>

      <DataTable
        gridMinItemWidth="27rem"
        gridMaxColumns={2}
        columns={columns}
        columnOptions={columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={onToggleColumn}
        onMoveColumn={onMoveColumn}
        columnManagerLabel={t('listings:listings.table.columns')}
        downloadLabel={t('orders.actions.export')}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        data={orders}
        renderGridCard={renderGridCard}
        viewMode={tableView}
        onViewModeChange={onTableViewChange}
        onDownload={onDownload}
        sortOptions={sortOptions}
        sortValue={sortValue}
        onSortChange={onSortChange}
        sortLabel={t('listings:listings.filters.sortLabel')}
        resultLabel={
          <Trans
            i18nKey="listings.filters.resultListed"
            ns="listings"
            values={{ count: resultCount }}
            components={{ b: <Text variant="body-sm" weight="bold" color="text.primary">{null}</Text> }}
          />
        }
        emptyContent={
          hasActiveFilters ? (
            <EmptyState
              icon="search"
              title={t('orders.all.filtersTitle')}
              description={t('orders.all.filtersSubtitle')}
              action={t('orders.all.filtersAction')}
              onAction={onClearFilters}
              size="lg"
            />
          ) : (
            <EmptyState
              icon="shopping-bag"
              title={t('orders.all.emptyTitle')}
              description={t('orders.all.emptySubtitle')}
              size="lg"
            />
          )
        }
        loading={isInitialLoading}
        pagination={pagination}
        onRowClick={(row) => onOrderClick(row.id)}
      />
    </S.Container>
  );
};
