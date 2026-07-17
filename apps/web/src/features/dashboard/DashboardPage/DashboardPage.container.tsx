/**
 * DashboardPage Container
 * Tabs: period cards + carousels | chart | history
 */

import type { DashboardPeriodKey } from '@repo/shared';
import { formatCompactNumber, formatCurrency, formatDate, getLocaleConfig, useTheme, useUI } from '@repo/ui';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useGetDashboardQuery } from '../api/dashboardApi';
import { getAllPeriodRanges, getPeriodRange } from '../utils/periodRanges';

import { DashboardPageComponent } from './DashboardPage.component';
import type { DashboardTabId, PeriodDateInfo } from './DashboardPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useGetListingsQuery } from '@/features/listings/api/listings.api';
import { useGetOrdersQuery } from '@/features/orders/api/orders.api';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

const VALID_TABS: DashboardTabId[] = ['cards', 'chart', 'history'];
const VALID_PERIODS: DashboardPeriodKey[] = ['today', 'thisWeek', 'thisMonth', 'thisYear'];

export const DashboardPageContainer = (): React.ReactElement => {
  const { t, i18n } = useTranslation(['dashboard', 'listings', 'orders', 'translation']);
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as DashboardTabId | null;
  const activeTab: DashboardTabId =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'cards';

  const periodParam = searchParams.get('period') as DashboardPeriodKey | null;
  const selectedPeriod: DashboardPeriodKey =
    periodParam && VALID_PERIODS.includes(periodParam) ? periodParam : 'today';

  const selectedStoreId = searchParams.get('store') ?? 'all';
  const storeFilter = selectedStoreId !== 'all' ? selectedStoreId : undefined;

  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
  } = useGetDashboardQuery({ ebayAccountId: storeFilter });

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const ebayAccounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData]);

  const { data: userData, error: userError } = useGetMeQuery();

  const languageCode = (i18n.language || 'en').split('-')[0];
  const isTR = languageCode === 'tr';
  const { locale, currency } = useMemo(() => getLocaleConfig(languageCode), [languageCode]);

  const periodDates = useMemo((): Record<DashboardPeriodKey, PeriodDateInfo> => {
    const all = getAllPeriodRanges(locale);
    return {
      today: { dateRange: all.today.dateRangeLabel, from: all.today.from, to: all.today.to },
      thisWeek: {
        dateRange: all.thisWeek.dateRangeLabel,
        from: all.thisWeek.from,
        to: all.thisWeek.to,
      },
      thisMonth: {
        dateRange: all.thisMonth.dateRangeLabel,
        from: all.thisMonth.from,
        to: all.thisMonth.to,
      },
      thisYear: {
        dateRange: all.thisYear.dateRangeLabel,
        from: all.thisYear.from,
        to: all.thisYear.to,
      },
    };
  }, [locale]);

  const activeRange = periodDates[selectedPeriod];

  // Period-filtered carousels (cards tab)
  const { data: listingsPage } = useGetListingsQuery({
    page: 1,
    limit: 12,
    soldFrom: activeRange.from,
    soldTo: activeRange.to,
    sortBy: 'lastSale',
    sortOrder: 'desc',
    ebayAccountId: storeFilter,
  });

  const { data: ordersPage } = useGetOrdersQuery({
    page: 1,
    limit: 12,
    dateFrom: activeRange.from,
    dateTo: activeRange.to,
    sortBy: 'order_date',
    sortOrder: 'desc',
    ebayAccountId: storeFilter,
  });

  const listings = listingsPage?.items ?? [];
  const listingsTotal = listingsPage?.total ?? 0;
  const orders = ordersPage?.orders ?? [];
  const ordersTotal = ordersPage?.total ?? 0;

  const handleFormatCurrency = useCallback(
    (value: number) => formatCurrency(value, locale, currency),
    [locale, currency],
  );
  const handleFormatCompactCurrency = useCallback(
    (value: number) => formatCompactNumber(value, locale),
    [locale],
  );
  const handleFormatDate = useCallback(
    (dateString: string) =>
      formatDate(dateString, locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [locale],
  );
  const handleFormatTrend = useCallback((trend: number | null | undefined): string | undefined => {
    if (trend === null || trend === undefined) {
      return undefined;
    }
    const abs = Math.abs(Math.round(trend * 10) / 10);
    return `${trend >= 0 ? '+' : '−'}${abs}%`;
  }, []);

  const patchSearchParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleStoreSelect = useCallback(
    (storeId: string): void => {
      patchSearchParams((next) => {
        if (storeId === 'all') {
          next.delete('store');
        } else {
          next.set('store', storeId);
        }
      });
    },
    [patchSearchParams],
  );

  const handleTabChange = useCallback(
    (tab: DashboardTabId) => {
      patchSearchParams((next) => {
        if (tab === 'cards') {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
      });
    },
    [patchSearchParams],
  );

  const handlePeriodSelect = useCallback(
    (period: DashboardPeriodKey) => {
      patchSearchParams((next) => {
        if (period === 'today') {
          next.delete('period');
        } else {
          next.set('period', period);
        }
      });
    },
    [patchSearchParams],
  );

  const handleListingOpen = useCallback(
    (listingId: string) => {
      localeNavigate(`/listings/${listingId}`);
    },
    [localeNavigate],
  );

  const handleListingsViewAll = useCallback(() => {
    const range = getPeriodRange(selectedPeriod, locale);
    const params = new URLSearchParams({
      soldFrom: range.from,
      soldTo: range.to,
      from: 'dashboard',
    });
    if (storeFilter) {
      params.set('store', storeFilter);
    }
    localeNavigate(`/listings/all?${params.toString()}`);
  }, [localeNavigate, selectedPeriod, locale, storeFilter]);

  const handleOrderOpen = useCallback(
    (orderId: string) => {
      localeNavigate(`/orders/${orderId}`);
    },
    [localeNavigate],
  );

  const handleOrdersViewAll = useCallback(() => {
    const range = getPeriodRange(selectedPeriod, locale);
    const params = new URLSearchParams({
      dateFrom: range.from,
      dateTo: range.to,
      from: 'dashboard',
    });
    if (storeFilter) {
      params.set('store', storeFilter);
    }
    localeNavigate(`/orders/all?${params.toString()}`);
  }, [localeNavigate, selectedPeriod, locale, storeFilter]);

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

  const cardHeaderColors = useMemo(
    () => ({
      today: theme.colors.dashboard.periodToday,
      thisWeek: theme.colors.dashboard.periodThisWeek,
      thisMonth: theme.colors.dashboard.periodThisMonth,
      thisYear: theme.colors.dashboard.periodLastMonth,
    }),
    [theme],
  );

  const labels = useMemo(
    () => ({
      sales: t('dashboard.sales'),
      ordersUnits: t('dashboard.ordersUnits'),
      refunds: t('dashboard.refunds'),
      grossProfit: t('dashboard.grossProfit'),
      netProfit: t('dashboard.netProfit'),
      estimatedPayout: t('dashboard.estimatedPayout'),
    }),
    [t],
  );

  const periodTitles = useMemo(
    () => ({
      today: t('dashboard.today'),
      thisWeek: t('dashboard.thisWeek'),
      thisMonth: t('dashboard.thisMonth'),
      thisYear: t('dashboard.thisYear'),
    }),
    [t],
  );

  const tabLabels = useMemo(
    () => ({
      cards: t('dashboard.tabs.cards'),
      chart: t('dashboard.tabs.chart'),
      history: t('dashboard.tabs.history'),
    }),
    [t],
  );

  return (
    <EbayAccountGuard>
      <DashboardPageComponent
        user={userData || null}
        dashboardData={dashboardData}
        isLoading={isDashboardLoading}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        selectedPeriod={selectedPeriod}
        onPeriodSelect={handlePeriodSelect}
        periodDates={periodDates}
        listings={listings}
        listingsTotal={listingsTotal}
        orders={orders}
        ordersTotal={ordersTotal}
        onListingOpen={handleListingOpen}
        onListingsViewAll={handleListingsViewAll}
        onOrderOpen={handleOrderOpen}
        onOrdersViewAll={handleOrdersViewAll}
        ebayAccounts={ebayAccounts}
        selectedStoreId={selectedStoreId}
        onStoreSelect={handleStoreSelect}
        isTR={isTR}
        formatCurrency={handleFormatCurrency}
        formatCompactCurrency={handleFormatCompactCurrency}
        formatDate={handleFormatDate}
        formatTrend={handleFormatTrend}
        cardHeaderColors={cardHeaderColors}
        labels={labels}
        periodTitles={periodTitles}
        listingsViewAllLabel={t('dashboard.viewAllListings')}
        ordersViewAllLabel={t('dashboard.viewAllOrders')}
        listingsEmptyTitle={t('dashboard.listingsEmptyTitle')}
        listingsEmptySubtitle={t('dashboard.listingsEmptySubtitle')}
        ordersEmptyTitle={t('dashboard.ordersEmptyTitle')}
        ordersEmptySubtitle={t('dashboard.ordersEmptySubtitle')}
        tabLabels={tabLabels}
      />
    </EbayAccountGuard>
  );
};
