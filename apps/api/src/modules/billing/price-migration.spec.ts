// apps/api/src/modules/billing/price-migration.spec.ts
import {
  decidePriceMigration,
  formatStripeAmount,
  PriceMigrationAction,
  type PriceMigrationInput,
} from './price-migration';

const base: PriceMigrationInput = {
  status: 'active',
  currentPriceId: 'price_old',
  targetPriceId: 'price_new',
  hasSchedule: false,
  cancelAtPeriodEnd: false,
};

describe('decidePriceMigration', () => {
  it('migrates a live subscriber still on the old price', () => {
    expect(decidePriceMigration(base)).toBe(PriceMigrationAction.MIGRATE);
  });

  it('also migrates a past_due subscriber (it still renews)', () => {
    expect(decidePriceMigration({ ...base, status: 'past_due' })).toBe(
      PriceMigrationAction.MIGRATE,
    );
  });

  it('is a no-op for a subscriber already on the new price (safe to re-run)', () => {
    expect(decidePriceMigration({ ...base, currentPriceId: 'price_new' })).toBe(
      PriceMigrationAction.ALREADY_ON_TARGET,
    );
  });

  it('never overwrites a change the seller already scheduled', () => {
    expect(decidePriceMigration({ ...base, hasSchedule: true })).toBe(
      PriceMigrationAction.SKIP_PENDING_CHANGE,
    );
  });

  it('skips a subscription that is cancelling — it will not renew', () => {
    expect(decidePriceMigration({ ...base, cancelAtPeriodEnd: true })).toBe(
      PriceMigrationAction.SKIP_CANCELLING,
    );
  });

  it('skips anything that is not live', () => {
    for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused']) {
      expect(decidePriceMigration({ ...base, status })).toBe(PriceMigrationAction.SKIP_NOT_LIVE);
    }
  });

  it('checks liveness before anything else', () => {
    expect(
      decidePriceMigration({ ...base, status: 'canceled', currentPriceId: 'price_new' }),
    ).toBe(PriceMigrationAction.SKIP_NOT_LIVE);
  });
});

describe('formatStripeAmount', () => {
  it('formats minor units in the seller locale', () => {
    expect(formatStripeAmount(1999, 'usd', 'en')).toBe('$19.99');
    expect(formatStripeAmount(1999, 'usd', 'tr')).toContain('19,99');
  });

  it('renders an unknown amount as a dash, never as zero', () => {
    expect(formatStripeAmount(null, 'usd', 'en')).toBe('—');
  });
});
