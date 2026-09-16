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
  /** Severs a store's connection (the caller confirms first). */
  onDisconnect: (storeId: string) => void;
  /** Id of the store whose disconnect request is currently in flight. */
  disconnectingId?: string | null;
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
  onDisconnect: (storeId: string) => void;
  disconnectingId?: string | null;
  marketplaceOptions: EbayMarketplaceOption[];
  selectedMarketplace: EbayMarketplaceId;
  onMarketplaceChange: (value: EbayMarketplaceId) => void;
}
