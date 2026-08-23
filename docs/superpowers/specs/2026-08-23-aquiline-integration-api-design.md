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
| D1 | One Aquiline profile per **Amazon buyer account** | The profile carries `amazonAccountEmail` + `marketplaceHost`, and the ship-track HTML comes from that account's session. Any other granularity makes `tracking_url_mismatch` structurally likely. |
| D2 | `storeAddress` comes from **new full-address columns on `store_settings`** | Every other tracking setting already lives there with Store > Global > Default resolution. `store_settings` today holds only `country`/`state`/`zip_code`; street, city, name and phone are new. |
| D3 | Delivery is detected by **continued Amazon polling**, in the same page visit that feeds the HTML | We must visit the page anyway. Delivery then costs nothing extra and needs no new mechanism. |
| D4 | A failed first conversion **defers the eBay push up to 12h, retrying hourly** | eBay's Fulfillment API has no update endpoint (`createShippingFulfillment` is `POST`-only), so the first push is the only chance to give the buyer an AQUA number. |

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
- Bounded retry stays: 429/5xx/network only, 3 attempts. A 4xx is never retried
  — on the conversion path a blind retry risks paying twice.
- `AQUILINE_PARTNER_ID` becomes dead (the Integration API has no `X-Partner-Id`).
  Left registered and dormant, never deleted.

### 3.2 `AquilineProfileService` — new

Maps `amazon_accounts.id` → Aquiline `profileId`.

`profileId` is **client-chosen** (spec: *"Optional client-chosen id; server
generates one if omitted"*), so it is derived deterministically as
`sh-{amazonAccountId}`. That makes creation naturally idempotent and means the
id can never be lost.

- `ensureProfile(amazonAccountId)` runs under a **pg advisory lock keyed on the
  account** (the `resolveProductData` / `ensureSeeded` idiom), so N concurrent
  shipped transitions on one account create exactly one profile.
- `aquiline_profile_fingerprint` is a hash of the label + resolved
  `storeAddress`. Unchanged fingerprint → no call. Changed → `PATCH`. Without it
  every conversion would re-PATCH the profile.
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
amazon_accounts
  + aquiline_profile_id          VARCHAR(128)
  + aquiline_profile_synced_at   TIMESTAMPTZ
  + aquiline_profile_fingerprint VARCHAR(64)

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
  (id, plan_code, plan_limit, plan_used, plan_remaining, captured_at)
```

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
            ② ensureProfile(amazonAccountId)
            ③ upsertOrders(profileId, [order])
            ④ uploadTrackingHtml(profileId, amazonOrderId, {trackingUrl, html})
            ⑤ assign(...) → AQUA + planUsed/planRemaining
            ⑥ persist conversion + plan snapshot
       └ createShippingFulfillment(eBay, AQUA, 'AQUILINE')
```

For a non-Amazon-Logistics carrier under `scope = all`, ④ is skipped and ⑤ uses
the carrier shape (`carrier: UPS|USPS|FEDEX|ONTRAC`, tracking number in
`trackingUrl`). Marked `TODO(confirm)` — see §8.

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
- `UNAUTHORIZED` and `QUOTA_EXCEEDED` log at `error` (they silently un-hide the
  supplier for every order); everything else logs at `warn`.

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

## 8. Open questions for Aquiline (design is safe under either answer)

1. Does `assign` succeed immediately after an `accepted` (not yet `applied`)
   HTML upload? — D4 covers both.
2. Can an **Amazon** profile assign by `carrier` + tracking number for a 3PL
   shipment (UPS/USPS/FedEx/OnTrac)? The `carrier` field description says
   "Walmart/Amazon 3PL", which implies yes. Needed for `scope = all`; under the
   default `amazon_logistics_only` it is never exercised.
3. What is the **profile limit** on the purchased plan? D1 creates one profile
   per Amazon buyer account. If the ceiling is low, profile creation must fail
   soft (it does) and the granularity is revisited.
4. What does `suggestAmazonEmailFetch` in the upsert / tracking-html responses
   expect? Ignored for now — SellerHill has no mailbox access.
5. Does reading `GET …/orders/{orderId}` consume the plan's "trackings"
   allowance? Only used for reconciliation, never on a schedule.

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

## 10. Verification plan (first live order)

1. `getMe()` returns the plan — token and base URL are right.
2. A profile appears in the Aquiline dashboard under `sh-{amazonAccountId}`.
3. One order upserts and its ship-track HTML is `accepted`.
4. `assign` returns an `AQUA…YQ` number and `planUsed` increments by one.
5. eBay accepts the fulfillment under carrier `AQUILINE`.
6. Amazon polling continues; delivery completes the order.
7. A webhook arrives and is recorded in `tracking_webhook_events`.
