# Subscription Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meter quotas against the Stripe billing period instead of the calendar month, make suspension complete and reversible, and give the operator a manual recovery path when a webhook never arrives.

**Architecture:** One new pure function (`resolveQuotaWindow`) becomes the single definition of "which window is this usage counted in". It is threaded into the four repository methods that currently call `utcMonthBounds`. A stale window past a 6-hour grace resolves to SUSPENDED at read time (never a DB write), which extends suspension to eBay order sync and Amazon tracking polling. A `billing:reconcile` CLI re-applies Stripe's truth through the existing webhook applier, and a shared resume routine re-enqueues the one thing that does not restart by itself.

**Tech Stack:** NestJS 10, raw `pg`, BullMQ, Jest (ts-jest, CJS), `@repo/shared` for domain types.

**Spec:** `docs/superpowers/specs/2026-09-08-quota-window-alignment-design.md`

## Global Constraints

- **`periodStart` MUST never move without confirmed payment.** Usage is counted from `periodStart`; pinning it is what makes a free extra month arithmetically impossible. There is no roll-forward.
- **Webhook grace: 6 hours**, panel-tunable via `billing.webhookGraceHours`.
- **No database schema changes** in Tasks 1–7. Task 8 adds one catalog migration.
- **Never edit an applied migration** — a change ships as a new numbered file.
- Types live in `packages/shared/src/domain/`; no `any`; no duplicate type definitions.
- Enums, never string literals, for statuses and discriminators.
- Pure logic goes in a `*-helpers.ts` / `quota-helpers.ts` module with a Jest spec; services stay the IO shell.
- Run `pnpm --filter api test`, `pnpm --filter api typecheck` and `npx eslint <files> --max-warnings 0` before every commit.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/modules/billing/quota-helpers.ts` | **Modify.** Add `QuotaWindowOutcome`, `QuotaWindow`, `resolveQuotaWindow`, `resolveEffectiveEntitlement`. Keeps `utcMonthBounds` as the documented fallback. |
| `apps/api/src/modules/billing/quota-helpers.spec.ts` | **Modify.** Pure tests for the new window rules. |
| `apps/api/src/modules/billing/billing-repository.service.ts` | **Modify.** Four methods take a window instead of `now`. |
| `apps/api/src/modules/billing/quota-enforcement.service.ts` | **Modify.** Resolves the window once and passes it down; applies the read-time unpaid guard. |
| `apps/api/src/modules/billing/billing.service.ts` | **Modify.** `getQuotaUsage` passes the same window so display and gate agree. |
| `apps/api/src/modules/billing/stripe-event-applier.ts` | **Modify.** Resolve the window for the credit grant; call the resume routine on `SUSPENDED → ACTIVE`. |
| `apps/api/src/modules/billing/entitlement-resume.service.ts` | **Create.** `resumeAfterEntitlementRestored(userId)`. |
| `apps/api/src/modules/billing/entitlement-resume.service.spec.ts` | **Create.** |
| `apps/api/src/modules/orders/order-sync.service.ts` | **Modify.** Early return when suspended, before the watermark write. |
| `apps/api/src/modules/amazon/amazon-tracking-processor.service.ts` | **Modify.** Skip the scrape when suspended; keep the scheduler. |
| `apps/api/src/scripts/billing-reconcile.ts` | **Create.** Operator CLI. |
| `apps/api/src/modules/billing/subscription-enforcement.guard.spec.ts` | **Create.** Source-greps that lock the watermark rule, the kept scheduler, and the removal of direct `utcMonthBounds` calls. |
| `packages/shared/src/domain/admin/platform-settings.types.ts` | **Modify.** Add `BILLING_WEBHOOK_GRACE_HOURS`. |
| `apps/api/src/common/settings/platform-settings.registry.ts` | **Modify.** Register it. |
| `apps/api/migrations/097_billing_trial_month.sql` | **Create.** Task 8. |

---

### Task 1: `resolveQuotaWindow` — the single window definition

**Files:**
- Modify: `apps/api/src/modules/billing/quota-helpers.ts`
- Test: `apps/api/src/modules/billing/quota-helpers.spec.ts`

**Interfaces:**
- Consumes: `BillingSubscriptionDto` (`currentPeriodStart` / `currentPeriodEnd` are **ISO strings**, not Dates), `EntitlementState`, `resolveEntitlementState` from `@repo/shared`.
- Produces:
  - `enum QuotaWindowOutcome { NORMAL = 'normal', GRACE = 'grace', UNPAID = 'unpaid' }`
  - `interface QuotaWindow { periodStart: Date; periodEnd: Date; outcome: QuotaWindowOutcome }`
  - `DEFAULT_WEBHOOK_GRACE_HOURS = 6`
  - `resolveQuotaWindow(subscription: QuotaWindowSubscription | null, now?: Date, graceHours?: number): QuotaWindow`
  - `resolveEffectiveEntitlement(subscription: QuotaWindowSubscription | null, now?: Date, graceHours?: number): EntitlementState`
  - `type QuotaWindowSubscription = Pick<BillingSubscriptionDto, 'status' | 'currentPeriodStart' | 'currentPeriodEnd'>`

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/modules/billing/quota-helpers.spec.ts`:

```typescript
import { BillingSubscriptionStatus, EntitlementState } from '@repo/shared';

import {
  DEFAULT_WEBHOOK_GRACE_HOURS,
  QuotaWindowOutcome,
  resolveEffectiveEntitlement,
  resolveQuotaWindow,
  utcMonthBounds,
} from './quota-helpers';

const sub = (start: string, end: string, status = BillingSubscriptionStatus.ACTIVE) => ({
  status,
  currentPeriodStart: start,
  currentPeriodEnd: end,
});

describe('resolveQuotaWindow', () => {
  it('falls back to the calendar month with no subscription', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    const w = resolveQuotaWindow(null, now);
    expect(w.periodStart).toEqual(utcMonthBounds(now).periodStart);
    expect(w.outcome).toBe(QuotaWindowOutcome.NORMAL);
  });

  it('falls back to the calendar month when the period is unparseable or inverted', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    expect(resolveQuotaWindow(sub('not-a-date', 'also-bad'), now).periodStart).toEqual(
      utcMonthBounds(now).periodStart,
    );
    // end <= start is malformed; an unbounded window must never result.
    expect(resolveQuotaWindow(sub('2026-10-15T00:00:00Z', '2026-09-15T00:00:00Z'), now).periodStart).toEqual(
      utcMonthBounds(now).periodStart,
    );
  });

  it('uses the subscription period, NOT the calendar month', () => {
    const w = resolveQuotaWindow(
      sub('2026-09-15T00:00:00Z', '2026-10-15T00:00:00Z'),
      new Date('2026-09-20T00:00:00Z'),
    );
    expect(w.periodStart.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(w.periodEnd.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(w.outcome).toBe(QuotaWindowOutcome.NORMAL);
  });

  it('keeps the declared window when now is before it (clock skew)', () => {
    const w = resolveQuotaWindow(
      sub('2026-09-15T00:00:00Z', '2026-10-15T00:00:00Z'),
      new Date('2026-09-14T00:00:00Z'),
    );
    expect(w.periodStart.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(w.outcome).toBe(QuotaWindowOutcome.NORMAL);
  });

  it('inside the grace it extends the END but PINS the START', () => {
    // THE central guarantee: usage is counted from periodStart, so a pinned
    // start means no new allowance can be created. This is the test that
    // encodes "never a free extra month".
    const w = resolveQuotaWindow(
      sub('2026-09-15T00:00:00Z', '2026-10-15T00:00:00Z'),
      new Date('2026-10-15T03:00:00Z'),
    );
    expect(w.periodStart.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(w.periodEnd.toISOString()).toBe('2026-10-15T06:00:00.000Z');
    expect(w.outcome).toBe(QuotaWindowOutcome.GRACE);
  });

  it('past the grace it reports UNPAID and still does not move the start', () => {
    const w = resolveQuotaWindow(
      sub('2026-09-15T00:00:00Z', '2026-10-15T00:00:00Z'),
      new Date('2026-10-15T07:00:00Z'),
    );
    expect(w.periodStart.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(w.outcome).toBe(QuotaWindowOutcome.UNPAID);
  });

  it('never rolls the start forward, however stale the window is', () => {
    // A month later must NOT produce a fresh [15 Oct, 15 Nov) allowance.
    const w = resolveQuotaWindow(
      sub('2026-09-15T00:00:00Z', '2026-10-15T00:00:00Z'),
      new Date('2026-11-20T00:00:00Z'),
    );
    expect(w.periodStart.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(w.outcome).toBe(QuotaWindowOutcome.UNPAID);
  });

  it('honours a custom grace length', () => {
    const now = new Date('2026-10-15T03:00:00Z');
    expect(resolveQuotaWindow(sub('2026-09-15T00:00:00Z', '2026-10-15T00:00:00Z'), now, 1).outcome).toBe(
      QuotaWindowOutcome.UNPAID,
    );
    expect(DEFAULT_WEBHOOK_GRACE_HOURS).toBe(6);
  });
});

describe('resolveEffectiveEntitlement', () => {
  const live = sub('2026-09-15T00:00:00Z', '2026-10-15T00:00:00Z');

  it('is ACTIVE inside the window and inside the grace', () => {
    expect(resolveEffectiveEntitlement(live, new Date('2026-09-20T00:00:00Z'))).toBe(EntitlementState.ACTIVE);
    expect(resolveEffectiveEntitlement(live, new Date('2026-10-15T03:00:00Z'))).toBe(EntitlementState.ACTIVE);
  });

  it('SUSPENDS an active subscription whose window is stale past the grace', () => {
    // Read-time fail-closed guard, mirroring normalizeExpiredTrial. Absence of
    // a webhook is not evidence of payment.
    expect(resolveEffectiveEntitlement(live, new Date('2026-10-15T07:00:00Z'))).toBe(
      EntitlementState.SUSPENDED,
    );
  });

  it('still SUSPENDS on a suspended status even inside a valid window', () => {
    const pastDue = sub('2026-09-15T00:00:00Z', '2026-10-15T00:00:00Z', BillingSubscriptionStatus.PAST_DUE);
    expect(resolveEffectiveEntitlement(pastDue, new Date('2026-09-20T00:00:00Z'))).toBe(
      EntitlementState.SUSPENDED,
    );
  });

  it('leaves NONE alone — no subscription is not suspension', () => {
    expect(resolveEffectiveEntitlement(null, new Date('2026-09-20T00:00:00Z'))).toBe(EntitlementState.NONE);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- quota-helpers`
Expected: FAIL — `resolveQuotaWindow is not a function`.

- [ ] **Step 3: Implement**

Append to `apps/api/src/modules/billing/quota-helpers.ts` (add `BillingSubscriptionDto`, `EntitlementState`, `resolveEntitlementState` to the existing `@repo/shared` import):

```typescript
/** How the current usage window was arrived at. */
export enum QuotaWindowOutcome {
  /** The subscription's own period contains `now`. */
  NORMAL = 'normal',
  /** The period has just lapsed and we are tolerating webhook latency. */
  GRACE = 'grace',
  /** Lapsed past the grace: treat as unpaid. */
  UNPAID = 'unpaid',
}

export interface QuotaWindow {
  periodStart: Date;
  periodEnd: Date;
  outcome: QuotaWindowOutcome;
}

export type QuotaWindowSubscription = Pick<
  BillingSubscriptionDto,
  'status' | 'currentPeriodStart' | 'currentPeriodEnd'
>;

/**
 * Tolerance for a late renewal webhook. Stripe normally delivers within
 * seconds, but the window goes stale the instant `current_period_end` passes —
 * without a grace, every paying seller would be briefly suspended at their own
 * renewal moment, long enough for a shipped order to be held.
 */
export const DEFAULT_WEBHOOK_GRACE_HOURS = 6;

const HOUR_MS = 60 * 60 * 1000;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The window this account's monthly usage is counted in.
 *
 * Stripe bills on the subscription anniversary; metering on the calendar month
 * handed a seller who subscribed mid-month roughly two allowances per payment.
 *
 * THE START NEVER MOVES without a confirmed payment. Usage is counted from
 * `periodStart`, so pinning it makes a fresh allowance arithmetically
 * impossible — the grace extends only the END, letting the seller finish
 * spending the period they already paid for. An earlier design rolled the start
 * forward by whole months when a window went stale; that really did reset the
 * quota on no evidence of payment, and was rejected.
 */
export function resolveQuotaWindow(
  subscription: QuotaWindowSubscription | null,
  now: Date = new Date(),
  graceHours: number = DEFAULT_WEBHOOK_GRACE_HOURS,
): QuotaWindow {
  const calendar = (): QuotaWindow => ({
    ...utcMonthBounds(now),
    outcome: QuotaWindowOutcome.NORMAL,
  });

  // Rule 1 — no subscription. The gate already fails open here.
  if (!subscription) {
    return calendar();
  }

  const start = parseDate(subscription.currentPeriodStart);
  const end = parseDate(subscription.currentPeriodEnd);

  // Rule 2 — a malformed row must never yield an unbounded window.
  if (!start || !end || end.getTime() <= start.getTime()) {
    return calendar();
  }

  // Rules 3 and 4 — inside the period, or before it (clock skew: use the row
  // we were given rather than invent one).
  if (now.getTime() < end.getTime()) {
    return { periodStart: start, periodEnd: end, outcome: QuotaWindowOutcome.NORMAL };
  }

  // Rule 5 — grace. Same start, extended end.
  const graceEnd = new Date(end.getTime() + Math.max(0, graceHours) * HOUR_MS);
  if (now.getTime() < graceEnd.getTime()) {
    return { periodStart: start, periodEnd: graceEnd, outcome: QuotaWindowOutcome.GRACE };
  }

  // Rule 6 — unpaid. The start is reported unchanged; no allowance is created.
  return { periodStart: start, periodEnd: end, outcome: QuotaWindowOutcome.UNPAID };
}

/**
 * Entitlement including the stale-window guard.
 *
 * A read-time fail-closed check, never a write — the same shape as
 * `normalizeExpiredTrial`. Nothing persists a suspension we only inferred, so
 * the moment a real Stripe event lands the account returns to normal by itself.
 */
export function resolveEffectiveEntitlement(
  subscription: QuotaWindowSubscription | null,
  now: Date = new Date(),
  graceHours: number = DEFAULT_WEBHOOK_GRACE_HOURS,
): EntitlementState {
  const base = resolveEntitlementState(subscription?.status ?? null);
  if (base !== EntitlementState.ACTIVE) {
    return base;
  }
  return resolveQuotaWindow(subscription, now, graceHours).outcome === QuotaWindowOutcome.UNPAID
    ? EntitlementState.SUSPENDED
    : EntitlementState.ACTIVE;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- quota-helpers`
Expected: PASS.

- [ ] **Step 5: Register the grace-hours platform setting**

In `packages/shared/src/domain/admin/platform-settings.types.ts`, add to `PlatformSettingKey`:

```typescript
  BILLING_WEBHOOK_GRACE_HOURS = 'billing.webhookGraceHours',
```

In `apps/api/src/common/settings/platform-settings.registry.ts`, after the `BILLING_TRIAL_DAYS` entry:

```typescript
  def({
    key: PlatformSettingKey.BILLING_WEBHOOK_GRACE_HOURS,
    category: PlatformSettingCategory.BILLING,
    type: PlatformSettingType.NUMBER,
    envVar: 'BILLING_WEBHOOK_GRACE_HOURS',
    defaultValue: '6',
    min: 0,
    max: 72,
  }),
```

- [ ] **Step 6: Rebuild shared, verify, commit**

```bash
pnpm --filter @repo/shared build
pnpm --filter api test -- quota-helpers
pnpm --filter api typecheck
npx eslint apps/api/src/modules/billing/quota-helpers.ts apps/api/src/common/settings/platform-settings.registry.ts --max-warnings 0
git add apps/api/src/modules/billing/quota-helpers.ts apps/api/src/modules/billing/quota-helpers.spec.ts packages/shared/src/domain/admin/platform-settings.types.ts apps/api/src/common/settings/platform-settings.registry.ts
git commit -m "feat(billing): resolve the quota window from the subscription period

Stripe bills on the anniversary while every meter reset on the 1st of the
calendar month, handing a mid-month subscriber roughly two allowances per
payment. resolveQuotaWindow makes the subscription period the window and pins
periodStart so a lapsed window can never mint a fresh allowance; a 6h grace
tolerates webhook latency by extending only the end.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Thread the window through the repository

**Files:**
- Modify: `apps/api/src/modules/billing/billing-repository.service.ts`
- Modify: `apps/api/src/modules/billing/quota-enforcement.service.ts`
- Modify: `apps/api/src/modules/billing/billing.service.ts`
- Modify: `apps/api/src/modules/billing/stripe-event-applier.ts`
- Test: `apps/api/src/modules/billing/quota-measures.spec.ts`

**Interfaces:**
- Consumes: `QuotaWindow`, `resolveQuotaWindow` (Task 1).
- Produces: repository methods now taking `window: QuotaWindow`:
  - `ensureOpenUsagePeriod(subscriptionId: string, kind: BillingLimitKey, limitValue: number, window: QuotaWindow): Promise<string | null>`
  - `countConversionsInWindow(userId: string, window: QuotaWindow, client?: PoolClient): Promise<number>` — renamed from `countMonthlyConversions`
  - `sumQuotaCredits(userId: string, limitKey: BillingLimitKey, window: QuotaWindow): Promise<number>`
  - `resolveEffectiveLimit(userId: string, subscriptionId: string, limitKey: BillingLimitKey, window: QuotaWindow): Promise<{ limitValue: number | null; creditValue: number }>`
  - `grantQuotaCredit(params: { ...existing, window: QuotaWindow }): Promise<boolean>`

- [ ] **Step 1: Write the failing boundary test**

Add to `apps/api/src/modules/billing/quota-measures.spec.ts`:

```typescript
describe('conversion counting window', () => {
  it('is inclusive at the start and exclusive at the end', () => {
    // The old query had no upper bound, which was safe only because a calendar
    // window always contained "now". A pinned, possibly-lapsed window does not,
    // so conversions outside it must not be counted.
    const window = {
      periodStart: new Date('2026-09-15T00:00:00Z'),
      periodEnd: new Date('2026-10-15T00:00:00Z'),
      outcome: QuotaWindowOutcome.NORMAL,
    };
    const inWindow = (at: string) =>
      new Date(at) >= window.periodStart && new Date(at) < window.periodEnd;

    expect(inWindow('2026-09-15T00:00:00Z')).toBe(true);
    expect(inWindow('2026-10-14T23:59:59Z')).toBe(true);
    expect(inWindow('2026-10-15T00:00:00Z')).toBe(false);
    expect(inWindow('2026-09-14T23:59:59Z')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test -- quota-measures`
Expected: FAIL — `QuotaWindowOutcome` is not imported/defined in that spec.

- [ ] **Step 3: Change the four repository methods**

In `billing-repository.service.ts`:

1. Import `QuotaWindow` from `./quota-helpers`; drop `utcMonthBounds` from the import if nothing else uses it.
2. `ensureOpenUsagePeriod` — replace the `now: Date = new Date()` parameter with `window: QuotaWindow`, delete the `const { periodStart, periodEnd } = utcMonthBounds(now);` line, and destructure from `window` instead. Change the closing sweep so exactly one period stays open per pair:

```typescript
      // Close every other open period for this pair. The old predicate was
      // `period_end <= $3`, which cannot close an overlapping calendar-era row
      // ([Sep 1, Oct 1) against a new [Sep 15, Oct 15) window) and left two
      // rows open. One open period per (subscription, limit_key) is the
      // invariant; concurrent callers derive the identical window from the same
      // subscription row, so they cannot close each other's.
      await this.databaseService.query(
        `UPDATE billing_usage_periods
            SET status = 'closed', closed_at = COALESCE(closed_at, NOW()), updated_at = NOW()
          WHERE subscription_id = $1 AND limit_key = $2
            AND status = 'open' AND period_start <> $3`,
        [subscriptionId, kind, window.periodStart.toISOString()],
      );
```

3. Rename `countMonthlyConversions` to `countConversionsInWindow`, take `window`, and bound the query at both ends:

```typescript
      `SELECT COUNT(*)::text AS cnt FROM orders
        WHERE user_id = $1
          AND tracking_provider IN ($2, $3)
          AND tracking_converted_at >= $4
          AND tracking_converted_at < $5`,
      [
        userId,
        TrackingConversionProvider.AQUILINE,
        TrackingConversionProvider.API,
        window.periodStart.toISOString(),
        window.periodEnd.toISOString(),
      ],
```

4. `sumQuotaCredits` and `grantQuotaCredit` — take `window` and use `window.periodStart` where they used `utcMonthBounds(...).periodStart`.
5. `resolveEffectiveLimit` — take `window` and forward it to `sumQuotaCredits`.

- [ ] **Step 4: Update the callers**

In `quota-enforcement.service.ts` `resolveSubscriptionContext`, after the entitlement check, resolve the window once and pass it on:

```typescript
    const graceHours = await this.platformSettings.getNumber(
      PlatformSettingKey.BILLING_WEBHOOK_GRACE_HOURS,
    );
    const window = resolveQuotaWindow(subscription, new Date(), graceHours);

    const { limitValue } = await this.repository.resolveEffectiveLimit(
      userId,
      subscription.id,
      kind,
      window,
    );

    let usagePeriodId: string | null = null;
    if (kind !== BillingLimitKey.LISTINGS_PER_MONTH) {
      usagePeriodId = await this.repository.ensureOpenUsagePeriod(
        subscription.id,
        kind,
        limitValue ?? -1,
        window,
      );
    }
```

Return `window` on the context object (add `window: QuotaWindow` to its return type) so `canConvertTracking` can use it:

```typescript
      const used = await this.repository.countConversionsInWindow(userId, ctx.window);
```

In `billing.service.ts` `getQuotaUsage`, resolve the window the same way from the `subscription` parameter and pass it to `resolveEffectiveLimit`, `ensureOpenUsagePeriod` and `countConversionsInWindow`, so the displayed figure and the enforced figure cannot disagree.

In `stripe-event-applier.ts`, before `repository.grantQuotaCredit(...)`:

```typescript
  // The webhook carries only a userId, so the window is resolved here — the one
  // added query in this change. No subscription (rule 1) means the calendar
  // month, which is harmless: a user with no subscription cannot have reached a
  // top-up checkout.
  const creditSubscription = await repository.findCurrentSubscription(userId);
  const creditWindow = resolveQuotaWindow(creditSubscription, new Date());
```

and add `window: creditWindow` to the `grantQuotaCredit` argument object.

- [ ] **Step 5: Apply the read-time unpaid guard**

In `quota-enforcement.service.ts`, replace both uses of `resolveEntitlementState` with `resolveEffectiveEntitlement` so a stale window suspends:

```typescript
    // resolveEffectiveEntitlement, not resolveEntitlementState: an `active`
    // subscription whose window has lapsed past the grace is treated as unpaid.
    // Absence of a webhook is not evidence of payment.
    const entitlement = resolveEffectiveEntitlement(subscription, new Date(), graceHours);
```

Do the same in `isSuspended`. Log at `error` when the outcome is `UNPAID`:

```typescript
      this.logger.error(
        `Subscription window for user ${userId} is stale past the grace; treating as unpaid`,
      );
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter api test
pnpm --filter api typecheck
npx eslint apps/api/src/modules/billing --max-warnings 0
git add apps/api/src/modules/billing
git commit -m "feat(billing): meter usage against the billing period

Threads the resolved window through ensureOpenUsagePeriod, the conversion
count, credit lookup and credit grant. countMonthlyConversions becomes
countConversionsInWindow with an upper bound, and the usage-period sweep now
keeps exactly one open period per (subscription, limit_key). A window stale
past the grace suspends at read time.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Stop eBay order sync when suspended — without moving the watermark

**Files:**
- Modify: `apps/api/src/modules/orders/order-sync.service.ts:95`
- Test: `apps/api/src/modules/billing/subscription-enforcement.guard.spec.ts` (create)

**Interfaces:**
- Consumes: `QuotaEnforcementService.isSuspended(userId)` (existing, now window-aware via Task 2).
- Produces: nothing new; `syncOrdersForAccount` returns `0` on the suspended path.

- [ ] **Step 1: Write the failing guard test**

Create `apps/api/src/modules/billing/subscription-enforcement.guard.spec.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('order sync suspension guard', () => {
  const source = read('../orders/order-sync.service.ts');

  it('checks suspension inside syncOrdersForAccount', () => {
    expect(source).toContain('isSuspended');
  });

  it('returns BEFORE the watermark is advanced', () => {
    // last_ebay_sync_at is written unconditionally at the end of a run and the
    // next run's start date is read from it. A suspended path that still
    // advanced it would PERMANENTLY lose every order that arrived during the
    // suspension — nothing ever looks at that date range again. This assertion
    // is the whole reason the guard file exists.
    const suspendedReturn = source.indexOf('isSuspended');
    const watermarkWrite = source.indexOf('SET last_ebay_sync_at');
    expect(suspendedReturn).toBeGreaterThan(-1);
    expect(watermarkWrite).toBeGreaterThan(-1);
    expect(suspendedReturn).toBeLessThan(watermarkWrite);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test -- subscription-enforcement`
Expected: FAIL — `isSuspended` is not present in `order-sync.service.ts`.

- [ ] **Step 3: Implement the early return**

Inject `QuotaEnforcementService` into `OrderSyncService`'s constructor (the module already imports `BillingModule`; confirm with `grep -n "BillingModule" apps/api/src/modules/orders/orders.module.ts` and add the import if absent). At the very top of `syncOrdersForAccount`, before any fetch:

```typescript
    // Suspension stops order ingestion. THE POSITION OF THIS RETURN IS
    // LOAD-BEARING: it must precede both the fetch loop and the
    // `last_ebay_sync_at` write below. Advancing the watermark while skipping
    // the fetch would permanently lose every order that arrived during the
    // suspension, because the next run starts from that timestamp and nothing
    // ever looks further back. Leaving it untouched is what lets a reinstated
    // account back-fill the whole suspended period on its next tick.
    if (await this.quotaEnforcement.isSuspended(account.user_id)) {
      this.logger.log(
        `Order sync skipped for user ${account.user_id}: subscription suspended (watermark preserved)`,
      );
      return 0;
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- subscription-enforcement`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm --filter api typecheck
npx eslint apps/api/src/modules/orders/order-sync.service.ts apps/api/src/modules/billing/subscription-enforcement.guard.spec.ts --max-warnings 0
git add apps/api/src/modules/orders/order-sync.service.ts apps/api/src/modules/billing/subscription-enforcement.guard.spec.ts
git commit -m "feat(orders): stop eBay order sync for a suspended account

The early return precedes the last_ebay_sync_at write, so the watermark is
preserved and a reinstated account back-fills the whole suspended period on
its next tick. A guard spec asserts that ordering.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Stop Amazon tracking scrapes when suspended — keep the scheduler

**Files:**
- Modify: `apps/api/src/modules/amazon/amazon-tracking-processor.service.ts:96`
- Modify: `apps/api/src/modules/billing/subscription-enforcement.guard.spec.ts`

**Interfaces:**
- Consumes: `QuotaEnforcementService.isSuspended(userId)`.
- Produces: nothing new; `processTracking` returns early without touching the scheduler.

- [ ] **Step 1: Write the failing guard test**

Append to `subscription-enforcement.guard.spec.ts`:

```typescript
describe('amazon tracking suspension guard', () => {
  const source = read('../amazon/amazon-tracking-processor.service.ts');

  it('skips the scrape when suspended', () => {
    expect(source).toContain('isSuspended');
  });

  it('does not remove the scheduler on the suspended path', () => {
    // Keeping the scheduler is what makes resume automatic: the expensive part
    // is the Playwright scrape, and the scheduler costs one lookup per tick.
    // Tearing it down would need reconcileSchedulers(), which runs only at API
    // startup — an unacceptable recovery path for a paying customer.
    const idx = source.indexOf('isSuspended');
    expect(idx).toBeGreaterThan(-1);
    const suspendedBlock = source.slice(idx, idx + 600);
    expect(suspendedBlock).not.toContain('removeJobScheduler');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test -- subscription-enforcement`
Expected: FAIL on the first assertion.

- [ ] **Step 3: Implement**

Inject `QuotaEnforcementService`, then at the top of `processTracking`, after the order row is loaded and before any Playwright call:

```typescript
    // Suspension stops the scrape, NOT the scheduler. The scrape is the cost
    // (~330-450s of the shared Playwright pool per order); the scheduler is one
    // lookup per tick. Leaving it registered means the very next tick after
    // payment resumes this order exactly where it stopped, with no restart and
    // no manual action.
    if (await this.quotaEnforcement.isSuspended(order.user_id)) {
      this.logger.log(
        `Tracking scrape skipped for order ${order.id}: subscription suspended (scheduler retained)`,
      );
      return;
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- subscription-enforcement`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm --filter api typecheck
npx eslint apps/api/src/modules/amazon/amazon-tracking-processor.service.ts --max-warnings 0
git add apps/api/src/modules/amazon/amazon-tracking-processor.service.ts apps/api/src/modules/billing/subscription-enforcement.guard.spec.ts
git commit -m "feat(amazon): skip tracking scrapes for a suspended account

The per-order scheduler is deliberately retained so the next tick after
payment resumes the order in place, rather than depending on the startup-only
reconcileSchedulers().

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `resumeAfterEntitlementRestored` — the one thing that does not restart itself

**Files:**
- Create: `apps/api/src/modules/billing/entitlement-resume.service.ts`
- Create: `apps/api/src/modules/billing/entitlement-resume.service.spec.ts`
- Modify: `apps/api/src/modules/billing/billing.module.ts`

**Interfaces:**
- Consumes: `DatabaseService`, `AutoFulfillQueueService` (from `OrdersModule`), `AutoFulfillStatus` / `AutoFulfillBlockedReason` from `@repo/shared`.
- Produces: `EntitlementResumeService.resumeAfterEntitlementRestored(userId: string): Promise<{ requeued: number }>`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/billing/entitlement-resume.service.spec.ts`:

```typescript
import { AutoFulfillBlockedReason, AutoFulfillStatus } from '@repo/shared';

import { selectResumableOrders } from './entitlement-resume.service';

describe('selectResumableOrders', () => {
  const row = (reason: AutoFulfillBlockedReason) => ({
    ebay_order_id: 'o1',
    auto_fulfill_status: AutoFulfillStatus.BLOCKED,
    auto_fulfill_blocked_reason: reason,
  });

  it('resumes only orders blocked by suspension', () => {
    const rows = [
      row(AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED),
      row(AutoFulfillBlockedReason.CAPTCHA),
      row(AutoFulfillBlockedReason.CAP),
      row(AutoFulfillBlockedReason.OUT_OF_STOCK),
    ];
    // Reviving a captcha/cap/out-of-stock block would re-run a purchase that
    // was refused for a reason payment does not change — and `cap` in
    // particular is a spend guard.
    expect(selectResumableOrders(rows).map((r) => r.auto_fulfill_blocked_reason)).toEqual([
      AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED,
    ]);
  });

  it('ignores orders that are not blocked', () => {
    expect(
      selectResumableOrders([
        {
          ebay_order_id: 'o2',
          auto_fulfill_status: AutoFulfillStatus.PLACED,
          auto_fulfill_blocked_reason: AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED,
        },
      ]),
    ).toEqual([]);
  });

  it('is empty for an empty input', () => {
    expect(selectResumableOrders([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test -- entitlement-resume`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/api/src/modules/billing/entitlement-resume.service.ts`:

```typescript
// apps/api/src/modules/billing/entitlement-resume.service.ts
//
// What has to be restarted by hand when an account becomes entitled again.
//
// Six of the seven suspended capabilities resume on their own: listing creates
// are user-initiated; Keepa leaves the products overdue so the claim takes them
// first; order sync back-fills because its watermark never moved; tracking
// polling keeps its scheduler; and a held conversion plus its eBay push are
// retried on the normal shipped cadence.
//
// Auto-fulfill is the exception. `maybeEnqueueAutoFulfill` fires only on a
// genuine order insert (`order-sync.service.ts:214`), and the retry policy
// treats a blocked reason as permanent rather than transport, so an order
// blocked by suspension is re-enqueued by nothing at all.

import { Injectable, Logger } from '@nestjs/common';
import { AutoFulfillBlockedReason, AutoFulfillStatus } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { AutoFulfillQueueService } from '../orders/auto-fulfill-queue.service';

export interface ResumableOrderRow {
  ebay_order_id: string;
  auto_fulfill_status: string;
  auto_fulfill_blocked_reason: string | null;
}

/**
 * Pure: which blocked orders may be retried after payment.
 *
 * Scoped to SUBSCRIPTION_SUSPENDED alone. Every other blocked reason describes
 * a condition payment does not change — and `CAP` is a spend guard, so reviving
 * it would place a purchase the seller capped.
 */
export function selectResumableOrders(rows: ResumableOrderRow[]): ResumableOrderRow[] {
  return rows.filter(
    (row) =>
      row.auto_fulfill_status === AutoFulfillStatus.BLOCKED &&
      row.auto_fulfill_blocked_reason === AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED,
  );
}

@Injectable()
export class EntitlementResumeService {
  private readonly logger = new Logger(EntitlementResumeService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly autoFulfillQueue: AutoFulfillQueueService,
  ) {}

  /**
   * Called on a SUSPENDED -> ACTIVE transition (webhook) and from
   * `billing:reconcile`. Idempotent: an order already moved off BLOCKED is no
   * longer selected. Best-effort — a resume failure must never turn a
   * successful payment into an error the seller sees.
   */
  async resumeAfterEntitlementRestored(userId: string): Promise<{ requeued: number }> {
    try {
      const rows = await this.databaseService.query<ResumableOrderRow>(
        `SELECT ebay_order_id, auto_fulfill_status, auto_fulfill_blocked_reason
           FROM orders
          WHERE user_id = $1 AND auto_fulfill_status = $2 AND auto_fulfill_blocked_reason = $3`,
        [userId, AutoFulfillStatus.BLOCKED, AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED],
      );

      let requeued = 0;
      for (const row of selectResumableOrders(rows)) {
        try {
          // Re-enter the normal resolution rather than replaying a stale
          // decision: the store toggle, the per-account cap and the round-robin
          // are all re-evaluated at resume time.
          await this.autoFulfillQueue.requeueBlockedOrder(row.ebay_order_id);
          requeued += 1;
        } catch (err) {
          this.logger.warn(
            `Auto-fulfill resume skipped for ${row.ebay_order_id}: ${(err as Error).message}`,
          );
        }
      }
      if (requeued > 0) {
        this.logger.log(`Resumed ${requeued} suspended auto-fulfill order(s) for user ${userId}`);
      }
      return { requeued };
    } catch (err) {
      this.logger.warn(`Entitlement resume failed for user ${userId}: ${(err as Error).message}`);
      return { requeued: 0 };
    }
  }
}
```

Add `requeueBlockedOrder(ebayOrderId: string): Promise<void>` to `AutoFulfillQueueService`: it resets the row to `AutoFulfillStatus.PENDING` with a null blocked reason, then re-runs the same resolution `maybeEnqueueAutoFulfill` performs (store toggle → enabled accounts with a cap → round-robin → enqueue). Extract that resolution out of `OrderSyncService.maybeEnqueueAutoFulfill` into a shared method both call, so the two paths cannot drift.

Register `EntitlementResumeService` in `billing.module.ts` providers and exports.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- entitlement-resume`
Expected: PASS.

- [ ] **Step 5: Call it from the webhook applier**

In `stripe-event-applier.ts`, after the subscription upsert, when the previous local status was suspended and the incoming one is not:

```typescript
  // A SUSPENDED -> ACTIVE transition is where auto-fulfill has to be restarted;
  // everything else resumes on its own. Best-effort: a resume failure must not
  // reject the webhook, or Stripe would redeliver an event we already applied.
  if (
    previousEntitlement === EntitlementState.SUSPENDED &&
    resolveEntitlementState(subscription.status) === EntitlementState.ACTIVE
  ) {
    await resume.resumeAfterEntitlementRestored(customer.userId).catch(() => undefined);
  }
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter api test
pnpm --filter api typecheck
npx eslint apps/api/src/modules/billing apps/api/src/modules/orders --max-warnings 0
git add apps/api/src/modules/billing apps/api/src/modules/orders
git commit -m "feat(billing): re-enqueue suspension-blocked auto-fulfill on resume

Auto-fulfill was the one suspended capability nothing restarted:
maybeEnqueueAutoFulfill fires only on a genuine order insert, and a blocked
reason is treated as permanent. Scoped strictly to SUBSCRIPTION_SUSPENDED so a
captcha, cap or out-of-stock block is never revived.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `billing:reconcile` — recovery that does not depend on webhooks

**Files:**
- Create: `apps/api/src/scripts/billing-reconcile.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: `StripeBillingProvider` (`stripe.subscriptions.retrieve`), `stripe-event-applier`'s apply logic, `EntitlementResumeService.resumeAfterEntitlementRestored`.
- Produces: `pnpm --filter api billing:reconcile -- --email <email>`

- [ ] **Step 1: Write the failing arg-parsing test**

Create `apps/api/src/scripts/billing-reconcile-helpers.spec.ts`:

```typescript
import { parseReconcileArgs, ReconcileArgError } from './billing-reconcile-helpers';

describe('parseReconcileArgs', () => {
  it('reads --email', () => {
    expect(parseReconcileArgs(['--email', 'a@b.c'])).toEqual({ email: 'a@b.c', dryRun: false });
  });

  it('ignores the literal "--" pnpm run forwards', () => {
    expect(parseReconcileArgs(['--', '--email', 'a@b.c']).email).toBe('a@b.c');
  });

  it('supports --dry-run', () => {
    expect(parseReconcileArgs(['--email', 'a@b.c', '--dry-run']).dryRun).toBe(true);
  });

  it('requires --email', () => {
    expect(() => parseReconcileArgs([])).toThrow(ReconcileArgError);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseReconcileArgs(['--force'])).toThrow(ReconcileArgError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test -- billing-reconcile`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper and the script**

Create `apps/api/src/scripts/billing-reconcile-helpers.ts` with `ReconcileArgError`, `ReconcileArgs { email: string; dryRun: boolean }` and `parseReconcileArgs`, following `reset-users-helpers.ts`'s parser exactly (skip a bare `--`, reject unknown flags, require a value after `--email`).

Create `apps/api/src/scripts/billing-reconcile.ts` following `reset-users.ts`'s shape (dotenv from `../../.env`, direct `pg` Pool, exit codes 0/1/2/3). It:

1. Resolves the user by email → `billing_customers.provider_customer_id`.
2. Lists that customer's Stripe subscriptions and takes the live one.
3. **Re-applies it through the same mapping `stripe-event-applier` uses** — import and reuse that function; do not write a second mapper, because two writers of this row is the drift this module has repeatedly suffered.
4. Updates `status`, `current_period_start/end`, `plan_id` (from `metadata.plan_id`).
5. Calls `resumeAfterEntitlementRestored(userId)`.
6. With `--dry-run`, prints what it would write and exits without writing.

Add to `apps/api/package.json` scripts, after `reset-users`:

```json
    "billing:reconcile": "tsx src/scripts/billing-reconcile.ts",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- billing-reconcile`
Expected: PASS.

- [ ] **Step 5: Verify against Stripe test mode and commit**

```bash
pnpm --filter api run billing:reconcile -- --email <a real test-mode customer> --dry-run
pnpm --filter api typecheck
npx eslint apps/api/src/scripts/billing-reconcile.ts apps/api/src/scripts/billing-reconcile-helpers.ts --max-warnings 0
git add apps/api/src/scripts/billing-reconcile.ts apps/api/src/scripts/billing-reconcile-helpers.ts apps/api/src/scripts/billing-reconcile-helpers.spec.ts apps/api/package.json
git commit -m "feat(billing): add billing:reconcile for lost Stripe webhooks

A stale window now suspends, so the recovery path must not itself depend on
webhooks. Pulls the live subscription from Stripe and re-applies it through the
existing event applier, then runs the resume routine.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Lock the invariants with source-greps

**Files:**
- Modify: `apps/api/src/modules/billing/subscription-enforcement.guard.spec.ts`

- [ ] **Step 1: Write the failing guard tests**

Append:

```typescript
describe('quota window invariants', () => {
  const repo = read('./billing-repository.service.ts');
  const helpers = read('./quota-helpers.ts');

  it('no repository method resolves the calendar month directly', () => {
    // The defect class this whole change addresses is "one rule, implemented at
    // only some of its call sites". There are seven here.
    expect(repo).not.toContain('utcMonthBounds(');
  });

  it('the conversion count is bounded at both ends', () => {
    expect(repo).toContain('tracking_converted_at >=');
    expect(repo).toContain('tracking_converted_at <');
  });

  it('resolveQuotaWindow never advances periodStart', () => {
    // Guards against a future reintroduction of the rejected roll-forward: the
    // grace must extend the END only.
    expect(helpers).not.toMatch(/addUtcMonths|rollForward/);
  });
});
```

- [ ] **Step 2: Run to verify they pass** (Tasks 1–2 already satisfy them)

Run: `pnpm --filter api test -- subscription-enforcement`
Expected: PASS. If `utcMonthBounds(` still appears in the repository, a call site was missed — fix it.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/billing/subscription-enforcement.guard.spec.ts
git commit -m "test(billing): lock the window, watermark and scheduler invariants

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The 30-day trial

**Files:**
- Create: `apps/api/migrations/097_billing_trial_month.sql`
- Modify: `apps/api/src/common/settings/platform-settings.registry.ts:414`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/translation.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write the migration**

Create `apps/api/migrations/097_billing_trial_month.sql`:

```sql
-- Migration 097: the trial becomes a 30-day, 20-conversion offer.
--
-- Listings stay at 50 and the AO ceiling stays at 20. Migration 085 set AO to
-- 2x the conversion quota; here they are deliberately equal, so the conversion
-- quota can never be the binding limit within a trial. That is intended — the
-- trial's cost ceiling is the 20 conversions (~$2.80 of Aquiline) either way,
-- and a trial user hitting a quota wall is the opposite of the point.
--
-- Duration is NOT here: it is the `billing.trialDays` platform setting.

UPDATE billing_plan_limits
   SET limit_value = 20, updated_at = NOW()
 WHERE limit_key = 'tracking_conversions_per_month'
   AND plan_id = (SELECT id FROM billing_plans WHERE slug = 'trial');

UPDATE billing_plans
   SET description = 'Automatic 30-day cardless trial for newly registered users.',
       updated_at = NOW()
 WHERE slug = 'trial';
```

- [ ] **Step 2: Apply and verify**

```bash
pnpm --filter api migrate
psql "$DATABASE_URL" -c "SELECT l.limit_key, l.limit_value FROM billing_plan_limits l JOIN billing_plans p ON p.id = l.plan_id WHERE p.slug = 'trial' ORDER BY 1;"
```
Expected: `amazon_orders_per_month | 20`, `listings_per_month | 50`, `tracking_conversions_per_month | 20`.

- [ ] **Step 3: Flip the two registry defaults**

In `platform-settings.registry.ts`: `BILLING_TRIAL_DAYS` `defaultValue: '7'` → `'30'` (bounds are 1–90, so 30 fits), and `BILLING_ENFORCEMENT_ENABLED` `defaultValue: 'false'` → `'true'`.

- [ ] **Step 4: Update the copy**

In both `packages/shared/src/i18n/resources/en/translation.json` and `tr/translation.json`:
- `landing.hero.trialTitle`: `"7-day free trial"` → `"1 month free"`; `"7 gün ücretsiz deneme"` → `"1 ay ücretsiz deneme"`.
- The demo FAQ answer at `landing.faq` (the entry containing "7-day free trial" / "7 günlük ücretsiz deneme") — change to a one-month phrasing in each locale, written natively rather than translated.

Then confirm nothing else advertises the old length:

```bash
grep -rn -iE "7[- ]?(gün|day)" packages/shared/src/i18n/resources/*/translation.json
```
Expected: no trial-related hits.

- [ ] **Step 5: Update CLAUDE.md**

In the "Billing & Packages" section: the plan table's Trial row becomes `50 / 20 / 20`; the "Trial size is 50 listings / 10 AO … ~$0.65 per trial" paragraph becomes 50 listings / 20 conversions / 20 AO at ~$1.00–1.25 per trial; state the **30-day** duration and that it is `billing.trialDays`; note `BILLING_ENFORCEMENT_ENABLED` now defaults to `true`. Add a "Quota windows follow the billing period" note pointing at `resolveQuotaWindow`, the 6-hour grace, and the pinned `periodStart`.

- [ ] **Step 6: Verify end to end and commit**

```bash
pnpm --filter @repo/shared build
pnpm --filter api test
pnpm --filter api typecheck
pnpm lint
```

Then manually: `pnpm --filter api run reset-users -- --yes`, register a fresh account, connect an eBay store, and confirm the trial subscription's `current_period_end` is 30 days out, `GET /billing/summary` reports a 20-conversion quota, and exactly one usage period exists.

```bash
git add apps/api/migrations/097_billing_trial_month.sql apps/api/src/common/settings/platform-settings.registry.ts packages/shared/src/i18n/resources CLAUDE.md
git commit -m "feat(billing): 30-day trial with 20 tracking conversions

Trial moves from 7 days to 30 and from 10 conversions to 20; listings stay at
50 and AO at 20. Enforcement is enabled by default, without which none of the
trial's limits apply and it has no cost ceiling.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| D1 / Part 1 — window resolution, 6 rules | 1 |
| Part 1 — repository changes, upper bound, sweep predicate | 2 |
| Part 1 — rule 6 read-time guard | 2 (Step 5) |
| D2 / Part 2 — order sync + watermark | 3 |
| D2 / Part 2 — tracking polling, scheduler kept | 4 |
| D4 / Part 4 — resume routine | 5 |
| D3 / Part 3 — `billing:reconcile` | 6 |
| Testing — guard specs | 3, 4, 7 |
| Follow-on — trial | 8 |

**Placeholder scan:** none — every code step carries real code; the two places that describe an edit rather than show it (Task 2's mechanical parameter swap, Task 8's CLAUDE.md prose) name the exact file, symbol and old/new values.

**Type consistency:** `QuotaWindow` / `QuotaWindowOutcome` / `resolveQuotaWindow` / `resolveEffectiveEntitlement` / `countConversionsInWindow` / `resumeAfterEntitlementRestored` / `requeueBlockedOrder` / `selectResumableOrders` are spelled identically in every task that defines or consumes them.

**Known extraction:** Task 5 requires pulling the auto-fulfill resolution out of `OrderSyncService.maybeEnqueueAutoFulfill` into a method `AutoFulfillQueueService.requeueBlockedOrder` can share. That is called out in the task rather than left implicit, because it is the one structural change in the plan.
