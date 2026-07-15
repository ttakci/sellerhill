import type { EbayAccountPublicDto, EbayAccountStatus } from '@repo/shared';

export interface EbayAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: EbayAccountPublicDto[];
}

/**
 * Pre-formatted, presentation-ready view of a connected eBay store.
 * The container derives humanized marketplace, currency and a localized
 * "connected since" date so the component stays free of formatters/logic.
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

export interface EbayAccountDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  stores: EbayStoreCardView[];
}
