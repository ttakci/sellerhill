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

  // Only one marketplace is live today, so the picker would be a permanently
  // disabled single-option control. Keep it hidden while the selected value
  // still travels through `selectedMarketplace` state; the moment a second
  // entry lands in SUPPORTED_EBAY_MARKETPLACES the picker renders itself again.
  const showMarketplaceSelect = marketplaceOptions.length > 1;

  const onSecondaryAction = onDeactivateAccount ?? onSkip;
  const secondaryAction = onDeactivateAccount
    ? t('ebay:ebay.onboarding.deactivateAccountButton')
    : onSkip
      ? t('ebay:ebay.onboarding.skipButton')
      : undefined;

  return (
    <S.Layout>
      <S.StyledCard variant="bordered" padding="lg" className={className}>
        {showMarketplaceSelect && (
          <S.MarketplaceSelectWrapper>
            <ModernSelect
              label={t('ebay:ebay.connect.marketplaceLabel')}
              options={marketplaceOptions}
              value={selectedMarketplace}
              onChange={(value) => onMarketplaceChange(value as typeof selectedMarketplace)}
              fullWidth
            />
          </S.MarketplaceSelectWrapper>
        )}
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
      </S.StyledCard>
      {footnote && <S.Footnote type="info">{footnote}</S.Footnote>}
    </S.Layout>
  );
};

ConnectEbayPrompt.displayName = 'ConnectEbayPrompt';
