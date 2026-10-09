import { Button, Icon, ModernSelect, Text } from '@repo/ui';
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

  // Skip is the only secondary action. A "deactivate my account" button used to
  // live here for a seller with no store connected; it is gone (operator
  // decision, 2026-09-17) — leaving is done by cancelling the subscription in
  // the Stripe portal, and self-service deactivation offered a destructive
  // action to someone who had simply not finished connecting yet.
  return (
    <S.Layout className={className}>
      <S.Hero variant="bordered" padding="none">
        <S.Head>
          <S.IconDisc>
            <Icon name="link" size={24} color="text.inverse" />
          </S.IconDisc>
          <S.Copy>
            <Text variant="h2" weight="bold">{t('ebay:ebay.accounts.noAccounts')}</Text>
            <Text variant="body" color="text.secondary">
              {t('ebay:ebay.onboarding.description')}
            </Text>
          </S.Copy>
        </S.Head>
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
        <S.Actions>
          <Button variant="primary" size="medium" onClick={onConnect} isLoading={isLoading}>
            <Icon name="link" size={16} />
            <Text variant="body">{t('ebay:ebay.connect.connectButton')}</Text>
          </Button>
          {onSkip && (
            <Button variant="teal" size="medium" onClick={onSkip}>
              <Icon name="arrow-right" size={16} />
              <Text variant="body">{t('ebay:ebay.onboarding.skipButton')}</Text>
            </Button>
          )}
        </S.Actions>
        {footnote && (
          <S.Footnote>
            <Icon name="info" size={16} color="brand.primary" />
            <Text variant="body-sm" color="text.secondary">
              {footnote}
            </Text>
          </S.Footnote>
        )}
      </S.Hero>
    </S.Layout>
  );
};

ConnectEbayPrompt.displayName = 'ConnectEbayPrompt';
