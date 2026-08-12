# A2 — Automated Amazon Fulfillment (Design)

**Date:** 2026-07-18
**Status:** Draft, awaiting user review

> **⚠ Partially superseded (2026-07-28).** The proxy model described in this
> document (single rotating-residential provider via `PROXY_ENDPOINT`/
> `PROXY_USER`/`PROXY_PASS_TEMPLATE` env with a sticky `{session}` token) was
> replaced by a **fixed ISP proxy pool** in the `proxies` DB table (migration
> `057`): one static proxy auto-assigned per user, passwords encrypted at
> rest, env template retained only as a fallback while the pool is empty.
> Tracking intervals are now env-tunable (`AMAZON_TRACKING_*_INTERVAL_HOURS`,
> shipped default 24h not 12h). The tracking processor was also hardened
> (fresh eBay token, no-silent-drop push, status regression guard,
> Amazon-cancel ≠ eBay-cancel via `orders.amazon_cancelled_at`, cart-hygiene
> checkout steps). Current source of truth: CLAUDE.md "Amazon Order Tracking",
> "Automated Amazon Fulfillment (A2)" and "Amazon Scraping — Anti-Ban
> Strategy" sections.
**Scope:** Backend (`apps/api`) + shared types/enums + small frontend (settings drawer, Amazon-account edit, orders status surface). Builds on A1's cost-capture foundation and the existing Amazon scraping/tracking infrastructure.

---

## Roadmap context

Second of four sequenced specs. A1 (net-profit correctness) and A1.1 (estimated provisional profit) are done on `development`. A2 is next.

| Spec | Title | Status |
|---|---|---|
| A1 | Net profit correctness | Done |
| A1.1 | Estimated provisional profit | Done |
| **A2** | **Automated Amazon fulfillment** (this doc) | Design |
| B | Shared LLM infra (`LlmClient`) + content-AI refactor | Future |
| C | Assistant backend (RAG chatbot + ticket escalation) | Future |

A2 turns SellerHill from "report your manual Amazon orders" into "SellerHill places the Amazon order for you." It carries **real-money spend and a real Amazon-ban risk** that A1/A1.1 did not, so guardrails and anti-detection are first-class concerns, not afterthoughts.

---

## Problem statement

Today, after an eBay sale, a SellerHill user must **manually** buy the item on Amazon with a buyer account, then either link the Amazon order by ID or wait for the auto cost-capture matcher (`amazon-order-sync`) to find it. This is the manual labor dropshipping is supposed to eliminate, and it is the gating feature for the product.

What A2 adds:

1. **Auto-order.** When `store_settings.auto_fulfill_enabled` is on, a new eBay order triggers the system to **place the Amazon order automatically** via Playwright, using the user's designated Amazon buyer account, shipping to the eBay buyer's address.
2. **Auto-link + cost capture.** The resulting Amazon order is linked immediately (real costs scraped from the confirmation page) → `cost_capture_status = 'linked'` → `recomputeProfit`. A1's trust machinery applies for free.
3. **Status tracking.** Amazon `shipped` → eBay shipped; Amazon `delivered` → eBay completed. **This already exists** (`AmazonTrackingProcessorService`) — A2 only feeds it by writing `amazon_order_id` on the placed order.
4. **Tracking-number conversion.** A pluggable converter maps Amazon's real carrier numbers to eBay's carrier enum. Real carriers (UPS/USPS/FedEx/DHL) pass through; TBA (Amazon Logistics) forwards as `Amazon_Logistics`. **No fabrication.**
5. **Guardrails + anti-ban.** Master toggle, per-account enable, hard per-order cost cap enforced at Amazon's review step, dry-run, fail-closed on any obstacle, and a per-user residential-proxy + per-account browser-profile isolation stack.

---

## Design goals

1. **Never silently lose money or get an account banned.** Every guardrail fails closed; no charge may occur without the review-step cap passing; no account may auto-fulfill over the bare server IP.
2. **Reuse the battle-tested scraping stack** (login/2FA-TOTP, stealth, per-account browser state, Bottleneck rate-limit) rather than re-rolling it.
3. **Honor A1's trust contract** — auto-placed orders are cost-captured truthfully (real scraped costs, `linked` status), never faked.
4. **Make the proxy/isolation strategy swappable** so the single biggest ban lever (per-user vs per-account IP) can change by config, not rewrite.
5. **No fabricated tracking numbers.** Only real carrier numbers are forwarded; TBA passes through as Amazon Logistics. (Research, 2026-07-18: eBay deprecated Bluecare/Aquiline TBA-conversion validation in 2024–2026; fabricated USPS/UPS numbers are fraud and sink seller tracking/defect metrics.)

Explicitly **out of scope / deferred:**
- Human-in-the-loop mid-checkout (live browser sharing / VNC / resume tokens). v1 is **fail-closed + manual fallback** via the existing manual `linkAmazonOrder` flow.
- Per-eBay-store → Amazon-account mapping (v1 = one rotation pool per user, not per store).
- A sanctioned paid tracking-conversion API (interface reserved, provider inactive).
- Captcha/OTP auto-solving services (out of scope; those obstacles fail closed).

**In scope (added during review):** round-robin account rotation across the user's enabled buyer accounts (§1g, §3).

---

## Architecture

### 1. Anti-ban stack (decided first — it gates everything)

The decisive design choice is the **isolation unit = the Amazon buyer account, not the SellerHill user** at the *browser-identity* layer, while the **IP is shared per SellerHill user** (cost/UX decision). This combination mimics "one household, several devices," which is the strongest realistic profile at this cost point.

**Detection reality (research, 2026-07-18):** Amazon's primary linkage signals are IP address, payment method, shipping/billing address, browser fingerprint, and behavioral velocity. Multiple high-volume buyer accounts with rotating ship-to addresses on a single IP is a strong dropshipper cluster signal. Per-user IP therefore *links a user's accounts at the IP layer* — an accepted, calculated tradeoff — which we counter by maximally separating the **non-IP** signals per account and by keeping account usage sequential and conservative.

**1a. Proxy — SellerHill-provided, residential, sticky, per user.**
Users do not configure proxies. SellerHill provides a residential-proxy provider (env-driven). A **sticky session token = `userId`** so each user always exits from the same residential IP for all their accounts and all Amazon traffic (scrape + checkout). A new `ProxyService` resolves the proxy for a given `(userId, amazonAccountId)`:

```ts
interface ProxyService {
  resolve(userId: string, amazonAccountId: string): { server: string; username: string; password: string };
}
```

The provider is configured entirely via env (`PROXY_PROVIDER`, `PROXY_ENDPOINT`, `PROXY_USER`, `PROXY_PASS_TEMPLATE`); the sticky session id is injected into the proxy username/password template. Recommended providers: **Smartproxy** or **Bright Data** (sticky residential + session-token support); final choice deferred to implementation, env-only.

**1b. Upgrade isolation: storageState → persistent per-account user-data-dir.**
`BrowserStateManager` currently persists only Playwright `storageState` (cookies + localStorage) per `amazonAccountId`. Upgrade to [`launchPersistentContext`](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context) with a dedicated `--user-data-dir` at `${stateDir}/profiles/${amazonAccountId}/`. This persists the full profile (IndexedDB, cache, service workers, fingerprint-derived state), so each account looks like the same physical machine on every launch — far stronger than storageState. The context is cached (as today) and the profile directory cleared when credentials change.

**1c. Harden the per-account fingerprint to be deterministic, not per-launch.**
Stealth plugin (`puppeteer-extra-plugin-stealth`) stays. Canvas/WebGL/audio noise becomes **deterministic per `amazonAccountId`** (seeded from the existing `hashCode(accountId)`), **not** re-randomized each launch — per-launch randomization is itself a detection signal. UA/viewport/timezone already deterministic per account.

**1d. Route ALL Amazon traffic through the user proxy (scrape + checkout).**
The existing scraping flows (`amazon-order-sync`, `amazon-tracking`, `amazon-verify`) currently exit from the bare VPS IP — a latent ban risk for the *current* product. Making `BrowserStateManager` proxy-aware hardens both scraping and the new checkout. Double win.

**Proxy fallback rule (no regression to existing scraping):** `ProxyService.resolve()` returns `null` when proxy env is absent. `BrowserStateManager` launches without a proxy in that case (current behavior preserved), so existing scraping never breaks. Auto-fulfill, by contrast, is **hard-blocked** when the proxy is absent (§7 guardrail) — the two features have different safety floors on purpose.

**1e. Sequential, conservative account usage.**
Per-account rate limit stays at `maxConcurrent: 1`. Add a **per-user** concurrency gate so a user's multiple accounts do not run checkout simultaneously on the shared IP (the loudest linkage signal). Checkout uses tighter spacing than scrape (`AUTO_FULFILL_CHECKOUT_MIN_TIME_MS`, default ~4000–5000ms between steps).

**1f. Human-like checkout behavior.**
Within `AmazonCheckoutService` only: human-scale delays between steps, tapered/curved mouse movement, bounded-random typing cadence. Not applied to scrape code.

**1g. Round-robin across the user's enabled accounts.**
Orders are assigned across the user's `auto_fulfill_enabled` accounts in rotation (oldest-`last_used_at`-first), so purchase velocity is spread across accounts rather than concentrated on one. This lowers the per-account "abnormal buying pattern" signal and is the natural multi-account fulfillment behavior. Round-robin operates within the sequential per-user gate (§1e): jobs still run one-at-a-time per user, each assigned to the next account in rotation.

**1h. Swappable proxy granularity — the seam that protects the feature.**
```ts
interface ProxyAssignmentStrategy {
  sessionTokenFor(userId: string, amazonAccountId: string): string;
}
```
- `PerUserStrategy` → `sessionToken = userId` (**shipped default**).
- `PerAccountStrategy` → `sessionToken = amazonAccountId` (future).

`BrowserStateManager` obtains the proxy via the strategy; the provider is unchanged. If bans spike at scale, escalating to per-account IP is a strategy-class + config swap, **zero rewrite**. This is the most important structural decision in the spec — it insulates the product's flagship feature from a forced rewrite.

### 2. Data model

**Migration `036_alter_store_settings_add_auto_fulfill.sql`** — master switch (global per-user row):

```sql
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS auto_fulfill_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tracking_conversion_provider VARCHAR(20) NOT NULL DEFAULT 'local';
```

No single "designated account" column — the fulfillment pool is **all of the user's `amazon_accounts` rows with `auto_fulfill_enabled = true`**, and orders are assigned **round-robin** across them (§3). `tracking_conversion_provider` only accepts `'local'` for now (`'api'` is reserved — the `ApiTrackingConverter` is a no-op stub).

**Migration `037_alter_amazon_accounts_add_auto_fulfill.sql`** — per-account guardrails (no proxy column — SellerHill provides the proxy):

```sql
ALTER TABLE amazon_accounts
  ADD COLUMN IF NOT EXISTS auto_fulfill_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_fulfill_cap_total NUMERIC(10,2),   -- NULL = auto disabled for this account
  ADD COLUMN IF NOT EXISTS auto_fulfill_dry_run BOOLEAN NOT NULL DEFAULT FALSE;
```

**Hard guardrail (enforced in service layer, not DB):** `auto_fulfill_enabled` may not be `true` unless a SellerHill-provided proxy is configured (env present) **and** `auto_fulfill_cap_total IS NOT NULL`. The settings upsert/account-update path rejects an invalid enable and returns a structured error the FE surfaces via `MessageModal`.

**Migration `038_alter_orders_add_auto_fulfill_status.sql`** — order lifecycle:

```sql
CREATE TYPE auto_fulfill_status AS ENUM
  ('pending','running','placed','blocked','failed','dry_run','skipped');

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS auto_fulfill_status auto_fulfill_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS auto_fulfill_blocked_reason VARCHAR(200),
  ADD COLUMN IF NOT EXISTS auto_fulfill_attempted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_auto_fulfill_status
  ON orders(auto_fulfill_status) WHERE auto_fulfill_status IN ('blocked','failed');
```

**Shared enum** (`packages/shared/src/domain/orders/`, rule 10 — no hardcoded status strings): `AutoFulfillStatus` mirroring the DB type.

**Status semantics:**

| Status | Meaning |
|---|---|
| `pending` | New eBay order; auto-fulfill not yet attempted (or not eligible). |
| `running` | Checkout job in progress. |
| `placed` | Amazon order placed, confirmation scraped, costs + `amazon_order_id` written, `recomputeProfit` queued. |
| `blocked` | Checkout attempted and hit a fail-closed obstacle (captcha / OTP prompt / over-cap / out-of-stock / payment-declined / login-failed / address-friction). No charge. `auto_fulfill_blocked_reason` set. |
| `failed` | Unexpected error (transport/infra). BullMQ may retry; distinct from `blocked` (deliberate stop). |
| `dry_run` | Dry-run account: full flow completed up to (not including) "Place Order"; review total + screenshot captured. |
| `skipped` | Not eligible (auto off, no enabled account, coarse gate `sale_total > cap` failed). Distinct from `blocked`. |

### 3. Trigger & queue lifecycle

**Producer** — in `OrderSyncService.upsertOrder`, immediately after the existing `xmax = 0` genuine-insert stock-sync block (the same hook sale-driven stock sync uses). On a brand-new matched order:

1. Resolve `store_settings.auto_fulfill_enabled`; if off → status `skipped`, stop.
2. **Pick the fulfillment account round-robin:** among the user's `amazon_accounts` with `auto_fulfill_enabled = true` AND `auto_fulfill_cap_total IS NOT NULL`, select the one with the **oldest `last_used_at`** (ties broken by `id`). If none → `skipped`. The chosen account's `last_used_at` is stamped at assignment, so the next order rotates to the next account. This spreads purchase velocity across accounts (anti-ban positive) and needs no new cursor column. The chosen `amazonAccountId` rides in the job payload.
3. **Coarse gate:** if `order.sale_total > auto_fulfill_cap_total` → `skipped` (pre-filter only; the hard check is the Amazon review step).
4. Else enqueue `{ ebayOrderId }` on the `auto-fulfill` queue. Job id `fulfill-${ebayOrderId}` (**dedup** — one attempt per order), `attempts: 3`, exponential backoff 60s, `removeOnComplete: 100`.

**New queue:** `auto-fulfill` (BullMQ), registered in `orders.module.ts` (alongside `order-sync`, `stock-sync`) or `amazon.module.ts` (alongside the other Amazon queues — preferred, since the checkout service lives in the Amazon module). Processor `@Processor('auto-fulfill', { concurrency: AUTO_FULFILL_QUEUE_CONCURRENCY })` (default 1). `AUTO_FULFILL_QUEUE_CONCURRENCY` is the per-process worker cap; the **per-user** sequential gate (§1e) is enforced inside the processor.

**Consumer** (`AmazonCheckoutService.runForOrder(ebayOrderId)`):
- Re-read `auto_fulfill_status`; if already `placed`/`running`/`blocked` → no-op (idempotency — makes BullMQ retries safe; a retried job after a transport blip will not double-order).
- Set `running`.
- Execute the step flow (§4). Each step may throw a typed `AutoFulfillBlocked(reason)`.
- On `AutoFulfillBlocked` → set `blocked` + `blocked_reason`, stop (do **not** throw for blocked-class reasons; throwing would trigger BullMQ retry, which we do not want for a deliberate stop). Enqueue a notification (UI "needs attention"; optional email — out of core scope).
- On success → `placed` + hand off to cost-capture/tracking (§5).
- On unexpected error → throw (BullMQ retries); set `failed` only on final-attempt exhaustion.

### 4. `AmazonCheckoutService` (new, highest-risk code)

Step-structured — one private method per step, each able to throw `AutoFulfillBlocked('<reason>')`. All steps run through `AmazonRateLimiter.schedule(amazonAccountId, …)` and use the proxy-aware, persistent-context browser from `BrowserStateManager`. Flow:

1. **Resolve inputs:** buyer `shipping_address` from the order; ASIN + quantity via `listing_id → products` (reuses the same resolution path as `recomputeProfit`). If ASIN unresolvable → `blocked('no_asin')`.
2. **Session:** `browserStateManager.getContext(accountId)`; if session invalid → `AmazonScrapingService.performLogin` (with 2FA-TOTP via `otplib`, as today). A captcha or an unexpected OTP/2FA prompt → `blocked('captcha'|'otp')`. Login failure (`'Invalid credentials'` / login-error box) → `blocked('login')` + `markInvalid`.
3. **Product page:** navigate `https://www.amazon.com/dp/<ASIN>`; set quantity; "Add to Cart". If "Add to Cart" unavailable (out of stock, "Currently unavailable") → `blocked('out_of_stock')`.
4. **Checkout — address:** "Proceed to Checkout"; select/add the buyer's `shipping_address`. Address-validation friction / "we don't ship to this address" → `blocked('address')`.
5. **Checkout — payment:** select the account's default payment method. Payment-method decline/friction detected on the review step → `blocked('payment')`.
6. **Review — HARD CAP:** read the final grand total from the review DOM. **If `grandTotal > auto_fulfill_cap_total` → abort, no click → `blocked('cap')`.** This is the hard money gate; the coarse `sale_total` gate in §3 is only a pre-filter.
7. **Place order (or dry-run):**
   - If `auto_fulfill_dry_run` → capture screenshot + review total, **stop before** "Place Order" → `dry_run`.
   - Else click "Place Order"; parse the confirmation page for `amazonOrderId`, `purchasePrice` (item subtotal), `tax`, `shipping`. If the confirmation DOM yields no `amazonOrderId` → `blocked('no_confirmation')` (do not assume success without proof).

The step structure makes the blocked-reason taxonomy exhaustive and each step independently unit-testable. The alternative (one monolithic method) was rejected — the typed-reason-per-step shape is what makes fail-closed reliable and the "needs attention" surface precise.

**Evidence capture (admin-only):** on any `blocked` step and on `dry_run`, `AmazonCheckoutService` saves a screenshot (PNG) of the current Amazon page to `${EVIDENCE_DIR || process.cwd()}/fulfillment-evidence/${ebayOrderId}/${stage}-${timestamp}.png`. This evidence is **admin-only** — it is never surfaced in the customer FE (which shows only the status + `blocked_reason` text). Rationale: the screenshot depicts the customer's Amazon buyer-account page (sensitive), and it exists for the operator to investigate failures. Access in v1 is via the filesystem (or a minimal admin-guarded endpoint), consistent with how Keepa admin attribution is read today ("admin reads tables directly, no UI yet"). A proper admin panel / account-impersonation mode is **out of scope for A2** — a separate future spec. Evidence files TTL-clean (default 7 days, `FULFILLMENT_EVIDENCE_TTL_DAYS`).

### 5. Post-purchase: link + tracking (mostly reuse)

On `placed`, in a single transactional UPDATE on `orders`:

```sql
UPDATE orders SET
  amazon_account_id     = $accountId,
  amazon_order_id       = $amazonOrderId,
  purchase_price        = $purchasePrice,
  amazon_tax            = $tax,
  amazon_shipping       = $shipping,
  amazon_linked_at      = NOW(),
  cost_capture_status   = 'linked',
  auto_fulfill_status   = 'placed',
  auto_fulfill_attempted_at = NOW()
WHERE ebay_order_id = $ebayOrderId;
```

Then call `OrderSyncService.recomputeProfit(ebayOrderId)` (the single writer) → trusted `net_profit` for free (A1 machinery).

Because `amazon_order_id` is now set, `AmazonTrackingQueueService.scheduleOrderTracking(orderId, accountId)` keys off it and the **existing** `AmazonTrackingProcessorService` polling runs unchanged: Amazon `shipped` → `handleShipped` → `createShippingFulfillment` on eBay; Amazon `delivered` → status `completed`. No new tracking code is required for A2 — item 2 of the scope is satisfied by reuse.

### 6. Tracking-number conversion (pluggable, real-only)

Interface in `packages/shared` (types) + `apps/api` (implementations):

```ts
interface TrackingConverter {
  convert(rawNumber: string, rawCarrier: string): { trackingNumber: string; shippingCarrierCode: string };
}
```

- **`LocalTrackingConverter`** (default, active): real carriers (UPS/USPS/FedEx/DHL) → eBay carrier enum via the existing `mapCarrierForEbay`; TBA/TBM/TBC (Amazon Logistics) → `{ shippingCarrierCode: 'Amazon_Logistics', trackingNumber: rawNumber }` — **pass-through, no fabrication**. Unknown carrier → pass through under `Other`/raw.
- **`ApiTrackingConverter`** (reserved, inactive): throws `NotImplemented`. Selected by `tracking_conversion_provider = 'api'` but not usable until a sanctioned paid service exists.

Wired in at the single call site: `AmazonTrackingProcessorService.handleShipped`, wrapping the existing `mapCarrierForEbay` call. One seam, swappable later. The "TBA-only vs convert-all" setting from earlier brainstorming is **dropped** — since nothing is fabricated, there is nothing to scope.

### 7. Guardrails (consolidated)

| Guardrail | Mechanism |
|---|---|
| Master kill-switch | `store_settings.auto_fulfill_enabled` (default off) |
| Per-account enable | `amazon_accounts.auto_fulfill_enabled` |
| Per-order money cap (hard) | review-step grand-total check before "Place Order" → `blocked('cap')`, no charge |
| Coarse pre-filter | `sale_total > cap` → `skipped` (avoids enqueueing hopeless orders) |
| Dry-run | `auto_fulfill_dry_run` runs the full flow, stops before payment |
| Fail-closed on any obstacle | typed `AutoFulfillBlocked` → `blocked` state, no retry, no charge |
| Human-in-the-loop | none live; falls back to existing manual `linkAmazonOrder` |
| Proxy mandatory | `auto_fulfill_enabled` rejected if proxy env absent (SellerHill-provided proxy gates the feature) |
| Ban-risk mitigation | per-user sticky residential proxy + per-account persistent profile + deterministic fingerprint + sequential per-user concurrency + human-like checkout behavior |
| Idempotency | status re-check on job start; dedup `jobId` |

### 8. Settings UI placement

- **`StoreSettingsDrawer`** (`apps/web/src/features/settings/drawers/StoreSettingsDrawer/`): master `auto_fulfill_enabled` toggle; `tracking_conversion_provider` select (`local` only, disabled `api`). The rotation pool is configured indirectly — per account via the Amazon-account edit form (§ below) — so no account picker is needed here. The `amazonTaxRate` field (A1.1) is the template for adding a new field end-to-end.
- **Amazon Account edit form** (`apps/web/src/features/amazon/`): per-account `auto_fulfill_enabled`, `auto_fulfill_cap_total`, `auto_fulfill_dry_run` — alongside the existing email/password/2FA fields.
- **Orders surface** (`apps/web/src/features/orders/`): an `auto_fulfill_status` chip on order rows/detail (using the `AutoFulfillStatus` enum → i18n labels, EN + TR) and a "needs attention" filter for `blocked`/`failed` rows so the user can fall back to manual linking. **Customers see only the status + reason text — never screenshots** (see Evidence below).
- All strings via i18n; all status values via the shared enum (rules 10 + 12). No native form controls — all from `@repo/ui`.

### 9. Config / env (all optional, defaults shown)

- `AUTO_FULFILL_QUEUE_CONCURRENCY=1` — worker concurrency per process.
- `AUTO_FULFILL_CHECKOUT_MIN_TIME_MS=4500` — tighter inter-step spacing than scrape.
- `AUTO_FULFILL_REVIEW_CAP_HARD_STOP=true` — global kill-switch on the review-step cap (if `false`, the feature refuses to run — never silently bypasses the cap).
- `PROXY_PROVIDER=`, `PROXY_ENDPOINT=`, `PROXY_USER=`, `PROXY_PASS_TEMPLATE=` — SellerHill-level residential proxy. Sticky session token (`userId` by default) is interpolated into the template by `ProxyService`.
- `PROXY_STRATEGY=perUser` — selects `ProxyAssignmentStrategy` (`perUser` now; `perAccount` reserved).

No new external services beyond the proxy provider (chosen at implementation).

### 10. Testing

Pure-logic helpers in the existing Jest harness (`apps/api`, CJS + ts-jest, same pattern as `profit-calculation.spec`):
- Coarse cap gate predicate (`sale_total` vs `cap`).
- `AutoFulfillStatus` transition table (legal/illegal transitions, idempotency re-check).
- `LocalTrackingConverter`: real-carrier remap + **TBA pass-through = no fabrication** (regression guard) + unknown-carrier passthrough.
- `AutoFulfillBlocked` reason taxonomy (exhaustive).
- Dedup/idempotency predicate (`fulfill-${ebayOrderId}` re-entrancy).
- `ProxyAssignmentStrategy` session-token derivation (`perUser` vs `perAccount`).

The Playwright checkout flow itself stays **manual-verified** (consistent with how Amazon scraping is verified today; integration tests deferred by policy). **Dry-run mode is the primary safe-validation path** — before enabling real purchases on any account, the user runs dry-run to confirm the flow reaches the review step and the cap behaves.

### 11. Risks & trade-offs

- **Ban risk is real and unquantified.** Rotating ship-to addresses + automation is the top suspension vector. Per-user IP links a user's accounts; we mitigate with full per-account browser-profile + fingerprint isolation, sequential usage, round-robin across accounts (spreads velocity), conservative volume, and a swappable strategy to per-account IP. **Mitigation, not elimination.** Ship behind dry-run first, low volume.
- **Captcha/OTP frequency may limit autonomy** by design (fail-closed). If autonomy is too low, a v2 hybrid (pause on captcha/OTP) or a sanctioned solver is a separate decision.
- **Proxy bandwidth cost** (residential, per-GB). Amazon pages are heavy; checkout is heavier than status scrapes. `ProxyService` logs per-user token/bandwidth attribution (fair-split, `keepa_usage_log`-style) for observation; throttling deferred until real data exists.
- **Checkout DOM fragility** (same class of risk as scraping today). Mitigated by typed blocked-reasons — a broken selector degrades to `blocked('no_confirmation')` etc., never to a silent wrong order.
- **Double-order on BullMQ retry** — prevented by the idempotency re-check on job start (status already `placed`/`running`/`blocked` → no-op). The hard guarantee: money only leaves after the review-step cap passes and "Place Order" is clicked once.
- **Per-user IP is a conscious cost/risk tradeoff** accepted in brainstorming (2026-07-18). The `ProxyAssignmentStrategy` seam makes the escalation to per-account IP a config change.

---

## Open questions (resolved during review, 2026-07-18)

1. **Module placement** — `auto-fulfill` queue + `AmazonCheckoutService` + processor live in the **Amazon module** (co-located with `AmazonScrapingService`/`AmazonRateLimiter`/`BrowserStateManager` they depend on). The producer stays in **Orders** (where the `xmax = 0` hook lives) and enqueues cross-module.
2. **Proxy provider final selection** — Smartproxy vs Bright Data vs IPRoyal. Env-only; confirm sticky-session-token format during implementation.
3. **Notification channel for `blocked` orders** — in-app "needs attention" list is in scope; email is **out of scope for A2** (separate decision later).
4. **Screenshot/evidence storage** — **resolved:** local FS under `fulfillment-evidence/${ebayOrderId}/`, **admin-only**, TTL-cleaned (`FULFILLMENT_EVIDENCE_TTL_DAYS`, default 7). Never surfaced to the customer FE. A full admin panel / impersonation mode is out of scope (separate future spec); v1 admin access is filesystem / minimal admin endpoint.
5. **Backfill of `auto_fulfill_status` on pre-existing orders** — **resolved:** do not backfill; leave existing rows `pending`. The field is meaningful only going forward.
