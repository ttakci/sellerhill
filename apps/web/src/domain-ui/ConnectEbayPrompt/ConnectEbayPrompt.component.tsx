import { EmptyState } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ConnectEbayPrompt.style';
import type { ConnectEbayPromptProps } from './ConnectEbayPrompt.types';

export const ConnectEbayPrompt = ({
  onConnect,
  onSkip,
  isLoading,
  footnote,
  className,
}: ConnectEbayPromptProps): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);

  return (
    <S.StyledCard variant="bordered" padding="lg" className={className}>
      <EmptyState
        icon="link"
        size="lg"
        title={t('ebay:ebay.accounts.noAccounts')}
        description={t('ebay:ebay.onboarding.description')}
        action={t('ebay:ebay.connect.connectButton')}
        onAction={onConnect}
        isActionLoading={isLoading}
        secondaryAction={onSkip ? t('ebay:ebay.onboarding.skipButton') : undefined}
        onSecondaryAction={onSkip}
      />
      {footnote && (
        <S.Footnote variant="caption" color="text.tertiary">
          {footnote}
        </S.Footnote>
      )}
    </S.StyledCard>
  );
};

ConnectEbayPrompt.displayName = 'ConnectEbayPrompt';
