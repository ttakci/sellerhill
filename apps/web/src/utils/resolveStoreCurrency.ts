/**
 * Resolves the currency money should render in — from the seller's connected
 * eBay store marketplace, never from the UI language. eBay meters each store
 * to one marketplace (`ebay_accounts.marketplace_id`), and every marketplace
 * has exactly one currency (`EBAY_MARKETPLACE_CONFIG`), so this is the single
 * source of truth for "what currency is this sale/listing money in" anywhere
 * the domain object itself doesn't already carry its own `currency` field
 * (contrast `ListingDto.currency`, resolved server-side per listing).
 */

import { EBAY_MARKETPLACE_CONFIG, EbayMarketplaceId, type EbayAccountPublicDto } from '@repo/shared';

const DEFAULT_CURRENCY = EBAY_MARKETPLACE_CONFIG[EbayMarketplaceId.EBAY_US].currency;

/**
 * `ebayAccountId` narrows to one store (an active store filter, or an
 * order's own account). With no match — no id given, id not found, or no
 * connected stores at all — falls back to the first connected account, then
 * to the eBay US default.
 */
export const resolveStoreCurrency = (
  accounts: Pick<EbayAccountPublicDto, 'id' | 'marketplaceId'>[],
  ebayAccountId?: string | null
): string => {
  if (accounts.length === 0) {
    return DEFAULT_CURRENCY;
  }
  const account = (ebayAccountId && accounts.find((a) => a.id === ebayAccountId)) || accounts[0];
  return EBAY_MARKETPLACE_CONFIG[account.marketplaceId]?.currency ?? DEFAULT_CURRENCY;
};
