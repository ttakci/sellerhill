/**
 * eBay listing hard limits (Sell Inventory API).
 *
 * The two description limits are NOT the same field:
 * - `offer.listingDescription` (500,000) is what buyers actually read on the
 *   item page. It used to be truncated to 4,000, which sliced styled templates
 *   mid-tag and produced the collapsed, unreadable description box.
 * - `inventoryItem.product.description` (4,000) is catalog metadata.
 * Publishing the full template into the 4,000-char field fails the call, so the
 * two are truncated independently.
 */
export const EBAY_TITLE_MAX_LENGTH = 80;
export const EBAY_DESCRIPTION_MAX_LENGTH = 500000;
export const EBAY_INVENTORY_DESCRIPTION_MAX_LENGTH = 4000;
export const EBAY_MAX_IMAGES = 24;
/** Max characters eBay accepts for a single item-specific (aspect) value. */
export const EBAY_ASPECT_VALUE_MAX_LENGTH = 65;
/** Max characters eBay accepts for an aspect name. */
export const EBAY_ASPECT_NAME_MAX_LENGTH = 40;
/** Max distinct values per aspect (multi-value aspects). */
export const EBAY_ASPECT_MAX_VALUES = 30;
/**
 * Max item specifics (name/value pairs) eBay accepts on one listing.
 * The strongest listings on the platform fill most of these with the source
 * catalogue's attribute table, including names the category never declared.
 */
export const EBAY_MAX_ITEM_SPECIFICS = 45;

/**
 * eBay's sanctioned "this identifier genuinely does not exist" value. Required
 * aspects like MPN/UPC must carry this instead of a made-up "Unknown", which
 * is buyer-visible noise and hurts search placement.
 */
export const EBAY_NOT_APPLICABLE = 'Does not apply';
export const EBAY_UNBRANDED = 'Unbranded';
