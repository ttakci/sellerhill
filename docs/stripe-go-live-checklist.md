# Stripe live-mode checklist

Everything here is a **Stripe Dashboard setting**, not code. The code side is
done and covered by the notes in CLAUDE.md ("Billing & Packages"); these are the
switches that cannot be set from this repository, and several of them change how
the application behaves.

Work through it when moving billing to live mode, and again after any Stripe
account change. Test mode has its own copy of almost all of these — set them in
both.

## 1. Dunning: what happens after all retries fail

Billing → Subscriptions and emails → Manage failed payments.

- Choose **Cancel subscription** or **Mark uncollectible (unpaid)**. Either one
  reaches this platform as a suspension through `customer.subscription.updated`
  (`canceled` / `unpaid` → `PAST_DUE` → suspended).
- **Do NOT choose "Pause collection".** A paused subscription keeps
  `status: active` and sets `pause_collection`, which nothing in this codebase
  reads — the seller's automation would keep running, unpaid, indefinitely.
- Smart Retries can stay on. Suspension here is immediate on the first failure
  (operator decision), so retries only decide how long Stripe keeps trying
  before the subscription reaches its final state.

## 2. Customer portal

Settings → Billing → Customer portal.

- **Cancellation: enabled, at END of billing period.** "Immediately" would cut a
  seller off inside a period they have already paid for — `canceled` resolves to
  suspended here as soon as it arrives.
- **Plan switching: OFF.** The app has its own upgrade/downgrade flow with a
  proration preview and the over-limit warning; two paths that behave
  differently is how a seller ends up surprised.
- Payment-method update: ON (this is the recovery path the payment-failed e-mail
  links to, and the fix for a card that needs 3-D Secure).
- Invoice history: ON.

## 3. Tax

Settings → Tax.

- Set the **head office address** and add at least one **registration**. Until
  both exist, Stripe Tax silently calculates **zero** tax on every checkout — no
  error, no warning.
- Products are created with the SaaS tax code (`txcd_10103001`) by
  `stripe:sync-catalog`; nothing to do per product.
- Stripe is **not** the merchant of record: registration, remittance and filing
  stay with the operator and their accountant.

## 4. E-mails Stripe sends

Settings → Emails.

- **Successful payments / receipts: ON.** The platform deliberately sends no
  receipt of its own.
- **Failed payments: ON.** The platform's own payment-failed e-mail (migration
  107) explains what stopped working; Stripe's covers the payment itself.
- Upcoming-invoice reminders are optional; the subscription renews on a card
  already on file, so they mostly add noise.

## 5. Webhooks

Developers → Webhooks → the endpoint pointing at
`https://<api-host>/api/v1/billing/webhooks/stripe`.

- Events to send, at minimum: `customer.subscription.created|updated|deleted`,
  `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
  `charge.dispute.created`.
- Copy the **signing secret** into `STRIPE_WEBHOOK_SECRET`. A wrong secret makes
  every delivery a 401.
- After deploying, send a test event and confirm a row lands in
  `billing_webhook_inbox`.
- A missed webhook is no longer fatal: `billing-subscription-reconcile` re-reads
  at-risk subscriptions from Stripe every hour. It is a safety net, not a
  substitute — a broken endpoint still needs fixing.

## 6. Catalog

- Run `pnpm --filter api stripe:sync-catalog` against the live key. It creates
  the Products/Prices that are missing **and verifies the ones already mirrored**
  — it now exits non-zero if a local price and its Stripe Price disagree.
- A Stripe Price is immutable. Changing a price means closing the local
  `billing_plan_prices` row (`effective_to`) and inserting a new one with no
  `provider_price_id`, then re-running the sync.

## 7. Changing a price later

Not a launch step, but it involves Stripe and is easy to get wrong:

1. Close the plan's current `billing_plan_prices` row (`effective_to`) and insert
   the new one without a `provider_price_id` (a new migration).
2. `pnpm --filter api stripe:sync-catalog` — mints the new Stripe Price. From here
   on, NEW subscribers pay the new price.
3. Existing subscribers stay on the old price until you decide otherwise:
   - to keep them there, do nothing;
   - to move them from their next renewal (with an e-mail notice), run
     `pnpm --filter api billing:migrate-price -- --plan <slug>` first as a dry
     run, read the list, then again with `--apply`.

## 8. Before announcing it works

- Subscribe once with a real card, on the live keys, and confirm: the
  subscription row, the quota window dates, the invoice in the billing page, and
  the `/billing` redirect after checkout.
- Use a **Test Clock** in test mode to walk one subscription through renewal, a
  failed payment and a cancellation. Nothing in this repository has ever
  exercised that sequence end to end.
- Confirm the trial-ending and payment-failed e-mails arrive (SMTP settings live
  in the admin panel, not in Stripe).
