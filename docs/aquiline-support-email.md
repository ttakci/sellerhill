Subject: Integration API — 4 open questions before we finish our production rollout (webhook payload shape, rate limits, profile reclamation, plan counters)

Hello,

Thank you again for pointing us to the Integration API back in August — we've
since built our full server-side integration against it (profile creation,
order upsert, ship-track HTML upload, and assign for the AQUA conversion). It
is working end-to-end in our own testing. Before we finish rolling it out to
our sellers, we have four questions where we could not find an answer in the
published OpenAPI document, and could not resolve by testing against our
Starter account ourselves. Details and context for each are below so you can
forward this straight to engineering if needed.

For context: we are a multi-seller dropshipping platform. Each of our sellers
gets one Aquiline profile (id pattern `sh-{ourUserId}-{marketplace}`), and we
upload Amazon ship-track HTML from our own authenticated Amazon Playwright
sessions — not the browser extension.

---

**1. Can you send us example webhook payloads for each event type?**

The OpenAPI document you provided documents the `X-Webhook-Signature` header
and the five event names, but not the payload body — and as far as we can
tell it structurally can't, since the document is OpenAPI version 3.0.3,
which has no `webhooks:` section at all (that only exists from 3.1 onward).

We've already built a receiver on our side that captures the raw body of
every signature-verified delivery we get, regardless of shape, so once we
register a webhook URL with you we expect to see a real payload ourselves the
first time something fires. But if someone on your engineering side can just
paste us one example JSON body per event, that saves us the wait entirely.
We need one for each of:

- `tracking.html.accepted`
- `tracking.html.applied`
- `tracking.html.rejected`
- `tracking.problem.opened`
- `tracking.problem.cleared`

Specifically, for each one: which field carries the `problemCode`, and which
field identifies the order — is it the `marketplaceOrderId` we sent, our
`profileId`, or the `AQUA…YQ` tracking number you generated?

---

**2. What are the actual rate limits on the Integration API?**

We ran 15 rapid, sequential `GET /v1/me` calls back-to-back and saw no `429`,
no `Retry-After` header, and nothing that looked like `X-RateLimit-*` on any
of the responses — so at least light read traffic isn't visibly throttled.

We have NOT tested sustained load, and we deliberately have not tested the
limits on `POST .../orders/{orderId}/assign`, since that endpoint bills us
per call and we didn't want to burn real money just to find a wall by hitting
it.

Could you tell us the actual limits — requests per second/minute/day, and
whether they're per API token or per account — especially for `assign` and
for `tracking-html` uploads? Our expected traffic shape is roughly one
`tracking-html` upload per in-flight order per day (to keep your carrier
context fresh), plus a burst of `orders/upsert` → `tracking-html` → `assign`
whenever one of our sellers' orders ships.

---

**3. Can a seller profile slot be freed once it's no longer needed?**

Looking at the OpenAPI spec, `/v1/profiles/{profileId}` only exposes `GET`
and `PATCH` — there's no `DELETE`, whereas `/v1/webhooks/{webhookId}` does
have one. Our Starter plan includes 10 profiles.

Since there's no test/sandbox environment, our own development and testing
work has necessarily created a few real profiles against that same 10-profile
allowance. Our question: if a profile becomes obsolete — say a test profile
we created, or one of our sellers who stops using the integration — is there
any way to free that slot, either through the API (are we missing an
endpoint?) or by asking your team to remove it manually? If the honest answer
is "no, profiles are permanent," that's fine — we just want to build our
capacity planning around the correct assumption rather than guess.

---

**4. Could you define exactly what counts as one "shipment," one "tracking,"
and one "profile"?**

Our pricing page lists three separate numbers per tier (e.g. on Starter:
"300 Aquiline shipments," "3,000 trackings per month," "10 seller profiles"),
but none of the three terms is defined anywhere in the OpenAPI document. From
testing, we've worked out two of them ourselves:

- **Profile** — one `POST /v1/profiles` call/resource. Clear.
- **Shipment** — we're fairly confident this is one `assign` call, since
  `GET /v1/me`'s `billing.usage.limit` and `billing.plan.trackLimitPerMonth`
  both report exactly **300** on our account, matching "300 Aquiline
  shipments" on the plan page. Can you confirm this is right?

What we could NOT figure out is **"tracking."** It's clearly a separate,
larger allowance (300 shipments vs. 3,000 trackings on Starter — a 10x
ratio, though it's only 5x on every tier above Starter, which we also don't
understand). Is a "tracking" one status-check event as an already-converted
shipment moves through the underlying carrier (something that accumulates
automatically over a shipment's lifetime), or is it something we trigger
ourselves (e.g. a `GET .../orders/{orderId}` call, or each `tracking-html`
upload)? We ask partly because your webhook event catalog (`tracking.html.*`
and `tracking.problem.*` — see question 1) has no delivery-status event, so
today we detect delivery by continuing to poll on our own Amazon side rather
than relying on your infrastructure for it — we want to understand whether
that choice has any effect on our trackings usage.

- Is the trackings allowance (used/limit/remaining) readable anywhere via the
  API, the way shipments are on `GET /v1/me`?
- Is our current profile count (used vs. our 10-profile allowance) readable
  anywhere via the API? We currently call `GET /v1/profiles` and count the
  array ourselves, which works, but it's an extra call we'd rather not need
  if there's a cheaper way.

Separately, and unrelated to monthly-vs-annual billing (we're on monthly by
our own choice): `GET /v1/me` returned `windowKey: "2026-08-23"`, matching
`currentPeriodStart`, with `currentPeriodEnd: "2026-09-23"`. Does the
used/limit/remaining counter reset for every customer on the calendar 1st of
the month, or on each customer's own subscription anniversary date (the 23rd,
in our case)? We ask because our own systems track usage on a UTC calendar
month, and if your reset day is different, we need to build a safety margin
around the mismatch rather than assume the two windows line up.

---

That's everything blocking us right now. Happy to jump on a call if that's
easier for your engineering team to walk through instead of email. Thank you
for the continued help getting this integration right.

Best regards
