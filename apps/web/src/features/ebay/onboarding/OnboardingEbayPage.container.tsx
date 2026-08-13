/**
 * OnboardingEbayPage Container (Smart Component)
 *
 * Purpose: Handle eBay onboarding logic — US marketplace only.
 */

import { SUPPORTED_EBAY_MARKETPLACES, type EbayMarketplaceId } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLazyGetEbayConnectUrlQuery } from '../api/ebayApi';
import { getEbayMarketplaceOptions } from '../utils/ebayMarketplaceOptions';

import { OnboardingEbayPageComponent } from './OnboardingEbayPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

export const OnboardingEbayPageContainer = (): React.ReactElement => {
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { t, i18n } = useTranslation(['ebay', 'translation']);
  const [selectedMarketplace, setSelectedMarketplace] = useState<EbayMarketplaceId>(
    SUPPORTED_EBAY_MARKETPLACES[0]
  );

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
    void getConnectUrl({ marketplaceId: selectedMarketplace });
  };

  const handleSkip = (): void => {
    localeNavigate('/dashboard');
  };

  return (
    <OnboardingEbayPageComponent
      onConnect={handleConnect}
      isLoading={isLoading}
      onSkip={handleSkip}
      marketplaceOptions={getEbayMarketplaceOptions(t)}
      selectedMarketplace={selectedMarketplace}
      onMarketplaceChange={setSelectedMarketplace}
    />
  );
};

export default OnboardingEbayPageContainer;
