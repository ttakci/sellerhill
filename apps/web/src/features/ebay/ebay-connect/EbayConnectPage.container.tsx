/**
 * EbayConnectPage Container (Smart Component)
 *
 * Purpose: Handle eBay connection logic
 */

import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '@/utils/errorHandler';
import { useGetEbayAccountsQuery, useLazyGetEbayConnectUrlQuery } from '../api/ebayApi';
import { EbayConnectPageComponent } from './EbayConnectPage.component';

export const EbayConnectPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();

  const [getConnectUrl, { isLoading, error: urlError }] = useLazyGetEbayConnectUrlQuery();
  const { data: accountsData } = useGetEbayAccountsQuery();

  // Use RTK Query loading state with useLoading hook
  useLoading(isLoading);

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
    const result = await getConnectUrl({ marketplaceId: 'EBAY_US' }).unwrap();

    // Redirect to eBay OAuth consent page
    // Error is handled by RTK Query and the useEffect above
    window.location.href = result.url;
  };

  return (
    <EbayConnectPageComponent
      onConnect={handleConnect}
      connectedAccounts={accountsData?.total || 0}
      isLoading={isLoading}
    />
  );
};
