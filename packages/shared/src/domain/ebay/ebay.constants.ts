/**
 * eBay Domain Constants
 */

import { EbayAccountStatus, EbayMarketplaceId } from './ebay.types';

/**
 * eBay account statuses
 */
export const EBAY_ACCOUNT_STATUS: Record<string, EbayAccountStatus> = {
  ACTIVE: EbayAccountStatus.ACTIVE,
  REVOKED: EbayAccountStatus.REVOKED,
  ERROR: EbayAccountStatus.ERROR,
} as const;

/**
 * eBay marketplace identifiers
 */
export const EBAY_MARKETPLACE: Record<string, EbayMarketplaceId> = {
  US: EbayMarketplaceId.EBAY_US,
  UK: EbayMarketplaceId.EBAY_UK,
  DE: EbayMarketplaceId.EBAY_DE,
  FR: EbayMarketplaceId.EBAY_FR,
  IT: EbayMarketplaceId.EBAY_IT,
  ES: EbayMarketplaceId.EBAY_ES,
} as const;

/**
 * eBay marketplace configuration
 */
export interface EbayMarketplaceConfig {
  id: EbayMarketplaceId;
  countryCode: string; // ISO 3166-1 alpha-2
  currency: string;
  siteId: string; // eBay Site ID (e.g., 0 for US, 3 for UK)
}

export const EBAY_MARKETPLACE_CONFIG: Record<EbayMarketplaceId, EbayMarketplaceConfig> = {
  [EbayMarketplaceId.EBAY_US]: {
    id: EbayMarketplaceId.EBAY_US,
    countryCode: 'US',
    currency: 'USD',
    siteId: '0',
  },
  [EbayMarketplaceId.EBAY_UK]: {
    id: EbayMarketplaceId.EBAY_UK,
    countryCode: 'GB',
    currency: 'GBP',
    siteId: '3',
  },
  [EbayMarketplaceId.EBAY_DE]: {
    id: EbayMarketplaceId.EBAY_DE,
    countryCode: 'DE',
    currency: 'EUR',
    siteId: '77',
  },
  [EbayMarketplaceId.EBAY_FR]: {
    id: EbayMarketplaceId.EBAY_FR,
    countryCode: 'FR',
    currency: 'EUR',
    siteId: '71',
  },
  [EbayMarketplaceId.EBAY_IT]: {
    id: EbayMarketplaceId.EBAY_IT,
    countryCode: 'IT',
    currency: 'EUR',
    siteId: '101',
  },
  [EbayMarketplaceId.EBAY_ES]: {
    id: EbayMarketplaceId.EBAY_ES,
    countryCode: 'ES',
    currency: 'EUR',
    siteId: '186',
  },
};

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
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  ],
  
  // Token expiration (in seconds)
  ACCESS_TOKEN_EXPIRES_IN: 7200, // 2 hours
  REFRESH_TOKEN_EXPIRES_IN: 47304000, // 18 months
} as const;

export type EbayOAuthConstantsType = typeof EBAY_OAUTH_CONSTANTS;
