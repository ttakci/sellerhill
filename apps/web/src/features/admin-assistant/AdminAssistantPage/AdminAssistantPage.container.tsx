import React from 'react';

import { useGetAdminAssistantOverviewQuery, useGetAdminAssistantQueuesQuery, useGetAdminAssistantUsageQuery } from '../api/adminAssistant.api';

import { AdminAssistantPageComponent } from './AdminAssistantPage.component';

export const AdminAssistantPage = (): React.ReactElement => {
  const overview = useGetAdminAssistantOverviewQuery();
  const queues = useGetAdminAssistantQueuesQuery();
  const usage = useGetAdminAssistantUsageQuery();
  return <AdminAssistantPageComponent isLoading={overview.isLoading || queues.isLoading || usage.isLoading} overview={overview.data ?? null} queues={queues.data ?? []} usage={usage.data ?? []} />;
};
