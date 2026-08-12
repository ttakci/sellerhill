import type { OrderDto } from '@repo/shared';
import {
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  SearchField,
  Select,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { toOrderCardProps } from '../shared/order-card.mapper';
import { OrderCard } from '../shared/OrderCard';

import * as S from './OrdersAllPage.style';
import type { OrdersAllPageProps } from './OrdersAllPage.types';

export const OrdersAllPageComponent: React.FC<OrdersAllPageProps> = ({
  orders,
  columns,
  tableView,
  onTableViewChange,
  pagination,
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
  ebayAccountId,
  onEbayAccountChange,
  storeOptions,
  fulfillmentState,
  onFulfillmentStateChange,
  fulfillmentStateOptions,
  onClearFilters,
  hasActiveFilters,
  resultCount,
  isInitialLoading,
  formatCurrency,
  formatDate,
  onOrderClick,
  onBack,
  onDownload,
}) => {
  const { t } = useTranslation(['orders', 'translation']);

  const renderGridCard = (order: OrderDto) => {
    const card = toOrderCardProps(order, t, formatCurrency, formatDate);
    return (
      <OrderCard
        key={order.id}
        {...card}
        onClick={() => onOrderClick(order.id)}
        hoverEffect={false}
      />
    );
  };

  return (
    <S.Container>
      {/*
        No manual "sync from eBay" action: the 15-minute cron already keeps this
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

      <S.FilterBar>
        <S.FilterBarRow>
          <S.SearchWrapper>
            <SearchField
              value={search}
              onChange={onSearchChange}
              placeholder={t('orders.actions.search')}
              size="medium"
              fullWidth
            />
          </S.SearchWrapper>
          <S.SelectWrapper>
            <Select
              value={status}
              onChange={onStatusChange}
              options={statusOptions}
              placeholder={t('orders.filters.allStatuses')}
              size="medium"
              fullWidth
            />
          </S.SelectWrapper>
          <S.SelectWrapper>
            <Select
              value={ebayAccountId}
              onChange={onEbayAccountChange}
              options={storeOptions}
              placeholder={t('orders.filters.allStores')}
              size="medium"
              fullWidth
            />
          </S.SelectWrapper>
          <S.SelectWrapper>
            <Select
              value={fulfillmentState}
              onChange={onFulfillmentStateChange}
              options={fulfillmentStateOptions}
              placeholder={t('orders.fulfillmentState.filter.all')}
              size="medium"
              fullWidth
            />
          </S.SelectWrapper>
          <S.FilterActions>
            <S.ResultCount variant="caption" weight="medium">
              {t('orders.filters.resultCount', { count: resultCount })}
            </S.ResultCount>
            {hasActiveFilters && (
              <Button variant="text" size="small" onClick={onClearFilters}>
                <Text variant="body">{t('orders.filters.clearAll')}</Text>
              </Button>
            )}
          </S.FilterActions>
        </S.FilterBarRow>
      </S.FilterBar>

      <DataTable
        gridMinItemWidth="26rem"
        gridMaxColumns={2}
        columns={columns}
        data={orders}
        renderGridCard={renderGridCard}
        viewMode={tableView}
        onViewModeChange={onTableViewChange}
        emptyContent={
          hasActiveFilters ? (
            <EmptyState
              icon="search"
              title={t('orders.all.filtersTitle')}
              description={t('orders.all.filtersSubtitle')}
              action={t('orders.filters.clearAll')}
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
        onDownload={onDownload}
        pagination={pagination}
        onRowClick={(row) => onOrderClick(row.id)}
      />
    </S.Container>
  );
};
