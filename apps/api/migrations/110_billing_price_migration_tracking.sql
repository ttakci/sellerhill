-- Automatic price migration bookkeeping (operator decision, 2026-09-17).
--
-- When a plan's price changes, every existing subscriber moves onto the new
-- price from their NEXT renewal — the period they are in finishes at the price
-- they already paid. The `billing-price-migration` job does this hourly with no
-- operator step. These columns are how it knows what it has already done, so a
-- healthy subscriber costs no Stripe call on every run:
--
--   price_evaluated_for_price_id    the plan price this subscription was last
--                                   brought in line with (already on it, or
--                                   scheduled to move to it). The job only
--                                   looks at rows where this differs from the
--                                   plan's CURRENT price — i.e. right after a
--                                   price change, or after the seller changes
--                                   plan.
--   price_change_scheduled_price_id the price a move was scheduled to.
--   price_change_notified_price_id  the price the seller was e-mailed about.
--                                   Kept separate from the schedule so a notice
--                                   that failed to send is retried, and one that
--                                   succeeded is never sent twice.
--
-- All NULL for existing rows: the first run after deploy evaluates each live
-- subscription once (one Stripe read), finds it already on its plan's price,
-- and records that.

ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS price_evaluated_for_price_id TEXT,
  ADD COLUMN IF NOT EXISTS price_change_scheduled_price_id TEXT,
  ADD COLUMN IF NOT EXISTS price_change_notified_price_id TEXT;
