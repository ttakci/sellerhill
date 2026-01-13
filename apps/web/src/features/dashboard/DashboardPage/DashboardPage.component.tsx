/**
 * DashboardPage Component (Presentation)
 *
 * Purpose: Display dashboard home page (empty state for now)
 */

import { Button } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './DashboardPage.style';
import type { DashboardPageComponentProps } from './DashboardPage.types';

export const DashboardPageComponent = ({
  user,
  isLoading,
  onConnectEbay,
}: DashboardPageComponentProps): React.ReactElement => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <S.Container>
        <S.EmptyState>
          <S.EmptyStateText>{t('common.loading')}</S.EmptyStateText>
        </S.EmptyState>
      </S.Container>
    );
  }

  return (
    <S.Container>
      <S.Header>
        <S.Title>{t('dashboard.title')}</S.Title>
        <S.Subtitle>{t('dashboard.subtitle')}</S.Subtitle>
      </S.Header>

      {user && (
        <S.Greeting>
          {t('dashboard.greeting', { name: user.firstName })}
        </S.Greeting>
      )}

      <S.Content>
        <S.Card>
          <S.CardTitle>{t('dashboard.comingSoon')}</S.CardTitle>
          <S.CardDescription>{t('dashboard.description')}</S.CardDescription>

          <S.ButtonContainer>
            <Button variant="primary" fullWidth onClick={onConnectEbay}>
              {t('ebay.connect.connectButton')}
            </Button>
          </S.ButtonContainer>
        </S.Card>
      </S.Content>
    </S.Container>
  );
};
