import { EBAY_MARKETPLACE, type EbayMarketplaceId } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { getErrorMessage } from '@/utils/errorHandler';
import { useLazyGetEbayConnectUrlQuery } from '../api/ebayApi';
import { OnboardingEbayPageComponent } from './OnboardingEbayPage.component';

export const OnboardingEbayPageContainer = (): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);
  const navigate = useNavigate();
  const { showMessage, closeMessage } = useUI();

  const [selectedMarketplace, setSelectedMarketplace] = useState<EbayMarketplaceId>(EBAY_MARKETPLACE.US);
  const [getConnectUrl, { isLoading, isSuccess, data, error }] = useLazyGetEbayConnectUrlQuery();

  useLoading(isLoading);

  // Handle success redirect
  React.useEffect(() => {
    if (isSuccess && data) {
      window.location.href = data.url;
    }
  }, [isSuccess, data]);

  // Handle error
  React.useEffect(() => {
    if (error) {
      const { key, params } = getErrorMessage(error as any);
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
  }, [error, showMessage, closeMessage, t]);

  const handleConnect = (marketplaceId: EbayMarketplaceId): void => {
    void getConnectUrl({ marketplaceId });
  };

  const handleSkip = (): void => {
    navigate('/dashboard');
  };

  return (
    <OnboardingEbayPageComponent
      onConnect={handleConnect}
      isLoading={isLoading}
      selectedMarketplace={selectedMarketplace}
      onMarketplaceChange={setSelectedMarketplace}
      onSkip={handleSkip}
    />
  );
};

export default OnboardingEbayPageContainer;
