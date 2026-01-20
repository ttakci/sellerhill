/**
 * EbayConnectPage Component (Presentation)
 *
 * Purpose: Display eBay connection interface
 */

import { Button } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './EbayConnectPage.style';
import type { EbayConnectPageComponentProps } from './EbayConnectPage.types';

export const EbayConnectPageComponent = ({
  onConnect,
  isLoading,
  connectedAccounts,
}: EbayConnectPageComponentProps): React.ReactElement => {
  const { t } = useTranslation();

  return (
    <S.Container>
      <S.Card>
        <S.Header>
          <S.Title>{t('ebay.connect.title')}</S.Title>
          <S.Subtitle>{t('ebay.connect.subtitle')}</S.Subtitle>
        </S.Header>

        <S.Content>
          {connectedAccounts > 0 && (
            <S.Info>
              <S.InfoText>
                {t('ebay.accounts.title')}: {connectedAccounts}
              </S.InfoText>
            </S.Info>
          )}

          <S.ButtonContainer>
            <Button
              variant="primary"
              fullWidth
              onClick={onConnect}
              disabled={isLoading}
            >
              {isLoading ? t('ebay.connect.connectingButton') : t('ebay.connect.connectButton')}
            </Button>
          </S.ButtonContainer>
        </S.Content>
      </S.Card>
    </S.Container>
  );
};
