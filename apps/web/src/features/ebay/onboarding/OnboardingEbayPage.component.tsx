/**
 * OnboardingEbayPage Component (Presentation)
 *
 * Purpose: Marketplace connection onboarding — post-login flow.
 * Follows the same container pattern as EbayConnectPage / StoreSettingsPage.
 */

import { Button, Card, Icon, PageHeader, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './OnboardingEbayPage.style';
import type { OnboardingEbayPageProps } from './OnboardingEbayPage.types';

export const OnboardingEbayPageComponent = ({
  onConnect,
  onSkip,
  isLoading,
}: OnboardingEbayPageProps): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);

  return (
    <S.Container>
      <PageHeader title={t('ebay:ebay.onboarding.header')} subtitle={t('ebay:ebay.onboarding.description')} />

      <Card padding="lg">
        <S.Content>
          <S.IconWrapper>
            <Icon name="link" size={32} />
          </S.IconWrapper>

          <S.ActionGroup>
            <Button onClick={onConnect} variant="primary" fullWidth size="large" isLoading={isLoading}>
              <Text>{t('ebay:ebay.onboarding.connectButton')}</Text>
            </Button>
            <Button onClick={onSkip} variant="secondary" fullWidth size="large">
              <Text>{t('ebay:ebay.onboarding.skipButton')}</Text>
            </Button>
          </S.ActionGroup>

          <S.Note variant="caption" color="text.tertiary">
            {t('ebay:ebay.onboarding.usOnlyNote')}
          </S.Note>
        </S.Content>
      </Card>
    </S.Container>
  );
};
