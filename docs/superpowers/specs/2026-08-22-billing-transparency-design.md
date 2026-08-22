# Billing transparency and subscription integrity — design

**Date:** 2026-08-22
**Status:** approved, pending implementation plan

## Context

The billing page (`/:locale/billing`) answers "what plan am I on and how much is
left". It does not answer any of the questions a seller actually asks when money
moves:

- What did I pay, when, and for what? (no invoice history anywhere in the app)
- Which card is being charged, and is it about to expire? (never shown)
- How much will be taken at the next renewal? (only the date is shown)
- What will this plan change cost me? (nothing is shown before it is applied)

Today the only way to answer any of them is to leave the app for the Stripe
Billing Portal, reached through a secondary button buried inside the plans
drawer. For a product where the billing screen is the one that decides whether a
seller trusts us with a card on file, that is not good enough.

The first real end-to-end sandbox subscribe, run on 2026-08-22, also exposed
three defects that together let ONE customer accumulate THREE concurrent Stripe
subscriptions, all billing. That is not a transparency problem — it is a
correctness problem in money code, and it is the first half of this work.

## What broke, and why

### D1 — no subscription could ever be persisted (already fixed)

`billing_subscriptions.provider_subscription_id` carried a plain (non-unique)
partial index from migration `052`, while `upsertSubscriptionByProvider` has
always issued `ON CONFLICT (provider_subscription_id) WHERE ... IS NOT NULL`.
Postgres requires a real unique index as an ON CONFLICT target, so every
`customer.subscription.created` webhook failed with *"there is no unique or
exclusion constraint matching the ON CONFLICT specification"* and returned 500.
The customer paid; nothing was written on our side.

Fixed by migration `088`. Listed here because it is what set the cascade off:
with no local row, `hasProviderSubscription` stayed false, so the next plan click
opened a fresh Checkout and minted a second Stripe subscription. Then a third.

### D2 — the local trial row is never closed, and outranks a real subscription

Nothing ends the local trial row when a real subscription starts.
`upsertSubscriptionByProvider` conflicts on `provider_subscription_id`; the trial
row's is NULL, so a real subscription INSERTs a second row and leaves the trial
untouched.

`findCurrentSubscription` then sorts `trialing` **first**, ahead of `active`. So
a seller who subscribes during their trial ends up with the query returning the
TRIAL row — whose `providerSubscriptionId` is NULL — which makes
`hasProviderSubscription` false and sends every subsequent plan click to
Checkout. **Each click mints another live subscription.**

This would hit every trial user who converts, which is the normal happy path. It
reproduces D1's outcome independently of D1.

### D3 — nothing authoritative guards against a second subscription

`createCheckout` never asks Stripe whether the customer already has a
subscription. Our own database is the only guard, and Stripe does not refuse a
second subscription for a customer who already has one. When our DB is wrong —
as D1 and D2 each make it — the customer is billed two or three times over.

Single-layer protection is not acceptable on the path that creates recurring
charges.

## Decisions

Four decisions were taken during design. Each closes off alternatives
deliberately.

**1. Invoices, cards and next-charge amounts are read LIVE from Stripe. No local
mirror.** Stripe stays the single source of truth, so the numbers a seller reads
cannot drift from the numbers Stripe charged. A webhook-fed local copy was
considered and rejected: two records of the same money is the failure mode that
matters most here (Stripe refunds, our table still shows the old figure), and it
would buy only offline availability of history nobody reads during an outage.

**2. Display in our app, manage in the Stripe portal.** The saved card is shown
in-app (brand, last four, expiry) so the seller never has to leave to *look*.
"Change card" and "Cancel subscription" open the Stripe Billing Portal. Building
card entry in-app with Stripe Elements was considered and rejected: it adds a
second payment surface to keep correct for no transparency gain, and the portal
already does it securely in one click. Card data continues never to touch our
servers.

**3. Upgrades are immediate and prepaid; downgrades take effect at period end.**
Stripe subscriptions bill in advance — the seller pays on day 1 for the coming
period. Today's `create_prorations` gives an upgrading seller the higher quota
immediately and bills the difference up to 30 days later. At the extreme, a Lite
seller ($19.99) can upgrade to Enterprise on day 1, consume 25,000 listings and
800 conversions (~$80 of Aquiline cost alone), and let the card fail before the
invoice arrives. Upgrades therefore charge the prorated difference NOW, and the
subscription is left unchanged if that charge fails.

Downgrades are the mirror case and need the opposite treatment: the seller has
already paid for the current period, so they keep the plan they paid for until it
ends. This also avoids leaving a seller with 24,000 active listings under a
200-listing ceiling, and removes the need for a credit balance entirely.

**4. `GET /billing/summary` is NOT extended.** `AppLayout` calls it on every page
load (it drives the suspended-account redirect). Adding Stripe API calls to it
would put provider latency on the critical path of the whole app. The new
live-from-Stripe data gets its own endpoints, called only by the billing page.

## A. Subscription integrity

Three layers, because one layer has already been proven insufficient.

**A1. Close the trial row when a real subscription starts.** On
`customer.subscription.created`, mark that user's local trial row `ended`. The
trial is over the moment they pay. One live subscription row per user becomes an
invariant rather than an accident.

**A2. A provider-backed subscription outranks a local trial row.**
`findCurrentSubscription`'s ordering puts any row carrying a
`provider_subscription_id` above a local-only trial row, regardless of status. A1
should make this unreachable; it exists because "should be unreachable" is what
D1 and D2 both were.

**A3. `createCheckout` asks Stripe before opening a session.**
`subscriptions.list({ customer })` — if any subscription is `active`,
`trialing`, `past_due` or `unpaid`, the checkout is refused with a 409 carrying
`billing.errors.alreadySubscribed`, and the FE routes the seller to the
plan-change path instead. **This is the layer that cannot be fooled by our own
database being wrong**, which is exactly what was missing.

A source-grep guard spec locks all three, in the style of
`entitlement-enforcement.guard.spec.ts` — every one of these defects was of the
"documented but not implemented" class, and that guard exists because that class
recurs.

## B. The billing page

Top to bottom:

**B1. Subscription card** (existing, one line added)
- Plan name, status badge, meta line — unchanged
- **New:** next charge as date AND amount ("Next payment: 23 Aug 2026 · $29.99").
  The figure comes from Stripe's own upcoming invoice, so it carries tax,
  proration and discounts — it is what will actually be taken, not the catalog
  price.
- **New:** when a downgrade is scheduled, a persistent line: "Switches to Lite on
  22 Sep 2026" with a **Cancel** action.
- Quota rings — unchanged
- Notice + action — unchanged (the `past_due` → portal fix shipped 2026-08-22)

**B2. Payment method card** (new, compact)
- `Visa •••• 4242 · expires 08/2027`
- **Shows the DEFAULT payment method** (`invoice_settings.default_payment_method`)
  — the card Stripe actually charges. Showing the first of several attached cards
  would put a wrong number on the screen whose entire purpose is being right.
- Amber warning line when the card expires within 60 days, without waiting for
  Stripe's own email.
- "Change" opens the Stripe portal.
- Not rendered at all when there is no Stripe customer (trial sellers).

**B3. Invoice history card** (new, full width)
- Columns: date · description · amount · status · PDF
- Description comes from the invoice's own line item ("Growth plan", "100
  conversions pack")
- Amount shows **the currency actually charged**. Adaptive Pricing is enabled, so
  a Turkish seller is billed in TRY with a USD equivalent; assuming USD would
  misreport what left their account.
- PDF links to Stripe's own generated invoice (`invoice_pdf`) — a real tax
  document we did not author
- A failed invoice carries a **"Pay now"** link (`hosted_invoice_url`), so a
  suspended seller can clear the debt in one click
- Cursor pagination ("Show more"), using Stripe's own cursor
- Empty state for sellers with no invoices yet

**B4. Top-up packs** — unchanged (appear when a quota is exhausted)

## C. Backend surface

| Endpoint | Returns | Called by |
|---|---|---|
| `GET /billing/summary` | **unchanged** — DB only, fast | AppLayout + billing page |
| `GET /billing/details` | default payment method, next charge amount, scheduled change | billing page only |
| `GET /billing/invoices` | paginated invoice list (Stripe cursor) | billing page only |
| `POST /billing/plan-change/preview` | prorated amount, direction, effective date | billing page only |
| `POST /billing/change-plan` | revised — see D | billing page only |
| `DELETE /billing/scheduled-change` | cancels a pending downgrade | billing page only |

`invoice_creation: { enabled: true }` is added to the **top-up** checkout session
(`mode: 'payment'`). Without it Stripe creates no invoice for a one-time
purchase, so top-ups would be missing from the history — and "what did I pay for"
has to mean everything, or it means nothing.

## D. Plan change

**Preview.** `POST /billing/plan-change/preview` calls `invoices.createPreview`
with the target price and returns the real amount, its currency, the direction,
and when it takes effect. Not an estimate we computed — Stripe's own arithmetic,
including tax and any discount.

**Confirmation dialog** (none exists today; the change is applied on the first
click):

> "Switching to Micro. **$4.16 will be charged now.** Your next invoice will be
> $29.99 on 22 Sep 2026."

**Upgrade** → applied immediately with `proration_behavior: 'always_invoice'` and
`payment_behavior: 'error_if_incomplete'`. The prorated difference is charged
there and then, and **if the card fails the subscription is left unchanged** —
the seller stays on their old plan and is told why. Pay first, then use.

**Downgrade** → a Stripe Subscription Schedule is created: the current price runs
to period end, the new price starts after. No money moves now. The billing page
shows the pending change with a Cancel action that releases the schedule.

Direction is decided from the catalog prices. Equal prices are impossible across
twelve distinct tiers but are treated as an upgrade (immediate, $0) rather than
left undefined.

**Edge cases, resolved here so they are not decided ad hoc during
implementation:**

- **Upgrading while a downgrade is scheduled.** The schedule is released first,
  then the upgrade is applied immediately. A seller who changes their mind
  upward should not have a stale downgrade fire a month later — that would
  silently undo a change they paid for.
- **Downgrading while a downgrade is already scheduled.** The existing schedule
  is replaced, not stacked. Only one pending change can exist.
- **A seller with no Stripe subscription** (trialing, or nothing) has no upcoming
  invoice, so B1 shows no next-charge amount — the existing trial-end meta line
  stands in its place. Preview and change-plan are not offered; the plan card's
  action opens checkout, guarded by A3.
- **A 409 `alreadySubscribed` from A3** means our summary disagreed with Stripe.
  The FE surfaces the localized reason and refetches the summary, which brings
  the two back into agreement; it does not silently retry.

## E. Promotion codes

`allow_promotion_codes: true` on the subscription checkout session, giving
Checkout its own "Add promotion code" field. Coupons themselves are created in
the Stripe Dashboard — no catalog table, no admin surface, no local coupon model.
This is one parameter plus operator setup, and it is what makes a launch
discount, a win-back campaign or an affiliate code possible at all.

Deliberately NOT added to the top-up checkout: a discount on a consumable that is
already priced against a hard unit cost (~$0.10/conversion) erodes a thin margin
with no acquisition benefit.

## F. Error handling

**Every live-from-Stripe section degrades independently.** If `invoices.list`
fails, the invoice card shows an error state with a retry; the plan card, the
quota rings and the top-up packs keep working. A provider hiccup must never blank
the page a suspended seller was just redirected to.

**An unknown amount is never rendered as zero or as a guess.** It renders as an
em dash or an explicit error, following the codebase's existing rule that a null
micro-USD cost is not `0`. On this screen a wrong number is worse than a missing
one.

Failures map to HTTP status through the existing `BILLING_ERROR_STATUS` table and
carry an i18n key; raw provider text stays in the log, same audience split as
`ListingFailureCode`.

## G. Testing

- **Pure helpers, Jest:** upgrade/downgrade direction, invoice DTO mapping
  (amount + currency + status), scheduled-change date resolution, expiring-card
  threshold.
- **Guard spec:** source-greps that A1, A2 and A3 are all present, so the
  duplicate-subscription protection cannot silently regress.
- **Sandbox verification** (manual, listed below).

## Out of scope

- **In-app card entry (Stripe Elements)** — decided against; the portal handles
  it.
- **A local invoice mirror** — decided against; Stripe is the source of truth.
- **A wallet / prepaid balance** (the easync model) — explicitly not wanted. The
  transparency goal is met by showing real invoices, not by inventing a second
  ledger.
- **Cancellation flow in our UI** — stays in the portal for now.
- **Coupon management UI** — coupons live in the Stripe Dashboard.

## Operator actions (Stripe Dashboard, no code)

1. Cancel the two surplus sandbox subscriptions left by D1/D2.
2. Settings → Branding: logo and colours, so Checkout stops looking unbranded.
3. Create any coupons that E should surface.
4. Confirm Tax registrations are active (Wyoming was completed 2026-08-22).

## Verification checklist (sandbox, before enforcement is enabled)

1. Subscribing during a trial produces exactly ONE live Stripe subscription, and
   the local trial row flips to `ended`.
2. A seller who already has a subscription is refused at checkout with a 409 and
   is routed to plan change instead.
3. An upgrade with a card that declines leaves the plan unchanged and surfaces
   the reason.
4. An upgrade with a good card charges the previewed amount immediately and the
   quota rises at once.
5. A downgrade schedules for period end, shows the pending line, and Cancel
   releases it.
6. The invoice list includes a top-up purchase, with the correct currency.
7. The payment-method card shows the default card, not an arbitrary one, when
   several are attached.
8. Killing Stripe connectivity degrades only the live sections; plan and quota
   still render.
