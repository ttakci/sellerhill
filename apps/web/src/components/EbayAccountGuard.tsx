import { EBAY_MARKETPLACE, type CreateEbayConnectUrlResponse, type GetEbayAccountsResponse } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
import { useGetEbayAccountsQuery, useLazyGetEbayConnectUrlQuery } from '../features/ebay/api/ebayApi';
import { getErrorI18nKey } from '../utils/errorHandler';
import { useLocale } from '../utils/useLocale';

import { ConnectEbayPrompt } from '@/domain-ui';

interface EbayAccountGuardProps {
  children: React.ReactNode;
}

export const EbayAccountGuard = ({ children }: EbayAccountGuardProps): React.ReactElement => {
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const accountsResult = useGetEbayAccountsQuery() as {
    data?: GetEbayAccountsResponse;
    isLoading: boolean;
    error?: unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const connectResult = useLazyGetEbayConnectUrlQuery() as unknown as [
    (arg: { marketplaceId: string }) => unknown,
    { isLoading: boolean; isSuccess: boolean; data?: CreateEbayConnectUrlResponse; error?: unknown },
  ];

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
      <ConnectEbayPrompt
        onConnect={() => {
          void getConnectUrl({ marketplaceId: EBAY_MARKETPLACE.US });
        }}
        onSkip={() => {
          localeNavigate('/dashboard');
        }}
        isLoading={isConnectLoading}
      />
    );
  }

  return <>{children}</>;
};
