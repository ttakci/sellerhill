import { ListingFailureCode, type ListingFailureDetails } from '@repo/shared';

/**
 * Turn any create-path failure into a code the UI can act on.
 *
 * This is the single place that understands eBay's error shapes. Before it,
 * `listing-processor.service.ts` mangled `response.data.errors` into a string
 * and the frontend printed it verbatim — so a plan-limit failure, an expired
 * token and a rejected barcode were indistinguishable to the seller.
 *
 * Pure and total: an unrecognised failure is `UNKNOWN` with its original
 * message, never an exception.
 */

/**
 * eBay error ids that mean "our side failed", not "your request was wrong".
 * 25001 is the Sell APIs' generic system error; its `message` varies and often
 * names an internal eBay service, so it must be matched by id, not by text.
 */
const EBAY_SYSTEM_ERROR_IDS = new Set<number>([25001]);

export interface ClassifiedListingFailure {
  code: ListingFailureCode;
  /** Operator-facing English message; the UI shows a localized one by code. */
  message: string;
  details: ListingFailureDetails;
}

export interface EbayApiErrorEntry {
  errorId?: number;
  message?: string;
  parameters?: Array<{ name?: string; value?: string }>;
}

interface AxiosLikeError {
  response?: {
    status?: number;
    data?: { errors?: EbayApiErrorEntry[]; error_description?: string };
  };
  message?: string;
}

function asAxiosLike(error: unknown): AxiosLikeError | null {
  return typeof error === 'object' && error !== null && 'response' in error ? (error as AxiosLikeError) : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** eBay reports the missing aspect either as parameter "2" or inside the message. */
export function extractMissingAspectName(entry: EbayApiErrorEntry): string | null {
  const fromParam = entry.parameters?.find((parameter) => parameter.name === '2')?.value;
  if (fromParam) {
    return fromParam;
  }
  const match = entry.message?.match(/item specific (.*?) is missing/i);
  return match ? match[1] : null;
}

/** "MPN has an invalid value of "021500000529"" → { aspect, value }. */
export function extractRejectedAspect(entry: EbayApiErrorEntry): { aspectName: string; value: string } | null {
  const match = entry.message?.match(/^(.*?) has an invalid value of "(.*?)"/i);
  return match ? { aspectName: match[1].trim(), value: match[2] } : null;
}

/** Flatten eBay's error array into one readable line (kept as technical detail). */
export function formatEbayErrors(errors: EbayApiErrorEntry[]): string {
  return errors
    .map((entry) => {
      const params = entry.parameters
        ? ` (${entry.parameters.map((p) => `${p.name}: ${p.value}`).join(', ')})`
        : '';
      return `${entry.message ?? 'eBay error'}${params}`;
    })
    .join(' | ');
}

export function classifyListingFailure(error: unknown): ClassifiedListingFailure {
  const raw = errorMessage(error);

  // 1. Our own typed errors carry the most precise meaning.
  const typed = classifyTypedError(error, raw);
  if (typed) {
    return typed;
  }

  // 2. eBay's structured errors.
  const axiosError = asAxiosLike(error);
  const entries = axiosError?.response?.data?.errors ?? [];
  if (entries.length > 0) {
    return classifyEbayErrors(entries);
  }

  // 3. Transport status.
  const status = axiosError?.response?.status;
  if (typeof status === 'number') {
    if (status === 401 || status === 403) {
      return {
        code: ListingFailureCode.EBAY_AUTH,
        message: axiosError?.response?.data?.error_description ?? raw,
        details: { retryable: false },
      };
    }
    if (status === 429) {
      return { code: ListingFailureCode.EBAY_RATE_LIMITED, message: raw, details: { retryable: true } };
    }
    if (status >= 500) {
      return { code: ListingFailureCode.EBAY_UNAVAILABLE, message: raw, details: { retryable: true } };
    }
  }

  return { code: ListingFailureCode.UNKNOWN, message: raw, details: { retryable: true } };
}

/** Recognize the create path's own error strings and typed errors. */
function classifyTypedError(error: unknown, raw: string): ClassifiedListingFailure | null {
  const name = error instanceof Error ? error.name : '';

  // Checked before every other classification: the work is valid and untried,
  // so it must never be attributed to the listing, the category or the seller.
  if (name === 'EbayBudgetExhaustedError') {
    return { code: ListingFailureCode.PROVIDER_BUDGET_EXHAUSTED, message: raw, details: { retryable: true } };
  }
  if (name === 'CategoryResolutionError') {
    return { code: ListingFailureCode.CATEGORY_UNRESOLVED, message: raw, details: { retryable: false } };
  }
  if (name === 'CategoryAspectsUnavailableError') {
    return { code: ListingFailureCode.CATEGORY_ASPECTS_UNAVAILABLE, message: raw, details: { retryable: true } };
  }
  if (name === 'ListingPublishExhaustedError') {
    return { code: ListingFailureCode.EBAY_UNAVAILABLE, message: raw, details: { retryable: true } };
  }
  if (name === 'QuotaExhaustedError') {
    return { code: ListingFailureCode.QUOTA_EXHAUSTED, message: raw, details: { retryable: false } };
  }
  // The seller's own Store Settings blacklist rejected the copy. Reported as
  // UNKNOWN ("The listing could not be created.") until now, which hid a cause
  // the seller could have fixed in one click — the keyword is right there in
  // the message thrown by ListingStrategyService.validateListing.
  const blacklisted = raw.match(
    /(title|description|feature_specification|brand_manufacturer) contains blacklisted keyword:\s*(.+)$/i
  );
  if (blacklisted) {
    return {
      code: ListingFailureCode.BLACKLISTED_KEYWORD,
      message: raw,
      details: { retryable: false, blacklistedKeyword: blacklisted[2].trim() },
    };
  }
  if (raw.startsWith('DUPLICATE_LISTING')) {
    return { code: ListingFailureCode.DUPLICATE_LISTING, message: raw, details: { retryable: false } };
  }
  if (/Stock is 0/i.test(raw)) {
    return { code: ListingFailureCode.ZERO_STOCK, message: raw, details: { retryable: true } };
  }
  if (/^Keepa /i.test(raw)) {
    return { code: ListingFailureCode.PRODUCT_DATA_UNAVAILABLE, message: raw, details: { retryable: true } };
  }
  if (/No active eBay account/i.test(raw)) {
    return { code: ListingFailureCode.EBAY_AUTH, message: raw, details: { retryable: false } };
  }
  if (/did not return a listing id/i.test(raw)) {
    return { code: ListingFailureCode.EBAY_UNAVAILABLE, message: raw, details: { retryable: true } };
  }

  return null;
}

function classifyEbayErrors(entries: EbayApiErrorEntry[]): ClassifiedListingFailure {
  const message = formatEbayErrors(entries);
  const ebayErrorIds = entries.map((entry) => entry.errorId).filter((id): id is number => typeof id === 'number');

  const missingAspects = entries.map(extractMissingAspectName).filter((name): name is string => Boolean(name));
  if (missingAspects.length > 0) {
    return {
      code: ListingFailureCode.ASPECT_MISSING,
      message,
      details: { aspectNames: missingAspects, ebayErrorIds, retryable: false },
    };
  }

  const rejected = entries.map(extractRejectedAspect).find((value): value is NonNullable<typeof value> => Boolean(value));
  if (rejected) {
    const isIdentifier = /^(mpn|upc|ean|gtin|isbn|brandmpn)$/i.test(rejected.aspectName.replace(/\s/g, ''));
    return {
      code: isIdentifier ? ListingFailureCode.INVALID_IDENTIFIER : ListingFailureCode.ASPECT_REJECTED,
      message,
      details: { aspectNames: [rejected.aspectName], ebayErrorIds, retryable: false },
    };
  }

  if (entries.some((entry) => /policy/i.test(entry.message ?? ''))) {
    return {
      code: ListingFailureCode.EBAY_POLICY_MISSING,
      message,
      details: { ebayErrorIds, retryable: false },
    };
  }
  if (entries.some((entry) => /image|picture/i.test(entry.message ?? ''))) {
    return { code: ListingFailureCode.IMAGE_INVALID, message, details: { ebayErrorIds, retryable: false } };
  }
  if (entries.some((entry) => /restricted|not allowed|prohibited/i.test(entry.message ?? ''))) {
    return { code: ListingFailureCode.EBAY_RESTRICTED_ITEM, message, details: { ebayErrorIds, retryable: false } };
  }
  if (entries.some((entry) => /token|expired|invalid access/i.test(entry.message ?? ''))) {
    return { code: ListingFailureCode.EBAY_AUTH, message, details: { ebayErrorIds, retryable: false } };
  }
  /*
   * eBay's own internal failure ("A system error has occurred", sometimes
   * naming one of their services). Our request was fine — their side broke, and
   * the same payload usually succeeds on a retry. Checked last so a specific
   * cause above still wins when eBay returns 25001 alongside a real error.
   * Without this it landed in UNKNOWN and the UI said "unknown reason" for the
   * single most common transient failure on sandbox.
   */
  if (ebayErrorIds.some((id) => EBAY_SYSTEM_ERROR_IDS.has(id))) {
    return { code: ListingFailureCode.EBAY_UNAVAILABLE, message, details: { ebayErrorIds, retryable: true } };
  }

  return { code: ListingFailureCode.UNKNOWN, message, details: { ebayErrorIds, retryable: true } };
}
