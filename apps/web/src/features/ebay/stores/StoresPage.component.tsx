import { EbayAccountStatus } from '@repo/shared';
import { Button, Card, EmptyState, PageHeader, StatusBadge, Text, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { getEbayAccountStatusLabel } from '../utils/ebayAccountStatusLabel';

import * as S from './StoresPage.style';
import type { StoresPageComponentProps } from './StoresPage.types';

import { ConnectEbayPrompt } from '@/domain-ui';
import { getEbayMarketplaceLabel } from '@/features/ebay/utils/ebayMarketplaceOptions';

export const StoresPageComponent = ({
  accounts,
  isLoading,
  isConnecting,
  onConnect,
  onReconnect,
  reconnectingId,
  marketplaceOptions,
  selectedMarketplace,
  onMarketplaceChange,
}: StoresPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);

  return (
    <S.Container>
      {/* `subtitle=""` was passed with no matching i18n key — an empty subtitle
          slot that only added a gap under the title. */}
      <PageHeader title={t('ebay.accounts.title')} />

      {isLoading ? (
        <Card variant="bordered" padding="lg">
          <EmptyState
            icon="storefront"
            title={t('translation:common.loading')}
            description={t('ebay.accounts.loadingDescription')}
          />
        </Card>
      ) : accounts.length > 0 ? (
        <S.StoresGrid>
          {accounts.map((account) => (
            <Card key={account.id} variant="bordered" padding="lg">
              <S.StoreCardHeader>
                <S.StoreIconWrapper>
                  <Text variant="body-sm" weight="semibold">eBay</Text>
                </S.StoreIconWrapper>
                <StatusBadge status={account.status} size="sm">
                  {getEbayAccountStatusLabel(account.status, t)}
                </StatusBadge>
              </S.StoreCardHeader>
              <S.StoreCardBody>
                <Text variant="h4" weight="semibold">{account.storeName || account.ebayUsername || account.sellerId}</Text>
                <Text variant="body-sm" color="text.secondary">{account.ebayUsername || account.sellerId}</Text>
              </S.StoreCardBody>
              <S.StoreMeta>
                <Text variant="caption" color="text.tertiary">
                  {getEbayMarketplaceLabel(t, account.marketplaceId)}
                </Text>
              </S.StoreMeta>
              {(account.status === EbayAccountStatus.ACTIVE || account.status === EbayAccountStatus.REVOKED) && (
                <S.StoreActions>
                  <Tooltip content={t('translation:settingsHub.sections.ebay.reconnect.hint')} position="top" variant="dark">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => onReconnect(account)}
                      isLoading={reconnectingId === account.id}
                    >
                      <Text variant="body-sm" weight="semibold">
                        {t('translation:settingsHub.sections.ebay.reconnect.action')}
                      </Text>
                    </Button>
                  </Tooltip>
                </S.StoreActions>
              )}
            </Card>
          ))}
        </S.StoresGrid>
      ) : (
        <ConnectEbayPrompt
          onConnect={onConnect}
          isLoading={isConnecting}
          marketplaceOptions={marketplaceOptions}
          selectedMarketplace={selectedMarketplace}
          onMarketplaceChange={onMarketplaceChange}
        />
      )}
    </S.Container>
  );
};
