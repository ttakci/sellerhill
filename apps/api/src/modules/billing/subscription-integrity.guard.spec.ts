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

describe('A4 — code review round 1 fixes (paused status; customer-creation race)', () => {
  const provider = read('modules', 'billing', 'billing-provider.ts');
  const service = read('modules', 'billing', 'billing.service.ts');
  const repository = read('modules', 'billing', 'billing-repository.service.ts');

  it('a paused Stripe subscription counts as already-subscribed', () => {
    // stripe-event-applier.ts's own mapStatus documents `paused` as a real
    // Stripe status (a trial that ended with no payment method) — the
    // subscription is still a live Stripe object tied to the customer and
    // can resume billing, so it must not read as "no subscription." Scoped
    // to the LIVE_SUBSCRIPTION_STATUSES set literal specifically, not the
    // whole file, so this cannot pass because "paused" merely appears
    // somewhere else (e.g. in a comment).
    const setStart = provider.indexOf('LIVE_SUBSCRIPTION_STATUSES = new Set([');
    const setLiteral = provider.slice(setStart, provider.indexOf(']', setStart));
    expect(setLiteral).toMatch(/'paused'/);
  });

  it('the repository exposes a per-user Postgres advisory lock for customer resolution', () => {
    expect(repository).toMatch(/async withUserBillingLock/);
    expect(repository).toMatch(/pg_advisory_xact_lock/);
  });

  it('the provider exposes a customer-resolution method the service can call under that lock', () => {
    expect(provider).toMatch(/async ensureCustomer\(/);
  });

  it('createCheckout resolves the customer under the lock and re-reads inside it, before asking Stripe about duplicates', () => {
    // A lock acquired around code that does not recheck after acquiring
    // protects nothing — so this asserts ORDER, not just presence: the
    // re-read (ensureLocalCustomer) and the create-if-needed
    // (provider.ensureCustomer) must both sit BETWEEN the lock call and the
    // duplicate-subscription check that depends on their result.
    const body = service.slice(service.indexOf('async createCheckout('));
    const lockIdx = body.indexOf('withUserBillingLock(');
    const guardIdx = body.indexOf('hasActiveProviderSubscription(');
    expect(lockIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(lockIdx);
    const lockedSection = body.slice(lockIdx, guardIdx);
    expect(lockedSection).toMatch(/ensureLocalCustomer\(/);
    expect(lockedSection).toMatch(/ensureCustomer\(/);
  });
});

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

  it('an upgrade releases any pending downgrade first', () => {
    // Otherwise a stale schedule fires a month later and undoes the upgrade
    // the seller just paid for.
    const body = service.slice(service.indexOf('async changePlan('));
    expect(body).toMatch(/cancelScheduledChange\(/);
  });

  it('a downgrade preview costs 0 today and never reaches the provider', () => {
    // The confirmation dialog must not tell a downgrading seller they are
    // about to be charged for a change that moves no money until period end
    // — so the 0-due return has to be an early return, strictly before the
    // Stripe-calling branch, not just present somewhere in the method.
    const body = service.slice(
      service.indexOf('async previewPlanChange('),
      service.indexOf('async createAddonCheckout('),
    );
    const downgradeIdx = body.indexOf('PlanChangeDirection.DOWNGRADE');
    const zeroDueIdx = body.indexOf('amountDueMicros: 0');
    const providerCallIdx = body.indexOf('this.provider.previewPlanChange(');
    expect(downgradeIdx).toBeGreaterThan(-1);
    expect(zeroDueIdx).toBeGreaterThan(downgradeIdx);
    expect(providerCallIdx).toBeGreaterThan(zeroDueIdx);
  });

  it('the preview resolves direction the same way changePlan does', () => {
    // A divergent argument order would let the preview disagree with what
    // the change actually applies — showing the seller one number and
    // charging another.
    const directionCallPattern =
      /resolvePlanChangeDirection\(\s*currentPlan\?\.prices\[interval\]\?\.amountMicros \?\? 0,\s*price\.amountMicros,?\s*\)/;
    const changeBody = service.slice(
      service.indexOf('async changePlan('),
      service.indexOf('async previewPlanChange('),
    );
    const previewBody = service.slice(
      service.indexOf('async previewPlanChange('),
      service.indexOf('async createAddonCheckout('),
    );
    expect(changeBody).toMatch(directionCallPattern);
    expect(previewBody).toMatch(directionCallPattern);
  });
});
