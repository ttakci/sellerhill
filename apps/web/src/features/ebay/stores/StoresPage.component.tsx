import { Button, Card, EmptyState, Icon, PageHeader, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './StoresPage.style';
import type { StoresPageComponentProps } from './StoresPage.types';

export const StoresPageComponent = ({
  accounts,
  isLoading,
  isConnecting,
  onConnect,
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
                  <Icon name="storefront" size={24} color="semantic.success" />
                </S.StoreIconWrapper>
                <StatusBadge status={account.status} size="sm" />
              </S.StoreCardHeader>
              <S.StoreCardBody>
                <Text variant="h4" weight="semibold">{account.storeName || account.sellerId}</Text>
                <Text variant="body-sm" color="text.secondary">{account.sellerId}</Text>
              </S.StoreCardBody>
              <S.StoreMeta>
                <Text variant="caption" color="text.tertiary">{account.marketplaceId}</Text>
              </S.StoreMeta>
            </Card>
          ))}
        </S.StoresGrid>
      ) : (
        <Card variant="bordered" padding="lg">
          <S.EmptyStateInner>
            <S.EmptyIconWrapper>
              <Icon name="storefront" size={40} color="brand.primary" />
            </S.EmptyIconWrapper>
            <Text variant="h3" weight="semibold">{t('ebay.accounts.noAccounts')}</Text>
            <S.EmptyDesc variant="body" color="text.secondary">
              {t('ebay.onboarding.description')}
            </S.EmptyDesc>
            <Button variant="primary" onClick={onConnect} isLoading={isConnecting}>
              <Text variant="body" weight="semibold">{t('ebay.connect.connectButton')}</Text>
            </Button>
          </S.EmptyStateInner>
        </Card>
      )}
    </S.Container>
  );
};
