/**
 * DashboardPage Container (Smart Component)
 * Search, period preset, listing filter, data fetching
 */

import { formatCompactNumber, formatCurrency, formatDate, getLocaleConfig, useLoading, useUI } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useGetDashboardQuery } from '../api/dashboardApi';

import { DashboardPageComponent } from './DashboardPage.component';
import type { PeriodDateInfo, PeriodKey, PeriodPreset } from './DashboardPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useGetListingsQuery } from '@/features/listings/api/listings.api';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

/** Map period preset to chart days */
const PRESET_DAYS: Record<PeriodPreset, number> = { today: 7, week: 14, month: 30 };

const computePeriodDates = (locale: string): Record<PeriodKey, PeriodDateInfo> => {
  const now = new Date();
  const fmt = (d: Date, opts?: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString(locale, opts);

  const today = fmt(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    today: { dateRange: today },
    yesterday: { dateRange: fmt(yesterday) },
    thisMonth: { dateRange: `${fmt(monthStart, { day: '2-digit', month: 'short' })} – ${fmt(now, { day: '2-digit', month: 'short' })}` },
    thisMonthForecast: { dateRange: `${fmt(monthStart, { day: '2-digit', month: 'short' })} – ${fmt(monthEnd, { day: '2-digit', month: 'short' })}` },
    lastMonth: { dateRange: `${fmt(lastMonthStart, { day: '2-digit', month: 'short' })} – ${fmt(lastMonthEnd, { day: '2-digit', month: 'short' })}` },
  };
};

export const DashboardPageContainer = (): React.ReactElement => {
  const { t, i18n } = useTranslation(['translation']);
  const { localeNavigate: _localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('week');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredListingId, setFilteredListingId] = useState<string | null>(null);

  const selectedDays = PRESET_DAYS[periodPreset];
  const selectedStoreId = searchParams.get('store') ?? 'all';

  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useGetDashboardQuery(selectedDays);
  const { data: ebayAccountsData } = useGetEbayAccountsQuery();

  const ebayAccounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData]);

  const handleStoreSelect = useCallback((storeId: string): void => {
    const next = new URLSearchParams(searchParams);
    if (storeId === 'all') {
      next.delete('store');
    } else {
      next.set('store', storeId);
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const { data: userData, isLoading: isUserLoading, error: userError } = useGetMeQuery();
  const { data: listings = [] } = useGetListingsQuery(undefined, { skip: false });

  useLoading(isDashboardLoading || isUserLoading);

  const isTR = i18n.language === 'tr';
  const { locale, currency } = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);
  const periodDates = useMemo(() => computePeriodDates(locale), [locale]);

  const handleFormatCurrency = useCallback(
    (value: number) => formatCurrency(value, locale, currency),
    [locale, currency],
  );
  const handleFormatCompactCurrency = useCallback((value: number) => formatCompactNumber(value, locale), [locale]);
  const handleFormatDate = useCallback((dateString: string) => formatDate(dateString, locale), [locale]);

  const handlePeriodPresetChange = useCallback((preset: PeriodPreset) => {
    setPeriodPreset(preset);
    // Auto-select matching period card
    if (preset === 'today') { setSelectedPeriod('today'); }
    else if (preset === 'week') { setSelectedPeriod('thisMonth'); }
    else { setSelectedPeriod('thisMonth'); }
  }, []);

  const handleListingSelect = useCallback((listingId: string | null) => {
    setFilteredListingId(listingId);
    setSearchQuery('');
  }, []);

  useEffect(() => {
    const error = dashboardError || userError;
    if (!error) { return; }
    if ('status' in error && error.status === 401) { return; }
    showMessage(
      { type: 'error', headerKey: 'translation:message.error.header', descriptionKey: getErrorI18nKey(error), primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage } },
      t,
    );
  }, [dashboardError, userError, showMessage, closeMessage, t]);

  // Filter listings by search
  const filteredListings = useMemo(() => {
    if (!searchQuery.trim()) { return listings; }
    const q = searchQuery.toLowerCase();
    return listings.filter((l) =>
      l.title.toLowerCase().includes(q) || l.asin.toLowerCase().includes(q)
    );
  }, [listings, searchQuery]);

  return (
    <EbayAccountGuard>
      <DashboardPageComponent
        user={userData || null}
        dashboardData={dashboardData}
        selectedPeriod={selectedPeriod}
        onPeriodSelect={setSelectedPeriod}
        periodPreset={periodPreset}
        onPeriodPresetChange={handlePeriodPresetChange}
        selectedDays={selectedDays}
        onDaysChange={(days) => {
          // Map days back to closest preset
          if (days <= 7) { setPeriodPreset('today'); }
          else if (days <= 14) { setPeriodPreset('week'); }
          else { setPeriodPreset('month'); }
        }}
        periodDates={periodDates}
        listings={filteredListings}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredListingId={filteredListingId}
        onListingSelect={handleListingSelect}
        ebayAccounts={ebayAccounts}
        selectedStoreId={selectedStoreId}
        onStoreSelect={handleStoreSelect}
        isTR={isTR}
        formatCurrency={handleFormatCurrency}
        formatCompactCurrency={handleFormatCompactCurrency}
        formatDate={handleFormatDate}
      />
    </EbayAccountGuard>
  );
};
