/**
 * OnboardingEbayPage Container (Smart Component)
 *
 * Purpose: Handle eBay onboarding logic — US marketplace only.
 */

import { EBAY_MARKETPLACE } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useLazyGetEbayConnectUrlQuery } from '../api/ebayApi';

import { OnboardingEbayPageComponent } from './OnboardingEbayPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

export const OnboardingEbayPageContainer = (): React.ReactElement => {
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();

  const [getConnectUrl, { isLoading, isSuccess, data, error }] = useLazyGetEbayConnectUrlQuery();

  useLoading(isLoading);

  useEffect(() => {
    if (isSuccess && data) {window.location.href = data.url;}
  }, [isSuccess, data]);

  useEffect(() => {
    if (!error) {return;}
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(error),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      i18n.t.bind(i18n)
    );
  }, [error, showMessage, closeMessage, i18n]);

  const handleConnect = (): void => {
    void getConnectUrl({ marketplaceId: EBAY_MARKETPLACE.US });
  };

  const handleSkip = (): void => {
    localeNavigate('/dashboard');
  };

  return <OnboardingEbayPageComponent onConnect={handleConnect} isLoading={isLoading} onSkip={handleSkip} />;
};

export default OnboardingEbayPageContainer;
