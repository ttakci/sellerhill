import { PlatformSettingCategory, UserRole } from '@repo/shared';
import { formatDate, formatMicroCurrency, getLocaleConfig } from '@repo/ui';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';

import {
  useGetAdminBillingMetricsQuery,
  useGetAdminOperationsQuery,
  useGetAdminOverviewQuery,
  useGetAdminProviderCostsQuery,
  useGetAdminProxiesQuery,
  useGetAdminUsersQuery,
} from '../api/admin.api';
import { useAdminProxyColumns } from '../hooks/useAdminProxyColumns';
import { useAdminProxyForm } from '../hooks/useAdminProxyForm';
import { useAdminSettings } from '../hooks/useAdminSettings';
import { useAdminUserColumns } from '../hooks/useAdminUserColumns';

import { AdminPageComponent } from './AdminPage.component';
import type { AdminTabId, SettingGroup } from './AdminPage.types';

import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useLocale } from '@/utils/useLocale';

const VALID_TABS: AdminTabId[] = [
  'overview',
  'queues',
  'costs',
  'proxies',
  'settings',
  'billing',
  'users',
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
];

export const AdminPageContainer = (): React.ReactElement => {
  const { buildPath } = useLocale();
  const { i18n } = useTranslation(['admin', 'translation']);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: user, isLoading } = useGetMeQuery();
  const skip = isLoading || user?.role !== UserRole.ADMIN;
  const { data: overview } = useGetAdminOverviewQuery(undefined, { skip });
  const { data: operations } = useGetAdminOperationsQuery(undefined, { skip });
  const { data: providerCosts = [] } = useGetAdminProviderCostsQuery(undefined, { skip });
  const { data: billingMetrics } = useGetAdminBillingMetricsQuery(undefined, { skip });
  const { data: proxyPool } = useGetAdminProxiesQuery(undefined, { skip });
  const { data: usersList } = useGetAdminUsersQuery(undefined, { skip });

  const proxy = useAdminProxyForm();
  const settings = useAdminSettings(skip);

  const tabParam = searchParams.get('tab') as AdminTabId | null;
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'overview';
  const handleTabChange = useCallback((tab: AdminTabId) => setSearchParams({ tab }), [setSearchParams]);

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
  const proxyColumns = useAdminProxyColumns(
    formatCost,
    formatDateValue,
    proxy.onProxyToggleStatus,
    proxy.isSavingProxy
  );

  if (!isLoading && user?.role !== UserRole.ADMIN) {
    return <Navigate to={buildPath('/dashboard')} replace />;
  }

  return (
    <AdminPageComponent
      activeTab={activeTab}
      overview={overview}
      operations={operations}
      providerCosts={providerCosts}
      billingMetrics={billingMetrics}
      proxyPool={proxyPool}
      usersList={usersList}
      userColumns={userColumns}
      proxyColumns={proxyColumns}
      settingGroups={settingGroups}
      settingDrafts={settings.settingDrafts}
      isSavingSetting={settings.isSavingSetting}
      emailTestResult={settings.emailTestResult}
      isTestingEmail={settings.isTestingEmail}
      proxyForm={proxy.proxyForm}
      isSavingProxy={proxy.isSavingProxy}
      onTabChange={handleTabChange}
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
