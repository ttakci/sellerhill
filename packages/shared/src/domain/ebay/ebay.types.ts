/**
 * eBay Domain Types
 * Single source of truth for eBay integration types across frontend/backend
 */

import type { EbayAccountPublicDto } from './ebay.dto';

/**
 * eBay account status
 */
export enum EbayAccountStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  ERROR = 'error',
  /**
   * The SELLER deliberately severed this connection from our own UI — not a
   * failure. Kept distinct from REVOKED because the Action Center treats
   * REVOKED as a CRITICAL "fix your broken connection" alarm, and an alarm
   * raised by an intentional action is one the seller can never clear.
   *
   * The row survives (orders cascade off it, listings reference it), its
   * tokens are nulled, and every token accessor's `status = 'active'` filter
   * is what actually stops all background work for the store.
   */
  DISCONNECTED = 'disconnected',
}

/**
 * eBay marketplace identifiers
 */
export enum EbayMarketplaceId {
  EBAY_US = 'EBAY_US',
  EBAY_UK = 'EBAY_UK',
  EBAY_DE = 'EBAY_DE',
  EBAY_FR = 'EBAY_FR',
  EBAY_IT = 'EBAY_IT',
  EBAY_ES = 'EBAY_ES',
}

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
 * Get eBay accounts response - uses public DTO (no tokens)
 */
export interface GetEbayAccountsResponse {
  items: EbayAccountPublicDto[];
  total: number;
}

/**
 * Which eBay environment the deployment talks to.
 *
 * Sandbox listings do NOT exist on ebay.com — a production item URL for a
 * sandbox item id resolves to "listing not found", so every buyer-facing eBay
 * link has to be built against the environment the listing was published in.
 */
export enum EbayEnvironment {
  PRODUCTION = 'production',
  SANDBOX = 'sandbox',
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
