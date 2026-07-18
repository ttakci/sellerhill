/**
 * DashboardPage Component (Presentation)
 * Tabs: Cards | Chart | History
 */

import type { DashboardPeriodKey, PeriodMetricsDto } from '@repo/shared';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Dropdown,
  Icon,
  PageHeader,
  Text,
  Tooltip as UITooltip,
  useTheme,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import * as S from './DashboardPage.style';
import type {
  DashboardPageComponentProps,
  DashboardTabId,
  PeriodCardViewProps,
} from './DashboardPage.types';

import { ListingCarousel } from '@/features/listings/carousel';
import { OrderCarousel } from '@/features/orders/carousel';

const EMPTY_PERIOD: PeriodMetricsDto = {
  sales: 0,
  orders: 0,
  units: 0,
  refunds: 0,
  grossProfit: 0,
  netProfit: 0,
  estimatedPayout: 0,
  margin: 0,
  avgOrderValue: 0,
  trend: null,
  profitTrend: null,
  profitConfirmed: 0,
  profitProvisional: 0,
  revenueUncosted: 0,
  ordersPendingCapture: 0,
  ordersCaptureFailed: 0,
  ordersUntracked: 0,
};

const PERIOD_KEYS: DashboardPeriodKey[] = ['today', 'thisWeek', 'thisMonth', 'thisYear'];

const HISTORY_ROWS: {
  key: string;
  i18n: string;
  format: 'currency' | 'number' | 'percent';
  field: keyof import('@repo/shared').DashboardHistoryMonth;
}[] = [
  { key: 'sales', i18n: 'dashboard.history.sales', format: 'currency', field: 'sales' },
  { key: 'units', i18n: 'dashboard.history.units', format: 'number', field: 'units' },
  { key: 'orders', i18n: 'dashboard.history.orders', format: 'number', field: 'orders' },
  { key: 'refunds', i18n: 'dashboard.history.refunds', format: 'number', field: 'refunds' },
  { key: 'adFee', i18n: 'dashboard.history.adFee', format: 'currency', field: 'adFee' },
  { key: 'amazonShipping', i18n: 'dashboard.history.amazonShipping', format: 'currency', field: 'amazonShipping' },
  { key: 'purchasePrice', i18n: 'dashboard.history.purchasePrice', format: 'currency', field: 'purchasePrice' },
  { key: 'transactionFee', i18n: 'dashboard.history.transactionFee', format: 'currency', field: 'transactionFee' },
  { key: 'grossProfit', i18n: 'dashboard.history.grossProfit', format: 'currency', field: 'grossProfit' },
  { key: 'netProfit', i18n: 'dashboard.history.netProfit', format: 'currency', field: 'netProfit' },
  { key: 'estimatedPayout', i18n: 'dashboard.history.estimatedPayout', format: 'currency', field: 'estimatedPayout' },
  { key: 'margin', i18n: 'dashboard.history.margin', format: 'percent', field: 'margin' },
];

/* ─── Period Card ─── */

const PeriodCardComponent = ({
  title,
  dateRange,
  metrics,
  headerBg,
  isActive,
  onClick,
  formatCurrency,
  formatTrend,
  labels,
}: PeriodCardViewProps): React.ReactElement => {
  const salesTrend = formatTrend(metrics.trend);
  const profitTrend = formatTrend(metrics.profitTrend);
  const profitPositive = metrics.netProfit >= 0;
  const salesTrendPositive = (metrics.trend ?? 0) >= 0;
  const profitTrendPositive = (metrics.profitTrend ?? 0) >= 0;

  return (
    <S.PeriodCard variant="bordered" $active={isActive} onClick={onClick}>
      <S.PeriodCardHeader $bgColor={headerBg}>
        <Text variant="body" weight="semibold" color="text.inverse">
          {title}
        </Text>
        <Text variant="caption" color="text.inverse">
          {dateRange}
        </Text>
      </S.PeriodCardHeader>
      <S.PeriodCardBody>
        <S.HeroBlock>
          <S.HeroLabelRow>
            <Text variant="caption" color="text.secondary">
              {labels.sales}
            </Text>
            {salesTrend !== undefined && (
              <Badge size="xs" variant={salesTrendPositive ? 'success' : 'error'}>
                {salesTrend}
              </Badge>
            )}
          </S.HeroLabelRow>
          <Text variant="h3" weight="semibold">
            {formatCurrency(metrics.sales)}
          </Text>
        </S.HeroBlock>

        <S.MetricPair>
          <S.MetricCell>
            <Text variant="caption" color="text.secondary">
              {labels.ordersUnits}
            </Text>
            <S.MetricCellValue>
              <Text variant="body-sm" weight="semibold">
                {metrics.orders} / {metrics.units}
              </Text>
            </S.MetricCellValue>
          </S.MetricCell>
          <S.MetricCell>
            <Text variant="caption" color="text.secondary">
              {labels.refunds}
            </Text>
            <S.MetricCellValue>
              <Text variant="body-sm" weight="semibold" color="brand.primary">
                {metrics.refunds}
              </Text>
            </S.MetricCellValue>
          </S.MetricCell>
        </S.MetricPair>

        <S.MetricPair>
          <S.MetricCell>
            <Text variant="caption" color="text.secondary">
              {labels.grossProfit}
            </Text>
            <S.MetricCellValue>
              <Text variant="body-sm" weight="semibold">
                {formatCurrency(metrics.grossProfit)}
              </Text>
            </S.MetricCellValue>
          </S.MetricCell>
          <S.MetricCell>
            <Text variant="caption" color="text.secondary">
              {labels.netProfit}
            </Text>
            <S.MetricCellValue>
              <Text
                variant="body-sm"
                weight="semibold"
                color={profitPositive ? 'semantic.success' : 'semantic.error'}
              >
                {formatCurrency(metrics.netProfit)}
              </Text>
              {profitTrend !== undefined && (
                <Badge size="xs" variant={profitTrendPositive ? 'success' : 'error'}>
                  {profitTrend}
                </Badge>
              )}
            </S.MetricCellValue>
          </S.MetricCell>
        </S.MetricPair>

        <S.FullMetricRow>
          <Text variant="caption" color="text.secondary">
            {labels.estimatedPayout}
          </Text>
          <Text variant="body-sm" weight="semibold">
            {formatCurrency(metrics.estimatedPayout)}
          </Text>
        </S.FullMetricRow>

        {metrics.profitProvisional !== 0 && (
          <S.FullMetricRow>
            <S.ProvisionalLabelRow>
              <Text variant="caption" color="text.secondary">
                {labels.provisionalEstimatedLabel}
              </Text>
              <UITooltip content={labels.provisionalEstimatedTooltip} position="top" variant="dark">
                <Icon name="info" size={14} color="text.tertiary" />
              </UITooltip>
            </S.ProvisionalLabelRow>
            <Text variant="body-sm" weight="semibold" color="semantic.warning">
              {formatCurrency(metrics.profitProvisional)}
            </Text>
          </S.FullMetricRow>
        )}
      </S.PeriodCardBody>
    </S.PeriodCard>
  );
};

/* ─── Main ─── */

export const DashboardPageComponent = ({
  user,
  dashboardData,
  isLoading,
  activeTab,
  onTabChange,
  selectedPeriod,
  onPeriodSelect,
  periodDates,
  listings,
  listingsTotal,
  orders,
  ordersTotal,
  onListingOpen,
  onListingsViewAll,
  onOrderOpen,
  onOrdersViewAll,
  ebayAccounts,
  selectedStoreId,
  onStoreSelect,
  isTR,
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  formatTrend,
  cardHeaderColors,
  labels,
  periodTitles,
  listingsViewAllLabel,
  ordersViewAllLabel,
  listingsEmptyTitle,
  listingsEmptySubtitle,
  ordersEmptyTitle,
  ordersEmptySubtitle,
  tabLabels,
}: DashboardPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard', 'translation']);
  const { theme } = useTheme();

  const metrics = dashboardData?.metrics;
  const chartPoints = dashboardData?.chart?.points ?? [];
  const chartSummary = dashboardData?.chart?.summary ?? EMPTY_PERIOD;
  const historyMonths = dashboardData?.history?.months ?? [];

  const unitsColor = theme.colors.brand.primary;
  const profitColor = theme.colors.semantic.success;
  const salesColor = theme.colors.semantic.info;

  const formatHistoryCell = (
    value: number,
    format: 'currency' | 'number' | 'percent',
  ): string => {
    if (format === 'currency') {
      return formatCurrency(value);
    }
    if (format === 'percent') {
      return `${value}%`;
    }
    return String(value);
  };

  const monthColumnLabel = (key: string, dateFrom: string): string => {
    if (key === 'current') {
      return t('dashboard.history.currentPeriod');
    }
    try {
      const d = new Date(dateFrom);
      return d.toLocaleDateString(isTR ? 'tr-TR' : 'en-US', { month: 'short', year: 'numeric' });
    } catch {
      return key;
    }
  };

  const TAB_IDS: DashboardTabId[] = ['cards', 'chart', 'history'];

  const storeSelector =
    ebayAccounts.length > 0 ? (
      <Dropdown
        align="right"
        width="14rem"
        trigger={
          <S.StoreSelectorTrigger title={t('dashboard.selectStore')}>
            <Icon name="storefront" size={16} />
            <Text variant="body-sm" weight="medium">
              {selectedStoreId === 'all'
                ? t('dashboard.allStores')
                : ebayAccounts.find((a) => a.id === selectedStoreId)?.storeName ||
                  ebayAccounts.find((a) => a.id === selectedStoreId)?.sellerId ||
                  t('dashboard.allStores')}
            </Text>
            <Icon name="chevron-down" size={14} color="text.tertiary" />
          </S.StoreSelectorTrigger>
        }
        items={[
          {
            label: t('dashboard.allStores'),
            icon: selectedStoreId === 'all' ? 'check' : undefined,
            onClick: () => onStoreSelect('all'),
          },
          ...ebayAccounts.map((acc) => ({
            label: acc.storeName || acc.sellerId,
            icon: selectedStoreId === acc.id ? ('check' as const) : undefined,
            onClick: () => onStoreSelect(acc.id),
          })),
        ]}
      />
    ) : null;

  const cardsContent = (
    <S.TabPanel>
      <S.PeriodCardsGrid>
        {PERIOD_KEYS.map((key) => (
          <PeriodCardComponent
            key={key}
            title={periodTitles[key]}
            dateRange={periodDates[key].dateRange}
            metrics={metrics?.[key] ?? EMPTY_PERIOD}
            headerBg={cardHeaderColors[key]}
            isActive={selectedPeriod === key}
            onClick={() => onPeriodSelect(key)}
            formatCurrency={formatCurrency}
            formatTrend={formatTrend}
            labels={labels}
          />
        ))}
      </S.PeriodCardsGrid>

      <S.CarouselRow>
        <S.CarouselSection>
          <S.CarouselSectionHeader>
            <Text variant="h4" weight="semibold">
              {t('dashboard.listingsSection')}
            </Text>
            <Text variant="caption" color="text.tertiary">
              {t('dashboard.listingsCount', { count: listingsTotal })}
            </Text>
          </S.CarouselSectionHeader>
          <ListingCarousel
            listings={listings}
            onViewAll={onListingsViewAll}
            viewAllLabel={listingsViewAllLabel}
            showViewAll={listings.length > 0}
            onListingClick={onListingOpen}
            emptyTitle={listingsEmptyTitle}
            emptySubtitle={listingsEmptySubtitle}
          />
        </S.CarouselSection>

        <S.CarouselSection>
          <S.CarouselSectionHeader>
            <Text variant="h4" weight="semibold">
              {t('dashboard.ordersSection')}
            </Text>
            <Text variant="caption" color="text.tertiary">
              {t('dashboard.ordersCount', { count: ordersTotal })}
            </Text>
          </S.CarouselSectionHeader>
          <OrderCarousel
            orders={orders}
            onViewAll={onOrdersViewAll}
            viewAllLabel={ordersViewAllLabel}
            showViewAll={orders.length > 0}
            onOrderClick={onOrderOpen}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            emptyTitle={ordersEmptyTitle}
            emptySubtitle={ordersEmptySubtitle}
          />
        </S.CarouselSection>
      </S.CarouselRow>
    </S.TabPanel>
  );

  const chartContent = (
    <S.TabPanel>
      <Card variant="bordered">
        <CardHeader
          actions={
            <S.ChartLegend>
              <S.LegendItem>
                <S.LegendDot $color={unitsColor} />
                <Text variant="caption" color="text.secondary">
                  {t('dashboard.chart.units')}
                </Text>
              </S.LegendItem>
              <S.LegendItem>
                <S.LegendDot $color={salesColor} />
                <Text variant="caption" color="text.secondary">
                  {t('dashboard.chart.sales')}
                </Text>
              </S.LegendItem>
              <S.LegendItem>
                <S.LegendDot $color={profitColor} />
                <Text variant="caption" color="text.secondary">
                  {t('dashboard.chart.netProfit')}
                </Text>
              </S.LegendItem>
            </S.ChartLegend>
          }
        >
          {t('dashboard.chart.title')}
        </CardHeader>
        <CardBody>
          <S.ChartLayout>
            <S.ChartMain>
              {chartPoints.length === 0 && !isLoading ? (
                <S.EmptyState>
                  <Text variant="body-sm" color="text.tertiary">
                    {t('dashboard.noData')}
                  </Text>
                </S.EmptyState>
              ) : (
                <S.ChartContainer>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartPoints} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.colors.border.secondary}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="period"
                        tickFormatter={(v: string) => {
                          try {
                            return new Date(v).toLocaleDateString(isTR ? 'tr-TR' : 'en-US', {
                              month: 'short',
                            });
                          } catch {
                            return v;
                          }
                        }}
                        tick={{
                          fontSize: theme.typography.fontSize.xs,
                          fill: theme.colors.text.tertiary,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="currency"
                        tick={{
                          fontSize: theme.typography.fontSize.xs,
                          fill: theme.colors.text.tertiary,
                        }}
                        tickFormatter={(v: number) => formatCompactCurrency(v)}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <YAxis
                        yAxisId="units"
                        orientation="right"
                        tick={{
                          fontSize: theme.typography.fontSize.xs,
                          fill: theme.colors.text.tertiary,
                        }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={{
                          background: theme.colors.surface.primary,
                          border: `1px solid ${theme.colors.border.primary}`,
                          borderRadius: theme.radius.sm,
                          boxShadow: theme.shadows.md,
                          fontSize: theme.typography.fontSize.sm,
                        }}
                        formatter={(value: unknown, name: unknown) => {
                          const n = Number(value ?? 0);
                          const key = String(name);
                          if (key === 'units' || key === 'refunds') {
                            return [n, t(`dashboard.chart.${key}` as 'dashboard.chart.units')];
                          }
                          return [
                            formatCurrency(n),
                            key === 'sales'
                              ? t('dashboard.chart.sales')
                              : t('dashboard.chart.netProfit'),
                          ];
                        }}
                        labelFormatter={(label: unknown) =>
                          new Date(String(label)).toLocaleDateString(isTR ? 'tr-TR' : 'en-US', {
                            month: 'long',
                            year: 'numeric',
                          })
                        }
                      />
                      <Legend />
                      <Bar
                        yAxisId="units"
                        dataKey="units"
                        name="units"
                        fill={unitsColor}
                        opacity={0.55}
                        radius={[2, 2, 0, 0]}
                      />
                      <Line
                        yAxisId="currency"
                        type="monotone"
                        dataKey="sales"
                        name="sales"
                        stroke={salesColor}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        yAxisId="currency"
                        type="monotone"
                        dataKey="netProfit"
                        name="netProfit"
                        stroke={profitColor}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </S.ChartContainer>
              )}
            </S.ChartMain>

            <S.ChartSummary>
              <S.ChartSummaryRow>
                <Text variant="caption" color="text.secondary">
                  {t('dashboard.chart.summary')}
                </Text>
              </S.ChartSummaryRow>
              <S.ChartSummaryRow>
                <Text variant="body-sm" color="text.secondary">
                  {t('dashboard.chart.sales')}
                </Text>
                <Text variant="body-sm" weight="semibold">
                  {formatCurrency(chartSummary.sales)}
                </Text>
              </S.ChartSummaryRow>
              <S.ChartSummaryRow>
                <Text variant="body-sm" color="text.secondary">
                  {t('dashboard.chart.units')}
                </Text>
                <Text variant="body-sm" weight="semibold">
                  {chartSummary.units}
                </Text>
              </S.ChartSummaryRow>
              <S.ChartSummaryRow>
                <Text variant="body-sm" color="text.secondary">
                  {t('dashboard.chart.refunds')}
                </Text>
                <Text variant="body-sm" weight="semibold">
                  {chartSummary.refunds}
                </Text>
              </S.ChartSummaryRow>
              <S.ChartSummaryRow>
                <Text variant="body-sm" color="text.secondary">
                  {t('dashboard.chart.netProfit')}
                </Text>
                <Text
                  variant="body-sm"
                  weight="semibold"
                  color={chartSummary.netProfit >= 0 ? 'semantic.success' : 'semantic.error'}
                >
                  {formatCurrency(chartSummary.netProfit)}
                </Text>
              </S.ChartSummaryRow>
              <S.ChartSummaryRow>
                <Text variant="body-sm" color="text.secondary">
                  {t('dashboard.margin')}
                </Text>
                <Text variant="body-sm" weight="semibold">
                  {chartSummary.margin}%
                </Text>
              </S.ChartSummaryRow>
            </S.ChartSummary>
          </S.ChartLayout>
        </CardBody>
      </Card>
    </S.TabPanel>
  );

  const historyContent = (
    <S.TabPanel>
      {historyMonths.length === 0 && !isLoading ? (
        <S.EmptyState>
          <Text variant="body-sm" color="text.tertiary">
            {t('dashboard.noData')}
          </Text>
        </S.EmptyState>
      ) : (
        <S.HistoryScroll>
          <S.HistoryTable>
            <thead>
              <tr>
                <S.HistoryTh>
                  <Text variant="body-sm" weight="semibold">
                    {t('dashboard.history.parameter')}
                  </Text>
                </S.HistoryTh>
                {historyMonths.map((col) => (
                  <S.HistoryTh key={col.key + col.dateFrom}>
                    <Text variant="body-sm" weight="semibold">
                      {monthColumnLabel(col.key, col.dateFrom)}
                    </Text>
                  </S.HistoryTh>
                ))}
              </tr>
            </thead>
            <tbody>
              {HISTORY_ROWS.map((row) => (
                <S.HistoryTr key={row.key}>
                  <S.HistoryTd>
                    <Text variant="body-sm" weight="medium">
                      {t(row.i18n)}
                    </Text>
                  </S.HistoryTd>
                  {historyMonths.map((col) => {
                    const raw = col[row.field];
                    const num = typeof raw === 'number' ? raw : 0;
                    return (
                      <S.HistoryTd key={`${row.key}-${col.key}-${col.dateFrom}`}>
                        <Text variant="body-sm">{formatHistoryCell(num, row.format)}</Text>
                      </S.HistoryTd>
                    );
                  })}
                </S.HistoryTr>
              ))}
            </tbody>
          </S.HistoryTable>
        </S.HistoryScroll>
      )}
    </S.TabPanel>
  );

  const activeContent =
    activeTab === 'chart' ? chartContent : activeTab === 'history' ? historyContent : cardsContent;

  return (
    <S.Container>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={user ? t('dashboard.greeting', { name: user.firstName }) : t('dashboard.subtitle')}
      />

      <S.TabsHeader>
        <S.TabList role="tablist">
          {TAB_IDS.map((id) => (
            <S.TabButton
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              $active={activeTab === id}
              onClick={() => onTabChange(id)}
            >
              {tabLabels[id]}
            </S.TabButton>
          ))}
        </S.TabList>
        {storeSelector}
      </S.TabsHeader>

      {activeContent}
    </S.Container>
  );
};
