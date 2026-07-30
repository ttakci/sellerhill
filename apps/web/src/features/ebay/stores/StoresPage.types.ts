import type { EbayAccountPublicDto } from '@repo/shared';

export interface StoresPageComponentProps {
  accounts: EbayAccountPublicDto[];
  /** Initial fetch — rendered as a page-level state, never the global overlay. */
  isLoading: boolean;
  isConnecting: boolean;
  onConnect: () => void;
}
