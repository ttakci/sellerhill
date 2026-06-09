import { OrderDto, OrderStatsDto } from '@repo/shared';
import { formatCurrency, formatDate, getLocaleConfig, useLoading } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetOrdersQuery, useGetOrderStatsQuery, useTriggerOrderSyncMutation } from './api/orders.api';
import { OrdersPageComponent } from './OrdersPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';

interface FormattedOrder extends OrderDto {
  formattedDate: string;
  formattedSalePrice: string;
  formattedPurchasePrice: string;
  formattedNetProfit: string;
  buyerInitials: string;
  avatarColorKey: number;
}

export const OrdersPage: React.FC = () => {
  const { t, i18n } = useTranslation(['orders', 'translation']);
  const { localeNavigate } = useLocale();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const { data, isLoading: isOrdersLoading } = useGetOrdersQuery({
    search: searchQuery || undefined,
    page,
    limit: rowsPerPage,
  });
  const { data: stats, isLoading: isStatsLoading } = useGetOrderStatsQuery();
  const [triggerSync, { isLoading: isSyncing }] = useTriggerOrderSyncMutation();

  const orders = useMemo(() => data?.orders ?? [], [data]);
  const totalCount = data?.total ?? 0;

  const isLoading = isOrdersLoading || isStatsLoading;
  useLoading(isLoading || isSyncing);

  const getInitials = (name?: string) => {
    if (!name) {return '?';}
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColorKey = (name?: string) => {
    const safeName = name || 'X';
    return safeName.charCodeAt(0) % 5;
  };

  const fmtCurrency = useCallback(
    (value: number) => formatCurrency(value, localeCfg.locale, localeCfg.currency),
    [localeCfg]
  );

  const formattedOrders: FormattedOrder[] = useMemo(
    () =>
      orders.map((order) => ({
        ...order,
        formattedDate: formatDate(order.createdAt, localeCfg.locale, {
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        formattedSalePrice: fmtCurrency(order.salePrice),
        formattedPurchasePrice: fmtCurrency(order.purchasePrice),
        formattedNetProfit: fmtCurrency(order.netProfit),
        buyerInitials: getInitials(order.buyerName),
        avatarColorKey: getAvatarColorKey(order.buyerName),
      })),
    [orders, localeCfg, fmtCurrency]
  );

  const formattedStats = useMemo(() => {
    if (!stats) {return undefined;}
    return {
      ...stats,
      formattedTotalSales: fmtCurrency(stats.totalSales),
      formattedTotalProfit: fmtCurrency(stats.totalProfit),
      formattedTodayRevenue: fmtCurrency(stats.todayRevenue),
    };
  }, [stats, fmtCurrency]);

  const handleOrderClick = useCallback(
    (order: FormattedOrder) => {
      localeNavigate(`/orders/${order.id}`);
    },
    [localeNavigate]
  );

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    void triggerSync();
  }, [triggerSync]);

  const handleDownload = useCallback(() => {
    const headers = [
      t('orders.table.orderNumber'),
      t('orders.table.date'),
      t('orders.table.buyer'),
      t('orders.table.status'),
      t('orders.table.salePrice'),
      t('orders.table.netProfit'),
    ];
    const rows = orders.map((o) =>
      [o.ebayOrderId, new Date(o.createdAt).toLocaleDateString(localeCfg.locale), o.buyerName, o.status, o.salePrice, o.netProfit]
        .map((v) => `"${v}"`)
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
  }, [orders, t, localeCfg.locale]);

  return (
    <EbayAccountGuard>
      <OrdersPageComponent
        orders={formattedOrders}
        stats={formattedStats as (OrderStatsDto & { formattedTotalSales: string; formattedTotalProfit: string; formattedTodayRevenue: string }) | undefined}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={(rows) => {
          setRowsPerPage(rows);
          setPage(1);
        }}
        onOrderClick={handleOrderClick}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onDownload={handleDownload}
        onRefresh={handleRefresh}
        isRefreshing={isSyncing}
        totalCount={totalCount}
      />
    </EbayAccountGuard>
  );
};
