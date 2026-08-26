# Billing Transparency & Subscription Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the billing page answer every money question in-app (invoices, saved card, next charge, what a plan change costs) and make it structurally impossible for one seller to hold more than one Stripe subscription.

**Architecture:** Invoices, cards and upcoming-charge amounts are read LIVE from Stripe through new endpoints that only the billing page calls — `GET /billing/summary` stays DB-only because `AppLayout` calls it on every page load. Plan changes split by direction: an upgrade charges the prorated difference immediately and rolls back if the card declines; a downgrade is scheduled to period end via a Stripe Subscription Schedule. Duplicate subscriptions are prevented by three independent layers, the outermost of which asks Stripe itself.

**Tech Stack:** NestJS 10 + raw `pg`, Stripe Node SDK 22.4.0, React 18 + RTK Query, Emotion, i18next (EN + TR), Jest (pure helpers + source-grep guard specs).

**Spec:** [docs/superpowers/specs/2026-08-22-billing-transparency-design.md](../specs/2026-08-22-billing-transparency-design.md)

## Global Constraints

- **Money that is unknown renders as an em dash or an explicit error — NEVER `0` and never a guess.** Matches the existing nullable-micro-USD rule.
- **No hardcoded UI strings.** Every new string gets a key in BOTH `packages/shared/src/i18n/resources/en/billing.json` and `.../tr/billing.json`.
- **Frontend 4-file split** (`.component.tsx` / `.container.tsx` / `.style.ts` / `.types.ts`). No `styled(...)` outside `.style.ts`, no hooks in `.component.tsx`, no `interface`/`type` outside `.types.ts`.
- **All UI primitives come from `@repo/ui`.** No native `<select>`/`<input>`/`<button>`, no inline styles, no hardcoded colors/spacing — use `tkn()`.
- **DB/Stripe-bound code is verified by source-grep guard specs**, not unit tests — the repo's Jest harness covers pure logic only (`apps/api/jest.config.js`). Genuinely pure helpers get real unit tests.
- **`GET /billing/summary` must not gain a Stripe API call.** `AppLayout` depends on its latency.
- **After editing `packages/shared`, run `pnpm --filter @repo/shared build`** — apps load it from `dist/`.
- **Every new billing error key must be added to `BILLING_ERROR_STATUS`** in `apps/api/src/modules/billing/billing.controller.ts`, or it becomes a 500.

---

## File Structure

**Shared (`packages/shared/src/domain/billing/`)**
- `billing.wire.ts` — MODIFY: add `BillingDetailsDto`, `BillingInvoiceDto`, `BillingInvoiceListDto`, `BillingPlanChangePreviewDto`, `BillingScheduledChangeDto`, `BillingPaymentMethodDto`
- `plan-change.ts` — CREATE: pure `resolvePlanChangeDirection`, `PlanChangeDirection`
- `plan-change.spec.ts` — CREATE
- `billing.types.ts` — MODIFY: no change expected; `TRIAL_PLAN_SLUG` already exists

**API (`apps/api/src/modules/billing/`)**
- `billing-repository.service.ts` — MODIFY: `findCurrentSubscription` ordering, `endTrialSubscriptionsForUser`
- `stripe-event-applier.ts` — MODIFY: close the trial row on `customer.subscription.created`
- `billing-provider.ts` — MODIFY: port gains `hasActiveProviderSubscription`, `previewPlanChange`, `scheduleDowngrade`, `cancelScheduledChange`, `getBillingDetails`, `listInvoices`; `changeSubscriptionPlan` takes a direction; promo codes + top-up invoice creation
- `stripe-invoice-mapper.ts` — CREATE: pure Stripe invoice → DTO mapping
- `stripe-invoice-mapper.spec.ts` — CREATE
- `payment-method-helpers.ts` — CREATE: pure card-expiry threshold
- `payment-method-helpers.spec.ts` — CREATE
- `billing.service.ts` — MODIFY: duplicate guard, direction-aware change, new read methods
- `billing.controller.ts` — MODIFY: new endpoints + error mappings
- `subscription-integrity.guard.spec.ts` — CREATE: locks A1/A2/A3 and the plan-change split

**Web (`apps/web/src/features/billing/`)**
- `api/billing.api.ts` — MODIFY: new endpoints
- `BillingPage/BillingPage.{container,component,style,types}.tsx|ts` — MODIFY
- `components/PaymentMethodCard/` — CREATE (4-file split)
- `components/InvoiceHistoryCard/` — CREATE (4-file split)
- `components/PlanChangeConfirm/` — CREATE (4-file split)

---

### Task 1: One live subscription row per user

Closes A1 and A2 from the spec: the local trial row is never ended when a real subscription starts, and it sorts ABOVE that real subscription, so `hasProviderSubscription` reads false and every later plan click opens a fresh Checkout.

**Files:**
- Modify: `apps/api/src/modules/billing/billing-repository.service.ts`
- Modify: `apps/api/src/modules/billing/stripe-event-applier.ts`
- Test: `apps/api/src/modules/billing/subscription-integrity.guard.spec.ts` (create)

**Interfaces:**
- Consumes: `TRIAL_PLAN_SLUG` from `@repo/shared`, existing `BillingSubscriptionStatus`
- Produces: `BillingRepositoryService.endTrialSubscriptionsForUser(userId: string): Promise<void>`

- [ ] **Step 1: Write the failing guard spec**

Create `apps/api/src/modules/billing/subscription-integrity.guard.spec.ts`:

```typescript
// apps/api/src/modules/billing/subscription-integrity.guard.spec.ts
//
// Source-greps that keep one seller from ever holding more than one Stripe
// subscription.
//
// On 2026-08-22 the first real sandbox subscribe produced THREE concurrent
// live subscriptions for one customer, all billing. The DB/Stripe layer cannot
// be unit-tested here (the Jest harness covers pure logic only), and a unit
// test cannot catch a call that was never made — so this asserts the calls
// exist, the way entitlement-enforcement.guard.spec.ts does for its own
// invariants.

import * as fs from 'fs';
import * as path from 'path';

const API_SRC = path.join(__dirname, '..', '..');

function read(...segments: string[]): string {
  return fs.readFileSync(path.join(API_SRC, ...segments), 'utf8');
}

describe('one live subscription per user', () => {
  describe('A1 — the local trial row is closed when a real subscription starts', () => {
    const repository = read('modules', 'billing', 'billing-repository.service.ts');
    const applier = read('modules', 'billing', 'stripe-event-applier.ts');

    it('exposes a way to end a user\'s trial rows', () => {
      expect(repository).toMatch(/async endTrialSubscriptionsForUser\(/);
    });

    it('only ever ends TRIAL rows, never a provider-backed one', () => {
      // Ending a paid row here would suspend a paying customer.
      const body = repository.slice(repository.indexOf('async endTrialSubscriptionsForUser('));
      expect(body).toMatch(/provider_subscription_id IS NULL/);
    });

    it('the applier closes the trial when a subscription is created', () => {
      expect(applier).toMatch(/endTrialSubscriptionsForUser\(/);
    });
  });

  describe('A2 — a provider-backed row outranks a local trial row', () => {
    const repository = read('modules', 'billing', 'billing-repository.service.ts');
    const query = repository.slice(
      repository.indexOf('async findCurrentSubscription('),
      repository.indexOf('async findOpenUsagePeriods('),
    );

    it('orders provider-backed subscriptions first, before any status ordering', () => {
      // trialing used to sort above active, so a lingering local trial masked
      // the real Stripe subscription and every plan click opened a new checkout.
      expect(query).toMatch(/ORDER BY[\s\S]*provider_subscription_id IS NULL/);
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter api test -- subscription-integrity.guard.spec
```

Expected: FAIL — `endTrialSubscriptionsForUser` does not exist.

- [ ] **Step 3: Add the repository method**

In `apps/api/src/modules/billing/billing-repository.service.ts`, next to `updateSubscriptionPlan`:

```typescript
  /**
   * End this user's local trial rows.
   *
   * The trial exists only in our tables — it has no Stripe subscription — and
   * it is over the moment the seller actually pays. Nothing closed it before,
   * so a converted seller kept a live `trialing` row forever; combined with
   * findCurrentSubscription's ordering that row MASKED their real subscription,
   * `hasProviderSubscription` read false, and every later plan click opened a
   * fresh Checkout and minted another live subscription.
   *
   * `provider_subscription_id IS NULL` is the safety catch: this must never be
   * able to touch a provider-backed row, because doing so would suspend a
   * paying customer.
   */
  async endTrialSubscriptionsForUser(userId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE billing_subscriptions s
          SET status = $2, ended_at = NOW(), updated_at = NOW()
         FROM billing_customers c
        WHERE c.id = s.customer_id
          AND c.user_id = $1
          AND s.provider_subscription_id IS NULL
          AND s.status <> $2`,
      [userId, BillingSubscriptionStatus.ENDED],
    );
  }
```

- [ ] **Step 4: Fix the ordering**

In the same file, replace `findCurrentSubscription`'s `ORDER BY` so a provider-backed row always wins:

```typescript
  async findCurrentSubscription(userId: string): Promise<BillingSubscriptionDto | null> {
    const rows = await this.databaseService.query<SubscriptionEntity>(
      `SELECT s.* FROM billing_subscriptions s
       JOIN billing_customers c ON c.id = s.customer_id
       WHERE c.user_id = $1
       ORDER BY
         -- A real Stripe subscription outranks a local-only trial row, whatever
         -- their statuses. This used to sort purely by status with 'trialing'
         -- first, so a trial row that was never closed masked the paid
         -- subscription underneath it and the FE kept opening new checkouts.
         (s.provider_subscription_id IS NULL) ASC,
         CASE s.status
           WHEN 'trialing' THEN 1
           WHEN 'active' THEN 2
           WHEN 'past_due' THEN 3
           WHEN 'canceled' THEN 4
           WHEN 'ended' THEN 5
         END ASC,
         s.current_period_end DESC`,
      [userId],
    );
    return rows.length > 0 ? this.mapSubscription(rows[0]) : null;
  }
```

- [ ] **Step 5: Call it from the applier**

In `apps/api/src/modules/billing/stripe-event-applier.ts`, in `applyStripeEvent`, immediately before `upsertSubscriptionByProvider`:

```typescript
  // The seller is paying now, so their local trial is over. Best-effort: a
  // failure here must not reject the webhook (Stripe would redeliver forever
  // against an event we already applied), and A2's ordering keeps the result
  // correct even if this row is left behind.
  try {
    await repository.endTrialSubscriptionsForUser(customer.userId);
  } catch {
    // Intentionally swallowed — see above.
  }

  const subscription = await repository.upsertSubscriptionByProvider(customer.id, planId, fields);
```

- [ ] **Step 6: Run the guard spec and the full suite**

```bash
pnpm --filter api test -- subscription-integrity.guard.spec
pnpm --filter api test
```

Expected: the new spec PASSES; all previously passing suites still pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/billing/billing-repository.service.ts \
        apps/api/src/modules/billing/stripe-event-applier.ts \
        apps/api/src/modules/billing/subscription-integrity.guard.spec.ts
git commit -m "fix(billing): one live subscription row per user"
```

---

### Task 2: Authoritative duplicate-subscription guard

Closes A3. Our own database is currently the only thing stopping a second subscription, and Stripe does not refuse one. When the DB is wrong, the seller is billed twice.

**Files:**
- Modify: `apps/api/src/modules/billing/billing-provider.ts`
- Modify: `apps/api/src/modules/billing/billing.service.ts`
- Modify: `apps/api/src/modules/billing/billing.controller.ts`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/billing.json`
- Test: `apps/api/src/modules/billing/subscription-integrity.guard.spec.ts` (extend)

**Interfaces:**
- Consumes: `BillingRepositoryService.findCustomerByUserId`
- Produces: `BillingProviderPort.hasActiveProviderSubscription(providerCustomerId: string): Promise<boolean>`; error key `billing.errors.alreadySubscribed` → HTTP 409

- [ ] **Step 1: Extend the guard spec**

Append to `subscription-integrity.guard.spec.ts`:

```typescript
describe('A3 — checkout asks Stripe, not just our database', () => {
  const provider = read('modules', 'billing', 'billing-provider.ts');
  const service = read('modules', 'billing', 'billing.service.ts');
  const controller = read('modules', 'billing', 'billing.controller.ts');

  it('the provider can ask Stripe whether a subscription already exists', () => {
    expect(provider).toMatch(/async hasActiveProviderSubscription\(/);
    expect(provider).toMatch(/subscriptions\.list\(/);
  });

  it('createCheckout refuses when Stripe already reports one', () => {
    // Our DB being wrong is exactly how three subscriptions got created, so
    // this check must not read from our own tables.
    const body = service.slice(service.indexOf('async createCheckout('));
    expect(body).toMatch(/hasActiveProviderSubscription\(/);
    expect(body).toMatch(/billing\.errors\.alreadySubscribed/);
  });

  it('the refusal is a 409, not a 500', () => {
    expect(controller).toMatch(/'billing\.errors\.alreadySubscribed':\s*HttpStatus\.CONFLICT/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter api test -- subscription-integrity.guard.spec
```

Expected: FAIL — `hasActiveProviderSubscription` does not exist.

- [ ] **Step 3: Add the port method and its Stripe implementation**

In `apps/api/src/modules/billing/billing-provider.ts`, add to `BillingProviderPort`:

```typescript
  /**
   * Does this customer already have a subscription Stripe considers live?
   *
   * Asked BEFORE opening a checkout, and deliberately asked of Stripe rather
   * than of our own tables: our tables being wrong is precisely how one
   * customer ended up with three concurrent subscriptions on 2026-08-22.
   */
  hasActiveProviderSubscription(providerCustomerId: string): Promise<boolean>;
```

And implement it on `StripeBillingProvider`:

```typescript
  /** Statuses that mean "this customer is already subscribed". `incomplete`
   *  and `incomplete_expired` are excluded: those never became a subscription
   *  the customer is being billed for, and blocking on them would trap a
   *  seller whose first card attempt failed. */
  private static readonly LIVE_SUBSCRIPTION_STATUSES = new Set([
    'active',
    'trialing',
    'past_due',
    'unpaid',
  ]);

  async hasActiveProviderSubscription(providerCustomerId: string): Promise<boolean> {
    const stripe = this.getClient();
    try {
      const list = await stripe.subscriptions.list({
        customer: providerCustomerId,
        status: 'all',
        limit: 100,
      });
      return list.data.some((sub) =>
        StripeBillingProvider.LIVE_SUBSCRIPTION_STATUSES.has(sub.status),
      );
    } catch (error) {
      // Fail CLOSED. An unreadable answer here must not be read as "no
      // subscription" — that is the branch that double-bills. Refusing the
      // checkout is recoverable; a duplicate subscription is a refund.
      this.logger.error(`Stripe subscription lookup failed: ${describeError(error)}`);
      throw new Error('billing.errors.checkoutFailed');
    }
  }
```

- [ ] **Step 4: Call it from `createCheckout`**

In `apps/api/src/modules/billing/billing.service.ts`, inside `createCheckout`, after the Stripe customer is resolved and BEFORE the session is created:

```typescript
    // Ask Stripe itself, not our tables. This is the layer that cannot be
    // fooled by our own state being stale — and stale state is exactly what
    // produced three live subscriptions for one seller on 2026-08-22.
    if (providerCustomerId) {
      const alreadySubscribed =
        await this.provider.hasActiveProviderSubscription(providerCustomerId);
      if (alreadySubscribed) {
        throw new Error('billing.errors.alreadySubscribed');
      }
    }
```

- [ ] **Step 5: Map the error and add the copy**

In `apps/api/src/modules/billing/billing.controller.ts`, add to `BILLING_ERROR_STATUS`:

```typescript
  'billing.errors.alreadySubscribed': HttpStatus.CONFLICT,
```

In `packages/shared/src/i18n/resources/en/billing.json`, under `billing.errors`:

```json
"alreadySubscribed": "You already have an active subscription. Use \"Switch plan\" to change it instead of subscribing again."
```

In `packages/shared/src/i18n/resources/tr/billing.json`:

```json
"alreadySubscribed": "Zaten aktif bir aboneliğiniz var. Yeniden abone olmak yerine \"Planı değiştir\" ile geçiş yapın."
```

- [ ] **Step 6: Build shared, run tests**

```bash
pnpm --filter @repo/shared build
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/billing packages/shared/src/i18n/resources
git commit -m "fix(billing): refuse checkout when Stripe already reports a subscription"
```

---

### Task 3: Plan change direction (pure)

The direction decides everything downstream: an upgrade is charged now, a downgrade is scheduled. Pure and unit-tested because it is the one part of the plan-change flow that can be.

**Files:**
- Create: `packages/shared/src/domain/billing/plan-change.ts`
- Create: `packages/shared/src/domain/billing/plan-change.spec.ts`
- Modify: `packages/shared/src/domain/billing/index.ts` (export)

**Interfaces:**
- Produces: `PlanChangeDirection` (`'upgrade' | 'downgrade'`), `resolvePlanChangeDirection(currentAmountMicros: number, targetAmountMicros: number): PlanChangeDirection`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/domain/billing/plan-change.spec.ts`:

```typescript
import { PlanChangeDirection, resolvePlanChangeDirection } from './plan-change';

describe('resolvePlanChangeDirection', () => {
  it('reports a higher price as an upgrade', () => {
    expect(resolvePlanChangeDirection(24_990_000, 29_990_000)).toBe(PlanChangeDirection.UPGRADE);
  });

  it('reports a lower price as a downgrade', () => {
    expect(resolvePlanChangeDirection(529_990_000, 19_990_000)).toBe(
      PlanChangeDirection.DOWNGRADE,
    );
  });

  it('treats an equal price as an upgrade, not as undefined behaviour', () => {
    // Impossible across twelve distinct tiers, but "apply immediately for $0"
    // is a defined outcome and "we did not decide" is not.
    expect(resolvePlanChangeDirection(29_990_000, 29_990_000)).toBe(PlanChangeDirection.UPGRADE);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @repo/shared test -- plan-change
```

Expected: FAIL — module not found. (If `@repo/shared` has no test script, run these specs from the API harness instead by placing them under `apps/api/src/modules/billing/`; check `packages/shared/package.json` first and follow whichever the repo already does.)

- [ ] **Step 3: Implement**

Create `packages/shared/src/domain/billing/plan-change.ts`:

```typescript
/**
 * Which way a plan change goes, and therefore how it is billed.
 *
 * Stripe subscriptions bill in ADVANCE, so an upgrade hands the seller the
 * higher quota immediately. Charging the prorated difference later would let a
 * Lite seller move to Enterprise on day 1, consume 25,000 listings and 800
 * conversions (~$80 of real Aquiline cost), and let the card fail before the
 * invoice arrives. Upgrades are therefore charged now.
 *
 * A downgrade is the mirror: the seller has already paid for the current
 * period, so they keep what they paid for until it ends.
 */
export enum PlanChangeDirection {
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
}

/**
 * Compare two plan prices in micro-units of the same currency.
 *
 * Equal prices resolve to UPGRADE — an immediate, $0 change — rather than
 * being left undefined. Twelve distinct tiers make it unreachable in practice;
 * defining it costs nothing and removes a branch nobody would have tested.
 */
export function resolvePlanChangeDirection(
  currentAmountMicros: number,
  targetAmountMicros: number,
): PlanChangeDirection {
  return targetAmountMicros >= currentAmountMicros
    ? PlanChangeDirection.UPGRADE
    : PlanChangeDirection.DOWNGRADE;
}
```

- [ ] **Step 4: Export it**

Add to `packages/shared/src/domain/billing/index.ts`:

```typescript
export * from './plan-change';
```

- [ ] **Step 5: Run the test**

```bash
pnpm --filter @repo/shared build && pnpm --filter api test -- plan-change
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/domain/billing
git commit -m "feat(billing): pure plan-change direction resolver"
```

---

### Task 4: Upgrades charge now; downgrades schedule to period end

**Files:**
- Modify: `apps/api/src/modules/billing/billing-provider.ts`
- Modify: `apps/api/src/modules/billing/billing.service.ts`
- Test: `apps/api/src/modules/billing/subscription-integrity.guard.spec.ts` (extend)

**Interfaces:**
- Consumes: `PlanChangeDirection`, `resolvePlanChangeDirection` (Task 3)
- Produces: `ChangePlanRequest` gains `direction: PlanChangeDirection`; `BillingProviderPort.scheduleDowngrade(req: ChangePlanRequest): Promise<void>`; `BillingProviderPort.cancelScheduledChange(providerSubscriptionId: string): Promise<void>`

- [ ] **Step 1: Extend the guard spec**

```typescript
describe('plan changes are billed by direction', () => {
  const provider = read('modules', 'billing', 'billing-provider.ts');
  const service = read('modules', 'billing', 'billing.service.ts');

  it('an upgrade charges immediately and rolls back if the card declines', () => {
    // create_prorations would hand over the quota now and bill up to 30 days
    // later — the abuse window the spec describes.
    expect(provider).toMatch(/proration_behavior:\s*'always_invoice'/);
    expect(provider).toMatch(/payment_behavior:\s*'error_if_incomplete'/);
  });

  it('a downgrade is scheduled rather than applied immediately', () => {
    expect(provider).toMatch(/async scheduleDowngrade\(/);
    expect(provider).toMatch(/subscriptionSchedules/);
  });

  it('the service picks the path from the shared direction resolver', () => {
    expect(service).toMatch(/resolvePlanChangeDirection\(/);
    expect(service).toMatch(/PlanChangeDirection\.DOWNGRADE/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter api test -- subscription-integrity.guard.spec
```

Expected: FAIL.

- [ ] **Step 3: Make the upgrade path prepaid**

In `apps/api/src/modules/billing/billing-provider.ts`, replace the body of `changeSubscriptionPlan`'s `subscriptions.update` call:

```typescript
      await stripe.subscriptions.update(req.providerSubscriptionId, {
        items: [{ id: itemId, price: req.providerPriceId }],
        // Stripe bills in ADVANCE, and an upgrade hands over the higher quota
        // the moment it applies. `always_invoice` charges the prorated
        // difference NOW rather than up to 30 days later, and
        // `error_if_incomplete` makes the whole update fail if that charge
        // cannot be completed — so a declined card leaves the seller on the
        // plan they were already paying for instead of on one they have not
        // paid for.
        proration_behavior: 'always_invoice',
        payment_behavior: 'error_if_incomplete',
        metadata: { plan_id: req.planId },
      });
```

- [ ] **Step 4: Add the downgrade schedule**

Add to `StripeBillingProvider`:

```typescript
  /**
   * Move a subscription to a cheaper price at the END of the paid period.
   *
   * The seller has already paid for this period, so they keep the plan they
   * paid for until it runs out. Applying it now would also strand a seller
   * with 24,000 active listings under a 200-listing ceiling, and would need a
   * credit balance we deliberately do not have.
   */
  async scheduleDowngrade(req: ChangePlanRequest): Promise<void> {
    const stripe = this.getClient();
    try {
      const current = await stripe.subscriptions.retrieve(req.providerSubscriptionId);
      const existingScheduleId =
        typeof current.schedule === 'string' ? current.schedule : current.schedule?.id;

      // Replace, never stack: only one pending change may exist.
      const schedule = existingScheduleId
        ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
        : await stripe.subscriptionSchedules.create({
            from_subscription: req.providerSubscriptionId,
          });

      const currentPhase = schedule.phases[0];
      if (!currentPhase) {
        throw new Error('billing.errors.planChangeFailed');
      }

      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release',
        phases: [
          {
            items: currentPhase.items.map((item) => ({
              price: typeof item.price === 'string' ? item.price : item.price.id,
              quantity: item.quantity ?? 1,
            })),
            start_date: currentPhase.start_date,
            end_date: currentPhase.end_date,
          },
          {
            items: [{ price: req.providerPriceId, quantity: 1 }],
            metadata: { plan_id: req.planId },
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Stripe downgrade schedule failed: ${describeError(error)}`);
      throw new Error('billing.errors.planChangeFailed');
    }
  }

  /** Release a pending downgrade, leaving the subscription as it is. */
  async cancelScheduledChange(providerSubscriptionId: string): Promise<void> {
    const stripe = this.getClient();
    try {
      const current = await stripe.subscriptions.retrieve(providerSubscriptionId);
      const scheduleId =
        typeof current.schedule === 'string' ? current.schedule : current.schedule?.id;
      if (!scheduleId) {
        return; // Nothing pending — treat as already done rather than an error.
      }
      await stripe.subscriptionSchedules.release(scheduleId);
    } catch (error) {
      this.logger.error(`Stripe schedule release failed: ${describeError(error)}`);
      throw new Error('billing.errors.planChangeFailed');
    }
  }
```

Declare both on `BillingProviderPort`, and add `direction: PlanChangeDirection` to `ChangePlanRequest`.

- [ ] **Step 5: Route by direction in the service**

In `apps/api/src/modules/billing/billing.service.ts`, in `changePlan`, after `price` is resolved:

```typescript
    const currentAmount = plan.prices[interval]?.amountMicros ?? 0;
    const currentPlan = subscription.planId
      ? await this.repository.loadPlanWithPricing(subscription.planId)
      : null;
    const direction = resolvePlanChangeDirection(
      currentPlan?.prices[interval]?.amountMicros ?? 0,
      currentAmount,
    );

    if (direction === PlanChangeDirection.DOWNGRADE) {
      // Takes effect at period end. No money moves now, and the local plan row
      // is deliberately NOT touched — the seller is still on the plan they
      // paid for until the schedule fires.
      await this.provider.scheduleDowngrade({
        providerSubscriptionId: subscription.providerSubscriptionId,
        providerPriceId: price.providerPriceId,
        planId,
        direction,
      });
      this.logger.log(`User ${userId} scheduled a downgrade to ${plan.slug}`);
      return;
    }

    // Upgrading cancels any pending downgrade. A seller who changes their mind
    // upward must not have a stale schedule fire a month later and silently
    // undo the change they just paid for. Best-effort: a subscription with no
    // schedule is the normal case and `cancelScheduledChange` already treats it
    // as a no-op, so a failure here must not block an upgrade the seller is
    // waiting on.
    try {
      await this.provider.cancelScheduledChange(subscription.providerSubscriptionId);
    } catch (err) {
      this.logger.warn(
        `Could not release a pending schedule before upgrading ${userId}: ${(err as Error).message}`,
      );
    }

    await this.provider.changeSubscriptionPlan({
      providerSubscriptionId: subscription.providerSubscriptionId,
      providerPriceId: price.providerPriceId,
      planId,
      direction,
    });
```

Keep the existing local `updateSubscriptionPlan` write on the upgrade branch only.

Add the matching guard assertion to `subscription-integrity.guard.spec.ts`:

```typescript
  it('an upgrade releases any pending downgrade first', () => {
    // Otherwise a stale schedule fires a month later and undoes the upgrade
    // the seller just paid for.
    const body = service.slice(service.indexOf('async changePlan('));
    expect(body).toMatch(/cancelScheduledChange\(/);
  });
```

- [ ] **Step 6: Run the suite**

```bash
pnpm --filter api test && pnpm --filter api exec tsc --noEmit -p tsconfig.json
```

Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/billing
git commit -m "feat(billing): upgrades charge immediately, downgrades schedule to period end"
```

---

### Task 5: Plan change preview endpoint

**Files:**
- Modify: `packages/shared/src/domain/billing/billing.wire.ts`
- Modify: `apps/api/src/modules/billing/billing-provider.ts`
- Modify: `apps/api/src/modules/billing/billing.service.ts`
- Modify: `apps/api/src/modules/billing/billing.controller.ts`

**Interfaces:**
- Produces: `BillingPlanChangePreviewDto`; `POST /billing/plan-change/preview`

- [ ] **Step 1: Add the DTO**

In `packages/shared/src/domain/billing/billing.wire.ts`:

```typescript
/**
 * What a plan change will actually cost, from Stripe's own arithmetic.
 *
 * Not an estimate we computed: it comes from `invoices.createPreview`, so it
 * carries tax, discounts and proration exactly as they will be billed.
 */
export interface BillingPlanChangePreviewDto {
  direction: PlanChangeDirection;
  /** Charged immediately for an upgrade; 0 for a downgrade (nothing moves now). */
  amountDueMicros: number;
  currency: string;
  /** ISO date the change takes effect — now for an upgrade, period end for a
   *  downgrade. */
  effectiveAt: string;
  /** The recurring amount from the next full period onward. */
  nextInvoiceAmountMicros: number | null;
  nextInvoiceAt: string | null;
}
```

- [ ] **Step 2: Add the provider method**

```typescript
  async previewPlanChange(
    providerSubscriptionId: string,
    providerPriceId: string,
  ): Promise<{ amountDueMicros: number; currency: string }> {
    const stripe = this.getClient();
    const current = await stripe.subscriptions.retrieve(providerSubscriptionId);
    const itemId = current.items.data[0]?.id;
    if (!itemId) {
      throw new Error('billing.errors.planChangeFailed');
    }
    const preview = await stripe.invoices.createPreview({
      customer: typeof current.customer === 'string' ? current.customer : current.customer.id,
      subscription: providerSubscriptionId,
      subscription_details: {
        items: [{ id: itemId, price: providerPriceId }],
        proration_behavior: 'always_invoice',
      },
    });
    // Stripe amounts are minor units (cents); our DTOs are micro-units.
    return {
      amountDueMicros: preview.amount_due * 10_000,
      currency: preview.currency.toUpperCase(),
    };
  }
```

- [ ] **Step 3: Add the service method**

In `billing.service.ts`:

```typescript
  /**
   * What will this plan change cost? Answered before anything is applied.
   *
   * A downgrade returns 0 due now: it takes effect at period end and moves no
   * money today. Returning the preview's proration figure there would tell the
   * seller they are about to be charged for a change that costs nothing now.
   */
  async previewPlanChange(
    userId: string,
    planId: string,
    interval: BillingInterval,
  ): Promise<BillingPlanChangePreviewDto> {
    const subscription = await this.repository.findCurrentSubscription(userId);
    if (!subscription?.providerSubscriptionId) {
      throw new Error('billing.errors.noSubscription');
    }
    const plan = await this.repository.loadPlanWithPricing(planId);
    const price = plan?.prices[interval];
    if (!plan || !price?.providerPriceId) {
      throw new Error('billing.errors.planNotMirrored');
    }
    const currentPlan = await this.repository.loadPlanWithPricing(subscription.planId);
    const direction = resolvePlanChangeDirection(
      currentPlan?.prices[interval]?.amountMicros ?? 0,
      price.amountMicros,
    );

    if (direction === PlanChangeDirection.DOWNGRADE) {
      return {
        direction,
        amountDueMicros: 0,
        currency: price.currency,
        effectiveAt: subscription.currentPeriodEnd,
        nextInvoiceAmountMicros: price.amountMicros,
        nextInvoiceAt: subscription.currentPeriodEnd,
      };
    }

    const preview = await this.provider.previewPlanChange(
      subscription.providerSubscriptionId,
      price.providerPriceId,
    );
    return {
      direction,
      amountDueMicros: preview.amountDueMicros,
      currency: preview.currency,
      effectiveAt: new Date().toISOString(),
      nextInvoiceAmountMicros: price.amountMicros,
      nextInvoiceAt: subscription.currentPeriodEnd,
    };
  }
```

- [ ] **Step 4: Add the endpoint**

In `billing.controller.ts`:

```typescript
  @Post('plan-change/preview')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'What a plan change will cost, before applying it' })
  async previewPlanChange(
    @Req() req: { user: { sub: string } },
    @Body() dto: SubscribeDto,
  ): Promise<BillingPlanChangePreviewDto> {
    try {
      return await this.billingService.previewPlanChange(req.user.sub, dto.planId, dto.interval);
    } catch (error) {
      rethrowBillingError(error);
    }
  }
```

- [ ] **Step 5: Build, typecheck, test**

```bash
pnpm --filter @repo/shared build && pnpm --filter api exec tsc --noEmit -p tsconfig.json && pnpm --filter api test
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared apps/api/src/modules/billing
git commit -m "feat(billing): plan change preview endpoint"
```

---

### Task 6: Cancel a scheduled downgrade

**Files:**
- Modify: `apps/api/src/modules/billing/billing.service.ts`
- Modify: `apps/api/src/modules/billing/billing.controller.ts`

**Interfaces:**
- Consumes: `BillingProviderPort.cancelScheduledChange` (Task 4)
- Produces: `DELETE /billing/scheduled-change`

- [ ] **Step 1: Service method**

```typescript
  /** Release a pending downgrade. The seller stays on their current plan. */
  async cancelScheduledChange(userId: string): Promise<void> {
    const subscription = await this.repository.findCurrentSubscription(userId);
    if (!subscription?.providerSubscriptionId) {
      throw new Error('billing.errors.noSubscription');
    }
    await this.provider.cancelScheduledChange(subscription.providerSubscriptionId);
    this.logger.log(`User ${userId} cancelled their scheduled plan change`);
  }
```

- [ ] **Step 2: Endpoint**

```typescript
  @Delete('scheduled-change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a pending downgrade' })
  async cancelScheduledChange(
    @Req() req: { user: { sub: string } },
  ): Promise<{ ok: true }> {
    try {
      await this.billingService.cancelScheduledChange(req.user.sub);
      return { ok: true };
    } catch (error) {
      rethrowBillingError(error);
    }
  }
```

Import `Delete` from `@nestjs/common`.

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm --filter api exec tsc --noEmit -p tsconfig.json
git add apps/api/src/modules/billing
git commit -m "feat(billing): cancel a scheduled downgrade"
```

---

### Task 7: Billing details endpoint — card, next charge, pending change

**Files:**
- Create: `apps/api/src/modules/billing/payment-method-helpers.ts`
- Create: `apps/api/src/modules/billing/payment-method-helpers.spec.ts`
- Modify: `packages/shared/src/domain/billing/billing.wire.ts`
- Modify: `apps/api/src/modules/billing/billing-provider.ts`
- Modify: `apps/api/src/modules/billing/billing.service.ts`
- Modify: `apps/api/src/modules/billing/billing.controller.ts`

**Interfaces:**
- Produces: `BillingPaymentMethodDto`, `BillingScheduledChangeDto`, `BillingDetailsDto`; `isCardExpiringSoon(expMonth, expYear, now, withinDays?): boolean`; `GET /billing/details`

- [ ] **Step 1: Write the failing helper test**

Create `apps/api/src/modules/billing/payment-method-helpers.spec.ts`:

```typescript
import { isCardExpiringSoon } from './payment-method-helpers';

describe('isCardExpiringSoon', () => {
  // A card expires at the END of its month, so 08/2026 is good through 31 Aug.
  it('flags a card expiring inside the window', () => {
    expect(isCardExpiringSoon(9, 2026, new Date('2026-08-22T00:00:00Z'))).toBe(true);
  });

  it('does not flag a card well outside the window', () => {
    expect(isCardExpiringSoon(12, 2034, new Date('2026-08-22T00:00:00Z'))).toBe(false);
  });

  it('flags a card that has already expired', () => {
    // Already dead is more urgent than about to die, never less.
    expect(isCardExpiringSoon(7, 2026, new Date('2026-08-22T00:00:00Z'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm --filter api test -- payment-method-helpers
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```typescript
// apps/api/src/modules/billing/payment-method-helpers.ts

/** Warn this many days ahead by default. Long enough for a seller to act
 *  before a renewal fails, short enough not to nag for a year. */
export const CARD_EXPIRY_WARNING_DAYS = 60;

/**
 * Is this card at or near its expiry?
 *
 * A card is valid through the LAST day of its expiry month, so the deadline is
 * the first instant of the following month. An already-expired card returns
 * true: it is strictly more urgent, and reporting it as fine would hide the
 * one case that is certain to fail.
 */
export function isCardExpiringSoon(
  expMonth: number,
  expYear: number,
  now: Date,
  withinDays: number = CARD_EXPIRY_WARNING_DAYS,
): boolean {
  const expiresAt = Date.UTC(expYear, expMonth, 1);
  const threshold = now.getTime() + withinDays * 24 * 60 * 60 * 1000;
  return expiresAt <= threshold;
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter api test -- payment-method-helpers
```

Expected: PASS.

- [ ] **Step 5: Add the DTOs**

In `billing.wire.ts`:

```typescript
/** The card Stripe actually charges — the customer's DEFAULT payment method,
 *  never an arbitrary one from the attached list. */
export interface BillingPaymentMethodDto {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  /** True within CARD_EXPIRY_WARNING_DAYS of expiry, or already expired. */
  expiringSoon: boolean;
}

/** A downgrade waiting for the current period to end. */
export interface BillingScheduledChangeDto {
  planSlug: string;
  effectiveAt: string;
}

/**
 * Live-from-Stripe billing detail. Deliberately NOT part of
 * BillingSummaryDto: AppLayout calls the summary on every page load, and
 * provider latency does not belong on that path.
 *
 * Every field is nullable because each is independently unavailable — a
 * trialing seller has no card and no upcoming invoice, and that is normal, not
 * an error.
 */
export interface BillingDetailsDto {
  paymentMethod: BillingPaymentMethodDto | null;
  nextChargeAmountMicros: number | null;
  nextChargeCurrency: string | null;
  nextChargeAt: string | null;
  scheduledChange: BillingScheduledChangeDto | null;
}
```

- [ ] **Step 6: Add the provider method**

```typescript
  async getBillingDetails(providerCustomerId: string): Promise<{
    paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
    nextChargeAmountMicros: number | null;
    nextChargeCurrency: string | null;
    nextChargeAt: string | null;
    scheduledPriceId: string | null;
    scheduledAt: string | null;
  }> {
    const stripe = this.getClient();
    const customer = await stripe.customers.retrieve(providerCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    if (customer.deleted) {
      return {
        paymentMethod: null,
        nextChargeAmountMicros: null,
        nextChargeCurrency: null,
        nextChargeAt: null,
        scheduledPriceId: null,
        scheduledAt: null,
      };
    }

    // The DEFAULT method, not the first attached one. Several cards can be
    // attached (each Checkout run adds one); showing the wrong one puts a
    // false number on the screen whose whole purpose is being right.
    const pm = customer.invoice_settings?.default_payment_method;
    const card = pm && typeof pm !== 'string' ? pm.card : null;

    let nextChargeAmountMicros: number | null = null;
    let nextChargeCurrency: string | null = null;
    let nextChargeAt: string | null = null;
    try {
      const upcoming = await stripe.invoices.createPreview({ customer: providerCustomerId });
      nextChargeAmountMicros = upcoming.amount_due * 10_000;
      nextChargeCurrency = upcoming.currency.toUpperCase();
      nextChargeAt = upcoming.next_payment_attempt
        ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
        : null;
    } catch {
      // No upcoming invoice (no subscription yet) is a normal state, not a
      // failure. Leaving these null makes the FE render an em dash.
    }

    const subs = await stripe.subscriptions.list({ customer: providerCustomerId, limit: 1 });
    const scheduleId =
      typeof subs.data[0]?.schedule === 'string'
        ? subs.data[0].schedule
        : subs.data[0]?.schedule?.id ?? null;
    let scheduledPriceId: string | null = null;
    let scheduledAt: string | null = null;
    if (scheduleId) {
      const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
      const pending = schedule.phases[1];
      const priceRef = pending?.items[0]?.price;
      scheduledPriceId = typeof priceRef === 'string' ? priceRef : priceRef?.id ?? null;
      scheduledAt = pending?.start_date
        ? new Date(pending.start_date * 1000).toISOString()
        : null;
    }

    return {
      paymentMethod: card
        ? {
            brand: card.brand,
            last4: card.last4,
            expMonth: card.exp_month,
            expYear: card.exp_year,
          }
        : null,
      nextChargeAmountMicros,
      nextChargeCurrency,
      nextChargeAt,
      scheduledPriceId,
      scheduledAt,
    };
  }
```

Declare it on `BillingProviderPort`.

- [ ] **Step 7: Service + endpoint**

In `billing.service.ts`:

```typescript
  /**
   * Live billing detail for the billing page only.
   *
   * Fails soft to an all-null shape: a Stripe hiccup must leave the plan card
   * and the quota rings on screen, not blank the page a suspended seller was
   * just redirected to.
   */
  async getDetails(userId: string): Promise<BillingDetailsDto> {
    const empty: BillingDetailsDto = {
      paymentMethod: null,
      nextChargeAmountMicros: null,
      nextChargeCurrency: null,
      nextChargeAt: null,
      scheduledChange: null,
    };
    const customer = await this.repository.findCustomerByUserId(userId);
    if (!customer?.providerCustomerId || !this.provider.isConfigured()) {
      return empty;
    }
    try {
      const raw = await this.provider.getBillingDetails(customer.providerCustomerId);
      const scheduledPlan = raw.scheduledPriceId
        ? await this.repository.findPlanByProviderPriceId(raw.scheduledPriceId)
        : null;
      return {
        paymentMethod: raw.paymentMethod
          ? {
              ...raw.paymentMethod,
              expiringSoon: isCardExpiringSoon(
                raw.paymentMethod.expMonth,
                raw.paymentMethod.expYear,
                new Date(),
              ),
            }
          : null,
        nextChargeAmountMicros: raw.nextChargeAmountMicros,
        nextChargeCurrency: raw.nextChargeCurrency,
        nextChargeAt: raw.nextChargeAt,
        scheduledChange:
          scheduledPlan && raw.scheduledAt
            ? { planSlug: scheduledPlan.slug, effectiveAt: raw.scheduledAt }
            : null,
      };
    } catch (err) {
      this.logger.warn(`Billing details unavailable for ${userId}: ${(err as Error).message}`);
      return empty;
    }
  }
```

Add `findPlanByProviderPriceId(providerPriceId: string): Promise<{ slug: string } | null>` to the repository:

```typescript
  async findPlanByProviderPriceId(providerPriceId: string): Promise<{ slug: string } | null> {
    const rows = await this.databaseService.query<{ slug: string }>(
      `SELECT p.slug FROM billing_plans p
         JOIN billing_plan_prices pr ON pr.plan_id = p.id
        WHERE pr.provider_price_id = $1
        LIMIT 1`,
      [providerPriceId],
    );
    return rows[0] ?? null;
  }
```

Controller:

```typescript
  @Get('details')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Live card, next charge and pending plan change' })
  async getDetails(@Req() req: { user: { sub: string } }): Promise<BillingDetailsDto> {
    return this.billingService.getDetails(req.user.sub);
  }
```

- [ ] **Step 8: Build, typecheck, test, commit**

```bash
pnpm --filter @repo/shared build && pnpm --filter api exec tsc --noEmit -p tsconfig.json && pnpm --filter api test
git add packages/shared apps/api/src/modules/billing
git commit -m "feat(billing): live details endpoint (card, next charge, pending change)"
```

---

### Task 8: Invoice list endpoint

**Files:**
- Create: `apps/api/src/modules/billing/stripe-invoice-mapper.ts`
- Create: `apps/api/src/modules/billing/stripe-invoice-mapper.spec.ts`
- Modify: `packages/shared/src/domain/billing/billing.wire.ts`
- Modify: `apps/api/src/modules/billing/billing-provider.ts`, `billing.service.ts`, `billing.controller.ts`

**Interfaces:**
- Produces: `BillingInvoiceDto`, `BillingInvoiceListDto`; `mapStripeInvoice(raw): BillingInvoiceDto`; `GET /billing/invoices?limit&startingAfter`

- [ ] **Step 1: Write the failing mapper test**

```typescript
import { mapStripeInvoice } from './stripe-invoice-mapper';

describe('mapStripeInvoice', () => {
  const base = {
    id: 'in_1',
    created: 1_755_000_000,
    currency: 'try',
    amount_paid: 124_843,
    amount_due: 124_843,
    status: 'paid',
    hosted_invoice_url: 'https://pay.stripe.com/x',
    invoice_pdf: 'https://pay.stripe.com/x.pdf',
    lines: { data: [{ description: 'Nano plan' }] },
  };

  it('reports the currency actually charged, not an assumed USD', () => {
    // Adaptive Pricing bills a Turkish seller in TRY; assuming USD would
    // misreport what left their account.
    expect(mapStripeInvoice(base).currency).toBe('TRY');
  });

  it('converts minor units to micro-units', () => {
    expect(mapStripeInvoice(base).amountMicros).toBe(1_248_430_000);
  });

  it('takes the description from the first line item', () => {
    expect(mapStripeInvoice(base).description).toBe('Nano plan');
  });

  it('reports amount_due for an unpaid invoice, not amount_paid', () => {
    // An open invoice has amount_paid 0; showing that would tell a suspended
    // seller they owe nothing.
    const open = { ...base, status: 'open', amount_paid: 0, amount_due: 2_999 };
    expect(mapStripeInvoice(open).amountMicros).toBe(29_990_000);
  });

  it('carries a null description rather than inventing one', () => {
    expect(mapStripeInvoice({ ...base, lines: { data: [] } }).description).toBeNull();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm --filter api test -- stripe-invoice-mapper
```

- [ ] **Step 3: Add the DTOs**

```typescript
/** One invoice as the seller sees it. Amounts are micro-units of `currency`. */
export interface BillingInvoiceDto {
  id: string;
  /** ISO timestamp the invoice was created. */
  issuedAt: string;
  /** Line-item description ("Growth plan", "100 conversions pack"), or null —
   *  never a fabricated label. */
  description: string | null;
  amountMicros: number;
  /** The currency ACTUALLY charged. Adaptive Pricing means this is often not USD. */
  currency: string;
  status: string;
  /** Stripe-hosted payment page. Present on an unpaid invoice — the one-click
   *  way a suspended seller clears their debt. */
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface BillingInvoiceListDto {
  items: BillingInvoiceDto[];
  hasMore: boolean;
  /** Cursor for the next page — pass back as `startingAfter`. */
  nextCursor: string | null;
}
```

- [ ] **Step 4: Implement the mapper**

```typescript
// apps/api/src/modules/billing/stripe-invoice-mapper.ts
import type { BillingInvoiceDto } from '@repo/shared';

/** Minimal shape we read off a Stripe invoice. Structural rather than the SDK
 *  type so this stays a pure function the Jest harness can cover. */
export interface StripeInvoiceLike {
  id: string;
  created: number;
  currency: string;
  amount_paid: number;
  amount_due: number;
  status: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  lines?: { data: Array<{ description?: string | null }> };
}

/**
 * Stripe invoice → the DTO the billing page renders.
 *
 * Two rules matter here. The currency is whatever Stripe charged — Adaptive
 * Pricing bills a Turkish seller in TRY, and defaulting to USD would misreport
 * what left their account. And an unpaid invoice reports `amount_due`, not
 * `amount_paid`: the latter is 0 on an open invoice, which would tell a
 * suspended seller they owe nothing.
 */
export function mapStripeInvoice(raw: StripeInvoiceLike): BillingInvoiceDto {
  const minorUnits = raw.status === 'paid' ? raw.amount_paid : raw.amount_due;
  return {
    id: raw.id,
    issuedAt: new Date(raw.created * 1000).toISOString(),
    description: raw.lines?.data[0]?.description ?? null,
    amountMicros: minorUnits * 10_000,
    currency: raw.currency.toUpperCase(),
    status: raw.status ?? 'unknown',
    hostedUrl: raw.hosted_invoice_url ?? null,
    pdfUrl: raw.invoice_pdf ?? null,
  };
}
```

- [ ] **Step 5: Provider, service, endpoint**

Provider:

```typescript
  async listInvoices(
    providerCustomerId: string,
    limit: number,
    startingAfter?: string,
  ): Promise<{ items: BillingInvoiceDto[]; hasMore: boolean; nextCursor: string | null }> {
    const stripe = this.getClient();
    const page = await stripe.invoices.list({
      customer: providerCustomerId,
      limit,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const items = page.data.map((inv) => mapStripeInvoice(inv as unknown as StripeInvoiceLike));
    return {
      items,
      hasMore: page.has_more,
      nextCursor: page.has_more ? items[items.length - 1]?.id ?? null : null,
    };
  }
```

Service — throws rather than failing soft, because the FE renders a retry state for this card specifically:

```typescript
  async listInvoices(
    userId: string,
    limit = 10,
    startingAfter?: string,
  ): Promise<BillingInvoiceListDto> {
    const customer = await this.repository.findCustomerByUserId(userId);
    if (!customer?.providerCustomerId || !this.provider.isConfigured()) {
      return { items: [], hasMore: false, nextCursor: null };
    }
    return this.provider.listInvoices(
      customer.providerCustomerId,
      Math.min(Math.max(limit, 1), 50),
      startingAfter,
    );
  }
```

Controller:

```typescript
  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Paginated invoice history, read live from Stripe' })
  async listInvoices(
    @Req() req: { user: { sub: string } },
    @Query('limit') limit?: string,
    @Query('startingAfter') startingAfter?: string,
  ): Promise<BillingInvoiceListDto> {
    try {
      return await this.billingService.listInvoices(
        req.user.sub,
        limit ? Number(limit) : undefined,
        startingAfter,
      );
    } catch (error) {
      rethrowBillingError(error);
    }
  }
```

Import `Query` from `@nestjs/common`.

- [ ] **Step 6: Test, typecheck, commit**

```bash
pnpm --filter @repo/shared build && pnpm --filter api test && pnpm --filter api exec tsc --noEmit -p tsconfig.json
git add packages/shared apps/api/src/modules/billing
git commit -m "feat(billing): invoice history endpoint"
```

---

### Task 9: Promotion codes and top-up invoices

**Files:**
- Modify: `apps/api/src/modules/billing/billing-provider.ts`

- [ ] **Step 1: Enable promotion codes on the subscription checkout**

In `createCheckout`'s session params:

```typescript
        // Checkout renders its own "Add promotion code" field. Coupons live in
        // the Stripe Dashboard — no local coupon model, no admin surface.
        allow_promotion_codes: true,
```

- [ ] **Step 2: Make top-ups produce invoices**

In `createAddonCheckout`'s session params:

```typescript
        // `mode: 'payment'` creates NO invoice by default, so without this a
        // top-up purchase would be missing from the invoice history — and
        // "what did I pay for" has to mean everything or it means nothing.
        invoice_creation: { enabled: true },
```

Deliberately no `allow_promotion_codes` here: a discount on a consumable priced against a hard ~$0.10/conversion unit cost erodes a thin margin with no acquisition benefit.

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm --filter api exec tsc --noEmit -p tsconfig.json
git add apps/api/src/modules/billing/billing-provider.ts
git commit -m "feat(billing): promotion codes on checkout, invoices for top-ups"
```

---

### Task 10: Frontend API layer

**Files:**
- Modify: `apps/web/src/features/billing/api/billing.api.ts`

**Interfaces:**
- Produces: `useGetBillingDetailsQuery`, `useGetBillingInvoicesQuery`, `usePreviewPlanChangeMutation`, `useCancelScheduledChangeMutation`

- [ ] **Step 1: Add the endpoints**

```typescript
    /** Live-from-Stripe detail. Separate from the summary because AppLayout
     *  calls the summary on every page load and must not pay provider latency. */
    getBillingDetails: builder.query<BillingDetailsDto, void>({
      query: () => ({ url: '/billing/details' }),
      providesTags: [{ type: 'Billing', id: 'DETAILS' }],
    }),

    getBillingInvoices: builder.query<BillingInvoiceListDto, { startingAfter?: string } | void>({
      query: (args) => ({
        url: '/billing/invoices',
        params: args?.startingAfter ? { startingAfter: args.startingAfter } : undefined,
      }),
      providesTags: [{ type: 'Billing', id: 'INVOICES' }],
    }),

    previewPlanChange: builder.mutation<BillingPlanChangePreviewDto, CheckoutRequestBody>({
      query: (body) => ({ url: '/billing/plan-change/preview', method: 'POST', body }),
    }),

    cancelScheduledChange: builder.mutation<{ ok: true }, void>({
      query: () => ({ url: '/billing/scheduled-change', method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Billing', id: 'SUMMARY' },
        { type: 'Billing', id: 'DETAILS' },
      ],
    }),
```

Extend `changePlan`'s and `initiateCheckout`'s `invalidatesTags` to include `DETAILS` and `INVOICES`, so a completed change refreshes every card.

- [ ] **Step 2: Resync on `alreadySubscribed`**

A 409 `billing.errors.alreadySubscribed` means our summary disagreed with
Stripe — the exact condition that produced three live subscriptions. In
`BillingPage.container.tsx`, `surfaceBillingError` must refetch the summary in
that one case so the two come back into agreement, and must NOT silently retry
the checkout:

```typescript
  const surfaceBillingError = useCallback(
    (error: Parameters<typeof getErrorI18nKey>[0]) => {
      const key = getErrorI18nKey(error);
      if (key === 'billing.errors.alreadySubscribed') {
        // Our summary was stale — that staleness is what let one seller end up
        // with three subscriptions. Pull the truth again so the page stops
        // offering checkout; never auto-retry, which is what would create the
        // duplicate.
        void refetchSummary();
      }
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: `billing:${key}`,
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        t,
      );
    },
    [refetchSummary, showMessage, closeMessage, t],
  );
```

Take `refetchSummary` from the existing `useGetBillingSummaryQuery` result
(`const { data: summary, refetch: refetchSummary } = useGetBillingSummaryQuery();`).

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm --filter web exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i billing
git add apps/web/src/features/billing/api/billing.api.ts
git commit -m "feat(billing): frontend endpoints for details, invoices and preview"
```

---

### Task 11: Subscription card — next charge and pending change

**Files:**
- Modify: `apps/web/src/features/billing/BillingPage/BillingPage.{container.tsx,component.tsx,types.ts,style.ts}`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/billing.json`

- [ ] **Step 1: Add the copy (both locales)**

EN, under `billing.subscription`:

```json
"nextCharge": "Next payment: {{date}} · {{amount}}",
"scheduledChange": "Switches to {{plan}} on {{date}}",
"cancelScheduledChange": "Cancel",
"scheduledChangeCancelled": "Your plan change has been cancelled."
```

TR:

```json
"nextCharge": "Bir sonraki ödeme: {{date}} · {{amount}}",
"scheduledChange": "{{date}} tarihinde {{plan}} paketine geçecek",
"cancelScheduledChange": "Vazgeç",
"scheduledChangeCancelled": "Plan değişikliğiniz iptal edildi."
```

- [ ] **Step 2: Container — fetch details, expose the two new values**

In `BillingPage.container.tsx`:

```typescript
  const { data: details } = useGetBillingDetailsQuery();
  const [cancelScheduledChange, { isLoading: isCancellingChange }] =
    useCancelScheduledChangeMutation();

  // A trialing seller has no upcoming invoice; the existing trial-end meta line
  // stands in for this, so render nothing rather than an em dash beside a label.
  const nextChargeLine = useMemo(() => {
    if (details?.nextChargeAmountMicros == null || !details.nextChargeAt) {
      return null;
    }
    return t('billing:billing.subscription.nextCharge', {
      date: formatDate(details.nextChargeAt, localeCfg.locale),
      amount: formatMicroCurrency(
        details.nextChargeAmountMicros,
        details.nextChargeCurrency ?? 'USD',
        localeCfg.locale,
      ),
    });
  }, [details, t, localeCfg.locale]);

  const scheduledChangeLine = useMemo(() => {
    if (!details?.scheduledChange) {
      return null;
    }
    return t('billing:billing.subscription.scheduledChange', {
      plan: t(`billing:billing.plans.${details.scheduledChange.planSlug}.name`),
      date: formatDate(details.scheduledChange.effectiveAt, localeCfg.locale),
    });
  }, [details, t, localeCfg.locale]);

  const handleCancelScheduledChange = useCallback(() => {
    void cancelScheduledChange()
      .unwrap()
      .then(() => {
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'billing:billing.subscription.scheduledChangeCancelled',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t,
        );
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => surfaceBillingError(error));
  }, [cancelScheduledChange, showMessage, closeMessage, t, surfaceBillingError]);
```

Pass `nextChargeLine`, `scheduledChangeLine`, `onCancelScheduledChange`, `isCancellingChange` to the component and add them to `BillingPageProps` in `.types.ts`.

- [ ] **Step 3: Style**

In `BillingPage.style.ts`:

```typescript
/** Pending-downgrade row: the copy on the left, Cancel on the right. */
export const ScheduledChangeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
  width: 100%;
  margin-top: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.semanticTint.infoStrong')};
`;
```

- [ ] **Step 4: Component — render both**

Inside `<S.PlanNameStack>`, after the existing meta row:

```tsx
            {nextChargeLine ? (
              <Text variant="body-sm" color="text.secondary" numeric>
                {nextChargeLine}
              </Text>
            ) : null}
```

And after `</S.PlanHeaderRow>`:

```tsx
        {scheduledChangeLine ? (
          <S.ScheduledChangeRow>
            <Text variant="body-sm">{scheduledChangeLine}</Text>
            <Button
              variant="secondary"
              size="small"
              isLoading={isCancellingChange}
              onClick={onCancelScheduledChange}
            >
              <Text variant="body-sm">
                {t('billing:billing.subscription.cancelScheduledChange')}
              </Text>
            </Button>
          </S.ScheduledChangeRow>
        ) : null}
```

- [ ] **Step 5: Build, lint, typecheck, commit**

```bash
pnpm --filter @repo/shared build
cd apps/web && pnpm exec eslint src/features/billing && pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i billing
git add packages/shared apps/web/src/features/billing
git commit -m "feat(billing): show next charge amount and pending plan change"
```

---

### Task 12: Payment method card

**Files:**
- Create: `apps/web/src/features/billing/components/PaymentMethodCard/{PaymentMethodCard.component.tsx,PaymentMethodCard.style.ts,PaymentMethodCard.types.ts,index.ts}`
- Modify: `BillingPage.component.tsx`, `BillingPage.container.tsx`, `BillingPage.types.ts`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/billing.json`

Stateless (all data arrives as props), so it needs no `.container.tsx` — matching the Button/Badge convention for stateless components.

- [ ] **Step 1: Copy (both locales)**

EN, under `billing`:

```json
"paymentMethod": {
  "title": "Payment method",
  "card": "{{brand}} •••• {{last4}}",
  "expires": "Expires {{month}}/{{year}}",
  "expiringSoon": "This card expires soon. Update it to avoid a failed renewal.",
  "change": "Change"
}
```

TR:

```json
"paymentMethod": {
  "title": "Ödeme yöntemi",
  "card": "{{brand}} •••• {{last4}}",
  "expires": "{{month}}/{{year}} tarihinde doluyor",
  "expiringSoon": "Bu kartın süresi yakında doluyor. Yenilemenin başarısız olmaması için güncelleyin.",
  "change": "Değiştir"
}
```

- [ ] **Step 2: Types**

```typescript
// PaymentMethodCard.types.ts
import type { BillingPaymentMethodDto } from '@repo/shared';

export interface PaymentMethodCardProps {
  paymentMethod: BillingPaymentMethodDto;
  onChange: () => void;
  isChangeLoading: boolean;
}
```

- [ ] **Step 3: Style**

```typescript
// PaymentMethodCard.style.ts
import styled from '@emotion/styled';
import { SettingsCard, tkn } from '@repo/ui';

export const Card = styled(SettingsCard)`
  width: 100%;
  max-width: 40rem;
  align-self: flex-start;
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

export const CardIdentity = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;
```

- [ ] **Step 4: Component**

```tsx
// PaymentMethodCard.component.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, InfoMessage, Text } from '@repo/ui';

import * as S from './PaymentMethodCard.style';
import type { PaymentMethodCardProps } from './PaymentMethodCard.types';

export const PaymentMethodCard = ({
  paymentMethod,
  onChange,
  isChangeLoading,
}: PaymentMethodCardProps): React.ReactElement => {
  const { t } = useTranslation(['billing', 'translation']);
  return (
    <S.Card variant="section" header={{ title: t('billing:billing.paymentMethod.title') }}>
      <S.Row>
        <S.CardIdentity>
          <Text variant="body" weight="semibold">
            {t('billing:billing.paymentMethod.card', {
              brand: paymentMethod.brand.toUpperCase(),
              last4: paymentMethod.last4,
            })}
          </Text>
          <Text variant="body-sm" color="text.secondary" numeric>
            {t('billing:billing.paymentMethod.expires', {
              month: String(paymentMethod.expMonth).padStart(2, '0'),
              year: paymentMethod.expYear,
            })}
          </Text>
        </S.CardIdentity>
        <Button variant="secondary" size="small" isLoading={isChangeLoading} onClick={onChange}>
          <Text variant="body-sm">{t('billing:billing.paymentMethod.change')}</Text>
        </Button>
      </S.Row>
      {paymentMethod.expiringSoon ? (
        <InfoMessage>{t('billing:billing.paymentMethod.expiringSoon')}</InfoMessage>
      ) : null}
    </S.Card>
  );
};

PaymentMethodCard.displayName = 'PaymentMethodCard';
```

- [ ] **Step 5: Mount it**

In `BillingPage.component.tsx`, after `</S.SubscriptionCard>`:

```tsx
      {paymentMethod ? (
        <PaymentMethodCard
          paymentMethod={paymentMethod}
          onChange={onManage}
          isChangeLoading={isPortalLoading}
        />
      ) : null}
```

Pass `paymentMethod={details?.paymentMethod ?? null}` from the container. A trialing seller has no Stripe customer, so nothing renders — which is correct, not an empty state.

- [ ] **Step 6: Build, lint, typecheck, commit**

```bash
pnpm --filter @repo/shared build
cd apps/web && pnpm exec eslint src/features/billing && pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i billing
git add packages/shared apps/web/src/features/billing
git commit -m "feat(billing): payment method card"
```

---

### Task 13: Invoice history card

**Files:**
- Create: `apps/web/src/features/billing/components/InvoiceHistoryCard/{InvoiceHistoryCard.component.tsx,InvoiceHistoryCard.container.tsx,InvoiceHistoryCard.style.ts,InvoiceHistoryCard.types.ts,index.ts}`
- Modify: `BillingPage.component.tsx`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/billing.json`

Stateful (owns its own paging cursor and query), so it gets the full 4-file split.

- [ ] **Step 1: Copy (both locales)**

EN:

```json
"invoices": {
  "title": "Invoice history",
  "subtitle": "Everything you have paid, straight from Stripe.",
  "date": "Date",
  "description": "Description",
  "amount": "Amount",
  "status": "Status",
  "pdf": "PDF",
  "download": "Download",
  "payNow": "Pay now",
  "empty": "No invoices yet.",
  "loading": "Loading invoices…",
  "error": "Invoices could not be loaded.",
  "retry": "Try again",
  "showMore": "Show more"
}
```

TR:

```json
"invoices": {
  "title": "Fatura geçmişi",
  "subtitle": "Ödediğiniz her şey, doğrudan Stripe'tan.",
  "date": "Tarih",
  "description": "Açıklama",
  "amount": "Tutar",
  "status": "Durum",
  "pdf": "PDF",
  "download": "İndir",
  "payNow": "Şimdi öde",
  "empty": "Henüz faturanız yok.",
  "loading": "Faturalar yükleniyor…",
  "error": "Faturalar yüklenemedi.",
  "retry": "Tekrar dene",
  "showMore": "Daha fazla göster"
}
```

- [ ] **Step 2: Container**

```tsx
// InvoiceHistoryCard.container.tsx
import React, { useCallback, useState } from 'react';
import type { BillingInvoiceDto } from '@repo/shared';
import { getLocaleConfig } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import { useGetBillingInvoicesQuery } from '../../api/billing.api';

import { InvoiceHistoryCard as View } from './InvoiceHistoryCard.component';

export const InvoiceHistoryCard = (): React.ReactElement => {
  const { i18n } = useTranslation();
  const localeCfg = getLocaleConfig(i18n.language);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<BillingInvoiceDto[]>([]);

  const { data, isFetching, isError, refetch } = useGetBillingInvoicesQuery(
    cursor ? { startingAfter: cursor } : undefined,
  );

  // Append rather than replace, so "Show more" grows the list instead of
  // paging it — this is a history, and jumping between pages of a history is
  // worse than scrolling one.
  React.useEffect(() => {
    if (!data) {
      return;
    }
    setAccumulated((prev) => {
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
    });
  }, [data]);

  const handleShowMore = useCallback(() => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  }, [data?.nextCursor]);

  return (
    <View
      invoices={accumulated}
      isLoading={isFetching && accumulated.length === 0}
      isError={isError}
      hasMore={Boolean(data?.hasMore)}
      isLoadingMore={isFetching && accumulated.length > 0}
      locale={localeCfg.locale}
      onShowMore={handleShowMore}
      onRetry={() => void refetch()}
    />
  );
};
```

- [ ] **Step 3: Types and style**

```typescript
// InvoiceHistoryCard.types.ts
import type { BillingInvoiceDto } from '@repo/shared';

export interface InvoiceHistoryCardProps {
  invoices: BillingInvoiceDto[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  locale: string;
  onShowMore: () => void;
  onRetry: () => void;
}
```

```typescript
// InvoiceHistoryCard.style.ts
import styled from '@emotion/styled';
import { SettingsCard, tkn } from '@repo/ui';

export const Card = styled(SettingsCard)`
  width: 100%;
`;

/** Wide content gets its own scroll container rather than overflowing the page
 *  — the repo's Table.style.ts OverflowWrapper convention. */
export const TableScroll = styled.div`
  width: 100%;
  overflow-x: auto;
`;

export const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  justify-content: flex-end;
`;

export const MoreRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${tkn('spacing.md')};
`;
```

- [ ] **Step 4: Component**

```tsx
// InvoiceHistoryCard.component.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  EmptyState,
  Table,
  Text,
  formatDate,
  formatMicroCurrency,
} from '@repo/ui';

import * as S from './InvoiceHistoryCard.style';
import type { InvoiceHistoryCardProps } from './InvoiceHistoryCard.types';

/** Stripe invoice status → Badge variant. Pure, module scope, no hook deps. */
function statusVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'paid':
      return 'success';
    case 'open':
      return 'warning';
    case 'uncollectible':
    case 'void':
      return 'error';
    default:
      return 'neutral';
  }
}

export const InvoiceHistoryCard = ({
  invoices,
  isLoading,
  isError,
  hasMore,
  isLoadingMore,
  locale,
  onShowMore,
  onRetry,
}: InvoiceHistoryCardProps): React.ReactElement => {
  const { t } = useTranslation(['billing', 'translation']);

  // Loading, empty and error all render through EmptyState on purpose: using a
  // different component for each made the three states look like three
  // different screens.
  const body = (() => {
    if (isError) {
      return (
        <EmptyState
          icon="alert-triangle"
          title={t('billing:billing.invoices.error')}
          action={t('billing:billing.invoices.retry')}
          onAction={onRetry}
        />
      );
    }
    if (isLoading) {
      return <EmptyState icon="clock" title={t('billing:billing.invoices.loading')} />;
    }
    if (invoices.length === 0) {
      return <EmptyState icon="layers" title={t('billing:billing.invoices.empty')} />;
    }
    return (
      <>
        <S.TableScroll>
          <Table
            data={invoices}
            columns={[
              {
                key: 'issuedAt',
                header: t('billing:billing.invoices.date'),
                render: (inv) => (
                  <Text variant="body-sm" numeric>
                    {formatDate(inv.issuedAt, locale)}
                  </Text>
                ),
              },
              {
                key: 'description',
                header: t('billing:billing.invoices.description'),
                render: (inv) => <Text variant="body-sm">{inv.description ?? '—'}</Text>,
              },
              {
                key: 'amount',
                header: t('billing:billing.invoices.amount'),
                align: 'right',
                render: (inv) => (
                  <Text variant="body-sm" numeric>
                    {formatMicroCurrency(inv.amountMicros, inv.currency, locale)}
                  </Text>
                ),
              },
              {
                key: 'status',
                header: t('billing:billing.invoices.status'),
                render: (inv) => (
                  <Badge variant={statusVariant(inv.status)} size="sm" isPill>
                    {t(`billing:billing.invoices.statusLabel.${inv.status}`, {
                      defaultValue: inv.status,
                    })}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: t('billing:billing.invoices.pdf'),
                align: 'right',
                render: (inv) => (
                  <S.RowActions>
                    {inv.status !== 'paid' && inv.hostedUrl ? (
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => window.open(inv.hostedUrl ?? '', '_blank', 'noopener')}
                      >
                        <Text variant="body-sm">{t('billing:billing.invoices.payNow')}</Text>
                      </Button>
                    ) : null}
                    {inv.pdfUrl ? (
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => window.open(inv.pdfUrl ?? '', '_blank', 'noopener')}
                      >
                        <Text variant="body-sm">{t('billing:billing.invoices.download')}</Text>
                      </Button>
                    ) : null}
                  </S.RowActions>
                ),
              },
            ]}
          />
        </S.TableScroll>
        {hasMore ? (
          <S.MoreRow>
            <Button
              variant="secondary"
              size="small"
              isLoading={isLoadingMore}
              onClick={onShowMore}
            >
              <Text variant="body-sm">{t('billing:billing.invoices.showMore')}</Text>
            </Button>
          </S.MoreRow>
        ) : null}
      </>
    );
  })();

  return (
    <S.Card
      variant="section"
      header={{
        title: t('billing:billing.invoices.title'),
        subtitle: t('billing:billing.invoices.subtitle'),
      }}
    >
      {body}
    </S.Card>
  );
};

InvoiceHistoryCard.displayName = 'InvoiceHistoryCard';
```

Verify `Table`'s actual prop names against `packages/ui/src/organisms/Table` before writing this — match the existing call sites in `useListingsColumns.tsx` rather than the shape above if they differ. Add `billing.invoices.statusLabel.{paid,open,void,uncollectible,draft}` to both locale files.

- [ ] **Step 4: Mount it**

In `BillingPage.component.tsx`, after the payment method card:

```tsx
      <InvoiceHistoryCard />
```

- [ ] **Step 5: Build, lint, typecheck, commit**

```bash
pnpm --filter @repo/shared build
cd apps/web && pnpm exec eslint src/features/billing && pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i billing
git add packages/shared apps/web/src/features/billing
git commit -m "feat(billing): invoice history card"
```

---

### Task 14: Plan change confirmation with preview

**Files:**
- Create: `apps/web/src/features/billing/components/PlanChangeConfirm/{PlanChangeConfirm.component.tsx,PlanChangeConfirm.style.ts,PlanChangeConfirm.types.ts,index.ts}`
- Modify: `BillingPage.container.tsx`, `BillingPage.component.tsx`, `BillingPage.types.ts`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/billing.json`

- [ ] **Step 1: Copy (both locales)**

EN:

```json
"planChange": {
  "title": "Confirm plan change",
  "upgradeBody": "Switching to {{plan}}. {{amount}} will be charged now. Your next invoice will be {{nextAmount}} on {{nextDate}}.",
  "downgradeBody": "Switching to {{plan}} on {{date}}. Nothing is charged now — you keep your current plan until then.",
  "confirm": "Confirm",
  "cancel": "Cancel"
}
```

TR:

```json
"planChange": {
  "title": "Plan değişikliğini onaylayın",
  "upgradeBody": "{{plan}} paketine geçiyorsunuz. Şimdi {{amount}} tahsil edilecek. Bir sonraki faturanız {{nextDate}} tarihinde {{nextAmount}} olacak.",
  "downgradeBody": "{{date}} tarihinde {{plan}} paketine geçeceksiniz. Şimdi hiçbir tahsilat yapılmaz — o tarihe kadar mevcut planınızda kalırsınız.",
  "confirm": "Onayla",
  "cancel": "Vazgeç"
}
```

- [ ] **Step 2: Container — preview before applying**

Declare the pending-change state alongside the existing `checkoutPlanId` state:

```typescript
  const [previewPlanChange] = usePreviewPlanChangeMutation();
  /** The change the seller has previewed but not yet confirmed. Holding the
   *  preview here (rather than re-fetching on confirm) guarantees the figure
   *  they agreed to is the figure that gets applied. */
  const [pendingChange, setPendingChange] = useState<{
    planId: string;
    preview: BillingPlanChangePreviewDto;
  } | null>(null);
```

Replace the `hasProviderSubscription` branch of `handleSelectPlan` so it previews first and opens the modal instead of applying:

```typescript
      if (hasProviderSubscription) {
        void previewPlanChange({ planId, interval: compareInterval })
          .unwrap()
          .then((preview) => setPendingChange({ planId, preview }))
          .catch((error: Parameters<typeof getErrorI18nKey>[0]) => surfaceBillingError(error))
          .finally(() => setCheckoutPlanId(null));
        return;
      }
```

Add the confirm handler, which is what actually applies the change:

```typescript
  const handleConfirmPlanChange = useCallback(() => {
    if (!pendingChange) {
      return;
    }
    void changePlan({ planId: pendingChange.planId, interval: compareInterval })
      .unwrap()
      .then(() => {
        setPendingChange(null);
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'billing:billing.plans.switchDone',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t,
        );
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        // A declined card leaves the subscription unchanged (the backend uses
        // error_if_incomplete), so the seller is still on their old plan — say
        // why rather than closing silently.
        setPendingChange(null);
        surfaceBillingError(error);
      });
  }, [pendingChange, compareInterval, changePlan, showMessage, closeMessage, t, surfaceBillingError]);
```

- [ ] **Step 3: Types and component**

```typescript
// PlanChangeConfirm.types.ts
import type { BillingPlanChangePreviewDto } from '@repo/shared';

export interface PlanChangeConfirmProps {
  isOpen: boolean;
  preview: BillingPlanChangePreviewDto | null;
  /** Localized plan name for the plan being switched to. */
  planName: string;
  locale: string;
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

```tsx
// PlanChangeConfirm.component.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { PlanChangeDirection } from '@repo/shared';
import { Button, Modal, Text, formatDate, formatMicroCurrency } from '@repo/ui';

import type { PlanChangeConfirmProps } from './PlanChangeConfirm.types';

export const PlanChangeConfirm = ({
  isOpen,
  preview,
  planName,
  locale,
  isConfirming,
  onConfirm,
  onCancel,
}: PlanChangeConfirmProps): React.ReactElement | null => {
  const { t } = useTranslation(['billing', 'translation']);
  if (!preview) {
    return null;
  }

  // An upgrade takes money now; a downgrade takes none. Saying "will be
  // charged" for a downgrade would describe a debit that never happens.
  const body =
    preview.direction === PlanChangeDirection.UPGRADE
      ? t('billing:billing.planChange.upgradeBody', {
          plan: planName,
          amount: formatMicroCurrency(preview.amountDueMicros, preview.currency, locale),
          nextAmount:
            preview.nextInvoiceAmountMicros == null
              ? '—'
              : formatMicroCurrency(preview.nextInvoiceAmountMicros, preview.currency, locale),
          nextDate: preview.nextInvoiceAt ? formatDate(preview.nextInvoiceAt, locale) : '—',
        })
      : t('billing:billing.planChange.downgradeBody', {
          plan: planName,
          date: formatDate(preview.effectiveAt, locale),
        });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={t('billing:billing.planChange.title')}
      footer={
        <>
          <Button variant="secondary" size="medium" onClick={onCancel}>
            <Text variant="body-sm">{t('billing:billing.planChange.cancel')}</Text>
          </Button>
          <Button
            variant="primary"
            size="medium"
            isLoading={isConfirming}
            onClick={onConfirm}
          >
            <Text variant="body-sm">{t('billing:billing.planChange.confirm')}</Text>
          </Button>
        </>
      }
    >
      <Text variant="body">{body}</Text>
    </Modal>
  );
};

PlanChangeConfirm.displayName = 'PlanChangeConfirm';
```

Verify `Modal`'s prop names against `packages/ui/src/molecules/Modal` and match an existing call site (e.g. `ConfirmModal`) if they differ.

- [ ] **Step 4: Mount it**

Pass `pendingChange`, `onConfirmPlanChange`, `onCancelPlanChange` and
`isChangingPlan` from the container through `BillingPageProps`, then render at
the end of `BillingPage.component.tsx` (a sibling of the drawer, not inside it —
the drawer may be closed when the modal opens):

```tsx
      <PlanChangeConfirm
        isOpen={Boolean(pendingChange)}
        preview={pendingChange?.preview ?? null}
        planName={
          pendingChange
            ? t(`billing:billing.plans.${pendingChange.planSlug}.name`)
            : ''
        }
        locale={locale}
        isConfirming={isChangingPlan}
        onConfirm={onConfirmPlanChange}
        onCancel={onCancelPlanChange}
      />
```

For `planSlug` to be available here, widen the container's state to
`{ planId: string; planSlug: string; preview: BillingPlanChangePreviewDto }` and
capture the slug at the same moment the plan is picked — resolving it in the
component would mean a second lookup that can disagree with the preview.

`onCancelPlanChange` is `() => setPendingChange(null)`.

- [ ] **Step 5: Build, lint, typecheck, commit**

```bash
pnpm --filter @repo/shared build
cd apps/web && pnpm exec eslint src/features/billing && pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i billing
git add packages/shared apps/web/src/features/billing
git commit -m "feat(billing): confirm a plan change against a real proration preview"
```

---

### Task 15: Documentation and verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

In the "Choosing a plan means two different things" section, replace the `create_prorations` bullet with the direction split, and add a subsection recording:
- the three integrity layers (A1/A2/A3) and why one was not enough
- that invoices/cards/next-charge are read live from Stripe, with no local mirror, and why
- that `GET /billing/summary` must stay DB-only because AppLayout calls it
- that top-up checkouts set `invoice_creation` or vanish from history
- that promotion codes are on the subscription checkout only, and why not on top-ups

- [ ] **Step 2: Full verification**

```bash
pnpm --filter api test
pnpm lint
pnpm --filter api exec tsc --noEmit -p tsconfig.json
```

- [ ] **Step 3: Run the sandbox checklist from the spec**

Work through all eight items in the spec's "Verification checklist". Every one is a scenario that has already produced a real defect or is the direct guard against one.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: billing transparency and subscription integrity"
```
