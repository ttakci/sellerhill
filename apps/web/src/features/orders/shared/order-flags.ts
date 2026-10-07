import { CancellationBucket, OrderShipByState, type OrderDto } from '@repo/shared';
import type { TFunction } from 'i18next';

import type { OrderCardStatBadge } from './OrderCard';

/**
 * The conditions that sit BESIDE an order's stage — eBay's ship-by deadline
 * and a refund. They are chips next to the stage badge, never a stage: an
 * order is "purchased" AND "late", "delivered" AND "refunded". One function so
 * the card and the table row can never show different chips for one order.
 */
export function orderFlagBadges(
  order: Pick<OrderDto, 'shipByState' | 'shipByDate' | 'ebayRefundedAmount'> & Partial<Pick<OrderDto, 'cancellation'>>,
  t: TFunction,
  formatCurrency: (value: number) => string,
  formatDay?: (value: string) => string
): OrderCardStatBadge[] {
  const badges: OrderCardStatBadge[] = [];
  if (order.shipByState === OrderShipByState.LATE) {
    badges.push({ label: t('orders.flags.late'), variant: 'error' });
  } else if (order.shipByState === OrderShipByState.DUE_SOON) {
    badges.push({
      label:
        order.shipByDate && formatDay
          ? t('orders.flags.dueSoonBy', { date: formatDay(order.shipByDate) })
          : t('orders.flags.dueSoon'),
      variant: 'warning',
    });
  }
  if (order.cancellation?.bucket === CancellationBucket.ACTION_OVERDUE) {
    badges.push({ label: t('orders.flags.cancelRequested'), variant: 'error' });
  } else if (order.cancellation?.bucket === CancellationBucket.ACTION_DUE) {
    badges.push({ label: t('orders.flags.cancelRequested'), variant: 'warning' });
  }
  if (order.ebayRefundedAmount !== null && order.ebayRefundedAmount !== undefined && order.ebayRefundedAmount > 0) {
    badges.push({
      label: t('orders.flags.refundedAmount', { amount: formatCurrency(order.ebayRefundedAmount) }),
      variant: 'neutral',
    });
  }
  return badges;
}
