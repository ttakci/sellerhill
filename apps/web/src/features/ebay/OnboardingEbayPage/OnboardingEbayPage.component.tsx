import { EBAY_MARKETPLACE, type EbayMarketplaceId } from '@repo/shared';
import { Button } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './OnboardingEbayPage.style';
import type { OnboardingEbayPageProps } from './OnboardingEbayPage.types';

const marketplaces = [
  { id: EBAY_MARKETPLACE.US, name: 'USA', flag: '🇺🇸' },
  { id: EBAY_MARKETPLACE.UK, name: 'UK', flag: '🇬🇧' },
  { id: EBAY_MARKETPLACE.DE, name: 'Germany', flag: '🇩🇪' },
  { id: EBAY_MARKETPLACE.FR, name: 'France', flag: '🇫🇷' },
  { id: EBAY_MARKETPLACE.IT, name: 'Italy', flag: '🇮🇹' },
  { id: EBAY_MARKETPLACE.ES, name: 'Spain', flag: '🇪🇸' },
];

export const OnboardingEbayPageComponent: React.FC<OnboardingEbayPageProps> = ({
  onConnect,
  isLoading,
  selectedMarketplace,
  onMarketplaceChange,
  onSkip,
}) => {
  const { t } = useTranslation();

  return (
    <S.Container>
      <S.Card>
        <S.Header>
          <S.Title>{t('auth.onboarding.ebay.title')}</S.Title>
          <S.Subtitle>{t('auth.onboarding.ebay.description')}</S.Subtitle>
        </S.Header>

        <S.MarketplaceGrid>
          {marketplaces.map((m) => (
            <S.MarketplaceItem
              key={m.id}
              $selected={selectedMarketplace === m.id}
              onClick={() => onMarketplaceChange(m.id as EbayMarketplaceId)}
            >
              <S.FlagIcon>{m.flag}</S.FlagIcon>
              <S.MarketplaceName>{m.name}</S.MarketplaceName>
            </S.MarketplaceItem>
          ))}
        </S.MarketplaceGrid>

        <S.ActionContainer>
          <Button
            variant="primary"
            onClick={() => onConnect(selectedMarketplace)}
            isLoading={isLoading}
            fullWidth
          >
            {t('auth.onboarding.ebay.connectButton')}
          </Button>

          <S.SkipButton onClick={onSkip}>
            {t('auth.onboarding.ebay.skipinfo')}
          </S.SkipButton>
        </S.ActionContainer>
      </S.Card>
    </S.Container>
  );
};
