import type { EbayAccountPublicDto } from '@repo/shared';

import type { EbayStoreCardView } from '@/features/settings/components/EbayAccountCard';

export interface EbayAccountsAllDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  accounts: EbayAccountPublicDto[];
}

export interface EbayAccountsAllDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  stores: EbayStoreCardView[];
}
