# Aquiline Integration API — questions and answers

**Status: CLOSED.** Round 1's four questions were answered by Aquiline support
on 2026-08-26. A fifth was opened on 2026-09-02 and answered the same day by a
live probe rather than by support — see "5. Is `storeAddress` required?" at the
bottom. Nothing is outstanding.

This file is kept as the record of what was asked and what came back, because
several of the answers are load-bearing and appear nowhere in the provider's
OpenAPI document — that document is 3.0.3, which has no `webhooks:` section, so
the payload shape in particular can only ever come from here. The OpenAPI
document itself is **not checked into this repo**; it arrived as a support
attachment in August.

Email sent: `aquiline-support-email.md` (round 1). A round-2 draft existed
briefly and was deleted unsent once the probe answered it.

---

## 1. Webhook payload shape — ANSWERED

Common envelope, with `X-Webhook-Event` and `X-Webhook-Signature: sha256=<hex>`
(HMAC-SHA256 over the raw body) as headers:

```json
{ "event": "<event-name>", "createdAt": "…", "data": { "profileId": "…", "orderId": "…" } }
```

- `data` **always** carries `profileId` and `orderId`, where `orderId` is the
  **marketplace order id** — the Amazon order id we sent to `upsertOrders`.
- **The AQUA number is never in a webhook.** Read it from
  `GET /v1/profiles/{profileId}/orders/{orderId}` → `aquilineNumber`.
- `problemCode` appears on `tracking.problem.opened`, `tracking.html.rejected`,
  and optionally on `tracking.html.accepted` when accepted in a degraded state.
  `tracking.problem.cleared` carries `previousProblemCode` instead.
- `tracking.html.rejected` also returns its HTTP 4xx; the webhook is
  best-effort on top of that.
- Delivery: up to 4 attempts (1s / 5s / 20s), 8s timeout each, then dropped
  permanently. The receiver must be idempotent and fast.

Implemented in `tracking-webhook.helpers.ts` / `.service.ts`; migration `091`
reshaped `tracking_webhook_events` for it (the `075` schema required a
`tracking_number`, which a real payload never has — every genuine delivery
would have failed to insert).

## 2. Rate limits — ANSWERED

No application-level 429 limiter is enforced today. No separate limits for
`assign` vs `tracking-html`. The token is bound to one account, so limits are
de facto per account. The published "~100 req/min" was a pacing recommendation,
not a hard limit; their rollout guidance is **1–2 req/sec sustained**.
Infrastructure-level 429s remain possible on aggressive bursts.

(The 250 req/min figure in their docs belongs to the separate v3 partner API.)

No client-side limiter was built: HTML uploads ride the Amazon scrape, which
`AMAZON_GLOBAL_CONCURRENCY` caps at 5 concurrent browser actions
platform-wide — far below the guidance. `AquilineClient` already treats 429 as
retryable transport.

## 3. Profile slot reclamation — ANSWERED

> "Once created via the API, a profile is persistent: the slot is not freed
> automatically, and profiles cannot be deleted through the Integration API."

There is no `DELETE /v1/profiles/{profileId}` — only `GET` / `POST` / `PATCH`.

This is exactly what the design already assumed, so nothing changed: profile
ids are deterministic (`{prefix}-{userId}-{marketplace}`) so a crashed creation
can reclaim its own slot rather than stranding it, creation is lazy and runs
behind a global advisory lock, and `AQUILINE_MAX_PROFILES` (10 on Starter) is
checked before every create because the resource cannot be recovered.

## 4. Shipment / tracking / profile — ANSWERED, and it corrected us

| Term | Meaning |
|---|---|
| **Profile** | One `profileId` resource. |
| **Shipment** | One successful **new** `assign` that issues an AQUA number. **This is the only thing that consumes plan usage** — Starter's 300 is 300 new assigns per billing period. |
| **Tracking** | Looking up tracking for Aquiline shipments **created by other users**. Not our meter at all. |

Two consequences we had wrong before this answer:

- **Our own shipments are not metered again after assign.** `upsertOrders`,
  `tracking-html` uploads, status updates, webhooks and `GET`s on our own
  orders consume **zero** monthly usage. An earlier reading treated the "3,000
  trackings" line as a second ceiling and used it to argue that continued
  polling was expensive — that was simply wrong, and it means the recurring
  HTML feed is free to run daily.
- **A re-assign that returns `reused: true` is not billed.** This closes the
  double-billing exposure the design had flagged as its main money risk: the
  bounded retry and deferral paths can re-enter `assign` for an order that
  already has an AQUA number without being charged twice.

Usage window: **the subscription period, not the calendar month.** `windowKey`
is `currentPeriodStart` and `used` resets on the anniversary (23 Aug → 23 Sep).
Our own `QuotaEnforcementService` meters a UTC calendar month, so the two
windows are deliberately offset — which is why `isPlanExhausted` reads the
provider's own `planRemaining` from a TTL'd snapshot rather than inferring
anything from our counters.

Profile used/limit/remaining is **not** exposed by the API; only
`GET /v1/profiles` (list), which is what `AquilineProfileService` counts.

---

## Answered earlier, kept for the record

| Question | Answer | Source |
|---|---|---|
| Which surface converts Amazon TBA → AQUA? | The Integration API, not the v3 partner API | support, 2026-08-13 |
| Can an Amazon profile assign by `carrier` + number? | No — Amazon uses the HTML route; `carrier` is "required for non-Amazon assign". Aquiline derives the carrier from the uploaded HTML | API document introduction |
| What is the profile limit? | 10 on Starter (25 / 50 / 100 / 250 above) | plan page |
| Is there a test environment? | No | support |
| Does `trackLimitPerMonth` count shipments? | Yes — 300, despite the name | live probe |
| What does an error body look like? | `{success: false, code: "not-found", message: "…"}` | live probe |
| Are light `GET` calls rate-limited? | Not at 15 rapid calls — no 429, no rate-limit headers | live probe |

## 5. Is `storeAddress` required? — ANSWERED BY LIVE PROBE, 2026-09-02

**No. `accountOrigin` is the ONLY required field on `POST /v1/profiles`.** No
support round was needed; the API answered directly.

```
POST /v1/profiles   {"accountOrigin":"amazon"}
→ 200 {"success":true,"profileId":"dfdVN3dlo4tmtOiC"}

GET /v1/profiles
→ {"profileId":"dfdVN3dlo4tmtOiC","label":"dfdVN3dlo4tmtOiC",
   "accountOrigin":"amazon","marketplaceHost":null,
   "retailer":"amazon-us","sourceKind":"amazon",
   "amazonAccountEmail":null,"storeAddress":null}
```

`profileId`, `label`, `marketplaceHost` and `storeAddress` are all optional —
the provider generated an id, mirrored it into `label`, defaulted `retailer` to
`amazon-us` from `accountOrigin`, and stored `storeAddress: null` without
complaint.

**Validation is FAIL-FAST and its messages conflate missing with invalid.**
Every malformed body — empty `{}`, a bad enum with a full address, a bad enum
with none — returned exactly `"accountOrigin is required (amazon | aliexpress |
walmart)."`. So a 4xx cannot be used to enumerate required fields, and an
absent complaint about a field is not evidence that field is optional.

**This probe cost one permanent profile slot** (9 of 10 left). `DELETE
/v1/profiles/{id}` returns `404 "Unknown route."` — deletion really is
unsupported, now verified rather than assumed. The orphan `dfdVN3dlo4tmtOiC`
is left in place; it can be salvaged by inserting it into `aquiline_profiles`
for the first real seller, since `ensureProfile` adopts a stored id and PATCHes
it rather than creating a new one. It carries a server-generated id, so it does
not match the `sh-{userId}-{marketplace}` scheme and cannot be adopted
automatically.

**What changed as a result** (same day): `storeAddress` is no longer sent at
all, `ensureProfile`'s address gate is deleted (it used to refuse a profile —
and therefore all conversion — until a synthesized address was complete),
`fingerprintProfile` no longer hashes an address, and the seller-address fields
are required for **eBay's inventory location only**, which is the one place the
requirement is documented and verified.

**The earlier claim that this address is the buyer-visible "return address" was
never true and is now moot** — it was our own assumption, propagated from
design notes into seller-facing i18n, and we send no address at all now.

## Still unproven — but not a question for support

No **conversion** has ever run against the real provider: the four-call
sequence (profile → upsert → tracking-html → assign) needs a connected Amazon
buyer account with a shipped order, which does not exist yet. That is a
verification gap, not an unanswered question. The verification plan for the
first live order is in CLAUDE.md under "Tracking conversion (Aquiline)".
