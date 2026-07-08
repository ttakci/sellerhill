import type { EbayAccountPublicDto } from '@repo/shared';

export interface EbayAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: EbayAccountPublicDto[];
  onConnect: () => void;
}
