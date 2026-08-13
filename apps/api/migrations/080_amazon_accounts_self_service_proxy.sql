-- Per-account, user-supplied proxy (replaces the platform-paid `proxies` pool
-- as the source of Amazon browser-automation proxying). The pool table and its
-- rows are left in place (never drop an applied migration's table) but are no
-- longer read by any code path — see CLAUDE.md "Amazon Scraping — Anti-Ban
-- Strategy" for the retirement rationale.
ALTER TABLE amazon_accounts
  ADD COLUMN IF NOT EXISTS proxy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proxy_connection_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS proxy_host VARCHAR(255),
  ADD COLUMN IF NOT EXISTS proxy_port INTEGER,
  ADD COLUMN IF NOT EXISTS proxy_username VARCHAR(255),
  ADD COLUMN IF NOT EXISTS proxy_password VARCHAR(500);
