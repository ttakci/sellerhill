-- =============================================================================
-- 088: fix idx_billing_subscriptions_provider to be a UNIQUE partial index.
--
-- WHY
--   Migration 052 created this as a plain (non-unique) partial index, but
--   BillingRepositoryService.upsertSubscriptionByProvider has always issued
--   `ON CONFLICT (provider_subscription_id) WHERE provider_subscription_id
--   IS NOT NULL` against it. Postgres requires the ON CONFLICT target to
--   match an actual unique constraint/index -- a plain index cannot serve
--   as one. Every real customer.subscription.created webhook has therefore
--   failed at insert time since 052 shipped ("there is no unique or
--   exclusion constraint matching the ON CONFLICT specification"), first
--   observed live 2026-08-21 on the first sandbox subscription created
--   through Checkout. No subscription has ever been persisted through this
--   path, so there is nothing to deduplicate before swapping the index.
-- =============================================================================

DROP INDEX IF EXISTS idx_billing_subscriptions_provider;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_provider
    ON billing_subscriptions(provider_subscription_id)
    WHERE provider_subscription_id IS NOT NULL;
