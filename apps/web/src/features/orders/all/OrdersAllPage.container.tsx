import { ORDER_STAGE_TABS, OrderStageTab, type OrderDto } from '@repo/shared';
import {
  formatCurrency,
  formatDate,
  formatPercent,
  getLocaleConfig,
  useIsMobile,
  type TabNavItem,
  type ViewMode,
} from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetOrderStageCountsQuery, useGetOrdersQuery } from '../api/orders.api';

import { useOrdersColumns } from './hooks/useOrdersColumns';
import { useOrdersFilters } from './hooks/useOrdersFilters';
import { OrdersAllPageComponent } from './OrdersAllPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';
import { useLocale } from '@/utils/useLocale';

export const OrdersAllPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['orders', 'translation']);
  const { localeNavigate } = useLocale();
  /* Rows are the default on a desk — a seller scans twenty sales down one
     column of profit figures; cards are the default where a table would
     have to scroll sideways. */
  const isMobile = useIsMobile();
  const [tableView, setTableView] = useState<ViewMode>(isMobile ? 'grid' : 'table');

  const {
    page,
    setPage,
    rowsPerPage,
    handleRowsPerPageChange,
    searchInput,
    handleSearchChange,
    ebayAccountId,
    handleEbayAccountChange,
    tab,
    handleTabChange,
    hasUrlSelection,
    stage,
    stageOptions,
    handleStageChange,
    trackingState,
    trackingOptions,
    handleTrackingStateChange,
    handleClearFilters,
    hasActiveFilters,
    serverQuery,
    fromDashboard,
  } = useOrdersFilters();

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();

  const storeOptions = useMemo(
    () => [
      { value: '', label: t('orders.filters.allStores') },
      ...(ebayAccountsData?.items ?? []).map((acc) => ({
        value: acc.id,
        label: acc.storeName || acc.ebayUsername || acc.sellerId || acc.id,
      })),
    ],
    [ebayAccountsData?.items, t]
  );

  const { data, isLoading, isFetching } = useGetOrdersQuery(serverQuery, {
    refetchOnMountOrArgChange: true,
  });
  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const totalCount = data?.total ?? 0;

  /* The tab counts describe the whole store (or the filtered store / link
     state), never the current tab or search — they are what makes the rail
     legible, not a second result count. */
  const { data: stageCounts } = useGetOrderStageCountsQuery(
    {
      ebayAccountId: ebayAccountId || undefined,
      isTracked: serverQuery.isTracked,
    },
    { refetchOnMountOrArgChange: true }
  );

  const countFor = useCallback(
    (tabId: OrderStageTab): number =>
      stageCounts ? ORDER_STAGE_TABS[tabId].reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0) : 0,
    [stageCounts]
  );

  const tabItems = useMemo<TabNavItem[]>(
    () =>
      Object.values(OrderStageTab).map((tabId) => ({
        id: tabId,
        label: t(`orders.stageTabs.${tabId}`),
        count: tabId === OrderStageTab.ALL ? undefined : countFor(tabId),
      })),
    [countFor, t]
  );

  /* Open on "Needs action" when something is waiting and the URL chose
     nothing — once per mount, so a seller who then clicks "All" is not
     bounced back on the next refetch. */
  const defaultedTab = useRef(false);
  useEffect(() => {
    if (defaultedTab.current || !stageCounts || hasUrlSelection) {
      return;
    }
    defaultedTab.current = true;
    if (tab === OrderStageTab.ALL && countFor(OrderStageTab.ACTION) > 0) {
      handleTabChange(OrderStageTab.ACTION);
    }
  }, [stageCounts, hasUrlSelection, tab, countFor, handleTabChange]);

  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  /* Money renders in the connected eBay store's marketplace currency, never
     the UI language — a filtered store narrows to its own currency, "all
     stores" falls back to the first connected store. */
  const currency = useMemo(
    () => resolveStoreCurrency(ebayAccountsData?.items ?? [], ebayAccountId),
    [ebayAccountsData, ebayAccountId]
  );
  /* Always two decimals: "$9,8" beside "$24,99" reads as a typo on a page
     whose whole job is to be believed about money. */
  const fmtCurrency = useCallback(
    (value: number) => formatCurrency(value, localeCfg.locale, currency, 2),
    [localeCfg, currency]
  );

  /* Net margin on the sale, shown under the profit figure. Only on an order
     whose profit is known — an estimate carries its badge instead. */
  const fmtMargin = useCallback(
    (order: OrderDto): string | null =>
      order.salePrice > 0 && order.profitBasis ? formatPercent(order.netProfit / order.salePrice, localeCfg.locale, 1) : null,
    [localeCfg]
  );

  const fmtDate = useCallback(
    (value: string) =>
      formatDate(value, localeCfg.locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [localeCfg]
  );

  const columns = useOrdersColumns(fmtCurrency, fmtDate, fmtMargin);

  const handleDownload = useCallback(() => {
    const headers = [
      t('orders.table.orderNumber'),
      t('orders.table.date'),
      t('orders.table.buyer'),
      t('orders.stageLegend.columnStage'),
      t('orders.table.salePrice'),
      t('orders.table.purchasePrice'),
      t('orders.table.netProfit'),
      t('orders.autoFulfill.column'),
    ];
    const rows = orders.map((o) =>
      [
        o.ebayOrderId,
        new Date(o.createdAt).toLocaleDateString(localeCfg.locale),
        o.buyerName ?? '',
        t(`orders.stage.${o.stage}.label`),
        o.salePrice,
        o.purchasePrice,
        o.netProfit,
        o.autoFulfillStatus ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sellerhill_orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [orders, t, localeCfg.locale]);

  return (
    <EbayAccountGuard>
      <OrdersAllPageComponent
        orders={orders}
        columns={columns}
        tableView={tableView}
        onTableViewChange={setTableView}
        pagination={{
          count: totalCount,
          page,
          rowsPerPage,
          onPageChange: setPage,
          onRowsPerPageChange: handleRowsPerPageChange,
          labelRowsPerPage: t('translation:common.rowsPerPage'),
          labelInfo: t('translation:common.showing_info'),
        }}
        search={searchInput}
        onSearchChange={handleSearchChange}
        tab={tab}
        tabItems={tabItems}
        onTabChange={handleTabChange}
        stage={stage}
        onStageChange={handleStageChange}
        stageOptions={stageOptions}
        ebayAccountId={ebayAccountId}
        onEbayAccountChange={handleEbayAccountChange}
        storeOptions={storeOptions}
        trackingState={trackingState}
        onTrackingStateChange={handleTrackingStateChange}
        trackingStateOptions={trackingOptions}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        resultCount={totalCount}
        isInitialLoading={isLoading || isFetching}
        formatCurrency={fmtCurrency}
        formatDate={fmtDate}
        onOrderClick={(id) => localeNavigate(`/orders/${id}`)}
        onBack={fromDashboard ? () => localeNavigate('/dashboard') : undefined}
        onDownload={handleDownload}
      />
    </EbayAccountGuard>
  );
};
