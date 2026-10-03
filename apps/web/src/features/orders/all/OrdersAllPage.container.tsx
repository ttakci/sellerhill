import { ORDER_STAGE_TABS, OrderStageTab, type OrderDto } from '@repo/shared';
import {
  formatCurrency,
  formatDate,
  formatPercent,
  getLocaleConfig,
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
  // Cards by default on every width; the table is one toggle away.
  const [tableView, setTableView] = useState<ViewMode>('grid');

  const {
    page,
    setPage,
    rowsPerPage,
    handleRowsPerPageChange,
    searchInput,
    handleSearchChange,
    ebayAccountId,
    tab,
    handleTabChange,
    hasUrlSelection,
    stage,
    stageOptions,
    handleStageChange,
    trackingState,
    trackingOptions,
    handleTrackingStateChange,
    flag,
    flagOptions,
    handleFlagChange,
    handleClearFilters,
    hasActiveFilters,
    serverQuery,
    fromDashboard,
  } = useOrdersFilters();

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();

  const { data, isLoading, isFetching } = useGetOrdersQuery(serverQuery, {
    refetchOnMountOrArgChange: true,
    skip: !ebayAccountId,
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
    { refetchOnMountOrArgChange: true, skip: !ebayAccountId }
  );

  const countFor = useCallback(
    (tabId: OrderStageTab): number => {
      if (!stageCounts) {
        return 0;
      }
      const stageSum = ORDER_STAGE_TABS[tabId].reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0);
      // "Needs action" also holds late orders of any open stage, so the API
      // counts it with the predicate the tab filters on.
      return tabId === OrderStageTab.ACTION ? (stageCounts.needsAction ?? stageSum) : stageSum;
    },
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

  /* Money renders in each ORDER's own store marketplace currency, never the
     UI language and never one page-wide currency — under "all stores" a US
     and a UK store sit in one list. A row with no store falls back to the
     filtered store, then the first connected one. */
  const fmtCurrency = useCallback(
    (value: number, rowEbayAccountId?: string | null) =>
      /* Always two decimals: "$9,8" beside "$24,99" reads as a typo on a page
         whose whole job is to be believed about money. */
      formatCurrency(
        value,
        localeCfg.locale,
        resolveStoreCurrency(ebayAccountsData?.items ?? [], rowEbayAccountId || ebayAccountId),
        2
      ),
    [localeCfg, ebayAccountsData, ebayAccountId]
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

  /* eBay's ship-by date is a day, not a moment — the list shows it short. */
  const fmtDay = useCallback(
    (value: string) => formatDate(value, localeCfg.locale, { month: 'short', day: 'numeric' }),
    [localeCfg]
  );

  const columns = useOrdersColumns(fmtCurrency, fmtDate, fmtMargin, fmtDay);

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
        trackingState={trackingState}
        onTrackingStateChange={handleTrackingStateChange}
        trackingStateOptions={trackingOptions}
        flag={flag}
        onFlagChange={handleFlagChange}
        flagOptions={flagOptions}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        resultCount={totalCount}
        isInitialLoading={isLoading || isFetching}
        formatCurrency={fmtCurrency}
        formatDate={fmtDate}
        formatDay={fmtDay}
        onOrderClick={(id) => localeNavigate(`/orders/${id}`)}
        onBack={fromDashboard ? () => localeNavigate('/dashboard') : undefined}
        onDownload={handleDownload}
      />
    </EbayAccountGuard>
  );
};
