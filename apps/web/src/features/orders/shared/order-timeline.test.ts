import {
  AutoFulfillStatus,
  OrderStage,
  OrderTimelineNote,
  OrderTimelineStepKey,
  OrderTimelineStepState,
  buildOrderTimeline,
} from '@repo/shared';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { orderTimelineIcon, toOrderTimelineRows } from './order-timeline';

const now = new Date('2026-10-01T12:00:00Z');

/** Echoes the key, so a row shows WHICH string it resolved. */
const t = ((key: string) => key) as unknown as TFunction;

const rowsFor = (stage: OrderStage, extra: Partial<Parameters<typeof buildOrderTimeline>[0]> = {}) =>
  toOrderTimelineRows(buildOrderTimeline({ stage, orderDate: '2026-09-30T16:30:00Z', now, ...extra }), {
    t,
    formatDate: (value) => `fmt(${value})`,
    stage,
    stageAction: 'ACTION',
    reasonLabel: 'REASON',
    now,
  });

describe('toOrderTimelineRows', () => {
  it('explains the step the order is on with the stage, and only that step', () => {
    const rows = rowsFor(OrderStage.PURCHASE_BLOCKED, { autoFulfillStatus: AutoFulfillStatus.BLOCKED });
    const purchase = rows.find((r) => r.id === OrderTimelineStepKey.PURCHASE);
    expect(purchase).toMatchObject({
      state: OrderTimelineStepState.ATTENTION,
      description: 'orders.stage.purchase_blocked.meaning',
      action: 'ACTION',
      reason: 'REASON',
    });
    for (const row of rows.filter((r) => r.id !== OrderTimelineStepKey.PURCHASE)) {
      expect({ id: row.id, action: row.action, reason: row.reason }).toEqual({
        id: row.id,
        action: null,
        reason: null,
      });
    }
  });

  it('shows the reason on the purchase step only — never under a held tracking', () => {
    const rows = rowsFor(OrderStage.TRACKING_HELD, {
      amazonOrderId: '111-1',
      shippedDetectedAt: '2026-10-01T11:00:00Z',
    });
    const tracking = rows.find((r) => r.id === OrderTimelineStepKey.EBAY_TRACKING);
    expect(tracking).toMatchObject({
      description: 'orders.stage.tracking_held.meaning',
      action: 'ACTION',
      reason: null,
    });
  });

  it('formats a known time and leaves an unknown one empty', () => {
    const rows = rowsFor(OrderStage.TO_PURCHASE);
    expect(rows[0]).toMatchObject({
      label: 'orders.timeline.step.received',
      description: 'orders.timeline.note.received',
    });
    expect(rows[0].dateLabel).toMatch(/^fmt\(2026-09-30T16:30:00/);
    expect(rows.find((r) => r.id === OrderTimelineStepKey.DELIVERED)?.dateLabel).toBeNull();
  });

  it('yields nothing for an order read without a timeline (the list rows)', () => {
    expect(toOrderTimelineRows(undefined, { t, formatDate: String, stage: OrderStage.SHIPPED, stageAction: null, reasonLabel: null, now })).toEqual(
      []
    );
  });
});

describe('orderTimelineIcon', () => {
  const step = (key: OrderTimelineStepKey, state: OrderTimelineStepState, note: OrderTimelineNote) => ({
    key,
    state,
    note,
    at: null,
  });

  it('a finished step is a check, a step that did not happen here is a dash', () => {
    expect(
      orderTimelineIcon(
        step(OrderTimelineStepKey.PURCHASE, OrderTimelineStepState.DONE, OrderTimelineNote.BOUGHT_AUTO),
        OrderStage.SHIPPED,
        { now }
      )
    ).toBe('check');
    expect(
      orderTimelineIcon(
        step(OrderTimelineStepKey.PURCHASE, OrderTimelineStepState.SKIPPED, OrderTimelineNote.PURCHASE_NOT_RECORDED),
        OrderStage.SHIPPED,
        { now }
      )
    ).toBe('minus');
  });

  it('the step in focus wears its stage icon, so the badge and the timeline agree', () => {
    expect(
      orderTimelineIcon(
        step(OrderTimelineStepKey.PURCHASE, OrderTimelineStepState.ATTENTION, OrderTimelineNote.STAGE),
        OrderStage.PURCHASE_UNKNOWN,
        { now }
      )
    ).toBe('help');
    expect(
      orderTimelineIcon(
        step(OrderTimelineStepKey.AMAZON_SHIPPED, OrderTimelineStepState.CURRENT, OrderTimelineNote.WAITING_SHIPMENT),
        OrderStage.PURCHASED,
        { now }
      )
    ).toBe('clock');
  });

  it('a step still ahead shows its own glyph; a cancelled sale keeps the cross', () => {
    expect(
      orderTimelineIcon(
        step(OrderTimelineStepKey.EBAY_TRACKING, OrderTimelineStepState.UPCOMING, OrderTimelineNote.UPCOMING_TRACKING),
        OrderStage.TO_PURCHASE,
        { now }
      )
    ).toBe('truck');
    expect(
      orderTimelineIcon(
        step(OrderTimelineStepKey.SALE_CANCELLED, OrderTimelineStepState.SKIPPED, OrderTimelineNote.STAGE),
        OrderStage.CANCELLED,
        { now }
      )
    ).toBe('x-circle');
  });
});
