import {
  EBAY_DESCRIPTION_MAX_LENGTH,
  EBAY_INVENTORY_DESCRIPTION_MAX_LENGTH,
  EBAY_MARKETPLACE_CONFIG,
  EBAY_MAX_IMAGES,
  EBAY_NOT_APPLICABLE,
  EBAY_TITLE_MAX_LENGTH,
  type ListingCreationData,
} from '@repo/shared';

import { isValidGtin, normalizeGtin } from '../../common/utils/gtin';
import { truncateHtml } from '../../common/utils/sanitize';

import { type AspectResolution } from './aspect-builder';
import { resolveEbayCondition } from './listing-condition';

/**
 * The two eBay Inventory-API request bodies, built in one place.
 *
 * They are pure functions rather than methods on the client because the same
 * bodies are sent by the single-item path (`PUT /inventory_item/{sku}`,
 * `POST /offer`) and the batched path (`bulk_create_or_replace_inventory_item`,
 * `bulk_create_offer`). Two copies would drift, and the fields encoded here are
 * exactly the ones that have historically broken live listings — the BrandMPN
 * pair, GTIN validation, tag-safe truncation and the image floor. A listing
 * published through the bulk path must be byte-for-byte the listing the single
 * path would have published.
 */

export type EbayMarketplaceConfig = (typeof EBAY_MARKETPLACE_CONFIG)['EBAY_US'];

/** eBay refuses a listing with no picture, so a placeholder is used as a last resort. */
export const EBAY_PLACEHOLDER_IMAGE = 'https://via.placeholder.com/600x600?text=No+Image+Available';

export interface InventoryItemPayload {
  availability: { shipToLocationAvailability: { quantity: number } };
  condition: string;
  product: Record<string, unknown>;
}

/**
 * Catalog identifiers, after the checks that keep eBay from rejecting the publish.
 *
 * - A GTIN must pass its GS1 check digit; a malformed UPC fails the whole publish.
 * - A barcode is never an MPN. Amazon fills `partNumber` with the UPC for most
 *   grocery ASINs and eBay answers `MPN has an invalid value of "0215000...".
 * - eBay validates Brand and MPN as a PAIR: a brand with no MPN fails with
 *   "Input data for tag <BrandMPN> is invalid or missing", so when no usable
 *   part number survives we send eBay's own documented non-value.
 */
export function resolveCatalogIdentifiers(data: ListingCreationData): {
  upc?: string;
  ean?: string;
  mpn?: string;
} {
  const upc = normalizeGtin(data.identifiers?.upc);
  const ean = normalizeGtin(data.identifiers?.ean);

  const rawMpn = data.identifiers?.mpn?.trim();
  const brandText = data.brand?.trim().toLowerCase();
  const usableMpn =
    rawMpn && !isValidGtin(rawMpn) && (!brandText || rawMpn.toLowerCase() !== brandText) ? rawMpn : undefined;

  return {
    ...(upc ? { upc } : {}),
    ...(ean ? { ean } : {}),
    ...(usableMpn ? { mpn: usableMpn } : data.brand?.trim() ? { mpn: EBAY_NOT_APPLICABLE } : {}),
  };
}

/** Buyer-facing gallery images, capped and validated; never empty. */
export function resolveImageUrls(data: ListingCreationData): { imageUrls: string[]; usedPlaceholder: boolean } {
  const valid = (data.imageUrls || []).filter(
    (url: string) => url && typeof url === 'string' && url.startsWith('http')
  );

  return valid.length === 0
    ? { imageUrls: [EBAY_PLACEHOLDER_IMAGE], usedPlaceholder: true }
    : { imageUrls: valid.slice(0, EBAY_MAX_IMAGES), usedPlaceholder: false };
}

/** Body for `PUT /inventory_item/{sku}` and each `bulk_create_or_replace_inventory_item` entry. */
export function buildInventoryItemPayload(
  data: ListingCreationData,
  resolution: AspectResolution
): { payload: InventoryItemPayload; usedPlaceholderImage: boolean } {
  const identifiers = resolveCatalogIdentifiers(data);
  const { imageUrls, usedPlaceholder } = resolveImageUrls(data);

  return {
    usedPlaceholderImage: usedPlaceholder,
    payload: {
      availability: { shipToLocationAvailability: { quantity: data.quantity || 1 } },
      condition: resolveEbayCondition(data.title),
      product: {
        title: data.title ? data.title.substring(0, EBAY_TITLE_MAX_LENGTH) : 'New Product',
        // Inventory-item description is catalog metadata capped at 4,000 chars —
        // the buyer-visible copy is the offer's listingDescription (500,000).
        // Truncated at a tag boundary so a cut never leaves broken markup.
        description: data.description
          ? truncateHtml(data.description, EBAY_INVENTORY_DESCRIPTION_MAX_LENGTH)
          : '',
        aspects: resolution.aspects,
        ...(data.brand ? { brand: data.brand.substring(0, 65) } : {}),
        ...(identifiers.mpn ? { mpn: identifiers.mpn.substring(0, 65) } : {}),
        ...(identifiers.upc ? { upc: [identifiers.upc] } : {}),
        ...(identifiers.ean ? { ean: [identifiers.ean] } : {}),
        imageUrls,
      },
    },
  };
}

export interface OfferPayload {
  sku: string;
  marketplaceId: string;
  format: string;
  availableQuantity: number;
  categoryId: string;
  listingDescription: string;
  listingPolicies: { fulfillmentPolicyId: string; paymentPolicyId: string; returnPolicyId: string };
  merchantLocationKey: string;
  pricingSummary: { price: { currency: string; value: string } };
  quantityLimitPerBuyer: number;
}

/** Body for `POST /offer` and each `bulk_create_offer` entry. */
export function buildOfferPayload(args: {
  sku: string;
  data: ListingCreationData;
  policies: { paymentId: string; shippingId: string; returnId: string };
  config: EbayMarketplaceConfig;
  marketplaceId: string;
  categoryId: string;
  merchantLocationKey: string;
}): OfferPayload {
  return {
    sku: args.sku,
    marketplaceId: args.marketplaceId,
    format: 'FIXED_PRICE',
    availableQuantity: args.data.quantity || 1,
    categoryId: args.categoryId,
    // Buyer-visible description: full template HTML (eBay allows 500,000).
    listingDescription: args.data.description
      ? truncateHtml(args.data.description, EBAY_DESCRIPTION_MAX_LENGTH)
      : '',
    listingPolicies: {
      fulfillmentPolicyId: args.policies.shippingId,
      paymentPolicyId: args.policies.paymentId,
      returnPolicyId: args.policies.returnId,
    },
    merchantLocationKey: args.merchantLocationKey,
    pricingSummary: {
      price: { currency: args.config.currency, value: args.data.price.toString() },
    },
    quantityLimitPerBuyer: 5,
  };
}
