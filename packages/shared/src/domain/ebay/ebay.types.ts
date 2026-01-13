/**
 * eBay Domain Types
 * Single source of truth for eBay integration types across frontend/backend
 */

import type { EbayAccountDto } from './ebay.dto';

/**
 * eBay account status
 */
export type EbayAccountStatus = 'active' | 'revoked' | 'error';

/**
 * eBay marketplace identifiers
 */
export type EbayMarketplaceId = 'EBAY_US' | 'EBAY_UK' | 'EBAY_DE' | 'EBAY_FR' | 'EBAY_IT' | 'EBAY_ES';

/**
 * Create eBay connect URL request
 */
export interface CreateEbayConnectUrlRequest {
  marketplaceId?: EbayMarketplaceId;
}

/**
 * Create eBay connect URL response
 */
export interface CreateEbayConnectUrlResponse {
  url: string;
  state: string;
}

/**
 * Get eBay accounts response
 */
export interface GetEbayAccountsResponse {
  items: EbayAccountDto[];
  total: number;
}

/**
 * eBay OAuth callback query parameters
 */
export interface EbayOAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}
