import {
  ACTIONABLE_ORDER_STAGES,
  AutoFulfillStatus,
  deriveOrderStage,
  isTrackingHeldOverdue,
  ORDER_STAGE_TABS,
  OrderStage,
  OrderStageTab,
  OrderStatus,
  TRACKING_HELD_ALARM_HOURS,
} from '@repo/shared';

const paid = { status: OrderStatus.WAITING_SHIPMENT };

describe('deriveOrderStage', () => {
  it('reads a paid order with no Amazon purchase as "to purchase" — automation off included', () => {
    expect(deriveOrderStage(paid)).toBe(OrderStage.TO_PURCHASE);
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.SKIPPED })).toBe(OrderStage.TO_PURCHASE);
  });

  it('never asks the seller to buy for an unpaid sale', () => {
    expect(deriveOrderStage({ status: OrderStatus.PENDING })).toBe(OrderStage.AWAITING_PAYMENT);
    expect(deriveOrderStage({ status: OrderStatus.PENDING, autoFulfillStatus: AutoFulfillStatus.SKIPPED })).toBe(
      OrderStage.AWAITING_PAYMENT
    );
  });

  it('reports a blocked or failed automatic purchase with no Amazon order as blocked', () => {
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.BLOCKED })).toBe(
      OrderStage.PURCHASE_BLOCKED
    );
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.FAILED })).toBe(
      OrderStage.PURCHASE_BLOCKED
    );
  });

  it('reports a blocked purchase the seller then linked by hand as purchased', () => {
    expect(
      deriveOrderStage({
        ...paid,
        autoFulfillStatus: AutoFulfillStatus.BLOCKED,
        amazonOrderId: '113-0158186-6357035',
      })
    ).toBe(OrderStage.PURCHASED);
  });

  it('reports queued and running automation as buying', () => {
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.PENDING })).toBe(OrderStage.BUYING);
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.RUNNING })).toBe(OrderStage.BUYING);
  });

  it('reports a placed or hand-linked Amazon order as purchased until Amazon ships it', () => {
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.PLACED, amazonOrderId: '111-1' })).toBe(
      OrderStage.PURCHASED
    );
    expect(deriveOrderStage({ ...paid, amazonOrderId: '111-1' })).toBe(OrderStage.PURCHASED);
  });

  it('holds once Amazon shipped but nothing reached eBay', () => {
    expect(deriveOrderStage({ ...paid, amazonOrderId: '111-1', shippedDetectedAt: '2026-09-30T00:00:00Z' })).toBe(
      OrderStage.TRACKING_HELD
    );
  });

  it('is shipped once eBay has the tracking, or the eBay status says so', () => {
    expect(
      deriveOrderStage({
        ...paid,
        amazonOrderId: '111-1',
        shippedDetectedAt: '2026-09-30T00:00:00Z',
        ebayTrackingPushedAt: '2026-09-30T01:00:00Z',
      })
    ).toBe(OrderStage.SHIPPED);
    // Legacy rows (pre-089) carry neither timestamp — the eBay status decides.
    expect(deriveOrderStage({ status: OrderStatus.SHIPPED })).toBe(OrderStage.SHIPPED);
  });

  it('is delivered on completed, cancelled on cancelled', () => {
    expect(deriveOrderStage({ status: OrderStatus.COMPLETED, amazonOrderId: '111-1' })).toBe(OrderStage.DELIVERED);
    expect(deriveOrderStage({ status: OrderStatus.CANCELLED })).toBe(OrderStage.CANCELLED);
  });

  it('a cancelled eBay sale outranks everything — there is no buyer left to serve', () => {
    expect(
      deriveOrderStage({
        status: OrderStatus.CANCELLED,
        amazonOrderId: '111-1',
        amazonCancelledAt: '2026-09-30T00:00:00Z',
      })
    ).toBe(OrderStage.CANCELLED);
    expect(
      deriveOrderStage({ status: OrderStatus.CANCELLED, autoFulfillStatus: AutoFulfillStatus.BLOCKED })
    ).toBe(OrderStage.CANCELLED);
    expect(
      deriveOrderStage({ status: OrderStatus.CANCELLED, shippedDetectedAt: '2026-09-30T00:00:00Z' })
    ).toBe(OrderStage.CANCELLED);
  });

  it('lets an Amazon cancellation outrank a shipped or purchased order, but not a settled one', () => {
    expect(
      deriveOrderStage({
        status: OrderStatus.SHIPPED,
        amazonOrderId: '111-1',
        amazonCancelledAt: '2026-09-30T00:00:00Z',
      })
    ).toBe(OrderStage.AMAZON_CANCELLED);
    expect(
      deriveOrderStage({
        status: OrderStatus.COMPLETED,
        amazonOrderId: '111-1',
        amazonCancelledAt: '2026-09-30T00:00:00Z',
      })
    ).toBe(OrderStage.DELIVERED);
  });

  it('never lets a dry run look purchased or shipped', () => {
    expect(deriveOrderStage({ ...paid, amazonOrderId: 'SIM-123', autoFulfillStatus: AutoFulfillStatus.DRY_RUN })).toBe(
      OrderStage.TEST_RUN
    );
    expect(deriveOrderStage({ ...paid, amazonOrderId: 'SIM-123', shippedDetectedAt: '2026-09-30T00:00:00Z' })).toBe(
      OrderStage.TEST_RUN
    );
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.DRY_RUN })).toBe(OrderStage.TEST_RUN);
  });

  it('a dry run the seller then bought by hand is a real purchase, not a test', () => {
    // The manual link writes a real Amazon order id but leaves auto_fulfill_status = dry_run.
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.DRY_RUN, amazonOrderId: '112-1' })).toBe(
      OrderStage.PURCHASED
    );
    expect(
      deriveOrderStage({
        ...paid,
        autoFulfillStatus: AutoFulfillStatus.DRY_RUN,
        amazonOrderId: '112-1',
        shippedDetectedAt: '2026-09-30T00:00:00Z',
      })
    ).toBe(OrderStage.TRACKING_HELD);
  });

  it('reads eBay IN_PROGRESS (processing) as shipped, never as something to buy', () => {
    expect(deriveOrderStage({ status: OrderStatus.PROCESSING })).toBe(OrderStage.SHIPPED);
    expect(deriveOrderStage({ status: OrderStatus.PROCESSING, autoFulfillStatus: AutoFulfillStatus.BLOCKED })).toBe(
      OrderStage.SHIPPED
    );
  });
});

describe('stage groupings', () => {
  it('flags exactly the stages a seller must act on', () => {
    expect([...ACTIONABLE_ORDER_STAGES].sort()).toEqual(
      [OrderStage.AMAZON_CANCELLED, OrderStage.TRACKING_HELD, OrderStage.PURCHASE_BLOCKED].sort()
    );
  });

  it('assigns every stage to exactly one tab besides ALL', () => {
    const tabs = Object.values(OrderStageTab).filter((t) => t !== OrderStageTab.ALL);
    for (const stage of Object.values(OrderStage)) {
      const owners = tabs.filter((t) => ORDER_STAGE_TABS[t].includes(stage));
      expect({ stage, owners }).toEqual({ stage, owners: [expect.any(String)] });
    }
    expect(ORDER_STAGE_TABS[OrderStageTab.ALL]).toEqual(Object.values(OrderStage));
  });
});

describe('isTrackingHeldOverdue', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  it(`turns red only after ${TRACKING_HELD_ALARM_HOURS} hours`, () => {
    expect(isTrackingHeldOverdue('2026-09-30T01:00:00Z', now)).toBe(false);
    expect(isTrackingHeldOverdue('2026-09-29T23:59:00Z', now)).toBe(true);
    expect(isTrackingHeldOverdue(null, now)).toBe(false);
  });
});
