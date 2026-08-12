import { PlatformSettingCategory, UserRole } from '@repo/shared';
import { formatDate, formatMicroCurrency, getLocaleConfig } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';

import {
  useGetAdminBillingMetricsQuery,
  useGetAdminOperationsQuery,
  useGetAdminOverviewQuery,
  useGetAdminProviderCostsQuery,
  useGetAdminProxiesQuery,
  useGetAdminUsersQuery,
  useGetAdminEbayBudgetQuery,
  useGetAdminListingFailuresQuery,
} from '../api/admin.api';
import { useAdminEbayColumns } from '../hooks/useAdminEbayColumns';
import { useAdminListingQuality } from '../hooks/useAdminListingQuality';
import { useAdminProxyColumns } from '../hooks/useAdminProxyColumns';
import { useAdminProxyForm } from '../hooks/useAdminProxyForm';
import { useAdminSettings } from '../hooks/useAdminSettings';
import { useAdminUserColumns } from '../hooks/useAdminUserColumns';

import { AdminPageComponent } from './AdminPage.component';
import type { AdminTabId, SettingGroup } from './AdminPage.types';

import { resolveHomePath } from '@/app/operatorRouting';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useLocale } from '@/utils/useLocale';

const VALID_TABS: AdminTabId[] = [
  'overview',
  'queues',
  'costs',
  'proxies',
  'listingQuality',
  'settings',
  'billing',
  'users',
  'ebayLimits',
  'listingFailures',
];

/** Category render order — cost levers first, cosmetics last. */
const CATEGORY_ORDER: PlatformSettingCategory[] = [
  PlatformSettingCategory.KEEPA,
  PlatformSettingCategory.LLM,
  PlatformSettingCategory.AMAZON,
  PlatformSettingCategory.AUTO_FULFILL,
  PlatformSettingCategory.BILLING,
  PlatformSettingCategory.BUYER_MESSAGING,
  PlatformSettingCategory.EMAIL,
  PlatformSettingCategory.ADMIN,
  PlatformSettingCategory.RETENTION,
];

export const AdminPageContainer = (): React.ReactElement => {
  const { buildPath } = useLocale();
  const { i18n } = useTranslation(['admin', 'translation']);
  /* The tab comes from the URL only — navigation between admin sections now
     happens through real sidebar links (OperatorLayout), not an in-page
     switcher, so this page never needs to write the query string itself. */
  const [searchParams] = useSearchParams();
  const [collapsedSettingCategories, setCollapsedSettingCategories] = useState<Set<PlatformSettingCategory>>(
    () => new Set()
  );

  const { data: user, isLoading } = useGetMeQuery();
  const skip = isLoading || user?.role !== UserRole.ADMIN;
  const { data: overview } = useGetAdminOverviewQuery(undefined, { skip });
  const { data: operations } = useGetAdminOperationsQuery(undefined, { skip });
  const { data: providerCosts = [] } = useGetAdminProviderCostsQuery(undefined, { skip });
  const { data: billingMetrics } = useGetAdminBillingMetricsQuery(undefined, { skip });
  const { data: proxyPool } = useGetAdminProxiesQuery(undefined, { skip });
  const { data: usersList } = useGetAdminUsersQuery(undefined, { skip });
  const { data: ebayBudget } = useGetAdminEbayBudgetQuery(undefined, { skip });
  const { data: listingFailures } = useGetAdminListingFailuresQuery(undefined, { skip });
  const listingQuality = useAdminListingQuality(skip);

  const proxy = useAdminProxyForm();
  const settings = useAdminSettings(skip);

  const tabParam = searchParams.get('tab') as AdminTabId | null;
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'overview';

  const handleToggleSettingCategory = useCallback((category: PlatformSettingCategory) => {
    setCollapsedSettingCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const settingGroups = useMemo<SettingGroup[]>(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        settings: settings.settings.filter((s) => s.category === category),
      })).filter((group) => group.settings.length > 0),
    [settings.settings]
  );

  const { locale } = getLocaleConfig(i18n.language);
  const formatCost = useCallback(
    (micros: number | null, currency: string | null): string =>
      micros === null ? '—' : formatMicroCurrency(micros, locale, currency ?? 'USD'),
    [locale]
  );
  const formatDateValue = useCallback(
    (iso: string | null): string => (iso ? formatDate(iso, locale, { year: 'numeric' }) : '—'),
    [locale]
  );

  /* Must sit above the role guard — hooks cannot be called after an early return. */
  const userColumns = useAdminUserColumns(formatCost);
  const { budgetColumns, failureColumns } = useAdminEbayColumns();
  const proxyColumns = useAdminProxyColumns(
    formatCost,
    formatDateValue,
    proxy.onProxyToggleStatus,
    proxy.isSavingProxy
  );

  /* A SUPPORT operator lands on the support console, a seller on its own app. */
  if (!isLoading && user?.role !== UserRole.ADMIN) {
    return <Navigate to={buildPath(resolveHomePath(user?.role, true))} replace />;
  }

  return (
    <AdminPageComponent
      activeTab={activeTab}
      listingQuality={listingQuality}
      overview={overview}
      operations={operations}
      providerCosts={providerCosts}
      billingMetrics={billingMetrics}
      proxyPool={proxyPool}
      usersList={usersList}
      ebayBudget={ebayBudget ?? []}
      listingFailures={listingFailures}
      userColumns={userColumns}
      budgetColumns={budgetColumns}
      failureColumns={failureColumns}
      proxyColumns={proxyColumns}
      settingGroups={settingGroups}
      collapsedSettingCategories={collapsedSettingCategories}
      onToggleSettingCategory={handleToggleSettingCategory}
      settingDrafts={settings.settingDrafts}
      isSavingSetting={settings.isSavingSetting}
      emailTestResult={settings.emailTestResult}
      isTestingEmail={settings.isTestingEmail}
      proxyForm={proxy.proxyForm}
      isSavingProxy={proxy.isSavingProxy}
      onProxyFieldChange={proxy.onProxyFieldChange}
      onProxySubmit={proxy.onProxySubmit}
      onSettingDraftChange={settings.onSettingDraftChange}
      onSettingSave={settings.onSettingSave}
      onSettingToggle={settings.onSettingToggle}
      onSettingReset={settings.onSettingReset}
      onEmailTest={settings.onEmailTest}
      formatCost={formatCost}
    />
  );
};
