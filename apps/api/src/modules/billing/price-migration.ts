// apps/api/src/modules/billing/price-migration.ts
//
// Moving existing subscribers onto a plan's NEW price, automatically
// (operator decision, 2026-09-17).
//
// A Stripe Price is immutable, so a price change creates a new Price and would
// leave every existing subscriber on the old one for ever. The rule instead:
// a seller finishes the period they are in at the price they already paid, and
// their NEXT period starts at the new price. No operator step — the
// `billing-price-migration` job applies it to everyone, hourly.
//
// This file is the pure decision per subscription, so the rules are testable
// without Stripe or a database.

/**
 * Recorded as `metadata.source` on every Stripe Subscription Schedule we write,
 * so the automatic migration can tell ITS schedule from a downgrade the seller
 * chose: it may replace its own, never theirs.
 */
export enum ScheduleSource {
  PLAN_CHANGE = 'plan_change',
  PRICE_MIGRATION = 'price_migration',
}

/** What the job does with one subscription. */
export enum PriceMigrationAction {
  /** Schedule the new price from the next renewal (none scheduled yet, or ours is stale). */
  MIGRATE = 'migrate',
  /** Our schedule for exactly this price already exists — only the notice may be outstanding. */
  ALREADY_SCHEDULED = 'already_scheduled',
  /** Already billed at the target price. */
  ALREADY_ON_TARGET = 'already_on_target',
  /**
   * The SELLER has a change pending (a downgrade). Scheduling replaces a
   * schedule outright, so migrating now would silently cancel their choice.
   * Re-checked on the next run; once their change lands, their plan is
   * different and is evaluated against that plan's price.
   */
  SKIP_PENDING_CHANGE = 'skip_pending_change',
  /** Set to cancel at period end — it will never renew at any price. */
  SKIP_CANCELLING = 'skip_cancelling',
  /** Not a live subscription in Stripe (canceled, incomplete, …). */
  SKIP_NOT_LIVE = 'skip_not_live',
}

export interface PriceMigrationInput {
  /** Stripe status of the subscription. */
  status: string;
  /** The Stripe Price the subscription is billed at today. */
  currentPriceId: string | null;
  /** The plan's current Stripe Price (the one new subscribers get). */
  targetPriceId: string;
  cancelAtPeriodEnd: boolean;
  /** A schedule phase still to come, or null. */
  pendingChange: { source: string | null; priceId: string | null } | null;
}

/** Stripe statuses that renew, and so can be moved to a new price. */
const MIGRATABLE_STATUSES = new Set(['active', 'past_due', 'trialing']);

export function decidePriceMigration(input: PriceMigrationInput): PriceMigrationAction {
  if (!MIGRATABLE_STATUSES.has(input.status)) {
    return PriceMigrationAction.SKIP_NOT_LIVE;
  }
  if (input.currentPriceId === input.targetPriceId) {
    return PriceMigrationAction.ALREADY_ON_TARGET;
  }
  if (input.cancelAtPeriodEnd) {
    return PriceMigrationAction.SKIP_CANCELLING;
  }
  const pending = input.pendingChange;
  if (pending) {
    if (pending.source !== ScheduleSource.PRICE_MIGRATION) {
      return PriceMigrationAction.SKIP_PENDING_CHANGE;
    }
    if (pending.priceId === input.targetPriceId) {
      return PriceMigrationAction.ALREADY_SCHEDULED;
    }
    // Our own schedule, but for an earlier price: the plan's price changed
    // again before it took effect. Ours to replace.
  }
  return PriceMigrationAction.MIGRATE;
}

/** "$19.99" / "19,99 $" — a Stripe minor-unit amount in the seller's locale. */
export function formatStripeAmount(
  unitAmount: number | null,
  currency: string,
  locale: string,
): string {
  if (unitAmount === null) {
    return '—';
  }
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100);
}
