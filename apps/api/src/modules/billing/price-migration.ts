// apps/api/src/modules/billing/price-migration.ts
//
// Moving existing subscribers onto a plan's NEW price (operator decision,
// 2026-09-17).
//
// A Stripe Price is immutable, so changing a plan's price creates a new Price
// and leaves every existing subscriber on the old one indefinitely. The
// operator has two options when that happens:
//
//   - keep existing subscribers on the old price  → do nothing;
//   - move them                                    → `billing:migrate-price`.
//
// Moving is never immediate. The current paid period finishes at the price the
// seller already paid, and the next period starts at the new one — through the
// same Subscription Schedule mechanism a downgrade uses — and the seller is
// e-mailed the old price, the new price and the date first.
//
// This file is the pure decision per subscription, kept out of the script so
// the rules are testable without Stripe or a database.

/** What `billing:migrate-price` does with one subscription. */
export enum PriceMigrationAction {
  /** Schedule the new price from the next renewal, then notify the seller. */
  MIGRATE = 'migrate',
  /** Already billed at the target price — a re-run after a previous migration. */
  ALREADY_ON_TARGET = 'already_on_target',
  /**
   * A change is already scheduled (a pending downgrade, or a migration from an
   * earlier run). Scheduling replaces a schedule outright, so migrating here
   * would silently cancel the seller's own downgrade. Left for the operator;
   * once that change has landed, a re-run picks the subscription up.
   */
  SKIP_PENDING_CHANGE = 'skip_pending_change',
  /** Set to cancel at period end — it will never renew, so there is nothing to move. */
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
  /** True when a Subscription Schedule is already attached. */
  hasSchedule: boolean;
  cancelAtPeriodEnd: boolean;
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
  if (input.hasSchedule) {
    return PriceMigrationAction.SKIP_PENDING_CHANGE;
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
