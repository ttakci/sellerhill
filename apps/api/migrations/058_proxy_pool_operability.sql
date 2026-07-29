-- 058: Proxy pool operability — expiry tracking + cost attribution (admin panel).
--
-- Fixed ISP proxies are bought on ~30-day renewals. The operator needs to see
-- WHEN each proxy expires (renew-or-lose-the-IP: a lapsed proxy's static IP is
-- released by the provider and the "one household" continuity for the assigned
-- user is lost) and WHAT the pool costs per month, without leaving the app.
--
-- Cost follows the platform micro-USD convention (BIGINT, 1/1,000,000 USD):
-- NULL means unknown and must never be rendered as 0; currency is pair-coupled
-- with the cost value (both set or both NULL).
ALTER TABLE proxies
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_cost_micros BIGINT,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3);

-- Admin "expiring soon" alert scan: only ACTIVE proxies with a known expiry
-- ever match, and the pool is small — a partial index keeps it index-only.
CREATE INDEX IF NOT EXISTS idx_proxies_active_expiry
  ON proxies (expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;
