import { OrderDto, OrderStatsDto } from '@repo/shared';
import { Button, Icon, Input, TablePagination as Pagination } from '@repo/ui';
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
}

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
}) => {
  const { t, i18n } = useTranslation(['orders', 'translation']);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'rgba(99, 102, 241, 0.1)', // indigo
      'rgba(245, 158, 11, 0.1)', // amber
      'rgba(16, 185, 129, 0.1)', // emerald
      'rgba(239, 68, 68, 0.1)', // rose
      'rgba(148, 163, 184, 0.1)', // slate
    ];
    const index = name.charCodeAt(0) % colors.length;
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
      header: t('table.orderNumber'),
      render: (_: any, order: OrderDto) => <S.OrderNumber>{order.orderNumber}</S.OrderNumber>,
    },
    {
      key: 'createdAt',
      header: t('table.date'),
      render: (_: any, order: OrderDto) => <S.SecondaryText>{formatDate(order.createdAt)}</S.SecondaryText>,
    },
    {
      key: 'buyer',
      header: t('table.buyer'),
      render: (_: any, order: OrderDto) => (
        <S.BuyerInfo>
          <S.BuyerAvatar $color={getAvatarColor(order.buyerName)}>{getInitials(order.buyerName)}</S.BuyerAvatar>
          <S.BuyerName>{order.buyerName}</S.BuyerName>
        </S.BuyerInfo>
      ),
    },
    {
      key: 'status',
      header: t('table.status'),
      render: (_: any, order: OrderDto) => (
        <S.StatusBadge $status={order.status}>{t(`status.${order.status}`)}</S.StatusBadge>
      ),
    },
    {
      key: 'salePrice',
      header: t('table.salePrice'),
      render: (_: any, order: OrderDto) => <S.PriceText>{formatCurrency(order.salePrice)}</S.PriceText>,
    },
    {
      key: 'purchasePrice',
      header: t('table.purchasePrice'),
      render: (_: any, order: OrderDto) => <S.SecondaryText>{formatCurrency(order.purchasePrice)}</S.SecondaryText>,
    },
    {
      key: 'netProfit',
      header: t('table.netProfit'),
      render: (_: any, order: OrderDto) => (
        <S.PriceText $profit={order.netProfit > 0} $loss={order.netProfit < 0}>
          {order.netProfit >= 0 ? '+' : ''}
          {formatCurrency(order.netProfit)}
        </S.PriceText>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: () => (
        <Button variant="secondary" size="sm">
          <Icon name="more-horiz" size={20} />
        </Button>
      ),
    },
  ];

  return (
    <S.PageContainer>
      {/* Stats Cards */}
      <S.StatsGrid>
        <S.StatCard>
          <S.StatHeader>
            <S.StatLabel>{t('stats.totalSales')}</S.StatLabel>
            <S.StatIconWrapper $color="rgba(99, 102, 241, 0.1)">
              <Icon name="payments" size={20} color="#6366f1" />
            </S.StatIconWrapper>
          </S.StatHeader>
          <S.StatValue>{formatCurrency(stats?.totalSales || 0)}</S.StatValue>
          <S.StatChange $positive>
            <Icon name="trending-up" size={14} />
            {t('stats.growth', { value: stats?.salesGrowth || 0 })}
          </S.StatChange>
        </S.StatCard>

        <S.StatCard>
          <S.StatHeader>
            <S.StatLabel>{t('stats.netProfit')}</S.StatLabel>
            <S.StatIconWrapper $color="rgba(16, 185, 129, 0.1)">
              <Icon name="account-balance-wallet" size={20} color="#10b981" />
            </S.StatIconWrapper>
          </S.StatHeader>
          <S.StatValue>{formatCurrency(stats?.netProfit || 0)}</S.StatValue>
          <S.StatChange $positive>
            <Icon name="trending-up" size={14} />
            {t('stats.profitGrowth', { value: stats?.profitGrowth || 0 })}
          </S.StatChange>
        </S.StatCard>

        <S.StatCard>
          <S.StatHeader>
            <S.StatLabel>{t('stats.activeOrders')}</S.StatLabel>
            <S.StatIconWrapper $color="rgba(245, 158, 11, 0.1)">
              <Icon name="local-shipping" size={20} color="#f59e0b" />
            </S.StatIconWrapper>
          </S.StatHeader>
          <S.StatValue>{stats?.activeOrders || 0}</S.StatValue>
          <S.SecondaryText style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {t('stats.last24Hours')}
          </S.SecondaryText>
        </S.StatCard>

        <S.StatCard>
          <S.StatHeader>
            <S.StatLabel>{t('stats.returnRate')}</S.StatLabel>
            <S.StatIconWrapper $color="rgba(239, 68, 68, 0.1)">
              <Icon name="assignment-return" size={20} color="#ef4444" />
            </S.StatIconWrapper>
          </S.StatHeader>
          <S.StatValue>%{stats?.returnRate || 0}</S.StatValue>
          <S.StatChange>
            <Icon name="trending-down" size={14} />
            {t('stats.decrease', { value: 0.3 })}
          </S.StatChange>
        </S.StatCard>
      </S.StatsGrid>

      {/* Filters and Actions */}
      <S.FiltersRow>
        <S.SearchWrapper>
          <Input
            placeholder={t('actions.search')}
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
            leftIcon={<Icon name="search" size={20} />}
            fullWidth
          />
          <Button variant="secondary">
            <Icon name="calendar-today" size={18} />
            {t('actions.last30Days')}
            <Icon name="expand-more" size={18} />
          </Button>
        </S.SearchWrapper>

        <S.ActionsWrapper>
          <Button variant="secondary" size="md">
            <Icon name="filter-list" size={20} />
          </Button>
          <Button variant="secondary">
            <Icon name="file-download" size={20} />
            {t('actions.export')}
          </Button>
        </S.ActionsWrapper>
      </S.FiltersRow>

      {/* Orders Table */}
      <S.TableContainer>
        <S.TableWrapper>
          <S.Table>
            <S.TableHead>
              <tr>
                {columns.map((col) => (
                  <S.TableHeaderCell key={col.key} style={{ textAlign: col.align || 'left' }}>
                    {col.header}
                  </S.TableHeaderCell>
                ))}
              </tr>
            </S.TableHead>
            <S.TableBody>
              {orders.map((order) => (
                <S.TableRow key={order.id} onClick={() => onOrderClick(order)}>
                  {columns.map((col) => (
                    <S.TableCell key={col.key} style={{ textAlign: col.align || 'left' }}>
                      {col.render(order[col.key as keyof OrderDto], order)}
                    </S.TableCell>
                  ))}
                </S.TableRow>
              ))}
            </S.TableBody>
          </S.Table>
        </S.TableWrapper>

        {/* Pagination */}
        <div
          style={{
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            borderTop: '0.0625rem solid rgba(148, 163, 184, 0.1)',
            background: 'rgba(248, 250, 252, 0.5)',
          }}
        >
          <Pagination
            count={orders.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={onPageChange}
            onRowsPerPageChange={onRowsPerPageChange}
            labelRowsPerPage={t('translation:common.rowsPerPage')}
            labelInfo={t('translation:common.showing_info')}
          />
        </div>
      </S.TableContainer>
    </S.PageContainer>
  );
};
