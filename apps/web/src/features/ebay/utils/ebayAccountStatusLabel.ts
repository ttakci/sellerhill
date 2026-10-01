import { EbayAccountStatus } from '@repo/shared';
import type { TFunction } from 'i18next';

/**
 * The one resolver for an eBay store's status label — `StatusBadge` otherwise
 * prints the raw enum value, which showed "Active" in every language.
 * `DISCONNECTED` rows are not listed anywhere, so it falls through to the
 * generic fallback like any value without a key.
 */
export const getEbayAccountStatusLabel = (status: EbayAccountStatus, t: TFunction): string => {
  switch (status) {
    case EbayAccountStatus.ACTIVE:
      return t('ebay:ebay.accounts.statusActive');
    case EbayAccountStatus.REVOKED:
      return t('ebay:ebay.accounts.statusRevoked');
    case EbayAccountStatus.ERROR:
      return t('ebay:ebay.accounts.statusError');
    default:
      return String(status);
  }
};
