/**
 * OnboardingEbayPage Component (Presentation)
 *
 * Purpose: Marketplace connection onboarding
 */

import { EBAY_MARKETPLACE, type EbayMarketplaceId } from '@repo/shared';
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
              <Text variant="h2" weight="bold" color="brand.primary" style={{ marginTop: '1rem' }}>
                Zonds
              </Text>
            </S.LogoWrapper>

            <S.IconContainer>
              <Icon name="link" size={40} />
            </S.IconContainer>

            <S.Header>
              <Text variant="h2" weight="bold">
                {t('ebay.onboarding.header')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('ebay.onboarding.description')}
              </Text>
            </S.Header>

            <S.MarketplaceGrid>
              {marketplaces.map((m) => (
                <S.MarketplaceItem
                  key={m.id}
                  $selected={selectedMarketplace === m.id}
                  onClick={() => onMarketplaceChange(m.id as EbayMarketplaceId)}
                >
                  <Icon name={`flag-${m.id === EBAY_MARKETPLACE.US ? 'us' : 'tr'}` as any} size={20} />
                  <S.MarketplaceName>{m.name}</S.MarketplaceName>
                </S.MarketplaceItem>
              ))}
            </S.MarketplaceGrid>

            <S.ActionGroup>
              <Button
                onClick={() => onConnect(selectedMarketplace)}
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isLoading}
              >
                {t('ebay.onboarding.connectButton')}
              </Button>
              <Button onClick={onSkip} variant="secondary" fullWidth size="lg">
                {t('ebay.onboarding.skipButton')}
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
                Zonds
              </Text>
            </S.BrandingLogoWrapper>
            
            <Text variant="h3" weight="medium" color="text.inverse">
              {t('ebay.onboarding.title')}
            </Text>
            
            <Text variant="body" color="text.inverse" style={{ opacity: 0.8 }}>
              Ebay mağazanızı Zonds'a bağlayarak tüm satış süreçlerinizi tek bir merkezden yönetmeye başlayın.
            </Text>

            <div style={{ marginTop: '2rem' }}>
              <Icon name="store" size={200} color="text.inverse" style={{ opacity: 0.1 }} />
            </div>
          </S.BrandingContent>
        </S.RightPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
