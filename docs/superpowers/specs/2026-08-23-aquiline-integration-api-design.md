# Aquiline Integration API — tracking conversion, rebuilt against the real contract

**Date:** 2026-08-23
**Status:** Approved (design)
**Supersedes:** the Aquiline half of the "Tracking conversion (Aquiline)" section in CLAUDE.md

## 1. Why this exists

Everything below `TrackingConversionService`'s decision layer was written against
the **wrong API surface**. The published `developer.aquiline-tracking.com` v3 spec
models `POST /v3/shipments` as a courier booking (sender, recipient, parcel
weight/dimensions, service level) with no field for an inbound tracking number.
`aquiline.client.ts` therefore shipped a `TODO(confirm)` body that guessed at
several property names.

Aquiline support confirmed on 2026-08-13 that this is the wrong surface entirely:

> You're looking at the partner docs, this is the wrong surface for Amazon TBA → AQUA.
> `POST /v3/shipments` creates an Aquiline outbound shipment (quotes/labels). It is
> not the Amazon TBA conversion workflow, so fields like `amazonTrackingNumber` /
> `tracking_url` are intentionally absent there.

The correct surface is the **Integration API**, documented only to subscribers.
Its OpenAPI document (attached to the 2026-08-23 session) is now the contract.

### What actually changed

| Concern | Guessed (shipped) | Real |
|---|---|---|
| Base URL | `api.aquiline-tracking.com/v3` | `aquiline-tracking.com/app/api/integration` |
| Auth | `X-API-Key` | `Authorization: Bearer {tokenId}.{tokenSecret}` |
| Conversion | one call, `POST /v3/shipments` | four calls: profile → order upsert → tracking-html → assign |
| Source tracking | invented `sourceTrackingNumber` field | no such field; Amazon passes a **ship-track page URL** |
| Webhook events | `shipment.delivered` / `.exception` / `.updated` | `tracking.html.{accepted,applied,rejected}`, `tracking.problem.{opened,cleared}` |
| Delivery signal | pushed by webhook | **none — there is no delivery webhook** |

### The three architectural consequences

1. **There is no `shipment.delivered` webhook.** Delivery cannot arrive by push.
2. Therefore `AmazonTrackingProcessorService.hasWebhookDeliveryCoverage` — which
   stops Amazon polling once a converted number exists — would strand **every
   converted order in SHIPPED forever**. It must be removed, not adjusted.
3. Aquiline expects the ship-track page HTML **1–2× per day** for an in-flight
   Amazon order. Polling does not go away; it gains a payload. The claim in
   CLAUDE.md that the integration saves "~5 of every ~13 scrapes an order costs"
   is void.

The offsetting win is real but different: Aquiline's own customers upload this
HTML from a **browser extension**, which requires the seller's machine to be on.
SellerHill already holds persistent, authenticated Amazon sessions
(`launchPersistentContext`), so it does this server-side with nothing installed
by the seller.

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | One Aquiline profile per **(SellerHill user × Amazon marketplace)**, id `sh-{userId}-{marketplace}` | Profiles are a hard, paid, **non-deletable** plan resource. `users.id` is stable across Amazon-account churn; `storeAddress` is already a per-seller value (D2); embedding the marketplace keeps `marketplaceHost` single-valued. `amazonAccountEmail` is documented as *optional*, so per-account granularity buys little for ~1.4× the profiles. |
| D2 | `storeAddress` comes from **new full-address columns on `store_settings`** | Every other tracking setting already lives there with Store > Global > Default resolution. `store_settings` today holds only `country`/`state`/`zip_code`; street, city, name and phone are new. |
| D3 | Delivery is detected by **continued Amazon polling**, in the same page visit that feeds the HTML | We must visit the page anyway. Delivery then costs nothing extra and needs no new mechanism. |
| D4 | A failed first conversion **defers the eBay push up to 12h, retrying hourly** | eBay's Fulfillment API has no update endpoint (`createShippingFulfillment` is `POST`-only), so the first push is the only chance to give the buyer an AQUA number. |

### 2.1 The purchased plan, and why the profile ceiling drove D1

Aquiline **Starter** was purchased on 2026-08-23: $42/mo, 3,000 trackings,
**300 Aquiline shipments**, **10 seller profiles**, $0.14/shipment. The ladder
above it is Professional ($130 / 1,000 / 25), Business ($240 / 2,000 / 50),
Enterprise ($330 / 3,000 / 100) and Huge ($500 / 5,000 / 250).

Three things follow, and the first is the one that changed a decision.

**Profiles cannot be deleted.** `/v1/profiles/{profileId}` exposes only `get`
and `patch` — there is no `delete`, and the omission is deliberate, since
`/v1/webhooks/{webhookId}` does have one. Every profile ever created therefore
consumes one of the plan's slots permanently, and there is no sandbox, so even
test profiles come out of the production allowance. That makes profile identity
a one-way door: keying it on `amazon_accounts.id` would mint a fresh, permanent
profile every time a seller removed and re-added a buyer account, orphaning the
old one forever. `users.id` does not churn, hence D1.

**Shipments are not the near-term constraint.** 300/month comfortably covers the
first sellers; SellerHill's own per-seller conversion quotas run 25–800/month, so
the ceiling starts to bind around a handful of fully-utilised sellers and is
answered by moving up the ladder.

**The unit cost assumption in CLAUDE.md is wrong and needs a separate pass.** The
12-tier pricing model was built on ~$0.10/shipment; Starter bills $0.14 — 40%
higher — and $0.10 is only reached on Huge. Since CLAUDE.md puts Aquiline at
"65% of unit cost at the 10,000-listing tier", the claimed 18% worst-case margin
no longer holds at full utilisation. **Out of scope here** — flagged as a
follow-up to re-run the cost model, not silently folded into this work.

### Why D4 is insurance, not a refinement

`uploadTrackingHtml` may answer `outcome: accepted` with
`trackingUpdateStatus: processing`, and the spec is explicit: *"Never treat
success alone as applied."* Whether `assign` succeeds immediately after an
`accepted` upload is **unknown and untestable without the live account**.

If it does not, the failure is **systematic on every first attempt**, not
occasional — and it would be silent, because fail-soft already treats a
pass-through as a normal outcome. D4 makes the system correct under both
answers.

## 3. Architecture

### 3.1 `AquilineClient` — rewritten port

Pure HTTP. No DB, no Playwright. Typed errors only, so every caller can decide
without parsing strings.

```
getMe()                                    GET    /v1/me
ensureProfile(profileId, body)             POST   /v1/profiles   (PATCH on conflict)
getProfile(profileId)                      GET    /v1/profiles/{profileId}
upsertOrders(profileId, orders[])          POST   /v1/profiles/{profileId}/orders/upsert
uploadTrackingHtml(profileId, orderId, …)  POST   …/orders/{orderId}/tracking-html
assign(profileId, orderId, body)           POST   …/orders/{orderId}/assign
getOrder(profileId, orderId)               GET    …/orders/{orderId}
listWebhooks() / createWebhook(…)          GET/POST /v1/webhooks
```

- Auth header `Authorization: Bearer {tokenId}.{tokenSecret}`, stored as one
  string in the existing `tracking.aquiline.apiKey` platform setting (already
  `secret: true`, AES-encrypted at rest). No settings migration.
- `AquilineErrorKind` survives, extended with `PROBLEM` carrying an
  `AquilineProblemCode`.
- **Failures are classified on the response's own `code` field, not on free
  text.** A probe run on 2026-08-23 showed the error body is
  `{ success: false, code: "not-found", message: "Profile not found." }`, so the
  provider does expose a machine-readable code. The shipped
  `classifyHttpFailure` greps the message for `/quota|limit reached|exceeded/`,
  which would mistake any message merely containing those words. HTTP status
  stays the fallback for a body that carries no `code`.
- Bounded retry stays: 429/5xx/network only, 3 attempts. A 4xx is never retried
  — on the conversion path a blind retry risks paying twice.
- `AQUILINE_PARTNER_ID` becomes dead (the Integration API has no `X-Partner-Id`).
  Left registered and dormant, never deleted.

### 3.2 `AquilineProfileService` — new

Maps `(users.id, AmazonMarketplace)` → Aquiline `profileId`.

`profileId` is **client-chosen** (spec: *"Optional client-chosen id; server
generates one if omitted"*), so it is derived deterministically as
`{prefix}-{userId}-{marketplace}`. Creation is therefore naturally idempotent
and the id can never be lost or need looking up.

**The prefix is a setting (`AQUILINE_PROFILE_PREFIX`, default `sh`), and it
exists because one Aquiline account is shared by every environment.** There is
no test environment (confirmed with support), so development necessarily creates
real profiles against the same 10-slot allowance production draws on, and local /
test / production all have different `users.id` values. Without a prefix, a
profile burned during development is indistinguishable from a production
seller's — which matters precisely because the resource cannot be reclaimed.
Local sets `sh-dev`, the Coolify test stack `sh-test`, production keeps `sh`. It
also makes it impossible for a development order to be upserted into a real
seller's profile.

- `ensureProfile(userId, marketplace)` runs under a **pg advisory lock keyed on
  the user** (the `resolveProductData` / `ensureSeeded` idiom), so N concurrent
  shipped transitions for one seller create exactly one profile.
- **Creation is lazy** — it happens inside `resolveForOrder`, *after* the whole
  guard chain, so a seller on the local provider never consumes a slot. Adding
  an Amazon buyer account does not create a profile.
- **A ceiling guard runs before every creation.** `GET /v1/profiles` is counted
  against `AQUILINE_MAX_PROFILES` (panel-tunable, default 10 to match Starter).
  At the ceiling, creation is refused locally → pass-through + an admin/Action
  Center warning, rather than an opaque provider 402. This exists because the
  resource is non-deletable: burning the last slot on the wrong thing is not
  recoverable.
- `aquiline_profile_fingerprint` hashes the label + resolved `storeAddress`.
  Unchanged → no call; changed → `PATCH`. Without it every conversion would
  re-PATCH. `amazonAccountEmail` is sent once as a hint (from the buyer account
  whose order triggered creation) and is deliberately **excluded** from the
  fingerprint, so a second Amazon account never causes profile churn.
- A profile that cannot be created **fails the conversion soft**: pass-through.

### 3.3 `AmazonScrapingService` — one new method

```
scrapeOrderStatusWithTrackingHtml(userId, accountId, amazonOrderId)
  → { status, trackingNumber, trackingCarrier, trackingUrl, trackingHtml }
```

Inside **one** `AmazonRateLimiter.schedule(accountId, …)` slot and **one** page:

1. `goto` order-details → `parseOrderStatus(page)` (today's behaviour, unchanged)
2. read the real "Track package" link **from that page's DOM**
3. `goto` it → `page.content()`

Three reasons this is one slot rather than two:

- **Slots are the platform's scarcest resource.** Per-account is 1 concurrent
  with a 3s floor between slots, chained to a global `maxConcurrent: 5`
  (≈432k browser-seconds/day). Doubling slots per in-flight order halves the
  ceiling. A second slot also repeats `isSessionValid`, `getDecrypted` (AES +
  DB) and `saveState`.
- **Deadlock avoidance.** `AmazonCheckoutService` wraps its entire flow in one
  `schedule` call, so "asking for a slot while holding one" is an existing
  shape in this codebase. Keeping conversion slot-free makes it safe to call
  from anywhere.
- **Correctness — the decisive one.** An Amazon order can ship as several
  packages, and the real tracking URL carries `&packageIndex=N`. A blindly
  constructed `progress-tracker/package/?orderId=…` lands on the wrong or an
  ambiguous page. The spec's own `problemCode` list names both failures
  (`tracking_url_mismatch`, `wrong_page_type`), which is evidence they are
  common. Reading the link while still on order-details removes the class.

Reading the link also sidesteps a naming inconsistency in the provider's own
material: the schema example uses `gp/your-account/ship-track?orderId=…` while
support's reply used `progress-tracker/package/?orderId=…`. The endpoint accepts
both (*"progress tracker / ship-track"*), and taking whichever URL Amazon itself
renders removes the need to pick.

`trackingHtml` is `null` when the order has not shipped; conversion is not
attempted then.

### 3.4 `TrackingConversionService` — decision layer preserved

The ordered guard chain in `resolveForOrder` is **unchanged and is the reason
the blast radius is small**: stored conversion → provider → scope → manual-order
switch → entitlement → monthly quota → config → buyer address. Only the branch
after those guards changes, from one `createConversion` call to the orchestrated
sequence.

It stays DB + HTTP only. HTML is passed **in** by the processor (fast path). The
on-demand path has no page, so it pulls HTML through a narrow port
(`AmazonTrackingHtmlPort`, implemented by `AmazonScrapingService`) — one
direction, no cycle.

## 4. Data model — migration `089`

```sql
aquiline_profiles                    -- (user, marketplace) is the natural key
  user_id      UUID        NOT NULL,      -- deliberately NOT a foreign key, see below
  marketplace  VARCHAR(20) NOT NULL DEFAULT 'AMAZON_US',
  profile_id   VARCHAR(128) NOT NULL,     -- sh-{userId}-{marketplace}
  fingerprint  VARCHAR(64),
  synced_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, marketplace)

store_settings                       -- storeAddress; country/state/zip already exist
  + ship_from_name           VARCHAR(120)
  + ship_from_phone          VARCHAR(40)
  + ship_from_address_line1  VARCHAR(200)
  + ship_from_address_line2  VARCHAR(200)
  + ship_from_city           VARCHAR(120)

orders
  + aquiline_order_synced_at        TIMESTAMPTZ  -- upserted to Aquiline
  + tracking_html_uploaded_at       TIMESTAMPTZ  -- last HTML feed
  + tracking_problem_code           VARCHAR(64)  -- latest AquilineProblemCode
  + shipped_detected_at             TIMESTAMPTZ  -- start of the D4 deferral window
  + tracking_conversion_attempts    INT NOT NULL DEFAULT 0
  + ebay_tracking_pushed_number     VARCHAR(64)  -- what eBay actually received
  + ebay_tracking_pushed_at         TIMESTAMPTZ

aquiline_plan_snapshot               -- mirrors keepa_balance
  (id, plan_code, plan_limit, plan_used, plan_remaining,
   profiles_used, profiles_limit, captured_at)
```

`aquiline_profiles` carries **no foreign key to `users`**, the same reasoning as
`ebay_trial_ledger`: the remote profile is permanent and keeps consuming a plan
slot whether or not the SellerHill account still exists, so the row that accounts
for it must outlive a `users` cascade. Deleting it would make the platform lose
track of a paid, non-recoverable resource.

`profiles_used` is on the snapshot for the same reason the ceiling guard exists —
profiles are as metered as shipments and, unlike shipments, they never reset.

`ebay_tracking_pushed_number` is not bookkeeping for its own sake. Once the raw
Amazon number has been pushed, eBay cannot be corrected, so a later conversion
is pure spend with no buyer-visible effect — `convertOnDemand` must refuse.

`tracking_webhook_events` (migration `075`) is reused unchanged: `event_type`
and `outcome` are already `VARCHAR`.

### Vestigial, documented, never dropped

`store_settings.tracking_provider_profile_id` (the profile now lives on the
Amazon account), `tracking.aquiline.partnerId`, and the old
`TrackingProviderStatus` / `TrackingWebhookEvent` members.

## 5. Runtime flows

### 5.1 Shipped transition (automatic)

```
scrapeOrderStatusWithTrackingHtml()
  └ SHIPPED for the first time → stamp shipped_detected_at
    └ handleShipped(order, {trackingUrl, trackingHtml})
       └ resolveForOrder(...)
            ① guard chain (unchanged)
            ② ensureProfile(userId, marketplace)   -- lazy, ceiling-guarded
            ③ upsertOrders(profileId, [order])
            ④ uploadTrackingHtml(profileId, amazonOrderId, {trackingUrl, html})
            ⑤ assign(...) → AQUA + planUsed/planRemaining
            ⑥ persist conversion + plan snapshot
       └ createShippingFulfillment(eBay, AQUA, 'AQUILINE')
```

**There is exactly one Amazon path, whatever the carrier.** The API document's
introduction partitions by *marketplace*, not by carrier: Amazon uses the HTML +
ship-track-URL route, while the carrier-code route (`FEDEX`, `UPS`, `USPS`,
`ONTRAC`, …) belongs to AliExpress and Walmart. `AssignOrderBody.carrier` says
so directly — *"Required for **non-Amazon** assign"* — and the schema's own
Amazon example omits `carrier` entirely in favour of `retailer: amazon-us` +
`marketplaceHost` + `sourceTracking`.

The reason is stated in the introduction: the HTML is wanted *"so Aquiline can
keep **carrier** and delivery context current"*. Aquiline derives the carrier
from the page itself, so an Amazon order shipping via UPS needs no special
handling on our side.

Consequence: `TrackingConversionScope` still decides **whether** to convert (it
is a quota control — see migration `086`), but no longer influences **how**.
Under `scope = all` a UPS-carried Amazon shipment runs the identical ④→⑤
sequence.

The assign body follows the schema example (`retailer`, no `carrier`). Aquiline
support's 2026-08-13 reply showed `carrier: "Amazon"` instead; the machine-readable
schema wins, since sending `carrier` on an Amazon assign risks `assign_validation`
against a field documented as non-Amazon-only.

### 5.2 Deferral (D4)

`handleShipped` returns a result rather than throwing:

- `{ pushed: true }` — conversion done, or a **terminal** conversion failure
  (suspended, quota exhausted, address incomplete, scope excluded, provider
  local). Raw or converted number pushed; status advances to SHIPPED.
- `{ pushed: false, retryAt }` — a **retryable** failure (transport,
  `needs_tracking_upload`, `update_not_applied`, profile creation blip) inside
  the 12h window from `shipped_detected_at`. The status write is skipped, the
  per-order scheduler is re-armed at 1h, and the job completes normally.
- Window expired → push the raw number, `{ pushed: true }`.

Returning a result rather than throwing is deliberate: the existing
throw-to-retry path fails the BullMQ job, which would pollute queue failure
metrics for something that is a normal, expected wait.

The SHIPPED buyer message fires only on `pushed: true`, since it is in the same
branch.

### 5.3 Recurring HTML feed and delivery

`hasWebhookDeliveryCoverage` and its "stop polling" branch are **deleted**.
After SHIPPED the per-order scheduler stays at
`AMAZON_TRACKING_SHIPPED_INTERVAL_HOURS` (24h — the low end of Aquiline's
"1–2× per day"), and every tick now also uploads HTML. On the delivered
transition a final HTML upload runs, then the scheduler is removed.

### 5.4 Manual link and on-demand

`POST /amazon/orders/:orderId/link-amazon` is unchanged — it does not convert.
Conversion still happens only at the shipped transition, and the
`tracking_convert_manual_orders` switch still decides whether a hand-linked
order qualifies.

`POST /amazon/orders/:orderId/convert-tracking` (`convertOnDemand`) keeps its
existing guards and gains one: refuse with `orders.errors.trackingAlreadyPushed`
when `ebay_tracking_pushed_number` is set and is not the converted number.

### 5.5 Webhooks

Signature verification is **unchanged** — `verifyTrackingWebhookSignature`
already implements `X-Webhook-Signature: sha256=<hex hmac of raw body>`, exactly
what the spec documents. The payload body is undocumented, so parsing is
defensive: unknown shapes are recorded and ignored, never fatal.

| Event / problemCode | Action |
|---|---|
| `tracking.html.applied` | record; clear `tracking_problem_code` |
| `tracking.html.accepted` | record only |
| `needs_tracking_upload`, `update_not_applied` | enqueue an immediate HTML upload for that order |
| `amazon_session_expired` | Action Center item — the seller's Amazon session needs re-auth |
| `wrong_page_type`, `tracking_url_mismatch` | **our defect** → `error` log + admin surface |
| `assign_validation` | fall back to raw; store the code on the order |
| `shipment_exception`, `tracking_update_unavailable` | record; no automatic action |
| `tracking.problem.cleared` | clear `tracking_problem_code` |

Registration is idempotent at boot: `GET /v1/webhooks`, create only if our URL
is absent.

## 6. Failure matrix

The single rule is unchanged: **every external failure degrades to
`LocalTrackingConverter` pass-through.** A provider outage, an exhausted plan, a
revoked token or a missing address must never stop a shipment being marked
shipped on eBay.

New on top of that:

- `planRemaining <= 0` from an `assign` response is persisted to
  `aquiline_plan_snapshot`; subsequent conversions short-circuit to pass-through
  without spending a call on a guaranteed 402. Same shape as `keepa_balance`.

  **This guard is the only real protection, because the two quota windows do not
  line up.** A probe on 2026-08-23 returned
  `currentPeriodStart: 2026-08-23`, `currentPeriodEnd: 2026-09-23` and
  `windowKey: "2026-08-23"` — Aquiline's allowance resets on the **subscription
  anniversary**, while `QuotaEnforcementService` meters each seller against a
  **UTC calendar month**. So "the conversion quotas we sold this month total less
  than the Aquiline limit" is never a sufficient safety condition on a given day:
  between the 1st and the 22nd our counters have reset while Aquiline's have not.
  Reconciling the two windows is not worth it — reading the provider's own
  counter is both simpler and authoritative.

  Note `plan.trackLimitPerMonth` is misleadingly named: it reported 300, which is
  the **shipment** allowance, not the plan page's separate "3,000 trackings".
  The tracking allowance and the profile count are not exposed by the API at all,
  which is why the ceiling guard counts `GET /v1/profiles` itself.
- **Profile ceiling reached** → refuse locally, pass through, warn. Distinct from
  a shipment quota wall in both cause and fix: shipments reset monthly and are
  answered by waiting or upgrading, whereas profiles never reset and the only
  fix is an operator decision. Never folded into `QUOTA_EXCEEDED`, for the same
  reason `AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED` is kept separate from
  `QUOTA_EXHAUSTED`.
- `UNAUTHORIZED`, `QUOTA_EXCEEDED` and the profile ceiling log at `error` (they
  silently un-hide the supplier for every order); everything else logs at `warn`.

## 7. Surfaces

- **Store Settings drawer** — new "Ship-from address" section (D2). Incomplete
  address disables the Aquiline provider option with an explanatory hint rather
  than failing silently at conversion time.
- **Order detail** — conversion state, the AQUA number, `tracking_problem_code`
  rendered as localized text (never the raw code), and the existing convert
  action.
- **Action Center** — new item keys for a failing HTML feed, an expired Amazon
  session reported by Aquiline, and conversion problems.
- **Admin** — Aquiline plan snapshot (limit / used / remaining, captured at).
- **i18n** — all new strings in EN + TR. Problem codes map to seller-readable
  sentences; an unmapped code renders a generic message, never the enum.

## 8. Questions for Aquiline — ALL ANSWERED (2026-08-26)

Nothing here is outstanding. Kept as the record, because several answers are
load-bearing and cannot appear in the provider's OpenAPI document. Full text in
`docs/aquiline-open-questions.md`.

**Answered 2026-08-26, and two of them changed the design:**

- **Webhook payload shape.** `{event, createdAt, data:{profileId, orderId, …}}`,
  headers `X-Webhook-Event` + `X-Webhook-Signature`. The AQUA number is never in
  a payload — read it back from `GET …/orders/{orderId}`. `orderId` is the
  MARKETPLACE order id, which is the join key. Delivery is 4 attempts
  (1s/5s/20s, 8s timeout) then dropped. Migration `091` reshaped
  `tracking_webhook_events` for this: `075`'s `tracking_number NOT NULL` made a
  real delivery structurally impossible to insert.
- **Billing.** Only a successful NEW `assign` consumes plan usage. "Trackings"
  meters looking up OTHER users' shipments — `upsertOrders`, `tracking-html`,
  webhooks and `GET`s on our own orders are free, so the §5.3 recurring feed
  costs nothing. **A re-assign returning `reused: true` is not billed**, which
  closes the double-billing exposure this design flagged as its main money risk.
- **Profile reclamation.** "Profiles cannot be deleted through the Integration
  API" and the slot is not freed. Exactly what D1 assumed; no change.
- **Rate limits.** None enforced today; guidance is 1–2 req/sec sustained. No
  client-side limiter built — HTML uploads ride the Amazon scrape, capped at
  `AMAZON_GLOBAL_CONCURRENCY` (5) platform-wide.

**Answered earlier:**

1. ~~Does `assign` succeed immediately after an `accepted` (not yet `applied`)
   HTML upload?~~ Still not stated outright by the provider, but it no longer
   matters and is no longer worth asking: D4's deferral is correct under either
   answer, and since 2026-09-01 a failed conversion never falls through to the
   raw Amazon number at all — it holds. The only thing an answer would change is
   how long the hold typically lasts.
2. ~~Can an Amazon profile assign by `carrier` + tracking number?~~ **Answered by
   the API document itself.** Its introduction partitions by marketplace — Amazon
   uses the HTML route, the carrier-code route belongs to AliExpress/Walmart —
   and `carrier` is documented as *"Required for non-Amazon assign"*. Aquiline
   reads the carrier out of the uploaded HTML. One Amazon path, all carriers;
   see §5.1. (The residual ambiguity is cosmetic: support's example sent
   `carrier: "Amazon"` where the schema example sends `retailer: amazon-us`. We
   follow the schema.)
3. ~~What is the profile limit, and can a slot be reclaimed?~~ **Answered: 10 on
   Starter** (25 / 50 / 100 / 250 up the ladder), and **no** — profiles cannot be
   deleted through the Integration API and the slot is not freed. This drove D1
   to per-user granularity and the ceiling guard, both of which already assumed
   permanence.
4. ~~What does `suggestAmazonEmailFetch` expect?~~ Dropped, not asked. It has no
   observable effect to test and no code path depends on it; SellerHill has no
   mailbox access.
5. ~~Does reading `GET …/orders/{orderId}` consume the "trackings" allowance?~~
   **Answered: no.** Our own orders are never metered again after assign —
   "trackings" counts looking up shipments created by OTHER users.

**Probe findings, 2026-08-23 (`pnpm --filter api aquiline:probe`):** auth and
base URL confirmed; the account holds 0 profiles and 0 webhooks;
`plan.trackLimitPerMonth` is the **shipment** allowance (300) despite its name,
and neither the tracking allowance nor the profile count is exposed; the usage
window is the subscription period, not a calendar month (§6); the error body
carries a machine-readable `code` (§3.1); and no rate-limit headers are
advertised, which support later confirmed is because none are enforced.
Undocumented response fields observed on `/v1/me`: `currentPeriodStart`,
`pendingPlanCode`, `pendingCadence`.

## 9. Testing

Pure and unit-testable without the provider:

- `aquiline.client.spec.ts` — request shaping, auth header composition, error
  classification, retry policy (4xx never retried).
- `aquiline-profile.spec.ts` — deterministic id, fingerprint change detection.
- `tracking-conversion.spec.ts` — the guard chain, and that every failure kind
  yields the pass-through.
- `tracking-deferral.spec.ts` — D4: retryable vs terminal classification, the
  12h window boundary, and that the window expiring pushes the raw number.
- `tracking-webhook.helpers.spec.ts` — extended for the real event names and
  problem codes; signature tests unchanged.
- A guard spec asserting `hasWebhookDeliveryCoverage` has not returned, in the
  style of `failure-visibility.guard.spec.ts`.

**Nothing below the decision layer has ever run against the real provider.** The
first live order is the gate, exactly as A2 auto-fulfill treats its first real
placement. Until then, no part of the Aquiline path may be described as working.

## 10. Edge cases, and what this deliberately does not do

- **No backfill.** Conversion happens only at the shipped transition. Orders
  already shipped when Aquiline is switched on keep their raw numbers forever,
  because eBay has already received them and cannot be corrected. Switching a
  seller from `local` to `aquiline` therefore affects future shipments only.
- **One tracking number per order.** `orders.amazon_tracking_number` is
  single-valued, so an Amazon order that ships as several packages converts its
  primary number only. This is a pre-existing limitation, not one introduced
  here, and it is why the tracking URL must be read from the page rather than
  constructed — the real link carries the package index that identifies *which*
  package the URL and the HTML both refer to.
- **A crashed profile creation is self-healing.** If Aquiline creates the
  profile but our row write fails, the slot is consumed with nothing recorded —
  normally unrecoverable, since profiles cannot be deleted. The deterministic
  `sh-{userId}-{marketplace}` id removes the problem: the next attempt derives
  the identical id, the provider reports it already exists, and we adopt it and
  write the row. This is the main operational payoff of not letting the provider
  generate the id.
- **Webhook registration is conditional.** It requires a publicly reachable
  receiver, which local development does not have. Registration is skipped
  unless a public base URL and a webhook secret are both configured; the
  conversion path works without it, only problem reporting is lost.
- **Adjacent defects in `extractTracking` are fixed as part of this work**, since
  the same function is being extended. Carrier detection scans the whole page
  body with `/ups/i` (matches "groups"), tests `amazon logistics` **last**, and
  pulls the tracking number with patterns as loose as `/\d{12,14}/`. A
  mislabelled Amazon Logistics shipment silently fails the default
  `amazon_logistics_only` scope, i.e. the shipment that most needs converting is
  the one skipped. Carrier detection moves to the tracking number first (which
  is unambiguous) with the page text as a fallback, and `amazon logistics` is
  tested before the substring-prone carrier names.

## 11. Verification plan (first live order)

1. `getMe()` returns the plan — token and base URL are right.
2. A profile appears in the Aquiline dashboard under `sh-{amazonAccountId}`.
3. One order upserts and its ship-track HTML is `accepted`.
4. `assign` returns an `AQUA…YQ` number and `planUsed` increments by one.
5. eBay accepts the fulfillment under carrier `AQUILINE`.
6. Amazon polling continues; delivery completes the order.
7. A webhook arrives and is recorded in `tracking_webhook_events`.
