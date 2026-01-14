/**
 * eBay Domain Constants
 */

import type { EbayAccountStatus, EbayMarketplaceId } from './ebay.types';

/**
 * eBay account statuses
 */
export const EBAY_ACCOUNT_STATUS: Record<string, EbayAccountStatus> = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
  ERROR: 'error',
} as const;

/**
 * eBay marketplace identifiers
 */
export const EBAY_MARKETPLACE: Record<string, EbayMarketplaceId> = {
  US: 'EBAY_US',
  UK: 'EBAY_UK',
  DE: 'EBAY_DE',
  FR: 'EBAY_FR',
  IT: 'EBAY_IT',
  ES: 'EBAY_ES',
} as const;

/**
 * eBay OAuth constants
 */
export const EBAY_OAUTH_CONSTANTS = {
  AUTHORIZATION_URL_PROD: 'https://auth.ebay.com/oauth2/authorize',
  AUTHORIZATION_URL_SANDBOX: 'https://auth.sandbox.ebay.com/oauth2/authorize',
  TOKEN_URL_PROD: 'https://api.ebay.com/identity/v1/oauth2/token',
  TOKEN_URL_SANDBOX: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
  PRODUCTION_API_BASE_URL: 'https://apiz.ebay.com',
  SANDBOX_API_BASE_URL: 'https://apiz.sandbox.ebay.com',
  
  // Default scopes for seller operations
  DEFAULT_SCOPES: [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.marketing',
    'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
    'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
  ],
  
  // Token expiration (in seconds)
  ACCESS_TOKEN_EXPIRES_IN: 7200, // 2 hours
  REFRESH_TOKEN_EXPIRES_IN: 47304000, // 18 months
} as const;

export type EbayOAuthConstantsType = typeof EBAY_OAUTH_CONSTANTS;
