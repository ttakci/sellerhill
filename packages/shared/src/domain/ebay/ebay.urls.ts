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

export const AMAZON_SITE_URL = 'https://www.amazon.com';

/** Item page for an eBay listing id, in the given environment. */
export function buildEbayItemUrl(
  itemId: string,
  environment: EbayEnvironment = EbayEnvironment.PRODUCTION
): string {
  return `${EBAY_SITE_URL[environment] ?? EBAY_SITE_URL[EbayEnvironment.PRODUCTION]}/itm/${itemId}`;
}

/** Amazon product page for an ASIN (Amazon has no sandbox counterpart). */
export function buildAmazonProductUrl(asin: string): string {
  return `${AMAZON_SITE_URL}/dp/${asin}`;
}

/** Parse an env/config string into the enum, defaulting to production. */
export function resolveEbayEnvironment(value: string | undefined | null): EbayEnvironment {
  return value?.trim().toLowerCase() === EbayEnvironment.SANDBOX
    ? EbayEnvironment.SANDBOX
    : EbayEnvironment.PRODUCTION;
}
