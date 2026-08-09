import { EbayCallPriority } from '@repo/shared';

/**
 * Pure arithmetic behind the eBay call-budget governor.
 *
 * Kept separate from the Redis service so the two decisions that actually
 * matter — when the day rolls over, and how much of the quota background work
 * is allowed to eat — are testable without a Redis or a clock.
 */

/** Seconds of slack kept on the counter TTL past the reset, so a key never expires early. */
const TTL_GRACE_SECONDS = 3600;

export interface BudgetWindow {
  /** Calendar day the counter belongs to, `YYYY-MM-DD` in UTC. */
  day: string;
  resetAt: Date;
  ttlSeconds: number;
}

/**
 * The counter window `now` falls in.
 *
 * eBay's daily quotas roll over at UTC midnight, so the counter is keyed by UTC
 * date. Deriving the key from the date rather than tracking an expiry means a
 * process restart, a second API replica, or a clock skew of a few seconds all
 * land on the same counter instead of silently starting a fresh budget.
 */
export function budgetWindow(now: Date): BudgetWindow {
  const resetAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  const ttlSeconds = Math.ceil((resetAt.getTime() - now.getTime()) / 1000) + TTL_GRACE_SECONDS;

  return { day: now.toISOString().slice(0, 10), resetAt, ttlSeconds };
}

/**
 * The ceiling a call of this priority may spend against.
 *
 * Background work stops at `limit - reserve%` so the tail of the quota belongs
 * to sellers acting in the UI. Interactive calls see the full limit.
 *
 * The reserve is clamped to 0..50: a negative one would hand background work
 * more than the real quota, and anything above half would starve the refresh
 * pipeline to protect a reserve nobody is using.
 */
export function effectiveLimit(limit: number, reservePercent: number, priority: EbayCallPriority): number {
  if (priority === EbayCallPriority.INTERACTIVE) {
    return Math.max(0, Math.floor(limit));
  }
  const reserve = Math.min(50, Math.max(0, reservePercent));
  return Math.max(0, Math.floor((limit * (100 - reserve)) / 100));
}

/** Milliseconds to defer a job that ran out of budget, floored so a retry never busy-loops. */
export function deferralDelayMs(resetAt: Date, now: Date, minimumMs = 60_000): number {
  return Math.max(minimumMs, resetAt.getTime() - now.getTime());
}
