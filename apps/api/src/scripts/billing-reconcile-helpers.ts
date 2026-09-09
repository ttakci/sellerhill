// apps/api/src/scripts/billing-reconcile-helpers.ts
//
// Pure helpers for `billing-reconcile.ts`. Extracted and unit-tested for the
// same reason `reset-users-helpers.ts` / `user-set-role-helpers.ts` are: the
// script itself is a pg/Stripe shell, and everything that decides WHAT gets
// written belongs somewhere a test can hold it without a database or a live
// Stripe key. That includes the synthetic-event envelope and the plan-id pull
// — the one novel, drift-prone piece this CLI introduces.

import { type ParsedStripeEvent } from '../modules/billing/billing.types';

/** Thrown for a usage error; the caller prints usage and exits 2. */
export class ReconcileArgError extends Error {}

/**
 * The synthetic envelope's event type. Must be one
 * `extractStripeSubscriptionFields` accepts (its `SUBSCRIPTION_EVENT_TYPES`
 * set) — the mapper reads Stripe's own `status` off the object regardless of
 * which of the three it is, so `updated` is the honest label for "we re-read
 * the current state".
 */
export const RECONCILE_EVENT_TYPE = 'customer.subscription.updated';

/**
 * Wrap a Stripe subscription object in the same `ParsedStripeEvent` shape the
 * webhook controller produces, so `extractStripeSubscriptionFields` — the ONE
 * shared mapper — can be reused verbatim. `eventId` is not a real `evt_...`; it
 * lands in the persisted `metadata.stripe_event_id`, where the `reconcile:`
 * prefix is a deliberate breadcrumb that the row was written by this CLI, not a
 * webhook. `now` is injectable so the envelope is deterministic under test.
 */
export function buildReconcileEvent(subscription: unknown, now: Date = new Date()): ParsedStripeEvent {
  const iso = now.toISOString();
  return {
    eventId: `reconcile:${iso}`,
    eventType: RECONCILE_EVENT_TYPE,
    occurredAt: iso,
    payload: { data: { object: subscription } },
  };
}

/**
 * Pull the internal plan id from a Stripe subscription's own metadata, matching
 * `stripe-event-applier`'s private `resolvePlanId` exactly:
 * `StripeBillingProvider.createCheckout` stamps `subscription_data.metadata.plan_id`
 * and Stripe copies it onto the Subscription object. Returns null when it is
 * missing or empty — a subscription created outside our checkout flow that we
 * cannot map to a local plan.
 */
export function resolveReconcilePlanId(subscription: unknown): string | null {
  if (!subscription || typeof subscription !== 'object') {
    return null;
  }
  const meta = ((subscription as Record<string, unknown>).metadata ?? {}) as Record<string, unknown>;
  return typeof meta.plan_id === 'string' && meta.plan_id.length > 0 ? meta.plan_id : null;
}

export interface ReconcileArgs {
  /** The account to reconcile, looked up by `LOWER(email)`. Required. */
  email: string;
  /** Print what would be written and exit without writing. */
  dryRun: boolean;
}

/**
 * Parse `--email <email> [--dry-run]`. Strict, like the sibling CLIs:
 *  - a bare `--` is skipped (pnpm forwards a literal `--` through
 *    `pnpm run <script> -- --flag`; the same footgun CLAUDE.md documents for
 *    user:set-role, where the strict parser would otherwise exit 2);
 *  - `--email` requires a following value that is not itself a flag;
 *  - any other token is an error.
 */
export function parseReconcileArgs(argv: readonly string[]): ReconcileArgs {
  let email: string | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--':
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--email': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new ReconcileArgError('--email requires a value');
        }
        email = value.trim();
        if (email.length === 0) {
          throw new ReconcileArgError('--email requires a value');
        }
        i += 1;
        break;
      }
      default:
        throw new ReconcileArgError(`unknown argument: ${arg}`);
    }
  }

  if (!email) {
    throw new ReconcileArgError('--email is required');
  }

  return { email, dryRun };
}
