import { ListingFailureCode, SELLER_CAUSED_LISTING_FAILURE_CODES } from '@repo/shared';

import { AdminListingFailuresService } from './admin-listing-failures.service';

/**
 * The operator panel exists for the failures only an operator can diagnose —
 * the provider's raw text. A seller's own blacklist, a duplicate they already
 * listed, a quantity their own buffer drove to 0, their plan limit, their
 * cancel: none carries provider text, the seller already sees the reason, and
 * the operator can do nothing about it. Listed by default they buried the one
 * failure that mattered (a Picture Policy refusal mislabelled as a policy
 * problem) under dozens of blacklist rows.
 */
function fakeDb() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    query: (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return Promise.resolve([]);
    },
  };
  return { svc: new AdminListingFailuresService(db as never), calls };
}

describe('SELLER_CAUSED_LISTING_FAILURE_CODES', () => {
  it('is exactly the failures the seller causes and already sees', () => {
    expect([...SELLER_CAUSED_LISTING_FAILURE_CODES].sort()).toEqual(
      [
        ListingFailureCode.BLACKLISTED_KEYWORD,
        // The seller's own listing rules (blocked ASIN, VeRO protection, price
        // range, rating…) — same class as their blacklist.
        ListingFailureCode.BLOCKED_BY_RULE,
        ListingFailureCode.DUPLICATE_LISTING,
        ListingFailureCode.ZERO_STOCK,
        ListingFailureCode.QUOTA_EXHAUSTED,
        ListingFailureCode.CANCELLED,
      ].sort()
    );
  });
});

describe('AdminListingFailuresService.list', () => {
  it('leaves seller-caused failures out by default — list and breakdown alike', async () => {
    const { svc, calls } = fakeDb();
    await svc.list({});
    expect(calls).toHaveLength(2);
    for (const { sql, params } of calls) {
      expect(sql).toMatch(/i\.failure_code IS NULL OR NOT \(i\.failure_code = ANY\(\$\d+\)\)/);
      expect(params).toContainEqual([...SELLER_CAUSED_LISTING_FAILURE_CODES]);
    }
  });

  it('shows them when the operator asks for that code explicitly', async () => {
    const { svc, calls } = fakeDb();
    await svc.list({ failureCode: ListingFailureCode.BLACKLISTED_KEYWORD });
    const [list] = calls;
    expect(list.sql).not.toMatch(/ANY\(/);
    expect(list.params).toContain(ListingFailureCode.BLACKLISTED_KEYWORD);
  });
});
