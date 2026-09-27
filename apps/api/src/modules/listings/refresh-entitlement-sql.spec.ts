import { ENTITLED_SUBSCRIPTION_STATUSES } from '@repo/shared';

import { buildRefreshEntitlementSql } from './refresh-entitlement-sql';

describe('buildRefreshEntitlementSql', () => {
  it('returns empty fragments when enforcement is off — byte-identical to the pre-entitlement query', () => {
    const result = buildRefreshEntitlementSql(false);
    expect(result.entitlementJoin).toBe('');
    expect(result.planLimitFilter).toBe('');
  });

  it('builds a JOIN restricted to the entitled subscription statuses when enforcement is on', () => {
    const result = buildRefreshEntitlementSql(true);
    expect(result.entitlementJoin).toContain('JOIN billing_customers bc ON bc.user_id = l.user_id');
    expect(result.entitlementJoin).toContain('JOIN billing_subscriptions bs ON bs.customer_id = bc.id');
    for (const status of ENTITLED_SUBSCRIPTION_STATUSES) {
      expect(result.entitlementJoin).toContain(`'${status}'`);
    }
  });

  it('excludes listings over the plan limit only when enforcement is on', () => {
    expect(buildRefreshEntitlementSql(true).planLimitFilter).toBe('AND l.over_plan_limit = FALSE');
    expect(buildRefreshEntitlementSql(false).planLimitFilter).toBe('');
  });
});
