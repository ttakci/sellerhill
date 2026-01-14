import { EBAY_MARKETPLACE, type EbayMarketplaceId } from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { getErrorMessage } from '@/utils/errorHandler';
import { useLazyGetEbayConnectUrlQuery } from '../api/ebayApi';
import { OnboardingEbayPageComponent } from './OnboardingEbayPage.component';

export const OnboardingEbayPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showMessage, closeMessage } = useUI();

  const [selectedMarketplace, setSelectedMarketplace] = useState<EbayMarketplaceId>(EBAY_MARKETPLACE.US);
  const [getConnectUrl, { isLoading }] = useLazyGetEbayConnectUrlQuery();

  const handleConnect = async (marketplaceId: EbayMarketplaceId): Promise<void> => {
    try {
      const result = await getConnectUrl({ marketplaceId }).unwrap();
      
      // Redirect to eBay OAuth consent page
      window.location.href = result.url;
    } catch (err) {
      const { key, params } = getErrorMessage(err as any);
      showMessage({
        type: 'error',
        headerKey: 'message.error.header',
        descriptionKey: key,
        descriptionParams: params,
        primaryButton: {
          labelKey: 'message.error.ok',
          onClick: closeMessage,
        },
      }, t);
    }
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
