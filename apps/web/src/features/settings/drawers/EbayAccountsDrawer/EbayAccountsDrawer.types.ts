import type { EbayAccountPublicDto, EbayMarketplaceId } from '@repo/shared';

import type { EbayMarketplaceOption } from '@/domain-ui/ConnectEbayPrompt/ConnectEbayPrompt.types';
import type { EbayStoreCardView } from '@/features/settings/components/EbayAccountCard';

export interface EbayAccountsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: EbayAccountPublicDto[];
  /** Opens the eBay OAuth connect flow (closes this drawer first). */
  onConnectNew: () => void;
  /** Opens the full accounts list drawer. */
  onViewAll: () => void;
  marketplaceOptions: EbayMarketplaceOption[];
  selectedMarketplace: EbayMarketplaceId;
  onMarketplaceChange: (value: EbayMarketplaceId) => void;
}

export interface EbayAccountsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  stores: EbayStoreCardView[];
  onConnectNew: () => void;
  onViewAll: () => void;
  marketplaceOptions: EbayMarketplaceOption[];
  selectedMarketplace: EbayMarketplaceId;
  onMarketplaceChange: (value: EbayMarketplaceId) => void;
}
