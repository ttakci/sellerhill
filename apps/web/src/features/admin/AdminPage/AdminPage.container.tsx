import { UserRole } from '@repo/shared';
import React, { useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import {
  useGetAdminBillingMetricsQuery,
  useGetAdminOperationsQuery,
  useGetAdminOverviewQuery,
  useGetAdminProviderCostsQuery,
  useGetAdminUserCostsQuery,
} from '../api/admin.api';

import { AdminPageComponent } from './AdminPage.component';
import type { AdminTabId } from './AdminPage.types';

import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useLocale } from '@/utils/useLocale';

const VALID_TABS: AdminTabId[] = ['queues', 'costs', 'billing', 'users'];

export const AdminPageContainer = (): React.ReactElement => {
  const { buildPath } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user, isLoading } = useGetMeQuery();
  const skip = isLoading || user?.role !== UserRole.ADMIN;
  const { data: overview } = useGetAdminOverviewQuery(undefined, { skip });
  const { data: operations } = useGetAdminOperationsQuery(undefined, { skip });
  const { data: providerCosts = [] } = useGetAdminProviderCostsQuery(undefined, { skip });
  const { data: userCosts = [] } = useGetAdminUserCostsQuery(undefined, { skip });
  const { data: billingMetrics } = useGetAdminBillingMetricsQuery(undefined, { skip });
  const tabParam = searchParams.get('tab') as AdminTabId | null;
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'queues';
  const handleTabChange = useCallback((tab: AdminTabId) => setSearchParams({ tab }), [setSearchParams]);

  if (isLoading) {return <AdminPageComponent activeTab={activeTab} providerCosts={[]} userCosts={[]} onTabChange={handleTabChange} />;}
  if (user?.role !== UserRole.ADMIN) {return <Navigate to={buildPath('/dashboard')} replace />;}
  return (
    <AdminPageComponent
      activeTab={activeTab}
      overview={overview}
      operations={operations}
      providerCosts={providerCosts}
      userCosts={userCosts}
      billingMetrics={billingMetrics}
      onTabChange={handleTabChange}
    />
  );
};
