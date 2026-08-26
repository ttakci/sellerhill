# Aquiline Integration API — open questions

**Status:** final list, ready to send. Everything below was tried in code first
(live probe calls against the production account — we have no sandbox and are
on the Starter plan bought for development, so testing against production is
accepted) and each of these 4 questions is what remained unanswerable that way.

**Context for support:** we are integrating the Integration API **server-side**,
not through the browser extension. Our platform hosts many sellers; each
seller gets one profile, and we upload Amazon ship-track HTML from our own
authenticated Amazon sessions.

---

## 1. Can you send example webhook payloads?

The OpenAPI document specifies the signature header
(`X-Webhook-Signature: sha256=<hex hmac of raw body with your secret>`) and the
event names, but not the payload body — and it structurally cannot: the
document is OpenAPI **3.0.3**, which has no `webhooks:` section at all.

We have already built a receiver that captures the raw body of every
signature-verified delivery regardless of shape, so once we register a
webhook against a reachable URL we expect to answer this ourselves from a
real delivery. If you can send samples in the meantime, that saves us the
wait — we still need one for each event:

- `tracking.html.accepted`
- `tracking.html.applied`
- `tracking.html.rejected`
- `tracking.problem.opened`
- `tracking.problem.cleared`

Specifically: which field carries the `problemCode`, and which field
identifies the order — the marketplace order id, the profile id, or the
Aquiline tracking number?

## 2. What are the rate limits on the Integration API?

We ran 15 rapid sequential `GET /v1/me` calls against production and saw no
`429`, no `Retry-After`, and no `X-RateLimit-*` (or similarly named) response
header on any of them — so light GET traffic is not visibly throttled, at
least not below that volume. We have not tested sustained load or the
**billed** `POST .../assign` calls, and don't want to probe those blindly
since each one is a real charge. What are the actual limits (requests per
second/minute/day, per token or per account), particularly on `assign` and
`tracking-html`?

Our expected shape: roughly one `tracking-html` upload per in-flight order per
day, plus a burst of `upsert` + `tracking-html` + `assign` whenever an order
ships.

## 3. Can seller profile slots be reclaimed?

`/v1/profiles/{profileId}` exposes only `GET` and `PATCH` — there is no
`DELETE`, unlike `/v1/webhooks/{webhookId}`. Our Starter plan includes 10
profiles.

Since there is no test environment, our development and testing necessarily
create real profiles against that same 10-profile allowance. If a profile
becomes obsolete — a test profile, or a seller who leaves — can the slot be
freed, through the API or by your team? If not, we will treat every creation
as permanent and guard it accordingly (which is what our code already does).

## 4. Where can we read the trackings allowance and the profile count?

`GET /v1/me` returns `billing.usage {used, limit, remaining}` and
`plan.trackLimitPerMonth`, both of which report our plan's **shipment**
allowance (300 on Starter) rather than the separate **3,000 trackings per
month** the plan page also lists. We checked every response shape in the
published document for a second counter and found none.

- Is the trackings allowance readable anywhere in the API, and what consumes
  it, given there is no delivery webhook to poll status with?
- Is the profile count (used / allowed) readable anywhere? We currently count
  `GET /v1/profiles` ourselves, which works but costs a call we would rather
  not need.

Please also confirm our reading of the usage window: `windowKey` came back as
`2026-08-23`, matching `currentPeriodStart`, with `currentPeriodEnd`
`2026-09-23`. We are treating the allowance as resetting on the **subscription
anniversary**, not on the 1st of each calendar month.

---

## Answered — no longer being asked

| Question | Answer | Source |
|---|---|---|
| Which surface converts Amazon TBA → AQUA? | Integration API, not the v3 partner API | support, 2026-08-13 |
| Can an Amazon profile assign by `carrier` + tracking number? | No — Amazon uses the HTML route; `carrier` is "required for non-Amazon assign". Aquiline reads the carrier from the uploaded HTML | API document introduction |
| What is the profile limit? | 10 on Starter (25 / 50 / 100 / 250 above) | plan page |
| Is there a test environment? | No | support, asked previously |
| Does `trackLimitPerMonth` count shipments? | Yes — 300, despite the name | live probe |
| What does an error body look like? | `{success: false, code: "not-found", message: "…"}` — a machine-readable `code` | live probe |
| Are light `GET` calls rate-limited? | Not visibly at 15 rapid calls — no `429`, no rate-limit headers | live probe (2026-08-26) |
| What is `amazonCustomerId` / `suggestAmazonEmailFetch`? | Not asked — no observable effect exists to test, and no code path depends on either; low priority, dropped from the list to keep it short. Ask only if support has spare bandwidth. |

## Being answered by probing, not by asking

`pnpm --filter api aquiline:probe` settles these once a real shipped Amazon
order is connected: the HTML size limit, `assign` idempotency and billing on
repeat, whether `assign` works immediately after an `accepted` upload, the
`upsert` batch limit, accepted `status` values, what a repeat `POST /v1/profiles`
with the same id does, and whether the `trackingUrl` must match byte-for-byte
between `tracking-html` and `assign`.
