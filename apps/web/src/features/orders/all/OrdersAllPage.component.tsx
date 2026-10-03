import type { OrderDto } from '@repo/shared';
import {
  Button,
  DataTable,
  EmptyState,
  Icon,
  IconButton,
  PageHeader,
  SearchField,
  Select,
  TabNav,
  Text,
  ViewToggle,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { toOrderCardProps } from '../shared/order-card.mapper';
import { OrderCard } from '../shared/OrderCard';
import { OrderStageLegend } from '../shared/OrderStageLegend';

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
  resultCount,
  isInitialLoading,
  formatCurrency,
  formatDate,
  formatDay,
  storeLabelFor,
  onOrderClick,
  onBack,
  onDownload,
}) => {
  const { t } = useTranslation(['orders', 'translation']);

  const renderGridCard = (order: OrderDto) => {
    const card = toOrderCardProps(order, t, formatCurrency, formatDate, formatDay, storeLabelFor(order.ebayAccountId));
    return <OrderCard key={order.id} {...card} onClick={() => onOrderClick(order.id)} hoverEffect={false} />;
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
          <TabNav
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
            <ViewToggle viewMode={tableView} onViewModeChange={onTableViewChange} />
            <IconButton variant="ghost" onClick={onDownload} title={t('orders.actions.export')}>
              <Icon name="download" size={20} />
            </IconButton>
          </S.FilterActions>
        </S.FilterRow>
      </S.Toolbar>

      <DataTable
        gridMinItemWidth="24rem"
        gridMaxColumns={3}
        columns={columns}
        data={orders}
        renderGridCard={renderGridCard}
        viewMode={tableView}
        onViewModeChange={onTableViewChange}
        hideViewToggle
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
