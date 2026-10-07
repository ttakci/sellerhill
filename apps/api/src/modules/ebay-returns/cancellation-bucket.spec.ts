// apps/api/src/modules/ebay-returns/cancellation-bucket.spec.ts
//
// `deriveCancellationBucket` (TypeScript) and `buildCancellationBucketSql`
// (Postgres) are one decision written twice — the same check as
// `return-bucket.spec.ts`: every branch of the function, the SQL's priority
// order, and an interpreter for the generated CASE compared with the function
// on every combination of inputs. The evaluator throws on SQL it does not know.

import {
  ACTIONABLE_CANCELLATION_BUCKETS,
  buildCancellationBucketSql,
  CancellationBucket,
  deriveCancellationBucket,
  EBAY_CANCEL_REQUESTOR_BUYER,
  EBAY_CANCEL_STATE_CLOSED,
  RETURN_FRESHNESS_MIN_HOURS,
} from '@repo/shared';

import { buildStoreScopedCancellationBucketSql } from './return-store-scope';

const NOW = new Date('2026-10-07T12:00:00.000Z');
const PAST = '2026-10-06T12:00:00.000Z';
const FUTURE = '2026-10-09T12:00:00.000Z';
const SEEN_RECENTLY = '2026-10-07T11:00:00.000Z';
const SEEN_LONG_AGO = '2026-10-04T12:00:00.000Z';

describe('deriveCancellationBucket', () => {
  const open = { state: 'REFUND_PENDING', requestorType: EBAY_CANCEL_REQUESTOR_BUYER };

  it('is CLOSED once eBay reports a close date, whatever else it says', () => {
    expect(deriveCancellationBucket({ ...open, sellerRespondBy: PAST, closedAt: PAST }, NOW)).toBe(
      CancellationBucket.CLOSED
    );
  });

  it('is CLOSED on the CLOSED state alone', () => {
    expect(deriveCancellationBucket({ state: EBAY_CANCEL_STATE_CLOSED }, NOW)).toBe(CancellationBucket.CLOSED);
  });

  it('is ACTION_OVERDUE for a buyer request whose seller response date has passed', () => {
    expect(deriveCancellationBucket({ ...open, sellerRespondBy: PAST }, NOW)).toBe(CancellationBucket.ACTION_OVERDUE);
    expect(deriveCancellationBucket({ ...open, sellerRespondBy: new Date(PAST) }, NOW)).toBe(
      CancellationBucket.ACTION_OVERDUE
    );
  });

  it('is ACTION_DUE for a buyer request with a seller response date ahead', () => {
    expect(deriveCancellationBucket({ ...open, sellerRespondBy: FUTURE }, NOW)).toBe(CancellationBucket.ACTION_DUE);
  });

  it('is IN_PROGRESS without a seller response date, or for the seller’s own request', () => {
    expect(deriveCancellationBucket(open, NOW)).toBe(CancellationBucket.IN_PROGRESS);
    expect(deriveCancellationBucket({ requestorType: 'SELLER', sellerRespondBy: FUTURE }, NOW)).toBe(
      CancellationBucket.IN_PROGRESS
    );
    expect(deriveCancellationBucket({}, NOW)).toBe(CancellationBucket.IN_PROGRESS);
  });

  it('is UNCONFIRMED when no sweep confirmed an open row within the horizon; a closed row stays closed', () => {
    expect(deriveCancellationBucket({ ...open, sellerRespondBy: PAST, lastSyncedAt: SEEN_LONG_AGO }, NOW)).toBe(
      CancellationBucket.UNCONFIRMED
    );
    expect(deriveCancellationBucket({ ...open, sellerRespondBy: PAST, lastSyncedAt: SEEN_RECENTLY }, NOW)).toBe(
      CancellationBucket.ACTION_OVERDUE
    );
    expect(deriveCancellationBucket({ closedAt: PAST, lastSyncedAt: SEEN_LONG_AGO }, NOW)).toBe(
      CancellationBucket.CLOSED
    );
    // A longer horizon keeps the row.
    expect(deriveCancellationBucket({ ...open, sellerRespondBy: PAST, lastSyncedAt: SEEN_LONG_AGO }, NOW, 96)).toBe(
      CancellationBucket.ACTION_OVERDUE
    );
  });

  it('refuses a horizon that is not a whole number of hours', () => {
    expect(() => deriveCancellationBucket({ lastSyncedAt: SEEN_RECENTLY }, NOW, 1.5)).toThrow();
    expect(() => buildCancellationBucketSql('c', 0)).toThrow();
  });
});

interface Row {
  state: string | null;
  requestor_type: string | null;
  seller_respond_by: string | null;
  closed_at: string | null;
  last_synced_at: string | null;
}

function evaluateCondition(condition: string, row: Row, alias: string): boolean {
  return condition.split(' AND ').every((rawTerm) => {
    const term = rawTerm.trim();
    const equals = term.match(new RegExp(`^${alias}\\.(state|requestor_type) = '([A-Z_]+)'$`));
    if (equals) {
      return row[equals[1] as 'state' | 'requestor_type'] === equals[2];
    }
    const notNull = term.match(new RegExp(`^${alias}\\.(closed_at|seller_respond_by) IS NOT NULL$`));
    if (notNull) {
      return row[notNull[1] as 'closed_at' | 'seller_respond_by'] !== null;
    }
    if (term === `${alias}.seller_respond_by < NOW()`) {
      return row.seller_respond_by !== null && new Date(row.seller_respond_by).getTime() < NOW.getTime();
    }
    const stale = term.match(new RegExp(`^${alias}\\.last_synced_at < NOW\\(\\) - INTERVAL '(\\d+) hours'$`));
    if (stale) {
      const horizon = NOW.getTime() - Number(stale[1]) * 3_600_000;
      return row.last_synced_at !== null && new Date(row.last_synced_at).getTime() < horizon;
    }
    throw new Error(`Unrecognised SQL condition in the cancellation bucket CASE: "${term}"`);
  });
}

function parseCase(sql: string): { branches: Array<{ condition: string; bucket: string }>; fallback: string } {
  const lines = sql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  expect(lines[0]).toBe('CASE');
  expect(lines[lines.length - 1]).toBe('END');
  const branches: Array<{ condition: string; bucket: string }> = [];
  let fallback: string | null = null;
  for (const line of lines.slice(1, -1)) {
    const when = line.match(/^WHEN (.+) THEN '([a-z_]+)'$/);
    if (when) {
      expect(fallback).toBeNull();
      branches.push({ condition: when[1], bucket: when[2] });
      continue;
    }
    const otherwise = line.match(/^ELSE '([a-z_]+)'$/);
    if (otherwise) {
      fallback = otherwise[1];
      continue;
    }
    throw new Error(`Unrecognised line in the cancellation bucket CASE: "${line}"`);
  }
  if (fallback === null) {
    throw new Error('The cancellation bucket CASE has no ELSE branch');
  }
  return { branches, fallback };
}

function evaluateSql(sql: string, row: Row, alias: string): string {
  const { branches, fallback } = parseCase(sql);
  return branches.find((branch) => evaluateCondition(branch.condition, row, alias))?.bucket ?? fallback;
}

describe('buildCancellationBucketSql', () => {
  const sql = buildCancellationBucketSql('c');

  it('has a branch for every bucket, in the priority order of deriveCancellationBucket', () => {
    const { branches, fallback } = parseCase(sql);
    const order = [...new Set([...branches.map((branch) => branch.bucket), fallback])];
    expect([...order].sort()).toEqual(Object.values(CancellationBucket).sort());
    expect(order).toEqual([
      CancellationBucket.CLOSED,
      CancellationBucket.UNCONFIRMED,
      CancellationBucket.ACTION_OVERDUE,
      CancellationBucket.ACTION_DUE,
      CancellationBucket.IN_PROGRESS,
    ]);
  });

  it('interpolates nothing but constants and the whole-hour horizon', () => {
    expect(sql).not.toMatch(/\$\d/);
    const allowed = new Set<string>([
      ...Object.values(CancellationBucket),
      EBAY_CANCEL_STATE_CLOSED,
      EBAY_CANCEL_REQUESTOR_BUYER,
    ]);
    const others = [...sql.matchAll(/'([^']*)'/g)].map((m) => m[1]).filter((literal) => !allowed.has(literal));
    expect(others).toEqual([`${RETURN_FRESHNESS_MIN_HOURS} hours`]);
    expect(buildCancellationBucketSql('c', 48)).toContain("INTERVAL '48 hours'");
  });

  it('agrees with deriveCancellationBucket on every combination of inputs', () => {
    const states = [null, EBAY_CANCEL_STATE_CLOSED, 'REFUND_PENDING'];
    const requestors = [null, EBAY_CANCEL_REQUESTOR_BUYER, 'SELLER'];
    const deadlines = [null, PAST, FUTURE];
    const closes = [null, PAST];
    const sightings = [null, SEEN_RECENTLY, SEEN_LONG_AGO];
    let compared = 0;
    for (const state of states) {
      for (const requestor of requestors) {
        for (const deadline of deadlines) {
          for (const closed of closes) {
            for (const seen of sightings) {
              const row: Row = {
                state,
                requestor_type: requestor,
                seller_respond_by: deadline,
                closed_at: closed,
                last_synced_at: seen,
              };
              const fromTs = deriveCancellationBucket(
                { state, requestorType: requestor, sellerRespondBy: deadline, closedAt: closed, lastSyncedAt: seen },
                NOW
              );
              expect({ row, bucket: evaluateSql(sql, row, 'c') }).toEqual({ row, bucket: fromTs });
              compared += 1;
            }
          }
        }
      }
    }
    expect(compared).toBe(states.length * requestors.length * deadlines.length * closes.length * sightings.length);
  });

  it('is store-scoped for seller-facing reads: an action on a store that is not active reads as unconfirmed', () => {
    const scoped = buildStoreScopedCancellationBucketSql('c', 24);
    expect(scoped).toContain(
      `IN (${ACTIONABLE_CANCELLATION_BUCKETS.map((b) => `'${b}'`).join(', ')}) AND NOT EXISTS (SELECT 1 FROM ebay_accounts ret_store WHERE ret_store.id = c.ebay_account_id AND ret_store.status = 'active') THEN '${CancellationBucket.UNCONFIRMED}'`
    );
  });
});
