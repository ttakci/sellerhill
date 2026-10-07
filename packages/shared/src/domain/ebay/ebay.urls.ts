import { AMAZON_MARKETPLACE_CONFIG } from '../amazon/amazon.constants';
import { AmazonMarketplace } from '../amazon/amazon.enums';

import { EbayEnvironment } from './ebay.types';

/**
 * Buyer-facing marketplace URL builders.
 *
 * Sandbox and production are separate sites with separate item id spaces:
 * `ebay.com/itm/<sandbox id>` is always a dead link. Every UI link to an eBay
 * item must therefore be built through `buildEbayItemUrl` with the environment
 * the app is pointed at — never by concatenating a hardcoded host.
 */

export const EBAY_SITE_URL: Record<EbayEnvironment, string> = {
  [EbayEnvironment.PRODUCTION]: 'https://www.ebay.com',
  [EbayEnvironment.SANDBOX]: 'https://sandbox.ebay.com',
};

/** Item page for an eBay listing id, in the given environment. */
export function buildEbayItemUrl(
  itemId: string,
  environment: EbayEnvironment = EbayEnvironment.PRODUCTION
): string {
  return `${EBAY_SITE_URL[environment] ?? EBAY_SITE_URL[EbayEnvironment.PRODUCTION]}/itm/${itemId}`;
}

/**
 * eBay's own "Cancel Details" page for a cancellation request.
 *
 * OBSERVED, NOT DOCUMENTED: the production URL is the one the operator's
 * browser showed on 2026-10-07 (`www.ebay.com/Cancel/Details?cancelId=…`);
 * no eBay API reference documents a seller-facing cancellation page URL. The
 * Sandbox host follows the same path by analogy and is unverified.
 */
const EBAY_CANCEL_DETAILS_URL: Record<EbayEnvironment, string> = {
  [EbayEnvironment.PRODUCTION]: 'https://www.ebay.com/Cancel/Details',
  [EbayEnvironment.SANDBOX]: 'https://www.sandbox.ebay.com/Cancel/Details',
};

export function buildEbayCancellationUrl(
  cancelId: string,
  environment: EbayEnvironment = EbayEnvironment.PRODUCTION
): string {
  const base = EBAY_CANCEL_DETAILS_URL[environment] ?? EBAY_CANCEL_DETAILS_URL[EbayEnvironment.PRODUCTION];
  return `${base}?cancelId=${encodeURIComponent(cancelId)}`;
}

/**
 * Amazon storefront base URL for a marketplace (Amazon has no sandbox
 * counterpart — one storefront per marketplace, always live).
 */
export function buildAmazonSiteUrl(
  marketplace: AmazonMarketplace = AmazonMarketplace.AMAZON_US
): string {
  return `https://www.${AMAZON_MARKETPLACE_CONFIG[marketplace].domain}`;
}

/** Amazon product page for an ASIN in the given marketplace. */
export function buildAmazonProductUrl(
  asin: string,
  marketplace: AmazonMarketplace = AmazonMarketplace.AMAZON_US
): string {
  return `${buildAmazonSiteUrl(marketplace)}/dp/${asin}`;
}

/** Parse an env/config string into the enum, defaulting to production. */
export function resolveEbayEnvironment(value: string | undefined | null): EbayEnvironment {
  return value?.trim().toLowerCase() === EbayEnvironment.SANDBOX
    ? EbayEnvironment.SANDBOX
    : EbayEnvironment.PRODUCTION;
}
