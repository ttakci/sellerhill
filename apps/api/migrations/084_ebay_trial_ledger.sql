-- 084_ebay_trial_ledger.sql
--
-- Stops the free trial being farmed by re-registering with the same eBay store.
--
-- The existing protection is real but incomplete. `002_create_ebay_accounts.sql`
-- puts a UNIQUE index on (seller_id, marketplace_id), so one eBay store can only
-- be connected to one SellerHill account at a time — and there is no disconnect
-- endpoint, so the binding is effectively permanent while the account lives.
-- Combined with `EbayAccountGuard` (every data screen is useless without a
-- connected store), the scarce resource gating a trial is already the eBay
-- store rather than the email address.
--
-- The gap: `ebay_accounts.user_id` is ON DELETE CASCADE. Delete the user and the
-- row goes with it, releasing the store to be connected again — and the trial is
-- granted per USER at registration (auth.service.ts -> startTrialForUser), so
-- the new account gets a fresh one.
--
-- This table is the permanent record that survives that deletion. It is
-- deliberately NOT a foreign key to ebay_accounts: the whole point is to outlive
-- the row. `first_user_id` is ON DELETE SET NULL so the ledger entry survives a
-- user deletion with the attribution simply going null.
--
-- Note this records trial CONSUMPTION, not eBay connection. Connecting a store
-- to an account that is already paying does not consume anything.

CREATE TABLE IF NOT EXISTS ebay_trial_ledger (
    -- The eBay-side seller identity. Same shape as ebay_accounts.seller_id /
    -- .marketplace_id so the two can be compared directly.
    seller_id       VARCHAR(255) NOT NULL,
    marketplace_id  VARCHAR(50)  NOT NULL,
    -- Who consumed it. NULL once that user is deleted — the ledger entry
    -- remains, which is the entire purpose of this table.
    first_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    consumed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One trial per store per marketplace, forever. This PK is the enforcement:
    -- the insert is attempted inside the trial grant and a conflict means the
    -- store has already had its trial.
    PRIMARY KEY (seller_id, marketplace_id)
);

CREATE INDEX IF NOT EXISTS idx_ebay_trial_ledger_user
    ON ebay_trial_ledger(first_user_id)
    WHERE first_user_id IS NOT NULL;

-- Backfill: every store connected before this migration is treated as having
-- consumed its trial. Without this, existing users could disconnect (once that
-- is possible) or delete and re-register for a second one. `MIN(created_at)`
-- keeps the earliest connection as the consumption timestamp.
INSERT INTO ebay_trial_ledger (seller_id, marketplace_id, first_user_id, consumed_at)
SELECT DISTINCT ON (e.seller_id, e.marketplace_id)
    e.seller_id, e.marketplace_id, e.user_id, e.created_at
FROM ebay_accounts e
ORDER BY e.seller_id, e.marketplace_id, e.created_at ASC
ON CONFLICT (seller_id, marketplace_id) DO NOTHING;
