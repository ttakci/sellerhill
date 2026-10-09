# Billing and Package System

## Product model

SellerHill uses simple capacity-based packages. Customers do not see scraper requests, Keepa tokens, LLM tokens, API calls, or internal queue units. The visible limits are:

- Active listings (a level — how many can be live at once)
- Monthly tracking conversions (the priced meter — the Aquiline unit cost)
- Monthly Best Sellers products (an allowance on the Amazon Best Sellers browser — value delivered, not our cost)

**Automatic orders are unlimited on every plan, trial included (migration `125`, 2026-09-29).** An order costs no third-party money (the priced unit is the conversion), every automatic order is backed by a real eBay sale so the count cannot be farmed, the old 2×-conversions ceiling hit the best-paying sellers first, and the competitor shows "unlimited". Capacity protection lives entirely in `AMAZON_GLOBAL_CONCURRENCY` + monitoring (production default 20 since the same date). The `amazon_orders_per_month` limit key is kept at `-1`; a finite value still enforces if it ever has to be re-tightened.

Catalog values are database rows and are intentionally changeable; the current catalog (migration `125`, v3 prices):

| Plan | Active listings | Tracking conversions/month | Best Sellers products/month | Automatic orders | Monthly price |
|---|---:|---:|---:|---:|---:|
| Trial (30 days) | 50 | 20 | 500 | unlimited | free |
| Mini (migration `137`) | 100 | 20 | 1,000 | unlimited | $19.99 |
| Lite | 200 | 25 | 1,500 | unlimited | $24.99 |
| Nano | 500 | 50 | 2,500 | unlimited | $29.99 |
| Micro | 1,000 | 100 | 5,000 | unlimited | $34.99 |
| Starter | 2,000 | 150 | 7,500 | unlimited | $44.99 |
| Basic | 3,000 | 200 | 10,000 | unlimited | $54.99 |
| Plus | 4,000 | 250 | 12,500 | unlimited | $64.99 |
| Growth | 5,000 | 300 | 15,000 | unlimited | $89.99 |
| Advanced | 7,500 | 350 | 20,000 | unlimited | $129.99 |
| Pro | 10,000 | 500 | 25,000 | unlimited | $164.99 |
| Elite | 15,000 | 600 | 35,000 | unlimited | $229.99 |
| Business | 20,000 | 700 | 50,000 | unlimited | $284.99 |
| Enterprise | 25,000 | 800 | 75,000 | unlimited | $339.99 |

Monthly billing only — there is no annual interval. Migration `083` set the 12-tier ladder and its first prices ($19.99 … $529.99); `125` set the prices above — Lite, Nano and Micro each rose $5, Starter is unchanged, every other tier fell. Existing subscribers move to the new price from their next renewal automatically (`PriceMigrationProcessor`, hourly, `billing_price_change` e-mail); the hourly catalog sync mints the Stripe Prices. There is no operator step.

**Pricing rule (operator decision, 2026-09-29).** The benchmark is rakip (19 tiers, 50 → 100,000 listings, tracking allowance ~2% of listings, 12-hourly sync, 3/10/unlimited store caps, unlimited automatic orders). Never price *below* the competitor at a shared listing tier — it invites a price war; equal or $1–2 above is fine, because at the same tier SellerHill gives 2.5–6× the tracking conversions, 4×/day sync, no store cap and a 30-day trial. The cost basis is the Aquiline tracking conversion at the Starter plan's $0.14/shipment (product data now comes from our own scraper, so the Keepa line in the 2026-08-21 model no longer applies). Worst-case margins — the seller spends their whole conversion quota, Stripe 2.9% + $0.30, ~$1 infrastructure + proxy share: Lite 78%, Nano 69%, Micro 53%, Starter 47%, Basic 43%, Plus 40%, Growth 48%, Advanced 57%, Pro 53%, Elite 59%, Business 61%, Enterprise 62%. The full reasoning and history are in CLAUDE.md ("Customer packages", "The priced meter").

Prices, limits, ordering, active state, and Stripe price IDs are stored in billing catalog tables. Do not hardcode package values in application logic or UI.

### Top-up packs (`billing_quota_addons`)

Two dimensions are sold as one-time packs; both grant credits scoped to the current month that raise the effective limit (`resolveEffectiveLimit` = plan limit + credits) and are offered only to a seller who has actually reached the limit:

| Pack slug | Grants | Price |
|---|---:|---:|
| `conversions-50` | 50 tracking conversions | $9.99 |
| `conversions-100` | 100 tracking conversions | $19.99 |
| `conversions-250` | 250 tracking conversions | $44.99 |
| `conversions-500` | 500 tracking conversions | $79.99 |
| `best-sellers-2500` | 2,500 Best Sellers products | $4.99 |
| `best-sellers-10000` | 10,000 Best Sellers products | $14.99 |
| `best-sellers-25000` | 25,000 Best Sellers products | $29.99 |

Listings are not sold as a top-up (a level — more is a plan upgrade) and automatic orders are unlimited, so there is nothing to sell there.

## Database and migrations

- `052_create_billing_foundation.sql` creates plans, prices, limits, customers, subscriptions, usage periods, listing reservations, AO reservations, and webhook inbox tables.
- `053_billing_quota_enforcement.sql` adjusts reservation key types/nullability and adds idempotent quota reservation support.
- `083_billing_plans_v2.sql` replaces the placeholder 3-plan catalog with the costed 12-tier ladder, retires `scale` (deactivated, not deleted), and closes the annual prices. Superseded prices get `effective_to = CURRENT_DATE` rather than being edited, so historical subscriptions keep the price that applied when they were created.
- `085` moves the priced meter to `tracking_conversions_per_month`; `087`/`113` add the top-up packs and credits; `097` sets the 30-day trial.
- `125_billing_prices_v3_unlimited_ao_best_sellers.sql` (2026-09-29) closes the `083` price rows and inserts the v3 prices above, sets `amazon_orders_per_month` to `-1` (unlimited) on every plan and the trial, adds the `best_sellers_products_per_month` limit per plan, seeds the three `best-sellers-*` packs, and creates the `best_sellers_views` table the Best Sellers allowance is counted from.
- Plan limits are resolved from the current subscription and catalog. A user with **no subscription row at all** fails OPEN regardless of enforcement: `EntitlementState.NONE` is the pre-billing state, deliberately not the same as suspension, so turning enforcement on never locks out an account that has never been billed.

Migrations run automatically through the existing API migration runner. Stripe identifiers (`billing_plans.provider_product_id`, `billing_plan_prices.provider_price_id`) remain nullable until the catalog is mirrored to Stripe — see the launch checklist below.

## Billing backend

The module is under `apps/api/src/modules/billing/`.

- `BillingRepositoryService` owns raw PostgreSQL reads/writes.
- `BillingService` exposes catalog, summary, checkout, and portal use cases.
- `StripeBillingProvider` is behind a provider port; missing Stripe configuration fails safely (409) and never fabricates a successful checkout. Checkout and the billing portal are both Stripe-hosted, so card data, SCA/3DS and PCI scope stay with Stripe.
- The Stripe customer is created and linked to the local `billing_customers` row **when the checkout session is created**, not from a webhook. Webhook delivery order is not guaranteed, so linking on `checkout.session.completed` would let a `customer.subscription.created` that arrived first be dropped — a paid user with no subscription row.
- `BillingWebhookProcessor` verifies signatures via the Stripe SDK, stores an idempotent inbox event, rejects stale/out-of-order state, and applies subscription updates. Only `customer.subscription.created|updated|deleted` mutate state; Stripe's own `status` field is authoritative.
- **`BILLING_ENFORCEMENT_ENABLED` defaults to `true`** (registry default, flipped alongside migration `097` and the 30-day trial). It was `false` through the pre-launch transition, and a limit nobody enforces is not a limit — the trial's cost ceiling only exists while this is on. Set it `false` per deployment to stage a slower rollout; with it off the summary reports `full_access` without creating a fake subscription. Note there is deliberately **no class-field default** for it in `env.validation.ts`: an initializer there is copied onto the validated config and read back as a present env value, which silently masked the registry default on every deployment with no override row.
- **Quota windows follow the Stripe billing period, not the calendar month.** `resolveQuotaWindow` (`quota-helpers.ts`) anchors usage to the subscription's own `current_period_start`, which **never moves without confirmed payment** — metering on the calendar month handed a mid-month subscriber roughly two allowances per payment. A 6-hour grace (`billing.webhookGraceHours`) extends only `periodEnd` to absorb webhook latency; past it the window resolves to `UNPAID` and entitlement reports `SUSPENDED` at read time, never as a database write. `BillingSummaryDto.entitlement` carries that effective state, while `subscription.status` keeps reporting Stripe's raw status for the checkout-vs-plan-change routing.

Required runtime settings are documented in `apps/api/.env.example` and validated in `env.validation.ts`. Unlike a Merchant of Record, **Stripe does not assume tax liability** — Stripe Tax calculates and collects, but SellerHill remains the merchant of record and owns registration, remittance and filing, alongside its LLC income/accounting obligations. `automatic_tax` silently collects zero tax until a head office address and at least one active registration exist in the Stripe Dashboard.

## Quota semantics

### Listings

Active listings plus open listing reservations count toward the limit. Draft and ended listings do not. Bulk creation and publishing reserve capacity under a PostgreSQL advisory transaction lock. Queue success consumes a reservation; terminal failure releases it. A downgrade never disables existing listings; it blocks only new create/publish operations until usage is below the new limit.

### Automatic orders

Unlimited on every plan since `125`. The reservation machinery is kept (idempotent by eBay order ID, reserve before enqueue, consume after Amazon confirms placement, release on blocked/final failure) and simply never refuses while the limit is `-1`. A suspended account is still refused — suspension is status-driven, not a quota.

### Tracking conversions

Per billing period, counted from `orders.tracking_converted_at` — no reservation table, a failed conversion costs nothing. Exhaustion **degrades, never blocks**: conversion is skipped and the order is handled by the hold/pass-through rules in CLAUDE.md ("Tracking conversion").

### Best Sellers products

Per billing period, counted in products viewed (one list page = up to 50, cached or live alike) from the `best_sellers_views` table — one row per `(user_id, view_key, viewed_on)`, so the same page reopened on the same UTC day is not recounted. Exhaustion **truncates, never blocks**: the API cuts `list.items` server-side to what the allowance covers and returns `lockedCount`; the page renders that many blurred placeholder rows with an upgrade / top-up prompt. Client-side blurring of real data was rejected (devtools would show it). Enforcement off or no subscription → unmetered; suspended → everything locked. A separate hidden per-seller cap on daily cache MISSES (`bestSellers.dailyFetchLimit`, default 1000) protects proxy capacity and is not what sellers see.

### Quota window

All monthly meters follow the Stripe billing period (`resolveQuotaWindow`), not the calendar month — see "Billing backend" above.

## Customer UI

The billing feature is under `apps/web/src/features/billing/`, rendered as its own routed page at `/:locale/billing` (sidebar entry near Settings) rather than a Settings drawer — `/:locale/settings/billing` and `/:locale/settings?drawer=billing` redirect there for old links. The page shows the current subscription/transition state and the three quota rings (listings, tracking conversions, Best Sellers products); automatic orders are unlimited and are not metered on the page. Upgrade/manage actions are unavailable until Stripe is configured. Landing pricing reads the public billing catalog rather than owning a second price/limit definition.

All visible text is localized in English and Turkish. Do not add token-based pricing copy.

## Admin and FinOps

Admin billing metrics are exposed by `GET /v1/admin/billing/metrics` and displayed in the admin Billing tab. They show cost totals, account/access distributions, and quota pressure. Unknown costs remain `null`; a real zero remains `0`. Existing `UserRole.ADMIN`, `RolesGuard`, and privileged-session controls remain the authorization source.

## Stripe launch checklist

1. Set `STRIPE_SECRET_KEY` (test mode) and `STRIPE_WEBHOOK_SECRET`. Stripe's test mode is the sandbox — there is no separate environment switch.
2. Mirror the catalog: `pnpm --filter api stripe:sync-catalog` creates the Stripe Products/Prices and writes their IDs back to the billing catalog rows. Idempotent, safe to re-run per environment.
3. Point a webhook endpoint at `POST /api/v1/billing/webhooks/stripe` (locally: `stripe listen --forward-to localhost:3000/api/v1/billing/webhooks/stripe`), subscribing to `customer.subscription.created|updated|deleted`.
4. Stripe Tax: set the head office address and add an active registration per jurisdiction the business is obliged to collect in. Without a registration, tax is silently zero. Registration obligations are a decision for the account owner and their tax advisor.
5. Optionally set `BILLING_ENFORCEMENT_ENABLED=false` for this environment while testing catalog, checkout, webhook, cancellation, renewal, failed-payment, and portal flows — it now defaults to `true`, so disabling is the explicit step, not enabling.
6. Verify webhook retries, duplicate events, stale events, upgrades, downgrades, and period rollover.
7. Run a low-volume live subscription test with live-mode keys and a live-mode registration.
8. Remove any `BILLING_ENFORCEMENT_ENABLED=false` override once the live test and operational monitoring are ready, so the environment returns to the enforced default.

## Future technical documents

Future billing docs should cover provider-specific Stripe event payloads, reconciliation/runbooks, tax/accounting boundaries, pricing experiments, margin analysis, usage dashboards, refunds/chargebacks, and plan migration policy. The canonical implementation facts are kept here and in `CLAUDE.md`; do not create a second independent plan model.
