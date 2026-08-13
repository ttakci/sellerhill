/**
 * Amazon Domain Constants
 */

import { AmazonMarketplace } from './amazon.enums';

/**
 * Amazon marketplace configuration. Mirrors EbayMarketplaceConfig
 * (packages/shared/src/domain/ebay/ebay.constants.ts) shape-for-shape.
 */
export interface AmazonMarketplaceConfig {
  id: AmazonMarketplace;
  countryCode: string; // ISO 3166-1 alpha-2
  currency: string;
  /** Storefront TLD, e.g. "amazon.com" — used to build https://www.<domain> URLs. */
  domain: string;
  /** Keepa's numeric `domain` request param (keepacom/api_backend: 1=com, 2=co.uk, 3=de, ...). */
  keepaDomainId: number;
}

export const AMAZON_MARKETPLACE_CONFIG: Record<AmazonMarketplace, AmazonMarketplaceConfig> = {
  [AmazonMarketplace.AMAZON_US]: {
    id: AmazonMarketplace.AMAZON_US,
    countryCode: 'US',
    currency: 'USD',
    domain: 'amazon.com',
    keepaDomainId: 1,
  },
};

/**
 * Marketplaces actually offered in any selector and accepted by
 * AmazonAccountsService.create — separate from AMAZON_MARKETPLACE_CONFIG so a
 * config entry can exist without silently becoming selectable/enforced. This
 * is the single place that gates what's live; enabling a second Amazon
 * marketplace later is one array entry here (plus real config data above),
 * never a new code path.
 */
export const SUPPORTED_AMAZON_MARKETPLACES: readonly AmazonMarketplace[] = [
  AmazonMarketplace.AMAZON_US,
] as const;
