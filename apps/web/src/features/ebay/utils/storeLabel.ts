import type { EbayAccountPublicDto } from '@repo/shared';

/**
 * The one name a seller-facing surface gives an eBay store: the store name the
 * seller set, else the eBay username, else eBay's opaque id (never blank).
 * Same order the store filters and `StoresPage` use.
 */
export const getStoreLabel = (
  account: Pick<EbayAccountPublicDto, 'id' | 'storeName' | 'ebayUsername' | 'sellerId'>
): string => account.storeName || account.ebayUsername || account.sellerId || account.id;
