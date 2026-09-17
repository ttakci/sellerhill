import { EBAY_MARKETPLACE_CONFIG, type EbayAccountPublicDto } from '@repo/shared';
import { formatDate } from '@repo/ui';
import type { TFunction } from 'i18next';

import type { EbayStoreCardView } from './EbayAccountCard.types';

import { getEbayMarketplaceLabel } from '@/features/ebay/utils/ebayMarketplaceOptions';

export const toEbayStoreCardView = (
  account: EbayAccountPublicDto,
  locale: string,
  t: TFunction
): EbayStoreCardView => ({
  id: account.id,
  // sellerId is eBay's opaque immutable id since migration 108 — show the
  // username wherever a person reads it, and fall back to the id only when
  // eBay returned no username at all.
  displayName: account.storeName || account.ebayUsername || account.sellerId,
  sellerId: account.ebayUsername || account.sellerId,
  // Same i18n keys the marketplace picker resolves through (getEbayMarketplaceOptions)
  // — this used to be its own drifted "eBay US"-style formatter.
  marketplaceLabel: getEbayMarketplaceLabel(t, account.marketplaceId),
  currency: EBAY_MARKETPLACE_CONFIG[account.marketplaceId]?.currency ?? '—',
  connectedSince: formatDate(account.createdAt, locale, { year: 'numeric' }),
  status: account.status,
});
