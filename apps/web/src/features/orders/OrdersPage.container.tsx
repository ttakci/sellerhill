import { OrderDto } from '@repo/shared';
import { useLoading } from '@repo/ui';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetOrdersQuery, useGetOrderStatsQuery } from './api/orders.api';
import { OrdersPageComponent } from './OrdersPage.component';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: orders = [], isLoading: isOrdersLoading } = useGetOrdersQuery();
  const { data: stats, isLoading: isStatsLoading } = useGetOrderStatsQuery();

  const isLoading = isOrdersLoading || isStatsLoading;
  useLoading(isLoading);

  // Filter orders based on search query
  const filteredOrders = orders.filter((order: OrderDto) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.buyerName.toLowerCase().includes(searchLower) ||
      order.buyerEmail.toLowerCase().includes(searchLower)
    );
  });

  // Paginate orders
  const paginatedOrders = filteredOrders.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleOrderClick = (order: OrderDto) => {
    navigate(`/orders/${order.id}`);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1); // Reset to first page when searching
  };

  return (
    <OrdersPageComponent
      orders={paginatedOrders}
      stats={stats}
      isLoading={isLoading}
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
    />
  );
};
