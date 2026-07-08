/**
 * DashboardPage Component (Presentation)
 * Sellerboard layout: Toolbar (search + period) → Cards → Chart → Listings table
 */

import type { ListingDto, PeriodMetricsDto } from '@repo/shared';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Dropdown,
  Icon,
  PageHeader,
  SearchField,
  SegmentedControl,
  Text,
  useTheme,
} from '@repo/ui';
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
import type { DashboardPageComponentProps, PeriodKey } from './DashboardPage.types';

/* ─── Helpers ─── */

const fmtTrend = (trend: number | null | undefined): string | undefined => {
  if (trend === null || trend === undefined) { return undefined; }
  const abs = Math.abs(Math.round(trend * 10) / 10);
  return `${trend >= 0 ? '+' : '-'}${abs}%`;
};

const EMPTY_PERIOD: PeriodMetricsDto = { sales: 0, orders: 0, netProfit: 0, margin: 0, trend: null };
const PERIOD_KEYS: PeriodKey[] = ['today', 'yesterday', 'thisMonth', 'thisMonthForecast', 'lastMonth'];

/* ─── Period Card ─── */

interface PeriodCardProps {
  title: string;
  dateRange: string;
  metrics: PeriodMetricsDto;
  accentColor: string;
  headerBg: string;
  isActive: boolean;
  onClick: () => void;
  formatCurrency: (v: number) => string;
  labels: { sales: string; orders: string; netProfit: string; margin: string };
}

const PeriodCardComponent = ({
  title, dateRange, metrics, accentColor, headerBg, isActive, onClick, formatCurrency, labels,
}: PeriodCardProps): React.ReactElement => (
  <S.PeriodCard variant="bordered" $accentColor={accentColor} $active={isActive} onClick={onClick}>
    <S.PeriodCardHeader $bgColor={headerBg}>
      <S.PeriodTitle variant="body-sm" weight="semibold">{title}</S.PeriodTitle>
      <S.PeriodDate variant="caption" color="text.tertiary">{dateRange}</S.PeriodDate>
    </S.PeriodCardHeader>
    <S.PeriodCardBody>
      <S.HeroMetricLabel variant="caption" color="text.secondary">{labels.sales}</S.HeroMetricLabel>
      <S.HeroMetricValue>
        {formatCurrency(metrics.sales)}
        {metrics.trend !== null && metrics.trend !== undefined && (
          <S.TrendBadge $positive={metrics.trend >= 0}>{fmtTrend(metrics.trend)}</S.TrendBadge>
        )}
      </S.HeroMetricValue>
      <S.MetricRow>
        <S.MetricLabel variant="body-xs" color="text.secondary">{labels.orders}</S.MetricLabel>
        <S.MetricValue variant="body-xs">{metrics.orders}</S.MetricValue>
      </S.MetricRow>
      <S.MetricRow>
        <S.MetricLabel variant="body-xs" color="text.secondary">{labels.netProfit}</S.MetricLabel>
        <S.MetricValue variant="body-xs" color={metrics.netProfit >= 0 ? 'semantic.success' : 'semantic.error'}>
          {formatCurrency(metrics.netProfit)}
        </S.MetricValue>
      </S.MetricRow>
      <S.MetricRow>
        <S.MetricLabel variant="body-xs" color="text.secondary">{labels.margin}</S.MetricLabel>
        <S.MetricValue variant="body-xs">{metrics.margin}%</S.MetricValue>
      </S.MetricRow>
    </S.PeriodCardBody>
  </S.PeriodCard>
);

/* ─── Search Dropdown ─── */

interface SearchDropdownProps {
  listings: ListingDto[];
  onSelect: (id: string | null) => void;
  formatCurrency: (v: number) => string;
}

const SearchDropdown = ({ listings, onSelect, formatCurrency }: SearchDropdownProps): React.ReactElement => (
  <S.SearchDropdownPanel>
    <S.SearchDropdownHeader>
      <Text variant="body-xs" weight="medium" color="text.secondary">{listings.length} results</Text>
      <Button variant="text" onClick={() => onSelect(null)}><Text>Clear</Text></Button>
    </S.SearchDropdownHeader>
    {listings.slice(0, 10).map((l) => (
      <S.SearchDropdownRow key={l.id} onClick={() => onSelect(l.id)}>
        <S.ListingThumb $imageUrl={l.imageUrls?.[0]} />
        <S.SearchDropdownInfo>
          <S.SearchDropdownTitle variant="body-sm" weight="medium">{l.title}</S.SearchDropdownTitle>
          <Text variant="caption" color="text.tertiary">{l.asin}</Text>
        </S.SearchDropdownInfo>
        <Text variant="body-sm" weight="medium">{formatCurrency(l.price)}</Text>
      </S.SearchDropdownRow>
    ))}
  </S.SearchDropdownPanel>
);

/* ─── Main Component ─── */

export const DashboardPageComponent = ({
  user, dashboardData, selectedPeriod, onPeriodSelect,
  periodPreset, onPeriodPresetChange, selectedDays: _selectedDays, onDaysChange: _onDaysChange,
  periodDates, listings, searchQuery, onSearchChange,
  filteredListingId, onListingSelect,
  ebayAccounts, selectedStoreId, onStoreSelect,
  isTR, formatCurrency, formatCompactCurrency, formatDate,
  showSearch, onShowSearchChange,
  cardColors, cardHeaders, labels, periodTitles, periodPresetOptions,
}: DashboardPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard', 'translation']);
  const { theme } = useTheme();

  const metrics = dashboardData?.metrics;
  const trend = dashboardData?.revenueTrend || [];
  const revenueColor = theme.colors.brand.primary;
  const profitColor = theme.colors.semantic.success;

  return (
    <S.Container>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={user ? t('dashboard.greeting', { name: user.firstName }) : t('dashboard.subtitle')}
      />

      {/* Toolbar: Search + Period Preset */}
      <S.Toolbar>
        <S.SearchWrapper>
          <SearchField
            value={searchQuery}
            onChange={(e) => { onSearchChange(e.target.value); onShowSearchChange(true); }}
            placeholder={t('dashboard.searchPlaceholder')}
            onFocus={() => onShowSearchChange(true)}
            size="medium"
            variant="gray"
            fullWidth
          />
          {showSearch && searchQuery.trim() && (
            <SearchDropdown listings={listings} onSelect={(id) => { onListingSelect(id); onShowSearchChange(false); }} formatCurrency={formatCurrency} />
          )}
        </S.SearchWrapper>

        {filteredListingId && (
          <Button variant="text" onClick={() => onListingSelect(null)}>
            <Text>{t('dashboard.clearFilter')}</Text>
          </Button>
        )}

        <S.ToolbarRight>
          {ebayAccounts.length > 0 && (
            <Dropdown
              align="right"
              width="14rem" /* 224px */
              trigger={
                <S.StoreSelectorTrigger title={t('dashboard.selectStore')}>
                  <Icon name="storefront" size={16} />
                  <S.StoreSelectorLabel variant="body-sm" weight="medium">
                    {selectedStoreId === 'all'
                      ? t('dashboard.allStores')
                      : (ebayAccounts.find((a) => a.id === selectedStoreId)?.storeName
                        || ebayAccounts.find((a) => a.id === selectedStoreId)?.sellerId
                        || t('dashboard.allStores'))}
                  </S.StoreSelectorLabel>
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
          )}
          <SegmentedControl
            options={periodPresetOptions}
            value={periodPreset}
            onChange={(v) => onPeriodPresetChange(v as 'today' | 'week' | 'month')}
            size="sm"
          />
        </S.ToolbarRight>
      </S.Toolbar>

      {/* Active filter banner */}
      {filteredListingId && (() => {
        const listing = listings.find((l) => l.id === filteredListingId);
        return listing ? (
          <S.FilterBanner $bg={theme.colors.semanticTint.info}>
            <Icon name="filter" size={14} color={theme.colors.semantic.info} />
            <Text variant="body-xs" weight="medium">{t('dashboard.filteredBy', { title: listing.title })}</Text>
            <Button variant="text" onClick={() => onListingSelect(null)}>
              <Text>{t('dashboard.clearFilter')}</Text>
            </Button>
          </S.FilterBanner>
        ) : null;
      })()}

      {/* Period Cards */}
      <S.PeriodCardsGrid>
        {PERIOD_KEYS.map((key) => (
          <PeriodCardComponent
            key={key}
            title={periodTitles[key]}
            dateRange={periodDates[key].dateRange}
            metrics={metrics?.[key] ?? EMPTY_PERIOD}
            accentColor={cardColors[key]}
            headerBg={cardHeaders[key]}
            isActive={selectedPeriod === key}
            onClick={() => onPeriodSelect(key)}
            formatCurrency={formatCurrency}
            labels={labels}
          />
        ))}
      </S.PeriodCardsGrid>

      {/* Revenue Chart — full width */}
      <Card variant="bordered">
        <CardHeader
          actions={
            <S.ChartLegend>
              <S.LegendItem>
                <S.LegendDot $color={revenueColor} />
                <Text variant="caption" color="text.secondary">{t('dashboard.revenue')}</Text>
              </S.LegendItem>
              <S.LegendItem>
                <S.LegendDot $color={profitColor} />
                <Text variant="caption" color="text.secondary">{t('dashboard.profit')}</Text>
              </S.LegendItem>
            </S.ChartLegend>
          }
        >
          {t('dashboard.revenueTrend')}
        </CardHeader>
        <CardBody>
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
                <XAxis dataKey="date" tickFormatter={(v: string) => formatDate(v)} tick={{ fontSize: 11, fill: theme.colors.text.tertiary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.colors.text.tertiary }} tickFormatter={(v: number) => formatCompactCurrency(v)} axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  contentStyle={{ background: theme.colors.surface.primary, border: `1px solid ${theme.colors.border.primary}`, borderRadius: theme.radius?.md || '8px', boxShadow: theme.shadows?.md || '0 4px 12px rgba(0,0,0,0.1)', fontSize: '13px' }}
                  formatter={(value: unknown, name: unknown) => [formatCurrency(Number(value ?? 0)), name === 'revenue' ? t('dashboard.revenue') : t('dashboard.profit')]}
                  labelFormatter={(label: unknown) => new Date(String(label)).toLocaleDateString(isTR ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                />
                <Area type="monotone" dataKey="revenue" stroke={revenueColor} strokeWidth={2} fill="url(#revenueGrad)" />
                <Area type="monotone" dataKey="profit" stroke={profitColor} strokeWidth={2} fill="url(#profitGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </S.ChartContainer>
        </CardBody>
      </Card>

      {/* Listings Table — Sellerboard-style product breakdown */}
      <Card variant="bordered">
        <CardHeader>
          {t('dashboard.listings')}
        </CardHeader>
        <CardBody>
          <S.ListingsTableWrapper>
            <S.ListingsTable>
              <thead>
                <tr>
                  <S.Th>{t('dashboard.listingTitle')}</S.Th>
                  <S.Th>{t('dashboard.listingPrice')}</S.Th>
                  <S.Th>{t('dashboard.listingCost')}</S.Th>
                  <S.Th>{t('dashboard.listingProfit')}</S.Th>
                  <S.Th>{t('dashboard.listingMargin')}</S.Th>
                  <S.Th>{t('dashboard.listingRoi')}</S.Th>
                  <S.Th>{t('dashboard.listingSold')}</S.Th>
                  <S.Th>{t('dashboard.listingStatus')}</S.Th>
                </tr>
              </thead>
              <tbody>
                {(filteredListingId ? listings.filter((l) => l.id === filteredListingId) : listings).map((listing) => (
                  <S.Tr key={listing.id} onClick={() => onListingSelect(filteredListingId === listing.id ? null : listing.id)}>
                    <S.Td>
                      <S.ListingTitleCell>
                        <S.ListingThumb $imageUrl={listing.imageUrls?.[0]} />
                        <S.ListingInfo>
                          <S.ListingName variant="body-sm" weight="medium">{listing.title}</S.ListingName>
                          <Text variant="caption" color="text.tertiary">{listing.asin}</Text>
                        </S.ListingInfo>
                      </S.ListingTitleCell>
                    </S.Td>
                    <S.Td><Text variant="body-sm">{formatCurrency(listing.price)}</Text></S.Td>
                    <S.Td><Text variant="body-sm">{listing.purchasePrice ? formatCurrency(listing.purchasePrice) : '—'}</Text></S.Td>
                    <S.Td>
                      {listing.estimatedProfit !== null && listing.estimatedProfit !== undefined ? (
                        listing.estimatedProfit >= 0
                          ? <S.ProfitPositive variant="body-sm" weight="medium">{formatCurrency(listing.estimatedProfit)}</S.ProfitPositive>
                          : <S.ProfitNegative variant="body-sm" weight="medium">{formatCurrency(listing.estimatedProfit)}</S.ProfitNegative>
                      ) : <Text variant="body-sm" color="text.tertiary">—</Text>}
                    </S.Td>
                    <S.Td><Text variant="body-sm">{listing.profitMargin !== null && listing.profitMargin !== undefined ? `${listing.profitMargin}%` : '—'}</Text></S.Td>
                    <S.Td><Text variant="body-sm">{listing.roi !== null && listing.roi !== undefined ? `${listing.roi}%` : '—'}</Text></S.Td>
                    <S.Td><Text variant="body-sm">{listing.soldCount ?? 0}</Text></S.Td>
                    <S.Td><Text variant="body-sm">{listing.status}</Text></S.Td>
                  </S.Tr>
                ))}
              </tbody>
            </S.ListingsTable>
          </S.ListingsTableWrapper>
        </CardBody>
      </Card>
    </S.Container>
  );
};
