import type { EbayMarketplaceId } from '@repo/shared';

export interface OnboardingEbayPageProps {
  onConnect: (marketplaceId: EbayMarketplaceId) => void;
  isLoading: boolean;
  selectedMarketplace: EbayMarketplaceId;
  onMarketplaceChange: (marketplaceId: EbayMarketplaceId) => void;
  onSkip: () => void;
}
