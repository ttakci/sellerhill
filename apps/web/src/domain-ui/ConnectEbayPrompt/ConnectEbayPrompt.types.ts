import type { EbayMarketplaceId } from '@repo/shared';

export interface EbayMarketplaceOption {
  label: string;
  value: EbayMarketplaceId;
}

export interface ConnectEbayPromptProps {
  onConnect: () => void;
  onSkip?: () => void;
  /** Opens the account-deactivation flow instead of a skip action — takes priority over `onSkip` when both are provided. */
  onDeactivateAccount?: () => void;
  isLoading?: boolean;
  /** Extra caption rendered under the actions — e.g. the onboarding flow's marketplace-support note. */
  footnote?: string;
  className?: string;
  /**
   * Marketplace picker shown before the connect action. Only one option is
   * live today (see SUPPORTED_EBAY_MARKETPLACES in packages/shared), but the
   * control always renders so a second marketplace can be enabled later
   * without a UI rebuild.
   */
  marketplaceOptions: EbayMarketplaceOption[];
  selectedMarketplace: EbayMarketplaceId;
  onMarketplaceChange: (value: EbayMarketplaceId) => void;
}
