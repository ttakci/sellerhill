/**
 * DashboardPage Container (Smart Component)
 *
 * Purpose: Handle dashboard logic and authentication check
 */

import { formatCompactNumber, formatCurrency, formatDate, getLocaleConfig, useLoading, useUI } from '@repo/ui';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useGetDashboardQuery } from '../api/dashboardApi';

import { DashboardPageComponent } from './DashboardPage.component';

import { useGetMeQuery } from '@/features/auth/api/authApi';
import { getErrorMessage } from '@/utils/errorHandler';

export const DashboardPageContainer = (): React.ReactElement => {
  const { t, i18n } = useTranslation(['translation']);
  const navigate = useNavigate();
  const { showMessage, closeMessage } = useUI();

  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useGetDashboardQuery();
  const { data: userData, isLoading: isUserLoading, error: userError } = useGetMeQuery();

  useLoading(isDashboardLoading || isUserLoading);

  const isTR = i18n.language === 'tr';
  const { locale, currency } = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const handleFormatCurrency = useCallback(
    (value: number) => formatCurrency(value, locale, currency),
    [locale, currency]
  );

  const handleFormatCompactCurrency = useCallback((value: number) => formatCompactNumber(value, locale), [locale]);

  const handleFormatDate = useCallback((dateString: string) => formatDate(dateString, locale), [locale]);

  // Handle errors
  useEffect(() => {
    const error = dashboardError || userError;
    if (error) {
      if ('status' in error && error.status === 401) {
        return;
      }

      const { key, params } = getErrorMessage(error);
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: key,
          descriptionParams: params,
          primaryButton: {
            labelKey: 'translation:message.error.close',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [dashboardError, userError, navigate, showMessage, closeMessage, t]);

  const handleConnectEbay = (): void => {
    void navigate('/ebay/connect');
  };

  const handleViewAllOrders = (): void => {
    void navigate('/orders');
  };

  return (
    <DashboardPageComponent
      user={userData || null}
      dashboardData={dashboardData}
      isLoading={isUserLoading}
      onConnectEbay={handleConnectEbay}
      onViewAllOrders={handleViewAllOrders}
      isTR={isTR}
      formatCurrency={handleFormatCurrency}
      formatCompactCurrency={handleFormatCompactCurrency}
      formatDate={handleFormatDate}
    />
  );
};
