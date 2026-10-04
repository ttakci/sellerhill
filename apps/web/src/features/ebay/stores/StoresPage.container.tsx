import { SUPPORTED_EBAY_MARKETPLACES, type EbayAccountPublicDto, type EbayMarketplaceId } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetEbayAccountsQuery, useLazyGetEbayConnectUrlQuery } from '../api/ebayApi';
import { getEbayMarketplaceOptions } from '../utils/ebayMarketplaceOptions';

import { StoresPageComponent } from './StoresPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';

export const StoresPageContainer = (): React.ReactElement => {
  const { showMessage, closeMessage } = useUI();
  const { t, i18n } = useTranslation(['ebay', 'translation']);
  const [selectedMarketplace, setSelectedMarketplace] = useState<EbayMarketplaceId>(
    SUPPORTED_EBAY_MARKETPLACES[0]
  );

  const [getConnectUrl, { isLoading: isConnecting }] = useLazyGetEbayConnectUrlQuery();
  const { data: accountsData, isLoading } = useGetEbayAccountsQuery();

  /* useLoading is for BLOCKING MUTATIONS only. The initial query flags used
     to be folded in here, so the global overlay covered the whole app on
     first paint of this page instead of the page showing its own state. */
  useLoading(false);

  const [reconnectingId, setReconnectingId] = useState<string | null>(null);

  const handleReconnect = (account: EbayAccountPublicDto): void => {
    setReconnectingId(account.id);
    void getConnectUrl({ marketplaceId: account.marketplaceId })
      .unwrap()
      .then((result) => {
        // Demo mode answers with an empty URL: stay on the page.
        if (!result.url) {
          setReconnectingId(null);
          return;
        }
        window.location.href = result.url;
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        setReconnectingId(null);
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

  const handleConnect = (): void => {
    void getConnectUrl({ marketplaceId: selectedMarketplace })
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
      onReconnect={handleReconnect}
      reconnectingId={reconnectingId}
      marketplaceOptions={getEbayMarketplaceOptions(t)}
      selectedMarketplace={selectedMarketplace}
      onMarketplaceChange={setSelectedMarketplace}
    />
  );
};
