/**
 * DashboardPage Container (Smart Component)
 *
 * Purpose: Handle dashboard logic and authentication check
 */

import { useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useGetMeQuery } from '@/features/auth/api/authApi';
import { getErrorMessage } from '@/utils/errorHandler';
import { useGetDashboardQuery } from '../api/dashboardApi';
import { DashboardPageComponent } from './DashboardPage.component';

export const DashboardPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showMessage, closeMessage } = useUI();

  const { data: dashboardData, error: dashboardError } = useGetDashboardQuery();
  const { data: userData, isLoading, error: userError } = useGetMeQuery();

  // Handle errors
  useEffect(() => {
    const error = dashboardError || userError;
    if (error) {
      // Ignore 401 as it's handled by baseApi and AppLayout
      if ('status' in error && error.status === 401) {
        return;
      }

      // Show other errors
      const { key, params } = getErrorMessage(error);
      showMessage(
        {
          type: 'error',
          headerKey: 'message.error.header',
          descriptionKey: key,
          descriptionParams: params,
          primaryButton: {
            labelKey: 'message.error.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [dashboardError, userError, navigate, showMessage, closeMessage, t]);

  const handleConnectEbay = (): void => {
    navigate('/ebay/connect');
  };

  return (
    <DashboardPageComponent
      user={userData || null}
      isLoading={isLoading}
      onConnectEbay={handleConnectEbay}
    />
  );
};
