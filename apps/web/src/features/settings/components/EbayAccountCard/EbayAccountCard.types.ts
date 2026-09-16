import type { EbayAccountStatus } from '@repo/shared';

/**
 * Pre-formatted, presentation-ready view of a connected eBay store. The
 * mapper derives humanized marketplace, currency and a localized "connected
 * since" date so the card component stays free of formatters/logic.
 */
export interface EbayStoreCardView {
  id: string;
  displayName: string;
  sellerId: string;
  marketplaceLabel: string;
  currency: string;
  connectedSince: string;
  status: EbayAccountStatus;
}

export interface EbayAccountCardProps {
  store: EbayStoreCardView;
  /**
   * Severs the connection for this store. Optional: the card is also rendered
   * in contexts that only display connections, and omitting this simply hides
   * the action rather than rendering a dead control.
   */
  onDisconnect?: (storeId: string) => void;
  /** Disables the action while a disconnect request for this store is running. */
  isDisconnecting?: boolean;
}
