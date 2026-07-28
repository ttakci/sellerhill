-- Keepa responses report refillRate (tokens generated per minute — the plan
-- tier). Persisting it alongside each balance snapshot lets admission control
-- and admin monitoring reason about sustainable refresh throughput without
-- hardcoding the purchased plan.
ALTER TABLE keepa_balance ADD COLUMN IF NOT EXISTS refill_rate INT;
