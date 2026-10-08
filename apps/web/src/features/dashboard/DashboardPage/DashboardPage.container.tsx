/**
 * DashboardPage Container
 * Resolves URL state, data, formatters and labels for all three tabs. One date
 * range drives the cards, the chart and the P&L; every window shown comes from
 * the API, resolved on the seller's own calendar day.
 */

import {
  DashboardChartGranularity,
  DashboardRangePreset,
  DashboardTab,
  DASHBOARD_MAX_RANGE_DAYS,
  DEFAULT_DASHBOARD_RANGE_PRESET,
} from '@repo/shared';
import { getLocaleConfig, useTheme, useUI, type DateRangePickerProps } from '@repo/ui';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { PeriodCardEntry } from '../components/CardsPanel';
import type { PeriodCardLabels } from '../components/PeriodCard';
import { useDashboardFormatters } from '../hooks/useDashboardFormatters';
import { useDashboardUrlState } from '../hooks/useDashboardUrlState';
import { EMPTY_PERIOD_METRICS } from '../utils/emptyMetrics';
import { periodLabelKey } from '../utils/periodLabels';

import { DashboardPageComponent } from './DashboardPage.component';
import type { DashboardTabItem } from './DashboardPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useGetDashboardQuery } from '@/features/dashboard/api/dashboardApi';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { useGetListingsQuery } from '@/features/listings/api/listings.api';
import { useGetOrdersQuery } from '@/features/orders/api/orders.api';
import { resolveStoreDraftSeed } from '@/features/settings/drawers/storeDraftSeed';
import { GLOBAL_SCOPE } from '@/features/settings/drawers/storeScope';
import { useGetAllStoreSettingsQuery } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';
import { useLocale } from '@/utils/useLocale';

const CAROUSEL_LIMIT = 12;

export const DashboardPageContainer = (): React.ReactElement => {
  const { t, i18n } = useTranslation(['dashboard', 'listings', 'orders', 'translation']);
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { theme } = useTheme();

  const { tab, range, card, topSort, topPage, setTab, setRange, setCard, setTopSort, setTopPage } =
    useDashboardUrlState();
  // The store chosen in the top bar; every figure on the page is that store's.
  const { activeStoreId } = useActiveStore();
  const storeFilter = activeStoreId ?? undefined;
  const noStore = !activeStoreId;

  const languageCode = (i18n.language || 'en').split('-')[0];
  const { locale } = useMemo(() => getLocaleConfig(languageCode), [languageCode]);

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const ebayAccounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData]);

  /* Money renders in the connected eBay store's marketplace currency, never
     the UI language — a filtered store narrows to its own currency, "all
     stores" falls back to the first connected store. */
  const currency = useMemo(
    () => resolveStoreCurrency(ebayAccounts, storeFilter),
    [ebayAccounts, storeFilter]
  );
  const formatters = useDashboardFormatters(languageCode, currency);

  const {
    data: dashboardData,
    currentData: currentDashboardData,
    isLoading: isInitialLoading,
    isFetching: isDashboardFetching,
    error: dashboardError,
  } = useGetDashboardQuery({ range, ebayAccountId: storeFilter }, { skip: noStore });
  // `dashboardData` keeps the PREVIOUS range's answer while a new one loads;
  // `currentData` does not. Fetching without a current answer = the cards, chart
  // and P&L show their own skeleton instead of last range's figures.
  const isDashboardLoading = isInitialLoading || (isDashboardFetching && currentDashboardData === undefined);

  /* The tax rate the estimate actually used: the selected store's own row
     when it has one, else the global row (Store > Global) — never the
     synthetic 0 a missing row reads as. */
  const { data: storeConfigs } = useGetAllStoreSettingsQuery();
  const amazonTaxRate = useMemo(
    () => resolveStoreDraftSeed(storeConfigs ?? [], storeFilter ?? GLOBAL_SCOPE)?.amazonTaxRate ?? 0,
    [storeConfigs, storeFilter]
  );

  const { data: userData, error: userError } = useGetMeQuery();

  /* The selected card's window — the lists below show exactly what it counted. */
  const periodsDto = useMemo(() => dashboardData?.periods ?? [], [dashboardData]);
  const activeWindow = periodsDto[card] ?? periodsDto[0];
  const carouselFrom = activeWindow?.from;
  const carouselTo = activeWindow?.to;

  const { data: listingsPage } = useGetListingsQuery({
    page: 1,
    limit: CAROUSEL_LIMIT,
    soldFrom: carouselFrom,
    soldTo: carouselTo,
    sortBy: 'lastSale',
    sortOrder: 'desc',
    ebayAccountId: storeFilter,
  }, { skip: noStore || !activeWindow });

  // Tracked only — the dashboard describes the business SellerHill manages,
  // and the period cards are scoped the same way, so the carousel cannot show
  // an order the card above it did not count.
  const { data: ordersPage } = useGetOrdersQuery({
    page: 1,
    limit: CAROUSEL_LIMIT,
    dateFrom: carouselFrom,
    dateTo: carouselTo,
    sortBy: 'order_date',
    sortOrder: 'desc',
    ebayAccountId: storeFilter,
    isTracked: true,
  }, { skip: noStore || !activeWindow });

  const listings = listingsPage?.items ?? [];
  const listingsTotal = listingsPage?.total ?? 0;
  const orders = ordersPage?.orders ?? [];
  const ordersTotal = ordersPage?.total ?? 0;

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
        [fromKey]: carouselFrom ?? '',
        [toKey]: carouselTo ?? '',
        from: 'dashboard',
      });
      if (storeFilter) {
        params.set('store', storeFilter);
      }
      return params.toString();
    },
    [carouselFrom, carouselTo, storeFilter],
  );

  const handleListingsViewAll = useCallback(
    () => localeNavigate(`/listings/all?${buildRangeParams('soldFrom', 'soldTo')}`),
    [localeNavigate, buildRangeParams],
  );

  // `tracking=tracked` mirrors the carousel's `isTracked: true`, so "view all"
  // opens the same set of orders the dashboard counted.
  const handleOrdersViewAll = useCallback(
    () => localeNavigate(`/orders?${buildRangeParams('dateFrom', 'dateTo')}&tracking=tracked`),
    [localeNavigate, buildRangeParams],
  );

  /* ─── labels ─── */

  const tabs = useMemo<DashboardTabItem[]>(
    () => [
      { id: DashboardTab.CARDS, label: t('dashboard.tabs.cards'), icon: 'grid-view' },
      { id: DashboardTab.CHART, label: t('dashboard.tabs.chart'), icon: 'bar-chart' },
      { id: DashboardTab.PNL, label: t('dashboard.tabs.pnl'), icon: 'table' },
      { id: DashboardTab.TOP_SELLERS, label: t('dashboard.tabs.topSellers'), icon: 'trending-up' },
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
      untrackedExcludedLabel: (count: number) =>
        t('dashboard.profit.untrackedExcludedLabel', { count }),
      untrackedExcludedTooltip: t('dashboard.profit.untrackedExcludedTooltip'),
    }),
    [t, amazonTaxRate],
  );

  /* Four cards, newest first; the gradients keep their order whatever the range. */
  const periods = useMemo<PeriodCardEntry[]>(() => {
    const gradients = [
      theme.colors.dashboard.periodTodayGradient,
      theme.colors.dashboard.periodThisWeekGradient,
      theme.colors.dashboard.periodThisMonthGradient,
      theme.colors.dashboard.periodThisYearGradient,
    ];
    return periodsDto.map((p, index) => {
      const labelKey = periodLabelKey(p.label);
      // A card with no name is titled by its dates; its subline then carries
      // the numeric form with the year (or, for a single day — already
      // numeric in the title — its weekday) instead of repeating the title.
      const shortRange = formatters.dateRange(p.from, p.to);
      const unnamedSubline =
        p.from === p.to ? formatters.weekday(p.from) : formatters.numericDateRange(p.from, p.to);
      const dateRange = labelKey ? shortRange : unnamedSubline;
      return {
        index,
        title: labelKey ? t(labelKey.key as 'dashboard.title', { count: labelKey.count }) : shortRange,
        dates: { from: p.from, to: p.to, dateRange },
        metrics: p.metrics,
        gradient: gradients[index % gradients.length],
      };
    });
  }, [periodsDto, formatters, t, theme]);

  /* ─── date filter ─── */

  const appliedRange = dashboardData?.range;

  const rangePresets = useMemo(
    () =>
      Object.values(DashboardRangePreset).map((value) => ({
        value,
        label: t(`dashboard.range.preset.${value}` as 'dashboard.title'),
      })),
    [t],
  );

  const handlePresetSelect = useCallback(
    (value: string) => setRange({ preset: value as DashboardRangePreset }),
    [setRange],
  );

  const handleRangeApply = useCallback(
    (from: string, to: string) => setRange({ from, to }),
    [setRange],
  );

  // Rendered only once the API has answered: the calendar needs the seller's today.
  const rangePickerProps = useMemo<DateRangePickerProps | null>(() => {
    if (!appliedRange) {
      return null;
    }
    // The chosen preset is named at once; the dates come from the response once it arrives.
    const namedPreset = 'preset' in range ? range.preset : appliedRange.preset;
    const name = namedPreset
      ? t(`dashboard.range.preset.${namedPreset}` as 'dashboard.title')
      : t('dashboard.range.custom');
    const shownFrom = 'from' in range ? range.from : appliedRange.from;
    const shownTo = 'to' in range ? range.to : appliedRange.to;
    const datesPending = isDashboardLoading && 'preset' in range;
    return {
      presets: rangePresets,
      selectedPreset: 'preset' in range ? range.preset : null,
      from: appliedRange.from,
      to: appliedRange.to,
      maxDate: appliedRange.today,
      maxSpanDays: DASHBOARD_MAX_RANGE_DAYS,
      triggerLabel: name,
      triggerHint: datesPending ? undefined : formatters.dateRange(shownFrom, shownTo),
      customLabel: t('dashboard.range.custom'),
      applyLabel: t('dashboard.range.apply'),
      cancelLabel: t('dashboard.range.cancel'),
      dialogLabel: t('dashboard.range.title'),
      locale,
      onPresetSelect: handlePresetSelect,
      onRangeApply: handleRangeApply,
    };
  }, [appliedRange, range, isDashboardLoading, rangePresets, formatters, locale, t, handlePresetSelect, handleRangeApply]);

  /* ─── errors ─── */

  const isDefaultRange = 'preset' in range && range.preset === DEFAULT_DASHBOARD_RANGE_PRESET;

  useEffect(() => {
    const error = dashboardError || userError;
    if (!error) {
      return;
    }
    if ('status' in error && error.status === 401) {
      return;
    }
    // A stale custom URL (e.g. a `to` that is now after the seller's today in
    // their zone) must not leave the page stuck on an error: fall back to the
    // default range instead.
    if (dashboardError && 'status' in dashboardError && dashboardError.status === 400 && !isDefaultRange) {
      setRange({ preset: DEFAULT_DASHBOARD_RANGE_PRESET });
      showMessage(
        {
          type: 'warning',
          headerKey: 'translation:message.error.header',
          descriptionKey: 'dashboard:dashboard.errors.invalidRange',
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        t,
      );
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
  }, [dashboardError, userError, isDefaultRange, setRange, showMessage, closeMessage, t]);

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
        rangePickerProps={rangePickerProps}
        cardsProps={{
          periods,
          selectedPeriod: card,
          onPeriodSelect: setCard,
          formatters,
          cardLabels,
          isLoading: isDashboardLoading,
          listings,
          listingsTotal,
          orders,
          ordersTotal,
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
          granularity: dashboardData?.chart.granularity ?? DashboardChartGranularity.HOUR,
          formatters,
          isLoading: isDashboardLoading,
        }}
        pnlProps={{
          columns: dashboardData?.pnl.columns ?? [],
          granularity: dashboardData?.pnl.granularity ?? DashboardChartGranularity.DAY,
          csvStamp: appliedRange?.to ?? '',
          formatters,
          isLoading: isDashboardLoading,
        }}
        topSellersProps={{
          range,
          ebayAccountId: storeFilter,
          sortBy: topSort,
          page: topPage,
          onSortChange: setTopSort,
          onPageChange: setTopPage,
          locale,
          onOpenListing: handleListingOpen,
        }}
      />
    </EbayAccountGuard>
  );
};
