/**
 * Pure helpers for eBay's bulk Inventory API envelope.
 *
 * Every bulk endpoint (`bulk_create_or_replace_inventory_item`,
 * `bulk_create_offer`, `bulk_publish_offer`, `bulk_update_price_quantity`)
 * answers 200 OK with a `responses[]` array in which each entry carries its
 * OWN `statusCode` and `errors[]`. A bulk call therefore succeeds and fails at
 * the same time, and the caller — not the HTTP layer — owns the partition.
 *
 * `migrateLegacyListing` already parsed this shape, but with a batch of one,
 * so the per-entry correlation problem never came up. It does now.
 */

export interface EbayBulkError {
  errorId?: number;
  message?: string;
  longMessage?: string;
  parameters?: Array<{ name?: string; value?: string }>;
}

/** One entry of a bulk `responses[]` array. Fields vary by endpoint. */
export interface EbayBulkResponseEntry {
  statusCode?: number;
  sku?: string;
  offerId?: string;
  listingId?: string;
  errors?: EbayBulkError[];
  warnings?: EbayBulkError[];
}

export interface EbayBulkEnvelope {
  responses?: EbayBulkResponseEntry[];
}

/** eBay's max batch size for every bulk Inventory method. */
export const EBAY_BULK_MAX_BATCH = 25;

/** Split a list into batches eBay will accept. A non-positive size yields one batch. */
export function chunkForBulk<T>(items: readonly T[], size: number = EBAY_BULK_MAX_BATCH): T[][] {
  const limit = Math.max(1, Math.min(Math.floor(size) || EBAY_BULK_MAX_BATCH, EBAY_BULK_MAX_BATCH));
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += limit) {
    batches.push(items.slice(index, index + limit));
  }
  return batches;
}

/** A per-entry status is a success when eBay reports 2xx and attaches no errors. */
export function isBulkEntrySuccess(entry: EbayBulkResponseEntry | null | undefined): boolean {
  if (!entry) {
    return false;
  }
  if (entry.errors && entry.errors.length > 0) {
    return false;
  }
  // Some endpoints omit statusCode on success; absence is not evidence of failure.
  return entry.statusCode === undefined || (entry.statusCode >= 200 && entry.statusCode < 300);
}

export interface BulkOutcome<T> {
  item: T;
  entry: EbayBulkResponseEntry | null;
  ok: boolean;
}

/**
 * Pair each request item with its response entry.
 *
 * eBay keys entries by SKU, which is the reliable correlation; positional order
 * is only a fallback for endpoints/entries that omit it. An item with no entry
 * at all is reported as failed — a missing answer is never evidence that the
 * write landed, and treating it as success is how a listing row gets recorded
 * for something that does not exist on eBay.
 */
export function correlateBulkResponses<T>(
  items: readonly T[],
  responses: readonly EbayBulkResponseEntry[] | undefined,
  keyOf: (item: T) => string,
  // `bulk_publish_offer` keys its entries by offerId, not sku, so the response
  // side of the correlation is pluggable.
  entryKeyOf: (entry: EbayBulkResponseEntry) => string | undefined = (entry) => entry.sku
): BulkOutcome<T>[] {
  const entries = responses ?? [];
  const byKey = new Map<string, EbayBulkResponseEntry>();
  for (const entry of entries) {
    const key = entryKeyOf(entry);
    if (key && !byKey.has(key)) {
      byKey.set(key, entry);
    }
  }

  return items.map((item, index) => {
    const entry = byKey.get(keyOf(item)) ?? entries[index] ?? null;
    return { item, entry, ok: isBulkEntrySuccess(entry) };
  });
}

/**
 * The offer id eBay hands back when it refuses to create an offer that already
 * exists for the SKU.
 *
 * The aspect self-heal loop re-runs the whole staged sequence for the items it
 * is retrying, so the second pass always hits an offer created by the first.
 * Without recovering that id the retry can never reach publish, and the
 * self-heal would silently be a no-op — the exact failure the single-item path
 * already handles.
 */
export function extractExistingOfferId(errors: readonly EbayBulkError[] | undefined): string | null {
  const conflict = (errors ?? []).find((error) => error.errorId === 25002);
  return conflict?.parameters?.find((parameter) => parameter.name === 'offerId')?.value ?? null;
}

/**
 * The aspect name eBay says is missing, or null when this is not that failure.
 *
 * eBay reports it as errorId 25002 with a message like
 * `The item specific Department is missing.` The name is usually in parameter
 * "2"; the message regex is the fallback for the shapes that omit it.
 */
export function extractMissingAspectName(errors: readonly EbayBulkError[] | undefined): string | null {
  const missing = (errors ?? []).find(
    (error) => error.errorId === 25002 && (error.message?.includes('item specific') ?? false)
  );
  if (!missing) {
    return null;
  }

  const fromParameter = missing.parameters?.find((parameter) => parameter.name === '2')?.value;
  if (fromParameter) {
    return fromParameter;
  }

  return missing.message?.match(/item specific (.*?) is missing/)?.[1] ?? null;
}

/** An aspect value eBay rejected, so the resolver can demote it for this category. */
export function extractRejectedAspect(
  errors: readonly EbayBulkError[] | undefined
): { name: string; value: string } | null {
  const invalid = (errors ?? []).find((error) => error.message?.includes('has an invalid value') ?? false);
  const match = invalid?.message?.match(/^(.*?) has an invalid value of "(.*?)"/);
  return match ? { name: match[1], value: match[2] } : null;
}

/** eBay's transient publish failure — the offer is orphaned and must be deleted before a retry. */
export function isBulkSystemError(errors: readonly EbayBulkError[] | undefined): boolean {
  return (errors ?? []).some(
    (error) => error.errorId === 25002 && (error.message?.includes('System error') ?? false)
  );
}

/** Flatten a bulk entry's errors into one line for `listing_job_items.error_message`. */
export function describeBulkErrors(entry: EbayBulkResponseEntry | null | undefined): string {
  const messages = (entry?.errors ?? [])
    .map((error) => error.longMessage || error.message)
    .filter((message): message is string => Boolean(message));

  if (messages.length > 0) {
    return messages.join('; ');
  }
  if (!entry) {
    return 'eBay returned no result for this item in the bulk response.';
  }
  return `eBay rejected this item with status ${entry.statusCode ?? 'unknown'}.`;
}
