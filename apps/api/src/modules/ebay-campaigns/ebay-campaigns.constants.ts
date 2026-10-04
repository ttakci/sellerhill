export const EBAY_CAMPAIGN_SYNC_QUEUE = 'ebay-campaign-sync';
export const EBAY_CAMPAIGN_SYNC_TICK_JOB_ID = 'ebay-campaign-sync-tick';
export const DEFAULT_EBAY_CAMPAIGN_SYNC_CRON = '*/10 * * * *';
/** eBay's page size cap for getCampaigns / getAds. */
export const CAMPAIGN_PAGE_LIMIT = 500;
/** `listing_ids` accepts at most this many ids per getAds call. */
export const ADS_LISTING_IDS_MAX = 500;
/** Bulk ad calls take at most this many requests. */
export const CAMPAIGN_BULK_MAX = 500;
/** Runaway guard on campaign paging. */
export const CAMPAIGN_MAX_PAGES = 20;
