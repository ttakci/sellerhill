/**
 * DashboardPage Container
 * Resolves URL state, data, formatters and labels for all three tabs.
 */

import { DashboardPeriodKey, DashboardTab } from '@repo/shared';
import { getLocaleConfig, useTheme, useUI, type DropdownItem } from '@repo/ui';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { PeriodCardLabels } from '../components/PeriodCard';
import { useDashboardFormatters } from '../hooks/useDashboardFormatters';
import { ALL_STORES, useDashboardUrlState } from '../hooks/useDashboardUrlState';
import { EMPTY_PERIOD_METRICS } from '../utils/emptyMetrics';
import { getAllPeriodRanges } from '../utils/periodRanges';

import { DashboardPageComponent } from './DashboardPage.component';
import type { DashboardTabItem } from './DashboardPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useGetDashboardQuery } from '@/features/dashboard/api/dashboardApi';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useGetListingsQuery } from '@/features/listings/api/listings.api';
import { useGetOrdersQuery } from '@/features/orders/api/orders.api';
import { useGetStoreSettingsQuery } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

const CAROUSEL_LIMIT = 12;

export const DashboardPageContainer = (): React.ReactElement => {
  const { t, i18n } = useTranslation(['dashboard', 'listings', 'orders', 'translation']);
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { theme } = useTheme();

  const { tab, period, storeId, granularity, setTab, setPeriod, setStoreId, setGranularity } =
    useDashboardUrlState();
  const storeFilter = storeId !== ALL_STORES ? storeId : undefined;

  const languageCode = (i18n.language || 'en').split('-')[0];
  const formatters = useDashboardFormatters(languageCode);
  const { locale } = useMemo(() => getLocaleConfig(languageCode), [languageCode]);

  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
  } = useGetDashboardQuery({ chartGranularity: granularity, ebayAccountId: storeFilter });

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const ebayAccounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData]);

  const { data: storeSettings } = useGetStoreSettingsQuery({ storeId: storeFilter });
  const amazonTaxRate = storeSettings?.amazonTaxRate ?? 0;

  const { data: userData, error: userError } = useGetMeQuery();

  const periodDates = useMemo(() => getAllPeriodRanges(locale), [locale]);
  const activeRange = periodDates[period];

  const { data: listingsPage } = useGetListingsQuery({
    page: 1,
    limit: CAROUSEL_LIMIT,
    soldFrom: activeRange.from,
    soldTo: activeRange.to,
    sortBy: 'lastSale',
    sortOrder: 'desc',
    ebayAccountId: storeFilter,
  });

  const { data: ordersPage } = useGetOrdersQuery({
    page: 1,
    limit: CAROUSEL_LIMIT,
    dateFrom: activeRange.from,
    dateTo: activeRange.to,
    sortBy: 'order_date',
    sortOrder: 'desc',
    ebayAccountId: storeFilter,
  });

  const listings = listingsPage?.items ?? [];
  const orders = ordersPage?.orders ?? [];

  /* ─── navigation ─── */

  const handleListingOpen = useCallback(
    (listingId: string) => localeNavigate(`/listings/${listingId}`),
    [localeNavigate],
  );

  const handleOrderOpen = useCallback(
    (orderId: string) => localeNavigate(`/orders/${orderId}`),
    [localeNavigate],
  );

  const buildRangeParams = useCallback(
    (fromKey: string, toKey: string): string => {
      const params = new URLSearchParams({
        [fromKey]: activeRange.from,
        [toKey]: activeRange.to,
        from: 'dashboard',
      });
      if (storeFilter) {
        params.set('store', storeFilter);
      }
      return params.toString();
    },
    [activeRange, storeFilter],
  );

  const handleListingsViewAll = useCallback(
    () => localeNavigate(`/listings/all?${buildRangeParams('soldFrom', 'soldTo')}`),
    [localeNavigate, buildRangeParams],
  );

  const handleOrdersViewAll = useCallback(
    () => localeNavigate(`/orders?${buildRangeParams('dateFrom', 'dateTo')}`),
    [localeNavigate, buildRangeParams],
  );

  /* ─── labels ─── */

  const tabs = useMemo<DashboardTabItem[]>(
    () => [
      { id: DashboardTab.CARDS, label: t('dashboard.tabs.cards'), icon: 'grid-view' },
      { id: DashboardTab.CHART, label: t('dashboard.tabs.chart'), icon: 'bar-chart' },
      { id: DashboardTab.PNL, label: t('dashboard.tabs.pnl'), icon: 'table' },
    ],
    [t],
  );

  const cardLabels = useMemo<PeriodCardLabels>(
    () => ({
      sales: t('dashboard.metrics.sales'),
      netProfit: t('dashboard.metrics.netProfit'),
      grossProfit: t('dashboard.metrics.grossProfit'),
      ordersUnits: t('dashboard.metrics.ordersUnits'),
      refunds: t('dashboard.metrics.refunds'),
      margin: t('dashboard.metrics.margin'),
      roi: t('dashboard.metrics.roi'),
      estimatedPayout: t('dashboard.metrics.estimatedPayout'),
      avgOrderValue: t('dashboard.metrics.avgOrderValue'),
      costOfGoods: t('dashboard.metrics.costOfGoods'),
      transactionFees: t('dashboard.metrics.transactionFees'),
      adFees: t('dashboard.metrics.adFees'),
      amazonShipping: t('dashboard.metrics.amazonShipping'),
      amazonTax: t('dashboard.metrics.amazonTax'),
      refundRate: t('dashboard.metrics.refundRate'),
      showMore: t('dashboard.card.showMore'),
      showLess: t('dashboard.card.showLess'),
      estimatedLabel: t('dashboard.profit.estimatedLabel'),
      estimatedTooltip: t('dashboard.profit.estimatedTooltip', { rate: amazonTaxRate }),
      uncostedLabel: t('dashboard.profit.uncostedLabel'),
      uncostedTooltip: t('dashboard.profit.uncostedTooltip'),
    }),
    [t, amazonTaxRate],
  );

  const periods = useMemo(() => {
    const config: { key: DashboardPeriodKey; title: string; gradient: string }[] = [
      {
        key: DashboardPeriodKey.TODAY,
        title: t('dashboard.today'),
        gradient: theme.colors.dashboard.periodTodayGradient,
      },
      {
        key: DashboardPeriodKey.THIS_WEEK,
        title: t('dashboard.thisWeek'),
        gradient: theme.colors.dashboard.periodThisWeekGradient,
      },
      {
        key: DashboardPeriodKey.THIS_MONTH,
        title: t('dashboard.thisMonth'),
        gradient: theme.colors.dashboard.periodThisMonthGradient,
      },
      {
        key: DashboardPeriodKey.THIS_YEAR,
        title: t('dashboard.thisYear'),
        gradient: theme.colors.dashboard.periodThisYearGradient,
      },
    ];

    if (!dashboardData) {
      return [];
    }

    return config.map((entry) => ({
      ...entry,
      dates: periodDates[entry.key],
      metrics: dashboardData.metrics[entry.key],
    }));
  }, [t, theme, dashboardData, periodDates]);

  const storeItems = useMemo<DropdownItem[]>(
    () => [
      {
        label: t('dashboard.allStores'),
        icon: storeId === ALL_STORES ? ('check' as const) : undefined,
        onClick: () => setStoreId(ALL_STORES),
      },
      ...ebayAccounts.map((account) => ({
        label: account.storeName || account.sellerId,
        icon: storeId === account.id ? ('check' as const) : undefined,
        onClick: () => setStoreId(account.id),
      })),
    ],
    [t, ebayAccounts, storeId, setStoreId],
  );

  const selectedStoreLabel = useMemo(() => {
    if (storeId === ALL_STORES) {
      return t('dashboard.allStores');
    }
    const account = ebayAccounts.find((entry) => entry.id === storeId);
    return account?.storeName || account?.sellerId || t('dashboard.allStores');
  }, [storeId, ebayAccounts, t]);

  /* ─── errors ─── */

  useEffect(() => {
    const error = dashboardError || userError;
    if (!error) {
      return;
    }
    if ('status' in error && error.status === 401) {
      return;
    }
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(error),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      t,
    );
  }, [dashboardError, userError, showMessage, closeMessage, t]);

  return (
    <EbayAccountGuard>
      <DashboardPageComponent
        title={t('dashboard.title')}
        subtitle={
          userData ? t('dashboard.greeting', { name: userData.firstName }) : t('dashboard.subtitle')
        }
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        storeSelectorLabel={selectedStoreLabel}
        storeItems={storeItems}
        showStoreSelector={ebayAccounts.length > 0}
        cardsProps={{
          periods,
          selectedPeriod: period,
          onPeriodSelect: setPeriod,
          formatters,
          cardLabels,
          isLoading: isDashboardLoading,
          listings,
          orders,
          onListingOpen: handleListingOpen,
          onListingsViewAll: handleListingsViewAll,
          onOrderOpen: handleOrderOpen,
          onOrdersViewAll: handleOrdersViewAll,
          listingsTitle: t('dashboard.listingsSection'),
          listingsViewAllLabel: t('listings:listings.actions.viewAll'),
          listingsEmptyTitle: t('dashboard.listingsEmptyTitle'),
          listingsEmptySubtitle: t('dashboard.listingsEmptySubtitle'),
          ordersTitle: t('dashboard.ordersSection'),
          ordersViewAllLabel: t('orders:orders.overview.viewAll'),
          ordersEmptyTitle: t('dashboard.ordersEmptyTitle'),
          ordersEmptySubtitle: t('dashboard.ordersEmptySubtitle'),
        }}
        chartProps={{
          points: dashboardData?.chart.points ?? [],
          summary: dashboardData?.chart.summary ?? EMPTY_PERIOD_METRICS,
          granularity,
          onGranularityChange: setGranularity,
          formatters,
          isLoading: isDashboardLoading,
        }}
        pnlProps={{
          months: dashboardData?.history.months ?? [],
          formatters,
          isLoading: isDashboardLoading,
        }}
      />
    </EbayAccountGuard>
  );
};
