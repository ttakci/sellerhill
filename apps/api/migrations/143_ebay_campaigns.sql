-- Ad Campaigns (spec 2026-10-03 Part B). One row per eBay campaign of a store,
-- mirrored by the campaign sweep; the listing columns say which ad each
-- listing runs. `ad_rate_applied` is the ONE figure pricing reads: the
-- listing's fixed ad rate while its campaign is a RUNNING cost-per-sale fixed
-- campaign, else 0 (resolveAppliedAdRate, shared). ebay_accounts.promoted_campaign_id
-- (migration 138) is left in place, unread.
CREATE TABLE IF NOT EXISTS ebay_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ebay_account_id UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  funding_model TEXT NULL,
  ad_rate_strategy TEXT NULL,
  bid_percentage NUMERIC(5,1) NULL,
  rule_based BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_sellerhill BOOLEAN NOT NULL DEFAULT FALSE,
  start_date TIMESTAMPTZ NULL,
  end_date TIMESTAMPTZ NULL,
  ad_count INT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB NULL,
  metrics_from DATE NULL,
  metrics_to DATE NULL,
  metrics_fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ebay_account_id, campaign_id)
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted_campaign_id TEXT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted_ad_strategy TEXT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted_synced_at TIMESTAMPTZ NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ad_rate_applied NUMERIC(5,1) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_listings_promoted_campaign
  ON listings (ebay_account_id, promoted_campaign_id)
  WHERE promoted_campaign_id IS NOT NULL;

ALTER TABLE ebay_accounts ADD COLUMN IF NOT EXISTS last_campaign_sync_at TIMESTAMPTZ NULL;
ALTER TABLE ebay_accounts ADD COLUMN IF NOT EXISTS last_campaign_report_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_last_campaign_sync_at
  ON ebay_accounts (last_campaign_sync_at NULLS FIRST)
  WHERE status = 'active';
