import { EmptyState, ModernSelect } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ConnectEbayPrompt.style';
import type { ConnectEbayPromptProps } from './ConnectEbayPrompt.types';

export const ConnectEbayPrompt = ({
  onConnect,
  onSkip,
  onDeactivateAccount,
  isLoading,
  footnote,
  className,
  marketplaceOptions,
  selectedMarketplace,
  onMarketplaceChange,
}: ConnectEbayPromptProps): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);

  const onSecondaryAction = onDeactivateAccount ?? onSkip;
  const secondaryAction = onDeactivateAccount
    ? t('ebay:ebay.onboarding.deactivateAccountButton')
    : onSkip
      ? t('ebay:ebay.onboarding.skipButton')
      : undefined;

  return (
    <S.StyledCard variant="bordered" padding="lg" className={className}>
      <S.MarketplaceSelectWrapper>
        <ModernSelect
          label={t('ebay:ebay.connect.marketplaceLabel')}
          options={marketplaceOptions}
          value={selectedMarketplace}
          onChange={(value) => onMarketplaceChange(value as typeof selectedMarketplace)}
          isDisabled={marketplaceOptions.length <= 1}
          fullWidth
        />
      </S.MarketplaceSelectWrapper>
      <EmptyState
        icon="link"
        size="lg"
        title={t('ebay:ebay.accounts.noAccounts')}
        description={t('ebay:ebay.onboarding.description')}
        action={t('ebay:ebay.connect.connectButton')}
        onAction={onConnect}
        isActionLoading={isLoading}
        secondaryAction={secondaryAction}
        onSecondaryAction={onSecondaryAction}
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
