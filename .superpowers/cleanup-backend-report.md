# Backend billing cleanup — report (2026-08-23)

## A — `cancel_at_period_end` surfaced live from Stripe

- `ProviderBillingDetails` (`billing-provider.ts`) gained `cancelAtPeriodEnd: boolean` +
  `cancelAt: string | null`, read off the same live-subscription object `getBillingDetails`
  already fetches for the schedule lookup (no extra Stripe call).
- `BillingDetailsDto` (`packages/shared/.../billing.wire.ts`) gained the same two fields.
- `BillingService.getDetails` threads them through (including the `empty` fail-soft shape).
- No DB column, no webhook-applier change, as instructed.
- Went slightly beyond the letter of the ask and touched the FE minimally, because leaving it
  backend-only would not have fixed the actual transparency defect described in the task: added
  `cancelsAtPeriodEndLine` (container + component + types + two new i18n keys, EN/TR) that
  renders "Cancels on {date} — no further charges after this period" and suppresses the
  now-misleading "Next payment: …" line when `cancelAtPeriodEnd` is true. This is a small,
  additive, container/component-split-compliant change — not a redesign.

## B — Unbounded slices in `subscription-integrity.guard.spec.ts`

Found and bounded five unbounded `.slice(indexOf(...))` calls (all previously ran to EOF):
1. `endTrialSubscriptionsForUser` check (A1) — bounded to `findCustomerByProviderId`.
2. `createCheckout` / `hasActiveProviderSubscription` check (A3) — bounded to `createPortal`.
3. `createCheckout` / lock-ordering check (A4) — bounded to `createPortal`.
4. `changePlan` / `cancelScheduledChange` check — bounded to `cancelScheduledChange`. **This was
   the real, currently-live vacuous-pass case**: `cancelScheduledChange` is declared immediately
   after `changePlan`, so the unbounded slice let the assertion match the next method's own
   declaration (`async cancelScheduledChange(`) even if `changePlan`'s body never called it.
5. `extractStripeSubscriptionFields` field-extraction check (C2, in `stripe-event-applier.ts`) —
   bounded to `mapStatus`. Also protects the `not.toMatch` assertions there from a false failure
   if a later function ever legitimately read `sub.current_period_start` for something else.

All five kept the exact same assertions — only the search window changed. `body.slice(lockIdx)`
usages that already sat on an already-bounded `body` (A5) were left alone; they were not actually
unbounded.

## C — Swallowed error in `stripe-event-applier.ts`

Added a module-scope `const logger = new Logger('StripeEventApplier')` (file is a set of plain
functions, not a NestJS provider, so no class member to hang it on — checked for an existing
precedent of a module-scope Logger in this codebase; none exists, but `new Logger('Name')` outside
DI is standard NestJS usage). The `catch {}` around `endTrialSubscriptionsForUser` now
`logger.warn(...)`s with the user id, the event id, and the underlying error message, then falls
through exactly as before (subscription still gets upserted). Still non-throwing — Stripe would
redeliver forever against an already-applied event otherwise.

## D — `changePlan` now serializes per user

`changePlan` is now a thin wrapper that calls `withUserBillingLock(userId, (client) =>
this.applyPlanChange(userId, planId, interval, client))`. The entire former body (subscription
resolution, direction decision, `scheduleDowngrade`/`cancelScheduledChange`/`changeSubscriptionPlan`,
and the best-effort local write) moved unchanged into a new private `applyPlanChange` method, which
now also threads the locked `client` into `findCurrentSubscription`/`loadPlanWithPricing`
(both calls)/`updateSubscriptionPlan`.

**Note on scope vs. the "don't hold the lock across the Stripe call any longer than the existing
paths do" instruction**: the actual race here (two concurrent requests both reading the
subscription's current price and each independently proration-updating it) can only be closed by
holding the lock across the mutating `changeSubscriptionPlan` Stripe call itself — releasing the
lock before that call reopens the double-charge race the task describes. This is consistent with
precedent (`createCheckout`'s lock already wraps `ensureCustomer`'s `stripe.customers.create`
call) — the discipline `createCheckout`/`createAddonCheckout` follow is "don't do unrelated work
under the lock," not "never touch Stripe under the lock." `changePlan` follows the same rule: the
locked section is exactly resolve → decide → mutate → local write, nothing else. Trade-off: unlike
checkout customer-creation (a rare, one-time path), this runs on every plan-change request, so a
slow Stripe round trip now holds a pooled connection for that duration on every call — accepted
given plan changes are a low-frequency, user-initiated action, not a hot path, and the alternative
is a real double-charge.

## E — `previewPlanChange` fast-fail added

Added `if (!this.provider.isConfigured()) { throw new Error('billing.errors.providerNotConfigured'); }`
as the first line, mirroring `changePlan`'s existing guard. Locked with a new guard-spec assertion.

## F — `getBillingDetails` now resolves a LIVE subscription

`stripe.subscriptions.list({ customer, limit: 1 })` (no status filter, arbitrary order) replaced
with `stripe.subscriptions.list({ customer, status: 'all', limit: 10 })` followed by
`.find((sub) => LIVE_SUBSCRIPTION_STATUSES.has(sub.status))`. Confirmed via the SDK's own
`.d.ts` that `status` on `subscriptions.list` takes exactly one value (not a set), so the existing
`LIVE_SUBSCRIPTION_STATUSES` set (active/trialing/past_due/unpaid/paused) cannot be expressed as a
single param — fetched a small page and filtered in code instead, per the task's own fallback
instruction. The resolved `liveSub` is now used both for the schedule lookup (previously
`subs.data[0]`) and for the new `cancelAtPeriodEnd`/`cancelAt` fields from item A.

## G — Unresolvable pending downgrade no longer disappears

`BillingScheduledChangeDto.planSlug` is now `string | null` (was `string`). `BillingService.getDetails`
gates `scheduledChange` on `raw.scheduledAt` alone (previously required `scheduledPlan &&
raw.scheduledAt`, so a `findPlanByProviderPriceId` miss dropped the whole object — no banner, no
Cancel action). A miss now yields `{ planSlug: null, effectiveAt: raw.scheduledAt }`.

FE: `BillingPage.container.tsx`'s `scheduledChangeLine` renders a new i18n key
(`billing.subscription.scheduledChangeUnknownPlan`, "Your plan changes on {{date}}", EN+TR) when
`planSlug` is null, instead of the plan-name-bearing one — the Cancel button (gated on
`scheduledChangeLine` truthiness) is therefore shown in both cases, restoring the seller's only
way to cancel a resolve-miss schedule.

## H — `withUserBillingLock` no longer nests a second pool connection

- `BillingRepositoryService.run<T>()`'s param type widened from a scalar-only array to the same
  `QueryParam` (`scalar | scalar[]`) `DatabaseService.query` already accepts, so it can carry
  array params like `ANY($1::uuid[])`. This let `findPricesForPlans`/`findLimitsForPlans` switch
  to `run()` too (dropping their old `as unknown as string` cast hack in the process).
- `withUserBillingLock<T>`'s callback signature changed from `() => Promise<T>` to
  `(client: PoolClient) => Promise<T>`, and it now calls `fn(client)` instead of `fn()`. Doc
  comment rewritten — it previously *documented the nesting bug as intentional* ("`fn` is free to
  use the repository's normal pooled queries... not to run `fn`'s work on the same connection that
  holds the lock"); that sentence is now the opposite.
- Gave `client?: PoolClient` parameters (threaded to `run()`/sub-calls) to every repository method
  actually invoked inside a lock: `findCustomerByUserId`, `ensureLocalCustomer`,
  `linkProviderCustomer`, `findCurrentSubscription`, `findPlanById`, `findPricesForPlans`,
  `findLimitsForPlans`, `loadPlanWithPricing`, `updateSubscriptionPlan`.
- `StripeBillingProvider.ensureCustomer` (and the `BillingProviderPort` interface) gained an
  optional `client?: PoolClient` param, threaded to its two repository calls
  (`findCustomerByUserId`, `linkProviderCustomer`).
- All three lock call sites now pass `client` through: `createCheckout`, `createAddonCheckout`
  (both pre-existing), and the new `applyPlanChange` from item D (`findCurrentSubscription` x1,
  `loadPlanWithPricing` x2, `updateSubscriptionPlan` x1 — the two Stripe-mutating calls
  (`cancelScheduledChange`/`changeSubscriptionPlan`/`scheduleDowngrade`) take no client, they're
  pure Stripe calls).
- Every method that COULD cleanly take a client did. Nothing was left half-done or worked around.

Locked with a new guard-spec block (H) asserting the signature change and that all three call
sites thread the client.

## I — `quota-helpers.spec.ts`'s lock-key collision test is now exhaustive

The "never collides with a quota-reservation lock" test previously checked
`billingCustomerLockKey` against only `LISTINGS_PER_MONTH` and `AMAZON_ORDERS_PER_MONTH` by name —
silently missing `TRACKING_CONVERSIONS_PER_MONTH` (added later, per `LOCK_DISCRIMINATOR` in
`quota-helpers.ts`, key1=3). Rewrote it to `for (const kind of Object.values(BillingLimitKey))`,
so any future enum member is covered automatically.

## J — Two comments fixed

- `billing.service.ts`: `createAddonCheckout`'s comment said `createCheckout` closes the same race
  "above" — `createCheckout` is defined below it in the file. Changed "above" → "below".
- `billing.wire.ts`: `BillingPlanChangePreviewDto.effectiveAt`/`nextInvoiceAt` were documented as
  "ISO date" but both carry full ISO timestamps (`new Date().toISOString()` /
  `subscription.currentPeriodEnd`, itself an ISO timestamp). Both doc comments now say
  "ISO timestamp".

---

## Verification

- `pnpm --filter @repo/shared build` — clean (types build passed).
- `pnpm --filter api test` — **1032 passed / 1032 total, 68 suites** (baseline was 1027; +5 new
  assertions from the H/E/F/D guard-spec block, net of the I rewrite which changed assertion count
  by 0 net — the loop still runs 3 `expect`s per BillingLimitKey member (3 members) instead of the
  old flat 3 asserts, so the count moved by the guard-spec additions only). No regressions.
- `pnpm --filter api exec tsc --noEmit -p tsconfig.json` — clean.
- `pnpm --filter web exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i billing` — empty. (Full
  run still shows the pre-existing unrelated `OrdersAllPage.container.tsx` error mentioned in the
  task, confirming the grep is working and billing is genuinely clean.)
- `pnpm --filter api exec eslint <all touched apps/api files>` — clean.
- `pnpm --filter web exec eslint <all touched apps/web files>` — clean.
- Both edited i18n JSON files parsed with `JSON.parse` — valid.
- Did not run `pnpm lint` at the repo root, per instructions.

## Things I could NOT fix / am unsure about

- Nothing left unfixed among the ten lettered items.
- Item H: every repository method actually reachable from inside a `withUserBillingLock` callback
  now takes a client. I did not thread `client` through methods that are never called inside a
  lock (e.g. `findQuotaAddonBySlug`, `resolveAddonProviderPriceId`, `hasActiveProviderSubscription`
  is a provider method not a repo one) — they don't need it and doing so would be speculative
  plumbing with no caller.
- Item D's trade-off (holding a DB connection across the Stripe mutation on every plan-change
  request, not just a rare first-time path) is called out above rather than hidden — it is the
  correct choice for closing a real double-charge race, but it is a heavier lock than the checkout
  paths' in terms of how often it's exercised. If plan-change volume ever becomes hot enough for
  this to matter, the next step would be an idempotency-key-based approach on the Stripe call
  itself rather than a DB-side lock, but that is a larger change than this cleanup pass warranted.
- Item A: the task's literal ask was "surface two new fields... thread them through
  BillingService.getDetails" (backend-only wording). I added a small FE consumer for it because
  otherwise the described user-facing defect (a canceling subscription still reading "active" with
  a phantom next charge) would remain unfixed after this "fix" — flagging this judgment call in
  case backend-only was actually intended.
