import { AutoFulfillBlockedReason, AutoFulfillStatus, OrderStatus } from '@repo/shared';

import {
  decideFulfillStart,
  decidePrePurchase,
  estimateAmazonOrderCost,
  exceedsLossLimit,
  FulfillStartDecision,
  meetsCoarseCapGate,
  pickRoundRobinAccount,
  resolveAutoFulfillEligibility,
  selectResumableOrders,
  shouldSkipFulfillStart,
  proxySessionToken,
} from './auto-fulfill-helpers';

describe('estimateAmazonOrderCost', () => {
  it('is unit price x quantity plus the configured tax rate', () => {
    expect(estimateAmazonOrderCost({ unitPrice: 10, quantity: 1, taxRatePct: 0 })).toBe(10);
    expect(estimateAmazonOrderCost({ unitPrice: 10, quantity: 3, taxRatePct: 0 })).toBe(30);
    expect(estimateAmazonOrderCost({ unitPrice: 12.99, quantity: 2, taxRatePct: 8 })).toBe(28.06);
  });
  it('is null — never a guess — when the price is unknown', () => {
    for (const unitPrice of [null, undefined, 0, -1, Number.NaN]) {
      expect(estimateAmazonOrderCost({ unitPrice, quantity: 2, taxRatePct: 8 })).toBeNull();
    }
  });
  it('reads a missing or broken quantity as 1 and a negative tax rate as 0', () => {
    expect(estimateAmazonOrderCost({ unitPrice: 10, quantity: null, taxRatePct: -5 })).toBe(10);
    expect(estimateAmazonOrderCost({ unitPrice: 10, quantity: 0, taxRatePct: undefined })).toBe(10);
  });
});

describe('meetsCoarseCapGate', () => {
  it('passes when the estimated Amazon cost is within the cap', () => {
    expect(meetsCoarseCapGate(40, 50)).toBe(true);
  });
  it('passes at exact cap', () => {
    expect(meetsCoarseCapGate(50, 50)).toBe(true);
  });
  it('fails when the estimate is over the cap', () => {
    expect(meetsCoarseCapGate(60, 50)).toBe(false);
  });
  it('fails when cap is null (auto disabled)', () => {
    expect(meetsCoarseCapGate(40, null)).toBe(false);
    expect(meetsCoarseCapGate(null, null)).toBe(false);
  });
  it('passes an UNKNOWN estimate through to the review-step hard cap', () => {
    expect(meetsCoarseCapGate(null, 50)).toBe(true);
  });
});

describe('exceedsLossLimit', () => {
  it('is off when the seller set no limit', () => {
    expect(exceedsLossLimit({ grandTotal: 100, ebayEarnings: 10, maxLoss: null })).toBe(false);
    expect(exceedsLossLimit({ grandTotal: 100, ebayEarnings: 10, maxLoss: undefined })).toBe(false);
  });
  it('blocks only a loss LARGER than the limit', () => {
    expect(exceedsLossLimit({ grandTotal: 12, ebayEarnings: 10, maxLoss: 0 })).toBe(true);
    expect(exceedsLossLimit({ grandTotal: 10, ebayEarnings: 10, maxLoss: 0 })).toBe(false);
    expect(exceedsLossLimit({ grandTotal: 9, ebayEarnings: 10, maxLoss: 0 })).toBe(false);
    expect(exceedsLossLimit({ grandTotal: 13, ebayEarnings: 10, maxLoss: 3 })).toBe(false);
    expect(exceedsLossLimit({ grandTotal: 13.01, ebayEarnings: 10, maxLoss: 3 })).toBe(true);
  });
  it('never blocks on an unknown payout or a broken limit', () => {
    for (const ebayEarnings of [null, undefined, 0, Number.NaN]) {
      expect(exceedsLossLimit({ grandTotal: 100, ebayEarnings, maxLoss: 0 })).toBe(false);
    }
    expect(exceedsLossLimit({ grandTotal: 100, ebayEarnings: 10, maxLoss: -1 })).toBe(false);
    expect(exceedsLossLimit({ grandTotal: 100, ebayEarnings: 10, maxLoss: Number.NaN })).toBe(false);
  });
});

describe('decidePrePurchase', () => {
  const live = {
    status: OrderStatus.WAITING_SHIPMENT,
    cancelState: 'NONE_REQUESTED',
    cancelRequestCount: 0,
    lineItemCount: 1,
    manual: false,
  };

  it('proceeds for a paid, unshipped, single-item sale with no cancel request', () => {
    expect(decidePrePurchase(live)).toEqual({ proceed: true });
    expect(decidePrePurchase({ ...live, cancelState: null })).toEqual({ proceed: true });
  });

  it('skips a sale eBay now reports cancelled, fulfilled or unpaid', () => {
    expect(decidePrePurchase({ ...live, status: OrderStatus.CANCELLED })).toEqual({
      proceed: false,
      status: AutoFulfillStatus.SKIPPED,
      reason: AutoFulfillBlockedReason.ORDER_CANCELLED,
    });
    expect(decidePrePurchase({ ...live, status: OrderStatus.SHIPPED })).toEqual({
      proceed: false,
      status: AutoFulfillStatus.SKIPPED,
      reason: AutoFulfillBlockedReason.ORDER_ALREADY_FULFILLED,
    });
    expect(decidePrePurchase({ ...live, status: OrderStatus.PENDING })).toEqual({
      proceed: false,
      status: AutoFulfillStatus.SKIPPED,
      reason: AutoFulfillBlockedReason.ORDER_NOT_PAID,
    });
  });

  it('never buys one line of a multi-item order — not even on a manual start', () => {
    for (const manual of [false, true]) {
      expect(decidePrePurchase({ ...live, lineItemCount: 2, manual })).toEqual({
        proceed: false,
        status: AutoFulfillStatus.SKIPPED,
        reason: AutoFulfillBlockedReason.MULTI_ITEM_ORDER,
      });
    }
  });

  it('holds an automatic purchase while a cancel request is open', () => {
    const held = {
      proceed: false,
      status: AutoFulfillStatus.BLOCKED,
      reason: AutoFulfillBlockedReason.CANCEL_REQUESTED,
    };
    expect(decidePrePurchase({ ...live, cancelRequestCount: 1 })).toEqual(held);
    // Any state other than the documented "no request" value, enum list unknown.
    expect(decidePrePurchase({ ...live, cancelState: 'IN_PROGRESS' })).toEqual(held);
  });

  it('lets the seller override the cancel-request hold by hand, and nothing else', () => {
    expect(decidePrePurchase({ ...live, cancelRequestCount: 1, manual: true })).toEqual({ proceed: true });
    expect(decidePrePurchase({ ...live, status: OrderStatus.CANCELLED, manual: true }).proceed).toBe(false);
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
  it('prefers a healthy account over an older unhealthy one', () => {
    const pool = [
      { ...mk('A', 100), healthy: false },
      { ...mk('B', 300), healthy: true },
      { ...mk('C', 200), healthy: true },
    ];
    expect(pickRoundRobinAccount(pool)?.id).toBe('C');
  });
  it('falls back to the whole pool when no account is healthy', () => {
    const pool = [
      { ...mk('A', 200), healthy: false },
      { ...mk('B', 100), healthy: false },
    ];
    expect(pickRoundRobinAccount(pool)?.id).toBe('B');
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

describe('decideFulfillStart', () => {
  it('skips every terminal state', () => {
    for (const status of [
      AutoFulfillStatus.PLACED,
      AutoFulfillStatus.BLOCKED,
      AutoFulfillStatus.DRY_RUN,
      AutoFulfillStatus.SKIPPED,
    ]) {
      expect(decideFulfillStart(status, null)).toBe(FulfillStartDecision.SKIP);
    }
  });

  it('proceeds from pending and failed', () => {
    expect(decideFulfillStart(AutoFulfillStatus.PENDING, null)).toBe(FulfillStartDecision.PROCEED);
    expect(decideFulfillStart(AutoFulfillStatus.FAILED, null)).toBe(FulfillStartDecision.PROCEED);
  });

  // RUNNING at job start = the previous process died. With NO click stamp it
  // died before the Place Order click, so nothing was bought and re-entering
  // the checkout is safe.
  it('re-enters a RUNNING row that carries no click stamp', () => {
    expect(decideFulfillStart(AutoFulfillStatus.RUNNING, null)).toBe(FulfillStartDecision.PROCEED);
    expect(decideFulfillStart(AutoFulfillStatus.RUNNING, undefined)).toBe(FulfillStartDecision.PROCEED);
  });

  // The stamp is written immediately before the click. Once it is set, only a
  // PLACED row is "done"; every other status may hide a real Amazon order.
  it('never enters the checkout once the click was stamped, whatever the status', () => {
    const stamp = '2026-10-01T10:00:00Z';
    for (const status of Object.values(AutoFulfillStatus).filter((s) => s !== AutoFulfillStatus.PLACED)) {
      expect(decideFulfillStart(status, stamp)).toBe(FulfillStartDecision.UNKNOWN_OUTCOME);
    }
    expect(decideFulfillStart(AutoFulfillStatus.PLACED, stamp)).toBe(FulfillStartDecision.SKIP);
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

  it('excludes a row whose eBay sale was cancelled during the lapse', () => {
    expect(
      selectResumableOrders([
        { ...blocked(AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED), status: OrderStatus.CANCELLED },
      ]),
    ).toEqual([]);
  });

  it('excludes a row whose Place Order click was stamped — it may already be bought', () => {
    expect(
      selectResumableOrders([
        {
          ...blocked(AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED),
          auto_fulfill_submitted_at: '2026-10-01T10:00:00Z',
        },
      ]),
    ).toEqual([]);
  });

  it('still selects a suspension block that is pre-shipment with no amazon id', () => {
    const row = { ...blocked(AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED), status: OrderStatus.WAITING_SHIPMENT };
    expect(selectResumableOrders([row])).toEqual([row]);
  });
});

describe('resolveAutoFulfillEligibility', () => {
  it('allows only a paid, unshipped order', () => {
    expect(resolveAutoFulfillEligibility(OrderStatus.WAITING_SHIPMENT)).toEqual({ eligible: true });
  });

  it('refuses an order eBay already fulfilled', () => {
    // The returning-seller case: a settled backlog must not be re-purchased.
    for (const status of [OrderStatus.SHIPPED, OrderStatus.COMPLETED, OrderStatus.PROCESSING]) {
      expect(resolveAutoFulfillEligibility(status)).toEqual({
        eligible: false,
        reason: AutoFulfillBlockedReason.ORDER_ALREADY_FULFILLED,
      });
    }
  });

  it('refuses an unpaid order, and reports it as unpaid rather than fulfilled', () => {
    // The two reasons send the seller to different places, and PENDING also
    // covers "eBay reported no fulfilment status", which must fail closed.
    expect(resolveAutoFulfillEligibility(OrderStatus.PENDING)).toEqual({
      eligible: false,
      reason: AutoFulfillBlockedReason.ORDER_NOT_PAID,
    });
  });

  it('refuses a cancelled sale with its own reason, so the unpaid recheck stops asking about it', () => {
    expect(resolveAutoFulfillEligibility(OrderStatus.CANCELLED)).toEqual({
      eligible: false,
      reason: AutoFulfillBlockedReason.ORDER_CANCELLED,
    });
  });

  it('refuses every status the resume sweep refuses', () => {
    // The two rules are written independently but must not disagree: anything
    // `selectResumableOrders` excludes as already-served has to be ineligible
    // here too, or the insert path would buy what the sweep refuses to re-arm.
    for (const status of [OrderStatus.SHIPPED, OrderStatus.COMPLETED, OrderStatus.CANCELLED]) {
      expect(resolveAutoFulfillEligibility(status).eligible).toBe(false);
    }
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
