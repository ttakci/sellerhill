import { Button, Card, Icon, PageHeader, StatusBadge, Text, useTheme } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './StoresPage.style';
import type { StoresPageComponentProps } from './StoresPage.types';

export const StoresPageComponent = ({
  accounts,
  isConnecting,
  onConnect,
}: StoresPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);
  const { theme } = useTheme();

  return (
    <S.Container>
      <PageHeader
        title={t('ebay.accounts.title')}
        subtitle=""
      />

      {accounts.length > 0 ? (
        <S.StoresGrid>
          {accounts.map((account) => (
            <Card key={account.id} variant="bordered" padding="lg">
              <S.StoreCardHeader>
                <S.StoreIconWrapper>
                  <Icon name="storefront" size={24} color={theme.colors.semantic.success} />
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
              <Icon name="storefront" size={40} color={theme.colors.brand.primary} />
            </S.EmptyIconWrapper>
            <Text variant="h3" weight="semibold">{t('ebay.accounts.noAccounts')}</Text>
            <S.EmptyDesc variant="body" color="text.secondary">
              {t('ebay.onboarding.description')}
            </S.EmptyDesc>
            <Button variant="primary" iconLeft="link" onClick={onConnect} isLoading={isConnecting}>
              {t('ebay.connect.connectButton')}
            </Button>
          </S.EmptyStateInner>
        </Card>
      )}
    </S.Container>
  );
};
