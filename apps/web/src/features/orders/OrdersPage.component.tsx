import { OrderDto, OrderStatus, OrderStatsDto } from '@repo/shared';
import {
  DataTable,
  Icon,
  ModernTextInput,
  PageHeader,
  StatusBadge,
  TablePagination as Pagination,
  useTheme,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './OrdersPage.style';

interface OrdersPageComponentProps {
  orders: OrderDto[];
  stats: OrderStatsDto | undefined;
  isLoading: boolean;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  onOrderClick: (order: OrderDto) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDownload: () => void;
  totalCount: number;
}

const orderStatusToBadgeStatus = (status: OrderStatus): string => {
  const map: Record<OrderStatus, string> = {
    [OrderStatus.COMPLETED]: 'completed',
    [OrderStatus.SHIPPED]: 'shipped',
    [OrderStatus.PROCESSING]: 'processing',
    [OrderStatus.CANCELLED]: 'cancelled',
    [OrderStatus.PENDING]: 'pending',
    [OrderStatus.WAITING_SHIPMENT]: 'warning',
  };
  return map[status] || 'default';
};

export const OrdersPageComponent: React.FC<OrdersPageComponentProps> = ({
  orders,
  stats,
  isLoading,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onOrderClick,
  searchQuery,
  onSearchChange,
  onDownload,
  totalCount,
}) => {
  const { t, i18n } = useTranslation(['orders', 'translation']);
  const { theme } = useTheme();

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name?: string) => {
    const safeName = name || 'X';
    const colors = [
      theme.colors.semanticTint.info,
      theme.colors.semanticTint.warning,
      theme.colors.semanticTint.success,
      theme.colors.semanticTint.error,
      theme.colors.semanticTint.neutral,
    ];
    const index = safeName.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
      style: 'currency',
      currency: i18n.language === 'tr' ? 'TRY' : 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateString));
  };

  const columns = [
    {
      key: 'orderNumber',
      header: t('orders:orders.table.orderNumber'),
      render: (_: any, order: OrderDto) => <S.OrderNumber variant="mono" weight="medium" color="semantic.info">{order.orderNumber}</S.OrderNumber>,
    },
    {
      key: 'createdAt',
      header: t('orders.table.date'),
      render: (_: any, order: OrderDto) => <S.SecondaryText variant="body" muted>{formatDate(order.createdAt)}</S.SecondaryText>,
    },
    {
      key: 'buyer',
      header: t('orders.table.buyer'),
      render: (_: any, order: OrderDto) => (
        <S.BuyerInfo>
          <S.BuyerAvatar $color={getAvatarColor(order.buyerName)}>{getInitials(order.buyerName)}</S.BuyerAvatar>
          <S.BuyerName variant="body" weight="medium">{order.buyerName}</S.BuyerName>
        </S.BuyerInfo>
      ),
    },
    {
      key: 'status',
      header: t('orders.table.status'),
      render: (_: any, order: OrderDto) => (
        <StatusBadge status={orderStatusToBadgeStatus(order.status)}>
          {t(`orders.status.${order.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'salePrice',
      header: t('orders.table.salePrice'),
      render: (_: any, order: OrderDto) => <S.PriceText variant="body">{formatCurrency(order.salePrice)}</S.PriceText>,
    },
    {
      key: 'purchasePrice',
      header: t('orders.table.purchasePrice'),
      render: (_: any, order: OrderDto) => <S.SecondaryText variant="body" muted>{formatCurrency(order.purchasePrice)}</S.SecondaryText>,
    },
    {
      key: 'netProfit',
      header: t('orders.table.netProfit'),
      render: (_: any, order: OrderDto) => (
        <S.PriceText variant="body" $profit={order.netProfit > 0} $loss={order.netProfit < 0}>
          {order.netProfit >= 0 ? '+' : ''}
          {formatCurrency(order.netProfit)}
        </S.PriceText>
      ),
    },
  ];

  const renderGridCard = (order: any) => (
    <S.GridCard key={order.id} onClick={() => onOrderClick(order)} hoverable>
      <S.GridCardHeader>
        <S.OrderNumber variant="mono" weight="medium" color="semantic.info">{order.orderNumber}</S.OrderNumber>
        <StatusBadge status={orderStatusToBadgeStatus(order.status)}>
          {t(`orders.status.${order.status}`)}
        </StatusBadge>
      </S.GridCardHeader>
      <S.GridCardContent>
        <S.BuyerInfo>
          <S.BuyerAvatar $color={getAvatarColor(order.buyerName)}>{getInitials(order.buyerName)}</S.BuyerAvatar>
          <S.BuyerDetails>
            <S.BuyerName variant="body" weight="medium">{order.buyerName}</S.BuyerName>
            <S.BuyerEmailText variant="body-xs" muted>{order.buyerEmail}</S.BuyerEmailText>
          </S.BuyerDetails>
        </S.BuyerInfo>
        <S.CardPriceRow>
          <S.SecondaryText variant="body" muted>{formatDate(order.createdAt)}</S.SecondaryText>
          <S.PriceText variant="body">{formatCurrency(order.salePrice)}</S.PriceText>
        </S.CardPriceRow>
      </S.GridCardContent>
      <S.GridCardFooter>
        <S.SecondaryText variant="body" muted>{t('orders.table.netProfit')}</S.SecondaryText>
        <S.PriceText variant="body" $profit={order.netProfit > 0} $loss={order.netProfit < 0}>
          {order.netProfit >= 0 ? '+' : ''}
          {formatCurrency(order.netProfit)}
        </S.PriceText>
      </S.GridCardFooter>
    </S.GridCard>
  );

  const pagination = {
    count: totalCount,
    page,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange,
    labelRowsPerPage: t('translation:common.rowsPerPage'),
    labelInfo: t('translation:common.showing_info'),
  };

  return (
    <S.PageContainer>
      <PageHeader
        title={t('orders.title')}
        subtitle={t('orders.subtitle', { count: orders.length })}
        actions={
          <S.ActionsWrapper>
            <S.SearchBoxWrapper>
              <ModernTextInput
                name="search"
                placeholder={t('orders.actions.search')}
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
                iconLeft="search"
                fullWidth
              />
            </S.SearchBoxWrapper>
          </S.ActionsWrapper>
        }
      />

      {/* Stats Cards */}
      <S.StatsGrid>
        <S.StatCard variant="bordered">
          <S.StatHeader>
            <S.StatLabel variant="body-sm" weight="medium" color="text.secondary">{t('orders.stats.totalSales')}</S.StatLabel>
            <S.StatIconWrapper $color={theme.colors.semanticTint.info}>
              <Icon name="payments" size={20} color={theme.colors.semantic.info} />
            </S.StatIconWrapper>
          </S.StatHeader>
          <S.StatValue>{formatCurrency(stats?.totalSales || 0)}</S.StatValue>
          <S.StatChange $positive>
            <Icon name="trending-up" size={14} />
            {t('orders.stats.growth', { value: stats?.salesGrowth || 0 })}
          </S.StatChange>
        </S.StatCard>

        <S.StatCard variant="bordered">
          <S.StatHeader>
            <S.StatLabel variant="body-sm" weight="medium" color="text.secondary">{t('orders.stats.netProfit')}</S.StatLabel>
            <S.StatIconWrapper $color={theme.colors.semanticTint.success}>
              <Icon name="account-balance-wallet" size={20} color={theme.colors.semantic.success} />
            </S.StatIconWrapper>
          </S.StatHeader>
          <S.StatValue>{formatCurrency(stats?.totalProfit || 0)}</S.StatValue>
          <S.StatChange $positive>
            <Icon name="trending-up" size={14} />
            {t('orders.stats.profitGrowth', { value: stats?.profitGrowth || 0 })}
          </S.StatChange>
        </S.StatCard>

        <S.StatCard variant="bordered">
          <S.StatHeader>
            <S.StatLabel variant="body-sm" weight="medium" color="text.secondary">{t('orders.stats.activeOrders')}</S.StatLabel>
            <S.StatIconWrapper $color={theme.colors.semanticTint.warning}>
              <Icon name="local-shipping" size={20} color={theme.colors.semantic.warning} />
            </S.StatIconWrapper>
          </S.StatHeader>
          <S.StatValue>{stats?.activeOrders || 0}</S.StatValue>
          <S.StatSubText variant="body-xs" muted>{t('orders.stats.last24Hours')}</S.StatSubText>
        </S.StatCard>

        <S.StatCard variant="bordered">
          <S.StatHeader>
            <S.StatLabel variant="body-sm" weight="medium" color="text.secondary">{t('orders.stats.returnRate')}</S.StatLabel>
            <S.StatIconWrapper $color={theme.colors.semanticTint.error}>
              <Icon name="assignment-return" size={20} color={theme.colors.semantic.error} />
            </S.StatIconWrapper>
          </S.StatHeader>
          <S.StatValue>%{stats?.returnRate || 0}</S.StatValue>
          <S.StatChange>
            <Icon name="trending-down" size={14} />
            {t('orders.stats.decrease', { value: 0.3 })}
          </S.StatChange>
        </S.StatCard>
      </S.StatsGrid>

      <DataTable
        columns={columns}
        data={orders}
        renderGridCard={renderGridCard}
        onRowClick={onOrderClick}
        onDownload={onDownload}
        pagination={pagination}
      />
    </S.PageContainer>
  );
};
