import { CancellationBucket, OrderShipByState, OrderStage } from '@repo/shared';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { orderFlagBadges } from './order-flags';

const t = ((key: string) => key) as unknown as TFunction;
const money = (value: number): string => `$${value.toFixed(2)}`;

describe('orderFlagBadges', () => {
  const requestedAndRefunded = {
    shipByState: null,
    shipByDate: null,
    ebayRefundedAmount: 11.4,
    cancellation: { bucket: CancellationBucket.ACTION_DUE } as never,
  };

  it('shows the cancel request and the refund on an order that is not cancelled', () => {
    const labels = orderFlagBadges({ ...requestedAndRefunded, stage: OrderStage.TO_PURCHASE }, t, money).map(
      (badge) => badge.label
    );
    expect(labels).toEqual(['orders.flags.cancelRequested', 'orders.flags.refundedAmount']);
  });

  it('shows neither on a cancelled order: the stage already says it', () => {
    expect(orderFlagBadges({ ...requestedAndRefunded, stage: OrderStage.CANCELLED }, t, money)).toEqual([]);
  });

  it('still flags a late shipment before anything else', () => {
    const labels = orderFlagBadges(
      { ...requestedAndRefunded, shipByState: OrderShipByState.LATE, stage: OrderStage.TO_PURCHASE },
      t,
      money
    ).map((badge) => badge.label);
    expect(labels[0]).toBe('orders.flags.late');
  });
});
