-- Self-service "disconnect this eBay store" (operator request, 2026-09-17).
--
-- WHY A NEW STATUS RATHER THAN REUSING 'revoked':
-- The Action Center renders `revoked` as a CRITICAL "your connection broke,
-- fix it" alarm. A seller who deliberately disconnected their own store has
-- not broken anything, and an alarm they cannot clear is exactly what makes
-- an action list stop being read (see CLAUDE.md "A settled sale is never
-- action-required" for the same lesson learned on orders). So intent gets its
-- own value.
--
-- WHY THE ROW IS NEVER DELETED:
-- `orders.ebay_account_id` is ON DELETE CASCADE — deleting an ebay_accounts
-- row would destroy that store's ENTIRE order history, which is financial and
-- tax evidence this codebase otherwise never deletes (the eBay account
-- deletion webhook nulls buyer PII and deliberately keeps the order row).
-- `listings.ebay_account_id` is ON DELETE SET NULL, which would orphan every
-- listing from the store that published it. Disconnect is therefore a state
-- change, never a delete.
--
-- WHY THIS IS SAFE WITHOUT TOUCHING ANY WORKER:
-- Every account/token accessor in ebay.service.ts already filters on
-- `status = 'active'` (getAccountAccessToken, getActiveAccountAccessToken,
-- getActiveAccountId and the per-account lookup). Moving a row out of
-- 'active' therefore stops order sync, auto-fulfill, tracking pushes and
-- every other background path for that store structurally, rather than by
-- remembering to add a check in each worker.
--
-- `disconnected_at` records WHEN, for support/audit questions ("my orders
-- stopped syncing on the 3rd") that a bare status flag cannot answer.

ALTER TABLE ebay_accounts
  DROP CONSTRAINT IF EXISTS ebay_accounts_status_check;

ALTER TABLE ebay_accounts
  ADD CONSTRAINT ebay_accounts_status_check
  CHECK (status IN ('active', 'revoked', 'error', 'disconnected'));

ALTER TABLE ebay_accounts
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;

-- Disconnect NULLs the stored credentials rather than leaving them at rest
-- behind a status flag, so the three token columns can no longer be NOT NULL.
-- A disconnected store genuinely has no token — representing that as an empty
-- string instead would leave a value that some future caller could try to
-- decrypt. Active rows are unaffected: every connect/reconnect path writes all
-- three, and every reader filters on `status = 'active'`.
ALTER TABLE ebay_accounts
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN refresh_token DROP NOT NULL,
  ALTER COLUMN access_token_expires_at DROP NOT NULL;
