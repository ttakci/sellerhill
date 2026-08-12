/**
 * OnboardingEbayPage Component (Presentation)
 *
 * Purpose: Marketplace connection onboarding — post-login flow.
 * Renders the same ConnectEbayPrompt molecule used by EbayAccountGuard and
 * StoresPage's empty state, so the "connect eBay" screen looks identical
 * everywhere it appears.
 */

import { PageHeader } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './OnboardingEbayPage.style';
import type { OnboardingEbayPageProps } from './OnboardingEbayPage.types';

import { ConnectEbayPrompt } from '@/domain-ui';

export const OnboardingEbayPageComponent = ({
  onConnect,
  onSkip,
  isLoading,
}: OnboardingEbayPageProps): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);

  return (
    <S.Container>
      <PageHeader title={t('ebay:ebay.onboarding.header')} />
      <ConnectEbayPrompt
        onConnect={onConnect}
        onSkip={onSkip}
        isLoading={isLoading}
        footnote={t('ebay:ebay.onboarding.usOnlyNote')}
      />
    </S.Container>
  );
};
