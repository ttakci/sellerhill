// apps/api/src/modules/listings/refresh-entitlement-sql.ts
//
// The billing "cost stop" predicate the refresh claim
// (`RefreshProcessorService.selectRefreshBatch`) applies to a `listings l`
// scope, extracted into one pure builder so a second query — the admin
// operations summary's refresh-lag/capacity denominator — can ask the exact
// same "would the claim actually pick this product up?" question instead of
// drifting into its own, looser copy of the rule.
//
// `products` is a shared, ASIN-keyed cache, so this is deliberately scoped
// per LISTING ("at least one ACTIVE listing belongs to an entitled owner and
// is not itself over that owner's plan limit"), never per product as a whole
// — a non-payer's listing goes stale while a paying seller listing the same
// ASIN is unaffected. See CLAUDE.md "Entitlement & quota enforcement" and
// "Listings over the plan limit are not automated".
//
// Both fragments are gated on the SAME `enforcementOn` flag the claim reads
// (`BILLING_ENFORCEMENT_ENABLED`), and both are empty strings when it is off
// — so a caller with enforcement off gets byte-identical SQL to the
// pre-entitlement query, exactly as the claim itself does.

import { ENTITLED_SUBSCRIPTION_STATUSES } from '@repo/shared';

export interface RefreshEntitlementSql {
  /** JOINs to append after `FROM listings l` (or any query aliasing a listing as `l`). Empty when enforcement is off. */
  entitlementJoin: string;
  /** `AND` clause restricting to listings not over the owner's plan limit. Empty when enforcement is off. */
  planLimitFilter: string;
}

export function buildRefreshEntitlementSql(enforcementOn: boolean): RefreshEntitlementSql {
  const entitledStatuses = ENTITLED_SUBSCRIPTION_STATUSES.map((v) => `'${v}'`).join(', ');
  return {
    entitlementJoin: enforcementOn
      ? `JOIN billing_customers bc ON bc.user_id = l.user_id
              JOIN billing_subscriptions bs ON bs.customer_id = bc.id
                AND bs.status IN (${entitledStatuses})`
      : '',
    planLimitFilter: enforcementOn ? 'AND l.over_plan_limit = FALSE' : '',
  };
}
