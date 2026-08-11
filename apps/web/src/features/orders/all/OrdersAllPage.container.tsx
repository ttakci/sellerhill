import { formatCurrency, formatDate, getLocaleConfig, type ViewMode } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetOrdersQuery } from '../api/orders.api';

import { useOrdersColumns } from './hooks/useOrdersColumns';
import { useOrdersFilters } from './hooks/useOrdersFilters';
import { OrdersAllPageComponent } from './OrdersAllPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useLocale } from '@/utils/useLocale';

export const OrdersAllPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['orders', 'translation']);
  const { localeNavigate } = useLocale();
  const [tableView, setTableView] = useState<ViewMode>('grid');

  const {
    page,
    setPage,
    rowsPerPage,
    handleRowsPerPageChange,
    searchInput,
    handleSearchChange,
    status,
    handleStatusChange,
    statusOptions,
    ebayAccountId,
    handleEbayAccountChange,
    fulfillmentState,
    fulfillmentStateOptions,
    handleFulfillmentStateChange,
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
        label: acc.storeName || acc.sellerId || acc.id,
      })),
    ],
    [ebayAccountsData?.items, t]
  );

  const { data, isLoading } = useGetOrdersQuery(serverQuery, {
    refetchOnMountOrArgChange: true,
  });
  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const totalCount = data?.total ?? 0;

  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const fmtCurrency = useCallback(
    (value: number) => formatCurrency(value, localeCfg.locale, localeCfg.currency),
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

  const columns = useOrdersColumns(fmtCurrency, fmtDate);

  const handleDownload = useCallback(() => {
    const headers = [
      t('orders.table.orderNumber'),
      t('orders.table.date'),
      t('orders.table.buyer'),
      t('orders.table.status'),
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
        o.status,
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
    link.setAttribute('download', `zonds_orders_${new Date().toISOString().split('T')[0]}.csv`);
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
        status={status}
        onStatusChange={handleStatusChange}
        statusOptions={statusOptions}
        ebayAccountId={ebayAccountId}
        onEbayAccountChange={handleEbayAccountChange}
        storeOptions={storeOptions}
        fulfillmentState={fulfillmentState}
        onFulfillmentStateChange={handleFulfillmentStateChange}
        fulfillmentStateOptions={fulfillmentStateOptions}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        resultCount={totalCount}
        isInitialLoading={isLoading}
        formatCurrency={fmtCurrency}
        formatDate={fmtDate}
        onOrderClick={(id) => localeNavigate(`/orders/${id}`)}
        onBack={fromDashboard ? () => localeNavigate('/dashboard') : undefined}
        onDownload={handleDownload}
      />
    </EbayAccountGuard>
  );
};
