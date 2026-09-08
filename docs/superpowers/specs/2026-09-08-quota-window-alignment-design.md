# Subscription enforcement: correct windows, complete suspension, a proven resume

**Date:** 2026-09-08
**Status:** design, pending implementation
**Scope:** `apps/api/src/modules/billing`, `orders`, `amazon`, `listings`

Four connected defects. The first was found while sizing a 30-day free trial;
the rest were found by asking what actually happens when a seller stops paying,
and what happens when they start again.

---

## Problem

### D1 — the quota window ignores the billing period

Stripe bills on the **subscription anniversary**. Our meters reset on the **1st
of the UTC calendar month**. Both halves are verified:

- `billing-provider.ts` never sets `billing_cycle_anchor`, so Stripe uses
  anniversary billing, and the webhook writes its `current_period_start` /
  `current_period_end` onto `billing_subscriptions`.
- `quota-helpers.ts:240` `utcMonthBounds()` returns the 1st-to-1st calendar
  month and is the only window any meter consults.

`utcMonthBounds` has exactly four call sites, all in
`billing-repository.service.ts`: `ensureOpenUsagePeriod` (:336),
`countMonthlyConversions` (:411), `sumQuotaCredits` (:471),
`grantQuotaCredit` (:499).

A seller subscribing on 15 September gets a full conversion quota for 15–30
September and a second from 1 October, while Stripe does not charge again until
15 October. On Micro ($29.99 — 1,000 listings / 100 conversions):

```
Keepa    1,000 listings x $0.0125  = $12.50
Aquiline 200 conversions x $0.14   = $28.00
                                     ------
                                     $40.50   vs $29.99 revenue
```

CLAUDE.md states every tier is profitable "for a single user who fills their
quota (worst-case margin 18%)". That assumes one quota per billing period, which
the code does not implement. It errs against the seller too: a top-up bought on
28 September is scoped to `period_start = 1 September` and evaporates on 1
October, while their paid period runs to 15 October.

**Why it blocks the 30-day trial.** A 7-day trial rarely straddled a month
boundary; a 30-day trial always does, so a trial user would get ~40 conversions
instead of 20. `startTrialOnce` already writes
`current_period_start = startedAt` / `current_period_end = trialEndsAt`
(`billing-repository.service.ts:860`), so fixing D1 fixes the trial with no
trial-specific code.

### D2 — suspension is incomplete

Suspension today stops the quota gate (`quota-enforcement.service.ts:116`),
auto-fulfill (:431), Aquiline conversion
(`tracking-conversion.service.ts:253`), and the Keepa refresh claim
(`refresh-processor.service.ts:119-140`). It does **not** stop **eBay order
sync** or **Amazon tracking polling**, both of which keep consuming resources —
tracking polling in particular burns ~330-450s of the shared Playwright pool per
order.

### D3 — there is no recovery when a webhook never arrives

`billing_subscriptions` is written by exactly two places:
`stripe-event-applier.ts:240` (webhook) and `billing.service.ts:417` (plan
change). If Stripe's event is lost, the only remedy is "Resend event" in the
Stripe Dashboard. Once §2 makes *webhook silence* a suspension trigger, the
absence of a manual recovery path becomes a trap: the escape from the failure
depends on the thing that failed.

### D4 — auto-fulfill does not resume

`maybeEnqueueAutoFulfill` fires only on a genuine insert
(`order-sync.service.ts:214`, `if (inserted && ...)`). An order blocked with
`SUBSCRIPTION_SUSPENDED` is re-enqueued by nothing, and CLAUDE.md's retry policy
deliberately treats a blocked reason as permanent rather than transport. So a
seller who pays would find those orders blocked forever.

---

## Operator decisions (2026-09-08)

1. **Never reset a quota without confirmed payment.** Absence of a webhook is
   not evidence of payment. This mirrors the existing rule in CLAUDE.md that
   "Amazon authentication must be positively PROVEN, never inferred".
2. **A stale window means unpaid**, after a 6-hour grace for delivery latency.
3. **Suspension must be complete** — order sync and tracking polling stop too.
4. **Everything must resume from where it stopped** once payment is confirmed,
   by webhook or by manual reconcile.

---

## Part 1 — meter against the billing period

New pure function in `quota-helpers.ts`:

```
resolveQuotaWindow(subscription, now)
  -> { periodStart, periodEnd, outcome }
```

| # | Condition | Result |
|---|---|---|
| 1 | no subscription | `utcMonthBounds(now)` — unchanged; the gate already fails open here |
| 2 | period missing / unparseable / `end <= start` | `utcMonthBounds(now)` — a malformed row must not yield an unbounded window |
| 3 | `start <= now < end` | that window — the normal path |
| 4 | `now < start` (clock skew) | the declared window; using the row we were given beats inventing one |
| 5 | `end <= now < end + 6h` | **same `start`**, end extended — grace |
| 6 | `now >= end + 6h` | `outcome: UNPAID` |

**Rule 5 is the whole answer to "don't give a free month".** The window's
**start never moves**. Usage is counted from `periodStart`, so with the start
pinned no new allowance can be created — the seller can only spend the remainder
of the period they already paid for. There is no roll-forward: an earlier
revision of this design advanced `periodStart` by whole months, which really did
reset the quota, and that was the defect the operator caught.

Because nothing rolls forward, the month-length clamping (31 Jan → 28 Feb → 31
Mar), the iteration cap and the "one step or two" threshold all disappear from
the design.

**Grace is latency tolerance, not generosity.** Stripe's renewal event normally
lands within seconds, but the instant `current_period_end` passes, the window is
stale. Without a grace, every paying seller would be suspended at their renewal
moment — long enough for `PASSTHROUGH_FAILED` to hold shipped orders. 6 hours
covers a deploy window or a brief outage. Panel-tunable
(`billing.webhookGraceHours`), default 6.

**Rule 6 is enforced as a read-time guard, not a write.** It follows
`normalizeExpiredTrial`'s existing shape: `resolveEntitlementState` reports
`SUSPENDED` for an `active` subscription whose window is stale past the grace.
Nothing persists a suspension we only inferred, so the moment a real event lands
the account returns to normal by itself. Logged at `error` — six hours past a
renewal with no event is an operational fault, not routine.

Rule 6 cannot resurrect an expired trial: an elapsed trial is already `ENDED`
via `normalizeExpiredTrial` plus the daily expiry job, and
`resolveSubscriptionContext` answers `SUSPENDED` with `limitValue: 0` at line
116, before any window is computed.

### Repository changes

Each method takes an explicit window instead of `now`:

- `ensureOpenUsagePeriod(subscriptionId, kind, limitValue, window)`
- `countConversionsInWindow(userId, window, client?)` — renamed from
  `countMonthlyConversions`; the name said "monthly", which was the bug
- `sumQuotaCredits(userId, limitKey, window)`
- `resolveEffectiveLimit(userId, subscriptionId, limitKey, window)`
- `grantQuotaCredit({ ..., window })`

The window is **already in scope at every caller but one** —
`resolveSubscriptionContext` (:102) and `getQuotaUsage(userId, subscription)`
(:213) both hold the subscription and never read its period. Only
`stripe-event-applier.ts:299` has just a `userId`; it loads the subscription
first, adding the single extra query in this change.

Two details inside the methods:

- **`countConversionsInWindow` gains an upper bound.** Today it is
  `tracking_converted_at >= periodStart` with no ceiling, safe only because a
  calendar window always contained "now". Add `AND tracking_converted_at < periodEnd`.
- **`ensureOpenUsagePeriod`'s closing sweep changes predicate.** It closes rows
  with `period_end <= $newPeriodStart`, which cannot close an overlapping
  calendar-era row (`[Sep 1, Oct 1)` against `[Sep 15, Oct 15)`), leaving two
  open. The invariant wanted is *one open period per `(subscription_id,
  limit_key)`*, so it becomes "close every open row for this pair whose
  `period_start` differs from the current window's". Concurrent callers derive
  the identical window from the same row, so they cannot close each other's.

---

## Part 2 — complete the suspension

### eBay order sync

`OrderSyncService` returns early when the user is suspended.

**The check must sit before the fetch loop AND before the watermark write.**
`last_ebay_sync_at` is advanced unconditionally at the end of a run
(`order-sync.service.ts:263`) and the next run's start date is read from it
(:110). A check placed anywhere that still lets the watermark advance would
**permanently lose every order that arrived during the suspension** — nothing
ever looks back at that date range again. This is the single point on which the
operator's "resume from where it stopped" requirement depends.

### Amazon tracking polling

`AmazonTrackingProcessorService` skips the scrape when suspended — but the
**per-order scheduler is left in place**, not removed.

That distinction is what makes resume automatic. The expensive part is the
Playwright scrape; the scheduler costs one suspension lookup per tick (24h for a
shipped order). Tearing it down would require `reconcileSchedulers()`
(`amazon-tracking-queue.service.ts:45`), which runs **only at API startup** — an
unacceptable recovery path. Kept alive, the very next tick after payment resumes
the order exactly where it was.

### Deliberately unchanged

Buyer messaging and sale-driven stock sync are cheap and follow the work that
has already been admitted; they are not new cost sources for a non-payer.

---

## Part 3 — `billing:reconcile`

`pnpm --filter api billing:reconcile -- --email <email>`

Fetches the customer's live subscription from Stripe
(`stripe.subscriptions.retrieve`, already used in four places in
`billing-provider.ts`) and re-applies it locally **through the existing
`stripe-event-applier` logic**, so no second subscription writer is introduced —
two writers of the same row is the drift this module has repeatedly suffered.

Updates `status`, `current_period_start/end` and `plan_id`, then invokes the
resume routine from Part 4. Same convention as `stripe-sync-catalog.ts`: direct
`pg` Pool, no NestJS bootstrap.

This is not optional. Part 1's rule 6 makes webhook silence a suspension
trigger; without a recovery path that does not depend on webhooks, that rule
would be self-locking.

---

## Part 4 — resume must be proven, not assumed

`resumeAfterEntitlementRestored(userId)`, called from **both** the webhook
applier (on a `SUSPENDED → ACTIVE` status transition) and `billing:reconcile`.

Six of the seven capabilities already resume on their own. The routine exists
for the one that does not.

| Capability | While suspended | How it resumes | Work needed |
|---|---|---|---|
| New listings | `limitValue: 0` | user-initiated; the next call passes | none |
| Price/stock tracking | excluded by the claim's entitlement JOIN | `next_refresh_at` stays in the past, so the products are the most overdue and are claimed first | none |
| Order sync | early return | next cron tick back-fills, **because the watermark did not move** | Part 2 |
| Tracking polling | scrape skipped, scheduler alive | next tick | Part 2 |
| Tracking conversion | `PASSTHROUGH_FAILED` → order held | held orders are retried on the shipped cadence; "nothing gives up" | none |
| eBay tracking push | same path | the same tick pushes | none |
| **Auto-fulfill** | `blocked` + `subscription_suspended` | **nothing** — D4 | **the routine** |

The routine re-enqueues orders where `auto_fulfill_status = 'blocked'` and
`auto_fulfill_blocked_reason = 'subscription_suspended'`, re-running
`maybeEnqueueAutoFulfill`'s resolution so the store toggle, per-account cap and
round-robin are all re-evaluated at resume time rather than replayed from a
stale decision. Idempotent, best-effort, and scoped to that one blocked reason —
it must never revive an order blocked for `captcha`, `cap` or `out_of_stock`.

A long suspension leaves that seller's products all overdue at once. The Keepa
claim is batch-size limited (`resolveRefreshBatchSize`), so it drains over
several ticks rather than bursting.

---

## Not changing

- `BillingLimitKey.*_PER_MONTH` values — stored strings in
  `billing_plan_limits.limit_key`; renaming is a data migration for cosmetics.
- Database schema — no column, table or constraint changes in Parts 1–4.
- `utcMonthBounds` — still the documented fallback for rules 1 and 2.
- Stripe's billing anchor — see rejected approach C.
- `listings_per_month` — a level, not a flow; it has no period.

---

## Testing

- `resolveQuotaWindow`: no subscription; normal window; inside grace (**same
  `periodStart`** — the test that encodes "no free month"); past grace reports
  `UNPAID`; `now` before `start`; inverted and unparseable periods.
- The unpaid guard: an `active` subscription stale past the grace resolves to
  `SUSPENDED` and yields `limitValue: 0`; one inside the grace keeps its limit.
- `countConversionsInWindow`: boundaries — `>= start` inclusive, `< end` exclusive.
- **Watermark guard spec**: assert `last_ebay_sync_at` is not advanced on the
  suspended path. This is the failure that silently loses orders, and it is
  invisible in any test that only checks "sync did nothing".
- Resume routine: re-enqueues only `subscription_suspended`; leaves `captcha`,
  `cap`, `out_of_stock` untouched; idempotent on a second call.
- **Source-grep guard**, following `entitlement-enforcement.guard.spec.ts`: none
  of the four repository methods calls `utcMonthBounds` directly any more, and
  the tracking processor does not remove a scheduler on the suspended path.
  "Documented but implemented in only some call sites" is exactly the class of
  defect that guard spec was written for, and this change has seven call sites.
- Update `quota-measures.spec.ts` for the new signatures.

Manual: register, confirm the trial window is `[startedAt, startedAt+30d)` and
that `GET /billing/summary` reports one usage period, not two.

---

## Rejected approaches

**Roll the window forward from the anniversary.** The original design advanced
`periodStart` in whole months when a window went stale, so a missed webhook
still reset the quota on the correct day. Rejected by the operator: it grants a
fresh allowance without any evidence of payment. The grace in rule 5 keeps the
latency tolerance while pinning `periodStart`.

**B — derive the window inside the repository from `subscriptionId`.** Callers
stay unchanged, but every quota check gains a query;
`countConversionsInWindow` / `sumQuotaCredits` are keyed by `userId` and would
need a join anyway; and it hides the window in the data layer where the rules
are far harder to test than as a pure function.

**C — anchor Stripe to the calendar month (`billing_cycle_anchor`).** Needs no
quota changes at all, but does not fix the trial — a trial has no Stripe
subscription to anchor, so 30 days still straddles two calendar months. It would
also force every customer's billing date to the 1st and require prorating or
gifting the first partial month, letting a schema convenience dictate the
customer's billing experience.

**Stopping in-flight Amazon tracking entirely.** Considered under Part 2. Safe
only because the scheduler is preserved: with it torn down, a paid-for Amazon
order could ship unnoticed and its tracking would never reach eBay, costing the
seller both the Amazon spend and the eBay sale. Skipping the scrape while
keeping the scheduler achieves the cost saving with none of that exposure.

---

## Follow-on — the trial change

Once Parts 1–4 land:

1. New migration: trial `tracking_conversions_per_month` 10 → 20 (listings stay
   50, AO stays 20), and refresh the trial plan `description`, which still reads
   "seven-day" from migration 069.
2. `BILLING_TRIAL_DAYS` registry default 7 → 30
   (`platform-settings.registry.ts:414`; bounds 1–90).
3. `BILLING_ENFORCEMENT_ENABLED` registry default `false` → `true`. Without it
   none of this is enforced and the trial has no cost ceiling.
4. i18n: `landing.hero.trialTitle` and the demo FAQ answer, EN + TR — four keys
   currently reading "7 gün" / "7-day".
5. CLAUDE.md: the plan table's trial row, the "Trial size is 50 listings / 10
   AO … ~$0.65 per trial" paragraph, and the trial duration, which the file does
   not state anywhere today.

Expected cost at 50 listings / 20 conversions / 30 days: **~$1.00–1.25 per trial
user**, ~$110–150 for 100 users, ceiling ~$345 if every user fills both meters.
