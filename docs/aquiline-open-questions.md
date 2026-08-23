# Aquiline Integration API — open questions

**Status:** final list, ready to send. Everything else we asked ourselves by
calling the API (`pnpm --filter api aquiline:probe`).

**Context for support:** we are on the **Starter** plan and integrating the
Integration API **server-side**, not through the browser extension. Our platform
hosts many sellers; each seller gets one profile, and we upload Amazon
ship-track HTML from our own authenticated Amazon sessions.

---

## 1. Can you send example webhook payloads?

This is our largest gap. The OpenAPI document specifies the signature header
(`X-Webhook-Signature: sha256=<hex hmac of raw body with your secret>`) and the
event names, but not the payload body — and it cannot, since the document is
OpenAPI 3.0.3, which has no `webhooks:` section.

We need one sample body for each event so we can write the receiver:

- `tracking.html.accepted`
- `tracking.html.applied`
- `tracking.html.rejected`
- `tracking.problem.opened`
- `tracking.problem.cleared`

Specifically: which field carries the `problemCode`, and which field identifies
the order — the marketplace order id, the profile id, or the Aquiline tracking
number?

## 2. What are the rate limits on the Integration API?

Requests per second / minute / day, per token or per account. `GET /v1/me`
returns no `X-RateLimit-*` headers, so we cannot discover this without
deliberately hammering the endpoint, which we would rather not do.

Our expected shape: one `tracking-html` upload per in-flight order per day,
plus a burst of `upsert` + `tracking-html` + `assign` whenever an order ships.

## 3. Can seller profile slots be reclaimed?

`/v1/profiles/{profileId}` exposes only `GET` and `PATCH` — there is no
`DELETE`, unlike `/v1/webhooks/{webhookId}`. Starter includes 10 profiles.

Since there is no test environment, our development and testing necessarily
create real profiles. If a profile becomes obsolete — a test profile, or a
seller who leaves — can the slot be freed, through the API or by your team? If
not, we will treat every creation as permanent and guard it accordingly.

## 4. Where can we read the trackings allowance and the profile count?

`GET /v1/me` returns `billing.usage {used: 0, limit: 300, remaining: 300}` and
`plan.trackLimitPerMonth: 300`, which matches the **300 Aquiline shipments** on
our plan rather than the **3,000 trackings per month** the plan page also lists.

- Is the trackings allowance readable anywhere in the API, and what consumes it?
- Is the profile count (used / allowed) readable anywhere? We currently count
  `GET /v1/profiles` ourselves.

Please also confirm our reading of the usage window: `windowKey` came back as
`2026-08-23`, matching `currentPeriodStart`, with `currentPeriodEnd`
`2026-09-23`. We are treating the allowance as resetting on the **subscription
anniversary**, not on the 1st of each calendar month.

## 5. What is `amazonCustomerId`, and what does it improve?

Both `tracking-html` and `assign` accept it, but it is not explained. Where do
we obtain it, and what changes if we omit it?

## 6. What does `suggestAmazonEmailFetch` expect us to do?

It appears in the `upsert` and `tracking-html` responses. We have no access to
the seller's Amazon mailbox, so we currently ignore it. Does ignoring it degrade
tracking quality?

---

## Answered — no longer being asked

| Question | Answer | Source |
|---|---|---|
| Which surface converts Amazon TBA → AQUA? | Integration API, not the v3 partner API | support, 2026-08-13 |
| Can an Amazon profile assign by `carrier` + number? | No — Amazon uses the HTML route; `carrier` is "required for non-Amazon assign". Aquiline reads the carrier from the uploaded HTML | API document introduction |
| What is the profile limit? | 10 on Starter (25 / 50 / 100 / 250 above) | plan page |
| Is there a test environment? | No | support, asked previously |
| Does `trackLimitPerMonth` count shipments? | Yes — 300, despite the name | probe |
| What does an error body look like? | `{success: false, code: "not-found", message: "…"}` — a machine-readable `code` | probe |

## Being answered by probing, not by asking

`pnpm --filter api aquiline:probe` settles these once a real shipped Amazon
order is connected: the HTML size limit, `assign` idempotency and billing on
repeat, whether `assign` works immediately after an `accepted` upload, the
`upsert` batch limit, accepted `status` values, what a repeat `POST /v1/profiles`
with the same id does, `retailer` vs `carrier` on an Amazon assign, and whether
the `trackingUrl` must match byte-for-byte between `tracking-html` and `assign`.
