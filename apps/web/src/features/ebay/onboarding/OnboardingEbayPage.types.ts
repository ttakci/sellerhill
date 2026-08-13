/**
 * OnboardingEbayPage Types
 */

import type { EbayMarketplaceId } from '@repo/shared';

import type { EbayMarketplaceOption } from '@/domain-ui/ConnectEbayPrompt/ConnectEbayPrompt.types';

export interface OnboardingEbayPageProps {
  onConnect: () => void;
  isLoading: boolean;
  onSkip: () => void;
  marketplaceOptions: EbayMarketplaceOption[];
  selectedMarketplace: EbayMarketplaceId;
  onMarketplaceChange: (value: EbayMarketplaceId) => void;
}
