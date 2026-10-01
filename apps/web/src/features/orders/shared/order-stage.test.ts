import { OrderStage } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import {
  isShipByUrgent,
  orderStageHasAction,
  orderStageHasDeadline,
  orderStagePresentation,
  orderStageShowsReason,
} from './order-stage';

const now = new Date('2026-09-30T12:00:00Z');

describe('orderStagePresentation', () => {
  it('gives every stage an icon and a badge variant', () => {
    for (const stage of Object.values(OrderStage)) {
      const p = orderStagePresentation(stage, { now });
      expect({ stage, icon: typeof p.icon, variant: typeof p.variant }).toEqual({
        stage,
        icon: 'string',
        variant: 'string',
      });
    }
  });

  it('renders the actionable stages red, "to purchase" amber', () => {
    expect(orderStagePresentation(OrderStage.PURCHASE_BLOCKED, { now }).variant).toBe('error');
    expect(orderStagePresentation(OrderStage.AMAZON_CANCELLED, { now }).variant).toBe('error');
    expect(orderStagePresentation(OrderStage.TO_PURCHASE, { now }).variant).toBe('warning');
  });

  it('keeps a held tracking amber for 12 hours, then red', () => {
    expect(
      orderStagePresentation(OrderStage.TRACKING_HELD, { shippedDetectedAt: '2026-09-30T02:00:00Z', now }).variant
    ).toBe('warning');
    expect(
      orderStagePresentation(OrderStage.TRACKING_HELD, { shippedDetectedAt: '2026-09-29T23:00:00Z', now }).variant
    ).toBe('error');
  });

  it('knows which stages carry a "what you do" sentence', () => {
    expect(orderStageHasAction(OrderStage.TO_PURCHASE)).toBe(true);
    expect(orderStageHasAction(OrderStage.TRACKING_HELD)).toBe(true);
    expect(orderStageHasAction(OrderStage.PURCHASE_UNKNOWN)).toBe(true);
    expect(orderStageHasAction(OrderStage.SHIPPED)).toBe(false);
  });

  it('renders an unconfirmed purchase red, with its own icon — not the blocked triangle', () => {
    const unknown = orderStagePresentation(OrderStage.PURCHASE_UNKNOWN, { now });
    const blocked = orderStagePresentation(OrderStage.PURCHASE_BLOCKED, { now });
    expect(unknown.variant).toBe('error');
    expect(unknown.icon).not.toBe(blocked.icon);
  });
});

describe('orderStageShowsReason', () => {
  it('shows the auto-fulfill reason only while it still explains the order', () => {
    expect(orderStageShowsReason(OrderStage.PURCHASE_BLOCKED)).toBe(true);
    expect(orderStageShowsReason(OrderStage.PURCHASE_UNKNOWN)).toBe(true);
    // A multi-item order or a listing outside the plan limit: automation left it to the seller.
    expect(orderStageShowsReason(OrderStage.TO_PURCHASE)).toBe(true);
    // Once bought or shipped, a stale "Reason: address" must not linger.
    expect(orderStageShowsReason(OrderStage.PURCHASED)).toBe(false);
    expect(orderStageShowsReason(OrderStage.SHIPPED)).toBe(false);
    expect(orderStageShowsReason(OrderStage.DELIVERED)).toBe(false);
  });
});

describe('ship-by deadline', () => {
  it('matters only while the seller still has to act', () => {
    expect(orderStageHasDeadline(OrderStage.TO_PURCHASE)).toBe(true);
    expect(orderStageHasDeadline(OrderStage.AMAZON_CANCELLED)).toBe(true);
    expect(orderStageHasDeadline(OrderStage.PURCHASE_UNKNOWN)).toBe(true);
    expect(orderStageHasDeadline(OrderStage.SHIPPED)).toBe(false);
    expect(orderStageHasDeadline(OrderStage.DELIVERED)).toBe(false);
  });

  it('is urgent inside 24 hours and once it has passed', () => {
    expect(isShipByUrgent('2026-10-02T12:00:01Z', now)).toBe(false);
    expect(isShipByUrgent('2026-10-01T11:00:00Z', now)).toBe(true);
    expect(isShipByUrgent('2026-09-29T00:00:00Z', now)).toBe(true);
    expect(isShipByUrgent(null, now)).toBe(false);
    expect(isShipByUrgent('not a date', now)).toBe(false);
  });
});
