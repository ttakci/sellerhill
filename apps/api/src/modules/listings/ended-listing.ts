/**
 * Did eBay just tell us this listing no longer exists?
 *
 * The price/stock fan-out already writes to every active listing about twice a
 * day, on the Inventory quota, which is effectively free (2,000,000 calls/day
 * against ~10% utilisation at 500 sellers). eBay's answer to that write is
 * therefore a signal we are ALREADY PAYING FOR: if the offer is gone, the
 * listing ended — the seller ended it in Seller Hub, eBay ended it, or it was
 * deleted. Until now that answer was logged and discarded, so the row stayed
 * ACTIVE for ever and kept drawing Keepa refresh tokens for a listing with no
 * eBay surface to update.
 *
 * THIS IS THE CONSERVATIVE HALF OF THAT TRADE. Retiring a listing that is in
 * fact alive is the expensive mistake: it stops repricing and restocking
 * silently, and the seller has no way to tell from the UI why their live
 * listing stopped moving. So the rule is narrow by construction:
 *
 *  - it matches ONLY eBay's own numeric ids for "no such offer / no such SKU",
 *    never message prose, which eBay rewords and localizes;
 *  - every id here means the entity is ABSENT. Codes that mean "present but
 *    refused" are deliberately excluded — `25019` (cannot revise), `25097` /
 *    `25098` (listing on hold for a policy review), `25026` (selling limits),
 *    `25003` / `25004` (bad price/quantity). Each of those describes a live
 *    listing, and treating one as ended would retire it over a transient
 *    problem the seller is expected to fix.
 *
 * When in doubt, the answer is false: an unended listing costs a few Keepa
 * tokens, a wrongly ended one costs the seller sales.
 */

/**
 * eBay Inventory API error ids that mean the offer or its SKU is not there.
 * Sourced from the Inventory API error reference, not from observed prose.
 */
const ENDED_LISTING_ERROR_IDS: ReadonlySet<number> = new Set([
  // "These SKU(s) are not in the system"
  25701,
  // "SKU {additionalInfo} is not available in the system"
  25702,
  // "We didn't find the resource/entity you are requesting."
  25710,
  // "This Offer is not available : {additionalInfo}."
  25713,
  // "No offer found"
  25725,
]);

export function isEndedListingErrorId(errorId: number): boolean {
  return ENDED_LISTING_ERROR_IDS.has(errorId);
}

/**
 * True when at least one of the ids eBay returned says the listing is gone.
 *
 * An empty list is always false — "eBay told us nothing we recognise" is not
 * evidence of an ending, and a transport failure (which produces no ids at all)
 * must never retire a listing. That is the case this guard exists for: the
 * batch path reports a network error per listing, and without this rule an
 * eBay outage would end a seller's entire catalogue in one tick.
 */
export function isEndedListingFailure(errorIds: readonly number[]): boolean {
  return errorIds.some(isEndedListingErrorId);
}
