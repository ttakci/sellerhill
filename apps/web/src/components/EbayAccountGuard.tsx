import { SUPPORTED_EBAY_MARKETPLACES, type EbayMarketplaceId } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
import { useGetEbayAccountsQuery, useLazyGetEbayConnectUrlQuery } from '../features/ebay/api/ebayApi';
import { getErrorI18nKey } from '../utils/errorHandler';

import type {
  EbayAccountGuardProps,
  EbayAccountsQueryResult,
  EbayConnectUrlQueryTuple,
} from './EbayAccountGuard.types';

import { ConnectEbayPrompt } from '@/domain-ui';
import { getEbayMarketplaceOptions } from '@/features/ebay/utils/ebayMarketplaceOptions';
import { DeactivateAccountModal } from '@/features/settings/components/DeactivateAccountModal';

export const EbayAccountGuard = ({ children }: EbayAccountGuardProps): React.ReactElement => {
  const { showMessage, closeMessage } = useUI();
  const { t, i18n } = useTranslation(['ebay', 'translation']);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [selectedMarketplace, setSelectedMarketplace] = useState<EbayMarketplaceId>(
    SUPPORTED_EBAY_MARKETPLACES[0],
  );

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const accountsResult = useGetEbayAccountsQuery() as EbayAccountsQueryResult;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const connectResult = useLazyGetEbayConnectUrlQuery() as unknown as EbayConnectUrlQueryTuple;

  const [getConnectUrl, { isLoading: isConnectLoading, isSuccess, data }] = connectResult;
  const { data: accountsData, isLoading: isAccountsLoading, error: accountsError } = accountsResult;
  const connectError = connectResult[1].error;

  useLoading(isAccountsLoading || isConnectLoading);

  useEffect(() => {
    if (isSuccess && data?.url) {
      window.location.href = data.url;
    }
  }, [isSuccess, data]);

  useEffect(() => {
    const error = accountsError || connectError;
    if (!error) {
      return;
    }
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(error as Parameters<typeof getErrorI18nKey>[0]),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      i18n.t.bind(i18n),
    );
  }, [accountsError, connectError, showMessage, closeMessage, i18n]);

  if (isAccountsLoading || isConnectLoading) {
    return <div />;
  }

  const hasAccounts = (accountsData?.items?.length ?? 0) > 0;

  if (!hasAccounts) {
    return (
      <>
        <ConnectEbayPrompt
          onConnect={() => {
            void getConnectUrl({ marketplaceId: selectedMarketplace });
          }}
          onDeactivateAccount={() => setIsDeactivateModalOpen(true)}
          isLoading={isConnectLoading}
          marketplaceOptions={getEbayMarketplaceOptions(t)}
          selectedMarketplace={selectedMarketplace}
          onMarketplaceChange={setSelectedMarketplace}
        />
        <DeactivateAccountModal
          isOpen={isDeactivateModalOpen}
          onClose={() => setIsDeactivateModalOpen(false)}
        />
      </>
    );
  }

  return <>{children}</>;
};
