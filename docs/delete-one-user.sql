-- Delete ONE SellerHill account and everything belonging to it.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Read this header before running it.
--
-- WHY THIS IS SQL AND NOT A COMMAND
-- `pnpm --filter api reset-users` refuses to run when NODE_ENV=production and
-- against a non-local database, on purpose — a wipe tool that works in
-- production is a wipe tool that eventually runs there by accident. This file
-- is the deliberate, one-account exception: you paste it, you name the account,
-- you see the counts first.
--
-- WHAT GOES
-- Everything that hangs off the user cascades with it: eBay stores, listings,
-- orders, Amazon buyer accounts, store settings, listing settings groups,
-- listing jobs, buyer-message templates and logs, OAuth links, sessions.
-- The three DELETEs before `users` are the rows that deliberately do NOT
-- cascade (see reset-users-helpers.ts, which this mirrors):
--   ebay_trial_ledger   survives an account deletion so one eBay store cannot
--                       claim a second free trial. Removing it here is what
--                       lets you connect the same store again WITH a trial.
--   billing_customers   is ON DELETE SET NULL, so deleting the user would
--                       orphan it. It cascades to subscriptions, usage periods
--                       and the reservation ledgers.
--   aquiline_profiles   has no FK to users at all. NOTE: this clears only OUR
--                       row — the provider-side profile is permanent and a new
--                       one will consume another slot of the Aquiline plan.
--
-- WHAT STAYS
-- Plans, prices, templates, platform settings and the learned eBay taxonomy
-- (category map, aspect defaults) — operator configuration and cross-customer
-- knowledge. Also `products`, the shared ASIN cache: clearing it would re-spend
-- Keepa tokens for every other seller listing the same ASIN.
--
-- STRIPE IS NOT TOUCHED. If this account has a live subscription, cancel it in
-- the Stripe Dashboard first, or it keeps billing a customer that no longer
-- exists here.
--
-- HOW TO RUN (psql):
--   \set target_email 'you@example.com'
--   \i delete-one-user.sql

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1. Look before you delete. Run this on its own first and check the numbers.
-- ---------------------------------------------------------------------------
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
 WHERE LOWER(u.email) = LOWER(:'target_email');

-- ---------------------------------------------------------------------------
-- 2. Delete. One transaction: it all happens or none of it does.
-- ---------------------------------------------------------------------------
BEGIN;

-- The trial ledger keys on the eBay store, so it has to be cleared while the
-- store rows still exist.
DELETE FROM ebay_trial_ledger
 WHERE (seller_id, marketplace_id) IN (
   SELECT ea.seller_id, ea.marketplace_id
     FROM ebay_accounts ea
     JOIN users u ON u.id = ea.user_id
    WHERE LOWER(u.email) = LOWER(:'target_email')
 );

DELETE FROM aquiline_profiles
 WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER(:'target_email'));

DELETE FROM billing_customers
 WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER(:'target_email'));

DELETE FROM users
 WHERE LOWER(email) = LOWER(:'target_email');

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Confirm. Every count must be 0.
-- ---------------------------------------------------------------------------
SELECT (SELECT count(*) FROM users WHERE LOWER(email) = LOWER(:'target_email')) AS users_left,
       (SELECT count(*) FROM ebay_accounts ea
          JOIN users u ON u.id = ea.user_id
         WHERE LOWER(u.email) = LOWER(:'target_email'))                          AS stores_left;
