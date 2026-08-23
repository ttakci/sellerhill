# Aquiline Integration API — open questions

Context for support: we are on the **Starter** plan and integrating the
Integration API server-side (no browser extension). Our platform hosts many
sellers; each seller gets one profile, and we upload Amazon ship-track HTML from
our own authenticated Amazon sessions.

---

## Which of these actually need an answer from support

Most of this list is answerable by calling the API, which is faster and more
precise than relaying a question through their engineering team. Run
`pnpm --filter api aquiline:probe` first; it settles §1–§5 (except rate limits),
§9, §10, §11, §13 and §14 empirically.

**Send to support — cannot be discovered safely:**

- **§6 profile slot reclamation** — there is no `DELETE`, and testing it means
  permanently burning slots.
- **§8 `amazonCustomerId`** — omitting it works; what it *improves* is not
  observable.
- **§12 `suggestAmazonEmailFetch`** — same, its meaning is not observable.
- **§5 rate limits** — only if the probe finds no `X-RateLimit-*` headers.
  Discovering them by hammering the API is rude and risks being flagged.
- **§15 test mode** (below) — worth asking before spending anything.

### 15. Is there a test mode, or an assign that is not billed?

There is no sandbox, so every integration test we run consumes real plan
allowance and, for profiles, consumes it permanently. Is there a test flag, a
staging tenant, or a way to create and then reverse a test shipment?

---

## Blocking — we cannot finish the integration without these

### 1. Is there a size limit on the `html` field of `POST /v1/profiles/{profileId}/orders/{orderId}/tracking-html`?

A full Amazon ship-track page is typically 0.5–2 MB of HTML. Is there a maximum
request body size? If so, what is it, and should we send only a subset of the
page (for example just the progress-tracker container) rather than the full
document? Which elements must be present for parsing to succeed?

### 2. Can you send example webhook payloads?

The OpenAPI document specifies the signature header
(`X-Webhook-Signature: sha256=<hex hmac of raw body with your secret>`) and the
event names, but not the payload body schema. We need one sample body for each
of the five events so we can write a parser:

- `tracking.html.accepted`
- `tracking.html.applied`
- `tracking.html.rejected`
- `tracking.problem.opened`
- `tracking.problem.cleared`

In particular: which field carries the `problemCode`, and which field identifies
the order (marketplace order id? profile id? Aquiline tracking number?).

### 3. How does a repeated `assign` on the same order behave?

Your team told us "Same order assign is idempotent (reused: true)", but `reused`
does not appear in the documented response schema. Please confirm:

- Does a second `assign` on the same order return the **same** AQUA number?
- Is `chargedCents` zero on that repeat, i.e. are we billed only once?
- Is there any condition under which a repeat mints a **second** shipment?

We retry on transport failures, so we need certainty that a retry cannot be
billed twice.

### 4. Can `assign` be called immediately after `tracking-html` returns `outcome: accepted`?

The docs say `outcome` may be `accepted` with `trackingUpdateStatus: processing`,
and warn "Never treat success alone as applied". Must we wait for `applied`
before calling `assign`, or is `accepted` sufficient? If we must wait, what is
the typical processing time, and does `assign` return `needs_tracking_upload`
until then?

### 5. What are the rate limits on the Integration API?

Requests per second / minute / day, per token or per account. We expect roughly
one `tracking-html` upload per in-flight order per day, plus a burst of
`upsert` + `tracking-html` + `assign` whenever an order ships.

---

## Operational

### 6. Can seller profile slots be reclaimed?

`/v1/profiles/{profileId}` exposes only `GET` and `PATCH` — there is no
`DELETE` (unlike `/v1/webhooks/{webhookId}`). Our Starter plan includes 10
profiles. If a profile becomes obsolete (a seller leaves), can the slot be
freed, either through the API or by your support team? If not, we will treat
profile creation as permanent and guard it accordingly.

### 7. Where can we read the trackings allowance and the profile count?

Resolved by probing that `billing.usage.limit` and `plan.trackLimitPerMonth`
both report 300 on Starter, i.e. the **shipment** allowance. Two gaps remain,
and they are small:

- The plan page also lists **3,000 trackings per month** for Starter. That
  allowance is not exposed by `GET /v1/me`. Is it readable anywhere, and what
  consumes it?
- The **profile count** (used / allowed) is likewise not exposed. We currently
  count `GET /v1/profiles` ourselves. Is there a canonical source?

Also, please confirm our reading of the usage window: `windowKey` came back as
`2026-08-23`, matching `currentPeriodStart`, with `currentPeriodEnd`
`2026-09-23`. We are treating the allowance as resetting on the subscription
anniversary rather than on the 1st of each calendar month.

### 8. What is `amazonCustomerId`, and what does it improve?

It is accepted by both `tracking-html` and `assign` but not explained. Where do
we obtain it, and what changes if we omit it?

---

## Clarifying (non-blocking)

### 9. How many orders may one `POST .../orders/upsert` carry?

Is there a maximum array length? We normally send one order, but a backfill
would batch.

### 10. Does `MarketplaceOrder.status` accept arbitrary strings?

The example uses `"Shipping"`. Is there a fixed vocabulary, and does the value
affect processing, or is it purely informational?

### 11. What happens on `POST /v1/profiles` with a `profileId` that already exists?

Does it return 200 (idempotent upsert), 409, or create a duplicate? We derive
`profileId` deterministically, so we would like to rely on repeated creation
being safe.

### 12. What does `suggestAmazonEmailFetch` in the `upsert` and `tracking-html`
responses expect us to do?

We have no access to the seller's Amazon mailbox, so we currently ignore it.
Does ignoring it degrade tracking quality?

### 13. For an Amazon profile, is the assign body `retailer: amazon-us` (per the
schema example) or `carrier: "Amazon"` (per your 2026-08-13 reply)?

The schema's Amazon example sends `retailer` + `marketplaceHost` +
`sourceTracking` and no `carrier`, and documents `carrier` as "Required for
non-Amazon assign". Your reply showed `carrier: "Amazon"`. We are following the
schema — please confirm that is correct.

### 14. Must the `trackingUrl` sent to `assign` be byte-identical to the one sent
to `tracking-html`?

The `tracking_url_mismatch` problem code suggests yes. We read the real URL from
Amazon's own "Track package" link and reuse it for both calls, so it should
match — we want to confirm that is the expected behaviour, including for orders
that ship as multiple packages (where the URL carries a package index).
