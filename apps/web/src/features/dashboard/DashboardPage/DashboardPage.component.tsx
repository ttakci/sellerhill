/**
 * DashboardPage Component (Presentation)
 * Uses @repo/ui design system components: Card, Icon, Text, StatusBadge
 * i18n with 'dashboard' namespace
 */

import type { OrderDto } from '@repo/shared';
import { Icon, PageHeader, StatusBadge, Text, useTheme } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import * as S from './DashboardPage.style';
import type { DashboardPageComponentProps } from './DashboardPage.types';

export const DashboardPageComponent = ({
  user,
  dashboardData,
  isLoading,
  onConnectEbay,
  onViewAllOrders,
  isTR,
  formatCurrency,
  formatCompactCurrency,
  formatDate,
}: DashboardPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard', 'translation']);
  const { theme } = useTheme();

  // Chart colors from theme
  const revenueColor = theme.colors.brand.primary;
  const profitColor = theme.colors.semantic.success;

  if (isLoading) {
    return (
      <S.Container>
        <S.EmptyState>
          <S.EmptyStateText variant="body" color="text.secondary">{t('translation:common.loading')}</S.EmptyStateText>
        </S.EmptyState>
      </S.Container>
    );
  }

  const metrics = dashboardData?.metrics;
  const trend = dashboardData?.revenueTrend || [];
  const recentOrders = dashboardData?.recentOrders || [];

  const hasNoData = !metrics || (metrics.totalOrders === 0 && metrics.activeListings === 0);

  return (
    <S.Container>
      <PageHeader
        title={t('dashboard:title')}
        subtitle={user ? t('dashboard:greeting', { name: user.firstName }) : t('dashboard:subtitle')}
      />

      {hasNoData ? (
        <S.EmptyStateCard variant="bordered">
          <S.EmptyStateIconWrapper>
            <Icon name="rocket-launch" size={40} color={theme.colors.brand.primary} />
          </S.EmptyStateIconWrapper>
          <Text variant="h3" weight="semibold">{t('dashboard:comingSoon')}</Text>
          <S.EmptyStateDesc variant="body" color="text.secondary">
            {t('dashboard:description')}
          </S.EmptyStateDesc>
          <S.ButtonContainer>
            <S.ConnectButton onClick={onConnectEbay}>
              <Icon name="link" size={16} color={theme.colors.surface.primary} />
              {t('dashboard:connectEbay')}
            </S.ConnectButton>
          </S.ButtonContainer>
        </S.EmptyStateCard>
      ) : (
        <>
          {/* Stats Cards */}
          <S.StatsGrid>
            <S.StatCard variant="bordered">
              <S.StatHeader>
                <S.StatLabel variant="body-sm" weight="medium" color="text.secondary">{t('dashboard:todayOrders')}</S.StatLabel>
                <S.StatIconWrapper $color={theme.colors.semanticTint.info}>
                  <Icon name="shopping-cart" size={20} color={theme.colors.semantic.info} />
                </S.StatIconWrapper>
              </S.StatHeader>
              <S.StatValue>{metrics.todayOrders}</S.StatValue>
              <S.StatSubText variant="body-xs" color="text.tertiary">{t('dashboard:todayRevenue', { amount: formatCurrency(metrics.todayRevenue) })}</S.StatSubText>
            </S.StatCard>

            <S.StatCard variant="bordered">
              <S.StatHeader>
                <S.StatLabel variant="body-sm" weight="medium" color="text.secondary">{t('dashboard:totalRevenue')}</S.StatLabel>
                <S.StatIconWrapper $color={theme.colors.semanticTint.success}>
                  <Icon name="payments" size={20} color={theme.colors.semantic.success} />
                </S.StatIconWrapper>
              </S.StatHeader>
              <S.StatValue>{formatCurrency(metrics.totalRevenue)}</S.StatValue>
              <S.StatSubText variant="body-xs" color="text.tertiary">{t('dashboard:totalOrdersCount', { count: metrics.totalOrders })}</S.StatSubText>
            </S.StatCard>

            <S.StatCard variant="bordered">
              <S.StatHeader>
                <S.StatLabel variant="body-sm" weight="medium" color="text.secondary">{t('dashboard:totalProfit')}</S.StatLabel>
                <S.StatIconWrapper $color={theme.colors.brand.secondary}>
                  <Icon name="account-balance-wallet" size={20} color={theme.colors.brand.primary} />
                </S.StatIconWrapper>
              </S.StatHeader>
              <S.StatValue>{formatCurrency(metrics.totalProfit)}</S.StatValue>
              <S.StatSubText variant="body-xs" color="text.tertiary">{t('dashboard:netProfitLabel')}</S.StatSubText>
            </S.StatCard>

            <S.StatCard variant="bordered">
              <S.StatHeader>
                <S.StatLabel variant="body-sm" weight="medium" color="text.secondary">{t('dashboard:activeListings')}</S.StatLabel>
                <S.StatIconWrapper $color={theme.colors.semanticTint.warning}>
                  <Icon name="storefront" size={20} color={theme.colors.semantic.warning} />
                </S.StatIconWrapper>
              </S.StatHeader>
              <S.StatValue>{metrics.activeListings}</S.StatValue>
              <S.StatSubText variant="body-xs" color="text.tertiary">{t('dashboard:onEbay')}</S.StatSubText>
            </S.StatCard>
          </S.StatsGrid>

          {/* Revenue Chart */}
          <S.ChartCard variant="bordered">
            <S.ChartHeader>
              <S.ChartTitle variant="h4" weight="semibold">{t('dashboard:revenueTrend')}</S.ChartTitle>
              <S.ChartLegend>
                <S.LegendItem>
                  <S.LegendDot $color={revenueColor} />
                  <S.LegendLabel variant="caption" color="text.secondary">{t('dashboard:revenue')}</S.LegendLabel>
                </S.LegendItem>
                <S.LegendItem>
                  <S.LegendDot $color={profitColor} />
                  <S.LegendLabel variant="caption" color="text.secondary">{t('dashboard:profit')}</S.LegendLabel>
                </S.LegendItem>
              </S.ChartLegend>
            </S.ChartHeader>
            <S.ChartContainer>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={revenueColor} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={revenueColor} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={profitColor} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={profitColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border.secondary} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => formatDate(v)}
                    tick={{ fontSize: 11, fill: theme.colors.text.tertiary }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: theme.colors.text.tertiary }}
                    tickFormatter={(v: number) => formatCompactCurrency(v)}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      background: theme.colors.surface.primary,
                      border: `1px solid ${theme.colors.border.primary}`,
                      borderRadius: theme.radius?.md || '8px',
                      boxShadow: theme.shadows?.md || '0 4px 12px rgba(0,0,0,0.1)',
                      fontSize: '13px',
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      formatCurrency(Number(value ?? 0)),
                      name === 'revenue' ? t('dashboard:revenue') : t('dashboard:profit'),
                    ]}
                    labelFormatter={(label: unknown) =>
                      new Date(String(label)).toLocaleDateString(isTR ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    }
                  />
                  <Area type="monotone" dataKey="revenue" stroke={revenueColor} strokeWidth={2} fill="url(#revenueGrad)" />
                  <Area type="monotone" dataKey="profit" stroke={profitColor} strokeWidth={2} fill="url(#profitGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </S.ChartContainer>
          </S.ChartCard>

          {/* Recent Orders */}
          {recentOrders.length > 0 && (
            <S.RecentOrdersCard variant="bordered">
              <S.RecentOrdersHeader>
                <S.RecentOrdersTitle variant="h4" weight="semibold">{t('dashboard:recentOrders')}</S.RecentOrdersTitle>
                <S.ViewAllButton onClick={onViewAllOrders}>{t('dashboard:viewAllOrders')}</S.ViewAllButton>
              </S.RecentOrdersHeader>
              <S.OrderList>
                {recentOrders.map((order: OrderDto) => (
                  <S.OrderRow key={order.id}>
                    <S.OrderLeft>
                      <S.OrderImage $imageUrl={order.product?.imageUrl} />
                      <S.OrderInfo>
                        <S.OrderTitle variant="body" weight="medium">
                          {order.product?.title || t('dashboard:unknownProduct')}
                        </S.OrderTitle>
                        <S.OrderMeta>
                          <Text variant="caption" color="text.tertiary">{formatDate(order.createdAt)}</Text>
                          {!order.isTracked && <S.UntrackedBadge>{t('dashboard:untracked')}</S.UntrackedBadge>}
                          {order.isTracked && order.product?.asin && (
                            <Text variant="caption" color="text.tertiary">{t('dashboard:asin', { asin: order.product.asin })}</Text>
                          )}
                        </S.OrderMeta>
                      </S.OrderInfo>
                    </S.OrderLeft>
                    <S.OrderRight>
                      <Text variant="body" weight="semibold">{formatCurrency(order.saleTotal)}</Text>
                      <Text
                        variant="body-sm"
                        weight="medium"
                        color={order.netProfit >= 0 ? 'semantic.success' : 'semantic.error'}
                      >
                        {order.netProfit >= 0 ? '+' : ''}{formatCurrency(order.netProfit)}
                      </Text>
                      <StatusBadge status={(['shipped', 'completed'].includes(order.status) ? order.status : 'processing') as 'shipped' | 'completed' | 'processing'} size="sm" />
                    </S.OrderRight>
                  </S.OrderRow>
                ))}
              </S.OrderList>
            </S.RecentOrdersCard>
          )}
        </>
      )}
    </S.Container>
  );
};
