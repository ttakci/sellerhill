import type { EbayAccountPublicDto, EbayMarketplaceId } from '@repo/shared';

import type { EbayMarketplaceOption } from '@/domain-ui/ConnectEbayPrompt/ConnectEbayPrompt.types';

export interface StoresPageComponentProps {
  accounts: EbayAccountPublicDto[];
  /** Initial fetch — rendered as a page-level state, never the global overlay. */
  isLoading: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  marketplaceOptions: EbayMarketplaceOption[];
  selectedMarketplace: EbayMarketplaceId;
  onMarketplaceChange: (value: EbayMarketplaceId) => void;
}
