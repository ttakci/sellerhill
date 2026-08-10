import { BillingSubscriptionStatus, type BillingSubscriptionDto } from '@repo/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

export function trialEndFrom(startedAt: Date, trialDays: number): Date {
  return new Date(startedAt.getTime() + trialDays * DAY_MS);
}

export function trialDaysRemaining(trialEndsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS));
}

/**
 * A scheduled expiry job is the primary writer, but reads must fail closed when
 * that job is delayed: an elapsed trial never remains an active entitlement.
 */
export function normalizeExpiredTrial(
  subscription: BillingSubscriptionDto | null,
  now: Date,
): BillingSubscriptionDto | null {
  if (
    !subscription ||
    subscription.status !== BillingSubscriptionStatus.TRIALING ||
    !subscription.trialEndsAt ||
    new Date(subscription.trialEndsAt).getTime() > now.getTime()
  ) {
    return subscription;
  }

  return {
    ...subscription,
    status: BillingSubscriptionStatus.ENDED,
    endedAt: subscription.endedAt ?? subscription.trialEndsAt,
  };
}
