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
}
