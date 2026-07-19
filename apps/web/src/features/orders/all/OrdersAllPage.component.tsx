import type { OrderDto } from '@repo/shared';
import {
  Button,
  DataTable,
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
  needsAttention,
  onNeedsAttentionChange,
  needsAttentionOptions,
  onClearFilters,
  hasActiveFilters,
  resultCount,
  isInitialLoading,
  formatCurrency,
  formatDate,
  onOrderClick,
  onBack,
  onDownload,
  onRefresh,
  isRefreshing,
}) => {
  const { t } = useTranslation(['orders', 'translation']);

  const renderGridCard = (order: OrderDto) => {
    const card = toOrderCardProps(order, t, formatCurrency, formatDate);
    return <OrderCard key={order.id} {...card} onClick={() => onOrderClick(order.id)} />;
  };

  return (
    <S.Container>
      <PageHeader
        title={t('orders.all.title')}
        subtitle={t('orders.all.subtitle', { count: resultCount })}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
        actions={
          <Button variant="secondary" size="medium" onClick={onRefresh} isLoading={isRefreshing}>
            <Text variant="body">{t('orders.actions.refresh')}</Text>
          </Button>
        }
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
              value={needsAttention ? 'true' : 'false'}
              onChange={onNeedsAttentionChange}
              options={needsAttentionOptions}
              placeholder={t('orders.autoFulfill.filter.all')}
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
        columns={columns}
        data={orders}
        renderGridCard={renderGridCard}
        viewMode={tableView}
        onViewModeChange={onTableViewChange}
        emptyMessage={
          isInitialLoading
            ? t('translation:common.loading')
            : t('orders.all.emptyTitle')
        }
        onDownload={onDownload}
        pagination={pagination}
        onRowClick={(row) => onOrderClick(row.id)}
      />
    </S.Container>
  );
};
