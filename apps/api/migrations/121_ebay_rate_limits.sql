-- eBay's own API call limits, as eBay last reported them.
--
-- The governor's daily ceilings used to be platform settings an operator typed
-- in from eBay's published table. They are now taken from eBay's getRateLimits
-- and from nowhere else: no panel entry, no env var, no code default. This
-- table holds the last answer eBay gave, so a restart, a deploy or an Analytics
-- outage does not lose it — a failed refresh changes nothing.
--
-- One row, always. `resources` is the flattened response (every resource eBay
-- reports, including ones we do not govern), so the admin panel can show
-- eBay's whole picture rather than only the rows that happen to map.

CREATE TABLE IF NOT EXISTS ebay_rate_limits (
    id          SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    resources   JSONB       NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL
);

-- The six hand-typed ceilings are gone from the registry; their override rows
-- would otherwise sit in platform_settings with nothing reading them.
DELETE FROM platform_settings
 WHERE key IN (
   'ebay.budget.inventoryDailyLimit',
   'ebay.budget.taxonomyDailyLimit',
   'ebay.budget.accountDailyLimit',
   'ebay.budget.fulfillmentDailyLimit',
   'ebay.budget.tradingDailyLimit',
   'ebay.budget.feedDailyLimit'
 );
