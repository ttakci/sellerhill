/**
 * Pure pieces of the Promoted Listings (general strategy) integration.
 *
 * Every field name, bound and error id here is taken from eBay's own Marketing
 * API v1.23.2 OpenAPI file (`docs/ebay-reference/sell-marketing-v1-oas3.json`)
 * or from a live answer of the production keyset (2026-10-02) — nothing is
 * assumed. See `docs/ebay-reference/README.md`, "Promoted Listings facts".
 */

/** `FundingStrategy.fundingModel` for a general-strategy (cost per sale) campaign. */
export const EBAY_FUNDING_MODEL_COST_PER_SALE = 'COST_PER_SALE';
/** `SellerEligibilityResponse.programType` of the general strategy, as eBay answers it. */
export const EBAY_PROGRAM_PROMOTED_LISTINGS_STANDARD = 'PROMOTED_LISTINGS_STANDARD';
/** The one eligibility status observed live. Any other status is left for eBay to judge. */
export const EBAY_ELIGIBILITY_INELIGIBLE = 'INELIGIBLE';

/** "You can specify a maximum of 500 listings per call" (bulkCreateAdsByListingId). */
export const EBAY_BULK_ADS_MAX_PER_CALL = 500;
/** "Max length: 80 characters" (campaignName). */
export const EBAY_CAMPAIGN_NAME_MAX_LENGTH = 80;
export const PROMOTED_CAMPAIGN_NAME = 'SellerHill';

/** "No campaign found with the name {campaign_name}." */
export const EBAY_ERROR_CAMPAIGN_NAME_NOT_FOUND = 35046;
/** "A campaign with the name of {campaignName} already exists." */
export const EBAY_ERROR_CAMPAIGN_NAME_EXISTS = 35021;
/** "The campaign with campaign id {campaign_id} has ended." */
export const EBAY_ERROR_CAMPAIGN_ENDED = 35035;
/** "No campaign found for campaign id {campaign_id}." */
export const EBAY_ERROR_CAMPAIGN_NOT_FOUND = 35045;
/** "An ad for listing ID {listingId} already exists." — the listing is promoted, which is the goal. */
export const EBAY_ERROR_AD_ALREADY_EXISTS = 35036;
/**
 * The seller, not the request, is what eBay refuses: terms not accepted
 * (35067), seller level (35077), not enough recent activity (35078). Retrying
 * cannot help until the seller's standing changes.
 */
export const EBAY_SELLER_NOT_ELIGIBLE_ERROR_IDS: ReadonlySet<number> = new Set([35067, 35077, 35078]);

/**
 * eBay's `bidPercentage`: a string, "a single precision value" (4.1, 5.0, 5.5 —
 * not 10.75), "minimum value of 2.0 and a maximum value of 100.0".
 */
export function formatBidPercentage(rate: number): string {
  return (Math.round(rate * 10) / 10).toFixed(1);
}

/** `yyyy-MM-ddThh:mm:ssZ` — eBay's campaign date format (no milliseconds). */
export function formatCampaignDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The campaign id from createCampaign's `Location` header (the call answers
 * 201 with no body; the id is the last path segment of the getCampaign URI).
 */
export function parseCampaignIdFromLocation(location: unknown): string | null {
  if (typeof location !== 'string') {
    return null;
  }
  const id = location.split('?')[0].replace(/\/+$/, '').split('/').pop() ?? '';
  return /^\d+$/.test(id) ? id : null;
}

export interface AdvertisingEligibility {
  status: string | null;
  reason: string | null;
}

/** The general strategy's entry in getAdvertisingEligibility's answer. */
export function readStandardEligibility(body: unknown): AdvertisingEligibility {
  const list =
    body && typeof body === 'object' ? (body as { advertisingEligibility?: unknown }).advertisingEligibility : null;
  if (!Array.isArray(list)) {
    return { status: null, reason: null };
  }
  for (const entry of list) {
    if (entry && typeof entry === 'object') {
      const row = entry as { programType?: unknown; status?: unknown; reason?: unknown };
      if (row.programType === EBAY_PROGRAM_PROMOTED_LISTINGS_STANDARD) {
        return {
          status: typeof row.status === 'string' ? row.status : null,
          reason: typeof row.reason === 'string' ? row.reason : null,
        };
      }
    }
  }
  return { status: null, reason: null };
}

/** Every `errorId` in an eBay error body, whatever the shape of the rest. */
export function readEbayErrorIds(body: unknown): number[] {
  const errors = body && typeof body === 'object' ? (body as { errors?: unknown }).errors : null;
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors
    .map((entry) => (entry && typeof entry === 'object' ? (entry as { errorId?: unknown }).errorId : null))
    .filter((id): id is number => typeof id === 'number');
}

export interface BulkAdOutcome {
  /** Listings that now carry an ad — created by this call, or already promoted. */
  promoted: string[];
  failed: Array<{ listingId: string; errorIds: number[] }>;
}

/**
 * Read bulkCreateAdsByListingId's per-listing answers (`responses[]`, each with
 * `listingId`, `statusCode`, and `adId` only when the ad was created).
 *
 * A listing eBay never answered for is a FAILURE, not a success — the same
 * rule the bulk listing calls follow.
 */
export function readBulkAdResponse(body: unknown, requested: readonly string[]): BulkAdOutcome {
  const responses = body && typeof body === 'object' ? (body as { responses?: unknown }).responses : null;
  const byListing = new Map<string, { ok: boolean; errorIds: number[] }>();
  if (Array.isArray(responses)) {
    for (const entry of responses) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const row = entry as { listingId?: unknown; statusCode?: unknown; adId?: unknown; errors?: unknown };
      if (typeof row.listingId !== 'string') {
        continue;
      }
      const errorIds = readEbayErrorIds({ errors: row.errors });
      const created = typeof row.adId === 'string' && row.adId.length > 0;
      byListing.set(row.listingId, {
        ok: created || errorIds.includes(EBAY_ERROR_AD_ALREADY_EXISTS),
        errorIds,
      });
    }
  }
  const outcome: BulkAdOutcome = { promoted: [], failed: [] };
  for (const listingId of requested) {
    const answer = byListing.get(listingId);
    if (answer?.ok) {
      outcome.promoted.push(listingId);
    } else {
      outcome.failed.push({ listingId, errorIds: answer?.errorIds ?? [] });
    }
  }
  return outcome;
}
