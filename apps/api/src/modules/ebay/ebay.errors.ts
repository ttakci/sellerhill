/**
 * Typed eBay listing failures.
 *
 * These exist so the failure classifier (and the operator reading a job item)
 * never has to string-match our own messages. Each one replaces a place where
 * the create path used to fail silently or return a fake success.
 */

export class EbayListingError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The taxonomy could not name a leaf category for this product.
 *
 * Replaces the old `{ categoryId: '1' }` fallback: category 1 is eBay's root,
 * not a listable leaf, so that fallback guaranteed a later publish failure
 * whose message never mentioned the category.
 */
export class CategoryResolutionError extends EbayListingError {
  constructor(readonly query: string) {
    super(`eBay could not resolve a listing category for "${query}".`, 'category_unresolved');
  }
}

/**
 * Category aspect metadata is unavailable (taxonomy down and no cached copy).
 *
 * Replaces the old `return []`, which published a listing carrying only Brand
 * and then failed on every required item specific in turn.
 */
export class CategoryAspectsUnavailableError extends EbayListingError {
  constructor(readonly categoryId: string) {
    super(`eBay item-specific metadata for category ${categoryId} is unavailable.`, 'category_aspects_unavailable');
  }
}

/**
 * eBay rejected a value we supplied for an item specific (as opposed to
 * reporting it missing). Carries the aspect so the value can be demoted.
 */
export class AspectRejectedError extends EbayListingError {
  constructor(
    readonly aspectName: string,
    readonly value: string,
    readonly categoryId: string
  ) {
    super(
      `eBay rejected the value "${value}" for item specific "${aspectName}" in category ${categoryId}.`,
      'aspect_rejected'
    );
  }
}

/**
 * The publish loop ran out of attempts without eBay returning a listing id.
 *
 * Previously this path `return`ed an empty listing id as SUCCESS, and the
 * caller wrote an ACTIVE listing row with an empty `ebay_item_id` — a listing
 * that does not exist on eBay but blocks re-listing and can never be matched
 * to an order.
 */
export class ListingPublishExhaustedError extends EbayListingError {
  constructor(
    readonly categoryId: string,
    readonly forcedAspectNames: string[],
    readonly attempts: number
  ) {
    super(
      `eBay publish did not complete after ${attempts} attempt(s) for category ${categoryId}` +
        (forcedAspectNames.length > 0 ? ` (contested item specifics: ${forcedAspectNames.join(', ')})` : '') +
        '.',
      'publish_exhausted'
    );
  }
}
