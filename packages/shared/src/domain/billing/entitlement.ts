// packages/shared/src/domain/billing/entitlement.ts
//
// The single definition of "may this account still use the product?".
//
// Pure and dependency-free on purpose: five separate enforcement points read
// it (the quota gate, the Keepa refresh claim, auto-fulfill, tracking
// conversion, and the Action Center). Writing the precedence out by hand at
// each of them is exactly the failure `fulfillment-state-sql.guard.spec.ts`
// exists to prevent — there, seven hand-written copies of one precedence chain
// had already drifted apart from each other and from the function they were
// supposed to mirror.

import { BillingSubscriptionStatus } from './billing.types';

/**
 * What the account is entitled to right now.
 *
 * - `ACTIVE`    — paid up (or on trial). Everything runs.
 * - `SUSPENDED` — money is owed or the entitlement is over. Work stops.
 * - `NONE`      — no subscription row at all. NOT the same as suspended: this
 *                 is the pre-billing state (enforcement has never applied to
 *                 this account), and callers deliberately fail OPEN on it, the
 *                 behaviour every account has today.
 */
export enum EntitlementState {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  NONE = 'none',
}

/**
 * Map a subscription status onto the entitlement it grants.
 *
 * `PAST_DUE` counts as suspended from the first failed charge — the operator
 * chose an immediate hard stop rather than a grace window (2026-08-21). Note
 * this is only possible to state in one place because the status itself is
 * authoritative: Stripe reports `past_due` while it is still retrying the card
 * and `canceled` once it gives up, so "resume when they pay" needs no separate
 * un-suspend action — the next `customer.subscription.updated` flips the status
 * back to `active` and every gate below opens again on its own.
 */
export function resolveEntitlementState(
  status: BillingSubscriptionStatus | null | undefined,
): EntitlementState {
  switch (status) {
    case BillingSubscriptionStatus.ACTIVE:
    case BillingSubscriptionStatus.TRIALING:
      return EntitlementState.ACTIVE;
    case BillingSubscriptionStatus.PAST_DUE:
    case BillingSubscriptionStatus.CANCELED:
    case BillingSubscriptionStatus.ENDED:
      return EntitlementState.SUSPENDED;
    default:
      // null / undefined / an unrecognized value. Fail open — see NONE above.
      return EntitlementState.NONE;
  }
}

/** True when work must be refused because the account owes money or has lapsed. */
export function isEntitlementSuspended(state: EntitlementState): boolean {
  return state === EntitlementState.SUSPENDED;
}

/**
 * The subscription statuses that still grant entitlement, as literal strings.
 *
 * Exported for the ONE place that cannot call the function: the Keepa refresh
 * claim, which decides entitlement inside a single SQL statement (a per-product
 * query across all users — pulling every owner into JS to filter afterwards
 * would defeat the point of the claim). Interpolating from this constant keeps
 * that SQL tied to the same enum the function switches on.
 */
export const ENTITLED_SUBSCRIPTION_STATUSES: readonly BillingSubscriptionStatus[] = [
  BillingSubscriptionStatus.ACTIVE,
  BillingSubscriptionStatus.TRIALING,
];
