/**
 * EbayConnectPage Container (Smart Component)
 *
 * Purpose: Handle eBay connection logic
 */

import { useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '@/utils/errorHandler';
import { useGetEbayAccountsQuery, useLazyGetEbayConnectUrlQuery } from '../api/ebayApi';
import { EbayConnectPageComponent } from './EbayConnectPage.component';

export const EbayConnectPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();

  const [getConnectUrl, { isLoading: isGettingUrl, error: urlError }] = useLazyGetEbayConnectUrlQuery();
  const { data: accountsData } = useGetEbayAccountsQuery();

  // Handle error
  useEffect(() => {
    if (urlError) {
      const { key, params } = getErrorMessage(urlError);
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
  }, [urlError, showMessage, closeMessage, t]);

  const handleConnect = async (): Promise<void> => {
    try {
      const result = await getConnectUrl({ marketplaceId: 'EBAY_US' }).unwrap();
      
      // Redirect to eBay OAuth consent page
      window.location.href = result.url;
    } catch (err) {
      // Error handled by useEffect
      console.error('Failed to get eBay connect URL:', err);
    }
  };

  return (
    <EbayConnectPageComponent
      onConnect={handleConnect}
      isLoading={isGettingUrl}
      connectedAccounts={accountsData?.total || 0}
    />
  );
};
