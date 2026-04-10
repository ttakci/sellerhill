/**
 * OnboardingEbayPage Component (Presentation)
 *
 * Purpose: Marketplace connection onboarding
 */

import { EBAY_MARKETPLACE } from '@repo/shared';
import { Button, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './OnboardingEbayPage.style';
import type { OnboardingEbayPageProps } from './OnboardingEbayPage.types';

export const OnboardingEbayPageComponent = ({
  selectedMarketplace,
  onMarketplaceChange,
  onConnect,
  onSkip,
  isLoading,
}: OnboardingEbayPageProps): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);

  const marketplaces = [
    { id: EBAY_MARKETPLACE.US, name: 'eBay US' },
    { id: EBAY_MARKETPLACE.TR, name: 'eBay TR (GittiGidiyor)' },
  ];

  return (
    <S.Container>
      <S.LayoutWrapper>
        {/* Left Panel: Content */}
        <S.LeftPanel>
          <S.AuthCard>
            <S.LogoWrapper>
              <Icon name="logo" size={48} color="brand.primary" />
              <S.LogoText variant="h2" weight="bold" color="brand.primary">
                {t('translation:common.brandName')}
              </S.LogoText>
            </S.LogoWrapper>

            <S.IconContainer>
              <Icon name="link" size={40} />
            </S.IconContainer>

            <S.Header>
              <S.PageTitle variant="h2" weight="bold">
                {t('ebay:ebay.onboarding.header')}
              </S.PageTitle>
              <Text variant="body" color="text.secondary">
                {t('ebay:ebay.onboarding.description')}
              </Text>
            </S.Header>

            <S.MarketplaceGrid>
              <S.MarketplaceItem
                $selected={selectedMarketplace === EBAY_MARKETPLACE.US}
                onClick={() => onMarketplaceChange(EBAY_MARKETPLACE.US)}
              >
                <Icon name="flag-us" size={20} />
                <S.MarketplaceName variant="body-sm" weight="medium">{t('ebay:ebay.connect.marketplaceUS')}</S.MarketplaceName>
              </S.MarketplaceItem>
              <S.MarketplaceItem
                $selected={selectedMarketplace === EBAY_MARKETPLACE.UK}
                onClick={() => onMarketplaceChange(EBAY_MARKETPLACE.UK)}
              >
                <Icon name="flag-gb" size={20} />
                <S.MarketplaceName variant="body-sm" weight="medium">{t('ebay:ebay.connect.marketplaceUK')}</S.MarketplaceName>
              </S.MarketplaceItem>
            </S.MarketplaceGrid>

            <S.ActionGroup>
              <Button
                onClick={() => onConnect(selectedMarketplace)}
                variant="primary"
                fullWidth
                size="large"
                isLoading={isLoading}
              >
                {t('ebay:ebay.onboarding.connectButton')}
              </Button>
              <Button onClick={onSkip} variant="secondary" fullWidth size="large">
                {t('ebay:ebay.onboarding.skipButton')}
              </Button>
            </S.ActionGroup>
          </S.AuthCard>
        </S.LeftPanel>

        {/* Right Panel: Branding */}
        <S.RightPanel>
          <S.MosaicDecor>
            <div className="box-1" />
            <div className="box-2" />
            <div className="box-3" />
            <div className="box-4" />
          </S.MosaicDecor>
          <S.BrandingContent>
            <S.BrandingLogoWrapper>
              <Icon name="logo" size={64} color="text.inverse" />
              <Text variant="h1" weight="bold" color="text.inverse">
                {t('translation:common.brandName')}
              </Text>
            </S.BrandingLogoWrapper>

            <Text variant="h3" weight="medium" color="text.inverse">
              {t('ebay:ebay.onboarding.title')}
            </Text>

            <S.BrandingDescription variant="body" color="text.inverse">
              {t('ebay:ebay.onboarding.brandingDescription')}
            </S.BrandingDescription>

            <S.BrandingIconContainer>
              <Icon name="store" size={200} color="text.inverse" />
            </S.BrandingIconContainer>
          </S.BrandingContent>
        </S.RightPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
