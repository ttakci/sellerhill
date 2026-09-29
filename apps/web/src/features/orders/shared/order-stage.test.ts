import { OrderStage } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { orderStageHasAction, orderStagePresentation } from './order-stage';

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
    expect(orderStageHasAction(OrderStage.SHIPPED)).toBe(false);
  });
});
