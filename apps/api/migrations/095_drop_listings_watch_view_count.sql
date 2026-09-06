-- Migration 095: drop listings.watch_count / listings.view_count.
--
-- WHY
-- ---
-- eBay's watcher/view counts are only available via the Trading API `GetItem`
-- call, and this platform deliberately never calls Trading — everything runs on
-- the Inventory API. Trading's shared per-application ceiling is 5,000 calls/day
-- for ALL sellers combined (vs 2,000,000/day for Inventory), so keeping these
-- two numbers current would cost one `GetItem` per listing per refresh and
-- exhaust the whole Trading budget — stopping that operation for every seller —
-- in exchange for two showroom figures a seller cannot act on. (`sold_count` is
-- kept live instead: it rides the order-sync insert path for free.)
--
-- The columns were stripped from the DTOs, API, list/detail UI, filters, CSV
-- export and i18n on 2026-08-11 and have had zero readers/writers since
-- (verified by grep across apps/ and packages/src). They are plain
-- `INT DEFAULT 0` columns with no index and no FK. `010`/`017` (which created
-- them) are untouched — this is a new file.

ALTER TABLE listings
  DROP COLUMN IF EXISTS watch_count,
  DROP COLUMN IF EXISTS view_count;
