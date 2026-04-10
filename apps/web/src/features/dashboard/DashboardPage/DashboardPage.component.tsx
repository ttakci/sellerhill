/**
 * DashboardPage Component (Presentation)
 *
 * Purpose: Display dashboard home page (empty state for now)
 */

import { Button, Card, PageHeader } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './DashboardPage.style';
import type { DashboardPageComponentProps } from './DashboardPage.types';

export const DashboardPageComponent = ({
  user,
  isLoading,
  onConnectEbay,
}: DashboardPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard', 'translation', 'ebay']);

  const greetingSubtitle = user
    ? t('dashboard:dashboard.greeting', { name: user.firstName })
    : t('dashboard:dashboard.subtitle');

  if (isLoading) {
    return (
      <S.Container>
        <S.EmptyState>
          <S.EmptyStateText variant="body" color="text.secondary">{t('translation:common.loading')}</S.EmptyStateText>
        </S.EmptyState>
      </S.Container>
    );
  }

  return (
    <S.Container>
      <PageHeader
        title={t('dashboard:dashboard.title')}
        subtitle={greetingSubtitle}
      />

      <S.Content>
        <Card variant="bordered" padding="lg">
          <S.CardTitle variant="h3" weight="semibold">{t('dashboard:dashboard.comingSoon')}</S.CardTitle>
          <S.CardDescription variant="body" color="text.secondary">{t('dashboard:dashboard.description')}</S.CardDescription>

          <S.ButtonContainer>
            <Button variant="primary" fullWidth onClick={onConnectEbay}>
              {t('ebay:ebay.connect.connectButton')}
            </Button>
          </S.ButtonContainer>
        </Card>
      </S.Content>
    </S.Container>
  );
};
