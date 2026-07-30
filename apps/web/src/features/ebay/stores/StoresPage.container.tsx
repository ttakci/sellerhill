import { EbayMarketplaceId } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useGetEbayAccountsQuery, useLazyGetEbayConnectUrlQuery } from '../api/ebayApi';

import { StoresPageComponent } from './StoresPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';

export const StoresPageContainer = (): React.ReactElement => {
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();

  const [getConnectUrl, { isLoading: isConnecting }] = useLazyGetEbayConnectUrlQuery();
  const { data: accountsData, isLoading } = useGetEbayAccountsQuery();

  /* useLoading is for BLOCKING MUTATIONS only. The initial query flags used
     to be folded in here, so the global overlay covered the whole app on
     first paint of this page instead of the page showing its own state. */
  useLoading(false);

  const handleConnect = (): void => {
    void getConnectUrl({ marketplaceId: EbayMarketplaceId.EBAY_US })
      .unwrap()
      .then((result) => {
        window.location.href = result.url;
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          i18n.t.bind(i18n)
        );
      });
  };

  return (
    <StoresPageComponent
      accounts={accountsData?.items || []}
      isLoading={isLoading}
      isConnecting={isConnecting}
      onConnect={handleConnect}
    />
  );
};
