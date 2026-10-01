// apps/api/src/modules/orders/order-timeline.spec.ts
//
// `buildOrderTimeline` (packages/shared) — the order detail page's steps.
// The Jest harness runs from apps/api, so the shared builder is covered here.

import {
  AutoFulfillStatus,
  BuyerMessageEventType,
  BuyerMessageStatus,
  OrderStage,
  OrderTimelineNote,
  OrderTimelineStepKey,
  OrderTimelineStepState,
  buildOrderTimeline,
  type OrderTimelineInput,
  type OrderTimelineStepDto,
} from '@repo/shared';

const NOW = new Date('2026-10-01T12:00:00.000Z');
const ORDERED = '2026-09-30T16:30:00.000Z';

const build = (input: Partial<OrderTimelineInput> & { stage: OrderStage }): OrderTimelineStepDto[] =>
  buildOrderTimeline({ orderDate: ORDERED, now: NOW, ...input });

const byKey = (steps: OrderTimelineStepDto[], key: OrderTimelineStepKey): OrderTimelineStepDto | undefined =>
  steps.find((s) => s.key === key);

const shape = (steps: OrderTimelineStepDto[]): string[] => steps.map((s) => `${s.key}:${s.state}:${s.note}`);

describe('buildOrderTimeline', () => {
  it('a paid order nobody bought yet stands on the purchase step', () => {
    const steps = build({ stage: OrderStage.TO_PURCHASE, autoFulfillStatus: AutoFulfillStatus.SKIPPED });
    expect(shape(steps)).toEqual([
      'received:done:received',
      'purchase:current:stage',
      'amazon_shipped:upcoming:upcoming_shipment',
      'ebay_tracking:upcoming:upcoming_tracking',
      'delivered:upcoming:upcoming_delivery',
    ]);
    expect(steps[0].at).toBe(ORDERED);
    expect(steps[1].at).toBeNull();
  });

  it('a blocked purchase needs the seller and carries the attempt time', () => {
    const steps = build({
      stage: OrderStage.PURCHASE_BLOCKED,
      autoFulfillStatus: AutoFulfillStatus.BLOCKED,
      autoFulfillAttemptedAt: '2026-09-30T16:40:00.000Z',
    });
    const purchase = byKey(steps, OrderTimelineStepKey.PURCHASE);
    expect(purchase).toMatchObject({
      state: OrderTimelineStepState.ATTENTION,
      note: OrderTimelineNote.STAGE,
      at: '2026-09-30T16:40:00.000Z',
    });
  });

  it('an unknown outcome is dated by the click, not by the attempt', () => {
    const steps = build({
      stage: OrderStage.PURCHASE_UNKNOWN,
      autoFulfillStatus: AutoFulfillStatus.BLOCKED,
      autoFulfillAttemptedAt: '2026-09-30T16:40:00.000Z',
      autoFulfillSubmittedAt: '2026-09-30T16:44:00.000Z',
    });
    expect(byKey(steps, OrderTimelineStepKey.PURCHASE)).toMatchObject({
      state: OrderTimelineStepState.ATTENTION,
      at: '2026-09-30T16:44:00.000Z',
    });
  });

  it('an automatic purchase is done, names the Amazon order, and waits for shipment', () => {
    const steps = build({
      stage: OrderStage.PURCHASED,
      autoFulfillStatus: AutoFulfillStatus.PLACED,
      amazonOrderId: '111-3414784-0209034',
      amazonLinkedAt: '2026-09-30T17:00:00.000Z',
    });
    expect(shape(steps)).toEqual([
      'received:done:received',
      'purchase:done:bought_auto',
      'amazon_shipped:current:waiting_shipment',
      'ebay_tracking:upcoming:upcoming_tracking',
      'delivered:upcoming:upcoming_delivery',
    ]);
    expect(byKey(steps, OrderTimelineStepKey.PURCHASE)).toMatchObject({
      at: '2026-09-30T17:00:00.000Z',
      reference: '111-3414784-0209034',
    });
  });

  it('PLACED before the order number was read is dated by the click', () => {
    const steps = build({
      stage: OrderStage.PURCHASED,
      autoFulfillStatus: AutoFulfillStatus.PLACED,
      autoFulfillSubmittedAt: '2026-09-30T16:44:00.000Z',
    });
    expect(byKey(steps, OrderTimelineStepKey.PURCHASE)).toMatchObject({
      state: OrderTimelineStepState.DONE,
      note: OrderTimelineNote.BOUGHT_AUTO,
      at: '2026-09-30T16:44:00.000Z',
      reference: null,
    });
  });

  it('an order linked by hand after a blocked attempt reads as linked, not as bought automatically', () => {
    const steps = build({
      stage: OrderStage.PURCHASED,
      autoFulfillStatus: AutoFulfillStatus.BLOCKED,
      amazonOrderId: '113-0158186-6357035',
    });
    expect(byKey(steps, OrderTimelineStepKey.PURCHASE)).toMatchObject({
      state: OrderTimelineStepState.DONE,
      note: OrderTimelineNote.BOUGHT_LINKED,
      at: null,
    });
  });

  it('a dry run never reads as a purchase', () => {
    const steps = build({
      stage: OrderStage.TEST_RUN,
      autoFulfillStatus: AutoFulfillStatus.DRY_RUN,
      amazonOrderId: 'SIM-123',
    });
    expect(byKey(steps, OrderTimelineStepKey.PURCHASE)).toMatchObject({
      state: OrderTimelineStepState.CURRENT,
      note: OrderTimelineNote.STAGE,
      reference: null,
    });
  });

  it('a held tracking is "waiting" at first and "a problem" after the alarm hours', () => {
    const base = {
      stage: OrderStage.TRACKING_HELD,
      amazonOrderId: '111-1',
      autoFulfillStatus: AutoFulfillStatus.PLACED,
    };
    const fresh = build({ ...base, shippedDetectedAt: '2026-10-01T10:00:00.000Z' });
    const overdue = build({ ...base, shippedDetectedAt: '2026-09-30T10:00:00.000Z' });
    expect(byKey(fresh, OrderTimelineStepKey.EBAY_TRACKING)?.state).toBe(OrderTimelineStepState.CURRENT);
    expect(byKey(overdue, OrderTimelineStepKey.EBAY_TRACKING)?.state).toBe(OrderTimelineStepState.ATTENTION);
    expect(byKey(overdue, OrderTimelineStepKey.AMAZON_SHIPPED)?.state).toBe(OrderTimelineStepState.DONE);
  });

  it('a shipped, converted order waits for delivery and shows the number eBay received', () => {
    const steps = build({
      stage: OrderStage.SHIPPED,
      autoFulfillStatus: AutoFulfillStatus.BLOCKED,
      amazonOrderId: '113-0158186-6357035',
      amazonLinkedAt: '2026-09-29T20:00:00.000Z',
      shippedDetectedAt: '2026-09-30T18:00:00.000Z',
      ebayTrackingPushedAt: '2026-09-30T23:34:00.000Z',
      ebayTrackingPushedNumber: 'AQUAA0359110926YQ',
    });
    expect(shape(steps)).toEqual([
      'received:done:received',
      'purchase:done:bought_linked',
      'amazon_shipped:done:amazon_shipped',
      'ebay_tracking:done:tracking_pushed',
      'delivered:current:waiting_delivery',
    ]);
    expect(byKey(steps, OrderTimelineStepKey.EBAY_TRACKING)?.reference).toBe('AQUAA0359110926YQ');
  });

  it('an order shipped outside the platform claims nothing it did not do', () => {
    const steps = build({ stage: OrderStage.SHIPPED, autoFulfillStatus: AutoFulfillStatus.SKIPPED });
    expect(shape(steps)).toEqual([
      'received:done:received',
      'purchase:skipped:purchase_not_recorded',
      'amazon_shipped:skipped:shipment_not_observed',
      'ebay_tracking:skipped:tracking_not_by_us',
      'delivered:skipped:delivery_not_tracked',
    ]);
    expect(steps.some((s) => s.state === OrderTimelineStepState.CURRENT)).toBe(false);
  });

  it('a delivered order is done end to end; a delivery before migration 133 has no date', () => {
    const base = {
      stage: OrderStage.DELIVERED,
      amazonOrderId: '111-1',
      amazonLinkedAt: '2026-09-25T10:00:00.000Z',
      shippedDetectedAt: '2026-09-26T10:00:00.000Z',
      ebayTrackingPushedAt: '2026-09-26T10:05:00.000Z',
    };
    const dated = build({ ...base, deliveredAt: '2026-09-28T09:00:00.000Z' });
    const undated = build(base);
    expect(dated.every((s) => s.state === OrderTimelineStepState.DONE)).toBe(true);
    expect(byKey(dated, OrderTimelineStepKey.DELIVERED)?.at).toBe('2026-09-28T09:00:00.000Z');
    expect(byKey(undated, OrderTimelineStepKey.DELIVERED)).toMatchObject({
      state: OrderTimelineStepState.DONE,
      at: null,
    });
  });

  it('an Amazon cancellation puts the purchase step back in front of the seller', () => {
    const steps = build({
      stage: OrderStage.AMAZON_CANCELLED,
      autoFulfillStatus: AutoFulfillStatus.PLACED,
      amazonOrderId: '111-1',
      amazonCancelledAt: '2026-10-01T08:00:00.000Z',
    });
    expect(byKey(steps, OrderTimelineStepKey.PURCHASE)).toMatchObject({
      state: OrderTimelineStepState.ATTENTION,
      note: OrderTimelineNote.STAGE,
      at: '2026-10-01T08:00:00.000Z',
    });
    expect(byKey(steps, OrderTimelineStepKey.AMAZON_SHIPPED)?.state).toBe(OrderTimelineStepState.UPCOMING);
  });

  describe('a sale cancelled on eBay', () => {
    it('keeps only what happened and closes the timeline', () => {
      const steps = build({
        stage: OrderStage.CANCELLED,
        autoFulfillStatus: AutoFulfillStatus.SKIPPED,
        ebayCancelledAt: '2026-10-01T07:00:00.000Z',
      });
      expect(shape(steps)).toEqual(['received:done:received', 'sale_cancelled:skipped:stage']);
      expect(steps[1].at).toBe('2026-10-01T07:00:00.000Z');
    });

    it('asks for the seller while a real Amazon order is still open', () => {
      const open = build({ stage: OrderStage.CANCELLED, amazonOrderId: '111-1' });
      const closed = build({
        stage: OrderStage.CANCELLED,
        amazonOrderId: '111-1',
        amazonCancelledAt: '2026-10-01T08:00:00.000Z',
      });
      const simulated = build({ stage: OrderStage.CANCELLED, amazonOrderId: 'SIM-1' });
      expect(byKey(open, OrderTimelineStepKey.SALE_CANCELLED)?.state).toBe(OrderTimelineStepState.ATTENTION);
      expect(byKey(open, OrderTimelineStepKey.PURCHASE)?.state).toBe(OrderTimelineStepState.DONE);
      expect(byKey(closed, OrderTimelineStepKey.SALE_CANCELLED)?.state).toBe(OrderTimelineStepState.SKIPPED);
      expect(byKey(simulated, OrderTimelineStepKey.SALE_CANCELLED)?.state).toBe(OrderTimelineStepState.SKIPPED);
    });
  });

  describe('buyer messages', () => {
    it('lists a sent message under its step and ignores skipped entries', () => {
      const steps = build({
        stage: OrderStage.TO_PURCHASE,
        messages: [
          { event: BuyerMessageEventType.ORDER_RECEIVED, status: BuyerMessageStatus.SENT, at: '2026-09-30T16:31:00.000Z' },
          { event: BuyerMessageEventType.SHIPPED, status: BuyerMessageStatus.SKIPPED, at: '2026-09-30T19:00:00.000Z' },
        ],
      });
      expect(steps.map((s) => s.key).slice(0, 3)).toEqual([
        OrderTimelineStepKey.RECEIVED,
        OrderTimelineStepKey.MESSAGE_ORDER_RECEIVED,
        OrderTimelineStepKey.PURCHASE,
      ]);
      expect(steps[1]).toMatchObject({
        isMessage: true,
        state: OrderTimelineStepState.DONE,
        note: OrderTimelineNote.MESSAGE_SENT,
        at: '2026-09-30T16:31:00.000Z',
      });
      expect(byKey(steps, OrderTimelineStepKey.MESSAGE_SHIPPED)).toBeUndefined();
    });

    it('a later success outranks an earlier failure; a failure alone is shown', () => {
      const retried = build({
        stage: OrderStage.TO_PURCHASE,
        messages: [
          { event: BuyerMessageEventType.ORDER_RECEIVED, status: BuyerMessageStatus.FAILED, at: '2026-09-30T16:31:00.000Z' },
          { event: BuyerMessageEventType.ORDER_RECEIVED, status: BuyerMessageStatus.SENT, at: '2026-09-30T16:35:00.000Z' },
        ],
      });
      const failed = build({
        stage: OrderStage.TO_PURCHASE,
        messages: [
          { event: BuyerMessageEventType.ORDER_RECEIVED, status: BuyerMessageStatus.FAILED, at: '2026-09-30T16:31:00.000Z' },
        ],
      });
      expect(byKey(retried, OrderTimelineStepKey.MESSAGE_ORDER_RECEIVED)).toMatchObject({
        note: OrderTimelineNote.MESSAGE_SENT,
        at: '2026-09-30T16:35:00.000Z',
      });
      expect(byKey(failed, OrderTimelineStepKey.MESSAGE_ORDER_RECEIVED)).toMatchObject({
        state: OrderTimelineStepState.ATTENTION,
        note: OrderTimelineNote.MESSAGE_FAILED,
      });
    });

    it('delivery messages follow the delivered step; a cancelled sale keeps a sent message', () => {
      const delivered = build({
        stage: OrderStage.DELIVERED,
        amazonOrderId: '111-1',
        deliveredAt: '2026-09-28T09:00:00.000Z',
        messages: [
          { event: BuyerMessageEventType.FEEDBACK_REQUEST, status: BuyerMessageStatus.SENT, at: '2026-10-01T09:00:00.000Z' },
          { event: BuyerMessageEventType.DELIVERED, status: BuyerMessageStatus.SENT, at: '2026-09-28T09:01:00.000Z' },
        ],
      });
      expect(delivered.map((s) => s.key).slice(-3)).toEqual([
        OrderTimelineStepKey.DELIVERED,
        OrderTimelineStepKey.MESSAGE_DELIVERED,
        OrderTimelineStepKey.MESSAGE_FEEDBACK_REQUEST,
      ]);

      const cancelled = build({
        stage: OrderStage.CANCELLED,
        messages: [{ event: BuyerMessageEventType.SHIPPED, status: BuyerMessageStatus.SENT, at: '2026-09-30T19:00:00.000Z' }],
      });
      expect(cancelled.map((s) => s.key)).toEqual([
        OrderTimelineStepKey.RECEIVED,
        OrderTimelineStepKey.MESSAGE_SHIPPED,
        OrderTimelineStepKey.SALE_CANCELLED,
      ]);
    });
  });

  it('every stage yields at most one step in focus and never an invalid date', () => {
    for (const stage of Object.values(OrderStage)) {
      const steps = build({ stage, orderDate: 'not-a-date' });
      const focus = steps.filter(
        (s) => s.state === OrderTimelineStepState.CURRENT || s.state === OrderTimelineStepState.ATTENTION
      );
      expect(focus.length).toBeLessThanOrEqual(1);
      expect(steps[0]).toMatchObject({ key: OrderTimelineStepKey.RECEIVED, at: null });
    }
  });
});
