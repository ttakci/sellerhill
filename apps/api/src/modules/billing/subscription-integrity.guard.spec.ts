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
