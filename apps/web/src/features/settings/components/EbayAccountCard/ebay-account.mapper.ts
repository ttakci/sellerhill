import { EBAY_MARKETPLACE_CONFIG, type EbayAccountPublicDto, type EbayMarketplaceId } from '@repo/shared';
import { formatDate } from '@repo/ui';

import type { EbayStoreCardView } from './EbayAccountCard.types';

/** "EBAY_US" -> "eBay US", "EBAY_UK" -> "eBay UK" */
const marketplaceLabel = (id: EbayMarketplaceId): string => `eBay ${id.replace('EBAY_', '')}`;

export const toEbayStoreCardView = (account: EbayAccountPublicDto, locale: string): EbayStoreCardView => ({
  id: account.id,
  displayName: account.storeName || account.sellerId,
  sellerId: account.sellerId,
  marketplaceLabel: marketplaceLabel(account.marketplaceId),
  currency: EBAY_MARKETPLACE_CONFIG[account.marketplaceId]?.currency ?? '—',
  connectedSince: formatDate(account.createdAt, locale, { year: 'numeric' }),
  status: account.status,
});
