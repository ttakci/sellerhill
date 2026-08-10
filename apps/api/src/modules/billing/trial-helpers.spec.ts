import { BillingInterval, BillingSubscriptionStatus, type BillingSubscriptionDto } from '@repo/shared';

import { normalizeExpiredTrial, trialDaysRemaining, trialEndFrom } from './trial-helpers';

const base: BillingSubscriptionDto = {
  id: 'sub-id',
  customerId: 'customer-id',
  planId: 'trial-plan-id',
  status: BillingSubscriptionStatus.TRIALING,
  interval: BillingInterval.MONTHLY,
  currentPeriodStart: '2026-08-01T00:00:00.000Z',
  currentPeriodEnd: '2026-08-08T00:00:00.000Z',
  canceledAt: null,
  endedAt: null,
  trialEndsAt: '2026-08-08T00:00:00.000Z',
  providerSubscriptionId: null,
  metadata: {},
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('trial helpers', () => {
  it('derives an exact trial end', () => {
    expect(trialEndFrom(new Date('2026-08-01T12:00:00.000Z'), 7).toISOString())
      .toBe('2026-08-08T12:00:00.000Z');
  });

  it('rounds partial remaining days up and floors expired trials at zero', () => {
    const end = new Date('2026-08-08T00:00:00.000Z');
    expect(trialDaysRemaining(end, new Date('2026-08-06T12:00:00.000Z'))).toBe(2);
    expect(trialDaysRemaining(end, new Date('2026-08-09T00:00:00.000Z'))).toBe(0);
  });

  it('normalizes an elapsed trial to ended when the expiry job is delayed', () => {
    expect(normalizeExpiredTrial(base, new Date('2026-08-09T00:00:00.000Z'))).toMatchObject({
      status: BillingSubscriptionStatus.ENDED,
      endedAt: base.trialEndsAt,
    });
  });

  it('preserves a current trial and every non-trial subscription', () => {
    expect(normalizeExpiredTrial(base, new Date('2026-08-07T00:00:00.000Z'))).toEqual(base);
    expect(normalizeExpiredTrial({ ...base, status: BillingSubscriptionStatus.ACTIVE }, new Date('2026-08-09T00:00:00.000Z')))
      .toEqual({ ...base, status: BillingSubscriptionStatus.ACTIVE });
  });
});
