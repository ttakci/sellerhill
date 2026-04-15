import { OrderDto } from '@repo/shared';
import { useLoading } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useGetOrdersQuery, useGetOrderStatsQuery, useTriggerOrderSyncMutation } from './api/orders.api';
import { OrdersPageComponent } from './OrdersPage.component';

export const OrdersPage: React.FC = () => {
  const { t } = useTranslation(['orders', 'translation']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading: isOrdersLoading, refetch: refetchOrders } = useGetOrdersQuery();
  const { data: stats, isLoading: isStatsLoading, refetch: refetchStats } = useGetOrderStatsQuery();
  const [triggerSync, { isLoading: isSyncing }] = useTriggerOrderSyncMutation();

  const orders = data?.orders ?? [];

  const isLoading = isOrdersLoading || isStatsLoading;
  useLoading(isLoading);

  // Filter orders based on search query
  const filteredOrders = orders.filter((order: OrderDto) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (order.orderNumber ?? '').toLowerCase().includes(searchLower) ||
      (order.buyerName ?? '').toLowerCase().includes(searchLower) ||
      (order.buyerEmail ?? '').toLowerCase().includes(searchLower)
    );
  });

  // Paginate orders
  const paginatedOrders = filteredOrders.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleOrderClick = (order: OrderDto) => {
    void navigate(`/orders/${order.id}`);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1); // Reset to first page when searching
  };

  const handleRefresh = async () => {
    await triggerSync();
    await refetchOrders();
    await refetchStats();
  };

  const handleDownload = () => {
    const headers = [
      t('table.orderNumber'),
      t('table.date'),
      t('table.buyer'),
      t('table.status'),
      t('table.salePrice'),
      t('table.netProfit'),
    ];
    const rows = orders.map((o) =>
      [o.orderNumber, new Date(o.createdAt).toLocaleDateString(), o.buyerName, o.status, o.salePrice, o.netProfit]
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
  };

  return (
    <OrdersPageComponent
      orders={paginatedOrders}
      stats={stats}
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
      totalCount={filteredOrders.length}
    />
  );
};
