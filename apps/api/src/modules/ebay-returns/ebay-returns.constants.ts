// apps/api/src/modules/ebay-returns/ebay-returns.constants.ts

/** BullMQ queue behind the periodic return sweep (one repeatable tick). */
export const EBAY_RETURNS_SYNC_QUEUE = 'ebay-returns-sync';

/** Stable id of the repeatable tick, so a restart never stacks a second one. */
export const EBAY_RETURNS_SYNC_TICK_JOB_ID = 'ebay-returns-sync-tick';

/** Fallback when the setting resolves to nothing — equals the registry default. */
export const DEFAULT_EBAY_RETURNS_SYNC_CRON = '*/10 * * * *';

/**
 * `limit` on `GET /post-order/v2/return/search`. eBay's reference: "Min value:
 * 1 / Max value: 200 / Default value: 25".
 */
export const RETURN_SEARCH_LIMIT = 200;

/**
 * `sort` on the same call. eBay's reference: "To sort in descending order
 * according to return creation date, sort=-FILING_DATE would be used."
 */
export const RETURN_SEARCH_SORT = '-FILING_DATE';

/**
 * How far back each sweep asks. eBay's reference, `creation_date_range_from`:
 * "If you specify a creation_date_range_from value, but do not specify a
 * creation_date_range_to value, the method returns all return requests created
 * at or after the specified timestamp and goes forward for the following 90
 * days." A from-date of exactly 90 days ago is therefore the widest window
 * that still reaches today.
 */
export const RETURN_SEARCH_WINDOW_DAYS = 90;

/** Seller-facing list paging. */
export const RETURNS_DEFAULT_PAGE_SIZE = 20;
export const RETURNS_MAX_PAGE_SIZE = 100;
