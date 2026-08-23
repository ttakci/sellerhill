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

describe('A5 — top-up checkout closes the same customer-creation race as createCheckout', () => {
  const service = read('modules', 'billing', 'billing.service.ts');

  it('createAddonCheckout resolves the customer under the per-user lock and re-reads inside it', () => {
    // Identical defect class to A4's createCheckout race, on the top-up path:
    // an unlocked read-then-maybe-create let two concurrent top-up purchases
    // by a brand-new user mint two separate Stripe customers, and
    // billing_customers.user_id being UNIQUE means the local row can only
    // point at one — silently orphaning the other purchase from all local
    // tracking. Asserts order, not just presence, for the same reason A4
    // does: a lock that does not recheck after acquiring protects nothing.
    const body = service.slice(
      service.indexOf('async createAddonCheckout('),
      service.indexOf('async startTrialForUser('),
    );
    const lockIdx = body.indexOf('withUserBillingLock(');
    expect(lockIdx).toBeGreaterThan(-1);
    const lockedSection = body.slice(lockIdx);
    expect(lockedSection).toMatch(/ensureLocalCustomer\(/);
    expect(lockedSection).toMatch(/ensureCustomer\(/);
  });

  it('does not resolve the customer via an unlocked findCustomerByUserId read', () => {
    // The pre-fix version read the customer with a plain, unlocked query and
    // handed the (possibly null) result straight to the provider, which then
    // raced its own unlocked ensureCustomer fallback. Locking further down
    // the call while this earlier read still exists would just discard its
    // result and could mislead a future reader into removing the lock as
    // "redundant."
    const body = service.slice(
      service.indexOf('async createAddonCheckout('),
      service.indexOf('async startTrialForUser('),
    );
    expect(body).not.toMatch(/findCustomerByUserId\(/);
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

describe('final whole-branch review fixes (2026-08-23)', () => {
  const provider = read('modules', 'billing', 'billing-provider.ts');
  const applier = read('modules', 'billing', 'stripe-event-applier.ts');
  const service = read('modules', 'billing', 'billing.service.ts');
  const controller = read('modules', 'billing', 'billing.controller.ts');

  describe('C1 — a downgrade schedule keeps collecting tax on both phases', () => {
    it('sets automatic_tax at default_settings AND on both phases of the update call', () => {
      // Wide window: the call is heavily commented (see the review context for
      // why this is load-bearing — a Wyoming tax registration went live
      // 2026-08-22), and this asserts all three appear in the SAME
      // subscriptionSchedules.update() call, not merely somewhere in the file.
      const body = provider.slice(
        provider.indexOf('async scheduleDowngrade('),
        provider.indexOf('async cancelScheduledChange('),
      );
      const updateIdx = body.indexOf('subscriptionSchedules.update(');
      expect(updateIdx).toBeGreaterThan(-1);
      const updateCall = body.slice(updateIdx, body.indexOf('} catch (error) {', updateIdx));
      expect(updateCall).toMatch(/default_settings:\s*\{\s*automatic_tax:\s*\{\s*enabled:\s*true/);
      // Two phases in the literal, each carrying its own automatic_tax.
      const automaticTaxOccurrences = updateCall.match(/automatic_tax:\s*\{\s*enabled:\s*true/g) ?? [];
      expect(automaticTaxOccurrences.length).toBeGreaterThanOrEqual(3);
    });

    it('does NOT pass automatic_tax on the from_subscription create call (SDK forbids other params there)', () => {
      const body = provider.slice(
        provider.indexOf('async scheduleDowngrade('),
        provider.indexOf('async cancelScheduledChange('),
      );
      const createIdx = body.indexOf('subscriptionSchedules.create(');
      const updateIdx = body.indexOf('subscriptionSchedules.update(');
      const createCall = body.slice(createIdx, updateIdx);
      expect(createCall).not.toMatch(/automatic_tax/);
    });
  });

  describe('C2 — subscription period dates are read from the item, not the Subscription object', () => {
    it('extracts current_period_start/end from the first subscription item', () => {
      // current_period_start/end moved to SubscriptionItem at this codebase's
      // pinned API version (2025-03-31.basil) — reading them off `sub`
      // directly always misses and silently fabricates a now()..now()+30d
      // span, which this codebase's seller-facing copy now quotes verbatim
      // (plan meta line, downgrade/upgrade confirmation dialogs).
      const body = applier.slice(applier.indexOf('export function extractStripeSubscriptionFields('));
      expect(body).toMatch(/firstSubscriptionItem\(sub\)/);
      expect(body).toMatch(/parseUnixSeconds\(item\?\.current_period_start\)/);
      expect(body).toMatch(/parseUnixSeconds\(item\?\.current_period_end\)/);
      expect(body).not.toMatch(/parseUnixSeconds\(sub\.current_period_start\)/);
      expect(body).not.toMatch(/parseUnixSeconds\(sub\.current_period_end\)/);
    });
  });

  describe('I1 — a lapsed subscriber can resubscribe', () => {
    it('hasProviderSubscription requires a LIVE status, not just a stored provider id', () => {
      // providerSubscriptionId survives a CANCELED/ENDED subscription (Stripe
      // never clears it), so an id-only check permanently routed a lapsed
      // seller at "Switch to X" -> previewPlanChange/changePlan — both of
      // which dead-end against a canceled subscription — with no way back to
      // checkout.
      expect(service).toMatch(
        /hasProviderSubscription: Boolean\(\s*subscription\?\.providerSubscriptionId && hasLiveSubscriptionStatus\(subscription\.status\)/,
      );
    });
  });

  describe('I2 — a pending downgrade banner clears once the change lands, and a second downgrade works', () => {
    it('getBillingDetails only reports a schedule phase as pending when its start is still in the future', () => {
      const body = provider.slice(
        provider.indexOf('async getBillingDetails('),
        provider.indexOf('async listInvoices('),
      );
      expect(body).toMatch(/pending && pending\.start_date > nowSeconds/);
    });

    it('scheduleDowngrade locates the live phase via current_phase, not by assuming index 0', () => {
      const body = provider.slice(
        provider.indexOf('async scheduleDowngrade('),
        provider.indexOf('async cancelScheduledChange('),
      );
      expect(body).toMatch(/schedule\.current_phase/);
      expect(body).toMatch(/phases\.find\(/);
    });
  });

  describe('I3 — previewPlanChange and listInvoices map provider failures like every sibling method', () => {
    it('previewPlanChange wraps its Stripe calls in a try/catch that throws a mapped billing.errors key', () => {
      const body = provider.slice(
        provider.indexOf('async previewPlanChange('),
        provider.indexOf('async getBillingDetails('),
      );
      expect(body).toMatch(/try\s*\{/);
      expect(body).toMatch(/catch \(error\)/);
      expect(body).toMatch(/throw new Error\('billing\.errors\.planChangeFailed'\)/);
    });

    it('listInvoices wraps its Stripe call in a try/catch that throws a mapped billing.errors key', () => {
      const body = provider.slice(
        provider.indexOf('async listInvoices('),
        provider.indexOf('async createPortal('),
      );
      expect(body).toMatch(/try\s*\{/);
      expect(body).toMatch(/catch \(error\)/);
      expect(body).toMatch(/throw new Error\('billing\.errors\.invoicesFailed'\)/);
      expect(controller).toMatch(/'billing\.errors\.invoicesFailed':\s*HttpStatus\.CONFLICT/);
    });
  });
});
