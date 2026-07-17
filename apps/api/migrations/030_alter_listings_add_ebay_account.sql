-- Multi-store: associate listings with the eBay account they were published on
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS ebay_account_id UUID REFERENCES ebay_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listings_ebay_account_id ON listings(ebay_account_id)
  WHERE ebay_account_id IS NOT NULL;

-- Best-effort backfill: if user has exactly one eBay account, attach orphan listings
UPDATE listings l
SET ebay_account_id = ea.id
FROM (
  SELECT user_id, MIN(id::text)::uuid AS id
  FROM ebay_accounts
  GROUP BY user_id
  HAVING COUNT(*) = 1
) ea
WHERE l.user_id = ea.user_id
  AND l.ebay_account_id IS NULL;
