// apps/api/src/modules/ebay-finances/ebay-finances.constants.ts

/** BullMQ queue of the billing-activity capture tick. */
export const EBAY_BILLING_SYNC_QUEUE = 'ebay-billing-sync';
export const EBAY_BILLING_SYNC_TICK_JOB_ID = 'ebay-billing-sync-tick';
/** Used when the cron setting cannot be read. */
export const DEFAULT_EBAY_BILLING_SYNC_CRON = '*/10 * * * *';

/** eBay's documented maximum `limit` for `getBillingActivities`. */
export const BILLING_PAGE_LIMIT = 200;
/**
 * Pages read per store per sweep. A runaway guard, not a quota: 10 pages are
 * 2,000 billing lines, far more than a store produces in the capture window,
 * and a sweep that hits it says so in the log.
 */
export const BILLING_MAX_PAGES = 10;
/**
 * eBay: "The starting date cannot be set back further than 120 days in the
 * past." A start computed here as now − 120 days is already a little older on
 * eBay's clock, so the widest window actually asked for is a day less.
 */
export const BILLING_MAX_WINDOW_DAYS = 119;
/**
 * Sweeps kept on disk per store. Each sweep re-reads the same window, so older
 * sweeps are near-duplicates; without pruning the directory grows for as long
 * as the store stays connected (it sits on the persistent api_logs volume).
 */
export const BILLING_KEEP_SWEEPS = 3;
