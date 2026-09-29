import { hasUncommittedRefreshCheck } from './listing-revision-check';

describe('hasUncommittedRefreshCheck', () => {
  it('returns false when the product has never been refreshed', () => {
    expect(hasUncommittedRefreshCheck(null, null)).toBe(false);
    expect(hasUncommittedRefreshCheck(null, '2026-09-28T20:00:00.000Z')).toBe(false);
  });

  it('returns true when checked at least once and nothing has ever changed', () => {
    expect(hasUncommittedRefreshCheck('2026-09-29T05:00:00.000Z', null)).toBe(true);
  });

  it('returns true when the last check ran after the last recorded change', () => {
    expect(
      hasUncommittedRefreshCheck('2026-09-29T05:00:00.000Z', '2026-09-28T20:00:00.000Z')
    ).toBe(true);
  });

  it('returns false when the last recorded change is the same refresh that produced it', () => {
    // A revision's `recorded_at` is written slightly AFTER the same tick's
    // `last_successful_refresh_at` (the eBay push that creates the revision
    // happens after the refresh already stamped the check time) — so right
    // after a real change, checked <= revised, and no separate banner is due.
    expect(
      hasUncommittedRefreshCheck('2026-09-28T20:00:00.000Z', '2026-09-28T20:00:00.500Z')
    ).toBe(false);
  });

  it('returns false when the check time exactly equals the last revision time', () => {
    expect(
      hasUncommittedRefreshCheck('2026-09-28T20:00:00.000Z', '2026-09-28T20:00:00.000Z')
    ).toBe(false);
  });

  it('accepts Date instances as well as ISO strings', () => {
    expect(
      hasUncommittedRefreshCheck(
        new Date('2026-09-29T05:00:00.000Z'),
        new Date('2026-09-28T20:00:00.000Z')
      )
    ).toBe(true);
  });
});
