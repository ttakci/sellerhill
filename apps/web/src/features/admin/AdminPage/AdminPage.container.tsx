import { UserRole } from '@repo/shared';
import { formatDate, formatMicroCurrency, getLocaleConfig } from '@repo/ui';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';

import {
  useGetAdminBillingMetricsQuery,
  useGetAdminOperationsQuery,
  useGetAdminOverviewQuery,
  useGetAdminProviderCostsQuery,
  useGetAdminUsersQuery,
  useGetAdminEbayBudgetQuery,
  useGetAdminListingFailuresQuery,
} from '../api/admin.api';
import { useAdminEbayColumns } from '../hooks/useAdminEbayColumns';
import { useAdminListingQuality } from '../hooks/useAdminListingQuality';
import { useAdminUserColumns } from '../hooks/useAdminUserColumns';

import { AdminPageComponent } from './AdminPage.component';
import type { AdminTabId } from './AdminPage.types';

import { resolveHomePath } from '@/app/operatorRouting';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useLocale } from '@/utils/useLocale';

const VALID_TABS: AdminTabId[] = [
  'overview',
  'queues',
  'costs',
  'listingQuality',
  'settings',
  'billing',
  'users',
  'ebayLimits',
  'listingFailures',
];

/** Category render order — cost levers first, cosmetics last. */
export const AdminPageContainer = (): React.ReactElement => {
  const { buildPath } = useLocale();
  const { i18n } = useTranslation(['admin', 'translation']);
  /* The tab comes from the URL only — navigation between admin sections now
     happens through real sidebar links (OperatorLayout), not an in-page
     switcher, so this page never needs to write the query string itself. */
  const [searchParams] = useSearchParams();

  const { data: user, isLoading } = useGetMeQuery();
  const skip = isLoading || user?.role !== UserRole.ADMIN;
  const { data: overview } = useGetAdminOverviewQuery(undefined, { skip });
  const { data: operations } = useGetAdminOperationsQuery(undefined, { skip });
  const { data: providerCosts = [] } = useGetAdminProviderCostsQuery(undefined, { skip });
  const { data: billingMetrics } = useGetAdminBillingMetricsQuery(undefined, { skip });
  const { data: usersList } = useGetAdminUsersQuery(undefined, { skip });
  const { data: ebayBudget } = useGetAdminEbayBudgetQuery(undefined, { skip });
  const { data: listingFailures } = useGetAdminListingFailuresQuery(undefined, { skip });
  const listingQuality = useAdminListingQuality(skip);

  const tabParam = searchParams.get('tab') as AdminTabId | null;
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'overview';

  const { locale } = getLocaleConfig(i18n.language);
  const formatCost = useCallback(
    (micros: number | null, currency: string | null): string =>
      micros === null ? '—' : formatMicroCurrency(micros, locale, currency ?? 'USD'),
    [locale]
  );
  /* The Aquiline plan snapshot's `capturedAt` — null when no conversion has
     ever run, so the caption must render the same em-dash the figures do. */
  const formatCapturedAt = useCallback(
    (iso: string | null): string => (iso === null ? '—' : formatDate(iso, locale, { hour: 'numeric', minute: '2-digit' })),
    [locale]
  );
  /* Must sit above the role guard — hooks cannot be called after an early return. */
  const userColumns = useAdminUserColumns(formatCost);
  const { budgetColumns, failureColumns } = useAdminEbayColumns();

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
      usersList={usersList}
      ebayBudget={ebayBudget ?? []}
      listingFailures={listingFailures}
      userColumns={userColumns}
      budgetColumns={budgetColumns}
      failureColumns={failureColumns}
      skip={skip}
      formatCost={formatCost}
      formatCapturedAt={formatCapturedAt}
    />
  );
};
