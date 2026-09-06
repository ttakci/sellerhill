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

  /**
   * The connect-URL request resolves in a few hundred ms, then we assign
   * `window.location.href` and the browser starts a full-page navigation to
   * eBay. By that point RTK Query's `isLoading` has already flipped back to
   * false, so the global overlay and the button spinner would go idle right
   * when the page freezes for the redirect — the click reads as "nothing
   * happened". Holding `isSuccess` in the flag keeps the feedback up from the
   * click straight through to unload; `error` drops it so a failed attempt
   * releases the UI instead of spinning forever.
   */
  const isConnecting = (isLoading || isSuccess) && !error;

  useLoading(isConnecting);

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
    if (isConnecting) {return;}
    void getConnectUrl({ marketplaceId: selectedMarketplace });
  };

  const handleSkip = (): void => {
    localeNavigate('/dashboard');
  };

  return (
    <OnboardingEbayPageComponent
      onConnect={handleConnect}
      isLoading={isConnecting}
      onSkip={handleSkip}
      marketplaceOptions={getEbayMarketplaceOptions(t)}
      selectedMarketplace={selectedMarketplace}
      onMarketplaceChange={setSelectedMarketplace}
    />
  );
};

export default OnboardingEbayPageContainer;
