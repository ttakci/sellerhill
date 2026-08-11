-- apps/api/migrations/076_create_listing_revisions.sql
-- History of price/quantity changes for a listing, surfaced in the detail
-- page's "Revisions" drawer.
--
-- Before this migration, a price/quantity change was a silent in-place
-- UPDATE (ProductSyncService.persistApplied) — nothing recorded what the
-- value used to be, so there was no history to show. This table is written
-- from that exact call site (and only there): the Keepa refresh fan-out and
-- the sale-driven stock-sync queue both route through it already (see
-- CLAUDE.md's "Product Refresh Pipeline" / "Sale-Driven Stock Sync"), so it
-- is the one place a change is EVER applied to an existing listing's
-- commerce fields. A row is written only when `hasCommerceDelta` already
-- found a real change — no row is written per refresh tick that changed
-- nothing.
--
-- Deliberately excludes the listing's own creation (draft or live publish):
-- that is the birth of the row, not a revision to it, and the create path
-- writes through a different service entirely.

CREATE TABLE IF NOT EXISTS listing_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    previous_price DECIMAL(10,2) NOT NULL,
    new_price DECIMAL(10,2) NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Drives both "revisions for this listing, newest first" (the drawer) and the
-- retention purge's age scan.
CREATE INDEX IF NOT EXISTS idx_listing_revisions_listing_id_recorded_at
    ON listing_revisions(listing_id, recorded_at DESC);
