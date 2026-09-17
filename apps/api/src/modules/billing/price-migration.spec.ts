// apps/api/src/modules/billing/price-migration.spec.ts
import {
  decidePriceMigration,
  formatStripeAmount,
  PriceMigrationAction,
  ScheduleSource,
  type PriceMigrationInput,
} from './price-migration';

const base: PriceMigrationInput = {
  status: 'active',
  currentPriceId: 'price_old',
  targetPriceId: 'price_new',
  cancelAtPeriodEnd: false,
  pendingChange: null,
};

describe('decidePriceMigration', () => {
  it('migrates a live subscriber still on the old price', () => {
    expect(decidePriceMigration(base)).toBe(PriceMigrationAction.MIGRATE);
  });

  it('also migrates a past_due subscriber (it still renews)', () => {
    expect(decidePriceMigration({ ...base, status: 'past_due' })).toBe(PriceMigrationAction.MIGRATE);
  });

  it('does nothing for a subscriber already on the new price', () => {
    expect(decidePriceMigration({ ...base, currentPriceId: 'price_new' })).toBe(
      PriceMigrationAction.ALREADY_ON_TARGET,
    );
  });

  it('never overwrites a change the seller scheduled themselves', () => {
    expect(
      decidePriceMigration({ ...base, pendingChange: { source: 'plan_change', priceId: 'price_x' } }),
    ).toBe(PriceMigrationAction.SKIP_PENDING_CHANGE);
  });

  it('treats a schedule with no source as the seller’s, not ours', () => {
    expect(decidePriceMigration({ ...base, pendingChange: { source: null, priceId: 'price_new' } })).toBe(
      PriceMigrationAction.SKIP_PENDING_CHANGE,
    );
  });

  it('recognises its own schedule for this exact price', () => {
    expect(
      decidePriceMigration({
        ...base,
        pendingChange: { source: ScheduleSource.PRICE_MIGRATION, priceId: 'price_new' },
      }),
    ).toBe(PriceMigrationAction.ALREADY_SCHEDULED);
  });

  it('replaces its own schedule when the price changed again before it took effect', () => {
    expect(
      decidePriceMigration({
        ...base,
        pendingChange: { source: ScheduleSource.PRICE_MIGRATION, priceId: 'price_older' },
      }),
    ).toBe(PriceMigrationAction.MIGRATE);
  });

  it('skips a subscription that is cancelling — it will not renew', () => {
    expect(decidePriceMigration({ ...base, cancelAtPeriodEnd: true })).toBe(
      PriceMigrationAction.SKIP_CANCELLING,
    );
  });

  it('skips anything that is not live, before anything else', () => {
    for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused']) {
      expect(decidePriceMigration({ ...base, status, currentPriceId: 'price_new' })).toBe(
        PriceMigrationAction.SKIP_NOT_LIVE,
      );
    }
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
