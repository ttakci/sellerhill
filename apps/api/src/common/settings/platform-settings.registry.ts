// apps/api/src/modules/admin/platform-settings.registry.ts
//
// The single source of truth for every runtime-tunable setting: its type,
// bounds, code default, and the env var it falls back to. Adding a knob means
// adding one entry here (plus the key in @repo/shared) — the admin API, the
// validation and the UI all derive from this table.
//
// `requiresRestart` is not cosmetic: it marks values consumed once at boot
// (repeatable job cron patterns, worker concurrency) where a silently-ignored
// change would be worse than no change at all.

import {
  PlatformSettingCategory,
  PlatformSettingKey,
  PlatformSettingType,
} from '@repo/shared';

export interface PlatformSettingDefinition {
  key: PlatformSettingKey;
  category: PlatformSettingCategory;
  type: PlatformSettingType;
  /** Env var consulted when no DB override exists. */
  envVar: string;
  /** Code default in canonical string form; null when the setting is optional. */
  defaultValue: string | null;
  /** Value is consumed at boot — changing it needs an API restart to apply. */
  requiresRestart?: boolean;
  /** Never returned by read endpoints; stored encrypted at rest. */
  isSecret?: boolean;
  min?: number;
  max?: number;
  options?: string[];
}

const def = (d: PlatformSettingDefinition): PlatformSettingDefinition => d;

export const PLATFORM_SETTING_DEFINITIONS: PlatformSettingDefinition[] = [
  // --- eBay API call budget ---
  // eBay meters calls PER APPLICATION, so all users share one quota pool and
  // exhausting it locks out every seller at once. Per-resource ceilings are
  // NOT configured here — the governor (`EbayCallBudgetService`) reads them
  // from eBay's own `getRateLimits` response via `EbayRateLimitStore`; there
  // is nothing to raise after an Application Growth Check, since the next
  // hourly refresh picks up eBay's new figure on its own.
  def({
    key: PlatformSettingKey.EBAY_BUDGET_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_BUDGET_ENABLED',
    defaultValue: 'true',
  }),
  def({
    // Share of each quota fenced off for seller-triggered actions, so a night
    // of background refreshing cannot leave a user unable to publish.
    key: PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BUDGET_RESERVE_PERCENT',
    defaultValue: '5',
    min: 0,
    max: 50,
  }),
  def({
    key: PlatformSettingKey.EBAY_FEED_SYNC_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_FEED_SYNC_ENABLED',
    defaultValue: 'false',
  }),
  def({
    key: PlatformSettingKey.EBAY_FEED_SYNC_CAPTURE_ONLY,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_FEED_SYNC_CAPTURE_ONLY',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.EBAY_FEED_SYNC_CRON,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.STRING,
    envVar: 'EBAY_FEED_SYNC_CRON',
    // Every 20 minutes. This only decides how often a few MORE stores are
    // picked up; how often a given store is swept is the interval below.
    defaultValue: '*/20 * * * *',
    requiresRestart: true,
  }),
  def({
    key: PlatformSettingKey.EBAY_FEED_SYNC_INTERVAL_HOURS,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_FEED_SYNC_INTERVAL_HOURS',
    defaultValue: '24',
    min: 1,
    max: 168,
  }),
  def({
    key: PlatformSettingKey.EBAY_FEED_SYNC_MAX_ACCOUNTS_PER_RUN,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_FEED_SYNC_MAX_ACCOUNTS_PER_RUN',
    defaultValue: '5',
    min: 1,
    max: 100,
  }),
  def({
    key: PlatformSettingKey.EBAY_CAMPAIGN_SYNC_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_CAMPAIGN_SYNC_ENABLED',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.EBAY_CAMPAIGN_SYNC_CRON,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.STRING,
    envVar: 'EBAY_CAMPAIGN_SYNC_CRON',
    defaultValue: '*/10 * * * *',
    requiresRestart: true,
  }),
  def({
    key: PlatformSettingKey.EBAY_CAMPAIGN_SYNC_INTERVAL_HOURS,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_CAMPAIGN_SYNC_INTERVAL_HOURS',
    defaultValue: '6',
    min: 1,
    max: 48,
  }),
  def({
    key: PlatformSettingKey.EBAY_CAMPAIGN_SYNC_MAX_ACCOUNTS_PER_RUN,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_CAMPAIGN_SYNC_MAX_ACCOUNTS_PER_RUN',
    defaultValue: '10',
    min: 1,
    max: 100,
  }),
  def({
    key: PlatformSettingKey.EBAY_CAMPAIGN_REPORTS_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_CAMPAIGN_REPORTS_ENABLED',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.EBAY_CAMPAIGN_REPORTS_CAPTURE_ONLY,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_CAMPAIGN_REPORTS_CAPTURE_ONLY',
    defaultValue: 'true',
  }),
  // --- Billing-activity capture (Finances API, 15,000 calls/day app-wide) ---
    // On by default; only accounts whose granted_scopes contains sell.finances
    // are selected. OAuth DEFAULT_SCOPES already requests it; no consent toggle exists.
  def({
    key: PlatformSettingKey.EBAY_BILLING_SYNC_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_BILLING_SYNC_ENABLED',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.EBAY_BILLING_SYNC_CRON,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.STRING,
    envVar: 'EBAY_BILLING_SYNC_CRON',
    defaultValue: '*/10 * * * *',
    requiresRestart: true,
  }),
  def({
    key: PlatformSettingKey.EBAY_BILLING_SYNC_INTERVAL_HOURS,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BILLING_SYNC_INTERVAL_HOURS',
    defaultValue: '4',
    min: 1,
    max: 48,
  }),
  def({
    key: PlatformSettingKey.EBAY_BILLING_SYNC_MAX_ACCOUNTS_PER_RUN,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BILLING_SYNC_MAX_ACCOUNTS_PER_RUN',
    defaultValue: '10',
    min: 1,
    max: 100,
  }),
  def({
    key: PlatformSettingKey.EBAY_BILLING_SYNC_WINDOW_DAYS,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_BILLING_SYNC_WINDOW_DAYS',
    defaultValue: '30',
    min: 1,
    max: 119,
  }),
  // --- Periodic return sweep (Post-Order API, 5,000 calls/day app-wide) ---
  def({
    key: PlatformSettingKey.EBAY_RETURN_SYNC_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_RETURN_SYNC_ENABLED',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.EBAY_RETURN_SYNC_CRON,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.STRING,
    envVar: 'EBAY_RETURN_SYNC_CRON',
    // Every 10 minutes: how often a few MORE stores are picked up. How often
    // one store is swept is the interval below.
    defaultValue: '*/10 * * * *',
    requiresRestart: true,
  }),
  def({
    key: PlatformSettingKey.EBAY_RETURN_SYNC_INTERVAL_AUTO,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_RETURN_SYNC_INTERVAL_AUTO',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.EBAY_RETURNS_ACTIONS_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_RETURNS_ACTIONS_ENABLED',
    // Off until the first real return has proven the write calls (no Sandbox).
    defaultValue: 'false',
  }),
  // --- Buyer cancellation requests (Post-Order API, its own 5,000 calls/day) ---
  def({
    key: PlatformSettingKey.EBAY_CANCELLATION_SYNC_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_CANCELLATION_SYNC_ENABLED',
    // Rides the return sweep's tick, cron and pacing settings.
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.EBAY_CANCELLATIONS_ACTIONS_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_CANCELLATIONS_ACTIONS_ENABLED',
    // Off until the first live buyer request has proven approve / reject (no Sandbox).
    defaultValue: 'false',
  }),
  def({
    key: PlatformSettingKey.LISTING_CLEANUP_ENABLED,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'LISTING_CLEANUP_ENABLED',
    // On: each seller's own rule is off until they switch it on, so this only
    // exists to stop every automatic ending at once.
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.EBAY_RETURN_SYNC_QUOTA_PERCENT,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_RETURN_SYNC_QUOTA_PERCENT',
    // Half the quota: retries are charged too, and the rest stays free for
    // any other return call. At 500 stores this resolves to a 6-hour interval.
    defaultValue: '50',
    min: 5,
    max: 90,
  }),
  def({
    key: PlatformSettingKey.EBAY_RETURN_SYNC_INTERVAL_HOURS,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_RETURN_SYNC_INTERVAL_HOURS',
    // Manual fallback only (auto off, or no eBay limit captured yet).
    // 500 stores x 4 sweeps/day = 2,000 calls, 40% of the 5,000/day ceiling.
    defaultValue: '6',
    min: 1,
    max: 168,
  }),
  def({
    key: PlatformSettingKey.EBAY_MESSAGES_UNREAD_RECOUNT_MINUTES,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_MESSAGES_UNREAD_RECOUNT_MINUTES',
    // 3 calls per recount. New messages from buyers reach the badge through the
    // NEW_MESSAGE webhook at no cost, so this only catches what the webhook cannot
    // see (a read on eBay's own site, eBay's own notices). 500 sellers active
    // 8 h/day: 60 min = ~12k/day (10 min = ~72k) of the 500,000/day Message pool.
    defaultValue: '60',
    min: 1,
    max: 1440,
  }),
  def({
    key: PlatformSettingKey.EBAY_RETURN_SYNC_MAX_ACCOUNTS_PER_RUN,
    category: PlatformSettingCategory.EBAY,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_RETURN_SYNC_MAX_ACCOUNTS_PER_RUN',
    // A burst guard, not the pace. 144 ticks a day x 35 = 5,040 sweeps, above
    // the whole 5,000/day quota, so this can never be what slows the sweep
    // down — the interval (derived from the quota) is.
    defaultValue: '35',
    min: 1,
    max: 200,
  }),
  // --- Keepa refresh: the dominant recurring provider cost ---
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_ENABLED,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'KEEPA_REFRESH_ENABLED',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_INTERVAL_MINUTES,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_INTERVAL_MINUTES',
    defaultValue: '360',
    min: 15,
    max: 10080,
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_BATCH_SIZE,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_BATCH_SIZE',
    defaultValue: '50',
    min: 1,
    max: 1000,
  }),
  def({
    // When on (default), the batch size is derived from the Keepa plan's own
    // refill rate so upgrading the plan raises throughput automatically — the
    // batch size and the plan must stay matched, and doing it by hand is a
    // step that gets forgotten (and then degrades silently). Turn off to pin
    // the fixed KEEPA_REFRESH_BATCH_SIZE above.
    key: PlatformSettingKey.KEEPA_REFRESH_BATCH_AUTO,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'KEEPA_REFRESH_BATCH_AUTO',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_RESERVE_PERCENT,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_RESERVE_PERCENT',
    defaultValue: '20',
    min: 0,
    max: 90,
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_CLAIM_LEASE_MINUTES,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_CLAIM_LEASE_MINUTES',
    defaultValue: '15',
    min: 1,
    max: 240,
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_MAX_FAILURES,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_MAX_FAILURES',
    defaultValue: '5',
    min: 1,
    max: 50,
  }),
  def({
    key: PlatformSettingKey.KEEPA_REFRESH_QUARANTINE_MINUTES,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.NUMBER,
    envVar: 'KEEPA_REFRESH_QUARANTINE_MINUTES',
    defaultValue: '1440',
    min: 5,
    max: 43200,
  }),
  def({
    // The repeatable tick is registered once at boot — a new pattern only
    // applies after a restart re-registers the scheduler.
    key: PlatformSettingKey.KEEPA_REFRESH_SCHEDULER_CRON,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.CRON,
    envVar: 'KEEPA_REFRESH_SCHEDULER_CRON',
    defaultValue: '* * * * *',
    requiresRestart: true,
  }),

  // --- Product data source (spec 2026-09-26-amazon-scraper-provider) ---
  def({
    // Whole-provider switch. There is no per-field fallback between the two.
    key: PlatformSettingKey.PRODUCT_DATA_PROVIDER,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.ENUM,
    envVar: 'PRODUCT_DATA_PROVIDER',
    defaultValue: 'scraper',
    options: ['keepa', 'scraper'],
  }),
  def({
    // Newline- or comma-separated proxy URLs (http/https/socks5, with port).
    // Write-only secret. Empty means the scraper makes no request at all —
    // it never falls back to the server's own IP.
    key: PlatformSettingKey.SCRAPER_PROXIES,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.STRING,
    envVar: 'SCRAPER_PROXIES',
    defaultValue: null,
    isSecret: true,
  }),
  def({
    key: PlatformSettingKey.SCRAPER_PER_IP_RPS,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'SCRAPER_PER_IP_RPS',
    defaultValue: '1',
    min: 0.1,
    max: 10,
  }),
  def({
    // Stock recorded for "In Stock" with no count: Amazon prints "Only N left"
    // only up to 20, so "In Stock" means at least this many.
    key: PlatformSettingKey.SCRAPER_IN_STOCK_FLOOR,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'SCRAPER_IN_STOCK_FLOOR',
    defaultValue: '20',
    min: 1,
    max: 1000,
  }),
  def({
    key: PlatformSettingKey.SCRAPER_BLOCK_RATE_WARN_PERCENT,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'SCRAPER_BLOCK_RATE_WARN_PERCENT',
    defaultValue: '10',
    min: 1,
    max: 100,
  }),
  // Best Sellers browsing rides the same scraper + proxy pool (browse lane).
  def({
    key: PlatformSettingKey.BEST_SELLERS_ENABLED,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'BEST_SELLERS_ENABLED',
    defaultValue: 'true',
  }),
  def({
    // A list page is shared by every seller; Amazon refreshes the lists about
    // hourly, so a few hours of cache trades little freshness for a lot of
    // proxy capacity.
    key: PlatformSettingKey.BEST_SELLERS_CACHE_TTL_MINUTES,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'BEST_SELLERS_CACHE_TTL_MINUTES',
    defaultValue: '360',
    min: 5,
    max: 1440,
  }),
  def({
    // HIDDEN anti-abuse brake on proxy capacity, NOT the seller allowance:
    // a per-seller cap on cache MISSES (live fetches) per UTC day; a hit costs
    // nothing. The seller-facing meter is the plan's
    // `best_sellers_products_per_month` (migration 125), which locks rows
    // instead of refusing. Set far above any real use — 1000 live fetches a
    // day is ~4000 proxy requests, more than a person can click through — so
    // only a script ever meets it. 0 means nobody may trigger a live fetch;
    // the cache still serves.
    key: PlatformSettingKey.BEST_SELLERS_DAILY_FETCH_LIMIT,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'BEST_SELLERS_DAILY_FETCH_LIMIT',
    defaultValue: '1000',
    min: 0,
    max: 10000,
  }),
  def({
    // The platform's own crawl of the whole category tree (every list type),
    // so any branch a seller expands answers from cache. Runs on the scraper's
    // lowest lane — behind the price/stock refresh — and never without a proxy.
    key: PlatformSettingKey.BEST_SELLERS_CRAWL_ENABLED,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'BEST_SELLERS_CRAWL_ENABLED',
    defaultValue: 'true',
  }),
  def({
    // Categories change over months, not hours. Must stay below the tree
    // cache lifetime (14 days, TREE_CACHE_TTL_SECONDS) so a node is re-read
    // before it expires.
    key: PlatformSettingKey.BEST_SELLERS_CRAWL_INTERVAL_DAYS,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'BEST_SELLERS_CRAWL_INTERVAL_DAYS',
    defaultValue: '7',
    min: 1,
    max: 13,
  }),
  def({
    // One request per page. ~250k nodes over the five lists (sampled
    // 2026-10-03) at 30/min is under six days — about a tenth of a
    // five-proxy pool at 1 request/s per IP.
    key: PlatformSettingKey.BEST_SELLERS_CRAWL_PAGES_PER_MINUTE,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'BEST_SELLERS_CRAWL_PAGES_PER_MINUTE',
    defaultValue: '30',
    min: 0,
    max: 300,
  }),
  def({
    // 2 = the root, the departments and their children (~900 Best Sellers
    // lists), so the pages sellers pass through first open instantly.
    key: PlatformSettingKey.BEST_SELLERS_PREWARM_DEPTH,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'BEST_SELLERS_PREWARM_DEPTH',
    defaultValue: '2',
    min: 0,
    max: 4,
  }),
  def({
    // About four requests a page; ~900 pages at 3/min fit one 6-hour list
    // cache period with room to spare (~3% of a five-proxy pool).
    key: PlatformSettingKey.BEST_SELLERS_PREWARM_PAGES_PER_MINUTE,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'BEST_SELLERS_PREWARM_PAGES_PER_MINUTE',
    defaultValue: '3',
    min: 0,
    max: 60,
  }),

  // --- Amazon order sync + tracking ---
  def({
    // THE platform's biggest scaling lever. This tick costs one Playwright
    // scrape per ACCOUNT per fire regardless of sales, so its cost is
    // `accounts × ticks/day` and nothing else. At 500 accounts the old */30
    // default demanded roughly twice the browser-time the rate limiter can
    // supply; every 3 hours fits with room to spare. Raising the frequency
    // only speeds up how soon ALREADY-PLACED orders get their Amazon costs
    // written — no seller-facing action waits on it.
    key: PlatformSettingKey.AMAZON_ORDER_SYNC_CRON,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.CRON,
    envVar: 'AMAZON_ORDER_SYNC_CRON',
    defaultValue: '0 */3 * * *',
    requiresRestart: true,
  }),
  def({
    key: PlatformSettingKey.AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    // A tie-break only: an Amazon total within this % of the order's expected
    // cost ranks that candidate higher. It never blocks a match (the Amazon
    // total includes tax, hence the wider default).
    envVar: 'AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT',
    defaultValue: '15',
    min: 0,
    max: 50,
  }),
  def({
    key: PlatformSettingKey.AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS',
    defaultValue: '7',
    min: 1,
    max: 60,
  }),
  def({
    // Baked into the per-order job schedulers at reconcile time; a restart
    // re-runs reconcileSchedulers() and applies the new cadence.
    key: PlatformSettingKey.AMAZON_TRACKING_PRESHIP_INTERVAL_HOURS,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AMAZON_TRACKING_PRESHIP_INTERVAL_HOURS',
    defaultValue: '6',
    min: 1,
    max: 72,
    requiresRestart: true,
  }),
  def({
    key: PlatformSettingKey.AMAZON_TRACKING_SHIPPED_INTERVAL_HOURS,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AMAZON_TRACKING_SHIPPED_INTERVAL_HOURS',
    defaultValue: '24',
    min: 1,
    max: 168,
    requiresRestart: true,
  }),

  // --- Auto-fulfillment safety ---
  def({
    key: PlatformSettingKey.AUTO_FULFILL_REVIEW_CAP_HARD_STOP,
    category: PlatformSettingCategory.AUTO_FULFILL,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'AUTO_FULFILL_REVIEW_CAP_HARD_STOP',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.FULFILLMENT_EVIDENCE_TTL_DAYS,
    category: PlatformSettingCategory.AUTO_FULFILL,
    type: PlatformSettingType.NUMBER,
    envVar: 'FULFILLMENT_EVIDENCE_TTL_DAYS',
    defaultValue: '7',
    min: 1,
    max: 365,
  }),

  // --- Email / SMTP ---
  def({
    key: PlatformSettingKey.SMTP_HOST,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.STRING,
    envVar: 'SMTP_HOST',
    defaultValue: 'smtp.gmail.com',
  }),
  def({
    key: PlatformSettingKey.SMTP_PORT,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.NUMBER,
    envVar: 'SMTP_PORT',
    defaultValue: '587',
    min: 1,
    max: 65535,
  }),
  def({
    key: PlatformSettingKey.SMTP_SECURE,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'SMTP_SECURE',
    defaultValue: 'false',
  }),
  def({
    key: PlatformSettingKey.SMTP_USER,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.STRING,
    envVar: 'SMTP_USER',
    defaultValue: null,
  }),
  def({
    key: PlatformSettingKey.SMTP_PASSWORD,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.STRING,
    envVar: 'SMTP_PASSWORD',
    defaultValue: null,
    isSecret: true,
  }),
  def({
    key: PlatformSettingKey.SMTP_FROM,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.STRING,
    envVar: 'SMTP_FROM',
    defaultValue: null,
  }),
  def({
    key: PlatformSettingKey.DIGEST_ENABLED,
    category: PlatformSettingCategory.EMAIL,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'DIGEST_ENABLED',
    defaultValue: 'true',
  }),

  // --- Admin panel warning thresholds ---
  def({
    key: PlatformSettingKey.ADMIN_QUEUE_WAITING_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_QUEUE_WAITING_THRESHOLD',
    defaultValue: '100',
    min: 1,
    max: 100000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_KEEPA_LOW_TOKENS_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_KEEPA_LOW_TOKENS_THRESHOLD',
    defaultValue: '100',
    min: 0,
    max: 1000000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_LLM_FAILURE_RATE_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_LLM_FAILURE_RATE_THRESHOLD',
    defaultValue: '10',
    min: 0,
    max: 100,
  }),
  def({
    key: PlatformSettingKey.ADMIN_LISTING_QUOTA_WARN_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_LISTING_QUOTA_WARN_THRESHOLD',
    defaultValue: '25',
    min: 1,
    max: 1000000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_LISTING_QUOTA_CRITICAL_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_LISTING_QUOTA_CRITICAL_THRESHOLD',
    defaultValue: '100',
    min: 1,
    max: 1000000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_AMAZON_ACCOUNT_QUOTA_WARN_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_AMAZON_ACCOUNT_QUOTA_WARN_THRESHOLD',
    defaultValue: '3',
    min: 1,
    max: 1000,
  }),
  def({
    key: PlatformSettingKey.ADMIN_AMAZON_ACCOUNT_QUOTA_CRITICAL_THRESHOLD,
    category: PlatformSettingCategory.ADMIN,
    type: PlatformSettingType.NUMBER,
    envVar: 'ADMIN_AMAZON_ACCOUNT_QUOTA_CRITICAL_THRESHOLD',
    defaultValue: '10',
    min: 1,
    max: 1000,
  }),
  // --- Feature toggles ---
  def({
    key: PlatformSettingKey.LLM_CONTENT_ENABLED,
    category: PlatformSettingCategory.LLM,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'LLM_CONTENT_ENABLED',
    defaultValue: 'false',
  }),
  def({
    // Secret: stored encrypted and never returned. Resolution is DB override ->
    // LLM_API_KEY env -> unset, so an existing deployment that already carries
    // the env var behaves exactly as before.
    key: PlatformSettingKey.LLM_API_KEY,
    category: PlatformSettingCategory.LLM,
    type: PlatformSettingType.STRING,
    envVar: 'LLM_API_KEY',
    defaultValue: null,
    isSecret: true,
  }),
  def({
    // Off by default: it needs a local model pulled (`ollama pull qwen3:1.7b`).
    // Turning it on costs nothing on the local provider, and a failure falls
    // back to the deterministic layers.
    key: PlatformSettingKey.EBAY_ASPECTS_LLM_ENABLED,
    category: PlatformSettingCategory.LLM,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'EBAY_ASPECTS_LLM_ENABLED',
    defaultValue: 'false',
  }),
  def({
    key: PlatformSettingKey.EBAY_ASPECTS_LLM_MAX_PER_LISTING,
    category: PlatformSettingCategory.LLM,
    type: PlatformSettingType.NUMBER,
    envVar: 'EBAY_ASPECTS_LLM_MAX_PER_LISTING',
    defaultValue: '3',
    min: 0,
    max: 20,
  }),
  def({
    // THE master switch for the whole billing plan. Default `true` since the
    // 30-day trial (migration 097): with it `false`, every quota limit — the
    // trial's included — is inert and the trial has no cost ceiling at all.
    // A fresh install with no DB override and no env var now enforces quotas,
    // which is the point. Flip it off per deployment only to stage a rollout.
    key: PlatformSettingKey.BILLING_ENFORCEMENT_ENABLED,
    category: PlatformSettingCategory.BILLING,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'BILLING_ENFORCEMENT_ENABLED',
    defaultValue: 'true',
  }),
  def({
    key: PlatformSettingKey.BILLING_TRIAL_DAYS,
    category: PlatformSettingCategory.BILLING,
    type: PlatformSettingType.NUMBER,
    envVar: 'BILLING_TRIAL_DAYS',
    defaultValue: '30',
    min: 1,
    max: 90,
  }),
  def({
    key: PlatformSettingKey.BILLING_WEBHOOK_GRACE_HOURS,
    category: PlatformSettingCategory.BILLING,
    type: PlatformSettingType.NUMBER,
    envVar: 'BILLING_WEBHOOK_GRACE_HOURS',
    defaultValue: '6',
    min: 0,
    max: 72,
  }),
  def({
    key: PlatformSettingKey.BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS,
    category: PlatformSettingCategory.BUYER_MESSAGING,
    type: PlatformSettingType.NUMBER,
    envVar: 'BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS',
    defaultValue: '3',
    min: 0,
    max: 60,
  }),

  // --- Tracking-number conversion (Aquiline) ---
  // Turns the Amazon tracking number into an AQUAA…YQ number carried under the
  // AQUILINE carrier, so the buyer never sees the supplier. Off until an API
  // key exists: with no key every order falls back to the honest pass-through,
  // which is exactly the behaviour before this feature.
  def({
    key: PlatformSettingKey.AQUILINE_BASE_URL,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.STRING,
    envVar: 'AQUILINE_BASE_URL',
    // Was https://api.aquiline-tracking.com/v3 — the partner/courier API, which
    // has no Amazon TBA conversion at all.
    defaultValue: 'https://aquiline-tracking.com/app/api/integration',
  }),
  def({
    key: PlatformSettingKey.AQUILINE_API_KEY,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.STRING,
    envVar: 'AQUILINE_API_KEY',
    defaultValue: null,
    isSecret: true,
  }),
  def({
    key: PlatformSettingKey.AQUILINE_TIMEOUT_MS,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AQUILINE_TIMEOUT_MS',
    defaultValue: '15000',
    min: 1000,
    max: 60000,
  }),
  def({
    key: PlatformSettingKey.AQUILINE_WEBHOOK_SECRET,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.STRING,
    envVar: 'AQUILINE_WEBHOOK_SECRET',
    defaultValue: null,
    isSecret: true,
  }),
  def({
    key: PlatformSettingKey.AQUILINE_WEBHOOK_MAX_AGE_MINUTES,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AQUILINE_WEBHOOK_MAX_AGE_MINUTES',
    defaultValue: '1440',
    min: 5,
    max: 20160,
  }),
  def({
    // One Aquiline account serves every environment and there is no test
    // tenant, so a profile created in development burns a production slot
    // permanently. The prefix keeps those distinguishable and stops a dev
    // order being upserted into a real seller's profile.
    key: PlatformSettingKey.AQUILINE_PROFILE_PREFIX,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.STRING,
    envVar: 'AQUILINE_PROFILE_PREFIX',
    defaultValue: 'sh',
  }),
  def({
    key: PlatformSettingKey.AQUILINE_MAX_PROFILES,
    category: PlatformSettingCategory.AMAZON,
    type: PlatformSettingType.NUMBER,
    envVar: 'AQUILINE_MAX_PROFILES',
    defaultValue: '10', // Starter. 25 / 50 / 100 / 250 up the ladder.
    min: 1,
    max: 1000,
  }),

  // --- Chromium profile disk GC ---
  // `BrowserStateManager` bounds resident MEMORY; this bounds DISK. Without it
  // a per-account user_data_dir grows without limit and a deleted account
  // leaks its profile forever (50–250 GB at 500 accounts).
  def({
    key: PlatformSettingKey.BROWSER_PROFILE_GC_ENABLED,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'BROWSER_PROFILE_GC_ENABLED',
    defaultValue: 'true',
  }),
  def({
    // A full profile removal forces an Amazon re-login, which can land a
    // captcha/OTP and take a buyer account out of service — so the window is
    // months, not days. By 90 days Amazon has usually expired the session
    // server-side anyway, making the eviction effectively free.
    key: PlatformSettingKey.BROWSER_PROFILE_GC_DORMANT_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'BROWSER_PROFILE_GC_DORMANT_DAYS',
    defaultValue: '90',
    min: 0,
    max: 3650,
  }),
  def({
    key: PlatformSettingKey.BROWSER_PROFILE_GC_PURGE_ORPHANS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.BOOLEAN,
    envVar: 'BROWSER_PROFILE_GC_PURGE_ORPHANS',
    defaultValue: 'true',
  }),

  // --- Append-only table retention ---
  // Every one of these tables grows forever by design. `keepa_usage_log` is
  // the fastest: one row per REQUESTED ASIN per refresh, ~26M rows/year at a
  // full refresh schedule. Defaults keep enough history for the admin FinOps
  // period views without letting the DB become the disk constraint.
  def({
    key: PlatformSettingKey.RETENTION_QUEUE_OBSERVATIONS_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'QUEUE_OBSERVABILITY_RETENTION_DAYS',
    defaultValue: '7',
    min: 1,
    max: 90,
  }),
  def({
    key: PlatformSettingKey.RETENTION_KEEPA_USAGE_LOG_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_KEEPA_USAGE_LOG_DAYS',
    defaultValue: '90',
    min: 7,
    max: 3650,
  }),
  def({
    key: PlatformSettingKey.RETENTION_LLM_USAGE_LOG_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_LLM_USAGE_LOG_DAYS',
    defaultValue: '90',
    min: 7,
    max: 3650,
  }),
  def({
    // The FinOps projection the admin Costs tab reads. Kept longer than its
    // source logs so month-over-month comparisons survive a source purge.
    key: PlatformSettingKey.RETENTION_USAGE_EVENTS_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_USAGE_EVENTS_DAYS',
    defaultValue: '400',
    min: 30,
    max: 3650,
  }),
  def({
    // ALSO the buyer-messaging idempotency guard: the partial unique index on
    // (ebay_order_id, event_type) WHERE status='sent' is what stops a buyer
    // being messaged twice. Purging a row re-arms that event for its order, so
    // the floor must comfortably exceed any order's lifecycle.
    key: PlatformSettingKey.RETENTION_BUYER_MESSAGE_LOG_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_BUYER_MESSAGE_LOG_DAYS',
    defaultValue: '400',
    min: 180,
    max: 3650,
  }),
  def({
    // Compliance evidence (role changes, platform-setting edits). Long floor —
    // this is the table you need when answering "who changed what, when".
    key: PlatformSettingKey.RETENTION_AUDIT_LOGS_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_AUDIT_LOGS_DAYS',
    defaultValue: '730',
    min: 365,
    max: 3650,
  }),
  def({
    // The listing detail page's "Revisions" drawer. Not correctness-load-bearing
    // like buyer_message_log — losing an old row only loses history, nothing
    // re-arms — so the floor is short like the other diagnostic/history tables.
    key: PlatformSettingKey.RETENTION_LISTING_REVISIONS_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_LISTING_REVISIONS_DAYS',
    defaultValue: '30',
    min: 30,
    max: 3650,
  }),
  def({
    // The Best Sellers view ledger (migration 125). SUM(product_count) over the
    // current billing window IS the seller's used allowance, so a row deleted
    // inside that window is free allowance handed out. The floor (60) must
    // comfortably exceed one billing period plus the webhook grace (~31 days);
    // the default keeps a year of browsing history for support questions.
    key: PlatformSettingKey.RETENTION_BEST_SELLERS_VIEWS_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_BEST_SELLERS_VIEWS_DAYS',
    defaultValue: '400',
    min: 60,
    max: 3650,
  }),
  def({
    // eBay NEW_MESSAGE notification inbox. Only the notification_id UNIQUE is
    // load-bearing (dedupe of retried deliveries, which eBay stops after 3
    // attempts), so a week is the floor and 90 days is ample.
    key: PlatformSettingKey.RETENTION_EBAY_NOTIFICATION_EVENTS_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_EBAY_NOTIFICATION_EVENTS_DAYS',
    defaultValue: '90',
    min: 7,
    max: 730,
  }),
  def({
    // Verbatim capture of every eBay notification POST — diagnostic only.
    key: PlatformSettingKey.RETENTION_EBAY_NOTIFICATION_RAW_CAPTURES_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_EBAY_NOTIFICATION_RAW_CAPTURES_DAYS',
    defaultValue: '30',
    min: 7,
    max: 365,
  }),
  def({
    // Audit trail of automatic Amazon purchases (migration 132). The record an
    // operator reads when investigating a duplicate or a missing purchase, so
    // it outlives every order lifecycle by a wide margin.
    key: PlatformSettingKey.RETENTION_AUTO_FULFILL_EVENTS_DAYS,
    category: PlatformSettingCategory.RETENTION,
    type: PlatformSettingType.NUMBER,
    envVar: 'RETENTION_AUTO_FULFILL_EVENTS_DAYS',
    defaultValue: '400',
    min: 90,
    max: 3650,
  }),
];

/** Registry lookup by key. Unknown keys are rejected at the API boundary. */
export const PLATFORM_SETTINGS_BY_KEY: ReadonlyMap<PlatformSettingKey, PlatformSettingDefinition> =
  new Map(PLATFORM_SETTING_DEFINITIONS.map((d) => [d.key, d]));
