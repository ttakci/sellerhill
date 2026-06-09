import type { EbayAccountPublicDto } from '@repo/shared';

export interface StoresPageComponentProps {
  accounts: EbayAccountPublicDto[];
  isConnecting: boolean;
  onConnect: () => void;
}
