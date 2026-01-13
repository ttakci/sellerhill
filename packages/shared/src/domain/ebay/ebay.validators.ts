/**
 * eBay Domain Validators
 */

import { EBAY_ACCOUNT_STATUS, EBAY_MARKETPLACE } from './ebay.constants';
import type { EbayAccountStatus, EbayMarketplaceId } from './ebay.types';

/**
 * Validate eBay marketplace ID
 */
export const isValidMarketplaceId = (marketplaceId: string): marketplaceId is EbayMarketplaceId => {
  return Object.values(EBAY_MARKETPLACE).includes(marketplaceId as EbayMarketplaceId);
};

/**
 * Validate eBay account status
 */
export const isValidAccountStatus = (status: string): status is EbayAccountStatus => {
  return Object.values(EBAY_ACCOUNT_STATUS).includes(status as EbayAccountStatus);
};
