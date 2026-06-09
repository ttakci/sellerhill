/**
 * EbayConnectPage Container (Smart Component)
 *
 * Purpose: Handle eBay connection logic
 */

import { EbayMarketplaceId } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetEbayAccountsQuery, useLazyGetEbayConnectUrlQuery } from '../api/ebayApi';

import { EbayConnectPageComponent } from './EbayConnectPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';

export const EbayConnectPageContainer = (): React.ReactElement => {
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();

  const [getConnectUrl, { isLoading, error: urlError }] = useLazyGetEbayConnectUrlQuery();
  const { data: accountsData } = useGetEbayAccountsQuery();

  useLoading(isLoading);

  useEffect(() => {
    if (!urlError) {return;}
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(urlError),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      i18n.t.bind(i18n)
    );
  }, [urlError, showMessage, closeMessage, i18n]);

  const handleConnect = (): void => {
    void getConnectUrl({ marketplaceId: EbayMarketplaceId.EBAY_US })
      .unwrap()
      .then((result) => {
        window.location.href = result.url;
      });
  };

  return (
    <EbayConnectPageComponent
      onConnect={handleConnect}
      connectedAccounts={accountsData?.total || 0}
      isLoading={isLoading}
    />
  );
};
