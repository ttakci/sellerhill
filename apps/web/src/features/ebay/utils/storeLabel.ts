import type { EbayAccountPublicDto } from '@repo/shared';

/**
 * The one name a seller-facing surface gives an eBay store: the store name the
 * seller set, else the eBay username, else eBay's opaque id (never blank).
 * Same order the store filters and `StoresPage` use.
 */
export const getStoreLabel = (
  account: Pick<EbayAccountPublicDto, 'id' | 'storeName' | 'ebayUsername' | 'sellerId'>
): string => account.storeName || account.ebayUsername || account.sellerId || account.id;

/**
 * The label of the store a record belongs to — but only when the seller has
 * more than one connected store. With a single store every record belongs to
 * it, so the row would only repeat the obvious; an unknown id (a disconnected
 * store, a legacy row) also resolves to `null` rather than a guess.
 */
export const resolveRecordStoreLabel = (
  accounts: Pick<EbayAccountPublicDto, 'id' | 'storeName' | 'ebayUsername' | 'sellerId'>[],
  ebayAccountId?: string | null
): string | null => {
  if (accounts.length <= 1 || !ebayAccountId) {
    return null;
  }
  const account = accounts.find((a) => a.id === ebayAccountId);
  return account ? getStoreLabel(account) : null;
};
