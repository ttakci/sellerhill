# Billing and Package System

## Product model

Zonds uses simple capacity-based packages. Customers do not see Keepa tokens, LLM tokens, API calls, or internal queue units. The visible limits are:

- Active listings
- Monthly automatic orders (AO)

Initial catalog values are database seed values and are intentionally changeable before launch:

| Plan | Active listings | Automatic orders/month | Initial monthly price |
|---|---:|---:|---:|
| Starter | 1,500 | 150 | $39 |
| Growth | 2,500 | 250 | $55 |
| Scale | 4,500 | 450 | $75 |

Prices, yearly prices, limits, ordering, active state, and Paddle price IDs are stored in billing catalog tables. Do not hardcode package values in application logic or UI.

## Database and migrations

- `052_create_billing_foundation.sql` creates plans, prices, limits, customers, subscriptions, usage periods, listing reservations, AO reservations, and webhook inbox tables.
- `053_billing_quota_enforcement.sql` adjusts reservation key types/nullability and adds idempotent quota reservation support.
- Plan limits are resolved from the current subscription and catalog. A subscription-less user has full access while `BILLING_ENFORCEMENT_ENABLED=false`.

Migrations run automatically through the existing API migration runner. Paddle identifiers remain nullable until the Paddle account and products exist.

## Billing backend

The module is under `apps/api/src/modules/billing/`.

- `BillingRepositoryService` owns raw PostgreSQL reads/writes.
- `BillingService` exposes catalog, summary, checkout, and portal use cases.
- `PaddleBillingProvider` is behind a provider port; missing Paddle configuration fails safely and never fabricates a successful checkout.
- `PaddleWebhookProcessor` verifies signatures, stores an idempotent inbox event, rejects stale/out-of-order state, and applies subscription updates transactionally.
- `BILLING_ENFORCEMENT_ENABLED=false` is the migration/transition default. It reports `full_access` without creating a fake subscription.

Required runtime settings are documented in `apps/api/.env.example` and validated in `env.validation.ts`. Paddle uses Merchant of Record responsibilities for customer-facing indirect taxes; Zonds still owns LLC income/accounting obligations.

## Quota semantics

### Listings

Active listings plus open listing reservations count toward the limit. Draft and ended listings do not. Bulk creation and publishing reserve capacity under a PostgreSQL advisory transaction lock. Queue success consumes a reservation; terminal failure releases it. A downgrade never disables existing listings; it blocks only new create/publish operations until usage is below the new limit.

### Automatic orders

AO quota is per user and per UTC calendar month. A reservation is idempotent by eBay order ID, so retries do not double-count. Reservation occurs before enqueue, consumption occurs only after Amazon confirms placement, and blocked/final-failed checkout releases the reservation. Existing placed orders and tracking continue even when the quota is exhausted. Exhaustion produces the shared `quota_exhausted` attention reason.

## Customer UI

The billing feature is under `apps/web/src/features/billing/`. Settings shows the current subscription/transition state, listing usage, monthly AO usage, and a simple monthly/yearly comparison. Upgrade/manage actions are unavailable until Paddle is configured. Landing pricing reads the public billing catalog rather than owning a second price/limit definition.

All visible text is localized in English and Turkish. Do not add token-based pricing copy.

## Admin and FinOps

Admin billing metrics are exposed by `GET /v1/admin/billing/metrics` and displayed in the admin Billing tab. They show cost totals, account/access distributions, and quota pressure. Unknown costs remain `null`; a real zero remains `0`. Existing `UserRole.ADMIN`, `RolesGuard`, and privileged-session controls remain the authorization source.

## Paddle launch checklist

1. Create Paddle sandbox products and monthly/yearly prices.
2. Store Paddle product/price IDs in the billing catalog rows.
3. Configure `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, client token, environment, and return URLs.
4. Keep enforcement disabled while testing catalog, checkout, webhook, cancellation, renewal, failed-payment, and portal flows.
5. Verify webhook retries, duplicate events, stale events, upgrades, downgrades, and period rollover.
6. Run a low-volume live subscription test.
7. Enable `BILLING_ENFORCEMENT_ENABLED=true` only after the live test and operational monitoring are ready.

## Future technical documents

Future billing docs should cover provider-specific Paddle event payloads, reconciliation/runbooks, tax/accounting boundaries, pricing experiments, margin analysis, usage dashboards, refunds/chargebacks, and plan migration policy. The canonical implementation facts are kept here and in `CLAUDE.md`; do not create a second independent plan model.
