# Billing and Package System

## Product model

SellerHill uses simple capacity-based packages. Customers do not see Keepa tokens, LLM tokens, API calls, or internal queue units. The visible limits are:

- Active listings
- Monthly automatic orders (AO)

Initial catalog values are database seed values and are intentionally changeable before launch:

| Plan | Active listings | Automatic orders/month | Monthly price |
|---|---:|---:|---:|
| Lite | 200 | 25 | $19.99 |
| Nano | 500 | 50 | $24.99 |
| Micro | 1,000 | 100 | $29.99 |
| Starter | 2,000 | 150 | $44.99 |
| Basic | 3,000 | 200 | $59.99 |
| Plus | 4,000 | 250 | $84.99 |
| Growth | 5,000 | 300 | $104.99 |
| Advanced | 7,500 | 350 | $159.99 |
| Pro | 10,000 | 500 | $179.99 |
| Elite | 15,000 | 600 | $319.99 |
| Business | 20,000 | 700 | $429.99 |
| Enterprise | 25,000 | 800 | $529.99 |

Monthly billing only — there is no annual interval. Set by migration `083_billing_plans_v2.sql`; the cost model behind these figures (Aquiline per-shipment conversion, Keepa refresh tokens, Stripe fees, listing churn) is summarised in CLAUDE.md.

Prices, limits, ordering, active state, and Stripe price IDs are stored in billing catalog tables. Do not hardcode package values in application logic or UI.

## Database and migrations

- `052_create_billing_foundation.sql` creates plans, prices, limits, customers, subscriptions, usage periods, listing reservations, AO reservations, and webhook inbox tables.
- `053_billing_quota_enforcement.sql` adjusts reservation key types/nullability and adds idempotent quota reservation support.
- `083_billing_plans_v2.sql` replaces the placeholder 3-plan catalog with the costed 11-tier ladder above, retires `scale` (deactivated, not deleted), and closes the annual prices. Superseded prices get `effective_to = CURRENT_DATE` rather than being edited, so historical subscriptions keep the price that applied when they were created.
- Plan limits are resolved from the current subscription and catalog. A subscription-less user has full access while `BILLING_ENFORCEMENT_ENABLED=false`.

Migrations run automatically through the existing API migration runner. Stripe identifiers (`billing_plans.provider_product_id`, `billing_plan_prices.provider_price_id`) remain nullable until the catalog is mirrored to Stripe — see the launch checklist below.

## Billing backend

The module is under `apps/api/src/modules/billing/`.

- `BillingRepositoryService` owns raw PostgreSQL reads/writes.
- `BillingService` exposes catalog, summary, checkout, and portal use cases.
- `StripeBillingProvider` is behind a provider port; missing Stripe configuration fails safely (409) and never fabricates a successful checkout. Checkout and the billing portal are both Stripe-hosted, so card data, SCA/3DS and PCI scope stay with Stripe.
- The Stripe customer is created and linked to the local `billing_customers` row **when the checkout session is created**, not from a webhook. Webhook delivery order is not guaranteed, so linking on `checkout.session.completed` would let a `customer.subscription.created` that arrived first be dropped — a paid user with no subscription row.
- `BillingWebhookProcessor` verifies signatures via the Stripe SDK, stores an idempotent inbox event, rejects stale/out-of-order state, and applies subscription updates. Only `customer.subscription.created|updated|deleted` mutate state; Stripe's own `status` field is authoritative.
- `BILLING_ENFORCEMENT_ENABLED=false` is the migration/transition default. It reports `full_access` without creating a fake subscription.

Required runtime settings are documented in `apps/api/.env.example` and validated in `env.validation.ts`. Unlike a Merchant of Record, **Stripe does not assume tax liability** — Stripe Tax calculates and collects, but SellerHill remains the merchant of record and owns registration, remittance and filing, alongside its LLC income/accounting obligations. `automatic_tax` silently collects zero tax until a head office address and at least one active registration exist in the Stripe Dashboard.

## Quota semantics

### Listings

Active listings plus open listing reservations count toward the limit. Draft and ended listings do not. Bulk creation and publishing reserve capacity under a PostgreSQL advisory transaction lock. Queue success consumes a reservation; terminal failure releases it. A downgrade never disables existing listings; it blocks only new create/publish operations until usage is below the new limit.

### Automatic orders

AO quota is per user and per UTC calendar month. A reservation is idempotent by eBay order ID, so retries do not double-count. Reservation occurs before enqueue, consumption occurs only after Amazon confirms placement, and blocked/final-failed checkout releases the reservation. Existing placed orders and tracking continue even when the quota is exhausted. Exhaustion produces the shared `quota_exhausted` attention reason.

## Customer UI

The billing feature is under `apps/web/src/features/billing/`, rendered as its own routed page at `/:locale/billing` (sidebar entry near Settings) rather than a Settings drawer — `/:locale/settings/billing` and `/:locale/settings?drawer=billing` redirect there for old links. The page shows the current subscription/transition state, listing usage, monthly AO usage, and a simple monthly/yearly comparison. Upgrade/manage actions are unavailable until Stripe is configured. Landing pricing reads the public billing catalog rather than owning a second price/limit definition.

All visible text is localized in English and Turkish. Do not add token-based pricing copy.

## Admin and FinOps

Admin billing metrics are exposed by `GET /v1/admin/billing/metrics` and displayed in the admin Billing tab. They show cost totals, account/access distributions, and quota pressure. Unknown costs remain `null`; a real zero remains `0`. Existing `UserRole.ADMIN`, `RolesGuard`, and privileged-session controls remain the authorization source.

## Stripe launch checklist

1. Set `STRIPE_SECRET_KEY` (test mode) and `STRIPE_WEBHOOK_SECRET`. Stripe's test mode is the sandbox — there is no separate environment switch.
2. Mirror the catalog: `pnpm --filter api stripe:sync-catalog` creates the Stripe Products/Prices and writes their IDs back to the billing catalog rows. Idempotent, safe to re-run per environment.
3. Point a webhook endpoint at `POST /api/v1/billing/webhooks/stripe` (locally: `stripe listen --forward-to localhost:3000/api/v1/billing/webhooks/stripe`), subscribing to `customer.subscription.created|updated|deleted`.
4. Stripe Tax: set the head office address and add an active registration per jurisdiction the business is obliged to collect in. Without a registration, tax is silently zero. Registration obligations are a decision for the account owner and their tax advisor.
5. Keep enforcement disabled while testing catalog, checkout, webhook, cancellation, renewal, failed-payment, and portal flows.
6. Verify webhook retries, duplicate events, stale events, upgrades, downgrades, and period rollover.
7. Run a low-volume live subscription test with live-mode keys and a live-mode registration.
8. Enable `BILLING_ENFORCEMENT_ENABLED=true` only after the live test and operational monitoring are ready.

## Future technical documents

Future billing docs should cover provider-specific Stripe event payloads, reconciliation/runbooks, tax/accounting boundaries, pricing experiments, margin analysis, usage dashboards, refunds/chargebacks, and plan migration policy. The canonical implementation facts are kept here and in `CLAUDE.md`; do not create a second independent plan model.
