import {
  ActionCenterGroup,
  ActionCenterItemKey,
  ActionCenterSeverity,
  type ActionCenterItemDto,
} from '@repo/shared';

import {
  buildActionCenterSummary,
  buildBreakdown,
  buildSetupItems,
  daysUntil,
  highestSeverity,
  resolveQuotaSeverity,
  type SetupCounts,
} from './action-center.helpers';

const NOW = new Date('2026-08-12T10:00:00.000Z');

function item(overrides: Partial<ActionCenterItemDto> = {}): ActionCenterItemDto {
  return {
    key: ActionCenterItemKey.ORDER_UNTRACKED,
    group: ActionCenterGroup.ORDERS,
    severity: ActionCenterSeverity.INFO,
    count: 1,
    actionPath: null,
    ...overrides,
  };
}

describe('resolveQuotaSeverity', () => {
  it('says nothing while the plan has comfortable headroom', () => {
    expect(resolveQuotaSeverity(100, 1500)).toBeNull();
    expect(resolveQuotaSeverity(1199, 1500)).toBeNull();
  });

  it('warns from 80% and escalates at the limit', () => {
    expect(resolveQuotaSeverity(1200, 1500)).toBe(ActionCenterSeverity.WARNING);
    expect(resolveQuotaSeverity(1500, 1500)).toBe(ActionCenterSeverity.CRITICAL);
    expect(resolveQuotaSeverity(1800, 1500)).toBe(ActionCenterSeverity.CRITICAL);
  });

  it('treats a non-positive limit as unlimited rather than as instantly exhausted', () => {
    // `-1` is the plan snapshot's "unlimited". Dividing by it would report a
    // permanent, unfixable emergency on every unlimited plan.
    expect(resolveQuotaSeverity(9_999, -1)).toBeNull();
    expect(resolveQuotaSeverity(9_999, 0)).toBeNull();
  });

  it('reports nothing for unusable numbers instead of guessing', () => {
    expect(resolveQuotaSeverity(Number.NaN, 100)).toBeNull();
    expect(resolveQuotaSeverity(10, Number.NaN)).toBeNull();
  });
});

describe('daysUntil', () => {
  it('rounds a partial day up so "6 hours left" never reads as 0 days', () => {
    expect(daysUntil(new Date('2026-08-12T16:00:00.000Z'), NOW)).toBe(1);
  });

  it('counts whole days', () => {
    expect(daysUntil(new Date('2026-08-15T10:00:00.000Z'), NOW)).toBe(3);
  });

  it('floors at zero for a date already past', () => {
    expect(daysUntil(new Date('2026-08-01T10:00:00.000Z'), NOW)).toBe(0);
  });
});

describe('highestSeverity', () => {
  it('returns the worst present', () => {
    expect(
      highestSeverity([
        ActionCenterSeverity.INFO,
        ActionCenterSeverity.CRITICAL,
        ActionCenterSeverity.WARNING,
      ]),
    ).toBe(ActionCenterSeverity.CRITICAL);
  });

  it('defaults an empty list to INFO', () => {
    expect(highestSeverity([])).toBe(ActionCenterSeverity.INFO);
  });
});

describe('buildBreakdown', () => {
  it('sorts by count and drops reasons that never occurred', () => {
    expect(buildBreakdown({ cap: 3, captcha: 8, address: 0 })).toEqual([
      { code: 'captcha', count: 8 },
      { code: 'cap', count: 3 },
    ]);
  });

  it('breaks ties on the code so polling does not reshuffle the list', () => {
    expect(buildBreakdown({ zeta: 2, alpha: 2 })).toEqual([
      { code: 'alpha', count: 2 },
      { code: 'zeta', count: 2 },
    ]);
  });

  it('caps the number of reasons shown', () => {
    expect(buildBreakdown({ a: 5, b: 4, c: 3, d: 2, e: 1 }, 3)).toHaveLength(3);
  });
});

describe('buildActionCenterSummary', () => {
  it('omits zero-count items so the badge equals what is actually waiting', () => {
    const summary = buildActionCenterSummary(
      [
        item({ key: ActionCenterItemKey.ORDER_UNTRACKED, count: 0 }),
        item({ key: ActionCenterItemKey.ORDER_AWAITING_PURCHASE, count: 4 }),
      ],
      NOW,
    );

    expect(summary.totalCount).toBe(1);
    expect(summary.groups[0].items).toHaveLength(1);
    expect(summary.groups[0].items[0].key).toBe(ActionCenterItemKey.ORDER_AWAITING_PURCHASE);
  });

  it('omits a group whose items all resolved, leaving no empty headings', () => {
    const summary = buildActionCenterSummary(
      [
        item({ group: ActionCenterGroup.ORDERS, count: 0 }),
        item({
          key: ActionCenterItemKey.LISTING_DRAFTS_PENDING,
          group: ActionCenterGroup.LISTINGS,
          count: 2,
        }),
      ],
      NOW,
    );

    expect(summary.groups.map((g) => g.key)).toEqual([ActionCenterGroup.LISTINGS]);
  });

  it('rolls a group up to its worst item severity', () => {
    const summary = buildActionCenterSummary(
      [
        item({ key: ActionCenterItemKey.ORDER_UNTRACKED, severity: ActionCenterSeverity.INFO }),
        item({
          key: ActionCenterItemKey.ORDER_AMAZON_CANCELLED,
          severity: ActionCenterSeverity.CRITICAL,
        }),
      ],
      NOW,
    );

    expect(summary.groups[0].severity).toBe(ActionCenterSeverity.CRITICAL);
  });

  it('orders items by severity, then by size', () => {
    const summary = buildActionCenterSummary(
      [
        item({ key: ActionCenterItemKey.ORDER_UNTRACKED, severity: ActionCenterSeverity.INFO, count: 99 }),
        item({
          key: ActionCenterItemKey.ORDER_AWAITING_PURCHASE,
          severity: ActionCenterSeverity.WARNING,
          count: 1,
        }),
        item({
          key: ActionCenterItemKey.ORDER_AMAZON_CANCELLED,
          severity: ActionCenterSeverity.CRITICAL,
          count: 2,
        }),
      ],
      NOW,
    );

    expect(summary.groups[0].items.map((i) => i.key)).toEqual([
      ActionCenterItemKey.ORDER_AMAZON_CANCELLED,
      ActionCenterItemKey.ORDER_AWAITING_PURCHASE,
      ActionCenterItemKey.ORDER_UNTRACKED,
    ]);
  });

  it('keeps groups in declaration order regardless of input order', () => {
    const summary = buildActionCenterSummary(
      [
        item({ key: ActionCenterItemKey.PLAN_PAST_DUE, group: ActionCenterGroup.PLAN }),
        item({ key: ActionCenterItemKey.ORDER_UNTRACKED, group: ActionCenterGroup.ORDERS }),
        item({
          key: ActionCenterItemKey.LISTING_DRAFTS_PENDING,
          group: ActionCenterGroup.LISTINGS,
        }),
      ],
      NOW,
    );

    expect(summary.groups.map((g) => g.key)).toEqual([
      ActionCenterGroup.ORDERS,
      ActionCenterGroup.LISTINGS,
      ActionCenterGroup.PLAN,
    ]);
  });

  it('counts conditions, not underlying rows, so the badge stays readable', () => {
    const summary = buildActionCenterSummary(
      [
        item({
          key: ActionCenterItemKey.ORDER_AMAZON_CANCELLED,
          severity: ActionCenterSeverity.CRITICAL,
          count: 431,
        }),
        item({
          key: ActionCenterItemKey.LISTING_DRAFTS_PENDING,
          group: ActionCenterGroup.LISTINGS,
          severity: ActionCenterSeverity.INFO,
          count: 12,
        }),
      ],
      NOW,
    );

    expect(summary.totalCount).toBe(2);
    expect(summary.criticalCount).toBe(1);
    expect(summary.warningCount).toBe(0);
    expect(summary.infoCount).toBe(1);
  });

  it('produces an empty, well-formed snapshot when nothing is waiting', () => {
    const summary = buildActionCenterSummary([], NOW);

    expect(summary).toEqual({
      totalCount: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      groups: [],
      generatedAt: NOW.toISOString(),
    });
  });
});

function setupCounts(overrides: Partial<SetupCounts> = {}): SetupCounts {
  return {
    ebayCount: 1,
    amazonCount: 1,
    automatedCount: 1,
    storeSettingsCount: 1,
    listingGroupCount: 1,
    ...overrides,
  };
}

describe('buildSetupItems', () => {
  it('shows only the eBay item when no eBay account exists, regardless of everything else', () => {
    const items = buildSetupItems(
      setupCounts({ ebayCount: 0, amazonCount: 0, automatedCount: 0, storeSettingsCount: 0, listingGroupCount: 0 }),
    );

    expect(items).toHaveLength(1);
    expect(items[0].key).toBe(ActionCenterItemKey.SETUP_NO_EBAY_STORE);
  });

  it('reports every unmet foundational gap together once eBay is connected', () => {
    const items = buildSetupItems(
      setupCounts({ amazonCount: 0, automatedCount: 0, storeSettingsCount: 0, listingGroupCount: 0 }),
    );

    expect(items.map((i) => i.key)).toEqual([
      ActionCenterItemKey.SETUP_NO_AMAZON_ACCOUNT,
      ActionCenterItemKey.SETUP_NO_STORE_SETTINGS,
      ActionCenterItemKey.SETUP_NO_LISTING_SETTINGS_GROUP,
    ]);
  });

  it('does not report auto-fulfill readiness before an Amazon account exists', () => {
    const items = buildSetupItems(setupCounts({ amazonCount: 0, automatedCount: 0 }));

    expect(items.map((i) => i.key)).not.toContain(ActionCenterItemKey.SETUP_AUTO_FULFILL_OFF);
  });

  it('reports auto-fulfill readiness once an Amazon account exists but none is cleared to buy', () => {
    const items = buildSetupItems(setupCounts({ automatedCount: 0, storeSettingsCount: 0 }));

    expect(items.map((i) => i.key)).toEqual([
      ActionCenterItemKey.SETUP_NO_STORE_SETTINGS,
      ActionCenterItemKey.SETUP_AUTO_FULFILL_OFF,
    ]);
    // The two Amazon-related items never co-occur for the same gap.
    expect(items.map((i) => i.key)).not.toContain(ActionCenterItemKey.SETUP_NO_AMAZON_ACCOUNT);
  });

  it('returns nothing once every foundational condition is satisfied', () => {
    expect(buildSetupItems(setupCounts())).toEqual([]);
  });

  it('every item carries count 1 and an INFO severity in the setup group', () => {
    const items = buildSetupItems(setupCounts({ ebayCount: 0 }));

    expect(items[0]).toMatchObject({
      group: ActionCenterGroup.SETUP,
      severity: ActionCenterSeverity.INFO,
      count: 1,
    });
  });
});
