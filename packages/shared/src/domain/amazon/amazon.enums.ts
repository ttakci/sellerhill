export enum AmazonAccountStatus {
  ACTIVE = 'active',
  VERIFYING = 'verifying',
  INVALID = 'invalid',
  NEEDS_REAUTH = 'needs_reauth',
  LOCKED = 'locked',
}

/**
 * Amazon marketplace (buyer-account storefront/country). Mirrors the shape
 * of EbayMarketplaceId (packages/shared/src/domain/ebay/ebay.types.ts), but
 * ships with a single member: unlike eBay's SiteID table (already fully
 * known for 6 real markets), a second Amazon marketplace's Keepa domain id
 * and TLD are undecided product scope — fabricating that config now would be
 * building support for a country nobody has chosen. Adding a real one later
 * is one enum member + one AMAZON_MARKETPLACE_CONFIG entry + one
 * SUPPORTED_AMAZON_MARKETPLACES entry (see amazon.constants.ts), not a new
 * code path.
 */
export enum AmazonMarketplace {
  AMAZON_US = 'AMAZON_US',
}
