/**
 * EbayConnectPage Component (Presentation)
 *
 * Purpose: Display eBay connection interface
 */

import { Button, Card, PageHeader } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './EbayConnectPage.style';
import type { EbayConnectPageComponentProps } from './EbayConnectPage.types';

export const EbayConnectPageComponent = ({
  onConnect,
  isLoading,
  connectedAccounts,
}: EbayConnectPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);

  return (
    <S.Container>
      <Card padding="lg">
        <PageHeader title={t('ebay.connect.title')} subtitle={t('ebay.connect.subtitle')} />

        <S.Content>
          {connectedAccounts > 0 && (
            <S.Info>
              <S.InfoText variant="body-sm" color="text.secondary">
                {t('ebay.accounts.title')}: {connectedAccounts}
              </S.InfoText>
            </S.Info>
          )}

          <S.ButtonContainer>
            <Button variant="primary" fullWidth onClick={onConnect} isLoading={isLoading}>
              {isLoading ? t('ebay.connect.connectingButton') : t('ebay.connect.connectButton')}
            </Button>
          </S.ButtonContainer>
        </S.Content>
      </Card>
    </S.Container>
  );
};
