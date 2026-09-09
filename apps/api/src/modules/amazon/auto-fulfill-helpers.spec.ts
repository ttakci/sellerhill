import { AutoFulfillBlockedReason, AutoFulfillStatus, OrderStatus } from '@repo/shared';

import {
  meetsCoarseCapGate,
  pickRoundRobinAccount,
  selectResumableOrders,
  shouldSkipFulfillStart,
  proxySessionToken,
} from './auto-fulfill-helpers';

describe('meetsCoarseCapGate', () => {
  it('passes when sale_total within cap', () => {
    expect(meetsCoarseCapGate(40, 50)).toBe(true);
  });
  it('passes at exact cap', () => {
    expect(meetsCoarseCapGate(50, 50)).toBe(true);
  });
  it('fails when over cap', () => {
    expect(meetsCoarseCapGate(60, 50)).toBe(false);
  });
  it('fails when cap is null (auto disabled)', () => {
    expect(meetsCoarseCapGate(40, null)).toBe(false);
  });
  it('fails when sale_total is zero/negative', () => {
    expect(meetsCoarseCapGate(0, 50)).toBe(false);
  });
});

describe('pickRoundRobinAccount', () => {
  const mk = (id: string, ts: number | null) => ({ id, lastUsedAt: ts === null ? null : new Date(ts) });
  it('returns null for empty pool', () => {
    expect(pickRoundRobinAccount([])).toBeNull();
  });
  it('picks the oldest lastUsedAt', () => {
    const pool = [mk('A', 300), mk('B', 100), mk('C', 200)];
    expect(pickRoundRobinAccount(pool)?.id).toBe('B');
  });
  it('treats null lastUsedAt as oldest (0)', () => {
    const pool = [mk('A', 100), mk('B', null)];
    expect(pickRoundRobinAccount(pool)?.id).toBe('B');
  });
  it('breaks ties by id ascending', () => {
    const pool = [mk('B', null), mk('A', null)];
    expect(pickRoundRobinAccount(pool)?.id).toBe('A');
  });
});

describe('shouldSkipFulfillStart', () => {
  it('skips terminal states (no double-order / no retry of deliberate stop)', () => {
    expect(shouldSkipFulfillStart(AutoFulfillStatus.PLACED)).toBe(true);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.BLOCKED)).toBe(true);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.DRY_RUN)).toBe(true);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.SKIPPED)).toBe(true);
  });
  it('allows (re)start on pending/running/failed', () => {
    expect(shouldSkipFulfillStart(AutoFulfillStatus.PENDING)).toBe(false);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.RUNNING)).toBe(false);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.FAILED)).toBe(false);
  });
});

describe('selectResumableOrders', () => {
  // A row that IS resumable — a suspension-blocked order the seller never
  // touched (no Amazon id, still pre-shipment on eBay).
  const blocked = (reason: AutoFulfillBlockedReason) => ({
    ebay_order_id: 'o1',
    auto_fulfill_status: AutoFulfillStatus.BLOCKED,
    auto_fulfill_blocked_reason: reason,
    status: OrderStatus.PROCESSING,
    amazon_order_id: null,
  });

  it('selects only orders blocked by subscription_suspended', () => {
    // Reviving a captcha / cap / out-of-stock block would re-run a purchase
    // refused for a reason payment does not change — and `cap` is a spend guard.
    const rows = [
      blocked(AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED),
      blocked(AutoFulfillBlockedReason.CAPTCHA),
      blocked(AutoFulfillBlockedReason.CAP),
      blocked(AutoFulfillBlockedReason.OUT_OF_STOCK),
    ];
    expect(selectResumableOrders(rows).map((r) => r.auto_fulfill_blocked_reason)).toEqual([
      AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED,
    ]);
  });

  it('leaves captcha, cap and out_of_stock blocks alone', () => {
    const rows = [
      blocked(AutoFulfillBlockedReason.CAPTCHA),
      blocked(AutoFulfillBlockedReason.CAP),
      blocked(AutoFulfillBlockedReason.OUT_OF_STOCK),
    ];
    expect(selectResumableOrders(rows)).toEqual([]);
  });

  it('does not select a non-BLOCKED row that still carries the suspended reason', () => {
    expect(
      selectResumableOrders([
        {
          ebay_order_id: 'o2',
          auto_fulfill_status: AutoFulfillStatus.PLACED,
          auto_fulfill_blocked_reason: AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED,
          status: OrderStatus.PROCESSING,
          amazon_order_id: null,
        },
      ]),
    ).toEqual([]);
  });

  it('is empty for an empty input', () => {
    expect(selectResumableOrders([])).toEqual([]);
  });

  // DUPLICATE-PURCHASE GUARD: an order the seller already handled by hand during
  // the lapse must NOT be re-armed for a second real Amazon purchase.
  it('excludes a row that already has an amazon_order_id (manual link / dry run)', () => {
    expect(
      selectResumableOrders([
        { ...blocked(AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED), amazon_order_id: 'AMZ-123' },
      ]),
    ).toEqual([]);
  });

  it('excludes a row whose eBay status is SHIPPED or COMPLETED', () => {
    expect(
      selectResumableOrders([
        { ...blocked(AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED), status: OrderStatus.SHIPPED },
        { ...blocked(AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED), status: OrderStatus.COMPLETED },
      ]),
    ).toEqual([]);
  });

  it('still selects a suspension block that is pre-shipment with no amazon id', () => {
    const row = { ...blocked(AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED), status: OrderStatus.WAITING_SHIPMENT };
    expect(selectResumableOrders([row])).toEqual([row]);
  });
});

describe('proxySessionToken', () => {
  it('perUser strategy uses userId', () => {
    expect(proxySessionToken('perUser', 'u1', 'a1')).toBe('u1');
  });
  it('perAccount strategy uses accountId', () => {
    expect(proxySessionToken('perAccount', 'u1', 'a1')).toBe('a1');
  });
});
