-- Listings beyond the plan's listing limit stop being automated
-- (operator decision, 2026-09-17).
--
-- A seller can hold more ACTIVE listings than their plan allows — a downgrade
-- takes effect at period end, and listings that already exist are never ended
-- for them. Until now the platform simply kept automating every one of them.
-- The rule is now: the OLDEST listings, up to the limit, stay tracked; the rest
-- are left alone on eBay (no price/stock sync, no Keepa refresh) and their
-- orders are not automated (no auto-purchase, no shipment tracking, no
-- tracking conversion). The orders themselves are still ingested and visible.
--
-- WHY A STORED FLAG RATHER THAN A LIVE RANK:
-- The Keepa refresh claim runs every minute and the price/stock fan-out on
-- every product change. Ranking every user's listings inside those queries
-- would be a window function over the whole listings table on each tick. The
-- flag is recomputed per user by the `billing-listing-plan-limit` job instead,
-- and readers pay one boolean predicate.
--
-- WHY THE ORDER CARRIES ITS OWN FLAG:
-- `orders.listing_over_plan_limit` is decided ONCE, when the order is first
-- ingested, and never changes. Reading the listing's live flag later would let
-- an order flip mid-flight — an auto-purchase already made for a tracked
-- listing would lose its shipment tracking the moment a downgrade landed. This
-- is the same "decided at first ingest" rule `orders.listing_id` already
-- follows. Existing orders default to FALSE, so nothing in flight changes.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS over_plan_limit BOOLEAN NOT NULL DEFAULT FALSE;

-- Almost every row is FALSE; the reconcile job only ever needs the TRUE ones.
CREATE INDEX IF NOT EXISTS idx_listings_over_plan_limit
  ON listings (user_id)
  WHERE over_plan_limit = TRUE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS listing_over_plan_limit BOOLEAN NOT NULL DEFAULT FALSE;
