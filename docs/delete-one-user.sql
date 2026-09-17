-- Delete ONE SellerHill account and everything belonging to it.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Read this header before running it.
--
-- HOW TO RUN
-- Put the account's e-mail in the one place marked below, then run the three
-- numbered blocks in order. Plain SQL only — no psql-specific commands — so it
-- works the same in DBeaver, pgAdmin, psql or any other client.
--
-- WHY THIS IS SQL AND NOT A COMMAND
-- `pnpm --filter api reset-users` refuses to run when NODE_ENV=production and
-- against a non-local database, on purpose: a wipe tool that works in
-- production is a wipe tool that eventually runs there by accident. This file
-- is the deliberate, one-account exception — you name the account, you see the
-- counts first, and it all happens in one transaction.
--
-- WHAT GOES
-- Everything hanging off the user cascades with it: eBay stores, listings,
-- orders, Amazon buyer accounts, store settings, listing settings groups,
-- listing jobs, buyer-message templates and logs, OAuth links, sessions.
-- The three DELETEs before `users` are the rows that deliberately do NOT
-- cascade (this mirrors reset-users-helpers.ts):
--   ebay_trial_ledger   survives an account deletion so one eBay store cannot
--                       claim a second free trial. Removing it here is what
--                       lets you connect the same store again WITH a trial.
--   billing_customers   is ON DELETE SET NULL, so deleting the user would
--                       orphan it. It cascades on to subscriptions, usage
--                       periods and the reservation ledgers.
--   aquiline_profiles   has no FK to users at all. NOTE: this clears only OUR
--                       row — the provider-side profile is permanent and a new
--                       one consumes another slot of the Aquiline plan.
--
-- WHAT STAYS
-- Plans, prices, e-mail templates, platform settings and the learned eBay
-- taxonomy — operator configuration and cross-customer knowledge. Also
-- `products`, the shared ASIN cache: clearing it would re-spend Keepa tokens
-- for every other seller listing the same ASIN.
--
-- STRIPE IS NOT TOUCHED. If the account has a live subscription, cancel it in
-- the Stripe Dashboard first, or it keeps billing a customer that no longer
-- exists here.

-- ===========================================================================
-- 1. NAME THE ACCOUNT, AND LOOK BEFORE YOU DELETE.
--    Replace the e-mail below, run this block, and check the numbers.
-- ===========================================================================
SELECT u.id,
       u.email,
       u.status,
       (SELECT count(*) FROM ebay_accounts    WHERE user_id = u.id) AS ebay_stores,
       (SELECT count(*) FROM listings         WHERE user_id = u.id) AS listings,
       (SELECT count(*) FROM orders           WHERE user_id = u.id) AS orders,
       (SELECT count(*) FROM amazon_accounts  WHERE user_id = u.id) AS amazon_accounts,
       (SELECT count(*) FROM billing_subscriptions s
          JOIN billing_customers c ON c.id = s.customer_id
         WHERE c.user_id = u.id)                                    AS subscriptions
  FROM users u
 WHERE LOWER(u.email) = LOWER('REPLACE_WITH_EMAIL');

-- ===========================================================================
-- 2. DELETE. Replace the SAME e-mail once more, then run this whole block.
--    It is one transaction: it all happens, or none of it does.
-- ===========================================================================
BEGIN;

-- The e-mail is captured once here; every statement below reads it from this
-- temporary table, so there is no second copy to get wrong.
CREATE TEMP TABLE _account_to_delete ON COMMIT DROP AS
SELECT id, email FROM users WHERE LOWER(email) = LOWER('REPLACE_WITH_EMAIL');

-- Refuses to continue unless exactly one account matched — a typo that matches
-- nothing (or, worse, several) must not fall through into the DELETEs below.
DO $$
DECLARE
  matched int;
BEGIN
  SELECT count(*) INTO matched FROM _account_to_delete;
  IF matched <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 account, found %. Nothing was deleted.', matched;
  END IF;
END $$;

-- The trial ledger keys on the eBay store, so it must be cleared while the
-- store rows still exist.
DELETE FROM ebay_trial_ledger
 WHERE (seller_id, marketplace_id) IN (
   SELECT ea.seller_id, ea.marketplace_id
     FROM ebay_accounts ea
     JOIN _account_to_delete a ON a.id = ea.user_id
 );

DELETE FROM aquiline_profiles
 WHERE user_id IN (SELECT id FROM _account_to_delete);

DELETE FROM billing_customers
 WHERE user_id IN (SELECT id FROM _account_to_delete);

DELETE FROM users
 WHERE id IN (SELECT id FROM _account_to_delete);

COMMIT;

-- ===========================================================================
-- 3. CONFIRM. Same e-mail; every count must be 0.
-- ===========================================================================
SELECT (SELECT count(*) FROM users
          WHERE LOWER(email) = LOWER('REPLACE_WITH_EMAIL'))                    AS users_left,
       (SELECT count(*) FROM ebay_accounts ea
          JOIN users u ON u.id = ea.user_id
         WHERE LOWER(u.email) = LOWER('REPLACE_WITH_EMAIL'))                   AS stores_left;
