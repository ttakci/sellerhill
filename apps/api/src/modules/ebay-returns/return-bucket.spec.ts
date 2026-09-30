// apps/api/src/modules/ebay-returns/return-bucket.spec.ts
//
// `deriveReturnBucket` (TypeScript, the DTO's badge) and `buildReturnBucketSql`
// (Postgres, the tab filter, the sort and the counts) are one decision written
// twice. This spec covers every branch of the function, checks the SQL lists
// the buckets in the same priority order, and then interprets the generated
// CASE with a tiny evaluator and compares it with the function on every
// combination of inputs — so the two cannot drift apart silently. The
// evaluator throws on any SQL it does not understand.
//
// (The spec lives here rather than in packages/shared because the Jest harness
// runs from apps/api.)

import {
  ACTIONABLE_RETURN_BUCKETS,
  buildReturnBucketSql,
  deriveReturnBucket,
  EBAY_RETURN_CLOSED,
  EBAY_RETURN_STATUS_ESCALATED,
  RETURN_TABS,
  ReturnBucket,
  ReturnTab,
} from '@repo/shared';

const NOW = new Date('2026-09-30T12:00:00.000Z');
const PAST = '2026-09-29T12:00:00.000Z';
const FUTURE = '2026-10-02T12:00:00.000Z';

describe('deriveReturnBucket', () => {
  it('is CLOSED when the state is CLOSED', () => {
    expect(deriveReturnBucket({ state: EBAY_RETURN_CLOSED, status: 'RETURN_REQUESTED' }, NOW)).toBe(
      ReturnBucket.CLOSED
    );
  });

  it('is CLOSED when the status is CLOSED', () => {
    expect(deriveReturnBucket({ state: 'ITEM_SHIPPED', status: EBAY_RETURN_CLOSED }, NOW)).toBe(ReturnBucket.CLOSED);
  });

  it('stays CLOSED even when eBay still reports an overdue seller action', () => {
    expect(
      deriveReturnBucket(
        {
          state: EBAY_RETURN_CLOSED,
          status: EBAY_RETURN_CLOSED,
          sellerActivityDue: 'SELLER_ISSUE_REFUND',
          sellerRespondBy: PAST,
        },
        NOW
      )
    ).toBe(ReturnBucket.CLOSED);
  });

  it('is ESCALATED when the status is ESCALATED', () => {
    expect(deriveReturnBucket({ state: 'RETURN_REQUESTED', status: EBAY_RETURN_STATUS_ESCALATED }, NOW)).toBe(
      ReturnBucket.ESCALATED
    );
  });

  it('is ESCALATED ahead of a due seller action', () => {
    expect(
      deriveReturnBucket(
        { status: EBAY_RETURN_STATUS_ESCALATED, sellerActivityDue: 'SELLER_ISSUE_REFUND', sellerRespondBy: PAST },
        NOW
      )
    ).toBe(ReturnBucket.ESCALATED);
  });

  it('is ACTION_OVERDUE when a seller action is due and its deadline has passed', () => {
    expect(
      deriveReturnBucket(
        {
          state: 'RETURN_REQUESTED',
          status: 'RETURN_REQUESTED',
          sellerActivityDue: 'SELLER_APPROVE_REQUEST',
          sellerRespondBy: PAST,
        },
        NOW
      )
    ).toBe(ReturnBucket.ACTION_OVERDUE);
  });

  it('accepts the deadline as a Date', () => {
    expect(
      deriveReturnBucket({ sellerActivityDue: 'SELLER_APPROVE_REQUEST', sellerRespondBy: new Date(PAST) }, NOW)
    ).toBe(ReturnBucket.ACTION_OVERDUE);
  });

  it('is ACTION_DUE when a seller action is due with no deadline', () => {
    expect(deriveReturnBucket({ sellerActivityDue: 'SELLER_APPROVE_REQUEST', sellerRespondBy: null }, NOW)).toBe(
      ReturnBucket.ACTION_DUE
    );
  });

  it('is ACTION_DUE when a seller action is due and the deadline is in the future', () => {
    expect(deriveReturnBucket({ sellerActivityDue: 'SELLER_APPROVE_REQUEST', sellerRespondBy: FUTURE }, NOW)).toBe(
      ReturnBucket.ACTION_DUE
    );
  });

  it('is IN_PROGRESS when nothing is due from the seller', () => {
    expect(deriveReturnBucket({ state: 'ITEM_SHIPPED', status: 'ITEM_SHIPPED' }, NOW)).toBe(ReturnBucket.IN_PROGRESS);
  });

  it('ignores a deadline that has no action attached', () => {
    expect(deriveReturnBucket({ state: 'ITEM_SHIPPED', sellerActivityDue: null, sellerRespondBy: PAST }, NOW)).toBe(
      ReturnBucket.IN_PROGRESS
    );
  });

  it('is IN_PROGRESS for a row with nothing on it', () => {
    expect(deriveReturnBucket({}, NOW)).toBe(ReturnBucket.IN_PROGRESS);
  });
});

describe('return tabs', () => {
  it('lists every bucket under the ALL tab and only the actionable ones under ACTION', () => {
    expect([...RETURN_TABS[ReturnTab.ALL]].sort()).toEqual(Object.values(ReturnBucket).sort());
    expect(RETURN_TABS[ReturnTab.ACTION]).toEqual(ACTIONABLE_RETURN_BUCKETS);
  });

  it('puts every bucket under exactly one non-ALL tab', () => {
    const covered = [ReturnTab.ACTION, ReturnTab.IN_PROGRESS, ReturnTab.CLOSED].flatMap((tab) => [...RETURN_TABS[tab]]);
    expect(covered.sort()).toEqual(Object.values(ReturnBucket).sort());
  });
});

interface Row {
  state: string | null;
  status: string | null;
  seller_activity_due: string | null;
  /** ISO timestamp, compared with NOW. */
  seller_respond_by: string | null;
}

/** One `a AND b AND c` condition of the generated CASE. Throws on anything else. */
function evaluateCondition(condition: string, row: Row, alias: string): boolean {
  return condition.split(' AND ').every((rawTerm) => {
    const term = rawTerm.trim();

    const equals = term.match(new RegExp(`^${alias}\\.(state|status) = '([A-Z_]+)'$`));
    if (equals) {
      return row[equals[1] as 'state' | 'status'] === equals[2];
    }

    const notNull = term.match(new RegExp(`^${alias}\\.(seller_activity_due|seller_respond_by) IS NOT NULL$`));
    if (notNull) {
      return row[notNull[1] as 'seller_activity_due' | 'seller_respond_by'] !== null;
    }

    if (term === `${alias}.seller_respond_by < NOW()`) {
      // SQL three-valued logic: NULL < NOW() is not true.
      return row.seller_respond_by !== null && new Date(row.seller_respond_by).getTime() < NOW.getTime();
    }

    throw new Error(`Unrecognised SQL condition in the return bucket CASE: "${term}"`);
  });
}

interface CaseBranch {
  condition: string;
  bucket: string;
}

function parseCase(sql: string): { branches: CaseBranch[]; fallback: string } {
  const lines = sql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  expect(lines[0]).toBe('CASE');
  expect(lines[lines.length - 1]).toBe('END');

  const branches: CaseBranch[] = [];
  let fallback: string | null = null;
  for (const line of lines.slice(1, -1)) {
    const when = line.match(/^WHEN (.+) THEN '([a-z_]+)'$/);
    if (when) {
      // An ELSE must be the last line.
      expect(fallback).toBeNull();
      branches.push({ condition: when[1], bucket: when[2] });
      continue;
    }
    const otherwise = line.match(/^ELSE '([a-z_]+)'$/);
    if (otherwise) {
      fallback = otherwise[1];
      continue;
    }
    throw new Error(`Unrecognised line in the return bucket CASE: "${line}"`);
  }
  if (fallback === null) {
    throw new Error('The return bucket CASE has no ELSE branch');
  }
  return { branches, fallback };
}

function evaluateSql(sql: string, row: Row, alias: string): string {
  const { branches, fallback } = parseCase(sql);
  for (const branch of branches) {
    if (evaluateCondition(branch.condition, row, alias)) {
      return branch.bucket;
    }
  }
  return fallback;
}

describe('buildReturnBucketSql', () => {
  const sql = buildReturnBucketSql('r');

  it('has a branch for every ReturnBucket value, in the priority order of deriveReturnBucket', () => {
    const { branches, fallback } = parseCase(sql);
    const order = [...branches.map((branch) => branch.bucket), fallback];

    // Every bucket is reachable, and nothing else is produced.
    expect([...new Set(order)].sort()).toEqual(Object.values(ReturnBucket).sort());

    // First appearance of each bucket = its priority.
    expect([...new Set(order)]).toEqual([
      ReturnBucket.CLOSED,
      ReturnBucket.ESCALATED,
      ReturnBucket.ACTION_OVERDUE,
      ReturnBucket.ACTION_DUE,
      ReturnBucket.IN_PROGRESS,
    ]);
  });

  it('reads the row through the given alias only', () => {
    const aliased = buildReturnBucketSql('x');
    expect(aliased).toContain('x.state');
    expect(aliased).not.toMatch(/\br\./);
  });

  it('interpolates nothing but enum constants', () => {
    // No bind placeholder and no quote that could be closed from outside.
    expect(sql).not.toMatch(/\$\d/);
    const literals = [...sql.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    const allowed = new Set<string>([...Object.values(ReturnBucket), EBAY_RETURN_CLOSED, EBAY_RETURN_STATUS_ESCALATED]);
    for (const literal of literals) {
      expect(allowed.has(literal)).toBe(true);
    }
  });

  it('agrees with deriveReturnBucket on every combination of inputs', () => {
    const states = [null, EBAY_RETURN_CLOSED, 'RETURN_REQUESTED', 'ITEM_SHIPPED'];
    const statuses = [null, EBAY_RETURN_CLOSED, EBAY_RETURN_STATUS_ESCALATED, 'RETURN_REQUESTED'];
    const activities = [null, 'SELLER_APPROVE_REQUEST'];
    const deadlines = [null, PAST, FUTURE];

    let compared = 0;
    for (const state of states) {
      for (const status of statuses) {
        for (const activity of activities) {
          for (const deadline of deadlines) {
            const row: Row = {
              state,
              status,
              seller_activity_due: activity,
              seller_respond_by: deadline,
            };
            const fromSql = evaluateSql(sql, row, 'r');
            const fromTs = deriveReturnBucket(
              { state, status, sellerActivityDue: activity, sellerRespondBy: deadline },
              NOW
            );
            expect({ row, bucket: fromSql }).toEqual({ row, bucket: fromTs });
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBe(states.length * statuses.length * activities.length * deadlines.length);
  });
});
